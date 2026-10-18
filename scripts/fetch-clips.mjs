// Build step: pulls pre-rendered ElevenLabs screen-reader clips into public/audio and writes the manifest
// the app matches by transcript text. Clips come from the CLIPS_JSON env var or scripts/clips.json:
// {"clips":[{"text":"<transcript lines joined by \n>","file":"audio/x.mp3","url":"https://..."}]}
// Never fails the build: with no clips the app falls back to the live proxy or the browser voice.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
const list = new URL('./clips.json', import.meta.url);
const raw = process.env.CLIPS_JSON || (existsSync(list) ? readFileSync(list, 'utf8') : '');
mkdirSync('public/audio', { recursive: true });
const manifest = { clips: [] };
let clips = [];
try { clips = raw ? JSON.parse(raw).clips || [] : []; } catch (e) { console.warn('clips config is not valid JSON:', e.message); }
for (const c of clips) {
  try {
    const r = await fetch(c.url);
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
