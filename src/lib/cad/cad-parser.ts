/**
 * NIT Trichy Titanium AM Platform — Client-Side CAD Mesh Parser & Simplifier
 * Parses binary and ASCII STL meshes directly into typed Float32Arrays in browser/Worker RAM
 * with zero NaN tolerance, unit scaling, and uniform simplification for >2M-triangle parts.
 */

import type { BoundingBox3D, SuggestedSourceUnit } from './cad-guardrails';

export interface ParsedCadMesh {
  format: 'stl-binary' | 'stl-ascii' | 'step-brep' | 'iges-brep';
  headerText: string;
  triangleCount: number;
  positions: Float32Array;     // length = triangleCount * 9
  normals: Float32Array;       // length = triangleCount * 9 (per-vertex face normal)
  boundingBox: BoundingBox3D;
  degenerateTrianglesSkipped: number;
  wasDecimated: boolean;
  originalTriangleCount: number;
}

function computeBoundingBox(positions: Float32Array): BoundingBox3D {
  if (positions.length < 3) {
    return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
  }
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    size: [maxX - minX, maxY - minY, maxZ - minZ]
  };
}

function computeSafeFaceNormal(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number
): [number, number, number] | null {
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (!Number.isFinite(len) || len <= 1e-12) return null;
  return [nx / len, ny / len, nz / len];
}

function isBinaryStl(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;
  const dv = new DataView(buffer);
  const triCount = dv.getUint32(80, true);
  // Exact byte length match proves binary STL even if the 80-byte header happens to begin with "solid"
  const expectedBytes = 84 + triCount * 50;
  if (expectedBytes === buffer.byteLength) return true;

  // Fallback check: inspect first 256 bytes for ASCII "solid" + "facet normal"
  const probeLen = Math.min(512, buffer.byteLength);
  let sample = '';
  const bytes = new Uint8Array(buffer, 0, probeLen);
  for (let i = 0; i < probeLen; i++) sample += String.fromCharCode(bytes[i]);
  return !(/^\s*solid\b/i.test(sample) && /\bfacet\s+normal\b/i.test(sample));
}

/**
 * Parses a binary or ASCII STL ArrayBuffer into packed Float32Arrays.
 * Throws a clean descriptive Error if empty or corrupted.
 */
