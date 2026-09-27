# Ewolucja — recenzja stanu gry (27.09.2026)

Stan oceniany: gałąź domyślna `claude/evolution-game-assumptions-ep2rfr`
(commit `3ab237a`, wersja 0.2.0). Recenzja opiera się na lekturze kodu,
uruchomieniu testów i budowy, zrzutach ekranu z Chromium (`npm run shots`)
oraz na symulacji Monte Carlo: 500 partii na każdą strategię i poziom
trudności, prowadzonych przez boty grające bezpośrednio na silniku.

> **Aktualizacja (27.09.2026):** wykonano kroki 1 i 2 rekomendacji. Paski
> statystyk są naprawione, a silnik i dane z `game-improvements-fixes-xt7ru9`
> zostały przeniesione na obecną warstwę graficzną (błędy 1–5 z sekcji 1
> naprawione, 98 testów silnika). Opis poniżej dotyczy stanu **sprzed** tych
> zmian.

---

## Werdykt w skrócie

**Grafika i warsztat: 8/10. Rozgrywka: 4/10. Całość: 5,5/10.**

Ewolucja wygląda jak porządnie wydana gra edukacyjna: spójny styl „ryciny
naukowej”, zwierzę rysowane z cech, animowana diorama, drzewo życia.
Pod tą oprawą działa jednak prosty i przewidywalny silnik. Jedna strategia
(„idź prosto po mózg”) wygrywa niemal zawsze. Środowisko jest z góry
zapisane i identyczne w każdej partii. Gracza, który nic nie robi, gra
nigdy nie zabija. Oprawa obiecuje dziś więcej, niż mechanika daje.

Po stronie mechaniki są już gotowe, przetestowane poprawki, ale leżą na
niescalonych gałęziach (patrz sekcja 4).

---

## 1. Stan techniczny

| Obszar | Stan |
|---|---|
| Testy (`npm test`) | ✅ 35 testów silnika i 35 testów ryciny, wszystkie przechodzą |
| Budowa (`npm run build`) | ✅ typy OK, `dist/index.html` ≈ 930 KB (399 KB gzip), działa z `file://` |
| Architektura | ✅ silnik (`js/engine.js`) to czysta logika bez DOM, dane są w `js/data.js`, stan jest niemutowalny (stąd cofanie w trybie nauczyciela) |
| Warstwa graficzna | ✅ TypeScript, PixiJS, Canvas 2D, poziomy jakości, auto-obniżanie, `prefers-reduced-motion` |
| Dług techniczny | ⚠️ dwie epoki kodu obok siebie: stary `js/*.js` (IIFE/ES5, 1058 linii w `ui.js`) i nowy `src/*.ts`; README ma dwie sekcje „Struktura projektu” |
| Zbudowany plik w repo | ⚠️ `dist/index.html` trzeba ręcznie przebudować i zatwierdzić, łatwo o rozjazd ze źródłami |

### Zauważone błędy

1. **Paski statystyk są puste** (widać to na zrzutach, np. przy „Odżywianie 5”).
   `.stat-fill` to `<span>` bez `display:block`, więc przeglądarka ignoruje
   `width`. Poprawka to jedna linia w `css/styles.css:475`
   (`display:block;`). Ten sam błąd naprawiono już na gałęziach
   `project-graphics-upgrade` i `beautiful-franklin`, ale nie trafił na główną.
2. **Karta wiedzy „Podbój lądu” (`land`) jest nieosiągalna.** Żadna ścieżka
   w silniku nie woła `unlockKnowledge(…, 'land')`. Poprawka jest na
   `game-improvements-fixes` (1.1).
3. **Prognoza „co-jeśli” pomija efekty obecności cechy** (np. to, że
   stałocieplność znosi karę za zimno); liczy tylko zmiany statystyk.
   Poprawka jest na `game-improvements-fixes` (1.4).
