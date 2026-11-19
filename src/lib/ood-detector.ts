/**
 * NIT Trichy Titanium AM Platform — Out-of-Distribution (OOD) Extrapolation Detector
 * Evaluates active process parameter vectors [P, v, h, t, T0, ved] against the
 * validated literature training envelope (N = 178 indexed studies, 289 variants).
 */

export type OodStatus = 'in_distribution' | 'boundary' | 'extrapolating';

export type SupportedProcessId = 'lpbf' | 'ded-laser' | 'waam' | 'binder-jetting' | 'bj';

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
  parameters: {
    P: ParameterEnvelopeSpec;
    v: ParameterEnvelopeSpec;
    h: ParameterEnvelopeSpec;
    t: ParameterEnvelopeSpec;
    T0: ParameterEnvelopeSpec;
    ved: ParameterEnvelopeSpec;
  };
}

export interface OodEvaluationResult {
  status: OodStatus;
  mahalanobisDistance: number;
  piMultiplier: number;
  violations: string[];
  processId: string;
  processDisplayName: string;
  studyCount: number;
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
      P:   { label: 'Laser Power',          unit: 'W',      min: 100, max: 400,  centroid: 250,  std: 65,  includeInMahalanobis: true },
      v:   { label: 'Scan Speed',           unit: 'mm/s',   min: 400, max: 1600, centroid: 1000, std: 280, includeInMahalanobis: true },
      h:   { label: 'Hatch Spacing',        unit: 'µm',     min: 60,  max: 140,  centroid: 100,  std: 20,  includeInMahalanobis: true },
      t:   { label: 'Layer Thickness',      unit: 'µm',     min: 20,  max: 60,   centroid: 35,   std: 10,  includeInMahalanobis: true },
      T0:  { label: 'Build Plate Preheat',  unit: '°C',     min: 25,  max: 300,  centroid: 150,  std: 70,  includeInMahalanobis: true },
      ved: { label: 'Volumetric Energy Density (VED)', unit: 'J/mm³', min: 35, max: 120, centroid: 68, std: 22, includeInMahalanobis: false }
    }
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
      P:   { label: 'Laser Power',          unit: 'W',      min: 600, max: 2600, centroid: 1600, std: 450, includeInMahalanobis: true },
      v:   { label: 'Scan Speed',           unit: 'mm/s',   min: 6,   max: 30,   centroid: 15,   std: 6,   includeInMahalanobis: true },
      h:   { label: 'Hatch Spacing',        unit: 'µm',     min: 700, max: 1800, centroid: 1200, std: 280, includeInMahalanobis: true },
      t:   { label: 'Layer Thickness',      unit: 'µm',     min: 200, max: 800,  centroid: 450,  std: 150, includeInMahalanobis: true },
      T0:  { label: 'Build Plate Preheat',  unit: '°C',     min: 25,  max: 250,  centroid: 100,  std: 60,  includeInMahalanobis: true },
      ved: { label: 'Volumetric Energy Density (VED)', unit: 'J/mm³', min: 80, max: 350, centroid: 195, std: 60, includeInMahalanobis: false }
    }
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
      P:   { label: 'Arc Power',            unit: 'W',      min: 1500, max: 3800, centroid: 2400, std: 550, includeInMahalanobis: true },
      v:   { label: 'Travel Speed',         unit: 'mm/s',   min: 4,    max: 18,   centroid: 8,    std: 3.5, includeInMahalanobis: true },
      h:   { label: 'Step-Over Hatch',      unit: 'µm',     min: 2400, max: 5000, centroid: 3500, std: 650, includeInMahalanobis: true },
      t:   { label: 'Bead Layer Height',    unit: 'µm',     min: 1000, max: 2200, centroid: 1500, std: 300, includeInMahalanobis: true },
      T0:  { label: 'Interpass Preheat',    unit: '°C',     min: 25,   max: 280,  centroid: 120,  std: 65,  includeInMahalanobis: true },
      ved: { label: 'Volumetric Energy Density (VED)', unit: 'J/mm³', min: 25, max: 120, centroid: 60, std: 22, includeInMahalanobis: false }
    }
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
      P:   { label: 'Sinter / Curing Power', unit: 'W',     min: 70,  max: 200, centroid: 120, std: 35,  includeInMahalanobis: true },
      v:   { label: 'Printhead Speed',       unit: 'mm/s',  min: 200, max: 750, centroid: 400, std: 130, includeInMahalanobis: true },
      h:   { label: 'Line Spacing',          unit: 'µm',    min: 35,  max: 100, centroid: 50,  std: 18,  includeInMahalanobis: true },
      t:   { label: 'Powder Layer Thickness',unit: 'µm',    min: 30,  max: 85,  centroid: 50,  std: 15,  includeInMahalanobis: true },
      T0:  { label: 'Bed Drying Temp',       unit: '°C',    min: 25,  max: 210, centroid: 180, std: 45,  includeInMahalanobis: true },
      ved: { label: 'Effective Energy Density', unit: 'J/mm³', min: 35, max: 200, centroid: 110, std: 40, includeInMahalanobis: false }
    }
  }
};

