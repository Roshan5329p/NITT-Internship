/**
 * NIT Trichy Titanium AM Platform — Deep Ti-6Al-4V Physical Metallurgy Engine
 * Dedicated 100% to Ti-6Al-4V Grade 5 (UNS R56400) & Grade 23 ELI (UNS R56401).
 *
 * Implements:
 *   1. Interstitial Oxygen (0.08–0.22 wt% O) & Powder Reuse Cycles (0–30):
 *      - Dynamic beta-transus shift (975°C -> 1010°C)
 *      - Solid-solution hardening (~+70 MPa per +0.05 wt% O) & ductility / K_IC knockdown
 *      - Automatic ASTM F3001 (>0.13 wt% ELI) and ASTM F2924 (>0.20 wt% Gr5) enforcement
 *   2. Build Orientation (0° XY, 45°, 90° Z) & Scan Rotation (67° vs 90°) Anisotropy:
 *      - Prior-beta <001> columnar texture coupling (attenuated by HIP & 67° rotation)
 *   3. Explicit alpha / alpha' Lath Coarsening & Hall-Petch Kinetics:
 *      - Cube-law Arrhenius coarsening lambda_alpha(coolingRate, T_HT, t_HT)
 *      - Yield strength sigma_y = sigma_0(O2) + k_HP * lambda_alpha^(-1/2)
 */

export type Ti64AlloyGrade = 'ti64_gr5' | 'ti64_eli';
export type BuildOrientationDeg = 0 | 45 | 90;
export type ScanRotationDeg = 67 | 90;
export type Ti64PostProcessing =
  | 'None'
  | 'Stress-relieved'
  | 'Annealed'
  | 'HIP'
  | 'Solution-Aged'
  | 'Bi-modal';

export interface Ti64MetallurgyInput {
  alloyId?: string;
  processId?: string;
  coolingRateKs: number;
  postProcessing: string;
  oxygenWtPct?: number;
  powderReuseCycles?: number;
  autoCoupleReuse?: boolean;
  buildOrientationDeg?: number;
  scanRotationDeg?: number;
  lofIndex?: number;
  densityPct?: number;
}

export interface OxygenAndReuseResult {
  alloyId: Ti64AlloyGrade;
  virginOxygenWtPct: number;
  effectiveOxygenWtPct: number;
  powderReuseCycles: number;
  autoCoupleReuse: boolean;
  pickupPerCycleWtPct: number;
  betaTransusC: number;
  solidSolutionDeltaYsMpa: number;
  sigma0Mpa: number;
  ductilityMultiplier: number;
  kicMultiplier: number;
  astmF3001LimitWtPct: number;
  astmF2924LimitWtPct: number;
  astmF3001OxygenPass: boolean;
  astmF2924OxygenPass: boolean;
  activeAlloyOxygenPass: boolean;
  chemistryAlert: string | null;
}

export interface LathKineticsResult {
  asBuiltLathUm: number;
  alphaLathWidthUm: number;
  invSqrtLathUm: number;
  heatTreatmentTempC: number;
  heatTreatmentHours: number;
  coarseningRatio: number;
  precipitationBoostMpa: number;
}

export interface AnisotropyResult {
  buildOrientationDeg: BuildOrientationDeg;
  scanRotationDeg: ScanRotationDeg;
  orientationLabel: string;
  ysFactor: number;
  utsFactor: number;
  elongationFactor: number;
  residualStressFactor: number;
  hipAttenuation: number;
  rotationTextureFactor: number;
}

export interface Ti64MetallurgyResult {
  oxygen: OxygenAndReuseResult;
  lath: LathKineticsResult;
  anisotropy: AnisotropyResult;
  hallPetchIncrementMpa: number;
  hallPetchYieldStrengthMpa: number;
  predictedUtsMpa: number;
  predictedHv: number;
  taborFactor: number;
  utsToYsRatio: number;
  predictedKicMpaM05: number;
}

