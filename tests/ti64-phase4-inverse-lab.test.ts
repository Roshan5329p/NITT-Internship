import { describe, expect, it } from 'vitest';
import {
  evaluateForwardTi64Candidate,
  solveInverseTi64Recipes
} from '../src/lib/inverse-solver';
import {
  applyBayesianBiasCorrection,
  computeLabCalibrationStats,
  parseLabCouponsCsv,
  SAMPLE_LAB_CSV_TEMPLATE
} from '../src/components/LabCalibrationPanel';

describe('Ti-6Al-4V Inverse Recipe Solver & Lab Calibration Loop (Phase 4)', () => {
  it('solves aerospace preset (YS>=850, Elong>=12%, Stress<=60, BuildRate>=20) with Pareto candidates satisfying all constraints', () => {
    const res = solveInverseTi64Recipes({
      minYsMpa: 850,
      minElongPct: 12.0,
      maxResidualStressMpa: 60,
      minBuildRateCm3H: 20.0,
      alloyId: 'ti64_gr5',
      astmStandard: 'F2924',
      processScope: 'all'
    });

    expect(res.failureReason).toBeNull();
    expect(res.candidates.length).toBeGreaterThanOrEqual(3);
    expect(res.candidates.length).toBeLessThanOrEqual(5);
    expect(res.elapsedMs).toBeLessThan(250);

    for (const c of res.candidates) {
      expect(c.yieldStrengthMpa).toBeGreaterThanOrEqual(850);
      expect(c.elongationPct).toBeGreaterThanOrEqual(12.0);
      expect(c.residualStressMpa).toBeLessThanOrEqual(60);
      expect(c.buildRateCm3H).toBeGreaterThanOrEqual(20.0);
      expect(c.astmCompliant).toBe(true);
      expect(c.mahalanobisDistance).toBeLessThanOrEqual(3.5);

      // Re-verify candidate through forward physics evaluator
      const recheck = evaluateForwardTi64Candidate({
        processId: c.processId,
        alloyId: 'ti64_gr5',
        P: c.P,
        v: c.v,
        h: c.h,
        t: c.t,
        db: c.db,
        T0: c.T0,
        postProcessing: c.postProcessing,
        oxygenWtPct: 0.16,
        buildOrientationDeg: 0,
        scanRotationDeg: 67
      });
      expect(recheck.yieldStrengthMpa).toBe(c.yieldStrengthMpa);
      expect(recheck.buildRateCm3H).toBe(c.buildRateCm3H);
    }

    // Also confirm LPBF-only precision mode still finds feasible high-rate recipes >= 20 cm³/h
    const lpbfOnly = solveInverseTi64Recipes({
      minYsMpa: 850,
      minElongPct: 12.0,
      maxResidualStressMpa: 60,
      minBuildRateCm3H: 20.0,
      alloyId: 'ti64_gr5',
      astmStandard: 'F2924',
      processScope: 'lpbf'
    });
    expect(lpbfOnly.candidates.length).toBeGreaterThanOrEqual(1);
    for (const c of lpbfOnly.candidates) {
      expect(c.processId).toBe('lpbf');
      expect(c.buildRateCm3H).toBeGreaterThanOrEqual(20.0);
    }
  });

  it('returns clear explanation when constraints are physically unattainable', () => {
    const impossible = solveInverseTi64Recipes({
      minYsMpa: 2400,
      minElongPct: 20.0,
      maxResidualStressMpa: 15,
      minBuildRateCm3H: 100.0,
      alloyId: 'ti64_eli',
      astmStandard: 'F3001'
    });
    expect(impossible.feasibleCount).toBe(0);
    expect(impossible.candidates).toHaveLength(0);
    expect(impossible.failureReason).toBeTruthy();
  });

  it('parses valid lab CSVs and rejects malformed rows gracefully without NaNs', () => {
    const valid = parseLabCouponsCsv(SAMPLE_LAB_CSV_TEMPLATE);
    expect(valid.validCount).toBe(4);
    expect(valid.rejectedCount).toBe(0);
    expect(valid.errors).toHaveLength(0);

    const mixedCsv = [
      'sample_id,process,P_W,v_mm_s,h_um,t_um,T0_C,post_proc,measured_HV,measured_YS_MPa,measured_UTS_MPa,measured_elong_pct',
      'GOOD-01,lpbf,280,960,110,40,200,HIP,345,915,998,14.5',
      'BAD-PROC,extrusion,280,960,110,40,200,HIP,345,915,998,14.5',
      'BAD-NUM,lpbf,-100,960,110,40,200,HIP,345,915,998,14.5',
      'BAD-MEAS,lpbf,280,960,110,40,200,HIP,abc,915,998,14.5',
      'NO-MEAS,lpbf,280,960,110,40,200,HIP,,,,'
    ].join('\n');

    const mixed = parseLabCouponsCsv(mixedCsv);
    expect(mixed.validCount).toBe(1);
    expect(mixed.rejectedCount).toBe(4);
    expect(mixed.coupons[0].sample_id).toBe('GOOD-01');
    expect(mixed.errors.map(e => e.rowNumber)).toEqual([3, 4, 5, 6]);

    expect(parseLabCouponsCsv('').validCount).toBe(0);
    expect(parseLabCouponsCsv('wrong,header\n1,2').errors[0].reason).toContain('Missing required CSV columns');
  });

  it('computes MAE, RMSE, mean bias and Empirical-Bayes shrinkage correction from lab coupons', () => {
    const parsed = parseLabCouponsCsv(SAMPLE_LAB_CSV_TEMPLATE);
    const summary = computeLabCalibrationStats(parsed.coupons, (c) => {
      const ev = evaluateForwardTi64Candidate({
        processId: c.process === 'binder-jetting' ? 'lpbf' : c.process,
        alloyId: 'ti64_gr5',
        P: c.P_W,
        v: c.v_mm_s,
        h: c.h_um,
        t: c.t_um,
        db: c.process === 'ded-laser' ? 1500 : 80,
        T0: c.T0_C,
        postProcessing: c.post_proc as 'HIP',
        oxygenWtPct: 0.16,
        buildOrientationDeg: 0,
        scanRotationDeg: 67
      });
      return {
        hv: ev.predictedHv,
        ysMpa: ev.yieldStrengthMpa,
        utsMpa: ev.utsMpa,
        elongPct: ev.elongationPct
      };
    });

    expect(summary.sampleCount).toBe(4);
    expect(summary.hv.count).toBe(4);
    expect(Number.isFinite(summary.hv.mae)).toBe(true);
    expect(Number.isFinite(summary.hv.rmse)).toBe(true);
    expect(summary.hv.rmse).toBeGreaterThanOrEqual(summary.hv.mae);
    expect(summary.calibrationLabel).toBe('LAB-CALIBRATED (N=4)');

    // Shrinkage weight N / (N + 4) = 0.5 at N=4
    expect(summary.hv.bayesianBiasShift).toBeCloseTo(0.5 * summary.hv.meanBias, 1);
    expect(applyBayesianBiasCorrection(335, summary.hv, false)).toBe(335);
    expect(applyBayesianBiasCorrection(335, summary.hv, true)).toBeCloseTo(335 + summary.hv.bayesianBiasShift, 2);
  });
});
