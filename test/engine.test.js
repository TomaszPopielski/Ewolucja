/*
 * test/engine.test.js — testy silnika symulacji.
 * Uruchom: node test/engine.test.js
 */
'use strict';

var GameData = require('../js/data.js');
var Engine = require('../js/engine.js');

var passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.error('  ✗ ' + m); } }
function eq(a, b, m) { ok(a === b, m + ' (oczekiwano ' + b + ', jest ' + a + ')'); }
function group(n, fn) { console.log('\n• ' + n); fn(); }
function seeded(v) { var i = 0; return function () { var x = v[i % v.length]; i++; return x; }; }
var noMut = function () { return 0.99; };
function byId(id) { return GameData.TRAITS.filter(function (t) { return t.id === id; })[0]; }
function active(s) { return Engine.getActiveLineage(s); }
var det = function () { return 0.5; };

function playThrough(plan, opts) {
  opts = opts || {};
  var s = Engine.createInitialState(GameData, 'Bot', opts.init || {});
  var guard = 0;
  while (s.status === 'playing' && guard++ < 60) {
    var changed = true;
    while (changed) {
      changed = false;
      for (var p = 0; p < plan.length; p++) {
        if (active(s).traits.indexOf(plan[p]) !== -1) continue;
        var r = Engine.buyTrait(GameData, s, plan[p]);
        if (r.ok) { s = r.state; changed = true; }
      }
    }
    if (opts.migrateLandWhenAble && active(s).traits.indexOf('limbs') !== -1 && active(s).niche === 'woda') {
      var m = Engine.migrateLineage(GameData, s, s.activeLineageId, 'lad'); if (m.ok) s = m.state;
    }
    s = Engine.simulateTurn(GameData, s, det).state;
  }
  return s;
}

group('createInitialState + trudność', function () {
  var s = Engine.createInitialState(GameData, 'Testozaur');
  eq(active(s).name, 'Testozaur', 'nazwa linii');
  eq(s.ep, GameData.DIFFICULTIES.normalny.startEp, 'EP z domyślnej trudności');
  eq(s.intelligenceGoal, GameData.DIFFICULTIES.normalny.goal, 'cel z trudności');
  var e = Engine.createInitialState(GameData, 'X', { difficulty: 'latwy' });
  eq(e.ep, GameData.DIFFICULTIES.latwy.startEp, 'łatwy: więcej EP');
  eq(e.intelligenceGoal, GameData.DIFFICULTIES.latwy.goal, 'łatwy: niższy cel');
});

group('scenariusz: start w innej erze + zestaw startowy', function () {
  var s = Engine.createInitialState(GameData, 'X', { startEra: 2, startTraits: ['scales', 'ganglia'], scenarioId: 'ice' });
  eq(s.eraIndex, 2, 'start w kenozoiku');
  eq(active(s).traits.indexOf('ganglia') !== -1, true, 'ma cechę startową ganglia');
  ok(active(s).stats.intelligence > GameData.BASE_STATS.intelligence, 'efekty cech startowych zastosowane');
});

group('buyTrait — kupno, prereq, EP, minEra', function () {
  var s = Engine.createInitialState(GameData, 'X');
  ok(Engine.buyTrait(GameData, s, 'fins').ok, 'kupno fins');
  eq(Engine.traitStatus(s, byId('limbs')), 'locked', 'limbs zablokowane bez fins');
  var noEp = Engine.createInitialState(GameData, 'X'); noEp.ep = 5;
  eq(Engine.buyTrait(GameData, noEp, 'ganglia').error, 'Za mało punktów ewolucji.', 'komunikat o EP');
  var s2 = Engine.createInitialState(GameData, 'X'); s2.ep = 500;
  ['fins', 'limbs'].forEach(function (id) { s2 = Engine.buyTrait(GameData, s2, id).state; });
  eq(Engine.traitStatus(s2, byId('grasping_hand')), 'era_locked', 'ręka chwytna zablokowana erą w paleozoiku');
});

