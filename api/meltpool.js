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
    const model = (q.model || 'coen').toLowerCase();
    const rawProc = (q.process || '').toLowerCase();
    const rawP = parseFloat(q.power);
    const rawV = parseFloat(q.speed);
    const rawSpot = parseFloat(q.spot);

    let proc = 'lpbf';
    if (rawProc.includes('waam') || rawProc.includes('arc') || rawProc.includes('cmt')) proc = 'waam';
    else if (rawProc.includes('ded') || rawProc.includes('lmd') || rawProc.includes('lens')) proc = 'ded-laser';
    else if (!rawProc && Number.isFinite(rawV) && rawV < 100 && Number.isFinite(rawSpot) && rawSpot >= 400) {
      proc = (rawSpot >= 2200 || (Number.isFinite(rawP) && rawP >= 2400)) ? 'waam' : 'ded-laser';
    }

    const isWaam = proc === 'waam';
    const isDed = proc === 'ded-laser';
    const p = Math.max(10, Number.isFinite(rawP) ? rawP : (isWaam ? 2400 : (isDed ? 1600 : 200)));
    const v = Math.max(0.5, Number.isFinite(rawV) ? rawV : (isWaam ? 8 : (isDed ? 15 : 950)));
    const spot = Math.max(10, Number.isFinite(rawSpot) ? rawSpot : (isWaam ? 3000 : (isDed ? 1500 : 80)));
    const preheat = Number.isFinite(parseFloat(q.preheat)) ? parseFloat(q.preheat) : 25;

    const vMs = Math.max(1e-4, v / 1000.0);
    const eta = isWaam ? 0.78 : (isDed ? 0.38 : (model === 'coen' ? 0.40 : 0.35));
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
    let poolWidth = Math.round(Math.max(spot * 0.4, 2.0 * o_rad * dimW * 1e6));
    const y_recoil = (eta * p) / Math.max(1e-6, (2.0 * o_rad * k_l * Math.max(50.0, 3573.0 - (preheat + 273.15))));
    const b_fabbro = 0.1488 * Math.pow(Math.max(0.05, pe), -0.79);
    let r_aspect = Math.min(3.5, Math.max(0.2, y_recoil * b_fabbro));

    if (isWaam || isDed) {
      const wEst = Math.sqrt((8.0 * eta * p) / (Math.PI * Math.E * rho_l * cp_l * deltaT * Math.max(0.002, vMs)));
      poolWidth = Math.round(Math.max(spot * 0.85, wEst * 1e6 * 0.75 + spot * 0.40));
      const hiJmm = p / v;
      const condAspect = (isWaam ? 0.26 : 0.28) + Math.min(0.24, hiJmm * (isWaam ? 0.00045 : 0.0012));
      const areaM2 = Math.PI * o_rad * o_rad;
      const intensityWcm2 = ((eta * p) / areaM2) / 1e4;
      r_aspect = intensityWcm2 > 1.5e5
        ? condAspect * (1 - Math.min(1, (intensityWcm2 - 1.5e5) / 2.5e5)) + r_aspect * Math.min(1, (intensityWcm2 - 1.5e5) / 2.5e5)
        : condAspect;
      r_aspect = Math.max(0.2, Math.min(3.5, r_aspect));
    }

    const poolDepth = Math.round(poolWidth * r_aspect);
    const poolLength = Math.round(poolWidth * ((isWaam || isDed) ? (1.35 + 0.015 * Math.min(40, v)) : (1.2 + 0.0012 * v)));
    const peakTemp = (isWaam || isDed)
      ? Math.min(isWaam ? 2950 : 3200, Math.max(1750, Math.round(preheat + (eta * p * 1e6) / (Math.PI * k_l * (spot * 0.5) * 2.5))))
      : Math.min(3200, Math.round(preheat + (p * eta * 1e6) / Math.max(1, (Math.PI * 6.7 * spot))));

    res.status(200).json({
      model: model === 'coen' ? 'KU Leuven Semi-Analytical Hybrid (Coen et al. 2022)' : 'Rosenthal (1946) Analytical',
      process: proc,
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
