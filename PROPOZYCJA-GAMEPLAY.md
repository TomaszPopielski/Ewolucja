# Propozycja modyfikacji gameplayu — poprawa doświadczenia z gry

> **✅ Status: WDROŻONE.** Wszystkie 10 propozycji z tego dokumentu zostało
> zaimplementowanych w `js/engine.js`, `js/data.js`, `js/ui.js`, `index.html`,
> `css/styles.css` oraz pokrytych testami (`test/engine.test.js` — 50 testów, wszystkie
> zielone). Balans zweryfikowany symulacyjnie na trzech scenariuszach: strategia
> rozwoju mózgu wygrywa (inteligencja 13–15), a gra „na przetrwanie” kończy się
> `survived` bez rozumności — przekaz edukacyjny zachowany. Dokument pozostaje jako opis
> projektowy i uzasadnienie zmian.

Dokument roboczy. Cel: wskazać **konkretne, uzasadnione zmiany** rozgrywki, które
podniosą satysfakcję, głębię decyzji i wartość edukacyjną gry *Ewolucja*, bez
zrywania z jej filozofią (lekka symulacja populacji, logika oddzielona od UI,
dane jako konfiguracja — zob. [`ZALOZENIA.md`](./ZALOZENIA.md) sekcja 9).

Analiza oparta na aktualnym kodzie: `js/engine.js`, `js/data.js`, `js/ui.js`.
Każda propozycja podaje **problem**, **rozwiązanie**, **miejsce zmiany**,
**koszt/ryzyko** i **wpływ edukacyjny**.

---

## 1. Streszczenie

Gra ma solidny szkielet (pętla „obserwuj → decyduj → adaptuj", trzy ery, nisze,
katastrofy, specjacja, prognoza, samouczek). Największe rezerwy poprawy leżą w
**balansie ekonomii EP**, **znaczeniu decyzji o niszach i specjacji** oraz
**tempie i czytelności celu**. Poniżej 10 propozycji w trzech priorytetach:

| Priorytet | Propozycja | Typ zmiany |
|---|---|---|
| **P1** | Ukrócić „farmienie" EP przez specjację (skalowanie inteligencji per linia) | silnik |
| **P1** | Nadać migracji koszt/ryzyko, by nie trywializowała katastrof | silnik + dane |
| **P1** | Zabezpieczyć przed „spiralą śmierci" (dno populacyjne + ostrzeżenie) | silnik + UI |
| **P2** | Wyraźny wskaźnik postępu do inteligencji + „następny krok ⭐" | UI |
| **P2** | Skrócić powtarzalność: „szybka tura" i modal tylko przy zdarzeniach | UI |
| **P2** | Pogłębić decyzje: synergie cech i alternatywne ścieżki do rozumu | dane + silnik |
| **P2** | Mini-quiz po erze z bonusem EP (jest w założeniach, brak w kodzie) | dane + UI |
| **P3** | Uczciwsza losowość: łagodniejszy dryf mutacji + tryb z ziarnem (nauczyciel) | silnik |
| **P3** | Cele opcjonalne / osiągnięcia per era (retencja i rejogranie) | dane + UI |
| **P3** | Podgląd wszystkich linii naraz (prognoza i staty bez przełączania) | UI |

---

## 2. Zdiagnozowane problemy (na podstawie kodu)

### 2.1. Specjacja premiuje „farmienie", nie różnicowanie
W `engine.js → simulateLineage` premia EP z inteligencji liczona jest **per linia**:

```
intelligence: pop > 0 ? Math.floor(lstat(l, 'intelligence') / 2) : 0
```

Ponieważ dziecko dziedziczy statystyki rodzica (`makeLineage(..., parent.stats, ...)`),
podział linii o inteligencji 10 daje **dwa razy** po `floor(10/2)=5` EP zamiast raz.
Do tego premia niszy (`epBonus`: ląd +3, powietrze +2) jest doliczana **co turę, per
linia**. Efekt: optymalną strategią staje się dzielenie na wiele linii „zaparkowanych"
w niszach premiowych — mechanicznie opłacalne, ale **edukacyjnie myląca** (specjacja
powinna rozkładać ryzyko, a nie mnożyć dochód).

