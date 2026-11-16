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
      primary_alloys: [
        {
          id: 'ti64_gr5',
          name: 'Ti-6Al-4V (Grade 5, α+β workhorse)',
          standard: 'ASTM F2924 / AMS 4928',
          density_kg_m3: 4430,
          specific_heat_j_kg_k: 526,
          thermal_conductivity_w_m_k: 6.7,
          liquidus_c: 1668,
          beta_transus_c: 995,
          nominal_yield_strength_mpa: 865,
          nominal_uts_mpa: 950,
          minimum_elongation_pct: 10.0,
          laser_absorptivity: 0.448
        },
        {
          id: 'ti64_eli',
          name: 'Ti-6Al-4V ELI (Grade 23, medical & aerospace)',
          standard: 'ASTM F3001 / ASTM F136',
          density_kg_m3: 4420,
          specific_heat_j_kg_k: 530,
          thermal_conductivity_w_m_k: 7.1,
          liquidus_c: 1660,
          beta_transus_c: 975,
          nominal_yield_strength_mpa: 825,
          nominal_uts_mpa: 890,
          minimum_elongation_pct: 12.0,
          laser_absorptivity: 0.442
        }
      ]
    });
  } catch (err) {
    res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: err.message });
  }
}