4. **Scenariusz „Epoki lodowcowe”** daje startowe kończyny, ale linia
   zaczyna w wodzie. Poprawka jest na `game-improvements-fixes` (1.5).
5. Opis „Zwojów nerwowych” mówi o wyższym metabolizmie, a cecha go nie
   podnosi.

---

## 2. Rozgrywka — co pokazała symulacja

Wyniki z 500 partii na wiersz. Strategie: „mózg najpierw” (ścieżka ⭐),
„ląd, potem mózg” (z migracją na ląd), „nic nie rób”, „tylko obrona” oraz
„losowo” (losowe zakupy).

| Poziom | Mózg najpierw | Ląd → mózg | Nic nie rób | Tylko obrona | Losowo |
|---|---|---|---|---|---|
| Łatwy | **100% wygr.**, śr. tura 9,7 / 20 | 100% (tura 9,0) | 0% wygr., **0% wymarć** | 0% wygr., 0% wymarć | 57–77% |
| Normalny | **96–99%**, tura 13,6 | 99–100% (tura 13,6) | 0% wygr., **0% wymarć** | 0% / 0% | 7–30% |
| Trudny | 43–52%, tura 14,6 | 72–100% | 0% / 0% | 0% / 0% | 1–4% |

Co z tego wynika:

- **Jedna dominująca strategia.** Na poziomie normalnym ścieżka ⭐ wygrywa
  praktycznie zawsze, a z migracją na ląd w 100% partii. Wybór cech poza tą
  ścieżką nie ma znaczenia dla wyniku.
- **Gra kończy się w połowie.** Zwycięstwo przychodzi średnio w 10.–14.
  turze z 20, czyli w mezozoiku. Kenozoik z jego kamieniami milowymi
  („Ręka chwytna”, „Używanie narzędzi” za 34 EP) jest w praktyce
  zbędny. Cel inteligencji 14 można osiągnąć bez narzędzi:
  1 + 2 + 3 + 4 + 2 + 1 plus jedna szczęśliwa mutacja.
- **Brak realnego zagrożenia.** Organizm bazowy nie może wymrzeć. Przegrać
  da się tylko wtedy, gdy samemu kupi się kosztowne metabolicznie cechy.
  Presja środowiska istnieje w raportach, ale nie w wynikach.
- **Inteligencja nie wpływa na przetrwanie.** Daje tylko EP i warunek
  zwycięstwa (w `computeDynamics` nie występuje), więc mózg to po prostu
  „pasek postępu”, a nie adaptacja z kompromisem.
- **Zero regrywalności świata.** Wszystkie 20 tur (tlen, pokarm,
  drapieżniki, katastrofy) jest zapisanych na stałe w `data.js`. Po jednej
  partii gracz zna przyszłość. Losowe są tylko mutacje (±1) i dwa
  pozytywne zdarzenia.
- **Ekonomia EP jest płaska.** Stała premia +12 EP za turę dominuje nad
  premiami za wzrost i liczebność (zwykle +1–3), więc zarządzanie
  populacją prawie się nie opłaca.
- **Specjacja i nisze to dobre pomysły z małą wagą.** Pomagają przetrwać
  katastrofy, ale skoro przetrwanie nie jest zagrożone, rzadko są
  potrzebne.

Na plus: prognoza następnej tury, jawne kompromisy każdej cechy, rozbicie
EP w raporcie i karty wiedzy dobrze uczą, *dlaczego* coś się stało. Jako
**lekcja na 45 minut** gra spełnia swoje założenia. Jako **gra** nie
stawia wyzwania po pierwszym przejściu.

---

## 3. Oprawa i interfejs

**Mocne strony**

- Spójny, rzadko spotykany styl „ilustracji przyrodniczej”: szeryfowa
  typografia, papierowa paleta, skala „1 cm / 20 cm” na rycinie.
- Zwierzę składane z cech: każda z 24 cech ma widoczny odpowiednik, co
  sprawdza test. Galeria form (od prazwierzęcia po „gatunek rozumny”)
  robi wrażenie.
