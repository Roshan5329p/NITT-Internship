/**
 * NIT Trichy Titanium AM Platform — Goal-Seeking Inverse Ti-6Al-4V Process Designer
 * Runs a fast constrained multi-objective Pareto sweep over (P, v, h, t, T0, Post-Processing)
 * using the calibrated Ti-6Al-4V Rosenthal thermal, Hall-Petch, ASTM stress, and 6x6 OOD engines.
 */

import { evaluateOodRisk } from './ood-detector';
import { evaluateTi64Pinn, computePinnProcessGradients } from './ti64-pinn';
import {
  computeOxygenAndReuseEffects,
  evaluateTi64Metallurgy,
  type BuildOrientationDeg,
  type ScanRotationDeg,
  type Ti64AlloyGrade
} from './ti64-metallurgy';

export type InverseProcessScope = 'all' | 'lpbf' | 'ded-laser' | 'waam';
export type InverseAstmTarget = 'F2924' | 'F3001';

export interface InverseTargetConstraints {
  minYsMpa: number;
  minElongPct: number;
  maxResidualStressMpa: number;
  minBuildRateCm3H: number;
  alloyId: Ti64AlloyGrade;
  astmStandard: InverseAstmTarget;
  processScope?: InverseProcessScope;
  oxygenWtPct?: number;
  buildOrientationDeg?: BuildOrientationDeg;
  scanRotationDeg?: ScanRotationDeg;
  maxCandidatesToReturn?: number;
}

export interface EvaluatedRecipeCandidate {
  rank: number;
  tag: string;
  processId: 'lpbf' | 'ded-laser' | 'waam';
  processDisplayName: string;
  P: number;
  v: number;
  h: number;
  t: number;
  db: number;
  T0: number;
  postProcessing: 'None' | 'Stress-relieved' | 'Annealed' | 'HIP' | 'Solution-Aged';
  ved: number;
  heatInputJmm: number;
  buildRateCm3H: number;
  predictedHv: number;
  yieldStrengthMpa: number;
  utsMpa: number;
  elongationPct: number;
  densityPct: number;
  residualStressMpa: number;
  coolingRateKs: number;
  alphaLathWidthUm: number;
  mahalanobisDistance: number;
  regimeName: string;
  astmCompliant: boolean;
  paretoScore: number;
  pinnYieldStrengthMpa?: number;
  pinnHallPetchResidualMpa?: number;
  gradientRefined?: boolean;
}

export interface InverseSolverResult {
  feasibleCount: number;
  evaluatedCount: number;
  elapsedMs: number;
  candidates: EvaluatedRecipeCandidate[];
  failureReason: string | null;
}

function clampFinite(val: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(val) ? Math.max(min, Math.min(max, val)) : fallback;
}

