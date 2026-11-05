/**
 * Industrial Economics & ESG Sustainability Engine
 * Calculates Volumetric Build Rate (VBR), layer-by-layer build time,
 * powder consumption, argon shielding costs, electrical energy consumption,
 * machine amortization, commercial scrap-prevention ROI, and carbon footprint (ESG).
 */

import { ALLOY_THERMAL_PROPERTIES } from './amPhysicsEngine';

export interface EconomicCalculationParams {
  alloyId: string;
  processId: string;
  laserPowerW: number;
  scanSpeedMmS: number;
  hatchSpacingUm: number;
  layerThicknessUm: number;
  partVolumeCm3?: number; // Default: 65 cm3 (~aerospace bracket coupon)
  partHeightMm?: number; // Default: 110 mm
  quantityPerBatch?: number; // Default: 4 parts per plate
  powderRecycleRatePct?: number; // Default: 85%
}

export interface EconomicAnalysisResult {
  volumetricBuildRateCm3Hr: number;
  totalBuildTimeHours: number;
  laserExposureHours: number;
  recoatingHours: number;
  totalLayers: number;
  
  // Cost Breakdown per batch
  powderCostUsd: number;
  argonGasCostUsd: number;
  electricalEnergyCostUsd: number;
  machineDepreciationCostUsd: number;
  totalBatchCostUsd: number;
  costPerPartUsd: number;

  // Mass Telemetry
  partMassGrams: number;
  totalBatchMassKg: number;
  powderRequiredKg: number;

  // Commercial ROI (Savings from avoided physical machine scraps)
  singleTrialFailureCostUsd: number;
  estimatedIterationsSaved: number;
  totalCommercialSavingsUsd: number;
  cycleTimeSavedHours: number;

  // ESG Sustainability Scorecard
  energyConsumedKwh: number;
  carbonEmittedKgCo2: number;
  carbonSavingsAvoidedKgCo2: number;
  sustainabilityRating: 'Tier-1 Elite' | 'Tier-2 High Efficiency' | 'Tier-3 Standard';
}

// Powder market cost per kg ($/kg) for spherical plasma-atomized grade
const ALLOY_POWDER_COST_PER_KG: Record<string, number> = {
  'ti-6al-4v': 220,
  'ti-6al-4v-eli': 260,
  'ti-6242': 380,
  'ti-5553': 440,
  'ti-grade-2': 140,
  'ti-gamma-tial': 490,
  'ti-10-2-3': 410,
  'ti-811': 390,
};

// Material density (g/cm^3)
const ALLOY_DENSITIES: Record<string, number> = {
  'ti-6al-4v': 4.43,
  'ti-6al-4v-eli': 4.43,
  'ti-6242': 4.54,
  'ti-5553': 4.65,
  'ti-grade-2': 4.51,
  'ti-gamma-tial': 3.90,
};

