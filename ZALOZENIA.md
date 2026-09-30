# Ewolucja — założenia projektowe

Turowa gra strategiczna o ewolucji życia na Ziemi, dla **młodzieży i dorosłych**.
Inspirowana *Evolution: The Game of Intelligent Life* (Discovery Channel Multimedia /
Crossover Technologies, 1997). Gracz prowadzi linie rodowe organizmów przez kolejne
ery geologiczne — od prostego życia w morzu aż do gatunku rozumnego — i płaci za
każdą adaptację, walcząc z głodem, konkurentami i wielkimi wymieraniami.

> **Kierunek.** Ewolucja powstała jako pomoc dydaktyczna dla uczniów. Ten zamiar
> został **świadomie odcięty**: to pełnoprawna gra dla młodzieży i dorosłych.
> Każdą decyzję projektową rozstrzyga pytanie „czy to czyni grę lepszą?”, a nie
> „czy to pasuje do lekcji?”. Nauka jest **materiałem i gwarancją uczciwości
> świata**, nie celem gry. Co dokładnie odcięto i co zostało: sekcja 13.

---

## 1. Wizja i odbiorcy

### 1.1. Wizja
Prowadzisz nie pojedyncze zwierzę, lecz **linię rodową** — populację, która
rośnie, głoduje, rozgałęzia się i wymiera. Masz kilkaset milionów lat i ograniczony
budżet. Każda adaptacja ma cenę, każda przewaga jest przewagą **tylko w danych
warunkach**, a świat potrafi w jednej turze zniszczyć plan budowany przez dziesięć.
Na końcu, jeśli się uda, rozumny gatunek staje przed własnym pytaniem: co zrobi ze
światem, który go ukształtował (epilog „Antropocen”).

### 1.2. Doświadczenie gracza
Po co gracz wraca do kolejnej partii:

- **Plan, który trzeba było zmienić.** Budujesz linię pod obecny świat, a świat
  się zmienia: klimat, tlen, pokarm, konkurenci, katastrofy.
- **Kompromis w każdym wyborze.** Mózg kosztuje energię, pancerz ruchliwość, dużo
  potomstwa jego przeżywalność. Nie ma cechy „po prostu lepszej”.
- **Napięcie i ryzyko.** Karty decyzji z losowanym wynikiem, wymierania
  zapowiadane z wyprzedzeniem, ale nie dokładnie, prognoza w postaci przedziału.
- **Opowieść o własnej linii.** Każda partia zostawia rycinę gatunku, drzewo życia,
  wynik i epilog — coś, co da się pokazać innym.
- **Różne drogi do celu.** Ląd i narzędzia albo otwarta woda i kultura akustyczna;
  strategia r albo K; roślinożerca, mięsożerca albo wszystkożerca; jedna linia albo
  cały klad w wielu niszach.

### 1.3. Odbiorcy
- **Młodzież i dorośli** lubiący strategie turowe, gry o zarządzaniu zasobami
  i ryzykiem oraz tematykę przyrodniczą.
- Nie zakładamy żadnej wiedzy biologicznej i niczego nie sprawdzamy: gra ma być
  zrozumiała z samej rozgrywki i raportów.
- Nie zakładamy nauczyciela, klasy ani lekcji. Gra jest projektowana dla osoby
  siedzącej samotnie przy komputerze lub telefonie, z opcją porównania wyników
  ze znajomymi (kod świata).
- **Ton:** rzeczowy, poważny, z odrobiną suchego humoru naukowego. Bez
  infantylizacji: bez maskotek, pochwał za samo kliknięcie i zdrobnień.

### 1.4. Miejsce nauki
Model opiera się na prawdziwej biologii i paleontologii (ery, wymierania,
skamieniałości, ekologia), bo to daje światu gry wiarygodność i bogactwo, a nie po
to, by egzaminować. Zasady:

1. **Mechanika prawdziwa w duchu.** Dobór, kompromis, pojemność środowiska,
   wymieranie i konkurencja działają tak, jak działają w przyrodzie — ale
   uproszczenia wybieramy ze względu na dobrą grę, nie na dokładność.
