/**
 * NIT Trichy Titanium AM Platform — Bayesian Active Learning ("Next Best Experiment") Engine
 *
 * Zero-dependency client/server module coupling:
 *   - Stratified deterministic Latin Hypercube candidate generation across LPBF, L-DED, WAAM, & Binder Jetting
 *   - Cascaded Ti-6Al-4V PINN + Sintering Physics + Hybrid GPR epistemic/OOD uncertainty estimation
 *   - Three literature-backed acquisition policies:
 *       1. Adaptive Weighted Uncertainty Sampling (van Houtum & Vlasea, 2021)
 *       2. Analytical Gaussian Expected Improvement (Lookman et al., 2019)
 *       3. Multi-Objective Pareto Active Learning (Lee et al., 2025)
 *   - Greedy Euclidean diversity batch selector & formula-safe CSV lab coupon exporter
 */

import { formatSafeCsvCell } from '../components/LabCalibrationPanel';
import { evaluateOodRisk, resolveProcessEnvelope, type OodStatus } from './ood-detector';
import { classifyProcessRegime, type RegimeCode, type RegimeSeverity } from './regime-classifier';
import { evaluateTi64Pinn } from './ti64-pinn';

export type ActiveLearningProcessId = 'lpbf' | 'ded-laser' | 'waam' | 'binder-jetting';
export type ActiveLearningStrategy = 'uncertainty' | 'ei' | 'pareto';
export type ActiveLearningTargetProp = 'uts_mpa' | 'ys_mpa' | 'hardness_hv' | 'elongation_pct';
export type ActiveLearningPostProc = 'None' | 'Stress-relieved' | 'Annealed' | 'HIP';

export interface ProcessLhcEnvelope {
  processId: ActiveLearningProcessId;
  displayName: string;
  P: readonly [number, number];
  v: readonly [number, number];
  h: readonly [number, number];
  t: readonly [number, number];
  T0: readonly [number, number];
  sinterTempC?: readonly [number, number];
  sinterHoldMin?: readonly [number, number];
}

export const ACTIVE_LEARNING_ENVELOPES: Record<ActiveLearningProcessId, ProcessLhcEnvelope> = {
  lpbf: {
    processId: 'lpbf',
    displayName: 'LPBF',
    P: [120, 380],
    v: [500, 1500],
    h: [70, 130],
    t: [20, 60],
    T0: [25, 250]
  },
  'ded-laser': {
    processId: 'ded-laser',
    displayName: 'L-DED',
    P: [600, 2400],
    v: [6, 25],
    h: [700, 1600],
    t: [250, 700],
    T0: [25, 200]
  },
  waam: {
    processId: 'waam',
    displayName: 'WAAM',
    P: [1200, 3600],
    v: [4, 15],
    h: [2800, 4200],
    t: [1100, 1800],
    T0: [25, 200]
  },
  'binder-jetting': {
    processId: 'binder-jetting',
    displayName: 'Binder Jetting',
    P: [80, 180],
    v: [250, 650],
    h: [40, 85],
    t: [30, 80],
    T0: [90, 200],
    sinterTempC: [1180, 1420],
    sinterHoldMin: [60, 240]
  }
};

export const POST_PROC_SEARCH_STATES: readonly ActiveLearningPostProc[] = [
  'None',
  'Stress-relieved',
  'Annealed',
  'HIP'
];

export interface ActiveLearningCandidateParams {
  processId: ActiveLearningProcessId;
  P: number;
  v: number;
  h: number;
  t: number;
  T0: number;
  post: ActiveLearningPostProc;
  sinterTempC?: number;
  sinterHoldMin?: number;
}

export interface PropertyPredictionWithInterval {
  mean: number;
  sigma: number;
  pi95: number;
}

export interface EvaluatedActiveLearningCandidate {
  candidateIndex: number;
  params: ActiveLearningCandidateParams;
  ved: number;
  hi: number;
  uts: PropertyPredictionWithInterval;
  ys: PropertyPredictionWithInterval;
  hv: PropertyPredictionWithInterval;
  elongation: PropertyPredictionWithInterval;
  densityPct: number;
  dM: number;
  oodStatus: OodStatus;
  regimeCode: RegimeCode;
  regimeLabel: string;
  regimeSeverity: RegimeSeverity;
  astmPassProb: number;
  paretoRank: number;
  acquisitionScore: number;
}

export interface RankedActiveLearningRecommendation extends EvaluatedActiveLearningCandidate {
  rank: number;
  rationale: string;
}

export interface CalibratedSubModelLite {
  scalerMean?: readonly number[];
  scalerStd?: readonly number[];
  gprGamma?: number;
  supportZ?: readonly (readonly number[])[];
}

export type CalibratedModelsLite = Record<string, Record<string, CalibratedSubModelLite | undefined> | undefined>;

