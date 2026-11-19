/**
 * NIT Trichy Titanium AM Platform — Phase 3 CAD Printability Rules & Support Estimator
 * Evaluates Ti-6Al-4V part printability across LPBF, L-DED, and WAAM from real mesh geometry:
 *   - Envelope fit check against selected machine
 *   - Minimum wall thickness vs process feature resolution (0.4 mm LPBF, 1.2 mm L-DED, 3.5 mm WAAM)
 *   - Projected support volume (cm³), support contact area (cm²), & removal difficulty
 *   - Trapped powder / enclosed cavity warnings + drain-hole recommendations
 *   - Ranked multi-process suitability scoring across LPBF, L-DED, and WAAM
 */

import type { ParsedCadMesh } from './cad-parser';
import type { CadGeometryReport } from './geometry-analyzer';
import type { MachinePreset, MachineProcessType } from './machine-presets';

export interface SupportEstimate {
  supportContactAreaCm2: number;
  supportVolumeCm3: number;
  supportMassGrams: number;
  maxUnsupportedDropMm: number;
  removalDifficulty: 'None' | 'Easy' | 'Moderate' | 'Hard';
  notes: string[];
}

export interface ProcessSuitabilityScore {
  processId: MachineProcessType;
  processLabel: string;
  score: number; // 0..100
  verdict: 'Recommended' | 'Viable (Post-Machining)' | 'Marginal' | 'Not Suitable';
  fitsAnyMachineOrientation: boolean;
  thinFeatureStatus: 'Pass' | 'Requires Post-Machining' | 'Too Thin';
  reasons: string[];
}

export interface CadPrintabilityReport {
  overallVerdict: 'Printable' | 'Printable with Supports / Adjustments' | 'Not Printable on Selected Machine';
  fitsSelectedMachine: boolean;
  selectedProcess: MachineProcessType;
  wallThresholdMm: number;
  wallCheckStatus: 'Pass' | 'Marginal' | 'Fail';
  trappedPowderRisk: 'None' | 'High';
  supportEstimate: SupportEstimate;
  warnings: string[];
  recommendations: string[];
  processRanking: ProcessSuitabilityScore[];
}

function getProcessMinWallMm(proc: MachineProcessType): number {
  if (proc === 'waam') return 3.5;
  if (proc === 'ded-laser') return 1.2;
  return 0.4;
}

/**
 * Estimates vertical projected support volume beneath overhanging faces (> threshold)
 * down to either the lower underlying solid surface or the baseplate zMin.
 */
