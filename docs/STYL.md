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
| Era | paleta i światło ery oraz roślinność i drobna fauna: liliowce, gąbki, trylobity, bagienny las lepidodendronów → amonity, koralowce, araukarie, sagowce, dymiący wulkan → las kelpowy, sawanna z akacjami, trawy |
| Populacja linii | liczba osobników w ławicy/stadzie (∝ √populacji) |
| Inne linie w tej niszy | ich osobniki w innej barwie (specjacja) |
| Pokarm tury | plankton, pyłki, owady |
| Presja drapieżników | 0–3 drapieżniki; ofiary uciekają przed ich wypadami |
| Klimat tury | pora i jakość światła: złote, zamglone popołudnie (pył) albo niskie słońce, śnieg i kra |
| Zapowiedź katastrofy w niszy | rdzawy odcień sceny i ostrzeżenie w podpisie |

- `looks.ts`: scenariusz barw — paleta każdej sceny w trzech klimatach (sekcja „Światło, barwy i głębia” niżej).
- `lit-land.ts`, `lit-water.ts`, `lit-air.ts`: przepisy scen (ląd; woda i przybrzeże; powietrze),
  `lit-scene.ts` wybiera przepis według niszy, `light.ts` — wspólne narzędzia.
- `scenery.ts`: układ sceny, pędzle tusz + ton i rysunki roślin oraz zwierząt dna.
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

## Tura jako wydarzenie (`src/diorama/turnplay.ts`)

Po kliknięciu „Przeżyj turę” diorama odgrywa przebieg tury aktywnej linii,
a dopiero potem pokazuje się raport. Liczby pochodzą wprost z raportu silnika;
liczba ofiar i młodych na scenie jest do nich proporcjonalna.

| Faza | Na scenie | Warunek |
|---|---|---|
| Żerowanie | pokarm „wpada” do osobników, bilans energii w banerze | zawsze |
| Drapieżnictwo | drapieżniki atakują wybrane ofiary (czerwony błysk) | straty od drapieżników > 0 |
| Głód | ofiary szarzeją i opadają | straty z głodu > 0 |
| Narodziny | młode rosną przy rodzicach (zielone kręgi) | narodziny > 0 |
| Mutacja | wyróżniony osobnik z opisem zmiany (fiolet / czerwień) | mutacja w tej turze |
| Katastrofa | meteoryt (błysk, fala uderzeniowa, pył), zlodowacenie (szron, śnieg, zamarzanie) albo wulkanizm (popiół, rdzawa woda) | katastrofa w niszy linii |

- Całość trwa ok. 4–7 s; pominięcie: przycisk „Pomiń”, Esc, Enter albo spacja.
- W trakcie animacji akcje zmieniające stan gry są wstrzymane.
- Gdy diorama jest poza ekranem, gra przewija do niej przed animacją.
- `prefers-reduced-motion` albo brak dioramy: raport pojawia się od razu.
- Specjacja: nowa gałąź powstaje z połowy stada rodzica, które się rozchodzi.
- Raport ma ikony i kolejność pozycji zgodne z fazami animacji.

## Drzewo życia, wykres i ekrany (etap 5)

- **Miniatury** (`src/creature/thumb.ts`): ten sam rysunek co rycina, nieruchomy,
  zapamiętywany. Używane w drzewie życia, na kartach scenariuszy i w „drodze
  ewolucji” na ekranie końcowym.
- **Drzewo życia**: pasma er, znaczniki katastrof, linia „teraz”. Gałęzie
  rysują się po otwarciu (od pnia do najmłodszych). Grubość gałęzi zależy od
  szczytowej populacji. Na końcu gałęzi jest miniatura w obecnej postaci;
  wymarłe gałęzie są szare, z przerywaną ramką. Przyciski − i + powiększają
  drzewo. Węzły żywych linii da się wybrać myszą i klawiaturą.
