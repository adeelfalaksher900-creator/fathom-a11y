# Fathom

**See it. Hear it. Fix it.** Fathom dives into any web page and shows how deep its accessibility barriers go.
Built solo for [Technica 2026](https://technica-2026.devpost.com/) (accessibility, UI/UX and education tracks).

Paste or edit HTML, then:

- **See through other eyes.** Preview the page through protanopia, deuteranopia, tritanopia, achromatopsia, low-vision, glare and tunnel-vision lenses (physically based Machado 2009 matrices), or switch to a keyboard-only view that numbers every tab stop and flags clickable things the keyboard can never reach.
- **Hear what is really there.** A screen reader transcript is built from the accessibility tree and read aloud: unlabeled buttons, file-name images and anonymous fields become impossible to ignore. Human voices come from ElevenLabs (pre-rendered clips, or live through an optional serverless proxy); the browser voice is the fallback.
- **Fix it, and learn why.** 28 WCAG 2.2 rules, each with the people affected, the success criterion, a plain-English reason and a one-click fix that re-audits live. Contrast fixes find the closest passing color. Undo history and a Markdown report export are built in.
- **Make the words welcoming.** Inclusive-language suggestions (for example "Hey guys" to "Hi everyone") and a readability score (Flesch-Kincaid).

On the built-in samples the clarity score goes from 32 to 100 (cafe page) and from 47 to 100 (study sign-up page) with one click, and Fathom audited on its own page finds 0 barriers (and so does axe-core).

## Privacy and safety

Everything runs in the browser. Your HTML is rendered in a sandboxed same-origin iframe (`sandbox="allow-same-origin"`), scripts and inline handlers are neutralized before parsing and restored on export, links and forms inside the preview are blocked, and the site ships a strict Content Security Policy. Nothing is uploaded.

## Run it

```bash
npm install
npm run build   # copies the self-hosted fonts from npm (and optional ElevenLabs clips, see scripts/clips.example.json)
npm start       # http://localhost:4173
```

Optional live human voices: deploy to Vercel and set `ELEVENLABS_API_KEY` (and optionally `ELEVENLABS_VOICE_ID`) on the project. `api/voice.js` proxies text-to-speech with a small per-IP rate limit. Without a key the app uses pre-rendered clips or the browser voice.

## Tests

`npm test` runs 46 Playwright checks against the running app: functional flows, hostile-HTML sandbox tests, edge-case inputs, keyboard and ARIA behavior, seven viewport widths, reduced-motion and forced-colors, and an axe-core audit of Fathom itself (WCAG 2.0 to 2.2 A/AA plus best practices) in five UI states.

## How it works

`public/engine.js` is a dependency-free rules engine (DOM in, findings out). `public/app.js` is a no-build ES-module UI. The preview is laid out at a real device width and scaled to fit, so phone, tablet and desktop widths are honest.

## AI disclosure

This project was designed and built with AI assistance: Claude (Anthropic) wrote and tested the code and the demo-video storyboard under the author's direction. Voices are generated with ElevenLabs. Automated checks catch roughly a third of accessibility problems; always test with real assistive technology and real people.

## License

MIT
