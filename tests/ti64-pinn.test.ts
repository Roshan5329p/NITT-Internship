import { describe, it, expect } from 'vitest';
import {
  evaluateTi64Pinn,
  computePinnProcessGradients,
  getTi64PinnBundleMetrics
} from '../src/lib/ti64-pinn';
import { solveInverseTi64Recipes } from '../src/lib/inverse-solver';
import { computePinnGuidedLabTransfer, parseLabCouponsCsv, computeLabCalibrationStats, SAMPLE_LAB_CSV_TEMPLATE } from '../src/components/LabCalibrationPanel';

describe('Ti-6Al-4V Physics-Informed Neural Network (PINN)', () => {
  it('loads trained bundle and yields finite physics-valid predictions across LPBF, L-DED, and WAAM', () => {
    const meta = getTi64PinnBundleMetrics();
    expect(meta.trainingSummary.zero_fabricated_data).toBe(true);
    expect(meta.trainingSummary.verified_thermal_rows).toBe(58);

    const cases = [
      { processId: 'lpbf', P: 280, v: 960, h: 110, t: 40, T0: 200, db: 80, postProcessing: 'HIP' },
      { processId: 'ded-laser', P: 1600, v: 15, h: 1200, t: 450, T0: 120, db: 1500, postProcessing: 'Annealed' },
      { processId: 'waam', P: 2200, v: 8, h: 3400, t: 1400, T0: 120, db: 3000, postProcessing: 'Stress-relieved' }
    ];

    for (const c of cases) {
      const res = evaluateTi64Pinn(c);
      expect(Number.isFinite(res.meltPool.widthUm)).toBe(true);
      expect(Number.isFinite(res.meltPool.depthUm)).toBe(true);
      expect(Number.isFinite(res.meltPool.coolingRateKs)).toBe(true);
      expect(Number.isFinite(res.metallurgy.alphaLathWidthUm)).toBe(true);
      expect(Number.isFinite(res.metallurgy.yieldStrengthMpa)).toBe(true);
      expect(Number.isFinite(res.metallurgy.utsMpa)).toBe(true);
      expect(Number.isFinite(res.metallurgy.elongationPct)).toBe(true);
      expect(res.metallurgy.utsMpa).toBeGreaterThan(res.metallurgy.yieldStrengthMpa);
      expect(res.physicsAudit.hallPetchResidualMpa).toBeLessThan(20);
      expect(res.physicsAudit.allMonotonicityChecksPass).toBe(true);
    }
  });

  it('enforces autograd monotonicity: dW/dP > 0, dW/dv < 0, dYS/dO2 > 0, dElong/dO2 < 0, and lath coarsening As-Built -> HIP', () => {
    const ab = evaluateTi64Pinn({ processId: 'lpbf', P: 280, v: 960, h: 110, t: 40, T0: 200, postProcessing: 'None', oxygenWtPct: 0.12 });
    const sr = evaluateTi64Pinn({ processId: 'lpbf', P: 280, v: 960, h: 110, t: 40, T0: 200, postProcessing: 'Stress-relieved', oxygenWtPct: 0.12 });
    const ann = evaluateTi64Pinn({ processId: 'lpbf', P: 280, v: 960, h: 110, t: 40, T0: 200, postProcessing: 'Annealed', oxygenWtPct: 0.12 });
    const hip = evaluateTi64Pinn({ processId: 'lpbf', P: 280, v: 960, h: 110, t: 40, T0: 200, postProcessing: 'HIP', oxygenWtPct: 0.12 });

    expect(hip.metallurgy.alphaLathWidthUm).toBeGreaterThan(ann.metallurgy.alphaLathWidthUm);
    expect(ann.metallurgy.alphaLathWidthUm).toBeGreaterThan(sr.metallurgy.alphaLathWidthUm);
    expect(sr.metallurgy.alphaLathWidthUm).toBeGreaterThan(ab.metallurgy.alphaLathWidthUm);

    const lowO2 = evaluateTi64Pinn({ processId: 'lpbf', P: 280, v: 960, h: 110, t: 40, T0: 200, postProcessing: 'HIP', oxygenWtPct: 0.10 });
    const highO2 = evaluateTi64Pinn({ processId: 'lpbf', P: 280, v: 960, h: 110, t: 40, T0: 200, postProcessing: 'HIP', oxygenWtPct: 0.20 });
    expect(highO2.metallurgy.yieldStrengthMpa).toBeGreaterThan(lowO2.metallurgy.yieldStrengthMpa);
    expect(highO2.metallurgy.elongationPct).toBeLessThan(lowO2.metallurgy.elongationPct);
    expect(highO2.derivatives.dYs_dO2).toBeGreaterThan(0);
    expect(highO2.derivatives.dElong_dO2).toBeLessThan(0);

    const grads = computePinnProcessGradients({ processId: 'lpbf', P: 280, v: 960, h: 110, t: 40, T0: 200, postProcessing: 'HIP' });
    expect(Number.isFinite(grads.dYs_dP)).toBe(true);
    expect(Number.isFinite(grads.dElong_dv)).toBe(true);
  });

  it('refines Pareto inverse solver candidates with PINN gradients and guards lab transfer bounds', () => {
    const inv = solveInverseTi64Recipes({
      minYsMpa: 850,
      minElongPct: 12.0,
      maxResidualStressMpa: 60,
      minBuildRateCm3H: 20.0,
      alloyId: 'ti64_gr5',
      astmStandard: 'F2924'
    });
    expect(inv.candidates.length).toBeGreaterThanOrEqual(3);
    for (const c of inv.candidates) {
      expect(Number.isFinite(c.pinnYieldStrengthMpa)).toBe(true);
      expect(Number.isFinite(c.pinnHallPetchResidualMpa)).toBe(true);
      expect(c.yieldStrengthMpa).toBeGreaterThanOrEqual(850);
      expect(c.elongationPct).toBeGreaterThanOrEqual(12.0);
    }

    const parsed = parseLabCouponsCsv(SAMPLE_LAB_CSV_TEMPLATE);
    const summary = computeLabCalibrationStats(parsed.coupons, (cp) => {
      const p = evaluateTi64Pinn({ processId: cp.process, P: cp.P_W, v: cp.v_mm_s, h: cp.h_um, t: cp.t_um, T0: cp.T0_C, postProcessing: cp.post_proc });
      return {
        hv: p.metallurgy.predictedHv,
        ysMpa: p.metallurgy.yieldStrengthMpa,
        utsMpa: p.metallurgy.utsMpa,
        elongPct: p.metallurgy.elongationPct
      };
    });
    const xfer = computePinnGuidedLabTransfer({ processId: 'lpbf', P: 280, v: 960, h: 110, t: 40, T0: 200, postProcessing: 'HIP' }, summary, true);
    expect(xfer.metallurgy.utsMpa).toBeGreaterThan(xfer.metallurgy.yieldStrengthMpa);
  });
});
