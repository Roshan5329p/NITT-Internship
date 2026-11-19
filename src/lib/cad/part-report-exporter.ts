/**
 * NIT Trichy Titanium AM Platform — Phase 5 Part Report JSON Builder
 * Serializes geometry, printability, Top-3 orientations, layer-by-layer PINN simulation,
 * screening distortion/residual stress, and editable time/cost estimates into a compact JSON report
 * without including heavy raw Float32 triangle buffers.
 */

import type { ParsedCadMesh } from './cad-parser';
import type { CadGeometryReport } from './geometry-analyzer';
import type { CadPrintabilityReport } from './printability-rules';
import type { OrientationOptimizationResult } from './orientation-optimizer';
import type { PartBuildSimulationReport, CadProcessParameters } from './part-build-simulator';
import type { CadBuildEconomicsReport } from './build-cost-estimator';
import type { MachinePreset } from './machine-presets';

export interface CadPartReportPayload {
  fileName: string;
  mesh: ParsedCadMesh;
  geometry: CadGeometryReport;
  printability: CadPrintabilityReport;
  orientation: OrientationOptimizationResult;
  simulation: PartBuildSimulationReport;
  economics: CadBuildEconomicsReport;
  machine: MachinePreset;
  processParameters: CadProcessParameters;
}

export interface CompactCadPartReportJson {
  reportVersion: string;
  generatedAtIso: string;
  disclaimer: string;
  part: {
    fileName: string;
    format: string;
    triangleCount: number;
    wasDecimated: boolean;
    boundingBoxMm: [number, number, number];
    volumeCm3: number;
    massTi64Grams: number;
    surfaceAreaCm2: number;
    isWatertight: boolean;
    minWallThicknessMm: number;
    overhangAreaCm2: number;
    overhangFractionPct: number;
    sharpConcaveCornerCount: number;
    enclosedCavityCount: number;
  };
  machineAndProcess: {
    machineId: string;
    machineName: string;
    processId: string;
    envelopeMm: [number, number, number];
    parameters: CadProcessParameters;
  };
  printability: {
    overallVerdict: string;
    fitsSelectedMachine: boolean;
    wallCheckStatus: string;
    trappedPowderRisk: string;
    supportContactAreaCm2: number;
    supportVolumeCm3: number;
    supportMassGrams: number;
    removalDifficulty: string;
    warnings: string[];
    recommendations: string[];
  };
  orientationTop3: Array<{
    label: string;
    buildHeightMm: number;
    overhangAreaCm2: number;
    estimatedSupportVolumeCm3: number;
    compositeScore: number;
    tradeoffNote: string;
  }>;
  simulationSummary: {
    astmStandard: string;
    astmPass: boolean;
    astmReason: string;
    minLayerYsMpa: number;
    minLayerUtsMpa: number;
    minLayerElongPct: number;
    meanLayerHv: number;
    maxEffectivePreheatC: number;
    weakestLayerZMm: number;
    maxOodDistance: number;
    anyLayerOod: boolean;
    distortionAndStress: PartBuildSimulationReport['distortionAndStress'];
    layerSampleCount: number;
    layers: PartBuildSimulationReport['layers'];
  };
  economics: CadBuildEconomicsReport;
}

export function buildCadPartReportJson(payload: CadPartReportPayload): CompactCadPartReportJson {
  const { fileName, mesh, geometry, printability, orientation, simulation, economics, machine, processParameters } = payload;

  return {
    reportVersion: 'ti64-cad-report-v1.0',
    generatedAtIso: new Date().toISOString(),
    disclaimer:
      'All mechanical, thermal, distortion, and cost values are screening estimates derived from geometry + physics/PINN models (not full thermo-mechanical FEA or destructive ASTM E8 test data).',
    part: {
      fileName: fileName || 'uploaded_part.stl',
      format: mesh.format,
      triangleCount: mesh.triangleCount,
      wasDecimated: mesh.wasDecimated,
      boundingBoxMm: [
        Number(mesh.boundingBox.size[0].toFixed(2)),
        Number(mesh.boundingBox.size[1].toFixed(2)),
        Number(mesh.boundingBox.size[2].toFixed(2))
      ],
      volumeCm3: geometry.volumeCm3,
      massTi64Grams: geometry.massTi64Grams,
      surfaceAreaCm2: geometry.surfaceAreaCm2,
      isWatertight: geometry.isWatertight,
      minWallThicknessMm: geometry.minWallThicknessMm,
      overhangAreaCm2: Number((geometry.overhangAreaMm2 / 100).toFixed(2)),
      overhangFractionPct: geometry.overhangFractionPct,
      sharpConcaveCornerCount: geometry.sharpConcaveCornerCount,
      enclosedCavityCount: geometry.enclosedCavityCount
    },
    machineAndProcess: {
      machineId: machine.id,
      machineName: machine.name,
      processId: machine.process,
      envelopeMm: [...machine.envelopeMm],
      parameters: { ...processParameters }
    },
    printability: {
      overallVerdict: printability.overallVerdict,
      fitsSelectedMachine: printability.fitsSelectedMachine,
      wallCheckStatus: printability.wallCheckStatus,
      trappedPowderRisk: printability.trappedPowderRisk,
      supportContactAreaCm2: printability.supportEstimate.supportContactAreaCm2,
      supportVolumeCm3: printability.supportEstimate.supportVolumeCm3,
      supportMassGrams: printability.supportEstimate.supportMassGrams,
      removalDifficulty: printability.supportEstimate.removalDifficulty,
      warnings: [...printability.warnings],
      recommendations: [...printability.recommendations]
    },
    orientationTop3: orientation.topCandidates.map((o) => ({
      label: o.label,
      buildHeightMm: o.buildHeightMm,
      overhangAreaCm2: o.overhangAreaCm2,
      estimatedSupportVolumeCm3: o.estimatedSupportVolumeCm3,
      compositeScore: o.compositeScore,
      tradeoffNote: o.tradeoffNote
    })),
    simulationSummary: {
      astmStandard: simulation.astmStandard,
      astmPass: simulation.astmPass,
      astmReason: simulation.astmReason,
      minLayerYsMpa: simulation.minLayerYsMpa,
      minLayerUtsMpa: simulation.minLayerUtsMpa,
      minLayerElongPct: simulation.minLayerElongPct,
      meanLayerHv: simulation.meanLayerHv,
      maxEffectivePreheatC: simulation.maxEffectivePreheatC,
      weakestLayerZMm: simulation.weakestLayerZMm,
      maxOodDistance: simulation.maxOodDistance,
      anyLayerOod: simulation.anyLayerOod,
      distortionAndStress: { ...simulation.distortionAndStress },
      layerSampleCount: simulation.layers.length,
      layers: [...simulation.layers]
    },
    economics: {
      time: { ...economics.time },
      material: { ...economics.material },
      cost: { ...economics.cost }
    }
  };
}
