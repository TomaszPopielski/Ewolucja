# Styl graficzny: „ilustracja naukowa”

Punkt odniesienia to tablice przyrodnicze i podręczniki paleontologii:
rysunek piórkiem na papierze, delikatnie podbity akwarelą, opisany szeryfowym
krojem. Grafika ma być czytelna, spokojna i rzetelna, bez efekciarstwa.

## Zasady

1. **Tusz + ton.** Każdy rysunek to kontur w kolorze tuszu (`--ink`) oraz
   półprzezroczysta plama tonu (`--wash`). Kolor niesie ton, nie kontur.
2. **Papier, nie ekran.** Tła to odcienie papieru z lekkim ziarnem
   (`--paper-grain`). W trybie ciemnym papier jest ciemny, a tusz jasny.
3. **Stonowane barwy natury.** Zieleń zielnikowa, ochra, rdza, morska
   zieleń, fiolet atramentu. Bez neonów i czystych RGB.
4. **Szeryf dla treści, bezszeryf dla danych.** Nagłówki, nazwy gatunków,
   karty wiedzy i kompromisy: Source Serif 4. Liczby, przyciski i opisy
   techniczne: krój systemowy. Etykiety sekcji: kapitaliki szeryfowe.
5. **Cienkie linie, małe promienie.** Ramki 1 px (`--line`), zaokrąglenia
   do 10 px, cienie ledwo widoczne.
6. **Ikona zawsze obok tekstu.** Ikony są ozdobą (`aria-hidden`), znaczenie
   niesie tekst. Bez warstwy graficznej gra pokazuje zapasowe emoji z `js/data.js`.

## Paleta

| Rola | Jasny | Ciemny |
|---|---|---|
| Papier (tło) | `#efe8d8` | `#161a17` |
| Karta | `#fbf8f0` | `#1e231f` |
| Tusz | `#2c261e` | `#ece3cf` |
| Zieleń (marka, zysk) | `#3d6b4e` | `#82b592` |
| Ochra (akcent, kompromis) | `#a86a22` | `#dba259` |
| Czerwień (strata, katastrofa) | `#a13a28` | `#e58a74` |
| Fiolet (EP, inteligencja) | `#6a4c93` | `#b59be0` |

Tony kategorii cech i barwy nisz: `src/art/palette.ts` (źródło dla kodu
graficznego) oraz zmienne `--wash-*` i `--niche-*` w `css/styles.css`.
Przy zmianie barw trzeba zaktualizować oba miejsca.

## Ikony (`src/art/icons.ts`)

- Siatka 24×24, kreska 1,5 (`.t` = 1), zaokrąglone końce i złącza.
- Klasy: `.w` — ton (plama akwareli), `.f` — pełny tusz, `.t` — cienka kreska.
- Klucze: `trait:<id>`, `cat:<kategoria>`, `niche:<nisza>`, `scenario:<id>`,
  `know:<karta>`, `ui:<nazwa>`.
- Ton ustawia otoczenie przez `data-cat="…"`, `data-niche="…"` albo zmienną `--wash`.
- Podgląd wszystkich ikon: `npm run build && npm run shots` (plik `icons-*.png`).

## Podmiana na grafikę ręczną

Każdą ikonę można zastąpić rysunkiem ilustratora (SVG 24×24). Wystarczy
podmienić treść pod danym kluczem w `src/art/icons.ts`, zachowując klasy
`.w`, `.f` i `.t`, jeśli rysunek ma reagować na tony i motyw.

## Stworzenie (`src/creature/`)

Portret aktywnej linii („rycina”) jest rysowany kodem na płótnie (Canvas 2D).

- `spec.ts`: linia i jej cechy stają się opisem wyglądu (plan budowy, barwa,
  proporcje, rozmiar). Czysta logika, testy w `test/creature.test.mjs`.
- `draw.ts`: rysunek. Ciało to kręgosłup z profilem szerokości. Plan budowy
  (robak → ryba → czworonóg → ssak/ptak) jest płynną mieszanką zależną od
  obecności cech, dlatego nowa cecha „wyrasta”, a nie pojawia się skokiem.
