/*
 * light.ts — światło, barwy er i głębia dioramy (etap 1, docs/GRAFIKA-PROPOZYCJA.md).
 *
 * Prototyp obejmuje na razie jedną scenę: ląd w kenozoiku. Scena dostaje
 * „scenariusz barw” (paletę zależną od ery, niszy i klimatu tury) oraz jedno
 * słońce. Słońce wyznacza jasną stronę roślin, kierunek i długość cieni,
 * poświatę nieba i snopy światła. Dalsze plany są jaśniejsze, chłodniejsze
 * i rozmyte (perspektywa powietrzna), a rośliny pierwszego planu ramują kadr.
 *
 * Wszystko jest malowane raz do tekstur, więc klatka kosztuje tyle co dawniej.
 * Sceny bez palety malują się po staremu (scenery.ts).
 */
import { rng } from '../creature/spec.ts';
import {
  canvasOf, hexA, mix, ink, wash, wrapped, wildflowers,
  type Brush, type Era, type NicheKey, type PaintArgs
} from './scenery.ts';

type Ctx = CanvasRenderingContext2D;
export type Climate = 'cieplo' | 'umiarkowanie' | 'zimno';

/** Scenariusz barw jednej sceny (era × nisza × klimat). */
export interface Look {
  /** Niebo: zenit, horyzont i mgiełka nad horyzontem. */
  skyTop: string; skyHorizon: string; haze: string;
  /** Słońce: położenie (ułamki szerokości i wysokości sceny), barwa, siła poświaty, widoczność tarczy. */
  sun: { x: number; y: number; color: string; glow: number; disk: number };
  cloud: string; cloudShade: string;
  /** Góry na horyzoncie (mocno zamglone) i śnieżne czapy. */
  mountain: string; snowCaps: boolean;
  /** Wzgórza i las na dalekim planie. */
  hill: string; treeFar: string;
  /** Grunt przy horyzoncie i przy dolnej krawędzi. */
  groundFar: string; groundNear: string;
  /** Plamy światła i cienia na gruncie; barwa cieni rzucanych. */
  lit: string; shade: string;
  /** Liście (ton, strona w słońcu, strona w cieniu), igły, kora, trawa. */
  leaf: string; leafLit: string; leafShade: string; conifer: string; bark: string; grass: string;
  flowers: boolean;
  /** Udział płatów śniegu i bezlistnych drzew (0–1). */
  snow: number; bare: number;
  /** Krycie snopów światła (0 = bez snopów). */
  rays: number;
  /** Ciemna zieleń roślin ramujących kadr (pod światło). */
  frame: string;
}

// ------------------------------------------------------------------ scenariusz barw

/**
 * Kenozoik, ląd. Klimat tury zmienia porę i jakość światła:
 * umiarkowany — jasny dzień nad sawanną; ciepły — złote, zamglone popołudnie
 * cieplarnianego paleogenu; zimny — niskie słońce epoki lodowcowej, długie
 * niebieskie cienie, śnieg na górach i płaty śniegu na gruncie.
 */
const KENOZOIK_LAD: Record<Climate, Look> = {
  umiarkowanie: {
    skyTop: '#7fa6c3', skyHorizon: '#efe2c2', haze: '#e7dcc2',
    sun: { x: 0.8, y: 0.15, color: '#fff0cc', glow: 0.75, disk: 0 },
    cloud: '#fbf6ea', cloudShade: '#aebdca',
    mountain: '#97a8bb', snowCaps: false,
    hill: '#a2b184', treeFar: '#7b966a',
    groundFar: '#c6c48b', groundNear: '#83a050',
    lit: '#f1e29c', shade: '#46634a',
    leaf: '#679747', leafLit: '#b6cf6a', leafShade: '#36603f', conifer: '#4a7652', bark: '#7a5f48', grass: '#6a8c3a',
    flowers: true, snow: 0, bare: 0, rays: 0.14, frame: '#2c4732'
  },
  cieplo: {
    skyTop: '#a3bab6', skyHorizon: '#f4d08c', haze: '#efd29a',
    sun: { x: 0.74, y: 0.27, color: '#ffd889', glow: 0.92, disk: 0.35 },
    cloud: '#fff1d6', cloudShade: '#d1b386',
    mountain: '#c2ad94', snowCaps: false,
    hill: '#b2ae72', treeFar: '#88965a',
    groundFar: '#d7c17b', groundNear: '#8d9842',
    lit: '#f7d47c', shade: '#5a5431',
    leaf: '#5c8f42', leafLit: '#cdd068', leafShade: '#36553a', conifer: '#4b6c45', bark: '#7a5a40', grass: '#7c8d33',
    flowers: true, snow: 0, bare: 0, rays: 0.18, frame: '#303d27'
  },
  zimno: {
    skyTop: '#8aa6c0', skyHorizon: '#ebe5da', haze: '#e1e5e8',
    sun: { x: 0.84, y: 0.44, color: '#fff3e0', glow: 0.7, disk: 0.6 },
    cloud: '#f5f6f5', cloudShade: '#a3b2c2',
    mountain: '#a4b4c7', snowCaps: true,
    hill: '#b3b9a6', treeFar: '#788c82',
    groundFar: '#d2d3c3', groundNear: '#98a183',
    lit: '#f5ecd6', shade: '#6a84a2',
    leaf: '#77885b', leafLit: '#b8b889', leafShade: '#4a5c54', conifer: '#3c5d54', bark: '#6a5a4c', grass: '#8a8f66',
    flowers: false, snow: 0.6, bare: 0.45, rays: 0, frame: '#31423e'
  }
};