export function calculateIndustrialEconomics(
  params: EconomicCalculationParams
): EconomicAnalysisResult {
  const {
    alloyId,
    laserPowerW,
    scanSpeedMmS,
    hatchSpacingUm,
    layerThicknessUm,
    partVolumeCm3 = 65,
    partHeightMm = 110,
    quantityPerBatch = 4,
    powderRecycleRatePct = 85,
  } = params;

  const density = ALLOY_THERMAL_PROPERTIES[alloyId]?.density
    ? ALLOY_THERMAL_PROPERTIES[alloyId].density / 1000
    : ALLOY_DENSITIES[alloyId] || 4.43;
  const powderCostPerKg = ALLOY_POWDER_COST_PER_KG[alloyId] || 240;

  // 1. Volumetric Build Rate (VBR in cm^3 / hr)
  // VBR = v (mm/s) * h (mm) * t (mm) * 3600 s/hr / 1000 mm^3/cm^3
  const vMmS = Math.max(50, scanSpeedMmS);
  const hMm = Math.max(0.01, hatchSpacingUm * 1e-3);
  const tMm = Math.max(0.01, layerThicknessUm * 1e-3);
  const volumetricBuildRateCm3Hr = (vMmS * hMm * tMm * 3600) / 1000;

  // 2. Build Time Computation
  const totalVolumeBatchCm3 = partVolumeCm3 * quantityPerBatch * 1.25; // 25% allowance for support structures
  const laserExposureHours = volumetricBuildRateCm3Hr > 0 ? totalVolumeBatchCm3 / volumetricBuildRateCm3Hr : 5.0;

  // Layer recoating: ~10 seconds per recoater traverse + wiper motion
  const totalLayers = Math.max(1, Math.round(partHeightMm / tMm));
  const recoatingHours = (totalLayers * 10) / 3600;

  // Chamber preparation, inert gas purging, preheat: ~1.2 hours fixed
  const prepHours = 1.2;
  const totalBuildTimeHours = laserExposureHours + recoatingHours + prepHours;

  // 3. Mass Computation
  const singlePartMassGrams = partVolumeCm3 * density;
  const totalPartMassGrams = singlePartMassGrams * quantityPerBatch;
  const totalBatchMassKg = (totalVolumeBatchCm3 * density) / 1000;
  
  // Powder efficiency: accounts for unsieved agglomerates and support waste
  const effectiveRecycleFraction = Math.min(0.95, Math.max(0.5, powderRecycleRatePct / 100));
  const virginPowderFraction = 1 - effectiveRecycleFraction;
  const powderRequiredKg = totalBatchMassKg * (1 + virginPowderFraction * 0.4);

  // 4. Operating Costs
  // Powder material cost: virgin cost + recycling/sieving service cost ($12/kg recycled)
  const powderCostUsd = (powderRequiredKg * virginPowderFraction * powderCostPerKg) +
    (powderRequiredKg * effectiveRecycleFraction * 15);

  // Argon shielding gas: 2,500 L purge + 14 L/min active chamber circulation @ $0.038 / L
  const totalArgonLiters = 2500 + (totalBuildTimeHours * 60 * 14);
  const argonGasCostUsd = totalArgonLiters * 0.038;

  // Electrical energy: Laser wall plug efficiency ~32% + Chiller & Heaters (3.4 kW base load)
  const laserElectricalPowerKw = (laserPowerW / 1000) / 0.32;
  const baseLoadKw = 3.4;
  const totalPowerKw = (laserElectricalPowerKw * (laserExposureHours / totalBuildTimeHours)) + baseLoadKw;
  const energyConsumedKwh = totalPowerKw * totalBuildTimeHours;
  const electricityTariffPerKwh = 0.16; // Standard industrial tariff ($/kWh)
  const electricalEnergyCostUsd = energyConsumedKwh * electricityTariffPerKwh;

  // Industrial Machine Hourly Rate (depreciation of $650k LPBF machine over 5 years + service contract)
  const machineRatePerHr = 75; // $/hr
  const machineDepreciationCostUsd = totalBuildTimeHours * machineRatePerHr;

  const totalBatchCostUsd = powderCostUsd + argonGasCostUsd + electricalEnergyCostUsd + machineDepreciationCostUsd;
  const costPerPartUsd = quantityPerBatch > 0 ? totalBatchCostUsd / quantityPerBatch : totalBatchCostUsd;

  // 5. Commercial ROI (Cost avoided per prevented physical test failure)
  // Scrapped build cost includes: 1 full build lost + 3.5 kg wasted powder + metallurgical cutting/polishing + CT scan audit
  const singleTrialFailureCostUsd = 4850;
  const estimatedIterationsSaved = 3; // Typical empirical trial cycles replaced by calibrated simulation
  const totalCommercialSavingsUsd = singleTrialFailureCostUsd * estimatedIterationsSaved;
  const cycleTimeSavedHours = totalBuildTimeHours * estimatedIterationsSaved;

  // 6. ESG & Carbon Footprint
  // Grid carbon factor ~0.78 kg CO2 / kWh, plus embodied titanium refining footprint ~34 kg CO2 / kg Ti
  const carbonEmittedKgCo2 = (energyConsumedKwh * 0.78) + (totalBatchMassKg * 8.5);
  const carbonSavingsAvoidedKgCo2 = (estimatedIterationsSaved * carbonEmittedKgCo2) + (estimatedIterationsSaved * totalBatchMassKg * 34);

  let sustainabilityRating: EconomicAnalysisResult['sustainabilityRating'] = 'Tier-1 Elite';
  if (volumetricBuildRateCm3Hr < 8 || energyConsumedKwh > 120) {
    sustainabilityRating = 'Tier-3 Standard';
  } else if (volumetricBuildRateCm3Hr < 14) {
    sustainabilityRating = 'Tier-2 High Efficiency';
  }

  return {
    volumetricBuildRateCm3Hr: parseFloat(volumetricBuildRateCm3Hr.toFixed(2)),
    totalBuildTimeHours: parseFloat(totalBuildTimeHours.toFixed(1)),
    laserExposureHours: parseFloat(laserExposureHours.toFixed(1)),
    recoatingHours: parseFloat(recoatingHours.toFixed(1)),
    totalLayers,
    powderCostUsd: Math.round(powderCostUsd),
    argonGasCostUsd: Math.round(argonGasCostUsd),
    electricalEnergyCostUsd: Math.round(electricalEnergyCostUsd),
    machineDepreciationCostUsd: Math.round(machineDepreciationCostUsd),
    totalBatchCostUsd: Math.round(totalBatchCostUsd),
    costPerPartUsd: Math.round(costPerPartUsd),
    partMassGrams: Math.round(singlePartMassGrams),
    totalBatchMassKg: parseFloat(totalBatchMassKg.toFixed(2)),
    powderRequiredKg: parseFloat(powderRequiredKg.toFixed(2)),
    singleTrialFailureCostUsd,
    estimatedIterationsSaved,
    totalCommercialSavingsUsd,
    cycleTimeSavedHours: Math.round(cycleTimeSavedHours),
    energyConsumedKwh: Math.round(energyConsumedKwh),
    carbonEmittedKgCo2: Math.round(carbonEmittedKgCo2),
    carbonSavingsAvoidedKgCo2: Math.round(carbonSavingsAvoidedKgCo2),
    sustainabilityRating,
  };
}
