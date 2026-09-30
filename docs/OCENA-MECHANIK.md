# Ewolucja — ocena mechanik gry (29.09.2026)

> **Aktualizacja: wdrożono rekomendacje.** Opis niżej (od „Werdykt”) dotyczy
> stanu **sprzed** zmian. Stan po zmianach i pomiary — sekcja
> [7. Stan po wdrożeniu](#7-stan-po-wdrożeniu).

**Oceniany stan:** commit `9db216f` (po scaleniu PR #7: trwałe zachowania linii,
zdarzenia pozytywne jako karty decyzji). Testy: 232 testy silnika i 37 testów
ryciny, wszystkie zaliczone.

**Metoda.** Przeczytałem cały silnik (`js/engine.js`) i dane (`js/data.js`).
Potem rozegrałem kilka tysięcy partii botami z `test/bots.js` (200 partii na
wiersz, ziarna 1–200, świat z kodem). Na kopii botów zrobiłem **ablacje**:
wyłączałem po jednej mechanice i patrzyłem, o ile spada odsetek zwycięstw.
Do tego doszły dwa boty-exploity (farmienie radiacji, unikanie katastrof),
pomiar trafności prognozy i analiza przyczyn porażek.

> Boty to przybliżenie gracza, nie gracz. Bot „tactics1” czyta prognozę na
> jedną turę do przodu i kupuje ścieżkę ⭐, gdy nie grozi ona głodem. Dobrze
> modeluje ucznia, który korzysta z podpowiedzi. Nie modeluje gracza, który
> planuje kilka tur naprzód.

---

## Werdykt

| Obszar | Ocena | Jednym zdaniem |
|---|---|---|
| Rdzeń: energia, drapieżnictwo, pojemność niszy | **7/10** | Spójny i uczy kompromisu energetycznego, ale jedna oś (odżywianie) dominuje. |
| Ścieżka do zwycięstwa | **5/10** | Na trudnym ścieżka ⭐ arytmetycznie nie wystarcza. Na łatwym wygrywa się w najwcześniejszej możliwej turze. |
| Decyzje taktyczne (r/K, zachowania, karty, dobór) | **5/10** | Strategia r/K niesie prawie cały efekt. Dobór ukierunkowany nie ma żadnego wpływu, a kilka kart ma opcję dominującą. |
| Specjacja i nisze | **4/10** | Rozgałęzianie się nie opłaca. Ląd i powietrze to pułapki, a przybrzeże to nisza uniwersalna. |
| Losowość i regrywalność | **6/10** | Kod świata działa. Prognoza jest jednak niemal dokładna (±1,5%), więc w obrębie tury gra jest deterministyczna. |
| Krzywa trudności i scenariusze | **4/10** | Skok 99% → 67% → 23%. „Podbój lądu” to łatwy poziom pełnej gry. „Epoki lodowcowe” karzą ostrożność. |
| **Mechanika ogółem** | **5,5/10** | Solidny silnik z dobrą warstwą edukacyjną, ale znaczna część dodanych systemów nie zmienia wyniku. |

---

## 1. Wyniki zbiorcze

Odsetek zwycięstw (W), wymarcia (L), przetrwania (S) i średnia tura zwycięstwa.
Gra ma 20 tur. **Najwcześniejsze możliwe zwycięstwo przypada na turę 15**,
bo „Używanie narzędzi” i „Kultura akustyczna” odblokowują się w kenozoiku.

| Poziom | Bot | W | L | S | Tura wygr. | Droga (narzędzia / dźwięk) |
|---|---|---|---|---|---|---|
| łatwy | star (⭐ na ślepo) | 0% | 100% | 0% | — | — |
| łatwy | adaptive | 93% | 0% | 7% | 15,5 | 143 / 43 |
| łatwy | tactics1 | **100%** | 0% | 1% | **15,2** | 87 / 112 |
| normalny | star | 0% | 100% | 0% | — | — |
| normalny | adaptive | 38% | 7% | 55% | 19,0 | 66 / 10 |
| normalny | tactics1 | **67%** | 5% | 29% | 18,1 | 89 / 45 |
| normalny | tactics (+ specjacja) | 70% | 6% | 25% | 17,4 | 88 / 51 |
| normalny | crowd (klonowanie linii) | 46% | 20% | 35% | 17,2 | 47 / 44 |
| trudny | tactics1 | **22%** | 8% | 71% | 19,1 | 31 / 13 |
| trudny | tactics | 27% | 9% | 65% | 18,7 | 39 / 14 |
| „Podbój lądu” | tactics1 | 100% | 0% | 1% | 15,2 | *identyczne z łatwym* |
| „Epoki lodowcowe” | star (na ślepo) | **67%** | 9% | 25% | 18,0 | 134 / 0 |
| „Epoki lodowcowe” | adaptive / tactics | **0%** | 0% | 100% | — | — |

Co się sprawdza:

- **Ślepe plany giną.** Plany „kup wszystko” i „tylko ⭐” kończą się wymarciem
  w 100% partii na każdym poziomie. Gra skutecznie uczy, że mózg bez zaplecza
  pokarmowego zabija.
- **Czytanie prognozy i taktyka popłacają.** Na normalnym bot bez taktyki
  wygrywa w 38% partii, a z taktyką w 67%.
- **Ocena „zwycięstwo niemożliwe” nie myli się w wygranych.** W 178 wygranych
  partiach nie padła ani razu.

---

## 2. Najważniejsze problemy mechaniczne

### 2.1. Na poziomie trudnym ścieżka ⭐ nie sięga progu inteligencji

Inteligencję dają tylko cechy układu nerwowego i ręka chwytna:

| Źródło | Inteligencja |
|---|---|
| start | 1 |
| zwoje +2, mózg +3, rozbudowany mózg +4, zachowania społeczne +2 | 12 |
| droga narzędzi: ręka chwytna +1, narzędzia +3 | **16** |
| droga dźwięku: kultura akustyczna +3 | **15** |
| poza ⭐: opieka nad potomstwem +1 (wymaga „licznych jaj”) | +1 |

Próg wynosi 14 na łatwym, 15 na normalnym i **17 na trudnym**. Cała ścieżka ⭐
daje więc maksymalnie 16 (narzędzia) albo 15 (dźwięk). Na trudnym trzeba
dokupić cechę spoza ⭐ (opieka nad potomstwem, 24 EP + 12 EP za jaja) albo
liczyć na mutację inteligencji. Ta zdarza się z szansą około 2,8% na turę
i bywa też **ujemna**.

Skutek w danych: **45% wszystkich porażek bota na trudnym** to linia z kulturą,
populacją ≥ 50 i inteligencją 15–16. Gracz zrobił wszystko, co podpowiada
gwiazdka, i przegrał o 1–2 punkty. Na normalnym droga dźwięku ma zerowy zapas:
jedna szkodliwa mutacja inteligencji po zakupie mózgu (około 25% szans
w 15 turach) zamyka tę drogę.

**Rekomendacja:** oznaczyć „Opiekę nad potomstwem” jako ⭐ albo wyrównać sumy
dróg (np. echolokacja +1 inteligencji). Dla trudnego poziomu warto pokazać
wprost, że ⭐ daje 16/17.

### 2.2. Krzywa trudności: 100% → 67% → 22%

- **Łatwy** jest rozwiązany. Kompetentny bot wygrywa w 99–100% partii
  i średnio w turze 15,2, czyli w pierwszej turze, w której to w ogóle możliwe.
  Końcówka nie ma napięcia.
- **Trudny** różni się od normalnego głównie progiem inteligencji (patrz 2.1).
  Startowe EP to 35 wobec 34, a katastrofy są silniejsze tylko o 10%. Trudność
  wynika więc z jednej ukrytej przeszkody, a nie z ostrzejszego środowiska.
- **„Podbój lądu”** daje wyniki identyczne z pełną grą na łatwym, co do
  partii. Scenariusz nie ma żadnej własnej reguły: startowej niszy, celu
  lądowego ani premii za ląd. Obiecuje „szczególny nacisk na wyjście na ląd”,
  a tego nacisku w mechanice nie ma.
- **„Epoki lodowcowe”** (oznaczone jako trudne, mnożnik wyniku ×1,3) dalej
  nagradzają hazard. Start ma ujemny bilans energii (−0,1). Każdy gracz, który
  słucha prognozy, nie kupi mózgu i przegra (0%). Ślepe klikanie ⭐ wygrywa
  w 67% partii, zwykle z populacją 51–65. Scenariusz uczy odwrotnie niż
  pełna gra.

### 2.3. Strategia r działa za darmo przy pustych rezerwach (błąd)

W opisie strategia r „zużywa 1 ⚡ na turę”. Silnik pobiera jednak tylko tyle,
ile linia ma: `drain = Math.min(reserves, strat.reserveDrain)`
(`js/engine.js:535`). Linia z 0 ⚡ dostaje pełną premię rozrodu ×1,25 bez
kosztu. Sprawdziłem to prognozą: przy 0 ⚡ strategia r daje 23 narodziny
zamiast 18, a rezerwy po turze są identyczne (0,7) jak przy strategii
zrównoważonej. Zachowania linii obsługują ten sam przypadek poprawnie: bez
rezerw wracają do „zwykłego życia”.

To nie jest drobiazg, bo strategia r/K to **najsilniejsza dźwignia taktyczna
w grze** (patrz 3.1), a bot wybiera r najczęściej (2666 razy wobec 1523 razy K).

**Rekomendacja:** gdy linia nie ma 1 ⚡, strategia r powinna wracać do
zrównoważonej (tak jak `behaviorOf`) albo płacić kosztem potomstwa.

### 2.4. Rozgałęzianie się nie opłaca, a gra nagradza jedną linię

Specjacja, drzewo życia i radiacja to rdzeń tematu gry, ale warunek zwycięstwa
dotyczy **jednej linii** z ≥ 50 osobnikami. Każdy podział zabiera jej 40%
populacji.

| Wariant (normalny / trudny) | Zwycięstwa | EP łącznie | EP z radiacji |
|---|---|---|---|
| jedna linia (tactics1) | 67% / 23% | 353 | 2 |
| specjacja przy pełnej niszy (tactics) | 70% / 27% | — | — |
| specjacja do każdej wolnej niszy | 55% / 15% | 350 | 35 |
| bezmyślne klonowanie w tej samej niszy | 46% / 12% | — | — |

Premia +4 EP za każdą dodatkową niszę tylko przesuwa punkty: łączne EP się nie
zmienia, bo mniejsza populacja głównej linii daje mniej EP za liczebność
i wzrost. Rozważna specjacja daje +3–5 p.p., agresywna radiacja kosztuje
−12 p.p. Nie da się tego wykorzystać jako exploita, ale gracz, który
„ewoluuje jak natura”, przegrywa częściej.

**Rekomendacja:** coś, co działa tylko przy wielu liniach. Przykłady: zwycięstwo
liczy populację całego kladu z najbardziej rozwiniętą linią, cechy
przechodzą między linią-matką a gałęzią przy specjacji po niższym koszcie,
wymierania mocniej karzą gatunki jednoniszowe albo za przetrwanie
„ostatniego wymierania” w ≥ 2 niszach jest premia.

### 2.5. Ląd i powietrze to pułapki, przybrzeże to nisza uniwersalna

Nisze żywych linii na koniec 200 partii bota „tactics” (normalny):
**przybrzeże 192, woda 129, ląd 11, powietrze 0**. „Lot” kupiono w 0% partii.

- **Przybrzeże** nie ma wymagań, ma pokarm ×1,2 i jako jedyna nisza pozwala
  na obie drogi do rozumu. Nie ma powodu, by z niej wychodzić.
- **Ląd** wymaga kończyn, bez jaja lądowego ma rozród −2, a płetwy, linia
  boczna i filtrowanie przestają tam działać. Linia zbudowana w wodzie traci
  po migracji kilka punktów statystyk naraz.
- **Powietrze** (lot za 26 EP + 2 metabolizmu, pokarm ×0,7) nie daje nic,
  czego nie dałoby przybrzeże.

Edukacyjny łuk „wyjście na ląd” istnieje w tekstach, ale nie w decyzjach
gracza. Wcześniejsza recenzja pisała o „rybie z narzędziami”. Dziś to
„mieszkaniec przybrzeża z narzędziami” i jest to strategia optymalna.

**Rekomendacja:** dać przybrzeżu wyraźną wadę (np. niższą pojemność albo
częstsze katastrofy regionalne). Ląd powinien mieć realną przewagę: pojemność
40 na punkt pokarmu już jest, ale kary za cechy wodne ją zjadają. Warto też
rozważyć narzędzia tylko na lądzie i dźwięk tylko w wodzie, a przybrzeże jako
etap przejściowy.

### 2.6. Dominuje jedna oś: odżywianie

Częstość zakupu cech przez bota „tactics” (normalny, 200 partii):

| Zawsze (≥ 90%) | Często | Rzadko (≤ 6%) |
|---|---|---|
| filtrowanie 100%, szczęki 100%, wszystkożerność 100%, zwoje 100%, łuski 99%, mózg 97%, polowanie w grupie 96%, stałocieplność 93%, oczy 92%, izolacja 91% | echolokacja 81%, linia boczna 83%, kamuflaż 77%, liczne jaja 66%, kończyny 58% | **lot 0%, opieka nad potomstwem 0%, szybkie mięśnie 1%, pancerz 6%** |

Energia (odżywianie × pokarm − metabolizm × tlen) decyduje o rozrodzie,
głodzie i o tym, czy stać nas na mózg. Wszystkie trzy cechy pokarmowe
kupowane są w każdej partii, niezależnie od świata. Pancerz (+4 obrony,
ale +2 metabolizmu i −1 mobilności) i szybkie mięśnie przegrywają z tańszymi
łuskami i kamuflażem, bo metabolizm jest najdroższą statystyką w grze.
Dodatkowo koewolucja podnosi presję proporcjonalnie do obrony, więc
inwestycja w obronę częściowo się zeruje.

**Rekomendacja:** obniżyć koszt metabolizmu pancerza i mięśni albo dać obronie
nieliniowy zysk. Opieka nad potomstwem (−1 rozrodu, +1 metabolizmu) powinna
dawać coś w bilansie, np. mnożnik strat młodych ×0,8.

---

## 3. Decyzje taktyczne: co naprawdę zmienia wynik

### 3.1. Ablacja mechanik (bot tactics1, 150 partii)

| Wyłączona mechanika | Normalny | Trudny | Wpływ |
|---|---|---|---|
| — (pełny bot) | 67% | 23% | — |
| strategia r/K | 51% | 16% | **−16 / −7 p.p.**, największy |
| karty decyzji (zawsze opcja domyślna) | 62% | 25% | −5 / +2 p.p., w granicach szumu |
| zachowania linii | 65% | 19% | −2 / −4 p.p. |
| ukierunkowany dobór | 67% | 24% | **0 / +1 p.p.**, brak wpływu |
| wszystkie cztery | 38% | 10% | −29 / −13 p.p. |

Błąd standardowy przy 150 partiach wynosi około ±4 p.p.

Wnioski:

- **Ukierunkowany dobór jest martwy.** Za 3 🧬 na turę podnosi oczekiwany
  zysk z mutacji z +0,06 do +0,18 punktu statystyki na turę. Zużywa przy tym
  zmienność, która w innym miejscu daje do 30% ochrony przed katastrofą
  i płaci za specjację. Do usunięcia albo gruntownej przeróbki (np. dobór
  „celowany” w wybraną statystykę).
- **Karty decyzji** są ciekawe fabularnie, ale łącznie zmieniają wynik
  o kilka punktów procentowych.
- **Zachowania** mają umiarkowany, realny wpływ. Najczęściej wybierane są
  „zwykłe życie”, „gromadzenie zapasów” i „intensywne żerowanie”.
  „Ukrywanie się” wybierano rzadko (339 wyborów na 6381).

### 3.2. Karty z opcją dominującą

Wybory bota oceniającego wartość oczekiwaną (normalny, 150 partii):

| Karta | Wybór bota | Uwagi |
|---|---|---|
| Nieznany pokarm | „spróbuj” 85/85 | +1 odżywiania na stałe wobec jednorazowych −15%, bo odżywianie dominuje (2.6) |
| Symbioza | „przyjmij” 70/71 | −1 metabolizmu na stałe wobec jednorazowych −12% |
| Pokrewna populacja | „krzyżuj” 48/48 | 60% na +6 🧬 i +10% populacji |
| Wyspa | „kolonizuj” 63/63 | darmowa linia i dodatkowo **kopia rezerw rodzica** (patrz 4) |
| Nowy drapieżnik | „wyścig zbrojeń” 55/57 | +1 obrony na stałe, a +1,5 koewolucji wygasa samo (poziom wraca do celu o 35% na turę) |
| Konkurent | „wypieraj” 73/79 | |

Wzór się powtarza: **trwały zysk statystyki bije jednorazową stratę
populacji**, bo populacja odrasta w 1–2 tury, a statystyka zostaje na całą
grę. Ciekawe dylematy dają karty „Zakwit”, „Wulkan”, „Niezwykły mutant”
i „Chudy sezon”, w których wybory rozkładają się mniej więcej po równo.

**Rekomendacja:** porażki w kartach ze stałą nagrodą powinny też być trwałe
(np. −1 do statystyki), albo stała nagroda powinna wygasać po kilku turach.

### 3.3. Prognoza jest niemal dokładna

Różnica między prognozą a rzeczywistą populacją (tury bez ryzyka z karty,
linie ≥ 30 osobników): **p10 = −1,7%, mediana 0,0%, p90 = +1,4%**, także
w turach katastrof. Jedynym źródłem niepewności są mutacje i wynik ryzyka.

Edukacyjnie to zaleta, bo przyczyna i skutek są jasne. Z punktu widzenia
mechaniki oznacza to, że **decyzje w obrębie tury są rozwiązywalne kursorem**.
Wyzwanie leży tylko w planowaniu na kilka tur, czyli w zbieraniu EP na
kenozoik i przygotowaniu linii na zapowiedziane wymieranie. Jeśli ma zostać
jako gra, warto rozważyć prognozę z przedziałem („120–150”) albo losowe
odchylenie warunków ujawniane dopiero w turze.

---

## 4. Drobniejsze usterki i niespójności

1. **Kopiowanie zasobów przy podziale.** `splitLineage` daje nowej linii pełne
   ⚡ rezerwy rodzica bez odejmowania ich rodzicowi (`js/engine.js:427`).
   Przy specjacji to samo dzieje się ze 🧬 zmiennością (celowo, według
   komentarza). Energia „bierze się znikąd”, co podbija kartę „Wyspa”.
2. **Cel „Przetrwać kataklizm” da się zaliczyć za darmo.** Sprawdza pierwszą
   katastrofę ery, także regionalną. Jeśli linia przeniesie się z zagrożonej
   niszy, straty wynoszą 0% i cel jest zaliczony, zanim przyjdzie prawdziwe
   wymieranie (`evaluateEraGoals`, `catLoss`).
3. **Koewolucja jest globalna.** Poziom drapieżników zależy od najlepiej
   bronionej linii i działa na wszystkie nisze, także na gałąź w powietrzu.
   Pancerna linia w wodzie podnosi więc presję na linię lądową, co jest
   kolejną karą za rozgałęzianie.
4. **Zapowiedź katastrofy nie pokazuje siły w poszczególnych niszach.**
   Wymieranie ordowickie i dewońskie na lądzie ma siłę 5% wobec 45% i 20%
   w wodzie, ale gracz tego nie widzi. Migracja nie ma prognozy „co-jeśli”.
   W praktyce unikanie katastrof migracją dało botowi +2 / −2 p.p., więc to
   nie exploit, tylko informacja, która mogłaby uczyć selektywności wymierań.
5. **Sygnał „zwycięstwo niemożliwe” przychodzi późno.** Ocena jest celowo
   hojna (+1 inteligencji na turę, 40 EP na turę). W przegranych partiach na
   normalnym pojawiła się w 25 z 66, średnio w turze 18,4 z 20. Nie myli się,
   ale rzadko pomaga.
6. **Kosmetyka w danych:** trudny ma 35 startowych EP, a normalny 34, co
   wygląda na przeoczenie. `RESERVES.drawMax` = 1,5 na turę sprawia, że przy
   dużym deficycie rezerwy prawie nie chronią przed głodem, choć opis
   sugeruje, że chronią.

---

## 5. Co działa dobrze

- **Rdzeń energetyczny** jest przejrzysty i uczy tego, co ma uczyć: każda cecha
  ma cenę w metabolizmie, a mózg wymaga zaplecza pokarmowego.
- **Pojemność niszy** z wzrostem theta-logistycznym i przegęszczeniem działa.
  Przegęszczenie odpowiada za 6% zgonów, więc jest odczuwalne, ale nie
  dominuje.
- **Katastrofy są realnym zagrożeniem.** Odpowiadają za 54% wszystkich zgonów
  w partiach bota, a zapowiedź turę wcześniej daje czas na reakcję.
- **Kod świata** i przesuwane wymierania działają. Rozrzut odsetka zwycięstw
  między światami (odchylenie standardowe 0,25 wobec 0,19 przy czysto
  losowym wyniku) pokazuje, że świat ma znaczenie, ale żaden nie jest z góry
  przegrany.
- **Losowe zaokrąglanie i efekt Allee** usunęły dawną nieśmiertelność małych
  populacji, a warunek żywotnej populacji (≥ 50) zamyka lukę „rozumu jednego
  osobnika”.
- **Obie drogi do rozumu są grywalne.** Na normalnym bot wygrywa narzędziami
  i dźwiękiem w proporcji około 2:1.

---

## 6. Priorytety zmian

| # | Zmiana | Zakres | Efekt |
|---|---|---|---|
| 1 | Naprawić darmową strategię r przy 0 ⚡ (2.3) | 1 linia w silniku + test | usuwa błąd w najsilniejszej dźwigni |
| 2 | Wyrównać sumę inteligencji dróg i ⭐ z progiem trudnego (2.1) | dane | trudny przestaje być „ukrytą pułapką” |
| 3 | Dać „Podbojowi lądu” własną regułę; przerobić start „Epok lodowcowych” na dodatni bilans (2.2) | dane scenariuszy | scenariusze zaczynają się różnić |
| 4 | Powód, by się rozgałęziać (2.4) i by wyjść z przybrzeża (2.5) | projekt | najważniejsze dla tematu gry |
| 5 | Usunąć albo przerobić ukierunkowany dobór (3.1) | silnik + UI | mniej przycisków bez wpływu |
| 6 | Trwałe koszty porażek w kartach ze stałą nagrodą (3.2) | dane | prawdziwe dylematy |
| 7 | Rozszerzyć łatwy poziom o napięcie w końcówce (np. cel 15 i mniej EP) | dane | łatwy przestaje być formalnością |

<sub>Metodologia: boty z `test/bots.js` na commicie `9db216f`, ziarna 1–200,
świat z kodem `BOT<n>`. Ablacje na kopii botów z przełącznikami wyłączającymi
karty, strategię, zachowania i dobór (150 partii na wariant). Seed-variance:
60 światów × 6 strumieni gracza. Trafność prognozy: 100 partii, porównanie
`Engine.forecast` z wynikiem `simulateTurn` dla każdej linii ≥ 30 osobników.</sub>

---

## 7. Stan po wdrożeniu

Pomiary: 300 partii na wiersz (ziarna 1–300), boty z `test/bots.js`. Bot
„klad” prowadzi gałęzie w wolnych niszach, „jedna linia” to `tactics1`. Połowa
partii to gracz „lądowy”, połowa „wodny” (`pref: 'mix'`).

### 7.1. Co zmieniono

| Problem (sekcja) | Zmiana |
|---|---|
| 2.3 darmowa strategia r | Bez 1 ⚡ strategia r wraca do zrównoważonej; prognoza i raport to mówią. |
| 2.1 sufit inteligencji | Echolokacja +1 inteligencji, opieka nad potomstwem na ścieżce ⭐ (i straty ×0,8). Obie drogi: 16 bez opieki, 17 z opieką. Progi: 15 / 16 / 17. |
| 2.2 krzywa trudności | Trudność przez środowisko (katastrofy ×0,9 / ×1,15 / ×1,3, drapieżniki, koewolucja) i EP startowe (34 / 28 / 26). |
| 2.2 „Podbój lądu” | Start na przybrzeżu z płetwami, zwycięstwo tylko narzędziami na lądzie, ląd wyżywi o 25% więcej, cel „Wyjdź na ląd” w paleozoiku. |
| 2.2 „Epoki lodowcowe” | Start z dodatnim bilansem (szczęki, wszystkożerność, jajo lądowe), tylko narzędzia, 70 EP. |
| 2.4 rozgałęzianie | Zwycięstwo liczy cały klad (linia ≥ 25, gatunek ≥ 60); szeroki zasięg łagodzi katastrofy (×0,55 / 0,42 / 0,33 dla 2–4 nisz); 2 katastrofy regionalne na erę w najliczniejszą niszę; ewolucja równoległa (−40% ceny cechy linii pokrewnej); +8 EP za każdą dodatkową niszę; specjacja tańsza (6 🧬 + 3 za linię). |
| 2.5 nisze | Narzędzia tylko na lądzie, kultura akustyczna tylko w otwartej wodzie; przybrzeże: pokarm ×1,1, drapieżniki ×1,3, pojemność 20 na punkt pokarmu; lot tańszy (22 EP, metabolizm +1), powietrze: pokarm ×0,8, +3 EP. |
| 2.6 dominacja odżywiania | Filtrowanie (+3, woda) i szczęki wykluczają się — dwa sposoby życia; pancerz, szybkie mięśnie i rozbudowany mózg: metabolizm −1; jajo lądowe 16 EP. |
| 3.1 martwy dobór | Dobór na wybraną statystykę (szansa 50%, inteligencja 30% i tylko z mózgiem) za 1 🧬 na turę i rozród ×0,8 (koszt doboru Haldane’a). |
| 3.2 karty z opcją dominującą | Porażki w kartach ze stałą nagrodą też są trwałe (pokarm: metabolizm +1, symbioza: rozród −1, wyścig zbrojeń: metabolizm +1); wyspa to ryzyko; ostrzejsze opcje domyślne; karty w 55% tur. |
| 3.3 prognoza jak kalkulator | Ukryte odchylenie warunków ±1 (pokarm, drapieżniki) — prognoza podaje przedział; katastrofy zapowiadane do 2 tur wcześniej z przedziałem siły w każdej niszy (siła tury losowana ×0,8–1,2). |
| 4.1 kopiowanie rezerw | Podział linii dzieli też ⚡ proporcjonalnie do osobników. |
| 4.2 darmowy „kataklizm” | Cel liczy tylko katastrofę, która dosięgła gatunku. |
| 4.3 globalna koewolucja | Poziom drapieżników osobno w każdej niszy; karty zmieniają go w niszy linii. |
| 4.4 siła w niszach | Zapowiedź podaje przewidywane straty w każdej niszy. |

### 7.2. Metryki: cel i wynik

| Kryterium | Przed | Cel | Po zmianach |
|---|---|---|---|
| Wygrane (klad): łatwy / normalny / trudny | 100 / 67 / 22% | ~85 / 60 / 35% | **86 / 65 / 32%** |
| Ślepy plan („kup ⭐”, „kup wszystko”) | 0% | 0–10% | **0%** |
| Zysk z rozgałęziania (klad vs jedna linia) | +3 p.p. | ≥ +15 p.p. | **+6 / +9 / +10 p.p.** ⚠️ |
| Wpływ mechaniki po wyłączeniu (normalny / trudny) | karty −5/+2, r/K −16/−7, zachowania −2/−4, dobór 0/+1 | każda ≥ 5 p.p. | **karty −8/−6, r/K −9/−9, zachowania −23/−11, dobór −3/−17** ⚠️ |
| Najlepszy vs najgorszy wybór w kartach | ~2 p.p. | — | **+9 / +7 p.p.** |
| Cechy kupowane w < 5% lub > 95% partii | 7 | 0–2 | **3** (zwoje 100% — korzeń obu dróg; lot 2%, szybkie mięśnie 4%) ⚠️ |
| Linie na lądzie lub w powietrzu na koniec gry | 5% | ≥ 30% | **32%** |
| Karty z opcją wybieraną w > 90% przypadków | 6 | 0 | **0** (najwyżej 85%) |
| Tura zwycięstwa (normalny) | prawie zawsze 19–20 | 15–20 | **15: 55, 16: 59, 17: 32, 18: 19, 19: 13, 20: 18** |
| Drogi do rozumu (normalny) | narzędzia ≈ 2× dźwięk | obie grywalne | **narzędzia 119, dźwięk 77** |
| „Epoki lodowcowe”: rozwaga vs ślepy plan | 0% vs 67% | rozwaga ≥ hazard | **72% vs 40%** |

### 7.3. Czego nie osiągnięto

- **Rozgałęzianie** daje +6–10 p.p., nie +15. Bot kladowy jest prosty
  (gałęzie kupują cechy tylko wtedy, gdy poprawiają prognozę), więc to raczej
  dolna granica, ale nie mam na to dowodu.
- **Dobór na normalnym** ma mały wpływ (−3 p.p.). Na trudnym jest kluczowy
  (−17 p.p.), bo tam brakuje punktu inteligencji.
- **Lot** kupuje się rzadko (2%). Powietrze się opłaca (EP, mało drapieżników),
  ale bot rzadko ma wolne EP na gałąź z kończynami w mezozoiku. Gracz, który
  planuje radiację, może z tego korzystać częściej.
- **Kalibracja opiera się na botach.** Potrzebne są testy z uczniami: czy
  rozumieją przedział prognozy, wykluczenia cech i koszt doboru.
