# Ewolucja — analiza stanu i kierunki rozwoju (30.09.2026)

**Oceniany stan:** commit `e421156` (po scaleniu PR #11: sieć troficzna,
konkurenci, echa decyzji, prolog, Antropocen). 338 testów silnika przechodzi.

**Metoda.** Przeczytałem dokumenty projektu (`ZALOZENIA.md`, `ULEPSZENIA.md`,
[`OCENA-MECHANIK.md`](./OCENA-MECHANIK.md), recenzje), silnik, dane i interfejs.
Rozegrałem 600 partii botami z `test/bots.js` (100 na komórkę: bot „klad”
i bot „jedna linia”, trzy poziomy, gracz lądowy i wodny po połowie), kilka
tur w Chromium ze zrzutami ekranu i sprawdziłem, co daje cofanie tury.

> Boty to przybliżenie gracza, nie gracz. Cała dotychczasowa kalibracja opiera
> się na botach. Gra nie była jeszcze sprawdzona na swojej grupie docelowej
> (klasy 6–8), więc to jest dziś największa niewiadoma projektu.

---

## W skrócie

Gra jest dopracowana technicznie i, według botów, zbalansowana. Dalsze
strojenie liczb da niewiele. Największe zyski leżą w trzech miejscach:

1. **Finał gry.** Kenozoik to era, w której powstaje rozum, a w większości
   partii prawie się w nią nie gra. 45% zwycięstw przypada na turę 15, czyli
   pierwszą, w której zwycięstwo jest w ogóle możliwe. Zwycięzca kończy grę
   z około 50 niewydanymi EP.
2. **Gra na lekcję.** Założenia stawiają na pomoc dydaktyczną dla klas 6–8.
   Mimo to nie ma quizów, trybu nauczyciela ani wersji mieszczącej się
   w 45 minutach. Liczba systemów widocznych od pierwszej tury jest duża
   jak na dwunastolatka.
3. **Luki między balansem a tym, co widzi gracz.** W pełnej grze nie da się
   wybrać poziomu trudności. Cofanie tury zdradza wynik ryzyka. Skrypt
   zrzutów ekranu nie działa.

---

## 1. Stan w liczbach

### 1.1. Zwycięstwa (100 partii na komórkę, ziarna 1–100)

| Poziom | Klad (gałęzie w niszach) | Jedna linia | Wymarcie (klad) |
|---|---|---|---|
| łatwy | 88% | 79% | 5% |
| normalny | 73% | 60% | 6% |
| trudny | 34% | 15% | 34% |

Rozgałęzianie się opłaca (+9 do +19 p.p.), a obie drogi do rozumu są grywalne
(normalny, klad: narzędzia 37, dźwięk 36).

### 1.2. Kiedy przychodzi zwycięstwo (normalny, klad, 73 wygrane)

| Tura | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|
| Wygrane | **33** | 20 | 10 | 4 | 3 | 3 |

Średnia tura zwycięstwa to 16,1 z 20. Kenozoik ma 6 tur, a zwycięzca rozgrywa
z nich średnio dwie. Zlodowacenie plejstoceńskie (tura 19) widzi mniej więcej
co dwunasty zwycięzca. Po wygranej zostaje średnio 50 EP (łatwy 52, trudny 51).

### 1.3. Co gracz robi (normalny, klad)

- **Przyczyny śmierci:** katastrofy 63%, drapieżniki 23%, głód 11%,
  przegęszczenie 2%, choroby 1%.
- **Nisze żywych linii na koniec:** woda 84, ląd 46, przybrzeże 38,
  **powietrze 0**.
- **Diety żywych linii na koniec:** roślinożercy 164, mięsożercy 4,
  **wszystkożercy 0**.
- **Cechy kupowane prawie zawsze (≥ 80% partii):** zwoje 100%, łuski 98%,
  mózg 97%, stałocieplność 93%, izolacja 93%, liczne jaja 89%, oczy 87%,
  rozbudowany mózg 87%, linia boczna 86%, zachowania społeczne 81%.
