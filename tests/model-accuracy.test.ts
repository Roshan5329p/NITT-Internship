import { describe, it, expect } from 'vitest';
import {
  CALIBRATION_SUMMARY,
  VALIDATION_MATRIX,
  CALIBRATED_MATRIX,
  CALIBRATED_MODELS,
  applyCalibratedResidual
} from '../src/config/calibrated-models';

describe('Ti-6Al-4V Calibrated Multi-Model Training & Tiered LOPO-CV Verification', () => {
  it('writes honest calibration summary and counts excluded vs verified bulk papers', () => {
    expect(CALIBRATION_SUMMARY.calibrated_model_version).toBe('ti64-calibrated-v3.0');
    expect(CALIBRATION_SUMMARY.verified_bulk_papers).toBe(35);
    expect(CALIBRATION_SUMMARY.excluded_papers_total).toBe(164);
    expect(CALIBRATION_SUMMARY.lopo_evaluated_cells).toBe(8);
    expect(CALIBRATION_SUMMARY.physics_prior_only_cells).toBe(12);
    expect(CALIBRATION_SUMMARY.excluded_breakdown.lattice).toBe(5);
    expect(CALIBRATION_SUMMARY.excluded_breakdown.modified_alloy).toBe(4);
  });

  it('passes tiered LOPO-CV gate on all evaluated LPBF & L-DED cohorts (N >= 5)', () => {
    const ens = VALIDATION_MATRIX.ensemble;

    for (const proc of ['lpbf', 'ded-laser'] as const) {
      for (const prop of ['hardness_hv', 'ys_mpa', 'uts_mpa'] as const) {
        const cell = ens[proc][prop];
        expect(cell.validationType).toBe('lopo_cv');
        expect(cell.accuracyPct).toBeGreaterThanOrEqual(90.0);
        expect(cell.pi95CoveragePct).toBeGreaterThanOrEqual(85.0);
      }
      const elCell = ens[proc].elongation_pct;
      expect(elCell.validationType).toBe('lopo_cv');
      expect(elCell.mae).toBeLessThanOrEqual(2.0);
      expect(elCell.pi95CoveragePct).toBeGreaterThanOrEqual(85.0);
    }

    // Calibrated full-corpus ensemble should exceed 98% on all strength/hardness cohorts
    expect(CALIBRATED_MATRIX.ensemble.lpbf.hardness_hv.accuracyPct).toBeGreaterThan(98);
    expect(CALIBRATED_MATRIX.ensemble['ded-laser'].hardness_hv.accuracyPct).toBeGreaterThan(98);
  });

  it('marks sparse cells (N < 5) cleanly as physics_prior_only without fake ML R² or accuracy', () => {
    const ens = VALIDATION_MATRIX.ensemble;

    expect(ens.lpbf.relative_density_pct.validationType).toBe('physics_prior_only');
    expect(ens.lpbf.relative_density_pct.accuracyPct).toBeNull();
    expect(ens['ded-laser'].relative_density_pct.validationType).toBe('physics_prior_only');

    for (const proc of ['waam', 'binder-jetting'] as const) {
      for (const prop of ['hardness_hv', 'ys_mpa', 'uts_mpa', 'elongation_pct', 'relative_density_pct'] as const) {
        expect(ens[proc][prop].validationType).toBe('physics_prior_only');
        expect(ens[proc][prop].accuracyPct).toBeNull();
        expect(ens[proc][prop].r2).toBeNull();
      }
    }
  });

  it('applies bounded calibrated residuals cleanly across all 4 AM processes', () => {
    expect(Object.keys(CALIBRATED_MODELS)).toEqual(['lpbf', 'ded-laser', 'waam', 'binder-jetting']);

    const lpbfHv = applyCalibratedResidual({
      processId: 'lpbf', prop: 'hardness_hv', priorVal: 342, P: 280, v: 960, h: 110, t: 40, postProcessing: 'HIP'
    });
    const dedHv = applyCalibratedResidual({
      processId: 'ded-laser', prop: 'hardness_hv', priorVal: 345, P: 1600, v: 15, h: 1200, t: 450, postProcessing: 'As-Built'
    });
    const waamYs = applyCalibratedResidual({
      processId: 'waam', prop: 'ys_mpa', priorVal: 820, P: 2400, v: 8, h: 3500, t: 1500, postProcessing: 'HIP'
    });
    const bjDen = applyCalibratedResidual({
      processId: 'binder-jetting', prop: 'relative_density_pct', priorVal: 99.75, P: 120, v: 300, h: 80, t: 100, postProcessing: 'HIP'
    });

    for (const val of [lpbfHv, dedHv, waamYs, bjDen]) {
      expect(Number.isFinite(val)).toBe(true);
      expect(val).toBeGreaterThan(0);
    }
  });
});
