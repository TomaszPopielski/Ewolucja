/*
 * scenery.ts — wspólne podstawy dioramy: układ sceny (gdzie grunt, dno,
 * powierzchnia i pas, w którym porusza się stado), pędzle w stylu tusz + ton
 * oraz rysunki roślin i drobnej fauny ery — paleozoik (liliowce, gąbki,
 * trylobity, lepidodendrony, skrzypy), mezozoik (amonity, koralowce, araukarie,
 * sagowce), kenozoik (kelp, rozgwiazdy, trawa morska, kwiaty).
 * Warstwy scen ze światłem malują przepisy lit-land.ts, lit-water.ts i lit-air.ts.
 */
import { rng } from '../creature/spec.ts';
import type { Theme } from '../creature/draw.ts';

export type Era = 'paleozoik' | 'mezozoik' | 'kenozoik';
export type NicheKey = 'woda' | 'przybrzeze' | 'lad' | 'powietrze';
type Ctx = CanvasRenderingContext2D;

/** Geometria sceny wspólna dla malowania i ruchu zwierząt. */
export interface SceneLayout {
  W: number; H: number;
  /** Linia powierzchni wody (woda/przybrzeże). */
  surfaceY: number;
  /** Dno albo grunt (tu stoją/pływają przy dnie zwierzęta). */
  floorY: number;
  /** Zakres wysokości, w którym porusza się populacja. */
  lifeTop: number; lifeBottom: number;
}

/**
 * Układ sceny: grunt (dno) w perspektywie zajmuje dolną część kadru, a stado
 * rozkłada się w głąb — na lądzie ok. 40% kadru, w wodzie dno od 80% wysokości.
 */
export function sceneLayout(niche: NicheKey, W: number, H: number): SceneLayout {
  switch (niche) {
    case 'woda': return { W, H, surfaceY: 10, floorY: Math.round(H * 0.8), lifeTop: 34, lifeBottom: H - 30 };
    case 'przybrzeze': {
      const surfaceY = Math.round(H * 0.3);
      return { W, H, surfaceY, floorY: Math.round(H * 0.82), lifeTop: surfaceY + 20, lifeBottom: H - 28 };
    }
    case 'lad': {
      const floorY = Math.round(H * 0.6);
      // pas stada nigdy węższy niż 42 px (ważne w niskich scenach)
      return { W, H, surfaceY: -1, floorY, lifeTop: Math.min(floorY + Math.round(H * 0.08), H - 54), lifeBottom: H - 12 };
    }
    // powietrze: floorY = dolny brzeg nieba nad krajobrazem w dole
    default: return { W, H, surfaceY: -1, floorY: Math.round(H * 0.8), lifeTop: 22, lifeBottom: Math.round(H * 0.7) };
  }
}

// ------------------------------------------------------------------ pędzle

export function hexA(hex: string, a: number): string {
  if (!hex.startsWith('#')) return hex;
  const p = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((p >> 16) & 255) + ',' + ((p >> 8) & 255) + ',' + (p & 255) + ',' + a.toFixed(3) + ')';
}
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (sh: number) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t);
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}

export interface Brush { th: Theme; alpha: number; line: number }
export function ink(ctx: Ctx, b: Brush, w = 1, a = 1) {
  ctx.strokeStyle = hexA(b.th.ink, b.alpha * a * 0.9);
  ctx.lineWidth = w * b.line; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
}
export function wash(ctx: Ctx, b: Brush, color: string, a = 0.5) {
  ctx.fillStyle = hexA(color, a * b.alpha); ctx.fill();
}

/** Rysuje element także „po drugiej stronie” kafla, jeśli wystaje poza krawędź. */
export function wrapped(tileW: number, x: number, reach: number, fn: (x: number) => void) {
  fn(x);
  if (x - reach < 0) fn(x + tileW);
  if (x + reach > tileW) fn(x - tileW);
}

