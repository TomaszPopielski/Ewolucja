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

  // Minimalna żywotna populacja (efekt Allee): poniżej tego progu rozród słabnie
  // proporcjonalnie do liczebności — trudniej o partnera, rośnie chów wsobny.
  var MIN_VIABLE_POP = 20;

  /*
   * Trzy waluty gry — każda z własną rolą i horyzontem:
   *  • EP (punkty ewolucji, wspólne) — trwałe cechy z drzewa adaptacji;
   *  • ⚡ rezerwy energii (osobno dla linii) — taktyka tury: migracja, zachowania;
   *  • 🧬 zmienność genetyczna (osobno dla linii) — specjacja, ukierunkowany dobór,
   *    odporność na katastrofy i choroby.
   */

  // ⚡ Rezerwy energii. Nadwyżka energii z tury trafia do magazynu (`storeRate`),
  // a deficyt najpierw pokrywają rezerwy (do `drawMax` na turę) — dopiero reszta
  // deficytu oznacza głód.
  // Linia żyjąca z zapasów rozmnaża się słabiej (`deficitBirthMult`). `capBonus` —
  // cechy powiększające magazyn (tłuszcz pod futrem/piórami).
  var RESERVES = { start: 6, cap: 12, capBonus: { insulation: 6 }, storeRate: 0.6, drawMax: 1.5, deficitBirthMult: 0.5 };

  // 🧬 Zmienność genetyczna. Przybywa jej z czasem (`base`), szybciej w dużej
  // populacji (+1 za każde `perPop` osobników, maks. `popMax`) i z każdą mutacją.
  // Ubywa w wąskim gardle (populacja < MIN_VIABLE_POP → ×`bottleneckMult`) i w
  // katastrofie (odsetek strat × `catastropheLoss`). Poniżej `smallPop` osobników
  // dryf genetyczny zjada przyrost. Wysoka zmienność łagodzi katastrofy
  // (`shieldPer` za punkt, maks. `shieldMax`). Ukierunkowany dobór kosztuje
  // `selectionCost` na turę: częstsze (`selectionChance`) i częściej korzystne
  // (`selectionGood`) mutacje — silny dobór zużywa zmienność.
  var VARIATION = { start: 6, cap: 30, base: 1, perPop: 150, popMax: 3, mutation: 1, smallPop: 50,
    bottleneckMult: 0.5, catastropheLoss: 0.6, shieldPer: 0.01, shieldMax: 0.3, shieldMin: 10,
    selectionCost: 3, selectionChance: 0.35, selectionGood: 0.75, founder: 2 };

  // Specjacja (płatna 🧬 zmiennością aktywnej linii): koszt bazowy rośnie o STEP
  // za każdą kolejną żywą linię. Nowy gatunek wymaga zmienności, nie „punktów”.
  var SPECIATION_COST = 8;
  var SPECIATION_COST_STEP = 4;
  var MIN_SPECIATION_POP = 60;
  // Nową linię zakłada taka część populacji rodzica.
  var SPECIATION_SHARE = 0.4;
  // Nowa linia (specjacja, kolonia z karty decyzji) przez `turns` tury ma presję
  // drapieżników × `predMult` — miejscowi łowcy jeszcze jej „nie znają”
  // (hipoteza uwolnienia od wrogów).
  var NEW_LINEAGE = { turns: 2, predMult: 0.5 };

  // Migracja (płatna ⚡ rezerwami — wędrówka to wydatek energii): koszt = BASE −
  // mobilność (min. MIN); w turze migracji linia się aklimatyzuje — zdobywa tylko
  // ACCLIMATIZATION_FOOD pokarmu.
  var MIGRATION = { baseCost: 8, minCost: 2, acclimatizationFood: 0.75 };

  // Strategia rozrodu linii (przełącznik; obowiązuje do zmiany). Bez kosztu —
  // sam kompromis. `reserveDrain` — ⚡ zużywane co turę.
  var STRATEGIES = {
    zrownowazona: { label: 'Zrównoważona', icon: '⚖️', art: 'ui:balance', birthMult: 1, predLossMult: 1, starveLossMult: 1, reserveDrain: 0,
      desc: 'Bez premii i kar.' },
    r: { label: 'Strategia r — ilość', icon: '🐸', art: 'strategy:r', birthMult: 1.25, predLossMult: 1.3, starveLossMult: 1.2, reserveDrain: 1,
      desc: 'Dużo potomstwa bez opieki: rozród ×1,25, ale młode częściej giną (straty od drapieżników ×1,3, z głodu ×1,2) i zużywa 1 ⚡ na turę.' },
    K: { label: 'Strategia K — jakość', icon: '🐘', art: 'strategy:K', birthMult: 0.75, predLossMult: 0.75, starveLossMult: 0.75, reserveDrain: 0,
      desc: 'Mało potomstwa, dobrze chronionego: rozród ×0,75, ale straty od drapieżników i głodu ×0,75.' }
  };

  // Zachowanie linii: obowiązuje co turę, aż gracz je zmieni (do „Zwykłego życia”). `cost` w ⚡ płaci się w każdej turze;
  // gdy rezerw brak, linia żyje zwyczajnie (do czasu, aż znów będzie ją stać).
  var BEHAVIORS = {
    brak: { label: 'Zwykłe życie', icon: '🌿', art: 'behavior:brak', cost: 0, desc: 'Bez dodatkowych działań.' },
    zapasy: { label: 'Gromadzenie zapasów', icon: '🌰', art: 'behavior:zapasy', cost: 0, birthMult: 0.4, storeBonus: 2,
      desc: 'Energia idzie w zapasy, nie w potomstwo: +2 ⚡ co turę, rozród ×0,4.' },
    ukrycie: { label: 'Ukrywanie się', icon: '🕳️', art: 'behavior:ukrycie', cost: 2, foodMult: 0.8, predPressureMult: 0.45,
      desc: 'Kosztuje 2 ⚡ co turę: presja drapieżników ×0,45, ale pokarm ×0,8.' },
    zerowanie: { label: 'Intensywne żerowanie', icon: '🦷', art: 'trait:jaws', cost: 2, foodMult: 1.3, predAdd: 3,
      desc: 'Kosztuje 2 ⚡ co turę: pokarm ×1,3, ale presja drapieżników +3 (większa ekspozycja).' }
  };

  /*
   * Karty decyzji — zdarzenia z wyborem (także zdarzenia pozytywne — nic nie dzieje się bez wyboru gracza).
   * Po turze bez katastrofy z szansą CHOICE_CHANCE losowana jest karta dla jednej
   * żywej linii. Gracz wybiera opcję przed turą; bez wyboru działa opcja `default`.
   * `icon` — zapasowe emoji, `art` — klucz ikony SVG (src/art/icons.ts).
   * Opcja: `cost` { reserves, variation } — płatność; `effects` { stats, reserves,
   * predatorLevel, found } — skutek natychmiastowy (`found` — odsetek populacji
   * zakładający nową linię); `turnMod`/`nextMod` — modyfikatory tej / następnej
   * tury (foodBonus, predBonus, birthMult, diseaseLoss); `knowledge` — karta wiedzy.
   * `gamble` — opcja z ryzykiem: wynik losowany w turze, szansa `chance` (+ `per` za
   * każdy punkt statystyki `stat` ponad `from`); `win`/`lose` mają tę samą budowę co
   * opcja (effects: stats, reserves, variation, predatorLevel, ep, popLoss, popGain;
   * turnMod, nextMod, knowledge) oraz `text` do raportu.
   * Karta: `minPop`, `minEra`, `niches` — kiedy może paść. Karty nie powtarzają się,
   * dopóki pula się nie wyczerpie.
   */
  var CHOICE_CHANCE = 0.3;
  var CHOICE_EVENTS = [
    { id: 'island', name: 'Wynurza się wyspa', icon: '🏝️', art: 'choice:island', minPop: 60,
      desc: 'Nowy ląd lub rafa w zasięgu linii. Grupa osobników mogłaby się tam przedostać i żyć w izolacji.',
      options: [
        { id: 'colonize', label: 'Wyślij kolonistów', effects: { found: 0.25 }, knowledge: 'founder',
          desc: '¼ populacji zakłada nową linię (bez kosztu 🧬), ale z małą zmiennością — efekt założyciela.' },
        { id: 'ignore', label: 'Zostań na miejscu', default: true, desc: 'Nic się nie zmienia.' }
      ] },
    { id: 'predator', name: 'Nowy drapieżnik w niszy', icon: '🦈', art: 'know:predation',
      desc: 'Do niszy linii wkracza sprawny łowca.',
      options: [
        { id: 'hide', label: 'Przeczekaj w ukryciu', cost: { reserves: 4 }, turnMod: { noPredators: true }, desc: 'Kosztuje 4 ⚡ — w tej turze drapieżnik nie zagrozi.' },
        { id: 'scare', label: 'Odstrasz łowcę',
          gamble: { chance: 0.3, stat: 'defense', per: 0.06,
            win: { effects: { predatorLevel: -1.5 }, turnMod: { predMult: 0.5 }, knowledge: 'predation',
              text: 'Łowca zrezygnował — w tej turze presja drapieżników ×0,5, a koewolucja cofnęła się o 1,5.' },
            lose: { effects: { popLoss: 0.12 }, text: 'Konfrontacja przegrana — zginęło 12% populacji.' } },
          desc: 'Ryzyko (szansa rośnie z obroną). Sukces: presja ×0,5 w tej turze i słabsza koewolucja. Porażka: ginie 12% populacji.' },
        { id: 'arms', label: 'Wyścig zbrojeń', effects: { stats: { defense: 1 }, predatorLevel: 1.5 }, knowledge: 'coevolution',
          desc: '+1 obrony na stałe, ale drapieżniki szybciej ewoluują (koewolucja +1,5).' },
        { id: 'endure', label: 'Stawić czoła', default: true, turnMod: { predBonus: 4 },
          desc: 'W tej turze presja drapieżników +4.' }
      ] },
    { id: 'bloom', name: 'Zakwit pokarmu', icon: '🌾', art: 'ui:sprout',
      desc: 'Nagła obfitość pokarmu. Jak ją wykorzystać?',
      options: [
        { id: 'feast', label: 'Najeść się na zapas', effects: { reserves: 5 }, knowledge: 'reserves', default: true,
          desc: '+5 ⚡ od razu.' },
        { id: 'breed', label: 'Rozmnażać się', turnMod: { birthMult: 1.5 }, nextMod: { foodBonus: -3 }, knowledge: 'boom',
          desc: 'Rozród ×1,5 w tej turze, ale w następnej −3 pokarmu (załamanie po boomie).' }
      ] },
    { id: 'mild', name: 'Łagodny sezon', icon: '🌤️', art: 'ui:sun',
      desc: 'Spokojny sezon — drapieżniki są mniej aktywne. Jak wykorzystać ciszę?',
      options: [
        { id: 'calm', label: 'Korzystaj z ciszy', default: true, turnMod: { predBonus: -2 }, knowledge: 'events',
          desc: 'W tej turze presja drapieżników −2.' },
        { id: 'breed', label: 'Wykorzystaj spokój na rozród', turnMod: { predBonus: -2, birthMult: 1.4 }, nextMod: { predBonus: 2 },
          knowledge: 'boom', desc: 'Presja −2 i rozród ×1,4 w tej turze, ale w następnej drapieżniki wracają silniejsze (+2).' },
        { id: 'forage', label: 'Żeruj śmiało', turnMod: { foodBonus: 2, predBonus: 1 },
          desc: 'Pokarm +2, ale zamiast ciszy presja drapieżników +1 (większa ekspozycja).' }
      ] },
    { id: 'disease', name: 'Epidemia pasożytów', icon: '🦠', art: 'choice:disease',
      desc: 'W populacji szerzy się choroba.',
      options: [
        { id: 'resist', label: 'Postaw na odporność', cost: { variation: 4 }, knowledge: 'variation',
          desc: 'Kosztuje 4 🧬 — w zmiennej populacji są osobniki odporne; choroba nie zabija.' },
        { id: 'disperse', label: 'Rozprosz populację', cost: { reserves: 2 },
          gamble: { chance: 0.5, stat: 'mobility', per: 0.04,
            win: { text: 'Rozproszenie zatrzymało chorobę — nikt nie zginął.' },
            lose: { turnMod: { diseaseLoss: 0.3 }, text: 'Rozproszeni osobnicy roznieśli chorobę dalej — zginie ok. 30% populacji.' } },
          desc: 'Kosztuje 2 ⚡. Ryzyko (szansa rośnie z mobilnością). Sukces: choroba nie zabija. Porażka: zabija ok. 30%.' },
        { id: 'endure', label: 'Przetrwać chorobę', default: true, turnMod: { diseaseLoss: 0.2 },
          desc: 'W tej turze choroba zabije ok. 20% populacji.' }
      ] },
    { id: 'toxic_food', name: 'Nieznany pokarm', icon: '🍄', art: 'know:starvation',
      desc: 'W niszy pojawiło się obfite, ale nieznane źródło pokarmu. Część może być trująca.',
      options: [
        { id: 'taste', label: 'Spróbuj nowego pokarmu',
          gamble: { chance: 0.5, stat: 'feeding', per: 0.04, from: 5,
            win: { effects: { stats: { feeding: 1 } }, knowledge: 'toxins', text: 'Nowy pokarm jest jadalny — odżywianie +1 na stałe.' },
            lose: { effects: { popLoss: 0.15 }, knowledge: 'toxins', text: 'Pokarm okazał się trujący — zatruło się 15% populacji.' } },
          desc: 'Ryzyko (szansa rośnie z odżywianiem). Sukces: odżywianie +1 na stałe. Porażka: ginie 15% populacji.' },
        { id: 'avoid', label: 'Trzymaj się sprawdzonego', default: true, desc: 'Nic się nie zmienia.' }
      ] },
    { id: 'rival', name: 'Konkurent w niszy', icon: '⚔️', art: 'know:competition',
      desc: 'Inny gatunek zaczyna korzystać z tych samych zasobów co linia.',
      options: [
        { id: 'fight', label: 'Wypieraj konkurenta',
          gamble: { chance: 0.35, stat: 'defense', per: 0.05,
            win: { turnMod: { foodBonus: 2 }, nextMod: { foodBonus: 2 }, knowledge: 'competition',
              text: 'Konkurent wyparty — pokarm +2 w tej i w następnej turze.' },
            lose: { effects: { popLoss: 0.1 }, turnMod: { foodBonus: -2 }, knowledge: 'competition',
              text: 'Starcie przegrane — zginęło 10% populacji, a konkurent zabrał część pokarmu (−2).' } },
          desc: 'Ryzyko (szansa rośnie z obroną). Sukces: pokarm +2 przez dwie tury. Porażka: ginie 10% populacji i pokarm −2.' },
        { id: 'shift', label: 'Zmień dietę', cost: { variation: 4 }, knowledge: 'displacement',
          desc: 'Kosztuje 4 🧬 — linia przesuwa się na inny pokarm (przemieszczenie cech) i unika konkurencji.' },
        { id: 'share', label: 'Dziel się zasobami', default: true, turnMod: { foodBonus: -2 }, nextMod: { foodBonus: -1 },
          desc: 'Pokarm −2 w tej turze i −1 w następnej.' }
      ] },
    { id: 'volcano', name: 'Erupcja wulkanu', icon: '🌋', art: 'ui:meteor',
      desc: 'Nieopodal wybucha wulkan. Popioły zasypią okolicę, ale potem użyźnią glebę i wodę.',
      options: [
        { id: 'flee', label: 'Uciekaj z zasięgu', cost: { reserves: 3 }, desc: 'Kosztuje 3 ⚡ — linia bezpiecznie omija erupcję.' },
        { id: 'stay', label: 'Przeczekaj na miejscu', default: true,
          gamble: { chance: 0.5,
            win: { nextMod: { foodBonus: 3 }, text: 'Popioły ominęły linię, a użyźniona okolica da w następnej turze +3 pokarmu.' },
            lose: { effects: { popLoss: 0.2 }, nextMod: { foodBonus: 3 },
              text: 'Popioły dosięgły linii — zginęło 20% populacji; w następnej turze pokarm +3.' } },
          desc: 'Ryzyko 50/50. Sukces: w następnej turze pokarm +3. Porażka: ginie 20% populacji (pokarm +3 i tak).' }
      ] },
    { id: 'hybrid', name: 'Pokrewna populacja', icon: '🧬', art: 'know:variation', minPop: 30,
      desc: 'Linia napotyka blisko spokrewnioną populację, od dawna żyjącą osobno.',
      options: [
        { id: 'interbreed', label: 'Krzyżuj się',
          gamble: { chance: 0.6,
            win: { effects: { variation: 6, popGain: 0.1 }, knowledge: 'hybridization',
              text: 'Mieszańce są żywotne — +6 🧬 zmienności i +10% populacji.' },
            lose: { effects: { stats: { reproduction: -1 } }, knowledge: 'hybridization',
              text: 'Mieszańce są słabo płodne — rozród −1 na stałe.' } },
          desc: 'Ryzyko (60%). Sukces: +6 🧬 i +10% populacji. Porażka: rozród −1 na stałe.' },
        { id: 'avoid', label: 'Trzymaj się własnej grupy', default: true, desc: 'Nic się nie zmienia.' }
      ] },
    { id: 'courtship', name: 'Wyścig godowy', icon: '🦚', art: 'know:rk',
      desc: 'W populacji szerzy się moda na okazałe ozdoby i popisy godowe.',
      options: [
        { id: 'display', label: 'Stawiaj na ozdoby',
          gamble: { chance: 0.55,
            win: { turnMod: { birthMult: 1.4 }, effects: { variation: 2 }, knowledge: 'sexual_selection',
              text: 'Popisy się opłaciły — rozród ×1,4 w tej turze i +2 🧬.' },
            lose: { turnMod: { predBonus: 5 }, knowledge: 'sexual_selection',
              text: 'Jaskrawe ozdoby przyciągnęły drapieżniki — presja +5 w tej turze.' } },
          desc: 'Ryzyko (55%). Sukces: rozród ×1,4 i +2 🧬. Porażka: presja drapieżników +5 w tej turze.' },
        { id: 'modest', label: 'Skromne ubarwienie', default: true, desc: 'Nic się nie zmienia.' }
      ] },
    { id: 'carrion', name: 'Padlina olbrzyma', icon: '🦴', art: 'ui:bone',
      desc: 'Martwy olbrzym to góra pożywienia — ale ściągają do niego też drapieżniki.',
      options: [
        { id: 'feast', label: 'Pożywiaj się',
          gamble: { chance: 0.4, stat: 'mobility', per: 0.05,
            win: { effects: { reserves: 5 }, turnMod: { foodBonus: 2 }, text: 'Udana uczta — +5 ⚡ i pokarm +2 w tej turze.' },
            lose: { effects: { reserves: 2 }, turnMod: { predBonus: 4 },
              text: 'Przy padlinie czekali drapieżnicy — tylko +2 ⚡, a presja drapieżników +4 w tej turze.' } },
          desc: 'Ryzyko (szansa rośnie z mobilnością). Sukces: +5 ⚡ i pokarm +2. Porażka: +2 ⚡, ale presja drapieżników +4.' },
        { id: 'skip', label: 'Omiń padlinę', default: true, desc: 'Nic się nie zmienia.' }
      ] },
    { id: 'symbiont', name: 'Symbioza', icon: '🦠', art: 'choice:disease',
      desc: 'Mikroorganizmy mogą zamieszkać w jelitach linii — jako pomocnicy albo pasożyty.',
      options: [
        { id: 'accept', label: 'Przyjmij symbionta',
          gamble: { chance: 0.6,
            win: { effects: { stats: { metabolism: -1 } }, knowledge: 'symbiosis', text: 'Symbionci pomagają trawić — metabolizm −1 na stałe.' },
            lose: { turnMod: { diseaseLoss: 0.12 }, knowledge: 'symbiosis',
              text: 'Zamiast pomocników — pasożyty: choroba zabije ok. 12% populacji.' } },
          desc: 'Ryzyko (60%). Sukces: metabolizm −1 na stałe. Porażka: choroba zabija ok. 12% populacji.' },
        { id: 'reject', label: 'Odrzuć', default: true, desc: 'Nic się nie zmienia.' }
      ] },
    { id: 'lean', name: 'Chudy sezon', icon: '🍂', art: 'ui:sun',
      desc: 'Nadchodzi nieurodzaj — pokarmu będzie wyraźnie mniej.',
      options: [
        { id: 'reserves', label: 'Żyj z zapasów', cost: { reserves: 4 }, knowledge: 'reserves',
          desc: 'Kosztuje 4 ⚡ — linia przetrwa sezon bez utraty pokarmu.' },
        { id: 'dormancy', label: 'Zapadnij w odrętwienie',
          gamble: { chance: 0.5, stat: 'metabolism', per: -0.05, from: 5,
            win: { effects: { reserves: 1 }, knowledge: 'dormancy', text: 'Odrętwienie się udało — linia przespała chudy sezon bez strat (+1 ⚡).' },
            lose: { turnMod: { foodBonus: -5 }, knowledge: 'dormancy', text: 'Sezon trwał dłużej niż sen — pokarm −5 w tej turze.' } },
          desc: 'Ryzyko (łatwiej przy niskim metabolizmie). Sukces: bez strat, +1 ⚡. Porażka: pokarm −5 w tej turze.' },
        { id: 'endure', label: 'Szukaj pokarmu', default: true, turnMod: { foodBonus: -3 }, desc: 'W tej turze pokarm −3.' }
      ] },
    { id: 'mutant', name: 'Niezwykły mutant', icon: '🧪', art: 'know:mutation_good',
      desc: 'W populacji pojawiła się rzadka, wyraźna mutacja. Czy dobór ją utrwali?',
      options: [
        { id: 'favor', label: 'Postaw na mutację', cost: { variation: 3 },
          gamble: { chance: 0.5,
            win: { effects: { ep: 12 }, knowledge: 'mutation_good', text: 'Mutacja okazała się korzystna i się rozprzestrzenia — +12 EP.' },
            lose: { turnMod: { birthMult: 0.6 }, knowledge: 'mutation_bad', text: 'Mutacja okazała się szkodliwa — rozród ×0,6 w tej turze.' } },
          desc: 'Kosztuje 3 🧬. Ryzyko 50/50. Sukces: +12 EP. Porażka: rozród ×0,6 w tej turze.' },
        { id: 'ignore', label: 'Zostaw to doborowi', default: true, desc: 'Nic się nie zmienia.' }
      ] }
  ];

  // Punkty ewolucji za turę (ZALOZENIA 4.2): premia za przetrwanie + za sukces
  // reprodukcyjny (łączna liczebność i wzrost wszystkich linii) + za inteligencję
  // najlepszej linii.
  // Skalibrowane symulacją (test „balans”): stały plan nie wygrywa zawsze.
  // `perExtraNiche` — za każdą zajętą niszę ponad pierwszą (radiacja adaptacyjna).
  var EP_RULES = { base: 10, perPopulation: 45, perGrowth: 8, intelligenceDiv: 2, perExtraNiche: 4 };

  // Zmienność środowiska (ZALOZENIA 3: faza środowiska). Po każdej turze silnik
  // losuje odchylenia warunków następnej tury od wartości historycznych; gracz
  // widzi je przed decyzją. `climateShift` — szansa zmiany klimatu o jeden stopień.
  var ENV_VARIATION = { food: 2, predators: 2, oxygen: 1, climateShift: 0.2 };

  // Zwycięstwo: próg inteligencji ORAZ ta cecha (kultura/technologia, ZALOZENIA 4.6).
  var WIN_TRAIT = 'tool_use';
  /* Drogi do rozumu: cecha kultury i nisze, w których ta kultura ma sens. Narzędzia
     wymagają lądu lub brzegu (w toni nie ma czego obrabiać), kultura akustyczna —
     wody lub brzegu (dźwięk niesie się w wodzie, jak u delfinów i waleni). */
  var WIN_PATHS = [
    { id: 'tools', trait: 'tool_use', niches: ['lad', 'przybrzeze'], label: 'kultura narzędziowa',
      short: 'narzędzia (ląd lub brzeg)' },
    { id: 'sound', trait: 'vocal_culture', niches: ['woda', 'przybrzeze'], label: 'kultura akustyczna',
      short: 'kultura akustyczna (woda lub brzeg)' }
  ];
  // …w linii liczącej co najmniej tyle osobników (żywotny gatunek, nie garstka).
  var WIN_MIN_POP = 50;

  // Poziomy trudności (ZALOZENIA — dopasowanie wyzwania).
  var DIFFICULTIES = {
    latwy:    { label: 'Łatwy',    startEp: 50, goal: 14, catMult: 0.6, predMult: 0.8, coevo: 0.5 },
    normalny: { label: 'Normalny', startEp: 34, goal: 15, catMult: 1.0, predMult: 1.0, coevo: 1.0 },
    trudny:   { label: 'Trudny',   startEp: 35, goal: 17, catMult: 1.1, predMult: 1.0, coevo: 1.1 }
  };

  /*
   * Nisze ekologiczne z modyfikatorami względem wartości bazowych (woda) danej
   * tury. `requires` — cecha potrzebna, by zająć niszę. `land:true` — używa
   * jawnych wartości turn.land. `without` — kara dla linii bez danej cechy.
   */
  var NICHES = {
    woda:       { label: 'Woda',       icon: '🌊', requires: null,    foodMult: 1.0, predMult: 1.0, epBonus: 0 },
    przybrzeze: { label: 'Przybrzeże', icon: '🪸', requires: null,    foodMult: 1.2, predMult: 1.25, epBonus: 1 },
    lad:        { label: 'Ląd',        icon: '🏝️', requires: 'limbs', land: true,                    epBonus: 3,
      // Bez jaja lądowego rozród wciąż zależy od wody (jak u płazów).
      without: { trait: 'amniotic_egg', effects: { reproduction: -2 }, note: 'bez jaja lądowego rozród zależy od wody' } },
    powietrze:  { label: 'Powietrze',  icon: '🕊️', requires: 'flight', foodMult: 0.7, predMult: 0.3,  epBonus: 2 }
  };

  /*
   * Pojemność środowiska (nośność, K): ile osobników wyżywi nisza w danej turze.
   * K = `perFood[nisza]` × pokarm niszy w tej turze. Linie w tej samej niszy dzielą
   * pojemność (konkurencja). Rozród słabnie, gdy liczebność zbliża się do K
   * (wzrost logistyczny: × (1 − (N/K)^theta)), a nadmiar ponad K ginie z przegęszczenia (do `crowdMax`
   * populacji na turę, `crowdRate` za każde 100% nadwyżki). Nowa nisza = nowa
   * pojemność — to daje sens specjacji i migracji (radiacja adaptacyjna).
   */
  var CAPACITY = { perFood: { woda: 30, przybrzeze: 24, lad: 40, powietrze: 28 }, min: 60, theta: 3,
    crowdRate: 0.35, crowdMax: 0.35, warnAt: 0.8 };

  var CATEGORIES = {
    pokarm: 'Pokarm', lokomocja: 'Lokomocja', obrona: 'Obrona', zmysly: 'Zmysły',
    rozrod: 'Rozród', termoregulacja: 'Termoregulacja', uklad_nerwowy: 'Układ nerwowy'
  };
  var CATEGORY_ICONS = {
    pokarm: '🍽️', lokomocja: '🦿', obrona: '🛡️', zmysly: '👁️',
    rozrod: '🥚', termoregulacja: '🌡️', uklad_nerwowy: '🧠'
  };

  /*
   * `conditions` — kompromisy zależne od warunków (ZALOZENIA 4.2 i 4.3): efekty
   * doliczane tylko, gdy warunek jest spełniony. Warunki: `niches` (lista nisz),
   * `oxygenBelow` (tlen tury poniżej progu), `climate`. `note` — opis dla gracza.
   */
  var TRAITS = [
    // --- Pokarm ---
    { id: 'filter_feeding', name: 'Filtrowanie pokarmu', icon: '💧', category: 'pokarm', cost: 10, requires: [],
      effects: { feeding: 2 }, tradeoff: 'Skuteczne tylko w wodzie, gdzie jest plankton.',
      conditions: [{ niches: ['lad', 'powietrze'], effects: { feeding: -2 }, note: 'poza wodą brak planktonu' }],
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
      conditions: [{ niches: ['lad', 'powietrze'], effects: { mobility: -2 }, note: 'poza wodą płetwy nie pomagają' }],
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
      conditions: [{ oxygenBelow: 10, effects: { metabolism: 1 }, note: 'przy niskim tlenie oddychanie kosztuje więcej' }],
      desc: 'Zrogowaciała skóra chroni przed urazami i wysychaniem.' },
    { id: 'shell', name: 'Pancerz', icon: '🐢', category: 'obrona', cost: 16, requires: [],
      effects: { defense: 4, mobility: -1, metabolism: 2 }, tradeoff: 'Świetna obrona kosztem ruchu i energii.',
      desc: 'Twardy pancerz zniechęca większość drapieżników.' },
    { id: 'camouflage', name: 'Kamuflaż', icon: '🦎', category: 'obrona', cost: 14, requires: ['eyes'],
      effects: { defense: 3 }, tradeoff: 'Zawodzi, gdy trzeba się aktywnie poruszać.',
      conditions: [{ niches: ['powietrze'], effects: { defense: -3 }, note: 'w locie kamuflaż nie działa' }],
      desc: 'Ubarwienie zlewające się z otoczeniem to obrona bez kosztu ruchu.' },

    // --- Zmysły ---
    { id: 'eyes', name: 'Oczy', icon: '👁️', category: 'zmysly', cost: 12, requires: [],
      effects: { feeding: 1, defense: 1, metabolism: 1 }, tradeoff: 'Utrzymanie narządu wzroku kosztuje energię.',
      desc: 'Wzrok ułatwia zdobywanie pokarmu i wczesne wykrycie zagrożeń.' },
    { id: 'echolocation', name: 'Echolokacja', icon: '🔊', category: 'zmysly', cost: 18, requires: ['ganglia'], minEra: 1,
      effects: { feeding: 1, defense: 1, metabolism: 1 }, tradeoff: 'Działa tam, gdzie dźwięk dobrze się niesie: w wodzie i w locie.',
      conditions: [{ niches: ['lad'], effects: { feeding: -1, defense: -1 }, note: 'na lądzie echo gubi się wśród przeszkód' }],
      desc: 'Wysyłanie dźwięków i słuchanie echa pozwala „widzieć” w mętnej wodzie i w ciemności.' },
    { id: 'lateral_line', name: 'Linia boczna', icon: '〰️', category: 'zmysly', cost: 10, requires: [],
      effects: { defense: 1, mobility: 1 }, tradeoff: 'Działa wyłącznie w środowisku wodnym.',
      conditions: [{ niches: ['lad', 'powietrze'], effects: { defense: -1, mobility: -1 }, note: 'poza wodą nie wykrywa drgań' }],
      desc: 'Narząd czuciowy wykrywa drgania wody — ostrzega przed drapieżnikiem.' },

    // --- Rozród ---
    { id: 'many_eggs', name: 'Liczne jaja', icon: '🥚', category: 'rozrod', cost: 12, requires: [],
      effects: { reproduction: 3, metabolism: 1 }, tradeoff: 'Ilość zamiast jakości — produkcja wielu jaj kosztuje energię.',
      desc: 'Składanie wielu jaj zwiększa szansę, że część przetrwa.' },
    { id: 'amniotic_egg', name: 'Jajo lądowe', icon: '🐣', category: 'rozrod', cost: 20, requires: ['scales'],
      effects: { reproduction: 2, defense: 1, metabolism: 1 }, tradeoff: 'Uniezależnia rozród od wody, ale jajo z zapasami jest kosztowne.',
      desc: 'Jajo z błonami i skorupą można składać na lądzie.' },
    { id: 'parental_care', name: 'Opieka nad potomstwem', icon: '🐧', category: 'rozrod', cost: 24, requires: ['many_eggs'],
      effects: { reproduction: -1, defense: 2, intelligence: 1, metabolism: 1 }, tradeoff: 'Mniej potomstwa, lepiej chronionego.',
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
      effects: { intelligence: 2, defense: 1, metabolism: 1 }, tradeoff: 'Szybsze reakcje, lekko wyższy metabolizm.',
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
    { id: 'vocal_culture', name: 'Kultura akustyczna', icon: '🎶', category: 'uklad_nerwowy', cost: 38,
      requires: ['big_brain', 'social', 'echolocation'], path: 'intelligence', minEra: 2,
      effects: { intelligence: 3, feeding: 1, defense: 1, metabolism: 1 },
      tradeoff: 'Kulminacja drogi wodnej: język dźwięków przekazywany z pokolenia na pokolenie; działa w wodzie lub na brzegu.',
      desc: 'Złożone sygnały dźwiękowe, imiona i tradycje łowieckie przekazywane przez naukę — kultura bez rąk.' },
    { id: 'tool_use', name: 'Używanie narzędzi', icon: '🪓', category: 'uklad_nerwowy', cost: 34, requires: ['big_brain', 'social', 'grasping_hand'], path: 'intelligence', minEra: 2,
      effects: { intelligence: 3, feeding: 2, metabolism: 1 }, tradeoff: 'Kulminacja: wymaga mózgu, życia społecznego i ręki chwytnej.',
      desc: 'Wytwarzanie i używanie narzędzi to próg kultury i technologii.' }
  ];

  function land(food, predators) { return { food: food, predators: predators }; }

  /*
   * Katastrofy: `niche` ('all' albo nazwa niszy), `severity` (odsetek strat),
   * `nicheSeverity` (siła w konkretnej niszy), `survival` — selektywność
   * wymierania: cecha (`trait`) lub statystyka w zakresie (`stat`, `min`/`max`)
   * mnoży straty przez `mult`; `reason` trafia do raportu.
   */
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
          catastrophe: { name: 'Wymieranie ordowickie', niche: 'all', severity: 0.45, window: [1, 2],
            nicheSeverity: { przybrzeze: 0.3, lad: 0.05, powietrze: 0.05 }, knowledge: 'extinction',
            survival: [{ stat: 'mobility', min: 6, mult: 0.6, reason: 'wysoka mobilność — ucieczka do cieplejszych wód' }] } },
        { title: 'Sylur — stabilizacja', oxygen: 10, food: 10, predators: 7, climate: 'umiarkowanie', land: land(7, 3),
          note: 'Klimat łagodnieje; pierwsze rośliny wychodzą na ląd.' },
        { title: 'Dewon — wiek ryb', oxygen: 11, food: 9, predators: 10, climate: 'umiarkowanie', land: land(9, 3),
          note: 'Wielkie drapieżne ryby dominują w wodzie — na lądzie spokojniej. Pod koniec dewonu morza tracą tlen.',
          catastrophe: { name: 'Wymieranie dewońskie', niche: 'all', severity: 0.2, window: [4, 5],
            nicheSeverity: { przybrzeze: 0.25, lad: 0.05, powietrze: 0.05 }, knowledge: 'extinction',
            survival: [{ stat: 'metabolism', max: 6, mult: 0.7, reason: 'niski metabolizm — przetrwanie w niedotlenionej wodzie' }] } },
        { title: 'Dewon — brzeg lądu', oxygen: 11, food: 8, predators: 8, climate: 'cieplo', land: land(11, 3),
          note: 'Ląd stoi otworem: z kończynami warto migrować.' },
        { title: 'Karbon — bujne lasy', oxygen: 15, food: 10, predators: 7, climate: 'cieplo', land: land(14, 4),
          note: 'Wysoki tlen i bujna roślinność sprzyjają życiu na lądzie.' },
        { title: 'Perm — Wielkie Wymieranie', oxygen: 8, food: 7, predators: 9, climate: 'cieplo', land: land(8, 5),
          note: 'Erupcje trapów syberyjskich: gwałtowne ocieplenie, zakwaszone i niedotlenione oceany. ' +
            'Najmocniej cierpią morza, ale ląd także.',
          catastrophe: { name: 'Wymieranie permskie', niche: 'all', severity: 0.65,
            nicheSeverity: { przybrzeze: 0.5, lad: 0.35, powietrze: 0.35 },
            knowledge: 'extinction',
            survival: [{ stat: 'metabolism', max: 6, mult: 0.7, reason: 'niski metabolizm — mniejsze zapotrzebowanie na tlen' }] } }
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
          catastrophe: { name: 'Wymieranie kredowe (K–Pg)', niche: 'all', severity: 0.55,
            nicheSeverity: { woda: 0.3, przybrzeze: 0.4, powietrze: 0.45 }, knowledge: 'extinction',
            survival: [
              { stat: 'metabolism', max: 7, mult: 0.6, reason: 'mały, oszczędny organizm przetrwał zimę uderzeniową' },
              { trait: 'omnivory', mult: 0.75, reason: 'wszystkożerność — elastyczna dieta w czasie głodu' }] } }
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
          catastrophe: { name: 'Zlodowacenie plejstoceńskie', niche: 'all', severity: 0.4,
            nicheSeverity: { woda: 0.05, przybrzeze: 0.15, powietrze: 0.25 }, knowledge: 'extinction',
            survival: [
              { trait: 'insulation', mult: 0.6, reason: 'izolacja (futro/pióra) chroni przed mrozem' },
              { trait: 'social', mult: 0.8, reason: 'życie w grupie — wspólne przetrwanie zimy' }] } },
        { title: 'Współczesność — próg rozumności', oxygen: 11, food: 10, predators: 6, climate: 'umiarkowanie', land: land(11, 6),
          note: 'Ostatnia tura: czy Twoja linia przekroczy próg inteligencji?' }
      ]
    }
  ];

  /*
   * Kalendarz świata. Wymierania z `window` trafiają w jedną z podanych tur ery
   * (tury zamieniają się miejscami w obrębie jednego okresu geologicznego).
   * Dodatkowo w każdej erze `REGIONAL.perEra` katastrof regionalnych w losowych
   * turach — uderzają w jedną niszę. Gra zapowiada katastrofę turę wcześniej.
   */
  var REGIONAL = { perEra: 1 };
  var REGIONAL_DISASTERS = [
    { id: 'anoxia', name: 'Beztlenowe wody', niche: 'woda', severity: 0.25, env: { oxygen: -2 }, knowledge: 'extinction',
      note: 'Martwe strefy bez tlenu rozlewają się po morzu.',
      survival: [{ stat: 'metabolism', max: 5, mult: 0.6, reason: 'niski metabolizm — mniejsze zapotrzebowanie na tlen' }] },
    { id: 'redtide', name: 'Toksyczny zakwit glonów', niche: 'przybrzeze', severity: 0.3, knowledge: 'toxins',
      note: 'Trujące glony zabarwiają wody przybrzeżne na czerwono.',
      survival: [{ stat: 'mobility', min: 6, mult: 0.6, reason: 'wysoka mobilność — ucieczka z zatrutych wód' }] },
    { id: 'megadrought', name: 'Megasusza', niche: 'lad', severity: 0.3, env: { landFood: -3 }, knowledge: 'extinction',
      note: 'Wieloletnia susza wysusza wnętrze kontynentu.',
      survival: [{ trait: 'amniotic_egg', mult: 0.7, reason: 'jajo lądowe nie wysycha' },
        { stat: 'metabolism', max: 5, mult: 0.8, reason: 'oszczędny metabolizm' }] },
    { id: 'wildfire', name: 'Wielkie pożary', niche: 'lad', severity: 0.25, minEra: 0, knowledge: 'extinction',
      note: 'Suche lasy płoną na ogromnych obszarach.',
      survival: [{ stat: 'mobility', min: 6, mult: 0.6, reason: 'szybka ucieczka przed ogniem' }] },
    { id: 'storms', name: 'Sezon huraganów', niche: 'powietrze', severity: 0.3, knowledge: 'extinction',
      note: 'Gwałtowne burze niszczą gniazda i strącają latające zwierzęta.',
      survival: [{ stat: 'defense', min: 6, mult: 0.7, reason: 'mocna budowa znosi wiatr' }] },
    { id: 'impact', name: 'Uderzenie małego meteorytu', niche: 'all', severity: 0.12, knowledge: 'extinction',
      note: 'Niewielki meteoryt wzbija pył i na chwilę przyciemnia niebo.',
      survival: [{ stat: 'metabolism', max: 6, mult: 0.7, reason: 'oszczędny metabolizm przetrwał ciemne miesiące' }] }
  ];

  /*
   * Cele ery: w każdej erze losowane `ERA_GOALS_PER_ERA` celów pobocznych. Cel
   * spełniony w dowolnej turze ery daje nagrodę EP od razu; `atEnd` — sprawdzany
   * dopiero na koniec ery. Typy: niche, lineages, population, stat, reserves,
   * variation, niches, catLoss (straty w katastrofie ery ≤ max), noStarvation.
   */
  var ERA_GOALS_PER_ERA = 2;
  var ERA_GOALS = [
    { id: 'land', label: 'Wyjdź na ląd', desc: 'Któraś linia zajmuje niszę lądową.', type: 'niche', niche: 'lad', eras: [0, 1], reward: 10 },
    { id: 'two_lines', label: 'Dwie gałęzie', desc: 'Na koniec ery żyją co najmniej 2 linie.', type: 'lineages', min: 2, atEnd: true, eras: [0, 1, 2], reward: 8 },
    { id: 'abundance', label: 'Liczna populacja', desc: 'Łączna populacja sięga 300 osobników.', type: 'population', min: 300, eras: [0, 1, 2], reward: 8 },
    { id: 'armor', label: 'Twierdza', desc: 'Któraś linia ma obronę co najmniej 8.', type: 'stat', stat: 'defense', min: 8, eras: [0, 1], reward: 8 },
    { id: 'fat', label: 'Tłuste lata', desc: 'Któraś linia gromadzi co najmniej 10 ⚡ rezerw.', type: 'reserves', min: 10, eras: [0, 1, 2], reward: 6 },
    { id: 'variation', label: 'Bogata pula genów', desc: 'Któraś linia ma co najmniej 20 🧬 zmienności.', type: 'variation', min: 20, eras: [0, 1, 2], reward: 8 },
    { id: 'radiation', label: 'Radiacja', desc: 'Linie zajmują jednocześnie co najmniej 3 nisze.', type: 'niches', min: 3, eras: [1, 2], reward: 12 },
    { id: 'sky', label: 'Podbój przestworzy', desc: 'Któraś linia zajmuje niszę powietrzną.', type: 'niche', niche: 'powietrze', eras: [1, 2], reward: 12 },
    { id: 'smart', label: 'Spryt', desc: 'Któraś linia osiąga inteligencję 8.', type: 'stat', stat: 'intelligence', min: 8, eras: [1], reward: 10 },
    { id: 'weather', label: 'Przetrwać kataklizm', desc: 'W katastrofie tej ery gatunek traci najwyżej 25% populacji.', type: 'catLoss', max: 0.25, eras: [0, 1, 2], reward: 10 },
    { id: 'fed', label: 'Syta era', desc: 'Przez całą erę żadna linia nie traci osobników z głodu.', type: 'noStarvation', atEnd: true, eras: [0, 1, 2], reward: 8 }
  ];

  /* Ocena „czy zwycięstwo jest jeszcze możliwe” — celowo hojna, by nie ogłosić
     przegranej za wcześnie: `growth` — optymistyczny przyrost populacji na turę,
     `epPerTurn` — optymistyczny przychód EP na turę. */
  var OUTLOOK = { growth: 0.45, epPerTurn: 40 };

  // Wynik partii (do porównywania udanych gier) i mnożnik trudności.
  var SCORE = { won: 500, survived: 200, perIntelligence: 10, popDiv: 3, popMax: 200, perGoal: 25,
    perNiche: 20, perTurnLeft: 40, perAchievement: 15, diffMult: { latwy: 0.75, normalny: 1, trudny: 1.3 } };

  // Osiągnięcia (zapisywane między partiami w przeglądarce).
  var ACHIEVEMENTS = [
    { id: 'first_win', icon: '🏆', label: 'Iskra rozumu', desc: 'Wygraj partię.' },
    { id: 'tools_win', icon: '🪓', label: 'Kultura narzędziowa', desc: 'Wygraj drogą narzędzi.' },
    { id: 'sound_win', icon: '🐬', label: 'Pieśń oceanu', desc: 'Wygraj drogą kultury akustycznej.' },
    { id: 'hard_win', icon: '⛰️', label: 'Twarda szkoła', desc: 'Wygraj na poziomie trudnym.' },
    { id: 'early_win', icon: '⏩', label: 'Przyspieszona ewolucja', desc: 'Wygraj co najmniej 2 tury przed końcem.' },
    { id: 'phoenix', icon: '🔥', label: 'Z popiołów', desc: 'Wygraj, choć populacja spadła kiedyś poniżej 30.' },
    { id: 'radiation', icon: '🌳', label: 'Radiacja adaptacyjna', desc: 'Miej linie jednocześnie we wszystkich 4 niszach.' },
    { id: 'sky', icon: '🕊️', label: 'Przestworza', desc: 'Zajmij niszę powietrzną.' },
    { id: 'perm', icon: '🌋', label: 'Wielkie Umieranie', desc: 'Przejdź wymieranie permskie, tracąc mniej niż 30% populacji.' },
    { id: 'gambler', icon: '🎲', label: 'Szczęście sprzyja odważnym', desc: 'Wygraj 3 ryzyka w jednej partii.' },
    { id: 'goals', icon: '📜', label: 'Kronikarz er', desc: 'Spełnij wszystkie cele er w partii.' },
    { id: 'abundance', icon: '🐟', label: 'Obfitość', desc: 'Łączna populacja sięga 600 osobników.' },
    { id: 'codex', icon: '📚', label: 'Encyklopedysta', desc: 'Odkryj co najmniej 25 pojęć w Kodeksie.' }
  ];

  // Scenariusze lekcyjne (ZALOZENIA sekcja 8/6).
  var SCENARIOS = [
    { id: 'full', name: 'Pełna ewolucja', icon: '🧬', difficulty: 'normalny', startEra: 0,
      intro: 'Klasyczna gra od prostego życia w morzu aż do gatunku rozumnego, przez trzy ery.' },
    { id: 'land', name: 'Podbój lądu', icon: '🏝️', difficulty: 'latwy', startEra: 0,
      intro: 'Łagodniejsze wyzwanie ze szczególnym naciskiem na wyjście na ląd i rozwój na nim.' },
    { id: 'ice', name: 'Epoki lodowcowe', icon: '❄️', difficulty: 'trudny', startEra: 2,
      startEp: 73, goal: 14, startNiche: 'lad', startTraits: ['fins', 'scales', 'endothermy', 'insulation', 'ganglia', 'limbs'],
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
      fossil: 'Wymieranie permskie (~252 mln lat temu), wywołane erupcjami trapów syberyjskich i ociepleniem, ' +
        'zgładziło ok. 90% gatunków morskich i ok. 70% kręgowców lądowych.' },
    reserves: { icon: '🌰', title: 'Zapasy energii',
      body: 'Zwierzęta magazynują nadwyżki energii — w tłuszczu, wątrobie, a nawet w zakopanych zapasach. ' +
        'Rezerwy pozwalają przetrwać chude okresy, ale energia odłożona na zapas nie idzie w potomstwo.',
      fossil: 'Niedźwiedzie przed snem zimowym przybierają nawet 30% masy, by przetrwać miesiące bez jedzenia.' },
    rk: { icon: '🐸', title: 'Strategie r i K',
      body: 'Strategia r to dużo potomstwa bez opieki — szybki wzrost tam, gdzie warunki są zmienne. ' +
        'Strategia K to mało potomstwa, ale dobrze chronionego — przewaga w stabilnym, zatłoczonym świecie. ' +
        'Większość gatunków leży gdzieś pomiędzy.' },
    variation: { icon: '🧬', title: 'Zmienność — paliwo doboru',
      body: 'Dobór naturalny może działać tylko na różnice między osobnikami. Im większa zmienność genetyczna, ' +
        'tym większa szansa, że część populacji przetrwa nową chorobę czy zmianę klimatu. Silny dobór ' +
        'zużywa zmienność — „odsiewa” warianty.' },
    drift: { icon: '🎲', title: 'Dryf genetyczny i wąskie gardło',
      body: 'W małej populacji o losie wariantów genów decyduje przypadek, a nie dobór — to dryf genetyczny. ' +
        'Gdy populacja gwałtownie maleje (wąskie gardło), traci większość zmienności na długo.',
      fossil: 'Gepardy przeszły wąskie gardło ok. 10 tys. lat temu — do dziś są genetycznie niemal identyczne.' },
    founder: { icon: '🛶', title: 'Efekt założyciela i specjacja przez izolację',
      body: 'Nową populację zakłada czasem garstka osobników, np. na wyspie. Niesie tylko ułamek zmienności ' +
        'gatunku, a izolacja pozwala jej ewoluować osobno — tak powstają nowe gatunki (specjacja allopatryczna).',
      fossil: 'Galapagos i Hawaje zasiedliły nieliczne osobniki, z których wyewoluowały dziesiątki nowych gatunków.' },
    boom: { icon: '📈', title: 'Boom i załamanie',
      body: 'Obfitość pokarmu pozwala populacji gwałtownie urosnąć, ale gdy zasoby się kończą, liczebność ' +
        'spada — często poniżej stanu sprzed boomu. Tak działają cykle populacyjne.',
      fossil: 'Populacje zajęcy i rysi w Kanadzie od stuleci wahają się w ok. 10-letnim cyklu.' },
    capacity: { icon: '📏', title: 'Pojemność środowiska',
      body: 'Każde środowisko wyżywi tylko określoną liczbę osobników — to jego pojemność (nośność). ' +
        'Mała populacja w bogatym środowisku rośnie szybko, ale im bliżej granicy, tym wolniej; nadmiar ginie z głodu i ' +
        'przegęszczenia. Wzrost przyjmuje kształt litery S (wzrost logistyczny).' },
    competition: { icon: '⚔️', title: 'Konkurencja',
      body: 'Gatunki korzystające z tych samych zasobów konkurują ze sobą — dzielą tę samą pojemność środowiska. ' +
        'Dwa gatunki o identycznej niszy nie mogą długo współistnieć (zasada Gausego): jeden wypiera drugi albo ' +
        'ich nisze się rozchodzą.' },
    radiation: { icon: '🌳', title: 'Radiacja adaptacyjna',
      body: 'Gdy przodek trafia do świata pełnego wolnych nisz, jego potomkowie szybko rozdzielają się na wiele ' +
        'gatunków — każdy zajmuje inną niszę i ma własne zasoby. W nowym miejscu często brakuje też ' +
        'wyspecjalizowanych wrogów, co ułatwia start.',
      fossil: 'Po wymarciu dinozaurów ssaki w kilka milionów lat rozdzieliły się na drapieżniki, roślinożerców, nietoperze i walenie.' },
    echolocation: { icon: '🔊', title: 'Echolokacja',
      body: 'Nietoperze i walenie wysyłają dźwięki i z echa odczytują kształt, odległość i ruch przeszkód oraz zdobyczy. ' +
        'Ta sama umiejętność rozwinęła się niezależnie w dwóch odległych grupach — to przykład konwergencji.',
      fossil: 'Już u wczesnych waleni sprzed ok. 30 mln lat budowa ucha wewnętrznego zdradza echolokację.' },
    culture: { icon: '🎶', title: 'Kultura u zwierząt',
      body: 'Kultura to zachowania przekazywane przez naukę, a nie geny. Delfiny mają „imiona” — indywidualne gwizdy, ' +
        'a humbaki uczą się od siebie pieśni, które zmieniają się z roku na rok. Rozum nie potrzebuje rąk.' },
    toxins: { icon: '🍄', title: 'Obrona chemiczna',
      body: 'Rośliny, grzyby i wiele zwierząt bronią się truciznami. Zwierzęta, które nauczą się je rozpoznawać ' +
        'lub unieszkodliwiać, zyskują dostęp do pokarmu niedostępnego dla innych.',
      fossil: 'Koale trawią trujące liście eukaliptusa dzięki wyspecjalizowanej wątrobie i bakteriom jelitowym.' },
    displacement: { icon: '↔️', title: 'Przemieszczenie cech',
      body: 'Gdy dwa gatunki konkurują o te same zasoby, dobór premiuje osobniki, które korzystają z czegoś innego. ' +
        'Z czasem ich cechy się rozchodzą i gatunki mogą żyć obok siebie.',
      fossil: 'Na wyspach, gdzie dwa gatunki zięb Darwina żyją razem, różnią się dziobami bardziej niż tam, gdzie żyją osobno.' },
    hybridization: { icon: '🧬', title: 'Hybrydyzacja',
      body: 'Krzyżowanie się blisko spokrewnionych populacji może wnieść nowe warianty genów, ale mieszańce ' +
        'bywają słabiej płodne. To jedna z barier, które utrwalają podział na gatunki.',
      fossil: 'Współcześni ludzie spoza Afryki mają ok. 1–2% DNA neandertalczyków.' },
    sexual_selection: { icon: '🦚', title: 'Dobór płciowy',
      body: 'Cechy, które pomagają zdobyć partnera — ozdoby, śpiewy, tańce — mogą się szerzyć, nawet jeśli ' +
        'utrudniają przetrwanie. Okazały ogon przyciąga samice, ale też drapieżniki.',
      fossil: 'Ogon pawia sprawiał kłopot samemu Darwinowi — wyjaśnił go dopiero doborem płciowym.' },
    symbiosis: { icon: '🦠', title: 'Symbioza',
      body: 'Wiele zwierząt żyje w ścisłym związku z mikroorganizmami. Bakterie jelitowe trawią to, czego gospodarz ' +
        'sam nie strawi — ale granica między symbiontem a pasożytem bywa cienka.',
      fossil: 'Mitochondria w naszych komórkach to potomkowie bakterii, które ok. 2 mld lat temu weszły w symbiozę.' },
    dormancy: { icon: '💤', title: 'Odrętwienie i hibernacja',
      body: 'W chudych okresach wiele zwierząt obniża metabolizm i zapada w odrętwienie. Oszczędza to energię, ' +
        'ale tylko jeśli zapasy wystarczą do końca złego sezonu.',
      fossil: 'Lystrozaur mógł przetrwać wymieranie permskie m.in. dzięki okresom odrętwienia.' },
    milestone: { icon: '🏛️', title: 'Kamienie milowe ewolucji',
      body: 'Każda era premiuje inne adaptacje: szkielet i kończyny w paleozoiku, jaja lądowe i ' +
        'stałocieplność w mezozoiku, mózg i narzędzia w kenozoiku.' }
  };

  return {
    BASE_STATS: BASE_STATS, START_POPULATION: START_POPULATION, MIN_VIABLE_POP: MIN_VIABLE_POP,
    SPECIATION_COST: SPECIATION_COST, SPECIATION_COST_STEP: SPECIATION_COST_STEP, SPECIATION_SHARE: SPECIATION_SHARE, MIN_SPECIATION_POP: MIN_SPECIATION_POP,
    MIGRATION: MIGRATION, CAPACITY: CAPACITY, NEW_LINEAGE: NEW_LINEAGE, RESERVES: RESERVES, VARIATION: VARIATION, STRATEGIES: STRATEGIES, BEHAVIORS: BEHAVIORS,
    CHOICE_CHANCE: CHOICE_CHANCE, CHOICE_EVENTS: CHOICE_EVENTS, WIN_TRAIT: WIN_TRAIT, WIN_PATHS: WIN_PATHS,
    REGIONAL: REGIONAL, REGIONAL_DISASTERS: REGIONAL_DISASTERS, ERA_GOALS: ERA_GOALS, ERA_GOALS_PER_ERA: ERA_GOALS_PER_ERA,
    OUTLOOK: OUTLOOK, SCORE: SCORE, ACHIEVEMENTS: ACHIEVEMENTS, WIN_MIN_POP: WIN_MIN_POP, EP_RULES: EP_RULES, ENV_VARIATION: ENV_VARIATION,
    DIFFICULTIES: DIFFICULTIES, NICHES: NICHES, CATEGORIES: CATEGORIES, CATEGORY_ICONS: CATEGORY_ICONS,
    TRAITS: TRAITS, ERAS: ERAS, SCENARIOS: SCENARIOS, KNOWLEDGE: KNOWLEDGE,
    // Zgodność wsteczna:
    INTELLIGENCE_GOAL: DIFFICULTIES.normalny.goal, START_EP: DIFFICULTIES.normalny.startEp
  };
});
