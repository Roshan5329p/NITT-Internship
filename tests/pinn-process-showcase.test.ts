import { describe, it, expect } from 'vitest';
// @ts-expect-error Untyped UMD browser bundle loaded for TS/JS runtime parity test
import browserShowcase from '../js/pinn-cad-showcase.js';
import { generateDemoBracketStlBuffer, parseStlBuffer } from '../src/lib/cad/cad-parser';
import { analyzeCadGeometry } from '../src/lib/cad/geometry-analyzer';
import { DEFAULT_MACHINE_PRESETS } from '../src/lib/cad/machine-presets';
import { evaluateCadPrintability } from '../src/lib/cad/printability-rules';
import { simulatePartBuild } from '../src/lib/cad/part-build-simulator';
import {
  SHOWCASE_STAGES,
  computeSlicePlaneSegments,
  computeClippedHatchChords,
  buildStageNarration,
  type ShowcaseNarrationInput
} from '../src/lib/cad/pinn-process-showcase';

function buildFixture() {
  const bracket = parseStlBuffer(generateDemoBracketStlBuffer());
  const geo = analyzeCadGeometry(bracket, { layerThicknessMm: 0.5 });
  const lpbfMac = DEFAULT_MACHINE_PRESETS.find((m) => m.id === 'eos-m290')!;
  const ldedMac = DEFAULT_MACHINE_PRESETS.find((m) => m.id === 'generic-powder-lded')!;

  const lpbfPrint = evaluateCadPrintability(bracket, geo, lpbfMac);
  const ldedPrint = evaluateCadPrintability(bracket, geo, ldedMac);

  const lpbfParams = {
    alloyId: 'ti64_gr5',
    P: 280,
    v: 960,
    h: 110,
    t: 40,
    db: 80,
    T0: 200,
    postProcessing: 'None',
    oxygenWtPct: 0.16,
    scanRotationDeg: 67
  };
  const ldedParams = {
    alloyId: 'ti64_gr5',
    P: 1500,
    v: 15,
    h: 1100,
    t: 450,
    db: 1500,
    T0: 120,
    postProcessing: 'None',
    oxygenWtPct: 0.16,
    scanRotationDeg: 67
  };

  const lpbfSim = simulatePartBuild(bracket, geo, lpbfPrint, lpbfParams, lpbfMac);
  const ldedSim = simulatePartBuild(bracket, geo, ldedPrint, ldedParams, ldedMac);

  return { bracket, geo, lpbfMac, ldedMac, lpbfPrint, ldedPrint, lpbfParams, ldedParams, lpbfSim, ldedSim };
}

