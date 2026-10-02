# Grafika na wyższym poziomie — propozycja

Propozycja kolejnego etapu oprawy wizualnej. Opiera się na przeglądzie kodu
(`src/diorama/`, `src/creature/`, `css/styles.css`) i zrzutach zbudowanej gry
(`npm run shots`, galeria 21 okazów, telefon 390 px, tryb ciemny, animacja
tury, raport, drzewo życia). Zasady stylu, których propozycja się trzyma:
[`STYL.md`](./STYL.md).

**Teza w jednym zdaniu:** styl „ilustracji naukowej” jest dobrym wyborem
i należy go zachować. Teraz trzeba dodać mu **światło, głębię i dramaturgię**,
żeby scena przestała wyglądać jak blady szkic, a najważniejsze chwile gry
zostały w pamięci.

---

## 1. Skąd startujemy

### Co działa i zostaje

- Spójny styl tusz + akwarela + szeryf, konsekwentny od ekranu startowego po raport.
- Zwierzę składane z cech i podgląd cechy przed zakupem. To najmocniejszy pomysł gry.
- Diorama wynika z danych symulacji (liczebność, pokarm, drapieżniki, klimat).
- Wydajność (renderer Canvas bez karty graficznej, samoczynne obniżanie jakości),
  dostępność (ograniczanie ruchu, wysoki kontrast, paleta dla daltonistów)
  i test wizualny rysunku stworzeń.

### Co trzyma grafikę na obecnym poziomie

| # | Problem | Skąd się bierze (kod) | Widać na |
|---|---|---|---|
| D1 | **Scena jest płaska i blada.** Niebo, woda i grunt to jednolite gradienty o niskim kontraście. Nie ma kierunku światła ani cieni. | `paintBackground` miesza barwę niszy z papierem w 8–55%. Era dodaje odcień o kryciu 8–10%. Światło to tylko półprzezroczyste „snopy” i poświata nad horyzontem. | każda diorama, zwłaszcza ląd w kenozoiku |
| D2 | **Ery są do siebie podobne.** Paleozoik, mezozoik i kenozoik różnią się głównie gatunkiem drzewek, a paleta i nastrój zostają te same. | Jedna paleta niszy na wszystkie ery (`theme.niche.*`), `ERA_TINT` prawie niewidoczny. | porównanie scen woda/ląd w różnych erach |
| D3 | **Zwierzęta giną w scenie.** Osobnik ma ok. 60–74 px długości na scenie ~1040×300 px. Wszystkie są w tym samym planie i bez cienia, a sylwetki zlewają się z tłem. | `unitPxFor` w `diorama.ts` (stała długość ekranowa), brak cienia kontaktowego i obrysu od światła. | ławica robaków w kambrze, „jaszczurki” na lądzie |
| D4 | **Formy zaawansowane mają słabe sylwetki.** „Ptak” to ryba ze skrzydłem i jedną nogą, „pterozaur” to ryba z żaglem, „gatunek rozumny” to pochylony gad na cienkich nogach. Odnóża stawonogów to proste patyki, przez co „pająk lądowy” wygląda jak stolik. Najlepiej wypadają głowonogi. | Jeden kręgosłup z profilem szerokości i płynne mieszanie planów (`draw.ts`). Formy pośrednie wychodzą dobrze, ale końcowe nie mają własnych proporcji. | galeria okazów `creatures-*.png`, wzorce `test/visual/07, 08, 10, 14` |
| D5 | **Najważniejsze chwile nie mają wizualnego ciężaru.** Zakup cechy to pieczątka na karcie i wyrośnięcie cechy na małej rycinie w bocznym panelu, a diorama nie reaguje. Zmiana ery to napis przesuwający się po dioramie, a raport tury to tabela liczb. | `turnplay.ts` obsługuje fazy tury, ale nie ma kamery (zbliżenie, kadr). Raport to zwykła lista w `ui.js`. | raport tury, zakup cechy |
| D6 | **Interfejs jest gęsty od tekstu.** Karta cechy ma opis, chipy efektów, kompromis i kilka warunków niszy, a ikona jest mała w stosunku do tekstu. Drzewo życia jest na początku prawie puste. | `ui.js`, `styles.css` | ekran gry na komputerze |
| D7 | **Telefon:** po wybraniu scenariusza strona zostaje przewinięta (na zrzucie o ok. 700 px), więc gracz ląduje pod dioramą. Nawet od góry strony diorama zaczyna się dopiero w ok. 70% wysokości ekranu, pod kafelkami HUD, osią er i paskiem linii, a przyklejony przycisk „Przeżyj turę” zasłania jej dół. Półprzezroczysty nagłówek przepuszcza tekst spod spodu. Podziałka na rycinie potrafi zająć połowę szerokości („1 cm” przy małym stawonogu). | `ui.js` (przejście do ekranu gry), `styles.css` (nagłówek, HUD, `.diorama`), `drawScaleBar` | `game-mobile-*.png` |
| D8 | **Narzędzia:** `npm run shots` przestał działać, bo prolog jest domyślnie włączony i skrypt czekał na ekran gry. | `scripts/screenshots.mjs` | — *(naprawione razem z tą propozycją)* |

