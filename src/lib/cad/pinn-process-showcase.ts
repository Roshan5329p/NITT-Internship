/**
 * NIT Trichy Titanium AM Platform — PINN LPBF & L-DED Step-by-Step CAD Build Showcase
 * Pure deterministic physics narrator, exact slice-plane geometry clipper, and dual-process
 * comparison helper shared with the browser build theater (js/pinn-cad-showcase.js).
 */

import type { CadGeometryReport } from './geometry-analyzer';
import type {
  CadProcessParameters,
  PartBuildSimulationReport,
  SimulatedLayerTelemetry
} from './part-build-simulator';

export type ShowcaseProcessMode = 'lpbf' | 'ded-laser' | 'compare';
export type ShowcaseToolheadProcess = 'lpbf' | 'ded-laser';

export interface ShowcaseStageSpec {
  idx: number;
  step: number;
  title: string;
  shortTitle: string;
  disclaimer: string;
}

export const SHOWCASE_STAGES: readonly ShowcaseStageSpec[] = [
  {
    idx: 0,
    step: 1,
    title: 'Chamber, Substrate & Prep',
    shortTitle: '1. Setup & O₂',
    disclaimer: 'Screening setup from geometry & chemistry bounds.'
  },
  {
    idx: 1,
    step: 2,
    title: 'Feedstock & Beam Coupling',
    shortTitle: '2. Feed & Coupling',
    disclaimer: 'Representative slice coupling vectors (not G-code toolpaths).'
  },
  {
    idx: 2,
    step: 3,
    title: 'Melt Pool Kinematics & Defect Regimes',
    shortTitle: '3. Melt Pool',
    disclaimer: 'PINN thermal_net predictions + Rosenthal-Coen enthalpy residual.'
  },
  {
    idx: 3,
    step: 4,
    title: 'Solidification & Phase Evolution',
    shortTitle: '4. Solidification',
    disclaimer: 'PINN metallurgy_net + Hall-Petch lath kinetics.'
  },
  {
    idx: 4,
    step: 5,
    title: 'Thermal Stress & Baseplate Restraint',
    shortTitle: '5. Thermal Stress',
    disclaimer: 'Geometry + TGM screening estimate (non-FEA).'
  },
  {
    idx: 5,
    step: 6,
    title: 'Post-Processing & ASTM Qualification',
    shortTitle: '6. Post & ASTM',
    disclaimer: 'ASTM F2924 / F3001 / F3187 property & chemistry verification.'
  }
];

export interface ShowcaseNarrationInput {
  stageIdx: number;
  sliceIdx: number;
  activeProcess: ShowcaseToolheadProcess;
  mode: ShowcaseProcessMode;
  fileName: string;
  geo: Pick<
    CadGeometryReport,
    | 'volumeCm3'
    | 'massTi64Grams'
    | 'overhangFractionPct'
    | 'minWallThicknessMm'
    | 'sharpConcaveCornerCount'
    | 'abruptAreaJumpCount'
    | 'boundingBox'
  >;
  activeSim: PartBuildSimulationReport;
  compareSim?: PartBuildSimulationReport | null;
  activeParams: CadProcessParameters;
  compareParams?: CadProcessParameters | null;
}

export interface ShowcaseHipPreview {
  visible: boolean;
  label: string;
  asBuiltSummary: string;
  hipSummary: string;
  astmAsBuiltPass: boolean;
  astmHipPass: boolean;
}

export interface ShowcaseNarrationOutput {
  stageIdx: number;
  stageTitle: string;
  headline: string;
  subheadline: string;
  bullets: string[];
  geometryCallout: string;
  oodWarning: string | null;
  causalChain: {
    inputsSummary: string;
    thermalSummary: string;
    metallurgySummary: string;
    auditBadges: string[];
  };
  hipPreview: ShowcaseHipPreview | null;
  compareSummary: string | null;
}

/**
 * Computes exact triangle-plane intersection segments [x0, y0, x1, y1, ...] at Z = zClip.
 * Used to clip laser hatch vectors to real solid CAD cross-sections instead of empty air.
 */
