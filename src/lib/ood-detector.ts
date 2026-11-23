/**
 * NIT Trichy Titanium AM Platform — Out-of-Distribution (OOD) Extrapolation Detector
 * Evaluates active process parameter vectors x = [P, v, h, t, T0, ved]^T against
 * process-specific full 6x6 regularized covariance models Sigma_reg = Sigma + lambda * I
 * calibrated against the Ti-6Al-4V literature envelope (N = 178 indexed studies).
 */

export type OodStatus = 'in_distribution' | 'boundary' | 'extrapolating';

export type SupportedProcessId =
  | 'lpbf'
  | 'ded-laser'
  | 'lded'
  | 'waam'
  | 'binder-jetting'
  | 'binder_jetting'
  | 'bj';

export type FeatureKey = 'P' | 'v' | 'h' | 't' | 'T0' | 'ved';

export const OOD_FEATURE_ORDER: readonly FeatureKey[] = ['P', 'v', 'h', 't', 'T0', 'ved'];

export interface ProcessParameterVector {
  P: number;      // Laser / Arc Power (W)
  v: number;      // Scan / Travel Speed (mm/s)
  h: number;      // Hatch Spacing (µm)
  t: number;      // Layer Thickness (µm)
  T0: number;     // Build Plate Preheat (°C)
  ved?: number;   // Volumetric Energy Density (J/mm³), computed if omitted
  db?: number;    // Beam Spot Diameter (µm), optional
}

export interface ParameterEnvelopeSpec {
  label: string;
  unit: string;
  min: number;
  max: number;
  centroid: number;
  std: number;
  includeInMahalanobis: boolean;
}

export interface ProcessCovarianceModel {
  featureOrder: readonly FeatureKey[];
  ridgeLambda: number;
  correlationMatrix: number[][];
  covarianceMatrix: number[][];
  regularizedCovarianceMatrix: number[][];
  precisionMatrix: number[][];
  isPositiveDefinite: boolean;
}

export interface ProcessReferenceEnvelope {
  processId: string;
  displayName: string;
  studyCount: number;
  nominalBaseline: {
    P: number;
    v: number;
    h: number;
    t: number;
    db: number;
    T0: number;
  };
  sliderBounds: {
    P: [number, number];
    v: [number, number];
    h: [number, number];
    t: [number, number];
    db: [number, number];
    T0: [number, number];
  };
  parameters: Record<FeatureKey, ParameterEnvelopeSpec>;
  /** Latent factor loadings over [P, v, h, t, T0, ved] producing an exact SPD correlation matrix */
  factorLoadings: readonly (readonly number[])[];
  idiosyncraticDiag: readonly number[];
  ridgeLambda: number;
}

export interface OodEvaluationResult {
  status: OodStatus;
  mahalanobisDistance: number;
  piMultiplier: number;
  violations: string[];
  processId: string;
  processDisplayName: string;
  studyCount: number;
  covarianceMode: 'full_6x6_regularized';
}

const DEFAULT_RIDGE_LAMBDA = 1e-4;

/**
 * Constructs a strictly Symmetric Positive-Definite (SPD) 6x6 correlation matrix
 * from latent factor loadings B and strictly positive idiosyncratic diagonal terms:
 *   G = B * B^T + diag(idiosyncraticDiag)
 *   R_ij = G_ij / sqrt(G_ii * G_jj)
 */
function buildSpdCorrelationMatrix(
  factorLoadings: readonly (readonly number[])[],
  idiosyncraticDiag: readonly number[]
): number[][] {
  const n = OOD_FEATURE_ORDER.length;
  const gram: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));

  for (const factor of factorLoadings) {
    for (let i = 0; i < n; i++) {
      const fi = Number.isFinite(factor[i]) ? factor[i] : 0;
      for (let j = 0; j < n; j++) {
        const fj = Number.isFinite(factor[j]) ? factor[j] : 0;
        gram[i][j] += fi * fj;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const diagBoost = Number.isFinite(idiosyncraticDiag[i]) ? Math.max(1e-3, idiosyncraticDiag[i]) : 1e-2;
    gram[i][i] += diagBoost;
  }

  const corr: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        corr[i][j] = 1.0;
      } else {
        const denom = Math.sqrt(Math.max(1e-12, gram[i][i] * gram[j][j]));
        const val = gram[i][j] / denom;
        corr[i][j] = Number.isFinite(val) ? Math.max(-0.98, Math.min(0.98, val)) : 0.0;
      }
    }
  }
  return corr;
}

