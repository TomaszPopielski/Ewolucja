/*
 * scenery.ts — malowanie tła dioramy (Canvas 2D → tekstury).
 *
 * Każda nisza ma warstwy: tło (gradient), daleka, środkowa i pierwszy plan.
 * Warstwy są „kafelkami” zapętlonymi w poziomie (efekt głębi przy przesuwaniu).
 * Roślinność i drobna fauna zależą od ery — gracz widzi, jak zmienia się świat:
 * paleozoik (liliowce, gąbki, trylobity, lepidodendrony, skrzypy),
 * mezozoik (amonity, koralowce, araukarie, sagowce),
 * kenozoik (kelp, drzewa liściaste, trawy, kwiaty).
 * Styl jak w całej grze: kontur tuszem + ton laweryjny.
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

export function sceneLayout(niche: NicheKey, W: number, H: number): SceneLayout {
  switch (niche) {
    case 'woda': return { W, H, surfaceY: 10, floorY: H - 26, lifeTop: 34, lifeBottom: H - 44 };
    case 'przybrzeze': return { W, H, surfaceY: Math.round(H * 0.3), floorY: H - 22, lifeTop: Math.round(H * 0.3) + 22, lifeBottom: H - 38 };
    case 'lad': return { W, H, surfaceY: -1, floorY: H - 52, lifeTop: H - 54, lifeBottom: H - 12 };
    default: return { W, H, surfaceY: -1, floorY: H - 16, lifeTop: 26, lifeBottom: Math.round(H * 0.68) };
  }
}

// ------------------------------------------------------------------ pędzle

function hexA(hex: string, a: number): string {
  if (!hex.startsWith('#')) return hex;
  const p = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((p >> 16) & 255) + ',' + ((p >> 8) & 255) + ',' + (p & 255) + ',' + a.toFixed(3) + ')';
}
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (sh: number) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t);
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}

interface Brush { th: Theme; alpha: number; line: number }
function ink(ctx: Ctx, b: Brush, w = 1, a = 1) {
  ctx.strokeStyle = hexA(b.th.ink, b.alpha * a * 0.9);
  ctx.lineWidth = w * b.line; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
}
function wash(ctx: Ctx, b: Brush, color: string, a = 0.5) {
  ctx.fillStyle = hexA(color, a * b.alpha); ctx.fill();
}

/** Rysuje element także „po drugiej stronie” kafla, jeśli wystaje poza krawędź. */
function wrapped(tileW: number, x: number, reach: number, fn: (x: number) => void) {
  fn(x);
  if (x - reach < 0) fn(x + tileW);
  if (x + reach > tileW) fn(x - tileW);
}

const C = {
  horn: '#a8834f', coral: '#cf7f69', ochre: '#c9a060', olive: '#7f8a3f', moss: '#7a8c45',
  fern: '#6f9a58', bark: '#8a6f55', sand: '#cdb88f', rock: '#9a958a', leaf: '#6f9150', flower: '#d59ab0'
};

// ------------------------------------------------------------------ fauna i flora dna

