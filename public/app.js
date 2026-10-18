import * as E from './engine.js';
import { SAMPLES, BLANK } from './samples.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX_STOPS = 24;

const st = {
  key: 'cafe', source: '', history: [], findings: [], items: [], lang: null, score: 0, shownScore: 0,
  lens: 'normal', vp: 'desktop', clips: [], live: false, audio: null, speech: { playing: false, idx: -1 }, hl: [], tab: 'barriers', ready: false,
};
const frame = $('#frame');
const editor = $('#editor');
const wrap = $('#frame-wrap');
const stage = $('#stage');
const scaler = $('#scaler');
const VPW = { mobile: 390, tablet: 768, desktop: 1100 };
const overlay = $('#overlay');

/* ---------- utilities ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 3600);
}
const frameDoc = () => frame.contentDocument;
const sevLabel = (s) => E.SEV[s].label;
function whenImages(doc, ms = 1600) {
  const imgs = [...doc.images].filter((i) => !i.complete);
  if (!imgs.length) return Promise.resolve();
  return Promise.race([
    Promise.all(imgs.map((i) => new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); }))),
    new Promise((r) => setTimeout(r, ms)),
  ]);
}

/* ---------- loading & analysis ---------- */
let loadSeq = 0;
function loadSource(src, { resetHistory = false } = {}) {
  if (resetHistory) { st.history = []; $('#btn-undo').disabled = true; }
  st.source = src;
  if (editor.value !== src) editor.value = src;
  $('#editor-meta').textContent = `${src.split('\n').length} lines`;
  stopSpeech();
  st.hl = [];
  const seq = ++loadSeq;
  frame.dataset.seq = seq;
  frame.srcdoc = E.inert(src);
}
frame.addEventListener('load', async () => {
  const doc = frameDoc();
  if (!doc || !doc.body) return;
  const seq = +frame.dataset.seq;
  try { await whenImages(doc); } catch (e) { /* ignore */ }
  if (seq !== loadSeq) return;
  guardFrame(doc);
  relayout(false);
  analyze();
});
// Links and forms inside the preview must never navigate the iframe away from the audited page.
function guardFrame(doc) {
  doc.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    e.preventDefault();
    const h = a.getAttribute('href') || '';
    if (h.startsWith('#') && h.length > 1) {
      const t = doc.getElementById(h.slice(1));
      if (t) stage.scrollTo({ top: Math.max(0, scaler.offsetTop + t.getBoundingClientRect().top * (st.scale || 1) - 20), behavior: reduce ? 'auto' : 'smooth' });
    }
  });
  doc.addEventListener('submit', (e) => e.preventDefault());
}
function relayout(analyzeAfter = true) {
  const doc = frameDoc();
  if (!doc || !doc.documentElement) return;
  frame.style.height = '480px';
  const h = Math.min(7000, Math.max(480, doc.documentElement.scrollHeight));
  frame.style.height = h + 'px';
  applyScale();
  if (analyzeAfter) analyze();
}
// The page is laid out at a real device width, then scaled down to fit the panel.
function applyScale() {
  const W = VPW[st.vp];
  const avail = Math.max(240, stage.clientWidth - 28);
  const s = Math.min(1, avail / W);
  wrap.style.width = W + 'px';
  wrap.style.setProperty('--s', s);
  wrap.style.transform = `scale(${s})`;
  scaler.style.width = Math.round(W * s) + 'px';
  scaler.style.height = Math.round(frame.offsetHeight * s) + 'px';
  st.scale = s;
}
function analyze() {
  const doc = frameDoc();
  if (!doc || !doc.body) return;
  try {
    st.findings = E.audit(doc);
    st.items = E.transcript(doc);
    st.lang = E.languageScan(doc);
    st.score = E.score(st.findings);
  } catch (err) {
    console.error('Audit failed', err);
    toast('Something in that HTML could not be analyzed. Try simplifying it.');
    return;
  }
  st.ready = true;
  renderSummary();
  renderBarriers();
  renderListen();
  renderLanguage();
  drawOverlay();
  document.body.dataset.ready = '1';
}

