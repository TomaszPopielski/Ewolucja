/*
 * lit-land.ts — scena lądowa ze światłem: niebo, zamglone góry (w mezozoiku
 * dymiący wulkan), wzgórza z lasem, grunt w perspektywie z tylnym rzędem
 * roślin danej ery, trawy lub paprocie pierwszego planu i rama kadru.
 *
 * Roślinność ery: paleozoik — bagienny las widłaków (lepidodendrony, skrzypy,
 * paprocie drzewiaste) z kałużami; mezozoik — araukarie, sagowce, paprocie
 * i iglaste; kenozoik — sawanna z gajami drzew liściastych, akacjami i trawą.
 * Ląd się nie przesuwa (płyną tylko chmury), więc warstwy są sklejane.
 */
import { rng } from '../creature/spec.ts';
import {
  canvasOf, hexA, mix, ink, wash, wrapped, wildflowers, lepidodendron, horsetail, fern, araucaria, cycad, treefern,
  type Brush, type PaintArgs
} from './scenery.ts';
import { litSide, type Look } from './looks.ts';
import {
  TAU, castShadow, litObject, blurred, still, tile, paintSkyLit, paintCloudsLit, sunRays,
  type Ctx, type LitEnv, type LitRecipe
} from './light.ts';

// ------------------------------------------------------------------ rośliny i skały w świetle (kenozoik)

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

/** Góry na horyzoncie: ostre grzbiety, ściany od słońca jaśniejsze, mocno zamglone i rozmyte. */

// ------------------------------------------------------------------ rośliny paleozoiku i mezozoiku

/** Kępka paproci w barwach palety (drobna, bez osobnego płótna — rozsiana po całym gruncie). */
function fernTuftLit(ctx: Ctx, b: Brush, l: Look, x: number, y: number, s: number, r: () => number) {
  const side = litSide(l);
  for (let f = 0; f < 5; f++) {
    const ang = -Math.PI / 2 + (f - 2) * 0.5, len = (9 + r() * 7) * s;
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len * 0.75;
    const cx = x + Math.cos(ang) * len * 0.6, cy = y + Math.sin(ang) * len - 3 * s;
    const sunny = Math.cos(ang) * side > 0.1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(cx, cy, ex, ey);
    for (let q = 1; q < 6; q++) {
      const t = q / 6, px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex, py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey;
      const w = (1 - t) * 3 * s; ctx.moveTo(px - w, py - w * 0.5); ctx.lineTo(px, py); ctx.lineTo(px + w, py - w * 0.5);
    }
    ctx.strokeStyle = hexA(sunny ? mix(l.leafLit, l.leaf, 0.3) : l.leaf, 0.95 * b.alpha); ctx.lineWidth = 1 * b.line; ctx.stroke();
  }
}

/** Kałuża na bagnistym gruncie: odbija niebo, ciemniejszy brzeg od widza. */
function puddle(ctx: Ctx, b: Brush, l: Look, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  g.addColorStop(0, mix(l.waterTop, l.skyHorizon, 0.5)); g.addColorStop(1, mix(l.waterTop, l.skyTop, 0.35));
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.strokeStyle = hexA(l.shade, 0.35 * b.alpha); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x - rx * 0.2, y - ry * 0.25, rx * 0.45, ry * 0.18, 0, 0, TAU); ctx.fillStyle = hexA('#ffffff', 0.25 * b.alpha); ctx.fill();
  ink(ctx, b, 0.6, 0.35);
}

