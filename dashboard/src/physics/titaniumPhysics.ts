export type ProcessMode = 'LPBF' | 'EBM';

export type DefectRegime =
  | 'NOMINAL_CONDUCTION'
  | 'KEYHOLE_POROSITY'
  | 'BALLING_INSTABILITY'
  | 'LACK_OF_FUSION';

export type HeatTreatmentMode =
  | 'AS_BUILT'
  | 'STRESS_RELIEVED_650C'
  | 'SUB_TRANSUS_920C'
  | 'HIP_900C_100MPA';

export interface ProcessParameters {
  mode: ProcessMode;
  laserPowerW: number;        // P: 100 - 500 W
  scanSpeedMmS: number;       // v: 200 - 2000 mm/s
  hatchSpacingUm: number;     // h: 50 - 180 um
  layerThicknessUm: number;   // t: 20 - 90 um
  preheatTempC: number;       // T0: 25 - 750 C
  heatTreatment: HeatTreatmentMode;
}

export interface PhaseFractions {
  alphaLamellarPct: number;   // HCP equilibrium alpha (%)
  alphaPrimeMartensitePct: number; // Acicular HCP alpha' (%)
  betaRetainedPct: number;    // BCC beta (%)
  priorBetaGrainWidthUm: number;
  alphaLathThicknessUm: number;
}

export interface MeltPoolDiagnostics {
  volumetricEnergyDensity: number; // J/mm^3
  linearEnergyDensity: number;     // J/mm
  peakTempK: number;
  peakTempC: number;
  meltPoolLengthUm: number;
  meltPoolWidthUm: number;
  meltPoolDepthUm: number;
  aspectRatioDW: number;
  lengthToWidthRatio: number;
  coolingRateKs: number;           // K/s
  thermalGradientKUm: number;      // K/um
  marangoniVelocityMmS: number;
  relativeDensityPct: number;
  regime: DefectRegime;
  astmStandard: 'ASTM F2924' | 'ASTM F3001';
  astmCompliant: boolean;
  complianceReasons: string[];
  tensileUtsMpa: number;
  yieldStrengthMpa: number;
  elongationPct: number;
  phases: PhaseFractions;
}

export interface PresetProfile {
  id: string;
  name: string;
  subtitle: string;
  params: ProcessParameters;
}

export interface QualificationCoupon {
  id: string;
  batchCode: string;
  timestamp: string;
  mode: ProcessMode;
  laserPowerW: number;
  scanSpeedMmS: number;
  hatchSpacingUm: number;
  layerThicknessUm: number;
  preheatTempC: number;
  heatTreatment: HeatTreatmentMode;
  vedJmm3: number;
  relativeDensityPct: number;
  utsMpa: number;
  ysMpa: number;
  elongationPct: number;
  regime: DefectRegime;
  astmCompliant: boolean;
}

export const TI64_CONSTANTS = {
  SOLIDUS_K: 1878,
  LIQUIDUS_K: 1933,
  VAPORIZATION_K: 3133,
  BETA_TRANSUS_K: 1268,
  MARTENSITE_START_K: 848,
  DENSITY_G_CM3: 4.43,
};

export const PRESET_PROFILES: PresetProfile[] = [
  {
    id: 'lpbf-nominal',
    name: 'Aerospace Grade-5 Nominal',
    subtitle: 'ASTM F2924 Conduction Equilibrium',
    params: {
      mode: 'LPBF',
      laserPowerW: 280,
      scanSpeedMmS: 1200,
      hatchSpacingUm: 110,
      layerThicknessUm: 30,
      preheatTempC: 120,
      heatTreatment: 'HIP_900C_100MPA',
    },
  },
  {
    id: 'lpbf-keyhole',
    name: 'High-Energy Keyhole Excursion',
    subtitle: 'Vapor Depression & Trapped Gas Porosity',
    params: {
      mode: 'LPBF',
      laserPowerW: 410,
      scanSpeedMmS: 620,
      hatchSpacingUm: 95,
      layerThicknessUm: 30,
      preheatTempC: 100,
      heatTreatment: 'AS_BUILT',
    },
  },
  {
    id: 'lpbf-balling',
    name: 'High-Speed Plateau-Rayleigh',
    subtitle: 'Capillary Track Breakup & Spatter',
    params: {
      mode: 'LPBF',
      laserPowerW: 340,
      scanSpeedMmS: 1780,
      hatchSpacingUm: 115,
      layerThicknessUm: 30,
      preheatTempC: 80,
      heatTreatment: 'AS_BUILT',
    },
  },
  {
    id: 'lpbf-lof',
    name: 'Sub-Threshold Lack of Fusion',
    subtitle: 'Unmelted Inter-Layer Cavities',
    params: {
      mode: 'LPBF',
      laserPowerW: 155,
      scanSpeedMmS: 1450,
      hatchSpacingUm: 135,
      layerThicknessUm: 45,
      preheatTempC: 80,
      heatTreatment: 'STRESS_RELIEVED_650C',
    },
  },
  {
    id: 'ebm-equilibrium',
    name: 'EBM Vacuum Preheated α+β',
    subtitle: 'ASTM F3001 In-Situ Martensite Decomposition',
    params: {
      mode: 'EBM',
      laserPowerW: 360,
      scanSpeedMmS: 880,
      hatchSpacingUm: 120,
      layerThicknessUm: 50,
      preheatTempC: 680,
      heatTreatment: 'AS_BUILT',
    },
  },
];

