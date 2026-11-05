const fs = require('fs');
const path = require('path');

const csvPath = path.resolve(__dirname, '../../data/materials.csv');
const outPath = path.resolve(__dirname, '../src/data/materialsData.ts');
const catalogDir = path.resolve(__dirname, '../src/data/materialsCatalog');

console.log('Reading CSV from:', csvPath);
const csvContent = fs.readFileSync(csvPath, 'utf8');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  function parseLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }

  const headers = parseLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] !== undefined ? cols[idx].trim() : '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

const { rows } = parseCsv(csvContent);
console.log(`Parsed ${rows.length} rows.`);

// The 8 Authorized Additive Manufacturing Processes (strictly matching user specification)
const AUTHORIZED_PROCESSES = [
  'Binder Jetting',
  'Directed Energy Deposition',
  'Material Extrusion',
  'Material Jetting',
  'Powder Bed Fusion',
  'Sheet Lamination',
  'Vat Photopolymerization',
  'Wire arc additive manufacturing'
];

function normalizeProcessCategory(cat) {
  const clean = (cat || '').trim();
  if (clean.toLowerCase().includes('wire arc')) {
    return 'Wire arc additive manufacturing';
  }
  for (const p of AUTHORIZED_PROCESSES) {
    if (p.toLowerCase() === clean.toLowerCase()) return p;
  }
  return clean;
}

function getMethodLabel(sub) {
  if (!sub) return '';
  if (sub.includes('Laser PBF')) return 'Laser';
  if (sub.includes('Electron-beam') || sub.includes('EBM')) return 'E-Beam';
  if (sub.includes('powder DED')) return 'Powder';
  if (sub.includes('wire DED')) return 'Wire';
  if (sub.includes('GTAW')) return 'GTAW';
  if (sub.includes('Plasma-arc')) return 'Plasma';
  if (sub.includes('Binder jetting')) return 'Sinter';
  if (sub.includes('filament')) return 'FFF';
  if (sub.includes('slurry') || sub.includes('stereolithography')) return 'DLP/SLA';
  if (sub.includes('Nanoparticle')) return 'Nano-Ink';
  if (sub.includes('Ultrasonic') || sub.includes('UAM')) return 'Ultrasonic';
  if (sub.includes('foil')) return 'Diffusion';
  return '';
}