export function estimateSupportVolume(
  mesh: ParsedCadMesh,
  geo: CadGeometryReport,
  fillFraction: number = 0.22 // Typical lattice/block Ti-6Al-4V LPBF support density ~18-25%
): SupportEstimate {
  const nTri = mesh.triangleCount;
  const pos = mesh.positions;
  const norm = mesh.normals;
  const zBase = mesh.boundingBox.min[2];
  const overhangMask = geo.perTriangleOverhang;

  // Pre-collect triangles for quick downward Z projection (for small/medium parts or sampled overhang tris)
  const sampleStride = nTri > 15000 ? Math.ceil(nTri / 15000) : 1;
  let totalSupportSolidMm3 = 0;
  let overhangAreaMm2 = 0;
  let maxDropMm = 0;
  let hardPockets = 0;

  // Build coarse 2D XY grid bins of upward-facing surfaces to estimate internal part-to-part supports quickly
  for (let t = 0; t < nTri; t += sampleStride) {
    if (!overhangMask[t]) continue;
    const i = t * 9;
    const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
    const bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5];
    const cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const crx = uy * vz - uz * vy, cry = uz * vx - ux * vz, crz = ux * vy - uy * vx;
    const area = 0.5 * Math.hypot(crx, cry, crz) * sampleStride;
    if (!Number.isFinite(area) || area <= 0) continue;

    const cX = (ax + bx + cx) / 3;
    const cY = (ay + by + cy) / 3;
    const cZ = (az + bz + cz) / 3;
    const nzAbs = Math.max(0.15, Math.abs(norm[i + 2]));

    // Projected horizontal footprint on build plane
    const horizArea = area * nzAbs;
    overhangAreaMm2 += area;

    // Check drop distance down to either highest lower upward face at (cX, cY) or zBase
    let landingZ = zBase;
    if (nTri <= 12000) {
      for (let k = 0; k < nTri; k++) {
        if (k === t) continue;
        const j = k * 9;
        if (norm[j + 2] <= 0.15) continue;
        const kz = (pos[j + 2] + pos[j + 5] + pos[j + 8]) / 3;
        if (kz >= cZ - 0.1 || kz <= landingZ) continue;
        const kMinX = Math.min(pos[j], pos[j + 3], pos[j + 6]);
        const kMaxX = Math.max(pos[j], pos[j + 3], pos[j + 6]);
        const kMinY = Math.min(pos[j + 1], pos[j + 4], pos[j + 7]);
        const kMaxY = Math.max(pos[j + 1], pos[j + 4], pos[j + 7]);
        if (cX >= kMinX && cX <= kMaxX && cY >= kMinY && cY <= kMaxY) {
          landingZ = kz;
        }
      }
    }

    const dropMm = Math.max(0.5, cZ - landingZ);
    if (dropMm > maxDropMm) maxDropMm = dropMm;
    if (landingZ > zBase + 1.0) hardPockets++;
    totalSupportSolidMm3 += horizArea * dropMm;
  }

  // Reconcile scaled overhang area with full-mesh overhangAreaMm2 when sampled
  const scaleFactor = overhangAreaMm2 > 0 ? geo.overhangAreaMm2 / overhangAreaMm2 : 1.0;
  const supportVolumeCm3 = Number(((totalSupportSolidMm3 * scaleFactor * fillFraction) / 1000.0).toFixed(2));
  const supportContactAreaCm2 = Number((geo.overhangAreaMm2 / 100.0).toFixed(2));
  const supportMassGrams = Number((supportVolumeCm3 * 4.43).toFixed(2));

  let removalDifficulty: SupportEstimate['removalDifficulty'] = 'None';
  if (geo.overhangAreaMm2 > 1.0) {
    if (hardPockets > 0 && geo.overhangFractionPct > 12) removalDifficulty = 'Hard';
    else if (geo.overhangFractionPct > 6 || maxDropMm > 18) removalDifficulty = 'Moderate';
    else removalDifficulty = 'Easy';
  }

  const notes: string[] = [];
  if (geo.overhangAreaMm2 <= 1.0) {
    notes.push('Self-supporting orientation: zero sacrificial overhang supports needed.');
  } else {
    notes.push(`${supportContactAreaCm2} cm² overhang contact requiring ~${supportVolumeCm3} cm³ (${supportMassGrams} g) sacrificial Ti-6Al-4V lattice supports.`);
    if (hardPockets > 0) notes.push('Some supports terminate on part surfaces (part-on-part contact) — inspect chisel/machining access.');
  }

  return {
    supportContactAreaCm2,
    supportVolumeCm3,
    supportMassGrams,
    maxUnsupportedDropMm: Number(maxDropMm.toFixed(1)),
    removalDifficulty,
    notes
  };
}

/**
 * Evaluates full process-specific printability rules & ranks LPBF vs L-DED vs WAAM for the uploaded CAD.
 */