- Diorama niszy i ery oraz animacja tury (atak, głód, narodziny, meteoryt)
  dobrze wiążą liczby ze zdarzeniami.
- Tryb jasny i ciemny, wersja mobilna, obsługa klawiatury, ustawienia
  jakości grafiki.

**Słabe strony**

- Panel adaptacji to bardzo długa lista (≈ 3400 px na desktopie). Wszystkie
  24 karty są zawsze widoczne, także zablokowane, więc do „Układu nerwowego”,
  gdzie toczy się właściwa gra, trzeba przewijać.
- Puste paski statystyk (błąd 1) osłabiają czytelność najważniejszego panelu.
- Raport tury jest suchy (tabelka liczb). Nie mówi, co było *decyzją*
  gracza, a co losowością.
- Część nazw i ikon zostaje przy emoji w danych (`icon: '🐟'`), mimo że
  interfejs przeszedł na SVG. To niespójne dla przyszłych zmian.

---

## 4. Niescalone gałęzie — co mogłoby poprawić grę

Wszystkie gałęzie poza jedną odchodzą od commitu `0721bef`, czyli sprzed
przejścia na Vite/TypeScript (etapy 0–6). **Żadna nie scala się bez
konfliktów** (konflikty w `ui.js`, `index.html`, `styles.css`, `README.md`).
Dobra wiadomość: `js/engine.js` i `js/data.js` na głównej gałęzi **nie
zmieniły się** od `0721bef`, więc zmiany silnika z gałęzi przenoszą się
czysto. Ręcznej pracy wymaga tylko UI.

