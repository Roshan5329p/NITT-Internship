export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://iismzfileyuvqgdpivgx.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpc216ZmlsZXl1dnFnZHBpdmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3ODAwMjYsImV4cCI6MjEwOTM1NjAyNn0.v__OCG79B-NyMKmyb_W7Lp_Lw0xcoWUggEuONMECmGo';
    const limit = parseInt(req.query.limit) || 54;
    const offset = parseInt(req.query.offset) || 0;

    const r = await fetch(`${supabaseUrl}/rest/v1/papers?select=*&order=paper_number.asc&limit=${limit}&offset=${offset}`, {
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