function normalizeTi64Alloy(raw?: string): Ti64AlloyGrade {
  const s = (raw || 'ti64_gr5').toLowerCase().trim();
  if (s.includes('eli') || s.includes('23') || s === 'f3001') return 'ti64_eli';
  return 'ti64_gr5';
}

export function normalizePostProcessing(raw?: string): Ti64PostProcessing {
  const s = (raw || 'HIP').toLowerCase().trim();
  if (s === 'none' || s.includes('as-built') || s.includes('as_built')) return 'None';
  if (s.includes('stress')) return 'Stress-relieved';
  if (s.includes('anneal')) return 'Annealed';
  if (s.includes('bi-modal') || s.includes('bimodal')) return 'Bi-modal';
  if (s.includes('solution') || s === 'sta') return 'Solution-Aged';
  return 'HIP';
}

export function normalizeBuildOrientation(deg?: number): BuildOrientationDeg {
  if (deg === 45) return 45;
  if (deg === 90) return 90;
  return 0;
}

function normalizeScanRotation(deg?: number): ScanRotationDeg {
  return deg === 90 ? 90 : 67;
}

function getDefaultOxygenForAlloy(alloyId?: string): number {
  return normalizeTi64Alloy(alloyId) === 'ti64_eli' ? 0.11 : 0.16;
}

/**
 * Computes effective interstitial oxygen (0.08–0.22 wt% O), powder reuse pickup,
 * dynamic beta-transus shift (975°C -> 1010°C), solid-solution hardening,
 * and ASTM F3001 / F2924 chemistry qualification compliance.
 */
export function computeOxygenAndReuseEffects(params: {
  alloyId?: string;
  processId?: string;
  oxygenWtPct?: number;
  powderReuseCycles?: number;
  autoCoupleReuse?: boolean;
}): OxygenAndReuseResult {
  const alloyId = normalizeTi64Alloy(params.alloyId);
  const proc = (params.processId || 'lpbf').toLowerCase().trim();
  const virginOxygenWtPct = getDefaultOxygenForAlloy(alloyId);

  const reuseCycles = Number.isFinite(params.powderReuseCycles)
    ? Math.max(0, Math.min(30, Math.round(Number(params.powderReuseCycles))))
    : 0;
  const autoCoupleReuse = params.autoCoupleReuse !== false;

  // Empirically calibrated O2 pickup rates from Denti (2019) & Koushik (2023)
  const pickupPerCycleWtPct =
    proc === 'waam' ? 0.0008 :
    proc.includes('binder') || proc === 'bj' ? 0.0018 :
    proc.includes('ded') ? 0.0025 : 0.0032;

  let rawO2 = Number.isFinite(params.oxygenWtPct)
    ? Number(params.oxygenWtPct)
    : virginOxygenWtPct;

  if (autoCoupleReuse && params.oxygenWtPct === undefined) {
    rawO2 = virginOxygenWtPct + reuseCycles * pickupPerCycleWtPct;
  }

  const effectiveOxygenWtPct = Number(
    Math.max(0.08, Math.min(0.22, rawO2)).toFixed(3)
  );

  // Oxygen stabilizes alpha phase, shifting T_beta from 975°C (0.08 wt%) to 1010°C (0.22 wt%)
  const o2Norm = (effectiveOxygenWtPct - 0.08) / (0.22 - 0.08);
  const betaTransusC = Number((975.0 + o2Norm * (1010.0 - 975.0)).toFixed(1));

  // Solid-solution strengthening: ~ +70 MPa per +0.05 wt% O above virgin ELI reference (0.11 wt%)
  const deltaO2 = effectiveOxygenWtPct - 0.11;
  const solidSolutionDeltaYsMpa = Number(((deltaO2 / 0.05) * 70.0).toFixed(1));
  const sigma0Mpa = Number((710.0 + solidSolutionDeltaYsMpa).toFixed(1));

  // Ductility & fracture toughness embrittlement above ~0.12 wt% O
  const excessAboveBase = Math.max(0, effectiveOxygenWtPct - 0.12);
  const belowBase = Math.max(0, 0.12 - effectiveOxygenWtPct);
  const ductilityMultiplier = Number(
    Math.max(0.45, Math.min(1.12, 1.0 - 3.6 * excessAboveBase + 1.5 * belowBase)).toFixed(4)
  );
  const kicMultiplier = Number(
    Math.max(0.55, Math.min(1.10, 1.0 - 2.8 * excessAboveBase + 1.2 * belowBase)).toFixed(4)
  );

  const astmF3001LimitWtPct = 0.13;
  const astmF2924LimitWtPct = 0.20;
  const astmF3001OxygenPass = effectiveOxygenWtPct <= astmF3001LimitWtPct;
  const astmF2924OxygenPass = effectiveOxygenWtPct <= astmF2924LimitWtPct;
  const activeAlloyOxygenPass =
    alloyId === 'ti64_eli' ? astmF3001OxygenPass : astmF2924OxygenPass;

  let chemistryAlert: string | null = null;
  if (alloyId === 'ti64_eli' && !astmF3001OxygenPass) {
    chemistryAlert =
      `ASTM F3001 FAILURE: Interstitial O₂ (${effectiveOxygenWtPct.toFixed(3)} wt%) exceeds 0.130 wt% Grade 23 ELI threshold.`;
  } else if (alloyId === 'ti64_gr5' && !astmF2924OxygenPass) {
    chemistryAlert =
      `ASTM F2924 FAILURE: Interstitial O₂ (${effectiveOxygenWtPct.toFixed(3)} wt%) exceeds 0.200 wt% Grade 5 threshold.`;
  }

  return {
    alloyId,
    virginOxygenWtPct,
    effectiveOxygenWtPct,
    powderReuseCycles: reuseCycles,
    autoCoupleReuse,
    pickupPerCycleWtPct,
    betaTransusC,
    solidSolutionDeltaYsMpa,
    sigma0Mpa,
    ductilityMultiplier,
    kicMultiplier,
    astmF3001LimitWtPct,
    astmF2924LimitWtPct,
    astmF3001OxygenPass,
    astmF2924OxygenPass,
    activeAlloyOxygenPass,
    chemistryAlert
  };
}