---

## 2. Kierunek: „żywa tablica muzealna”

Zostajemy przy ilustracji, ale przesuwamy ją od szkicu na papierze w stronę
**muzealnej dioramy i tablicy paleoartystycznej**. Punkty odniesienia to
tablice Zdeňka Buriana i Charlesa R. Knighta (światło, nastrój ery, zwierzę jako
bohater kadru), *Kunstformen der Natur* Ernsta Haeckla (ornament i symetria
w kodeksie i ramkach), a z gier *Gris* (kolor jako narracja, akwarela)
i *Old Man's Journey* (warstwy papieru, głębia).

Trzy zasady, które dopisujemy do `STYL.md`:

1. **Tusz niesie czytelność, kolor niesie erę, światło niesie dramaturgię.**
2. **Każda scena ma bohatera.** Osobnik aktywnej linii jest największy i najbliżej, reszta stada buduje głębię.
3. **Wszystko na scenie nadal wynika z danych.** Nie dodajemy efektów, które nie mają odpowiednika w symulacji.

---

## 3. Pakiety zmian

Kolejność według stosunku efektu do kosztu. Koszty to dni pracy jednej osoby
z obecną znajomością kodu.

### A. Światło, kolor i głębia dioramy — *największy efekt, najmniejszy koszt*

| Zmiana | Jak | Pliki |
|---|---|---|
| **Scenariusz barw er** (*color script*) | Dla każdej z 12 par era × nisza ustalamy paletę pięciu barw: góra i dół tła, światło, cień, akcent. Paleozoik jest chłodny i zielono-turkusowy, mezozoik ciepły i oliwkowy z ochrą, kenozoik złoty z zielenią traw. Paleta zastępuje dzisiejsze mieszanie z papierem w 8–55%. Papier zostaje jako ziarno i ramka, a nie jako rozbielacz. | `scenery.ts` (`paintBackground`, `paintFar/Mid/Near`), `palette.ts` |
| **Kierunek światła** | Jedno słońce na scenę. Daje gradient światła na warstwach, jaśniejszą stronę roślin i skał oraz cień rzucany na grunt. W wodzie są kaustyki (przesuwana tekstura, tylko na wysokiej jakości). | `scenery.ts`, `diorama.ts` |
| **Perspektywa powietrzna** | Dalsze plany są jaśniejsze, chłodniejsze i mniej kontrastowe. Daleki plan rozmywamy raz przy malowaniu (`ctx.filter = 'blur()'`), więc nie kosztuje nic w trakcie gry. | `paintFar` |
| **Ramowanie kadru** | Ciemne, lekko rozmyte rośliny pierwszego planu wchodzą w kadr przy krawędziach, jak w gablocie. | `paintNear` |
| **Klimat tury = światło** | Zimno daje niskie, niebieskawe słońce i krótki dzień. Ciepło to złote światło i mgiełka. Przed katastrofą niebo nabiera rdzawego odcienia, który już dziś pojawia się jako odcień sceny, ale będzie wyraźniejszy. | `diorama.ts` |

**Koszt:** 2–3 dni. Bez nowych zależności. Wszystko malowane raz do tekstur,
więc w rendererze Canvas klatka kosztuje tyle co dziś.
**Ryzyko:** czytelność ikon i podpisów na ciemniejszych scenach. Trzeba
sprawdzić kontrast w obu motywach i przy `prefers-contrast: more`.

### B. Stworzenia: wyraźne sylwetki i bryła