export const INITIAL_COUPONS: QualificationCoupon[] = [
  {
    id: 'TI64-1042A',
    batchCode: 'B26-AERO-01',
    timestamp: '2026-11-04 21:14 UTC',
    mode: 'LPBF',
    laserPowerW: 280,
    scanSpeedMmS: 1200,
    hatchSpacingUm: 110,
    layerThicknessUm: 30,
    preheatTempC: 120,
    heatTreatment: 'HIP_900C_100MPA',
    vedJmm3: 70.71,
    relativeDensityPct: 99.86,
    utsMpa: 1018,
    ysMpa: 934,
    elongationPct: 14.2,
    regime: 'NOMINAL_CONDUCTION',
    astmCompliant: true,
  },
  {
    id: 'TI64-1043B',
    batchCode: 'B26-AERO-01',
    timestamp: '2026-11-04 21:48 UTC',
    mode: 'LPBF',
    laserPowerW: 410,
    scanSpeedMmS: 620,
    hatchSpacingUm: 95,
    layerThicknessUm: 30,
    preheatTempC: 100,
    heatTreatment: 'AS_BUILT',
    vedJmm3: 232.03,
    relativeDensityPct: 97.42,
    utsMpa: 1145,
    ysMpa: 1060,
    elongationPct: 5.1,
    regime: 'KEYHOLE_POROSITY',
    astmCompliant: false,
  },
  {
    id: 'TI64-1044C',
    batchCode: 'B26-AERO-02',
    timestamp: '2026-11-04 22:05 UTC',
    mode: 'EBM',
    laserPowerW: 360,
    scanSpeedMmS: 880,
    hatchSpacingUm: 120,
    layerThicknessUm: 50,
    preheatTempC: 680,
    heatTreatment: 'AS_BUILT',
    vedJmm3: 68.18,
    relativeDensityPct: 99.78,
    utsMpa: 968,
    ysMpa: 892,
    elongationPct: 13.6,
    regime: 'NOMINAL_CONDUCTION',
    astmCompliant: true,
  },
  {
    id: 'TI64-1045D',
    batchCode: 'B26-AERO-02',
    timestamp: '2026-11-04 22:39 UTC',
    mode: 'LPBF',
    laserPowerW: 155,
    scanSpeedMmS: 1450,
    hatchSpacingUm: 135,
    layerThicknessUm: 45,
    preheatTempC: 80,
    heatTreatment: 'STRESS_RELIEVED_650C',
    vedJmm3: 17.6,
    relativeDensityPct: 96.15,
    utsMpa: 790,
    ysMpa: 715,
    elongationPct: 4.4,
    regime: 'LACK_OF_FUSION',
    astmCompliant: false,
  },
  {
    id: 'TI64-1046E',
    batchCode: 'B26-AERO-03',
    timestamp: '2026-11-04 23:02 UTC',
    mode: 'LPBF',
    laserPowerW: 300,
    scanSpeedMmS: 1150,
    hatchSpacingUm: 105,
    layerThicknessUm: 30,
    preheatTempC: 150,
    heatTreatment: 'SUB_TRANSUS_920C',
    vedJmm3: 82.82,
    relativeDensityPct: 99.81,
    utsMpa: 992,
    ysMpa: 910,
    elongationPct: 12.8,
    regime: 'NOMINAL_CONDUCTION',
    astmCompliant: true,
  },
];

/**
 * Calculates Volumetric Energy Density E_v = P / (v * h * t) in J/mm^3
 */
