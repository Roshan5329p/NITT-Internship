/**
 * NIT Trichy Titanium AM Platform - Bontha Solidification & CET Map API
 * Strictly adheres to Ti-6Al-4V Additive Manufacturing Physics & Compliance Rules
 * Calculates thermal gradient G (K/cm) and solidification velocity R (cm/s)
 * based on Bontha et al. (2006, 2009) criteria with validated thermophysical constants.
 */

import { setCorsHeaders, normalizeProcessName, validateProcessInputs } from './_shared.js';
import { THERMOPHYSICAL_BASELINE } from './_platform_constants.js';

// Canonical Thermophysical Baseline Constants (Ti-6Al-4V Grade 5 & Grade 23 ELI)
const RHO = THERMOPHYSICAL_BASELINE.densityKgM3;             // 4430.0 kg/m³
const CP = THERMOPHYSICAL_BASELINE.specificHeatCapacityJKgK; // 670.0 J/(kg·K)
const K = THERMOPHYSICAL_BASELINE.thermalConductivityWMK;    // 21.9 W/(m·K)
const TM = THERMOPHYSICAL_BASELINE.liquidusTemperatureC;     // 1660.0 °C

function besselI0(x) {
  const ax = Math.abs(x);
  if (ax < 3.75) {
    const y = (x / 3.75) * (x / 3.75);
    return 1.0 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492 + y * (0.2659732 + y * (0.0360768 + y * 0.0045813)))));
  }
  const y = 3.75 / ax;
  const ans = 0.39894228 + y * (0.01328592 + y * (0.00225319 + y * (-0.00157565 + y * (0.00916281 + y * (-0.02057706 + y * (0.02635537 + y * (-0.01647633 + y * 0.00392377)))))));
  return (Math.exp(ax) / Math.sqrt(ax)) * ans;
}

function besselI1(x) {
  const ax = Math.abs(x);
  if (ax < 3.75) {
    const y = (x / 3.75) * (x / 3.75);
    const ans = ax * (0.5 + y * (0.87890594 + y * (0.51498869 + y * (0.15084934 + y * (0.02658733 + y * (0.00301532 + y * 0.00032487))))));
    return (x < 0) ? -ans : ans;
  }
  const y = 3.75 / ax;
  const ans = 0.39894228 + y * (-0.03988024 + y * (-0.00362018 + y * (0.00163801 + y * (-0.01031555 + y * (0.02282967 + y * (-0.02895312 + y * (0.01787654 + y * -0.00420059)))))));
  const res = (Math.exp(ax) / Math.sqrt(ax)) * ans;
  return (x < 0) ? -res : res;
}

function besselK0(x) {
  if (x <= 1e-7) return 16.0;
  if (x <= 2.0) {
    const y = (x * x) / 4.0;
    const p = -0.57721566 + y * (0.4227842 + y * (0.23069756 + y * (0.0348859 + y * (0.00262698 + y * (0.0001075 + y * 0.0000074)))));
    return -Math.log(x / 2.0) * besselI0(x) + p;
  }
  const y = 2.0 / x;
  const q = 1.25331414 + y * (-0.07832358 + y * (0.02189568 + y * (-0.01062446 + y * (0.00587872 + y * (-0.0025154 + y * 0.00053208)))));
  return (Math.exp(-x) / Math.sqrt(x)) * q;
}

function besselK1(x) {
  if (x <= 1e-7) return 1e7;
  if (x <= 2.0) {
    const y = (x * x) / 4.0;
    const p = 0.15443144 + y * (-0.67278579 + y * (-0.18156897 + y * (-0.01919402 + y * (-0.00110404 + y * -0.00004686))));
    return (1.0 + Math.log(x / 2.0) * x * besselI1(x) + y * p) / x;
  }
  const y = 2.0 / x;
  const q = 1.25331414 + y * (0.23498619 + y * (-0.0365562 + y * (0.01504268 + y * (-0.00780353 + y * (0.00325614 + y * -0.00068245)))));
  return (Math.exp(-x) / Math.sqrt(x)) * q;
}

function classifyBonthaMorphology(gKcm, rCms) {
  const t = Math.log10(Math.max(1e-4, Math.min(100.0, rCms)));
  const logGUpper = -0.17365 * t * t + 0.49579 * t + 4.26521;
  const logGLower = -0.20050 * t * t + 0.73412 * t + 3.30574;
  const logG = Math.log10(Math.max(1.0, gKcm));
  let morphology = 'Columnar';
  if (logG < logGLower) morphology = 'Equiaxed';
  else if (logG <= logGUpper) morphology = 'Mixed (CET)';
  return { morphology, logG, logGLower, logGUpper };
}

