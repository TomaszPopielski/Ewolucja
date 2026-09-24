# Ewolucja 2.0 — przeprojektowanie rozgrywki

Dokument opisuje, dlaczego rozgrywka została przebudowana, jakie warianty
rozważono i jak działa wybrana koncepcja.

## 1. Diagnoza wersji 1.x

| Problem | Skutek dla gracza |
|---|---|
| Środowisko każdej tury było **stałe** (te same liczby w każdej grze). | Po jednej partii zna się całą grę — brak regrywalności. |
| Cechy się **kupowało** za EP; wygrana = suma cech ⭐ ≥ próg. | Dominująca strategia („kup ścieżkę ⭐”), zero napięcia. |
| Zakup cechy działał natychmiast i w 100%. | Brak poczucia *doboru naturalnego* — gra uczyła, że organizm „wybiera” cechy, czyli utrwalała błąd „ewolucja ma cel” (ZALOZENIA 11). |
| Prognoza pokazywała dokładny wynik. | Nie trzeba było myśleć ani planować naprzód. |
| Linie po specjacji nie konkurowały ze sobą ani z nikim innym. | Nisze były „bonusem”, a nie decyzją ekologiczną. |
| Brak wyniku punktowego i wspólnego ziarna losowania. | Brak motywacji do kolejnej partii, nie da się porównać wyników w klasie. |

## 2. Rozważane warianty

**A. Draft mutacji + dobór częstości alleli (roguelite).**
Co turę w populacji pojawiają się 3 losowe mutacje; gracz wskazuje jedną,
a o tym, czy się **rozprzestrzeni**, decyduje środowisko (logistyczna zmiana
częstości). Losowe środowisko z ziarna, zapowiedź 2 tur naprzód.
*+* najwierniejszy naukowo (zmienność → dziedziczenie → selekcja), wysoka regrywalność,
decyzje z ryzykiem; *−* bardziej pośrednie sterowanie.

**B. Mapa ekosystemu (4X-lite).**
Heksagonalna mapa biomów, linie rozprzestrzeniają się po polach, walczą o teren.
*+* efektowne; *−* duży koszt implementacji i UI, ryzyko, że gra stanie się
„strategią wojenną”, a nie lekcją o doborze.

**C. Puzzle dopasowania cech do środowiska.**
Środowisko ma tagi (zimno, susza, drapieżniki), cechy mają tagi; wynik = dopasowanie.
*+* bardzo czytelne; *−* deterministyczne, szybko się nudzi, znów „kupowanie odpowiedzi”.

**D. Symulacja agentowa w czasie rzeczywistym.**
Widoczne pojedyncze osobniki na ekranie. *+* widowiskowe; *−* mało decyzji,
ciężkie dla sprzętu szkolnego (ZALOZENIA 9 — wydajność), trudne do omówienia na lekcji.

**Wybór: A jako rdzeń + elementy C i B.** Z C bierzemy *warunkowe efekty cech*
(cecha pomaga w jednym środowisku, szkodzi w innym), z B — *konkurencję w niszach*
i pojemność środowiska, bez kosztownej mapy.

## 3. Nowa pętla tury

```
1. ZAPOWIEDŹ     — widać warunki następnej tury i zapowiedź kolejnej (katastrofy, zdarzenia)
2. ZMIENNOŚĆ     — każda linia dostaje 3 losowe mutacje (draft); wybierasz jedną za darmo,
                   kolejne / ponowne losowanie kosztują Zmienność (🧬 ZG)
3. DECYZJE       — migracja do innej niszy, specjacja, wybór mutacji
4. DOBÓR         — symulacja: pokarm (z konkurencją), drapieżniki, pojemność środowiska,
                   katastrofy; częstość każdej cechy rośnie lub maleje wg tego, czy
                   zwiększa przeżywalność W TYCH warunkach (+ dryf genetyczny)
5. WYNIK         — raport „co się stało i dlaczego”, zmiany częstości, cele ery, quiz
```

## 4. Kluczowe mechaniki

