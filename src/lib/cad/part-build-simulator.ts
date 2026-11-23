/**
 * NIT Trichy Titanium AM Platform — Phase 4 Layer-by-Layer Part Build Simulator
 * Runs local thermal accumulation across CAD slices A(z), couples directly to the trained
 * Ti-6Al-4V PINN, physical metallurgy, process regime classifier, and 6x6 OOD detector,
 * and computes screening-level distortion & residual stress hotspots (non-FEA).
 */

import { evaluateTi64Pinn } from '../ti64-pinn';
import { evaluateTi64Metallurgy, normalizePostProcessing } from '../ti64-metallurgy';
import { classifyProcessRegime } from '../regime-classifier';
import { evaluateOodRisk } from '../ood-detector';
import type { ParsedCadMesh } from './cad-parser';
import type { CadGeometryReport } from './geometry-analyzer';
import type { CadPrintabilityReport } from './printability-rules';
import type { MachinePreset } from './machine-presets';

export interface CadProcessParameters {
  alloyId?: string;
  P: number;
  v: number;
  h: number;
  t: number;
  T0: number;
  db?: number;
  postProcessing: string;
  oxygenWtPct?: number;
  buildOrientationDeg?: number;
  scanRotationDeg?: number;
}

export interface SimulatedLayerTelemetry {
  zMm: number;
  areaMm2: number;
  scanTimeSec: number;
  effectivePreheatC: number;
  coolingRateKs: number;
  alphaLathUm: number;
  ysMpa: number;
  utsMpa: number;
  elongPct: number;
  hv: number;
  oodDistance: number;
  regimeName: string;
}

export interface DistortionStressScreening {
  disclaimer: string;
  surfaceResidualStressMpa: number;
  asBuiltPeakStressMpa: number;
  warpingRiskScore: number; // 0..100
  estimatedMaxDeflectionUm: number;
  plateCutOffRisk: 'Low' | 'Moderate' | 'High';
  hotspotsSummary: string[];
  mitigations: string[];
}

export interface PartBuildSimulationReport {
  processId: string;
  alloyId: string;
  postProcessing: string;
  layerCount: number;
  maxEffectivePreheatC: number;
  minLayerYsMpa: number;
  minLayerUtsMpa: number;
  minLayerElongPct: number;
  meanLayerHv: number;
  weakestLayerZMm: number;
  maxOodDistance: number;
  anyLayerOod: boolean;
  astmStandard: 'ASTM F2924' | 'ASTM F3001' | 'ASTM F3187';
  astmPass: boolean;
  astmReason: string;
  layers: SimulatedLayerTelemetry[];
  distortionAndStress: DistortionStressScreening;
  perTriangleThermalHotspot: Float32Array; // Normalized 0..1 overheating risk
  perTriangleStressHotspot: Float32Array;  // Normalized 0..1 stress/distortion hotspot
}

function clampFinite(v: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
}

/**
 * Executes layer-by-layer heat accumulation + PINN & metallurgy evaluation across the CAD part.
 */
