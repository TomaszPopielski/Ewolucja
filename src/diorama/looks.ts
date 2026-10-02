/*
 * looks.ts — scenariusz barw dioramy: paleta każdej sceny (era × nisza)
 * w trzech wariantach klimatu tury, zmierzch dla trybu ciemnego i popielate
 * barwy po katastrofie. Czysta logika (bez DOM) — testy w test/light.test.mjs.
 *
 * Każda era ma własny charakter:
 * paleozoik — wilgotny, turkusowo-zielony świat bagiennych lasów widłaków i ciepłych mórz;
 * mezozoik — ciepły, suchszy, oliwkowo-złoty świat araukarii, sagowców i raf;
 * kenozoik — sawanny, trawy i lasy kelpowe w czystszym, chłodniejszym świetle.
 * Klimat tury zmienia porę i jakość światła (ciepło: złote, zamglone popołudnie;
 * zimno: niskie słońce, chłodne cienie, śnieg i lód).
 */
import { mix } from './scenery.ts';
import type { Era, NicheKey } from './scenery.ts';

export type Climate = 'cieplo' | 'umiarkowanie' | 'zimno';

/** Scenariusz barw jednej sceny (era × nisza × klimat). Pola nieużywane w danej niszy są ignorowane. */
export interface Look {
  /** Niebo: zenit, horyzont i mgiełka nad horyzontem. */
  skyTop: string; skyHorizon: string; haze: string;
  /** Słońce: położenie (ułamki szerokości i wysokości sceny), barwa, siła poświaty, widoczność tarczy. */
  sun: { x: number; y: number; color: string; glow: number; disk: number };
  cloud: string; cloudShade: string;
  /** Góry na horyzoncie (mocno zamglone) i śnieżne czapy. */
  mountain: string; snowCaps: boolean;
  /** Wzgórza (także brzeg widziany z wody i ląd widziany z powietrza) i las na dalekim planie. */
  hill: string; treeFar: string;
  /** Grunt przy horyzoncie i przy dolnej krawędzi. */
  groundFar: string; groundNear: string;
  /** Plamy światła i cienia; barwa cieni rzucanych. */
  lit: string; shade: string;
  /** Liście (ton, strona w słońcu, strona w cieniu), igły, kora, trawa. */
  leaf: string; leafLit: string; leafShade: string; conifer: string; bark: string; grass: string;
  flowers: boolean;
  /** Udział płatów śniegu i bezlistnych drzew (0–1); kałuże na bagnistym gruncie (0–1). */
  snow: number; bare: number; puddles: number;
  /** Toń: przy powierzchni, w głębi, zamglenie dali; piasek dna; kra na powierzchni. */
  waterTop: string; waterDeep: string; waterHaze: string; sand: string; ice: boolean;
  /** Krycie snopów światła (0 = bez snopów). */
  rays: number;
  /** Ciemny ton roślin ramujących kadr (pod światło). */
  frame: string;
}

// ------------------------------------------------------------------ palety bazowe (klimat umiarkowany)

/** Pola wody dla scen lądowych i powietrznych (kałuże, rzeki widziane z góry). */
const WATER_DEFAULT = { waterTop: '#a9c9c4', waterDeep: '#3d6f74', waterHaze: '#8fb5b0', sand: '#cdbb8e', ice: false };
const LAND_DEFAULT = { snow: 0, bare: 0, puddles: 0, flowers: false, snowCaps: false };

