#!/usr/bin/env node
/**
 * Step 3: Update-Only Experimental Literature Ingestion Pipeline
 *
 * Strictly matches existing paper_id rows in data/ti64_papers.csv (never appends new papers).
 * Updates non-blank fields in-place across:
 *   - data/ti64_process_parameters.csv (adds sinter_temp_c, sinter_hold_min, arc_current_a, arc_voltage_v columns if missing)
 *   - data/ti64_mechanical_properties.csv
 *
 * Enforces physical sanity bounds:
 *   - sinter_temp_c in [1000, 1550] C
 *   - relative_density_pct in [70, 100] %
 *   - ys_mpa >= 450 MPa (bulk coupons)
 *   - WAAM HI = P_W / v_mm_s in [50, 1500] J/mm
 *
 * Automatically chains:
 *   1. scripts/clean_benchmark_corpus.mjs
 *   2. scripts/train_ti64_models.mjs
 *   3. scripts/verify_per_paper_accuracy.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DATA_DIR = path.join(ROOT, 'data');
const INGEST_CSV = path.join(DATA_DIR, 'waam_bj_density_ingestion.csv');
const PAPERS_CSV = path.join(DATA_DIR, 'ti64_papers.csv');
const PARAMS_CSV = path.join(DATA_DIR, 'ti64_process_parameters.csv');
const MECH_CSV = path.join(DATA_DIR, 'ti64_mechanical_properties.csv');
const CORPUS_JSON = path.join(DATA_DIR, 'cleaned_benchmark_corpus.json');

function parseCsvWithHeaders(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
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
      row.push(field);
      field = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const objs = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (cols.length === 1 && cols[0].trim() === '') continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (cols[c] ?? '').trim();
    }
    objs.push(obj);
  }
  return { headers, rows: objs };
}

function csvCell(val) {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => csvCell(r[h] ?? '')).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

function numOrNull(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number.parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function normCondTag(c) {
  const s = String(c || '').trim().toLowerCase();
  if (!s) return '';
  if (/hip/.test(s)) return 'hip';
  if (/stress|reliev/.test(s)) return 'stress-relieved';
  if (/anneal/.test(s)) return 'annealed';
  if (/sta|solution|aged|bi-?modal/.test(s)) return 'solution-aged';
  if (/sinter/.test(s)) return 'as-sintered';
  if (/as[\s_-]*built|none/.test(s)) return 'as-built';
  return s;
}

function hasAnyPopulatedMetric(row) {
  const fields = [
    'condition', 'P_W', 'v_mm_s', 'h_um', 't_um', 'T0_C',
    'sinter_temp_c', 'sinter_hold_min', 'oxygen_wt_pct',
    'hardness_hv', 'ys_mpa', 'uts_mpa', 'elongation_pct', 'relative_density_pct'
  ];
  return fields.some((k) => !isBlank(row[k]));
}

function validateSanity(row) {
  const errors = [];
  const sinterT = numOrNull(row.sinter_temp_c);
  if (sinterT !== null && (sinterT < 1000 || sinterT > 1550)) {
    errors.push(`sinter_temp_c=${sinterT} outside [1000, 1550] C`);
  }
  const den = numOrNull(row.relative_density_pct);
  if (den !== null && (den < 70 || den > 100)) {
    errors.push(`relative_density_pct=${den} outside [70, 100] %`);
  }
  const ys = numOrNull(row.ys_mpa);
  if (ys !== null && (ys < 450 || ys > 1500)) {
    errors.push(`ys_mpa=${ys} outside bulk coupon bounds [450, 1500] MPa`);
  }
  const pW = numOrNull(row.P_W);
  const vMms = numOrNull(row.v_mm_s);
  if (String(row.process || '').toLowerCase() === 'waam' && pW !== null && vMms !== null && vMms > 0) {
    const hi = pW / vMms;
    if (hi < 50 || hi > 1500) {
      errors.push(`WAAM linear HI=${hi.toFixed(1)} J/mm outside [50, 1500]`);
    }
  }
  return errors;
}

function setIfBlank(targetObj, key, rawVal) {
  if (isBlank(rawVal)) return false;
  if (isBlank(targetObj[key])) {
    targetObj[key] = String(rawVal).trim();
    return true;
  }
  return false;
}

function nextNumericId(rows) {
  let mx = 0;
  for (const r of rows) {
    const n = Number.parseInt(r.id, 10);
    if (Number.isFinite(n) && n > mx) mx = n;
  }
  return String(mx + 1);
}

function main() {
  if (!fs.existsSync(INGEST_CSV)) {
    console.error(`Missing ingestion CSV: ${INGEST_CSV}`);
    process.exit(1);
  }

  const papersParsed = parseCsvWithHeaders(fs.readFileSync(PAPERS_CSV, 'utf8'));
  const paramsParsed = parseCsvWithHeaders(fs.readFileSync(PARAMS_CSV, 'utf8'));
  const mechParsed = parseCsvWithHeaders(fs.readFileSync(MECH_CSV, 'utf8'));
  const ingestParsed = parseCsvWithHeaders(fs.readFileSync(INGEST_CSV, 'utf8'));

  const initialPaperCount = papersParsed.rows.length;
  const catalogPids = new Set(papersParsed.rows.map((r) => String(r.paper_number || '').trim()));

  // Upgrade process parameters header safely with process-native columns
  for (const col of ['sinter_temp_c', 'sinter_hold_min', 'arc_current_a', 'arc_voltage_v']) {
    if (!paramsParsed.headers.includes(col)) {
      paramsParsed.headers.push(col);
      for (const r of paramsParsed.rows) r[col] = r[col] ?? '';
    }
  }

  let updatedCells = 0;
  let updatedExistingVariants = 0;
  let addedVariantRows = 0;
  let skippedUnknown = 0;
  let skippedSanity = 0;

  for (const row of ingestParsed.rows) {
    const pid = String(row.paper_id || '').replace(/^P-0*/i, '').trim();
    if (!pid || !catalogPids.has(pid)) {
      console.warn(`[SKIP UNKNOWN ID] paper_id="${row.paper_id}" is not in data/ti64_papers.csv (catalog append prohibited).`);
      skippedUnknown++;
      continue;
    }
    if (!hasAnyPopulatedMetric(row)) continue;

    const sanityErrs = validateSanity(row);
    if (sanityErrs.length > 0) {
      console.warn(`[SKIP SANITY] P-${pid} (${row.authors}): ${sanityErrs.join('; ')}`);
      skippedSanity++;
      continue;
    }

    const pRows = paramsParsed.rows.filter((r) => String(r.paper_number || '').trim() === pid);
    const mRows = mechParsed.rows.filter((r) => String(r.paper_number || '').trim() === pid);

    const rowCondTag = normCondTag(row.condition);
    const rowSinterT = numOrNull(row.sinter_temp_c);

    // Try matching an existing variant row (by index alignment) matching condition + sinter_temp_c or blank placeholder slot
    let matchedIdx = -1;
    for (let i = 0; i < Math.max(pRows.length, mRows.length); i++) {
      const m = mRows[i] || mRows[0];
      const p = pRows[i] || pRows[0];
      const mCondTag = normCondTag(m?.condition);
      const pSinterT = numOrNull(p?.sinter_temp_c);

      const mIsBlankSlot = m && isBlank(m.condition) && isBlank(m.yield_strength_mpa) && isBlank(m.ultimate_tensile_strength_mpa) && isBlank(m.vickers_hardness_hv) && isBlank(m.relative_density_pct);
      const pIsBlankSinter = p && isBlank(p.sinter_temp_c);

      if (mIsBlankSlot && (!pSinterT || pIsBlankSinter)) {
        matchedIdx = i;
        break;
      }
      const condMatches = !rowCondTag || !mCondTag || rowCondTag === mCondTag;
      const sinterMatches = rowSinterT === null || pSinterT === null || Math.abs(rowSinterT - pSinterT) < 1;
      if (condMatches && sinterMatches) {
        matchedIdx = i;
        break;
      }
    }

    let targetParam;
    let targetMech;
    if (matchedIdx >= 0 && matchedIdx < pRows.length && matchedIdx < mRows.length) {
      targetParam = pRows[matchedIdx];
      targetMech = mRows[matchedIdx];
      updatedExistingVariants++;
    } else {
      // Create a companion condition-variant row linked to the existing paper_number (never adding to ti64_papers.csv)
      targetParam = Object.fromEntries(paramsParsed.headers.map((h) => [h, '']));
      targetParam.id = nextNumericId(paramsParsed.rows);
      targetParam.paper_number = pid;
      if (pRows[0]) {
        for (const carry of ['laser_power_w', 'scan_speed_mms', 'hatch_spacing_um', 'layer_thickness_um', 'beam_spot_diameter_um', 'scan_strategy', 'oxygen_wt_pct']) {
          if (!isBlank(pRows[0][carry])) targetParam[carry] = pRows[0][carry];
        }
      }
      paramsParsed.rows.push(targetParam);

      targetMech = Object.fromEntries(mechParsed.headers.map((h) => [h, '']));
      targetMech.id = nextNumericId(mechParsed.rows);
      targetMech.paper_number = pid;
      targetMech.test_direction = mRows[0]?.test_direction || 'horizontal (XY)';
      targetMech.build_orientation_deg = mRows[0]?.build_orientation_deg || '0';
      mechParsed.rows.push(targetMech);
      addedVariantRows++;
    }

    const fieldsChanged = [
      setIfBlank(targetParam, 'laser_power_w', row.P_W),
      setIfBlank(targetParam, 'scan_speed_mms', row.v_mm_s),
      setIfBlank(targetParam, 'hatch_spacing_um', row.h_um),
      setIfBlank(targetParam, 'layer_thickness_um', row.t_um),
      setIfBlank(targetParam, 'sinter_temp_c', row.sinter_temp_c),
      setIfBlank(targetParam, 'sinter_hold_min', row.sinter_hold_min),
      setIfBlank(targetParam, 'oxygen_wt_pct', row.oxygen_wt_pct),
      setIfBlank(targetMech, 'condition', row.condition),
      setIfBlank(targetMech, 'oxygen_wt_pct', row.oxygen_wt_pct),
      setIfBlank(targetMech, 'vickers_hardness_hv', row.hardness_hv),
      setIfBlank(targetMech, 'yield_strength_mpa', row.ys_mpa),
      setIfBlank(targetMech, 'ultimate_tensile_strength_mpa', row.uts_mpa),
      setIfBlank(targetMech, 'elongation_pct', row.elongation_pct),
      setIfBlank(targetMech, 'relative_density_pct', row.relative_density_pct)
    ];

    if (!isBlank(row.source_table_note) && String(targetMech.notes || '').includes('Pending quantitative')) {
      targetMech.notes = row.source_table_note;
    } else if (!isBlank(row.source_table_note) && isBlank(targetMech.notes)) {
      targetMech.notes = row.source_table_note;
    }

    updatedCells += fieldsChanged.filter(Boolean).length;
  }

  writeCsv(PARAMS_CSV, paramsParsed.headers, paramsParsed.rows);
  writeCsv(MECH_CSV, mechParsed.headers, mechParsed.rows);

  const afterPaperCount = parseCsvWithHeaders(fs.readFileSync(PAPERS_CSV, 'utf8')).rows.length;
  if (afterPaperCount !== initialPaperCount) {
    throw new Error(`Catalog invariant violated: ti64_papers.csv count changed ${initialPaperCount} -> ${afterPaperCount}`);
  }

  console.log(`\n=== Update-Only Ingestion Summary ===`);
  console.log(`Catalog paper count preserved: ${afterPaperCount} / ${initialPaperCount}`);
  console.log(`Updated cells (blank-only fill): ${updatedCells} across ${updatedExistingVariants} existing rows + ${addedVariantRows} variant rows`);
  console.log(`Skipped unknown IDs: ${skippedUnknown} | Skipped sanity violations: ${skippedSanity}`);

  // Chain canonical cleaning, training, and tiered verification gate
  for (const scriptName of ['clean_benchmark_corpus.mjs', 'train_ti64_models.mjs', 'verify_per_paper_accuracy.mjs']) {
    console.log(`\n--- Running scripts/${scriptName} ---`);
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', scriptName)], { cwd: ROOT, stdio: 'inherit' });
  }

  // Status summary: current N vs target N >= 5
  const corpus = JSON.parse(fs.readFileSync(CORPUS_JSON, 'utf8'));
  const eligible = corpus.records.filter((r) => r.benchmark_eligible === true);
  const countProp = (proc, prop) => eligible.filter((r) => r.process === proc && r[prop] !== null && r[prop] !== undefined).length;
  const countProc = (proc) => eligible.filter((r) => r.process === proc).length;

  console.log('\n=== Milestone Status: Current Eligible N vs. Target N >= 5 (LOPO-CV Unlock) ===');
  const rowsReport = [
    ['WAAM (Overall Eligible)', countProc('waam'), 5],
    ['WAAM — Hardness / YS / UTS / Elong', `${countProp('waam', 'hardness_hv')}/${countProp('waam', 'ys_mpa')}/${countProp('waam', 'uts_mpa')}/${countProp('waam', 'elongation_pct')}`, 5],
    ['Binder Jetting (Overall Eligible)', countProc('binder-jetting'), 5],
    ['Binder Jetting — Relative Density', countProp('binder-jetting', 'relative_density_pct'), 5],
    ['Binder Jetting — YS / UTS / Elong', `${countProp('binder-jetting', 'ys_mpa')}/${countProp('binder-jetting', 'uts_mpa')}/${countProp('binder-jetting', 'elongation_pct')}`, 5],
    ['LPBF — Relative Density', countProp('lpbf', 'relative_density_pct'), 5],
    ['L-DED — Relative Density', countProp('ded-laser', 'relative_density_pct'), 5]
  ];
  for (const [label, curN, tgt] of rowsReport) {
    const reached = typeof curN === 'number' ? curN >= tgt : false;
    console.log(`  ${label.padEnd(36)} | Current N = ${String(curN).padEnd(9)} | Target >= ${tgt} | ${reached ? 'READY (LOPO-CV)' : 'Physics-Prior Mode'}`);
  }
}

main();
