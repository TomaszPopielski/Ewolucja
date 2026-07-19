# Ewolucja — założenia projektowe gry przeglądarkowej

Edukacyjna gra strategiczna inspirowana *Evolution: The Game of Intelligent Life* (Discovery Channel Multimedia / Crossover Technologies, 1997).
Celem gracza jest poprowadzenie linii rozwojowych organizmów od prostych form życia
aż do powstania gatunku inteligentnego, przy jednoczesnym poznawaniu mechanizmów
doboru naturalnego, adaptacji i historii życia na Ziemi.

> **Charakter projektu.** Jest to gra **edukacyjna** o ewolucji biologicznej.
> Nie zawiera treści szkodliwych i nie stanowi żadnego zagrożenia — służy nauce
> przez zabawę (biologia, paleontologia, ekologia).

---

## 1. Cel i grupa docelowa

### 1.1. Cel edukacyjny
- Zrozumienie mechanizmu **doboru naturalnego** (zmienność → dziedziczenie → selekcja).
- Poznanie **skali czasu geologicznego** i kolejnych er (prekambr → paleozoik → mezozoik → kenozoik).
- Nauka pojęć: mutacja, adaptacja, nisza ekologiczna, presja środowiskowa, wymieranie, specjacja, koewolucja.
- Zbudowanie intuicji, że złożoność życia jest wynikiem długich procesów, a nie „projektu”.

### 1.2. Cel rozrywkowy
- Prosta w opanowaniu, satysfakcjonująca pętla rozgrywki „obserwuj → decyduj → adaptuj".
- Poczucie długoterminowego postępu (od bakterii do cywilizacji).

### 1.3. Grupa docelowa
- Uczniowie szkół podstawowych (klasy 6–8) i średnich — jako pomoc dydaktyczna.
- Nauczyciele biologii (tryb lekcyjny / demonstracyjny).
- Gracze dorośli zainteresowani tematyką popularnonaukową.

---

## 2. Filary rozgrywki

1. **Symulacja doboru naturalnego** — gracz nie steruje pojedynczym zwierzęciem, lecz *populacją* i kierunkiem jej adaptacji.
2. **Zarządzanie punktami ewolucji (Evolution Points, EP)** — waluta zdobywana za przetrwanie i sukces reprodukcyjny, wydawana na cechy (traity).
3. **Zmienne środowisko** — klimat, poziom tlenu, dostępność pożywienia i drapieżniki zmieniają się w czasie, wymuszając adaptację.
4. **Drzewo cech i drzewo życia** — rozwój gatunku widoczny jako rozgałęziające się drzewo filogenetyczne.
5. **Warstwa wiedzy** — każda mechanika ma powiązaną „kartę wiedzy” z krótkim, rzetelnym wyjaśnieniem naukowym.

---

## 3. Pętla rozgrywki (game loop)

```
┌────────────────────────────────────────────────────────────┐
│  1. FAZA ŚRODOWISKA   → losowanie/rozwój warunków epoki      │
│  2. FAZA ADAPTACJI    → gracz wydaje EP na cechy populacji   │
│  3. FAZA SYMULACJI    → tura przeżycia (żerowanie, drapież-  │
│                         nictwo, rozmnażanie, mutacje)        │
│  4. FAZA WYNIKU       → naliczenie EP, zmiana liczebności,   │
│                         ewentualna specjacja lub wymarcie    │
│  5. FAZA WIEDZY       → karta edukacyjna, quiz, podsumowanie │
└────────────────────────────────────────────────────────────┘
                     ↺ powrót do fazy 1 (kolejna epoka)
```

Jedna „tura" reprezentuje umowny odcinek czasu geologicznego (np. kilka mln lat).
Gra dzieli się na **ery** — każda era to zestaw tur o wspólnych warunkach i wyzwaniach.

---

## 4. Mechaniki szczegółowe

### 4.1. Populacja i statystyki gatunku
Każdy gatunek gracza opisują atrybuty:

| Atrybut | Znaczenie |
|---|---|
| Liczebność | Ile osobników liczy populacja (0 = wymarcie). |
| Odżywianie | Zdolność zdobywania pokarmu (roślinożerność / mięsożerność / wszystkożerność). |
| Obrona | Odporność na drapieżniki i zagrożenia. |
| Rozród | Tempo przyrostu populacji. |
| Mobilność | Zdolność migracji do nowych nisz. |
| Metabolizm | Zapotrzebowanie energetyczne (wysokie = ryzyko przy głodzie). |
| Inteligencja | Postęp w kierunku celu końcowego (gatunek rozumny). |