const ALLOY_INFO = {
  'TI-001': {
    id: 'ti-grade-1',
    name: 'Ti Grade 1 (CP)',
    tagLabel: 'CP Titanium',
    subtitle: 'Commercially pure unalloyed titanium (Highest Ductility)',
    formula: 'Ti (CP Grade 1, O ≤ 0.18%)',
    crystalStructure: 'HCP (α-phase, Hexagonal Close-Packed)',
    standardCode: 'ASTM B265 / ASTM F67',
    overview: 'Lowest strength and highest purity unalloyed titanium offering maximum ductility, superior cold formability, and outstanding resistance to oxidizing corrosion.',
    applications: ['Chemical processing vessels', 'Marine plate heat exchangers', 'Offshore desulfurization', 'Deep-drawn cryogenic containers', 'Architecture']
  },
  'TI-002': {
    id: 'ti-grade-2',
    name: 'Ti Grade 2 (CP)',
    tagLabel: 'CP Titanium',
    subtitle: 'Industrial workhorse unalloyed titanium',
    formula: 'Ti (CP Grade 2, O ≤ 0.25%)',
    crystalStructure: 'HCP (α-phase, Hexagonal Close-Packed)',
    standardCode: 'ASTM B265 / ASTM B348 / NACE MR0175',
    overview: 'The universal benchmark commercially pure titanium. Balances moderate mechanical strength with high weldability and supreme resistance to saltwater and industrial acids.',
    applications: ['Offshore oil & gas piping', 'Seawater desalination plants', 'Chlor-alkali electrolytic reactors', 'Flue gas desulfurization systems', 'Marine hardware']
  },
  'TI-003': {
    id: 'ti-grade-3',
    name: 'Ti Grade 3 (CP)',
    tagLabel: 'CP Titanium',
    subtitle: 'Intermediate-strength unalloyed titanium',
    formula: 'Ti (CP Grade 3, O ≤ 0.35%)',
    crystalStructure: 'HCP (α-phase, Hexagonal Close-Packed)',
    standardCode: 'ASTM B265 / ASTM B348',
    overview: 'Higher strength commercially pure titanium grade achieved via controlled interstitial oxygen while maintaining high corrosion resistance and formability.',
    applications: ['Pressure vessels', 'Aerospace ducting systems', 'Chemical process heat exchangers', 'Cryogenic fuel storage tanks']
  },
  'TI-004': {
    id: 'ti-grade-4',
    name: 'Ti Grade 4 (CP)',
    tagLabel: 'CP Titanium',
    subtitle: 'Highest strength unalloyed titanium',
    formula: 'Ti (CP Grade 4, O ≤ 0.40%)',
    crystalStructure: 'HCP (α-phase, Hexagonal Close-Packed)',
    standardCode: 'ASTM B265 / ASTM F67',
    overview: 'Highest strength unalloyed titanium, matching the yield strength of annealed Ti-6Al-4V while offering unmatched biocompatibility and osteointegration.',
    applications: ['Dental implants', 'Maxillofacial reconstruction screws', 'Trauma fixation plates', 'High-strength aerospace tubing', 'Marine sensors']
  },
  'TI-005': {
    id: 'ti-6al-4v',
    name: 'Ti-6Al-4V (Grade 5)',
    tagLabel: 'Alpha-Beta Alloy',
    subtitle: 'Universal aerospace & industrial AM benchmark alloy',
    formula: 'Ti-6Al-4V',
    crystalStructure: 'Dual-phase HCP (α) + BCC (β)',
    standardCode: 'ASTM B265 / ASTM B348 / AMS 4928 / ASTM F2924',
    overview: 'The global flagship titanium alloy accounting for >50% of world titanium usage. Combines high specific strength, excellent fracture toughness, and heat treatability.',
    applications: ['Commercial airframe structures', 'Gas turbine compressor blades & disks', 'Rocket engine gimbal mounts', 'High-performance motorsport hubs', 'Marine submersibles']
  },
  'TI-006': {
    id: 'ti-6al-4v-eli',
    name: 'Ti-6Al-4V ELI (Grade 23)',
    tagLabel: 'Biomedical / Cryo',
    subtitle: 'Extra Low Interstitial damage-tolerant aerospace & medical alloy',
    formula: 'Ti-6Al-4V ELI (O ≤ 0.13%)',
    crystalStructure: 'Dual-phase HCP (α) + BCC (β)',
    standardCode: 'ASTM F136 / ASTM F3001 / AMS 4930',
    overview: 'High-purity variant of Ti-6Al-4V with lowered interstitial oxygen and iron, delivering extraordinary fracture toughness, impact resistance, and cryogenic ductility.',
    applications: ['Orthopedic total joint replacements', 'Cryogenic liquid rocket tanks', 'Deep-sea pressure hulls', 'Surgical bone fixation hardware']
  },
  'TI-007': {
    id: 'ti-6al-7nb',
    name: 'Ti-6Al-7Nb',
    tagLabel: 'Biomedical Implant',
    subtitle: 'Vanadium-free biocompatible surgical implant alloy',
    formula: 'Ti-6Al-7Nb',
    crystalStructure: 'Dual-phase HCP (α) + BCC (β)',
    standardCode: 'ASTM F1295 / ISO 5832-11',
    overview: 'Engineered as a biologically inert medical alternative to Ti-64, replacing vanadium with niobium to eliminate long-term cytotoxic tissue discoloration while keeping high strength.',
    applications: ['Permanent femoral hip stems', 'Spinal fusion cages', 'Orthopedic bone plates', 'Dental suprastructures', 'Cardiac pacemaker cases']
  },
  'TI-008': {
    id: 'ti-3al-2-5v',
    name: 'Ti-3Al-2.5V (Grade 9)',
    tagLabel: 'Hydraulic Tubing',
    subtitle: 'High-formability near-alpha aerospace tubing alloy',
    formula: 'Ti-3Al-2.5V',
    crystalStructure: 'Near-alpha HCP (α) with minor BCC (β)',
    standardCode: 'ASTM B338 / AMS 4943 / AMS 4945',
    overview: 'Known as "half-64", offering 20-50% higher strength than CP titanium with exceptional cold-drawing ductility and high pressure capability.',
    applications: ['Aerospace high-pressure hydraulic tubing', 'Submarine cooling conduits', 'High-performance bicycle frames', 'Offshore umbilical lines']
  },
  'TI-009': {
    id: 'ti-5al-2-5sn',
    name: 'Ti-5Al-2.5Sn',
    tagLabel: 'Cryogenic Alpha',
    subtitle: 'All-alpha cryogenic rocket turbopump alloy',
    formula: 'Ti-5Al-2.5Sn',
    crystalStructure: 'All-alpha HCP (α)',
    standardCode: 'AMS 4926 / AMS 4966 / MIL-T-9047',
    overview: 'All-alpha non-heat treatable titanium alloy with exceptional weldability and outstanding notch toughness down to liquid hydrogen temperatures (20 K).',
    applications: ['Liquid hydrogen rocket turbopump impellers', 'Cryogenic propellant manifolds', 'Gas turbine stator rings', 'Space propulsion ducting']
  },
  'TI-010': {
    id: 'ti-6242',
    name: 'Ti-6242',
    tagLabel: 'High-Temp Aero',
    subtitle: 'High-temperature creep-resistant jet engine compressor alloy',
    formula: 'Ti-6Al-2Sn-4Zr-2Mo-0.1Si',
    crystalStructure: 'Near-alpha HCP (α) with silicide dispersion',
    standardCode: 'AMS 4919 / AMS 4975 / AMS 4976',
    overview: 'Premier aerospace compressor disk alloy engineered for sustained high-stress service up to 540 °C with exceptional resistance to creep and thermo-mechanical fatigue.',
    applications: ['Jet engine high-pressure compressor disks', 'Integrally bladed rotors (Blisks)', 'Turbine rear compressor stages', 'Afterburner heat shields']
  },
  'TI-011': {
    id: 'ti-6246',
    name: 'Ti-6246',
    tagLabel: 'High-Strength Disk',
    subtitle: 'Deep-hardening high-strength compressor rotor alloy',
    formula: 'Ti-6Al-2Sn-4Zr-6Mo',
    crystalStructure: 'Alpha-beta with elevated beta volume fraction',
    standardCode: 'AMS 4981',
    overview: 'Deep-hardenable alloy combining the creep resistance of Ti-6242 with the extreme tensile strength and fracture toughness of near-beta alloys.',
    applications: ['Gas turbine intermediate compressor rotors', 'Fan disks and shafts', 'Deep sour-gas oilwell tubulars', 'Heavy aerospace structures']
  },
  'TI-012': {
    id: 'ti-10v-2fe-3al',
    name: 'Ti-10V-2Fe-3Al',
    tagLabel: 'Near-Beta Heavy',
    subtitle: 'High-strength near-beta landing gear structural alloy',
    formula: 'Ti-10V-2Fe-3Al',
    crystalStructure: 'Metastable BCC (β) with fine secondary α',
    standardCode: 'AMS 4983 / AMS 4984 / AMS 4987',
    overview: 'Heavy near-beta structural alloy heat-treatable to yield strengths exceeding 1200 MPa with high fracture toughness and resistance to stress corrosion cracking.',
    applications: ['Commercial airliner main landing gear truck beams', 'Rotorcraft rotor head hubs', 'Helicopter mast bearings', 'Airframe wing-carry-through bulkheads']
  },
  'TI-013': {
    id: 'ti-5553',
    name: 'Ti-5Al-5V-5Mo-3Cr (Ti-5553)',
    tagLabel: 'Deep-Harden Beta',
    subtitle: 'Deep-hardening near-beta structural airframe alloy',
    formula: 'Ti-5Al-5V-5Mo-3Cr',
    crystalStructure: 'High-hardenability BCC (β) matrix',
    standardCode: 'AMS 4999 / BMS 7-360',
    overview: 'Advanced near-beta alloy engineered for deep through-thickness hardenability in massive structural sections, replacing heavy high-strength steels.',
    applications: ['Boeing 787 & Airbus A350 landing gear components', 'Wing-fuselage attachment lugs', 'Engine pylon thrust struts', 'High-load airframe tracks']
  },
  'TI-014': {
    id: 'ti-15mo',
    name: 'Ti-15Mo',
    tagLabel: 'Low-Modulus Beta',
    subtitle: 'Corrosion-resistant low-modulus orthopedic beta alloy',
    formula: 'Ti-15Mo',
    crystalStructure: 'Single-phase metastable BCC (β)',
    standardCode: 'ASTM F2066',
    overview: 'Single-phase metastable beta alloy exhibiting low elastic modulus (~80 GPa) closer to bone, outstanding resistance to pitting/crevice corrosion, and zero cytotoxicity.',
    applications: ['Orthopedic revision femoral hip stems', 'Spinal fixation rods', 'Intramedullary nails', 'Chemical flue gas scrubbers', 'Dental posts']
  },
  'TI-015': {
    id: 'ti-13nb-13zr',
    name: 'Ti-13Nb-13Zr',
    tagLabel: 'Bio-Near-Beta',
    subtitle: 'Non-toxic low-modulus orthopedic near-beta alloy',
    formula: 'Ti-13Nb-13Zr',
    crystalStructure: 'Near-beta BCC with martensitic α\'\' transformation',
    standardCode: 'ASTM F1713',
    overview: 'Second-generation biocompatible near-beta alloy featuring low elastic modulus (79 GPa) and total absence of toxic alloying additions.',
    applications: ['Total hip arthroplasty stems', 'Bone fracture repair plates', 'Porous 3D printed trabecular lattices', 'Dental implant fixtures']
  },
  'TI-016': {
    id: 'ti-tnzt',
    name: 'Ti-35Nb-7Zr-5Ta (TNZT)',
    tagLabel: 'Superelastic Beta',
    subtitle: 'Ultra-low modulus superelastic bone-mimicking beta alloy',
    formula: 'Ti-35Nb-7Zr-5Ta',
    crystalStructure: 'Body-Centered Cubic (β)',
    standardCode: 'Biomedical Superelastic Standard',
    overview: 'Ultra-low elastic modulus (~55-65 GPa) beta alloy designed to completely eliminate stress-shielding bone resorption in orthopedic applications.',
    applications: ['Custom 3D-printed patient cranial implants', 'Trabecular spinal interbody cages', 'Superelastic bone staples', 'Cardiovascular stents']
  },
  'TI-017': {
    id: 'ti-0-2pd',
    name: 'Ti-0.2Pd (Grade 7)',
    tagLabel: 'Noble Metal CP',
    subtitle: 'Palladium-enhanced extreme corrosion resistance titanium',
    formula: 'Ti-0.2Pd (Grade 7)',
    crystalStructure: 'HCP (α-phase, Hexagonal Close-Packed)',
    standardCode: 'ASTM B265 Grade 7 / ASTM B348',
    overview: 'Identical to Grade 2 in mechanical properties but micro-alloyed with 0.12-0.25% palladium to provide the highest crevice and reducing acid resistance of any titanium grade.',
    applications: ['Boiling hydrochloric and sulfuric acid reactors', 'Chemical processing evaporators', 'Geothermal brine heat exchangers', 'Marine chlorination systems']
  },
  'TI-018': {
    id: 'ti-beta21s',
    name: 'Ti-Beta21S',
    tagLabel: 'Oxidation Beta',
    subtitle: 'Oxidation-resistant metastable beta foil & exhaust alloy',
    formula: 'Ti-15Mo-3Nb-3Al-0.2Si',
    crystalStructure: 'High-temperature oxidation-resistant BCC (β)',
    standardCode: 'AMS 4897 / AMS 4898',
    overview: 'Engineered specifically for aerospace applications requiring high oxidation resistance and resistance to hot aircraft hydraulic fluids up to 550 °C.',
    applications: ['Aircraft engine nacelle exhaust plugs', 'Tailpipe thermal nozzles', 'Titanium matrix composite (TMC) foils', 'High-temperature thermal shields']
  },
  'TI-019': {
    id: 'ti-48al-2cr-2nb',
    name: 'Ti-48Al-2Cr-2Nb (gamma TiAl)',
    tagLabel: 'Intermetallic',
    subtitle: 'Low-density high-temperature turbine blade intermetallic',
    formula: 'Ti-48Al-2Cr-2Nb (at. %)',
    crystalStructure: 'Ordered Tetragonal L1₀ (γ) + D0₁₉ (α₂)',
    standardCode: 'Aero-Engine Turbine Blade Spec',
    overview: 'Revolutionary intermetallic compound offering 50% density reduction vs nickel superalloys (~3.9 g/cm³) with exceptional specific creep strength up to 750 °C.',
    applications: ['GEnx & GE9X low-pressure turbine blades', 'High-performance motorsport turbocharger wheels', 'Automotive exhaust poppet valves']
  },
  'TI-020': {
    id: 'ti-811',
    name: 'Ti-8Al-1Mo-1V (Ti-811)',
    tagLabel: 'High-Modulus Alpha',
    subtitle: 'Highest modulus, lowest density conventional compressor alloy',
    formula: 'Ti-8Al-1Mo-1V',
    crystalStructure: 'Near-alpha HCP (α)',
    standardCode: 'AMS 4915 / AMS 4916 / AMS 4972',
    overview: 'Delivers the highest elastic modulus (120 GPa) and lowest density of any conventional titanium alloy, maximizing dynamic stiffness in high-speed rotating compressor stages.',
    applications: ['Jet engine high-pressure compressor blades', 'Stator vanes', 'Supersonic transport airframe structures', 'High-stiffness missile fins']
  }
};

