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
    const model = q.model || 'coen';
    const p = parseFloat(q.power) || 200;
    const v = parseFloat(q.speed) || 950;
    const spot = parseFloat(q.spot) || 80;
    const preheat = parseFloat(q.preheat) || 25;

    const vMs = Math.max(1e-4, v / 1000.0);
    const eta = model === 'coen' ? 0.40 : 0.35;
    const rho_l = 4189.0;
    const k_l = 28.4;
    const cp_l = 759.0;
    const d_diff = k_l / (rho_l * cp_l);
    const o_rad = Math.max(1e-6, (spot / 2.0) * 1e-6);
    const pe = (vMs * o_rad) / Math.max(1e-10, d_diff);
    const deltaT = Math.max(50.0, 1650.0 - preheat);
    const hs = rho_l * cp_l * deltaT + rho_l * 365000.0;

    const normH = (Math.pow(2.0, 0.75) * eta * p) / Math.max(1e-6, (hs * Math.sqrt(Math.PI * d_diff * vMs * Math.pow(o_rad, 3))));
    const dimW = 0.6536 * Math.pow(Math.max(0.1, normH), 0.42) * Math.pow(Math.max(0.01, pe), -0.18);
    const poolWidth = Math.round(Math.max(spot * 0.4, 2.0 * o_rad * dimW * 1e6));
    const y_recoil = (eta * p) / Math.max(1e-6, (2.0 * o_rad * k_l * Math.max(50.0, 3573.0 - (preheat + 273.15))));
    const b_fabbro = 0.1488 * Math.pow(Math.max(0.05, pe), -0.79);
    const r_aspect = Math.max(0.2, y_recoil * b_fabbro);
    const poolDepth = Math.round(poolWidth * r_aspect);
    const poolLength = Math.round(poolWidth * (1.2 + 0.0012 * v));
    const peakTemp = Math.min(3200, Math.round(preheat + (p * eta * 1e6) / Math.max(1, (Math.PI * 6.7 * spot))));

    res.status(200).json({
      model: model === 'coen' ? 'KU Leuven Semi-Analytical Hybrid (Coen et al. 2022)' : 'Rosenthal (1946) Analytical',
      power_w: p,
      speed_mms: v,
      spot_um: spot,
      preheat_c: preheat,
      width_um: poolWidth,
      depth_um: poolDepth,
      length_um: poolLength,
      aspect_ratio: parseFloat(r_aspect.toFixed(2)),
      peak_temp_c: peakTemp
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}