- **Prawie nigdy:** lot 1%, szybkie mięśnie 3%. Bot „jedna linia” nie kupił
  lotu ani razu na żadnym poziomie.
- **Linie:** średnio 1,7 na partię (bot kladowy).
- **Kodeks:** średnio 21 z 45 kart wiedzy na partię.

---

## 2. Co działa i warto chronić

- **Rdzeń energetyczny uczy przez porażkę.** Ślepe plany („kup wszystko”,
  „tylko ⭐”) kończą się wymarciem, a mózg bez zaplecza pokarmowego głodzi
  populację.
- **Oprawa.** Spójna „rycina naukowa”, zwierzę rysowane z cech, diorama i drzewo
  życia. To poziom rzadko spotykany w darmowych grach edukacyjnych.
- **Architektura.** Czysty silnik bez DOM, niemutowalny stan, deterministyczna
  losowość z ziarnem, 338 testów i boty balansu. Każda zmiana reguł jest
  mierzalna, co jest rzadkie i cenne.
- **Kod świata.** Cała klasa może grać w tym samym świecie.
- **Rzetelny Kodeks.** 45 kart z odniesieniami do skamieniałości.
- **Uczciwe sygnały.** Prognoza podaje przedział, katastrofy są zapowiadane
  z siłą w każdej niszy, a gra mówi wprost, gdy zwycięstwo jest już niemożliwe.

---

## 3. Problemy

### 3.1. Kenozoik jest przeskakiwany

Kultura (narzędzia albo kultura akustyczna) odblokowuje się w kenozoiku i jest
**jednorazowym zakupem**. Opłaca się więc odłożyć EP w mezozoiku i kupić
wszystko w turze 15. Skutki:

- najciekawsza dla tematu część historii (ssaki, naczelne, sawanna, epoki
  lodowe) mija w jednej turze;
- końcówka to rachunek („czy uzbieram na narzędzia?”), a nie kulminacja;
- EP w drugiej połowie gry nie są rzadkie (50 EP zostaje po wygranej), więc
  o tempie decyduje blokada ery, a nie wybory gracza.

### 3.2. W pełnej grze nie da się wybrać trudności

Poziom trudności wynika ze scenariusza (`js/ui.js:224`): „Pełna ewolucja” to
zawsze normalny, „Podbój lądu” łatwy, a „Epoki lodowcowe” trudny. Tabela
88/73/34% opisuje więc dwa tryby, których gracz nie może wybrać. Osiągnięcie
„zwycięstwo na trudnym” da się zdobyć tylko w „Epokach lodowcowych”.
Nauczyciel nie może też dać słabszej klasie łatwej pełnej gry.

### 3.3. Cofanie zdradza przyszłość

Cofanie jest zawsze włączone i działa także po turze (`js/ui.js:96–97`).
Stan przechowuje generator losowości, a ukryte odchylenie warunków wynika
z kodu świata. Po cofnięciu ta sama opcja ryzyka daje więc **ten sam wynik**
(sprawdzone na 3 ziarnach: 48%, 55% i 43% szans, wynik identyczny za każdym
razem). Gracz może zagrać ryzyko, zobaczyć wynik i przy porażce cofnąć turę,
a potem wybrać inaczej. Tak samo może poznać prawdziwe warunki tury.

Wynik i rekord nie odnotowują cofania (`js/ui.js:1384`). Przy porównywaniu
wyników całej klasy w jednym świecie to podważa sens porównania, a przy okazji
znosi niepewność dodaną w ostatniej rundzie balansu.

### 3.4. Dużo systemów naraz jak na grupę docelową

Od pierwszej tury gracz widzi: EP, ⚡ rezerwy, 🧬 zmienność, strategię r/K,
dietę, zachowanie linii, ukierunkowany dobór, karty decyzji z ryzykiem,
4 nisze z migracją, specjację, 26 cech, cele ery, konkurentów i zapowiedzi
katastrof. Ekran gry ma na komputerze około 3200 px wysokości (większość to
panel adaptacji z 26 kartami), a na telefonie około 6600 px.

