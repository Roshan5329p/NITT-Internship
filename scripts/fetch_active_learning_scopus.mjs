#!/usr/bin/env node
/**
 * Fetches verified Elsevier Scopus metadata, citation counts, EIDs, and abstracts
 * for core Ti-6Al-4V Active Learning & Bayesian Optimization references into
 * data/active_learning_references.json without modifying data/ti64_papers.csv.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const SCOPUS_SEARCH_ENDPOINT = 'https://api.elsevier.com/content/search/scopus';
const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), 'data', 'active_learning_references.json');
const REQUEST_DELAY_MS = 350;
const REQUEST_TIMEOUT_MS = 12000;

export const CORE_ACTIVE_LEARNING_DOIS = Object.freeze([
  {
    doi: '10.1038/s41467-025-56267-1',
    note: 'Lee et al. (2025) — Pareto Active Learning for LPBF Ti-6Al-4V'
  },
  {
    doi: '10.3390/ma15082902',
    note: 'Menon, Mondal, & Basak (2022) — Multi-Fidelity GP + BO in L-DED'
  },
  {
    doi: '10.1016/j.addma.2021.102411',
    note: 'van Houtum & Vlasea (2021) — Adaptive Weighted Uncertainty Sampling in AM'
  },
  {
    doi: '10.1038/s41524-019-0153-8',
    note: 'Lookman et al. (2019) — Active Learning Acquisition Policies in Materials Science'
  }
]);

export const DISCOVERY_QUERY =
  'TITLE-ABS-KEY(("Ti-6Al-4V" OR "Ti6Al4V") AND ("active learning" OR "Bayesian optimization") AND ("LPBF" OR "SLM" OR "DED" OR "WAAM" OR "additive manufacturing"))';

export function loadDotEnvFile(envPath = path.resolve(process.cwd(), '.env')) {
  if (!fs.existsSync(envPath)) return false;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
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
    const parsed = new URL(trimmed.startsWith('http://') ? `https://${trimmed.slice(7)}` : trimmed);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch (_err) {
    return null;
  }
}

export function normalizeScopusEntry(entry, { viewUsed = 'STANDARD', role = 'core', fetchedAt = new Date().toISOString() } = {}) {
  const e = entry || {};
  const doiRaw = typeof e['prism:doi'] === 'string' ? e['prism:doi'].trim() : '';
  const doi = doiRaw || null;

  let authors = '';
  if (Array.isArray(e.author) && e.author.length > 0) {
    const names = e.author
      .map((a) => (a && (a.authname || `${a['given-name'] || ''} ${a.surname || ''}`.trim())) || '')
      .filter(Boolean);
    authors = names.join(', ');
  }
  if (!authors) {
    authors = (typeof e['dc:creator'] === 'string' && e['dc:creator'].trim()) || 'Unknown Authors';
  }

  let rawScopusLink = null;
  if (Array.isArray(e.link)) {
    const scopusRel = e.link.find((l) => l && l['@ref'] === 'scopus' && l['@href']);
    if (scopusRel) rawScopusLink = scopusRel['@href'];
  }

  const doiUrl = doi ? sanitizeHttpsUrl(`https://doi.org/${doi}`) : null;
  const scopusUrl = sanitizeHttpsUrl(rawScopusLink) || doiUrl;
  const coverDate = typeof e['prism:coverDate'] === 'string' ? e['prism:coverDate'].trim() : '';
  const yearMatch = coverDate.match(/^(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  const citedParsed = parseInt(e['citedby-count'], 10);
  const abstractText = typeof e['dc:description'] === 'string' ? e['dc:description'].trim() : '';

  return {
    eid: typeof e.eid === 'string' && e.eid.trim() ? e.eid.trim() : null,
    scopusId: typeof e['dc:identifier'] === 'string' && e['dc:identifier'].trim() ? e['dc:identifier'].trim() : null,
    doi,
    title: (typeof e['dc:title'] === 'string' && e['dc:title'].trim()) || 'Untitled',
    authors,
    journal: (typeof e['prism:publicationName'] === 'string' && e['prism:publicationName'].trim()) || '',
    year,
    coverDate: coverDate || null,
    citedByCount: Number.isFinite(citedParsed) ? citedParsed : 0,
    openAccess: e.openaccessFlag === true || e.openaccess === '1' || e.openaccess === 1,
    scopusUrl,
    doiUrl,
    abstract: viewUsed === 'COMPLETE' && abstractText ? abstractText : null,
    viewUsed,
    role,
    fetchedAt
  };
}

export function dedupeEntries(entries, existingEntries = []) {
  const seenDois = new Set();
  const seenEids = new Set();

  for (const ex of existingEntries) {
    if (ex && ex.doi) seenDois.add(ex.doi.toLowerCase());
    if (ex && ex.eid) seenEids.add(ex.eid.toLowerCase());
  }

  const out = [];
  for (const item of entries) {
    if (!item) continue;
    const dKey = item.doi ? item.doi.toLowerCase() : null;
    const eKey = item.eid ? item.eid.toLowerCase() : null;
    if ((dKey && seenDois.has(dKey)) || (eKey && seenEids.has(eKey))) {
      continue;
    }
    if (dKey) seenDois.add(dKey);
    if (eKey) seenEids.add(eKey);
    out.push(item);
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchScopusWithViewFallback({ query, count = 1, sort = '', apiKey, instToken }) {
  const headers = {
    Accept: 'application/json',
    'X-ELS-APIKey': apiKey
  };
  if (instToken) {
    headers['X-ELS-Insttoken'] = instToken;
  }

  for (const view of ['COMPLETE', 'STANDARD']) {
    const params = new URLSearchParams({
      query,
      count: String(count),
      view
    });
    if (sort) params.set('sort', sort);
    const url = `${SCOPUS_SEARCH_ENDPOINT}?${params.toString()}`;

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
      const bodyTxt = await res.text().catch(() => '');
      throw new Error(`Scopus HTTP ${res.status} (${view}): ${bodyTxt.slice(0, 200)}`);
    }

    const json = await res.json();
    const searchResults = json['search-results'] || {};
    const entries = Array.isArray(searchResults.entry) ? searchResults.entry : [];
    const validEntries = entries.filter((item) => item && !item.error);
    return { entries: validEntries, viewUsed: view };
  }

  throw new Error('Exhausted COMPLETE and STANDARD views without a valid response.');
}

function formatSummaryTable(records) {
  const lines = [];
  lines.push('');
  lines.push('Year | Cites | View     | DOI                              | Title');
  lines.push('-----+-------+----------+----------------------------------+------------------------------------------');
  for (const r of records) {
    const yr = String(r.year ?? '—').padEnd(4, ' ');
    const ct = String(r.citedByCount ?? 0).padStart(5, ' ');
    const vw = String(r.viewUsed || 'STANDARD').padEnd(8, ' ');
    const doi = String(r.doi || 'N/A').slice(0, 32).padEnd(32, ' ');
    const title = String(r.title || '').slice(0, 62);
    lines.push(`${yr} | ${ct} | ${vw} | ${doi} | ${title}`);
  }
  lines.push('');
  return lines.join('\n');
}

export async function main() {
  loadDotEnvFile();
  const apiKey = (process.env.SCOPUS_API_KEY || process.env.ELSEVIER_API_KEY || '').trim();
  const instToken = (process.env.SCOPUS_INST_TOKEN || '').trim();

  if (!apiKey) {
    console.error('Missing SCOPUS_API_KEY. Set SCOPUS_API_KEY in .env or environment variables before running.');
    process.exit(1);
  }

  const discoverMode = process.argv.includes('--discover');
  const fetchedAt = new Date().toISOString();
  const coreReferences = [];

  for (let i = 0; i < CORE_ACTIVE_LEARNING_DOIS.length; i++) {
    const target = CORE_ACTIVE_LEARNING_DOIS[i];
    if (i > 0) await sleep(REQUEST_DELAY_MS);
    const { entries, viewUsed } = await fetchScopusWithViewFallback({
      query: `DOI(${target.doi})`,
      count: 1,
      apiKey,
      instToken
    });

    if (!entries.length) {
      throw new Error(`No Scopus entry returned for core DOI ${target.doi}`);
    }

    const normalized = normalizeScopusEntry(entries[0], { viewUsed, role: 'core', fetchedAt });
    coreReferences.push(normalized);
  }

  let discoveredReferences = [];
  if (discoverMode) {
    await sleep(REQUEST_DELAY_MS);
    const { entries, viewUsed } = await fetchScopusWithViewFallback({
      query: DISCOVERY_QUERY,
      count: 8,
      sort: '-citedby-count',
      apiKey,
      instToken
    });
    const normalizedDiscovered = entries.map((e) =>
      normalizeScopusEntry(e, { viewUsed, role: 'discovered', fetchedAt })
    );
    discoveredReferences = dedupeEntries(normalizedDiscovered, coreReferences);
  }

  const output = {
    generatedAt: fetchedAt,
    source: 'Elsevier Scopus Search API',
    coreCount: coreReferences.length,
    discoveredCount: discoveredReferences.length,
    coreReferences,
    discoveredReferences
  };

  fs.mkdirSync(path.dirname(DEFAULT_OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(DEFAULT_OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`Saved ${coreReferences.length} core + ${discoveredReferences.length} discovered Scopus references -> ${path.relative(process.cwd(), DEFAULT_OUTPUT_PATH)}`);
  console.log(formatSummaryTable([...coreReferences, ...discoveredReferences]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error('Scopus Active Learning fetch failed:', err && err.message ? err.message : err);
    process.exit(1);
  });
}
