/*
 * engine.js — silnik symulacji (czysta logika gry).
 *
 * ZALOZENIA.md sekcja 9: logika oddzielona od UI, testowalna, bez DOM.
 * Obsługuje: poziomy trudności, wiele er, wiele linii (specjacja), cztery nisze
 * z migracją, pojemność środowiska i minimalną żywotną populację, kompromisy
 * cech zależne od niszy i klimatu, losowo generowany świat (ziarno), zwiastuny
 * katastrof, rywali (gatunki NPC), koewolucję per nisza, oferty mutacji do
 * wyboru, odrzucanie cech, quizy po erze, osiągnięcia i wynik punktowy.
 *
 * Funkcje mutujące zwracają NOWY stan (kopię) — tryb nauczyciela cofa akcje.
 */
(function (root, factory) {
  var engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.Engine = engine;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NICHE_KEYS = ['woda', 'przybrzeze', 'lad', 'powietrze'];
  var MUTABLE_STATS = ['feeding', 'defense', 'reproduction', 'mobility'];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function dedupe(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function traitsById(data) { var m = {}; data.TRAITS.forEach(function (t) { m[t.id] = t; }); return m; }

  // ---------- Deterministyczny generator losowy (ziarno gry) ----------
  // mulberry32 — stan trzymany w obiekcie, więc zapis/cofanie odtwarza losowość.
  function rngFrom(holder) {
    return function () {
      holder.rngState = (holder.rngState + 0x6D2B79F5) | 0;
      var t = holder.rngState;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randomSeed() { return Math.floor(Math.random() * 900000) + 100000; }

  function makeLineage(id, name, parentId, population, stats, traits, niche, bornEra, bornTurn) {
    return {
      id: id, name: name, parentId: parentId,
      population: population, peakPopulation: population, minPopulation: population,
      stats: clone(stats), traits: traits.slice(), niche: niche || 'woda',
      alive: true, bornEra: bornEra, bornTurn: bornTurn, extinctGlobalTurn: null,
      popHistory: [population]
    };
  }

  function globalTurn(data, eraIndex, turn) {
    var g = 0; for (var i = 0; i < eraIndex; i++) g += data.ERAS[i].turns.length; return g + turn;
  }
  function totalTurns(data) { return data.ERAS.reduce(function (s, e) { return s + e.turns.length; }, 0); }

  // ---------- Generowanie świata ----------
  /*
   * Wartości tur są losowo „drgane” (±15%), a historyczne katastrofy zostają na
   * swoich miejscach (rzetelność), lecz z losową siłą i zasięgiem. Dodatkowo
   * pojawiają się drobne katastrofy lokalne. Każda gra z innym ziarnem to inny świat.
   */
  function generateWorld(data, seed) {
    var holder = { rngState: seed | 0 };
    var r = rngFrom(holder);
    function jit(v, amp) { return Math.max(1, Math.round(v * (1 + (r() - 0.5) * 2 * amp))); }
    return data.ERAS.map(function (era) {
      return era.turns.map(function (t, i) {
        var e = clone(t);
        e.food = jit(t.food, 0.15); e.predators = jit(t.predators, 0.18);
        e.oxygen = Math.max(5, t.oxygen + Math.round((r() - 0.5) * 2));
        e.land = { food: jit(t.land.food, 0.15), predators: jit(t.land.predators, 0.18) };
        if (t.catastrophe) {
          var niches = t.catastrophe.niche === 'all' ? NICHE_KEYS.slice() : [t.catastrophe.niche];
          // Zasięg bywa szerszy: wymieranie morskie może dotknąć też przybrzeża.
          if (niches.length === 1 && niches[0] === 'woda' && r() < 0.4) niches.push('przybrzeze');
          e.catastrophe = { name: t.catastrophe.name, niches: niches, minor: false,
            severity: Math.round(t.catastrophe.severity * (0.85 + r() * 0.3) * 100) / 100,
            knowledge: t.catastrophe.knowledge || 'extinction' };
        } else if (i > 0 && r() < data.MINOR_CATASTROPHE_CHANCE) {
          var m = data.MINOR_CATASTROPHES[Math.floor(r() * data.MINOR_CATASTROPHES.length)];
          var pool = m.niches || NICHE_KEYS;
          e.catastrophe = { name: m.name, niches: [pool[Math.floor(r() * pool.length)]], minor: true,
            severity: Math.round(m.severity * (0.8 + r() * 0.4) * 100) / 100, knowledge: m.knowledge || 'events' };
        } else {
          e.catastrophe = null;
        }
        return e;
      });
    });
  }

  /*
   * opts: { difficulty, startEra, startEp, goal, startTraits, scenarioId, seed }
   */
  function createInitialState(data, speciesName, opts) {
    opts = opts || {};
    var diffKey = opts.difficulty || 'normalny';
    var diff = data.DIFFICULTIES[diffKey] || data.DIFFICULTIES.normalny;
    var ep = opts.startEp != null ? opts.startEp : diff.startEp;
    var goal = opts.goal != null ? opts.goal : diff.goal;
    var startEra = opts.startEra || 0;
    var seed = opts.seed != null ? (opts.seed | 0) : randomSeed();

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

    var predatorLevels = {}; NICHE_KEYS.forEach(function (k) { predatorLevels[k] = 0; });
    return {
      version: 5,
      difficulty: diffKey,
      scenario: opts.scenarioId || 'full',
      seed: seed,
      rngState: (seed * 7919) | 0,
      world: generateWorld(data, seed),
      eraIndex: startEra,
      startEra: startEra,
      turn: 0,
      totalTurns: totalTurns(data),
      ep: ep,
      intelligenceGoal: goal,
      predatorLevels: predatorLevels,
      predatorLevel: 0,          // maksimum z nisz (koewolucja) — do raportu
      rivals: rivalsForEra(data, startEra),
      lineages: [root],
      activeLineageId: 'L0',
      nextLineageNum: 1,
      visitedNiches: ['woda'],
      catastrophesSurvived: 0,
      maxAlive: 1,
      achievements: [],
      quizzes: {},
      pendingQuiz: null,
      mutationOffer: null,
      wonAtTurn: null,
      unlockedKnowledge: ['intro'],
      status: 'playing',
      history: []
    };
  }

  function rivalsForEra(data, eraIndex) {
    var era = data.ERAS[Math.min(eraIndex, data.ERAS.length - 1)];
    return clone((data.RIVALS && data.RIVALS[era.id]) || {});
  }

  // ---------- Ery / środowisko ----------
  function currentEra(data, state) { return data.ERAS[Math.min(state.eraIndex, data.ERAS.length - 1)]; }
  function turnEnv(data, state, eraIndex, turn) {
    if (eraIndex >= data.ERAS.length) return null;
    var era = data.ERAS[eraIndex];
    if (turn >= era.turns.length) return null;
    if (state.world && state.world[eraIndex] && state.world[eraIndex][turn]) return state.world[eraIndex][turn];
    var t = era.turns[turn];
    // Zgodność: świat bez generatora — znormalizuj katastrofę do postaci z listą nisz.
    if (t.catastrophe && !t.catastrophe.niches) {
      var c = clone(t); c.catastrophe.niches = t.catastrophe.niche === 'all' ? NICHE_KEYS.slice() : [t.catastrophe.niche];
      return c;
    }
    return t;
  }
  function currentTurnEnv(data, state) { return turnEnv(data, state, state.eraIndex, state.turn); }
  function nextTurnEnv(data, state) {
    if (state.eraIndex >= data.ERAS.length) return null;
    var len = data.ERAS[state.eraIndex].turns.length;
    return state.turn + 1 < len ? turnEnv(data, state, state.eraIndex, state.turn + 1)
      : turnEnv(data, state, state.eraIndex + 1, 0);
  }
  /* Zwiastun: ogólnikowy sygnał, że w turze PO najbliższej nadejdzie katastrofa. */
  function upcomingOmen(data, state) {
    var nx = nextTurnEnv(data, state);
    if (!nx || !nx.catastrophe) return null;
    return nx.catastrophe.minor ? data.OMENS.minor : data.OMENS.extinction;
  }
  function catastropheHits(cat, niche) { return !!cat && cat.niches.indexOf(niche) !== -1; }
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
  function maxDefense(state, niche) {
    var m = 0;
    state.lineages.forEach(function (l) {
      if (l.alive && (!niche || l.niche === niche) && l.stats.defense > m) m = l.stats.defense;
    });
    return m;
  }
  function nichePopulation(state, niche) {
    return state.lineages.reduce(function (s, l) { return s + (l.alive && l.niche === niche ? l.population : 0); }, 0);
  }
  function lstat(stats, k) { return Math.max(0, stats[k] || 0); }

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
  /* Odrzucenie cechy — narząd szczątkowy. Nie można usunąć cechy, od której zależą inne. */
  function canDropTrait(data, state, traitId) {
    var a = getActiveLineage(state);
    if (!a) return { ok: false, error: 'Brak aktywnej linii.' };
    if (a.traits.indexOf(traitId) === -1) return { ok: false, error: 'Linia nie ma tej cechy.' };
    var byId = traitsById(data);
    var dependents = a.traits.filter(function (id) { return byId[id] && byId[id].requires.indexOf(traitId) !== -1; });
    if (dependents.length) return { ok: false, error: 'Zależą od niej inne cechy: ' + dependents.map(function (id) { return byId[id].name; }).join(', ') + '.' };
    var nicheReq = Object.keys(data.NICHES).filter(function (k) { return data.NICHES[k].requires === traitId && a.niche === k; });
    if (nicheReq.length) return { ok: false, error: 'Linia żyje w niszy, która wymaga tej cechy.' };
    if (state.ep < data.DROP_TRAIT_COST) return { ok: false, error: 'Za mało EP (potrzeba ' + data.DROP_TRAIT_COST + ').' };
    return { ok: true, error: null };
  }
  function dropTrait(data, state, traitId) {
    var can = canDropTrait(data, state, traitId);
    if (!can.ok) return { ok: false, state: state, error: can.error };
    var trait = traitsById(data)[traitId];
    var n = clone(state); var l = getActiveLineage(n);
    n.ep -= data.DROP_TRAIT_COST;
    l.traits.splice(l.traits.indexOf(traitId), 1);
    var neg = {}; for (var k in trait.effects) neg[k] = -trait.effects[k];
    applyEffects(l, neg);
    l.stats.metabolism = Math.max(1, l.stats.metabolism);
    unlockKnowledge(n, 'vestigial');
    var newAch = [];
    award(n, 'vestigial', newAch);
    return { ok: true, state: n, error: null, newAchievements: newAch };
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

  // ---------- Kompromisy zależne od sytuacji ----------
  function envForNiche(data, env, niche) {
    var cfg = data.NICHES[niche] || data.NICHES.woda;
    if (cfg.land) return { food: env.land.food, predators: env.land.predators };
    return { food: env.food * (cfg.foodMult || 1), predators: env.predators * (cfg.predMult || 1) };
  }
  function conditionMet(data, cond, lineage, env) {
    if (cond.niche && cond.niche.indexOf(lineage.niche) === -1) return false;
    if (cond.climate && (!env || cond.climate.indexOf(env.climate) === -1)) return false;
    if (cond.foodBelow != null && (!env || envForNiche(data, env, lineage.niche).food >= cond.foodBelow)) return false;
    if (cond.unlessTrait && lineage.traits.indexOf(cond.unlessTrait) !== -1) return false;
    return true;
  }
  /* Statystyki po uwzględnieniu warunkowych efektów cech w danej niszy i klimacie. */
  function effectiveStats(data, lineage, env) {
    var stats = clone(lineage.stats), notes = [];
    var byId = traitsById(data);
    lineage.traits.forEach(function (id) {
      var t = byId[id]; if (!t || !t.conditions) return;
      t.conditions.forEach(function (c) {
        if (!conditionMet(data, c, lineage, env)) return;
        for (var k in c.effects) stats[k] = (stats[k] || 0) + c.effects[k];
        notes.push({ traitId: id, traitName: t.name, note: c.note, effects: c.effects });
      });
    });
    return { stats: stats, notes: notes };
  }

  // ---------- Specjacja ----------
  function speciationCost(data, state) {
    return data.SPECIATION_COST + (data.SPECIATION_COST_STEP || 0) * Math.max(0, aliveLineages(state).length - 1);
  }
  function canSpeciate(data, state) {
    var a = getActiveLineage(state);
    var cost = speciationCost(data, state);
    if (!a) return { ok: false, error: 'Brak aktywnej linii.', cost: cost };
    if (state.ep < cost) return { ok: false, error: 'Za mało EP na specjację (potrzeba ' + cost + ').', cost: cost };
    if (a.population < data.MIN_SPECIATION_POP) return { ok: false, error: 'Za mała populacja do specjacji (min. ' + data.MIN_SPECIATION_POP + ').', cost: cost };
    return { ok: true, error: null, cost: cost };
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
    n.lineages.push(child); n.ep -= check.cost; n.activeLineageId = childId;
    n.maxAlive = Math.max(n.maxAlive || 1, aliveLineages(n).length);
    unlockKnowledge(n, 'speciation');
    return { ok: true, state: n, error: null };
  }

  // ---------- Mutacje ----------
  /* Spontaniczna mutacja (dryf) — bez wyboru gracza. */
  function rollMutation(l, rng, chance) {
    if (rng() > (chance == null ? 0.28 : chance)) return null;
    var keys = ['feeding', 'defense', 'reproduction', 'mobility', 'intelligence'];
    var key = keys[Math.floor(rng() * keys.length)];
    var beneficial = rng() < 0.6; var delta = beneficial ? 1 : -1;
    if (l.stats[key] + delta < 0) { delta = 1; beneficial = true; }
    l.stats[key] += delta;
    return { key: key, delta: delta, beneficial: beneficial, knowledge: beneficial ? 'mutation_good' : 'mutation_bad' };
  }
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
  function buildMutationOption(tpl, rng) {
    var effects = {}, a, b;
    if (tpl.build === 'plus1') { a = pick(MUTABLE_STATS, rng); effects[a] = 1; }
    else if (tpl.build === 'plus2minus1') {
      a = pick(MUTABLE_STATS, rng);
      if (rng() < 0.5) effects.metabolism = 1;
      else { var rest = MUTABLE_STATS.filter(function (k) { return k !== a; }); b = pick(rest, rng); effects[b] = -1; }
      effects[a] = 2;
    } else if (tpl.build === 'brain') { effects.intelligence = 1; effects.metabolism = 1; }
    return { kind: tpl.kind, label: tpl.label, effects: effects };
  }
  /* Oferta: trzy różne mutacje do wyboru dla jednej linii (albo odrzucenie). */
  function buildMutationOffer(data, n, rng) {
    var alive = aliveLineages(n); if (!alive.length) return null;
    var target = getActiveLineage(n); if (!target || !target.alive) target = alive[0];
    var tpls = data.MUTATION_TEMPLATES.slice();
    for (var i = tpls.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var tmp = tpls[i]; tpls[i] = tpls[j]; tpls[j] = tmp; }
    return { lineageId: target.id, options: tpls.slice(0, 3).map(function (t) { return buildMutationOption(t, rng); }) };
  }
  function chooseMutation(data, state, index) {
    if (!state.mutationOffer) return { ok: false, state: state, error: 'Brak oferty mutacji.' };
    var opt = state.mutationOffer.options[index];
    if (!opt) return { ok: false, state: state, error: 'Nieznana opcja.' };
    var n = clone(state); var l = getLineage(n, n.mutationOffer.lineageId);
    if (l && l.alive) {
      applyEffects(l, opt.effects);
      MUTABLE_STATS.concat(['intelligence']).forEach(function (k) { l.stats[k] = Math.max(0, l.stats[k]); });
      l.stats.metabolism = Math.max(1, l.stats.metabolism);
    }
    n.mutationOffer = null;
    unlockKnowledge(n, 'mutation_good');
    return { ok: true, state: n, error: null };
  }
  function rejectMutation(data, state) {
    if (!state.mutationOffer) return { ok: false, state: state, error: 'Brak oferty mutacji.' };
    var n = clone(state); n.mutationOffer = null; return { ok: true, state: n, error: null };
  }

  // ---------- Dynamika (współdzielona: symulacja + prognoza) ----------
  function computeDynamics(data, env, lineage, ctx) {
    ctx = ctx || {};
    var stats = effectiveStats(data, lineage, env).stats;
    var ne = envForNiche(data, env, lineage.niche);
    var baseFood = Math.max(0.5, ne.food - 0.5 * (ctx.rivalStrength || 0) + (ctx.foodBonus || 0));
    // Własne linie w tej samej niszy konkurują o ten sam pokarm.
    var food = baseFood / (1 + 0.25 * (ctx.crowd || 0));
    var predators = ne.predators + (ctx.predBonus || 0) + (ctx.predatorLevel || 0);
    predators = Math.max(0, predators * (ctx.predMult || 1));

    var climateMod = env.climate === 'zimno' ? 0.7 : (env.climate === 'cieplo' ? 1.1 : 1.0);
    if (env.climate === 'zimno' && lineage.traits.indexOf('endothermy') !== -1) climateMod = 1.0;
    var oxygenMod = clamp(1 + (10 - env.oxygen) * 0.04, 0.7, 1.4);

    var foodIntake = lstat(stats, 'feeding') * (food / 10) * climateMod;
    var upkeep = Math.max(1, stats.metabolism || 0) * oxygenMod;
    var energy = foodIntake - upkeep;
    var mobilityShield = lstat(stats, 'mobility') * 0.4;
    var predationPressure = Math.max(0, predators - lstat(stats, 'defense') - mobilityShield);
    var predationLossRate = clamp(predationPressure * 0.035, 0, 0.45);
    var starvationLossRate = energy < 0 ? clamp(-energy * 0.03, 0, 0.5) : 0;
    var birthRate = energy >= 0 ? clamp(0.03 * lstat(stats, 'reproduction') * (1 + energy * 0.05), 0, 0.6) : 0;

    // Pojemność środowiska — wspólna dla wszystkich własnych linii w niszy.
    var capacity = Math.max(40, Math.round(baseFood * data.CAPACITY_PER_FOOD));
    var nichePop = ctx.nichePop != null ? ctx.nichePop : lineage.population;
    var crowdFactor = clamp(1 - nichePop / capacity, 0, 1);
    birthRate *= crowdFactor;
    var capacityLossRate = nichePop > capacity ? clamp((nichePop - capacity) / nichePop * 0.6, 0, 0.5) : 0;

    return { energy: energy, predationPressure: predationPressure, food: food, predators: predators,
      predationLossRate: predationLossRate, starvationLossRate: starvationLossRate, birthRate: birthRate,
      capacity: capacity, crowdFactor: crowdFactor, capacityLossRate: capacityLossRate, stats: stats };
  }
  function contextFor(data, state, lineage, extra) {
    var diff = difficultyOf(data, state);
    var levels = state.predatorLevels || {};
    var rival = state.rivals && state.rivals[lineage.niche];
    var others = state.lineages.filter(function (o) { return o.alive && o.id !== lineage.id && o.niche === lineage.niche; });
    var ctx = {
      predatorLevel: levels[lineage.niche] != null ? levels[lineage.niche] : (state.predatorLevel || 0),
      predMult: diff.predMult,
      rivalStrength: rival ? rival.strength : 0,
      crowd: others.length,
      nichePop: lineage.population + others.reduce(function (s, o) { return s + o.population; }, 0)
    };
    if (extra) { ctx.foodBonus = extra.foodBonus || 0; ctx.predBonus = extra.predBonus || 0; }
    return ctx;
  }

  /* Prognoza „co-jeśli” — bez mutacji i zdarzeń losowych, z koewolucją, rywalami i pojemnością. */
  function forecast(data, state, lineage) {
    var env = currentTurnEnv(data, state);
    if (!env) return null;
    var d = computeDynamics(data, env, lineage, contextFor(data, state, lineage));
    var pop = lineage.population;
    var births = Math.round(pop * d.birthRate);
    var predD = Math.round(pop * d.predationLossRate);
    var starvD = Math.round(pop * d.starvationLossRate);
    var capD = Math.round(pop * d.capacityLossRate);
    var proj = Math.max(0, pop + births - predD - starvD - capD);
    var cat = catastropheHits(env.catastrophe, lineage.niche) ? env.catastrophe : null;
    return { energy: round1(d.energy), predationPressure: round1(d.predationPressure),
      births: births, predationDeaths: predD, starvationDeaths: starvD, capacityDeaths: capD,
      capacity: d.capacity, projectedPop: proj, delta: proj - pop, catastrophe: cat,
      bottleneckRisk: proj < data.MIN_VIABLE_POP * 2 };
  }

  // ---------- Osiągnięcia ----------
  function award(n, id, list) {
    if (!n.achievements) n.achievements = [];
    if (n.achievements.indexOf(id) !== -1) return false;
    n.achievements.push(id); if (list) list.push(id); return true;
  }

  // ---------- Symulacja tury ----------
  function simulateTurn(data, state, rngArg) {
    if (state.status !== 'playing') return { state: state, report: null };
    var n = clone(state);
    var rng = rngArg || rngFrom(n);
    var era = data.ERAS[n.eraIndex];
    var env = currentTurnEnv(data, n);
    var diff = difficultyOf(data, n);
    var newAch = [];

    // Niewybrana oferta mutacji przepada; nieukończony quiz też.
    n.mutationOffer = null;
    n.pendingQuiz = null;

    var knowledge = [];
    var lineReports = [];
    var anyAlive = false;

    // Pozytywne zdarzenie losowe (gdy brak katastrofy).
    var event = null;
    if (!env.catastrophe && rng() < 0.22 && data.POSITIVE_EVENTS.length) {
      event = data.POSITIVE_EVENTS[Math.floor(rng() * data.POSITIVE_EVENTS.length)];
      knowledge.push(event.knowledge || 'events');
    }
    var ctxExtra = event ? { foodBonus: event.foodBonus || 0, predBonus: event.predBonus || 0 } : null;

    // Konteksty liczone przed zmianami (migawka populacji nisz).
    var alive = aliveLineages(n);
    var contexts = alive.map(function (l) { return contextFor(data, n, l, ctxExtra); });
    alive.forEach(function (l, i) {
      var r = simulateLineage(data, n, l, env, rng, knowledge, contexts[i], diff, newAch);
      lineReports.push(r); if (l.alive) anyAlive = true;
    });

    // EP globalne: premia bazowa, inteligencja (raz — najlepsza linia), kolonizacja.
    var survivors = aliveLineages(n);
    var globalEp = {
      base: anyAlive ? data.EP_BASE : 0,
      intelligence: anyAlive ? Math.floor(maxIntelligence(n) / 2) : 0,
      colonize: 0
    };
    survivors.forEach(function (l) {
      if (n.visitedNiches.indexOf(l.niche) === -1) { n.visitedNiches.push(l.niche); globalEp.colonize += data.EP_COLONIZE; }
    });
    var lineEp = lineReports.reduce(function (s, r) { return s + r.epGain; }, 0);
    var totalEp = lineEp + globalEp.base + globalEp.intelligence + globalEp.colonize;
    n.ep += totalEp;

    // Koewolucja per nisza: drapieżniki „doganiają” najlepiej bronioną linię w niszy.
    var oldLevels = n.predatorLevels || {};
    n.predatorLevels = {};
    NICHE_KEYS.forEach(function (k) {
      var def = maxDefense(n, k);
      var target = def > 0 ? Math.max(0, (def - data.BASE_STATS.defense) * 0.7) * diff.coevo : 0;
      var cur = oldLevels[k] || 0;
      n.predatorLevels[k] = round1(clamp(cur + (target - cur) * 0.35, 0, 12) * 10) / 10;
    });
    n.predatorLevel = Math.max.apply(null, NICHE_KEYS.map(function (k) { return n.predatorLevels[k]; }));
    if (n.predatorLevel > 2) unlockKnowledge(n, 'coevolution');

    // Rywale rosną; katastrofa osłabia także ich.
    Object.keys(n.rivals || {}).forEach(function (k) {
      var rv = n.rivals[k];
      rv.strength = round1(rv.strength + data.RIVAL_GROWTH);
      if (catastropheHits(env.catastrophe, k)) rv.strength = round1(Math.max(0, rv.strength * (1 - env.catastrophe.severity)));
    });

    if (env.catastrophe) knowledge.push(env.catastrophe.knowledge || 'extinction');

    // Osiągnięcia zależne od tury.
    var prevEraIndex = n.eraIndex;
    if (prevEraIndex === 0 && survivors.some(function (l) { return l.niche === 'lad'; })) award(n, 'first_land', newAch);
    if (n.visitedNiches.length >= NICHE_KEYS.length) award(n, 'all_niches', newAch);
    if (survivors.some(function (l) { return l.niche === 'powietrze'; })) award(n, 'flyer', newAch);
    n.maxAlive = Math.max(n.maxAlive || 1, survivors.length);
    if (survivors.length >= 4) award(n, 'diverse', newAch);
    if (env.catastrophe && /permsk/i.test(env.catastrophe.name) && anyAlive &&
        lineReports.every(function (r) { return r.alive; })) award(n, 'permian', newAch);
    if (env.catastrophe && /K–Pg/.test(env.catastrophe.name) && anyAlive) award(n, 'kpg', newAch);

    knowledge.forEach(function (k) { unlockKnowledge(n, k); });

    n.turn += 1;
    var eraChanged = false, finishedEraId = era.id;
    if (n.turn >= era.turns.length) {
      if (n.eraIndex < data.ERAS.length - 1) {
        n.eraIndex += 1; n.turn = 0; eraChanged = true; unlockKnowledge(n, 'milestone');
        n.rivals = rivalsForEra(data, n.eraIndex);
      } else n.eraIndex = data.ERAS.length;
    }
    n.status = evaluateStatus(n, data);
    if (n.status === 'won') {
      n.wonAtTurn = globalTurn(data, Math.min(n.eraIndex, data.ERAS.length), n.turn);
      var winner = winningLineage(n, data);
      if (winner && winner.traits.indexOf('shell') === -1) award(n, 'pacifist', newAch);
    }

    // Quiz po zakończonej erze (także na sam koniec gry).
    var eraFinished = eraChanged || n.eraIndex >= data.ERAS.length;
    if (eraFinished && data.QUIZZES && data.QUIZZES[finishedEraId] && !n.quizzes[finishedEraId] && anyAlive) {
      n.pendingQuiz = { eraId: finishedEraId, answers: [] };
    }

    // Oferta mutacji do wyboru (tylko gdy gra trwa).
    if (n.status === 'playing' && anyAlive && rng() < data.MUTATION_OFFER_CHANCE) {
      n.mutationOffer = buildMutationOffer(data, n, rng);
    }

    var report = {
      eraIndex: prevEraIndex, eraName: era.name, turnIndex: state.turn,
      globalTurn: globalTurn(data, prevEraIndex, state.turn),
      envTitle: env.title, envNote: env.note, climate: env.climate,
      catastrophe: env.catastrophe || null,
      event: event ? { name: event.name, desc: event.desc } : null,
      lineReports: lineReports, epGain: totalEp, epBase: globalEp.base, globalEp: globalEp,
      predatorLevel: round1(n.predatorLevel),
      totalPopulation: totalPopulation(n), maxIntelligence: maxIntelligence(n),
      intelligenceGoal: n.intelligenceGoal, eraChanged: eraChanged,
      newEraName: eraChanged ? data.ERAS[n.eraIndex].name : null,
      newEraIndex: eraChanged ? n.eraIndex : null,
      knowledge: dedupe(knowledge), status: n.status,
      newAchievements: newAch, mutationOffer: !!n.mutationOffer, quiz: n.pendingQuiz ? n.pendingQuiz.eraId : null
    };
    n.history.push(report);
    return { state: n, report: report };
  }

  function simulateLineage(data, n, l, env, rng, knowledge, ctx, diff, newAch) {
    var events = [];
    var mut = rollMutation(l, rng, data.DRIFT_MUTATION_CHANCE);
    if (mut) {
      events.push((mut.beneficial ? 'Korzystna' : 'Szkodliwa') + ' mutacja spontaniczna: ' + statLabel(mut.key) + ' ' + (mut.delta > 0 ? '+1' : '-1') + '.');
      knowledge.push(mut.knowledge);
    }
    var popBefore = l.population;
    var d = computeDynamics(data, env, l, ctx);
    var births = Math.round(popBefore * d.birthRate);
    var predationDeaths = Math.round(popBefore * d.predationLossRate);
    var starvationDeaths = Math.round(popBefore * d.starvationLossRate);
    var capacityDeaths = Math.round(popBefore * d.capacityLossRate);
    var pop = popBefore + births - predationDeaths - starvationDeaths - capacityDeaths;

    var catDeaths = 0, catHit = false;
    if (catastropheHits(env.catastrophe, l.niche)) {
      catHit = true;
      var sev = clamp(env.catastrophe.severity * diff.catMult, 0, 0.95);
      catDeaths = Math.round(Math.max(0, pop) * sev);
      pop -= catDeaths;
      events.push('Katastrofa (' + env.catastrophe.name + ') — ciężkie straty.');
    }

    pop = Math.max(0, Math.round(pop));
    var bottleneckDeaths = 0;
    if (pop > 0 && pop < data.MIN_VIABLE_POP) {
      bottleneckDeaths = pop; pop = 0;
      events.push('Wąskie gardło: populacja zbyt mała, by się utrzymać.');
      knowledge.push('bottleneck');
    }
    l.population = pop; l.popHistory.push(pop);
    if (pop > l.peakPopulation) l.peakPopulation = pop;
    if (l.minPopulation == null || (pop > 0 && pop < l.minPopulation)) l.minPopulation = pop;
    if (pop > 150 && l.minPopulation < 30) award(n, 'phoenix', newAch);

    if (d.predationLossRate > 0.15) { events.push('Silna presja drapieżników.'); knowledge.push('predation'); }
    if (d.starvationLossRate > 0) { events.push('Ujemny bilans energetyczny — głód.'); knowledge.push('starvation'); }
    if (d.capacityLossRate > 0 || d.crowdFactor < 0.35) { events.push('Nisza jest przeludniona — brakuje zasobów.'); knowledge.push('capacity'); }
    if (ctx.rivalStrength >= 2) knowledge.push('competition');
    if (env.climate === 'zimno') knowledge.push('cold');
    if (l.niche !== 'woda') knowledge.push('niche');
    var notes = effectiveStats(data, l, env).notes;
    if (notes.length) knowledge.push('tradeoff');

    if (pop <= 0 && l.alive) {
      l.alive = false; l.extinctGlobalTurn = globalTurn(data, n.eraIndex, n.turn) + 1;
      events.push('Ta linia wymarła.');
    }

    var catSurvived = catHit && pop > 0;
    if (catSurvived) n.catastrophesSurvived = (n.catastrophesSurvived || 0) + 1;

    // Rozbicie EP — czytelne, skąd pochodzą punkty.
    var growth = pop - popBefore;
    var bd = {
      growth: pop > 0 ? Math.max(0, Math.floor(growth / 15)) : 0,
      population: pop > 0 ? Math.floor(pop / 150) : 0,
      niche: pop > 0 ? (data.NICHES[l.niche].epBonus || 0) : 0,
      catastrophe: catSurvived ? data.EP_CATASTROPHE_SURVIVED : 0
    };
    var epGain = bd.growth + bd.population + bd.niche + bd.catastrophe;

    return {
      lineageId: l.id, name: l.name, niche: l.niche,
      popBefore: popBefore, popAfter: pop,
      births: births, predationDeaths: predationDeaths, starvationDeaths: starvationDeaths,
      capacityDeaths: capacityDeaths, catDeaths: catDeaths, bottleneckDeaths: bottleneckDeaths,
      capacity: d.capacity, rivalStrength: ctx.rivalStrength || 0,
      energy: round1(d.energy), intelligence: lstat(l.stats, 'intelligence'),
      tradeoffs: notes, epGain: epGain, epBreakdown: bd, alive: l.alive, events: events
    };
  }

  function winningLineage(n, data) {
    var win = null;
    n.lineages.forEach(function (l) {
      if (l.alive && l.stats.intelligence >= n.intelligenceGoal &&
          (!data.WIN_TRAIT || l.traits.indexOf(data.WIN_TRAIT) !== -1)) win = win || l;
    });
    return win;
  }
  function evaluateStatus(n, data) {
    if (totalPopulation(n) <= 0) return 'lost';
    if (winningLineage(n, data)) return 'won';
    if (n.eraIndex >= data.ERAS.length) return 'survived';
    return 'playing';
  }
  /* Postęp do celu: inteligencja i czy spełniony próg kultury (cecha WIN_TRAIT). */
  function goalProgress(data, state) {
    var best = null;
    aliveLineages(state).forEach(function (l) { if (!best || l.stats.intelligence > best.stats.intelligence) best = l; });
    return { intelligence: maxIntelligence(state), goal: state.intelligenceGoal,
      hasWinTrait: aliveLineages(state).some(function (l) { return l.traits.indexOf(data.WIN_TRAIT) !== -1; }) };
  }

  // ---------- Quiz po erze ----------
  function answerQuiz(data, state, qIndex, choice) {
    var pq = state.pendingQuiz;
    if (!pq) return { ok: false, state: state, error: 'Brak quizu.' };
    var q = data.QUIZZES[pq.eraId][qIndex];
    if (!q) return { ok: false, state: state, error: 'Nieznane pytanie.' };
    if (pq.answers[qIndex] != null) return { ok: false, state: state, error: 'Już odpowiedziano.' };
    var n = clone(state);
    var correct = choice === q.answer;
    n.pendingQuiz.answers[qIndex] = choice;
    if (correct && n.status === 'playing') n.ep += data.QUIZ_EP;
    return { ok: true, state: n, correct: correct, explain: q.explain, error: null };
  }
  function finishQuiz(data, state) {
    var pq = state.pendingQuiz;
    if (!pq) return { ok: false, state: state, error: 'Brak quizu.' };
    var n = clone(state), qs = data.QUIZZES[pq.eraId];
    var correct = qs.filter(function (q, i) { return pq.answers[i] === q.answer; }).length;
    n.quizzes[pq.eraId] = { correct: correct, total: qs.length };
    var newAch = [];
    if (correct === qs.length) award(n, 'scholar', newAch);
    n.pendingQuiz = null;
    return { ok: true, state: n, correct: correct, total: qs.length, newAchievements: newAch, error: null };
  }

  // ---------- Wynik punktowy ----------
  function computeScore(data, state) {
    var parts = [];
    function add(label, pts) { if (pts) parts.push({ label: label, points: Math.round(pts) }); }
    if (state.status === 'won') {
      add('Zwycięstwo — gatunek rozumny', 500);
      if (state.wonAtTurn != null) add('Szybkość (pozostałe tury)', Math.max(0, totalTurns(data) - state.wonAtTurn) * 15);
    } else if (state.status === 'survived') add('Przetrwanie wszystkich er', 200);
    add('Zajęte nisze', (state.visitedNiches || []).length * 40);
    add('Najwięcej żywych linii naraz', (state.maxAlive || 1) * 30);
    add('Przetrwane uderzenia katastrof', (state.catastrophesSurvived || 0) * 25);
    add('Najwyższa inteligencja', maxIntelligence(state) * 10);
    add('Karty wiedzy', state.unlockedKnowledge.length * 10);
    add('Osiągnięcia', (state.achievements || []).length * 50);
    var quizPts = 0; Object.keys(state.quizzes || {}).forEach(function (k) { quizPts += state.quizzes[k].correct * 20; });
    add('Poprawne odpowiedzi w quizach', quizPts);
    return { total: parts.reduce(function (s, p) { return s + p.points; }, 0), parts: parts };
  }

  function statLabel(k) {
    return ({ feeding: 'odżywianie', defense: 'obrona', reproduction: 'rozród',
      mobility: 'mobilność', metabolism: 'metabolizm', intelligence: 'inteligencja' })[k] || k;
  }

  return {
    NICHE_KEYS: NICHE_KEYS,
    createInitialState: createInitialState, generateWorld: generateWorld,
    currentEra: currentEra, currentTurnEnv: currentTurnEnv, nextTurnEnv: nextTurnEnv, turnEnv: turnEnv,
    upcomingOmen: upcomingOmen, catastropheHits: catastropheHits,
    globalTurn: globalTurn, totalTurns: totalTurns, difficultyOf: difficultyOf,
    getLineage: getLineage, getActiveLineage: getActiveLineage, aliveLineages: aliveLineages,
    totalPopulation: totalPopulation, maxIntelligence: maxIntelligence, maxDefense: maxDefense,
    nichePopulation: nichePopulation, setActiveLineage: setActiveLineage,
    availableNiches: availableNiches, canMigrate: canMigrate, migrateLineage: migrateLineage,
    traitStatus: traitStatus, prerequisitesMet: prerequisitesMet, eraUnlocked: eraUnlocked,
    buyTrait: buyTrait, canDropTrait: canDropTrait, dropTrait: dropTrait,
    effectiveStats: effectiveStats, envForNiche: envForNiche,
    speciationCost: speciationCost, canSpeciate: canSpeciate, speciate: speciate,
    chooseMutation: chooseMutation, rejectMutation: rejectMutation,
    answerQuiz: answerQuiz, finishQuiz: finishQuiz, computeScore: computeScore, goalProgress: goalProgress,
    forecast: forecast, simulateTurn: simulateTurn, evaluateStatus: evaluateStatus, statLabel: statLabel,
    contextFor: contextFor,
    _internals: { rollMutation: rollMutation, clamp: clamp, computeDynamics: computeDynamics, rngFrom: rngFrom,
      buildMutationOffer: buildMutationOffer }
  };
});
