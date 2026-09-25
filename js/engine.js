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
      popHistory: [population]
    };
  }

  function globalTurn(data, eraIndex, turn) {
    var g = 0; for (var i = 0; i < eraIndex; i++) g += data.ERAS[i].turns.length; return g + turn;
  }
  function totalTurns(data) { return data.ERAS.reduce(function (s, e) { return s + e.turns.length; }, 0); }
  // Liczba rozegranych tur (globalnie), przycięta do długości gry — po ostatniej
  // turze eraIndex wychodzi poza listę er, a turn zostaje na długości ostatniej ery.
  function elapsedTurns(data, state) {
    if (state.eraIndex >= data.ERAS.length) return totalTurns(data);
    return globalTurn(data, state.eraIndex, state.turn);
  }
  // Ery rozgrywane w tej grze (od ery startowej scenariusza).
  function playedEras(data, state) { return data.ERAS.slice(state.startEra || 0); }

  /*
   * opts: { difficulty, startEra, startEp, goal, startTraits, startNiche, scenarioId }
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
    // Nisza startowa scenariusza — tylko jeśli linia spełnia jej wymóg.
    if (opts.startNiche && data.NICHES[opts.startNiche]) {
      var nreq = data.NICHES[opts.startNiche].requires;
      if (!nreq || root.traits.indexOf(nreq) !== -1) root.niche = opts.startNiche;
    }

    return {
      version: 4,
      difficulty: diffKey,
      scenario: opts.scenarioId || 'full',
      startEra: startEra,
      eraIndex: startEra,
      turn: 0,
      totalTurns: totalTurns(data),
      ep: ep,
      intelligenceGoal: goal,
      predatorLevel: 0,          // koewolucja: adaptacyjna presja drapieżników
      lineages: [root],
      activeLineageId: 'L0',
      nextLineageNum: 1,
      unlockedKnowledge: root.niche === 'lad' ? ['intro', 'land'] : ['intro'],
      status: 'playing',
      history: []
    };
  }

  // ---------- Ery / środowisko ----------
  function currentEra(data, state) { return data.ERAS[Math.min(state.eraIndex, data.ERAS.length - 1)]; }
  function currentTurnEnv(data, state) {
    if (state.eraIndex >= data.ERAS.length) return null;
    var era = data.ERAS[state.eraIndex];
    if (state.turn >= era.turns.length) return null;
    // Wylosowane warunki bieżącej tury (jeśli dotyczą właśnie tej tury).
    var e = state.env;
    if (e && e.eraIndex === state.eraIndex && e.turn === state.turn) return e.conditions;
    return era.turns[state.turn];
  }

  var CLIMATES = ['zimno', 'umiarkowanie', 'cieplo'];
  /* Faza środowiska: odchylenia od warunków historycznych danej tury. Tura z
     katastrofą zachowuje historyczny klimat. rng()=0.5 daje warunki bazowe. */
  function rollEnv(data, eraIndex, turn, rng) {
    if (eraIndex >= data.ERAS.length || turn >= data.ERAS[eraIndex].turns.length) return null;
    var base = data.ERAS[eraIndex].turns[turn], v = data.ENV_VARIATION;
    var jitter = function (x, amp, lo) { return Math.max(lo, x + Math.round((rng() * 2 - 1) * amp)); };
    var c = clone(base);
    c.food = jitter(base.food, v.food, 1);
    c.predators = jitter(base.predators, v.predators, 0);
    c.oxygen = jitter(base.oxygen, v.oxygen, 5);
    c.land = { food: jitter(base.land.food, v.food, 1), predators: jitter(base.land.predators, v.predators, 0) };
    var shift = rng();
    if (!base.catastrophe && shift < v.climateShift) {
      var i = CLIMATES.indexOf(base.climate);
      var j = clamp(i + (shift < v.climateShift / 2 ? -1 : 1), 0, CLIMATES.length - 1);
      c.climate = CLIMATES[j];
    }
    c.climateShifted = c.climate !== base.climate;
    return { eraIndex: eraIndex, turn: turn, conditions: c };
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
    if (lineage.migratedAt === nowTurn(data, state)) return { ok: false, error: 'Ta linia już migrowała w tej turze.' };
    var cost = migrationCost(data, lineage);
    if (state.ep < cost) return { ok: false, error: 'Za mało EP na migrację (potrzeba ' + cost + ').' };
    return { ok: true, error: null, cost: cost };
  }
  // Migracja kosztuje EP — tym mniej, im mobilniejsza linia (ZALOZENIA 4.1).
  function migrationCost(data, lineage) {
    var m = data.MIGRATION;
    return Math.max(m.minCost, m.baseCost - lstat(lineage, 'mobility'));
  }
  function migrateLineage(data, state, lineageId, niche) {
    var l = getLineage(state, lineageId);
    if (!l) return { ok: false, state: state, error: 'Nieznana linia.' };
    var can = canMigrate(data, state, l, niche);
    if (!can.ok) return { ok: false, state: state, error: can.error };
    var n = clone(state); var nl = getLineage(n, lineageId);
    nl.niche = niche; nl.migratedAt = nowTurn(data, n); n.ep -= can.cost;
    if (niche === 'lad') unlockKnowledge(n, 'land');
    return { ok: true, state: n, error: null };
  }
  // Globalny numer bieżącej (jeszcze nierozegranej) tury.
  function nowTurn(data, state) { return globalTurn(data, state.eraIndex, state.turn); }

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
    if (trait.id === 'limbs') unlockKnowledge(state, 'land');
  }

  // ---------- Specjacja ----------
  // Każda kolejna żywa linia podnosi koszt — utrzymanie wielu linii nie jest darmowe.
  function speciationCost(data, state) {
    return data.SPECIATION_COST + (data.SPECIATION_COST_STEP || 0) * Math.max(0, aliveLineages(state).length - 1);
  }
  function canSpeciate(data, state) {
    var a = getActiveLineage(state);
    if (!a) return { ok: false, error: 'Brak aktywnej linii.' };
    var cost = speciationCost(data, state);
    if (state.ep < cost) return { ok: false, error: 'Za mało EP na specjację (potrzeba ' + cost + ').' };
    if (a.population < data.MIN_SPECIATION_POP) return { ok: false, error: 'Za mała populacja do specjacji (min. ' + data.MIN_SPECIATION_POP + ').' };
    return { ok: true, error: null };
  }
  function speciate(data, state, newName) {
    var check = canSpeciate(data, state);
    if (!check.ok) return { ok: false, state: state, error: check.error };
    var n = clone(state); var parent = getActiveLineage(n); var cost = speciationCost(data, state);
    var childPop = Math.floor(parent.population / 2);
    parent.population -= childPop; parent.popHistory[parent.popHistory.length - 1] = parent.population;
    var childId = 'L' + n.nextLineageNum; n.nextLineageNum += 1;
    var child = makeLineage(childId, newName || (parent.name + ' II'), parent.id,
      childPop, parent.stats, parent.traits, parent.niche, n.eraIndex, n.turn);
    n.lineages.push(child); n.ep -= cost; n.activeLineageId = childId;
    unlockKnowledge(n, 'speciation');
    return { ok: true, state: n, error: null };
  }

  // ---------- Mutacja ----------
  // Inteligencja mutuje tylko u linii z mózgiem — sam przypadek nie prowadzi do
  // rozumności. Korzystna mutacja metabolizmu go obniża (tańsze utrzymanie).
  function rollMutation(l, rng) {
    if (rng() > 0.28) return null;
    var keys = ['feeding', 'defense', 'reproduction', 'mobility', 'metabolism'];
    if (l.traits.indexOf('brain') !== -1) keys.push('intelligence');
    var key = keys[Math.floor(rng() * keys.length)];
    var beneficial = rng() < 0.6;
    var sign = key === 'metabolism' ? -1 : 1;
    var delta = beneficial ? sign : -sign;
    if (l.stats[key] + delta < 0) { delta = -delta; beneficial = !beneficial; }
    l.stats[key] += delta;
    return { key: key, delta: delta, beneficial: beneficial, knowledge: beneficial ? 'mutation_good' : 'mutation_bad' };
  }

  // ---------- Dynamika (współdzielona: symulacja + prognoza) ----------
  function envForNiche(data, env, niche) {
    var cfg = data.NICHES[niche] || data.NICHES.woda;
    if (cfg.land) return { food: env.land.food, predators: env.land.predators };
    return { food: env.food * (cfg.foodMult || 1), predators: env.predators * (cfg.predMult || 1) };
  }
  /*
   * Statystyki efektywne w danych warunkach: bazowe + kompromisy zależne od
   * niszy, tlenu i klimatu (trait.conditions) + kara niszy (NICHES.without).
   * Zwraca { stats, notes } — notes wyjaśniają graczowi, co działa.
   */
  function conditionMet(c, niche, env) {
    if (c.niches && c.niches.indexOf(niche) === -1) return false;
    if (c.oxygenBelow != null && !(env && env.oxygen < c.oxygenBelow)) return false;
    if (c.climate && !(env && env.climate === c.climate)) return false;
    return true;
  }
  function effectiveStats(data, lineage, env) {
    var st = clone(lineage.stats), notes = [], byId = traitsById(data);
    (lineage.traits || []).forEach(function (id) {
      var t = byId[id];
      (t && t.conditions || []).forEach(function (c) {
        if (!conditionMet(c, lineage.niche, env)) return;
        for (var k in c.effects) st[k] = (st[k] || 0) + c.effects[k];
        notes.push({ trait: t.name, note: c.note, effects: c.effects });
      });
    });
    var w = (data.NICHES[lineage.niche] || {}).without;
    if (w && (lineage.traits || []).indexOf(w.trait) === -1) {
      for (var k in w.effects) st[k] = (st[k] || 0) + w.effects[k];
      notes.push({ trait: data.NICHES[lineage.niche].label, note: w.note, effects: w.effects });
    }
    return { stats: st, notes: notes };
  }
  function computeDynamics(data, env, lineage, ctx) {
    ctx = ctx || {};
    var eff = effectiveStats(data, lineage, env);
    var es = { stats: eff.stats };
    var ne = envForNiche(data, env, lineage.niche);
    var food = Math.max(0, ne.food + (ctx.foodBonus || 0));
    var predators = ne.predators + (ctx.predBonus || 0) + (ctx.predatorLevel || 0);
    predators = Math.max(0, predators * (ctx.predMult || 1));

    var climateMod = env.climate === 'zimno' ? 0.7 : (env.climate === 'cieplo' ? 1.1 : 1.0);
    if (env.climate === 'zimno' && lineage.traits.indexOf('endothermy') !== -1) climateMod = 1.0;
    var oxygenMod = clamp(1 + (10 - env.oxygen) * 0.04, 0.7, 1.4);

    // Aklimatyzacja: w turze migracji linia słabiej zdobywa pokarm.
    var acclimatizing = ctx.nowTurn != null && lineage.migratedAt === ctx.nowTurn;
    var acclim = acclimatizing ? data.MIGRATION.acclimatizationFood : 1;

    var foodIntake = lstat(es, 'feeding') * (food / 10) * climateMod * acclim;
    var upkeep = lstat(es, 'metabolism') * oxygenMod;
    var energy = foodIntake - upkeep;
    var mobilityShield = lstat(es, 'mobility') * 0.4;
    var predationPressure = Math.max(0, predators - lstat(es, 'defense') - mobilityShield);
    var predationLossRate = clamp(predationPressure * 0.035, 0, 0.45);
    var starvationLossRate = energy < 0 ? clamp(-energy * 0.03, 0, 0.5) : 0;
    var birthRate = energy >= 0 ? clamp(0.03 * lstat(es, 'reproduction') * (1 + energy * 0.05), 0, 0.6) : 0;
    return { energy: energy, predationPressure: predationPressure, acclimatizing: acclimatizing, notes: eff.notes,
      predationLossRate: predationLossRate, starvationLossRate: starvationLossRate, birthRate: birthRate };
  }
  function contextFor(data, state, extra) {
    var diff = difficultyOf(data, state);
    var ctx = { predatorLevel: state.predatorLevel || 0, predMult: diff.predMult, nowTurn: nowTurn(data, state) };
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
    var cat = hitsLineage(env.catastrophe, lineage) ? env.catastrophe : null;
    var impact = cat ? catastropheImpact(cat, lineage, difficultyOf(data, state)) : null;
    var catD = impact ? Math.round(proj * impact.severity) : 0;
    proj -= catD;
    return { energy: round1(d.energy), predationPressure: round1(d.predationPressure),
      births: births, predationDeaths: predD, starvationDeaths: starvD, catastropheDeaths: catD,
      projectedPop: proj, delta: proj - pop, catastrophe: cat,
      catastropheLoss: impact ? Math.round(impact.severity * 100) : 0,
      survivalReasons: impact ? impact.reasons : [],
      acclimatizing: d.acclimatizing, notes: d.notes };
  }

  /* Prognoza z hipotetyczną cechą: efekty liczbowe ORAZ obecność cechy na liście
     (np. stałocieplność chroni przed zimnem). */
  function forecastWithTrait(data, state, lineage, trait) {
    var l = clone(lineage);
    if (l.traits.indexOf(trait.id) === -1) { l.traits.push(trait.id); applyEffects(l, trait.effects); }
    return forecast(data, state, l);
  }

  // ---------- Symulacja tury ----------
  function simulateTurn(data, state, rng) {
    rng = rng || Math.random;
    if (state.status !== 'playing') return { state: state, report: null };
    var n = clone(state);
    var era = data.ERAS[n.eraIndex];
    var env = currentTurnEnv(data, n);
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

    var nichesPaid = {};
    aliveLineages(n).forEach(function (l) {
      var r = simulateLineage(data, n, l, env, rng, knowledge, ctx, diff, nichesPaid);
      lineReports.push(r); totalEp += r.epGain; if (l.alive) anyAlive = true;
    });
    // Premie globalne: za przetrwanie i za inteligencję NAJLEPSZEJ linii — liczone
    // raz, by specjacja nie mnożyła punktów.
    var epBase = anyAlive ? data.EP_RULES.base : 0;
    var epIntel = anyAlive ? Math.floor(maxIntelligence(n) / data.EP_RULES.intelligenceDiv) : 0;
    totalEp += epBase + epIntel;
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
    n.env = n.status === 'playing' ? rollEnv(data, n.eraIndex, n.turn, rng) : null;

    var report = {
      eraIndex: prevEraIndex, eraName: era.name, turnIndex: state.turn,
      envTitle: env.title, envNote: env.note, climate: env.climate,
      catastrophe: env.catastrophe || null,
      event: event ? { name: event.name, desc: event.desc } : null,
      lineReports: lineReports, epGain: totalEp, epBase: epBase, epIntel: epIntel,
      predatorLevel: round1(n.predatorLevel),
      totalPopulation: totalPopulation(n), maxIntelligence: maxIntelligence(n),
      intelligenceGoal: n.intelligenceGoal, eraChanged: eraChanged,
      newEraName: eraChanged ? data.ERAS[n.eraIndex].name : null,
      knowledge: dedupe(knowledge), status: n.status
    };
    n.history.push(report);
    return { state: n, report: report };
  }

  function simulateLineage(data, n, l, env, rng, knowledge, ctx, diff, nichesPaid) {
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

    var catDeaths = 0, survivalReasons = [];
    if (hitsLineage(env.catastrophe, l)) {
      var impact = catastropheImpact(env.catastrophe, l, diff);
      catDeaths = Math.round(Math.max(0, pop) * impact.severity);
      pop -= catDeaths;
      survivalReasons = impact.reasons;
      events.push('Katastrofa (' + env.catastrophe.name + ') — straty ' + Math.round(impact.severity * 100) + '% populacji.');
      if (impact.reasons.length) events.push('Przetrwać pomogło: ' + impact.reasons.join('; ') + '.');
    }

    pop = Math.max(0, Math.round(pop));
    l.population = pop; l.popHistory.push(pop);
    if (pop > l.peakPopulation) l.peakPopulation = pop;

    if (d.acclimatizing) events.push('Aklimatyzacja w nowej niszy — mniej pokarmu w tej turze.');
    if (d.predationLossRate > 0.15) { events.push('Silna presja drapieżników.'); knowledge.push('predation'); }
    if (d.starvationLossRate > 0) { events.push('Ujemny bilans energetyczny — głód.'); knowledge.push('starvation'); }
    if (env.climate === 'zimno') knowledge.push('cold');
    if (l.niche !== 'woda') knowledge.push('niche');

    if (pop <= 0 && l.alive) {
      l.alive = false; l.extinctGlobalTurn = globalTurn(data, n.eraIndex, n.turn) + 1;
      events.push('Ta linia wymarła.');
    }

    // Rozbicie EP — czytelne, skąd pochodzą punkty. Premia za niszę raz na
    // zajętą niszę (nagradza dywersyfikację, a nie liczbę linii).
    var growth = pop - popBefore;
    var nicheBonus = 0;
    if (pop > 0 && !nichesPaid[l.niche]) { nicheBonus = data.NICHES[l.niche].epBonus || 0; nichesPaid[l.niche] = true; }
    var bd = {
      growth: pop > 0 ? Math.max(0, Math.floor(growth / data.EP_RULES.perGrowth)) : 0,
      population: pop > 0 ? Math.floor(pop / data.EP_RULES.perPopulation) : 0,
      niche: nicheBonus
    };
    var epGain = bd.growth + bd.population + bd.niche;

    return {
      lineageId: l.id, name: l.name, niche: l.niche,
      popBefore: popBefore, popAfter: pop,
      births: births, predationDeaths: predationDeaths, starvationDeaths: starvationDeaths, catDeaths: catDeaths,
      survivalReasons: survivalReasons,
      energy: round1(d.energy), intelligence: lstat(l, 'intelligence'),
      epGain: epGain, epBreakdown: bd, alive: l.alive, events: events
    };
  }

  // Siła katastrofy w danej niszy (nicheSeverity nadpisuje wartość domyślną).
  function catastropheSeverity(cat, niche) {
    if (cat.nicheSeverity && cat.nicheSeverity[niche] != null) return cat.nicheSeverity[niche];
    return cat.severity;
  }

  function hitsLineage(cat, l) { return !!cat && (cat.niche === 'all' || cat.niche === l.niche); }

  /*
   * Selektywność wymierań (ZALOZENIA 4.3): cechy lub statystyki z `survival`
   * mnożą siłę katastrofy. Zwraca { severity, reasons } — reasons trafiają do
   * raportu, by było jasne, DLACZEGO linia przetrwała lepiej.
   */
  function catastropheImpact(cat, l, diff) {
    var sev = catastropheSeverity(cat, l.niche), reasons = [];
    (cat.survival || []).forEach(function (f) {
      var hit = false;
      if (f.trait) hit = l.traits.indexOf(f.trait) !== -1;
      else if (f.stat) {
        var v = lstat(l, f.stat);
        hit = (f.min == null || v >= f.min) && (f.max == null || v <= f.max);
      }
      if (hit) { sev *= f.mult; reasons.push(f.reason); }
    });
    return { severity: clamp(sev * ((diff && diff.catMult) || 1), 0, 0.95), reasons: reasons };
  }

  // Zwycięstwo: próg inteligencji w linii, która ma też cechę kultury (WIN_TRAIT).
  function hasWon(n, data) {
    return n.lineages.some(function (l) {
      return l.alive && l.population > 0 && l.stats.intelligence >= n.intelligenceGoal &&
        (!data.WIN_TRAIT || l.traits.indexOf(data.WIN_TRAIT) !== -1);
    });
  }

  function evaluateStatus(n, data) {
    if (totalPopulation(n) <= 0) return 'lost';
    if (hasWon(n, data)) return 'won';
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
    elapsedTurns: elapsedTurns, playedEras: playedEras, catastropheSeverity: catastropheSeverity,
    catastropheImpact: catastropheImpact, effectiveStats: effectiveStats, hasWon: hasWon,
    migrationCost: migrationCost, speciationCost: speciationCost, nowTurn: nowTurn,
    difficultyOf: difficultyOf,
    getLineage: getLineage, getActiveLineage: getActiveLineage, aliveLineages: aliveLineages,
    totalPopulation: totalPopulation, maxIntelligence: maxIntelligence, maxDefense: maxDefense,
    setActiveLineage: setActiveLineage,
    availableNiches: availableNiches, canMigrate: canMigrate, migrateLineage: migrateLineage,
    traitStatus: traitStatus, prerequisitesMet: prerequisitesMet, eraUnlocked: eraUnlocked,
    buyTrait: buyTrait, canSpeciate: canSpeciate, speciate: speciate,
    forecast: forecast, forecastWithTrait: forecastWithTrait, simulateTurn: simulateTurn, evaluateStatus: evaluateStatus, statLabel: statLabel,
    _internals: { rollMutation: rollMutation, clamp: clamp, computeDynamics: computeDynamics }
  };
});
