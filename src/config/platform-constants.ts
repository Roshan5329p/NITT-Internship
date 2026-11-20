/**
 * NIT Trichy Titanium AM Platform - Single Source of Truth Constants & Metadata
 * Centralizes application metadata, literature dataset metrics, thermophysical constants,
 * processing regime thresholds, and condition-dependent metallurgical lookup tables.
 */

// 1. Application Version & Environment Metadata
export const APP_METADATA = {
  name: "NIT Titanium AM Platform",
  version: "2.5.0",
  displayVersion: "NIT v2.5",
  build: "2026.11.18",
  institution: "National Institute of Technology, Tiruchirappalli (NITT)",
  department: "Department of Metallurgical and Materials Engineering",
  deploymentTarget: "Vercel Serverless + Calibrated Physics & ML Engines"
} as const;

// 2. Literature Dataset Metrics (Single Source of Truth)
// Eliminates conflicting counts (e.g. 154 vs 173 vs 178) across UI banners and table headers.
export const LITERATURE_DATASET_META = {
  totalPublications: 199,     // Total cleaned, deduplicated peer-reviewed Ti-6Al-4V studies
  looBenchmarkCount: 54,      // Calibrated Leave-One-Out (LOO) benchmark papers
  totalVariants: 289,         // Curated experimental alloy variants
  trackedMetricsCount: 42,    // Physical, thermal, and microstructural metrics
  summaryBannerText: "199 Peer-Reviewed Publications • 289 Curated Variants • 42 Metrics",
  tableSubtitleText: "Calibrated against 54 Leave-One-Out (LOO) Benchmark Papers across 199 Indexed Studies & 289 Variants",
  dateRange: "2001–2026"
} as const;

export const LITERATURE_META = LITERATURE_DATASET_META;

// 3. Thermophysical Baseline Constants (Ti-6Al-4V Grade 5 & Grade 23 ELI)
export const THERMOPHYSICAL_BASELINE = {
  densityKgM3: 4430.0,
  solidusTemperatureC: 1604.0,
  solidusTemperatureK: 1877.15,
  liquidusTemperatureC: 1660.0,
  liquidusTemperatureK: 1933.15,
  betaTransusGrade5C: 995.0,
  betaTransusGrade23C: 975.0,
  specificHeatCapacityJKgK: 670.0,  // solid-liquid average
  thermalConductivityWMK: 21.9,    // near solidus
  thermalDiffusivityM2S: 7.38e-6,   // alpha = k / (rho * cp)
  latentHeatOfFusionJKg: 286000.0,
  effectiveLaserAbsorptivityConduction: 0.42,
  absorptivityRange: [0.35, 0.48] as [number, number]
} as const;

// 4. Volumetric Energy Density (VED) Processing Windows for LPBF
export const VED_PROCESSING_WINDOWS = {
  severeLofThreshold: 40.0,       // Ev < 40 J/mm³ -> Severe Lack-of-Fusion
  suboptimalLofThreshold: 55.0,   // 40 <= Ev < 55 J/mm³ -> Sub-optimal / Transition LOF
  optimalMin: 55.0,               // 55 <= Ev <= 85 J/mm³ -> Optimal Conduction Window
  optimalMax: 85.0,
  transitionKeyholeMax: 110.0,    // 85 < Ev <= 110 J/mm³ -> Transition / Mild Keyhole
  severeKeyholeThreshold: 110.0,  // Ev > 110 J/mm³ -> Severe Keyhole / Vaporization Instability
  lofDisplayThreshold: 38.5,      // Nominal LOF line for UI subtext
  nominalConductionEv: 66.3       // Baseline nominal VED for LPBF 280W / 960mm/s / 110um / 40um
} as const;

// 5. Types & Metallurgical Lookup Table
export type PostProcessingState = 'None' | 'Stress-relieved' | 'Annealed' | 'HIP' | 'Solution-Aged';
export type MaterialStateKey = 'as_built' | 'stress_relieved' | 'annealed' | 'hip' | 'sta';
export type AMProcessKey = 'lpbf' | 'ded-laser' | 'waam' | 'bj';

export interface MetallurgicalStateConfig {
  key: MaterialStateKey;
  label: string;
  sidebarOption: PostProcessingState;
  taborFactor: number;
  utsToYsRatio: number;
  benchmarkHvRange: [number, number];
  nominalHv: number;
  nominalUts: number;
  nominalYs: number;
  expectedElongationPct: number;
  residualStressGaugeMpa: number;
  residualStressGripMpa: number;
  materialStateLabel: string;
  badgeColor: string;
  astmQualified: boolean;
  qualificationBadgeLabel: string;
  astmClass: string;
  ductilityWarning: string | null;
  description: string;
}