const C = {
  horn: '#a8834f', coral: '#cf7f69', ochre: '#c9a060', olive: '#7f8a3f', moss: '#7a8c45',
  fern: '#6f9a58', bark: '#8a6f55', sand: '#cdb88f', rock: '#9a958a', leaf: '#6f9150', flower: '#d59ab0'
};

// ------------------------------------------------------------------ fauna i flora dna

export function crinoid(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const h = (34 + r() * 22) * s, bend = (r() - 0.5) * 12 * s;
  const top = { x: x + bend, y: y - h };
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + bend * 0.2, y - h * 0.5, top.x, top.y);
  ink(ctx, b, 1.6);
  // segmenty łodygi
  ctx.beginPath();
  for (let q = 1; q < 8; q++) { const t = q / 8; const px = x + bend * t * t, py = y - h * t; ctx.moveTo(px - 1.3 * s, py); ctx.lineTo(px + 1.3 * s, py); }
  ink(ctx, b, 0.6, 0.7);
  // kielich i ramiona z pierzastymi wyrostkami
  ctx.beginPath(); ctx.ellipse(top.x, top.y, 3.2 * s, 2.4 * s, 0, 0, Math.PI * 2); wash(ctx, b, C.coral, 0.7); ink(ctx, b, 1);
  for (let a = 0; a < 6; a++) {
    const ang = -Math.PI / 2 + (a - 2.5) * 0.42;
    const len = (12 + r() * 6) * s;
    const ex = top.x + Math.cos(ang) * len, ey = top.y + Math.sin(ang) * len * 0.8 + 5 * s;
    const cx = top.x + Math.cos(ang) * len * 0.8, cy = top.y + Math.sin(ang) * len - 3 * s;
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo(cx, cy, ex, ey); ink(ctx, b, 1);
    ctx.beginPath();
    for (let q = 1; q < 6; q++) {
      const t = q / 6;
      const px = (1 - t) * (1 - t) * top.x + 2 * (1 - t) * t * cx + t * t * ex;
      const py = (1 - t) * (1 - t) * top.y + 2 * (1 - t) * t * cy + t * t * ey;
      ctx.moveTo(px, py); ctx.lineTo(px + 2 * s, py + 2.2 * s);
    }
    ink(ctx, b, 0.6, 0.8);
  }
}

export function sponge(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const w = (7 + r() * 4) * s, h = (16 + r() * 12) * s;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y);
  ctx.bezierCurveTo(x - w * 1.1, y - h * 0.5, x - w * 0.9, y - h, x - w * 0.8, y - h);
  ctx.lineTo(x + w * 0.8, y - h);
  ctx.bezierCurveTo(x + w * 0.9, y - h, x + w * 1.1, y - h * 0.5, x + w * 0.5, y);
  ctx.closePath(); wash(ctx, b, C.ochre, 0.55); ink(ctx, b, 1.1);
  ctx.beginPath(); ctx.ellipse(x, y - h, w * 0.8, 2 * s, 0, 0, Math.PI * 2); wash(ctx, b, '#3a3226', 0.25); ink(ctx, b, 0.9);
  ctx.fillStyle = hexA(b.th.ink, 0.4 * b.alpha);
  for (let q = 0; q < 7; q++) { ctx.beginPath(); ctx.arc(x + (r() - 0.5) * w, y - r() * h * 0.85, 0.7 * s, 0, Math.PI * 2); ctx.fill(); }
}

export function algae(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number, color = C.olive) {
  for (let f = 0; f < 3; f++) {
    const h = (18 + r() * 20) * s, sway = (r() - 0.5) * 10 * s;
    ctx.beginPath(); ctx.moveTo(x + f * 2 * s, y);
    ctx.bezierCurveTo(x + sway, y - h * 0.4, x - sway, y - h * 0.7, x + sway * 0.5 + f * s, y - h);
    ink(ctx, b, 1.2);
    ctx.strokeStyle = hexA(color, 0.8 * b.alpha); ctx.lineWidth = 2.4 * s * b.line; ctx.stroke();
  }
}

