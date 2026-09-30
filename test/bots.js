/*
 * test/bots.js — gracze-boty do testów balansu (ZALOZENIA 11: balans EP).
 *
 * - „plan”     — stały plan: kupuje wszystko po kolei, gdy tylko go stać;
 * - „star”     — stały plan: tylko ścieżka do inteligencji (⭐) i jej wymagania;
 * - „adaptive” — gracz, który patrzy na prognozę (jak człowiek): kupuje cechy
 *                ścieżki, gdy nie grożą głodem ani spadkiem populacji poniżej
 *                żywotnej liczebności, a poza tym cechy wyraźnie poprawiające
 *                prognozę lub bilans energii; migruje, gdy inna nisza daje
 *                wyraźnie lepszą prognozę;
 * - „tactics”  — „adaptive” + nowe decyzje: strategia rozrodu i zachowanie w
 *                turze (wg prognozy i wartości ⚡ rezerw), ukierunkowany dobór,
 *                przemyślany wybór na kartach decyzji, a gdy nisza aktywnej
 *                linii zbliża się do pojemności — specjacja i wysłanie nowej
 *                gałęzi do wolnej niszy (radiacja). „adaptive” zostawia
 *                strategię zrównoważoną i opcje domyślne kart;
 * - „tactics1” — jak „tactics”, ale bez specjacji (jedna linia);
 * - „crowd”    — jak „tactics1”, ale specjuje, gdy tylko może, i zostawia
 *                gałęzie w tej samej niszy (bezmyślne mnożenie linii);
 * - „clade”    — prowadzi cały klad: gałąź do każdej wolnej niszy (poza ostatnią
 *                erą), każda linia ewoluuje osobno (ewolucja równoległa), gałąź
 *                z kończynami może podbić przestworza.
 *
 * `init.pref` — 'land' / 'sea' / 'mix' (ziarno nieparzyste — ląd): gracz od
 * początku obiera drogę narzędzi na lądzie albo kultury akustycznej w wodzie.
 *
 * Losowość z ziarnem (mulberry32), więc wyniki są powtarzalne.
 */
'use strict';

var D = require('../js/data.js');
var E = require('../js/engine.js');

