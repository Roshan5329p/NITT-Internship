import { setCorsHeaders } from './_shared.js';

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      code: 'METHOD_NOT_ALLOWED',
      message: `HTTP method ${req.method} is not allowed. Use GET.`
    });
  }

  try {
    const q = req.query || {};
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({
        status: 'error',
        code: 'DATABASE_UNCONFIGURED',
        message: 'Supabase credentials are not configured in environment variables. Falling back to static papers registry.'
      });
    }

    const parsedLimit = parseInt(q.limit, 10);
    const parsedOffset = parseInt(q.offset, 10);
    const limit = Math.max(1, Math.min(Number.isFinite(parsedLimit) ? parsedLimit : 200, 250));
    const offset = Math.max(0, Number.isFinite(parsedOffset) ? parsedOffset : 0);
    const rawProcessFilter = typeof q.process === 'string' ? q.process.trim() : '';

    let endpoint = `${supabaseUrl}/rest/v1/papers?select=*&order=paper_number.asc&limit=${limit}&offset=${offset}`;
    if (rawProcessFilter) {
      const sanitizedFilter = rawProcessFilter.replace(/[^a-zA-Z0-9\s\-+_/]/g, '').trim();
      const pf = sanitizedFilter.toUpperCase();
      if (pf === 'L-DED' || pf === 'DED') {
        endpoint += `&or=(am_process.ilike.*DED*,am_process.ilike.*LMD*,am_process.ilike.*LENS*)`;
      } else if (pf) {
        endpoint += `&am_process=ilike.*${encodeURIComponent(sanitizedFilter)}*`;
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
      status: 'success',
      source: 'Supabase PostgreSQL Cloud',
      count: data.length,
      papers: data
    });
  } catch (err) {
    res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: err.message });
  }
}