2. **Fakty w treści są poprawne.** Kodeks, raporty i opisy nie mogą podawać
   fałszu. Uproszczenie, które mogłoby wprowadzić w błąd, nazywamy uproszczeniem.
3. **Gra nie sugeruje, że ewolucja ma cel.** Cel ma gracz. Świat nie „chce”
   inteligencji — to gracz przeprowadza swoją linię przez ograniczenia.
4. **Wiedza nie jest bramką.** Nic nie blokuje postępu dlatego, że gracz nie
   przeczytał wpisu. Nauka jest skutkiem ubocznym dobrej gry.

---

## 2. Filary rozgrywki

1. **Prowadzisz populację, nie osobnika.** Decyzje dotyczą linii i kierunku jej
   adaptacji, nie pojedynczego zwierzęcia.
2. **Nic nie jest darmowe.** Każda cecha, strategia i zachowanie ma koszt
   i kompromis, widoczny przed decyzją.
3. **Świat się zmienia i odpowiada.** Klimat, tlen, pokarm, drapieżniki,
   konkurenci i katastrofy zmieniają wartość każdej cechy; przewaga z jednej ery
   bywa ciężarem w następnej.
4. **Decyzje w niepewności.** Prognozy to przedziały, część wyborów jest ryzykiem
   z losowanym wynikiem, a zapowiedzi katastrof są przybliżone.
5. **Każda partia to inna opowieść.** Kod świata, przesuwane wymierania, cele er,
   różne drogi do rozumu, rozgałęziony klad i epilog.
6. **Czytelna przyczyna i skutek.** Gracz zawsze może dowiedzieć się, *co się
   stało i dlaczego* — bez tego kompromisy byłyby zgadywaniem, a nie decyzjami.

---

## 3. Pętla rozgrywki (game loop)

```
┌────────────────────────────────────────────────────────────┐
│  1. FAZA ŚRODOWISKA   → losowanie/rozwój warunków epoki      │
│  2. FAZA ADAPTACJI    → gracz wydaje EP na cechy, ustawia    │
│                         strategię, dietę, zachowanie linii   │
│  3. FAZA SYMULACJI    → tura przeżycia (żerowanie, drapież-  │
│                         nictwo, rozmnażanie, mutacje)        │
│  4. FAZA WYNIKU       → naliczenie EP, zmiana liczebności,   │
│                         ewentualna specjacja lub wymarcie    │
│  5. FAZA RAPORTU      → co się stało i dlaczego; nowe wpisy  │
│                         Kodeksu; karty-echa wcześniejszych   │
│                         decyzji                              │
└────────────────────────────────────────────────────────────┘
                     ↺ powrót do fazy 1 (kolejna tura)
```

Jedna „tura” reprezentuje umowny odcinek czasu geologicznego (rzędu milionów lat).
Gra dzieli się na **ery** — każda to zestaw tur o wspólnych warunkach i wyzwaniach.

---

## 4. Mechaniki szczegółowe

Parametry liczbowe i aktualne wartości progów są w [`README.md`](./README.md)
i w danych gry (`js/data.js`); ta sekcja opisuje zamierzenie.

### 4.1. Populacja i statystyki gatunku
Każdą linię gracza opisują atrybuty:

| Atrybut | Znaczenie |
|---|---|
| Liczebność | Ile osobników liczy populacja (0 = wymarcie). |
| Odżywianie | Zdolność zdobywania pokarmu. |
| Obrona | Odporność na drapieżniki i zagrożenia. |
| Rozród | Tempo przyrostu populacji. |
| Mobilność | Zdolność migracji do nowych nisz (obniża jej koszt). |
| Metabolizm | Zapotrzebowanie energetyczne (wysokie = ryzyko przy głodzie). |
| Inteligencja | Postęp w kierunku celu końcowego (gatunek rozumny). |

Oprócz atrybutów linia ma **dietę** (roślinożerca / mięsożerca / wszystkożerca),
która wyznacza, z czego żyje i ile osobników wyżywi jej nisza (4.5a).

### 4.2. Cechy (traity) i punkty ewolucji
- EP zdobywa się za: przetrwanie tury, liczebność i jej wzrost, zajęcie kolejnych
  nisz, osiągnięcie celów ery.
