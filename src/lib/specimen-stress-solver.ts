/**
 * NIT Trichy Titanium AM Platform (Ti-6Al-4V)
 * Coupled 3D Digital Twin (ASTM E8 Tensile Specimen) Stress Field & Geometry Solver
 *
 * Computes process-, parameter-, alloy-, and post-processing-dependent residual stress
 * fields σ(r, z) and accurate solid ASTM E8 round tensile bar geometry profiles.
 */

import {
  CanonicalProcessId,
  ProcessRegimeClassification,
  normalizeCanonicalProcessId
} from './regime-classifier';

export type PostProcessingRoute =
  | 'None'
  | 'Stress-relieved'
  | 'Annealed'
  | 'HIP'
  | 'Solution-Aged'
  | 'Bi-modal';

export interface SpecimenProcessParams {
  P: number;
  v: number;
  h: number;
  t: number;
  T0: number;
  db?: number;
  coolingRate?: number;
  sinterTempC?: number;
  sinterHoldHours?: number;
}

export interface SpecimenStressFieldResult {
  processId: CanonicalProcessId;
  processLabel: string;
  alloyId: string;
  postProcessing: string;
  postFactor: number;
  /** Peak surface tensile stress across the gauge section (MPa) */
  gaugeSurfaceStressMpa: number;
  /** Peak surface tensile stress including 1.12x fillet shoulder concentration (MPa) */
  peakSurfaceStressMpa: number;
  /** Balancing internal compressive core stress at r = 0 (MPa, negative) */
  coreCompressiveStressMpa: number;
  /** True volumetric neutral stress radius fraction r / R(z) */
  neutralRadiusFraction: number;
  /** Fillet stress concentration multiplier (+12% -> 1.12) */
  filletConcentrationFactor: number;
  /** Physical reference range bounds used for absolute Blue->Red heatmap mapping */
  referenceScaleMinMpa: number;
  referenceScaleMaxMpa: number;
  /** Whether thermal distortion/warpage highlight is active (e.g. WAAM HI > 600 J/mm) */
  thermalDistortionActive: boolean;
  warpageSeverity: number;
  /** Heatmap caption & mode metadata */
  isBinderJetting: boolean;
  sinterDensityPct: number;
  sinterTempC: number;
  sinterHoldHours: number;
  /** Compact HUD context pill text */
  contextHudSummary: string;
  regimeShortLabel: string;
  regimeSeverity: string;
}

export const POST_PROCESSING_STRESS_FACTORS: Record<string, number> = {
  None: 1.00,
  'As-Built': 1.00,
  'Stress-relieved': 0.28,
  Annealed: 0.18,
  HIP: 0.08,
  'Solution-Aged': 0.22,
  'Bi-modal': 0.20
};

/**
 * Evaluates the exact ASTM E8 round tensile specimen revolve profile R_norm(|z|)
 * normalized to R_grip = 1.0 along normalized axis z ∈ [-1.0, +1.0]:
 * - Grip sections |z| ∈ [0.62, 1.0]: R_grip = 1.0
 * - Smooth circular-arc tangent fillets |z| ∈ [0.46, 0.62]
 * - Parallel reduced gauge section |z| ∈ [0.0, 0.46]: R_gauge = 0.56 (~4:1 L/D)
 */