const BASE: Record<string, Look> = {
  // ——— paleozoik: wilgotno, turkus i zieleń widłaków
  'paleozoik|woda': {
    skyTop: '#8fb3bf', skyHorizon: '#e6e2c8', haze: '#d8dcc4', sun: { x: 0.72, y: 0.15, color: '#f4f0d0', glow: 0.6, disk: 0 },
    cloud: '#f7f4ea', cloudShade: '#aabcc2', mountain: '#98aab0', hill: '#a7ad88', treeFar: '#6c8a5c',
    groundFar: '#b9b48a', groundNear: '#8a9a62', lit: '#f2ecc0', shade: '#2c5a5e',
    leaf: '#6a8a48', leafLit: '#a9bf6a', leafShade: '#3a5a44', conifer: '#4a6e52', bark: '#6f6a4a', grass: '#6a8a48',
    ...LAND_DEFAULT, waterTop: '#9fcfc6', waterDeep: '#2b6874', waterHaze: '#7fb3ad', sand: '#cdbb8e', ice: false, rays: 0.3, frame: '#1f4a48'
  },
  'paleozoik|przybrzeze': {
    skyTop: '#8fb3bf', skyHorizon: '#e6e2c8', haze: '#dcdcc2', sun: { x: 0.74, y: 0.14, color: '#f6f0d0', glow: 0.65, disk: 0 },
    cloud: '#f8f5ea', cloudShade: '#aabcc2', mountain: '#9caab0', hill: '#b3ad86', treeFar: '#6f8f5a',
    groundFar: '#c2b88c', groundNear: '#9a9a66', lit: '#f4eec4', shade: '#3a6462',
    leaf: '#6f8f4c', leafLit: '#afc46e', leafShade: '#3c5c46', conifer: '#4a6e52', bark: '#706a4a', grass: '#6f8f4c',
    ...LAND_DEFAULT, waterTop: '#b4dccf', waterDeep: '#4f9088', waterHaze: '#9cc9bd', sand: '#d6c596', ice: false, rays: 0.24, frame: '#24504a'
  },
  'paleozoik|lad': {
    skyTop: '#8fb0b0', skyHorizon: '#e2e2c6', haze: '#d5dcc2', sun: { x: 0.78, y: 0.2, color: '#f8f0cc', glow: 0.6, disk: 0 },
    cloud: '#f6f4ea', cloudShade: '#a9bab8', mountain: '#98aab0', hill: '#94a684', treeFar: '#5d7e5a',
    groundFar: '#a9b58a', groundNear: '#5f7f45', lit: '#e3e4a8', shade: '#34524a',
    leaf: '#5a8a4a', leafLit: '#9fbf6a', leafShade: '#2e503e', conifer: '#476e50', bark: '#6f6a4a', grass: '#5f8a45',
    ...LAND_DEFAULT, puddles: 0.7, ...WATER_DEFAULT, waterTop: '#a9c6c0', rays: 0.16, frame: '#24402e'
  },
  'paleozoik|powietrze': {
    skyTop: '#8eb2b9', skyHorizon: '#e4e3c8', haze: '#d6dcc4', sun: { x: 0.8, y: 0.16, color: '#f8f0cc', glow: 0.7, disk: 0 },
    cloud: '#fbf8ee', cloudShade: '#a8bcc0', mountain: '#9aacb2', hill: '#9aae86', treeFar: '#5f7f56',
    groundFar: '#a9b58a', groundNear: '#7f9a62', lit: '#ece8b6', shade: '#3e5e56',
    leaf: '#5a8a4a', leafLit: '#9fbf6a', leafShade: '#2e503e', conifer: '#476e50', bark: '#6f6a4a', grass: '#5f8a45',
    ...LAND_DEFAULT, puddles: 0.5, ...WATER_DEFAULT, rays: 0.14, frame: '#2c4a40'
  },
  // ——— mezozoik: ciepło, oliwka i złoto, wulkaniczne góry
  'mezozoik|woda': {
    skyTop: '#86afc8', skyHorizon: '#f0e2bc', haze: '#e2dcc0', sun: { x: 0.7, y: 0.14, color: '#fbf2d2', glow: 0.65, disk: 0 },
    cloud: '#fbf6ea', cloudShade: '#b2bcc4', mountain: '#ab9f98', hill: '#b5a875', treeFar: '#6f8a52',
    groundFar: '#cdb983', groundNear: '#9a9a58', lit: '#f6efc6', shade: '#25506a',
    leaf: '#5f8a46', leafLit: '#b8c46a', leafShade: '#3b5638', conifer: '#4c6f4c', bark: '#7f5f42', grass: '#76863c',
    ...LAND_DEFAULT, waterTop: '#a6d6d8', waterDeep: '#215a7a', waterHaze: '#86bccc', sand: '#d8c79a', ice: false, rays: 0.32, frame: '#1d4252'
  },
  'mezozoik|przybrzeze': {
    skyTop: '#86afc8', skyHorizon: '#f0e2bc', haze: '#e6dcbc', sun: { x: 0.74, y: 0.14, color: '#fff2cf', glow: 0.7, disk: 0 },
    cloud: '#fcf7ea', cloudShade: '#b2bcc4', mountain: '#ad9f96', hill: '#bfae7e', treeFar: '#5f8a4a',
    groundFar: '#d2bd86', groundNear: '#a49a5a', lit: '#f8eec2', shade: '#2e5a6a',
    leaf: '#5f8a46', leafLit: '#b8c46a', leafShade: '#3b5638', conifer: '#4c6f4c', bark: '#7f5f42', grass: '#76863c',
    ...LAND_DEFAULT, waterTop: '#b9e2dc', waterDeep: '#438a9a', waterHaze: '#a2d0cc', sand: '#e2cf9c', ice: false, rays: 0.26, frame: '#22505a'
  },
  'mezozoik|lad': {
    skyTop: '#86a9c0', skyHorizon: '#f1dfb4', haze: '#ead8b0', sun: { x: 0.76, y: 0.18, color: '#fff0c8', glow: 0.75, disk: 0 },
    cloud: '#fcf6e8', cloudShade: '#b6b8b8', mountain: '#ab9f98', hill: '#b5a875', treeFar: '#6f8a52',
    groundFar: '#cdb983', groundNear: '#8a8f45', lit: '#f3dc96', shade: '#5a5236',
    leaf: '#5f8a46', leafLit: '#b8c46a', leafShade: '#3b5638', conifer: '#4c6f4c', bark: '#7f5f42', grass: '#76863c',
    ...LAND_DEFAULT, ...WATER_DEFAULT, rays: 0.15, frame: '#2f3d26'
  },
  'mezozoik|powietrze': {
    skyTop: '#7faac6', skyHorizon: '#f0dfb5', haze: '#e8dab4', sun: { x: 0.8, y: 0.15, color: '#fff0c8', glow: 0.8, disk: 0 },
    cloud: '#fdf8ec', cloudShade: '#b4bcc2', mountain: '#ad9f98', hill: '#b8ad7a', treeFar: '#6a8a4f',
    groundFar: '#cdb983', groundNear: '#a49a5a', lit: '#f4e0a0', shade: '#5a5a48',
    leaf: '#5f8a46', leafLit: '#b8c46a', leafShade: '#3b5638', conifer: '#4c6f4c', bark: '#7f5f42', grass: '#76863c',
    ...LAND_DEFAULT, ...WATER_DEFAULT, waterTop: '#a6cfd2', rays: 0.14, frame: '#3a4a3a'
  },
  // ——— kenozoik: sawanny i lasy kelpowe, czystsze światło
  'kenozoik|woda': {
    skyTop: '#7fa6c3', skyHorizon: '#efe2c2', haze: '#e0dcc6', sun: { x: 0.74, y: 0.15, color: '#f6f2d6', glow: 0.6, disk: 0 },
    cloud: '#fbf6ea', cloudShade: '#aebdca', mountain: '#97a8bb', hill: '#a2b184', treeFar: '#7b966a',
    groundFar: '#c6c48b', groundNear: '#83a050', lit: '#ecebc2', shade: '#24484c',
    leaf: '#679747', leafLit: '#b6cf6a', leafShade: '#36603f', conifer: '#4a7652', bark: '#7a5f48', grass: '#6a8c3a',
    ...LAND_DEFAULT, waterTop: '#a5ccc0', waterDeep: '#22495a', waterHaze: '#7fa9a6', sand: '#c9b98e', ice: false, rays: 0.3, frame: '#1c3d36'
  },
  'kenozoik|przybrzeze': {
    skyTop: '#7fa6c3', skyHorizon: '#efe2c2', haze: '#e7dcc2', sun: { x: 0.78, y: 0.15, color: '#fff0cc', glow: 0.72, disk: 0 },
    cloud: '#fbf6ea', cloudShade: '#aebdca', mountain: '#97a8bb', hill: '#a9b07c', treeFar: '#6a8f55',
    groundFar: '#c6c48b', groundNear: '#83a050', lit: '#f1ebc0', shade: '#2e5658',
    leaf: '#679747', leafLit: '#b6cf6a', leafShade: '#36603f', conifer: '#4a7652', bark: '#7a5f48', grass: '#6a8c3a',
    ...LAND_DEFAULT, waterTop: '#aed6cc', waterDeep: '#3f7f84', waterHaze: '#95c3bb', sand: '#d4c393', ice: false, rays: 0.24, frame: '#22463e'
  },
  'kenozoik|powietrze': {
    skyTop: '#78a3c6', skyHorizon: '#eee3c6', haze: '#e4dcc6', sun: { x: 0.8, y: 0.14, color: '#fff0cc', glow: 0.78, disk: 0 },
    cloud: '#fdf9ee', cloudShade: '#adbdcc', mountain: '#97a8bb', hill: '#b0b585', treeFar: '#6f9157',
    groundFar: '#c6c48b', groundNear: '#9aa860', lit: '#f1e29c', shade: '#4a5e66',
    leaf: '#679747', leafLit: '#b6cf6a', leafShade: '#36603f', conifer: '#4a7652', bark: '#7a5f48', grass: '#6a8c3a',
    ...LAND_DEFAULT, flowers: true, ...WATER_DEFAULT, waterTop: '#9fc4d0', rays: 0.14, frame: '#33474a'
  }
};

