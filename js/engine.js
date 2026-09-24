/*
 * engine.js — silnik symulacji (czysta logika gry).
 *
 * ZALOZENIA.md sekcja 9: logika oddzielona od UI, testowalna, bez DOM.
 * Model 2.0 (GAMEPLAY.md): cechy mają CZĘSTOŚĆ w populacji; nowe pojawiają się
 * jako losowe mutacje (draft), a dobór naturalny i dryf genetyczny zmieniają ich
 * częstość. Świat (warunki tur, zdarzenia) jest losowany z ziarna — odtwarzalny.
 *
 * Funkcje mutujące zwracają NOWY stan (kopię) — tryb nauczyciela cofa akcje.
 * Losowość pochodzi z generatora zapisanego w stanie (rngState), więc cofnięcie
 * i ponowienie akcji daje ten sam wynik.
 */
(function (root, factory) {
  var engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.Engine = engine;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STAT_KEYS = ['feeding', 'defense', 'reproduction', 'mobility', 'metabolism', 'intelligence'];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function round2(v) { return Math.round(v * 100) / 100; }
  function dedupe(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }

  var traitCache = null, traitCacheSrc = null;
  function traitsById(data) {
    if (traitCacheSrc !== data.TRAITS) {
      traitCache = {}; data.TRAITS.forEach(function (t) { traitCache[t.id] = t; }); traitCacheSrc = data.TRAITS;
    }
    return traitCache;
  }

  // ---------- Losowość (mulberry32) ----------
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Generator, który zapisuje swój stan w obiekcie stanu gry (odtwarzalność).
  function stateRng(n) {
    return function () {
      n.rngState = (n.rngState + 0x6D2B79F5) | 0;
      var t = n.rngState;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Kod rozgrywki (tekst lub liczba) → ziarno.
  function seedFromCode(code) {
    var s = String(code == null ? '' : code).trim().toUpperCase();
    if (/^\d+$/.test(s)) return (parseInt(s, 10) >>> 0);
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function randomSeed() { return Math.floor(Math.random() * 999999) + 1; }
  function dailySeed(date) {
    var d = date || new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  // ---------- Świat (losowany z ziarna) ----------
  function generateWorld(data, seed) {
    var rng = mulberry(seed ^ 0x9E3779B9);
    var j = function () { return Math.floor(rng() * 3) - 1; };
    var nicheKeys = Object.keys(data.NICHES);
    var envs = [];
    data.ERAS.forEach(function (era, ei) {
      era.turns.forEach(function (t, ti) {
        var rivals = {};
        nicheKeys.forEach(function (k) {
          rivals[k] = (t.rivals && t.rivals[k] != null) ? t.rivals[k] : (era.rivalBase[k] || 0);
        });
        var env = {
          eraIndex: ei, turn: ti, title: t.title, note: t.note, climate: t.climate,
          oxygen: Math.max(5, t.oxygen + j()), food: Math.max(4, t.food + j()),
          predators: Math.max(1, t.predators + j()),
          land: { food: Math.max(2, t.land.food + j()), predators: Math.max(0, t.land.predators + j()) },
          catastrophe: t.catastrophe || null, event: null, rivals: rivals
        };
        var roll = rng(), pick = rng(), nichePick = rng();
        if (!env.catastrophe && ti > 0 && roll < data.EVENT_CHANCE) {
          var pool = data.EVENTS.filter(function (e) { return !(e.climate && e.climate === env.climate); });
          var ev = pool[Math.floor(pick * pool.length)];
          var niche = ev.niche === 'random' ? nicheKeys[Math.floor(nichePick * nicheKeys.length)] : (ev.niche || null);
          env.event = { id: ev.id, niche: niche };
        }
        envs.push(env);
      });
    });
    return envs;
  }
  function eventDef(data, env) {
    if (!env || !env.event) return null;
    for (var i = 0; i < data.EVENTS.length; i++) if (data.EVENTS[i].id === env.event.id) return data.EVENTS[i];
    return null;
  }

  function globalTurn(data, eraIndex, turn) {
    var g = 0; for (var i = 0; i < eraIndex && i < data.ERAS.length; i++) g += data.ERAS[i].turns.length; return g + turn;
  }
  function totalTurns(data) { return data.ERAS.reduce(function (s, e) { return s + e.turns.length; }, 0); }

  // ---------- Linie ----------
  function makeLineage(id, name, parentId, population, genes, niche, bornEra, bornTurn) {
    return {
      id: id, name: name, parentId: parentId,
      population: population, peakPopulation: population,
      genes: clone(genes), niche: niche || 'woda',
      alive: true, bornEra: bornEra, bornTurn: bornTurn, extinctGlobalTurn: null,
      popHistory: [population], draft: [], picksUsed: 0, migrated: false
    };
  }

  /*
   * opts: { difficulty, startEra, startZg, goal, startTraits, startNiche, scenarioId, seed }
   */
  function createInitialState(data, speciesName, opts) {
    opts = opts || {};
    var diffKey = data.DIFFICULTIES[opts.difficulty] ? opts.difficulty : 'normalny';
    var diff = data.DIFFICULTIES[diffKey];
    var startEra = opts.startEra || 0;
    var seed = (opts.seed != null ? opts.seed : randomSeed()) >>> 0;
    var byId = traitsById(data);

    var genes = [];
    (opts.startTraits || []).forEach(function (id) { if (byId[id]) genes.push({ id: id, f: 1 }); });
    var root = makeLineage('L0', speciesName || 'Prazwierzę', null, data.START_POPULATION, genes,
      opts.startNiche || 'woda', startEra, 0);

    var envs = generateWorld(data, seed);
    var first = envs[globalTurn(data, startEra, 0)];
    var s = {
      version: 5,
      seed: seed, rngState: (seed ^ 0xA5A5A5A5) | 0,
      difficulty: diffKey,
      scenario: opts.scenarioId || 'full',
      startEra: startEra, eraIndex: startEra, turn: 0,
      totalTurns: totalTurns(data),
      zg: opts.startZg != null ? opts.startZg : diff.startZg,
      intelligenceGoal: opts.goal != null ? opts.goal : diff.goal,
      predatorLevel: 0,
      rivals: clone(first.rivals),
      envs: envs,
      lineages: [root],
      activeLineageId: 'L0',
      nextLineageNum: 1,
      unlockedKnowledge: ['intro', 'no_goal'],
      objectivesDone: [],
      quizPending: null, quizResults: {},
      nichesEver: [root.niche],
      turnsSurvived: 0, peakTotalPop: root.population,
      status: 'playing',
      history: []
    };
    rollDraft(data, s, root, stateRng(s));
    return s;
  }

  // ---------- Ery / środowisko ----------
  function currentEra(data, state) { return data.ERAS[Math.min(state.eraIndex, data.ERAS.length - 1)]; }
  function difficultyOf(data, state) { return data.DIFFICULTIES[state.difficulty] || data.DIFFICULTIES.normalny; }
  function currentGlobalTurn(data, state) { return globalTurn(data, state.eraIndex, state.turn); }
  function currentTurnEnv(data, state) {
    if (state.eraIndex >= data.ERAS.length) return null;
    return state.envs[currentGlobalTurn(data, state)] || null;
  }
  /* Środowisko za `k` tur (0 = najbliższa tura). */
  function peekEnv(data, state, k) {
    if (state.eraIndex >= data.ERAS.length) return null;
    return state.envs[currentGlobalTurn(data, state) + (k || 0)] || null;
  }

  // Warunki niszy w danej turze (z uwzględnieniem zdarzenia).
  function nicheEnv(data, env, niche) {
    var cfg = data.NICHES[niche] || data.NICHES.woda;
    var base = cfg.land ? { food: env.land.food, predators: env.land.predators }
      : { food: env.food * (cfg.foodMult || 1), predators: env.predators * (cfg.predMult || 1) };
    var out = { food: base.food, predators: base.predators, oxygen: env.oxygen, climate: env.climate };
    var ev = eventDef(data, env);
    if (ev) {
      var applies = !env.event.niche || env.event.niche === niche;
      if (applies) {
        out.food += ev.foodBonus || 0;
        out.predators += ev.predBonus || 0;
      }
      out.oxygen += ev.oxygenBonus || 0;
      if (ev.climate) out.climate = ev.climate;
    }
    out.food = Math.max(0, out.food); out.predators = Math.max(0, out.predators);
    return out;
  }
  function conditionsFor(niche, ne) {
    var c = {}; c[niche] = true; c[ne.climate] = true;
    if (ne.oxygen <= 8) c.niskiO2 = true;
    return c;
  }
  function catastropheHits(cat, niche) {
    if (!cat) return false;
    return cat.niches === 'all' || (cat.niches && cat.niches.indexOf(niche) !== -1);
  }

  // ---------- Dostęp do linii ----------
  function getLineage(state, id) {
    for (var i = 0; i < state.lineages.length; i++) if (state.lineages[i].id === id) return state.lineages[i];
    return null;
  }
  function getActiveLineage(state) { return getLineage(state, state.activeLineageId); }
  function aliveLineages(state) { return state.lineages.filter(function (l) { return l.alive; }); }
  function totalPopulation(state) { return state.lineages.reduce(function (s, l) { return s + (l.alive ? l.population : 0); }, 0); }
  function setActiveLineage(state, id) {
    var l = getLineage(state, id); if (!l || !l.alive) return state;
    var n = clone(state); n.activeLineageId = id; return n;
  }

  // ---------- Geny ----------
  function geneOf(lineage, id) {
    for (var i = 0; i < lineage.genes.length; i++) if (lineage.genes[i].id === id) return lineage.genes[i];
    return null;
  }
  function geneFreq(lineage, id) { var g = geneOf(lineage, id); return g ? g.f : 0; }
  function isEstablished(data, lineage, id) { return geneFreq(lineage, id) >= data.GENETICS.establishedAt; }
  function isFixed(lineage, id) { return geneFreq(lineage, id) >= 1; }

  /*
   * Efektywne statystyki: baza + Σ częstość · (efekty + efekty warunkowe).
   * override {id, f} — hipotetyczna częstość jednej cechy (do liczenia doboru).
   */
  function effectiveStats(data, lineage, conds, override) {
    var byId = traitsById(data);
    var st = {}; STAT_KEYS.forEach(function (k) { st[k] = data.BASE_STATS[k] || 0; });
    var seen = false;
    function add(t, f) {
      if (!t || f <= 0) return;
      var k;
      for (k in t.effects) st[k] += f * t.effects[k];
      if (t.cond && conds) for (var c in t.cond) if (conds[c]) for (k in t.cond[c]) st[k] += f * t.cond[c][k];
    }
    lineage.genes.forEach(function (g) {
      var f = g.f;
      if (override && override.id === g.id) { f = override.f; seen = true; }
      add(byId[g.id], f);
    });
    if (override && !seen) add(byId[override.id], override.f);
    return st;
  }
  function resistance(data, lineage, kind, override) {
    var byId = traitsById(data), r = 0, seen = false;
    lineage.genes.forEach(function (g) {
      var t = byId[g.id], f = g.f;
      if (override && override.id === g.id) { f = override.f; seen = true; }
      if (t && t.resist && t.resist[kind]) r += f * t.resist[kind];
    });
    if (override && !seen) { var t2 = byId[override.id]; if (t2 && t2.resist && t2.resist[kind]) r += override.f * t2.resist[kind]; }
    return clamp(r, -0.5, 0.75);
  }
  function lineageIntelligence(data, lineage) {
    return round1(effectiveStats(data, lineage, null).intelligence);
  }
  function maxIntelligence(data, state) {
    var m = 0;
    state.lineages.forEach(function (l) { if (l.alive) m = Math.max(m, lineageIntelligence(data, l)); });
    return m;
  }
  function competitiveAbility(st) {
    return Math.max(0.5, Math.max(0, st.feeding) + 0.5 * Math.max(0, st.mobility) + 0.5 * Math.max(0, st.intelligence));
  }

  // ---------- Kontekst tury (konkurencja, koewolucja) ----------
  function buildContext(data, state, env) {
    var diff = difficultyOf(data, state);
    var ctx = { predatorLevel: state.predatorLevel || 0, predMult: diff.predMult, rivals: {}, kin: {} };
    Object.keys(data.NICHES).forEach(function (k) { ctx.rivals[k] = (state.rivals[k] || 0) * diff.rivalMult; ctx.kin[k] = []; });
    aliveLineages(state).forEach(function (l) {
      var ne = nicheEnv(data, env, l.niche);
      ctx.kin[l.niche].push({ id: l.id, comp: competitiveAbility(effectiveStats(data, l, conditionsFor(l.niche, ne))), pop: l.population });
    });
    return ctx;
  }
  function rivalFor(ctx, lineage) {
    var r = ctx.rivals[lineage.niche] || 0;
    (ctx.kin[lineage.niche] || []).forEach(function (k) { if (k.id !== lineage.id) r += 0.5 * k.comp; });
    return r;
  }
  function nichePopulation(ctx, lineage, ownPop) {
    var n = ownPop;
    (ctx.kin[lineage.niche] || []).forEach(function (k) { if (k.id !== lineage.id) n += k.pop; });
    return n;
  }

  /* Dynamika populacji — współdzielona przez symulację, prognozę i dobór. */
  function computeDynamics(data, lineage, ne, ctx, override) {
    var st = effectiveStats(data, lineage, conditionsFor(lineage.niche, ne), override);
    var comp = competitiveAbility(st);
    var rival = rivalFor(ctx, lineage);
    var compFactor = 1 - 0.45 * rival / (rival + comp);
    var food = ne.food * compFactor;
    var intel = Math.max(0, st.intelligence);

    // Zimno spowalnia zmiennocieplnych; stałocieplność (coldShield) znosi tę karę.
    var climateMod = 1.05;
    if (ne.climate !== 'cieplo') {
      var penalty = ne.climate === 'zimno' ? 0.28 : 0.1;
      climateMod = 1 - penalty * (1 - Math.min(1, coldShield(data, lineage, override)));
    }
    var oxygenMod = clamp(1 + (10 - ne.oxygen) * 0.05, 0.75, 1.4);
    // Mobilność poszerza zasięg żerowania, spryt zwiększa jego skuteczność.
    var foodIntake = Math.max(0, st.feeding) * (food / 10) * climateMod * (1 + 0.04 * intel + 0.02 * Math.max(0, st.mobility));
    var upkeep = Math.max(0.5, st.metabolism) * oxygenMod;
    var energy = foodIntake - upkeep;

    var predators = Math.max(0, (ne.predators + (ctx.predatorLevel || 0)) * (ctx.predMult || 1));
    var predationPressure = Math.max(0, predators - Math.max(0, st.defense) - 0.4 * Math.max(0, st.mobility) - 0.2 * intel);
    var predationLossRate = clamp(predationPressure * 0.035, 0, 0.45);
    var buffer = 1 / (1 + 0.06 * intel); // bufor poznawczy
    var starvationLossRate = energy < 0 ? clamp(-energy * 0.04, 0, 0.5) * buffer : 0;
    // Nadwyżka energii pomaga coraz słabiej (malejące przychody).
    var birthRate = energy >= 0 ? clamp(0.03 * Math.max(0, st.reproduction) * (1 + 0.6 * energy / (energy + 4)), 0, 0.6) : 0;
    // Pojemność niszy: pokarm (po konkurencji); spryt pozwala lepiej wykorzystać zasoby.
    var capacity = Math.max(40, food * 60 * (1 + 0.03 * intel));
    return {
      stats: st, energy: energy, food: food, compFactor: compFactor, rival: rival,
      predationPressure: predationPressure, predationLossRate: predationLossRate,
      starvationLossRate: starvationLossRate, birthRate: birthRate, capacity: capacity, intel: intel,
      r: birthRate - predationLossRate - starvationLossRate
    };
  }
  function coldShield(data, lineage, override) {
    var byId = traitsById(data), v = 0, seen = false;
    lineage.genes.forEach(function (g) {
      var f = (override && override.id === g.id) ? (seen = true, override.f) : g.f;
      var t = byId[g.id]; if (t && t.coldShield) v += f * t.coldShield;
    });
    if (override && !seen) { var t2 = byId[override.id]; if (t2 && t2.coldShield) v += override.f * t2.coldShield; }
    return v;
  }

  /* Współczynnik selekcji cechy w danych warunkach (>0 — cecha się rozprzestrzenia). */
  function selectionCoefficient(data, lineage, traitId, ne, ctx, cat, catMult) {
    var G = data.GENETICS;
    // Dostosowanie = tempo wzrostu (r) + zdolność konkurencyjna (ln K).
    var d1 = computeDynamics(data, lineage, ne, ctx, { id: traitId, f: 1 });
    var d0 = computeDynamics(data, lineage, ne, ctx, { id: traitId, f: 0 });
    var s = ((d1.r - d0.r) + G.capacityWeight * Math.log(d1.capacity / d0.capacity)) * G.selectionScale;
    if (cat && catastropheHits(cat, lineage.niche)) {
      var t = traitsById(data)[traitId];
      var res = (t && t.resist && t.resist[cat.kind]) || 0;
      s += res * cat.severity * (catMult || 1) * 3;
    }
    return clamp(s, -G.maxS, G.maxS);
  }

  /* Prognoza dla aktywnych warunków: kierunek doboru cechy (bez dryfu). */
  function predictSelection(data, state, lineage, traitId) {
    var env = currentTurnEnv(data, state);
    if (!env) return 0;
    var ctx = buildContext(data, state, env);
    var ne = nicheEnv(data, env, lineage.niche);
    return round2(selectionCoefficient(data, lineage, traitId, ne, ctx, env.catastrophe, difficultyOf(data, state).catMult));
  }

  // ---------- Draft mutacji ----------
  function eraUnlocked(state, trait) { return (trait.minEra == null) || (state.eraIndex >= trait.minEra); }
  function prerequisitesMet(data, lineage, trait) {
    for (var i = 0; i < trait.requires.length; i++) if (!isEstablished(data, lineage, trait.requires[i])) return false;
    return true;
  }
  function excludedBy(lineage, trait) {
    if (!trait.excludes) return null;
    for (var i = 0; i < trait.excludes.length; i++) if (geneOf(lineage, trait.excludes[i])) return trait.excludes[i];
    return null;
  }
  /*
   * Status cechy dla linii: fixed | present | possible (może pojawić się jako mutacja)
   * | locked (warunki wstępne) | era_locked | excluded.
   */
  function traitStatus(data, state, lineage, trait) {
    if (!lineage) return 'locked';
    var g = geneOf(lineage, trait.id);
    if (g) return g.f >= 1 ? 'fixed' : 'present';
    if (!eraUnlocked(state, trait)) return 'era_locked';
    if (excludedBy(lineage, trait)) return 'excluded';
    if (!prerequisitesMet(data, lineage, trait)) return 'locked';
    return 'possible';
  }

  function rollDraft(data, state, lineage, rng, size) {
    size = size || data.GENETICS.draftSize;
    var env = currentTurnEnv(data, state);
    var pool = [];
    data.TRAITS.forEach(function (t) {
      if (traitStatus(data, state, lineage, t) === 'possible') {
        pool.push({ kind: 'gain', id: t.id, w: t.path === 'intelligence' ? 1.3 : 1 });
      }
    });
    // Mutacje „utraty” — tylko dla utrwalonych cech, które obecnie szkodzą.
    if (env) {
      var ctx = buildContext(data, state, env);
      var ne = nicheEnv(data, env, lineage.niche);
      lineage.genes.forEach(function (g) {
        if (g.f >= 1 && selectionCoefficient(data, lineage, g.id, ne, ctx, null) < -0.03) {
          pool.push({ kind: 'loss', id: g.id, w: 1.4 });
        }
      });
    }
    var out = [];
    while (out.length < size && pool.length) {
      var total = pool.reduce(function (s, c) { return s + c.w; }, 0);
      var x = rng() * total, idx = 0;
      for (; idx < pool.length - 1; idx++) { x -= pool[idx].w; if (x <= 0) break; }
      var c = pool.splice(idx, 1)[0];
      out.push({ kind: c.kind, id: c.id });
    }
    lineage.draft = out;
    return out;
  }

  // Pierwsza mutacja w turze jest darmowa, każda kolejna droższa.
  function pickCost(data, lineage) { return data.COSTS.extraPick * lineage.picksUsed; }

  function pickMutation(data, state, lineageId, index) {
    if (state.status !== 'playing') return { ok: false, state: state, error: 'Gra zakończona.' };
    var l0 = getLineage(state, lineageId);
    if (!l0 || !l0.alive) return { ok: false, state: state, error: 'Linia niedostępna.' };
    var card = l0.draft[index];
    if (!card) return { ok: false, state: state, error: 'Brak takiej mutacji.' };
    var cost = pickCost(data, l0);
    if (state.zg < cost) return { ok: false, state: state, error: 'Za mało zmienności genetycznej (potrzeba ' + cost + ' ZG).' };
    var trait = traitsById(data)[card.id];
    if (card.kind === 'gain') {
      if (geneOf(l0, card.id)) return { ok: false, state: state, error: 'Linia ma już tę cechę.' };
      var ex = excludedBy(l0, trait);
      if (ex) return { ok: false, state: state, error: 'Wyklucza się z cechą „' + traitsById(data)[ex].name + '”.' };
    } else if (!isFixed(l0, card.id)) return { ok: false, state: state, error: 'Ta cecha nie jest już utrwalona.' };

    var n = clone(state); var l = getLineage(n, lineageId);
    n.zg -= cost;
    if (card.kind === 'gain') {
      l.genes.push({ id: card.id, f: data.GENETICS.newMutationFreq });
      unlockKnowledge(n, 'selection');
      unlockKnowledgeForTrait(n, trait);
    } else {
      geneOf(l, card.id).f = data.GENETICS.lossMutationFreq;
      unlockKnowledge(n, 'vestigial');
    }
    l.draft.splice(index, 1);
    l.picksUsed += 1;
    return { ok: true, state: n, error: null };
  }

  function rerollDraft(data, state, lineageId) {
    if (state.status !== 'playing') return { ok: false, state: state, error: 'Gra zakończona.' };
    var l0 = getLineage(state, lineageId);
    if (!l0 || !l0.alive) return { ok: false, state: state, error: 'Linia niedostępna.' };
    if (state.zg < data.COSTS.reroll) return { ok: false, state: state, error: 'Za mało zmienności genetycznej (potrzeba ' + data.COSTS.reroll + ' ZG).' };
    var n = clone(state); var l = getLineage(n, lineageId);
    n.zg -= data.COSTS.reroll;
    rollDraft(data, n, l, stateRng(n));
    return { ok: true, state: n, error: null };
  }

  // ---------- Wiedza ----------
  function unlockKnowledge(state, key) { if (state.unlockedKnowledge.indexOf(key) === -1) state.unlockedKnowledge.push(key); }
  function unlockKnowledgeForTrait(state, trait) {
    if (trait.category === 'uklad_nerwowy') unlockKnowledge(state, 'intelligence');
    if (trait.id === 'endothermy' || trait.id === 'insulation') unlockKnowledge(state, 'cold');
    if (trait.id === 'lungs') unlockKnowledge(state, 'oxygen');
    if (trait.id === 'limbs' || trait.id === 'amniotic_egg') unlockKnowledge(state, 'land');
  }

  // ---------- Nisze / migracja ----------
  function nicheOpen(data, lineage, niche) {
    var req = data.NICHES[niche].requires;
    return !req || geneFreq(lineage, req) >= data.GENETICS.nicheAccessAt;
  }
  function availableNiches(data, lineage) {
    return Object.keys(data.NICHES).filter(function (k) { return nicheOpen(data, lineage, k); });
  }
  function nicheRequirementError(data, niche) {
    var req = data.NICHES[niche].requires;
    var tr = traitsById(data)[req];
    return 'Wymaga cechy „' + (tr ? tr.name : req) + '” (częstość ≥ ' + Math.round(data.GENETICS.nicheAccessAt * 100) + '%).';
  }
  function canMigrate(data, state, lineage, niche) {
    if (state.status !== 'playing') return { ok: false, error: 'Gra zakończona.' };
    if (!lineage || !lineage.alive) return { ok: false, error: 'Linia wymarła.' };
    if (!data.NICHES[niche]) return { ok: false, error: 'Nieznana nisza.' };
    if (lineage.niche === niche) return { ok: false, error: 'Linia już zajmuje tę niszę.' };
    if (!nicheOpen(data, lineage, niche)) return { ok: false, error: nicheRequirementError(data, niche) };
    if (lineage.migrated) return { ok: false, error: 'Ta linia migrowała już w tej turze.' };
    if (state.zg < data.COSTS.migrate) return { ok: false, error: 'Migracja kosztuje ' + data.COSTS.migrate + ' ZG.' };
    return { ok: true, error: null };
  }
  function migrateLineage(data, state, lineageId, niche) {
    var l0 = getLineage(state, lineageId);
    if (!l0) return { ok: false, state: state, error: 'Nieznana linia.' };
    var can = canMigrate(data, state, l0, niche);
    if (!can.ok) return { ok: false, state: state, error: can.error };
    var n = clone(state); var l = getLineage(n, lineageId);
    l.niche = niche; l.migrated = true; n.zg -= data.COSTS.migrate;
    if (n.nichesEver.indexOf(niche) === -1) n.nichesEver.push(niche);
    unlockKnowledge(n, 'niche');
    if (niche === 'lad') unlockKnowledge(n, 'land');
    return { ok: true, state: n, error: null };
  }

  // ---------- Specjacja ----------
  function canSpeciate(data, state, niche) {
    if (state.status !== 'playing') return { ok: false, error: 'Gra zakończona.' };
    var a = getActiveLineage(state);
    if (!a || !a.alive) return { ok: false, error: 'Brak aktywnej linii.' };
    if (state.zg < data.COSTS.speciate) return { ok: false, error: 'Za mało zmienności na specjację (potrzeba ' + data.COSTS.speciate + ' ZG).' };
    if (a.population < data.MIN_SPECIATION_POP) return { ok: false, error: 'Za mała populacja do specjacji (min. ' + data.MIN_SPECIATION_POP + ').' };
    if (niche && (!data.NICHES[niche] || !nicheOpen(data, a, niche))) return { ok: false, error: nicheRequirementError(data, niche) };
    return { ok: true, error: null };
  }
  /* Specjacja: część populacji zakłada nową linię — opcjonalnie od razu w innej niszy. */
  function speciate(data, state, newName, niche) {
    var check = canSpeciate(data, state, niche);
    if (!check.ok) return { ok: false, state: state, error: check.error };
    var n = clone(state); var parent = getActiveLineage(n);
    var childPop = Math.floor(parent.population / 2);
    parent.population -= childPop; parent.popHistory[parent.popHistory.length - 1] = parent.population;
    var childId = 'L' + n.nextLineageNum; n.nextLineageNum += 1;
    var child = makeLineage(childId, newName || (parent.name + ' II'), parent.id,
      childPop, parent.genes, niche || parent.niche, n.eraIndex, n.turn);
    child.migrated = true;
    n.lineages.push(child); n.zg -= data.COSTS.speciate; n.activeLineageId = childId;
    if (n.nichesEver.indexOf(child.niche) === -1) n.nichesEver.push(child.niche);
    rollDraft(data, n, child, stateRng(n));
    unlockKnowledge(n, 'speciation');
    if (child.niche !== parent.niche) unlockKnowledge(n, 'niche');
    else unlockKnowledge(n, 'competition');
    return { ok: true, state: n, error: null };
  }

  // ---------- Rozliczenie populacji jednej linii (bez losowości) ----------
  function resolvePopulation(data, state, lineage, env, ctx) {
    var diff = difficultyOf(data, state);
    var ne = nicheEnv(data, env, lineage.niche);
    var d = computeDynamics(data, lineage, ne, ctx);
    var pop = lineage.population;
    var nPop = nichePopulation(ctx, lineage, pop);
    var density = nPop / d.capacity;
    var births = Math.round(pop * d.birthRate * Math.max(0, 1 - density));
    var predationDeaths = Math.round(pop * d.predationLossRate);
    var starvationDeaths = Math.round(pop * d.starvationLossRate);
    var crowdDeaths = density > 1 ? Math.round(pop * Math.min(0.4, (density - 1) * 0.5)) : 0;
    var ev = eventDef(data, env);
    var diseaseDeaths = (ev && ev.disease && density > 0.8) ? Math.round(pop * ev.disease) : 0;
    var after = pop + births - predationDeaths - starvationDeaths - crowdDeaths - diseaseDeaths;
    var catDeaths = 0, catSeverity = 0;
    if (catastropheHits(env.catastrophe, lineage.niche)) {
      var res = resistance(data, lineage, env.catastrophe.kind);
      var intelBuf = Math.min(0.3, 0.02 * d.intel);
      catSeverity = clamp(env.catastrophe.severity * diff.catMult * (1 - res) * (1 - intelBuf), 0, 0.95);
      catDeaths = Math.round(Math.max(0, after) * catSeverity);
      after -= catDeaths;
    }
    return {
      ne: ne, d: d, density: density,
      births: births, predationDeaths: predationDeaths, starvationDeaths: starvationDeaths,
      crowdDeaths: crowdDeaths, diseaseDeaths: diseaseDeaths, catDeaths: catDeaths, catSeverity: catSeverity,
      popAfter: Math.max(0, Math.round(after))
    };
  }

  /* Prognoza „co-jeśli” — bez dryfu; override: hipotetyczna cecha. */
  function forecast(data, state, lineage, override) {
    var env = currentTurnEnv(data, state);
    if (!env || !lineage || !lineage.alive) return null;
    var ctx = buildContext(data, state, env);
    var l = lineage;
    if (override) {
      l = clone(lineage);
      var g = geneOf(l, override.id);
      if (g) g.f = override.f; else l.genes.push({ id: override.id, f: override.f });
    }
    var p = resolvePopulation(data, state, l, env, ctx);
    return {
      energy: round1(p.d.energy), predationPressure: round1(p.d.predationPressure),
      food: round1(p.d.food), rival: round1(p.d.rival), compFactor: round2(p.d.compFactor),
      capacity: Math.round(p.d.capacity), density: round2(p.density),
      births: p.births, predationDeaths: p.predationDeaths, starvationDeaths: p.starvationDeaths,
      crowdDeaths: p.crowdDeaths, diseaseDeaths: p.diseaseDeaths, catDeaths: p.catDeaths,
      projectedPop: p.popAfter, delta: p.popAfter - lineage.population,
      catastrophe: catastropheHits(env.catastrophe, lineage.niche) ? env.catastrophe : null,
      stats: p.d.stats
    };
  }

  // ---------- Cele ery ----------
  function objectiveMet(data, state, o, atEraEnd) {
    var alive = aliveLineages(state);
    switch (o.type) {
      case 'niche': return alive.some(function (l) { return l.niche === o.niche; });
      case 'niches': return dedupe(alive.map(function (l) { return l.niche; })).length >= o.n;
      case 'lineages': return alive.length >= o.n;
      case 'lineagesAtEnd': return !!atEraEnd && alive.length >= o.n;
      case 'fixed': return alive.some(function (l) { return isFixed(l, o.trait); });
      case 'freq': return alive.some(function (l) { return geneFreq(l, o.trait) >= o.f; });
      case 'pop': return totalPopulation(state) >= o.n;
      case 'intel': return maxIntelligence(data, state) >= o.n;
    }
    return false;
  }
  function eraObjectives(data, eraIndex) {
    var era = data.ERAS[eraIndex]; return era ? (data.OBJECTIVES[era.id] || []) : [];
  }

  // ---------- Symulacja tury ----------
  function simulateTurn(data, state, rngOverride) {
    if (state.status !== 'playing') return { state: state, report: null };
    var n = clone(state);
    var rng = rngOverride || stateRng(n);
    var G = data.GENETICS;
    var diff = difficultyOf(data, n);
    var era = data.ERAS[n.eraIndex];
    var env = currentTurnEnv(data, n);
    var ev = eventDef(data, env);
    var ctx = buildContext(data, n, env);
    var byId = traitsById(data);
    var knowledge = [];
    var lineReports = [];

    if (ev) knowledge.push(ev.knowledge || 'events');
    if (env.catastrophe) knowledge.push(env.catastrophe.knowledge || 'extinction');

    // Najpierw liczymy wszystkie linie na stanie początkowym (równoczesność).
    var results = aliveLineages(n).map(function (l) { return { l: l, p: resolvePopulation(data, n, l, env, ctx) }; });

    results.forEach(function (it) {
      var l = it.l, p = it.p, events = [];
      var popBefore = l.population;

      // Dobór naturalny + dryf genetyczny — zmiana częstości cech.
      var geneChanges = [];
      var driftScale = Math.min(0.16, 1.2 / Math.sqrt(Math.max(1, popBefore)));
      l.genes.slice().forEach(function (g) {
        if (g.f >= 1) return;
        var s = selectionCoefficient(data, l, g.id, p.ne, ctx, env.catastrophe, diff.catMult);
        var drift = (rng() * 2 - 1) * driftScale * Math.sqrt(g.f * (1 - g.f));
        var from = g.f;
        var f = g.f + G.selectionGain * s * g.f * (1 - g.f) + drift;
        var change = { id: g.id, from: round2(from), s: round2(s), drift: round2(drift), fixed: false, lost: false };
        if (f >= G.fixAt) { f = 1; change.fixed = true; }
        else if (f <= G.loseAt) { f = 0; change.lost = true; }
        change.to = round2(f);
        g.f = f;
        geneChanges.push(change);
        if (Math.abs(drift) > Math.abs(G.selectionGain * s * from * (1 - from)) && Math.abs(drift) > 0.03) knowledge.push('drift');
      });
      l.genes = l.genes.filter(function (g) { return g.f > 0; });
      geneChanges.forEach(function (c) {
        var nm = byId[c.id].name;
        if (c.fixed) events.push('🧬 Cecha „' + nm + '” utrwaliła się w całej populacji.');
        if (c.lost) { events.push('🍂 Cecha „' + nm + '” zanikła — w tych warunkach nie dawała przewagi.'); knowledge.push('mutation_bad'); }
      });

      var pop = p.popAfter;
      if (p.catDeaths > 0) events.push('☄️ Katastrofa (' + env.catastrophe.name + ') — straty ' + Math.round(p.catSeverity * 100) + '%.');
      if (p.diseaseDeaths > 0) events.push('🦠 Epidemia w zatłoczonej niszy.');
      if (p.crowdDeaths > 0) { events.push('📦 Przeludnienie — populacja przekroczyła pojemność niszy.'); knowledge.push('carrying'); }
      if (p.density > 0.85) knowledge.push('carrying');
      if (p.d.predationLossRate > 0.12) { events.push('🦈 Silna presja drapieżników.'); knowledge.push('predation'); }
      if (p.d.starvationLossRate > 0) { events.push('🍂 Ujemny bilans energetyczny — głód.'); knowledge.push('starvation'); }
      if (p.d.compFactor < 0.8) knowledge.push('competition');
      if (p.ne.climate === 'zimno') knowledge.push('cold');
      if (p.ne.oxygen <= 8) knowledge.push('oxygen');
      if (l.niche !== 'woda') knowledge.push('niche');

      l.population = pop; l.popHistory.push(pop);
      if (pop > l.peakPopulation) l.peakPopulation = pop;
      if (pop > 0 && pop < data.MIN_VIABLE_POP) { events.push('⚠️ Populacja spadła poniżej minimalnej liczebności żywotnej (' + data.MIN_VIABLE_POP + ').'); knowledge.push('mvp'); pop = 0; l.population = 0; l.popHistory[l.popHistory.length - 1] = 0; }
      if (pop <= 0) {
        l.alive = false; l.extinctGlobalTurn = globalTurn(data, n.eraIndex, n.turn) + 1;
        l.draft = [];
        events.push('🦴 Ta linia wymarła.');
      }

      lineReports.push({
        lineageId: l.id, name: l.name, niche: l.niche,
        popBefore: popBefore, popAfter: pop,
        births: p.births, predationDeaths: p.predationDeaths, starvationDeaths: p.starvationDeaths,
        crowdDeaths: p.crowdDeaths, diseaseDeaths: p.diseaseDeaths, catDeaths: p.catDeaths,
        energy: round1(p.d.energy), food: round1(p.d.food), compFactor: round2(p.d.compFactor),
        capacity: Math.round(p.d.capacity),
        intelligence: lineageIntelligence(data, l), geneChanges: geneChanges,
        alive: l.alive, events: events
      });
    });

    // Koewolucja: presja drapieżników „dogania” dobrze bronione linie.
    var maxDef = 0;
    aliveLineages(n).forEach(function (l) { maxDef = Math.max(maxDef, effectiveStats(data, l, null).defense); });
    var target = Math.max(0, (maxDef - data.BASE_STATS.defense) * 0.6) * diff.coevo;
    n.predatorLevel = clamp((n.predatorLevel || 0) + (target - (n.predatorLevel || 0)) * 0.3, 0, 10);
    if (n.predatorLevel > 2) knowledge.push('coevolution');

    // Konkurenci: dążą do poziomu następnej tury, katastrofa ich przetrzebia.
    var gtNext = globalTurn(data, n.eraIndex, n.turn) + 1;
    var nextEnv = n.envs[gtNext] || env;
    var radiation = [];
    Object.keys(n.rivals).forEach(function (k) {
      var r = n.rivals[k] + ((nextEnv.rivals[k] || 0) - n.rivals[k]) * 0.3;
      if (catastropheHits(env.catastrophe, k)) {
        r *= (1 - clamp(env.catastrophe.severity * 1.3, 0, 0.9));
        radiation.push(k);
      }
      n.rivals[k] = round2(Math.max(0, r));
    });
    if (radiation.length && aliveLineages(n).length) knowledge.push('radiation');

    // Zmienność genetyczna (ZG): duże populacje i wiele nisz = więcej mutacji.
    var alive = aliveLineages(n);
    var totalPop = totalPopulation(n);
    var occupied = dedupe(alive.map(function (l) { return l.niche; })).length;
    var zgBreak = alive.length ? {
      base: 2 + (diff.zgBonus || 0), population: Math.floor(Math.sqrt(totalPop) / 4), niches: occupied, objectives: 0
    } : { base: 0, population: 0, niches: 0, objectives: 0 };
    if (alive.length) n.turnsSurvived += 1;
    n.peakTotalPop = Math.max(n.peakTotalPop || 0, totalPop);

    // Cele bieżącej ery.
    var prevEraIndex = n.eraIndex;
    var eraEnds = (n.turn + 1 >= era.turns.length);
    var objectivesDone = [];
    eraObjectives(data, prevEraIndex).forEach(function (o) {
      if (n.objectivesDone.indexOf(o.id) !== -1) return;
      if (alive.length && objectiveMet(data, n, o, eraEnds)) {
        n.objectivesDone.push(o.id); zgBreak.objectives += o.reward; objectivesDone.push(o);
      }
    });
    var zgGain = zgBreak.base + zgBreak.population + zgBreak.niches + zgBreak.objectives;
    n.zg += zgGain;

    // Do raportu trafiają tylko pojęcia odkryte w tej turze (bez powtórek).
    knowledge = dedupe(knowledge).filter(function (k) { return n.unlockedKnowledge.indexOf(k) === -1; });
    knowledge.forEach(function (k) { unlockKnowledge(n, k); });

    // Upływ czasu.
    n.turn += 1;
    var eraChanged = false;
    if (n.turn >= era.turns.length) {
      if (alive.length && data.QUIZZES[era.id] && !(era.id in n.quizResults)) n.quizPending = era.id;
      if (n.eraIndex < data.ERAS.length - 1) { n.eraIndex += 1; n.turn = 0; eraChanged = true; unlockKnowledge(n, 'milestone'); }
      else n.eraIndex = data.ERAS.length;
    }
    n.status = evaluateStatus(data, n);
    if (n.status === 'lost') n.quizPending = null;

    // Nowa zmienność: świeże drafty dla żywych linii.
    aliveLineages(n).forEach(function (l) {
      l.picksUsed = 0; l.migrated = false;
      if (n.status === 'playing') rollDraft(data, n, l, rng); else l.draft = [];
    });
    if (n.status === 'playing' && !getActiveLineage(n).alive) n.activeLineageId = aliveLineages(n)[0].id;

    var report = {
      eraIndex: prevEraIndex, eraName: era.name, turnIndex: state.turn,
      envTitle: env.title, envNote: env.note, climate: env.climate,
      catastrophe: env.catastrophe || null,
      event: ev ? { id: ev.id, name: ev.name, icon: ev.icon, desc: ev.desc, good: ev.good, niche: env.event.niche } : null,
      lineReports: lineReports, zgGain: zgGain, zgBreakdown: zgBreak,
      objectivesDone: objectivesDone,
      predatorLevel: round1(n.predatorLevel), radiation: radiation,
      totalPopulation: totalPop, maxIntelligence: maxIntelligence(data, n),
      intelligenceGoal: n.intelligenceGoal, eraChanged: eraChanged,
      newEraName: eraChanged ? data.ERAS[n.eraIndex].name : null,
      knowledge: knowledge, status: n.status
    };
    n.history.push({ g: gtNext - 1, pop: totalPop, intel: report.maxIntelligence, zg: zgGain });
    return { state: n, report: report };
  }

  function evaluateStatus(data, n) {
    if (totalPopulation(n) <= 0) return 'lost';
    if (maxIntelligence(data, n) >= n.intelligenceGoal) return 'won';
    if (n.eraIndex >= data.ERAS.length) return 'survived';
    return 'playing';
  }

  // ---------- Quiz ----------
  function answerQuiz(data, state, choice) {
    var id = state.quizPending;
    if (!id || !data.QUIZZES[id]) return { ok: false, state: state, error: 'Brak pytania.' };
    var q = data.QUIZZES[id];
    var n = clone(state);
    var correct = choice === q.correct;
    n.quizResults[id] = correct;
    n.quizPending = null;
    if (correct) n.zg += q.reward;
    return { ok: true, state: n, correct: correct, explain: q.explain, reward: correct ? q.reward : 0 };
  }

  // ---------- Wynik punktowy ----------
  function computeScore(data, state) {
    var diff = difficultyOf(data, state);
    var alive = aliveLineages(state).length;
    var quizOk = Object.keys(state.quizResults || {}).filter(function (k) { return state.quizResults[k]; }).length;
    var parts = {
      turns: (state.turnsSurvived || 0) * 10,
      population: Math.floor((state.peakTotalPop || 0) / 10),
      niches: (state.nichesEver || []).length * 25,
      lineages: alive * 30,
      intelligence: Math.round(maxIntelligence(data, state) * 15),
      objectives: (state.objectivesDone || []).length * 40,
      quiz: quizOk * 30,
      victory: state.status === 'won' ? 250 : 0
    };
    var sum = 0; for (var k in parts) sum += parts[k];
    return { parts: parts, mult: diff.scoreMult, total: Math.round(sum * diff.scoreMult) };
  }

  function statLabel(k) {
    return ({ feeding: 'odżywianie', defense: 'obrona', reproduction: 'rozród',
      mobility: 'mobilność', metabolism: 'metabolizm', intelligence: 'inteligencja' })[k] || k;
  }

  return {
    STAT_KEYS: STAT_KEYS,
    createInitialState: createInitialState, generateWorld: generateWorld,
    seedFromCode: seedFromCode, randomSeed: randomSeed, dailySeed: dailySeed,
    currentEra: currentEra, currentTurnEnv: currentTurnEnv, peekEnv: peekEnv, eventDef: eventDef,
    nicheEnv: nicheEnv, conditionsFor: conditionsFor, catastropheHits: catastropheHits,
    globalTurn: globalTurn, totalTurns: totalTurns, difficultyOf: difficultyOf,
    getLineage: getLineage, getActiveLineage: getActiveLineage, aliveLineages: aliveLineages,
    totalPopulation: totalPopulation, maxIntelligence: maxIntelligence, lineageIntelligence: lineageIntelligence,
    setActiveLineage: setActiveLineage,
    geneOf: geneOf, geneFreq: geneFreq, isEstablished: isEstablished, isFixed: isFixed,
    effectiveStats: effectiveStats, resistance: resistance,
    traitStatus: traitStatus, prerequisitesMet: prerequisitesMet, eraUnlocked: eraUnlocked,
    pickMutation: pickMutation, pickCost: pickCost, rerollDraft: rerollDraft,
    predictSelection: predictSelection,
    availableNiches: availableNiches, canMigrate: canMigrate, migrateLineage: migrateLineage,
    canSpeciate: canSpeciate, speciate: speciate,
    buildContext: buildContext,
    forecast: forecast, simulateTurn: simulateTurn, evaluateStatus: evaluateStatus,
    eraObjectives: eraObjectives, answerQuiz: answerQuiz, computeScore: computeScore,
    statLabel: statLabel,
    _internals: { clamp: clamp, computeDynamics: computeDynamics, selectionCoefficient: selectionCoefficient,
      rollDraft: rollDraft, mulberry: mulberry, stateRng: stateRng }
  };
});
