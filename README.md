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
js/i18n.js         — stringi interfejsu (warstwa i18n)
js/icons.js        — spójny zestaw ikon SVG (zamiast emoji)
js/avatar.js       — proceduralny SVG awatar gatunku z cech i niszy
js/scene.js        — proceduralne, ilustracyjne tło środowiska tury
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
- **24 cechy** (z ikonami) w drzewie zależności z kosztami i kompromisami; ścieżka
  do inteligencji oznaczona ⭐.
- **Cztery nisze ekologiczne** (woda, przybrzeże, ląd, powietrze) z migracją —
  każda ma inny pokarm i zagrożenia; dywersyfikacja realnie pomaga przetrwać.
- **Specjacja i drzewo życia** — interaktywny diagram filogenetyczny (żywe i
  wymarłe gałęzie, oś er).
- **Katastrofy / wymierania masowe** (permskie, K–Pg, zlodowacenia) oraz
  **pozytywne zdarzenia losowe** (zakwit pokarmu, spokojny sezon).
- **Koewolucja z nazwanym rywalem** — presja drapieżników „dogania” dobrze
  bronione linie (wyścig zbrojeń) i pojawia się w UI jako konkretny, rosnący
  w siłę przeciwnik, nie tylko liczba.
- **Zdarzenia z wyborem** — rzadkie decyzje o realnym ryzyku (np. „kolonizować
  nieznaną wyspę?”), które gracz rozstrzyga przed rozliczeniem tury.
- **Prognoza „co-jeśli"** przy najechaniu na cechę + **rozbicie EP** w raporcie
  (skąd pochodzą punkty).
- **Samouczek** pierwszych kroków, **tryb nauczyciela** (cofanie), **wykres
  populacji z oznaczonymi zdarzeniami** (katastrofy, mutacje, specjacje).
- **Eksport podsumowania gry** (kopiuj / pobierz .txt — np. dla nauczyciela).
- **Kodeks wiedzy** w stylu atlasu przyrodniczego, z powiązaniami do realnych
  organizmów kopalnych.
- **Proceduralny awatar gatunku** — sylwetka SVG budowana z posiadanych cech
  (widoczna w panelu gatunku, na chipach linii i w drzewie życia) i ilustrowane
  tło środowiska zależne od ery/niszy/klimatu.
- **Spójny zestaw ikon SVG** zamiast emoji (kategorie cech, nisze, status,
  zdarzenia) — czytelne niezależnie od systemu/przeglądarki, w tym na tablicy
  multimedialnej.
- **i18n** — stringi interfejsu w `js/i18n.js` (domyślnie `pl`); treść gry w `data.js`.
- Zapis lokalny (`localStorage`), tryb jasny/ciemny, responsywność, dostępność
  (klawiatura, kontrasty, `prefers-reduced-motion`).

## Status

Działający **MVP+** obejmujący trzy ery, specjację z drzewem życia, nisze,
katastrofy, zdarzenia z wyborem, nazwanego rywala ewolucyjnego, proceduralny
awatar gatunku, samouczek i tryb nauczyciela. Dalsze możliwe kroki: quizy po
erze, tryb offline (PWA), tryb wieloosobowy, kolejne języki.
