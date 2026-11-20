#!/usr/bin/env node
/**
 * Idempotent ingestion of 36 peer-reviewed Ti-6Al-4V papers across 6 mechanical
 * characterization topics from Elsevier Scopus into:
 *   1. Supabase PostgreSQL (`papers` table)
 *   2. Local relational catalog (`data/ti64_papers.csv`, `data/scopus_6topics_papers.json`, `data/scopus_6topics_papers.csv`)
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment (.env).');
  process.exit(1);
}

const SCOPUS_CACHE = 'C:/Users/dvros/.gemini/antigravity/brain/89417eac-0d6b-40b5-9ecc-5856e8916694/scratch/scopus_6topics.json';
const OA_CACHE = 'C:/Users/dvros/.gemini/antigravity/brain/89417eac-0d6b-40b5-9ecc-5856e8916694/scratch/openalex_oa_6topics.json';
const LOCAL_JSON = path.join(ROOT, 'data', 'scopus_6topics_papers.json');
const LOCAL_CSV = path.join(ROOT, 'data', 'scopus_6topics_papers.csv');
const TI64_PAPERS_CSV = path.join(ROOT, 'data', 'ti64_papers.csv');

const TOPIC_MAP = {
  '1_StressStrain': 'Stress-Strain',
  '2_EngStressStrain': 'Eng. Stress-Strain',
  '3_CompressionStressStrain': 'Compression',
  '4_Fatigue_HCF_LCF': 'Fatigue HCF/LCF',
  '5_Creep': 'Creep',
  '6_Hardness': 'Hardness'
};

function inferAmProcess(title, topicLabel) {
  const t = (title || '').toLowerCase();
  if (t.includes('selective laser melt') || t.includes('slm') || t.includes('lpbf')) return 'LPBF';
  if (t.includes('electron beam melt') || t.includes('ebm')) return 'EBM';
  if (t.includes('laser-deposited') || t.includes('laser deposited') || t.includes('directed energy')) return 'L-DED';
  if (topicLabel === 'Compression') return 'Thermo-Mech / Compression';
  if (topicLabel === 'Creep') return 'Creep / Ti-6Al-4V';
  if (topicLabel === 'Fatigue HCF/LCF') return 'HCF & LCF / Surface';
  return 'Ti-6Al-4V Tensile / Wrought';
}

function normTitle(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function escCsv(val) {
  const s = String(val ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

async function main() {
  const scopusRaw = JSON.parse(fs.readFileSync(SCOPUS_CACHE, 'utf8'));
  const oaRaw = fs.existsSync(OA_CACHE) ? JSON.parse(fs.readFileSync(OA_CACHE, 'utf8')) : {};

  // Build deduplicated ordered list across all 6 topics
  const curated = [];
  const seenTitles = new Set();

  for (const [key, topicLabel] of Object.entries(TOPIC_MAP)) {
    const group = scopusRaw[key]?.papers || [];
    for (const p of group) {
      const n = normTitle(p.title);
      if (!n || seenTitles.has(n)) continue;
      seenTitles.add(n);
      curated.push({
        topicKey: key,
        topic: topicLabel,
        scopusId: p.scopusId || '',
        title: p.title.trim(),
        authors: p.author ? `${p.author} et al.` : 'Unknown et al.',
        year: parseInt(p.year, 10) || 2020,
        journal: p.journal || '',
        doi: p.doi || '',
        citations: Number(p.cites) || 0,
        openAccess: Boolean(p.openAccess),
        oaUrl: p.oaUrl || '',
        am_process: inferAmProcess(p.title, topicLabel)
      });
    }
  }

  // Also ensure Vrancken 2012 OA link from OpenAlex is captured cleanly
  const vranckenOa = (oaRaw['1_StressStrain'] || []).find(x => (x.doi || '').includes('2012.07.022'));
  if (vranckenOa) {
    const n = normTitle(vranckenOa.title);
    if (!seenTitles.has(n)) {
      // already may exist in P-59/local CSV; Supabase dedup check below handles safely
      curated.push({
        topicKey: '1_StressStrain',
        topic: 'Stress-Strain',
        scopusId: '',
        title: vranckenOa.title,
        authors: 'Vrancken B. et al.',
        year: 2012,
        journal: vranckenOa.journal,
        doi: vranckenOa.doi,
        citations: vranckenOa.cites,
        openAccess: true,
        oaUrl: vranckenOa.oaUrl,
        am_process: 'LPBF'
      });
    }
  }

  // Query Supabase `papers`
  const exRes = await fetch(`${SUPABASE_URL}/rest/v1/papers?select=id,paper_number,title&limit=500`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!exRes.ok) {
    throw new Error(`Supabase GET failed: HTTP ${exRes.status} ${await exRes.text()}`);
  }
  const existing = await exRes.json();
  const existingNorm = new Set(existing.map(r => normTitle(r.title)));
  let nextNum = Math.max(178, ...existing.filter(r => (r.paper_number || 0) < 9000).map(r => r.paper_number || 0)) + 1;

  const toInsert = [];
  for (const item of curated) {
    if (existingNorm.has(normTitle(item.title))) {
      console.log(`Skipping existing in Supabase: ${item.title.slice(0, 55)}...`);
      continue;
    }
    const cleanAuth = item.authors.replace(/[^a-zA-Z0-9 ]/g, '').replace('et al', '').trim();
    const cleanT = item.title.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50).trim();
    const pdfName = `${cleanAuth} ${item.year} - ${cleanT}.pdf`;
    const oaTag = item.oaUrl ? ` | OA: ${item.oaUrl}` : '';
    const doiTag = item.doi ? ` | DOI: ${item.doi}` : '';
    const abstract = `[Elsevier Scopus Indexed | ${item.citations} Citations | ${item.journal}${doiTag} | Topic: ${item.topic}${oaTag}]. Peer-reviewed Ti-6Al-4V ${item.topic} study investigating deformation, microstructure-property scaling, and mechanical performance.`;

    const num = nextNum++;
    item.paper_number = num;
    item.pdf_filename = pdfName;
    toInsert.push({
      paper_number: num,
      title: item.title,
      authors: item.authors,
      year: item.year,
      am_process: item.am_process,
      material: 'Ti-6Al-4V',
      pdf_filename: pdfName,
      abstract
    });
  }

  // Insert into Supabase in batches of 20
  let insertedCount = 0;
  for (let i = 0; i < toInsert.length; i += 20) {
    const batch = toInsert.slice(i, i + 20);
    const postRes = await fetch(`${SUPABASE_URL}/rest/v1/papers`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(batch)
    });
    if (!postRes.ok) {
      throw new Error(`Supabase POST failed: HTTP ${postRes.status} ${await postRes.text()}`);
    }
    const created = await postRes.json();
    insertedCount += created.length;
    console.log(`Inserted Supabase batch ${i / 20 + 1}: ${created.length} papers`);
  }

  // Save curated JSON & CSV locally
  fs.writeFileSync(LOCAL_JSON, JSON.stringify(curated, null, 2) + '\n', 'utf8');
  const scHeaders = 'paper_number,topic,scopus_id,title,authors,year,am_process,journal,doi,cited_by_count,open_access,oa_url\n';
  const scRows = curated.map(c => [
    c.paper_number || '', escCsv(c.topic), escCsv(c.scopusId), escCsv(c.title), escCsv(c.authors),
    c.year, escCsv(c.am_process), escCsv(c.journal), escCsv(c.doi), c.citations, c.openAccess, escCsv(c.oaUrl)
  ].join(',')).join('\n');
  fs.writeFileSync(LOCAL_CSV, scHeaders + scRows + '\n', 'utf8');

  // Append newly assigned rows cleanly into data/ti64_papers.csv (deduplicated by paper_number & title)
  const csvRaw = fs.readFileSync(TI64_PAPERS_CSV, 'utf8').trim();
  const csvLines = csvRaw.split(/\r?\n/);
  const existingCsvTitles = new Set(csvLines.slice(1).map(l => {
    const m = l.match(/^\d+,("([^"]|"")*"|[^,]*)/);
    return m ? normTitle(m[1]) : '';
  }));

  const newCsvLines = [];
  for (const row of toInsert) {
    if (existingCsvTitles.has(normTitle(row.title))) continue;
    newCsvLines.push([
      row.paper_number,
      escCsv(row.title),
      escCsv(row.authors),
      row.year,
      escCsv(row.am_process),
      escCsv(row.material),
      escCsv(row.pdf_filename)
    ].join(','));
  }

  if (newCsvLines.length > 0) {
    fs.writeFileSync(TI64_PAPERS_CSV, csvRaw + '\n' + newCsvLines.join('\n') + '\n', 'utf8');
  }

  // Verify final live Supabase count
  const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/papers?select=count`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact', Range: '0-0' }
  });
  console.log(`Supabase final Range: ${verifyRes.headers.get('content-range')} (inserted=${insertedCount})`);
  console.log(`Local ti64_papers.csv appended: ${newCsvLines.length} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
