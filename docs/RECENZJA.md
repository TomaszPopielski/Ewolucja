# Ewolucja — niezależna recenzja stanu gry (27.09.2026)

**Oceniany stan:** gałąź domyślna `claude/evolution-game-assumptions-ep2rfr`,
commit `3ab237a` (wersja 0.2.0), oraz wszystkie 12 niescalonych gałęzi
i otwarte PR-y (#1, #3).

**Jak oceniałem:**

- przeczytałem silnik (`js/engine.js`), dane (`js/data.js`) i warstwę graficzną;
- uruchomiłem `npm test` i `npm run build` i sprawdziłem, że `dist/index.html`
  buduje się bajt w bajt tak samo jak plik w repozytorium;
- zrobiłem zrzuty ekranu (`npm run shots`);
- przeszedłem pełną partię **przez interfejs** w Chromium (Playwright), na
  gałęzi głównej i na PR #3;
- przeprowadziłem symulację Monte Carlo: boty grają bezpośrednio na silniku,
  300–400 partii na każdą strategię i poziom trudności. Skrypt jest w
  [`scripts/boty-balans.js`](../scripts/boty-balans.js) i można go uruchomić
  na dowolnej gałęzi: `node scripts/boty-balans.js <katalog> 400`.

> W repozytorium istnieje już wcześniejsza recenzja (PR #3,
> `game-review-assessment-l13327`). Tę napisałem niezależnie. Jej główne
> tezy się potwierdziły, ale znalazłem też **przyczynę źródłową**, której
> tamta recenzja nie wskazuje (sekcja 2.2), a sam PR #3 oceniam jako jedną
> z niescalonych wersji (sekcja 4).

---

## Werdykt

| | Ocena |
|---|---|
| Oprawa, styl, warsztat techniczny | **8/10** |
| Rozgrywka (stan na gałęzi głównej) | **3,5/10** |
| Wartość edukacyjna | **6/10** |
| **Całość** | **5/10** |

Ewolucja wygląda i działa jak dopracowany produkt, ale pod spodem gra jest
**rozwiązana**. Przegrać się praktycznie nie da, a wygrywa się jednym
przepisem. Najbardziej wymowny wynik testów: w 97% zwycięskich partii
strategią „mózg najpierw” „gatunek rozumny” liczy w chwili zwycięstwa
**mniej niż 10 osobników**, a mediana to **jeden osobnik**. Gra gratuluje
narodzin inteligencji gatunkowi, który w praktyce wymarł.

---

## 1. Stan techniczny: dobry

| Obszar | Wynik |
|---|---|
| `npm test` | ✅ 35 testów silnika i 35 testów ryciny zaliczone |
| `npm run build` | ✅ typy OK; `dist/index.html` ma 930 KB (399 KB gzip) i jest identyczny z plikiem w repozytorium |
| Pełna partia w Chromium | ✅ 20 tur, raporty, ekran końcowy, **0 błędów w konsoli** |
| Tryb offline (`file://`) | ✅ działa |
| Architektura | ✅ czysty silnik bez DOM, niemutowalny stan (stąd cofanie), dane oddzielone od logiki |
| Dług | ⚠️ dwie epoki kodu: `js/*.js` (ES5, `ui.js` ma 1058 linii) i `src/*.ts`; README opisuje grę sprzed rozbudowy („przez erę paleozoiku”, „8 tur ery”) i ma dwie sekcje „Struktura projektu” |

Pod względem inżynierskim projekt jest w lepszym stanie niż większość gier
hobbystycznych tej wielkości.

---

## 2. Rozgrywka: główny problem

### 2.1 Wyniki symulacji (gałąź główna, 400 partii na wiersz)

| Poziom | Nic nie rób | Mózg najpierw | Mózg + ląd | Tylko obrona | Losowe zakupy | Mózg + specjacja |
|---|---|---|---|---|---|---|
| Łatwy | 0% wygr. / **0% wymarć** | **100%** (tura 9,3 z 20) | 100% | 0% / 0% wym. | 48% | 100% |
| Normalny | 0% / **0%** | **99%** (tura 14,3) | 100% | 0% / 0% | 8% | 88% |
| Trudny | 0% / **0%** | 83% (17% wymarć) | **99%** | 0% / 0% | 0% | 27% |
| Scenariusz „Epoki lodowcowe” | — | **100%** | — | — | — | — |

Wnioski:

- **Jedna strategia wygrywa zawsze.** Kupowanie cech z gwiazdką ⭐ w
  kolejności wygrywa na normalnym w 99–100% partii. Scenariusz oznaczony
  jako „trudny sprint końcowy” wygrywa w 100%.
- **Nie da się przegrać, grając biernie.** Gracz, który przez 20 tur nic nie
  kupuje, **nigdy** nie wymiera, na żadnym poziomie trudności.
- **Kenozoik jest zbędny.** Zwycięstwo przychodzi w turze 9–14 z 20, czyli
  zwykle jeszcze w mezozoiku. Kamienie milowe trzeciej ery (ręka chwytna,
  narzędzia) nie są potrzebne.
- **Mutacja może dać zwycięstwo.** Inteligencja jest w puli losowych
  mutacji (+1), więc brakujący punkt do celu może przyjść za darmo.

### 2.2 Przyczyna, której nie widać w raportach: nieśmiertelność z zaokrągleń

W `js/engine.js:331-333` straty liczone są jako
`Math.round(populacja × współczynnik)`. Przy małej populacji zaokrąglenie
daje zero. Przykład z symulacji: w jurze drapieżniki zabierają 22%
populacji na turę, ale przy 2 osobnikach to `Math.round(0,44) = 0`.

Przebieg biernej partii (populacja po każdej turze):

```
141 154 87 75 57 48 53 18 17 17 16 13 13 5 6 5 4 3 3 3
```

Populacja topnieje, ale **nie może spaść do zera**, bo od kilku osobników
wszystkie straty zaokrąglają się do 0. To tłumaczy naraz trzy objawy:

1. bierny gracz nie wymiera (mediana populacji na końcu partii: 5 osobników);
2. „mózg najpierw” wygrywa mimo głodu wywołanego metabolizmem mózgu, bo linia
   spada do 1–5 osobników i tam „zamarza”;
3. zwycięstwo z jednym osobnikiem (zrzut ekranu końcowego: wykres populacji
   spada ze 163 do 1, a gra ogłasza „Narodziny inteligencji!”).

Warunek zwycięstwa (`evaluateStatus`) nie sprawdza żywotności populacji,
wystarczy `inteligencja ≥ cel`.

**Ten błąd występuje też na wszystkich niescalonych gałęziach opartych na
obecnym silniku, w tym w PR #3** (tam bierny gracz kończy z medianą 10
osobników i nadal nigdy nie wymiera). Poprawka jest mała: losowe
zaokrąglanie (lub rozkład dwumianowy dla małych populacji) plus minimalna
żywotna populacja, np. poniżej 10 osobników linia ma realną szansę
wymarcia, a zwycięstwo wymaga co najmniej ~50 osobników.

