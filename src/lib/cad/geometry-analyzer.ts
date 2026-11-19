/**
 * NIT Trichy Titanium AM Platform — Client-Side 3D CAD Geometry Analyzer
 * Computes precision geometry features from parsed triangle meshes (mm units):
 *   - Signed-tetrahedron volume (cm³), surface area (cm²), watertight & manifold edge health
 *   - Configurable overhang area (>45° from build vector, excluding baseplate contact)
 *   - Spatial-BVH accelerated Möller–Trumbore ray-cast wall thickness distribution
 *   - Layer cross-section slicing A(z), contour perimeter L(z), and heat-sink area ratios
 *   - Sharp concave corner count & internal enclosed-cavity detection
 */

import type { ParsedCadMesh } from './cad-parser';
import type { BoundingBox3D } from './cad-guardrails';

export interface GeometryAnalysisOptions {
  overhangThresholdDeg?: number;  // Default 45°
  layerThicknessMm?: number;      // Default 0.04 mm (40 um) for LPBF
  minWallLimitMm?: number;        // Threshold below which walls are flagged thin
  maxSlices?: number;             // Adaptive cap for fast Web Worker slicing (default 140)
  maxThicknessRays?: number;      // Adaptive ray sample cap for dense meshes (default 1600)
}

export interface LayerSliceSummary {
  zMm: number;
  areaMm2: number;
  perimeterMm: number;
  heatSinkRatio: number; // area_below / area_current (high => slow cooling / overhang bulge; low => overheating neck)
}

export interface CadGeometryReport {
  volumeMm3: number;
  volumeCm3: number;
  massTi64Grams: number;
  surfaceAreaMm2: number;
  surfaceAreaCm2: number;
  boundingBox: BoundingBox3D;
  isWatertight: boolean;
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
  overhangThresholdDeg: number;
  overhangAreaMm2: number;
  overhangFractionPct: number;
  downFacingBaseAreaMm2: number;
  minWallThicknessMm: number;
  p10WallThicknessMm: number;
  medianWallThicknessMm: number;
  thinWallFractionPct: number;
  enclosedCavityCount: number;
  sharpConcaveCornerCount: number;
  layerSlices: LayerSliceSummary[];
  maxSliceAreaMm2: number;
  meanSliceAreaMm2: number;
  abruptAreaJumpCount: number;
  elapsedMs: number;
  perTriangleOverhang: Uint8Array;
  perTriangleThicknessMm: Float32Array;
}

const TI64_DENSITY_G_CM3 = 4.43;

