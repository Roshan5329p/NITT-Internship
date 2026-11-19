import { describe, expect, it } from 'vitest';
import {
  buildRegularizedCovarianceModel,
  choleskyDecompose,
  evaluateOodRisk,
  getProcessCovarianceModel,
  invertSymmetricPositiveDefinite,
  OOD_FEATURE_ORDER,
  resolveProcessEnvelope,
  type ProcessReferenceEnvelope
} from '../src/lib/ood-detector';

const FOUR_PROCESSES = ['lpbf', 'lded', 'waam', 'binder_jetting'] as const;

describe('Full 6x6 Regularized Covariance Mahalanobis OOD Detector', () => {
  it('constructs strictly positive-definite covariance & exact matrix inverse for all 4 processes', () => {
    for (const procId of FOUR_PROCESSES) {
      const model = getProcessCovarianceModel(procId);
      expect(model.isPositiveDefinite).toBe(true);
      expect(model.featureOrder).toEqual(OOD_FEATURE_ORDER);
      expect(model.regularizedCovarianceMatrix).toHaveLength(6);
      expect(model.precisionMatrix).toHaveLength(6);

      // Cholesky verification
      const chol = choleskyDecompose(model.regularizedCovarianceMatrix);
      expect(chol).not.toBeNull();

      // Verify Sigma_reg * Sigma_reg^-1 ≈ I_6
      const A = model.regularizedCovarianceMatrix;
      const B = model.precisionMatrix;
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          let sum = 0;
          for (let k = 0; k < 6; k++) {
            expect(Number.isFinite(A[i][k])).toBe(true);
            expect(Number.isFinite(B[k][j])).toBe(true);
            sum += A[i][k] * B[k][j];
          }
          const expected = i === j ? 1.0 : 0.0;
          expect(Math.abs(sum - expected)).toBeLessThan(1e-7);
        }
      }
    }
  });

  it('discriminates correlated in-valley (P, v) pairs from off-valley combinations across all 4 processes', () => {
    const cases = [
      {
        proc: 'lpbf',
        inValley: { P: 360, v: 1450, h: 100, t: 35, T0: 150 },
        offValley: { P: 360, v: 480, h: 100, t: 35, T0: 150 }
      },
      {
        proc: 'lded',
        inValley: { P: 2300, v: 24, h: 1200, t: 450, T0: 100 },
        offValley: { P: 2300, v: 7, h: 1200, t: 450, T0: 100 }
      },
      {
        proc: 'waam',
        inValley: { P: 3400, v: 13, h: 3500, t: 1500, T0: 120 },
        offValley: { P: 3400, v: 4.5, h: 3500, t: 1500, T0: 120 }
      },
      {
        proc: 'binder_jetting',
        inValley: { P: 175, v: 620, h: 50, t: 50, T0: 180 },
        offValley: { P: 175, v: 220, h: 50, t: 50, T0: 180 }
      }
    ];

    for (const c of cases) {
      const inRes = evaluateOodRisk(c.inValley, c.proc);
      const offRes = evaluateOodRisk(c.offValley, c.proc);

      expect(inRes.covarianceMode).toBe('full_6x6_regularized');
      expect(inRes.status).toBe('in_distribution');
      expect(inRes.mahalanobisDistance).toBeLessThanOrEqual(2.5);
      expect(inRes.piMultiplier).toBe(1.0);

      expect(offRes.status).toBe('extrapolating');
      expect(offRes.mahalanobisDistance).toBeGreaterThan(3.5);
      expect(offRes.mahalanobisDistance).toBeGreaterThan(inRes.mahalanobisDistance + 1.5);
      expect(offRes.piMultiplier).toBeGreaterThan(1.0);
      expect(offRes.piMultiplier).toBeLessThanOrEqual(2.2);

      // Pure (P, v) off-diagonal check even with VED held at process centroid
      const env = resolveProcessEnvelope(c.proc);
      const inFixedVed = evaluateOodRisk({ ...c.inValley, ved: env.parameters.ved.centroid }, c.proc);
      const offFixedVed = evaluateOodRisk({ ...c.offValley, ved: env.parameters.ved.centroid }, c.proc);
      expect(offFixedVed.mahalanobisDistance).toBeGreaterThan(inFixedVed.mahalanobisDistance);
    }
  });

  it('prevents NaNs, divisions by zero, and singular matrix crashes under pathological inputs', () => {
    for (const procId of FOUR_PROCESSES) {
      const zeroAndNan = evaluateOodRisk(
        { P: Number.NaN, v: 0, h: -10, t: Number.POSITIVE_INFINITY, T0: Number.NaN, ved: Number.NaN },
        procId
      );
      expect(Number.isFinite(zeroAndNan.mahalanobisDistance)).toBe(true);
      expect(Number.isFinite(zeroAndNan.piMultiplier)).toBe(true);
      expect(Number.isNaN(zeroAndNan.mahalanobisDistance)).toBe(false);
      expect(Number.isNaN(zeroAndNan.piMultiplier)).toBe(false);

      // Centroid evaluation must give 0.00 (no negative floating-point sqrt -> NaN)
      const env = resolveProcessEnvelope(procId);
      const centroidEval = evaluateOodRisk(
        {
          P: env.parameters.P.centroid,
          v: env.parameters.v.centroid,
          h: env.parameters.h.centroid,
          t: env.parameters.t.centroid,
          T0: env.parameters.T0.centroid,
          ved: env.parameters.ved.centroid
        },
        procId
      );
      expect(centroidEval.mahalanobisDistance).toBe(0);
      expect(centroidEval.status).toBe('in_distribution');
    }

    // Singular / non-PD matrices return null cleanly instead of throwing/NaN
    expect(invertSymmetricPositiveDefinite([[0, 0], [0, 0]])).toBeNull();
    expect(choleskyDecompose([[1, 2], [2, 1]])).toBeNull();

    // Malformed zero-std custom envelope falls back safely without throwing
    const baseEnv = resolveProcessEnvelope('lpbf');
    const badEnv: ProcessReferenceEnvelope = {
      ...baseEnv,
      processId: 'custom_bad',
      parameters: {
        ...baseEnv.parameters,
        P: { ...baseEnv.parameters.P, std: 0 }
      }
    };
    const safeModel = buildRegularizedCovarianceModel(badEnv, 1e-4);
    expect(safeModel.precisionMatrix.flat().every(Number.isFinite)).toBe(true);
  });
});