export function evaluateAstmE8NormalizedRadius(zNorm: number, aspectLenToGripRadius = 4.857): number {
  const absZ = Math.min(1.0, Math.abs(zNorm));
  const R_GAUGE = 0.56;
  const R_GRIP = 1.0;
  const Z_GAUGE_END = 0.46;
  const Z_FILLET_END = 0.62;

  if (absZ <= Z_GAUGE_END) return R_GAUGE;
  if (absZ >= Z_FILLET_END) return R_GRIP;

  // Symmetric C1 circular bi-arc tangent at both Z_GAUGE_END and Z_FILLET_END
  const u = (absZ - Z_GAUGE_END) / (Z_FILLET_END - Z_GAUGE_END); // [0, 1]
  const dZ = (Z_FILLET_END - Z_GAUGE_END) * aspectLenToGripRadius;
  const dZHalf = 0.5 * dZ;
  const dRHalf = 0.5 * (R_GRIP - R_GAUGE);
  const rArc = (dZHalf * dZHalf + dRHalf * dRHalf) / (2 * dRHalf);

  if (u <= 0.5) {
    const dx = u * dZ;
    return R_GAUGE + (rArc - Math.sqrt(Math.max(0, rArc * rArc - dx * dx)));
  } else {
    const dx = (1 - u) * dZ;
    return R_GRIP - (rArc - Math.sqrt(Math.max(0, rArc * rArc - dx * dx)));
  }
}

/**
 * Computes the coupled AM residual stress field parameters for the active process,
 * alloy, slider parameters, post-processing state, and unified regime classification.
 */