function clampFinite(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Quantizes 3D vertex coordinate to 0.1 um grid for robust shared-edge / manifold checks.
 */
function edgeHash(ax: number, ay: number, az: number, bx: number, by: number, bz: number): { fwd: string; rev: string } {
  const q = (n: number) => Math.round(n * 10000);
  const a = `${q(ax)},${q(ay)},${q(az)}`;
  const b = `${q(bx)},${q(by)},${q(bz)}`;
  return { fwd: `${a}|${b}`, rev: `${b}|${a}` };
}

/**
 * Computes exact signed volume & surface area + edge manifold/watertight topology + concave corner count.
 */
function analyzeVolumeAreaAndTopology(mesh: ParsedCadMesh) {
  const pos = mesh.positions;
  const norm = mesh.normals;
  const bb = mesh.boundingBox;
  const nTri = mesh.triangleCount;
  // Origin shift to centroid reduces floating-point cancellation for meshes far from (0,0,0)
  const ox = (bb.min[0] + bb.max[0]) * 0.5;
  const oy = (bb.min[1] + bb.max[1]) * 0.5;
  const oz = (bb.min[2] + bb.max[2]) * 0.5;

  let signedVol6 = 0;
  let totalArea = 0;

  // For meshes <= 250k triangles compute exact half-edge topology & dihedral corner angles
  const checkTopology = nTri <= 250_000;
  const directedEdges = checkTopology ? new Map<string, number>() : null;
  const edgeFaceNormals = checkTopology ? new Map<string, [number, number, number]>() : null;
  let sharpConcaveCorners = 0;

  for (let t = 0; t < nTri; t++) {
    const i = t * 9;
    const ax = pos[i] - ox, ay = pos[i + 1] - oy, az = pos[i + 2] - oz;
    const bx = pos[i + 3] - ox, by = pos[i + 4] - oy, bz = pos[i + 5] - oz;
    const cx = pos[i + 6] - ox, cy = pos[i + 7] - oy, cz = pos[i + 8] - oz;

    // Cross product of (b) x (c) and signed tetrahedron 6*V = a . (b x c)
    const bcx = by * cz - bz * cy;
    const bcy = bz * cx - bx * cz;
    const bcz = bx * cy - by * cx;
    signedVol6 += ax * bcx + ay * bcy + az * bcz;

    // Triangle area = 0.5 * |(b-a) x (c-a)|
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const crx = uy * vz - uz * vy;
    const cry = uz * vx - ux * vz;
    const crz = ux * vy - uy * vx;
    const area = 0.5 * Math.sqrt(crx * crx + cry * cry + crz * crz);
    if (Number.isFinite(area)) totalArea += area;

    if (directedEdges && edgeFaceNormals) {
      const fn: [number, number, number] = [norm[i], norm[i + 1], norm[i + 2]];
      const verts: Array<[number, number, number]> = [
        [pos[i], pos[i + 1], pos[i + 2]],
        [pos[i + 3], pos[i + 4], pos[i + 5]],
        [pos[i + 6], pos[i + 7], pos[i + 8]]
      ];
      for (let e = 0; e < 3; e++) {
        const p = verts[e];
        const q = verts[(e + 1) % 3];
        const { fwd, rev } = edgeHash(p[0], p[1], p[2], q[0], q[1], q[2]);
        directedEdges.set(fwd, (directedEdges.get(fwd) || 0) + 1);
        const oppN = edgeFaceNormals.get(rev);
        if (oppN) {
          const dotN = Math.max(-1, Math.min(1, fn[0] * oppN[0] + fn[1] * oppN[1] + fn[2] * oppN[2]));
          if (dotN < 0.35) {
            // Check edge cross product vs normals to distinguish concave fillet/notch from convex external edge
            const ex = q[0] - p[0], ey = q[1] - p[1], ez = q[2] - p[2];
            const nCrossX = oppN[1] * fn[2] - oppN[2] * fn[1];
            const nCrossY = oppN[2] * fn[0] - oppN[0] * fn[2];
            const nCrossZ = oppN[0] * fn[1] - oppN[1] * fn[0];
            if (nCrossX * ex + nCrossY * ey + nCrossZ * ez > 1e-6) {
              sharpConcaveCorners++;
            }
          }
        } else {
          edgeFaceNormals.set(fwd, fn);
        }
      }
    }
  }

  let boundaryEdgeCount = 0;
  let nonManifoldEdgeCount = 0;
  if (directedEdges) {
    for (const [edgeKey, count] of directedEdges.entries()) {
      if (count > 1) nonManifoldEdgeCount += count - 1;
      const sep = edgeKey.indexOf('|');
      const revKey = `${edgeKey.slice(sep + 1)}|${edgeKey.slice(0, sep)}`;
      if (!directedEdges.has(revKey)) boundaryEdgeCount++;
    }
  }

  const isWatertight = checkTopology
    ? (boundaryEdgeCount === 0 && nonManifoldEdgeCount === 0 && signedVol6 > 0)
    : (signedVol6 > 0);

  return {
    volumeMm3: Math.max(0, Math.abs(signedVol6) / 6.0),
    surfaceAreaMm2: Math.max(0, totalArea),
    isWatertight,
    boundaryEdgeCount,
    nonManifoldEdgeCount,
    sharpConcaveCorners
  };
}

interface BvhNode {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
  left: BvhNode | null;
  right: BvhNode | null;
  start: number;
  count: number;
}

function buildTriangleBvh(pos: Float32Array, nTri: number): { root: BvhNode; indices: Uint32Array } {
  const indices = new Uint32Array(nTri);
  const cx = new Float32Array(nTri);
  const cy = new Float32Array(nTri);
  const cz = new Float32Array(nTri);

  for (let t = 0; t < nTri; t++) {
    indices[t] = t;
    const i = t * 9;
    cx[t] = (pos[i] + pos[i + 3] + pos[i + 6]) / 3;
    cy[t] = (pos[i + 1] + pos[i + 4] + pos[i + 7]) / 3;
    cz[t] = (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3;
  }

  const buildNode = (start: number, count: number): BvhNode => {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let k = start; k < start + count; k++) {
      const i = indices[k] * 9;
      for (let v = 0; v < 9; v += 3) {
        const x = pos[i + v], y = pos[i + v + 1], z = pos[i + v + 2];
        if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
      }
    }

    if (count <= 8) {
      return { minX, minY, minZ, maxX, maxY, maxZ, left: null, right: null, start, count };
    }

    const dx = maxX - minX, dy = maxY - minY, dz = maxZ - minZ;
    const axis = dx >= dy && dx >= dz ? 0 : (dy >= dz ? 1 : 2);
    const cArr = axis === 0 ? cx : (axis === 1 ? cy : cz);
    const midVal = axis === 0 ? (minX + maxX) * 0.5 : (axis === 1 ? (minY + maxY) * 0.5 : (minZ + maxZ) * 0.5);

    let leftEnd = start;
    for (let k = start; k < start + count; k++) {
      if (cArr[indices[k]] < midVal) {
        const tmp = indices[k];
        indices[k] = indices[leftEnd];
        indices[leftEnd] = tmp;
        leftEnd++;
      }
    }
    let leftCount = leftEnd - start;
    if (leftCount === 0 || leftCount === count) leftCount = count >> 1;

    return {
      minX, minY, minZ, maxX, maxY, maxZ,
      left: buildNode(start, leftCount),
      right: buildNode(start + leftCount, count - leftCount),
      start: 0,
      count: 0
    };
  };

  return { root: buildNode(0, nTri), indices };
}

function rayAabbHit(
  ox: number, oy: number, oz: number,
  invDx: number, invDy: number, invDz: number,
  node: BvhNode,
  bestT: number
): boolean {
  const tx1 = (node.minX - ox) * invDx, tx2 = (node.maxX - ox) * invDx;
  let tmin = Math.min(tx1, tx2), tmax = Math.max(tx1, tx2);
  const ty1 = (node.minY - oy) * invDy, ty2 = (node.maxY - oy) * invDy;
  tmin = Math.max(tmin, Math.min(ty1, ty2));
  tmax = Math.min(tmax, Math.max(ty1, ty2));
  const tz1 = (node.minZ - oz) * invDz, tz2 = (node.maxZ - oz) * invDz;
  tmin = Math.max(tmin, Math.min(tz1, tz2));
  tmax = Math.min(tmax, Math.max(tz1, tz2));
  return tmax >= Math.max(0, tmin) && tmin < bestT;
}

function rayTriangleHit(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  pos: Float32Array,
  triIdx: number
): number {
  const i = triIdx * 9;
  const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
  const e1x = pos[i + 3] - ax, e1y = pos[i + 4] - ay, e1z = pos[i + 5] - az;
  const e2x = pos[i + 6] - ax, e2y = pos[i + 7] - ay, e2z = pos[i + 8] - az;

  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-10) return Infinity;

  const invDet = 1.0 / det;
  const tx = ox - ax, ty = oy - ay, tz = oz - az;
  const u = (tx * px + ty * py + tz * pz) * invDet;
  if (u < 0 || u > 1) return Infinity;

  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * invDet;
  if (v < 0 || u + v > 1) return Infinity;

  const t = (e2x * qx + e2y * qy + e2z * qz) * invDet;
  return t > 1e-3 ? t : Infinity;
}

