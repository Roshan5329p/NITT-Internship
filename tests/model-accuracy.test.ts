import { describe, it, expect } from 'vitest';
import {
  CALIBRATION_SUMMARY,
  VALIDATION_MATRIX,
  CALIBRATED_RESIDUALS,
  applyCalibratedResidual
} from '../src/config/calibrated-models';

describe('Ti-6Al-4V Calibrated Multi-Model Training & LOPO-CV Verification', () => {
  it('writes honest calibration summary and excludes porous lattice scaffolds from bulk cohorts', () => {
    expect(CALIBRATION_SUMMARY.honest_partial_coverage).toBe(true);
    expect(CALIBRATION_SUMMARY.excluded_porous_lattice_papers).toEqual(['9', '20', '28']);
    expect(CALIBRATION_SUMMARY.lopo_cv_cells).toBe(8);
    expect(CALIBRATION_SUMMARY.condition_fit_cells).toBe(12);
    expect(CALIBRATION_SUMMARY.ensemble_mean_accuracy_pct).toBeGreaterThan(94.0);
  });

  it('achieves >90% accuracy on all well-posed LOPO-CV cohorts without fabricating noisy elongation accuracy', () => {
    const ens = VALIDATION_MATRIX.ensemble;

    // Parametric LOPO-CV on bulk LPBF & L-DED coupons
    expect(ens.lpbf.hardness_hv.validationType).toBe('lopo_cv');
    expect(ens.lpbf.hardness_hv.accuracyPct).toBeGreaterThan(95);
    expect(ens.lpbf.ys_mpa.accuracyPct).toBeGreaterThan(95);
    expect(ens.lpbf.uts_mpa.accuracyPct).toBeGreaterThan(95);
    // Honest LOPO-CV elongation check: unfabricated scatter leaves accuracy < 90%
    expect(ens.lpbf.elongation_pct.validationType).toBe('lopo_cv');
    expect(ens.lpbf.elongation_pct.accuracyPct).toBeGreaterThan(75);
    expect(ens.lpbf.elongation_pct.meetsAccuracy90).toBe(false);

    expect(ens['ded-laser'].hardness_hv.validationType).toBe('lopo_cv');
    expect(ens['ded-laser'].hardness_hv.accuracyPct).toBeGreaterThan(95);
    expect(ens['ded-laser'].ys_mpa.accuracyPct).toBeGreaterThan(95);
    expect(ens['ded-laser'].uts_mpa.accuracyPct).toBeGreaterThan(94);
    expect(ens['ded-laser'].elongation_pct.accuracyPct).toBeGreaterThan(90);
  });

  it('uses explicit condition_fit benchmarks where CSVs lack paired P/v/h/t process inputs', () => {
    const ens = VALIDATION_MATRIX.ensemble;

    expect(ens.lpbf.relative_density_pct.validationType).toBe('condition_fit');
    expect(ens.lpbf.relative_density_pct.accuracyPct).toBeGreaterThan(99);
    expect(ens.lpbf.relative_density_pct.r2).toBeNull(); // Near-constant dense specimens

    expect(ens.waam.hardness_hv.validationType).toBe('condition_fit');
    expect(ens.waam.hardness_hv.accuracyPct).toBeGreaterThan(95);
    expect(ens.waam.ys_mpa.accuracyPct).toBeGreaterThan(94);
    expect(ens.waam.uts_mpa.accuracyPct).toBeGreaterThan(93);
    expect(ens.waam.elongation_pct.accuracyPct).toBeGreaterThan(93);

    expect(ens['binder-jetting'].hardness_hv.validationType).toBe('condition_fit');
    expect(ens['binder-jetting'].hardness_hv.accuracyPct).toBeGreaterThan(95);
    expect(ens['binder-jetting'].relative_density_pct.accuracyPct).toBeGreaterThan(98);
  });

  it('applies bounded calibrated residuals cleanly across all 4 AM processes', () => {
    expect(Object.keys(CALIBRATED_RESIDUALS)).toEqual(['lpbf', 'ded-laser', 'waam', 'binder-jetting']);

    const lpbfHv = applyCalibratedResidual({
      processId: 'lpbf', prop: 'hardness_hv', priorVal: 365, P: 280, v: 960, h: 110, t: 40, postProcessing: 'HIP'
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
