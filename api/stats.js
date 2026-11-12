export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.setHeader('Content-Type', 'application/json');

  let supabaseCount = 178;
  let supabaseStatus = 'connected';
  try {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://iismzfileyuvqgdpivgx.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpc216ZmlsZXl1dnFnZHBpdmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3ODAwMjYsImV4cCI6MjEwOTM1NjAyNn0.v__OCG79B-NyMKmyb_W7Lp_Lw0xcoWUggEuONMECmGo';
    const r = await fetch(`${supabaseUrl}/rest/v1/papers?select=count`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Range': '0-0',
        'Prefer': 'count=exact'
      }
    });
    const cr = r.headers.get('content-range');
    if (cr && cr.includes('/')) {
      supabaseCount = parseInt(cr.split('/')[1]) || 178;
    }
  } catch (e) {
    supabaseStatus = 'offline_fallback';
  }

  res.status(200).json({
    platform: 'NIT Trichy Titanium AM Platform',
    version: '2.5.0',
    deployment: 'Vercel Cloud Serverless',
    supabase_status: supabaseStatus,
    supabase_project: 'iismzfileyuvqgdpivgx',
    indexed_papers: supabaseCount,
    experimental_variants: 289,
    supported_alloys: ['Ti-6Al-4V Grade 5', 'Ti-6Al-4V ELI Grade 23'],
    supported_routes: ['LPBF', 'L-DED', 'WAAM', 'Binder Jetting']
  });
}
