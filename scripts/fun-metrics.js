/*
 * fun-metrics.js — mierniki „miodności” na silniku (docs/MIODNOSC.md, sekcja 1.2).
 *
 * Rozgrywa partie botem z test/bots.js i liczy: tury bez żadnej decyzji do podjęcia
 * (bez karty, wariantów i kontraktu), karty na partię i różnorodność kart w kolejnych
 * partiach, rozkład tury zwycięstwa, podobieństwo kolejnych „bohaterów” (Jaccard cech),
 * zaliczalność kontraktów er i tytuły przetrwania.
 * Użycie: node scripts/fun-metrics.js [liczba_partii] [bot] [poziom]
 */
'use strict';
var D = require('../js/data.js'), E = require('../js/engine.js'), B = require('../test/bots.js');
var N = +process.argv[2] || 100, KIND = process.argv[3] || 'clade', DIFF = process.argv[4] || 'normalny';

function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
function pct(x) { return Math.round(100 * x) + '%'; }
var res = [];
for (var seed = 1; seed <= N; seed++) {
  var rng = B.seededRng(seed), s = E.createInitialState(D, 'Bot', { seed: 'FUN' + seed, difficulty: DIFF });
  s.botPref = seed % 2 ? 'land' : 'sea';
  var g = { turns: 0, noDecision: 0, cards: [], variantsOffered: 0, variantsTaken: 0 };
  while (s.status === 'playing' && g.turns < 40) {
    var offered = !!(s.pendingChoice || (s.pendingVariants && s.pendingVariants.options.length) || E.contractPending(D, s));
    if (!offered) g.noDecision++;
    if (s.pendingChoice) g.cards.push(s.pendingChoice.eventId);
    if (s.pendingVariants) g.variantsOffered++;
    s = B.stepFor(KIND, s);
    if (s.pendingVariants && s.pendingVariants.chosen) g.variantsTaken++;
    s = E.simulateTurn(D, s, rng).state; g.turns++;
  }
  g.status = s.status; g.wonAt = s.status === 'won' ? E.elapsedTurns(D, s) : null;
  var hero = s.lineages.slice().sort(function (a, b) { return b.stats.intelligence - a.stats.intelligence; })[0];
  g.traits = hero.traits.slice().sort();
  g.goals = (s.eraGoals || []).filter(function (x) { return x.contract; });
  g.legacy = E.legacyTitle(D, s);
  res.push(g);
}
var won = res.filter(function (g) { return g.status === 'won'; });
console.log('Bot ' + KIND + ', poziom ' + DIFF + ', ' + N + ' partii');
console.log('wynik: wygrane ' + pct(won.length / N) + ', przetrwanie ' + pct(res.filter(function (g) { return g.status === 'survived'; }).length / N) +
  ', wymarcie ' + pct(res.filter(function (g) { return g.status === 'lost'; }).length / N));
console.log('tury bez żadnej decyzji do podjęcia: ' + pct(avg(res.map(function (g) { return g.noDecision / g.turns; }))));
console.log('karty na partię: ' + avg(res.map(function (g) { return g.cards.length; })).toFixed(1) +
  ', warianty: oferowane w ' + pct(avg(res.map(function (g) { return g.variantsOffered / g.turns; }))) + ' tur, utrwalone ' +
  avg(res.map(function (g) { return g.variantsTaken; })).toFixed(1) + ' na partię');
var seen = {}, curve = [];
res.slice(0, 6).forEach(function (g) { g.cards.forEach(function (c) { seen[c] = 1; }); curve.push(Object.keys(seen).length); });
console.log('różne karty po 1–6 partiach: ' + curve.join(', ') + ' (talia: ' + D.CHOICE_EVENTS.filter(function (e) { return !e.chain; }).length + ' + echa i próby)');
var wt = {}; won.forEach(function (g) { wt[g.wonAt] = (wt[g.wonAt] || 0) + 1; });
console.log('tura zwycięstwa: ' + Object.keys(wt).sort(function (a, b) { return a - b; }).map(function (t) { return t + ': ' + pct(wt[t] / Math.max(1, won.length)); }).join(', '));
var jac = [];
for (var i = 0; i < res.length - 1; i++) {
  var A = res[i].traits, Bb = res[i + 1].traits, inter = A.filter(function (x) { return Bb.indexOf(x) !== -1; }).length;
  jac.push(inter / Math.max(1, A.length + Bb.length - inter));
}
console.log('podobieństwo kolejnych bohaterów (Jaccard cech): ' + avg(jac).toFixed(2));
var goals = [].concat.apply([], res.map(function (g) { return g.goals; })), byId = {};
goals.forEach(function (x) { byId[x.id] = byId[x.id] || [0, 0]; byId[x.id][1]++; if (x.status === 'done') byId[x.id][0]++; });
console.log('kontrakty er wypełnione: ' + pct(goals.filter(function (x) { return x.status === 'done'; }).length / Math.max(1, goals.length)) + ' — ' +
  Object.keys(byId).map(function (k) { return k + ' ' + byId[k][0] + '/' + byId[k][1]; }).join(', '));
var surv = res.filter(function (g) { return g.status === 'survived'; });
console.log('przetrwanie z tytułem: ' + surv.filter(function (g) { return g.legacy; }).length + ' z ' + surv.length);
