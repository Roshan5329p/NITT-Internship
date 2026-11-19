/**
 * NIT Trichy Titanium AM Platform — Synthetic Stress-Strain & Murakami S-N Fatigue Curves
 * Generates physically coupled Ti-6Al-4V constitutive stress-strain curves (Engineering & True)
 * and 10^4–10^8 cycle Murakami sqrt(area) Wöhler fatigue S-N curves from live metallurgy & defects.
 */

export type DefectCategory = 'none' | 'gas_pore' | 'keyhole_pore' | 'lof';

export interface DefectProfile {
  defectType: DefectCategory;
  maxDefectSizeUm: number;
  sqrtAreaUm: number;
  shapeFactor: number;
  label: string;
}

export interface StressStrainInput {
  yieldStrengthMpa: number;
  utsMpa: number;
  elongationPct: number;
  youngsModulusGpa?: number;
}

export interface StressStrainPoint {
  engStrainPct: number;
  engStressMpa: number;
  trueStrainPct: number;
  trueStressMpa: number;
}

export interface StressStrainCurveResult {
  points: StressStrainPoint[];
  yieldStrengthMpa: number;
  utsMpa: number;
  elongationPct: number;
  strainHardeningN: number;
  youngsModulusGpa: number;
}

export interface MurakamiFatigueInput {
  hv: number;
  utsMpa: number;
  surfaceResidualStressMpa: number;
  defectType: DefectCategory;
  maxDefectSizeUm: number;
  isSurfaceDefect?: boolean;
}

export interface SnCurvePoint {
  cycles: number;
  logCycles: number;
  stressAmplitudeMpa: number;
}

export interface MurakamiFatigueResult {
  points: SnCurvePoint[];
  murakamiLimitRawMpa: number;
  enduranceLimitMpa: number;
  sqrtAreaUm: number;
  stressAt1e4Mpa: number;
  basquinSlopeB: number;
  defectProfile: DefectProfile;
}

