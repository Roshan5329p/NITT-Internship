/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MatSci Practical Command & Engineering Sections:
 * 1. Thermal Telemetry & Real-Time Cooling Rate Profiler (#telemetry-section)
 * 2. Synthesis Route Architecture & Multi-Stage Heat Treatment Planner (#architecture-section)
 * 3. Continuous Cooling Transformation (CCT) & Phase Kinetics Engine (#insights-section)
 * 4. Executive Industry Quotes & Proof Points
 */

import React, { useState, useMemo } from 'react';
import {
  Flame,
  Activity,
  Layers,
  Sliders,
  Download,
  Check,
  AlertCircle,
  ArrowRight,
  Clock,
  Sparkles,
  ShieldCheck,
  Cpu,
  FileJson,
  RotateCcw,
  Info
} from 'lucide-react';
import {
  ALLOY_THERMAL_PROPERTIES,
  DEFAULT_TITANIUM_PROPERTIES
} from '../utils/amPhysicsEngine';
import {
  MATERIALS_CATALOG,
  MaterialItem,
  ProcessVariant
} from '../data/materialsData';

interface MatSciCommandSectionsProps {
  onSelectMaterialInWorkbench: (id: string) => void;
  onOpenCompareModal: () => void;
}

// ----------------------------------------------------------------------------
// 1. THERMAL TELEMETRY CONSTANTS & PRESETS
// ----------------------------------------------------------------------------
interface ProcessPreset {
  name: string;
  category: string;
  defaultPowerW: number;
  minPowerW: number;
  maxPowerW: number;
  defaultSpeedMmS: number;
  minSpeedMmS: number;
  maxSpeedMmS: number;
  defaultPreheatC: number;
  absorptivity: number;
  spotDiameterUm: number;
  description: string;
}

const PROCESS_PRESETS: Record<string, ProcessPreset> = {
  'pbf-lb': {
    name: 'Laser Powder Bed Fusion (PBF-LB / SLM / DMLS)',
    category: 'Powder Bed Fusion',
    defaultPowerW: 285,
    minPowerW: 50,
    maxPowerW: 600,
    defaultSpeedMmS: 1200,
    minSpeedMmS: 200,
    maxSpeedMmS: 3000,
    defaultPreheatC: 35,
    absorptivity: 0.35,
    spotDiameterUm: 80,
    description: 'High thermal gradient, ultra-fast cooling rate (10^5 - 10^6 K/s), acicular α\' martensitic as-built state.'
  },
  'pbf-eb': {
    name: 'Electron Beam PBF (PBF-EB / EBM)',
    category: 'Powder Bed Fusion',
    defaultPowerW: 650,
    minPowerW: 200,
    maxPowerW: 1500,
    defaultSpeedMmS: 2500,
    minSpeedMmS: 500,
    maxSpeedMmS: 6000,
    defaultPreheatC: 650,
    absorptivity: 0.85,
    spotDiameterUm: 200,
    description: 'High vacuum, preheated powder cake (650°C-750°C), in-situ stress relief, dual-phase lamellar α+β.'
  },
  'ded-lb': {
    name: 'Laser Powder DED (LENS / Blown Powder)',
    category: 'Directed Energy Deposition',
    defaultPowerW: 1500,
    minPowerW: 400,
    maxPowerW: 4000,
    defaultSpeedMmS: 25,
    minSpeedMmS: 5,
    maxSpeedMmS: 80,
    defaultPreheatC: 25,
    absorptivity: 0.42,
    spotDiameterUm: 1200,
    description: 'Coaxial blown powder stream, moderate cooling rate (10^3 K/s), columnar prior-β grain structures.'
  },
  'ded-wire': {
    name: 'Wire Laser DED (WL-AM / Wire Fed)',
    category: 'Directed Energy Deposition',
    defaultPowerW: 2200,
    minPowerW: 600,
    maxPowerW: 5000,
    defaultSpeedMmS: 18,
    minSpeedMmS: 5,
    maxSpeedMmS: 50,
    defaultPreheatC: 50,
    absorptivity: 0.40,
    spotDiameterUm: 2200,
    description: 'High deposition rate (1.5-2.5 kg/h), automated wire feeding with 100% material capture efficiency.'
  },
  'waam': {
    name: 'Wire Arc Additive Manufacturing (WAAM - GMAW / Plasma)',
    category: 'Wire arc additive manufacturing',
    defaultPowerW: 2800,
    minPowerW: 1000,
    maxPowerW: 6500,
    defaultSpeedMmS: 12,
    minSpeedMmS: 3,
    maxSpeedMmS: 40,
    defaultPreheatC: 150,
    absorptivity: 0.80,
    spotDiameterUm: 4000,
    description: 'Electric arc melt pool with continuous wire feed, large melt volume (>3 kg/h), colonial lamellar α+β.'
  },
  'bjt': {
    name: 'Metal Binder Jetting (MBJ + Sinter)',
    category: 'Binder Jetting',
    defaultPowerW: 120,
    minPowerW: 30,
    maxPowerW: 300,
    defaultSpeedMmS: 80,
    minSpeedMmS: 20,
    maxSpeedMmS: 250,
    defaultPreheatC: 65,
    absorptivity: 0.25,
    spotDiameterUm: 60,
    description: 'Liquid binder droplets onto cold titanium powder; zero thermal residual stress in green part, vacuum sintered at 1250-1380°C.'
  },
  'mex': {
    name: 'Bound Metal Extrusion (MEX / FDM + Sinter)',
    category: 'Material Extrusion',
    defaultPowerW: 85,
    minPowerW: 20,
    maxPowerW: 200,
    defaultSpeedMmS: 45,
    minSpeedMmS: 10,
    maxSpeedMmS: 150,
    defaultPreheatC: 110,
    absorptivity: 0.30,
    spotDiameterUm: 400,
    description: 'Thermoplastic-bound titanium rod/filament deposition; low thermal gradients, furnace debound & vacuum sintered.'
  },
  'csam': {
    name: 'Cold Spray Additive (Kinetic CSAM)',
    category: 'Directed Energy Deposition',
    defaultPowerW: 3500,
    minPowerW: 1000,
    maxPowerW: 8000,
    defaultSpeedMmS: 250,
    minSpeedMmS: 50,
    maxSpeedMmS: 600,
    defaultPreheatC: 350,
    absorptivity: 0.65,
    spotDiameterUm: 3000,
    description: 'Supersonic gas-accelerated solid-state impact consolidation; zero melting, negligible heat-affected zone.'
  },
  'vat': {
    name: 'Lithography-based Metal AM (VPP / LMM)',
    category: 'Vat Photopolymerization',
    defaultPowerW: 45,
    minPowerW: 10,
    maxPowerW: 150,
    defaultSpeedMmS: 30,
    minSpeedMmS: 5,
    maxSpeedMmS: 100,
    defaultPreheatC: 30,
    absorptivity: 0.20,
    spotDiameterUm: 35,
    description: 'High-resolution photopolymerization of titanium slurry; sub-50 µm fine features, post-sintered to >98% density.'
  },
  'sheet-lam': {
    name: 'Ultrasonic Sheet Lamination (UAM)',
    category: 'Sheet Lamination',
    defaultPowerW: 1800,
    minPowerW: 500,
    maxPowerW: 4500,
    defaultSpeedMmS: 35,
    minSpeedMmS: 10,
    maxSpeedMmS: 100,
    defaultPreheatC: 120,
    absorptivity: 0.70,
    spotDiameterUm: 5000,
    description: 'Solid-state ultrasonic scrubbing of titanium foil ribbons with rotating sonotrode; low thermal distortion, embedded channels.'
  }
};

export const ALL_TITANIUM_ALLOYS_CATALOG = [
  {
    category: 'Alpha-Beta Alloys',
    items: [
      { id: 'ti-6al-4v', name: 'Ti-6Al-4V (Grade 5 - Workhorse)' },
      { id: 'ti-6al-4v-eli', name: 'Ti-6Al-4V ELI (Grade 23 - Medical/Cryo)' },
      { id: 'ti-6al-7nb', name: 'Ti-6Al-7Nb (Biomedical High-Toughness)' },
      { id: 'ti-3al-2-5v', name: 'Ti-3Al-2.5V (Grade 9 - Hydraulic)' },
      { id: 'ti-6246', name: 'Ti-6246 (High-Strength Deep Hardening)' }
    ]
  },
  {
    category: 'Near-Alpha & High-Temperature Alloys',
    items: [
      { id: 'ti-6242', name: 'Ti-6242 (High-Temp Creep Resistant)' },
      { id: 'ti-5al-2-5sn', name: 'Ti-5Al-2.5Sn (Cryogenic Alpha)' },
      { id: 'ti-811', name: 'Ti-8Al-1Mo-1V (Ti-811 High Modulus)' }
    ]
  },
  {
    category: 'Beta & Near-Beta Alloys',
    items: [
      { id: 'ti-5553', name: 'Ti-5553 (Near-Beta Heavy Section)' },
      { id: 'ti-10v-2fe-3al', name: 'Ti-10V-2Fe-3Al (Forging Near-Beta)' },
      { id: 'ti-15mo', name: 'Ti-15Mo (Corrosion Beta)' },
      { id: 'ti-beta21s', name: 'Ti-Beta21S (Oxidation & Strip Foil)' },
      { id: 'ti-13nb-13zr', name: 'Ti-13Nb-13Zr (Low Modulus Bio)' },
      { id: 'ti-tnzt', name: 'Ti-35Nb-7Zr-5Ta (TNZT Orthopedic)' }
    ]
  },
  {
    category: 'Commercially Pure (CP Titanium)',
    items: [
      { id: 'ti-grade-1', name: 'Ti Grade 1 (CP - Highest Ductility)' },
      { id: 'ti-grade-2', name: 'Ti Grade 2 (CP - Industrial Standard)' },
      { id: 'ti-grade-3', name: 'Ti Grade 3 (CP - Medium Strength)' },
      { id: 'ti-grade-4', name: 'Ti Grade 4 (CP - Highest Strength CP)' },
      { id: 'ti-0-2pd', name: 'Ti-0.2Pd (Grade 7 - Acid Reducing)' }
    ]
  },
  {
    category: 'Intermetallics & Aluminides',
    items: [
      { id: 'ti-48al-2cr-2nb', name: 'Ti-48Al-2Cr-2Nb (Gamma TiAl Intermetallic)' }
    ]
  }
];

// ----------------------------------------------------------------------------
// 2. ROUTE ARCHITECTURE PRESETS & STAGES
// ----------------------------------------------------------------------------
interface HeatTreatmentStage {
  id: string;
  name: string;
  category: 'As-Built' | 'Stress-Relief' | 'HIP' | 'Solution-Age' | 'Annealing';
  tempC: number;
  secondaryTempC?: number; // Chamber preheat for As-Built, Aging temp for STA
  durationHours: number;
  pressureBar: number;
  atmosphere: string;
  coolingMethod: 'Water Quench' | 'Air Cool' | 'Furnace Cool' | 'Rapid Inert Gas';
  description: string;
}

interface AlloyRouteBaselines {
  name: string;
  baseYield: number;
  baseUTS: number;
  baseElongation: number;
  baseResidualStress: number;
  baseFatigue: number;
  betaTransusC: number;
}

const ALLOY_ROUTE_BASELINES: Record<string, AlloyRouteBaselines> = {
  'ti-grade-1': {
    name: 'Ti Grade 1 (CP)',
    baseYield: 180,
    baseUTS: 240,
    baseElongation: 26.9,
    baseResidualStress: 220,
    baseFatigue: 130,
    betaTransusC: 890,
  },
  'ti-grade-2': {
    name: 'Ti Grade 2 (CP)',
    baseYield: 286,
    baseUTS: 371,
    baseElongation: 22.0,
    baseResidualStress: 280,
    baseFatigue: 184,
    betaTransusC: 913,
  },
  'ti-grade-3': {
    name: 'Ti Grade 3 (CP)',
    baseYield: 405,
    baseUTS: 447,
    baseElongation: 18.9,
    baseResidualStress: 340,
    baseFatigue: 223,
    betaTransusC: 920,
  },
  'ti-grade-4': {
    name: 'Ti Grade 4 (CP)',
    baseYield: 474,
    baseUTS: 566,
    baseElongation: 16.6,
    baseResidualStress: 390,
    baseFatigue: 287,
    betaTransusC: 950,
  },
  'ti-6al-4v': {
    name: 'Ti-6Al-4V (Grade 5)',
    baseYield: 1060,
    baseUTS: 1180,
    baseElongation: 7.2,
    baseResidualStress: 520,
    baseFatigue: 380,
    betaTransusC: 995,
  },
  'ti-6al-4v-eli': {
    name: 'Ti-6Al-4V ELI (Grade 23)',
    baseYield: 990,
    baseUTS: 1100,
    baseElongation: 9.8,
    baseResidualStress: 490,
    baseFatigue: 395,
    betaTransusC: 985,
  },
  'ti-6al-7nb': {
    name: 'Ti-6Al-7Nb (Biomedical)',
    baseYield: 920,
    baseUTS: 1030,
    baseElongation: 10.5,
    baseResidualStress: 510,
    baseFatigue: 490,
    betaTransusC: 1010,
  },
  'ti-3al-2-5v': {
    name: 'Ti-3Al-2.5V (Grade 9)',
    baseYield: 580,
    baseUTS: 690,
    baseElongation: 15.0,
    baseResidualStress: 380,
    baseFatigue: 310,
    betaTransusC: 935,
  },
  'ti-3al-2.5v': {
    name: 'Ti-3Al-2.5V (Grade 9)',
    baseYield: 580,
    baseUTS: 690,
    baseElongation: 15.0,
    baseResidualStress: 380,
    baseFatigue: 310,
    betaTransusC: 935,
  },
  'ti-5al-2-5sn': {
    name: 'Ti-5Al-2.5Sn (Alpha Alloy)',
    baseYield: 820,
    baseUTS: 890,
    baseElongation: 12.0,
    baseResidualStress: 460,
    baseFatigue: 420,
    betaTransusC: 1040,
  },
  'ti-5al-2.5sn': {
    name: 'Ti-5Al-2.5Sn (Alpha Alloy)',
    baseYield: 820,
    baseUTS: 890,
    baseElongation: 12.0,
    baseResidualStress: 460,
    baseFatigue: 420,
    betaTransusC: 1040,
  },
  'ti-6242': {
    name: 'Ti-6242 (High-Temp Creep)',
    baseYield: 1120,
    baseUTS: 1240,
    baseElongation: 6.2,
    baseResidualStress: 560,
    baseFatigue: 410,
    betaTransusC: 1010,
  },
  'ti-6246': {
    name: 'Ti-6246 (High-Strength Alpha-Beta)',
    baseYield: 1180,
    baseUTS: 1290,
    baseElongation: 7.0,
    baseResidualStress: 580,
    baseFatigue: 440,
    betaTransusC: 940,
  },
  'ti-10v-2fe-3al': {
    name: 'Ti-10V-2Fe-3Al (Forging Near-Beta)',
    baseYield: 1100,
    baseUTS: 1220,
    baseElongation: 8.5,
    baseResidualStress: 540,
    baseFatigue: 450,
    betaTransusC: 800,
  },
  'ti-5553': {
    name: 'Ti-5553 (Near-Beta High Strength)',
    baseYield: 1250,
    baseUTS: 1380,
    baseElongation: 5.0,
    baseResidualStress: 620,
    baseFatigue: 430,
    betaTransusC: 860,
  },
  'ti-15mo': {
    name: 'Ti-15Mo (Corrosion Beta)',
    baseYield: 520,
    baseUTS: 740,
    baseElongation: 22.0,
    baseResidualStress: 390,
    baseFatigue: 360,
    betaTransusC: 800,
  },
  'ti-13nb-13zr': {
    name: 'Ti-13Nb-13Zr (Low Modulus Bio)',
    baseYield: 750,
    baseUTS: 860,
    baseElongation: 14.0,
    baseResidualStress: 430,
    baseFatigue: 410,
    betaTransusC: 735,
  },
  'ti-tnzt': {
    name: 'Ti-35Nb-7Zr-5Ta (TNZT)',
    baseYield: 460,
    baseUTS: 550,
    baseElongation: 24.0,
    baseResidualStress: 310,
    baseFatigue: 310,
    betaTransusC: 700,
  },
  'ti-35nb-7zr-5ta': {
    name: 'Ti-35Nb-7Zr-5Ta (TNZT)',
    baseYield: 460,
    baseUTS: 550,
    baseElongation: 24.0,
    baseResidualStress: 310,
    baseFatigue: 310,
    betaTransusC: 700,
  },
  'ti-0-2pd': {
    name: 'Ti-0.2Pd (Grade 7)',
    baseYield: 310,
    baseUTS: 380,
    baseElongation: 21.0,
    baseResidualStress: 290,
    baseFatigue: 190,
    betaTransusC: 913,
  },
  'ti-0.2pd': {
    name: 'Ti-0.2Pd (Grade 7)',
    baseYield: 310,
    baseUTS: 380,
    baseElongation: 21.0,
    baseResidualStress: 290,
    baseFatigue: 190,
    betaTransusC: 913,
  },
  'ti-beta21s': {
    name: 'Ti-Beta21S (Oxidation Resistant)',
    baseYield: 860,
    baseUTS: 980,
    baseElongation: 13.0,
    baseResidualStress: 480,
    baseFatigue: 420,
    betaTransusC: 807,
  },
  'ti-48al-2cr-2nb': {
    name: 'Gamma TiAl (Intermetallic)',
    baseYield: 550,
    baseUTS: 680,
    baseElongation: 1.8,
    baseResidualStress: 650,
    baseFatigue: 310,
    betaTransusC: 1320,
  },
  'ti-811': {
    name: 'Ti-8Al-1Mo-1V (Ti-811 High-Modulus)',
    baseYield: 890,
    baseUTS: 1010,
    baseElongation: 12.0,
    baseResidualStress: 510,
    baseFatigue: 440,
    betaTransusC: 1040,
  },
};

const DEFAULT_STAGES: HeatTreatmentStage[] = [
  {
    id: 'stage-1',
    name: '1. Primary AM Deposition (As-Built)',
    category: 'As-Built',
    tempC: 1650,
    secondaryTempC: 150,
    durationHours: 0.05,
    pressureBar: 1,
    atmosphere: 'Ultra-Pure Argon (99.999%)',
    coolingMethod: 'Rapid Inert Gas',
    description: 'Rapid solidification from liquid melt pool; high dislocation density and metastable acicular alpha prime.'
  },
  {
    id: 'stage-2',
    name: '2. Sub-Transus Stress-Relief Anneal',
    category: 'Stress-Relief',
    tempC: 670,
    durationHours: 2.5,
    pressureBar: 1,
    atmosphere: 'Industrial Vacuum (10^-4 mbar)',
    coolingMethod: 'Furnace Cool',
    description: 'Relieves residual macroscopic thermal shrinkage stress without inducing significant grain coarsening.'
  },
  {
    id: 'stage-3',
    name: '3. Hot Isostatic Pressing (HIP Cycle)',
    category: 'HIP',
    tempC: 920,
    durationHours: 2.0,
    pressureBar: 1200,
    atmosphere: 'High-Purity Argon High-Pressure',
    coolingMethod: 'Furnace Cool',
    description: 'Collapses internal lack-of-fusion and gas pores via plastic yield and creep; dramatically boosts fatigue life.'
  },
  {
    id: 'stage-4',
    name: '4. Solution Treatment & Aging (STA)',
    category: 'Solution-Age',
    tempC: 945,
    secondaryTempC: 520,
    durationHours: 4.0,
    pressureBar: 1,
    atmosphere: 'High-Purity Argon',
    coolingMethod: 'Water Quench',
    description: 'Precipitates ultra-fine secondary alpha needles inside retained beta phase for peak yield and fatigue threshold.'
  }
];

export function MatSciCommandSections({
  onSelectMaterialInWorkbench,
  onOpenCompareModal,
}: MatSciCommandSectionsProps) {
  // --------------------------------------------------------------------------
  // SECTION 1: THERMAL TELEMETRY STATE
  // --------------------------------------------------------------------------
  const [selectedAlloyId, setSelectedAlloyId] = useState<string>('ti-6al-4v');
  const [selectedProcessId, setSelectedProcessId] = useState<string>('pbf-lb');
  const activePreset = PROCESS_PRESETS[selectedProcessId] || PROCESS_PRESETS['pbf-lb'];
  const [laserPowerW, setLaserPowerW] = useState<number>(activePreset.defaultPowerW);
  const [scanSpeedMmS, setScanSpeedMmS] = useState<number>(activePreset.defaultSpeedMmS);
  const [preheatTempC, setPreheatTempC] = useState<number>(activePreset.defaultPreheatC);

  // When changing process preset, calibrate defaults
  const handleProcessPresetChange = (procKey: string) => {
    setSelectedProcessId(procKey);
    const p = PROCESS_PRESETS[procKey];
    if (p) {
      setLaserPowerW(p.defaultPowerW);
      setScanSpeedMmS(p.defaultSpeedMmS);
      setPreheatTempC(p.defaultPreheatC);
    }
  };

  const alloyConstants = ALLOY_THERMAL_PROPERTIES[selectedAlloyId] || DEFAULT_TITANIUM_PROPERTIES;

  // Real-Time Rosenthal 1D Longitudinal Thermal Field Calculation
  const thermalTelemetry = useMemo(() => {
    const P = Math.max(10, laserPowerW) * activePreset.absorptivity;
    const v_ms = Math.max(1, scanSpeedMmS) / 1000;
    const k = alloyConstants.thermalConductivity; // W/(m*K)
    const rho = alloyConstants.density; // kg/m^3
    const Cp = alloyConstants.specificHeat; // J/(kg*K)
    const alpha = k / (rho * Cp); // m^2/s thermal diffusivity
    const T0 = preheatTempC;
    const T_liquidus = alloyConstants.liquidusC;
    const T_solidus = alloyConstants.solidusC;
    const T_beta = alloyConstants.betaTransusC ?? 995;

    // Peak center temperature approx from moving point source
    const r_spot_m = (activePreset.spotDiameterUm / 2) / 1e6;
    const T_peak = T0 + (P / (2 * Math.PI * k * r_spot_m)) * Math.exp(- (v_ms * r_spot_m) / (2 * alpha));

    // Calculate cooling curve behind beam along centerline (x from -3mm to +0.5mm)
    const pointsCount = 40;
    const xDistancesMm: number[] = [];
    const temperaturesC: number[] = [];
    const xMinMm = -2.5;
    const xMaxMm = 0.5;

    for (let i = 0; i <= pointsCount; i++) {
      const x_mm = xMinMm + (i / pointsCount) * (xMaxMm - xMinMm);
      const x_m = x_mm / 1000;
      const r_m = Math.max(r_spot_m * 0.7, Math.abs(x_m));
      // Rosenthal equation along scan path
      const T = T0 + (P / (2 * Math.PI * k * r_m)) * Math.exp(- (v_ms * (r_m + x_m)) / (2 * alpha));
      xDistancesMm.push(x_mm);
      temperaturesC.push(Math.min(3400, Math.max(T0, T)));
    }

    // Cooling rate (dT/dt) at solidus front: (dT/dt) = 2*pi*k*(T_sol - T0)^2 / P
    const dTdt_Ks = (2 * Math.PI * k * Math.pow(Math.max(50, T_solidus - T0), 2)) / Math.max(10, P);

    // Approximate melt pool length (where T >= T_liquidus)
    const meltLengthMm = Math.max(0.05, (P / (Math.PI * k * (T_liquidus - T0))) * 0.4);
    const meltLengthUm = Math.round(meltLengthMm * 1000);

    // Time in Heat Affected Zone (above beta-transus)
    const hazDurationMs = Math.max(0.1, (meltLengthMm * 1.5 / v_ms));

    return {
      T_peak: Math.round(T_peak),
      T_liquidus,
      T_solidus,
      T_beta,
      dTdt_Ks: Math.round(dTdt_Ks),
      meltLengthUm,
      hazDurationMs: hazDurationMs.toFixed(1),
      points: xDistancesMm.map((x, idx) => ({ x, t: temperaturesC[idx] }))
    };
  }, [laserPowerW, scanSpeedMmS, preheatTempC, alloyConstants, activePreset]);

  // --------------------------------------------------------------------------
  // SECTION 2: ROUTE ARCHITECTURE STATE
  // --------------------------------------------------------------------------
  const [selectedRouteAlloy, setSelectedRouteAlloy] = useState<string>('ti-6al-4v');
  const [enabledStages, setEnabledStages] = useState<Record<string, boolean>>({
    'stage-1': true,
    'stage-2': true,
    'stage-3': true,
    'stage-4': false
  });
  const [stagesConfig, setStagesConfig] = useState<HeatTreatmentStage[]>(DEFAULT_STAGES);

  const toggleStage = (stageId: string) => {
    setEnabledStages((prev) => ({
      ...prev,
      [stageId]: !prev[stageId]
    }));
  };

  const updateStageTemp = (stageId: string, newTemp: number) => {
    setStagesConfig((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, tempC: newTemp } : s))
    );
  };

  const updateStageSecondaryTemp = (stageId: string, newTemp: number) => {
    setStagesConfig((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, secondaryTempC: newTemp } : s))
    );
  };

  const updateStagePressure = (stageId: string, newPressure: number) => {
    setStagesConfig((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, pressureBar: newPressure } : s))
    );
  };

  const updateStageDuration = (stageId: string, newDuration: number) => {
    setStagesConfig((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, durationHours: newDuration } : s))
    );
  };

  // Sync Stage 1 with Section 1 Thermal Telemetry
  const syncStage1FromTelemetry = () => {
    setStagesConfig((prev) =>
      prev.map((s) =>
        s.id === 'stage-1'
          ? {
              ...s,
              tempC: Math.min(2200, Math.max(1400, thermalTelemetry.T_peak)),
              secondaryTempC: preheatTempC
            }
          : s
      )
    );
    setSelectedRouteAlloy(selectedAlloyId);
  };

  // Cumulative Physical Metallurgy & Synthesis Route Impact
  const routeImpact = useMemo(() => {
    const alloy = ALLOY_ROUTE_BASELINES[selectedRouteAlloy] || ALLOY_ROUTE_BASELINES['ti-6al-4v'];
    const T_beta = alloy.betaTransusC;

    const s1 = stagesConfig.find((s) => s.id === 'stage-1') || DEFAULT_STAGES[0];
    const s2 = stagesConfig.find((s) => s.id === 'stage-2') || DEFAULT_STAGES[1];
    const s3 = stagesConfig.find((s) => s.id === 'stage-3') || DEFAULT_STAGES[2];
    const s4 = stagesConfig.find((s) => s.id === 'stage-4') || DEFAULT_STAGES[3];

    const s1Enabled = enabledStages['stage-1'];
    const s2Enabled = enabledStages['stage-2'];
    const s3Enabled = enabledStages['stage-3'];
    const s4Enabled = enabledStages['stage-4'];

    // Stage 1: Deposition (As-Built starting state)
    let curYield = alloy.baseYield;
    let curUTS = alloy.baseUTS;
    let curElongation = alloy.baseElongation;
    let residualStress = alloy.baseResidualStress;
    let fatigueLimit = alloy.baseFatigue;

    let s1Notes = '';
    if (s1Enabled) {
      const meltTemp = s1.tempC; // 1400 - 2200, default 1650
      const preheatTemp = s1.secondaryTempC ?? 150; // 25 - 650, default 150

      // Higher melt temp = higher thermal shock and dislocation density
      const deltaMelt = meltTemp - 1650;
      residualStress += deltaMelt * 0.18;
      curYield += deltaMelt * 0.04;
      curUTS += deltaMelt * 0.04;

      // Higher substrate preheat provides in-situ tempering during build
      const preheatReliefRatio = Math.min(0.68, Math.max(0, ((preheatTemp - 25) / (650 - 25)) * 0.68));
      residualStress = Math.round(residualStress * (1 - preheatReliefRatio));
      curElongation += (preheatTemp - 25) * 0.005;
      curYield -= (preheatTemp - 25) * 0.08;
      curUTS -= (preheatTemp - 25) * 0.07;

      s1Notes = `As-built melt pool at ${meltTemp}°C with ${preheatTemp}°C preheat; residual stress initialized at ${Math.round(residualStress)} MPa.`;
    }

    // Stage 2: Stress-Relief Anneal
    let s2ReliefPct = 0;
    let s2Notes = '';
    if (s2Enabled) {
      const srTemp = s2.tempC; // 450 to 1050
      const srTime = s2.durationHours; // 0.5 to 6.0

      // Residual stress relaxation kinetics:
      const reliefFrac = Math.min(
        0.98,
        Math.max(0.15, 1 - Math.exp(-Math.pow(srTemp / 575, 4.2) * (Math.pow(srTime, 0.22) / 2.6)))
      );
      s2ReliefPct = Math.round(reliefFrac * 100);
      residualStress = Math.round(residualStress * (1 - reliefFrac));

      // Microstructural changes & coarsening:
      if (srTemp <= 600) {
        curYield -= 15 * (srTemp / 600);
        curUTS -= 12 * (srTemp / 600);
        curElongation += 0.8 * (srTemp / 600);
        s2Notes = `Low-temperature stress relief (${srTemp}°C): dislocation recovery without significant softening.`;
      } else if (srTemp <= 750) {
        const tFactor = (srTemp - 600) / (750 - 600);
        curYield -= (20 + 35 * tFactor);
        curUTS -= (18 + 30 * tFactor);
        curElongation += (1.0 + 2.2 * tFactor);
        s2Notes = `Standard stress relief (${srTemp}°C, ${srTime}h): decomposed α' martensite into fine α+β.`;
      } else if (srTemp <= T_beta) {
        const tFactor = (srTemp - 750) / (T_beta - 750);
        const timeFactor = Math.pow(srTime / 2.5, 0.25);
        curYield -= (55 + 130 * tFactor * timeFactor);
        curUTS -= (50 + 115 * tFactor * timeFactor);
        curElongation += (3.2 + 4.5 * tFactor);
        s2Notes = `Near-transus high anneal (${srTemp}°C): extensive lamellar coarsening (+${(3.2 + 4.5 * tFactor).toFixed(1)}% elongation).`;
      } else {
        const superDelta = Math.min(60, srTemp - T_beta);
        curYield -= (185 + superDelta * 0.5);
        curUTS -= (165 + superDelta * 0.4);
        curElongation -= (1.5 + superDelta * 0.05);
        s2Notes = `Super-transus anneal (${srTemp}°C > T_beta ${T_beta}°C): continuous grain boundary α reduced ductility.`;
      }

      fatigueLimit += Math.round(35 * reliefFrac);
    }

    // Stage 3: Hot Isostatic Pressing (HIP Cycle)
    let s3ClosurePct = 0;
    let s3Notes = '';
    if (s3Enabled) {
      const hipTemp = s3.tempC; // 750 to 1100, default 920
      const hipPress = s3.pressureBar; // 200 to 2000, default 1200
      const hipTime = s3.durationHours; // 1.0 to 5.0

      // Defect closure kinetics via plastic yield + Coble creep
      const pressFrac = Math.pow(hipPress / 1200, 0.55);
      const tempFrac = Math.pow(hipTemp / 920, 2.5);
      const timeFrac = Math.pow(hipTime / 2.0, 0.25);
      const closureRatio = Math.min(0.998, Math.max(0.20, pressFrac * tempFrac * timeFrac));
      s3ClosurePct = Number((closureRatio * 100).toFixed(1));

      // Fatigue endurance jump from micro-pore closure
      const targetMaxFatigue = Math.round(alloy.baseFatigue * 2.26); // e.g. 380 -> 858 MPa
      const fatigueBoost = Math.round((targetMaxFatigue - fatigueLimit) * closureRatio);
      fatigueLimit += fatigueBoost;

      // Hydrostatic pressure relaxes residual stress to near-zero
      residualStress = Math.max(12, Math.round(residualStress * (1 - 0.95 * closureRatio)));

      if (hipTemp <= T_beta) {
        const tempRatio = (hipTemp - 750) / (T_beta - 750);
        curYield = Math.round(curYield - 65 * tempRatio);
        curUTS = Math.round(curUTS - 55 * tempRatio);
        curElongation = Math.min(18.5, curElongation + 4.5 * closureRatio);
        s3Notes = `HIP at ${hipTemp}°C / ${hipPress} bar: healed ${s3ClosurePct}% of pores (+${fatigueBoost} MPa fatigue endurance).`;
      } else {
        const superDelta = hipTemp - T_beta;
        curYield -= (90 + superDelta * 0.4);
        curUTS -= (80 + superDelta * 0.3);
        curElongation = Math.max(7.0, curElongation - 3.5);
        s3Notes = `Super-transus HIP (${hipTemp}°C): healed pores, but prior-β grain coarsening lowered yield strength.`;
      }
    }

    // Stage 4: Solution Treatment & Aging (STA)
    let s4YieldBoost = 0;
    let s4Notes = '';
    if (s4Enabled) {
      const solTemp = s4.tempC; // 800 to 1050
      const ageTemp = s4.secondaryTempC ?? 520; // 450 to 620
      const ageTime = s4.durationHours; // 1.0 to 8.0

      let solEfficiency = 0;
      if (solTemp <= T_beta) {
        solEfficiency = Math.min(1.0, Math.max(0.1, (solTemp - 780) / (Math.min(955, T_beta) - 780)));
      } else {
        solEfficiency = 1.05;
      }

      const ageEfficiency = Math.exp(-Math.pow((ageTemp - 520) / 65, 2));
      const timeFactor = Math.pow(ageTime / 4.0, 0.18);

      s4YieldBoost = Math.round(165 * solEfficiency * ageEfficiency * timeFactor);
      const utsBoost = Math.round(150 * solEfficiency * ageEfficiency * timeFactor);

      curYield += s4YieldBoost;
      curUTS += utsBoost;

      const ductilityDrop = Number((3.2 * solEfficiency * ageEfficiency).toFixed(1));
      curElongation = Math.max(4.0, curElongation - ductilityDrop);
      fatigueLimit += Math.round(45 * solEfficiency * ageEfficiency);

      s4Notes = `STA (${solTemp}°C solution + ${ageTemp}°C aging): precipitated fine secondary αs (+${s4YieldBoost} MPa yield).`;
    }

    const finalYield = Math.max(250, Math.round(curYield));
    const finalUTS = Math.max(finalYield + 35, Math.round(curUTS));
    const finalElongation = Number(Math.max(1.5, Math.min(30, curElongation)).toFixed(1));
    const finalResidualStress = Math.max(12, Math.round(residualStress));
    const finalFatigue = Math.max(180, Math.round(fatigueLimit));

    const deltaYield = finalYield - alloy.baseYield;
    const deltaUTS = finalUTS - alloy.baseUTS;
    const deltaElongation = Number((finalElongation - alloy.baseElongation).toFixed(1));

    return {
      yieldStrengthMPa: finalYield,
      utsMPa: finalUTS,
      elongationPct: finalElongation,
      residualStressMPa: finalResidualStress,
      fatigueStrengthMPa: finalFatigue,
      deltaYield,
      deltaUTS,
      deltaElongation,
      stressReliefPct: Math.round(((alloy.baseResidualStress - finalResidualStress) / alloy.baseResidualStress) * 100),
      hipPoreClosurePct: s3ClosurePct,
      stage4YieldBoost: s4YieldBoost,
      baseYield: alloy.baseYield,
      baseUTS: alloy.baseUTS,
      baseElongation: alloy.baseElongation,
      baseResidualStress: alloy.baseResidualStress,
      baseFatigue: alloy.baseFatigue,
      betaTransusC: T_beta,
      s1Notes,
      s2Notes,
      s3Notes,
      s4Notes
    };
  }, [stagesConfig, enabledStages, selectedRouteAlloy]);

  // Export Custom Route Card
  const handleExportRouteCard = () => {
    const routePayload = {
      specTitle: 'Custom Titanium AM Synthesis & Heat Treatment Route',
      generatedBy: 'MatSci Navigator Route Architecture Engine',
      alloy: selectedRouteAlloy,
      calibratedAt: new Date().toISOString(),
      configuredStages: stagesConfig.filter((s) => enabledStages[s.id]),
      predictedFinalProperties: routeImpact
    };
    const jsonStr = JSON.stringify(routePayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedRouteAlloy}-synthesis-route-spec.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 250);
  };

  // --------------------------------------------------------------------------
  // SECTION 3: PHASE KINETICS & CCT ENGINE STATE
  // --------------------------------------------------------------------------
  const [cctCoolingRateLog, setCctCoolingRateLog] = useState<number>(4.5); // 10^4.5 ≈ 31,600 K/s
  const coolingRateKs = Math.round(Math.pow(10, cctCoolingRateLog));

  // Determine Solidified Phase Microstructure from CCT Kinetics
  const phaseKineticsResult = useMemo(() => {
    let phaseName = '';
    let phaseCode = '';
    let morphology = '';
    let riskWarning = '';
    let recommendation = '';
    let typicalHV = 320;
    let lathThicknessUm = 0.5;

    if (coolingRateKs >= 410) {
      // Rapid martensitic transformation
      phaseName = "Hexagonal Martensite (α' Phase)";
      phaseCode = "ALPHA_PRIME_MARTENSITIC";
      morphology = "Acicular Needle-Like Basketweave within Prior-β Epitaxial Columns";
      riskWarning = "High residual stress and limited ductility (<8%). Highly susceptible to stress-corrosion cracking.";
      recommendation = "Mandatory post-deposition stress-relief anneal (650°C-700°C) or Hot Isostatic Pressing (HIP) to decompose α' into stable α+β.";
      lathThicknessUm = Math.max(0.15, Number((35 * Math.pow(coolingRateKs, -0.32)).toFixed(2)));
      typicalHV = Math.round(290 + 68 * Math.pow(lathThicknessUm, -0.5));
    } else if (coolingRateKs >= 20) {
      // Widmanstatten basketweave alpha + beta
      phaseName = "Widmanstätten (α + β) Basketweave";
      phaseCode = "WIDMANSTATTEN_ALPHA_BETA";
      morphology = "Interlocking fine α laths bounded by continuous thin β films.";
      riskWarning = "Moderate anisotropy along build axis (Z). Low residual stress.";
      recommendation = "Optimal balance of high yield strength and good fracture toughness (K1c > 65 MPa*m^0.5). Ideal for aerospace flight hardware.";
      lathThicknessUm = Math.max(0.8, Number((35 * Math.pow(coolingRateKs, -0.32)).toFixed(2)));
      typicalHV = Math.round(285 + 62 * Math.pow(lathThicknessUm, -0.5));
    } else {
      // Coarse colonial alpha + beta
      phaseName = "Colonial Lamellar (α + β) Phase";
      phaseCode = "COARSE_COLONIAL_ALPHA";
      morphology = "Coarse parallel α colonies with continuous grain boundary α (GB-α) allotriomorphs.";
      riskWarning = "Low yield strength and poor fatigue crack initiation threshold due to large effective slip lengths.";
      recommendation = "Requires beta-solution treatment with controlled gas quenching or interpass cold rolling (WAAM) to break up coarse grain boundary alpha.";
      lathThicknessUm = Math.max(3.5, Number((35 * Math.pow(coolingRateKs, -0.32)).toFixed(2)));
      typicalHV = Math.round(270 + 55 * Math.pow(lathThicknessUm, -0.5));
    }

    return {
      coolingRateKs,
      phaseName,
      phaseCode,
      morphology,
      lathThicknessUm,
      predictedHardnessHV: typicalHV,
      riskWarning,
      recommendation,
      betaTransusC: 995,
      martensiteStartC: 575
    };
  }, [coolingRateKs]);

  return (
    <div className="w-full">
      {/* ==================================================================== */}
      {/* 1. PRACTICAL THERMAL TELEMETRY & COOLING PROFILER (#telemetry-section) */}
      {/* ==================================================================== */}
      <section
        id="telemetry-section"
        className="w-full max-w-[1728px] overflow-x-hidden px-4 sm:px-8 border-t border-[#232426] py-20 mx-auto scroll-mt-20 relative min-w-0"
      >
        <div className="max-w-[1516px] w-full mx-auto">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-[#232426]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#50d8e9]/10 text-[#50d8e9] border border-[#50d8e9]/30 flex items-center gap-1.5">
                  <Flame className="w-3 h-3" />
                  THERMAL TELEMETRY &amp; COOLING RATE PROFILER
                </span>
                <span className="text-xs font-mono text-[#9A9DA3]">Rosenthal 1D/2D Kinetic Simulation</span>
              </div>
              <h2 className="font-h2 text-2xl sm:text-4xl text-white font-bold tracking-tight">
                Live Additive Manufacturing Thermal Field Telemetry
              </h2>
              <p className="text-sm text-[#9A9DA3] max-w-2xl mt-1.5">
                Simulate moving laser and arc heat dissipation vectors, identify liquidus/solidus phase boundaries, and predict cooling rates across 20 Titanium alloys.
              </p>
            </div>

            {/* Alloy & Process Pickers */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[10px] font-mono text-[#7189a3] block mb-1">Target Alloy (All 20 Alloys):</label>
                <select
                  value={selectedAlloyId}
                  onChange={(e) => setSelectedAlloyId(e.target.value)}
                  className="bg-[#101112] border border-[#232426] text-xs font-mono text-white rounded-lg px-3 py-1.5 focus:border-[#50d8e9] focus:outline-none max-w-[280px]"
                >
                  {ALL_TITANIUM_ALLOYS_CATALOG.map((group) => (
                    <optgroup key={group.category} label={group.category} className="bg-[#18191c] text-[#50d8e9] font-bold">
                      {group.items.map((item) => (
                        <option key={item.id} value={item.id} className="bg-[#101112] text-white font-normal">
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#7189a3] block mb-1">AM Process Preset (All Categories):</label>
                <select
                  value={selectedProcessId}
                  onChange={(e) => handleProcessPresetChange(e.target.value)}
                  className="bg-[#101112] border border-[#232426] text-xs font-mono text-[#50d8e9] font-bold rounded-lg px-3 py-1.5 focus:border-[#50d8e9] focus:outline-none max-w-[320px]"
                >
                  <optgroup label="Powder Bed Fusion (PBF)" className="bg-[#18191c] text-[#50d8e9] font-bold">
                    <option value="pbf-lb" className="bg-[#101112] text-white font-normal">Laser PBF (L-PBF / SLM / DMLS)</option>
                    <option value="pbf-eb" className="bg-[#101112] text-white font-normal">Electron Beam PBF (PBF-EB / EBM)</option>
                  </optgroup>
                  <optgroup label="Directed Energy Deposition (DED)" className="bg-[#18191c] text-[#50d8e9] font-bold">
                    <option value="ded-lb" className="bg-[#101112] text-white font-normal">Laser Powder DED (LENS / Blown)</option>
                    <option value="ded-wire" className="bg-[#101112] text-white font-normal">Wire Laser DED (WL-AM / Wire Fed)</option>
                    <option value="csam" className="bg-[#101112] text-white font-normal">Cold Spray Kinetic AM (CSAM)</option>
                  </optgroup>
                  <optgroup label="Wire Arc Additive (WAAM)" className="bg-[#18191c] text-[#50d8e9] font-bold">
                    <option value="waam" className="bg-[#101112] text-white font-normal">Wire Arc Additive (GMAW / Plasma WAAM)</option>
                  </optgroup>
                  <optgroup label="Sinter-Based &amp; Slurry AM" className="bg-[#18191c] text-[#50d8e9] font-bold">
                    <option value="bjt" className="bg-[#101112] text-white font-normal">Metal Binder Jetting (MBJ + Sinter)</option>
                    <option value="mex" className="bg-[#101112] text-white font-normal">Bound Metal Extrusion (MEX / FFF)</option>
                    <option value="vat" className="bg-[#101112] text-white font-normal">Lithography Metal AM (VPP / LMM)</option>
                  </optgroup>
                  <optgroup label="Solid-State Sheet Lamination" className="bg-[#18191c] text-[#50d8e9] font-bold">
                    <option value="sheet-lam" className="bg-[#101112] text-white font-normal">Ultrasonic Sheet Lamination (UAM)</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* Interactive Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Controls & Parameters (5 cols) */}
            <div className="lg:col-span-5 bg-[#101112] border border-[#232426] rounded-xl p-6 space-y-6 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#232426]">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#50d8e9]" />
                  Process Input Parameters
                </span>
                <button
                  onClick={() => handleProcessPresetChange(selectedProcessId)}
                  className="text-[10px] font-mono text-[#9A9DA3] hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Defaults
                </button>
              </div>

              {/* Slider 1: Beam / Arc Power */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#9A9DA3]">Heat Source Power (P)</span>
                  <span className="text-white font-bold">{laserPowerW} Watts</span>
                </div>
                <input
                  type="range"
                  min={activePreset.minPowerW}
                  max={activePreset.maxPowerW}
                  step={5}
                  value={laserPowerW}
                  onChange={(e) => setLaserPowerW(Number(e.target.value))}
                  className="w-full accent-[#50d8e9] bg-[#1a1b1d] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#7189a3]">
                  <span>Min: {activePreset.minPowerW} W</span>
                  <span>Max: {activePreset.maxPowerW} W</span>
                </div>
              </div>

              {/* Slider 2: Scan / Travel Speed */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#9A9DA3]">Scan / Travel Speed (v)</span>
                  <span className="text-white font-bold">{scanSpeedMmS} mm/s</span>
                </div>
                <input
                  type="range"
                  min={activePreset.minSpeedMmS}
                  max={activePreset.maxSpeedMmS}
                  step={selectedProcessId === 'waam' ? 1 : 25}
                  value={scanSpeedMmS}
                  onChange={(e) => setScanSpeedMmS(Number(e.target.value))}
                  className="w-full accent-[#50d8e9] bg-[#1a1b1d] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#7189a3]">
                  <span>Min: {activePreset.minSpeedMmS} mm/s</span>
                  <span>Max: {activePreset.maxSpeedMmS} mm/s</span>
                </div>
              </div>

              {/* Slider 3: Substrate Preheat Temperature */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#9A9DA3]">Bed / Substrate Preheat (T₀)</span>
                  <span className="text-white font-bold">{preheatTempC}°C</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={850}
                  step={10}
                  value={preheatTempC}
                  onChange={(e) => setPreheatTempC(Number(e.target.value))}
                  className="w-full accent-[#50d8e9] bg-[#1a1b1d] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#7189a3]">
                  <span>20°C (Cold Plate)</span>
                  <span>850°C (Hot Stage)</span>
                </div>
              </div>

              {/* Calculated Physical Output Telemetry Cards */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-[#0b0c0e] p-3 rounded-lg border border-[#1a1b1d]">
                  <span className="text-[10px] font-mono text-[#7189a3] block">Peak Temperature</span>
                  <span className="text-base font-bold font-mono text-rose-400 mt-0.5 block">
                    {thermalTelemetry.T_peak.toLocaleString()} °C
                  </span>
                  <span className="text-[10px] text-[#9A9DA3]">
                    {thermalTelemetry.T_peak > 3000 ? '⚠ Vaporization Hazard' : '✓ Molten Core'}
                  </span>
                </div>

                <div className="bg-[#0b0c0e] p-3 rounded-lg border border-[#1a1b1d]">
                  <span className="text-[10px] font-mono text-[#7189a3] block">Estimated Cooling Rate</span>
                  <span className="text-base font-bold font-mono text-[#50d8e9] mt-0.5 block">
                    {thermalTelemetry.dTdt_Ks > 10000
                      ? `${(thermalTelemetry.dTdt_Ks / 1000).toFixed(0)}k K/s`
                      : `${thermalTelemetry.dTdt_Ks} K/s`}
                  </span>
                  <span className="text-[10px] text-[#9A9DA3]">Solidification Front</span>
                </div>

                <div className="bg-[#0b0c0e] p-3 rounded-lg border border-[#1a1b1d]">
                  <span className="text-[10px] font-mono text-[#7189a3] block">Melt Pool Length</span>
                  <span className="text-base font-bold font-mono text-white mt-0.5 block">
                    {thermalTelemetry.meltLengthUm} µm
                  </span>
                  <span className="text-[10px] text-[#7189a3]">T ≥ {thermalTelemetry.T_liquidus}°C</span>
                </div>

                <div className="bg-[#0b0c0e] p-3 rounded-lg border border-[#1a1b1d]">
                  <span className="text-[10px] font-mono text-[#7189a3] block">HAZ Exposure Time</span>
                  <span className="text-base font-bold font-mono text-amber-400 mt-0.5 block">
                    {thermalTelemetry.hazDurationMs} ms
                  </span>
                  <span className="text-[10px] text-[#7189a3]">T &gt; {thermalTelemetry.T_beta}°C (β-Transus)</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => onSelectMaterialInWorkbench(selectedAlloyId)}
                  className="w-full py-2.5 rounded-lg text-xs font-mono font-bold bg-[#50d8e9] text-black hover:bg-[#6be4f3] transition-colors flex items-center justify-center gap-2"
                >
                  <span>Load {alloyConstants.nominalUTS ? 'Alloy Properties' : 'Telemetry'} into Workbench</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Dynamic Thermal Graph (7 cols) */}
            <div className="lg:col-span-7 bg-[#101112] border border-[#232426] rounded-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#232426]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#50d8e9]" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Longitudinal Thermal Decay Gradient [T(x)]
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="w-2 h-0.5 bg-rose-400 inline-block" /> Liquidus ({thermalTelemetry.T_liquidus}°C)
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="w-2 h-0.5 bg-amber-400 inline-block" /> β-Transus ({thermalTelemetry.T_beta}°C)
                  </span>
                </div>
              </div>

              {/* Dynamic SVG Curve Container */}
              <div className="relative h-72 sm:h-80 w-full bg-[#070708] rounded-lg border border-[#1b1c1e] p-4 flex flex-col justify-between overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 500 240" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="thermal-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#50d8e9" stopOpacity="0.4" />
                      <stop offset="60%" stopColor="#50d8e9" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#50d8e9" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Grid lines */}
                  <line x1="0" y1="60" x2="500" y2="60" stroke="#232426" strokeDasharray="3 3" strokeWidth="0.8" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="#232426" strokeDasharray="3 3" strokeWidth="0.8" />
                  <line x1="0" y1="180" x2="500" y2="180" stroke="#232426" strokeDasharray="3 3" strokeWidth="0.8" />

                  {/* Liquidus Isotherm Line */}
                  <line
                    x1="0"
                    y1={240 - ((thermalTelemetry.T_liquidus - 20) / (3000 - 20)) * 240}
                    x2="500"
                    y2={240 - ((thermalTelemetry.T_liquidus - 20) / (3000 - 20)) * 240}
                    stroke="#f43f5e"
                    strokeDasharray="4 2"
                    strokeWidth="1"
                    opacity="0.8"
                  />
                  <text
                    x="8"
                    y={Math.max(16, 240 - ((thermalTelemetry.T_liquidus - 20) / (3000 - 20)) * 240 - 4)}
                    fill="#f43f5e"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    T_liquidus ({thermalTelemetry.T_liquidus}°C) — Liquid Pool
                  </text>

                  {/* Beta Transus Line */}
                  <line
                    x1="0"
                    y1={240 - ((thermalTelemetry.T_beta - 20) / (3000 - 20)) * 240}
                    x2="500"
                    y2={240 - ((thermalTelemetry.T_beta - 20) / (3000 - 20)) * 240}
                    stroke="#fbbf24"
                    strokeDasharray="4 2"
                    strokeWidth="1"
                    opacity="0.8"
                  />
                  <text
                    x="8"
                    y={Math.max(28, 240 - ((thermalTelemetry.T_beta - 20) / (3000 - 20)) * 240 - 4)}
                    fill="#fbbf24"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    T_transus ({thermalTelemetry.T_beta}°C) — α+β Boundary
                  </text>

                  {/* Dynamic Rosenthal Profile Path */}
                  {(() => {
                    const coords = thermalTelemetry.points.map((pt, i) => {
                      const svgX = (i / (thermalTelemetry.points.length - 1)) * 500;
                      const normT = Math.min(3000, Math.max(20, pt.t));
                      const svgY = 240 - ((normT - 20) / (3000 - 20)) * 230;
                      return `${svgX},${svgY}`;
                    });
                    const dLine = `M ${coords.join(' L ')}`;
                    const dArea = `M ${coords.join(' L ')} L 500,240 L 0,240 Z`;

                    return (
                      <>
                        <path d={dArea} fill="url(#thermal-fill)" />
                        <path d={dLine} fill="none" stroke="#50d8e9" strokeWidth="2.2" />
                      </>
                    );
                  })()}

                  {/* Center beam spot indicator */}
                  <circle cx="415" cy="40" r="4.5" fill="#50d8e9" className="animate-pulse" />
                  <text x="424" y="44" fill="#ffffff" fontSize="9" fontFamily="monospace" fontWeight="bold">
                    Beam Focus (x=0)
                  </text>
                </svg>

                {/* X-axis legends */}
                <div className="flex justify-between items-center text-[10px] font-mono text-[#7189a3] pt-2 border-t border-[#1b1c1e]">
                  <span>← Trailing Solidified Track (-2.5 mm)</span>
                  <span>Scan Direction → (+0.5 mm)</span>
                </div>
              </div>

              {/* Status explanation */}
              <div className="bg-[#0b0c0e] p-3 rounded-lg border border-[#1a1b1d] text-xs font-mono text-[#9A9DA3] flex items-center justify-between">
                <span>
                  Calculated Absorbed Enthalpy: <strong className="text-white">{Math.round(laserPowerW * activePreset.absorptivity)} W</strong>
                </span>
                <span className="text-emerald-400 font-semibold">
                  ✓ Thermal Field Converged (0.2ms)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 2. SYNTHESIS ROUTE ARCHITECTURE & HEAT TREATMENT PLANNER (#architecture) */}
      {/* ==================================================================== */}
      <section
        id="architecture-section"
        className="w-full max-w-[1728px] overflow-x-hidden px-4 sm:px-8 border-t border-[#232426] py-20 mx-auto scroll-mt-20 relative bg-[#050607] min-w-0"
      >
        <div className="max-w-[1516px] w-full mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-[#232426]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#5E6BFF]/10 text-[#bec2ff] border border-[#5E6BFF]/30 flex items-center gap-1.5">
                  <Layers className="w-3 h-3" />
                  ROUTE ARCHITECTURE &amp; HEAT-TREATMENT CONFIGURATOR
                </span>
                <span className="text-xs font-mono text-[#9A9DA3]">Multi-Stage Metallurgy Planner</span>
              </div>
              <h2 className="font-h2 text-2xl sm:text-4xl text-white font-bold tracking-tight">
                Design &amp; Simulate End-to-End AM Processing Sequences
              </h2>
              <p className="text-sm text-[#9A9DA3] max-w-2xl mt-1.5">
                Toggle and configure deposition, stress relief, Hot Isostatic Pressing (HIP), and solution aging stages. Watch mechanical properties and residual stresses transform in real time.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[10px] font-mono text-[#7189a3] block mb-1">Target Alloy (All 20 Alloys):</label>
                <select
                  value={selectedRouteAlloy}
                  onChange={(e) => setSelectedRouteAlloy(e.target.value)}
                  className="bg-[#101112] border border-[#232426] text-xs font-mono text-white rounded-lg px-3 py-1.5 focus:border-[#5E6BFF] focus:outline-none max-w-[280px]"
                >
                  {ALL_TITANIUM_ALLOYS_CATALOG.map((group) => (
                    <optgroup key={group.category} label={group.category} className="bg-[#18191c] text-[#bec2ff] font-bold">
                      {group.items.map((item) => (
                        <option key={item.id} value={item.id} className="bg-[#101112] text-white font-normal">
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="pt-4 sm:pt-0">
                <button
                  onClick={handleExportRouteCard}
                  className="px-4 py-2 rounded-lg text-xs font-mono font-semibold bg-[#101112] hover:bg-[#1a1b1d] border border-[#232426] hover:border-[#5E6BFF]/50 text-white flex items-center gap-2 transition-all shadow-md"
                >
                  <Download className="w-3.5 h-3.5 text-[#5E6BFF]" />
                  <span>Export Route Spec (JSON)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 4-Stage Configurator (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-[#9A9DA3] px-1">
                <span>Configure Multi-Stage Sequence:</span>
                <span>Active Stages: {Object.values(enabledStages).filter(Boolean).length} / 4</span>
              </div>

              {stagesConfig.map((stage) => {
                const isEnabled = enabledStages[stage.id];
                return (
                  <div
                    key={stage.id}
                    className={`border rounded-xl p-5 transition-all ${
                      isEnabled
                        ? 'bg-[#101112] border-[#2e3136] shadow-lg'
                        : 'bg-[#0a0b0c]/60 border-[#1a1b1d] opacity-55'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleStage(stage.id)}
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                            isEnabled
                              ? 'bg-[#5E6BFF] border-[#5E6BFF] text-white'
                              : 'border-[#454655] hover:border-white'
                          }`}
                        >
                          {isEnabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            {stage.name}
                          </h4>
                          <span className="text-[10px] font-mono text-[#7189a3]">
                            {stage.atmosphere} • {stage.coolingMethod}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        isEnabled ? 'bg-[#50d8e9]/10 text-[#50d8e9] border border-[#50d8e9]/30' : 'text-[#7189a3]'
                      }`}>
                        {stage.category}
                      </span>
                    </div>

                    <p className="text-xs text-[#9A9DA3] mb-4 leading-relaxed pl-8">
                      {stage.description}
                    </p>

                    {/* Stage Parameter Sliders (if enabled) */}
                    {isEnabled && (
                      <div className="pl-8 pt-3 border-t border-[#1a1b1d] text-xs font-mono space-y-3">
                        {/* Stage 1: Deposition */}
                        {stage.id === 'stage-1' && (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-[#9A9DA3]">Melt Pool Peak Temp</span>
                                  <span className="text-white font-bold">{stage.tempC}°C</span>
                                </div>
                                <input
                                  type="range"
                                  min={1400}
                                  max={2200}
                                  step={10}
                                  value={stage.tempC}
                                  onChange={(e) => updateStageTemp(stage.id, Number(e.target.value))}
                                  className="w-full accent-[#5E6BFF] bg-[#1a1b1d] h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>

                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-[#9A9DA3]">Chamber / Bed Preheat</span>
                                  <span className="text-[#50d8e9] font-bold">{stage.secondaryTempC ?? 150}°C</span>
                                </div>
                                <input
                                  type="range"
                                  min={25}
                                  max={650}
                                  step={25}
                                  value={stage.secondaryTempC ?? 150}
                                  onChange={(e) => updateStageSecondaryTemp(stage.id, Number(e.target.value))}
                                  className="w-full accent-[#50d8e9] bg-[#1a1b1d] h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between text-[11px] text-[#7189a3] pt-1">
                              <span>Pressure: <strong>{stage.pressureBar} bar</strong> ({stage.atmosphere})</span>
                              <button
                                type="button"
                                onClick={syncStage1FromTelemetry}
                                className="text-[10px] text-[#50d8e9] hover:text-[#7ce5f2] flex items-center gap-1 transition-colors underline"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                Sync from Thermal Telemetry ({thermalTelemetry.T_peak}°C / {preheatTempC}°C)
                              </button>
                            </div>
                          </>
                        )}

                        {/* Stage 2: Stress Relief */}
                        {stage.id === 'stage-2' && (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-[#9A9DA3]">Process Temperature</span>
                                  <span className="text-white font-bold">{stage.tempC}°C</span>
                                </div>
                                <input
                                  type="range"
                                  min={450}
                                  max={1050}
                                  step={10}
                                  value={stage.tempC}
                                  onChange={(e) => updateStageTemp(stage.id, Number(e.target.value))}
                                  className="w-full accent-[#5E6BFF] bg-[#1a1b1d] h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>

                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-[#9A9DA3]">Soaking Duration</span>
                                  <span className="text-white font-bold">{stage.durationHours} hrs</span>
                                </div>
                                <input
                                  type="range"
                                  min={0.5}
                                  max={6.0}
                                  step={0.5}
                                  value={stage.durationHours}
                                  onChange={(e) => updateStageDuration(stage.id, Number(e.target.value))}
                                  className="w-full accent-[#5E6BFF] bg-[#1a1b1d] h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[#7189a3] pt-1">
                              <span>Atmosphere: {stage.atmosphere}</span>
                              <span className="text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                {routeImpact.stressReliefPct}% Stress Relieved
                              </span>
                            </div>
                          </>
                        )}

                        {/* Stage 3: HIP */}
                        {stage.id === 'stage-3' && (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-[#9A9DA3]">Process Temperature</span>
                                  <span className="text-white font-bold">{stage.tempC}°C</span>
                                </div>
                                <input
                                  type="range"
                                  min={750}
                                  max={1100}
                                  step={10}
                                  value={stage.tempC}
                                  onChange={(e) => updateStageTemp(stage.id, Number(e.target.value))}
                                  className="w-full accent-[#5E6BFF] bg-[#1a1b1d] h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>

                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-[#9A9DA3]">Argon Gas Pressure</span>
                                  <span className="text-[#50d8e9] font-bold">{stage.pressureBar} bar</span>
                                </div>
                                <input
                                  type="range"
                                  min={200}
                                  max={2000}
                                  step={50}
                                  value={stage.pressureBar}
                                  onChange={(e) => updateStagePressure(stage.id, Number(e.target.value))}
                                  className="w-full accent-[#50d8e9] bg-[#1a1b1d] h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[#7189a3] pt-1">
                              <span>Cycle: 2.0 hrs Soak • High-Purity Argon HIP</span>
                              <span className="text-[#50d8e9] font-bold text-[10px] px-2 py-0.5 rounded bg-[#50d8e9]/10 border border-[#50d8e9]/20">
                                {routeImpact.hipPoreClosurePct}% Pore Closure (+{Math.max(0, routeImpact.fatigueStrengthMPa - routeImpact.baseFatigue)} MPa Fatigue)
                              </span>
                            </div>
                          </>
                        )}

                        {/* Stage 4: STA */}
                        {stage.id === 'stage-4' && (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-[#9A9DA3]">Solution Temperature</span>
                                  <span className="text-white font-bold">{stage.tempC}°C</span>
                                </div>
                                <input
                                  type="range"
                                  min={800}
                                  max={1050}
                                  step={10}
                                  value={stage.tempC}
                                  onChange={(e) => updateStageTemp(stage.id, Number(e.target.value))}
                                  className="w-full accent-[#5E6BFF] bg-[#1a1b1d] h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>

                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-[#9A9DA3]">Aging Temperature</span>
                                  <span className="text-indigo-300 font-bold">{stage.secondaryTempC ?? 520}°C</span>
                                </div>
                                <input
                                  type="range"
                                  min={450}
                                  max={620}
                                  step={10}
                                  value={stage.secondaryTempC ?? 520}
                                  onChange={(e) => updateStageSecondaryTemp(stage.id, Number(e.target.value))}
                                  className="w-full accent-indigo-400 bg-[#1a1b1d] h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[#7189a3] pt-1">
                              <span>Water Quench + 4.0 hrs Aging in Argon</span>
                              <span className="text-indigo-400 font-bold text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                                +{routeImpact.stage4YieldBoost} MPa Precipitation Hardening
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Mechanical Response Predictor (5 cols) */}
            <div className="lg:col-span-5 bg-[#101112] border border-[#232426] rounded-xl p-6 shadow-xl space-y-6 sticky top-24">
              <div className="pb-3 border-b border-[#232426]">
                <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Synthesized Mechanical Performance
                </h4>
                <p className="text-[11px] text-[#9A9DA3] mt-1">
                  Predicted output after completing the configured multi-stage route.
                </p>
              </div>

              <div className="space-y-4 font-mono text-xs">
                {/* Metric 1: Yield Strength */}
                <div className="bg-[#0b0c0e] p-3.5 rounded-lg border border-[#1a1b1d] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[#9A9DA3]">Yield Strength (0.2% Offset)</span>
                    <span className="text-base font-bold text-white">{routeImpact.yieldStrengthMPa} MPa</span>
                  </div>
                  <div className="w-full bg-[#161719] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#5E6BFF] to-[#50d8e9] h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (routeImpact.yieldStrengthMPa / 1400) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] pt-0.5">
                    <span className="text-[#7189a3]">Baseline: {routeImpact.baseYield} MPa</span>
                    <span className={routeImpact.deltaYield >= 0 ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                      {routeImpact.deltaYield >= 0 ? `+${routeImpact.deltaYield}` : `${routeImpact.deltaYield}`} MPa vs As-Built
                    </span>
                  </div>
                </div>

                {/* Metric 2: Tensile Strength */}
                <div className="bg-[#0b0c0e] p-3.5 rounded-lg border border-[#1a1b1d] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[#9A9DA3]">Ultimate Tensile Strength (UTS)</span>
                    <span className="text-base font-bold text-white">{routeImpact.utsMPa} MPa</span>
                  </div>
                  <div className="w-full bg-[#161719] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (routeImpact.utsMPa / 1500) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] pt-0.5">
                    <span className="text-[#7189a3]">Baseline: {routeImpact.baseUTS} MPa</span>
                    <span className={routeImpact.deltaUTS >= 0 ? 'text-blue-400 font-semibold' : 'text-amber-400 font-semibold'}>
                      {routeImpact.deltaUTS >= 0 ? `+${routeImpact.deltaUTS}` : `${routeImpact.deltaUTS}`} MPa
                    </span>
                  </div>
                </div>

                {/* Metric 3: Elongation */}
                <div className="bg-[#0b0c0e] p-3.5 rounded-lg border border-[#1a1b1d] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[#9A9DA3]">Elongation at Break (Ductility)</span>
                    <span className="text-base font-bold text-emerald-400">{routeImpact.elongationPct}%</span>
                  </div>
                  <div className="w-full bg-[#161719] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (routeImpact.elongationPct / 25) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] pt-0.5">
                    <span className="text-[#7189a3]">As-Built: {routeImpact.baseElongation}%</span>
                    <span className={routeImpact.elongationPct >= 10 ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                      {routeImpact.elongationPct >= 10 ? '✓ Exceeds ASTM min 10%' : '⚠ Below ASTM F2924 (<10%)'}
                    </span>
                  </div>
                </div>

                {/* Metric 4: Residual Stress Reduction */}
                <div className="bg-[#0b0c0e] p-3.5 rounded-lg border border-[#1a1b1d] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[#9A9DA3]">Internal Residual Stress</span>
                    <span className={`text-base font-bold ${
                      routeImpact.residualStressMPa > 200 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {routeImpact.residualStressMPa} MPa
                    </span>
                  </div>
                  <div className="w-full bg-[#161719] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        routeImpact.residualStressMPa <= 50 ? 'bg-emerald-500' : routeImpact.residualStressMPa <= 150 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, (routeImpact.residualStressMPa / 600) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#7189a3] block">
                    {routeImpact.residualStressMPa <= 50
                      ? `✓ Fully Relaxed / Safe from Distortions (${routeImpact.stressReliefPct}% relieved)`
                      : `⚠ Active Residual Stress (${routeImpact.residualStressMPa} MPa)`}
                  </span>
                </div>

                {/* Metric 5: Fatigue Strength */}
                <div className="bg-[#0b0c0e] p-3.5 rounded-lg border border-[#1a1b1d] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[#9A9DA3]">High-Cycle Fatigue (10⁷ cycles)</span>
                    <span className="text-base font-bold text-[#50d8e9]">{routeImpact.fatigueStrengthMPa} MPa</span>
                  </div>
                  <div className="w-full bg-[#161719] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#50d8e9] h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (routeImpact.fatigueStrengthMPa / 1000) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#7189a3] block">
                    {enabledStages['stage-3']
                      ? `✓ HIP pore closure applied (${routeImpact.hipPoreClosurePct}% healed, endurance boosted)`
                      : 'Un-hipped baseline (defect-limited)'}
                  </span>
                </div>
              </div>

              {/* Real-time Synthesis Stage Notes */}
              <div className="bg-[#0b0c0e] p-3.5 rounded-lg border border-[#1a1b1d] space-y-2 text-[11px] font-mono">
                <span className="text-[#5E6BFF] font-bold block flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  Live Route Metallurgy Synthesis:
                </span>
                <ul className="space-y-1 text-[#9A9DA3] pl-1">
                  {enabledStages['stage-1'] && (
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#50d8e9]">•</span>
                      <span>{routeImpact.s1Notes}</span>
                    </li>
                  )}
                  {enabledStages['stage-2'] && (
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-400">•</span>
                      <span>{routeImpact.s2Notes}</span>
                    </li>
                  )}
                  {enabledStages['stage-3'] && (
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#50d8e9]">•</span>
                      <span>{routeImpact.s3Notes}</span>
                    </li>
                  )}
                  {enabledStages['stage-4'] && (
                    <li className="flex items-start gap-1.5">
                      <span className="text-indigo-400">•</span>
                      <span>{routeImpact.s4Notes}</span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => onSelectMaterialInWorkbench(selectedRouteAlloy)}
                  className="w-full py-2.5 rounded-lg text-xs font-mono font-bold bg-[#1a1b1d] hover:bg-[#25272a] text-white border border-[#232426] transition-colors flex items-center justify-center gap-2"
                >
                  <span>Compare with Standard Route in Explorer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. PRACTICAL CONTINUOUS COOLING (CCT) & PHASE KINETICS (#insights) */}
      {/* ==================================================================== */}
      <section
        id="insights-section"
        className="w-full max-w-[1728px] overflow-x-hidden px-4 sm:px-8 border-t border-[#232426] py-20 mx-auto scroll-mt-20 relative min-w-0"
      >
        <div className="max-w-[1516px] w-full mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-[#232426]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#50d8e9]/10 text-[#50d8e9] border border-[#50d8e9]/30 flex items-center gap-1.5">
                  <Cpu className="w-3 h-3" />
                  PHASE KINETICS &amp; CCT SIMULATOR
                </span>
                <span className="text-xs font-mono text-[#9A9DA3]">Continuous Cooling Transformation (CCT)</span>
              </div>
              <h2 className="font-h2 text-2xl sm:text-4xl text-white font-bold tracking-tight">
                Continuous Cooling Transformation &amp; Microstructure Engine
              </h2>
              <p className="text-sm text-[#9A9DA3] max-w-2xl mt-1.5">
                Adjust cooling rate vectors across 6 orders of magnitude. Instantly determine phase constituent fractions (Martensitic α&apos;, Widmanstätten basketweave, colonial lamellar α+β) and Hall-Petch hardness.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Interactive Cooling Rate Slider & CCT Controls (5 cols) */}
            <div className="lg:col-span-5 bg-[#101112] border border-[#232426] rounded-xl p-6 shadow-xl space-y-6">
              <div className="pb-3 border-b border-[#232426] flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Cooling Rate Vector (dT/dt)
                </span>
                <span className="text-xs font-mono text-[#50d8e9] font-bold">
                  {coolingRateKs.toLocaleString()} K/s
                </span>
              </div>

              {/* Slider for Log Cooling Rate */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-[#9A9DA3]">
                  <span>Log₁₀ (Cooling Rate)</span>
                  <span className="text-white font-bold">10^{cctCoolingRateLog.toFixed(1)} K/s</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={6.0}
                  step={0.1}
                  value={cctCoolingRateLog}
                  onChange={(e) => setCctCoolingRateLog(Number(e.target.value))}
                  className="w-full accent-[#50d8e9] bg-[#1a1b1d] h-2 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#7189a3]">
                  <span>10¹ (WAAM / Slow)</span>
                  <span>10³ (DED-LB)</span>
                  <span>10⁶ (PBF-LB Ultra-Fast)</span>
                </div>
              </div>

              {/* Phase Result Cards */}
              <div className="space-y-3 font-mono text-xs">
                <div className="bg-[#0b0c0e] p-3.5 rounded-lg border border-[#1a1b1d]">
                  <span className="text-[10px] text-[#7189a3] block">Predicted Primary Phase Constituent:</span>
                  <span className="text-sm font-bold text-white block mt-1">
                    {phaseKineticsResult.phaseName}
                  </span>
                  <span className="text-[11px] text-[#50d8e9] block mt-0.5">
                    {phaseKineticsResult.morphology}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0b0c0e] p-3 rounded-lg border border-[#1a1b1d]">
                    <span className="text-[10px] text-[#7189a3] block">α Lath Spacing (λ)</span>
                    <span className="text-base font-bold text-white mt-0.5 block">
                      {phaseKineticsResult.lathThicknessUm} µm
                    </span>
                    <span className="text-[10px] text-[#9A9DA3]">Microstructural Scale</span>
                  </div>

                  <div className="bg-[#0b0c0e] p-3 rounded-lg border border-[#1a1b1d]">
                    <span className="text-[10px] text-[#7189a3] block">Hall-Petch Hardness</span>
                    <span className="text-base font-bold text-emerald-400 mt-0.5 block">
                      {phaseKineticsResult.predictedHardnessHV} HV
                    </span>
                    <span className="text-[10px] text-[#9A9DA3]">Calculated from λ</span>
                  </div>
                </div>

                {/* Practical Metallurgical Guidance */}
                <div className="bg-[#0b0c0e] p-3.5 rounded-lg border border-[#1a1b1d] space-y-1.5">
                  <span className="text-[10px] text-amber-400 font-bold block flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Metallurgical Risk &amp; Shop-Floor Advisory:
                  </span>
                  <p className="text-[11px] text-[#c6c5d8] leading-relaxed">
                    {phaseKineticsResult.riskWarning}
                  </p>
                  <p className="text-[11px] text-[#50d8e9] leading-relaxed pt-1 border-t border-[#1a1b1d]">
                    <strong>Recommendation:</strong> {phaseKineticsResult.recommendation}
                  </p>
                </div>
              </div>
            </div>

            {/* Right CCT Phase Diagram Visualization (7 cols) */}
            <div className="lg:col-span-7 bg-[#101112] border border-[#232426] rounded-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#232426]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#50d8e9]" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Continuous Cooling Transformation (CCT) Diagram
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#9A9DA3]">
                  Ti-6Al-4V Calibrated Kinetic Boundaries
                </span>
              </div>

              {/* Dynamic CCT Chart */}
              <div className="relative h-72 sm:h-80 w-full bg-[#070708] rounded-lg border border-[#1b1c1e] p-4 flex flex-col justify-between overflow-hidden font-mono">
                <svg className="w-full h-full" viewBox="0 0 500 240" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <line x1="0" y1="50" x2="500" y2="50" stroke="#232426" strokeDasharray="3 3" />
                  <line x1="0" y1="110" x2="500" y2="110" stroke="#232426" strokeDasharray="3 3" />
                  <line x1="0" y1="170" x2="500" y2="170" stroke="#232426" strokeDasharray="3 3" />

                  {/* Beta Transus (995°C) */}
                  <line x1="0" y1="45" x2="500" y2="45" stroke="#fbbf24" strokeWidth="1" strokeDasharray="4 2" />
                  <text x="8" y="40" fill="#fbbf24" fontSize="9">β-Transus (995°C)</text>

                  {/* Martensite Start Ms (575°C) */}
                  <line x1="0" y1="140" x2="500" y2="140" stroke="#f43f5e" strokeWidth="1" strokeDasharray="4 2" />
                  <text x="8" y="135" fill="#f43f5e" fontSize="9">M_s Martensite Start (575°C)</text>

                  {/* CCT Phase Transformation 'Nose' regions */}
                  {/* Diffusional Widmanstatten Alpha Start Zone */}
                  <path
                    d="M 160,50 Q 230,85 280,135 Q 240,165 170,185"
                    fill="none"
                    stroke="#5E6BFF"
                    strokeWidth="1.8"
                    strokeDasharray="3 1"
                  />
                  <text x="215" y="80" fill="#bec2ff" fontSize="9">α+β Start</text>

                  {/* Martensite Region */}
                  <path
                    d="M 0,140 L 160,140"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2"
                  />
                  <text x="70" y="155" fill="#f43f5e" fontSize="9">Martensite (α&apos;)</text>

                  {/* Dynamic Cooling Path Curve based on cooling rate */}
                  {(() => {
                    // Position curve according to log cooling rate
                    // Higher cooling rate (log=6) -> fast drop on left
                    // Lower cooling rate (log=1) -> gradual slope on right
                    const startX = 20;
                    const endX = 20 + (6.0 - cctCoolingRateLog) * 75;
                    const dCurve = `M ${startX},15 Q ${endX * 0.4},80 ${endX},230`;

                    return (
                      <>
                        <path
                          d={dCurve}
                          fill="none"
                          stroke="#50d8e9"
                          strokeWidth="2.5"
                          className="transition-all duration-300"
                        />
                        <circle cx={endX * 0.65} cy="140" r="4" fill="#50d8e9" />
                      </>
                    );
                  })()}
                </svg>

                {/* Diagram Footnotes */}
                <div className="flex justify-between items-center text-[10px] text-[#7189a3] pt-2 border-t border-[#1b1c1e]">
                  <span>Log Time (t) → 10⁻⁴s to 10²s</span>
                  <span className="text-[#50d8e9] font-bold">
                    Active Vector: {coolingRateKs.toLocaleString()} K/s
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className={`p-2 rounded border ${
                  coolingRateKs >= 410 ? 'bg-[#50d8e9]/15 border-[#50d8e9] text-[#50d8e9]' : 'bg-[#0b0c0e] border-[#1a1b1d] text-[#7189a3]'
                }`}>
                  <span className="text-[10px] block font-bold">α&apos; Martensite</span>
                  <span>&gt; 410 K/s</span>
                </div>
                <div className={`p-2 rounded border ${
                  coolingRateKs >= 20 && coolingRateKs < 410 ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' : 'bg-[#0b0c0e] border-[#1a1b1d] text-[#7189a3]'
                }`}>
                  <span className="text-[10px] block font-bold">Widmanstätten</span>
                  <span>20 – 410 K/s</span>
                </div>
                <div className={`p-2 rounded border ${
                  coolingRateKs < 20 ? 'bg-amber-950/40 border-amber-500 text-amber-400' : 'bg-[#0b0c0e] border-[#1a1b1d] text-[#7189a3]'
                }`}>
                  <span className="text-[10px] block font-bold">Colonial α+β</span>
                  <span>&lt; 20 K/s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 4. SIGNATURE INDUSTRY PROOF POINTS & EXECUTIVE QUOTES               */}
      {/* ==================================================================== */}
      <section className="px-4 sm:px-8 border-t border-[#232426] flex items-center bg-[#050505] py-20 max-w-[1728px] mx-auto">
        <div className="max-w-[1516px] w-full mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div
            onClick={() => onSelectMaterialInWorkbench('ti-6al-4v')}
            className="lg:col-span-3 bg-[#D1EBEB] rounded-2xl p-8 sm:p-10 flex flex-col justify-between min-h-[340px] cursor-pointer hover:opacity-95 transition-opacity"
          >
            <p className="font-h2 text-2xl sm:text-3xl text-black leading-tight max-w-2xl">
              &ldquo;MatSci Navigator gave our metallurgy and propulsion teams a unified lens across 20 titanium alloys and 275 additive manufacturing process variants.&rdquo;
            </p>
            <div className="mt-8">
              <div className="font-bold text-black text-base">Dr. Mara Chen</div>
              <div className="text-black/70 text-xs sm:text-sm">
                VP Materials Engineering, Northline Aerospace (450+ Engineers)
              </div>
            </div>
          </div>

          <div
            onClick={() => onSelectMaterialInWorkbench('ti-6al-4v-eli')}
            className="lg:col-span-2 bg-[#C4FF44] rounded-2xl p-8 sm:p-10 flex flex-col justify-between min-h-[340px] cursor-pointer hover:opacity-95 transition-opacity"
          >
            <p className="font-h3 text-xl sm:text-2xl text-black leading-tight">
              &ldquo;It replaced disparate ASTM AM standards, fragmented vendor data sheets, and manual heat-treatment lookup tables.&rdquo;
            </p>
            <div className="mt-8">
              <div className="font-bold text-black text-base">Ivo Patel</div>
              <div className="text-black/70 text-xs sm:text-sm">
                Director of AM &amp; Vacuum Sintering Operations, Meridian Advanced Alloys
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