/**
 * Kenozoik, ląd — paleta dobrana ręcznie w prototypie etapu 1 (docs/grafika/etap1-lad-kenozoik.jpg):
 * jasny dzień nad sawanną, złote popołudnie paleogenu, niskie słońce epoki lodowcowej.
 */
const KENOZOIK_LAD: Record<Climate, Look> = {
  umiarkowanie: {
    skyTop: '#7fa6c3', skyHorizon: '#efe2c2', haze: '#e7dcc2',
    sun: { x: 0.8, y: 0.15, color: '#fff0cc', glow: 0.75, disk: 0 },
    cloud: '#fbf6ea', cloudShade: '#aebdca', mountain: '#97a8bb', snowCaps: false,
    hill: '#a2b184', treeFar: '#7b966a', groundFar: '#c6c48b', groundNear: '#83a050',
    lit: '#f1e29c', shade: '#46634a',
    leaf: '#679747', leafLit: '#b6cf6a', leafShade: '#36603f', conifer: '#4a7652', bark: '#7a5f48', grass: '#6a8c3a',
    flowers: true, snow: 0, bare: 0, puddles: 0, ...WATER_DEFAULT, rays: 0.14, frame: '#2c4732'
  },
  cieplo: {
    skyTop: '#a3bab6', skyHorizon: '#f4d08c', haze: '#efd29a',
    sun: { x: 0.74, y: 0.27, color: '#ffd889', glow: 0.92, disk: 0.35 },
    cloud: '#fff1d6', cloudShade: '#d1b386', mountain: '#c2ad94', snowCaps: false,
    hill: '#b2ae72', treeFar: '#88965a', groundFar: '#d7c17b', groundNear: '#8d9842',
    lit: '#f7d47c', shade: '#5a5431',
    leaf: '#5c8f42', leafLit: '#cdd068', leafShade: '#36553a', conifer: '#4b6c45', bark: '#7a5a40', grass: '#7c8d33',
    flowers: true, snow: 0, bare: 0, puddles: 0, ...WATER_DEFAULT, rays: 0.18, frame: '#303d27'
  },
  zimno: {
    skyTop: '#8aa6c0', skyHorizon: '#ebe5da', haze: '#e1e5e8',
    sun: { x: 0.84, y: 0.44, color: '#fff3e0', glow: 0.7, disk: 0.6 },
    cloud: '#f5f6f5', cloudShade: '#a3b2c2', mountain: '#a4b4c7', snowCaps: true,
    hill: '#b3b9a6', treeFar: '#788c82', groundFar: '#d2d3c3', groundNear: '#98a183',
    lit: '#f5ecd6', shade: '#6a84a2',
    leaf: '#77885b', leafLit: '#b8b889', leafShade: '#4a5c54', conifer: '#3c5d54', bark: '#6a5a4c', grass: '#8a8f66',
    flowers: false, snow: 0.6, bare: 0.45, puddles: 0, ...WATER_DEFAULT, ice: true, rays: 0, frame: '#31423e'
  }
};