export function computeSpecimenStressField(
  processIdInput: string,
  alloyId: string,
  params: SpecimenProcessParams,
  postProcessing: string,
  regime?: Partial<ProcessRegimeClassification>
): SpecimenStressFieldResult {
  const processId = normalizeCanonicalProcessId(processIdInput);
  const P = Number.isFinite(Number(params.P)) ? Number(params.P) : 280;
  const v = Number.isFinite(Number(params.v)) ? Math.max(0.5, Number(params.v)) : 960;
  const t = Number.isFinite(Number(params.t)) ? Math.max(10, Number(params.t)) : 40;
  const T0 = Number.isFinite(Number(params.T0)) ? Number(params.T0) : 200;

  const normPost = String(postProcessing || 'HIP').trim();
  const postFactor = POST_PROCESSING_STRESS_FACTORS[normPost] !== undefined
    ? POST_PROCESSING_STRESS_FACTORS[normPost]
    : 0.08;

  const isEli = String(alloyId || '').toLowerCase().includes('eli');
  const alloyFactor = isEli ? 0.95 : 1.0;

  const neutralRadiusFraction = 0.70;
  const filletConcentrationFactor = 1.12;
  const regimeShort = (regime && regime.shortLabel) ? regime.shortLabel : 'Conduction Mode';
  const regimeSev = (regime && regime.severity) ? regime.severity : 'optimal';

  // 1. BINDER JETTING: Near stress-free after vacuum sintering (-25 to +25 MPa)
  if (processId === 'binder_jetting') {
    const sinterTempC = Number.isFinite(Number(params.sinterTempC))
      ? Number(params.sinterTempC)
      : Math.round(1240 + Math.min(60, Math.max(0, (T0 - 25) * 0.25)));
    const sinterHoldHours = Number.isFinite(Number(params.sinterHoldHours)) ? Number(params.sinterHoldHours) : 3.5;

    const rawSinterResid = (18.5 + (P / 250) * 6.5) * (sinterTempC >= 1260 ? 0.85 : 1.0) * alloyFactor;
    const relaxation = normPost === 'HIP' ? 0.42 : (normPost === 'Annealed' ? 0.55 : (normPost === 'None' ? 1.0 : 0.70));
    const gaugeSurf = Math.min(25, Math.max(4, Math.round(rawSinterResid * relaxation)));
    const peakSurf = Math.min(25, Math.round(gaugeSurf * filletConcentrationFactor));
    const coreComp = -Math.min(25, Math.max(3, Math.round(peakSurf * 0.75)));
    const sinterDensityPct = normPost === 'HIP' ? 99.85 : Math.min(98.9, 95.8 + (sinterTempC - 1220) * 0.045);

    const postShort = normPost === 'None' ? 'Green-Sinter' : normPost;
    const contextHudSummary = `Binder Jetting • ${sinterTempC}°C Sinter (${sinterHoldHours}h) • ${postShort} | Peak +${peakSurf} MPa • ${regimeShort}`;

    return {
      processId,
      processLabel: 'Binder Jetting',
      alloyId,
      postProcessing: normPost,
      postFactor,
      gaugeSurfaceStressMpa: gaugeSurf,
      peakSurfaceStressMpa: peakSurf,
      coreCompressiveStressMpa: coreComp,
      neutralRadiusFraction,
      filletConcentrationFactor,
      referenceScaleMinMpa: -450,
      referenceScaleMaxMpa: 650,
      thermalDistortionActive: false,
      warpageSeverity: 0,
      isBinderJetting: true,
      sinterDensityPct: Number(sinterDensityPct.toFixed(2)),
      sinterTempC,
      sinterHoldHours,
      contextHudSummary,
      regimeShortLabel: regimeShort,
      regimeSeverity: regimeSev
    };
  }

  let asBuiltGaugeSurface = 480;
  let asBuiltCoreRatio = 0.70;
  let thermalDistortionActive = false;
  let warpageSeverity = 0;
  let processLabel = 'LPBF';
  let processContextPart = '';

  if (processId === 'waam') {
    processLabel = 'WAAM';
    const heatInput = P / Math.max(0.5, v); // J/mm
    // Macro-scale longitudinal tensile stress (+200 to +580 MPa As-Built) driven by HI = P / v
    const hiClamped = Math.max(80, Math.min(1000, heatInput));
    const hiNorm = (hiClamped - 100) / 700; // 0..1.28
    const preheatRelief = Math.max(0.78, Math.min(1.06, 1.04 - 0.00075 * (T0 - 25)));
    const rawGauge = (235 + 265 * Math.pow(Math.max(0.02, hiNorm), 0.78)) * preheatRelief * alloyFactor;
    asBuiltGaugeSurface = Math.max(180, Math.min(518, Math.round(rawGauge)));
    asBuiltCoreRatio = 0.68;

    if (heatInput > 600 || regimeSev === 'danger' && regimeShort.toLowerCase().includes('overheat')) {
      thermalDistortionActive = true;
      warpageSeverity = Math.min(1.0, Math.max(0.25, (heatInput - 600) / 350));
      asBuiltGaugeSurface = Math.max(460, Math.min(518, asBuiltGaugeSurface));
    }
    processContextPart = `${processLabel} • HI ${Math.round(heatInput)} J/mm • T₀ ${Math.round(T0)}°C`;
  } else if (processId === 'lded') {
    processLabel = 'L-DED';
    // Moderate-to-high tensile surface stress (+250 to +520 MPa As-Built) scaled by P, v, t, T0
    const powerRatio = P / 1600;
    const speedRatio = 15 / Math.max(2, v);
    const thicknessRatio = 450 / Math.max(100, t);
    const gradIndex = Math.pow(Math.max(0.25, powerRatio), 0.45) *
      Math.pow(Math.max(0.3, speedRatio), 0.25) *
      Math.pow(Math.max(0.4, thicknessRatio), 0.15);
    const preheatRelief = Math.max(0.75, Math.min(1.08, 1.05 - 0.00085 * (T0 - 25)));
    const rawGauge = 345 * gradIndex * preheatRelief * alloyFactor;
    asBuiltGaugeSurface = Math.max(225, Math.min(464, Math.round(rawGauge)));
    asBuiltCoreRatio = 0.69;
    processContextPart = `${processLabel} • ${Math.round(P)} W / ${v} mm/s • T₀ ${Math.round(T0)}°C`;
  } else {
    processLabel = 'LPBF';
    // Steep rapid-quench gradients -> As-Built peak +350 to +680 MPa; core -250 to -480 MPa
    // Scales up with P / sqrt(v) and drops cleanly as T0 increases (25°C -> 300°C)
    const pSqrtV = P / Math.sqrt(Math.max(100, v));
    const refPSqrtV = 280 / Math.sqrt(960); // 9.037
    const gradientRatio = Math.max(0.4, Math.min(3.0, pSqrtV / refPSqrtV));
    const preheatFactor = Math.max(0.52, Math.min(1.12, 1.10 - 0.00118 * (T0 - 25)));
    const rawGauge = 475 * Math.pow(gradientRatio, 0.28) * preheatFactor * alloyFactor;
    const minGauge = T0 <= 310 ? 315 : 220;
    asBuiltGaugeSurface = Math.max(minGauge, Math.min(607, Math.round(rawGauge)));
    asBuiltCoreRatio = 0.71;
    processContextPart = `${processLabel} • ${Math.round(P)} W / ${Math.round(v)} mm/s • T₀ ${Math.round(T0)}°C`;
  }

  const gaugeSurfaceStressMpa = Math.max(12, Math.round(asBuiltGaugeSurface * postFactor));
  const peakSurfaceStressMpa = Math.max(15, Math.round(asBuiltGaugeSurface * filletConcentrationFactor * postFactor));
  const coreCompressiveStressMpa = -Math.max(10, Math.round(peakSurfaceStressMpa * asBuiltCoreRatio));

  const postShort = normPost === 'None' ? 'As-Built' : normPost;
  const contextHudSummary = `${processContextPart} • ${postShort} | Peak +${peakSurfaceStressMpa} MPa • ${regimeShort}`;

  return {
    processId,
    processLabel,
    alloyId,
    postProcessing: normPost,
    postFactor,
    gaugeSurfaceStressMpa,
    peakSurfaceStressMpa,
    coreCompressiveStressMpa,
    neutralRadiusFraction,
    filletConcentrationFactor,
    referenceScaleMinMpa: -450,
    referenceScaleMaxMpa: 650,
    thermalDistortionActive,
    warpageSeverity,
    isBinderJetting: false,
    sinterDensityPct: normPost === 'HIP' ? 99.98 : 99.85,
    sinterTempC: 0,
    sinterHoldHours: 0,
    contextHudSummary,
    regimeShortLabel: regimeShort,
    regimeSeverity: regimeSev
  };
}

