export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const p = parseFloat(req.query.power) || 280;
  const v = parseFloat(req.query.speed) || 960;
  const h = parseFloat(req.query.hatch) || 110;
  const t = parseFloat(req.query.layer) || 40;
  const spot = parseFloat(req.query.spot) || 80;
  const preheat = parseFloat(req.query.preheat) || 200;

  const ved = (p * 1e6) / (v * h * t);
  const vMs = v / 1000.0;
  const eta = 0.448;
  const deltaT = Math.max(50, 1668 - preheat);

  // Rosenthal 3D
  const widthEst = Math.sqrt((8 * p * eta) / (Math.PI * Math.E * 4430 * 526 * deltaT * Math.max(0.01, vMs)));
  const width = Math.round(Math.max(spot * 0.5, widthEst * 1e6 * 0.75 + spot * 0.4));
  const depth = Math.round(Math.max(t * 0.2, width * 0.52 * Math.pow(Math.max(0.05, ved / 70.0), 0.25)));
  const length = Math.round(width * (1.2 + 0.0012 * v));
  const aspect = parseFloat((depth / Math.max(1, width)).toFixed(2));

  // Cooling rate
  const coolingRate = Math.round(Math.max(10, (2 * Math.PI * 6.7 * vMs * Math.pow(deltaT, 2)) / Math.max(5, p * eta)));
  const t85 = Number((1.85 * (p / Math.max(100, v))).toFixed(1));

  // Defects
  let regime = 'Optimal Conduction';
  if (aspect > 0.80) regime = 'Keyholing';
  else if (ved < 55.0) regime = 'Lack of Fusion';
  else if (length / Math.max(1, width) > Math.PI) regime = 'Balling Risk';

  res.status(200).json({
    inputs: { laser_power_w: p, scan_speed_mms: v, hatch_spacing_um: h, layer_thickness_um: t, spot_diameter_um: spot, preheat_temp_c: preheat, ved_j_mm3: parseFloat(ved.toFixed(2)) },
    melt_pool: { width_um: width, depth_um: depth, length_um: length, aspect_ratio: aspect, mode: aspect > 0.8 ? 'Keyhole Mode' : 'Conduction Mode', remelt_ratio: parseFloat((depth / Math.max(1, t)).toFixed(2)) },
    thermal_kinetics: { cooling_rate_ks: coolingRate, t85_ms: t85, marangoni_velocity_mms: Math.round(180 * Math.sqrt(p / 200.0) * Math.pow(950 / Math.max(100, v), 0.25)) },
    defect_indices: { regime: regime, keyhole_threshold: 0.80, balling_ratio: parseFloat((length / Math.max(1, width)).toFixed(2)) },
    astm_f2924: { compliant: aspect <= 0.80 && ved >= 55 && ved <= 85 }
  });
}
