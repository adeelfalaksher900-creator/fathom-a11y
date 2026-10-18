// Build step: pulls pre-rendered ElevenLabs screen-reader clips into public/audio and writes the manifest the
// app matches by transcript text. scripts/clips.json lists each clip's transcript and the env var that holds its
// (temporary, signed) download URL. If that URL has expired, the clip is re-used from the live site so a redeploy
// never loses the voices. Never fails the build: with no clips the app falls back to the live proxy
// (api/voice.js) or the browser voice.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
const list = new URL('./clips.json', import.meta.url);
const LIVE = process.env.CLIP_FALLBACK_BASE || 'https://fathom-a11y.vercel.app/';
mkdirSync('public/audio', { recursive: true });
const manifest = { clips: [] };
const clips = existsSync(list) ? JSON.parse(readFileSync(list, 'utf8')).clips || [] : [];
const grab = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 10_000) throw new Error('response too small');
  return buf;
};
for (const c of clips) {
  let buf, via = 'signed url';
  try {
    const url = c.url || process.env[c.urlEnv];
    if (!url) throw new Error(`no URL (set ${c.urlEnv})`);
    buf = await grab(url);
  } catch (e) {
    try { buf = await grab(LIVE + c.file); via = 'live site'; } catch (e2) { console.warn('clip skipped:', c.file, e.message, '/', e2.message); continue; }
  }
  writeFileSync(new URL(`../public/${c.file}`, import.meta.url), buf);
  manifest.clips.push({ text: c.text, file: c.file });
  console.log('clip ok:', c.file, buf.length, 'bytes via', via);
}
writeFileSync(new URL('../public/audio/manifest.json', import.meta.url), JSON.stringify(manifest));
console.log('audio clips ready:', manifest.clips.length);