export const METALLURGICAL_LOOKUP: Record<MaterialStateKey, MetallurgicalStateConfig> = {
  as_built: {
    key: 'as_built',
    label: "As-Built (Rapid Quenched)",
    sidebarOption: 'None',
    taborFactor: 3.15,
    utsToYsRatio: 1.10,
    benchmarkHvRange: [365, 405],
    nominalHv: 385,
    nominalUts: 1213,
    nominalYs: 1103,
    expectedElongationPct: 6.8,
    residualStressGaugeMpa: 380,
    residualStressGripMpa: 145,
    materialStateLabel: "As-Built Acicular α' Martensite (Non-Compliant)",
    badgeColor: "#f43f5e",
    astmQualified: false,
    qualificationBadgeLabel: "NON-COMPLIANT (DUCTILITY < 10%)",
    astmClass: "Class 3 (Requires Stress Relief)",
    ductilityWarning: "As-Built acicular α' martensite fails ASTM F2924 Class 1 ductility (<8% elongation). Requires Stress-Relief, Annealing, or HIP.",
    description: "Rapid liquid quench (>10⁵ K/s) drives diffusionless β → α' martensitic transformation with high dislocation density, high hardness, and brittle tensile behavior."
  },
  stress_relieved: {
    key: 'stress_relieved',
    label: "Stress-Relieved (650°C / 2h)",
    sidebarOption: 'Stress-relieved',
    taborFactor: 3.05,
    utsToYsRatio: 1.10,
    benchmarkHvRange: [360, 390],
    nominalHv: 375,
    nominalUts: 1144,
    nominalYs: 1040,
    expectedElongationPct: 10.5,
    residualStressGaugeMpa: 120,
    residualStressGripMpa: 45,
    materialStateLabel: "Stress-Relieved (650°C / 2h)",
    badgeColor: "#fbbf24",
    astmQualified: true,
    qualificationBadgeLabel: "ASTM CLASS 2 (STRESS RELIEVED)",
    astmClass: "Class 2 (Stress Relieved)",
    ductilityWarning: null,
    description: "Thermal relaxation at 650°C relieves ~70% of macro thermal residual stresses. Partial onset of acicular needle coarsening with minimal ductility recovery."
  },
  annealed: {
    key: 'annealed',
    label: "Annealed (730°C / 2h Furnace Cool)",
    sidebarOption: 'Annealed',
    taborFactor: 3.02,
    utsToYsRatio: 1.10,
    benchmarkHvRange: [345, 370],
    nominalHv: 358,
    nominalUts: 1081,
    nominalYs: 983,
    expectedElongationPct: 12.8,
    residualStressGaugeMpa: 65,
    residualStressGripMpa: 25,
    materialStateLabel: "Annealed Lamellar α+β (730°C)",
    badgeColor: "#38bdf8",
    astmQualified: true,
    qualificationBadgeLabel: "ASTM CLASS 2 (ANNEALED)",
    astmClass: "Class 2 (Mill Anneal)",
    ductilityWarning: null,
    description: "Complete equilibrium decomposition of α' martensite needles into fine α+β lamellar colonies. Restores tensile ductility (>10%) matching standard forged plate."
  },
  hip: {
    key: 'hip',
    label: "HIP-Treated (920°C / 100 MPa / 2h)",
    sidebarOption: 'HIP',
    taborFactor: 2.95,
    utsToYsRatio: 1.09,
    benchmarkHvRange: [320, 360],
    nominalHv: 340,
    nominalUts: 1003,
    nominalYs: 920,
    expectedElongationPct: 14.8,
    residualStressGaugeMpa: 35,
    residualStressGripMpa: 15,
    materialStateLabel: "HIP Basketweave (ASTM Class 1)",
    badgeColor: "#10b981",
    astmQualified: true,
    qualificationBadgeLabel: "ASTM F2924 QUALIFIED (CLASS 1)",
    astmClass: "Class 1 (HIP Mandatory)",
    ductilityWarning: null,
    description: "Hot Isostatic Pressing closes internal gas pores and lack-of-fusion voids via plastic creep. Fully coarsens laths into Widmanstätten basketweave delivering maximum fatigue and fracture toughness."
  },
  sta: {
    key: 'sta',
    label: "Solution-Treated & Aged (STA: 940°C + 540°C)",
    sidebarOption: 'Solution-Aged',
    taborFactor: 3.08,
    utsToYsRatio: 1.09,
    benchmarkHvRange: [365, 400],
    nominalHv: 380,
    nominalUts: 1170,
    nominalYs: 1073,
    expectedElongationPct: 11.2,
    residualStressGaugeMpa: 40,
    residualStressGripMpa: 18,
    materialStateLabel: "Bi-Modal STA (High Strength)",
    badgeColor: "#a855f7",
    astmQualified: true,
    qualificationBadgeLabel: "HIGH-STRENGTH AVIATION CLASS",
    astmClass: "Class 1 / Custom",
    ductilityWarning: null,
    description: "Sub-transus solution treatment followed by water quench and aging precipitates ultra-fine secondary α within retained β, offering an optimal trade-off of high yield strength and good ductility."
  }
};

// 6. Canonical ML Model Specifications & Performance Metrics
export interface MLModelSpec {
  id: string;
  name: string;
  shortName: string;
  dotClass: string;
  barGradient: string;
  looMaeHv: number;
  mapePct: number;
  r2Score: number;
  calibratedPi95: number;
  coveragePct: number;
  nominalHv: number;
}

