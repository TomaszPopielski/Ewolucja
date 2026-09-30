/*
 * visual-check.mjs — test wizualnej regresji rysunku stworzeń.
 *
 * Rysuje miniatury okazów (scripts/specimens.mjs) w nieruchomej pozie i
 * porównuje piksele z wzorcami z test/visual/. Wzorce trzeba świadomie
 * odświeżyć po zmianie wyglądu: npm run visual -- --update
 * Użycie: npm run build && npm run visual
 * Wymaga Chromium (CHROMIUM_PATH albo /opt/pw-browsers/chromium).
 */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CREATURES } from './specimens.mjs';

const update = process.argv.includes('--update');
const baseDir = resolve('test/visual');
const actualDir = resolve('test/visual/_actual');
const MAX_DIFF = 0.004;      // dopuszczalny ułamek różniących się pikseli
const CHANNEL_TOL = 28;      // dopuszczalna różnica kanału (antyaliasing)
const executablePath = process.env.CHROMIUM_PATH ||
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const slug = (i, name) => String(i).padStart(2, '0') + '-' + name.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

mkdirSync(baseDir, { recursive: true });
const browser = await chromium.launch({ executablePath });
const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, colorScheme: 'light', deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('ewolucja.tutorialDone', '1'); } catch (e) { /* brak dostępu */ } });
await page.goto(pathToFileURL(resolve('dist/index.html')).href);
await page.waitForFunction(() => !!window.GameArt);

const thumbs = await page.evaluate((sets) => sets.map(([name, traits, niche, bodyPlan], i) =>
  window.GameArt.creature.thumb({ id: 'V' + i, name, traits, niche, bodyPlan }, 320, 180)), CREATURES);

const base64 = (url) => url.replace(/^data:image\/png;base64,/, '');
let failed = 0, changed = 0;
const seen = new Set();
for (let i = 0; i < CREATURES.length; i++) {
  const file = slug(i, CREATURES[i][0]) + '.png';
  seen.add(file);
  const actual = thumbs[i];
  if (!actual) { console.error('✗ ' + file + ': brak miniatury'); failed++; continue; }
  const path = resolve(baseDir, file);
  if (update || !existsSync(path)) {
    const same = existsSync(path) && readFileSync(path).equals(Buffer.from(base64(actual), 'base64'));
    if (!same) { writeFileSync(path, Buffer.from(base64(actual), 'base64')); changed++; }
    continue;
  }
  const baseUrl = 'data:image/png;base64,' + readFileSync(path).toString('base64');
  const ratio = await page.evaluate(async ([a, b, tol]) => {
    const load = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return 1;
    const px = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
    const da = px(ia), db = px(ib);
    let diff = 0;
    for (let p = 0; p < da.length; p += 4) {
      if (Math.abs(da[p] - db[p]) > tol || Math.abs(da[p + 1] - db[p + 1]) > tol || Math.abs(da[p + 2] - db[p + 2]) > tol || Math.abs(da[p + 3] - db[p + 3]) > tol) diff++;
    }
    return diff / (da.length / 4);
  }, [actual, baseUrl, CHANNEL_TOL]);
  if (ratio > MAX_DIFF) {
    failed++;
    mkdirSync(actualDir, { recursive: true });
    writeFileSync(resolve(actualDir, file), Buffer.from(base64(actual), 'base64'));
    console.error(`✗ ${file}: różni się ${(ratio * 100).toFixed(2)}% pikseli (bieżący obraz: test/visual/_actual/${file})`);
  }
}
if (update) {
  // usuń wzorce okazów, których już nie ma
  readdirSync(baseDir).filter((f) => f.endsWith('.png') && !seen.has(f)).forEach((f) => unlinkSync(resolve(baseDir, f)));
  console.log(`Wzorce zapisane: ${CREATURES.length} (zmienione: ${changed}) w test/visual/`);
} else if (failed) {
  console.error(`\nTest wizualny: ${failed} z ${CREATURES.length} okazów się różni. Jeśli zmiana jest zamierzona: npm run visual -- --update`);
} else {
  console.log(`Test wizualny: ${CREATURES.length} okazów zgodnych ze wzorcami.` + (changed ? ` (nowe wzorce: ${changed})` : ''));
}
await browser.close();
process.exit(failed ? 1 : 0);
