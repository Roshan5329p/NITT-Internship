/**
 * NIT Trichy Titanium AM Platform — Bi-Directional URL Query-String State Sync
 * Maps dashboard state to compact query parameters:
 *   ?proc=lpbf&alloy=ti64_gr5&P=280&v=960&h=110&t=40&db=80&T0=200&post=HIP&model=ensemble
 * Includes safe hydration with strict finite & slider-bound clamping, plus 250 ms debounced history.replaceState.
 */

import { PROCESS_REFERENCE_ENVELOPES, resolveProcessEnvelope } from '../lib/ood-detector';
import type { PostProcessingState } from '../config/platform-constants';

export type ValidProcessId = 'lpbf' | 'ded-laser' | 'waam' | 'binder-jetting';
export type ValidAlloyId = 'ti64_gr5' | 'ti64_eli';
export type ValidModelId = 'analytical' | 'rf' | 'xgboost' | 'svm' | 'gpr' | 'ensemble';

export interface DashboardUrlState {
  proc: ValidProcessId;
  alloy: ValidAlloyId;
  P: number;
  v: number;
  h: number;
  t: number;
  db: number;
  T0: number;
  post: PostProcessingState;
  model: ValidModelId;
}

const ALLOWED_PROCESSES: readonly ValidProcessId[] = ['lpbf', 'ded-laser', 'waam', 'binder-jetting'];
const ALLOWED_ALLOYS: readonly ValidAlloyId[] = ['ti64_gr5', 'ti64_eli'];
const ALLOWED_MODELS: readonly ValidModelId[] = ['analytical', 'rf', 'xgboost', 'svm', 'gpr', 'ensemble'];
const ALLOWED_POST_STATES: readonly PostProcessingState[] = [
  'None',
  'Stress-relieved',
  'Annealed',
  'HIP',
  'Solution-Aged'
];

function sanitizeProcessId(raw?: string | null): ValidProcessId {
  if (!raw) return 'lpbf';
  const norm = raw.toLowerCase().trim();
  if (norm === 'bj' || norm === 'binder-jetting') return 'binder-jetting';
  if (norm === 'ded' || norm === 'ded-laser') return 'ded-laser';
  if ((ALLOWED_PROCESSES as readonly string[]).includes(norm)) return norm as ValidProcessId;
  return 'lpbf';
}

function sanitizeAlloyId(raw?: string | null): ValidAlloyId {
  if (!raw) return 'ti64_gr5';
  const norm = raw.toLowerCase().trim();
  if (norm === 'ti64_eli' || norm === 'ti64_gr23' || norm === 'eli') return 'ti64_eli';
  if ((ALLOWED_ALLOYS as readonly string[]).includes(norm)) return norm as ValidAlloyId;
  return 'ti64_gr5';
}

function sanitizePostState(raw?: string | null): PostProcessingState {
  if (!raw) return 'HIP';
  const trimmed = raw.trim();
  if ((ALLOWED_POST_STATES as readonly string[]).includes(trimmed)) {
    return trimmed as PostProcessingState;
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'none' || lower === 'as_built' || lower === 'as-built') return 'None';
  if (lower === 'stress-relieved' || lower === 'stress_relieved') return 'Stress-relieved';
  if (lower === 'annealed') return 'Annealed';
  if (lower === 'hip') return 'HIP';
  if (lower === 'solution-aged' || lower === 'solution_aged' || lower === 'sta') return 'Solution-Aged';
  return 'HIP';
}

function sanitizeModelId(raw?: string | null): ValidModelId {
  if (!raw) return 'ensemble';
  const lower = raw.toLowerCase().trim();
  if (lower === 'hybridgpr' || lower === 'hybrid-gpr' || lower === 'hybrid_gpr') return 'gpr';
  if ((ALLOWED_MODELS as readonly string[]).includes(lower)) return lower as ValidModelId;
  return 'ensemble';
}

function clampFiniteNumber(
  raw: string | number | null | undefined,
  fallback: number,
  bounds: [number, number]
): number {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    return fallback;
  }
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(bounds[0], Math.min(bounds[1], num));
}

/**
 * Safely parses a URL query string (`window.location.search`) into a validated DashboardUrlState.
 * Any malformed, out-of-range, or NaN values gracefully fall back or clamp to valid process bounds.
 */
export function parseUrlDashboardState(search: string): DashboardUrlState {
  const params = new URLSearchParams(search || '');
  const proc = sanitizeProcessId(params.get('proc'));
  const env = resolveProcessEnvelope(proc) || PROCESS_REFERENCE_ENVELOPES.lpbf;
  const base = env.nominalBaseline;
  const bounds = env.sliderBounds;

  return {
    proc,
    alloy: sanitizeAlloyId(params.get('alloy')),
    P: clampFiniteNumber(params.get('P'), base.P, bounds.P),
    v: clampFiniteNumber(params.get('v'), base.v, bounds.v),
    h: clampFiniteNumber(params.get('h'), base.h, bounds.h),
    t: clampFiniteNumber(params.get('t'), base.t, bounds.t),
    db: clampFiniteNumber(params.get('db'), base.db, bounds.db),
    T0: clampFiniteNumber(params.get('T0'), base.T0, bounds.T0),
    post: sanitizePostState(params.get('post')),
    model: sanitizeModelId(params.get('model'))
  };
}

/**
 * Serializes a DashboardUrlState into the canonical compact query string:
 * `?proc=lpbf&alloy=ti64_gr5&P=280&v=960&h=110&t=40&db=80&T0=200&post=HIP&model=ensemble`
 */
export function serializeDashboardStateToQuery(state: DashboardUrlState): string {
  const params = new URLSearchParams();
  params.set('proc', state.proc);
  params.set('alloy', state.alloy);
  params.set('P', String(state.P));
  params.set('v', String(state.v));
  params.set('h', String(state.h));
  params.set('t', String(state.t));
  params.set('db', String(state.db));
  params.set('T0', String(state.T0));
  params.set('post', state.post);
  params.set('model', state.model);
  return `?${params.toString()}`;
}

export interface UrlStateSyncController {
  hydrateFromWindowUrl: () => DashboardUrlState;
  scheduleSync: (state: DashboardUrlState) => void;
  flushSync: (state: DashboardUrlState) => string;
}

/**
 * Creates a bi-directional URL query-string sync controller with a 250 ms debounce for
 * `window.history.replaceState` and an immediate flush method for Share Run actions.
 */
export function useUrlStateSync(debounceMs: number = 250): UrlStateSyncController {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const writeUrlImmediate = (state: DashboardUrlState): string => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    const query = serializeDashboardStateToQuery(state);
    if (typeof window !== 'undefined' && window.history && typeof window.history.replaceState === 'function') {
      const nextUrl = `${window.location.pathname}${query}${window.location.hash || ''}`;
      window.history.replaceState(null, '', nextUrl);
      return window.location.href;
    }
    return query;
  };

  return {
    hydrateFromWindowUrl: (): DashboardUrlState => {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      return parseUrlDashboardState(search);
    },
    scheduleSync: (state: DashboardUrlState): void => {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        writeUrlImmediate(state);
      }, debounceMs);
    },
    flushSync: (state: DashboardUrlState): string => {
      return writeUrlImmediate(state);
    }
  };
}