- EP wydaje się na **cechy** pogrupowane w kategorie: *lokomocja, zmysły, pokarm,
  obrona, rozród, termoregulacja, układ nerwowy*.
- Cechy mają **warunki wstępne** (drzewo zależności) i bywają **wykluczające się**
  (np. filtrowanie i szczęki to dwa sposoby życia).
- Każda cecha ma **koszt** i **kompromis** — nic nie jest darmowe. Część
  kompromisów zależy od warunków (płetwy nie pomagają na lądzie, łuski utrudniają
  oddychanie przy niskim tlenie).

### 4.2a. Waluty linii i decyzje taktyczne
Oprócz EP (trwałe cechy) każda linia ma dwie własne waluty o krótszym horyzoncie:
- **⚡ Rezerwy energii** — nadwyżka energii odkładana na chude tury; deficyt najpierw
  je zużywa. Płaci się nimi za **migrację** i **zachowanie linii** (ukrywanie się,
  intensywne żerowanie; gromadzenie zapasów jest darmowe, ale kosztem potomstwa).
  Grają rolę budżetu energetycznego.
- **🧬 Zmienność genetyczna** — rośnie z czasem i liczebnością, maleje w wąskim
  gardle i katastrofie (dryf). Płaci się nią za **specjację** i **ukierunkowany
  dobór** (zużywa zmienność i część potomstwa); wysoka zmienność łagodzi katastrofy.
  Zmienność to paliwo doboru.
- **Strategia rozrodu r/K** — czysty kompromis między liczbą a przeżywalnością
  potomstwa.
- **Karty decyzji** — zdarzenia z wyborem (wyspa, nowy drapieżnik, zakwit, epidemia,
  nieznany pokarm, konkurent, wulkan, pokrewna populacja, wyścig godowy, padlina,
  symbioza, chudy sezon, niezwykły mutant), w tym zdarzenia pozytywne, o których
  też rozstrzyga gracz. Bez wyboru działa opcja domyślna, zwykle kosztowna. Część
  opcji to **ryzyko** z wynikiem losowanym w turze; szansa zależy od cech linii.
  Sukces bywa trwały, porażka też.
- **Echa decyzji** — skutki wcześniejszych wyborów wracają po 2–3 turach jako
  karty-echa dla tej samej linii.

### 4.3. Środowisko i presja selekcyjna
Parametry epoki, które modyfikują skuteczność cech:
- **Klimat** (zlodowacenia ↔ okresy ciepłe).
- **Poziom tlenu** w atmosferze.
- **Dostępność pokarmu** (rośliny, zdobycz, plankton).
- **Presja drapieżników** — osobno w każdej niszy; rośnie wraz z obroną linii
  (koewolucja, wyścig zbrojeń).
- **Konkurenci** — inne gatunki swojej ery wchodzą do nisz gracza, dzielą
  pojemność i bywają drapieżnikami; można ich wyprzeć.
- **Katastrofy** — wielkie wymierania i katastrofy regionalne jako rzadkie
  „resety” niszczące niedostosowane gatunki, różnie w różnych niszach.

Zasada: **cecha korzystna w jednej epoce może być obciążeniem w innej**.

### 4.4. Mutacje i losowość
- Co turę istnieje szansa na **losową mutację** (cecha lub jej wariant) —
  modeluje zmienność genetyczna.
- Mutacje bywają korzystne, neutralne lub szkodliwe; selekcja „odsiewa” szkodliwe.
- Losowość jest ograniczona i powtarzalna: świat wynika z **kodu świata**, a los
  linii z osobnego strumienia zapisanego w stanie, więc te same decyzje w tym samym
  świecie dają tę samą partię.

### 4.5. Specjacja, nisze i drzewo filogenetyczne
- Gdy część populacji ma się rozwijać odrębnie, gracz może wykonać **rozdzielenie
  gatunku** (specjacja) → nowa gałąź na drzewie życia. Można prowadzić kilka linii
  równolegle, dywersyfikując ryzyko.
- Każda nisza ma **pojemność** (nośność) zależną od pokarmu; linie w jednej niszy
  konkurują o nią (wzrost logistyczny, przegęszczenie). Nowa gałąź w wolnej niszy
  dostaje własne zasoby i chwilowe **uwolnienie od wrogów** (radiacja adaptacyjna).
