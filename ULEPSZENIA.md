# Ewolucja — lista ulepszeń i poprawek

Przegląd stanu gry (commit `0721bef`: scenariusze, trudność, cztery nisze,
koewolucja, rozbicie EP, eksport) względem założeń z [`ZALOZENIA.md`](./ZALOZENIA.md).

> **Status:** etapy 1 (poprawki P1) i 2 (balans) zrealizowane — punkty oznaczone ✅
> mają testy w `test/engine.test.js` (balans: `test/bots.js`). Kolejne etapy
> (edukacja, dostępność i technika, treści) — do zrobienia.
>
> **Balans po etapie 2** (100 gier z ziarnami 1–100, % zwycięstw):
>
> | Gracz | Łatwy | Normalny | Trudny | Epoki lodowcowe |
> |---|---|---|---|---|
> | stały plan „kup wszystko” | 99 | 24 | 9 | — |
> | stały plan: tylko ścieżka ⭐ | 100 | 43 | 4 | 37 |
> | gracz korzystający z prognozy | 98 | 53 | 19 | — |
>
> Przed etapem 2 stały plan wygrywał 100% gier na normalnym, a „Epoki lodowcowe” 100%.

Każdy punkt ma priorytet: **P1** — błąd lub luka łamiąca założenia, do zrobienia
najpierw; **P2** — wyraźnie poprawi grę lub naukę; **P3** — rozwój / dopracowanie.
Pozycje oznaczone 🔬 zostały potwierdzone skryptem na obecnym silniku
(wyniki w nawiasach).

---

## 1. Błędy do naprawy

| # | Pri | Problem | Gdzie | Propozycja |
|---|---|---|---|---|
| 1.1 ✅ | P1 | Karta wiedzy **„Podbój lądu”** (`land`, z Tiktaalikiem) nigdy się nie odblokowuje — żaden kod nie wywołuje `unlockKnowledge(…, 'land')`. | `js/engine.js:170-174`, `js/data.js:254` | Odblokowywać przy zakupie `limbs` i przy pierwszej migracji na ląd. |
| 1.2 ✅ | P1 | Samouczek podaje cel `DATA.INTELLIGENCE_GOAL` (14) niezależnie od scenariusza/trudności (łatwy = 12, „Epoki lodowcowe” = 14 przy trudnym 15) i mówi o „trzech erach”, choć scenariusz lodowcowy ma jedną. | `js/ui.js:650` | Budować kroki samouczka dynamicznie z `state.intelligenceGoal` i liczby pozostałych er. |
| 1.3 ✅ | P1 | Ekran końcowy „przetrwanie” zawsze mówi „przetrwały paleozoik, mezozoik i kenozoik” — nieprawda dla scenariusza startującego w kenozoiku. | `js/ui.js:563` | Wypisywać ery od `startEra` (zapamiętać ją w stanie). |
| 1.4 ✅ | P1 | Prognoza „co-jeśli” dodaje tylko efekty liczbowe cechy, ale nie dopisuje jej `id` do `traits` — np. **Stałocieplność** nie pokazuje ochrony przed zimnem, więc podgląd wprowadza w błąd. | `js/ui.js:263-265` | Przenieść podgląd do silnika (`Engine.forecastWithTrait`) i klonować linię razem z listą cech. |
| 1.5 ✅ | P2 | 🔬 Po ostatniej turze `eraIndex = 3`, a `turn` zostaje 6 → `globalTurn` = 26 przy 20 turach ogółem; drzewo życia rysuje gałęzie poza osią. | `js/engine.js:302`, `js/ui.js:512` | Przy końcu gry zerować `turn` albo przycinać `nowT` do `totalTurns`. |
| 1.6 ✅ | P2 | Scenariusz „Epoki lodowcowe” daje gatunek z kończynami, stałocieplny i z izolacją, ale startuje w niszy **woda**. | `js/engine.js:51`, `js/data.js:225-228` | Dodać do scenariusza pole `startNiche: 'lad'`. |
| 1.7 ✅ | P2 | Opis **Zwojów nerwowych** mówi „lekko wyższy metabolizm”, a efekty nie zawierają metabolizmu. | `js/data.js:120-122` | Dodać `metabolism: 1` (albo poprawić opis). |
| 1.8 | P3 | Ta sama ikona 🦎 dla **Kończyn** i **Kamuflażu**. | `js/data.js:71`, `js/data.js:88` | Np. 🦵 dla kończyn, 🍃 dla kamuflażu. |
| 1.9 | P3 | Raport oznacza wiersz jako niebezpieczny regexem `/Katastrofa/` po polskim tekście — przestanie działać po tłumaczeniu. | `js/ui.js:440`, `js/engine.js:326-348` | Silnik zwraca zdarzenia jako `{type, params}`, UI je tłumaczy. |
| 1.10 ✅ | P3 | README jest nieaktualne: „przez erę paleozoiku”, „przez 8 tur ery”; zdublowana sekcja „Struktura projektu”. | `README.md` | Zaktualizować do 3 er / 20 tur i scalić sekcje. |