export function evaluateCadPrintability(
  mesh: ParsedCadMesh,
  geo: CadGeometryReport,
  machine: MachinePreset
): CadPrintabilityReport {
  const proc = machine.process;
  const size = mesh.boundingBox.size;
  const fitsSelectedMachine =
    size[0] <= machine.envelopeMm[0] &&
    size[1] <= machine.envelopeMm[1] &&
    size[2] <= machine.envelopeMm[2];

  const wallThresholdMm = getProcessMinWallMm(proc);
  const supportFill = proc === 'lpbf' ? 0.22 : (proc === 'ded-laser' ? 0.35 : 0.45);
  const supportEstimate = estimateSupportVolume(mesh, geo, supportFill);

  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (!fitsSelectedMachine) {
    warnings.push(
      `Part (${size[0].toFixed(1)}×${size[1].toFixed(1)}×${size[2].toFixed(1)} mm) exceeds ${machine.name} build volume (${machine.envelopeMm.join('×')} mm) in this orientation.`
    );
    recommendations.push('Run Orientation Optimizer to check rotated fit or select a larger machine/process envelope.');
  }

  let wallCheckStatus: CadPrintabilityReport['wallCheckStatus'] = 'Pass';
  if (geo.minWallThicknessMm < wallThresholdMm) {
    wallCheckStatus = proc === 'lpbf' ? 'Fail' : 'Marginal';
    warnings.push(
      `Minimum wall (${geo.minWallThicknessMm} mm) is below ${proc.toUpperCase()} single-track limit (${wallThresholdMm} mm).`
    );
    recommendations.push(
      proc === 'lpbf'
        ? `Thicken walls ≥ ${wallThresholdMm} mm or switch to smaller spot / lower hatch spacing.`
        : `Walls < ${wallThresholdMm} mm require near-net-shape stock allowance + CNC finish machining after ${proc.toUpperCase()}.`
    );
  } else if (geo.minWallThicknessMm < wallThresholdMm * 1.4) {
    wallCheckStatus = 'Marginal';
    warnings.push(`Tight feature margin: min wall ${geo.minWallThicknessMm} mm is near ${proc.toUpperCase()} resolution (${wallThresholdMm} mm).`);
  }

  let trappedPowderRisk: CadPrintabilityReport['trappedPowderRisk'] = 'None';
  if (geo.enclosedCavityCount > 0) {
    trappedPowderRisk = proc === 'lpbf' ? 'High' : 'None';
    if (proc === 'lpbf') {
      warnings.push(`Detected ${geo.enclosedCavityCount} potential enclosed cavity(s) that would trap unfused Ti-6Al-4V powder in LPBF.`);
      recommendations.push('Add ≥ Ø2.5 mm powder drain holes to sealed internal cavities before slicing.');
    }
  }

  if (!geo.isWatertight) {
    warnings.push(`Mesh has ${geo.boundaryEdgeCount} open boundary edges — slice perimeter repair recommended before build prep.`);
  }

  if (geo.overhangFractionPct > 8) {
    recommendations.push(`Overhang area is ${geo.overhangFractionPct}% (${supportEstimate.supportContactAreaCm2} cm²); evaluate Top-3 Optimal Orientations to minimize supports.`);
  }

  // Rank all 3 Ti-6Al-4V AM processes cleanly against this CAD geometry
  const maxDim = Math.max(size[0], size[1], size[2]);
  const lpbfScore = Math.max(10, Math.min(100, Math.round(
    (maxDim <= 350 ? 92 : 45) -
    (geo.minWallThicknessMm < 0.4 ? 25 : 0) -
    (geo.enclosedCavityCount > 0 ? 12 : 0) -
    Math.min(18, geo.overhangFractionPct * 0.6) +
    (geo.volumeCm3 <= 400 ? 6 : -12)
  )));
  const ldedScore = Math.max(10, Math.min(100, Math.round(
    (geo.volumeCm3 >= 25 ? 84 : 62) -
    (geo.minWallThicknessMm < 1.2 ? 18 : 0) -
    (geo.overhangFractionPct > 15 ? 20 : geo.overhangFractionPct * 0.8) +
    (maxDim > 250 ? 10 : 0)
  )));
  const waamScore = Math.max(10, Math.min(100, Math.round(
    (geo.volumeCm3 >= 150 || maxDim >= 250 ? 88 : 48) -
    (geo.minWallThicknessMm < 3.5 ? 28 : 0) -
    (geo.overhangFractionPct > 10 ? 22 : geo.overhangFractionPct * 0.9)
  )));

  const processRanking: ProcessSuitabilityScore[] = [
    {
      processId: 'lpbf' as const,
      processLabel: 'Laser Powder Bed Fusion (LPBF)',
      score: lpbfScore,
      verdict: (lpbfScore >= 75 ? 'Recommended' : (lpbfScore >= 55 ? 'Viable (Post-Machining)' : 'Not Suitable')) as ProcessSuitabilityScore['verdict'],
      fitsAnyMachineOrientation: maxDim <= 420,
      thinFeatureStatus: (geo.minWallThicknessMm >= 0.4 ? 'Pass' : 'Too Thin') as ProcessSuitabilityScore['thinFeatureStatus'],
      reasons: [
        geo.minWallThicknessMm >= 0.4 ? `Fine ${geo.minWallThicknessMm} mm features resolved directly` : 'Wall below 0.4 mm LPBF minimum',
        geo.volumeCm3 <= 400 ? 'Compact Ti-6Al-4V volume well suited to powder bed' : 'Large solid mass leads to long LPBF build time'
      ]
    },
    {
      processId: 'ded-laser' as const,
      processLabel: 'Laser Directed Energy Deposition (L-DED)',
      score: ldedScore,
      verdict: (ldedScore >= 75 ? 'Recommended' : (ldedScore >= 55 ? 'Viable (Post-Machining)' : 'Marginal')) as ProcessSuitabilityScore['verdict'],
      fitsAnyMachineOrientation: maxDim <= 900,
      thinFeatureStatus: (geo.minWallThicknessMm >= 1.2 ? 'Pass' : 'Requires Post-Machining') as ProcessSuitabilityScore['thinFeatureStatus'],
      reasons: [
        geo.minWallThicknessMm >= 1.2 ? 'Bead width compatible with near-net cladding' : 'Fine walls (<1.2 mm) require CNC finish pass',
        geo.overhangFractionPct <= 10 ? 'Low overhang complexity fits 3–5 axis L-DED' : 'High overhangs require multi-axis indexing'
      ]
    },
    {
      processId: 'waam' as const,
      processLabel: 'Wire-Arc Additive Manufacturing (WAAM)',
      score: waamScore,
      verdict: (waamScore >= 75 ? 'Recommended' : (waamScore >= 52 ? 'Viable (Post-Machining)' : 'Not Suitable')) as ProcessSuitabilityScore['verdict'],
      fitsAnyMachineOrientation: maxDim <= 1500,
      thinFeatureStatus: (geo.minWallThicknessMm >= 3.5 ? 'Pass' : 'Requires Post-Machining') as ProcessSuitabilityScore['thinFeatureStatus'],
      reasons: [
        geo.volumeCm3 >= 120 ? 'High deposition throughput cuts preform cost sharply' : 'Small component better served by LPBF precision',
        geo.minWallThicknessMm >= 3.5 ? 'Thick walls suit 3.5+ mm wire-arc beads' : 'Thin features (<3.5 mm) must be machined post-HIP'
      ]
    }
  ].sort((a, b) => b.score - a.score);

  let overallVerdict: CadPrintabilityReport['overallVerdict'] = 'Printable';
  if (!fitsSelectedMachine || wallCheckStatus === 'Fail') {
    overallVerdict = 'Not Printable on Selected Machine';
  } else if (
    geo.overhangAreaMm2 > 1.0 ||
    wallCheckStatus === 'Marginal' ||
    trappedPowderRisk === 'High' ||
    !geo.isWatertight
  ) {
    overallVerdict = 'Printable with Supports / Adjustments';
  }

  return {
    overallVerdict,
    fitsSelectedMachine,
    selectedProcess: proc,
    wallThresholdMm,
    wallCheckStatus,
    trappedPowderRisk,
    supportEstimate,
    warnings,
    recommendations,
    processRanking
  };
}