- Wymierania mają różną siłę w różnych niszach, a gatunek obecny w kilku niszach
  traci w nich mniej (**szeroki zasięg**). Gałąź zdobywa cechy linii pokrewnej
  taniej (**ewolucja równoległa**), a koewolucja działa w każdej niszy osobno.
- Nisze mają tożsamość: woda (kultura akustyczna, najcięższe wymierania morskie),
  ląd (narzędzia, duża pojemność, wymaga kończyn i najlepiej jaja lądowego),
  powietrze (bezpieczne, uboższe, wymaga lotu), przybrzeże (etap przejściowy,
  mniejsza pojemność).
- Wizualizacja: interaktywne, rozgałęziające się **drzewo życia** ze wszystkimi
  liniami, żywymi i wymarłymi.

### 4.5a. Dieta i sieć troficzna
Dieta decyduje o pojemności niszy i kosztach: roślinożercy mieszczą się licznie,
ale tłoczą się z konkurentami; mięsożercy (wymagają szczęk) mają kaloryczny pokarm
i mniej wrogów, ale piramida troficzna mieści ich mniej; wszystkożercy są odporni
na załamanie jednego źródła, lecz w niczym nie są najlepsi. Zdobyczą mięsożercy są
roślinożercy w niszy: rywale **i własne linie gracza** — po specjacji można
utrzymać roślinożerną i mięsożerną gałąź, z kaskadą troficzną między nimi. Dieta
jest kompromisem, nie „ulepszeniem”.

### 4.6. Warunek zwycięstwa i porażki
- **Zwycięstwo:** próg inteligencji **i kultury** w żywotnym gatunku. Dwie drogi:
  kultura narzędziowa (ląd) i kultura akustyczna (otwarta woda) — rozum nie
  wymaga rąk. Liczy się żywotność całego kladu: linia rozumna i linie pokrewne
  razem.
- **Przetrwanie:** gatunek dotrwał do końca, ale bez rozumności.
- **Porażka:** wymarcie wszystkich linii gracza.
- **Niepewność:** prognoza podaje przedział, a katastrofy są zapowiadane do 2 tur
  wcześniej z przybliżoną siłą w każdej niszy.
- **Uczciwy sygnał:** gdy zwycięstwo staje się niemożliwe (hojne oszacowanie
  z góry), gra mówi to od razu i pozwala grać o przetrwanie, cofnąć turę albo
  zakończyć partię.
- **Regrywalność:** kod świata, przesuwane wymierania, katastrofy regionalne,
  losowe cele ery z nagrodą EP, wynik punktowy i osiągnięcia.

### 4.7. Prolog i epilog
- **Prolog (prekambr)** — trzy wybory z historii życia zamiast tur (energia,
  łączenie sił, tlen); każdy to kompromis i drobna zmiana stanu startowego.
- **Epilog (Antropocen)** — po zwycięstwie cztery decyzje rozumnego gatunku
  (energia, żywność, miasta, ochrona przyrody), z werdyktem zależnym od tego, jak
  potraktowałeś biosferę podczas gry.

---

## 5. Progresja przez ery geologiczne

| Era | Kluczowe wyzwania | Kamienie milowe cech |
|---|---|---|
| Prekambr (prolog) | Życie jednokomórkowe, tlen, pierwsza wielokomórkowość | Wybory startowe: energia, współpraca komórek, oddychanie |
| Paleozoik | Wyjście na ląd, pierwsze kręgowce | Szkielet, płetwy→kończyny, oddychanie powietrzem |
| Mezozoik | Dominacja gadów, wielkie ekosystemy | Jaja lądowe, termoregulacja, rozmiar |
| Kenozoik | Ssaki, klimat, rozwój mózgu | Stałocieplność, opieka nad potomstwem, duży mózg |
| Antropocen (epilog) | Konsekwencje rozumu | Energia, żywność, miasta, ochrona przyrody |

---

## 6. Świat i Kodeks

Świat gry ma własną encyklopedię — **Kodeks** — która pełni rolę podobną do
„encyklopedii” w grach strategicznych: jest pod ręką, ale nie trzeba jej czytać,
żeby grać.

