#!/usr/bin/env node
/**
 * Phase 6 Literature & Dataset Integrity Cleanup Script
 *
 * 1. Deduplicates data/ti64_papers.csv (removes 10 confirmed duplicate rows,
 *    transferring verified Scopus DOI/journal metadata where applicable).
 * 2. Removes 5 confirmed non-Ti-6Al-4V rows (#159, #161, #171, #184, #200)
 *    consistently across ti64_papers.csv and all companion CSVs.
 * 3. Repairs mismatched index-joined Scopus DOIs/journals in child CSV notes
 *    on #55..#78 using verified title matches from workspace metadata files,
 *    and clears unverified DOIs/journals rather than keeping false ones.
 * 4. Writes data/literature_cleanup_report.json summarizing all changes.
 * 5. Emits data/cleaned_papers_database.json (199 entries) for embedding in
 *    process_windows_dashboard.html (null mechanical cells where absent).
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');

function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') {
        fields.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  fields.push(cur);
  return fields;
}

function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function readCsv(filename) {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  return {
    headers: parseCsvLine(lines[0]),
    rows: lines.slice(1).map(parseCsvLine)
  };
}

function writeCsv(filename, headers, rows) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(r => r.map(escapeCsvCell).join(','))
  ];
  fs.writeFileSync(path.join(DATA_DIR, filename), lines.join('\n') + '\n', 'utf8');
}

const normTitle = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Build verified title -> metadata lookup strictly from workspace files
function buildVerifiedMetadataLookup() {
  const byTitle = new Map();
  const put = (title, meta) => {
    const k = normTitle(title);
    if (!k) return;
    const prev = byTitle.get(k) || {};
    byTitle.set(k, {
      title: prev.title || title,
      doi: prev.doi || meta.doi || '',
      journal: prev.journal || meta.journal || '',
      citations: prev.citations || meta.citations || '',
      oaUrl: prev.oaUrl || meta.oaUrl || '',
      topic: prev.topic || meta.topic || '',
      source: prev.source || meta.source || ''
    });
  };

  // 1. scopus_ti64_solidification_papers.csv
  {
    const { headers, rows } = readCsv('scopus_ti64_solidification_papers.csv');
    const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
    for (const r of rows) {
      put(r[idx.title], {
        doi: r[idx.doi],
        journal: r[idx.journal],
        citations: r[idx.cited_by_count],
        source: 'scopus_ti64_solidification_papers.csv'
      });
    }
  }

  // 2. scopus_6topics_papers.json
  {
    const arr = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scopus_6topics_papers.json'), 'utf8'));
    for (const item of arr) {
      put(item.title, {
        doi: item.doi,
        journal: item.journal,
        citations: item.citations,
        oaUrl: item.oaUrl,
        topic: item.topic,
        source: 'scopus_6topics_papers.json'
      });
    }
  }

  // 3. scopus_100_multimodal_papers.csv
  {
    const { headers, rows } = readCsv('scopus_100_multimodal_papers.csv');
    const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
    for (const r of rows) {
      put(r[idx.title], {
        doi: r[idx.doi],
        journal: r[idx.journal],
        citations: r[idx.cited_by_count],
        source: 'scopus_100_multimodal_papers.csv'
      });
    }
  }

  // 4. harvested_100_papers.json
  {
    const arr = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'harvested_100_papers.json'), 'utf8'));
    for (const item of arr) {
      put(item.title, {
        doi: item.doi,
        journal: item.journal,
        citations: item.citations,
        source: 'harvested_100_papers.json'
      });
    }
  }

  return byTitle;
}

// Verified 10 duplicate pairs (removedId -> keptId)
const DUPLICATE_REMOVALS = new Map([
  [109, { kept: 69, reason: 'Duplicate of #69 (Heigel et al. 2015 thermo-mechanical DED model)' }],
  [115, { kept: 77, reason: 'Duplicate of #77 (Liu et al. 2021 aerospace Ti AM review)' }],
  [118, { kept: 30, reason: 'Duplicate of #30 (Lu et al. 2019 rectangular & S-shaped DED residual stress)' }],
  [127, { kept: 57, reason: 'Duplicate of #57 (Bontha et al. 2006 thin-wall thermal process maps)' }],
  [131, { kept: 105, reason: 'Duplicate of #105 (Liu S. et al. 2019 Ti6Al4V AM review)' }],
  [132, { kept: 59, reason: 'Duplicate of #59 (Vrancken et al. 2012 SLM Ti6Al4V heat treatment)' }],
  [135, { kept: 60, reason: 'Duplicate of #60 (Vilaro et al. 2011 SLM Ti-6Al-4V microstructures)' }],
  [145, { kept: 65, reason: 'Duplicate of #65 (Zhao et al. 2017 synchrotron X-ray LPBF monitoring)' }],
  [151, { kept: 108, reason: 'Duplicate of #108 (Nguyen H.D. et al. 2022 critical review Ti-6Al-4V)' }],
  [153, { kept: 67, reason: 'Duplicate of #67 (Tammas-Williams et al. 2015 XCT defect strategies)' }]
]);

// Verified 5 non-Ti-6Al-4V papers to remove
const NON_TI64_REMOVALS = new Map([
  [159, 'Non-Ti-6Al-4V alloy: TiAl intermetallic alloy (Dilip et al. 2017)'],
  [161, 'Non-Ti-6Al-4V alloy: Titanium Aluminides based materials (Yadav et al. 2020)'],
  [171, 'Non-Ti-6Al-4V alloy: Metal-Injection-Molded beta titanium alloys (Xu et al. 2022)'],
  [184, 'Non-Ti-6Al-4V alloy: Intermetallic Al3Ti alloy (Lu Z. et al. 2016)'],
  [200, 'Non-Ti-6Al-4V alloy: Biomedical beta-type titanium alloy (Akahori et al. 2005)']
]);

const ALL_REMOVED_IDS = new Set([
  ...DUPLICATE_REMOVALS.keys(),
  ...NON_TI64_REMOVALS.keys()
]);

// Verified metadata transfers for shortened curated titles (#55..#78) from title/duplicate equivalents
const VERIFIED_OVERRIDES_BY_PAPER_NUM = {
  57: { doi: '10.1016/j.jmatprotec.2006.03.155', journal: 'Journal of Materials Processing Technology', source: 'harvested_100_papers.json (#127 equivalent)' },
  59: { doi: '10.1016/j.jallcom.2012.07.022', journal: 'Journal of Alloys and Compounds', source: 'scopus_ti64_solidification_papers.csv & #132 equivalent' },
  60: { doi: '10.1007/s11661-011-0731-y', journal: 'Metallurgical and Materials Transactions A Physical Metallurgy and Materials Science', source: 'scopus_ti64_solidification_papers.csv & #135 equivalent' },
  61: { doi: '10.1016/j.msea.2014.07.086', journal: 'Materials Science and Engineering A', source: 'scopus_ti64_solidification_papers.csv' },
  62: { doi: '10.1080/14686996.2017.1361305', journal: 'Science and Technology of Advanced Materials', source: 'scopus_ti64_solidification_papers.csv' },
  63: { doi: '10.1038/s41467-019-13874-z', journal: 'Nature Communications', source: 'scopus_ti64_solidification_papers.csv' },
  65: { doi: '10.1038/s41598-017-03761-2', journal: 'Scientific Reports', source: 'harvested_100_papers.json (#145 equivalent)' },
  67: { doi: '10.1016/j.matchar.2015.02.008', journal: 'Materials Characterization', source: 'harvested_100_papers.json (#153 equivalent)' },
  69: { doi: '10.1016/j.addma.2014.10.003', journal: 'Additive Manufacturing', source: 'harvested_100_papers.json (#109 equivalent)' },
  77: { doi: '10.1007/s11837-021-04670-6', journal: 'JOM', source: 'harvested_100_papers.json (#115 equivalent)' }
};

function cleanChildNote(note, paperRow, verifiedMeta, allowBlankIfFullData) {
  const s = String(note || '').trim();
  if (!s.startsWith('Indexed Ti-6Al-4V study')) return s;
  const proc = paperRow[4];
  const auth = paperRow[2];
  const yr = paperRow[3];
  if (verifiedMeta && (verifiedMeta.doi || verifiedMeta.journal)) {
    const parts = [`Indexed Ti-6Al-4V study (${proc}; ${auth} ${yr})`];
    if (verifiedMeta.journal) parts.push(verifiedMeta.journal);
    if (verifiedMeta.doi) parts.push(`DOI: ${verifiedMeta.doi}`);
    if (!allowBlankIfFullData) parts.push('Pending quantitative experimental extraction');
    return parts.join(' | ');
  }
  if (allowBlankIfFullData) return '';
  return `Indexed Ti-6Al-4V study (${proc}; ${auth} ${yr}) | DOI/Journal unverified in workspace archive | Pending quantitative experimental extraction`;
}

function main() {
  const metaLookup = buildVerifiedMetadataLookup();
  const papersCsv = readCsv('ti64_papers.csv');
  const initialCount = papersCsv.rows.length;

  const retainedPapers = papersCsv.rows.filter(r => !ALL_REMOVED_IDS.has(Number(r[0])));
  writeCsv('ti64_papers.csv', papersCsv.headers, retainedPapers);

  const paperMap = new Map(retainedPapers.map(r => [Number(r[0]), r]));
  const getVerifiedMeta = (paperNum) => {
    if (VERIFIED_OVERRIDES_BY_PAPER_NUM[paperNum]) return VERIFIED_OVERRIDES_BY_PAPER_NUM[paperNum];
    const row = paperMap.get(paperNum);
    if (!row) return null;
    return metaLookup.get(normTitle(row[1])) || null;
  };

  // Clean companion CSVs
  const companionFiles = [
    'ti64_process_parameters.csv',
    'ti64_thermal_physics.csv',
    'ti64_microstructure.csv',
    'ti64_mechanical_properties.csv'
  ];

  const repairedNotes = [];
  const clearedFalseNotes = [];

  for (const fname of companionFiles) {
    const csv = readCsv(fname);
    const pnIdx = csv.headers.indexOf('paper_number');
    const noteIdx = csv.headers.indexOf('notes');
    const keptRows = [];

    for (const r of csv.rows) {
      const pnum = Number(r[pnIdx]);
      if (ALL_REMOVED_IDS.has(pnum)) continue;

      if (noteIdx >= 0 && pnum >= 55 && pnum <= 78) {
        const paperRow = paperMap.get(pnum);
        const oldNote = r[noteIdx];
        const vMeta = getVerifiedMeta(pnum);
        const hasExperimentalMech = pnum <= 78;
        const newNote = cleanChildNote(oldNote, paperRow, vMeta, pnum <= 58);
        if (oldNote !== newNote) {
          r[noteIdx] = newNote;
          if (fname === 'ti64_microstructure.csv') {
            if (vMeta) repairedNotes.push({ paper_number: pnum, title: paperRow[1], oldNote, newNote, source: vMeta.source });
            else clearedFalseNotes.push({ paper_number: pnum, title: paperRow[1], oldNote, newNote });
          }
        }
      }
      keptRows.push(r);
    }
    writeCsv(fname, csv.headers, keptRows);
  }

  // Verify ti64_predictions.csv FK integrity
  const predCsv = readCsv('ti64_predictions.csv');
  const orphanedPreds = predCsv.rows.filter(r => !paperMap.has(Number(r[0])));

  // Build cleaned 199-entry POWERS/PAPERS_DATABASE seed list from HTML's existing curated 1..78 & 179..214 + CSV 79..178
  const html = fs.readFileSync(path.join(ROOT, 'process_windows_dashboard.html'), 'utf8');
  const dbStart = html.indexOf('const PAPERS_DATABASE = [');
  const dbEnd = html.indexOf('function escapeHtml(');
  const dbSlice = html.slice(dbStart, dbEnd);
  // Evaluate existing PAPERS_DATABASE safely using Function
  const existingDb = new Function(`${dbSlice.replace('const PAPERS_DATABASE', 'var PAPERS_DATABASE')}; return PAPERS_DATABASE;`)();
  const existingById = new Map(existingDb.map(item => [item.id, item]));

  const cleanedDb = [];

  // 1. Preserve P-01..P-58 (all correspond to CSV 1..58 benchmark rows)
  for (let i = 1; i <= 58; i++) {
    const id = `P-${i < 10 ? '0' + i : i}`;
    const item = { ...existingById.get(id) };
    // P-04 is Bontha et al. (2006) (#57 in CSV) -> attach verified DOI if absent
    if (id === 'P-04' && !item.doi) {
      item.doi = VERIFIED_OVERRIDES_BY_PAPER_NUM[57].doi;
    }
    cleanedDb.push(item);
  }

  // 2. Preserve P-59..P-78 (CSV 59..78) and attach strictly verified DOIs where found in workspace files
  const unverified59to78 = [];
  for (let i = 59; i <= 78; i++) {
    const id = `P-${i}`;
    const item = { ...existingById.get(id) };
    const vMeta = getVerifiedMeta(i);
    if (!item.doi && vMeta && vMeta.doi) {
      item.doi = vMeta.doi;
    }
    if (!item.doi) {
      unverified59to78.push({ id: i, author: item.author, title: paperMap.get(i)?.[1] || '' });
    }
    cleanedDb.push(item);
  }

  // 3. Add missing CSV #79..#178 (minus removed duplicates & non-Ti-6Al-4V) with null mechanical cells
  const mechMissingRows = [];
  for (const row of retainedPapers) {
    const pnum = Number(row[0]);
    if (pnum < 79 || pnum > 178) continue;
    const vMeta = getVerifiedMeta(pnum);
    const doi = vMeta?.doi || '';
    const journal = vMeta?.journal || '';
    const citations = vMeta?.citations ? ` (${vMeta.citations} citations)` : '';
    const descParts = [row[1]];
    if (journal) descParts.push(journal + citations);
    cleanedDb.push({
      id: `P-${pnum}`,
      author: `${row[2].replace(/\s+et al\.?$/i, ' et al.')} (${row[3]})`,
      process: row[4],
      doi,
      type: /review/i.test(row[1]) ? 'REV' : (/model|simulation|finite element/i.test(row[1]) ? 'MOD' : 'EXP'),
      treatment: 'Scopus Indexed (Pending Extraction)',
      desc: descParts.join(' — '),
      density: null,
      ys: null,
      uts: null,
      el: null
    });
    mechMissingRows.push(pnum);
  }

  // 4. Preserve retained P-179..P-214 (removing #184, #200) with null mechanical cells (no uniform placeholders)
  for (const row of retainedPapers) {
    const pnum = Number(row[0]);
    if (pnum < 179) continue;
    const id = `P-${pnum}`;
    const prev = existingById.get(id);
    if (!prev) continue;
    cleanedDb.push({
      id,
      author: prev.author,
      process: prev.process,
      topic: prev.topic || '',
      doi: prev.doi || '',
      ...(prev.oaUrl ? { oaUrl: prev.oaUrl } : {}),
      type: prev.type || 'EXP',
      treatment: prev.treatment || 'Scopus Indexed',
      desc: prev.desc,
      density: null,
      ys: null,
      uts: null,
      el: null
    });
    mechMissingRows.push(pnum);
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'cleaned_papers_database.json'),
    JSON.stringify(cleanedDb, null, 2) + '\n',
    'utf8'
  );

  const report = {
    generated_at: new Date().toISOString(),
    initial_csv_count: initialCount,
    removed_duplicates_count: DUPLICATE_REMOVALS.size,
    removed_duplicates: [...DUPLICATE_REMOVALS.entries()].map(([id, info]) => ({ paper_number: id, ...info })),
    removed_non_ti64_count: NON_TI64_REMOVALS.size,
    removed_non_ti64: [...NON_TI64_REMOVALS.entries()].map(([id, reason]) => ({ paper_number: id, reason })),
    cleaned_csv_count: retainedPapers.length,
    cleaned_papers_database_count: cleanedDb.length,
    orphaned_predictions_rows: orphanedPreds.length,
    repaired_scopus_notes_count: repairedNotes.length,
    repaired_scopus_notes: repairedNotes,
    cleared_false_notes_count: clearedFalseNotes.length,
    unverified_doi_journal_papers_55_to_78: unverified59to78.concat(
      [55, 56, 58].map(n => ({ id: n, author: paperMap.get(n)?.[2], title: paperMap.get(n)?.[1] }))
    ).sort((a, b) => a.id - b.id),
    pending_experimental_extraction_count: mechMissingRows.length,
    pending_experimental_extraction_range: 'Retained rows from #79..#214 (density/ys/uts/el set to null / blank; zero uniform placeholders)'
  };

  fs.writeFileSync(
    path.join(DATA_DIR, 'literature_cleanup_report.json'),
    JSON.stringify(report, null, 2) + '\n',
    'utf8'
  );

  console.log('Cleanup complete:', {
    initialCount,
    cleanedCsvCount: retainedPapers.length,
    cleanedDbCount: cleanedDb.length,
    orphanedPreds: orphanedPreds.length,
    repairedNotes: repairedNotes.length,
    clearedFalseNotes: clearedFalseNotes.length,
    unverified55to78: report.unverified_doi_journal_papers_55_to_78.map(x => x.id),
    pendingExtractionCount: mechMissingRows.length
  });
}

main();