/**
 * Evaluates local spatial residual stress σ(r_frac, z_norm) in MPa:
 * - Parabolic radial transition from σ_core (r=0) -> 0 (r=0.70*R) -> σ_surf (r=R)
 * - Uniform peak stress across gauge |z| <= 0.46
 * - +12% stress concentration at fillet shoulders |z| ∈ [0.46, 0.56]
 * - Tapers smoothly in grip ends |z| > 0.62
 */
export function evaluateLocalResidualStressMpa(
  rFrac: number,
  zNorm: number,
  field: SpecimenStressFieldResult
): number {
  const rf = Math.max(0, Math.min(1, rFrac));
  const absZ = Math.min(1, Math.abs(zNorm));
  const rn = field.neutralRadiusFraction || 0.70;

  let axialMult = 1.0;
  if (absZ <= 0.44) {
    axialMult = 1.0;
  } else if (absZ <= 0.52) {
    // Smooth +12% fillet shoulder stress concentration peaking near |z| ≈ 0.48
    const center = 0.48;
    const bell = Math.exp(-Math.pow((absZ - center) / 0.035, 2));
    axialMult = 1.0 + (field.filletConcentrationFactor - 1.0) * bell;
  } else if (absZ <= 0.62) {
    const t = (absZ - 0.52) / 0.10;
    axialMult = 1.0 - 0.18 * t;
  } else {
    const t = (absZ - 0.62) / 0.38;
    axialMult = 0.82 - 0.24 * t;
  }

  if (rf <= rn) {
    const ratio = rf / rn;
    const coreAxial = Math.min(1.0, axialMult);
    return field.coreCompressiveStressMpa * (1.0 - ratio * ratio) * coreAxial;
  } else {
    const ratio = (rf * rf - rn * rn) / (1.0 - rn * rn);
    return field.gaugeSurfaceStressMpa * ratio * axialMult;
  }
}
