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
  var init = opts.init || {}; if (init.seed == null) init.seed = 4242;
  var s = Engine.createInitialState(GameData, 'Bot', init);
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
  var s = Engine.createInitialState(GameData, 'X', { seed: 7 }); s.turn = 7; // Perm
  var lrN = Engine.simulateTurn(GameData, s, noMut).report.lineReports[0];
  var h = Engine.createInitialState(GameData, 'X', { difficulty: 'trudny', seed: 7 }); h.turn = 7;
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
  var b = lr.epBreakdown;
  eq(b.growth + b.population + b.niche + b.catastrophe, lr.epGain, 'składniki EP linii sumują się do epGain');
  var out = Engine.simulateTurn(GameData, Engine.createInitialState(GameData, 'X', { seed: 3 }), noMut).report;
  var g = out.globalEp;
  eq(out.lineReports[0].epGain + g.base + g.intelligence + g.colonize, out.epGain, 'EP globalne + linii = suma tury');
});

group('evaluateStatus', function () {
  var s = Engine.createInitialState(GameData, 'X'); active(s).population = 0;
  eq(Engine.evaluateStatus(s, GameData), 'lost', 'populacja 0 => lost');
  var s2 = Engine.createInitialState(GameData, 'X'); active(s2).stats.intelligence = s2.intelligenceGoal;
  eq(Engine.evaluateStatus(s2, GameData), 'playing', 'sam próg inteligencji bez narzędzi => gra trwa');
  active(s2).traits.push(GameData.WIN_TRAIT);
  eq(Engine.evaluateStatus(s2, GameData), 'won', 'próg inteligencji + używanie narzędzi => won');
});


group('świat — ziarno daje powtarzalny, a różne ziarna różny świat', function () {
  var a = Engine.createInitialState(GameData, 'X', { seed: 11 });
  var b = Engine.createInitialState(GameData, 'X', { seed: 11 });
  var c = Engine.createInitialState(GameData, 'X', { seed: 12 });
  eq(JSON.stringify(a.world), JSON.stringify(b.world), 'to samo ziarno => ten sam świat');
  ok(JSON.stringify(a.world) !== JSON.stringify(c.world), 'inne ziarno => inny świat');
  ok(a.world[0][7].catastrophe && /permsk/i.test(a.world[0][7].catastrophe.name), 'wymieranie permskie zostaje na historycznym miejscu');
  var s5 = Engine.createInitialState(GameData, 'X', { seed: 11 }); s5.turn = 4;
  eq(Engine.upcomingOmen(GameData, s5), null, 'brak zwiastuna, gdy za dwie tury spokojnie (tura 6 bez katastrofy)');
  var s6 = Engine.createInitialState(GameData, 'X', { seed: 11 }); s6.turn = 6;
  ok(typeof Engine.upcomingOmen(GameData, s6) === 'string', 'turę przed Permem pojawia się zwiastun');
});

group('symulacja jest deterministyczna przy danym ziarnie (cofanie odtwarza losowość)', function () {
  var s = Engine.createInitialState(GameData, 'X', { seed: 99 });
  var r1 = Engine.simulateTurn(GameData, s).state, r2 = Engine.simulateTurn(GameData, s).state;
  eq(JSON.stringify(r1), JSON.stringify(r2), 'ten sam stan => ten sam wynik tury');
});

group('minimalna żywotna populacja (wąskie gardło)', function () {
  var s = Engine.createInitialState(GameData, 'X', { seed: 1 }); active(s).population = Math.floor(GameData.MIN_VIABLE_POP / 3);
  var out = Engine.simulateTurn(GameData, s, noMut);
  eq(Engine.getLineage(out.state, 'L0').alive, false, 'zbyt mała populacja wymiera');
  eq(out.state.status, 'lost', 'wymarcie jedynej linii => porażka');
  ok(out.state.unlockedKnowledge.indexOf('bottleneck') !== -1, 'karta wiedzy: wąskie gardło');
});

group('pojemność środowiska hamuje wzrost', function () {
  var s = Engine.createInitialState(GameData, 'X', { seed: 1 });
  var env = Engine.currentTurnEnv(GameData, s);
  var small = Engine._internals.computeDynamics(GameData, env, active(s), { nichePop: 100 });
  var big = Engine._internals.computeDynamics(GameData, env, active(s), { nichePop: small.capacity * 1.3 });
  ok(big.birthRate < small.birthRate, 'przy przeludnieniu mniej narodzin');
  ok(big.capacityLossRate > 0, 'nadmiar ponad pojemność ginie');
});

group('kompromisy zależne od niszy i klimatu', function () {
  var l = { niche: 'woda', stats: JSON.parse(JSON.stringify(GameData.BASE_STATS)), traits: ['fins'] };
  var env = Engine.currentTurnEnv(GameData, Engine.createInitialState(GameData, 'X', { seed: 1 }));
  eq(Engine.effectiveStats(GameData, l, env).stats.mobility, l.stats.mobility, 'płetwy w wodzie bez kary');
  l.niche = 'lad';
  eq(Engine.effectiveStats(GameData, l, env).stats.mobility, l.stats.mobility - 2, 'płetwy na lądzie: mobilność -2');
  var cold = JSON.parse(JSON.stringify(env)); cold.climate = 'zimno';
  var ins = { niche: 'lad', stats: JSON.parse(JSON.stringify(GameData.BASE_STATS)), traits: ['insulation'] };
  ok(Engine.effectiveStats(GameData, ins, cold).notes.length > 0, 'izolacja działa w zimnie');
});

