# Ewolucja — recenzja

> **Dokument historyczny.** Ta recenzja powstała, gdy Ewolucja była grą edukacyjną dla uczniów,
> i ocenia ją również jako pomoc dydaktyczną. Od zmiany założeń ([`ZALOZENIA.md`](../ZALOZENIA.md), sekcja 13)
> wartość edukacyjna nie jest kryterium, a fragmenty o quizach, trybie nauczyciela i lekcjach
> **nie obowiązują**. Pomiary i opis mechanik zachowano jako zapis stanu z tamtego dnia.

> **Gatunek:** strategia turowa, gra edukacyjna · **Platforma:** przeglądarka (jeden plik HTML, działa offline) · **Cena:** za darmo · **Wersja testowana:** 0.2.0, commit `7fadc26` · **Czas jednej partii:** 20–30 minut
>
> **Wymagania:** dowolna przeglądarka z ostatnich lat. Na słabszym sprzęcie gra sama obniża jakość grafiki.

---

## Piękna rycina, która liczy za ciebie

*Ewolucja* wygląda jak plansza z muzealnej gabloty, na którą ktoś tchnął życie. Pod papierową oprawą siedzi jednak arkusz kalkulacyjny, i to taki, który sam podpowiada wynik. Zanim przejdziemy do tego, co w tej grze zgrzyta, trzeba uczciwie oddać, co się udało. Udało się sporo.

### Na start: prazwierzę i 34 punkty

Wybierasz scenariusz, nazywasz gatunek i dostajesz 120 bezkształtnych stworzonek w kambryjskim morzu. Twoim celem jest doprowadzić je przez paleozoik, mezozoik i kenozoik do „progu rozumności”, czyli do inteligencji 15 i używania narzędzi. Linia, która ten próg przekroczy, musi przy tym liczyć co najmniej 50 osobników. Na to masz 20 tur. W każdej wydajesz punkty ewolucji na cechy (24 do wyboru, od płetw po rozbudowany mózg), ustawiasz strategię rozrodu i zachowanie linii, a potem klikasz „Przeżyj turę” i patrzysz, co przyroda zrobi z twoim planem. Najczęściej robi z nim coś złego.

Inspiracją jest *Evolution: The Game of Intelligent Life* z 1997 roku i widać to w dobrym sensie. Też jest tu drzewo cech, też są wielkie wymierania jako punkty zwrotne, też chodzi o to, żeby z ryby zrobić kogoś, kto wymyśli koło.

### Oprawa: najmocniejsza karta

Pod względem wizualnym *Ewolucja* bije większość darmowych gier edukacyjnych, a spora część komercyjnych jej nie dorównuje. Styl „ilustracji naukowej” jest konsekwentny od pierwszego do ostatniego piksela: szeryfowa typografia, papierowa paleta, podpisy „Ryc. 1.” i podziałka „20 cm” pod portretem gatunku. Najlepszy pomysł to **zwierzę składane z cech**. Kupujesz szczęki i na rycinie pojawiają się szczęki, kupujesz futro i robi się puchate. Po najechaniu na cechę widzisz jej szkic na zwierzęciu, zanim zapłacisz. Na ekranie końcowym czeka „droga ewolucji” w miniaturach, od robaczka po to, co z niego wyrosło. To naprawdę cieszy.

Nad panelami żyje diorama niszy: ławica w wodzie, stado na lądzie, pokarm i drapieżniki w liczbie wynikającej wprost z symulacji. Tura rozgrywa się jako krótka animacja z atakami, głodem, narodzinami, a raz na erę z meteorytem albo lodowcem. Ładne i czytelne, choć po piątej turze 4–10 sekund animacji zaczyna się dłużyć. Na szczęście można ją wyłączyć w ustawieniach.

### Mechanika: od „nie da się przegrać” do „nie da się wygrać na ślepo”

Wcześniejsze wersje tej gry miały poważny kłopot: nie dało się przegrać, a do zwycięstwa prowadził jeden przepis („kupuj mózg”). Tamten stan jest już przeszłością. Rozegrałem na obecnym silniku kilka tysięcy partii botami i wyniki mówią jasno:

| Styl gry (poziom normalny) | Zwycięstwo | Wymarcie |
|---|---|---|
| Nic nie kupuję | 0% | **81%** |
| Kupuję wszystko po kolei | 0% | **100%** |
| Tylko ścieżka do mózgu ⭐ | 0% | **100%** |
| Czytam prognozę przed zakupem | 48% | 0% |
| Prognoza + strategie, zachowania, karty decyzji | 60% | 0% |
| To samo + specjacja do wolnych nisz | 63% | 0% |

Ślepy plan to dziś wyrok śmierci, a bierność też zabija. Mózg bez zaplecza pokarmowego zagłodzi populację, więc gra wreszcie uczy tego, co obiecuje: każda adaptacja kosztuje, a środowisko wystawia rachunek. Takie jest źródło największej satysfakcji. Kiedy linia przechodzi wymieranie permskie, bo odłożyłeś rezerwy i nie przepaliłeś metabolizmu na pancerz, czujesz, że to twoja zasługa.

