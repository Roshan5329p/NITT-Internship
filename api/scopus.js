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
    const apiKey = process.env.SCOPUS_API_KEY || process.env.ELSEVIER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        status: 'error',
        message: 'SCOPUS_API_KEY is not configured in server environment variables.'
      });
    }
    const rawQuery = typeof q.query === 'string' && q.query.trim()
      ? q.query.trim().slice(0, 500)
      : 'TITLE-ABS-KEY("Ti-6Al-4V" AND ("selective laser melting" OR "LPBF" OR "additive manufacturing") AND ("solidification" OR "melt pool"))';
    const parsedCount = parseInt(q.count, 10);
    const count = Math.max(1, Math.min(Number.isFinite(parsedCount) ? parsedCount : 10, 25));
    const allowedSorts = new Set(['citedby-count', 'relevance', 'coverDate', '-coverDate', 'pubyear', '-pubyear', 'title']);
    const sort = allowedSorts.has(q.sort) ? q.sort : 'citedby-count';

    const url = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(rawQuery)}&count=${count}&sort=${encodeURIComponent(sort)}&view=STANDARD`;

    const r = await fetch(url, {
      headers: {
        'X-ELS-APIKey': apiKey,
        'Accept': 'application/json'
      }
    });

    const rateLimit = {
      limit: r.headers.get('x-ratelimit-limit'),
      remaining: r.headers.get('x-ratelimit-remaining'),
      reset: r.headers.get('x-ratelimit-reset')
    };

    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({
        status: 'error',
        statusCode: r.status,
        message: errText,
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
    res.status(500).json({ status: 'error', message: err.message });
  }
}