/** Tryb ciemny: ta sama scena o zmierzchu — przygaszona, z ciepłą łuną słońca nad horyzontem. */
const NIGHT = '#131a19';
function dusk(l: Look): Look {
  const d = (c: string, t: number) => mix(c, NIGHT, t);
  return {
    ...l,
    skyTop: d(l.skyTop, 0.74), skyHorizon: mix(d(l.skyHorizon, 0.58), l.sun.color, 0.14), haze: d(l.haze, 0.64),
    // słońce tuż nad horyzontem: ciepła łuna i długie cienie
    sun: { ...l.sun, y: Math.max(l.sun.y, 0.5), color: mix(l.sun.color, '#e09a5c', 0.45), glow: l.sun.glow * 0.55, disk: l.sun.disk * 0.5 },
    cloud: d(l.cloud, 0.64), cloudShade: d(l.cloudShade, 0.72),
    mountain: d(l.mountain, 0.64), hill: d(l.hill, 0.62), treeFar: d(l.treeFar, 0.62),
    groundFar: d(l.groundFar, 0.62), groundNear: d(l.groundNear, 0.6),
    lit: d(l.lit, 0.5), shade: d(l.shade, 0.6),
    leaf: d(l.leaf, 0.52), leafLit: d(l.leafLit, 0.46), leafShade: d(l.leafShade, 0.58),
    conifer: d(l.conifer, 0.52), bark: d(l.bark, 0.5), grass: d(l.grass, 0.48),
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

const LOOKS: Record<string, Record<Climate, Look>> = { 'kenozoik|lad': KENOZOIK_LAD };

/** Czy scena ma już scenariusz barw (wtedy rysuje się nowym światłem i ma głębszy grunt). */
export function hasLook(era: Era, niche: NicheKey): boolean { return !!LOOKS[era + '|' + niche]; }

/** Poziom śladu po katastrofie zaokrąglony do kroków, w których scena jest malowana od nowa. */
export function aftermathStep(aftermath: number | undefined): number {
  return Math.round(Math.max(0, Math.min(1, aftermath || 0)) * 3) / 3;
}

export function lookFor(era: Era, niche: NicheKey, climate: string | undefined, dark: boolean, aftermath?: number): Look | null {
  const set = LOOKS[era + '|' + niche];
  if (!set) return null;
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

function castShadow(ctx: Ctx, b: Brush, l: Look, x: number, y: number, w: number, h: number, a = 0.32) {
  const len = shadowLen(l) * h, dir = -litSide(l);
  ctx.beginPath();
  ctx.ellipse(x + dir * len * 0.45, y + 1, w * 0.6 + len * 0.5, Math.max(1.5, w * 0.17), 0, 0, Math.PI * 2);
  ctx.fillStyle = hexA(l.shade, a * b.alpha); ctx.fill();
}

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ rośliny i skały w świetle

function broadleafLit(ctx: Ctx, b: Brush, l: Look, x: number, y: number, s: number, r: () => number) {
  const h = (52 + r() * 26) * s, cw = 13 * s, side = litSide(l);
  castShadow(ctx, b, l, x, y, cw * 1.7, h);
  // pień z jasną krawędzią od słońca
  ctx.beginPath(); ctx.moveTo(x - 3 * s, y); ctx.quadraticCurveTo(x - 1 * s, y - h * 0.5, x - 2 * s, y - h * 0.8);
  ctx.lineTo(x + 2 * s, y - h * 0.8); ctx.quadraticCurveTo(x + 1 * s, y - h * 0.5, x + 3 * s, y); ctx.closePath();
  wash(ctx, b, l.bark, 0.9); ink(ctx, b, 1);
  ctx.beginPath(); ctx.moveTo(x + side * 1.8 * s, y - 2 * s); ctx.lineTo(x + side * 1.2 * s, y - h * 0.62);
  ctx.strokeStyle = hexA(mix(l.bark, l.sun.color, 0.55), 0.9 * b.alpha); ctx.lineWidth = 1.1 * s; ctx.stroke();
  // korona z kilku kęp
  const cx = x, cy = y - h * 0.84;
  const blobs: { x: number; y: number; r: number; a: number }[] = [];
  for (let q = 0; q < 7; q++) {
    const a = (q / 7) * TAU + r() * 0.3;
    blobs.push({ x: cx + Math.cos(a) * 11 * s, y: cy + Math.sin(a) * 8 * s, r: (12 + r() * 5) * s, a });
  }
  blobs.push({ x: cx + (r() - 0.5) * 6 * s, y: cy - 9 * s, r: 11 * s, a: -Math.PI / 2 });
  const crown = () => { ctx.beginPath(); blobs.forEach((o) => { ctx.moveTo(o.x + o.r, o.y); ctx.arc(o.x, o.y, o.r, 0, TAU); }); };
  crown(); ctx.fillStyle = hexA(l.leaf, 0.96 * b.alpha); ctx.fill();
  ctx.save(); crown(); ctx.clip();
  const R = 30 * s;
  const gx = ctx.createLinearGradient(cx - side * R, 0, cx + side * R, 0);
  gx.addColorStop(0, hexA(l.leafShade, 0.85)); gx.addColorStop(0.45, hexA(l.leafShade, 0));
  gx.addColorStop(0.55, hexA(l.leafLit, 0)); gx.addColorStop(1, hexA(l.leafLit, 0.9));
  ctx.fillStyle = gx; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  const gy = ctx.createLinearGradient(0, cy - 4 * s, 0, cy + 22 * s);
  gy.addColorStop(0, hexA(l.leafShade, 0)); gy.addColorStop(1, hexA(l.leafShade, 0.7));
  ctx.fillStyle = gy; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  leafDabs(ctx, l, cx, cy, 22 * s, 16 * s, s, r);
  ctx.restore();
  // kontur: tylko zewnętrzne łuki kęp
  ctx.beginPath();
  blobs.forEach((o) => {
    const a = Math.atan2(o.y - cy, o.x - cx);
    ctx.moveTo(o.x + o.r * Math.cos(a - 1), o.y + o.r * Math.sin(a - 1)); ctx.arc(o.x, o.y, o.r, a - 1, a + 1);
  });
  ink(ctx, b, 1);
}

/** Faktura korony: plamki pędzla — jasne od słońca u góry, ciemne w cieniu u dołu. */
function leafDabs(ctx: Ctx, l: Look, cx: number, cy: number, rx: number, ry: number, s: number, r: () => number) {
  const side = litSide(l);
  const lit = mix(l.leafLit, l.sun.color, 0.25);
  for (let q = 0; q < 16; q++) {
    const u = r(), v = r();
    const sunny = u > 0.45;
    const px = cx + (sunny ? side : -side) * (0.15 + 0.85 * u) * rx * (sunny ? 0.9 : 0.8);
    const py = cy + (sunny ? -1 : 1) * v * ry * 0.8;
    ctx.beginPath(); ctx.ellipse(px, py, (2.2 + r() * 2.4) * s, (1.4 + r() * 1.4) * s, (r() - 0.5) * 1.2, 0, TAU);
    ctx.fillStyle = hexA(sunny ? lit : l.leafShade, sunny ? 0.6 : 0.5); ctx.fill();
  }
}

/**
 * Akacja: rozwidlony pień i płaska, szeroka korona w kilku piętrach.
 * Sylwetka sawanny — od razu mówi „kenozoik”.
 */
function acaciaLit(ctx: Ctx, b: Brush, l: Look, x: number, y: number, s: number, r: () => number) {
  const h = (46 + r() * 18) * s, side = litSide(l), span = (30 + r() * 12) * s;
  castShadow(ctx, b, l, x, y, span * 0.9, h * 0.7, 0.3);
  const top = y - h;
  const forkY = y - h * 0.45, lean = (r() - 0.5) * 8 * s;
  // pień i dwa konary
  ctx.beginPath();
  ctx.moveTo(x - 2.4 * s, y); ctx.quadraticCurveTo(x - 1 * s, y - h * 0.3, x + lean - 1.4 * s, forkY);
  ctx.quadraticCurveTo(x + lean - span * 0.25, top + 10 * s, x + lean - span * 0.42, top + 6 * s);
  ctx.lineTo(x + lean - span * 0.36, top + 8 * s);
  ctx.quadraticCurveTo(x + lean - span * 0.18, top + 14 * s, x + lean, forkY - 3 * s);
  ctx.quadraticCurveTo(x + lean + span * 0.2, top + 14 * s, x + lean + span * 0.38, top + 8 * s);
  ctx.lineTo(x + lean + span * 0.44, top + 6 * s);
  ctx.quadraticCurveTo(x + lean + span * 0.25, top + 10 * s, x + lean + 1.4 * s, forkY);
  ctx.quadraticCurveTo(x + 1 * s, y - h * 0.3, x + 2.4 * s, y); ctx.closePath();
  wash(ctx, b, l.bark, 0.92); ink(ctx, b, 0.9);
  // płaska korona: kilka spłaszczonych płatów
  const cx = x + lean, cy = top + 2 * s;
  const pads: { x: number; y: number; rx: number; ry: number }[] = [];
  for (let q = 0; q < 6; q++) {
    const t = q / 5 - 0.5;
    pads.push({ x: cx + t * span * 1.25 + (r() - 0.5) * 6 * s, y: cy + Math.abs(t) * 6 * s + (r() - 0.5) * 3 * s, rx: (13 + r() * 6) * s, ry: (5 + r() * 2.5) * s });
  }
  pads.push({ x: cx + (r() - 0.5) * 8 * s, y: cy - 4 * s, rx: 16 * s, ry: 6 * s });
  const crown = () => { ctx.beginPath(); pads.forEach((o) => { ctx.moveTo(o.x + o.rx, o.y); ctx.ellipse(o.x, o.y, o.rx, o.ry, 0, 0, TAU); }); };
  crown(); ctx.fillStyle = hexA(l.leaf, 0.96 * b.alpha); ctx.fill();
  ctx.save(); crown(); ctx.clip();
  const R = span * 1.1;
  const gy = ctx.createLinearGradient(0, cy - 10 * s, 0, cy + 9 * s);
  gy.addColorStop(0, hexA(l.leafLit, 0.75)); gy.addColorStop(0.5, hexA(l.leafLit, 0)); gy.addColorStop(1, hexA(l.leafShade, 0.75));
  ctx.fillStyle = gy; ctx.fillRect(cx - R, cy - 20 * s, 2 * R, 40 * s);
  const gx = ctx.createLinearGradient(cx - side * R, 0, cx + side * R, 0);
  gx.addColorStop(0, hexA(l.leafShade, 0.5)); gx.addColorStop(0.5, hexA(l.leafShade, 0)); gx.addColorStop(1, hexA(l.sun.color, 0.25));
  ctx.fillStyle = gx; ctx.fillRect(cx - R, cy - 20 * s, 2 * R, 40 * s);
  leafDabs(ctx, l, cx, cy, span * 0.7, 6 * s, s, r);
  ctx.restore();
  // kontur: górne łuki płatów i ciemniejsza linia spodu korony
  ctx.beginPath();
  pads.forEach((o) => { ctx.moveTo(o.x - o.rx, o.y); ctx.ellipse(o.x, o.y, o.rx, o.ry, 0, Math.PI, TAU); });
  ink(ctx, b, 0.9);
  ctx.beginPath(); ctx.moveTo(cx - span * 0.75, cy + 5 * s); ctx.quadraticCurveTo(cx, cy + 9 * s, cx + span * 0.75, cy + 5 * s);
  ink(ctx, b, 0.7, 0.6);
}

function coniferLit(ctx: Ctx, b: Brush, l: Look, x: number, y: number, s: number, r: () => number) {
  const h = (62 + r() * 28) * s, side = litSide(l);
  castShadow(ctx, b, l, x, y, 12 * s, h, 0.3);
  ctx.beginPath(); ctx.moveTo(x - 2 * s, y); ctx.lineTo(x - 1 * s, y - h * 0.2); ctx.lineTo(x + 1 * s, y - h * 0.2); ctx.lineTo(x + 2 * s, y); ctx.closePath();
  wash(ctx, b, l.bark, 0.9); ink(ctx, b, 0.9);
  for (let t = 0; t < 4; t++) {
    const top = y - h * (0.44 + t * 0.19), bot = y - h * (0.12 + t * 0.19), w = (16 - t * 3.2) * s;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + w, bot); ctx.lineTo(x - w, bot); ctx.closePath();
    wash(ctx, b, l.conifer, 0.96);
    // połowa od słońca jaśniejsza, druga w cieniu
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + side * w, bot); ctx.lineTo(x + side * w * 0.1, bot); ctx.closePath();
    wash(ctx, b, mix(l.conifer, l.leafLit, 0.55), 0.6);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x - side * w, bot); ctx.lineTo(x - side * w * 0.1, bot); ctx.closePath();
    wash(ctx, b, l.leafShade, 0.45);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + w, bot); ctx.lineTo(x - w, bot); ctx.closePath(); ink(ctx, b, 0.8);
    if (l.snow > 0) {
      // śnieg na górnych krawędziach pięter
      ctx.beginPath(); ctx.moveTo(x - w * 0.55, top + (bot - top) * 0.55); ctx.lineTo(x, top + 1); ctx.lineTo(x + w * 0.55, top + (bot - top) * 0.55);
      ctx.strokeStyle = hexA('#f7f9fa', 0.95 * b.alpha); ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round'; ctx.stroke();
    }
  }
}