- **Wykres populacji**: oś całej gry od ery startowej scenariusza, pasma er,
  znaczniki katastrof, podpis ostatniej wartości. Po najechaniu pojawia się
  celownik z turą i liczebnością. Jedna seria, więc bez legendy (tytuł nazywa
  serię). Opis tekstowy trafia do `aria-label`.
- **Ekran startowy**: w nagłówku karty diorama kambryjskiego morza. Karty
  scenariuszy pokazują miniaturę formy startowej.
- **Ekran końcowy**: rycina linii, która doszła najdalej. Pod nią „droga
  ewolucji” (kolejne stadia wg kolejności zdobywania cech, od form startowych
  scenariusza) i wykres jej populacji.

## Ustawienia grafiki i wydajność (etap 6)

Przycisk z suwakami w nagłówku otwiera „Ustawienia grafiki” (zapis lokalny,
`src/art/settings.ts`):

| Jakość | Diorama |
|---|---|
| Automatyczna (domyślna) | jak wysoka; gdy scena nie utrzymuje ~40 kl./s, sama obniża jakość: najpierw wyłącza falowanie wody i ogranicza do 30 kl./s, potem renderuje w rozdzielczości 0,75 i przerzedza cząstki |
| Wysoka | pełna gęstość pikseli, falowanie wody (WebGL), świecące snopy światła |
| Średnia | bez efektów specjalnych, 30 kl./s, rozdzielczość 0,75, mniej cząstek i osobników |
| Niska | nieruchoma ilustracja (odświeżana przy zmianie stanu), bez animacji tury |

Animacja tury: „Pokazuj” albo „Pomijaj” (raport od razu). Systemowe
„ograniczanie ruchu” ma zawsze pierwszeństwo.

Pomiary (Chromium bez karty graficznej, renderer Canvas, 1280×860):

| Jakość | kl./s strony | procesor spowolniony 4× |
|---|---|---|
| Wysoka / Automatyczna (przed obniżeniem) | 60 | ~25 |
| Średnia | 60 | ~43 |
| Niska | 60 | 60 |

Na komputerach z kartą graficzną diorama używa WebGL; programowy WebGL
(SwiftShader, llvmpipe) jest wykrywany i zastępowany rendererem Canvas.
Parametr adresu `?renderer=webgl` albo `?renderer=canvas` wymusza renderer
(do testów).

Rozmiar: PixiJS jest „odchudzony” wtyczką w `vite.config.mts` (bez renderera
WebGPU i rozszerzeń przeglądarkowych). Warstwy krajobrazu to pary zwykłych
obrazków zamiast `TilingSprite` (taniej w rendererze Canvas).

## Podmiana grafiki proceduralnej na ręcznie rysowaną

Każdy element narysowany kodem ma jedno miejsce, w którym można go zastąpić
grafiką ilustratora, bez zmian w logice gry:

| Element | Gdzie podmienić | Oczekiwany format |
|---|---|---|
| Ikony | `src/art/icons.ts` (treść pod kluczem) | SVG 24×24, klasy `.w/.f/.t` |
| Warstwy krajobrazu | funkcje `paint…` w `src/diorama/lit-land.ts`, `lit-water.ts`, `lit-air.ts` (składa je przepis sceny: `landRecipe`, `seaRecipe`, `coastRecipe`, `airRecipe`) | funkcja zwraca `<canvas>` — wystarczy narysować na nim obraz (`drawImage`); warstwy przesuwane z kamerą mają szerokość kafla i są zapętlone w poziomie |
| Roślinność i fauna tła | funkcje `crinoid`, `lepidodendron`, `araucaria`… w `scenery.ts` (światło nakłada `litObject`), drzewa kenozoiku w `lit-land.ts` | dowolny rysunek na kontekście 2D |
| Osobniki w dioramie | `bakeCreature` w `src/diorama/bake.ts` | tablica klatek (tekstur) jednego cyklu ruchu + punkt zaczepienia |
| Rycina i miniatury | `drawCreature` w `src/creature/draw.ts` (lub osobny rysunek w `portrait.ts` / `thumb.ts`) | rysunek na kontekście 2D w pozie z parametru `time` |

