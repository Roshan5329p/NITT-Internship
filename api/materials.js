export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  res.status(200).json({
    materials: [
      {
        id: 'ti64_gr5',
        name: 'Ti-6Al-4V (Grade 5, α+β workhorse)',
        density_kg_m3: 4430,
        specific_heat_j_kg_k: 526,
        thermal_conductivity_w_m_k: 6.7,
        liquidus_c: 1668,
        beta_transus_c: 995,
        nominal_uts_mpa: 950,
        laser_absorptivity: 0.448
      },
      {
        id: 'ti64_eli',
        name: 'Ti-6Al-4V ELI (Grade 23, medical & aerospace)',
        density_kg_m3: 4420,
        specific_heat_j_kg_k: 530,
        thermal_conductivity_w_m_k: 7.1,
        liquidus_c: 1660,
        beta_transus_c: 975,
        nominal_uts_mpa: 890,
        laser_absorptivity: 0.442
      }
    ]
  });
}
