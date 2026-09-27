# Ewolucja 🧬

Edukacyjna gra przeglądarkowa o **doborze naturalnym** i historii życia,
inspirowana *Evolution: The Game of Intelligent Life* (1997).

Poprowadź linię rozwojową zwierząt przez trzy ery — **paleozoik, mezozoik
i kenozoik** — od prostego organizmu w morzu aż do gatunku o rozwiniętym mózgu. Wydawaj **punkty ewolucji**
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
   ma koszt, efekty i **kompromis** — nic nie jest darmowe. Część kompromisów
   zależy od warunków (np. płetwy nie pomagają na lądzie, łuski utrudniają
   oddychanie przy niskim tlenie).
3. Kliknij **„Przeżyj turę"** — symulacja rozliczy żerowanie, drapieżnictwo,
   rozród i mutacje, a raport wyjaśni, *co się stało i dlaczego*.
4. Powtarzaj przez kolejne tury (20 w pełnej grze; scenariusze mogą startować
   w późniejszej erze). Warunki każdej tury są losowane wokół historycznych —
   sprawdzaj panel środowiska i prognozę przed decyzją.
   **Cel:** doprowadzić linię do progu inteligencji **i używania narzędzi**
   (kultura i technologia — możliwe dopiero w kenozoiku) w linii liczącej
   **co najmniej 50 osobników**.
   Uwaga — sama liczna populacja nie wystarczy; trzeba świadomie rozwijać
   **układ nerwowy** (zwoje → mózg → rozbudowany mózg). Mózg jest jednak
   kosztowny: kupiony bez zaplecza pokarmowego zagłodzi populację, a garstka
   osobników to nie gatunek rozumny.

Zakończenia: **zwycięstwo** (inteligencja + narzędzia w żywotnej populacji),
**przetrwanie** (gatunek przeżył wszystkie rozgrywane ery, ale bez rozumności)
lub **wymarcie**. Poniżej 20 osobników populacja słabiej się rozmnaża (efekt
Allee), a jeśli na koniec gry żadna linia nie przekracza tego progu, gatunek
uznaje się za wymarły.

Po drodze odblokowujesz karty wiedzy zbierane w **Kodeksie** (biologia,
paleontologia, ekologia).

## Struktura projektu

```
index.html         — struktura strony i ekranów
css/styles.css     — warstwa prezentacji (tryb jasny/ciemny, responsywność, dostępność)
js/data.js         — dane gry: cechy, ery, scenariusze, karty wiedzy (konfiguracja)
js/engine.js       — silnik symulacji: czysta, testowalna logika (bez DOM)
js/ui.js           — kontroler interfejsu: render, zdarzenia, zapis lokalny
test/engine.test.js — testy silnika
test/bots.js        — gracze-boty do testów balansu
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
mechanikę mutacji, warunki zwycięstwa/porażki, to, że gra jest
przechodnia świadomą strategią, oraz regresje naprawionych błędów
(zob. [`ULEPSZENIA.md`](./ULEPSZENIA.md)).

Testy balansu (`test/bots.js`) rozgrywają po 100 gier z ustalonymi ziarnami
losowości trzema „graczami”: stały plan „kup wszystko”, sama ścieżka ⭐ oraz
gracz korzystający z prognozy. Pilnują, że żaden stały plan nie wygrywa zawsze,
adaptacja popłaca, a poziomy trudności są uporządkowane.

## Funkcje

- **Scenariusze i poziomy trudności** — trzy scenariusze (pełna ewolucja, podbój
  lądu, epoki lodowcowe) różniące się trudnością, punktem startu i celem.
- **Trzy ery** (paleozoik → mezozoik → kenozoik, 20 tur) z realnymi datami
  geologicznymi i **kamieniami milowymi cech** dostępnymi dopiero w kolejnych erach.
- **24 cechy** (z ilustrowanymi ikonami SVG) w drzewie zależności z kosztami i kompromisami; ścieżka
  do inteligencji oznaczona ⭐.
- **Cztery nisze ekologiczne** (woda, przybrzeże, ląd, powietrze) z migracją
  (koszt EP malejący z mobilnością, tura aklimatyzacji) — każda ma inny pokarm
  i zagrożenia; dywersyfikacja realnie pomaga przetrwać.
- **Specjacja i drzewo życia** — interaktywny diagram filogenetyczny z miniaturami
  zwierząt, animowanym rozgałęzianiem i powiększaniem (żywe i wymarłe gałęzie, oś er).
- **Zmienne środowisko** — pokarm, drapieżniki, tlen i klimat każdej tury
  losowane wokół wartości historycznych i widoczne przed decyzją.
- **Selektywne katastrofy / wymierania masowe** (ordowickie, permskie, K–Pg,
  zlodowacenia) — cechy takie jak niski metabolizm czy izolacja zmniejszają
  straty, a raport wyjaśnia, co pomogło przetrwać; oraz
  **pozytywne zdarzenia losowe** (zakwit pokarmu, spokojny sezon).
- **Koewolucja** — presja drapieżników „dogania” dobrze bronione linie (wyścig zbrojeń).
- **Prognoza „co-jeśli"** przy najechaniu na cechę + **rozbicie EP** w raporcie
  (skąd pochodzą punkty).
- **Diorama środowiska** — animowana scena niszy i ery: populacja jako ławica
  lub stado, pokarm, drapieżniki i klimat tury wynikają wprost z symulacji.
- **Tura jako wydarzenie** — przed raportem krótka animacja: żerowanie, ataki
  drapieżników, głód, narodziny, mutacja i katastrofy (meteoryt, zlodowacenie,
  wulkanizm); można ją pominąć.
- **Ekran końcowy z historią** — rycina gatunku, „droga ewolucji” w miniaturach
  i wykres populacji na osi er.
- **Żywa rycina gatunku** — zwierzę rysowane z cech: każda adaptacja jest
  widoczna, a przed zakupem można podejrzeć jej szkic na zwierzęciu.
- **Samouczek** pierwszych kroków, **tryb nauczyciela** (cofanie), **wykres populacji**.
- **Eksport podsumowania gry** (kopiuj / pobierz .txt — np. dla nauczyciela).
- **Kodeks wiedzy** (z ikonami) z powiązaniami do realnych organizmów kopalnych.
- **i18n** — stringi interfejsu w `js/i18n.js` (domyślnie `pl`); treść gry w `data.js`.
- Zapis lokalny (`localStorage`), tryb jasny/ciemny, responsywność, dostępność
  (klawiatura, kontrasty, `prefers-reduced-motion`).

## Grafika i wydajność

Przycisk z suwakami w nagłówku otwiera **Ustawienia grafiki**: jakość
(automatyczna / wysoka / średnia / niska) i animację tury (pokazuj / pomijaj).
Tryb automatyczny sam obniża jakość na słabszym sprzęcie; poziom niski
zamienia dioramę w nieruchomą ilustrację. Szczegóły, pomiary i instrukcja
podmiany grafiki proceduralnej na ręcznie rysowaną: [`docs/STYL.md`](./docs/STYL.md).

## Struktura projektu (uzupełnienie)

```
js/i18n.js       — stringi interfejsu (warstwa i18n)
src/main.ts      — punkt wejścia Vite; ładuje moduły js/ i nową warstwę graficzną
src/art/         — warstwa graficzna (TypeScript): ikony SVG, paleta
src/creature/    — żywy portret zwierzęcia składanego z cech (Canvas 2D)
src/diorama/     — diorama środowiska nad panelami (PixiJS) i animacja tury
src/art/settings.ts — ustawienia grafiki (jakość, animacja tury)
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
