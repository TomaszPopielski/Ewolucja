/*
 * test/engine.test.js — testy silnika symulacji.
 * Uruchom: node test/engine.test.js
 *
 * Lekki framework asercji bez zależności — zgodnie z zasadą "bez kroku budowania".
 */
'use strict';

var GameData = require('../js/data.js');
var Engine = require('../js/engine.js');

var passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.error('  ✗ ' + msg); } }
function eq(a, b, msg) { ok(a === b, msg + ' (oczekiwano ' + b + ', jest ' + a + ')'); }
function group(name, fn) { console.log('\n• ' + name); fn(); }

function seeded(values) { var i = 0; return function () { var v = values[i % values.length]; i++; return v; }; }
var noMutation = function () { return 0.99; };
function byId(id) { return GameData.TRAITS.filter(function (t) { return t.id === id; })[0]; }
function active(s) { return Engine.getActiveLineage(s); }

group('createInitialState', function () {
  var s = Engine.createInitialState(GameData, 'Testozaur');
  eq(active(s).name, 'Testozaur', 'nazwa linii ustawiona');
  eq(s.turn, 0, 'start przed pierwszą turą');
  eq(s.ep, GameData.START_EP, 'startowe EP');
  eq(active(s).population, GameData.START_POPULATION, 'startowa populacja');
  eq(s.lineages.length, 1, 'jedna linia na start');
  eq(s.status, 'playing', 'status playing');
  eq(active(s).stats.feeding, GameData.BASE_STATS.feeding, 'statystyki bazowe');
});

group('buyTrait — poprawne kupno', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var r = Engine.buyTrait(GameData, s, 'fins');
  ok(r.ok, 'kupno fins się udaje');
  eq(r.state.ep, GameData.START_EP - 10, 'EP odjęte');
  eq(active(r.state).stats.mobility, GameData.BASE_STATS.mobility + 2, 'mobilność +2');
  eq(s.ep, GameData.START_EP, 'oryginalny stan niezmutowany (immutable)');
});

group('buyTrait — warunki wstępne', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var r = Engine.buyTrait(GameData, s, 'limbs');
  ok(!r.ok, 'nie można kupić limbs bez fins');
  eq(Engine.traitStatus(s, byId('limbs')), 'locked', 'limbs zablokowane');
  var afterFins = Engine.buyTrait(GameData, s, 'fins').state;
  afterFins.ep += 100;
  eq(Engine.traitStatus(afterFins, byId('limbs')), 'available', 'limbs dostępne po fins');
});

group('buyTrait — za mało EP', function () {
  var s = Engine.createInitialState(GameData, 'X');
  s.ep = 5;
  var r = Engine.buyTrait(GameData, s, 'ganglia');
  ok(!r.ok, 'brak EP blokuje kupno');
  eq(r.error, 'Za mało punktów ewolucji.', 'komunikat o EP');
});

group('simulateTurn — przetrwanie i EP', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var out = Engine.simulateTurn(GameData, s, noMutation);
  ok(out.report !== null, 'raport wygenerowany');
  eq(out.state.turn, 1, 'tura przesunięta na 1');
  ok(out.report.epGain > 0, 'zdobyto EP za przetrwanie');
  ok(out.state.ep > s.ep, 'EP w stanie wzrosło');
  ok(Engine.totalPopulation(out.state) > 0, 'populacja przetrwała kambr');
  eq(out.report.lineReports.length, 1, 'raport jednej linii');
});

group('simulateTurn — nie mutuje wejścia', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var popBefore = active(s).population;
  Engine.simulateTurn(GameData, s, noMutation);
  eq(active(s).population, popBefore, 'wejściowa populacja bez zmian');
  eq(s.turn, 0, 'wejściowa tura bez zmian');
});

group('rollMutation — determinizm', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var rng = seeded([0.1, 0.0, 0.1]);
  var m = Engine._internals.rollMutation(active(s), rng);
  ok(m !== null, 'mutacja wystąpiła');
  ok(m.beneficial === true, 'mutacja korzystna dla rng<0.6');
  eq(m.delta, 1, 'korzystna => +1');
});

group('rollMutation — brak przy wysokim rng', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var m = Engine._internals.rollMutation(active(s), function () { return 0.9; });
  ok(m === null, 'brak mutacji gdy rng > próg');
});

group('evaluateStatus — wymarcie', function () {
  var s = Engine.createInitialState(GameData, 'X');
  active(s).population = 0;
  eq(Engine.evaluateStatus(s), 'lost', 'populacja 0 => lost');
});

group('evaluateStatus — zwycięstwo przez inteligencję', function () {
  var s = Engine.createInitialState(GameData, 'X');
  active(s).stats.intelligence = GameData.INTELLIGENCE_GOAL;
  eq(Engine.evaluateStatus(s), 'won', 'próg inteligencji => won');
});