/* ---------- summary ---------- */
function tween(from, to, ms, cb) {
  if (reduce || from === to) { cb(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - (1 - k) ** 3;
    cb(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const gaugeColor = (s) => (s >= 90 ? 'var(--foam)' : s >= 70 ? 'var(--sky)' : s >= 45 ? 'var(--amber)' : 'var(--coral)');
function renderSummary() {
  const s = st.score;
  const arc = $('#g-arc');
  arc.style.stroke = gaugeColor(s);
  arc.setAttribute('stroke-dasharray', `${s} 100`);
  tween(st.shownScore, s, 900, (v) => { $('#g-score').textContent = v; });
  st.shownScore = s;
  $('#g-tier').textContent = E.tier(s);
  $('#gauge').setAttribute('aria-label', `Clarity score ${s} out of 100, ${E.tier(s)}`);
  const by = { blocker: 0, serious: 0, moderate: 0, minor: 0 };
  st.findings.forEach((f) => { by[f.severity]++; });
  $('#counts').innerHTML = Object.entries(by).map(([k, n]) => `<li class="sev-${k}"><b>${n}</b>${sevLabel(k)}</li>`).join('');
  const total = st.findings.length;
  $('#sum-line').textContent = total ? `Clarity ${s} of 100, ${E.tier(s)}. ${total} barrier${total === 1 ? '' : 's'} found.` : `Clarity ${s} of 100, ${E.tier(s)}. No automated barriers found.`;
  $('#n-barriers').textContent = total;
  $('#n-language').textContent = st.lang ? st.lang.hits.length : 0;
  const load = E.personaLoad(st.findings);
  $('#personas').innerHTML = load.map((p) => `<li><span>${esc(p.label)}</span><span class="bar" role="presentation"><i style="width:${Math.round(p.pct * 100)}%"></i></span><span>${p.value}</span></li>`).join('');
}

/* ---------- barriers ---------- */
function findingCard(f) {
  const fx = f.fix;
  let action = '';
  if (fx) {
    if (fx.kind === 'input') {
      action = `<label class="sr" for="in-${f.id}">${esc(fx.label)}</label><input type="text" id="in-${f.id}" value="${esc(fx.suggest)}" placeholder="${esc(fx.placeholder || '')}" data-input><button class="btn primary mini" data-act="fix" type="button">Apply fix</button>`;
    } else if (fx.kind === 'auto') {
      action = `<button class="btn primary mini" data-act="fix" type="button">Fix: ${esc(fx.label)}</button>`;
    } else {
      action = `<p class="guided"><b>Needs a human:</b> ${esc(fx.label)}</p>`;
    }
  }
  const sw = f.fix?.swatch ? `<span class="swatches" aria-label="from ${f.fix.swatch[0]} to ${f.fix.swatch[1]} on ${f.fix.swatch[2]}"><i style="background:${f.fix.swatch[0]}"></i>→<i style="background:${f.fix.swatch[1]}"></i></span>` : '';
  return `<article class="finding sev-${f.severity}" data-id="${f.id}">
    <div class="f-top"><h4 class="f-title">${esc(f.title)}</h4><span class="sev">${sevLabel(f.severity)}</span></div>
    <p class="f-meta"><span><b>WCAG</b> ${f.wcag} (${f.level})</span><span><b>Affects</b> ${f.personas.map((p) => esc(E.PERSONAS[p])).join(', ')}</span><span class="muted">${esc(f.selector)}</span></p>
    <code class="f-code">${esc(f.snippet)}</code>
    ${f.detail ? `<p class="f-detail">${esc(f.detail)}${sw}</p>` : ''}
    <details class="f-why"><summary>Why it matters and how to fix it</summary><p>${esc(f.why)}</p><p><b>How:</b> ${esc(f.how)}</p></details>
    <div class="f-actions"><button class="btn ghost mini" data-act="show" type="button">Show me</button>${action}</div>
  </article>`;
}
function renderBarriers() {
  const box = $('#barriers');
  if (!st.findings.length) {
    box.innerHTML = `<div class="empty"><b>Crystal clear.</b>Fathom found no automated barriers in this page. Automated checks catch about a third of issues, so try the Listen tab and the lenses, then test with real assistive technology.</div>`;
    return;
  }
  box.innerHTML = st.findings.map(findingCard).join('');
}
$('#barriers').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const card = btn.closest('.finding');
  const f = st.findings.find((x) => x.id === card.dataset.id);
  if (!f) return;
  if (btn.dataset.act === 'show') {
    showEls(f.els, f.title);
  } else if (btn.dataset.act === 'fix') {
    const doc = frameDoc();
    try {
      if (f.fix.kind === 'input') {
        const v = $('[data-input]', card).value.trim();
        if (!v) { toast('Type a value first'); $('[data-input]', card).focus(); return; }
        f.fix.run(doc, v);
      } else f.fix.run(doc);
    } catch (err) { console.error(err); toast('That fix could not be applied automatically.'); return; }
    commit(`Fixed: ${f.title}`);
  }
});
function showEls(els, label) {
  if (window.matchMedia('(max-width:1280px)').matches) setPane('preview');
  st.hl = els.slice(0, 14);
  drawOverlay();
  const r = els[0].getBoundingClientRect();
  const top = scaler.offsetTop + r.top * (st.scale || 1) - 90;
  stage.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
  $('#lens-note').textContent = `Highlighted: ${label}`;
}

/* ---------- commit / undo ---------- */
function commit(msg) {
  const doc = frameDoc();
  const html = E.serialize(doc);
  st.history.push(st.source);
  $('#btn-undo').disabled = false;
  loadSource(html);
  if (msg) toast(msg);
}
$('#btn-undo').addEventListener('click', () => {
  const prev = st.history.pop();
  if (prev === undefined) return;
  $('#btn-undo').disabled = st.history.length === 0;
  loadSource(prev);
  toast('Undone');
});
$('#btn-fix').addEventListener('click', () => {
  if (!st.findings.length) { toast('Nothing left to fix automatically'); return; }
  const doc = frameDoc();
  const before = st.score;
  const { applied, manual } = E.applyFixes(doc, st.findings);
  if (!applied) { toast(`Nothing safe to apply automatically. ${manual} need a human.`); return; }
  commit(`Applied ${applied} fix${applied === 1 ? '' : 'es'}${manual ? `. ${manual} need a human.` : '.'}`);
  st.beforeFix = before;
});

/* ---------- lenses ---------- */
const LENS_NOTES = {
  normal: '',
  protan: 'Protanopia: no working red cones. Reds look dark and greens turn muddy yellow. About 1% of men.',
  deutan: 'Deuteranopia: no working green cones, the most common type. Red and green blur together. About 1% of men.',
  tritan: 'Tritanopia: blue and yellow are hard to tell apart. Rare, but real.',
  achro: 'No color at all. Also how your page looks on a monochrome display, in print, or in a strong night mode.',
  lowvis: 'Blur and reduced contrast, like uncorrected vision. Thin or pale text disappears first.',
  glare: 'Glare washes out contrast, like bright sun on a phone or cataracts. Low-contrast text vanishes.',
  tunnel: 'Tunnel vision: only a small area is visible at a time. Move your pointer over the page to look around.',
  keys: '',
};
$('#lenses').addEventListener('change', (e) => {
  if (e.target.name !== 'lens') return;
  setLens(e.target.value);
});
function setLens(l) {
  st.lens = l;
  wrap.dataset.lens = l;
  st.hl = [];
  $('#lens-note').textContent = LENS_NOTES[l] || '';
  drawOverlay();
}
stage.addEventListener('pointermove', (e) => {
  if (st.lens !== 'tunnel') return;
  const r = wrap.getBoundingClientRect();
  wrap.style.setProperty('--tx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
  wrap.style.setProperty('--ty', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  const t = $('.tunnel', wrap);
  t.style.setProperty('--tx', wrap.style.getPropertyValue('--tx'));
  t.style.setProperty('--ty', wrap.style.getPropertyValue('--ty'));
});
function drawOverlay() {
  overlay.innerHTML = '';
  const doc = frameDoc();
  if (!doc || !doc.body) return;
  const frag = document.createDocumentFragment();
  if (st.lens === 'keys') {
    const { stops, unreachable } = E.tabStops(doc);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'path-line');
    svg.setAttribute('width', wrap.clientWidth);
    svg.setAttribute('height', frame.clientHeight);
    const pts = stops.map((el) => { const r = el.getBoundingClientRect(); return [r.left + Math.min(14, r.width / 2), r.top + Math.min(12, r.height / 2)]; });
    if (pts.length > 1) {
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pl.setAttribute('points', pts.map((p) => p.join(',')).join(' '));
      pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', 'rgba(94,230,200,.55)'); pl.setAttribute('stroke-width', '2'); pl.setAttribute('stroke-dasharray', '6 6');
      svg.appendChild(pl);
    }
    frag.appendChild(svg);
    stops.forEach((el, i) => {
      const p = pts[i];
      const pin = document.createElement('span');
      pin.className = 'pin';
      const bad = parseInt(el.getAttribute('tabindex') || '0', 10) > 0;
      if (bad) pin.classList.add('flag');
      pin.textContent = i + 1;
      pin.style.left = p[0] + 'px'; pin.style.top = p[1] + 'px';
      frag.appendChild(pin);
    });
    unreachable.slice(0, 20).forEach((el) => {
      const r = el.getBoundingClientRect();
      const b = document.createElement('div');
      b.className = 'ring dash';
      b.style.cssText = `left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px`;
      frag.appendChild(b);
    });
    $('#lens-note').textContent = `${stops.length} tab stops in this order.${unreachable.length ? ` ${unreachable.length} clickable element${unreachable.length > 1 ? 's' : ''} (dashed red) can never be reached with a keyboard.` : ' Everything clickable is reachable.'}${stops.some((e) => parseInt(e.getAttribute('tabindex') || '0', 10) > 0) ? ' Red pins use a positive tabindex that jumps the queue.' : ''}`;
  }
  st.hl.forEach((el) => {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const b = document.createElement('div');
    b.className = 'ring';
    b.style.cssText = `left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;height:${r.height + 8}px`;
    frag.appendChild(b);
  });
  overlay.appendChild(frag);
}

/* ---------- preview width ---------- */
$$('[data-vp]').forEach((b) => b.addEventListener('click', () => {
  st.vp = b.dataset.vp;
  $$('[data-vp]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  wrap.dataset.vp = st.vp;
  applyScale();
  relayout(true);
}));
let rz;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => st.ready && relayout(true), 250); });

/* ---------- tabs ---------- */
const tabs = $$('[role=tab]');
function setTab(id) {
  st.tab = id;
  tabs.forEach((t) => {
    const on = t.id === 'tab-' + id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  });
}
tabs.forEach((t) => {
  t.addEventListener('click', () => setTab(t.id.replace('tab-', '')));
  t.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(t);
    let n = null;
    if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
    if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
    if (e.key === 'Home') n = tabs[0];
    if (e.key === 'End') n = tabs[tabs.length - 1];
    if (n) { e.preventDefault(); n.focus(); setTab(n.id.replace('tab-', '')); }
  });
});

