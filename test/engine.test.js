/*
 * test/engine.test.js — testy silnika symulacji.
 * Uruchom: node test/engine.test.js
 *
 * Lekki framework asercji bez zależności — zgodnie z zasadą "bez kroku budowania".
 */
'use strict';

var GameData = require('../js/data.js');
var Engine = require('../js/engine.js');

var passed = 0;
var failed = 0;

function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ ' + msg); }
}
function eq(a, b, msg) { ok(a === b, msg + ' (oczekiwano ' + b + ', jest ' + a + ')'); }
function group(name, fn) { console.log('\n• ' + name); fn(); }

// Deterministyczny RNG dla powtarzalnych testów.
function seeded(values) {
  var i = 0;
  return function () { var v = values[i % values.length]; i++; return v; };
}
var noMutation = function () { return 0.99; }; // powyżej progu 0.28 => brak mutacji

group('createInitialState', function () {
  var s = Engine.createInitialState(GameData, 'Testozaur');
  eq(s.species.name, 'Testozaur', 'nazwa gatunku ustawiona');
  eq(s.turn, 0, 'start przed pierwszą turą');
  eq(s.ep, GameData.START_EP, 'startowe EP');
  eq(s.species.population, GameData.START_POPULATION, 'startowa populacja');
  eq(s.status, 'playing', 'status playing');
  eq(s.species.stats.feeding, GameData.BASE_STATS.feeding, 'statystyki bazowe');
});

group('buyTrait — poprawne kupno', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var r = Engine.buyTrait(GameData, s, 'fins');
  ok(r.ok, 'kupno fins się udaje');
  eq(r.state.ep, GameData.START_EP - 10, 'EP odjęte');
  eq(r.state.species.stats.mobility, GameData.BASE_STATS.mobility + 2, 'mobilność +2');
  eq(s.ep, GameData.START_EP, 'oryginalny stan niezmutowany (immutable)');
});

group('buyTrait — warunki wstępne', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var r = Engine.buyTrait(GameData, s, 'limbs'); // wymaga fins
  ok(!r.ok, 'nie można kupić limbs bez fins');
  eq(Engine.traitStatus(s, byId('limbs')), 'locked', 'limbs zablokowane');

  var afterFins = Engine.buyTrait(GameData, s, 'fins').state;
  // dodaj EP by stać było na limbs
  afterFins.ep += 100;
  eq(Engine.traitStatus(afterFins, byId('limbs')), 'available', 'limbs dostępne po fins');
});

group('buyTrait — za mało EP', function () {
  var s = Engine.createInitialState(GameData, 'X');
  s.ep = 5; // ganglia kosztuje 15 i nie ma warunków wstępnych
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
  ok(out.state.species.population > 0, 'populacja przetrwała kambr');
});

group('simulateTurn — nie mutuje wejścia', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var popBefore = s.species.population;
  Engine.simulateTurn(GameData, s, noMutation);
  eq(s.species.population, popBefore, 'wejściowa populacja bez zmian');
  eq(s.turn, 0, 'wejściowa tura bez zmian');
});

group('rollMutation — determinizm', function () {
  var s = Engine.createInitialState(GameData, 'X');
  // rng: pierwsza < 0.28 => mutacja; wybór statystyki; <0.6 => korzystna
  var rng = seeded([0.1, 0.0, 0.1]);
  var m = Engine._internals.rollMutation(s, rng);
  ok(m !== null, 'mutacja wystąpiła');
  ok(m.beneficial === true, 'mutacja korzystna dla rng<0.6');
  eq(m.delta, 1, 'korzystna => +1');
});

group('rollMutation — brak przy wysokim rng', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var m = Engine._internals.rollMutation(s, function () { return 0.9; });
  ok(m === null, 'brak mutacji gdy rng > próg');
});

group('evaluateStatus — wymarcie', function () {
  var s = Engine.createInitialState(GameData, 'X');
  s.species.population = 0;
  eq(Engine.evaluateStatus(s), 'lost', 'populacja 0 => lost');
});

group('evaluateStatus — zwycięstwo przez inteligencję', function () {
  var s = Engine.createInitialState(GameData, 'X');
  s.species.stats.intelligence = GameData.INTELLIGENCE_GOAL;
  eq(Engine.evaluateStatus(s), 'won', 'próg inteligencji => won');
});

group('pełna rozgrywka — skupiona strategia prowadzi do zwycięstwa', function () {
  // Strategia skupiona na ścieżce układu nerwowego + minimum przetrwania.
  var s = Engine.createInitialState(GameData, 'Homo ludens');
  var plan = ['eyes', 'scales', 'many_eggs', 'ganglia', 'shell',
              'brain', 'endothermy', 'big_brain'];
  var rng = function () { return 0.5; }; // brak mutacji, deterministycznie
  for (var t = 0; t < s.maxTurns; t++) {
    // dokupuj wielokrotnie, aż nie da się nic więcej (odblokowane warunki wstępne)
    var changed = true;
    while (changed) {
      changed = false;
      for (var p = 0; p < plan.length; p++) {
        if (s.traits.indexOf(plan[p]) !== -1) continue;
        var r = Engine.buyTrait(GameData, s, plan[p]);
        if (r.ok) { s = r.state; changed = true; }
      }
    }
    var out = Engine.simulateTurn(GameData, s, rng);
    s = out.state;
    if (s.status !== 'playing') break;
  }
  eq(s.status, 'won', 'skupiona strategia wygrywa');
  ok(s.species.population > 0, 'gatunek przetrwał (populacja ' + s.species.population + ')');
  eq(s.species.stats.intelligence >= GameData.INTELLIGENCE_GOAL, true,
     'osiągnięto próg inteligencji (' + s.species.stats.intelligence + ')');
});

group('pełna rozgrywka — gra "na przetrwanie" nie wygrywa (potrzeba inteligencji)', function () {
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
  ok(s.status === 'survived', 'bez inwestycji w mózg gra kończy się "survived", nie "won"');
});

function byId(id) {
  return GameData.TRAITS.filter(function (t) { return t.id === id; })[0];
}

console.log('\n────────────────────────');
console.log('Zaliczone: ' + passed + ' | Niezaliczone: ' + failed);
process.exit(failed === 0 ? 0 : 1);