### 2.3 Inne problemy z mechaniką

- **Świat jest zapisany na sztywno.** Wszystkie 20 tur (tlen, pokarm,
  drapieżniki, katastrofy) są stałe w `data.js`. Po jednej partii gracz zna
  przyszłość. Losowe są tylko mutacje i dwa pozytywne zdarzenia.
- **Inteligencja nie działa w symulacji.** Nie występuje w
  `computeDynamics`. To pasek postępu i źródło EP, a nie adaptacja z
  kompromisem.
- **Stała premia +12 EP za turę** dominuje nad premiami za wzrost (zwykle
  +1–3), więc dbanie o populację prawie się nie opłaca.
- **Nisza nie ma znaczenia dla celu.** Linia może mieć kończyny, rękę
  chwytną i narzędzia, a nadal żyć w wodzie. Widać to na ekranie
  zwycięstwa: „rozumne” zwierzę pływa w akwarium.
- **Kompromisy z opisów nie działają.** „Linia boczna działa tylko w
  wodzie” czy „płetwy bezużyteczne na lądzie” to tylko tekst, silnik tego
  nie modeluje.
- **Specjacja mnoży EP.** Każda linia osobno dostaje EP za inteligencję i
  niszę.

---

## 3. Oprawa i interfejs

**Mocne strony:**

- Rzadko spotykany, spójny styl ryciny przyrodniczej: szeryfowa
  typografia, papierowa paleta, skala „1 cm / 20 cm” pod zwierzęciem.
- Zwierzę składane z cech, a przed zakupem można podejrzeć, jak się
  zmieni. Galeria form od prazwierzęcia po czworonoga lądowego jest
  przekonująca.
- Diorama ery i niszy oraz animacja tury (ataki, głód, meteoryt) łączą
  liczby z obrazem.
