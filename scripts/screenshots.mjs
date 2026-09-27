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

// Okazy do galerii: [podpis, cechy, nisza].
const CREATURES = [
  ['Prazwierzę', [], 'woda'],
  ['Filtrator', ['filter_feeding', 'eyes', 'lateral_line'], 'woda'],
  ['Ryba pancerna', ['fins', 'shell', 'jaws', 'eyes'], 'woda'],
  ['Szybka ryba', ['fins', 'fast_muscle', 'jaws', 'scales', 'eyes', 'lateral_line', 'many_eggs'], 'przybrzeze'],
  ['Pierwszy czworonóg', ['fins', 'limbs', 'jaws', 'eyes', 'scales', 'ganglia'], 'przybrzeze'],
  ['Czworonóg lądowy', ['fins', 'limbs', 'jaws', 'eyes', 'scales', 'amniotic_egg', 'camouflage'], 'lad'],
  ['Stałocieplny', ['fins', 'limbs', 'jaws', 'omnivory', 'eyes', 'scales', 'endothermy', 'insulation', 'ganglia', 'brain'], 'lad'],
  ['Ptak', ['fins', 'limbs', 'flight', 'jaws', 'eyes', 'scales', 'endothermy', 'insulation', 'many_eggs', 'parental_care'], 'powietrze'],
  ['Pterozaur', ['fins', 'limbs', 'flight', 'jaws', 'eyes', 'scales', 'endothermy'], 'powietrze'],
  ['Łowca w stadzie', ['fins', 'limbs', 'jaws', 'eyes', 'scales', 'endothermy', 'insulation', 'ganglia', 'brain', 'pack_hunting'], 'lad'],
  ['Gatunek rozumny', ['fins', 'limbs', 'jaws', 'omnivory', 'eyes', 'scales', 'endothermy', 'insulation', 'ganglia', 'brain',
    'big_brain', 'social', 'grasping_hand', 'tool_use', 'parental_care', 'many_eggs'], 'lad'],
  ['Wodny z mózgiem', ['fins', 'eyes', 'ganglia', 'brain', 'jaws', 'camouflage'], 'woda']
];

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

    if (vpName === 'desktop') {
      // Raport tury i kodeks — okna modalne.
      await page.click('#btn-simulate');
      await page.waitForSelector('#modal-report:not([hidden])');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${outDir}/report-${tag}.png` });
      await page.click('#btn-report-close');
      await page.click('#btn-codex');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${outDir}/codex-${tag}.png` });

      // Katalog wszystkich ikon (arkusz do oceny stylu).
      await page.evaluate(() => {
        const art = window.GameArt;
        const cats = ['pokarm', 'lokomocja', 'obrona', 'zmysly', 'rozrod', 'termoregulacja', 'uklad_nerwowy'];
        const traitCat = {};
        window.GameData.TRAITS.forEach((t) => { traitCat[t.id] = t.category; });
        const cells = art.iconKeys().map((k) => {
          const [kind, id] = k.split(':');
          const attr = kind === 'trait' ? ` data-cat="${traitCat[id]}"` : kind === 'cat' ? ` data-cat="${id}"`
            : kind === 'niche' ? ` data-niche="${id}"` : '';
          return `<figure${attr} style="margin:0;text-align:center;font-size:12px;color:var(--ink-soft)">` +
            `<div style="font-size:44px;color:var(--ink)">${art.icon(k)}</div><figcaption>${k}</figcaption></figure>`;
        }).join('');
        void cats;
        document.body.innerHTML = '<main style="padding:24px"><h1>Katalog ikon</h1>' +
          '<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:18px 10px">' + cells + '</div></main>';
      });
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${outDir}/icons-${scheme}.png`, fullPage: true });

      // Galeria okazów: to samo zwierzę z różnymi zestawami cech i niszami.
      await page.evaluate((sets) => {
        document.body.innerHTML = '<main style="padding:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px"></main>';
        const m = document.querySelector('main');
        sets.forEach(([name, traits, niche], i) => {
          const fig = document.createElement('figure'); fig.className = 'creature-figure'; fig.style.margin = '0';
          const host = document.createElement('div'); host.className = 'creature-portrait';
          const cap = document.createElement('figcaption'); cap.className = 'creature-caption'; cap.textContent = name;
          fig.append(host, cap); m.append(fig);
          window.GameArt.portrait.update(host, { id: 'G' + i, name, traits, niche }, { climate: 'zimno' });
        });
      }, CREATURES);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${outDir}/creatures-${scheme}.png`, fullPage: true });
    }
    await ctx.close();
  }
}

await browser.close();
if (errors.length) {
  console.error('Błędy strony:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Zrzuty zapisane w ' + outDir);
