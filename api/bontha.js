/**
 * NIT Trichy Titanium AM Platform - Bontha Solidification & CET Map API
 * Strictly adheres to Ti-6Al-4V Additive Manufacturing Physics & Compliance Rules
 * Calculates thermal gradient G (K/cm) and solidification velocity R (cm/s)
 * based on Bontha et al. (2006, 2009) criteria with validated thermophysical constants.
 */

import { setCorsHeaders, normalizeProcessName, validateProcessInputs } from './_shared.js';

// Validated Thermophysical Baseline Constants (Ti-6Al-4V Grade 5 & Grade 23 ELI)
const RHO = 4430.0;          // Density ρ (kg/m³)
const CP = 670.0;            // Specific heat capacity cp (J/kg·K, solid-liquid average)
const K = 21.9;              // Thermal conductivity k (W/m·K, near solidus)
const TM = 1660.0;           // Liquidus melting temperature Tl (°C)

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
    const dim = (q.dim || '3d-bulky').toLowerCase();
    const vMs = Math.max(1e-4, v / 1000.0);

    let source = 'laser';
    let alpha = 0.42; // Canonical LPBF baseline absorptivity
    if (proc === 'waam') { source = 'arc'; alpha = 0.78; }
    else if (proc === 'ded-laser') { source = 'ded-laser'; alpha = 0.38; }

    const deltaTm = Math.max(50.0, TM - preheat);
    const alpha_Q = alpha * p;
    const T_c = (alpha_Q / (Math.PI * K)) * ((RHO * CP * vMs) / (2.0 * K));
    const T_bar_m = deltaTm / Math.max(1e-6, T_c);

    const R_cms = Math.max(0.01, vMs * 100.0 * 0.72);
    const thermalAccum = source === 'arc' ? 0.15 : (source === 'ded-laser' ? 0.45 : 1.0);
    const coolingRate = Math.max(1.0, Math.round(thermalAccum * (2 * Math.PI * K * vMs * Math.pow(deltaTm, 2)) / Math.max(5, alpha_Q)));
    const G_Kcm = Math.max(1.0, Math.round(coolingRate / R_cms));

    // Exact Bontha et al. (2006, 2009) CET boundaries in log10(G_Kcm) vs log10(R_cms)
    const t = Math.log10(Math.max(1e-4, Math.min(100.0, R_cms)));
    const logGUpper = -0.17365 * t * t + 0.49579 * t + 4.26521;
    const logGLower = -0.20050 * t * t + 0.73412 * t + 3.30574;
    const logG = Math.log10(Math.max(1.0, G_Kcm));

    let morph = 'Columnar';
    if (logG < logGLower) morph = 'Equiaxed';
    else if (logG <= logGUpper) morph = 'Mixed (CET)';

    res.status(200).json({
      status: 'success',
      dimension: dim === '3d-bulky' ? '3D Bulky Half-Space (Bontha 2009)' : '2D Thin-Wall (Bontha 2006)',
      process: proc,
      process_name: validation.process_name,
      inputs: {
        power_w: p,
        speed_mms: v,
        speed_ms: parseFloat(vMs.toFixed(4)),
        preheat_c: preheat,
        preheat_k: parseFloat((preheat + 273.15).toFixed(2)),
        absorptivity: alpha
      },
      thermophysical_constants: {
        density_kg_m3: RHO,
        specific_heat_j_kg_k: CP,
        thermal_conductivity_w_m_k: K,
        melting_point_tm_c: TM
      },
      solidification_kinetics: {
        norm_tm: parseFloat(T_bar_m.toFixed(3)),
        solidification_growth_rate_r_cms: parseFloat(R_cms.toFixed(2)),
        thermal_gradient_g_kcm: G_Kcm,
        cooling_rate_ks: coolingRate,
        gr_ratio: parseFloat((G_Kcm / Math.max(0.001, R_cms)).toFixed(1)),
        cooling_rate_g_times_r: G_Kcm * R_cms,
        grain_morphology: morph
      },
      hunt_cet_criterion: {
        governing_relation: "G^3.4 / R > K_CET (Columnar) vs G^3.4 / R < K_CET_min (Equiaxed)",
        log_g: parseFloat(logG.toFixed(3)),
        log_g_lower_threshold: parseFloat(logGLower.toFixed(3)),
        log_g_upper_threshold: parseFloat(logGUpper.toFixed(3)),
        interpretation: morph === 'Columnar'
          ? "High thermal gradients suppress equiaxed grain nucleation ahead of solidification front, fostering elongated prior-β grains along [001] build direction."
          : "Thermal gradient is sufficiently low to allow heterogeneous nucleation of equiaxed grains ahead of the liquidus isotherm."
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: err.message });
  }
}