Część tych systemów rzadko zmienia wynik. Boty prawie nie zmieniają diety
(4 mięsożercy na 168 linii, żadnego wszystkożercy), a według
`OCENA-MECHANIK.md` dobór na normalnym daje około 3 p.p. Każdy dodatkowy
przełącznik to koszt dla ucznia klasy 6.

### 3.5. Powietrze i lot nadal martwe

Lot kupuje 0–6% botów, a na koniec gry w powietrzu żyją 0–2 linie na
100 partii. Nisza jest ładnie narysowana (pterozaur, ptak, ważka), ale
w decyzjach gracza nie istnieje.

### 3.6. Mała różnorodność buildów

Dziesięć cech kupuje się w ponad 80% partii. Poza wyborem drogi (ląd albo woda)
budowa zwierzęcia jest prawie stała. Brakuje też cech wymienionych
w `ZALOZENIA.md` §5: **rozmiaru ciała**, **oddychania powietrzem** i szkieletu.

### 3.7. Otwarte punkty edukacyjne z `ULEPSZENIA.md`

| # | Punkt | Stan |
|---|---|---|
| 3.1 (P1) | Quizy po erze z bonusem EP | brak |
| 3.2 | Tryb nauczyciela jako osobny tryb | brak (cofanie zawsze włączone, patrz 3.3) |
| 4.3 | Karta „ewolucja nie ma celu”; ⭐ nazywa się „drogą do inteligencji” | brak |
| 4.5 | Oznaczanie uproszczeń przy mechanikach | brak |
| 4.4 | Wymieranie triasowo-jurajskie | brak (dewońskie jest) |
| 4.7 | Przebieg gry tura po turze w eksporcie dla nauczyciela | brak |
| `ZALOZENIA` §8 | Tryb sandbox | brak |

### 3.8. Technika

- **`npm run shots` nie działa.** Prolog jest domyślnie włączony
  (`index.html:49`), a skrypt po kliknięciu scenariusza czeka na ekran gry
  (`scripts/screenshots.mjs:44`). Kończy się błędem przekroczenia czasu.
- **Brak CI.** Nie ma `.github/workflows`. `dist/index.html` trzeba budować
  i zatwierdzać ręcznie, a nic nie sprawdza, czy jest aktualny.
- **Testy trwają około 60 s**, bo zawierają partie botów. Nie ma szybkiego
  zestawu do uruchamiania przy każdej zmianie.
- **i18n.** Silnik zwraca polskie zdania (około 70 napisów w `js/engine.js`),
  a UI woła `T()` tylko 13 razy. Tłumaczenie gry wymaga dziś zmian w silniku.
- **Monolity w JS.** `engine.js` i `ui.js` mają po około 1700 linii zwykłego JS,
  a warstwa graficzna jest w TypeScripcie. Dane nie mają typów, więc literówka
  w `data.js` wychodzi dopiero w grze albo w testach.
- **Stary zapis znika bez słowa** (`js/ui.js:90`, `ULEPSZENIA.md` 5.6).

---

## 4. Kierunki rozwoju

### A. Porządki (1–2 dni, zrobić najpierw)

| # | Zmiana | Zakres |
|---|---|---|
| A1 | Wybór trudności w pełnej grze (łatwy / normalny / trudny); scenariusze zachowują własną | UI; dane już są |
| A2 | Tryb nauczyciela jako tryb: poza nim cofanie tylko w obrębie tury (zakupy, decyzje), bez cofania rozegranej tury; w trybie nauczyciela wynik oznaczony „z cofaniem” i bez rekordu | UI + test |
| A3 | Naprawić `scripts/screenshots.mjs` (odznaczyć prolog albo go przejść) | skrypt |
| A4 | CI w GitHub Actions: `npm test`, `typecheck`, `build` i sprawdzenie, czy `dist/index.html` jest aktualny | workflow |
| A5 | Podział testów na szybkie (logika) i wolne (boty balansu) | `package.json` |

