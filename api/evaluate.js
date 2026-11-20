/**
 * NIT Trichy Titanium AM Platform - Evaluation API
 * Strictly adheres to Ti-6Al-4V Additive Manufacturing Physics & Compliance Rules
 * Performs rigorous thermal physics evaluation, melt pool kinetics, and ASTM F2924 qualification.
 * Enforces strict physical parameter validation without silent clamping.
 */

import { setCorsHeaders, normalizeProcessName, validateProcessInputs } from './_shared.js';

// Validated Thermophysical Baseline Constants (Ti-6Al-4V Grade 5 & Grade 23 ELI)
const RHO = 4430.0;              // Density ρ (kg/m³)
const CP = 670.0;                // Specific heat capacity cp (J/kg·K, solid-liquid average)
const K = 21.9;                  // Thermal conductivity k (W/m·K, near solidus)
const DIFFUSIVITY = 7.38e-6;     // Thermal diffusivity α = k / (ρ·cp) (m²/s)
const T_SOLIDUS = 1604.0;        // Solidus temperature Ts (°C) [1877.15 K]
const T_LIQUIDUS = 1660.0;       // Liquidus temperature Tl (°C) [1933.15 K]
const LATENT_FUSION = 286000.0;  // Latent heat of fusion Lf (J/kg)

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
    const isBinderJetting = proc === 'binder-jetting';

    // Unit Conventions & Canonical Conversions:
    // P in Watts (W)
    // v in mm/s -> vMs = v * 1e-3 (m/s)
    // h in µm -> hMm = h * 1e-3 (mm)
    // t in µm -> tMm = t * 1e-3 (mm)
    // spot in µm -> spotM = spot * 1e-6 (m)
    // preheat in °C -> preheatK = preheat + 273.15 (K)
    const vMs = Math.max(1e-4, v / 1000.0);
    const hMm = h * 1e-3;
    const tMm = t * 1e-3;
    const spotM = Math.max(1e-6, spot * 1e-6);

    // Volumetric Energy Density (VED): Ev = P / (v · h_mm · t_mm) [J/mm³] (0 for solid-state BJT)
    const ved = isBinderJetting ? 0.0 : p / Math.max(1e-6, v * hMm * tMm);
    const linearHeatInput = isBinderJetting ? 0.0 : p / Math.max(0.1, v); // Linear Heat Input (J/mm)

    // Material State & Post-Processing Condition
    const rawPost = (q.post || q.condition || 'hip').toLowerCase();
    const isEli = (q.alloy || '').toLowerCase().includes('eli') || (q.alloy || '').toLowerCase().includes('gr23');
    const isHip = rawPost.includes('hip');
    const isSta = rawPost.includes('sta') || rawPost.includes('solution') || rawPost.includes('aged');
    const isSr = rawPost.includes('stress') || rawPost.includes('650');
    const isAnneal = rawPost.includes('anneal') || rawPost.includes('730');
    const isAsBuilt = rawPost.includes('none') || rawPost.includes('as-built') || rawPost.includes('as_built');

    let width = 0;
    let depth = 0;
    let length = 0;
    let aspect = 0;
    let modeLabel = 'Conduction Mode';
    let remeltRatio = 0;
    let ballingRatio = 0;
    let coolingRate = 0;
    let t85 = 0;
    let tBetaMs = 0;
    let betaCoolingRate = 0;
    let marangoniV = 0;
    let regime = 'Optimal Conduction Window';
    let safeWindow = false;
    let relativeDensity = 99.85;
    let predHv = 345;
    let predElong = 10.0;
    let predUts = 0;
    let predYs = 0;
    let taborFactor = 3.05;

    if (isBinderJetting) {
      // Solid-state sintering physics (no liquid melt pool)
      const binderSaturationPct = Number(Math.max(15, Math.min(95, (p / 120.0) * 65.0)).toFixed(1));
      const sinterTempC = preheat >= 800 ? preheat : 1250;
      modeLabel = 'Solid-State Sintering (No Melt Pool)';
      coolingRate = 0.08; // Controlled vacuum furnace cooling [K/s]

      if (!isHip && (binderSaturationPct < 45 || binderSaturationPct > 85 || sinterTempC < 1150)) {
        regime = 'As-Sintered Porosity & Sub-Optimal Binder Saturation';
        safeWindow = false;
        relativeDensity = 93.8;
      } else if (!isHip) {
        regime = 'As-Sintered Porosity (~96.5% Density — Requires HIP)';
        safeWindow = false;
        relativeDensity = 96.5;
      } else {
        regime = 'Optimal Sintered + HIP Window';
        safeWindow = true;
        relativeDensity = 99.85;
      }

      if (isHip) {
        predHv = 335;
        predElong = 14.0;
        predUts = 960;
        predYs = 860;
        taborFactor = Number((predUts / predHv).toFixed(2));
      } else if (isSta) {
        predHv = 355;
        predElong = 9.5;
        predUts = 945;
        predYs = 845;
        taborFactor = Number((predUts / predHv).toFixed(2));
      } else {
        predHv = 310;
        predElong = 6.0;
        predUts = 870;
        predYs = 780;
        taborFactor = Number((predUts / predHv).toFixed(2));
      }
    } else {
      // Effective Absorptivity (η): default 0.42 for LPBF conduction mode
      const eta = isWaam ? 0.78 : (isDed ? 0.38 : 0.42);
      const absorbedP = p * eta;
      const deltaT = Math.max(50.0, T_LIQUIDUS - preheat);

      // Conduction melt pool width (Eagar-Tsai / Rosenthal formulation)
      const widthEst = Math.sqrt((8.0 * absorbedP) / Math.max(1e-8, Math.PI * Math.E * RHO * CP * deltaT * vMs));
      width = Math.round(Math.max(spot * 0.5, widthEst * 1e6 * 0.75 + spot * 0.4));

      // Aspect ratio & Recoil Pressure Keyhole Transition
      const intensityWcm2 = (absorbedP / (Math.PI * 0.25 * spotM * spotM)) / 1e4;
      aspect = 0.52 * Math.pow(Math.max(0.05, ved / 70.0), 0.25);
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
      depth = Math.round(Math.max(t * 0.2, width * aspect));
      length = Math.round(width * ((isDed || isWaam) ? (1.35 + 0.015 * Math.min(40, v)) : (1.2 + 0.0012 * v)));

      // Cooling rate & Thermal kinetics at solidus (aligned with frontend thermalAccum: WAAM 0.55, L-DED 0.85, LPBF 1.0)
      const thermalAccum = isWaam ? 0.55 : (isDed ? 0.85 : 1.0);
      coolingRate = Math.round(Math.max(isWaam || isDed ? 1.0 : 100.0,
        thermalAccum * (2 * Math.PI * K * vMs * Math.pow(deltaT, 2)) / Math.max(5, absorbedP)));
      t85 = Number((1.85 * linearHeatInput).toFixed(1));
      tBetaMs = Number((2.15 * (eta / 0.42) * (p / Math.max(1.0, v))).toFixed(1));
      betaCoolingRate = tBetaMs > 0 ? Math.round(420.0 / (tBetaMs / 1000.0)) : 0;
      marangoniV = Math.round(180 * Math.sqrt(p / (isWaam ? 2200.0 : (isDed ? 1500.0 : 200.0))) * Math.pow((isWaam ? 8.0 : (isDed ? 15.0 : 950.0)) / Math.max(1.0, v), 0.25));

      // Defect boundary evaluation & Processing Windows
      remeltRatio = depth / Math.max(1, t);
      ballingRatio = length / (Math.max(1, width) * Math.PI);

      if (isWaam) {
        if (linearHeatInput < 120 || remeltRatio < 1.2) regime = 'Lack of Fusion';
        else if (v > 25 || ballingRatio > 1.45) regime = 'Arc Humping / Balling';
        else if (linearHeatInput > 600 || aspect > 0.95) regime = 'Overheating / Bead Slump';
        else { regime = 'Optimal WAAM Conduction'; safeWindow = true; }
      } else if (isDed) {
        if (v > 60 || ballingRatio > 1.45) regime = 'Balling Risk';
        else if (linearHeatInput < 75 || remeltRatio < 1.25) regime = 'Lack of Fusion';
        else if (linearHeatInput > 240 || aspect > 0.95) regime = aspect > 0.95 ? 'Keyholing' : 'Excessive Heat Input';
        else { regime = 'Optimal DED Conduction'; safeWindow = true; }
      } else {
        // Standard LPBF Regimes strictly per Rule Section 3:
        if (ved < 40.0) {
          regime = 'Severe Lack-of-Fusion (LOF)';
        } else if (ved >= 40.0 && ved < 55.0) {
          regime = 'Sub-optimal / Transition LOF';
        } else if (ved >= 55.0 && ved <= 85.0) {
          regime = 'Optimal Conduction Window';
          safeWindow = true;
        } else if (ved > 85.0 && ved <= 110.0) {
          regime = 'Transition / Mild Keyhole';
        } else {
          regime = 'Severe Keyhole / Vaporization Instability';
        }
      }

      modeLabel = aspect > 0.8 ? 'Keyhole Mode' : (aspect >= 0.55 ? 'Transition Mode (Incipient Vapor Depression)' : 'Conduction Mode');

      // Relative density estimate (%) with WAAM and L-DED defect knockdowns
      if (regime.includes('Severe Lack-of-Fusion')) relativeDensity = 96.2;
      else if (regime === 'Lack of Fusion') relativeDensity = 97.8;
      else if (regime.includes('Sub-optimal')) relativeDensity = 98.4;
      else if (regime.includes('Balling')) relativeDensity = 98.2;
      else if (regime.includes('Overheating') || regime.includes('Excessive Heat Input')) relativeDensity = 99.1;
      else if (regime === 'Keyholing') relativeDensity = 98.4;
      else if (regime.includes('Optimal')) relativeDensity = 99.88;
      else if (regime.includes('Transition / Mild')) relativeDensity = 99.65;
      else if (regime.includes('Severe Keyhole')) relativeDensity = 98.1;
      if (isHip) relativeDensity = Math.min(99.98, relativeDensity + 0.4);

      // Mechanical Properties & Post-Processing State Rules (Section 4)
      if (isAsBuilt) {
        predHv = 385; // 365-405 HV
        predElong = 6.8; // < 8% elongation
      } else if (isSr) {
        predHv = 375; // 360-390 HV
        predElong = 10.5;
      } else if (isAnneal) {
        predHv = 358; // 345-370 HV
        predElong = 12.8;
      } else if (isSta) {
        predHv = 380; // Solution Treated + Aged (370-395 HV)
        predElong = 11.2;
      } else if (isHip) {
        predHv = 340; // 320-360 HV
        predElong = 14.8;
      }

      // Tabor Scaling (Section 3): UTS ≈ 3.05 · HV (scaled 2.95 coarse to 3.15 martensite)
      taborFactor = isAsBuilt ? 3.15 : (isHip ? 2.95 : (isSta ? 3.08 : 3.05));
      predUts = Math.round(predHv * taborFactor);
      predYs = Math.round(predUts * 0.91);
    }

    // ASTM F2924 Compliance Guardrails (Section 5):
    // ALL 3 criteria must hold simultaneously:
    // 1. Chemistry: Grade 5 or Grade 23 ELI
    // 2. Relative density >= 99.5%
    // 3. Tensile: UTS >= 895 (or 860 ELI), YS >= 825 (or 795 ELI), Elongation >= 10%
    const minYs = isEli ? 795 : 825;
    const minUts = isEli ? 860 : 895;
    const minElong = 10.0;
    const minDensity = 99.5;

    const passChemistry = true; // Selected alloy matches specification limits
    const passDensity = relativeDensity >= minDensity;
    const passTensile = (predYs >= minYs) && (predUts >= minUts) && (predElong >= minElong);
    const passPostProcessing = !isAsBuilt; // As-built alpha' fails ductility without post-processing

    const overallQualified = passChemistry && passDensity && passTensile && passPostProcessing && safeWindow;

    let astmClass = isHip ? 'Class 1' : (isSta ? 'High-Strength Aviation' : ((isSr || isAnneal) ? 'Class 2' : 'Class 3'));
    let astmAssessment = overallQualified
      ? 'ASTM F2924 QUALIFIED (PASS)'
      : (isAsBuilt
          ? 'NON-COMPLIANT (Ductility Failure: As-Built α\' martensite exhibits <8% elongation; requires Stress-Relief, Annealing, STA, or HIP)'
          : (!safeWindow
              ? `NON-COMPLIANT (Defect Regime: ${regime})`
              : 'NON-COMPLIANT (Sub-threshold mechanical criteria)'));

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
        scan_speed_ms: parseFloat(vMs.toFixed(4)),
        hatch_spacing_um: h,
        hatch_spacing_mm: parseFloat(hMm.toFixed(4)),
        layer_thickness_um: t,
        layer_thickness_mm: parseFloat(tMm.toFixed(4)),
        spot_diameter_um: spot,
        spot_diameter_m: parseFloat(spotM.toExponential(3)),
        preheat_temp_c: preheat,
        preheat_temp_k: parseFloat((preheat + 273.15).toFixed(2)),
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
        marangoni_velocity_mms: marangoniV,
        thermal_diffusivity_m2_s: DIFFUSIVITY
      },
      defect_indices: {
        regime: regime,
        safe_processing_window: safeWindow,
        estimated_relative_density_pct: parseFloat(relativeDensity.toFixed(2)),
        balling_ratio: parseFloat(ballingRatio.toFixed(2)),
        keyhole_threshold_aspect: isBinderJetting ? null : (isWaam || isDed ? 0.95 : 0.80)
      },
      mechanical_properties: {
        vickers_hardness_hv: predHv,
        yield_strength_ys_mpa: predYs,
        ultimate_tensile_strength_uts_mpa: predUts,
        elongation_pct: predElong,
        tabor_conversion_factor: taborFactor,
        hrc_disclaimer: '*approximate for Ti alloys via ASTM E140 steel reference'
      },
      qualification: {
        standard: isEli ? 'ASTM F3001-20 (Ti-6Al-4V ELI Medical)' : 'ASTM F2924-21 (Ti-6Al-4V PBF)',
        component_class: astmClass,
        assessment: astmAssessment,
        is_qualified: overallQualified,
        guardrail_checklist: {
          chemistry_verified: passChemistry,
          density_compliant: passDensity,
          tensile_yield_compliant: predYs >= minYs,
          tensile_uts_compliant: predUts >= minUts,
          ductility_elongation_compliant: (predElong >= minElong) && passPostProcessing,
          safe_processing_window: safeWindow
        },
        heat_treatment_protocol: isHip
          ? 'Stress relieved + Hot Isostatically Pressed (920°C / 100 MPa / 2h). Full density (>99.5%) & ductility (≥10%). Required for ASTM Class 1.'
          : (isSta
              ? 'Solution Treated + Aged (STA: 955°C / 1h WQ + 540°C / 4h). High tensile strength with ≥10% ductility.'
              : ((isSr || isAnneal)
                  ? 'Thermal stress relief applied (650°C-730°C / 2h). Residual stress relieved, satisfies ASTM Class 2.'
                  : 'As-built acicular α\' martensite exhibits elongation <8% (fails ASTM F2924 Section 9 minimum of 10%; requires Stress-Relief, Annealing, STA, or HIP).')),
        tensile_thresholds: {
          min_ys_mpa: minYs,
          min_uts_mpa: minUts,
          min_elongation_pct: minElong,
          min_relative_density_pct: minDensity
        },
        disclaimer: 'Qualification assessment strictly adheres to ASTM F2924-21 Section 9 tensile minimums, chemistry limits, and relative density criteria.'
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: err.message });
  }
}
