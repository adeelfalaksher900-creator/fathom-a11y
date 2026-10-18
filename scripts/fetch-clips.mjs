// Vercel build step: pulls pre-rendered ElevenLabs screen-reader clips listed in scripts/clips.json
// ({clips:[{text,file,url}]}) into public/audio and writes the manifest the app matches by transcript text.
// Never fails the build: with no clips the app simply falls back to the live proxy or the browser voice.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
const list = new URL('./clips.json', import.meta.url);
mkdirSync('public/audio', { recursive: true });
const manifest = { clips: [] };
if (existsSync(list)) {
  for (const c of JSON.parse(readFileSync(list, 'utf8')).clips) {
    try {
      const r = await fetch(c.url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 10_000) throw new Error('response too small');
      writeFileSync(new URL(`../public/${c.file}`, import.meta.url), buf);
      manifest.clips.push({ text: c.text, file: c.file });
    } catch (e) { console.warn('clip skipped:', c.file, e.message); }
  }
}
writeFileSync(new URL('../public/audio/manifest.json', import.meta.url), JSON.stringify(manifest));
console.log('audio clips ready:', manifest.clips.length);
