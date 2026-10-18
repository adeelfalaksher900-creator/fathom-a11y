// Build-time muxer: silent HyperFrames render (parts/) + ElevenLabs narration + real screen-reader excerpts -> public/demo.mp4
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const FF = process.env.FFMPEG || ffmpegPath;
const cfg = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const W = 'work', OUT = 'public';
fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const sh = (args, opts = {}) => { const r = spawnSync(FF, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts }); return r; };
const die = (m) => { console.error('BUILD ERROR: ' + m); process.exit(1); };

// 1) silent picture from the committed parts
const parts = fs.readdirSync('.').filter((f) => f.startsWith('part-')).sort();
if (!parts.length) die('no video parts');
fs.writeFileSync(`${W}/silent.mp4`, Buffer.concat(parts.map((p) => fs.readFileSync(p))));
console.log('silent.mp4 bytes', fs.statSync(`${W}/silent.mp4`).size, 'from', parts.length, 'parts');

// 2) audio inputs
const dl = async (url, file) => {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); const b = Buffer.from(await r.arrayBuffer()); if (b.length < 10000) throw new Error('too small ' + b.length); fs.writeFileSync(file, b); return; }
    catch (e) { console.log('retry', file, String(e)); await new Promise((r) => setTimeout(r, 1500)); }
  }
  die('could not download ' + file);
};
const local = process.env.LOCAL_AUDIO_DIR;
const narrUrls = local ? {} : JSON.parse(process.env.NARR_URLS || '{}');
for (const n of cfg.narr) {
  const f = `${W}/n_${n.id}.mp3`;
  if (local) fs.copyFileSync(path.join(local, `n_${n.id}.mp3`), f);
  else { if (!narrUrls[n.id]) die('missing NARR_URLS.' + n.id); await dl(narrUrls[n.id], f); }
}
for (const e of cfg.excerpts) {
  const f = `${W}/x_${e.src}.mp3`;
  if (fs.existsSync(f)) continue;
  if (local) fs.copyFileSync(path.join(local, `x_${e.src}.mp3`), f);
  else await dl(cfg.siteBase + `cafe-${e.src}.mp3`, f);
}

// 3) filter graph
const inputs = []; const chains = []; const labels = [];
cfg.narr.forEach((n) => {
  const k = inputs.length; inputs.push(`${W}/n_${n.id}.mp3`);
  const d = Math.round(n.at * 1000);
  chains.push(`[${k}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atempo=${n.tempo},highpass=f=70,afade=t=in:d=0.04,adelay=${d}|${d},apad,atrim=end=${cfg.duration}[a${k}]`); labels.push(`[a${k}]`);
});
cfg.excerpts.forEach((e) => {
  const k = inputs.length; inputs.push(`${W}/x_${e.src}.mp3`);
  const d = Math.round(e.at * 1000), dur = e.to - e.from;
  chains.push(`[${k}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=start=${e.from}:end=${e.to},asetpts=PTS-STARTPTS,afade=t=in:d=0.08,afade=t=out:st=${(dur - 0.35).toFixed(2)}:d=0.35,volume=${e.gain},adelay=${d}|${d},apad,atrim=end=${cfg.duration}[a${k}]`); labels.push(`[a${k}]`);
});
const graph = chains.join(';') + `;${labels.join('')}amix=inputs=${labels.length}:duration=first:dropout_transition=0,volume=${labels.length},atrim=0:${cfg.duration},loudnorm=I=-16:TP=-1.5:LRA=9,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[aout]`;
fs.writeFileSync(`${W}/graph.txt`, graph);
const mix = sh(['-y', ...inputs.flatMap((f) => ['-i', f]), '-filter_complex_script', `${W}/graph.txt`, '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k', `${W}/audio.m4a`]);
if (mix.status !== 0) die('audio mix failed\n' + mix.stderr.slice(-2500));

// 4) mux
const mux = sh(['-y', '-i', `${W}/silent.mp4`, '-i', `${W}/audio.m4a`, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'copy', '-t', String(cfg.duration), '-movflags', '+faststart', `${OUT}/demo.mp4`]);
if (mux.status !== 0) die('mux failed\n' + mux.stderr.slice(-2500));
sh(['-y', '-ss', '20', '-i', `${OUT}/demo.mp4`, '-frames:v', '1', '-vf', 'scale=1280:-1', `${OUT}/poster.jpg`]);

// 5) report
const info = sh(['-i', `${OUT}/demo.mp4`]).stderr;
console.log(info.split('\n').filter((l) => /Duration|Stream/.test(l)).join('\n'));
const vol = sh(['-i', `${OUT}/demo.mp4`, '-af', 'volumedetect', '-vn', '-f', 'null', '-']).stderr;
console.log(vol.split('\n').filter((l) => /mean_volume|max_volume/.test(l)).join('\n'));
// 6) watch page
fs.copyFileSync(new URL('./watch.html', import.meta.url), `${OUT}/index.html`);
console.log('demo.mp4 bytes', fs.statSync(`${OUT}/demo.mp4`).size);