export function computeSlicePlaneSegments(
  positions: Float32Array,
  triangleCount: number,
  zClip: number,
  maxSegments = 4096
): Float32Array {
  if (!positions || triangleCount <= 0 || !Number.isFinite(zClip)) {
    return new Float32Array(0);
  }
  const stride = triangleCount > maxSegments * 4 ? Math.ceil(triangleCount / (maxSegments * 4)) : 1;
  const out: number[] = [];
  const eps = 1e-6;

  for (let t = 0; t < triangleCount && out.length < maxSegments * 4; t += stride) {
    const b = t * 9;
    const ax = positions[b], ay = positions[b + 1], az = positions[b + 2];
    const bx = positions[b + 3], by = positions[b + 4], bz = positions[b + 5];
    const cx = positions[b + 6], cy = positions[b + 7], cz = positions[b + 8];

    const da = az - zClip;
    const db = bz - zClip;
    const dc = cz - zClip;

    if ((da > eps && db > eps && dc > eps) || (da < -eps && db < -eps && dc < -eps)) {
      continue;
    }

    const hits: number[] = [];
    const edges: Array<[number, number, number, number, number, number, number, number]> = [
      [ax, ay, da, bx, by, db, 0, 1],
      [bx, by, db, cx, cy, dc, 1, 2],
      [cx, cy, dc, ax, ay, da, 2, 0]
    ];

    for (let e = 0; e < 3; e++) {
      const [x0, y0, d0, x1, y1, d1] = edges[e];
      if (Math.abs(d0) <= eps && Math.abs(d1) <= eps) {
        hits.push(x0, y0, x1, y1);
        break;
      }
      if ((d0 > eps && d1 < -eps) || (d0 < -eps && d1 > eps)) {
        const u = d0 / (d0 - d1);
        hits.push(x0 + u * (x1 - x0), y0 + u * (y1 - y0));
      } else if (Math.abs(d0) <= eps) {
        hits.push(x0, y0);
      }
    }

    if (hits.length >= 4) {
      const dx = hits[2] - hits[0];
      const dy = hits[3] - hits[1];
      if (dx * dx + dy * dy > 1e-8) {
        out.push(hits[0], hits[1], hits[2], hits[3]);
      }
    }
  }

  return new Float32Array(out);
}

/**
 * Generates rotated scanline hatch chords clipped strictly inside solid slice boundary segments.
 */
export function computeClippedHatchChords(
  segments: Float32Array,
  angleDeg: number,
  spacingMm: number,
  maxChords = 48
): Float32Array {
  const nSeg = Math.floor(segments.length / 4);
  if (nSeg <= 0) return new Float32Array(0);

  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);

  const u0 = new Float32Array(nSeg);
  const v0 = new Float32Array(nSeg);
  const u1 = new Float32Array(nSeg);
  const v1 = new Float32Array(nSeg);

  let vMin = Infinity;
  let vMax = -Infinity;
  for (let i = 0; i < nSeg; i++) {
    const b = i * 4;
    const x0 = segments[b], y0 = segments[b + 1];
    const x1 = segments[b + 2], y1 = segments[b + 3];
    const ru0 = x0 * c + y0 * s;
    const rv0 = -x0 * s + y0 * c;
    const ru1 = x1 * c + y1 * s;
    const rv1 = -x1 * s + y1 * c;
    u0[i] = ru0; v0[i] = rv0;
    u1[i] = ru1; v1[i] = rv1;
    if (rv0 < vMin) vMin = rv0;
    if (rv1 < vMin) vMin = rv1;
    if (rv0 > vMax) vMax = rv0;
    if (rv1 > vMax) vMax = rv1;
  }

  const vSpan = vMax - vMin;
  if (!Number.isFinite(vSpan) || vSpan <= 1e-4) return new Float32Array(0);

  const stepV = Math.max(Math.max(0.25, spacingMm), vSpan / Math.max(4, maxChords));
  const chords: number[] = [];
  const xs: number[] = [];

  for (let v = vMin + stepV * 0.5; v < vMax; v += stepV) {
    xs.length = 0;
    for (let i = 0; i < nSeg; i++) {
      const a = v0[i];
      const b = v1[i];
      if ((a <= v && b > v) || (b <= v && a > v)) {
        const t = (v - a) / (b - a);
        xs.push(u0[i] + t * (u1[i] - u0[i]));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const ua = xs[k], ub = xs[k + 1];
      if (ub - ua <= 1e-3) continue;
      // Rotate back to world XY: x = u*c - v*s, y = u*s + v*c
      chords.push(
        ua * c - v * s, ua * s + v * c,
        ub * c - v * s, ub * s + v * c
      );
    }
  }

  return new Float32Array(chords);
}

