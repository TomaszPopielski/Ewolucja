/*
 * engine.js — silnik symulacji (czysta logika gry).
 *
 * Zgodnie z ZALOZENIA.md (sekcja 9): logika jest oddzielona od UI i testowalna
 * niezależnie. Funkcje nie dotykają DOM — operują wyłącznie na obiekcie stanu.
 *
 * Model wielu linii rozwojowych (ZALOZENIA 4.5): gracz może prowadzić kilka
 * linii równolegle i rozdzielać je przez specjację, budując drzewo życia.
 *
 * Konwencja: funkcje modyfikujące stan zwracają NOWY obiekt stanu (kopię),
 * nie mutują wejścia — dzięki temu tryb nauczyciela może cofać tury, a testy
 * są proste.
 */
(function (root, factory) {
  var engine = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = engine;
  } else {
    root.Engine = engine;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function traitsById(data) {
    var map = {};
    for (var i = 0; i < data.TRAITS.length; i++) map[data.TRAITS[i].id] = data.TRAITS[i];
    return map;
  }

  /* Tworzy pojedynczą linię rozwojową (lineage). */
  function makeLineage(id, name, parentId, population, stats, traits, bornTurn) {
    return {
      id: id,
      name: name,
      parentId: parentId,
      population: population,
      peakPopulation: population,
      stats: clone(stats),
      traits: traits.slice(),
      alive: true,
      bornTurn: bornTurn,
      extinctTurn: null,
      popHistory: [population] // liczebność w kolejnych punktach czasu (do wykresu)
    };
  }

  /* Tworzy stan początkowy gry. */
  function createInitialState(data, speciesName) {
    var root = makeLineage('L0', speciesName || 'Prazwierzę', null,
      data.START_POPULATION, data.BASE_STATS, [], 0);
    return {
      version: 2,
      eraId: data.ERA.id,
      turn: 0,
      maxTurns: data.ERA.turns.length,
      ep: data.START_EP,
      intelligenceGoal: data.INTELLIGENCE_GOAL,
      lineages: [root],
      activeLineageId: 'L0',
      nextLineageNum: 1,
      unlockedKnowledge: ['intro'],
      status: 'playing',
      history: []
    };
  }

  // ----------------- Dostęp do linii -----------------
  function getLineage(state, id) {
    for (var i = 0; i < state.lineages.length; i++) {
      if (state.lineages[i].id === id) return state.lineages[i];
    }
    return null;
  }
  function getActiveLineage(state) { return getLineage(state, state.activeLineageId); }
  function aliveLineages(state) {
    return state.lineages.filter(function (l) { return l.alive; });
  }
  function totalPopulation(state) {
    return state.lineages.reduce(function (sum, l) { return sum + (l.alive ? l.population : 0); }, 0);
  }
  function maxIntelligence(state) {
    var m = 0;
    state.lineages.forEach(function (l) {
      if (l.alive && l.stats.intelligence > m) m = l.stats.intelligence;
    });
    return m;
  }

  function lstat(lineage, key) { return Math.max(0, lineage.stats[key]); }

  // ----------------- Wybór aktywnej linii -----------------
  function setActiveLineage(state, id) {
    var l = getLineage(state, id);
    if (!l || !l.alive) return state;
    var next = clone(state);
    next.activeLineageId = id;
    return next;
  }

  // ----------------- Cechy -----------------
  function prerequisitesMet(lineage, trait) {
    for (var i = 0; i < trait.requires.length; i++) {
      if (lineage.traits.indexOf(trait.requires[i]) === -1) return false;
    }
    return true;
  }

  /* Status cechy dla aktywnej linii: 'owned' | 'available' | 'locked' | 'too_expensive'. */
  function traitStatus(state, trait) {
    var lineage = getActiveLineage(state);
    if (!lineage) return 'locked';
    if (lineage.traits.indexOf(trait.id) !== -1) return 'owned';
    if (!prerequisitesMet(lineage, trait)) return 'locked';
    if (state.ep < trait.cost) return 'too_expensive';
    return 'available';
  }

  /* Kupno cechy dla aktywnej linii. Zwraca { ok, state, error }. */
  function buyTrait(data, state, traitId) {
    var byId = traitsById(data);
    var trait = byId[traitId];
    if (!trait) return { ok: false, state: state, error: 'Nieznana cecha.' };
    var active = getActiveLineage(state);
    if (!active) return { ok: false, state: state, error: 'Brak aktywnej linii.' };
    if (active.traits.indexOf(traitId) !== -1) {
      return { ok: false, state: state, error: 'Cecha już posiadana.' };
    }
    if (!prerequisitesMet(active, trait)) {
      return { ok: false, state: state, error: 'Niespełnione warunki wstępne.' };
    }
    if (state.ep < trait.cost) {
      return { ok: false, state: state, error: 'Za mało punktów ewolucji.' };
    }

    var next = clone(state);
    var l = getActiveLineage(next);
    next.ep -= trait.cost;
    l.traits.push(traitId);
    applyEffects(l, trait.effects);
    unlockKnowledgeForTrait(next, trait);
    return { ok: true, state: next, error: null };
  }

  function applyEffects(lineage, effects) {
    for (var key in effects) {
      if (Object.prototype.hasOwnProperty.call(effects, key)) {
        lineage.stats[key] = (lineage.stats[key] || 0) + effects[key];
      }
    }
  }

  function unlockKnowledge(state, key) {
    if (state.unlockedKnowledge.indexOf(key) === -1) state.unlockedKnowledge.push(key);
  }
  function unlockKnowledgeForTrait(state, trait) {
    if (trait.category === 'uklad_nerwowy') unlockKnowledge(state, 'intelligence');
    if (trait.id === 'endothermy') unlockKnowledge(state, 'cold');
    if (trait.id === 'limbs' || trait.id === 'amniotic_egg') unlockKnowledge(state, 'land');
  }

  // ----------------- Specjacja -----------------
  /*
   * Rozdziela aktywną linię na dwie gałęzie (ZALOZENIA 4.5).
   * Populacja dzieli się mniej więcej na pół; nowa linia dziedziczy cechy i
   * statystyki rodzica, a dalej może ewoluować niezależnie.
   * Zwraca { ok, state, error }.
   */
  function canSpeciate(data, state) {
    var active = getActiveLineage(state);
    if (!active) return { ok: false, error: 'Brak aktywnej linii.' };
    if (state.ep < data.SPECIATION_COST) {
      return { ok: false, error: 'Za mało EP na specjację (potrzeba ' + data.SPECIATION_COST + ').' };
    }
    if (active.population < data.MIN_SPECIATION_POP) {
      return { ok: false, error: 'Za mała populacja do specjacji (min. ' + data.MIN_SPECIATION_POP + ').' };
    }
    return { ok: true, error: null };
  }

  function speciate(data, state, newName) {
    var check = canSpeciate(data, state);
    if (!check.ok) return { ok: false, state: state, error: check.error };

    var next = clone(state);
    var parent = getActiveLineage(next);
    var childPop = Math.floor(parent.population / 2);
    parent.population -= childPop;
    parent.popHistory[parent.popHistory.length - 1] = parent.population;

    var childId = 'L' + next.nextLineageNum;
    next.nextLineageNum += 1;
    var child = makeLineage(childId, newName || (parent.name + ' II'),
      parent.id, childPop, parent.stats, parent.traits, next.turn);
    next.lineages.push(child);
    next.ep -= data.SPECIATION_COST;
    next.activeLineageId = childId; // przełącz na nową gałąź
    unlockKnowledge(next, 'speciation');
    return { ok: true, state: next, error: null };
  }

  // ----------------- Mutacja (na poziomie linii) -----------------
  function rollMutation(lineage, rng) {
    var chance = 0.28;
    if (rng() > chance) return null;
    var keys = ['feeding', 'defense', 'reproduction', 'mobility', 'intelligence'];
    var key = keys[Math.floor(rng() * keys.length)];
    var beneficial = rng() < 0.6;
    var delta = beneficial ? 1 : -1;
    if (lineage.stats[key] + delta < 0) { delta = 1; beneficial = true; }
    lineage.stats[key] += delta;
    return { key: key, delta: delta, beneficial: beneficial,
      knowledge: beneficial ? 'mutation_good' : 'mutation_bad' };
  }

  // ----------------- Symulacja tury -----------------
  /*
   * Symuluje jedną turę dla WSZYSTKICH żywych linii w tym samym środowisku.
   * Zwraca { state, report }. Nie mutuje wejścia.
   */
  function simulateTurn(data, state, rng) {
    rng = rng || Math.random;
    if (state.status !== 'playing') return { state: state, report: null };

    var next = clone(state);
    var turnIndex = next.turn;
    var env = data.ERA.turns[turnIndex];

    var knowledge = [];
    var lineReports = [];
    var totalEp = 0;
    var anyAlive = false;
    var anyEpBase = false;

    aliveLineages(next).forEach(function (lineage) {
      var r = simulateLineage(data, next, lineage, env, rng, knowledge);
      lineReports.push(r);
      totalEp += r.epGain;
      if (lineage.alive) { anyAlive = true; }
    });

    // Za samo przetrwanie tury (co najmniej jedna linia) — jednorazowa premia.
    if (anyAlive) { totalEp += 12; anyEpBase = true; }
    next.ep += totalEp;

    for (var k = 0; k < knowledge.length; k++) unlockKnowledge(next, knowledge[k]);

    next.turn = turnIndex + 1;
    next.status = evaluateStatus(next);

    var report = {
      turnIndex: turnIndex,
      envTitle: env.title,
      envNote: env.note,
      climate: env.climate,
      env: env,
      lineReports: lineReports,
      epGain: totalEp,
      epBase: anyEpBase ? 12 : 0,
      totalPopulation: totalPopulation(next),
      maxIntelligence: maxIntelligence(next),
      intelligenceGoal: next.intelligenceGoal,
      knowledge: dedupe(knowledge),
      status: next.status
    };
    next.history.push(report);
    return { state: next, report: report };
  }

  /* Symulacja jednej linii; mutuje przekazaną linię wewnątrz `next`. */
  function simulateLineage(data, next, lineage, env, rng, knowledge) {
    var events = [];

    var mutation = rollMutation(lineage, rng);
    if (mutation) {
      events.push((mutation.beneficial ? 'Korzystna' : 'Szkodliwa') + ' mutacja: ' +
        statLabel(mutation.key) + ' ' + (mutation.delta > 0 ? '+1' : '-1') + '.');
      knowledge.push(mutation.knowledge);
    }

    var popBefore = lineage.population;

    var climateMod = env.climate === 'zimno' ? 0.7 : (env.climate === 'cieplo' ? 1.1 : 1.0);
    if (env.climate === 'zimno' && lineage.traits.indexOf('endothermy') !== -1) climateMod = 1.0;
    var oxygenMod = clamp(1 + (10 - env.oxygen) * 0.04, 0.7, 1.4);

    var foodIntake = lstat(lineage, 'feeding') * (env.food / 10) * climateMod;
    var upkeep = lstat(lineage, 'metabolism') * oxygenMod;
    var energy = foodIntake - upkeep;

    var landBonus = 0;
    if (env.land && lineage.traits.indexOf('limbs') !== -1) {
      landBonus = 1.5; energy += landBonus; knowledge.push('land');
    }

    var mobilityShield = lstat(lineage, 'mobility') * 0.4;
    var predationPressure = Math.max(0, env.predators - lstat(lineage, 'defense') - mobilityShield);
    var predationLossRate = clamp(predationPressure * 0.035, 0, 0.45);

    var starvationLossRate = energy < 0 ? clamp(-energy * 0.03, 0, 0.5) : 0;

    var birthRate = energy >= 0
      ? clamp(0.03 * lstat(lineage, 'reproduction') * (1 + energy * 0.05), 0, 0.6) : 0;

    var births = Math.round(popBefore * birthRate);
    var predationDeaths = Math.round(popBefore * predationLossRate);
    var starvationDeaths = Math.round(popBefore * starvationLossRate);
    var popAfter = Math.max(0, Math.round(popBefore + births - predationDeaths - starvationDeaths));

    lineage.population = popAfter;
    lineage.popHistory.push(popAfter);
    if (popAfter > lineage.peakPopulation) lineage.peakPopulation = popAfter;

    if (predationLossRate > 0.15) { events.push('Silna presja drapieżników.'); knowledge.push('predation'); }
    if (starvationLossRate > 0) { events.push('Ujemny bilans energetyczny — głód.'); knowledge.push('starvation'); }
    if (env.climate === 'zimno') knowledge.push('cold');
    if (env.land) knowledge.push('land');

    // Wymarcie tej linii.
    if (popAfter <= 0 && lineage.alive) {
      lineage.alive = false;
      lineage.extinctTurn = next.turn + 1;
      events.push('Ta linia wymarła.');
    }

    // EP z tej linii.
    var growth = popAfter - popBefore;
    var epGain = 0;
    if (popAfter > 0) {
      epGain += Math.max(0, Math.floor(growth / 15));
      epGain += Math.floor(popAfter / 150);
      epGain += Math.floor(lstat(lineage, 'intelligence') / 2);
      if (landBonus > 0) epGain += 4;
    }

    return {
      lineageId: lineage.id,
      name: lineage.name,
      popBefore: popBefore,
      popAfter: popAfter,
      births: births,
      predationDeaths: predationDeaths,
      starvationDeaths: starvationDeaths,
      energy: round1(energy),
      intelligence: lstat(lineage, 'intelligence'),
      epGain: epGain,
      alive: lineage.alive,
      events: events
    };
  }

  /* Ocena stanu gry. */
  function evaluateStatus(state) {
    if (totalPopulation(state) <= 0) return 'lost';
    if (maxIntelligence(state) >= state.intelligenceGoal) return 'won';
    if (state.turn >= state.maxTurns) return 'survived';
    return 'playing';
  }

  function statLabel(key) {
    var labels = {
      feeding: 'odżywianie', defense: 'obrona', reproduction: 'rozród',
      mobility: 'mobilność', metabolism: 'metabolizm', intelligence: 'inteligencja'
    };
    return labels[key] || key;
  }
  function round1(v) { return Math.round(v * 10) / 10; }
  function dedupe(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) if (!seen[arr[i]]) { seen[arr[i]] = true; out.push(arr[i]); }
    return out;
  }

  return {
    createInitialState: createInitialState,
    getLineage: getLineage,
    getActiveLineage: getActiveLineage,
    aliveLineages: aliveLineages,
    totalPopulation: totalPopulation,
    maxIntelligence: maxIntelligence,
    setActiveLineage: setActiveLineage,
    traitStatus: traitStatus,
    prerequisitesMet: prerequisitesMet,
    buyTrait: buyTrait,
    canSpeciate: canSpeciate,
    speciate: speciate,
    simulateTurn: simulateTurn,
    evaluateStatus: evaluateStatus,
    statLabel: statLabel,
    _internals: { rollMutation: rollMutation, clamp: clamp }
  };
});
