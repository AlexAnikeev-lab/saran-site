/**
 * Vercel serverless proxy → OpenRouter (replaces PHP on static hosting).
 * Env: SARAN_OPENROUTER_TOKEN or Token (set in Vercel project settings).
 */
const UPSTREAM = 'https://openrouter.ai/api/v1/chat/completions';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const token = String(
    process.env.SARAN_OPENROUTER_TOKEN || process.env.Token || process.env.TOKEN || ''
  ).trim();

  if (!token) {
    res.status(503).json({ error: 'server_token_missing' });
    return;
  }

  const payload = req.body;
  if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    res.status(400).json({ error: 'messages_required' });
    return;
  }

  let model = String(process.env.SARAN_OPENROUTER_MODEL || '').trim();
  if (!model && typeof payload.model === 'string') model = payload.model.trim();
  if (!model) model = 'google/gemini-3-flash-preview';

  const forwardPayload = { model, messages: payload.messages };
  if (typeof payload.temperature === 'number') forwardPayload.temperature = payload.temperature;
  if (typeof payload.max_tokens === 'number') forwardPayload.max_tokens = payload.max_tokens;
  if (typeof payload.stream === 'boolean') forwardPayload.stream = payload.stream;

  let origin = '';
  if (req.headers.origin) origin = String(req.headers.origin);
  else if (req.headers.referer) {
    try {
      origin = new URL(String(req.headers.referer)).origin;
    } catch (e) {
      origin = '';
    }
  }
  if (!origin) origin = 'https://saran-edu.ru';

  let upstreamRes;
  try {
    upstreamRes = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        'HTTP-Referer': origin,
        'X-Title': 'Saran Chat Proxy',
      },
      body: JSON.stringify(forwardPayload),
    });
  } catch (e) {
    res.status(502).json({
      error: 'fetch_failed',
      message: e && e.message ? String(e.message) : 'upstream_error',
    });
    return;
  }

  const text = await upstreamRes.text();
  const ctype = upstreamRes.headers.get('content-type');
  if (ctype) res.setHeader('Content-Type', ctype);
  res.status(upstreamRes.status).send(text);
}
