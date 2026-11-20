import { describe, it, expect } from 'vitest';
import {
  evaluateFileGuardrails,
  evaluateMeshGuardrails,
  CAD_STL_CAP_MB,
  CAD_BREP_CAP_MB
} from '../src/lib/cad/cad-guardrails';
import { buildNativeCadGuide } from '../src/lib/cad/native-format-guide';
import {
  parseStlBuffer,
  decimateMeshUniform,
  scaleMeshToMillimeters,
  generateDemoBracketStlBuffer
} from '../src/lib/cad/cad-parser';
import {
  DEFAULT_MACHINE_PRESETS,
  loadMachinePresets,
  saveCustomMachinePreset
} from '../src/lib/cad/machine-presets';

describe('CAD Phase 1: Guardrails, Parsers, Native Format Guide & Machine Presets', () => {
  it('enforces 150 MB STL and 60 MB STEP/IGES caps with soft warnings and High-RAM override', () => {
    const mb = 1024 * 1024;

    const okStl = evaluateFileGuardrails('impeller.stl', 40 * mb, false);
    expect(okStl.allowed).toBe(true);
    expect(okStl.warnings).toHaveLength(0);

    const softStl = evaluateFileGuardrails('dense_lattice.stl', 75 * mb, false);
    expect(softStl.allowed).toBe(true);
    expect(softStl.warnings.length).toBeGreaterThan(0);

    const blockedStl = evaluateFileGuardrails('giant.stl', (CAD_STL_CAP_MB + 10) * mb, false);
    expect(blockedStl.allowed).toBe(false);
    expect(blockedStl.blockingReason).toContain('150 MB');

    const overrideStl = evaluateFileGuardrails('giant.stl', (CAD_STL_CAP_MB + 10) * mb, true);
    expect(overrideStl.allowed).toBe(true);
    expect(overrideStl.overriddenByForceLoad).toBe(true);

    const blockedStep = evaluateFileGuardrails('housing.step', (CAD_BREP_CAP_MB + 5) * mb, false);
    expect(blockedStep.allowed).toBe(false);
    expect(blockedStep.blockingReason).toContain('60 MB');

    const unlimitedIpt = evaluateFileGuardrails('huge_assembly_part.ipt', 300 * mb, false);
    expect(unlimitedIpt.allowed).toBe(true);
    expect(unlimitedIpt.requiresNativeGuide).toBe(true);

    const meshReport = evaluateMeshGuardrails(2_500_000, { min: [0, 0, 0], max: [4, 2, 1.5], size: [4, 2, 1.5] });
    expect(meshReport.isComplexWarning).toBe(true);
    expect(meshReport.requiresAutoDecimation).toBe(true);
    expect(meshReport.suggestedUnit).toBe('inch');
  });

  it('detects Inventor .ipt and disambiguates Siemens NX vs PTC Creo .prt headers', () => {
    const enc = new TextEncoder();
    const inv = buildNativeCadGuide('bracket.ipt', enc.encode('Autodesk Inventor Part'));
    expect(inv.detectedApp).toBe('inventor');
    expect(inv.instructions[0].menuPath).toContain('STEP');

    const nx = buildNativeCadGuide('blade.prt', enc.encode('UGII V18.0 SIEMENS NX PARASOLID'));
    expect(nx.detectedApp).toBe('nx');
    expect(nx.detectionConfidence).toBe('header-signature');

    const creo = buildNativeCadGuide('flange.prt', enc.encode('#UGC:2 PTC CREO PARAMETRIC'));
    expect(creo.detectedApp).toBe('creo');
    expect(creo.detectionConfidence).toBe('header-signature');

    const ambig = buildNativeCadGuide('unknown.prt', new Uint8Array([0x01, 0x02, 0x03]));
    expect(ambig.detectedApp).toBe('nx_or_creo');
    expect(ambig.instructions).toHaveLength(2);
  });

  it('parses binary and ASCII STL cleanly, skips degenerate triangles, decimates & scales units', () => {
    const demoBuf = generateDemoBracketStlBuffer();
    const parsedBin = parseStlBuffer(demoBuf);
    expect(parsedBin.format).toBe('stl-binary');
    expect(parsedBin.triangleCount).toBe(44);
    expect(parsedBin.boundingBox.size[0]).toBeCloseTo(60, 3);
    expect(parsedBin.boundingBox.size[1]).toBeCloseTo(40, 3);
    expect(parsedBin.boundingBox.size[2]).toBeCloseTo(35, 3);
    expect(Array.from(parsedBin.normals).every(Number.isFinite)).toBe(true);

    const decimated = decimateMeshUniform(parsedBin, 18);
    expect(decimated.triangleCount).toBe(18);
    expect(decimated.wasDecimated).toBe(true);

    const inchScaled = scaleMeshToMillimeters(parsedBin, 'inch');
    expect(inchScaled.boundingBox.size[0]).toBeCloseTo(60 * 25.4, 2);

    const asciiStl = `solid test_tri
      facet normal 0 0 1
        outer loop
          vertex 0 0 0
          vertex 10 0 0
          vertex 0 10 0
        endloop
      endfacet
      facet normal 0 0 1
        outer loop
          vertex 1 1 1
          vertex 1 1 1
          vertex 1 1 1
        endloop
      endfacet
    endsolid test_tri`;
    const asciiBuf = new TextEncoder().encode(asciiStl).buffer;
    const parsedAscii = parseStlBuffer(asciiBuf);
    expect(parsedAscii.format).toBe('stl-ascii');
    expect(parsedAscii.triangleCount).toBe(1);
    expect(parsedAscii.degenerateTrianglesSkipped).toBe(1);
  });

  it('manages editable placeholder machine presets and persists custom edits', () => {
    expect(DEFAULT_MACHINE_PRESETS.length).toBe(8);
    expect(DEFAULT_MACHINE_PRESETS.some((m) => m.id === 'nit-trichy-custom')).toBe(false);
    const storeMap = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => storeMap.get(k) ?? null,
      setItem: (k: string, v: string) => { storeMap.set(k, v); }
    };

    const custom = {
      ...DEFAULT_MACHINE_PRESETS.find((m) => m.id === 'eos-m290')!,
      envelopeMm: [300, 300, 350] as [number, number, number],
      hourlyRateUsd: 55
    };
    saveCustomMachinePreset(custom, mockStorage);
    const reloaded = loadMachinePresets(mockStorage);
    const hit = reloaded.find((m) => m.id === 'eos-m290');
    expect(hit?.envelopeMm).toEqual([300, 300, 350]);
    expect(hit?.hourlyRateUsd).toBe(55);
  });
});