/** Bezlistne drzewo (zima epoki lodowcowej): rozgałęzienia kory. */
function bareTreeLit(ctx: Ctx, b: Brush, l: Look, x: number, y: number, s: number, r: () => number) {
  const h = (52 + r() * 22) * s;
  castShadow(ctx, b, l, x, y, 9 * s, h, 0.22);
  const col = hexA(mix(l.bark, b.th.ink, 0.3), 0.95 * b.alpha);
  const branch = (px: number, py: number, ang: number, len: number, w: number, d: number) => {
    const ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len;
    const bend = (r() - 0.5) * len * 0.3;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo((px + ex) / 2 + bend, (py + ey) / 2, ex, ey);
    ctx.strokeStyle = col; ctx.lineWidth = w * b.line; ctx.lineCap = 'round'; ctx.stroke();
    if (d < 4) {
      const n = d === 0 ? 3 : 2;
      for (let q = 0; q < n; q++) branch(ex, ey, ang + (q - (n - 1) / 2) * (0.5 + r() * 0.3), len * (0.62 + r() * 0.12), w * 0.62, d + 1);
    }
  };
  branch(x, y, -Math.PI / 2, h * 0.42, 3.4 * s, 0);
}

function shrubLit(ctx: Ctx, b: Brush, l: Look, x: number, y: number, s: number, r: () => number) {
  const side = litSide(l);
  castShadow(ctx, b, l, x, y, 12 * s, 12 * s, 0.28);
  const dome = () => { ctx.beginPath(); ctx.ellipse(x, y - 6 * s, 12 * s, 8 * s, 0, Math.PI, 0); ctx.closePath(); };
  dome(); wash(ctx, b, l.leaf, 0.95);
  ctx.save(); dome(); ctx.clip();
  const g = ctx.createLinearGradient(x - side * 12 * s, 0, x + side * 12 * s, 0);
  g.addColorStop(0, hexA(l.leafShade, 0.8)); g.addColorStop(1, hexA(l.leafLit, 0.8));
  ctx.fillStyle = g; ctx.fillRect(x - 13 * s, y - 15 * s, 26 * s, 16 * s);
  ctx.restore();
  dome(); ink(ctx, b, 0.9);
  if (l.flowers) {
    ctx.fillStyle = hexA('#d98fa8', 0.95 * b.alpha);
    for (let q = 0; q < 5; q++) { ctx.beginPath(); ctx.arc(x + (r() - 0.5) * 16 * s, y - 3 * s - r() * 8 * s, 1.4 * s, 0, TAU); ctx.fill(); }
  }
}

