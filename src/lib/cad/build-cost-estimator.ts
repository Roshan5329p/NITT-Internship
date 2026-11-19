/**
 * NIT Trichy Titanium AM Platform — Phase 4 Build Time, Material & Cost Estimator
 * Computes layer scan + recoat + setup + post-processing durations and feedstock/machine/gas costs
 * (with explicit placeholder-rate labels and batch XY build-plate nesting savings).
 */

import { normalizePostProcessing } from '../ti64-metallurgy';
import type { CadGeometryReport } from './geometry-analyzer';
import type { CadPrintabilityReport } from './printability-rules';
import type { MachinePreset } from './machine-presets';
import type { CadProcessParameters } from './part-build-simulator';

export interface BuildTimeBreakdown {
  totalBuildHours: number;
  scanHours: number;
  recoatHours: number;
  setupPreheatHours: number;
  postProcessingHours: number;
  layerCount: number;
}

export interface MaterialMassBreakdown {
  partMassGrams: number;
  supportMassGrams: number;
  wasteFactorPct: number;
  totalConsumedKg: number;
}

export interface CostBreakdownUsd {
  isPlaceholderRates: boolean;
  batchSize: number;
  partsPerPlateMax: number;
  machineCostUsd: number;
  materialCostUsd: number;
  gasCostUsd: number;
  postProcessingCostUsd: number;
  totalBatchCostUsd: number;
  costPerPartUsd: number;
}

export interface CadBuildEconomicsReport {
  time: BuildTimeBreakdown;
  material: MaterialMassBreakdown;
  cost: CostBreakdownUsd;
}

export function estimateBuildTimeAndCost(
  geo: CadGeometryReport,
  printability: CadPrintabilityReport,
  params: CadProcessParameters,
  machine: MachinePreset,
  batchSize: number = 1
): CadBuildEconomicsReport {
  const proc = machine.process;
  const post = normalizePostProcessing(params.postProcessing || 'HIP');
  const safeBatch = Math.max(1, Math.min(24, Math.round(batchSize)));

  // Max XY nesting capacity on build plate (with 5 mm part spacing margin)
  const px = Math.max(2, geo.boundingBox.size[0] + 5);
  const py = Math.max(2, geo.boundingBox.size[1] + 5);
  const nx = Math.max(1, Math.floor(machine.envelopeMm[0] / px));
  const ny = Math.max(1, Math.floor(machine.envelopeMm[1] / py));
  const partsPerPlateMax = Math.max(1, nx * ny);
  const actualBatch = Math.min(safeBatch, partsPerPlateMax);

  const tMm = Math.max(0.015, (params.t || 40) * 1e-3);
  const hMm = Math.max(0.03, (params.h || 110) * 1e-3);
  const v = Math.max(1, params.v || 960);
  const lasers = Math.max(1, machine.laserCount || 1);

  const layerCount = Math.max(1, Math.round(geo.boundingBox.size[2] / tMm));
  const singlePartSolidMm3 = geo.volumeMm3 + printability.supportEstimate.supportVolumeCm3 * 1000.0;
  const volRateMm3S = v * hMm * tMm * lasers;
  const scanHours = Number(((singlePartSolidMm3 * actualBatch) / Math.max(0.5, volRateMm3S) / 3600.0).toFixed(2));

  const recoatSecPerLayer = proc === 'lpbf' ? 8.5 : 0.6;
  const recoatHours = Number(((layerCount * recoatSecPerLayer) / 3600.0).toFixed(2));
  const setupPreheatHours = proc === 'lpbf' ? 1.5 : 0.8;

  const postProcessingHours =
    post === 'HIP' ? 4.5 :
    (post === 'Annealed' ? 3.0 :
    (post === 'Stress-relieved' ? 2.5 :
    (post === 'Solution-Aged' || post === 'Bi-modal' ? 5.0 : 0.8)));

  const totalBuildHours = Number((scanHours + recoatHours + setupPreheatHours).toFixed(2));

  const partMassGrams = Number((geo.massTi64Grams * actualBatch).toFixed(1));
  const supportMassGrams = Number((printability.supportEstimate.supportMassGrams * actualBatch).toFixed(1));
  const wasteFactorPct = proc === 'lpbf' ? 8 : (proc === 'ded-laser' ? 28 : 12);
  const totalConsumedKg = Number((((partMassGrams + supportMassGrams) * (1 + wasteFactorPct / 100.0)) / 1000.0).toFixed(3));

  const activeBuildClockHours = scanHours + recoatHours + 0.5 * setupPreheatHours;
  const machineCostUsd = Number((activeBuildClockHours * machine.hourlyRateUsd).toFixed(2));
  const materialCostUsd = Number((totalConsumedKg * machine.materialCostPerKgUsd).toFixed(2));
  const gasCostUsd = Number(((scanHours + recoatHours) * machine.gasCostPerHourUsd).toFixed(2));

  const postBatchFee =
    post === 'HIP' ? 220 :
    (post === 'Annealed' ? 110 :
    (post === 'Stress-relieved' ? 85 :
    (post === 'Solution-Aged' || post === 'Bi-modal' ? 250 : 0)));
  const supportRemovalPerPart = printability.supportEstimate.removalDifficulty === 'None'
    ? 15
    : (printability.supportEstimate.removalDifficulty === 'Easy' ? 40 : (printability.supportEstimate.removalDifficulty === 'Moderate' ? 75 : 130));
  const postProcessingCostUsd = Number((postBatchFee + supportRemovalPerPart * actualBatch).toFixed(2));

  const totalBatchCostUsd = Number((machineCostUsd + materialCostUsd + gasCostUsd + postProcessingCostUsd).toFixed(2));
  const costPerPartUsd = Number((totalBatchCostUsd / actualBatch).toFixed(2));

  return {
    time: {
      totalBuildHours,
      scanHours,
      recoatHours,
      setupPreheatHours,
      postProcessingHours,
      layerCount
    },
    material: {
      partMassGrams,
      supportMassGrams,
      wasteFactorPct,
      totalConsumedKg
    },
    cost: {
      isPlaceholderRates: machine.isPlaceholderRates,
      batchSize: actualBatch,
      partsPerPlateMax,
      machineCostUsd,
      materialCostUsd,
      gasCostUsd,
      postProcessingCostUsd,
      totalBatchCostUsd,
      costPerPartUsd
    }
  };
}
