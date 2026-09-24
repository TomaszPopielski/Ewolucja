/*
 * test/bots.js — boty do testów balansu (używane przez engine.test.js i balance.js).
 */
'use strict';
var Engine = require('../js/engine.js');

function traitById(D, id) { return D.TRAITS.filter(function (t) { return t.id === id; })[0]; }

// Ocena karty mutacji przez bota.
function cardScore(D, s, l, card, style, rng) {
  if (style === 'random') return rng();
  var sel = Engine.predictSelection(D, s, l, card.id);
  if (card.kind === 'loss') return -sel * 1.2;
  var t = traitById(D, card.id);
  var v = sel;
  if (style === 'smart') {
    if (t.path === 'intelligence') v += 0.35;
    if (t.id === 'endothermy' || t.id === 'limbs' || t.id === 'lungs') v += 0.2;
    if (t.id === 'fins' && s.eraIndex === 0) v += 0.15;
    if (t.id === 'omnivory' || t.id === 'jaws') v += 0.1;
  }
  return v;
}

// Wartość niszy: prognozowana populacja + część pojemności (miejsce na wzrost).
function nicheValue(f) { return f ? f.projectedPop + 0.25 * f.capacity : -1e9; }
function bestNiche(D, s, l) {
  var best = { niche: l.niche, v: nicheValue(Engine.forecast(D, s, l)) };
  Engine.availableNiches(D, l).forEach(function (k) {
    if (k === l.niche) return;
    var c = JSON.parse(JSON.stringify(l)); c.niche = k;
    var v = nicheValue(Engine.forecast(D, s, c));
    if (v > best.v * 1.15 + 10) best = { niche: k, v: v };
  });
  return best.niche;
}

function playGame(D, opts) {
  opts = opts || {};
  var style = opts.style || 'smart';
  var rng = Engine._internals.mulberry((opts.seed || 1) * 7 + 3);
  var s = Engine.createInitialState(D, 'Bot', Object.assign({ seed: opts.seed || 1 }, opts.init || {}));
  var guard = 0;
  while (s.status === 'playing' && guard++ < 40) {
    if (s.quizPending) s = Engine.answerQuiz(D, s, style === 'random' ? 1 : D.QUIZZES[s.quizPending].correct).state;
    Engine.aliveLineages(s).forEach(function (l0) {
      var id = l0.id;
      s = Engine.setActiveLineage(s, id);
      // migracja
      if (style !== 'random' && !opts.noMigrate) {
        var l = Engine.getLineage(s, id);
        var nn = bestNiche(D, s, l);
        if (nn !== l.niche) { var m = Engine.migrateLineage(D, s, id, nn); if (m.ok) s = m.state; }
      }
      // świadomy gracz losuje ponownie, gdy brak kart ścieżki ⭐
      if (style === 'smart') {
        for (var rr0 = 0; rr0 < 2; rr0++) {
          var lx = Engine.getLineage(s, id);
          var hasIntel = lx.draft.some(function (c) { return c.kind === 'gain' && traitById(D, c.id).path === 'intelligence'; });
          if (hasIntel || s.zg < D.COSTS.reroll + 8) break;
          var anyPossible = D.TRAITS.some(function (t) { return t.path === 'intelligence' && Engine.traitStatus(D, s, lx, t) === 'possible'; });
          if (!anyPossible) break;
          s = Engine.rerollDraft(D, s, id).state;
        }
      }
      // wybór mutacji
      for (var pick = 0; pick < 2; pick++) {
        var l2 = Engine.getLineage(s, id);
        if (!l2.draft.length) break;
        if (pick > 0 && (style !== 'smart' || s.zg < D.COSTS.extraPick + 12)) break;
        var bi = 0, bv = -1e9;
        l2.draft.forEach(function (c, i) { var v = cardScore(D, s, l2, c, style, rng); if (v > bv) { bv = v; bi = i; } });
        if (style === 'smart' && bv < -0.05 && s.zg >= D.COSTS.reroll + 4) {
          var rr = Engine.rerollDraft(D, s, id); if (rr.ok) { s = rr.state; pick--; continue; }
        }
        if (pick > 0 && bv < 0.15) break;
        var r = Engine.pickMutation(D, s, id, bi); if (r.ok) s = r.state; else break;
      }
    });
    // specjacja
    if (style === 'smart' && !opts.noSpeciate && Engine.aliveLineages(s).length < 3) {
      var big = Engine.aliveLineages(s).sort(function (a, b) { return b.population - a.population; })[0];
      if (big.population >= 160 && s.zg >= D.COSTS.speciate + 4) {
        s = Engine.setActiveLineage(s, big.id);
        var target = null;
        Engine.availableNiches(D, big).forEach(function (k) {
          if (k !== big.niche && !Engine.aliveLineages(s).some(function (x) { return x.niche === k; }) && !target) target = k;
        });
        var sp = Engine.speciate(D, s, 'Gałąź', target || undefined); if (sp.ok) s = sp.state;
      }
    }
    s = Engine.simulateTurn(D, s).state;
  }
  if (s.quizPending) s = Engine.answerQuiz(D, s, D.QUIZZES[s.quizPending].correct).state;
  return s;
}

module.exports = { playGame: playGame };