// --------------------- Specjacja ---------------------
group('speciate — poprawne rozdzielenie linii', function () {
  var s = Engine.createInitialState(GameData, 'Pra');
  s.ep = 50;
  active(s).population = 100;
  var r = Engine.speciate(GameData, s, 'Gałąź B');
  ok(r.ok, 'specjacja się udaje');
  eq(r.state.lineages.length, 2, 'powstały dwie linie');
  eq(r.state.ep, 50 - GameData.SPECIATION_COST, 'pobrano koszt EP');
  var parent = Engine.getLineage(r.state, 'L0');
  var child = Engine.getLineage(r.state, 'L1');
  eq(parent.population + child.population, 100, 'populacja podzielona bez strat');
  eq(child.parentId, 'L0', 'dziecko wskazuje rodzica');
  eq(r.state.activeLineageId, 'L1', 'aktywna staje się nowa gałąź');
  eq(s.lineages.length, 1, 'oryginał niezmutowany');
});

group('speciate — blokada przy małej populacji', function () {
  var s = Engine.createInitialState(GameData, 'Pra');
  s.ep = 50;
  active(s).population = GameData.MIN_SPECIATION_POP - 1;
  var r = Engine.speciate(GameData, s, 'B');
  ok(!r.ok, 'za mała populacja blokuje specjację');
});

group('speciate — blokada przy braku EP', function () {
  var s = Engine.createInitialState(GameData, 'Pra');
  s.ep = GameData.SPECIATION_COST - 1;
  active(s).population = 100;
  var r = Engine.speciate(GameData, s, 'B');
  ok(!r.ok, 'brak EP blokuje specjację');
});

group('linie ewoluują niezależnie po specjacji', function () {
  var s = Engine.createInitialState(GameData, 'Pra');
  s.ep = 100;
  active(s).population = 100;
  s = Engine.speciate(GameData, s, 'B').state; // aktywna = L1
  // kup cechę tylko dla nowej gałęzi
  s = Engine.buyTrait(GameData, s, 'ganglia').state;
  var parent = Engine.getLineage(s, 'L0');
  var child = Engine.getLineage(s, 'L1');
  eq(child.traits.indexOf('ganglia') !== -1, true, 'nowa gałąź ma ganglia');
  eq(parent.traits.indexOf('ganglia'), -1, 'rodzic NIE ma ganglia (niezależność)');
});

group('simulateTurn — symuluje wszystkie żywe linie', function () {
  var s = Engine.createInitialState(GameData, 'Pra');
  s.ep = 100;
  active(s).population = 100;
  s = Engine.speciate(GameData, s, 'B').state;
  var out = Engine.simulateTurn(GameData, s, noMutation);
  eq(out.report.lineReports.length, 2, 'raport dla dwóch linii');
});

// --------------------- Pełne rozgrywki ---------------------
group('pełna rozgrywka — skupiona strategia prowadzi do zwycięstwa', function () {
  var s = Engine.createInitialState(GameData, 'Homo ludens');
  var plan = ['eyes', 'scales', 'many_eggs', 'ganglia', 'shell', 'brain', 'endothermy', 'big_brain'];
  var rng = function () { return 0.5; };
  for (var t = 0; t < s.maxTurns; t++) {
    var changed = true;
    while (changed) {
      changed = false;
      for (var p = 0; p < plan.length; p++) {
        if (active(s).traits.indexOf(plan[p]) !== -1) continue;
        var r = Engine.buyTrait(GameData, s, plan[p]);
        if (r.ok) { s = r.state; changed = true; }
      }
    }
    s = Engine.simulateTurn(GameData, s, rng).state;
    if (s.status !== 'playing') break;
  }
  eq(s.status, 'won', 'skupiona strategia wygrywa');
  ok(Engine.totalPopulation(s) > 0, 'gatunek przetrwał (populacja ' + Engine.totalPopulation(s) + ')');
  ok(Engine.maxIntelligence(s) >= GameData.INTELLIGENCE_GOAL, 'osiągnięto próg inteligencji');
});

group('pełna rozgrywka — gra "na przetrwanie" nie wygrywa', function () {
  var s = Engine.createInitialState(GameData, 'Bujak');
  var plan = ['fins', 'eyes', 'scales', 'jaws', 'many_eggs', 'shell'];
  var rng = function () { return 0.5; };
  for (var t = 0; t < s.maxTurns; t++) {
    for (var p = 0; p < plan.length; p++) {
      var r = Engine.buyTrait(GameData, s, plan[p]);
      if (r.ok) s = r.state;
    }
    s = Engine.simulateTurn(GameData, s, rng).state;
    if (s.status !== 'playing') break;
  }
  ok(s.status === 'survived', 'bez inwestycji w mózg gra kończy się "survived"');
});

console.log('\n────────────────────────');
console.log('Zaliczone: ' + passed + ' | Niezaliczone: ' + failed);
process.exit(failed === 0 ? 0 : 1);