Obrazy dołączane do projektu (PNG/WebP) Vite wkleja do `dist/index.html`, więc
gra nadal działa offline z jednego pliku; rozsądny budżet to łącznie kilka MB.

## Etapy 7–11: ekran gry, świat, stworzenia, wydarzenia, dostępność

- **Ekran gry** (`css/styles.css`, `js/ui.js`): diorama wyższa (300 px), karty cech dostępnych i zdobytych mają dużą odznakę z tonem kategorii, a zablokowane zwijają się do jednej linijki (pełny opis po najechaniu lub w `title`). Zakup odciska cechę „pieczątką”. Miarki mają podziałkę; spadek w chipach efektów jest przerywany (nie tylko kolor).
- **Diorama** (`src/diorama/scenery.ts`): nowe elementy tła (łodzikowiec, ramienionóg, jeżowiec, paproć drzewiasta, drzewo iglaste, kwiaty, trawa morska), cienie pod roślinnością, mgła na dalekim planie, odcień ery i poświata nad horyzontem, piana na brzegu.
- **Stworzenia** (`src/creature/`): szersza paleta barw z odcieniem niszy, barwa dodatkowa i wzór dziedziczny linii (pasy, plamy, siodło), większe skrzydła w barwie dodatkowej, uda i stopy zamiast patyczkowatych nóg.
- **Wydarzenia**: zmiana ery pokazuje po raporcie planszę „Koniec ery / nowa era” na dioramie; po katastrofie w niszy linii krajobraz jest szary i odradza się przez trzy tury (`aftermath`).
- **Dostępność**: `prefers-contrast: more` (grubsze ramki, pełne tło kart), zmiana ery pomijana przy `prefers-reduced-motion`.

## Plany budowy (etap 9)

Linia ma stały **plan budowy** (`bodyPlan` w silniku, tylko do rysunku): `kregowiec`,
`stawonog` albo `glowonog`. Root gry startujący bez płetw, kończyn, lotu i
stałocieplności dostaje plan z kodu świata (50% / 25% / 25%), a gałęzie go
dziedziczą. Scenariusz z zaawansowanym startem i świat bez ziarna są kręgowcami;
stare zapisy bez pola też.

| Cecha | Stawonóg (`arthropod.ts`) | Głowonóg (`cephalopod.ts`) |
|---|---|---|
| Płetwy | odnóża pływne pod odwłokiem | płetwy płaszcza |
| Kończyny | długie odnóża kroczne (chód) | ramiona opuszczone na dno |
| Lot | owadzie skrzydła | szybowanie na rozłożonych płetwach |
| Pancerz | karapaks nad tułowiem | zwinięta muszla (jak łodzik) |
| Szczęki | żuwaczki | dziób i macki łowne |
| Ręka chwytna / narzędzia | szczypce z kamieniem | wprawne ramię z kamieniem |
| Oko | oko złożone z fasetek | oko kamerowe z poziomą źrenicą |
| Układ nerwowy | brzuszny łańcuch zwojów | pierścień zwojów w głowie |

Wspólne elementy (echolokacja, kultura akustyczna, kamień, mózg, wzór linii):
`src/creature/extras.ts`. Rozmiary rysunku planów (`planExtents`) i stopy
(`footDrop`) są liczone osobno, więc wypiekanie klatek i miniatury działają
jak dla kręgowca. Drapieżniki dioramy w paleozoiku to głowonogi (woda) i wielkie
stawonogi (ląd, powietrze). Galeria w `npm run shots` ma okazy obu planów.

## Sylwetki, wielkie wymierania, dostępność, test wizualny (etapy 10–11)

