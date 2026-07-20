/*
 * data.js — dane gry (konfiguracja).
 *
 * Zgodnie z ZALOZENIA.md (sekcja 9): cechy, ery i karty wiedzy trzymamy jako
 * dane, oddzielone od logiki i UI. Ten plik jest zarazem jednostką tłumaczenia
 * (i18n): treść merytoryczna gry jest tu, po polsku; przetłumaczenie gry to
 * podmiana tego pliku (patrz js/i18n.js dla stringów interfejsu).
 *
 * Plik działa i w przeglądarce (globalne `GameData`), i w Node (module.exports).
 */
(function (root, factory) {
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.GameData = data;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASE_STATS = {
    feeding: 5, defense: 3, reproduction: 5, mobility: 3, metabolism: 5, intelligence: 1
  };

  var INTELLIGENCE_GOAL = 14; // próg "gatunku rozumnego" — osiągalny dopiero w kenozoiku
  var START_POPULATION = 120;
  var START_EP = 35;

  var SPECIATION_COST = 12;
  var MIN_SPECIATION_POP = 60;

  // Nisze ekologiczne (ZALOZENIA 4.3, 4.5).
  var NICHES = { woda: 'Woda', lad: 'Ląd' };

  var CATEGORIES = {
    pokarm: 'Pokarm', lokomocja: 'Lokomocja', obrona: 'Obrona', zmysly: 'Zmysły',
    rozrod: 'Rozród', termoregulacja: 'Termoregulacja', uklad_nerwowy: 'Układ nerwowy'
  };

  /*
   * Cechy. Pola:
   *  cost, requires (drzewo zależności), effects (deltas), tradeoff, desc,
   *  minEra (opcjonalnie: indeks ery, od której cecha jest dostępna — kamień
   *          milowy), path: 'intelligence' oznacza cechę na drodze do rozumności.
   */
  var TRAITS = [
    // --- Pokarm ---
    { id: 'filter_feeding', name: 'Filtrowanie pokarmu', category: 'pokarm', cost: 10, requires: [],
      effects: { feeding: 2 }, tradeoff: 'Skuteczne tylko przy dużej ilości planktonu.',
      desc: 'Odcedzanie drobnych cząstek pokarmu z wody — tania strategia odżywiania.' },
    { id: 'jaws', name: 'Szczęki', category: 'pokarm', cost: 16, requires: [],
      effects: { feeding: 3, metabolism: 1 }, tradeoff: 'Więcej pokarmu, ale wyższy metabolizm.',
      desc: 'Ruchome szczęki otwierają dostęp do większej i twardszej zdobyczy.' },
    { id: 'omnivory', name: 'Wszystkożerność', category: 'pokarm', cost: 22, requires: ['jaws'],
      effects: { feeding: 2, defense: 1, metabolism: 1 }, tradeoff: 'Elastyczna dieta kosztuje energię.',
      desc: 'Jedzenie i roślin, i zwierząt uniezależnia od jednego źródła pokarmu.' },

    // --- Lokomocja ---
    { id: 'fins', name: 'Płetwy', category: 'lokomocja', cost: 10, requires: [],
      effects: { mobility: 2 }, tradeoff: 'Sprawne w wodzie, bezużyteczne na lądzie.',
      desc: 'Płetwy poprawiają manewrowość i ucieczkę przed drapieżnikami.' },
    { id: 'fast_muscle', name: 'Szybkie mięśnie', category: 'lokomocja', cost: 15, requires: ['fins'],
      effects: { mobility: 2, defense: 1, metabolism: 2 }, tradeoff: 'Zrywy prędkości są energochłonne.',
      desc: 'Włókna szybkokurczliwe pozwalają na gwałtowne uniki i pościgi.' },
    { id: 'limbs', name: 'Kończyny', category: 'lokomocja', cost: 22, requires: ['fins'],
      effects: { mobility: 3, metabolism: 1 }, tradeoff: 'Otwiera ląd, ale wymaga przebudowy szkieletu.',
      desc: 'Przekształcenie płetw w kończyny umożliwia migrację na ląd.' },
    { id: 'grasping_hand', name: 'Ręka chwytna', category: 'lokomocja', cost: 20, requires: ['limbs'],
      effects: { feeding: 1, intelligence: 1 }, minEra: 2,
      tradeoff: 'Precyzyjny chwyt wymaga rozwiniętej koordynacji.',
      desc: 'Chwytna dłoń pozwala manipulować przedmiotami — podstawa używania narzędzi.' },

    // --- Obrona ---
    { id: 'scales', name: 'Łuski', category: 'obrona', cost: 10, requires: [],
      effects: { defense: 2 }, tradeoff: 'Lekka ochrona, ogranicza wymianę gazową przez skórę.',
      desc: 'Zrogowaciała skóra chroni przed urazami i wysychaniem.' },
    { id: 'shell', name: 'Pancerz', category: 'obrona', cost: 16, requires: [],
      effects: { defense: 4, mobility: -1, metabolism: 2 }, tradeoff: 'Świetna obrona kosztem ruchu i energii.',
      desc: 'Twardy pancerz zniechęca większość drapieżników.' },
    { id: 'camouflage', name: 'Kamuflaż', category: 'obrona', cost: 14, requires: ['eyes'],
      effects: { defense: 3 }, tradeoff: 'Zawodzi, gdy trzeba się aktywnie poruszać.',
      desc: 'Ubarwienie zlewające się z otoczeniem to obrona bez kosztu ruchu.' },

    // --- Zmysły ---
    { id: 'eyes', name: 'Oczy', category: 'zmysly', cost: 12, requires: [],
      effects: { feeding: 1, defense: 1 }, tradeoff: 'Rozwój narządu wymaga stabilnego pokarmu.',
      desc: 'Wzrok ułatwia zdobywanie pokarmu i wczesne wykrycie zagrożeń.' },
    { id: 'lateral_line', name: 'Linia boczna', category: 'zmysly', cost: 10, requires: [],
      effects: { defense: 1, mobility: 1 }, tradeoff: 'Działa wyłącznie w środowisku wodnym.',
      desc: 'Narząd czuciowy wykrywa drgania wody — ostrzega przed drapieżnikiem.' },

    // --- Rozród ---
    { id: 'many_eggs', name: 'Liczne jaja', category: 'rozrod', cost: 12, requires: [],
      effects: { reproduction: 3 }, tradeoff: 'Ilość zamiast jakości — duża śmiertelność potomstwa.',
      desc: 'Składanie wielu jaj zwiększa szansę, że część przetrwa.' },
    { id: 'amniotic_egg', name: 'Jajo lądowe', category: 'rozrod', cost: 20, requires: ['scales'],
      effects: { reproduction: 2, defense: 1 }, tradeoff: 'Uniezależnia rozród od wody, ale kosztowne.',
      desc: 'Jajo z błonami i skorupą można składać na lądzie.' },
    { id: 'parental_care', name: 'Opieka nad potomstwem', category: 'rozrod', cost: 24, requires: ['many_eggs'],
      effects: { reproduction: 2, intelligence: 1, metabolism: 1 }, tradeoff: 'Mniej potomstwa, lepiej chronionego.',
      desc: 'Ochrona młodych podnosi ich przeżywalność i sprzyja uczeniu się.' },

    // --- Termoregulacja ---
    { id: 'endothermy', name: 'Stałocieplność', category: 'termoregulacja', cost: 22, requires: ['scales'],
      effects: { feeding: 1, defense: 1, metabolism: 3 }, tradeoff: 'Aktywność niezależna od pogody, ale ogromny koszt energii.',
      desc: 'Utrzymywanie stałej temperatury ciała pozwala działać w chłodzie.' },
    { id: 'insulation', name: 'Izolacja (pióra/futro)', category: 'termoregulacja', cost: 18, requires: ['endothermy'],
      effects: { defense: 1, metabolism: -1 }, minEra: 1,
      tradeoff: 'Zmniejsza koszt stałocieplności, ale to kolejna inwestycja.',
      desc: 'Warstwa izolująca ogranicza utratę ciepła — obniża koszt metabolizmu.' },

    // --- Układ nerwowy (droga do inteligencji) ---
    { id: 'ganglia', name: 'Zwoje nerwowe', category: 'uklad_nerwowy', cost: 15, requires: [], path: 'intelligence',
      effects: { intelligence: 2, defense: 1 }, tradeoff: 'Szybsze reakcje, lekko wyższy metabolizm.',
      desc: 'Skupiska komórek nerwowych przyspieszają przetwarzanie bodźców.' },
    { id: 'brain', name: 'Mózg', category: 'uklad_nerwowy', cost: 22, requires: ['ganglia'], path: 'intelligence',
      effects: { intelligence: 3, feeding: 1, metabolism: 2 }, tradeoff: 'Mózg jest kosztowny — wymaga dobrego odżywiania.',
      desc: 'Scentralizowany mózg umożliwia złożone zachowania.' },
    { id: 'big_brain', name: 'Rozbudowany mózg', category: 'uklad_nerwowy', cost: 30, requires: ['brain', 'endothermy'], path: 'intelligence',
      effects: { intelligence: 4, metabolism: 3 }, tradeoff: 'Bardzo energochłonny — potrzebuje stabilnej energii.',
      desc: 'Powiększona kora pozwala na uczenie się i planowanie.' },
    { id: 'social', name: 'Zachowania społeczne', category: 'uklad_nerwowy', cost: 26, requires: ['brain'], path: 'intelligence', minEra: 1,
      effects: { intelligence: 2, defense: 1, metabolism: 1 }, tradeoff: 'Życie w grupie wymaga komunikacji i koordynacji.',
      desc: 'Współpraca i uczenie się od innych przyspieszają rozwój poznawczy.' },
    { id: 'tool_use', name: 'Używanie narzędzi', category: 'uklad_nerwowy', cost: 34, requires: ['big_brain', 'social', 'grasping_hand'], path: 'intelligence', minEra: 2,
      effects: { intelligence: 3, feeding: 2, metabolism: 1 }, tradeoff: 'Kulminacja: wymaga mózgu, życia społecznego i ręki chwytnej.',
      desc: 'Wytwarzanie i używanie narzędzi to próg kultury i technologii.' }
  ];

  /* Pomocnicza: środowisko lądowe wyprowadzone z wartości bazowych (woda). */
  function land(food, predators, extra) {
    var o = { food: food, predators: predators };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  /*
   * Ery (ZALOZENIA sekcja 5). Każda tura: oxygen, food, predators, climate,
   * land (obiekt {food, predators} — środowisko niszy lądowej), catastrophe?.
   */
  var ERAS = [
    {
      id: 'paleozoik', name: 'Paleozoik',
      intro: 'Twoja linia startuje w ciepłych, płytkich morzach. Przed nią rozkwit drapieżników, ' +
        'wahania tlenu i klimatu, a wreszcie kuszący, pusty ląd.',
      milestone: 'Kamienie milowe: szkielet, płetwy → kończyny, oddychanie powietrzem, wyjście na ląd.',
      turns: [
        { title: 'Kambr — eksplozja życia', oxygen: 8, food: 12, predators: 4, climate: 'cieplo', land: land(5, 2),
          note: 'Morza pełne pokarmu, ale pojawiają się pierwsi drapieżcy.' },
        { title: 'Ordowik — rafy i łowcy', oxygen: 9, food: 11, predators: 6, climate: 'cieplo', land: land(5, 2),
          note: 'Rośnie presja drapieżników — obrona zaczyna się liczyć.' },
        { title: 'Ordowik — zlodowacenie', oxygen: 8, food: 7, predators: 5, climate: 'zimno', land: land(4, 2),
          note: 'Nagłe ochłodzenie ścina dostępność pokarmu.',
          catastrophe: { name: 'Wymieranie ordowickie', niche: 'woda', severity: 0.35, knowledge: 'extinction' } },
        { title: 'Sylur — stabilizacja', oxygen: 10, food: 10, predators: 7, climate: 'umiarkowanie', land: land(7, 3),
          note: 'Klimat łagodnieje; pierwsze rośliny wychodzą na ląd.' },
        { title: 'Dewon — wiek ryb', oxygen: 11, food: 9, predators: 10, climate: 'umiarkowanie', land: land(9, 3),
          note: 'Wielkie drapieżne ryby dominują w wodzie — na lądzie spokojniej.' },
        { title: 'Dewon — brzeg lądu', oxygen: 11, food: 8, predators: 8, climate: 'cieplo', land: land(11, 3),
          note: 'Ląd stoi otworem: z kończynami warto migrować.' },
        { title: 'Karbon — bujne lasy', oxygen: 15, food: 10, predators: 7, climate: 'cieplo', land: land(14, 4),
          note: 'Wysoki tlen i bujna roślinność sprzyjają życiu na lądzie.' },
        { title: 'Perm — Wielkie Wymieranie', oxygen: 9, food: 7, predators: 9, climate: 'zimno', land: land(9, 5),
          note: 'Największa katastrofa w dziejach życia uderza w morza.',
          catastrophe: { name: 'Wymieranie permskie', niche: 'woda', severity: 0.55, knowledge: 'extinction' } }
      ]
    },
    {
      id: 'mezozoik', name: 'Mezozoik',
      intro: 'Era gadów. Ląd należy do dinozaurów, a klimat jest ciepły. Twoje linie mogą ' +
        'wejść w cień wielkich drapieżników — albo dorównać im rozmiarem i sprytem.',
      milestone: 'Kamienie milowe: jajo lądowe, stałocieplność, izolacja (pióra/futro), życie społeczne.',
      turns: [
        { title: 'Trias — po katastrofie', oxygen: 10, food: 9, predators: 6, climate: 'cieplo', land: land(10, 6),
          note: 'Świat odradza się po wymieraniu — wiele nisz stoi otworem.' },
        { title: 'Trias — pierwsze dinozaury', oxygen: 11, food: 10, predators: 9, climate: 'cieplo', land: land(11, 9),
          note: 'Na lądzie rosną w siłę nowi, sprawni drapieżcy.' },
        { title: 'Jura — giganty', oxygen: 13, food: 12, predators: 12, climate: 'cieplo', land: land(13, 12),
          note: 'Wielkie dinozaury dominują ląd — przetrwa obrona, prędkość lub spryt.' },
        { title: 'Jura — chłodniejsze noce', oxygen: 12, food: 9, predators: 11, climate: 'umiarkowanie', land: land(10, 11),
          note: 'Stałocieplność i izolacja dają przewagę w chłodniejsze noce.' },
        { title: 'Kreda — kwitnące rośliny', oxygen: 12, food: 13, predators: 10, climate: 'cieplo', land: land(14, 10),
          note: 'Rośliny kwiatowe i owady tworzą nowe źródła pokarmu.' },
        { title: 'Kreda — uderzenie asteroidy', oxygen: 10, food: 6, predators: 8, climate: 'zimno', land: land(6, 8),
          note: 'Asteroida i zima uderzeniowa kończą erę dinozaurów.',
          catastrophe: { name: 'Wymieranie kredowe (K–Pg)', niche: 'all', severity: 0.5, knowledge: 'extinction' } }
      ]
    },
    {
      id: 'kenozoik', name: 'Kenozoik',
      intro: 'Era ssaków. Klimat stopniowo się ochładza, a inteligencja i życie społeczne stają ' +
        'się realną przewagą. To tu może narodzić się gatunek rozumny.',
      milestone: 'Kamienie milowe: opieka nad potomstwem, ręka chwytna, duży mózg, używanie narzędzi.',
      turns: [
        { title: 'Paleogen — świt ssaków', oxygen: 11, food: 12, predators: 7, climate: 'cieplo', land: land(13, 7),
          note: 'Po dinozaurach ssaki zajmują opustoszałe nisze.' },
        { title: 'Paleogen — pierwsze naczelne', oxygen: 11, food: 11, predators: 8, climate: 'umiarkowanie', land: land(12, 8),
          note: 'Życie na drzewach premiuje wzrok, chwyt i większy mózg.' },
        { title: 'Neogen — sawanny', oxygen: 11, food: 9, predators: 9, climate: 'umiarkowanie', land: land(10, 9),
          note: 'Otwarte przestrzenie sprzyjają współpracy i sprytnym łowom.' },
        { title: 'Neogen — ochłodzenie', oxygen: 10, food: 8, predators: 9, climate: 'zimno', land: land(8, 9),
          note: 'Chłód premiuje izolację, zapasy i inteligencję.' },
        { title: 'Plejstocen — epoki lodowcowe', oxygen: 10, food: 7, predators: 8, climate: 'zimno', land: land(8, 8),
          note: 'Zlodowacenia to twarda szkoła — przetrwają najbardziej elastyczni.' },
        { title: 'Współczesność — próg rozumności', oxygen: 11, food: 10, predators: 6, climate: 'umiarkowanie', land: land(11, 6),
          note: 'Ostatnia tura: czy Twoja linia przekroczy próg inteligencji?' }
      ]
    }
  ];

  /*
   * Karty wiedzy (ZALOZENIA sekcja 6). Pole `fossil` (opcjonalne) wiąże pojęcie
   * z realnym organizmem/wydarzeniem kopalnym.
   */
  var KNOWLEDGE = {
    intro: { title: 'Czym jest dobór naturalny?',
      body: 'Osobniki różnią się cechami. Te lepiej przystosowane częściej przeżywają i zostawiają ' +
        'potomstwo, przekazując mu swoje cechy. Po wielu pokoleniach populacja się zmienia.' },
    mutation_good: { title: 'Mutacje — źródło zmienności',
      body: 'Mutacja to losowa zmiana materiału genetycznego. Większość jest neutralna lub szkodliwa, ' +
        'ale czasem daje przewagę, którą dobór naturalny „premiuje”.' },
    mutation_bad: { title: 'Nie każda zmiana pomaga',
      body: 'Ta mutacja pogorszyła cechę. W naturze osobniki z niekorzystnymi mutacjami częściej giną — ' +
        'dlatego szkodliwe warianty są z czasem „odsiewane”.' },
    predation: { title: 'Presja drapieżników',
      body: 'Gdy obrona gatunku jest za słaba, populacja topnieje. Pancerz, kamuflaż czy prędkość to ' +
        'odpowiedzi ewolucji na drapieżnictwo.',
      fossil: 'W kambrze polował Anomalocaris — jeden z pierwszych wielkich drapieżników.' },
    starvation: { title: 'Bilans energetyczny',
      body: 'Metabolizm to koszt utrzymania organizmu. Jeśli zdobyty pokarm go nie pokrywa, populacja ' +
        'głoduje. Sprawniejsze cechy bywają kosztowne — to kompromis.' },
    cold: { title: 'Klimat jako presja',
      body: 'Ochłodzenie ogranicza pokarm i aktywność zwierząt zmiennocieplnych. Stałocieplność pozwala ' +
        'działać w chłodzie, ale wymaga znacznie więcej energii.' },
    land: { title: 'Podbój lądu',
      body: 'Wyjście na ląd wymagało kończyn, oddychania powietrzem i rozrodu niezależnego od wody.',
      fossil: 'Tiktaalik (dewon) łączy cechy ryb i płazów — ilustruje przejście na ląd.' },
    intelligence: { title: 'Ewolucja inteligencji',
      body: 'Duży mózg daje przewagę (uczenie się, współpraca), ale zużywa mnóstwo energii. Rozwija się ' +
        'tam, gdzie ta przewaga się opłaca.' },
    speciation: { title: 'Specjacja — powstawanie gatunków',
      body: 'Gdy część populacji przystosuje się do odrębnej niszy i przestaje wymieniać geny z resztą, ' +
        'powstaje nowy gatunek. Tak linie rozgałęziają się w „drzewo życia”.',
      fossil: 'Zięby Darwina z Galapagos to klasyczny przykład szybkiej specjacji w różnych niszach.' },
    niche: { title: 'Nisza ekologiczna',
      body: 'Nisza to zespół warunków i zasobów, w których gatunek żyje. Różne nisze (woda, ląd) mają ' +
        'inne pokarmy i zagrożenia — dlatego rozdzielenie linii między nisze rozkłada ryzyko.' },
    extinction: { title: 'Wymieranie masowe',
      body: 'To gwałtowny zanik wielu gatunków w krótkim (geologicznie) czasie. Uderza najmocniej w linie ' +
        'niedostosowane do nowych warunków — dywersyfikacja (wiele linii w różnych niszach) zwiększa ' +
        'szansę, że któraś przetrwa.',
      fossil: 'Wymieranie permskie (~252 mln lat temu) zgładziło ok. 90% gatunków morskich.' },
    milestone: { title: 'Kamienie milowe ewolucji',
      body: 'Każda era premiuje inne adaptacje: szkielet i kończyny w paleozoiku, jaja lądowe i ' +
        'stałocieplność w mezozoiku, mózg i narzędzia w kenozoiku.' }
  };

  return {
    BASE_STATS: BASE_STATS, INTELLIGENCE_GOAL: INTELLIGENCE_GOAL,
    START_POPULATION: START_POPULATION, START_EP: START_EP,
    SPECIATION_COST: SPECIATION_COST, MIN_SPECIATION_POP: MIN_SPECIATION_POP,
    NICHES: NICHES, CATEGORIES: CATEGORIES, TRAITS: TRAITS,
    ERAS: ERAS, KNOWLEDGE: KNOWLEDGE
  };
});
