# Ewolucja 🧬

Edukacyjna gra przeglądarkowa o **doborze naturalnym** i historii życia,
inspirowana *Evolution: The Game of Intelligent Life* (1997).

Poprowadź populację zwierząt przez trzy ery — od prostego organizmu w morzu aż do
gatunku rozumnego. W każdej turze w populacji pojawiają się **losowe mutacje**;
wskazujesz, którą warto rozwinąć, ale o tym, czy się rozprzestrzeni, decyduje
**dobór naturalny** w warunkach Twojej niszy. Każdy świat jest inny.

> Gra edukacyjna. Model jest świadomie uproszczony — służy zrozumieniu
> mechanizmów, nie odwzorowaniu konkretnych gatunków. Pełne założenia
> projektowe: [`ZALOZENIA.md`](./ZALOZENIA.md), projekt rozgrywki 2.0 i porównanie
> rozważanych wariantów: [`GAMEPLAY.md`](./GAMEPLAY.md).

## Jak uruchomić

Nie wymaga instalacji ani budowania. Wystarczy otworzyć plik **`index.html`**
w przeglądarce (Chrome, Firefox, Edge, Safari):

- kliknij dwukrotnie `index.html`, **albo**
- uruchom lokalny serwer, np.: `python3 -m http.server` i wejdź na `http://localhost:8000`.

Gra działa w pełni po stronie przeglądarki i zapisuje postęp lokalnie
(`localStorage`) — można ją także używać offline.

## Jak grać

1. Nazwij gatunek, opcjonalnie wpisz **kod świata** (ten sam kod = ten sam świat —
   cała klasa może grać na jednym i porównać wyniki) albo wybierz **wyzwanie dnia**.
2. **🎲 Mutacje** — co turę każda linia dostaje 3 losowe mutacje. Pierwszą wybierasz
   za darmo; trafia do ~30% osobników. Strzałka (↑/↓/≈) podpowiada, czy w nadchodzących
   warunkach dobór będzie jej sprzyjał.
3. **🧬 Pula genowa** — częstość każdej cechy rośnie, gdy cecha pomaga przeżyć w danej
   niszy i klimacie, a maleje, gdy szkodzi (plus przypadkowy dryf genetyczny). Od 95%
   cecha jest utrwalona, poniżej 5% zanika.
4. **🗺️ Nisze** — woda, przybrzeże, ląd, powietrze: inny pokarm, drapieżniki i
   konkurenci. Migracja zmienia kierunek doboru (płetwy pomagają w wodzie, kończyny na
   płyciznach i lądzie). **Specjacja** rozdziela linię — najlepiej do innej niszy.
5. **🔭 Zapowiedź** pokazuje warunki następnej tury i kolejnej: zdarzenia (susza,
   epidemia, zakwit…) i katastrofy z ich rodzajem — odporne cechy warto rozprzestrzenić
   zawczasu.
6. **Zmienność genetyczna (🧬 ZG)** rośnie z liczebnością i liczbą nisz; wydajesz ją na
   dodatkowe mutacje, ponowne losowanie, migrację i specjację.
7. **Cele ery** i **quiz** po erze dają premie ZG i punkty.

**Cel:** doprowadzić którąkolwiek linię do progu inteligencji. Mózg jest drogi
energetycznie — rozprzestrzeni się tylko tam, gdzie jego przewaga przeważy nad kosztem.

Zakończenia: **zwycięstwo**, **przetrwanie** lub **wymarcie** — każde z **wynikiem
punktowym** (rekordy scenariuszy zapisywane lokalnie).

## Struktura projektu

```
index.html         — struktura strony i ekranów
css/styles.css     — warstwa prezentacji (tryb jasny/ciemny, responsywność, dostępność)
js/data.js         — dane gry: cechy, era, karty wiedzy (konfiguracja)
js/engine.js       — silnik symulacji: czysta, testowalna logika (bez DOM)
js/ui.js           — kontroler interfejsu: render, zdarzenia, zapis lokalny
test/engine.test.js — testy silnika
test/bots.js       — boty (świadomy / zachłanny / losowy) do testów balansu
test/balance.js    — raport balansu na wielu losowych światach
```

Zgodnie z założeniami (sekcja 9) logika gry jest **oddzielona od UI** i
testowalna niezależnie, a dane (cechy/era/wiedza) są konfiguracją — łatwą do
rozbudowy bez zmian w kodzie.

## Testy

Silnik ma zestaw testów bez zależności zewnętrznych:

```bash
node test/engine.test.js
```

Testy sprawdzają m.in. odtwarzalność świata z ziarna, draft mutacji i koszty,
kierunek doboru zależny od niszy i klimatu, dryf, konkurencję i pojemność
środowiska, odporność na katastrofy, cele ery, quiz, wynik oraz **balans**:
boty rozgrywają po 40 losowych światów i sprawdzane jest, że świadoma strategia
często wygrywa, losowe decyzje prawie nigdy, a trudność jest monotoniczna.

Pełny raport balansu (wszystkie scenariusze × trzy style gry):

```bash
node test/balance.js 200
```

## Funkcje

- **Genetyka populacyjna** — cechy mają częstość w populacji; dobór naturalny
  (model logistyczny) i dryf genetyczny zmieniają ją z tury na turę.
- **Draft losowych mutacji** zamiast sklepu z cechami — gra uczy, że ewolucja nie ma celu.
- **30 cech** z efektami **warunkowymi** (inne w wodzie, na lądzie, w zimnie, przy
  niskim tlenie), odpornościami na rodzaje katastrof i mutacjami **utraty cech**.
- **Losowy, odtwarzalny świat** (ziarno / kod świata / wyzwanie dnia) z zapowiedzią
  2 tur naprzód i 7 rodzajami zdarzeń.
- **Cztery nisze** z rodzimymi konkurentami, **pojemnością środowiska** i konkurencją
  między własnymi liniami; **radiacja adaptacyjna** po wymieraniach.
- **Trzy ery** (paleozoik → mezozoik → kenozoik, 20 tur) z realnymi datami i
  **wymieraniami masowymi** (ordowickie, permskie, K–Pg, zlodowacenia).
- **Specjacja** do wybranej niszy i **drzewo życia**; **minimalna populacja żywotna**.
- **Cele ery**, **quiz** po erze, **wynik punktowy** i rekordy scenariuszy.
- Cztery scenariusze (pełna ewolucja, podbój lądu, twardy świat, epoki lodowcowe).
- Prognoza **„co-jeśli”** po najechaniu na mutację, **samouczek**, **tryb nauczyciela**
  (cofanie), **eksport podsumowania**, **Kodeks wiedzy** (22 pojęcia z odniesieniami
  do zapisu kopalnego).
- Zapis lokalny, tryb jasny/ciemny, responsywność, dostępność.

## Struktura projektu (uzupełnienie)

```
js/i18n.js  — stringi interfejsu (warstwa i18n)
```

## Status

Wersja **2.0** z przebudowaną rozgrywką (GAMEPLAY.md). Dalsze możliwe kroki:
tryb offline (PWA), tryb wieloosobowy (wspólny świat z kodu), kolejne języki,
ranking klasowy.
