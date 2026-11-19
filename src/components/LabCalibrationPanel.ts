/**
 * NIT Trichy Titanium AM Platform — Lab Coupon CSV Parser & Bayesian Calibration Engine
 * Parses experimental Ti-6Al-4V build coupon measurements, computes live MAE / RMSE / bias,
 * and applies shrinkage-regularized Bayesian bias correction to predictions.
 */

export interface LabCouponRecord {
  sample_id: string;
  process: 'lpbf' | 'ded-laser' | 'waam' | 'binder-jetting';
  P_W: number;
  v_mm_s: number;
  h_um: number;
  t_um: number;
  T0_C: number;
  post_proc: string;
  measured_HV?: number;
  measured_YS_MPa?: number;
  measured_UTS_MPa?: number;
  measured_elong_pct?: number;
}

export interface CsvValidationError {
  rowNumber: number;
  rawLine: string;
  reason: string;
}

export interface ParsedLabCsvResult {
  coupons: LabCouponRecord[];
  errors: CsvValidationError[];
  validCount: number;
  rejectedCount: number;
}

export interface MetricCalibrationStats {
  count: number;
  mae: number;
  rmse: number;
  meanBias: number;          // mean(measured - predicted)
  bayesianBiasShift: number; // shrinkage-weighted N / (N + 4) * meanBias
}

export interface LabCalibrationSummary {
  sampleCount: number;
  hv: MetricCalibrationStats;
  ys: MetricCalibrationStats;
  uts: MetricCalibrationStats;
  elong: MetricCalibrationStats;
  calibrationLabel: string;
}

export const SAMPLE_LAB_CSV_TEMPLATE = [
  'sample_id,process,P_W,v_mm_s,h_um,t_um,T0_C,post_proc,measured_HV,measured_YS_MPa,measured_UTS_MPa,measured_elong_pct',
  'NITT-LPBF-01,lpbf,280,960,110,40,200,HIP,342,912,996,14.8',
  'NITT-LPBF-02,lpbf,320,1150,110,45,200,HIP,336,895,982,15.1',
  'NITT-LPBF-03,lpbf,240,850,100,30,180,Stress-relieved,374,985,1072,10.2',
  'NITT-LDED-01,ded-laser,1600,15,1200,450,100,HIP,326,872,960,15.6'
].join('\n');

const REQUIRED_HEADERS = [
  'sample_id',
  'process',
  'P_W',
  'v_mm_s',
  'h_um',
  't_um',
  'T0_C',
  'post_proc'
] as const;

export function normalizeLabProcessId(raw: string): LabCouponRecord['process'] | null {
  const s = (raw || '').toLowerCase().trim();
  if (s === 'lpbf' || s === 'slm' || s === 'pbf') return 'lpbf';
  if (s === 'lded' || s === 'l-ded' || s === 'ded-laser' || s === 'ded') return 'ded-laser';
  if (s === 'waam') return 'waam';
  if (s === 'bj' || s === 'binder-jetting' || s === 'binder_jetting') return 'binder-jetting';
  return null;
}

function parseOptionalPositive(raw: string | undefined): { valid: boolean; value?: number } {
  if (raw === undefined || raw.trim() === '') return { valid: true, value: undefined };
  const num = Number(raw.trim());
  if (!Number.isFinite(num) || num <= 0) return { valid: false };
  return { valid: true, value: num };
}

/**
 * Validates and parses NIT Trichy experimental lab coupon CSV text.
 * Rejects malformed rows individually while preserving valid records and never crashing.
 */