export interface ActiveLearningPlannerOptions {
  processId?: string;
  strategy?: ActiveLearningStrategy;
  targetProperty?: ActiveLearningTargetProp;
  xi?: number;
  batchSize?: number;
  candidateCount?: number;
  seed?: number;
  requireConductionWindow?: boolean;
  requireAstmElong?: boolean;
  includePostSearch?: boolean;
  defaultPostProcessing?: ActiveLearningPostProc;
  calibratedModels?: CalibratedModelsLite;
  baselineBestOverride?: Partial<Record<ActiveLearningTargetProp, number>>;
}

export interface ActiveLearningPlannerResult {
  processId: ActiveLearningProcessId;
  strategy: ActiveLearningStrategy;
  targetProperty: ActiveLearningTargetProp;
  xi: number;
  yBest: number;
  totalGenerated: number;
  feasibleCount: number;
  elapsedMs: number;
  pool: EvaluatedActiveLearningCandidate[];
  recommendations: RankedActiveLearningRecommendation[];
}

export function normalizeActiveLearningProcessId(raw?: string | null): ActiveLearningProcessId {
  const s = String(raw || 'lpbf').toLowerCase().trim();
  if (s === 'waam') return 'waam';
  if (s === 'lded' || s === 'l-ded' || s === 'ded-laser' || s === 'ded') return 'ded-laser';
  if (s === 'bj' || s === 'bjt' || s === 'binder-jetting' || s === 'binder_jetting') return 'binder-jetting';
  return 'lpbf';
}

function clampFinite(val: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(val) ? Math.max(min, Math.min(max, val)) : fallback;
}

/**
 * Deterministic 32-bit PRNG (Mulberry32) so LHS batches are reproducible for any fixed seed.
 */
