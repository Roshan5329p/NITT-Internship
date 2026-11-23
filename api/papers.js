import { setCorsHeaders } from './_shared.js';

const ALLOWED_PROCESS_FILTERS = new Map([
  ['LPBF', { type: 'eq', value: 'LPBF' }],
  ['SLM', { type: 'eq', value: 'LPBF' }],
  ['L-DED', { type: 'ded' }],
  ['DED', { type: 'ded' }],
  ['WAAM', { type: 'eq', value: 'WAAM' }],
  ['BINDER JETTING', { type: 'eq', value: 'Binder Jetting' }],
  ['BINDER-JETTING', { type: 'eq', value: 'Binder Jetting' }],
  ['BJT', { type: 'eq', value: 'Binder Jetting' }]
]);

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
    const rawProcessFilter = typeof q.process === 'string' ? q.process.trim() : '';
    let mappedFilter = null;
    if (rawProcessFilter) {
      mappedFilter = ALLOWED_PROCESS_FILTERS.get(rawProcessFilter.toUpperCase()) || null;
      if (!mappedFilter) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_PROCESS_FILTER',
          message: 'Unsupported process filter. Allowed values: LPBF, L-DED, DED, WAAM, Binder Jetting, BJT.'
        });
      }
    }

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

    let endpoint = `${supabaseUrl}/rest/v1/papers?select=*&order=paper_number.asc&limit=${limit}&offset=${offset}`;
    if (mappedFilter) {
      if (mappedFilter.type === 'ded') {
        endpoint += `&or=(am_process.ilike.*DED*,am_process.ilike.*LMD*,am_process.ilike.*LENS*)`;
      } else {
        endpoint += `&am_process=ilike.*${encodeURIComponent(mappedFilter.value)}*`;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let r;
    try {
      r = await fetch(endpoint, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!r.ok) {
      await r.text().catch(() => '');
      return res.status(r.status).json({
        status: 'error',
        statusCode: r.status,
        message: 'Upstream papers database returned an error.'
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
    if (err.name === 'AbortError') {
      return res.status(504).json({ status: 'error', code: 'UPSTREAM_TIMEOUT', message: 'Upstream papers database timed out after 8000ms.' });
    }
    console.error('[api/papers] Internal error:', err);
    res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: 'An unexpected internal error occurred.' });
  }
}