export function trilobite(ctx: Ctx, b: Brush, x: number, y: number, s: number) {
  ctx.save(); ctx.translate(x, y - 2.5 * s);
  ctx.beginPath(); ctx.ellipse(0, 0, 7 * s, 3.2 * s, 0, 0, Math.PI * 2); wash(ctx, b, C.horn, 0.6); ink(ctx, b, 0.9);
  ctx.beginPath(); ctx.arc(5 * s, 0, 3.2 * s, -Math.PI / 2, Math.PI / 2); ink(ctx, b, 0.8);
  ctx.beginPath(); for (let q = -3; q <= 2; q++) { ctx.moveTo(q * 1.6 * s, -3 * s); ctx.lineTo(q * 1.6 * s, 3 * s); } ink(ctx, b, 0.5, 0.8);
  ctx.beginPath(); ctx.moveTo(-7 * s, 0); ctx.lineTo(5 * s, 0); ink(ctx, b, 0.5, 0.8);
  ctx.restore();
}

export function ammonite(ctx: Ctx, b: Brush, x: number, y: number, s: number) {
  const R = 6 * s;
  ctx.beginPath(); ctx.arc(x, y - R * 0.85, R, 0, Math.PI * 2); wash(ctx, b, '#c8b08a', 0.7); ink(ctx, b, 1);
  ctx.beginPath();
  for (let a = 0; a < 5.5 * Math.PI; a += 0.2) {
    const rr = R * (1 - a / (6 * Math.PI));
    const px = x + Math.cos(a) * rr, py = y - R * 0.85 + Math.sin(a) * rr;
    if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ink(ctx, b, 0.6, 0.8);
  ctx.beginPath(); for (let q = 0; q < 12; q++) { const a = q * 0.52; ctx.moveTo(x + Math.cos(a) * R * 0.55, y - R * 0.85 + Math.sin(a) * R * 0.55); ctx.lineTo(x + Math.cos(a) * R, y - R * 0.85 + Math.sin(a) * R); }
  ink(ctx, b, 0.45, 0.7);
}

export function coral(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number, color = C.coral) {
  const branch = (px: number, py: number, ang: number, len: number, depth: number) => {
    const ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey);
    ink(ctx, b, 4.2 - depth);
    ctx.strokeStyle = hexA(color, 0.85 * b.alpha); ctx.lineWidth = (2.6 - depth * 0.5) * s * b.line; ctx.stroke();
    if (depth < 3) {
      branch(ex, ey, ang - 0.45 - r() * 0.2, len * 0.72, depth + 1);
      branch(ex, ey, ang + 0.45 + r() * 0.2, len * 0.72, depth + 1);
    }
  };
  branch(x, y, -Math.PI / 2 + (r() - 0.5) * 0.3, 9 * s, 0);
}

export function kelp(ctx: Ctx, b: Brush, x: number, y: number, top: number, s: number, r: () => number) {
  const h = y - top;
  const pts: [number, number][] = [];
  for (let q = 0; q <= 12; q++) { const t = q / 12; pts.push([x + Math.sin(t * 5 + r()) * 6 * s * t, y - h * t]); }
  ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ink(ctx, b, 1.2);
  for (let q = 2; q < 12; q += 1) {
    const [px, py] = pts[q], dir = q % 2 ? 1 : -1;
    ctx.beginPath(); ctx.ellipse(px + dir * 5 * s, py, 6 * s, 2 * s, dir * 0.5, 0, Math.PI * 2);
    wash(ctx, b, C.olive, 0.55); ink(ctx, b, 0.7);
  }
}