## 2. Balans i eksploity

| # | Pri | Problem | Propozycja |
|---|---|---|---|
| 2.1 ✅ | P1 | 🔬 **Darmowa, natychmiastowa migracja pozwala uniknąć katastrofy.** Prognoza ostrzega o nadchodzącym wymieraniu, a gracz przenosi linię na przybrzeże i wraca po turze (Perm: woda 65→22, przybrzeże 65→45, 0 ofiar katastrofy). Przy okazji uczy czegoś odwrotnego niż założenie „katastrofy odsiewają niedostosowanych”. | Migracja trwa turę albo kosztuje EP/część populacji; limit jednej migracji na turę; wymóg minimalnej mobilności (ZALOZENIA 4.1: mobilność = zdolność migracji). |
| 2.2 ✅ | P1 | 🔬 **Specjacja mnoży EP.** Każda linia osobno dostaje EP za inteligencję i niszę, a potomek kopiuje statystyki rodzica (1 linia: +16 EP/turę, 4 linie: +44, 7 linii: +74). Specjacja za 12 EP zwraca się w 1–2 tury. | Premię za inteligencję liczyć raz (z najlepszej linii) albo skalować ją malejąco; koszt specjacji rosnący z liczbą żywych linii. |
| 2.3 ✅ | P1 | 🔬 **Gra jest za łatwa i nie wymusza adaptacji.** Stały plan zakupów „pod ⭐” wygrywa w 300/300 losowych gier (15 z nich już w mezozoiku, zanim kenozoiczne kamienie milowe są dostępne). Scenariusz „Epoki lodowcowe” (trudny) wygrywa w 200/200. To przeczy pętli „obserwuj → decyduj → adaptuj”. | Kalibracja celu i kosztów; test „stały plan nie powinien wygrywać zawsze”; zwycięstwo dopiero od kenozoiku (lub wymóg `tool_use`); w scenariuszu lodowcowym realne zagrożenie głodem/zimnem. |
| 2.4 ✅ | P2 | **Kompromisy w opisach nie działają w silniku** (ZALOZENIA 4.2: „nic nie jest darmowe”). Przykłady: Płetwy „bezużyteczne na lądzie”, Linia boczna „działa tylko w wodzie”, Filtrowanie „tylko przy dużej ilości planktonu”, Kamuflaż „zawodzi w ruchu”, Liczne jaja „duża śmiertelność”, Opieka „mniej potomstwa” (a daje +2 rozrodu). Oczy, Łuski i Jajo lądowe nie mają żadnego minusa. | Dodać do cech pole `nicheMods` / `conditions` (np. `lateral_line` działa tylko w `woda`/`przybrzeze`), a minusy wprowadzić do efektów. Pokazać je w prognozie. |
| 2.5 ✅ | P2 | **Katastrofy uderzają jednakowo** (stała `severity` × trudność). Karta wiedzy mówi, że wymieranie „uderza najmocniej w linie niedostosowane”, ale mechanika tego nie odzwierciedla. | Modyfikatory przeżycia zależne od cech: stałocieplność/izolacja przy zlodowaceniach, mały metabolizm przy K–Pg, nisza powietrzna itp. Raport ma wyjaśniać, *dlaczego* linia przetrwała. |
| 2.6 ✅ | P2 | Mutacje mogą podnieść **inteligencję**, więc cel da się osiągnąć losowo, a **metabolizm** nigdy nie mutuje. | Mutacje inteligencji rzadsze (albo tylko przy `brain`); dodać metabolizm do puli. |
| 2.7 | P2 | Koewolucja jest **globalna**: obrona linii wodnej podnosi presję drapieżników na lądzie i w powietrzu. | `predatorLevel` osobno dla każdej niszy. |
| 2.8 | P3 | Klimat działa tak samo w każdej niszy (woda buforuje temperaturę). | Łagodniejszy wpływ zimna w wodzie, silniejszy na lądzie i w powietrzu. |
| 2.9 ✅ | P3 | Ląd wymaga tylko Kończyn, choć karta wiedzy mówi też o „oddychaniu powietrzem i rozrodzie niezależnym od wody”. | Bez Jaja lądowego — kara do rozrodu na lądzie (płazy muszą wracać do wody). |

## 3. Luki względem założeń (ZALOZENIA.md)