function rockLit(ctx: Ctx, b: Brush, l: Look, x: number, y: number, s: number, r: () => number) {
  const side = litSide(l);
  const w = (7 + r() * 6) * s, h = (5 + r() * 4) * s;
  castShadow(ctx, b, l, x, y, w * 1.2, h, 0.3);
  const pts = [[-w, 0], [-w * 0.8, -h * 0.6], [-w * 0.2, -h], [w * 0.5, -h * 0.8], [w, -h * 0.2], [w * 0.9, 0]];
  ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py))); ctx.closePath();
  wash(ctx, b, mix('#9a958a', l.groundFar, 0.25), 0.95);
  // jasna ściana od słońca
  ctx.beginPath(); ctx.moveTo(x - w * 0.2, y - h); ctx.lineTo(x + side * w * 0.5, y - h * 0.8); ctx.lineTo(x + side * w, y - h * 0.2); ctx.lineTo(x + side * w * 0.2, y - h * 0.3); ctx.closePath();
  wash(ctx, b, l.lit, 0.55);
  ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py))); ctx.closePath(); ink(ctx, b, 0.9);
  if (l.snow > 0) {
    ctx.beginPath(); ctx.moveTo(x - w * 0.7, y - h * 0.65); ctx.lineTo(x - w * 0.2, y - h); ctx.lineTo(x + w * 0.5, y - h * 0.8);
    ctx.strokeStyle = hexA('#f7f9fa', 0.95 * b.alpha); ctx.lineWidth = 1.8 * s; ctx.stroke();
  }
}

function grassLit(ctx: Ctx, b: Brush, l: Look, x: number, y: number, s: number, r: () => number) {
  const side = litSide(l);
  ctx.beginPath();
  for (let q = -3; q <= 3; q++) {
    const h = (6 + r() * 7) * s;
    ctx.moveTo(x + q * 1.2 * s, y); ctx.quadraticCurveTo(x + q * 1.5 * s, y - h * 0.6, x + q * 2.8 * s, y - h);
  }
  ctx.strokeStyle = hexA(l.grass, 0.95 * b.alpha); ctx.lineWidth = 1 * b.line; ctx.stroke();
  // dwa źdźbła od słońca w świetle
  ctx.beginPath();
  for (let q = 1; q <= 2; q++) {
    const h = (7 + r() * 6) * s, bx = x + side * q * 1.4 * s;
    ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + side * 1.5 * s, y - h * 0.6, bx + side * 3 * s, y - h);
  }
  ctx.strokeStyle = hexA(mix(l.grass, l.lit, 0.6), 0.95 * b.alpha); ctx.stroke();
}

