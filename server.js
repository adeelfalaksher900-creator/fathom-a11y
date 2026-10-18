// Tiny static server for local dev and tests (serves ./public, plus a stub /api/voice).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const cfg = JSON.parse(await readFile(new URL('./vercel.json', import.meta.url), 'utf8'));
const common = Object.fromEntries((cfg.headers.find((h) => h.source === '/(.*)')?.headers || []).map((h) => [h.key, h.value]));
const root = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg', '.md': 'text/markdown' };
export function start(port = 4173) {
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    // Mirrors api/voice.js with no ELEVENLABS_API_KEY set (use ?on to simulate a configured server).
    if (url.pathname === '/api/voice') {
      const on = url.searchParams.has('on');
      res.writeHead(req.method === 'GET' ? 200 : on ? 200 : 503, { 'content-type': 'application/json', ...common });
      return res.end(JSON.stringify(req.method === 'GET' ? { configured: on } : { error: 'voice-not-configured' }));
    }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (p.endsWith('/')) p += 'index.html';
    try {
      const data = await readFile(join(root, p));
      res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store', ...common });
      res.end(data);
    } catch { res.writeHead(404, common); res.end('not found'); }
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
if (import.meta.url === `file://${process.argv[1]}`) start(Number(process.env.PORT) || 4173).then(() => console.log('http://localhost:' + (process.env.PORT || 4173)));