### B. Kenozoik jako finał (najważniejsza zmiana w rozgrywce)

Proponuję, by rozum był **procesem**, a nie zakupem.

- **Licznik kultury linii.** Po zakupie narzędzi albo kultury akustycznej
  kultura rośnie co turę. Tempo zależy od populacji, zachowań społecznych
  i opieki nad potomstwem (przekaz kulturowy wymaga ciągłości pokoleń).
  Wąskie gardło zabiera część kultury: mała populacja traci umiejętności,
  jak na Tasmanii.
- **Zwycięstwo po zapełnieniu licznika**, np. po 3–4 turach. Typowa wygrana
  przesuwa się na tury 18–20, a **zlodowacenie plejstoceńskie staje się
  egzaminem końcowym**: czy kultura przetrwa epokę lodową.
- **Kenozoiczne cechy jako ujście EP:** dwunożność, mowa (w `ZALOZENIA.md` §5
  jako kamień milowy), długie dzieciństwo. Przyspieszają kulturę, ale kosztują
  energię, więc zapas EP znów wymaga decyzji.
- **Lekcja:** kultura kumulatywna potrzebuje dużej, połączonej populacji,
  a nie tylko dużego mózgu.

**Miary sukcesu:** co najmniej 70% zwycięstw w turach 17–20; średnio mniej
niż 20 EP po wygranej; odsetek zwycięstw na normalnym bez zmian (±5 p.p.).

### C. Gra na lekcję (edukacja)

| # | Zmiana | Po co |
|---|---|---|
| C1 | **Test z uczniami**: dwie klasy, obserwacja, czas partii, 5 pytań o dobór naturalny przed grą i po niej; lokalny eksport logu decyzji (JSON, bez danych osobowych) | jedyny sposób, by sprawdzić, co rozumieją (przedział prognozy, r/K, koszt doboru) i co tylko klikają |
| C2 | **Quizy po erze** (P1 od początku projektu): 2–3 pytania z kart odblokowanych w erze, bonus EP, pytania w `data.js` | domyka fazę 5 pętli z `ZALOZENIA.md` §3 |
| C3 | **Stopniowe odsłanianie mechanik**: w paleozoiku cechy i migracja; r/K i zachowania po pierwszej katastrofie; dieta po szczękach; dobór po pierwszej specjacji. Ewentualnie przełącznik „tryb podstawowy / rozszerzony” | mniej przycisków na starcie dla ucznia klasy 6 |
| C4 | **Scenariusze-lekcje na 10–15 minut**, każdy o jednym pojęciu: „Wyścig zbrojeń”, „Wąskie gardło i dryf”, „Wyspa” (efekt założyciela), „K–Pg: kto przeżył i dlaczego”, „Wyjście na ląd”. Silnik ma już `startEra`, `startTraits`, `winPaths` i `forcedGoals`; trzeba dodać własne warunki zwycięstwa | pełna gra trwa 20–30 minut, a lekcja 45 razem z omówieniem |
| C5 | **Karta „Ewolucja nie ma celu, cel ma gracz”** i zmiana podpisu ⭐ na „ścieżka gracza”; znaczniki „ℹ uproszczenie” | ryzyko utrwalenia mitu, wprost wymienione w `ZALOZENIA.md` §11 |
| C6 | **Pakiet dla nauczyciela**: plan lekcji na 45 minut, karta pracy, pytania do omówienia oparte na raporcie tury; przebieg gry tura po turze w eksporcie; „wyniki klasy” bez serwera (krótki kod wyniku do wklejenia w arkusz) | nauczyciel to osobny odbiorca, dziś pominięty |

### D. Różnorodność i treść

