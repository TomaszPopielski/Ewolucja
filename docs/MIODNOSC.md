# Ewolucja — analiza miodności i propozycje (01.10.2026)

**Oceniany stan:** commit `e421156` (po scaleniu PR #11: sieć troficzna, konkurenci,
echa, prolog, Antropocen). Testy przechodzą, a `npm run build` daje plik identyczny
z `dist/index.html`.

> **Stan wdrożenia:** wszystkie propozycje A1–D6 są już w grze. Co powstało i jak
> wypadły mierniki, opisuje [sekcja 7](#7-stan-po-wdrożeniu).

**O czym jest ten dokument.** Balans i sens mechanik opisuje już
[`OCENA-MECHANIK.md`](./OCENA-MECHANIK.md). Tutaj pytam o coś innego: **jak się w to
gra** (rytm tury, tarcie, nagroda, napięcie) i **czy chce się wrócić** (co zostaje po
partii, czym druga partia różni się od pierwszej).

**Metoda.**

- **Partia w prawdziwym interfejsie.** `dist/index.html` w Chromium (Playwright),
  1366×900, świat `MIOD01`, decyzje podejmuje bot `tactics`. Mierzyłem czas animacji
  każdej tury, objętość raportu, położenie przycisków i wysokość strony.
- **Metryki na silniku.** 200 partii na wariant (boty `tactics` i `clade`, poziom
  normalny i łatwy, ziarna 1–200, połowa partii na lądzie, połowa w wodzie). Liczyłem
  puste tury, karty, chwilę rozstrzygnięcia, różnorodność stworzeń, cele er i osiągnięcia.

> Boty nie odczuwają nudy ani radości. Liczby pokazują, **gdzie** gra może męczyć albo
> się powtarzać. Czy faktycznie męczy, trzeba sprawdzić na ludziach (sekcja 6).

---

## Werdykt w skrócie

| Pętla | Ocena | Jednym zdaniem |
|---|---|---|
| **Chwila** (klik, zakup, tura) | **5/10** | Piękna oprawa, ale główny przycisk jest schowany, a tura to „obejrzyj 7 s, przeczytaj tabelę”. |
| **Partia** (łuk 20 tur) | **6/10** | Katastrofy dają dramat, ale finał to zakup, a przegrana partia ciągnie się do końca bez sygnału. |
| **Powrót** (dlaczego jeszcze raz) | **3/10** | Po partii zostaje 17 odznak i rekord. Kodeks się zeruje, stworzeń nie da się zebrać, a talia kart kończy się po 3 partiach. |
| **Różnorodność** (czy partie się różnią) | **5/10** | Kod świata i dwie drogi do rozumu działają, ale 7 cech trafia do prawie każdego „bohatera”, więc stworzenia są do siebie podobne. |

Najważniejszy wniosek: **rdzeń jest już dobry.** Uczy, ma stawkę i wygląda świetnie.
Brakuje dwóch rzeczy: **płynności tury** i **czegoś, co zostaje między partiami**. Obie
da się dodać bez ruszania balansu silnika.

---

## 1. Pomiary

### 1.1. Interfejs (partia `MIOD01`, wygrana w 19. turze)

| Miernik | Wynik | Uwagi |
|---|---|---|
| Położenie „Przeżyj turę” na desktopie | **y = 2027 px** | W przyklejonym panelu bocznym z własnym przewijaniem (2006 px treści w oknie 616 px przy 1366×768 i 928 px przy 1920×1080). Bez przewinięcia przycisku nie widać na żadnym z tych ekranów. Na telefonie przycisk jest przyklejony do dołu. |
| Wysokość ekranu gry | 3150–3480 px | 26 kart cech jest zawsze widocznych, także zablokowanych i niedostępnych w tej erze. |
| Skróty klawiszowe | brak | Escape zamyka tylko część okien. Spacja i Enter nic nie robią. |
| Animacja tury | **średnio 6,9 s** (4,2–11,2 s) | ok. **130 s oglądania na partię**. Do wyboru są tylko „pokazuj” i „pomijaj”. |
| Raport tury | **średnio 158 słów**, 12–15 wierszy liczb | Wszystko na jednym poziomie ważności, bez nagłówka „co się stało”. |
| Najdłuższy raport | 373 słowa, **6 nowych kart wiedzy naraz** | Tura 3 (pierwsze wymieranie i pierwszy głód). Ściana tekstu dokładnie w chwili, gdy gracz chce wiedzieć, ile stracił. |
| Dźwięk | brak | |
| Ekran startowy dla powracającego gracza | taki sam jak dla nowego | Nie widać rekordu, odznak ani poprzednich gatunków. |

### 1.2. Silnik (200 partii, poziom normalny)

| Miernik | `tactics` | `clade` | Co to znaczy dla gracza |
|---|---|---|---|
| Wynik: wygrana / przetrwanie / wymarcie | 62 / 34 / 5% | 68 / 25 / 8% | Co trzecia dobrze rozegrana partia kończy się „przetrwaniem”, czyli porażką o włos. |
| **Puste tury** (brak zakupu i brak karty) | **30%** | 24% | Co trzecia tura to: kliknij, obejrzyj, przeczytaj, „Dalej”. |
| Tury bez zakupu | 38% | 31% | |
| Karty decyzji na partię | **4,5** (25% tur) | 4,3 | README mówi „w większości tur”, a `CHOICE_CHANCE` = 0,55. W praktyce kartę dostaje co czwarta tura (446 kart w 1778 turach). Warto sprawdzić, czy to zamierzone. |
| Unikalne karty po 1, 2, 3, 4, 5, 6 partiach | 7, 9, 10, **13, 13, 13** z 19 | | Talia „kończy się” po 3–4 partiach. Kilka kart-ech prawie nigdy nie pada. |
| Tura zwycięstwa | **15: 40%, 16: 24%**, 17–20: 36% | 15–16: 70% | Najwcześniejsza możliwa tura to 15. Zwycięstwo przychodzi zwykle zaraz po odblokowaniu kultury, jako skutek zakupu. |
| Sygnał „zwycięstwo niemożliwe” w partiach bez wygranej | 42 z 77, **średnio w turze 17,9** | 32 z 65, tura 17,3 | Sygnał jest uczciwy, ale przychodzi na samym końcu, więc nie oszczędza czasu. |
| Największy spadek populacji w jednej turze | średnio 57% | 51% | Katastrofy naprawdę bolą. To dobre źródło dramatu. |
| Cele er zaliczone | **33%** (293 z 900) | | „Liczna populacja” (300 osobników) i „Bogata pula genów” (20 🧬): **0 na 103**. „Przestworza”: 0 na 74. Nagroda to 6–12 EP. |
| Podobieństwo kolejnych „bohaterów” (Jaccard cech) | **0,45** | 0,45 | Zwoje 100%, łuski 96%, mózg 96%, oczy 93%, stałocieplność 90%, izolacja 89%, liczne jaja 86%. Szybkie mięśnie 5%, lot ≤ 1%. |
| Osiągnięcia zdobywane przez kompetentnego gracza | „Iskra rozumu” 62%, „Przyspieszona ewolucja” 52%, drogi 30–36%, „Wielkie Umieranie” 13–23% | | 8 z 17 odznak: 0–3% partii („Sieć troficzna”, „Zasada Gausego”, „Radiacja”, „Przestworza”, „Kronikarz er”, „Obfitość”, „Encyklopedysta”, „Skutki decyzji”). „Zrównoważona cywilizacja” wymaga epilogu, którego boty nie grają. |
| Wynik punktowy p10 / p50 / p90 | 336 / 908 / 1119 | 328 / 992 / 1111 | |

---

## 2. Diagnoza

### 2.1. Pętla chwili: tura jest za ciężka, a za mało w niej decyzji

Najczęstsza czynność w grze to „Przeżyj turę”, a na desktopie ten przycisk jest
schowany na dole przewijanego panelu bocznego. Gracz robi to 20 razy na partię.
Pomiędzy przewija ścianę 26 kart, w tym kilkanaście szarych, zablokowanych.

Sama tura ma rytm **„obejrzyj → przeczytaj → zamknij”**. Animacja jest ładna, ale tak
samo długa w turze bez zdarzeń, jak w turze wymierania. Raport to księga rachunkowa:
populacja, straty, pojemność, rezerwy, zmienność, inteligencja, pięć rodzajów EP.
Brakuje zdania, które opowiada turę, i podziału na to, co zrobił gracz, a co przyniósł
los. Pierwsze tury zasypują gracza naraz sześcioma kartami wiedzy, czyli najcenniejszą
warstwą edukacyjną, podaną w najgorszym możliwym momencie.

W 30% tur gracz nie ma nic do zrobienia, bo nie stać go na cechę, a karta nie
padła. Gry, do których się wraca, dają **małą decyzję w każdej turze** i nagradzają
ją natychmiastowym, widocznym skutkiem.

### 2.2. Pętla partii: dobry środek, słaby koniec

**Środek działa.** Zapowiedziane katastrofy, spadki populacji o połowę, przygotowania
(rezerwy, zasięg, nisze) i karty z ryzykiem budują napięcie. To najlepsze momenty gry.

**Koniec jest antyklimatyczny.** 64% zwycięstw przypada na tury 15–16, czyli
zaraz po tym, jak w kenozoiku odblokowują się narzędzia albo kultura akustyczna.
Kulminacją jest zakup za 34 EP i jedna tura czekania. Narodziny rozumu, temat całej
gry, dzieją się w pasku statystyk.

**Przegrana się ciągnie.** Co trzecia dobra partia kończy się „przetrwaniem”, a sygnał
„już nie wygrasz” pojawia się średnio w ostatniej turze. Zakończenia przetrwania mają
już własne tytuły (*Władcy przestworzy*, *Wielka radiacja*, *Gatunek-legion*, *Wąskie
gardło i powrót*, *Żywa skamielina* w `ENDINGS.legacy`), ale gracz dowiaduje się o nich
dopiero na ekranie końcowym. Nie może do nich celować.

**Cele er** to dobry pomysł o zbyt małej wadze. Nagroda 6–12 EP przy cechach za
10–34 EP i premii +8 EP za każdą niszę ledwo coś zmienia. Dwa cele są w praktyce
nieosiągalne (300 osobników przy pojemności niszy około 200, 20 🧬 przy zmienności
zużywanej na specjację i dobór).

### 2.3. Pętla powrotu: po partii prawie nic nie zostaje

To najsłabsze miejsce i zarazem najtańsze do poprawienia.

- **Kodeks się zeruje.** Odkrycia są zapisane w `state.unlockedKnowledge`, czyli w
  bieżącej partii. Nowa gra zaczyna z pustym Kodeksem, a odznaka „Encyklopedysta”
  (25 pojęć w jednej partii) wpada w 1–3% partii. Kolekcja, naturalny motor powrotów
  w grze edukacyjnej, nie rośnie.
- **Stworzeń nie da się zebrać.** Gra rysuje unikalną rycinę z cech, a na ekranie
  końcowym pokazuje „drogę ewolucji”. Po kliknięciu „Zagraj ponownie” to wszystko
  znika. W `localStorage` zostają tylko rekord (`ewolucja.best`) i lista odznak
  (`ewolucja.achievements`).
- **Nie ma nic do odblokowania.** Trzy scenariusze, trzy poziomy i 17 odznak, które
  niczego nie otwierają. Plan budowy (kręgowiec, stawonóg, głowonóg) jest losowany
  z kodu świata 50/25/25 i jest wyłącznie kosmetyczny.
- **Ekran startowy nie wita powracającego gracza.** Nie widać na nim „Twoje gatunki:
  7”, „Rekord: 1119”, „Odznaki: 5/17” ani „Dzisiejszy świat”.
- **Treść wyczerpuje się szybko.** Po 4 partiach gracz zna 13 z 19 kart. Karty nie są
  związane z okresem, więc kambr i kenozoik losują z tej samej talii.

### 2.4. Różnorodność: partie różnią się światem, ale nie bohaterem

Kod świata, przesuwane wymierania, konkurenci i dwie drogi do rozumu sprawiają, że
**świat** jest za każdym razem inny. **Bohater** jest jednak za każdym razem podobny.
Siedem cech trafia do niemal każdego zwycięzcy, a cechy efektowne wizualnie (lot,
szybkie mięśnie, pancerz) prawie nigdy. Na ekranie końcowym rycina „rozumnej ryby
w futrze z łuskami” wygląda podobnie z partii na partię, a to przecież główna
pamiątka z gry.

---

## 3. Propozycje

Każda propozycja ma: **co**, **dlaczego** (pomiar z sekcji 1), **jak** (gdzie
w kodzie), **koszt** (S — godziny, M — 1–2 dni, L — tydzień i więcej) i **miernik**.
Kolejność wewnątrz grup to kolejność wdrażania.

### A. Tarcie i rytm tury — szybkie wygrane

**A1. Pasek akcji przyklejony do dołu ekranu także na desktopie + skróty klawiszowe** · S

- *Dlaczego:* główny przycisk leży na y = 2027 px, wewnątrz przewijanego panelu.
- *Jak:* reguła z `@media (max-width: 820px)` dla `#btn-simulate` (`css/styles.css`)
  w wersji na każdy ekran, jako pasek: EP do wydania · karta czeka · „Przeżyj turę →”.
  W `js/ui.js` (`init`, obsługa `keydown`): **Spacja/Enter** — tura, gdy nie ma
  otwartego okna; **Enter** — „Dalej” w raporcie; **1–3** — opcja karty decyzji;
  **Escape** zamyka też raport. Pasek stanu ma już `status-choice` („Karta decyzji
  czeka”), więc wystarczy go powiązać.
- *Miernik:* 0 px przewijania do głównej akcji. Partia klawiaturą bez myszy.

**A2. Panel adaptacji: widok „Teraz” zamiast ściany 26 kart** · M

- *Dlaczego:* ekran ma 3150–3480 px, z czego większość to karty, których nie da się
  kupić.
- *Jak:* w `renderTraits` (`js/ui.js`) przełącznik „Dostępne teraz / Wszystkie”.
  Karty zablokowane i niedostępne w erze zwinięte do jednej linii („Lot — od
  mezozoiku, 22 EP”). Na górze wyróżniony „następny krok ⭐” dla wybranej drogi.
  Kategoria „Układ nerwowy”, gdzie toczy się właściwa gra, wyżej.
- *Miernik:* wysokość ekranu gry poniżej 1800 px w widoku „Teraz”.

**A3. Raport jako nagłówek, szczegóły na żądanie** · M

- *Dlaczego:* 158 słów i 12–15 równorzędnych wierszy liczb na turę.
- *Jak:* w `showReport` (`js/ui.js`) na górze:
  1. **jedno zdanie-historia** złożone z największych składników tury, np. „Zakwit
     planktonu: +31 narodzin, ale rekiny zjadły 12. Ławica urosła do 148.”;
  2. **duża liczba** (Δ populacji) i **Δ EP**;
  3. **dwa wiersze przyczyn**: „Twoja decyzja” (strategia r: +9 narodzin, karta: …)
     i „Los” (odchylenie warunków, mutacja, wynik ryzyka).

  Dzisiejsza tabela trafia do zwiniętego `<details>` „Pełny rachunek tury”. Silnik
  ma już te liczby w `lineReports`. Przy okazji warto domknąć punkt 1.9 z
  `ULEPSZENIA.md`: zdarzenia jako `{type, params}`, nie regex po polskim tekście.
- *Miernik:* nagłówek raportu do 40 słów. Czas od otwarcia raportu do „Dalej”
  (test z graczami).

**A4. Najwyżej jedna nowa karta wiedzy na raport** · S

- *Dlaczego:* w turze 3 pada 6 nowych kart naraz (2626 znaków).
- *Jak:* w raporcie pokazać najważniejszą kartę (priorytet: katastrofa → głód →
  reszta), pozostałe dopisać do Kodeksu z plakietką „Nowe w Kodeksie (5)” na
  przycisku w nagłówku. Kolejną kartę pokazać w turze, w której nic nowego nie
  padło. Tempo nauki pozostaje to samo, tylko rozłożone w czasie.
- *Miernik:* ≤ 1 nowa karta na raport. Liczba odkrytych pojęć na partię bez zmian.

**A5. Tempo animacji zależne od wagi tury** · S

- *Dlaczego:* 130 s oglądania na partię, a tura bez zdarzeń trwa tyle samo co
  wymieranie.
- *Jak:* w `src/diorama/turnplay.ts` tryb „skrócony” (ok. 1,5 s: żerowanie i bilans)
  dla tur bez katastrofy, mutacji i dużej zmiany populacji. Pełna animacja zostaje
  dla tur ważnych. W ustawieniach (`src/art/settings.ts`) trzecia opcja: „pokazuj
  ważne”, ustawiona domyślnie. Klik w dioramę przewija do końca (jest już etykieta
  `turn.skip`).
- *Miernik:* średnio poniżej 3 s animacji na turę. Pełna animacja zostaje w każdej
  turze katastrofy.

### B. Powód, by wrócić — meta i kolekcje

**B1. Trwały Kodeks** · S/M

- *Dlaczego:* Kodeks się zeruje, a „Encyklopedysta” wpada w 1–3% partii.
- *Jak:* klucz `ewolucja.codex` w `localStorage` jako suma odkryć ze wszystkich
  partii, zapisywana w tym samym miejscu co odznaki (`renderEndScore`) i po każdej
  turze. `showCodex` pokazuje postęp („Odkryto 31 / 45”), a nieodkryte karty jako
  zarysy z podpowiedzią, jak je zdobyć („Przetrwaj wymieranie permskie”). Bieżąca
  partia może dalej wyróżniać pojęcia „odkryte w tej partii”. „Encyklopedysta”
  liczy wtedy pojęcia ze wszystkich partii, a nie z jednej.
- *Miernik:* Kodeks rośnie między partiami. Gracz widzi, czego mu jeszcze brakuje.

**B2. Muzeum gatunków (gablota)** · M

- *Dlaczego:* rycina z cech to najmocniejszy element gry, a po partii znika.
- *Jak:* po każdej partii zapis ok. 1 KB do `ewolucja.museum`: imię gatunku, plan
  budowy, cechy i nisza bohatera (z nich rysuje się miniaturę przez
  `ART.creature.thumb`), „droga ewolucji”, zakończenie i tytuł, wynik, kod świata,
  data. Ekran „Muzeum” to siatka ryciny, a po kliknięciu: karta gatunku z przyciskiem
  „Zagraj ten świat jeszcze raz”. Limit np. 60 wpisów; ulubione się nie usuwają.
- *Miernik:* liczba gatunków w gablocie. Odsetek partii rozpoczętych z gabloty.

**B3. Ekran startowy dla powracającego gracza** · S

- *Dlaczego:* powracający widzi to samo co nowy gracz.
- *Jak:* nad wyborem scenariusza wąski pasek: ostatni gatunek (miniatura) ·
  „Muzeum: 7” · „Odznaki: 5 / 17” · rekord · „Świat dnia” (B4). Długi opis celu
  zwinięty do jednego zdania po pierwszej partii.
- *Miernik:* od wejścia do nowej partii wystarczy jedno kliknięcie.

**B4. Świat dnia (i tygodnia)** · S

- *Dlaczego:* kod świata już gwarantuje, że ten sam kod to ten sam świat. Brakuje
  tylko powodu, by zagrać dziś.
- *Jak:* kod liczony z daty (np. `D261001`), deterministyczny i działający offline.
  Lokalny rekord dnia i licznik dni z rzędu. Raz w tygodniu „wyzwanie” z
  modyfikatorem z D4. Nauczyciel może powiedzieć klasie: „gramy świat dnia”, bez
  przepisywania kodu.
- *Miernik:* odsetek partii w świecie dnia. Liczba dni z rzędu.

**B5. Odznaki widoczne w trakcie gry i „spróbuj następnym razem”** · S

- *Dlaczego:* 8 z 17 odznak zdobywa się w 0–3% partii, a w trakcie gry nie widać
  postępu.
- *Jak:* krótki komunikat (`aria-live`) przy zbliżeniu się do odznaki („Zasada
  Gausego: 1/2 wypartych konkurentów”). Na ekranie końcowym zamiast pełnej listy 17
  szarych kafelków: zdobyte w tej partii plus **2–3 propozycje na następną partię**
  dopasowane do tego, co gracz już ma („Wygrałeś narzędziami — spróbuj drogi
  dźwięku: *Pieśń oceanu*”). Pełna lista w Muzeum. Przy okazji przejrzeć progi
  odznak, które w testach prawie nie padają.
- *Miernik:* średnia liczba nowych odznak w partiach 2–5.

**B6. Rycina do pobrania** · S

- *Dlaczego:* gracze lubią pokazywać swoje stworzenia, a uczniowie chętnie oddają
  pracę w formie obrazka.
- *Jak:* przycisk „Pobierz tablicę (PNG)” na ekranie końcowym i w Muzeum. Canvas
  portretu (`src/creature/portrait.ts`) plus ramka „Tablica”, imię, łacińska nazwa
  (D6), zakończenie, wynik i kod świata. Wszystko lokalnie, bez wysyłania danych.

### C. Każda tura to wybór — rozgrywka

Te zmiany ruszają balans, więc każdą trzeba przepuścić przez boty (`test/bots.js`,
`scripts/boty-balans.js`) i dopisać test, jak przy poprzednich etapach.

**C1. Warianty w puli genów: wybór 1 z 2–3 w turach bez karty** · L

- *Dlaczego:* 30% pustych tur. Mutacje są dziś czysto losowe (±1 do statystyki),
  więc gracz ich nie wybiera i ich nie pamięta.
- *Jak:* w turze bez karty silnik losuje (z `worldRngFor`, więc kod świata dalej
  działa) 2–3 **warianty**, każdy z kompromisem, np. „dłuższe płetwy: mobilność +1,
  metabolizm +0,5” albo „mniejsze ciało: metabolizm −1, obrona −1”. Gracz wskazuje,
  który wariant ma się rozprzestrzenić. Pozostałe giną w dryfie. Zwykła losowa
  mutacja zostaje.
- *Edukacja:* ramka „to nie gracz tworzy mutacje — powstają losowo; środowisko (tu:
  Twój wybór strategii) decyduje, które się rozprzestrzenią”. To ta sama logika co
  ukierunkowany dobór, tylko widoczna i namacalna. Niewykorzystaną kartę „Wybór
  wariantu” można połączyć z dzisiejszym doborem, żeby nie mnożyć przycisków.
- *Miernik:* puste tury poniżej 10%. Podobieństwo bohaterów (Jaccard) poniżej 0,35.
  Odsetek zwycięstw botów w przedziale z `OCENA-MECHANIK.md` §7.2.

**C2. Kontrakty ery zamiast losowych celów** · M

- *Dlaczego:* cele er zalicza się w 33% przypadków, nagroda jest mała, a dwa cele są
  nieosiągalne.
- *Jak:* na starcie ery gracz wybiera **1 z 3** celów (dziś losowane są 2 i przypisane
  z góry). Nagroda to obok EP **przywilej na resztę gry**, np. „−20% ceny cech
  obronnych”, „+1 wariant do wyboru w C1”, „karta decyzji ma 3 opcje”. Progi
  `abundance` i `variation` skalować z liczbą nisz albo obniżyć (`ERA_GOALS` w
  `js/data.js`). Postęp kontraktu widoczny w pasku celów ery (`renderEraInfo`).
- *Miernik:* zaliczone kontrakty 50–70%. Żaden kontrakt nie ma zaliczalności 0%.

**C3. Zwycięstwa alternatywne: tytuły przetrwania jako jawne cele** · M

- *Dlaczego:* co trzecia dobra partia kończy się „przetrwaniem”, które smakuje jak
  porażka, a tytuły w `ENDINGS.legacy` są nieznane do ekranu końcowego.
- *Jak:* od mezozoiku panel „Inne drogi do sukcesu” z paskami postępu: *Władcy
  przestworzy*, *Wielka radiacja*, *Gatunek-legion*, *Wąskie gardło i powrót*.
  W wyniku (`SCORE`) „przetrwanie z tytułem” jest wyraźnie warte więcej niż samo
  przetrwanie, a w Muzeum dostaje własną ramkę. Gdy rozum staje się mało
  prawdopodobny (C5), gra proponuje przełączenie się na jeden z tych celów.
- *Miernik:* odsetek partii zakończonych bez żadnego tytułu poniżej 10%.

**C4. Finał: narodziny rozumu jako scena, nie zakup** · M/L

- *Dlaczego:* 64% zwycięstw w turach 15–16 jako skutek zakupu „Używania narzędzi”
  albo „Kultury akustycznej”.
- *Jak (wariant lekki):* zakup cechy kultury otwiera **„Próbę rozumu”**, łańcuch 2–3
  kart w kolejnych turach (np. ogień albo przechowywanie żywności, język albo
  gesty, przekaz wiedzy albo naśladowanie). Każda karta ma koszt i ryzyko zależne
  od cech, a zwycięstwo ogłasza się po ostatniej. Echa (`n.echoes`) już umieją
  planować karty na przyszłe tury.
  *Jak (wariant mocny):* w kenozoiku pojawia się konkurent z własnym paskiem postępu
  inteligencji (konkurenci są już w `RIVALS`). Robi się z tego wyścig, który
  widać w pasku stanu.

  W obu wariantach ekran zwycięstwa powinien być wydarzeniem: animacja ryciny,
  „Tablica II”, dźwięk (D5).
- *Miernik:* rozkład tury zwycięstwa bardziej płaski: mniej niż 40% zwycięstw
  w turach 15–16 łącznie (dziś 64%).

**C5. Miernik szans zamiast binarnego „niemożliwe”** · M

- *Dlaczego:* sygnał przegranej pada średnio w turze 17,9, czyli praktycznie
  na koniec.
- *Jak:* silnik jest czysty i szybki. Pełna partia bota `adaptive` to ok. 38 ms
  w Node, więc 20–30 symulacji reszty partii zajmuje ok. 1 s. Można je policzyć w
  tle, w trakcie animacji tury (Web Worker albo kawałkami w `requestIdleCallback`),
  na kopii stanu i z osobnym strumieniem losowym, żeby nie zmieniać świata gracza.
  W pasku stanu: „Szansa na rozum ≈ 35%” z trendem ↑↓. Poniżej ok. 5% gra
  proponuje cel alternatywny (C3) albo zakończenie partii. Dzisiejszą hojną ocenę
  `victoryOutlook` można zostawić jako twardą granicę „0%”.
- *Edukacja:* to też lekcja o niepewności i prawdopodobieństwie. Trzeba podpisać,
  że szacunek pochodzi z symulacji.
- *Miernik:* w przegranych partiach sygnał „< 5%” średnio przed 14. turą. Brak
  fałszywych alarmów w wygranych (ten sam test, który dziś pilnuje `victoryOutlook`).

### D. Treść i różnorodność — praca ciągła

**D1. Dwa razy większa talia kart, związana z okresami** · L

- *Dlaczego:* 13 z 19 kart po 4 partiach. Karty nie zależą od okresu.
- *Jak:* pole `periods` albo `eras` w `CHOICE_EVENTS`, np. kambr — „eksplozja
  kambryjska: nowe plany budowy”; karbon — „tlen 35%: olbrzymie stawonogi”;
  kreda — „rośliny kwiatowe i zapylacze”; kenozoik — „trawy i sawanna”, „most
  lądowy — wielka wymiana fauny”. Do tego 2–3 **łańcuchy** po 2–3 karty (mechanika
  ech już istnieje) i rzadkie karty (ok. 5%), o których gracze opowiadają
  („Lazarus — linia uznana za wymarłą odnajduje się w refugium”). Każda nowa karta
  z kartą wiedzy i odniesieniem kopalnym, jak dotąd.
- *Miernik:* unikalne karty po 6 partiach ≥ 25. Karta w co najmniej 40% tur
  (wyjaśnić rozjazd z `CHOICE_CHANCE`).

**D2. Rzadkie cechy-znaki rozpoznawcze** · L

- *Dlaczego:* 7 cech w prawie każdym bohaterze. Efektowne wizualnie cechy nie są
  kupowane.
- *Jak:* 6–8 cech oferowanych losowo (np. jedna na erę, przez C1 albo kartę):
  **jad**, **bioluminescencja** (woda), **elektrorecepcja**, **kolce**,
  **gigantyzm** i **karłowatość wyspowa** (wykluczają się), **sen zimowy**. Każda
  z kompromisem, kartą wiedzy i **wyraźnym rysunkiem** na rycinie (cechy rysuje
  `src/creature/draw.ts`, elementy wspólne planów budowy — `extras.ts`). Test wizualny (`npm run visual`) pilnuje,
  że każda jest widoczna.
- *Miernik:* Jaccard bohaterów poniżej 0,35. Każda rzadka cecha kupowana w 5–40%
  partii, w których ją zaoferowano.

**D3. Plan budowy jako wybór na starcie** · M

- *Dlaczego:* stawonóg i głowonóg są już narysowane, ale dziś to losowa kosmetyka
  (50/25/25 z kodu świata), na którą gracz nie ma wpływu.
- *Jak:* wybór na ekranie startowym albo w prologu, z małą tożsamością mechaniczną,
  np. stawonóg — tańszy pancerz, ale gorsza stałocieplność; głowonóg — tańszy mózg
  i kamuflaż, ale krótkie życie (strategia K droższa). Kręgowiec dostępny od razu,
  pozostałe odblokowane odznakami. Inny plan budowy daje inną partię i inną
  rycinę w Muzeum.
- *Miernik:* każdy plan wygrywa u botów w podobnym przedziale (±10 p.p.).

**D4. Modyfikatory świata i nowe scenariusze jako nagrody** · M

- *Dlaczego:* trzy scenariusze i nic do odblokowania.
- *Jak:* scenariusze są już danymi (`SCENARIOS`: `startEra`, `startTraits`,
  `capMult`, `winPaths`, `forcedGoals`). Wystarczą nowe wpisy i pola. Modyfikatory
  do włączenia na starcie, z mnożnikiem wyniku: „Gorąca Ziemia”, „Ubogi tlen”,
  „Drapieżny świat”, „Bez prognozy” (sam przedział, dla doświadczonych).
  Scenariusze: „Karbon — świat olbrzymów”, „Po K–Pg: radiacja ssaków”, „Wyspa” (mała
  pojemność, karłowatość i gigantyzm) i **tryb otwarty** z `ZALOZENIA.md` §8.
  Odblokowanie przez odznaki, np. „Twarda szkoła” otwiera „Drapieżny świat”.
- *Miernik:* odsetek partii z modyfikatorem po 5. partii.

**D5. Dźwięk proceduralny (opcjonalny)** · M

- *Dlaczego:* gra jest całkiem cicha, a dźwięk to najtańszy sposób na „soczystość”
  zakupu, zagrożenia i zwycięstwa.
- *Jak:* WebAudio bez plików (gra zostaje jednym plikiem offline): stuknięcie
  pieczątki przy zakupie, narastający niski ton przy zapowiedzi katastrofy, akord
  zmiany ery, krótka fanfara zwycięstwa, cichy szum tła niszy. Przełącznik i
  głośność w ustawieniach, domyślnie **wyłączony** (sala lekcyjna). Respektować
  `prefers-reduced-motion` jako sygnał do oszczędnej oprawy.

**D6. Łacińska nazwa i kronika gatunku** · S/M

- *Jak:* nazwa dwuczłonowa składana z cech i niszy (np. *Miodek pinnatus* →
  *Miodek sapiens litoralis*), zmieniana przy kamieniach milowych. Na ekranie
  końcowym **kronika**: po jednym zdaniu na turę („Perm: Wielkie Umieranie.
  Przetrwało 37 osobników.”) zamiast suchej tabeli. Kronika trafia też do eksportu
  dla nauczyciela, co domyka punkt 4.7 z `ULEPSZENIA.md`. Dzięki temu partia ma
  historię, którą da się opowiedzieć.

---

## 4. Kolejność prac i mierniki sukcesu

| Etap | Zakres | Koszt | Rusza balans? |
|---|---|---|---|
| **1. Tarcie i rytm** | A1, A4, A5, potem A2, A3 | ok. 3–4 dni | nie |
| **2. Powód, by wrócić** | B1, B3, B5, B2, B4, B6 | ok. 4–5 dni | nie |
| **3. Każda tura to wybór** | C3, C5, C2, potem C1, C4 | ok. 2–3 tygodnie | tak — boty i testy |
| **4. Treść** | D6, D1, D2, D3, D4, D5 | praca ciągła | częściowo |

Etapy 1–2 nie zmieniają silnika ani balansu, więc są bezpieczne i dają największy
przyrost odczuwalnej jakości na godzinę pracy. Etap 3 to zmiany w rozgrywce, więc
trzeba je mierzyć botami tak, jak w `OCENA-MECHANIK.md`.

| Miernik | Dziś | Cel |
|---|---|---|
| „Przeżyj turę” na desktopie | y ≈ 2030 px, poza ekranem | widoczny bez przewijania |
| Animacja na turę | 6,9 s | < 3 s (pełna tylko w ważnych turach) |
| Nagłówek raportu | 158 słów, bez nagłówka | ≤ 40 słów + szczegóły na żądanie |
| Nowe karty wiedzy na raport | do 6 | ≤ 1 |
| Puste tury | 30% | < 10% |
| Unikalne karty po 6 partiach | 13 | ≥ 25 |
| Podobieństwo bohaterów (Jaccard) | 0,45 | < 0,35 |
| Zwycięstwa w pierwszej możliwej turze | 40% (64% w turach 15–16) | < 40% w turach 15–16 łącznie |
| Sygnał „szansa < 5%” w przegranych | tura 17,9 | przed turą 14 |
| Cele er / kontrakty zaliczone | 33% (dwa na 0%) | 50–70%, żaden na 0% |
| Rzeczy, które zostają po partii | rekord + odznaki | + Kodeks, Muzeum, świat dnia, odblokowania |

Pomiary interfejsu (A1–A5) da się zautomatyzować tak jak w tej analizie: partia
w Chromium z decyzjami bota, pomiar czasu tury, słów w raporcie i położenia
przycisków. Warto dopisać to jako `npm run fun` obok `npm run shots`.

---

## 5. Czego unikać

- **Kolejnych walut i przełączników.** Lewy panel ma już EP, ⚡, 🧬, strategię, dietę,
  zachowanie i dobór. C1 powinien **zastąpić** albo wchłonąć ukierunkowany dobór,
  a nie dojść obok niego.
- **Kolejnych okien modalnych.** Raport, karta wiedzy, zmiana ery, ocena szans
  i odznaka nie mogą się piętrzyć. Rzeczy drugorzędne (odznaki, nowe pojęcia)
  powinny być komunikatami albo plakietkami, a nie oknami.
- **Psucia determinizmu kodu świata.** Wszystko, co losowe (warianty C1, rzadkie
  cechy D2, karty D1), musi iść przez `worldRngFor`, żeby świat dnia i „ten sam
  świat jeszcze raz” dalej działały. Symulacje do C5 muszą używać własnego strumienia.
- **Mitu „ewolucja ma cel”.** Wybór wariantu (C1) i kontrakty (C2) należy opisywać
  jako działanie doboru i środowiska, a nie jako „projektowanie” zwierzęcia. Punkt
  4.3 z `ULEPSZENIA.md` (karta „Ewolucja nie ma celu — cel ma gracz”) warto zrobić
  razem z C1.
- **Wydłużania partii.** Dzisiejsza partia mieści się w lekcji. A5 i A3 ją skracają,
  więc zyskany czas można przeznaczyć na C1, ale nie na kolejne tury.
- **Zbierania danych.** Muzeum, Kodeks i świat dnia działają lokalnie, w
  `localStorage`, bez kont i serwera (`ZALOZENIA.md` §9: prywatność uczniów).

---

## 6. Jak sprawdzić to na ludziach

Boty nie powiedzą, czy gra jest przyjemna. Prosty protokół przed etapem 1 i po
etapie 2:

1. 5–8 osób z grupy docelowej (klasy 6–8 i dorośli), każda gra 2 partie po kolei,
   bez instrukcji poza samouczkiem.
2. Obserwator notuje: gdzie gracz szuka przycisku, które raporty zamyka bez
   czytania, w której turze pierwszy raz mówi „nudzi mnie” albo „o nie!”.
3. Po pierwszej partii jedno pytanie: **„Chcesz zagrać jeszcze raz?”** (tak / może /
   nie) i dlaczego. Po drugiej: „Co było inne niż w pierwszej?”
4. Mierzone: czas partii, liczba przewinięć, odsetek osób, które same zaczynają
   trzecią partię.

Jeśli po etapach 1–2 odsetek „tak, jeszcze raz” wyraźnie rośnie, a czas partii
spada, kierunek jest dobry i można przejść do etapu 3.

---

## 7. Stan po wdrożeniu

Wdrożone są wszystkie propozycje z sekcji 3. Silnik pozostał czysty i deterministyczny:
nowe losowania (warianty, rzadkie cechy, kontrakty, karty) idą przez `worldRngFor`,
więc kod świata, Świat dnia i „ten sam świat jeszcze raz” działają jak wcześniej.
Szacunek szans (C5) używa własnego strumienia i „przyszłych światów” z przyrostkiem,
więc nie zdradza przyszłości.

### 7.1. Co jest w grze

| Prop. | Wdrożenie |
|---|---|
| A1 | Pasek akcji przyklejony do dołu na każdym ekranie: EP, karta czeka, szansa na rozum, „Przeżyj turę”. Skróty: spacja/Enter (tura), 1–4 (opcja karty, kontraktu lub wariantu), K (Kodeks), D (drzewo), Esc. |
| A2 | Panel cech z przełącznikiem „Teraz / Wszystkie”. Widok „Teraz” to zwarta siatka cech do kupienia i „następny krok ⭐”. Reszta jest zwinięta. |
| A3 | Nagłówek raportu: zdanie-historia tury, Δ populacji i Δ EP, wiersze „Twoje decyzje” (tylko zmienione) i „Los”. Pełny rachunek jest w `<details>`. |
| A4 | Najwyżej jedna nowa karta wiedzy na raport (priorytet: katastrofa → głód → reszta). Pozostałe czekają w kolejce, a przycisk Kodeksu ma plakietkę. |
| A5 | Animacja „tylko ważne tury” jest domyślna. Pełna zostaje przy katastrofie, nowej erze, specjacji i dużym spadku. Kliknięcie dioramy ją pomija. |
| B1 | Kodeks zapisywany między partiami: 70 haseł, postęp „Odkryto x / 70”, zarysy nieodkrytych z podpowiedzią. |
| B2 | Muzeum gatunków: rycina, łacińska nazwa, zakończenie, wynik, kod świata, plan budowy i modyfikatory każdej zakończonej partii. Ulubione nie wypadają z gabloty. |
| B3 | Ekran startowy dla powracającego gracza: Świat dnia, wyzwanie tygodnia, rekordy, ostatni gatunek z Muzeum, postęp Kodeksu i to, co zostało do odblokowania. |
| B4 | Świat dnia (kod `D` + data, passa dni) i wyzwanie tygodnia (stały świat i jeden modyfikator). |
| B5 | Odznaki z postępem: komunikat przy zdobyciu w trakcie gry, na końcu trzy „spróbuj następnym razem” z postępem z tej partii i lista wszystkich 22. |
| B6 | Tablica PNG z ryciną, nazwą i kodem świata do pobrania. |
| C1 | Pula genów: w turach bez karty 2 warianty z 14. Utrwalenie kosztuje 2 🧬, ma podgląd w prognozie i kompromis. Opis mówi o doborze, nie o „projektowaniu”. |
| C2 | Kontrakty er: 1 z 3 celów na erę, nagroda EP ×1,5, punkty i jeden z 10 trwałych atutów. |
| C3 | Tytuły przetrwania z paskiem postępu od pierwszej tury, punktami i odznaką. |
| C4 | Próba rozumu: karta-scena po osiągnięciu progu („Ogień” albo „Imiona”). Ryzyko, premia i odznaka. Porażka kosztuje, ale nie odbiera zwycięstwa. |
| C5 | Szansa na rozum w pasku stanu: 12 symulacji reszty partii (`js/advisor.js`, liczone kawałkami w tle) z kalibracją. Po dwóch niskich odczytach (od tury 6) gra podpowiada zmianę kursu. Nie kończy partii. |
| D1 | Talia 29 kart (było 14) + 8 ech + 2 próby rozumu. 10 kart okresowych (np. „Eksplozja różnorodności”, „Bagienne lasy”) i 2 rzadkie. |
| D2 | 7 rzadkich cech (jad, bioluminescencja, elektrorecepcja, kolce, gigantyzm, karłowatość, sen zimowy), jedna na erę z kodu świata. Każda jest widoczna na rycinie (wzorce `test/visual/21–26`). |
| D3 | Plany budowy: kręgowiec, stawonóg, głowonóg. Zmieniają koszty cech i statystyki startowe. Odblokowują się odznakami. |
| D4 | 4 modyfikatory świata (mnożnik wyniku 1,15–1,25) i 3 nowe scenariusze: „Po K–Pg: radiacja ssaków”, „Wyspa”, tryb otwarty. |
| D5 | Dźwięk WebAudio bez plików, domyślnie wyłączony. |
| D6 | Łacińska nazwa z cech i niszy (np. *Miodetherium sapiens*), kronika partii (zdanie na turę) na ekranie końcowym i w eksporcie dla nauczyciela. |

Przy okazji zrobione punkty z `ULEPSZENIA.md`: 3.6, 4.3 (karta „Ewolucja nie ma
celu — cel ma gracz”), 4.6, 4.7, 5.4 (komunikaty jako toasty z `aria-live`) i 5.5.

### 7.2. Mierniki: przed, cel, po

Pomiary powtarza `npm run fun` (`scripts/fun-metrics.js` na silniku,
`scripts/fun-ui.mjs` w Chromium).

| Miernik | Przed | Cel | Po | |
|---|---|---|---|---|
| „Przeżyj turę” na desktopie | y ≈ 2030 px | widoczny bez przewijania | widoczny (pasek u dołu, 1366×768) | ✅ |
| Wysokość ekranu gry | 3150–3480 px | < 1800 px | 2227 px | ❌ blisko |
| Czas tury do raportu (z animacją) | 6,9 s | < 3 s | 2,9 s | ✅ |
| Nagłówek raportu | 158 słów, bez nagłówka | ≤ 40 słów | średnio 57, najwyżej 74 | ❌ |
| Nowe karty wiedzy na raport | do 6 | ≤ 1 | ≤ 1 | ✅ |
| Tury bez decyzji do podjęcia | 30%¹ | < 10% | 1% | ✅ |
| Unikalne karty po 6 partiach | 13 | ≥ 25 | 23 (`clade`), 19 (`tactics1`) | ❌ blisko |
| Podobieństwo bohaterów (Jaccard) | 0,45 | < 0,35 | 0,43 / 0,41 | ❌ |
| Zwycięstwa w turach 15–16 | 64–70% | < 40% | 24% / 16% | ✅ |
| Sygnał „szansa < 5%” w przegranych | tura 17,9 | przed turą 14 | tura 9,3² | ✅ |
| Cele er / kontrakty zaliczone | 33% | 50–70%, żaden na 0% | 64–67% | ⚠️ |
| Rzeczy, które zostają po partii | rekord + odznaki | + Kodeks, Muzeum, świat dnia, odblokowania | wszystkie | ✅ |

¹ Przed: tura bez zakupu i bez karty. Po: tura, w której nie ma karty, wariantów ani
kontraktu (zakup cechy jest możliwy zawsze). Definicje się różnią, bo przed zmianą
poza kartą nie było czego wybierać.

² 40 partii, 12 symulacji na szacunek: sygnał dostały wszystkie 15 przegranych.
Surowy szacunek spadł jednak poniżej 5% także w 5 z 25 wygranych partii. Dlatego gra
kalibruje szacunek, czeka na dwa niskie odczyty i tylko podpowiada, a nie kończy
partii. Kalibracja w skrajnych przedziałach jest dobra (szacunek 90–100% → 92% wygranych,
0–10% → 12%), w środku jest szum (12 symulacji to mało).

**Czego nie osiągnięto i dlaczego.**

- **Nagłówek raportu (57 słów zamiast 40).** Zdanie-historia i dwa wiersze przyczyn
  zostały, ale w turach z kartą, wariantem i katastrofą robi się ich sporo. Dalszy krok:
  wiersz „Los” tylko przy dużym odchyleniu, a nazwa karty bez opisu skutku.
- **Wysokość ekranu (2227 px).** Panel cech jest już krótki, a resztę zajmują dioramy,
  panel linii, kontrakt i tytuły. Dalszy krok: zwijane panele boczne na desktopie.
- **Podobieństwo bohaterów (0,41–0,43).** Plany budowy, rzadkie cechy i warianty
  pomagają, ale boty i tak idą najkrótszą drogą do rozumu (zwoje, mózg, łuski,
  stałocieplność). Ludzie prawdopodobnie grają bardziej różnorodnie. Trzeba to
  sprawdzić na graczach (sekcja 6).
- **Talia (23 z 29 kart po 6 partiach).** Karty okresowe padają tylko w swoim okresie,
  a rzadkie (waga 0,2) — rzadko z założenia. To blisko celu.
- **Kontrakty.** Średnio 64–67% (cel osiągnięty), ale boty prawie nie wypełniają
  „Bogatej puli genów” (1 z 22), bo wydają 🧬 na warianty, a „Syta era” wychodzi
  w 21%. Te kontrakty są do dostrojenia, gdy będą dane od graczy.

### 7.3. Balans po zmianach

Boty z `test/bots.js`, 100 partii na wiersz, % zwycięstw:

| Wariant | `clade` | `tactics1` |
|---|---|---|
| Normalny (przed zmianami: 68 / 62³) | 67 | 59 |
| Łatwy / trudny | 86 / 28 | — |
| Ląd / woda | 69 / 64 | — |
| Bez wariantów (C1 wyłączone) | 65 | 49 |
| Kontrakt zawsze pierwszy z oferty (bez wyboru) | 61 | 56 |
| Plany: kręgowiec / stawonóg / głowonóg | 68 / 78 / 72 | — |
| Modyfikatory: Gorąca Ziemia / Ubogi tlen / Drapieżny świat | 50 / 52 / 40 | — |
| Scenariusze: radiacja ssaków / Wyspa / Podbój lądu / Epoki lodowcowe | 67 / 63 / 97 / 63 | 67 / 53 / 90 / 63 |

³ Przed zmianami w sekcji 1.2 był bot `tactics`. `tactics1` to ten sam gracz taktyczny
z jedną linią, który dodatkowo wybiera kontrakty i warianty.

Ogólny poziom trudności się nie zmienił, a nowe decyzje mają wagę: pula genów daje
+2–10 pkt proc. zwycięstw (w porównaniu z grą bez wariantów), a wybór kontraktu zamiast
brania pierwszego z oferty +3–6 pkt proc.
Modyfikatory są wyraźnie trudniejsze i dlatego podnoszą mnożnik wyniku. Sama ścieżka
⭐ bez myślenia (`star`) dalej przegrywa: 0% na normalnym, 12% w epokach lodowcowych.

<sub>Metodologia: partia w Chromium (Playwright, `dist/index.html` z commita `e421156`,
1366×900, świat `MIOD01`, decyzje bota `tactics`, wygrana w 19. turze), pomiar położenia
przycisku przy 1366×768 i 1920×1080. Metryki silnika: boty `tactics` i `clade` z
`test/bots.js`, 200 partii (ziarna 1–200, świat `BOT<n>`, połowa partii lądowa, połowa
wodna), poziom normalny i łatwy. Karty na turę: 100 partii, 1778 tur. Cele er: 150
partii, 900 celów. Czas symulacji: 50 partii na bota, Node.</sub>
