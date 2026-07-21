/*
 * data.js — dane gry (konfiguracja).
 *
 * ZALOZENIA.md sekcja 9: cechy, ery, karty wiedzy jako dane oddzielone od
 * logiki i UI. Plik jest zarazem jednostką tłumaczenia treści (i18n dla UI:
 * js/i18n.js). Działa w przeglądarce (GameData) i w Node (module.exports).
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

  var START_POPULATION = 120;

  var SPECIATION_COST = 12;
  var MIN_SPECIATION_POP = 60;

  // Poziomy trudności (ZALOZENIA — dopasowanie wyzwania).
  var DIFFICULTIES = {
    latwy:    { label: 'Łatwy',    startEp: 50, goal: 12, catMult: 0.6, predMult: 0.8, coevo: 0.5 },
    normalny: { label: 'Normalny', startEp: 35, goal: 14, catMult: 1.0, predMult: 1.0, coevo: 1.0 },
    trudny:   { label: 'Trudny',   startEp: 30, goal: 15, catMult: 1.2, predMult: 1.1, coevo: 1.2 }
  };

  /*
   * Nisze ekologiczne z modyfikatorami względem wartości bazowych (woda) danej
   * tury. `requires` — cecha potrzebna, by zająć niszę. `land:true` — używa
   * jawnych wartości turn.land.
   */
  var NICHES = {
    woda:       { label: 'Woda',       icon: '🌊', requires: null,    foodMult: 1.0, predMult: 1.0, epBonus: 0 },
    przybrzeze: { label: 'Przybrzeże', icon: '🪸', requires: null,    foodMult: 1.2, predMult: 1.25, epBonus: 1 },
    lad:        { label: 'Ląd',        icon: '🏝️', requires: 'limbs', land: true,                    epBonus: 3 },
    powietrze:  { label: 'Powietrze',  icon: '🕊️', requires: 'flight', foodMult: 0.7, predMult: 0.3,  epBonus: 2 }
  };

  var CATEGORIES = {
    pokarm: 'Pokarm', lokomocja: 'Lokomocja', obrona: 'Obrona', zmysly: 'Zmysły',
    rozrod: 'Rozród', termoregulacja: 'Termoregulacja', uklad_nerwowy: 'Układ nerwowy'
  };
  var CATEGORY_ICONS = {
    pokarm: '🍽️', lokomocja: '🦿', obrona: '🛡️', zmysly: '👁️',
    rozrod: '🥚', termoregulacja: '🌡️', uklad_nerwowy: '🧠'
  };

  var TRAITS = [
    // --- Pokarm ---
    { id: 'filter_feeding', name: 'Filtrowanie pokarmu', icon: '💧', category: 'pokarm', cost: 10, requires: [],
      effects: { feeding: 2 }, tradeoff: 'Skuteczne tylko przy dużej ilości planktonu.',
      desc: 'Odcedzanie drobnych cząstek pokarmu z wody — tania strategia odżywiania.' },
    { id: 'jaws', name: 'Szczęki', icon: '🦷', category: 'pokarm', cost: 16, requires: [],
      effects: { feeding: 3, metabolism: 1 }, tradeoff: 'Więcej pokarmu, ale wyższy metabolizm.',
      desc: 'Ruchome szczęki otwierają dostęp do większej i twardszej zdobyczy.' },
    { id: 'omnivory', name: 'Wszystkożerność', icon: '🍖', category: 'pokarm', cost: 22, requires: ['jaws'],
      effects: { feeding: 2, defense: 1, metabolism: 1 }, tradeoff: 'Elastyczna dieta kosztuje energię.',
      desc: 'Jedzenie i roślin, i zwierząt uniezależnia od jednego źródła pokarmu.' },

    // --- Lokomocja ---
    { id: 'fins', name: 'Płetwy', icon: '🐟', category: 'lokomocja', cost: 10, requires: [],
      effects: { mobility: 2 }, tradeoff: 'Sprawne w wodzie, bezużyteczne na lądzie.',
      desc: 'Płetwy poprawiają manewrowość i ucieczkę przed drapieżnikami.' },
    { id: 'fast_muscle', name: 'Szybkie mięśnie', icon: '⚡', category: 'lokomocja', cost: 15, requires: ['fins'],
      effects: { mobility: 2, defense: 1, metabolism: 2 }, tradeoff: 'Zrywy prędkości są energochłonne.',
      desc: 'Włókna szybkokurczliwe pozwalają na gwałtowne uniki i pościgi.' },
    { id: 'limbs', name: 'Kończyny', icon: '🦎', category: 'lokomocja', cost: 22, requires: ['fins'],
      effects: { mobility: 3, metabolism: 1 }, tradeoff: 'Otwiera niszę lądową, ale wymaga przebudowy szkieletu.',
      desc: 'Przekształcenie płetw w kończyny umożliwia migrację na ląd.' },
    { id: 'flight', name: 'Lot', icon: '🦅', category: 'lokomocja', cost: 26, requires: ['limbs'], minEra: 1,
      effects: { mobility: 3, metabolism: 2 }, tradeoff: 'Otwiera niszę powietrzną, ale to ogromny koszt energii.',
      desc: 'Skrzydła pozwalają zająć bezpieczną, choć uboższą niszę powietrzną.' },
    { id: 'grasping_hand', name: 'Ręka chwytna', icon: '✋', category: 'lokomocja', cost: 20, requires: ['limbs'], minEra: 2,
      effects: { feeding: 1, intelligence: 1 }, tradeoff: 'Precyzyjny chwyt wymaga rozwiniętej koordynacji.',
      desc: 'Chwytna dłoń pozwala manipulować przedmiotami — podstawa używania narzędzi.' },

    // --- Obrona ---
    { id: 'scales', name: 'Łuski', icon: '🐍', category: 'obrona', cost: 10, requires: [],
      effects: { defense: 2 }, tradeoff: 'Lekka ochrona, ogranicza wymianę gazową przez skórę.',
      desc: 'Zrogowaciała skóra chroni przed urazami i wysychaniem.' },
    { id: 'shell', name: 'Pancerz', icon: '🐢', category: 'obrona', cost: 16, requires: [],
      effects: { defense: 4, mobility: -1, metabolism: 2 }, tradeoff: 'Świetna obrona kosztem ruchu i energii.',
      desc: 'Twardy pancerz zniechęca większość drapieżników.' },
    { id: 'camouflage', name: 'Kamuflaż', icon: '🦎', category: 'obrona', cost: 14, requires: ['eyes'],
      effects: { defense: 3 }, tradeoff: 'Zawodzi, gdy trzeba się aktywnie poruszać.',
      desc: 'Ubarwienie zlewające się z otoczeniem to obrona bez kosztu ruchu.' },

    // --- Zmysły ---
    { id: 'eyes', name: 'Oczy', icon: '👁️', category: 'zmysly', cost: 12, requires: [],
      effects: { feeding: 1, defense: 1 }, tradeoff: 'Rozwój narządu wymaga stabilnego pokarmu.',
      desc: 'Wzrok ułatwia zdobywanie pokarmu i wczesne wykrycie zagrożeń.' },
    { id: 'lateral_line', name: 'Linia boczna', icon: '〰️', category: 'zmysly', cost: 10, requires: [],
      effects: { defense: 1, mobility: 1 }, tradeoff: 'Działa wyłącznie w środowisku wodnym.',
      desc: 'Narząd czuciowy wykrywa drgania wody — ostrzega przed drapieżnikiem.' },

    // --- Rozród ---
    { id: 'many_eggs', name: 'Liczne jaja', icon: '🥚', category: 'rozrod', cost: 12, requires: [],
      effects: { reproduction: 3 }, tradeoff: 'Ilość zamiast jakości — duża śmiertelność potomstwa.',
      desc: 'Składanie wielu jaj zwiększa szansę, że część przetrwa.' },
    { id: 'amniotic_egg', name: 'Jajo lądowe', icon: '🐣', category: 'rozrod', cost: 20, requires: ['scales'],
      effects: { reproduction: 2, defense: 1 }, tradeoff: 'Uniezależnia rozród od wody, ale kosztowne.',
      desc: 'Jajo z błonami i skorupą można składać na lądzie.' },
    { id: 'parental_care', name: 'Opieka nad potomstwem', icon: '🐧', category: 'rozrod', cost: 24, requires: ['many_eggs'],
      effects: { reproduction: 2, intelligence: 1, metabolism: 1 }, tradeoff: 'Mniej potomstwa, lepiej chronionego.',
      desc: 'Ochrona młodych podnosi ich przeżywalność i sprzyja uczeniu się.' },

    // --- Termoregulacja ---
    { id: 'endothermy', name: 'Stałocieplność', icon: '🔥', category: 'termoregulacja', cost: 22, requires: ['scales'],
      effects: { feeding: 1, defense: 1, metabolism: 3 }, tradeoff: 'Aktywność niezależna od pogody, ale ogromny koszt energii.',
      desc: 'Utrzymywanie stałej temperatury ciała pozwala działać w chłodzie.' },
    { id: 'insulation', name: 'Izolacja (pióra/futro)', icon: '🪶', category: 'termoregulacja', cost: 18, requires: ['endothermy'], minEra: 1,
      effects: { defense: 1, metabolism: -1 }, tradeoff: 'Zmniejsza koszt stałocieplności, ale to kolejna inwestycja.',
      desc: 'Warstwa izolująca ogranicza utratę ciepła — obniża koszt metabolizmu.' },

    // --- Układ nerwowy (droga do inteligencji) ---
    { id: 'ganglia', name: 'Zwoje nerwowe', icon: '🕸️', category: 'uklad_nerwowy', cost: 15, requires: [], path: 'intelligence',
      effects: { intelligence: 2, defense: 1 }, tradeoff: 'Szybsze reakcje, lekko wyższy metabolizm.',
      desc: 'Skupiska komórek nerwowych przyspieszają przetwarzanie bodźców.' },
    { id: 'brain', name: 'Mózg', icon: '🧠', category: 'uklad_nerwowy', cost: 22, requires: ['ganglia'], path: 'intelligence',
      effects: { intelligence: 3, feeding: 1, metabolism: 2 }, tradeoff: 'Mózg jest kosztowny — wymaga dobrego odżywiania.',
      desc: 'Scentralizowany mózg umożliwia złożone zachowania.' },
    { id: 'pack_hunting', name: 'Polowanie w grupie', icon: '🐺', category: 'uklad_nerwowy', cost: 20, requires: ['brain'], minEra: 1,
      effects: { feeding: 2, defense: 1, metabolism: 1 }, tradeoff: 'Skuteczne łowy wymagają koordynacji grupy.',
      desc: 'Współdziałanie w grupie zwiększa skuteczność zdobywania pokarmu i obronę.' },
    { id: 'big_brain', name: 'Rozbudowany mózg', icon: '💡', category: 'uklad_nerwowy', cost: 30, requires: ['brain', 'endothermy'], path: 'intelligence',
      effects: { intelligence: 4, metabolism: 3 }, tradeoff: 'Bardzo energochłonny — potrzebuje stabilnej energii.',
      desc: 'Powiększona kora pozwala na uczenie się i planowanie.' },
    { id: 'social', name: 'Zachowania społeczne', icon: '👥', category: 'uklad_nerwowy', cost: 26, requires: ['brain'], path: 'intelligence', minEra: 1,
      effects: { intelligence: 2, defense: 1, metabolism: 1 }, tradeoff: 'Życie w grupie wymaga komunikacji i koordynacji.',
      desc: 'Współpraca i uczenie się od innych przyspieszają rozwój poznawczy.' },
    { id: 'tool_use', name: 'Używanie narzędzi', icon: '🪓', category: 'uklad_nerwowy', cost: 34, requires: ['big_brain', 'social', 'grasping_hand'], path: 'intelligence', minEra: 2,
      effects: { intelligence: 3, feeding: 2, metabolism: 1 }, tradeoff: 'Kulminacja: wymaga mózgu, życia społecznego i ręki chwytnej.',
      desc: 'Wytwarzanie i używanie narzędzi to próg kultury i technologii.' }
  ];

  function land(food, predators) { return { food: food, predators: predators }; }

  var ERAS = [
    {
      id: 'paleozoik', name: 'Paleozoik', dates: '541–252 mln lat temu',
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
      id: 'mezozoik', name: 'Mezozoik', dates: '252–66 mln lat temu',
      intro: 'Era gadów. Ląd należy do dinozaurów, a klimat jest ciepły. Twoje linie mogą wejść ' +
        'w cień wielkich drapieżników, wzbić się w powietrze — albo dorównać im sprytem.',
      milestone: 'Kamienie milowe: jajo lądowe, stałocieplność, izolacja (pióra/futro), lot, życie społeczne.',
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
      id: 'kenozoik', name: 'Kenozoik', dates: '66 mln lat temu – dziś',
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
          note: 'Zlodowacenia to twarda szkoła — przetrwają najbardziej elastyczni.',
          catastrophe: { name: 'Zlodowacenie plejstoceńskie', niche: 'lad', severity: 0.3, knowledge: 'extinction' } },
        { title: 'Współczesność — próg rozumności', oxygen: 11, food: 10, predators: 6, climate: 'umiarkowanie', land: land(11, 6),
          note: 'Ostatnia tura: czy Twoja linia przekroczy próg inteligencji?' }
      ]
    }
  ];

  // Pozytywne zdarzenia losowe (ZALOZENIA 4.3 — nie tylko katastrofy).
  var POSITIVE_EVENTS = [
    { id: 'bloom', name: 'Rozkwit pokarmu', foodBonus: 3, knowledge: 'events', desc: 'Zakwit roślinności/planktonu — więcej pokarmu w tej turze.' },
    { id: 'mild', name: 'Łagodny sezon', predBonus: -2, knowledge: 'events', desc: 'Spokojny sezon — mniejsza presja drapieżników.' }
  ];

  // Scenariusze lekcyjne (ZALOZENIA sekcja 8/6).
  var SCENARIOS = [
    { id: 'full', name: 'Pełna ewolucja', icon: '🧬', difficulty: 'normalny', startEra: 0,
      intro: 'Klasyczna gra od prostego życia w morzu aż do gatunku rozumnego, przez trzy ery.' },
    { id: 'land', name: 'Podbój lądu', icon: '🏝️', difficulty: 'latwy', startEra: 0,
      intro: 'Łagodniejsze wyzwanie ze szczególnym naciskiem na wyjście na ląd i rozwój na nim.' },
    { id: 'ice', name: 'Epoki lodowcowe', icon: '❄️', difficulty: 'trudny', startEra: 2,
      startEp: 60, goal: 14, startTraits: ['fins', 'scales', 'endothermy', 'insulation', 'ganglia', 'limbs'],
      intro: 'Start w kenozoiku jako zaawansowany, stałocieplny gatunek. Chłodny świat i tylko sześć tur, ' +
        'by z rozwiniętego mózgu wykuć rozumność. Twardy sprint końcowy.' }
  ];

  var KNOWLEDGE = {
    intro: { icon: '🧬', title: 'Czym jest dobór naturalny?',
      body: 'Osobniki różnią się cechami. Te lepiej przystosowane częściej przeżywają i zostawiają ' +
        'potomstwo, przekazując mu swoje cechy. Po wielu pokoleniach populacja się zmienia.' },
    mutation_good: { icon: '🧪', title: 'Mutacje — źródło zmienności',
      body: 'Mutacja to losowa zmiana materiału genetycznego. Większość jest neutralna lub szkodliwa, ' +
        'ale czasem daje przewagę, którą dobór naturalny „premiuje”.' },
    mutation_bad: { icon: '⚠️', title: 'Nie każda zmiana pomaga',
      body: 'Ta mutacja pogorszyła cechę. W naturze osobniki z niekorzystnymi mutacjami częściej giną — ' +
        'dlatego szkodliwe warianty są z czasem „odsiewane”.' },
    predation: { icon: '🦈', title: 'Presja drapieżników',
      body: 'Gdy obrona gatunku jest za słaba, populacja topnieje. Pancerz, kamuflaż czy prędkość to ' +
        'odpowiedzi ewolucji na drapieżnictwo.',
      fossil: 'W kambrze polował Anomalocaris — jeden z pierwszych wielkich drapieżników.' },
    coevolution: { icon: '🏹', title: 'Koewolucja i wyścig zbrojeń',
      body: 'Drapieżniki też ewoluują. Im lepiej broni się ofiara, tym silniejsi stają się łowcy — to ' +
        '„wyścig zbrojeń”, w którym obie strony napędzają swoje adaptacje.' },
    starvation: { icon: '🍂', title: 'Bilans energetyczny',
      body: 'Metabolizm to koszt utrzymania organizmu. Jeśli zdobyty pokarm go nie pokrywa, populacja ' +
        'głoduje. Sprawniejsze cechy bywają kosztowne — to kompromis.' },
    cold: { icon: '❄️', title: 'Klimat jako presja',
      body: 'Ochłodzenie ogranicza pokarm i aktywność zwierząt zmiennocieplnych. Stałocieplność pozwala ' +
        'działać w chłodzie, ale wymaga znacznie więcej energii.' },
    land: { icon: '🦶', title: 'Podbój lądu',
      body: 'Wyjście na ląd wymagało kończyn, oddychania powietrzem i rozrodu niezależnego od wody.',
      fossil: 'Tiktaalik (dewon) łączy cechy ryb i płazów — ilustruje przejście na ląd.' },
    niche: { icon: '🗺️', title: 'Nisza ekologiczna',
      body: 'Nisza to zespół warunków i zasobów, w których gatunek żyje. Różne nisze (woda, przybrzeże, ' +
        'ląd, powietrze) mają inne pokarmy i zagrożenia — rozdzielenie linii między nisze rozkłada ryzyko.' },
    events: { icon: '🍀', title: 'Zmienność środowiska',
      body: 'Środowisko bywa też łaskawe: zakwity pokarmu czy spokojne sezony dają chwilową przewagę. ' +
        'Ewolucja to gra z ciągle zmieniającymi się warunkami — nie tylko z katastrofami.' },
    intelligence: { icon: '🧠', title: 'Ewolucja inteligencji',
      body: 'Duży mózg daje przewagę (uczenie się, współpraca), ale zużywa mnóstwo energii. Rozwija się ' +
        'tam, gdzie ta przewaga się opłaca.' },
    speciation: { icon: '🌿', title: 'Specjacja — powstawanie gatunków',
      body: 'Gdy część populacji przystosuje się do odrębnej niszy i przestaje wymieniać geny z resztą, ' +
        'powstaje nowy gatunek. Tak linie rozgałęziają się w „drzewo życia”.',
      fossil: 'Zięby Darwina z Galapagos to klasyczny przykład szybkiej specjacji w różnych niszach.' },
    extinction: { icon: '☄️', title: 'Wymieranie masowe',
      body: 'To gwałtowny zanik wielu gatunków w krótkim (geologicznie) czasie. Uderza najmocniej w linie ' +
        'niedostosowane do nowych warunków — dywersyfikacja (wiele linii w różnych niszach) zwiększa ' +
        'szansę, że któraś przetrwa.',
      fossil: 'Wymieranie permskie (~252 mln lat temu) zgładziło ok. 90% gatunków morskich.' },
    milestone: { icon: '🏛️', title: 'Kamienie milowe ewolucji',
      body: 'Każda era premiuje inne adaptacje: szkielet i kończyny w paleozoiku, jaja lądowe i ' +
        'stałocieplność w mezozoiku, mózg i narzędzia w kenozoiku.' }
  };

  return {
    BASE_STATS: BASE_STATS, START_POPULATION: START_POPULATION,
    SPECIATION_COST: SPECIATION_COST, MIN_SPECIATION_POP: MIN_SPECIATION_POP,
    DIFFICULTIES: DIFFICULTIES, NICHES: NICHES, CATEGORIES: CATEGORIES, CATEGORY_ICONS: CATEGORY_ICONS,
    TRAITS: TRAITS, ERAS: ERAS, POSITIVE_EVENTS: POSITIVE_EVENTS, SCENARIOS: SCENARIOS, KNOWLEDGE: KNOWLEDGE,
    // Zgodność wsteczna:
    INTELLIGENCE_GOAL: DIFFICULTIES.normalny.goal, START_EP: DIFFICULTIES.normalny.startEp
  };
});
