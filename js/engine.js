/*
 * engine.js — silnik symulacji (czysta logika gry).
 *
 * ZALOZENIA.md sekcja 9: logika oddzielona od UI, testowalna, bez DOM.
 * Obsługuje: poziomy trudności, wiele er, wiele linii (specjacja), cztery nisze
 * z migracją, katastrofy i pozytywne zdarzenia, koewolucję (adaptacyjną presję
 * drapieżników), rozbicie EP i prognozę „co-jeśli”, trzy waluty (EP — cechy,
 * ⚡ rezerwy — taktyka tury, 🧬 zmienność — specjacja i dobór), strategie
 * rozrodu, zachowania w turze i karty decyzji.
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
  /* Losowe zaokrąglanie: 0,4 osobnika to 0 lub 1 z szansą 40%. Wartość oczekiwana
     się zgadza, a mała populacja nie staje się „nieśmiertelna” (Math.round(2 × 0,22) = 0). */
  function sround(x, rng) { var f = Math.floor(x); return f + (rng() < x - f ? 1 : 0); }
  function dedupe(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function traitsById(data) { var m = {}; data.TRAITS.forEach(function (t) { m[t.id] = t; }); return m; }

  function makeLineage(id, name, parentId, population, stats, traits, niche, bornEra, bornTurn, res) {
    res = res || {};
    return {
      id: id, name: name, parentId: parentId,
      population: population, peakPopulation: population,
      stats: clone(stats), traits: traits.slice(), niche: niche || 'woda',
      alive: true, bornEra: bornEra, bornTurn: bornTurn, extinctGlobalTurn: null,
      popHistory: [population],
      reserves: res.reserves || 0,        // ⚡ rezerwy energii
      variation: res.variation || 0,      // 🧬 zmienność genetyczna
      strategy: res.strategy || 'zrownowazona',
      behavior: 'brak',                   // zachowanie w bieżącej turze
      selection: false,                   // ukierunkowany dobór
      mods: []                            // modyfikatory tur z kart decyzji
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
      data.START_POPULATION, data.BASE_STATS, [], 'woda', startEra, 0,
      { reserves: data.RESERVES.start, variation: data.VARIATION.start });

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
      version: 6,
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
      pendingChoice: null,       // karta decyzji czekająca na wybór gracza
      resolvedChoice: null,      // wybór do pokazania w raporcie tury
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
    if ((lineage.reserves || 0) < cost) return { ok: false, error: 'Za mało rezerw energii na migrację (potrzeba ' + cost + ' ⚡).' };
    return { ok: true, error: null, cost: cost };
  }
  // Migracja kosztuje ⚡ rezerwy linii — tym mniej, im mobilniejsza linia (ZALOZENIA 4.1).
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
    nl.niche = niche; nl.migratedAt = nowTurn(data, n); nl.reserves -= can.cost;
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
  // Płatna 🧬 zmiennością aktywnej linii. Każda kolejna żywa linia podnosi koszt —
  // utrzymanie wielu linii nie jest darmowe.
  function speciationCost(data, state) {
    return data.SPECIATION_COST + (data.SPECIATION_COST_STEP || 0) * Math.max(0, aliveLineages(state).length - 1);
  }
  function canSpeciate(data, state) {
    var a = getActiveLineage(state);
    if (!a) return { ok: false, error: 'Brak aktywnej linii.' };
    var cost = speciationCost(data, state);
    if ((a.variation || 0) < cost) return { ok: false, error: 'Za mała zmienność genetyczna na specjację (potrzeba ' + cost + ' 🧬).' };
    if (a.population < data.MIN_SPECIATION_POP) return { ok: false, error: 'Za mała populacja do specjacji (min. ' + data.MIN_SPECIATION_POP + ').' };
    return { ok: true, error: null };
  }
  function speciate(data, state, newName) {
    var check = canSpeciate(data, state);
    if (!check.ok) return { ok: false, state: state, error: check.error };
    var n = clone(state); var parent = getActiveLineage(n); var cost = speciationCost(data, state);
    parent.variation -= cost;
    // Obie połowy populacji niosą pozostałą zmienność i zapasy.
    var child = splitLineage(n, parent, Math.floor(parent.population / 2), newName || (parent.name + ' II'),
      { variation: parent.variation });
    n.activeLineageId = child.id;
    unlockKnowledge(n, 'speciation');
    return { ok: true, state: n, error: null };
  }
  // Oddziela `childPop` osobników rodzica jako nową linię (specjacja, kolonizacja).
  function splitLineage(n, parent, childPop, name, res) {
    parent.population -= childPop; parent.popHistory[parent.popHistory.length - 1] = parent.population;
    var childId = 'L' + n.nextLineageNum; n.nextLineageNum += 1;
    var child = makeLineage(childId, name, parent.id, childPop, parent.stats, parent.traits, parent.niche,
      n.eraIndex, n.turn, { reserves: parent.reserves, variation: res.variation, strategy: parent.strategy });
    n.lineages.push(child);
    return child;
  }

  // ---------- Mutacja ----------
  // Inteligencja mutuje tylko u linii z mózgiem — sam przypadek nie prowadzi do
  // rozumności. Korzystna mutacja metabolizmu go obniża (tańsze utrzymanie).
  // Ukierunkowany dobór (sel) — częstsze i częściej korzystne mutacje.
  function rollMutation(l, rng, sel) {
    if (rng() > (sel ? sel.chance : 0.28)) return null;
    var keys = ['feeding', 'defense', 'reproduction', 'mobility', 'metabolism'];
    if (l.traits.indexOf('brain') !== -1) keys.push('intelligence');
    var key = keys[Math.floor(rng() * keys.length)];
    var beneficial = rng() < (sel ? sel.good : 0.6);
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
  // Modyfikatory kart decyzji obowiązujące w danej turze (sumy / iloczyny).
  function turnMods(lineage, turn) {
    var m = { foodBonus: 0, predBonus: 0, birthMult: 1, diseaseLoss: 0, noPredators: false };
    (lineage.mods || []).forEach(function (x) {
      if (x.turn !== turn) return;
      m.foodBonus += x.foodBonus || 0; m.predBonus += x.predBonus || 0;
      m.birthMult *= x.birthMult || 1; m.diseaseLoss += x.diseaseLoss || 0;
      if (x.noPredators) m.noPredators = true;
    });
    return m;
  }
  function strategyOf(data, lineage) { return data.STRATEGIES[lineage.strategy] || data.STRATEGIES.zrownowazona; }
  // Zachowanie działa tylko, gdy linię stać na nie w chwili tury.
  function behaviorOf(data, lineage) {
    var b = data.BEHAVIORS[lineage.behavior];
    return (b && (lineage.reserves || 0) >= (b.cost || 0)) ? b : data.BEHAVIORS.brak;
  }
  function reservesCap(data, lineage) {
    var r = data.RESERVES, cap = r.cap;
    for (var id in r.capBonus) if (lineage.traits.indexOf(id) !== -1) cap += r.capBonus[id];
    return cap;
  }

  function computeDynamics(data, env, lineage, ctx) {
    ctx = ctx || {};
    var eff = effectiveStats(data, lineage, env);
    var es = { stats: eff.stats };
    var strat = strategyOf(data, lineage), beh = behaviorOf(data, lineage);
    var mods = turnMods(lineage, ctx.nowTurn);
    var ne = envForNiche(data, env, lineage.niche);
    var food = Math.max(0, ne.food + (ctx.foodBonus || 0) + mods.foodBonus);
    var predators = ne.predators + (ctx.predBonus || 0) + (ctx.predatorLevel || 0) + mods.predBonus + (beh.predAdd || 0);
    predators = Math.max(0, predators * (ctx.predMult || 1));

    var climateMod = env.climate === 'zimno' ? 0.7 : (env.climate === 'cieplo' ? 1.1 : 1.0);
    if (env.climate === 'zimno' && lineage.traits.indexOf('endothermy') !== -1) climateMod = 1.0;
    var oxygenMod = clamp(1 + (10 - env.oxygen) * 0.04, 0.7, 1.4);

    // Aklimatyzacja: w turze migracji linia słabiej zdobywa pokarm.
    var acclimatizing = ctx.nowTurn != null && lineage.migratedAt === ctx.nowTurn;
    var acclim = acclimatizing ? data.MIGRATION.acclimatizationFood : 1;

    var foodIntake = lstat(es, 'feeding') * (food / 10) * climateMod * acclim * (beh.foodMult || 1);
    var upkeep = lstat(es, 'metabolism') * oxygenMod;
    var energy = foodIntake - upkeep;

    // ⚡ Rezerwy: najpierw opłata za zachowanie i strategię, potem deficyt energii
    // pokrywany z zapasów, a nadwyżka odkładana (do pojemności magazynu).
    var R = data.RESERVES, cap = reservesCap(data, lineage);
    var reserves = Math.max(0, (lineage.reserves || 0) - (beh.cost || 0));
    var drain = Math.min(reserves, strat.reserveDrain || 0); reserves -= drain;
    var reserveDraw = energy < 0 ? Math.min(reserves, -energy, R.drawMax || Infinity) : 0;
    reserves -= reserveDraw;
    var stored = (energy > 0 ? energy * R.storeRate : 0) + (beh.storeBonus || 0);
    var reservesAfter = round1(clamp(reserves + stored, 0, cap));
    var netEnergy = energy + reserveDraw;

    var mobilityShield = lstat(es, 'mobility') * 0.4;
    var predationPressure = Math.max(0, predators - lstat(es, 'defense') - mobilityShield) * (beh.predPressureMult || 1);
    if (mods.noPredators) predationPressure = 0;
    var predationLossRate = clamp(predationPressure * 0.035 * strat.predLossMult, 0, 0.45);
    var starvationLossRate = netEnergy < 0 ? clamp(-netEnergy * 0.03 * strat.starveLossMult, 0, 0.5) : 0;
    var birthRate = netEnergy >= 0 ? clamp(0.03 * lstat(es, 'reproduction') * (1 + Math.max(0, energy) * 0.05), 0, 0.6) : 0;
    if (energy < 0) birthRate *= R.deficitBirthMult;  // życie z zapasów — słabszy rozród
    birthRate = clamp(birthRate * strat.birthMult * (beh.birthMult || 1) * mods.birthMult, 0, 0.8);
    return { energy: energy, predationPressure: predationPressure, acclimatizing: acclimatizing, notes: eff.notes,
      predationLossRate: predationLossRate, starvationLossRate: starvationLossRate, birthRate: birthRate,
      diseaseLossRate: clamp(mods.diseaseLoss, 0, 0.9),
      reserveDraw: round1(reserveDraw), reservesAfter: reservesAfter, reservesCap: cap,
      behavior: beh === data.BEHAVIORS.brak ? 'brak' : lineage.behavior,
      behaviorBlocked: lineage.behavior && lineage.behavior !== 'brak' && beh === data.BEHAVIORS.brak };
  }
  function contextFor(data, state, extra) {
    var diff = difficultyOf(data, state);
    var ctx = { predatorLevel: state.predatorLevel || 0, predMult: diff.predMult, nowTurn: nowTurn(data, state) };
    if (extra) { ctx.foodBonus = extra.foodBonus || 0; ctx.predBonus = extra.predBonus || 0; }
    return ctx;
  }

  /* Efekt Allee: poniżej minimalnej żywotnej populacji rozród słabnie. */
  function alleeFactor(data, pop) {
    var mvp = data.MIN_VIABLE_POP || 0;
    return (mvp > 0 && pop < mvp) ? pop / mvp : 1;
  }

  /* Prognoza „co-jeśli” — bez mutacji i zdarzeń, ale z koewolucją i trudnością. */
  function forecast(data, state, lineage) {
    var env = currentTurnEnv(data, state);
    if (!env) return null;
    var d = computeDynamics(data, env, lineage, contextFor(data, state));
    var pop = lineage.population;
    var births = Math.round(pop * d.birthRate * alleeFactor(data, pop));
    var predD = Math.round(pop * d.predationLossRate);
    var starvD = Math.round(pop * d.starvationLossRate);
    var disD = Math.round(pop * d.diseaseLossRate);
    var proj = Math.max(0, pop + births - predD - starvD - disD);
    var cat = hitsLineage(env.catastrophe, lineage) ? env.catastrophe : null;
    var impact = cat ? catastropheImpact(cat, lineage, difficultyOf(data, state), data) : null;
    var catD = impact ? Math.round(proj * impact.severity) : 0;
    proj -= catD;
    return { energy: round1(d.energy), predationPressure: round1(d.predationPressure),
      births: births, predationDeaths: predD, starvationDeaths: starvD, diseaseDeaths: disD, catastropheDeaths: catD,
      projectedPop: proj, delta: proj - pop, catastrophe: cat,
      catastropheLoss: impact ? Math.round(impact.severity * 100) : 0,
      survivalReasons: impact ? impact.reasons : [],
      reserves: round1(lineage.reserves || 0), reservesAfter: d.reservesAfter, reservesCap: d.reservesCap,
      reserveDraw: d.reserveDraw, behaviorBlocked: d.behaviorBlocked,
      acclimatizing: d.acclimatizing, notes: d.notes,
      critical: pop > 0 && Math.min(pop, proj) < (data.MIN_VIABLE_POP || 0) };
  }

  /* Prognoza z hipotetyczną cechą: efekty liczbowe ORAZ obecność cechy na liście
     (np. stałocieplność chroni przed zimnem). */
  function forecastWithTrait(data, state, lineage, trait) {
    var l = clone(lineage);
    if (l.traits.indexOf(trait.id) === -1) { l.traits.push(trait.id); applyEffects(l, trait.effects); }
    return forecast(data, state, l);
  }
  /* Prognoza z inną strategią rozrodu i/lub zachowaniem — podgląd „co-jeśli”. */
  function forecastWithTactics(data, state, lineage, tactics) {
    var l = clone(lineage);
    if (tactics.strategy) l.strategy = tactics.strategy;
    if (tactics.behavior) l.behavior = tactics.behavior;
    return forecast(data, state, l);
  }

  // ---------- Taktyka linii: strategia, zachowanie, ukierunkowany dobór ----------
  function editLineage(state, id, fn) {
    var l = getLineage(state, id);
    if (!l || !l.alive) return { ok: false, state: state, error: 'Nieznana lub wymarła linia.' };
    if (state.status !== 'playing') return { ok: false, state: state, error: 'Gra zakończona.' };
    var err = fn(null, l);
    if (err) return { ok: false, state: state, error: err };
    var n = clone(state); fn(n, getLineage(n, id));
    return { ok: true, state: n, error: null };
  }
  function setStrategy(data, state, id, key) {
    return editLineage(state, id, function (n, l) {
      if (!data.STRATEGIES[key]) return 'Nieznana strategia.';
      if (n) { l.strategy = key; if (key !== 'zrownowazona') unlockKnowledge(n, 'rk'); }
    });
  }
  function canSetBehavior(data, lineage, key) {
    var b = data.BEHAVIORS[key];
    if (!b) return { ok: false, error: 'Nieznane zachowanie.' };
    if ((lineage.reserves || 0) < (b.cost || 0)) return { ok: false, error: 'Za mało rezerw energii (potrzeba ' + b.cost + ' ⚡).' };
    return { ok: true, error: null };
  }
  function setBehavior(data, state, id, key) {
    return editLineage(state, id, function (n, l) {
      var c = canSetBehavior(data, l, key); if (!c.ok) return c.error;
      if (n) { l.behavior = key; if (key === 'zapasy') unlockKnowledge(n, 'reserves'); }
    });
  }
  function setSelection(data, state, id, on) {
    return editLineage(state, id, function (n, l) {
      if (on && (l.variation || 0) < data.VARIATION.selectionCost) return 'Za mała zmienność na ukierunkowany dobór (potrzeba ' + data.VARIATION.selectionCost + ' 🧬 na turę).';
      if (n) { l.selection = !!on; if (on) unlockKnowledge(n, 'variation'); }
    });
  }

  // ---------- Karty decyzji ----------
  function choiceEvent(data, id) { return data.CHOICE_EVENTS.filter(function (e) { return e.id === id; })[0]; }
  function choiceOption(ev, id) { return ev && ev.options.filter(function (o) { return o.id === id; })[0]; }
  function defaultOption(ev) { return ev.options.filter(function (o) { return o.default; })[0] || ev.options[ev.options.length - 1]; }
  function canChoose(data, state, optionId) {
    var pc = state.pendingChoice;
    if (!pc) return { ok: false, error: 'Brak karty decyzji.' };
    var ev = choiceEvent(data, pc.eventId), opt = choiceOption(ev, optionId), l = getLineage(state, pc.lineageId);
    if (!opt) return { ok: false, error: 'Nieznana opcja.' };
    if (!l || !l.alive) return { ok: false, error: 'Linia wymarła.' };
    var c = opt.cost || {};
    if (c.reserves && (l.reserves || 0) < c.reserves) return { ok: false, error: 'Za mało rezerw energii (potrzeba ' + c.reserves + ' ⚡).' };
    if (c.variation && (l.variation || 0) < c.variation) return { ok: false, error: 'Za mała zmienność (potrzeba ' + c.variation + ' 🧬).' };
    if (opt.effects && opt.effects.found && Math.floor(l.population * opt.effects.found) < 2) return { ok: false, error: 'Za mała populacja, by założyć kolonię.' };
    return { ok: true, error: null };
  }
  function resolveChoice(data, state, optionId) {
    var can = canChoose(data, state, optionId);
    if (!can.ok) return { ok: false, state: state, error: can.error };
    var n = clone(state), pc = n.pendingChoice;
    var ev = choiceEvent(data, pc.eventId), opt = choiceOption(ev, optionId), l = getLineage(n, pc.lineageId);
    applyChoice(data, n, l, ev, opt);
    return { ok: true, state: n, error: null };
  }
  function applyChoice(data, n, l, ev, opt) {
    var c = opt.cost || {}, fx = opt.effects || {}, now = nowTurn(data, n), colony = null;
    if (c.reserves) l.reserves -= c.reserves;
    if (c.variation) l.variation -= c.variation;
    if (fx.stats) applyEffects(l, fx.stats);
    if (fx.reserves) l.reserves = Math.min(reservesCap(data, l), (l.reserves || 0) + fx.reserves);
    if (fx.predatorLevel) n.predatorLevel = clamp((n.predatorLevel || 0) + fx.predatorLevel, 0, 12);
    if (fx.found) {
      colony = splitLineage(n, l, Math.floor(l.population * fx.found), l.name + ' (wyspa)',
        { variation: data.VARIATION.founder });
    }
    if (opt.turnMod) l.mods.push(Object.assign({ turn: now }, opt.turnMod));
    if (opt.nextMod) l.mods.push(Object.assign({ turn: now + 1 }, opt.nextMod));
    if (opt.knowledge) unlockKnowledge(n, opt.knowledge);
    n.pendingChoice = null;
    n.resolvedChoice = { eventId: ev.id, name: ev.name, option: opt.label, lineageId: l.id, lineageName: l.name,
      colonyName: colony ? colony.name : null };
  }
  // Losowanie karty decyzji na następną turę (bez katastrofy).
  function rollChoice(data, n, rng) {
    if (n.status !== 'playing' || !n.env || n.env.conditions.catastrophe) return null;
    if (!data.CHOICE_EVENTS || rng() >= (data.CHOICE_CHANCE || 0)) return null;
    var alive = aliveLineages(n); if (!alive.length) return null;
    var l = alive[Math.floor(rng() * alive.length)];
    var pool = data.CHOICE_EVENTS.filter(function (e) { return !e.minPop || l.population >= e.minPop; });
    if (!pool.length) return null;
    var ev = pool[Math.floor(rng() * pool.length)];
    return { eventId: ev.id, lineageId: l.id, turn: nowTurn(data, n) };
  }

  // ---------- Symulacja tury ----------
  function simulateTurn(data, state, rng) {
    rng = rng || Math.random;
    if (state.status !== 'playing') return { state: state, report: null };
    var n = clone(state);
    var era = data.ERAS[n.eraIndex];
    var env = currentTurnEnv(data, n);
    var diff = difficultyOf(data, n);

    // Karta decyzji bez wyboru gracza — działa opcja domyślna.
    if (n.pendingChoice) {
      var pev = choiceEvent(data, n.pendingChoice.eventId), pl = getLineage(n, n.pendingChoice.lineageId);
      if (pev && pl && pl.alive) applyChoice(data, n, pl, pev, defaultOption(pev));
      else n.pendingChoice = null;
    }
    var choice = n.resolvedChoice; n.resolvedChoice = null;

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
    n.endReason = n.status === 'lost' ? (totalPopulation(n) > 0 ? 'nonviable' : 'extinct') : null;
    n.env = n.status === 'playing' ? rollEnv(data, n.eraIndex, n.turn, rng) : null;
    // Po turze: zachowania wracają do „zwykłego życia”, stare modyfikatory wygasają.
    var nextT = nowTurn(data, n);
    n.lineages.forEach(function (l) {
      l.behavior = 'brak';
      l.mods = (l.mods || []).filter(function (m) { return m.turn >= nextT; });
    });
    n.pendingChoice = rollChoice(data, n, rng);

    var report = {
      eraIndex: prevEraIndex, eraName: era.name, turnIndex: state.turn,
      envTitle: env.title, envNote: env.note, climate: env.climate,
      catastrophe: env.catastrophe || null,
      event: event ? { name: event.name, desc: event.desc } : null,
      choice: choice || null,
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
    var events = [], V = data.VARIATION;
    // Ukierunkowany dobór zużywa zmienność; bez niej wyłącza się sam.
    var sel = null;
    if (l.selection) {
      if (l.variation >= V.selectionCost) { l.variation -= V.selectionCost; sel = { chance: V.selectionChance, good: V.selectionGood }; }
      else { l.selection = false; events.push('Ukierunkowany dobór wstrzymany — wyczerpana zmienność genetyczna.'); }
    }
    var mut = rollMutation(l, rng, sel);
    if (mut) {
      events.push((mut.beneficial ? 'Korzystna' : 'Szkodliwa') + ' mutacja: ' + statLabel(mut.key) + ' ' + (mut.delta > 0 ? '+1' : '-1') + '.');
      knowledge.push(mut.knowledge);
    }
    var popBefore = l.population, reservesBefore = l.reserves;
    var d = computeDynamics(data, env, l, ctx);
    if (d.behaviorBlocked) events.push('Za mało rezerw na zaplanowane zachowanie — linia żyła zwyczajnie.');
    else if (d.behavior !== 'brak') events.push('Zachowanie: ' + data.BEHAVIORS[d.behavior].label.toLowerCase() + '.');
    if (d.reserveDraw > 0) {
      events.push((d.starvationLossRate > 0 ? 'Część deficytu energii pokryły zapasy' : 'Deficyt energii pokryły zapasy') +
        ' (−' + String(d.reserveDraw).replace('.', ',') + ' ⚡).');
      knowledge.push('reserves');
    }
    l.reserves = d.reservesAfter;
    var births = sround(popBefore * d.birthRate * alleeFactor(data, popBefore), rng);
    var predationDeaths = sround(popBefore * d.predationLossRate, rng);
    var starvationDeaths = sround(popBefore * d.starvationLossRate, rng);
    var diseaseDeaths = sround(popBefore * d.diseaseLossRate, rng);
    if (diseaseDeaths > 0) events.push('Choroba zabiła ' + diseaseDeaths + ' osobników.');
    var pop = popBefore + births - predationDeaths - starvationDeaths - diseaseDeaths;

    var catDeaths = 0, survivalReasons = [];
    if (hitsLineage(env.catastrophe, l)) {
      var impact = catastropheImpact(env.catastrophe, l, diff, data);
      catDeaths = sround(Math.max(0, pop) * impact.severity, rng);
      pop -= catDeaths;
      l.variation = Math.floor(l.variation * (1 - impact.severity * V.catastropheLoss));
      survivalReasons = impact.reasons;
      events.push('Katastrofa (' + env.catastrophe.name + ') — straty ' + Math.round(impact.severity * 100) + '% populacji.');
      if (impact.reasons.length) events.push('Przetrwać pomogło: ' + impact.reasons.join('; ') + '.');
    }

    pop = Math.max(0, Math.round(pop));
    l.population = pop; l.popHistory.push(pop);
    if (pop > l.peakPopulation) l.peakPopulation = pop;

    if (pop > 0 && pop < (data.MIN_VIABLE_POP || 0)) {
      events.push('Populacja krytycznie mała (poniżej ' + data.MIN_VIABLE_POP + ') — słabnie rozród, grozi wymarcie.');
    }
    // 🧬 Zmienność: przyrost z czasem, liczebnością i mutacją; wąskie gardło i dryf ją zabierają.
    var variationBefore = l.variation;
    if (pop > 0 && pop < (data.MIN_VIABLE_POP || 0)) {
      l.variation = Math.floor(l.variation * V.bottleneckMult);
      if (variationBefore > l.variation) { events.push('Wąskie gardło — linia traci zmienność genetyczną.'); knowledge.push('drift'); }
    } else if (pop >= V.smallPop) {
      l.variation += V.base + Math.min(V.popMax, Math.floor(pop / V.perPop));
    }
    if (mut) l.variation += V.mutation;
    l.variation = clamp(l.variation, 0, V.cap);
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
      diseaseDeaths: diseaseDeaths,
      reservesBefore: reservesBefore, reservesAfter: l.reserves, variationAfter: l.variation,
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
  function catastropheImpact(cat, l, diff, data) {
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
    // Wysoka zmienność genetyczna — część osobników zniesie nowe warunki.
    var V = data && data.VARIATION;
    if (V && (l.variation || 0) >= V.shieldMin) {
      sev *= 1 - Math.min(V.shieldMax, l.variation * V.shieldPer);
      reasons.push('wysoka zmienność genetyczna — część osobników była odporna');
    }
    return { severity: clamp(sev * ((diff && diff.catMult) || 1), 0, 0.95), reasons: reasons };
  }

  // Linia spełnia warunki „rozumu”: próg inteligencji i cecha kultury (WIN_TRAIT).
  function meetsWinTraits(n, data, l) {
    return l.alive && l.population > 0 && l.stats.intelligence >= n.intelligenceGoal &&
      (!data.WIN_TRAIT || l.traits.indexOf(data.WIN_TRAIT) !== -1);
  }
  // Zwycięstwo: warunki „rozumu” w linii o żywotnej liczebności (WIN_MIN_POP) —
  // kilka ostatnich osobników to nie gatunek, który zbuduje kulturę.
  function hasWon(n, data) {
    return n.lineages.some(function (l) {
      return meetsWinTraits(n, data, l) && l.population >= (data.WIN_MIN_POP || 0);
    });
  }
  // Cel osiągnięty poza liczebnością — UI podpowiada, że trzeba odbudować populację.
  function goalBlockedByPopulation(n, data) {
    return !hasWon(n, data) && n.lineages.some(function (l) { return meetsWinTraits(n, data, l); });
  }
  // Na koniec gry linie poniżej minimalnej żywotnej populacji są funkcjonalnie wymarłe.
  function hasViableLineage(n, data) {
    return n.lineages.some(function (l) { return l.alive && l.population >= (data.MIN_VIABLE_POP || 1); });
  }

  function evaluateStatus(n, data) {
    if (totalPopulation(n) <= 0) return 'lost';
    if (hasWon(n, data)) return 'won';
    if (n.eraIndex >= data.ERAS.length) return hasViableLineage(n, data) ? 'survived' : 'lost';
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
    goalBlockedByPopulation: goalBlockedByPopulation, hasViableLineage: hasViableLineage,
    migrationCost: migrationCost, speciationCost: speciationCost, nowTurn: nowTurn,
    difficultyOf: difficultyOf,
    getLineage: getLineage, getActiveLineage: getActiveLineage, aliveLineages: aliveLineages,
    totalPopulation: totalPopulation, maxIntelligence: maxIntelligence, maxDefense: maxDefense,
    setActiveLineage: setActiveLineage,
    availableNiches: availableNiches, canMigrate: canMigrate, migrateLineage: migrateLineage,
    traitStatus: traitStatus, prerequisitesMet: prerequisitesMet, eraUnlocked: eraUnlocked,
    buyTrait: buyTrait, canSpeciate: canSpeciate, speciate: speciate,
    setStrategy: setStrategy, setBehavior: setBehavior, canSetBehavior: canSetBehavior, setSelection: setSelection,
    reservesCap: reservesCap, forecastWithTactics: forecastWithTactics,
    choiceEvent: choiceEvent, canChoose: canChoose, resolveChoice: resolveChoice, defaultOption: defaultOption,
    forecast: forecast, forecastWithTrait: forecastWithTrait, simulateTurn: simulateTurn, evaluateStatus: evaluateStatus, statLabel: statLabel,
    _internals: { rollMutation: rollMutation, sround: sround, alleeFactor: alleeFactor, clamp: clamp, computeDynamics: computeDynamics }
  };
});