/**
 * Explicit alpha / alpha' lath coarsening kinetics:
 *   lambda_as_built = clamp(0.32..2.60, 6.8 * coolingRate^-0.19)  [0.3-0.6 um for LPBF]
 *   lambda_alpha^3  = lambda_as_built^3 + K0 * exp(-Q_R / T_K) * t_hr
 */
export function computeAlphaLathKinetics(
  coolingRateKs: number,
  postProcessing: string,
  oxygenWtPct: number = 0.16
): LathKineticsResult {
  const safeCooling = Number.isFinite(coolingRateKs) && coolingRateKs > 0 ? coolingRateKs : 4.8e5;
  const post = normalizePostProcessing(postProcessing);

  // As-built quench lath width: ~0.45-0.58 um in LPBF (10^5-10^6 K/s), ~1.4 um in L-DED, ~2.5 um in WAAM
  const asBuiltLathUm = Math.max(
    0.32,
    Math.min(2.60, 6.8 * Math.pow(Math.max(10, safeCooling), -0.19))
  );

  // Heat-treatment temperature & dwell schedule
  let heatTreatmentTempC = 25;
  let heatTreatmentHours = 0;
  let precipitationBoostMpa = 0;

  if (post === 'Stress-relieved') {
    heatTreatmentTempC = 650;
    heatTreatmentHours = 2.0;
  } else if (post === 'Annealed') {
    heatTreatmentTempC = 730;
    heatTreatmentHours = 2.0;
  } else if (post === 'HIP') {
    heatTreatmentTempC = 920;
    heatTreatmentHours = 2.0;
  } else if (post === 'Solution-Aged' || post === 'Bi-modal') {
    // Duplex solution + aging: finer secondary alpha_s + coherent Ti3Al precipitation hardening
    heatTreatmentTempC = 705;
    heatTreatmentHours = 2.0;
    precipitationBoostMpa = post === 'Solution-Aged' ? 68.0 : 32.0;
  }

  // Cube-law Ostwald coarsening calibrated so LPBF -> SR (~1.0 um), Annealed (1.5-2.2 um), HIP (3.0-4.5 um)
  // High interstitial oxygen mildly retards beta-to-alpha interface migration
  const Q_OVER_R = 15500.0;
  const K0 = 1.019e7;
  const o2Retardation = Math.max(0.85, 1.0 - 0.9 * Math.max(0, oxygenWtPct - 0.14));

  let lath3 = Math.pow(asBuiltLathUm, 3);
  if (heatTreatmentHours > 0 && heatTreatmentTempC > 200) {
    const tKelvin = heatTreatmentTempC + 273.15;
    lath3 += K0 * o2Retardation * Math.exp(-Q_OVER_R / tKelvin) * heatTreatmentHours;
  }

  const alphaLathWidthUm = Number(Math.max(0.32, Math.cbrt(Math.max(1e-6, lath3))).toFixed(3));
  const invSqrtLathUm = Number((1.0 / Math.sqrt(Math.max(0.1, alphaLathWidthUm))).toFixed(4));

  return {
    asBuiltLathUm: Number(asBuiltLathUm.toFixed(3)),
    alphaLathWidthUm,
    invSqrtLathUm,
    heatTreatmentTempC,
    heatTreatmentHours,
    coarseningRatio: Number((alphaLathWidthUm / Math.max(0.01, asBuiltLathUm)).toFixed(2)),
    precipitationBoostMpa
  };
}

