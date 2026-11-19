import { describe, it, expect } from 'vitest';
import { generateDemoBracketStlBuffer, parseStlBuffer } from '../src/lib/cad/cad-parser';
import { analyzeCadGeometry } from '../src/lib/cad/geometry-analyzer';
import { DEFAULT_MACHINE_PRESETS } from '../src/lib/cad/machine-presets';
import { evaluateCadPrintability } from '../src/lib/cad/printability-rules';
import { simulatePartBuild } from '../src/lib/cad/part-build-simulator';
import { estimateBuildTimeAndCost } from '../src/lib/cad/build-cost-estimator';

describe('CAD Phase 4: Layer-by-Layer PINN Part Simulator, Residual Stress & Build Cost', () => {
  it('simulates layer-by-layer PINN properties, heat accumulation & shows HIP lowers stress and passes ASTM F2924', () => {
    const bracket = parseStlBuffer(generateDemoBracketStlBuffer());
    const geo = analyzeCadGeometry(bracket, { layerThicknessMm: 0.5 });
    const eosM290 = DEFAULT_MACHINE_PRESETS.find((m) => m.id === 'eos-m290')!;
    const printability = evaluateCadPrintability(bracket, geo, eosM290);

    const simAsBuilt = simulatePartBuild(bracket, geo, printability, {
      alloyId: 'ti64_gr5',
      P: 280, v: 960, h: 110, t: 40, T0: 200,
      postProcessing: 'None',
      oxygenWtPct: 0.16
    }, eosM290);

    const simHip = simulatePartBuild(bracket, geo, printability, {
      alloyId: 'ti64_gr5',
      P: 280, v: 960, h: 110, t: 40, T0: 200,
      postProcessing: 'HIP',
      oxygenWtPct: 0.16
    }, eosM290);

    expect(simHip.layers.length).toBe(geo.layerSlices.length);
    expect(simHip.maxEffectivePreheatC).toBeGreaterThan(200);
    expect(simHip.perTriangleThermalHotspot.length).toBe(bracket.triangleCount);
    expect(simHip.perTriangleStressHotspot.length).toBe(bracket.triangleCount);
    expect(Array.from(simHip.perTriangleStressHotspot).every(Number.isFinite)).toBe(true);

    // HIP relieves stress & boosts ductility above 10% ASTM F2924 threshold vs As-Built
    expect(simHip.distortionAndStress.surfaceResidualStressMpa).toBeLessThan(
      simAsBuilt.distortionAndStress.surfaceResidualStressMpa
    );
    expect(simHip.minLayerElongPct).toBeGreaterThan(simAsBuilt.minLayerElongPct);
    expect(simHip.astmPass).toBe(true);
    expect(simAsBuilt.astmPass).toBe(false);
    expect(simAsBuilt.distortionAndStress.plateCutOffRisk).toBe('High');
  });

  it('computes accurate build time & cost breakdown with multi-laser speedups and batch nesting economies', () => {
    const bracket = parseStlBuffer(generateDemoBracketStlBuffer());
    const geo = analyzeCadGeometry(bracket, { layerThicknessMm: 0.5 });
    const eosSingle = DEFAULT_MACHINE_PRESETS.find((m) => m.id === 'eos-m290')!;
    const slmTwin = DEFAULT_MACHINE_PRESETS.find((m) => m.id === 'slm-280')!; // 2 lasers
    const printability = evaluateCadPrintability(bracket, geo, eosSingle);

    const baseParams = { alloyId: 'ti64_gr5', P: 280, v: 960, h: 110, t: 40, T0: 200, postProcessing: 'HIP' };
    const singleRun = estimateBuildTimeAndCost(geo, printability, baseParams, eosSingle, 1);
    const batchRun = estimateBuildTimeAndCost(geo, printability, baseParams, eosSingle, 4);
    const twinLaserRun = estimateBuildTimeAndCost(geo, printability, baseParams, slmTwin, 1);

    const sumCost = Number((
      singleRun.cost.machineCostUsd +
      singleRun.cost.materialCostUsd +
      singleRun.cost.gasCostUsd +
      singleRun.cost.postProcessingCostUsd
    ).toFixed(2));
    expect(singleRun.cost.totalBatchCostUsd).toBeCloseTo(sumCost, 1);
    expect(singleRun.cost.isPlaceholderRates).toBe(true);
    expect(batchRun.cost.costPerPartUsd).toBeLessThan(singleRun.cost.costPerPartUsd);
    expect(twinLaserRun.time.scanHours).toBeLessThan(singleRun.time.scanHours);
  });
});
