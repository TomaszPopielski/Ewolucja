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
    niche = niche || 'woda';
    return {
      id: id, name: name, parentId: parentId,
      population: population, peakPopulation: population,
      stats: clone(stats), traits: traits.slice(), niche: niche,
      alive: true, bornEra: bornEra, bornTurn: bornTurn, extinctGlobalTurn: null,
      popHistory: [population],
      discoveredNiches: [niche],   // nisze już „odkryte” przez tę linię (jednorazowa premia)
      appliedSynergies: [],        // skompletowane synergie (efekt zastosowany raz)
      deficitStreak: 0,            // ile tur z rzędu ujemny bilans (refugium przeciw spirali)
      acclimatizeTurns: 0          // tury kary aklimatyzacyjnej po migracji
    };
  }

  /* Deterministyczny generator (mulberry32) — powtarzalne partie w trybie nauczyciela. */
  function makeRng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
      applySynergies(data, root); // efekty combo z zestawu startowego
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
      seed: (opts.seed != null ? (opts.seed >>> 0) : null), // opcjonalne ziarno (powtarzalność)
      lineages: [root],
      activeLineageId: 'L0',
      nextLineageNum: 1,
      unlockedKnowledge: ['intro'],
      achievements: [],
      status: 'playing',
      history: []
    };
  }

  /* Ziarno bieżącej tury (deterministyczne strumienie na turę), gdy podano seed. */
  function rngForTurn(state) {
    if (state.seed == null) return Math.random;
    return makeRng((state.seed >>> 0) + state.eraIndex * 101 + state.turn * 7 + 1);
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
  // Id żywej linii o najwyższej inteligencji (pierwsza przy remisie) — do premii EP.
  function bestIntelligenceLineageId(state) {
    var best = null, bv = -Infinity;
    state.lineages.forEach(function (l) { if (l.alive && l.stats.intelligence > bv) { bv = l.stats.intelligence; best = l.id; } });
    return best;
  }
  // Sprawdza osiągnięcia; dopisuje nowo zdobyte do state.achievements i je zwraca.
  function checkAchievements(data, state) {
    if (!state.achievements) state.achievements = [];
    var ctx = { state: state, data: data,
      engine: { aliveLineages: aliveLineages, maxIntelligence: maxIntelligence,
        totalPopulation: totalPopulation, maxDefense: maxDefense } };
    var fresh = [];
    (data.ACHIEVEMENTS || []).forEach(function (a) {
      if (state.achievements.indexOf(a.id) !== -1) return;
      var ok = false; try { ok = a.test(ctx); } catch (e) { ok = false; }
      if (ok) { state.achievements.push(a.id); fresh.push(a.id); }
    });
    return fresh;
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
    var n = clone(state); var m = getLineage(n, lineageId);
    m.niche = niche;
    m.acclimatizeTurns = 1; // koszt/ryzyko migracji: jedna tura obniżonego rozrodu i ochrony
    return { ok: true, state: n, error: null };
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
    var newSyn = applySynergies(data, l);
    if (newSyn.length) unlockKnowledge(n, 'synergy');
    return { ok: true, state: n, error: null, synergies: newSyn };
  }
  function applyEffects(l, effects) {
    for (var k in effects) if (Object.prototype.hasOwnProperty.call(effects, k)) l.stats[k] = (l.stats[k] || 0) + effects[k];
  }
  /* Sprawdza i stosuje jednorazowo efekty synergii, gdy linia ma komplet cech pary. */
  function applySynergies(data, l) {
    var applied = [];
    if (!l.appliedSynergies) l.appliedSynergies = [];
    (data.SYNERGIES || []).forEach(function (syn) {
      if (l.appliedSynergies.indexOf(syn.id) !== -1) return;
      var has = syn.traits.every(function (t) { return l.traits.indexOf(t) !== -1; });
      if (has) { applyEffects(l, syn.effects); l.appliedSynergies.push(syn.id); applied.push(syn); }
    });
    return applied;
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
    var childId = 'L' + n.nextLineageNum; n.nextLineageNum += 1;
    var child = makeLineage(childId, newName || (parent.name + ' II'), parent.id,
      childPop, parent.stats, parent.traits, parent.niche, n.eraIndex, n.turn);
    // Dziecko dziedziczy „pamięć” rodzica — nie farmi ponownie premii odkrycia/synergii.
    child.discoveredNiches = (parent.discoveredNiches || [parent.niche]).slice();
    child.appliedSynergies = (parent.appliedSynergies || []).slice();
    n.lineages.push(child); n.ep -= data.SPECIATION_COST; n.activeLineageId = childId;
    unlockKnowledge(n, 'speciation');
    return { ok: true, state: n, error: null };
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

    // Migracja to koszt: przez turę aklimatyzacji słabszy rozród i mniejsza osłona ruchem.
    var acclim = (lineage.acclimatizeTurns && lineage.acclimatizeTurns > 0);

    var foodIntake = lstat(lineage, 'feeding') * (food / 10) * climateMod;
    var upkeep = lstat(lineage, 'metabolism') * oxygenMod;
    var energy = foodIntake - upkeep;
    var mobilityShield = lstat(lineage, 'mobility') * (acclim ? 0.25 : 0.4);
    var predationPressure = Math.max(0, predators - lstat(lineage, 'defense') - mobilityShield);
    var predationLossRate = clamp(predationPressure * 0.035, 0, 0.45);
    var starvationLossRate = energy < 0 ? clamp(-energy * 0.03, 0, 0.5) : 0;
    var birthRate = energy >= 0 ? clamp(0.03 * lstat(lineage, 'reproduction') * (1 + energy * 0.05), 0, 0.6) : 0;
    if (acclim) birthRate *= 0.5;
    return { energy: energy, predationPressure: predationPressure,
      predationLossRate: predationLossRate, starvationLossRate: starvationLossRate, birthRate: birthRate, acclim: acclim };
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
    var ctxExtra = event ? { foodBonus: event.foodBonus || 0, predBonus: event.predBonus || 0 } : null;
    var ctx = contextFor(data, n, ctxExtra);
    // EP z inteligencji liczymy tylko z NAJLEPSZEJ linii — specjacja rozkłada ryzyko,
    // a nie mnoży dochodu (dziecko dziedziczy tę samą inteligencję co rodzic).
    ctx.bestIntId = bestIntelligenceLineageId(n);

    aliveLineages(n).forEach(function (l) {
      var r = simulateLineage(data, n, l, env, rng, knowledge, ctx, diff);
      lineReports.push(r); totalEp += r.epGain; if (l.alive) anyAlive = true;
    });
    if (anyAlive) totalEp += 12;

    // Premia za DYWERSYFIKACJĘ: gdy katastrofa niszowa nie zgładza gatunku, bo linie
    // były rozproszone po różnych niszach (nagradzamy rozłożenie ryzyka, nie ucieczkę).
    var diversifyBonus = 0;
    n._survivedCatastrophe = false;
    if (env.catastrophe) {
      var aliveNow = aliveLineages(n);
      var niches = {}; aliveNow.forEach(function (l) { niches[l.niche] = 1; });
      if (aliveNow.length >= 2) n._survivedCatastrophe = true;
      if (env.catastrophe.niche !== 'all' && aliveNow.length >= 1 && Object.keys(niches).length >= 2) {
        diversifyBonus = 8; totalEp += diversifyBonus; knowledge.push('diversify');
      }
    }
    n.ep += totalEp;

    // Koewolucja: presja drapieżników „dogania” dobrze bronione linie.
    var target = Math.max(0, (maxDefense(n) - data.BASE_STATS.defense) * 0.7) * diff.coevo;
    n.predatorLevel = clamp((n.predatorLevel || 0) + (target - (n.predatorLevel || 0)) * 0.35, 0, 12);
    if (n.predatorLevel > 2) unlockKnowledge(n, 'coevolution');

    if (env.catastrophe) knowledge.push(env.catastrophe.knowledge || 'extinction');
    knowledge.forEach(function (k) { unlockKnowledge(n, k); });

    // Osiągnięcia (cele opcjonalne) — sprawdzane co turę, dopisywane raz.
    var newAchievements = checkAchievements(data, n);

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
      lineReports: lineReports, epGain: totalEp, epBase: anyAlive ? 12 : 0,
      diversifyBonus: diversifyBonus,
      predatorLevel: round1(n.predatorLevel),
      totalPopulation: totalPopulation(n), maxIntelligence: maxIntelligence(n),
      intelligenceGoal: n.intelligenceGoal, eraChanged: eraChanged,
      newEraName: eraChanged ? data.ERAS[n.eraIndex].name : null,
      completedEraName: era.name,
      newAchievements: newAchievements,
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
    if (l.acclimatizeTurns && l.acclimatizeTurns > 0) events.push('Aklimatyzacja po migracji — chwilowo słabszy rozród i ochrona.');
    var popBefore = l.population;
    var d = computeDynamics(data, env, l, ctx);
    var births = Math.round(popBefore * d.birthRate);
    var predationDeaths = Math.round(popBefore * d.predationLossRate);
    var starvationDeaths = Math.round(popBefore * d.starvationLossRate);

    // Refugium: pojedyncze załamanie głodowe nie zabija małej populacji od razu —
    // daje turę na korektę (obniż metabolizm, zmień niszę). Utrzymujący się deficyt już tak.
    l.deficitStreak = (d.starvationLossRate > 0) ? ((l.deficitStreak || 0) + 1) : 0;
    var pop = popBefore + births - predationDeaths - starvationDeaths;
    var FLOOR = 15;
    if (d.starvationLossRate > 0 && l.deficitStreak < 2 && pop < FLOOR && popBefore > 0) {
      var rescued = Math.min(starvationDeaths, FLOOR - Math.max(0, pop));
      if (rescued > 0) {
        starvationDeaths -= rescued; pop += rescued;
        events.push('Refugium: mała populacja przetrwała kryzys głodowy — masz turę na korektę.');
        knowledge.push('torpor');
      }
    }

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

    if (d.predationLossRate > 0.15) { events.push('Silna presja drapieżników.'); knowledge.push('predation'); }
    if (d.starvationLossRate > 0) { events.push('Ujemny bilans energetyczny — głód.'); knowledge.push('starvation'); }
    if (env.climate === 'zimno') knowledge.push('cold');
    if (l.niche !== 'woda') knowledge.push('niche');

    if (pop <= 0 && l.alive) {
      l.alive = false; l.extinctGlobalTurn = globalTurn(data, n.eraIndex, n.turn) + 1;
      events.push('Ta linia wymarła.');
    }

    // Jednorazowa premia za odkrycie niszy (pierwsze wejście tej linii) — nagroda za
    // ekspansję zamiast co-turowego dochodu z „parkowania” w niszy premiowej.
    var discovery = 0;
    var nicheCfg = data.NICHES[l.niche];
    if (pop > 0 && nicheCfg && nicheCfg.discoveryBonus && l.discoveredNiches.indexOf(l.niche) === -1) {
      discovery = nicheCfg.discoveryBonus;
      l.discoveredNiches.push(l.niche);
      events.push('Odkrycie niszy: ' + nicheCfg.label + ' — jednorazowa premia +' + discovery + ' EP.');
    }

    // EP z inteligencji tylko dla najlepszej linii (anty-farmienie przez specjację).
    var isBestInt = (ctx && ctx.bestIntId) ? (l.id === ctx.bestIntId) : true;

    // Rozbicie EP — czytelne, skąd pochodzą punkty.
    var growth = pop - popBefore;
    var bd = {
      growth: pop > 0 ? Math.max(0, Math.floor(growth / 15)) : 0,
      population: pop > 0 ? Math.floor(pop / 150) : 0,
      intelligence: (pop > 0 && isBestInt) ? Math.floor(lstat(l, 'intelligence') / 2) : 0,
      niche: discovery
    };
    var epGain = bd.growth + bd.population + bd.intelligence + bd.niche;

    // Koniec obsługi migracji: zużywamy jedną turę kary aklimatyzacyjnej.
    if (l.acclimatizeTurns && l.acclimatizeTurns > 0) l.acclimatizeTurns -= 1;

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
    createInitialState: createInitialState, makeRng: makeRng, rngForTurn: rngForTurn,
    currentEra: currentEra, currentTurnEnv: currentTurnEnv, globalTurn: globalTurn, totalTurns: totalTurns,
    difficultyOf: difficultyOf,
    getLineage: getLineage, getActiveLineage: getActiveLineage, aliveLineages: aliveLineages,
    totalPopulation: totalPopulation, maxIntelligence: maxIntelligence, maxDefense: maxDefense,
    bestIntelligenceLineageId: bestIntelligenceLineageId,
    setActiveLineage: setActiveLineage,
    availableNiches: availableNiches, canMigrate: canMigrate, migrateLineage: migrateLineage,
    traitStatus: traitStatus, prerequisitesMet: prerequisitesMet, eraUnlocked: eraUnlocked,
    buyTrait: buyTrait, applySynergies: applySynergies, canSpeciate: canSpeciate, speciate: speciate,
    checkAchievements: checkAchievements,
    forecast: forecast, simulateTurn: simulateTurn, evaluateStatus: evaluateStatus, statLabel: statLabel,
    _internals: { rollMutation: rollMutation, clamp: clamp, computeDynamics: computeDynamics }
  };
});