| # | Pri | Założenie | Stan | Propozycja |
|---|---|---|---|---|
| 3.1 | P1 | §6 Mini-quizy po erze z bonusem EP | brak | 2–3 pytania z kart wiedzy odblokowanych w danej erze; bonus EP za poprawne odpowiedzi; pytania w `data.js`. |
| 3.2 | P2 | §6 Tryb nauczyciela jako **tryb** („zapauzowanie, cofnięcie tury, omówienie”) | cofanie jest zawsze włączone | Przełącznik trybu na starcie. Poza nim brak cofania tury, bo inaczej można w kółko losować mutacje, zdarzenia i (od etapu 2) warunki środowiska. W trybie nauczyciela dodać „omów turę” (powrót do raportu) i cofanie z ekranu końcowego. |
| 3.3 | P2 | §5 Prekambr i Antropocen | gra startuje w paleozoiku i kończy na progu rozumności | Krótki prekambr (fotosynteza, wielokomórkowość, tlen) jako opcjonalny prolog; Antropocen jako epilog/ekran zwycięstwa. |
| 3.4 | P2 | §4.1 Typ odżywiania (roślino-/mięso-/wszystkożerność) | tylko liczba „odżywianie” | Dieta jako atrybut modyfikujący, który pokarm liczy się w danej niszy (rośliny na lądzie od sylur/karbonu, zdobycz ↔ drapieżnictwo). |
| 3.5 | P2 | §4.2 EP za „zajęcie nowej niszy” i „wygrane starcia” | premia za niszę naliczana co turę, brak EP za starcia | Jednorazowy bonus za pierwszą kolonizację niszy; EP za turę z niskimi stratami od drapieżników. |
| 3.6 | P2 | §8 Scenariusze tematyczne („przetrwaj epokę lodowcową”, „skolonizuj ląd”) | „Podbój lądu” = pełna gra na łatwym, bez własnego celu | Scenariusze z własnymi warunkami zwycięstwa (np. „populacja na lądzie ≥ X do końca paleozoiku”) i krótszą długością. |
| 3.7 | P2 | §7 Tryb dla daltonistów | brak (kolory pos/neg = zielony/czerwony) | Dodatkowe symbole ▲▼ obok liczb i alternatywna paleta. |
| 3.8 | P2 | §9 PWA / działanie offline | brak manifestu i service workera | `manifest.webmanifest` + prosty service worker cache-first. |
| 3.9 | P3 | §4.5 Specjacja „gdy część populacji zaadaptuje się do odrębnej niszy” | potomek jest identyczną kopią w tej samej niszy | Przy specjacji wymagać wyboru innej niszy albo dać potomkowi darmową mutację różnicującą. |
| 3.10 | P3 | §11 Długość sesji ≈ 45 min | niezmierzona | Pomiar czasu gry w testach z uczniami; opcja „krótka gra” (jedna era). |
| 3.11 | P3 | §8 Tryb wieloosobowy | brak (świadomie poza zakresem) | Na później: tryb *hot-seat* na jednym komputerze. |

## 4. Rzetelność merytoryczna i warstwa edukacyjna

| # | Pri | Problem | Propozycja |
|---|---|---|---|
| 4.1 ✅ | P1 | **Wymieranie permskie oznaczone jako `zimno`.** Wymieranie P–T wiąże się z trapami syberyjskimi i gwałtownym **ociepleniem** (oraz zakwaszeniem i niedotlenieniem oceanów). | Klimat `cieplo`, niski tlen; nota o wulkanizmie i ociepleniu. |
| 4.2 ✅ | P1 | Wymieranie permskie uderza tylko w niszę `woda`, a w rzeczywistości dotknęło też ląd (ok. 70% kręgowców lądowych). | `niche: 'all'` z mniejszą siłą na lądzie. |
| 4.3 | P2 | Ryzyko utrwalania mitu **„ewolucja ma cel”** (ZALOZENIA §11): „droga do inteligencji ⭐”, „Kulminacja”, „Cel”. | Karta wiedzy „Ewolucja nie ma celu — cel ma gracz”, pokazywana na starcie i przy pierwszym zakupie ⭐; zmiana podpisu na „ścieżka gracza”. |
| 4.4 | P2 | Brakuje dwóch z „wielkiej piątki” wymierań: późnodewońskiego i triasowo-jurajskiego. | Dodać jako katastrofy (dewon — morza, niedotlenienie; T–J — po triasie). |
| 4.5 | P2 | Uproszczenia nie są oznaczone przy konkretnych mechanikach (ZALOZENIA §6: „uproszczenia oznaczane jako uproszczenia”). | Znacznik „ℹ uproszczenie” w kartach (np. nisza powietrzna już w mezozoiku, kolejność pióra→stałocieplność). |
| 4.6 | P3 | Kodeks pokazuje tylko odkryte karty, bez postępu. | „Odkryto 9/15” i zarysy nieodkrytych kart (motywacja). |
| 4.7 | P3 | Podsumowanie dla nauczyciela nie zawiera przebiegu gry, choć stan ma `history`. | Oś tur w eksporcie: zakupy, migracje, katastrofy i populacja w każdej turze. |

