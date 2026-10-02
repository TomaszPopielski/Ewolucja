/*
 * light.ts — wspólne narzędzia sceny ze światłem (etap 1, docs/GRAFIKA-PROPOZYCJA.md).
 *
 * Każda nisza ma własny „przepis” na scenę (lit-land.ts, lit-water.ts,
 * lit-air.ts), a tu są elementy wspólne: cień rzucany, światło nakładane na
 * gotowy rysunek, jednorazowe rozmycie warstwy, niebo z poświatą słońca,
 * chmury, ziarno papieru, snopy światła i sklejanie warstw.
 *
 * Wszystko jest malowane raz do tekstur; w trakcie gry renderer tylko
 * przesuwa i przenika gotowe obrazy.
 */
import { rng } from '../creature/spec.ts';
import type { Theme } from '../creature/draw.ts';
import { canvasOf, hexA, mix, type Brush, type PaintArgs } from './scenery.ts';
import { litSide, shadowLen, type Look } from './looks.ts';

export type Ctx = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;

/** Parametry sceny potrzebne przepisom (rozmiar, gęstość pikseli, motyw, efekty wysokiej jakości). */
export interface LitEnv { W: number; H: number; res: number; theme: Theme; effects: boolean }

/**
 * Warstwa gotowej sceny: obraz w pasie y0…y0+h. `tile` — zapętlony kafel
 * (przesuwa się z kamerą: k = paralaksa, drift = stały dryf w px/s);
 * inaczej obraz na szerokość sceny, nieruchomy.
 */
export interface LitLayer { canvas: HTMLCanvasElement; y0: number; h: number; tile: boolean; k?: number; drift?: number }
/** Snopy światła: położenia, początek, długość, szerokości, pochylenie i krycie. */
export interface LitRays { xs: number[]; y: number; h: number; widths: number[]; skew: number; alpha: number }
export interface LitRecipe {
  /** Warstwy za zwierzętami (od najdalszej); snopy światła trafiają za warstwę o indeksie raysAfter. */
  back: LitLayer[]; raysAfter: number; rays: LitRays | null;
  /** Warstwy przed zwierzętami (pierwszy plan, rama kadru). */
  front: LitLayer[];
}

// ------------------------------------------------------------------ cień, światło, rozmycie

/** Cień rzucany na grunt, odsunięty od słońca (dłuższy przy niskim słońcu). */
export function castShadow(ctx: Ctx, b: Brush, l: Look, x: number, y: number, w: number, h: number, a = 0.32) {
  const len = shadowLen(l) * h, dir = -litSide(l);
  ctx.beginPath();
  ctx.ellipse(x + dir * len * 0.45, y + 1, w * 0.6 + len * 0.5, Math.max(1.5, w * 0.17), 0, 0, TAU);
  ctx.fillStyle = hexA(l.shade, a * b.alpha); ctx.fill();
}

/**
 * Światło nałożone na gotowy rysunek (np. dawne rośliny i zwierzęta dna ze scenery.ts):
 * rysunek powstaje na osobnym płótnie, potem tylko jego piksele dostają
 * światło z boku (ląd: jasna strona od słońca) albo z góry (pod wodą)
 * i ewentualnie zamglenie dali. Ramka: x ± halfW, od y − h do y.
 */
export function litObject(ctx: Ctx, l: Look, res: number, x: number, y: number, halfW: number, h: number,
  light: 'side' | 'top', haze: number, hazeColor: string, draw: (c: Ctx) => void) {
  const x0 = Math.floor(x - halfW - 6), y0 = Math.floor(y - h - 6), w = Math.ceil(2 * halfW + 12), hh = Math.ceil(h + 14);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * res)); c.height = Math.max(1, Math.ceil(hh * res));
  const t = c.getContext('2d')!;
  t.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
  draw(t);
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = 'source-atop';
  const W = c.width, H = c.height;
  if (light === 'side') {
    const side = litSide(l);
    const g = t.createLinearGradient(side > 0 ? 0 : W, 0, side > 0 ? W : 0, 0);
    g.addColorStop(0, hexA(l.shade, 0.42)); g.addColorStop(0.48, hexA(l.shade, 0));
    g.addColorStop(0.55, hexA(l.sun.color, 0)); g.addColorStop(1, hexA(l.sun.color, 0.4));
    t.fillStyle = g; t.fillRect(0, 0, W, H);
    const gv = t.createLinearGradient(0, 0, 0, H);
    gv.addColorStop(0.55, hexA(l.shade, 0)); gv.addColorStop(1, hexA(l.shade, 0.3));
    t.fillStyle = gv; t.fillRect(0, 0, W, H);
  } else {
    const gv = t.createLinearGradient(0, 0, 0, H);
    gv.addColorStop(0, hexA(l.lit, 0.42)); gv.addColorStop(0.42, hexA(l.lit, 0));
    gv.addColorStop(0.6, hexA(l.shade, 0)); gv.addColorStop(1, hexA(l.shade, 0.45));
    t.fillStyle = gv; t.fillRect(0, 0, W, H);
  }
  if (haze > 0) { t.fillStyle = hexA(hazeColor, Math.min(1, haze)); t.fillRect(0, 0, W, H); }
  ctx.drawImage(c, x0, y0, w, hh);
}

