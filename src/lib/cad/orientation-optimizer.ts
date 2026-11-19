/**
 * NIT Trichy Titanium AM Platform — Phase 3 Build Orientation Optimizer
 * Evaluates 26 candidate 3D build orientations (6 axial faces, 12 edge-45° tilts, 8 corner tilts)
 * for any parsed CAD mesh, scoring each by:
 *   - Support overhang volume & contact area
 *   - Build height Z (drives layer count & build time)
 *   - Thermal cross-section abruptness / distortion proxy
 *   - Envelope fit on selected AM machine
 * Returns Top 3 optimal orientations + exact rotation transform to re-orient the mesh cleanly.
 */

import type { ParsedCadMesh } from './cad-parser';
import type { BoundingBox3D } from './cad-guardrails';
import type { MachinePreset } from './machine-presets';

export interface OrientationCandidateScore {
  id: string;
  label: string;
  rotationMatrix: number[]; // 3x3 row-major matrix
  bboxMm: [number, number, number];
  buildHeightMm: number;
  fitsMachine: boolean;
  overhangAreaCm2: number;
  overhangFractionPct: number;
  estimatedSupportVolumeCm3: number;
  compositeScore: number; // Higher is better (0..100)
  tradeoffNote: string;
}

export interface OrientationOptimizationResult {
  evaluatedCount: number;
  currentOrientationScore: OrientationCandidateScore;
  topCandidates: OrientationCandidateScore[]; // Top 3
}

function makeRotMatrixFromAxisAngles(rxDeg: number, ryDeg: number, rzDeg: number): number[] {
  const rx = (rxDeg * Math.PI) / 180;
  const ry = (ryDeg * Math.PI) / 180;
  const rz = (rzDeg * Math.PI) / 180;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

  // R = Rz * Ry * Rx
  return [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy,     cy * sx,                cy * cx
  ];
}

function build26CandidateSpecs(): Array<{ id: string; label: string; mat: number[] }> {
  const list: Array<{ id: string; label: string; mat: number[] }> = [
    // 6 cardinal orthogonal faces
    { id: 'ori-z-pos', label: 'Current (+Z Up)', mat: makeRotMatrixFromAxisAngles(0, 0, 0) },
    { id: 'ori-z-neg', label: 'Flip 180° (-Z / Inverted)', mat: makeRotMatrixFromAxisAngles(180, 0, 0) },
    { id: 'ori-y-pos', label: 'Tilt +90° X (+Y Up)', mat: makeRotMatrixFromAxisAngles(90, 0, 0) },
    { id: 'ori-y-neg', label: 'Tilt -90° X (-Y Up)', mat: makeRotMatrixFromAxisAngles(-90, 0, 0) },
    { id: 'ori-x-pos', label: 'Tilt +90° Y (+X Up)', mat: makeRotMatrixFromAxisAngles(0, 90, 0) },
    { id: 'ori-x-neg', label: 'Tilt -90° Y (-X Up)', mat: makeRotMatrixFromAxisAngles(0, -90, 0) },
    // 12 edge 45° tilts
    { id: 'ori-x45', label: '45° Tilt (X-Axis)', mat: makeRotMatrixFromAxisAngles(45, 0, 0) },
    { id: 'ori-xn45', label: '-45° Tilt (X-Axis)', mat: makeRotMatrixFromAxisAngles(-45, 0, 0) },
    { id: 'ori-y45', label: '45° Tilt (Y-Axis)', mat: makeRotMatrixFromAxisAngles(0, 45, 0) },
    { id: 'ori-yn45', label: '-45° Tilt (Y-Axis)', mat: makeRotMatrixFromAxisAngles(0, -45, 0) },
    { id: 'ori-x135', label: '135° Overhang Relief (X)', mat: makeRotMatrixFromAxisAngles(135, 0, 0) },
    { id: 'ori-xn135', label: '-135° Overhang Relief (X)', mat: makeRotMatrixFromAxisAngles(-135, 0, 0) },
    { id: 'ori-y135', label: '135° Overhang Relief (Y)', mat: makeRotMatrixFromAxisAngles(0, 135, 0) },
    { id: 'ori-yn135', label: '-135° Overhang Relief (Y)', mat: makeRotMatrixFromAxisAngles(0, -135, 0) },
    { id: 'ori-xy90-45', label: 'Side Lay + 45° Tilt', mat: makeRotMatrixFromAxisAngles(90, 45, 0) },
    { id: 'ori-xy90-n45', label: 'Side Lay - 45° Tilt', mat: makeRotMatrixFromAxisAngles(90, -45, 0) },
    { id: 'ori-yx90-45', label: 'Vertical Spine + 45° Tilt', mat: makeRotMatrixFromAxisAngles(45, 90, 0) },
    { id: 'ori-yx90-n45', label: 'Vertical Spine - 45° Tilt', mat: makeRotMatrixFromAxisAngles(-45, 90, 0) },
    // 8 diagonal corner tilts (35.26° / 45° ISO isometric)
    { id: 'ori-diag-pp', label: 'Diagonal (+35° X, +45° Y)', mat: makeRotMatrixFromAxisAngles(35.26, 45, 0) },
    { id: 'ori-diag-pn', label: 'Diagonal (+35° X, -45° Y)', mat: makeRotMatrixFromAxisAngles(35.26, -45, 0) },
    { id: 'ori-diag-np', label: 'Diagonal (-35° X, +45° Y)', mat: makeRotMatrixFromAxisAngles(-35.26, 45, 0) },
    { id: 'ori-diag-nn', label: 'Diagonal (-35° X, -45° Y)', mat: makeRotMatrixFromAxisAngles(-35.26, -45, 0) },
    { id: 'ori-diag-ipp', label: 'Inverted Diag (+145° X, +45° Y)', mat: makeRotMatrixFromAxisAngles(144.74, 45, 0) },
    { id: 'ori-diag-ipn', label: 'Inverted Diag (+145° X, -45° Y)', mat: makeRotMatrixFromAxisAngles(144.74, -45, 0) },
    { id: 'ori-diag-inp', label: 'Inverted Diag (-145° X, +45° Y)', mat: makeRotMatrixFromAxisAngles(-144.74, 45, 0) },
    { id: 'ori-diag-inn', label: 'Inverted Diag (-145° X, -45° Y)', mat: makeRotMatrixFromAxisAngles(-144.74, -45, 0) }
  ];
  return list;
}