/* ---------- small-screen panes ---------- */
function setPane(p) {
  $('#dive').dataset.pane = p;
  $$('[data-pane-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.paneBtn === p)));
  if (p === 'preview') requestAnimationFrame(() => { applyScale(); drawOverlay(); });
}
$$('[data-pane-btn]').forEach((b) => b.addEventListener('click', () => setPane(b.dataset.paneBtn)));

/* ---------- listen ---------- */
const spoken = () => st.items.slice(0, MAX_STOPS);
function renderListen() {
  const items = spoken();
  $('#tx').innerHTML = items.map((it, i) => `<li data-i="${i}" class="${it.bad ? 'bad' : ''}"><button type="button"><span class="role">${esc(it.kind === 'field' ? 'form' : it.kind)}</span>${esc(it.spoken)}${it.bad ? `<span class="why">⚠ ${esc(it.note)}</span>` : ''}</button></li>`).join('');
  const bad = items.filter((i) => i.bad).length;
  $('#tx-note').textContent = st.items.length > MAX_STOPS
    ? `Reading the first ${MAX_STOPS} of ${st.items.length} stops. ${bad} of them contain a barrier. This simulation reads the accessibility tree the way NVDA or VoiceOver would, but real screen readers differ in detail.`
    : `${st.items.length} stops, ${bad} with a barrier. This is a simulation of what NVDA or VoiceOver would announce; real screen readers differ in detail.`;
  const clip = findClip(items);
  setBadge(clip ? 'ElevenLabs voice ready (pre-rendered)' : st.live ? 'ElevenLabs live voice ready' : 'Browser voice (add an ElevenLabs key on the server for live human voices)', clip || st.live);
}
function setBadge(text, eleven) {
  $('#voice-badge').innerHTML = `${eleven ? '🎙️ ' : ''}<b>${esc(text)}</b>`;
}
function findClip(items) {
  const key = items.map((i) => i.spoken).join('\n');
  return st.clips.find((c) => c.text === key) || null;
}
$('#tx').addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) play(+li.dataset.i); });
$('#btn-play').addEventListener('click', () => (st.speech.playing ? pauseToggle() : play(0)));
$('#btn-stop').addEventListener('click', stopSpeech);
function markRow(i) {
  st.speech.idx = i;
  $$('#tx li').forEach((li) => li.classList.toggle('on', +li.dataset.i === i));
  const li = $(`#tx li[data-i="${i}"]`);
  if (li) li.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  const it = st.items[i];
  st.hl = it && it.el && it.el.getBoundingClientRect ? [it.el] : [];
  drawOverlay();
}
function setPlaying(on) {
  st.speech.playing = on;
  $('#btn-play').textContent = on ? 'Pause' : 'Play';
  $('#btn-stop').disabled = !on;
}
function stopSpeech() {
  try { speechSynthesis.cancel(); } catch (e) { /* unsupported */ }
  if (st.audio) { st.audio.pause(); st.audio = null; }
  setPlaying(false);
  st.speech.idx = -1;
  $$('#tx li.on').forEach((l) => l.classList.remove('on'));
  if (st.tab === 'listen') { st.hl = []; drawOverlay(); }
}
function pauseToggle() {
  if (st.audio) { st.audio.pause(); setPlaying(false); $('#btn-play').textContent = 'Resume'; $('#btn-play').onclick = () => { st.audio.play(); setPlaying(true); $('#btn-play').onclick = null; }; return; }
  stopSpeech();
}
function weights(items) {
  const w = items.map((i) => i.spoken.length + 9);
  const tot = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return w.map((x) => { const s = acc / tot; acc += x; return s; });
}
async function play(start = 0) {
  stopSpeech();
  const items = spoken();
  if (!items.length) { toast('Nothing to read yet'); return; }
  const clip = findClip(items);
  setPlaying(true);
  if (clip) { playAudio(clip.file, items, start, 'ElevenLabs voice · pre-rendered'); return; }
  if (st.live) {
    try {
      const text = items.map((i) => i.spoken).join('\n').slice(0, 1400);
      const r = await fetch('/api/voice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!r.ok) throw new Error('voice ' + r.status);
      const url = URL.createObjectURL(await r.blob());
      playAudio(url, items, start, 'ElevenLabs voice · live');
      return;
    } catch (err) { console.warn('Live voice failed, using browser voice', err); st.live = false; }
  }
  playBrowser(items, start);
}
function playAudio(src, items, start, label) {
  const a = new Audio(src);
  st.audio = a;
  a.playbackRate = +$('#rate').value;
  const starts = weights(items);
  setBadge(label, true);
  a.addEventListener('loadedmetadata', () => { if (start > 0) a.currentTime = starts[start] * a.duration; });
  a.addEventListener('timeupdate', () => {
    if (!a.duration) return;
    const f = a.currentTime / a.duration;
    let idx = 0;
    for (let i = 0; i < starts.length; i++) if (f >= starts[i]) idx = i;
    if (idx !== st.speech.idx) markRow(idx);
  });
  a.addEventListener('ended', () => { st.audio = null; stopSpeech(); });
  a.addEventListener('error', () => { st.audio = null; playBrowser(items, start); });
  a.play().catch(() => { st.audio = null; playBrowser(items, start); });
}
function playBrowser(items, start) {
  if (!('speechSynthesis' in window)) { setBadge('This browser has no speech engine', false); setPlaying(false); toast('Speech is not supported in this browser. Try Chrome, Edge or Safari.'); return; }
  setBadge('Browser voice (fallback)', false);
  const synth = speechSynthesis;
  synth.cancel();
  const voices = synth.getVoices();
  const v = voices.find((x) => /^en/i.test(x.lang) && /natural|neural|aria|jenny|samantha|google us|daniel/i.test(x.name)) || voices.find((x) => /^en/i.test(x.lang));
  let i = start;
  const next = () => {
    if (!st.speech.playing || i >= items.length) { stopSpeech(); return; }
    const u = new SpeechSynthesisUtterance(items[i].spoken);
    u.rate = +$('#rate').value; u.lang = 'en-US'; if (v) u.voice = v;
    const my = i;
    u.onstart = () => markRow(my);
    u.onend = () => { i = my + 1; next(); };
    u.onerror = () => { i = my + 1; next(); };
    synth.speak(u);
  };
  next();
}
$('#rate').addEventListener('change', () => { if (st.audio) st.audio.playbackRate = +$('#rate').value; });

/* ---------- language ---------- */
function renderLanguage() {
  const L = st.lang;
  const box = $('#language');
  if (!L) { box.innerHTML = ''; return; }
  const ls = E.languageScore(L);
  const r = L.read;
  const gradeLabel = r ? (r.grade <= 8 ? 'Easy' : r.grade <= 12 ? 'Fairly hard' : 'Hard') : 'Not enough prose';
  const tiles = `<div class="lang-tiles">
    <div class="tile"><b>${ls}</b><span>Language score</span></div>
    <div class="tile"><b>${r ? 'Grade ' + r.grade.toFixed(1) : '–'}</b><span>Reading level · ${gradeLabel}</span></div>
    <div class="tile"><b>${r ? Math.round(r.wps) : '–'}</b><span>Words per sentence</span></div>
    <div class="tile"><b>${L.hits.length}</b><span>Wording flags</span></div></div>`;
  const hits = L.hits.map((h) => `<article class="finding hit sev-moderate" data-hid="${h.id}">
      <div class="f-top"><h4 class="f-title"><mark>${esc(h.term)}</mark> → <span class="rep">${esc(h.rep)}</span></h4><span class="sev">${esc(h.cat)}</span></div>
      <code class="f-code">…${esc(h.context)}…</code>
      <p class="f-why" style="margin-top:0">${esc(h.why)}</p>
      <div class="f-actions"><button class="btn ghost mini" data-lact="show" type="button">Show me</button>
      <label class="sr" for="r-${h.id}">Replacement</label><input type="text" id="r-${h.id}" value="${esc(h.rep)}" data-rin><button class="btn primary mini" data-lact="apply" type="button">Replace</button></div></article>`).join('');
  const long = L.longSentences.slice(0, 5).map((s) => `<article class="finding sev-minor"><div class="f-top"><h4 class="f-title">Long sentence (${s.split(' ').length} words)</h4><span class="sev">Readability</span></div><code class="f-code" style="white-space:normal">${esc(s.slice(0, 260))}${s.length > 260 ? '…' : ''}</code><p class="f-why" style="margin-top:0">Long sentences are harder to follow for people with dyslexia, ADHD, or who read English as a second language. Aim for under 20 words.</p></article>`).join('');
  const shout = L.shouting.slice(0, 3).map((e) => `<article class="finding sev-minor"><div class="f-top"><h4 class="f-title">ALL CAPS text</h4><span class="sev">Readability</span></div><code class="f-code">${esc(e.textContent.trim().slice(0, 100))}</code><p class="f-why" style="margin-top:0">Capitalized sentences are harder to read and some screen readers spell them out letter by letter.</p></article>`).join('');
  const apply = L.hits.length ? `<div class="f-actions" style="margin:0 0 10px"><button class="btn primary mini" data-lact="all" type="button">Apply all ${L.hits.length} suggestions</button></div>` : '';
  box.innerHTML = tiles + apply + (hits || '') + long + shout + (!hits && !long && !shout ? '<div class="empty"><b>Welcoming words.</b>No exclusionary wording or readability problems found in the text.</div>' : '');
}
$('#language').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-lact]');
  if (!btn || !st.lang) return;
  const doc = frameDoc();
  if (btn.dataset.lact === 'all') {
    const n = E.applyAllLanguage(st.lang.hits);
    commit(`Updated ${n} phrase${n === 1 ? '' : 's'} for inclusivity`);
    return;
  }
  const card = btn.closest('[data-hid]');
  const h = st.lang.hits.find((x) => x.id === card.dataset.hid);
  if (!h) return;
  if (btn.dataset.lact === 'show') { showEls([h.el], h.term); return; }
  const v = $('[data-rin]', card).value;
  h.rep = v;
  if (E.applyLanguageHit(h)) commit(`Replaced “${h.term}”`);
  else toast('That text changed. Run the dive again.');
  void doc;
});

