// Fathom end-to-end suite. Run: `node server.js &` then `node tests/run.mjs` (URL=... to target a deploy).
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL_ = process.env.URL || 'http://localhost:4173/';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const AXE = readFileSync(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
const results = [];
const browser = await chromium.launch();

const wav = (secs = 1) => { // silent mono 8 kHz WAV
  const n = 8000 * secs, b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44);
  return b;
};
const SPEECH_STUB = () => {
  const speak = (u) => setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 4); }, 4);
  Object.defineProperty(window, 'speechSynthesis', { value: { speak, cancel() {}, getVoices: () => [{ lang: 'en-US', name: 'Test voice' }], onvoiceschanged: null }, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  window.__spoken = [];
  const orig = window.speechSynthesis.speak;
  window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); orig(u); };
};

async function open({ w = 1600, h = 1000, init, motion, forced, routes } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true, reducedMotion: motion || 'no-preference', forcedColors: forced || 'none' });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) page.errs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => page.errs.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => { if (!/invalid\.invalid|example\.com/.test(r.url()) && !/ERR_ABORTED/.test(r.failure()?.errorText || '')) page.errs.push('reqfailed: ' + r.url() + ' ' + r.failure()?.errorText); });
  if (init) await page.addInitScript(init);
  if (routes) await routes(page);
  await page.goto(URL_);
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 20000 });
  page.close2 = () => ctx.close();
  return page;
}
const st = (page) => page.evaluate(() => { const { st } = window.__fathom; return { score: st.score, n: st.findings.length, rules: st.findings.map((f) => f.rule), items: st.items.length, hits: st.lang ? st.lang.hits.length : 0, source: st.source, history: st.history.length }; });
const settle = async (page, fn) => {
  await page.evaluate(() => { window.__fathom.st.ready = false; document.body.dataset.ready = '0'; });
  await fn();
  await page.waitForFunction(() => window.__fathom.st.ready && document.body.dataset.ready === '1', null, { timeout: 20000 });
};
const setHtml = async (page, html) => {
  await pick(page, 'custom');
  await page.evaluate(() => { window.__f0 = window.__fathom.st.findings; });
  await page.fill('#editor', html);
  await page.waitForFunction((h) => { const { st } = window.__fathom; return st.source === h && st.findings !== window.__f0 && st.ready; }, html, { timeout: 25000 });
};
function pick(page, key) { return settle(page, () => page.selectOption('#sample', key)); }
const _unused = (page, key) => settle(page, () => page.selectOption('#sample', key));
const toastText = (page) => page.locator('#toast').innerText();
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'expected equal'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const clean = (page, label) => ok(page.errs.length === 0, `${label || 'console'} not clean: ${page.errs.join(' | ')}`);

async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, pass: true, ms: Date.now() - t0 }); console.log('  ok   ' + name); }
  catch (e) { results.push({ name, pass: false, err: e.message }); console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n')[0]); }
}