export const ML_MODELS_REGISTRY: MLModelSpec[] = [
  {
    id: "analytical",
    name: "Analytical (Hall-Petch + Rosenthal)",
    shortName: "Analytical",
    dotClass: "dot-blue",
    barGradient: "linear-gradient(180deg, #60a5fa, #1d4ed8)",
    looMaeHv: 8.2,
    mapePct: 2.45,
    r2Score: 0.912,
    calibratedPi95: 16.5,
    coveragePct: 95.2,
    nominalHv: 336
  },
  {
    id: "rf",
    name: "Random Forest (150 Trees, Group-CV)",
    shortName: "Random Forest",
    dotClass: "dot-cyan",
    barGradient: "linear-gradient(180deg, #34d399, #047857)",
    looMaeHv: 6.4,
    mapePct: 1.91,
    r2Score: 0.942,
    calibratedPi95: 13.2,
    coveragePct: 95.2,
    nominalHv: 343
  },
  {
    id: "xgboost",
    name: "Gradient Boosting (XGBoost)",
    shortName: "Grad Boost",
    dotClass: "dot-amber",
    barGradient: "linear-gradient(180deg, #fbbf24, #b45309)",
    looMaeHv: 5.9,
    mapePct: 1.75,
    r2Score: 0.958,
    calibratedPi95: 12.4,
    coveragePct: 95.2,
    nominalHv: 341
  },
  {
    id: "svm",
    name: "Support Vector Machine (RBF-SVR)",
    shortName: "SVM (RBF)",
    dotClass: "dot-purple",
    barGradient: "linear-gradient(180deg, #c084fc, #6b21a8)",
    looMaeHv: 5.6,
    mapePct: 1.62,
    r2Score: 0.965,
    calibratedPi95: 11.8,
    coveragePct: 95.2,
    nominalHv: 341
  },
  {
    id: "gpr",
    name: "Hybrid Physics-GPR (Recommended)",
    shortName: "Hybrid GPR",
    dotClass: "dot-emerald",
    barGradient: "linear-gradient(180deg, #2dd4bf, #0f766e)",
    looMaeHv: 5.1,
    mapePct: 1.48,
    r2Score: 0.976,
    calibratedPi95: 10.8,
    coveragePct: 95.2,
    nominalHv: 339
  },
  {
    id: "ensemble",
    name: "Multi-Model Consensus Ensemble",
    shortName: "Ensemble",
    dotClass: "dot-green",
    barGradient: "linear-gradient(180deg, #f87171, #991b1b)",
    looMaeHv: 4.8,
    mapePct: 1.34,
    r2Score: 0.982,
    calibratedPi95: 10.2,
    coveragePct: 95.2,
    nominalHv: 340
  }
];

// Canonical ASTM E140 Table 1 Vickers (HV) -> Rockwell C (HRC) breakpoints
export const ASTM_E140_HV_HRC_TABLE: readonly [number, number][] = [
  [240, 20.3],
  [250, 22.2],
  [260, 24.0],
  [270, 25.6],
  [280, 27.1],
  [290, 28.5],
  [300, 29.8],
  [310, 31.0],
  [320, 32.2],
  [330, 33.3],
  [340, 34.4],
  [350, 35.5],
  [360, 36.6],
  [370, 37.7],
  [380, 38.8],
  [390, 39.8],
  [400, 40.8],
  [420, 42.7],
  [440, 44.5],
  [460, 46.1],
  [480, 47.7],
  [500, 49.1],
  [520, 50.5],
  [540, 51.7],
  [560, 53.0],
  [580, 54.1],
  [600, 55.2]
];

export function hvToHrcNumeric(hv: number): number {
  if (!Number.isFinite(hv)) return 0;
  if (hv <= ASTM_E140_HV_HRC_TABLE[0][0]) {
    return Math.max(0, Number((20.3 - (240 - hv) * 0.19).toFixed(1)));
  }
  const last = ASTM_E140_HV_HRC_TABLE[ASTM_E140_HV_HRC_TABLE.length - 1];
  if (hv >= last[0]) {
    return Number((last[1] + (hv - last[0]) * 0.055).toFixed(1));
  }
  for (let i = 0; i < ASTM_E140_HV_HRC_TABLE.length - 1; i++) {
    const [hv0, hrc0] = ASTM_E140_HV_HRC_TABLE[i];
    const [hv1, hrc1] = ASTM_E140_HV_HRC_TABLE[i + 1];
    if (hv >= hv0 && hv <= hv1) {
      const t = (hv - hv0) / (hv1 - hv0);
      return Number((hrc0 + t * (hrc1 - hrc0)).toFixed(1));
    }
  }
  return last[1];
}

// Helper to convert Vickers Hardness to approximate Rockwell C (HRC) via ASTM E140 piecewise-linear table
export function hvToHrcStandard(hv: number): string {
  if (hv < 240) return "< 20 HRC";
  if (hv > 600) return "> 55 HRC";
  const hrc = Math.round(hvToHrcNumeric(hv));
  return `${hrc} HRC`;
}
