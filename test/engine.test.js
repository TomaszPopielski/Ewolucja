/*
 * test/engine.test.js — testy silnika symulacji.
 * Uruchom: node test/engine.test.js
 */
'use strict';

var GameData = require('../js/data.js');
var Engine = require('../js/engine.js');
var Bots = require('./bots.js');

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
  var s = Engine.createInitialState(GameData, 'Pra'); active(s).population = 100;
  active(s).variation = GameData.SPECIATION_COST - 1;
  ok(!Engine.speciate(GameData, s, 'B').ok, 'bez zapasu zmienności genetycznej nie ma specjacji');
  active(s).variation = 20;
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

group('zdarzenia losowe rozstrzyga gracz (karty decyzji)', function () {
  ok(!GameData.POSITIVE_EVENTS, 'brak automatycznych zdarzeń pozytywnych');
  ['bloom', 'mild'].forEach(function (id) {
    var ev = Engine.choiceEvent(GameData, id);
    ok(ev && ev.options.length >= 2 && ev.options.filter(function (o) { return o.default; }).length === 1, 'karta ' + id + ' z wyborem i jedną opcją domyślną');
  });
  var s = Engine.createInitialState(GameData, 'X');
  eq(Engine.simulateTurn(GameData, s, function () { return 0.1; }).report.event, undefined, 'raport bez automatycznego zdarzenia');
});

group('rozbicie EP w raporcie', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var lr = Engine.simulateTurn(GameData, s, noMut).report.lineReports[0];
  ok(lr.epBreakdown && typeof lr.epBreakdown.niche === 'number', 'raport zawiera rozbicie EP');
  var rep = Engine.simulateTurn(GameData, s, noMut).report;
  ok(typeof rep.epPopulation === 'number' && typeof rep.epGrowth === 'number', 'EP za liczebność i wzrost liczone globalnie');
  eq(rep.lineReports[0].epGain + rep.epPopulation + rep.epGrowth + rep.epBase + rep.epIntel, rep.epGain, 'składniki sumują się do EP tury');
});