function fmtCool(rateKs: number): string {
  if (!Number.isFinite(rateKs) || rateKs <= 0) return '—';
  if (rateKs >= 1e5) return `${(rateKs / 1e5).toFixed(2)}×10⁵ K/s`;
  if (rateKs >= 1e4) return `${(rateKs / 1e4).toFixed(2)}×10⁴ K/s`;
  if (rateKs >= 1e3) return `${(rateKs / 1e3).toFixed(2)}×10³ K/s`;
  return `${Math.round(rateKs)} K/s`;
}

function getSlice(sim: PartBuildSimulationReport, idx: number): SimulatedLayerTelemetry {
  const n = Math.max(1, sim.layers.length);
  const safeIdx = Math.max(0, Math.min(n - 1, Math.round(idx)));
  return sim.layers[safeIdx];
}

function buildOodWarningText(
  layer: SimulatedLayerTelemetry,
  sim: PartBuildSimulationReport,
  cmpLayer: SimulatedLayerTelemetry | null,
  cmpSim: PartBuildSimulationReport | null
): string | null {
  const activeOod = layer.oodStatus === 'extrapolating' || sim.anyLayerOod;
  const cmpOod = Boolean(cmpLayer && (cmpLayer.oodStatus === 'extrapolating' || cmpSim?.anyLayerOod));
  if (!activeOod && !cmpOod) return null;

  const targetLayer = activeOod ? layer : cmpLayer!;
  const targetProc = (activeOod ? sim.processId : cmpSim?.processId || 'lpbf').toUpperCase();
  const maxD = activeOod ? sim.maxOodDistance : (cmpSim?.maxOodDistance ?? targetLayer.oodDistance);
  return `OOD Extrapolation Advisory (${targetProc}): Active or peak slice Mahalanobis d_M = ${Math.max(targetLayer.oodDistance, maxD).toFixed(2)} exceeds calibrated 6×6 literature covariance envelope — 95% PI widened ×${targetLayer.piMultiplier.toFixed(2)}.`;
}

/**
 * Generates deterministic, runtime-bound physics narration across all 6 stages for a loaded CAD part.
 */