/**
 * Cholesky decomposition M = L * L^T to verify strict symmetric positive-definiteness.
 * Returns null if M is non-PD or contains non-finite values.
 */
export function choleskyDecompose(matrix: readonly (readonly number[])[]): number[][] | null {
  const n = matrix.length;
  if (n === 0) return null;
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));

  for (let i = 0; i < n; i++) {
    if (!matrix[i] || matrix[i].length !== n) return null;
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const diagVal = matrix[i][i] - sum;
        if (!Number.isFinite(diagVal) || diagVal <= 1e-12) {
          return null;
        }
        L[i][j] = Math.sqrt(diagVal);
      } else {
        const symAvg = 0.5 * (matrix[i][j] + matrix[j][i]);
        const val = (symAvg - sum) / L[j][j];
        if (!Number.isFinite(val)) return null;
        L[i][j] = val;
      }
    }
  }
  return L;
}

/**
 * Equilibrated symmetric positive-definite matrix inversion via Cholesky (L * L^T)
 * with diagonal pre-conditioning (S = D * M * D) to guarantee numerical stability across
 * orders-of-magnitude unit differences (e.g. scan speed ~10 mm/s vs power ~3000 W).
 */
export function invertSymmetricPositiveDefinite(matrix: readonly (readonly number[])[]): number[][] | null {
  const n = matrix.length;
  if (n === 0) return null;

  const scale = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const diag = matrix[i]?.[i];
    if (!Number.isFinite(diag) || diag <= 1e-12) return null;
    scale[i] = 1.0 / Math.sqrt(diag);
  }

  const equilibrated: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => {
      const mij = 0.5 * (matrix[i][j] + matrix[j][i]);
      return scale[i] * mij * scale[j];
    })
  );

  const L = choleskyDecompose(equilibrated);
  if (!L) return null;

  // Solve L * Y = I -> forward substitution
  const Linv: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let col = 0; col < n; col++) {
    for (let row = col; row < n; row++) {
      let sum = row === col ? 1.0 : 0.0;
      for (let k = col; k < row; k++) {
        sum -= L[row][k] * Linv[k][col];
      }
      const val = sum / L[row][row];
      if (!Number.isFinite(val)) return null;
      Linv[row][col] = val;
    }
  }

  // E^-1 = (L^-1)^T * L^-1, then M^-1 = D * E^-1 * D
  const inv: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let sum = 0;
      for (let k = Math.max(i, j); k < n; k++) {
        sum += Linv[k][i] * Linv[k][j];
      }
      const entry = scale[i] * sum * scale[j];
      if (!Number.isFinite(entry)) return null;
      inv[i][j] = entry;
      inv[j][i] = entry;
    }
  }
  return inv;
}

