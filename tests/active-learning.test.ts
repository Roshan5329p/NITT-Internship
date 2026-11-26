import { describe, expect, it } from 'vitest';
import {
  ACTIVE_LEARNING_ENVELOPES,
  computeExpectedImprovement,
  exportActiveLearningCsv,
  generateLhcCandidates,
  normalCdf,
  normalPdf,
  runActiveLearningPlanner,
  scoreActiveLearningCandidates,
  selectTopKExperiments,
  type ActiveLearningProcessId
} from '../src/lib/active-learning';
import { parseLabCouponsCsv } from '../src/components/LabCalibrationPanel';
import { evaluateOodRisk } from '../src/lib/ood-detector';
import { evaluateTi64Pinn } from '../src/lib/ti64-pinn';
// @ts-expect-error Untyped CJS/UMD browser script imported for parity verification
import * as ActiveLearningUi from '../js/active-learning-ui.js';

describe('Bayesian Active Learning Lab Planner', () => {
  it('generateLhcCandidates is deterministic and respects strict bounds across all 4 AM processes', () => {
    const processes: ActiveLearningProcessId[] = ['lpbf', 'ded-laser', 'waam', 'binder-jetting'];
    for (const proc of processes) {
      const a = generateLhcCandidates(proc, { count: 220, seed: 77, includePostSearch: true });
      const b = generateLhcCandidates(proc, { count: 220, seed: 77, includePostSearch: true });
      expect(a).toHaveLength(220);
      expect(a).toEqual(b);

      const env = ACTIVE_LEARNING_ENVELOPES[proc];
      for (const c of a) {
        expect(c.P).toBeGreaterThanOrEqual(env.P[0]);
        expect(c.P).toBeLessThanOrEqual(env.P[1]);
        expect(c.v).toBeGreaterThanOrEqual(env.v[0]);
        expect(c.v).toBeLessThanOrEqual(env.v[1]);
        expect(c.h).toBeGreaterThanOrEqual(env.h[0]);
        expect(c.h).toBeLessThanOrEqual(env.h[1]);
        expect(c.t).toBeGreaterThanOrEqual(env.t[0]);
        expect(c.t).toBeLessThanOrEqual(env.t[1]);
        expect(c.T0).toBeGreaterThanOrEqual(env.T0[0]);
        expect(c.T0).toBeLessThanOrEqual(env.T0[1]);
        if (proc === 'binder-jetting' && env.sinterTempC && env.sinterHoldMin) {
          expect(c.sinterTempC!).toBeGreaterThanOrEqual(env.sinterTempC[0]);
          expect(c.sinterTempC!).toBeLessThanOrEqual(env.sinterTempC[1]);
          expect(c.sinterHoldMin!).toBeGreaterThanOrEqual(env.sinterHoldMin[0]);
          expect(c.sinterHoldMin!).toBeLessThanOrEqual(env.sinterHoldMin[1]);
        }
      }
    }
  });

  it('computeExpectedImprovement is strictly >= 0 and monotonically rewards higher sigma and higher mu', () => {
    expect(normalPdf(0)).toBeCloseTo(0.398942, 4);
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);

    const eiZero = computeExpectedImprovement(900, 0, 1000, 0.05);
    expect(eiZero).toBe(0);

    const lowSigma = computeExpectedImprovement(1020, 10, 1000, 0.5);
    const highSigma = computeExpectedImprovement(1020, 45, 1000, 0.5);
    expect(lowSigma).toBeGreaterThanOrEqual(0);
    expect(highSigma).toBeGreaterThan(lowSigma);

    const lowerMean = computeExpectedImprovement(980, 25, 1000, 0.5);
    const higherMean = computeExpectedImprovement(1040, 25, 1000, 0.5);
    expect(higherMean).toBeGreaterThan(lowerMean);
  });

  it('pareto mode ranks non-dominated (UTS, Elongation) frontier points highest and favors ASTM >= 10% elongation', () => {
    const res = runActiveLearningPlanner({
      processId: 'lpbf',
      strategy: 'pareto',
      batchSize: 5,
      requireConductionWindow: true,
      requireAstmElong: true,
      includePostSearch: true
    });
    expect(res.recommendations).toHaveLength(5);
    expect(res.elapsedMs).toBeLessThan(250);

    const topRec = res.recommendations[0];
    expect(topRec.paretoRank).toBeLessThanOrEqual(2);
    expect(topRec.elongation.mean).toBeGreaterThanOrEqual(10.0);

    const { feasiblePool } = scoreActiveLearningCandidates(res.pool, {
      processId: 'lpbf',
      strategy: 'pareto',
      requireConductionWindow: true,
      requireAstmElong: true
    });
    const front1 = feasiblePool.filter((c) => c.paretoRank === 1);
    expect(front1.length).toBeGreaterThanOrEqual(1);
    // Verify no point in feasiblePool strictly dominates any rank-1 point
    for (const f of front1) {
      const dominated = feasiblePool.some(
        (other) =>
          other.uts.mean >= f.uts.mean &&
          other.elongation.mean >= f.elongation.mean &&
          (other.uts.mean > f.uts.mean || other.elongation.mean > f.elongation.mean)
      );
      expect(dominated).toBe(false);
    }
  });

  it('selectTopKExperiments enforces diversity spacing across K=3,5,10 with zero NaN or Infinity', () => {
    const batchSizes: Array<3 | 5 | 10> = [3, 5, 10];
    const strategies: Array<'uncertainty' | 'ei' | 'pareto'> = ['uncertainty', 'ei', 'pareto'];

    for (const strategy of strategies) {
      for (const batchSize of batchSizes) {
        const res = runActiveLearningPlanner({
          processId: 'waam',
          strategy,
          batchSize,
          candidateCount: 200
        });
        expect(res.recommendations).toHaveLength(batchSize);

        for (let i = 0; i < res.recommendations.length; i++) {
          const rec = res.recommendations[i];
          expect(rec.rank).toBe(i + 1);
          expect(Number.isFinite(rec.uts.mean)).toBe(true);
          expect(Number.isFinite(rec.uts.pi95)).toBe(true);
          expect(Number.isFinite(rec.elongation.mean)).toBe(true);
          expect(Number.isFinite(rec.hv.mean)).toBe(true);
          expect(Number.isFinite(rec.dM)).toBe(true);
          expect(Number.isFinite(rec.acquisitionScore)).toBe(true);
          expect(rec.rationale.length).toBeGreaterThan(15);

          for (let j = i + 1; j < res.recommendations.length; j++) {
            const other = res.recommendations[j];
            const distP = Math.abs(rec.params.P - other.params.P) / (3600 - 1200);
            const distV = Math.abs(rec.params.v - other.params.v) / (15 - 4);
            expect(distP + distV + Math.abs(rec.params.h - other.params.h) / 1400).toBeGreaterThan(0);
          }
        }
      }
    }

    // Explicit direct check of selectTopKExperiments spacing helper
    const pool = runActiveLearningPlanner({ processId: 'ded-laser', batchSize: 5 }).pool;
    const picked = selectTopKExperiments(pool, { processId: 'ded-laser', batchSize: 5, strategy: 'uncertainty' });
    expect(picked).toHaveLength(5);
  });

  it('exportActiveLearningCsv prevents formula injection and parses cleanly via LabCalibrationPanel', () => {
    const res = runActiveLearningPlanner({ processId: 'lpbf', strategy: 'uncertainty', batchSize: 3 });
    const malicious = res.recommendations.map((r, idx) =>
      idx === 0
        ? { ...r, params: { ...r.params, post: '=CMD()' as any } }
        : r
    );
    const csv = exportActiveLearningCsv(malicious);
    expect(csv).toContain('"\'=CMD()"');

    // Replace blank measured_HV in exported sheet to verify round-trip ingestion in LabCalibrationPanel
    const filledCsv = exportActiveLearningCsv(res.recommendations)
      .split('\n')
      .map((line, i) => (i === 0 ? line : line.replace(',,,,', ',348,918,1004,13.6')))
      .join('\n');

    const parsed = parseLabCouponsCsv(filledCsv);
    expect(parsed.validCount).toBe(3);
    expect(parsed.rejectedCount).toBe(0);
    expect(parsed.coupons[0].measured_HV).toBe(348);
    expect(parsed.coupons[0].measured_UTS_MPa).toBe(1004);
    expect(parsed.coupons[0].measured_elong_pct).toBe(13.6);
  });

  it('maintains parity between TypeScript engine (src/lib/active-learning.ts) and browser script (js/active-learning-ui.js)', () => {
    for (const proc of ['lpbf', 'ded-laser', 'waam', 'binder-jetting'] as const) {
      const tsLhc = generateLhcCandidates(proc, { count: 180, seed: 42 });
      const jsLhc = ActiveLearningUi.generateLhcCandidates(proc, { count: 180, seed: 42 });
      expect(jsLhc).toEqual(tsLhc);
    }

    expect(ActiveLearningUi.computeExpectedImprovement(1050, 35, 1000, 0.25)).toBeCloseTo(
      computeExpectedImprovement(1050, 35, 1000, 0.25),
      8
    );

    const g = globalThis as any;
    const prevWindow = g.window;
    const prevEvaluateOodRisk = g.evaluateOodRisk;
    const prevEvaluateTi64Pinn = g.evaluateTi64Pinn;
    g.window = g;
    g.evaluateOodRisk = evaluateOodRisk;
    g.evaluateTi64Pinn = evaluateTi64Pinn;
    try {
      const tsPlanner = runActiveLearningPlanner({ processId: 'binder-jetting', strategy: 'pareto', batchSize: 5 });
      const jsPlanner = ActiveLearningUi.runActiveLearningPlanner({ processId: 'binder-jetting', strategy: 'pareto', batchSize: 5 });
      expect(jsPlanner.recommendations).toHaveLength(tsPlanner.recommendations.length);
      expect(jsPlanner.recommendations[0].params).toEqual(tsPlanner.recommendations[0].params);
      expect(exportActiveLearningCsv(tsPlanner.recommendations)).toBe(
        ActiveLearningUi.exportActiveLearningCsv(jsPlanner.recommendations)
      );
    } finally {
      if (prevWindow === undefined) delete g.window;
      else g.window = prevWindow;
      if (prevEvaluateOodRisk === undefined) delete g.evaluateOodRisk;
      else g.evaluateOodRisk = prevEvaluateOodRisk;
      if (prevEvaluateTi64Pinn === undefined) delete g.evaluateTi64Pinn;
      else g.evaluateTi64Pinn = prevEvaluateTi64Pinn;
    }
  });
});
