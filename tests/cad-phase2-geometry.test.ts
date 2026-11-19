import { describe, it, expect } from 'vitest';
import { generateDemoBracketStlBuffer, parseStlBuffer, type ParsedCadMesh } from '../src/lib/cad/cad-parser';
import { analyzeCadGeometry } from '../src/lib/cad/geometry-analyzer';

function buildBoxMesh(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): ParsedCadMesh {
  const tris: number[] = [];
  const pushQuad = (a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]) => {
    tris.push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  pushQuad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]);
  pushQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  pushQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  pushQuad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]);
  pushQuad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]);
  pushQuad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);

  const triCount = tris.length / 9;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, triCount, true);
  for (let t = 0; t < triCount; t++) {
    const o = 84 + t * 50;
    const base = t * 9;
    for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k * 4, tris[base + k], true);
  }
  return parseStlBuffer(buf);
}

describe('CAD Phase 2: Geometry Analysis Engine', () => {
  it('computes exact volume, surface area, wall thickness, zero overhang & constant slice A(z) for a 20 mm cube', () => {
    const cube = buildBoxMesh(0, 0, 0, 20, 20, 20);
    const geo = analyzeCadGeometry(cube, { overhangThresholdDeg: 45, layerThicknessMm: 0.5 });

    expect(geo.isWatertight).toBe(true);
    expect(geo.boundaryEdgeCount).toBe(0);
    expect(geo.nonManifoldEdgeCount).toBe(0);
    expect(geo.volumeCm3).toBeCloseTo(8.0, 2);
    expect(geo.surfaceAreaCm2).toBeCloseTo(24.0, 2);
    expect(geo.overhangAreaMm2).toBe(0);
    expect(geo.overhangFractionPct).toBe(0);
    expect(geo.minWallThicknessMm).toBeCloseTo(20.0, 1);
    expect(geo.sharpConcaveCornerCount).toBe(0);
    expect(geo.layerSlices.length).toBe(40);
    expect(geo.meanSliceAreaMm2).toBeCloseTo(400, 1);
    expect(geo.abruptAreaJumpCount).toBe(0);
  });

  it('analyzes the manifold demo C-bracket: exact volume, cantilever overhang, sharp corners & abrupt slice jumps', () => {
    const bracket = parseStlBuffer(generateDemoBracketStlBuffer());
    const geo = analyzeCadGeometry(bracket, { overhangThresholdDeg: 45, layerThicknessMm: 0.5, minWallLimitMm: 10 });

    // Exact: (60*8 + 12*19 + 36*8)*40 = 39,840 mm^3 = 39.84 cm^3
    expect(geo.isWatertight).toBe(true);
    expect(geo.boundaryEdgeCount).toBe(0);
    expect(geo.volumeCm3).toBeCloseTo(39.84, 2);
    // Overhang underside of top arm: (36 - 12) * 40 = 960 mm^2
    expect(geo.overhangAreaMm2).toBeCloseTo(960, 1);
    expect(geo.minWallThicknessMm).toBeCloseTo(8.0, 1);
    expect(geo.sharpConcaveCornerCount).toBeGreaterThanOrEqual(2);
    expect(geo.abruptAreaJumpCount).toBeGreaterThanOrEqual(1);
    expect(geo.layerSlices.every((s) => Number.isFinite(s.areaMm2) && Number.isFinite(s.heatSinkRatio))).toBe(true);
  });

  it('detects thin-walled hollow section and handles open non-watertight meshes cleanly', () => {
    // 20x20x20 mm hollow outer wall with a 1.0 mm wall thickness represented by two stacked thin plates (z=0..1 and z=19..20) or thin plate 1 mm thick
    const thinPlate = buildBoxMesh(0, 0, 0, 40, 20, 1.0);
    const thinGeo = analyzeCadGeometry(thinPlate, { minWallLimitMm: 1.5 });
    expect(thinGeo.minWallThicknessMm).toBeCloseTo(1.0, 1);
    expect(thinGeo.thinWallFractionPct).toBeGreaterThan(0);

    // Open mesh (drop 1 triangle from a cube)
    const fullCube = buildBoxMesh(0, 0, 0, 10, 10, 10);
    const openMesh: ParsedCadMesh = {
      ...fullCube,
      triangleCount: fullCube.triangleCount - 1,
      positions: fullCube.positions.subarray(0, (fullCube.triangleCount - 1) * 9),
      normals: fullCube.normals.subarray(0, (fullCube.triangleCount - 1) * 9)
    };
    const openGeo = analyzeCadGeometry(openMesh);
    expect(openGeo.isWatertight).toBe(false);
    expect(openGeo.boundaryEdgeCount).toBeGreaterThan(0);
    expect(Number.isFinite(openGeo.volumeCm3)).toBe(true);
  });

  it('analyzes a high-resolution spherical-like faceted mesh quickly (< 2000 ms)', () => {
    // Build a 10,000+ triangle subdivided grid prism to benchmark BVH + slicing performance
    const nx = 50, ny = 50; // 50*50*2 top + 50*50*2 bottom + perimeter = >10,000 tris cleanly
    const tris: number[] = [];
    const pushQuad = (a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]) => {
      tris.push(...a, ...b, ...c, ...a, ...c, ...d);
    };
    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        const x0 = ix, x1 = ix + 1, y0 = iy, y1 = iy + 1;
        pushQuad([x0, y0, 0], [x0, y1, 0], [x1, y1, 0], [x1, y0, 0]);
        pushQuad([x0, y0, 5], [x1, y0, 5], [x1, y1, 5], [x0, y1, 5]);
      }
    }
    for (let ix = 0; ix < nx; ix++) {
      pushQuad([ix, 0, 0], [ix + 1, 0, 0], [ix + 1, 0, 5], [ix, 0, 5]);
      pushQuad([ix + 1, ny, 0], [ix, ny, 0], [ix, ny, 5], [ix + 1, ny, 5]);
    }
    for (let iy = 0; iy < ny; iy++) {
      pushQuad([0, iy + 1, 0], [0, iy, 0], [0, iy, 5], [0, iy + 1, 5]);
      pushQuad([nx, iy, 0], [nx, iy + 1, 0], [nx, iy + 1, 5], [nx, iy, 5]);
    }
    const count = tris.length / 9;
    expect(count).toBeGreaterThan(10000);
    const buf = new ArrayBuffer(84 + count * 50);
    const dv = new DataView(buf);
    dv.setUint32(80, count, true);
    for (let t = 0; t < count; t++) {
      const o = 84 + t * 50, base = t * 9;
      for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k * 4, tris[base + k], true);
    }
    const mesh = parseStlBuffer(buf);
    const geo = analyzeCadGeometry(mesh);
    expect(geo.volumeCm3).toBeCloseTo(12.5, 1);
    expect(geo.minWallThicknessMm).toBeCloseTo(5.0, 1);
    expect(geo.elapsedMs).toBeLessThan(2000);
  });
});
