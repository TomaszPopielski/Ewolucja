/*
 * fun-ui.mjs — mierniki „miodności” w prawdziwym interfejsie (docs/MIODNOSC.md, sekcja 1.1).
 *
 * Otwiera zbudowaną grę (dist/index.html) w Chromium i rozgrywa partię: decyzje podejmuje
 * bot „tactics” z test/bots.js (stan przez zapis w localStorage), a skrypt mierzy czas
 * animacji tury, liczbę słów w raporcie, położenie przycisku „Przeżyj turę” i wysokość
 * ekranu gry. Użycie: npm run build && node scripts/fun-ui.mjs [kod_świata]
 */
import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SEED = process.argv[2] || 'MIOD01';
const url = pathToFileURL(resolve('dist/index.html')).href;
const botsSrc = readFileSync(resolve('test/bots.js'), 'utf8');
const SAVE = 'ewolucja.save.v4';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const inject = `(function(){var module={exports:{}};var require=function(p){return /data/.test(p)?window.GameData:window.Engine;};${botsSrc};window.Bots=module.exports;})();`;

const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('ewolucja.tutorialDone', '1'); } catch (e) {} });
await page.goto(url); await page.waitForTimeout(400);
await page.fill('#species-name', 'Miodek'); await page.fill('#world-seed', SEED);
await page.uncheck('#prologue-toggle');
await page.locator('#scenario-cards .scenario-card').first().click();
await page.waitForSelector('#screen-game:not([hidden])'); await page.waitForTimeout(500);
const layout = await page.evaluate(() => {
  const b = document.querySelector('#btn-simulate').getBoundingClientRect();
  return { btnVisible: b.top >= 0 && b.bottom <= innerHeight, pageH: document.documentElement.scrollHeight };
});
const turns = [];
for (let i = 0; i < 30; i++) {
  if (!(await page.locator('#screen-game').isVisible())) break;
  await page.addScriptTag({ content: inject });
  await page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)); s.botPref = 'land'; localStorage.setItem(key, JSON.stringify(window.Bots.stepFor('tactics', s))); }, SAVE);
  await page.reload(); await page.waitForTimeout(400);
  if (!(await page.locator('#btn-simulate').isVisible())) {
    const why = await page.evaluate(() => ({ screens: ['screen-start', 'screen-game', 'screen-end'].filter((id) => !document.getElementById(id).hidden),
      modals: Array.from(document.querySelectorAll('.modal')).filter((m) => !m.hidden).map((m) => m.id) }));
    console.error('przycisk tury niewidoczny w turze ' + (i + 1) + ': ' + JSON.stringify(why));
    await page.screenshot({ path: 'fun-ui-debug.png', fullPage: true });
    break;
  }
  const t0 = Date.now();
  await page.click('#btn-simulate');
  await page.waitForSelector('#modal-report:not([hidden])', { timeout: 30000 });
  const ms = Date.now() - t0;
  const words = await page.evaluate(() => document.querySelector('#report-headline').innerText.split(/\s+/).filter(Boolean).length);
  turns.push({ ms, words });
  await page.click('#btn-report-close'); await page.waitForTimeout(250);
  if (await page.locator('#modal-outlook').isVisible().catch(() => false)) await page.click('#btn-outlook-continue');
}
const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length));
console.log(JSON.stringify({ seed: SEED, errors, ...layout, turns: turns.length,
  avgTurnMs: avg(turns.map((t) => t.ms)), avgHeadlineWords: avg(turns.map((t) => t.words)), maxHeadlineWords: Math.max(...turns.map((t) => t.words)) }, null, 1));
await browser.close();
