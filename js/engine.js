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
 * Funkcje mutujące zwracają NOWY stan (kopię) — na tym opiera się cofanie tury.
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
     kodu świata i numeru tury — przy tym samym kodzie wszyscy grają w tym samym
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

  var DATA_REF = null;  // traitStatus bez `data` (starsze wywołania) — bez zniżek i wykluczeń zwrotnych
  function traitsById(data) { var m = {}; data.TRAITS.forEach(function (t) { m[t.id] = t; }); return m; }

  function makeLineage(id, name, parentId, population, stats, traits, niche, bornEra, bornTurn, res) {
    res = res || {};
    return {
      id: id, name: name, parentId: parentId,
      population: population, peakPopulation: population,
      stats: clone(stats), traits: traits.slice(), niche: niche || 'woda',
      bodyPlan: 'kregowiec',              // plan budowy do rysunku: kregowiec | stawonog | glowonog
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
  /* Prolog: dla każdego etapu bierze wybraną opcję (nieznane id pomija) i nakłada jej skutki
     na linię startową. Zwraca { picked, knowledge, ep }. */
  function applyPrologue(data, root, ids) {
    var out = { picked: [], knowledge: [], ep: 0 };
    (data.PROLOGUE || []).forEach(function (stage, i) {
      var opt = stage.options.filter(function (o) { return (ids || [])[i] === o.id; })[0];
      if (!opt) return;
      var fx = opt.effects || {};
      if (fx.stats) applyEffects(root, fx.stats);
      if (fx.reserves) root.reserves = clamp((root.reserves || 0) + fx.reserves, 0, reservesCap(data, root));
      if (fx.variation) root.variation = clamp((root.variation || 0) + fx.variation, 0, data.VARIATION.cap);
      if (fx.ep) out.ep += fx.ep;
      if (opt.knowledge && out.knowledge.indexOf(opt.knowledge) === -1) out.knowledge.push(opt.knowledge);
      out.picked.push(opt.id);
    });
    return out;
  }
  // Nazwy wybranych opcji prologu (do ekranu końcowego i eksportu).
  function prologueLabels(data, state) {
    return (state.prologue || []).map(function (id) {
      var o = null;
      data.PROLOGUE.forEach(function (st) { st.options.forEach(function (x) { if (x.id === id) o = x; }); });
      return o ? o.label : id;
    });
  }

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

    // Prolog (prekambr): wybrane opcje zmieniają linię i zasoby na starcie.
    var prologue = applyPrologue(data, root, opts.prologue);
    if (prologue.ep) ep += prologue.ep;

    var seed = normalizeSeed(opts.seed);
    // Reguły scenariusza: dozwolone drogi do rozumu, mnożniki pojemności nisz,
    // cele er narzucone przez scenariusz.
    var rules = { winPaths: opts.winPaths || null, capMult: opts.capMult || null, forcedGoals: opts.forcedGoals || null };
    root.bodyPlan = pickBodyPlan(seed, root);
    var st = {
      version: 8,
      rules: rules,
      seed: seed,                // kod świata (null — świat bez ziarna, tylko w testach)
      rngState: seed ? hashStr(seed + '|linia') : 0,
      calendar: seed ? buildCalendar(data, seed, startEra) : null,
      eraGoals: seed ? pickEraGoals(data, seed, startEra, rules) : [],
      difficulty: diffKey,
      scenario: opts.scenarioId || 'full',
      startEra: startEra,
      eraIndex: startEra,
      turn: 0,
      totalTurns: totalTurns(data),
      ep: ep,
      intelligenceGoal: goal,
      predatorLevel: 0,          // koewolucja: najwyższa presja drapieżników (do raportu)
      predatorLevels: {},        // koewolucja osobno w każdej niszy
      lineages: [root],
      activeLineageId: 'L0',
      nextLineageNum: 1,
      prologue: prologue.picked,   // id wybranych opcji prologu (po jednej na etap)
      unlockedKnowledge: (root.niche === 'lad' ? ['intro', 'land'] : ['intro']).concat(prologue.knowledge),
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
     regional[era] — [{ turn, id }] katastrof regionalnych ery. */
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
      var free = [], calm = [];
      for (var j = 1; j < turns.length; j++) if (!turns[order[j]].catastrophe) free.push(j);
      // Najlepiej z dala od wymierań masowych — nie dwie katastrofy tura po turze.
      calm = free.filter(function (x) {
        return !(turns[order[x - 1]] || {}).catastrophe && !(turns[order[x + 1]] || {}).catastrophe;
      });
      if (calm.length >= R.perEra) free = calm;
      if (!free.length) continue;
      // Rodzaj katastrofy ustala się dopiero przy zapowiedzi (fixRegional) — uderza
      // w niszę, w której żyje najwięcej osobników gatunku.
      cal.regional[e] = [];
      for (var q = 0; q < R.perEra && free.length; q++) {
        var pick = free.splice(Math.floor(rr() * free.length), 1)[0];
        // Nie dwie katastrofy regionalne tura po turze.
        free = free.filter(function (x) { return Math.abs(x - pick) > 1; });
        cal.regional[e].push({ turn: pick, id: null });
      }
    }
    return cal;
  }
  // Katastrofy regionalne ery (zapisy sprzed wersji 7 miały jedną, jako obiekt).
  function regionalsOf(cal, e) { return cal && cal.regional && cal.regional[e] ? [].concat(cal.regional[e]) : []; }
  /* Zapowiedź katastrofy regionalnej na następną turę: wybór rodzaju według niszy
     z największą populacją (kto trzyma wszystko w jednej niszy, ten ryzykuje). */
  function fixRegional(data, n) {
    var cal = n.calendar; if (!cal || !n.seed || n.status !== 'playing') return;
    turnsAhead(data, n.eraIndex, n.turn, lookahead(data)).forEach(function (t) {
      if (!t) return;
      var reg = regionalsOf(cal, t[0]).filter(function (x) { return x.turn === t[1]; })[0];
      if (!reg || reg.id) return;
      var load = nicheLoad(n), top = null;
      Object.keys(load).forEach(function (k) { if (top === null || load[k] > load[top]) top = k; });
      var r = worldRngFor(n.seed, 'regional-type:' + t[0] + ':' + t[1]);
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
    var reg = regionalsOf(cal, eraIndex).filter(function (x) { return x.turn === turn; })[0];
    if (reg && reg.id && base && !base.catastrophe) {
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
  // Ile tur naprzód gra zapowiada katastrofy.
  function lookahead(data) { return (data.THREAT && data.THREAT.lookahead) || 1; }
  // Bieżąca tura i `k` następnych jako pary [era, tura].
  function turnsAhead(data, eraIndex, turn, k) {
    var out = [], t = eraIndex < data.ERAS.length ? [eraIndex, turn] : null;
    for (var i = 0; t && i <= k; i++) { out.push(t); t = nextTurnOf(data, t[0], t[1]); }
    return out;
  }
  /* Zapowiedź: najbliższa katastrofa w ciągu `THREAT.lookahead` tur. Siła w każdej
     niszy podana jako przedział — dokładną siłę zna się dopiero w turze katastrofy. */
  function upcomingThreat(data, state) {
    if (state.status !== 'playing') return null;
    var ahead = turnsAhead(data, state.eraIndex, state.turn, lookahead(data)).slice(1);
    for (var i = 0; i < ahead.length; i++) {
      var nx = ahead[i], b = turnBase(data, state, nx[0], nx[1]);
      if (!b || !b.catastrophe) continue;
      var c = b.catastrophe, diff = difficultyOf(data, state), T = data.THREAT || {}, sev = {};
      Object.keys(data.NICHES).forEach(function (k) {
        if (c.niche !== 'all' && c.niche !== k) { sev[k] = [0, 0]; return; }
        var base = catastropheSeverity(c, k) * (diff.catMult || 1);
        sev[k] = [Math.round(100 * clamp(base * (T.sevMin || 1), 0, 0.95)), Math.round(100 * clamp(base * (T.sevMax || 1), 0, 0.95))];
      });
      return { name: c.name, niche: c.niche, regional: !!c.regional, turnsAhead: i + 1, severity: sev,
        note: c.note || b.note, title: b.title, newEra: nx[0] !== state.eraIndex ? data.ERAS[nx[0]].name : null };
    }
    return null;
  }
  /* Oś czasu bieżącej ery — co gracz wie o katastrofach: minione, bieżąca i
     zapowiedziana są jawne; stałe wymierania historyczne też; wymierania z
     `window` pokazują tylko możliwe tury („?”), regionalne są ukryte do zapowiedzi. */
  function eraTimeline(data, state) {
    var e = Math.min(state.eraIndex, data.ERAS.length - 1), era = data.ERAS[e], cal = state.calendar;
    var out = era.turns.map(function (_, i) {
      var b = turnBase(data, state, e, i), c = b.catastrophe, known = null;
      var revealed = state.eraIndex > e || i <= state.turn + lookahead(data);
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
    // Siła katastrofy tej tury: w zapowiedzi przedział, w samej turze — już znana.
    if (c.catastrophe) {
      var T = data.THREAT || {};
      c.catastrophe.sevMult = Math.round(((T.sevMin || 1) + rng() * ((T.sevMax || 1) - (T.sevMin || 1))) * 100) / 100;
    }
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
  /* Cechy wykluczające się (np. filtrowanie i szczęki — dwa sposoby odżywiania).
     Zwraca nazwę posiadanej cechy, która wyklucza `trait`, albo null. */
  function excludedBy(l, trait, data) {
    var ex = trait.excludes || [];
    for (var i = 0; i < l.traits.length; i++) {
      var id = l.traits[i];
      if (ex.indexOf(id) !== -1) return id;
      var t = data ? traitsById(data)[id] : null;
      if (t && t.excludes && t.excludes.indexOf(trait.id) !== -1) return id;
    }
    return null;
  }
  /* Ewolucja równoległa: gdy żywa linia pokrewna ma już cechę, druga linia zdobywa
     ją taniej (wspólne geny rozwojowe — podobne rozwiązania powstają łatwiej). */
  function parallelSource(state, lineage, trait) {
    for (var i = 0; i < state.lineages.length; i++) {
      var o = state.lineages[i];
      if (o.alive && o.id !== lineage.id && o.traits.indexOf(trait.id) !== -1) return o;
    }
    return null;
  }
  function traitCost(data, state, trait, lineage) {
    lineage = lineage || getActiveLineage(state);
    var disc = data ? data.PARALLEL_DISCOUNT : 0;
    if (!disc || !lineage || !parallelSource(state, lineage, trait)) return trait.cost;
    return Math.max(1, Math.round(trait.cost * (1 - disc)));
  }
  function traitStatus(state, trait, data) {
    var l = getActiveLineage(state);
    if (!l) return 'locked';
    if (l.traits.indexOf(trait.id) !== -1) return 'owned';
    if (excludedBy(l, trait, data || DATA_REF)) return 'excluded';
    if (!eraUnlocked(state, trait)) return 'era_locked';
    if (!prerequisitesMet(l, trait)) return 'locked';
    if (state.ep < traitCost(data || DATA_REF, state, trait, l)) return 'too_expensive';
    return 'available';
  }
  function buyTrait(data, state, traitId) {
    var trait = traitsById(data)[traitId];
    if (!trait) return { ok: false, state: state, error: 'Nieznana cecha.' };
    var a = getActiveLineage(state);
    if (!a) return { ok: false, state: state, error: 'Brak aktywnej linii.' };
    if (a.traits.indexOf(traitId) !== -1) return { ok: false, state: state, error: 'Cecha już posiadana.' };
    var ex = excludedBy(a, trait, data);
    if (ex) return { ok: false, state: state, error: 'Wyklucza się z cechą „' + traitsById(data)[ex].name + '”.' };
    if (!eraUnlocked(state, trait)) return { ok: false, state: state, error: 'Cecha dostępna w późniejszej erze.' };
    if (!prerequisitesMet(a, trait)) return { ok: false, state: state, error: 'Niespełnione warunki wstępne.' };
    var cost = traitCost(data, state, trait, a);
    if (state.ep < cost) return { ok: false, state: state, error: 'Za mało punktów ewolucji.' };
    var n = clone(state); var l = getActiveLineage(n);
    n.ep -= cost; l.traits.push(traitId); applyEffects(l, trait.effects); unlockKnowledgeForTrait(n, trait);
    if (cost < trait.cost) unlockKnowledge(n, 'parallel');
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
  /* Plan budowy (tylko wygląd — silnik go nie używa): linia startująca bez płetw, kończyn i
     stałocieplności bywa kręgowcem, stawonogiem albo głowonogiem. Wynika z kodu świata, więc
     ten sam kod = ten sam kształt życia; gałęzie dziedziczą plan po rodzicu. */
  function pickBodyPlan(seed, root) {
    if (!seed) return 'kregowiec';
    var advanced = ['fins', 'limbs', 'flight', 'endothermy'].some(function (id) { return root.traits.indexOf(id) !== -1; });
    if (advanced) return 'kregowiec';
    var r = worldRngFor(seed, 'plan')();
    return r < 0.5 ? 'kregowiec' : (r < 0.75 ? 'stawonog' : 'glowonog');
  }
  // Oddziela `childPop` osobników rodzica jako nową linię (specjacja, kolonizacja).
  function splitLineage(data, n, parent, childPop, name, res) {
    // Zapasy energii dzielą się jak osobniki — nie powstają z niczego.
    var share = parent.population > 0 ? childPop / parent.population : 0;
    var childRes = round1((parent.reserves || 0) * share);
    parent.reserves = round1((parent.reserves || 0) - childRes);
    parent.population -= childPop; parent.popHistory[parent.popHistory.length - 1] = parent.population;
    var childId = 'L' + n.nextLineageNum; n.nextLineageNum += 1;
    var child = makeLineage(childId, name, parent.id, childPop, parent.stats, parent.traits, parent.niche,
      n.eraIndex, n.turn, { reserves: childRes, variation: res.variation, strategy: parent.strategy, diet: parent.diet });
    var NL = data.NEW_LINEAGE, now = nowTurn(data, n);
    for (var t = 0; NL && t < NL.turns; t++) child.mods.push({ turn: now + t, predMult: NL.predMult });
    child.bodyPlan = parent.bodyPlan || 'kregowiec';
    n.lineages.push(child);
    return child;
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
  /* Ukierunkowany dobór: presja selekcyjna na wybraną statystykę. Za 🧬 zmienność
     z szansą `SELECTION.chance` (inteligencja: `intelChance`, tylko z mózgiem)
     statystyka rośnie o 1 (metabolizm spada o 1). Zmienność to paliwo doboru. */
  var SELECT_KEYS = ['feeding', 'defense', 'reproduction', 'mobility', 'metabolism', 'intelligence'];
  function selectionAllowed(l, key) {
    return SELECT_KEYS.indexOf(key) !== -1 && (key !== 'intelligence' || l.traits.indexOf('brain') !== -1);
  }
  function applySelection(data, l, rng) {
    var S = data.SELECTION, key = l.selection;
    if (!key || !S) return null;
    if (!selectionAllowed(l, key)) { l.selection = false; return { stopped: 'Ukierunkowany dobór wstrzymany — ta cecha wymaga mózgu.' }; }
    if ((l.variation || 0) < S.cost) { l.selection = false; return { stopped: 'Ukierunkowany dobór wstrzymany — wyczerpana zmienność genetyczna.' }; }
    l.variation -= S.cost;
    var chance = key === 'intelligence' ? S.intelChance : S.chance;
    if (rng() >= chance) return { key: key, hit: false };
    var delta = key === 'metabolism' ? -1 : 1;
    if (l.stats[key] + delta < 0) return { key: key, hit: false };
    l.stats[key] += delta;
    return { key: key, hit: true, delta: delta };
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
    // Strategia z kosztem ⚡ działa tylko, gdy linię na nią stać (po opłacie za zachowanie).
    var strategyBlocked = false;
    if ((strat.reserveDrain || 0) > Math.max(0, (lineage.reserves || 0) - (beh.cost || 0))) {
      strat = data.STRATEGIES.zrownowazona; strategyBlocked = true;
    }
    var mods = turnMods(lineage, ctx.nowTurn);
    var ne = envForNiche(data, env, lineage.niche);
    var food = Math.max(0, ne.food + (ctx.foodBonus || 0) + mods.foodBonus);
    var coevo = ctx.predatorLevels ? (ctx.predatorLevels[lineage.niche] || 0) : (ctx.predatorLevel || 0);
    var predBase = ne.predators + ((ctx.rivalPred && ctx.rivalPred[lineage.niche]) || 0) + (ctx.predBonus || 0) + coevo + mods.predBonus + (beh.predAdd || 0);

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
    var C = data.CAPACITY, capMult = (ctx.capMult && ctx.capMult[lineage.niche]) || 1;
    var kBase = Math.max(C.min, Math.round(C.perFood[lineage.niche] * food * capMult));
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
    // Cechy chroniące młode (np. opieka nad potomstwem) zmniejszają straty.
    var lossMult = 1, byId = traitsById(data);
    (lineage.traits || []).forEach(function (id) { var t = byId[id]; if (t && t.lossMult) lossMult *= t.lossMult; });
    var predationLossRate = clamp(predationPressure * 0.035 * strat.predLossMult * lossMult, 0, 0.45);
    var starvationLossRate = netEnergy < 0 ? clamp(-netEnergy * 0.03 * strat.starveLossMult * lossMult, 0, 0.5) : 0;
    var birthRate = netEnergy >= 0 ? clamp(0.03 * lstat(es, 'reproduction') * (1 + Math.max(0, energy) * 0.05), 0, 0.6) : 0;
    if (energy < 0) birthRate *= R.deficitBirthMult;  // życie z zapasów — słabszy rozród
    // Koszt doboru: trwający ukierunkowany dobór odsiewa część osobników od rozrodu.
    var S = data.SELECTION, selecting = !!(lineage.selection && S && (lineage.variation || 0) >= S.cost);
    birthRate = clamp(birthRate * strat.birthMult * (beh.birthMult || 1) * mods.birthMult * (selecting ? S.birthMult || 1 : 1), 0, 0.8);
    // Wzrost logistyczny (theta-logistyczny): rozród słabnie wyraźnie dopiero blisko K.
    birthRate *= Math.max(0, 1 - Math.pow(Math.min(fill, 1), C.theta || 1));
    return { energy: energy, predationPressure: predationPressure, acclimatizing: acclimatizing, notes: eff.notes,
      predationLossRate: predationLossRate, starvationLossRate: starvationLossRate, birthRate: birthRate,
      diseaseLossRate: clamp(mods.diseaseLoss, 0, 0.9),
      capacity: capacity, nicheLoad: load, diet: diet, dietSwitching: dietSwitching, webPressure: round1(webPressure), preyBiomass: Math.round(Math.max(0, preyBiomass)), crowdLossRate: crowdLossRate, rivalLoad: (ctx.rivalLoad && ctx.rivalLoad[lineage.niche]) || 0, enemyRelease: mods.predMult < 1,
      reserveDraw: round1(reserveDraw), reservesAfter: reservesAfter, reservesCap: cap,
      behavior: beh === data.BEHAVIORS.brak ? 'brak' : lineage.behavior, strategyBlocked: strategyBlocked, selecting: selecting,
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
    var load = nicheLoad(state), occupied = Object.keys(load).length, rl = rivalLoad(state);
    for (var k in rl) load[k] = (load[k] || 0) + rl[k];
    // Rywale-drapieżniki podnoszą presję w swojej niszy (silniejszy — mocniej).
    var rp = {};
    (state.rivals || []).forEach(function (r) {
      var k = data.RIVALS.filter(function (x) { return x.id === r.kind; })[0];
      if (r.alive && k && k.role === 'predator') rp[r.niche] = Math.min(data.RIVAL.predMax, (rp[r.niche] || 0) + r.strength * data.RIVAL.predPerStrength);
    });
    return { predatorLevel: state.predatorLevel || 0, predatorLevels: state.predatorLevels || null,
      predMult: diff.predMult, nowTurn: nowTurn(data, state), capMult: state.rules && state.rules.capMult,
      occupied: occupied,   // nisze zajęte przez gatunek (bez konkurentów) — szeroki zasięg
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
    var f = forecastIn(data, state, lineage, env);
    // Przedział: warunki tury mogą jeszcze odchylić się o ±ENV_VARIATION.hidden
    // (pokarm i drapieżniki) — prognoza pokazuje najgorszy i najlepszy wariant.
    var h = (data.ENV_VARIATION && data.ENV_VARIATION.hidden) || 0;
    f.projectedLow = f.projectedHigh = f.projectedPop;
    if (h) {
      f.projectedLow = Math.min(f.projectedPop, forecastIn(data, state, lineage, shiftEnv(env, -h, h)).projectedPop);
      f.projectedHigh = Math.max(f.projectedPop, forecastIn(data, state, lineage, shiftEnv(env, h, -h)).projectedPop);
    }
    return f;
  }
  // Warunki przesunięte o `df` pokarmu i `dp` drapieżników (we wszystkich niszach).
  function shiftEnv(env, df, dp) {
    var c = clone(env);
    c.food = Math.max(1, c.food + df); c.predators = Math.max(0, c.predators + dp);
    c.land = { food: Math.max(1, env.land.food + df), predators: Math.max(0, env.land.predators + dp) };
    return c;
  }
  function forecastIn(data, state, lineage, env) {
    var ctx = contextFor(data, state, lineage);
    var d = computeDynamics(data, env, lineage, ctx);
    var pop = lineage.population;
    var births = Math.round(pop * d.birthRate * alleeFactor(data, pop));
    var predD = Math.round(pop * d.predationLossRate);
    var starvD = Math.round(pop * d.starvationLossRate);
    var disD = Math.round(pop * d.diseaseLossRate);
    var crowdD = Math.round(pop * d.crowdLossRate);
    var proj = Math.max(0, pop + births - predD - starvD - disD - crowdD);
    var cat = hitsLineage(env.catastrophe, lineage) ? env.catastrophe : null;
    var impact = cat ? catastropheImpact(cat, lineage, difficultyOf(data, state), data, ctx.occupied) : null;
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
      reserveDraw: d.reserveDraw, behaviorBlocked: d.behaviorBlocked, strategyBlocked: d.strategyBlocked,
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
  // `key` — statystyka, na którą działa dobór (false — wyłącz; true — odżywianie).
  function setSelection(data, state, id, key) {
    if (key === true) key = 'feeding';
    return editLineage(state, id, function (n, l) {
      var S = data.SELECTION;
      if (key && !selectionAllowed(l, key)) return key === 'intelligence' ? 'Dobór na inteligencję wymaga mózgu.' : 'Nieznana cecha doboru.';
      if (key && (l.variation || 0) < S.cost) return 'Za mała zmienność na ukierunkowany dobór (potrzeba ' + S.cost + ' 🧬 na turę).';
      if (n) { l.selection = key || false; if (key) unlockKnowledge(n, 'variation'); }
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
    var c = opt.cost || {};
    if (c.reserves) l.reserves -= c.reserves;
    if (c.variation) l.variation -= c.variation;
    var colony = applyOutcome(data, n, l, opt, nowTurn(data, n), { name: ev.name, label: opt.label }).colony;
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
    if (fx.predatorLevel) {
      // Koewolucja działa w niszy linii, której dotyczy karta.
      var lv = n.predatorLevels || (n.predatorLevels = {});
      lv[l.niche] = round1(clamp((lv[l.niche] || 0) + fx.predatorLevel, 0, 12));
      n.predatorLevel = Object.keys(lv).reduce(function (m, k) { return Math.max(m, lv[k]); }, 0);
    }
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
    // Założenie kolonii (np. wyspa): część populacji tworzy nową linię.
    var colony = null;
    if (fx.found && Math.floor(l.population * fx.found) >= 2) {
      colony = splitLineage(data, n, l, Math.floor(l.population * fx.found), l.name + ' (wyspa)',
        { variation: data.VARIATION.founder });
      // Skutki wyprawy dotyczą kolonii, nie linii macierzystej.
      (n.echoes || []).forEach(function (e) { if (e.pendingColony) { e.lineageId = colony.id; delete e.pendingColony; } });
    } else (n.echoes || []).forEach(function (e) { if (e.pendingColony) e.dropped = true; });
    n.echoes = (n.echoes || []).filter(function (e) { return !e.dropped; });
    return { popDelta: popDelta, colony: colony };
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
    var res = applyOutcome(data, n, l, out, nowTurn(data, n), { name: ev.name, label: opt.label });
    return { win: win, chance: Math.round(chance * 100), text: out.text, popDelta: res.popDelta,
      colonyName: res.colony ? res.colony.name : null, knowledge: out.knowledge || null };
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
        pop *= 1 - clamp(rolledSeverity(env.catastrophe, r.niche) * diff.catMult * R.catMult, 0, 0.95);
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
    var envShown = currentTurnEnv(data, n), env = envShown;
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

    // Ukryte odchylenie warunków (±hidden) — dlatego prognoza podaje przedział.
    var H = (data.ENV_VARIATION && data.ENV_VARIATION.hidden) || 0;
    if (H) {
      var hr = W('hidden'), hf = Math.round((hr() * 2 - 1) * H), hp = Math.round((hr() * 2 - 1) * H);
      if (hf || hp) env = shiftEnv(envShown, hf, hp);
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

    // Koewolucja w każdej niszy osobno: miejscowe drapieżniki „doganiają” najlepiej
    // bronioną linię tej niszy; w niszy bez linii presja wygasa.
    var predBefore = n.predatorLevel || 0, CO = data.COEVOLUTION || { factor: 0.7, rate: 0.35 };
    var lv = n.predatorLevels || (n.predatorLevels = {}), best = {};
    aliveLineages(n).forEach(function (l) { best[l.niche] = Math.max(best[l.niche] || 0, l.stats.defense); });
    Object.keys(data.NICHES).forEach(function (k) {
      var target = best[k] != null ? Math.max(0, (best[k] - data.BASE_STATS.defense) * CO.factor) * diff.coevo : 0;
      lv[k] = round1(clamp((lv[k] || 0) + (target - (lv[k] || 0)) * CO.rate, 0, 12));
    });
    n.predatorLevel = Object.keys(lv).reduce(function (m, k) { return Math.max(m, lv[k]); }, 0);
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
      catastrophe: env.catastrophe || null, hiddenShift: env !== envShown,
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
    var sel = applySelection(data, l, rng);
    if (sel && sel.stopped) events.push(sel.stopped);
    else if (sel && sel.hit) { events.push('Ukierunkowany dobór: ' + statLabel(sel.key) + ' ' + (sel.delta > 0 ? '+1' : '−1') + '.'); knowledge.push('variation'); }
    else if (sel) events.push('Ukierunkowany dobór (' + statLabel(sel.key) + ') — w tej turze bez widocznego efektu.');
    var mut = rollMutation(l, rng);
    if (mut) {
      events.push((mut.beneficial ? 'Korzystna' : 'Szkodliwa') + ' mutacja: ' + statLabel(mut.key) + ' ' + (mut.delta > 0 ? '+1' : '-1') + '.');
      knowledge.push(mut.knowledge);
    }
    var popBefore = l.population, reservesBefore = l.reserves;
    var d = computeDynamics(data, env, l, ctx);
    if (d.behaviorBlocked) events.push('Za mało rezerw na zaplanowane zachowanie — linia żyła zwyczajnie.');
    if (d.strategyBlocked) events.push('Za mało rezerw na strategię r — linia rozmnażała się zwyczajnie.');
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

    var catDeaths = 0, survivalReasons = [], catHit = false;
    if (hitsLineage(env.catastrophe, l)) {
      var impact = catastropheImpact(env.catastrophe, l, diff, data, ctx.occupied);
      catHit = true;
      catDeaths = sround(Math.max(0, pop) * impact.severity, rng);
      pop -= catDeaths;
      l.variation = Math.floor(l.variation * (1 - impact.severity * V.catastropheLoss));
      survivalReasons = impact.reasons;
      if ((ctx.occupied || 1) >= 2) knowledge.push('range');
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
      diseaseDeaths: diseaseDeaths, crowdDeaths: crowdDeaths, capacity: d.capacity, nicheLoad: d.nicheLoad, catHit: catHit, rivalLoad: d.rivalLoad,
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
  // Siła w niszy z uwzględnieniem wylosowanego mnożnika tej tury.
  function rolledSeverity(cat, niche) { return catastropheSeverity(cat, niche) * (cat.sevMult || 1); }

  function hitsLineage(cat, l) { return !!cat && (cat.niche === 'all' || cat.niche === l.niche); }

  /*
   * Selektywność wymierań (ZALOZENIA 4.3): cechy lub statystyki z `survival`
   * mnożą siłę katastrofy. Zwraca { severity, reasons } — reasons trafiają do
   * raportu, by było jasne, DLACZEGO linia przetrwała lepiej.
   */
  function catastropheImpact(cat, l, diff, data, occupied) {
    var sev = rolledSeverity(cat, l.niche), reasons = [];
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
    // Szeroki zasięg: gatunek obecny w kilku niszach lepiej znosi wymieranie — ocalali
    // z innych nisz odnawiają populację (w paleontologii najlepszy predyktor przetrwania).
    var RG = data && data.RANGE;
    if (RG && occupied >= 2) {
      var m = RG[Math.min(occupied, 4)] || 1;
      if (m < 1) { sev *= m; reasons.push('szeroki zasięg gatunku (' + occupied + ' nisze) — ocalali z innych nisz odnawiają populację'); }
    }
    return { severity: clamp(sev * ((diff && diff.catMult) || 1), 0, 0.95), reasons: reasons };
  }

  // Drogi do rozumu w tej partii (scenariusz może je zawęzić: state.rules.winPaths).
  function winPaths(data, state) {
    var all = data.WIN_PATHS || (data.WIN_TRAIT ? [{ id: 'tools', trait: data.WIN_TRAIT }] : []);
    var only = state && state.rules && state.rules.winPaths;
    return only ? all.filter(function (p) { return only.indexOf(p.id) !== -1; }) : all;
  }
  // Droga do rozumu, którą linia spełnia: cecha kultury w pasującej niszy.
  function winPathOf(data, l, state) {
    var ps = winPaths(data, state);
    if (!ps.length) return { id: 'none' };
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (l.traits.indexOf(p.trait) !== -1 && (!p.niches || p.niches.indexOf(l.niche) !== -1)) return p;
    }
    return null;
  }
  // Linia spełnia warunki „rozumu”: próg inteligencji i kultura (WIN_PATHS) w swojej niszy.
  function meetsWinTraits(n, data, l) {
    return l.alive && l.population > 0 && l.stats.intelligence >= n.intelligenceGoal && !!winPathOf(data, l, n);
  }
  /* Żywotność: linia rozumna liczy co najmniej WIN_LINE_MIN osobników, a cały
     gatunek (wszystkie żywe linie — jeden klad) co najmniej WIN_MIN_POP. */
  function viableForWin(n, data, l) {
    return l.population >= (data.WIN_LINE_MIN || 0) && totalPopulation(n) >= (data.WIN_MIN_POP || 0);
  }
  // Kultura jest, ale w niszy, w której nie działa (np. narzędzia w otwartym morzu).
  function cultureNicheBlocked(n, data) {
    return n.lineages.filter(function (l) {
      return l.alive && !winPathOf(data, l, n) && winPaths(data, n).some(function (p) { return l.traits.indexOf(p.trait) !== -1; });
    }).map(function (l) {
      var p = winPaths(data, n).filter(function (q) { return l.traits.indexOf(q.trait) !== -1; })[0];
      return { lineageId: l.id, name: l.name, path: p };
    });
  }
  function winningPath(n, data) {
    var w = n.lineages.filter(function (l) { return meetsWinTraits(n, data, l) && viableForWin(n, data, l); })[0];
    var p = w && winPathOf(data, w, n);
    return p ? p.id : null;
  }
  // Zwycięstwo: warunki „rozumu” w linii o żywotnej liczebności (WIN_MIN_POP) —
  // kilka ostatnich osobników to nie gatunek, który zbuduje kulturę.
  function hasWon(n, data) {
    return n.lineages.some(function (l) { return meetsWinTraits(n, data, l) && viableForWin(n, data, l); });
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
  function pickEraGoals(data, seed, startEra, rules) {
    var out = [], per = data.ERA_GOALS_PER_ERA || 0, forced = (rules && rules.forcedGoals) || [];
    for (var e = startEra || 0; e < data.ERAS.length; e++) {
      var mine = forced.filter(function (f) { return f.era === e; });
      mine.forEach(function (f) { out.push({ era: e, id: f.id, status: 'open' }); });
      var pool = (data.ERA_GOALS || []).filter(function (g) {
        return (!g.eras || g.eras.indexOf(e) !== -1) && !mine.some(function (f) { return f.id === g.id; });
      }).slice();
      var r = worldRngFor(seed, 'goals:' + e);
      for (var k = mine.length; k < per && pool.length; k++) {
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
    var before = 0, catDeaths = 0, starved = false, hit = false;
    lineReports.forEach(function (r) { before += r.popBefore; catDeaths += r.catDeaths; if (r.catHit) hit = true; if (r.starvationDeaths > 0) starved = true; });
    // Liczy się tylko katastrofa, która dosięgła gatunku (ucieczka przed regionalną to nie „przetrwanie kataklizmu”).
    var ctx = { catLoss: env.catastrophe && hit ? (before ? catDeaths / before : 0) : null, starved: starved };
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
    function grow(p) { for (var i = 0; i < R; i++) p += p * O.growth * Math.min(1, p / mvp); return p; }
    // Klad: łączna populacja wszystkich żywych linii po optymistycznym wzroście.
    var cladeMax = aliveLineages(state).reduce(function (s2, l) { return s2 + grow(l.population); }, 0);
    aliveLineages(state).forEach(function (l) {
      var p = grow(l.population);
      var popOk = p >= (data.WIN_LINE_MIN || 0) && cladeMax >= (data.WIN_MIN_POP || 0);
      var epMax = state.ep + O.epPerTurn * Math.max(0, R - 1);
      var pathOk = winPaths(data, state).some(function (path) {
        var miss = missingTraits(byId, l, path.trait), cost = 0, intel = lstat(l, 'intelligence');
        if (miss.some(function (id) { return excludedBy(l, byId[id], data); })) return false;
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
      if (!popOkAny) reasons.push('populacja gatunku nie zdąży odrosnąć do ' + data.WIN_MIN_POP + ' osobników przed końcem gry');
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
    add('steward', !!(state.anthropocene && state.anthropocene.verdict === 'sustainable'));
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
    part('Epilog: Antropocen', anthropocenePoints(data, state.anthropocene));
    part('Osiągnięcia', S.perAchievement * earnedAchievements(data, state).length);
    var sum = parts.reduce(function (a, p) { return a + p.points; }, 0);
    var mult = (S.diffMult && S.diffMult[state.difficulty]) || 1;
    return { parts: parts, subtotal: sum, mult: mult, total: Math.round(sum * mult) };
  }

  // ---------- Epilog grywalny: Antropocen ----------
  // Kondycja biosfery na starcie epilogu wynika z przebiegu partii.
  function anthropoceneStartBio(data, state) {
    var A = data.ANTHROPOCENE.start, st = gameStats(data, state);
    var lostLines = state.lineages.filter(function (l) { return !l.alive; }).length;
    var niches = Object.keys(nicheLoad(state)).length;
    var bio = A.base - A.perDisplaced * Math.min(A.maxDisplaced, state.rivalsDisplaced || 0) -
      A.perLostLine * Math.min(A.maxLostLines, lostLines) + A.perExtraNiche * Math.max(0, niches - 1);
    void st;
    return clamp(bio, A.min, A.max);
  }
  function anthropoceneVerdict(data, a) {
    var v = data.ANTHROPOCENE.verdicts.filter(function (x) {
      return (x.min.tech == null || a.tech >= x.min.tech) && (x.min.bio == null || a.bio >= x.min.bio);
    })[0];
    return v.id;
  }
  function startAnthropocene(data, state) {
    if (state.status !== 'won') return { ok: false, state: state, error: 'Epilog jest dostępny po zwycięstwie.' };
    if (state.anthropocene) return { ok: false, state: state, error: 'Epilog już rozegrany.' };
    var n = clone(state);
    n.anthropocene = { round: 0, tech: 0, bio: anthropoceneStartBio(data, state), startBio: anthropoceneStartBio(data, state), picks: [], done: false, verdict: null };
    return { ok: true, state: n, error: null };
  }
  function chooseAnthropocene(data, state, optionId) {
    var a = state.anthropocene, A = data.ANTHROPOCENE;
    if (!a || a.done) return { ok: false, state: state, error: 'Brak trwającego epilogu.' };
    var stage = A.stages[a.round], opt = stage.options.filter(function (o) { return o.id === optionId; })[0];
    if (!opt) return { ok: false, state: state, error: 'Nieznana opcja.' };
    var n = clone(state), b = n.anthropocene;
    b.tech += opt.tech; b.bio = clamp(b.bio + opt.bio, 0, 100);
    b.picks.push(opt.id); b.round += 1;
    if (b.round >= A.stages.length) { b.done = true; b.verdict = anthropoceneVerdict(data, b); }
    return { ok: true, state: n, error: null };
  }
  function anthropocenePoints(data, a) {
    return a && a.done ? Math.round(a.tech * data.ANTHROPOCENE.score.perTech + a.bio * data.ANTHROPOCENE.score.perBio) : 0;
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
    prologueLabels: prologueLabels, startAnthropocene: startAnthropocene, chooseAnthropocene: chooseAnthropocene,
    anthropoceneVerdict: anthropoceneVerdict, anthropocenePoints: anthropocenePoints, epilogue: epilogue, rivalsIn: rivalsIn, gameStats: gameStats, earnedAchievements: earnedAchievements, scoreGame: scoreGame,
    elapsedTurns: elapsedTurns, playedEras: playedEras, catastropheSeverity: catastropheSeverity,
    catastropheImpact: catastropheImpact, effectiveStats: effectiveStats, hasWon: hasWon,
    goalBlockedByPopulation: goalBlockedByPopulation, hasViableLineage: hasViableLineage,
    traitCost: traitCost, parallelSource: parallelSource, excludedBy: excludedBy, winPaths: winPaths,
    selectionAllowed: selectionAllowed,
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
    _internals: { applySelection: applySelection, rollMutation: rollMutation, sround: sround, alleeFactor: alleeFactor, clamp: clamp, computeDynamics: computeDynamics }
  };
});
