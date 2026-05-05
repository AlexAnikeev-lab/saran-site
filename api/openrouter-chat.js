/**
 * Прокси для OpenRouter (Node / Vercel Functions).
 * Для Рег.ру и обычного PHP-хостинга см. api/openrouter-chat.php — по умолчанию фронт дергает его (api/openrouter-chat.php).
 */
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).send('Method Not Allowed');
    }
    const token = (
        typeof process.env.Token !== 'undefined' &&
        String(process.env.Token || '').trim() !== ''
    )
        ? String(process.env.Token).trim()
        : (
            typeof process.env.SARAN_OPENROUTER_TOKEN !== 'undefined' &&
            String(process.env.SARAN_OPENROUTER_TOKEN || '').trim() !== ''
        )
            ? String(process.env.SARAN_OPENROUTER_TOKEN).trim()
            : '';

    if (!token) {
        return res.status(503).json({ error: 'server_token_missing' });
    }

    var bodyPayload;
    try {
        bodyPayload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    } catch (e) {
        return res.status(400).json({ error: 'bad_json' });
    }
    if (!bodyPayload || typeof bodyPayload !== 'object') {
        return res.status(400).json({ error: 'bad_body' });
    }

    var origin = '';
    try {
        origin =
            typeof req.headers.origin === 'string' && req.headers.origin
                ? req.headers.origin
                : typeof req.headers.referer === 'string'
                    ? req.headers.referer
                    : '';
    } catch (eO) {
        origin = '';
    }

    try {
        const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token,
                'HTTP-Referer': origin || 'https://saran.local',
                'X-Title': 'Saran Chat Proxy'
            },
            body: JSON.stringify(bodyPayload)
        });
        const raw = await upstream.text();
        const ct = upstream.headers.get('content-type');
        if (ct) res.setHeader('Content-Type', ct);
        return res.status(upstream.status).send(raw);
    } catch (e) {
        return res.status(502).json({
            error: 'upstream_failed',
            message: e && e.message ? e.message : 'fetch_error'
        });
    }
};