### 4.2. Cechy (traity) i punkty ewolucji
- EP zdobywa się za: przetrwanie tury, wzrost liczebności, zajęcie nowej niszy, wygrane starcia.
- EP wydaje się na **cechy** pogrupowane w kategorie: *lokomocja, zmysły, pokarm, obrona, rozród, termoregulacja, układ nerwowy*.
- Cechy mają **warunki wstępne** (drzewo zależności) — np. „pióra" wymagają wcześniej „łusek" i „stałocieplności".
- Każda cecha ma **koszt** i **kompromis (trade-off)** — nic nie jest darmowe (np. duży rozmiar = lepsza obrona, ale wyższy metabolizm).

### 4.3. Środowisko i presja selekcyjna
Parametry epoki, które modyfikują skuteczność cech:
- **Klimat** (zlodowacenia ↔ okresy ciepłe).
- **Poziom tlenu** w atmosferze.
- **Dostępność pokarmu** (rośliny, zdobycz, plankton).
- **Presja drapieżników** (gatunki NPC i gatunki innych graczy w trybie wielo­osobowym).
- **Katastrofy** (wymierania masowe — np. uderzenie meteorytu, wulkanizm) jako rzadkie „resety" niszczące niedostosowane gatunki.

Zasada: **cecha korzystna w jednej epoce może być obciążeniem w innej** — to serce lekcji o doborze naturalnym.

### 4.4. Mutacje i losowość
- Co turę istnieje szansa na **losową mutację** (darmowa cecha lub jej wariant) — modeluje zmienność genetyczną.
- Mutacje bywają korzystne, neutralne lub szkodliwe — selekcja „odsiewa" szkodliwe.
- Element losowości jest ograniczony, by decyzje gracza pozostały znaczące.

### 4.5. Specjacja i drzewo filogenetyczne
- Gdy część populacji zaadaptuje się do odrębnej niszy, gracz może wykonać **rozdzielenie gatunku** (specjacja) → nowa gałąź na drzewie życia.
- Gracz może prowadzić kilka linii równolegle, dywersyfikując ryzyko.
- Wizualizacja: interaktywne, rozgałęziające się **drzewo życia** pokazujące historię wszystkich linii (żywych i wymarłych).

### 4.6. Warunek zwycięstwa i porażki
- **Zwycięstwo:** osiągnięcie progu inteligencji → wyewoluowanie gatunku rozumnego zdolnego do kultury/technologii.
- **Porażka:** wymarcie wszystkich linii gracza.
- **Tryb otwarty (sandbox):** brak sztywnego celu, dowolne eksperymentowanie z ewolucją.

---

## 5. Progresja przez ery geologiczne

| Era | Kluczowe wyzwania | Kamienie milowe cech |
|---|---|---|
| Prekambr | Życie jednokomórkowe, tlen, pierwsza wielokomórkowość | Fotosynteza, ruch, wielokomórkowość |
| Paleozoik | Wyjście na ląd, pierwsze kręgowce | Szkielet, płetwy→kończyny, oddychanie powietrzem |
| Mezozoik | Dominacja gadów, wielkie ekosystemy | Jaja lądowe, termoregulacja, rozmiar |
| Kenozoik | Ssaki, klimat, rozwój mózgu | Stałocieplność, opieka nad potomstwem, duży mózg |
| Antropocen (cel) | Narzędzia, język, kultura | Inteligencja abstrakcyjna, ręka chwytna, mowa |

---

## 6. Warstwa edukacyjna

- **Karty wiedzy** — po każdym istotnym zdarzeniu krótkie (2–4 zdania), rzetelne wyjaśnienie naukowe z ilustracją.
- **Encyklopedia (Kodeks)** — zbiór odblokowanych pojęć i gatunków, dostępny w każdej chwili.
- **Mini-quizy** — opcjonalne pytania po erze; poprawne odpowiedzi dają bonus EP (nagroda za naukę).
- **Ciekawostki paleontologiczne** — powiązanie fikcyjnych gatunków gracza z realnymi organizmami kopalnymi.
- **Tryb nauczyciela** — możliwość zapauzowania, cofnięcia tury i omówienia decyzji na lekcji; scenariusze dydaktyczne.
- **Rzetelność merytoryczna** — treści zgodne z aktualnym stanem wiedzy (teoria ewolucji, skala czasu geologicznego); uproszczenia oznaczane jako uproszczenia.

---

## 7. Interfejs i doświadczenie użytkownika (UX)

- **Główny ekran:** mapa/ekosystem epoki + panel gatunku + pasek EP + oś czasu geologicznego.
- **Panel adaptacji:** przejrzyste drzewo cech (odblokowane / dostępne / zablokowane), koszty i kompromisy widoczne przed zakupem.
- **Panel wyniku tury:** czytelne podsumowanie „co się stało i dlaczego" (kluczowe dla edukacji).
- **Drzewo życia:** interaktywna wizualizacja linii rozwojowych.
- **Styl graficzny:** przyjazny, „naukowo-ilustracyjny" (styl planszy edukacyjnej), czytelny na tablicy multimedialnej.
- **Dostępność:** duże kontrasty, wsparcie klawiatury, alternatywne opisy tekstowe, tryb dla daltonistów, responsywność (desktop + tablet).
- **Język:** polski jako podstawowy, architektura gotowa na i18n (tłumaczenia).