/* ---------- export ---------- */
function report() {
  const by = {};
  st.findings.forEach((f) => { (by[f.severity] ||= []).push(f); });
  const L = st.lang;
  const lines = [`# Fathom accessibility report`, '', `- Page: ${SAMPLES[st.key]?.name || 'Custom HTML'}`, `- Date: ${new Date().toISOString().slice(0, 10)}`, `- Clarity score: **${st.score}/100** (${E.tier(st.score)})`, `- Language score: **${L ? E.languageScore(L) : '–'}/100**${L?.read ? `, reading level grade ${L.read.grade.toFixed(1)}` : ''}`, `- Findings: ${st.findings.length} barriers, ${L ? L.hits.length : 0} wording flags`, ''];
  ['blocker', 'serious', 'moderate', 'minor'].forEach((s) => {
    if (!by[s]) return;
    lines.push(`## ${sevLabel(s)} (${by[s].length})`, '');
    by[s].forEach((f) => {
      lines.push(`### ${f.title}`, `- WCAG ${f.wcag} (${f.level}) · affects ${f.personas.map((p) => E.PERSONAS[p]).join(', ')}`, `- Where: \`${f.selector}\``, `- Why: ${f.why}`, `- Fix: ${f.how}${f.fix?.suggest ? ` Suggested: "${f.fix.suggest}"` : ''}`, '');
    });
  });
  if (L && L.hits.length) {
    lines.push('## Inclusive language', '');
    L.hits.forEach((h) => lines.push(`- "${h.term}" → "${h.rep}" (${h.cat}): ${h.why}`));
    lines.push('');
  }
  lines.push('---', 'Automated checks find roughly a third of accessibility issues. Test with real assistive technology and real people. Generated by Fathom.');
  return lines.join('\n');
}
$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([report()], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fathom-report.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Report downloaded');
});