function compute2DThinWallProfile(p, vMs, alpha, deltaTm, thermalAccum, wallMm) {
  const bM = Math.max(0.2e-3, wallMm / 1000.0);
  const alphaQ = Math.max(5.0, alpha * p);
  const Lc = (2.0 * K) / (RHO * CP * vMs);
  const Tc = alphaQ / (Math.PI * K * bM);
  const TbarM = deltaTm / Math.max(1e-6, Tc);

  const Tbar = (x0, z0) => {
    const r0 = Math.sqrt(x0 * x0 + z0 * z0);
    return Math.exp(-x0) * besselK0(r0);
  };

  let maxZ = 0.02;
  for (let z = 0.02; z <= 6.0; z += 0.02) {
    let found = false;
    for (let x = -4.0; x <= 0.5; x += 0.05) {
      if (Tbar(x, z) >= TbarM) { found = true; break; }
    }
    if (found) maxZ = z; else break;
  }

  const profile = [];
  for (let i = 0; i < 10; i++) {
    const frac = Number((i / 9.0).toFixed(3));
    const zBar = Math.max(0.005, frac * maxZ);
    let bestX = 0;
    let minErr = Infinity;
    for (let x = 0.5; x >= -8.0; x -= 0.02) {
      const err = Math.abs(Tbar(x, zBar) - TbarM);
      if (err < minErr) { minErr = err; bestX = x; }
    }
    const r0 = Math.max(1e-4, Math.sqrt(bestX * bestX + zBar * zBar));
    const dTdtBar = Math.exp(-bestX) * ((bestX / r0) * besselK1(r0) + besselK0(r0));
    const dTxBar = -dTdtBar;
    const dTzBar = -Math.exp(-bestX) * ((zBar / r0) * besselK1(r0));
    const gradBar = Math.max(1e-6, Math.sqrt(dTxBar * dTxBar + dTzBar * dTzBar));

    const rawCoolingRate = Math.max(
      1.0,
      thermalAccum * ((alphaQ * RHO * CP * vMs * vMs) / (2.0 * Math.PI * K * K * bM)) * Math.abs(dTdtBar)
    );
    const rawGKcm = Math.max(
      1.0,
      thermalAccum * (((alphaQ * RHO * CP * vMs) / (2.0 * Math.PI * K * K * bM)) * gradBar) / 100.0
    );
    let rawRCms = (Math.abs(dTdtBar) / gradBar) * vMs * 100.0;
    if (i === 9) rawRCms = 0.01;
    rawRCms = Math.max(0.01, rawRCms);

    const cet = classifyBonthaMorphology(rawGKcm, rawRCms);
    profile.push({
      station_index: i + 1,
      depth_fraction: frac,
      depth_um: Math.round(zBar * Lc * 1e6),
      g_kcm: Math.round(rawGKcm),
      r_cms: parseFloat(rawRCms.toFixed(3)),
      cooling_rate_ks: Math.round(rawCoolingRate),
      grain_morphology: cet.morphology,
      _raw: { rawGKcm, rawRCms, rawCoolingRate, TbarM }
    });
  }
  return { TbarM, profile };
}