function cloudLit(ctx: Ctx, l: Look, x: number, y: number, s: number, r: () => number) {
  const side = litSide(l);
  const parts = 5 + Math.floor(r() * 4), wide = 50 + r() * 50, tall = 0.6 + r() * 0.7;
  const blobs: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < parts; i++) {
    const t = i / (parts - 1), hump = Math.sin(t * Math.PI);
    blobs.push({ x: x + (t - 0.5) * wide * s + (r() - 0.5) * 8 * s, y: y - hump * (5 + r() * 10) * tall * s, r: (6 + hump * 11 * tall + r() * 5) * s });
  }
  const body = () => { ctx.beginPath(); blobs.forEach((o) => { ctx.moveTo(o.x + o.r, o.y); ctx.arc(o.x, o.y, o.r, 0, TAU); }); };
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 80 * s, y - 60 * s, 160 * s, 60 * s + 4 * s); ctx.clip(); // płaska podstawa chmury
  body(); ctx.fillStyle = hexA(l.cloud, 0.94); ctx.fill();
  body(); ctx.clip();
  const gy = ctx.createLinearGradient(0, y - 22 * s, 0, y + 4 * s);
  gy.addColorStop(0, hexA(l.cloudShade, 0)); gy.addColorStop(1, hexA(l.cloudShade, 0.75));
  ctx.fillStyle = gy; ctx.fillRect(x - 80 * s, y - 60 * s, 160 * s, 64 * s);
  const gx = ctx.createLinearGradient(x + side * 40 * s, 0, x - side * 40 * s, 0);
  gx.addColorStop(0, hexA(l.sun.color, 0.55)); gx.addColorStop(0.5, hexA(l.sun.color, 0)); gx.addColorStop(1, hexA(l.cloudShade, 0.35));
  ctx.fillStyle = gx; ctx.fillRect(x - 80 * s, y - 60 * s, 160 * s, 64 * s);
  ctx.restore();
}

// ------------------------------------------------------------------ warstwy

/** Niebo z poświatą słońca i mgiełką nad horyzontem (cała szerokość sceny, bez przewijania). */
export function paintSkyLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay } = a;
  const W = lay.W, H = lay.H, hz = lay.floorY;
  const { c, ctx } = canvasOf(W, H, a.res);
  const g = ctx.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, l.skyTop); g.addColorStop(0.55, mix(l.skyTop, l.skyHorizon, 0.55)); g.addColorStop(1, l.skyHorizon);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const sx = l.sun.x * W, sy = l.sun.y * H, R = Math.max(W, H) * 0.62;
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
  glow.addColorStop(0, hexA(l.sun.color, l.sun.glow)); glow.addColorStop(0.22, hexA(l.sun.color, l.sun.glow * 0.45)); glow.addColorStop(1, hexA(l.sun.color, 0));
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  if (l.sun.disk > 0) {
    const d = ctx.createRadialGradient(sx, sy, 0, sx, sy, 18);
    d.addColorStop(0, hexA('#ffffff', l.sun.disk)); d.addColorStop(0.55, hexA(l.sun.color, l.sun.disk * 0.9)); d.addColorStop(1, hexA(l.sun.color, 0));
    ctx.fillStyle = d; ctx.fillRect(sx - 20, sy - 20, 40, 40);
  }
  const mt = hz - H * 0.28;
  const mist = ctx.createLinearGradient(0, mt, 0, hz);
  mist.addColorStop(0, hexA(l.haze, 0)); mist.addColorStop(1, hexA(l.haze, 0.8));
  ctx.fillStyle = mist; ctx.fillRect(0, mt, W, hz - mt + 2);
  return c;
}

/** Wysokość pasa chmur (płótno chmur nie sięga gruntu — mniej do przerysowania co klatkę). */
export function cloudBand(lay: { floorY: number }): number { return Math.ceil(lay.floorY * 0.8); }

/** Chmury (osobny pas, który powoli dryfuje): jasna strona od słońca, cień od spodu. */
export function paintCloudsLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, tileW } = a;
  const { c, ctx } = canvasOf(tileW, cloudBand(lay), a.res);
  const r = rng(a.seed ^ 0xc1);
  const k = lay.H / 300;
  // smugi przy horyzoncie (rozmyte, w tonie mgiełki)
  ctx.filter = 'blur(' + (1.5 * a.res).toFixed(1) + 'px)';
  for (let q = 0; q < tileW / 160; q++) {
    const x = r() * tileW, y = lay.floorY * (0.5 + r() * 0.22), w = (40 + r() * 90) * k, h = (2 + r() * 2.5) * k;
    wrapped(tileW, x, w, (xx) => { ctx.beginPath(); ctx.ellipse(xx, y, w, h, 0, 0, TAU); ctx.fillStyle = hexA(mix(l.cloud, l.haze, 0.4), 0.5); ctx.fill(); });
  }
  ctx.filter = 'none';
  // cumulusy: wyżej = bliżej i większe, niżej = mniejsze i bardziej płaskie
  const n = Math.max(3, Math.round(tileW / 340));
  for (let q = 0; q < n; q++) {
    const x = (q + r() * 0.8) * (tileW / n);
    const t = r();
    const s = (1.15 - 0.55 * t) * k * (0.75 + r() * 0.45);
    const y = Math.max(36 * s, (0.2 + 0.24 * t) * lay.floorY + 6 * k); // cała chmura w kadrze
    const seed = a.seed * 13 + q;
    wrapped(tileW, x, 90 * s, (xx) => cloudLit(ctx, l, xx, y, s, rng(seed)));
  }
  return c;
}

