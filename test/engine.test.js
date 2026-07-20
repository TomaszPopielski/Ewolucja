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
var det = function () { return 0.5; }; // deterministyczne, bez mutacji

/* Rozegraj całą grę wg planu cech (kupując, co się da przed każdą turą). */
function playThrough(plan, opts) {
  opts = opts || {};
  var s = Engine.createInitialState(GameData, 'Bot');
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
      var m = Engine.migrateLineage(s, s.activeLineageId, 'lad');
      if (m.ok) s = m.state;
    }
    s = Engine.simulateTurn(GameData, s, det).state;
  }
  return s;
}

group('createInitialState', function () {
  var s = Engine.createInitialState(GameData, 'Testozaur');
  eq(active(s).name, 'Testozaur', 'nazwa linii');
  eq(s.eraIndex, 0, 'start w pierwszej erze');
  eq(s.turn, 0, 'start przed pierwszą turą');
  eq(s.ep, GameData.START_EP, 'startowe EP');
  eq(active(s).niche, 'woda', 'start w niszy wodnej');
  eq(s.lineages.length, 1, 'jedna linia');
});

group('buyTrait — kupno, prereq, EP', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var r = Engine.buyTrait(GameData, s, 'fins');
  ok(r.ok, 'kupno fins');
  eq(r.state.ep, GameData.START_EP - 10, 'EP odjęte');
  eq(s.ep, GameData.START_EP, 'stan wejściowy niezmieniony');
  eq(Engine.traitStatus(s, byId('limbs')), 'locked', 'limbs zablokowane bez fins');
  var noEp = Engine.createInitialState(GameData, 'X'); noEp.ep = 5;
  eq(Engine.buyTrait(GameData, noEp, 'ganglia').error, 'Za mało punktów ewolucji.', 'komunikat o EP');
});

group('minEra — kamienie milowe późniejszych er', function () {
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 500;
  ['fins', 'limbs'].forEach(function (id) { s = Engine.buyTrait(GameData, s, id).state; });
  eq(Engine.traitStatus(s, byId('grasping_hand')), 'era_locked', 'ręka chwytna zablokowana erą w paleozoiku');
  s.eraIndex = 2; // kenozoik
  eq(Engine.traitStatus(s, byId('grasping_hand')), 'available', 'dostępna w kenozoiku (prereq spełnione, EP jest)');
});

group('nisze / migracja', function () {
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 200;
  var m0 = Engine.migrateLineage(s, 'L0', 'lad');
  ok(!m0.ok, 'migracja na ląd bez kończyn blokowana');
  ['fins', 'limbs'].forEach(function (id) { s = Engine.buyTrait(GameData, s, id).state; });
  var m1 = Engine.migrateLineage(s, 'L0', 'lad');
  ok(m1.ok, 'migracja na ląd z kończynami');
  eq(Engine.getLineage(m1.state, 'L0').niche, 'lad', 'nisza zmieniona na ląd');
  eq(active(s).niche, 'woda', 'stan wejściowy niezmieniony');
});

group('forecast — prognoza bez losowości', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var f = Engine.forecast(GameData, s, active(s));
  ok(f !== null, 'prognoza istnieje');
  ok(typeof f.projectedPop === 'number', 'prognozowana populacja to liczba');
  ok(typeof f.delta === 'number', 'delta populacji to liczba');
});

group('specjacja', function () {
  var s = Engine.createInitialState(GameData, 'Pra'); s.ep = 50; active(s).population = 100;
  var r = Engine.speciate(GameData, s, 'B');
  ok(r.ok, 'specjacja się udaje');
  eq(r.state.lineages.length, 2, 'dwie linie');
  eq(Engine.getLineage(r.state, 'L0').population + Engine.getLineage(r.state, 'L1').population, 100, 'populacja podzielona bez strat');
  eq(r.state.activeLineageId, 'L1', 'aktywna = nowa gałąź');
  // niezależna ewolucja
  s = Engine.buyTrait(GameData, r.state, 'ganglia').state;
  eq(Engine.getLineage(s, 'L1').traits.indexOf('ganglia') !== -1, true, 'gałąź ma ganglia');
  eq(Engine.getLineage(s, 'L0').traits.indexOf('ganglia'), -1, 'rodzic nie ma ganglia');
});

group('specjacja — blokady', function () {
  var s = Engine.createInitialState(GameData, 'P'); s.ep = 50; active(s).population = GameData.MIN_SPECIATION_POP - 1;
  ok(!Engine.speciate(GameData, s, 'B').ok, 'za mała populacja blokuje');
  var s2 = Engine.createInitialState(GameData, 'P'); s2.ep = GameData.SPECIATION_COST - 1; active(s2).population = 100;
  ok(!Engine.speciate(GameData, s2, 'B').ok, 'brak EP blokuje');
});

group('katastrofa — dodatkowa śmiertelność', function () {
  // Znajdź turę z katastrofą 'woda' i sprawdź, że uderza w linię wodną.
  var s = Engine.createInitialState(GameData, 'X');
  // przejdź do tury permskiej (ostatnia paleozoiku) — indeks 7
  s.turn = 7;
  var before = active(s).population;
  var out = Engine.simulateTurn(GameData, s, noMut);
  var lr = out.report.lineReports[0];
  ok(out.report.catastrophe !== null, 'tura permska ma katastrofę');
  ok(lr.catDeaths > 0, 'katastrofa spowodowała dodatkowe straty (' + lr.catDeaths + ')');
});

group('progresja er', function () {
  var s = Engine.createInitialState(GameData, 'X');
  // przewiń do końca paleozoiku
  s.turn = GameData.ERAS[0].turns.length - 1;
  var out = Engine.simulateTurn(GameData, s, noMut);
  eq(out.state.eraIndex, 1, 'po ostatniej turze paleozoiku wchodzimy w mezozoik');
  eq(out.state.turn, 0, 'tura zresetowana w nowej erze');
  ok(out.report.eraChanged, 'raport oznacza zmianę ery');
});

group('evaluateStatus', function () {
  var s = Engine.createInitialState(GameData, 'X');
  active(s).population = 0;
  eq(Engine.evaluateStatus(s, GameData), 'lost', 'populacja 0 => lost');
  var s2 = Engine.createInitialState(GameData, 'X');
  active(s2).stats.intelligence = GameData.INTELLIGENCE_GOAL;
  eq(Engine.evaluateStatus(s2, GameData), 'won', 'próg inteligencji => won');
});

group('pełna rozgrywka — skupiona strategia wygrywa', function () {
  var plan = ['eyes', 'scales', 'many_eggs', 'ganglia', 'fins', 'limbs', 'shell', 'jaws',
    'brain', 'endothermy', 'big_brain', 'social', 'grasping_hand', 'tool_use', 'parental_care'];
  var s = playThrough(plan, { migrateLandWhenAble: false });
  eq(s.status, 'won', 'skupiona strategia wygrywa (int ' + Engine.maxIntelligence(s) + ')');
});

group('pełna rozgrywka — gra "na przetrwanie" nie wygrywa', function () {
  var plan = ['fins', 'eyes', 'scales', 'jaws', 'many_eggs', 'shell', 'limbs'];
  var s = playThrough(plan, { migrateLandWhenAble: true });
  ok(s.status === 'survived' || s.status === 'lost', 'bez mózgu nie ma zwycięstwa (status ' + s.status + ')');
});

console.log('\n────────────────────────');
console.log('Zaliczone: ' + passed + ' | Niezaliczone: ' + failed);
process.exit(failed === 0 ? 0 : 1);
