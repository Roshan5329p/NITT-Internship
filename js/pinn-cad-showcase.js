/**
 * NIT Trichy Titanium AM Platform — Interactive PINN LPBF & L-DED Build Showcase
 * Deferred browser controller + slice-accurate 3D build overlay + 2D melt pool inset.
 * Core geometry clipping & stage narration mirror src/lib/cad/pinn-process-showcase.ts.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PinnCadShowcase = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SHOWCASE_STAGES = Object.freeze([
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
  ]);

  function clampFinite(v, min, max, fallback) {
    return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  }

  function computeSlicePlaneSegments(positions, triangleCount, zClip, maxSegments = 4096) {
    if (!positions || triangleCount <= 0 || !Number.isFinite(zClip)) {
      return new Float32Array(0);
    }
    const stride = triangleCount > maxSegments * 4 ? Math.ceil(triangleCount / (maxSegments * 4)) : 1;
    const out = [];
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

      const hits = [];
      const edges = [
        [ax, ay, da, bx, by, db],
        [bx, by, db, cx, cy, dc],
        [cx, cy, dc, ax, ay, da]
      ];

      for (let e = 0; e < 3; e++) {
        const edge = edges[e];
        const x0 = edge[0], y0 = edge[1], d0 = edge[2], x1 = edge[3], y1 = edge[4], d1 = edge[5];
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

  function computeClippedHatchChords(segments, angleDeg, spacingMm, maxChords = 48) {
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
    const chords = [];
    const xs = [];

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
        chords.push(
          ua * c - v * s, ua * s + v * c,
          ub * c - v * s, ub * s + v * c
        );
      }
    }

    return new Float32Array(chords);
  }

  function fmtCool(rateKs) {
    if (!Number.isFinite(rateKs) || rateKs <= 0) return '—';
    if (rateKs >= 1e5) return `${(rateKs / 1e5).toFixed(2)}×10⁵ K/s`;
    if (rateKs >= 1e4) return `${(rateKs / 1e4).toFixed(2)}×10⁴ K/s`;
    if (rateKs >= 1e3) return `${(rateKs / 1e3).toFixed(2)}×10³ K/s`;
    return `${Math.round(rateKs)} K/s`;
  }

  function getSlice(sim, idx) {
    const n = Math.max(1, sim.layers.length);
    const safeIdx = Math.max(0, Math.min(n - 1, Math.round(idx)));
    return sim.layers[safeIdx];
  }

  function buildOodWarningText(layer, sim, cmpLayer, cmpSim) {
    const activeOod = layer.oodStatus === 'extrapolating' || sim.anyLayerOod;
    const cmpOod = Boolean(cmpLayer && (cmpLayer.oodStatus === 'extrapolating' || (cmpSim && cmpSim.anyLayerOod)));
    if (!activeOod && !cmpOod) return null;

    const targetLayer = activeOod ? layer : cmpLayer;
    const targetProc = (activeOod ? sim.processId : ((cmpSim && cmpSim.processId) || 'lpbf')).toUpperCase();
    const maxD = activeOod ? sim.maxOodDistance : ((cmpSim && cmpSim.maxOodDistance) || targetLayer.oodDistance);
    return `OOD Extrapolation Advisory (${targetProc}): Active or peak slice Mahalanobis d_M = ${Math.max(targetLayer.oodDistance, maxD).toFixed(2)} exceeds calibrated 6×6 literature covariance envelope — 95% PI widened ×${targetLayer.piMultiplier.toFixed(2)}.`;
  }

  function buildStageNarration(input) {
    const stageIdx = Math.max(0, Math.min(SHOWCASE_STAGES.length - 1, Math.round(input.stageIdx)));
    const stage = SHOWCASE_STAGES[stageIdx];
    const s = getSlice(input.activeSim, input.sliceIdx);
    const cmpSim = input.compareSim || null;
    const cmpS = cmpSim ? getSlice(cmpSim, input.sliceIdx) : null;

    const proc = input.activeProcess;
    const isDed = proc === 'ded-laser';
    const procLabel = isDed ? 'L-DED' : 'LPBF';
    const postLabel = input.activeSim.postProcessing;
    const spotUm = Math.round(input.activeParams.db != null ? input.activeParams.db : (isDed ? 1500 : 80));
    const o2WtPct = Number((input.activeParams.oxygenWtPct != null ? input.activeParams.oxygenWtPct : (input.activeSim.alloyId === 'ti64_eli' ? 0.11 : 0.16)).toFixed(3));
    const preheatC = Math.round(input.activeParams.T0);
    const highPreheatLpbf = !isDed && (preheatC >= 320 || s.effectivePreheatC >= 320);

    const beadWidthMm = Number((s.meltPoolWidthUm / 1000).toFixed(3));
    const tracksAcrossWall = beadWidthMm > 0 ? Number((input.geo.minWallThicknessMm / beadWidthMm).toFixed(1)) : 0;
    const safePartName = String(input.fileName || 'loaded_component.stl').trim();

    let headline = '';
    let subheadline = '';
    const bullets = [];
    let geometryCallout = '';
    let hipPreview = null;
    let compareSummary = null;

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
      const bbSize = (input.geo && input.geo.boundingBox && input.geo.boundingBox.size) ? input.geo.boundingBox.size : [0, 0, 0];
      geometryCallout = `Part envelope ${bbSize.map((n) => Number(n || 0).toFixed(1)).join(' × ')} mm · Min wall ${input.geo.minWallThicknessMm} mm · Overhangs ${input.geo.overhangFractionPct}%.`;
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
          `Recoater blade spreads a uniform t = ${input.activeParams.t} µm Ti-6Al-4V powder layer (~8.5 s recoat) prior to ${input.activeParams.scanRotationDeg || 67}° rotated galvo scanning at ${input.activeParams.v} mm/s.`
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
          `Analytical Jacobians at this slice confirm physical monotonicity: d(log W)/d(log P) = +${Number(s.dW_dLogP || 0).toFixed(3)} and d(log W)/d(log v) = ${Number(s.dW_dLogV || 0).toFixed(3)}.`
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
          `PINN metallurgy_net maintains Hall-Petch consistency residual of ${s.hallPetchResidualMpa} MPa (d(log λ_α)/d(log Ṫ) = ${Number(s.dLogLath_dLogCool || 0).toFixed(3)}).`
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

  // ---- Browser Showcase State & Dual-Process Simulator Adapter ----

  const state = {
    stageIdx: 0,
    sliceIdx: 0,
    mode: 'compare',
    toolheadProcess: 'lpbf',
    isPlaying: false,
    speed: 1.0,
    rafId: null,
    rafTickCount: 0,
    lastFrameMs: 0,
    scanPhase: 0,
    stageProgress: 0,
    reducedMotion: false
  };

  let cache = {
    lpbfSim: null,
    ldedSim: null,
    lpbfParams: null,
    ldedParams: null,
    meshRef: null,
    geoRef: null,
    segMesh: null,
    segZ: NaN,
    segments: null,
    chordZ: NaN,
    chordAngle: NaN,
    chordSpacing: NaN,
    chords: null
  };

  function isReducedMotion() {
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function readLiveSliderParams(procOverride) {
    const numOr = (val, fb) => (Number.isFinite(val) ? val : fb);
    const activeProc = String(
      procOverride || (typeof currentProcess !== 'undefined' ? currentProcess : 'lpbf')
    ).toLowerCase();
    const isDed = activeProc === 'ded-laser';
    const isWaam = activeProc === 'waam';
    const alloyId = (document.getElementById('alloySelect') && document.getElementById('alloySelect').value) || 'ti64_gr5';
    const postProcessing = (document.getElementById('postProcessingSelect') && document.getElementById('postProcessingSelect').value) || 'HIP';
    const oriRaw = parseInt((document.getElementById('buildOrientationSelect') && document.getElementById('buildOrientationSelect').value) || '0', 10);
    const scanRaw = parseInt((document.getElementById('scanRotationSelect') && document.getElementById('scanRotationSelect').value) || '67', 10);

    return {
      processId: isDed ? 'ded-laser' : (isWaam ? 'waam' : 'lpbf'),
      alloyId,
      postProcessing,
      P: numOr(parseFloat(document.getElementById('sl_p')?.value), isDed ? 1500 : 280),
      v: numOr(parseFloat(document.getElementById('sl_v')?.value), isDed ? 15 : 960),
      h: numOr(parseFloat(document.getElementById('sl_h')?.value), isDed ? 1100 : 110),
      t: numOr(parseFloat(document.getElementById('sl_t')?.value), isDed ? 450 : 40),
      db: numOr(parseFloat(document.getElementById('sl_spot')?.value), isDed ? 1500 : 80),
      T0: numOr(parseFloat(document.getElementById('sl_preheat')?.value), isDed ? 120 : 200),
      oxygenWtPct: numOr(parseFloat(document.getElementById('sl_oxygen')?.value), alloyId.includes('eli') ? 0.11 : 0.16),
      buildOrientationDeg: Number.isFinite(oriRaw) ? oriRaw : 0,
      scanRotationDeg: scanRaw === 90 ? 90 : 67
    };
  }

  function buildReferenceParams(targetProc, shared) {
    if (targetProc === 'ded-laser') {
      return {
        processId: 'ded-laser',
        alloyId: shared.alloyId,
        postProcessing: shared.postProcessing,
        P: 1500,
        v: 15,
        h: 1100,
        t: 450,
        db: 1500,
        T0: 120,
        oxygenWtPct: shared.oxygenWtPct,
        buildOrientationDeg: shared.buildOrientationDeg,
        scanRotationDeg: shared.scanRotationDeg
      };
    }
    return {
      processId: 'lpbf',
      alloyId: shared.alloyId,
      postProcessing: shared.postProcessing,
      P: 280,
      v: 960,
      h: 110,
      t: 40,
      db: 80,
      T0: 200,
      oxygenWtPct: shared.oxygenWtPct,
      buildOrientationDeg: shared.buildOrientationDeg,
      scanRotationDeg: shared.scanRotationDeg
    };
  }

  function runBrowserSimulationForProcess(mesh, geo, params, machineProc) {
    if (!mesh || !geo || typeof evaluateTi64Pinn !== 'function' || typeof evaluateTi64Metallurgy !== 'function') {
      return null;
    }
    const mac =
      (typeof cadMachinesList !== 'undefined' && Array.isArray(cadMachinesList) && cadMachinesList.find((m) => m.process === machineProc)) ||
      (machineProc === 'ded-laser'
        ? { id: 'generic-powder-lded', name: 'Generic Powder-Fed L-DED Cell', process: 'ded-laser', envelopeMm: [600, 600, 500], laserCount: 1 }
        : { id: 'eos-m290', name: 'EOS M 290', process: 'lpbf', envelopeMm: [250, 250, 325], laserCount: 1 });

    const proc = machineProc;
    const alloyId = String(params.alloyId || 'ti64_gr5').toLowerCase().includes('eli') ? 'ti64_eli' : 'ti64_gr5';
    const post = params.postProcessing || 'HIP';
    const p = params.P;
    const v = params.v;
    const h = params.h;
    const tUm = params.t;
    const baseT0 = params.T0;
    const db = params.db;
    const o2 = params.oxygenWtPct;
    const oriDeg = params.buildOrientationDeg;
    const scanRot = params.scanRotationDeg;
    const lasers = Math.max(1, mac.laserCount || 1);
    const hMm = h * 1e-3;
    const recoatS = proc === 'lpbf' ? 8.5 : 0.5;
    const ved = (p * 1e6) / Math.max(1, v * h * tUm);
    const heatInputJmm = p / Math.max(0.5, v);
    const absorptivityEta = proc === 'ded-laser' ? 0.38 : 0.42;

    const slices = geo.layerSlices && geo.layerSlices.length
      ? geo.layerSlices
      : [{ zMm: Number((mesh.boundingBox.size[2] * 0.5).toFixed(2)), areaMm2: 1000, perimeterMm: 100, heatSinkRatio: 1.0 }];

    const densityEst = Number(Math.max(92, 99.7 - geo.overhangFractionPct * 0.015).toFixed(2));
    const partDensityPct = Number(Math.max(88.0, Math.min(99.98, post === 'HIP' ? Math.max(densityEst, 99.6) : densityEst)).toFixed(2));
    const ysReq = alloyId === 'ti64_eli' ? 795 : 825;
    const utsReq = alloyId === 'ti64_eli' ? 860 : 895;
    const o2Max = alloyId === 'ti64_eli' ? 0.13 : 0.20;
    const o2Ok = o2 <= o2Max;

    const layers = [];
    let rolling = 0;
    let minYs = Infinity, minUts = Infinity, minEl = Infinity, hvSum = 0, maxT0 = baseT0, weakestZ = slices[0].zMm, maxOod = 0;
    let anyOod = false;

    for (let idx = 0; idx < slices.length; idx++) {
      const sl = slices[idx];
      const effA = Math.max(10, sl.areaMm2);
      const scanS = effA / Math.max(1e-3, v * hMm * lasers);
      const interS = scanS + recoatS;
      const fastBoost = Math.max(0, 1 - interS / (proc === 'lpbf' ? 18 : 28));
      const neckBoost = sl.heatSinkRatio > 1.35 ? Math.min(1, (sl.heatSinkRatio - 1) * 0.35) : 0;
      const zIns = Math.min(1, sl.zMm / 80);
      const tgt = (18 * fastBoost + 45 * neckBoost + 22 * zIns) * (proc === 'ded-laser' ? 1.25 : 1.0);
      rolling = 0.65 * rolling + 0.35 * tgt;
      const effT0 = Number(Math.min(500, baseT0 + rolling).toFixed(1));
      if (effT0 > maxT0) maxT0 = effT0;

      const pinn = evaluateTi64Pinn({ processId: proc, P: p, v, h, t: tUm, T0: effT0, db, postProcessing: post, oxygenWtPct: o2, densityPct: partDensityPct, buildOrientationDeg: oriDeg });
      const met = evaluateTi64Metallurgy({ alloyId, processId: proc, coolingRateKs: pinn.meltPool.coolingRateKs, postProcessing: post, oxygenWtPct: o2, buildOrientationDeg: oriDeg, scanRotationDeg: scanRot, densityPct: partDensityPct });
      const elongKnock = sl.heatSinkRatio >= 2.0 ? 0.94 : 1.0;

      const pinnAB = post === 'None' ? pinn : evaluateTi64Pinn({ processId: proc, P: p, v, h, t: tUm, T0: effT0, db, postProcessing: 'None', oxygenWtPct: o2, densityPct: densityEst, buildOrientationDeg: oriDeg });
      const metAB = post === 'None' ? met : evaluateTi64Metallurgy({ alloyId, processId: proc, coolingRateKs: pinn.meltPool.coolingRateKs, postProcessing: 'None', oxygenWtPct: o2, buildOrientationDeg: oriDeg, scanRotationDeg: scanRot, densityPct: densityEst });

      const pinnHip = post === 'HIP' ? pinn : evaluateTi64Pinn({ processId: proc, P: p, v, h, t: tUm, T0: effT0, db, postProcessing: 'HIP', oxygenWtPct: o2, densityPct: Math.max(99.6, densityEst), buildOrientationDeg: oriDeg });
      const metHip = post === 'HIP' ? met : evaluateTi64Metallurgy({ alloyId, processId: proc, coolingRateKs: pinn.meltPool.coolingRateKs, postProcessing: 'HIP', oxygenWtPct: o2, buildOrientationDeg: oriDeg, scanRotationDeg: scanRot, densityPct: Math.max(99.6, densityEst) });

      const ysMpa = Math.round(0.5 * pinn.metallurgy.yieldStrengthMpa + 0.5 * met.hallPetchYieldStrengthMpa);
      const utsMpa = Math.round(0.5 * pinn.metallurgy.utsMpa + 0.5 * met.predictedUtsMpa);
      const hv = Math.round(0.5 * pinn.metallurgy.predictedHv + 0.5 * met.predictedHv);
      const elongPct = Number(Math.max(1.5, Math.min(22.0, pinn.metallurgy.elongationPct * met.anisotropy.elongationFactor * elongKnock)).toFixed(1));

      const asBuiltYsMpa = Math.round(0.5 * pinnAB.metallurgy.yieldStrengthMpa + 0.5 * metAB.hallPetchYieldStrengthMpa);
      const asBuiltUtsMpa = Math.round(0.5 * pinnAB.metallurgy.utsMpa + 0.5 * metAB.predictedUtsMpa);
      const asBuiltHv = Math.round(0.5 * pinnAB.metallurgy.predictedHv + 0.5 * metAB.predictedHv);
      const asBuiltElongPct = Number(Math.max(1.5, Math.min(22.0, pinnAB.metallurgy.elongationPct * metAB.anisotropy.elongationFactor * elongKnock)).toFixed(1));

      const hipPreviewYsMpa = Math.round(0.5 * pinnHip.metallurgy.yieldStrengthMpa + 0.5 * metHip.hallPetchYieldStrengthMpa);
      const hipPreviewUtsMpa = Math.round(0.5 * pinnHip.metallurgy.utsMpa + 0.5 * metHip.predictedUtsMpa);
      const hipPreviewHv = Math.round(0.5 * pinnHip.metallurgy.predictedHv + 0.5 * metHip.predictedHv);
      const hipPreviewElongPct = Number(Math.max(1.5, Math.min(22.0, pinnHip.metallurgy.elongationPct * metHip.anisotropy.elongationFactor * elongKnock)).toFixed(1));
      const hipPreviewAstmPass = hipPreviewYsMpa >= ysReq && hipPreviewUtsMpa >= utsReq && hipPreviewElongPct >= 10.0 && o2Ok;

      const reg = typeof classifyProcessRegime === 'function'
        ? classifyProcessRegime(proc, { P: p, v, h, t: tUm, T0: effT0, db }, { ved, heatInput: heatInputJmm })
        : { kpiBadgeLabel: 'Nominal Window' };
      const ood = typeof evaluateOodRisk === 'function'
        ? evaluateOodRisk({ P: p, v, h, t: tUm, T0: effT0, ved }, proc)
        : { mahalanobisDistance: 1.2, status: 'in_distribution', piMultiplier: 1.0 };

      if (ood.mahalanobisDistance > maxOod) maxOod = ood.mahalanobisDistance;
      if (ood.status === 'extrapolating') anyOod = true;
      if (ysMpa < minYs) { minYs = ysMpa; weakestZ = sl.zMm; }
      if (utsMpa < minUts) minUts = utsMpa;
      if (elongPct < minEl) { minEl = elongPct; weakestZ = sl.zMm; }
      hvSum += hv;

      layers.push({
        zMm: sl.zMm,
        areaMm2: sl.areaMm2,
        scanTimeSec: Number(scanS.toFixed(1)),
        effectivePreheatC: effT0,
        coolingRateKs: pinn.meltPool.coolingRateKs,
        alphaLathUm: Number(pinn.metallurgy.alphaLathWidthUm.toFixed(2)),
        ysMpa,
        utsMpa,
        elongPct,
        hv,
        oodDistance: Number(ood.mahalanobisDistance.toFixed(2)),
        oodStatus: ood.status,
        piMultiplier: Number(ood.piMultiplier.toFixed(2)),
        regimeName: reg.kpiBadgeLabel,
        meltPoolWidthUm: pinn.meltPool.widthUm,
        meltPoolDepthUm: pinn.meltPool.depthUm,
        meltPoolLengthUm: pinn.meltPool.lengthUm,
        aspectRatio: pinn.meltPool.aspectRatio,
        peakTempC: pinn.meltPool.peakTempC,
        meltMode: pinn.meltPool.mode,
        absorptivityEta,
        vedJmm3: Number(ved.toFixed(1)),
        heatInputJmm: Number(heatInputJmm.toFixed(2)),
        heatSinkRatio: Number(sl.heatSinkRatio.toFixed(2)),
        hallPetchResidualMpa: pinn.physicsAudit.hallPetchResidualMpa,
        thermalEnthalpyResidualPct: pinn.physicsAudit.thermalEnthalpyResidualPct,
        dW_dLogP: pinn.derivatives.dW_dLogP,
        dD_dLogP: pinn.derivatives.dD_dLogP,
        dW_dLogV: pinn.derivatives.dW_dLogV,
        dCool_dT0: pinn.derivatives.dCool_dT0,
        dLogLath_dLogCool: pinn.derivatives.dLogLath_dLogCool,
        dLogLath_dTht: pinn.derivatives.dLogLath_dTht,
        dYs_dO2: pinn.derivatives.dYs_dO2,
        dElong_dO2: pinn.derivatives.dElong_dO2,
        asBuiltAlphaLathUm: Number(pinnAB.metallurgy.alphaLathWidthUm.toFixed(2)),
        asBuiltYsMpa,
        asBuiltUtsMpa,
        asBuiltElongPct,
        asBuiltHv,
        hipPreviewAlphaLathUm: Number(pinnHip.metallurgy.alphaLathWidthUm.toFixed(2)),
        hipPreviewYsMpa,
        hipPreviewUtsMpa,
        hipPreviewElongPct,
        hipPreviewHv,
        hipPreviewAstmPass
      });
    }

    const sz = mesh.boundingBox.size;
    const fits = sz[0] <= mac.envelopeMm[0] && sz[1] <= mac.envelopeMm[1] && sz[2] <= mac.envelopeMm[2];
    const minLayerYsMpa = Math.round(minYs);
    const minLayerUtsMpa = Math.round(minUts);
    const minLayerElongPct = Number(minEl.toFixed(1));
    const astmStandard = proc === 'ded-laser' ? 'ASTM F3187' : (alloyId === 'ti64_eli' ? 'ASTM F3001' : 'ASTM F2924');
    const astmPass = fits && partDensityPct >= 99.5 && minLayerYsMpa >= ysReq && minLayerUtsMpa >= utsReq && minLayerElongPct >= 10.0 && o2Ok;
    const astmReason = astmPass
      ? `All ${layers.length} slices meet ${astmStandard} (Min YS ${minLayerYsMpa} MPa, Elong ${minLayerElongPct}%, Max T0,eff ${maxT0}°C).`
      : (!fits
          ? `Part exceeds ${mac.name} build volume envelope (${mac.envelopeMm.join('×')} mm).`
          : (minLayerElongPct < 10.0
              ? `Critical zone Z=${weakestZ} mm fails ≥10% ductility (${minLayerElongPct}%); apply Annealing or HIP.`
              : `Weakest slice Z=${weakestZ} mm fails ${astmStandard} bounds (${minLayerYsMpa}/${minLayerUtsMpa} MPa, O₂ ${o2.toFixed(3)} wt%).`));

    const postN = typeof normalizeCondition === 'function' ? normalizeCondition(post).postNorm : post;
    const abStress = Math.round(minLayerYsMpa * (proc === 'ded-laser' ? 0.82 : 1.02) * (1 + Math.min(0.28, geo.sharpConcaveCornerCount * 0.03) + Math.min(0.18, geo.abruptAreaJumpCount * 0.035)));
    const relF = postN === 'HIP' ? 0.045 : (postN === 'Annealed' ? 0.085 : (postN === 'Stress-relieved' ? 0.14 : (postN === 'Solution-Aged' ? 0.12 : 1.0)));
    const surfStress = Math.max(12, Math.round(abStress * relF * (scanRot === 67 ? 0.93 : 1.04)));
    const longSpan = Math.max(sz[0], sz[1]);
    const slend = sz[2] / Math.max(1, Math.min(sz[0], sz[1]));
    const warpScore = Math.max(5, Math.min(98, Math.round((postN === 'HIP' ? 12 : (postN === 'Annealed' ? 20 : (postN === 'Stress-relieved' ? 28 : 58))) + Math.min(18, geo.overhangFractionPct * 1.1) + Math.min(14, geo.abruptAreaJumpCount * 3.5) + Math.min(10, Math.max(0, slend - 1) * 5))));
    const deflUm = Math.round((longSpan * 0.8 + sz[2] * 0.5) * (surfStress / 450) * (1 + geo.overhangFractionPct / 40));
    const cutRisk = (postN === 'None' && surfStress > 400) ? 'High' : ((warpScore >= 48 || surfStress > 120) ? 'Moderate' : 'Low');
    const hotspotsSummary = [];
    if (geo.sharpConcaveCornerCount > 0) hotspotsSummary.push(`${geo.sharpConcaveCornerCount} sharp concave corners concentrate peel tension.`);
    if (geo.abruptAreaJumpCount > 0) hotspotsSummary.push(`${geo.abruptAreaJumpCount} abrupt A(z) transitions drive warping risk (${warpScore}/100).`);
    if (hotspotsSummary.length === 0) hotspotsSummary.push('Smooth cross-section transitions minimize corner stress risers.');

    return {
      processId: proc,
      alloyId,
      postProcessing: post,
      layerCount: Math.max(1, Math.round(sz[2] / Math.max(0.01, tUm * 1e-3))),
      maxEffectivePreheatC: Number(maxT0.toFixed(1)),
      minLayerYsMpa,
      minLayerUtsMpa,
      minLayerElongPct,
      meanLayerHv: Math.round(hvSum / Math.max(1, layers.length)),
      weakestLayerZMm: Number(weakestZ.toFixed(2)),
      maxOodDistance: Number(maxOod.toFixed(2)),
      anyLayerOod: anyOod,
      astmStandard,
      astmPass,
      astmReason,
      layers,
      distortionAndStress: {
        disclaimer: 'Screening estimate from geometry & thermal gradients (not full thermo-mechanical FEA).',
        surfaceResidualStressMpa: surfStress,
        asBuiltPeakStressMpa: abStress,
        warpingRiskScore: warpScore,
        estimatedMaxDeflectionUm: deflUm,
        plateCutOffRisk: cutRisk,
        hotspotsSummary,
        mitigations: []
      }
    };
  }

  function recomputeDualSims() {
    if (typeof cadActiveMesh === 'undefined' || !cadActiveMesh || typeof cadGeometryReport === 'undefined' || !cadGeometryReport) {
      cache.lpbfSim = null;
      cache.ldedSim = null;
      return;
    }
    const dashProc = typeof currentProcess !== 'undefined' ? String(currentProcess).toLowerCase() : 'lpbf';
    const live = readLiveSliderParams(dashProc);
    if (dashProc === 'ded-laser') {
      cache.ldedParams = live;
      cache.lpbfParams = buildReferenceParams('lpbf', live);
    } else {
      cache.lpbfParams = live;
      cache.ldedParams = buildReferenceParams('ded-laser', live);
    }
    cache.lpbfSim = runBrowserSimulationForProcess(cadActiveMesh, cadGeometryReport, cache.lpbfParams, 'lpbf');
    cache.ldedSim = runBrowserSimulationForProcess(cadActiveMesh, cadGeometryReport, cache.ldedParams, 'ded-laser');
    cache.meshRef = cadActiveMesh;
    cache.geoRef = cadGeometryReport;
  }

  function renderPinnMeltPoolInset(canvas, lpbfLayer, ldedLayer, geo, activeToolhead, mode) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(300, Math.round((rect && rect.width) ? rect.width : (canvas.width || 420)));
    const H = 148;
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#060c18';
    ctx.fillRect(0, 0, W, H);

    if (!lpbfLayer || !ldedLayer) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Load a CAD component to compare LPBF vs. L-DED melt pools', W * 0.5, H * 0.5);
      return;
    }

    const halfW = W * 0.5;
    const drawPane = (ox, paneW, label, layer, accent, isHighlighted) => {
      if (isHighlighted) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
        ctx.fillRect(ox + 2, 2, paneW - 4, H - 4);
      }
      ctx.fillStyle = accent;
      ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, ox + 10, 16);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`W=${layer.meltPoolWidthUm}µm · D=${layer.meltPoolDepthUm}µm`, ox + 10, 30);

      // Shared µm scale across panes (true relative scale with visible floor for LPBF micro-pool)
      const maxWidthUm = Math.max(lpbfLayer.meltPoolWidthUm, ldedLayer.meltPoolWidthUm, 1800);
      const pxPerUm = Math.min((paneW - 36) / maxWidthUm, 52 / Math.max(layer.meltPoolDepthUm, ldedLayer.meltPoolDepthUm, 700));
      const poolW = Math.max(10, layer.meltPoolWidthUm * pxPerUm);
      const poolD = Math.max(6, layer.meltPoolDepthUm * pxPerUm);
      const cx = ox + paneW * 0.5;
      const topY = 54;

      // Substrate surface
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox + 12, topY);
      ctx.lineTo(ox + paneW - 12, topY);
      ctx.stroke();

      // Melt pool semi-ellipse
      const grad = ctx.createRadialGradient(cx, topY + 2, 2, cx, topY + poolD * 0.45, Math.max(poolW, poolD));
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.55, '#fb923c');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0.25)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, topY, poolW * 0.5, poolD, 0, 0, Math.PI, false);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Microstructure schematic bar (alpha' needles vs alpha+beta Widmanstatten laths)
      const boxY = 104;
      ctx.fillStyle = '#0b1424';
      ctx.fillRect(ox + 10, boxY, paneW - 20, 32);
      ctx.strokeStyle = 'rgba(148,163,184,0.22)';
      ctx.strokeRect(ox + 10, boxY, paneW - 20, 32);

      const lathPx = Math.max(1.2, Math.min(4.5, layer.alphaLathUm * 1.6));
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.min(2.2, lathPx * 0.55);
      const stepX = Math.max(5, lathPx * 3.8);
      for (let x = ox + 16; x < ox + paneW - 24; x += stepX) {
        ctx.beginPath();
        ctx.moveTo(x, boxY + 4);
        ctx.lineTo(x + 7, boxY + 26);
        ctx.stroke();
      }
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '9.5px "JetBrains Mono", monospace';
      ctx.fillText(`λ_α=${layer.alphaLathUm}µm · ${layer.ysMpa}MPa`, ox + 14, boxY + 28);
    };

    drawPane(0, halfW, 'LPBF (Micro-Pool)', lpbfLayer, '#38bdf8', activeToolhead === 'lpbf' || mode === 'compare');
    ctx.strokeStyle = 'rgba(148,163,184,0.22)';
    ctx.beginPath();
    ctx.moveTo(halfW, 8);
    ctx.lineTo(halfW, H - 8);
    ctx.stroke();
    drawPane(halfW, halfW, 'L-DED (Milli-Pool)', ldedLayer, '#fbbf24', activeToolhead === 'ded-laser' || mode === 'compare');

    // Scale note & CAD wall ref
    if (geo) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`True Relative Pool Scale · CAD Min Wall: ${geo.minWallThicknessMm} mm`, W * 0.5, 44);
    }
  }

  function renderShowcaseOverlayOnCadCanvas(ctx, proj, W, H, mesh, geo, bb, frameRadius) {
    if (!mesh || !geo || !ctx) return;
    if (!cache.lpbfSim || !cache.ldedSim || cache.meshRef !== mesh || cache.geoRef !== geo) {
      recomputeDualSims();
    }
    const activeTool = state.toolheadProcess === 'ded-laser' ? 'ded-laser' : 'lpbf';
    const sim = activeTool === 'ded-laser' ? cache.ldedSim : cache.lpbfSim;
    const params = activeTool === 'ded-laser' ? cache.ldedParams : cache.lpbfParams;
    if (!sim || !params) return;

    const czBase = bb.min[2];
    const zSpan = Math.max(1e-3, bb.size[2]);
    const nLayers = Math.max(1, sim.layers.length);
    const activeIdx = Math.max(0, Math.min(nLayers - 1, state.sliceIdx));
    const slice = sim.layers[activeIdx];
    const zPct = typeof cadViewerState !== 'undefined' && cadViewerState ? cadViewerState.sectionPct : 100;
    const zClip = czBase + zSpan * (zPct / 100);
    const cx = (bb.min[0] + bb.max[0]) * 0.5;
    const cy = (bb.min[1] + bb.max[1]) * 0.5;

    ctx.save();

    // Stage 0: Baseplate preheat tint + LPBF support anchors / L-DED machining clearance
    if (state.stageIdx === 0) {
      const heatAlpha = clampFinite((params.T0 - 25) / 500, 0.05, 0.28, 0.12);
      const p0 = proj(bb.min[0] - 4, bb.min[1] - 4, czBase);
      const p1 = proj(bb.max[0] + 4, bb.min[1] - 4, czBase);
      const p2 = proj(bb.max[0] + 4, bb.max[1] + 4, czBase);
      const p3 = proj(bb.min[0] - 4, bb.max[1] + 4, czBase);
      ctx.fillStyle = `rgba(251, 146, 60, ${heatAlpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
      ctx.closePath();
      ctx.fill();

      if (activeTool === 'lpbf' && geo.perOverhang) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1;
        const step = Math.max(1, Math.floor(mesh.triangleCount / 40));
        const pos = mesh.positions;
        for (let t = 0; t < mesh.triangleCount; t += step) {
          if (!geo.perOverhang[t]) continue;
          const b = t * 9;
          const ox = (pos[b] + pos[b + 3] + pos[b + 6]) / 3;
          const oy = (pos[b + 1] + pos[b + 4] + pos[b + 7]) / 3;
          const oz = (pos[b + 2] + pos[b + 5] + pos[b + 8]) / 3;
          if (oz <= czBase + 0.5) continue;
          const topP = proj(ox, oy, oz);
          const botP = proj(ox, oy, czBase);
          ctx.beginPath(); ctx.moveTo(topP[0], topP[1]); ctx.lineTo(botP[0], botP[1]); ctx.stroke();
        }
      } else if (activeTool === 'ded-laser') {
        const q0 = proj(bb.min[0] - 2.5, bb.min[1] - 2.5, czBase + zSpan);
        const q1 = proj(bb.max[0] + 2.5, bb.min[1] - 2.5, czBase + zSpan);
        const q2 = proj(bb.max[0] + 2.5, bb.max[1] + 2.5, czBase + zSpan);
        const q3 = proj(bb.min[0] - 2.5, bb.max[1] + 2.5, czBase + zSpan);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.38)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]);
        ctx.lineTo(q2[0], q2[1]); ctx.lineTo(q3[0], q3[1]);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Stages 1, 2, 3: True slice-plane intersection contour + clipped hatch chords + toolhead beam
    if (state.stageIdx >= 1 && state.stageIdx <= 3) {
      if (cache.segMesh !== mesh || Math.abs(cache.segZ - zClip) > 1e-4 || !cache.segments) {
        cache.segMesh = mesh;
        cache.segZ = zClip;
        cache.segments = computeSlicePlaneSegments(mesh.positions, mesh.triangleCount, zClip);
      }
      const segs = cache.segments;
      const spacing = activeTool === 'ded-laser' ? Math.max(1.2, bb.size[0] / 14) : Math.max(0.8, bb.size[0] / 22);
      const angle = activeTool === 'ded-laser' ? 0 : (activeIdx % 2 === 0 ? 67 : 134);

      if (Math.abs(cache.chordZ - zClip) > 1e-4 || cache.chordAngle !== angle || cache.chordSpacing !== spacing || !cache.chords) {
        cache.chordZ = zClip;
        cache.chordAngle = angle;
        cache.chordSpacing = spacing;
        cache.chords = computeClippedHatchChords(segs, angle, spacing, 40);
      }
      const chords = cache.chords;

      // LPBF faint translucent powder bed ring around active Z
      if (activeTool === 'lpbf') {
        const pb0 = proj(bb.min[0] - 5, bb.min[1] - 5, zClip);
        const pb1 = proj(bb.max[0] + 5, bb.min[1] - 5, zClip);
        const pb2 = proj(bb.max[0] + 5, bb.max[1] + 5, zClip);
        const pb3 = proj(bb.min[0] - 5, bb.max[1] + 5, zClip);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
        ctx.beginPath();
        ctx.moveTo(pb0[0], pb0[1]); ctx.lineTo(pb1[0], pb1[1]);
        ctx.lineTo(pb2[0], pb2[1]); ctx.lineTo(pb3[0], pb3[1]);
        ctx.closePath();
        ctx.fill();
      }

      // Solid cross-section contour segments
      ctx.strokeStyle = activeTool === 'ded-laser' ? 'rgba(251, 191, 36, 0.85)' : 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < segs.length; i += 4) {
        const a = proj(segs[i], segs[i + 1], zClip);
        const b = proj(segs[i + 2], segs[i + 3], zClip);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }

      // Clipped hatch chords strictly inside solid cross-section
      const nChords = Math.floor(chords.length / 4);
      if (nChords > 0) {
        ctx.strokeStyle = activeTool === 'ded-laser' ? 'rgba(251, 146, 60, 0.45)' : 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = activeTool === 'ded-laser' ? 2.0 : 1.0;
        for (let k = 0; k < nChords; k++) {
          const b = k * 4;
          const pA = proj(chords[b], chords[b + 1], zClip);
          const pB = proj(chords[b + 2], chords[b + 3], zClip);
          ctx.beginPath();
          ctx.moveTo(pA[0], pA[1]);
          ctx.lineTo(pB[0], pB[1]);
          ctx.stroke();
        }

        // Animated focal beam strictly along a real clipped solid chord
        const chordFloat = (state.scanPhase % 1) * nChords;
        const cIdx = Math.min(nChords - 1, Math.floor(chordFloat));
        const frac = chordFloat - cIdx;
        const cb = cIdx * 4;
        const lx = chords[cb] + frac * (chords[cb + 2] - chords[cb]);
        const ly = chords[cb + 1] + frac * (chords[cb + 3] - chords[cb + 1]);
        const spotP = proj(lx, ly, zClip);
        const sourceP = activeTool === 'ded-laser'
          ? proj(lx, ly, zClip + Math.max(12, frameRadius * 0.45))
          : proj(cx, cy, czBase + zSpan + Math.max(24, frameRadius * 0.85));

        if (activeTool === 'ded-laser') {
          // Coaxial L-DED nozzle cone + powder stream
          ctx.fillStyle = 'rgba(203, 213, 225, 0.65)';
          ctx.beginPath();
          ctx.moveTo(sourceP[0] - 9, sourceP[1]);
          ctx.lineTo(sourceP[0] + 9, sourceP[1]);
          ctx.lineTo(sourceP[0] + 3, sourceP[1] + 18);
          ctx.lineTo(sourceP[0] - 3, sourceP[1] + 18);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(251, 146, 60, 0.55)';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(sourceP[0] - 5, sourceP[1] + 18); ctx.lineTo(spotP[0], spotP[1]);
          ctx.moveTo(sourceP[0] + 5, sourceP[1] + 18); ctx.lineTo(spotP[0], spotP[1]);
          ctx.stroke();
        }

        // Laser beam ray
        ctx.strokeStyle = activeTool === 'ded-laser' ? 'rgba(251, 191, 36, 0.9)' : 'rgba(56, 189, 248, 0.9)';
        ctx.lineWidth = activeTool === 'ded-laser' ? 2.4 : 1.5;
        ctx.beginPath();
        ctx.moveTo(sourceP[0], sourceP[1]);
        ctx.lineTo(spotP[0], spotP[1]);
        ctx.stroke();

        // Melt pool hot spot glow
        const glowR = activeTool === 'ded-laser' ? 9 : 5.5;
        const g = ctx.createRadialGradient(spotP[0], spotP[1], 1, spotP[0], spotP[1], glowR * 1.8);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, '#fef08a');
        g.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(spotP[0], spotP[1], glowR * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Stage 4: Highlight baseplate Z=0 cut-off plane + stress warning badge
    if (state.stageIdx === 4) {
      const b0 = proj(bb.min[0] - 3, bb.min[1] - 3, czBase);
      const b1 = proj(bb.max[0] + 3, bb.min[1] - 3, czBase);
      const b2 = proj(bb.max[0] + 3, bb.max[1] + 3, czBase);
      const b3 = proj(bb.min[0] - 3, bb.max[1] + 3, czBase);
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]);
      ctx.lineTo(b2[0], b2[1]); ctx.lineTo(b3[0], b3[1]);
      ctx.closePath();
      ctx.stroke();
    }

    // Top-right HUD Pill inside canvas
    const stageSpec = SHOWCASE_STAGES[state.stageIdx];
    const hudText = `${activeTool === 'ded-laser' ? 'L-DED' : 'LPBF'} · ${stageSpec.shortTitle} · Z=${slice.zMm}mm`;
    ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
    const textW = ctx.measureText(hudText).width + 18;
    const pillX = Math.max(8, W - textW - 10);
    ctx.fillStyle = 'rgba(4, 9, 20, 0.85)';
    ctx.strokeStyle = activeTool === 'ded-laser' ? 'rgba(251, 191, 36, 0.5)' : 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(pillX, 10, textW, 22, 6);
    else ctx.rect(pillX, 10, textW, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = activeTool === 'ded-laser' ? '#fbbf24' : '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText(hudText, pillX + 9, 25);

    ctx.restore();
  }

  function renderShowcaseNarratorUi() {
    if (typeof document === 'undefined') return;
    const wrap = document.getElementById('cadPinnShowcaseCard');
    if (!wrap) return;

    const hasMesh = typeof cadActiveMesh !== 'undefined' && Boolean(cadActiveMesh) && typeof cadGeometryReport !== 'undefined' && Boolean(cadGeometryReport);
    if (hasMesh && (!cache.lpbfSim || !cache.ldedSim || cache.meshRef !== cadActiveMesh || cache.geoRef !== cadGeometryReport)) {
      recomputeDualSims();
    }

    // Update mode & toolhead button active states cleanly
    const modeMap = { lpbf: 'btnShowcaseModeLpbf', 'ded-laser': 'btnShowcaseModeDed', compare: 'btnShowcaseModeCompare' };
    Object.keys(modeMap).forEach((mKey) => {
      const btn = document.getElementById(modeMap[mKey]);
      if (btn) btn.classList.toggle('active', state.mode === mKey);
    });
    const flipBtn = document.getElementById('btnShowcaseFlipToolhead');
    if (flipBtn) {
      flipBtn.textContent = `3D Toolhead: ${state.toolheadProcess === 'ded-laser' ? 'L-DED (Flip → LPBF)' : 'LPBF (Flip → L-DED)'}`;
    }
    const playBtn = document.getElementById('btnShowcasePlay');
    if (playBtn) {
      playBtn.textContent = state.isPlaying ? '⏸ Pause Build' : '▶ Play 6-Stage Build';
    }

    document.querySelectorAll('.showcase-stage-pill').forEach((pill, i) => {
      const active = i === state.stageIdx;
      pill.classList.toggle('active', active);
      pill.setAttribute('aria-current', active ? 'step' : 'false');
    });

    const headlineEl = document.getElementById('cadShowcaseHeadline');
    const subEl = document.getElementById('cadShowcaseSubheadline');
    const listEl = document.getElementById('cadShowcaseBullets');
    const geoEl = document.getElementById('cadShowcaseGeoCallout');
    const oodEl = document.getElementById('cadShowcaseOodBanner');
    const cmpEl = document.getElementById('cadShowcaseCompareSummary');
    const hipBox = document.getElementById('cadShowcaseHipPreview');
    const inEl = document.getElementById('cadShowcaseChainInputs');
    const thEl = document.getElementById('cadShowcaseChainThermal');
    const mtEl = document.getElementById('cadShowcaseChainMet');
    const auditEl = document.getElementById('cadShowcaseAuditBadges');
    const liveEl = document.getElementById('cadShowcaseLiveRegion');
    const insetCanvas = document.getElementById('cadPinnInsetCanvas');

    if (!hasMesh || !cache.lpbfSim || !cache.ldedSim) {
      if (headlineEl) headlineEl.textContent = 'Load a CAD Component to Launch the PINN Build Theater';
      if (subEl) subEl.textContent = 'Click "Load Demo Ti-6Al-4V Bracket" or upload an STL/STEP part to trace thermal_net and metallurgy_net across all 6 LPBF & L-DED stages.';
      if (listEl) listEl.replaceChildren();
      if (geoEl) geoEl.textContent = '';
      if (oodEl) oodEl.style.display = 'none';
      if (cmpEl) cmpEl.style.display = 'none';
      if (hipBox) hipBox.style.display = 'none';
      if (insetCanvas) renderPinnMeltPoolInset(insetCanvas, null, null, null, state.toolheadProcess, state.mode);
      return;
    }

    const activeProc = state.mode === 'ded-laser' ? 'ded-laser' : (state.mode === 'lpbf' ? 'lpbf' : state.toolheadProcess);
    const activeSim = activeProc === 'ded-laser' ? cache.ldedSim : cache.lpbfSim;
    const compareSim = state.mode === 'compare' ? (activeProc === 'ded-laser' ? cache.lpbfSim : cache.ldedSim) : null;
    const activeParams = activeProc === 'ded-laser' ? cache.ldedParams : cache.lpbfParams;
    const compareParams = state.mode === 'compare' ? (activeProc === 'ded-laser' ? cache.lpbfParams : cache.ldedParams) : null;

    const narr = buildStageNarration({
      stageIdx: state.stageIdx,
      sliceIdx: state.sliceIdx,
      activeProcess: activeProc,
      mode: state.mode,
      fileName: typeof cadCurrentFileName !== 'undefined' ? cadCurrentFileName : 'component.stl',
      geo: cadGeometryReport,
      activeSim,
      compareSim,
      activeParams,
      compareParams
    });

    if (headlineEl) headlineEl.textContent = narr.headline;
    if (subEl) subEl.textContent = narr.subheadline;
    if (listEl) {
      const nodes = narr.bullets.map((bText) => {
        const li = document.createElement('li');
        li.textContent = bText;
        return li;
      });
      listEl.replaceChildren(...nodes);
    }
    if (geoEl) geoEl.textContent = narr.geometryCallout;

    if (oodEl) {
      if (narr.oodWarning) {
        oodEl.style.display = 'block';
        oodEl.textContent = narr.oodWarning;
      } else {
        oodEl.style.display = 'none';
        oodEl.textContent = '';
      }
    }

    if (cmpEl) {
      if (narr.compareSummary) {
        cmpEl.style.display = 'block';
        cmpEl.textContent = narr.compareSummary;
      } else {
        cmpEl.style.display = 'none';
        cmpEl.textContent = '';
      }
    }

    if (hipBox) {
      if (narr.hipPreview && narr.hipPreview.visible) {
        hipBox.style.display = 'block';
        const lbl = document.getElementById('cadShowcaseHipTitle');
        const ab = document.getElementById('cadShowcaseHipAsBuilt');
        const hp = document.getElementById('cadShowcaseHipProjected');
        if (lbl) lbl.textContent = narr.hipPreview.label;
        if (ab) ab.textContent = narr.hipPreview.asBuiltSummary;
        if (hp) hp.textContent = narr.hipPreview.hipSummary;
      } else {
        hipBox.style.display = 'none';
      }
    }

    if (inEl) inEl.textContent = narr.causalChain.inputsSummary;
    if (thEl) thEl.textContent = narr.causalChain.thermalSummary;
    if (mtEl) mtEl.textContent = narr.causalChain.metallurgySummary;
    if (auditEl) {
      const pills = narr.causalChain.auditBadges.map((txt) => {
        const sp = document.createElement('span');
        sp.className = 'showcase-audit-pill';
        sp.textContent = txt;
        return sp;
      });
      auditEl.replaceChildren(...pills);
    }

    if (liveEl) {
      liveEl.textContent = `Stage ${state.stageIdx + 1} of 6: ${narr.headline}`;
    }

    const lpbfL = getSlice(cache.lpbfSim, state.sliceIdx);
    const ldedL = getSlice(cache.ldedSim, state.sliceIdx);
    renderPinnMeltPoolInset(insetCanvas, lpbfL, ldedL, cadGeometryReport, activeProc, state.mode);
  }

  function syncSliceCutTo3d(sliceIdx, totalSlices) {
    if (typeof cadViewerState === 'undefined' || !cadViewerState) return;
    const pct = Math.max(5, Math.min(100, Math.round(((sliceIdx + 1) / Math.max(1, totalSlices)) * 100)));
    cadViewerState.sectionPct = pct;
    const zSlider = document.getElementById('cadSectionSlider');
    if (zSlider) zSlider.value = String(pct);
    const zVal = document.getElementById('cadSectionVal');
    if (zVal) zVal.innerText = `${pct}%`;
    const scrub = document.getElementById('cadLayerScrubber');
    if (scrub) scrub.value = String(sliceIdx);
    if (typeof window !== 'undefined') window.cadActiveScrubIdx = sliceIdx;
  }

  function stepShowcaseFrame(now) {
    if (!state.isPlaying) {
      state.rafId = null;
      return;
    }
    const cadTab = typeof document !== 'undefined' ? document.getElementById('view_cad-analyzer') : null;
    if ((typeof document !== 'undefined' && document.hidden) || (cadTab && !cadTab.classList.contains('active'))) {
      pauseShowcase();
      return;
    }

    state.rafTickCount++;
    const dt = state.lastFrameMs ? Math.min(0.1, (now - state.lastFrameMs) / 1000) : 0.016;
    state.lastFrameMs = now;
    state.reducedMotion = isReducedMotion();

    const rate = state.reducedMotion ? 0.25 * state.speed : 0.42 * state.speed;
    state.stageProgress += dt * rate;
    if (!state.reducedMotion) {
      state.scanPhase += dt * 1.15 * state.speed;
    }

    if (state.stageProgress >= 1.0) {
      state.stageProgress = 0;
      if (state.stageIdx < SHOWCASE_STAGES.length - 1) {
        state.stageIdx++;
        if (cache.lpbfSim && state.stageIdx >= 1 && state.stageIdx <= 3) {
          const n = cache.lpbfSim.layers.length;
          state.sliceIdx = Math.min(n - 1, Math.round((state.stageIdx / 4) * (n - 1)));
          syncSliceCutTo3d(state.sliceIdx, n);
        } else if (cache.lpbfSim && state.stageIdx >= 4) {
          const n = cache.lpbfSim.layers.length;
          state.sliceIdx = n - 1;
          syncSliceCutTo3d(n - 1, n);
        }
        renderShowcaseNarratorUi();
      } else {
        pauseShowcase();
        renderShowcaseNarratorUi();
        if (typeof renderCadViewer === 'function') renderCadViewer();
        return;
      }
    }

    if (typeof renderCadViewer === 'function') renderCadViewer();
    state.rafId = requestAnimationFrame(stepShowcaseFrame);
  }

  function playShowcase() {
    if (typeof cadActiveMesh === 'undefined' || !cadActiveMesh) return;
    if (state.isPlaying && state.rafId !== null) return;
    if (state.stageIdx >= SHOWCASE_STAGES.length - 1) {
      state.stageIdx = 0;
      state.sliceIdx = 0;
    }
    state.isPlaying = true;
    state.stageProgress = 0;
    state.lastFrameMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    renderShowcaseNarratorUi();
    if (typeof requestAnimationFrame === 'function') {
      state.rafId = requestAnimationFrame(stepShowcaseFrame);
    }
  }

  function pauseShowcase() {
    state.isPlaying = false;
    if (state.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(state.rafId);
    }
    state.rafId = null;
    renderShowcaseNarratorUi();
  }

  function togglePlayShowcase() {
    if (state.isPlaying) pauseShowcase();
    else playShowcase();
  }

  function setStage(idx) {
    state.stageIdx = Math.max(0, Math.min(SHOWCASE_STAGES.length - 1, parseInt(idx, 10) || 0));
    state.stageProgress = 0;
    if (cache.lpbfSim) {
      const n = cache.lpbfSim.layers.length;
      if (state.stageIdx === 0) state.sliceIdx = 0;
      else if (state.stageIdx <= 3) state.sliceIdx = Math.min(n - 1, Math.round((state.stageIdx / 4) * (n - 1)));
      else state.sliceIdx = n - 1;
      syncSliceCutTo3d(state.sliceIdx, n);
    }
    renderShowcaseNarratorUi();
    if (typeof renderCadViewer === 'function') renderCadViewer();
    if (typeof window !== 'undefined' && window.UiMotion && !state.isPlaying) {
      window.UiMotion.syncAll();
    }
  }

  function nextStage() {
    setStage(Math.min(SHOWCASE_STAGES.length - 1, state.stageIdx + 1));
  }

  function prevStage() {
    setStage(Math.max(0, state.stageIdx - 1));
  }

  function setMode(mode) {
    if (mode === 'lpbf' || mode === 'ded-laser' || mode === 'compare') {
      state.mode = mode;
      if (mode === 'lpbf' || mode === 'ded-laser') state.toolheadProcess = mode;
      renderShowcaseNarratorUi();
      if (typeof renderCadViewer === 'function') renderCadViewer();
      if (typeof window !== 'undefined' && window.UiMotion) {
        window.UiMotion.syncAll();
        window.UiMotion.animateCanvasWipe(document.getElementById('cadPinnInsetCanvas'));
      }
    }
  }

  function flipToolhead() {
    state.toolheadProcess = state.toolheadProcess === 'ded-laser' ? 'lpbf' : 'ded-laser';
    if (state.mode !== 'compare') state.mode = state.toolheadProcess;
    renderShowcaseNarratorUi();
    if (typeof renderCadViewer === 'function') renderCadViewer();
  }

  function setSpeed(speedVal) {
    const parsed = parseFloat(speedVal);
    state.speed = clampFinite(parsed, 0.25, 4.0, 1.0);
  }

  function setSliceIdx(idx) {
    const n = cache.lpbfSim ? cache.lpbfSim.layers.length : 1;
    state.sliceIdx = Math.max(0, Math.min(n - 1, parseInt(idx, 10) || 0));
    renderShowcaseNarratorUi();
    if (typeof renderCadViewer === 'function') renderCadViewer();
  }

  function resetOnCadLoad(activeProc) {
    pauseShowcase();
    state.stageIdx = 0;
    state.sliceIdx = 0;
    state.stageProgress = 0;
    state.toolheadProcess = activeProc === 'ded-laser' ? 'ded-laser' : 'lpbf';
    state.mode = 'compare';
    cache.meshRef = null;
    recomputeDualSims();
    renderShowcaseNarratorUi();
  }

  function syncFromDashboard() {
    if (typeof cadActiveMesh === 'undefined' || !cadActiveMesh) return;
    recomputeDualSims();
    renderShowcaseNarratorUi();
  }

  function getStateSnapshot() {
    return {
      stageIdx: state.stageIdx,
      sliceIdx: state.sliceIdx,
      mode: state.mode,
      toolheadProcess: state.toolheadProcess,
      isPlaying: state.isPlaying,
      speed: state.speed,
      rafId: state.rafId,
      rafTickCount: state.rafTickCount
    };
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseShowcase();
    });
  }
  if (typeof window !== 'undefined') {
    window.getPinnCadShowcaseState = getStateSnapshot;
  }

  return {
    SHOWCASE_STAGES,
    computeSlicePlaneSegments,
    computeClippedHatchChords,
    buildStageNarration,
    renderShowcaseOverlayOnCadCanvas,
    renderPinnMeltPoolInset,
    renderShowcaseNarratorUi,
    playShowcase,
    pauseShowcase,
    togglePlayShowcase,
    setStage,
    nextStage,
    prevStage,
    setMode,
    flipToolhead,
    setSpeed,
    setSliceIdx,
    resetOnCadLoad,
    syncFromDashboard,
    getStateSnapshot
  };
});