## 5. UX i dostępność

| # | Pri | Problem | Gdzie | Propozycja |
|---|---|---|---|---|
| 5.1 | P2 | Drzewo życia jest klikalne tylko myszą (elementy `<g>` nie przyjmują fokusu). | `js/ui.js:500-506` | `tabindex="0"`, `role="button"`, obsługa Enter/Spacja albo lista linii pod SVG. |
| 5.2 | P2 | Samouczek (`role="dialog"`) nie przejmuje fokusu, a Escape nie zamyka ani samouczka, ani raportu tury. Żaden modal nie więzi fokusu. | `js/ui.js:660`, `js/ui.js:680`, `js/ui.js:730-737` | Wspólna obsługa modali: pułapka fokusu, Escape, powrót fokusu. |
| 5.3 | P2 | Wykres populacji ma `aria-hidden` i nie ma alternatywy tekstowej (ZALOZENIA §7). | `index.html` sparkline | `aria-label` z trendem („120 → 340, rośnie”). |
| 5.4 | P3 | Komunikaty błędów (`flash`) podmieniają napis na przycisku „Przeżyj turę” — łatwo je przeoczyć, czytnik ekranu ich nie ogłasza. | `js/ui.js:682` | Osobny toast z `aria-live="polite"`. |
| 5.5 | P3 | Brak skrótów klawiszowych do głównych akcji (tablica multimedialna, klawiatura). | — | Np. `Spacja` — tura, `K` — Kodeks, `D` — drzewo, `1–4` — nisze. |
| 5.6 | P3 | Stary zapis (inna wersja) jest po cichu odrzucany. | `js/ui.js:65` | Informacja „zapis z poprzedniej wersji nie jest zgodny” albo migracja zapisu. |

## 6. Technika i jakość

| # | Pri | Problem | Propozycja |
|---|---|---|---|
| 6.1 | P2 | i18n obejmuje tylko statyczny HTML; większość tekstów UI jest wpisana na sztywno w `ui.js`, a silnik zwraca polskie komunikaty (`error`, `events`, `statLabel`). Klucz `lineage.migrateToLand` jest nieużywany. | Silnik zwraca kody i parametry, wszystkie napisy przez `T()`. Test, który wyłapuje brakujące klucze. |
| 6.2 | P2 | Brak `package.json`/`npm test` i CI; `node --test test/` nie działa (testy to własny runner). | Minimalny `package.json` ze skryptem `test` i workflow GitHub Actions uruchamiający testy. |
| 6.3 | P2 | Brak testów dla wykrytych problemów. | Testy regresji: karta `land`, unik katastrofy przez migrację, skalowanie EP ze specjacją, „stały plan nie wygrywa zawsze”, `globalTurn` ≤ `totalTurns`. |
| 6.4 | P3 | UI ma testy tylko ręczne. | Kilka testów Playwright (start scenariusza, zakup cechy, tura, raport, koniec gry). |
| 6.5 | P3 | `traitsById` jest przebudowywane przy każdym zakupie; w UI powtarzane są wyszukiwania `filter(...)[0]`. | Budować mapę raz. Drobna optymalizacja i czytelność. |

---

## Proponowana kolejność prac

1. ✅ **Sprint poprawek (P1, małe):** 1.1–1.4, 4.1–4.2, 1.6–1.7, README (1.10) i testy regresji (6.3).
2. ✅ **Sprint balansu:** 2.1 (migracja), 2.2 (EP ze specjacji), 2.3 (kalibracja + test statystyczny), 2.4 (działające kompromisy), 2.5 (selektywne katastrofy).
3. **Sprint edukacyjny:** quizy po erze (3.1), karta „ewolucja nie ma celu” (4.3), tryb nauczyciela jako tryb (3.2), rozszerzony eksport (4.7), oznaczanie uproszczeń (4.5).
4. **Sprint dostępności i techniki:** 5.1–5.3, tryb dla daltonistów (3.7), PWA (3.8), i18n silnika (6.1), `npm test` + CI (6.2).
5. **Rozwój treści:** prekambr/antropocen (3.3), dieta (3.4), scenariusze z własnymi celami (3.6), brakujące wymierania (4.4).
