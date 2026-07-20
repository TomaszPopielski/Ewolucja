/*
 * engine.js — silnik symulacji (czysta logika gry).
 *
 * Zgodnie z ZALOZENIA.md (sekcja 9): logika jest oddzielona od UI i testowalna
 * niezależnie. Funkcje nie dotykają DOM — operują wyłącznie na obiekcie stanu.
 *
 * Konwencja: funkcje modyfikujące stan zwracają NOWY obiekt stanu (kopię),
 * nie mutują wejścia — ułatwia to cofanie tur (tryb nauczyciela) i testy.
 */
(function (root, factory) {
  var engine = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = engine;
  } else {
    root.Engine = engine;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // Indeks cech po id — budowany raz z przekazanych danych.
  function traitsById(data) {
    var map = {};
    for (var i = 0; i < data.TRAITS.length; i++) {
      map[data.TRAITS[i].id] = data.TRAITS[i];
    }
    return map;
  }

  /* Tworzy stan początkowy gry na podstawie danych i nazwy gatunku. */
  function createInitialState(data, speciesName) {
    return {
      version: 1,
      eraId: data.ERA.id,
      turn: 0, // 0 = przed pierwszą turą (faza adaptacji)
      maxTurns: data.ERA.turns.length,
      ep: data.START_EP,
      intelligenceGoal: data.INTELLIGENCE_GOAL,
      species: {
        name: speciesName || 'Prazwierzę',
        population: data.START_POPULATION,
        peakPopulation: data.START_POPULATION,
        stats: clone(data.BASE_STATS)
      },
      traits: [], // id kupionych cech
      unlockedKnowledge: ['intro'],
      status: 'playing', // 'playing' | 'won' | 'survived' | 'lost'
      history: [] // raporty z kolejnych tur
    };
  }

  /* Zwraca statystykę z uwzględnieniem dolnego ograniczenia (nie schodzi < 0). */
  function stat(state, key) {
    return Math.max(0, state.species.stats[key]);
  }

  /* Czy warunki wstępne cechy są spełnione. */
  function prerequisitesMet(state, trait) {
    for (var i = 0; i < trait.requires.length; i++) {
      if (state.traits.indexOf(trait.requires[i]) === -1) return false;
    }
    return true;
  }

  /* Status cechy dla UI: 'owned' | 'available' | 'locked' | 'too_expensive'. */
  function traitStatus(state, trait) {
    if (state.traits.indexOf(trait.id) !== -1) return 'owned';
    if (!prerequisitesMet(state, trait)) return 'locked';
    if (state.ep < trait.cost) return 'too_expensive';
    return 'available';
  }

  /*
   * Kupno cechy. Zwraca { ok, state, error }.
   * Nie mutuje wejściowego stanu.
   */
  function buyTrait(data, state, traitId) {
    var byId = traitsById(data);
    var trait = byId[traitId];
    if (!trait) return { ok: false, state: state, error: 'Nieznana cecha.' };
    if (state.traits.indexOf(traitId) !== -1) {
      return { ok: false, state: state, error: 'Cecha już posiadana.' };
    }
    if (!prerequisitesMet(state, trait)) {
      return { ok: false, state: state, error: 'Niespełnione warunki wstępne.' };
    }
    if (state.ep < trait.cost) {
      return { ok: false, state: state, error: 'Za mało punktów ewolucji.' };
    }

    var next = clone(state);
    next.ep -= trait.cost;
    next.traits.push(traitId);
    applyEffects(next, trait.effects);
    unlockKnowledgeForTrait(next, trait);
    return { ok: true, state: next, error: null };
  }

  function applyEffects(state, effects) {
    for (var key in effects) {
      if (Object.prototype.hasOwnProperty.call(effects, key)) {
        state.species.stats[key] = (state.species.stats[key] || 0) + effects[key];
      }
    }
  }

  function unlockKnowledge(state, key) {
    if (state.unlockedKnowledge.indexOf(key) === -1) {
      state.unlockedKnowledge.push(key);
    }
  }

  function unlockKnowledgeForTrait(state, trait) {
    if (trait.category === 'uklad_nerwowy') unlockKnowledge(state, 'intelligence');
    if (trait.id === 'endothermy') unlockKnowledge(state, 'cold');
    if (trait.id === 'limbs' || trait.id === 'amniotic_egg') unlockKnowledge(state, 'land');
  }

  /*
   * Losowa mutacja (ZALOZENIA 4.4). Modeluje zmienność genetyczną:
   *  - z pewną szansą pojawia się mutacja,
   *  - korzystna (+1 do losowej statystyki) lub szkodliwa (-1),
   *  - szkodliwe warianty są w symulacji karą, którą "odsiewa" selekcja.
   * `rng` to funkcja zwracająca [0,1) — wstrzykiwana dla testowalności.
   */
  function rollMutation(state, rng) {
    var chance = 0.28;
    if (rng() > chance) return null;

    var keys = ['feeding', 'defense', 'reproduction', 'mobility', 'intelligence'];
    var key = keys[Math.floor(rng() * keys.length)];
    var beneficial = rng() < 0.6; // 60% mutacji korzystnych w tej grze
    var delta = beneficial ? 1 : -1;

    // Nie pozwalamy zejść poniżej 0.
    if (state.species.stats[key] + delta < 0) {
      delta = 1;
      beneficial = true;
    }
    state.species.stats[key] += delta;

    return {
      key: key,
      delta: delta,
      beneficial: beneficial,
      knowledge: beneficial ? 'mutation_good' : 'mutation_bad'
    };
  }

  /*
   * Symuluje jedną turę (ZALOZENIA 4.3, faza symulacji).
   * Zwraca { state, report } — nie mutuje wejścia.
   *
   * Model (świadomie uproszczony, edukacyjny):
   *   dochód pokarmu  = feeding * (food/10) * modyfikator_klimatu
   *   koszt utrzymania = metabolism * modyfikator_tlenu
   *   energia = dochód - koszt        (ujemna => głód)
   *   presja = max(0, predators - defense - premia_mobilności)
   *   narodziny  ~ reproduction, gdy energia >= 0
   *   zgony      ~ głód + drapieżnictwo
   */
  function simulateTurn(data, state, rng) {
    rng = rng || Math.random;
    if (state.status !== 'playing') return { state: state, report: null };

    var next = clone(state);
    var turnIndex = next.turn; // 0-based indeks nadchodzącej tury
    var env = data.ERA.turns[turnIndex];

    var events = [];
    var knowledge = [];

    // Mutacja przed rozliczeniem tury.
    var mutation = rollMutation(next, rng);
    if (mutation) {
      events.push({
        type: 'mutation',
        text: (mutation.beneficial ? 'Korzystna' : 'Szkodliwa') + ' mutacja: ' +
          statLabel(mutation.key) + ' ' + (mutation.delta > 0 ? '+1' : '-1') + '.'
      });
      knowledge.push(mutation.knowledge);
    }

    var popBefore = next.species.population;

    // --- Modyfikatory środowiska ---
    var climateMod = env.climate === 'zimno' ? 0.7 : (env.climate === 'cieplo' ? 1.1 : 1.0);
    // Stałocieplność łagodzi karę za zimno.
    if (env.climate === 'zimno' && next.traits.indexOf('endothermy') !== -1) {
      climateMod = 1.0;
    }
    // Niski tlen podnosi koszt utrzymania; wysoki tlen lekko go obniża.
    var oxygenMod = clamp(1 + (10 - env.oxygen) * 0.04, 0.7, 1.4);

    // --- Bilans energetyczny ---
    var foodIntake = stat(next, 'feeding') * (env.food / 10) * climateMod;
    var upkeep = stat(next, 'metabolism') * oxygenMod;
    var energy = foodIntake - upkeep;

    // Premia za wyjście na ląd, gdy tura go premiuje (mniejsza konkurencja/pokarm).
    var landBonus = 0;
    if (env.land && (next.traits.indexOf('limbs') !== -1)) {
      landBonus = 1.5;
      energy += landBonus;
      unlockKnowledge(next, 'land');
    }

    // --- Drapieżnictwo ---
    var mobilityShield = stat(next, 'mobility') * 0.4;
    var predationPressure = Math.max(0, env.predators - stat(next, 'defense') - mobilityShield);
    var predationLossRate = clamp(predationPressure * 0.035, 0, 0.45);

    // --- Głód ---
    var starvationLossRate = 0;
    if (energy < 0) {
      starvationLossRate = clamp(-energy * 0.03, 0, 0.5);
    }

    // --- Narodziny ---
    var birthRate = 0;
    if (energy >= 0) {
      // Nadwyżka energii i tempo rozrodu napędzają wzrost populacji.
      birthRate = clamp(0.03 * stat(next, 'reproduction') * (1 + energy * 0.05), 0, 0.6);
    }

    var births = Math.round(popBefore * birthRate);
    var predationDeaths = Math.round(popBefore * predationLossRate);
    var starvationDeaths = Math.round(popBefore * starvationLossRate);

    var popAfter = popBefore + births - predationDeaths - starvationDeaths;
    popAfter = Math.max(0, Math.round(popAfter));
    next.species.population = popAfter;
    if (popAfter > next.species.peakPopulation) next.species.peakPopulation = popAfter;

    // --- Zdarzenia i karty wiedzy ---
    if (predationLossRate > 0.15) {
      events.push({ type: 'predation', text: 'Silna presja drapieżników — populacja poniosła straty.' });
      knowledge.push('predation');
    }
    if (starvationLossRate > 0) {
      events.push({ type: 'starvation', text: 'Ujemny bilans energetyczny — część populacji głoduje.' });
      knowledge.push('starvation');
    }
    if (env.climate === 'zimno') {
      knowledge.push('cold');
    }
    if (env.land) {
      knowledge.push('land');
    }

    // --- Punkty ewolucji (ZALOZENIA 4.2) ---
    // Za przetrwanie, wzrost populacji i postęp inteligencji.
    var growth = popAfter - popBefore;
    var epGain = 0;
    if (popAfter > 0) {
      epGain += 12; // za przetrwanie tury
      epGain += Math.max(0, Math.floor(growth / 15)); // za wzrost populacji
      epGain += Math.floor(popAfter / 150); // za liczną, prosperującą populację
      epGain += Math.floor(stat(next, 'intelligence') / 2); // premia za inteligencję
      if (landBonus > 0) epGain += 4; // za zajęcie nowej niszy (ląd)
    }
    next.ep += epGain;

    // Odblokuj karty wiedzy zebrane w tej turze.
    for (var k = 0; k < knowledge.length; k++) unlockKnowledge(next, knowledge[k]);

    // --- Postęp tury i warunek końca ---
    next.turn = turnIndex + 1;
    var status = evaluateStatus(next);
    next.status = status;

    var report = {
      turnIndex: turnIndex,
      envTitle: env.title,
      envNote: env.note,
      climate: env.climate,
      popBefore: popBefore,
      popAfter: popAfter,
      births: births,
      predationDeaths: predationDeaths,
      starvationDeaths: starvationDeaths,
      energy: round1(energy),
      foodIntake: round1(foodIntake),
      upkeep: round1(upkeep),
      predationPressure: round1(predationPressure),
      epGain: epGain,
      intelligence: stat(next, 'intelligence'),
      intelligenceGoal: next.intelligenceGoal,
      events: events,
      knowledge: dedupe(knowledge),
      status: status
    };
    next.history.push(report);

    return { state: next, report: report };
  }

  /* Ocena stanu gry po turze. */
  function evaluateStatus(state) {
    if (state.species.population <= 0) return 'lost';
    if (state.turn >= state.maxTurns) {
      return stat(state, 'intelligence') >= state.intelligenceGoal ? 'won' : 'survived';
    }
    // Zwycięstwo można też osiągnąć wcześniej, jeśli inteligencja przekroczy próg.
    if (stat(state, 'intelligence') >= state.intelligenceGoal) return 'won';
    return 'playing';
  }

  function statLabel(key) {
    var labels = {
      feeding: 'odżywianie', defense: 'obrona', reproduction: 'rozród',
      mobility: 'mobilność', metabolism: 'metabolizm', intelligence: 'inteligencja'
    };
    return labels[key] || key;
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  function dedupe(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      if (!seen[arr[i]]) { seen[arr[i]] = true; out.push(arr[i]); }
    }
    return out;
  }

  return {
    createInitialState: createInitialState,
    buyTrait: buyTrait,
    traitStatus: traitStatus,
    prerequisitesMet: prerequisitesMet,
    simulateTurn: simulateTurn,
    evaluateStatus: evaluateStatus,
    statLabel: statLabel,
    // eksport pomocniczych do testów:
    _internals: { rollMutation: rollMutation, clamp: clamp }
  };
});
