/*
 * data.js — dane gry (konfiguracja).
 *
 * ZALOZENIA.md sekcja 9: cechy, ery, karty wiedzy jako dane oddzielone od
 * logiki i UI. Plik jest zarazem jednostką tłumaczenia treści (i18n dla UI:
 * js/i18n.js). Działa w przeglądarce (GameData) i w Node (module.exports).
 *
 * Model rozgrywki 2.0 opisuje GAMEPLAY.md: cechy pojawiają się jako losowe
 * mutacje, a ich częstość w populacji zmienia dobór naturalny.
 */
(function (root, factory) {
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.GameData = data;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASE_STATS = {
    feeding: 5, defense: 3, reproduction: 5, mobility: 3, metabolism: 4, intelligence: 1
  };

  var START_POPULATION = 120;
  var MIN_VIABLE_POP = 15; // poniżej — linia wymiera (minimalna populacja żywotna)

  // Parametry genetyki populacyjnej (GAMEPLAY.md sekcja 4).
  var GENETICS = {
    newMutationFreq: 0.3,   // częstość startowa wybranej mutacji
    lossMutationFreq: 0.7,  // częstość utrwalonej cechy po mutacji „utraty”
    selectionGain: 2.6,     // k w f' = f + k·s·f·(1−f)
    selectionScale: 7,      // s = (Δr + w·Δln K) · skala
    capacityWeight: 0.3,
    maxS: 0.8,
    fixAt: 0.95, loseAt: 0.05,
    establishedAt: 0.5,     // od tej częstości cecha odblokowuje cechy zależne
    nicheAccessAt: 0.25,    // od tej częstości cecha pozwala wejść do niszy (formy przejściowe)
    draftSize: 3
  };

  // Koszty w punktach zmienności genetycznej (ZG).
  var COSTS = { extraPick: 6, reroll: 3, migrate: 4, speciate: 10 };
  var MIN_SPECIATION_POP = 60;

  // Poziomy trudności.
  var DIFFICULTIES = {
    latwy:    { label: 'Łatwy',    startZg: 14, zgBonus: 2, goal: 11, catMult: 0.7, predMult: 1.0, coevo: 0.8, rivalMult: 1.0, scoreMult: 0.8 },
    normalny: { label: 'Normalny', startZg: 8,  zgBonus: 0, goal: 14, catMult: 1.0, predMult: 1.0, coevo: 1.0, rivalMult: 1.0, scoreMult: 1.0 },
    trudny:   { label: 'Trudny',   startZg: 6,  zgBonus: 0, goal: 15, catMult: 1.25, predMult: 1.1, coevo: 1.2, rivalMult: 1.15, scoreMult: 1.4 }
  };

  /*
   * Nisze ekologiczne z modyfikatorami względem wartości bazowych (woda) danej
   * tury. `requires` — cecha (min. częstość „ugruntowana”), by zająć niszę.
   * `land:true` — używa jawnych wartości turn.land.
   */
  var NICHES = {
    woda:       { label: 'Woda',       icon: '🌊', requires: null,     foodMult: 1.0, predMult: 1.0 },
    przybrzeze: { label: 'Przybrzeże', icon: '🪸', requires: null,     foodMult: 0.85, predMult: 0.8 },
    lad:        { label: 'Ląd',        icon: '🏝️', requires: 'limbs',  land: true },
    powietrze:  { label: 'Powietrze',  icon: '🕊️', requires: 'flight', foodMult: 0.75, predMult: 0.35 }
  };

  // Etykiety warunków używanych w warunkowych efektach cech.
  var CONDITIONS = {
    woda: '🌊 w wodzie', przybrzeze: '🪸 przy brzegu', lad: '🏝️ na lądzie', powietrze: '🕊️ w powietrzu',
    zimno: '❄️ w zimnie', cieplo: '☀️ w cieple', niskiO2: '🫧 przy niskim tlenie'
  };

  var CATASTROPHE_KINDS = {
    zimno: 'zlodowacenie', anoksja: 'beztlenowość / zakwaszenie', impakt: 'uderzenie i zima uderzeniowa'
  };

  var CATEGORIES = {
    pokarm: 'Pokarm', lokomocja: 'Lokomocja', obrona: 'Obrona', zmysly: 'Zmysły',
    rozrod: 'Rozród', termoregulacja: 'Termoregulacja', uklad_nerwowy: 'Układ nerwowy'
  };
  var CATEGORY_ICONS = {
    pokarm: '🍽️', lokomocja: '🦿', obrona: '🛡️', zmysly: '👁️',
    rozrod: '🥚', termoregulacja: '🌡️', uklad_nerwowy: '🧠'
  };

  /*
   * Cechy. effects — zawsze; cond — tylko w danych warunkach; resist — odporność
   * na rodzaj katastrofy (ujemna = podatność); excludes — cechy wykluczające się.
   * weight — względna szansa pojawienia się w drafcie.
   */
  var TRAITS = [
    // --- Pokarm ---
    { id: 'filter_feeding', name: 'Filtrowanie pokarmu', icon: '💧', category: 'pokarm', requires: [],
      effects: { feeding: 2 }, cond: { woda: { feeding: 1 }, lad: { feeding: -3 }, powietrze: { feeding: -3 } },
      tradeoff: 'Świetne w planktonowym morzu, bezużyteczne poza wodą.',
      desc: 'Odcedzanie drobnych cząstek pokarmu z wody — tania strategia odżywiania.' },
    { id: 'jaws', name: 'Szczęki', icon: '🦷', category: 'pokarm', requires: [],
      effects: { feeding: 3, metabolism: 1 },
      tradeoff: 'Więcej pokarmu, ale wyższy metabolizm.',
      desc: 'Ruchome szczęki otwierają dostęp do większej i twardszej zdobyczy.' },
    { id: 'omnivory', name: 'Wszystkożerność', icon: '🍖', category: 'pokarm', requires: ['jaws'],
      effects: { feeding: 2, metabolism: 1 }, resist: { impakt: 0.15, zimno: 0.1 },
      tradeoff: 'Elastyczna dieta kosztuje energię, ale ratuje w kryzysie.',
      desc: 'Jedzenie i roślin, i zwierząt uniezależnia od jednego źródła pokarmu.' },

    // --- Lokomocja ---
    { id: 'fins', name: 'Płetwy', icon: '🐟', category: 'lokomocja', requires: [],
      effects: { mobility: 2 }, cond: { lad: { mobility: -3, metabolism: 1 } },
      tradeoff: 'Sprawne w wodzie, przeszkadzają na lądzie.',
      desc: 'Płetwy poprawiają manewrowość i ucieczkę przed drapieżnikami.' },
    { id: 'fast_muscle', name: 'Szybkie mięśnie', icon: '⚡', category: 'lokomocja', requires: ['fins'],
      effects: { mobility: 2, defense: 1, metabolism: 2 },
      tradeoff: 'Zrywy prędkości są energochłonne.',
      desc: 'Włókna szybkokurczliwe pozwalają na gwałtowne uniki i pościgi.' },
    { id: 'lungs', name: 'Płuca', icon: '🫁', category: 'lokomocja', requires: [],
      effects: {}, cond: { niskiO2: { metabolism: -2 }, przybrzeze: { feeding: 1 }, lad: { feeding: 1, metabolism: -1 } },
      resist: { anoksja: 0.3 },
      tradeoff: 'Nic nie daje w natlenionej wodzie; ratuje przy niedoborze tlenu.',
      desc: 'Oddychanie powietrzem atmosferycznym (jak u ryb dwudysznych) — przepustka na ląd.' },
    { id: 'limbs', name: 'Kończyny', icon: '🦎', category: 'lokomocja', requires: ['fins'],
      effects: { mobility: 1, metabolism: 1 }, cond: { lad: { mobility: 3, feeding: 2 }, przybrzeze: { mobility: 1, feeding: 1 }, woda: { mobility: -1 } },
      tradeoff: 'Otwiera niszę lądową; przydatne na płyciznach, w otwartej wodzie niezgrabne.',
      desc: 'Przekształcenie płetw w kończyny umożliwia migrację na ląd.' },
    { id: 'flight', name: 'Lot', icon: '🦅', category: 'lokomocja', requires: ['limbs'], minEra: 1,
      effects: { mobility: 3, metabolism: 2 }, cond: { powietrze: { defense: 2 } },
      tradeoff: 'Otwiera niszę powietrzną, ale to ogromny koszt energii.',
      desc: 'Skrzydła pozwalają zająć bezpieczną, choć uboższą niszę powietrzną.' },
    { id: 'grasping_hand', name: 'Ręka chwytna', icon: '✋', category: 'lokomocja', requires: ['limbs'], minEra: 2, path: 'intelligence',
      effects: { feeding: 1, intelligence: 1 },
      tradeoff: 'Precyzyjny chwyt wymaga rozwiniętej koordynacji.',
      desc: 'Chwytna dłoń pozwala manipulować przedmiotami — podstawa używania narzędzi.' },
    { id: 'burrowing', name: 'Życie w norach', icon: '🕳️', category: 'lokomocja', requires: ['limbs'],
      effects: { defense: 1, mobility: -1 }, cond: { zimno: { metabolism: -1 } }, resist: { impakt: 0.35, zimno: 0.25 },
      tradeoff: 'Mniej ruchliwości, za to schronienie przed kataklizmem.',
      desc: 'Kopanie nor chroni przed chłodem, suszą i skutkami katastrof.' },

    // --- Obrona ---
    { id: 'scales', name: 'Łuski', icon: '🐍', category: 'obrona', requires: [],
      effects: { defense: 2 }, cond: { lad: { defense: 1 } },
      tradeoff: 'Lekka ochrona; na lądzie dodatkowo chronią przed wysychaniem.',
      desc: 'Zrogowaciała skóra chroni przed urazami i wysychaniem.' },
    { id: 'shell', name: 'Pancerz', icon: '🐢', category: 'obrona', requires: [],
      effects: { defense: 4, mobility: -1, metabolism: 2 }, cond: { lad: { mobility: -1 }, powietrze: { mobility: -3 } },
      tradeoff: 'Świetna obrona kosztem ruchu i energii.',
      desc: 'Twardy pancerz zniechęca większość drapieżników.' },
    { id: 'camouflage', name: 'Kamuflaż', icon: '🍃', category: 'obrona', requires: ['eyes'],
      effects: { defense: 3 }, cond: { powietrze: { defense: -2 } },
      tradeoff: 'Zawodzi na otwartym niebie.',
      desc: 'Ubarwienie zlewające się z otoczeniem to obrona bez kosztu ruchu.' },
    { id: 'toxins', name: 'Toksyny', icon: '☠️', category: 'obrona', requires: [],
      effects: { defense: 3, metabolism: 1, reproduction: -1 },
      tradeoff: 'Produkcja jadu kosztuje energię i spowalnia rozród.',
      desc: 'Trujące tkanki lub jad sprawiają, że drapieżniki uczą się omijać gatunek.' },
    { id: 'large_size', name: 'Gigantyzm', icon: '🦕', category: 'obrona', requires: [], excludes: ['small_size'],
      effects: { defense: 3, feeding: 1, metabolism: 2, reproduction: -1 }, cond: { zimno: { metabolism: -1 } },
      resist: { impakt: -0.25, anoksja: -0.1 },
      tradeoff: 'Duże zwierzęta są bezpieczne, ale giną jako pierwsze w katastrofach.',
      desc: 'Wielkie ciało odstrasza drapieżniki i lepiej trzyma ciepło.' },
    { id: 'small_size', name: 'Miniaturyzacja', icon: '🐭', category: 'obrona', requires: [], excludes: ['large_size'],
      effects: { metabolism: -2, reproduction: 1, defense: -1 }, resist: { impakt: 0.3, anoksja: 0.15 },
      tradeoff: 'Łatwy łup, ale mało potrzebuje i przetrwa kryzys.',
      desc: 'Małe ciało to mniejsze potrzeby pokarmowe i szybsze pokolenia.' },

    // --- Zmysły ---
    { id: 'eyes', name: 'Oczy', icon: '👁️', category: 'zmysly', requires: [],
      effects: { feeding: 1, defense: 1 },
      tradeoff: 'Wzrok wymaga energii na utrzymanie narządu.',
      desc: 'Wzrok ułatwia zdobywanie pokarmu i wczesne wykrycie zagrożeń.' },
    { id: 'lateral_line', name: 'Linia boczna', icon: '〰️', category: 'zmysly', requires: [],
      effects: { defense: 1, mobility: 1 }, cond: { lad: { defense: -1, mobility: -1 }, powietrze: { defense: -1, mobility: -1 } },
      tradeoff: 'Działa wyłącznie w środowisku wodnym.',
      desc: 'Narząd czuciowy wykrywa drgania wody — ostrzega przed drapieżnikiem.' },

    // --- Rozród ---
    { id: 'many_eggs', name: 'Liczne jaja', icon: '🥚', category: 'rozrod', requires: [],
      effects: { reproduction: 3 },
      tradeoff: 'Ilość zamiast jakości — duża śmiertelność potomstwa.',
      desc: 'Składanie wielu jaj zwiększa szansę, że część przetrwa.' },
    { id: 'amniotic_egg', name: 'Jajo lądowe', icon: '🐣', category: 'rozrod', requires: ['scales'],
      effects: { reproduction: 1, defense: 1 }, cond: { lad: { reproduction: 2 }, powietrze: { reproduction: 1 } },
      tradeoff: 'Uniezależnia rozród od wody; w wodzie mało daje.',
      desc: 'Jajo z błonami i skorupą można składać na lądzie.' },
    { id: 'parental_care', name: 'Opieka nad potomstwem', icon: '🐧', category: 'rozrod', requires: ['many_eggs'], path: 'intelligence',
      effects: { reproduction: 1, intelligence: 1, metabolism: 1 }, resist: { zimno: 0.1 },
      tradeoff: 'Mniej potomstwa, lepiej chronionego.',
      desc: 'Ochrona młodych podnosi ich przeżywalność i sprzyja uczeniu się.' },

    // --- Termoregulacja ---
    { id: 'endothermy', name: 'Stałocieplność', icon: '🔥', category: 'termoregulacja', requires: ['scales'],
      effects: { feeding: 2, mobility: 1, defense: 1, metabolism: 3 }, coldShield: 1, resist: { zimno: 0.25 },
      tradeoff: 'Aktywność niezależna od pogody, ale ogromny koszt energii.',
      desc: 'Utrzymywanie stałej temperatury ciała pozwala działać w chłodzie.' },
    { id: 'insulation', name: 'Izolacja (pióra/futro)', icon: '🪶', category: 'termoregulacja', requires: ['endothermy'], minEra: 1,
      effects: { defense: 1, metabolism: -1 }, cond: { zimno: { metabolism: -2 }, cieplo: { metabolism: 1 } }, resist: { zimno: 0.3 },
      tradeoff: 'Oszczędza energię w chłodzie, w upale grozi przegrzaniem.',
      desc: 'Warstwa izolująca ogranicza utratę ciepła — obniża koszt metabolizmu.' },

    // --- Układ nerwowy (droga do inteligencji) ---
    { id: 'ganglia', name: 'Zwoje nerwowe', icon: '🕸️', category: 'uklad_nerwowy', requires: [], path: 'intelligence',
      effects: { intelligence: 2, defense: 1 },
      tradeoff: 'Szybsze reakcje, niewielki koszt.',
      desc: 'Skupiska komórek nerwowych przyspieszają przetwarzanie bodźców.' },
    { id: 'brain', name: 'Mózg', icon: '🧠', category: 'uklad_nerwowy', requires: ['ganglia'], path: 'intelligence',
      effects: { intelligence: 3, feeding: 1, metabolism: 2 },
      tradeoff: 'Mózg jest kosztowny — opłaca się tylko przy dobrym odżywianiu.',
      desc: 'Scentralizowany mózg umożliwia złożone zachowania.' },
    { id: 'pack_hunting', name: 'Polowanie w grupie', icon: '🐺', category: 'uklad_nerwowy', requires: ['brain'], minEra: 1,
      effects: { feeding: 2, defense: 1, metabolism: 1 },
      tradeoff: 'Skuteczne łowy wymagają koordynacji grupy.',
      desc: 'Współdziałanie w grupie zwiększa skuteczność zdobywania pokarmu i obronę.' },
    { id: 'big_brain', name: 'Rozbudowany mózg', icon: '💡', category: 'uklad_nerwowy', requires: ['brain', 'endothermy'], path: 'intelligence',
      effects: { intelligence: 4, metabolism: 3 },
      tradeoff: 'Bardzo energochłonny — potrzebuje stabilnej energii.',
      desc: 'Powiększona kora pozwala na uczenie się i planowanie.' },
    { id: 'social', name: 'Zachowania społeczne', icon: '👥', category: 'uklad_nerwowy', requires: ['brain'], path: 'intelligence', minEra: 1,
      effects: { intelligence: 2, defense: 1, metabolism: 1 },
      tradeoff: 'Życie w grupie wymaga komunikacji i koordynacji.',
      desc: 'Współpraca i uczenie się od innych przyspieszają rozwój poznawczy.' },
    { id: 'language', name: 'Komunikacja głosowa', icon: '🗣️', category: 'uklad_nerwowy', requires: ['social', 'big_brain'], path: 'intelligence', minEra: 2,
      effects: { intelligence: 3, defense: 1, metabolism: 1 },
      tradeoff: 'Złożone sygnały wymagają dużego mózgu i życia w grupie.',
      desc: 'Przekazywanie informacji głosem pozwala uczyć się od innych bez własnych błędów.' },
    { id: 'tool_use', name: 'Używanie narzędzi', icon: '🪓', category: 'uklad_nerwowy', requires: ['big_brain', 'grasping_hand'], path: 'intelligence', minEra: 2,
      effects: { intelligence: 3, feeding: 2, metabolism: 1 },
      tradeoff: 'Kulminacja: wymaga dużego mózgu i ręki chwytnej.',
      desc: 'Wytwarzanie i używanie narzędzi to próg kultury i technologii.' }
  ];

  function land(food, predators) { return { food: food, predators: predators }; }

  /*
   * Ery. Wartości tur to SZABLONY — silnik dodaje losowe odchylenia (ziarno gry)
   * i losuje zdarzenia. rivalBase — siła rodzimych konkurentów w niszach;
   * tura może ją nadpisać polem `rivals`.
   */
  var ERAS = [
    {
      id: 'paleozoik', name: 'Paleozoik', dates: '541–252 mln lat temu',
      intro: 'Twoja linia startuje w ciepłych, płytkich morzach. Przed nią rozkwit drapieżników, ' +
        'wahania tlenu i klimatu, a wreszcie kuszący, pusty ląd.',
      milestone: 'Kamienie milowe: szkielet, płetwy → kończyny, oddychanie powietrzem, wyjście na ląd.',
      rivalBase: { woda: 6, przybrzeze: 4, lad: 1, powietrze: 0 },
      turns: [
        { title: 'Kambr — eksplozja życia', oxygen: 8, food: 12, predators: 4, climate: 'cieplo', land: land(4, 1),
          rivals: { lad: 0 }, note: 'Morza pełne pokarmu, ale pojawiają się pierwsi drapieżcy.' },
        { title: 'Ordowik — rafy i łowcy', oxygen: 9, food: 11, predators: 6, climate: 'cieplo', land: land(5, 1),
          rivals: { lad: 0 }, note: 'Rośnie presja drapieżników — obrona zaczyna się liczyć.' },
        { title: 'Ordowik — zlodowacenie', oxygen: 8, food: 8, predators: 5, climate: 'zimno', land: land(4, 1),
          rivals: { lad: 0 }, note: 'Nagłe ochłodzenie ścina dostępność pokarmu.',
          catastrophe: { name: 'Wymieranie ordowickie', kind: 'zimno', niches: ['woda', 'przybrzeze'], severity: 0.35, knowledge: 'extinction' } },
        { title: 'Sylur — stabilizacja', oxygen: 10, food: 10, predators: 7, climate: 'umiarkowanie', land: land(7, 2),
          note: 'Klimat łagodnieje; pierwsze rośliny i stawonogi wychodzą na ląd.' },
        { title: 'Dewon — wiek ryb', oxygen: 11, food: 9, predators: 10, climate: 'umiarkowanie', land: land(9, 2),
          note: 'Wielkie drapieżne ryby dominują w wodzie — na lądzie spokojniej.' },
        { title: 'Dewon — duszne płycizny', oxygen: 7, food: 9, predators: 8, climate: 'cieplo', land: land(11, 3),
          note: 'W ciepłych, zamulonych płyciznach brakuje tlenu. Kto oddycha powietrzem, ten wygrywa.' },
        { title: 'Karbon — bujne lasy', oxygen: 15, food: 10, predators: 7, climate: 'cieplo', land: land(14, 3),
          note: 'Wysoki tlen i bujna roślinność sprzyjają życiu na lądzie.' },
        { title: 'Perm — Wielkie Wymieranie', oxygen: 7, food: 7, predators: 8, climate: 'cieplo', land: land(9, 4),
          note: 'Wulkanizm syberyjski zakwasza i odtlenia oceany.',
          catastrophe: { name: 'Wymieranie permskie', kind: 'anoksja', niches: ['woda', 'przybrzeze'], severity: 0.65, knowledge: 'extinction' } }
      ]
    },
    {
      id: 'mezozoik', name: 'Mezozoik', dates: '252–66 mln lat temu',
      intro: 'Era gadów. Ląd należy do dinozaurów, a klimat jest ciepły. Twoje linie mogą wejść ' +
        'w cień wielkich drapieżników, wzbić się w powietrze — albo dorównać im sprytem.',
      milestone: 'Kamienie milowe: jajo lądowe, stałocieplność, izolacja (pióra/futro), lot, życie społeczne.',
      rivalBase: { woda: 7, przybrzeze: 5, lad: 9, powietrze: 4 },
      turns: [
        { title: 'Trias — po katastrofie', oxygen: 10, food: 9, predators: 6, climate: 'cieplo', land: land(10, 5),
          rivals: { lad: 3, woda: 3 }, note: 'Świat odradza się po wymieraniu — wiele nisz stoi otworem.' },
        { title: 'Trias — pierwsze dinozaury', oxygen: 11, food: 10, predators: 8, climate: 'cieplo', land: land(11, 8),
          note: 'Na lądzie rosną w siłę nowi, sprawni drapieżcy.' },
        { title: 'Jura — giganty', oxygen: 13, food: 12, predators: 11, climate: 'cieplo', land: land(13, 11),
          note: 'Wielkie dinozaury dominują ląd — przetrwa obrona, prędkość lub spryt.' },
        { title: 'Jura — chłodniejsze noce', oxygen: 12, food: 9, predators: 10, climate: 'umiarkowanie', land: land(10, 10),
          note: 'Stałocieplność i izolacja dają przewagę w chłodniejsze noce.' },
        { title: 'Kreda — kwitnące rośliny', oxygen: 12, food: 13, predators: 10, climate: 'cieplo', land: land(14, 10),
          note: 'Rośliny kwiatowe i owady tworzą nowe źródła pokarmu.' },
        { title: 'Kreda — uderzenie asteroidy', oxygen: 10, food: 6, predators: 8, climate: 'zimno', land: land(6, 8),
          note: 'Asteroida i zima uderzeniowa kończą erę dinozaurów.',
          catastrophe: { name: 'Wymieranie kredowe (K–Pg)', kind: 'impakt', niches: 'all', severity: 0.6, knowledge: 'extinction' } }
      ]
    },
    {
      id: 'kenozoik', name: 'Kenozoik', dates: '66 mln lat temu – dziś',
      intro: 'Era ssaków. Klimat stopniowo się ochładza, a inteligencja i życie społeczne stają ' +
        'się realną przewagą. To tu może narodzić się gatunek rozumny.',
      milestone: 'Kamienie milowe: opieka nad potomstwem, ręka chwytna, duży mózg, komunikacja, narzędzia.',
      rivalBase: { woda: 6, przybrzeze: 5, lad: 7, powietrze: 5 },
      turns: [
        { title: 'Paleogen — świt ssaków', oxygen: 11, food: 12, predators: 6, climate: 'cieplo', land: land(13, 6),
          note: 'Po dinozaurach ssaki zajmują opustoszałe nisze.' },
        { title: 'Paleogen — pierwsze naczelne', oxygen: 11, food: 11, predators: 7, climate: 'umiarkowanie', land: land(12, 7),
          note: 'Życie na drzewach premiuje wzrok, chwyt i większy mózg.' },
        { title: 'Neogen — sawanny', oxygen: 11, food: 9, predators: 8, climate: 'umiarkowanie', land: land(10, 9),
          note: 'Otwarte przestrzenie sprzyjają współpracy i sprytnym łowom.' },
        { title: 'Neogen — ochłodzenie', oxygen: 10, food: 8, predators: 8, climate: 'zimno', land: land(9, 8),
          note: 'Chłód premiuje izolację, zapasy i inteligencję.' },
        { title: 'Plejstocen — epoki lodowcowe', oxygen: 10, food: 8, predators: 8, climate: 'zimno', land: land(8, 8),
          note: 'Zlodowacenia to twarda szkoła — przetrwają najbardziej elastyczni.',
          catastrophe: { name: 'Zlodowacenie plejstoceńskie', kind: 'zimno', niches: ['lad', 'powietrze'], severity: 0.35, knowledge: 'extinction' } },
        { title: 'Współczesność — próg rozumności', oxygen: 11, food: 10, predators: 6, climate: 'umiarkowanie', land: land(11, 6),
          note: 'Ostatnia tura: czy Twoja linia przekroczy próg inteligencji?' }
      ]
    }
  ];

  /*
   * Zdarzenia losowe (ZALOZENIA 4.3). Losowane przy tworzeniu świata z ziarna,
   * więc są znane z wyprzedzeniem (zapowiedź). `niche` — jeśli `random`,
   * silnik losuje niszę.
   */
  var EVENTS = [
    { id: 'bloom', name: 'Rozkwit pokarmu', icon: '🌿', good: true, foodBonus: 3, knowledge: 'events',
      desc: 'Zakwit roślinności i planktonu — więcej pokarmu we wszystkich niszach.' },
    { id: 'mild', name: 'Łagodny sezon', icon: '🍀', good: true, predBonus: -2, knowledge: 'events',
      desc: 'Spokojny sezon — mniejsza presja drapieżników.' },
    { id: 'o2spike', name: 'Wzrost tlenu', icon: '💨', good: true, oxygenBonus: 3, knowledge: 'events',
      desc: 'Więcej tlenu w atmosferze i wodzie — tańszy metabolizm.' },
    { id: 'drought', name: 'Susza', icon: '🏜️', good: false, niche: 'lad', foodBonus: -4, knowledge: 'events',
      desc: 'Susza na lądzie — mniej pokarmu dla zwierząt lądowych.' },
    { id: 'invasion', name: 'Inwazja drapieżnika', icon: '🦈', good: false, niche: 'random', predBonus: 4, knowledge: 'predation',
      desc: 'Nowy, sprawny drapieżnik wkracza do jednej niszy.' },
    { id: 'epidemic', name: 'Epidemia', icon: '🦠', good: false, disease: 0.2, knowledge: 'carrying',
      desc: 'Choroba zakaźna szerzy się w zatłoczonych populacjach (powyżej 80% pojemności niszy).' },
    { id: 'coldsnap', name: 'Nagłe ochłodzenie', icon: '🧊', good: false, climate: 'zimno', knowledge: 'cold',
      desc: 'Krótkie, ostre ochłodzenie klimatu.' }
  ];
  var EVENT_CHANCE = 0.4;

  /*
   * Cele ery — opcjonalne zadania z nagrodą w ZG. type:
   * niche (linia w niszy), niches (liczba różnych nisz naraz), lineages (żywe linie),
   * lineagesAtEnd (żywe linie na koniec ery), fixed (utrwalona cecha), freq (częstość
   * cechy ≥ f), pop, intel.
   */
  var OBJECTIVES = {
    paleozoik: [
      { id: 'p_land', text: 'Wyprowadź linię na ląd', type: 'niche', niche: 'lad', reward: 8 },
      { id: 'p_two', text: 'Miej co najmniej 2 żywe linie', type: 'lineages', n: 2, reward: 6 },
      { id: 'p_nerve', text: 'Utrwal „Zwoje nerwowe” (≥95%)', type: 'fixed', trait: 'ganglia', reward: 6 }
    ],
    mezozoik: [
      { id: 'm_niches', text: 'Zajmuj 3 różne nisze jednocześnie', type: 'niches', n: 3, reward: 10 },
      { id: 'm_endo', text: 'Rozprzestrzeń „Stałocieplność” (≥50%)', type: 'freq', trait: 'endothermy', f: 0.5, reward: 8 },
      { id: 'm_kpg', text: 'Przetrwaj K–Pg z co najmniej 2 liniami', type: 'lineagesAtEnd', n: 2, reward: 10 }
    ],
    kenozoik: [
      { id: 'k_brain', text: 'Rozprzestrzeń „Rozbudowany mózg” (≥50%)', type: 'freq', trait: 'big_brain', f: 0.5, reward: 10 },
      { id: 'k_pop', text: 'Osiągnij łączną populację 900', type: 'pop', n: 900, reward: 8 }
    ]
  };

  // Quiz po zakończeniu ery (ZALOZENIA 6 — nagroda za naukę).
  var QUIZZES = {
    paleozoik: {
      q: 'Dlaczego wyjście na ląd opłaciło się pierwszym czworonogom?',
      options: [
        'Ląd był prawie pusty — mało konkurentów i drapieżników, dużo nowego pokarmu.',
        'Zwierzęta chciały zobaczyć, co jest na lądzie, więc wyrosły im nogi.',
        'Woda nagle wyschła na całej Ziemi.'
      ],
      correct: 0, reward: 6,
      explain: 'Nisza bez konkurencji daje przewagę osobnikom, które przypadkiem potrafią z niej korzystać. ' +
        'Organizmy nie „chcą” się zmieniać — to dobór utrwala korzystne warianty.'
    },
    mezozoik: {
      q: 'Dlaczego po wymieraniu K–Pg nastąpił szybki rozkwit ssaków?',
      options: [
        'Ssaki specjalnie przeczekały dinozaury.',
        'Zwolniły się nisze po dinozaurach — nastąpiła radiacja adaptacyjna ocalałych linii.',
        'Asteroida sprawiła, że ssaki stały się większe.'
      ],
      correct: 1, reward: 6,
      explain: 'Wymieranie usuwa konkurentów. Ocalałe (często małe, wszystkożerne, ryjące) linie szybko ' +
        'różnicują się, zajmując puste nisze — to radiacja adaptacyjna.'
    },
    kenozoik: {
      q: 'Co jest źródłem nowych cech w populacji?',
      options: [
        'Ćwiczenie narządu w ciągu życia, przekazywane potomstwu.',
        'Potrzeba organizmu, która wywołuje odpowiednią zmianę.',
        'Losowe mutacje, które dobór naturalny utrwala albo eliminuje.'
      ],
      correct: 2, reward: 6,
      explain: 'Mutacje są losowe względem potrzeb organizmu. Dobór naturalny „przesiewa” je: korzystne ' +
        'stają się częstsze, szkodliwe zanikają. Dziedziczenie cech nabytych (lamarkizm) nie działa w ten sposób.'
    }
  };

  // Scenariusze.
  var SCENARIOS = [
    { id: 'full', name: 'Pełna ewolucja', icon: '🧬', difficulty: 'normalny', startEra: 0,
      intro: 'Klasyczna gra od prostego życia w morzu aż do gatunku rozumnego, przez trzy ery (20 tur).' },
    { id: 'land', name: 'Podbój lądu', icon: '🏝️', difficulty: 'latwy', startEra: 0,
      intro: 'Łagodniejsze wyzwanie: więcej zmienności, słabsza konkurencja i niższy próg inteligencji.' },
    { id: 'hard', name: 'Twardy świat', icon: '🌋', difficulty: 'trudny', startEra: 0,
      intro: 'Silniejsze katastrofy, drapieżniki i konkurencja. Wynik liczony z mnożnikiem ×1,4.' },
    { id: 'ice', name: 'Epoki lodowcowe', icon: '❄️', difficulty: 'trudny', startEra: 2,
      startZg: 20, goal: 12, startTraits: ['fins', 'limbs', 'scales', 'endothermy', 'ganglia', 'jaws', 'eyes', 'brain'],
      startNiche: 'lad',
      intro: 'Start w kenozoiku jako zaawansowany, stałocieplny gatunek lądowy. Chłodny świat i tylko sześć tur, ' +
        'by z mózgu wykuć rozumność. Twardy sprint końcowy.' }
  ];

  var KNOWLEDGE = {
    intro: { icon: '🧬', title: 'Czym jest dobór naturalny?',
      body: 'Osobniki różnią się cechami. Te lepiej przystosowane częściej przeżywają i zostawiają ' +
        'potomstwo, przekazując mu swoje cechy. Po wielu pokoleniach populacja się zmienia.' },
    no_goal: { icon: '🎯', title: 'Ewolucja nie ma celu',
      body: 'W grze wybierasz jedną z mutacji — to uproszczenie. W naturze nikt nie wybiera: mutacje ' +
        'powstają losowo, a środowisko „decyduje”, które z nich staną się częstsze. Dlatego nawet ' +
        'wybrana mutacja może zaniknąć, jeśli w danych warunkach szkodzi.' },
    selection: { icon: '📈', title: 'Częstość cech w populacji',
      body: 'Nowa cecha nie pojawia się naraz u wszystkich. Jeśli zwiększa szanse przeżycia i rozrodu, ' +
        'jej nosiciele zostawiają więcej potomstwa, więc z pokolenia na pokolenie staje się częstsza — ' +
        'aż do utrwalenia. Jeśli szkodzi — zanika.' },
    drift: { icon: '🎲', title: 'Dryf genetyczny',
      body: 'Częstość cech zmienia się też przypadkiem — bo o tym, kto zostawi potomstwo, decyduje ' +
        'również ślepy los. W małych populacjach dryf jest silny i potrafi utrwalić, a nawet usunąć ' +
        'cechę niezależnie od jej użyteczności.' },
    mvp: { icon: '👥', title: 'Minimalna populacja żywotna',
      body: 'Bardzo mała populacja jest skazana na chów wsobny, utratę zmienności i przypadkowe wahania ' +
        'liczebności. Poniżej pewnego progu gatunek zwykle wymiera, nawet jeśli warunki się poprawią.' },
    mutation_bad: { icon: '⚠️', title: 'Nie każda zmiana pomaga',
      body: 'Ta cecha zanikła, bo w obecnych warunkach bardziej szkodziła, niż pomagała. Dobór ' +
        'naturalny „odsiewa” niekorzystne warianty.' },
    vestigial: { icon: '🦯', title: 'Utrata cech',
      body: 'Ewolucja nie zawsze dodaje. Gdy cecha przestaje się opłacać, mutacje ją wyłączające mogą się ' +
        'rozprzestrzenić — tak ryby jaskiniowe straciły oczy, a wieloryby tylne kończyny (pozostały szczątkowe kości).' },
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
    competition: { icon: '⚔️', title: 'Konkurencja',
      body: 'Gatunki w tej samej niszy dzielą ten sam pokarm. Silni konkurenci ograniczają, ile go dostaniesz. ' +
        'Twoje własne linie w jednej niszy też ze sobą konkurują — dlatego gatunki pokrewne często ' +
        'zajmują różne nisze (zasada konkurencyjnego wykluczania).' },
    carrying: { icon: '📦', title: 'Pojemność środowiska',
      body: 'Żadna populacja nie rośnie w nieskończoność. Ilość pokarmu wyznacza pojemność środowiska — ' +
        'gdy populacja się do niej zbliża, przyrost słabnie, a zatłoczenie sprzyja chorobom.' },
    radiation: { icon: '🌈', title: 'Radiacja adaptacyjna',
      body: 'Gdy wymieranie usunie konkurentów, ocalałe linie szybko różnicują się i zajmują puste nisze.',
      fossil: 'Po wymieraniu K–Pg ssaki w ciągu ~10 mln lat dały początek niemal wszystkim współczesnym rzędom.' },
    cold: { icon: '❄️', title: 'Klimat jako presja',
      body: 'Ochłodzenie ogranicza pokarm i aktywność zwierząt zmiennocieplnych. Stałocieplność pozwala ' +
        'działać w chłodzie, ale wymaga znacznie więcej energii.' },
    oxygen: { icon: '🫧', title: 'Tlen i oddychanie',
      body: 'Przy niskim poziomie tlenu metabolizm jest droższy. Ryby, które potrafiły łykać powietrze, ' +
        'miały przewagę w dusznych płyciznach — to jedna z dróg do podboju lądu.',
      fossil: 'Ryby dwudyszne żyją do dziś i nadal oddychają zarówno skrzelami, jak i płucami.' },
    land: { icon: '🦶', title: 'Podbój lądu',
      body: 'Wyjście na ląd wymagało kończyn, oddychania powietrzem i rozrodu niezależnego od wody.',
      fossil: 'Tiktaalik (dewon) łączy cechy ryb i płazów — ilustruje przejście na ląd.' },
    niche: { icon: '🗺️', title: 'Nisza ekologiczna',
      body: 'Nisza to zespół warunków i zasobów, w których gatunek żyje. Różne nisze (woda, przybrzeże, ' +
        'ląd, powietrze) mają inne pokarmy, zagrożenia i konkurentów — i faworyzują inne cechy.' },
    events: { icon: '🍀', title: 'Zmienność środowiska',
      body: 'Środowisko ciągle się zmienia: zakwity, susze, epidemie, inwazje. To, co pomaga dziś, ' +
        'jutro może przeszkadzać — dlatego zmienność genetyczna jest bezcenna.' },
    intelligence: { icon: '🧠', title: 'Ewolucja inteligencji',
      body: 'Duży mózg zużywa mnóstwo energii, ale pomaga przetrwać trudne czasy (hipoteza buforu ' +
        'poznawczego): sprytne zwierzęta znajdują nowe pokarmy i unikają zagrożeń. Rozwija się tam, ' +
        'gdzie ta przewaga przeważa nad kosztem.' },
    speciation: { icon: '🌿', title: 'Specjacja — powstawanie gatunków',
      body: 'Gdy część populacji przystosuje się do odrębnej niszy i przestaje wymieniać geny z resztą, ' +
        'powstaje nowy gatunek. Tak linie rozgałęziają się w „drzewo życia”.',
      fossil: 'Zięby Darwina z Galapagos to klasyczny przykład szybkiej specjacji w różnych niszach.' },
    extinction: { icon: '☄️', title: 'Wymieranie masowe',
      body: 'To gwałtowny zanik wielu gatunków w krótkim (geologicznie) czasie. Przeżywają ci, którzy ' +
        'przypadkiem mają cechy chroniące przed danym kataklizmem — np. małe, ryjące zwierzęta po uderzeniu asteroidy.',
      fossil: 'Wymieranie permskie (~252 mln lat temu) zgładziło ok. 90% gatunków morskich.' },
    milestone: { icon: '🏛️', title: 'Kamienie milowe ewolucji',
      body: 'Każda era premiuje inne adaptacje: szkielet i kończyny w paleozoiku, jaja lądowe i ' +
        'stałocieplność w mezozoiku, mózg i narzędzia w kenozoiku.' }
  };

  return {
    BASE_STATS: BASE_STATS, START_POPULATION: START_POPULATION, GENETICS: GENETICS,
    COSTS: COSTS, MIN_SPECIATION_POP: MIN_SPECIATION_POP, MIN_VIABLE_POP: MIN_VIABLE_POP,
    DIFFICULTIES: DIFFICULTIES, NICHES: NICHES, CONDITIONS: CONDITIONS, CATASTROPHE_KINDS: CATASTROPHE_KINDS,
    CATEGORIES: CATEGORIES, CATEGORY_ICONS: CATEGORY_ICONS,
    TRAITS: TRAITS, ERAS: ERAS, EVENTS: EVENTS, EVENT_CHANCE: EVENT_CHANCE,
    OBJECTIVES: OBJECTIVES, QUIZZES: QUIZZES, SCENARIOS: SCENARIOS, KNOWLEDGE: KNOWLEDGE
  };
});