group('rywale i koewolucja per nisza', function () {
  var s = Engine.createInitialState(GameData, 'X', { seed: 5 }); s.ep = 300;
  ok(s.rivals.woda && s.rivals.woda.strength > 0, 'w wodzie jest rywal');
  s = Engine.buyTrait(GameData, s, 'shell').state;
  for (var i = 0; i < 3; i++) s = Engine.simulateTurn(GameData, s, noMut).state;
  ok(s.predatorLevels.woda > 0, 'drapieżniki w wodzie doganiają pancerną linię');
  eq(s.predatorLevels.lad, 0, 'na pustym lądzie presja nie rośnie');
});

group('specjacja — koszt rośnie z liczbą linii', function () {
  var s = Engine.createInitialState(GameData, 'X', { seed: 1 }); s.ep = 200; active(s).population = 400;
  var c1 = Engine.speciationCost(GameData, s);
  s = Engine.speciate(GameData, s, 'B').state;
  ok(Engine.speciationCost(GameData, s) > c1, 'druga specjacja droższa');
});

group('odrzucanie cech (narząd szczątkowy)', function () {
  var s = Engine.createInitialState(GameData, 'X', { seed: 1 }); s.ep = 200;
  s = Engine.buyTrait(GameData, s, 'fins').state; s = Engine.buyTrait(GameData, s, 'limbs').state;
  ok(!Engine.dropTrait(GameData, s, 'fins').ok, 'nie można odrzucić płetw, gdy zależą od nich kończyny');
  var mob = active(s).stats.mobility;
  var r = Engine.dropTrait(GameData, s, 'limbs');
  ok(r.ok, 'odrzucenie kończyn');
  eq(active(r.state).stats.mobility, mob - 3, 'efekty cechy cofnięte');
  ok(r.state.achievements.indexOf('vestigial') !== -1, 'osiągnięcie: narząd szczątkowy');
});

group('oferta mutacji — wybór i odrzucenie', function () {
  var s = Engine.createInitialState(GameData, 'X', { seed: 1 });
  s.mutationOffer = Engine._internals.buildMutationOffer(GameData, s, seeded([0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.4]));
  eq(s.mutationOffer.options.length, 3, 'trzy opcje');
  var before = JSON.stringify(active(s).stats);
  var r = Engine.chooseMutation(GameData, s, 0);
  ok(r.ok && r.state.mutationOffer === null, 'wybór zamyka ofertę');
  var rej = Engine.rejectMutation(GameData, s);
  eq(JSON.stringify(active(rej.state).stats), before, 'odrzucenie nie zmienia statystyk');
});

group('quiz po erze i wynik punktowy', function () {
  var s = Engine.createInitialState(GameData, 'X', { seed: 1 });
  s.pendingQuiz = { eraId: 'paleozoik', answers: [] };
  var ep0 = s.ep;
  GameData.QUIZZES.paleozoik.forEach(function (q, i) { s = Engine.answerQuiz(GameData, s, i, q.answer).state; });
  eq(s.ep, ep0 + GameData.QUIZ_EP * GameData.QUIZZES.paleozoik.length, 'poprawne odpowiedzi dają EP');
  var f = Engine.finishQuiz(GameData, s);
  ok(f.state.achievements.indexOf('scholar') !== -1, 'komplet poprawnych => osiągnięcie Uczony');
  ok(Engine.computeScore(GameData, f.state).total > 0, 'wynik punktowy > 0');
});

group('bierność prowadzi do wymarcia', function () {
  var lost = 0;
  for (var i = 1; i <= 10; i++) { if (playThrough([], { init: { seed: i } }).status === 'lost') lost++; }
  ok(lost >= 8, 'gra bez żadnych decyzji zwykle kończy się wymarciem (' + lost + '/10)');
});

group('pełna rozgrywka — skupiona strategia wygrywa (normalny)', function () {
  var plan = ['eyes', 'scales', 'many_eggs', 'ganglia', 'fins', 'limbs', 'jaws',
    'brain', 'endothermy', 'big_brain', 'social', 'grasping_hand', 'tool_use', 'parental_care', 'amniotic_egg'];
  var s = playThrough(plan, { migrateLandWhenAble: true });
  eq(s.status, 'won', 'skupiona strategia wygrywa (int ' + Engine.maxIntelligence(s) + '/' + s.intelligenceGoal + ')');
});

group('pełna rozgrywka — gra "na przetrwanie" nie wygrywa', function () {
  var plan = ['fins', 'eyes', 'scales', 'jaws', 'many_eggs', 'shell', 'limbs'];
  var s = playThrough(plan, { migrateLandWhenAble: true });
  ok(s.status === 'survived' || s.status === 'lost', 'bez mózgu brak zwycięstwa (status ' + s.status + ')');
});

console.log('\n────────────────────────');
console.log('Zaliczone: ' + passed + ' | Niezaliczone: ' + failed);
process.exit(failed === 0 ? 0 : 1);