export function evaluateForwardTi64Candidate(params: {
  processId: 'lpbf' | 'ded-laser' | 'waam';
  alloyId: Ti64AlloyGrade;
  P: number;
  v: number;
  h: number;
  t: number;
  db: number;
  T0: number;
  postProcessing: 'None' | 'Stress-relieved' | 'Annealed' | 'HIP' | 'Solution-Aged';
  oxygenWtPct: number;
  buildOrientationDeg: BuildOrientationDeg;
  scanRotationDeg: ScanRotationDeg;
}): Omit<EvaluatedRecipeCandidate, 'rank' | 'tag' | 'paretoScore'> {
  const { processId, alloyId, P, v, h, t, db, T0, postProcessing, oxygenWtPct, buildOrientationDeg, scanRotationDeg } = params;
  const isWaam = processId === 'waam';
  const isDed = processId === 'ded-laser';
  const processDisplayName = isWaam ? 'WAAM' : (isDed ? 'L-DED' : 'LPBF');

  const density = 4430;
  const specificHeat = 670;
  const k = 21.9;
  const thermalDiffusivity = k / (density * specificHeat);
  const liquidusC = 1660;
  const eta = isWaam ? 0.78 : (isDed ? 0.38 : 0.42);
  const deltaT = Math.max(50, liquidusC - T0);

  const ved = (P * 1e6) / Math.max(1, v * h * t);
  const heatInputJmm = P / Math.max(0.5, v);
  const vMs = Math.max(0.001, v / 1000.0);
  const effectivePower = P * eta;

  const spotCm = Math.max(1e-3, db * 1e-4);
  const intensityWcm2 = effectivePower / (Math.PI * Math.pow(spotCm * 0.5, 2));
  const widthEst = Math.sqrt((8 * effectivePower) / (Math.PI * Math.E * density * specificHeat * deltaT * vMs));
  const meltPoolWidth = Math.round(Math.max(db * 0.5, widthEst * 1e6 * 0.75 + db * 0.4));

  let meltPoolDepth: number;
  if (isWaam) {
    const arWaam = Math.min(0.55, 0.28 + 0.00045 * heatInputJmm);
    meltPoolDepth = Math.round(Math.max(t * 0.35, meltPoolWidth * arWaam));
  } else if (isDed) {
    const baseArDed = Math.min(0.65, 0.26 + 0.0012 * heatInputJmm);
    const arDed = intensityWcm2 > 1.5e5
      ? Math.min(1.6, baseArDed + 0.35 * ((intensityWcm2 - 1.5e5) / 1.5e5))
      : baseArDed;
    meltPoolDepth = Math.round(Math.max(t * 0.30, meltPoolWidth * arDed));
  } else {
    meltPoolDepth = Math.round(Math.max(t * 0.2, meltPoolWidth * 0.52 * Math.pow(Math.max(0.05, ved / 70.0), 0.25)));
  }

  let meltPoolLength: number;
  if (isWaam || isDed) {
    const peclet = (vMs * meltPoolWidth * 1e-6) / (2.0 * Math.max(1e-8, thermalDiffusivity));
    meltPoolLength = Math.round(meltPoolWidth * Math.min(2.8, 1.15 + 0.25 * peclet));
  } else {
    meltPoolLength = Math.round(meltPoolWidth * (1.2 + 0.0012 * v));
  }

  const accumFactor = isWaam ? 0.45 : (isDed ? 0.15 : 0.0);
  const rawCooling = (2 * Math.PI * k * vMs * Math.pow(deltaT, 2)) / Math.max(5, effectivePower);
  const coolingRateKs = isWaam || isDed
    ? Math.max(1.0, rawCooling * (1.0 - accumFactor))
    : Math.max(10, rawCooling);

  const penetrationRatio = meltPoolDepth / Math.max(1, t);
  const mHole = Math.PI * density * specificHeat * deltaT * Math.sqrt(thermalDiffusivity * vMs * Math.pow(db * 1e-6, 3));
  const normalizedEnthalpy = isWaam
    ? 0
    : (isDed ? (intensityWcm2 > 1.5e5 ? (effectivePower / Math.max(1e-6, mHole)) * 0.45 : 0) : (effectivePower / Math.max(1e-6, mHole)) * 0.5863);

  let lofIndex: number;
  let keyholeRatio: number;
  if (isWaam) {
    lofIndex = Math.max(0.25, 120.0 / Math.max(1.0, heatInputJmm));
    keyholeRatio = heatInputJmm / 600.0;
  } else if (isDed) {
    lofIndex = Math.max(1.25 / Math.max(0.1, penetrationRatio), 75.0 / Math.max(1.0, heatInputJmm));
    keyholeRatio = intensityWcm2 > 1.5e5
      ? Math.max(heatInputJmm / 240.0, normalizedEnthalpy / 26.0)
      : heatInputJmm / 240.0;
  } else {
    lofIndex = 1.35 / Math.max(0.1, penetrationRatio);
    keyholeRatio = (normalizedEnthalpy / 8.5) * 0.53;
  }

  const ballingRatio = meltPoolLength / Math.max(1e-6, meltPoolWidth * Math.PI);
  let densityPct = 99.85 - (lofIndex > 1 ? (lofIndex - 1) * 8.5 : 0) - (keyholeRatio > 1 ? (keyholeRatio - 1) * 4.2 : 0) - (ballingRatio > 1 ? (ballingRatio - 1) * 6.0 : 0);
  if (postProcessing === 'HIP') densityPct = Math.min(99.98, densityPct + 0.5);
  densityPct = Number(Math.max(88.0, Math.min(99.98, densityPct)).toFixed(2));

  const met = evaluateTi64Metallurgy({
    alloyId,
    processId,
    coolingRateKs,
    postProcessing,
    oxygenWtPct,
    buildOrientationDeg,
    scanRotationDeg,
    lofIndex,
    densityPct
  });

  const refVed = isWaam ? 57.0 : (isDed ? 198.0 : 72.0);
  const hvAnalytical = met.predictedHv;
  const hvRf = Math.round(hvAnalytical * (1.0 + 0.010 * Math.log10(Math.max(1.0, coolingRateKs) / 1e4)));
  const hvXgb = Math.round(hvAnalytical * (1.0 + 0.008 * Math.log10(Math.max(1.0, coolingRateKs) / 1e4)));
  const hvSvm = Math.round(hvAnalytical * (1.012 - 0.005 * Math.abs(ved - refVed) / Math.max(25, refVed * 0.5)));
  const hvGpr = Math.round(hvAnalytical * (1.008 - 0.004 * Math.abs(ved - refVed) / Math.max(25, refVed * 0.5)));
  const predictedHv = Math.round((hvAnalytical + hvRf + hvXgb + hvSvm + hvGpr) / 5);

  const utsMpa = Math.round(predictedHv * met.taborFactor);
  const yieldStrengthMpa = Math.round(utsMpa / met.utsToYsRatio);

  const asBuiltEl = isWaam ? 12.8 : (isDed ? 11.2 : 7.5);
  const srEl = isWaam ? 14.0 : (isDed ? 12.2 : 9.8);
  const baseElong = postProcessing === 'HIP' ? 16.2 : (postProcessing === 'Annealed' ? 13.0 : (postProcessing === 'Stress-relieved' ? srEl : (postProcessing === 'Solution-Aged' ? 14.5 : asBuiltEl)));
  const poreKnock = Math.exp(-0.45 * Math.max(0, 100 - densityPct));
  const lofPen = lofIndex > 1.0 ? Math.max(0.15, 1.0 - (lofIndex - 1.0) * 1.4) : 1.0;
  const khPen = keyholeRatio > 1.0 ? Math.max(0.4, 1.0 - (keyholeRatio - 1.0) * 0.5) : 1.0;
  const elongationPct = Number(Math.max(1.0, Math.min(22.0, baseElong * poreKnock * lofPen * khPen * met.oxygen.ductilityMultiplier * met.anisotropy.elongationFactor)).toFixed(1));

  const thermalScaling = Math.pow(Math.max(1e4, coolingRateKs) / 480000, 0.08);
  let residualStressMpa = 1085;
  if (postProcessing === 'HIP') {
    residualStressMpa = Math.max(10, Math.round(12 + yieldStrengthMpa * 0.003));
  } else if (postProcessing === 'Annealed') {
    residualStressMpa = Math.max(20, Math.round(20 + yieldStrengthMpa * 0.010));
  } else if (postProcessing === 'Stress-relieved') {
    residualStressMpa = Math.max(35, Math.round((35 + yieldStrengthMpa * 0.012) * thermalScaling));
  } else if (postProcessing === 'Solution-Aged') {
    residualStressMpa = Math.max(30, Math.round(35 + yieldStrengthMpa * 0.006));
  } else {
    residualStressMpa = Math.round(yieldStrengthMpa * (isWaam ? 0.72 : (isDed ? 0.82 : 1.06)) * thermalScaling);
  }

  const buildRateCm3H = Number(((v * h * t * 3600) / 1e9).toFixed(1));
  const ood = evaluateOodRisk({ P, v, h, t, T0, ved: Number(ved.toFixed(1)) }, processId);
  const regimeName = isWaam
    ? (heatInputJmm < 120 ? 'Lack of Fusion' : (heatInputJmm > 600 ? 'Overheating' : 'Optimal Arc'))
    : (isDed
      ? (heatInputJmm < 75 ? 'Lack of Fusion' : (heatInputJmm > 240 ? 'Over-Dilution' : 'Conduction-Dilution'))
      : (lofIndex > 1.05 ? 'Lack of Fusion' : (keyholeRatio > 1.05 ? 'Keyhole' : 'Conduction Mode')));

  const astmCompliant = yieldStrengthMpa >= (alloyId === 'ti64_eli' ? 795 : 825)
    && utsMpa >= (alloyId === 'ti64_eli' ? 860 : 895)
    && elongationPct >= 10.0
    && densityPct >= (alloyId === 'ti64_eli' ? 99.7 : 99.5)
    && residualStressMpa <= (alloyId === 'ti64_eli' ? 50 : 60)
    && met.oxygen.activeAlloyOxygenPass;

  return {
    processId,
    processDisplayName,
    P, v, h, t, db, T0,
    postProcessing,
    ved: Number(ved.toFixed(1)),
    heatInputJmm: Number(heatInputJmm.toFixed(0)),
    buildRateCm3H,
    predictedHv,
    yieldStrengthMpa,
    utsMpa,
    elongationPct,
    densityPct,
    residualStressMpa,
    coolingRateKs: Math.round(coolingRateKs),
    alphaLathWidthUm: met.lath.alphaLathWidthUm,
    mahalanobisDistance: ood.mahalanobisDistance,
    regimeName,
    astmCompliant
  };
}