| Zmiana | Jak | Pliki |
|---|---|---|
| **Bohater i głębia stada** | Osobnik aktywnej linii jest 1,6–2× większy i stoi w pierwszym planie. Reszta stada rozkłada się w 2–3 planach (mniejsza, jaśniejsza, wolniejsza). Liczebność czytamy z gęstości, a nie z drobnicy. | `diorama.ts` (`unitPxFor`, `depth`) |
| **Cień kontaktowy i światło konturowe** | Elipsa cienia pod osobnikiem na lądzie i przy dnie. Przy pieczeniu klatek druga, jasna kreska od strony światła odcina zwierzę od tła. | `bake.ts`, `diorama.ts` |
| **Przeciwcieniowanie** | Grzbiet ciemniejszy, brzuch jaśniejszy. Tak wygląda większość prawdziwych ryb i ssaków, więc przy okazji jest to **materiał edukacyjny** (karta wiedzy o kamuflażu może się do tego odwołać). | `draw.ts` (ton ciała) |
| **Formy końcowe z własnymi proporcjami** | Ptak dostaje krótki tułów, szyję, ogon z piór i dwie nogi pod środkiem ciężkości. Ssak ma pionowe kończyny i wyraźny kark. Forma rozumna stoi wyprostowana, ze środkiem ciężkości nad stopami. Pterozaur ma błonę od palca do nogi. Stawonogi mają odnóża zgięte w stawach, a nie proste. Mieszanie planów zostaje, ale każdy plan ma docelowy profil. | `draw.ts` (`planFor`, `buildBody`, `drawLeg`, `drawWing`), `arthropod.ts` |
| **Ruch wtórny** | Na wysokiej jakości 16–24 klatki zamiast 12. Ogon i płetwy falują z opóźnieniem fazy, do tego oddech i lekkie ugięcie przy wypadzie drapieżnika. | `bake.ts`, `draw.ts` |

**Koszt:** 4–6 dni. **Ryzyko:** wzorce testu wizualnego trzeba odświeżyć
(`npm run visual -- --update`) i dodać okazy dla nowych proporcji.
**Świadomie odrzucone:** widok 3/4 i rysunek z wielu kątów. Kosztowałby ok.
trzy razy więcej, a łatwo zgubić spójność.

### C. Momenty, które zostają w pamięci

Recenzja zwróciła uwagę, że animacja tury po kilku turach zaczyna się dłużyć.
Nowe momenty są więc **krótkie (do 1,5 s), da się je pominąć**, a przy
ograniczaniu ruchu się nie pojawiają.

| Moment | Na ekranie |
|---|---|
| **Zakup cechy** | Kamera dioramy przybliża bohatera, a nowa cecha **rysuje się piórkiem** (kreska narasta, potem kładzie się ton). Pojawia się podpis z odnośnikiem jak w atlasie: „Ryc. 3a — szczęki”. |
| **Specjacja** | Stado rozdziela się na dwie grupy w różnych barwach, a w rogu sceny wyrasta gałąź drzewa życia. |
| **Zmiana ery** | Pełnoekranowa tablica „Tablica II — Mezozoik”. Krajobraz przenika się z poprzednim, a roślinność nowej ery „wyrasta” z gruntu. |
| **Wielkie wymieranie** | Już działa. Dokładamy zatrzymanie kadru i desaturację, a po planszy pojawia się pierwsza kolorowa roślina jako zapowiedź odrodzenia. |
| **Zwycięstwo** | Rycina **przechodzi płynnie przez wszystkie stadia** linii w ok. 5 s, od robaczka do formy końcowej. To najtańszy efekt „wow”, bo płynne mieszanie planów budowy już istnieje. |
| **Raport tury** | Nad tabelą wykres „wodospad populacji”: stan początkowy → +narodziny → −drapieżniki → −głód → −katastrofa → stan końcowy, z ikonami faz z animacji. Liczby zostają w tabeli pod spodem. |

**Koszt:** 3–4 dni. Pliki: `turnplay.ts`, `portrait.ts`, `ui.js`, `styles.css`.

### D. Interfejs: mniej tabeli, więcej atlasu

| Zmiana | Jak |
|---|---|
| **Karty cech jako okazy** | Zamiast samej ikony miniatura zwierzęcia z cechą zaznaczoną fioletowym szkicem (podgląd już istnieje w `portrait.ts`). Opis skrócony do jednego zdania, a kompromis i warunki rozwijają się po kliknięciu. |
| **Pasek er jako przekrój skał** | Tury jako warstwy skalne w oficjalnych barwach okresów z tabeli stratygraficznej ICS. Wygląda dobrze i uczy, bo te same barwy są na mapach geologicznych. |
| **HUD z mikrowykresami** | Przy populacji mały wykres z ostatnich tur, przy EP pasek z prognozą. Liczniki animują zmianę wartości (bez animacji przy ograniczaniu ruchu). |
| **Przejścia między ekranami** | Przenikanie albo „przewrócenie karty” między startem, prologiem, grą i końcem. |
| **Telefon** | Ekran gry zaczyna się od góry. HUD w jednym rzędzie z krótszymi podpisami, dzięki czemu diorama mieści się w pierwszym kadrze nad przyklejonym przyciskiem. Pełne (nieprzezroczyste) tło nagłówka. Podziałka na rycinie ograniczona do 30% szerokości. |

**Koszt:** 2–3 dni. Pliki: `ui.js`, `styles.css`, `index.html`, `thumb.ts`.

### E. Materiał: prawdziwa akwarela — *opcjonalnie*

