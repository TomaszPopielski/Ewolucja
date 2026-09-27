/*
 * spec.ts — z linii rozwojowej (cechy, nisza) do opisu wyglądu zwierzęcia.
 *
 * Czysta logika bez DOM: ten sam opis rysuje portret (etap 2), a później
 * diorama i miniatury w drzewie życia. Każda cecha ma widoczny odpowiednik
 * („cecha → część ciała”), żeby gracz widział skutek swojego wyboru.
 */

/** Minimalny kształt linii z silnika (js/engine.js → makeLineage). */
export interface LineageLike {
  id: string;
  name: string;
  traits: string[];
  niche: string;
}

/** Widoczne części/znaki; klucze odpowiadają cechom z js/data.js. */
export const FEATURES = [
  'filter_feeding', 'jaws', 'omnivory',
  'fins', 'fast_muscle', 'limbs', 'flight', 'grasping_hand',
  'scales', 'shell', 'camouflage',
  'eyes', 'lateral_line',
  'many_eggs', 'amniotic_egg', 'parental_care',
  'endothermy', 'insulation',
  'ganglia', 'brain', 'pack_hunting', 'big_brain', 'social', 'tool_use'
] as const;
export type Feature = (typeof FEATURES)[number];

export type Niche = 'woda' | 'przybrzeze' | 'lad' | 'powietrze';

export interface CreatureSpec {
  /** Cechy, które linia ma (obecność docelowa = 1). */
  owned: Set<Feature>;
  niche: Niche;
  /** Ziarno losowości — stałe dla linii, różne dla gałęzi. */
  seed: number;
  /** Barwa ciała (ton laweryjny) w formacie #rrggbb. */
  bodyColor: string;
  /** Mnożniki proporcji (różnice między gałęziami, ±10%). */
  proportions: { length: number; girth: number; head: number };
  /** Rozmiar ciała do podziałki na rysunku, w centymetrach. */
  sizeCm: number;
}

/** Stabilny hash napisu (FNV-1a) — ziarno losowości linii. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministyczny generator liczb losowych (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stonowane barwy przyrodnicze na ciało (dobierane ziarnem). */
const BODY_COLORS = ['#7f9a86', '#9c8c68', '#6f8fa3', '#a3836a', '#8a9a62', '#8d8aa6'];
const WARM_BODY = '#b27a57';

/** Rozmiar ciała wynikający z planu budowy (do podziałki). */
function bodySizeCm(owned: Set<Feature>): number {
  if (owned.has('big_brain') || (owned.has('endothermy') && owned.has('insulation') && owned.has('limbs'))) return 90;
  if (owned.has('limbs')) return owned.has('endothermy') ? 60 : 40;
  if (owned.has('fins')) return owned.has('fast_muscle') ? 25 : 12;
  return 3;
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p: number, sh: number) => (p >> sh) & 255;
  const m = (sh: number) => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * t);
  return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1);
}

export function isFeature(id: string): id is Feature {
  return (FEATURES as readonly string[]).indexOf(id) !== -1;
}

export function buildSpec(lineage: LineageLike): CreatureSpec {
  const owned = new Set<Feature>();
  lineage.traits.forEach((t) => { if (isFeature(t)) owned.add(t); });
  const seed = hashString(lineage.id + '|' + lineage.name);
  const r = rng(seed);
  let body = BODY_COLORS[Math.floor(r() * BODY_COLORS.length)];
  if (owned.has('endothermy')) body = mixHex(body, WARM_BODY, 0.55);
  const niche = (['woda', 'przybrzeze', 'lad', 'powietrze'].indexOf(lineage.niche) !== -1
    ? lineage.niche : 'woda') as Niche;
  return {
    owned,
    niche,
    seed,
    bodyColor: body,
    proportions: {
      length: 0.93 + r() * 0.14,
      girth: 0.9 + r() * 0.2,
      head: 0.92 + r() * 0.16
    },
    sizeCm: bodySizeCm(owned)
  };
}

/** Czytelna etykieta podziałki (np. „3 cm”, „1 m”). */
export function scaleLabel(cm: number): string {
  return cm >= 100 ? Math.round(cm / 100) + ' m' : cm + ' cm';
}
