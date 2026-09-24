/*
 * test/engine.test.js — testy silnika symulacji (model 2.0).
 * Uruchom: node test/engine.test.js
 */
'use strict';

var D = require('../js/data.js');
var Engine = require('../js/engine.js');
var bots = require('./bots.js');

var passed = 0, failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.error('  ✗ ' + m); } }
function eq(a, b, m) { ok(a === b, m + ' (oczekiwano ' + b + ', jest ' + a + ')'); }
function group(n, fn) { console.log('\n• ' + n); fn(); }
function active(s) { return Engine.getActiveLineage(s); }
function fresh(opts) { return Engine.createInitialState(D, 'X', Object.assign({ seed: 42 }, opts || {})); }
function withDraft(s, cards) { active(s).draft = cards; return s; }
function envFor(s) { return Engine.currentTurnEnv(D, s); }

group('stan początkowy, trudność, ziarno', function () {
  var s = fresh();
  eq(active(s).name, 'X', 'nazwa linii');
  eq(s.zg, D.DIFFICULTIES.normalny.startZg, 'ZG z domyślnej trudności');
  eq(s.intelligenceGoal, D.DIFFICULTIES.normalny.goal, 'cel z trudności');
  eq(active(s).draft.length, D.GENETICS.draftSize, 'linia startuje z draftem mutacji');
  var e = fresh({ difficulty: 'latwy' });
  ok(e.zg > s.zg && e.intelligenceGoal < s.intelligenceGoal, 'łatwy: więcej ZG i niższy cel');
  eq(JSON.stringify(fresh().envs), JSON.stringify(s.envs), 'to samo ziarno => ten sam świat');
  ok(JSON.stringify(fresh({ seed: 7 }).envs) !== JSON.stringify(s.envs), 'inne ziarno => inny świat');
  eq(Engine.seedFromCode('klasa7b'), Engine.seedFromCode('KLASA7B'), 'kod świata nie zależy od wielkości liter');
  eq(Engine.seedFromCode('1234'), 1234, 'kod liczbowy = ziarno');
  eq(s.envs.length, Engine.totalTurns(D), 'świat ma środowisko dla każdej tury');
});

group('scenariusz: start w innej erze i niszy', function () {
  var s = fresh({ startEra: 2, startTraits: ['fins', 'limbs', 'ganglia'], startNiche: 'lad' });
  eq(s.eraIndex, 2, 'start w kenozoiku');
  eq(active(s).niche, 'lad', 'start na lądzie');
  eq(Engine.geneFreq(active(s), 'ganglia'), 1, 'cechy startowe utrwalone');
  ok(Engine.lineageIntelligence(D, active(s)) > D.BASE_STATS.intelligence, 'efekty cech startowych działają');
});

group('draft mutacji — wybór, koszt, niemutowalność', function () {
  var s = withDraft(fresh(), [{ kind: 'gain', id: 'shell' }, { kind: 'gain', id: 'eyes' }, { kind: 'gain', id: 'small_size' }]);
  s.zg = 20;
  var r = Engine.pickMutation(D, s, 'L0', 0);
  ok(r.ok, 'pierwszy wybór się udaje');
  eq(r.state.zg, 20, 'pierwsza mutacja w turze jest darmowa');
  eq(Engine.geneFreq(active(r.state), 'shell'), D.GENETICS.newMutationFreq, 'mutacja startuje z częstością startową');
  eq(active(r.state).draft.length, 2, 'wybrana karta znika z draftu');
  eq(active(s).genes.length, 0, 'stan wejściowy niezmieniony');
  var r2 = Engine.pickMutation(D, r.state, 'L0', 0);
  eq(r2.state.zg, 20 - D.COSTS.extraPick, 'druga mutacja kosztuje ZG');
  eq(Engine.pickCost(D, active(r2.state)), 2 * D.COSTS.extraPick, 'każda kolejna droższa');
  var poor = withDraft(fresh(), [{ kind: 'gain', id: 'eyes' }, { kind: 'gain', id: 'fins' }]);
  poor.zg = 0; poor = Engine.pickMutation(D, poor, 'L0', 0).state;
  ok(!Engine.pickMutation(D, poor, 'L0', 0).ok, 'brak ZG blokuje dodatkowy wybór');
});