- **Wpisy** (2–4 zdania) odblokowują się w toku gry i pojawiają przy zdarzeniach,
  które ich dotyczą. Często odwołują się do prawdziwych organizmów kopalnych.
- **Raport tury** jest komentarzem narratora: wyjaśnia przyczyny wyniku. Docelowo
  ma też odróżniać decyzję gracza od pecha i przywoływać wpisy tylko wtedy, gdy
  pomagają zrozumieć to, co się stało, a nie za każdym razem.
- **Zasady treści:** fakty poprawne (1.4), uproszczenia nazwane, ton rzeczowy.
  Żadnych pytań kontrolnych, punktów za „poprawne odpowiedzi” i zgadywania, czy
  gracz zrozumiał.
- **Poza zakresem (świadomie):** quizy, tryb nauczyciela, scenariusze lekcyjne,
  raporty i statystyki dla nauczyciela.

---

## 7. Interfejs i doświadczenie użytkownika (UX)

- **Główny ekran:** diorama środowiska aktywnej linii + panel linii i decyzji +
  panel adaptacji + oś czasu ery i pasek stanu (EP, populacja, era, cel).
- **Panel adaptacji:** cechy (odblokowane / dostępne / zablokowane), koszty
  i kompromisy widoczne przed zakupem, prognoza „co-jeśli”.
- **Raport tury:** „co się stało i dlaczego”, z rozbiciem EP.
- **Drzewo życia:** interaktywna wizualizacja linii rozwojowych.
- **Styl graficzny:** ilustracja przyrodnicza — rycina z dawnego atlasu, spokojna
  i poważna ([`docs/STYL.md`](./docs/STYL.md)). Zwierzę jest rysowane z kupionych
  cech, więc każda decyzja zostawia ślad na rycinie.
- **Dostępność:** duże kontrasty, obsługa klawiatury, paleta dla zaburzeń widzenia
  barw (znaczenie niesie też znak i kształt), `prefers-reduced-motion`, tryb
  jasny i ciemny, responsywność (komputer, tablet, telefon).
- **Język:** polski jako podstawowy, architektura gotowa na i18n.
- **Teksty w grze:** zwracamy się do gracza na „Ty”, piszemy konkretnie, bez
  wykrzykników dla ozdoby.

---

## 8. Tryby gry

1. **Kampania** — „Pełna ewolucja”: od kambru (opcjonalnie od prologu w prekambrze)
   przez trzy ery do progu rozumności, z epilogiem po zwycięstwie. ✔
2. **Scenariusze** — krótsze lub trudniejsze warianty z własnymi regułami:
   „Podbój lądu” (start na przybrzeżu, rozum tylko na lądzie) i „Epoki lodowcowe”
   (sprint przez kenozoik, tylko narzędzia). Kolejne scenariusze powinny mieć własne
   cele, nie tylko inne parametry. ✔ / rozwijane
3. **Kod świata** — ten sam kod to ten sam świat (warunki, katastrofy, karty, cele
   er). Podstawa pod wspólne wyzwania ze znajomymi; docelowo także regularne
   wyzwania dla wszystkich graczy. ✔ kod / planowane wyzwania
4. **Tryb swobodny (sandbox)** — bez sztywnego celu, do eksperymentów i zabawy
   z cofaniem tury; wynik i rekordy liczone tylko w partiach bez cofania.
   Planowany.
5. **Tryb wieloosobowy** — gatunki graczy konkurujące w jednym ekosystemie
   (najpierw hot-seat lub porównanie partii z tego samego kodu). Odległy plan.

---

## 9. Architektura techniczna

- **Platforma:** aplikacja przeglądarkowa bez instalacji; zbudowana gra to jeden plik
  `dist/index.html`, działający z dysku i offline. Pełne PWA — planowane.
- **Technologie:** silnik, dane i interfejs w JavaScript (`js/`), warstwa
  graficzna w TypeScript (`src/`: ikony SVG, portret zwierzęcia w Canvas 2D,
  diorama w PixiJS), budowa Vite do jednego pliku.
- **Logika gry:** oddzielony, testowalny silnik symulacji (czysta logika bez DOM,
  stan niemutowalny) — ułatwia testy, balansowanie botami i zmiany reguł.
