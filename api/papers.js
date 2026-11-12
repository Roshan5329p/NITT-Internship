export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    const q = req.query || {};
    const supabaseUrl = process.env.SUPABASE_URL || 'https://iismzfileyuvqgdpivgx.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpc216ZmlsZXl1dnFnZHBpdmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3ODAwMjYsImV4cCI6MjEwOTM1NjAyNn0.v__OCG79B-NyMKmyb_W7Lp_Lw0xcoWUggEuONMECmGo';
    const limit = Math.min(parseInt(q.limit) || 200, 250);
    const offset = parseInt(q.offset) || 0;
    const processFilter = q.process;

    let endpoint = `${supabaseUrl}/rest/v1/papers?select=*&order=paper_number.asc&limit=${limit}&offset=${offset}`;
    if (processFilter) {
      const pf = processFilter.toUpperCase();
      if (pf === 'L-DED' || pf === 'DED') {
        endpoint += `&or=(am_process.ilike.*DED*,am_process.ilike.*LMD*,am_process.ilike.*LENS*)`;
      } else {
        endpoint += `&am_process=ilike.*${encodeURIComponent(processFilter)}*`;
      }
    }

    const r = await fetch(endpoint, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({
        status: 'error',
        statusCode: r.status,
        message: errText
      });
    }

    const raw = await r.json();
    // Deduplicate rows if remote table holds duplicate paper_number records
    const data = [];
    const seenKeys = new Set();
    if (Array.isArray(raw)) {
      for (const row of raw) {
        const key = `${row.paper_number}::${(row.title || '').trim().toLowerCase()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          data.push(row);
        }
      }
    }
    res.status(200).json({
      source: 'Supabase PostgreSQL Cloud',
      project_id: 'iismzfileyuvqgdpivgx',
      count: Array.isArray(data) ? data.length : 0,
      papers: data
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}