// ------------------------------------------------------------------ klimat tury

const pull = (l: Look, keys: (keyof Look)[], to: string, t: number) => {
  const o = l as unknown as Record<string, string>;
  keys.forEach((k) => { o[k] = mix(o[k], to, t); });
};

/**
 * Wariant klimatu z palety bazowej (umiarkowanej). Ciepło: złote, zamglone
 * popołudnie, zieleńsza toń pełna planktonu. Zimno: niskie słońce, chłodne
 * cienie, śnieg na lądzie, kra i ciemniejsza, czystsza toń.
 */
function withClimate(base: Look, climate: Climate, era: Era, niche: NicheKey): Look {
  if (climate === 'umiarkowanie') return base;
  const l: Look = { ...base, sun: { ...base.sun } };
  if (climate === 'cieplo') {
    pull(l, ['skyTop'], '#a9bcb4', 0.45); pull(l, ['skyHorizon'], '#f4cf8a', 0.5); pull(l, ['haze'], '#efd29a', 0.5);
    pull(l, ['cloud'], '#fff1d6', 0.6); pull(l, ['cloudShade'], '#d1b386', 0.5);
    pull(l, ['mountain'], '#c2ad94', 0.45); pull(l, ['hill', 'treeFar'], '#b2ae72', 0.25);
    pull(l, ['groundFar'], '#d7c17b', 0.35); pull(l, ['groundNear'], '#8d9842', 0.25);
    pull(l, ['lit'], '#f7d47c', 0.5); pull(l, ['shade'], '#5a5431', 0.35); pull(l, ['leafLit'], '#cdd068', 0.35);
    pull(l, ['waterTop'], '#b9d9a6', 0.3); pull(l, ['waterHaze'], '#a9c99a', 0.35); pull(l, ['waterDeep'], '#2f6a5a', 0.3);
    l.sun = { ...l.sun, y: Math.min(0.42, l.sun.y + 0.1), color: '#ffd889', glow: Math.min(1, l.sun.glow + 0.15), disk: 0.35 };
    l.rays = l.rays + 0.04;
  } else {
    pull(l, ['skyTop'], '#8aa6c0', 0.55); pull(l, ['skyHorizon'], '#ebe5da', 0.6); pull(l, ['haze'], '#e1e5e8', 0.6);
    pull(l, ['cloud'], '#f5f6f5', 0.6); pull(l, ['cloudShade'], '#a3b2c2', 0.6);
    pull(l, ['mountain'], '#a4b4c7', 0.5); pull(l, ['hill'], '#b3b9a6', 0.45); pull(l, ['treeFar'], '#788c82', 0.4);
    pull(l, ['groundFar'], '#d2d3c3', 0.5); pull(l, ['groundNear'], '#98a183', 0.45);
    pull(l, ['lit'], '#f5ecd6', 0.6); pull(l, ['shade'], '#6a84a2', 0.55);
    pull(l, ['leaf', 'grass'], '#77885b', 0.35); pull(l, ['leafLit'], '#b8b889', 0.4); pull(l, ['leafShade', 'conifer'], '#3c5d54', 0.3);
    pull(l, ['waterTop'], '#a8c6d4', 0.45); pull(l, ['waterDeep'], '#1c4566', 0.45); pull(l, ['waterHaze'], '#9ab8c8', 0.45); pull(l, ['sand'], '#c9c6b8', 0.35);
    l.sun = { ...l.sun, y: Math.max(l.sun.y, niche === 'woda' ? l.sun.y : 0.42), color: '#fff3e0', glow: 0.7, disk: niche === 'woda' ? 0 : 0.6 };
    l.snowCaps = true; l.flowers = false; l.ice = true;
    // śnieg na lądzie; w mezozoiku (zima po uderzeniu asteroidy, przymrozki) tylko szron
    const snow = era === 'mezozoik' ? 0.3 : 0.6;
    l.snow = niche === 'lad' ? snow : niche === 'przybrzeze' ? snow * 0.6 : niche === 'powietrze' ? snow * 0.8 : 0;
    // drzewa liściaste zrzucają liście tylko w kenozoiku
    l.bare = era === 'kenozoik' ? 0.45 : 0;
    l.rays = niche === 'woda' || niche === 'przybrzeze' ? l.rays * 0.5 : 0;
  }
  return l;
}