function traceBvhNearest(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  pos: Float32Array,
  root: BvhNode,
  indices: Uint32Array,
  skipTri: number
): { dist: number; hitCount: number; firstHitNormalDot: number } {
  const invDx = Math.abs(dx) > 1e-12 ? 1.0 / dx : 1e12;
  const invDy = Math.abs(dy) > 1e-12 ? 1.0 / dy : 1e12;
  const invDz = Math.abs(dz) > 1e-12 ? 1.0 / dz : 1e12;

  let bestT = Infinity;
  let hitCount = 0;
  let firstHitNormalDot = 0;

  const stack: BvhNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (!rayAabbHit(ox, oy, oz, invDx, invDy, invDz, node, Infinity)) continue;
    if (node.count > 0) {
      for (let k = node.start; k < node.start + node.count; k++) {
        const tri = indices[k];
        if (tri === skipTri) continue;
        const t = rayTriangleHit(ox, oy, oz, dx, dy, dz, pos, tri);
        if (Number.isFinite(t)) {
          hitCount++;
          if (t < bestT) {
            bestT = t;
            const bi = tri * 9;
            const ux = pos[bi + 3] - pos[bi], uy = pos[bi + 4] - pos[bi + 1], uz = pos[bi + 5] - pos[bi + 2];
            const vx = pos[bi + 6] - pos[bi], vy = pos[bi + 7] - pos[bi + 1], vz = pos[bi + 8] - pos[bi + 2];
            const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            firstHitNormalDot = (nx * dx + ny * dy + nz * dz) / nLen;
          }
        }
      }
    } else {
      if (node.left) stack.push(node.left);
      if (node.right) stack.push(node.right);
    }
  }

  return { dist: bestT, hitCount, firstHitNormalDot };
}