- **Dane gry jako konfiguracja:** cechy, ery, zdarzenia, scenariusze i wpisy
  Kodeksu w `js/data.js`, łatwe do rozbudowy bez zmian w silniku.
- **Stan i zapisy:** `localStorage` (zapis partii, rekordy, osiągnięcia, ustawienia).
- **Wydajność:** symulacja operuje na populacjach, nie na osobnikach; grafika
  sama obniża jakość na słabszym sprzęcie.
- **Prywatność:** brak kont, telemetrii i zbierania danych; wszystko zostaje
  w przeglądarce gracza.

---

## 10. Stan prac i kierunki rozwoju

### 10.1. Stan obecny
Działa pełna kampania z prologiem i epilogiem, trzy ery (20 tur), trzy scenariusze,
trzy poziomy trudności, cztery nisze z pojemnością i migracją, specjacja z drzewem
życia, diety i sieć troficzna, konkurenci, katastrofy zapowiadane i regionalne,
karty decyzji i echa, kod świata, cele er, wynik i osiągnięcia, Kodeks, żywy portret
zwierzęcia i diorama środowiska. Szczegóły: [`README.md`](./README.md); pomiary
balansu botami: [`docs/OCENA-MECHANIK.md`](./docs/OCENA-MECHANIK.md).

### 10.2. Kierunki (kolejność orientacyjna)
1. **Uczciwy wynik.** Cofanie tury (dziś zawsze włączone) staje się opcją trybu
   swobodnego; wynik i rekordy liczone tylko bez cofania (inaczej można losować
   mutacje, karty i ryzyka w kółko).
2. **Głębia decyzji.** Rozgałęzianie klada powinno opłacać się wyraźniej; lot
   i powietrze, dobór ukierunkowany i część kart nadal mają mały wpływ na wynik
   (zob. OCENA-MECHANIK, 7.3). Kandydat do sprawdzenia: wyższy poziom trudności
   bez podglądu prognozy.
3. **Krzywa trudności.** Łatwy poziom nie powinien być formalnością, a różnice
   między poziomami — skokiem. Kalibracja oparta na grze ludzi, nie tylko botów.
4. **Scenariusze z własnymi celami** oraz regularne wyzwania na wspólnym kodzie świata.
5. **Tryb swobodny** (8.4).
6. **Interfejs.** Lewy panel i lista adaptacji są długie; potrzebne grupowanie
   i ukrywanie zablokowanych pozycji.
7. **Technika i dostępność.** PWA, pełne i18n silnika (dziś część komunikatów
   jest po polsku w silniku), CI z `npm test`, dostępność drzewa życia i modali
   (szczegóły: [`ULEPSZENIA.md`](./ULEPSZENIA.md)).

---

## 11. Ryzyka i kwestie do rozstrzygnięcia

- **Balans i głębia.** Kalibracja opiera się na botach; boty nie planują jak ludzie.
  Potrzebne są testy z prawdziwymi graczami i obserwacja, gdzie decyzje przestają
  być decyzjami (podpowiedź wskazuje optymalny ruch, opcja dominująca).
- **Przeładowanie interfejsu.** Trzy waluty, strategie, diety, zachowania, karty
  i 26 cech to dużo naraz; każdy nowy system musi uzasadnić swoje miejsce
  mierzalnym wpływem na wynik.
- **Wierność nauce a przyjemność gry.** Uproszczenia są dozwolone, ale nie mogą
  utrwalać fałszu, np. że ewolucja ma cel (1.4). Konsultacja merytoryczna
  (biolog, paleontolog) przy większych zmianach treści.
- **Powrót do szkolnego zakresu.** Nowy pomysł przechodzi test: „czy
  zrobilibyśmy to w grze, która nigdy nie trafi na lekcję?”. Jeśli nie — odpada.
- **Długość sesji.** Partia ma mieścić się w jednej sesji (dziś rzędu 20–30 minut),
  a zapis pozwala ją przerwać; nie ma narzuconego limitu wynikającego z lekcji.
- **Prawa autorskie.** Inspiracja oryginałem z 1997 r. bez kopiowania grafik,
  nazw własnych i chronionych treści; własna identyfikacja wizualna.