/**
 * Solves for top 3-5 Pareto-optimal Ti-6Al-4V AM recipes meeting all mechanical,
 * residual stress, build rate, and ASTM qualification constraints.
 */
export function solveInverseTi64Recipes(rawConstraints: InverseTargetConstraints): InverseSolverResult {
  const tStart = Date.now();
  const minYsMpa = clampFinite(rawConstraints.minYsMpa, 400, 1400, 850);
  const minElongPct = clampFinite(rawConstraints.minElongPct, 2, 22, 12.0);
  const maxResidualStressMpa = clampFinite(rawConstraints.maxResidualStressMpa, 10, 1200, 60);
  const minBuildRateCm3H = clampFinite(rawConstraints.minBuildRateCm3H, 0.5, 1000, 20.0);
  const alloyId: Ti64AlloyGrade = rawConstraints.alloyId === 'ti64_eli' ? 'ti64_eli' : 'ti64_gr5';
  const astmStd: InverseAstmTarget = rawConstraints.astmStandard === 'F3001' ? 'F3001' : 'F2924';
  const scope: InverseProcessScope = rawConstraints.processScope || 'all';
  const oxygenWtPct = rawConstraints.oxygenWtPct ?? (alloyId === 'ti64_eli' ? 0.11 : 0.16);
  const buildOrientationDeg: BuildOrientationDeg = rawConstraints.buildOrientationDeg ?? 0;
  const scanRotationDeg: ScanRotationDeg = rawConstraints.scanRotationDeg ?? 67;
  const maxReturn = Math.max(3, Math.min(5, rawConstraints.maxCandidatesToReturn ?? 5));

  // Verify oxygen limit first against ASTM standard
  const o2Check = computeOxygenAndReuseEffects({ alloyId, oxygenWtPct });
  if ((astmStd === 'F3001' && !o2Check.astmF3001OxygenPass) || (alloyId === 'ti64_gr5' && !o2Check.astmF2924OxygenPass)) {
    return {
      feasibleCount: 0,
      evaluatedCount: 0,
      elapsedMs: Date.now() - tStart,
      candidates: [],
      failureReason: o2Check.chemistryAlert || 'Interstitial oxygen exceeds active ASTM limit.'
    };
  }

  const rawGrid: Array<{
    processId: 'lpbf' | 'ded-laser' | 'waam';
    P: number; v: number; h: number; t: number; db: number; T0: number;
    postProcessing: 'None' | 'Stress-relieved' | 'Annealed' | 'HIP' | 'Solution-Aged';
  }> = [];

  const postModes: Array<'None' | 'Stress-relieved' | 'Annealed' | 'HIP' | 'Solution-Aged'> = ['HIP', 'Annealed', 'Stress-relieved', 'Solution-Aged', 'None'];

  if (scope === 'all' || scope === 'lpbf') {
    const lpbfSamples = [
      { P: 260, v: 980,  h: 110, t: 40, db: 80, T0: 200 },
      { P: 280, v: 960,  h: 110, t: 40, db: 80, T0: 200 },
      { P: 310, v: 1150, h: 110, t: 45, db: 85, T0: 200 },
      { P: 330, v: 1220, h: 115, t: 45, db: 85, T0: 225 },
      { P: 350, v: 1280, h: 115, t: 50, db: 90, T0: 200 },
      { P: 365, v: 1320, h: 120, t: 50, db: 90, T0: 250 },
      { P: 380, v: 1380, h: 120, t: 50, db: 95, T0: 225 },
      { P: 395, v: 1450, h: 125, t: 55, db: 95, T0: 200 }
    ];
    for (const s of lpbfSamples) {
      for (const post of postModes) rawGrid.push({ processId: 'lpbf', ...s, postProcessing: post });
    }
  }

  if (scope === 'all' || scope === 'ded-laser') {
    const dedSamples = [
      { P: 1200, v: 12, h: 1000, t: 350, db: 1200, T0: 100 },
      { P: 1500, v: 15, h: 1100, t: 400, db: 1400, T0: 100 },
      { P: 1600, v: 15, h: 1200, t: 450, db: 1500, T0: 120 },
      { P: 1900, v: 18, h: 1250, t: 500, db: 1600, T0: 150 },
      { P: 2200, v: 20, h: 1350, t: 550, db: 1800, T0: 100 }
    ];
    for (const s of dedSamples) {
      for (const post of postModes) rawGrid.push({ processId: 'ded-laser', ...s, postProcessing: post });
    }
  }

  if (scope === 'all' || scope === 'waam') {
    const waamSamples = [
      { P: 1800, v: 7,  h: 3200, t: 1300, db: 2600, T0: 120 },
      { P: 2200, v: 8,  h: 3400, t: 1400, db: 2800, T0: 120 },
      { P: 2400, v: 8,  h: 3500, t: 1500, db: 3000, T0: 120 },
      { P: 2800, v: 10, h: 3600, t: 1500, db: 3200, T0: 150 }
    ];
    for (const s of waamSamples) {
      for (const post of postModes) rawGrid.push({ processId: 'waam', ...s, postProcessing: post });
    }
  }

  const feasible: Array<Omit<EvaluatedRecipeCandidate, 'rank' | 'tag' | 'paretoScore'>> = [];
  for (const cand of rawGrid) {
    const ev = evaluateForwardTi64Candidate({
      ...cand,
      alloyId,
      oxygenWtPct,
      buildOrientationDeg,
      scanRotationDeg
    });
    const astmMinYs = astmStd === 'F3001' ? 795 : 825;
    if (
      ev.yieldStrengthMpa >= Math.max(minYsMpa, astmMinYs) &&
      ev.elongationPct >= minElongPct &&
      ev.residualStressMpa <= maxResidualStressMpa &&
      ev.buildRateCm3H >= minBuildRateCm3H &&
      ev.densityPct >= 99.4 &&
      ev.mahalanobisDistance <= 3.5
    ) {
      feasible.push(ev);
    }
  }

  if (feasible.length === 0) {
    return {
      feasibleCount: 0,
      evaluatedCount: rawGrid.length,
      elapsedMs: Date.now() - tStart,
      candidates: [],
      failureReason: `No parameter combination satisfied YS ≥ ${minYsMpa} MPa, Elong ≥ ${minElongPct}%, Stress ≤ ${maxResidualStressMpa} MPa, and Build Rate ≥ ${minBuildRateCm3H} cm³/h simultaneously.`
    };
  }

  // Filter non-dominated Pareto front (maximize YS, Elong, BuildRate; minimize Stress, OOD dM)
  const paretoFront = feasible.filter((a) =>
    !feasible.some((b) =>
      b !== a &&
      b.yieldStrengthMpa >= a.yieldStrengthMpa &&
      b.elongationPct >= a.elongationPct &&
      b.buildRateCm3H >= a.buildRateCm3H &&
      b.residualStressMpa <= a.residualStressMpa &&
      b.mahalanobisDistance <= a.mahalanobisDistance &&
      (
        b.yieldStrengthMpa > a.yieldStrengthMpa ||
        b.elongationPct > a.elongationPct ||
        b.buildRateCm3H > a.buildRateCm3H ||
        b.residualStressMpa < a.residualStressMpa ||
        b.mahalanobisDistance < a.mahalanobisDistance
      )
    )
  );

  const pool = paretoFront.length >= 3 ? paretoFront : feasible;

  // Score and select up to maxReturn diverse candidates covering distinct optimization priorities
  const ysMax = Math.max(...pool.map(x => x.yieldStrengthMpa));
  const rateMax = Math.max(...pool.map(x => x.buildRateCm3H));
  const elMax = Math.max(...pool.map(x => x.elongationPct));

  const scored = pool.map((c) => {
    const score =
      0.32 * (c.yieldStrengthMpa / Math.max(1, ysMax)) +
      0.26 * (c.buildRateCm3H / Math.max(1, rateMax)) +
      0.24 * (c.elongationPct / Math.max(1, elMax)) +
      0.18 * (1.0 - Math.min(1.0, c.residualStressMpa / Math.max(20, maxResidualStressMpa)));
    return { ...c, paretoScore: Number((score * 100).toFixed(1)) };
  });

  // Pick diverse specialists first (Highest Balanced Score, Max Build Rate, Max Strength, Lowest Stress, Best LPBF Precision)
  const usedKeys = new Set<string>();
  const keyOf = (x: typeof scored[0]) => `${x.processId}:${x.P}:${x.v}:${x.postProcessing}`;

  const byScore = [...scored].sort((a, b) => b.paretoScore - a.paretoScore);
  const byRate = [...scored].sort((a, b) => b.buildRateCm3H - a.buildRateCm3H);
  const byYs = [...scored].sort((a, b) => b.yieldStrengthMpa - a.yieldStrengthMpa);
  const byStress = [...scored].sort((a, b) => a.residualStressMpa - b.residualStressMpa || a.mahalanobisDistance - b.mahalanobisDistance);
  const byLpbf = scored.filter(x => x.processId === 'lpbf').sort((a, b) => b.paretoScore - a.paretoScore);

  const labeled: Array<EvaluatedRecipeCandidate> = [];
  const polishWithPinn = (c: EvaluatedRecipeCandidate): EvaluatedRecipeCandidate => {
    const basePinn = evaluateTi64Pinn({
      processId: c.processId,
      P: c.P, v: c.v, h: c.h, t: c.t, T0: c.T0, db: c.db,
      postProcessing: c.postProcessing,
      oxygenWtPct,
      densityPct: c.densityPct,
      buildOrientationDeg
    });
    // 6-step projected gradient ascent on (P, v) using PINN derivatives to raise margin on YS/Elongation
    let curP = c.P;
    let curV = c.v;
    const pBounds = c.processId === 'waam' ? [1200, 3200] : (c.processId === 'ded-laser' ? [600, 2600] : [140, 420]);
    const vBounds = c.processId === 'waam' ? [4, 15] : (c.processId === 'ded-laser' ? [8, 25] : [450, 1600]);
    const stepP = c.processId === 'lpbf' ? 2.5 : 15.0;
    const stepV = c.processId === 'lpbf' ? 8.0 : 0.25;

    for (let s = 0; s < 6; s++) {
      const grad = computePinnProcessGradients({
        processId: c.processId,
        P: curP, v: curV, h: c.h, t: c.t, T0: c.T0, db: c.db,
        postProcessing: c.postProcessing,
        oxygenWtPct,
        densityPct: c.densityPct,
        buildOrientationDeg
      });
      const candP = Math.round(clampFinite(curP + Math.sign(grad.dYs_dP) * stepP, pBounds[0], pBounds[1], curP));
      const candV = Number(clampFinite(curV + Math.sign(grad.dElong_dv) * stepV, vBounds[0], vBounds[1], curV).toFixed(1));
      if (candP === curP && candV === curV) break;
      const evCand = evaluateForwardTi64Candidate({
        processId: c.processId,
        alloyId,
        P: candP, v: candV, h: c.h, t: c.t, db: c.db, T0: c.T0,
        postProcessing: c.postProcessing,
        oxygenWtPct,
        buildOrientationDeg,
        scanRotationDeg
      });
      const astmMinYs = astmStd === 'F3001' ? 795 : 825;
      if (
        evCand.yieldStrengthMpa >= Math.max(minYsMpa, astmMinYs) &&
        evCand.elongationPct >= minElongPct &&
        evCand.residualStressMpa <= maxResidualStressMpa &&
        evCand.buildRateCm3H >= minBuildRateCm3H &&
        evCand.densityPct >= 99.4 &&
        evCand.mahalanobisDistance <= 3.5 &&
        evCand.yieldStrengthMpa >= c.yieldStrengthMpa
      ) {
        curP = candP;
        curV = candV;
      } else {
        break;
      }
    }

    if (curP !== c.P || curV !== c.v) {
      const refinedEv = evaluateForwardTi64Candidate({
        processId: c.processId,
        alloyId,
        P: curP, v: curV, h: c.h, t: c.t, db: c.db, T0: c.T0,
        postProcessing: c.postProcessing,
        oxygenWtPct,
        buildOrientationDeg,
        scanRotationDeg
      });
      const refPinn = evaluateTi64Pinn({
        processId: c.processId,
        P: curP, v: curV, h: c.h, t: c.t, T0: c.T0, db: c.db,
        postProcessing: c.postProcessing,
        oxygenWtPct,
        densityPct: refinedEv.densityPct,
        buildOrientationDeg
      });
      return {
        ...refinedEv,
        rank: c.rank,
        tag: c.tag,
        paretoScore: c.paretoScore,
        pinnYieldStrengthMpa: refPinn.metallurgy.yieldStrengthMpa,
        pinnHallPetchResidualMpa: refPinn.physicsAudit.hallPetchResidualMpa,
        gradientRefined: true
      };
    }

    return {
      ...c,
      pinnYieldStrengthMpa: basePinn.metallurgy.yieldStrengthMpa,
      pinnHallPetchResidualMpa: basePinn.physicsAudit.hallPetchResidualMpa,
      gradientRefined: false
    };
  };

  const assign = (item: typeof scored[0] | undefined, tag: string) => {
    if (!item) return;
    const k = keyOf(item);
    if (usedKeys.has(k) || labeled.length >= maxReturn) return;
    usedKeys.add(k);
    labeled.push(polishWithPinn({ ...item, rank: labeled.length + 1, tag }));
  };

  assign(byScore[0], 'Balanced Pareto Optimal');
  assign(byLpbf[0], 'Precision LPBF Optimal');
  assign(byRate[0], 'Max Throughput');
  assign(byYs[0], 'Peak Strength');
  assign(byStress[0], 'Min Residual Stress');
  for (const extra of byScore) {
    assign(extra, 'Pareto Feasible');
  }

  return {
    feasibleCount: feasible.length,
    evaluatedCount: rawGrid.length,
    elapsedMs: Date.now() - tStart,
    candidates: labeled.slice(0, maxReturn),
    failureReason: null
  };
}