/**
 * Rozmycie całej grupy rysunków jednym ruchem: rysunek na osobnym płótnie,
 * potem jedno nałożenie z filtrem. (Filtr ustawiony na kontekście rozmywa
 * każdy kształt osobno — przy setkach kształtów to sekundy malowania.)
 */
export function blurred(ctx: Ctx, w: number, h: number, res: number, px: number, draw: (c: Ctx) => void) {
  const { c, ctx: t } = canvasOf(w, h, res);
  draw(t);
  ctx.save();
  ctx.filter = 'blur(' + (px * res).toFixed(1) + 'px)';
  ctx.drawImage(c, 0, 0, w, h);
  ctx.restore();
}

// ------------------------------------------------------------------ sklejanie i przycinanie warstw

/**
 * Skleja warstwy w pasie y0…y1 (lewy kraniec każdej warstwy = lewy brzeg obrazu);
 * opcjonalnie z ziarnem papieru od wysokości grain.from. Zwraca warstwę o szerokości W.
 */
export function stack(layers: HTMLCanvasElement[], W: number, H: number, res: number, y0: number, y1: number,
  grain?: { from: number; theme: Theme; seed: number }): { canvas: HTMLCanvasElement; y0: number; h: number } {
  y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H, Math.ceil(y1));
  const w = Math.ceil(W * res), sy = Math.floor(y0 * res), h = Math.max(1, Math.ceil((y1 - y0) * res));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  layers.forEach((src) => {
    const cw = Math.min(w, src.width), ch = Math.min(h, src.height - sy);
    if (ch > 0) ctx.drawImage(src, 0, sy, cw, ch, 0, 0, cw, ch);
  });
  if (grain) paintGrain(ctx, w, h, Math.max(0, (grain.from - y0) * res), res, grain.theme, grain.seed);
  return { canvas: c, y0, h: y1 - y0 };
}

/** Nieruchoma warstwa na szerokość sceny ze sklejonych płócien. */
export function still(env: LitEnv, layers: HTMLCanvasElement[], y0: number, y1: number, grainFrom: number | null = null, seed = 0): LitLayer {
  const s = stack(layers, env.W, env.H, env.res, y0, y1, grainFrom === null ? undefined : { from: grainFrom, theme: env.theme, seed });
  return { ...s, tile: false };
}

