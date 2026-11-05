import { MaterialItem, ProcessVariant } from '../data/materialsData';

/**
 * Downloads a string as a file in the browser with optional UTF-8 BOM for Excel
 */
function downloadFile(content: string, filename: string, mimeType: string, addBom = false) {
  const payload = addBom ? ['\uFEFF', content] : [content];
  const blob = new Blob(payload, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  // Delay cleanup to allow browser time to start the download stream
  setTimeout(() => {
    if (anchor.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }
    URL.revokeObjectURL(url);
  }, 250);
}

/**
 * Safely escapes CSV field values and neutralizes CSV Formula Injection (CWE-1236)
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  // If string begins with spreadsheet formula triggers (=, +, -, @, pipe, tab, CR), prepend single quote
  if (/^[=+@-|\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str}"`;
}

/**
 * Splits a formatted property string like "950.5 MPa" or numeric value into numeric value and clean unit.
 * Safely handles strings, numbers, 0, null, and undefined.
 */
export function splitValueAndUnit(rawInput?: any, defaultUnit = ''): { value: string; unit: string } {
  if (rawInput === null || rawInput === undefined || rawInput === '') {
    return { value: 'N/A', unit: defaultUnit };
  }
  const str = String(rawInput).trim();
  if (!str) return { value: 'N/A', unit: defaultUnit };
  const match = str.match(/^([-+]?[0-9]*\.?[0-9]+)\s*(.*)$/);
  if (match) {
    const num = match[1];
    let unit = match[2] || defaultUnit;
    // Normalize Unicode superscripts to ASCII for clean spreadsheet display
    unit = unit
      .replace(/⁰/g, '0')
      .replace(/¹/g, '1')
      .replace(/²/g, '2')
      .replace(/³/g, '3')
      .replace(/⁴/g, '4')
      .replace(/⁵/g, '5')
      .replace(/⁶/g, '6')
      .replace(/⁷/g, '7')
      .replace(/⁸/g, '8')
      .replace(/⁹/g, '9')
      .replace(/⁻/g, '-');
    return { value: num, unit: unit || defaultUnit };
  }
  return { value: str, unit: defaultUnit };
}

/**
 * Sanitizes and normalizes text for standard PDF Type 1 fonts (Helvetica/WinAnsi).
 * Translates Greek symbols, Unicode math exponents, superscripts, subscripts,
 * and non-standard quotation marks to clean, universal engineering representations
 * so that no characters corrupt or disappear in the generated PDF.
 */
export function cleanPdfText(val: any): string {
  if (val === null || val === undefined) return '';
  let s = String(val);

  // Greek and mathematical symbols
  s = s.replace(/≤/g, '<=');
  s = s.replace(/≥/g, '>=');
  s = s.replace(/±/g, '+/-');
  s = s.replace(/α/g, 'alpha');
  s = s.replace(/Α/g, 'Alpha');
  s = s.replace(/β/g, 'beta');
  s = s.replace(/Β/g, 'Beta');
  s = s.replace(/γ/g, 'gamma');
  s = s.replace(/Γ/g, 'Gamma');
  s = s.replace(/ψ/g, 'psi');
  s = s.replace(/Ψ/g, 'Psi');
  s = s.replace(/Ω/g, 'Ohm');
  s = s.replace(/µ/g, 'u');
  s = s.replace(/μ/g, 'u');
  s = s.replace(/η/g, 'eta');
  s = s.replace(/ν/g, 'nu');
  s = s.replace(/ε/g, 'epsilon');
  s = s.replace(/λ/g, 'lambda');
  s = s.replace(/θ/g, 'theta');
  s = s.replace(/°C/g, ' deg C');
  s = s.replace(/°/g, ' deg ');

  // Compound units and exponents
  s = s.replace(/MPa·m⁰·⁵/g, 'MPa*m^0.5');
  s = s.replace(/MPa·m/g, 'MPa*m');
  s = s.replace(/m⁰·⁵/g, 'm^0.5');
  s = s.replace(/g\/cm³/g, 'g/cm^3');
  s = s.replace(/cm³\/h/g, 'cm^3/h');
  s = s.replace(/cm³/g, 'cm^3');
  s = s.replace(/10⁻⁶\/K/g, '10^-6 / K');
  s = s.replace(/10⁻⁶/g, '10^-6');
  s = s.replace(/×/g, 'x');
  s = s.replace(/·/g, ' - ');

  // Superscripts
  s = s.replace(/⁰/g, '0');
  s = s.replace(/¹/g, '1');
  s = s.replace(/²/g, '^2');
  s = s.replace(/³/g, '^3');
  s = s.replace(/⁴/g, '^4');
  s = s.replace(/⁵/g, '^5');
  s = s.replace(/⁶/g, '^6');
  s = s.replace(/⁷/g, '^7');
  s = s.replace(/⁸/g, '^8');
  s = s.replace(/⁹/g, '^9');
  s = s.replace(/⁻/g, '-');

  // Subscripts
  s = s.replace(/₂/g, '2');
  s = s.replace(/₁/g, '1');
  s = s.replace(/₀/g, '0');

  // Clean dashes and quotes
  s = s.replace(/[–—]/g, '-');
  s = s.replace(/[“”]/g, '"');
  s = s.replace(/[‘’]/g, "'");

  // Fallback: replace any remaining non-ASCII character that could corrupt Helvetica
  s = s.replace(/[^\x20-\x7E]/g, ' ');

  // Normalize whitespace
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Formats a single process route into a structured Key-Value Datasheet CSV
 */
function generateSingleRouteDatasheetCsv(material: MaterialItem, variant: ProcessVariant): string {
  const rows: string[][] = [];

  // Header row
  rows.push(['Section / Domain', 'Parameter / Metric', 'Value', 'Unit', 'Measurement Method / Standard Notes'].map(escapeCsv));

  // Row helper
  const addRow = (section: string, metric: string, rawVal: any, defaultUnit = '', notes = '') => {
    const { value, unit } = splitValueAndUnit(rawVal, defaultUnit);
    rows.push([escapeCsv(section), escapeCsv(metric), escapeCsv(value), escapeCsv(unit), escapeCsv(notes)]);
  };

  // Section 1: General Alloy Metadata
  addRow('General Alloy Info', 'Alloy Name', material.name, '', 'Calibrated Titanium AM Material System');
  addRow('General Alloy Info', 'Alloy ID', material.alloyId, '', 'Database identifier');
  addRow('General Alloy Info', 'Chemical Formula', material.formula, '', 'Nominal chemical composition');
  addRow('General Alloy Info', 'Crystal Structure', material.crystalStructure, '', 'Phase / crystallographic state');
  addRow('General Alloy Info', 'Standard Code', material.standardCode, '', 'ASTM / AMS specification reference');
  addRow('General Alloy Info', 'AM Category', material.category, '', 'Primary ISO/ASTM AM classification');

  // Section 2: Synthesis & Creation Vectors
  addRow('Synthesis Vectors', 'ISO/ASTM AM Process', variant.processCategory, '', 'Authorized AM Process Class');
  addRow('Synthesis Vectors', 'Subprocess Method', variant.subprocess, '', 'Deposition / melting technique');
  addRow('Synthesis Vectors', 'Post-Processing Condition', variant.postProcessingCondition, '', 'Thermal / HIP treatment applied');
  addRow('Synthesis Vectors', 'Temper / Grade', variant.temperOrGrade, '', 'Metallurgical temper state');
  addRow('Synthesis Vectors', 'Peak Process Temperature', variant.peakTempC, '°C', 'Maximum thermal vector achieved');
  addRow('Synthesis Vectors', 'Total Hold Duration', variant.holdTimeMin, 'min', 'Isothermal soaking duration');
  addRow('Synthesis Vectors', 'Cooling / Quench Vector', variant.coolingRate, '', 'Controlled cooling trajectory');
  addRow('Synthesis Vectors', 'Process Atmosphere', variant.atmosphere, '', 'Chamber inerting environment');
  addRow('Synthesis Vectors', 'Yield Strength Change', variant.yieldChangePct, '%', 'Relative to baseline as-built state');

  const p = variant.propertyOverrides || {};

  // Section 3: Mechanical Telemetry
  addRow('Mechanical Telemetry', 'Ultimate Tensile Strength (UTS)', p.tensileStrengthMPa || material.mechanical.tensileStrengthMPa, 'MPa', 'ASTM E8M (20 °C ambient)');
  addRow('Mechanical Telemetry', 'Yield Strength (0.2% Offset)', p.yieldStrengthMPa || material.mechanical.yieldStrengthMPa, 'MPa', 'ASTM E8M (20 °C ambient)');
  addRow('Mechanical Telemetry', 'Elastic Modulus (E)', p.elasticModulusGPa || material.mechanical.elasticModulusGPa, 'GPa', 'Resonant ultrasound / Tensile');
  addRow('Mechanical Telemetry', 'Elongation at Break', p.elongationPct || material.mechanical.elongationPct, '%', 'Gauge length 4D');
  addRow('Mechanical Telemetry', 'Vickers Hardness', p.hardnessHV || material.mechanical.hardnessHV, 'HV', 'HV10 load (ASTM E384)');
  addRow('Mechanical Telemetry', 'Fracture Toughness (K1c)', p.fractureToughness || material.mechanical.fractureToughness, 'MPa·m^0.5', 'ASTM E399 plane-strain');
  addRow('Mechanical Telemetry', 'Fatigue Strength (10^7 cycles)', p.fatigueStrengthMPa || material.mechanical.fatigueStrengthMPa, 'MPa', 'R = 0.1, Kt = 1.0');
  addRow('Mechanical Telemetry', 'Charpy Impact Energy', p.charpyImpactEnergyJ || material.mechanical.charpyImpactEnergyJ, 'J', 'ASTM E23 V-notch standard specimen');
  addRow('Mechanical Telemetry', 'Poisson\'s Ratio', p.poissonsRatio || material.mechanical.poissonsRatio, '', 'ASTM E132 lateral contraction');
  addRow('Mechanical Telemetry', 'Damping Loss Factor', p.dampingLossFactor || material.mechanical.dampingLossFactor, '', 'Resonant decay modal analysis');
  addRow('Mechanical Telemetry', 'Ultrasonic Wave Speed', p.waveSpeedMs || material.mechanical.waveSpeedMs, 'm/s', 'Longitudinal acoustic velocity');

  // Section 4: AM Process Quality & Precision
  addRow('AM Process Quality', 'Density', p.densityGcm3 || material.amQuality.densityGcm3, 'g/cm³', 'Archimedes immersion method');
  addRow('AM Process Quality', 'Relative Density', p.relativeDensityPct || material.amQuality.relativeDensityPct, '%', 'Percentage of theoretical crystal density');
  addRow('AM Process Quality', 'Internal Porosity', p.porosityPct || material.amQuality.porosityPct, '%', 'X-ray Micro-CT / Image analysis');
  addRow('AM Process Quality', 'Surface Roughness (Ra)', p.surfaceRoughnessRa || material.amQuality.surfaceRoughnessRa, 'µm', 'Optical profilometry ISO 4287');
  addRow('AM Process Quality', 'Peak Residual Stress', p.residualStressMax || material.amQuality.residualStressMax, 'MPa', 'X-ray diffraction sin²ψ method');
  addRow('AM Process Quality', 'Volumetric Build Rate', p.buildRate || material.amQuality.buildRate, 'cm³/h', 'Productive scan speed envelope');
  addRow('AM Process Quality', 'Mechanical Anisotropy (Z/XY)', p.anisotropy || material.amQuality.anisotropy, '', 'Ratio of vertical to horizontal strength');
  addRow('AM Process Quality', 'Minimum Feature Size', p.minFeatureSize || material.amQuality.minFeatureSize, 'µm', 'Resolution limit for wall / strut');
  addRow('AM Process Quality', 'Dimensional Accuracy', p.accuracy || material.amQuality.accuracy, 'µm', 'Envelope tolerance on calibrated artifacts');

  // Section 5: Thermal Telemetry
  addRow('Thermal Telemetry', 'Liquidus / Melting Point', p.liquidusC || material.thermal.liquidusC, '°C', 'Differential Scanning Calorimetry (DSC)');
  addRow('Thermal Telemetry', 'Beta Transus Temperature', p.betaTransusC || material.thermal.betaTransusC, '°C', 'Alpha to Beta phase boundary temperature');
  addRow('Thermal Telemetry', 'Max Service Temperature', p.maxServiceTempC || material.thermal.maxServiceTempC, '°C', 'Continuous structural service limit');
  addRow('Thermal Telemetry', 'Thermal Conductivity', p.thermalConductivity || material.thermal.thermalConductivity, 'W/m·K', 'Laser flash diffusivity (20 °C)');
  addRow('Thermal Telemetry', 'Thermal Expansion (CTE)', p.thermalExpansionCTE || material.thermal.thermalExpansionCTE, '10^-6/K', 'Dilatometry (20 - 500 °C)');
  addRow('Thermal Telemetry', 'Specific Heat Capacity', p.specificHeat || material.thermal.specificHeat, 'J/kg·K', 'DSC calorimetry');
  addRow('Thermal Telemetry', 'Thermal Emissivity', p.emissivity || material.thermal.emissivity, '', 'Total hemispherical emissivity at 600 °C');

  // Section 6: Chemical, Optical & Physical
  addRow('Chemical & Environmental', 'Oxygen Content', p.oxygenContentWt || material.chemicalAndPhysical.oxygenContentWt, 'wt. %', 'Inert gas fusion (LECO ASTM E1409)');
  addRow('Chemical & Environmental', 'Electrical Resistivity', p.electricalResistivity || material.chemicalAndPhysical.electricalResistivity, 'µΩ·cm', 'Four-point probe technique');
  addRow('Chemical & Environmental', 'Laser Absorptivity (1064 nm)', p.laserAbsorptivity || material.chemicalAndPhysical.laserAbsorptivity, '', 'Fiber laser wavelength absorption');
  addRow('Chemical & Environmental', 'Visible Reflectance', p.visibleReflectance || material.chemicalAndPhysical.visibleReflectance, '%', 'Spectrophotometry (400 - 700 nm)');
  addRow('Chemical & Environmental', 'Corrosion Rating', p.corrosionRating || material.chemicalAndPhysical.corrosionRating, '', 'ASTM G31 immersion / Electrochemical');
  addRow('Chemical & Environmental', 'Biocompatibility Rating', p.biocompatibilityRating || material.chemicalAndPhysical.biocompatibilityRating, '', 'ISO 10993 cytotoxicity & osteointegration');
  addRow('Chemical & Environmental', 'Magnetic Susceptibility', p.magneticSusceptibility || material.chemicalAndPhysical.magneticSusceptibility, '10^-6 emu/g', 'SQUID magnetometry');

  return rows.map((r) => r.join(',')).join('\r\n');
}

/**
 * Formats all process variants of an alloy into a clean, comprehensive Data Table CSV
 * (Rows = Process Routes, Columns = All Properties with Units in header)
 */
function generateAllRoutesTableCsv(material: MaterialItem): string {
  const headers = [
    'Route Index',
    'Alloy Name',
    'Chemical Formula',
    'Standard Code',
    'Process Route Name',
    'ISO/ASTM Process Category',
    'Subprocess Method',
    'Post-Processing Condition',
    'Temper / Grade',
    'Peak Temp (°C)',
    'Hold Duration (min)',
    'Cooling Vector',
    'Process Atmosphere',
    'Yield Change (%)',
    'Tensile Strength UTS (MPa)',
    'Yield Strength 0.2% (MPa)',
    'Elastic Modulus E (GPa)',
    'Elongation at Break (%)',
    'Vickers Hardness (HV)',
    'Fracture Toughness K1c (MPa·m^0.5)',
    'Fatigue Strength 10^7 cycles (MPa)',
    'Charpy Impact Energy (J)',
    'Poisson\'s Ratio',
    'Damping Loss Factor',
    'Ultrasonic Wave Speed (m/s)',
    'Density (g/cm³)',
    'Relative Density (%)',
    'Internal Porosity (%)',
    'Surface Roughness Ra (µm)',
    'Peak Residual Stress (MPa)',
    'Volumetric Build Rate (cm³/h)',
    'Mechanical Anisotropy (Z/XY)',
    'Min Feature Size (µm)',
    'Dimensional Accuracy (±µm)',
    'Liquidus (°C)',
    'Beta Transus (°C)',
    'Max Service Temp (°C)',
    'Thermal Conductivity (W/m·K)',
    'CTE (10^-6/K)',
    'Specific Heat (J/kg·K)',
    'Thermal Emissivity',
    'Oxygen Content (wt. %)',
    'Electrical Resistivity (µΩ·cm)',
    'Laser Absorptivity (1064nm)',
    'Visible Reflectance (%)',
    'Corrosion Rating',
    'Biocompatibility Rating',
    'Magnetic Susceptibility (10^-6 emu/g)',
  ];

  const rows: string[][] = [headers.map(escapeCsv)];

  material.processRoutes.forEach((route, idx) => {
    const p = route.propertyOverrides || {};
    const extractNum = (raw?: string, fallback?: string): string => {
      const val = raw || fallback || '';
      return splitValueAndUnit(val).value;
    };

    const row = [
      idx + 1,
      material.name,
      material.formula,
      material.standardCode,
      route.name,
      route.processCategory,
      route.subprocess,
      route.postProcessingCondition,
      route.temperOrGrade,
      route.peakTempC,
      route.holdTimeMin,
      route.coolingRate,
      route.atmosphere,
      route.yieldChangePct,
      extractNum(p.tensileStrengthMPa, material.mechanical.tensileStrengthMPa),
      extractNum(p.yieldStrengthMPa, material.mechanical.yieldStrengthMPa),
      extractNum(p.elasticModulusGPa, material.mechanical.elasticModulusGPa),
      extractNum(p.elongationPct, material.mechanical.elongationPct),
      extractNum(p.hardnessHV, material.mechanical.hardnessHV),
      extractNum(p.fractureToughness, material.mechanical.fractureToughness),
      extractNum(p.fatigueStrengthMPa, material.mechanical.fatigueStrengthMPa),
      extractNum(p.charpyImpactEnergyJ, material.mechanical.charpyImpactEnergyJ),
      extractNum(p.poissonsRatio, material.mechanical.poissonsRatio),
      extractNum(p.dampingLossFactor, material.mechanical.dampingLossFactor),
      extractNum(p.waveSpeedMs, material.mechanical.waveSpeedMs),
      extractNum(p.densityGcm3, material.amQuality.densityGcm3),
      extractNum(p.relativeDensityPct, material.amQuality.relativeDensityPct),
      extractNum(p.porosityPct, material.amQuality.porosityPct),
      extractNum(p.surfaceRoughnessRa, material.amQuality.surfaceRoughnessRa),
      extractNum(p.residualStressMax, material.amQuality.residualStressMax),
      extractNum(p.buildRate, material.amQuality.buildRate),
      extractNum(p.anisotropy, material.amQuality.anisotropy),
      extractNum(p.minFeatureSize, material.amQuality.minFeatureSize),
      extractNum(p.accuracy, material.amQuality.accuracy),
      extractNum(p.liquidusC, material.thermal.liquidusC),
      extractNum(p.betaTransusC, material.thermal.betaTransusC),
      extractNum(p.maxServiceTempC, material.thermal.maxServiceTempC),
      extractNum(p.thermalConductivity, material.thermal.thermalConductivity),
      extractNum(p.thermalExpansionCTE, material.thermal.thermalExpansionCTE),
      extractNum(p.specificHeat, material.thermal.specificHeat),
      extractNum(p.emissivity, material.thermal.emissivity),
      extractNum(p.oxygenContentWt, material.chemicalAndPhysical.oxygenContentWt),
      extractNum(p.electricalResistivity, material.chemicalAndPhysical.electricalResistivity),
      extractNum(p.laserAbsorptivity, material.chemicalAndPhysical.laserAbsorptivity),
      extractNum(p.visibleReflectance, material.chemicalAndPhysical.visibleReflectance),
      p.corrosionRating || material.chemicalAndPhysical.corrosionRating,
      p.biocompatibilityRating || material.chemicalAndPhysical.biocompatibilityRating,
      extractNum(p.magneticSusceptibility, material.chemicalAndPhysical.magneticSusceptibility),
    ];

    rows.push(row.map(escapeCsv));
  });

  return rows.map((r) => r.join(',')).join('\r\n');
}

/**
 * Formats a side-by-side process comparison matrix into a structured CSV
 */
export function generateProcessComparisonCsv(
  material: MaterialItem,
  variants: ProcessVariant[]
): string {
  const headers = ['Domain / Section', 'Parameter / Metric', 'Unit', ...variants.map((v) => `"${v.name}"`)];
  const rows: string[][] = [headers];

  const addRow = (
    section: string,
    metric: string,
    unit: string,
    getter: (v: ProcessVariant) => string
  ) => {
    rows.push([
      escapeCsv(section),
      escapeCsv(metric),
      escapeCsv(unit),
      ...variants.map((v) => escapeCsv(getter(v))),
    ]);
  };

  // Section 1: Creation & Synthesis
  addRow('Synthesis', 'ISO/ASTM Process Category', '', (v) => v.processCategory);
  addRow('Synthesis', 'Subprocess Method', '', (v) => v.subprocess);
  addRow('Synthesis', 'Post-Processing Condition', '', (v) => v.postProcessingCondition);
  addRow('Synthesis', 'Temper / Grade', '', (v) => v.temperOrGrade);
  addRow('Synthesis', 'Peak Process Temperature', '°C', (v) => `${v.peakTempC}`);
  addRow('Synthesis', 'Total Hold Duration', 'min', (v) => `${v.holdTimeMin}`);
  addRow('Synthesis', 'Cooling / Quench Vector', '', (v) => v.coolingRate);
  addRow('Synthesis', 'Process Atmosphere', '', (v) => v.atmosphere);
  addRow('Synthesis', 'Yield Strength Change', '%', (v) => v.yieldChangePct);

  // Section 2: Mechanical Telemetry
  const addPropRow = (
    section: string,
    metric: string,
    defaultUnit: string,
    key: keyof NonNullable<ProcessVariant['propertyOverrides']>,
    fallback: string
  ) => {
    addRow(section, metric, defaultUnit, (v) => {
      const raw = v.propertyOverrides?.[key] || fallback;
      return splitValueAndUnit(raw, defaultUnit).value;
    });
  };

  addPropRow('Mechanical Telemetry', 'Ultimate Tensile Strength (UTS)', 'MPa', 'tensileStrengthMPa', material.mechanical.tensileStrengthMPa);
  addPropRow('Mechanical Telemetry', 'Yield Strength (0.2% Offset)', 'MPa', 'yieldStrengthMPa', material.mechanical.yieldStrengthMPa);
  addPropRow('Mechanical Telemetry', 'Elastic Modulus (E)', 'GPa', 'elasticModulusGPa', material.mechanical.elasticModulusGPa);
  addPropRow('Mechanical Telemetry', 'Elongation at Break', '%', 'elongationPct', material.mechanical.elongationPct);
  addPropRow('Mechanical Telemetry', 'Vickers Hardness', 'HV', 'hardnessHV', material.mechanical.hardnessHV);
  addPropRow('Mechanical Telemetry', 'Fracture Toughness (K1c)', 'MPa·m^0.5', 'fractureToughness', material.mechanical.fractureToughness);
  addPropRow('Mechanical Telemetry', 'Fatigue Strength (10^7 cycles)', 'MPa', 'fatigueStrengthMPa', material.mechanical.fatigueStrengthMPa);
  addPropRow('Mechanical Telemetry', 'Charpy Impact Energy', 'J', 'charpyImpactEnergyJ', material.mechanical.charpyImpactEnergyJ);
  addPropRow('Mechanical Telemetry', 'Poisson\'s Ratio', '', 'poissonsRatio', material.mechanical.poissonsRatio);
  addPropRow('Mechanical Telemetry', 'Damping Loss Factor', '', 'dampingLossFactor', material.mechanical.dampingLossFactor);
  addPropRow('Mechanical Telemetry', 'Ultrasonic Wave Speed', 'm/s', 'waveSpeedMs', material.mechanical.waveSpeedMs);

  // Section 3: AM Process Quality & Precision
  addPropRow('AM Process Quality', 'Density', 'g/cm³', 'densityGcm3', material.amQuality.densityGcm3);
  addPropRow('AM Process Quality', 'Relative Density', '%', 'relativeDensityPct', material.amQuality.relativeDensityPct);
  addPropRow('AM Process Quality', 'Internal Porosity', '%', 'porosityPct', material.amQuality.porosityPct);
  addPropRow('AM Process Quality', 'Surface Roughness (Ra)', 'µm', 'surfaceRoughnessRa', material.amQuality.surfaceRoughnessRa);
  addPropRow('AM Process Quality', 'Peak Residual Stress', 'MPa', 'residualStressMax', material.amQuality.residualStressMax);
  addPropRow('AM Process Quality', 'Volumetric Build Rate', 'cm³/h', 'buildRate', material.amQuality.buildRate);
  addPropRow('AM Process Quality', 'Mechanical Anisotropy (Z/XY)', '', 'anisotropy', material.amQuality.anisotropy);
  addPropRow('AM Process Quality', 'Min Feature Size', 'µm', 'minFeatureSize', material.amQuality.minFeatureSize);
  addPropRow('AM Process Quality', 'Dimensional Accuracy', '±µm', 'accuracy', material.amQuality.accuracy);

  // Section 4: Thermal Telemetry
  addPropRow('Thermal Telemetry', 'Liquidus / Melting Point', '°C', 'liquidusC', material.thermal.liquidusC);
  addPropRow('Thermal Telemetry', 'Beta Transus Temperature', '°C', 'betaTransusC', material.thermal.betaTransusC);
  addPropRow('Thermal Telemetry', 'Max Service Temperature', '°C', 'maxServiceTempC', material.thermal.maxServiceTempC);
  addPropRow('Thermal Telemetry', 'Thermal Conductivity', 'W/m·K', 'thermalConductivity', material.thermal.thermalConductivity);
  addPropRow('Thermal Telemetry', 'Thermal Expansion (CTE)', '10^-6/K', 'thermalExpansionCTE', material.thermal.thermalExpansionCTE);
  addPropRow('Thermal Telemetry', 'Specific Heat Capacity', 'J/kg·K', 'specificHeat', material.thermal.specificHeat);
  addPropRow('Thermal Telemetry', 'Thermal Emissivity', '', 'emissivity', material.thermal.emissivity);

  // Section 5: Chemical & Environmental
  addPropRow('Chemical & Environmental', 'Oxygen Content', 'wt. %', 'oxygenContentWt', material.chemicalAndPhysical.oxygenContentWt);
  addPropRow('Chemical & Environmental', 'Electrical Resistivity', 'µΩ·cm', 'electricalResistivity', material.chemicalAndPhysical.electricalResistivity);
  addPropRow('Chemical & Environmental', 'Laser Absorptivity (1064 nm)', '', 'laserAbsorptivity', material.chemicalAndPhysical.laserAbsorptivity);
  addPropRow('Chemical & Environmental', 'Visible Reflectance', '%', 'visibleReflectance', material.chemicalAndPhysical.visibleReflectance);
  addRow('Chemical & Environmental', 'Corrosion Rating', '', (v) => v.propertyOverrides?.corrosionRating || material.chemicalAndPhysical.corrosionRating);
  addRow('Chemical & Environmental', 'Biocompatibility Rating', '', (v) => v.propertyOverrides?.biocompatibilityRating || material.chemicalAndPhysical.biocompatibilityRating);
  addPropRow('Chemical & Environmental', 'Magnetic Susceptibility', '10^-6 emu/g', 'magneticSusceptibility', material.chemicalAndPhysical.magneticSusceptibility);

  return rows.map((r) => r.join(',')).join('\r\n');
}

/**
 * Public function to export alloy CSV
 */
export function exportAlloyToCsv(
  material: MaterialItem | null,
  activeVariant?: ProcessVariant | null,
  mode: 'active-route' | 'all-routes' = 'active-route'
) {
  if (!material) return;
  let csvContent: string;
  let filename: string;

  if (mode === 'all-routes') {
    csvContent = generateAllRoutesTableCsv(material);
    filename = `${material.id}-all-process-routes.csv`;
  } else {
    const variant = activeVariant || material.processRoutes[0];
    if (!variant) return;
    csvContent = generateSingleRouteDatasheetCsv(material, variant);
    filename = `${material.id}-${variant.id}-datasheet.csv`;
  }

  // Always prepend UTF-8 BOM so Excel opens it with proper symbols and column alignments
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;', true);
}

/**
 * Exports alloy data to a styled engineering datasheet PDF with perfect font rendering,
 * guaranteed text wrapping, non-overflowing cards, and clean separated footers.
 */
export async function exportAlloyToPdf(
  material: MaterialItem | null,
  activeVariant?: ProcessVariant | null
) {
  if (!material) return;
  const variant = activeVariant || material.processRoutes[0];
  if (!variant) return;

  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // Deep Slate Navy
  doc.rect(0, 0, pageWidth, 60, 'F');

  doc.setFillColor(80, 216, 233); // Cyan accent strip
  doc.rect(margin, 14, 4, 32, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('MATSCI NAVIGATOR | METALLURGICAL DATASHEET', margin + 12, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Titanium Additive Manufacturing Spec - Calibrated ISO/ASTM AM Telemetry - Exported ${new Date().toLocaleDateString()}`,
    margin + 12,
    42
  );

  let currentY = 72;

  // 2. Alloy Metadata Card - Fully structured, wrapped, and clean
  const cleanName = cleanPdfText(material.name);
  const cleanStandard = cleanPdfText(material.standardCode);
  const cleanFormula = cleanPdfText(material.formula);
  const cleanCrystal = cleanPdfText(material.crystalStructure);
  const cleanCategory = cleanPdfText(material.category);
  const cleanOverview = cleanPdfText(material.overview || 'Calibrated titanium additive manufacturing system.');

  // Pre-calculate wrapped overview lines
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const overviewLines = doc.splitTextToSize(cleanOverview, contentWidth - 20).slice(0, 2);

  const cardHeight = 68 + overviewLines.length * 10;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, currentY, contentWidth, cardHeight, 4, 4, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, currentY, contentWidth, cardHeight, 4, 4, 'S');

  // Card Header: Name on left, Standard Code right-aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(cleanName, margin + 10, currentY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(2, 132, 199);
  doc.text(cleanStandard, pageWidth - margin - 10, currentY + 16, { align: 'right' });

  // Formula & Crystal Lines
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Formula: ${cleanFormula}`, margin + 10, currentY + 29);
  doc.text(`Crystal Structure: ${cleanCrystal}`, margin + 10, currentY + 41);

  // AM Classification Line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `AM Process Family: ${cleanCategory}   |   Calibrated Routes: ${material.processRoutes.length} variants across 8 ISO/ASTM processes`,
    margin + 10,
    currentY + 53
  );

  // Overview Lines
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  overviewLines.forEach((line: string, idx: number) => {
    doc.text(line, margin + 10, currentY + 65 + idx * 10);
  });

  currentY += cardHeight + 8;

  // 3. Active Process Route Specification Card
  const cleanRouteName = cleanPdfText(variant.name);
  const cleanSubproc = cleanPdfText(variant.subprocess);
  const cleanCond = cleanPdfText(variant.postProcessingCondition);
  const cleanTemper = cleanPdfText(variant.temperOrGrade);
  const cleanCooling = cleanPdfText(variant.coolingRate);
  const cleanAtmos = cleanPdfText(variant.atmosphere);
  const cleanYieldChg = cleanPdfText(variant.yieldChangePct);

  const routeCardHeight = 62;
  doc.setFillColor(240, 249, 255);
  doc.roundedRect(margin, currentY, contentWidth, routeCardHeight, 4, 4, 'F');
  doc.setDrawColor(186, 230, 253);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, currentY, contentWidth, routeCardHeight, 4, 4, 'S');

  // Route Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(3, 105, 161);
  doc.text(`Active Process Route: ${cleanRouteName}`, margin + 10, currentY + 14);

  // Subprocess & Condition
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`Subprocess: ${cleanSubproc}`, margin + 10, currentY + 26);
  doc.text(`Post-Processing: ${cleanCond}`, margin + 270, currentY + 26);

  // Temper & Yield Delta
  doc.text(`Temper / Grade: ${cleanTemper}`, margin + 10, currentY + 38);
  doc.text(`Yield Strength Delta: ${cleanYieldChg}`, margin + 270, currentY + 38);

  // Thermal Vectors & Atmosphere
  doc.text(
    `Thermal Vector: Peak ${variant.peakTempC} deg C   |   Hold: ${variant.holdTimeMin} min   |   Cooling: ${cleanCooling}`,
    margin + 10,
    currentY + 50
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text(`Atmosphere: ${cleanAtmos}`, margin + 10, currentY + 59);

  currentY += routeCardHeight + 8;

  // 4. Tables with Clean Sanitized Telemetry
  const p = variant.propertyOverrides || {};

  // Table 1: Mechanical Telemetry
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Mechanical Property Metric', 'Calibrated Value', 'Standard Reference Condition']],
    body: [
      ['Ultimate Tensile Strength (UTS)', cleanPdfText(p.tensileStrengthMPa || material.mechanical.tensileStrengthMPa), 'Ambient 20 deg C'],
      ['Yield Strength (0.2% Offset)', cleanPdfText(p.yieldStrengthMPa || material.mechanical.yieldStrengthMPa), 'ASTM E8M standard test'],
      ['Elastic Modulus (E)', cleanPdfText(p.elasticModulusGPa || material.mechanical.elasticModulusGPa), 'Resonant ultrasound spectroscopy'],
      ['Elongation at Break', cleanPdfText(p.elongationPct || material.mechanical.elongationPct), 'Gauge length 4D'],
      ['Vickers Hardness', cleanPdfText(p.hardnessHV || material.mechanical.hardnessHV), 'HV10 load rating'],
      ['Fracture Toughness (K1c)', cleanPdfText(p.fractureToughness || material.mechanical.fractureToughness), 'ASTM E399 plane-strain'],
      ['Fatigue Strength (10^7 cycles)', cleanPdfText(p.fatigueStrengthMPa || material.mechanical.fatigueStrengthMPa), 'R = 0.1, Kt = 1.0'],
      ['Charpy Impact Energy', cleanPdfText(p.charpyImpactEnergyJ || material.mechanical.charpyImpactEnergyJ), 'ASTM E23 V-notch standard (20 deg C)'],
      ['Poisson\'s Ratio', cleanPdfText(p.poissonsRatio || material.mechanical.poissonsRatio), 'ASTM E132 lateral contraction'],
      ['Damping Loss Factor', cleanPdfText(p.dampingLossFactor || material.mechanical.dampingLossFactor), 'Resonance decay modal response'],
      ['Ultrasonic Wave Speed', cleanPdfText(p.waveSpeedMs || material.mechanical.waveSpeedMs), 'Longitudinal acoustic velocity'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42], cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 195, fontStyle: 'bold' },
      1: { cellWidth: 130, halign: 'left' },
      2: { cellWidth: 198.28 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 2: AM Quality & Precision Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['AM Quality & Precision Metric', 'Calibrated Value', 'Description / Measurement Vector']],
    body: [
      ['Density', cleanPdfText(p.densityGcm3 || material.amQuality.densityGcm3), 'Archimedes immersion method'],
      ['Relative Density', cleanPdfText(p.relativeDensityPct || material.amQuality.relativeDensityPct), 'Percentage of theoretical crystal density'],
      ['Internal Porosity', cleanPdfText(p.porosityPct || material.amQuality.porosityPct), 'X-ray Micro-CT / High-res image analysis'],
      ['Surface Roughness (Ra)', cleanPdfText(p.surfaceRoughnessRa || material.amQuality.surfaceRoughnessRa), 'Optical profilometry ISO 4287'],
      ['Peak Residual Stress', cleanPdfText(p.residualStressMax || material.amQuality.residualStressMax), 'X-ray diffraction sin^2(psi) method'],
      ['Volumetric Build Rate', cleanPdfText(p.buildRate || material.amQuality.buildRate), 'Productive laser/beam scanning speed'],
      ['Mechanical Anisotropy (Z/XY)', cleanPdfText(p.anisotropy || material.amQuality.anisotropy), 'Ratio of vertical to horizontal strength'],
      ['Minimum Feature Size', cleanPdfText(p.minFeatureSize || material.amQuality.minFeatureSize), 'Resolution limit for wall / strut'],
      ['Dimensional Accuracy', cleanPdfText(p.accuracy || material.amQuality.accuracy), 'Deviation envelope on calibrated artifacts'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42], cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 195, fontStyle: 'bold' },
      1: { cellWidth: 130, halign: 'left' },
      2: { cellWidth: 198.28 },
    },
    alternateRowStyles: { fillColor: [240, 253, 250] },
  });

  // PAGE 2: Thermal, Chemical/Physical, and Available Process Routes
  doc.addPage();
  currentY = margin;

  // Table 3: Thermal Telemetry Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Thermal Property Metric', 'Calibrated Value', 'Measurement Method / Reference']],
    body: [
      ['Liquidus / Melting Point', cleanPdfText(p.liquidusC || material.thermal.liquidusC), 'Differential Scanning Calorimetry (DSC)'],
      ['Beta Transus Temperature', cleanPdfText(p.betaTransusC || material.thermal.betaTransusC), 'Alpha-Beta phase transformation boundary'],
      ['Max Service Temperature', cleanPdfText(p.maxServiceTempC || material.thermal.maxServiceTempC), 'Continuous structural service limit'],
      ['Thermal Conductivity', cleanPdfText(p.thermalConductivity || material.thermal.thermalConductivity), 'Laser flash diffusivity method (20 deg C)'],
      ['Thermal Expansion (CTE)', cleanPdfText(p.thermalExpansionCTE || material.thermal.thermalExpansionCTE), 'Dilatometry (20 - 500 deg C)'],
      ['Specific Heat Capacity', cleanPdfText(p.specificHeat || material.thermal.specificHeat), 'DSC calorimetry measurement'],
      ['Thermal Emissivity', cleanPdfText(p.emissivity || material.thermal.emissivity), 'Total hemispherical emissivity at 600 deg C'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [194, 65, 12], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42], cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 195, fontStyle: 'bold' },
      1: { cellWidth: 130, halign: 'left' },
      2: { cellWidth: 198.28 },
    },
    alternateRowStyles: { fillColor: [255, 247, 237] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 4: Chemical, Optical & Environmental Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Chemical / Physical Metric', 'Calibrated Value', 'Classification / Standard Standard']],
    body: [
      ['Oxygen Content (wt. %)', cleanPdfText(p.oxygenContentWt || material.chemicalAndPhysical.oxygenContentWt), 'Inert gas fusion (LECO ASTM E1409)'],
      ['Electrical Resistivity', cleanPdfText(p.electricalResistivity || material.chemicalAndPhysical.electricalResistivity), 'Four-point probe technique'],
      ['Laser Absorptivity (1064 nm)', cleanPdfText(p.laserAbsorptivity || material.chemicalAndPhysical.laserAbsorptivity), 'Integrating sphere reflectometry'],
      ['Visible Reflectance (%)', cleanPdfText(p.visibleReflectance || material.chemicalAndPhysical.visibleReflectance), 'Spectrophotometry (400 - 700 nm)'],
      ['Corrosion Resistance', cleanPdfText(p.corrosionRating || material.chemicalAndPhysical.corrosionRating), 'ASTM G31 immersion / Electrochemical'],
      ['Biocompatibility Rating', cleanPdfText(p.biocompatibilityRating || material.chemicalAndPhysical.biocompatibilityRating), 'ISO 10993 cytotoxicity & osteointegration'],
      ['Magnetic Susceptibility', cleanPdfText(p.magneticSusceptibility || material.chemicalAndPhysical.magneticSusceptibility), 'SQUID magnetometry response'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [109, 40, 217], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42], cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 195, fontStyle: 'bold' },
      1: { cellWidth: 130, halign: 'left' },
      2: { cellWidth: 198.28 },
    },
    alternateRowStyles: { fillColor: [250, 245, 255] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 5: All Available Process Routes Summary Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['#', 'Process Route Name', 'ISO/ASTM Process', 'Condition', 'Peak Temp', 'Hold']],
    body: material.processRoutes.slice(0, 16).map((r, i) => [
      `${i + 1}`,
      cleanPdfText(r.name),
      cleanPdfText(r.processCategory),
      cleanPdfText(r.postProcessingCondition),
      `${r.peakTempC} deg C`,
      `${r.holdTimeMin} min`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 175 },
      2: { cellWidth: 135 },
      3: { cellWidth: 95 },
      4: { cellWidth: 50, halign: 'right' },
      5: { cellWidth: 46.28, halign: 'right' },
    },
  });

  // Clean, non-overlapping footers for every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    // Separator rule
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);

    // Left side: Document brand and page number
    doc.text(
      `MatSci Navigator  |  ${cleanName}  |  Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 13
    );

    // Right side: Notice docked securely against right margin
    doc.text(
      'ISO/ASTM Additive Manufacturing Calibrated Telemetry',
      pageWidth - margin,
      pageHeight - 13,
      { align: 'right' }
    );
  }

  doc.save(`${material.id}-technical-datasheet.pdf`);
}

/**
 * Exports side-by-side process comparison to a landscape PDF report with clean font sanitization
 */
export async function exportProcessComparisonToPdf(
  material: MaterialItem,
  variants: ProcessVariant[]
) {
  if (variants.length === 0) return;

  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new JsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 28;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 55, 'F');

  doc.setFillColor(80, 216, 233);
  doc.rect(margin, 12, 4, 30, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(`PROCESS ROUTE COMPARISON: ${cleanPdfText(material.name)}`, margin + 12, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Side-by-side comparison of ${variants.length} Additive Manufacturing processes for ${cleanPdfText(material.name)} (${cleanPdfText(material.formula)}) - Generated ${new Date().toLocaleDateString()}`,
    margin + 12,
    40
  );

  const headCols = ['Parameter / Metric', ...variants.map((v) => cleanPdfText(v.name))];

  const tableBody: (string | number)[][] = [
    ['ISO/ASTM Category', ...variants.map((v) => cleanPdfText(v.processCategory))],
    ['Subprocess Method', ...variants.map((v) => cleanPdfText(v.subprocess))],
    ['Condition / Temper', ...variants.map((v) => cleanPdfText(v.postProcessingCondition))],
    ['Peak Temperature', ...variants.map((v) => `${v.peakTempC} deg C`)],
    ['Hold Duration', ...variants.map((v) => `${v.holdTimeMin} min`)],
    ['Cooling / Quench Vector', ...variants.map((v) => cleanPdfText(v.coolingRate))],
    ['Process Atmosphere', ...variants.map((v) => cleanPdfText(v.atmosphere))],
    ['Yield Strength Change', ...variants.map((v) => cleanPdfText(v.yieldChangePct))],

    // Mechanical
    ['Tensile Strength (UTS)', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.tensileStrengthMPa || 'N/A'))],
    ['Yield Strength (0.2%)', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.yieldStrengthMPa || 'N/A'))],
    ['Elastic Modulus (E)', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.elasticModulusGPa || 'N/A'))],
    ['Elongation at Break', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.elongationPct || 'N/A'))],
    ['Vickers Hardness', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.hardnessHV || 'N/A'))],
    ['Fracture Toughness (K1c)', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.fractureToughness || 'N/A'))],
    ['Fatigue Strength (10^7)', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.fatigueStrengthMPa || 'N/A'))],
    ['Charpy Impact Energy', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.charpyImpactEnergyJ || 'N/A'))],

    // AM Quality
    ['Relative Density', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.relativeDensityPct || 'N/A'))],
    ['Internal Porosity', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.porosityPct || 'N/A'))],
    ['Surface Roughness (Ra)', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.surfaceRoughnessRa || 'N/A'))],
    ['Peak Residual Stress', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.residualStressMax || 'N/A'))],
    ['Volumetric Build Rate', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.buildRate || 'N/A'))],
    ['Mechanical Anisotropy', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.anisotropy || 'N/A'))],
    ['Min Feature Size', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.minFeatureSize || 'N/A'))],
    ['Dimensional Accuracy', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.accuracy || 'N/A'))],

    // Thermal & Chemical
    ['Max Service Temp', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.maxServiceTempC || 'N/A'))],
    ['Thermal Conductivity', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.thermalConductivity || 'N/A'))],
    ['Oxygen Content (wt. %)', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.oxygenContentWt || 'N/A'))],
    ['Corrosion Rating', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.corrosionRating || 'N/A'))],
    ['Biocompatibility', ...variants.map((v) => cleanPdfText(v.propertyOverrides?.biocompatibilityRating || 'N/A'))],
  ];

  autoTable(doc, {
    startY: 65,
    margin: { left: margin, right: margin },
    head: [headCols],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 2.2 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 125 } },
    alternateRowStyles: { fillColor: [253, 254, 255] },
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22);

    doc.text(
      `MatSci Navigator  |  ${cleanPdfText(material.name)} Process Comparison  |  Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 11
    );

    doc.text(
      'ISO/ASTM Additive Manufacturing Calibrated Telemetry',
      pageWidth - margin,
      pageHeight - 11,
      { align: 'right' }
    );
  }

  doc.save(`${material.id}-process-comparison.pdf`);
}

/**
 * Exports full alloy data to JSON
 */
export function exportAlloyToJson(
  material: MaterialItem,
  activeVariant?: ProcessVariant | null
) {
  const exportPayload = {
    metadata: {
      exportedAt: new Date().toISOString(),
      platform: 'MatSci Navigator',
      database: 'Titanium Additive Manufacturing Spec',
      authorizedProcessesCount: 8,
    },
    alloy: {
      id: material.id,
      name: material.name,
      formula: material.formula,
      crystalStructure: material.crystalStructure,
      standardCode: material.standardCode,
      category: material.category,
      availableProcesses: material.availableProcesses,
      overview: material.overview,
      applications: material.applications,
      baselineMechanical: material.mechanical,
      baselineThermal: material.thermal,
      baselineAmQuality: material.amQuality,
      baselineChemicalAndPhysical: material.chemicalAndPhysical,
    },
    activeProcessRoute: activeVariant || null,
    allProcessRoutesCount: material.processRoutes.length,
    allProcessRoutes: material.processRoutes,
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  downloadFile(jsonStr, `${material.id}-complete-spec.json`, 'application/json');
}
