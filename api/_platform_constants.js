/**
 * NIT Trichy Titanium AM Platform - Single Source of Truth Constants (ESM)
 * Mirror of src/config/platform-constants.ts for Node.js API routes & browser dashboard
 */

export const APP_METADATA = {
  name: "NIT Titanium AM Platform",
  version: "2.5.0",
  displayVersion: "NIT v2.5",
  build: "2026.11.18",
  institution: "National Institute of Technology, Tiruchirappalli (NITT)",
  department: "Department of Metallurgical and Materials Engineering",
  deploymentTarget: "Vercel Serverless + Calibrated Physics & ML Engines"
};

export const LITERATURE_DATASET_META = {
  totalPublications: 214,
  looBenchmarkCount: 54,
  totalVariants: 289,
  trackedMetricsCount: 42,
  summaryBannerText: "214 Indexed Publications • 289 Curated Variants • 42 Metrics",
  tableSubtitleText: "Calibrated against 54 LOO Benchmark Papers across 214 Indexed Studies & 289 Variants",
  dateRange: "2001–2026"
};

export const THERMOPHYSICAL_BASELINE = {
  densityKgM3: 4430.0,
  solidusTemperatureC: 1604.0,
  solidusTemperatureK: 1877.15,
  liquidusTemperatureC: 1660.0,
  liquidusTemperatureK: 1933.15,
  betaTransusGrade5C: 995.0,
  betaTransusGrade23C: 975.0,
  specificHeatCapacityJKgK: 670.0,
  thermalConductivityWMK: 21.9,
  thermalDiffusivityM2S: 7.38e-6,
  latentHeatOfFusionJKg: 286000.0,
  effectiveLaserAbsorptivityConduction: 0.42,
  absorptivityRange: [0.35, 0.48]
};

export const VED_PROCESSING_WINDOWS = {
  severeLofThreshold: 40.0,
  suboptimalLofThreshold: 55.0,
  optimalMin: 55.0,
  optimalMax: 85.0,
  transitionKeyholeMax: 110.0,
  severeKeyholeThreshold: 110.0,
  lofDisplayThreshold: 38.5,
  nominalConductionEv: 66.3
};

export const METALLURGICAL_LOOKUP = {
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

export const ML_MODELS_REGISTRY = [
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

export function hvToHrcStandard(hv) {
  if (hv < 240) return "< 20 HRC";
  if (hv > 600) return "> 55 HRC";
  const hrc = Math.round(0.088 * hv - 3.8);
  return `${hrc} HRC`;
}