| # | Zmiana | Po co |
|---|---|---|
| D1 | **Rozmiar ciała** (gigantyzm): więcej obrony, mniej osobników w niszy, większe straty w wymieraniach, bo K–Pg zabija duże zwierzęta; reguła Cope’a jako karta wiedzy | nowa oś decyzji i jedna z najlepszych lekcji o wymieraniach |
| D2 | **Oddychanie powietrzem (płuca)** jako prawdziwy wymóg lądu obok kończyn (Tiktaalik) | rzetelność łuku „wyjście na ląd” |
| D3 | **Rola dla powietrza**: szybka migracja w dowolne miejsce, wcześniejsza zapowiedź katastrof regionalnych, mała sylwetka jako ochrona przed K–Pg (ptaki przeżyły) | nisza, która dziś nie istnieje w decyzjach |
| D4 | **Wymieranie triasowo-jurajskie** (brakuje go w „wielkiej piątce”) i więcej kart decyzji związanych z erą (dziś 19, z czego 5 ech) | regrywalność i rzetelność |
| D5 | **Dieta**: albo wyraźny powód do zmiany (np. rośliny kwiatowe w kredzie, mięso w chudych sezonach), albo uproszczenie, jeśli test z uczniami (C1) pokaże, że myli | system, którego boty prawie nie używają |

### E. Technika i zasięg (równolegle, małymi krokami)

- **i18n silnika:** zdarzenia jako `{ code, params }`, tłumaczenie w UI,
  test brakujących kluczy. Otwiera wersję angielską.
- **TypeScript dla danych i silnika**, stopniowo: typy `DATA` łapią błędy
  w danych.
- **PWA** (manifest i service worker) do instalacji na tabletach szkolnych.
- **Migracja zapisów** zamiast cichego odrzucania.

### F. Na później: rywalizacja bez serwera

- **Gatunek kolegi jako konkurent.** Eksport gatunku do krótkiego kodu
  (cechy, nisza, populacja) i import do własnego świata jako rywal. Mechanika
  konkurentów już jest, więc to asynchroniczny tryb wieloosobowy i koewolucja
  z `ZALOZENIA.md` §8 bez żadnego backendu.
- **Hot-seat** na jednym komputerze (tablica multimedialna).
- **Laboratorium doboru (sandbox):** gracz ustawia środowisko i patrzy, jak
  zmienia się populacja. Silnik z prognozą nadaje się do tego prawie bez zmian.

---

## 5. Proponowana kolejność

| Etap | Co | Dlaczego teraz |
|---|---|---|
| 1 | **A1–A5** (porządki) | tanie, usuwają luki, CI chroni dalsze prace |
| 2 | **C1** (test z uczniami) razem z **C2** i **C5** | zanim przebudujemy finał i uprościmy interfejs, trzeba wiedzieć, co jest trudne dla prawdziwych graczy |
| 3 | **B** (kenozoik jako finał) | największa zmiana w odczuciu gry; boty zmierzą jej wpływ |
| 4 | **C3, C4, C6** (odsłanianie mechanik, scenariusze-lekcje, pakiet nauczyciela) | dopasowanie do lekcji na podstawie wyników testu |
| 5 | **D** (treść) | różnorodność po ustabilizowaniu finału |
| 6 | **E, F** | zasięg i nowe tryby |

### Czego nie robić

- **Dalej stroić liczb pod boty bez danych od graczy.** Ostatnie rundy dawały
  po kilka punktów procentowych, a nikt nie wie, jak gra wypada u ucznia.
- **Dokładać przełączników do panelu „Decyzje linii”.** Nowe mechaniki powinny
  raczej zastępować te, które mało zmieniają, niż dochodzić obok nich.

---

<sub>Metodologia: boty `clade` i `tactics1` z `test/bots.js` na commicie
`e421156`, ziarna 1–100, świat z kodem `BOT<n>`, `pref: 'mix'`. Przyczyny
śmierci i nisze z `history` i `lineages` stanu końcowego. Test cofania:
stan z kartą ryzyka, dwukrotne `simulateTurn` z tego samego stanu (ziarna
`UNDO1`–`UNDO3`). Zrzuty: `dist/index.html` w Chromium (Playwright), 1366×900
i 390×844.</sub>
