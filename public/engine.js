/* Fathom engine
 * Runs in the browser against a same-origin, script-free iframe document.
 * audit(doc)       -> findings[] (accessibility barriers)
 * transcript(doc)  -> screen reader simulation items
 * tabStops(doc)    -> keyboard order + unreachable clickables
 * languageScan(doc)-> inclusive language + readability
 * serialize(doc)   -> HTML string
 */

export const SEV = {
  blocker: { w: 9, label: 'Blocker', rank: 4 },
  serious: { w: 6, label: 'Serious', rank: 3 },
  moderate: { w: 3.5, label: 'Moderate', rank: 2 },
  minor: { w: 1.5, label: 'Minor', rank: 1 },
};

export const PERSONAS = {
  sr: 'Screen reader users',
  lv: 'Low-vision users',
  cb: 'Color-blind users',
  kb: 'Keyboard & motor users',
  cog: 'Cognitive & learning differences',
  deaf: 'Deaf & hard-of-hearing users',
  mo: 'Motion-sensitive users',
};

const RULES = {
  'img-alt': { sev: 'blocker', t: 'Image has no alt text', wcag: '1.1.1', lvl: 'A', p: ['sr', 'cog'],
    why: 'Without alt text a screen reader announces the file name instead of what the picture means, so blind users miss the content entirely.',
    how: 'Describe the purpose of the image in a short phrase. Use alt="" only when the image is purely decorative.' },
  'img-alt-bad': { sev: 'moderate', t: 'Alt text is redundant or looks like a file name', wcag: '1.1.1', lvl: 'A', p: ['sr'],
    why: 'Screen readers already announce "graphic", so "image of…" wastes time, and file names carry no meaning.',
    how: 'Say what the image communicates, not that it is an image.' },
  'name-missing': { sev: 'blocker', t: 'Control has no accessible name', wcag: '4.1.2', lvl: 'A', p: ['sr', 'kb'],
    why: 'Icon-only buttons and links are announced as just "button" or "link". Nobody using a screen reader or voice control can tell what they do.',
    how: 'Add visible text, or an aria-label that says what the control does.' },
  'link-purpose': { sev: 'moderate', t: 'Vague link text', wcag: '2.4.4', lvl: 'A', p: ['sr', 'cog'],
    why: 'Screen reader users often list all links on a page. A list of "Read more, Read more, Click here" is meaningless out of context.',
    how: 'Make the link text describe where it goes, or add an aria-label that includes the visible words plus context.' },
  'form-label': { sev: 'blocker', t: 'Form field has no label', wcag: '3.3.2', lvl: 'A', p: ['sr', 'cog', 'kb'],
    why: 'Without a label the field is announced as "edit text, blank". People cannot tell what to type.',
    how: 'Associate a visible <label for> with the field, or add aria-label as a minimum.' },
  'placeholder-label': { sev: 'serious', t: 'Placeholder is the only label', wcag: '3.3.2', lvl: 'A', p: ['cog', 'lv', 'sr'],
    why: 'Placeholders disappear as soon as you type, are usually low contrast, and make people remember what a field was for. Not every assistive technology announces them either.',
    how: 'Add a persistent visible <label>. Keep the placeholder only as an example.' },
  contrast: { sev: 'serious', t: 'Text contrast is too low', wcag: '1.4.3', lvl: 'AA', p: ['lv', 'cb'],
    why: 'Low-contrast text is hard or impossible to read for people with low vision, in sunlight, or on cheap screens.',
    how: 'Reach 4.5:1 for normal text and 3:1 for large text. Fathom suggests the closest color that passes.' },
  'heading-order': { sev: 'moderate', t: 'Heading levels skip', wcag: '1.3.1', lvl: 'A', p: ['sr', 'cog'],
    why: 'Headings are a table of contents for screen reader users. Skipped levels make the page structure confusing.',
    how: 'Use heading levels in order. Style with CSS, not by picking a smaller tag.' },
  'no-h1': { sev: 'moderate', t: 'Page has no level-1 heading', wcag: '2.4.6', lvl: 'AA', p: ['sr', 'cog'],
    why: 'The h1 tells every user what the page is about and gives screen reader users a landmark to jump to.',
    how: 'Use one h1 that names the page.' },
  'html-lang': { sev: 'serious', t: 'Page language is not set', wcag: '3.1.1', lvl: 'A', p: ['sr'],
    why: 'Screen readers pick pronunciation from the lang attribute. Without it, English may be read with the wrong accent or engine.',
    how: 'Add lang="en" (or the right code) to the <html> element.' },
  'doc-title': { sev: 'moderate', t: 'Page has no title', wcag: '2.4.2', lvl: 'A', p: ['sr', 'cog'],
    why: 'The title is the first thing a screen reader announces and the label on every browser tab.',
    how: 'Add a short, unique <title>.' },
  'landmark-main': { sev: 'moderate', t: 'No main landmark', wcag: '1.3.1', lvl: 'A', p: ['sr', 'kb'],
    why: 'Landmarks let screen reader users jump straight to the content instead of tabbing through the navigation.',
    how: 'Wrap the primary content in <main>.' },
  'skip-link': { sev: 'minor', t: 'No skip link', wcag: '2.4.1', lvl: 'A', p: ['kb', 'sr'],
    why: 'Keyboard users have to tab through every navigation link on every page without a way to skip.',
    how: 'Add a "Skip to main content" link as the first focusable element.' },
  'target-size': { sev: 'moderate', t: 'Tap targets are too small', wcag: '2.5.8', lvl: 'AA', p: ['kb', 'lv'],
    why: 'Targets under 24×24 px are hard to hit with a tremor, a thumb, or a trackpad.',
    how: 'Give controls at least 24×24 px (44×44 px is more comfortable).' },
  'viewport-zoom': { sev: 'serious', t: 'Pinch-zoom is disabled', wcag: '1.4.4', lvl: 'AA', p: ['lv'],
    why: 'Blocking zoom takes away the main tool low-vision users have on a phone.',
    how: 'Remove user-scalable=no and maximum-scale from the viewport meta tag.' },
  'focus-visible': { sev: 'serious', t: 'Keyboard focus indicator is removed', wcag: '2.4.7', lvl: 'AA', p: ['kb', 'lv'],
    why: 'When outline is removed with nothing in its place, keyboard users cannot see where they are on the page.',
    how: 'Never remove outline without replacing it. Use :focus-visible with a clear ring.' },
  'reduced-motion': { sev: 'moderate', t: 'Animation ignores reduced-motion preference', wcag: '2.2.2', lvl: 'A', p: ['mo', 'cog'],
    why: 'Parallax and looping animation can trigger dizziness, nausea, or migraines for people with vestibular disorders.',
    how: 'Wrap motion in @media (prefers-reduced-motion: no-preference), or disable it inside a reduce query.' },
  'video-captions': { sev: 'serious', t: 'Video has no captions', wcag: '1.2.2', lvl: 'A', p: ['deaf', 'cog'],
    why: 'Deaf and hard-of-hearing users cannot access the audio. Captions also help in noisy places and for non-native speakers.',
    how: 'Add a <track kind="captions"> with a WebVTT file.' },
  autoplay: { sev: 'serious', t: 'Media starts playing on its own', wcag: '1.4.2', lvl: 'A', p: ['sr', 'cog', 'mo'],
    why: 'Auto-playing audio talks over screen readers and distracts people with attention differences.',
    how: 'Remove autoplay, or make sure the media is muted and can be paused.' },
  'clickable-div': { sev: 'serious', t: 'Clickable element is not keyboard accessible', wcag: '2.1.1', lvl: 'A', p: ['kb', 'sr'],
    why: 'A div with onclick can not be reached or activated with the keyboard or announced by assistive tech.',
    how: 'Use a real <button> or <a>. If you cannot, add role, tabindex="0" and a key handler.' },
  'tabindex-positive': { sev: 'moderate', t: 'Positive tabindex breaks focus order', wcag: '2.4.3', lvl: 'A', p: ['kb'],
    why: 'tabindex above 0 forces elements to the front of the tab order and makes the page unpredictable.',
    how: 'Use tabindex="0" or reorder the DOM.' },
  'aria-hidden-focus': { sev: 'serious', t: 'Focusable element hidden from assistive tech', wcag: '4.1.2', lvl: 'A', p: ['sr', 'kb'],
    why: 'Keyboard focus lands on something a screen reader says does not exist.',
    how: 'Remove aria-hidden, or make the content unfocusable.' },
  'duplicate-id': { sev: 'minor', t: 'Duplicate id', wcag: '4.1.2', lvl: 'A', p: ['sr'],
    why: 'Labels and aria references that point to a duplicated id attach to the wrong element.',
    how: 'Make every id unique.' },
  'table-headers': { sev: 'moderate', t: 'Data table has no header cells', wcag: '1.3.1', lvl: 'A', p: ['sr', 'cog'],
    why: 'Without <th>, screen readers read cells as an unlabeled grid of numbers.',
    how: 'Mark header cells with <th scope="col"> or <th scope="row">.' },
  'iframe-title': { sev: 'moderate', t: 'Embedded frame has no title', wcag: '4.1.2', lvl: 'A', p: ['sr'],
    why: 'Frames without a title are announced as just "frame".', how: 'Add a descriptive title attribute.' },
  'small-text': { sev: 'minor', t: 'Very small text', wcag: '1.4.4', lvl: 'AA', p: ['lv', 'cog'],
    why: 'Text under 12 px is tiring for everyone and unreadable for many.', how: 'Use at least 14 px for body copy and 12 px for captions.' },
  autocomplete: { sev: 'minor', t: 'Personal-data field has no autocomplete hint', wcag: '1.3.5', lvl: 'AA', p: ['cog', 'kb'],
    why: 'Autocomplete saves typing for people with motor and memory difficulties.', how: 'Add the matching autocomplete token.' },
  'link-color-only': { sev: 'serious', t: 'Links are identified by color alone', wcag: '1.4.1', lvl: 'A', p: ['cb', 'lv'],
    why: 'If the only cue is color, color-blind users cannot find the links inside a paragraph.',
    how: 'Underline links in text, or add another non-color cue.' },
};

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
const lc = (s) => norm(s).toLowerCase();
let UID = 0;