- **Ocena wiekowa i publikacja.** Gra zawiera naturalistyczne drapieżnictwo,
  głód i wymieranie, bez treści wrażliwych; oznaczenie wiekowe do ustalenia przy
  publikacji.

---

## 12. Słownik pojęć (wspólny dla gry i Kodeksu)

- **Dobór naturalny** — proces, w którym osobniki lepiej przystosowane do środowiska częściej przeżywają i wydają potomstwo.
- **Mutacja** — losowa zmiana materiału genetycznego, źródło zmienności.
- **Adaptacja** — cecha zwiększająca dostosowanie organizmu do środowiska.
- **Nisza ekologiczna** — zespół warunków i zasobów, w których gatunek funkcjonuje.
- **Specjacja** — powstanie nowego gatunku z istniejącej populacji.
- **Wymieranie masowe** — gwałtowny zanik wielu gatunków w krótkim (geologicznie) czasie.
- **Koewolucja** — wzajemne oddziaływanie ewolucyjne gatunków (np. drapieżnik–ofiara).
- **Klad** — linia rodowa z jej potomkami; w grze: cała rodzina linii gracza.

---

## 13. Cięcie z pierwotnym zamiarem

Pierwsza wersja założeń opisywała grę edukacyjną dla uczniów klas 6–8 i szkół
średnich, z trybem lekcyjnym dla nauczyciela. Ten zamiar ciążył na kolejnych
decyzjach (quizy, tryb nauczyciela, 45 minut na lekcję, czytelność na tablicy
multimedialnej), więc został przecięty, a nie „uzupełniony”.

| Było (pomoc dla uczniów) | Jest (gra dla młodzieży i dorosłych) |
|---|---|
| Cel: nauka doboru naturalnego przez zabawę | Cel: dobra gra strategiczna; nauka jest tłem i skutkiem ubocznym (1.4) |
| Odbiorcy: uczniowie, nauczyciele biologii, dorośli „zainteresowani popularnonauką” | Odbiorcy: młodzież i dorośli jako gracze (1.3) |
| Tryb nauczyciela (pauza, cofanie, omawianie na lekcji) | Zwykłe **cofanie tury**; docelowo opcja trybu swobodnego, bez wpływu na wynik (10.2) |
| Mini-quizy po erze z bonusem EP | **Porzucone** — gra nie egzaminuje |
| Scenariusze edukacyjne i lekcyjne | Scenariusze z własnymi regułami i celami (8) |
| Długość sesji dopasowana do lekcji (45 min) | Jedna sesja, bez narzuconego limitu (11) |
| Kod świata: „cała klasa w jednym świecie” | Kod świata: wspólne wyzwanie ze znajomymi |
| Eksport podsumowania „dla nauczyciela” | Podsumowanie partii do zachowania lub pokazania innym |
| Czytelność na tablicy multimedialnej, sprzęt szkolny, statystyki klasowe, prywatność uczniów | Usunięte jako wymagania; zostaje zasada „brak kont i telemetrii” (9) |
| Warstwa edukacyjna jako filar rozgrywki | Kodeks jako dobrowolna encyklopedia świata (6) |
| Ocena „wartości edukacyjnej” w recenzjach gry | Nie jest kryterium |
| Ton pomocniczy, szkolny | Ton rzeczowy, dorosły (1.3, 7) |

**Reguła rozstrzygania** nowych pomysłów, w tej kolejności:
1. Czy poprawia decyzje, napięcie lub opowieść w grze?
2. Czy jest spójne ze światem gry i jego zasadami?
3. Czy jest poprawne merytorycznie (1.4)?

**Dokumenty historyczne.** [`ULEPSZENIA.md`](./ULEPSZENIA.md), `RECENZJA.md`,
`docs/RECENZJA.md` i `docs/RECENZJA-MAGAZYN.md` powstały przy starym zamiarze.
Zachowujemy je jako zapis stanu i pomiarów; ich fragmenty o walorach
edukacyjnych, quizach i trybie nauczyciela **nie obowiązują**.

---

*Dokument roboczy — założenia otwarte na iterację po testach grywalności.*
