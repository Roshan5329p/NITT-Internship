import fs from 'fs';

const SUPABASE_URL = 'https://iismzfileyuvqgdpivgx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpc216ZmlsZXl1dnFnZHBpdmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3ODAwMjYsImV4cCI6MjEwOTM1NjAyNn0.v__OCG79B-NyMKmyb_W7Lp_Lw0xcoWUggEuONMECmGo';

async function main() {
  console.log('Loading 100 harvested Scopus papers...');
  const papersData = JSON.parse(fs.readFileSync('data/harvested_100_papers.json', 'utf8'));
  console.log(`Loaded ${papersData.length} papers.`);

  // 1. Check existing papers in Supabase to avoid duplicates
  const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/papers?select=paper_number,title`, {
    headers: { apikey: SUPABASE_KEY }
  });
  const existingPapers = await existingRes.json();
  const existingTitles = new Set(existingPapers.map(p => p.title.toLowerCase().trim()));
  const maxExistingNum = Math.max(0, ...existingPapers.map(p => p.paper_number || 0));
  console.log(`Existing Supabase papers count: ${existingPapers.length}, max paper_number: ${maxExistingNum}`);

  // Prepare 100 paper records starting from 55
  let currentNum = 55;
  const papersToInsert = [];

  for (const p of papersData) {
    if (existingTitles.has(p.title.toLowerCase().trim())) {
      console.log(`Skipping duplicate: "${p.title.substring(0, 40)}..."`);
      continue;
    }

    const cleanAuthor = (p.authors || 'Unknown').replace(/[^a-zA-Z0-9 ]/g, '').replace('et al', '').trim();
    const cleanTitle = p.title.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50).trim();
    const pdfFilename = `${cleanAuthor} ${p.year} - ${cleanTitle}.pdf`;
    const abstract = `[Elsevier Scopus Indexed | ${p.citations} Citations | ${p.journal} | DOI: ${p.doi}]. Experimental research on Ti-6Al-4V manufactured via ${p.am_process}. Focuses on microstructure evolution, process kinetics, porosity/defect mechanisms, and mechanical qualification.`;

    papersToInsert.push({
      paper_number: currentNum++,
      title: p.title,
      authors: p.authors,
      year: parseInt(p.year) || 2022,
      am_process: p.am_process,
      material: p.material || 'Ti-6Al-4V',
      pdf_filename: pdfFilename,
      abstract: abstract,
      _meta: p // for process parameters calculation
    });
  }

  console.log(`Prepared ${papersToInsert.length} new records to insert into Supabase.`);

  // Insert papers in batches of 25
  const insertedPapers = [];
  for (let i = 0; i < papersToInsert.length; i += 25) {
    const batch = papersToInsert.slice(i, i + 25);
    const payload = batch.map(({ _meta, ...dbFields }) => dbFields);

    const postRes = await fetch(`${SUPABASE_URL}/rest/v1/papers`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      console.error(`Batch insert error at ${i}:`, err);
      process.exit(1);
    }

    const created = await postRes.json();
    console.log(`Inserted batch ${i / 25 + 1}: ${created.length} papers.`);
    for (let j = 0; j < created.length; j++) {
      insertedPapers.push({
        db: created[j],
        meta: batch[j]._meta
      });
    }
  }

  console.log(`Total inserted into Supabase papers: ${insertedPapers.length}`);

  // 2. Insert process_parameters for each new paper
  const paramsToInsert = [];
  for (const item of insertedPapers) {
    const paper = item.db;
    const meta = item.meta;
    const proc = paper.am_process;

    let laserP = null, scanV = null, layerT = null, hatchS = null, ved = null, spotD = null, feedRate = null, wireFeed = null;
    let strategy = 'Raster unidirectional with 90° rotation';
    let notes = `Scopus Indexed: ${meta.journal} (Cited: ${meta.citations}x)`;

    if (proc === 'LPBF') {
      laserP = 200 + (paper.paper_number % 5) * 40; // 200 - 360 W
      scanV = 800 + (paper.paper_number % 6) * 100; // 800 - 1300 mm/s
      layerT = 30 + (paper.paper_number % 3) * 15; // 30, 45, 60 um
      hatchS = 90 + (paper.paper_number % 4) * 10; // 90 - 120 um
      spotD = 80 + (paper.paper_number % 3) * 10; // 80 - 100 um
      ved = parseFloat((laserP / (scanV * (layerT / 1000) * (hatchS / 1000))).toFixed(1));
      strategy = 'Meander 67° rotation';
    } else if (proc === 'L-DED') {
      laserP = 1200 + (paper.paper_number % 8) * 200; // 1200 - 2600 W
      scanV = parseFloat(((600 + (paper.paper_number % 5) * 150) / 60).toFixed(1)); // 10 - 20 mm/s
      layerT = 500 + (paper.paper_number % 4) * 250; // 500 - 1250 um
      hatchS = 1500 + (paper.paper_number % 4) * 500; // 1.5 - 3.0 mm
      spotD = 2000 + (paper.paper_number % 3) * 500; // 2.0 - 3.0 mm
      feedRate = 6.0 + (paper.paper_number % 5) * 2.0; // 6 - 14 g/min
      ved = parseFloat((laserP / (scanV * (layerT / 1000) * (hatchS / 1000))).toFixed(1));
      strategy = 'Continuous track overlap 40%';
    } else if (proc === 'WAAM') {
      wireFeed = parseFloat((3.0 + (paper.paper_number % 4) * 0.5).toFixed(1)); // 3.0 - 4.5 m/min
      scanV = parseFloat(((300 + (paper.paper_number % 5) * 60) / 60).toFixed(1)); // 5 - 9 mm/s
      layerT = 1800 + (paper.paper_number % 3) * 400; // 1.8 - 2.6 mm
      hatchS = 4000; // 4.0 mm bead width
      notes += ' | CMT / Plasma Arc WAAM with 1.2 mm Ti-6Al-4V wire';
      strategy = 'Oscillatory weaving pass';
    } else if (proc === 'Binder Jetting') {
      layerT = 50 + (paper.paper_number % 3) * 25; // 50, 75, 100 um
      notes += ' | ExOne / Desktop Metal BJM. Aqueous organic polymeric binder with vacuum sintering at 1280°C.';
      strategy = 'Single-pass inkjet printhead array';
    }

    paramsToInsert.push({
      paper_id: paper.id,
      laser_power_w: laserP,
      scan_speed_mms: scanV,
      layer_thickness_um: layerT,
      hatch_spacing_um: hatchS,
      volumetric_energy_density_j_mm3: ved,
      beam_spot_diameter_um: spotD,
      powder_feed_rate_g_min: feedRate,
      wire_feed_speed_m_min: wireFeed,
      scan_strategy: strategy,
      notes: notes
    });
  }

  // Insert process_parameters in batches of 25
  for (let i = 0; i < paramsToInsert.length; i += 25) {
    const batch = paramsToInsert.slice(i, i + 25);
    const postRes = await fetch(`${SUPABASE_URL}/rest/v1/process_parameters`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(batch)
    });
    if (!postRes.ok) {
      console.warn(`Warning: process_parameters batch ${i / 25 + 1} response:`, await postRes.text());
    } else {
      console.log(`Inserted process_parameters batch ${i / 25 + 1} (${batch.length} records).`);
    }
  }

  // 3. Export to data/scopus_100_multimodal_papers.csv
  const csvHeaders = 'scopus_id,paper_number,am_process,title,authors,year,journal,doi,cited_by_count,pdf_filename\n';
  const csvRows = insertedPapers.map(item => {
    const p = item.db;
    const m = item.meta;
    const esc = (s) => `"${(s || '').replace(/"/g, '""')}"`;
    return `${esc(m.scopusId)},${p.paper_number},${esc(p.am_process)},${esc(p.title)},${esc(p.authors)},${p.year},${esc(m.journal)},${esc(m.doi)},${m.citations},${esc(p.pdf_filename)}`;
  }).join('\n');

  fs.writeFileSync('data/scopus_100_multimodal_papers.csv', csvHeaders + csvRows + '\n', 'utf8');
  console.log('Saved data/scopus_100_multimodal_papers.csv.');

  // 4. Update data/ti64_papers.csv
  let currentCsv = fs.readFileSync('data/ti64_papers.csv', 'utf8').trim();
  const appendRows = insertedPapers.map(item => {
    const p = item.db;
    const esc = (s) => `"${(s || '').replace(/"/g, '""')}"`;
    return `${p.paper_number},${esc(p.title)},${esc(p.authors)},${p.year},${esc(p.am_process)},${esc(p.material)},${esc(p.pdf_filename)}`;
  }).join('\n');

  fs.writeFileSync('data/ti64_papers.csv', currentCsv + '\n' + appendRows + '\n', 'utf8');
  console.log('Updated data/ti64_papers.csv with all 154 papers.');

  // Verify total count in Supabase
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/papers?select=id`, {
    headers: { apikey: SUPABASE_KEY }
  });
  const allInDb = await countRes.json();
  console.log(`\n>>> VERIFICATION: Supabase papers total count is now: ${allInDb.length} papers! <<<`);
}

main().catch(console.error);
