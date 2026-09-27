/*
 * palette.ts — paleta stylu „ilustracja naukowa”.
 *
 * Jedno źródło barw dla nowego kodu graficznego (diorama, stworzenie).
 * Interfejs HTML używa tych samych wartości przez zmienne CSS
 * (css/styles.css, sekcja :root) — przy zmianie barw zmień oba miejsca.
 */

/** Tusz i papier — baza każdego rysunku. */
export const INK = {
  light: { paper: '#efe8d8', ink: '#2c261e', inkSoft: '#6b6155', line: '#d6c9b1' },
  dark: { paper: '#161a17', ink: '#ece3cf', inkSoft: '#b1a793', line: '#3a4038' }
} as const;

/** Tony laweryjne kategorii cech (kolor plamy pod rysunkiem ikony). */
export const CATEGORY_WASH: Record<string, string> = {
  pokarm: '#8fa85a',        // mech
  lokomocja: '#4f8ea6',     // morska zieleń
  obrona: '#a8834f',        // róg, chityna
  zmysly: '#c49a2f',        // ochra
  rozrod: '#cf7f69',        // koral
  termoregulacja: '#c25b36',// rdza
  uklad_nerwowy: '#8469ad'  // fiolet atramentu
};

/** Barwy nisz — do ikon, chipów i (w kolejnych etapach) dioramy. */
export const NICHE_COLOR: Record<string, string> = {
  woda: '#3d7c98',
  przybrzeze: '#3f9585',
  lad: '#7a8c45',
  powietrze: '#7b9fc2'
};

/** Barwy er geologicznych (tło osi czasu, później nastrój dioramy). */
export const ERA_COLOR: Record<string, string> = {
  paleozoik: '#4d8a8c',
  mezozoik: '#8a8a3f',
  kenozoik: '#b0823e'
};