export const PROCESS_REFERENCE_ENVELOPES: Record<string, ProcessReferenceEnvelope> = {
  lpbf: {
    processId: 'lpbf',
    displayName: 'LPBF',
    studyCount: 178,
    nominalBaseline: { P: 280, v: 960, h: 110, t: 40, db: 80, T0: 200 },
    sliderBounds: {
      P: [80, 450],
      v: [300, 2200],
      h: [50, 180],
      t: [20, 90],
      db: [40, 160],
      T0: [25, 650]
    },
    parameters: {
      P:   { label: 'Laser Power',                   unit: 'W',     min: 100, max: 400,  centroid: 250,  std: 65,  includeInMahalanobis: true },
      v:   { label: 'Scan Speed',                    unit: 'mm/s',  min: 400, max: 1600, centroid: 1000, std: 280, includeInMahalanobis: true },
      h:   { label: 'Hatch Spacing',                 unit: 'µm',    min: 60,  max: 140,  centroid: 100,  std: 20,  includeInMahalanobis: true },
      t:   { label: 'Layer Thickness',               unit: 'µm',    min: 20,  max: 60,   centroid: 35,   std: 10,  includeInMahalanobis: true },
      T0:  { label: 'Build Plate Preheat',           unit: '°C',    min: 25,  max: 300,  centroid: 150,  std: 70,  includeInMahalanobis: true },
      ved: { label: 'Volumetric Energy Density (VED)', unit: 'J/mm³', min: 35, max: 120,  centroid: 68,   std: 22,  includeInMahalanobis: true }
    },
    // Factor 1: P-v conduction valley (rho ~ +0.70); Factor 2: VED coupling; Factor 3: hatch-layer scaling
    factorLoadings: [
      [0.94, 0.90, 0.00, 0.12, 0.00, 0.08],
      [0.25, -0.25, -0.22, -0.22, 0.00, 0.72],
      [0.10, 0.00, 0.40, 0.42, 0.00, 0.00]
    ],
    idiosyncraticDiag: [0.18, 0.22, 0.72, 0.68, 1.00, 0.45],
    ridgeLambda: DEFAULT_RIDGE_LAMBDA
  },
  'ded-laser': {
    processId: 'ded-laser',
    displayName: 'L-DED',
    studyCount: 178,
    nominalBaseline: { P: 1600, v: 15, h: 1200, t: 450, db: 1500, T0: 100 },
    sliderBounds: {
      P: [400, 3000],
      v: [4, 40],
      h: [600, 2200],
      t: [150, 1000],
      db: [800, 3500],
      T0: [25, 300]
    },
    parameters: {
      P:   { label: 'Laser Power',                   unit: 'W',     min: 600, max: 2600, centroid: 1600, std: 450, includeInMahalanobis: true },
      v:   { label: 'Scan Speed',                    unit: 'mm/s',  min: 6,   max: 30,   centroid: 15,   std: 6,   includeInMahalanobis: true },
      h:   { label: 'Hatch Spacing',                 unit: 'µm',    min: 700, max: 1800, centroid: 1200, std: 280, includeInMahalanobis: true },
      t:   { label: 'Layer Thickness',               unit: 'µm',    min: 200, max: 800,  centroid: 450,  std: 150, includeInMahalanobis: true },
      T0:  { label: 'Build Plate Preheat',           unit: '°C',    min: 25,  max: 250,  centroid: 100,  std: 60,  includeInMahalanobis: true },
      ved: { label: 'Volumetric Energy Density (VED)', unit: 'J/mm³', min: 80, max: 350,  centroid: 195,  std: 60,  includeInMahalanobis: true }
    },
    factorLoadings: [
      [0.90, 0.84, 0.15, 0.22, 0.00, 0.05],
      [0.22, -0.28, -0.20, -0.20, 0.00, 0.70],
      [0.10, 0.00, 0.48, 0.50, 0.00, 0.00]
    ],
    idiosyncraticDiag: [0.24, 0.28, 0.65, 0.60, 1.00, 0.48],
    ridgeLambda: DEFAULT_RIDGE_LAMBDA
  },
  waam: {
    processId: 'waam',
    displayName: 'WAAM',
    studyCount: 178,
    nominalBaseline: { P: 2400, v: 8, h: 3500, t: 1500, db: 3000, T0: 120 },
    sliderBounds: {
      P: [1200, 4500],
      v: [3, 25],
      h: [2000, 6000],
      t: [800, 2500],
      db: [2000, 6000],
      T0: [25, 350]
    },
    parameters: {
      P:   { label: 'Arc Power',                     unit: 'W',     min: 1500, max: 3800, centroid: 2400, std: 550, includeInMahalanobis: true },
      v:   { label: 'Travel Speed',                  unit: 'mm/s',  min: 4,    max: 18,   centroid: 8,    std: 3.5, includeInMahalanobis: true },
      h:   { label: 'Step-Over Hatch',               unit: 'µm',    min: 2400, max: 5000, centroid: 3500, std: 650, includeInMahalanobis: true },
      t:   { label: 'Bead Layer Height',             unit: 'µm',    min: 1000, max: 2200, centroid: 1500, std: 300, includeInMahalanobis: true },
      T0:  { label: 'Interpass Preheat',             unit: '°C',    min: 25,   max: 280,  centroid: 120,  std: 65,  includeInMahalanobis: true },
      ved: { label: 'Volumetric Energy Density (VED)', unit: 'J/mm³', min: 25,  max: 120,  centroid: 60,   std: 22,  includeInMahalanobis: true }
    },
    factorLoadings: [
      [0.92, 0.88, 0.20, 0.15, 0.00, 0.05],
      [0.20, -0.26, -0.18, -0.18, 0.00, 0.68],
      [0.12, 0.00, 0.50, 0.52, 0.00, 0.00]
    ],
    idiosyncraticDiag: [0.22, 0.25, 0.62, 0.62, 1.00, 0.50],
    ridgeLambda: DEFAULT_RIDGE_LAMBDA
  },
  'binder-jetting': {
    processId: 'binder-jetting',
    displayName: 'Binder Jetting',
    studyCount: 178,
    nominalBaseline: { P: 120, v: 400, h: 50, t: 50, db: 35, T0: 180 },
    sliderBounds: {
      P: [50, 250],
      v: [150, 900],
      h: [30, 120],
      t: [25, 100],
      db: [20, 100],
      T0: [25, 220]
    },
    parameters: {
      P:   { label: 'Sinter / Curing Power',    unit: 'W',     min: 70,  max: 200, centroid: 120, std: 35,  includeInMahalanobis: true },
      v:   { label: 'Printhead Speed',          unit: 'mm/s',  min: 200, max: 750, centroid: 400, std: 130, includeInMahalanobis: true },
      h:   { label: 'Line Spacing',             unit: 'µm',    min: 35,  max: 100, centroid: 50,  std: 18,  includeInMahalanobis: true },
      t:   { label: 'Powder Layer Thickness',   unit: 'µm',    min: 30,  max: 85,  centroid: 50,  std: 15,  includeInMahalanobis: true },
      T0:  { label: 'Bed Drying Temp',          unit: '°C',    min: 25,  max: 210, centroid: 180, std: 45,  includeInMahalanobis: true },
      ved: { label: 'Effective Energy Density', unit: 'J/mm³', min: 35,  max: 200, centroid: 110, std: 40,  includeInMahalanobis: true }
    },
    factorLoadings: [
      [0.86, 0.82, 0.00, 0.15, 0.10, 0.10],
      [0.22, -0.22, -0.20, -0.20, 0.15, 0.66],
      [0.10, 0.00, 0.45, 0.45, 0.00, 0.00]
    ],
    idiosyncraticDiag: [0.30, 0.32, 0.70, 0.68, 0.95, 0.52],
    ridgeLambda: DEFAULT_RIDGE_LAMBDA
  }
};

