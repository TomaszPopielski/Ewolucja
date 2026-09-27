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
