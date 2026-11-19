import { describe, it, expect } from 'vitest';
import { generateDemoBracketStlBuffer, parseStlBuffer } from '../src/lib/cad/cad-parser';
import { analyzeCadGeometry } from '../src/lib/cad/geometry-analyzer';
import { DEFAULT_MACHINE_PRESETS } from '../src/lib/cad/machine-presets';
import { evaluateCadPrintability } from '../src/lib/cad/printability-rules';
import { optimizeBuildOrientations, rotateCadMeshToBuildPlate } from '../src/lib/cad/orientation-optimizer';
import { computeCadPredictionModifiers } from '../src/lib/cad/part-prediction-coupling';

describe('CAD Phase 3: Printability, Support Volume, 26-Orientation Optimizer & Part Prediction Coupling', () => {
  it('computes support volume, removal difficulty, and ranks LPBF > WAAM for precision Ti-6Al-4V C-bracket', () => {
    const bracket = parseStlBuffer(generateDemoBracketStlBuffer());
    const geo = analyzeCadGeometry(bracket);
    const eosM290 = DEFAULT_MACHINE_PRESETS.find((m) => m.id === 'eos-m290')!;
    const waam = DEFAULT_MACHINE_PRESETS.find((m) => m.id === 'generic-robotic-waam')!;

    const repLpbf = evaluateCadPrintability(bracket, geo, eosM290);
    expect(repLpbf.fitsSelectedMachine).toBe(true);
    expect(repLpbf.supportEstimate.supportContactAreaCm2).toBeCloseTo(9.6, 1);
    expect(repLpbf.supportEstimate.supportVolumeCm3).toBeGreaterThan(2.0);
    expect(repLpbf.processRanking[0].processId).toBe('lpbf');
    expect(repLpbf.overallVerdict).toBe('Printable with Supports / Adjustments');

    const repWaam = evaluateCadPrintability(bracket, geo, waam);
    expect(repWaam.wallCheckStatus).toBe('Pass'); // 8 mm walls pass 3.5 mm WAAM threshold
  });

  it('evaluates 26 orientations and finds a zero-overhang self-supporting orientation outscoring the current cantilever', () => {
    const bracket = parseStlBuffer(generateDemoBracketStlBuffer());
    const eosM290 = DEFAULT_MACHINE_PRESETS.find((m) => m.id === 'eos-m290')!;

    const opt = optimizeBuildOrientations(bracket, eosM290, 45);
    expect(opt.evaluatedCount).toBe(26);
    expect(opt.topCandidates).toHaveLength(3);
    expect(opt.topCandidates[0].compositeScore).toBeGreaterThanOrEqual(opt.currentOrientationScore.compositeScore);
    expect(opt.topCandidates[0].overhangAreaCm2).toBeLessThan(opt.currentOrientationScore.overhangAreaCm2);

    const rotated = rotateCadMeshToBuildPlate(bracket, opt.topCandidates[0].rotationMatrix);
    expect(rotated.boundingBox.min[2]).toBeCloseTo(0, 3);
    const rotatedGeo = analyzeCadGeometry(rotated);
    expect(rotatedGeo.volumeCm3).toBeCloseTo(39.84, 1);
    expect(rotatedGeo.overhangAreaMm2).toBeLessThan(20);
  });

  it('produces physically consistent part-driven prediction modifiers coupling CAD geometry to Ti-6Al-4V properties', () => {
    const bracket = parseStlBuffer(generateDemoBracketStlBuffer());
    const geo = analyzeCadGeometry(bracket, { layerThicknessMm: 0.5 });
    const mods = computeCadPredictionModifiers(geo, 'demo_bracket.stl', 'lpbf');

    expect(mods.interlayerPreheatShiftC).toBeGreaterThan(5);
    expect(mods.stressConcentrationFactor).toBeGreaterThan(1.0);
    expect(mods.elongationMultiplier).toBeLessThan(1.0);
    expect(mods.partSpecificRisks.length).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(mods.coolingRateMultiplier)).toBe(true);
  });
});
