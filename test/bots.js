/*
 * test/bots.js — gracze-boty do testów balansu (ZALOZENIA 11: balans EP).
 *
 * - „plan”     — stały plan: kupuje wszystko po kolei, gdy tylko go stać;
 * - „star”     — stały plan: tylko ścieżka do inteligencji (⭐) i jej wymagania;
 * - „adaptive” — gracz, który patrzy na prognozę (jak człowiek): kupuje cechy
 *                ścieżki, gdy nie grożą załamaniem populacji, a w przeciwnym razie
 *                cechę, która najbardziej poprawia prognozę; migruje, gdy inna
 *                nisza daje wyraźnie lepszą prognozę.
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
  for (var k = 0; k < 8; k++) {
    var a = E.getActiveLineage(s), f = E.forecast(D, s, a);
    if (!f) break;
    var pop = a.population, bought = false;
    for (var i = 0; i < STAR.length && !bought; i++) {
      var t = trait(STAR[i]);
      if (E.traitStatus(s, t) !== 'available') continue;
      if (E.forecastWithTrait(D, s, a, t).projectedPop >= pop * 0.9) { s = E.buyTrait(D, s, t.id).state; bought = true; }
    }
    if (bought) continue;
    var best = null, bestDelta = f.delta + Math.max(3, pop * 0.05);
    D.TRAITS.forEach(function (t) {
      if (E.traitStatus(s, t) !== 'available') return;
      var d = E.forecastWithTrait(D, s, a, t).delta;
      if (d > bestDelta) { bestDelta = d; best = t; }
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

function play(kind, init, seed) {
  var rng = seededRng(seed);
  var s = E.createInitialState(D, 'Bot', init || {});
  var guard = 0;
  while (s.status === 'playing' && guard++ < 40) {
    if (kind === 'adaptive') s = adaptiveTurn(s);
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
