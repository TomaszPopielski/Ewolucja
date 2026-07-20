/*
 * engine.js — silnik symulacji (czysta logika gry).
 *
 * ZALOZENIA.md sekcja 9: logika oddzielona od UI, testowalna, bez DOM.
 * Obsługuje: wiele er, wiele linii rozwojowych (specjacja), nisze ekologiczne
 * z migracją, katastrofy (wymierania masowe) i prognozę „co-jeśli”.
 *
 * Funkcje mutujące zwracają NOWY stan (kopię) — dzięki temu tryb nauczyciela
 * może cofać akcje, a testy są proste.
 */
(function (root, factory) {
  var engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.Engine = engine;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function dedupe(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }

  function traitsById(data) {
    var m = {}; data.TRAITS.forEach(function (t) { m[t.id] = t; }); return m;
  }

  function makeLineage(id, name, parentId, population, stats, traits, niche, bornEra, bornTurn) {
    return {
      id: id, name: name, parentId: parentId,
      population: population, peakPopulation: population,
      stats: clone(stats), traits: traits.slice(), niche: niche || 'woda',
      alive: true, bornEra: bornEra, bornTurn: bornTurn, extinctGlobalTurn: null,
      popHistory: [population]
    };
  }

  // Globalny numer tury (przez wszystkie ery) — do osi drzewa życia.
  function globalTurn(data, eraIndex, turn) {
    var g = 0;
    for (var i = 0; i < eraIndex; i++) g += data.ERAS[i].turns.length;
    return g + turn;
  }
  function totalTurns(data) {
    return data.ERAS.reduce(function (s, e) { return s + e.turns.length; }, 0);
  }

  function createInitialState(data, speciesName) {
    var root = makeLineage('L0', speciesName || 'Prazwierzę', null,
      data.START_POPULATION, data.BASE_STATS, [], 'woda', 0, 0);
    return {
      version: 3,
      eraIndex: 0,
      turn: 0, // tura w obrębie bieżącej ery
      totalTurns: totalTurns(data),
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

  // ---------- Ery / środowisko ----------
  // Bezpieczny dostęp do ery — po zakończeniu gry eraIndex wychodzi poza zakres.
  function currentEra(data, state) {
    var i = Math.min(state.eraIndex, data.ERAS.length - 1);
    return data.ERAS[i];
  }
  function currentTurnEnv(data, state) {
    if (state.eraIndex >= data.ERAS.length) return null;
    var era = data.ERAS[state.eraIndex];
    if (state.turn >= era.turns.length) return null;
    return era.turns[state.turn];
  }
  function isGameFinished(state) {
    return state.eraIndex >= state.__eraCount;
  }

  // ---------- Dostęp do linii ----------
  function getLineage(state, id) {
    for (var i = 0; i < state.lineages.length; i++) if (state.lineages[i].id === id) return state.lineages[i];
    return null;
  }
  function getActiveLineage(state) { return getLineage(state, state.activeLineageId); }
  function aliveLineages(state) { return state.lineages.filter(function (l) { return l.alive; }); }
  function totalPopulation(state) {
    return state.lineages.reduce(function (s, l) { return s + (l.alive ? l.population : 0); }, 0);
  }
  function maxIntelligence(state) {
    var m = 0; state.lineages.forEach(function (l) { if (l.alive && l.stats.intelligence > m) m = l.stats.intelligence; });
    return m;
  }
  function lstat(l, k) { return Math.max(0, l.stats[k]); }

  function setActiveLineage(state, id) {
    var l = getLineage(state, id);
    if (!l || !l.alive) return state;
    var n = clone(state); n.activeLineageId = id; return n;
  }

  // ---------- Nisze / migracja ----------
  function canMigrate(state, lineage, niche) {
    if (!lineage.alive) return { ok: false, error: 'Linia wymarła.' };
    if (lineage.niche === niche) return { ok: false, error: 'Linia już zajmuje tę niszę.' };
    if (niche === 'lad' && lineage.traits.indexOf('limbs') === -1) {
      return { ok: false, error: 'Migracja na ląd wymaga cechy „Kończyny”.' };
    }
    return { ok: true, error: null };
  }
  function migrateLineage(state, lineageId, niche) {
    var l = getLineage(state, lineageId);
    if (!l) return { ok: false, state: state, error: 'Nieznana linia.' };
    var can = canMigrate(state, l, niche);
    if (!can.ok) return { ok: false, state: state, error: can.error };
    var n = clone(state);
    getLineage(n, lineageId).niche = niche;
    return { ok: true, state: n, error: null };
  }

  // ---------- Cechy ----------
  function prerequisitesMet(lineage, trait) {
    for (var i = 0; i < trait.requires.length; i++) if (lineage.traits.indexOf(trait.requires[i]) === -1) return false;
    return true;
  }
  function eraUnlocked(state, trait) {
    return (trait.minEra == null) || (state.eraIndex >= trait.minEra);
  }
  /* Status: 'owned' | 'available' | 'era_locked' | 'locked' | 'too_expensive'. */
  function traitStatus(state, trait) {
    var l = getActiveLineage(state);
    if (!l) return 'locked';
    if (l.traits.indexOf(trait.id) !== -1) return 'owned';
    if (!eraUnlocked(state, trait)) return 'era_locked';
    if (!prerequisitesMet(l, trait)) return 'locked';
    if (state.ep < trait.cost) return 'too_expensive';
    return 'available';
  }

  function buyTrait(data, state, traitId) {
    var trait = traitsById(data)[traitId];
    if (!trait) return { ok: false, state: state, error: 'Nieznana cecha.' };
    var active = getActiveLineage(state);
    if (!active) return { ok: false, state: state, error: 'Brak aktywnej linii.' };
    if (active.traits.indexOf(traitId) !== -1) return { ok: false, state: state, error: 'Cecha już posiadana.' };
    if (!eraUnlocked(state, trait)) return { ok: false, state: state, error: 'Cecha dostępna w późniejszej erze.' };
    if (!prerequisitesMet(active, trait)) return { ok: false, state: state, error: 'Niespełnione warunki wstępne.' };
    if (state.ep < trait.cost) return { ok: false, state: state, error: 'Za mało punktów ewolucji.' };
    var n = clone(state);
    var l = getActiveLineage(n);
    n.ep -= trait.cost;
    l.traits.push(traitId);
    applyEffects(l, trait.effects);
    unlockKnowledgeForTrait(n, trait);
    return { ok: true, state: n, error: null };
  }

  function applyEffects(l, effects) {
    for (var k in effects) if (Object.prototype.hasOwnProperty.call(effects, k)) l.stats[k] = (l.stats[k] || 0) + effects[k];
  }
  function unlockKnowledge(state, key) { if (state.unlockedKnowledge.indexOf(key) === -1) state.unlockedKnowledge.push(key); }
  function unlockKnowledgeForTrait(state, trait) {
    if (trait.category === 'uklad_nerwowy') unlockKnowledge(state, 'intelligence');
    if (trait.id === 'endothermy') unlockKnowledge(state, 'cold');
    if (trait.id === 'limbs' || trait.id === 'amniotic_egg') unlockKnowledge(state, 'land');
  }

  // ---------- Specjacja ----------
  function canSpeciate(data, state) {
    var a = getActiveLineage(state);
    if (!a) return { ok: false, error: 'Brak aktywnej linii.' };
    if (state.ep < data.SPECIATION_COST) return { ok: false, error: 'Za mało EP na specjację (potrzeba ' + data.SPECIATION_COST + ').' };
    if (a.population < data.MIN_SPECIATION_POP) return { ok: false, error: 'Za mała populacja do specjacji (min. ' + data.MIN_SPECIATION_POP + ').' };
    return { ok: true, error: null };
  }
  function speciate(data, state, newName) {
    var check = canSpeciate(data, state);
    if (!check.ok) return { ok: false, state: state, error: check.error };
    var n = clone(state);
    var parent = getActiveLineage(n);
    var childPop = Math.floor(parent.population / 2);
    parent.population -= childPop;
    parent.popHistory[parent.popHistory.length - 1] = parent.population;
    var childId = 'L' + n.nextLineageNum; n.nextLineageNum += 1;
    var child = makeLineage(childId, newName || (parent.name + ' II'), parent.id,
      childPop, parent.stats, parent.traits, parent.niche, n.eraIndex, n.turn);
    n.lineages.push(child);
    n.ep -= data.SPECIATION_COST;
    n.activeLineageId = childId;
    unlockKnowledge(n, 'speciation');
    return { ok: true, state: n, error: null };
  }

  // ---------- Mutacja ----------
  function rollMutation(l, rng) {
    if (rng() > 0.28) return null;
    var keys = ['feeding', 'defense', 'reproduction', 'mobility', 'intelligence'];
    var key = keys[Math.floor(rng() * keys.length)];
    var beneficial = rng() < 0.6;
    var delta = beneficial ? 1 : -1;
    if (l.stats[key] + delta < 0) { delta = 1; beneficial = true; }
    l.stats[key] += delta;
    return { key: key, delta: delta, beneficial: beneficial, knowledge: beneficial ? 'mutation_good' : 'mutation_bad' };
  }

  // ---------- Dynamika (współdzielona przez symulację i prognozę) ----------
  function envForNiche(env, niche) {
    if (niche === 'lad') return { food: env.land.food, predators: env.land.predators };
    return { food: env.food, predators: env.predators };
  }
  function computeDynamics(env, lineage) {
    var e = envForNiche(env, lineage.niche);
    var climateMod = env.climate === 'zimno' ? 0.7 : (env.climate === 'cieplo' ? 1.1 : 1.0);
    if (env.climate === 'zimno' && lineage.traits.indexOf('endothermy') !== -1) climateMod = 1.0;
    var oxygenMod = clamp(1 + (10 - env.oxygen) * 0.04, 0.7, 1.4);
    var foodIntake = lstat(lineage, 'feeding') * (e.food / 10) * climateMod;
    var upkeep = lstat(lineage, 'metabolism') * oxygenMod;
    var energy = foodIntake - upkeep;
    var mobilityShield = lstat(lineage, 'mobility') * 0.4;
    var predationPressure = Math.max(0, e.predators - lstat(lineage, 'defense') - mobilityShield);
    var predationLossRate = clamp(predationPressure * 0.035, 0, 0.45);
    var starvationLossRate = energy < 0 ? clamp(-energy * 0.03, 0, 0.5) : 0;
    var birthRate = energy >= 0 ? clamp(0.03 * lstat(lineage, 'reproduction') * (1 + energy * 0.05), 0, 0.6) : 0;
    return {
      energy: energy, predationPressure: predationPressure,
      predationLossRate: predationLossRate, starvationLossRate: starvationLossRate, birthRate: birthRate
    };
  }

  /* Prognoza dla podglądu „co-jeśli” — bez mutacji i losowości. */
  function forecast(data, state, lineage) {
    var env = currentTurnEnv(data, state);
    if (!env) return null;
    var d = computeDynamics(env, lineage);
    var pop = lineage.population;
    var births = Math.round(pop * d.birthRate);
    var predD = Math.round(pop * d.predationLossRate);
    var starvD = Math.round(pop * d.starvationLossRate);
    var proj = Math.max(0, pop + births - predD - starvD);
    var cat = env.catastrophe && (env.catastrophe.niche === 'all' || env.catastrophe.niche === lineage.niche)
      ? env.catastrophe : null;
    return {
      energy: round1(d.energy), predationPressure: round1(d.predationPressure),
      births: births, predationDeaths: predD, starvationDeaths: starvD,
      projectedPop: proj, delta: proj - pop, catastrophe: cat
    };
  }

  // ---------- Symulacja tury ----------
  function simulateTurn(data, state, rng) {
    rng = rng || Math.random;
    if (state.status !== 'playing') return { state: state, report: null };
    var n = clone(state);
    var era = data.ERAS[n.eraIndex];
    var env = era.turns[n.turn];

    var knowledge = [];
    var lineReports = [];
    var totalEp = 0, anyAlive = false;

    aliveLineages(n).forEach(function (l) {
      var r = simulateLineage(data, n, l, env, rng, knowledge);
      lineReports.push(r);
      totalEp += r.epGain;
      if (l.alive) anyAlive = true;
    });
    if (anyAlive) totalEp += 12;
    n.ep += totalEp;

    if (env.catastrophe) { knowledge.push(env.catastrophe.knowledge || 'extinction'); }
    knowledge.forEach(function (k) { unlockKnowledge(n, k); });

    // Postęp tury/ery.
    var prevEraIndex = n.eraIndex;
    n.turn += 1;
    var eraChanged = false;
    if (n.turn >= era.turns.length) {
      if (n.eraIndex < data.ERAS.length - 1) { n.eraIndex += 1; n.turn = 0; eraChanged = true; unlockKnowledge(n, 'milestone'); }
      else { n.eraIndex = data.ERAS.length; } // gra ukończona (poza ostatnią erą)
    }
    n.__eraCount = data.ERAS.length;
    n.status = evaluateStatus(n, data);

    var report = {
      eraIndex: prevEraIndex, eraName: era.name,
      turnIndex: state.turn, envTitle: env.title, envNote: env.note, climate: env.climate,
      catastrophe: env.catastrophe || null,
      lineReports: lineReports, epGain: totalEp,
      totalPopulation: totalPopulation(n), maxIntelligence: maxIntelligence(n),
      intelligenceGoal: n.intelligenceGoal, eraChanged: eraChanged,
      newEraName: eraChanged ? data.ERAS[n.eraIndex].name : null,
      knowledge: dedupe(knowledge), status: n.status
    };
    n.history.push(report);
    return { state: n, report: report };
  }

  function simulateLineage(data, n, l, env, rng, knowledge) {
    var events = [];
    var mut = rollMutation(l, rng);
    if (mut) {
      events.push((mut.beneficial ? 'Korzystna' : 'Szkodliwa') + ' mutacja: ' +
        statLabel(mut.key) + ' ' + (mut.delta > 0 ? '+1' : '-1') + '.');
      knowledge.push(mut.knowledge);
    }
    var popBefore = l.population;
    var d = computeDynamics(env, l);

    var births = Math.round(popBefore * d.birthRate);
    var predationDeaths = Math.round(popBefore * d.predationLossRate);
    var starvationDeaths = Math.round(popBefore * d.starvationLossRate);
    var pop = popBefore + births - predationDeaths - starvationDeaths;

    // Katastrofa — dodatkowa śmiertelność w dotkniętej niszy.
    var catDeaths = 0;
    if (env.catastrophe && (env.catastrophe.niche === 'all' || env.catastrophe.niche === l.niche)) {
      catDeaths = Math.round(Math.max(0, pop) * env.catastrophe.severity);
      pop -= catDeaths;
      events.push('Katastrofa (' + env.catastrophe.name + ') — ciężkie straty.');
    }

    pop = Math.max(0, Math.round(pop));
    l.population = pop;
    l.popHistory.push(pop);
    if (pop > l.peakPopulation) l.peakPopulation = pop;

    if (d.predationLossRate > 0.15) { events.push('Silna presja drapieżników.'); knowledge.push('predation'); }
    if (d.starvationLossRate > 0) { events.push('Ujemny bilans energetyczny — głód.'); knowledge.push('starvation'); }
    if (env.climate === 'zimno') knowledge.push('cold');
    if (l.niche === 'lad') knowledge.push('niche');

    if (pop <= 0 && l.alive) {
      l.alive = false;
      l.extinctGlobalTurn = globalTurn(data, n.eraIndex, n.turn) + 1;
      events.push('Ta linia wymarła.');
    }

    var growth = pop - popBefore;
    var epGain = 0;
    if (pop > 0) {
      epGain += Math.max(0, Math.floor(growth / 15));
      epGain += Math.floor(pop / 150);
      epGain += Math.floor(lstat(l, 'intelligence') / 2);
      if (l.niche === 'lad') epGain += 2; // premia za zajętą niszę lądową
    }

    return {
      lineageId: l.id, name: l.name, niche: l.niche,
      popBefore: popBefore, popAfter: pop,
      births: births, predationDeaths: predationDeaths, starvationDeaths: starvationDeaths,
      catDeaths: catDeaths, energy: round1(d.energy), intelligence: lstat(l, 'intelligence'),
      epGain: epGain, alive: l.alive, events: events
    };
  }

  function evaluateStatus(n, data) {
    if (totalPopulation(n) <= 0) return 'lost';
    if (maxIntelligence(n) >= n.intelligenceGoal) return 'won';
    if (n.eraIndex >= data.ERAS.length) return 'survived';
    return 'playing';
  }

  function statLabel(k) {
    return ({ feeding: 'odżywianie', defense: 'obrona', reproduction: 'rozród',
      mobility: 'mobilność', metabolism: 'metabolizm', intelligence: 'inteligencja' })[k] || k;
  }

  return {
    createInitialState: createInitialState,
    currentEra: currentEra, currentTurnEnv: currentTurnEnv, globalTurn: globalTurn, totalTurns: totalTurns,
    getLineage: getLineage, getActiveLineage: getActiveLineage, aliveLineages: aliveLineages,
    totalPopulation: totalPopulation, maxIntelligence: maxIntelligence,
    setActiveLineage: setActiveLineage,
    canMigrate: canMigrate, migrateLineage: migrateLineage,
    traitStatus: traitStatus, prerequisitesMet: prerequisitesMet, eraUnlocked: eraUnlocked,
    buyTrait: buyTrait, canSpeciate: canSpeciate, speciate: speciate,
    forecast: forecast, simulateTurn: simulateTurn, evaluateStatus: evaluateStatus, statLabel: statLabel,
    _internals: { rollMutation: rollMutation, clamp: clamp, computeDynamics: computeDynamics }
  };
});
