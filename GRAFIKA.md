# Ewolucja — podniesienie warstwy graficznej

Cel: gra ma **pokazywać** ewolucję, a nie tylko ją opisywać liczbami. Każda
decyzja gracza (cecha, nisza, specjacja) i każda zmiana środowiska powinna być
od razu widoczna na ilustracji.

Zasady techniczne (bez zmian względem `ZALOZENIA.md`):

- zero zależności i zero plików graficznych — cała grafika to proceduralne SVG
  generowane w `js/art.js`; gra dalej działa offline po otwarciu `index.html`,
- silnik (`engine.js`) pozostaje czysty — grafika tylko czyta stan,
- dostępność: ilustracje są dekoracyjne (`aria-hidden`) albo mają opis,
  animacje wyłącza `prefers-reduced-motion`, tryb ciemny przygasza ilustracje.

## Etap 1 — wdrożony

| Obszar | Co się zmieniło |
|---|---|
| **Portret linii** (`GameArt.creature`) | Organizm składany z cech: płetwy → kończyny, łuski, pancerz, kamuflaż, oczy, szczęki / filtrowanie, skrzydła, puszysta izolacja, aura stałocieplności, świecący mózg. Po zakupie cechy portret „ewoluuje” z animacją. Portret pokazuje też jaja, potomstwo (opieka) i grupę (życie społeczne). |
| **Scena ekosystemu** (`GameArt.scene`) | Panorama następnej tury: niebo wg klimatu, woda / przybrzeże / ląd / powietrze. Dane środowiska są czytelne wizualnie: plankton = pokarm, pęcherzyki = tlen, sylwetki = drapieżniki (z koewolucją), roślinność lądu zależna od ery i pokarmu (mchy → paprocie → lepidodendrony karbonu → sagowce i iglaste → drzewa liściaste i trawy). Katastrofy: meteor K–Pg, wulkany permskie, lód i śnieg w zlodowaceniach. Wszystkie linie gracza pływają, chodzą lub latają w swoich niszach; liczebność na scenie odpowiada populacji. |
| **Tożsamość wizualna** | Styl „papier przyrodnika”: szeryfowe nagłówki, siatka notatnika, logo SVG i favicon. Każda era ma własny motyw barwny (`body[data-era]`), a pasek górny ma trzy pasy er. |
| **Oś czasu** | Kafelki tur jak warstwy geologiczne (kreskowane w kolorze ery), pulsująca bieżąca tura, oznaczenie katastrof. |
| **Karty cech** | Kolor kategorii (pasek i ikona), czytelny koszt w pigułce, wyraźny stan „zdobyta”, animacja zakupu. |
| **Statystyki** | Kolorowe paski w barwach kategorii (poprawiony też błąd: paski były puste, bo `span` był elementem inline). Wskaźnik postępu inteligencji pod celem. |
| **Linie rozwojowe** | Każda linia ma stały kolor — ten sam w chipach, na scenie, w legendzie, na wykresie populacji i w drzewie życia. |
| **Drzewo życia** | Zakrzywione odgałęzienia w kolorach linii, miniatury organizmów na końcach gałęzi. |
| **Raport tury** | Pasek przepływu populacji (przetrwały / narodziny / drapieżniki / głód / katastrofa), baner nowej ery w barwach ery. |
| **Ekran startowy i końcowy** | Animowana scena tytułowa z paleozoiku; na końcu galeria portretów wszystkich linii i medal w barwie wyniku. |
| **Modale** | Rozmyte tło, miękkie wejście, większe zaokrąglenia. |

## Etap 2 — proponowany

1. **Przejście tury jako animacja** — 1–2 s „przewijania czasu” na scenie
   przed raportem: populacja rośnie/maleje na oczach gracza, drapieżniki
   atakują, katastrofa uderza (meteor spada, woda ciemnieje).
2. **Morfing między cechami** — płynne przejście sylwetki (np. płetwa → kończyna)
   zamiast podmiany; SMIL albo interpolacja ścieżek w JS.
3. **Ilustracje w Kodeksie** — do każdej karty wiedzy mała rycina w stylu
   atlasu (Tiktaalik, Archaeopteryx, amonity) rysowana tymi samymi prymitywami.
4. **Mapa kontynentów w tle ery** — schematyczna Pangea → rozpad kontynentów
   jako tło osi czasu.
5. **Dźwięk otoczenia** (opcjonalny, domyślnie wyłączony) — szum morza, las,
   wiatr epoki lodowcowej; Web Audio, bez plików.

## Etap 3 — rozważany

- **Karta „pocztówka gatunku”** do pobrania jako PNG (portret + drzewo +
  wynik), np. dla nauczyciela lub do udostępnienia.
- **PWA** z ikoną aplikacji wygenerowaną z logo.
- **Tryb wysokiego kontrastu** i wzory zamiast samych kolorów w kategoriach
  (dla osób z zaburzeniami widzenia barw).
