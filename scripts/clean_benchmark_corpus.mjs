#!/usr/bin/env node
/**
 * Step 1: Deterministic Cleaning & Scoping of Verified Bulk Ti-6Al-4V Corpus
 *
 * Reads:
 *   - data/ti64_papers.csv
 *   - data/ti64_process_parameters.csv
 *   - data/ti64_thermal_physics.csv
 *   - data/ti64_microstructure.csv
 *   - data/ti64_mechanical_properties.csv
 *   - process_windows_dashboard.html (PAPERS_DATABASE)
 *
 * Outputs:
 *   - data/cleaned_benchmark_corpus.json (canonical cleaned & tagged corpus)
 *   - Updates PAPERS_DATABASE metadata (benchmark_eligible, specimen_type, process, postProc, t0, htTempC)
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const DASHBOARD_PATH = path.join(ROOT, 'process_windows_dashboard.html');
const OUT_CORPUS_PATH = path.join(DATA_DIR, 'cleaned_benchmark_corpus.json');

const CATALOG_DUP_IDS = new Set([109, 115, 118, 127, 131, 132, 135, 145, 151, 153]);
const NON_TI64_IDS = new Set([159, 161, 171, 184, 200]);

export function parseCsvRfc4180(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r') {
      if (i + 1 < text.length && text[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((vals) => {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = vals[j] !== undefined ? vals[j] : '';
    }
    return obj;
  });
}

function posNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number.parseFloat(String(val).replace('%', '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Shared Step 2 robust condition & temperature parser.
 */
export function normalizeCondition(rawCond, rawTreatment = '') {
  const combined = `${rawCond || ''} ${rawTreatment || ''}`.trim();
  const s = combined.toLowerCase();
  const tempMatch = s.match(/(\d{3,4})\s*°?\s*c/);
  const extractedTemp = tempMatch ? Number.parseFloat(tempMatch[1]) : null;

  if (/preheat|bed\s*temp/.test(s)) {
    return {
      condition: 'As-Built',
      T0: extractedTemp && extractedTemp >= 100 && extractedTemp <= 600 ? extractedTemp : 400,
      htTempC: 25
    };
  }
  if (/bi-?modal|\bsta\b|solution|aged/.test(s)) {
    return { condition: 'Solution-Aged', T0: null, htTempC: extractedTemp || 705 };
  }
  if (/hip/.test(s)) {
    return { condition: 'HIP', T0: null, htTempC: extractedTemp || 920 };
  }
  if (/anneal/.test(s)) {
    return { condition: 'Annealed', T0: null, htTempC: extractedTemp || 730 };
  }
  if (/stress|reliev/.test(s)) {
    return { condition: 'Stress-Relieved', T0: null, htTempC: extractedTemp || 650 };
  }
  if (/peen|lsp/.test(s)) {
    return { condition: 'LSP', T0: null, htTempC: 25 };
  }
  if (/laser\s*polish/.test(s)) {
    return { condition: 'As-Built', T0: null, htTempC: 25, surfaceTreatment: 'laser_polished' };
  }
  return { condition: 'As-Built', T0: null, htTempC: 25 };
}