group('wykluczające się cechy', function () {
  var s = withDraft(fresh(), [{ kind: 'gain', id: 'large_size' }, { kind: 'gain', id: 'small_size' }]);
  s.zg = 50;
  s = Engine.pickMutation(D, s, 'L0', 0).state;
  var r = Engine.pickMutation(D, s, 'L0', 0);
  ok(!r.ok && /Wyklucza/.test(r.error), 'miniaturyzacja wyklucza się z gigantyzmem');
});

group('ponowne losowanie draftu', function () {
  var s = fresh(); s.zg = 10;
  var r = Engine.rerollDraft(D, s, 'L0');
  ok(r.ok, 'losowanie się udaje');
  eq(r.state.zg, 10 - D.COSTS.reroll, 'kosztuje ZG');
  eq(JSON.stringify(Engine.rerollDraft(D, s, 'L0').state), JSON.stringify(r.state), 'deterministyczne (odtwarzalne cofanie)');
  s.zg = 0; ok(!Engine.rerollDraft(D, s, 'L0').ok, 'bez ZG nie można losować');
});

group('status cech: warunki wstępne, era, częstość', function () {
  var s = fresh(); var l = active(s);
  var byId = {}; D.TRAITS.forEach(function (t) { byId[t.id] = t; });
  eq(Engine.traitStatus(D, s, l, byId.limbs), 'locked', 'kończyny zablokowane bez płetw');
  l.genes.push({ id: 'fins', f: 0.4 });
  eq(Engine.traitStatus(D, s, l, byId.limbs), 'locked', 'płetwy <50% nie odblokowują kończyn');
  l.genes[0].f = 0.6;
  eq(Engine.traitStatus(D, s, l, byId.limbs), 'possible', 'płetwy ≥50% — kończyny mogą się pojawić');
  eq(Engine.traitStatus(D, s, l, byId.fins), 'present', 'płetwy obecne');
  l.genes.push({ id: 'limbs', f: 1 });
  eq(Engine.traitStatus(D, s, l, byId.grasping_hand), 'era_locked', 'ręka chwytna dopiero w kenozoiku');
  eq(Engine.traitStatus(D, s, l, byId.limbs), 'fixed', 'utrwalona');
  var drafts = 0;
  for (var i = 0; i < 30; i++) {
    Engine._internals.rollDraft(D, s, l, Engine._internals.mulberry(i));
    l.draft.forEach(function (c) { if (c.kind === 'gain' && Engine.traitStatus(D, s, l, byId[c.id]) !== 'possible') drafts++; });
  }
  eq(drafts, 0, 'draft zawiera tylko cechy, które mogą się pojawić');
});

group('nisze — dostęp przez częstość cechy i migracja', function () {
  var s = fresh(); s.zg = 50;
  ok(Engine.availableNiches(D, active(s)).indexOf('lad') === -1, 'ląd niedostępny bez kończyn');
  ok(!Engine.migrateLineage(D, s, 'L0', 'lad').ok, 'migracja na ląd bez kończyn blokowana');
  active(s).genes.push({ id: 'fins', f: 1 }, { id: 'limbs', f: D.GENETICS.nicheAccessAt });
  var m = Engine.migrateLineage(D, s, 'L0', 'lad');
  ok(m.ok, 'forma przejściowa (kończyny u części populacji) może wejść na ląd');
  eq(m.state.zg, 50 - D.COSTS.migrate, 'migracja kosztuje ZG');
  ok(m.state.nichesEver.indexOf('lad') !== -1, 'nisza zapisana jako zajęta');
  ok(!Engine.migrateLineage(D, m.state, 'L0', 'woda').ok, 'jedna migracja linii na turę');
});