// Group rows by alloy_id
const rowsByAlloy = {};
rows.forEach(r => {
  const aid = r.alloy_id;
  if (!rowsByAlloy[aid]) rowsByAlloy[aid] = [];
  rowsByAlloy[aid].push(r);
});

function buildStepsForVariant(r, normProcess) {
  const sub = r.subprocess || '';
  const post = r.post_processing_condition || '';
  const transus = parseFloat(r.beta_transus_temperature_C) || 995;
  const steps = [];

  if (normProcess === 'Powder Bed Fusion') {
    if (sub.includes('Electron-beam') || sub.includes('EBM')) {
      steps.push({
        phaseCode: 'PHASE_01 // HIGH_VACUUM',
        stage: 'Turbomolecular Vacuum & Helium Bleed',
        temperature: '700 °C (Sinter Bed)',
        pressure: '1e-4 mbar (He 2e-3 mbar bleed)',
        duration: '60 min',
        atmosphere: 'Regulated Helium bleed',
        details: 'High vacuum prevents oxidation; defocused electron beam preheats powder bed to 700 °C.'
      });
      steps.push({
        phaseCode: 'PHASE_02 // E_BEAM_MELT',
        stage: 'High-Velocity Multi-Beam Melting',
        temperature: '1750 °C (Focal Spot)',
        pressure: '2e-3 mbar',
        duration: `${Math.round(100 / (parseFloat(r.build_rate_cm3_h) || 75))} hr / batch`,
        atmosphere: 'Helium partial vacuum',
        details: `60 kV acceleration beam fuses powder with near-zero residual stress (${r.residual_stress_max_MPa} MPa).`
      });
    } else {
      steps.push({
        phaseCode: 'PHASE_01 // INERT_PURGE',
        stage: 'Chamber Vacuum & Argon Purge',
        temperature: '180 °C (Baseplate Preheat)',
        pressure: '0.1 MPa (Argon)',
        duration: '45 min',
        atmosphere: 'High-purity Argon (O₂ < 50 ppm)',
        details: 'Evacuation to 5 mbar followed by laminar argon purge to prevent interstitial oxygen pickup.'
      });
      steps.push({
        phaseCode: 'PHASE_02 // LASER_MELT',
        stage: 'Precision Laser Powder Bed Fusion',
        temperature: `${Math.round(parseFloat(r.liquidus_temperature_C) || 1660)} °C (Melt Zone)`,
        pressure: '0.1 MPa',
        duration: `${Math.round(100 / (parseFloat(r.build_rate_cm3_h) || 25))} hr / batch`,
        atmosphere: 'Argon Recirculation',
        details: `Yb-fiber laser selectively fuses 30–50 µm powder layers at build rate of ${r.build_rate_cm3_h} cm³/h.`
      });
    }
  } else if (normProcess === 'Directed Energy Deposition') {
    steps.push({
      phaseCode: 'PHASE_01 // SUBSTRATE_PREP',
      stage: 'Substrate Levelling & Shield Purge',
      temperature: 'Ambient / 150 °C',
      pressure: '0.1 MPa',
      duration: '30 min',
      atmosphere: 'Argon Shroud Flow (20 L/min)',
      details: 'Baseplate preparation and continuous multi-nozzle argon gas stabilization.'
    });
    steps.push({
      phaseCode: 'PHASE_02 // DIRECT_DEPOSITION',
      stage: 'Coaxial Laser / Wire Melt Deposition',
      temperature: '1850 °C (Melt Pool)',
      pressure: '0.1 MPa',
      duration: `${Math.round(250 / (parseFloat(r.build_rate_cm3_h) || 100))} hr`,
      atmosphere: 'Coaxial Argon Shield',
      details: `High deposition rate (${r.build_rate_cm3_h} cm³/h) near-net-shape deposition.`
    });
  } else if (normProcess === 'Wire arc additive manufacturing') {
    steps.push({
      phaseCode: 'PHASE_01 // PURGE_CONTAINMENT',
      stage: 'Enclosure Purge & Trailing Shield Alignment',
      temperature: 'Ambient',
      pressure: '0.1 MPa',
      duration: '40 min',
      atmosphere: 'Argon Bubble (O₂ < 50 ppm)',
      details: 'Oxygen elimination in flexible containment bubble to avoid brittle alpha-case formation.'
    });
    steps.push({
      phaseCode: 'PHASE_02 // WAAM_DEPOSITION',
      stage: 'Robotic Wire Arc Continuous Deposition',
      temperature: '1800 °C (Electric Arc)',
      pressure: '0.1 MPa',
      duration: `${Math.round(500 / (parseFloat(r.build_rate_cm3_h) || 300))} hr`,
      atmosphere: 'Trailing Argon Shield',
      details: `Deposition rate up to ${r.build_rate_cm3_h} cm³/h with controlled interpass cooling below 150 °C.`
    });
  } else if (normProcess === 'Binder Jetting') {
    steps.push({
      phaseCode: 'PHASE_01 // BINDER_PRINT',
      stage: 'Inkjet Binder Deposition on Powder Bed',
      temperature: 'Ambient (25 °C)',
      pressure: 'Ambient',
      duration: '4 hr',
      atmosphere: 'Ambient Air',
      details: 'Layerwise spreading of spherical powder and binder droplet printing with 18% shrinkage scaling.'
    });
    steps.push({
      phaseCode: 'PHASE_02 // VACUUM_SINTER',
      stage: 'Solvent/Thermal Debind & High-Vacuum Sinter',
      temperature: '1320 °C',
      pressure: '< 1e-5 mbar',
      duration: '18 hr total',
      atmosphere: 'High Vacuum (< 1e-5 mbar)',
      details: `Solid-state diffusion sintering achieves ${r.relative_density}% relative density.`
    });
  } else if (normProcess === 'Material Extrusion') {
    steps.push({
      phaseCode: 'PHASE_01 // FFF_PRINT',
      stage: 'Metal-Polymer Filament Extrusion',
      temperature: '230 °C (Nozzle) / 70 °C (Bed)',
      pressure: 'Ambient',
      duration: '5 hr',
      atmosphere: 'Ambient Air',
      details: 'Extrusion of 100% infill green body with organic binder support.'
    });
    steps.push({
      phaseCode: 'PHASE_02 // SINTERING',
      stage: 'Debind Wash & Vacuum Sintering',
      temperature: '1300 °C',
      pressure: '< 1e-5 mbar',
      duration: '20 hr',
      atmosphere: 'High Vacuum',
      details: `Achieves ${r.relative_density}% relative density after binder burnout.`
    });
  } else if (normProcess === 'Vat Photopolymerization') {
    steps.push({
      phaseCode: 'PHASE_01 // DLP_EXPOSE',
      stage: 'Stereolithography UV Photopolymerization',
      temperature: 'Ambient',
      pressure: 'Ambient',
      duration: '3 hr',
      atmosphere: 'Ambient Light-Controlled',
      details: 'DLP digital light projection UV cures 25 µm layers in titanium-loaded slurry.'
    });
    steps.push({
      phaseCode: 'PHASE_02 // THERMAL_SINTER',
      stage: 'Thermal Debinding & Vacuum Consolidation',
      temperature: '1300 °C',
      pressure: '< 1e-5 mbar',
      duration: '24 hr',
      atmosphere: 'High Vacuum',
      details: 'Slow burnout followed by solid-state diffusion sintering.'
    });
  } else if (normProcess === 'Material Jetting') {
    steps.push({
      phaseCode: 'PHASE_01 // INK_JET',
      stage: 'Nanoparticle Liquid Ink Jetting',
      temperature: '80 °C (Bed Evaporation)',
      pressure: 'Ambient',
      duration: '6 hr',
      atmosphere: 'Inert Enclosure',
      details: 'Piezoelectric jetting of colloidal titanium nanoparticles.'
    });
    steps.push({
      phaseCode: 'PHASE_02 // LOW_TEMP_SINTER',
      stage: 'Nanoparticle Fusion Sintering',
      temperature: '1150 °C',
      pressure: '< 1e-5 mbar',
      duration: '8 hr',
      atmosphere: 'High Vacuum',
      details: 'High surface area enables lower sintering temperature.'
    });
  } else if (normProcess === 'Sheet Lamination') {
    steps.push({
      phaseCode: 'PHASE_01 // SOLID_STATE_BOND',
      stage: 'Ultrasonic Consolidation / Diffusion Bonding',
      temperature: '< 200 °C (Solid-State)',
      pressure: '4000 N Normal Force',
      duration: '2 hr',
      atmosphere: 'Ambient / Argon',
      details: 'Acoustic horn scrub or vacuum foil stack diffusion bonding without bulk melting.'
    });
    steps.push({
      phaseCode: 'PHASE_02 // CNC_MILLING',
      stage: 'Interlaminar CNC Contour Milling',
      temperature: 'Ambient',
      pressure: 'Ambient',
      duration: '45 min',
      atmosphere: 'Flood Coolant',
      details: 'Precision trimming of internal and external net dimensions.'
    });
  }

  // Post processing step
  if (post === 'HIP' || post.includes('Sintered + HIP')) {
    steps.push({
      phaseCode: 'PHASE_POST // HIP_TREATMENT',
      stage: 'Hot Isostatic Pressing (HIP)',
      temperature: `${Math.round(transus - 75)} °C`,
      pressure: '100 – 105 MPa',
      duration: '2.0 hr dwell',
      atmosphere: 'Ultra-pure Argon',
      details: `Collapses internal micropores, raising relative density to ${r.relative_density}% and eliminating residual stress to ${r.residual_stress_max_MPa} MPa.`
    });
  } else if (post === 'Stress-relieved') {
    steps.push({
      phaseCode: 'PHASE_POST // STRESS_RELIEF',
      stage: 'Thermal Vacuum Stress Relief',
      temperature: `${Math.round(transus * 0.65)} °C`,
      pressure: '< 1e-4 mbar',
      duration: '3.0 hr dwell',
      atmosphere: 'High Vacuum',
      details: `Relieves locked-in thermal stresses down to ${r.residual_stress_max_MPa} MPa without altering alpha-beta grain morphology.`
    });
  } else if (post === 'Annealed') {
    steps.push({
      phaseCode: 'PHASE_POST // ANNEAL',
      stage: 'Mill / Duplex Annealing Cycle',
      temperature: `${Math.round(transus * 0.78)} °C`,
      pressure: '< 1e-4 mbar',
      duration: '2.0 hr dwell',
      atmosphere: 'Vacuum / Inert Argon',
      details: `Stabilizes tensile ductility (${r.elongation_at_break}%) and enhances fracture toughness (${r.fracture_toughness_KIC_MPa_m_0_5} MPa·m⁰·⁵).`
    });
  } else if (post.includes('Solution-treated') || post.includes('aged')) {
    steps.push({
      phaseCode: 'PHASE_POST // STA_HEAT_TREAT',
      stage: 'Solution Treatment & Artificial Aging (STA)',
      temperature: `${Math.round(transus - 35)} °C → 500 °C`,
      pressure: '< 1e-4 mbar',
      duration: '1 hr sol + 6 hr age',
      atmosphere: 'Vacuum / Gas Quench',
      details: `Precipitates nanoscale coherent alpha needles in beta matrix for peak yield strength (${r.yield_strength_MPa} MPa).`
    });
  } else {
    steps.push({
      phaseCode: 'PHASE_POST // AS_BUILT_STATE',
      stage: `Baseline ${post} Condition`,
      temperature: 'Ambient Cooldown',
      pressure: 'Ambient',
      duration: '1.0 hr',
      atmosphere: 'Argon / Chamber Cooling',
      details: `Retains rapid-solidification microstructural state with ${r.residual_stress_max_MPa} MPa internal residual stress.`
    });
  }

  return steps;
}