export function calculateVolumetricEnergyDensity(
  laserPowerW: number,
  scanSpeedMmS: number,
  hatchSpacingUm: number,
  layerThicknessUm: number
): number {
  const hMm = Math.max(hatchSpacingUm, 1) / 1000;
  const tMm = Math.max(layerThicknessUm, 1) / 1000;
  const v = Math.max(scanSpeedMmS, 1);
  return laserPowerW / (v * hMm * tMm);
}

/**
 * Full thermodynamic, geometric, and metallurgical diagnostic solver for Ti-6Al-4V
 */
export function computeMeltPoolDiagnostics(params: ProcessParameters): MeltPoolDiagnostics {
  const {
    mode,
    laserPowerW,
    scanSpeedMmS,
    hatchSpacingUm,
    layerThicknessUm,
    preheatTempC,
    heatTreatment,
  } = params;

  const ved = calculateVolumetricEnergyDensity(
    laserPowerW,
    scanSpeedMmS,
    hatchSpacingUm,
    layerThicknessUm
  );
  const linearEd = laserPowerW / Math.max(scanSpeedMmS, 1);

  const preheatK = preheatTempC + 273.15;
  // Effective absorptivity higher in EBM than optical fiber laser in L-PBF
  const absorptivity = mode === 'EBM' ? 0.82 : 0.68;

  // Peak melt pool temperature (K)
  const rawPeakK =
    preheatK +
    950 +
    absorptivity * 2450 * Math.pow(laserPowerW / 250, 0.88) * Math.pow(1000 / Math.max(scanSpeedMmS, 100), 0.42);
  const peakTempK = Math.min(3450, Math.max(preheatK + 300, rawPeakK));
  const peakTempC = peakTempK - 273.15;

  // Melt pool geometry (Eagar-Tsai / Rosenthal scaling in micrometers)
  const meltPoolWidthUm = Math.round(
    Math.max(
      45,
      128 * Math.pow((laserPowerW * absorptivity) / 190, 0.56) * Math.pow(1100 / Math.max(scanSpeedMmS, 100), 0.34)
    )
  );

  // Keyhole transition intensifies depth non-linearly at high energy density
  const keyholeFactor = ved > 90 ? 1 + Math.min(1.3, (ved - 90) / 110) : 1.0;
  const meltPoolDepthUm = Math.round(
    Math.max(
      18,
      56 *
        Math.pow((laserPowerW * absorptivity) / 190, 0.78) *
        Math.pow(1100 / Math.max(scanSpeedMmS, 100), 0.48) *
        keyholeFactor
    )
  );

  const meltPoolLengthUm = Math.round(
    Math.max(
      110,
      meltPoolWidthUm * (1.75 + 0.00145 * scanSpeedMmS * Math.pow(laserPowerW / 260, 0.35))
    )
  );

  const aspectRatioDW = Number((meltPoolDepthUm / Math.max(meltPoolWidthUm, 1)).toFixed(2));
  const lengthToWidthRatio = Number((meltPoolLengthUm / Math.max(meltPoolWidthUm, 1)).toFixed(2));

  // Thermal gradient G (K/um) and Solidification Cooling Rate (K/s)
  const deltaT = Math.max(200, peakTempK - preheatK);
  const thermalGradientKUm = Number((deltaT / Math.max(meltPoolDepthUm * 0.85, 20)).toFixed(2));
  const coolingRateKs = Math.round(
    Math.min(2.5e6, Math.max(1.2e3, thermalGradientKUm * scanSpeedMmS * 420 * (mode === 'EBM' ? 0.22 : 1.0)))
  );

  // Marangoni thermocapillary convection velocity (mm/s)
  const marangoniVelocityMmS = Math.round(
    Math.max(120, Math.min(4800, thermalGradientKUm * 95 * Math.pow(peakTempK / 1933, 1.25)))
  );

  // Defect Regime Classification
  let regime: DefectRegime = 'NOMINAL_CONDUCTION';
  if (ved > 100 || aspectRatioDW > 0.86 || peakTempK > 3080) {
    regime = 'KEYHOLE_POROSITY';
  } else if (ved < 44 || meltPoolDepthUm < layerThicknessUm * 1.32 || meltPoolWidthUm < hatchSpacingUm * 1.05) {
    regime = 'LACK_OF_FUSION';
  } else if (scanSpeedMmS > 1520 && lengthToWidthRatio > 3.95) {
    regime = 'BALLING_INSTABILITY';
  }

  // Relative Density (%) prediction
  let relativeDensityPct = 99.85;
  if (regime === 'NOMINAL_CONDUCTION') {
    const devFromOpt = Math.abs(ved - 70);
    relativeDensityPct = Number(Math.max(99.71, 99.91 - devFromOpt * 0.0055).toFixed(2));
  } else if (regime === 'KEYHOLE_POROSITY') {
    const excess = Math.max(8, ved - 95);
    relativeDensityPct = Number(Math.max(95.4, 99.45 - excess * 0.018).toFixed(2));
  } else if (regime === 'LACK_OF_FUSION') {
    const deficit = Math.max(6, 48 - ved);
    relativeDensityPct = Number(Math.max(94.2, 99.2 - deficit * 0.095).toFixed(2));
  } else if (regime === 'BALLING_INSTABILITY') {
    relativeDensityPct = Number(Math.max(96.8, 99.35 - (lengthToWidthRatio - 3.8) * 0.95).toFixed(2));
  }

  // Microstructure Phase Fractions (alpha, alpha'-martensite, beta)
  let alphaPrimeMartensitePct = 0;
  let alphaLamellarPct = 0;
  let betaRetainedPct = 6;

  // In-situ decomposition when preheat >= 575C (Ms) or EBM mode, or post-build heat treatment
  if (heatTreatment === 'HIP_900C_100MPA') {
    alphaPrimeMartensitePct = 0;
    betaRetainedPct = 11;
    alphaLamellarPct = 89;
  } else if (heatTreatment === 'SUB_TRANSUS_920C') {
    alphaPrimeMartensitePct = 2;
    betaRetainedPct = 10;
    alphaLamellarPct = 88;
  } else if (heatTreatment === 'STRESS_RELIEVED_650C') {
    alphaPrimeMartensitePct = preheatTempC > 550 ? 3 : 28;
    betaRetainedPct = 8;
    alphaLamellarPct = 100 - alphaPrimeMartensitePct - betaRetainedPct;
  } else {
    // AS_BUILT
    if (preheatTempC >= 575 || mode === 'EBM') {
      alphaPrimeMartensitePct = 4;
      betaRetainedPct = 9;
      alphaLamellarPct = 87;
    } else {
      // High cooling rate L-PBF forms acicular alpha'-martensite
      const coolingFactor = Math.min(1, Math.max(0, ( coolingRateKs - 50000) / 800000));
      alphaPrimeMartensitePct = Math.round(68 + 22 * coolingFactor);
      betaRetainedPct = 4;
      alphaLamellarPct = 100 - alphaPrimeMartensitePct - betaRetainedPct;
    }
  }

  const priorBetaGrainWidthUm = Math.round(
    Math.max(35, Math.min(240, meltPoolWidthUm * (mode === 'EBM' ? 0.95 : 0.72)))
  );
  const alphaLathThicknessUm = Number(
    (
      heatTreatment === 'HIP_900C_100MPA'
        ? 2.4
        : heatTreatment === 'SUB_TRANSUS_920C'
          ? 1.9
          : mode === 'EBM' || preheatTempC >= 575
            ? 1.4
            : 0.45
    ).toFixed(2)
  );

  // Mechanical Properties (ASTM F2924 / F3001 minimum: UTS >= 895 MPa, YS >= 825 MPa, Elongation >= 10%)
  const porosityPenalty = Math.max(0, 99.85 - relativeDensityPct);
  const baseUts =
    955 +
    alphaPrimeMartensitePct * 2.35 -
    porosityPenalty * 42;
  const tensileUtsMpa = Math.round(Math.max(680, Math.min(1260, baseUts)));
  const yieldStrengthMpa = Math.round(tensileUtsMpa * 0.915);

  const baseElongation =
    14.8 -
    alphaPrimeMartensitePct * 0.082 -
    porosityPenalty * 2.45 +
    (heatTreatment === 'HIP_900C_100MPA' ? 1.4 : 0);
  const elongationPct = Number(Math.max(2.1, Math.min(18.5, baseElongation)).toFixed(1));

  const astmStandard = mode === 'LPBF' ? 'ASTM F2924' : 'ASTM F3001';
  const complianceReasons: string[] = [];

  if (relativeDensityPct < 99.7) {
    complianceReasons.push(`Densification ${relativeDensityPct.toFixed(2)}% below 99.70% threshold`);
  }
  if (regime !== 'NOMINAL_CONDUCTION') {
    complianceReasons.push(`Process in ${regime.replace(/_/g, ' ')} regime`);
  }
  if (tensileUtsMpa < 895) {
    complianceReasons.push(`UTS ${tensileUtsMpa} MPa below 895 MPa minimum`);
  }
  if (yieldStrengthMpa < 825) {
    complianceReasons.push(`Yield ${yieldStrengthMpa} MPa below 825 MPa minimum`);
  }
  if (elongationPct < 10.0) {
    complianceReasons.push(`Elongation ${elongationPct.toFixed(1)}% below 10.0% minimum (martensitic embrittlement or porosity)`);
  }

  const astmCompliant = complianceReasons.length === 0;
  if (astmCompliant) {
    complianceReasons.push(`All ${astmStandard} Class A aerospace criteria satisfied`);
  }

  return {
    volumetricEnergyDensity: Number(ved.toFixed(2)),
    linearEnergyDensity: Number(linearEd.toFixed(3)),
    peakTempK: Math.round(peakTempK),
    peakTempC: Math.round(peakTempC),
    meltPoolLengthUm,
    meltPoolWidthUm,
    meltPoolDepthUm,
    aspectRatioDW,
    lengthToWidthRatio,
    coolingRateKs,
    thermalGradientKUm,
    marangoniVelocityMmS,
    relativeDensityPct,
    regime,
    astmStandard,
    astmCompliant,
    complianceReasons,
    tensileUtsMpa,
    yieldStrengthMpa,
    elongationPct,
    phases: {
      alphaLamellarPct,
      alphaPrimeMartensitePct,
      betaRetainedPct,
      priorBetaGrainWidthUm,
      alphaLathThicknessUm,
    },
  };
}