export function normalizeProcess(rawProc, P = null, v = null) {
  const s = String(rawProc || '').toLowerCase();
  if (/binder\s*jetting|\bbjt\b/.test(s)) return 'binder-jetting';
  if (/waam|wire\s*\+?\s*arc|gtaw|plasma-arc/.test(s)) return 'waam';
  // Reclassify high-power (>800W) studies like Halder (3200W, 16.7 mm/s) out of LPBF into L-DED
  if (P !== null && P > 800 && !/waam/.test(s)) return 'ded-laser';
  if (/l-ded|laser\s*powder\s*ded|wire\s*ded|wire-laser\s*ded|lhw-ded|\bded\b|lmd|lens/.test(s) && !/review|ebm/.test(s)) {
    return 'ded-laser';
  }
  if (/lpbf|l-pbf|slm|pbf|dmls|am\s*\//.test(s)) return 'lpbf';
  if (v !== null && v > 0 && v < 40 && P !== null && P > 350) return 'ded-laser';
  return 'other';
}

function main() {
  const papers = parseCsvRfc4180(fs.readFileSync(path.join(DATA_DIR, 'ti64_papers.csv'), 'utf8'));
  const params = parseCsvRfc4180(fs.readFileSync(path.join(DATA_DIR, 'ti64_process_parameters.csv'), 'utf8'));
  const thermal = parseCsvRfc4180(fs.readFileSync(path.join(DATA_DIR, 'ti64_thermal_physics.csv'), 'utf8'));
  const micro = parseCsvRfc4180(fs.readFileSync(path.join(DATA_DIR, 'ti64_microstructure.csv'), 'utf8'));
  const mech = parseCsvRfc4180(fs.readFileSync(path.join(DATA_DIR, 'ti64_mechanical_properties.csv'), 'utf8'));

  const groupByPid = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const k = String(r.paper_number || '').trim();
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  };
  const paramListMap = groupByPid(params);
  const mechListMap = groupByPid(mech);
  const thermMap = new Map(thermal.map((r) => [String(r.paper_number || '').trim(), r]));
  const microMap = new Map(micro.map((r) => [String(r.paper_number || '').trim(), r]));

  // Detect guessed/placeholder repeated parameter recipes and repeated tensile signatures
  const recipeCounts = new Map();
  for (const pr of params) {
    if (!pr.laser_power_w || !pr.scan_speed_mms) continue;
    const key = `${pr.laser_power_w}|${pr.scan_speed_mms}|${pr.hatch_spacing_um}|${pr.layer_thickness_um}`;
    recipeCounts.set(key, (recipeCounts.get(key) || 0) + 1);
  }
  const mechSigCounts = new Map();
  for (const mc of mech) {
    if (!mc.yield_strength_mpa || !mc.ultimate_tensile_strength_mpa) continue;
    const key = `${mc.yield_strength_mpa}|${mc.ultimate_tensile_strength_mpa}|${mc.elongation_pct}|${mc.vickers_hardness_hv}`;
    mechSigCounts.set(key, (mechSigCounts.get(key) || 0) + 1);
  }

  const seenAuthorYearTitle = new Set();
  const records = [];
  const summary = {
    total_csv_papers: papers.length,
    total_variant_rows: 0,
    benchmark_eligible: 0,
    excluded_by_reason: {}
  };

  const bumpExcl = (reason) => {
    summary.excluded_by_reason[reason] = (summary.excluded_by_reason[reason] || 0) + 1;
  };

  for (const p of papers) {
    const pid = String(p.paper_number || '').trim();
    const pidNum = Number.parseInt(pid, 10);
    const prList = paramListMap.get(pid) || [{}];
    const mcList = mechListMap.get(pid) || [{}];
    const th = thermMap.get(pid) || {};
    const mi = microMap.get(pid) || {};

    const dedupKey = `${String(p.authors).toLowerCase().trim()}|${p.year}|${String(p.title).toLowerCase().slice(0, 40)}`;
    const isDupEntry = CATALOG_DUP_IDS.has(pidNum) || seenAuthorYearTitle.has(dedupKey);
    seenAuthorYearTitle.add(dedupKey);

    const nVariants = Math.max(prList.length, mcList.length);
    for (let vi = 0; vi < nVariants; vi++) {
      summary.total_variant_rows++;
      const mc = mcList[Math.min(vi, mcList.length - 1)] || {};
      // Match parameter row by index or fallback to first populated row
      const pr = prList[vi] || prList[0] || {};

      const arcI = posNum(pr.arc_current_a);
      const arcV = posNum(pr.arc_voltage_v);
      const P = posNum(pr.laser_power_w) || (arcI && arcV ? Number((arcI * arcV).toFixed(1)) : null);
      const v = posNum(pr.scan_speed_mms);
      const h = posNum(pr.hatch_spacing_um);
      const t = posNum(pr.layer_thickness_um);
      const db = posNum(pr.beam_spot_diameter_um);
      const sinterTempC = posNum(pr.sinter_temp_c);
      const sinterHoldMin = posNum(pr.sinter_hold_min);

      const hv = posNum(mc.vickers_hardness_hv);
      const ys = posNum(mc.yield_strength_mpa);
      const uts = posNum(mc.ultimate_tensile_strength_mpa);
      const el = posNum(mc.elongation_pct);
      const den = posNum(mc.relative_density_pct);

      const normProc = normalizeProcess(p.am_process, P, v);
      const condInfo = normalizeCondition(mc.condition || mi.condition || '', '');
      const isEli = /\beli\b|grade\s*23|f3001/i.test(`${p.material} ${p.title}`);
      const buildOriDeg = mc.build_orientation_deg !== '' && mc.build_orientation_deg !== undefined
        ? Number.parseFloat(mc.build_orientation_deg)
        : 0;
      const oxygenWtPct = posNum(pr.oxygen_wt_pct) || posNum(mc.oxygen_wt_pct) || posNum(mi.oxygen_wt_pct) || (isEli ? 0.11 : 0.16);

      const recipeKey = (pr.laser_power_w && pr.scan_speed_mms)
        ? `${pr.laser_power_w}|${pr.scan_speed_mms}|${pr.hatch_spacing_um}|${pr.layer_thickness_um}`
        : '';
      const mechSigKey = (mc.yield_strength_mpa && mc.ultimate_tensile_strength_mpa)
        ? `${mc.yield_strength_mpa}|${mc.ultimate_tensile_strength_mpa}|${mc.elongation_pct}|${mc.vickers_hardness_hv}`
        : '';

      const isExplicitLatticeAuthor = (pidNum === 9 && /cutolo/i.test(p.authors)) ||
        (pidNum === 20 && /jamshidi/i.test(p.authors)) ||
        (pidNum === 28 && /lee/i.test(p.authors));
      const isLattice = isExplicitLatticeAuthor ||
        (ys !== null && ys < 450) ||
        ((ys === null || ys < 550) && /lattice|porous|scaffold|bone growth|osseointegration|tpms/i.test(`${p.title} ${mc.notes || ''}`));
      const isModifiedAlloy = NON_TI64_IDS.has(pidNum) ||
        /iron|copper|\bcu\b|\bfe\b|hydroxyapatite|sio2|nanocomposite|in situ alloying/i.test(`${p.title} ${p.am_process}`) ||
        (pidNum === 46 && /simonelli/i.test(p.authors));

      const isPlaceholderRecipe = (recipeKey === '225.0|1050.0|95.0|30.0' || recipeKey === '2000.0|12.0|2200.0|1000.0') ||
        ((mechSigCounts.get(mechSigKey) || 0) >= 3 && (recipeCounts.get(recipeKey) || 0) >= 3);

      // Process-native parameter eligibility (Step 1)
      let hasParams = false;
      if (normProc === 'waam') {
        hasParams = Boolean(P && v); // h_um and t_um optional for WAAM
      } else if (normProc === 'binder-jetting') {
        hasParams = Boolean(sinterTempC && sinterTempC > 0); // P and v optional for solid-state Binder Jetting
      } else {
        hasParams = Boolean(P && v && h && t);
      }

      const hasMech = [hv, ys, uts, el, den].some((x) => x !== null);

      let specimenType = 'bulk_coupon';
      let benchmarkEligible = true;
      let exclusionReason = null;

      if (!['lpbf', 'ded-laser', 'waam', 'binder-jetting'].includes(normProc)) {
        specimenType = 'non_target_process';
        benchmarkEligible = false;
        exclusionReason = `Process ${p.am_process} outside 4 target AM cohorts`;
      } else if (isModifiedAlloy) {
        specimenType = 'modified_alloy';
        benchmarkEligible = false;
        exclusionReason = 'Modified alloy / composite (outside standard Ti-6Al-4V Gr5/23 ELI)';
      } else if (isLattice) {
        specimenType = 'lattice';
        benchmarkEligible = false;
        exclusionReason = 'Porous / lattice scaffold geometry (non-bulk coupon)';
      } else if (isDupEntry) {
        specimenType = 'duplicate';
        benchmarkEligible = false;
        exclusionReason = 'Duplicate catalog entry';
      } else if (!hasParams || !hasMech) {
        specimenType = 'pending_extraction';
        benchmarkEligible = false;
        if (!hasParams) {
          exclusionReason = normProc === 'binder-jetting'
            ? 'Pending sintering extraction (missing sinter_temp_c)'
            : (normProc === 'waam' ? 'Pending WAAM parameter extraction (missing P/v)' : 'Pending parameter extraction (missing P/v/h/t)');
        } else {
          exclusionReason = 'No mechanical/density targets reported';
        }
      } else if (isPlaceholderRecipe) {
        specimenType = 'placeholder_recipe';
        benchmarkEligible = false;
        exclusionReason = 'Repeated placeholder process/tensile recipe in raw CSV';
      }

      if (benchmarkEligible) summary.benchmark_eligible++;
      else bumpExcl(specimenType);

      records.push({
        paperNumber: pid,
        variantId: nVariants > 1 ? `${pid}#${vi + 1}` : pid,
        authors: p.authors,
        year: p.year,
        title: p.title,
        rawProcess: p.am_process,
        process: normProc,
        material: p.material,
        isEli,
        condition: condInfo.condition,
        rawCondition: mc.condition || mi.condition || (normProc === 'binder-jetting' ? 'As-Sintered' : 'As-Built'),
        T0: condInfo.T0 ?? 200,
        htTempC: condInfo.htTempC,
        surfaceTreatment: condInfo.surfaceTreatment || null,
        P, v, h, t, db,
        sinterTempC,
        sinterHoldMin,
        hi: (normProc === 'waam' || normProc === 'ded-laser') && P && v ? Number((P / v).toFixed(2)) : null,
        coolingRateKs: posNum(th.cooling_rate_k_s),
        alphaLathWidthUm: posNum(mi.alpha_lath_width_um) || posNum(mi.alpha_lath_thickness_um),
        oxygenWtPct,
        buildOrientationDeg: Number.isFinite(buildOriDeg) ? buildOriDeg : 0,
        testDirection: mc.test_direction || 'horizontal (XY)',
        hardness_hv: hv,
        ys_mpa: ys,
        uts_mpa: uts,
        elongation_pct: el,
        relative_density_pct: den,
        specimen_type: specimenType,
        benchmark_eligible: benchmarkEligible,
        exclusion_reason: exclusionReason
      });
    }
  }

  fs.writeFileSync(
    OUT_CORPUS_PATH,
    JSON.stringify({ generated_at: new Date().toISOString(), summary, records }, null, 2),
    'utf8'
  );

  // Also sync PAPERS_DATABASE inside process_windows_dashboard.html cleanly
  let html = fs.readFileSync(DASHBOARD_PATH, 'utf8');
  const dbMatch = html.match(/const PAPERS_DATABASE = (\[[\s\S]*?\n\]);/);
  if (!dbMatch) throw new Error('PAPERS_DATABASE not found in process_windows_dashboard.html');
  const db = eval(dbMatch[1]);

  const stripAccents = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const firstTok = (s) => stripAccents(s).trim().split(/[\s,(]+/)[0].toLowerCase().replace(/\./g, '');
  const authorMatches = (a, b) => {
    const tA = firstTok(a);
    const tB = firstTok(b);
    if (tA && tB && tA === tB) return true;
    const bLow = stripAccents(b).toLowerCase();
    return Boolean(tA && tA.length >= 3 && bLow.includes(tA));
  };
  const recByNum = new Map(records.map((r) => [r.paperNumber, r]));

  const updatedDb = db.map((entry) => {
    const copy = Object.assign({}, entry);
    const numStr = entry.id.replace(/^P-0*/, '');
    const yr = (entry.author.match(/\b(19|20)\d{2}\b/) || [])[0];

    let matchedRec = null;
    const directList = records.filter((r) => r.paperNumber === numStr && r.year === yr && authorMatches(r.authors, entry.author));
    if (directList.length > 0) {
      matchedRec = directList.find((r) => r.benchmark_eligible) || directList[0];
    } else {
      const cands = records.filter((r) => r.year === yr && authorMatches(r.authors, entry.author));
      if (cands.length === 1) matchedRec = cands[0];
      else if (cands.length > 1) {
        matchedRec = cands.find((c) => c.benchmark_eligible && c.ys_mpa && copy.ys && Math.abs(c.ys_mpa - copy.ys) < 5)
          || cands.find((c) => c.benchmark_eligible)
          || cands.find((c) => c.ys_mpa && copy.ys && Math.abs(c.ys_mpa - copy.ys) < 5)
          || cands[0];
      }
    }

    // Reclassify P-08 Halder (3200W, 16.7 mm/s) or any P>800 LPBF to L-DED
    const eP = posNum(copy.p);
    if (eP && eP > 800 && /lpbf/i.test(copy.process || '')) {
      copy.process = 'L-DED';
    }

    if (matchedRec) {
      copy.benchmark_eligible = matchedRec.benchmark_eligible;
      copy.specimen_type = matchedRec.specimen_type;
      if (matchedRec.exclusion_reason) copy.exclusion_reason = matchedRec.exclusion_reason;
      else delete copy.exclusion_reason;

      const procDisplay = { lpbf: 'LPBF', 'ded-laser': 'L-DED', waam: 'WAAM', 'binder-jetting': 'Binder Jetting' };
      if (procDisplay[matchedRec.process]) {
        copy.process = procDisplay[matchedRec.process];
      }
      if (matchedRec.benchmark_eligible) {
        if (matchedRec.P !== null) copy.p = matchedRec.P;
        if (matchedRec.v !== null) copy.v = matchedRec.v;
        if (matchedRec.h !== null) copy.h = matchedRec.h;
        if (matchedRec.t !== null) copy.t = matchedRec.t;
        if (matchedRec.sinterTempC) copy.sinterTempC = matchedRec.sinterTempC;
        if (matchedRec.sinterHoldMin) copy.sinterHoldMin = matchedRec.sinterHoldMin;
        if (matchedRec.db) copy.db = matchedRec.db;
        if (matchedRec.hardness_hv !== null) copy.hv = matchedRec.hardness_hv;
        if (matchedRec.ys_mpa !== null) copy.ys = matchedRec.ys_mpa;
        if (matchedRec.uts_mpa !== null) copy.uts = matchedRec.uts_mpa;
        if (matchedRec.elongation_pct !== null) copy.el = matchedRec.elongation_pct;
        if (matchedRec.relative_density_pct !== null) copy.density = `${matchedRec.relative_density_pct.toFixed(2)}%`;
        copy.postProc = matchedRec.condition === 'As-Built' ? 'None' : matchedRec.condition;
        copy.treatment = matchedRec.rawCondition || matchedRec.condition;
        if (matchedRec.T0 && matchedRec.T0 !== 200) copy.t0 = matchedRec.T0;
        if (matchedRec.htTempC && matchedRec.htTempC !== 25) copy.htTempC = matchedRec.htTempC;
        if (matchedRec.oxygenWtPct) copy.o2WtPct = matchedRec.oxygenWtPct;
        if (Number.isFinite(matchedRec.buildOrientationDeg)) copy.buildOrientationDeg = matchedRec.buildOrientationDeg;
        if (matchedRec.surfaceTreatment) copy.surfaceTreatment = matchedRec.surfaceTreatment;
        copy.alloy = matchedRec.isEli ? 'ti64_eli' : 'ti64_gr5';
      }
    } else {
      // Unmatched entries in PAPERS_DATABASE without params default to non-eligible unless they have full params
      const hasP = Boolean(posNum(copy.p) && posNum(copy.v));
      copy.benchmark_eligible = hasP;
      copy.specimen_type = hasP ? 'bulk_coupon' : 'pending_extraction';
    }

    // Explicitly mark duplicate P-76 -> Simonelli (2014) duplicating P-61
    if (copy.id === 'P-76') {
      copy.benchmark_eligible = false;
      copy.specimen_type = 'duplicate';
      copy.exclusion_reason = 'Duplicate of P-61 Simonelli et al. (2014)';
    }

    return copy;
  });

  const serializedDb = 'const PAPERS_DATABASE = [\n' + updatedDb.map((o) => '  ' + JSON.stringify(o)).join(',\n') + '\n];';
  html = html.replace(dbMatch[0], serializedDb);
  fs.writeFileSync(DASHBOARD_PATH, html, 'utf8');

  const eligibleByProc = {};
  for (const r of records) {
    if (!r.benchmark_eligible) continue;
    eligibleByProc[r.process] = (eligibleByProc[r.process] || 0) + 1;
  }

  console.log('\n=== Cleaned Verified Bulk Ti-6Al-4V Corpus Summary ===');
  console.log(summary);
  console.log('Benchmark-Eligible Bulk Papers by Process:', eligibleByProc);
  console.log(`Saved canonical cleaned corpus to ${path.relative(ROOT, OUT_CORPUS_PATH)}`);
}

main();
