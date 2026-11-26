import { describe, it, expect } from 'vitest';
// @ts-expect-error Untyped ESM Node script imported for unit testing
import * as ScopusFetcher from '../scripts/fetch_active_learning_scopus.mjs';
// @ts-expect-error Untyped ESM Node script imported for unit testing
import * as SyncPapers from '../scripts/sync_active_learning_papers.mjs';
// @ts-expect-error Untyped CJS/UMD browser script imported for unit testing
import * as ActiveLearningUi from '../js/active-learning-ui.js';

const { sanitizeHttpsUrl, normalizeScopusEntry, dedupeEntries, CORE_ACTIVE_LEARNING_DOIS } = ScopusFetcher;
const {
  escapeCsvCell,
  buildSupabaseAbstract,
  normalizeSyncedEntry,
  CORE_ACTIVE_LEARNING_SPECS
} = SyncPapers;
const { sanitizeHttpUrl, getActiveLearningProofPapers } = ActiveLearningUi;

declare const require: (id: string) => any;
declare const process: { cwd: () => string };
const fs = require('fs');
const path = require('path');

describe('Active Learning Scopus Reference Fetcher', () => {
  it('sanitizes URLs strictly to https://', () => {
    expect(sanitizeHttpsUrl('http://www.scopus.com/inward/record.uri?scp=123')).toBe(
      'https://www.scopus.com/inward/record.uri?scp=123'
    );
    expect(sanitizeHttpsUrl('https://doi.org/10.1038/s41467-025-56267-1')).toBe(
      'https://doi.org/10.1038/s41467-025-56267-1'
    );
    expect(sanitizeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeHttpsUrl('')).toBeNull();
  });

  it('normalizes COMPLETE vs STANDARD Scopus entries cleanly', () => {
    const raw = {
      eid: '2-s2.0-85216607727',
      'dc:identifier': 'SCOPUS_ID:85216607727',
      'prism:doi': '10.1038/s41467-025-56267-1',
      'dc:title': 'Active learning paper',
      'dc:creator': 'Lee J.A.',
      author: [{ authname: 'Lee J.A.' }, { authname: 'Park J.' }],
      'prism:publicationName': 'Nature Communications',
      'prism:coverDate': '2025-12-01',
      'citedby-count': '83',
      openaccessFlag: true,
      'dc:description': 'Pareto active learning abstract.',
      link: [{ '@ref': 'scopus', '@href': 'http://www.scopus.com/inward/record.uri?scp=85216607727' }]
    };

    const complete = normalizeScopusEntry(raw, { viewUsed: 'COMPLETE', role: 'core' });
    expect(complete.authors).toBe('Lee J.A., Park J.');
    expect(complete.abstract).toBe('Pareto active learning abstract.');
    expect(complete.citedByCount).toBe(83);
    expect(complete.year).toBe(2025);
    expect(complete.scopusUrl?.startsWith('https://')).toBe(true);

    const standard = normalizeScopusEntry(raw, { viewUsed: 'STANDARD', role: 'discovered' });
    expect(standard.abstract).toBeNull();
    expect(standard.role).toBe('discovered');
  });

  it('deduplicates discovered papers against core papers by DOI and EID', () => {
    const core = [
      { doi: '10.1038/s41467-025-56267-1', eid: '2-s2.0-85216607727' }
    ];
    const discovered = [
      { doi: '10.1038/S41467-025-56267-1', eid: '2-s2.0-999999' },
      { doi: '10.1016/other', eid: '2-s2.0-85216607727' },
      { doi: '10.1016/unique', eid: '2-s2.0-111111' }
    ];
    const filtered = dedupeEntries(discovered, core);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].doi).toBe('10.1016/unique');
  });

  it('stores all 4 core DOIs cleanly in data/active_learning_references.json and adds 4 tagged rows to ti64_papers.csv', () => {
    const outPath = path.resolve(process.cwd(), 'data', 'active_learning_references.json');
    expect(fs.existsSync(outPath)).toBe(true);
    const json = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    expect(json.coreCount).toBe(4);
    expect(json.coreReferences).toHaveLength(4);
    const savedDois = json.coreReferences.map((r: any) => r.doi);
    for (const target of CORE_ACTIVE_LEARNING_DOIS) {
      expect(savedDois).toContain(target.doi);
    }

    const csvPath = path.resolve(process.cwd(), 'data', 'ti64_papers.csv');
    const lines = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
    expect(lines.length).toBe(204);
    expect(lines.some((line: string) => line.startsWith('215,Active learning framework to optimize process parameters'))).toBe(true);
    expect(lines.some((line: string) => line.startsWith('218,Active learning in materials science'))).toBe(true);

    const dbPath = path.resolve(process.cwd(), 'js', 'dashboard-data.js');
    const dbSrc = fs.readFileSync(dbPath, 'utf8');
    for (const target of CORE_ACTIVE_LEARNING_DOIS) {
      expect(dbSrc).toContain(target.doi);
    }
  });

  it('formats CSV cells and Supabase abstract metadata safely for active learning proof papers', () => {
    expect(escapeCsvCell('Alpha, "Beta"')).toBe('"Alpha, ""Beta"""');
    expect(CORE_ACTIVE_LEARNING_SPECS).toHaveLength(4);

    const spec = CORE_ACTIVE_LEARNING_SPECS[0];
    const entry = normalizeSyncedEntry(
      {
        eid: '2-s2.0-85216607727',
        'prism:doi': spec.doi,
        'dc:title': 'Active learning framework',
        'dc:creator': 'Lee J.A.',
        'prism:publicationName': 'Nature Communications',
        'prism:coverDate': '2025-12-01',
        'citedby-count': '83',
        openaccessFlag: true,
        'dc:description': 'Pareto active learning abstract.',
        link: [{ '@ref': 'scopus', '@href': 'http://www.scopus.com/inward/record.uri?scp=85216607727' }]
      },
      spec,
      { viewUsed: 'COMPLETE', role: 'core' }
    );

    expect(entry.doi).toBe(spec.doi);
    expect(entry.citedByCount).toBe(83);
    expect(entry.year).toBe(2025);
    expect(entry.oaUrl).toBe(spec.oaUrl);

    const supAbstract = buildSupabaseAbstract(entry);
    expect(supAbstract).toContain('DOI: 10.1038/s41467-025-56267-1');
    expect(supAbstract).toContain('Topic: Active Learning');
    expect(supAbstract).toContain('Cited: 83');
    expect(supAbstract).toContain('Journal: Nature Communications');
    expect(supAbstract).toContain(`Policy: ${spec.acquisitionMethod}`);
    expect(supAbstract).toContain(`OA: ${spec.oaUrl}`);
  });

  it('enforces XSS-safe https:// sanitization and filters proof papers cleanly in active-learning-ui.js', () => {
    expect(sanitizeHttpUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeHttpUrl('http://doi.org/10.1038/s41467-025-56267-1')).toBe(
      'https://doi.org/10.1038/s41467-025-56267-1'
    );

    const g = globalThis as any;
    const prevCatalog = g.livePapersCatalog;
    const prevWindow = g.window;
    g.window = g;
    g.livePapersCatalog = [
      { id: 'P-01', topic: 'Process Window', active_learning_proof: false },
      { id: 'P-215', topic: 'Active Learning & Bayesian Optimization', active_learning_proof: true }
    ];
    const proof = getActiveLearningProofPapers();
    expect(proof).toHaveLength(1);
    expect(proof[0].id).toBe('P-215');
    if (prevCatalog === undefined) delete g.livePapersCatalog;
    else g.livePapersCatalog = prevCatalog;
    if (prevWindow === undefined) delete g.window;
    else g.window = prevWindow;
  });
});
