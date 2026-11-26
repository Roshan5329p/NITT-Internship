/**
 * Active Learning Lab Planner — Bayesian "Next Best Experiment" Recommender & Peer-Reviewed Proof UI
 *
 * Browser/UMD zero-dependency companion to src/lib/active-learning.ts:
 *  - Deterministic seeded Latin Hypercube Sampling across LPBF, L-DED, WAAM, Binder Jetting
 *  - Hybrid Physics + PINN + 6x6 OOD covariance uncertainty estimation
 *  - Uncertainty Reduction (van Houtum & Vlasea 2021), Expected Improvement (Lookman et al. 2019),
 *    and Pareto Active Learning (Lee et al. 2025)
 *  - Crisp interactive inline SVG acquisition plot (zero <svg><title> elements)
 *  - One-click Load into Sliders, formula-safe Lab CSV export, and Scopus-verified Proof strip
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ActiveLearningUi = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const ACTIVE_LEARNING_ENVELOPES = {
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

  const POST_PROC_SEARCH_STATES = ['None', 'Stress-relieved', 'Annealed', 'HIP'];

  const PROCESS_BASE_SIGMA = {
    lpbf: { uts: 26.0, ys: 21.0, hv: 6.5, el: 0.95 },
    'ded-laser': { uts: 37.0, ys: 27.0, hv: 8.5, el: 1.25 },
    waam: { uts: 52.0, ys: 41.0, hv: 13.5, el: 1.75 },
    'binder-jetting': { uts: 58.0, ys: 46.0, hv: 17.0, el: 2.10 }
  };

  const PROCESS_Y_BEST_BASELINES = {
    lpbf: { uts_mpa: 1095, ys_mpa: 1015, hardness_hv: 382, elongation_pct: 15.2 },
    'ded-laser': { uts_mpa: 1030, ys_mpa: 940, hardness_hv: 360, elongation_pct: 14.5 },
    waam: { uts_mpa: 970, ys_mpa: 875, hardness_hv: 342, elongation_pct: 15.0 },
    'binder-jetting': { uts_mpa: 930, ys_mpa: 830, hardness_hv: 332, elongation_pct: 12.2 }
  };

  function sanitizeHttpUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    try {
      const parsed = new URL(trimmed.startsWith('http://') ? 'https://' + trimmed.slice(7) : trimmed);
      if (parsed.protocol !== 'https:') return '';
      return parsed.toString();
    } catch (_err) {
      return '';
    }
  }

  function sanitizeExternalHttpUrl(rawUrl) {
    if (typeof window !== 'undefined' && typeof window.sanitizeExternalHttpUrl === 'function' && window.sanitizeExternalHttpUrl !== sanitizeExternalHttpUrl) {
      return window.sanitizeExternalHttpUrl(rawUrl);
    }
    return sanitizeHttpUrl(rawUrl);
  }

  function formatSafeCsvCell(val) {
    if (val === null || val === undefined) return '""';
    if (typeof val === 'number') {
      return Number.isFinite(val) ? String(val) : '""';
    }
    let str = String(val);
    if (/^[\s]*[=+\-@\t\r]/.test(str)) {
      const trimmed = str.trim();
      const isPlainSignedNum = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed) && Number.isFinite(Number(trimmed));
      if (!isPlainSignedNum) {
        str = "'" + str;
      }
    }
    return '"' + str.replace(/"/g, '""') + '"';
  }

  function clampFinite(val, min, max, fallback) {
    return Number.isFinite(val) ? Math.max(min, Math.min(max, val)) : fallback;
  }

  function normalizeActiveLearningProcessId(raw) {
    const s = String(raw || 'lpbf').toLowerCase().trim();
    if (s === 'waam') return 'waam';
    if (s === 'lded' || s === 'l-ded' || s === 'ded-laser' || s === 'ded') return 'ded-laser';
    if (s === 'bj' || s === 'bjt' || s === 'binder-jetting' || s === 'binder_jetting') return 'binder-jetting';
    return 'lpbf';
  }

  function createMulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createShuffledStrata(n, rng) {
    const arr = new Array(n);
    for (let i = 0; i < n; i++) arr[i] = i;
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function normalPdf(z) {
    if (!Number.isFinite(z)) return 0;
    return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  }

  function normalCdf(z) {
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

  function computeExpectedImprovement(mu, sigma, yBest, xi) {
    if (!Number.isFinite(mu) || !Number.isFinite(sigma) || !Number.isFinite(yBest)) return 0;
    const safeXi = Number.isFinite(xi) ? Math.max(0, xi) : 0.05;
    const improvement = mu - yBest - safeXi;
    if (sigma <= 1e-9) {
      return improvement > 0 ? improvement : 0;
    }
    const z = improvement / sigma;
    const ei = improvement * normalCdf(z) + sigma * normalPdf(z);
    return Number.isFinite(ei) ? Math.max(0, ei) : 0;
  }

  function generateLhcCandidates(processIdInput, options) {
    const opts = options || {};
    const processId = normalizeActiveLearningProcessId(processIdInput);
    const env = ACTIVE_LEARNING_ENVELOPES[processId];
    const n = Math.round(clampFinite(opts.count != null ? opts.count : 300, 150, 500, 300));
    const seed = Number.isFinite(opts.seed) ? Number(opts.seed) : 42;
    const includePost = opts.includePostSearch !== false;
    const fallbackPost = opts.defaultPostProcessing || 'HIP';
    const rng = createMulberry32(seed);

    const dimsCount = processId === 'binder-jetting' ? 7 : 5;
    const perm = Array.from({ length: dimsCount }, () => createShuffledStrata(n, rng));
    const jitter = Array.from({ length: dimsCount }, () => Array.from({ length: n }, () => rng()));
    const postShuffled = createShuffledStrata(n, rng);

    const sampleDim = (dimIdx, i, bounds, step) => {
      const s = step || 1;
      const u = (perm[dimIdx][i] + jitter[dimIdx][i]) / n;
      const raw = bounds[0] + u * (bounds[1] - bounds[0]);
      const rounded = s >= 1 ? Math.round(raw / s) * s : Number((Math.round(raw / s) * s).toFixed(2));
      return clampFinite(rounded, bounds[0], bounds[1], bounds[0]);
    };

    const out = new Array(n);
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

  function evaluateFallbackOod(params, processId) {
    const oodFn = (typeof window !== 'undefined' && typeof window.evaluateOodRisk === 'function' && window.evaluateOodRisk)
      || (typeof evaluateOodRisk === 'function' ? evaluateOodRisk : null);
    if (oodFn) {
      return oodFn(params, processId);
    }
    const env = ACTIVE_LEARNING_ENVELOPES[processId] || ACTIVE_LEARNING_ENVELOPES.lpbf;
    const norms = [
      (params.P - 0.5 * (env.P[0] + env.P[1])) / Math.max(1, 0.25 * (env.P[1] - env.P[0])),
      (params.v - 0.5 * (env.v[0] + env.v[1])) / Math.max(1, 0.25 * (env.v[1] - env.v[0])),
      (params.h - 0.5 * (env.h[0] + env.h[1])) / Math.max(1, 0.25 * (env.h[1] - env.h[0])),
      (params.t - 0.5 * (env.t[0] + env.t[1])) / Math.max(1, 0.25 * (env.t[1] - env.t[0])),
      (params.T0 - 0.5 * (env.T0[0] + env.T0[1])) / Math.max(1, 0.25 * (env.T0[1] - env.T0[0]))
    ];
    const sq = norms.reduce((acc, x) => acc + x * x, 0);
    const dM = Number(Math.sqrt(sq / norms.length * 1.4).toFixed(2));
    return {
      mahalanobisDistance: dM,
      status: dM > 2.8 ? 'extrapolating' : (dM > 1.7 ? 'boundary' : 'in_distribution'),
      piMultiplier: Number(Math.min(2.3, 1 + 0.16 * dM).toFixed(2))
    };
  }

  function classifyCandidateRegime(params, ved, hi) {
    const pid = params.processId;
    if (pid === 'binder-jetting') {
      const sat = (params.P / 120.0) * 65.0;
      const st = params.sinterTempC || 1320;
      if (params.P < 70 || params.T0 < 80 || sat < 40 || st < 1180) {
        return { code: 'under_sinter', shortLabel: 'Low Binder Sat', severity: 'warning' };
      }
      if (params.P > 200 || params.T0 > 210 || sat > 110 || st > 1350) {
        return { code: 'over_sinter', shortLabel: 'Slumping Risk', severity: 'danger' };
      }
      return { code: 'sintering', shortLabel: 'Solid-State Sinter', severity: 'optimal' };
    }
    if (pid === 'waam') {
      if (hi < 120) return { code: 'lof', shortLabel: 'Lack of Fusion', severity: 'danger' };
      if (hi > 600) return { code: 'overheating', shortLabel: 'Overheating', severity: 'danger' };
      if (hi > 420) return { code: 'transition', shortLabel: 'High HI Arc', severity: 'warning' };
      return { code: 'conduction', shortLabel: 'Optimal Arc', severity: 'optimal' };
    }
    if (pid === 'ded-laser') {
      if (hi < 75) return { code: 'lof', shortLabel: 'Lack of Fusion', severity: 'danger' };
      if (hi > 240) return { code: 'keyhole', shortLabel: 'Over-Dilution', severity: 'danger' };
      if (hi > 175) return { code: 'transition', shortLabel: 'Transition-Dilution', severity: 'warning' };
      return { code: 'conduction', shortLabel: 'Conduction-Dilution', severity: 'optimal' };
    }
    if (ved < 36) return { code: 'lof', shortLabel: 'Lack of Fusion', severity: 'danger' };
    if (ved < 46) return { code: 'transition_lof', shortLabel: 'Shallow Transition', severity: 'warning' };
    if (ved > 118) return { code: 'keyhole', shortLabel: 'Keyhole Vapor', severity: 'danger' };
    if (ved > 92) return { code: 'transition', shortLabel: 'Transition Mode', severity: 'warning' };
    return { code: 'conduction', shortLabel: 'Conduction Mode', severity: 'optimal' };
  }

  function computeGprNoveltyFactor(model, params, ved, hi) {
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
    const z = rawX.map((val, j) => (val - (model.scalerMean[j] != null ? model.scalerMean[j] : 0)) / (model.scalerStd[j] || 1));
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
    return 0.85 + 0.75 * Math.sqrt(Math.max(0, 1.0 - kMax));
  }

  function evaluateBinderJettingPhysics(params) {
    const sinterTempC = clampFinite(params.sinterTempC != null ? params.sinterTempC : 1320, 1050, 1500, 1320);
    const sinterHoldMin = clampFinite(params.sinterHoldMin != null ? params.sinterHoldMin : 120, 30, 360, 120);
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

  function evaluateActiveLearningCandidate(params, candidateIndex, calibratedModels) {
    const ved = Number(((params.P * 1e6) / Math.max(1, params.v * params.h * params.t)).toFixed(1));
    const hi = Number((params.P / Math.max(0.5, params.v)).toFixed(2));
    const ood = evaluateFallbackOod({ P: params.P, v: params.v, h: params.h, t: params.t, T0: params.T0, ved }, params.processId);
    const regime = classifyCandidateRegime(params, ved, hi);

    let utsMean;
    let ysMean;
    let hvMean;
    let elongMean;
    let densityPct;

    if (params.processId === 'binder-jetting') {
      const bj = evaluateBinderJettingPhysics(params);
      utsMean = bj.utsMpa;
      ysMean = bj.ysMpa;
      hvMean = bj.hv;
      elongMean = bj.elongationPct;
      densityPct = bj.densityPct;
    } else if (typeof evaluateTi64Pinn === 'function' && typeof PINN_TI64_WEIGHTS !== 'undefined' && PINN_TI64_WEIGHTS) {
      const pinn = evaluateTi64Pinn({
        processId: params.processId,
        P: params.P,
        v: params.v,
        h: params.h,
        t: params.t,
        T0: params.T0,
        postProcessing: params.post
      });
      if (pinn && pinn.metallurgy) {
        ysMean = pinn.metallurgy.yieldStrengthMpa;
        utsMean = pinn.metallurgy.utsMpa;
        hvMean = pinn.metallurgy.predictedHv;
        elongMean = pinn.metallurgy.elongationPct;
        densityPct = regime.code === 'lof' ? 96.4 : regime.code === 'keyhole' ? 98.1 : params.post === 'HIP' ? 99.92 : 99.65;
      }
    }

    if (!Number.isFinite(utsMean)) {
      // Pure analytical fallback (used in standalone unit tests when DOM/weights aren't loaded)
      const isWaam = params.processId === 'waam';
      const isDed = params.processId === 'ded-laser';
      const coolScale = isWaam ? 2.4 : isDed ? 3.2 : 5.3;
      const baseYs = isWaam ? 855 : isDed ? 895 : 965;
      const postShift = params.post === 'HIP' ? -70 : params.post === 'Annealed' ? -45 : params.post === 'Stress-relieved' ? -15 : 45;
      const preheatSigmoid = 1.0 / (1.0 + Math.exp(-(params.T0 - 280.0) / 40.0));
      ysMean = Math.round(clampFinite(baseYs + postShift + (coolScale - 3.5) * 14 - preheatSigmoid * 55 + 0.08 * (params.P - 250), 680, 1180, 920));
      utsMean = Math.round(clampFinite(ysMean * (params.post === 'HIP' ? 1.12 : 1.145), ysMean + 50, 1280, 1020));
      hvMean = Math.round(clampFinite(utsMean / 2.86, 265, 425, 345));
      const baseEl = params.post === 'HIP' ? 15.2 : params.post === 'Annealed' ? 12.6 : params.post === 'Stress-relieved' ? 9.6 : 7.4;
      const defPen = regime.severity === 'danger' ? 0.55 : regime.severity === 'warning' ? 0.88 : 1.0;
      elongMean = Number(clampFinite((baseEl + 2.5 * preheatSigmoid) * defPen, 2.5, 20.0, 11.5).toFixed(1));
      densityPct = regime.code === 'lof' ? 96.4 : regime.code === 'keyhole' ? 98.1 : params.post === 'HIP' ? 99.92 : 99.65;
    }

    const baseSig = PROCESS_BASE_SIGMA[params.processId] || PROCESS_BASE_SIGMA.lpbf;
    const modelsSrc = calibratedModels || (typeof window !== 'undefined' ? window.CALIBRATED_MODELS : null);
    const procModels = modelsSrc ? modelsSrc[params.processId] : null;
    const gprModUts = computeGprNoveltyFactor(procModels && procModels.uts_mpa, params, ved, hi);
    const gprModYs = computeGprNoveltyFactor(procModels && procModels.ys_mpa, params, ved, hi);
    const gprModHv = computeGprNoveltyFactor(procModels && procModels.hardness_hv, params, ved, hi);
    const gprModEl = computeGprNoveltyFactor(procModels && procModels.elongation_pct, params, ved, hi);

    const dMVal = Number((ood && ood.mahalanobisDistance != null ? ood.mahalanobisDistance : 1.2).toFixed(2));
    const oodAmp = clampFinite(1.0 + 0.18 * dMVal, 1.0, 2.35, 1.15);
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
      dM: dMVal,
      oodStatus: ood ? ood.status : 'in_distribution',
      regimeCode: regime.code,
      regimeLabel: regime.shortLabel,
      regimeSeverity: regime.severity,
      astmPassProb,
      paretoRank: 1,
      acquisitionScore: 0
    };
  }

  function isSevereDefectRegime(c) {
    return (
      c.regimeCode === 'lof' ||
      c.regimeCode === 'keyhole' ||
      c.regimeCode === 'under_sinter' ||
      c.regimeCode === 'over_sinter' ||
      c.regimeCode === 'overheating' ||
      c.regimeCode === 'balling'
    );
  }

  function assignParetoRanks(candidates) {
    const remaining = new Set(candidates.map((_, idx) => idx));
    let rank = 1;
    while (remaining.size > 0) {
      const front = [];
      for (const i of remaining) {
        const a = candidates[i];
        let dominated = false;
        for (const j of remaining) {
          if (i === j) continue;
          const b = candidates[j];
          if (b.uts.mean >= a.uts.mean && b.elongation.mean >= a.elongation.mean && (b.uts.mean > a.uts.mean || b.elongation.mean > a.elongation.mean)) {
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
  }

  function getTargetPrediction(c, prop) {
    if (prop === 'ys_mpa') return c.ys;
    if (prop === 'hardness_hv') return c.hv;
    if (prop === 'elongation_pct') return c.elongation;
    return c.uts;
  }

  function scoreActiveLearningCandidates(pool, options) {
    const opts = options || {};
    const targetProperty = opts.targetProperty || 'uts_mpa';
    const xiNorm = clampFinite(opts.xi != null ? opts.xi : 0.05, 0.01, 0.15, 0.05);
    const reqCond = opts.requireConductionWindow !== false;
    const reqAstm = Boolean(opts.requireAstmElong);

    let working = reqCond ? pool.filter((c) => !isSevereDefectRegime(c)) : pool.slice();
    if (working.length < 10) {
      working = pool
        .slice()
        .sort((a, b) => (a.regimeSeverity === 'optimal' ? 0 : a.regimeSeverity === 'warning' ? 1 : 2) - (b.regimeSeverity === 'optimal' ? 0 : b.regimeSeverity === 'warning' ? 1 : 2))
        .slice(0, Math.min(pool.length, Math.max(20, Math.ceil(pool.length * 0.25))));
    }

    assignParetoRanks(working);

    const defaultYBest = PROCESS_Y_BEST_BASELINES[opts.processId][targetProperty];
    const yBest = Number.isFinite(opts.yBest) ? Number(opts.yBest) : defaultYBest;

    if (opts.strategy === 'ei') {
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
    } else if (opts.strategy === 'pareto') {
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
      const maxSigUts = Math.max(1e-6, ...working.map((c) => c.uts.sigma));
      const maxSigEl = Math.max(1e-6, ...working.map((c) => c.elongation.sigma));
      let maxUnc = 1e-9;
      const rawScores = working.map((c) => {
        const sigmaNorm = 0.55 * (c.uts.sigma / maxSigUts) + 0.45 * (c.elongation.sigma / maxSigEl);
        const wFeasible = c.regimeSeverity === 'optimal' ? 1.0 : c.regimeSeverity === 'warning' ? 0.72 : 0.25;
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

  function normalizedParamDistance(a, b, env) {
    const normDiff = (va, vb, bounds) => (va - vb) / Math.max(1e-6, bounds[1] - bounds[0]);
    let sumSq =
      Math.pow(normDiff(a.P, b.P, env.P), 2) +
      Math.pow(normDiff(a.v, b.v, env.v), 2) +
      Math.pow(normDiff(a.h, b.h, env.h), 2) +
      Math.pow(normDiff(a.t, b.t, env.t), 2) +
      Math.pow(normDiff(a.T0, b.T0, env.T0), 2);
    let dims = 5;
    if (env.processId === 'binder-jetting' && env.sinterTempC && env.sinterHoldMin) {
      sumSq += Math.pow(normDiff(a.sinterTempC != null ? a.sinterTempC : 1320, b.sinterTempC != null ? b.sinterTempC : 1320, env.sinterTempC), 2);
      sumSq += Math.pow(normDiff(a.sinterHoldMin != null ? a.sinterHoldMin : 120, b.sinterHoldMin != null ? b.sinterHoldMin : 120, env.sinterHoldMin), 2);
      dims = 7;
    }
    return Math.sqrt(sumSq / dims);
  }

  function buildPlainEnglishRationale(c, strategy, targetProperty, yBest) {
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

  function selectTopKExperiments(scoredPool, options) {
    const opts = options || {};
    const k = Math.max(1, Math.min(20, Math.round(opts.batchSize != null ? opts.batchSize : 5)));
    const env = ACTIVE_LEARNING_ENVELOPES[opts.processId];
    const sorted = scoredPool.slice().sort((a, b) => b.acquisitionScore - a.acquisitionScore);
    const targetProperty = opts.targetProperty || 'uts_mpa';
    const yBest = opts.yBest != null ? opts.yBest : PROCESS_Y_BEST_BASELINES[opts.processId][targetProperty];

    const selected = [];
    const usedIndices = new Set();
    const spacingTiers = [opts.minSpacing != null ? opts.minSpacing : 0.22, 0.15, 0.08, 0];

    for (let sIdx = 0; sIdx < spacingTiers.length; sIdx++) {
      if (selected.length >= k) break;
      const spacing = spacingTiers[sIdx];
      for (let i = 0; i < sorted.length; i++) {
        if (selected.length >= k) break;
        const cand = sorted[i];
        if (usedIndices.has(cand.candidateIndex)) continue;
        const farEnough = selected.every((sel) => normalizedParamDistance(cand.params, sel.params, env) >= spacing);
        if (farEnough) {
          selected.push(cand);
          usedIndices.add(cand.candidateIndex);
        }
      }
    }

    return selected.map((c, idx) => Object.assign({}, c, {
      rank: idx + 1,
      rationale: buildPlainEnglishRationale(c, opts.strategy, targetProperty, yBest)
    }));
  }

  function runActiveLearningPlanner(options) {
    const opts = options || {};
    const t0 = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
    const processId = normalizeActiveLearningProcessId(opts.processId);
    const strategy = opts.strategy === 'ei' || opts.strategy === 'pareto' ? opts.strategy : 'uncertainty';
    const targetProperty = opts.targetProperty || 'uts_mpa';
    const xi = clampFinite(opts.xi != null ? opts.xi : 0.05, 0.01, 0.15, 0.05);
    const batchSize = opts.batchSize === 3 || opts.batchSize === 10 ? opts.batchSize : 5;

    const rawCandidates = generateLhcCandidates(processId, {
      count: opts.candidateCount != null ? opts.candidateCount : 300,
      seed: opts.seed != null ? opts.seed : 42,
      includePostSearch: opts.includePostSearch !== false,
      defaultPostProcessing: opts.defaultPostProcessing || 'HIP'
    });

    const evaluated = rawCandidates.map((params, idx) => evaluateActiveLearningCandidate(params, idx, opts.calibratedModels));
    const scored = scoreActiveLearningCandidates(evaluated, {
      processId,
      strategy,
      targetProperty,
      xi,
      requireConductionWindow: opts.requireConductionWindow !== false,
      requireAstmElong: Boolean(opts.requireAstmElong),
      yBest: opts.baselineBestOverride ? opts.baselineBestOverride[targetProperty] : undefined
    });

    const recommendations = selectTopKExperiments(scored.feasiblePool, {
      processId,
      batchSize,
      strategy,
      targetProperty,
      yBest: scored.yBest
    });

    const t1 = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

    return {
      processId,
      strategy,
      targetProperty,
      xi,
      yBest: scored.yBest,
      totalGenerated: rawCandidates.length,
      feasibleCount: scored.feasiblePool.length,
      elapsedMs: Number((t1 - t0).toFixed(1)),
      pool: scored.feasiblePool,
      recommendations
    };
  }

  function exportActiveLearningCsv(recommendations) {
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
    (recommendations || []).forEach((rec, idx) => {
      const procTag = String(rec.params.processId || 'LPBF').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const sampleId = `NITT-AL-${procTag}-${String(idx + 1).padStart(2, '0')}`;
      rows.push([
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
      ].join(','));
    });
    return rows.join('\n');
  }

  // -------------------------------------------------------
  // Peer-Reviewed Proof & Literature Backing Strip
  // -------------------------------------------------------
  function getActiveLearningProofPapers() {
    const live = typeof window !== 'undefined' && Array.isArray(window.livePapersCatalog) && window.livePapersCatalog.length > 0
      ? window.livePapersCatalog
      : null;
    const base = typeof PAPERS_DATABASE !== 'undefined' && Array.isArray(PAPERS_DATABASE) ? PAPERS_DATABASE : [];
    const catalog = live || base;

    return catalog.filter((p) => {
      if (!p) return false;
      const top = String(p.topic || '').toLowerCase();
      return Boolean(p.active_learning_proof) || top.includes('active learning');
    });
  }

  function showInLiteratureTable() {
    if (typeof document === 'undefined') return;
    if (typeof switchTab === 'function') {
      switchTab('literature', document.getElementById('navBtnLit'));
    }
    const searchEl = document.getElementById('paperSearchInput');
    if (searchEl) searchEl.value = 'Active Learning';
    if (typeof currentProcessFilter !== 'undefined') currentProcessFilter = 'ALL';
    if (typeof currentTopicFilter !== 'undefined') currentTopicFilter = 'ALL';
    document.querySelectorAll('#view_literature .mp-toggle-btn').forEach((b) => {
      b.classList.toggle('active', b.id === 'btnFilterAll');
    });
    if (typeof filterPapersTable === 'function') {
      filterPapersTable();
    }
  }

  function renderProofCard(containerEl) {
    if (typeof document === 'undefined') return;
    const target = containerEl || document.getElementById('activeLearningProofGrid');
    if (!target) return;

    const papers = getActiveLearningProofPapers();
    const countEl = document.getElementById('activeLearningProofCountBadge');
    if (countEl) {
      countEl.textContent = `${papers.length} Scopus-Verified Papers`;
    }

    if (!papers.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size: 11.5px; color: #cbd5e1; padding: 10px 0;';
      empty.textContent = 'Run scripts/sync_active_learning_papers.mjs to populate verified Active Learning references.';
      target.replaceChildren(empty);
      return;
    }

    const cards = papers.map((p) => {
      const card = document.createElement('article');
      card.className = 'al-proof-item';
      card.style.cssText =
        'background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;';

      const topRow = document.createElement('div');
      topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;';

      const authorMeta = document.createElement('div');
      authorMeta.style.cssText = 'font-size: 12px; font-weight: 800; color: #f8fafc;';
      const idStr = p.id ? `${p.id} · ` : '';
      const journalStr = p.journal ? ` · ${p.journal}` : '';
      authorMeta.textContent = `${idStr}${p.author || 'Unknown'}${journalStr}`;

      const badgeGroup = document.createElement('div');
      badgeGroup.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; align-items: center;';

      const citeBadge = document.createElement('span');
      citeBadge.className = 'brand-badge';
      citeBadge.style.cssText = 'font-size: 10px; color: #6ee7b7; background: rgba(16, 185, 129, 0.16); border-color: rgba(16, 185, 129, 0.45);';
      const cites = Number.isFinite(Number(p.citedByCount)) ? Number(p.citedByCount) : null;
      citeBadge.textContent = cites !== null ? `Cited by ${cites}` : (p.treatment || 'Scopus Verified');
      badgeGroup.appendChild(citeBadge);

      if (p.process) {
        const procBadge = document.createElement('span');
        procBadge.className = 'brand-badge';
        procBadge.style.cssText = 'font-size: 10px; color: #bae6fd; background: rgba(56, 189, 248, 0.14); border-color: rgba(56, 189, 248, 0.38);';
        procBadge.textContent = p.process;
        badgeGroup.appendChild(procBadge);
      }

      topRow.appendChild(authorMeta);
      topRow.appendChild(badgeGroup);
      card.appendChild(topRow);

      if (p.acquisitionMethod) {
        const methodPill = document.createElement('div');
        methodPill.style.cssText = 'font-size: 10.5px; font-family: "JetBrains Mono", monospace; color: #ddd6fe; font-weight: 600;';
        methodPill.textContent = `Mode Basis: ${p.acquisitionMethod}`;
        card.appendChild(methodPill);
      }

      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size: 11px; color: #cbd5e1; line-height: 1.45;';
      descEl.textContent = p.desc || '';
      card.appendChild(descEl);

      const linksRow = document.createElement('div');
      linksRow.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 4px;';

      const safeDoi = p.doi ? sanitizeExternalHttpUrl(`https://doi.org/${String(p.doi).trim()}`) : '';
      if (safeDoi) {
        const doiA = document.createElement('a');
        doiA.href = safeDoi;
        doiA.target = '_blank';
        doiA.rel = 'noopener noreferrer';
        doiA.style.cssText = 'font-size: 11px; font-family: "JetBrains Mono", monospace; color: #7dd3fc; text-decoration: underline;';
        doiA.textContent = `DOI: ${p.doi} ↗`;
        linksRow.appendChild(doiA);
      }

      const safeOa = sanitizeExternalHttpUrl(p.oaUrl);
      if (safeOa) {
        const oaA = document.createElement('a');
        oaA.href = safeOa;
        oaA.target = '_blank';
        oaA.rel = 'noopener noreferrer';
        oaA.style.cssText = 'font-size: 11px; font-family: "JetBrains Mono", monospace; color: #6ee7b7; text-decoration: underline;';
        oaA.textContent = 'OA PDF ↗';
        linksRow.appendChild(oaA);
      }

      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'step-btn';
      jumpBtn.style.cssText = 'font-size: 10.5px; padding: 3px 9px; margin-left: auto; color: #e0f2fe; border-color: rgba(56, 189, 248, 0.45);';
      jumpBtn.textContent = 'View in Literature Tab →';
      jumpBtn.addEventListener('click', showInLiteratureTable);
      linksRow.appendChild(jumpBtn);

      card.appendChild(linksRow);
      return card;
    });

    target.replaceChildren(...cards);
  }

  // -------------------------------------------------------
  // Interactive Recommender DOM State & SVG Visualizer
  // -------------------------------------------------------
  const plannerState = {
    initialized: false,
    strategy: 'uncertainty',
    axisMode: 'auto', // 'auto' | 'pv' | 'pareto'
    selectedRank: 1,
    lastResult: null,
    seed: 42
  };

  function getActiveDashboardProcess() {
    if (typeof currentProcess !== 'undefined' && currentProcess) {
      return normalizeActiveLearningProcessId(currentProcess);
    }
    return 'lpbf';
  }

  function scoreToViridisColor(score) {
    const s = clampFinite(score, 0, 1, 0.5);
    if (s < 0.35) return '#3b82f6';
    if (s < 0.65) return '#06b6d4';
    if (s < 0.85) return '#10b981';
    return '#facc15';
  }

  function getVerifiedLiteraturePlotPoints(processId) {
    const catalog = (typeof window !== 'undefined' && Array.isArray(window.livePapersCatalog) && window.livePapersCatalog.length > 0)
      ? window.livePapersCatalog
      : (typeof PAPERS_DATABASE !== 'undefined' && Array.isArray(PAPERS_DATABASE) ? PAPERS_DATABASE : []);
    return catalog
      .filter((p) => {
        if (!p || p.active_learning_proof) return false;
        const proc = normalizeActiveLearningProcessId(p.process);
        const P = Number(p.P);
        const v = Number(p.v);
        return proc === processId && Number.isFinite(P) && Number.isFinite(v) && P > 0 && v > 0;
      })
      .slice(0, 60);
  }

  function createSvgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => el.setAttribute(k, String(attrs[k])));
    }
    return el;
  }

  function renderAcquisitionSvg(result) {
    if (typeof document === 'undefined' || !result) return;
    const svg = document.getElementById('alAcquisitionSvg');
    if (!svg) return;

    const effectiveAxis = plannerState.axisMode === 'auto'
      ? (result.strategy === 'pareto' ? 'pareto' : 'pv')
      : plannerState.axisMode;

    const axisBtn = document.getElementById('alAxisToggleBtn');
    if (axisBtn) {
      axisBtn.textContent = effectiveAxis === 'pareto'
        ? 'Axes: Predicted UTS vs Elongation (Switch to Process Space)'
        : (result.processId === 'binder-jetting'
          ? 'Axes: Sinter Temp vs Hold (Switch to UTS vs Elongation)'
          : 'Axes: Power P vs Speed v (Switch to UTS vs Elongation)');
    }

    const W = 640;
    const H = 280;
    const pad = { l: 58, r: 22, t: 22, b: 40 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;

    const getX = (c) => {
      if (effectiveAxis === 'pareto') return c.elongation.mean;
      return result.processId === 'binder-jetting' ? (c.params.sinterTempC || 1320) : c.params.v;
    };
    const getY = (c) => {
      if (effectiveAxis === 'pareto') return c.uts.mean;
      return result.processId === 'binder-jetting' ? (c.params.sinterHoldMin || 120) : c.params.P;
    };

    const pool = result.pool || [];
    const xs = pool.map(getX);
    const ys = pool.map(getY);
    const minX = xs.length ? Math.min(...xs) : 0;
    const maxX = xs.length ? Math.max(...xs) : 100;
    const minY = ys.length ? Math.min(...ys) : 0;
    const maxY = ys.length ? Math.max(...ys) : 100;
    const spanX = Math.max(1e-6, maxX - minX);
    const spanY = Math.max(1e-6, maxY - minY);

    const sx = (val) => pad.l + ((val - minX) / spanX) * iw;
    const sy = (val) => pad.t + ih - ((val - minY) / spanY) * ih;

    const nodes = [];
    // Background grid
    for (let i = 0; i <= 4; i++) {
      const gx = pad.l + (iw * i) / 4;
      const gy = pad.t + (ih * i) / 4;
      nodes.push(createSvgEl('line', { x1: gx, y1: pad.t, x2: gx, y2: pad.t + ih, stroke: 'rgba(148,163,184,0.14)', 'stroke-width': 1 }));
      nodes.push(createSvgEl('line', { x1: pad.l, y1: gy, x2: pad.l + iw, y2: gy, stroke: 'rgba(148,163,184,0.14)', 'stroke-width': 1 }));

      const xv = minX + (spanX * i) / 4;
      const xLbl = createSvgEl('text', { x: gx, y: H - 22, fill: '#cbd5e1', 'font-size': 10, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace' });
      xLbl.textContent = effectiveAxis === 'pareto' ? xv.toFixed(1) : Math.round(xv).toString();
      nodes.push(xLbl);

      const yv = maxY - (spanY * i) / 4;
      const yLbl = createSvgEl('text', { x: pad.l - 8, y: gy + 3, fill: '#cbd5e1', 'font-size': 10, 'text-anchor': 'end', 'font-family': 'JetBrains Mono, monospace' });
      yLbl.textContent = Math.round(yv).toString();
      nodes.push(yLbl);
    }

    // Axes lines
    nodes.push(createSvgEl('line', { x1: pad.l, y1: pad.t + ih, x2: pad.l + iw, y2: pad.t + ih, stroke: '#64748b', 'stroke-width': 1.5, class: 'fx-svg-draw' }));
    nodes.push(createSvgEl('line', { x1: pad.l, y1: pad.t, x2: pad.l, y2: pad.t + ih, stroke: '#64748b', 'stroke-width': 1.5, class: 'fx-svg-draw' }));

    const xTitle = createSvgEl('text', { x: pad.l + iw / 2, y: H - 5, fill: '#94a3b8', 'font-size': 10.5, 'font-weight': 700, 'text-anchor': 'middle' });
    xTitle.textContent = effectiveAxis === 'pareto'
      ? 'Predicted Elongation (%)'
      : (result.processId === 'binder-jetting' ? 'Sintering Temperature (°C)' : 'Scan / Travel Speed v (mm/s)');
    nodes.push(xTitle);

    const yTitle = createSvgEl('text', { x: 14, y: pad.t + ih / 2, fill: '#94a3b8', 'font-size': 10.5, 'font-weight': 700, 'text-anchor': 'middle', transform: `rotate(-90 14 ${pad.t + ih / 2})` });
    yTitle.textContent = effectiveAxis === 'pareto'
      ? 'Predicted UTS (MPa)'
      : (result.processId === 'binder-jetting' ? 'Hold Time (min)' : 'Laser / Arc Power P (W)');
    nodes.push(yTitle);

    // Reference literature points (when in P vs v mode)
    if (effectiveAxis === 'pv' && result.processId !== 'binder-jetting') {
      const litPts = getVerifiedLiteraturePlotPoints(result.processId);
      litPts.forEach((lp) => {
        const cx = sx(clampFinite(Number(lp.v), minX, maxX, minX));
        const cy = sy(clampFinite(Number(lp.P), minY, maxY, minY));
        nodes.push(createSvgEl('circle', {
          cx: cx.toFixed(1),
          cy: cy.toFixed(1),
          r: 3.1,
          fill: 'rgba(148, 163, 184, 0.35)',
          stroke: 'rgba(226, 232, 240, 0.5)',
          'stroke-width': 0.8
        }));
      });
    }

    // Candidate pool colored by acquisition score
    pool.forEach((c) => {
      const cx = sx(getX(c));
      const cy = sy(getY(c));
      const color = scoreToViridisColor(c.acquisitionScore);
      nodes.push(createSvgEl('circle', {
        cx: cx.toFixed(1),
        cy: cy.toFixed(1),
        r: (2.6 + c.acquisitionScore * 2.2).toFixed(1),
        fill: color,
        'fill-opacity': (0.28 + c.acquisitionScore * 0.5).toFixed(2)
      }));
    });

    // Selected batch ranked markers (clickable, accessible, zero <title> tag)
    (result.recommendations || []).forEach((rec) => {
      const cx = sx(getX(rec));
      const cy = sy(getY(rec));
      const isSelected = plannerState.selectedRank === rec.rank;
      const g = createSvgEl('g', {
        class: 'al-svg-marker',
        tabindex: '0',
        role: 'button',
        'aria-label': `Recommendation Rank ${rec.rank}: ${rec.rationale}`,
        'data-rank': rec.rank,
        'data-tooltip': `#${rec.rank} · Score ${(rec.acquisitionScore * 100).toFixed(0)} · UTS ${rec.uts.mean}±${rec.uts.pi95} MPa · El ${rec.elongation.mean}±${rec.elongation.pi95}%`
      });
      g.style.cursor = 'pointer';

      const halo = createSvgEl('circle', {
        cx: cx.toFixed(1),
        cy: cy.toFixed(1),
        r: isSelected ? 13 : 10,
        fill: 'rgba(250, 204, 21, 0.22)',
        stroke: isSelected ? '#ffffff' : '#fde047',
        'stroke-width': isSelected ? 2 : 1.4
      });
      g.appendChild(halo);

      // 4-point star diamond around point
      const rOuter = isSelected ? 9 : 7.5;
      const rInner = 3.2;
      const pts = [];
      for (let k = 0; k < 8; k++) {
        const ang = (Math.PI / 4) * k - Math.PI / 2;
        const rr = k % 2 === 0 ? rOuter : rInner;
        pts.push(`${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`);
      }
      g.appendChild(createSvgEl('polygon', {
        points: pts.join(' '),
        fill: '#facc15',
        stroke: '#0f172a',
        'stroke-width': 1
      }));

      const label = createSvgEl('text', {
        x: (cx + 12).toFixed(1),
        y: (cy - 7).toFixed(1),
        fill: '#fef08a',
        'font-size': 11,
        'font-weight': 800,
        'font-family': 'JetBrains Mono, monospace'
      });
      label.textContent = `#${rec.rank}`;
      g.appendChild(label);

      const activateMarker = () => highlightRecommendedRow(rec.rank, g.getAttribute('data-tooltip'));
      g.addEventListener('click', activateMarker);
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activateMarker();
        }
      });

      nodes.push(g);
    });

    svg.replaceChildren(...nodes);
    if (typeof window !== 'undefined' && window.UiMotion && typeof window.UiMotion.triggerSvgStrokeDraw === 'function') {
      window.UiMotion.triggerSvgStrokeDraw(svg);
    }
  }

  function highlightRecommendedRow(rank, tooltipText) {
    plannerState.selectedRank = rank;
    if (typeof document === 'undefined') return;
    document.querySelectorAll('#alResultsTableBody tr').forEach((tr) => {
      const match = Number(tr.getAttribute('data-rank')) === rank;
      tr.style.background = match ? 'rgba(56, 189, 248, 0.14)' : '';
      tr.style.outline = match ? '1px solid rgba(56, 189, 248, 0.55)' : '';
    });
    const tipEl = document.getElementById('alSvgTooltip');
    if (tipEl && tooltipText) {
      tipEl.textContent = tooltipText;
      tipEl.style.display = 'block';
    }
    if (plannerState.lastResult) {
      renderAcquisitionSvg(plannerState.lastResult);
    }
  }

  function showActionToast(msg) {
    if (typeof document === 'undefined') return;
    const toast = document.getElementById('alActionToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'inline-flex';
  }

  function loadRecommendationIntoSliders(rec) {
    if (!rec || typeof document === 'undefined') return;
    const p = rec.params;
    const pillMap = { lpbf: 0, 'ded-laser': 1, waam: 2, 'binder-jetting': 3 };
    const pills = document.querySelectorAll('.process-pill');
    const targetPill = document.querySelector(`.process-pill[onclick*="'${p.processId}'"]`) || pills[pillMap[p.processId] != null ? pillMap[p.processId] : 0];

    const currProc = typeof currentProcess !== 'undefined' ? normalizeActiveLearningProcessId(currentProcess) : 'lpbf';
    if (typeof selectProcess === 'function' && p.processId !== currProc) {
      selectProcess(p.processId, targetPill);
    }

    const postSel = document.getElementById('postProcessingSelect');
    if (postSel) postSel.value = p.post;
    if (typeof syncMaterialStateUiFromPost === 'function') {
      syncMaterialStateUiFromPost(p.post);
    }

    const prevAuto = typeof autoSync !== 'undefined' ? autoSync : false;
    if (typeof autoSync !== 'undefined') autoSync = false;

    const setInput = (id, val) => {
      const el = document.getElementById(id);
      if (!el || !Number.isFinite(Number(val))) return;
      const min = Number(el.min);
      const max = Number(el.max);
      let clamped = Number(val);
      if (Number.isFinite(min)) clamped = Math.max(min, clamped);
      if (Number.isFinite(max)) clamped = Math.min(max, clamped);
      el.value = String(clamped);
    };

    if (typeof tweakSlider === 'function') {
      tweakSlider('sl_p', p.P, true);
      tweakSlider('sl_v', p.v, true);
      tweakSlider('sl_h', p.h, true);
      tweakSlider('sl_t', p.t, true);
      tweakSlider('sl_preheat', p.T0, true);
    } else {
      setInput('sl_p', p.P);
      setInput('sl_v', p.v);
      setInput('sl_h', p.h);
      setInput('sl_t', p.t);
      setInput('sl_preheat', p.T0);
    }

    if (typeof autoSync !== 'undefined') autoSync = prevAuto;
    if (typeof calculatePhysics === 'function') calculatePhysics();
    showActionToast(`Loaded Rank #${rec.rank} (${p.processId.toUpperCase()} · P=${p.P}W, v=${p.v}mm/s, ${p.post}) into live sliders & updated KPIs.`);
  }

  function renderRecommendationsTable(result) {
    if (typeof document === 'undefined' || !result) return;
    const tbody = document.getElementById('alResultsTableBody');
    const metaEl = document.getElementById('alPlannerMeta');
    if (metaEl) {
      const stratLabel = result.strategy === 'ei' ? 'Expected Improvement' : (result.strategy === 'pareto' ? 'Pareto Front' : 'Adaptive Uncertainty');
      metaEl.textContent = `${result.processId.toUpperCase()} · ${stratLabel} · ${result.feasibleCount}/${result.totalGenerated} printable LHC candidates (${result.elapsedMs} ms)`;
    }
    if (!tbody) return;

    const recs = result.recommendations || [];
    if (!recs.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.style.cssText = 'color: #cbd5e1; text-align: center; padding: 14px;';
      td.textContent = 'No candidates matched active constraints — try disabling strict conduction or ASTM filters.';
      tr.appendChild(td);
      tbody.replaceChildren(tr);
      return;
    }

    const rows = recs.map((rec) => {
      const tr = document.createElement('tr');
      tr.id = `alRow_${rec.rank}`;
      tr.setAttribute('data-rank', String(rec.rank));
      if (plannerState.selectedRank === rec.rank) {
        tr.style.background = 'rgba(56, 189, 248, 0.12)';
      }

      const tdRank = document.createElement('td');
      tdRank.style.cssText = 'font-weight: 800; font-family: "JetBrains Mono", monospace; color: #fde047; white-space: nowrap;';
      tdRank.textContent = `#${rec.rank} (${(rec.acquisitionScore * 100).toFixed(0)}%)`;
      tr.appendChild(tdRank);

      const tdParams = document.createElement('td');
      tdParams.style.cssText = 'font-family: "JetBrains Mono", monospace; font-size: 11px; color: #f8fafc; min-width: 170px;';
      const p = rec.params;
      tdParams.textContent = p.processId === 'binder-jetting'
        ? `Sinter ${p.sinterTempC}°C / ${p.sinterHoldMin}m · P=${p.P}W · t=${p.t}µm · ${p.post}`
        : `P=${p.P}W · v=${p.v}mm/s · h=${p.h}µm · t=${p.t}µm · T₀=${p.T0}°C · ${p.post}`;
      tr.appendChild(tdParams);

      const tdPred = document.createElement('td');
      tdPred.style.cssText = 'font-family: "JetBrains Mono", monospace; font-size: 11px; color: #e2e8f0; min-width: 185px;';
      tdPred.textContent = `UTS ${rec.uts.mean}±${rec.uts.pi95} MPa · El ${rec.elongation.mean}±${rec.elongation.pi95}% · ${rec.hv.mean}±${rec.hv.pi95} HV`;
      tr.appendChild(tdPred);

      const tdRegime = document.createElement('td');
      tdRegime.style.cssText = 'font-size: 11px; min-width: 120px;';
      const regSpan = document.createElement('span');
      regSpan.style.cssText = rec.regimeSeverity === 'optimal'
        ? 'color: #6ee7b7; font-weight: 700;'
        : (rec.regimeSeverity === 'warning' ? 'color: #fcd34d; font-weight: 700;' : 'color: #fca5a5; font-weight: 700;');
      regSpan.textContent = `${rec.regimeLabel} · d_M=${rec.dM}`;
      tdRegime.appendChild(regSpan);
      tr.appendChild(tdRegime);

      const tdWhy = document.createElement('td');
      tdWhy.style.cssText = 'font-size: 11px; color: #cbd5e1; line-height: 1.4; min-width: 210px;';
      tdWhy.textContent = rec.rationale;
      tr.appendChild(tdWhy);

      const tdAct = document.createElement('td');
      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'step-btn';
      loadBtn.style.cssText = 'font-size: 11px; font-weight: 700; color: #e0f2fe; border-color: rgba(56, 189, 248, 0.55); background: rgba(14, 165, 233, 0.16); padding: 5px 10px; white-space: nowrap;';
      loadBtn.textContent = 'Load into Sliders';
      loadBtn.addEventListener('click', () => {
        highlightRecommendedRow(rec.rank);
        loadRecommendationIntoSliders(rec);
      });
      tdAct.appendChild(loadBtn);
      tr.appendChild(tdAct);

      return tr;
    });

    tbody.replaceChildren(...rows);
  }

  function readPlannerDomOptions() {
    if (typeof document === 'undefined') return {};
    const targetEl = document.getElementById('alTargetSelect');
    const xiEl = document.getElementById('alXiSlider');
    const batchEl = document.getElementById('alBatchSelect');
    const condEl = document.getElementById('alReqConduction');
    const astmEl = document.getElementById('alReqAstm');
    const postEl = document.getElementById('alIncludePost');
    const defaultPostEl = document.getElementById('postProcessingSelect');

    const xi = xiEl ? parseFloat(xiEl.value) : 0.05;
    const xiReadout = document.getElementById('alXiReadout');
    if (xiReadout) xiReadout.textContent = xi.toFixed(2);

    const eiControls = document.getElementById('alEiControlsWrap');
    if (eiControls) {
      eiControls.style.display = plannerState.strategy === 'ei' ? 'contents' : 'none';
    }

    return {
      processId: getActiveDashboardProcess(),
      strategy: plannerState.strategy,
      targetProperty: targetEl ? targetEl.value : 'uts_mpa',
      xi,
      batchSize: batchEl ? parseInt(batchEl.value, 10) : 5,
      requireConductionWindow: condEl ? Boolean(condEl.checked) : true,
      requireAstmElong: astmEl ? Boolean(astmEl.checked) : true,
      includePostSearch: postEl ? Boolean(postEl.checked) : true,
      defaultPostProcessing: defaultPostEl ? defaultPostEl.value : 'HIP',
      seed: plannerState.seed,
      calibratedModels: typeof window !== 'undefined' ? window.CALIBRATED_MODELS : undefined
    };
  }

  function recomputeAndRender() {
    plannerState.initialized = true;
    const opts = readPlannerDomOptions();
    const res = runActiveLearningPlanner(opts);
    plannerState.lastResult = res;
    plannerState.selectedRank = 1;
    renderRecommendationsTable(res);
    renderAcquisitionSvg(res);
    return res;
  }

  function downloadActiveLearningCsv() {
    if (typeof document === 'undefined') return;
    if (!plannerState.lastResult) recomputeAndRender();
    const recs = plannerState.lastResult ? plannerState.lastResult.recommendations : [];
    const csv = exportActiveLearningCsv(recs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ti64_active_learning_coupons_${getActiveDashboardProcess()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showActionToast(`Exported ${recs.length} coupons to CSV with blank measured_* columns ready for LabCalibrationPanel.`);
  }

  function setStrategy(strat, btnEl) {
    plannerState.strategy = strat === 'ei' || strat === 'pareto' ? strat : 'uncertainty';
    if (typeof document !== 'undefined') {
      const track = document.getElementById('alStrategyTrack');
      if (track) {
        track.querySelectorAll('.al-strategy-btn').forEach((b) => {
          const isMatch = b === btnEl || b.getAttribute('data-strategy') === plannerState.strategy;
          b.classList.toggle('active', isMatch);
          b.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
        });
        if (window.UiMotion && typeof window.UiMotion.syncSegmentedGlider === 'function') {
          window.UiMotion.syncSegmentedGlider(track);
        }
      }
      const body = document.getElementById('alPlannerBody');
      if (body && window.UiMotion && typeof window.UiMotion.animateCurtainEnter === 'function') {
        window.UiMotion.animateCurtainEnter(body);
      }
    }
    recomputeAndRender();
  }

  function initPlanner(forceExpand) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('activeLearningPlannerCard');
    const body = document.getElementById('alPlannerBody');
    if (!card || !body) return;

    if (forceExpand) {
      body.style.display = 'block';
    }

    if (!card.dataset.alBound) {
      card.dataset.alBound = '1';
      const track = document.getElementById('alStrategyTrack');
      if (track && window.UiMotion && typeof window.UiMotion.initSegmentedTrack === 'function') {
        window.UiMotion.initSegmentedTrack(track);
      }

      document.querySelectorAll('.al-strategy-btn').forEach((btn) => {
        btn.addEventListener('click', () => setStrategy(btn.getAttribute('data-strategy'), btn));
      });

      const runBtn = document.getElementById('alRunBtn');
      if (runBtn) runBtn.addEventListener('click', recomputeAndRender);

      const csvBtn = document.getElementById('alExportCsvBtn');
      if (csvBtn) csvBtn.addEventListener('click', downloadActiveLearningCsv);

      const axisBtn = document.getElementById('alAxisToggleBtn');
      if (axisBtn) {
        axisBtn.addEventListener('click', () => {
          const eff = plannerState.axisMode === 'auto'
            ? (plannerState.strategy === 'pareto' ? 'pareto' : 'pv')
            : plannerState.axisMode;
          plannerState.axisMode = eff === 'pareto' ? 'pv' : 'pareto';
          if (plannerState.lastResult) renderAcquisitionSvg(plannerState.lastResult);
        });
      }

      const xiEl = document.getElementById('alXiSlider');
      if (xiEl) {
        xiEl.addEventListener('input', () => {
          const readout = document.getElementById('alXiReadout');
          if (readout) readout.textContent = parseFloat(xiEl.value).toFixed(2);
        });
        xiEl.addEventListener('change', recomputeAndRender);
      }

      ['alTargetSelect', 'alBatchSelect', 'alReqConduction', 'alReqAstm', 'alIncludePost'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', recomputeAndRender);
      });
    }

    if (window.UiMotion && typeof window.UiMotion.animateCurtainEnter === 'function') {
      window.UiMotion.animateCurtainEnter(body);
    }

    recomputeAndRender();
  }

  function jumpToPlanner() {
    if (typeof document === 'undefined') return;
    if (typeof switchTab === 'function') {
      switchTab('active-learning', document.getElementById('navBtnActiveLearning'));
    }
    initPlanner(true);
    const card = document.getElementById('activeLearningPlannerCard');
    if (card && typeof card.scrollIntoView === 'function') {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function onProcessChanged() {
    if (plannerState.initialized) {
      recomputeAndRender();
    }
  }

  function bindLazyTriggers() {
    if (typeof document === 'undefined') return;
    renderProofCard();

    const quickJump = document.getElementById('btnJumpActiveLearningPlanner');
    if (quickJump && !quickJump.dataset.alBound) {
      quickJump.dataset.alBound = '1';
      quickJump.addEventListener('click', jumpToPlanner);
    }

    const openBtn = document.getElementById('alRunBtn');
    if (openBtn && !openBtn.dataset.alLazyBound) {
      openBtn.dataset.alLazyBound = '1';
      openBtn.addEventListener('click', () => initPlanner(true));
    }

    const alView = document.getElementById('view_active-learning');
    if (alView && alView.classList.contains('active')) {
      initPlanner(true);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindLazyTriggers);
    } else {
      bindLazyTriggers();
    }
  }

  return {
    ACTIVE_LEARNING_ENVELOPES,
    normalizeActiveLearningProcessId,
    sanitizeHttpUrl,
    sanitizeExternalHttpUrl,
    formatSafeCsvCell,
    normalPdf,
    normalCdf,
    computeExpectedImprovement,
    generateLhcCandidates,
    evaluateActiveLearningCandidate,
    assignParetoRanks,
    scoreActiveLearningCandidates,
    selectTopKExperiments,
    runActiveLearningPlanner,
    exportActiveLearningCsv,
    getActiveLearningProofPapers,
    renderProofCard,
    showInLiteratureTable,
    initPlanner,
    jumpToPlanner,
    onProcessChanged,
    loadRecommendationIntoSliders,
    recomputeAndRender
  };
});
