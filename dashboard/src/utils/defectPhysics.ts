/**
 * Defect Physics & Process Window Classifier Engine
 * Implements King's Normalized Enthalpy, Eagar-Tsai conduction criteria,
 * Keyholing threshold, Lack-of-Fusion boundary, and Plateau-Rayleigh balling instabilities.
 */

import { ALLOY_THERMAL_PROPERTIES } from './amPhysicsEngine';

export interface DefectAnalysisResult {
  regime: 'conduction' | 'keyhole' | 'lack-of-fusion' | 'balling';
  regimeLabel: string;
  regimeColor: string;
  regimeDescription: string;
  normalizedEnthalpy: number; // H = (A * P) / (rho * Cp * Tm * sqrt(pi * alpha * v * sigma^3))
  aspectRatio: number; // Melt pool depth to width ratio (d/w)
  keyholeRiskPct: number; // 0 - 100%
  lackOfFusionRiskPct: number; // 0 - 100%
  ballingRiskPct: number; // 0 - 100%
  overallPorosityRiskPct: number; // 0 - 100% estimated defect probability
  recommendedFix: string;
  parameterBoundaries: {
    minConductionSpeedMmS: number;
    maxConductionSpeedMmS: number;
    minConductionPowerW: number;
    maxConductionPowerW: number;
  };
}

export interface AlloyThermalParams {
  absorptivity: number;
  densityKgM3: number;
  specificHeatJPerKgK: number;
  meltingTempC: number;
  thermalDiffusivityM2S: number; // alpha = k / (rho * Cp)
}

// Thermal physical constants for primary alloy categories
const ALLOY_PHYSICAL_PARAMS: Record<string, AlloyThermalParams> = {
  'ti-6al-4v': {
    absorptivity: 0.35,
    densityKgM3: 4430,
    specificHeatJPerKgK: 526,
    meltingTempC: 1660,
    thermalDiffusivityM2S: 2.85e-6,
  },
  'ti-6al-4v-eli': {
    absorptivity: 0.35,
    densityKgM3: 4430,
    specificHeatJPerKgK: 530,
    meltingTempC: 1660,
    thermalDiffusivityM2S: 2.90e-6,
  },
  'ti-6242': {
    absorptivity: 0.36,
    densityKgM3: 4540,
    specificHeatJPerKgK: 500,
    meltingTempC: 1700,
    thermalDiffusivityM2S: 2.70e-6,
  },
  'ti-5553': {
    absorptivity: 0.38,
    densityKgM3: 4650,
    specificHeatJPerKgK: 480,
    meltingTempC: 1620,
    thermalDiffusivityM2S: 2.60e-6,
  },
  'ti-grade-2': {
    absorptivity: 0.34,
    densityKgM3: 4510,
    specificHeatJPerKgK: 520,
    meltingTempC: 1668,
    thermalDiffusivityM2S: 3.50e-6,
  },
  'ti-gamma-tial': {
    absorptivity: 0.40,
    densityKgM3: 3900,
    specificHeatJPerKgK: 610,
    meltingTempC: 1480,
    thermalDiffusivityM2S: 3.10e-6,
  },
};

export function getAlloyThermalParams(alloyId: string): AlloyThermalParams {
  const thermalProps = ALLOY_THERMAL_PROPERTIES[alloyId];
  return thermalProps
    ? {
        absorptivity: thermalProps.laserAbsorptivity || 0.35,
        densityKgM3: thermalProps.density || 4430,
        specificHeatJPerKgK: thermalProps.specificHeat || 526,
        meltingTempC: thermalProps.liquidusC || 1660,
        thermalDiffusivityM2S:
          (thermalProps.thermalConductivity || 8.0) /
          ((thermalProps.density || 4430) * (thermalProps.specificHeat || 526)),
      }
    : ALLOY_PHYSICAL_PARAMS[alloyId] || ALLOY_PHYSICAL_PARAMS['ti-6al-4v'];
}