/* ---------- editor & samples ---------- */
let typing;
editor.addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(() => {
    if (editor.value === st.source) return;
    st.history.push(st.source);
    $('#btn-undo').disabled = false;
    if ($('#sample').value !== 'custom') { $('#sample').value = 'custom'; st.key = 'custom'; }
    loadSource(editor.value);
  }, 500);
});
async function selectSample(key, { quiet = false } = {}) {
  st.key = key;
  $('#sample').value = key;
  if (key === 'custom') {
    loadSource(BLANK, { resetHistory: true });
    if (!quiet) editor.focus();
    return;
  }
  if (key === 'self') {
    try {
      const html = await (await fetch(location.pathname.replace(/[^/]*$/, '') || '/')).text();
      loadSource(html, { resetHistory: true });
    } catch (e) { toast('Could not load Fathom itself'); }
    return;
  }
  loadSource(SAMPLES[key].html, { resetHistory: true });
}
$('#sample').addEventListener('change', (e) => selectSample(e.target.value));
$$('[data-sample]').forEach((a) => a.addEventListener('click', () => selectSample(a.dataset.sample, { quiet: true })));

/* ---------- hero card with real numbers ---------- */
async function heroStats() {
  try {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-same-origin');
    f.setAttribute('aria-hidden', 'true');
    f.tabIndex = -1;
    f.style.cssText = 'position:fixed;left:-3000px;top:0;width:1100px;height:900px;border:0;visibility:hidden';
    document.body.appendChild(f);
    await new Promise((res) => { f.addEventListener('load', res, { once: true }); f.srcdoc = E.inert(SAMPLES.cafe.html); });
    const d = f.contentDocument;
    await whenImages(d);
    f.style.height = d.documentElement.scrollHeight + 'px';
    await new Promise((r) => requestAnimationFrame(r));
    const before = E.audit(d);
    const sb = E.score(before);
    const by = (s) => before.filter((x) => x.severity === s).length;
    E.applyFixes(d, before);
    const html = E.serialize(d);
    await new Promise((res) => { f.addEventListener('load', res, { once: true }); f.srcdoc = E.inert(html); });
    const d2 = f.contentDocument;
    await whenImages(d2);
    f.style.height = d2.documentElement.scrollHeight + 'px';
    await new Promise((r) => requestAnimationFrame(r));
    const after = E.score(E.audit(d2));
    f.remove();
    $('#hero-num').textContent = sb;
    $('#hero-arc').setAttribute('stroke-dasharray', `${sb} 100`);
    $('.hc-num small').textContent = E.tier(sb);
    const lis = $$('.hc-list li');
    lis[0].lastChild.textContent = ` ${by('blocker')} blockers for screen reader and keyboard users`;
    lis[1].lastChild.textContent = ` ${by('serious')} serious barriers, from contrast to focus rings`;
    lis[2].lastChild.textContent = ` ${by('moderate') + by('minor')} more issues in structure and touch targets`;
    $('.hc-after b').textContent = `→ ${after}`;
    $('figcaption.sr', $('.hero-card')).textContent = `Example: the sample café page scored ${sb} out of 100 before fixes and ${after} after.`;
    document.body.dataset.hero = `${sb}->${after}`;
  } catch (e) { console.warn('hero stats skipped', e); }
}

/* ---------- boot ---------- */
async function boot() {
  try {
    const r = await fetch('audio/manifest.json', { cache: 'no-cache' });
    if (r.ok) st.clips = (await r.json()).clips || [];
  } catch (e) { /* no pre-rendered clips */ }
  try {
    const r = await fetch('/api/voice', { method: 'GET' });
    if (r.ok) st.live = !!(await r.json()).configured;
  } catch (e) { /* static host */ }
  await selectSample('cafe', { quiet: true });
  heroStats();
}
boot();
if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = () => {};
window.__fathom = { st, E };