group('evaluateStatus', function () {
  var s = Engine.createInitialState(GameData, 'X'); active(s).population = 0;
  eq(Engine.evaluateStatus(s, GameData), 'lost', 'populacja 0 => lost');
  var s2 = Engine.createInitialState(GameData, 'X'); active(s2).stats.intelligence = s2.intelligenceGoal;
  eq(Engine.evaluateStatus(s2, GameData), 'playing', 'sam próg inteligencji bez narzędzi => gra trwa');
  active(s2).traits.push(GameData.WIN_TRAIT);
  eq(Engine.evaluateStatus(s2, GameData), 'playing', 'narzędzia w otwartej wodzie to jeszcze nie kultura');
  active(s2).niche = 'lad';
  eq(Engine.evaluateStatus(s2, GameData), 'won', 'próg inteligencji + używanie narzędzi na lądzie => won');
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

group('2.1 migracja kosztuje i wymaga aklimatyzacji', function () {
  var s = Engine.createInitialState(GameData, 'X'); active(s).reserves = 12;
  var cost = Engine.migrationCost(GameData, active(s));
  var m = Engine.migrateLineage(GameData, s, 'L0', 'przybrzeze');
  ok(m.ok, 'migracja na przybrzeże możliwa');
  eq(active(m.state).reserves, 12 - cost, 'migracja kosztuje ⚡ rezerwy (' + cost + ')');
  eq(m.state.ep, s.ep, 'migracja nie kosztuje EP');
  var back = Engine.migrateLineage(GameData, m.state, 'L0', 'woda');
  ok(!back.ok, 'druga migracja w tej samej turze zablokowana: ' + back.error);
  var poor = Engine.createInitialState(GameData, 'X'); active(poor).reserves = 0;
  ok(!Engine.migrateLineage(GameData, poor, 'L0', 'przybrzeze').ok, 'bez rezerw energii nie ma migracji');
  var mobile = Engine.createInitialState(GameData, 'X', { startTraits: ['fins', 'lateral_line'] });
  ok(Engine.migrationCost(GameData, active(mobile)) < cost, 'wyższa mobilność = tańsza migracja');
  // Aklimatyzacja: w turze migracji mniej energii niż bez niej.
  var fAfter = Engine.forecast(GameData, m.state, active(m.state));
  var noAcc = JSON.parse(JSON.stringify(m.state)); active(noAcc).migratedAt = null;
  ok(fAfter.acclimatizing && fAfter.energy < Engine.forecast(GameData, noAcc, active(noAcc)).energy,
    'aklimatyzacja obniża bilans energii w turze migracji');
  var next = Engine.simulateTurn(GameData, m.state, noMut).state; active(next).reserves = 12;
  ok(Engine.migrateLineage(GameData, next, 'L0', 'woda').ok, 'w kolejnej turze można znów migrować');
  ok(!Engine.forecast(GameData, next, active(next)).acclimatizing, 'aklimatyzacja trwa jedną turę');
});

group('2.2 specjacja nie mnoży punktów ewolucji', function () {
  // Ta sama łączna populacja (1400) w 1 albo 7 liniach.
  function gainWith(extraLines) {
    var s = Engine.createInitialState(GameData, 'X', { startTraits: ['ganglia', 'brain', 'fins', 'scales', 'eyes'] });
    s.ep = 500;
    for (var k = 0; k < extraLines; k++) {
      s.lineages.forEach(function (l) { l.population = 400; l.variation = 30; });
      s = Engine.speciate(GameData, s, 'x' + k).state;
    }
    s.lineages.forEach(function (l) { l.population = Math.round(1400 / s.lineages.length); });
    return Engine.simulateTurn(GameData, s, det).report.epGain;
  }
  var one = gainWith(0), seven = gainWith(6);
  ok(seven <= one * 1.25, 'ta sama populacja w 7 liniach nie daje wyraźnie więcej EP (' + seven + ' vs ' + one + ')');
  var s = Engine.createInitialState(GameData, 'X'); active(s).variation = 30; active(s).population = 400;
  var c1 = Engine.speciationCost(GameData, s);
  s = Engine.speciate(GameData, s, 'B').state;
  ok(Engine.speciationCost(GameData, s) > c1, 'koszt specjacji rośnie z liczbą linii (' + c1 + ' → ' + Engine.speciationCost(GameData, s) + ')');
  // Premia za niszę raz na niszę; druga nisza = druga premia.
  var t = Engine.createInitialState(GameData, 'X'); active(t).variation = 30; active(t).population = 400;
  t = Engine.speciate(GameData, t, 'B').state;
  var same = Engine.simulateTurn(GameData, t, det).report.lineReports;
  eq(same[0].epBreakdown.niche + same[1].epBreakdown.niche, GameData.NICHES.woda.epBonus, 'dwie linie w wodzie: jedna premia za niszę');
  Engine.getLineage(t, 'L1').reserves = 10;
  t = Engine.migrateLineage(GameData, t, 'L1', 'przybrzeze').state;
  var diffN = Engine.simulateTurn(GameData, t, det).report.lineReports;
  eq(diffN[0].epBreakdown.niche + diffN[1].epBreakdown.niche, GameData.NICHES.woda.epBonus + GameData.NICHES.przybrzeze.epBonus,
    'linie w dwóch niszach: dwie premie (dywersyfikacja)');
});

group('2.3 zwycięstwo wymaga kultury (używanie narzędzi)', function () {
  var s = Engine.createInitialState(GameData, 'X'); active(s).stats.intelligence = 99;
  eq(Engine.hasWon(s, GameData), false, 'bardzo wysoka inteligencja bez narzędzi to jeszcze nie cel');
  eq(byId(GameData.WIN_TRAIT).minEra, 2, 'narzędzia dostępne dopiero w kenozoiku — brak zwycięstw przed nim');
});

group('2.3 balans — stały plan nie wygrywa, rozwaga popłaca', function () {
  var N = 60, n = { difficulty: 'normalny', pref: 'mix' };
  var plan = Bots.winRate('plan', n, N), star = Bots.winRate('star', n, N), adapt = Bots.winRate('adaptive', n, N);
  ok(plan <= 10 && star <= 10, 'normalny: ślepe plany prawie nigdy nie wygrywają (' + plan + '%, ' + star + '%)');
  ok(adapt > Math.max(plan, star), 'normalny: gracz czytający prognozę wygrywa częściej niż ślepy plan (' + adapt + '%)');
});

group('2.4 kompromisy zależne od warunków', function () {
  var env = GameData.ERAS[0].turns[0];
  var fins = Engine.createInitialState(GameData, 'X', { startTraits: ['fins', 'limbs'] });
  var inWater = Engine.effectiveStats(GameData, active(fins), env).stats.mobility;
  active(fins).niche = 'lad';
  var onLand = Engine.effectiveStats(GameData, active(fins), env);
  eq(inWater - onLand.stats.mobility, 2, 'płetwy nie pomagają na lądzie (mobilność −2)');
  ok(onLand.notes.length > 0, 'efektywne statystyki wyjaśniają kompromisy (' + onLand.notes.map(function (x) { return x.note; }).join('; ') + ')');
  var lowO2 = { oxygen: 8 }, highO2 = { oxygen: 12 };
  var sc = Engine.createInitialState(GameData, 'X', { startTraits: ['scales'] });
  eq(Engine.effectiveStats(GameData, active(sc), lowO2).stats.metabolism -
    Engine.effectiveStats(GameData, active(sc), highO2).stats.metabolism, 1, 'łuski: przy niskim tlenie wyższy metabolizm');
  // Ląd bez jaja lądowego: słabszy rozród.
  var land = Engine.createInitialState(GameData, 'X', { startTraits: ['fins', 'limbs'], startNiche: 'lad' });
  var egg = Engine.createInitialState(GameData, 'X', { startTraits: ['fins', 'limbs', 'scales', 'amniotic_egg'], startNiche: 'lad' });
  eq(Engine.effectiveStats(GameData, active(land), env).stats.reproduction, GameData.BASE_STATS.reproduction - 2,
    'na lądzie bez jaja lądowego rozród −2');
  eq(Engine.effectiveStats(GameData, active(egg), env).stats.reproduction, GameData.BASE_STATS.reproduction + 2,
    'z jajem lądowym brak kary');
  var careful = byId('parental_care');
  ok(careful.effects.reproduction < 0, 'opieka nad potomstwem: mniej potomstwa (zgodnie z opisem)');
  ['eyes', 'scales', 'amniotic_egg', 'many_eggs'].forEach(function (id) {
    var t = byId(id);
    var hasCost = Object.keys(t.effects).some(function (k) { return k === 'metabolism' ? t.effects[k] > 0 : t.effects[k] < 0; }) ||
      (t.conditions && t.conditions.length > 0);
    ok(hasCost, 'cecha „' + t.name + '” ma realny koszt');
  });
});

group('2.5 katastrofy są selektywne', function () {
  var kpg = GameData.ERAS[1].turns.filter(function (t) { return /asteroidy/.test(t.title); })[0].catastrophe;
  var lean = Engine.createInitialState(GameData, 'X');
  var heavy = Engine.createInitialState(GameData, 'X', { startTraits: ['shell', 'fast_muscle', 'endothermy'] });
  var a = Engine.catastropheImpact(kpg, active(lean)), b = Engine.catastropheImpact(kpg, active(heavy));
  ok(a.severity < b.severity, 'K–Pg: oszczędny metabolizm przeżywa lepiej (' + a.severity.toFixed(2) + ' < ' + b.severity.toFixed(2) + ')');
  ok(a.reasons.length > 0 && b.reasons.length === 0, 'podane są powody przetrwania');
  var ice = GameData.ERAS[2].turns.filter(function (t) { return t.catastrophe && /plejstoce/.test(t.catastrophe.name); })[0];
  var s = Engine.createInitialState(GameData, 'X', Bots.scenarioInit('ice'));
  s.turn = GameData.ERAS[2].turns.indexOf(ice);
  var plain = Engine.simulateTurn(GameData, s, noMut).report.lineReports[0];
  ok(plain.survivalReasons.length > 0, 'zlodowacenie: izolacja pomaga (' + plain.survivalReasons.join('; ') + ')');
  ok(plain.events.some(function (e) { return /Przetrwać pomogło/.test(e); }), 'raport wyjaśnia, dlaczego linia przetrwała');
  var f = Engine.forecast(GameData, s, active(s));
  ok(f.catastropheDeaths > 0 && f.projectedPop < active(s).population + f.births, 'prognoza uwzględnia straty w katastrofie');
});

group('2.6 mutacje: inteligencja tylko z mózgiem, metabolizm też mutuje', function () {
  var seen = {};
  for (var i = 0; i < 400; i++) {
    var l = { stats: JSON.parse(JSON.stringify(GameData.BASE_STATS)), traits: [] };
    var m = Engine._internals.rollMutation(l, Bots.seededRng(i));
    if (m) seen[m.key] = (seen[m.key] || 0) + 1;
  }
  ok(!seen.intelligence, 'bez mózgu brak mutacji inteligencji');
  ok(seen.metabolism > 0, 'metabolizm mutuje (' + seen.metabolism + ')');
  var good = Engine._internals.rollMutation({ stats: { metabolism: 5 }, traits: [] }, seeded([0.1, 0.99, 0.1]));
  ok(good.key === 'metabolism' && good.beneficial && good.delta === -1, 'korzystna mutacja metabolizmu go obniża');
  var brainy = 0;
  for (var j = 0; j < 400; j++) {
    var bl = { stats: JSON.parse(JSON.stringify(GameData.BASE_STATS)), traits: ['brain'] };
    var bm = Engine._internals.rollMutation(bl, Bots.seededRng(j));
    if (bm && bm.key === 'intelligence') brainy++;
  }
  ok(brainy > 0, 'z mózgiem inteligencja może mutować (' + brainy + ')');
});

group('zmienność środowiska (faza środowiska)', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var baseTurn1 = GameData.ERAS[0].turns[1];
  var calm = Engine.simulateTurn(GameData, s, det).state;
  eq(Engine.currentTurnEnv(GameData, calm).food, baseTurn1.food, 'rng 0.5 = warunki historyczne');
  var foods = {};
  for (var i = 1; i <= 30; i++) foods[Engine.currentTurnEnv(GameData, Engine.simulateTurn(GameData, s, Bots.seededRng(i)).state).food] = 1;
  ok(Object.keys(foods).length > 1, 'warunki kolejnej tury się różnią (' + Object.keys(foods).join(', ') + ')');
  var moved = JSON.parse(JSON.stringify(calm)); moved.turn = 5;
  eq(Engine.currentTurnEnv(GameData, moved), GameData.ERAS[0].turns[5], 'wylosowane warunki dotyczą tylko swojej tury');
  // Tura z katastrofą zachowuje historyczny klimat.
  var catTurn = GameData.ERAS[0].turns.indexOf(GameData.ERAS[0].turns.filter(function (t) { return t.catastrophe; })[0]);
  var climates = {};
  for (var k = 1; k <= 30; k++) {
    var pre = Engine.createInitialState(GameData, 'X'); pre.turn = catTurn - 1;
    climates[Engine.currentTurnEnv(GameData, Engine.simulateTurn(GameData, pre, Bots.seededRng(k)).state).climate] = 1;
  }
  eq(Object.keys(climates).join(), GameData.ERAS[0].turns[catTurn].climate, 'katastrofa: klimat historyczny');
});

group('mała populacja nie jest nieśmiertelna (losowe zaokrąglanie, efekt Allee)', function () {
  var sround = Engine._internals.sround, rng = Bots.seededRng(7), sum = 0;
  for (var i = 0; i < 10000; i++) sum += sround(0.4, rng);
  ok(Math.abs(sum / 10000 - 0.4) < 0.02, 'losowe zaokrąglanie zachowuje wartość oczekiwaną (' + (sum / 10000) + ')');
  eq(sround(3, rng), 3, 'liczba całkowita bez zmian');
  var allee = Engine._internals.alleeFactor, mvp = GameData.MIN_VIABLE_POP;
  eq(allee(GameData, mvp), 1, 'od progu żywotności rozród bez kary');
  ok(allee(GameData, mvp / 2) < 1, 'poniżej progu rozród słabnie');
  // Kilka osobników pod presją: dawniej straty zaokrąglały się do 0 (0% wymarć).
  var lost = 0, N = 100;
  for (var k = 1; k <= N; k++) {
    var r = Bots.seededRng(k), s = Engine.createInitialState(GameData, 'X');
    active(s).population = 3;
    for (var t = 0; t < 10 && s.status === 'playing'; t++) s = Engine.simulateTurn(GameData, s, r).state;
    if (s.status === 'lost') lost++;
  }
  ok(lost >= 40, 'linia z 3 osobnikami realnie może wymrzeć w 10 tur (' + lost + '%)');
  var crit = Engine.createInitialState(GameData, 'X'); active(crit).population = mvp - 1;
  eq(Engine.forecast(GameData, crit, active(crit)).critical, true, 'prognoza ostrzega o krytycznie małej populacji');
  eq(Engine.forecast(GameData, Engine.createInitialState(GameData, 'X'), active(Engine.createInitialState(GameData, 'X'))).critical, false,
    'startowa populacja nie jest krytyczna');
});

group('żywotna populacja: zwycięstwo i koniec gry', function () {
  var s = Engine.createInitialState(GameData, 'X'), l = active(s);
  l.stats.intelligence = 99; l.traits.push(GameData.WIN_TRAIT); l.niche = 'lad';
  l.population = GameData.WIN_MIN_POP - 1;
  eq(Engine.hasWon(s, GameData), false, 'rozum i narzędzia, ale garstka osobników — jeszcze nie zwycięstwo');
  eq(Engine.goalBlockedByPopulation(s, GameData), true, 'UI wie, że brakuje tylko liczebności');
  l.population = GameData.WIN_MIN_POP;
  eq(Engine.hasWon(s, GameData), true, 'żywotna populacja z rozumem i narzędziami wygrywa');
  // Koniec ostatniej ery z populacją poniżej progu żywotności = wymarcie.
  var end = Engine.createInitialState(GameData, 'X');
  end.eraIndex = GameData.ERAS.length - 1; end.turn = GameData.ERAS[end.eraIndex].turns.length - 1;
  end.env = null; active(end).population = 3;
  var fin = Engine.simulateTurn(GameData, end, Bots.seededRng(3)).state;
  if (Engine.totalPopulation(fin) > 0) {
    eq(fin.status, 'lost', 'garstka osobników na końcu gry to wymarcie funkcjonalne');
    eq(fin.endReason, 'nonviable', 'powód: populacja poniżej progu żywotności');
  }
  var lost = 0, N = 100;
  for (var k = 1; k <= N; k++) {
    var r = Bots.seededRng(k), p = Engine.createInitialState(GameData, 'X');
    while (p.status === 'playing') p = Engine.simulateTurn(GameData, p, r).state;
    if (p.status === 'lost') lost++;
  }
  ok(lost >= 50, 'normalny: bierny gracz zwykle przegrywa (' + lost + '%)');
});

// ---------- Nowe waluty i decyzje: ⚡ rezerwy, 🧬 zmienność, strategie, karty ----------
function envOf(s) { return Engine.currentTurnEnv(GameData, s); }
function dyn(s, l) { return Engine._internals.computeDynamics(GameData, envOf(s), l, { nowTurn: Engine.nowTurn(GameData, s) }); }

group('⚡ rezerwy: nadwyżka trafia do zapasów, deficyt najpierw je zużywa', function () {
  var R = GameData.RESERVES;
  var s = Engine.createInitialState(GameData, 'X'), l = active(s);
  eq(l.reserves, R.start, 'rezerwy startowe');
  l.stats.feeding = 12;                       // wyraźna nadwyżka energii
  var d = dyn(s, l);
  ok(d.energy > 0 && d.reservesAfter > l.reserves, 'nadwyżka energii powiększa rezerwy (' + l.reserves + ' → ' + d.reservesAfter + ')');
  l.stats.feeding = 40; ok(dyn(s, l).reservesAfter <= R.cap, 'rezerwy nie przekraczają pojemności magazynu');
  eq(Engine.reservesCap(GameData, { traits: ['insulation'] }), R.cap + R.capBonus.insulation, 'izolacja (tłuszcz/futro) powiększa magazyn');
  // Deficyt: z rezerwami głód mniejszy niż bez nich.
  var h = Engine.createInitialState(GameData, 'X'), hl = active(h); hl.stats.metabolism = 9;
  var withR = dyn(h, hl); hl.reserves = 0; var noR = dyn(h, hl);
  ok(withR.energy < 0 && withR.reserveDraw > 0 && withR.reserveDraw <= R.drawMax, 'deficyt pobiera rezerwy (maks. ' + R.drawMax + ' na turę)');
  ok(withR.starvationLossRate < noR.starvationLossRate, 'zapasy łagodzą głód');
  hl.reserves = R.start;
  var t = Engine.simulateTurn(GameData, h, noMut);
  ok(t.report.lineReports[0].events.some(function (e) { return /zapasy/.test(e); }), 'raport mówi o pokryciu deficytu z zapasów');
});

group('strategia rozrodu r/K — kompromis bez kosztu', function () {
  var s = Engine.createInitialState(GameData, 'X'), l = active(s); l.stats.defense = 0;
  var base = dyn(s, l);
  s = Engine.setStrategy(GameData, s, 'L0', 'r').state; var r = dyn(s, active(s));
  s = Engine.setStrategy(GameData, s, 'L0', 'K').state; var k = dyn(s, active(s));
  ok(r.birthRate > base.birthRate && k.birthRate < base.birthRate, 'r: więcej narodzin, K: mniej');
  ok(r.predationLossRate > base.predationLossRate && k.predationLossRate < base.predationLossRate, 'r: większe straty, K: mniejsze');
  ok(s.unlockedKnowledge.indexOf('rk') !== -1, 'karta wiedzy o strategiach r i K');
  eq(active(Engine.simulateTurn(GameData, s, noMut).state).strategy, 'K', 'strategia obowiązuje do zmiany');
  ok(!Engine.setStrategy(GameData, s, 'L0', 'xyz').ok, 'nieznana strategia odrzucona');
});

group('zachowanie w turze — płatne ⚡, jednorazowe', function () {
  var s = Engine.createInitialState(GameData, 'X'); active(s).reserves = 1; active(s).stats.defense = 0;
  ok(!Engine.setBehavior(GameData, s, 'L0', 'ukrycie').ok, 'ukrywanie się wymaga ' + GameData.BEHAVIORS.ukrycie.cost + ' ⚡');
  active(s).reserves = 10;
  var base = dyn(s, active(s));
  var h = Engine.setBehavior(GameData, s, 'L0', 'ukrycie').state, hd = dyn(h, active(h));
  ok(hd.predationPressure < base.predationPressure && hd.energy < base.energy, 'ukrycie: mniej drapieżników, mniej pokarmu');
  var f = Engine.setBehavior(GameData, s, 'L0', 'zerowanie').state, fd = dyn(f, active(f));
  ok(fd.energy > base.energy && fd.predationPressure > base.predationPressure, 'intensywne żerowanie: więcej pokarmu i ryzyka');
  var z = Engine.setBehavior(GameData, s, 'L0', 'zapasy').state, zd = dyn(z, active(z));
  ok(zd.birthRate < base.birthRate && zd.reservesAfter > base.reservesAfter, 'gromadzenie zapasów: mniej potomstwa, więcej ⚡');
  var after = Engine.simulateTurn(GameData, h, noMut).state;
  eq(active(after).behavior, 'ukrycie', 'zachowanie zostaje do zmiany przez gracza');
  ok(active(after).reserves < 10, 'zachowanie zużyło rezerwy');
});

group('🧬 zmienność: rośnie z liczebnością, znika w wąskim gardle', function () {
  var V = GameData.VARIATION;
  var s = Engine.createInitialState(GameData, 'X'); active(s).population = 600;
  var v0 = active(s).variation;
  var n1 = Engine.simulateTurn(GameData, s, noMut).state;
  ok(active(n1).variation > v0 + V.base, 'duża populacja szybciej zyskuje zmienność (' + v0 + ' → ' + active(n1).variation + ')');
  var b = Engine.createInitialState(GameData, 'X'); active(b).population = 8; active(b).variation = 20;
  var nb = Engine.simulateTurn(GameData, b, noMut);
  if (active(nb.state).population > 0) {
    ok(active(nb.state).variation <= 10, 'wąskie gardło zabiera zmienność (20 → ' + active(nb.state).variation + ')');
    ok(nb.state.unlockedKnowledge.indexOf('drift') !== -1, 'karta wiedzy o dryfie genetycznym');
  }
  // Zmienność łagodzi katastrofę.
  var kpg = GameData.ERAS[1].turns[5].catastrophe;
  var lo = { traits: [], niche: 'lad', stats: GameData.BASE_STATS, variation: 0 };
  var hi = { traits: [], niche: 'lad', stats: GameData.BASE_STATS, variation: 30 };
  var a = Engine.catastropheImpact(kpg, lo, null, GameData), c = Engine.catastropheImpact(kpg, hi, null, GameData);
  ok(c.severity < a.severity && c.reasons.some(function (r) { return /zmienność/.test(r); }), 'wysoka zmienność łagodzi katastrofę i jest w raporcie');
});

group('ukierunkowany dobór: wybrana cecha, zużywa zmienność, kosztuje potomstwo', function () {
  var S = GameData.SELECTION;
  var s = Engine.createInitialState(GameData, 'X'); active(s).variation = S.cost - 1;
  ok(!Engine.setSelection(GameData, s, 'L0', 'feeding').ok, 'bez zmienności nie ma ukierunkowanego doboru');
  active(s).variation = 20;
  ok(!Engine.setSelection(GameData, s, 'L0', 'intelligence').ok, 'dobór na inteligencję wymaga mózgu');
  var on = Engine.setSelection(GameData, s, 'L0', 'defense');
  ok(on.ok && active(on.state).selection === 'defense', 'dobór ustawiony na wybraną cechę');
  ok(Engine.forecast(GameData, on.state, active(on.state)).births < Engine.forecast(GameData, s, active(s)).births,
    'koszt doboru: mniej narodzin (odsiane osobniki nie zostawiają potomstwa)');
  var hits = 0, rng = Bots.seededRng(5);
  for (var i = 0; i < 1000; i++) {
    var l = { stats: { feeding: 5, defense: 5, reproduction: 5, mobility: 5, metabolism: 5, intelligence: 1 }, traits: [], selection: 'defense', variation: 10 };
    var r = Engine._internals.applySelection(GameData, l, rng);
    if (r && r.hit) { hits++; if (l.stats.defense !== 6 || l.variation !== 10 - S.cost) { hits = -1e9; break; } }
  }
  ok(Math.abs(hits / 1000 - S.chance) < 0.05, 'wybrana cecha rośnie z zadaną szansą (' + hits + '/1000), a dobór płaci 🧬');
  var poor = JSON.parse(JSON.stringify(on.state)); active(poor).variation = 0; active(poor).population = 10;
  var rr = Engine.simulateTurn(GameData, poor, noMut);
  eq(Engine.getLineage(rr.state, 'L0').selection, false, 'po wyczerpaniu zmienności dobór wyłącza się sam');
});

group('specjacja płatna zmiennością, nie EP', function () {
  var s = Engine.createInitialState(GameData, 'X'); active(s).population = 200; active(s).variation = 20;
  var cost = Engine.speciationCost(GameData, s), r = Engine.speciate(GameData, s, 'B');
  ok(r.ok, 'specjacja z zapasem zmienności');
  eq(r.state.ep, s.ep, 'EP nietknięte');
  eq(Engine.getLineage(r.state, 'L0').variation, 20 - cost, 'rodzic płaci ' + cost + ' 🧬');
  eq(Engine.getLineage(r.state, 'L1').variation, 20 - cost, 'potomna linia dziedziczy pozostałą zmienność');
});

group('karty decyzji', function () {
  function withChoice(eventId, pop) {
    var s = Engine.createInitialState(GameData, 'X'); active(s).population = pop || 200;
    s.pendingChoice = { eventId: eventId, lineageId: 'L0', turn: Engine.nowTurn(GameData, s) };
    return s;
  }
  // Losowanie: karty pojawiają się w części tur, nigdy przed katastrofą.
  var seen = 0, beforeCat = 0;
  for (var k = 1; k <= 40; k++) {
    var g = Engine.createInitialState(GameData, 'X'), r = Bots.seededRng(k);
    while (g.status === 'playing') {
      g = Engine.simulateTurn(GameData, g, r).state;
      if (g.pendingChoice) { seen++; if (Engine.currentTurnEnv(GameData, g).catastrophe) beforeCat++; g.pendingChoice = null; }
    }
  }
  ok(seen > 20, 'karty decyzji pojawiają się w grze (' + seen + ' w 40 grach)');
  eq(beforeCat, 0, 'brak kart przed turą katastrofy');

  var isl = Engine.resolveChoice(GameData, withChoice('island'), 'colonize');
  ok(isl.ok && isl.state.pendingGamble && isl.state.pendingChoice === null, 'przeprawa na wyspę to ryzyko rozstrzygane w turze');
  var ok1 = Engine.simulateTurn(GameData, isl.state, function () { return 0.01; });
  ok(ok1.report.choice.outcome.win && ok1.state.lineages.length === 2, 'udana przeprawa zakłada nową linię');
  ok(/wyspa/.test(ok1.state.lineages[1].name) && ok1.report.lineReports[1].popBefore === 50, '¼ populacji odpływa');
  ok(ok1.state.lineages[1].variation <= GameData.VARIATION.founder + 2, 'efekt założyciela: mała zmienność kolonii');
  ok(ok1.state.unlockedKnowledge.indexOf('founder') !== -1, 'karta wiedzy o efekcie założyciela');
  var bad1 = Engine.simulateTurn(GameData, isl.state, function () { return 0.999; });
  ok(!bad1.report.choice.outcome.win && bad1.state.lineages.length === 1, 'nieudana przeprawa: bez kolonii, z ofiarami');

  var dis = withChoice('disease'); active(dis).variation = 0;
  ok(!Engine.resolveChoice(GameData, dis, 'resist').ok, 'odporność kosztuje 🧬 — bez zmienności niedostępna');
  var auto = Engine.simulateTurn(GameData, dis, noMut);
  ok(auto.report.lineReports[0].diseaseDeaths > 0, 'bez wyboru działa opcja domyślna (choroba zabija)');
  eq(auto.report.choice.option, 'Przetrwać chorobę', 'raport pokazuje rozstrzygnięcie karty');
  var res = withChoice('disease'); active(res).variation = 10;
  var rs = Engine.resolveChoice(GameData, res, 'resist').state;
  eq(active(rs).variation, 6, 'odporność kosztuje 4 🧬');
  eq(Engine.simulateTurn(GameData, rs, noMut).report.lineReports[0].diseaseDeaths, 0, 'zmienność chroni przed chorobą');

  var hide = withChoice('predator'); active(hide).reserves = 10;
  var hs = Engine.resolveChoice(GameData, hide, 'hide').state;
  eq(Engine.forecast(GameData, hs, active(hs)).predationDeaths, 0, 'przeczekanie w ukryciu: brak strat od drapieżników');
  var arms = Engine.resolveChoice(GameData, withChoice('predator'), 'arms').state;
  ok(active(arms).stats.defense === GameData.BASE_STATS.defense + 1 && arms.predatorLevel > 0, 'wyścig zbrojeń: obrona i szybsza koewolucja');

  var boom = Engine.resolveChoice(GameData, withChoice('bloom'), 'breed').state;
  var fb = Engine.forecast(GameData, boom, active(boom)), f0 = Engine.forecast(GameData, withChoice('bloom'), active(withChoice('bloom')));
  ok(fb.births > f0.births, 'boom: więcej narodzin w tej turze');
  var nx = Engine.simulateTurn(GameData, boom, noMut).state;
  var e1 = Engine.forecast(GameData, nx, active(nx)).energy, clean = JSON.parse(JSON.stringify(nx)); active(clean).mods = [];
  ok(e1 < Engine.forecast(GameData, clean, active(clean)).energy, '…i mniej pokarmu w następnej (załamanie)');
});

group('balans: krzywa trudności i napięcie do końca (bot kladowy, gracze lądowi i wodni)', function () {
  var N = 60, easy = Bots.winRate('clade', { difficulty: 'latwy', pref: 'mix' }, N);
  var norm = Bots.winRate('clade', { difficulty: 'normalny', pref: 'mix' }, N);
  var hard = Bots.winRate('clade', { difficulty: 'trudny', pref: 'mix' }, N);
  ok(easy > norm && norm > hard, 'trudność rośnie: ' + easy + '% > ' + norm + '% > ' + hard + '%');
  ok(easy >= 70 && easy <= 97, 'łatwy: wygrana częsta, ale nie pewna (' + easy + '%)');
  ok(norm >= 40 && norm <= 75, 'normalny: realne wyzwanie (' + norm + '%)');
  ok(hard >= 18 && hard <= 55, 'trudny: wygrywalny, ale rzadziej (' + hard + '%)');
  var turns = {};
  for (var i = 1; i <= N; i++) { var g = Bots.play('clade', { difficulty: 'normalny', pref: 'mix' }, i); if (g.status === 'won') turns[Engine.elapsedTurns(GameData, g)] = 1; }
  ok(Object.keys(turns).length >= 4, 'zwycięstwa rozkładają się na wiele tur, nie tylko ostatnią lub pierwszą możliwą (' + Object.keys(turns).join(', ') + ')');
});

group('balans: obie drogi do rozumu są grywalne', function () {
  var N = 60, land = Bots.winRate('clade', { difficulty: 'normalny', pref: 'land' }, N);
  var sea = Bots.winRate('clade', { difficulty: 'normalny', pref: 'sea' }, N);
  ok(land >= 35 && sea >= 35 && Math.abs(land - sea) <= 25, 'narzędzia na lądzie ' + land + '% i kultura akustyczna w wodzie ' + sea + '%');
});

// ---------- Pojemność nisz, konkurencja, radiacja ----------
group('pojemność niszy: wzrost logistyczny i przegęszczenie', function () {
  var s = Engine.createInitialState(GameData, 'X'), l = active(s);
  l.population = 40; var low = Engine.forecast(GameData, s, l);
  ok(low.capacity > 0 && low.nicheLoad === 40, 'prognoza zna pojemność niszy (' + low.nicheLoad + ' / ' + low.capacity + ')');
  l.population = Math.round(low.capacity * 0.95); var near = Engine.forecast(GameData, s, l);
  ok(near.births / l.population < low.births / 40 * 0.5, 'blisko pojemności rozród wyraźnie słabnie');
  l.population = low.capacity * 2; var over = Engine.forecast(GameData, s, l);
  ok(over.births === 0 && over.crowdDeaths > 0, 'ponad pojemność: brak narodzin i straty z przegęszczenia');
  var r = Engine.simulateTurn(GameData, s, noMut);
  ok(r.state.unlockedKnowledge.indexOf('capacity') !== -1, 'karta wiedzy o pojemności środowiska');
  ok(r.report.lineReports[0].events.some(function (e) { return /przepełniona/.test(e); }), 'raport wyjaśnia przegęszczenie');
});

group('konkurencja: linie w jednej niszy dzielą pojemność', function () {
  var s = Engine.createInitialState(GameData, 'X'); active(s).population = 200; active(s).variation = 30;
  var alone = Engine.forecast(GameData, s, active(s));
  s = Engine.speciate(GameData, s, 'B').state;
  var p = Engine.getLineage(s, 'L0'), c = Engine.getLineage(s, 'L1');
  eq(Engine.forecast(GameData, s, p).nicheLoad, 200, 'obie linie liczą się do obciążenia niszy');
  var shared = Engine.forecast(GameData, s, p).births + Engine.forecast(GameData, s, c).births;
  c.reserves = 10;
  var m = Engine.migrateLineage(GameData, s, 'L1', 'przybrzeze').state;
  var apart = Engine.forecast(GameData, m, Engine.getLineage(m, 'L0')).births + Engine.forecast(GameData, m, Engine.getLineage(m, 'L1')).births;
  ok(apart > shared, 'rozejście nisz daje więcej narodzin niż konkurencja w jednej (' + apart + ' > ' + shared + ')');
  var t = Engine.simulateTurn(GameData, s, noMut).state;
  ok(t.unlockedKnowledge.indexOf('competition') !== -1, 'karta wiedzy o konkurencji');
  ok(Engine.simulateTurn(GameData, m, noMut).state.unlockedKnowledge.indexOf('radiation') !== -1, 'karta wiedzy o radiacji adaptacyjnej');
  eq(c.population, Math.floor(200 * GameData.SPECIATION_SHARE), 'nową linię zakłada część populacji');
});

group('EP za liczebność z sumy linii', function () {
  function gain(split) {
    var s = Engine.createInitialState(GameData, 'X'); active(s).variation = 30; active(s).population = 400;
    if (split) { s = Engine.speciate(GameData, s, 'B').state; s.lineages[0].population = 223; s.lineages[1].population = 177; }
    return Engine.simulateTurn(GameData, s, noMut).report;
  }
  var one = gain(false), two = gain(true);
  ok(one.epPopulation === Math.floor(one.totalPopulation / GameData.EP_RULES.perPopulation), 'EP za liczebność = łączna populacja / ' + GameData.EP_RULES.perPopulation);
  ok(Math.abs(two.epPopulation - one.epPopulation) <= 1, 'podział na linie nie traci EP na zaokrągleniach (' + two.epPopulation + ' vs ' + one.epPopulation + ')');
});

group('nowa linia: uwolnienie od wrogów', function () {
  var s = Engine.createInitialState(GameData, 'X'); active(s).population = 200; active(s).variation = 30;
  s = Engine.speciate(GameData, s, 'B').state;
  var p = Engine.getLineage(s, 'L0'), c = Engine.getLineage(s, 'L1');
  c.stats.defense = 0; p.stats.defense = 0;
  var fp = Engine.forecast(GameData, s, p), fc = Engine.forecast(GameData, s, c);
  ok(fc.enemyRelease && fc.predationPressure < fp.predationPressure, 'nowa linia ma mniejszą presję drapieżników');
  for (var k = 0; k < GameData.NEW_LINEAGE.turns; k++) s = Engine.simulateTurn(GameData, s, noMut).state;
  ok(!Engine.forecast(GameData, s, Engine.getLineage(s, 'L1')).enemyRelease, 'ochrona wygasa po ' + GameData.NEW_LINEAGE.turns + ' turach');
});

group('katastrofy zależne od niszy — dywersyfikacja chroni', function () {
  function cat(re) { var c = null; GameData.ERAS.forEach(function (e) { e.turns.forEach(function (t) { if (t.catastrophe && re.test(t.catastrophe.name)) c = t.catastrophe; }); }); return c; }
  var ord = cat(/ordowick/), kpg = cat(/K–Pg/), ice = cat(/plejstoce/);
  ok(Engine.catastropheSeverity(ord, 'woda') > Engine.catastropheSeverity(ord, 'lad'), 'ordowik: morza cierpią bardziej niż ląd');
  ok(Engine.catastropheSeverity(kpg, 'lad') > Engine.catastropheSeverity(kpg, 'woda'), 'K–Pg: ląd cierpi bardziej niż woda');
  ok(Engine.catastropheSeverity(ice, 'lad') > Engine.catastropheSeverity(ice, 'woda'), 'zlodowacenie: ląd cierpi bardziej niż woda');
});

group('balans: rozgałęzianie się opłaca (klad, zasięg, ewolucja równoległa)', function () {
  var N = 80, n = { difficulty: 'normalny', pref: 'mix' };
  var single = Bots.winRate('tactics1', n, N), clade = Bots.winRate('clade', n, N);
  ok(clade >= single + 5, 'klad w kilku niszach wygrywa wyraźnie częściej niż jedna linia (' + clade + '% vs ' + single + '%)');
});

group('scenariusze mają własne reguły', function () {
  var N = 60, land = Bots.scenarioInit('land'), ice = Bots.scenarioInit('ice');
  var s = Engine.createInitialState(GameData, 'X', Object.assign({ seed: 'LAND01' }, land));
  eq(active(s).niche, 'przybrzeze', 'podbój lądu: start na przybrzeżu');
  ok(Engine.winPaths(GameData, s).every(function (p) { return p.id === 'tools'; }), 'podbój lądu: tylko narzędzia');
  ok(s.eraGoals.some(function (g) { return g.era === 0 && g.id === 'land'; }), 'podbój lądu: cel „Wyjdź na ląd” w paleozoiku');
  var l = active(s); l.niche = 'lad'; l.traits.push('limbs');
  var f1 = Engine.forecast(GameData, s, l), plain = Engine.createInitialState(GameData, 'X', { seed: 'LAND01' }); active(plain).niche = 'lad';
  ok(f1.capacity > Engine.forecast(GameData, plain, active(plain)).capacity, 'podbój lądu: ląd wyżywi więcej osobników');
  var careful = Bots.winRate('tactics1', ice, N), blind = Bots.winRate('star', ice, N);
  ok(careful >= blind, 'epoki lodowcowe: rozwaga nie przegrywa ze ślepym planem (' + careful + '% vs ' + blind + '%)');
  ok(careful > 15 && careful < 90, 'epoki lodowcowe: realny sprint (' + careful + '%)');
});

// ---------- Karty decyzji z ryzykiem ----------
group('karty z ryzykiem: wynik losowany w turze, szansa zależy od cech', function () {
  function withChoice(eventId) {
    var s = Engine.createInitialState(GameData, 'X'); active(s).population = 200;
    s.pendingChoice = { eventId: eventId, lineageId: 'L0', turn: Engine.nowTurn(GameData, s) };
    return s;
  }
  function rngSeq(first) { var used = false; return function () { if (!used) { used = true; return first; } return 0.99; }; }
  var ev = Engine.choiceEvent(GameData, 'toxic_food'), taste = ev.options[0];
  var st = Engine.resolveChoice(GameData, withChoice('toxic_food'), 'taste').state;
  ok(st.pendingGamble && st.pendingGamble.optionId === 'taste', 'ryzykowna opcja czeka na rozstrzygnięcie w turze');
  var win = Engine.simulateTurn(GameData, st, rngSeq(0));
  ok(win.report.choice.outcome.win, 'rng poniżej szansy — sukces');
  eq(active(win.state).stats.feeding, GameData.BASE_STATS.feeding + 1, 'sukces: odżywianie +1 na stałe');
  var lose = Engine.simulateTurn(GameData, st, rngSeq(0.999));
  ok(!lose.report.choice.outcome.win && lose.report.choice.outcome.popDelta === -40, 'porażka: ginie 20% populacji (−40)');
  eq(active(lose.state).stats.metabolism, GameData.BASE_STATS.metabolism + 1, 'porażka jest też trwała: metabolizm +1');
  eq(lose.state.pendingGamble, null, 'ryzyko rozstrzygnięte raz');

  var l = active(withChoice('predator')), scare = Engine.choiceEvent(GameData, 'predator').options.filter(function (o) { return o.id === 'scare'; })[0];
  var low = Engine.gambleChance(GameData, l, scare.gamble); l.stats.defense += 4;
  ok(Engine.gambleChance(GameData, l, scare.gamble) > low, 'lepsza obrona — większa szansa odstraszenia łowcy');

  // Domyślna opcja też może być ryzykiem (wulkan) — rozstrzyga się bez wyboru gracza.
  var vol = Engine.simulateTurn(GameData, withChoice('volcano'), rngSeq(0.999));
  ok(vol.report.choice.outcome && !vol.report.choice.outcome.win, 'bez wyboru: domyślne ryzyko też się rozstrzyga');

  // Każda opcja z ryzykiem ma oba wyniki z opisem.
  var bad = [];
  GameData.CHOICE_EVENTS.forEach(function (e) { e.options.forEach(function (o) {
    if (o.gamble && !(o.gamble.win && o.gamble.win.text && o.gamble.lose && o.gamble.lose.text)) bad.push(e.id + '/' + o.id);
    [o.knowledge, o.gamble && o.gamble.win.knowledge, o.gamble && o.gamble.lose.knowledge].forEach(function (k) {
      if (k && !GameData.KNOWLEDGE[k]) bad.push(e.id + ': brak karty wiedzy ' + k);
    });
  }); });
  eq(bad.length, 0, 'opcje ryzyka mają opis sukcesu i porażki, a karty wiedzy istnieją ' + bad.join(', '));
  ok(GameData.CHOICE_EVENTS.filter(function (e) { return e.options.some(function (o) { return o.gamble; }); }).length >= 8,
    'co najmniej 8 kart ma opcję z ryzykiem');
});

group('karty decyzji nie powtarzają się w partii', function () {
  var repeats = 0, games = 0;
  for (var k = 1; k <= 60; k++) {
    var g = Engine.createInitialState(GameData, 'X'), r = Bots.seededRng(k), seen = {};
    while (g.status === 'playing') {
      g = Engine.simulateTurn(GameData, g, r).state;
      if (g.pendingChoice) { if (seen[g.pendingChoice.eventId]) repeats++; seen[g.pendingChoice.eventId] = 1; }
    }
    games++;
  }
  eq(repeats, 0, 'w ' + games + ' partiach żadna karta nie padła dwa razy');
});

group('raport: pełne karty wiedzy tylko dla nowych pojęć', function () {
  var s = Engine.createInitialState(GameData, 'X');
  var r1 = Engine.simulateTurn(GameData, s, noMut).report;
  ok(r1.newKnowledge.every(function (k) { return s.unlockedKnowledge.indexOf(k) === -1; }), 'nowe pojęcia to te nieznane przed turą');
  var s2 = Engine.simulateTurn(GameData, s, noMut).state;
  var r2 = Engine.simulateTurn(GameData, s2, noMut).report;
  ok(r2.newKnowledge.every(function (k) { return s2.unlockedKnowledge.indexOf(k) === -1; }) &&
    r2.knowledge.filter(function (k) { return s2.unlockedKnowledge.indexOf(k) !== -1; }).every(function (k) { return r2.newKnowledge.indexOf(k) === -1; }),
    'znane pojęcia nie wracają jako nowe');
  ok(typeof r2.predatorDelta === 'number', 'raport podaje zmianę presji drapieżników');
});

// ---------- Regrywalność: kod świata, kalendarz, cele, drogi, szanse, wynik ----------
function withSeed(seed, opts) { return Engine.createInitialState(GameData, 'X', Object.assign({ seed: seed }, opts || {})); }
function catTurns(s) {
  var out = [];
  GameData.ERAS.forEach(function (e, ei) { e.turns.forEach(function (_, ti) {
    var b = Engine.turnBase(GameData, s, ei, ti); if (b.catastrophe && !b.catastrophe.regional) out.push(ei + ':' + ti + ':' + b.catastrophe.name);
  }); });
  return out.join('|');
}

group('kod świata: ten sam kod — ten sam świat, różne kody — różne światy', function () {
  eq(Engine.normalizeSeed(' ab-12c '), 'AB12C', 'kod jest normalizowany (wielkie litery, bez znaków)');
  ok(/^[A-Z2-9]{6}$/.test(Engine.randomSeed()), 'losowy kod ma 6 znaków');
  function run(seed, plan) {
    var g = withSeed(seed), guard = 0;
    while (g.status === 'playing' && guard++ < 30) {
      (plan || []).forEach(function (id) { var r = Engine.buyTrait(GameData, g, id); if (r.ok) g = r.state; });
      g = Engine.simulateTurn(GameData, g).state;
    }
    return g;
  }
  var a = run('KLASA1'), b = run('KLASA1');
  eq(JSON.stringify(a.history), JSON.stringify(b.history), 'ten sam kod i te same decyzje — identyczna partia (bez podanego rng)');
  var c = run('KLASA1', ['eyes', 'scales', 'jaws']);
  function envs(g) { return g.history.slice(0, 5).map(function (r) { return r.envTitle; }).join('|'); }
  eq(envs(a), envs(c), 'świat (tury, katastrofy) nie zależy od decyzji gracza');
  var differ = 0;
  for (var k = 0; k < 12; k++) if (catTurns(withSeed('S' + k)) !== catTurns(withSeed('S0'))) differ++;
  ok(differ > 0, 'różne kody przesuwają wymierania (' + differ + ' z 12 różnych kalendarzy)');
});

group('kalendarz: wymierania w swoim oknie, katastrofa regionalna i zapowiedź', function () {
  var positions = {};
  for (var k = 0; k < 30; k++) {
    var s = withSeed('W' + k);
    GameData.ERAS[0].turns.forEach(function (_, ti) {
      var b = Engine.turnBase(GameData, s, 0, ti);
      if (b.catastrophe && /ordowick/.test(b.catastrophe.name)) positions[ti] = 1;
    });
  }
  eq(Object.keys(positions).sort().join(','), '1,2', 'wymieranie ordowickie trafia w turę 2 albo 3 (okno)');
  var fixedPerm = true;
  for (var j = 0; j < 20; j++) if (!/permsk/.test((Engine.turnBase(GameData, withSeed('P' + j), 0, 7).catastrophe || {}).name || '')) fixedPerm = false;
  ok(fixedPerm, 'wymieranie permskie zostaje na końcu paleozoiku (bez okna)');

  // Katastrofy regionalne: zapowiedziane z wyprzedzeniem i wymierzone w najliczniejszą niszę.
  var s0 = withSeed('REG1'), regs = s0.calendar.regional[0], reg = regs[0];
  ok(regs.length === GameData.REGIONAL.perEra && regs.every(function (x) { return x.turn >= 1; }),
    'każda era ma ' + GameData.REGIONAL.perEra + ' katastrofy regionalne w losowych turach');
  ok(regs.length < 2 || Math.abs(regs[0].turn - regs[1].turn) > 1, 'katastrofy regionalne nie następują tura po turze');
  var g = s0, announced = null, guard = 0, LA = GameData.THREAT.lookahead;
  while (g.status === 'playing' && g.eraIndex === 0 && guard++ < 10) {
    var th = Engine.upcomingThreat(GameData, g);
    if (th && th.regional) { announced = { at: g.turn, threat: th }; break; }
    g = Engine.simulateTurn(GameData, g, noMut).state;
  }
  var target = announced && regs.filter(function (x) { return x.turn > announced.at; })[0];
  ok(announced && target && target.turn - announced.at === announced.threat.turnsAhead && announced.threat.turnsAhead <= LA,
    'katastrofa regionalna zapowiedziana z wyprzedzeniem (do ' + LA + ' tur)');
  ok(announced && announced.threat.severity && announced.threat.severity[announced.threat.niche === 'all' ? 'woda' : announced.threat.niche][1] > 0,
    'zapowiedź podaje przewidywaną siłę w niszach');
  var d = GameData.REGIONAL_DISASTERS.filter(function (x) { return x.name === announced.threat.name; })[0];
  ok(d.niche === 'woda' || d.niche === 'all', 'uderza w niszę, w której żyje gatunek (woda) albo we wszystkie');
  var hid = null;
  for (var q = 0; q < 80 && !hid; q++) {
    var cand = withSeed('HID' + q);
    if (cand.calendar.regional[0].every(function (x) { return x.turn > GameData.THREAT.lookahead; })) hid = cand;
  }
  var tl = Engine.eraTimeline(GameData, hid);
  ok(!tl.some(function (x) { return x.catastrophe && x.catastrophe.regional; }), 'oś czasu nie zdradza katastrofy regionalnej przed zapowiedzią');
  ok(tl.some(function (x) { return x.maybe; }), 'oś czasu pokazuje możliwe tury przesuwanego wymierania');
  ok(tl[7].catastrophe && /permsk/.test(tl[7].catastrophe.name), 'stałe wymierania historyczne są widoczne');
});

group('cele ery: losowane, nagradzane EP, przepadają z końcem ery', function () {
  var s = withSeed('CEL1');
  eq(s.eraGoals.length, GameData.ERA_GOALS_PER_ERA * GameData.ERAS.length, 'po ' + GameData.ERA_GOALS_PER_ERA + ' cele na erę');
  ok(s.eraGoals.every(function (g) { var d = Engine.goalDef(GameData, g.id); return d.eras.indexOf(g.era) !== -1; }), 'cele pasują do swoich er');
  // Wymuszony cel „liczna populacja”.
  s.eraGoals = [{ era: 0, id: 'abundance', status: 'open' }, { era: 0, id: 'two_lines', status: 'open' }];
  active(s).population = 400;
  var r = Engine.simulateTurn(GameData, s, noMut);
  var done = r.report.goals.filter(function (g) { return g.id === 'abundance' && g.status === 'done'; });
  ok(done.length === 1, 'cel spełniony w trakcie ery zalicza się od razu');
  ok(r.state.ep - s.ep >= Engine.goalDef(GameData, 'abundance').reward, 'nagroda EP trafia do puli');
  var g = r.state;
  while (g.eraIndex === 0 && g.status === 'playing') g = Engine.simulateTurn(GameData, g, noMut).state;
  eq(g.eraGoals.filter(function (x) { return x.id === 'two_lines'; })[0].status, 'failed', 'cel „na koniec ery” bez spełnienia przepada');
});

group('dwie drogi do rozumu: narzędzia na lądzie, kultura akustyczna w wodzie', function () {
  var s = withSeed('DROGA'), l = active(s);
  l.stats.intelligence = 99; l.population = 200; l.traits.push('vocal_culture');
  eq(Engine.hasWon(s, GameData), true, 'kultura akustyczna w wodzie wygrywa');
  l.niche = 'lad';
  eq(Engine.hasWon(s, GameData), false, 'kultura akustyczna na lądzie nie działa');
  ok(Engine.cultureNicheBlocked(s, GameData).length === 1, 'UI wie, że kultura jest w złej niszy');
  l.niche = 'przybrzeze';
  eq(Engine.hasWon(s, GameData), false, 'przybrzeże to etap przejściowy — kultura akustyczna potrzebuje otwartej wody');
  l.traits.push('tool_use');
  eq(Engine.hasWon(s, GameData), false, '…a narzędzia potrzebują lądu');
  l.niche = 'lad';
  eq(Engine.hasWon(s, GameData), true, 'narzędzia na lądzie wygrywają');
  var vc = byId('vocal_culture');
  ok(vc.requires.indexOf('echolocation') !== -1 && vc.minEra === 2, 'kultura akustyczna wymaga echolokacji i kenozoiku');
  ok(Bots.winRate('clade', { difficulty: 'normalny', pref: 'mix' }, 40) > 0, 'gra nadal wygrywalna');
});

group('ocena szans: „tej partii nie da się wygrać” bez fałszywych alarmów', function () {
  var s = withSeed('SZANS');
  ok(Engine.victoryOutlook(GameData, s).possible, 'na starcie zwycięstwo jest możliwe');
  var late = withSeed('SZANS'); late.eraIndex = 2; late.turn = 5; active(late).population = 8;
  var o = Engine.victoryOutlook(GameData, late);
  ok(!o.possible && o.reasons.length > 0, 'garstka osobników w ostatniej turze — zwycięstwo niemożliwe, z powodem');
  var poor = withSeed('SZANS'); poor.eraIndex = 2; poor.turn = 4; poor.ep = 0;
  ok(!Engine.victoryOutlook(GameData, poor).possible, 'brak mózgu i punktów tuż przed końcem — niemożliwe');
  // Brak fałszywych alarmów: w wygranych partiach ocena nigdy nie mówiła „niemożliwe”.
  var falseAlarms = 0, wins = 0, early = 0;
  ['latwy', 'normalny', 'trudny'].forEach(function (diff) {
    for (var k = 1; k <= 40; k++) {
      var rng = Bots.seededRng(k), g = Engine.createInitialState(GameData, 'B', { seed: 'OUT' + k, difficulty: diff }), flagged = false, guard = 0;
      var kinds = ['tactics1'];
      while (g.status === 'playing' && guard++ < 30) {
        if (!Engine.victoryOutlook(GameData, g).possible) flagged = true;
        g = Bots.stepFor('tactics1', g);
        g = Engine.simulateTurn(GameData, g, rng).state;
      }
      if (g.status === 'won') { wins++; if (flagged) falseAlarms++; }
      else if (flagged) early++;
    }
  });
  eq(falseAlarms, 0, 'żadna z ' + wins + ' wygranych partii nie była wcześniej uznana za przegraną');
  var c = Engine.concede(GameData, withSeed('KONIEC'));
  eq(c.status, 'survived', 'zakończenie partii z żywotną linią = przetrwanie');
  ok(c.conceded, 'zakończenie oznaczone jako decyzja gracza');
});

group('ocena mechanik: poprawione błędy i nowe reguły', function () {
  // Strategia r kosztuje 1 ⚡ — bez rezerw linia rozmnaża się zwyczajnie.
  var s = Engine.createInitialState(GameData, 'X'); active(s).reserves = 0;
  var bal = Engine.forecastWithTactics(GameData, s, active(s), { strategy: 'zrownowazona' });
  var r0 = Engine.forecastWithTactics(GameData, s, active(s), { strategy: 'r' });
  eq(r0.births, bal.births, 'strategia r bez rezerw nie daje darmowej premii');
  ok(r0.strategyBlocked, 'prognoza ostrzega o braku rezerw na strategię r');
  active(s).reserves = 6;
  ok(Engine.forecastWithTactics(GameData, s, active(s), { strategy: 'r' }).births > bal.births, 'z rezerwami strategia r działa');

  // Podział linii dzieli też zapasy energii.
  var sp = Engine.createInitialState(GameData, 'X'); active(sp).population = 200; active(sp).variation = 30; active(sp).reserves = 10;
  sp = Engine.speciate(GameData, sp, 'B').state;
  eq(Math.round((Engine.getLineage(sp, 'L0').reserves + Engine.getLineage(sp, 'L1').reserves) * 10) / 10, 10, 'rezerwy dzielą się między linie, nie podwajają');

  // Zwycięstwo kladu: linia rozumna ≥ WIN_LINE_MIN, cały gatunek ≥ WIN_MIN_POP.
  var w = Engine.createInitialState(GameData, 'X', { seed: 'KLAD01' }), wl = active(w);
  wl.stats.intelligence = 99; wl.traits.push('vocal_culture'); wl.population = GameData.WIN_LINE_MIN;
  eq(Engine.hasWon(w, GameData), false, 'mała linia rozumna w małym gatunku to jeszcze nie zwycięstwo');
  w.lineages.push(JSON.parse(JSON.stringify(wl))); w.lineages[1].id = 'L1'; w.lineages[1].traits = []; w.lineages[1].niche = 'przybrzeze';
  w.lineages[1].population = GameData.WIN_MIN_POP;
  eq(Engine.hasWon(w, GameData), true, 'liczy się cały klad — gałąź w innej niszy pomaga');
  wl.population = GameData.WIN_LINE_MIN - 1;
  eq(Engine.hasWon(w, GameData), false, 'ale sama linia rozumna musi być żywotna');

  // Ewolucja równoległa: gałąź zdobywa cechę taniej.
  var p = Engine.createInitialState(GameData, 'X'); active(p).population = 200; active(p).variation = 30; p.ep = 200;
  p = Engine.buyTrait(GameData, p, 'eyes').state; p = Engine.speciate(GameData, p, 'B').state;
  var eyes = byId('ganglia');
  p = Engine.setActiveLineage(p, 'L0'); p = Engine.buyTrait(GameData, p, 'ganglia').state; p = Engine.setActiveLineage(p, 'L1');
  eq(Engine.traitCost(GameData, p, eyes), Math.round(eyes.cost * (1 - GameData.PARALLEL_DISCOUNT)), 'cecha linii pokrewnej jest tańsza');
  var ep0 = p.ep, bought = Engine.buyTrait(GameData, p, 'ganglia');
  eq(ep0 - bought.state.ep, Engine.traitCost(GameData, p, eyes), 'płaci się cenę po zniżce');
  ok(bought.state.unlockedKnowledge.indexOf('parallel') !== -1, 'karta wiedzy o ewolucji równoległej');

  // Wykluczające się cechy: filtrowanie albo szczęki.
  var x = Engine.createInitialState(GameData, 'X'); x.ep = 100;
  x = Engine.buyTrait(GameData, x, 'filter_feeding').state;
  eq(Engine.traitStatus(x, byId('jaws'), GameData), 'excluded', 'szczęki wykluczone po filtrowaniu');
  ok(!Engine.buyTrait(GameData, x, 'jaws').ok, 'nie da się kupić wykluczonej cechy');

  // Prognoza z przedziałem.
  var f = Engine.forecast(GameData, Engine.createInitialState(GameData, 'X'), active(Engine.createInitialState(GameData, 'X')));
  ok(f.projectedLow <= f.projectedPop && f.projectedPop <= f.projectedHigh && f.projectedLow < f.projectedHigh, 'prognoza podaje przedział (' + f.projectedLow + '–' + f.projectedHigh + ')');

  // Koewolucja w każdej niszy osobno.
  var c = Engine.createInitialState(GameData, 'X'); active(c).population = 200; active(c).variation = 30;
  c = Engine.speciate(GameData, c, 'B').state; Engine.getLineage(c, 'L1').reserves = 10;
  c = Engine.migrateLineage(GameData, c, 'L1', 'przybrzeze').state; Engine.getLineage(c, 'L0').stats.defense = 12;
  for (var k = 0; k < 4; k++) c = Engine.simulateTurn(GameData, c, noMut).state;
  ok(c.predatorLevels.woda > 2 && c.predatorLevels.przybrzeze < 0.5, 'pancerna linia w wodzie nie podnosi presji na przybrzeżu (' + c.predatorLevels.woda + ' / ' + c.predatorLevels.przybrzeze + ')');

  // Szeroki zasięg łagodzi katastrofy.
  var cat = GameData.ERAS[0].turns[7].catastrophe, ln = active(Engine.createInitialState(GameData, 'X')), d = GameData.DIFFICULTIES.normalny;
  ok(Engine.catastropheImpact(cat, ln, d, GameData, 3).severity < Engine.catastropheImpact(cat, ln, d, GameData, 1).severity, 'gatunek w 3 niszach traci mniej w wymieraniu');

  // Cel „Przetrwać kataklizm” wymaga, by katastrofa dosięgła gatunku.
  var g = Engine.createInitialState(GameData, 'X', { seed: 'CEL9' });
  g.eraGoals = [{ era: 0, id: 'weather', status: 'open' }];
  g.env = { eraIndex: 0, turn: 0, conditions: Object.assign(JSON.parse(JSON.stringify(Engine.turnBase(GameData, g, 0, 0))),
    { catastrophe: { name: 'Test', niche: 'lad', severity: 0.5, survival: [] } }) };
  var rg = Engine.simulateTurn(GameData, g, noMut);
  eq(rg.state.eraGoals[0].status, 'open', 'katastrofa w innej niszy nie zalicza celu');
});

group('wynik i osiągnięcia', function () {
  var won = withSeed('WYNIK'), l = active(won);
  l.stats.intelligence = 99; l.population = 300; l.traits.push('vocal_culture');
  won.status = 'won'; won.winPath = 'sound'; won.eraIndex = 2; won.turn = 3;
  var ach = Engine.earnedAchievements(GameData, won);
  ok(ach.indexOf('first_win') !== -1 && ach.indexOf('sound_win') !== -1 && ach.indexOf('early_win') !== -1, 'wygrana drogą wodną przed końcem: ' + ach.join(', '));
  ok(GameData.ACHIEVEMENTS.every(function (a) { return a.label && a.desc; }), 'osiągnięcia mają nazwy i opisy');
  var lost = withSeed('WYNIK'); lost.status = 'lost'; active(lost).population = 0; active(lost).alive = false;
  var sw = Engine.scoreGame(GameData, won), sl = Engine.scoreGame(GameData, lost);
  ok(sw.total > sl.total, 'zwycięstwo daje wyższy wynik (' + sw.total + ' > ' + sl.total + ')');
  var hard = JSON.parse(JSON.stringify(won)); hard.difficulty = 'trudny';
  ok(Engine.scoreGame(GameData, hard).total > sw.total, 'trudny poziom mnoży wynik');
});

group('Plan budowy (wygląd): z kodu świata, dziedziczony, tylko dla startu bez zaawansowanych cech', function () {
  var plans = {};
  for (var i = 0; i < 40; i++) plans[withSeed('PLAN' + i).lineages[0].bodyPlan] = 1;
  ok(plans.kregowiec && plans.stawonog && plans.glowonog, 'wszystkie trzy plany zdarzają się w różnych światach: ' + Object.keys(plans).join(', '));
  eq(withSeed('PLAN7').lineages[0].bodyPlan, withSeed('PLAN7').lineages[0].bodyPlan, 'ten sam kod świata → ten sam plan');
  eq(Engine.createInitialState(GameData, 'X').lineages[0].bodyPlan, 'kregowiec', 'świat bez ziarna → kręgowiec');
  var ice = withSeed('PLAN3', { startTraits: ['fins', 'limbs', 'endothermy'] });
  eq(ice.lineages[0].bodyPlan, 'kregowiec', 'start z płetwami/kończynami/stałocieplnością → kręgowiec');
  var seedNon = null;
  for (var k = 0; k < 40 && !seedNon; k++) if (withSeed('PLAN' + k).lineages[0].bodyPlan !== 'kregowiec') seedNon = 'PLAN' + k;
  var s = withSeed(seedNon), root = s.lineages[0];
  root.variation = 99;
  var r = Engine.speciate(GameData, s, 'Gałąź');
  ok(r.ok, 'specjacja się udała');
  eq(r.state.lineages[1].bodyPlan, root.bodyPlan, 'gałąź dziedziczy plan budowy po rodzicu');
});

console.log('\n────────────────────────');
console.log('Zaliczone: ' + passed + ' | Niezaliczone: ' + failed);
process.exit(failed === 0 ? 0 : 1);