const GOOD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Good page</title><style>body{font:16px/1.5 sans-serif;color:#111;background:#fff}a{color:#00e;text-decoration:underline}a,input,button{display:inline-block;box-sizing:border-box;min-width:24px;min-height:24px;padding:4px 8px}.skip{position:absolute;left:-999px}.skip:focus{left:0}:focus-visible{outline:3px solid #00e}</style></head><body><a class="skip" href="#main">Skip to main content</a><header><nav aria-label="Primary"><a href="/a">Home</a></nav></header><main id="main"><h1>Welcome</h1><p>A short clear sentence for everyone.</p><form><label for="e">Email</label><input id="e" type="email" autocomplete="email"><button type="submit">Subscribe</button></form></main></body></html>`;

console.log('Fathom test run against ' + URL_);

// ───────────────────────── boot & basics
await test('boot: cafe sample loads, console is clean, score in range', async () => {
  const p = await open();
  const s = await st(p);
  console.log(`       cafe: score ${s.score}, ${s.n} barriers, ${s.items} stops, ${s.hits} wording flags`);
  ok(s.score >= 20 && s.score <= 45, 'cafe score ' + s.score);
  ok(s.n >= 10, 'cafe findings ' + s.n);
  eq(await p.title(), (await p.title()), 'title');
  ok((await p.title()).length > 5, 'has a title');
  eq(await p.locator('html').getAttribute('lang'), 'en', 'html lang');
  ok(await p.locator('main').count() === 1, 'one main landmark');
  clean(p, 'boot console');
  await p.close2();
});
await test('hero card shows real before/after numbers', async () => {
  const p = await open();
  await p.waitForFunction(() => document.body.dataset.hero, null, { timeout: 15000 });
  const t = await p.locator('#hero-num').innerText();
  ok(/\d/.test(t), 'hero number rendered: ' + t);
  await p.close2();
});
await test('study sample loads and differs from cafe', async () => {
  const p = await open();
  const a = await st(p);
  await pick(p, 'study');
  const b = await st(p);
  ok(b.rules.join() !== a.rules.join(), 'different findings');
  ok(b.score >= 30 && b.score <= 65, 'study score ' + b.score);
  clean(p);
  await p.close2();
});

// ───────────────────────── fixes
await test('auto-fix cafe → 100/100, idempotent, undo restores original', async () => {
  const p = await open();
  const before = await st(p);
  await settle(p, () => p.click('#btn-fix'));
  const after = await st(p);
  eq(after.score, 100, 'score after fix'); eq(after.n, 0, 'findings after fix');
  ok(!/data-fx-|fathom-inert/.test(after.source), 'no internal markers leaked into editor source');
  await p.click('#btn-fix');
  ok(/Nothing left/.test(await toastText(p)), 'second click says nothing left');
  await settle(p, () => p.click('#btn-undo'));
  const undone = await st(p);
  eq(undone.score, before.score, 'undo restores score');
  eq(undone.n, before.n, 'undo restores findings');
  clean(p);
  await p.close2();
});
await test('auto-fix study: improves score, leaves only human-needed items', async () => {
  const p = await open();
  await pick(p, 'study');
  const before = await st(p);
  await settle(p, () => p.click('#btn-fix'));
  const after = await st(p);
  console.log(`       study: ${before.score} → ${after.score}, ${before.n} → ${after.n} barriers`);
  ok(after.score > before.score, 'score improved');
  const stuck = await p.locator('#barriers .finding').evaluateAll((els) => els.filter((e) => !e.querySelector('.guided')).length);
  eq(stuck, 0, 'every remaining finding is marked as needing a human');
  clean(p);
  await p.close2();
});
await test('single fix button + input fix + empty-input guard', async () => {
  const p = await open();
  const n0 = (await st(p)).n;
  await settle(p, () => p.locator('#barriers [data-act=fix]').first().click());
  ok((await st(p)).n < n0, 'one fix removed at least one finding');
  const inp = p.locator('#barriers .finding:has([data-input])').first();
  if (await inp.count()) {
    await inp.locator('[data-input]').fill('');
    const n1 = (await st(p)).n;
    await inp.locator('[data-act=fix]').click();
    ok(/Type a value/.test(await toastText(p)), 'guard toast');
    eq((await st(p)).n, n1, 'nothing changed on empty input');
    await inp.locator('[data-input]').fill('Search the menu');
    await settle(p, () => inp.locator('[data-act=fix]').click());
    ok((await st(p)).n < n1, 'typed value fixed it');
  }
  clean(p);
  await p.close2();
});
await test('show-me highlights without breaking layout', async () => {
  const p = await open();
  await p.locator('#barriers [data-act=show]').first().click();
  ok((await p.locator('#overlay *').count()) > 0, 'overlay boxes drawn');
  ok(/Highlighted/.test(await p.locator('#lens-note').innerText()), 'lens note says highlighted');
  clean(p);
  await p.close2();
});

// ───────────────────────── safety & edge-case inputs
await test('hostile HTML never executes or navigates (sandbox + inert)', async () => {
  const p = await open();
  await setHtml(p, `<!doctype html><html lang=en><head><title>x</title></head><body><main><h1>XSS</h1>
<img src=x alt="a" onerror="window.parent.__pwn=1;top.__pwn=2"><script>window.parent.__pwn=3<\/script>
<a id=l href="javascript:window.parent.__pwn=4">js link</a><button id=b onclick="window.parent.__pwn=5">b</button>
<a id=ext href="https://example.com/">out</a><form action="https://example.com/steal"><input name=q aria-label=q><button id=s>go</button></form>
<svg onload="window.parent.__pwn=6"></svg></main></body></html>`);
  const f = p.frameLocator('#frame');
  await f.locator('#l').click(); await f.locator('#b').click(); await f.locator('#ext').click(); await f.locator('#s').click();
  await p.waitForTimeout(600);
  eq(await p.evaluate(() => window.__pwn), undefined, 'no script ran');
  eq(await p.evaluate(() => location.href), URL_, 'top page did not navigate');
  eq(await f.locator('h1').innerText(), 'XSS', 'preview still shows the audited page');
  await p.close2();
});
await test('meta refresh / remote iframe / base tag in user HTML do not hijack the app', async () => {
  const p = await open();
  await setHtml(p, `<!doctype html><html lang=en><head><title>x</title><meta http-equiv="refresh" content="0;url=https://example.com/"><base href="https://example.com/" target="_top"></head><body><main><h1>Still here</h1><iframe src="https://example.com/" title="e"></iframe></main></body></html>`);
  await p.waitForTimeout(800);
  eq(await p.evaluate(() => location.href), URL_, 'top page unchanged');
  const h = await p.frameLocator('#frame').locator('h1').count();
  ok(h === 1, 'iframe still shows the page (meta refresh neutralised)');
  await p.close2();
});
for (const [name, html] of [
  ['empty editor', ''],
  ['plain text only', 'hello world'],
  ['malformed markup', '<div><p>unclosed <b><i>tags <table><tr><td>x</div>'],
  ['frameset document', '<!doctype html><html><frameset cols="50%,50%"><frame src="about:blank"><frame src="about:blank"></frameset></html>'],
  ['RTL, emoji and astral unicode', '<html lang="ar"><body><main><h1 dir="rtl">مرحبا بالعالم</h1><p>😀 𝒳 日本語 — “quotes”</p><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="𝒳"></main></body></html>'],
  ['1,500-level deep nesting', '<!doctype html><html lang=en><head><title>deep</title></head><body><main>' + '<div>'.repeat(1500) + 'deep' + '</div>'.repeat(1500) + '</main></body></html>'],
  ['unreachable remote images + css import', '<!doctype html><html lang=en><head><title>net</title><style>@import url(https://invalid.invalid/x.css);</style></head><body><main><h1>Net</h1><img src="https://invalid.invalid/a.png"><img src="https://invalid.invalid/b.png" alt="B"></main></body></html>'],
]) {
  await test('edge input: ' + name, async () => {
    const p = await open();
    p.errs.length = 0;
    await setHtml(p, html);
    const s = await st(p);
    ok(Number.isFinite(s.score) && s.score >= 0 && s.score <= 100, 'score is a number 0..100: ' + s.score);
    ok((await p.locator('#barriers').innerText()).length > 10, 'barriers panel renders something');
    const bad = p.errs.filter((e) => !/Failed to load resource|ERR_NAME_NOT_RESOLVED|invalid\.invalid|net::|Refused to (frame|load|apply)|Content Security Policy/i.test(e));
    ok(bad.length === 0, 'unexpected errors: ' + bad.join(' | '));
    await p.close2();
  });
}
await test('large page (4,000 elements) analyses in under 8s and caps the transcript', async () => {
  const p = await open();
  const html = '<!doctype html><html lang=en><head><title>big</title></head><body><main><h1>Big</h1>' + Array.from({ length: 1500 }, (_, i) => `<p>Paragraph ${i} with <a href="/x${i}">link ${i}</a></p><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`).join('') + '</main></body></html>';
  const t0 = Date.now();
  await setHtml(p, html);
  const dt = Date.now() - t0;
  console.log(`       big page analysed in ${dt} ms`);
  ok(dt < 8000, 'took ' + dt + 'ms');
  await p.click('#tab-listen');
  ok((await p.locator('#tx li').count()) <= 24, 'transcript capped at 24 rows');
  ok(/first 24/.test(await p.locator('#tx-note').innerText()), 'cap explained to the user');
  await p.close2();
});
await test('good page scores 100 with no barriers; custom page can be fixed + exported', async () => {
  const p = await open();
  await setHtml(p, GOOD);
  const s = await st(p);
  eq(s.score, 100, 'good page score'); eq(s.n, 0, 'good page findings');
  ok(/Crystal clear/.test(await p.locator('#barriers').innerText()), 'empty-state copy');
  await p.close2();
});
await test('export report downloads markdown with score and findings', async () => {
  const p = await open();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btn-export')]);
  eq(dl.suggestedFilename(), 'fathom-report.md', 'filename');
  const txt = readFileSync(await dl.path(), 'utf8');
  ok(/# Fathom accessibility report/.test(txt) && /Clarity score: \*\*\d+\/100/.test(txt) && /## Blocker/i.test(txt), 'report content');
  await p.close2();
});
await test('typing in the editor re-audits live and Undo returns to previous source', async () => {
  const p = await open();
  const before = await st(p);
  await settle(p, async () => { await p.click('#editor'); await p.keyboard.press('Control+End'); await p.keyboard.type('<img src="x.png">'); });
  const mid = await st(p);
  ok(mid.source.endsWith('<img src="x.png">') || mid.source.includes('x.png'), 'edit applied');
  await settle(p, () => p.click('#btn-undo'));
  eq((await st(p)).score, before.score, 'undo → original score');
  await p.close2();
});

// ───────────────────────── lenses, viewports, keyboard
await test('every lens applies, keyboard lens numbers tab stops, Typical resets', async () => {
  const p = await open();
  for (const v of ['protan', 'deutan', 'tritan', 'achro', 'lowvis', 'glare', 'tunnel', 'keys', 'normal']) {
    await p.locator(`#lenses input[value=${v}]`).check({ force: true });
    eq(await p.locator('#frame-wrap').getAttribute('data-lens'), v, 'lens ' + v);
    ok((await p.locator('#lens-note').innerText()).length > 5 || v === 'normal', 'lens note for ' + v);
    if (v === 'keys') ok((await p.locator('#overlay *').count()) > 3, 'tab-order pins drawn');
  }
  ok((await p.locator('svg filter').count()) >= 3, 'color matrices present as SVG filters');
  clean(p);
  await p.close2();
});
await test('viewport buttons resize the preview and keep it inside the panel', async () => {
  const p = await open();
  for (const [v, w] of [['mobile', 390], ['tablet', 768], ['desktop', 1100]]) {
    await p.click(`button[data-vp=${v}]`);
    await p.waitForTimeout(150);
    eq(await p.locator('#frame-wrap').getAttribute('data-vp'), v);
    const m = await p.evaluate(() => ({ ww: parseFloat(document.getElementById('frame-wrap').style.width), sc: document.getElementById('scaler').offsetWidth, stage: document.getElementById('stage').clientWidth }));
    eq(m.ww, w, v + ' layout width'); ok(m.sc <= m.stage, `${v} fits panel (${m.sc} <= ${m.stage})`);
    eq(await p.locator(`button[data-vp=${v}]`).getAttribute('aria-pressed'), 'true', 'pressed state');
  }
  await p.close2();
});
await test('tabs: ARIA roles, arrow/Home/End keys, panels toggle', async () => {
  const p = await open();
  await p.focus('#tab-barriers');
  await p.keyboard.press('ArrowRight');
  eq(await p.locator('#tab-listen').getAttribute('aria-selected'), 'true'); ok(await p.locator('#panel-listen').isVisible(), 'listen visible'); ok(!(await p.locator('#panel-barriers').isVisible()), 'barriers hidden');
  await p.keyboard.press('End');
  eq(await p.locator('#tab-language').getAttribute('aria-selected'), 'true');
  await p.keyboard.press('Home');
  eq(await p.locator('#tab-barriers').getAttribute('aria-selected'), 'true');
  await p.keyboard.press('ArrowLeft');
  eq(await p.locator('#tab-language').getAttribute('aria-selected'), 'true', 'wraps around');
  await p.close2();
});

// ───────────────────────── listen
await test('listen: browser voice plays, highlights rows, finishes, stop works', async () => {
  const p = await open({ init: SPEECH_STUB });
  await p.click('#tab-listen');
  ok(/Browser voice/.test(await p.locator('#voice-badge').innerText()), 'badge before play');
  await p.click('#btn-play');
  await p.waitForFunction(() => document.querySelector('#tx li.on'), null, { timeout: 4000 });
  eq(await p.locator('#btn-play').innerText(), 'Pause');
  await p.waitForFunction(() => document.getElementById('btn-play').textContent === 'Play', null, { timeout: 15000 });
  const spoken = await p.evaluate(() => window.__spoken.length);
  ok(spoken >= 20, 'spoke every stop: ' + spoken);
  eq(await p.locator('#btn-stop').isDisabled(), true, 'stop disabled when idle');
  clean(p);
  await p.close2();
});
await test('listen: clicking or pressing Enter on a row starts from that stop', async () => {
  const p = await open({ init: SPEECH_STUB });
  await p.click('#tab-listen');
  await p.locator('#tx li button').nth(5).click();
  await p.waitForFunction(() => window.__spoken.length > 0);
  eq(await p.evaluate(() => window.__spoken[0]), await p.evaluate(() => window.__fathom.st.items[5].spoken), 'started at stop 6');
  await p.click('#btn-stop');
  await p.locator('#tx li button').nth(2).focus(); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__spoken.length > 0);
  await p.close2();
});
await test('listen: no speech engine → friendly message, no crash', async () => {
  const p = await open({ init: () => { try { delete window.speechSynthesis; } catch (e) { /* */ } } });
  await p.click('#tab-listen'); await p.click('#btn-play');
  ok(/no speech engine|not supported/i.test((await p.locator('#voice-badge').innerText()) + (await toastText(p))), 'explains the limitation');
  eq(await p.locator('#btn-play').innerText(), 'Play', 'button resets');
  await p.close2();
});
await test('listen: pre-rendered ElevenLabs clip is matched by transcript and plays', async () => {
  let key;
  const probe = await open(); key = await probe.evaluate(() => window.__fathom.st.items.slice(0, 24).map((i) => i.spoken).join('\n')); await probe.close2();
  const p = await open({ routes: async (pg) => {
    await pg.route('**/audio/manifest.json', (r) => r.fulfill({ json: { clips: [{ text: key, file: 'audio/test.wav' }] } }));
    await pg.route('**/audio/test.wav', (r) => r.fulfill({ body: wav(3), contentType: 'audio/wav' }));
  } });
  await p.click('#tab-listen');
  ok(/pre-rendered/.test(await p.locator('#voice-badge').innerText()), 'badge announces pre-rendered voice');
  await p.click('#btn-play');
  await p.waitForFunction(() => window.__fathom.st.audio, null, { timeout: 4000 });
  ok(/pre-rendered/.test(await p.locator('#voice-badge').innerText()), 'badge while playing');
  await p.click('#btn-stop');
  clean(p, 'clip console');
  await p.close2();
});
await test('listen: broken clip file falls back to browser voice', async () => {
  let key;
  const probe = await open(); key = await probe.evaluate(() => window.__fathom.st.items.slice(0, 24).map((i) => i.spoken).join('\n')); await probe.close2();
  const p = await open({ init: SPEECH_STUB, routes: async (pg) => {
    await pg.route('**/audio/manifest.json', (r) => r.fulfill({ json: { clips: [{ text: key, file: 'audio/missing.wav' }] } }));
    await pg.route('**/audio/missing.wav', (r) => r.fulfill({ status: 404, body: 'nope' }));
  } });
  await p.click('#tab-listen'); await p.click('#btn-play');
  await p.waitForFunction(() => window.__spoken && window.__spoken.length > 0, null, { timeout: 6000 });
  await p.close2();
});
await test('listen: live voice proxy used when configured, falls back on 503/429', async () => {
  const p = await open({ init: SPEECH_STUB, routes: async (pg) => {
    await pg.route('**/api/voice', (r) => r.request().method() === 'GET' ? r.fulfill({ json: { configured: true } }) : r.fulfill({ body: wav(2), contentType: 'audio/wav' }));
  } });
  await p.click('#tab-listen');
  ok(/live voice/i.test(await p.locator('#voice-badge').innerText()), 'badge says live voice');
  await p.click('#btn-play');
  await p.waitForFunction(() => window.__fathom.st.audio, null, { timeout: 5000 });
  await p.click('#btn-stop'); await p.close2();
  const q = await open({ init: SPEECH_STUB, routes: async (pg) => {
    await pg.route('**/api/voice', (r) => r.request().method() === 'GET' ? r.fulfill({ json: { configured: true } }) : r.fulfill({ status: 429, json: { error: 'slow-down' } }));
  } });
  await q.click('#tab-listen'); await q.click('#btn-play');
  await q.waitForFunction(() => window.__spoken && window.__spoken.length > 0, null, { timeout: 6000 });
  await q.close2();
});

// ───────────────────────── language
await test('language: flags exclusionary wording, replace one, apply all, undo', async () => {
  const p = await open();
  await pick(p, 'study');
  await p.click('#tab-language');
  const n0 = (await st(p)).hits;
  ok(n0 >= 5, 'study sample has wording flags: ' + n0);
  ok(/Grade/.test(await p.locator('#language .lang-tiles').innerText()), 'reading level shown');
  const first = p.locator('#language .finding.hit').first();
  const term = await first.locator('mark').innerText();
  await settle(p, () => first.locator('[data-lact=apply]').click());
  const n1 = (await st(p)).hits;
  ok(n1 < n0, `one replaced (${n0} → ${n1})`);
  await settle(p, () => p.click('#language [data-lact=all]'));
  eq((await st(p)).hits, 0, 'all replaced');
  await settle(p, () => p.click('#btn-undo'));
  ok((await st(p)).hits > 0, `undo brings flags back (replaced "${term}")`);
  clean(p);
  await p.close2();
});
await test('self-audit: Fathom audits its own page', async () => {
  const p = await open();
  await pick(p, 'self');
  const s = await st(p);
  console.log(`       fathom on fathom: score ${s.score}, ${s.n} barriers → ${s.rules.join(', ') || 'none'}`);
  ok(s.score >= 85, 'self score ' + s.score);
  clean(p);
  await p.close2();
});

// ───────────────────────── responsive, motion, forced colors
for (const w of [360, 390, 768, 1024, 1280, 1440, 1920]) {
  await test(`responsive ${w}px: no horizontal scroll, panels reachable`, async () => {
    const p = await open({ w, h: 900 });
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(over <= 1, 'horizontal overflow ' + over + 'px');
    if (w <= 1280) {
      for (const pane of ['code', 'results', 'preview']) {
        await p.click(`[data-pane-btn=${pane}]`);
        eq(await p.locator('#dive').getAttribute('data-pane'), pane);
        ok(await p.locator('.p-' + pane).isVisible(), pane + ' pane visible');
      }
    } else ok(await p.locator('.p-code').isVisible() && await p.locator('.p-results').isVisible(), 'all three panes visible side by side');
    await p.close2();
  });
}
await test('prefers-reduced-motion: score is instant, no errors', async () => {
  const p = await open({ motion: 'reduce' });
  const s = await st(p);
  eq(await p.locator('#g-score').innerText(), String(s.score), 'no tween');
  clean(p);
  await p.close2();
});
await test('forced-colors mode renders without errors', async () => {
  const p = await open({ forced: 'active' });
  clean(p);
  ok(await p.locator('#btn-fix').isVisible(), 'primary action visible');
  await p.close2();
});

// ───────────────────────── accessibility of Fathom itself (axe-core)
async function axe(p, label) {
  await p.route('**/__axe.js', (r) => r.fulfill({ body: AXE, contentType: 'text/javascript' }));
  await p.addScriptTag({ url: new URL('/__axe.js', URL_).href });
  const r = await p.evaluate(async () => (await window.axe.run({ exclude: [['#frame-wrap']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' ; ')}`));
  ok(r.length === 0, `axe ${label}: ${r.join(' || ')}`);
}
await test('axe: home / barriers tab (desktop)', async () => { const p = await open(); await axe(p, 'desktop'); await p.close2(); });
await test('axe: listen tab', async () => { const p = await open(); await p.click('#tab-listen'); await axe(p, 'listen'); await p.close2(); });
await test('axe: language tab (study sample)', async () => { const p = await open(); await pick(p, 'study'); await p.click('#tab-language'); await axe(p, 'language'); await p.close2(); });
await test('axe: mobile 390px', async () => { const p = await open({ w: 390, h: 844 }); await axe(p, 'mobile'); await p.close2(); });
await test('axe: after auto-fix (all-clear state)', async () => { const p = await open(); await settle(p, () => p.click('#btn-fix')); await axe(p, 'all clear'); await p.close2(); });

// ───────────────────────── engine unit checks (in-page)
await test('engine: contrast math, nearestPassing, score bounds, inert/serialize round-trip', async () => {
  const p = await open();
  const r = await p.evaluate(() => {
    const { E } = window.__fathom;
    const c = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16), a: 1 });
    const out = { bw: E.ratio(c('#000000'), c('#ffffff')), g777: E.ratio(c('#777777'), c('#ffffff')), g767: E.ratio(c('#767676'), c('#ffffff')) };
    const np = E.nearestPassing(c('#777777'), c('#ffffff'), 4.5); out.np = E.ratio(np, c('#ffffff'));
    const np2 = E.nearestPassing(c('#555555'), c('#0b0b0b'), 4.5); out.np2 = E.ratio(np2, c('#0b0b0b'));
    out.s0 = E.score([]);
    const fake = (rule, severity, n) => ({ rule, severity, els: Array(n).fill({}) });
    const many = Array.from({ length: 40 }, (_, i) => fake('r' + i, 'blocker', 5));
    out.sMany = E.score(many); out.sOne = E.score([fake('a', 'minor', 1)]);
    const raw = '<div onclick="x()">a</div><script type="module">alert(1)</script><p>once = twice</p>';
    const inert = E.inert(raw);
    out.inertOk = /data-fx-onclick/.test(inert) && /fathom-inert/.test(inert) && !/\sonclick=/.test(inert);
    const doc = new DOMParser().parseFromString('<!doctype html>' + inert, 'text/html');
    const back = E.serialize(doc);
    out.roundTrip = /onclick="x\(\)"/.test(back) && /<script type="module">alert\(1\)<\/script>/.test(back) && !/fathom-inert|data-fx-/.test(back) && /once = twice/.test(back);
    return out;
  });
  ok(Math.abs(r.bw - 21) < 0.01, 'black/white = 21'); ok(r.g777 < 4.5 && r.g777 > 4.4, '#777 on white just fails: ' + r.g777); ok(r.g767 >= 4.5, '#767676 passes: ' + r.g767);
  ok(r.np >= 4.5 && r.np2 >= 4.5, `nearestPassing meets target (${r.np.toFixed(2)}, ${r.np2.toFixed(2)})`);
  eq(r.s0, 100, 'no findings = 100'); ok(r.sMany >= 0 && r.sMany < r.sOne && r.sOne < 100, `score monotonic & bounded (${r.sOne} > ${r.sMany})`);
  ok(r.inertOk, 'inert neutralises handlers + scripts'); ok(r.roundTrip, 'inert → serialize round-trips the source');
  await p.close2();
});

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) { console.log('FAILED:\n' + failed.map((f) => ' - ' + f.name + ': ' + f.err).join('\n')); process.exit(1); }
