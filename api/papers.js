export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  res.setHeader('Content-Type', 'application/json');

  try {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://iismzfileyuvqgdpivgx.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpc216ZmlsZXl1dnFnZHBpdmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3ODAwMjYsImV4cCI6MjEwOTM1NjAyNn0.v__OCG79B-NyMKmyb_W7Lp_Lw0xcoWUggEuONMECmGo';
    const limit = Math.min(parseInt(req.query.limit) || 160, 200);
    const offset = parseInt(req.query.offset) || 0;
    const processFilter = req.query.process;

    let endpoint = `${supabaseUrl}/rest/v1/papers?select=*&paper_number=lte.154&order=paper_number.asc&limit=${limit}&offset=${offset}`;
    if (processFilter) {
      endpoint += `&am_process=ilike.*${encodeURIComponent(processFilter)}*`;
    }

    const r = await fetch(endpoint, {
      headers: { apikey: supabaseKey }
    });
    const data = await r.json();
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
