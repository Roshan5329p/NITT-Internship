#!/usr/bin/env node
/**
 * Idempotent Active Learning & Bayesian Optimization Reference Sync
 * Fetches verified Elsevier Scopus metadata for the 4 core Active Learning / BO papers
 * (plus optional --discover up to 4 additional Ti-6Al-4V active learning papers),
 * upserts them into data/ti64_papers.csv, js/dashboard-data.js, data/active_learning_references.json,
 * and Supabase `papers` table — strictly marked excluded from LOPO-CV / Comparator training.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { parseCsvRfc4180 } from './clean_benchmark_corpus.mjs';

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, 'data', 'ti64_papers.csv');
const DASHBOARD_DATA_PATH = path.join(ROOT, 'js', 'dashboard-data.js');
const REF_JSON_PATH = path.join(ROOT, 'data', 'active_learning_references.json');

const SCOPUS_ENDPOINT = 'https://api.elsevier.com/content/search/scopus';
const REQUEST_DELAY_MS = 350;
const REQUEST_TIMEOUT_MS = 12000;

export const CORE_ACTIVE_LEARNING_SPECS = Object.freeze([
  {
    doi: '10.1038/s41467-025-56267-1',
    process: 'LPBF',
    oaUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11754831/',
    acquisitionMethod: 'Pareto Active Learning -> UTS + Elongation mode',
    shortNote: 'Multi-objective Pareto active learning across 296 LPBF Ti-6Al-4V candidates reaching 1190 MPa UTS & 16.5% elongation.'
  },
  {
    doi: '10.3390/ma15082902',
    process: 'L-DED',
    oaUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9025529/',
    acquisitionMethod: 'Multi-Fidelity GP -> Hybrid Physics-GPR',
    shortNote: 'Blends analytical Eagar-Tsai priors with high-fidelity FEM + Bayesian Optimization for L-DED melt pool process mapping.'
  },
  {
    doi: '10.1016/j.addma.2021.102411',
    process: 'LPBF',
    oaUrl: null,
    acquisitionMethod: 'Adaptive Weighted Uncertainty -> Sparse WAAM/BJ Gap-Filling',
    shortNote: 'Adaptive Weighted Uncertainty Sampling (AWUS) balancing exploration/exploitation, cutting AM labeling budget by 20-70%.'
  },
  {
    doi: '10.1038/s41524-019-0153-8',
    process: 'All AM',
    oaUrl: null,
    acquisitionMethod: 'Expected Improvement (EI/UCB) -> Target Optimization',
    shortNote: 'Foundational review of Expected Improvement (EI), UCB, and Max-Variance uncertainty acquisition policies in materials science.'
  }
]);

export const DISCOVER_QUERY =
  'TITLE-ABS-KEY(("Ti-6Al-4V" OR "Ti6Al4V") AND ("active learning" OR "Bayesian optimization") AND ("LPBF" OR "SLM" OR "DED" OR "WAAM" OR "additive manufacturing"))';

export function loadDotEnvFile(envPath = path.join(ROOT, '.env')) {
  if (!fs.existsSync(envPath)) return false;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
  return true;
}

export function sanitizeHttpsUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const normalized = trimmed.startsWith('http://') ? `https://${trimmed.slice(7)}` : trimmed;
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch (_err) {
    return null;
  }
}

export function escapeCsvCell(val) {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function serializeCsv(headers, rows) {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => escapeCsvCell(r[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchScopusWithViewFallback({ query, count = 1, sort = '', apiKey, instToken }) {
  const headers = {
    Accept: 'application/json',
    'X-ELS-APIKey': apiKey
  };
  if (instToken) headers['X-ELS-Insttoken'] = instToken;

  for (const view of ['COMPLETE', 'STANDARD']) {
    const params = new URLSearchParams({ query, count: String(count), view });
    if (sort) params.set('sort', sort);
    const url = `${SCOPUS_ENDPOINT}?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, { headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if ((res.status === 401 || res.status === 403) && view === 'COMPLETE') {
      await res.text().catch(() => '');
      await sleep(REQUEST_DELAY_MS);
      continue;
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Scopus HTTP ${res.status} (${view}): ${txt.slice(0, 180)}`);
    }

    const json = await res.json();
    const sr = json['search-results'] || {};
    const entries = Array.isArray(sr.entry) ? sr.entry : [];
    return { entries: entries.filter((e) => e && !e.error), viewUsed: view };
  }
  throw new Error('Exhausted Scopus views without valid response.');
}

export function normalizeSyncedEntry(entry, spec = {}, { viewUsed = 'STANDARD', role = 'core', fetchedAt = new Date().toISOString() } = {}) {
  const e = entry || {};
  const doi = (typeof e['prism:doi'] === 'string' ? e['prism:doi'].trim() : '') || spec.doi || '';
  const doiLower = doi.toLowerCase();

  let authors = '';
  if (Array.isArray(e.author) && e.author.length > 0) {
    authors = e.author
      .map((a) => (a && (a.authname || `${a['given-name'] || ''} ${a.surname || ''}`.trim())) || '')
      .filter(Boolean)
      .join(', ');
  }
  if (!authors) {
    authors = (typeof e['dc:creator'] === 'string' && e['dc:creator'].trim()) || 'Unknown Authors';
  }

  let rawScopusLink = null;
  if (Array.isArray(e.link)) {
    const rel = e.link.find((l) => l && l['@ref'] === 'scopus' && l['@href']);
    if (rel) rawScopusLink = rel['@href'];
  }

  const doiUrl = doi ? sanitizeHttpsUrl(`https://doi.org/${doi}`) : null;
  const scopusUrl = sanitizeHttpsUrl(rawScopusLink) || doiUrl;
  const oaUrl = sanitizeHttpsUrl(spec.oaUrl || '');
  const coverDate = typeof e['prism:coverDate'] === 'string' ? e['prism:coverDate'].trim() : '';
  const yearMatch = coverDate.match(/^(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 2024;
  const citedByCount = Number.isFinite(parseInt(e['citedby-count'], 10)) ? parseInt(e['citedby-count'], 10) : 0;
  const journal = (typeof e['prism:publicationName'] === 'string' && e['prism:publicationName'].trim()) || '';
  const title = (typeof e['dc:title'] === 'string' && e['dc:title'].trim()) || 'Untitled Active Learning Reference';
  const abstractBody = typeof e['dc:description'] === 'string' ? e['dc:description'].trim() : '';
  const processLabel = spec.process || 'All AM';
  const acquisitionMethod = spec.acquisitionMethod || 'Active Learning Surrogate Selection';

  return {
    eid: typeof e.eid === 'string' && e.eid.trim() ? e.eid.trim() : null,
    scopusId: typeof e['dc:identifier'] === 'string' && e['dc:identifier'].trim() ? e['dc:identifier'].trim() : null,
    doi,
    doiLower,
    title,
    authors,
    journal,
    year,
    coverDate: coverDate || null,
    citedByCount,
    openAccess: Boolean(oaUrl) || e.openaccessFlag === true || e.openaccess === '1',
    oaUrl,
    scopusUrl,
    doiUrl,
    process: processLabel,
    acquisitionMethod,
    shortNote: spec.shortNote || '',
    abstract: viewUsed === 'COMPLETE' && abstractBody ? abstractBody : null,
    viewUsed,
    role,
    fetchedAt
  };
}

export function buildShortAuthorLabel(authorsStr, year) {
  const first = String(authorsStr || 'Unknown').split(',')[0].trim();
  const multi = String(authorsStr || '').includes(',');
  const surname = first.split(/\s+/)[0] || first;
  return `${surname}${multi ? ' et al.' : ''} (${year})`;
}

export function buildSupabaseAbstract(rec) {
  const parts = [
    'Elsevier Scopus Indexed',
    'Topic: Active Learning',
    `Cited: ${rec.citedByCount}`,
    `Journal: ${rec.journal || 'Peer-Reviewed'}`,
    `DOI: ${rec.doi}`
  ];
  if (rec.oaUrl) parts.push(`OA: ${rec.oaUrl}`);
  if (rec.acquisitionMethod) parts.push(`Policy: ${rec.acquisitionMethod}`);
  const header = `[${parts.join(' | ')}]`;
  const summary = rec.abstract || rec.shortNote || rec.title;
  return `${header} ${summary}`;
}

export function formatCsvPdfFilename(rec) {
  const cleanAuth = String(rec.authors || 'Unknown').split(',')[0].replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Author';
  const cleanTitle = String(rec.title || 'Reference').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 48).trim();
  return `${cleanAuth} ${rec.year} - ${cleanTitle}.pdf`;
}

export async function main() {
  loadDotEnvFile();
  const dryRun = process.argv.includes('--dry-run');
  const discover = process.argv.includes('--discover');

  const apiKey = (process.env.SCOPUS_API_KEY || process.env.ELSEVIER_API_KEY || '').trim();
  const instToken = (process.env.SCOPUS_INST_TOKEN || '').trim();
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

  if (!apiKey) {
    console.error('Missing SCOPUS_API_KEY in .env or environment variables.');
    process.exit(1);
  }
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY in .env.');
    process.exit(1);
  }

  const fetchedAt = new Date().toISOString();
  const coreRecords = [];
  for (let i = 0; i < CORE_ACTIVE_LEARNING_SPECS.length; i++) {
    const spec = CORE_ACTIVE_LEARNING_SPECS[i];
    if (i > 0) await sleep(REQUEST_DELAY_MS);
    const { entries, viewUsed } = await fetchScopusWithViewFallback({
      query: `DOI(${spec.doi})`,
      count: 1,
      apiKey,
      instToken
    });
    if (!entries.length) {
      throw new Error(`Scopus returned 0 records for core DOI ${spec.doi}`);
    }
    coreRecords.push(normalizeSyncedEntry(entries[0], spec, { viewUsed, role: 'core', fetchedAt }));
  }

  const discoveredRecords = [];
  if (discover) {
    await sleep(REQUEST_DELAY_MS);
    const seen = new Set(coreRecords.map((r) => r.doiLower));
    const { entries, viewUsed } = await fetchScopusWithViewFallback({
      query: DISCOVER_QUERY,
      count: 8,
      sort: '-citedby-count',
      apiKey,
      instToken
    });
    for (const e of entries) {
      if (discoveredRecords.length >= 4) break;
      const d = String(e['prism:doi'] || '').trim().toLowerCase();
      if (!d || seen.has(d)) continue;
      seen.add(d);
      discoveredRecords.push(normalizeSyncedEntry(e, { process: 'All AM' }, { viewUsed, role: 'discovered', fetchedAt }));
    }
  }

  const allRecords = [...coreRecords, ...discoveredRecords];

  // Load local CSV & js/dashboard-data.js
  const csvHeaders = ['paper_number', 'title', 'authors', 'year', 'am_process', 'material', 'pdf_filename'];
  const csvRaw = fs.readFileSync(CSV_PATH, 'utf8');
  const csvRows = parseCsvRfc4180(csvRaw);

  let ddTxt = fs.readFileSync(DASHBOARD_DATA_PATH, 'utf8');
  const dbMatch = ddTxt.match(/var PAPERS_DATABASE = (\[[\s\S]*?\n\]);/);
  if (!dbMatch) {
    throw new Error('Could not locate var PAPERS_DATABASE in js/dashboard-data.js');
  }
  const papersDb = JSON.parse(dbMatch[1]);

  let maxNum = Math.max(
    0,
    ...csvRows.map((r) => parseInt(r.paper_number, 10) || 0),
    ...papersDb.map((p) => parseInt(String(p.id || '').replace(/^P-0*/, ''), 10) || 0)
  );

  // Fetch existing Supabase rows so upserts remain strictly idempotent
  let sbExisting = [];
  const sbGet = await fetch(`${supabaseUrl}/rest/v1/papers?select=id,paper_number,title,abstract&limit=400`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  if (!sbGet.ok) {
    throw new Error(`Supabase GET papers failed with HTTP ${sbGet.status}`);
  }
  sbExisting = await sbGet.json();

  const summaryRows = [];

  for (const rec of allRecords) {
    const dbIdx = papersDb.findIndex((p) => String(p.doi || '').trim().toLowerCase() === rec.doiLower);
    const titleNorm = rec.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    let csvIdx = -1;
    let existingNum = null;

    if (dbIdx >= 0) {
      existingNum = parseInt(String(papersDb[dbIdx].id || '').replace(/^P-0*/, ''), 10) || null;
      if (existingNum !== null) {
        csvIdx = csvRows.findIndex((r) => (parseInt(r.paper_number, 10) || 0) === existingNum);
      }
    }
    if (csvIdx < 0) {
      csvIdx = csvRows.findIndex((r) => String(r.title || '').toLowerCase().replace(/[^a-z0-9]/g, '') === titleNorm);
      if (csvIdx >= 0) existingNum = parseInt(csvRows[csvIdx].paper_number, 10) || existingNum;
    }

    const assignedNum = existingNum || ++maxNum;
    const formattedId = `P-${assignedNum < 10 ? '0' + assignedNum : assignedNum}`;
    const localStatus = dbIdx >= 0 || csvIdx >= 0 ? 'updated' : 'inserted';

    const csvEntry = {
      paper_number: String(assignedNum),
      title: rec.title,
      authors: rec.authors,
      year: String(rec.year),
      am_process: rec.process,
      material: 'Ti-6Al-4V',
      pdf_filename: formatCsvPdfFilename(rec)
    };

    if (csvIdx >= 0) csvRows[csvIdx] = csvEntry;
    else csvRows.push(csvEntry);

    const dbEntry = {
      id: formattedId,
      author: buildShortAuthorLabel(rec.authors, rec.year),
      process: rec.process,
      topic: 'Active Learning',
      doi: rec.doi,
      ...(rec.oaUrl ? { oaUrl: rec.oaUrl } : {}),
      ...(rec.scopusUrl ? { scopusUrl: rec.scopusUrl } : {}),
      journal: rec.journal,
      year: rec.year,
      citedByCount: rec.citedByCount,
      type: 'MOD',
      treatment: `Scopus (${rec.citedByCount} citations)`,
      desc: `${rec.title} — ${rec.journal} (${rec.year}, ${rec.citedByCount} citations). ${rec.shortNote || ''}`.trim(),
      density: null,
      ys: null,
      uts: null,
      el: null,
      alloy: 'ti64_gr5',
      active_learning_proof: true,
      benchmark_eligible: false,
      params_extracted: false,
      specimen_type: 'active_learning_proof',
      acquisitionMethod: rec.acquisitionMethod,
      exclusion_reason: 'Active Learning & Bayesian Optimization methodology reference (excluded from LOPO-CV)'
    };

    if (dbIdx >= 0) papersDb[dbIdx] = dbEntry;
    else papersDb.push(dbEntry);

    // Supabase upsert
    const sbPayload = {
      paper_number: assignedNum,
      title: rec.title,
      authors: rec.authors,
      year: rec.year,
      am_process: rec.process,
      material: 'Ti-6Al-4V',
      pdf_filename: formatCsvPdfFilename(rec),
      abstract: buildSupabaseAbstract(rec)
    };

    const sbMatch = sbExisting.find((row) => {
      const absLow = String(row.abstract || '').toLowerCase();
      const tNorm = String(row.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (rec.doiLower && absLow.includes(rec.doiLower)) || tNorm === titleNorm || Number(row.paper_number) === assignedNum;
    });

    let supabaseStatus = 'dry-run';
    if (!dryRun) {
      let sbRes;
      if (sbMatch && sbMatch.id) {
        sbRes = await fetch(`${supabaseUrl}/rest/v1/papers?id=eq.${encodeURIComponent(sbMatch.id)}`, {
          method: 'PATCH',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify(sbPayload)
        });
      } else {
        sbRes = await fetch(`${supabaseUrl}/rest/v1/papers`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(sbPayload)
        });
      }

      if (!sbRes.ok) {
        const errBody = await sbRes.text().catch(() => '');
        throw new Error(`Supabase upsert failed for ${formattedId} (${rec.doi}): HTTP ${sbRes.status} ${errBody.slice(0, 180)}`);
      }
      supabaseStatus = String(sbRes.status);
    }

    summaryRows.push({
      paper_id: formattedId,
      doi: rec.doi,
      year: rec.year,
      citedByCount: rec.citedByCount,
      localStatus,
      supabaseStatus
    });
  }

  if (!dryRun) {
    fs.writeFileSync(CSV_PATH, serializeCsv(csvHeaders, csvRows), 'utf8');

    const serializedDb = 'var PAPERS_DATABASE = [\n  ' + papersDb.map((o) => JSON.stringify(o)).join(',\n  ') + '\n];';
    ddTxt = ddTxt.replace(dbMatch[0], serializedDb);
    fs.writeFileSync(DASHBOARD_DATA_PATH, ddTxt, 'utf8');

    const proofOut = {
      generatedAt: fetchedAt,
      source: 'Elsevier Scopus Search API',
      coreCount: coreRecords.length,
      discoveredCount: discoveredRecords.length,
      coreReferences: coreRecords.map((r, i) => ({ ...r, paperId: summaryRows[i].paper_id })),
      discoveredReferences: discoveredRecords.map((r, i) => ({
        ...r,
        paperId: summaryRows[coreRecords.length + i].paper_id
      }))
    };
    fs.writeFileSync(REF_JSON_PATH, JSON.stringify(proofOut, null, 2) + '\n', 'utf8');
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Active Learning Scopus + Supabase Sync Summary (${summaryRows.length} papers):`);
  console.table(summaryRows);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error('Active Learning sync failed:', err && err.message ? err.message : err);
    process.exit(1);
  });
}
