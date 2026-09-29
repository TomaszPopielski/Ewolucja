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


  /*
   * Dieta i sieć troficzna. Każda linia ma dietę, a ta wyznacza, z czego żyje:
   * - roślinożerca / filtrator — żyje z producentów (rośliny, glony, plankton); pojemność niszy
   *   = pojemność z `CAPACITY` × `plants` (jak dużo roślin jest w danej niszy i erze);
   * - mięsożerca (wymaga szczęk) — żyje ze zdobyczy: pojemność = `ambientPrey` × pojemność niszy
   *   + `preyEdible` × biomasa roślinożerców w niszy (rywale i własne linie gracza). Mięso jest
   *   kaloryczne (`meatBonus`), ale drapieżników — także rywali — może być tylko tyle, ile zdobyczy;
   * - wszystkożerca (wymaga wszystkożerności) — pojemność to mieszanka obu źródeł: odporna na
   *   załamanie jednego z nich, ale nigdy najlepsza.
   * Własne linie gracza tworzą sieć: mięsożerna gałąź zjada roślinożerną (rośnie na niej, ale
   * podnosi jej presję drapieżników do `pressureMax`). Zmiana diety kosztuje ⚡ i osłabia żerowanie
   * w tej turze (`switchFood`).
   */
  var DIETS = {
    roslinozerca: { label: 'Roślinożerca', icon: '🌿', art: 'trait:filter_feeding', requires: null,
      desc: 'Żyje z producentów: roślin, glonów i planktonu. Najwięcej osobników, ale wyścig o rośliny z konkurentami.' },
    miesozerca: { label: 'Mięsożerca', icon: '🥩', art: 'trait:jaws', requires: 'jaws',
      desc: 'Żyje ze zdobyczy: kaloryczne żerowanie, ale mieści się mniej osobników — piramida troficzna. Zdobyczą są roślinożercy (rywale i Twoje własne linie).' },
    wszystkozerca: { label: 'Wszystkożerca', icon: '🍖', art: 'trait:omnivory', requires: 'omnivory',
      desc: 'Je i rośliny, i zwierzęta. Nie zależy od jednego źródła, ale w żadnym nie jest najlepszy.' }
  };
  var TROPHIC = {
    // Ile roślin (producentów) daje nisza w danej erze względem bazowej pojemności.
    plants: { woda: [1, 1, 1], przybrzeze: [1, 1, 1], lad: [1, 1, 1.05], powietrze: [0.8, 0.8, 0.8] },
    // Pojemność drapieżników bez żadnych roślinożerców, jako ułamek pojemności niszy (fauna „w tle”).
    ambientPrey: { woda: [0.55, 0.6, 0.6], przybrzeze: [0.55, 0.55, 0.55], lad: [0.4, 0.55, 0.6], powietrze: [0.6, 0.6, 0.6] },
    preyEdible: 0.6,      // jaka część biomasy roślinożerców to zdobycz
    meatBonus: 1.2,      // kaloryczność mięsa: mnożnik żerowania mięsożercy
    predShield: { miesozerca: 1, wszystkozerca: 0.4 },  // wyższy poziom sieci = mniej wrogów (odejmowane od presji)
    omniMix: 0.6,         // pojemność wszystkożercy: 0,6 lepszego źródła + 0,4 gorszego
    pressurePer: 3, pressureMax: 2,   // presja własnego mięsożercy na roślinożerne linie gracza
    switchCost: 4, switchFood: 0.75   // koszt ⚡ zmiany diety i żerowanie w turze zmiany
  };

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
        { id: 'colonize', label: 'Wyślij kolonistów', effects: { found: 0.25 }, knowledge: 'founder', echo: { id: 'island_echo', after: 3 },
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
        { id: 'arms', label: 'Wyścig zbrojeń', effects: { stats: { defense: 1 }, predatorLevel: 1.5 }, knowledge: 'coevolution', echo: { id: 'arms_echo', after: 2 },
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
        { id: 'resist', label: 'Postaw na odporność', cost: { variation: 4 }, knowledge: 'variation', echo: { id: 'resist_echo', after: 3 },
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
    { id: 'rival', name: 'Konkurent w niszy', icon: '⚔️', art: 'know:competition', needsRival: true,
      desc: 'Inny gatunek zaczyna korzystać z tych samych zasobów co linia.',
      options: [
        { id: 'fight', label: 'Wypieraj konkurenta',
          gamble: { chance: 0.35, stat: 'defense', per: 0.05,
            win: { effects: { rivalHit: 0.5 }, turnMod: { foodBonus: 2 }, nextMod: { foodBonus: 2 }, knowledge: 'competition',
              text: 'Konkurent wyparty — jego populacja spadła o połowę, a pokarm +2 w tej i w następnej turze.' },
            lose: { effects: { popLoss: 0.1 }, turnMod: { foodBonus: -2 }, knowledge: 'competition',
              text: 'Starcie przegrane — zginęło 10% populacji, a konkurent zabrał część pokarmu (−2).' } },
          desc: 'Ryzyko (szansa rośnie z obroną). Sukces: pokarm +2 przez dwie tury. Porażka: ginie 10% populacji i pokarm −2.' },
        { id: 'shift', label: 'Zmień dietę', cost: { variation: 4 }, effects: { rivalHit: 0.3 }, knowledge: 'displacement', echo: { id: 'shift_echo', after: 2 },
          desc: 'Kosztuje 4 🧬 — linia przesuwa się na inny pokarm (przemieszczenie cech) i unika konkurencji.' },
        { id: 'share', label: 'Dziel się zasobami', default: true, turnMod: { foodBonus: -2 }, nextMod: { foodBonus: -1 },
          desc: 'Pokarm −2 w tej turze i −1 w następnej.' }
      ] },
    { id: 'volcano', name: 'Erupcja wulkanu', icon: '🌋', art: 'ui:meteor',
      desc: 'Nieopodal wybucha wulkan. Popioły zasypią okolicę, ale potem użyźnią glebę i wodę.',
      options: [
        { id: 'flee', label: 'Uciekaj z zasięgu', cost: { reserves: 3 }, desc: 'Kosztuje 3 ⚡ — linia bezpiecznie omija erupcję.' },
        { id: 'stay', label: 'Przeczekaj na miejscu', default: true, echo: { id: 'ash_echo', after: 2 },
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
      ] },
    /* Echa decyzji: karty `chain` nie wchodzą do losowej puli. Wracają po `echo.after`
       turach jako skutek wcześniejszego wyboru, dla tej samej linii (lub jej kolonii). */
    { id: 'island_echo', chain: true, name: 'Wyspiarze się zmieniają', icon: '🏝️', art: 'choice:island',
      desc: 'Izolowana kolonia żyje osobno od kilku pokoleń. Małe populacje na wyspach ewoluują po swojemu: drobnieją, tracą czujność, zdobywają nietypowe cechy.',
      options: [
        { id: 'isolate', label: 'Zostaw ich w izolacji', default: true, effects: { stats: { reproduction: 1 }, variation: 3 }, knowledge: 'founder',
          desc: '+1 rozrodu na stałe i +3 🧬 — izolacja utrwala odrębne cechy (specjacja allopatryczna).' },
        { id: 'contact', label: 'Nawiąż kontakt z lądem', effects: { variation: 6 }, knowledge: 'hybridization',
          desc: '+6 🧬 — napływ nowych genów odświeża zmienność, ale kolonia nie wyodrębnia się.' }
      ] },
    { id: 'arms_echo', chain: true, name: 'Drapieżniki dogoniły obronę', icon: '🦈', art: 'know:predation',
      desc: 'Twoja wcześniejsza rozbudowa obrony zaowocowała: drapieżniki wyewoluowały skuteczniejsze sposoby polowania. Jak odpowiesz?',
      options: [
        { id: 'escalate', label: 'Podkręć obronę jeszcze bardziej', effects: { stats: { defense: 1 }, predatorLevel: 1 }, knowledge: 'coevolution',
          desc: '+1 obrony na stałe, ale koewolucja +1 (Hipoteza Czerwonej Królowej).' },
        { id: 'evade', label: 'Zmień taktykę: unikaj', cost: { reserves: 3 }, effects: { predatorLevel: -1.5 },
          desc: 'Kosztuje 3 ⚡ — linia zmienia porę i miejsce żerowania; presja drapieżników −1,5.' },
        { id: 'stand', label: 'Nic nie zmieniaj', default: true, turnMod: { predBonus: 2 },
          desc: 'W tej turze presja drapieżników +2.' }
      ] },
    { id: 'resist_echo', chain: true, name: 'Odporne pokolenie', icon: '🦠', art: 'choice:disease',
      desc: 'Osobniki odporne na chorobę przeżyły i przekazały swoje geny. Choroba wróciła, ale w populacji jest teraz wiele odpornych linii.',
      options: [
        { id: 'select', label: 'Wesprzyj odpornych', default: true, effects: { variation: 4, stats: { defense: 1 } }, knowledge: 'variation',
          desc: '+4 🧬 i +1 obrony — populacja utrwala odporność.' },
        { id: 'mix', label: 'Zachowaj różnorodność', effects: { variation: 7 },
          desc: '+7 🧬 — ryzykujesz tylko lekką chorobę, ale zachowujesz szeroką pulę genów.' }
      ] },
    { id: 'shift_echo', chain: true, name: 'Nowa dieta się przyjmuje', icon: '🍽️', art: 'know:displacement',
      desc: 'Zmiana pokarmu przyniosła skutek: część linii wyspecjalizowała się w nowym źródle. Można to utrwalić lub wrócić do starej diety.',
      options: [
        { id: 'specialize', label: 'Wyspecjalizuj się', effects: { stats: { feeding: 1 } }, knowledge: 'displacement',
          desc: '+1 odżywiania na stałe — sprawniej korzystasz z nowego pokarmu.' },
        { id: 'generalist', label: 'Zostań wszystkożerny', default: true, effects: { reserves: 3, variation: 2 },
          desc: '+3 ⚡ i +2 🧬 — elastyczna dieta daje zapas i zmienność.' }
      ] },
    { id: 'ash_echo', chain: true, name: 'Wulkaniczna gleba', icon: '🌋', art: 'ui:sprout',
      desc: 'Popioły po erupcji rozłożyły się w żyzną glebę. Roślinność wraca bujniej niż przedtem.',
      options: [
        { id: 'bloom', label: 'Wykorzystaj obfitość', default: true, turnMod: { foodBonus: 3, birthMult: 1.3 }, nextMod: { foodBonus: -1 },
          desc: 'Pokarm +3 i rozród ×1,3 w tej turze, w następnej pokarm −1.' },
        { id: 'store', label: 'Odłóż zapasy', effects: { reserves: 5 }, desc: '+5 ⚡ od razu.' }
      ] }
  ];


  /*
   * Rywale (inne gatunki tej ery): zajmują nisze, w których żyje gracz, i dzielą z nim
   * pojemność. Rosną do udziału `share` pojemności niszy (silniejszy rywal — większego),
   * ale słabną, gdy gracz zapełnia niszę (wypieranie konkurencyjne). Katastrofy ich też
   * uderzają. Rywal-drapieżnik (`role: 'predator'`) dodatkowo zwiększa presję drapieżników w niszy,
   * a konkurent (bez roli) tylko zabiera pokarm. Nowy rywal pojawia się z szansą `spawnChance` na turę, jeśli jest ich mniej niż `max`.
   */
  var RIVAL = { predPerStrength: 0.2, predMax: 1.8, spawnChance: 0.22, max: 2, firstTurn: 3, startShare: 0.14, baseShare: 0.2, perStrength: 0.035, maxShare: 0.42, playerPressure: 0.7,
    follow: 0.3, strengthGain: 0.35, strengthMax: 8, catMult: 0.85, extinctBelow: 5 };
  var RIVALS = [
    { id: 'eurypterid', role: 'predator', name: 'Skorpiony morskie', icon: '🦂', minEra: 0, maxEra: 0, niches: ['woda', 'przybrzeze'],
      desc: 'Drapieżne eurypteryty — nawet dwumetrowe stawonogi płytkich mórz paleozoiku.' },
    { id: 'placoderm', role: 'predator', name: 'Ryby pancerne', icon: '🐟', minEra: 0, maxEra: 0, niches: ['woda'],
      desc: 'Pancerne ryby (plakodermy) z potężnymi szczękami, panujące w dewonie.' },
    { id: 'arthropleura', name: 'Wielkie wije', icon: '🐛', minEra: 0, maxEra: 0, niches: ['lad'],
      desc: 'Artropleury — metrowe stawonogi, które zasiedliły lądowe lasy karbonu.' },
    { id: 'ammonite', name: 'Amonity', icon: '🐚', minEra: 1, maxEra: 1, niches: ['woda', 'przybrzeze'],
      desc: 'Głowonogi ze spiralnymi muszlami, jedne z najliczniejszych zwierząt mezozoicznych mórz.' },
    { id: 'ichthyosaur', role: 'predator', name: 'Ichtiozaury', icon: '🐬', minEra: 1, maxEra: 1, niches: ['woda'],
      desc: 'Morskie gady o kształcie delfinów, szybkie łowce otwartej wody.' },
    { id: 'dinosaur', role: 'predator', name: 'Dinozaury', icon: '🦖', minEra: 1, maxEra: 1, niches: ['lad'],
      desc: 'Dominujące zwierzęta lądowe przez ponad 150 mln lat.' },
    { id: 'pterosaur', role: 'predator', name: 'Pterozaury', icon: '🦅', minEra: 1, maxEra: 1, niches: ['powietrze', 'przybrzeze'],
      desc: 'Latające gady, pierwsze kręgowce, które opanowały niebo.' },
    { id: 'shark', role: 'predator', name: 'Wielkie rekiny', icon: '🦈', minEra: 2, maxEra: 2, niches: ['woda', 'przybrzeze'],
      desc: 'Rekiny — jedne z najstarszych i najskuteczniejszych drapieżników mórz.' },
    { id: 'terror_bird', role: 'predator', name: 'Ptaki drapieżne', icon: '🦤', minEra: 2, maxEra: 2, niches: ['lad'],
      desc: 'Nielotne ptaki-łowcy kenozoiku, przez miliony lat szczyt łańcucha pokarmowego.' },
    { id: 'bats', name: 'Nietoperze', icon: '🦇', minEra: 2, maxEra: 2, niches: ['powietrze'],
      desc: 'Jedyne latające ssaki; zajmują nocną niszę w powietrzu.' },
    { id: 'ungulates', name: 'Kopytne', icon: '🦌', minEra: 2, maxEra: 2, niches: ['lad'],
      desc: 'Stada roślinożerców stepów i lasów kenozoiku.' }
  ];

  /*
   * Zakończenia i epilog. Zwycięstwo kończy się „Antropocenem”: co robi rozumny gatunek
   * ze światem. Przetrwanie dostaje tytuł zależny od stylu gry (`legacy`), by nie było
   * jedną, szarą porażką.
   */
  var ENDINGS = {
    anthropocene: {
      title: 'Epilog: Antropocen',
      intro: {
        tools: 'Twój gatunek wykuwa narzędzia, oswaja ogień i przekazuje umiejętności następnym pokoleniom.',
        sound: 'Twój gatunek porozumiewa się pieśniami i imionami, a wiedza wędruje z pokolenia na pokolenie przez naukę.'
      },
      // Skutki dla świata — dobierane z przebiegu partii.
      impacts: [
        { when: 'rivals', text: 'Po drodze wyparłeś konkurentów z ich nisz. Rozum rzadko jest łagodny dla sąsiadów.' },
        { when: 'lost_lines', text: 'Wiele gałęzi Twojej rodziny wymarło. W historii życia to norma: większość gatunków, które kiedykolwiek żyły, już nie istnieje.' },
        { when: 'radiation', text: 'Twoje potomstwo rozeszło się po wielu niszach, a dziś rozum zmienia je wszystkie.' },
        { when: 'default', text: 'Czas geologiczny mierzy się milionami lat. Rozumny gatunek potrafi zmienić klimat i obieg pierwiastków w kilka stuleci.' }
      ],
      outro: 'Antropocen to proponowana nazwa epoki, w której działalność jednego gatunku zmienia całą planetę. ' +
        'Tempo dzisiejszych wymierań jest wielokrotnie wyższe niż średnia w historii Ziemi. ' +
        'Rozum daje moc — ale to, jak z niej korzystać, ewolucja Ci nie podpowie.'
    },
    legacy: [
      { id: 'sky', when: 'sky', title: 'Władcy przestworzy', text: 'Twoja linia opanowała powietrze — niszę, do której prowadzi wiele bardzo kosztownych adaptacji.' },
      { id: 'radiation', when: 'radiation', title: 'Wielka radiacja', text: 'Twój gatunek rozdzielił się na wiele linii w różnych niszach — tak działała radiacja adaptacyjna po wielkich wymieraniach.' },
      { id: 'legion', when: 'legion', title: 'Gatunek-legion', text: 'Twoja populacja osiągnęła ogromną liczebność — sukces liczony w osobnikach, choć bez rozumu.' },
      { id: 'phoenix', when: 'phoenix', title: 'Wąskie gardło i powrót', text: 'Populacja spadła niemal do zera, a mimo to gatunek przetrwał. Tak ocalały m.in. gepardy i żubry.' },
      { id: 'quiet', when: 'default', title: 'Żywa skamielina', text: 'Twój gatunek trwa bez wielkich zmian — jak rekiny, krokodyle czy latimeria, żywe skamieliny, którym wystarczy dobrze dobrana nisza.' }
    ]
  };


  /*
   * Prolog: prekambr (4,5 mld – 541 mln lat temu), zanim ruszy właściwa gra. Trzy wybory
   * zamiast tur — każdy to zwrot w historii życia z drobnymi, wyważonymi skutkami na start
   * (`effects`: stats, reserves, variation, ep) i kartą wiedzy (`knowledge`). Nie da się
   * wybrać źle: każda opcja to kompromis, a łączny bilans jest zbliżony.
   */
  var PROLOGUE = [
    { id: 'energy', when: 'ok. 3,8 mld lat temu', icon: '🌋', title: 'Skąd czerpać energię?',
      desc: 'Ocean jest pełen związków chemicznych, a nad nim świeci Słońce. Pierwsze komórki muszą znaleźć sposób, by z tego żyć.',
      options: [
        { id: 'chemo', icon: '♨️', label: 'Chemosynteza przy kominach', knowledge: 'chemosynthesis',
          desc: 'Energia z związków siarki i żelaza przy kominach hydrotermalnych.',
          effects: { stats: { metabolism: -1, mobility: -1 }, variation: 2, reserves: 2 }, tradeoff: 'Oszczędny metabolizm (−1), +2 🧬 i +2 ⚡, ale przywiązanie do kominów (mobilność −1).' },
        { id: 'photo', icon: '☀️', label: 'Fotosynteza (sinice)', knowledge: 'photosynthesis',
          desc: 'Energia ze światła słonecznego; ubocznie powstaje tlen.',
          effects: { stats: { feeding: 1, mobility: -1 }, reserves: 2 }, tradeoff: '+1 odżywiania i +2 ⚡, ale przyrośnięte maty słabo się ruszają (mobilność −1).' },
        { id: 'phago', icon: '🦠', label: 'Fagocytoza — żywienie cudzymi komórkami', knowledge: 'phagocytosis',
          desc: 'Komórka otacza i trawi inne komórki — pierwsze drapieżnictwo.',
          effects: { stats: { feeding: 1, metabolism: 1 } }, tradeoff: '+1 odżywiania, ale +1 metabolizmu.' }
      ] },
    { id: 'cells', when: '2 mld – 600 mln lat temu', icon: '🧫', title: 'Jak połączyć siły?',
      desc: 'Pojedyncza komórka jest prosta i szybka, ale ma swoje granice. Życie zaczyna eksperymentować ze współpracą.',
      options: [
        { id: 'endosymbiosis', icon: '🔋', label: 'Endosymbioza — mitochondria', knowledge: 'endosymbiosis',
          desc: 'Komórka „przygarnia” bakterię, która staje się elektrownią komórki.',
          effects: { stats: { feeding: 1, mobility: -1 }, reserves: 3 }, tradeoff: '+1 odżywiania i +3 ⚡, ale większa, złożona komórka jest mniej ruchliwa (mobilność −1).' },
        { id: 'colony', icon: '🫧', label: 'Kolonie i wielokomórkowość', knowledge: 'multicellularity',
          desc: 'Komórki zostają razem, dzielą się pracą i chronią się nawzajem.',
          effects: { stats: { defense: 1, mobility: -1 }, variation: 4 }, tradeoff: '+1 obrony i +4 🧬, ale ciężka kolonia jest mniej ruchliwa (mobilność −1).' },
        { id: 'solitary', icon: '⚡', label: 'Szybko dzielące się pojedyncze komórki', knowledge: 'binary_fission',
          desc: 'Prostota i tempo: podział co kilkanaście minut daje ogromną liczebność.',
          effects: { stats: { reproduction: 1, defense: -1 }, ep: -8 }, tradeoff: '+1 rozrodu, ale −1 obrony i −8 EP na start — pojedyncza komórka jest bezbronna i bez zaplecza.' }
      ] },
    { id: 'oxygen', when: '600 – 541 mln lat temu', icon: '🫧', title: 'Tlen i pierwsze zwierzęta',
      desc: 'Sinice przez miliony lat zatruwały ocean i atmosferę tlenem. Dla jednych to katastrofa, dla innych — szansa. Pojawiają się miękkie zwierzęta fauny ediakarskiej.',
      options: [
        { id: 'aerobic', icon: '🫁', label: 'Oddychanie tlenowe', knowledge: 'great_oxidation',
          desc: 'Tlen pozwala wydobyć z pokarmu wielokrotnie więcej energii.',
          effects: { stats: { feeding: 1, metabolism: 1 }, reserves: 2 }, tradeoff: '+1 odżywiania i +2 ⚡, ale +1 metabolizmu — ciało zużywa więcej energii.' },
        { id: 'anaerobic', icon: '🕳️', label: 'Odporność na niedotlenienie', knowledge: 'anoxia',
          desc: 'Linia trzyma się miejsc ubogich w tlen, gdzie brakuje konkurentów.',
          effects: { stats: { defense: 1, metabolism: -1, feeding: -1 } }, tradeoff: '+1 obrony, ale −1 metabolizmu i −1 odżywiania — mało energii, za to spokojne siedlisko.' },
        { id: 'soft', icon: '🪼', label: 'Miękkie ciało ediakaru', knowledge: 'ediacaran',
          desc: 'Płaskie, miękkie zwierzęta bez szkieletu, jak Dickinsonia.',
          effects: { stats: { mobility: 1, defense: -1 } }, tradeoff: '+1 mobilności, ale −1 obrony (brak pancerza).' }
      ] }
  ];


  /*
   * Epilog: Antropocen (grywalny, po zwycięstwie). Rozumny gatunek podejmuje cztery decyzje
   * o tym, jak korzystać ze swojej mocy. Każda zmienia `tech` (rozwój cywilizacji) i `bio`
   * (kondycja biosfery); żadna opcja nie jest darmowa. Biosfera startuje z wartości zależnej
   * od przebiegu partii (`start`): wypierani konkurenci, wymarłe linie i mała różnorodność
   * ją obniżają. Na końcu werdykt z `verdicts` (pierwszy pasujący) i punkty do wyniku.
   */
  var ANTHROPOCENE = {
    start: { base: 80, perDisplaced: 8, maxDisplaced: 3, perLostLine: 4, maxLostLines: 4, perExtraNiche: 3, min: 30, max: 95 },
    score: { perTech: 4, perBio: 1 },
    stages: [
      { id: 'energy', icon: '🔥', title: 'Skąd brać energię?',
        desc: 'Ogień, potem pary, silniki i prąd: rozum daje dostęp do energii, jakiej nie miał żaden inny gatunek. Skąd ją brać?',
        options: [
          { id: 'coal', icon: '🪨', label: 'Węgiel i ropa naftowa', tech: 5, bio: -12,
            desc: 'Paliwa z pradawnych lasów karbonu: tanie i bogate w energię.',
            tradeoff: 'Rozwój +5, biosfera −12: uwalniasz węgiel, który natura zamknęła przed setkami milionów lat.' },
          { id: 'wood', icon: '🪵', label: 'Drewno, torf i biomasa', tech: 3, bio: -8,
            desc: 'Prosto i lokalnie, ale las odrasta wolniej, niż go palisz.',
            tradeoff: 'Rozwój +3, biosfera −8.' },
          { id: 'renew', icon: '🌬️', label: 'Słońce, wiatr i woda', tech: 2, bio: -2,
            desc: 'Czysta energia, ale trudniej ją zmagazynować.',
            tradeoff: 'Rozwój +2, biosfera −2.' }
        ] },
      { id: 'food', icon: '🌾', title: 'Jak żywić rosnącą populację?',
        desc: 'Rozum pozwolił oswoić rośliny i zwierzęta. Populacja rośnie, a z nią potrzeby.',
        options: [
          { id: 'clear', icon: '🪓', label: 'Karczować i zakładać pola', tech: 3, bio: -10,
            desc: 'Więcej pól dzięki wycince lasów i osuszaniu bagien.',
            tradeoff: 'Rozwój +3, biosfera −10: giną siedliska dzikich gatunków.' },
          { id: 'chem', icon: '🧪', label: 'Intensywne rolnictwo z chemią', tech: 4, bio: -8,
            desc: 'Nawozy i środki ochrony roślin dają wysokie plony z mniejszego obszaru.',
            tradeoff: 'Rozwój +4, biosfera −8: spływy zatruwają rzeki i morza.' },
          { id: 'rotate', icon: '🌱', label: 'Zróżnicowane uprawy i płodozmian', tech: 2, bio: -2,
            desc: 'Rotacje, żywopłoty i mniejsze pola zachowują glebę i owady zapylające.',
            tradeoff: 'Rozwój +2, biosfera −2.' }
        ] },
      { id: 'cities', icon: '🏙️', title: 'Jak rosną miasta?',
        desc: 'Handel i rzemiosło gromadzą ludzi w osadach. Osady stają się miastami.',
        options: [
          { id: 'sprawl', icon: '🏗️', label: 'Miasta bez ograniczeń', tech: 5, bio: -10,
            desc: 'Miasta rozlewają się w każdą stronę i pochłaniają otoczenie.',
            tradeoff: 'Rozwój +5, biosfera −10.' },
          { id: 'compact', icon: '🌳', label: 'Zwarte miasta z terenami zielonymi', tech: 3, bio: -3,
            desc: 'Gęsta zabudowa, parki i korytarze dla dzikiej przyrody.',
            tradeoff: 'Rozwój +3, biosfera −3.' },
          { id: 'villages', icon: '🛖', label: 'Rozproszone osady', tech: 1, bio: -1,
            desc: 'Małe osady lokalnie zaopatrują się w zasoby.',
            tradeoff: 'Rozwój +1, biosfera −1: mało wymiany wiedzy i handlu.' }
        ] },
      { id: 'extinction', icon: '🦋', title: 'Co z gatunkami, które giną?',
        desc: 'Zmiany krajobrazu i klimatu sprawiają, że gatunki znikają wielokrotnie szybciej niż zwykle. Czy zrobisz coś w tej sprawie?',
        options: [
          { id: 'ignore', icon: '🙈', label: 'Nie przeszkadzać rozwojowi', tech: 2, bio: -6,
            desc: 'Oszczędzasz zasoby na własne cele.',
            tradeoff: 'Rozwój +2, biosfera −6.' },
          { id: 'reserves', icon: '🛡️', label: 'Rezerwaty i przywracanie gatunków', tech: 0, bio: 8,
            desc: 'Chronisz siedliska i wypuszczasz zagrożone gatunki na wolność.',
            tradeoff: 'Rozwój +0, biosfera +8: kosztuje ziemię i wysiłek.' },
          { id: 'genebank', icon: '🧬', label: 'Banki genów i inżynieria ekosystemów', tech: 3, bio: 3,
            desc: 'Przechowujesz materiał genetyczny i wspierasz ekosystemy wiedzą.',
            tradeoff: 'Rozwój +3, biosfera +3: skuteczne tylko tam, gdzie rozumiesz ekosystem.' }
        ] }
    ],
    verdicts: [
      { id: 'sustainable', min: { tech: 9, bio: 60 }, icon: '🌍', title: 'Zrównoważona cywilizacja',
        text: 'Twój gatunek rozwinął technikę i nie zniszczył biosfery. To najtrudniejsza droga: potrzeba wiedzy i rezygnacji z części korzyści.' },
      { id: 'debt', min: { tech: 9 }, icon: '🏭', title: 'Cywilizacja na kredyt',
        text: 'Technika kwitnie, ale biosfera się kurczy. Rozwój na koszt ekosystemów działa tak długo, jak długo starcza kapitału natury — a ten się kończy.' },
      { id: 'guardians', min: { bio: 60 }, icon: '🌿', title: 'Cisi opiekunowie',
        text: 'Twój gatunek żyje w zgodzie z otoczeniem, ale za cenę rozwoju: niewiele techniki i niewielki wpływ na świat.' },
      { id: 'collapse', min: {}, icon: '🥀', title: 'Upadek ekosystemów',
        text: 'Ani rozwoju, ani zdrowej biosfery. Cywilizacja stoi na kruchym gruncie, a coraz uboższa natura nie jest w stanie jej wesprzeć.' }
    ],
    // Zakończenie mówi, co sam epilog pokazuje; ta pełna nazwa trafia do ekranu końcowego.
    outro: 'Antropocen to wciąż otwarty rozdział. Wybory rozumnego gatunku to jedyne miejsce w historii życia, w którym „ewolucja ma cel” — bo cel wybiera ten, kto rozumie konsekwencje.'
  };

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
      conditions: [{ niches: ['lad', 'powietrze'], effects: { feeding: -2 }, note: 'poza wodą brak planktonu' },
        { diets: ['miesozerca'], effects: { feeding: -2 }, note: 'filtrowanie nie łowi zdobyczy' }],
      desc: 'Odcedzanie drobnych cząstek pokarmu z wody — tania strategia odżywiania.' },
    { id: 'jaws', name: 'Szczęki', icon: '🦷', category: 'pokarm', cost: 16, requires: [],
      effects: { feeding: 3, metabolism: 1 }, tradeoff: 'Więcej pokarmu, ale wyższy metabolizm.',
      conditions: [{ diets: ['miesozerca'], effects: { feeding: 1 }, note: 'szczęki drapieżnika' }],
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
      conditions: [{ diets: ['miesozerca'], effects: { feeding: 1 }, note: 'łowy w grupie' },
        { diets: ['roslinozerca'], effects: { feeding: -1 }, note: 'roślinożerca nie ma czego wspólnie łowić' }],
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
    { id: 'steward', icon: '🌍', label: 'Zrównoważona cywilizacja', desc: 'Zakończ epilog „Antropocen” zrównoważoną cywilizacją: rozwój bez zniszczenia biosfery.' },
    { id: 'web', icon: '🔺', label: 'Sieć troficzna', desc: 'Utrzymaj jednocześnie linię roślinożerną i mięsożerną przez trzy tury.' },
    { id: 'gause', icon: '⚔️', label: 'Zasada Gausego', desc: 'Doprowadź do wyparcia dwóch konkurentów z ich nisz.' },
    { id: 'echo', icon: '🔔', label: 'Skutki decyzji', desc: 'Doczekaj się dwóch kart-ech, czyli następstw własnych wyborów.' },
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
    trophic: { icon: '🔺', title: 'Piramida troficzna',
      body: 'Producenci (rośliny, glony) są u podstawy; roślinożercy je zjadają, a mięsożercy zjadają roślinożerców. ' +
        'Z każdym poziomem energii ubywa — zwykle zostaje ok. 10% — więc drapieżników jest wielokrotnie mniej niż ' +
        'roślinożerców, a łańcuchy pokarmowe rzadko mają więcej niż kilka ogniw.',
      fossil: 'W skamieniałych rafach i lasach biomasa drapieżników to zwykle ułamek biomasy roślinożerców.' },
    trophic_cascade: { icon: '🌊', title: 'Kaskada troficzna',
      body: 'Zmiana na jednym poziomie sieci pokarmowej przenosi się na inne. Więcej drapieżników — mniej roślinożerców, ' +
        'ale więcej roślin. Odwrotnie: gdy zabraknie zdobyczy, głodują też drapieżniki. Sieć troficzna to układ ' +
        'sprzężeń zwrotnych, nie prosty łańcuch.',
      fossil: 'Po powrocie wilków do Yellowstone zmalało stado jeleni, zregenerowały się wierzby nad rzekami, a wraz z nimi bobry.' },
    diet: { icon: '🍽️', title: 'Dieta i specjalizacja',
      body: 'Specjalista (tylko rośliny lub tylko mięso) wykorzystuje swój pokarm najlepiej, ale zależy od jednego źródła. ' +
        'Generalista (wszystkożerca) przetrwa spadek pokarmu, choć w dobrych czasach ustępuje specjalistom. ' +
        'To jeden z klasycznych kompromisów doboru naturalnego.',
      fossil: 'Pandy wielkie to potomkowie mięsożerców, którzy wyspecjalizowali się w bambusie — i są zależne od niego.' },
    chemosynthesis: { icon: '♨️', title: 'Chemosynteza',
      body: 'Niektóre bakterie czerpią energię nie ze światła, lecz z reakcji chemicznych, np. utleniania siarkowodoru. ' +
        'Żyją przy kominach hydrotermalnych, gdzie ciemność i gorąco nie są przeszkodą — być może właśnie tam życie się zaczęło.',
      fossil: 'Wokół dzisiejszych kominów na dnie oceanu żyją kolonie rurkoczółenek, które karmią się dzięki chemosyntetycznym bakteriom.' },
    photosynthesis: { icon: '☀️', title: 'Fotosynteza',
      body: 'Sinice nauczyły się zamieniać światło, wodę i dwutlenek węgla w cukry, wydzielając tlen. ' +
        'To najważniejszy wynalazek w historii życia: bez niego nie byłoby ani tlenowej atmosfery, ani zwierząt.',
      fossil: 'Stromatolity — warstwowane skały budowane przez maty sinic — liczą nawet 3,5 mld lat.' },
    phagocytosis: { icon: '🦠', title: 'Fagocytoza',
      body: 'Komórka może „połknąć” inną i ją strawić. Dzięki temu powstało pierwsze drapieżnictwo, a wraz z nim wyścig zbrojeń: ' +
        'ofiary zaczęły rosnąć i opancerzać się. To także droga do endosymbiozy — nie każda połknięta komórka zostaje strawiona.',
      fossil: 'Ameby i wiele wolno żyjących pierwotniaków do dziś żywią się fagocytozą.' },
    endosymbiosis: { icon: '🔋', title: 'Endosymbioza',
      body: 'Mitochondria i chloroplasty to potomkowie dawnych bakterii, które zamieszkały w większej komórce i zostały w niej na stałe. ' +
        'Mają własne DNA i dzielą się niezależnie. To jeden z największych przykładów współpracy w ewolucji.',
      fossil: 'Ślady eukariotów pochodzą sprzed ok. 1,8–2 mld lat; czerwone glony sprzed 1,2 mld lat to najstarsze znane organizmy płciowe.' },
    multicellularity: { icon: '🫧', title: 'Wielokomórkowość',
      body: 'Wielokomórkowość wyewoluowała wielokrotnie i niezależnie: u zwierząt, roślin, grzybów i glonów. ' +
        'Komórki dzielą się pracą — jedne żywią, inne bronią, jeszcze inne się rozmnażają — kosztem tego, że część z nich zamiera na rzecz całości.',
      fossil: 'Kolonie Volvox pokazują dziś pośredni etap między pojedynczą komórką a organizmem.' },
    binary_fission: { icon: '⚡', title: 'Podział komórki',
      body: 'Bakterie dzielą się na dwie identyczne komórki nawet co kilkanaście minut. Ogromna liczebność i tempo zmian ' +
        'pozwalają im błyskawicznie przystosowywać się — dlatego to bakterie, a nie zwierzęta, są najliczniejszą i najstarszą formą życia.',
      fossil: 'Komórki podobne do bakterii zapisały się w skałach sprzed ponad 3,4 mld lat.' },
    great_oxidation: { icon: '🫁', title: 'Wielkie utlenienie',
      body: 'Ok. 2,4 mld lat temu tlen z fotosyntezy zaczął gromadzić się w atmosferze — dla wielu beztlenowców to była katastrofa, ' +
        'ale oddychanie tlenowe daje kilkanaście razy więcej energii z tej samej porcji pokarmu. Bez tego złożone zwierzęta nie miałyby jak żyć.',
      fossil: 'Pasmowe formacje żelaziste (BIF) zapisują moment, gdy tlen zaczął rdzewić żelazo w oceanach.' },
    anoxia: { icon: '🕳️', title: 'Życie bez tlenu',
      body: 'Wiele organizmów przeżyło Wielkie utlenienie, zamieszkując miejsca ubogie w tlen: osady, głębiny, wnętrza innych organizmów. ' +
        'Dziś beztlenowce żyją w błocie, jelitach zwierząt i na dnie oceanu. Niedotlenienie wraca w historii Ziemi przy kolejnych wymieraniach.',
      fossil: 'Bakterie redukujące siarczany to jedni z najstarszych mieszkańców osadów.' },
    ediacaran: { icon: '🪼', title: 'Fauna ediakarska',
      body: 'Tuż przed kambrem żyły dziwne, miękkie organizmy bez szkieletów: płaskie „liście”, „materace” i dyski. ' +
        'Nie wiadomo do końca, czy były przodkami dzisiejszych zwierząt, czy osobną gałęzią, która wymarła.',
      fossil: 'Dickinsonia z Ediakary w Australii Południowej ma ok. 558 mln lat — to jedne z najstarszych zwierząt.' },
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
    MIGRATION: MIGRATION, CAPACITY: CAPACITY, DIETS: DIETS, TROPHIC: TROPHIC, NEW_LINEAGE: NEW_LINEAGE, RESERVES: RESERVES, VARIATION: VARIATION, STRATEGIES: STRATEGIES, BEHAVIORS: BEHAVIORS,
    CHOICE_CHANCE: CHOICE_CHANCE, CHOICE_EVENTS: CHOICE_EVENTS, PROLOGUE: PROLOGUE, ANTHROPOCENE: ANTHROPOCENE, RIVAL: RIVAL, RIVALS: RIVALS, ENDINGS: ENDINGS, WIN_TRAIT: WIN_TRAIT, WIN_PATHS: WIN_PATHS,
    REGIONAL: REGIONAL, REGIONAL_DISASTERS: REGIONAL_DISASTERS, ERA_GOALS: ERA_GOALS, ERA_GOALS_PER_ERA: ERA_GOALS_PER_ERA,
    OUTLOOK: OUTLOOK, SCORE: SCORE, ACHIEVEMENTS: ACHIEVEMENTS, WIN_MIN_POP: WIN_MIN_POP, EP_RULES: EP_RULES, ENV_VARIATION: ENV_VARIATION,
    DIFFICULTIES: DIFFICULTIES, NICHES: NICHES, CATEGORIES: CATEGORIES, CATEGORY_ICONS: CATEGORY_ICONS,
    TRAITS: TRAITS, ERAS: ERAS, SCENARIOS: SCENARIOS, KNOWLEDGE: KNOWLEDGE,
    // Zgodność wsteczna:
    INTELLIGENCE_GOAL: DIFFICULTIES.normalny.goal, START_EP: DIFFICULTIES.normalny.startEp
  };
});