export function resolveProcessEnvelope(processId?: string): ProcessReferenceEnvelope {
  const norm = (processId || 'lpbf').toLowerCase().trim();
  if (norm === 'bj' || norm === 'binder-jetting') return PROCESS_REFERENCE_ENVELOPES['binder-jetting'];
  if (norm === 'ded' || norm === 'ded-laser') return PROCESS_REFERENCE_ENVELOPES['ded-laser'];
  if (norm === 'waam') return PROCESS_REFERENCE_ENVELOPES.waam;
  return PROCESS_REFERENCE_ENVELOPES.lpbf;
}

/**
 * Evaluates the current parameter vector [P, v, h, t, T0, ved] against the validated
 * literature training envelope (N = 178 indexed studies).
 */
export function evaluateOodRisk(
  params: ProcessParameterVector,
  processId: string = 'lpbf'
): OodEvaluationResult {
  const env = resolveProcessEnvelope(processId);
  const P = Number.isFinite(params.P) ? params.P : env.nominalBaseline.P;
  const v = Number.isFinite(params.v) ? params.v : env.nominalBaseline.v;
  const h = Number.isFinite(params.h) ? params.h : env.nominalBaseline.h;
  const t = Number.isFinite(params.t) ? params.t : env.nominalBaseline.t;
  const T0 = Number.isFinite(params.T0) ? params.T0 : env.nominalBaseline.T0;

  // Compute Volumetric Energy Density (J/mm³) in canonical units: P / (v * (h*1e-3) * (t*1e-3))
  const computedVed = (P * 1e6) / Math.max(1e-6, v * h * t);
  const ved = Number.isFinite(params.ved) ? Number(params.ved) : Number(computedVed.toFixed(1));

  const vectorMap: Record<'P' | 'v' | 'h' | 't' | 'T0' | 'ved', number> = {
    P,
    v,
    h,
    t,
    T0,
    ved: Number(ved.toFixed(1))
  };

  let sumSq = 0;
  const violations: string[] = [];

  (Object.keys(env.parameters) as Array<keyof typeof env.parameters>).forEach((key) => {
    const spec = env.parameters[key];
    const val = vectorMap[key];

    if (spec.includeInMahalanobis && spec.std > 0) {
      const z = (val - spec.centroid) / spec.std;
      sumSq += z * z;
    }

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

  const dMRaw = Math.sqrt(sumSq);
  const mahalanobisDistance = Number(dMRaw.toFixed(2));

  let status: OodStatus = 'in_distribution';
  if (mahalanobisDistance > 3.5 || violations.length > 0) {
    status = 'extrapolating';
  } else if (mahalanobisDistance > 2.5) {
    status = 'boundary';
  }

  let piMultiplier = 1.0;
  if (status !== 'in_distribution') {
    // Scales smoothly from 1.0 (at dM = 2.5) up to 2.2 (at dM >= 6.0);
    // if hard bounds are violated even at moderate dM, ensure effective dM >= 3.6 + 0.25 * violations.length
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
    studyCount: env.studyCount
  };
}