/** Liść paproci pod światło (pierwszy plan i rama): łodyga z listkami malejącymi ku końcowi. */
function frond(t: Ctx, x: number, y: number, len: number, ang: number, curl: number, color: string, rim: string | null) {
  const pts: [number, number][] = [];
  let px = x, py = y, a = ang;
  for (let i = 0; i <= 14; i++) { pts.push([px, py]); px += Math.cos(a) * len / 14; py += Math.sin(a) * len / 14; a += curl / 14; }
  t.beginPath(); pts.forEach(([qx, qy], i) => (i ? t.lineTo(qx, qy) : t.moveTo(qx, qy)));
  t.strokeStyle = color; t.lineWidth = Math.max(1.5, len * 0.025); t.lineCap = 'round'; t.stroke();
  for (let i = 1; i < 14; i++) {
    const [qx, qy] = pts[i], [nx, ny] = pts[i + 1], d = Math.atan2(ny - qy, nx - qx), w = len * 0.11 * (1 - i / 15);
    for (const side of [-1, 1]) {
      t.save(); t.translate(qx, qy); t.rotate(d + side * 1.05);
      t.beginPath(); t.ellipse(w * 0.55, 0, w * 0.6, w * 0.2, 0, 0, TAU); t.fillStyle = color; t.fill();
      if (rim && side < 0 && i % 2) { t.beginPath(); t.ellipse(w * 0.6, -w * 0.08, w * 0.45, w * 0.06, 0, 0, TAU); t.fillStyle = rim; t.fill(); }
      t.restore();
    }
  }
}

// ------------------------------------------------------------------ warstwy

/** Góry na horyzoncie: ostre grzbiety, ściany od słońca jaśniejsze, mocno zamglone; w mezozoiku dymiący wulkan. */
export function paintMountainsLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, tileW, theme } = a;
  const H = lay.H;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0x6d);
  const base = lay.floorY - H * 0.01, peak = H * (a.era === 'paleozoik' ? 0.2 : 0.26);
  const f = [2 + Math.floor(r() * 2), 5 + Math.floor(r() * 3), 13 + Math.floor(r() * 4)];
  const p = [r() * TAU, r() * TAU, r() * TAU];
  const ridgeY = (x: number) => {
    const u = (x / tileW) * TAU;
    const ridge = (kk: number, ph: number) => 1 - Math.abs(Math.sin(u * kk / 2 + ph));
    return base - peak * (0.55 * Math.pow(ridge(f[0], p[0]), 1.6) + 0.3 * ridge(f[1], p[1]) + 0.15 * (0.5 + 0.5 * Math.sin(u * f[2] + p[2])));
  };
  // wulkan (mezozoik): stożek ze ściętym kraterem, wyższy od pasma
  const vx = tileW * 0.37, vw = H * 0.32, vTop = base - peak * 1.15;
  const volcanoY = (x: number) => {
    const d = Math.abs(x - vx);
    if (d < 6) return vTop;
    return vTop + Math.pow(Math.max(0, (d - 6) / vw), 1.25) * (base - vTop);
  };
  const yAt = a.era === 'mezozoik' ? (x: number) => Math.min(ridgeY(x), volcanoY(x)) : ridgeY;
  ctx.filter = 'blur(' + (1.1 * a.res).toFixed(1) + 'px)';
  const outline = () => { ctx.beginPath(); ctx.moveTo(0, base + 4); for (let x = 0; x <= tileW; x += 3) ctx.lineTo(x, yAt(x)); ctx.lineTo(tileW, base + 4); ctx.closePath(); };
  outline();
  const g = ctx.createLinearGradient(0, base - peak, 0, base);
  g.addColorStop(0, mix(l.mountain, l.skyTop, 0.15)); g.addColorStop(1, mix(l.mountain, l.haze, 0.6));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); outline(); ctx.clip();
  if (l.snowCaps) {
    const sl = base - peak * 0.55;
    const sg = ctx.createLinearGradient(0, base - peak * 1.15, 0, sl + 8);
    sg.addColorStop(0, hexA('#f8fafb', 0.95)); sg.addColorStop(0.8, hexA('#f8fafb', 0.8)); sg.addColorStop(1, hexA('#f8fafb', 0));
    ctx.fillStyle = sg; ctx.fillRect(0, base - peak * 1.15 - 4, tileW, sl - (base - peak * 1.15) + 12);
  }
  // ściany: nachylone ku słońcu jaśniejsze, odwrócone ciemniejsze; granica schodzi po skosie
  const side = litSide(l);
  const litG = ctx.createLinearGradient(0, base - peak, 0, base);
  litG.addColorStop(0, hexA(l.sun.color, 0.5)); litG.addColorStop(1, hexA(l.sun.color, 0));
  const shG = ctx.createLinearGradient(0, base - peak, 0, base);
  shG.addColorStop(0, hexA(l.shade, 0.32)); shG.addColorStop(1, hexA(l.shade, 0));
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
  if (a.era === 'mezozoik') {
    // pióropusz dymu znoszony od słońca
    const smoke = mix(l.cloudShade, '#7a7068', 0.45);
    blurred(ctx, tileW, H, a.res, 3, (t) => {
      for (let i = 0; i < 9; i++) {
        const q = i / 8, px = vx - side * q * H * 0.32 + Math.sin(i * 1.7) * 4, py = vTop - 4 - q * H * 0.2, rr = (6 + q * 16) * (H / 300);
        t.beginPath(); t.ellipse(px, py, rr * 1.3, rr, 0, 0, TAU); t.fillStyle = hexA(smoke, 0.55 - q * 0.3); t.fill();
      }
    });
  }
  return c;
}