group('warunkowe efekty cech (ta sama cecha — zaleta lub obciążenie)', function () {
  var l = { niche: 'woda', genes: [{ id: 'fins', f: 1 }] };
  var inWater = Engine.effectiveStats(D, l, { woda: true }).mobility;
  var onLand = Engine.effectiveStats(D, l, { lad: true }).mobility;
  ok(inWater > D.BASE_STATS.mobility && onLand < D.BASE_STATS.mobility, 'płetwy: + w wodzie, − na lądzie (' + inWater + ' / ' + onLand + ')');
  var half = Engine.effectiveStats(D, { genes: [{ id: 'shell', f: 0.5 }] }, {}).defense;
  eq(half, D.BASE_STATS.defense + 2, 'efekt proporcjonalny do częstości');
});

group('dobór naturalny — kierunek zależy od środowiska', function () {
  var s = fresh(); s.turn = 4; var env = envFor(s); var ctx = Engine.buildContext(D, s, env);
  var sel = Engine._internals.selectionCoefficient;
  var water = { id: 'L0', niche: 'woda', genes: [], population: 100 };
  var land = { id: 'L0', niche: 'lad', genes: [], population: 100 };
  ok(sel(D, water, 'filter_feeding', Engine.nicheEnv(D, env, 'woda'), ctx) > 0, 'filtrowanie korzystne w wodzie');
  ok(sel(D, land, 'filter_feeding', Engine.nicheEnv(D, env, 'lad'), ctx) < 0, 'filtrowanie szkodliwe na lądzie');
  ok(sel(D, land, 'fins', Engine.nicheEnv(D, env, 'lad'), ctx) < 0, 'płetwy szkodliwe na lądzie');
  var lowO2 = { food: 10, predators: 5, oxygen: 6, climate: 'cieplo' };
  var highO2 = { food: 10, predators: 5, oxygen: 13, climate: 'cieplo' };
  ok(sel(D, water, 'lungs', lowO2, ctx) > sel(D, water, 'lungs', highO2, ctx), 'płuca bardziej opłacalne przy niskim tlenie');
  var cold = { food: 10, predators: 5, oxygen: 10, climate: 'zimno' };
  var hot = { food: 10, predators: 5, oxygen: 10, climate: 'cieplo' };
  var endo = { id: 'L0', niche: 'woda', genes: [{ id: 'scales', f: 1 }, { id: 'endothermy', f: 1 }], population: 100 };
  ok(sel(D, endo, 'insulation', cold, ctx) > 0 && sel(D, endo, 'insulation', hot, ctx) < sel(D, endo, 'insulation', cold, ctx),
    'izolacja: korzystna w zimnie, gorsza w upale');
  var cat = { kind: 'impakt', niches: 'all', severity: 0.6 };
  ok(sel(D, water, 'small_size', hot, ctx, cat) > sel(D, water, 'small_size', hot, ctx), 'katastrofa silnie selekcjonuje odporne cechy');
});

group('częstość cechy zmienia się w kolejnych turach', function () {
  var s = fresh();
  active(s).genes.push({ id: 'filter_feeding', f: 0.3 }, { id: 'fins', f: 0.3 });
  active(s).niche = 'woda';
  var s2 = s; for (var i = 0; i < 3; i++) s2 = Engine.simulateTurn(D, s2).state;
  ok(Engine.geneFreq(active(s2), 'filter_feeding') > 0.5, 'korzystna cecha rozprzestrzenia się (' + Engine.geneFreq(active(s2), 'filter_feeding').toFixed(2) + ')');
  var t = fresh(); t.turn = 3; active(t).genes.push({ id: 'filter_feeding', f: 0.3 }, { id: 'fins', f: 1 }, { id: 'limbs', f: 0.3 });
  t.zg = 20; t = Engine.migrateLineage(D, t, 'L0', 'lad').state;
  for (var j = 0; j < 4; j++) t = Engine.simulateTurn(D, t).state;
  ok(Engine.geneFreq(active(t), 'filter_feeding') < 0.3, 'szkodliwa cecha zanika na lądzie (' + Engine.geneFreq(active(t), 'filter_feeding').toFixed(2) + ')');
  ok(Engine.geneFreq(active(t), 'limbs') > 0.6, 'kończyny rozprzestrzeniają się na lądzie');
});