### 2.2. Migracja trywializuje katastrofy i dywersyfikację
Migracja (`migrateLineage`) jest **darmowa i natychmiastowa**, bez limitu na turę.
Katastrofy trafiają tylko w konkretną niszę (np. `niche: 'woda'`), a prognoza je
zapowiada. Skutek: gdy nadchodzi wymieranie ordowickie/permskie (woda), wystarczy
turę wcześniej przenieść **wszystkie** linie na ląd/do powietrza i całkowicie je ominąć.
Nisza powietrzna ma dodatkowo `predMult: 0.3` — to niemal bezpieczna przystań.
Przekaz „dywersyfikuj, by *któraś* linia przetrwała" zamienia się w „uciekaj całością",
co jest **sprzeczne z lekcją** o wymieraniach masowych (`KNOWLEDGE.extinction`).

### 2.3. Ryzyko „spirali śmierci" bez wyjścia
Cechy inteligencji mocno podnoszą metabolizm (`brain` +2, `big_brain` +3, `endothermy` +3).
Przy niskim pokarmie (`computeDynamics`) ujemny bilans energii → głód → spadek populacji
→ mniej EP → brak środków na korektę. Populacja może spaść do 0 w kilka tur bez realnej
szansy odbicia. To frustrujące i zniechęca do inwestowania w ścieżkę ⭐ — czyli w **cel gry**.

### 2.4. Pułapka „przetrwania bez rozumu"
README wprost ostrzega: *„sama liczna populacja nie wystarczy"*. To sygnał, że gracze
regularnie wpadają w zakończenie `survived` — rozwijają odżywianie/obronę, a cel
(inteligencja 12–15) zostaje daleko. Interfejs pokazuje `intel: X / cel`, ale **nie
prowadzi** gracza ku następnemu krokowi ścieżki nerwowej ani nie ostrzega, że czasu
(tur) jest już za mało.

### 2.5. Powtarzalność pętli
Modal raportu otwiera się **po każdej z 20 tur**, nawet gdy nic istotnego się nie stało.
Przy dobrze idącej grze to 20× ten sam rytuał „kliknij Przeżyj turę → zamknij modal".
Napięcie spada, a klikanie zamiast decydowania męczy.

---

## 3. Propozycje szczegółowe

### P1-A. Skalowanie premii EP względem liczby linii
**Problem:** 2.1 — specjacja mnoży dochód EP zamiast rozkładać ryzyko.

**Rozwiązanie:**
- Premię EP z **inteligencji** liczyć od **najlepszej linii**, nie sumować per linia
  (nagradzamy postęp gatunku, nie liczbę kopii tej samej inteligencji).
- Premię niszy (`epBonus`) zmienić z co-turowej na **jednorazową „premię odkrycia"** przy
  pierwszym wejściu danej linii do nowej niszy (nagroda za ekspansję, nie za parkowanie).
- Opcjonalnie: łączną premię z populacji/niszy skalować przez `1/√(liczba żywych linii)` —
  malejące zwroty z rozdrabniania.