/* ---------- colour helpers ---------- */
function parseColor(str) {
  if (!str) return null;
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
  if (p.length < 3 || p.slice(0, 3).some((n) => Number.isNaN(n))) return null;
  return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined || Number.isNaN(p[3]) ? 1 : p[3] };
}
const blend = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});
function lum({ r, g, b }) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function ratio(a, b) {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function rgb2hsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}
function hsl2rgb({ h, s, l }) {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255, a: 1 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const t = (x) => {
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return { r: t(h + 1 / 3) * 255, g: t(h) * 255, b: t(h - 1 / 3) * 255, a: 1 };
}
export function nearestPassing(fg, bg, target) {
  const hsl = rgb2hsl(fg);
  const dir = lum(bg) > 0.4 ? -1 : 1;
  const tryDir = (d) => {
    for (let i = 0; i <= 100; i++) {
      const l = Math.max(0, Math.min(1, hsl.l + d * (i / 100)));
      const c = hsl2rgb({ ...hsl, l });
      if (ratio(c, bg) >= target) return c;
      if (i > 0 && (l === 0 || l === 1)) break;
    }
    return null;
  };
  return tryDir(dir) || tryDir(-dir) || (lum(bg) > 0.4 ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 });
}
function effectiveBg(el, win) {
  const layers = [];
  let n = el;
  while (n && n.nodeType === 1) {
    const cs = win.getComputedStyle(n);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return { unknown: true };
    const c = parseColor(cs.backgroundColor);
    if (c && c.a > 0) {
      layers.push(c);
      if (c.a >= 1) break;
    }
    n = n.parentElement;
  }
  let base = { r: 255, g: 255, b: 255, a: 1 };
  for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
  return { color: base };
}

/* ---------- DOM helpers ---------- */
function rendered(el) {
  return el.getClientRects().length > 0;
}
function srOnly(el) {
  const r = el.getBoundingClientRect();
  return r.width <= 1 && r.height <= 1;
}
function cssPath(el) {
  const parts = [];
  let n = el;
  while (n && n.nodeType === 1 && n.tagName !== 'HTML' && parts.length < 4) {
    let s = n.tagName.toLowerCase();
    if (n.id) { parts.unshift(s + '#' + n.id); break; }
    const c = [...n.classList].slice(0, 2);
    if (c.length) s += '.' + c.join('.');
    parts.unshift(s);
    n = n.parentElement;
  }
  return parts.join(' › ');
}
const snip = (el, n = 200) => {
  const s = norm(el.outerHTML);
  return s.length > n ? s.slice(0, n) + '…' : s;
};

function textOf(node, win) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return '';
  const el = node;
  const tag = el.tagName.toLowerCase();
  if (['script', 'style', 'template'].includes(tag)) return '';
  if (el.getAttribute('aria-hidden') === 'true' || el.hidden) return '';
  const cs = win.getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return '';
  const lb = el.getAttribute('aria-label');
  if (lb && lb.trim()) return lb;
  if (tag === 'img') return el.getAttribute('alt') || '';
  if (tag === 'svg') {
    const t = el.querySelector('title');
    return t ? t.textContent : '';
  }
  if (tag === 'input') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (['button', 'submit', 'reset'].includes(type)) return el.getAttribute('value') || (type === 'submit' ? 'Submit' : type === 'reset' ? 'Reset' : '');
    return '';
  }
  let s = '';
  el.childNodes.forEach((c) => { s += textOf(c, win) + (c.nodeType === 1 && /^(block|flex|grid|list-item|table)/.test(win.getComputedStyle(c).display) ? ' ' : ''); });
  return s;
}

export function accName(el, win) {
  const doc = el.ownerDocument;
  const lby = el.getAttribute('aria-labelledby');
  if (lby) {
    const t = lby.split(/\s+/).map((id) => doc.getElementById(id)).filter(Boolean).map((n) => norm(textOf(n, win))).join(' ');
    if (t) return { name: t, src: 'aria-labelledby' };
  }
  const al = el.getAttribute('aria-label');
  if (al && norm(al)) return { name: norm(al), src: 'aria-label' };
  const tag = el.tagName.toLowerCase();
  if (['input', 'select', 'textarea'].includes(tag)) {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (['button', 'submit', 'reset'].includes(type)) {
      return { name: el.getAttribute('value') || (type === 'submit' ? 'Submit' : type === 'reset' ? 'Reset' : ''), src: 'value' };
    }
    if (type === 'image') return { name: norm(el.getAttribute('alt')), src: 'alt' };
    const labels = el.labels ? [...el.labels] : [];
    const t = labels.map((l) => norm(textOf(l, win))).join(' ');
    if (t) return { name: t, src: 'label' };
    const ti = el.getAttribute('title');
    if (ti && norm(ti)) return { name: norm(ti), src: 'title' };
    const ph = el.getAttribute('placeholder');
    if (ph && norm(ph)) return { name: norm(ph), src: 'placeholder' };
    return { name: '', src: '' };
  }
  if (tag === 'img') {
    return { name: norm(el.getAttribute('alt')) || norm(el.getAttribute('title')), src: 'alt' };
  }
  const t = norm(textOf(el, win));
  if (t) return { name: t, src: 'content' };
  const ti = el.getAttribute('title');
  if (ti && norm(ti)) return { name: norm(ti), src: 'title' };
  return { name: '', src: '' };
}