/** Góry na horyzoncie: ostre grzbiety, ściany od słońca jaśniejsze, mocno zamglone i rozmyte. */
export function paintMountainsLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, tileW, theme } = a;
  const H = lay.H;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0x6d);
  const base = lay.floorY - H * 0.01, peak = H * 0.26;
  const f = [2 + Math.floor(r() * 2), 5 + Math.floor(r() * 3), 13 + Math.floor(r() * 4)];
  const p = [r() * TAU, r() * TAU, r() * TAU];
  const yAt = (x: number) => {
    const u = (x / tileW) * TAU;
    const ridge = (k: number, ph: number) => 1 - Math.abs(Math.sin(u * k / 2 + ph));
    return base - peak * (0.55 * Math.pow(ridge(f[0], p[0]), 1.6) + 0.3 * ridge(f[1], p[1]) + 0.15 * (0.5 + 0.5 * Math.sin(u * f[2] + p[2])));
  };
  ctx.filter = 'blur(' + (1.1 * a.res).toFixed(1) + 'px)';
  const outline = () => { ctx.beginPath(); ctx.moveTo(0, base + 4); for (let x = 0; x <= tileW; x += 3) ctx.lineTo(x, yAt(x)); ctx.lineTo(tileW, base + 4); ctx.closePath(); };
  outline();
  const g = ctx.createLinearGradient(0, base - peak, 0, base);
  g.addColorStop(0, mix(l.mountain, l.skyTop, 0.15)); g.addColorStop(1, mix(l.mountain, l.haze, 0.6));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); outline(); ctx.clip();
  if (l.snowCaps) {
    const sl = base - peak * 0.55;
    const sg = ctx.createLinearGradient(0, base - peak, 0, sl + 8);
    sg.addColorStop(0, hexA('#f8fafb', 0.95)); sg.addColorStop(0.8, hexA('#f8fafb', 0.8)); sg.addColorStop(1, hexA('#f8fafb', 0));
    ctx.fillStyle = sg; ctx.fillRect(0, base - peak - 4, tileW, sl - (base - peak) + 12);
  }
  // ściany: nachylone ku słońcu jaśniejsze, odwrócone ciemniejsze
  const side = litSide(l);
  const litG = ctx.createLinearGradient(0, base - peak, 0, base);
  litG.addColorStop(0, hexA(l.sun.color, 0.5)); litG.addColorStop(1, hexA(l.sun.color, 0));
  const shG = ctx.createLinearGradient(0, base - peak, 0, base);
  shG.addColorStop(0, hexA(l.shade, 0.32)); shG.addColorStop(1, hexA(l.shade, 0));
  // pasy ścinane ukośnie: granica światła i cienia schodzi ze szczytu po skosie, a nie w pionie
  const lit = new Path2D(), sh = new Path2D(), shear = -0.35 * side;
  for (let x = 0; x < tileW; x += 3) {
    const slope = (yAt(x + 2) - yAt(x - 2)) * side, y0 = yAt(x) - 1, hh = base - y0 + 5, path = slope > 0 ? lit : sh;
    path.moveTo(x, y0); path.lineTo(x + 3.4, y0); path.lineTo(x + 3.4 + shear * hh, y0 + hh); path.lineTo(x + shear * hh, y0 + hh); path.closePath();
  }
  ctx.fillStyle = litG; ctx.fill(lit);
  ctx.fillStyle = shG; ctx.fill(sh);
  ctx.restore();
  ctx.filter = 'none';
  ctx.beginPath(); for (let x = 0; x <= tileW; x += 3) (x ? ctx.lineTo(x, yAt(x)) : ctx.moveTo(x, yAt(x)));
  ink(ctx, { th: theme, alpha: 0.22, line: 0.8 }, 1);
  return c;
}

/** Daleki plan: łagodne wzgórza z pasem lasu, przygaszone mgiełką. */
export function paintFarLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, tileW, theme } = a;
  const H = lay.H, k = H / 300;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0xfa);
  const base = lay.floorY + 3, hillH = H * 0.075;
  const f1 = 2 + Math.floor(r() * 2), f2 = 6 + Math.floor(r() * 3);
  const yAt = (x: number) => base - hillH * (0.5 + 0.35 * Math.sin((x / tileW) * TAU * f1 + 1) + 0.15 * Math.sin((x / tileW) * TAU * f2));
  ctx.filter = 'blur(' + (0.6 * a.res).toFixed(1) + 'px)';
  ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= tileW; x += 4) ctx.lineTo(x, yAt(x)); ctx.lineTo(tileW, H); ctx.closePath();
  const g = ctx.createLinearGradient(0, base - hillH, 0, base);
  g.addColorStop(0, mix(l.hill, l.haze, 0.25)); g.addColorStop(1, mix(l.hill, l.haze, 0.5));
  ctx.fillStyle = g; ctx.fill();
  // pas lasu na grzbietach: korony w tonie dali, jaśniejsze od słońca
  const side = litSide(l);
  const tree = mix(l.treeFar, l.haze, 0.3), treeLit = mix(tree, l.sun.color, 0.4);
  for (let x = 0; x < tileW; x += (7 + r() * 12) * k) {
    if (r() < 0.25) continue; // prześwity w lesie
    const y = yAt(x) + 3 * k;
    const conifer = r() < (l.snow > 0 ? 0.6 : 0.25);
    const h = (12 + r() * 8) * k, rr = (4 + r() * 4) * k;
    wrapped(tileW, x, 14 * k, (xx) => {
      if (conifer) {
        const w = 3.4 * k;
        ctx.beginPath(); ctx.moveTo(xx, y - h); ctx.lineTo(xx + w, y); ctx.lineTo(xx - w, y); ctx.closePath();
        ctx.fillStyle = hexA(mix(tree, l.leafShade, 0.25), 0.95); ctx.fill();
        ctx.beginPath(); ctx.moveTo(xx, y - h); ctx.lineTo(xx + side * w, y); ctx.lineTo(xx, y); ctx.closePath();
        ctx.fillStyle = hexA(treeLit, 0.45); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(xx, y - rr, rr, 0, TAU); ctx.fillStyle = hexA(tree, 0.95); ctx.fill();
        ctx.beginPath(); ctx.arc(xx + side * rr * 0.35, y - rr * 1.25, rr * 0.55, 0, TAU); ctx.fillStyle = hexA(treeLit, 0.55); ctx.fill();
      }
    });
  }
  ctx.filter = 'none';
  ctx.beginPath(); for (let x = 0; x <= tileW; x += 4) (x ? ctx.lineTo(x, yAt(x)) : ctx.moveTo(x, yAt(x)));
  ink(ctx, { th: theme, alpha: 0.3, line: 0.8 }, 1);
  // mgła u podstawy
  const mist = ctx.createLinearGradient(0, base - 16 * k, 0, base + 4);
  mist.addColorStop(0, hexA(l.haze, 0)); mist.addColorStop(1, hexA(l.haze, 0.55));
  ctx.fillStyle = mist; ctx.fillRect(0, base - 16 * k, tileW, 20 * k + 4);
  return c;
}

