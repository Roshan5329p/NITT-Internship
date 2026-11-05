export type ProcessCategory =
  | 'Binder Jetting'
  | 'Directed Energy Deposition'
  | 'Material Extrusion'
  | 'Material Jetting'
  | 'Powder Bed Fusion'
  | 'Sheet Lamination'
  | 'Vat Photopolymerization'
  | 'Wire arc additive manufacturing';

export type MaterialCategory = ProcessCategory | 'All Processes';

export interface ProcessStep {
  phaseCode: string;
  stage: string;
  temperature: string;
  pressure: string;
  duration: string;
  atmosphere: string;
  details: string;
}

export interface ProcessVariant {
  id: string;
  name: string;
  shortName: string;
  temperOrGrade: string;
  processCategory: ProcessCategory;
  subprocess: string;
  postProcessingCondition: string;
  summary: string;
  peakTempC: number;
  holdTimeMin: number;
  coolingRate: string;
  atmosphere: string;
  yieldChangePct: string;
  steps: ProcessStep[];
  propertyOverrides?: {
    tensileStrengthMPa?: string;
    yieldStrengthMPa?: string;
    elasticModulusGPa?: string;
    elongationPct?: string;
    hardnessHV?: string;
    fractureToughness?: string;
    fatigueStrengthMPa?: string;
    charpyImpactEnergyJ?: string;
    poissonsRatio?: string;
    dampingLossFactor?: string;
    waveSpeedMs?: string;

    liquidusC?: string;
    betaTransusC?: string;
    maxServiceTempC?: string;
    thermalConductivity?: string;
    thermalExpansionCTE?: string;
    specificHeat?: string;
    emissivity?: string;

    densityGcm3?: string;
    relativeDensityPct?: string;
    porosityPct?: string;
    surfaceRoughnessRa?: string;
    residualStressMax?: string;
    buildRate?: string;
    anisotropy?: string;
    minFeatureSize?: string;
    accuracy?: string;

    oxygenContentWt?: string;
    corrosionRating?: string;
    biocompatibilityRating?: string;
    electricalResistivity?: string;
    magneticSusceptibility?: string;
    laserAbsorptivity?: string;
    visibleReflectance?: string;
  };
}

export interface MaterialItem {
  id: string;
  alloyId: string;
  name: string;
  category: ProcessCategory;
  availableProcesses: ProcessCategory[];
  tagLabel: string;
  subtitle: string;
  formula: string;
  crystalStructure: string;
  standardCode: string;
  overview: string;
  applications: string[];
  mechanical: {
    tensileStrengthMPa: string;
    yieldStrengthMPa: string;
    elasticModulusGPa: string;
    elongationPct: string;
    hardnessHV: string;
    fractureToughness: string;
    fatigueStrengthMPa: string;
    charpyImpactEnergyJ: string;
    poissonsRatio: string;
    dampingLossFactor: string;
    waveSpeedMs: string;
  };
  thermal: {
    liquidusC: string;
    betaTransusC: string;
    maxServiceTempC: string;
    thermalConductivity: string;
    thermalExpansionCTE: string;
    specificHeat: string;
    emissivity: string;
  };
  amQuality: {
    densityGcm3: string;
    relativeDensityPct: string;
    porosityPct: string;
    surfaceRoughnessRa: string;
    residualStressMax: string;
    buildRate: string;
    anisotropy: string;
    minFeatureSize: string;
    accuracy: string;
  };
  chemicalAndPhysical: {
    oxygenContentWt: string;
    corrosionRating: string;
    biocompatibilityRating: string;
    electricalResistivity: string;
    magneticSusceptibility: string;
    laserAbsorptivity: string;
    visibleReflectance: string;
  };
  processRoutes: ProcessVariant[];
}

export const AUTHORIZED_PROCESSES: ProcessCategory[] = [
  'Binder Jetting',
  'Directed Energy Deposition',
  'Material Extrusion',
  'Material Jetting',
  'Powder Bed Fusion',
  'Sheet Lamination',
  'Vat Photopolymerization',
  'Wire arc additive manufacturing'
];

export const PROCESS_CATEGORIES: ProcessCategory[] = AUTHORIZED_PROCESSES;
export const MATERIAL_CATEGORIES: ProcessCategory[] = AUTHORIZED_PROCESSES;

export interface QuickSuggestion {
  id: string;
  label: string;
}

export const QUICK_SUGGESTIONS: QuickSuggestion[] = [
  { id: 'ti-6al-4v', label: 'Ti-6Al-4V (Grade 5)' },
  { id: 'ti-6al-4v-eli', label: 'Ti-6Al-4V ELI (Grade 23)' },
  { id: 'ti-grade-2', label: 'Ti Grade 2 (CP)' },
  { id: 'ti-6242', label: 'Ti-6242 (High-Temp)' },
  { id: 'ti-5553', label: 'Ti-5553 (Near-Beta)' },
  { id: 'ti-48al-2cr-2nb', label: 'Ti-48Al-2Cr-2Nb (gamma TiAl)' }
];

export const QUICK_SUGGESTION_IDS = QUICK_SUGGESTIONS;

export const TOTAL_MATERIALS_COUNT = 20;
export const TOTAL_PROCESS_VARIANTS_COUNT = 275;

export const MATERIALS_CATALOG: MaterialItem[] = await Promise.all([
  import('./materialsCatalog/catalog-0').then(({ default: items }) => items),
  import('./materialsCatalog/catalog-1').then(({ default: items }) => items),
  import('./materialsCatalog/catalog-2').then(({ default: items }) => items),
  import('./materialsCatalog/catalog-3').then(({ default: items }) => items)
]).then((chunks) => chunks.flat());