function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createShuffledStrata(n: number, rng: () => number): number[] {
  const arr = new Array<number>(n);
  for (let i = 0; i < n; i++) arr[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Standard Normal PDF phi(z).
 */
export function normalPdf(z: number): number {
  if (!Number.isFinite(z)) return 0;
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard Normal CDF Phi(z) using Abramowitz & Stegun 7.1.26 (< 1.5e-7 error).
 */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const p = 0.3275911;
  const t = 1.0 / (1.0 + p * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const erf = 1.0 - poly * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * erf);
}

/**
 * Analytical Gaussian Expected Improvement:
 *   EI(x) = (mu - yBest - xi) * Phi(Z) + sigma * phi(Z),  Z = (mu - yBest - xi) / sigma
 * Strictly >= 0 and returns 0 when sigma <= 1e-9 and mu <= yBest + xi.
 */
export function computeExpectedImprovement(
  mu: number,
  sigma: number,
  yBest: number,
  xi = 0.05
): number {
  if (!Number.isFinite(mu) || !Number.isFinite(sigma) || !Number.isFinite(yBest)) return 0;
  const safeXi = Number.isFinite(xi) ? Math.max(0, xi) : 0;
  const improvement = mu - yBest - safeXi;
  if (sigma <= 1e-9) {
    return improvement > 0 ? improvement : 0;
  }
  const z = improvement / sigma;
  const ei = improvement * normalCdf(z) + sigma * normalPdf(z);
  return Number.isFinite(ei) ? Math.max(0, ei) : 0;
}

/**
 * Generates N stratified candidates inside safe machine envelopes using Seeded Latin Hypercube Sampling.
 */
export function generateLhcCandidates(
  processIdInput?: string,
  options: {
    count?: number;
    seed?: number;
    includePostSearch?: boolean;
    defaultPostProcessing?: ActiveLearningPostProc;
  } = {}
): ActiveLearningCandidateParams[] {
  const processId = normalizeActiveLearningProcessId(processIdInput);
  const env = ACTIVE_LEARNING_ENVELOPES[processId];
  const n = Math.round(clampFinite(options.count ?? 300, 150, 500, 300));
  const seed = Number.isFinite(options.seed) ? Number(options.seed) : 42;
  const includePost = options.includePostSearch !== false;
  const fallbackPost: ActiveLearningPostProc = options.defaultPostProcessing || 'HIP';
  const rng = createMulberry32(seed);

  const dimsCount = processId === 'binder-jetting' ? 7 : 5;
  const perm = Array.from({ length: dimsCount }, () => createShuffledStrata(n, rng));
  const jitter = Array.from({ length: dimsCount }, () =>
    Array.from({ length: n }, () => rng())
  );
  const postShuffled = createShuffledStrata(n, rng);

  const sampleDim = (dimIdx: number, i: number, bounds: readonly [number, number], step = 1): number => {
    const u = (perm[dimIdx][i] + jitter[dimIdx][i]) / n;
    const raw = bounds[0] + u * (bounds[1] - bounds[0]);
    const rounded = step >= 1 ? Math.round(raw / step) * step : Number((Math.round(raw / step) * step).toFixed(2));
    return clampFinite(rounded, bounds[0], bounds[1], bounds[0]);
  };

  const out: ActiveLearningCandidateParams[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const post = includePost
      ? POST_PROC_SEARCH_STATES[postShuffled[i] % POST_PROC_SEARCH_STATES.length]
      : fallbackPost;

    if (processId === 'binder-jetting') {
      out[i] = {
        processId,
        P: sampleDim(0, i, env.P, 1),
        v: sampleDim(1, i, env.v, 5),
        h: sampleDim(2, i, env.h, 1),
        t: sampleDim(3, i, env.t, 5),
        T0: sampleDim(4, i, env.T0, 5),
        sinterTempC: sampleDim(5, i, env.sinterTempC || [1180, 1420], 5),
        sinterHoldMin: sampleDim(6, i, env.sinterHoldMin || [60, 240], 5),
        post
      };
    } else if (processId === 'waam' || processId === 'ded-laser') {
      out[i] = {
        processId,
        P: sampleDim(0, i, env.P, 10),
        v: sampleDim(1, i, env.v, 0.5),
        h: sampleDim(2, i, env.h, 25),
        t: sampleDim(3, i, env.t, 25),
        T0: sampleDim(4, i, env.T0, 5),
        post
      };
    } else {
      out[i] = {
        processId,
        P: sampleDim(0, i, env.P, 5),
        v: sampleDim(1, i, env.v, 10),
        h: sampleDim(2, i, env.h, 5),
        t: sampleDim(3, i, env.t, 5),
        T0: sampleDim(4, i, env.T0, 5),
        post
      };
    }
  }
  return out;
}

const PROCESS_BASE_SIGMA: Record<ActiveLearningProcessId, { uts: number; ys: number; hv: number; el: number }> = {
  lpbf: { uts: 26.0, ys: 21.0, hv: 6.5, el: 0.95 },
  'ded-laser': { uts: 37.0, ys: 27.0, hv: 8.5, el: 1.25 },
  waam: { uts: 52.0, ys: 41.0, hv: 13.5, el: 1.75 },
  'binder-jetting': { uts: 58.0, ys: 46.0, hv: 17.0, el: 2.10 }
};

const PROCESS_Y_BEST_BASELINES: Record<ActiveLearningProcessId, Record<ActiveLearningTargetProp, number>> = {
  lpbf: { uts_mpa: 1095, ys_mpa: 1015, hardness_hv: 382, elongation_pct: 15.2 },
  'ded-laser': { uts_mpa: 1030, ys_mpa: 940, hardness_hv: 360, elongation_pct: 14.5 },
  waam: { uts_mpa: 970, ys_mpa: 875, hardness_hv: 342, elongation_pct: 15.0 },
  'binder-jetting': { uts_mpa: 930, ys_mpa: 830, hardness_hv: 332, elongation_pct: 12.2 }
};

function computeGprNoveltyFactor(
  model: CalibratedSubModelLite | undefined,
  params: ActiveLearningCandidateParams,
  ved: number,
  hi: number
): number {
  if (!model || !Array.isArray(model.scalerMean) || !Array.isArray(model.scalerStd) || !Array.isArray(model.supportZ) || model.supportZ.length === 0) {
    return 1.15;
  }
  const normPost = params.post;
  const htTempC = normPost === 'HIP' ? 920 : normPost === 'Annealed' ? 730 : normPost === 'Stress-relieved' ? 650 : 25;
  const isDedOrWaam = params.processId === 'ded-laser' || params.processId === 'waam';
  const rawX = [
    normPost === 'Stress-relieved' ? 1 : 0,
    normPost === 'Annealed' ? 1 : 0,
    normPost === 'HIP' ? 1 : 0,
    0,
    0,
    0,
    Math.log10(Math.max(10, params.P)),
    Math.log10(Math.max(1, params.v)),
    Math.log10(Math.max(10, params.h)),
    Math.log10(Math.max(10, params.t)),
    params.T0 / 200.0,
    Math.log10(Math.max(1, isDedOrWaam ? hi : ved)),
    htTempC / 500.0,
    1.0,
    1.0,
    0
  ];
  const z = rawX.map((val, j) => (val - (model.scalerMean?.[j] ?? 0)) / (model.scalerStd?.[j] || 1));
  const gamma = Number.isFinite(model.gprGamma) ? Number(model.gprGamma) : 0.12;

  let kMax = 0;
  for (let i = 0; i < model.supportZ.length; i++) {
    const sv = model.supportZ[i];
    let d2 = 0;
    const len = Math.min(z.length, sv.length);
    for (let j = 0; j < len; j++) {
      const df = z[j] - sv[j];
      d2 += df * df;
    }
    const sim = Math.exp(-gamma * d2);
    if (sim > kMax) kMax = sim;
  }
  // Novel regions far from calibrated support points receive up to 1.6x posterior variance boost
  return 0.85 + 0.75 * Math.sqrt(Math.max(0, 1.0 - kMax));
}

function evaluateBinderJettingPhysics(params: ActiveLearningCandidateParams): {
  ysMpa: number;
  utsMpa: number;
  hv: number;
  elongationPct: number;
  densityPct: number;
} {
  const sinterTempC = clampFinite(params.sinterTempC ?? 1320, 1050, 1500, 1320);
  const sinterHoldMin = clampFinite(params.sinterHoldMin ?? 120, 30, 360, 120);
  const layerPenalty = Math.max(0, (params.t - 50) * 0.045);

  let densityPct =
    82.0 +
    14.6 / (1.0 + Math.exp(-(sinterTempC - 1310.0) / 26.0)) +
    0.009 * (sinterHoldMin - 120.0) -
    layerPenalty;
  if (params.post === 'HIP') densityPct = Math.min(99.85, Math.max(98.2, densityPct + 3.2));
  densityPct = Number(clampFinite(densityPct, 82.0, 99.85, 95.5).toFixed(2));

  const grainCoarsenPenalty = Math.max(0, (sinterTempC - 1340) * 0.14);
  const densFactor = Math.pow(densityPct / 99.5, 2.2);
  let ysMpa = (params.post === 'HIP' ? 848 : 745) * densFactor - grainCoarsenPenalty;
  if (params.post === 'Annealed') ysMpa += 24;
  if (params.post === 'Stress-relieved') ysMpa += 15;
  ysMpa = Math.round(clampFinite(ysMpa, 610, 980, 790));

  const utsToYs = params.post === 'HIP' ? 1.125 : 1.145;
  const utsMpa = Math.round(clampFinite(ysMpa * utsToYs, ysMpa + 45, 1090, 895));
  const hv = Math.round(clampFinite(285 * densFactor + (params.post === 'HIP' ? 48 : 14) - grainCoarsenPenalty * 0.18, 250, 370, 312));

  const baseEl = params.post === 'HIP' ? 13.8 : params.post === 'Annealed' ? 10.6 : params.post === 'Stress-relieved' ? 8.8 : 7.6;
  const poreDuctility = Math.exp(-0.34 * Math.max(0, 99.5 - densityPct));
  const elongationPct = Number(clampFinite(baseEl * poreDuctility, 2.5, 16.5, 9.2).toFixed(1));

  return { ysMpa, utsMpa, hv, elongationPct, densityPct };
}

/**
 * Evaluates a single LHC candidate using PINN / Sintering physics + calibrated 6x6 OOD risk + regime classifier.
 */
export function evaluateActiveLearningCandidate(
  params: ActiveLearningCandidateParams,
  candidateIndex: number,
  calibratedModels?: CalibratedModelsLite
): EvaluatedActiveLearningCandidate {
  const ved = Number(((params.P * 1e6) / Math.max(1, params.v * params.h * params.t)).toFixed(1));
  const hi = Number((params.P / Math.max(0.5, params.v)).toFixed(2));
  const ood = evaluateOodRisk({ P: params.P, v: params.v, h: params.h, t: params.t, T0: params.T0, ved }, params.processId);

  const regime = classifyProcessRegime(
    params.processId,
    { P: params.P, v: params.v, h: params.h, t: params.t, T0: params.T0 },
    { ved, heatInput: hi, sinteringTempC: params.sinterTempC }
  );

  let utsMean: number;
  let ysMean: number;
  let hvMean: number;
  let elongMean: number;
  let densityPct: number;

  if (params.processId === 'binder-jetting') {
    const bj = evaluateBinderJettingPhysics(params);
    utsMean = bj.utsMpa;
    ysMean = bj.ysMpa;
    hvMean = bj.hv;
    elongMean = bj.elongationPct;
    densityPct = bj.densityPct;
  } else {
    const pinn = evaluateTi64Pinn({
      processId: params.processId,
      P: params.P,
      v: params.v,
      h: params.h,
      t: params.t,
      T0: params.T0,
      postProcessing: params.post
    });
    ysMean = pinn.metallurgy.yieldStrengthMpa;
    utsMean = pinn.metallurgy.utsMpa;
    hvMean = pinn.metallurgy.predictedHv;
    elongMean = pinn.metallurgy.elongationPct;
    densityPct = regime.code === 'lof' ? 96.4 : regime.code === 'keyhole' ? 98.1 : params.post === 'HIP' ? 99.92 : 99.65;
  }

  const baseSig = PROCESS_BASE_SIGMA[params.processId];
  const procModels = calibratedModels?.[params.processId];
  const gprModUts = computeGprNoveltyFactor(procModels?.uts_mpa, params, ved, hi);
  const gprModYs = computeGprNoveltyFactor(procModels?.ys_mpa, params, ved, hi);
  const gprModHv = computeGprNoveltyFactor(procModels?.hardness_hv, params, ved, hi);
  const gprModEl = computeGprNoveltyFactor(procModels?.elongation_pct, params, ved, hi);

  const oodAmp = clampFinite(1.0 + 0.18 * ood.mahalanobisDistance, 1.0, 2.35, 1.15);
  const regimeAmp = regime.severity === 'danger' ? 1.25 : regime.severity === 'warning' ? 1.10 : 1.0;

  const sigmaUts = Number((baseSig.uts * gprModUts * oodAmp * regimeAmp).toFixed(1));
  const sigmaYs = Number((baseSig.ys * gprModYs * oodAmp * regimeAmp).toFixed(1));
  const sigmaHv = Number((baseSig.hv * gprModHv * oodAmp * regimeAmp).toFixed(1));
  const sigmaEl = Number((baseSig.el * gprModEl * oodAmp * regimeAmp).toFixed(2));

  const probEl = 1.0 - normalCdf((10.0 - elongMean) / Math.max(0.25, sigmaEl));
  const probYs = 1.0 - normalCdf((825.0 - ysMean) / Math.max(5.0, sigmaYs));
  const probUts = 1.0 - normalCdf((895.0 - utsMean) / Math.max(5.0, sigmaUts));
  const astmPassProb = Number(clampFinite(probEl * probYs * probUts, 0, 1, 0.5).toFixed(3));

  return {
    candidateIndex,
    params,
    ved,
    hi,
    uts: { mean: Math.round(utsMean), sigma: sigmaUts, pi95: Math.round(1.96 * sigmaUts) },
    ys: { mean: Math.round(ysMean), sigma: sigmaYs, pi95: Math.round(1.96 * sigmaYs) },
    hv: { mean: Math.round(hvMean), sigma: sigmaHv, pi95: Math.round(1.96 * sigmaHv * 10) / 10 },
    elongation: { mean: Number(elongMean.toFixed(1)), sigma: sigmaEl, pi95: Number((1.96 * sigmaEl).toFixed(1)) },
    densityPct,
    dM: Number(ood.mahalanobisDistance.toFixed(2)),
    oodStatus: ood.status,
    regimeCode: regime.code,
    regimeLabel: regime.shortLabel,
    regimeSeverity: regime.severity,
    astmPassProb,
    paretoRank: 1,
    acquisitionScore: 0
  };
}

function isSevereDefectRegime(c: EvaluatedActiveLearningCandidate): boolean {
  return (
    c.regimeCode === 'lof' ||
    c.regimeCode === 'keyhole' ||
    c.regimeCode === 'under_sinter' ||
    c.regimeCode === 'over_sinter' ||
    c.regimeCode === 'overheating' ||
    c.regimeCode === 'balling'
  );
}

/**
 * Assigns non-dominated Pareto ranks over (UTS_MPa, Elongation_pct) (rank 1 = Pareto frontier).
 */
export function assignParetoRanks(candidates: EvaluatedActiveLearningCandidate[]): void {
  const n = candidates.length;
  const remaining = new Set<number>(candidates.map((_, idx) => idx));
  let rank = 1;

  while (remaining.size > 0) {
    const front: number[] = [];
    for (const i of remaining) {
      const a = candidates[i];
      let dominated = false;
      for (const j of remaining) {
        if (i === j) continue;
        const b = candidates[j];
        const bBetterOrEq = b.uts.mean >= a.uts.mean && b.elongation.mean >= a.elongation.mean;
        const bStrictlyBetter = b.uts.mean > a.uts.mean || b.elongation.mean > a.elongation.mean;
        if (bBetterOrEq && bStrictlyBetter) {
          dominated = true;
          break;
        }
      }
      if (!dominated) front.push(i);
    }
    for (const idx of front) {
      candidates[idx].paretoRank = rank;
      remaining.delete(idx);
    }
    rank++;
  }
  if (n > 0 && remaining.size > 0) {
    for (const idx of remaining) candidates[idx].paretoRank = rank;
  }
}

function getTargetPrediction(c: EvaluatedActiveLearningCandidate, prop: ActiveLearningTargetProp): PropertyPredictionWithInterval {
  if (prop === 'ys_mpa') return c.ys;
  if (prop === 'hardness_hv') return c.hv;
  if (prop === 'elongation_pct') return c.elongation;
  return c.uts;
}

/**
 * Scores the evaluated candidate pool using one of the 3 Bayesian acquisition policies.
 */
export function scoreActiveLearningCandidates(
  pool: EvaluatedActiveLearningCandidate[],
  options: {
    processId: ActiveLearningProcessId;
    strategy: ActiveLearningStrategy;
    targetProperty?: ActiveLearningTargetProp;
    xi?: number;
    requireConductionWindow?: boolean;
    requireAstmElong?: boolean;
    yBest?: number;
  }
): {
  feasiblePool: EvaluatedActiveLearningCandidate[];
  yBest: number;
} {
  const targetProperty = options.targetProperty || 'uts_mpa';
  const xiNorm = clampFinite(options.xi ?? 0.05, 0.01, 0.15, 0.05);
  const reqCond = options.requireConductionWindow !== false;
  const reqAstm = Boolean(options.requireAstmElong);

  let working = reqCond ? pool.filter((c) => !isSevereDefectRegime(c)) : pool.slice();
  if (working.length < 10) {
    working = pool
      .slice()
      .sort((a, b) => (a.regimeSeverity === 'optimal' ? 0 : a.regimeSeverity === 'warning' ? 1 : 2) - (b.regimeSeverity === 'optimal' ? 0 : b.regimeSeverity === 'warning' ? 1 : 2))
      .slice(0, Math.min(pool.length, Math.max(20, Math.ceil(pool.length * 0.25))));
  }

  assignParetoRanks(working);

  const defaultYBest = PROCESS_Y_BEST_BASELINES[options.processId][targetProperty];
  const yBest = Number.isFinite(options.yBest) ? Number(options.yBest) : defaultYBest;

  if (options.strategy === 'ei') {
    const baseSig = getTargetPrediction(working[0], targetProperty).sigma || 1.0;
    const xiScaled = xiNorm * baseSig * 1.8;
    let maxEi = 1e-9;
    const rawScores = working.map((c) => {
      const pred = getTargetPrediction(c, targetProperty);
      const rawEi = computeExpectedImprovement(pred.mean, pred.sigma, yBest, xiScaled);
      const astmWeight = reqAstm ? (c.elongation.mean >= 10.0 ? 1.0 : 0.25 + 0.55 * c.astmPassProb) : 1.0;
      const feasWeight = c.regimeSeverity === 'optimal' ? 1.0 : c.regimeSeverity === 'warning' ? 0.85 : 0.35;
      const val = rawEi * astmWeight * feasWeight;
      if (val > maxEi) maxEi = val;
      return val;
    });
    working.forEach((c, idx) => {
      c.acquisitionScore = Number((rawScores[idx] / Math.max(1e-9, maxEi)).toFixed(4));
    });
  } else if (options.strategy === 'pareto') {
    const maxSigUts = Math.max(1e-6, ...working.map((c) => c.uts.sigma));
    const maxSigEl = Math.max(1e-6, ...working.map((c) => c.elongation.sigma));
    let maxScore = 1e-9;
    const rawScores = working.map((c) => {
      const rankScore = 1.0 / Math.pow(c.paretoRank, 0.85);
      const sigUtsNorm = c.uts.sigma / maxSigUts;
      const sigElNorm = c.elongation.sigma / maxSigEl;
      const jointUnc = Math.sqrt(Math.max(1e-6, sigUtsNorm * sigElNorm));
      const hvQuality = clampFinite((c.uts.mean - 820) / 360, 0.1, 1.0, 0.5) * 0.5 + clampFinite((c.elongation.mean - 5) / 13, 0.1, 1.0, 0.5) * 0.5;
      const astmMult = reqAstm
        ? (c.elongation.mean >= 10.0 ? 1.0 + 0.35 * c.astmPassProb : 0.18 + 0.32 * c.astmPassProb)
        : 0.78 + 0.22 * c.astmPassProb;
      const feasMult = c.regimeSeverity === 'optimal' ? 1.0 : c.regimeSeverity === 'warning' ? 0.82 : 0.3;
      const val = rankScore * (0.45 * jointUnc + 0.55 * hvQuality) * astmMult * feasMult;
      if (val > maxScore) maxScore = val;
      return val;
    });
    working.forEach((c, idx) => {
      c.acquisitionScore = Number((rawScores[idx] / Math.max(1e-9, maxScore)).toFixed(4));
    });
  } else {
    // Adaptive Weighted Uncertainty Sampling (van Houtum & Vlasea, 2021)
    const maxSigUts = Math.max(1e-6, ...working.map((c) => c.uts.sigma));
    const maxSigEl = Math.max(1e-6, ...working.map((c) => c.elongation.sigma));
    let maxUnc = 1e-9;
    const rawScores = working.map((c) => {
      const sigmaNorm = 0.55 * (c.uts.sigma / maxSigUts) + 0.45 * (c.elongation.sigma / maxSigEl);
      const wFeasible = c.regimeSeverity === 'optimal' ? 1.0 : c.regimeSeverity === 'warning' ? 0.72 : 0.25;
      // Peak curiosity around data boundaries (dM ~ 1.9), taper gently past extreme extrapolation (> 3.2)
      const wOod = c.dM <= 3.2
        ? 0.92 + 0.48 * Math.exp(-Math.pow(c.dM - 1.9, 2) / 1.45)
        : Math.max(0.35, 1.15 * Math.exp(-0.45 * (c.dM - 3.2)));
      const astmMult = reqAstm ? (c.elongation.mean >= 10.0 ? 1.0 : 0.3 + 0.4 * c.astmPassProb) : 1.0;
      const val = sigmaNorm * wFeasible * wOod * astmMult;
      if (val > maxUnc) maxUnc = val;
      return val;
    });
    working.forEach((c, idx) => {
      c.acquisitionScore = Number((rawScores[idx] / Math.max(1e-9, maxUnc)).toFixed(4));
    });
  }

  working.sort((a, b) => b.acquisitionScore - a.acquisitionScore);
  return { feasiblePool: working, yBest };
}

function normalizedParamDistance(
  a: ActiveLearningCandidateParams,
  b: ActiveLearningCandidateParams,
  env: ProcessLhcEnvelope
): number {
  const normDiff = (va: number, vb: number, bounds: readonly [number, number]): number => {
    const span = Math.max(1e-6, bounds[1] - bounds[0]);
    return (va - vb) / span;
  };
  let sumSq =
    Math.pow(normDiff(a.P, b.P, env.P), 2) +
    Math.pow(normDiff(a.v, b.v, env.v), 2) +
    Math.pow(normDiff(a.h, b.h, env.h), 2) +
    Math.pow(normDiff(a.t, b.t, env.t), 2) +
    Math.pow(normDiff(a.T0, b.T0, env.T0), 2);
  let dims = 5;
  if (env.processId === 'binder-jetting' && env.sinterTempC && env.sinterHoldMin) {
    sumSq += Math.pow(normDiff(a.sinterTempC ?? 1320, b.sinterTempC ?? 1320, env.sinterTempC), 2);
    sumSq += Math.pow(normDiff(a.sinterHoldMin ?? 120, b.sinterHoldMin ?? 120, env.sinterHoldMin), 2);
    dims = 7;
  }
  return Math.sqrt(sumSq / dims);
}

function buildPlainEnglishRationale(
  c: EvaluatedActiveLearningCandidate,
  strategy: ActiveLearningStrategy,
  targetProperty: ActiveLearningTargetProp,
  yBest: number
): string {
  const p = c.params;
  const paramSummary = p.processId === 'binder-jetting'
    ? `Sinter ${p.sinterTempC}°C/${p.sinterHoldMin} min, t=${p.t} µm, ${p.post}`
    : `P=${p.P} W, v=${p.v} mm/s, h=${p.h} µm, t=${p.t} µm, ${p.post}`;

  if (strategy === 'ei') {
    const pred = getTargetPrediction(c, targetProperty);
    const label = targetProperty === 'uts_mpa' ? 'UTS' : targetProperty === 'ys_mpa' ? 'YS' : targetProperty === 'hardness_hv' ? 'HV' : 'Elong';
    return `${paramSummary}: ${label} ${pred.mean} ± ${pred.pi95} vs. ${yBest} baseline inside ${c.regimeLabel} (d_M=${c.dM}).`;
  }
  if (strategy === 'pareto') {
    return `${paramSummary}: Pareto Rank #${c.paretoRank} targeting ${c.uts.mean} MPa UTS & ${c.elongation.mean}% Elong (ASTM prob ${(c.astmPassProb * 100).toFixed(0)}%, d_M=${c.dM}).`;
  }
  return `${paramSummary}: High joint uncertainty (±${c.uts.pi95} MPa UTS / ±${c.elongation.pi95}% Elong) near data frontier d_M=${c.dM} within ${c.regimeLabel}.`;
}

/**
 * Greedily selects K top-scoring candidates while enforcing minimum normalized Euclidean spacing.
 */
export function selectTopKExperiments(
  scoredPool: EvaluatedActiveLearningCandidate[],
  options: {
    processId: ActiveLearningProcessId;
    batchSize?: number;
    strategy: ActiveLearningStrategy;
    targetProperty?: ActiveLearningTargetProp;
    yBest?: number;
    minSpacing?: number;
  }
): RankedActiveLearningRecommendation[] {
  const k = Math.max(1, Math.min(20, Math.round(options.batchSize ?? 5)));
  const env = ACTIVE_LEARNING_ENVELOPES[options.processId];
  const sorted = scoredPool.slice().sort((a, b) => b.acquisitionScore - a.acquisitionScore);
  const targetProperty = options.targetProperty || 'uts_mpa';
  const yBest = options.yBest ?? PROCESS_Y_BEST_BASELINES[options.processId][targetProperty];

  const selected: EvaluatedActiveLearningCandidate[] = [];
  const usedIndices = new Set<number>();
  const spacingTiers = [options.minSpacing ?? 0.22, 0.15, 0.08, 0];

  for (const spacing of spacingTiers) {
    if (selected.length >= k) break;
    for (const cand of sorted) {
      if (selected.length >= k) break;
      if (usedIndices.has(cand.candidateIndex)) continue;
      const farEnough = selected.every((s) => normalizedParamDistance(cand.params, s.params, env) >= spacing);
      if (farEnough) {
        selected.push(cand);
        usedIndices.add(cand.candidateIndex);
      }
    }
  }

  return selected.map((c, idx) => ({
    ...c,
    rank: idx + 1,
    rationale: buildPlainEnglishRationale(c, options.strategy, targetProperty, yBest)
  }));
}

/**
 * Full end-to-end Bayesian Active Learning planner execution (< 20 ms for N=300).
 */
export function runActiveLearningPlanner(options: ActiveLearningPlannerOptions = {}): ActiveLearningPlannerResult {
  const start = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  const processId = normalizeActiveLearningProcessId(options.processId);
  const strategy: ActiveLearningStrategy = options.strategy === 'ei' || options.strategy === 'pareto' ? options.strategy : 'uncertainty';
  const targetProperty: ActiveLearningTargetProp = options.targetProperty || 'uts_mpa';
  const xi = clampFinite(options.xi ?? 0.05, 0.01, 0.15, 0.05);
  const batchSize = options.batchSize === 3 || options.batchSize === 10 ? options.batchSize : 5;

  const rawCandidates = generateLhcCandidates(processId, {
    count: options.candidateCount ?? 300,
    seed: options.seed ?? 42,
    includePostSearch: options.includePostSearch !== false,
    defaultPostProcessing: options.defaultPostProcessing || 'HIP'
  });

  const evaluated = rawCandidates.map((params, idx) =>
    evaluateActiveLearningCandidate(params, idx, options.calibratedModels)
  );

  const baselineOverride = options.baselineBestOverride?.[targetProperty];
  const { feasiblePool, yBest } = scoreActiveLearningCandidates(evaluated, {
    processId,
    strategy,
    targetProperty,
    xi,
    requireConductionWindow: options.requireConductionWindow !== false,
    requireAstmElong: Boolean(options.requireAstmElong),
    yBest: baselineOverride
  });

  const recommendations = selectTopKExperiments(feasiblePool, {
    processId,
    batchSize,
    strategy,
    targetProperty,
    yBest
  });

  const end = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

  return {
    processId,
    strategy,
    targetProperty,
    xi,
    yBest,
    totalGenerated: rawCandidates.length,
    feasibleCount: feasiblePool.length,
    elapsedMs: Number((end - start).toFixed(1)),
    pool: feasiblePool,
    recommendations
  };
}

/**
 * Exports recommended lab coupons as formula-safe CSV matching LabCalibrationPanel upload schema
 * with blank measured_HV, measured_YS_MPa, measured_UTS_MPa, measured_elong_pct columns.
 */
export function exportActiveLearningCsv(
  recommendations: readonly RankedActiveLearningRecommendation[]
): string {
  const headers = [
    'sample_id',
    'process',
    'P_W',
    'v_mm_s',
    'h_um',
    't_um',
    'T0_C',
    'post_proc',
    'measured_HV',
    'measured_YS_MPa',
    'measured_UTS_MPa',
    'measured_elong_pct',
    'predicted_UTS_MPa',
    'predicted_elong_pct',
    'acquisition_score'
  ];

  const rows = [headers.join(',')];
  recommendations.forEach((rec, idx) => {
    const procTag = rec.params.processId.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sampleId = `NITT-AL-${procTag}-${String(idx + 1).padStart(2, '0')}`;
    const cells = [
      formatSafeCsvCell(sampleId),
      formatSafeCsvCell(rec.params.processId),
      formatSafeCsvCell(rec.params.P),
      formatSafeCsvCell(rec.params.v),
      formatSafeCsvCell(rec.params.h),
      formatSafeCsvCell(rec.params.t),
      formatSafeCsvCell(rec.params.T0),
      formatSafeCsvCell(rec.params.post),
      '',
      '',
      '',
      '',
      formatSafeCsvCell(rec.uts.mean),
      formatSafeCsvCell(rec.elongation.mean),
      formatSafeCsvCell(rec.acquisitionScore)
    ];
    rows.push(cells.join(','));
  });
  return rows.join('\n');
}

export { resolveProcessEnvelope };