/** Środkowy plan: grunt w perspektywie, tylny rząd drzew z cieniami, trawy rosnące ku widzowi. */
export function paintMidLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, theme, tileW } = a;
  const H = lay.H, top = lay.floorY, k = H / 300;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0x3d);
  const b: Brush = { th: theme, alpha: 1, line: 1 };
  const yAt = (x: number) => top + 1.6 * Math.sin((x / tileW) * TAU * 7) + 1.2 * Math.sin((x / tileW) * TAU * 3);
  const ground = () => { ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= tileW; x += 5) ctx.lineTo(x, yAt(x)); ctx.lineTo(tileW, H); ctx.closePath(); };
  ground();
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, l.groundFar); g.addColorStop(1, l.groundNear);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ground(); ctx.clip();
  // plamy światła i cienia (akwarela), spłaszczone perspektywą: dalej mniejsze
  for (let q = 0; q < tileW / 12; q++) {
    const t = r(), x = r() * tileW, y = top + 3 + t * (H - top);
    const rx = (12 + r() * 46) * (0.35 + t), ry = rx * (0.1 + 0.08 * t);
    const col = r() < 0.55 ? l.lit : l.shade, al = col === l.lit ? 0.12 + r() * 0.14 : 0.08 + r() * 0.1;
    wrapped(tileW, x, rx, (xx) => { ctx.beginPath(); ctx.ellipse(xx, y, rx, ry, 0, 0, TAU); ctx.fillStyle = hexA(col, al); ctx.fill(); });
  }
  // płaty śniegu (zimno)
  for (let q = 0; q < (tileW / 26) * l.snow; q++) {
    const t = r(), x = r() * tileW, y = top + 4 + t * (H - top);
    const rx = (8 + r() * 30) * (0.35 + t), ry = rx * (0.12 + 0.08 * t);
    wrapped(tileW, x, rx, (xx) => {
      ctx.beginPath(); ctx.ellipse(xx, y, rx, ry, 0, 0, TAU); ctx.fillStyle = hexA('#f6f8f9', 0.8); ctx.fill();
      ctx.beginPath(); ctx.ellipse(xx - litSide(l) * rx * 0.15, y + ry * 0.35, rx * 0.8, ry * 0.5, 0, 0, Math.PI); ctx.fillStyle = hexA(l.shade, 0.18); ctx.fill();
    });
  }
  // kreskowanie: rzadsze bliżej widza (perspektywa)
  ctx.beginPath();
  for (let y = top + 5; y < H; y += 4 + ((y - top) / (H - top)) * 8) {
    const t = (y - top) / (H - top), len = 3 + t * 6;
    for (let x = r() * 12; x < tileW; x += 10 + r() * 16 + t * 14) { ctx.moveTo(x, y); ctx.lineTo(x + len, y + len * 0.3); }
  }
  ink(ctx, b, 0.5, 0.14);
  ctx.restore();
  ctx.beginPath(); for (let x = 0; x <= tileW; x += 5) (x ? ctx.lineTo(x, yAt(x)) : ctx.moveTo(x, yAt(x))); ink(ctx, b, 1, 0.55);

  // tylny rząd przy horyzoncie (zwierzęta zawsze przed nim): gaje drzew o różnej
  // wielkości na przemian z otwartą sawanną — samotne akacje, krzewy, skały
  type Item = { x: number; y: number; s: number; kind: number; seed: number };
  const items: Item[] = [];
  const groves = Math.max(2, Math.round(tileW / 380));
  for (let g = 0; g < groves; g++) {
    const gx = (g + 0.15 + r() * 0.5) * (tileW / groves), n = 2 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const pick = r();
      const kind = l.snow > 0 ? (pick < 0.55 ? 1 : pick < 0.55 + 0.45 * l.bare ? 2 : 0) : (pick < 0.62 ? 0 : 1);
      items.push({ x: gx + (i - n / 2) * (16 + r() * 14) * k, y: yAt(gx) + 1 + r() * 8 * k, s: (0.75 + r() * 0.65) * k, kind, seed: a.seed * 31 + g * 10 + i });
    }
    for (let i = 0; i < 3; i++) items.push({ x: gx + (r() - 0.5) * n * 26 * k, y: yAt(gx) + 6 * k + r() * 5 * k, s: (0.7 + r() * 0.4) * k, kind: 4, seed: a.seed * 53 + g * 10 + i });
  }
  for (let q = 0; q < tileW / 90; q++) {
    const pick = r(), x = r() * tileW;
    const kind = pick < 0.3 ? (l.snow > 0 ? 2 : 3) : pick < 0.55 ? 4 : pick < 0.75 ? 5 : 6;
    items.push({ x, y: yAt(x) + 2 + r() * 10 * k, s: (0.7 + r() * 0.5) * k, kind, seed: a.seed * 71 + q });
  }
  items.sort((p, q) => p.y - q.y); // dalsze najpierw
  for (const it of items) {
    wrapped(tileW, it.x, 70 * it.s, (xx) => {
      const rr = rng(it.seed);
      switch (it.kind) {
        case 0: broadleafLit(ctx, b, l, xx, it.y, it.s, rr); break;
        case 1: coniferLit(ctx, b, l, xx, it.y, it.s, rr); break;
        case 2: bareTreeLit(ctx, b, l, xx, it.y, it.s, rr); break;
        case 3: acaciaLit(ctx, b, l, xx, it.y, it.s, rr); break;
        case 4: shrubLit(ctx, b, l, xx, it.y, it.s, rr); break;
        case 5: rockLit(ctx, b, l, xx, it.y, it.s, rr); break;
        default: if (l.flowers) wildflowers(ctx, b, xx, it.y, 1.1 * it.s, rr); else grassLit(ctx, b, l, xx, it.y, 1.2 * it.s, rr);
      }
    });
  }
  // trawy, kwiaty i kamyki na całym gruncie, w skupiskach, większe bliżej widza
  const patches = Array.from({ length: Math.round(tileW / 60) }, () => ({ x: r() * tileW, t: Math.pow(r(), 0.8) }));
  for (let q = 0; q < tileW / 11; q++) {
    const pt = patches[q % patches.length];
    const t = Math.max(0, Math.min(1, pt.t + (r() - 0.5) * 0.25)), x = pt.x + (r() - 0.5) * (30 + 60 * t), y = top + 8 + t * (H - top - 8);
    const s = (0.5 + 0.95 * t) * k, gs = a.seed * 97 + q, pick = r();
    wrapped(tileW, x, 12 * s, (xx) => {
      if (pick < 0.82) grassLit(ctx, b, l, xx, y, s, rng(gs));
      else if (pick < 0.92 && l.flowers) wildflowers(ctx, b, xx, y, 0.8 * s, rng(gs));
      else rockLit(ctx, b, l, xx, y, 0.45 * s, rng(gs));
    });
  }
  return c;
}