Sprawdziłem to też na sobie. Grałem „jak typowy uczeń”: brałem cechy ze ścieżki ⭐ i pomijałem ostrzeżenia o bilansie energii. Skończyłem z inteligencją **17/15**, narzędziami, ręką chwytną i futrem, a gra i tak ogłosiła **wymarcie**, bo z mojego „gatunku rozumnego” zostało 11 osobników. Taka lekcja zostaje w głowie. Ma jednak swoją cenę, o której niżej.

### …tylko że gra podaje ci ściągawkę

Sercem rozgrywki jest **prognoza „co-jeśli”**. Najeżdżasz na cechę, strategię albo zachowanie i od razu widzisz, ile osobników będzie w następnej turze, jaki wyjdzie bilans energii, ile zostanie rezerw i czy nisza się nie przepełni. Edukacyjnie to znakomite, bo przyczyna i skutek są na wyciągnięcie ręki. Jako gra to jednak problem: **optymalny ruch znajdujesz, przesuwając kursorem po przyciskach**. Bot, który robi dokładnie to i nic więcej (nie planuje, nie pamięta, nie przewiduje katastrof), wygrywa prawie połowę partii na normalnym i trzy czwarte na łatwym. Przez większość tury nie podejmujesz decyzji, tylko szukasz największej zielonej liczby.

Prognoza obejmuje jedną turę do przodu, więc prawdziwe wyzwanie leży gdzie indziej: w oszczędzaniu EP na drogie cechy kenozoiku i w przygotowaniu linii na wymierania. Te są jednak **zawsze w tych samych turach** (3., 8., 14., 19.). Warunki są losowane wokół wartości historycznych, ale kalendarz katastrof się nie zmienia. W drugiej partii już wiesz, że w 8. turze przyjdzie perm, a w 14. asteroida.

### Trzy waluty, dwa przełączniki, jeden problem

Obok EP gra ma **⚡ rezerwy energii** i **🧬 zmienność genetyczną** (osobne dla każdej linii), a do tego strategię rozrodu r/K, cztery zachowania w turze, ukierunkowany dobór i karty decyzji (wyspa, nowy drapieżnik, zakwit, epidemia). Każdy z tych elementów jest sensowny i każdy ma kartę wiedzy, która tłumaczy jego biologię. Razem to jednak dużo przycisków w lewym panelu, który i tak trzeba przewijać. Zysk jest skromny: pełne zarządzanie taktyką podnosi skuteczność z 48% do 60%. Wszystko działa, ale niewiele z tego czuć w wyniku.

Najbardziej zawodzi **specjacja**, czyli teoretycznie najbardziej „ewolucyjna” mechanika w grze. Rozdzielanie linii i wysyłanie gałęzi do wolnych nisz daje na normalnym **trzy punkty procentowe** przewagi (63% zamiast 60%), a na trudnym jeden. Drzewo życia jest przepiękne, ale to raczej pamiątka niż narzędzie. Z kolei **lot**, efektowna cecha za 26 EP otwierająca niszę powietrzną, nie został kupiony ani razu w 200 partiach najlepszego bota. Nisza powietrzna to w praktyce dekoracja.

### Przegrywasz w 8. turze, dowiadujesz się w 20.

To mój najpoważniejszy zarzut. Populacja, która raz spadnie w okolice 25 osobników (a po źle przygotowanym wymieraniu permskim spada łatwo), rośnie potem o 1–3 osobniki na turę. Do wymaganych 50 nie wróci przed końcem gry. Formalnie grasz dalej i kupujesz kolejne mózgi, ale **partia jest rozstrzygnięta**, a gra nie mówi tego wprost. Ostrzeżenie o „krytycznie małej populacji” pojawia się dopiero poniżej 20. W mojej partii od 8. do 20. tury przeklikałem dwanaście tur bez szans na zwycięstwo. Na lekcji trwającej 45 minut to bolesna strata czasu.

Z tym wiąże się drugi problem: **zwycięstwo przychodzi prawie zawsze w ostatniej chwili**. Średnia tura wygranej to na normalnym 19,1–19,8 z 20. „Używanie narzędzi” odblokowuje się w kenozoiku i kosztuje 34 EP, więc finał jest zwykle rachunkiem („czy do 19. tury uzbieram na narzędzia?”), a nie kulminacją. Co trzecia dobrze rozegrana partia kończy się wynikiem „przetrwanie”, czyli wszystko poszło dobrze, tylko zabrakło kilku punktów. To mało satysfakcjonujący finał dla gry, której tematem jest narodziny rozumu.

### Scenariusze i drobniejsze zgrzyty