/** Zapętlony kafel przycięty do pasa y0…y1 (przesuwa się z kamerą albo dryfuje). */
export function tile(a: PaintArgs, env: LitEnv, src: HTMLCanvasElement, y0: number, y1: number, k: number, drift?: number): LitLayer {
  const s = stack([src], a.tileW, env.H, env.res, y0, y1);
  return { ...s, tile: true, k, drift };
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

// ------------------------------------------------------------------ niebo i chmury

/** Niebo z poświatą słońca i mgiełką nad horyzontem (cała szerokość sceny, bez przewijania). */
export function paintSkyLit(a: PaintArgs, l: Look, horizon = a.lay.floorY): HTMLCanvasElement {
  const { lay } = a;
  const W = lay.W, H = lay.H, hz = horizon;
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

/** Cumulus: bryła z kilku kół, płaska podstawa, jasna strona od słońca, cień od spodu. */
export function cloudLit(ctx: Ctx, l: Look, x: number, y: number, s: number, r: () => number) {
  const side = litSide(l);
  const parts = 5 + Math.floor(r() * 4), wide = 50 + r() * 50, tall = 0.6 + r() * 0.7;
  const blobs: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < parts; i++) {
    const t = i / (parts - 1), hump = Math.sin(t * Math.PI);
    blobs.push({ x: x + (t - 0.5) * wide * s + (r() - 0.5) * 8 * s, y: y - hump * (5 + r() * 10) * tall * s, r: (6 + hump * 11 * tall + r() * 5) * s });
  }
  const body = () => { ctx.beginPath(); blobs.forEach((o) => { ctx.moveTo(o.x + o.r, o.y); ctx.arc(o.x, o.y, o.r, 0, TAU); }); };
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 80 * s, y - 60 * s, 160 * s, 60 * s + 4 * s); ctx.clip();
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

/**
 * Kafel chmur: smugi przy horyzoncie (rozmyte) i cumulusy — wyżej większe i bliższe,
 * niżej mniejsze i płaskie. `top`/`bottom` — pas chmur (y), `n` — liczba na 340 px kafla,
 * `size` — skala.
 */
export function paintCloudsLit(a: PaintArgs, l: Look, o: { top: number; bottom: number; n?: number; size?: number; streaks?: boolean; seed?: number }): HTMLCanvasElement {
  const { lay, tileW } = a;
  const { c, ctx } = canvasOf(tileW, lay.H, a.res);
  const r = rng(a.seed ^ 0xc1 ^ (o.seed || 0));
  const k = lay.H / 300, size = o.size ?? 1;
  if (o.streaks !== false) {
    blurred(ctx, tileW, lay.H, a.res, 1.5, (t) => {
      for (let q = 0; q < tileW / 160; q++) {
        const x = r() * tileW, y = o.top + (o.bottom - o.top) * (0.7 + r() * 0.3), w = (40 + r() * 90) * k, h = (2 + r() * 2.5) * k;
        t.beginPath(); t.ellipse(x, y, w, h, 0, 0, TAU); t.fillStyle = hexA(mix(l.cloud, l.haze, 0.4), 0.5); t.fill();
      }
    });
  }
  const n = Math.max(2, Math.round((tileW / 340) * (o.n ?? 1)));
  for (let q = 0; q < n; q++) {
    const x = (q + r() * 0.8) * (tileW / n);
    const t = r();
    const s = (1.15 - 0.55 * t) * k * size * (0.75 + r() * 0.45);
    const y = Math.max(o.top + 36 * s, o.top + (o.bottom - o.top) * (0.25 + 0.6 * t)); // cała chmura w pasie
    const seed = a.seed * 13 + q + (o.seed || 0) * 101;
    for (const xx of [x, x - tileW, x + tileW]) if (xx > -100 * s && xx < tileW + 100 * s) cloudLit(ctx, l, xx, y, s, rng(seed));
  }
  return c;
}

// ------------------------------------------------------------------ snopy światła, cień zwierzęcia

/** Snopy od słońca (ląd, powietrze): wychodzą z poświaty i gasną nad gruntem. */
export function sunRays(l: Look, env: LitEnv, bottom: number, r: () => number): LitRays | null {
  if (l.rays <= 0) return null;
  const sx = l.sun.x * env.W, sy = l.sun.y * env.H, n = 4;
  const xs: number[] = [], widths: number[] = [];
  for (let i = 0; i < n; i++) { xs.push(sx + (i - (n - 1) / 2) * env.W * 0.05 + (r() - 0.5) * 20); widths.push(50 + r() * 60); }
  return { xs, y: sy - 8, h: bottom - sy + 8, widths, skew: -0.55 * litSide(l), alpha: l.rays };
}

/** Snopy spod powierzchni wody: rozłożone na całą szerokość, pochylone od słońca. */
export function waterRays(l: Look, env: LitEnv, top: number, bottom: number, r: () => number): LitRays | null {
  if (l.rays <= 0) return null;
  const n = 5, xs: number[] = [], widths: number[] = [];
  for (let i = 0; i < n; i++) { xs.push((i + 0.3 + r() * 0.5) * (env.W / n)); widths.push(40 + r() * 50); }
  return { xs, y: top, h: bottom - top, widths, skew: -0.25 * litSide(l), alpha: l.rays };
}

/** Snop światła: miękki na obu końcach (wychodzi z poświaty, gaśnie nad gruntem). */
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
