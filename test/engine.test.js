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
  var rep = Engine.simulateTurn(GameData, s, noMut).report;
  var lr2 = rep.lineReports[0];
  eq(lr2.epBreakdown.growth + lr2.epBreakdown.population + lr2.epBreakdown.niche, lr2.epGain, 'składniki EP linii sumują się do epGain linii');
  eq(lr2.epGain + rep.epBase + rep.epIntel, rep.epGain, 'EP linii + premie globalne = EP tury');
});

group('evaluateStatus', function () {
  var s = Engine.createInitialState(GameData, 'X'); active(s).population = 0;
  eq(Engine.evaluateStatus(s, GameData), 'lost', 'populacja 0 => lost');
  var s2 = Engine.createInitialState(GameData, 'X'); active(s2).stats.intelligence = s2.intelligenceGoal;
  eq(Engine.evaluateStatus(s2, GameData), 'playing', 'sam próg inteligencji bez narzędzi => gra trwa');
  active(s2).traits.push(GameData.WIN_TRAIT);
  eq(Engine.evaluateStatus(s2, GameData), 'won', 'próg inteligencji + używanie narzędzi => won');
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
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 100;
  var cost = Engine.migrationCost(GameData, active(s));
  var m = Engine.migrateLineage(GameData, s, 'L0', 'przybrzeze');
  ok(m.ok, 'migracja na przybrzeże możliwa');
  eq(m.state.ep, 100 - cost, 'migracja kosztuje EP (' + cost + ')');
  var back = Engine.migrateLineage(GameData, m.state, 'L0', 'woda');
  ok(!back.ok, 'druga migracja w tej samej turze zablokowana: ' + back.error);
  var poor = Engine.createInitialState(GameData, 'X'); poor.ep = 0;
  ok(!Engine.migrateLineage(GameData, poor, 'L0', 'przybrzeze').ok, 'bez EP nie ma migracji');
  var mobile = Engine.createInitialState(GameData, 'X', { startTraits: ['fins', 'lateral_line'] });
  ok(Engine.migrationCost(GameData, active(mobile)) < cost, 'wyższa mobilność = tańsza migracja');
  // Aklimatyzacja: w turze migracji mniej energii niż bez niej.
  var fAfter = Engine.forecast(GameData, m.state, active(m.state));
  var noAcc = JSON.parse(JSON.stringify(m.state)); active(noAcc).migratedAt = null;
  ok(fAfter.acclimatizing && fAfter.energy < Engine.forecast(GameData, noAcc, active(noAcc)).energy,
    'aklimatyzacja obniża bilans energii w turze migracji');
  var next = Engine.simulateTurn(GameData, m.state, noMut).state;
  ok(Engine.migrateLineage(GameData, next, 'L0', 'woda').ok, 'w kolejnej turze można znów migrować');
  ok(!Engine.forecast(GameData, next, active(next)).acclimatizing, 'aklimatyzacja trwa jedną turę');
});

group('2.2 specjacja nie mnoży punktów ewolucji', function () {
  // Ta sama łączna populacja (1400) w 1 albo 7 liniach.
  function gainWith(extraLines) {
    var s = Engine.createInitialState(GameData, 'X', { startTraits: ['ganglia', 'brain', 'fins', 'scales', 'eyes'] });
    s.ep = 500;
    for (var k = 0; k < extraLines; k++) {
      s.lineages.forEach(function (l) { l.population = 400; });
      s = Engine.speciate(GameData, s, 'x' + k).state;
    }
    s.lineages.forEach(function (l) { l.population = Math.round(1400 / s.lineages.length); });
    return Engine.simulateTurn(GameData, s, det).report.epGain;
  }
  var one = gainWith(0), seven = gainWith(6);
  ok(seven <= one * 1.25, 'ta sama populacja w 7 liniach nie daje wyraźnie więcej EP (' + seven + ' vs ' + one + ')');
  var s = Engine.createInitialState(GameData, 'X'); s.ep = 200; active(s).population = 400;
  var c1 = Engine.speciationCost(GameData, s);
  s = Engine.speciate(GameData, s, 'B').state;
  ok(Engine.speciationCost(GameData, s) > c1, 'koszt specjacji rośnie z liczbą linii (' + c1 + ' → ' + Engine.speciationCost(GameData, s) + ')');
  // Premia za niszę raz na niszę; druga nisza = druga premia.
  var t = Engine.createInitialState(GameData, 'X'); t.ep = 200; active(t).population = 400;
  t = Engine.speciate(GameData, t, 'B').state;
  var same = Engine.simulateTurn(GameData, t, det).report.lineReports;
  eq(same[0].epBreakdown.niche + same[1].epBreakdown.niche, GameData.NICHES.woda.epBonus, 'dwie linie w wodzie: jedna premia za niszę');
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

group('2.3 balans — stały plan nie wygrywa zawsze, adaptacja popłaca', function () {
  var N = 100, n = { difficulty: 'normalny' };
  var plan = Bots.winRate('plan', n, N), star = Bots.winRate('star', n, N), adapt = Bots.winRate('adaptive', n, N);
  ok(plan < 80, 'normalny: „kup wszystko” nie wygrywa zawsze (' + plan + '%)');
  ok(star < 80, 'normalny: sama ścieżka ⭐ nie wygrywa zawsze (' + star + '%)');
  ok(adapt >= 35, 'normalny: gracz korzystający z prognozy wygrywa często (' + adapt + '%)');
  ok(adapt > Math.max(plan, star), 'normalny: adaptacja lepsza niż stały plan (' + adapt + '% > ' + Math.max(plan, star) + '%)');
  var easy = Bots.winRate('adaptive', { difficulty: 'latwy' }, N), hard = Bots.winRate('adaptive', { difficulty: 'trudny' }, N);
  ok(easy > adapt && adapt > hard, 'trudność rośnie: łatwy ' + easy + '% > normalny ' + adapt + '% > trudny ' + hard + '%');
  ok(hard > 0, 'trudny jest wygrywalny (' + hard + '%)');
  var ice = Bots.winRate('star', Bots.scenarioInit('ice'), N);
  ok(ice > 0 && ice < 80, 'epoki lodowcowe: sprint ścieżką ⭐ to realne wyzwanie (' + ice + '%)');
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
  var ice = GameData.ERAS[2].turns.filter(function (t) { return t.catastrophe && t.catastrophe.niche === 'lad'; })[0];
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

console.log('\n────────────────────────');
console.log('Zaliczone: ' + passed + ' | Niezaliczone: ' + failed);
process.exit(failed === 0 ? 0 : 1);
