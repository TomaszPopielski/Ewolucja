/*
 * screenshots.mjs — automatyczne zrzuty ekranu zbudowanej gry (dist/index.html).
 *
 * Otwiera grę z pliku (file://), więc sprawdza też działanie offline.
 * Użycie: npm run build && npm run shots [-- katalog_wyjściowy]
 * Wymaga Chromium; ścieżkę można podać w zmiennej CHROMIUM_PATH.
 */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = resolve(process.argv[2] || 'screenshots');
const page_url = pathToFileURL(resolve('dist/index.html')).href;
const executablePath = process.env.CHROMIUM_PATH ||
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const VIEWPORTS = {
  desktop: { width: 1366, height: 900 },
  mobile: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }
};

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

for (const scheme of ['light', 'dark']) {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const { width, height, ...rest } = vp;
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, ...rest });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`[${scheme}/${vpName}] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${scheme}/${vpName}] console: ${m.text()}`); });
    // Bez samouczka — chcemy widzieć sam ekran gry.
    await page.addInitScript(() => { try { localStorage.setItem('ewolucja.tutorialDone', '1'); } catch (e) {} });
    await page.goto(page_url);
    await page.waitForTimeout(400);
    const tag = `${vpName}-${scheme}`;
    await page.screenshot({ path: `${outDir}/start-${tag}.png`, fullPage: true });

    await page.locator('#scenario-cards button, #scenario-cards .scenario-card').first().click();
    await page.waitForSelector('#screen-game:not([hidden])');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${outDir}/game-${tag}.png`, fullPage: vpName === 'desktop' });
    await ctx.close();
  }
}

await browser.close();
if (errors.length) {
  console.error('Błędy strony:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Zrzuty zapisane w ' + outDir);