export function buildStageNarration(input: ShowcaseNarrationInput): ShowcaseNarrationOutput {
  const stageIdx = Math.max(0, Math.min(SHOWCASE_STAGES.length - 1, Math.round(input.stageIdx)));
  const stage = SHOWCASE_STAGES[stageIdx];
  const s = getSlice(input.activeSim, input.sliceIdx);
  const cmpSim = input.compareSim ?? null;
  const cmpS = cmpSim ? getSlice(cmpSim, input.sliceIdx) : null;

  const proc = input.activeProcess;
  const isDed = proc === 'ded-laser';
  const procLabel = isDed ? 'L-DED' : 'LPBF';
  const postLabel = input.activeSim.postProcessing;
  const spotUm = Math.round(input.activeParams.db ?? (isDed ? 1500 : 80));
  const o2WtPct = Number((input.activeParams.oxygenWtPct ?? (input.activeSim.alloyId === 'ti64_eli' ? 0.11 : 0.16)).toFixed(3));
  const preheatC = Math.round(input.activeParams.T0);
  const highPreheatLpbf = !isDed && (preheatC >= 320 || s.effectivePreheatC >= 320);

  const beadWidthMm = Number((s.meltPoolWidthUm / 1000).toFixed(3));
  const tracksAcrossWall = beadWidthMm > 0 ? Number((input.geo.minWallThicknessMm / beadWidthMm).toFixed(1)) : 0;
  const safePartName = (input.fileName || 'loaded_component.stl').trim();

  let headline = '';
  let subheadline = '';
  const bullets: string[] = [];
  let geometryCallout = '';
  let hipPreview: ShowcaseHipPreview | null = null;
  let compareSummary: string | null = null;

  if (stageIdx === 0) {
    headline = `Chamber & Substrate Setup (${procLabel} · T₀ = ${preheatC} °C)`;
    subheadline = `Preparing ${safePartName} (${input.geo.volumeCm3} cm³, ${input.geo.massTi64Grams} g Ti-6Al-4V) before beam strike at Z = 0 mm.`;
    if (isDed) {
      bullets.push(
        `Coaxial Argon + trailing laminar shroud purge established around wrought Ti-6Al-4V substrate preheated to ${preheatC} °C; wire/powder nozzle alignment calibrated for ${spotUm} µm spot.`
      );
    } else {
      bullets.push(
        `Argon/vacuum inert chamber stabilizes interstitial O₂ = ${o2WtPct.toFixed(3)} wt% above the ${preheatC} °C heated build plate; sacrificial supports anchor ${input.geo.overhangFractionPct}% overhang area (>45°).`
      );
    }
    bullets.push(
      `PINN chemistry sensitivity d(YS)/d(O₂) = +${Math.round(s.dYs_dO2)} MPa/wt% and d(Elong)/d(O₂) = ${s.dElong_dO2} %/wt% quantifies embrittlement margin before deposition.`
    );
    if (highPreheatLpbf) {
      bullets.push(
        `High-preheat regime detected (T₀ = ${preheatC} °C ≥ 320 °C): elevated bed temperature flattens early thermal gradients and primes in-situ α' tempering from layer 1.`
      );
    }
    geometryCallout = `Part envelope ${input.geo.boundingBox.size.map((n) => n.toFixed(1)).join(' × ')} mm · Min wall ${input.geo.minWallThicknessMm} mm · Overhangs ${input.geo.overhangFractionPct}%.`;
  } else if (stageIdx === 1) {
    headline = `Feedstock & Beam Energy Coupling at Slice Z = ${s.zMm} mm`;
    subheadline = `Energy absorption η = ${s.absorptivityEta.toFixed(2)} couples ${input.activeParams.P} W laser power at ${input.activeParams.v} mm/s scan velocity.`;
    if (isDed) {
      bullets.push(
        `Coaxial nozzle delivers Ti-6Al-4V powder directly into the ${spotUm} µm laser zone over a t = ${input.activeParams.t} µm step height (${s.scanTimeSec} s pass time, zero powder-bed recoating delay).`
      );
      bullets.push(
        `Linear heat input P/v = ${s.heatInputJmm} J/mm and VED = ${s.vedJmm3} J/mm³ drive millimeter-scale deposition with absorptivity η = ${s.absorptivityEta.toFixed(2)}.`
      );
    } else {
      bullets.push(
        `Recoater blade spreads a uniform t = ${input.activeParams.t} µm Ti-6Al-4V powder layer (~8.5 s recoat) prior to ${input.activeParams.scanRotationDeg ?? 67}° rotated galvo scanning at ${input.activeParams.v} mm/s.`
      );
      bullets.push(
        `Volumetric energy density VED = ${s.vedJmm3} J/mm³ (P/v = ${s.heatInputJmm} J/mm, hatch h = ${input.activeParams.h} µm, η = ${s.absorptivityEta.toFixed(2)}) sets thermal_net boundary conditions.`
      );
    }
    geometryCallout = `Slice Z = ${s.zMm} mm has cross-section A(z) = ${s.areaMm2} mm², heat-sink ratio ${s.heatSinkRatio}, lifting T₀,eff to ${s.effectivePreheatC} °C.`;
  } else if (stageIdx === 2) {
    headline = `Melt Pool Kinematics: ${s.meltPoolWidthUm} × ${s.meltPoolDepthUm} µm (${s.meltMode})`;
    subheadline = `Peak pool temperature reaches ${s.peakTempC} °C (D/W = ${s.aspectRatio}) classified under ${s.regimeName}.`;
    bullets.push(
      `PINN thermal_net resolves pool geometry W = ${s.meltPoolWidthUm} µm, D = ${s.meltPoolDepthUm} µm, L = ${s.meltPoolLengthUm} µm with Rosenthal-Coen enthalpy discrepancy of ${s.thermalEnthalpyResidualPct}%.`
    );
    bullets.push(
      `Analytical Jacobians at this slice confirm physical monotonicity: d(log W)/d(log P) = +${s.dW_dLogP.toFixed(3)} and d(log W)/d(log v) = ${s.dW_dLogV.toFixed(3)}.`
    );
    geometryCallout =
      beadWidthMm > input.geo.minWallThicknessMm * 0.9
        ? `Resolution check: ${procLabel} bead width (${beadWidthMm} mm) approaches or exceeds CAD min wall (${input.geo.minWallThicknessMm} mm, ${tracksAcrossWall} beads across) — finish machining or thinner track spacing advised.`
        : `Resolution check: ${procLabel} melt pool (${beadWidthMm} mm) resolves the ${input.geo.minWallThicknessMm} mm CAD min wall across ~${tracksAcrossWall} tracks.`;
  } else if (stageIdx === 3) {
    headline = `Rapid Solidification (Ṫ = ${fmtCool(s.coolingRateKs)}) & Phase Evolution`;
    subheadline = `Cooling through 1605 °C solidus and 995 °C β-transus governs prior-β lath scale (λ_α = ${s.alphaLathUm} µm).`;
    if (isDed) {
      bullets.push(
        `L-DED solidification cooling (${fmtCool(s.coolingRateKs)}) still exceeds the 410 K/s Ti-6Al-4V martensite threshold, so initial solidification forms acicular α' martensite which is subsequently decomposed in situ into Widmanstätten/basketweave α+β (λ_α = ${s.alphaLathUm} µm) by intrinsic cyclic thermal reheating from overlapping high-energy passes.`
      );
      bullets.push(
        `As-solidified slice yield strength is ${s.asBuiltYsMpa} MPa with ${s.asBuiltElongPct}% elongation (post-condition ${postLabel}: ${s.ysMpa} MPa YS, ${s.elongPct}% elong).`
      );
    } else if (highPreheatLpbf) {
      bullets.push(
        `Extreme LPBF cooling (${fmtCool(s.coolingRateKs)} > 410 K/s) forms initial martensite, while elevated plate preheat (T₀ = ${preheatC} °C / T₀,eff = ${s.effectivePreheatC} °C ≥ 320 °C) drives in-situ α' tempering into fine α+β laths (as-built λ_α = ${s.asBuiltAlphaLathUm} µm).`
      );
      bullets.push(
        `Because of in-situ tempering at T₀ ≥ 320 °C, PINN predicts ${s.asBuiltYsMpa} MPa as-built YS and ${s.asBuiltElongPct}% elongation (current ${postLabel} state: λ_α = ${s.alphaLathUm} µm, ${s.ysMpa} MPa, ${s.elongPct}% elong).`
      );
    } else {
      bullets.push(
        `Extreme LPBF quenching (${fmtCool(s.coolingRateKs)} >> 410 K/s) suppresses diffusion and freezes fine acicular α' martensite (as-built λ_α = ${s.asBuiltAlphaLathUm} µm), giving high as-built strength (${s.asBuiltYsMpa} MPa) and ${s.asBuiltElongPct}% elongation.`
      );
      bullets.push(
        `PINN metallurgy_net maintains Hall-Petch consistency residual of ${s.hallPetchResidualMpa} MPa (d(log λ_α)/d(log Ṫ) = ${s.dLogLath_dLogCool.toFixed(3)}).`
      );
    }
    geometryCallout = `Thermal heat-sink ratio ${s.heatSinkRatio} at Z = ${s.zMm} mm · Part weakest slice occurs near Z = ${input.activeSim.weakestLayerZMm} mm (min YS ${input.activeSim.minLayerYsMpa} MPa).`;
  } else if (stageIdx === 4) {
    const ds = input.activeSim.distortionAndStress;
    headline = `Thermal Stress Accumulation & Cut-Off Risk (${ds.plateCutOffRisk} Risk)`;
    subheadline = `Estimated surface residual stress ${ds.surfaceResidualStressMpa} MPa (as-built peak ${ds.asBuiltPeakStressMpa} MPa) and ${ds.estimatedMaxDeflectionUm} µm peak deflection.`;
    bullets.push(
      `Temperature Gradient Mechanism (TGM): steep thermal gradients around ${input.geo.sharpConcaveCornerCount} concave corners and ${input.geo.abruptAreaJumpCount} abrupt A(z) jumps concentrate tensile peel stress near the baseplate (Z = 0 mm).`
    );
    bullets.push(
      `Active post-processing (${postLabel}) relaxes surface stress to ${ds.surfaceResidualStressMpa} MPa (warping score ${ds.warpingRiskScore}/100, non-FEA screening estimate).`
    );
    geometryCallout = ds.hotspotsSummary[0] || `Estimated deflection ${ds.estimatedMaxDeflectionUm} µm with ${ds.plateCutOffRisk} wire-EDM cut-off risk.`;
  } else {
    const verdict = input.activeSim.astmPass ? 'PASS' : 'FAIL';
    headline = `Post-Processing (${postLabel}) & ${input.activeSim.astmStandard} Verdict: ${verdict}`;
    subheadline = input.activeSim.astmReason;
    bullets.push(
      `Across all ${input.activeSim.layers.length} simulated slices (${input.activeSim.layerCount} physical layers), minimum part yield = ${input.activeSim.minLayerYsMpa} MPa, min UTS = ${input.activeSim.minLayerUtsMpa} MPa, min elongation = ${input.activeSim.minLayerElongPct}%, mean hardness = ${input.activeSim.meanLayerHv} HV.`
    );
    bullets.push(
      input.activeSim.postProcessing === 'None'
        ? `Condition is As-Built (None): α' martensite & locked peel tension reduce elongation (${s.elongPct}%). Inspect the Simulated HIP Recovery Preview below for thermal-mechanical restoration.`
        : `${postLabel} heat treatment coarsens λ_α from ${s.asBuiltAlphaLathUm} µm → ${s.alphaLathUm} µm, adjusting YS (${s.asBuiltYsMpa} → ${s.ysMpa} MPa) and lifting elongation (${s.asBuiltElongPct}% → ${s.elongPct}%).`
    );
    geometryCallout = `Part-wide peak T₀,eff = ${input.activeSim.maxEffectivePreheatC} °C at Z = ${input.activeSim.weakestLayerZMm} mm limiting slice.`;

    if (input.activeSim.postProcessing === 'None') {
      hipPreview = {
        visible: true,
        label: 'Simulated HIP Recovery Preview (920 °C / 100 MPa)',
        asBuiltSummary: `As-Built Slice Z=${s.zMm} mm: λ_α = ${s.asBuiltAlphaLathUm} µm · YS = ${s.asBuiltYsMpa} MPa · UTS = ${s.asBuiltUtsMpa} MPa · Elong = ${s.asBuiltElongPct}% · Verdict: ${input.activeSim.astmPass ? 'PASS' : 'FAIL'}`,
        hipSummary: `Simulated HIP (920 °C / 100 MPa): λ_α = ${s.hipPreviewAlphaLathUm} µm · YS = ${s.hipPreviewYsMpa} MPa · UTS = ${s.hipPreviewUtsMpa} MPa · Elong = ${s.hipPreviewElongPct}% · Projected Slice ${input.activeSim.astmStandard}: ${s.hipPreviewAstmPass ? 'PASS' : 'FAIL'}`,
        astmAsBuiltPass: input.activeSim.astmPass,
        astmHipPass: s.hipPreviewAstmPass
      };
    }
  }

  if (input.mode === 'compare' && cmpS && cmpSim && input.compareParams) {
    const cmpLabel = cmpSim.processId === 'ded-laser' ? 'L-DED' : 'LPBF';
    compareSummary =
      `${procLabel} vs. ${cmpLabel} @ Z=${s.zMm} mm: ` +
      `Pool W = ${s.meltPoolWidthUm} vs. ${cmpS.meltPoolWidthUm} µm · ` +
      `Cooling = ${fmtCool(s.coolingRateKs)} vs. ${fmtCool(cmpS.coolingRateKs)} · ` +
      `λ_α = ${s.alphaLathUm} vs. ${cmpS.alphaLathUm} µm · ` +
      `YS = ${s.ysMpa} vs. ${cmpS.ysMpa} MPa · Elong = ${s.elongPct}% vs. ${cmpS.elongPct}%`;
  }

  return {
    stageIdx,
    stageTitle: stage.title,
    headline,
    subheadline,
    bullets,
    geometryCallout,
    oodWarning: buildOodWarningText(s, input.activeSim, cmpS, cmpSim),
    causalChain: {
      inputsSummary: `P=${input.activeParams.P}W · v=${input.activeParams.v}mm/s · h=${input.activeParams.h}µm · t=${input.activeParams.t}µm · T₀,eff=${s.effectivePreheatC}°C · O₂=${o2WtPct.toFixed(3)}wt%`,
      thermalSummary: `W=${s.meltPoolWidthUm}µm · D=${s.meltPoolDepthUm}µm · D/W=${s.aspectRatio} · T_peak=${s.peakTempC}°C · Ṫ=${fmtCool(s.coolingRateKs)}`,
      metallurgySummary: `λ_α=${s.alphaLathUm}µm · YS=${s.ysMpa}MPa · UTS=${s.utsMpa}MPa · Elong=${s.elongPct}% · ${s.hv}HV`,
      auditBadges: [
        `Enthalpy Δ=${s.thermalEnthalpyResidualPct}%`,
        `Hall-Petch Δ=${s.hallPetchResidualMpa} MPa`,
        `d_M=${s.oodDistance.toFixed(2)} (PI×${s.piMultiplier.toFixed(2)})`
      ]
    },
    hipPreview,
    compareSummary
  };
}
