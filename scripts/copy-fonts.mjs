// Vercel build step: self-host fonts from the fontsource packages so no font binaries live in git.
import { copyFileSync, mkdirSync } from 'node:fs';
const F = [
  ['@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2', 'fraunces.woff2'],
  ['@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2', 'fraunces-italic.woff2'],
  ['@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'inter.woff2'],
  ['@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', 'jbmono-400.woff2'],
  ['@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2', 'jbmono-600.woff2'],
];
mkdirSync('public/fonts', { recursive: true });
for (const [from, to] of F) copyFileSync(new URL(`../node_modules/${from}`, import.meta.url), new URL(`../public/fonts/${to}`, import.meta.url));
console.log(`copied ${F.length} font files`);