Dzisiejsze plamy tonu są równe i cyfrowe, a prawdziwa akwarela ma ziarno,
ciemniejsze brzegi plamy i przebarwienia. Są dwie drogi:

1. **Proceduralnie, malowane raz:** granulacja pigmentu (szum), ciemniejsza
   krawędź plamy (kreska tonu z rozmyciem), lekkie przesunięcie tonu
   względem konturu. Bez nowych plików, działa także w rendererze Canvas.
2. **Tekstury ręczne:** 3–4 skany papieru i akwareli (WebP, łącznie ok. 300–600 KB)
   nakładane trybem `multiply`. Na wysokiej jakości w WebGL może to być filtr
   Pixi (ciemne brzegi, papier). Daje największy skok „materiału”, ale wymaga
   decyzji o zasobach (licencja, ewentualnie ilustrator).

**Koszt:** 2 dni (droga 1) albo 2 dni + przygotowanie zasobów (droga 2).

### F. Warsztat i kontrola jakości — *przed etapem A*

- **Arkusz 12 scen era × nisza** w `npm run shots` (`scenes-light/dark.png`). Na nim porównujemy stan przed i po każdej zmianie.
- **Test wizualny dioramy:** nieruchomy kadr (jakość niska, stałe ziarno) dla kilku scen, z takim samym progiem jak dla stworzeń.
- **Kontrast:** skrypt mierzący kontrast konturu bohatera względem tła w 12 scenach i obu motywach.
- **Wydajność:** po każdym etapie powtarzamy pomiar z tabeli w `STYL.md`.

**Koszt:** 0,5–1 dnia.

---

## 4. Plan etapów

| Etap | Zakres | Czas | Co zobaczy gracz |
|---|---|---|---|
| 0 | F: arkusz scen, test wizualny dioramy, pomiar kontrastu | 0,5–1 dnia | nic, to siatka bezpieczeństwa |
| 1 | A: scenariusz barw, światło, głębia | 2–3 dni | inną grę od pierwszego ekranu |
| 2 | B: bohater, cień, przeciwcieniowanie, formy końcowe | 4–6 dni | zwierzęta, które da się rozpoznać |
| 3 | C: rysowanie cechy, tablica ery, przemiana na końcu, wodospad | 3–4 dni | chwile, o których się opowiada |
| 4 | D: karty-okazy, pasek skał, HUD, telefon | 2–3 dni | lżejszy, bardziej „atlasowy” ekran |
| 5 | E: materiał akwareli (opcjonalnie) | 2+ dni | „papier, który da się dotknąć” |

Razem **ok. 12–17 dni**. Każdy etap kończy się osobnym commitem z odświeżonym
`dist/index.html`, zrzutami przed/po i wpisem w `STYL.md`.

---

## 5. Czego nie robimy

- **3D i zmiana silnika.** Straciłoby się styl, mały rozmiar i działanie offline z jednego pliku.
- **Fotorealizm.** Kłóci się z zasadą, że model jest świadomie uproszczony, a uproszczenia oznaczamy.
- **Efekty bez danych.** Każdy element sceny nadal musi wynikać z symulacji.
- **Dłuższa animacja tury.** Czas tury zostaje 4–7 s, a nowe momenty są krótkie i da się je pominąć.

---

## 6. Jak poznamy, że się udało

| Kryterium | Próg |
|---|---|
| Rozpoznawalność form: „nazwij zwierzę z ryciny” (ryba, czworonóg, ptak, ssak, forma rozumna, stawonóg, głowonóg), 5+ osób | ≥ 80% trafień na każdą formę |
| Rozróżnialność er: kadr sceny bez podpisu → która era? | ≥ 90% trafień |
| Kontrast konturu bohatera względem tła (WCAG dla elementów nietekstowych) | ≥ 3:1 w 12 scenach × 2 motywy |
| Wydajność (tabela z `STYL.md`) | bez spadków |
| Rozmiar `dist/index.html` (dziś 1,1 MB, 455 KB po gzip) | ≤ 2,5 MB |
| Animacja tury | 4–7 s jak dziś, każdy nowy moment ≤ 1,5 s |

---

## 7. Decyzje do podjęcia

1. **Tylko kod, czy także tekstury malowane ręcznie** (pakiet E, droga 2)?
   Od tego zależy, czy szukamy ilustratora lub zasobów na licencji.
2. **Priorytet:** scena (A + B) czy chwile i interfejs (C + D)? Rekomendacja:
   najpierw A, bo daje największą zmianę najmniejszym kosztem i przygotowuje
   grunt pod B i C.
3. **Prototyp na jednym kadrze:** etap 1 można najpierw zrobić tylko dla jednej
   sceny (np. ląd w kenozoiku, dziś najbledszej) i porównać przed i po, zanim
   obejmie wszystkie 12.