/**
 * Prior-beta <001> columnar anisotropy as a function of build orientation (0° XY, 45°, 90° Z)
 * and laser/arc scan rotation (67° alternating vs 90° orthogonal).
 * HIP recrystallization attenuates directional anisotropy by ~72%.
 */
export function computeOrientationAnisotropy(
  buildOrientationDeg?: number,
  scanRotationDeg?: number,
  postProcessing: string = 'HIP',
  lofIndex: number = 0.7
): AnisotropyResult {
  const ori = normalizeBuildOrientation(buildOrientationDeg);
  const rot = normalizeScanRotation(scanRotationDeg);
  const post = normalizePostProcessing(postProcessing);

  // HIP & Annealing randomize alpha variants and heal interlayer LOF flaws
  const hipAttenuation =
    post === 'HIP' ? 0.28 :
    post === 'Annealed' ? 0.55 :
    post === 'Stress-relieved' ? 0.85 : 1.0;

  // 67° alternating scan rotation interrupts <001> fiber continuity & relieves thermal stress vs 90°
  const rotationTextureFactor = rot === 67 ? 0.78 : 1.0;
  const residualStressFactor = rot === 67 ? 0.93 : 1.04;

  // Base directional deltas (ref 0° horizontal XY)
  let baseYsDelta = 0.0;
  let baseElDelta = 0.0;
  let orientationLabel = '0° (Horizontal XY)';

  if (ori === 45) {
    orientationLabel = '45° (Diagonal)';
    baseYsDelta = -0.025;
    baseElDelta = 0.04; // Slip-plane shear activation
  } else if (ori === 90) {
    orientationLabel = '90° (Vertical Z)';
    // Vertical Z pulls parallel to <001> columnar grains (slightly lower YS) & normal to interlayer planes
    baseYsDelta = -0.045;
    baseElDelta = lofIndex > 0.95 ? -0.14 : 0.06; // Clean Z builds exhibit higher ductility; LOF hurts Z severely
  }

  const effScale = hipAttenuation * rotationTextureFactor;
  const ysFactor = Number((1.0 + baseYsDelta * effScale).toFixed(4));
  const utsFactor = Number((1.0 + baseYsDelta * 0.85 * effScale).toFixed(4));
  const elongationFactor = Number(
    Math.max(0.55, 1.0 + baseElDelta * (ori === 90 && lofIndex > 0.95 ? 1.0 : effScale)).toFixed(4)
  );

  return {
    buildOrientationDeg: ori,
    scanRotationDeg: rot,
    orientationLabel,
    ysFactor,
    utsFactor,
    elongationFactor,
    residualStressFactor,
    hipAttenuation,
    rotationTextureFactor
  };
}