/**
 * Slices mesh horizontally at Z planes and computes exact 2D cross-section area A(z) and perimeter L(z)
 * using Green's theorem oriented by triangle normal XY projection.
 */
function computeLayerSlices(
  mesh: ParsedCadMesh,
  layerThicknessMm: number,
  maxSlices: number
): LayerSliceSummary[] {
  const zMin = mesh.boundingBox.min[2];
  const zMax = mesh.boundingBox.max[2];
  const height = zMax - zMin;
  if (!Number.isFinite(height) || height <= 1e-4) return [];

  const naturalLayers = Math.max(1, Math.round(height / Math.max(0.01, layerThicknessMm)));
  const numSlices = Math.max(6, Math.min(maxSlices, naturalLayers));
  const pos = mesh.positions;
  const norm = mesh.normals;
  const nTri = mesh.triangleCount;

  // Pre-cache triangle z-extents to skip non-intersecting triangles quickly
  const triZMin = new Float32Array(nTri);
  const triZMax = new Float32Array(nTri);
  for (let t = 0; t < nTri; t++) {
    const i = t * 9;
    const z0 = pos[i + 2], z1 = pos[i + 5], z2 = pos[i + 8];
    triZMin[t] = Math.min(z0, z1, z2);
    triZMax[t] = Math.max(z0, z1, z2);
  }

  const slices: LayerSliceSummary[] = [];
  let prevArea = 0;

  for (let s = 0; s < numSlices; s++) {
    const frac = (s + 0.5) / numSlices;
    const z = zMin + frac * height;
    let twiceArea = 0;
    let perimeter = 0;

    for (let t = 0; t < nTri; t++) {
      if (triZMax[t] < z || triZMin[t] > z) continue;
      const i = t * 9;
      const pts: Array<[number, number, number]> = [
        [pos[i], pos[i + 1], pos[i + 2]],
        [pos[i + 3], pos[i + 4], pos[i + 5]],
        [pos[i + 6], pos[i + 7], pos[i + 8]]
      ];
      const crossPts: Array<[number, number]> = [];
      for (let e = 0; e < 3; e++) {
        const a = pts[e];
        const b = pts[(e + 1) % 3];
        const da = a[2] - z;
        const db = b[2] - z;
        if ((da <= 0 && db > 0) || (db <= 0 && da > 0)) {
          const tEdge = (z - a[2]) / (b[2] - a[2]);
          crossPts.push([a[0] + tEdge * (b[0] - a[0]), a[1] + tEdge * (b[1] - a[1])]);
        }
      }
      if (crossPts.length === 2) {
        let p0 = crossPts[0];
        let p1 = crossPts[1];
        const sx = p1[0] - p0[0];
        const sy = p1[1] - p0[1];
        const segLen = Math.hypot(sx, sy);
        if (segLen <= 1e-8) continue;
        perimeter += segLen;

        // Orient segment CCW around interior using outward normal XY direction (n_xy = (sy, -sx))
        const nx = norm[i], ny = norm[i + 1];
        if (sy * nx - sx * ny < 0) {
          const tmp = p0; p0 = p1; p1 = tmp;
        }
        twiceArea += p0[0] * p1[1] - p1[0] * p0[1];
      }
    }

    const area = Math.max(0, Math.abs(twiceArea) * 0.5);
    const heatSinkRatio = s === 0
      ? 1.0
      : Number(Math.max(0.05, Math.min(20.0, prevArea / Math.max(1e-2, area))).toFixed(3));
    slices.push({
      zMm: Number(z.toFixed(3)),
      areaMm2: Number(area.toFixed(2)),
      perimeterMm: Number(perimeter.toFixed(2)),
      heatSinkRatio
    });
    prevArea = area;
  }

  return slices;
}

