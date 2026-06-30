/**
 * Server-side RSS fetch for the News tab (browser CORS + broken public proxies).
 */
const ALLOWED_HOSTS = ['feeds.bbci.co.uk', 'lenta.ru', 'www.lenta.ru'];

function hostAllowed(hostname) {
  const h = String(hostname || '').toLowerCase();
  return ALLOWED_HOSTS.some(function (allowed) {
    return h === allowed || h.endsWith('.' + allowed);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    res.status(400).json({ error: 'url_required' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    res.status(400).json({ error: 'bad_url' });
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'bad_url' });
    return;
  }

  if (!hostAllowed(parsed.hostname)) {
    res.status(403).json({ error: 'host_not_allowed' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, 28000);

  try {
    const upstream = await fetch(parsed.href, {
      method: 'GET',
      headers: {
        'User-Agent': 'SaranNewsProxy/1.0 (+https://saran-edu.ru)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
    });
    const body = await upstream.text();
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.status(upstream.status).send(body);
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    res.status(aborted ? 504 : 502).json({
      error: aborted ? 'timeout' : 'fetch_failed',
      message: e && e.message ? String(e.message) : 'upstream_error',
    });
  } finally {
    clearTimeout(timer);
  }
}
