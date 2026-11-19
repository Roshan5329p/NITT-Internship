import { describe, it, expect } from 'vitest';
import { generateDemoBracketStlBuffer, parseStlBuffer } from '../src/lib/cad/cad-parser';
import { analyzeCadGeometry } from '../src/lib/cad/geometry-analyzer';
import { DEFAULT_MACHINE_PRESETS } from '../src/lib/cad/machine-presets';
import { evaluateCadPrintability } from '../src/lib/cad/printability-rules';
import { optimizeBuildOrientations } from '../src/lib/cad/orientation-optimizer';
import { simulatePartBuild } from '../src/lib/cad/part-build-simulator';
import { estimateBuildTimeAndCost } from '../src/lib/cad/build-cost-estimator';
import { buildCadPartReportJson } from '../src/lib/cad/part-report-exporter';

describe('CAD Phase 5: End-to-End Compact Part Report Export & Performance Benchmark', () => {
  it('builds a compact finite JSON report excluding raw Float32Arrays across all 5 phases', () => {
    const startMs = Date.now();
    const mesh = parseStlBuffer(generateDemoBracketStlBuffer());
    const machine = DEFAULT_MACHINE_PRESETS.find((m) => m.id === 'eos-m290')!;
    const params = { alloyId: 'ti64_gr5', P: 280, v: 960, h: 110, t: 40, T0: 200, postProcessing: 'HIP', oxygenWtPct: 0.16 };

    const geometry = analyzeCadGeometry(mesh, { layerThicknessMm: 0.5 });
    const printability = evaluateCadPrintability(mesh, geometry, machine);
    const orientation = optimizeBuildOrientations(mesh, machine, 45);
    const simulation = simulatePartBuild(mesh, geometry, printability, params, machine);
    const economics = estimateBuildTimeAndCost(geometry, printability, params, machine, 2);

    const report = buildCadPartReportJson({
      fileName: 'demo_ti64_aerospace_bracket.stl',
      mesh,
      geometry,
      printability,
      orientation,
      simulation,
      economics,
      machine,
      processParameters: params
    });

    const jsonStr = JSON.stringify(report);
    expect(Date.now() - startMs).toBeLessThan(1500);
    expect(jsonStr.length).toBeLessThan(80_000);
    expect(jsonStr).not.toContain('NaN');
    expect(report.part.volumeCm3).toBeCloseTo(39.84, 2);
    expect(report.printability.supportVolumeCm3).toBeGreaterThan(2.0);
    expect(report.orientationTop3).toHaveLength(3);
    expect(report.simulationSummary.astmPass).toBe(true);
    expect(report.economics.cost.isPlaceholderRates).toBe(true);
    expect(report.economics.cost.batchSize).toBe(2);
  });
});