export function calculateKeyholePowerBoundary(
  alloyId: string,
  beamSpotDiameterUm: number,
  preheatTempC: number,
  scanSpeedMmS: number
): number {
  const params = getAlloyThermalParams(alloyId);
  const deltaT = Math.max(100, params.meltingTempC - preheatTempC);
  const v_m = Math.max(0.01, scanSpeedMmS / 1000);
  const ds_m = Math.max(10e-6, beamSpotDiameterUm * 1e-6);
  const denom = Math.PI * params.densityKgM3 * params.specificHeatJPerKgK * deltaT *
    Math.sqrt(params.thermalDiffusivityM2S * v_m * Math.pow(ds_m, 3));
  return (26.0 * denom) / params.absorptivity;
}

export function calculateLofPowerBoundary(
  hatchSpacingUm: number,
  layerThicknessUm: number,
  scanSpeedMmS: number
): number {
  return Math.max(50, 45 * scanSpeedMmS * (hatchSpacingUm * 1e-3) * (layerThicknessUm * 1e-3));
}

export function calculateDefectRegime(
  alloyId: string,
  laserPowerW: number,
  scanSpeedMmS: number,
  hatchSpacingUm: number,
  layerThicknessUm: number,
  beamSpotDiameterUm: number,
  preheatTempC = 25
): DefectAnalysisResult {
  const params = getAlloyThermalParams(alloyId);

  // Convert inputs to SI units
  const P = Math.max(10, laserPowerW);
  const v = Math.max(0.01, scanSpeedMmS / 1000); // m/s
  const ds_m = Math.max(10e-6, beamSpotDiameterUm * 1e-6); // beam diameter in m
  const sigma = ds_m / 2; // beam radius in m
  const h = Math.max(10e-6, hatchSpacingUm * 1e-6); // m
  const t = Math.max(10e-6, layerThicknessUm * 1e-6); // m
  const deltaT = Math.max(100, params.meltingTempC - preheatTempC);

  // Volumetric Energy Density (J/mm^3)
  const ved = (P / ((scanSpeedMmS) * (hatchSpacingUm * 1e-3) * (layerThicknessUm * 1e-3)));

  // King's Normalized Enthalpy (King et al. 2014, Nature Comm 5:3523):
  // H = (A * P) / (pi * rho * Cp * deltaT * sqrt(alpha * v * ds^3))
  // Canonical critical keyhole onset threshold: H_crit = 26.0 (Safe conduction window: 8.0 - 26.0)
  const denominator = Math.PI * params.densityKgM3 * params.specificHeatJPerKgK * deltaT *
    Math.sqrt(params.thermalDiffusivityM2S * v * Math.pow(ds_m, 3));
  const normalizedEnthalpy = denominator > 0 ? (params.absorptivity * P) / denominator : 5.0;

  // Semi-analytical Rosenthal & Eagar-Tsai melt pool dimensions
  const absorbedP = P * params.absorptivity;
  const widthScale = Math.sqrt((8 * absorbedP) / (Math.PI * Math.E * params.densityKgM3 * params.specificHeatJPerKgK * deltaT * v));
  const poolWidthUm = Math.min(800, Math.max(beamSpotDiameterUm * 0.5, widthScale * 1e6 * 0.75 + beamSpotDiameterUm * 0.4));

  // King's Normalized Enthalpy Keyhole Threshold for Ti-6Al-4V (King et al. 2014: ΔH/hs > 26–28)
  const keyholeThreshold = 26.0;

  // Depth in conduction mode vs keyholing
  let poolDepthUm: number;
  if (normalizedEnthalpy > keyholeThreshold) {
    // Keyhole threshold exceeded: vapor recoil pressure drills a deep narrow keyhole
    const excess = normalizedEnthalpy - keyholeThreshold;
    poolDepthUm = poolWidthUm * (0.65 + 0.045 * excess);
  } else {
    // Conduction mode: shallow, stable melt track (aspect ratio 0.35 to 0.55)
    const optVed = 70;
    const baseDepth = poolWidthUm * 0.52 * Math.pow(Math.max(0.05, ved / optVed), 0.25);
    poolDepthUm = Math.max(layerThicknessUm * 0.2, baseDepth);
  }

  const aspectRatio = poolWidthUm > 0 ? poolDepthUm / poolWidthUm : 0.52;

  // Linear Energy Density (J/mm)
  const linearEnergyJPerMm = P / scanSpeedMmS;

  // Defect Risk Calculations:
  // 1. Keyholing Risk: Triggered when normalized enthalpy H > 26 or aspect ratio > 0.75
  let keyholeRiskPct = 0;
  if (normalizedEnthalpy > keyholeThreshold || aspectRatio > 0.75) {
    const excess = Math.max((normalizedEnthalpy - keyholeThreshold) / 6, (aspectRatio - 0.75) * 4);
    keyholeRiskPct = Math.min(100, Math.round(40 + excess * 50));
  } else {
    // Baseline safe minimal risk in conduction mode
    keyholeRiskPct = Math.max(2, Math.round((normalizedEnthalpy / keyholeThreshold) * 12));
  }

  // 2. Lack of Fusion Risk: Triggered when enthalpy is low (H < 7.5), depth < 1.35 * layer thickness, or overlap < 1.15
  let lackOfFusionRiskPct = 0;
  const depthToLayerRatio = poolDepthUm / layerThicknessUm;
  const overlapRatio = poolWidthUm / hatchSpacingUm;

  if (normalizedEnthalpy < 7.5 || depthToLayerRatio < 1.35 || overlapRatio < 1.15 || ved < 45) {
    const enthalpyDeficit = Math.max(0, (7.5 - normalizedEnthalpy) / 7.5) * 40;
    const depthDeficit = Math.max(0, 1.35 - depthToLayerRatio) * 35;
    const overlapDeficit = Math.max(0, 1.15 - overlapRatio) * 30;
    const vedDeficit = Math.max(0, (45 - ved) / 45) * 30;
    lackOfFusionRiskPct = Math.min(100, Math.round(Math.max(enthalpyDeficit, depthDeficit) + overlapDeficit + vedDeficit));
  } else {
    lackOfFusionRiskPct = Math.max(3, Math.round((1 - Math.min(1, depthToLayerRatio / 2.5)) * 10));
  }

  // 3. Balling / Humping Risk: Plateau-Rayleigh instability occurs when melt pool length / width > pi (~3.14)
  // High scan speed stretches the melt pool length: L ~ v * (poolWidth^2 / alpha)
  let ballingRiskPct = 0;
  const lengthToWidthRatio = 1.2 + (scanSpeedMmS / 480) * (beamSpotDiameterUm / 100);
  if (lengthToWidthRatio > 3.14 || scanSpeedMmS > 1650) {
    const excess = Math.max(lengthToWidthRatio - 3.14, (scanSpeedMmS - 1650) / 350);
    ballingRiskPct = Math.min(100, Math.round(45 + excess * 45));
  } else {
    ballingRiskPct = Math.max(3, Math.round((scanSpeedMmS / 1650) * 12));
  }

  // Determine Dominant Regime
  let regime: DefectAnalysisResult['regime'] = 'conduction';
  let regimeLabel = 'Stable Conduction Mode';
  let regimeColor = '#10b981'; // emerald
  let regimeDescription = 'Optimal melt track stability with low porosity, good metallurgical bonding, and fine microstructure.';
  let recommendedFix = 'Current parameters are inside the optimal conduction printing window. Ideal for structural qualification.';

  if (keyholeRiskPct > 45 && keyholeRiskPct >= lackOfFusionRiskPct && keyholeRiskPct >= ballingRiskPct) {
    regime = 'keyhole';
    regimeLabel = 'Keyholing Porosity Regime';
    regimeColor = '#ef4444'; // red
    regimeDescription = 'Vapor recoil pressure creates a deep, unstable vapor depression. Capillary collapse traps spherical gas voids at the root.';
    const deltaSpeed = Math.round(Math.max(100, (normalizedEnthalpy - 24.0) * 80));
    const deltaPower = Math.round(Math.max(25, (aspectRatio - 0.7) * 90));
    recommendedFix = `Risk of vapor depression keyhole collapse. Increase scan speed by +${deltaSpeed} mm/s or lower laser power by -${deltaPower} W to transition into stable conduction mode.`;
  } else if (lackOfFusionRiskPct > 40 && lackOfFusionRiskPct >= ballingRiskPct) {
    regime = 'lack-of-fusion';
    regimeLabel = 'Lack-of-Fusion Void Regime';
    regimeColor = '#f97316'; // orange
    regimeDescription = 'Melt pool penetration is insufficient to fully remelt the previous layer and adjacent tracks, leaving sharp un-melted voids.';
    const neededPower = Math.round(Math.max(30, (1.5 - depthToLayerRatio) * 60));
    recommendedFix = `Insufficient penetrative energy density (${ved.toFixed(1)} J/mm³). Increase laser power by +${neededPower} W, or reduce layer thickness to collapse lack-of-fusion voids.`;
  } else if (ballingRiskPct > 45) {
    regime = 'balling';
    regimeLabel = 'Balling & Track Instability';
    regimeColor = '#eab308'; // yellow
    regimeDescription = 'High travel speed causes Plateau-Rayleigh capillary breakup into discrete spherical droplets, leading to severe roughness and recoater jams.';
    recommendedFix = `Melt pool length-to-width ratio exceeds Rayleigh-Plateau threshold (${lengthToWidthRatio.toFixed(2)}). Reduce scan speed below ${(scanSpeedMmS * 0.75).toFixed(0)} mm/s.`;
  }

  const overallPorosityRiskPct = regime === 'conduction'
    ? Math.max(3, Math.round((keyholeRiskPct + lackOfFusionRiskPct + ballingRiskPct) / 3))
    : Math.min(99, Math.round(
        Math.max(keyholeRiskPct, lackOfFusionRiskPct, ballingRiskPct) * 0.8 +
        (keyholeRiskPct * lackOfFusionRiskPct) / 300
      ));

  // Safe operating boundaries for conduction mode for this alloy
  const minConductionPower = Math.round(calculateLofPowerBoundary(hatchSpacingUm, layerThicknessUm, scanSpeedMmS));
  const maxConductionPower = Math.round(calculateKeyholePowerBoundary(alloyId, beamSpotDiameterUm, preheatTempC, scanSpeedMmS));

  // Speed boundaries at current laser power P:
  const denomNoV = Math.PI * params.densityKgM3 * params.specificHeatJPerKgK * deltaT *
    Math.sqrt(params.thermalDiffusivityM2S * Math.pow(ds_m, 3));
  const minConductionSpeed = Math.round(
    Math.max(200, Math.min(2000, 1000 * Math.pow((params.absorptivity * P) / (26.0 * denomNoV), 2)))
  );
  const maxConductionSpeed = Math.round(
    Math.max(minConductionSpeed + 100, Math.min(1650, P / (45 * (hatchSpacingUm * 1e-3) * (layerThicknessUm * 1e-3))))
  );

  return {
    regime,
    regimeLabel,
    regimeColor,
    regimeDescription,
    normalizedEnthalpy: parseFloat(normalizedEnthalpy.toFixed(2)),
    aspectRatio: parseFloat(aspectRatio.toFixed(3)),
    keyholeRiskPct,
    lackOfFusionRiskPct,
    ballingRiskPct,
    overallPorosityRiskPct,
    recommendedFix,
    parameterBoundaries: {
      minConductionSpeedMmS: minConductionSpeed,
      maxConductionSpeedMmS: maxConductionSpeed,
      minConductionPowerW: minConductionPower,
      maxConductionPowerW: maxConductionPower,
    },
  };
}