/**
 * Full Phase 2 CAD geometry analysis across topology, overhangs, BVH wall thickness, and slicing.
 */
export function analyzeCadGeometry(
  mesh: ParsedCadMesh,
  options: GeometryAnalysisOptions = {}
): CadGeometryReport {
  const t0 = Date.now();
  const overhangThresholdDeg = clampFinite(options.overhangThresholdDeg ?? 45, 45);
  const layerThicknessMm = Math.max(0.01, clampFinite(options.layerThicknessMm ?? 0.04, 0.04));
  const minWallLimitMm = Math.max(0.05, clampFinite(options.minWallLimitMm ?? 0.4, 0.4));
  const maxSlices = Math.max(10, Math.round(options.maxSlices ?? 120));
  const maxThicknessRays = Math.max(120, Math.round(options.maxThicknessRays ?? 1400));

  const topo = analyzeVolumeAreaAndTopology(mesh);
  const nTri = mesh.triangleCount;
  const pos = mesh.positions;
  const norm = mesh.normals;
  const zBase = mesh.boundingBox.min[2];

  // 1. Overhang analysis (faces with normal_z < -sin(threshold) above baseplate)
  const sinThresh = Math.sin((overhangThresholdDeg * Math.PI) / 180);
  const nzCutoff = -sinThresh;
  const perTriangleOverhang = new Uint8Array(nTri);
  let overhangAreaMm2 = 0;
  let downFacingBaseAreaMm2 = 0;

  for (let t = 0; t < nTri; t++) {
    const i = t * 9;
    const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
    const bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5];
    const cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const crx = uy * vz - uz * vy, cry = uz * vx - ux * vz, crz = ux * vy - uy * vx;
    const area = 0.5 * Math.sqrt(crx * crx + cry * cry + crz * crz);
    if (!Number.isFinite(area) || area <= 0) continue;

    const nz = norm[i + 2];
    const zCent = (az + bz + cz) / 3.0;
    if (nz < -0.95 && zCent <= zBase + 0.15) {
      downFacingBaseAreaMm2 += area;
    } else if (nz < nzCutoff && zCent > zBase + 0.15) {
      overhangAreaMm2 += area;
      perTriangleOverhang[t] = 1;
    }
  }

  // 2. Spatial BVH Ray-Cast Wall Thickness & Enclosed Cavity Probe
  const { root, indices } = buildTriangleBvh(pos, nTri);
  const perTriangleThicknessMm = new Float32Array(nTri);
  const maxSpan = Math.max(1, Math.max(...mesh.boundingBox.size));
  const rayStride = nTri > maxThicknessRays ? Math.ceil(nTri / maxThicknessRays) : 1;
  const sampledThicknesses: number[] = [];
  let internalCavityVotes = 0;

  for (let t = 0; t < nTri; t += rayStride) {
    const i = t * 9;
    const cx = (pos[i] + pos[i + 3] + pos[i + 6]) / 3;
    const cy = (pos[i + 1] + pos[i + 4] + pos[i + 7]) / 3;
    const cz = (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3;
    const nx = norm[i], ny = norm[i + 1], nz = norm[i + 2];
    const eps = Math.min(0.02, maxSpan * 1e-4);

    // Cast inward ray along -normal
    const hit = traceBvhNearest(cx - nx * eps, cy - ny * eps, cz - nz * eps, -nx, -ny, -nz, pos, root, indices, t);
    let thick = Number.isFinite(hit.dist) && hit.dist <= maxSpan * 1.1 ? hit.dist : maxSpan;
    thick = Math.max(0.05, Math.min(maxSpan, thick));
    sampledThicknesses.push(thick);

    // Propagate thickness cleanly to stride neighbors for heatmap continuity
    for (let s = 0; s < rayStride && t + s < nTri; s++) {
      perTriangleThicknessMm[t + s] = thick;
    }

    // Odd outward hit parity indicates a ray emerging through an enclosed cavity ceiling
    if (hit.hitCount >= 3 && hit.firstHitNormalDot < -0.5) {
      internalCavityVotes++;
    }
  }

  sampledThicknesses.sort((a, b) => a - b);
  const minWallThicknessMm = sampledThicknesses.length > 0 ? Number(sampledThicknesses[0].toFixed(2)) : 0;
  const p10WallThicknessMm = sampledThicknesses.length > 0
    ? Number(sampledThicknesses[Math.min(sampledThicknesses.length - 1, Math.floor(sampledThicknesses.length * 0.1))].toFixed(2))
    : 0;
  const medianWallThicknessMm = sampledThicknesses.length > 0
    ? Number(sampledThicknesses[Math.floor(sampledThicknesses.length * 0.5)].toFixed(2))
    : 0;
  const thinHits = sampledThicknesses.filter((x) => x < minWallLimitMm).length;
  const thinWallFractionPct = sampledThicknesses.length > 0
    ? Number(((thinHits / sampledThicknesses.length) * 100).toFixed(1))
    : 0;

  // Estimate enclosed internal voids (only count significant multi-face trapped shells)
  const enclosedCavityCount = topo.isWatertight && internalCavityVotes >= Math.max(6, Math.round(sampledThicknesses.length * 0.08))
    ? Math.max(1, Math.round(internalCavityVotes / Math.max(12, Math.round(sampledThicknesses.length * 0.12))))
    : 0;

  // 3. Layer Cross-Section Slicing A(z)
  const layerSlices = computeLayerSlices(mesh, layerThicknessMm, maxSlices);
  const areas = layerSlices.map((s) => s.areaMm2);
  const maxSliceAreaMm2 = areas.length > 0 ? Number(Math.max(...areas).toFixed(2)) : 0;
  const meanSliceAreaMm2 = areas.length > 0 ? Number((areas.reduce((a, b) => a + b, 0) / areas.length).toFixed(2)) : 0;
  const abruptAreaJumpCount = layerSlices.filter((s, idx) => idx > 0 && (s.heatSinkRatio >= 2.0 || s.heatSinkRatio <= 0.5)).length;

  const overhangFractionPct = topo.surfaceAreaMm2 > 0
    ? Number(Math.min(100, (overhangAreaMm2 / topo.surfaceAreaMm2) * 100).toFixed(1))
    : 0;

  const volumeCm3 = Number((topo.volumeMm3 / 1000.0).toFixed(3));
  const surfaceAreaCm2 = Number((topo.surfaceAreaMm2 / 100.0).toFixed(2));
  const massTi64Grams = Number((volumeCm3 * TI64_DENSITY_G_CM3).toFixed(2));

  return {
    volumeMm3: Number(topo.volumeMm3.toFixed(2)),
    volumeCm3,
    massTi64Grams,
    surfaceAreaMm2: Number(topo.surfaceAreaMm2.toFixed(2)),
    surfaceAreaCm2,
    boundingBox: mesh.boundingBox,
    isWatertight: topo.isWatertight,
    boundaryEdgeCount: topo.boundaryEdgeCount,
    nonManifoldEdgeCount: topo.nonManifoldEdgeCount,
    overhangThresholdDeg,
    overhangAreaMm2: Number(overhangAreaMm2.toFixed(2)),
    overhangFractionPct,
    downFacingBaseAreaMm2: Number(downFacingBaseAreaMm2.toFixed(2)),
    minWallThicknessMm,
    p10WallThicknessMm,
    medianWallThicknessMm,
    thinWallFractionPct,
    enclosedCavityCount,
    sharpConcaveCornerCount: topo.sharpConcaveCorners,
    layerSlices,
    maxSliceAreaMm2,
    meanSliceAreaMm2,
    abruptAreaJumpCount,
    elapsedMs: Date.now() - t0,
    perTriangleOverhang,
    perTriangleThicknessMm
  };
}