- **„Epoki lodowcowe”** (sześć tur w kenozoiku) nagradza hazard. Ostrożny bot, który nie kupuje cech prowadzących do głodu, wygrywa w 0% partii. Bot kupujący ⭐ na ślepo wygrywa w 23%, zwykle z populacją 51–54 osobników, czyli tuż nad progiem. To scenariusz „wszystko albo nic”, choć przedstawia się jako „twardy sprint”.
- **Ryba z narzędziami.** Nic nie zmusza do wyjścia z wody. Moja linia spędziła całą grę w morzu i dorobiła się futra, stałocieplności, kończyn, ręki chwytnej i używania narzędzi. Gra edukacyjna, która pozwala wyewoluować futrzaną rybę-majsterkowicza bez komentarza, pogrzebała nieco własne przesłanie o niszach.
- **Karty wiedzy się powtarzają.** Raport tury pokazuje każdą kartę pasującą do zdarzeń tury, także te dawno odkryte. „Bilans energetyczny” wyskakiwał mi w co drugiej turze. Po trzeciej turze uczeń klika „Dalej” bez czytania i najcenniejsza warstwa gry zamienia się w szum.
- **Panel adaptacji** to ściana 24 kart na ponad 3000 pikseli wysokości, wyświetlanych zawsze, także zablokowanych. Najważniejsza gałąź, „Układ nerwowy”, jest na samym dole.
- **Raport tury** to głównie tabela liczb. Jest rzetelny, ale suchy, i nie odróżnia tego, co było twoją decyzją, od tego, co było pechem.

### Technicznie: wzór

Tu zarzutów brak. 180 testów silnika i 35 testów ryciny przechodzi. Budowa daje plik identyczny z tym w repozytorium (970 KB, 411 KB po kompresji). Pełna partia w Chromium nie wyrzuciła ani jednego błędu w konsoli. Gra działa z dysku, bez serwera i internetu, ma tryb jasny i ciemny, obsługę klawiatury, `prefers-reduced-motion` i tryb nauczyciela z cofaniem tury. Silnik jest czystą, deterministyczną logiką oddzieloną od interfejsu. Wiele komercyjnych gier edukacyjnych wypada pod tym względem gorzej.

---

## Plusy i minusy

**Plusy**
- ➕ wyjątkowa, spójna oprawa „ryciny naukowej”; zwierzę rysowane z kupionych cech
- ➕ realna stawka: ślepe plany i bierność kończą się wymarciem
- ➕ uczciwa prognoza i raport „co się stało i dlaczego”, dobry materiał na lekcję
- ➕ rzetelny Kodeks z odniesieniami do prawdziwych skamieniałości
- ➕ działa offline z jednego pliku, zero błędów, dostępność, tryb nauczyciela

**Minusy**
- ➖ prognoza wskazuje optymalny ruch; większość tury to szukanie najwyższej liczby
- ➖ stały kalendarz katastrof, więc druga partia jest przewidywalna
- ➖ partia bywa rozstrzygnięta w połowie, a gra każe grać do końca
- ➖ zwycięstwo prawie zawsze w 19.–20. turze jako rachunek, nie kulminacja
- ➖ specjacja i nisza powietrzna prawie bez wpływu na wynik
- ➖ nadmiar przełączników o małym znaczeniu; powtarzające się karty wiedzy
- ➖ scenariusz „Epoki lodowcowe” nagradza hazard zamiast rozwagi

---

## Oceny

| Kategoria | Ocena |
|---|---|
| Oprawa graficzna | **8/10** |
| Mechanika i balans | **6/10** |
| Wartość edukacyjna | **7/10** |
| Interfejs i czytelność | **5/10** |
| Regrywalność | **4/10** |
| Warsztat techniczny | **9/10** |

## Werdykt: **6/10**

*Ewolucja* przeszła długą drogę od „ładnej gry, której nie da się przegrać” do gry, która karze za głupotę, i za to należy się szacunek. Na jedną lub dwie lekcje biologii to wciąż jedna z najlepszych darmowych pomocy, jakie widziałem: piękna, rzetelna i uczy przez porażkę. Jako gra strategiczna nadal jest jednak **bardziej kalkulatorem niż wyzwaniem**. Za dużo decyzji rozstrzyga podpowiedź, za mało rozstrzyga planowanie, a świat w drugiej partii nie ma już niespodzianek.

Żeby dojść do siódemki lub ósemki, trzeba trzech rzeczy: losowego (albo przynajmniej przesuwanego) kalendarza wymierań, uczciwego sygnału „tej partii już nie wygrasz” zamiast dwunastu pustych tur oraz powodu, żeby naprawdę rozgałęziać drzewo życia. Oprawa jest gotowa, teraz ewolucji potrzebuje rozgrywka.

---

<sub>Metodologia: partia przez interfejs w Chromium (Playwright, 20 tur, scenariusz „Pełna ewolucja”), 200 partii na każdy wariant bota z `test/bots.js` na trzech poziomach trudności i trzech scenariuszach, 300 partii na wariant z `scripts/boty-balans.js`. Wszystko na commicie `7fadc26`.</sub>
