/**
 * NIT Trichy Titanium AM Platform - Materials & Alloys Specification API
 * Strictly adheres to Ti-6Al-4V Additive Manufacturing Physics & Compliance Rules
 * Thermophysical Baseline Constants & ASTM F2924 / ASTM F3001 Compositional Specifications.
 */

import { setCorsHeaders } from './_shared.js';

export default function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      code: 'METHOD_NOT_ALLOWED',
      message: `HTTP method ${req.method} is not allowed. Use GET.`
    });
  }

  try {
    res.status(200).json({
      status: 'success',
      total_variants: 209,
      baseline_thermophysical_constants: {
        density_kg_m3: 4430,
        solidus_temperature_c: 1604,
        solidus_temperature_k: 1877.15,
        liquidus_temperature_c: 1660,
        liquidus_temperature_k: 1933.15,
        specific_heat_capacity_j_kg_k: 670, // solid-liquid average
        thermal_conductivity_w_m_k: 21.9,   // near solidus
        thermal_diffusivity_m2_s: 7.38e-6,  // alpha = k / (rho * cp)
        latent_heat_of_fusion_j_kg: 286000,
        effective_laser_absorptivity_conduction: 0.42,
        absorptivity_conduction_range: [0.35, 0.48]
      },
      primary_alloys: [
        {
          id: 'ti64_gr5',
          name: 'Ti-6Al-4V (Grade 5, α+β workhorse)',
          uns: 'R56400',
          standard: 'ASTM F2924 / AMS 4928',
          density_kg_m3: 4430,
          solidus_c: 1604,
          liquidus_c: 1660,
          beta_transus_c: 995,
          specific_heat_j_kg_k: 670,
          thermal_conductivity_w_m_k: 21.9,
          thermal_diffusivity_m2_s: 7.38e-6,
          latent_heat_j_kg: 286000,
          laser_absorptivity: 0.42,
          chemistry_wt_pct: {
            al: { min: 5.50, max: 6.75 },
            v: { min: 3.50, max: 4.50 },
            fe: { max: 0.40 },
            o: { max: 0.20 },
            c: { max: 0.08 },
            n: { max: 0.05 },
            h: { max: 0.015 },
            ti: 'balance'
          },
          astm_f2924_tensile_minimums: {
            yield_strength_rp02_mpa: 825,
            ultimate_tensile_strength_uts_mpa: 895,
            elongation_fracture_pct: 10.0,
            relative_density_pct: 99.5
          }
        },
        {
          id: 'ti64_eli',
          name: 'Ti-6Al-4V ELI (Grade 23, medical & aerospace)',
          uns: 'R56401',
          standard: 'ASTM F3001 / ASTM F136',
          density_kg_m3: 4430,
          solidus_c: 1604,
          liquidus_c: 1660,
          beta_transus_c: 975,
          specific_heat_j_kg_k: 670,
          thermal_conductivity_w_m_k: 21.9,
          thermal_diffusivity_m2_s: 7.38e-6,
          latent_heat_j_kg: 286000,
          laser_absorptivity: 0.42,
          chemistry_wt_pct: {
            al: { min: 5.50, max: 6.75 },
            v: { min: 3.50, max: 4.50 },
            fe: { max: 0.25 },
            o: { max: 0.13 },
            c: { max: 0.08 },
            n: { max: 0.03 },
            h: { max: 0.0125 },
            ti: 'balance'
          },
          astm_f3001_tensile_minimums: {
            yield_strength_rp02_mpa: 795,
            ultimate_tensile_strength_uts_mpa: 860,
            elongation_fracture_pct: 10.0,
            relative_density_pct: 99.5
          }
        }
      ]
    });
  } catch (err) {
    res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: err.message });
  }
}