/** Tryb ciemny: ta sama scena o zmierzchu — przygaszona, z ciepłą łuną słońca nad horyzontem. */
const NIGHT = '#131a19';
function dusk(l: Look): Look {
  const d = (c: string, t: number) => mix(c, NIGHT, t);
  return {
    ...mapLook(l, (c) => d(c, 0.6)),
    skyTop: d(l.skyTop, 0.74), skyHorizon: mix(d(l.skyHorizon, 0.58), l.sun.color, 0.14), haze: d(l.haze, 0.64),
    // słońce tuż nad horyzontem: ciepła łuna i długie cienie
    sun: { ...l.sun, y: Math.max(l.sun.y, 0.5), color: mix(l.sun.color, '#e09a5c', 0.45), glow: l.sun.glow * 0.55, disk: l.sun.disk * 0.5 },
    cloud: d(l.cloud, 0.64), cloudShade: d(l.cloudShade, 0.72),
    mountain: d(l.mountain, 0.64), hill: d(l.hill, 0.62), treeFar: d(l.treeFar, 0.62),
    groundFar: d(l.groundFar, 0.62), groundNear: d(l.groundNear, 0.6),
    lit: d(l.lit, 0.5), shade: d(l.shade, 0.6),
    leaf: d(l.leaf, 0.52), leafLit: d(l.leafLit, 0.46), leafShade: d(l.leafShade, 0.58),
    conifer: d(l.conifer, 0.52), bark: d(l.bark, 0.5), grass: d(l.grass, 0.48),
    waterTop: d(l.waterTop, 0.62), waterDeep: d(l.waterDeep, 0.55), waterHaze: d(l.waterHaze, 0.64), sand: d(l.sand, 0.6),
    frame: d(l.frame, 0.42), rays: 0
  };
}