group('mutacja utraty cechy', function () {
  var s = fresh(); s.zg = 20; s.turn = 3;
  active(s).genes.push({ id: 'fins', f: 1 }, { id: 'limbs', f: 0.3 });
  s = Engine.migrateLineage(D, s, 'L0', 'lad').state;
  var l = active(s), found = false;
  for (var i = 0; i < 40 && !found; i++) {
    Engine._internals.rollDraft(D, s, l, Engine._internals.mulberry(i));
    found = l.draft.some(function (c) { return c.kind === 'loss' && c.id === 'fins'; });
  }
  ok(found, 'na lądzie może pojawić się mutacja utraty płetw');
  l.draft = [{ kind: 'loss', id: 'fins' }];
  var r = Engine.pickMutation(D, s, 'L0', 0);
  eq(Engine.geneFreq(active(r.state), 'fins'), D.GENETICS.lossMutationFreq, 'utrata obniża częstość utrwalonej cechy');
});

group('konkurencja i pojemność środowiska', function () {
  var s = fresh(); s.zg = 50; active(s).population = 400;
  var solo = Engine.forecast(D, s, active(s));
  var split = Engine.speciate(D, s, 'B').state; // ta sama nisza
  var a = Engine.forecast(D, split, Engine.getLineage(split, 'L0'));
  ok(a.food < solo.food, 'własna linia w tej samej niszy zabiera pokarm (' + a.food + ' < ' + solo.food + ')');
  var away = Engine.speciate(D, s, 'B', 'przybrzeze').state;
  var b = Engine.forecast(D, away, Engine.getLineage(away, 'L0'));
  ok(b.food > a.food, 'rozejście się do innej niszy zmniejsza konkurencję');
  var big = fresh(); active(big).population = 5000;
  var f = Engine.forecast(D, big, active(big));
  ok(f.delta < 0 && f.crowdDeaths > 0, 'populacja ponad pojemnością maleje (tłok)');
});

group('katastrofy, odporność i radiacja adaptacyjna', function () {
  var base = fresh(); base.eraIndex = 1; base.turn = 5; // K–Pg
  var small = JSON.parse(JSON.stringify(base)); active(small).genes.push({ id: 'small_size', f: 1 });
  var large = JSON.parse(JSON.stringify(base)); active(large).genes.push({ id: 'large_size', f: 1 });
  var fs = Engine.forecast(D, small, active(small)), fl = Engine.forecast(D, large, active(large));
  ok(fs.catDeaths < fl.catDeaths, 'małe zwierzęta lepiej znoszą impakt (' + fs.catDeaths + ' < ' + fl.catDeaths + ')');
  var rivalBefore = base.rivals.woda;
  var out = Engine.simulateTurn(D, base);
  ok(out.state.rivals.woda < rivalBefore, 'katastrofa osłabia konkurentów');
  ok(out.report.radiation.length > 0, 'raport zgłasza szansę radiacji');
  var hard = fresh({ difficulty: 'trudny' }); hard.eraIndex = 1; hard.turn = 5;
  ok(Engine.forecast(D, hard, active(hard)).catDeaths >= Engine.forecast(D, base, active(base)).catDeaths, 'trudny: katastrofa nie słabsza');
});

group('minimalna populacja żywotna', function () {
  var s = fresh(); active(s).population = D.MIN_VIABLE_POP + 1; s.eraIndex = 0; s.turn = 7; // Perm
  var out = Engine.simulateTurn(D, s);
  eq(out.state.status, 'lost', 'zbyt mała populacja po katastrofie wymiera');
});

group('symulacja — odtwarzalność i raport', function () {
  var s = fresh();
  var a = Engine.simulateTurn(D, s), b = Engine.simulateTurn(D, s);
  eq(JSON.stringify(a.state), JSON.stringify(b.state), 'ta sama tura z tego samego stanu => ten sam wynik');
  var lr = a.report.lineReports[0];
  ok(lr.geneChanges && typeof lr.popAfter === 'number', 'raport zawiera zmiany częstości i populację');
  var z = a.report.zgBreakdown;
  eq(z.base + z.population + z.niches + z.objectives, a.report.zgGain, 'składniki ZG sumują się');
  ok(a.state.turn === 1 && active(a.state).draft.length > 0, 'nowa tura = nowy draft');
});