/**
 * Full unified Ti-6Al-4V Hall-Petch + Oxygen + Anisotropy evaluation.
 */
export function evaluateTi64Metallurgy(input: Ti64MetallurgyInput): Ti64MetallurgyResult {
  const post = normalizePostProcessing(input.postProcessing);
  const oxygen = computeOxygenAndReuseEffects({
    alloyId: input.alloyId,
    processId: input.processId,
    oxygenWtPct: input.oxygenWtPct,
    powderReuseCycles: input.powderReuseCycles,
    autoCoupleReuse: input.autoCoupleReuse
  });

  const lath = computeAlphaLathKinetics(
    input.coolingRateKs,
    post,
    oxygen.effectiveOxygenWtPct
  );

  const anisotropy = computeOrientationAnisotropy(
    input.buildOrientationDeg,
    input.scanRotationDeg,
    post,
    input.lofIndex ?? 0.7
  );

  // Hall-Petch coefficient for Ti-6Al-4V alpha/alpha' lath boundaries: k_HP = 220 MPa * um^(1/2)
  const K_HP_MPA_UM05 = 220.0;
  const hallPetchIncrementMpa = Number((K_HP_MPA_UM05 * lath.invSqrtLathUm).toFixed(1));

  const rawIsoYs = oxygen.sigma0Mpa + hallPetchIncrementMpa + lath.precipitationBoostMpa;
  const hallPetchYieldStrengthMpa = Math.round(rawIsoYs * anisotropy.ysFactor);

  // Condition-dependent UTS/YS strain hardening & Tabor conversion factor
  const utsToYsRatio =
    post === 'None' ? 1.07 :
    post === 'Stress-relieved' ? 1.08 :
    post === 'Annealed' ? 1.09 :
    post === 'HIP' ? 1.09 : 1.07;

  const taborFactor =
    post === 'None' ? 3.02 :
    post === 'Stress-relieved' ? 3.00 :
    post === 'Annealed' ? 2.98 :
    post === 'HIP' ? 2.95 : 3.05;

  const predictedUtsMpa = Math.round(hallPetchYieldStrengthMpa * utsToYsRatio * (anisotropy.utsFactor / Math.max(0.5, anisotropy.ysFactor)));
  const predictedHv = Math.round(predictedUtsMpa / taborFactor);

  // Fracture toughness K_IC scales with coarsened lath ductility and inverse oxygen embrittlement
  const baseKic =
    post === 'HIP' ? 76.0 :
    post === 'Annealed' ? 68.0 :
    post === 'Stress-relieved' ? 54.0 :
    post === 'Bi-modal' ? 72.0 :
    post === 'Solution-Aged' ? 58.0 : 42.0;
  const lathToughnessBoost = Math.min(1.18, 0.90 + 0.08 * Math.sqrt(lath.alphaLathWidthUm));
  const densityPenalty = Number.isFinite(input.densityPct)
    ? Math.max(0.55, 1.0 - 0.14 * Math.max(0, 99.8 - Number(input.densityPct)))
    : 1.0;
  const predictedKicMpaM05 = Number(
    (baseKic * lathToughnessBoost * oxygen.kicMultiplier * densityPenalty).toFixed(1)
  );

  return {
    oxygen,
    lath,
    anisotropy,
    hallPetchIncrementMpa,
    hallPetchYieldStrengthMpa,
    predictedUtsMpa,
    predictedHv,
    taborFactor,
    utsToYsRatio,
    predictedKicMpaM05
  };
}
