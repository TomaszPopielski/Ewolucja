/*
 * data.js — dane gry (konfiguracja).
 *
 * Zgodnie z ZALOZENIA.md (sekcja 9): cechy, ery i karty wiedzy trzymamy jako
 * dane, oddzielone od logiki i UI. Dzięki temu można je rozbudowywać i
 * recenzować merytorycznie bez zmian w kodzie silnika.
 *
 * Plik działa i w przeglądarce (globalne `GameData`), i w Node (module.exports)
 * — ten sam plik zasila grę oraz testy silnika.
 */
(function (root, factory) {
  var data = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = data;
  } else {
    root.GameData = data;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Statystyki startowe gatunku — prosty organizm wczesnego paleozoiku.
  // Skala pojęciowa: ~0–20. Cechy modyfikują te wartości.
  var BASE_STATS = {
    feeding: 5, // odżywianie
    defense: 3, // obrona
    reproduction: 5, // rozród
    mobility: 3, // mobilność
    metabolism: 5, // metabolizm (koszt energetyczny)
    intelligence: 1 // inteligencja (postęp do celu)
  };

  var INTELLIGENCE_GOAL = 10; // próg "gatunku rozumnego" dla tej ery (MVP)
  var START_POPULATION = 120;
  var START_EP = 35;

  // Kategorie cech (ZALOZENIA 4.2).
  var CATEGORIES = {
    pokarm: 'Pokarm',
    lokomocja: 'Lokomocja',
    obrona: 'Obrona',
    zmysly: 'Zmysły',
    rozrod: 'Rozród',
    termoregulacja: 'Termoregulacja',
    uklad_nerwowy: 'Układ nerwowy'
  };

  /*
   * Cechy (traity). Każda ma:
   *  - koszt (EP),
   *  - warunki wstępne (requires: lista id) — drzewo zależności,
   *  - efekty (deltas na statystykach),
   *  - kompromis (tradeoff) — krótki opis, że nic nie jest darmowe,
   *  - opis edukacyjny.
   */
  var TRAITS = [
    // --- Pokarm ---
    {
      id: 'filter_feeding', name: 'Filtrowanie pokarmu', category: 'pokarm', cost: 10,
      requires: [], effects: { feeding: 2 },
      tradeoff: 'Skuteczne tylko przy dużej ilości planktonu.',
      desc: 'Odcedzanie drobnych cząstek pokarmu z wody — tania strategia odżywiania.'
    },
    {
      id: 'jaws', name: 'Szczęki', category: 'pokarm', cost: 16,
      requires: [], effects: { feeding: 3, metabolism: 1 },
      tradeoff: 'Więcej pokarmu, ale wyższe zapotrzebowanie energetyczne.',
      desc: 'Ruchome szczęki otwierają dostęp do większej i twardszej zdobyczy.'
    },
    {
      id: 'omnivory', name: 'Wszystkożerność', category: 'pokarm', cost: 22,
      requires: ['jaws'], effects: { feeding: 2, defense: 1, metabolism: 1 },
      tradeoff: 'Elastyczna dieta kosztuje dodatkową energię.',
      desc: 'Jedzenie i roślin, i zwierząt uniezależnia od jednego źródła pokarmu.'
    },

    // --- Lokomocja ---
    {
      id: 'fins', name: 'Płetwy', category: 'lokomocja', cost: 10,
      requires: [], effects: { mobility: 2 },
      tradeoff: 'Sprawne w wodzie, bezużyteczne na lądzie.',
      desc: 'Płetwy poprawiają manewrowość i ucieczkę przed drapieżnikami.'
    },
    {
      id: 'fast_muscle', name: 'Szybkie mięśnie', category: 'lokomocja', cost: 15,
      requires: ['fins'], effects: { mobility: 2, defense: 1, metabolism: 2 },
      tradeoff: 'Zrywy prędkości są bardzo energochłonne.',
      desc: 'Włókna szybkokurczliwe pozwalają na gwałtowne uniki i pościgi.'
    },
    {
      id: 'limbs', name: 'Kończyny', category: 'lokomocja', cost: 22,
      requires: ['fins'], effects: { mobility: 3, metabolism: 1 },
      tradeoff: 'Otwiera ląd, ale wymaga przebudowy szkieletu.',
      desc: 'Przekształcenie płetw w kończyny umożliwia wyjście na ląd.'
    },

    // --- Obrona ---
    {
      id: 'scales', name: 'Łuski', category: 'obrona', cost: 10,
      requires: [], effects: { defense: 2 },
      tradeoff: 'Lekka ochrona, ogranicza wymianę gazową przez skórę.',
      desc: 'Zrogowaciała skóra chroni przed urazami i wysychaniem.'
    },
    {
      id: 'shell', name: 'Pancerz', category: 'obrona', cost: 16,
      requires: [], effects: { defense: 4, mobility: -1, metabolism: 2 },
      tradeoff: 'Świetna obrona kosztem ruchliwości i energii.',
      desc: 'Twardy pancerz zniechęca większość drapieżników.'
    },
    {
      id: 'camouflage', name: 'Kamuflaż', category: 'obrona', cost: 14,
      requires: ['eyes'], effects: { defense: 3 },
      tradeoff: 'Zawodzi, gdy trzeba się aktywnie poruszać.',
      desc: 'Ubarwienie zlewające się z otoczeniem to obrona bez kosztu ruchu.'
    },

    // --- Zmysły ---
    {
      id: 'eyes', name: 'Oczy', category: 'zmysly', cost: 12,
      requires: [], effects: { feeding: 1, defense: 1 },
      tradeoff: 'Rozwój narządu wymaga stabilnego pokarmu.',
      desc: 'Wzrok ułatwia zdobywanie pokarmu i wczesne wykrycie zagrożeń.'
    },
    {
      id: 'lateral_line', name: 'Linia boczna', category: 'zmysly', cost: 10,
      requires: [], effects: { defense: 1, mobility: 1 },
      tradeoff: 'Działa wyłącznie w środowisku wodnym.',
      desc: 'Narząd czuciowy wykrywa drgania wody — ostrzega przed drapieżnikiem.'
    },

    // --- Rozród ---
    {
      id: 'many_eggs', name: 'Liczne jaja', category: 'rozrod', cost: 12,
      requires: [], effects: { reproduction: 3 },
      tradeoff: 'Ilość zamiast jakości — duża śmiertelność potomstwa.',
      desc: 'Składanie wielu jaj zwiększa szansę, że część przetrwa.'
    },
    {
      id: 'amniotic_egg', name: 'Jajo lądowe', category: 'rozrod', cost: 20,
      requires: ['scales'], effects: { reproduction: 2, defense: 1 },
      tradeoff: 'Uniezależnia rozród od wody, ale to kosztowna adaptacja.',
      desc: 'Jajo z błonami i skorupą można składać na lądzie.'
    },
    {
      id: 'parental_care', name: 'Opieka nad potomstwem', category: 'rozrod', cost: 24,
      requires: ['many_eggs'], effects: { reproduction: 2, intelligence: 1, metabolism: 1 },
      tradeoff: 'Mniej potomstwa, za to lepiej chronionego.',
      desc: 'Ochrona młodych podnosi ich przeżywalność i sprzyja uczeniu się.'
    },

    // --- Termoregulacja ---
    {
      id: 'endothermy', name: 'Stałocieplność', category: 'termoregulacja', cost: 22,
      requires: ['scales'], effects: { feeding: 1, defense: 1, metabolism: 3 },
      tradeoff: 'Aktywność niezależna od pogody, ale ogromny koszt energii.',
      desc: 'Utrzymywanie stałej temperatury ciała pozwala działać w chłodzie.'
    },

    // --- Układ nerwowy (droga do inteligencji) ---
    {
      id: 'ganglia', name: 'Zwoje nerwowe', category: 'uklad_nerwowy', cost: 15,
      requires: [], effects: { intelligence: 2, defense: 1 },
      tradeoff: 'Szybsze reakcje, lekko wyższy metabolizm.',
      desc: 'Skupiska komórek nerwowych przyspieszają przetwarzanie bodźców.'
    },
    {
      id: 'brain', name: 'Mózg', category: 'uklad_nerwowy', cost: 22,
      requires: ['ganglia'], effects: { intelligence: 3, feeding: 1, metabolism: 2 },
      tradeoff: 'Mózg jest kosztowny energetycznie — wymaga dobrego odżywiania.',
      desc: 'Scentralizowany mózg umożliwia złożone zachowania.'
    },
    {
      id: 'big_brain', name: 'Rozbudowany mózg', category: 'uklad_nerwowy', cost: 30,
      requires: ['brain', 'endothermy'], effects: { intelligence: 4, metabolism: 3 },
      tradeoff: 'Droga do rozumności — bardzo energochłonna.',
      desc: 'Powiększona kora pozwala na uczenie się, planowanie i kulturę.'
    }
  ];

  /*
   * Era: Paleozoik — 8 tur (ZALOZENIA sekcja 5, MVP sekcja 10).
   * Każda tura ma parametry środowiska (ZALOZENIA 4.3):
   *  - oxygen: poziom tlenu (skala ~5–16),
   *  - food: dostępność pokarmu (~5–15),
   *  - predators: presja drapieżników (~2–14),
   *  - climate: 'cieplo' | 'umiarkowanie' | 'zimno',
   *  - land: czy tura premiuje wyjście na ląd.
   */
  var ERA = {
    id: 'paleozoik',
    name: 'Paleozoik',
    intro: 'Twoja linia rozwojowa startuje w ciepłych, płytkich morzach. ' +
      'Przed nią setki milionów lat: rozkwit drapieżników, wahania tlenu i klimatu, ' +
      'a wreszcie kuszący, pusty ląd. Poprowadź gatunek ku inteligencji.',
    turns: [
      { title: 'Kambr — eksplozja życia', oxygen: 8, food: 12, predators: 4, climate: 'cieplo', land: false,
        note: 'Morza pełne pokarmu, ale pojawiają się pierwsi drapieżcy.' },
      { title: 'Ordowik — rafy i łowcy', oxygen: 9, food: 11, predators: 6, climate: 'cieplo', land: false,
        note: 'Rośnie presja drapieżników — obrona zaczyna się liczyć.' },
      { title: 'Ordowik — zlodowacenie', oxygen: 8, food: 7, predators: 5, climate: 'zimno', land: false,
        note: 'Nagłe ochłodzenie ścina dostępność pokarmu.' },
      { title: 'Sylur — stabilizacja', oxygen: 10, food: 10, predators: 7, climate: 'umiarkowanie', land: false,
        note: 'Klimat łagodnieje; pierwsze rośliny wychodzą na ląd.' },
      { title: 'Dewon — wiek ryb', oxygen: 11, food: 9, predators: 10, climate: 'umiarkowanie', land: false,
        note: 'Wielcy drapieżni ryby dominują — bez obrony lub prędkości jest ciężko.' },
      { title: 'Dewon — brzeg lądu', oxygen: 11, food: 8, predators: 8, climate: 'cieplo', land: true,
        note: 'Ląd stoi otworem: kończyny i jaja lądowe dają przewagę.' },
      { title: 'Karbon — bujne lasy', oxygen: 15, food: 13, predators: 7, climate: 'cieplo', land: true,
        note: 'Wysoki tlen sprzyja aktywności i dużym rozmiarom ciała.' },
      { title: 'Perm — surowy klimat', oxygen: 9, food: 8, predators: 9, climate: 'zimno', land: true,
        note: 'Wahania klimatu premiują stałocieplność. Ostatnia próba przed celem.' }
    ]
  };

  /*
   * Karty wiedzy (ZALOZENIA sekcja 6). Wyświetlane po zdarzeniach.
   * `trigger` odpowiada zdarzeniom generowanym przez silnik.
   */
  var KNOWLEDGE = {
    intro: {
      title: 'Czym jest dobór naturalny?',
      body: 'Osobniki różnią się cechami. Te lepiej przystosowane do warunków częściej ' +
        'przeżywają i zostawiają potomstwo, przekazując mu swoje cechy. Po wielu pokoleniach ' +
        'populacja zmienia się — to dobór naturalny w działaniu.'
    },
    mutation_good: {
      title: 'Mutacje — źródło zmienności',
      body: 'Mutacja to losowa zmiana materiału genetycznego. Większość jest neutralna lub ' +
        'szkodliwa, ale czasem daje przewagę. Dobór naturalny „premiuje” te korzystne.'
    },
    mutation_bad: {
      title: 'Nie każda zmiana pomaga',
      body: 'Ta mutacja pogorszyła jedną z cech. W naturze osobniki z niekorzystnymi ' +
        'mutacjami częściej giną — dlatego szkodliwe warianty są z czasem „odsiewane”.'
    },
    predation: {
      title: 'Presja drapieżników',
      body: 'Drapieżniki to silna presja selekcyjna. Gdy obrona gatunku jest za słaba, ' +
        'populacja topnieje. Adaptacje takie jak pancerz, kamuflaż czy prędkość to odpowiedź ewolucji.'
    },
    starvation: {
      title: 'Bilans energetyczny',
      body: 'Metabolizm to koszt utrzymania organizmu. Jeśli zdobyty pokarm nie pokrywa tego ' +
        'kosztu, populacja głoduje. Cechy zwiększające sprawność bywają kosztowne — to kompromis.'
    },
    cold: {
      title: 'Klimat jako presja',
      body: 'Ochłodzenie ogranicza pokarm i aktywność zwierząt zmiennocieplnych. Stałocieplność ' +
        'pozwala działać w chłodzie, ale wymaga znacznie więcej energii — nic za darmo.'
    },
    land: {
      title: 'Podbój lądu',
      body: 'Wyjście na ląd to jeden z przełomów w historii życia. Wymagało kończyn, ' +
        'oddychania powietrzem i rozrodu niezależnego od wody (jajo lądowe).'
    },
    intelligence: {
      title: 'Ewolucja inteligencji',
      body: 'Duży mózg daje przewagę (uczenie się, współpraca), ale zużywa mnóstwo energii. ' +
        'Dlatego rozwija się tylko tam, gdzie ta przewaga naprawdę się opłaca.'
    }
  };

  return {
    BASE_STATS: BASE_STATS,
    INTELLIGENCE_GOAL: INTELLIGENCE_GOAL,
    START_POPULATION: START_POPULATION,
    START_EP: START_EP,
    CATEGORIES: CATEGORIES,
    TRAITS: TRAITS,
    ERA: ERA,
    KNOWLEDGE: KNOWLEDGE
  };
});
