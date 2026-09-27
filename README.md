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

**Zagraj od razu:** otwórz plik **`dist/index.html`** w przeglądarce (Chrome,
Firefox, Edge, Safari) — dwuklikiem, bez instalacji i bez serwera. To gotowa,
zbudowana wersja gry w jednym pliku; działa także offline i zapisuje postęp
lokalnie (`localStorage`).

**Praca nad kodem** (wymaga Node.js 20+):

```bash
npm install
npm run dev      # podgląd na żywo: http://localhost:5173
npm run build    # sprawdzenie typów + budowa dist/index.html (jeden plik)
npm test         # testy silnika
npm run shots    # zrzuty ekranu zbudowanej gry (Chromium; katalog screenshots/)
```

Po zmianach w kodzie uruchom `npm run build` i zatwierdź też `dist/index.html`,
żeby wersja „dwuklikowa” była aktualna. Główny `index.html` jest źródłem dla
Vite i sam z pliku nie zadziała.

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
npm test          # silnik + opis wyglądu zwierzęcia
```

Testy sprawdzają m.in. kupno cech i warunki wstępne, niemutowalność stanu,
mechanikę mutacji, warunki zwycięstwa/porażki oraz to, że gra jest
przechodnia świadomą strategią.

## Funkcje

- **Scenariusze i poziomy trudności** — trzy scenariusze (pełna ewolucja, podbój
  lądu, epoki lodowcowe) różniące się trudnością, punktem startu i celem.
- **Trzy ery** (paleozoik → mezozoik → kenozoik, 20 tur) z realnymi datami
  geologicznymi i **kamieniami milowymi cech** dostępnymi dopiero w kolejnych erach.
- **24 cechy** (z ilustrowanymi ikonami SVG) w drzewie zależności z kosztami i kompromisami; ścieżka
  do inteligencji oznaczona ⭐.
- **Cztery nisze ekologiczne** (woda, przybrzeże, ląd, powietrze) z migracją —
  każda ma inny pokarm i zagrożenia; dywersyfikacja realnie pomaga przetrwać.
- **Specjacja i drzewo życia** — interaktywny diagram filogenetyczny (żywe i
  wymarłe gałęzie, oś er).
- **Katastrofy / wymierania masowe** (permskie, K–Pg, zlodowacenia) oraz
  **pozytywne zdarzenia losowe** (zakwit pokarmu, spokojny sezon).
- **Koewolucja** — presja drapieżników „dogania” dobrze bronione linie (wyścig zbrojeń).
- **Prognoza „co-jeśli"** przy najechaniu na cechę + **rozbicie EP** w raporcie
  (skąd pochodzą punkty).
- **Żywa rycina gatunku** — zwierzę rysowane z cech: każda adaptacja jest
  widoczna, a przed zakupem można podejrzeć jej szkic na zwierzęciu.
- **Samouczek** pierwszych kroków, **tryb nauczyciela** (cofanie), **wykres populacji**.
- **Eksport podsumowania gry** (kopiuj / pobierz .txt — np. dla nauczyciela).
- **Kodeks wiedzy** (z ikonami) z powiązaniami do realnych organizmów kopalnych.
- **i18n** — stringi interfejsu w `js/i18n.js` (domyślnie `pl`); treść gry w `data.js`.
- Zapis lokalny (`localStorage`), tryb jasny/ciemny, responsywność, dostępność
  (klawiatura, kontrasty, `prefers-reduced-motion`).

## Struktura projektu (uzupełnienie)

```
js/i18n.js       — stringi interfejsu (warstwa i18n)
src/main.ts      — punkt wejścia Vite; ładuje moduły js/ i nową warstwę graficzną
src/art/         — warstwa graficzna (TypeScript): ikony SVG, paleta
src/creature/    — żywy portret zwierzęcia składanego z cech (Canvas 2D)
src/fonts.css    — krój szeryfowy (Source Serif 4, OFL), wklejany offline
docs/STYL.md     — zasady stylu „ilustracja naukowa”
scripts/         — narzędzia (zrzuty ekranu)
vite.config.mts  — budowa do jednego pliku dist/index.html
dist/index.html  — zbudowana gra (zatwierdzana w repozytorium)
```

## Status

Działający **MVP+** obejmujący trzy ery, specjację z drzewem życia, nisze,
katastrofy, samouczek i tryb nauczyciela. Dalsze możliwe kroki: quizy po erze,
tryb offline (PWA), tryb wieloosobowy, kolejne języki.
