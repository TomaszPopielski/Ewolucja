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

- Pełna pętla rozgrywki: adaptacja → symulacja → wynik → wiedza, przez 8 tur ery.
- **18 cech** w drzewie zależności z kosztami i kompromisami.
- **Specjacja i drzewo życia** — rozdzielaj linię na gałęzie i śledź ich historię
  na interaktywnym diagramie filogenetycznym (żywe i wymarłe gałęzie).
- **Wykres populacji** aktywnej linii w czasie (sparkline).
- **Tryb nauczyciela** — cofanie decyzji i tur do omówienia na lekcji.
- Warstwa edukacyjna: raporty „co się stało i dlaczego" + Kodeks wiedzy.
- Zapis lokalny (`localStorage`), tryb jasny/ciemny, responsywność, dostępność.

## Status

To działający **MVP+** (jedna era paleozoiku). Kolejne kroki opisuje sekcja 10
dokumentu założeń: pełne ery (mezozoik, kenozoik), quizy po erze, katastrofy /
wymierania masowe, i18n.