- **Częstość cechy (0–100%).** Nowa mutacja startuje od ~30%. Co turę zmienia się
  zgodnie z modelem logistycznym `f' = f + k·s·f·(1−f) + dryf`, gdzie `s` (współczynnik
  selekcji) to różnica tempa wzrostu populacji z cechą i bez niej. Efekty cechy działają
  proporcjonalnie do częstości. Przy ≥95% cecha jest **utrwalona**, przy <5% — **zanika**.
- **Dryf genetyczny** — losowe wahania częstości, silniejsze w małych populacjach.
- **Warunkowe efekty** — np. płetwy: +mobilność w wodzie, −mobilność na lądzie;
  izolacja: tańszy metabolizm w zimnie, przegrzanie w cieple. Ta sama cecha bywa
  zaletą i obciążeniem — dobór to pokazuje w liczbach.
- **Utrata cechy** — w drafcie może się pojawić mutacja wyłączająca utrwaloną, ale
  obecnie szkodliwą cechę (np. oczy ryb jaskiniowych, płetwy na lądzie).
- **Konkurencja i pojemność środowiska** — każda nisza ma rodzimych konkurentów
  (siła zależna od ery) i pojemność `K` zależną od pokarmu. Twoje linie w tej samej
  niszy też konkurują ze sobą → opłaca się rozchodzić do różnych nisz.
- **Radiacja adaptacyjna** — wymieranie masowe osłabia konkurentów w niszy; ocalali
  mają przez kilka tur „pusty świat” (jak ssaki po K–Pg).
- **Odporność na katastrofy** — katastrofy mają rodzaj (zimno, beztlenowość, impakt),
  a cechy — odporności (np. miniaturyzacja, życie w norach przy impakcie; gigantyzm
  pogarsza szanse). Katastrofa sama silnie selekcjonuje te cechy.
- **Inteligencja jako bufor poznawczy** — mózg jest drogi energetycznie, ale łagodzi
  głód i katastrofy oraz zwiększa efektywność żerowania. Rozprzestrzenia się tylko tam,
  gdzie ta przewaga się opłaca (hipoteza buforu poznawczego).
- **Zmienność genetyczna (🧬 ZG)** zastępuje EP. Duże populacje i wiele nisz dają więcej
  zmienności. Wydaje się ją na: dodatkową mutację, ponowne losowanie, migrację, specjację.
- **Cele ery** (np. „wyprowadź linię na ląd”) i **quiz po erze** — nagroda w ZG.
- **Ziarno rozgrywki** — każdy świat jest losowy, ale odtwarzalny: klasa może grać
  na tym samym kodzie i porównać **wynik punktowy**. Jest też **wyzwanie dnia**.

## 5. Zakończenia

- **Zwycięstwo** — inteligencja którejś linii (z uwzględnieniem częstości cech) ≥ cel.
- **Przetrwanie** — dotrwanie do końca kenozoiku bez rozumności.
- **Wymarcie** — zniknięcie wszystkich linii.

Każde zakończenie daje **wynik punktowy** (przetrwane tury, szczyt populacji, zajęte
nisze, żywe linie, inteligencja, cele, quizy × mnożnik trudności).

## 6. Uczciwość dydaktyczna

W rzeczywistości nikt nie „wybiera” mutacji. Wybór z draftu jest uproszczeniem
oznaczonym w grze (karta „Ewolucja nie ma celu”): gracz typuje, który wariant
środowisko mogłoby faworyzować, a **o rozprzestrzenieniu decyduje symulacja doboru** —
źle dobrana mutacja zaniknie mimo wyboru.

## 7. Balans (boty, 100 losowych światów na scenariusz)

`node test/balance.js 100` — odsetek zwycięstw:

| Scenariusz | świadoma strategia | tylko „za doborem” | losowe decyzje |
|---|---|---|---|
| Podbój lądu (łatwy) | 77% | 26% | 2% |
| Pełna ewolucja (normalny) | 68% | 12% | 0% |
| Twardy świat (trudny) | 50% | 0% | 0% (25% wymarć) |
| Epoki lodowcowe (trudny sprint) | 54% | 3% | 0% |

Wniosek: wygrana wymaga świadomego planu (nisze, stałocieplność, obfity pokarm dla
mózgu, przygotowanie na katastrofy), a nie szczęścia; jednocześnie nawet dobra
strategia nie wygrywa w każdym świecie, co zachęca do kolejnych partii.