- `portrait.ts`: animacja, przejścia i podgląd „co-jeśli” (fioletowy szkic
  przerywaną linią). Uwzględnia `prefers-reduced-motion` (nieruchoma rycina)
  i nie rysuje, gdy portret jest niewidoczny.

Każda cecha gry ma widoczny odpowiednik; test pilnuje, by nowa cecha w
`js/data.js` nie została bez rysunku:

| Cecha | Na rysunku |
|---|---|
| Filtrowanie | szczeliny skrzelowe, cząstki płynące do pyska |
| Szczęki / Wszystkożerność | zęby i „kłapnięcie”; płaskie trzonowce |
| Płetwy / Szybkie mięśnie | płetwy z promieniami; miomery (pasy mięśni) |
| Kończyny / Stałocieplność | nogi w rozkroku → nogi pod ciałem, krótszy ogon |
| Lot / Izolacja | skrzydła (błona albo pióra), futro, ogon z piór |
| Ręka chwytna / Narzędzia | wyprostowana postawa, dłoń, pięściak w dłoni |
| Łuski / Pancerz / Kamuflaż | wzór łusek, płytki grzbietowe, plamy |
| Oczy / Linia boczna | oko z tęczówką i mruganiem; kropkowana linia |
| Jaja / Opieka | skrzek, jaja z otoczką; młode obok rodzica |
| Zwoje / Mózg / Rozbudowany mózg | układ nerwowy w przekroju, większa głowa |
| Polowanie w grupie / Społeczność | towarzysze w tle |

Podziałka w rogu ryciny pokazuje orientacyjny rozmiar ciała. Galeria
wszystkich planów budowy powstaje przy `npm run shots` (`creatures-*.png`).

## Diorama środowiska (`src/diorama/`)

Scena nad panelami gry pokazuje świat aktywnej linii. Jest rysowana w PixiJS
(licencja MIT), a jej zawartość wynika wyłącznie z danych gry:

| Dane gry | Na scenie |
|---|---|
| Nisza aktywnej linii | woda, przybrzeże (z lądem na horyzoncie), ląd, powietrze |
| Era | roślinność i drobna fauna: liliowce, gąbki, trylobity, lepidodendrony, skrzypy → amonity, koralowce, araukarie, sagowce → kelp, drzewa liściaste, trawy |
| Populacja linii | liczba osobników w ławicy/stadzie (∝ √populacji) |
| Inne linie w tej niszy | ich osobniki w innej barwie (specjacja) |
| Pokarm tury | plankton, pyłki, owady |
| Presja drapieżników | 0–3 drapieżniki; ofiary uciekają przed ich wypadami |
| Klimat tury | śnieg i chłodny odcień; ciepłe światło i pył |
| Zapowiedź katastrofy w niszy | rdzawy odcień sceny i ostrzeżenie w podpisie |

- `scenery.ts`: malowanie warstw (tło, daleki, środkowy, pierwszy plan) w
  stylu tusz + ton. Warstwy są zapętlone i przesuwają się z efektem głębi.
- `bake.ts`: klatki animacji zwierzęcia wypiekane z tego samego rysunku co rycina.
- `diorama.ts`: scena, ruch stada (spójność, rozproszenie, ucieczka) i przejścia
  (przenikanie przy zmianie linii, niszy lub tury).

Wydajność i dostępność:
- Gdy WebGL działa programowo (bez karty graficznej), diorama od razu używa
  renderera Canvas. Bez WebGL i Canvas gra działa bez dioramy.
- Jeśli po rozgrzaniu scena nie utrzymuje ~40 kl./s, sama obniża jakość
  (wyłącza falowanie wody i gęstość pikseli).
- `prefers-reduced-motion`: nieruchoma scena. Poza ekranem animacja stoi.
- Płótno jest ukryte przed czytnikami ekranu; treść niesie podpis sceny.