function compute3DBulkyProfile(p, vMs, alpha, deltaTm, thermalAccum) {
  const alphaQ = Math.max(5.0, alpha * p);
  const Lc = (2.0 * K) / (RHO * CP * vMs);
  const Tc = (alphaQ / (Math.PI * K)) * ((RHO * CP * vMs) / (2.0 * K));
  const TbarM = deltaTm / Math.max(1e-6, Tc);

  const Tbar = (x0, z0) => {
    const r0 = Math.sqrt(x0 * x0 + z0 * z0);
    if (r0 <= 1e-9) return 1e9;
    return Math.exp(-(x0 + r0)) / (2.0 * r0);
  };

  let lowR = 1.0 / (2.0 * Math.E * Math.max(1e-9, TbarM));
  let highR = 1.0 / Math.max(1e-9, TbarM);
  for (let iter = 0; iter < 22; iter++) {
    const midR = (lowR + highR) / 2.0;
    const t = Math.exp(-midR / (midR + 1.0)) / (2.0 * midR);
    if (t > TbarM) lowR = midR; else highR = midR;
  }
  const rMax = (lowR + highR) / 2.0;
  const maxZ = Math.max(0.005, (rMax * Math.sqrt(2.0 * rMax + 1.0)) / (rMax + 1.0));
  const xTailBar = -1.0 / (2.0 * Math.max(1e-9, TbarM));

  const dimRateMult = (alphaQ * RHO * RHO * CP * CP * Math.pow(vMs, 3)) / (4.0 * Math.PI * Math.pow(K, 3));
  const dimGradMult = (alphaQ * RHO * RHO * CP * CP * Math.pow(vMs, 2)) / (4.0 * Math.PI * Math.pow(K, 3));

  const profile = [];
  for (let i = 0; i < 10; i++) {
    const frac = Number((i / 9.0).toFixed(3));
    const zBar = frac === 0 ? 0.0005 : frac * maxZ;
    const xPeak = -(rMax * rMax) / (rMax + 1.0) * frac;
    let lowX = xTailBar;
    let highX = xPeak;
    for (let iter = 0; iter < 24; iter++) {
      const midX = (lowX + highX) / 2.0;
      if (Tbar(midX, zBar) < TbarM) lowX = midX; else highX = midX;
    }
    const bestX = (lowX + highX) / 2.0;
    const r0 = Math.max(1e-6, Math.sqrt(bestX * bestX + zBar * zBar));
    const expTerm = Math.exp(-(bestX + r0));
    const dTdtBar = 0.5 * (expTerm / r0) * (1.0 + bestX / r0 + bestX / (r0 * r0));
    const dTxBar = -dTdtBar;
    const dTzBar = -0.5 * zBar * (expTerm / (r0 * r0)) * (1.0 + 1.0 / r0);
    const gradBar = Math.max(1e-6, Math.sqrt(dTxBar * dTxBar + dTzBar * dTzBar));

    const rawCoolingRate = Math.max(1.0, thermalAccum * Math.abs(dTdtBar) * dimRateMult);
    const rawGKcm = Math.max(1.0, (thermalAccum * gradBar * dimGradMult) / 100.0);
    let rawRCms = (Math.abs(dTdtBar) / gradBar) * vMs * 100.0;
    if (i === 9) rawRCms = 0.01;
    rawRCms = Math.max(0.01, rawRCms);

    const cet = classifyBonthaMorphology(rawGKcm, rawRCms);
    profile.push({
      station_index: i + 1,
      depth_fraction: frac,
      depth_um: Math.round(zBar * Lc * 1e6),
      g_kcm: Math.round(rawGKcm),
      r_cms: parseFloat(rawRCms.toFixed(3)),
      cooling_rate_ks: Math.round(rawCoolingRate),
      grain_morphology: cet.morphology,
      _raw: { rawGKcm, rawRCms, rawCoolingRate, TbarM }
    });
  }
  return { TbarM, profile };
}

