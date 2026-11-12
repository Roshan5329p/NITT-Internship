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
    const rawProc = (q.process || '').toLowerCase();
    const rawP = parseFloat(q.power);
    const rawV = parseFloat(q.speed);
    const rawSpot = parseFloat(q.spot);
    let proc = 'lpbf';
    if (rawProc.includes('waam') || rawProc.includes('arc') || rawProc.includes('cmt')) proc = 'waam';
    else if (rawProc.includes('ded') || rawProc.includes('lmd') || rawProc.includes('lens')) proc = 'ded-laser';
    else if (rawProc.includes('binder')) proc = 'binder-jetting';
    else if (!rawProc && Number.isFinite(rawV) && rawV < 100 && Number.isFinite(rawSpot) && rawSpot >= 400) {
      proc = (rawSpot >= 2200 || (Number.isFinite(rawP) && rawP >= 2400)) ? 'waam' : 'ded-laser';
    }

    const isWaam = proc === 'waam';
    const isDed = proc === 'ded-laser';

    const rawH = parseFloat(q.hatch);
    const rawT = parseFloat(q.layer);
    const rawPre = parseFloat(q.preheat);
    const p = Math.min(50000, Math.max(10, Number.isFinite(rawP) ? rawP : (isWaam ? 2400 : (isDed ? 1600 : 280))));
    const v = Math.min(20000, Math.max(0.5, Number.isFinite(rawV) ? rawV : (isWaam ? 8 : (isDed ? 15 : 960))));
    const h = Math.min(20000, Math.max(10, (Number.isFinite(rawH) && rawH > 0) ? rawH : (isWaam ? 3500 : (isDed ? 1200 : 110))));
    const t = Math.min(10000, Math.max(5, (Number.isFinite(rawT) && rawT > 0) ? rawT : (isWaam ? 1500 : (isDed ? 450 : 40))));
    const spot = Math.min(20000, Math.max(10, Number.isFinite(rawSpot) ? rawSpot : (isWaam ? 3000 : (isDed ? 1500 : 80))));
    const preheat = Math.min(1600, Math.max(0, Number.isFinite(rawPre) ? rawPre : 200));

    const ved = (p * 1e6) / Math.max(1, v * h * t);
    const linearHeatInput = p / v; // J/mm
    const vMs = Math.max(0.001, v / 1000.0);
    const eta = isWaam ? 0.78 : (isDed ? 0.38 : 0.40);
    const absorbedP = p * eta;
    const deltaT = Math.max(50, 1650 - preheat);

    // Conduction melt pool width (Rosenthal / Eagar-Tsai)
    const widthEst = Math.sqrt((8 * absorbedP) / (Math.PI * Math.E * 4189 * 759 * deltaT * vMs));
    const width = Math.round(Math.max(spot * 0.6, widthEst * 1e6 * 0.75 + spot * 0.4));

    // Aspect ratio: conduction-dilution for L-DED / WAAM unless laser power density enters keyhole threshold
    const spotM = Math.max(1e-5, spot * 1e-6);
    const intensityWcm2 = (absorbedP / (Math.PI * 0.25 * spotM * spotM)) / 1e4;
    let aspect = 0.52 * Math.pow(Math.max(0.05, ved / 70.0), 0.25);
    if (isWaam || isDed) {
      const condAspect = (isWaam ? 0.26 : 0.28) + Math.min(0.24, linearHeatInput * (isWaam ? 0.00045 : 0.0012));
      if (intensityWcm2 > 1.5e5) {
        const khBlend = Math.min(1.0, (intensityWcm2 - 1.5e5) / 2.5e5);
        aspect = condAspect * (1 - khBlend) + Math.min(3.5, aspect) * khBlend;
      } else {
        aspect = condAspect;
      }
    }
    aspect = parseFloat(Math.max(0.22, Math.min(3.5, aspect)).toFixed(2));
    const depth = Math.round(Math.max(t * 0.2, width * aspect));
    const length = Math.round(width * ((isDed || isWaam) ? (1.35 + 0.015 * Math.min(40, v)) : (1.2 + 0.0012 * v)));

    // Cooling rate (no arbitrary 100 mm/s floor clamping on slow speeds)
    const thermalAccum = isWaam ? 0.15 : (isDed ? 0.45 : 1.0);
    const coolingRate = Math.round(Math.max(isWaam || isDed ? 1.0 : 100.0,
      thermalAccum * (2 * Math.PI * 28.4 * vMs * Math.pow(deltaT, 2)) / Math.max(5, absorbedP)));
    const t85 = Number((1.85 * linearHeatInput).toFixed(1));
    const marangoniV = Math.round(180 * Math.sqrt(p / (isWaam ? 2200.0 : (isDed ? 1500.0 : 200.0))) * Math.pow((isWaam ? 8.0 : (isDed ? 15.0 : 950.0)) / Math.max(1.0, v), 0.25));

    // Process-aware defects & ASTM qualification
    const remeltRatio = depth / Math.max(1, t);
    const ballingRatio = length / (Math.max(1, width) * Math.PI);
    let regime = 'Optimal Conduction';
    let compliant = false;
    if (isWaam) {
      if (linearHeatInput < 120 || remeltRatio < 1.2) regime = 'Lack of Fusion';
      else if (v > 25 || ballingRatio > 1.45) regime = 'Arc Humping / Balling';
      else if (linearHeatInput > 600 || aspect > 0.95) regime = 'Overheating / Bead Slump';
      else compliant = true;
    } else if (isDed) {
      if (v > 60 || ballingRatio > 1.45) regime = 'Balling Risk';
      else if (linearHeatInput < 75 || remeltRatio < 1.25) regime = 'Lack of Fusion';
      else if (linearHeatInput > 240 || aspect > 0.95) regime = aspect > 0.95 ? 'Keyholing' : 'Excessive Heat Input';
      else compliant = true;
    } else {
      if (aspect > 0.80 || ved > 95.0) regime = 'Keyholing';
      else if (ved < 55.0 || remeltRatio < 1.25) regime = 'Lack of Fusion';
      else if (ballingRatio > 1.05 || v > 1650) regime = 'Balling Risk';
      else compliant = (ved >= 55 && ved <= 95);
    }

    res.status(200).json({
      process: proc,
      inputs: { laser_power_w: p, scan_speed_mms: v, hatch_spacing_um: h, layer_thickness_um: t, spot_diameter_um: spot, preheat_temp_c: preheat, ved_j_mm3: parseFloat(ved.toFixed(2)), linear_heat_input_j_mm: parseFloat(linearHeatInput.toFixed(2)) },
      melt_pool: { width_um: width, depth_um: depth, length_um: length, aspect_ratio: aspect, mode: aspect > 0.8 ? 'Keyhole Mode' : 'Conduction Mode', remelt_ratio: parseFloat(remeltRatio.toFixed(2)) },
      thermal_kinetics: { cooling_rate_ks: coolingRate, t85_ms: t85, marangoni_velocity_mms: marangoniV },
      defect_indices: { regime: regime, keyhole_threshold: isWaam || isDed ? 0.95 : 0.80, balling_ratio: parseFloat(ballingRatio.toFixed(2)), safe_window: compliant },
      astm_f2924: { compliant: compliant },
      astm_f3187: { applicable: isDed || isWaam, compliant: (isDed || isWaam) && compliant }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}