/** Daleki plan: łagodne wzgórza z pasem lasu danej ery, przygaszone mgiełką. */
export function paintFarLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, tileW, theme } = a;
  const H = lay.H, k = H / 300;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0xfa);
  const base = lay.floorY + 3, hillH = H * 0.075;
  const f1 = 2 + Math.floor(r() * 2), f2 = 6 + Math.floor(r() * 3);
  const yAt = (x: number) => base - hillH * (0.5 + 0.35 * Math.sin((x / tileW) * TAU * f1 + 1) + 0.15 * Math.sin((x / tileW) * TAU * f2));
  const side = litSide(l);
  const tree = mix(l.treeFar, l.haze, 0.3), treeLit = mix(tree, l.sun.color, 0.4), treeDark = mix(tree, l.leafShade, 0.25);
  blurred(ctx, tileW, H, a.res, 0.6, (t) => {
    t.beginPath(); t.moveTo(0, H); for (let x = 0; x <= tileW; x += 4) t.lineTo(x, yAt(x)); t.lineTo(tileW, H); t.closePath();
    const g = t.createLinearGradient(0, base - hillH, 0, base);
    g.addColorStop(0, mix(l.hill, l.haze, 0.25)); g.addColorStop(1, mix(l.hill, l.haze, 0.5));
    t.fillStyle = g; t.fill();
    // pas lasu na grzbietach: sylwetki drzew danej ery, jaśniejsze od słońca
    for (let x = 0; x < tileW; x += (7 + r() * 12) * k) {
      if (r() < 0.25) continue; // prześwity w lesie
      const y = yAt(x) + 3 * k, pick = r(), h = (12 + r() * 8) * k, rr = (4 + r() * 4) * k;
      wrapped(tileW, x, 16 * k, (xx) => {
        if (a.era === 'paleozoik' && pick < 0.6) {
          // lepidodendron: wysoki, smukły pień z kępką na szczycie
          const hh = h * 1.7;
          t.beginPath(); t.moveTo(xx, y); t.lineTo(xx, y - hh); t.strokeStyle = hexA(treeDark, 0.9); t.lineWidth = 1.6 * k; t.stroke();
          t.beginPath(); t.ellipse(xx, y - hh, 4 * k, 2.6 * k, 0, 0, TAU); t.fillStyle = hexA(tree, 0.95); t.fill();
          t.beginPath(); t.ellipse(xx + side * 1.4 * k, y - hh - 0.8 * k, 2.2 * k, 1.2 * k, 0, 0, TAU); t.fillStyle = hexA(treeLit, 0.6); t.fill();
        } else if (a.era === 'mezozoik' && pick < 0.55) {
          // araukaria: wysoki pień i płaska, piętrowa korona
          const hh = h * 1.5;
          t.beginPath(); t.moveTo(xx, y); t.lineTo(xx, y - hh); t.strokeStyle = hexA(treeDark, 0.9); t.lineWidth = 1.4 * k; t.stroke();
          for (let q = 0; q < 3; q++) {
            t.beginPath(); t.ellipse(xx, y - hh + q * 2.6 * k, (3.5 + q * 2) * k, 1.6 * k, 0, 0, TAU); t.fillStyle = hexA(q ? tree : treeLit, 0.95); t.fill();
          }
        } else if (a.era === 'kenozoik' ? pick < (l.snow > 0 ? 0.6 : 0.25) : pick < 0.8) {
          const w = 3.4 * k;
          t.beginPath(); t.moveTo(xx, y - h); t.lineTo(xx + w, y); t.lineTo(xx - w, y); t.closePath();
          t.fillStyle = hexA(treeDark, 0.95); t.fill();
          t.beginPath(); t.moveTo(xx, y - h); t.lineTo(xx + side * w, y); t.lineTo(xx, y); t.closePath();
          t.fillStyle = hexA(treeLit, 0.45); t.fill();
        } else {
          t.beginPath(); t.arc(xx, y - rr, rr, 0, TAU); t.fillStyle = hexA(tree, 0.95); t.fill();
          t.beginPath(); t.arc(xx + side * rr * 0.35, y - rr * 1.25, rr * 0.55, 0, TAU); t.fillStyle = hexA(treeLit, 0.55); t.fill();
        }
      });
    }
  });
  ctx.beginPath(); for (let x = 0; x <= tileW; x += 4) (x ? ctx.lineTo(x, yAt(x)) : ctx.moveTo(x, yAt(x)));
  ink(ctx, { th: theme, alpha: 0.3, line: 0.8 }, 1);
  // mgła u podstawy (w wilgotnym paleozoiku gęstsza)
  const mist = ctx.createLinearGradient(0, base - 16 * k, 0, base + 4);
  mist.addColorStop(0, hexA(l.haze, 0)); mist.addColorStop(1, hexA(l.haze, a.era === 'paleozoik' ? 0.7 : 0.55));
  ctx.fillStyle = mist; ctx.fillRect(0, base - 16 * k, tileW, 20 * k + 4);
  return c;
}