const catalog = [];

Object.keys(ALLOY_INFO).forEach(aid => {
  const meta = ALLOY_INFO[aid];
  const alloyRows = rowsByAlloy[aid] || [];
  if (alloyRows.length === 0) return;

  // Distinct authorized processes present for this alloy
  const availableProcesses = [];
  alloyRows.forEach(r => {
    const norm = normalizeProcessCategory(r.iso_astm_category);
    if (!availableProcesses.includes(norm)) {
      availableProcesses.push(norm);
    }
  });

  // Pick a flagship row for baseline properties (preferably HIP LPBF or first available)
  let baseRow = alloyRows.find(r => r.subprocess.includes('Laser PBF') && r.post_processing_condition === 'HIP')
    || alloyRows.find(r => r.post_processing_condition === 'HIP')
    || alloyRows[0];

  const primaryCategory = normalizeProcessCategory(baseRow.iso_astm_category);

  const processRoutes = alloyRows.map((r, idx) => {
    const normProcess = normalizeProcessCategory(r.iso_astm_category);
    const isHIP = r.post_processing_condition === 'HIP' || r.post_processing_condition.includes('HIP');
    const isSR = r.post_processing_condition === 'Stress-relieved';
    const isSTA = r.post_processing_condition.includes('Solution') || r.post_processing_condition.includes('aged');

    let yieldPct = '+0.0%';
    if (isSTA) yieldPct = '+22.5%';
    else if (isHIP) yieldPct = '+8.4%';
    else if (isSR) yieldPct = '-4.2%';

    const steps = buildStepsForVariant(r, normProcess);
    const transus = parseFloat(r.beta_transus_temperature_C) || 995;
    const peakTemp = isHIP ? Math.round(transus - 75) : Math.round(parseFloat(r.liquidus_temperature_C) || 1660);

    const methodLabel = getMethodLabel(r.subprocess);
    const methodSuffix = methodLabel ? ` (${methodLabel})` : '';

    return {
      id: r.variant_id.toLowerCase(),
      name: `${normProcess}${methodSuffix} · ${r.post_processing_condition}`,
      shortName: `${normProcess} · ${r.post_processing_condition}`,
      temperOrGrade: `${normProcess} // ${r.post_processing_condition}`,
      processCategory: normProcess,
      subprocess: r.subprocess,
      postProcessingCondition: r.post_processing_condition,
      summary: `${normProcess} variant in ${r.post_processing_condition} condition (${r.subprocess}). Density: ${r.relative_density}%, Yield: ${r.yield_strength_MPa} MPa, UTS: ${r.ultimate_tensile_strength_MPa} MPa, Roughness: ${r.surface_roughness_Ra_um} µm Ra, Build rate: ${r.build_rate_cm3_h} cm³/h.`,
      peakTempC: peakTemp,
      holdTimeMin: isHIP ? 120 : (isSR ? 180 : 45),
      coolingRate: isHIP ? '50 °C/min (Argon Fan)' : 'Furnace Slow Cool',
      atmosphere: r.subprocess.includes('EBM') ? 'High Vacuum (< 1e-4 mbar)' : 'High-Purity Argon (O₂ < 50 ppm)',
      yieldChangePct: yieldPct,
      steps: steps,
      propertyOverrides: {
        // Mechanical Tests
        tensileStrengthMPa: `${r.ultimate_tensile_strength_MPa} MPa`,
        yieldStrengthMPa: `${r.yield_strength_MPa} MPa`,
        elasticModulusGPa: `${r.youngs_modulus_GPa} GPa`,
        elongationPct: `${r.elongation_at_break}%`,
        hardnessHV: `${r.hardness_vickers_HV} HV`,
        fractureToughness: `${r.fracture_toughness_KIC_MPa_m_0_5} MPa·m⁰·⁵`,
        fatigueStrengthMPa: `${r.fatigue_strength_1e7_cycles_MPa} MPa`,
        charpyImpactEnergyJ: `${r.charpy_impact_energy_J} J`,
        poissonsRatio: `${r.poissons_ratio}`,
        dampingLossFactor: `${r.damping_loss_factor}`,
        waveSpeedMs: `${r.longitudinal_wave_speed_m_s} m/s`,

        // Thermal Tests
        liquidusC: `${r.liquidus_temperature_C} °C`,
        betaTransusC: `${r.beta_transus_temperature_C} °C`,
        maxServiceTempC: `${r.max_service_temperature_C} °C`,
        thermalConductivity: `${r.thermal_conductivity_W_m_K} W/m·K`,
        thermalExpansionCTE: `${r.thermal_expansion_coeff_1e_6_K} × 10⁻⁶/K`,
        specificHeat: `${r.specific_heat_J_kg_K} J/kg·K`,
        emissivity: `${r.hemispherical_emissivity}`,

        // AM Quality Telemetry Tests
        densityGcm3: `${r.density_g_cm3} g/cm³`,
        relativeDensityPct: `${r.relative_density}%`,
        porosityPct: `${r.porosity}%`,
        surfaceRoughnessRa: `${r.surface_roughness_Ra_um} µm`,
        residualStressMax: `${r.residual_stress_max_MPa} MPa`,
        buildRate: `${r.build_rate_cm3_h} cm³/h`,
        anisotropy: `${r.build_direction_anisotropy}%`,
        minFeatureSize: `${r.minimum_feature_size_mm} mm`,
        accuracy: `± ${r.dimensional_accuracy} mm`,

        // Chemical & Optical Tests
        oxygenContentWt: `${r.oxygen_content_wt} wt. %`,
        corrosionRating: `${r.corrosion_resistance_rating_1_5_5_best} / 5.0`,
        biocompatibilityRating: `${r.biocompatibility_rating_1_5_5_best} / 5.0`,
        electricalResistivity: `${parseFloat(r.electrical_resistivity_ohm_m).toExponential(2)} Ω·m`,
        magneticSusceptibility: `${r.volume_magnetic_susceptibility_1e_6_SI} × 10⁻⁶ SI`,
        laserAbsorptivity: `${r.laser_absorptivity_1070nm}`,
        visibleReflectance: `${r.visible_reflectance_polished}%`
      }
    };
  });

  catalog.push({
    id: meta.id,
    alloyId: aid,
    name: meta.name,
    category: primaryCategory,
    availableProcesses: availableProcesses,
    tagLabel: meta.tagLabel,
    subtitle: meta.subtitle,
    formula: meta.formula,
    crystalStructure: meta.crystalStructure,
    standardCode: meta.standardCode,
    overview: meta.overview,
    applications: meta.applications,
    // Baseline Mechanical Tests
    mechanical: {
      tensileStrengthMPa: `${baseRow.ultimate_tensile_strength_MPa} MPa`,
      yieldStrengthMPa: `${baseRow.yield_strength_MPa} MPa`,
      elasticModulusGPa: `${baseRow.youngs_modulus_GPa} GPa`,
      elongationPct: `${baseRow.elongation_at_break}%`,
      hardnessHV: `${baseRow.hardness_vickers_HV} HV`,
      fractureToughness: `${baseRow.fracture_toughness_KIC_MPa_m_0_5} MPa·m⁰·⁵`,
      fatigueStrengthMPa: `${baseRow.fatigue_strength_1e7_cycles_MPa} MPa`,
      charpyImpactEnergyJ: `${baseRow.charpy_impact_energy_J} J`,
      poissonsRatio: `${baseRow.poissons_ratio}`,
      dampingLossFactor: `${baseRow.damping_loss_factor}`,
      waveSpeedMs: `${baseRow.longitudinal_wave_speed_m_s} m/s`
    },
    // Baseline Thermal Tests
    thermal: {
      liquidusC: `${baseRow.liquidus_temperature_C} °C`,
      betaTransusC: `${baseRow.beta_transus_temperature_C} °C`,
      maxServiceTempC: `${baseRow.max_service_temperature_C} °C`,
      thermalConductivity: `${baseRow.thermal_conductivity_W_m_K} W/m·K`,
      thermalExpansionCTE: `${baseRow.thermal_expansion_coeff_1e_6_K} × 10⁻⁶/K`,
      specificHeat: `${baseRow.specific_heat_J_kg_K} J/kg·K`,
      emissivity: `${baseRow.hemispherical_emissivity}`
    },
    // Baseline AM Quality Telemetry Tests
    amQuality: {
      densityGcm3: `${baseRow.density_g_cm3} g/cm³`,
      relativeDensityPct: `${baseRow.relative_density}%`,
      porosityPct: `${baseRow.porosity}%`,
      surfaceRoughnessRa: `${baseRow.surface_roughness_Ra_um} µm`,
      residualStressMax: `${baseRow.residual_stress_max_MPa} MPa`,
      buildRate: `${baseRow.build_rate_cm3_h} cm³/h`,
      anisotropy: `${baseRow.build_direction_anisotropy}%`,
      minFeatureSize: `${baseRow.minimum_feature_size_mm} mm`,
      accuracy: `± ${baseRow.dimensional_accuracy} mm`
    },
    // Baseline Chemical, Physical & Optical Tests
    chemicalAndPhysical: {
      oxygenContentWt: `${baseRow.oxygen_content_wt} wt. %`,
      corrosionRating: `${baseRow.corrosion_resistance_rating_1_5_5_best} / 5.0`,
      biocompatibilityRating: `${baseRow.biocompatibility_rating_1_5_5_best} / 5.0`,
      electricalResistivity: `${parseFloat(baseRow.electrical_resistivity_ohm_m).toExponential(2)} Ω·m`,
      magneticSusceptibility: `${baseRow.volume_magnetic_susceptibility_1e_6_SI} × 10⁻⁶ SI`,
      laserAbsorptivity: `${baseRow.laser_absorptivity_1070nm}`,
      visibleReflectance: `${baseRow.visible_reflectance_polished}%`
    },
    processRoutes: processRoutes
  });
});

