/*
 * test/creature.test.mjs — testy opisu wyglądu zwierzęcia (src/creature/spec.ts).
 * Uruchom: node --experimental-strip-types test/creature.test.mjs  (albo npm test)
 */
import { buildSpec, FEATURES, hashString, rng, scaleLabel } from '../src/creature/spec.ts';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const GameData = require('../js/data.js');

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error('  ✗ ' + m); } };
const group = (n, fn) => { console.log('\n• ' + n); fn(); };

group('Każda cecha gry ma widoczny odpowiednik na rysunku', () => {
  GameData.TRAITS.forEach((t) => ok(FEATURES.includes(t.id), 'brak części ciała dla cechy ' + t.id));
});

group('Opis zależy tylko od linii (deterministyczny)', () => {
  const l = { id: 'L0', name: 'Prazwierzę', traits: ['fins', 'jaws'], niche: 'woda' };
  const a = buildSpec(l), b = buildSpec({ ...l });
  ok(a.seed === b.seed && a.bodyColor === b.bodyColor, 'ta sama linia → ten sam wygląd');
  const c = buildSpec({ ...l, id: 'L1', name: 'Prazwierzę II' });
  ok(c.seed !== a.seed, 'nowa gałąź → inne ziarno (inne proporcje/barwy)');
  ok(a.owned.has('fins') && a.owned.has('jaws') && !a.owned.has('limbs'), 'posiadane cechy przeniesione');
});

group('Nieznane cechy i nisze są bezpieczne', () => {
  const s = buildSpec({ id: 'X', name: 'X', traits: ['nieznana'], niche: 'kosmos' });
  ok(s.owned.size === 0, 'nieznana cecha pominięta');
  ok(s.niche === 'woda', 'nieznana nisza → woda');
});

group('Rozmiar ciała rośnie z planem budowy', () => {
  const size = (traits) => buildSpec({ id: 'L', name: 'n', traits, niche: 'woda' }).sizeCm;
  ok(size([]) < size(['fins']), 'ryba większa od robaka');
  ok(size(['fins']) < size(['fins', 'limbs']), 'czworonóg większy od ryby');
  ok(size(['fins', 'limbs']) < size(['fins', 'limbs', 'endothermy', 'brain', 'big_brain']), 'stałocieplny z mózgiem największy');
  ok(scaleLabel(3) === '3 cm' && scaleLabel(100) === '1 m', 'etykiety podziałki');
});

group('Generator losowy jest powtarzalny i w zakresie [0, 1)', () => {
  const r1 = rng(hashString('a')), r2 = rng(hashString('a'));
  let same = true, inRange = true;
  for (let i = 0; i < 100; i++) { const x = r1(); if (x !== r2()) same = false; if (x < 0 || x >= 1) inRange = false; }
  ok(same, 'to samo ziarno → ta sama sekwencja');
  ok(inRange, 'wartości w [0, 1)');
});

console.log('\n────────────────────────\nZaliczone: ' + passed + ' | Niezaliczone: ' + failed);
if (failed) process.exit(1);
