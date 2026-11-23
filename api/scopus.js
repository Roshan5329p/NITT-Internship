import { setCorsHeaders, checkRateLimit } from './_shared.js';

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

  if (!checkRateLimit(req, { windowMs: 60000, maxRequests: 30, prefix: 'scopus' })) {
    return res.status(429).json({
      status: 'error',
      code: 'RATE_LIMITED',
      message: 'Too many Scopus search requests. Please retry after 60 seconds.'
    });
  }

  try {
    const q = req.query || {};
    const apiKey = process.env.SCOPUS_API_KEY || process.env.ELSEVIER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        status: 'error',
        code: 'SCOPUS_KEY_UNCONFIGURED',
        message: 'SCOPUS_API_KEY is not configured in server environment variables.'
      });
    }
    const defaultQuery = 'TITLE-ABS-KEY("Ti-6Al-4V" AND ("selective laser melting" OR "LPBF" OR "additive manufacturing") AND ("solidification" OR "melt pool"))';
    const rawUserQuery = typeof q.query === 'string' ? q.query.replace(/[\x00-\x1F\x7F]/g, '').trim() : '';
    const rawQuery = rawUserQuery ? rawUserQuery.slice(0, 200) : defaultQuery;
    const parsedCount = parseInt(q.count, 10);
    const count = Math.max(1, Math.min(Number.isFinite(parsedCount) ? parsedCount : 10, 25));
    const allowedSorts = new Set(['citedby-count', 'relevancy', 'coverDate', '-coverDate', 'pubyear', '-pubyear', 'title']);
    const rawSort = q.sort === 'relevance' ? 'relevancy' : q.sort;
    const sort = allowedSorts.has(rawSort) ? rawSort : 'citedby-count';

    const url = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(rawQuery)}&count=${count}&sort=${encodeURIComponent(sort)}&view=STANDARD`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let r;
    try {
      r = await fetch(url, {
        headers: {
          'X-ELS-APIKey': apiKey,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const rateLimit = {
      limit: r.headers.get('x-ratelimit-limit'),
      remaining: r.headers.get('x-ratelimit-remaining'),
      reset: r.headers.get('x-ratelimit-reset')
    };

    if (!r.ok) {
      await r.text().catch(() => '');
      return res.status(r.status).json({
        status: 'error',
        statusCode: r.status,
        message: 'Upstream Elsevier Scopus service returned an error.',
        rateLimit
      });
    }

    const json = await r.json();
    const searchResults = json['search-results'] || {};
    const totalResults = searchResults['opensearch:totalResults'] || '0';
    const rawEntries = searchResults['entry'] || [];

    const papers = rawEntries.map(e => ({
      scopusId: e['dc:identifier'] || '',
      title: e['dc:title'] || '',
      creator: e['dc:creator'] || 'Unknown Authors',
      publicationName: e['prism:publicationName'] || '',
      coverDate: e['prism:coverDate'] || '',
      year: (e['prism:coverDate'] || '').substring(0, 4) || '2024',
      doi: e['prism:doi'] || '',
      citedByCount: parseInt(e['citedby-count']) || 0,
      openAccess: e['openaccessFlag'] === true || e['openaccess'] === '1'
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      status: 'success',
      source: 'Elsevier Scopus REST API',
      query: rawQuery,
      totalResults: parseInt(totalResults, 10) || 0,
      count: papers.length,
      rateLimit,
      papers
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ status: 'error', code: 'UPSTREAM_TIMEOUT', message: 'Upstream Elsevier Scopus service timed out after 8000ms.' });
    }
    console.error('[api/scopus] Internal error:', err);
    res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: 'An unexpected internal error occurred.' });
  }
}