function retag(el, tag) {
  const n = el.ownerDocument.createElement(tag);
  [...el.attributes].forEach((a) => n.setAttribute(a.name, a.value));
  while (el.firstChild) n.appendChild(el.firstChild);
  el.replaceWith(n);
  return n;
}
function ensureStyle(doc, id, css) {
  let s = doc.getElementById(id);
  if (!s) {
    s = doc.createElement('style');
    s.id = id;
    (doc.head || doc.documentElement).appendChild(s);
  }
  s.textContent = css;
}
const humanize = (s) => norm((s || '').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')).replace(/^./, (c) => c.toUpperCase());
function eachRule(doc, cb) {
  const walk = (rules) => {
    for (const r of rules) {
      cb(r);
      if (r.cssRules && (r.type === 4 || r.type === 12)) walk(r.cssRules);
    }
  };
  for (const sheet of doc.styleSheets) {
    try { walk(sheet.cssRules); } catch (e) { /* cross-origin sheet */ }
  }
}

const NAME_HINTS = [
  [/cart|basket|bag/, 'Shopping cart'], [/search|magnif/, 'Search'], [/menu|hamburger|burger|nav-?toggle/, 'Open menu'],
  [/close|dismiss|cancel|times/, 'Close'], [/user|account|profile|login/, 'Account'], [/heart|fav|like/, 'Add to favorites'],
  [/share/, 'Share'], [/play/, 'Play'], [/pause/, 'Pause'], [/next|forward/, 'Next'], [/prev|back/, 'Previous'],
  [/phone|call/, 'Call us'], [/mail|email/, 'Email us'], [/instagram/, 'Instagram'], [/twitter|tweet/, 'Twitter'],
  [/facebook/, 'Facebook'], [/linkedin/, 'LinkedIn'], [/youtube/, 'YouTube'], [/github/, 'GitHub'], [/tiktok/, 'TikTok'],
  [/settings|gear|cog/, 'Settings'], [/download/, 'Download'], [/notification|bell/, 'Notifications'], [/filter/, 'Filter'],
];
function guessName(el) {
  const bag = lc([el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className, el.id, el.getAttribute('data-icon'), el.getAttribute('title'), el.getAttribute('name'), el.querySelector('svg,i,span')?.getAttribute?.('class')].filter(Boolean).join(' '));
  for (const [re, label] of NAME_HINTS) if (re.test(bag)) return label;
  if (el.tagName === 'A') {
    try {
      const u = new URL(el.getAttribute('href') || '', 'https://x.test/');
      const host = u.hostname.replace(/^www\./, '').split('.')[0];
      const last = u.pathname.split('/').filter(Boolean).pop();
      if (host && host !== 'x') return humanize(host);
      if (last) return humanize(last);
    } catch (e) { /* ignore */ }
    return 'Link';
  }
  return 'Button';
}
function nearestHeading(el) {
  const scope = el.closest('article,li,section,.card,div');
  const own = scope && scope.querySelector('h1,h2,h3,h4,h5,h6');
  if (own && norm(own.textContent)) return norm(own.textContent);
  let n = el;
  const doc = el.ownerDocument;
  const all = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  let best = null;
  for (const h of all) if (h.compareDocumentPosition(el) & 4 /* el follows h */) best = h;
  return best ? norm(best.textContent) : '';
}
function textAfter(el) {
  let t = '';
  for (let n = el.nextSibling; n && t.length < 90; n = n.nextSibling) {
    if (n.nodeType === 3 || (n.nodeType === 1 && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(n.tagName))) t += n.textContent;
    else break;
  }
  const m = norm(t).match(/^[^.!?]*/);
  const words = (m ? m[0] : '').split(' ').filter(Boolean).slice(0, 9);
  return words.join(' ');
}
function adjacentLabel(el) {
  const sib = el.nextElementSibling;
  if (sib && norm(sib.textContent) && norm(sib.textContent).length < 90) return norm(sib.textContent);
  const p = el.parentElement;
  if (p) { const t = norm([...p.childNodes].filter((n) => n !== el).map((n) => n.textContent).join(' ')); if (t && t.length < 90) return t; }
  return '';
}
const GENERIC = new Set(['click here', 'here', 'read more', 'learn more', 'more', 'more info', 'more information', 'link', 'this', 'details', 'click', 'continue', 'go', 'read', 'see more', 'view more', 'find out more']);
const AC = [
  [/e-?mail/i, 'email'], [/(first|given)[\s_-]?name/i, 'given-name'], [/(last|family|sur)[\s_-]?name/i, 'family-name'],
  [/^(full[\s_-]?)?name$|your name|full name/i, 'name'], [/phone|tel\b|mobile/i, 'tel'], [/zip|postal/i, 'postal-code'],
  [/street|address/i, 'street-address'], [/\bcity\b/i, 'address-level2'], [/country/i, 'country-name'], [/user[\s_-]?name/i, 'username'],
];

function interactiveEls(doc) {
  return [...doc.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex],[role=button],[role=link],[contenteditable=""],[contenteditable=true]')];
}
function focusable(el) {
  if (el.disabled) return false;
  const ti = el.getAttribute('tabindex');
  if (ti !== null && parseInt(ti, 10) < 0) return false;
  if (!rendered(el)) return false;
  return true;
}

/* ====================== AUDIT ====================== */
export function audit(doc) {
  const win = doc.defaultView;
  const out = [];
  const add = (rule, el, extra = {}) => {
    const m = RULES[rule];
    out.push({
      id: `${rule}-${++UID}`, rule, severity: extra.severity || m.sev, title: extra.title || m.t, wcag: m.wcag, level: m.lvl,
      personas: m.p, why: m.why, how: m.how, el, els: extra.els || [el], selector: cssPath(el), snippet: snip(el),
      detail: extra.detail || '', fix: extra.fix || null,
    });
  };

  const root = doc.documentElement;
  if (!norm(root.getAttribute('lang'))) {
    add('html-lang', root, { fix: { kind: 'auto', label: 'Set lang="en"', run: (d) => d.documentElement.setAttribute('lang', 'en') } });
  }
  const titleEl = doc.querySelector('title');
  if (!titleEl || !norm(titleEl.textContent)) {
    const h1 = doc.querySelector('h1');
    add('doc-title', root, {
      fix: { kind: 'input', label: 'Add title', placeholder: 'Page title', suggest: norm(h1?.textContent) || 'Untitled page',
        run: (d, v) => { let t = d.querySelector('title'); if (!t) { t = d.createElement('title'); d.head.prepend(t); } t.textContent = v; } },
    });
  }
  const meta = doc.querySelector('meta[name=viewport]');
  if (meta) {
    const c = meta.getAttribute('content') || '';
    const max = c.match(/maximum-scale\s*=\s*([\d.]+)/i);
    if (/user-scalable\s*=\s*(no|0)/i.test(c) || (max && parseFloat(max[1]) < 2)) {
      add('viewport-zoom', meta, { fix: { kind: 'auto', label: 'Allow zoom', run: () => meta.setAttribute('content', c.replace(/,?\s*(user-scalable\s*=\s*[^,]+|maximum-scale\s*=\s*[^,]+)/gi, '').replace(/^\s*,\s*/, '')) } });
    }
  }

  /* landmarks & skip link */
  const mainEl = doc.querySelector('main,[role=main]');
  if (!mainEl) {
    let root2 = doc.body;
    let kids = [...root2.children].filter((k) => !/^(script|style|link)$/i.test(k.tagName));
    if (kids.length === 1 && kids[0].children.length > 1) { root2 = kids[0]; kids = [...root2.children]; }
    const cands = kids.filter((k) => !/^(header|nav|footer|aside)$/i.test(k.tagName) && !['banner', 'navigation', 'contentinfo', 'complementary'].includes(k.getAttribute('role') || ''))
      .sort((a, b) => b.textContent.length - a.textContent.length);
    const cand = cands[0];
    add('landmark-main', cand || doc.body, {
      fix: cand ? { kind: 'auto', label: `Make <${cand.tagName.toLowerCase()}> the <main> landmark`, run: () => { retag(cand, 'main'); } } : { kind: 'guided', label: 'Wrap your primary content in <main>…</main>' },
    });
  }
  {
    const first = interactiveEls(doc).filter(focusable).slice(0, 4);
    const hasSkip = first.some((e) => e.tagName === 'A' && /^#/.test(e.getAttribute('href') || '') && /skip|jump/i.test(norm(e.textContent)));
    const linksBefore = interactiveEls(doc).filter(focusable).length;
    if (!hasSkip && linksBefore >= 6) {
      add('skip-link', doc.body, {
        fix: { kind: 'auto', label: 'Insert skip link', run: (d) => {
          let m = d.querySelector('main,[role=main]');
          if (!m) m = d.body;
          if (!m.id) m.id = 'main-content';
          const a = d.createElement('a');
          a.className = 'fathom-skip';
          a.href = '#' + m.id;
          a.textContent = 'Skip to main content';
          d.body.prepend(a);
          ensureStyle(d, 'fathom-skip-css', '.fathom-skip{position:absolute;left:8px;top:-60px;background:#000;color:#fff;padding:10px 14px;border-radius:6px;z-index:99999;font:600 14px/1.2 system-ui,sans-serif}.fathom-skip:focus{top:8px}');
        } },
      });
    }
  }

  /* headings */
  const heads = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')].filter((h) => rendered(h) && !h.closest('[aria-hidden=true]'));
  const lvl = (h) => (h.tagName.length === 2 && /^H[1-6]$/.test(h.tagName) ? +h.tagName[1] : parseInt(h.getAttribute('aria-level') || '2', 10));
  if (heads.length) {
    if (!heads.some((h) => lvl(h) === 1)) {
      const h0 = heads[0];
      add('no-h1', h0, { fix: /^H[1-6]$/.test(h0.tagName) ? { kind: 'auto', label: 'Make the first heading an h1', run: () => { retag(h0, 'h1'); } } : { kind: 'guided', label: 'Add a single h1 that names the page.' } });
    }
    let prev = 0;
    heads.forEach((h) => {
      let l = lvl(h);
      if (/^H[1-6]$/.test(h.tagName) && l === 1 && !heads.some((x) => lvl(x) === 1 && x !== h)) { /* first h1 fine */ }
      if (prev && l > prev + 1) {
        const target = prev + 1;
        if (/^H[1-6]$/.test(h.tagName)) {
          add('heading-order', h, { title: `Heading jumps from h${prev} to h${l}`, detail: `Should be h${target}`, fix: { kind: 'auto', late: true, label: `Change to h${target}`, run: () => { retag(h, 'h' + target); } } });
        } else add('heading-order', h, { title: `Heading jumps from level ${prev} to ${l}` });
        l = target;
      }
      prev = l;
    });
  }

  /* images */
  doc.querySelectorAll('img').forEach((img) => {
    if (img.closest('[aria-hidden=true]')) return;
    if (!img.hasAttribute('alt')) {
      const fig = img.closest('figure')?.querySelector('figcaption');
      const guess = norm(fig?.textContent) || norm(img.getAttribute('title')) || (/^(img|dsc|image|photo)[-_ ]?\d+/i.test((img.getAttribute('src') || '').split('/').pop()) ? '' : humanize((img.getAttribute('src') || '').split('/').pop().split('?')[0]));
      add('img-alt', img, { fix: { kind: 'input', label: 'Add alt text', placeholder: 'Describe the image', suggest: guess || 'Describe this image', run: (d, v) => img.setAttribute('alt', v) } });
    } else {
      const a = img.getAttribute('alt');
      if (a && (/^(image|picture|photo|graphic|icon)\b|\b(image|picture|photo|graphic) of\b/i.test(a) || /\.(png|jpe?g|gif|svg|webp)$/i.test(a) || a.length > 125)) {
        const cleaned = norm(a.replace(/^(an? )?(image|picture|photo|graphic|icon)( of| showing)?\s*/i, '').replace(/\.(png|jpe?g|gif|svg|webp)$/i, '').replace(/[-_]+/g, ' '));
        add('img-alt-bad', img, { fix: { kind: 'input', label: 'Rewrite alt text', placeholder: 'Describe the image', suggest: cleaned ? cleaned.replace(/^./, (c) => c.toUpperCase()) : a.slice(0, 100), run: (d, v) => img.setAttribute('alt', v) } });
      }
    }
  });

  /* names */
  const nameTargets = doc.querySelectorAll('a[href],button,[role=button],[role=link],input[type=button],input[type=submit],input[type=reset],input[type=image],summary');
  nameTargets.forEach((el) => {
    if (el.closest('[aria-hidden=true],[hidden]') || !rendered(el)) return;
    const { name } = accName(el, win);
    const kind = el.tagName === 'A' || el.getAttribute('role') === 'link' ? 'Link' : 'Button';
    if (!name) {
      add('name-missing', el, { title: `${kind} has no accessible name`, fix: { kind: 'input', label: 'Add accessible name', placeholder: 'What does it do?', suggest: guessName(el), run: (d, v) => el.setAttribute('aria-label', v) } });
    } else if (GENERIC.has(lc(name).replace(/[.…→>»]+$/g, '').trim())) {
      const ctx = nearestHeading(el);
      const base = norm(name).replace(/[.…→>»]+$/g, '');
      add('link-purpose', el, {
        title: `“${base}” says nothing out of context`,
        fix: { kind: 'input', label: 'Add context', placeholder: 'Read more about…', suggest: (el.closest('p,li,td,dd') && textAfter(el) && /^(click here|here|click)$/i.test(base)) ? `${base} ${textAfter(el)}` : ctx ? (/^(click here|here)$/i.test(base) ? `${base} to read ${ctx}` : `${base} about ${ctx}`) : `${base} about this page`, run: (d, v) => el.setAttribute('aria-label', v) },
      });
    }
  });

  /* form labels */
  doc.querySelectorAll('input,select,textarea').forEach((el) => {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return;
    if (el.closest('[aria-hidden=true],[hidden]') || !rendered(el)) return;
    const { name, src } = accName(el, win);
    const firstOpt = el.tagName === 'SELECT' ? norm(el.options?.[0]?.textContent) : '';
    const guess = norm(el.getAttribute('placeholder')) || (['checkbox', 'radio'].includes(type) ? adjacentLabel(el) : '') || firstOpt || humanize(el.getAttribute('name') || el.id || type);
    if (!name) {
      add('form-label', el, { fix: { kind: 'input', label: 'Add label', placeholder: 'Label text', suggest: guess, run: (d, v) => el.setAttribute('aria-label', v) } });
    } else if (src === 'placeholder') {
      add('placeholder-label', el, { fix: { kind: 'input', label: 'Add label', placeholder: 'Label text', suggest: name.replace(/[…:.]+$/, ''), run: (d, v) => el.setAttribute('aria-label', v) } });
    }
    if (!el.hasAttribute('autocomplete') && ['text', 'email', 'tel', 'password', 'url', 'search'].includes(type) && el.tagName === 'INPUT') {
      const hay = [el.getAttribute('name'), el.id, el.getAttribute('placeholder'), name].filter(Boolean).join(' ');
      let token = '';
      if (type === 'password') token = /new|create|confirm|sign.?up|register/i.test(hay) ? 'new-password' : 'current-password';
      else if (type === 'email') token = 'email';
      else if (type === 'tel') token = 'tel';
      else for (const [re, t] of AC) if (re.test(hay)) { token = t; break; }
      if (token) add('autocomplete', el, { title: `Add autocomplete="${token}"`, fix: { kind: 'auto', label: `autocomplete="${token}"`, run: () => el.setAttribute('autocomplete', token) } });
    }
  });

  /* contrast + small text */
  {
    const groups = new Map();
    const small = [];
    const els = [...doc.body.querySelectorAll('*')].slice(0, 1500);
    for (const el of els) {
      if (['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName) || el.disabled) continue;
      let direct = '';
      el.childNodes.forEach((c) => { if (c.nodeType === 3) direct += c.nodeValue; });
      if (!norm(direct)) continue;
      if (!rendered(el) || srOnly(el)) continue;
      const cs = win.getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const fg0 = parseColor(cs.color);
      if (!fg0) continue;
      const bgInfo = effectiveBg(el, win);
      const size = parseFloat(cs.fontSize);
      if (size < 12) small.push(el);
      if (bgInfo.unknown) continue;
      let opacity = 1;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) opacity *= +win.getComputedStyle(n).opacity;
      const fg = blend({ ...fg0, a: fg0.a * opacity }, bgInfo.color);
      const r = ratio(fg, bgInfo.color);
      const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      const need = large ? 3 : 4.5;
      if (r < need - 0.005) {
        const own = parseColor(cs.backgroundColor);
        const mode = own && own.a >= 0.99 && lum(fg) > lum(bgInfo.color) ? 'bg' : 'fg';
        const key = mode + '|' + hex(fg) + '|' + hex(bgInfo.color) + '|' + need;
        if (!groups.has(key)) groups.set(key, { fg, bg: bgInfo.color, need, r, mode, els: [] });
        groups.get(key).els.push(el);
      }
    }
    for (const g of groups.values()) {
      const title = `Contrast ${g.r.toFixed(2)}:1, needs ${g.need}:1${g.els.length > 1 ? ` · ${g.els.length} elements` : ''}`;
      if (g.mode === 'bg') {
        const nb = nearestPassing(g.bg, g.fg, g.need);
        add('contrast', g.els[0], {
          els: g.els, title,
          detail: `Light text ${hex(g.fg)} on ${hex(g.bg)}. Darken the background to ${hex(nb)} (${ratio(g.fg, nb).toFixed(2)}:1)`,
          fix: { kind: 'auto', label: `Darken background to ${hex(nb)}`, swatch: [hex(g.bg), hex(nb), hex(g.fg)], run: () => g.els.forEach((e) => { e.style.backgroundColor = hex(nb); }) },
        });
      } else {
        const nc = nearestPassing(g.fg, g.bg, g.need);
        add('contrast', g.els[0], {
          els: g.els, title,
          detail: `${hex(g.fg)} on ${hex(g.bg)}. Use ${hex(nc)} (${ratio(nc, g.bg).toFixed(2)}:1)`,
          fix: { kind: 'auto', label: `Change text to ${hex(nc)}`, swatch: [hex(g.fg), hex(nc), hex(g.bg)], run: () => g.els.forEach((e) => { e.style.color = hex(nc); }) },
        });
      }
    }
    if (small.length) {
      add('small-text', small[0], { els: small, title: `${small.length} element${small.length > 1 ? 's' : ''} use text under 12px`, fix: { kind: 'auto', label: 'Raise to 14px', run: () => small.forEach((e) => { e.style.fontSize = '14px'; }) } });
    }
  }

  /* target size */
  {
    const tiny = [];
    interactiveEls(doc).forEach((el) => {
      if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'].indexOf(el.tagName) < 0 && el.getAttribute('role') !== 'button') return;
      if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type)) { /* native small controls still count */ }
      if (!rendered(el) || srOnly(el)) return;
      const cs = win.getComputedStyle(el);
      if (el.tagName === 'A' && cs.display === 'inline') {
        const p = el.parentElement;
        if (p && norm(p.textContent).length - norm(el.textContent).length > 20) return; // inline link in a sentence is exempt
      }
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) tiny.push(el);
    });
    if (tiny.length) {
      add('target-size', tiny[0], {
        els: tiny, title: `${tiny.length} control${tiny.length > 1 ? 's are' : ' is'} smaller than 24×24px`,
        fix: { kind: 'auto', label: 'Grow to 44×44px', run: () => tiny.forEach((e) => { const cs = win.getComputedStyle(e); if (cs.display === 'inline') e.style.display = 'inline-flex'; e.style.minWidth = '44px'; e.style.minHeight = '44px'; e.style.alignItems = 'center'; e.style.justifyContent = 'center'; }) },
      });
    }
  }

  /* color-only links */
  {
    const bad = [];
    doc.querySelectorAll('p a[href],li a[href],td a[href],dd a[href]').forEach((a) => {
      if (!rendered(a)) return;
      const cs = win.getComputedStyle(a);
      if (cs.textDecorationLine !== 'none' && cs.textDecorationLine !== '') return;
      if (parseInt(cs.fontWeight, 10) >= 600 && parseInt(win.getComputedStyle(a.parentElement).fontWeight, 10) < 600) return;
      const p = a.parentElement;
      if (norm(p.textContent).length - norm(a.textContent).length < 12) return;
      const lc1 = parseColor(cs.color); const pc = parseColor(win.getComputedStyle(p).color);
      if (lc1 && pc && ratio(lc1, pc) >= 3) return;
      bad.push(a);
    });
    if (bad.length) add('link-color-only', bad[0], { els: bad, title: `${bad.length} in-text link${bad.length > 1 ? 's' : ''} rely on color alone`, fix: { kind: 'auto', label: 'Underline links', run: () => bad.forEach((a) => { a.style.textDecoration = 'underline'; }) } });
  }

  /* CSS scan: focus + motion */
  {
    let motion = false, reduced = false, hasAlt = false;
    const killers = [];
    eachRule(doc, (r) => {
      if (r.type === 7) motion = true;
      if (r.type === 4 && /prefers-reduced-motion/i.test(r.conditionText || r.media?.mediaText || '')) reduced = true;
      if (r.type === 1) {
        const st = r.style;
        const sel = r.selectorText || '';
        if ((st.animationName && st.animationName !== 'none') || (st.animationDuration && !/^0s?(,\s*0s?)*$/.test(st.animationDuration))) motion = true;
        const isFocusSel = /:focus/.test(sel);
        const o = st.getPropertyValue('outline');
        const outlineOff = st.outlineStyle === 'none' || /^\s*(none|0)(px)?\b/.test(o) || st.outlineWidth === '0px';
        if (outlineOff) killers.push({ sel });
        else if (isFocusSel && (st.outlineStyle && st.outlineStyle !== 'none' || (st.boxShadow && st.boxShadow !== 'none') || st.borderColor || st.backgroundColor || st.textDecorationLine)) hasAlt = true;
      }
    });
    doc.querySelectorAll('[style]').forEach((e) => {
      if (/animation/.test(e.getAttribute('style'))) motion = true;
      if (/outline\s*:\s*(none|0)/i.test(e.getAttribute('style'))) killers.push({ sel: 'inline style', el: e });
    });
    if (motion && !reduced) {
      add('reduced-motion', doc.querySelector('style') || root, {
        fix: { kind: 'auto', label: 'Add prefers-reduced-motion block', run: (d) => ensureStyle(d, 'fathom-motion-css', '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}') },
      });
    }
    if (killers.length && !hasAlt) {
      add('focus-visible', killers.find((k) => k.el)?.el || doc.querySelector('style') || root, {
        detail: 'Removed on: ' + [...new Set(killers.map((k) => k.sel))].slice(0, 4).join(', '),
        fix: { kind: 'auto', label: 'Add a visible :focus-visible ring', run: (d) => ensureStyle(d, 'fathom-focus-css', ':focus-visible{outline:3px solid #0a84ff!important;outline-offset:3px!important;border-radius:4px}') },
      });
    }
  }

  /* media */
  doc.querySelectorAll('video').forEach((v) => {
    if (!v.querySelector('track[kind=captions],track[kind=subtitles]')) add('video-captions', v, { fix: { kind: 'guided', label: 'Add <track kind="captions" src="captions.vtt" srclang="en"> inside the video, with a WebVTT file.' } });
  });
  doc.querySelectorAll('video[autoplay],audio[autoplay]').forEach((m) => {
    if (!(m.hasAttribute('muted') && m.hasAttribute('controls'))) add('autoplay', m, { fix: { kind: 'auto', label: 'Remove autoplay', run: () => { m.removeAttribute('autoplay'); m.setAttribute('controls', ''); } } });
  });

  /* keyboard semantics */
  doc.querySelectorAll('[onclick],[data-fx-onclick]').forEach((el) => {
    if (/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName)) return;
    if (el.getAttribute('role') && el.hasAttribute('tabindex')) return;
    if (!rendered(el)) return;
    add('clickable-div', el, {
      fix: { kind: 'auto', label: 'Add role, tabindex and key handler', run: () => {
        if (!el.getAttribute('role')) el.setAttribute('role', 'button');
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        if (!el.hasAttribute('data-fx-onkeydown') && !el.hasAttribute('onkeydown')) el.setAttribute('data-fx-onkeydown', "if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}");
      } },
    });
  });
  doc.querySelectorAll('[tabindex]').forEach((el) => {
    if (parseInt(el.getAttribute('tabindex'), 10) > 0) add('tabindex-positive', el, { fix: { kind: 'auto', label: 'Use tabindex="0"', run: () => el.setAttribute('tabindex', '0') } });
  });
  doc.querySelectorAll('[aria-hidden=true]').forEach((h) => {
    const f = [...h.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter((e) => focusable(e));
    if (h.matches('a[href],button,input,select,textarea,[tabindex]') && focusable(h)) f.unshift(h);
    if (f.length) add('aria-hidden-focus', f[0], { els: f, title: `${f.length} focusable element${f.length > 1 ? 's' : ''} inside aria-hidden`, fix: { kind: 'auto', label: 'Take them out of the tab order', run: () => f.forEach((e) => e.setAttribute('tabindex', '-1')) } });
  });
  {
    const seen = new Map();
    doc.querySelectorAll('[id]').forEach((e) => { if (!seen.has(e.id)) seen.set(e.id, []); seen.get(e.id).push(e); });
    seen.forEach((list, id) => {
      if (list.length > 1) add('duplicate-id', list[1], { els: list, title: `id="${id}" is used ${list.length} times`, fix: { kind: 'auto', label: 'Make ids unique', run: () => list.slice(1).forEach((e, i) => { e.id = `${id}-${i + 2}`; }) } });
    });
  }
  doc.querySelectorAll('table').forEach((t) => {
    if (['presentation', 'none'].includes(t.getAttribute('role'))) return;
    if (!rendered(t) || t.querySelector('th')) return;
    const rows = t.querySelectorAll('tr');
    if (rows.length > 1 && rows[0].children.length > 1) add('table-headers', t, { fix: { kind: 'auto', label: 'Make the first row column headers', run: () => { [...rows[0].children].forEach((c) => { const th = retag(c, 'th'); th.setAttribute('scope', 'col'); }); } } });
  });
  doc.querySelectorAll('iframe').forEach((f) => {
    if (norm(f.getAttribute('title')) || f.closest('[aria-hidden=true]')) return;
    let host = 'Embedded content';
    const sd = f.getAttribute('srcdoc');
    if (sd) {
      const t = norm(new DOMParser().parseFromString(sd, 'text/html').body.textContent).split(' ').slice(0, 6).join(' ');
      if (t) host = t;
    } else {
      try { const h = new URL(f.getAttribute('src') || '', 'https://x.test').hostname.replace(/^www\./, ''); if (h && h !== 'x.test') host = 'Embedded content from ' + h; } catch (e) { /* ignore */ }
    }
    add('iframe-title', f, { fix: { kind: 'input', label: 'Add title', placeholder: 'What is in this frame?', suggest: host, run: (d, v) => f.setAttribute('title', v) } });
  });

  out.sort((a, b) => SEV[b.severity].rank - SEV[a.severity].rank);
  return out;
}