group('nisze — dostępność i migracja', function () {
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 400;
  var av0 = Engine.availableNiches(GameData, active(s));
  ok(av0.indexOf('przybrzeze') !== -1, 'przybrzeże dostępne od startu');
  ok(av0.indexOf('lad') === -1, 'ląd niedostępny bez kończyn');
  ok(!Engine.migrateLineage(GameData, s, 'L0', 'lad').ok, 'migracja na ląd bez kończyn blokowana');
  ['fins', 'limbs'].forEach(function (id) { s = Engine.buyTrait(GameData, s, id).state; });
  var m = Engine.migrateLineage(GameData, s, 'L0', 'lad');
  ok(m.ok, 'migracja na ląd z kończynami');
  eq(Engine.getLineage(m.state, 'L0').niche, 'lad', 'nisza = ląd');
  s.eraIndex = 1; s = Engine.buyTrait(GameData, s, 'flight').state;
  ok(Engine.availableNiches(GameData, active(s)).indexOf('powietrze') !== -1, 'powietrze dostępne po cesze Lot');
});

group('nisze mają różne środowiska', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var env = Engine.currentTurnEnv(GameData, s);
  var wodaD = Engine._internals.computeDynamics(GameData, env, { niche: 'woda', stats: GameData.BASE_STATS, traits: [] }, {});
  var przybD = Engine._internals.computeDynamics(GameData, env, { niche: 'przybrzeze', stats: GameData.BASE_STATS, traits: [] }, {});
  ok(przybD.energy !== wodaD.energy, 'przybrzeże ma inny bilans niż woda');
});

group('forecast — prognoza', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var f = Engine.forecast(GameData, s, active(s));
  ok(f && typeof f.projectedPop === 'number' && typeof f.delta === 'number', 'prognoza ma liczby');
});

group('specjacja', function () {
  var s = Engine.createInitialState(GameData, 'Pra'); s.ep = 50; active(s).population = 100;
  var r = Engine.speciate(GameData, s, 'B');
  ok(r.ok, 'specjacja się udaje');
  eq(r.state.lineages.length, 2, 'dwie linie');
  eq(Engine.getLineage(r.state, 'L0').population + Engine.getLineage(r.state, 'L1').population, 100, 'populacja podzielona bez strat');
  s = Engine.buyTrait(GameData, r.state, 'ganglia').state;
  eq(Engine.getLineage(s, 'L1').traits.indexOf('ganglia') !== -1, true, 'gałąź ma ganglia');
  eq(Engine.getLineage(s, 'L0').traits.indexOf('ganglia'), -1, 'rodzic nie ma ganglia');
});

group('katastrofa + trudność (mnożnik)', function () {
  var s = Engine.createInitialState(GameData, 'X'); s.turn = 7; // Perm
  var lrN = Engine.simulateTurn(GameData, s, noMut).report.lineReports[0];
  var h = Engine.createInitialState(GameData, 'X', { difficulty: 'trudny' }); h.turn = 7;
  var lrH = Engine.simulateTurn(GameData, h, noMut).report.lineReports[0];
  ok(lrN.catDeaths > 0, 'katastrofa uderza (' + lrN.catDeaths + ')');
  ok(lrH.catDeaths >= lrN.catDeaths, 'na trudnym katastrofa nie słabsza (' + lrH.catDeaths + ' ≥ ' + lrN.catDeaths + ')');
});

group('koewolucja — presja drapieżników rośnie', function () {
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 200;
  s = Engine.buyTrait(GameData, s, 'shell').state; // wysoka obrona
  var p0 = s.predatorLevel;
  for (var i = 0; i < 3; i++) s = Engine.simulateTurn(GameData, s, noMut).state;
  ok(s.predatorLevel > p0, 'predatorLevel rośnie przy wysokiej obronie (' + Engine._internals.clamp(s.predatorLevel, 0, 99).toFixed(2) + ')');
});