function seededRng(seed) {
  var a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var PLAN = ['eyes', 'scales', 'many_eggs', 'ganglia', 'fins', 'limbs', 'shell', 'jaws',
  'brain', 'endothermy', 'big_brain', 'social', 'grasping_hand', 'tool_use', 'parental_care'];
var STAR = ['ganglia', 'brain', 'scales', 'endothermy', 'big_brain', 'social', 'fins', 'limbs',
  'grasping_hand', 'tool_use', 'many_eggs', 'parental_care'];
// Droga wodna do rozumu (kultura akustyczna) — dla linii, które zostają w wodzie.
var STAR_SEA = ['ganglia', 'brain', 'scales', 'endothermy', 'big_brain', 'social', 'echolocation', 'vocal_culture',
  'many_eggs', 'parental_care'];
// Droga do rozumu linii: w wodzie — akustyczna, gdzie indziej — narzędzia (o ile scenariusz na nią pozwala).
function pathFor(l, s) {
  var ids = E.winPaths(D, s).map(function (p) { return p.id; });
  if (ids.indexOf('sound') === -1) return STAR;
  if (ids.indexOf('tools') === -1) return STAR_SEA;
  // Preferencja gracza (s.botPref): droga lądowa albo wodna od początku partii.
  if (s.botPref === 'land') return STAR;
  if (s.botPref === 'sea') return STAR_SEA;
  // Linia trzyma się raz obranej drogi: filtrowanie i echolokacja — woda, szczęki i kończyny — ląd.
  if (l.traits.indexOf('filter_feeding') !== -1 || l.traits.indexOf('echolocation') !== -1) return STAR_SEA;
  if (l.traits.indexOf('jaws') !== -1 || l.traits.indexOf('limbs') !== -1) return STAR;
  return l.niche === 'woda' ? STAR_SEA : STAR;
}

function trait(id) { return D.TRAITS.filter(function (t) { return t.id === id; })[0]; }

function buyInOrder(s, plan) {
  var changed = true;
  while (changed) {
    changed = false;
    for (var i = 0; i < plan.length; i++) {
      if (E.getActiveLineage(s).traits.indexOf(plan[i]) !== -1) continue;
      var r = E.buyTrait(D, s, plan[i]);
      if (r.ok) { s = r.state; changed = true; }
    }
  }
  return s;
}

function adaptiveTurn(s, keepApart) {
  for (var k = 0; k < 10; k++) {
    var a = E.getActiveLineage(s), f = E.forecast(D, s, a);
    if (!f) break;
    var pop = a.population, best = null, bestScore = -Infinity, path = pathFor(a, s);
    D.TRAITS.forEach(function (t) {
      if (E.traitStatus(s, t, D) !== 'available') return;
      if (s.botPref === 'land' && t.id === 'filter_feeding') return;   // filtrowanie wiąże z wodą
      var w = E.forecastWithTrait(D, s, a, t), score, star = path.indexOf(t.id);
      if (star !== -1) {
        // Cecha ścieżki tylko wtedy, gdy nie zagładza linii i nie zbija populacji
        // poniżej żywotnej liczebności potrzebnej do zwycięstwa.
        // (warunek żywotności: linia ≥ WIN_LINE_MIN, cały klad ≥ WIN_MIN_POP)
        var clade = E.totalPopulation(s) - pop + w.projectedPop;
        // W ostatniej erze liczy się finisz: spadek populacji jest do przyjęcia, jeśli
        // zostaje zapas nad progiem żywotności, a zapasy pokryją deficyt.
        var sprint = s.eraIndex >= D.ERAS.length - 1;
        var okEnergy = sprint ? w.energy >= -6 : w.energy >= 0;
        var okPop = sprint ? w.projectedPop >= (D.WIN_LINE_MIN || 0) + 20 : w.projectedPop >= Math.max((D.WIN_LINE_MIN || 0) + 10, pop * 0.9);
        if (!okEnergy || !okPop || clade < (D.WIN_MIN_POP || 0) + (sprint ? 20 : 10)) return;
        score = 1000 - star;
      } else {
        // Inna cecha — gdy wyraźnie poprawia prognozę lub bilans energii.
        score = w.projectedPop - f.projectedPop + (w.energy - f.energy) * 5 - t.cost * 0.1;
        if (score <= 2) return;
      }
      if (score > bestScore) { bestScore = score; best = t; }
    });
    if (!best) break;
    s = E.buyTrait(D, s, best.id).state;
  }
  var l = E.getActiveLineage(s), fc = E.forecast(D, s, l);
  // Kultura w niewłaściwej niszy — przenieś linię tam, gdzie ta kultura działa.
  var blocked = fc && E.cultureNicheBlocked(s, D).filter(function (b) { return b.lineageId === l.id; })[0];
  if (blocked) {
    var mv = E.migrateLineage(D, s, l.id, blocked.path.niches[0]);
    if (mv.ok) return mv.state;
  }
  // Gracz „lądowy” wychodzi na ląd, gdy tylko ląd wyżywi linię niewiele gorzej.
  if (fc && s.botPref === 'land' && pathFor(l, s) === STAR && l.niche !== 'lad' && l.traits.indexOf('limbs') !== -1 &&
      !s.lineages.some(function (o) { return o.alive && o.id !== l.id && o.niche === 'lad'; })) {
    var ml = E.migrateLineage(D, s, l.id, 'lad');
    if (ml.ok) {
      var fl = E.forecast(D, ml.state, E.getActiveLineage(ml.state));
      if (fl.projectedPop >= fc.projectedPop * 0.85 && fl.energy >= -1) return ml.state;
    }
  }
  if (fc) {
    E.availableNiches(D, l).forEach(function (niche) {
      if (niche === l.niche) return;
      // Gałęzie kladu nie zbijają się w jednej niszy.
      if (keepApart && s.lineages.some(function (o) { return o.alive && o.id !== l.id && o.niche === niche; })) return;
      var m = E.migrateLineage(D, s, l.id, niche);
      if (!m.ok) return;
      var f2 = E.forecast(D, m.state, E.getActiveLineage(m.state));
      if (f2.projectedPop > fc.projectedPop * 1.1) { s = m.state; fc = f2; }
    });
  }
  return s;
}

// Wartość stanu linii dla bota: prognozowana populacja + zapas energii.
// Przy małej populacji liczą się osobniki, nie zapasy.
function tacticScore(f) { return f.projectedPop + f.reservesAfter * Math.min(4, f.projectedPop / 15); }

/* Stan po wyniku ryzyka (sukces/porażka) — kopia skutków z silnika na potrzeby
   oceny bota: statystyki, zasoby, populacja i modyfikator tej tury. */
function withOutcome(state, lineageId, out) {
  var n = JSON.parse(JSON.stringify(state)), l = E.getLineage(n, lineageId), fx = out.effects || {};
  for (var k in (fx.stats || {})) l.stats[k] += fx.stats[k];
  if (fx.reserves) l.reserves = Math.max(0, Math.min(E.reservesCap(D, l), l.reserves + fx.reserves));
  if (fx.variation) l.variation = Math.max(0, l.variation + fx.variation);
  if (fx.popLoss) l.population -= Math.round(l.population * fx.popLoss);
  if (fx.popGain) l.population += Math.round(l.population * fx.popGain);
  if (fx.found) { n.botColony = Math.floor(l.population * fx.found); l.population -= n.botColony; }
  if (fx.ep) n.ep += fx.ep;
  if (out.turnMod) l.mods.push(Object.assign({ turn: E.nowTurn(D, n) }, out.turnMod));
  return n;
}
function choiceScore(before, st, lineageId) {
  var l = E.getLineage(st, lineageId), b = E.getLineage(before, lineageId), f = E.forecast(D, st, l);
  var colony = st.lineages.length > before.lineages.length ? st.lineages[st.lineages.length - 1].population : (st.botColony || 0);
  var perm = (l.stats.defense - b.stats.defense + l.stats.feeding - b.stats.feeding + l.stats.reproduction - b.stats.reproduction -
    (l.stats.metabolism - b.stats.metabolism)) * 15;
  return tacticScore(f) + colony * 1.5 + l.variation * 3 + perm + (st.ep - before.ep) * 2;
}

function tacticsTurn(s) {
  // Karta decyzji: opcja z najlepszą prognozą linii, której dotyczy (z kolonią);
  // ryzyko oceniane wartością oczekiwaną sukcesu i porażki.
  if (s.pendingChoice) {
    var pc = s.pendingChoice, ev = E.choiceEvent(D, pc.eventId), best = null, bestScore = -Infinity;
    ev.options.forEach(function (o) {
      var r = E.resolveChoice(D, s, o.id); if (!r.ok) return;
      var score;
      if (o.gamble) {
        var p = E.gambleChance(D, E.getLineage(r.state, pc.lineageId), o.gamble);
        score = p * choiceScore(s, withOutcome(r.state, pc.lineageId, o.gamble.win), pc.lineageId) +
          (1 - p) * choiceScore(s, withOutcome(r.state, pc.lineageId, o.gamble.lose), pc.lineageId);
      } else score = choiceScore(s, r.state, pc.lineageId);
      if (score > bestScore) { bestScore = score; best = r.state; }
    });
    if (best) s = best;
  }
  E.aliveLineages(s).forEach(function (l) {
    var best = null, bestScore = -Infinity;
    Object.keys(D.STRATEGIES).forEach(function (st) {
      Object.keys(D.BEHAVIORS).forEach(function (bh) {
        if (!E.canSetBehavior(D, l, bh).ok) return;
        var f = E.forecastWithTactics(D, s, l, { strategy: st, behavior: bh });
        if (!f) return;
        var score = tacticScore(f);
        if (score > bestScore) { bestScore = score; best = { st: st, bh: bh }; }
      });
    });
    if (best) {
      s = E.setStrategy(D, s, l.id, best.st).state;
      s = E.setBehavior(D, s, l.id, best.bh).state;
    }
    var cur = E.getLineage(s, l.id), v = cur.variation;
    var key = (cur.traits.indexOf('brain') !== -1 && cur.stats.intelligence < s.intelligenceGoal) ? 'intelligence' : 'feeding';
    // Dobór, gdy zmienności starcza z zapasem; w ostatniej erze przed katastrofą zmienność chroni.
    // Dobór ma koszt w potomstwie — włącz, gdy linia nie traci na tym zbyt wiele.
    var off = E.forecast(D, E.setSelection(D, s, l.id, false).state, cur), onS = E.setSelection(D, s, l.id, key);
    if (onS.ok && v >= D.SELECTION.cost + 1 && off && E.forecast(D, onS.state, E.getLineage(onS.state, l.id)).projectedPop >= off.projectedPop * 0.93)
      s = onS.state;
    else s = E.setSelection(D, s, l.id, false).state;
  });
  return s;
}

// Specjacja: gałąź idzie do wolnej niszy o najlepszej prognozie; aktywna
// zostaje linia rodzicielska (to ona kupuje cechy ścieżki).
function radiate(s) {
  var a = E.getActiveLineage(s), f = E.forecast(D, s, a);
  if (!f || f.nicheLoad < f.capacity * D.CAPACITY.warnAt || !E.canSpeciate(D, s).ok) return s;
  // W ostatniej erze nie dzieli się linii, która ma dojść do rozumu (potrzebuje liczebności).
  if (s.eraIndex >= D.ERAS.length - 1) return s;
  var taken = E.nicheLoad(s), parentId = a.id;
  var free = E.availableNiches(D, a).filter(function (n) { return !taken[n]; });
  if (!free.length) return s;
  var sp = E.speciate(D, s, 'Gałąź'); if (!sp.ok) return s;
  var t = sp.state, child = t.activeLineageId, best = null, bestPop = -1;
  free.forEach(function (n) {
    var m = E.migrateLineage(D, t, child, n); if (!m.ok) return;
    var fc = E.forecast(D, m.state, E.getLineage(m.state, child));
    if (fc.projectedPop > bestPop) { bestPop = fc.projectedPop; best = m.state; }
  });
  if (!best) return s;                 // bez migracji specjacja nie ma sensu
  return E.setActiveLineage(best, parentId);
}
/* Klad: gałąź do każdej wolnej niszy (poza ostatnią erą), a potem każda linia
   ewoluuje osobno — od największej; gałęzie korzystają z ewolucji równoległej. */
function cladeTurn(s) {
  var a = E.getActiveLineage(s);
  if (s.eraIndex < D.ERAS.length - 1 && a.population >= 80 && E.canSpeciate(D, s).ok) {
    var taken = E.nicheLoad(s), free = E.availableNiches(D, a).filter(function (n) { return !taken[n]; });
    if (free.length) {
      var sp = E.speciate(D, s, 'Gałąź');
      if (sp.ok) {
        var t = sp.state, child = t.activeLineageId, best = null, bestPop = -1;
        free.forEach(function (n) {
          var m = E.migrateLineage(D, t, child, n); if (!m.ok) return;
          var fc = E.forecast(D, m.state, E.getLineage(m.state, child));
          if (fc.projectedPop > bestPop) { bestPop = fc.projectedPop; best = m.state; }
        });
        if (best) s = E.setActiveLineage(best, a.id);
      }
    }
  }
  var order = E.aliveLineages(s).slice().sort(function (x, y) { return y.population - x.population; });
  // Najpierw radiacja w przestworza: gałąź (nie linia główna) z kończynami podbija przestworza, gdy zostaje zapas EP.
  var fl = D.TRAITS.filter(function (t) { return t.id === 'flight'; })[0];
  if (!s.lineages.some(function (l) { return l.alive && l.niche === 'powietrze'; })) {
    // (nie linia najbliższa rozumu — ona zostaje na swojej drodze)
    var brainiest = order.slice().sort(function (x, y) { return y.stats.intelligence - x.stats.intelligence; })[0];
    order.filter(function (l) { return order.length > 1 && l.id !== brainiest.id; }).some(function (l) {
      var st = E.setActiveLineage(s, l.id), cur = E.getActiveLineage(st);
      if (!cur || !cur.alive || E.traitStatus(st, fl, D) !== 'available' || st.ep < E.traitCost(D, st, fl)) return false;
      var b = E.buyTrait(D, st, 'flight'); if (!b.ok) return false;
      var m = E.migrateLineage(D, b.state, l.id, 'powietrze'); if (!m.ok) return false;
      var f = E.forecast(D, m.state, E.getActiveLineage(m.state));
      if (f && f.energy >= -1.5) { s = m.state; return true; }
      return false;
    });
  }
  order.forEach(function (l) { s = adaptiveTurn(E.setActiveLineage(s, l.id), true); });
  return E.setActiveLineage(s, order[0].id);
}
function crowd(s) {
  var a = E.getActiveLineage(s);
  if (!E.canSpeciate(D, s).ok) return s;
  var sp = E.speciate(D, s, 'Klon'); return sp.ok ? E.setActiveLineage(sp.state, a.id) : s;
}

function play(kind, init, seed) {
  var rng = seededRng(seed);
  // Świat z kodem (kalendarz katastrof, katastrofy regionalne, cele er) — jak w grze.
  var s = E.createInitialState(D, 'Bot', Object.assign({ seed: 'BOT' + seed }, init || {}));
  if (init && init.pref) s.botPref = init.pref === 'mix' ? (seed % 2 ? 'land' : 'sea') : init.pref;
  var guard = 0;
  while (s.status === 'playing' && guard++ < 40) {
    if (kind === 'adaptive') s = adaptiveTurn(s);
    else if (kind === 'tactics') s = tacticsTurn(radiate(adaptiveTurn(s)));
    else if (kind === 'tactics1') s = tacticsTurn(adaptiveTurn(s));
    else if (kind === 'crowd') s = tacticsTurn(crowd(adaptiveTurn(s)));
    else if (kind === 'clade') s = tacticsTurn(cladeTurn(s));
    else s = buyInOrder(s, kind === 'plan' ? PLAN : STAR);
    s = E.simulateTurn(D, s, rng).state;
  }
  return s;
}

/* Jedna tura decyzji bota (bez symulacji) — do testów krok po kroku. */
function stepFor(kind, s) {
  if (kind === 'adaptive') return adaptiveTurn(s);
  if (kind === 'tactics') return tacticsTurn(radiate(adaptiveTurn(s)));
  if (kind === 'tactics1') return tacticsTurn(adaptiveTurn(s));
  if (kind === 'crowd') return tacticsTurn(crowd(adaptiveTurn(s)));
  if (kind === 'clade') return tacticsTurn(cladeTurn(s));
  return buyInOrder(s, kind === 'plan' ? PLAN : STAR);
}

/* Odsetek zwycięstw (0–100) w grach z ziarnami 1..n. */
function winRate(kind, init, n) {
  var won = 0;
  for (var i = 1; i <= n; i++) if (play(kind, init, i).status === 'won') won++;
  return Math.round(100 * won / n);
}

/* Średni wynik punktowy (Engine.scoreGame) w grach z ziarnami 1..n. */
function avgScore(kind, init, n) {
  var sum = 0;
  for (var i = 1; i <= n; i++) sum += E.scoreGame(D, play(kind, init, i)).total;
  return Math.round(sum / n);
}

function scenarioInit(id) {
  var sc = D.SCENARIOS.filter(function (x) { return x.id === id; })[0];
  return { difficulty: sc.difficulty, startEra: sc.startEra, startEp: sc.startEp, goal: sc.goal,
    startTraits: sc.startTraits, startNiche: sc.startNiche, scenarioId: sc.id,
    winPaths: sc.winPaths, capMult: sc.capMult, forcedGoals: sc.forcedGoals };
}

module.exports = { seededRng: seededRng, play: play, winRate: winRate, avgScore: avgScore, stepFor: stepFor, scenarioInit: scenarioInit, PLAN: PLAN, STAR: STAR, STAR_SEA: STAR_SEA };
