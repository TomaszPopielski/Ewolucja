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

group('regresja: karta „Podbój lądu” się odblokowuje', function () {
  var s = Engine.createInitialState(GameData, 'X', { startEp: 200 });
  ok(s.unlockedKnowledge.indexOf('land') === -1, 'na starcie w wodzie brak karty land');
  s = Engine.buyTrait(GameData, s, 'fins').state;
  s = Engine.buyTrait(GameData, s, 'limbs').state;
  ok(s.unlockedKnowledge.indexOf('land') !== -1, 'zakup kończyn odblokowuje kartę land');
  var t = Engine.createInitialState(GameData, 'X', { startTraits: ['fins', 'limbs'] });
  t = Engine.migrateLineage(GameData, t, 'L0', 'lad').state;
  ok(t.unlockedKnowledge.indexOf('land') !== -1, 'migracja na ląd odblokowuje kartę land');
  ok(GameData.KNOWLEDGE.land, 'karta land istnieje w danych');
});

group('regresja: prognoza z cechą uwzględnia obecność cechy', function () {
  // Pierwsza tura kenozoiku z zimnem: Neogen — ochłodzenie (indeks 3).
  var s = Engine.createInitialState(GameData, 'X', { startEra: 2, startTraits: ['scales'] });
  s.turn = 3;
  var l = active(s), endo = byId('endothermy');
  var clonel = JSON.parse(JSON.stringify(l));
  for (var k in endo.effects) clonel.stats[k] += endo.effects[k];
  var statsOnly = Engine.forecast(GameData, s, clonel);
  var withTrait = Engine.forecastWithTrait(GameData, s, l, endo);
  ok(withTrait.energy > statsOnly.energy, 'stałocieplność w zimnie podnosi bilans energii w prognozie (' +
    withTrait.energy + ' > ' + statsOnly.energy + ')');
  eq(active(s).traits.indexOf('endothermy'), -1, 'prognoza nie zmienia stanu');
});

group('regresja: licznik tur po końcu gry', function () {
  var s = Engine.createInitialState(GameData, 'X');
  while (s.status === 'playing') s = Engine.simulateTurn(GameData, s, det).state;
  eq(Engine.elapsedTurns(GameData, s), Engine.totalTurns(GameData), 'po końcu gry = wszystkie tury');
  var m = Engine.createInitialState(GameData, 'X');
  for (var i = 0; i < 10; i++) m = Engine.simulateTurn(GameData, m, det).state;
  eq(Engine.elapsedTurns(GameData, m), 10, 'w trakcie gry = liczba rozegranych tur');
});

group('regresja: scenariusz — era startowa i nisza startowa', function () {
  var sc = GameData.SCENARIOS.filter(function (x) { return x.id === 'ice'; })[0];
  var s = Engine.createInitialState(GameData, 'X', { difficulty: sc.difficulty, startEra: sc.startEra,
    startEp: sc.startEp, goal: sc.goal, startTraits: sc.startTraits, startNiche: sc.startNiche, scenarioId: sc.id });
  eq(active(s).niche, 'lad', 'epoki lodowcowe: start na lądzie');
  eq(s.startEra, 2, 'stan pamięta erę startową');
  eq(Engine.playedEras(GameData, s).length, 1, 'rozgrywane ery: tylko kenozoik');
  eq(Engine.playedEras(GameData, Engine.createInitialState(GameData, 'Y')).length, 3, 'pełna gra: trzy ery');
  var bad = Engine.createInitialState(GameData, 'Z', { startNiche: 'lad' });
  eq(active(bad).niche, 'woda', 'nisza startowa bez wymaganej cechy jest ignorowana');
});

group('regresja: dane — Zwoje i wymieranie permskie', function () {
  ok(byId('ganglia').effects.metabolism > 0, 'Zwoje nerwowe podnoszą metabolizm (zgodnie z opisem)');
  var perm = GameData.ERAS[0].turns.filter(function (t) { return /Perm/.test(t.title); })[0];
  eq(perm.climate, 'cieplo', 'perm: ocieplenie, nie zimno');
  eq(perm.catastrophe.niche, 'all', 'perm: uderza też w ląd');
  ok(Engine.catastropheSeverity(perm.catastrophe, 'lad') < Engine.catastropheSeverity(perm.catastrophe, 'woda'),
    'perm: na lądzie słabiej niż w morzu');
  // Linia lądowa ponosi straty w katastrofie permskiej.
  var s = Engine.createInitialState(GameData, 'X', { startTraits: ['fins', 'limbs'], startNiche: 'lad' });
  s.turn = GameData.ERAS[0].turns.indexOf(perm);
  var r = Engine.simulateTurn(GameData, s, noMut).report;
  ok(r.lineReports[0].catDeaths > 0, 'perm: straty na lądzie (' + r.lineReports[0].catDeaths + ')');
});

console.log('\n────────────────────────');
console.log('Zaliczone: ' + passed + ' | Niezaliczone: ' + failed);
process.exit(failed === 0 ? 0 : 1);