group('pozytywne zdarzenie losowe', function () {
  // rng: pierwszy 0.99 => brak mutacji linii; ale zdarzenie zależy od rng w simulateTurn.
  // Wymuś zdarzenie: rng < 0.22 na etapie zdarzenia. Sekwencja: mutacja(0.99 brak), zdarzenie(0.1), wybór(0.0)
  var s = Engine.createInitialState(GameData, 'X');
  var rng = seeded([0.1, 0.0, 0.99, 0.99, 0.99, 0.99]);
  // uwaga: kolejność wywołań rng: event-check, event-pick, potem per-lineage mutacja...
  var out = Engine.simulateTurn(GameData, s, rng);
  ok(out.report.event !== null, 'zdarzenie pozytywne wystąpiło');
});

group('rozbicie EP w raporcie', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var lr = Engine.simulateTurn(GameData, s, noMut).report.lineReports[0];
  ok(lr.epBreakdown && typeof lr.epBreakdown.growth === 'number', 'raport zawiera rozbicie EP');
  eq(lr.epBreakdown.growth + lr.epBreakdown.population + lr.epBreakdown.intelligence + lr.epBreakdown.niche, lr.epGain, 'składniki EP sumują się do epGain');
});

group('evaluateStatus', function () {
  var s = Engine.createInitialState(GameData, 'X'); active(s).population = 0;
  eq(Engine.evaluateStatus(s, GameData), 'lost', 'populacja 0 => lost');
  var s2 = Engine.createInitialState(GameData, 'X'); active(s2).stats.intelligence = s2.intelligenceGoal;
  eq(Engine.evaluateStatus(s2, GameData), 'won', 'próg inteligencji => won');
});

group('pełna rozgrywka — skupiona strategia wygrywa (normalny)', function () {
  var plan = ['eyes', 'scales', 'many_eggs', 'ganglia', 'fins', 'limbs', 'shell', 'jaws',
    'brain', 'endothermy', 'big_brain', 'social', 'grasping_hand', 'tool_use', 'parental_care'];
  var s = playThrough(plan);
  eq(s.status, 'won', 'skupiona strategia wygrywa (int ' + Engine.maxIntelligence(s) + '/' + s.intelligenceGoal + ')');
});

group('pełna rozgrywka — gra "na przetrwanie" nie wygrywa', function () {
  var plan = ['fins', 'eyes', 'scales', 'jaws', 'many_eggs', 'shell', 'limbs'];
  var s = playThrough(plan, { migrateLandWhenAble: true });
  ok(s.status === 'survived' || s.status === 'lost', 'bez mózgu brak zwycięstwa (status ' + s.status + ')');
});

group('ścieżka społeczna (mowa) też wygrywa', function () {
  var plan = ['eyes', 'scales', 'many_eggs', 'ganglia', 'fins', 'limbs', 'jaws',
    'brain', 'endothermy', 'big_brain', 'social', 'parental_care', 'language'];
  var s = playThrough(plan);
  eq(s.status, 'won', 'droga „społeczna” (mowa) prowadzi do celu (int ' + Engine.maxIntelligence(s) + '/' + s.intelligenceGoal + ')');
});

group('premia niszy jest jednorazowa (odkrycie), nie co-turowa', function () {
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 100;
  ['fins', 'limbs'].forEach(function (id) { s = Engine.buyTrait(GameData, s, id).state; });
  s = Engine.migrateLineage(GameData, s, 'L0', 'lad').state;
  var r1 = Engine.simulateTurn(GameData, s, noMut);
  eq(r1.report.lineReports[0].epBreakdown.niche, GameData.NICHES.lad.discoveryBonus, 'pierwsza tura w niszy = premia odkrycia');
  var r2 = Engine.simulateTurn(GameData, r1.state, noMut);
  eq(r2.report.lineReports[0].epBreakdown.niche, 0, 'kolejna tura w tej samej niszy = brak premii');
});

group('EP z inteligencji liczone z jednej (najlepszej) linii', function () {
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 100;
  ['ganglia', 'brain'].forEach(function (id) { s = Engine.buyTrait(GameData, s, id).state; });
  var expected = Math.floor(active(s).stats.intelligence / 2);
  s = Engine.speciate(GameData, s, 'B').state; // dziecko dziedziczy tę samą inteligencję
  var lrs = Engine.simulateTurn(GameData, s, noMut).report.lineReports;
  var sumInt = lrs.reduce(function (a, lr) { return a + lr.epBreakdown.intelligence; }, 0);
  eq(sumInt, expected, 'specjacja nie mnoży EP z inteligencji (' + sumInt + ' = ' + expected + ')');
});