export function parseLabCouponsCsv(csvText: string): ParsedLabCsvResult {
  if (!csvText || !csvText.trim()) {
    return {
      coupons: [],
      errors: [{ rowNumber: 0, rawLine: '', reason: 'CSV content is empty.' }],
      validCount: 0,
      rejectedCount: 0
    };
  }

  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      coupons: [],
      errors: [{ rowNumber: 1, rawLine: lines[0] || '', reason: 'CSV must contain a header row and at least one coupon data row.' }],
      validCount: 0,
      rejectedCount: 0
    };
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const missingHeaders = REQUIRED_HEADERS.filter((req) => !headers.includes(req));
  if (missingHeaders.length > 0) {
    return {
      coupons: [],
      errors: [{ rowNumber: 1, rawLine: lines[0], reason: `Missing required CSV columns: ${missingHeaders.join(', ')}` }],
      validCount: 0,
      rejectedCount: 0
    };
  }

  const colIdx = new Map<string, number>();
  headers.forEach((h, i) => colIdx.set(h, i));

  const coupons: LabCouponRecord[] = [];
  const errors: CsvValidationError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const parts = rawLine.split(',').map((p) => p.trim());
    if (parts.length < headers.length - 4) {
      errors.push({ rowNumber: i + 1, rawLine, reason: 'Too few comma-separated fields.' });
      continue;
    }

    const get = (name: string): string => {
      const idx = colIdx.get(name);
      return idx !== undefined && idx < parts.length ? parts[idx] : '';
    };

    const sample_id = get('sample_id');
    const proc = normalizeLabProcessId(get('process'));
    const P_W = Number(get('P_W'));
    const v_mm_s = Number(get('v_mm_s'));
    const h_um = Number(get('h_um'));
    const t_um = Number(get('t_um'));
    const T0_raw = get('T0_C');
    const T0_C = T0_raw === '' ? 25 : Number(T0_raw);
    const post_proc = get('post_proc') || 'HIP';

    if (!sample_id) {
      errors.push({ rowNumber: i + 1, rawLine, reason: 'Missing sample_id.' });
      continue;
    }
    if (!proc) {
      errors.push({ rowNumber: i + 1, rawLine, reason: `Unsupported AM process '${get('process')}'. Expected lpbf, ded-laser, waam, or binder-jetting.` });
      continue;
    }
    if (!Number.isFinite(P_W) || P_W <= 0 || !Number.isFinite(v_mm_s) || v_mm_s <= 0 || !Number.isFinite(h_um) || h_um <= 0 || !Number.isFinite(t_um) || t_um <= 0 || !Number.isFinite(T0_C) || T0_C < 0) {
      errors.push({ rowNumber: i + 1, rawLine, reason: 'Invalid numeric process parameter (P_W, v_mm_s, h_um, t_um must be > 0; T0_C >= 0).' });
      continue;
    }

    const hvParsed = parseOptionalPositive(get('measured_HV'));
    const ysParsed = parseOptionalPositive(get('measured_YS_MPa'));
    const utsParsed = parseOptionalPositive(get('measured_UTS_MPa'));
    const elParsed = parseOptionalPositive(get('measured_elong_pct'));

    if (!hvParsed.valid || !ysParsed.valid || !utsParsed.valid || !elParsed.valid) {
      errors.push({ rowNumber: i + 1, rawLine, reason: 'Measured property contains non-numeric or non-positive value.' });
      continue;
    }
    if (
      hvParsed.value === undefined &&
      ysParsed.value === undefined &&
      utsParsed.value === undefined &&
      elParsed.value === undefined
    ) {
      errors.push({ rowNumber: i + 1, rawLine, reason: 'Row must contain at least one measured output (HV, YS, UTS, or Elongation).' });
      continue;
    }

    coupons.push({
      sample_id,
      process: proc,
      P_W,
      v_mm_s,
      h_um,
      t_um,
      T0_C,
      post_proc,
      measured_HV: hvParsed.value,
      measured_YS_MPa: ysParsed.value,
      measured_UTS_MPa: utsParsed.value,
      measured_elong_pct: elParsed.value
    });
  }

  return {
    coupons,
    errors,
    validCount: coupons.length,
    rejectedCount: errors.length
  };
}

function summarizeResiduals(residuals: number[], shrinkageK: number = 4): MetricCalibrationStats {
  const n = residuals.length;
  if (n === 0) {
    return { count: 0, mae: 0, rmse: 0, meanBias: 0, bayesianBiasShift: 0 };
  }
  let sumAbs = 0;
  let sumSq = 0;
  let sumSigned = 0;
  for (const r of residuals) {
    sumAbs += Math.abs(r);
    sumSq += r * r;
    sumSigned += r;
  }
  const mae = Number((sumAbs / n).toFixed(2));
  const rmse = Number(Math.sqrt(sumSq / n).toFixed(2));
  const meanBias = Number((sumSigned / n).toFixed(2));
  // Conjugate normal-normal shrinkage: prevents overfitting when N is small (1-3 coupons)
  const shrinkageWeight = n / (n + shrinkageK);
  const bayesianBiasShift = Number((shrinkageWeight * meanBias).toFixed(2));
  return { count: n, mae, rmse, meanBias, bayesianBiasShift };
}

export interface PredictedCouponValues {
  hv: number;
  ysMpa: number;
  utsMpa: number;
  elongPct: number;
}

/**
 * Computes calibration residual metrics (MAE, RMSE, Mean Bias) and Empirical-Bayes
 * shrinkage bias shifts across all uploaded lab coupons.
 */
export function computeLabCalibrationStats(
  coupons: readonly LabCouponRecord[],
  predictFn: (coupon: LabCouponRecord) => PredictedCouponValues
): LabCalibrationSummary {
  const resHv: number[] = [];
  const resYs: number[] = [];
  const resUts: number[] = [];
  const resEl: number[] = [];

  for (const c of coupons) {
    const pred = predictFn(c);
    if (c.measured_HV !== undefined && Number.isFinite(pred.hv)) {
      resHv.push(c.measured_HV - pred.hv);
    }
    if (c.measured_YS_MPa !== undefined && Number.isFinite(pred.ysMpa)) {
      resYs.push(c.measured_YS_MPa - pred.ysMpa);
    }
    if (c.measured_UTS_MPa !== undefined && Number.isFinite(pred.utsMpa)) {
      resUts.push(c.measured_UTS_MPa - pred.utsMpa);
    }
    if (c.measured_elong_pct !== undefined && Number.isFinite(pred.elongPct)) {
      resEl.push(c.measured_elong_pct - pred.elongPct);
    }
  }

  return {
    sampleCount: coupons.length,
    hv: summarizeResiduals(resHv),
    ys: summarizeResiduals(resYs),
    uts: summarizeResiduals(resUts),
    elong: summarizeResiduals(resEl),
    calibrationLabel: coupons.length > 0 ? `LAB-CALIBRATED (N=${coupons.length})` : 'RAW LITERATURE MODEL'
  };
}

export function applyBayesianBiasCorrection(
  rawValue: number,
  metricStats: MetricCalibrationStats | undefined,
  enabled: boolean
): number {
  if (!enabled || !metricStats || metricStats.count === 0 || !Number.isFinite(metricStats.bayesianBiasShift)) {
    return rawValue;
  }
  return rawValue + metricStats.bayesianBiasShift;
}