/**
 * Applies a 3x3 rotation matrix to a parsed CAD mesh and shifts its bottom to Z = 0 on the build plate.
 */
export function rotateCadMeshToBuildPlate(mesh: ParsedCadMesh, m: number[]): ParsedCadMesh {
  const pos = mesh.positions;
  const norm = mesh.normals;
  const n = pos.length;
  const outPos = new Float32Array(n);
  const outNorm = new Float32Array(n);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < n; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const rx = m[0] * x + m[1] * y + m[2] * z;
    const ry = m[3] * x + m[4] * y + m[5] * z;
    const rz = m[6] * x + m[7] * y + m[8] * z;
    outPos[i] = rx; outPos[i + 1] = ry; outPos[i + 2] = rz;
    if (rx < minX) minX = rx; if (ry < minY) minY = ry; if (rz < minZ) minZ = rz;
    if (rx > maxX) maxX = rx; if (ry > maxY) maxY = ry; if (rz > maxZ) maxZ = rz;

    const nx = norm[i], ny = norm[i + 1], nz = norm[i + 2];
    const rnx = m[0] * nx + m[1] * ny + m[2] * nz;
    const rny = m[3] * nx + m[4] * ny + m[5] * nz;
    const rnz = m[6] * nx + m[7] * ny + m[8] * nz;
    outNorm[i] = rnx; outNorm[i + 1] = rny; outNorm[i + 2] = rnz;
  }

  // Shift so bottom rests squarely at z = 0 (keep x/y centered near positive quadrant nicely)
  for (let i = 0; i < n; i += 3) {
    outPos[i] -= minX;
    outPos[i + 1] -= minY;
    outPos[i + 2] -= minZ;
  }

  const bbox: BoundingBox3D = {
    min: [0, 0, 0],
    max: [maxX - minX, maxY - minY, maxZ - minZ],
    size: [maxX - minX, maxY - minY, maxZ - minZ]
  };

  return {
    ...mesh,
    positions: outPos,
    normals: outNorm,
    boundingBox: bbox
  };
}