---

## 8. Tryby gry

1. **Kampania** — prowadzenie od życia jednokomórkowego do gatunku rozumnego, z narastającą trudnością.
2. **Sandbox** — swobodna ewolucja bez celu końcowego, do eksperymentów i lekcji.
3. **Scenariusze edukacyjne** — krótkie, tematyczne wyzwania (np. „przetrwaj epokę lodowcową", „skolonizuj ląd").
4. **Tryb wieloosobowy (opcjonalny, późniejszy etap)** — gatunki graczy konkurują o zasoby w jednym ekosystemie (koewolucja, drapieżnictwo).

---

## 9. Architektura techniczna (propozycja)

- **Platforma:** aplikacja przeglądarkowa (bez instalacji), działająca offline po pierwszym wczytaniu (PWA).
- **Front-end:** HTML5 + CSS3 + JavaScript/TypeScript; framework SPA (np. React lub Svelte); rendering ekosystemu przez Canvas 2D/SVG.
- **Logika gry:** oddzielony, testowalny „silnik symulacji" (czysta logika, niezależna od UI) — ułatwia testy i modyfikacje reguł.
- **Stan i zapisy:** LocalStorage / IndexedDB dla zapisów lokalnych; opcjonalny backend tylko dla trybu wieloosobowego i statystyk klasowych.
- **Dane gry jako konfiguracja:** cechy, ery, wydarzenia i karty wiedzy w plikach danych (JSON) — łatwe do rozbudowy i recenzji merytorycznej bez zmian w kodzie.
- **Wydajność:** lekka symulacja (operacje na populacjach, nie na pojedynczych osobnikach), płynne działanie na sprzęcie szkolnym.
- **Prywatność:** brak zbierania danych osobowych uczniów; zgodność z zasadami prywatności w edukacji.

---

## 10. Zakres MVP (pierwsza grywalna wersja)

Minimalny, ale kompletny fragment pętli, aby zweryfikować pomysł:

1. Jedna era (np. paleozoik) z 5–8 turami.
2. ~15 cech w drzewie z kosztami i kompromisami.
3. Podstawowa symulacja: żerowanie, drapieżnictwo, rozród, mutacja.
4. System EP i ekran adaptacji.
5. Ekran wyniku tury z czytelnym wyjaśnieniem.
6. 3–5 kart wiedzy i prosty Kodeks.
7. Zapis/wczytanie lokalne.
8. Warunek zwycięstwa/porażki w obrębie ery.

**Poza MVP (kolejne iteracje):** pełne ery, drzewo życia, quizy, tryb nauczyciela, wieloosobowość, i18n.

---

## 11. Ryzyka i kwestie do rozstrzygnięcia

- **Balans EP i kompromisów** — wymaga iteracyjnych testów, by decyzje były znaczące, a gra sprawiedliwa.
- **Równowaga edukacja ↔ rozrywka** — warstwa wiedzy nie może przytłaczać zabawy ani odwrotnie.
- **Uproszczenia naukowe** — konieczna konsultacja merytoryczna (biolog/dydaktyk), by uproszczenia nie utrwalały błędnych wyobrażeń (np. „ewolucja ma cel").
- **Prawa autorskie** — inspiracja oryginałem z 1997 r. bez kopiowania grafik, nazw własnych i chronionych treści; własna identyfikacja wizualna.
- **Długość sesji** — dopasowanie czasu rozgrywki do jednostki lekcyjnej (45 min).

---

## 12. Słownik pojęć (dla warstwy edukacyjnej)

- **Dobór naturalny** — proces, w którym osobniki lepiej przystosowane do środowiska częściej przeżywają i wydają potomstwo.
- **Mutacja** — losowa zmiana materiału genetycznego, źródło zmienności.
- **Adaptacja** — cecha zwiększająca dostosowanie organizmu do środowiska.
- **Nisza ekologiczna** — zespół warunków i zasobów, w których gatunek funkcjonuje.
- **Specjacja** — powstanie nowego gatunku z istniejącej populacji.
- **Wymieranie masowe** — gwałtowny zanik wielu gatunków w krótkim (geologicznie) czasie.
- **Koewolucja** — wzajemne oddziaływanie ewolucyjne gatunków (np. drapieżnik–ofiara).

---

*Dokument roboczy — założenia otwarte na iterację po testach grywalności i konsultacji dydaktycznej.*