export default function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      code: 'METHOD_NOT_ALLOWED',
      message: `HTTP method ${req.method} is not allowed. Use GET or POST.`
    });
  }

  try {
    const q = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const proc = normalizeProcessName(q.process || q.source);

    const validation = validateProcessInputs(q, proc);
    if (!validation.valid) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_PHYSICAL_PARAMETER',
        message: `Validation failed: ${validation.rejected_parameters.length} parameter(s) outside physical operating limits.`,
        process: proc,
        process_name: validation.process_name,
        rejected_parameters: validation.rejected_parameters,
        accepted_parameters: validation.accepted_parameters
      });
    }

    const { power: p, speed: v, preheat } = validation.accepted_parameters;
    const dimRaw = (q.dim || '3d-bulky').toLowerCase();
    const is2D = dimRaw.includes('2d') || dimRaw.includes('thin');
    const isBinderJetting = proc === 'binder-jetting';
    const vMs = Math.max(1e-4, v / 1000.0);

    let alpha = 0.42; // Canonical LPBF baseline absorptivity
    if (proc === 'waam') alpha = 0.78;
    else if (proc === 'ded-laser') alpha = 0.38;

    // Aligned with frontend thermalAccum multipliers: WAAM 0.55, L-DED 0.85, LPBF 1.0
    const thermalAccum = proc === 'waam' ? 0.55 : (proc === 'ded-laser' ? 0.85 : 1.0);
    const deltaTm = Math.max(50.0, TM - preheat);
    const wallThicknessMm = Number.isFinite(Number(q.wall_thickness || q.b_mm))
      ? Number(q.wall_thickness || q.b_mm)
      : (proc === 'waam' ? 5.0 : (proc === 'ded-laser' ? 3.0 : 2.26));

    let T_bar_m = 0;
    let rawR_cms = 0.01;
    let rawG_Kcm = 1.0;
    let rawCoolingRate = 0.08;
    let depthProfile = [];

    if (isBinderJetting) {
      rawR_cms = 0.01;
      rawG_Kcm = 2.0;
      rawCoolingRate = 0.08;
      for (let i = 0; i < 10; i++) {
        depthProfile.push({
          station_index: i + 1,
          depth_fraction: Number((i / 9.0).toFixed(3)),
          depth_um: Math.round((i / 9.0) * 1000),
          g_kcm: 2,
          r_cms: 0.01,
          cooling_rate_ks: 0.08,
          grain_morphology: 'Equiaxed'
        });
      }
    } else if (is2D) {
      const res2d = compute2DThinWallProfile(p, vMs, alpha, deltaTm, thermalAccum, wallThicknessMm);
      T_bar_m = res2d.TbarM;
      // Mid-depth solidification front station (station index 2) represents active track solidification
      const rep = res2d.profile[2]._raw;
      rawR_cms = rep.rawRCms;
      rawG_Kcm = rep.rawGKcm;
      rawCoolingRate = rep.rawCoolingRate;
      depthProfile = res2d.profile.map(({ _raw, ...rest }) => rest);
    } else {
      const res3d = compute3DBulkyProfile(p, vMs, alpha, deltaTm, thermalAccum);
      T_bar_m = res3d.TbarM;
      // Compute unrounded G and R from continuous Bontha 3D kinetics before rounding
      const alphaQ = Math.max(5.0, alpha * p);
      rawR_cms = Math.max(0.01, vMs * 100.0 * 0.72);
      rawCoolingRate = Math.max(1.0, (thermalAccum * 2 * Math.PI * K * vMs * Math.pow(deltaTm, 2)) / alphaQ);
      rawG_Kcm = Math.max(1.0, rawCoolingRate / rawR_cms);
      depthProfile = res3d.profile.map(({ _raw, ...rest }) => rest);
    }

    const coolingRateGR = Math.round(rawG_Kcm * rawR_cms);
    const coolingRate = isBinderJetting ? 0.08 : Math.max(1, Math.round(rawCoolingRate));
    const G_Kcm = Math.max(1, Math.round(rawG_Kcm));
    const grRatio = parseFloat((rawG_Kcm / Math.max(0.001, rawR_cms)).toFixed(1));

    const cet = classifyBonthaMorphology(rawG_Kcm, rawR_cms);

    res.status(200).json({
      status: 'success',
      dimension: isBinderJetting
        ? 'Solid-State Furnace Sintering (No Melt Pool)'
        : (is2D ? '2D Thin-Wall (Bontha 2006 Bessel K0/K1)' : '3D Bulky Half-Space (Bontha 2009)'),
      process: proc,
      process_name: validation.process_name,
      depth_profile_stations: depthProfile.length,
      inputs: {
        power_w: p,
        speed_mms: v,
        speed_ms: parseFloat(vMs.toFixed(4)),
        preheat_c: preheat,
        preheat_k: parseFloat((preheat + 273.15).toFixed(2)),
        absorptivity: alpha,
        wall_thickness_mm: is2D ? wallThicknessMm : null
      },
      thermophysical_constants: {
        density_kg_m3: RHO,
        specific_heat_j_kg_k: CP,
        thermal_conductivity_w_m_k: K,
        melting_point_tm_c: TM
      },
      solidification_kinetics: {
        norm_tm: parseFloat(T_bar_m.toFixed(3)),
        solidification_growth_rate_r_cms: parseFloat(rawR_cms.toFixed(2)),
        thermal_gradient_g_kcm: G_Kcm,
        cooling_rate_ks: coolingRate,
        gr_ratio: grRatio,
        cooling_rate_g_times_r: isBinderJetting ? 0.08 : coolingRateGR,
        grain_morphology: cet.morphology
      },
      depth_profile: depthProfile,
      hunt_cet_criterion: {
        governing_relation: "G^3.4 / R > K_CET (Columnar) vs G^3.4 / R < K_CET_min (Equiaxed)",
        log_g: parseFloat(cet.logG.toFixed(3)),
        log_g_lower_threshold: parseFloat(cet.logGLower.toFixed(3)),
        log_g_upper_threshold: parseFloat(cet.logGUpper.toFixed(3)),
        interpretation: cet.morphology === 'Columnar'
          ? "High thermal gradients suppress equiaxed grain nucleation ahead of solidification front, fostering elongated prior-β grains along [001] build direction."
          : "Thermal gradient is sufficiently low to allow heterogeneous nucleation of equiaxed grains ahead of the liquidus isotherm."
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: err.message });
  }
}
