/*
 * advisor.js — „szansa na rozum”: szacunek z symulacji reszty partii.
 *
 * Z bieżącego stanu rozgrywa kilkanaście–kilkadziesiąt partii do końca prostym,
 * ostrożnym graczem (kupuje drogę do rozumu, gdy nie grozi głodem, przenosi linię
 * tam, gdzie działa jej kultura) i liczy, jaki odsetek kończy się zwycięstwem.
 * Każda symulacja ma inny „przyszły świat” (kod świata z przyrostkiem): warunki tur,
 * karty i katastrofy regionalne się różnią, a kalendarz wielkich wymierań zostaje —
 * szacunek nie zdradza więc przyszłości, którą zna tylko silnik.
 *
 * Czysta logika bez DOM (działa w przeglądarce i w Node). UI liczy szacunek
 * kawałkami (`step`), żeby nie blokować strony.
 */
(function (root, factory) {
  var advisor = factory();
  if (typeof module === 'object' && module.exports) module.exports = advisor;
  else root.Advisor = advisor;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function rngFrom(seed) {
    var a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Droga do rozumu dla linii: w otwartej wodzie bez kończyn — dźwięk, poza tym narzędzia.
  var TOOLS = ['ganglia', 'brain', 'scales', 'endothermy', 'big_brain', 'social', 'fins', 'limbs', 'grasping_hand', 'tool_use', 'many_eggs', 'parental_care'];
  var SOUND = ['ganglia', 'brain', 'scales', 'endothermy', 'big_brain', 'social', 'echolocation', 'vocal_culture', 'many_eggs', 'parental_care'];
  function pathFor(D, E, s, l) {
    var ids = E.winPaths(D, s).map(function (p) { return p.id; });
    if (ids.indexOf('sound') === -1) return TOOLS;
    if (ids.indexOf('tools') === -1) return SOUND;
    if (l.traits.indexOf('limbs') !== -1 || l.niche === 'lad') return TOOLS;
    if (l.traits.indexOf('echolocation') !== -1 || l.niche === 'woda') return SOUND;
    return TOOLS;
  }

  // Ocena linii: prognoza + zapas energii (przy małej populacji liczą się osobniki).
  function tacticScore(f) { return f.projectedPop + f.reservesAfter * Math.min(4, f.projectedPop / 15); }
  function lineValue(D, E, before, st, id) {
    var l = E.getLineage(st, id), b = E.getLineage(before, id);
    if (!l || !l.alive) return -1e6;
    var f = E.forecast(D, st, l); if (!f) return 0;
    var colony = st.lineages.length > before.lineages.length ? st.lineages[st.lineages.length - 1].population : 0;
    var perm = (l.stats.defense - b.stats.defense + l.stats.feeding - b.stats.feeding + l.stats.reproduction - b.stats.reproduction -
      (l.stats.metabolism - b.stats.metabolism)) * 15;
    return tacticScore(f) + colony * 1.5 + (l.variation || 0) * 3 + perm + (st.ep - before.ep) * 2;
  }
  var CONTRACT_PREF = ['fat', 'weather', 'armor', 'smart', 'fed', 'variation', 'abundance', 'two_lines', 'land', 'radiation', 'sky'];
  /* Decyzje taktyczne: kontrakt, wariant, karta (opcja o najlepszej ocenie; ryzyko — średnio
     z sukcesu i porażki przez wynik prognozy po opcji), strategia i zachowanie. */
  function tacticsTurn(D, E, s) {
    var cp = E.contractPending && E.contractPending(D, s);
    if (cp) {
      var pick = cp.options.slice().sort(function (a, b) { return CONTRACT_PREF.indexOf(a) - CONTRACT_PREF.indexOf(b); })[0];
      var c = E.chooseContract(D, s, pick); if (c.ok) s = c.state;
    }
    var pv = s.pendingVariants;
    if (pv && !pv.chosen && E.promoteVariant) {
      var l0 = E.getLineage(s, pv.lineageId), bestV = null, bestVS = l0 ? lineValue(D, E, s, s, pv.lineageId) + 4 : Infinity;
      if (l0) pv.options.forEach(function (id) {
        var r = E.promoteVariant(D, s, id); if (!r.ok) return;
        var v = E.variantDef(D, id), sc = lineValue(D, E, s, r.state, pv.lineageId) +
          (v.effects.intelligence || 0) * (l0.stats.intelligence < s.intelligenceGoal ? 45 : 0);
        if (sc > bestVS) { bestVS = sc; bestV = r.state; }
      });
      if (bestV) s = bestV;
    }
    if (s.pendingChoice) {
      var pc = s.pendingChoice, ev = E.choiceEvent(D, pc.eventId), best = null, bestScore = -Infinity;
      if (ev) ev.options.forEach(function (o) {
        var r = E.resolveChoice(D, s, o.id); if (!r.ok) return;
        var sc = lineValue(D, E, s, r.state, pc.lineageId);
        if (o.gamble) {
          var p = E.gambleChance(D, E.getLineage(r.state, pc.lineageId), o.gamble, r.state);
          var lose = o.gamble.lose && o.gamble.lose.effects && o.gamble.lose.effects.popLoss ? o.gamble.lose.effects.popLoss : 0;
          sc -= (1 - p) * lose * 300;
        }
        if (sc > bestScore) { bestScore = sc; best = r.state; }
      });
      if (best) s = best;
    }
    E.aliveLineages(s).forEach(function (l) {
      var bt = null, bs = -Infinity;
      Object.keys(D.STRATEGIES).forEach(function (st) {
        Object.keys(D.BEHAVIORS).forEach(function (bh) {
          if (!E.canSetBehavior(D, l, bh).ok) return;
          var f = E.forecastWithTactics(D, s, l, { strategy: st, behavior: bh });
          if (f && tacticScore(f) > bs) { bs = tacticScore(f); bt = { st: st, bh: bh }; }
        });
      });
      if (bt) { s = E.setStrategy(D, s, l.id, bt.st).state; s = E.setBehavior(D, s, l.id, bt.bh).state; }
    });
    return s;
  }

  /* Jedna tura gracza symulowanego: rozsądne cechy (droga do rozumu bez głodu) i taktyka. */
  function policyTurn(D, E, s) {
    s = tacticsTurn(D, E, s);
    for (var k = 0; k < 8; k++) {
      var a = E.getActiveLineage(s), f = E.forecast(D, s, a);
      if (!a || !f) break;
      var pop = a.population, best = null, bestScore = -Infinity, path = pathFor(D, E, s, a);
      var sprint = s.eraIndex >= D.ERAS.length - 1;
      D.TRAITS.forEach(function (t) {
        if (E.traitStatus(s, t, D) !== 'available') return;
        var w = E.forecastWithTrait(D, s, a, t), score, star = path.indexOf(t.id);
        if (star !== -1) {
          var clade = E.totalPopulation(s) - pop + w.projectedPop;
          var okEnergy = sprint ? w.energy >= -6 : w.energy >= 0;
          var okPop = sprint ? w.projectedPop >= (D.WIN_LINE_MIN || 0) + 20 : w.projectedPop >= Math.max((D.WIN_LINE_MIN || 0) + 10, pop * 0.9);
          if (!okEnergy || !okPop || clade < (D.WIN_MIN_POP || 0) + (sprint ? 20 : 10)) return;
          score = 1000 - star;
        } else {
          score = w.projectedPop - f.projectedPop + (w.energy - f.energy) * 5 - E.traitCost(D, s, t, a) * 0.1;
          if (score <= 2) return;
        }
        if (score > bestScore) { bestScore = score; best = t; }
      });
      if (!best) break;
      s = E.buyTrait(D, s, best.id).state;
    }
    var l = E.getActiveLineage(s), fc = l && E.forecast(D, s, l);
    if (!fc) return s;
    var blocked = E.cultureNicheBlocked(s, D).filter(function (b) { return b.lineageId === l.id; })[0];
    if (blocked) { var mv = E.migrateLineage(D, s, l.id, blocked.path.niches[0]); if (mv.ok) return mv.state; }
    if (pathFor(D, E, s, l) === TOOLS && l.niche !== 'lad' && l.traits.indexOf('limbs') !== -1) {
      var ml = E.migrateLineage(D, s, l.id, 'lad');
      if (ml.ok) { var fl = E.forecast(D, ml.state, E.getActiveLineage(ml.state)); if (fl.projectedPop >= fc.projectedPop * 0.85 && fl.energy >= -1) return ml.state; }
    }
    return s;
  }

  /* Rozgrywa jedną partię do końca od stanu `state` (kopia), w świecie z przyrostkiem `i`. */
  function rollout(D, E, state, i) {
    var s = JSON.parse(JSON.stringify(state));
    if (s.seed) s.seed = s.seed + '~' + i;
    s.pendingVariants = null;
    var rng = rngFrom(0x5eed + i * 7919), guard = 0;
    while (s.status === 'playing' && guard++ < 40) {
      s = policyTurn(D, E, s);
      s = E.simulateTurn(D, s, rng).state;
    }
    return s.status === 'won';
  }

  /* Szacunek w całości (Node, testy): { chance (0–1), wins, runs }. */
  function estimate(D, E, state, runs) {
    runs = runs || 20;
    if (!state || state.status !== 'playing') return { chance: state && state.status === 'won' ? 1 : 0, wins: 0, runs: 0 };
    var w = 0;
    for (var i = 0; i < runs; i++) if (rollout(D, E, state, i)) w++;
    return { chance: w / runs, wins: w, runs: runs };
  }

  /* Szacunek kawałkami (przeglądarka): `step()` rozgrywa jedną symulację i zwraca
     true, gdy wszystkie są gotowe; `result()` — bieżący wynik. */
  function job(D, E, state, runs) {
    runs = runs || 20;
    var i = 0, w = 0, snap = JSON.parse(JSON.stringify(state));
    return {
      step: function () { if (i < runs) { if (rollout(D, E, snap, i)) w++; i++; } return i >= runs; },
      result: function () { return { chance: i ? w / i : 0, wins: w, runs: i, done: i >= runs }; }
    };
  }

  return { estimate: estimate, job: job, policyTurn: policyTurn, rollout: rollout };
});