/**
 * Evaluates spatial temperature (in Kelvin) and local metallurgical state at normalized viewport coordinates (u, v in [0, 1])
 */
export function sampleSpatialPyrometry(
  u: number,
  v: number,
  diagnostics: MeltPoolDiagnostics,
  preheatTempC: number
): {
  tempK: number;
  tempC: number;
  localGradientKUm: number;
  phaseLabel: string;
  xUm: number;
  yUm: number;
} {
  // Laser focal center at u0 = 0.36, v0 = 0.50 with comet-tail elongation toward +u
  const u0 = 0.36;
  const v0 = 0.5;
  const dx = u - u0;
  const dy = v - v0;

  // Asymmetric Rosenthal thermal field (steeper ahead of laser dx < 0, elongated tail dx > 0)
  const sigmaX = dx < 0 ? 0.11 : Math.min(0.46, 0.18 + (diagnostics.meltPoolLengthUm / 1200) * 0.25);
  const sigmaY = Math.min(0.28, 0.09 + (diagnostics.meltPoolWidthUm / 400) * 0.12);

  const distSq = (dx * dx) / (sigmaX * sigmaX) + (dy * dy) / (sigmaY * sigmaY);
  const preheatK = preheatTempC + 273.15;
  const deltaPeak = diagnostics.peakTempK - preheatK;

  const tempK = Math.round(preheatK + deltaPeak * Math.exp(-distSq * 1.15));
  const tempC = Math.round(tempK - 273.15);

  const localGradientKUm = Number(
    (diagnostics.thermalGradientKUm * Math.min(1.6, Math.sqrt(distSq) * 1.2 + 0.2)).toFixed(2)
  );

  let phaseLabel = 'α+β Solidified Substrate';
  if (tempK >= TI64_CONSTANTS.VAPORIZATION_K) {
    phaseLabel = 'Keyhole Vapor Plume (>3133 K)';
  } else if (tempK >= TI64_CONSTANTS.LIQUIDUS_K) {
    phaseLabel = 'Molten Ti-6Al-4V Pool (Liquidus)';
  } else if (tempK >= TI64_CONSTANTS.SOLIDUS_K) {
    phaseLabel = 'Mushy Solidification Zone (L + β)';
  } else if (tempK >= TI64_CONSTANTS.BETA_TRANSUS_K) {
    phaseLabel = 'Single-Phase BCC β-Field';
  } else if (tempK >= TI64_CONSTANTS.MARTENSITE_START_K) {
    phaseLabel = 'Allotropic β → α+β Transition';
  } else if (diagnostics.phases.alphaPrimeMartensitePct > 40) {
    phaseLabel = "Acicular α'-Martensite Track";
  }

  const xUm = Math.round((u - u0) * 900);
  const yUm = Math.round((v - v0) * 500);

  return {
    tempK,
    tempC,
    localGradientKUm,
    phaseLabel,
    xUm,
    yUm,
  };
}