| Gałąź | Co wnosi | Testy | Kierunek | Ocena |
|---|---|---|---|---|
| **`game-improvements-fixes-xt7ru9`** | Poprawki błędów 1.1–1.7 i balans: migracja kosztuje EP, zwycięstwo wymaga „Używania narzędzi” (kenozoik), warunki tur losowane wokół historycznych, selektywne katastrofy, inteligencja mutuje tylko z mózgiem; boty balansu (`test/bots.js`) | 98 ✅ | zachowuje obecną grę | ⭐ **Scalić jako pierwszą** |
| `gameplay-modification-proposal-cevyh6` | Koniec farmienia EP przez specjację, refugium przed spiralą śmierci, synergie cech, alternatywna droga do rozumu (mowa), ziarno RNG, osiągnięcia, quizy, szybka tura | 50 ✅ | zachowuje obecną grę | Dobre pomysły UI, ale **ułatwia** grę (w mojej symulacji wygrana już w turze 11); wybrać pojedyncze elementy |
| `game-assumptions-mechanics-bzqqmp` | Nazwany rywal zamiast `predatorLevel`, zdarzenia z wyborem przed turą, markery na wykresie | 47 ✅ | zachowuje obecną grę | Zdarzenia z wyborem warto przenieść; grafika jest już przestarzała |
| `gifted-knuth-mxmrxt` | **Przebudowa 2.0**: zamiast sklepu losowy draft mutacji, a o ich szerzeniu decyduje dobór (model logistyczny) i dryf; świat z ziarna, konkurenci, pojemność nisz, radiacja adaptacyjna, quiz, wynik | 80 ✅ | głębsza, nadal edukacyjna | Najciekawszy model biologiczny; boty: mądry gracz 65%, zachłanny 4%, losowy 0% na normalnym, czyli **realna krzywa umiejętności**. Duża praca przy przenoszeniu UI |
| `beautiful-franklin-dd90q2` | Pojemność środowiska, wąskie gardło, cechy zależne od niszy i klimatu, losowy świat, rywale NPC, mutacje do wyboru, quizy, osiągnięcia, wynik, zwycięstwo przez narzędzia + własna grafika | 66 ✅ | edukacyjna | Mechaniki bogate, grafika wypiera obecną (gorszą od niej). Brać tylko silnik |
| `game-mechanics-redesign-8u258x` | Pula genowa, zmienność genetyczna jako zasób, dobór płciowy, 4 typy obrony, NPC, zwiastuny; **usuwa** Kodeks, tryb nauczyciela i edukację | 66 ✅ | rozrywkowa | Zmienia tożsamość gry, więc to decyzja produktowa, nie „poprawka” |
| `game-mature-assumptions-i2kufe` | Tylko nowe założenia (16+, strategia głębokiego czasu) | – | dojrzała strategia | Dokument, nie kod |
| `graphics-layer-improvement-qiun70`, `project-graphics-upgrade-6bduz6`, `playable-version-0d0wbe` | Wcześniejsze podejścia do grafiki i jednoplikowego buildu | – | – | **Zastąpione** przez etapy 0–6 na głównej; do zamknięcia (z `project-graphics` można wziąć tylko poprawkę pasków) |
| `graphics-level-options-7zbbjd` | Etapy 5–6 grafiki | – | – | **Już scalona** (PR #2) |

### Rekomendowana kolejność

1. **Od razu:** jednolinijkowa poprawka pustych pasków statystyk.
2. **Przenieść silnik i dane z `game-improvements-fixes`** (czysto, bo
   `engine.js` i `data.js` są nietknięte) i dostosować ręcznie ok. 100
   linii w `ui.js`. To naprawia błędy 2–5, wydłuża grę do kenozoiku i
   daje testy balansu. Moja symulacja na tej gałęzi: „mózg najpierw” na
   normalnym spada z 99% do ~35% wygranych, a zwycięstwo przesuwa się
   na turę ~16–17.
3. **Dołożyć wybrane elementy** z `cevyh6` (ziarno RNG, osiągnięcia,
   refugium, szybka tura) i `bzqqmp` (zdarzenia z wyborem).
4. **Decyzja kierunkowa:** czy gra ma zostać edukacyjna, czy iść w stronę
   `gifted-knuth` (dobór częstości cech, najlepsza „biologia” i krzywa
   umiejętności) albo `8u258x` (czysta rozrywka). Przy trzech równoległych
   przebudowach trzeba wybrać jedną, bo każda wymaga przeniesienia UI na
   nową warstwę TypeScript.
5. Zamknąć gałęzie zastąpione i scalone, żeby repozytorium nie myliło.

### Problem, którego nie rozwiązuje żadna gałąź

Na `game-improvements-fixes` i `cevyh6` strategia „nic nie rób” nadal
przeżywa w 100% partii. Brak zakupów powinien kończyć się co najmniej
realnym ryzykiem wymarcia, np. przez rosnącą presję drapieżników lub
konkurentów niezależnie od obrony gracza. Rozwiązania z pojemnością i
konkurencją NPC (`gifted-knuth`, `beautiful-franklin`) idą w tę stronę.

---

## 5. Uczciwe podsumowanie

**Co się udało:** wyjątkowo staranna oprawa, czysta architektura, testy,
dostępność, gra działająca offline z jednego pliku, wartościowe treści
edukacyjne (Kodeks, powiązania z prawdziwymi skamieniałościami).

**Co nie działa:** gra jest rozwiązana po jednym przejściu. Świat jest
stały, jest jedna wygrywająca ścieżka, nie ma zagrożenia dla biernego
gracza, a trzecia era jest w praktyce niepotrzebna. Ostatnie 7 etapów
prac poszło w grafikę, podczas gdy gotowe, przetestowane poprawki
rozgrywki czekają na gałęziach od kilku dni.

**Dla kogo dziś:** na jedną lekcję biologii, jako interaktywna ilustracja
doboru naturalnego, sprawdzi się dobrze. Dla kogoś, kto chce zagrać drugi
raz, jeszcze nie. Po przeniesieniu `game-improvements-fixes` gra
realnie awansowałaby do ~6,5–7/10 bez zmiany jej charakteru.