export function resolveProcessEnvelope(processId?: string): ProcessReferenceEnvelope {
  const norm = (processId || 'lpbf').toLowerCase().trim();
  if (norm === 'bj' || norm === 'binder-jetting' || norm === 'binder_jetting') {
    return PROCESS_REFERENCE_ENVELOPES['binder-jetting'];
  }
  if (norm === 'ded' || norm === 'ded-laser' || norm === 'lded' || norm === 'l-ded') {
    return PROCESS_REFERENCE_ENVELOPES['ded-laser'];
  }
  if (norm === 'waam') {
    return PROCESS_REFERENCE_ENVELOPES.waam;
  }
  return PROCESS_REFERENCE_ENVELOPES.lpbf;
}

const COVARIANCE_CACHE = new Map<string, ProcessCovarianceModel>();

/**
 * Builds and caches the regularized 6x6 covariance matrix Sigma_reg = Sigma + lambda*I
 * and its positive-definite inverse Sigma_reg^-1 for a given process envelope.
 * Never throws or returns NaN: escalates ridge regularization if ever ill-conditioned.
 */
export function buildRegularizedCovarianceModel(
  env: ProcessReferenceEnvelope,
  overrideLambda?: number
): ProcessCovarianceModel {
  const lambda = Number.isFinite(overrideLambda) && (overrideLambda as number) > 0
    ? Number(overrideLambda)
    : env.ridgeLambda;
  const cacheKey = `${env.processId}:${lambda}`;
  if (overrideLambda === undefined && COVARIANCE_CACHE.has(cacheKey)) {
    return COVARIANCE_CACHE.get(cacheKey)!;
  }

  const n = OOD_FEATURE_ORDER.length;
  const stds = OOD_FEATURE_ORDER.map((k) => {
    const rawStd = env.parameters[k].std;
    return Number.isFinite(rawStd) && rawStd > 1e-6 ? rawStd : 1.0;
  });

  const corr = buildSpdCorrelationMatrix(env.factorLoadings, env.idiosyncraticDiag);
  const covarianceMatrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => corr[i][j] * stds[i] * stds[j])
  );

  let currentLambda = lambda;
  let regularizedCovarianceMatrix: number[][] = [];
  let precisionMatrix: number[][] | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    regularizedCovarianceMatrix = covarianceMatrix.map((row, i) =>
      row.map((val, j) => (i === j ? val + currentLambda : val))
    );
    precisionMatrix = invertSymmetricPositiveDefinite(regularizedCovarianceMatrix);
    if (precisionMatrix) break;
    currentLambda = Math.max(currentLambda * 10, 1e-3);
  }

  const isPositiveDefinite = precisionMatrix !== null;
  if (!precisionMatrix) {
    // Guaranteed diagonal fallback if malformed custom envelope was passed
    precisionMatrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (__, j) => (i === j ? 1.0 / (stds[i] * stds[i] + currentLambda) : 0.0))
    );
  }

  const model: ProcessCovarianceModel = {
    featureOrder: OOD_FEATURE_ORDER,
    ridgeLambda: currentLambda,
    correlationMatrix: corr,
    covarianceMatrix,
    regularizedCovarianceMatrix,
    precisionMatrix,
    isPositiveDefinite
  };

  if (overrideLambda === undefined) {
    COVARIANCE_CACHE.set(cacheKey, model);
  }
  return model;
}

