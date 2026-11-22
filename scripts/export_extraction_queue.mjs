#!/usr/bin/env node
/**
 * Read-only Extraction Queue Exporter for WAAM, Binder Jetting & Missing Relative Density
 *
 * Parses:
 *   - data/ti64_papers.csv
 *   - data/ti64_process_parameters.csv
 *   - data/ti64_mechanical_properties.csv
 *   - data/cleaned_benchmark_corpus.json
 *   - process_windows_dashboard.html (read-only PAPERS_DATABASE DOI lookup)
 *
 * Outputs:
 *   - Terminal summary tables for WAAM, Binder Jetting, and Missing Relative Density (LPBF/L-DED)
 *   - data/waam_bj_density_ingestion.csv (blank ingestion template pre-indexed with queue DOIs)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const PAPERS_CSV = path.join(ROOT, 'data', 'ti64_papers.csv');
const PARAMS_CSV = path.join(ROOT, 'data', 'ti64_process_parameters.csv');
const MECH_CSV = path.join(ROOT, 'data', 'ti64_mechanical_properties.csv');
const CORPUS_JSON = path.join(ROOT, 'data', 'cleaned_benchmark_corpus.json');
const DASHBOARD_HTML = path.join(ROOT, 'process_windows_dashboard.html');
const OUT_TEMPLATE_CSV = path.join(ROOT, 'data', 'waam_bj_density_ingestion.csv');

function parseCsvRfc4180(text) {
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
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (cols.length === 1 && cols[0].trim() === '') continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (cols[c] ?? '').trim();
    }
    out.push(obj);
  }
  return out;
}

function csvCell(val) {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function hasVal(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim();
  if (!s) return false;
  const n = Number(s);
  return Number.isFinite(n) ? n > 0 : true;
}

function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function firstTok(s) {
  return stripAccents(s).trim().split(/[\s,(]+/)[0].toLowerCase().replace(/\./g, '');
}

function buildDoiResolver() {
  if (!fs.existsSync(DASHBOARD_HTML)) return () => '';
  const html = fs.readFileSync(DASHBOARD_HTML, 'utf8');
  const m = html.match(/const PAPERS_DATABASE = (\[[\s\S]*?\n\]);/);
  if (!m) return () => '';
  let db = [];
  try {
    db = JSON.parse(m[1]);
  } catch {
    return () => '';
  }
  return (paperId, authors, year) => {
    const yr = String(year || '').trim();
    const tok = firstTok(authors);
    const matches = db.filter((e) => {
      const eYr = (String(e.author || '').match(/\b(19|20)\d{2}\b/) || [])[0];
      const eTok = firstTok(e.author);
      return (!yr || !eYr || eYr === yr) && tok && (eTok === tok || stripAccents(e.author).toLowerCase().includes(tok));
    });
    if (matches.length === 1 && matches[0].doi) return matches[0].doi;
    const byId = db.find((e) => e.id === `P-${String(paperId).padStart(2, '0')}` || e.id === `P-${paperId}`);
    if (byId && firstTok(byId.author) === tok && byId.doi) return byId.doi;
    const withDoi = matches.find((e) => e.doi);
    return withDoi ? withDoi.doi : '';
  };
}

function main() {
  const papers = parseCsvRfc4180(fs.readFileSync(PAPERS_CSV, 'utf8'));
  const paramsRows = parseCsvRfc4180(fs.readFileSync(PARAMS_CSV, 'utf8'));
  const mechRows = parseCsvRfc4180(fs.readFileSync(MECH_CSV, 'utf8'));
  const corpus = JSON.parse(fs.readFileSync(CORPUS_JSON, 'utf8'));
  const resolveDoi = buildDoiResolver();

  const paramsByPid = new Map(paramsRows.map((r) => [r.paper_number, r]));
  const mechByPid = new Map(mechRows.map((r) => [r.paper_number, r]));

  const waamQueue = [];
  const bjQueue = [];

  for (const p of papers) {
    const pid = p.paper_number;
    const pr = paramsByPid.get(pid) || {};
    const mc = mechByPid.get(pid) || {};
    const procStr = String(p.am_process || '').toLowerCase();
    const titleStr = String(p.title || '').toLowerCase();
    const doi = resolveDoi(pid, p.authors, p.year) || 'DOI N/A';

    const isWaam = /\bwaam\b|wire[\s_-]*arc|arc\s*additive/.test(procStr) || /\bwaam\b|wire[\s_-]*arc/.test(titleStr);
    const isBj = /binder[\s_-]*jet|\bbjt\b/.test(procStr) || /binder[\s_-]*jet/.test(titleStr);

    if (isWaam) {
      const noteText = `${pr.notes || ''} ${mc.notes || ''}`;
      const hasCurrVolt = /\d+\s*(a|amp|v|volt)/i.test(noteText);
      const missing = [];
      if (!hasVal(pr.laser_power_w) && !hasCurrVolt) missing.push('P/current/voltage');
      if (!hasVal(pr.scan_speed_mms)) missing.push('v');
      if (!String(mc.condition || '').trim()) missing.push('condition');
      if (!hasVal(mc.vickers_hardness_hv)) missing.push('hardness_hv');
      if (!hasVal(mc.yield_strength_mpa)) missing.push('ys_mpa');
      if (!hasVal(mc.ultimate_tensile_strength_mpa)) missing.push('uts_mpa');
      if (!hasVal(mc.elongation_pct)) missing.push('elongation_pct');
      if (!hasVal(mc.relative_density_pct)) missing.push('relative_density_pct');

      waamQueue.push({
        paper_id: `P-${pid}`,
        raw_id: pid,
        authors: p.authors,
        year: p.year,
        am_process: p.am_process,
        doi,
        title: p.title,
        missing
      });
    }

    if (isBj) {
      const noteText = `${pr.notes || ''} ${mc.notes || ''} ${mc.condition || ''}`;
      const hasSinterTemp = /\b1[1-4]\d{2}\s*°?\s*c\b/i.test(noteText);
      const hasSinterHold = /\d+\s*(min|hr|h)\b/i.test(noteText);
      const missing = [];
      if (!hasVal(pr.layer_thickness_um)) missing.push('layer_thickness_um');
      if (!hasSinterTemp) missing.push('sinter_temp_c');
      if (!hasSinterHold) missing.push('sinter_hold_min');
      if (!String(mc.condition || '').trim()) missing.push('condition');
      if (!hasVal(mc.vickers_hardness_hv)) missing.push('hardness_hv');
      if (!hasVal(mc.yield_strength_mpa)) missing.push('ys_mpa');
      if (!hasVal(mc.ultimate_tensile_strength_mpa)) missing.push('uts_mpa');
      if (!hasVal(mc.elongation_pct)) missing.push('elongation_pct');
      if (!hasVal(mc.relative_density_pct)) missing.push('relative_density_pct');

      bjQueue.push({
        paper_id: `P-${pid}`,
        raw_id: pid,
        authors: p.authors,
        year: p.year,
        am_process: p.am_process,
        doi,
        title: p.title,
        missing
      });
    }
  }

  const verifiedMissingDensity = corpus.records
    .filter((r) => r.benchmark_eligible === true && (r.process === 'lpbf' || r.process === 'ded-laser') && r.relative_density_pct === null)
    .map((r) => ({
      paper_id: `P-${r.paperNumber}`,
      raw_id: r.paperNumber,
      process: r.process === 'ded-laser' ? 'L-DED' : 'LPBF',
      authors: r.authors,
      year: r.year,
      doi: resolveDoi(r.paperNumber, r.authors, r.year) || 'DOI N/A',
      condition: r.rawCondition || r.condition
    }));

  // Write clean blank ingestion template CSV with pre-indexed DOIs/IDs (zero modified existing CSVs)
  const templateHeader = [
    'paper_id', 'process', 'authors', 'year', 'doi', 'condition',
    'P_W', 'v_mm_s', 'h_um', 't_um', 'T0_C',
    'sinter_temp_c', 'sinter_hold_min', 'oxygen_wt_pct',
    'hardness_hv', 'ys_mpa', 'uts_mpa', 'elongation_pct', 'relative_density_pct',
    'source_table_note'
  ];
  const seen = new Set();
  const templateRows = [templateHeader.join(',')];
  const pushRow = (paper_id, processLabel, authors, year, doi, noteHint) => {
    const k = `${paper_id}|${processLabel}`;
    if (seen.has(k)) return;
    seen.add(k);
    templateRows.push([
      paper_id, processLabel, authors, year, doi === 'DOI N/A' ? '' : doi,
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', noteHint || ''
    ].map(csvCell).join(','));
  };

  for (const w of waamQueue) pushRow(w.paper_id, 'waam', w.authors, w.year, w.doi, `Missing: ${w.missing.join('; ')}`);
  for (const b of bjQueue) pushRow(b.paper_id, 'binder-jetting', b.authors, b.year, b.doi, `Missing: ${b.missing.join('; ')}`);
  for (const d of verifiedMissingDensity) pushRow(d.paper_id, d.process === 'L-DED' ? 'ded-laser' : 'lpbf', d.authors, d.year, d.doi, `Fill relative_density_pct (${d.condition})`);

  fs.writeFileSync(OUT_TEMPLATE_CSV, templateRows.join('\n') + '\n', 'utf8');

  // Concise console output
  console.log(`\n=== 1. WAAM Catalog Queue (${waamQueue.length} papers in ti64_papers.csv) ===`);
  if (waamQueue.length === 0) {
    console.log('  (None found)');
  } else {
    for (const w of waamQueue) {
      console.log(`  ${w.paper_id.padEnd(6)} | ${w.authors} (${w.year}) | DOI: ${w.doi}`);
      console.log(`         Title: ${w.title}`);
      console.log(`         Missing [${w.missing.length}]: ${w.missing.join(', ') || 'None'}`);
    }
  }

  console.log(`\n=== 2. Binder Jetting Catalog Queue (${bjQueue.length} papers in ti64_papers.csv) ===`);
  if (bjQueue.length === 0) {
    console.log('  (None found)');
  } else {
    for (const b of bjQueue) {
      console.log(`  ${b.paper_id.padEnd(6)} | ${b.authors} (${b.year}) | DOI: ${b.doi}`);
      console.log(`         Title: ${b.title}`);
      console.log(`         Missing [${b.missing.length}]: ${b.missing.join(', ') || 'None'}`);
    }
  }

  console.log(`\n=== 3. Verified LPBF & L-DED Missing Relative Density Queue (${verifiedMissingDensity.length} studies) ===`);
  for (const d of verifiedMissingDensity) {
    console.log(`  ${d.paper_id.padEnd(6)} | ${d.process.padEnd(5)} | ${d.authors.padEnd(28)} | ${d.year} | DOI: ${d.doi}`);
  }

  console.log(`\nWrote blank ingestion template CSV to ${path.relative(ROOT, OUT_TEMPLATE_CSV)} (${templateRows.length - 1} rows)`);
}

main();