group('cele ery i quiz', function () {
  var s = fresh(); s.zg = 50;
  active(s).genes.push({ id: 'fins', f: 1 }, { id: 'limbs', f: 0.3 });
  s = Engine.migrateLineage(D, s, 'L0', 'lad').state;
  var zg0 = s.zg;
  var out = Engine.simulateTurn(D, s);
  ok(out.state.objectivesDone.indexOf('p_land') !== -1, 'cel „ląd” zaliczony');
  ok(out.report.zgBreakdown.objectives >= 8 && out.state.zg > zg0, 'nagroda za cel w ZG');
  var q = fresh(); q.turn = 7; q = Engine.simulateTurn(D, q).state;
  eq(q.quizPending, 'paleozoik', 'po erze pojawia się quiz');
  var zgBefore = q.zg;
  var ans = Engine.answerQuiz(D, q, D.QUIZZES.paleozoik.correct);
  ok(ans.correct && ans.state.zg === zgBefore + D.QUIZZES.paleozoik.reward && !ans.state.quizPending, 'poprawna odpowiedź daje ZG');
  var wrong = Engine.answerQuiz(D, q, (D.QUIZZES.paleozoik.correct + 1) % 3);
  ok(!wrong.correct && wrong.state.zg === zgBefore, 'błędna odpowiedź bez nagrody');
});

group('status i wynik punktowy', function () {
  var s = fresh(); active(s).population = 0;
  eq(Engine.evaluateStatus(D, s), 'lost', 'populacja 0 => lost');
  var w = fresh(); active(w).genes = ['ganglia', 'brain', 'big_brain', 'social', 'language', 'parental_care'].map(function (id) { return { id: id, f: 1 }; });
  eq(Engine.evaluateStatus(D, w), 'won', 'próg inteligencji => won');
  var sc = Engine.computeScore(D, w);
  ok(sc.total > 0 && sc.parts.intelligence > 0, 'wynik liczony z części');
  var half = fresh(); active(half).genes = [{ id: 'big_brain', f: 0.5 }];
  eq(Engine.lineageIntelligence(D, active(half)), D.BASE_STATS.intelligence + 2, 'inteligencja ważona częstością');
});

group('balans — boty na wielu losowych światach', function () {
  var N = 40;
  function rate(style, init) {
    var w = 0, lost = 0;
    for (var seed = 1; seed <= N; seed++) {
      var s = bots.playGame(D, { seed: seed, style: style, init: init });
      if (s.status === 'won') w++; if (s.status === 'lost') lost++;
    }
    return { win: w / N, lost: lost / N };
  }
  var smart = rate('smart', {}), greedy = rate('greedy', {}), random = rate('random', {});
  ok(smart.win >= 0.4, 'świadoma strategia często wygrywa (' + Math.round(smart.win * 100) + '%)');
  ok(smart.win < 0.95, 'ale nie zawsze — świat bywa nieprzychylny (' + Math.round(smart.win * 100) + '%)');
  ok(greedy.win < smart.win, 'samo podążanie za doborem nie wystarcza (' + Math.round(greedy.win * 100) + '%)');
  ok(random.win <= 0.1, 'losowe decyzje prawie nigdy nie wygrywają (' + Math.round(random.win * 100) + '%)');
  var easy = rate('smart', { difficulty: 'latwy' }), hard = rate('smart', { difficulty: 'trudny' });
  ok(easy.win >= smart.win && smart.win >= hard.win, 'trudność monotoniczna (' +
    Math.round(easy.win * 100) + '% ≥ ' + Math.round(smart.win * 100) + '% ≥ ' + Math.round(hard.win * 100) + '%)');
  ok(rate('random', { difficulty: 'trudny' }).lost > 0, 'na trudnym złe decyzje prowadzą do wymarcia');
});

console.log('\n────────────────────────');
console.log('Zaliczone: ' + passed + ' | Niezaliczone: ' + failed);
process.exit(failed === 0 ? 0 : 1);
