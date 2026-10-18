// Optional live ElevenLabs proxy. Without ELEVENLABS_API_KEY the app falls back to
// pre-rendered ElevenLabs clips and the browser's built-in voice, so nothing breaks.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'bIHbv24MWmeRgasZH58o';
const hits = new Map();

export default async function handler(req, res) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (req.method === 'GET') {
    res.setHeader('cache-control', 'no-store');
    return res.status(200).json({ configured: Boolean(key) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  if (!key) return res.status(503).json({ error: 'voice-not-configured' });

  const ip = String(req.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 6) return res.status(429).json({ error: 'slow-down' });
  hits.set(ip, [...recent, now]);

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const text = String(body?.text || '').trim().slice(0, 1400);
  if (!text) return res.status(400).json({ error: 'text-required' });

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!r.ok) return res.status(502).json({ error: 'upstream-' + r.status });
    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    return res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    return res.status(502).json({ error: 'upstream-failed' });
  }
}
