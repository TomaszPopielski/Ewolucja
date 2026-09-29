# Ewolucja 🧬

Edukacyjna gra przeglądarkowa o **doborze naturalnym** i historii życia,
inspirowana *Evolution: The Game of Intelligent Life* (1997).

Poprowadź linię rozwojową zwierząt przez trzy ery — **paleozoik, mezozoik
i kenozoik** — od prostego organizmu w morzu aż do gatunku o rozwiniętym mózgu. Wydawaj **punkty ewolucji**
na cechy, gospodaruj **rezerwami energii** i **zmiennością genetyczną**, dostosowuj
się do zmiennego środowiska i ucz się, jak działa ewolucja.

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
npm run visual   # test wizualnej regresji rysunku stworzeń (po npm run build; --update odświeża wzorce)
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
3. W panelu **„Decyzje linii”** gospodaruj dwiema walutami każdej linii
   (patrz niżej): wybierz **strategię rozrodu** (r — dużo potomstwa,
   K — mało, ale dobrze chronionego) i **zachowanie w turze** (gromadzenie
   zapasów, ukrywanie się, intensywne żerowanie). Najedź na przycisk, by
   zobaczyć skutek w prognozie. Co kilka tur pojawia się **karta decyzji**
   (13 zdarzeń: wyspa, nowy drapieżnik, zakwit, epidemia, nieznany pokarm,
   konkurent, wulkan, pokrewna populacja, wyścig godowy, padlina, symbioza,
   chudy sezon, niezwykły mutant). Karta nie powtarza się w partii. Część
   opcji to **ryzyko**: wynik losuje się w turze, a szansa powodzenia (widoczna
   na przycisku) zależy od cech linii. Wybierz odpowiedź przed turą, inaczej
   zadziała opcja domyślna. Gdy karta czeka, sygnalizuje to przyklejony pasek
   stanu u góry ekranu.
4. Kliknij **„Przeżyj turę"** — symulacja rozliczy żerowanie, drapieżnictwo,
   rozród i mutacje, a raport wyjaśni, *co się stało i dlaczego*.
5. Powtarzaj przez kolejne tury (20 w pełnej grze; scenariusze mogą startować
   w późniejszej erze). Warunki każdej tury są losowane wokół historycznych —
   sprawdzaj panel środowiska i prognozę przed decyzją.
   **Cel:** doprowadzić linię do progu inteligencji **i kultury** (możliwe
   dopiero w kenozoiku) w linii liczącej **co najmniej 50 osobników**.
   Są dwie drogi: **narzędzia** (ręka chwytna; linia na lądzie lub brzegu)
   albo **kultura akustyczna** (echolokacja; linia w wodzie lub na brzegu,
   jak u delfinów).
   Uwaga — sama liczna populacja nie wystarczy; trzeba świadomie rozwijać
   **układ nerwowy** (zwoje → mózg → rozbudowany mózg). Mózg jest jednak
   kosztowny: kupiony bez zaplecza pokarmowego zagłodzi populację, a garstka
   osobników to nie gatunek rozumny.

### Nisze, pojemność i specjacja

Każda nisza wyżywi w danej turze tylko określoną liczbę osobników — to jej
**pojemność** (zależy od pokarmu). Blisko niej rozród słabnie, a nadmiar ginie
z przegęszczenia. Linie w tej samej niszy **konkurują** o tę samą pojemność.
Dlatego gdy nisza się zapełnia, opłaca się **specjacja**: 40% populacji
zakłada nową gałąź, którą warto wysłać do **wolnej niszy** — ma tam własne
zasoby i przez 2 tury mniejszą presję drapieżników. Wymierania uderzają
w nisze z różną siłą, więc linie w kilku niszach rozkładają ryzyko.
EP za liczebność i wzrost liczone są z łącznej populacji wszystkich linii.

### Trzy waluty

