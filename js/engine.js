/*
 * engine.js — silnik symulacji (czysta logika gry).
 *
 * ZALOZENIA.md sekcja 9: logika oddzielona od UI, testowalna, bez DOM.
 * Obsługuje: poziomy trudności, wiele er, wiele linii (specjacja), cztery nisze
 * z migracją, katastrofy, koewolucję (adaptacyjną presję
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
  function num1(v) { return String(round1(v)).replace('.', ','); }
  /* Losowe zaokrąglanie: 0,4 osobnika to 0 lub 1 z szansą 40%. Wartość oczekiwana
     się zgadza, a mała populacja nie staje się „nieśmiertelna” (Math.round(2 × 0,22) = 0). */
  function sround(x, rng) { var f = Math.floor(x); return f + (rng() < x - f ? 1 : 0); }
  function dedupe(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
  /* ---------- Losowość z ziarnem („kod świata”) ----------
     Świat (warunki tur, kalendarz katastrof, zdarzenia, karty, cele er) wynika z
     kodu świata i numeru tury — przy tym samym kodzie cała klasa gra w tym samym
     świecie. Los linii (mutacje, straty, ryzyka) ma osobny strumień zapisany w
     stanie, więc te same decyzje dają tę samą partię. */
  function hashStr(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mulberryStep(a) {
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function seededRng(seedNum) {
    var a = seedNum | 0;
    return function () { a = (a + 0x6D2B79F5) | 0; return mulberryStep(a); };
  }
  function worldRngFor(seed, salt) { return seededRng(hashStr(seed + '|' + salt)); }
  // Strumień gracza: stan generatora zapisany w stanie gry (przetrwa zapis i cofanie).
  function stateRng(n) {
    return function () { n.rngState = (n.rngState + 0x6D2B79F5) | 0; return mulberryStep(n.rngState); };
  }
  var SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function randomSeed(rng) {
    rng = rng || Math.random; var out = '';
    for (var i = 0; i < 6; i++) out += SEED_ALPHABET[Math.floor(rng() * SEED_ALPHABET.length)];
    return out;
  }
  function normalizeSeed(x) {
    if (x == null) return null;
    var v = String(x).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    return v || null;
  }

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
      diet: res.diet || 'roslinozerca',   // dieta: z czego żyje linia (sieć troficzna)
      dietChangedAt: null,
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

    var seed = normalizeSeed(opts.seed);
    var st = {
      version: 8,
      seed: seed,                // kod świata (null — świat bez ziarna, tylko w testach)
      rngState: seed ? hashStr(seed + '|linia') : 0,
      calendar: seed ? buildCalendar(data, seed, startEra) : null,
      eraGoals: seed ? pickEraGoals(data, seed, startEra) : [],
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
      pendingGamble: null,       // ryzykowna opcja karty — wynik losowany w turze
      choiceHistory: [],         // karty, które już padły (bez powtórek w partii)
      echoes: [],                // zaplanowane skutki wcześniejszych decyzji (karty-echa)
      echoesSeen: 0,             // ile kart-ech gracz już dostał
      rivals: [],                // konkurenci: inne gatunki zajmujące nisze gracza
      rivalsDisplaced: 0,        // ilu konkurentów wyparto z niszy
      nextRivalNum: 1,
      resolvedChoice: null,      // wybór do pokazania w raporcie tury
      status: 'playing',
      history: []
    };
    fixRegional(data, st);
    return st;
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
    return turnBase(data, state, state.eraIndex, state.turn);
  }

  /* ---------- Kalendarz świata ----------
     order[era] — kolejność tur ery po przesunięciu wymierań z `window`;
     regional[era] — { turn, id } katastrofy regionalnej. */
  function buildCalendar(data, seed, startEra) {
    var cal = { order: {}, regional: {} };
    for (var e = startEra || 0; e < data.ERAS.length; e++) {
      var turns = data.ERAS[e].turns, order = turns.map(function (_, i) { return i; });
      turns.forEach(function (t, i) {
        var w = t.catastrophe && t.catastrophe.window;
        if (!w || !w.length) return;
        var target = w[Math.floor(worldRngFor(seed, 'cat:' + e + ':' + i)() * w.length)];
        var pi = order.indexOf(i), pt = target;
        var tmp = order[pi]; order[pi] = order[pt]; order[pt] = tmp;
      });
      cal.order[e] = order;
      var R = data.REGIONAL, pool = (data.REGIONAL_DISASTERS || []).filter(function (d) {
        return (d.minEra == null || e >= d.minEra) && (d.niche !== 'powietrze' || e >= 1);
      });
      if (!R || !R.perEra || !pool.length) continue;
      var rr = worldRngFor(seed, 'regional:' + e);
      var free = [];
      for (var j = 1; j < turns.length; j++) if (!turns[order[j]].catastrophe) free.push(j);
      if (!free.length) continue;
      // Rodzaj katastrofy ustala się dopiero przy zapowiedzi (fixRegional) — uderza
      // w niszę, w której żyje najwięcej osobników gatunku.
      cal.regional[e] = { turn: free[Math.floor(rr() * free.length)], id: null };
    }
    return cal;
  }
  /* Zapowiedź katastrofy regionalnej na następną turę: wybór rodzaju według niszy
     z największą populacją (kto trzyma wszystko w jednej niszy, ten ryzykuje). */
  function fixRegional(data, n) {
    var cal = n.calendar; if (!cal || !n.seed || n.status !== 'playing') return;
    var nx = nextTurnOf(data, n.eraIndex, n.turn), cur = [n.eraIndex, n.turn];
    [cur, nx].forEach(function (t) {
      if (!t) return;
      var reg = cal.regional && cal.regional[t[0]];
      if (!reg || reg.turn !== t[1] || reg.id) return;
      var load = nicheLoad(n), top = null;
      Object.keys(load).forEach(function (k) { if (top === null || load[k] > load[top]) top = k; });
      var r = worldRngFor(n.seed, 'regional-type:' + t[0]);
      var local = (data.REGIONAL_DISASTERS || []).filter(function (d) {
        return d.niche === top && (d.minEra == null || t[0] >= d.minEra);
      });
      var global = (data.REGIONAL_DISASTERS || []).filter(function (d) { return d.niche === 'all'; });
      var pool = (local.length && r() >= 0.2) ? local : (global.length ? global : local);
      reg.id = pool.length ? pool[Math.floor(r() * pool.length)].id : 'none';
    });
  }
  function regionalById(data, id) { return (data.REGIONAL_DISASTERS || []).filter(function (d) { return d.id === id; })[0]; }
  // Warunki historyczne danej tury po uwzględnieniu kalendarza świata.
  function turnBase(data, state, eraIndex, turn) {
    var era = data.ERAS[eraIndex]; if (!era) return null;
    var cal = state && state.calendar;
    var idx = cal && cal.order && cal.order[eraIndex] ? cal.order[eraIndex][turn] : turn;
    var base = era.turns[idx];
    var reg = cal && cal.regional && cal.regional[eraIndex];
    if (reg && reg.id && reg.turn === turn && base && !base.catastrophe) {
      var d = regionalById(data, reg.id);
      if (d) {
        base = clone(base);
        base.catastrophe = { name: d.name, niche: d.niche, severity: d.severity, regional: true, note: d.note,
          knowledge: d.knowledge, survival: d.survival || [] };
        if (d.env && d.env.oxygen) base.oxygen = Math.max(5, base.oxygen + d.env.oxygen);
        if (d.env && d.env.landFood) base.land = { food: Math.max(1, base.land.food + d.env.landFood), predators: base.land.predators };
      }
    }
    return base;
  }
  // Globalny numer tury → [era, tura] (null poza grą).
  function nextTurnOf(data, eraIndex, turn) {
    if (eraIndex >= data.ERAS.length) return null;
    if (turn + 1 < data.ERAS[eraIndex].turns.length) return [eraIndex, turn + 1];
    return eraIndex + 1 < data.ERAS.length ? [eraIndex + 1, 0] : null;
  }
  /* Zapowiedź: katastrofa w NASTĘPNEJ turze (gracz widzi ją turę wcześniej). */
  function upcomingThreat(data, state) {
    if (state.status !== 'playing') return null;
    var nx = nextTurnOf(data, state.eraIndex, state.turn); if (!nx) return null;
    var b = turnBase(data, state, nx[0], nx[1]);
    if (!b || !b.catastrophe) return null;
    return { name: b.catastrophe.name, niche: b.catastrophe.niche, regional: !!b.catastrophe.regional,
      note: b.catastrophe.note || b.note, title: b.title, newEra: nx[0] !== state.eraIndex ? data.ERAS[nx[0]].name : null };
  }
  /* Oś czasu bieżącej ery — co gracz wie o katastrofach: minione, bieżąca i
     zapowiedziana są jawne; stałe wymierania historyczne też; wymierania z
     `window` pokazują tylko możliwe tury („?”), regionalne są ukryte do zapowiedzi. */
  function eraTimeline(data, state) {
    var e = Math.min(state.eraIndex, data.ERAS.length - 1), era = data.ERAS[e], cal = state.calendar;
    var out = era.turns.map(function (_, i) {
      var b = turnBase(data, state, e, i), c = b.catastrophe, known = null;
      var revealed = state.eraIndex > e || i <= state.turn + 1;
      if (c && (revealed || !cal || (!c.regional && !c.window))) known = c;
      return { title: b.title, catastrophe: known, maybe: false };
    });
    if (cal) era.turns.forEach(function (t) {
      var w = t.catastrophe && t.catastrophe.window; if (!w) return;
      var hit = out.some(function (x) { return x.catastrophe && x.catastrophe.name === t.catastrophe.name; });
      if (!hit) w.forEach(function (i) { if (out[i] && !out[i].catastrophe) out[i].maybe = t.catastrophe.name; });
    });
    return out;
  }

  var CLIMATES = ['zimno', 'umiarkowanie', 'cieplo'];
  /* Faza środowiska: odchylenia od warunków historycznych danej tury. Tura z
     katastrofą zachowuje historyczny klimat. rng()=0.5 daje warunki bazowe. */
  function rollEnv(data, state, eraIndex, turn, rng) {
    if (eraIndex >= data.ERAS.length || turn >= data.ERAS[eraIndex].turns.length) return null;
    var base = turnBase(data, state, eraIndex, turn), v = data.ENV_VARIATION;
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
    if (trait.id === 'echolocation') unlockKnowledge(state, 'echolocation');
    if (trait.id === 'vocal_culture') unlockKnowledge(state, 'culture');
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
    // Nową linię zakłada część populacji (SPECIATION_SHARE); obie niosą
    // pozostałą zmienność i zapasy.
    var child = splitLineage(data, n, parent, Math.floor(parent.population * (data.SPECIATION_SHARE || 0.5)), newName || (parent.name + ' II'),
      { variation: parent.variation });
    n.activeLineageId = child.id;
    unlockKnowledge(n, 'speciation');
    return { ok: true, state: n, error: null };
  }
  // Oddziela `childPop` osobników rodzica jako nową linię (specjacja, kolonizacja).
  function splitLineage(data, n, parent, childPop, name, res) {
    parent.population -= childPop; parent.popHistory[parent.popHistory.length - 1] = parent.population;
    var childId = 'L' + n.nextLineageNum; n.nextLineageNum += 1;
    var child = makeLineage(childId, name, parent.id, childPop, parent.stats, parent.traits, parent.niche,
      n.eraIndex, n.turn, { reserves: parent.reserves, variation: res.variation, strategy: parent.strategy, diet: parent.diet });
    var NL = data.NEW_LINEAGE, now = nowTurn(data, n);
    for (var t = 0; NL && t < NL.turns; t++) child.mods.push({ turn: now + t, predMult: NL.predMult });
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
  function conditionMet(c, niche, env, diet) {
    if (c.niches && c.niches.indexOf(niche) === -1) return false;
    if (c.diets && c.diets.indexOf(diet || 'roslinozerca') === -1) return false;
    if (c.oxygenBelow != null && !(env && env.oxygen < c.oxygenBelow)) return false;
    if (c.climate && !(env && env.climate === c.climate)) return false;
    return true;
  }
  function effectiveStats(data, lineage, env) {
    var st = clone(lineage.stats), notes = [], byId = traitsById(data);
    (lineage.traits || []).forEach(function (id) {
      var t = byId[id];
      (t && t.conditions || []).forEach(function (c) {
        if (!conditionMet(c, lineage.niche, env, lineage.diet)) return;
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
    var m = { foodBonus: 0, predBonus: 0, birthMult: 1, diseaseLoss: 0, noPredators: false, predMult: 1 };
    (lineage.mods || []).forEach(function (x) {
      if (x.turn !== turn) return;
      m.foodBonus += x.foodBonus || 0; m.predBonus += x.predBonus || 0;
      m.birthMult *= x.birthMult || 1; m.diseaseLoss += x.diseaseLoss || 0; m.predMult *= x.predMult || 1;
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
    var predBase = ne.predators + ((ctx.rivalPred && ctx.rivalPred[lineage.niche]) || 0) + (ctx.predBonus || 0) + (ctx.predatorLevel || 0) + mods.predBonus + (beh.predAdd || 0);

    var climateMod = env.climate === 'zimno' ? 0.7 : (env.climate === 'cieplo' ? 1.1 : 1.0);
    if (env.climate === 'zimno' && lineage.traits.indexOf('endothermy') !== -1) climateMod = 1.0;
    var oxygenMod = clamp(1 + (10 - env.oxygen) * 0.04, 0.7, 1.4);

    // Aklimatyzacja: w turze migracji linia słabiej zdobywa pokarm.
    var acclimatizing = ctx.nowTurn != null && lineage.migratedAt === ctx.nowTurn;
    var acclim = acclimatizing ? data.MIGRATION.acclimatizationFood : 1;
    var T = data.TROPHIC, diet = dietOf(lineage);
    var dietSwitching = ctx.nowTurn != null && lineage.dietChangedAt === ctx.nowTurn;
    if (dietSwitching) acclim *= T.switchFood;

    var foodIntake = lstat(es, 'feeding') * (food / 10) * climateMod * acclim * (beh.foodMult || 1) * (diet === 'miesozerca' ? T.meatBonus : 1);
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

    // Pojemność niszy (K): linie w tej samej niszy dzielą ją ze sobą.
    var C = data.CAPACITY;
    var kBase = Math.max(C.min, Math.round(C.perFood[lineage.niche] * food));
    var capacity = kBase;
    var load = (ctx.nicheLoad && ctx.nicheLoad[lineage.niche] != null) ? ctx.nicheLoad[lineage.niche] : (lineage.population || 0) + ((ctx.rivalLoad && ctx.rivalLoad[lineage.niche]) || 0);
    var webPressure = 0, preyBiomass = 0;
    if (ctx.web) {
      // Sieć troficzna: każda dieta ma własną pojemność i własnych konkurentów o pokarm.
      var ws = ctx.web[lineage.niche] || { herb: 0, omni: 0, carn: 0, rHerb: 0, rPred: 0 }, ei = ctx.eraIndex || 0;
      var kPlant = Math.max(C.min, Math.round(kBase * eraTrophic(T.plants[lineage.niche], ei)));
      var carnLoad = ws.carn + ws.rPred, herbTotal = ws.herb + ws.omni + ws.rHerb;
      preyBiomass = herbTotal - (diet === 'miesozerca' ? 0 : lineage.population);
      var kCarn = Math.max(Math.round(C.min * 0.5), Math.round(kBase * eraTrophic(T.ambientPrey[lineage.niche], ei) + T.preyEdible * Math.max(0, preyBiomass)));
      var totalLoad = herbTotal + carnLoad;
      if (diet === 'miesozerca') { capacity = kCarn; load = carnLoad; }
      else if (diet === 'wszystkozerca') { capacity = Math.round(T.omniMix * Math.max(kPlant, kCarn) + (1 - T.omniMix) * Math.min(kPlant, kCarn)); load = totalLoad; }
      else { capacity = kPlant; load = totalLoad - carnLoad; }
      // Własny mięsożerca w niszy zjada linie roślinożerne i wszystkożerne gracza.
      if (diet !== 'miesozerca') webPressure = Math.min(T.pressureMax, T.pressurePer * ws.carn / kBase);
    }
    var fill = load / capacity;
    var crowdLossRate = fill > 1 ? clamp((fill - 1) * C.crowdRate, 0, C.crowdMax) : 0;

    var predators = Math.max(0, (predBase + webPressure - (T.predShield[diet] || 0)) * (ctx.predMult || 1));
    var mobilityShield = lstat(es, 'mobility') * 0.4;
    var predationPressure = Math.max(0, predators - lstat(es, 'defense') - mobilityShield) * (beh.predPressureMult || 1) * mods.predMult;
    if (mods.noPredators) predationPressure = 0;
    var predationLossRate = clamp(predationPressure * 0.035 * strat.predLossMult, 0, 0.45);
    var starvationLossRate = netEnergy < 0 ? clamp(-netEnergy * 0.03 * strat.starveLossMult, 0, 0.5) : 0;
    var birthRate = netEnergy >= 0 ? clamp(0.03 * lstat(es, 'reproduction') * (1 + Math.max(0, energy) * 0.05), 0, 0.6) : 0;
    if (energy < 0) birthRate *= R.deficitBirthMult;  // życie z zapasów — słabszy rozród
    birthRate = clamp(birthRate * strat.birthMult * (beh.birthMult || 1) * mods.birthMult, 0, 0.8);
    // Wzrost logistyczny (theta-logistyczny): rozród słabnie wyraźnie dopiero blisko K.
    birthRate *= Math.max(0, 1 - Math.pow(Math.min(fill, 1), C.theta || 1));
    return { energy: energy, predationPressure: predationPressure, acclimatizing: acclimatizing, notes: eff.notes,
      predationLossRate: predationLossRate, starvationLossRate: starvationLossRate, birthRate: birthRate,
      diseaseLossRate: clamp(mods.diseaseLoss, 0, 0.9),
      capacity: capacity, nicheLoad: load, diet: diet, dietSwitching: dietSwitching, webPressure: round1(webPressure), preyBiomass: Math.round(Math.max(0, preyBiomass)), crowdLossRate: crowdLossRate, rivalLoad: (ctx.rivalLoad && ctx.rivalLoad[lineage.niche]) || 0, enemyRelease: mods.predMult < 1,
      reserveDraw: round1(reserveDraw), reservesAfter: reservesAfter, reservesCap: cap,
      behavior: beh === data.BEHAVIORS.brak ? 'brak' : lineage.behavior,
      behaviorBlocked: lineage.behavior && lineage.behavior !== 'brak' && beh === data.BEHAVIORS.brak };
  }
  // Łączna populacja żywych linii w każdej niszy (konkurencja o pojemność).
  function nicheLoad(state) {
    var m = {};
    state.lineages.forEach(function (l) { if (l.alive) m[l.niche] = (m[l.niche] || 0) + l.population; });
    return m;
  }
  // ---------- Dieta i sieć troficzna ----------
  function dietOf(l) { return (l && l.diet) || 'roslinozerca'; }
  function rivalKind(data, r) { return data.RIVALS.filter(function (k) { return k.id === r.kind; })[0]; }
  /* Biomasa w każdej niszy wg poziomu troficznego: linie gracza (roślinożerne, wszystkożerne,
     mięsożerne) i rywale (drapieżniki / reszta). `override` podmienia linię o tym samym id
     (prognozy hipotetyczne, np. „co jeśli zmienię dietę”). */
  function webFor(data, state, override) {
    var w = {};
    function slot(n) { return w[n] || (w[n] = { herb: 0, omni: 0, carn: 0, rHerb: 0, rPred: 0 }); }
    state.lineages.forEach(function (l0) {
      var l = (override && override.id === l0.id) ? override : l0;
      if (!l.alive) return;
      var d = dietOf(l), sl = slot(l.niche);
      sl[d === 'miesozerca' ? 'carn' : (d === 'wszystkozerca' ? 'omni' : 'herb')] += l.population;
    });
    (state.rivals || []).forEach(function (r) {
      if (!r.alive) return;
      var k = rivalKind(data, r);
      slot(r.niche)[k && k.role === 'predator' ? 'rPred' : 'rHerb'] += r.pop;
    });
    return w;
  }
  function eraTrophic(arr, eraIndex) { return arr[Math.min(eraIndex || 0, arr.length - 1)]; }

  // Populacja konkurentów w każdej niszy (zajmuje pojemność, którą dzieli z graczem).
  function rivalLoad(state) {
    var m = {};
    (state.rivals || []).forEach(function (r) { if (r.alive) m[r.niche] = (m[r.niche] || 0) + r.pop; });
    return m;
  }
  function contextFor(data, state, override) {
    var diff = difficultyOf(data, state);
    var load = nicheLoad(state), rl = rivalLoad(state);
    for (var k in rl) load[k] = (load[k] || 0) + rl[k];
    // Rywale-drapieżniki podnoszą presję w swojej niszy (silniejszy — mocniej).
    var rp = {};
    (state.rivals || []).forEach(function (r) {
      var k = data.RIVALS.filter(function (x) { return x.id === r.kind; })[0];
      if (r.alive && k && k.role === 'predator') rp[r.niche] = Math.min(data.RIVAL.predMax, (rp[r.niche] || 0) + r.strength * data.RIVAL.predPerStrength);
    });
    return { predatorLevel: state.predatorLevel || 0, predMult: diff.predMult, nowTurn: nowTurn(data, state),
      nicheLoad: load, rivalLoad: rl, rivalPred: rp, web: webFor(data, state, override), eraIndex: state.eraIndex };
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
    var d = computeDynamics(data, env, lineage, contextFor(data, state, lineage));
    var pop = lineage.population;
    var births = Math.round(pop * d.birthRate * alleeFactor(data, pop));
    var predD = Math.round(pop * d.predationLossRate);
    var starvD = Math.round(pop * d.starvationLossRate);
    var disD = Math.round(pop * d.diseaseLossRate);
    var crowdD = Math.round(pop * d.crowdLossRate);
    var proj = Math.max(0, pop + births - predD - starvD - disD - crowdD);
    var cat = hitsLineage(env.catastrophe, lineage) ? env.catastrophe : null;
    var impact = cat ? catastropheImpact(cat, lineage, difficultyOf(data, state), data) : null;
    var catD = impact ? Math.round(proj * impact.severity) : 0;
    proj -= catD;
    return { energy: round1(d.energy), predationPressure: round1(d.predationPressure),
      births: births, predationDeaths: predD, starvationDeaths: starvD, diseaseDeaths: disD, crowdDeaths: crowdD,
      catastropheDeaths: catD, capacity: d.capacity, nicheLoad: d.nicheLoad, rivalLoad: d.rivalLoad,
      diet: d.diet, preyBiomass: d.preyBiomass, webPressure: d.webPressure, dietSwitching: d.dietSwitching, enemyRelease: d.enemyRelease,
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
    if (tactics.diet && tactics.diet !== dietOf(lineage)) {
      l.diet = tactics.diet; l.dietChangedAt = nowTurn(data, state);
      l.reserves = Math.max(0, (l.reserves || 0) - data.TROPHIC.switchCost);
    }
    return forecast(data, state, l);
  }

  /* Prognoza z inną dietą — podgląd „co-jeśli”, łącznie z kosztem przestawienia (⚡ i osłabione żerowanie). */
  function forecastWithDiet(data, state, lineage, diet) {
    var l = clone(lineage);
    if (diet !== dietOf(lineage)) { l.diet = diet; l.dietChangedAt = nowTurn(data, state); l.reserves = Math.max(0, (l.reserves || 0) - data.TROPHIC.switchCost); }
    return forecast(data, state, l);
  }
  function canSetDiet(data, lineage, key) {
    var d = data.DIETS[key];
    if (!d) return { ok: false, error: 'Nieznana dieta.' };
    if (key === dietOf(lineage)) return { ok: true, error: null, same: true };
    if (d.requires && (lineage.traits || []).indexOf(d.requires) === -1) {
      var t = traitsById(data)[d.requires];
      return { ok: false, error: 'Wymaga cechy „' + (t ? t.name : d.requires) + '”.' };
    }
    if ((lineage.reserves || 0) < data.TROPHIC.switchCost) return { ok: false, error: 'Za mało rezerw energii (potrzeba ' + data.TROPHIC.switchCost + ' ⚡).' };
    return { ok: true, error: null };
  }
  function setDiet(data, state, id, key) {
    var now = nowTurn(data, state);
    return editLineage(state, id, function (n, l) {
      var can = canSetDiet(data, l, key);
      if (!can.ok) return can.error;
      if (can.same) return null;
      if (n) {
        l.diet = key; l.dietChangedAt = now; l.reserves = round1(Math.max(0, l.reserves - data.TROPHIC.switchCost));
        unlockKnowledge(n, 'diet');
      }
    });
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
    var c = opt.cost || {}, fx = opt.effects || {}, colony = null;
    if (c.reserves) l.reserves -= c.reserves;
    if (c.variation) l.variation -= c.variation;
    applyOutcome(data, n, l, opt, nowTurn(data, n), { name: ev.name, label: opt.label });
    if (fx.found) {
      colony = splitLineage(data, n, l, Math.floor(l.population * fx.found), l.name + ' (wyspa)',
        { variation: data.VARIATION.founder });
      // Skutki wyprawy dotyczą kolonii, nie linii macierzystej.
      (n.echoes || []).forEach(function (e) { if (e.pendingColony) { e.lineageId = colony.id; delete e.pendingColony; } });
    }
    // Ryzykowna opcja: wynik losowany dopiero w turze (szansa zależy od cech linii w tej chwili).
    n.pendingGamble = opt.gamble ? { eventId: ev.id, optionId: opt.id, lineageId: l.id } : null;
    n.pendingChoice = null;
    n.resolvedChoice = { eventId: ev.id, name: ev.name, option: opt.label, lineageId: l.id, lineageName: l.name,
      colonyName: colony ? colony.name : null };
  }
  /* Skutek opcji lub wyniku ryzyka: `effects` { stats, reserves, variation, predatorLevel,
     ep, popLoss, popGain } działa od razu, `turnMod`/`nextMod` — w tej / następnej turze.
     Zwraca zmianę populacji (popLoss/popGain), by raport mógł ją podać. */
  function applyOutcome(data, n, l, o, now, src) {
    var fx = o.effects || {}, V = data.VARIATION, popDelta = 0;
    if (fx.stats) applyEffects(l, fx.stats);
    if (fx.reserves) l.reserves = round1(clamp((l.reserves || 0) + fx.reserves, 0, reservesCap(data, l)));
    if (fx.variation) l.variation = clamp((l.variation || 0) + fx.variation, 0, V.cap);
    if (fx.predatorLevel) n.predatorLevel = clamp((n.predatorLevel || 0) + fx.predatorLevel, 0, 12);
    if (fx.ep) n.ep = Math.max(0, n.ep + fx.ep);
    if (fx.rivalHit) hitRivals(data, n, l.niche, fx.rivalHit);
    if (fx.popLoss) popDelta -= Math.round(l.population * fx.popLoss);
    if (fx.popGain) popDelta += Math.round(l.population * fx.popGain);
    if (popDelta) {
      l.population = Math.max(0, l.population + popDelta);
      l.popHistory[l.popHistory.length - 1] = l.population;
      if (l.population > l.peakPopulation) l.peakPopulation = l.population;
    }
    if (o.turnMod) l.mods.push(Object.assign({ turn: now }, o.turnMod));
    if (o.nextMod) l.mods.push(Object.assign({ turn: now + 1 }, o.nextMod));
    if (o.knowledge) unlockKnowledge(n, o.knowledge);
    if (o.echo) scheduleEcho(n, o.echo, l.id, now, src);
    return popDelta;
  }
  /* Szansa powodzenia ryzykownej opcji: bazowa + premia za statystykę linii
     (np. obrona przy odstraszaniu drapieżnika), w granicach 5–95%. */
  function gambleChance(data, lineage, gamble) {
    var p = gamble.chance || 0.5;
    if (gamble.stat) p += (gamble.per || 0) * (lstat(lineage, gamble.stat) - (gamble.from || 0));
    return clamp(p, 0.05, 0.95);
  }
  function resolveGamble(data, n, rng) {
    var g = n.pendingGamble; n.pendingGamble = null;
    if (!g) return null;
    var ev = choiceEvent(data, g.eventId), opt = choiceOption(ev, g.optionId), l = getLineage(n, g.lineageId);
    if (!opt || !opt.gamble || !l || !l.alive) return null;
    var chance = gambleChance(data, l, opt.gamble), win = rng() < chance;
    var out = win ? opt.gamble.win : opt.gamble.lose;
    var popDelta = applyOutcome(data, n, l, out, nowTurn(data, n), { name: ev.name, label: opt.label });
    return { win: win, chance: Math.round(chance * 100), text: out.text, popDelta: popDelta,
      knowledge: out.knowledge || null };
  }
  /* Echo decyzji: po `after` turach wraca karta-następstwo dla tej samej linii. Przy
     zakładaniu kolonii echo należy do kolonii (pendingColony ustawia applyChoice). */
  function scheduleEcho(n, echo, lineageId, now, src) {
    n.echoes = n.echoes || [];
    var e = { eventId: echo.id, lineageId: lineageId, due: now + (echo.after || 2), from: src ? src.name : null, option: src ? src.label : null };
    if (echo.id === 'island_echo') e.pendingColony = true;
    n.echoes.push(e);
  }
  // Uderzenie w konkurentów w niszy (np. wyparcie): odejmuje ułamek populacji.
  function hitRivals(data, n, niche, frac) {
    (n.rivals || []).forEach(function (r) {
      if (!r.alive || r.niche !== niche) return;
      r.pop = Math.max(0, Math.round(r.pop * (1 - frac)));
      if (r.pop < data.RIVAL.extinctBelow) { r.alive = false; r.pop = 0; n.rivalsDisplaced = (n.rivalsDisplaced || 0) + 1; }
    });
  }
  function nicheCapacity(data, env, niche) {
    var food = envForNiche(data, env, niche).food, C = data.CAPACITY;
    return Math.max(C.min, Math.round(C.perFood[niche] * food));
  }
  /* Ruch konkurentów: zbliżają się do swojego udziału pojemności niszy, pomniejszonego
     o presję gracza (wypieranie), a katastrofy ich też uderzają. Zwraca wpisy do raportu. */
  function updateRivals(data, n, env, rng, diff) {
    var R = data.RIVAL, out = [], load = nicheLoad(n);
    (n.rivals || []).forEach(function (r) {
      if (!r.alive) return;
      var before = r.pop, note = null, cap = nicheCapacity(data, env, r.niche);
      var share = clamp(R.baseShare + R.perStrength * r.strength, 0, R.maxShare);
      var target = Math.max(0, cap * share - R.playerPressure * (load[r.niche] || 0));
      var pop = r.pop + (target - r.pop) * R.follow;
      if (env.catastrophe && (env.catastrophe.niche === 'all' || env.catastrophe.niche === r.niche)) {
        pop *= 1 - clamp(catastropheSeverity(env.catastrophe, r.niche) * diff.catMult * R.catMult, 0, 0.95);
        note = 'Katastrofa uderzyła też w konkurenta.';
      }
      r.pop = Math.max(0, sround(pop, rng));
      r.strength = Math.min(R.strengthMax, r.strength + R.strengthGain * (0.5 + rng()));
      if (r.pop < R.extinctBelow) {
        r.alive = false; r.pop = 0; n.rivalsDisplaced = (n.rivalsDisplaced || 0) + 1;
        note = (env.catastrophe ? 'Wymarli w katastrofie' : 'Wyparci przez Twoją linię i głód — wymarli') + '.';
      }
      out.push({ id: r.id, name: r.name, icon: r.icon, niche: r.niche, popBefore: before, popAfter: r.pop, alive: r.alive, note: note });
    });
    return out;
  }
  // Pojawienie się nowego konkurenta w niszy, w której żyje gracz (era decyduje o gatunku).
  function spawnRival(data, n, rng, gNow) {
    var R = data.RIVAL, alive = (n.rivals || []).filter(function (r) { return r.alive; });
    if (n.status !== 'playing' || gNow < R.firstTurn || alive.length >= R.max || rng() >= R.spawnChance) return null;
    var occupied = nicheLoad(n), rl = rivalLoad(n);
    var kinds = data.RIVALS.filter(function (k) {
      return n.eraIndex >= k.minEra && n.eraIndex <= k.maxEra &&
        !(n.rivals || []).some(function (r) { return r.alive && r.kind === k.id; }) &&
        k.niches.some(function (nn) { return occupied[nn]; });
    });
    if (!kinds.length) return null;
    var kind = kinds[Math.floor(rng() * kinds.length)];
    var opts = kind.niches.filter(function (nn) { return occupied[nn] && !rl[nn]; });
    if (!opts.length) opts = kind.niches.filter(function (nn) { return occupied[nn]; });
    var niche = opts[Math.floor(rng() * opts.length)];
    var env = currentTurnEnv(data, n);
    if (!env) return null;
    var cap = nicheCapacity(data, env, niche);
    var r = { id: 'R' + (n.nextRivalNum++), kind: kind.id, name: kind.name, icon: kind.icon, niche: niche, alive: true,
      pop: Math.max(R.extinctBelow + 5, Math.round(cap * R.startShare)), strength: 2 + n.eraIndex, bornTurn: gNow };
    n.rivals = (n.rivals || []).concat([r]);
    unlockKnowledge(n, 'competition');
    return { id: r.id, name: r.name, icon: r.icon, niche: niche, text: 'W niszy „' + data.NICHES[niche].label.toLowerCase() + '” pojawia się konkurent: ' + kind.name.toLowerCase() + '.' };
  }
  // Konkurenci żyjący w niszy linii (do kart decyzji i UI).
  function rivalsIn(state, niche) { return (state.rivals || []).filter(function (r) { return r.alive && r.niche === niche; }); }

  // Czy karta pasuje do linii i chwili: minimalna populacja, era, nisze.
  function choiceFits(e, n, l) {
    if (e.chain) return false;                       // karty-echa wracają tylko jako skutek decyzji
    if (e.needsRival && !rivalsIn(n, l.niche).length) return false;
    if (e.minPop && l.population < e.minPop) return false;
    if (e.minEra != null && n.eraIndex < e.minEra) return false;
    if (e.niches && e.niches.indexOf(l.niche) === -1) return false;
    return true;
  }
  // Losowanie karty decyzji na następną turę (bez katastrofy).
  function rollChoice(data, n, rng) {
    if (n.status !== 'playing' || !n.env || n.env.conditions.catastrophe) return null;
    // Echo wcześniejszej decyzji: pierwszeństwo przed losową kartą; martwa linia nie dostaje echa.
    var now = nowTurn(data, n);
    n.echoes = (n.echoes || []).filter(function (e) { var el = getLineage(n, e.lineageId); return el && el.alive; });
    var due = n.echoes.filter(function (e) { return e.due <= now; })[0];
    if (due) {
      n.echoes = n.echoes.filter(function (e) { return e !== due; });
      n.echoesSeen = (n.echoesSeen || 0) + 1;
      return { eventId: due.eventId, lineageId: due.lineageId, turn: now, echoOf: { name: due.from, option: due.option } };
    }
    if (!data.CHOICE_EVENTS || rng() >= (data.CHOICE_CHANCE || 0)) return null;
    var alive = aliveLineages(n); if (!alive.length) return null;
    var l = alive[Math.floor(rng() * alive.length)];
    var pool = data.CHOICE_EVENTS.filter(function (e) { return choiceFits(e, n, l); });
    // Bez powtórek: karta, która już padła, wraca dopiero, gdy pula się wyczerpie.
    var seen = n.choiceHistory || [];
    var fresh = pool.filter(function (e) { return seen.indexOf(e.id) === -1; });
    if (fresh.length) pool = fresh;
    else if (pool.length > 1) pool = pool.filter(function (e) { return e.id !== seen[seen.length - 1]; });
    if (!pool.length) return null;
    var ev = pool[Math.floor(rng() * pool.length)];
    n.choiceHistory = seen.concat([ev.id]);
    var pcard = { eventId: ev.id, lineageId: l.id, turn: nowTurn(data, n) };
    if (ev.needsRival) pcard.rivalName = rivalsIn(n, l.niche)[0].name;
    return pcard;
  }

  // ---------- Symulacja tury ----------
  function simulateTurn(data, state, rng) {
    if (state.status !== 'playing') return { state: state, report: null };
    var n = clone(state);
    rng = rng || (n.seed ? stateRng(n) : Math.random);
    var gNow = nowTurn(data, n);
    // Strumień świata: przy kodzie świata zależy tylko od kodu i tury.
    function W(salt) { return n.seed ? worldRngFor(n.seed, salt + ':' + gNow) : rng; }
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
    var gamble = resolveGamble(data, n, rng);
    if (gamble) {
      if (choice) choice = Object.assign({}, choice, { outcome: gamble });
      if (gamble.knowledge) knowledge.push(gamble.knowledge);
    }

    var lineReports = [];
    var totalEp = 0, anyAlive = false;

    var ctx = contextFor(data, n);

    var nichesPaid = {}, popBeforeAll = totalPopulation(n);
    aliveLineages(n).forEach(function (l) {
      var r = simulateLineage(data, n, l, env, rng, knowledge, ctx, diff, nichesPaid);
      lineReports.push(r); totalEp += r.epGain; if (l.alive) anyAlive = true;
    });
    // Premie globalne: za przetrwanie i za inteligencję NAJLEPSZEJ linii — liczone
    // raz, by specjacja nie mnożyła punktów.
    // EP za liczebność i wzrost — z łącznej populacji wszystkich linii (podział
    // gatunku nie traci punktów na zaokrągleniach).
    var popAfterAll = totalPopulation(n), R = data.EP_RULES;
    var epPopulation = anyAlive ? Math.floor(popAfterAll / R.perPopulation) : 0;
    var epGrowth = anyAlive ? Math.max(0, Math.floor((popAfterAll - popBeforeAll) / R.perGrowth)) : 0;
    totalEp += epPopulation + epGrowth;
    // Radiacja: każda kolejna zajęta nisza to nowe okazje do ewolucji.
    var occupied = Object.keys(nicheLoad(n)).length;
    var epRadiation = anyAlive ? Math.max(0, occupied - 1) * (R.perExtraNiche || 0) : 0;
    totalEp += epRadiation;
    var goalsDone = evaluateEraGoals(data, n, env, lineReports, n.turn + 1 >= era.turns.length);
    goalsDone.forEach(function (g) { if (g.status === 'done') totalEp += g.reward; });
    var epBase = anyAlive ? data.EP_RULES.base : 0;
    var epIntel = anyAlive ? Math.floor(maxIntelligence(n) / data.EP_RULES.intelligenceDiv) : 0;
    totalEp += epBase + epIntel;
    n.ep += totalEp;

    var rivalReports = updateRivals(data, n, env, W('rival'), diff);
    if (rivalReports.length) knowledge.push('competition');

    // Koewolucja: presja drapieżników „dogania” dobrze bronione linie.
    var predBefore = n.predatorLevel || 0;
    var target = Math.max(0, (maxDefense(n) - data.BASE_STATS.defense) * 0.7) * diff.coevo;
    n.predatorLevel = clamp((n.predatorLevel || 0) + (target - (n.predatorLevel || 0)) * 0.35, 0, 12);
    if (n.predatorLevel > 2) unlockKnowledge(n, 'coevolution');
    var shared = {}, niches = 0;
    aliveLineages(n).forEach(function (l) { shared[l.niche] = (shared[l.niche] || 0) + 1; });
    for (var nk in shared) { niches++; if (shared[nk] > 1) knowledge.push('competition'); }
    if (niches > 1) knowledge.push('radiation');

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
    fixRegional(data, n);
    n.env = n.status === 'playing' ? rollEnv(data, n, n.eraIndex, n.turn, W('env')) : null;
    if (n.status === 'won') n.winPath = winningPath(n, data);
    // Po turze stare modyfikatory wygasają (zachowanie zostaje do zmiany przez gracza).
    var nextT = nowTurn(data, n);
    n.lineages.forEach(function (l) {
      l.mods = (l.mods || []).filter(function (m) { return m.turn >= nextT; });
    });
    var rivalSpawn = spawnRival(data, n, W('rival2'), nowTurn(data, n));
    n.pendingChoice = rollChoice(data, n, W('choice'));

    var report = {
      eraIndex: prevEraIndex, eraName: era.name, turnIndex: state.turn,
      envTitle: env.title, envNote: env.note, climate: env.climate,
      catastrophe: env.catastrophe || null,
      choice: choice || null,
      rivalReports: rivalReports, rivalSpawn: rivalSpawn,
      lineReports: lineReports, epGain: totalEp, epBase: epBase, epIntel: epIntel, goals: goalsDone,
      threat: upcomingThreat(data, n),
      epPopulation: epPopulation, epGrowth: epGrowth, epRadiation: epRadiation,
      predatorLevel: round1(n.predatorLevel), predatorDelta: round1(n.predatorLevel - predBefore),
      totalPopulation: totalPopulation(n), maxIntelligence: maxIntelligence(n),
      intelligenceGoal: n.intelligenceGoal, eraChanged: eraChanged,
      newEraName: eraChanged ? data.ERAS[n.eraIndex].name : null,
      knowledge: dedupe(knowledge),
      // Pojęcia odkryte w tej turze — raport pokazuje je w całości, znane tylko przypomina.
      newKnowledge: dedupe(knowledge).filter(function (k) { return state.unlockedKnowledge.indexOf(k) === -1; }),
      status: n.status
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
    var crowdDeaths = sround(popBefore * d.crowdLossRate, rng);
    var carn = d.diet === 'miesozerca';
    if (crowdDeaths > 0) { events.push((carn ? 'Za mało zdobyczy dla drapieżników (' : 'Nisza przepełniona (') + d.nicheLoad + ' / ' + d.capacity + ') — ' + crowdDeaths + ' osobników zginęło z głodu' + (carn ? '.' : ' i przegęszczenia.')); knowledge.push(carn ? 'trophic_cascade' : 'capacity'); }
    else if (d.nicheLoad >= d.capacity * data.CAPACITY.warnAt) { events.push((carn ? 'Zdobyczy jest coraz mniej (' : 'Nisza bliska pojemności (') + d.nicheLoad + ' / ' + d.capacity + ') — rozród słabnie.'); knowledge.push(carn ? 'trophic_cascade' : 'capacity'); }
    if (carn) knowledge.push('trophic');
    if (d.dietSwitching) events.push('Zmiana diety — w tej turze linia żeruje słabiej.');
    if (d.webPressure >= 0.3) { events.push('Mięsożerna gałąź Twojej rodziny poluje na tę linię (presja drapieżników +' + num1(d.webPressure) + ').'); knowledge.push('trophic_cascade'); }
    if (d.enemyRelease) events.push('Nowy gatunek — miejscowe drapieżniki jeszcze na niego nie polują.');
    if (diseaseDeaths > 0) events.push('Choroba zabiła ' + diseaseDeaths + ' osobników.');
    var pop = popBefore + births - predationDeaths - starvationDeaths - diseaseDeaths - crowdDeaths;

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
    if (d.predationLossRate > 0.15) {
      events.push('Silna presja drapieżników: zginęło ' + predationDeaths + ' osobników (' + Math.round(d.predationLossRate * 100) +
        '% populacji) — drapieżniki przewyższają obronę linii o ' + num1(d.predationPressure) + '.');
      knowledge.push('predation');
    }
    if (d.starvationLossRate > 0) { events.push('Ujemny bilans energetyczny — głód.'); knowledge.push('starvation'); }
    if (env.climate === 'zimno') knowledge.push('cold');
    if (l.niche !== 'woda') knowledge.push('niche');

    if (pop <= 0 && l.alive) {
      l.alive = false; l.extinctGlobalTurn = globalTurn(data, n.eraIndex, n.turn) + 1;
      events.push('Ta linia wymarła.');
    }

    // Rozbicie EP — czytelne, skąd pochodzą punkty. Premia za niszę raz na
    // zajętą niszę (nagradza dywersyfikację, a nie liczbę linii).
    var nicheBonus = 0;
    if (pop > 0 && !nichesPaid[l.niche]) { nicheBonus = data.NICHES[l.niche].epBonus || 0; nichesPaid[l.niche] = true; }
    var bd = { niche: nicheBonus };
    var epGain = bd.niche;

    return {
      lineageId: l.id, name: l.name, niche: l.niche, diet: d.diet, preyBiomass: d.preyBiomass, webPressure: d.webPressure,
      popBefore: popBefore, popAfter: pop,
      births: births, predationDeaths: predationDeaths, starvationDeaths: starvationDeaths, catDeaths: catDeaths,
      diseaseDeaths: diseaseDeaths, crowdDeaths: crowdDeaths, capacity: d.capacity, nicheLoad: d.nicheLoad, rivalLoad: d.rivalLoad,
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

  function winPaths(data) { return data.WIN_PATHS || (data.WIN_TRAIT ? [{ id: 'tools', trait: data.WIN_TRAIT }] : []); }
  // Droga do rozumu, którą linia spełnia: cecha kultury w pasującej niszy.
  function winPathOf(data, l) {
    var ps = winPaths(data);
    if (!ps.length) return { id: 'none' };
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (l.traits.indexOf(p.trait) !== -1 && (!p.niches || p.niches.indexOf(l.niche) !== -1)) return p;
    }
    return null;
  }
  // Linia spełnia warunki „rozumu”: próg inteligencji i kultura (WIN_PATHS) w swojej niszy.
  function meetsWinTraits(n, data, l) {
    return l.alive && l.population > 0 && l.stats.intelligence >= n.intelligenceGoal && !!winPathOf(data, l);
  }
  // Kultura jest, ale w niszy, w której nie działa (np. narzędzia w otwartym morzu).
  function cultureNicheBlocked(n, data) {
    return n.lineages.filter(function (l) {
      return l.alive && !winPathOf(data, l) && winPaths(data).some(function (p) { return l.traits.indexOf(p.trait) !== -1; });
    }).map(function (l) {
      var p = winPaths(data).filter(function (q) { return l.traits.indexOf(q.trait) !== -1; })[0];
      return { lineageId: l.id, name: l.name, path: p };
    });
  }
  function winningPath(n, data) {
    var w = n.lineages.filter(function (l) { return meetsWinTraits(n, data, l) && l.population >= (data.WIN_MIN_POP || 0); })[0];
    var p = w && winPathOf(data, w);
    return p ? p.id : null;
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

  // ---------- Cele ery ----------
  function pickEraGoals(data, seed, startEra) {
    var out = [], per = data.ERA_GOALS_PER_ERA || 0;
    for (var e = startEra || 0; e < data.ERAS.length; e++) {
      var pool = (data.ERA_GOALS || []).filter(function (g) { return !g.eras || g.eras.indexOf(e) !== -1; }).slice();
      var r = worldRngFor(seed, 'goals:' + e);
      for (var k = 0; k < per && pool.length; k++) {
        var g = pool.splice(Math.floor(r() * pool.length), 1)[0];
        out.push({ era: e, id: g.id, status: 'open' });
      }
    }
    return out;
  }
  function goalDef(data, id) { return (data.ERA_GOALS || []).filter(function (g) { return g.id === id; })[0]; }
  function goalMet(data, n, def, ctx) {
    var alive = aliveLineages(n);
    switch (def.type) {
      case 'niche': return alive.some(function (l) { return l.niche === def.niche; });
      case 'lineages': return alive.length >= def.min;
      case 'population': return totalPopulation(n) >= def.min;
      case 'stat': return alive.some(function (l) { return lstat(l, def.stat) >= def.min; });
      case 'reserves': return alive.some(function (l) { return (l.reserves || 0) >= def.min; });
      case 'variation': return alive.some(function (l) { return (l.variation || 0) >= def.min; });
      case 'niches': return Object.keys(nicheLoad(n)).length >= def.min;
      case 'catLoss': return ctx.catLoss != null && ctx.catLoss <= def.max;
      case 'noStarvation': return !ctx.starved;
    }
    return false;
  }
  /* Sprawdza cele ery bieżącej tury; zwraca cele, które właśnie się rozstrzygnęły
     (z nagrodą — dodaje ją wywołujący). */
  function evaluateEraGoals(data, n, env, lineReports, eraEnd) {
    var out = [], era = n.eraIndex;
    var before = 0, catDeaths = 0, starved = false;
    lineReports.forEach(function (r) { before += r.popBefore; catDeaths += r.catDeaths; if (r.starvationDeaths > 0) starved = true; });
    var ctx = { catLoss: env.catastrophe ? (before ? catDeaths / before : 0) : null, starved: starved };
    (n.eraGoals || []).forEach(function (g) {
      if (g.era !== era || g.status !== 'open') return;
      var def = goalDef(data, g.id); if (!def) return;
      if (def.type === 'noStarvation' && starved) g.status = 'failed';
      else if (!def.atEnd && goalMet(data, n, def, ctx)) g.status = 'done';
      else if (eraEnd) g.status = (def.atEnd && goalMet(data, n, def, ctx)) ? 'done' : 'failed';
      if (g.status !== 'open') out.push({ id: g.id, label: def.label, status: g.status, reward: def.reward });
    });
    return out;
  }

  // ---------- Czy zwycięstwo jest jeszcze możliwe? ----------
  function missingTraits(byId, l, id, acc) {
    acc = acc || [];
    if (l.traits.indexOf(id) !== -1 || acc.indexOf(id) !== -1) return acc;
    var t = byId[id]; if (!t) return acc;
    t.requires.forEach(function (r) { missingTraits(byId, l, r, acc); });
    acc.push(id);
    return acc;
  }
  /* Hojne oszacowanie z góry: optymistyczny wzrost populacji (z efektem Allee) i
     przychód EP. Zwraca { possible, reasons } — „niemożliwe” tylko wtedy, gdy
     nawet przy najlepszym przebiegu żadna linia nie zdąży spełnić warunków. */
  function victoryOutlook(data, state) {
    if (state.status !== 'playing') return { possible: state.status === 'won', reasons: [], turnsLeft: 0 };
    var O = data.OUTLOOK || { growth: 0.45, epPerTurn: 40 }, byId = traitsById(data);
    var R = totalTurns(data) - elapsedTurns(data, state), mvp = data.MIN_VIABLE_POP || 1;
    var popOkAny = false, pathOkAny = false, possible = false;
    aliveLineages(state).forEach(function (l) {
      var p = l.population;
      for (var i = 0; i < R; i++) p += p * O.growth * Math.min(1, p / mvp);
      var popOk = p >= (data.WIN_MIN_POP || 0);
      var epMax = state.ep + O.epPerTurn * Math.max(0, R - 1);
      var pathOk = winPaths(data).some(function (path) {
        var miss = missingTraits(byId, l, path.trait), cost = 0, intel = lstat(l, 'intelligence');
        miss.forEach(function (id) { cost += byId[id].cost; intel += (byId[id].effects.intelligence || 0); });
        if (l.traits.indexOf('brain') !== -1 || miss.indexOf('brain') !== -1) intel += R;
        return cost <= epMax && intel >= state.intelligenceGoal;
      });
      if (popOk) popOkAny = true;
      if (pathOk) pathOkAny = true;
      if (popOk && pathOk) possible = true;
    });
    var reasons = [];
    if (!possible) {
      if (!popOkAny) reasons.push('populacja nie zdąży odrosnąć do ' + data.WIN_MIN_POP + ' osobników przed końcem gry');
      if (!pathOkAny) reasons.push('nie da się już uzbierać punktów ewolucji na brakujące cechy albo dojść do progu inteligencji');
      if (popOkAny && pathOkAny) reasons.push('żadna linia nie zdąży jednocześnie odbudować populacji i zdobyć kultury');
    }
    return { possible: possible, reasons: reasons, turnsLeft: R };
  }
  // Zakończenie partii na życzenie gracza: przetrwanie, jeśli jest żywotna linia.
  function concede(data, state) {
    if (state.status !== 'playing') return state;
    var n = clone(state);
    n.status = hasViableLineage(n, data) ? 'survived' : 'lost';
    n.endReason = n.status === 'lost' ? (totalPopulation(n) > 0 ? 'nonviable' : 'extinct') : null;
    n.conceded = true; n.pendingChoice = null;
    return n;
  }

  // ---------- Wynik i osiągnięcia ----------
  function gameStats(data, state) {
    var st = { maxNiches: 0, maxPop: totalPopulation(state), minPop: Infinity, gamblesWon: 0, sky: false, permLoss: null,
      goalsDone: 0, goalsTotal: (state.eraGoals || []).length };
    (state.history || []).forEach(function (r) {
      var niches = {}, before = 0, cd = 0;
      r.lineReports.forEach(function (lr) {
        if (lr.alive) { niches[lr.niche] = 1; if (lr.niche === 'powietrze') st.sky = true; }
        before += lr.popBefore; cd += lr.catDeaths;
      });
      st.maxNiches = Math.max(st.maxNiches, Object.keys(niches).length);
      st.maxPop = Math.max(st.maxPop, r.totalPopulation);
      st.minPop = Math.min(st.minPop, r.totalPopulation);
      if (r.choice && r.choice.outcome && r.choice.outcome.win) st.gamblesWon++;
      if (r.catastrophe && /permsk/.test(r.catastrophe.name)) st.permLoss = before ? cd / before : 0;
    });
    aliveLineages(state).forEach(function (l) { if (l.niche === 'powietrze') st.sky = true; });
    st.goalsDone = (state.eraGoals || []).filter(function (g) { return g.status === 'done'; }).length;
    st.webTurns = 0;
    (state.history || []).forEach(function (r) {
      var ds = {}; r.lineReports.forEach(function (lr) { if (lr.alive && lr.diet) ds[lr.diet] = 1; });
      if (ds.roslinozerca && ds.miesozerca) st.webTurns++;
    });
    st.rivalsDisplaced = state.rivalsDisplaced || 0; st.echoes = state.echoesSeen || 0;
    st.turnsLeft = state.status === 'won' ? totalTurns(data) - elapsedTurns(data, state) : 0;
    return st;
  }
  function earnedAchievements(data, state) {
    var st = gameStats(data, state), won = state.status === 'won', out = [];
    function add(id, cond) { if (cond) out.push(id); }
    add('first_win', won);
    add('tools_win', won && state.winPath === 'tools');
    add('sound_win', won && state.winPath === 'sound');
    add('hard_win', won && state.difficulty === 'trudny');
    add('early_win', won && st.turnsLeft >= 2);
    add('phoenix', won && st.minPop < 30);
    add('radiation', st.maxNiches >= 4);
    add('sky', st.sky);
    add('perm', st.permLoss != null && st.permLoss < 0.3);
    add('gambler', st.gamblesWon >= 3);
    add('goals', st.goalsTotal > 0 && st.goalsDone === st.goalsTotal);
    add('abundance', st.maxPop >= 600);
    add('gause', st.rivalsDisplaced >= 2);
    add('web', st.webTurns >= 3);
    add('echo', st.echoes >= 2);
    add('codex', (state.unlockedKnowledge || []).length >= 25);
    return out;
  }
  function scoreGame(data, state) {
    var S = data.SCORE, st = gameStats(data, state), parts = [];
    function part(label, pts) { if (pts) parts.push({ label: label, points: Math.round(pts) }); }
    part(state.status === 'won' ? 'Zwycięstwo' : (state.status === 'survived' ? 'Przetrwanie' : 'Wymarcie'),
      state.status === 'won' ? S.won : (state.status === 'survived' ? S.survived : 0));
    part('Inteligencja', S.perIntelligence * maxIntelligence(state));
    part('Populacja końcowa', Math.min(S.popMax, Math.floor(totalPopulation(state) / S.popDiv)));
    part('Cele er', S.perGoal * st.goalsDone);
    part('Nisze zajęte jednocześnie', S.perNiche * st.maxNiches);
    part('Tury zapasu', S.perTurnLeft * st.turnsLeft);
    part('Osiągnięcia', S.perAchievement * earnedAchievements(data, state).length);
    var sum = parts.reduce(function (a, p) { return a + p.points; }, 0);
    var mult = (S.diffMult && S.diffMult[state.difficulty]) || 1;
    return { parts: parts, subtotal: sum, mult: mult, total: Math.round(sum * mult) };
  }

  /* Epilog zakończenia: przy zwycięstwie „Antropocen” (skutki rozumu dla świata, dobrane
     z przebiegu partii), przy przetrwaniu tytuł zależny od stylu gry. Nic tu nie zmienia wyniku. */
  function epilogue(data, state) {
    var E = data.ENDINGS, st = gameStats(data, state), lostLines = state.lineages.filter(function (l) { return !l.alive; }).length;
    if (state.status === 'won') {
      var paras = [E.anthropocene.intro[state.winPath === 'sound' ? 'sound' : 'tools']], picked = [];
      var conds = { rivals: st.rivalsDisplaced >= 1, lost_lines: lostLines >= 2, radiation: st.maxNiches >= 3, 'default': true };
      E.anthropocene.impacts.forEach(function (im) { if (conds[im.when] && picked.length < 2) { picked.push(im.text); } });
      return { kind: 'anthropocene', title: E.anthropocene.title, paragraphs: paras.concat(picked, [E.anthropocene.outro]) };
    }
    if (state.status === 'survived') {
      var c = { sky: st.sky, radiation: st.maxNiches >= 3, legion: st.maxPop >= 600, phoenix: st.minPop < 30, 'default': true };
      var lg = E.legacy.filter(function (x) { return c[x.when]; })[0];
      return { kind: 'legacy', title: lg.title, paragraphs: [lg.text] };
    }
    return null;
  }

  function statLabel(k) {
    return ({ feeding: 'odżywianie', defense: 'obrona', reproduction: 'rozród',
      mobility: 'mobilność', metabolism: 'metabolizm', intelligence: 'inteligencja' })[k] || k;
  }

  return {
    createInitialState: createInitialState,
    currentEra: currentEra, currentTurnEnv: currentTurnEnv, globalTurn: globalTurn, totalTurns: totalTurns,
    turnBase: turnBase, upcomingThreat: upcomingThreat, eraTimeline: eraTimeline,
    randomSeed: randomSeed, normalizeSeed: normalizeSeed,
    winPathOf: winPathOf, cultureNicheBlocked: cultureNicheBlocked, goalDef: goalDef,
    victoryOutlook: victoryOutlook, concede: concede,
    epilogue: epilogue, rivalsIn: rivalsIn, gameStats: gameStats, earnedAchievements: earnedAchievements, scoreGame: scoreGame,
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
    reservesCap: reservesCap, forecastWithTactics: forecastWithTactics, nicheLoad: nicheLoad,
    setDiet: setDiet, canSetDiet: canSetDiet, forecastWithDiet: forecastWithDiet, dietOf: dietOf, webFor: webFor,
    choiceEvent: choiceEvent, gambleChance: gambleChance, canChoose: canChoose, resolveChoice: resolveChoice, defaultOption: defaultOption,
    forecast: forecast, forecastWithTrait: forecastWithTrait, simulateTurn: simulateTurn, evaluateStatus: evaluateStatus, statLabel: statLabel,
    _internals: { rollMutation: rollMutation, sround: sround, alleeFactor: alleeFactor, clamp: clamp, computeDynamics: computeDynamics }
  };
});