**Miejsce zmiany:** `engine.js → simulateLineage` (blok „Rozbicie EP"), pole `epBonus`
w `data.js → NICHES`. Utrzymać rozbicie EP w raporcie (`report-epbreak` w `ui.js`), by
gracz nadal widział źródła punktów.

**Koszt/ryzyko:** średni. Wymaga aktualizacji testów silnika (`test/engine.test.js` —
sprawdza m.in. przechodniość świadomą strategią). Trzeba przetestować, czy cel nadal
osiągalny na „normalnym".

**Wpływ edukacyjny:** specjacja wraca do roli **narzędzia zarządzania ryzykiem**
(różne nisze = różne szanse przetrwania katastrofy), zgodnie z `KNOWLEDGE.speciation`.

---

### P1-B. Koszt i ryzyko migracji + katastrofy trudniejsze do ominięcia
**Problem:** 2.2 — darmowa ucieczka niweczy lekcję o wymieraniach.

**Rozwiązanie (do wyboru/łącznie):**
1. **Aklimatyzacja:** w turze migracji linia dostaje przejściową karę (np. `reproduction`
   i `mobility` −1 na jedną turę) — przeprowadzka kosztuje.
2. **Koszt EP** migracji (np. 3–5 EP), by była decyzją, a nie odruchem.
3. **Przeludnienie niszy-schronienia:** jeśli w jednej turze zbyt wiele linii ucieka do
   jednej niszy, jej `foodMult` chwilowo spada (konkurencja o pokarm).
4. **Premia za rozproszenie zamiast ucieczki:** katastrofa niszowa zadaje pełne straty
   linii, które **całością** siedzą w zagrożonej niszy, ale gatunek jako całość dostaje
   premię EP „przetrwania dzięki dywersyfikacji", jeśli **co najmniej jedna** linia była
   w innej niszy. Nagradzamy rozłożenie, nie ewakuację.

**Miejsce zmiany:** `engine.js → migrateLineage` (koszt/kara), `simulateLineage`
(logika katastrof i premii), `ui.js → onMigrateTo` (komunikat o koszcie).

**Koszt/ryzyko:** średni. Zadbać, by migracja pozostała **możliwa** — chodzi o nadanie jej
ceny, nie o zablokowanie.

**Wpływ edukacyjny:** wzmacnia właściwy przekaz — przetrwanie wymierania to **efekt
różnorodności linii**, a nie ucieczki jednym gatunkiem.

---

### P1-C. Zabezpieczenie przed spiralą śmierci
**Problem:** 2.3 — brak szansy na odbicie po jednej złej turze.

**Rozwiązanie:**
- **Dno populacyjne (refugium):** linia nie wymiera od pojedynczego załamania — poniżej
  progu (np. 15 osobników) straty głodowe są łagodzone, dając turę na korektę. Wymarcie
  następuje dopiero po utrzymującym się deficycie.
- **Tania cecha awaryjna** „Spowolniony metabolizm / hibernacja" (koszt ~8 EP,
  `metabolism −2`, `reproduction −1`) — świadoma odpowiedź na kryzys energetyczny.
- **Ostrzeżenie w prognozie:** gdy `energy < 0` i populacja mała, dopisać w
  `renderForecast` czerwony sygnał „⚠️ ryzyko spirali głodu — obniż metabolizm lub zmień niszę".

**Miejsce zmiany:** `engine.js → simulateLineage` (próg dna), `data.js → TRAITS`
(nowa cecha), `ui.js → renderForecast` (ostrzeżenie).

**Koszt/ryzyko:** niski–średni. Uwaga na balans, by dno nie uczyniło gry zbyt łatwą —
stąd łagodzenie, nie pełna nietykalność.

**Wpływ edukacyjny:** ilustruje **strategie przetrwania kryzysu** (obniżenie metabolizmu,
zmiana niszy) zamiast karać gracza bez lekcji.

---

### P2-D. Prowadzenie do celu: wskaźnik postępu + „następny krok ⭐"
**Problem:** 2.4 — gracze utykają w „survived".

**Rozwiązanie:**
- Pasek/kółko postępu inteligencji zamiast surowego „X / cel", z podświetleniem, ile
  jeszcze punktów brakuje i **z ilu tur** można je jeszcze zdobyć.
