// Build step: pulls pre-rendered ElevenLabs screen-reader clips into public/audio and writes the manifest the
// app matches by transcript text. scripts/clips.json lists each clip's transcript and the env var that holds its
// (temporary, signed) download URL. Never fails the build: with no clips the app falls back to the live proxy
// (api/voice.js) or the browser voice.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
const list = new URL('./clips.json', import.meta.url);
mkdirSync('public/audio', { recursive: true });
const manifest = { clips: [] };
const clips = existsSync(list) ? JSON.parse(readFileSync(list, 'utf8')).clips || [] : [];
for (const c of clips) {
  try {
    const url = c.url || process.env[c.urlEnv];
    if (!url) throw new Error(`no URL (set ${c.urlEnv})`);
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 10_000) throw new Error('response too small');
    writeFileSync(new URL(`../public/${c.file}`, import.meta.url), buf);
    manifest.clips.push({ text: c.text, file: c.file });
    console.log('clip ok:', c.file, buf.length, 'bytes');
  } catch (e) { console.warn('clip skipped:', c.file, e.message); }
}
writeFileSync(new URL('../public/audio/manifest.json', import.meta.url), JSON.stringify(manifest));
console.log('audio clips ready:', manifest.clips.length);
