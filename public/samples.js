/* Two intentionally flawed sample pages. Every flaw is realistic, nothing is faked. */

const cafe = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>
  :root { --cream:#fbf3e6; --bean:#3a2418; --crema:#c58b55; --soft:#bfae98; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: Georgia, 'Times New Roman', serif; background:var(--cream); color:var(--bean); line-height:1.55; }
  a, button, input { outline: none; }
  header.top { display:flex; align-items:center; justify-content:space-between; padding:18px 40px; background:#fff7ea; border-bottom:1px solid #ead9bd; }
  .logo { font-size:24px; font-weight:700; letter-spacing:.02em; }
  nav a { margin-left:26px; color:var(--bean); text-decoration:none; font-size:15px; font-family: system-ui, sans-serif; }
  .tools { display:flex; gap:6px; }
  .icon-search, .icon-cart, .icon-menu { width:20px; height:20px; padding:0; border:0; background:transparent; cursor:pointer; }
  .icon-search svg, .icon-cart svg, .icon-menu svg { width:18px; height:18px; fill:none; stroke:var(--bean); stroke-width:2; }
  .hero { display:grid; grid-template-columns: 1.05fr 1fr; gap:36px; align-items:center; padding:56px 40px 40px; }
  .hero h4.kicker { margin:0 0 10px; font:600 13px/1 system-ui, sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--soft); }
  .hero h1 { font-size:54px; line-height:1.05; margin:0 0 16px; }
  .hero p.lead { font-size:19px; color:#a5927d; max-width:34ch; margin:0 0 26px; }
  .btn { display:inline-block; background:var(--bean); color:#fff3df; padding:14px 26px; border-radius:999px; font:600 15px/1 system-ui, sans-serif; cursor:pointer; }
  .hero img { width:100%; border-radius:26px; display:block; animation: floaty 4s ease-in-out infinite alternate; box-shadow: 0 24px 50px -24px #3a241866; }
  @keyframes floaty { from { transform: translateY(0) rotate(-1deg); } to { transform: translateY(-14px) rotate(1deg); } }
  section.menu { padding:20px 40px 36px; }
  section.menu h2 { font-size:32px; margin:0 0 6px; }
  section.menu h4.sub { margin:0 0 22px; font:400 15px/1.4 system-ui, sans-serif; color:var(--soft); }
  .cards { display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; }
  .card { background:#fff; border-radius:20px; padding:14px 14px 18px; box-shadow:0 10px 30px -18px #3a241855; }
  .card img { width:100%; border-radius:14px; display:block; }
  .card h3 { margin:14px 0 4px; font-size:21px; }
  .card p { margin:0 0 10px; font:14px/1.5 system-ui, sans-serif; color:#b7a78f; }
  .card a { font:600 14px/1 system-ui, sans-serif; color:#d9a273; text-decoration:none; }
  .join { margin:10px 40px 36px; padding:30px; background:var(--bean); color:#fff3df; border-radius:24px; display:flex; gap:24px; align-items:center; justify-content:space-between; }
  .join h3 { margin:0; font-size:26px; }
  .join form { display:flex; gap:10px; }
  .join input { padding:13px 16px; border-radius:12px; border:1px solid #6b4a37; background:#4b3226; color:#fff3df; width:260px; font:15px system-ui, sans-serif; }
  .join input::placeholder { color:#a98f7c; }
  .join a.go { background:var(--crema); color:#fff; padding:13px 10px; border-radius:12px; font:600 11px/1 system-ui, sans-serif; text-decoration:none; }
  .hours { padding:0 40px 36px; }
  .hours h2 { font-size:28px; }
  .hours table { border-collapse:collapse; width:100%; max-width:520px; font:15px system-ui, sans-serif; }
  .hours td { padding:10px 14px; border-bottom:1px solid #ead9bd; }
  footer { padding:26px 40px 40px; background:#fff7ea; border-top:1px solid #ead9bd; display:flex; justify-content:space-between; align-items:center; font:13px system-ui, sans-serif; color:#b9a893; }
  footer .social { display:flex; gap:10px; }
  footer .social a { width:18px; height:18px; display:inline-block; }
  footer .social svg { width:18px; height:18px; fill:var(--bean); }
  @media (max-width: 760px) { .hero { grid-template-columns:1fr; padding:30px 20px; } .cards { grid-template-columns:1fr; } .join { flex-direction:column; align-items:flex-start; } header.top { padding:14px 20px; } nav { display:none; } }
</style>
</head>
<body>
<header class="top">
  <div class="logo">Maple &amp; Co.</div>
  <nav>
    <a href="#menu">Menu</a><a href="#story">Our story</a><a href="#hours">Hours</a><a href="#visit">Visit</a>
  </nav>
  <div class="tools">
    <button class="icon-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></button>
    <button class="icon-cart"><svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h10.2L20 7H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg></button>
    <button class="icon-menu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  </div>
</header>

<div class="hero">
  <div>
    <h4 class="kicker">Small-batch roasters</h4>
    <h1>Slow mornings, great coffee.</h1>
    <p class="lead">Single-origin beans roasted every Tuesday and a pastry case that sells out by ten.</p>
    <div class="btn" onclick="location.hash='order'">Order now</div>
  </div>
  <img src="/samples/hero-latte.svg">
</div>

<section class="menu" id="menu">
  <h2>This season's favorites</h2>
  <h4 class="sub">Baked and brewed fresh, every day</h4>
  <div class="cards">
    <article class="card">
      <img src="/samples/menu-croissant.svg" alt="image of croissant.png">
      <h3>Butter croissant</h3>
      <p>Laminated for three days. Flaky outside, tender inside.</p>
      <a href="/croissant">Read more</a>
    </article>
    <article class="card">
      <img src="/samples/menu-cold-brew.svg">
      <h3>Maple cold brew</h3>
      <p>Steeped for 18 hours with a splash of Vermont maple.</p>
      <a href="/cold-brew">Read more</a>
    </article>
    <article class="card">
      <img src="/samples/menu-pastry-box.svg">
      <h3>Weekend pastry box</h3>
      <p>Six of our best bakes. Pre-order by Friday at noon.</p>
      <a href="/pastry-box">Click here</a>
    </article>
  </div>
</section>

<div class="join">
  <h3>Get Tuesday roast alerts</h3>
  <form>
    <input type="email" placeholder="Your email address">
    <a class="go" href="#">GO</a>
  </form>
</div>

<div class="hours" id="hours">
  <h2>Opening hours</h2>
  <table>
    <tr><td>Monday – Friday</td><td>7:00 – 17:00</td></tr>
    <tr><td>Saturday</td><td>8:00 – 18:00</td></tr>
    <tr><td>Sunday</td><td>8:00 – 14:00</td></tr>
  </table>
</div>

<footer>
  <span>&copy; Maple &amp; Co. Roasters. 12 Harbor Street.</span>
  <div class="social">
    <a href="https://instagram.com/maple" class="icon-instagram"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#3a2418" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#3a2418" stroke-width="2"/></svg></a>
    <a href="https://facebook.com/maple" class="icon-facebook"><svg viewBox="0 0 24 24"><path d="M14 9V7c0-1 .4-1.5 1.5-1.5H17V3h-2.6C11.6 3 10 4.6 10 7v2H8v3h2v9h4v-9h2.6l.4-3z"/></svg></a>
  </div>
</footer>
</body>
</html>
`;

const study = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Study Buddy</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background:#f2f5fb; color:#1a2340; line-height:1.6; }
  .wrap { max-width:1000px; margin:0 auto; padding:34px 28px 56px; }
  .brand { display:flex; align-items:center; gap:10px; font-weight:800; font-size:21px; margin-bottom:30px; color:#2a3a8f; }
  .brand i { width:30px; height:30px; border-radius:9px; background:linear-gradient(135deg,#5b7cff,#8f5bff); display:inline-block; }
  .grid { display:grid; grid-template-columns: 1.1fr .9fr; gap:34px; align-items:start; }
  h1 { font-size:42px; line-height:1.1; margin:0 0 14px; letter-spacing:-.02em; }
  h4.eyebrow { margin:0 0 12px; color:#9aa5c9; font-size:13px; letter-spacing:.12em; text-transform:uppercase; }
  .copy { text-align:justify; font-size:17px; color:#3a4570; }
  .copy p { margin:0 0 14px; }
  .copy .small { font-size:11px; color:#a3acc8; }
  .copy a { color:#4a62d6; text-decoration:none; }
  .card { background:#fff; border-radius:22px; padding:26px; box-shadow:0 22px 50px -28px #2a3a8f55; }
  .card h2 { margin:0 0 4px; font-size:23px; }
  .card .hint { margin:0 0 18px; color:#97a2c5; font-size:14px; }
  .field { margin-bottom:14px; }
  .field input, .field select { width:100%; padding:13px 14px; border:1.5px solid #d7ddef; border-radius:12px; font:inherit; background:#fff; color:#1a2340; }
  .field input::placeholder { color:#b3bbd6; }
  .err { color:#e0453a; font-size:13px; margin-top:6px; }
  .field input.bad { border-color:#e0453a; }
  .row { display:flex; align-items:center; gap:10px; margin:16px 0; font-size:14px; color:#4a5580; }
  .row input { width:16px; height:16px; }
  .submit { width:100%; padding:14px; border:0; border-radius:12px; background:#5b7cff; color:#fff; font:700 16px/1 system-ui; cursor:pointer; }
  *:focus { outline:none; }
  .perks { display:flex; gap:14px; flex-wrap:wrap; margin-top:20px; }
  .perk { background:#fff; border-radius:16px; padding:14px 16px; font-size:14px; box-shadow:0 12px 26px -20px #2a3a8f66; }
  .perk b { display:block; font-size:22px; color:#5b7cff; }
  .spin { display:inline-block; animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { transform: scale(1);} 50% { transform: scale(1.08);} }
  aside.map { margin-top:26px; }
  @media (max-width: 760px) { .grid { grid-template-columns:1fr; } h1 { font-size:32px; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand"><i></i> Study Buddy</div>
  <div class="grid">
    <div>
      <h4 class="eyebrow">Free for every student</h4>
      <h1>Hey guys, welcome to the crazy way to study <span class="spin">✨</span></h1>
      <div class="copy">
        <p>We leverage synergy between our tutor community and your goals in order to utilize a personalized plan that facilitates progress, and we commence the moment you sign up, prior to any payment or credit card being required, because learning should never depend on the manpower your school can spare or on how much time you can spend scrolling through confusing menus before you find the right lesson.</p>
        <p>Wheelchair-bound students and students who suffer from dyslexia tell us the clean layout helps. Ask your teacher to whitelist our school email domain, then run a quick sanity check on your profile before your first session. <a href="/how-it-works">Click here</a> to see how matching works.</p>
        <p class="small">By joining you accept the terms of service and the privacy policy that govern the use of the platform.</p>
      </div>
      <div class="perks">
        <div class="perk"><b>24/7</b> peer help</div>
        <div class="perk"><b>1:1</b> mentors</div>
        <div class="perk"><b>0</b> cost to start</div>
      </div>
      <aside class="map">
        <iframe src="about:blank" srcdoc="<body style='margin:0;font:14px system-ui;padding:14px;background:#e8edfb;color:#1a2340'>Library study rooms: floor 2, rooms 4–9</body>" width="100%" height="76" style="border:0;border-radius:14px"></iframe>
      </aside>
    </div>

    <div class="card">
      <h2>Create your account</h2>
      <p class="hint">Takes under a minute</p>
      <form>
        <div class="field"><input type="text" placeholder="Full name" tabindex="3"></div>
        <div class="field"><input type="email" placeholder="School email" tabindex="2"></div>
        <div class="field"><input type="password" placeholder="Create password" class="bad" tabindex="1"><div class="err">Password too short</div></div>
        <div class="field">
          <select><option>Grade level</option><option>Grade 9</option><option>Grade 10</option><option>Grade 11</option><option>Grade 12</option></select>
        </div>
        <div class="row"><input type="checkbox" id="agree"><span>I agree to the terms</span></div>
        <button class="submit" type="button">Join Study Buddy</button>
      </form>
    </div>
  </div>
</div>
</body>
</html>
`;

export const SAMPLES = {
  cafe: { name: 'Maple & Co. café landing page', blurb: 'Visual-heavy page: low contrast, icon-only buttons, no focus ring, vague links.', html: cafe },
  study: { name: 'Study Buddy sign-up', blurb: 'Forms and language: unlabeled fields, color-only errors, exclusionary wording.', html: study },
};
export const BLANK = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>My page</title></head>
<body>
  <main>
    <h1>Paste your own HTML here</h1>
    <p>Fathom audits it live, right in your browser. Nothing is uploaded.</p>
  </main>
</body>
</html>
`;