export function seastar(ctx: Ctx, b: Brush, x: number, y: number, s: number) {
  ctx.beginPath();
  for (let q = 0; q < 10; q++) {
    const a = -Math.PI / 2 + q * Math.PI / 5, rr = (q % 2 ? 2 : 5.5) * s;
    const px = x + Math.cos(a) * rr, py = y - 2.5 * s + Math.sin(a) * rr * 0.5;
    if (q) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath(); wash(ctx, b, C.coral, 0.7); ink(ctx, b, 0.8);
}

export function rock(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const w = (6 + r() * 10) * s, h = (3 + r() * 5) * s;
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.8, y - h * 1.2, x, y - h);
  ctx.quadraticCurveTo(x + w * 0.9, y - h * 0.9, x + w, y); ctx.closePath();
  wash(ctx, b, C.rock, 0.5); ink(ctx, b, 0.9);
  ctx.beginPath(); for (let q = 0; q < 4; q++) { const hx = x - w * 0.4 + q * w * 0.25; ctx.moveTo(hx, y - 0.5); ctx.lineTo(hx + 2 * s, y - h * 0.5); } ink(ctx, b, 0.5, 0.6);
}

export function stromatolite(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const w = (10 + r() * 8) * s, h = (8 + r() * 6) * s;
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.bezierCurveTo(x - w, y - h * 1.3, x + w, y - h * 1.3, x + w, y); ctx.closePath();
  wash(ctx, b, '#b5a07a', 0.6); ink(ctx, b, 1);
  ctx.beginPath();
  for (let q = 1; q < 4; q++) { const k = q / 4; ctx.moveTo(x - w * (1 - k * 0.3), y - h * k * 0.9); ctx.quadraticCurveTo(x, y - h * (0.4 + k * 0.9), x + w * (1 - k * 0.3), y - h * k * 0.9); }
  ink(ctx, b, 0.5, 0.7);
}

// ------------------------------------------------------------------ flora lądowa

export function lepidodendron(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const h = (80 + r() * 40) * s, w = 4 * s;
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * 0.7, y - h); ctx.lineTo(x + w * 0.7, y - h); ctx.lineTo(x + w, y); ctx.closePath();
  wash(ctx, b, C.bark, 0.5); ink(ctx, b, 1.1);
  // wzór „łusek” pnia
  ctx.beginPath();
  for (let yy = y - 4 * s; yy > y - h; yy -= 5 * s) { ctx.moveTo(x - w * 0.8, yy); ctx.lineTo(x, yy - 2.5 * s); ctx.lineTo(x + w * 0.8, yy); }
  ink(ctx, b, 0.45, 0.7);
  // korona: widlaste gałęzie z pękami liści
  const fork = (px: number, py: number, ang: number, len: number, d: number) => {
    const ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ink(ctx, b, 2 - d * 0.4);
    if (d < 3) { fork(ex, ey, ang - 0.5, len * 0.75, d + 1); fork(ex, ey, ang + 0.5, len * 0.75, d + 1); }
    else {
      ctx.beginPath(); ctx.ellipse(ex, ey + 3 * s, 2.2 * s, 5 * s, ang + Math.PI / 2, 0, Math.PI * 2);
      wash(ctx, b, C.moss, 0.7); ink(ctx, b, 0.6);
    }
  };
  fork(x, y - h, -Math.PI / 2, 12 * s, 0);
}

export function horsetail(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  for (let q = 0; q < 3; q++) {
    const h = (20 + r() * 18) * s, xx = x + (q - 1) * 4 * s;
    ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx + (r() - 0.5) * 3, y - h); ink(ctx, b, 1.1);
    ctx.beginPath();
    for (let k = 1; k < 7; k++) { const yy = y - h * k / 7; ctx.moveTo(xx - 3 * s, yy + 2 * s); ctx.lineTo(xx, yy); ctx.lineTo(xx + 3 * s, yy + 2 * s); }
    ctx.strokeStyle = hexA(C.fern, 0.9 * b.alpha); ctx.lineWidth = 0.8 * b.line; ctx.stroke();
  }
}

