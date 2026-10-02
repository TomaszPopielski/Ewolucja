/*
 * test/light.test.mjs — testy scenariusza barw dioramy (src/diorama/looks.ts) i układu scen.
 * Uruchom: node --experimental-strip-types test/light.test.mjs  (albo npm test)
 */
import { lookFor, aftermathStep, litSide, shadowLen, ERAS, NICHES } from '../src/diorama/looks.ts';
import { sceneLayout } from '../src/diorama/scenery.ts';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error('  ✗ ' + m); } };
const group = (n, fn) => { console.log('\n• ' + n); fn(); };

const rgb = (hex) => { const p = parseInt(hex.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };
const luma = (hex) => { const [r, g, b] = rgb(hex); return 0.3 * r + 0.59 * g + 0.11 * b; };
const sat = (hex) => { const c = rgb(hex); return Math.max(...c) - Math.min(...c); };
const colors = (l) => [...Object.values(l).filter((v) => typeof v === 'string'), l.sun.color];
const CLIMATES = ['cieplo', 'umiarkowanie', 'zimno'];

group('Każda scena (era × nisza) ma paletę w trzech klimatach', () => {
  ok(ERAS.length * NICHES.length === 12, '12 scen');
  ERAS.forEach((era) => NICHES.forEach((niche) => {
    const v = CLIMATES.map((c) => lookFor(era, niche, c, false));
    ok(v[0] !== v[1] && v[2] !== v[1] && v[0] !== v[2], `${era}/${niche}: trzy różne warianty`);
  }));
  ok(lookFor('kenozoik', 'lad', undefined, false) === lookFor('kenozoik', 'lad', 'umiarkowanie', false), 'brak klimatu → umiarkowany');
  ok(lookFor('mezozoik', 'woda', '???', false) === lookFor('mezozoik', 'woda', 'umiarkowanie', false), 'nieznany klimat → umiarkowany');
});

group('Palety są poprawne we wszystkich wariantach', () => {
  let all = 0, good = 0;
  ERAS.forEach((era) => NICHES.forEach((niche) => CLIMATES.forEach((c) => [false, true].forEach((dark) => [0, 1].forEach((a) => {
    const l = lookFor(era, niche, c, dark, a);
    all++; if (colors(l).every((v) => /^#[0-9a-f]{6}$/i.test(v)) && l.sun.x > 0 && l.sun.x < 1 && l.sun.y >= 0 && l.sun.y < 1) good++;
  })))));
  ok(good === all, `barwy #rrggbb i słońce w kadrze (${good}/${all})`);
});

group('Ery mają własny charakter', () => {
  const paleo = lookFor('paleozoik', 'lad', 'umiarkowanie', false), meso = lookFor('mezozoik', 'lad', 'umiarkowanie', false), ceno = lookFor('kenozoik', 'lad', 'umiarkowanie', false);
  ok(paleo.puddles > 0 && meso.puddles === 0 && ceno.puddles === 0, 'kałuże tylko w bagiennym paleozoiku');
  ok(!paleo.flowers && !meso.flowers && ceno.flowers, 'kwiaty dopiero w kenozoiku');
  ok(new Set([paleo.skyHorizon, meso.skyHorizon, ceno.skyHorizon]).size === 3, 'różne niebo w każdej erze');
});

group('Klimat tury zmienia światło', () => {
  ERAS.forEach((era) => {
    const mild = lookFor(era, 'lad', 'umiarkowanie', false), cold = lookFor(era, 'lad', 'zimno', false), warm = lookFor(era, 'lad', 'cieplo', false);
    ok(cold.snow > 0 && cold.snowCaps && warm.snow === 0 && mild.snow === 0, `${era}: śnieg tylko w zimnie`);
    ok(cold.sun.y > mild.sun.y && shadowLen(cold) > shadowLen(mild), `${era}: zimą słońce niżej i dłuższe cienie`);
    ok(lookFor(era, 'woda', 'zimno', false).ice && !lookFor(era, 'woda', 'umiarkowanie', false).ice, `${era}: kra tylko w zimnie`);
  });
  ok(lookFor('kenozoik', 'lad', 'zimno', false).bare > 0 && lookFor('paleozoik', 'lad', 'zimno', false).bare === 0, 'bezlistne drzewa tylko w kenozoiku');
  ok(litSide(lookFor('kenozoik', 'lad', 'umiarkowanie', false)) === 1, 'słońce z prawej → jasna strona z prawej');
});

group('Tryb ciemny: ta sama scena o zmierzchu', () => {
  ERAS.forEach((era) => NICHES.forEach((niche) => {
    const day = lookFor(era, niche, 'umiarkowanie', false), dusk = lookFor(era, niche, 'umiarkowanie', true);
    ok(luma(dusk.skyTop) < luma(day.skyTop) - 60 && luma(dusk.waterTop) < luma(day.waterTop) && dusk.rays === 0, `${era}/${niche}: ciemniej, bez snopów`);
  }));
});

group('Ślad po katastrofie: barwy blakną i wracają w trzech krokach', () => {
  ok(aftermathStep(0) === 0 && aftermathStep(undefined) === 0 && aftermathStep(1) === 1 && aftermathStep(5) === 1, 'skrajne wartości');
  ok(Math.abs(aftermathStep(0.4) - 1 / 3) < 1e-9 && Math.abs(aftermathStep(0.7) - 2 / 3) < 1e-9, 'kroki co 1/3');
  const fresh = lookFor('kenozoik', 'lad', 'umiarkowanie', false, 1), mild = lookFor('kenozoik', 'lad', 'umiarkowanie', false);
  const old = lookFor('kenozoik', 'lad', 'umiarkowanie', false, 1 / 3);
  ok(sat(fresh.leaf) < sat(old.leaf) && sat(old.leaf) < sat(mild.leaf), 'im świeższy ślad, tym bledsze liście');
  ok(!fresh.flowers && mild.flowers, 'świeży ślad: bez kwiatów');
  ok(sat(lookFor('mezozoik', 'woda', 'umiarkowanie', false, 1).waterTop) < sat(lookFor('mezozoik', 'woda', 'umiarkowanie', false).waterTop), 'woda też blaknie');
});

group('Układ scen: grunt w perspektywie, stado w kadrze', () => {
  [300, 210, 160].forEach((H) => {
    NICHES.forEach((n) => {
      const L = sceneLayout(n, 1000, H);
      ok(L.lifeTop >= 0 && L.lifeBottom <= H && L.lifeBottom - L.lifeTop >= 40, `${n} (H=${H}): pas życia mieści się w kadrze`);
    });
    const land = sceneLayout('lad', 1000, H);
    ok((H - land.floorY) / H >= 0.35 && land.lifeTop > land.floorY, `ląd (H=${H}): grunt ≥ 35% wysokości, stado na gruncie`);
    const sea = sceneLayout('woda', 1000, H), coast = sceneLayout('przybrzeze', 1000, H);
    ok(sea.surfaceY < sea.lifeTop && sea.floorY < H, `woda (H=${H}): powierzchnia nad stadem, dno w kadrze`);
    ok(coast.surfaceY < coast.lifeTop && coast.floorY > coast.surfaceY, `przybrzeże (H=${H}): stado pod powierzchnią`);
  });
});

console.log('\n────────────────────────\nZaliczone: ' + passed + ' | Niezaliczone: ' + failed);
if (failed) process.exit(1);