- **Gadzia sylwetka** (`spec.form`): kręgowiec z kończynami ma z ziarna linii standardową albo „gadzią” sylwetkę (długa szyja unosząca głowę, ciężki, dłuższy ogon). Przejście jest płynne, bo działa przez ten sam współczynnik co kończyny.
- **Wielkie wymieranie** (`turnplay.ts`): gdy katastrofa zabiera co najmniej 35% populacji linii, po uderzeniu scena szarzeje i pojawia się plansza z nazwą, odsetkiem strat i liczbą ocalałych. Przez kolejne trzy tury krajobraz jest szary i się odradza (`aftermath`). Przy „ograniczaniu ruchu” animacji tury nie ma, więc planszy też.
- **Paleta dla zaburzeń widzenia barw**: Ustawienia grafiki → „Paleta barw”. Zamiast zieleń/czerwień: niebieski = zysk, cynober = strata (zmienne CSS przy `data-palette="cb"`); znaczenie niesie też znak +/− i kształt ramki.
- **Telefon**: przycisk „Przeżyj turę” jest przyklejony do dołu ekranu.
- **Ekrany startowy i końcowy**: numer tablicy, podwójna ramka i rycina w oprawie.
- **Test wizualny**: `npm run visual` rysuje 21 okazów (`scripts/specimens.mjs`) w nieruchomej pozie i porównuje z wzorcami z `test/visual/` (dopuszcza 0,4% różniących się pikseli). Po zamierzonej zmianie wyglądu: `npm run visual -- --update`, a zmienione wzorce wchodzą do commita.

## Światło, barwy i głębia (etap 1)

Plan: [`GRAFIKA-PROPOZYCJA.md`](./GRAFIKA-PROPOZYCJA.md), pakiet A. Porównania:
[`grafika/etap1-wszystkie-sceny.jpg`](./grafika/etap1-wszystkie-sceny.jpg) (przed/po, 12 scen),
[`grafika/etap1-klimaty.jpg`](./grafika/etap1-klimaty.jpg) (każda scena w trzech klimatach),
[`grafika/etap1-lad-kenozoik.jpg`](./grafika/etap1-lad-kenozoik.jpg) (prototyp).

Każda z 12 scen (era × nisza) ma **scenariusz barw** (`src/diorama/looks.ts`) i jedno słońce.

- **Scenariusz barw** (`Look`): paleta bazowa każdej sceny (`BASE`), z której wariant ciepły
  i zimny wylicza `withClimate`. Ląd w kenozoiku ma paletę dobraną ręcznie w prototypie.
  Papier nie rozbiela już barw, zostaje jako ziarno na malowanych warstwach (zwierzęta są bez ziarna).
- **Jedno słońce** (`sun.x`, `sun.y`): na lądzie i w powietrzu wyznacza jasną stronę koron,
  pni, skał i gór, kierunek i długość cieni (`litSide`, `shadowLen`), poświatę nieba i snopy.
  Pod wodą światło pada z góry: jasne wierzchy, cień pod spodem, snopy spod powierzchni
  pochylone od słońca, a na wysokiej jakości ruchome refleksy (kaustyki) na dnie.
- **Perspektywa powietrzna** (pod wodą: zamglenie toni): dalsze plany są jaśniejsze,
  chłodniejsze i rozmyte raz, przy malowaniu (`blurred`: jedna operacja na całą warstwę).
- **Grunt w perspektywie** (`sceneLayout`): na lądzie ok. 40% kadru, w wodzie dno od 80%
  wysokości; stado chodzi w głąb (na lądzie skala osobnika od 0,56 do 1, cień pod spodem).
- **Rama kadru:** ciemne, rozmyte rośliny pierwszego planu w dolnych rogach, pod światło
  (trawy w kenozoiku, liście paproci wcześniej, wodorosty pod wodą).
- **Dawne rysunki** roślin i zwierząt (`scenery.ts`) dostają światło przez `litObject`:
  rysunek powstaje na osobnym płótnie, a jego piksele dostają światło z boku albo z góry
  i zamglenie dali.