export function fern(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  for (let f = 0; f < 5; f++) {
    const ang = -Math.PI / 2 + (f - 2) * 0.45, len = (16 + r() * 10) * s;
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len * 0.8;
    const cx = x + Math.cos(ang) * len * 0.6, cy = y + Math.sin(ang) * len - 4 * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(cx, cy, ex, ey); ink(ctx, b, 0.9);
    ctx.beginPath();
    for (let q = 1; q < 8; q++) {
      const t = q / 8;
      const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex;
      const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey;
      const l = (1 - t) * 4 * s;
      ctx.moveTo(px - l, py - l * 0.6); ctx.lineTo(px, py); ctx.lineTo(px + l, py - l * 0.6);
    }
    ctx.strokeStyle = hexA(C.fern, 0.9 * b.alpha); ctx.lineWidth = 1 * b.line; ctx.stroke();
  }
}

export function araucaria(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const h = (85 + r() * 30) * s;
  ctx.beginPath(); ctx.moveTo(x - 2.5 * s, y); ctx.lineTo(x - 1.2 * s, y - h); ctx.lineTo(x + 1.2 * s, y - h); ctx.lineTo(x + 2.5 * s, y); ctx.closePath();
  wash(ctx, b, C.bark, 0.6); ink(ctx, b, 1);
  for (let t = 0; t < 5; t++) {
    const yy = y - h + t * 6 * s, span = (10 + t * 5) * s;
    ctx.beginPath(); ctx.moveTo(x - span, yy + 3 * s); ctx.quadraticCurveTo(x, yy - 4 * s, x + span, yy + 3 * s);
    ctx.quadraticCurveTo(x, yy + 1 * s, x - span, yy + 3 * s);
    wash(ctx, b, '#4f7a5a', 0.65); ink(ctx, b, 0.8);
  }
}

export function cycad(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const h = (12 + r() * 8) * s;
  ctx.beginPath(); ctx.ellipse(x, y - h / 2, 4 * s, h / 2, 0, 0, Math.PI * 2); wash(ctx, b, C.bark, 0.6); ink(ctx, b, 1);
  ctx.beginPath(); for (let q = 1; q < 5; q++) { ctx.moveTo(x - 3.5 * s, y - h * q / 5); ctx.lineTo(x + 3.5 * s, y - h * q / 5 - 1.5 * s); } ink(ctx, b, 0.5, 0.7);
  for (let f = 0; f < 7; f++) {
    const ang = -Math.PI / 2 + (f - 3) * 0.42, len = (18 + r() * 6) * s;
    const ex = x + Math.cos(ang) * len, ey = y - h + Math.sin(ang) * len * 0.7 + 6 * s;
    ctx.beginPath(); ctx.moveTo(x, y - h); ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.6, y - h + Math.sin(ang) * len - 2 * s, ex, ey);
    ctx.strokeStyle = hexA('#5f8a4a', 0.95 * b.alpha); ctx.lineWidth = 2.6 * s * b.line; ctx.stroke(); ink(ctx, b, 0.6);
  }
}





/** Łodzikowiec: stożkowa muszla z mackami (paleozoik/mezozoik, woda). */
export function nautiloid(ctx: Ctx, b: Brush, x: number, y: number, s: number) {
  ctx.save(); ctx.translate(x, y - 7 * s);
  ctx.beginPath(); ctx.moveTo(-14 * s, 3 * s); ctx.quadraticCurveTo(-4 * s, -9 * s, 6 * s, -5 * s);
  ctx.quadraticCurveTo(11 * s, 0, 6 * s, 6 * s); ctx.quadraticCurveTo(-4 * s, 8 * s, -14 * s, 3 * s); ctx.closePath();
  wash(ctx, b, '#c9a060', 0.6); ink(ctx, b, 1);
  ctx.beginPath();
  for (let q = 1; q < 5; q++) { ctx.moveTo(-14 * s + q * 4.2 * s, 2 * s - q * 0.6 * s); ctx.quadraticCurveTo(-13 * s + q * 4.2 * s, -4 * s, -10 * s + q * 4.2 * s, -6 * s + q * 0.5 * s); }
  ink(ctx, b, 0.55, 0.8);
  ctx.beginPath();
  for (let t = 0; t < 4; t++) { ctx.moveTo(8 * s, -1 * s + t * 2 * s); ctx.quadraticCurveTo(13 * s, t * 2.4 * s, 16 * s, 3 * s + t * 1.6 * s); }
  ink(ctx, b, 0.8);
  ctx.restore();
}