describe('PINN LPBF & L-DED CAD Build Showcase', () => {
  it('separates LPBF and L-DED melt pool width, cooling rate, and as-built alpha lath thickness on the Demo Bracket', () => {
    const { lpbfSim, ldedSim } = buildFixture();
    const midIdx = Math.floor(lpbfSim.layers.length / 2);
    const lpbfMid = lpbfSim.layers[midIdx];
    const ldedMid = ldedSim.layers[midIdx];

    expect(ldedMid.meltPoolWidthUm).toBeGreaterThan(lpbfMid.meltPoolWidthUm * 5);
    expect(lpbfMid.coolingRateKs).toBeGreaterThan(ldedMid.coolingRateKs * 5);
    expect(lpbfMid.asBuiltAlphaLathUm).toBeLessThan(ldedMid.asBuiltAlphaLathUm);
    expect(lpbfSim.perTriangleCoolingRate.length).toBeGreaterThan(0);
    expect(lpbfSim.perTriangleAlphaLath.length).toBe(lpbfSim.perTriangleCoolingRate.length);
  });

  it('narrates Stage 4 L-DED with the 410 K/s martensite threshold, initial alpha-prime, and intrinsic cyclic reheating', () => {
    const { geo, ldedSim, lpbfSim, ldedParams, lpbfParams } = buildFixture();
    const out = buildStageNarration({
      stageIdx: 3,
      sliceIdx: Math.floor(ldedSim.layers.length / 2),
      activeProcess: 'ded-laser',
      mode: 'compare',
      fileName: 'demo_bracket.stl',
      geo,
      activeSim: ldedSim,
      compareSim: lpbfSim,
      activeParams: ldedParams,
      compareParams: lpbfParams
    });

    const joined = `${out.headline} ${out.subheadline} ${out.bullets.join(' ')}`;
    expect(joined).toContain('410 K/s');
    expect(joined).toMatch(/reheating/i);
    expect(joined).toContain("α'");
  });

  it('supports high-preheat LPBF (T0 >= 320 C) in Stages 1 & 4 with in-situ tempering and zero hardcoded ~7% string', () => {
    const { bracket, geo, lpbfMac, lpbfPrint, ldedSim, ldedParams } = buildFixture();
    const highPreheatParams = {
      alloyId: 'ti64_gr5',
      P: 280,
      v: 960,
      h: 110,
      t: 40,
      db: 80,
      T0: 350,
      postProcessing: 'None',
      oxygenWtPct: 0.16
    };
    const highSim = simulatePartBuild(bracket, geo, lpbfPrint, highPreheatParams, lpbfMac);

    const st1 = buildStageNarration({
      stageIdx: 0,
      sliceIdx: 0,
      activeProcess: 'lpbf',
      mode: 'lpbf',
      fileName: 'demo_bracket.stl',
      geo,
      activeSim: highSim,
      activeParams: highPreheatParams
    });
    const st4 = buildStageNarration({
      stageIdx: 3,
      sliceIdx: Math.floor(highSim.layers.length / 2),
      activeProcess: 'lpbf',
      mode: 'lpbf',
      fileName: 'demo_bracket.stl',
      geo,
      activeSim: highSim,
      compareSim: ldedSim,
      activeParams: highPreheatParams,
      compareParams: ldedParams
    });

    expect(st1.bullets.join(' ')).toMatch(/in-situ α' tempering/i);
    expect(st4.bullets.join(' ')).toMatch(/in-situ α' tempering/i);
    expect(st4.bullets.join(' ')).not.toContain('~7%');
  });

  it('shows As-Built ASTM verdict plus Simulated HIP Recovery Preview at Stage 6 when postProcessing is None', () => {
    const { geo, lpbfSim, ldedSim, lpbfParams, ldedParams } = buildFixture();
    const st6 = buildStageNarration({
      stageIdx: 5,
      sliceIdx: lpbfSim.layers.length - 1,
      activeProcess: 'lpbf',
      mode: 'compare',
      fileName: 'demo_bracket.stl',
      geo,
      activeSim: lpbfSim,
      compareSim: ldedSim,
      activeParams: lpbfParams,
      compareParams: ldedParams
    });

    expect(st6.hipPreview).not.toBeNull();
    expect(st6.hipPreview!.label).toBe('Simulated HIP Recovery Preview (920 °C / 100 MPa)');
    expect(st6.hipPreview!.astmAsBuiltPass).toBe(false);
    expect(st6.hipPreview!.astmHipPass).toBe(true);
    const slice = lpbfSim.layers[lpbfSim.layers.length - 1];
    expect(slice.hipPreviewElongPct).toBeGreaterThan(slice.asBuiltElongPct);
    expect(slice.hipPreviewAlphaLathUm).toBeGreaterThan(slice.asBuiltAlphaLathUm);
  });

  it('surfaces explicit OOD warning banner text with exact Mahalanobis distance under extreme LPBF power', () => {
    const { bracket, geo, lpbfMac, lpbfPrint } = buildFixture();
    const extremeParams = {
      alloyId: 'ti64_gr5',
      P: 950,
      v: 960,
      h: 110,
      t: 40,
      db: 80,
      T0: 200,
      postProcessing: 'HIP',
      oxygenWtPct: 0.16
    };
    const extremeSim = simulatePartBuild(bracket, geo, lpbfPrint, extremeParams, lpbfMac);
    const out = buildStageNarration({
      stageIdx: 2,
      sliceIdx: 2,
      activeProcess: 'lpbf',
      mode: 'lpbf',
      fileName: 'demo_bracket.stl',
      geo,
      activeSim: extremeSim,
      activeParams: extremeParams
    });

    expect(out.oodWarning).not.toBeNull();
    expect(out.oodWarning!).toContain('Mahalanobis d_M');
    expect(out.oodWarning!).toContain(extremeSim.maxOodDistance.toFixed(2));
  });

  it('clips slice-plane contour segments and hatch chords to solid bracket regions', () => {
    const { bracket } = buildFixture();
    const zMid = bracket.boundingBox.min[2] + bracket.boundingBox.size[2] * 0.5;
    const midSegs = computeSlicePlaneSegments(bracket.positions, bracket.triangleCount, zMid);
    expect(midSegs.length).toBeGreaterThan(0);

    const chords = computeClippedHatchChords(midSegs, 67, 2.0, 40);
    expect(chords.length).toBeGreaterThan(0);

    // Demo bracket Z in [0, 35]: outside Z must yield 0 intersection segments
    const outSegs = computeSlicePlaneSegments(
      bracket.positions,
      bracket.triangleCount,
      bracket.boundingBox.max[2] + 5.0
    );
    expect(outSegs.length).toBe(0);
  });

  it('maintains exact TS <-> deferred JS (js/pinn-cad-showcase.js) parity across stages, clipping, and narration', () => {
    const { bracket, geo, lpbfSim, ldedSim, lpbfParams, ldedParams } = buildFixture();

    expect(browserShowcase.SHOWCASE_STAGES).toHaveLength(SHOWCASE_STAGES.length);
    for (let i = 0; i < SHOWCASE_STAGES.length; i++) {
      expect(browserShowcase.SHOWCASE_STAGES[i].title).toBe(SHOWCASE_STAGES[i].title);
    }

    const zMid = bracket.boundingBox.min[2] + bracket.boundingBox.size[2] * 0.5;
    const tsSegs = computeSlicePlaneSegments(bracket.positions, bracket.triangleCount, zMid);
    const jsSegs = browserShowcase.computeSlicePlaneSegments(bracket.positions, bracket.triangleCount, zMid);
    expect(jsSegs.length).toBe(tsSegs.length);

    const tsChords = computeClippedHatchChords(tsSegs, 67, 2.0, 40);
    const jsChords = browserShowcase.computeClippedHatchChords(jsSegs, 67, 2.0, 40);
    expect(jsChords.length).toBe(tsChords.length);

    for (let stageIdx = 0; stageIdx < SHOWCASE_STAGES.length; stageIdx++) {
      const payload: ShowcaseNarrationInput = {
        stageIdx,
        sliceIdx: Math.min(lpbfSim.layers.length - 1, stageIdx * 2),
        activeProcess: stageIdx % 2 === 0 ? 'lpbf' : 'ded-laser',
        mode: 'compare',
        fileName: 'parity_bracket.stl',
        geo,
        activeSim: stageIdx % 2 === 0 ? lpbfSim : ldedSim,
        compareSim: stageIdx % 2 === 0 ? ldedSim : lpbfSim,
        activeParams: stageIdx % 2 === 0 ? lpbfParams : ldedParams,
        compareParams: stageIdx % 2 === 0 ? ldedParams : lpbfParams
      };
      const tsNarr = buildStageNarration(payload);
      const jsNarr = browserShowcase.buildStageNarration(payload);
      expect(jsNarr).toEqual(tsNarr);
    }
  });
});