console.log(`Generated ${catalog.length} material entries with ${catalog.reduce((a, c) => a + c.processRoutes.length, 0)} total process variants.`);

const fileContent = `export type ProcessCategory =
  | 'Binder Jetting'
  | 'Directed Energy Deposition'
  | 'Material Extrusion'
  | 'Material Jetting'
  | 'Powder Bed Fusion'
  | 'Sheet Lamination'
  | 'Vat Photopolymerization'
  | 'Wire arc additive manufacturing';

export type MaterialCategory = ProcessCategory | 'All Processes';

export interface ProcessStep {
  phaseCode: string;
  stage: string;
  temperature: string;
  pressure: string;
  duration: string;
  atmosphere: string;
  details: string;
}

export interface ProcessVariant {
  id: string;
  name: string;
  shortName: string;
  temperOrGrade: string;
  processCategory: ProcessCategory;
  subprocess: string;
  postProcessingCondition: string;
  summary: string;
  peakTempC: number;
  holdTimeMin: number;
  coolingRate: string;
  atmosphere: string;
  yieldChangePct: string;
  steps: ProcessStep[];
  propertyOverrides?: {
    tensileStrengthMPa?: string;
    yieldStrengthMPa?: string;
    elasticModulusGPa?: string;
    elongationPct?: string;
    hardnessHV?: string;
    fractureToughness?: string;
    fatigueStrengthMPa?: string;
    charpyImpactEnergyJ?: string;
    poissonsRatio?: string;
    dampingLossFactor?: string;
    waveSpeedMs?: string;

    liquidusC?: string;
    betaTransusC?: string;
    maxServiceTempC?: string;
    thermalConductivity?: string;
    thermalExpansionCTE?: string;
    specificHeat?: string;
    emissivity?: string;

    densityGcm3?: string;
    relativeDensityPct?: string;
    porosityPct?: string;
    surfaceRoughnessRa?: string;
    residualStressMax?: string;
    buildRate?: string;
    anisotropy?: string;
    minFeatureSize?: string;
    accuracy?: string;

    oxygenContentWt?: string;
    corrosionRating?: string;
    biocompatibilityRating?: string;
    electricalResistivity?: string;
    magneticSusceptibility?: string;
    laserAbsorptivity?: string;
    visibleReflectance?: string;
  };
}

export interface MaterialItem {
  id: string;
  alloyId: string;
  name: string;
  category: ProcessCategory;
  availableProcesses: ProcessCategory[];
  tagLabel: string;
  subtitle: string;
  formula: string;
  crystalStructure: string;
  standardCode: string;
  overview: string;
  applications: string[];
  mechanical: {
    tensileStrengthMPa: string;
    yieldStrengthMPa: string;
    elasticModulusGPa: string;
    elongationPct: string;
    hardnessHV: string;
    fractureToughness: string;
    fatigueStrengthMPa: string;
    charpyImpactEnergyJ: string;
    poissonsRatio: string;
    dampingLossFactor: string;
    waveSpeedMs: string;
  };
  thermal: {
    liquidusC: string;
    betaTransusC: string;
    maxServiceTempC: string;
    thermalConductivity: string;
    thermalExpansionCTE: string;
    specificHeat: string;
    emissivity: string;
  };
  amQuality: {
    densityGcm3: string;
    relativeDensityPct: string;
    porosityPct: string;
    surfaceRoughnessRa: string;
    residualStressMax: string;
    buildRate: string;
    anisotropy: string;
    minFeatureSize: string;
    accuracy: string;
  };
  chemicalAndPhysical: {
    oxygenContentWt: string;
    corrosionRating: string;
    biocompatibilityRating: string;
    electricalResistivity: string;
    magneticSusceptibility: string;
    laserAbsorptivity: string;
    visibleReflectance: string;
  };
  processRoutes: ProcessVariant[];
}

export const AUTHORIZED_PROCESSES: ProcessCategory[] = [
  'Binder Jetting',
  'Directed Energy Deposition',
  'Material Extrusion',
  'Material Jetting',
  'Powder Bed Fusion',
  'Sheet Lamination',
  'Vat Photopolymerization',
  'Wire arc additive manufacturing'
];

export const PROCESS_CATEGORIES: ProcessCategory[] = AUTHORIZED_PROCESSES;
export const MATERIAL_CATEGORIES: ProcessCategory[] = AUTHORIZED_PROCESSES;

export interface QuickSuggestion {
  id: string;
  label: string;
}

export const QUICK_SUGGESTIONS: QuickSuggestion[] = [
  { id: 'ti-6al-4v', label: 'Ti-6Al-4V (Grade 5)' },
  { id: 'ti-6al-4v-eli', label: 'Ti-6Al-4V ELI (Grade 23)' },
  { id: 'ti-grade-2', label: 'Ti Grade 2 (CP)' },
  { id: 'ti-6242', label: 'Ti-6242 (High-Temp)' },
  { id: 'ti-5553', label: 'Ti-5553 (Near-Beta)' },
  { id: 'ti-48al-2cr-2nb', label: 'Ti-48Al-2Cr-2Nb (gamma TiAl)' }
];

export const QUICK_SUGGESTION_IDS = QUICK_SUGGESTIONS;

export const TOTAL_MATERIALS_COUNT = ${catalog.length};
export const TOTAL_PROCESS_VARIANTS_COUNT = ${catalog.reduce((a, c) => a + c.processRoutes.length, 0)};

export const MATERIALS_CATALOG: MaterialItem[] = await Promise.all([
${Array.from({ length: Math.ceil(catalog.length / 5) }, (_, index) => `  import('./materialsCatalog/catalog-${index}').then(({ default: items }) => items)`).join(',\n')}
]).then((chunks) => chunks.flat());
`;

fs.writeFileSync(outPath, fileContent, 'utf8');
fs.mkdirSync(catalogDir, { recursive: true });

for (const filename of fs.readdirSync(catalogDir)) {
  if (/^catalog-\d+\.ts$/.test(filename)) {
    fs.unlinkSync(path.join(catalogDir, filename));
  }
}

for (let index = 0; index < catalog.length; index += 5) {
  const chunk = catalog.slice(index, index + 5);
  const chunkPath = path.join(catalogDir, `catalog-${Math.floor(index / 5)}.ts`);
  const chunkContent = `import type { MaterialItem } from '../materialsData';\n\nexport default ${JSON.stringify(chunk, null, 2)} satisfies MaterialItem[];\n`;
  fs.writeFileSync(chunkPath, chunkContent, 'utf8');
}

console.log('Successfully wrote generated materialsData.ts to:', outPath);