| Era | Charakter | Ląd | Woda i przybrzeże |
|---|---|---|---|
| Paleozoik | wilgotny, turkusowo-zielony | bagienny las lepidodendronów, skrzypy, paprocie, kałuże odbijające niebo; na brzegu niskie kobierce pierwszych roślin | liliowce, gąbki, trylobity, ramienionogi, łodzikowce; stromatolity na przybrzeżu |
| Mezozoik | ciepły, oliwkowo-złoty | araukarie, sagowce, paprocie drzewiaste, iglaste; dymiący wulkan na horyzoncie | koralowce, amonity, jeżowce, gąbki |
| Kenozoik | czyste światło, sawanna | gaje drzew liściastych, akacje, trawy, kwiaty | las kelpowy, koralowce, rozgwiazdy, trawa morska |

| Klimat tury | Światło | Na scenie |
|---|---|---|
| Umiarkowany | jasny dzień, słońce wysoko z prawej | pełne barwy ery |
| Ciepły | złote, zamglone popołudnie, widoczna tarcza słońca | ciepła mgiełka, mocniejsze snopy; zieleńsza, mętniejsza toń |
| Zimny | niskie słońce, długie niebieskie cienie | śnieg na górach i płaty śniegu (w mezozoiku szron), kra na wodzie, bezlistne drzewa w kenozoiku; ciemniejsza, czystsza toń |

Śnieg, kałuże i kra mają osobne losowanie, więc rośliny i skały stoją w tych samych miejscach
w każdym klimacie: to samo miejsce w innej pogodzie.

- **Ślad po katastrofie:** paleta blaknie do popielatej (`ashen`) i przez trzy tury wraca
  do pełnych barw; scena maluje się od nowa w krokach co 1/3. Jedyna nakładka barwna to
  rdzawy odcień zapowiedzi katastrofy (`applyMood`).
- **Tryb ciemny:** ta sama scena o zmierzchu (`dusk`): słońce tuż nad horyzontem, przygaszone barwy, bez snopów.
- **Zmiana klimatu albo śladu** między turami = nowa scena, która przenika się z poprzednią.
  Malowanie sceny trwa 40–200 ms (prototyp lądu potrzebował 1,3 s, bo rozmywał każdy kształt osobno).

Warstwy (`LitRecipe`): nieruchome są sklejane przy malowaniu i przycinane do pasa, w którym
coś jest; ruchome (chmury, a w wodzie i powietrzu krajobraz, który płynie z kamerą) to
zapętlone kafle z paralaksą. Ląd: niebo z górami i wzgórzami (jeden obraz) → chmury → snopy →
grunt z roślinnością → zwierzęta → pierwszy plan i rama. Woda: toń → daleka rafa → snopy →
powierzchnia → dno → kaustyki → zwierzęta → wodorosty i rama. Przybrzeże: niebo i toń → chmury →
brzeg z daleką rafą → snopy → powierzchnia → dno. Powietrze: niebo → krajobraz w dole → snopy →
duże chmury → zwierzęta → obłoki pierwszego planu.

Pomiary (Chromium bez karty graficznej, renderer Canvas, 1280×860, mediana z 5 pomiarów,
kl./s strony; „przed” = scena sprzed etapu 1):

| Scena, jakość | Przed | Po |
|---|---|---|
| Ląd (kenozoik), wysoka, procesor spowolniony 4× | 43 | 60 |
| Ląd (kenozoik), średnia, procesor spowolniony 6× | 35 | 41 |
| Woda (paleozoik), wysoka, procesor spowolniony 4× | 28 | 43 |
| Woda (paleozoik), średnia, procesor spowolniony 6× | 24 | 33 |
| Przybrzeże (paleozoik), wysoka, procesor spowolniony 4× | 31 | 44 |
| Przybrzeże (paleozoik), średnia, procesor spowolniony 6× | 25 | 30 |

Testy palet i układu scen: `test/light.test.mjs`.