function crinoid(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
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

function sponge(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
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

function algae(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number, color = C.olive) {
  for (let f = 0; f < 3; f++) {
    const h = (18 + r() * 20) * s, sway = (r() - 0.5) * 10 * s;
    ctx.beginPath(); ctx.moveTo(x + f * 2 * s, y);
    ctx.bezierCurveTo(x + sway, y - h * 0.4, x - sway, y - h * 0.7, x + sway * 0.5 + f * s, y - h);
    ink(ctx, b, 1.2);
    ctx.strokeStyle = hexA(color, 0.8 * b.alpha); ctx.lineWidth = 2.4 * s * b.line; ctx.stroke();
  }
}

function trilobite(ctx: Ctx, b: Brush, x: number, y: number, s: number) {
  ctx.save(); ctx.translate(x, y - 2.5 * s);
  ctx.beginPath(); ctx.ellipse(0, 0, 7 * s, 3.2 * s, 0, 0, Math.PI * 2); wash(ctx, b, C.horn, 0.6); ink(ctx, b, 0.9);
  ctx.beginPath(); ctx.arc(5 * s, 0, 3.2 * s, -Math.PI / 2, Math.PI / 2); ink(ctx, b, 0.8);
  ctx.beginPath(); for (let q = -3; q <= 2; q++) { ctx.moveTo(q * 1.6 * s, -3 * s); ctx.lineTo(q * 1.6 * s, 3 * s); } ink(ctx, b, 0.5, 0.8);
  ctx.beginPath(); ctx.moveTo(-7 * s, 0); ctx.lineTo(5 * s, 0); ink(ctx, b, 0.5, 0.8);
  ctx.restore();
}

function ammonite(ctx: Ctx, b: Brush, x: number, y: number, s: number) {
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

function coral(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number, color = C.coral) {
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

function kelp(ctx: Ctx, b: Brush, x: number, y: number, top: number, s: number, r: () => number) {
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

function seastar(ctx: Ctx, b: Brush, x: number, y: number, s: number) {
  ctx.beginPath();
  for (let q = 0; q < 10; q++) {
    const a = -Math.PI / 2 + q * Math.PI / 5, rr = (q % 2 ? 2 : 5.5) * s;
    const px = x + Math.cos(a) * rr, py = y - 2.5 * s + Math.sin(a) * rr * 0.5;
    if (q) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath(); wash(ctx, b, C.coral, 0.7); ink(ctx, b, 0.8);
}

function rock(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const w = (6 + r() * 10) * s, h = (3 + r() * 5) * s;
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.8, y - h * 1.2, x, y - h);
  ctx.quadraticCurveTo(x + w * 0.9, y - h * 0.9, x + w, y); ctx.closePath();
  wash(ctx, b, C.rock, 0.5); ink(ctx, b, 0.9);
  ctx.beginPath(); for (let q = 0; q < 4; q++) { const hx = x - w * 0.4 + q * w * 0.25; ctx.moveTo(hx, y - 0.5); ctx.lineTo(hx + 2 * s, y - h * 0.5); } ink(ctx, b, 0.5, 0.6);
}

function stromatolite(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const w = (10 + r() * 8) * s, h = (8 + r() * 6) * s;
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.bezierCurveTo(x - w, y - h * 1.3, x + w, y - h * 1.3, x + w, y); ctx.closePath();
  wash(ctx, b, '#b5a07a', 0.6); ink(ctx, b, 1);
  ctx.beginPath();
  for (let q = 1; q < 4; q++) { const k = q / 4; ctx.moveTo(x - w * (1 - k * 0.3), y - h * k * 0.9); ctx.quadraticCurveTo(x, y - h * (0.4 + k * 0.9), x + w * (1 - k * 0.3), y - h * k * 0.9); }
  ink(ctx, b, 0.5, 0.7);
}

// ------------------------------------------------------------------ flora lądowa

function lepidodendron(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
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

function horsetail(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  for (let q = 0; q < 3; q++) {
    const h = (20 + r() * 18) * s, xx = x + (q - 1) * 4 * s;
    ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx + (r() - 0.5) * 3, y - h); ink(ctx, b, 1.1);
    ctx.beginPath();
    for (let k = 1; k < 7; k++) { const yy = y - h * k / 7; ctx.moveTo(xx - 3 * s, yy + 2 * s); ctx.lineTo(xx, yy); ctx.lineTo(xx + 3 * s, yy + 2 * s); }
    ctx.strokeStyle = hexA(C.fern, 0.9 * b.alpha); ctx.lineWidth = 0.8 * b.line; ctx.stroke();
  }
}

function fern(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
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

function araucaria(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
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

function cycad(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
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

function broadleaf(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  const h = (50 + r() * 25) * s;
  ctx.beginPath(); ctx.moveTo(x - 3 * s, y); ctx.quadraticCurveTo(x - 1 * s, y - h * 0.5, x - 2 * s, y - h * 0.8);
  ctx.lineTo(x + 2 * s, y - h * 0.8); ctx.quadraticCurveTo(x + 1 * s, y - h * 0.5, x + 3 * s, y); ctx.closePath();
  wash(ctx, b, C.bark, 0.6); ink(ctx, b, 1);
  const blobs = 7;
  ctx.beginPath();
  for (let q = 0; q < blobs; q++) {
    const a = (q / blobs) * Math.PI * 2, rr = (13 + r() * 5) * s;
    const cx = x + Math.cos(a) * 11 * s, cy = y - h * 0.85 + Math.sin(a) * 8 * s;
    ctx.moveTo(cx + rr, cy); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  }
  wash(ctx, b, C.leaf, 0.55);
  ctx.beginPath();
  for (let q = 0; q < blobs; q++) {
    const a = (q / blobs) * Math.PI * 2;
    const cx = x + Math.cos(a) * 11 * s, cy = y - h * 0.85 + Math.sin(a) * 8 * s;
    ctx.moveTo(cx + 12 * s * Math.cos(a - 1), cy + 12 * s * Math.sin(a - 1));
    ctx.arc(cx, cy, 12 * s, a - 1, a + 1);
  }
  ink(ctx, b, 1);
}

function grass(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number, color = C.moss) {
  ctx.beginPath();
  for (let q = -3; q <= 3; q++) {
    const h = (6 + r() * 7) * s;
    ctx.moveTo(x + q * 1.2 * s, y); ctx.quadraticCurveTo(x + q * 1.5 * s, y - h * 0.6, x + q * 2.8 * s, y - h);
  }
  ctx.strokeStyle = hexA(color, 0.95 * b.alpha); ctx.lineWidth = 1 * b.line; ctx.stroke();
}

function shrub(ctx: Ctx, b: Brush, x: number, y: number, s: number, r: () => number) {
  ctx.beginPath(); ctx.ellipse(x, y - 6 * s, 11 * s, 7 * s, 0, Math.PI, 0); ctx.closePath();
  wash(ctx, b, C.leaf, 0.55); ink(ctx, b, 0.9);
  ctx.fillStyle = hexA(C.flower, 0.95 * b.alpha);
  for (let q = 0; q < 5; q++) { ctx.beginPath(); ctx.arc(x + (r() - 0.5) * 16 * s, y - 3 * s - r() * 8 * s, 1.4 * s, 0, Math.PI * 2); ctx.fill(); }
}

function cloud(ctx: Ctx, b: Brush, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x - 22 * s, y);
  ctx.arc(x - 12 * s, y - 2 * s, 10 * s, Math.PI, Math.PI * 1.75);
  ctx.arc(x + 2 * s, y - 8 * s, 13 * s, Math.PI * 1.15, Math.PI * 1.9);
  ctx.arc(x + 17 * s, y - 2 * s, 9 * s, Math.PI * 1.3, Math.PI * 2);
  ctx.lineTo(x - 22 * s, y); ctx.closePath();
  ctx.fillStyle = hexA(b.th.paper, 0.85 * b.alpha); ctx.fill(); ink(ctx, b, 0.9, 0.7);
}

// ------------------------------------------------------------------ warstwy

export interface PaintArgs {
  niche: NicheKey; era: Era; theme: Theme; lay: SceneLayout; tileW: number; seed: number; res: number;
}

function canvasOf(w: number, h: number, res: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * res); c.height = Math.ceil(h * res);
  const ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  return { c, ctx };
}

/** Tło: gradient nieba i/lub wody (rozciągany na całą szerokość). */
export function paintBackground(a: PaintArgs): HTMLCanvasElement {
  const { lay, theme, niche } = a;
  const { c, ctx } = canvasOf(4, lay.H, a.res);
  const dark = theme.dark;
  const sky = theme.niche.powietrze, sea = theme.niche.woda, coast = theme.niche.przybrzeze;
  const paper = theme.paper;
  const g = ctx.createLinearGradient(0, 0, 0, lay.H);
  if (niche === 'woda') {
    g.addColorStop(0, mix(paper, sea, dark ? 0.35 : 0.22));
    g.addColorStop(1, mix(paper, sea, dark ? 0.7 : 0.55));
  } else if (niche === 'przybrzeze') {
    const s = lay.surfaceY / lay.H;
    g.addColorStop(0, mix(paper, sky, dark ? 0.25 : 0.2));
    g.addColorStop(s, mix(paper, sky, dark ? 0.12 : 0.08));
    g.addColorStop(s + 0.001, mix(paper, coast, dark ? 0.35 : 0.25));
    g.addColorStop(1, mix(paper, coast, dark ? 0.6 : 0.45));
  } else if (niche === 'lad') {
    g.addColorStop(0, mix(paper, sky, dark ? 0.3 : 0.28));
    g.addColorStop(0.75, mix(paper, '#e9d7a8', dark ? 0.08 : 0.35));
    g.addColorStop(1, mix(paper, theme.niche.lad, 0.3));
  } else {
    g.addColorStop(0, mix(paper, sky, dark ? 0.45 : 0.42));
    g.addColorStop(1, mix(paper, sky, dark ? 0.12 : 0.1));
  }
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, lay.H);
  return c;
}

/** Daleki plan: wzgórza, skały, sylwetki roślin — blado, bez szczegółów. */
export function paintFar(a: PaintArgs): HTMLCanvasElement {
  const { lay, theme, niche, era, tileW } = a;
  const { c, ctx } = canvasOf(tileW, lay.H, a.res);
  const r = rng(a.seed ^ 0xfa);
  const b: Brush = { th: theme, alpha: 0.45, line: 0.9 };
  const base = niche === 'powietrze' ? lay.H - 10 : lay.floorY - (niche === 'lad' ? 8 : 12);
  // linia wzgórz/rafy (zapętlona: sinusy o okresie = szerokość kafla)
  const hillH = niche === 'lad' ? 34 : niche === 'powietrze' ? 26 : 16;
  const f1 = 2 + Math.floor(r() * 2), f2 = 5 + Math.floor(r() * 3);
  const yAt = (x: number) => base - hillH * (0.55 + 0.3 * Math.sin((x / tileW) * Math.PI * 2 * f1 + 1) + 0.15 * Math.sin((x / tileW) * Math.PI * 2 * f2));
  ctx.beginPath(); ctx.moveTo(0, lay.H);
  for (let x = 0; x <= tileW; x += 6) ctx.lineTo(x, yAt(x));
  ctx.lineTo(tileW, lay.H); ctx.closePath();
  const tone = niche === 'lad' || niche === 'powietrze' ? mix(theme.niche.lad, theme.paper, 0.45) : mix(theme.niche.woda, theme.ink, 0.25);
  wash(ctx, b, tone, niche === 'lad' || niche === 'powietrze' ? 0.55 : 0.35);
  ctx.beginPath(); for (let x = 0; x <= tileW; x += 6) (x ? ctx.lineTo(x, yAt(x)) : ctx.moveTo(x, yAt(x))); ink(ctx, b, 0.8, 0.8);
  // sylwetki na horyzoncie
  const n = Math.round(tileW / 90);
  for (let q = 0; q < n; q++) {
    const x = (q + r()) * (tileW / n), y = yAt(x) + 2, s = 0.45 + r() * 0.2;
    wrapped(tileW, x, 40, (xx) => {
      if (niche === 'lad' || niche === 'powietrze') {
        if (era === 'paleozoik') lepidodendron(ctx, b, xx, y, s * 0.8, rng(a.seed + q));
        else if (era === 'mezozoik') araucaria(ctx, b, xx, y, s * 0.8, rng(a.seed + q));
        else broadleaf(ctx, b, xx, y, s, rng(a.seed + q));
      } else if (niche === 'woda' || niche === 'przybrzeze') {
        if (r() > 0.5) rock(ctx, b, xx, y + 2, 1.4, rng(a.seed + q)); else algae(ctx, b, xx, y + 2, 0.9, rng(a.seed + q));
      }
    });
  }
  if (niche === 'przybrzeze') {
    // ląd na horyzoncie, nad powierzchnią wody
    const sy = lay.surfaceY;
    const shore = (x: number) => sy - 6 - 14 * Math.max(0, Math.sin((x / tileW) * Math.PI * 2 * 2 + 0.6)) - 5 * Math.sin((x / tileW) * Math.PI * 2 * 5);
    ctx.beginPath(); ctx.moveTo(0, sy);
    for (let x = 0; x <= tileW; x += 6) ctx.lineTo(x, Math.min(sy, shore(x)));
    ctx.lineTo(tileW, sy); ctx.closePath();
    wash(ctx, { ...b, alpha: 0.8 }, mix(theme.niche.lad, theme.paper, 0.35), 0.6);
    ctx.beginPath(); for (let x = 0; x <= tileW; x += 6) (x ? ctx.lineTo(x, Math.min(sy, shore(x))) : ctx.moveTo(x, Math.min(sy, shore(x)))); ink(ctx, b, 0.8, 0.8);
    for (let q = 0; q < Math.round(tileW / 70); q++) {
      const x = (q + r()) * 70, y = Math.min(sy, shore(x)) + 1;
      if (y > sy - 3) continue;
      wrapped(tileW, x, 30, (xx) => {
        const rr = rng(a.seed + 500 + q);
        if (era === 'paleozoik') horsetail(ctx, b, xx, y, 0.6, rr);
        else if (era === 'mezozoik') cycad(ctx, b, xx, y, 0.5, rr);
        else broadleaf(ctx, b, xx, y, 0.35, rr);
      });
    }
  }
  if (niche === 'powietrze') {
    for (let q = 0; q < 4; q++) { const x = (q + r()) * (tileW / 4), y = 26 + r() * lay.H * 0.35, cs = 1 + r() * 0.6; wrapped(tileW, x, 40, (xx) => cloud(ctx, { ...b, alpha: 0.6 }, xx, y, cs)); }
  }
  if (niche === 'lad') {
    for (let q = 0; q < 3; q++) { const x = (q + r()) * (tileW / 3), y = 20 + r() * 26, cs = 0.8 + r() * 0.4; wrapped(tileW, x, 40, (xx) => cloud(ctx, { ...b, alpha: 0.5 }, xx, y, cs)); }
  }
  return c;
}

/** Środkowy plan: dno/grunt z roślinnością i drobną fauną danej ery. */
export function paintMid(a: PaintArgs): HTMLCanvasElement {
  const { lay, theme, niche, era, tileW } = a;
  const { c, ctx } = canvasOf(tileW, lay.H, a.res);
  const r = rng(a.seed ^ 0x3d);
  const b: Brush = { th: theme, alpha: 1, line: 1 };
  if (niche === 'powietrze') {
    // chmury bliższe, większe
    for (let q = 0; q < 3; q++) { const x = (q + r()) * (tileW / 3), y = 40 + r() * lay.H * 0.4, cs = 1.5 + r() * 0.7; wrapped(tileW, x, 60, (xx) => cloud(ctx, b, xx, y, cs)); }
    return c;
  }
  const floor = lay.floorY;
  if (lay.surfaceY > 0) {
    // powierzchnia wody: falista linia z jaśniejszym pasem odbicia
    const sy = lay.surfaceY;
    const wy = (x: number) => sy + 1.8 * Math.sin((x / tileW) * Math.PI * 2 * 18) + 1.2 * Math.sin((x / tileW) * Math.PI * 2 * 7);
    ctx.beginPath(); ctx.moveTo(0, wy(0) - 1);
    for (let x = 0; x <= tileW; x += 4) ctx.lineTo(x, wy(x));
    for (let x = tileW; x >= 0; x -= 4) ctx.lineTo(x, wy(x) + 5);
    ctx.closePath(); ctx.fillStyle = hexA('#ffffff', theme.dark ? 0.08 : 0.35); ctx.fill();
    ctx.beginPath(); for (let x = 0; x <= tileW; x += 4) (x ? ctx.lineTo(x, wy(x)) : ctx.moveTo(x, wy(x)));
    ctx.strokeStyle = hexA(theme.niche.woda, 0.9); ctx.lineWidth = 1.4; ctx.stroke();
  }
  const yAt = (x: number) => floor + 2 * Math.sin((x / tileW) * Math.PI * 2 * 7) + (niche === 'przybrzeze' ? 3 * Math.sin((x / tileW) * Math.PI * 2 * 2) : 0);
  // pas dna / gruntu
  ctx.beginPath(); ctx.moveTo(0, lay.H);
  for (let x = 0; x <= tileW; x += 5) ctx.lineTo(x, yAt(x));
  ctx.lineTo(tileW, lay.H); ctx.closePath();
  const groundC = niche === 'lad' ? mix(theme.niche.lad, C.sand, 0.35) : C.sand;
  wash(ctx, b, groundC, niche === 'lad' ? 0.5 : 0.45);
  ctx.beginPath(); for (let x = 0; x <= tileW; x += 5) (x ? ctx.lineTo(x, yAt(x)) : ctx.moveTo(x, yAt(x))); ink(ctx, b, 1.1);
  // kreskowanie gruntu (jak na przekrojach geologicznych)
  ctx.beginPath();
  for (let x = 3; x < tileW; x += 7) { const y = yAt(x) + 5 + r() * 6; ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 3); }
  ink(ctx, b, 0.5, 0.35);

  const count = Math.round(tileW / 55);
  for (let q = 0; q < count; q++) {
    const x = (q + r() * 0.8) * (tileW / count);
    const y = yAt(x) + 1;
    const pick = r();
    wrapped(tileW, x, 70, (xx) => {
      const rr = rng(a.seed * 31 + q); // świeży generator dla każdej kopii → identyczny rysunek
      if (niche === 'woda') {
        if (era === 'paleozoik') {
          if (pick < 0.35) crinoid(ctx, b, xx, y, 1, rr); else if (pick < 0.55) sponge(ctx, b, xx, y, 1, rr);
          else if (pick < 0.7) trilobite(ctx, b, xx, y, 1); else if (pick < 0.85) algae(ctx, b, xx, y, 1, rr); else rock(ctx, b, xx, y, 1, rr);
        } else if (era === 'mezozoik') {
          if (pick < 0.3) coral(ctx, b, xx, y, 1, rr); else if (pick < 0.5) ammonite(ctx, b, xx, y, 1);
          else if (pick < 0.75) algae(ctx, b, xx, y, 1, rr); else rock(ctx, b, xx, y, 1, rr);
        } else {
          if (pick < 0.3) kelp(ctx, b, xx, y, lay.surfaceY + 30 + rr() * 40, 1, rr); else if (pick < 0.5) coral(ctx, b, xx, y, 1, rr, '#d99a6a');
          else if (pick < 0.65) seastar(ctx, b, xx, y, 1); else if (pick < 0.85) algae(ctx, b, xx, y, 1, rr); else rock(ctx, b, xx, y, 1, rr);
        }
      } else if (niche === 'przybrzeze') {
        if (era === 'paleozoik' && pick < 0.45) stromatolite(ctx, b, xx, y, 1, rr);
        else if (pick < 0.3) coral(ctx, b, xx, y, 0.8, rr);
        else if (pick < 0.6) algae(ctx, b, xx, y, 0.9, rr, C.fern);
        else if (pick < 0.75 && era !== 'paleozoik') seastar(ctx, b, xx, y, 0.9);
        else rock(ctx, b, xx, y, 1.2, rr);
      } else {
        if (era === 'paleozoik') {
          if (pick < 0.3) lepidodendron(ctx, b, xx, y, 0.9, rr); else if (pick < 0.6) horsetail(ctx, b, xx, y, 1, rr);
          else if (pick < 0.85) fern(ctx, b, xx, y, 1, rr); else rock(ctx, b, xx, y, 1, rr);
        } else if (era === 'mezozoik') {
          if (pick < 0.3) araucaria(ctx, b, xx, y, 0.9, rr); else if (pick < 0.6) cycad(ctx, b, xx, y, 1, rr);
          else if (pick < 0.85) fern(ctx, b, xx, y, 1, rr); else rock(ctx, b, xx, y, 1, rr);
        } else {
          if (pick < 0.3) broadleaf(ctx, b, xx, y, 1, rr); else if (pick < 0.55) shrub(ctx, b, xx, y, 1, rr);
          else if (pick < 0.9) grass(ctx, b, xx, y, 1.3, rr); else rock(ctx, b, xx, y, 1, rr);
        }
      }
    });
  }
  // drobne kępki / kamyki między większymi elementami
  for (let q = 0; q < tileW / 18; q++) {
    const x = r() * tileW, y = yAt(x) + 1;
    const gs = a.seed * 97 + q;
    if (niche === 'lad') wrapped(tileW, x, 8, (xx) => grass(ctx, b, xx, y, 0.7, rng(gs), era === 'kenozoik' ? C.moss : C.fern));
    else { ctx.beginPath(); ctx.ellipse(x, y + 3 + r() * 4, 1.5 + r() * 2, 1 + r(), 0, 0, Math.PI * 2); wash(ctx, b, C.rock, 0.45); }
  }
  return c;
}

/** Pierwszy plan: nieliczne, większe elementy na krawędzi kadru (rozmyte w WebGL). */
export function paintNear(a: PaintArgs): HTMLCanvasElement {
  const { lay, theme, niche, era, tileW } = a;
  const { c, ctx } = canvasOf(tileW, lay.H, a.res);
  const r = rng(a.seed ^ 0x77);
  const b: Brush = { th: theme, alpha: 0.9, line: 1.5 };
  // Głębia ostrości: pierwszy plan rozmyty raz, przy malowaniu (bez kosztu na klatkę).
  ctx.filter = 'blur(' + (2.2 * a.res).toFixed(1) + 'px)';
  const n = Math.max(2, Math.round(tileW / 420));
  for (let q = 0; q < n; q++) {
    const x = (q + r() * 0.6) * (tileW / n), y = lay.H + 6;
    wrapped(tileW, x, 90, (xx) => {
      const rr = rng(a.seed * 7 + q);
      if (niche === 'woda') { if (era === 'kenozoik') kelp(ctx, b, xx, y, lay.surfaceY + 6, 1.6, rr); else algae(ctx, b, xx, y, 2.4, rr); }
      else if (niche === 'przybrzeze') algae(ctx, b, xx, y, 2.2, rr, C.fern);
      else if (niche === 'lad') { if (era === 'kenozoik') grass(ctx, b, xx, y, 3, rr); else fern(ctx, b, xx, y, 2.6, rr); }
      else cloud(ctx, { ...b, alpha: 0.7 }, xx, lay.H - 10, 3);
    });
  }
  return c;
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

/** Snop światła spod powierzchni (gradient w pionie i poziomie). */
export function paintRay(res: number): HTMLCanvasElement {
  const { c, ctx } = canvasOf(40, 200, res);
  const gv = ctx.createLinearGradient(0, 0, 0, 200);
  gv.addColorStop(0, 'rgba(255,250,230,0.55)'); gv.addColorStop(1, 'rgba(255,250,230,0)');
  ctx.fillStyle = gv;
  ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(28, 0); ctx.lineTo(40, 200); ctx.lineTo(0, 200); ctx.closePath(); ctx.fill();
  // miękkie krawędzie
  ctx.globalCompositeOperation = 'destination-in';
  const gh = ctx.createLinearGradient(0, 0, 40, 0);
  gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.5, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gh; ctx.fillRect(0, 0, 40, 200);
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
