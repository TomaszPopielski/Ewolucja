/*
 * engine.js — silnik symulacji (czysta logika gry).
 *
 * ZALOZENIA.md sekcja 9: logika oddzielona od UI, testowalna, bez DOM.
 * Obsługuje: poziomy trudności, wiele er, wiele linii (specjacja), cztery nisze
 * z migracją, katastrofy i pozytywne zdarzenia, koewolucję (adaptacyjną presję
 * drapieżników), rozbicie EP i prognozę „co-jeśli”.
 *
 * Funkcje mutujące zwracają NOWY stan (kopię) — tryb nauczyciela cofa akcje.
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
  function traitsById(data) { var m = {}; data.TRAITS.forEach(function (t) { m[t.id] = t; }); return m; }

  function makeLineage(id, name, parentId, population, stats, traits, niche, bornEra, bornTurn) {
    return {
      id: id, name: name, parentId: parentId,
      population: population, peakPopulation: population,
      stats: clone(stats), traits: traits.slice(), niche: niche || 'woda',
      alive: true, bornEra: bornEra, bornTurn: bornTurn, extinctGlobalTurn: null,
      popHistory: [population],
      // Znaczniki wyrównane z popHistory — zasilają wykres populacji (markery
      // katastrof/mutacji/specjacji) bez potrzeby przeliczania historii od zera.
      markers: [parentId ? 'speciation' : null]
    };
  }

  function globalTurn(data, eraIndex, turn) {
    var g = 0; for (var i = 0; i < eraIndex; i++) g += data.ERAS[i].turns.length; return g + turn;
  }
  function totalTurns(data) { return data.ERAS.reduce(function (s, e) { return s + e.turns.length; }, 0); }

  /*
   * opts: { difficulty, startEra, startEp, goal, startTraits, scenarioId }
   */
  function createInitialState(data, speciesName, opts) {
    opts = opts || {};
    var diffKey = opts.difficulty || 'normalny';
    var diff = data.DIFFICULTIES[diffKey] || data.DIFFICULTIES.normalny;
    var ep = opts.startEp != null ? opts.startEp : diff.startEp;
    var goal = opts.goal != null ? opts.goal : diff.goal;
    var startEra = opts.startEra || 0;

    var root = makeLineage('L0', speciesName || 'Prazwierzę', null,
      data.START_POPULATION, data.BASE_STATS, [], 'woda', startEra, 0);

    // Zestaw startowy scenariusza (pomijamy warunki wstępne — to „fory”).
    if (opts.startTraits && opts.startTraits.length) {
      var byId = traitsById(data);
      opts.startTraits.forEach(function (id) {
        var t = byId[id];
        if (t && root.traits.indexOf(id) === -1) { root.traits.push(id); applyEffects(root, t.effects); }
      });
    }

    return {
      version: 5,
      difficulty: diffKey,
      scenario: opts.scenarioId || 'full',
      eraIndex: startEra,
      turn: 0,
      totalTurns: totalTurns(data),
      ep: ep,
      intelligenceGoal: goal,
      predatorLevel: 0,          // koewolucja: adaptacyjna presja drapieżników
      lineages: [root],
      activeLineageId: 'L0',
      nextLineageNum: 1,
      unlockedKnowledge: ['intro'],
      status: 'playing',
      resolvedChoice: null,      // decyzja gracza dla bieżącej tury (zdarzenie z wyborem)
      history: []
    };
  }

  // ---------- Ery / środowisko ----------
  function currentEra(data, state) { return data.ERAS[Math.min(state.eraIndex, data.ERAS.length - 1)]; }
  function currentTurnEnv(data, state) {
    if (state.eraIndex >= data.ERAS.length) return null;
    var era = data.ERAS[state.eraIndex];
    if (state.turn >= era.turns.length) return null;
    return era.turns[state.turn];
  }
  function difficultyOf(data, state) { return data.DIFFICULTIES[state.difficulty] || data.DIFFICULTIES.normalny; }

  // ---------- Dostęp do linii ----------
  function getLineage(state, id) {
    for (var i = 0; i < state.lineages.length; i++) if (state.lineages[i].id === id) return state.lineages[i];
    return null;
  }
  function getActiveLineage(state) { return getLineage(state, state.activeLineageId); }
  function aliveLineages(state) { return state.lineages.filter(function (l) { return l.alive; }); }
  function totalPopulation(state) { return state.lineages.reduce(function (s, l) { return s + (l.alive ? l.population : 0); }, 0); }
  function maxIntelligence(state) {
    var m = 0; state.lineages.forEach(function (l) { if (l.alive && l.stats.intelligence > m) m = l.stats.intelligence; }); return m;
  }
  function maxDefense(state) {
    var m = 0; state.lineages.forEach(function (l) { if (l.alive && l.stats.defense > m) m = l.stats.defense; }); return m;
  }
  function lstat(l, k) { return Math.max(0, l.stats[k]); }

  function setActiveLineage(state, id) {
    var l = getLineage(state, id); if (!l || !l.alive) return state;
    var n = clone(state); n.activeLineageId = id; return n;
  }

  // ---------- Nisze / migracja ----------
  function availableNiches(data, lineage) {
    return Object.keys(data.NICHES).filter(function (k) {
      var req = data.NICHES[k].requires;
      return !req || lineage.traits.indexOf(req) !== -1;
    });
  }
  function canMigrate(data, state, lineage, niche) {
    if (!lineage.alive) return { ok: false, error: 'Linia wymarła.' };
    if (!data.NICHES[niche]) return { ok: false, error: 'Nieznana nisza.' };
    if (lineage.niche === niche) return { ok: false, error: 'Linia już zajmuje tę niszę.' };
    var req = data.NICHES[niche].requires;
    if (req && lineage.traits.indexOf(req) === -1) {
      var tr = traitsById(data)[req];
      return { ok: false, error: 'Wymaga cechy „' + (tr ? tr.name : req) + '”.' };
    }
    return { ok: true, error: null };
  }
  function migrateLineage(data, state, lineageId, niche) {
    var l = getLineage(state, lineageId);
    if (!l) return { ok: false, state: state, error: 'Nieznana linia.' };
    var can = canMigrate(data, state, l, niche);
    if (!can.ok) return { ok: false, state: state, error: can.error };
    var n = clone(state); getLineage(n, lineageId).niche = niche; return { ok: true, state: n, error: null };
  }

  // ---------- Cechy ----------
  function prerequisitesMet(lineage, trait) {
    for (var i = 0; i < trait.requires.length; i++) if (lineage.traits.indexOf(trait.requires[i]) === -1) return false;
    return true;
  }
  function eraUnlocked(state, trait) { return (trait.minEra == null) || (state.eraIndex >= trait.minEra); }
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
    var a = getActiveLineage(state);
    if (!a) return { ok: false, state: state, error: 'Brak aktywnej linii.' };
    if (a.traits.indexOf(traitId) !== -1) return { ok: false, state: state, error: 'Cecha już posiadana.' };
    if (!eraUnlocked(state, trait)) return { ok: false, state: state, error: 'Cecha dostępna w późniejszej erze.' };
    if (!prerequisitesMet(a, trait)) return { ok: false, state: state, error: 'Niespełnione warunki wstępne.' };
    if (state.ep < trait.cost) return { ok: false, state: state, error: 'Za mało punktów ewolucji.' };
    var n = clone(state); var l = getActiveLineage(n);
    n.ep -= trait.cost; l.traits.push(traitId); applyEffects(l, trait.effects); unlockKnowledgeForTrait(n, trait);
    return { ok: true, state: n, error: null };
  }
  function applyEffects(l, effects) {
    for (var k in effects) if (Object.prototype.hasOwnProperty.call(effects, k)) l.stats[k] = (l.stats[k] || 0) + effects[k];
  }
  function unlockKnowledge(state, key) { if (state.unlockedKnowledge.indexOf(key) === -1) state.unlockedKnowledge.push(key); }
  function unlockKnowledgeForTrait(state, trait) {
    if (trait.category === 'uklad_nerwowy') unlockKnowledge(state, 'intelligence');
    if (trait.id === 'endothermy') unlockKnowledge(state, 'cold');
    if (trait.id === 'limbs' || trait.id === 'amniotic_egg' || trait.id === 'flight') unlockKnowledge(state, 'niche');
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
    var n = clone(state); var parent = getActiveLineage(n);
    var childPop = Math.floor(parent.population / 2);
    parent.population -= childPop; parent.popHistory[parent.popHistory.length - 1] = parent.population;
    parent.markers[parent.markers.length - 1] = 'speciation';
    var childId = 'L' + n.nextLineageNum; n.nextLineageNum += 1;
    var child = makeLineage(childId, newName || (parent.name + ' II'), parent.id,
      childPop, parent.stats, parent.traits, parent.niche, n.eraIndex, n.turn);
    n.lineages.push(child); n.ep -= data.SPECIATION_COST; n.activeLineageId = childId;
    unlockKnowledge(n, 'speciation');
    return { ok: true, state: n, error: null };
  }

  // ---------- Zdarzenia z wyborem (decyzje o ryzyku) ----------
  /* Zwraca opis decyzji do podjęcia w bieżącej turze, albo null, gdy jej nie ma
     lub gracz już ją rozstrzygnął. */
  function pendingChoice(data, state) {
    var env = currentTurnEnv(data, state);
    if (!env || !env.choice) return null;
    var gt = globalTurn(data, state.eraIndex, state.turn);
    if (state.resolvedChoice && state.resolvedChoice.turn === gt) return null;
    return env.choice;
  }
  function resolveChoice(data, state, optionId) {
    var env = currentTurnEnv(data, state);
    if (!env || !env.choice) return { ok: false, state: state, error: 'Brak decyzji do podjęcia w tej turze.' };
    var opt = null;
    for (var i = 0; i < env.choice.options.length; i++) if (env.choice.options[i].id === optionId) opt = env.choice.options[i];
    if (!opt) return { ok: false, state: state, error: 'Nieznana opcja.' };
    var n = clone(state);
    n.resolvedChoice = {
      turn: globalTurn(data, n.eraIndex, n.turn), optionId: opt.id, label: opt.label,
      foodBonus: opt.foodBonus || 0, predBonus: opt.predBonus || 0
    };
    return { ok: true, state: n, error: null };
  }
  function defaultChoiceOption(choiceDef) {
    for (var i = 0; i < choiceDef.options.length; i++) if (choiceDef.options[i].default) return choiceDef.options[i];
    return choiceDef.options[0];
  }

  // ---------- Mutacja ----------
  function rollMutation(l, rng) {
    if (rng() > 0.28) return null;
    var keys = ['feeding', 'defense', 'reproduction', 'mobility', 'intelligence'];
    var key = keys[Math.floor(rng() * keys.length)];
    var beneficial = rng() < 0.6; var delta = beneficial ? 1 : -1;
    if (l.stats[key] + delta < 0) { delta = 1; beneficial = true; }
    l.stats[key] += delta;
    return { key: key, delta: delta, beneficial: beneficial, knowledge: beneficial ? 'mutation_good' : 'mutation_bad' };
  }

  // ---------- Dynamika (współdzielona: symulacja + prognoza) ----------
  function envForNiche(data, env, niche) {
    var cfg = data.NICHES[niche] || data.NICHES.woda;
    if (cfg.land) return { food: env.land.food, predators: env.land.predators };
    return { food: env.food * (cfg.foodMult || 1), predators: env.predators * (cfg.predMult || 1) };
  }
  function computeDynamics(data, env, lineage, ctx) {
    ctx = ctx || {};
    var ne = envForNiche(data, env, lineage.niche);
    var food = Math.max(0, ne.food + (ctx.foodBonus || 0));
    var predators = ne.predators + (ctx.predBonus || 0) + (ctx.predatorLevel || 0);
    predators = Math.max(0, predators * (ctx.predMult || 1));

    var climateMod = env.climate === 'zimno' ? 0.7 : (env.climate === 'cieplo' ? 1.1 : 1.0);
    if (env.climate === 'zimno' && lineage.traits.indexOf('endothermy') !== -1) climateMod = 1.0;
    var oxygenMod = clamp(1 + (10 - env.oxygen) * 0.04, 0.7, 1.4);

    var foodIntake = lstat(lineage, 'feeding') * (food / 10) * climateMod;
    var upkeep = lstat(lineage, 'metabolism') * oxygenMod;
    var energy = foodIntake - upkeep;
    var mobilityShield = lstat(lineage, 'mobility') * 0.4;
    var predationPressure = Math.max(0, predators - lstat(lineage, 'defense') - mobilityShield);
    var predationLossRate = clamp(predationPressure * 0.035, 0, 0.45);
    var starvationLossRate = energy < 0 ? clamp(-energy * 0.03, 0, 0.5) : 0;
    var birthRate = energy >= 0 ? clamp(0.03 * lstat(lineage, 'reproduction') * (1 + energy * 0.05), 0, 0.6) : 0;
    return { energy: energy, predationPressure: predationPressure,
      predationLossRate: predationLossRate, starvationLossRate: starvationLossRate, birthRate: birthRate };
  }
  function contextFor(data, state, extra) {
    var diff = difficultyOf(data, state);
    var ctx = { predatorLevel: state.predatorLevel || 0, predMult: diff.predMult };
    if (extra) { ctx.foodBonus = extra.foodBonus || 0; ctx.predBonus = extra.predBonus || 0; }
    return ctx;
  }

  /* Prognoza „co-jeśli” — bez mutacji i zdarzeń, ale z koewolucją i trudnością. */
  function forecast(data, state, lineage) {
    var env = currentTurnEnv(data, state);
    if (!env) return null;
    var d = computeDynamics(data, env, lineage, contextFor(data, state));
    var pop = lineage.population;
    var births = Math.round(pop * d.birthRate);
    var predD = Math.round(pop * d.predationLossRate);
    var starvD = Math.round(pop * d.starvationLossRate);
    var proj = Math.max(0, pop + births - predD - starvD);
    var cat = env.catastrophe && (env.catastrophe.niche === 'all' || env.catastrophe.niche === lineage.niche) ? env.catastrophe : null;
    return { energy: round1(d.energy), predationPressure: round1(d.predationPressure),
      births: births, predationDeaths: predD, starvationDeaths: starvD,
      projectedPop: proj, delta: proj - pop, catastrophe: cat };
  }

  // ---------- Symulacja tury ----------
  function simulateTurn(data, state, rng) {
    rng = rng || Math.random;
    if (state.status !== 'playing') return { state: state, report: null };
    var n = clone(state);
    var era = data.ERAS[n.eraIndex];
    var env = era.turns[n.turn];
    var diff = difficultyOf(data, n);

    var knowledge = [];
    var lineReports = [];
    var totalEp = 0, anyAlive = false;

    // Pozytywne zdarzenie losowe (gdy brak katastrofy).
    var event = null;
    if (!env.catastrophe && rng() < 0.22 && data.POSITIVE_EVENTS.length) {
      event = data.POSITIVE_EVENTS[Math.floor(rng() * data.POSITIVE_EVENTS.length)];
      knowledge.push(event.knowledge || 'events');
    }

    // Zdarzenie z wyborem — użyj decyzji gracza, jeśli podjęta w tej turze;
    // w przeciwnym razie (np. symulacja wsadowa bez UI) zastosuj opcję domyślną.
    var choiceMade = null;
    if (env.choice) {
      var gt = globalTurn(data, n.eraIndex, n.turn);
      var resolved = (state.resolvedChoice && state.resolvedChoice.turn === gt) ? state.resolvedChoice : null;
      var opt = resolved || defaultChoiceOption(env.choice);
      choiceMade = { name: env.choice.name, label: opt.label, foodBonus: opt.foodBonus || 0, predBonus: opt.predBonus || 0 };
      knowledge.push(env.choice.knowledge || 'choice');
    }
    n.resolvedChoice = null;

    var ctxExtra = null;
    if (event || choiceMade) {
      ctxExtra = {
        foodBonus: (event ? (event.foodBonus || 0) : 0) + (choiceMade ? choiceMade.foodBonus : 0),
        predBonus: (event ? (event.predBonus || 0) : 0) + (choiceMade ? choiceMade.predBonus : 0)
      };
    }
    var ctx = contextFor(data, n, ctxExtra);

    aliveLineages(n).forEach(function (l) {
      var r = simulateLineage(data, n, l, env, rng, knowledge, ctx, diff);
      lineReports.push(r); totalEp += r.epGain; if (l.alive) anyAlive = true;
    });
    if (anyAlive) totalEp += 12;
    n.ep += totalEp;

    // Koewolucja: presja drapieżników „dogania” dobrze bronione linie.
    var target = Math.max(0, (maxDefense(n) - data.BASE_STATS.defense) * 0.7) * diff.coevo;
    n.predatorLevel = clamp((n.predatorLevel || 0) + (target - (n.predatorLevel || 0)) * 0.35, 0, 12);
    if (n.predatorLevel > 2) unlockKnowledge(n, 'coevolution');

    if (env.catastrophe) knowledge.push(env.catastrophe.knowledge || 'extinction');
    knowledge.forEach(function (k) { unlockKnowledge(n, k); });

    var prevEraIndex = n.eraIndex;
    n.turn += 1;
    var eraChanged = false;
    if (n.turn >= era.turns.length) {
      if (n.eraIndex < data.ERAS.length - 1) { n.eraIndex += 1; n.turn = 0; eraChanged = true; unlockKnowledge(n, 'milestone'); }
      else n.eraIndex = data.ERAS.length;
    }
    n.status = evaluateStatus(n, data);

    var report = {
      eraIndex: prevEraIndex, eraName: era.name, turnIndex: state.turn,
      envTitle: env.title, envNote: env.note, climate: env.climate,
      catastrophe: env.catastrophe || null,
      event: event ? { name: event.name, desc: event.desc } : null,
      choiceMade: choiceMade,
      lineReports: lineReports, epGain: totalEp, epBase: anyAlive ? 12 : 0,
      predatorLevel: round1(n.predatorLevel),
      totalPopulation: totalPopulation(n), maxIntelligence: maxIntelligence(n),
      intelligenceGoal: n.intelligenceGoal, eraChanged: eraChanged,
      newEraName: eraChanged ? data.ERAS[n.eraIndex].name : null,
      knowledge: dedupe(knowledge), status: n.status
    };
    n.history.push(report);
    return { state: n, report: report };
  }

  function simulateLineage(data, n, l, env, rng, knowledge, ctx, diff) {
    var events = [];
    var mut = rollMutation(l, rng);
    if (mut) {
      events.push((mut.beneficial ? 'Korzystna' : 'Szkodliwa') + ' mutacja: ' + statLabel(mut.key) + ' ' + (mut.delta > 0 ? '+1' : '-1') + '.');
      knowledge.push(mut.knowledge);
    }
    var popBefore = l.population;
    var d = computeDynamics(data, env, l, ctx);
    var births = Math.round(popBefore * d.birthRate);
    var predationDeaths = Math.round(popBefore * d.predationLossRate);
    var starvationDeaths = Math.round(popBefore * d.starvationLossRate);
    var pop = popBefore + births - predationDeaths - starvationDeaths;

    var catDeaths = 0;
    if (env.catastrophe && (env.catastrophe.niche === 'all' || env.catastrophe.niche === l.niche)) {
      var sev = clamp(env.catastrophe.severity * diff.catMult, 0, 0.95);
      catDeaths = Math.round(Math.max(0, pop) * sev);
      pop -= catDeaths;
      events.push('Katastrofa (' + env.catastrophe.name + ') — ciężkie straty.');
    }

    pop = Math.max(0, Math.round(pop));
    l.population = pop; l.popHistory.push(pop);
    if (pop > l.peakPopulation) l.peakPopulation = pop;

    // Znacznik tej tury na wykresie populacji — najważniejsze zdarzenie wygrywa.
    var marker = null;
    if (catDeaths > 0) marker = 'catastrophe';
    else if (mut && mut.beneficial) marker = 'mutation_good';
    else if (mut && !mut.beneficial) marker = 'mutation_bad';
    l.markers.push(marker);

    if (d.predationLossRate > 0.15) { events.push('Silna presja drapieżników.'); knowledge.push('predation'); }
    if (d.starvationLossRate > 0) { events.push('Ujemny bilans energetyczny — głód.'); knowledge.push('starvation'); }
    if (env.climate === 'zimno') knowledge.push('cold');
    if (l.niche !== 'woda') knowledge.push('niche');

    if (pop <= 0 && l.alive) {
      l.alive = false; l.extinctGlobalTurn = globalTurn(data, n.eraIndex, n.turn) + 1;
      l.markers[l.markers.length - 1] = 'extinct';
      events.push('Ta linia wymarła.');
    }

    // Rozbicie EP (P1) — czytelne, skąd pochodzą punkty.
    var growth = pop - popBefore;
    var nicheBonus = (pop > 0) ? (data.NICHES[l.niche].epBonus || 0) : 0;
    var bd = {
      growth: pop > 0 ? Math.max(0, Math.floor(growth / 15)) : 0,
      population: pop > 0 ? Math.floor(pop / 150) : 0,
      intelligence: pop > 0 ? Math.floor(lstat(l, 'intelligence') / 2) : 0,
      niche: nicheBonus
    };
    var epGain = bd.growth + bd.population + bd.intelligence + bd.niche;

    return {
      lineageId: l.id, name: l.name, niche: l.niche,
      popBefore: popBefore, popAfter: pop,
      births: births, predationDeaths: predationDeaths, starvationDeaths: starvationDeaths, catDeaths: catDeaths,
      energy: round1(d.energy), intelligence: lstat(l, 'intelligence'),
      epGain: epGain, epBreakdown: bd, alive: l.alive, events: events
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
    difficultyOf: difficultyOf,
    getLineage: getLineage, getActiveLineage: getActiveLineage, aliveLineages: aliveLineages,
    totalPopulation: totalPopulation, maxIntelligence: maxIntelligence, maxDefense: maxDefense,
    setActiveLineage: setActiveLineage,
    availableNiches: availableNiches, canMigrate: canMigrate, migrateLineage: migrateLineage,
    traitStatus: traitStatus, prerequisitesMet: prerequisitesMet, eraUnlocked: eraUnlocked,
    buyTrait: buyTrait, canSpeciate: canSpeciate, speciate: speciate,
    pendingChoice: pendingChoice, resolveChoice: resolveChoice,
    forecast: forecast, simulateTurn: simulateTurn, evaluateStatus: evaluateStatus, statLabel: statLabel,
    _internals: { rollMutation: rollMutation, clamp: clamp, computeDynamics: computeDynamics }
  };
});