/** Środkowy plan: grunt w perspektywie, tylny rząd roślin ery z cieniami, drobne rośliny rosnące ku widzowi. */
export function paintMidLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, theme, tileW, era } = a;
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
  // kałuże i śnieg mają własne losowanie — rośliny stoją w tych samych miejscach w każdym klimacie
  const rw = rng(a.seed ^ 0x5e1);
  // kałuże bagiennego lasu (paleozoik)
  for (let q = 0; q < (tileW / 140) * l.puddles; q++) {
    const t = 0.15 + rw() * 0.85, x = rw() * tileW, y = top + 6 + t * (H - top - 10);
    const rx = (14 + rw() * 34) * (0.4 + t), ry = rx * (0.1 + 0.07 * t);
    wrapped(tileW, x, rx, (xx) => puddle(ctx, b, l, xx, y, rx, ry));
  }
  // płaty śniegu (zimno)
  for (let q = 0; q < (tileW / 26) * l.snow; q++) {
    const t = rw(), x = rw() * tileW, y = top + 4 + t * (H - top);
    const rx = (8 + rw() * 30) * (0.35 + t), ry = rx * (0.12 + 0.08 * t);
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

  // tylny rząd przy horyzoncie (zwierzęta zawsze przed nim): gaje na przemian z otwartym terenem
  type Kind = 'broadleaf' | 'conifer' | 'bare' | 'acacia' | 'shrub' | 'rock' | 'low' | 'lepido' | 'treefern' | 'horsetail' | 'fern' | 'araucaria' | 'cycad';
  const grovePick: (p: number) => Kind = era === 'paleozoik'
    ? (p) => (p < 0.5 ? 'lepido' : p < 0.8 ? 'treefern' : 'horsetail')
    : era === 'mezozoik'
      ? (p) => (p < 0.42 ? 'araucaria' : p < 0.64 ? 'conifer' : p < 0.84 ? 'treefern' : 'cycad')
      : (p) => (l.snow > 0 ? (p < 0.55 ? 'conifer' : p < 0.55 + 0.45 * l.bare ? 'bare' : 'broadleaf') : (p < 0.62 ? 'broadleaf' : 'conifer'));
  const underPick: Kind = era === 'kenozoik' ? 'shrub' : era === 'mezozoik' ? 'cycad' : 'fern';
  const openPick: (p: number) => Kind = era === 'paleozoik'
    ? (p) => (p < 0.3 ? 'treefern' : p < 0.55 ? 'horsetail' : p < 0.75 ? 'rock' : 'fern')
    : era === 'mezozoik'
      ? (p) => (p < 0.3 ? 'cycad' : p < 0.5 ? 'fern' : p < 0.75 ? 'rock' : 'horsetail')
      : (p) => (p < 0.3 ? (l.snow > 0 ? 'bare' : 'acacia') : p < 0.55 ? 'shrub' : p < 0.75 ? 'rock' : 'low');
  type Item = { x: number; y: number; s: number; kind: Kind; seed: number };
  const items: Item[] = [];
  const dense = era !== 'kenozoik'; // las widłaków i araukarii gęstszy niż sawanna
  const groves = Math.max(2, Math.round(tileW / (dense ? 300 : 380)));
  for (let gi = 0; gi < groves; gi++) {
    const gx = (gi + 0.15 + r() * 0.5) * (tileW / groves), n = (dense ? 3 : 2) + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      items.push({ x: gx + (i - n / 2) * (16 + r() * 14) * k, y: yAt(gx) + 1 + r() * 8 * k, s: (0.75 + r() * 0.65) * k, kind: grovePick(r()), seed: a.seed * 31 + gi * 10 + i });
    }
    for (let i = 0; i < 3; i++) items.push({ x: gx + (r() - 0.5) * n * 26 * k, y: yAt(gx) + 6 * k + r() * 5 * k, s: (0.7 + r() * 0.4) * k, kind: underPick, seed: a.seed * 53 + gi * 10 + i });
  }
  for (let q = 0; q < tileW / (dense ? 70 : 90); q++) {
    const pick = r(), x = r() * tileW;
    items.push({ x, y: yAt(x) + 2 + r() * 10 * k, s: (0.7 + r() * 0.5) * k, kind: openPick(pick), seed: a.seed * 71 + q });
  }
  items.sort((p, q) => p.y - q.y); // dalsze najpierw
  // dawne rysunki (scenery.ts) dostają światło przez litObject; cień rzucany rysowany osobno
  const old = (xx: number, it: Item, halfW: number, h: number, draw: (t: Ctx, rr: () => number) => void) => {
    castShadow(ctx, b, l, xx, it.y, halfW * 0.8, h * 0.8, 0.3);
    litObject(ctx, l, a.res, xx, it.y, halfW, h, 'side', 0, l.haze, (t) => draw(t, rng(it.seed)));
  };
  for (const it of items) {
    const s = it.s;
    wrapped(tileW, it.x, 70 * s, (xx) => {
      const rr = rng(it.seed);
      switch (it.kind) {
        case 'broadleaf': broadleafLit(ctx, b, l, xx, it.y, s, rr); break;
        case 'conifer': coniferLit(ctx, b, l, xx, it.y, s, rr); break;
        case 'bare': bareTreeLit(ctx, b, l, xx, it.y, s, rr); break;
        case 'acacia': acaciaLit(ctx, b, l, xx, it.y, s, rr); break;
        case 'shrub': shrubLit(ctx, b, l, xx, it.y, s, rr); break;
        case 'rock': rockLit(ctx, b, l, xx, it.y, s, rr); break;
        case 'lepido': old(xx, it, 46 * s, 172 * s, (t, q) => lepidodendron(t, b, xx, it.y, s, q)); break;
        case 'treefern': old(xx, it, 34 * s, 62 * s, (t, q) => treefern(t, b, xx, it.y, s, q)); break;
        case 'horsetail': old(xx, it, 14 * s, 42 * s, (t, q) => horsetail(t, b, xx, it.y, s, q)); break;
        case 'fern': old(xx, it, 30 * s, 30 * s, (t, q) => fern(t, b, xx, it.y, s, q)); break;
        case 'araucaria': old(xx, it, 34 * s, 122 * s, (t, q) => araucaria(t, b, xx, it.y, s, q)); break;
        case 'cycad': old(xx, it, 28 * s, 48 * s, (t, q) => cycad(t, b, xx, it.y, s, q)); break;
        default: if (l.flowers) wildflowers(ctx, b, xx, it.y, 1.1 * s, rr); else grassLit(ctx, b, l, xx, it.y, 1.2 * s, rr);
      }
    });
  }
  // drobne rośliny i kamyki na całym gruncie, w skupiskach, większe bliżej widza
  // (kenozoik: trawy i kwiaty; wcześniej, przed trawami: paprocie i skrzypy)
  const patches = Array.from({ length: Math.round(tileW / 60) }, () => ({ x: r() * tileW, t: Math.pow(r(), 0.8) }));
  for (let q = 0; q < tileW / 11; q++) {
    const pt = patches[q % patches.length];
    const t = Math.max(0, Math.min(1, pt.t + (r() - 0.5) * 0.25)), x = pt.x + (r() - 0.5) * (30 + 60 * t), y = top + 8 + t * (H - top - 8);
    const s = (0.5 + 0.95 * t) * k, gs = a.seed * 97 + q, pick = r();
    wrapped(tileW, x, 14 * s, (xx) => {
      if (era === 'kenozoik') {
        if (pick < 0.82) grassLit(ctx, b, l, xx, y, s, rng(gs));
        else if (pick < 0.92 && l.flowers) wildflowers(ctx, b, xx, y, 0.8 * s, rng(gs));
        else rockLit(ctx, b, l, xx, y, 0.45 * s, rng(gs));
      } else if (pick < 0.62) fernTuftLit(ctx, b, l, xx, y, s, rng(gs));
      else if (pick < 0.82) horsetail(ctx, b, xx, y, 0.55 * s, rng(gs));
      else if (pick < 0.92) grassLit(ctx, b, { ...l, grass: mix(l.grass, l.leafShade, 0.3) }, xx, y, 0.7 * s, rng(gs)); // mech
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

/** Źdźbło trawy pod światło (pierwszy plan i rama). */
function blade(t: Ctx, bx: number, H: number, h: number, lean: number, k: number, color: string) {
  t.beginPath(); t.moveTo(bx - 2.3 * k, H + 4); t.quadraticCurveTo(bx + lean * 0.3, H - h * 0.6, bx + lean, H - h);
  t.quadraticCurveTo(bx + lean * 0.3 + 1.5 * k, H - h * 0.55, bx + 2.3 * k, H + 4); t.closePath();
  t.fillStyle = color; t.fill();
}

/** Pierwszy plan: ciemne kępy traw (kenozoik) albo liście paproci, pod światło i rozmyte. */
export function paintNearLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, tileW } = a;
  const H = lay.H, k = H / 300;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0x77);
  const dark = hexA(mix(l.frame, l.grass, 0.35), 0.92), rim = hexA(mix(l.grass, l.lit, 0.5), 0.92);
  const n = Math.max(3, Math.round(tileW / 300));
  blurred(ctx, tileW, H, a.res, 2.2, (t) => {
    for (let q = 0; q < n; q++) {
      const x = (q + r() * 0.6) * (tileW / n);
      const seed = a.seed * 7 + q;
      wrapped(tileW, x, 70 * k, (xx) => {
        const rr = rng(seed);
        if (a.era === 'kenozoik') {
          for (let i = 0; i < 12; i++) blade(t, xx + (rr() - 0.5) * 34 * k, H, (22 + rr() * 30) * k, (rr() - 0.5) * 26 * k, k, i % 4 === 0 ? rim : dark);
        } else {
          for (let i = 0; i < 4; i++) frond(t, xx + (rr() - 0.5) * 20 * k, H + 4, (34 + rr() * 26) * k, -Math.PI / 2 + (rr() - 0.5) * 1.6, (rr() - 0.5) * 1.2, dark, i % 2 ? rim : null);
        }
      });
    }
  });
  return c;
}