group('migracja ma koszt aklimatyzacji', function () {
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 100;
  ['fins', 'limbs'].forEach(function (id) { s = Engine.buyTrait(GameData, s, id).state; });
  var m = Engine.migrateLineage(GameData, s, 'L0', 'lad');
  eq(Engine.getLineage(m.state, 'L0').acclimatizeTurns, 1, 'po migracji ustawiona kara aklimatyzacji');
  var after = Engine.simulateTurn(GameData, m.state, noMut).state;
  eq(Engine.getLineage(after, 'L0').acclimatizeTurns, 0, 'kara zużywa się po jednej turze');
});

group('refugium — mała populacja przeżywa pierwszy kryzys głodu', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var l = active(s); l.population = 12; l.stats.feeding = 0; l.stats.metabolism = 20; l.stats.defense = 20;
  var after = Engine.simulateTurn(GameData, s, noMut).state;
  var a = Engine.getLineage(after, 'L0');
  ok(a.alive && a.population >= 12, 'refugium chroni przed śmiercią w pierwszej turze deficytu (pop ' + a.population + ')');
  eq(a.deficitStreak, 1, 'licznik deficytu = 1');
});

group('synergia cech (warm_coat) stosowana raz', function () {
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 200; s.eraIndex = 1; // izolacja od mezozoiku
  ['scales', 'endothermy', 'insulation'].forEach(function (id) { s = Engine.buyTrait(GameData, s, id).state; });
  ok(active(s).appliedSynergies.indexOf('warm_coat') !== -1, 'synergia warm_coat skompletowana');
  ok(s.unlockedKnowledge.indexOf('synergy') !== -1, 'odblokowano wiedzę o synergii');
});

group('premia za dywersyfikację przy katastrofie niszowej', function () {
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 100;
  ['fins', 'limbs'].forEach(function (id) { s = Engine.buyTrait(GameData, s, id).state; });
  s = Engine.speciate(GameData, s, 'Ladowa').state;      // L1 aktywna
  s = Engine.migrateLineage(GameData, s, 'L1', 'lad').state;
  s.turn = 7; // Perm — katastrofa w niszy „woda”
  var rep = Engine.simulateTurn(GameData, s, noMut).report;
  eq(rep.diversifyBonus, 8, 'rozproszenie linii między nisze daje premię przy katastrofie');
});

group('osiągnięcia — zdobycie lądu', function () {
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 100;
  ['fins', 'limbs'].forEach(function (id) { s = Engine.buyTrait(GameData, s, id).state; });
  s = Engine.migrateLineage(GameData, s, 'L0', 'lad').state;
  var after = Engine.simulateTurn(GameData, s, noMut).state;
  ok(after.achievements.indexOf('landfall') !== -1, 'osiągnięcie „Pionier lądu” zdobyte');
});

group('deterministyczny RNG (ziarno) jest powtarzalny', function () {
  var r1 = Engine.makeRng(42), r2 = Engine.makeRng(42);
  var a = [r1(), r1(), r1()], b = [r2(), r2(), r2()];
  ok(a[0] === b[0] && a[1] === b[1] && a[2] === b[2], 'ten sam seed → ta sama sekwencja');
  ok(a[0] !== a[1], 'kolejne wywołania są różne');
});

group('gra z ziarnem jest w pełni powtarzalna', function () {
  function run() {
    var s = Engine.createInitialState(GameData, 'X', { seed: 777 });
    for (var i = 0; i < 5; i++) { s = Engine.simulateTurn(GameData, s, Engine.rngForTurn(s)).state; }
    return Engine.totalPopulation(s) + ':' + Engine.maxIntelligence(s);
  }
  eq(run(), run(), 'dwie partie z tym samym ziarnem dają identyczny wynik');
});

console.log('\n────────────────────────');
console.log('Zaliczone: ' + passed + ' | Niezaliczone: ' + failed);
process.exit(failed === 0 ? 0 : 1);
