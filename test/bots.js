/*
 * test/bots.js — gracze-boty do testów balansu (ZALOZENIA 11: balans EP).
 *
 * - „plan”     — stały plan: kupuje wszystko po kolei, gdy tylko go stać;
 * - „star”     — stały plan: tylko ścieżka do inteligencji (⭐) i jej wymagania;
 * - „adaptive” — gracz, który patrzy na prognozę (jak człowiek): kupuje cechy
 *                ścieżki, gdy nie grożą głodem ani spadkiem populacji poniżej
 *                żywotnej liczebności, a poza tym cechy wyraźnie poprawiające
 *                prognozę lub bilans energii; migruje, gdy inna nisza daje
 *                wyraźnie lepszą prognozę;
 * - „tactics”  — „adaptive” + nowe decyzje: strategia rozrodu i zachowanie w
 *                turze (wg prognozy i wartości ⚡ rezerw), ukierunkowany dobór,
 *                przemyślany wybór na kartach decyzji. „adaptive” zostawia
 *                strategię zrównoważoną i opcje domyślne kart.
 *
 * Losowość z ziarnem (mulberry32), więc wyniki są powtarzalne.
 */
'use strict';

var D = require('../js/data.js');
var E = require('../js/engine.js');

function seededRng(seed) {
  var a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var PLAN = ['eyes', 'scales', 'many_eggs', 'ganglia', 'fins', 'limbs', 'shell', 'jaws',
  'brain', 'endothermy', 'big_brain', 'social', 'grasping_hand', 'tool_use', 'parental_care'];
var STAR = ['ganglia', 'brain', 'scales', 'endothermy', 'big_brain', 'social', 'fins', 'limbs',
  'grasping_hand', 'tool_use'];

function trait(id) { return D.TRAITS.filter(function (t) { return t.id === id; })[0]; }

function buyInOrder(s, plan) {
  var changed = true;
  while (changed) {
    changed = false;
    for (var i = 0; i < plan.length; i++) {
      if (E.getActiveLineage(s).traits.indexOf(plan[i]) !== -1) continue;
      var r = E.buyTrait(D, s, plan[i]);
      if (r.ok) { s = r.state; changed = true; }
    }
  }
  return s;
}

function adaptiveTurn(s) {
  for (var k = 0; k < 10; k++) {
    var a = E.getActiveLineage(s), f = E.forecast(D, s, a);
    if (!f) break;
    var pop = a.population, best = null, bestScore = -Infinity;
    D.TRAITS.forEach(function (t) {
      if (E.traitStatus(s, t) !== 'available') return;
      var w = E.forecastWithTrait(D, s, a, t), score, star = STAR.indexOf(t.id);
      if (star !== -1) {
        // Cecha ścieżki tylko wtedy, gdy nie zagładza linii i nie zbija populacji
        // poniżej żywotnej liczebności potrzebnej do zwycięstwa.
        if (w.energy < 0 || w.projectedPop < Math.max(D.WIN_MIN_POP + 10, pop * 0.9)) return;
        score = 1000 - star;
      } else {
        // Inna cecha — gdy wyraźnie poprawia prognozę lub bilans energii.
        score = w.projectedPop - f.projectedPop + (w.energy - f.energy) * 5 - t.cost * 0.1;
        if (score <= 2) return;
      }
      if (score > bestScore) { bestScore = score; best = t; }
    });
    if (!best) break;
    s = E.buyTrait(D, s, best.id).state;
  }
  var l = E.getActiveLineage(s), fc = E.forecast(D, s, l);
  if (fc) {
    E.availableNiches(D, l).forEach(function (niche) {
      if (niche === l.niche) return;
      var m = E.migrateLineage(D, s, l.id, niche);
      if (!m.ok) return;
      var f2 = E.forecast(D, m.state, E.getActiveLineage(m.state));
      if (f2.projectedPop > fc.projectedPop * 1.1) { s = m.state; fc = f2; }
    });
  }
  return s;
}

// Wartość stanu linii dla bota: prognozowana populacja + zapas energii.
function tacticScore(f) { return f.projectedPop + f.reservesAfter * 4; }

function tacticsTurn(s) {
  // Karta decyzji: opcja z najlepszą prognozą linii, której dotyczy (z kolonią).
  if (s.pendingChoice) {
    var pc = s.pendingChoice, ev = E.choiceEvent(D, pc.eventId), best = null, bestScore = -Infinity;
    ev.options.forEach(function (o) {
      var r = E.resolveChoice(D, s, o.id); if (!r.ok) return;
      var l = E.getLineage(r.state, pc.lineageId), f = E.forecast(D, r.state, l);
      var colony = r.state.lineages.length > s.lineages.length ? r.state.lineages[r.state.lineages.length - 1].population : 0;
      var score = tacticScore(f) + colony * 1.5 + l.variation * 3 + (l.stats.defense - E.getLineage(s, pc.lineageId).stats.defense) * 15;
      if (score > bestScore) { bestScore = score; best = r.state; }
    });
    if (best) s = best;
  }
  E.aliveLineages(s).forEach(function (l) {
    var best = null, bestScore = -Infinity;
    Object.keys(D.STRATEGIES).forEach(function (st) {
      Object.keys(D.BEHAVIORS).forEach(function (bh) {
        if (!E.canSetBehavior(D, l, bh).ok) return;
        var f = E.forecastWithTactics(D, s, l, { strategy: st, behavior: bh });
        if (!f) return;
        var score = tacticScore(f);
        if (score > bestScore) { bestScore = score; best = { st: st, bh: bh }; }
      });
    });
    if (best) {
      s = E.setStrategy(D, s, l.id, best.st).state;
      s = E.setBehavior(D, s, l.id, best.bh).state;
    }
    var v = E.getLineage(s, l.id).variation;
    if (v >= 14) s = E.setSelection(D, s, l.id, true).state;
    else if (v < 8) s = E.setSelection(D, s, l.id, false).state;
  });
  return s;
}

function play(kind, init, seed) {
  var rng = seededRng(seed);
  var s = E.createInitialState(D, 'Bot', init || {});
  var guard = 0;
  while (s.status === 'playing' && guard++ < 40) {
    if (kind === 'adaptive') s = adaptiveTurn(s);
    else if (kind === 'tactics') s = tacticsTurn(adaptiveTurn(s));
    else s = buyInOrder(s, kind === 'plan' ? PLAN : STAR);
    s = E.simulateTurn(D, s, rng).state;
  }
  return s;
}

/* Odsetek zwycięstw (0–100) w grach z ziarnami 1..n. */
function winRate(kind, init, n) {
  var won = 0;
  for (var i = 1; i <= n; i++) if (play(kind, init, i).status === 'won') won++;
  return Math.round(100 * won / n);
}

function scenarioInit(id) {
  var sc = D.SCENARIOS.filter(function (x) { return x.id === id; })[0];
  return { difficulty: sc.difficulty, startEra: sc.startEra, startEp: sc.startEp, goal: sc.goal,
    startTraits: sc.startTraits, startNiche: sc.startNiche, scenarioId: sc.id };
}

module.exports = { seededRng: seededRng, play: play, winRate: winRate, scenarioInit: scenarioInit, PLAN: PLAN, STAR: STAR };