/**
 * Rama kadru (nad zwierzętami, bez przewijania): w dolnych rogach kępy wysokich
 * traw (kenozoik) albo wielkie liście paproci, ciemne, pod światło i rozmyte —
 * jak pierwszy plan gabloty.
 */
export function paintFrameLit(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay } = a;
  const W = lay.W, H = lay.H, k = H / 300;
  const { c, ctx } = canvasOf(W, H, a.res);
  const r = rng(a.seed ^ 0x51);
  const leafRim = mix(l.leafLit, l.sun.color, 0.3);
  const col = (i: number) => hexA(i % 5 === 0 ? mix(l.grass, leafRim, 0.45) : i % 3 === 0 ? mix(l.frame, l.grass, 0.3) : l.frame, 0.94);
  blurred(ctx, W, H, a.res, 2.4, (t) => {
    const clump = (cx: number, toward: number, n: number, tall: number) => {
      if (a.era === 'kenozoik') {
        for (let i = 0; i < n; i++) blade(t, cx + (r() - 0.5) * 40 * k, H, (tall * 0.5 + r() * tall) * k, toward * (4 + r() * 26) * k, k * 1.05, col(i));
      } else {
        // liście paproci wychylone ku środkowi kadru
        for (let i = 0; i < Math.round(n / 3); i++) {
          frond(t, cx + (r() - 0.5) * 24 * k, H + 6, (tall * 0.9 + r() * tall * 0.6) * k, -Math.PI / 2 + toward * (0.25 + r() * 0.6), toward * (0.5 + r() * 0.5),
            hexA(i % 2 ? mix(l.frame, l.leafShade, 0.3) : l.frame, 0.95), i % 2 ? null : hexA(leafRim, 0.5));
        }
      }
    };
    clump(-6 * k, 1, 12, 52);
    clump(W + 4 * k, -1, 16, 62);
  });
  return c;
}