- Podpowiedź „następny krok na ścieżce ⭐": UI wskazuje najtańszą dostępną cechę z
  `path: 'intelligence'` (np. „Kolejny krok: Mózg — 22 EP").
- **Ostrzeżenie o czasie:** gdy zostało ≤ N tur, a do celu daleko, delikatny komunikat
  „Uwaga: tempo rozwoju mózgu może nie wystarczyć — priorytetyzuj ⭐".

**Miejsce zmiany:** `ui.js → renderStatus` / nowy komponent w panelu aktywnej linii.
Dane są już w `state` (`intelligenceGoal`, `eraIndex`, `turn`, `totalTurns`).

**Koszt/ryzyko:** niski (wyłącznie UI). Duży zwrot w satysfakcji i odsetku zwycięstw.

**Wpływ edukacyjny:** utrwala kluczowy komunikat gry — **inteligencja to świadomy kierunek
rozwoju**, nie efekt uboczny liczebności.

---

### P2-E. Tempo: „szybka tura" i modal tylko przy zdarzeniach
**Problem:** 2.5 — powtarzalność raportu.

**Rozwiązanie:**
- Pełny modal (`showReport`) pokazywać tylko przy **istotnych zdarzeniach**: katastrofa,
  mutacja, wymarcie/specjacja, zmiana ery, przekroczenie progu celu, silna presja/głód.
- W pozostałych turach — lekki **wynik inline** (pasek „+EP, populacja Δ") bez modala.
- Opcjonalny przycisk **„Przewiń do zdarzenia"** / auto-tura, gdy gra idzie gładko.

**Miejsce zmiany:** `ui.js → onSimulate`/`showReport` (warunek istotności na podstawie pól
raportu — `catastrophe`, `event`, `eraChanged`, `status`, `lineReports[].events`).

**Koszt/ryzyko:** niski–średni (tylko UI). Zachować dostępność (komunikaty dla czytników
ekranu) i tryb nauczyciela (możliwość obejrzenia pełnego raportu na żądanie).

**Wpływ edukacyjny:** neutralny–pozytywny; skupia uwagę na **momentach uczących** zamiast
rozmywać je rutyną.

---

### P2-F. Głębia decyzji: synergie i alternatywne ścieżki do rozumu
**Problem:** droga do inteligencji jest w praktyce liniowa (Zwoje → Mózg → Rozbudowany
mózg → społeczne → narzędzia), więc kolejność jest niemal wymuszona.

**Rozwiązanie:**
- **Synergie (combo):** premie za sensowne zestawy cech, np. `pack_hunting` + `social`
  → dodatkowy bonus odżywiania/inteligencji; `insulation` + `endothermy` w zimnym klimacie
  → silniejsza redukcja kosztu metabolizmu. Wzmacnia „budowanie zestawu".
- **Dwie ścieżki do progu rozumu:** np. „inteligencja **społeczna**" (`social` + opieka
  nad potomstwem) vs „inteligencja **narzędziowa**" (`grasping_hand` + `tool_use`) — obie
  prowadzą do celu, ale przez różne kompromisy. Zwiększa rejogralność.
- **Cechy warunkowane niszą:** np. bonus `grasping_hand` większy w niszy lądowej.

**Miejsce zmiany:** `data.js → TRAITS` (nowe pola `synergy`), `engine.js → applyEffects`/
`computeDynamics` (obsługa premii combo).

**Koszt/ryzyko:** średni. Wymaga starannego balansu, by nie było jednej „dominującej" combo.

**Wpływ edukacyjny:** pokazuje, że **adaptacje działają w kontekście** (cecha korzystna
z inną cechą / w innej niszy) — sedno lekcji z `ZALOZENIA.md` 4.3.

---

### P2-G. Mini-quiz po erze z bonusem EP
**Problem:** funkcja jest w założeniach (`ZALOZENIA.md` 6, „nagroda za naukę"), ale **nie
istnieje w kodzie**.

**Rozwiązanie:** po zmianie ery (`eraChanged`) opcjonalne 1–2 pytania z odblokowanych
kart wiedzy (`unlockedKnowledge`); poprawna odpowiedź → mały bonus EP. Pomijalne
(bez kary), by nie przerywało graczom nastawionym na zabawę.

**Miejsce zmiany:** nowe dane `QUIZZES` w `data.js` (powiązane z `KNOWLEDGE`), UI w
`ui.js` przy banerze zmiany ery.

**Koszt/ryzyko:** średni. W pełni addytywne (nie rusza balansu rdzenia).

**Wpływ edukacyjny:** bezpośrednio realizuje cel dydaktyczny — **utrwalanie pojęć** z nagrodą.

---

### P3-H. Uczciwsza losowość + tryb z ziarnem
**Problem:** mutacje (`rollMutation`: 28% szansy, ±1, 60% korzystnych) i zdarzenia (22%)
są niewidoczne i mogą wywrócić plan; brak powtarzalności utrudnia lekcje.

**Rozwiązanie:**
- Silnik już przyjmuje `rng` w `simulateTurn` — dodać **opcjonalne ziarno** (deterministyczny
  generator), by nauczyciel mógł powtórzyć tę samą partię na lekcji.
- Rozważyć łagodniejszy **dryf** (mutacje jako drobne korekty), by losowość „dosypywała"
  zmienność, a nie wywracała strategię — zgodnie z `ZALOZENIA.md` 4.4 („losowość ograniczona,
  by decyzje pozostały znaczące").
- Pokazywać szansę mutacji/zdarzenia w UI (transparentność).

**Miejsce zmiany:** `engine.js → simulateTurn`/`rollMutation`, `ui.js` (opcja ziarna,
info o szansach).

**Koszt/ryzyko:** niski–średni. Deterministyczny RNG ułatwia też testy.

**Wpływ edukacyjny:** wspiera tryb lekcyjny (powtarzalny scenariusz do omówienia).

---

### P3-I. Cele opcjonalne / osiągnięcia per era
**Rozwiązanie:** krótkie wyzwania („przetrwaj perm z ≥2 liniami", „wejdź na ląd do dewonu",
„osiągnij mózg przed mezozoikiem") z odznaką w podsumowaniu i eksporcie. Motywacja do
rejograwania i różnych strategii.

**Miejsce zmiany:** dane `ACHIEVEMENTS` w `data.js`, sprawdzanie w `engine.js`, prezentacja
w `ui.js` (ekran końcowy, eksport `buildSummaryText`).

**Koszt/ryzyko:** niski (addytywne).

---

### P3-J. Podgląd wielu linii naraz
**Problem:** prognoza i statystyki dotyczą tylko **aktywnej** linii (`renderForecast`,
`renderActiveLineage`); przy wielu liniach trzeba przełączać, by ocenić ryzyko każdej.

**Rozwiązanie:** kompaktowa tabela/karty wszystkich żywych linii (nisza, populacja, Δ
prognozy, sygnał ryzyka) — decyzje o migracji/specjacji bez ciągłego przełączania.

**Miejsce zmiany:** `ui.js` (nowy widok listy linii, korzysta z `Engine.forecast`
per linia — funkcja już to umożliwia).

**Koszt/ryzyko:** niski (tylko UI).

---

## 4. Plan wdrożenia etapami

1. **Etap 1 — balans rdzenia (P1-A, P1-B, P1-C).** Największy wpływ na „czy decyzje mają
   znaczenie". Wymaga aktualizacji `test/engine.test.js` i weryfikacji osiągalności celu na
   każdej trudności.
2. **Etap 2 — czytelność i tempo (P2-D, P2-E, P3-J).** Głównie UI, niskie ryzyko, szybki
   wzrost satysfakcji i odsetka zwycięstw.
3. **Etap 3 — głębia i edukacja (P2-F, P2-G, P3-H, P3-I).** Rozbudowa treści i rejogralności
   po ustabilizowaniu balansu.

Po każdym etapie: przejść testy silnika (`node test/engine.test.js`) i ręcznie rozegrać
trzy scenariusze (pełna ewolucja / podbój lądu / epoki lodowcowe), sprawdzając osiągalność
wszystkich trzech zakończeń.

## 5. Metryki sukcesu (do obserwacji w testach grywalności)

- **Rozkład zakończeń** — mniej „przypadkowych survived", więcej świadomych won/lost.
- **Różnorodność strategii** — czy grywalne są ścieżki inne niż jedna „optymalna".
- **Użycie specjacji** — czy służy dywersyfikacji, a nie farmieniu EP.
- **Przetrwalność katastrof** — czy wynika z rozproszenia linii, nie z ucieczki całością.
- **Długość sesji** — dopasowanie do jednostki lekcyjnej 45 min (`ZALOZENIA.md` 11).

## 6. Ryzyka

- **Balans EP i kompromisów** wymaga iteracji — zmiany P1 mogą przestrzelić w którąś stronę;
  wprowadzać po jednej i mierzyć osiągalność celu.
- **Nie przeciążyć UI** — wskaźniki i ostrzeżenia (P2-D, P1-C) mają prowadzić, nie zagłuszać.
- **Zgodność z filozofią projektu** — utrzymać rozdział logika/UI i dane jako konfigurację;
  nowe mechaniki dodawać jako dane tam, gdzie to możliwe (nisze, cechy, quizy).
- **Dostępność i i18n** — nowe teksty przez warstwę `js/i18n.js`; zachować wsparcie klawiatury
  i `prefers-reduced-motion`.

---

*Dokument otwarty na iterację. Rekomendacja: zacząć od Etapu 1 (P1-A/B/C) jako zmian o
największym wpływie na jakość decyzji, a następnie warstwy czytelności (Etap 2).*
