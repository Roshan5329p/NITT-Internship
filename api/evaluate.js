/**
 * NIT Trichy Titanium AM Platform - Evaluation API
 * Performs rigorous thermal physics evaluation, melt pool kinetics, and ASTM qualification.
 * Enforces strict physical parameter validation without silent clamping.
 */

import { setCorsHeaders, normalizeProcessName, validateProcessInputs } from './_shared.js';

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
    const proc = normalizeProcessName(q.process);

    // Strict physical validation - never silently clamp out-of-range experimental inputs
    const validation = validateProcessInputs(q, proc);
    if (!validation.valid) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_PHYSICAL_PARAMETER',
        message: `Validation failed: ${validation.rejected_parameters.length} parameter(s) outside physical operating limits for ${validation.process_name}.`,
        process: proc,
        process_name: validation.process_name,
        rejected_parameters: validation.rejected_parameters,
        accepted_parameters: validation.accepted_parameters
      });
    }

    const { power: p, speed: v, hatch: h, layer: t, spot, preheat } = validation.accepted_parameters;
    const isWaam = proc === 'waam';
    const isDed = proc === 'ded-laser';

    // Volumetric Energy Density (VED) and Linear Heat Input (HI)
    const ved = (p * 1e6) / (v * h * t); // J/mm³
    const linearHeatInput = p / v; // J/mm
    const vMs = v / 1000.0; // m/s
    const eta = isWaam ? 0.78 : (isDed ? 0.38 : 0.40); // Absorptivity
    const absorbedP = p * eta;
    const deltaT = Math.max(50, 1650 - preheat);

    // Conduction melt pool width (Eagar-Tsai / Rosenthal formulation)
    const rho_l = 4189.0; // Liquid density (kg/m³)
    const cp_l = 759.0;   // Liquid specific heat (J/kg·K)
    const k_l = 28.4;     // Liquid thermal conductivity (W/m·K)
    const widthEst = Math.sqrt((8 * absorbedP) / (Math.PI * Math.E * rho_l * cp_l * deltaT * vMs));
    const width = Math.round(Math.max(spot * 0.6, widthEst * 1e6 * 0.75 + spot * 0.4));

    // Aspect ratio & Recoil Pressure Keyhole Transition
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

    // Material State & ASTM Condition
    const rawPost = (q.post || q.condition || 'hip').toLowerCase();
    const isEli = (q.alloy || '').toLowerCase().includes('eli') || (q.alloy || '').toLowerCase().includes('gr23');
    const isHip = rawPost.includes('hip');
    const isSr = rawPost.includes('stress') || rawPost.includes('650');
    const isAnneal = rawPost.includes('anneal') || rawPost.includes('730');
    const isNone = rawPost.includes('none') || rawPost.includes('as-built');

    // Cooling rate & Thermal kinetics
    const thermalAccum = isWaam ? 0.15 : (isDed ? 0.45 : 1.0);
    const coolingRate = Math.round(Math.max(isWaam || isDed ? 1.0 : 100.0,
      thermalAccum * (2 * Math.PI * k_l * vMs * Math.pow(deltaT, 2)) / Math.max(5, absorbedP)));
    const t85 = Number((1.85 * linearHeatInput).toFixed(1));
    const tBetaMs = Number((2.15 * (eta / 0.40) * (p / Math.max(1.0, v))).toFixed(1));
    const betaCoolingRate = tBetaMs > 0 ? Math.round(420.0 / (tBetaMs / 1000.0)) : 0;
    const marangoniV = Math.round(180 * Math.sqrt(p / (isWaam ? 2200.0 : (isDed ? 1500.0 : 200.0))) * Math.pow((isWaam ? 8.0 : (isDed ? 15.0 : 950.0)) / Math.max(1.0, v), 0.25));

    // Defect boundary evaluation
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
      else if (aspect >= 0.55 || ved >= 65.0) regime = 'Transition Mode (Incipient Vapor Depression)';
      else if (ved < 55.0 || remeltRatio < 1.25) regime = 'Lack of Fusion';
      else if (ballingRatio > 1.05 || v > 1650) regime = 'Balling Risk';
      else regime = 'Optimal Conduction';
      compliant = (ved >= 55 && ved <= 95 && !isNone);
    }

    const modeLabel = aspect > 0.8 ? 'Keyhole Mode' : (aspect >= 0.55 ? 'Transition Mode (Incipient Vapor Depression)' : 'Conduction Mode');

    // ASTM Component Classification (F2924 Class 1 / 2 / 3 & F3001 ELI)
    let astmClass = 'Class 3';
    let astmAssessment = 'NON-COMPLIANT';
    let astmRequirements = '';

    if (isHip) {
      astmClass = 'Class 1';
      astmAssessment = compliant ? 'PRELIMINARY COMPLIANCE PASS' : 'NON-COMPLIANT (Defect Risk)';
      astmRequirements = 'Stress relieved + Hot Isostatically Pressed (920°C / 100 MPa). Full density & ductility.';
    } else if (isSr || isAnneal) {
      astmClass = 'Class 2';
      astmAssessment = compliant ? 'PRELIMINARY COMPLIANCE PASS' : 'NON-COMPLIANT (Defect Risk)';
      astmRequirements = 'Thermal stress relief applied (650°C-730°C). Residual stress relieved, moderate ductility.';
    } else {
      astmClass = 'Class 3';
      astmAssessment = 'NON-COMPLIANT (Requires Thermal Post-Processing)';
      astmRequirements = 'As-built acicular α\' martensite exhibits elongation <10% (fails ASTM F2924 Section 9 tensile minimum).';
    }

    const simulationId = 'SIM-' + Date.now().toString(36).toUpperCase();

    res.status(200).json({
      status: 'success',
      simulation_id: simulationId,
      timestamp: new Date().toISOString(),
      process: proc,
      process_name: validation.process_name,
      inputs: {
        laser_power_w: p,
        scan_speed_mms: v,
        hatch_spacing_um: h,
        layer_thickness_um: t,
        spot_diameter_um: spot,
        preheat_temp_c: preheat,
        ved_j_mm3: parseFloat(ved.toFixed(2)),
        linear_heat_input_j_mm: parseFloat(linearHeatInput.toFixed(2)),
        material_condition: rawPost,
        alloy: isEli ? 'Ti-6Al-4V Grade 23 ELI' : 'Ti-6Al-4V Grade 5'
      },
      melt_pool: {
        width_um: width,
        depth_um: depth,
        length_um: length,
        aspect_ratio: aspect,
        mode: modeLabel,
        remelt_ratio: parseFloat(remeltRatio.toFixed(2))
      },
      thermal_kinetics: {
        cooling_rate_ks: coolingRate,
        t85_ms: t85,
        t_beta_ms: tBetaMs,
        t_beta_cooling_rate_ks: betaCoolingRate,
        marangoni_velocity_mms: marangoniV
      },
      defect_indices: {
        regime: regime,
        keyhole_threshold_aspect: isWaam || isDed ? 0.95 : 0.80,
        balling_ratio: parseFloat(ballingRatio.toFixed(2)),
        safe_processing_window: compliant
      },
      qualification: {
        standard: isEli ? 'ASTM F3001-20 (Ti-6Al-4V ELI Medical)' : 'ASTM F2924-21 (Ti-6Al-4V PBF)',
        component_class: astmClass,
        assessment: astmAssessment,
        heat_treatment_protocol: astmRequirements,
        tensile_thresholds: {
          min_ys_mpa: isEli ? 795 : 825,
          min_uts_mpa: isEli ? 860 : 895,
          min_elongation_pct: 10.0
        },
        disclaimer: 'Preliminary compliance assessment based on empirical process parameters. Final certification requires full metallurgical testing, chemistry verification, and CT porosity evaluation.'
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: err.message });
  }
}