/** Światło na gruncie: ciepła plama od strony słońca, chłodniejszy cień po przeciwnej (cała szerokość sceny). */
export function paintLightLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay } = a;
  const W = lay.W, H = lay.H, top = lay.floorY - 8;
  const { c, ctx } = canvasOf(W, H, a.res);
  const sx = l.sun.x * W;
  const g = ctx.createRadialGradient(sx, top + (H - top) * 0.2, 0, sx, top + (H - top) * 0.2, W * 0.7);
  g.addColorStop(0, hexA(l.lit, 0.24)); g.addColorStop(1, hexA(l.lit, 0));
  ctx.fillStyle = g; ctx.fillRect(0, top, W, H - top);
  const side = litSide(l);
  const gs = ctx.createLinearGradient(side > 0 ? 0 : W, 0, W / 2, 0);
  gs.addColorStop(0, hexA(l.shade, 0.16)); gs.addColorStop(1, hexA(l.shade, 0));
  ctx.fillStyle = gs; ctx.fillRect(0, top, W, H - top);
  return c;
}

/** Pierwszy plan: duże, ciemne kępy traw pod światło, rozmyte (głębia ostrości). */
export function paintNearLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, tileW } = a;
  const H = lay.H, k = H / 300;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0x77);
  ctx.filter = 'blur(' + (2.2 * a.res).toFixed(1) + 'px)';
  const dark = mix(l.frame, l.grass, 0.35), rim = mix(l.grass, l.lit, 0.5);
  const n = Math.max(3, Math.round(tileW / 300));
  for (let q = 0; q < n; q++) {
    const x = (q + r() * 0.6) * (tileW / n);
    const seed = a.seed * 7 + q;
    wrapped(tileW, x, 60 * k, (xx) => {
      const rr = rng(seed);
      for (let i = 0; i < 12; i++) {
        const bx = xx + (rr() - 0.5) * 34 * k, h = (22 + rr() * 30) * k, lean = (rr() - 0.5) * 26 * k;
        ctx.beginPath(); ctx.moveTo(bx - 2.2 * k, H + 4); ctx.quadraticCurveTo(bx + lean * 0.3, H - h * 0.6, bx + lean, H - h);
        ctx.quadraticCurveTo(bx + lean * 0.3 + 1.5 * k, H - h * 0.55, bx + 2.2 * k, H + 4); ctx.closePath();
        ctx.fillStyle = hexA(i % 4 === 0 ? rim : dark, 0.92); ctx.fill();
      }
    });
  }
  return c;
}

/**
 * Rama kadru (nad zwierzętami, bez przewijania): kępy wysokich traw w obu
 * dolnych rogach, ciemne, pod światło i rozmyte — jak pierwszy plan gabloty.
 */
export function paintFrameLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay } = a;
  const W = lay.W, H = lay.H, k = H / 300;
  const { c, ctx } = canvasOf(W, H, a.res);
  const r = rng(a.seed ^ 0x51);
  const leafRim = mix(l.leafLit, l.sun.color, 0.3);
  ctx.filter = 'blur(' + (2.4 * a.res).toFixed(1) + 'px)';
  // kępy traw w dolnych rogach; źdźbła pochylone ku środkowi kadru, krawędź od słońca podświetlona
  const clump = (cx: number, toward: number, n: number, tall: number) => {
    for (let i = 0; i < n; i++) {
      const bx = cx + (r() - 0.5) * 40 * k, h = (tall * 0.5 + r() * tall) * k, lean = toward * (4 + r() * 26) * k;
      ctx.beginPath(); ctx.moveTo(bx - 2.4 * k, H + 4); ctx.quadraticCurveTo(bx + lean * 0.3, H - h * 0.6, bx + lean, H - h);
      ctx.quadraticCurveTo(bx + lean * 0.3 + 1.6 * k, H - h * 0.55, bx + 2.4 * k, H + 4); ctx.closePath();
      ctx.fillStyle = hexA(i % 5 === 0 ? mix(l.grass, leafRim, 0.45) : i % 3 === 0 ? mix(l.frame, l.grass, 0.3) : l.frame, 0.94); ctx.fill();
    }
  };
  clump(-6 * k, 1, 12, 52);
  clump(W + 4 * k, -1, 16, 62);
  return c;
}

/**
 * Ziarno papieru na sklejonej warstwie (płótno bez skalowania, w pikselach urządzenia):
 * spina malowane warstwy w jedną ilustrację. Zwierzęta zostają czyste.
 */
export function paintGrain(ctx: Ctx, w: number, h: number, yFrom: number, res: number, theme: { dark: boolean; ink: string }, seed: number) {
  const r = rng(seed), grain = theme.dark ? '#ffffff' : theme.ink, sz = Math.max(1, res);
  for (let i = 0; i < (w * (h - yFrom)) / (50 * res * res); i++) {
    ctx.fillStyle = hexA(grain, 0.02 + r() * 0.03);
    ctx.fillRect(r() * w, yFrom + r() * (h - yFrom), sz * (0.5 + r() * 0.6), sz * (0.5 + r() * 0.6));
  }
}

/** Snop światła od słońca: miękki na obu końcach (wychodzi z poświaty, gaśnie nad gruntem). */
export function paintSunRay(res: number): HTMLCanvasElement {
  const { c, ctx } = canvasOf(40, 200, res);
  const gv = ctx.createLinearGradient(0, 0, 0, 200);
  gv.addColorStop(0, 'rgba(255,248,225,0)'); gv.addColorStop(0.22, 'rgba(255,248,225,0.5)');
  gv.addColorStop(0.6, 'rgba(255,248,225,0.22)'); gv.addColorStop(1, 'rgba(255,248,225,0)');
  ctx.fillStyle = gv;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(26, 0); ctx.lineTo(40, 200); ctx.lineTo(0, 200); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'destination-in';
  const gh = ctx.createLinearGradient(0, 0, 40, 0);
  gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.5, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gh; ctx.fillRect(0, 0, 40, 200);
  return c;
}

/** Miękki cień pod zwierzęciem (biały — barwę nadaje tint sprite'a). */
export function paintShadowBlob(res: number): HTMLCanvasElement {
  const { c, ctx } = canvasOf(64, 16, res);
  ctx.translate(32, 8); ctx.scale(1, 0.25);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU); ctx.fill();
  return c;
}
