# Ewolucja 🧬

Edukacyjna gra przeglądarkowa o **doborze naturalnym** i historii życia,
inspirowana *Evolution: The Game of Intelligent Life* (1997).

Poprowadź linie rozwojowe zwierząt przez **paleozoik, mezozoik i kenozoik** — od
prostego organizmu w morzu aż do gatunku, który używa narzędzi. Wydawaj **punkty
ewolucji** na cechy, zajmuj nisze, przetrwaj wymierania masowe i ucz się, jak działa
ewolucja.

> Gra edukacyjna. Model jest świadomie uproszczony — służy zrozumieniu
> mechanizmów, nie odwzorowaniu konkretnych gatunków. Pełne założenia
> projektowe: [`ZALOZENIA.md`](./ZALOZENIA.md).

## Jak uruchomić

Nie wymaga instalacji ani budowania. Wystarczy otworzyć plik **`index.html`**
w przeglądarce (Chrome, Firefox, Edge, Safari):

- kliknij dwukrotnie `index.html`, **albo**
- uruchom lokalny serwer, np.: `python3 -m http.server` i wejdź na `http://localhost:8000`.

Gra działa w pełni po stronie przeglądarki i zapisuje postęp lokalnie
(`localStorage`). Działa też offline — bez internetu nagłówki używają kroju
zastępczego (Georgia) zamiast Fraunces z Google Fonts.

## Jak grać

1. Nazwij gatunek i wybierz scenariusz. W „Opcjach dla nauczyciela” możesz podać
   **ziarno świata** — ta sama liczba daje całej klasie ten sam świat.
2. **Scena ekosystemu** pokazuje cztery nisze: niebo, morze, przybrzeże i ląd.
   Liście to pokarm, kły to drapieżcy, ciemne sylwetki to **rywale**, którzy
   zjadają Twój pokarm. Kliknij strefę, by przenieść tam aktywną linię.
3. W panelu **Adaptacje** wydawaj EP na cechy. Najedź na cechę, a prognoza,
   wykres radarowy i portret pokażą jej wpływ, zanim ją kupisz. Wiele cech
   **działa inaczej zależnie od niszy i klimatu** (np. płetwy na lądzie przeszkadzają).
4. Kliknij **„Przeżyj turę”**. Raport wyjaśni, *co się stało i dlaczego*:
   narodziny, straty (drapieżnictwo, głód, przeludnienie, katastrofa, wąskie gardło)
   i skąd przyszły punkty.
5. **Cel:** jedna linia musi osiągnąć próg inteligencji **i** wykształcić
   *używanie narzędzi* (dostępne w kenozoiku).

Zakończenia: **zwycięstwo**, **przetrwanie** (bez rozumności) lub **wymarcie**,
a na koniec **wynik punktowy** z rozbiciem.

## Mechaniki

- **Pojemność środowiska** — każda nisza wyżywi ograniczoną liczbę osobników;
  własne linie w tej samej niszy konkurują o pokarm.
- **Minimalna żywotna populacja** — linia poniżej 12 osobników wymiera (wąskie gardło).
- **Kompromisy zależne od sytuacji** — warunkowe efekty cech (nisza, klimat,
  niedobór pokarmu) widoczne na kartach; „(teraz)” oznacza, że działają w tej turze.
- **Odrzucanie cech** — niepotrzebną cechę można porzucić (narząd szczątkowy).
- **Losowy świat** — wartości tur różnią się między grami, pojawiają się drobne
  katastrofy lokalne. Wymierania historyczne zostają na swoich miejscach, ale
  mają losową siłę i zasięg. Turę wcześniej widać **zwiastun**.
- **Rywale i koewolucja per nisza** — dominujące grupy każdej ery konkurują
  o pokarm i słabną po katastrofach. Drapieżniki „doganiają” najlepiej bronioną
  linię w danej niszy.
- **Mutacje do wyboru** — populacja co jakiś czas oferuje trzy mutacje:
  korzystną, z haczykiem, ryzykowną lub neutralną. Można też odrzucić wszystkie.
- **Ekonomia EP** — punkty za przetrwanie, wzrost, kolonizację nowej niszy,
  przetrwanie katastrofy i inteligencję (liczoną raz). Kolejne specjacje kosztują więcej.
- **Quizy po erze** (+EP), **osiągnięcia/wyzwania** i **wynik punktowy**.

## Warstwa graficzna

- Własny zestaw ikon SVG (spójny na wszystkich systemach, bez emoji w interfejsie).
- **Portret gatunku** składany z cech: płetwy → kończyny, łuski, pancerz, oczy,
  futro/pióra, skrzydła, głowa rosnąca z mózgiem.
- **Scena ekosystemu** zależna od ery i klimatu (śnieg, słońce, wulkan, paprocie,
  sawanna); katastrofa zaznacza zagrożoną strefę.
- **Wykresy**: populacja wszystkich linii (pasy er, katastrofy, prognoza),
  radar statystyk z podglądem cechy, drzewo życia jako diagram wrzecionowy,
  mapa zależności cech.
- Raport z paskiem przepływu populacji, animowanym licznikiem, ilustracją katastrofy;
  pełnoekranowa **plansza nowej ery**.
- Palety kolorów zależne od ery, szeryfowe nagłówki, tryb jasny i ciemny.
- **Tryb dla daltonistów** (bezpieczne kolory i symbole ▲▼), **tryb tablicy**
  (większe litery), pasek akcji na telefonie, `prefers-reduced-motion`.

## Struktura projektu

```
index.html          — struktura strony i ekranów
css/styles.css      — warstwa prezentacji (palety er, tryby, responsywność, dostępność)
js/i18n.js          — stringi interfejsu (warstwa i18n)
js/data.js          — dane gry: cechy i ich warunki, ery, rywale, quizy, osiągnięcia, karty wiedzy
js/engine.js        — silnik symulacji: czysta, testowalna logika (bez DOM)
js/art.js           — grafika SVG: ikony, portret, scena, wykresy, drzewo, mapa cech
js/ui.js            — kontroler interfejsu: render, zdarzenia, zapis lokalny
test/engine.test.js — testy silnika
```

Logika gry jest **oddzielona od UI** (ZALOZENIA, sekcja 9) i testowalna niezależnie,
a dane są konfiguracją, którą łatwo rozbudować bez zmian w kodzie.

## Testy

```bash
node test/engine.test.js
```

Testy sprawdzają m.in.: kupno i odrzucanie cech, determinizm świata przy danym
ziarnie, zwiastuny, wąskie gardło, pojemność środowiska, warunkowe kompromisy,
rywali i koewolucję per nisza, oferty mutacji, quizy i wynik. Sprawdzają też,
że bierna gra kończy się wymarciem, a przemyślana strategia wygrywa.

## Status

Działający **MVP+**: trzy ery, losowy świat, specjacja z drzewem życia, nisze
z rywalami, katastrofy ze zwiastunami, quizy, osiągnięcia, samouczek i tryb
nauczyciela. Dalsze możliwe kroki: tryb offline (PWA), tryb wieloosobowy,
kolejne języki.
