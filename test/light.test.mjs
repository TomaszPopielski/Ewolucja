/*
 * test/light.test.mjs — testy scenariusza barw dioramy (src/diorama/light.ts).
 * Uruchom: node --experimental-strip-types test/light.test.mjs  (albo npm test)
 */
import { hasLook, lookFor, aftermathStep, litSide, shadowLen } from '../src/diorama/light.ts';
import { sceneLayout } from '../src/diorama/scenery.ts';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error('  ✗ ' + m); } };
const group = (n, fn) => { console.log('\n• ' + n); fn(); };

const rgb = (hex) => { const p = parseInt(hex.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };
const luma = (hex) => { const [r, g, b] = rgb(hex); return 0.3 * r + 0.59 * g + 0.11 * b; };
const sat = (hex) => { const c = rgb(hex); return Math.max(...c) - Math.min(...c); };
const colors = (l) => [...Object.values(l).filter((v) => typeof v === 'string'), l.sun.color];

group('Prototyp obejmuje ląd w kenozoiku; reszta scen maluje się po staremu', () => {
  ok(hasLook('kenozoik', 'lad'), 'ląd w kenozoiku ma paletę');
  ok(!hasLook('paleozoik', 'woda') && !hasLook('mezozoik', 'lad') && !hasLook('kenozoik', 'woda'), 'inne sceny bez palety');
  ok(lookFor('paleozoik', 'woda', 'cieplo', false) === null, 'brak palety → null (stara scena)');
});

group('Klimat tury wybiera wariant światła', () => {
  const warm = lookFor('kenozoik', 'lad', 'cieplo', false);
  const mild = lookFor('kenozoik', 'lad', 'umiarkowanie', false);
  const cold = lookFor('kenozoik', 'lad', 'zimno', false);
  ok(warm && mild && cold && warm !== mild && cold !== mild, 'trzy różne warianty');
  ok(lookFor('kenozoik', 'lad', undefined, false) === mild && lookFor('kenozoik', 'lad', '???', false) === mild, 'nieznany klimat → umiarkowany');
  ok(cold.snow > 0 && cold.snowCaps && warm.snow === 0 && mild.snow === 0, 'śnieg tylko w zimnie');
  ok(cold.sun.y > mild.sun.y, 'zimą słońce niżej');
  ok(shadowLen(cold) > shadowLen(mild), 'niższe słońce → dłuższe cienie');
  ok(litSide(mild) === 1, 'słońce z prawej → jasna strona z prawej');
});

group('Palety są poprawne we wszystkich wariantach', () => {
  ['cieplo', 'umiarkowanie', 'zimno'].forEach((c) => [false, true].forEach((dark) => [0, 1].forEach((a) => {
    const l = lookFor('kenozoik', 'lad', c, dark, a);
    ok(colors(l).every((v) => /^#[0-9a-f]{6}$/i.test(v)), `barwy #rrggbb (${c}, ${dark ? 'ciemny' : 'jasny'}, ślad ${a})`);
  })));
});

group('Tryb ciemny: ta sama scena o zmierzchu', () => {
  const day = lookFor('kenozoik', 'lad', 'umiarkowanie', false), dusk = lookFor('kenozoik', 'lad', 'umiarkowanie', true);
  ok(luma(dusk.skyTop) < luma(day.skyTop) - 60 && luma(dusk.groundNear) < luma(day.groundNear), 'niebo i grunt ciemniejsze');
  ok(dusk.sun.y >= 0.5 && dusk.rays === 0, 'słońce nad horyzontem, bez snopów');
});

group('Ślad po katastrofie: barwy blakną i wracają w trzech krokach', () => {
  ok(aftermathStep(0) === 0 && aftermathStep(undefined) === 0 && aftermathStep(1) === 1 && aftermathStep(5) === 1, 'skrajne wartości');
  ok(Math.abs(aftermathStep(0.4) - 1 / 3) < 1e-9 && Math.abs(aftermathStep(0.7) - 2 / 3) < 1e-9, 'kroki co 1/3');
  const fresh = lookFor('kenozoik', 'lad', 'umiarkowanie', false, 1), mild = lookFor('kenozoik', 'lad', 'umiarkowanie', false);
  const old = lookFor('kenozoik', 'lad', 'umiarkowanie', false, 1 / 3);
  ok(sat(fresh.leaf) < sat(old.leaf) && sat(old.leaf) < sat(mild.leaf), 'im świeższy ślad, tym bledsze liście');
  ok(!fresh.flowers && mild.flowers, 'świeży ślad: bez kwiatów');
});

group('Głębszy grunt sceny z nowym światłem', () => {
  [300, 210, 160].forEach((H) => {
    const deep = sceneLayout('lad', 1000, H, true), flat = sceneLayout('lad', 1000, H);
    ok((H - deep.floorY) / H >= 0.35, `grunt ≥ 35% wysokości (H=${H})`);
    ok(deep.lifeTop > deep.floorY && deep.lifeBottom < H && deep.lifeBottom - deep.lifeTop >= flat.lifeBottom - flat.lifeTop, `stado w głębi gruntu (H=${H})`);
  });
  ok(JSON.stringify(sceneLayout('woda', 1000, 300, true)) === JSON.stringify(sceneLayout('woda', 1000, 300)), 'inne nisze bez zmian');
});

console.log('\n────────────────────────\nZaliczone: ' + passed + ' | Niezaliczone: ' + failed);
if (failed) process.exit(1);