// ------------------------------------------------------------------ przepis sceny

/** Ląd: niebo z górami i wzgórzami (jeden obraz), dryfujące chmury, snopy, grunt z roślinnością, pierwszy plan i rama. */
export function landRecipe(a: PaintArgs, l: Look, env: LitEnv): LitRecipe {
  const { lay } = a, k = env.H / 300;
  const sky = still(env, [paintSkyLit(a, l), paintMountainsLit(a, l), paintFarLit(a, l)], 0, env.H, 0, a.seed);
  const clouds = tile(a, env, paintCloudsLit(a, l, { top: 0, bottom: lay.floorY * 0.62 }), 0, lay.floorY * 0.8, 0, 3);
  // najwyższe rośliny tylnego rzędu: lepidodendrony ok. 180 px, araukarie ok. 150 px, drzewa kenozoiku ok. 135 px (scena 300 px)
  const reach = a.era === 'paleozoik' ? 185 : a.era === 'mezozoik' ? 155 : 135;
  const ground = still(env, [paintMidLit(a, l), paintLightLit(a, l)], lay.floorY - reach * k, env.H, lay.floorY, a.seed + 1);
  const front = still(env, [paintNearLit(a, l), paintFrameLit(a, l)], env.H - 115 * k, env.H);
  return { back: [sky, clouds, ground], raysAfter: 1, rays: sunRays(l, env, lay.floorY + env.H * 0.12, rng(a.seed ^ 0x5a)), front: [front] };
}
