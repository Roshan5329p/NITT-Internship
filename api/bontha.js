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
    const p = parseFloat(q.power) || 200;
    const v = parseFloat(q.speed) || 950;
    const preheat = parseFloat(q.preheat) || 25;

    const vMs = Math.max(1e-4, v / 1000.0);
    const alpha = 0.35;
    const rho = 4420, c = 526, k = 27.0;
    const Tm = 1654, T0 = preheat;
    const alpha_Q = alpha * p;
    const T_c = (alpha_Q / (Math.PI * k)) * ((rho * c * vMs) / (2.0 * k));
    const T_bar_m = (Tm - T0) / Math.max(1e-6, T_c);

    const R_cms = vMs * 100.0 * 0.72;
    const G_Kcm = Math.round(18000.0 * Math.pow(Math.max(0.1, p / 300.0), -0.6) * Math.pow(Math.max(0.1, v / 1000.0), 0.7));
    const coolingRate = Math.round(G_Kcm * R_cms);
    const grRatio = G_Kcm / Math.max(0.01, R_cms);

    let morph = 'Columnar';
    if (grRatio < 200) morph = 'Equiaxed';
    else if (grRatio <= 1000) morph = 'Mixed (CET)';

    res.status(200).json({
      dimension: dim === '3d-bulky' ? '3D Bulky Half-Space (Bontha 2009)' : '2D Thin-Wall (Bontha 2006)',
      power_w: p,
      speed_mms: v,
      preheat_c: preheat,
      surface_growth_rate_r_cms: parseFloat(R_cms.toFixed(2)),
      surface_temperature_gradient_g_kcm: G_Kcm,
      cooling_rate_ks: coolingRate,
      gr_ratio: parseFloat(grRatio.toFixed(1)),
      morphology: morph,
      depth_stations: 10
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}