function clampFinite(val: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

/**
 * Infers dominant Ti-6Al-4V internal/subsurface defect class and characteristic max defect diameter
 * from process regime indices (LOF index, Keyhole ratio), relative density, and post-processing (HIP).
 */
export function inferActiveDefectProfile(params: {
  postProcessing: string;
  densityPct: number;
  lofIndex: number;
  keyholeRatio: number;
  defectTypeOverride?: DefectCategory;
  maxDefectSizeUmOverride?: number;
}): DefectProfile {
  const post = (params.postProcessing || 'HIP').toLowerCase().trim();
  const isHip = post === 'hip';
  const density = clampFinite(params.densityPct, 85, 99.99, 99.85);
  const lof = clampFinite(params.lofIndex, 0.1, 5.0, 0.72);
  const kh = clampFinite(params.keyholeRatio, 0.1, 5.0, 0.36);

  let defectType: DefectCategory = params.defectTypeOverride || 'none';
  if (!params.defectTypeOverride) {
    if (lof > 1.0) {
      defectType = 'lof';
    } else if (kh > 1.0) {
      defectType = 'keyhole_pore';
    } else if (!isHip && density < 99.90) {
      defectType = 'gas_pore';
    } else {
      defectType = 'none';
    }
  }

  let baseDiameterUm = 14.0;
  if (defectType === 'lof') {
    baseDiameterUm = 78.0 + Math.min(180.0, Math.max(0, lof - 1.0) * 145.0 + (100 - density) * 18.0);
  } else if (defectType === 'keyhole_pore') {
    baseDiameterUm = 42.0 + Math.min(110.0, Math.max(0, kh - 1.0) * 85.0 + (100 - density) * 12.0);
  } else if (defectType === 'gas_pore') {
    baseDiameterUm = 22.0 + Math.min(35.0, Math.max(0, 99.9 - density) * 28.0);
  } else {
    baseDiameterUm = isHip ? 12.0 : 20.0;
  }

  // HIP collapses internal voids via creep consolidation (~0.28x residual micro-void floor)
  const hipReduction = isHip ? (defectType === 'lof' ? 0.38 : 0.60) : 1.0;
  const maxDefectSizeUm = Number(
    clampFinite(
      params.maxDefectSizeUmOverride !== undefined ? params.maxDefectSizeUmOverride : baseDiameterUm * hipReduction,
      8.0,
      350.0,
      16.0
    ).toFixed(1)
  );

  // Shape concentration severity: irregular sharp LOF cracks carry larger effective sqrt(area) than spherical pores
  const shapeFactor =
    defectType === 'lof' ? 1.48 :
    defectType === 'keyhole_pore' ? 1.18 :
    defectType === 'gas_pore' ? 1.00 : 0.92;

  const sqrtAreaUm = Number((shapeFactor * (Math.sqrt(Math.PI) / 2.0) * maxDefectSizeUm).toFixed(1));
  const label =
    defectType === 'lof' ? 'Sharp Lack-of-Fusion Flaw' :
    defectType === 'keyhole_pore' ? 'Keyhole Vapor Pore' :
    defectType === 'gas_pore' ? 'Entrapped Argon Micro-Pore' :
    (isHip ? 'HIP-Consolidated Matrix Floor' : 'Near-Dense Conduction Matrix');

  return { defectType, maxDefectSizeUm, sqrtAreaUm, shapeFactor, label };
}

/**
 * Synthesizes smooth C1-continuous Engineering & True Stress-Strain curves for Ti-6Al-4V
 * using elastic linear + Hollomon plastic hardening + ductile/brittle post-UTS necking roll-off.
 */
export function generateStressStrainCurve(input: StressStrainInput): StressStrainCurveResult {
  const ys = clampFinite(input.yieldStrengthMpa, 300, 1600, 890);
  const uts = Math.max(ys + 20, clampFinite(input.utsMpa, 350, 1750, 985));
  const elongPct = clampFinite(input.elongationPct, 1.2, 26.0, 14.5);
  const E_GPa = clampFinite(input.youngsModulusGpa ?? 113.8, 80, 130, 113.8);
  const E_MPa = E_GPa * 1000.0;

  const epsFracture = elongPct / 100.0;
  // Brittle alpha' martensite necks almost immediately past peak load; ductile HIP alpha+beta exhibits ~60% uniform strain
  const uniformFraction = elongPct >= 10.0 ? 0.62 : 0.72;
  const epsUniform = Math.max(ys / E_MPa + 0.004, epsFracture * uniformFraction);
  const epsPlasticYield = 0.002;
  const epsYieldTotal = ys / E_MPa + epsPlasticYield;

  const trueUts = uts * (1.0 + epsUniform);
  const trueEpsPlasticU = Math.max(0.004, Math.log(1.0 + epsUniform) - trueUts / E_MPa);
  const rawN = Math.log(Math.max(1.01, trueUts / ys)) / Math.log(Math.max(1.5, trueEpsPlasticU / epsPlasticYield));
  const strainHardeningN = Number(clampFinite(rawN, 0.025, 0.22, 0.075).toFixed(4));
  const K = trueUts / Math.pow(Math.max(1e-4, trueEpsPlasticU), strainHardeningN);

  const points: StressStrainPoint[] = [{ engStrainPct: 0, engStressMpa: 0, trueStrainPct: 0, trueStressMpa: 0 }];

  // 1. Linear elastic ramp up to 0.90 * YS
  const propStress = ys * 0.88;
  const propStrain = propStress / E_MPa;
  for (let i = 1; i <= 6; i++) {
    const frac = i / 6;
    const e = propStrain * frac;
    const s = propStress * frac;
    points.push({
      engStrainPct: Number((e * 100).toFixed(3)),
      engStressMpa: Number(s.toFixed(1)),
      trueStrainPct: Number((Math.log(1 + e) * 100).toFixed(3)),
      trueStressMpa: Number((s * (1 + e)).toFixed(1))
    });
  }

  // 2. Smooth plastic hardening + post-UTS necking up to fracture strain
  const totalSteps = 44;
  const strainSpan = Math.max(0.004, epsFracture - propStrain);
  for (let i = 1; i <= totalSteps; i++) {
    const t = i / totalSteps;
    const engEps = propStrain + t * strainSpan;
    let engStress: number;
    let trueStress: number;
    const trueEps = Math.log(1.0 + engEps);

    if (engEps <= epsYieldTotal) {
      // Smooth Hermite blend between proportional limit and 0.2% offset yield point
      const u = clampFinite((engEps - propStrain) / Math.max(1e-6, epsYieldTotal - propStrain), 0, 1, 1);
      const smooth = u * u * (3 - 2 * u);
      engStress = propStress + smooth * (ys - propStress);
      trueStress = engStress * (1.0 + engEps);
    } else if (engEps <= epsUniform) {
      const epsP = Math.max(epsPlasticYield, trueEps - ys / E_MPa);
      const hollomonTrue = Math.min(trueUts, K * Math.pow(epsP, strainHardeningN));
      const u = clampFinite((engEps - epsYieldTotal) / Math.max(1e-6, epsUniform - epsYieldTotal), 0, 1, 1);
      // Guarantee smooth arrival exactly at UTS at epsUniform
      const rawEng = hollomonTrue / (1.0 + engEps);
      engStress = ys + Math.pow(u, 0.72) * (uts - ys);
      trueStress = Math.max(engStress * (1 + engEps), rawEng * (1 + engEps));
    } else {
      // Necking drop on engineering curve; Bridgman-corrected true flow stress rises gently to fracture
      const u = clampFinite((engEps - epsUniform) / Math.max(1e-6, epsFracture - epsUniform), 0, 1, 1);
      const neckDrop = elongPct >= 10.0 ? 0.14 : 0.06;
      engStress = uts * (1.0 - neckDrop * Math.pow(u, 1.65));
      trueStress = trueUts * (1.0 + 0.09 * Math.pow(u, 0.85));
    }

    points.push({
      engStrainPct: Number((engEps * 100).toFixed(3)),
      engStressMpa: Number(clampFinite(engStress, 0, 2200, ys).toFixed(1)),
      trueStrainPct: Number((trueEps * 100).toFixed(3)),
      trueStressMpa: Number(clampFinite(trueStress, 0, 2500, uts).toFixed(1))
    });
  }

  return {
    points,
    yieldStrengthMpa: Math.round(ys),
    utsMpa: Math.round(uts),
    elongationPct: Number(elongPct.toFixed(1)),
    strainHardeningN,
    youngsModulusGpa: E_GPa
  };
}

/**
 * Computes 10^4 - 10^8 cycle Murakami sqrt(area) Wöhler S-N fatigue curve
 * coupled with 3D Twin surface residual tensile stress (Goodman correction).
 */
export function computeMurakamiSnFatigueCurve(input: MurakamiFatigueInput): MurakamiFatigueResult {
  const hv = clampFinite(input.hv, 200, 600, 340);
  const uts = clampFinite(input.utsMpa, 400, 1750, 990);
  const resStress = clampFinite(input.surfaceResidualStressMpa, -400, 800, 35);
  const profile = inferActiveDefectProfile({
    postProcessing: 'None',
    densityPct: 99.8,
    lofIndex: 0.7,
    keyholeRatio: 0.4,
    defectTypeOverride: input.defectType,
    maxDefectSizeUmOverride: input.maxDefectSizeUm
  });

  // Murakami (2002) endurance equation: sigma_w = C * (HV + 120) / (sqrt(area))^(1/6)
  // C = 1.43 for surface/subsurface critical defects, 1.56 for interior defects
  const cLoc = input.isSurfaceDefect === false ? 1.56 : 1.43;
  const sqrtAreaClamped = Math.max(8.0, profile.sqrtAreaUm);
  const murakamiRaw = (cLoc * (hv + 120.0)) / Math.pow(sqrtAreaClamped, 1.0 / 6.0);

  // Goodman tensile residual stress penalty (compressive residual stress gives slight positive benefit)
  const goodmanFactor = clampFinite(1.0 - resStress / (2.15 * uts), 0.42, 1.08, 1.0);
  const enduranceLimitMpa = Number(clampFinite(murakamiRaw * goodmanFactor, 120, uts * 0.72, 400).toFixed(1));

  // Basquin finite-life regime between N=10^4 (0.86 * UTS) and N=10^7 (enduranceLimitMpa)
  const stressAt1e4Mpa = Number(Math.max(enduranceLimitMpa + 40, uts * 0.86).toFixed(1));
  const basquinSlopeB = Number(
    clampFinite(Math.log10(stressAt1e4Mpa / enduranceLimitMpa) / 3.0, 0.02, 0.28, 0.10).toFixed(4)
  );

  const points: SnCurvePoint[] = [];
  const logSteps = 32;
  for (let i = 0; i <= logSteps; i++) {
    const logCycles = 4.0 + (i / logSteps) * 4.0; // 10^4 -> 10^8
    const cycles = Math.pow(10, logCycles);
    let stressAmp: number;
    if (logCycles <= 7.0) {
      stressAmp = stressAt1e4Mpa * Math.pow(cycles / 1e4, -basquinSlopeB);
    } else {
      // Flat asymptotic endurance plateau past knee at 10^7 cycles (very mild 1% gigacycle slope)
      stressAmp = enduranceLimitMpa * Math.pow(cycles / 1e7, -0.008);
    }
    points.push({
      cycles: Math.round(cycles),
      logCycles: Number(logCycles.toFixed(3)),
      stressAmplitudeMpa: Number(clampFinite(stressAmp, 80, 1800, enduranceLimitMpa).toFixed(1))
    });
  }

  return {
    points,
    murakamiLimitRawMpa: Number(murakamiRaw.toFixed(1)),
    enduranceLimitMpa,
    sqrtAreaUm: profile.sqrtAreaUm,
    stressAt1e4Mpa,
    basquinSlopeB,
    defectProfile: profile
  };
}