export function simulatePartBuild(
  mesh: ParsedCadMesh,
  geo: CadGeometryReport,
  printability: CadPrintabilityReport,
  params: CadProcessParameters,
  machine: MachinePreset
): PartBuildSimulationReport {
  const proc = machine.process;
  const alloyId = (params.alloyId || 'ti64_gr5').toLowerCase().includes('eli') ? 'ti64_eli' : 'ti64_gr5';
  const post = normalizePostProcessing(params.postProcessing || 'HIP');
  const P = clampFinite(params.P, 40, 8000, proc === 'waam' ? 2200 : (proc === 'ded-laser' ? 1500 : 280));
  const v = clampFinite(params.v, 2, 3500, proc === 'waam' ? 8 : (proc === 'ded-laser' ? 15 : 960));
  const h = clampFinite(params.h, 30, 6000, proc === 'waam' ? 3400 : (proc === 'ded-laser' ? 1100 : 110));
  const tUm = clampFinite(params.t, 15, 3000, proc === 'waam' ? 1400 : (proc === 'ded-laser' ? 450 : 40));
  const baseT0 = clampFinite(params.T0, 20, 500, proc === 'lpbf' ? 200 : 120);
  const db = clampFinite(params.db ?? (proc === 'waam' ? 3000 : (proc === 'ded-laser' ? 1500 : 80)), 25, 5000, 80);
  const o2 = clampFinite(params.oxygenWtPct ?? (alloyId === 'ti64_eli' ? 0.11 : 0.16), 0.08, 0.22, 0.16);
  const scanRot = params.scanRotationDeg === 90 ? 90 : 67;
  const oriDeg = params.buildOrientationDeg === 90 ? 90 : (params.buildOrientationDeg === 45 ? 45 : 0);

  const laserCount = Math.max(1, machine.laserCount || 1);
  const hMm = h * 1e-3;
  const recoatSec = proc === 'lpbf' ? 8.5 : 0.5;
  const ved = (P * 1e6) / Math.max(1, v * h * tUm);
  const heatInputJmm = P / Math.max(0.5, v);

  const slices = geo.layerSlices.length > 0
    ? geo.layerSlices
    : [{ zMm: Number((geo.boundingBox.size[2] * 0.5).toFixed(2)), areaMm2: Math.max(50, geo.boundingBox.size[0] * geo.boundingBox.size[1]), perimeterMm: 100, heatSinkRatio: 1.0 }];

  const layers: SimulatedLayerTelemetry[] = [];
  let rollingHeatRiseC = 0;

  let minYs = Infinity, minUts = Infinity, minEl = Infinity;
  let hvSum = 0, maxT0 = baseT0, weakestZ = slices[0].zMm, maxOod = 0;
  let anyOod = false;

  const t0Safe = Math.max(20, Math.min(500, baseT0));

  for (let idx = 0; idx < slices.length; idx++) {
    const sl = slices[idx];
    const effArea = Math.max(10, sl.areaMm2);
    const scanTimeSec = (effArea / Math.max(1e-3, v * hMm * laserCount)) + (sl.perimeterMm / Math.max(1, v * laserCount));
    const interlayerSec = scanTimeSec + recoatSec;

    // Interlayer heat accumulation: fast turnarounds & constricted heat-sink necks raise local T0_eff
    const fastTurnBoost = Math.max(0, 1.0 - interlayerSec / (proc === 'lpbf' ? 18.0 : 28.0));
    const neckBoost = sl.heatSinkRatio > 1.35 ? Math.min(1.0, (sl.heatSinkRatio - 1.0) * 0.35) : 0;
    const zInsul = Math.min(1.0, sl.zMm / 80.0);
    const targetHeatRise = (18 * fastTurnBoost + 45 * neckBoost + 22 * zInsul) * (proc === 'waam' ? 1.55 : (proc === 'ded-laser' ? 1.25 : 1.0));
    rollingHeatRiseC = 0.65 * rollingHeatRiseC + 0.35 * targetHeatRise;
    const effPreheatC = Number(Math.min(500, t0Safe + rollingHeatRiseC).toFixed(1));
    if (effPreheatC > maxT0) maxT0 = effPreheatC;

    const pinn = evaluateTi64Pinn({
      processId: proc, P, v, h, t: tUm, T0: effPreheatC, db,
      postProcessing: post, oxygenWtPct: o2,
      densityPct: Math.max(92, 99.7 - (geo.overhangFractionPct * 0.015)),
      buildOrientationDeg: oriDeg
    });

    const met = evaluateTi64Metallurgy({
      alloyId, processId: proc,
      coolingRateKs: pinn.meltPool.coolingRateKs,
      postProcessing: post,
      oxygenWtPct: o2,
      buildOrientationDeg: oriDeg,
      scanRotationDeg: scanRot,
      densityPct: 99.6
    });

    // Blend PINN microstructure prediction with Hall-Petch metallurgy for robust part response
    const ysMpa = Math.round(0.5 * pinn.metallurgy.yieldStrengthMpa + 0.5 * met.hallPetchYieldStrengthMpa);
    const utsMpa = Math.round(0.5 * pinn.metallurgy.utsMpa + 0.5 * met.predictedUtsMpa);
    const hv = Math.round(0.5 * pinn.metallurgy.predictedHv + 0.5 * met.predictedHv);
    const elongKnock = sl.heatSinkRatio >= 2.0 ? 0.94 : 1.0;
    const elongPct = Number(Math.max(1.5, Math.min(22.0, pinn.metallurgy.elongationPct * met.anisotropy.elongationFactor * elongKnock)).toFixed(1));

    const reg = classifyProcessRegime(proc, { P, v, h, t: tUm, T0: effPreheatC, db }, { ved, heatInput: heatInputJmm });
    const ood = evaluateOodRisk({ P, v, h, t: tUm, T0: effPreheatC, ved }, proc);
    if (ood.mahalanobisDistance > maxOod) maxOod = ood.mahalanobisDistance;
    if (ood.status === 'extrapolating') anyOod = true;

    if (ysMpa < minYs) { minYs = ysMpa; weakestZ = sl.zMm; }
    if (utsMpa < minUts) minUts = utsMpa;
    if (elongPct < minEl) { minEl = elongPct; weakestZ = sl.zMm; }
    hvSum += hv;

    layers.push({
      zMm: sl.zMm,
      areaMm2: sl.areaMm2,
      scanTimeSec: Number(scanTimeSec.toFixed(1)),
      effectivePreheatC: effPreheatC,
      coolingRateKs: pinn.meltPool.coolingRateKs,
      alphaLathUm: Number(pinn.metallurgy.alphaLathWidthUm.toFixed(2)),
      ysMpa,
      utsMpa,
      elongPct,
      hv,
      oodDistance: Number(ood.mahalanobisDistance.toFixed(2)),
      regimeName: reg.kpiBadgeLabel
    });
  }

  const minLayerYsMpa = Math.round(minYs);
  const minLayerUtsMpa = Math.round(minUts);
  const minLayerElongPct = Number(minEl.toFixed(1));
  const meanLayerHv = Math.round(hvSum / Math.max(1, layers.length));

  // ASTM standard mapping & part-level verdict
  const astmStandard: PartBuildSimulationReport['astmStandard'] =
    proc === 'waam' || proc === 'ded-laser' ? 'ASTM F3187' : (alloyId === 'ti64_eli' ? 'ASTM F3001' : 'ASTM F2924');
  const minYsReq = alloyId === 'ti64_eli' ? 795 : 825;
  const minUtsReq = alloyId === 'ti64_eli' ? 860 : 895;
  const minElReq = 10.0;
  const o2Max = alloyId === 'ti64_eli' ? 0.13 : 0.20;
  const o2Ok = o2 <= o2Max;

  const astmPass = minLayerYsMpa >= minYsReq && minLayerUtsMpa >= minUtsReq && minLayerElongPct >= minElReq && o2Ok && printability.wallCheckStatus !== 'Fail';
  const astmReason = astmPass
    ? `All ${layers.length} slices meet ${astmStandard} minimums (YS ≥ ${minYsReq} MPa, UTS ≥ ${minUtsReq} MPa, Elong ≥ 10%, O₂ ≤ ${o2Max} wt%).`
    : (minLayerElongPct < minElReq
        ? `Critical zone at Z=${weakestZ} mm fails ≥10% ductility (${minLayerElongPct}%); apply Annealing or HIP.`
        : (!o2Ok
            ? `Interstitial O₂ (${o2.toFixed(3)} wt%) exceeds ${astmStandard} ${o2Max} wt% limit.`
            : (printability.wallCheckStatus === 'Fail'
                ? `Thin feature (${geo.minWallThicknessMm} mm) violates process minimum resolution.`
                : `Weakest slice at Z=${weakestZ} mm below tensile requirement (${minLayerYsMpa}/${minLayerUtsMpa} MPa).`)));

  // Distortion & Residual Stress Screening (Non-FEA temperature-gradient-mechanism heuristic)
  const heightMm = geo.boundingBox.size[2];
  const minFoot = Math.max(1, Math.min(geo.boundingBox.size[0], geo.boundingBox.size[1]));
  const longSpanMm = Math.max(geo.boundingBox.size[0], geo.boundingBox.size[1]);
  const baseAsBuiltStress = Math.round(minLayerYsMpa * (proc === 'waam' ? 0.72 : (proc === 'ded-laser' ? 0.82 : 1.02)) * (1.0 + Math.min(0.28, geo.sharpConcaveCornerCount * 0.03) + Math.min(0.18, geo.abruptAreaJumpCount * 0.035)));
  const relaxFactor = post === 'HIP' ? 0.045 : (post === 'Annealed' ? 0.085 : (post === 'Stress-relieved' ? 0.14 : (post === 'Solution-Aged' ? 0.12 : 1.0)));
  const surfaceResidualStressMpa = Math.max(12, Math.round(baseAsBuiltStress * relaxFactor * (scanRot === 67 ? 0.93 : 1.04)));

  const slenderness = heightMm / minFoot;
  const rawWarp =
    (post === 'HIP' ? 12 : (post === 'Annealed' ? 20 : (post === 'Stress-relieved' ? 28 : 58))) +
    Math.min(18, geo.overhangFractionPct * 1.1) +
    Math.min(14, geo.abruptAreaJumpCount * 3.5) +
    Math.min(10, Math.max(0, slenderness - 1.0) * 5.0);
  const warpingRiskScore = Math.max(5, Math.min(98, Math.round(rawWarp)));
  const estimatedMaxDeflectionUm = Math.round((longSpanMm * 0.8 + heightMm * 0.5) * (surfaceResidualStressMpa / 450.0) * (1.0 + geo.overhangFractionPct / 40.0));
  const plateCutOffRisk: DistortionStressScreening['plateCutOffRisk'] =
    post === 'None' && surfaceResidualStressMpa > 400 ? 'High' : (warpingRiskScore >= 48 || surfaceResidualStressMpa > 120 ? 'Moderate' : 'Low');

  const hotspotsSummary: string[] = [];
  if (geo.sharpConcaveCornerCount > 0) hotspotsSummary.push(`${geo.sharpConcaveCornerCount} sharp concave corners concentrate tensile peel stress.`);
  if (geo.abruptAreaJumpCount > 0) hotspotsSummary.push(`${geo.abruptAreaJumpCount} abrupt slice area transitions drive differential contraction.`);
  if (geo.overhangFractionPct > 3) hotspotsSummary.push(`Overhanging regions (${geo.overhangFractionPct}%) experience reduced substrate heat sinking.`);
  if (hotspotsSummary.length === 0) hotspotsSummary.push('Uniform cross-section gives smooth thermal contraction without severe notches.');

  const mitigations: string[] = [];
  if (post === 'None') mitigations.push('Apply 650°C/2h stress relief (or HIP) BEFORE wire-EDM removal from baseplate.');
  if (scanRot !== 67) mitigations.push('Switch laser scan rotation from 90° to 67° alternating island vectors (~7% lower residual stress).');
  if (baseT0 < 180 && proc === 'lpbf') mitigations.push('Increase build plate preheat toward 200°C to reduce thermal gradient G.');
  if (mitigations.length === 0) mitigations.push('Current HIP / 67° rotation strategy already minimizes residual distortion.');

  // Paint per-triangle normalized 0..1 hotspot arrays cleanly for 3D viewer overlays
  const nTri = mesh.triangleCount;
  const pos = mesh.positions;
  const norm = mesh.normals;
  const zMin = mesh.boundingBox.min[2];
  const hSafe = Math.max(0.1, geo.boundingBox.size[2]);
  const perTriangleThermalHotspot = new Float32Array(nTri);
  const perTriangleStressHotspot = new Float32Array(nTri);

  for (let t = 0; t < nTri; t++) {
    const i = t * 9;
    const zc = (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3;
    const zFrac = clampFinite((zc - zMin) / hSafe, 0, 1, 0.5);
    const sliceIdx = Math.min(layers.length - 1, Math.max(0, Math.floor(zFrac * (layers.length - 1))));
    const lay = layers[sliceIdx];
    const tRiseNorm = clampFinite((lay.effectivePreheatC - t0Safe) / 140.0, 0, 1, 0);
    const ohBoost = geo.perTriangleOverhang[t] ? 0.35 : 0;
    const thinBoost = geo.perTriangleThicknessMm[t] > 0 && geo.perTriangleThicknessMm[t] < 1.5 ? 0.2 : 0;

    perTriangleThermalHotspot[t] = clampFinite(0.55 * tRiseNorm + ohBoost + thinBoost, 0, 1, 0.1);

    // Baseplate attachment & overhanging transitions + low Z sharp transitions hold highest peel stress
    const nearPlatePeak = zFrac < 0.12 ? 0.38 : 0.0;
    const jumpProximity = slices[sliceIdx] && (slices[sliceIdx].heatSinkRatio >= 1.8 || slices[sliceIdx].heatSinkRatio <= 0.55) ? 0.42 : 0.0;
    const stressScale = clampFinite(surfaceResidualStressMpa / 650.0, 0.15, 1.0, 0.3);
    const nzMag = Math.abs(norm[i + 2]);
    perTriangleStressHotspot[t] = clampFinite((nearPlatePeak + jumpProximity + ohBoost + (1 - nzMag) * 0.2) * stressScale, 0.05, 1.0, 0.2);
  }

  return {
    processId: proc,
    alloyId,
    postProcessing: post,
    layerCount: Math.max(1, Math.round(geo.boundingBox.size[2] / Math.max(0.01, tUm * 1e-3))),
    maxEffectivePreheatC: Number(maxT0.toFixed(1)),
    minLayerYsMpa,
    minLayerUtsMpa,
    minLayerElongPct,
    meanLayerHv,
    weakestLayerZMm: Number(weakestZ.toFixed(2)),
    maxOodDistance: Number(maxOod.toFixed(2)),
    anyLayerOod: anyOod,
    astmStandard,
    astmPass,
    astmReason,
    layers,
    distortionAndStress: {
      disclaimer: 'Screening estimate from geometry & thermal gradients (not full thermo-mechanical FEA).',
      surfaceResidualStressMpa,
      asBuiltPeakStressMpa: baseAsBuiltStress,
      warpingRiskScore,
      estimatedMaxDeflectionUm,
      plateCutOffRisk,
      hotspotsSummary,
      mitigations
    },
    perTriangleThermalHotspot,
    perTriangleStressHotspot
  };
}
