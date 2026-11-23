#!/usr/bin/env node
/**
 * Stages only browser-required public web assets into ./public for Vercel static CDN serving.
 * Keeps private helper files (api/_*.js), internal CSVs, audit logs, docs, reports, backend sources, and tests out of static CDN output.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

fs.copyFileSync(
  path.join(ROOT, 'process_windows_dashboard.html'),
  path.join(OUT_DIR, 'process_windows_dashboard.html')
);

for (const dir of ['plots', 'vendor']) {
  const src = path.join(ROOT, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(OUT_DIR, dir), { recursive: true });
  }
}

console.log('Staged minimal public Vercel output directory cleanly (data/, docs/, report/ excluded from CDN).');