- Ekran końcowy z „drogą ewolucji” w miniaturach i wykresem populacji,
  tryb jasny i ciemny, wersja mobilna, ustawienia jakości,
  `prefers-reduced-motion`.

**Słabe strony:**

- **Paski statystyk są puste** (`css/styles.css`, `.stat-fill` to `span` bez
  `display:block`). Najważniejszy panel gatunku pokazuje same liczby.
  Poprawka to jedna linia (jest w PR #3).
- **Latające formy nie wyglądają na latające.** Na rycinie „Ptak” i
  „Pterozaur” to jaszczurka zawieszona w powietrzu bez wyraźnych skrzydeł.
  To jedyne miejsce, gdzie rycina nie oddaje cechy.
- **Panel adaptacji to bardzo długa lista** 24 kart, także zablokowanych.
  Do „Układu nerwowego”, gdzie toczy się właściwa gra, trzeba przewijać.
- **Raport tury jest suchą tabelką.** Nie rozróżnia, co wynikło z decyzji
  gracza, a co z losu. Brakuje też ostrzeżenia typu „populacja krytycznie
  mała”.
- **Ekran zwycięstwa nie reaguje na stan populacji** (patrz 2.2), co
  podważa wiarygodność całej oprawy.

---

## 4. Niescalone wersje: co naprawdę poprawiłoby grę

Każdą gałąź sprawdziłem tymi samymi botami (normalny poziom, 300 partii),
a gałęzie z innym API także ich własnymi skryptami balansu.

| Gałąź / PR | Co wnosi | Testy | Mój pomiar (normalny) | Ocena |
|---|---|---|---|---|
| **PR #3 `game-review-assessment-l13327`** (zawiera silnik z `game-improvements-fixes-xt7ru9`) | Naprawione paski statystyk, 7 błędów P1 (m.in. nieosiągalna karta „Podbój lądu”, prognoza pomijająca efekty cech, zła nisza w „Epokach lodowcowych”), migracja kosztuje EP, zwycięstwo wymaga „Używania narzędzi”, zmienne warunki tur, selektywne katastrofy, boty balansu | ✅ 98 | Mózg najpierw: **40%** wygr., 60% wymarć; bot korzystający z prognozy: **51%**; bierny: 0% wygr., **0% wymarć** | ⭐ **Scalić.** Jedyna gotowa, przetestowana poprawa na obecnej grafice (zbudowany `dist` jest aktualny). Zastrzeżenia poniżej |
| `game-improvements-fixes-xt7ru9` | Źródło silnika dla PR #3 (stara grafika) | ✅ 98 | jak wyżej | Wchłonięta przez PR #3, do zamknięcia po scaleniu |
| `gifted-knuth-mxmrxt` | Przebudowa 2.0: losowy draft mutacji zamiast sklepu, częstość cechy w populacji rośnie przez dobór i dryf, świat z ziarna, konkurenci, pojemność nisz, quiz, wynik punktowy | ✅ 80 | Własne boty: mądry **65%**, zachłanny 4%, losowy 0% | **Najlepsza krzywa umiejętności** i najwierniejsza biologia. Kandydat na „wersję 2”, ale wymaga przeniesienia całego UI na warstwę TS |
| `gameplay-modification-proposal-cevyh6` | Koniec farmienia EP przez specjację, refugium, synergie cech, ziarno RNG, osiągnięcia, quizy, szybka tura | ✅ 50 | Mózg najpierw **100%**, wygrana już w turze ~12 | Silnik **ułatwia** grę. Warto wziąć pojedyncze elementy UI (ziarno, osiągnięcia, quiz) |
| `game-assumptions-mechanics-bzqqmp` | Nazwany rywal, zdarzenia z wyborem przed turą, markery na wykresie | ✅ 47 | Bez zmian względem głównej (99%) | Zdarzenia z wyborem warto przenieść; balansu nie zmienia |
| `beautiful-franklin-dd90q2` | Pojemność środowiska, wąskie gardło, rywale NPC, mutacje do wyboru, quizy, osiągnięcia + własna grafika | ✅ 66 | Moje proste boty wymierają w 98–100% partii | Bogate mechaniki, ale surowe i z grafiką gorszą od obecnej. Źródło pomysłów, nie kandydat do scalenia |
| `game-mechanics-redesign-8u258x` | Pula genowa, zmienność genetyczna jako zasób, dobór płciowy, NPC; **usuwa** Kodeks, tryb nauczyciela i warstwę edukacyjną | ✅ 66 | Inne API, poza porównaniem | Zmienia tożsamość gry (z edukacyjnej na rozrywkową). Decyzja produktowa, nie poprawka |
| `game-mature-assumptions-i2kufe` | Same założenia (strategia 16+) | — | — | Dokument |
| PR #1 `graphics-layer-improvement-qiun70`, `project-graphics-upgrade-6bduz6`, `playable-version-0d0wbe` | Wcześniejsze podejścia do grafiki i buildu | — | — | **Zastąpione** przez etapy 0–6. PR #1 i gałęzie do zamknięcia |
| `graphics-level-options-7zbbjd` | Etapy 5–6 grafiki | — | — | Już scalona (PR #2) |

### Uczciwe zastrzeżenia do PR #3

PR #3 wyraźnie poprawia grę, ale nie jest końcem pracy:

1. **Bierny gracz nadal nie może przegrać** (0% wymarć, patrz 2.2). Po
   scaleniu gra karze działanie, a nie bezczynność: „mózg najpierw” wymiera
   w 60% partii, „nic nie rób” w 0%. Dla ucznia to zły sygnał.
2. **Słaba krzywa umiejętności.** Bot, który czyta prognozę, wygrywa 51%,
   a bot ze stałą listą zakupów 46%. Myślenie daje tylko ~5 punktów
   procentowych przewagi.
3. **Skrajne poziomy trudności:** łatwy 98–100% (bez wyzwania), trudny
   4–18%.
4. **Zwycięstwo z małą populacją** jest rzadsze (mediana 26 osobników), ale
   nadal możliwe przy kilku osobnikach.

---

## 5. Rekomendacje (w kolejności)

1. **Scalić PR #3.** Paski statystyk, błędy P1, dłuższa gra aż do
   kenozoiku, testy balansu.
2. **Naprawić nieśmiertelność z zaokrągleń** (mała zmiana w
   `simulateLineage` i `forecast`): losowe zaokrąglanie strat, minimalna
   żywotna populacja z ryzykiem wymarcia i ostrzeżenie w prognozie.
3. **Zwycięstwo tylko dla żywotnego gatunku**, np. populacja ≥ 50 i nisza
   lądowa dla „Używania narzędzi”. Dodać test „bierny gracz wymiera w
   ≥ 50% partii na normalnym”.
4. **Dopiero potem kalibracja poziomów trudności** z celem: bot z prognozą
   wyraźnie lepszy od stałego planu (np. 60% vs 30% na normalnym).
5. **Decyzja kierunkowa:** zostać przy obecnym modelu „sklepu cech”, czy
   przejść na model doboru częstości cech z `gifted-knuth-mxmrxt`, który
   ma dziś najlepszą krzywą umiejętności. Nie warto przenosić trzech
   przebudów naraz.
6. **Porządki:** zamknąć PR #1 i zastąpione gałęzie, zaktualizować README.

---

## 6. Podsumowanie

**Co się udało:** oprawa na poziomie, jakiego rzadko oczekuje się od gry
edukacyjnej; czysta architektura, testy, działanie offline z jednego
pliku, rzetelne treści w Kodeksie z odniesieniami do prawdziwych
skamieniałości. Prognoza tury i jawne kompromisy dobrze uczą, *dlaczego*
populacja rośnie lub maleje.

**Co nie działa:** to wciąż bardziej interaktywna ilustracja niż gra.
Wygrywa jeden przepis, bierny gracz jest nieśmiertelny, trzecia era jest
zbędna, a zwycięstwo potrafi przypaść jednemu osobnikowi. Ostatnie etapy
pracy poszły w grafikę, a gotowe poprawki rozgrywki leżały na gałęziach.
Pod względem dydaktycznym jest też ryzyko: gra uczy, że wystarczy
„kupować mózg”, a populacja nie ma znaczenia, co przeczy lekcji o doborze
naturalnym.

**Dla kogo dziś:** na jedną lekcję biologii jako pomoc wizualna sprawdzi
się dobrze. Na drugą partię jeszcze nie.

**Potencjał:** po scaleniu PR #3 i naprawie z punktu 2 gra realnie
zasługiwałaby na **6,5–7/10** bez zmiany charakteru. Z modelem doboru z
`gifted-knuth` i obecną oprawą mogłaby sięgnąć 8/10.