/** Wszystkie barwy palety przepuszczone przez jedną funkcję. */
function mapLook(l: Look, fn: (c: string) => string): Look {
  const out = { ...l, sun: { ...l.sun, color: fn(l.sun.color) } } as Look;
  (Object.keys(l) as (keyof Look)[]).forEach((k) => { const v = l[k]; if (typeof v === 'string') (out as unknown as Record<string, string>)[k] = fn(v); });
  return out;
}

/**
 * Ślad po katastrofie (1 = świeży, 0 = odrodzony): barwy wyblakłe i popielate,
 * bez kwiatów. Przez trzy tury krajobraz wraca do pełnych barw.
 */
function ashen(l: Look, t: number): Look {
  const k = 0.75 * Math.max(0, Math.min(1, t));
  const out = mapLook(l, (c) => {
    const p = parseInt(c.slice(1), 16);
    const y = Math.round(0.3 * ((p >> 16) & 255) + 0.59 * ((p >> 8) & 255) + 0.11 * (p & 255));
    const gray = '#' + ((1 << 24) | (y << 16) | (y << 8) | y).toString(16).slice(1);
    return mix(c, mix(gray, '#8a8072', 0.35), k);
  });
  out.flowers = l.flowers && t < 0.3;
  out.sun = { ...out.sun, glow: l.sun.glow * (1 - 0.5 * k) };
  out.rays = l.rays * (1 - k);
  return out;
}

// ------------------------------------------------------------------ wybór palety

export const ERAS: Era[] = ['paleozoik', 'mezozoik', 'kenozoik'];
export const NICHES: NicheKey[] = ['woda', 'przybrzeze', 'lad', 'powietrze'];

const LOOKS: Record<string, Record<Climate, Look>> = {};
ERAS.forEach((era) => NICHES.forEach((niche) => {
  const key = era + '|' + niche;
  if (key === 'kenozoik|lad') { LOOKS[key] = KENOZOIK_LAD; return; }
  const base = BASE[key];
  LOOKS[key] = { umiarkowanie: base, cieplo: withClimate(base, 'cieplo', era, niche), zimno: withClimate(base, 'zimno', era, niche) };
}));

/** Poziom śladu po katastrofie zaokrąglony do kroków, w których scena jest malowana od nowa. */
export function aftermathStep(aftermath: number | undefined): number {
  return Math.round(Math.max(0, Math.min(1, aftermath || 0)) * 3) / 3;
}

export function lookFor(era: Era, niche: NicheKey, climate: string | undefined, dark: boolean, aftermath?: number): Look {
  const set = LOOKS[era + '|' + niche] || LOOKS['paleozoik|woda'];
  const c: Climate = climate === 'cieplo' || climate === 'zimno' ? climate : 'umiarkowanie';
  let l = set[c];
  const a = aftermathStep(aftermath);
  if (a > 0) l = ashen(l, a);
  return dark ? dusk(l) : l;
}

// ------------------------------------------------------------------ geometria światła

/** Strona, z której pada światło: 1 = z prawej, −1 = z lewej. */
export function litSide(l: Look): number { return l.sun.x >= 0.5 ? 1 : -1; }
/** Długość cienia rzucanego jako ułamek wysokości przedmiotu (niskie słońce = długi cień). */
export function shadowLen(l: Look): number { return 0.25 + 1.6 * Math.max(0, Math.min(0.5, l.sun.y)); }