export function getProcessCovarianceModel(processId: string = 'lpbf'): ProcessCovarianceModel {
  return buildRegularizedCovarianceModel(resolveProcessEnvelope(processId));
}

/**
 * Evaluates the current parameter vector x = [P, v, h, t, T0, ved]^T against the
 * process-specific full 6x6 regularized covariance model:
 *   dM = sqrt( (x - mu)^T * Sigma_reg^-1 * (x - mu) )
 */
export function evaluateOodRisk(
  params: ProcessParameterVector,
  processId: string = 'lpbf'
): OodEvaluationResult {
  const env = resolveProcessEnvelope(processId);
  const covModel = buildRegularizedCovarianceModel(env);

  const P = Number.isFinite(params?.P) ? params.P : env.nominalBaseline.P;
  const v = Number.isFinite(params?.v) && params.v > 0 ? params.v : env.nominalBaseline.v;
  const h = Number.isFinite(params?.h) && params.h > 0 ? params.h : env.nominalBaseline.h;
  const t = Number.isFinite(params?.t) && params.t > 0 ? params.t : env.nominalBaseline.t;
  const T0 = Number.isFinite(params?.T0) ? params.T0 : env.nominalBaseline.T0;

  const denomMm3 = Math.max(1e-6, v * h * t);
  const computedVed = (P * 1e6) / denomMm3;
  const vedRaw = Number.isFinite(params?.ved) ? Number(params.ved) : computedVed;
  const ved = Number.isFinite(vedRaw) ? Number(vedRaw.toFixed(1)) : env.parameters.ved.centroid;

  const vectorMap: Record<FeatureKey, number> = { P, v, h, t, T0, ved };
  const diffVec = OOD_FEATURE_ORDER.map((k) => vectorMap[k] - env.parameters[k].centroid);

  // Compute Mahalanobis quadratic form (x - mu)^T * Sigma_reg^-1 * (x - mu)
  const prec = covModel.precisionMatrix;
  let quadForm = 0;
  for (let i = 0; i < OOD_FEATURE_ORDER.length; i++) {
    let rowDot = 0;
    for (let j = 0; j < OOD_FEATURE_ORDER.length; j++) {
      rowDot += prec[i][j] * diffVec[j];
    }
    quadForm += diffVec[i] * rowDot;
  }

  const dMRaw = Number.isFinite(quadForm) ? Math.sqrt(Math.max(0, quadForm)) : 0;
  const mahalanobisDistance = Number(dMRaw.toFixed(2));

  const violations: string[] = [];
  OOD_FEATURE_ORDER.forEach((key) => {
    const spec = env.parameters[key];
    const val = vectorMap[key];
    if (val > spec.max) {
      violations.push(
        `${spec.label} (${val} ${spec.unit}) exceeds validated ${env.displayName} range (${spec.min}–${spec.max} ${spec.unit})`
      );
    } else if (val < spec.min) {
      violations.push(
        `${spec.label} (${val} ${spec.unit}) is below validated ${env.displayName} range (${spec.min}–${spec.max} ${spec.unit})`
      );
    }
  });

  let status: OodStatus = 'in_distribution';
  if (mahalanobisDistance > 3.5 || violations.length > 0) {
    status = 'extrapolating';
  } else if (mahalanobisDistance > 2.5) {
    status = 'boundary';
  }

  let piMultiplier = 1.0;
  if (status !== 'in_distribution') {
    const effectiveDm = violations.length > 0
      ? Math.max(mahalanobisDistance, 3.5 + 0.35 * violations.length)
      : mahalanobisDistance;
    const progress = Math.min(1.0, Math.max(0.0, (effectiveDm - 2.5) / 3.5));
    piMultiplier = Number((1.0 + progress * 1.2).toFixed(2));
  }

  return {
    status,
    mahalanobisDistance,
    piMultiplier,
    violations,
    processId: env.processId,
    processDisplayName: env.displayName,
    studyCount: env.studyCount,
    covarianceMode: 'full_6x6_regularized'
  };
}