/** Ramienionóg: muszla o dwóch zastawkach na dnie (paleozoik). */
export function brachiopod(ctx: Ctx, b: Brush, x: number, y: number, s: number) {
  ctx.beginPath(); ctx.moveTo(x - 6 * s, y); ctx.quadraticCurveTo(x - 7 * s, y - 9 * s, x, y - 10 * s);
  ctx.quadraticCurveTo(x + 7 * s, y - 9 * s, x + 6 * s, y); ctx.closePath();
  wash(ctx, b, '#b98f6a', 0.6); ink(ctx, b, 1);
  ctx.beginPath(); for (let q = -2; q <= 2; q++) { ctx.moveTo(x + q * 1.9 * s, y - 0.5 * s); ctx.lineTo(x + q * 1.1 * s, y - 9 * s); } ink(ctx, b, 0.5, 0.75);
}

/** Jeżowiec: kolczasta kula (mezozoik/kenozoik, woda). */
export function urchin(ctx: Ctx, b: Brush, x: number, y: number, s: number) {
  const cy = y - 5 * s;
  ctx.beginPath(); for (let q = 0; q < 18; q++) { const a = Math.PI + (q / 17) * Math.PI; ctx.moveTo(x + Math.cos(a) * 5 * s, cy + Math.sin(a) * 5 * s); ctx.lineTo(x + Math.cos(a) * 10 * s, cy + Math.sin(a) * 10 * s); }
  ink(ctx, b, 0.8, 0.9);
  ctx.beginPath(); ctx.ellipse(x, cy, 5.5 * s, 4.5 * s, 0, Math.PI, 0); ctx.closePath(); wash(ctx, b, '#8469ad', 0.55); ink(ctx, b, 1);
}

/** Paproć drzewiasta: krótki pień i rozłożysta korona (paleozoik/mezozoik, ląd). */
export function treefern(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const h = (30 + r() * 14) * s;
  ctx.beginPath(); ctx.moveTo(x - 2.4 * s, y); ctx.quadraticCurveTo(x + 1 * s, y - h * 0.5, x - 0.5 * s, y - h); ctx.lineTo(x + 2 * s, y - h);
  ctx.quadraticCurveTo(x + 3 * s, y - h * 0.5, x + 2.4 * s, y); ctx.closePath(); wash(ctx, b, C.bark, 0.6); ink(ctx, b, 1);
  for (let f = 0; f < 9; f++) {
    const ang = Math.PI + (f / 8) * Math.PI, len = (22 + r() * 8) * s;
    const ex = x + Math.cos(ang) * len, ey = y - h + Math.sin(ang) * len * 0.55 + 9 * s * Math.abs(Math.cos(ang));
    ctx.beginPath(); ctx.moveTo(x, y - h); ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.55, y - h + Math.sin(ang) * len * 0.8, ex, ey);
    ctx.strokeStyle = hexA(C.fern, 0.95 * b.alpha); ctx.lineWidth = 2.6 * s * b.line; ctx.stroke(); ink(ctx, b, 0.6);
  }
}


/** Kępa kwiatów kenozoiku: łodyżki z barwnymi główkami. */
export function wildflowers(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const cols = ['#d59ab0', '#e3c25a', '#f3efe4', '#a48ad0'];
  for (let q = 0; q < 6; q++) {
    const fx = x + (q - 2.5) * 3.2 * s, h = (8 + r() * 8) * s;
    ctx.beginPath(); ctx.moveTo(fx, y); ctx.quadraticCurveTo(fx + (r() - 0.5) * 4 * s, y - h * 0.5, fx + (r() - 0.5) * 3 * s, y - h);
    ctx.strokeStyle = hexA(C.moss, 0.95 * b.alpha); ctx.lineWidth = 0.9 * b.line; ctx.stroke();
    ctx.beginPath(); ctx.arc(fx, y - h, 2 * s, 0, Math.PI * 2); ctx.fillStyle = hexA(cols[q % cols.length], 0.95 * b.alpha); ctx.fill(); ink(ctx, b, 0.5, 0.7);
  }
}

