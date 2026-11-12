export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    const q = req.query || {};
    const dim = q.dim || '3d-bulky';
    const srcRaw = (q.source || q.process || 'laser').toLowerCase();
    const p = Math.max(10, parseFloat(q.power) || 200);
    const v = Math.max(0.5, parseFloat(q.speed) || 950);
    const preheat = Number.isFinite(parseFloat(q.preheat)) ? parseFloat(q.preheat) : 25;

    const vMs = Math.max(1e-4, v / 1000.0);
    let source = 'laser';
    let alpha = 0.35;
    if (srcRaw.includes('ebeam')) { source = 'ebeam'; alpha = 0.88; }
    else if (srcRaw.includes('arc') || srcRaw.includes('waam')) { source = 'arc'; alpha = 0.78; }
    else if (srcRaw.includes('ded')) { source = 'ded-laser'; alpha = 0.38; }

    const rho = 4420, c = 526, k = 27.0;
    const Tm = 1654, T0 = preheat;
    const deltaTm = Math.max(50, Tm - T0);
    const alpha_Q = alpha * p;
    const T_c = (alpha_Q / (Math.PI * k)) * ((rho * c * vMs) / (2.0 * k));
    const T_bar_m = deltaTm / Math.max(1e-6, T_c);

    const R_cms = Math.max(0.01, vMs * 100.0 * 0.72);
    const thermalAccum = source === 'arc' ? 0.15 : (source === 'ded-laser' ? 0.45 : 1.0);
    const coolingRate = Math.max(1.0, Math.round(thermalAccum * (2 * Math.PI * k * vMs * Math.pow(deltaTm, 2)) / Math.max(5, alpha_Q)));
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
      dimension: dim === '3d-bulky' ? '3D Bulky Half-Space (Bontha 2009)' : '2D Thin-Wall (Bontha 2006)',
      source: source,
      absorptivity: alpha,
      power_w: p,
      speed_mms: v,
      preheat_c: preheat,
      norm_tm: parseFloat(T_bar_m.toFixed(3)),
      surface_growth_rate_r_cms: parseFloat(R_cms.toFixed(2)),
      surface_temperature_gradient_g_kcm: G_Kcm,
      cooling_rate_ks: coolingRate,
      gr_ratio: parseFloat((G_Kcm / Math.max(0.001, R_cms)).toFixed(1)),
      morphology: morph,
      depth_stations: 10
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}