export function penalty(findings) {
  const by = {};
  findings.forEach((f) => { (by[f.rule] ||= []).push(f); });
  let pen = 0;
  Object.values(by).forEach((list) => {
    const w = SEV[list[0].severity].w;
    const count = list.reduce((n, f) => n + Math.min(f.els.length, 3), 0);
    pen += w * (1 + 0.35 * (Math.min(count, 8) - 1));
  });
  return pen;
}
// Smooth, bounded curve: never hits zero on a real page, reaches 100 only when nothing is flagged.
export function score(findings) {
  return Math.round(100 * Math.exp(-penalty(findings) / SCORE_SCALE));
}
const SCORE_SCALE = 110;
export function tier(s) {
  if (s >= 90) return 'Crystal clear';
  if (s >= 70) return 'Clearing';
  if (s >= 45) return 'Choppy';
  return 'Murky';
}
export function personaLoad(findings) {
  const load = Object.fromEntries(Object.keys(PERSONAS).map((k) => [k, { w: 0, n: 0 }]));
  findings.forEach((f) => f.personas.forEach((p) => { load[p].w += SEV[f.severity].w; load[p].n += 1; }));
  const max = Math.max(1, ...Object.values(load).map((v) => v.w));
  return Object.entries(load).map(([k, v]) => ({ key: k, label: PERSONAS[k], value: v.n, pct: v.w / max }));
}
export function applyFixes(doc, findings, { onlyIds } = {}) {
  let applied = 0, manual = 0;
  const list = findings.filter((f) => !onlyIds || onlyIds.includes(f.id));
  const ordered = [...list.filter((f) => !f.fix?.late), ...list.filter((f) => f.fix?.late)];
  for (const f of ordered) {
    if (!f.fix || f.fix.kind === 'guided') { manual++; continue; }
    try {
      f.fix.run(doc, f.fix.kind === 'input' ? f.fix.suggest : undefined);
      applied++;
    } catch (e) { manual++; }
  }
  return { applied, manual };
}
export function serialize(doc) {
  const clone = doc.documentElement.cloneNode(true);
  clone.querySelectorAll('script[type="text/fathom-inert"]').forEach((sc) => {
    if (sc.hasAttribute('data-fx-type')) { sc.setAttribute('type', sc.getAttribute('data-fx-type').replace(/^["']|["']$/g, '')); sc.removeAttribute('data-fx-type'); } else sc.removeAttribute('type');
  });
  const dt = doc.doctype ? `<!doctype ${doc.doctype.name}>\n` : '<!doctype html>\n';
  return dt + clone.outerHTML.replace(/(\s)data-fx-(on[a-z]+)(\s*=)/gi, '$1$2$3');
}

/* ====================== KEYBOARD ====================== */
export function tabStops(doc) {
  const win = doc.defaultView;
  const els = interactiveEls(doc).filter(focusable).filter((e) => !srOnly(e) || e.classList.contains('fathom-skip') || true);
  const pos = els.filter((e) => parseInt(e.getAttribute('tabindex') || '0', 10) > 0).sort((a, b) => parseInt(a.getAttribute('tabindex'), 10) - parseInt(b.getAttribute('tabindex'), 10));
  const rest = els.filter((e) => !(parseInt(e.getAttribute('tabindex') || '0', 10) > 0));
  const stops = [...pos, ...rest];
  const unreachable = [...doc.querySelectorAll('[onclick],[data-fx-onclick]')].filter((e) => rendered(e) && !stops.includes(e));
  doc.querySelectorAll('*').forEach((e) => {
    if (stops.includes(e) || unreachable.includes(e) || !rendered(e)) return;
    if (win.getComputedStyle(e).cursor === 'pointer' && !e.closest('a[href],button,[tabindex],label,summary') && !e.querySelector('a[href],button')) unreachable.push(e);
  });
  return { stops, unreachable };
}

/* ====================== SCREEN READER ====================== */
const endp = (t) => (/[.!?…]$/.test(t) ? t : t + '.');
const spokenFile = (src) => {
  const f = (src || '').split('/').pop().split('?')[0];
  return f.replace(/[-]/g, ' dash ').replace(/_/g, ' underscore ').replace(/\./g, ' dot ').replace(/\s+/g, ' ').trim() || 'unlabeled graphic';
};
export function transcript(doc) {
  const win = doc.defaultView;
  const items = [];
  const push = (it) => { it.id = items.length; items.push(it); };
  const INLINE = new Set(['span', 'em', 'strong', 'b', 'i', 'small', 'abbr', 'code', 'mark', 'time', 'sup', 'sub', 'u', 'cite', 'q', 'label']);
  const SPECIAL = 'a[href],button,input,select,textarea,img,h1,h2,h3,h4,h5,h6,[role=heading],[role=button],[role=link],svg,video,audio,iframe,table,ul,ol,summary';
  const isSpecial = (el) => el.matches(SPECIAL);

  const flush = (buf, el) => {
    const t = norm(buf.text);
    if (t) {
      let say = t;
      let shown = t;
      if (t.length > 170) {
        const cut = t.slice(0, 170).replace(/\s+\S*$/, '');
        say = cut.replace(/[,;:\-–—]+$/, '');
        shown = cut + '…';
      }
      push({ kind: 'text', name: shown, spoken: endp(say), el: buf.el || el, note: '' });
    }
    buf.text = ''; buf.el = null;
  };
  const landmarkOf = (el) => {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    if (tag === 'main' || role === 'main') return 'Main';
    if (tag === 'nav' || role === 'navigation') return 'Navigation';
    if (tag === 'header' && el.parentElement === doc.body || role === 'banner') return 'Banner';
    if (tag === 'footer' && el.parentElement === doc.body || role === 'contentinfo') return 'Content info';
    if (tag === 'aside' || role === 'complementary') return 'Complementary';
    if (tag === 'form' && (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))) return 'Form';
    return '';
  };
  const fieldPhrase = (el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') return 'Combo box';
    if (tag === 'textarea') return 'Edit text, multiline';
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    if (t === 'checkbox') return 'Checkbox, ' + (el.checked ? 'checked' : 'not checked');
    if (t === 'radio') return 'Radio button, ' + (el.checked ? 'selected' : 'not selected');
    if (t === 'password') return 'Password edit text';
    if (t === 'email') return 'Email edit text';
    if (t === 'search') return 'Search edit text';
    if (t === 'range') return 'Slider';
    if (t === 'date') return 'Date picker';
    return 'Edit text';
  };

  function walk(node) {
    const buf = { text: '', el: null };
    for (const c of [...node.childNodes]) {
      if (c.nodeType === 3) { if (norm(c.nodeValue)) { buf.text += ' ' + c.nodeValue; buf.el ||= node; } continue; }
      if (c.nodeType !== 1) continue;
      const el = c;
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'template', 'noscript', 'link', 'meta', 'title'].includes(tag)) continue;
      if (el.getAttribute('aria-hidden') === 'true' || el.hidden || !rendered(el)) continue;
      if (INLINE.has(tag) && !isSpecial(el) && !el.querySelector(SPECIAL)) { buf.text += ' ' + textOf(el, win); buf.el ||= el; continue; }
      flush(buf, node);
      if (el.matches('[onclick],[data-fx-onclick]') && !isSpecial(el) && !el.getAttribute('role')) {
        const tx = norm(textOf(el, win));
        push({ kind: 'text', name: tx, el, spoken: endp(tx || 'Clickable element'), bad: true, note: 'Looks like a button but is announced as plain text, and the keyboard cannot reach it' });
        continue;
      }
      const lm = landmarkOf(el);
      if (lm && !(lm === 'Banner' && false)) {
        const lab = norm(el.getAttribute('aria-label'));
        push({ kind: 'landmark', name: lm, el, spoken: `${lab ? lab + ' ' : ''}${lm} landmark.` });
      }
      const isHeading = /^h[1-6]$/.test(tag) || el.getAttribute('role') === 'heading';
      if (isHeading) {
        const level = /^h[1-6]$/.test(tag) ? +tag[1] : parseInt(el.getAttribute('aria-level') || '2', 10);
        const name = norm(textOf(el, win));
        push({ kind: 'heading', level, name, el, spoken: `Heading level ${level}. ${endp(name || 'Empty heading')}`, bad: !name, note: !name ? 'Empty heading' : '' });
        continue;
      }
      if (tag === 'a' && el.hasAttribute('href') || el.getAttribute('role') === 'link') {
        const { name } = accName(el, win);
        const gen = GENERIC.has(lc(name).replace(/[.…→>»]+$/g, '').trim());
        push({ kind: 'link', name, el, spoken: name ? `Link. ${endp(name)}` : 'Unlabeled link.', bad: !name || gen, note: !name ? 'No accessible name' : gen ? 'Vague link text' : '' });
        continue;
      }
      if (tag === 'button' || el.getAttribute('role') === 'button' || (tag === 'input' && ['button', 'submit', 'reset', 'image'].includes((el.getAttribute('type') || '').toLowerCase())) || tag === 'summary') {
        const { name } = accName(el, win);
        push({ kind: 'button', name, el, spoken: name ? `Button. ${endp(name)}` : 'Unlabeled button.', bad: !name, note: !name ? 'No accessible name' : '' });
        continue;
      }
      if (['input', 'select', 'textarea'].includes(tag)) {
        if (tag === 'input' && (el.getAttribute('type') || '').toLowerCase() === 'hidden') continue;
        const { name, src } = accName(el, win);
        const ph = src === 'placeholder';
        push({ kind: 'field', name, el, spoken: `${fieldPhrase(el)}. ${name ? endp(name) : 'Blank.'}`, bad: !name || ph, note: !name ? 'No label, so it is announced as blank' : ph ? 'Only a placeholder: the label disappears as soon as you type' : '' });
        continue;
      }
      if (tag === 'img') {
        if (el.hasAttribute('alt') && !norm(el.getAttribute('alt'))) continue; // decorative
        const alt = norm(el.getAttribute('alt'));
        const missing = !el.hasAttribute('alt');
        const name = alt || spokenFile(el.getAttribute('src'));
        push({ kind: 'img', name: alt || (el.getAttribute('src') || '').split('/').pop(), el, spoken: `Graphic. ${endp(name)}`, bad: missing, note: missing ? 'No alt text, so the file name is read out' : '' });
        continue;
      }
      if (tag === 'svg') {
        const t = norm(el.querySelector('title')?.textContent || el.getAttribute('aria-label'));
        if (t) push({ kind: 'img', name: t, el, spoken: `Graphic. ${endp(t)}` });
        continue;
      }
      if (tag === 'video' || tag === 'audio') {
        const cap = el.querySelector('track[kind=captions],track[kind=subtitles]');
        push({ kind: 'media', name: tag, el, spoken: `${tag === 'video' ? 'Video' : 'Audio'}${cap ? ' with captions' : ''}.`, bad: tag === 'video' && !cap, note: tag === 'video' && !cap ? 'No captions track' : '' });
        continue;
      }
      if (tag === 'iframe') {
        const t = norm(el.getAttribute('title'));
        push({ kind: 'frame', name: t, el, spoken: t ? `Frame. ${endp(t)}` : 'Frame.', bad: !t, note: !t ? 'Frame has no title' : '' });
        continue;
      }
      if (tag === 'ul' || tag === 'ol') {
        const n = el.querySelectorAll(':scope > li').length;
        push({ kind: 'list', name: `${n} items`, el, spoken: `List with ${n} item${n === 1 ? '' : 's'}.` });
        walk(el);
        continue;
      }
      if (tag === 'table') {
        const rows = el.querySelectorAll('tr').length;
        const cols = el.querySelector('tr')?.children.length || 0;
        const hasTh = !!el.querySelector('th');
        push({ kind: 'table', name: `${rows} rows`, el, spoken: `Table with ${rows} rows and ${cols} columns.${hasTh ? '' : ' No column headers.'}`, bad: !hasTh && rows > 1, note: !hasTh && rows > 1 ? 'No header cells, so values are read without context' : '' });
        if (hasTh) {
          el.querySelectorAll('tr').forEach((tr, i) => { if (i < 3) push({ kind: 'text', name: norm(textOf(tr, win)), spoken: norm(textOf(tr, win)).replace(/\s+/g, ', ') + '.', el: tr }); });
        } else {
          el.querySelectorAll('tr').forEach((tr, i) => { if (i < 3) push({ kind: 'text', name: norm(textOf(tr, win)), spoken: norm(textOf(tr, win)).replace(/\s+/g, ', ') + '.', el: tr }); });
        }
        continue;
      }
      walk(el);
    }
    flush(buf, node);
  }
  walk(doc.body);
  return items;
}

/* ====================== LANGUAGE ====================== */
const TERMS = [
  { re: /\b(hey |hi |hello )?guys\b/gi, alt: 'everyone', why: '“Guys” reads as male-only and leaves people out when addressing a mixed group.', cat: 'Gender' },
  { re: /\bladies and gentlemen\b/gi, alt: 'everyone', why: 'Excludes people who are not men or women.', cat: 'Gender' },
  { re: /\bmanpower\b/gi, alt: 'workforce', why: 'Use a gender-neutral word for people doing work.', cat: 'Gender' },
  { re: /\bman[- ]hours?\b/gi, alt: 'person-hours', why: 'Use a gender-neutral unit.', cat: 'Gender' },
  { re: /\bmankind\b/gi, alt: 'humankind', why: 'Use a gender-neutral word.', cat: 'Gender' },
  { re: /\bchairman\b/gi, alt: 'chair', why: 'Use a gender-neutral title.', cat: 'Gender' },
  { re: /\bsalesman\b/gi, alt: 'salesperson', why: 'Use a gender-neutral title.', cat: 'Gender' },
  { re: /\bman-?made\b/gi, alt: 'human-made', why: 'Use a gender-neutral word.', cat: 'Gender' },
  { re: /\b(he\/she|s\/he|he or she)\b/gi, alt: 'they', why: 'Singular “they” includes everyone, including non-binary people.', cat: 'Gender' },
  { re: /\bcrazy\b/gi, alt: 'surprising', why: 'Casual use of words tied to mental health stigmatizes people who live with it.', cat: 'Ableist' },
  { re: /\binsane\b/gi, alt: 'incredible', why: 'Casual use of words tied to mental health stigmatizes people who live with it.', cat: 'Ableist' },
  { re: /\blame\b/gi, alt: 'disappointing', why: 'Uses a disability as an insult.', cat: 'Ableist' },
  { re: /\bdumb\b/gi, alt: 'unclear', why: 'Historically used against deaf and non-speaking people.', cat: 'Ableist' },
  { re: /\bcrippl(e|ed|ing)\b/gi, alt: 'limited', why: 'Uses a disability as a metaphor for failure.', cat: 'Ableist' },
  { re: /\btone[- ]deaf\b/gi, alt: 'out of touch', why: 'Uses deafness as a metaphor for ignorance.', cat: 'Ableist' },
  { re: /\bblind (spot|to)\b/gi, alt: 'gap', why: 'Uses blindness as a metaphor for ignorance.', cat: 'Ableist' },
  { re: /\bsanity[- ]check\b/gi, alt: 'quick check', why: 'Stigmatizes mental health.', cat: 'Ableist' },
  { re: /\bwheelchair[- ]bound\b|\bconfined to a wheelchair\b/gi, alt: 'wheelchair-using', why: 'A wheelchair is mobility, not confinement.', cat: 'Ableist' },
  { re: /\bsuffers? from\b/gi, alt: 'lives with', why: 'Frames a condition as constant suffering. “Lives with” or “has” is neutral.', cat: 'Ableist' },
  { re: /\bhandicapped\b/gi, alt: 'disabled', why: 'Outdated; most disability communities prefer “disabled”.', cat: 'Ableist' },
  { re: /\bwhitelist(ed|ing)?\b/gi, alt: 'allowlist', why: 'Ties “good” to white and “bad” to black. Use allowlist.', cat: 'Tech terms' },
  { re: /\bblacklist(ed|ing)?\b/gi, alt: 'blocklist', why: 'Ties “bad” to black. Use blocklist.', cat: 'Tech terms' },
  { re: /\bmaster\/slave\b/gi, alt: 'primary/replica', why: 'Slavery is not a technical metaphor.', cat: 'Tech terms' },
  { re: /\bgrandfathered\b/gi, alt: 'legacy', why: 'Comes from laws that excluded Black voters.', cat: 'Tech terms' },
  { re: /\bdummy\b/gi, alt: 'placeholder', why: 'Historically used against non-speaking people.', cat: 'Tech terms' },
  { re: /\brock ?stars?\b|\bninjas?\b|\bgurus?\b/gi, alt: 'expert', why: 'Hype titles in job posts discourage many qualified applicants.', cat: 'Culture' },
  { re: /\bculture fit\b/gi, alt: 'values add', why: '“Culture fit” tends to favor people who are already like the team.', cat: 'Culture' },
  { re: /\bclick here\b/gi, alt: 'select here', why: 'Assumes a mouse. Touch, keyboard and voice users do not “click”.', cat: 'Device-neutral' },
  { re: /\butili[sz]e\b/gi, alt: 'use', why: 'Plain language is easier for everyone, including non-native readers.', cat: 'Plain language' },
  { re: /\bleverage\b/gi, alt: 'use', why: 'Jargon slows reading for people with cognitive differences.', cat: 'Plain language' },
  { re: /\bin order to\b/gi, alt: 'to', why: 'Shorter is clearer.', cat: 'Plain language' },
  { re: /\bprior to\b/gi, alt: 'before', why: 'Shorter is clearer.', cat: 'Plain language' },
  { re: /\bcommence\b/gi, alt: 'start', why: 'Plain language is easier to read.', cat: 'Plain language' },
  { re: /\bfacilitate\b/gi, alt: 'help', why: 'Plain language is easier to read.', cat: 'Plain language' },
  { re: /\bsynergy\b|\bparadigm shift\b/gi, alt: 'teamwork', why: 'Buzzwords hide the meaning.', cat: 'Plain language' },
];
const matchCase = (orig, rep) => (orig[0] === orig[0].toUpperCase() && orig[0] !== orig[0].toLowerCase() ? rep.replace(/^./, (c) => c.toUpperCase()) : rep);

function syllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}
export function readability(text) {
  const sentences = text.split(/(?<=[.!?])\s+/).map(norm).filter((s) => s.split(' ').length >= 3);
  const words = text.match(/[A-Za-z’'-]+/g) || [];
  if (words.length < 20 || !sentences.length) return null;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const wps = words.length / sentences.length;
  const spw = syl / words.length;
  const fre = 206.835 - 1.015 * wps - 84.6 * spw;
  const fk = 0.39 * wps + 11.8 * spw - 15.59;
  return { words: words.length, sentences: sentences.length, wps, fre: Math.max(0, Math.min(100, fre)), grade: Math.max(1, fk), minutes: Math.max(1, Math.round(words.length / 200)) };
}
export function languageScan(doc) {
  const walker = doc.createTreeWalker(doc.body, 4, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|TITLE)$/.test(p.tagName)) return 2;
      if (!norm(n.nodeValue)) return 2;
      if (!rendered(p)) return 2;
      return 1;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const hits = [];
  nodes.forEach((node) => {
    TERMS.forEach((t) => {
      t.re.lastIndex = 0;
      let m;
      while ((m = t.re.exec(node.nodeValue))) {
        const orig = m[0];
        let rep = t.alt;
        if (/^(hey |hi |hello )guys$/i.test(orig)) rep = orig.replace(/guys$/i, 'everyone');
        else if (/^crippl(ed|ing)$/i.test(orig)) rep = 'limiting';
        else if (/^whitelist(ed|ing)$/i.test(orig)) rep = orig.replace(/whitelist/i, 'allowlist');
        else if (/^blacklist(ed|ing)$/i.test(orig)) rep = orig.replace(/blacklist/i, 'blocklist');
        else if (/^suffers\s+from$/i.test(orig)) rep = 'lives with';
        else if (/^suffer\s+from$/i.test(orig)) rep = 'live with';
        else if (/^confined to a wheelchair$/i.test(orig)) rep = 'who uses a wheelchair';
        if (!/^(hey |hi |hello )/i.test(orig)) rep = matchCase(orig, rep);
        else rep = orig.replace(/guys$/i, 'everyone');
        hits.push({ id: `lang-${++UID}`, node, start: m.index, len: orig.length, term: orig, rep, why: t.why, cat: t.cat, el: node.parentElement, context: norm(node.nodeValue).slice(Math.max(0, m.index - 28), m.index + orig.length + 28) });
        if (m.index === t.re.lastIndex) t.re.lastIndex++;
      }
    });
  });
  // prose for readability
  const prose = [...doc.body.querySelectorAll('p,li,blockquote,dd,figcaption')].filter((e) => rendered(e) && !e.closest('nav,header,footer,[aria-hidden=true]')).map((e) => norm(e.textContent)).filter((t) => t.split(' ').length >= 5);
  const text = prose.map((t) => (/[.!?]$/.test(t) ? t : t + '.')).join(' ');
  const read = readability(text);
  const longSentences = [];
  prose.forEach((t) => t.split(/(?<=[.!?])\s+/).forEach((s) => { if (s.split(' ').length >= 26) longSentences.push(s); }));
  const shouting = [...doc.body.querySelectorAll('p,li,h1,h2,h3,h4,span,a,button')].filter((e) => rendered(e) && e.children.length === 0 && /^[A-Z0-9 ,.!?'’-]{18,}$/.test(norm(e.textContent)) && norm(e.textContent).split(' ').length >= 3 && win(e).textTransform === 'none');
  function win(e) { return doc.defaultView.getComputedStyle(e); }
  return { hits, read, longSentences, shouting, prose: prose.length };
}
export function applyLanguageHit(hit) {
  const v = hit.node.nodeValue;
  if (v.slice(hit.start, hit.start + hit.len) !== hit.term) return false;
  hit.node.nodeValue = v.slice(0, hit.start) + hit.rep + v.slice(hit.start + hit.len);
  return true;
}
export function applyAllLanguage(hits) {
  const byNode = new Map();
  hits.forEach((h) => { if (!byNode.has(h.node)) byNode.set(h.node, []); byNode.get(h.node).push(h); });
  let n = 0;
  byNode.forEach((list, node) => {
    list.sort((a, b) => b.start - a.start).forEach((h) => {
      const v = node.nodeValue;
      if (v.slice(h.start, h.start + h.len) === h.term) { node.nodeValue = v.slice(0, h.start) + h.rep + v.slice(h.start + h.len); n++; }
    });
  });
  return n;
}
export function languageScore(scan) {
  let s = 100;
  s -= Math.min(40, scan.hits.length * 6);
  if (scan.read) s -= Math.max(0, Math.min(25, (scan.read.grade - 9) * 4));
  s -= Math.min(15, scan.longSentences.length * 5);
  s -= Math.min(10, scan.shouting.length * 5);
  return Math.max(0, Math.round(s));
}

/* ====================== SAFE RENDERING ====================== */
// The preview iframe never runs scripts. We neutralize them up front so the browser does not log
// "blocked script" noise, and restore the original markup when serializing back to the editor.
export function inert(src) {
  return src
    .replace(/(\s)on([a-z]+)(\s*=)/gi, '$1data-fx-on$2$3')
    .replace(/<script\b([^>]*)>/gi, (m, attrs) => {
      const a = attrs.replace(/\stype\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, ' data-fx-type=$1');
      return `<script${a} type="text/fathom-inert">`;
    });
}
export function restore(doc) {
  doc.querySelectorAll('script[type="text/fathom-inert"]').forEach((sc) => {
    if (sc.hasAttribute('data-fx-type')) { sc.setAttribute('type', sc.getAttribute('data-fx-type').replace(/^["']|["']$/g, '')); sc.removeAttribute('data-fx-type'); } else sc.removeAttribute('type');
  });
}