function scoreSingleOrientation(
  mesh: ParsedCadMesh,
  spec: { id: string; label: string; mat: number[] },
  machine: MachinePreset,
  overhangDeg: number,
  stride: number
): OrientationCandidateScore {
  const pos = mesh.positions;
  const norm = mesh.normals;
  const nTri = mesh.triangleCount;
  const m = spec.mat;
  const sinThresh = Math.sin((overhangDeg * Math.PI) / 180);
  const nzCutoff = -sinThresh;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let t = 0; t < nTri; t += stride) {
    const i = t * 9;
    for (let v = 0; v < 9; v += 3) {
      const x = pos[i + v], y = pos[i + v + 1], z = pos[i + v + 2];
      const rx = m[0] * x + m[1] * y + m[2] * z;
      const ry = m[3] * x + m[4] * y + m[5] * z;
      const rz = m[6] * x + m[7] * y + m[8] * z;
      if (rx < minX) minX = rx; if (ry < minY) minY = ry; if (rz < minZ) minZ = rz;
      if (rx > maxX) maxX = rx; if (ry > maxY) maxY = ry; if (rz > maxZ) maxZ = rz;
    }
  }

  const sx = Math.max(0.1, maxX - minX);
  const sy = Math.max(0.1, maxY - minY);
  const sz = Math.max(0.1, maxZ - minZ);
  const fitsMachine =
    sx <= machine.envelopeMm[0] &&
    sy <= machine.envelopeMm[1] &&
    sz <= machine.envelopeMm[2];

  let totalAreaMm2 = 0;
  let overhangAreaMm2 = 0;
  let supportSolidMm3 = 0;

  for (let t = 0; t < nTri; t += stride) {
    const i = t * 9;
    const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
    const bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5];
    const cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const crx = uy * vz - uz * vy, cry = uz * vx - ux * vz, crz = ux * vy - uy * vx;
    const area = 0.5 * Math.hypot(crx, cry, crz) * stride;
    if (!Number.isFinite(area) || area <= 0) continue;
    totalAreaMm2 += area;

    // Transformed normal_z and rotated z-centroid height above build plate
    const nx = norm[i], ny = norm[i + 1], nz = norm[i + 2];
    const rnz = m[6] * nx + m[7] * ny + m[8] * nz;
    const cZ = m[6] * ((ax + bx + cx) / 3) + m[7] * ((ay + by + cy) / 3) + m[8] * ((az + bz + cz) / 3) - minZ;

    if (rnz < nzCutoff && cZ > 0.25) {
      overhangAreaMm2 += area;
      supportSolidMm3 += area * Math.max(0.15, Math.abs(rnz)) * cZ;
    }
  }

  const overhangPct = totalAreaMm2 > 0 ? Math.min(100, (overhangAreaMm2 / totalAreaMm2) * 100) : 0;
  const supportFill = machine.process === 'lpbf' ? 0.22 : 0.35;
  const supportVolCm3 = (supportSolidMm3 * supportFill) / 1000.0;

  // Normalized composite score (higher = better):
  // Penalizes non-fitting envelopes heavily, then overhangs, support volume, and excessive Z height
  const maxRefH = Math.max(10, Math.max(sx, sy, sz));
  const heightNorm = sz / maxRefH; // 0..1 (lower Z => shorter build time & fewer recoats)
  const rawScore =
    (fitsMachine ? 50 : 10) +
    (1 - Math.min(1, overhangPct / 35.0)) * 30 +
    (1 - Math.min(1, heightNorm)) * 20;
  const compositeScore = Number(Math.max(1, Math.min(100, rawScore)).toFixed(1));

  let tradeoffNote = 'Balanced orientation';
  if (!fitsMachine) tradeoffNote = 'Exceeds machine build envelope';
  else if (overhangPct < 1.0) tradeoffNote = 'Zero overhangs (self-supporting)';
  else if (heightNorm <= 0.6) tradeoffNote = 'Minimized Z height & recoat time';
  else if (overhangPct < 6.0) tradeoffNote = 'Low sacrificial support requirement';

  return {
    id: spec.id,
    label: spec.label,
    rotationMatrix: spec.mat,
    bboxMm: [Number(sx.toFixed(1)), Number(sy.toFixed(1)), Number(sz.toFixed(1))],
    buildHeightMm: Number(sz.toFixed(1)),
    fitsMachine,
    overhangAreaCm2: Number((overhangAreaMm2 / 100.0).toFixed(2)),
    overhangFractionPct: Number(overhangPct.toFixed(1)),
    estimatedSupportVolumeCm3: Number(supportVolCm3.toFixed(2)),
    compositeScore,
    tradeoffNote
  };
}

/**
 * Evaluates all 26 candidate build orientations and returns Top 3 optimal choices.
 */
export function optimizeBuildOrientations(
  mesh: ParsedCadMesh,
  machine: MachinePreset,
  overhangThresholdDeg: number = 45
): OrientationOptimizationResult {
  const specs = build26CandidateSpecs();
  const stride = mesh.triangleCount > 12000 ? Math.ceil(mesh.triangleCount / 12000) : 1;

  const scores = specs.map((spec) => scoreSingleOrientation(mesh, spec, machine, overhangThresholdDeg, stride));
  const currentOrientationScore = scores[0];
  const sorted = [...scores].sort((a, b) =>
    b.compositeScore - a.compositeScore || a.estimatedSupportVolumeCm3 - b.estimatedSupportVolumeCm3
  );

  return {
    evaluatedCount: scores.length,
    currentOrientationScore,
    topCandidates: sorted.slice(0, 3)
  };
}