export function parseStlBuffer(buffer: ArrayBuffer): ParsedCadMesh {
  if (!buffer || buffer.byteLength < 15) {
    throw new Error('Invalid STL file: file is too small to contain geometry.');
  }

  if (isBinaryStl(buffer)) {
    const dv = new DataView(buffer);
    const headerBytes = new Uint8Array(buffer, 0, 80);
    let headerText = '';
    for (let i = 0; i < 80; i++) {
      const c = headerBytes[i];
      if (c >= 32 && c <= 126) headerText += String.fromCharCode(c);
    }
    headerText = headerText.trim();

    const rawCount = dv.getUint32(80, true);
    const maxReadable = Math.floor((buffer.byteLength - 84) / 50);
    const count = Math.min(rawCount, maxReadable);
    if (count <= 0) {
      throw new Error('Binary STL contains 0 triangles.');
    }

    const posTemp = new Float32Array(count * 9);
    const normTemp = new Float32Array(count * 9);
    let valid = 0;
    let skipped = 0;

    for (let t = 0; t < count; t++) {
      const off = 84 + t * 50;
      const ax = dv.getFloat32(off + 12, true);
      const ay = dv.getFloat32(off + 16, true);
      const az = dv.getFloat32(off + 20, true);
      const bx = dv.getFloat32(off + 24, true);
      const by = dv.getFloat32(off + 28, true);
      const bz = dv.getFloat32(off + 32, true);
      const cx = dv.getFloat32(off + 36, true);
      const cy = dv.getFloat32(off + 40, true);
      const cz = dv.getFloat32(off + 44, true);

      if (
        !Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(az) ||
        !Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bz) ||
        !Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(cz)
      ) {
        skipped++;
        continue;
      }

      const fn = computeSafeFaceNormal(ax, ay, az, bx, by, bz, cx, cy, cz);
      if (!fn) {
        skipped++;
        continue;
      }

      const base = valid * 9;
      posTemp[base] = ax; posTemp[base + 1] = ay; posTemp[base + 2] = az;
      posTemp[base + 3] = bx; posTemp[base + 4] = by; posTemp[base + 5] = bz;
      posTemp[base + 6] = cx; posTemp[base + 7] = cy; posTemp[base + 8] = cz;

      normTemp[base] = fn[0]; normTemp[base + 1] = fn[1]; normTemp[base + 2] = fn[2];
      normTemp[base + 3] = fn[0]; normTemp[base + 4] = fn[1]; normTemp[base + 5] = fn[2];
      normTemp[base + 6] = fn[0]; normTemp[base + 7] = fn[1]; normTemp[base + 8] = fn[2];
      valid++;
    }

    if (valid === 0) {
      throw new Error('STL file contains no valid non-degenerate triangles.');
    }

    const positions = valid === count ? posTemp : posTemp.subarray(0, valid * 9);
    const normals = valid === count ? normTemp : normTemp.subarray(0, valid * 9);

    return {
      format: 'stl-binary',
      headerText,
      triangleCount: valid,
      positions,
      normals,
      boundingBox: computeBoundingBox(positions),
      degenerateTrianglesSkipped: skipped,
      wasDecimated: false,
      originalTriangleCount: valid
    };
  }

  // ASCII STL parsing
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const vertexRegex = /vertex\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;

  const coords: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = vertexRegex.exec(text)) !== null) {
    coords.push(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  const triTotal = Math.floor(coords.length / 9);
  if (triTotal <= 0) {
    throw new Error('ASCII STL file contains 0 valid facet vertices.');
  }

  const posTemp = new Float32Array(triTotal * 9);
  const normTemp = new Float32Array(triTotal * 9);
  let valid = 0;
  let skipped = 0;

  for (let t = 0; t < triTotal; t++) {
    const i = t * 9;
    const ax = coords[i], ay = coords[i + 1], az = coords[i + 2];
    const bx = coords[i + 3], by = coords[i + 4], bz = coords[i + 5];
    const cx = coords[i + 6], cy = coords[i + 7], cz = coords[i + 8];
    const fn = computeSafeFaceNormal(ax, ay, az, bx, by, bz, cx, cy, cz);
    if (!fn) {
      skipped++;
      continue;
    }
    const base = valid * 9;
    posTemp[base] = ax; posTemp[base + 1] = ay; posTemp[base + 2] = az;
    posTemp[base + 3] = bx; posTemp[base + 4] = by; posTemp[base + 5] = bz;
    posTemp[base + 6] = cx; posTemp[base + 7] = cy; posTemp[base + 8] = cz;
    normTemp[base] = fn[0]; normTemp[base + 1] = fn[1]; normTemp[base + 2] = fn[2];
    normTemp[base + 3] = fn[0]; normTemp[base + 4] = fn[1]; normTemp[base + 5] = fn[2];
    normTemp[base + 6] = fn[0]; normTemp[base + 7] = fn[1]; normTemp[base + 8] = fn[2];
    valid++;
  }

  if (valid === 0) {
    throw new Error('ASCII STL contains no valid non-degenerate triangles.');
  }

  const firstLine = text.split(/\r?\n/, 1)[0]?.replace(/^solid\s*/i, '').trim() || '';
  const positions = valid === triTotal ? posTemp : posTemp.subarray(0, valid * 9);
  const normals = valid === triTotal ? normTemp : normTemp.subarray(0, valid * 9);

  return {
    format: 'stl-ascii',
    headerText: firstLine,
    triangleCount: valid,
    positions,
    normals,
    boundingBox: computeBoundingBox(positions),
    degenerateTrianglesSkipped: skipped,
    wasDecimated: false,
    originalTriangleCount: valid
  };
}

/**
 * Uniformly simplifies huge meshes above maxTriangles while preserving bounding-box proportions.
 */
export function decimateMeshUniform(mesh: ParsedCadMesh, maxTriangles: number = 1_200_000): ParsedCadMesh {
  if (mesh.triangleCount <= maxTriangles || maxTriangles <= 0) {
    return mesh;
  }
  const stride = mesh.triangleCount / maxTriangles;
  const outCount = maxTriangles;
  const positions = new Float32Array(outCount * 9);
  const normals = new Float32Array(outCount * 9);

  for (let i = 0; i < outCount; i++) {
    const srcIdx = Math.min(mesh.triangleCount - 1, Math.floor(i * stride));
    const s = srcIdx * 9;
    const d = i * 9;
    for (let k = 0; k < 9; k++) {
      positions[d + k] = mesh.positions[s + k];
      normals[d + k] = mesh.normals[s + k];
    }
  }

  return {
    ...mesh,
    triangleCount: outCount,
    positions,
    normals,
    boundingBox: computeBoundingBox(positions),
    wasDecimated: true,
    originalTriangleCount: mesh.originalTriangleCount
  };
}

/**
 * Returns a unit-converted copy of a parsed CAD mesh (normalized into millimeters).
 */
export function scaleMeshToMillimeters(
  mesh: ParsedCadMesh,
  sourceUnit: SuggestedSourceUnit
): ParsedCadMesh {
  const factor = sourceUnit === 'inch' ? 25.4 : (sourceUnit === 'm' ? 1000.0 : 1.0);
  if (factor === 1.0) return mesh;
  const scaledPos = new Float32Array(mesh.positions.length);
  for (let i = 0; i < mesh.positions.length; i++) {
    scaledPos[i] = mesh.positions[i] * factor;
  }
  return {
    ...mesh,
    positions: scaledPos,
    boundingBox: computeBoundingBox(scaledPos)
  };
}

/**
 * Generates an airtight, 100% manifold Ti-6Al-4V aerospace C-bracket binary STL (mm units) for demo & test checks.
 * Geometry: 60 x 40 x 35 mm extruded C-bracket (bottom flange 60x8, vertical spine 12x19, overhanging top arm 36x8)
 * Exact volume: (60*8 + 12*19 + 36*8) * 40 = 39,840 mm³ (39.84 cm³), overhang area = 24*40 = 960 mm².
 */
export function generateDemoBracketStlBuffer(): ArrayBuffer {
  const tris: number[] = [];
  const pushTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    tris.push(...a, ...b, ...c);
  };
  const pushQuad = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number]
  ) => {
    pushTri(p0, p1, p2);
    pushTri(p0, p2, p3);
  };

  // Conforming 5-quad XZ decomposition (zero T-junctions) extruded along Y = [0, 40]:
  const rects: Array<[number, number, number, number]> = [
    [0, 0, 12, 8],
    [12, 0, 60, 8],
    [0, 8, 12, 27],
    [0, 27, 12, 35],
    [12, 27, 36, 35]
  ];
  for (const [x0, z0, x1, z1] of rects) {
    pushQuad([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]);
    pushQuad([x1, 40, z0], [x0, 40, z0], [x0, 40, z1], [x1, 40, z1]);
  }
  // Conforming 12-edge closed outer XZ perimeter loop extruded along Y=[0..40] (44 triangles total, 0 boundary edges)
  const loop: Array<[number, number]> = [
    [0, 0], [12, 0], [60, 0], [60, 8], [12, 8], [12, 27],
    [36, 27], [36, 35], [12, 35], [0, 35], [0, 27], [0, 8]
  ];
  for (let i = 0; i < loop.length; i++) {
    const [ax, az] = loop[i];
    const [bx, bz] = loop[(i + 1) % loop.length];
    pushQuad([ax, 0, az], [ax, 40, az], [bx, 40, bz], [bx, 0, bz]);
  }

  const triCount = tris.length / 9;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  const hdr = 'NIT Trichy Demo Ti-6Al-4V Manifold C-Bracket (mm)';
  for (let i = 0; i < hdr.length && i < 80; i++) dv.setUint8(i, hdr.charCodeAt(i));
  dv.setUint32(80, triCount, true);

  for (let t = 0; t < triCount; t++) {
    const off = 84 + t * 50;
    const base = t * 9;
    const n = computeSafeFaceNormal(
      tris[base], tris[base + 1], tris[base + 2],
      tris[base + 3], tris[base + 4], tris[base + 5],
      tris[base + 6], tris[base + 7], tris[base + 8]
    ) || [0, 0, 1];
    dv.setFloat32(off, n[0], true);
    dv.setFloat32(off + 4, n[1], true);
    dv.setFloat32(off + 8, n[2], true);
    for (let k = 0; k < 9; k++) {
      dv.setFloat32(off + 12 + k * 4, tris[base + k], true);
    }
    dv.setUint16(off + 48, 0, true);
  }
  return buf;
}