| Waluta | Czyja | Skąd | Na co |
|---|---|---|---|
| **EP** (punkty ewolucji) | wspólna | przetrwanie, liczebność, wzrost, nisze, inteligencja | trwałe cechy |
| **⚡ rezerwy energii** | każdej linii | nadwyżka energii z tury (magazyn ma limit, izolacja go powiększa) | migracja, zachowania w turze, część kart decyzji; w deficycie chronią przed głodem |
| **🧬 zmienność genetyczna** | każdej linii | czas, duża populacja, mutacje; znika w wąskim gardle i katastrofie | specjacja, ukierunkowany dobór, odporność na epidemię; wysoka łagodzi wymierania |

Zakończenia: **zwycięstwo** (inteligencja + kultura w żywotnej populacji),
**przetrwanie** (gatunek przeżył wszystkie rozgrywane ery, ale bez rozumności)
lub **wymarcie**. Poniżej 20 osobników populacja słabiej się rozmnaża (efekt
Allee), a jeśli na koniec gry żadna linia nie przekracza tego progu, gatunek
uznaje się za wymarły.

Gdy zwycięstwo staje się **niemożliwe** (nawet przy najlepszym przebiegu
populacja nie zdąży odrosnąć albo nie da się uzbierać punktów na brakujące
cechy), gra mówi to od razu i proponuje: grać dalej o przetrwanie, cofnąć
turę albo zakończyć partię. Ocena jest celowo hojna — w testach nie pomyliła
się w żadnej wygranej partii.

### Regrywalność: kod świata, kalendarz, cele er, wynik

- **Kod świata** (np. `K7Q2MX`) — każda partia ma kod widoczny pod osią czasu.
  Ten sam kod to ten sam świat: warunki tur, kalendarz katastrof, karty decyzji
  i cele er. Wpisz go na ekranie startowym (np. cała klasa w jednym świecie)
  albo kliknij „Ten sam świat jeszcze raz” na końcu gry. Puste pole = nowy świat.
- **Przesuwane wymierania** — wymieranie ordowickie i dewońskie trafiają w jedną
  z dwóch tur swojego okresu (na osi czasu oznaczone „?”), a w każdej erze
  pojawia się **katastrofa regionalna** w losowej turze, wymierzona w niszę,
  w której żyje najwięcej osobników. Każdą katastrofę gra **zapowiada turę
  wcześniej** — jest czas przenieść linię albo odłożyć zapasy.
- **Cele ery** — w każdej erze dwa losowe cele poboczne (np. „Wyjdź na ląd”,
  „Przetrwać kataklizm”, „Radiacja”) nagradzane punktami ewolucji.
- **Radiacja się opłaca** — każda zajęta nisza ponad pierwszą daje +4 EP na turę.
- **Wynik punktowy i osiągnięcia** — na końcu gry wynik (status, inteligencja,
  populacja, cele er, nisze, tury zapasu, osiągnięcia × mnożnik trudności),
  rekord scenariusza i 13 osiągnięć zapisywanych w przeglądarce.

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
- **26 cech** (z ilustrowanymi ikonami SVG) w drzewie zależności z kosztami i kompromisami; ścieżka
  do inteligencji oznaczona ⭐.
- **Cztery nisze ekologiczne** (woda, przybrzeże, ląd, powietrze) z migracją
  (koszt EP malejący z mobilnością, tura aklimatyzacji) — każda ma inny pokarm
  i zagrożenia; dywersyfikacja realnie pomaga przetrwać.
- **Specjacja i drzewo życia** — interaktywny diagram filogenetyczny z miniaturami
  zwierząt, animowanym rozgałęzianiem i powiększaniem (żywe i wymarłe gałęzie, oś er).
- **Zmienne środowisko** — pokarm, drapieżniki, tlen i klimat każdej tury
  losowane wokół wartości historycznych i widoczne przed decyzją.
- **Selektywne katastrofy / wymierania masowe** (ordowickie, dewońskie, permskie,
  K–Pg, zlodowacenia) i katastrofy regionalne — cechy takie jak niski metabolizm czy izolacja zmniejszają
  straty, a raport wyjaśnia, co pomogło przetrwać; oraz
  karty decyzji także dla zdarzeń pozytywnych (zakwit pokarmu, łagodny sezon) — o ich skutku rozstrzyga gracz.
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
