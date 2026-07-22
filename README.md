# Ewolucja 🧬

Edukacyjna gra przeglądarkowa o **doborze naturalnym** i historii życia,
inspirowana *Evolution: The Game of Intelligent Life* (1997).

Poprowadź linię rozwojową zwierząt przez erę **paleozoiku** — od prostego
organizmu w morzu aż do gatunku o rozwiniętym mózgu. Wydawaj **punkty ewolucji**
na cechy, dostosowuj się do zmiennego środowiska i ucz się, jak działa ewolucja.

> Gra edukacyjna. Model jest świadomie uproszczony — służy zrozumieniu
> mechanizmów, nie odwzorowaniu konkretnych gatunków. Pełne założenia
> projektowe: [`ZALOZENIA.md`](./ZALOZENIA.md).

## Jak uruchomić

Nie wymaga instalacji ani budowania. Wystarczy otworzyć plik **`index.html`**
w przeglądarce (Chrome, Firefox, Edge, Safari):

- kliknij dwukrotnie `index.html`, **albo**
- uruchom lokalny serwer, np.: `python3 -m http.server` i wejdź na `http://localhost:8000`.

Gra działa w pełni po stronie przeglądarki i zapisuje postęp lokalnie
(`localStorage`) — można ją także używać offline.

## Jak grać

1. Nazwij swój gatunek i rozpocznij grę.
2. W **panelu adaptacji** wydawaj punkty ewolucji (EP) na cechy. Każda cecha
   ma koszt, efekty i **kompromis** — nic nie jest darmowe.
3. Kliknij **„Przeżyj turę"** — symulacja rozliczy żerowanie, drapieżnictwo,
   rozród i mutacje, a raport wyjaśni, *co się stało i dlaczego*.
4. Powtarzaj przez 8 tur ery. **Cel:** doprowadzić gatunek do progu inteligencji.
   Uwaga — sama liczna populacja nie wystarczy; trzeba świadomie rozwijać
   **układ nerwowy** (zwoje → mózg → rozbudowany mózg), a to wymaga też
   przetrwania presji środowiska.

Zakończenia: **zwycięstwo** (osiągnięto inteligencję), **przetrwanie**
(gatunek przeżył erę, ale bez rozumności) lub **wymarcie**.

Po drodze odblokowujesz karty wiedzy zbierane w **Kodeksie** (biologia,
paleontologia, ekologia).

## Struktura projektu

```
index.html         — struktura strony i ekranów
css/styles.css     — warstwa prezentacji (tryb jasny/ciemny, responsywność, dostępność)
js/data.js         — dane gry: cechy, era, karty wiedzy (konfiguracja)
js/engine.js       — silnik symulacji: czysta, testowalna logika (bez DOM)
js/ui.js           — kontroler interfejsu: render, zdarzenia, zapis lokalny
test/engine.test.js — testy silnika
```

Zgodnie z założeniami (sekcja 9) logika gry jest **oddzielona od UI** i
testowalna niezależnie, a dane (cechy/era/wiedza) są konfiguracją — łatwą do
rozbudowy bez zmian w kodzie.

## Testy

Silnik ma zestaw testów bez zależności zewnętrznych:

```bash
node test/engine.test.js
```

Testy sprawdzają m.in. kupno cech i warunki wstępne, niemutowalność stanu,
mechanikę mutacji, warunki zwycięstwa/porażki oraz to, że gra jest
przechodnia świadomą strategią.

## Funkcje

- **Scenariusze i poziomy trudności** — trzy scenariusze (pełna ewolucja, podbój
  lądu, epoki lodowcowe) różniące się trudnością, punktem startu i celem.
- **Trzy ery** (paleozoik → mezozoik → kenozoik, 20 tur) z realnymi datami
  geologicznymi i **kamieniami milowymi cech** dostępnymi dopiero w kolejnych erach.
- **26 cech** (z ikonami) w drzewie zależności z kosztami i kompromisami; ścieżka
  do inteligencji oznaczona ⭐ (z dwiema drogami do rozumu i cechami synergicznymi).
- **Cztery nisze ekologiczne** (woda, przybrzeże, ląd, powietrze) z migracją —
  każda ma inny pokarm i zagrożenia; dywersyfikacja realnie pomaga przetrwać.
- **Specjacja i drzewo życia** — interaktywny diagram filogenetyczny (żywe i
  wymarłe gałęzie, oś er).
- **Katastrofy / wymierania masowe** (permskie, K–Pg, zlodowacenia) oraz
  **pozytywne zdarzenia losowe** (zakwit pokarmu, spokojny sezon).
- **Koewolucja** — presja drapieżników „dogania” dobrze bronione linie (wyścig zbrojeń).
- **Prognoza „co-jeśli"** przy najechaniu na cechę + **rozbicie EP** w raporcie
  (skąd pochodzą punkty).
- **Wskaźnik postępu do inteligencji** z podpowiedzią „następny krok ⭐" i ostrzeżeniem
  o kończącym się czasie — prowadzi do celu i ogranicza pułapkę „przetrwania bez rozumu".
- **Synergie cech** (combo, np. mózg + ręka chwytna) i **dwie drogi do rozumu**
  (narzędziowa: *narzędzia*, społeczna: *mowa i język*).
- **Szybka tura**: pełny raport tylko przy istotnych zdarzeniach, spokojne tury rozliczane
  lekkim komunikatem (mniej powtarzalności).
- **Mini-quizy po erze** z bonusem EP (pomijalne) oraz **osiągnięcia** (cele opcjonalne).
- **Przegląd wszystkich linii** (populacja, prognoza, sygnał ryzyka bez przełączania).
- **Tryb nauczyciela z ziarnem losowości** — powtarzalne, identyczne partie na lekcji.
- **Zabezpieczenie przed spiralą śmierci** (refugium małej populacji, cecha *spowolniony
  metabolizm*) i **koszt migracji** (aklimatyzacja) — katastrofy premiują dywersyfikację,
  nie ucieczkę całością.
- **Samouczek** pierwszych kroków, **tryb nauczyciela** (cofanie), **wykres populacji**.
- **Eksport podsumowania gry** (kopiuj / pobierz .txt — np. dla nauczyciela).
- **Kodeks wiedzy** (z ikonami) z powiązaniami do realnych organizmów kopalnych.
- **i18n** — stringi interfejsu w `js/i18n.js` (domyślnie `pl`); treść gry w `data.js`.
- Zapis lokalny (`localStorage`), tryb jasny/ciemny, responsywność, dostępność
  (klawiatura, kontrasty, `prefers-reduced-motion`).

## Struktura projektu (uzupełnienie)

```
js/i18n.js  — stringi interfejsu (warstwa i18n)
```

## Status

Działający **MVP+** obejmujący trzy ery, specjację z drzewem życia, nisze,
katastrofy, samouczek, tryb nauczyciela (z ziarnem losowości), mini-quizy po erze,
osiągnięcia, synergie cech i wskaźnik postępu do celu. Dalsze możliwe kroki:
tryb offline (PWA), tryb wieloosobowy, kolejne języki.

Pełny opis wprowadzonych modyfikacji rozgrywki: [`PROPOZYCJA-GAMEPLAY.md`](./PROPOZYCJA-GAMEPLAY.md).