/** Trawa morska: pęk wąskich, falujących liści w płytkiej wodzie. */
export function seagrass(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  for (let f = 0; f < 5; f++) {
    const h = (16 + r() * 14) * s, sway = (r() - 0.5) * 9 * s, fx = x + (f - 2) * 2.4 * s;
    ctx.beginPath(); ctx.moveTo(fx, y); ctx.bezierCurveTo(fx + sway, y - h * 0.4, fx - sway, y - h * 0.75, fx + sway * 0.6, y - h);
    ctx.strokeStyle = hexA('#5f9a6a', 0.9 * b.alpha); ctx.lineWidth = 1.6 * s * b.line; ctx.stroke();
  }
}


// ------------------------------------------------------------------ warstwy

export interface PaintArgs {
  niche: NicheKey; era: Era; theme: Theme; lay: SceneLayout; tileW: number; seed: number; res: number;
}

export function canvasOf(w: number, h: number, res: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * res); c.height = Math.ceil(h * res);
  const ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  return { c, ctx };
}





// ------------------------------------------------------------------ drobne tekstury efektów

/** Miękka kropka (plankton, pyłek, płatek śniegu z daleka). */
export function paintDot(color: string, res: number): HTMLCanvasElement {
  const { c, ctx } = canvasOf(8, 8, res);
  const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
  g.addColorStop(0, hexA(color, 1)); g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 8);
  return c;
}

/** Płatek śniegu — biały z szarym obrysem, widoczny także na jasnym tle. */
export function paintSnow(theme: Theme, res: number): HTMLCanvasElement {
  const { c, ctx } = canvasOf(8, 8, res);
  ctx.beginPath(); ctx.arc(4, 4, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.strokeStyle = hexA(theme.inkSoft, 0.55); ctx.lineWidth = 0.8; ctx.stroke();
  return c;
}

/** Pęcherzyk — pierścień tuszem. */
export function paintBubble(theme: Theme, res: number): HTMLCanvasElement {
  const { c, ctx } = canvasOf(10, 10, res);
  ctx.beginPath(); ctx.arc(5, 5, 3.6, 0, Math.PI * 2);
  ctx.strokeStyle = hexA(theme.niche.woda, 0.9); ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(3.8, 3.8, 0.8, 0, Math.PI * 2); ctx.fillStyle = hexA('#ffffff', 0.8); ctx.fill();
  return c;
}


/** Winieta — przyciemnione brzegi jak na starej tablicy. */
export function paintVignette(W: number, H: number, theme: Theme): HTMLCanvasElement {
  const { c, ctx } = canvasOf(W, H, 1);
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.65);
  g.addColorStop(0, hexA(theme.ink, 0)); g.addColorStop(1, hexA(theme.ink, theme.dark ? 0.45 : 0.22));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  return c;
}

/** Szum do mapy przemieszczeń (falowanie obrazu pod wodą). */
export function paintNoise(size: number, seed: number): HTMLCanvasElement {
  const { c, ctx } = canvasOf(size, size, 1);
  const img = ctx.createImageData(size, size);
  const r = rng(seed);
  // gładki szum: suma kilku zapętlonych sinusoid (bez szwów przy kafelkowaniu)
  const waves = Array.from({ length: 6 }, () => ({ fx: 1 + Math.floor(r() * 4), fy: 1 + Math.floor(r() * 4), ph: r() * 6.28 }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let vx = 0, vy = 0;
    waves.forEach((w, i) => {
      const a = (x / size) * w.fx * 6.283 + (y / size) * w.fy * 6.283 + w.ph;
      if (i % 2) vx += Math.sin(a); else vy += Math.cos(a);
    });
    const o = (y * size + x) * 4;
    img.data[o] = 128 + vx * 40; img.data[o + 1] = 128 + vy * 40; img.data[o + 2] = 128; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
