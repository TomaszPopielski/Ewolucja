/*
 * lit-water.ts — sceny wodne ze światłem: otwarte morze i przybrzeże.
 *
 * Pod wodą światło pada z góry: toń jaśnieje pod powierzchnią i ciemnieje
 * w głębi, dal tonie w zamgleniu toni, rośliny i zwierzęta dna mają jasne
 * wierzchy i cień pod sobą, a na piasku tańczą refleksy (kaustyki — tylko na
 * wysokiej jakości). Przybrzeże łączy niebo i brzeg nad powierzchnią z płytką,
 * jasną wodą pod nią. Przy zimnie na powierzchni pływa kra.
 *
 * Fauna i flora dna według ery: paleozoik — liliowce, gąbki, trylobity,
 * ramienionogi, łodzikowce, stromatolity na przybrzeżu; mezozoik — koralowce,
 * amonity, jeżowce; kenozoik — las kelpowy, koralowce, rozgwiazdy, trawa morska.
 */
import { rng } from '../creature/spec.ts';
import {
  canvasOf, hexA, mix, ink, wrapped, crinoid, sponge, algae, trilobite, ammonite, coral, kelp, seastar, rock, stromatolite,
  nautiloid, brachiopod, urchin, seagrass,
  type Brush, type PaintArgs
} from './scenery.ts';
import { litSide, type Look } from './looks.ts';
import {
  TAU, litObject, blurred, still, tile, paintSkyLit, paintCloudsLit, waterRays,
  type Ctx, type LitEnv, type LitRecipe
} from './light.ts';

type Kind = 'crinoid' | 'sponge' | 'algae' | 'trilobite' | 'ammonite' | 'coral' | 'kelp' | 'seastar' | 'rock' | 'stromatolite' | 'nautiloid' | 'brachiopod' | 'urchin' | 'seagrass';

/** Co rośnie i żyje na dnie: tylny rząd (wyższe formy) i drobnica rozsiana po dnie. */
function seabedFauna(era: PaintArgs['era'], coast: boolean): { back: (p: number) => Kind; scatter: (p: number) => Kind } {
  if (coast) {
    if (era === 'paleozoik') return { back: (p) => (p < 0.55 ? 'stromatolite' : p < 0.8 ? 'algae' : 'rock'), scatter: (p) => (p < 0.4 ? 'brachiopod' : p < 0.7 ? 'stromatolite' : 'rock') };
    if (era === 'mezozoik') return { back: (p) => (p < 0.4 ? 'coral' : p < 0.7 ? 'algae' : 'rock'), scatter: (p) => (p < 0.35 ? 'seastar' : p < 0.6 ? 'ammonite' : 'rock') };
    return { back: (p) => (p < 0.45 ? 'seagrass' : p < 0.7 ? 'coral' : 'rock'), scatter: (p) => (p < 0.4 ? 'seastar' : p < 0.7 ? 'seagrass' : 'rock') };
  }
  if (era === 'paleozoik') return { back: (p) => (p < 0.45 ? 'crinoid' : p < 0.7 ? 'sponge' : p < 0.88 ? 'algae' : 'rock'), scatter: (p) => (p < 0.3 ? 'trilobite' : p < 0.55 ? 'brachiopod' : p < 0.7 ? 'nautiloid' : 'rock') };
  if (era === 'mezozoik') return { back: (p) => (p < 0.45 ? 'coral' : p < 0.65 ? 'sponge' : p < 0.85 ? 'algae' : 'rock'), scatter: (p) => (p < 0.35 ? 'ammonite' : p < 0.6 ? 'urchin' : 'rock') };
  return { back: (p) => (p < 0.24 ? 'kelp' : p < 0.55 ? 'coral' : p < 0.8 ? 'algae' : 'rock'), scatter: (p) => (p < 0.35 ? 'seastar' : p < 0.6 ? 'urchin' : 'rock') };
}

/** Rysunek dawnej formy (scenery.ts) z ramką do nałożenia światła. */
function drawKind(kind: Kind, b: Brush, x: number, y: number, s: number, seed: number, kelpTop: number):
  { halfW: number; h: number; draw: (t: Ctx) => void } {
  const r = () => rng(seed);
  switch (kind) {
    case 'crinoid': return { halfW: 22 * s, h: 74 * s, draw: (t) => crinoid(t, b, x, y, s, r()) };
    case 'sponge': return { halfW: 16 * s, h: 32 * s, draw: (t) => sponge(t, b, x, y, s, r()) };
    case 'algae': return { halfW: 14 * s, h: 44 * s, draw: (t) => algae(t, b, x, y, s, r()) };
    case 'trilobite': return { halfW: 10 * s, h: 9 * s, draw: (t) => trilobite(t, b, x, y, s) };
    case 'ammonite': return { halfW: 9 * s, h: 14 * s, draw: (t) => ammonite(t, b, x, y, s) };
    case 'coral': return { halfW: 22 * s, h: 30 * s, draw: (t) => coral(t, b, x, y, s, r(), '#d9846c') };
    case 'kelp': return { halfW: 18 * s, h: y - kelpTop + 8, draw: (t) => kelp(t, b, x, y, kelpTop, s, r()) };
    case 'seastar': return { halfW: 8 * s, h: 8 * s, draw: (t) => seastar(t, b, x, y, s) };
    case 'stromatolite': return { halfW: 20 * s, h: 22 * s, draw: (t) => stromatolite(t, b, x, y, s, r()) };
    case 'nautiloid': return { halfW: 18 * s, h: 18 * s, draw: (t) => nautiloid(t, b, x, y, s) };
    case 'brachiopod': return { halfW: 8 * s, h: 12 * s, draw: (t) => brachiopod(t, b, x, y, s) };
    case 'urchin': return { halfW: 11 * s, h: 16 * s, draw: (t) => urchin(t, b, x, y, s) };
    case 'seagrass': return { halfW: 14 * s, h: 34 * s, draw: (t) => seagrass(t, b, x, y, s, r()) };
    default: return { halfW: 18 * s, h: 14 * s, draw: (t) => rock(t, b, x, y, s, r()) };
  }
}

/** Wstążka wodorostu (pierwszy plan, rama): pas wzdłuż fali, zwężający się ku górze. */
function weed(t: Ctx, x: number, y: number, h: number, sway: number, w: number, color: string, rim: string | null) {
  const n = 16, left: [number, number][] = [], right: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const q = i / n, cx = x + Math.sin(q * 4 + sway) * 8 * q + sway * 6 * q, cy = y - h * q, ww = w * (1 - q * 0.85);
    left.push([cx - ww, cy]); right.push([cx + ww, cy]);
  }
  t.beginPath(); left.forEach(([px, py], i) => (i ? t.lineTo(px, py) : t.moveTo(px, py)));
  for (let i = right.length - 1; i >= 0; i--) t.lineTo(right[i][0], right[i][1]);
  t.closePath(); t.fillStyle = color; t.fill();
  if (rim) { t.beginPath(); right.forEach(([px, py], i) => (i ? t.lineTo(px, py) : t.moveTo(px, py))); t.strokeStyle = rim; t.lineWidth = 1.2; t.stroke(); }
}

// ------------------------------------------------------------------ warstwy wody

/** Toń (cała szerokość sceny, nieruchoma): jaśnieje pod powierzchnią, ciemnieje w głębi; w przybrzeżu nad nią niebo. */
function paintWaterBg(a: PaintArgs, l: Look, coast: boolean): HTMLCanvasElement {
  const { lay } = a;
  const W = lay.W, H = lay.H, sy = lay.surfaceY;
  const sky = coast ? paintSkyLit(a, l, sy) : null;
  const { c, ctx } = canvasOf(W, H, a.res);
  if (sky) ctx.drawImage(sky, 0, 0, W, H);
  const g = ctx.createLinearGradient(0, sy, 0, H);
  if (coast) {
    g.addColorStop(0, mix(l.waterTop, '#ffffff', 0.15)); g.addColorStop(0.55, l.waterTop);
    g.addColorStop((lay.floorY - sy) / (H - sy), mix(l.waterHaze, l.waterTop, 0.4)); g.addColorStop(1, mix(l.waterDeep, l.waterTop, 0.35));
  } else {
    g.addColorStop(0, mix(l.waterTop, '#ffffff', 0.2)); g.addColorStop(0.3, l.waterTop);
    g.addColorStop((lay.floorY - sy) / (H - sy), mix(l.waterHaze, l.waterDeep, 0.35)); g.addColorStop(1, l.waterDeep);
  }
  ctx.fillStyle = g; ctx.fillRect(0, sy, W, H - sy);
  // jasna plama pod powierzchnią od strony słońca
  const sx = l.sun.x * W;
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.6);
  glow.addColorStop(0, hexA(mix(l.sun.color, l.waterTop, 0.3), 0.55)); glow.addColorStop(1, hexA(l.waterTop, 0));
  ctx.fillStyle = glow; ctx.fillRect(0, sy, W, H - sy);
  // zamglenie toni ku horyzontowi dna
  const hz = ctx.createLinearGradient(0, lay.floorY - H * 0.3, 0, lay.floorY + 4);
  hz.addColorStop(0, hexA(l.waterHaze, 0)); hz.addColorStop(1, hexA(l.waterHaze, 0.55));
  ctx.fillStyle = hz; ctx.fillRect(0, lay.floorY - H * 0.3, W, H * 0.3 + 4);
  return c;
}

/** Powierzchnia (kafel): jasna, falista granica z pasem refleksów; przy zimnie kra. */
function paintSurface(a: PaintArgs, l: Look, coast: boolean): HTMLCanvasElement {
  const { lay, tileW, theme } = a;
  const { c, ctx } = canvasOf(tileW, lay.H, a.res);
  const r = rng(a.seed ^ 0x5f);
  const sy = lay.surfaceY;
  const wy = (x: number) => sy + 1.8 * Math.sin((x / tileW) * TAU * 18) + 1.2 * Math.sin((x / tileW) * TAU * 7);
  // pas refleksów pod powierzchnią
  ctx.beginPath(); ctx.moveTo(0, wy(0)); for (let x = 0; x <= tileW; x += 4) ctx.lineTo(x, wy(x)); for (let x = tileW; x >= 0; x -= 4) ctx.lineTo(x, wy(x) + 6);
  ctx.closePath(); ctx.fillStyle = hexA('#ffffff', theme.dark ? 0.1 : 0.4); ctx.fill();
  ctx.beginPath(); for (let x = 0; x <= tileW; x += 4) (x ? ctx.lineTo(x, wy(x)) : ctx.moveTo(x, wy(x)));
  ctx.strokeStyle = hexA(mix(l.waterDeep, l.waterTop, 0.3), 0.9); ctx.lineWidth = 1.4; ctx.stroke();
  // drobne błyski i piana
  ctx.beginPath();
  for (let x = 6; x < tileW; x += 12 + r() * 20) { const y = wy(x) + 3 + r() * (coast ? 7 : 5); ctx.moveTo(x, y); ctx.lineTo(x + 4 + r() * 9, y); }
  ctx.strokeStyle = hexA('#ffffff', theme.dark ? 0.25 : 0.75); ctx.lineWidth = 1; ctx.stroke();
  if (l.ice) {
    // kra: płaty lodu na powierzchni, jasne od góry, sinawe od spodu
    const ri = rng(a.seed ^ 0x1ce);
    for (let x = ri() * 30; x < tileW - 20; x += 40 + ri() * 70) {
      const w = 24 + ri() * 50, up = coast ? 4 + ri() * 4 : 0, down = 4 + ri() * 5;
      ctx.beginPath(); ctx.moveTo(x, sy - up); ctx.lineTo(x + w, sy - up + ri() * 2); ctx.lineTo(x + w - 3, sy + down); ctx.lineTo(x + 4, sy + down + 1); ctx.closePath();
      ctx.fillStyle = hexA('#f3f7f9', 0.95); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + w - 3, sy + down); ctx.lineTo(x + 4, sy + down + 1); ctx.lineTo(x + 6, sy + 1); ctx.lineTo(x + w - 5, sy + 1); ctx.closePath();
      ctx.fillStyle = hexA(l.shade, 0.25); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, sy - up); ctx.lineTo(x + w, sy - up + 1); ctx.lineTo(x + w - 3, sy + down); ctx.lineTo(x + 4, sy + down + 1); ctx.closePath();
      ink(ctx, { th: theme, alpha: 0.5, line: 0.8 }, 1);
    }
  }
  return c;
}

/** Daleki plan pod wodą: grzbiety dna i sylwetki ery, zatopione w zamgleniu toni. */
function paintReefFar(a: PaintArgs, l: Look, coast: boolean): HTMLCanvasElement {
  const { lay, tileW, era } = a;
  const H = lay.H, k = H / 300;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0x2a);
  const base = lay.floorY + 2;
  const far = mix(l.waterHaze, l.waterDeep, coast ? 0.08 : 0.15), near = mix(l.waterHaze, l.waterDeep, coast ? 0.18 : 0.32);
  const f1 = 2 + Math.floor(r() * 3), f2 = 7 + Math.floor(r() * 4);
  const yAt = (x: number, hh: number, ph: number) => base - hh * (0.5 + 0.35 * Math.sin((x / tileW) * TAU * f1 + ph) + 0.15 * Math.sin((x / tileW) * TAU * f2 + ph));
  blurred(ctx, tileW, H, a.res, 1, (t) => {
    [[far, 0.11, 0.3], [near, 0.06, 1.7]].forEach(([col, hh, ph], row) => {
      const h = H * (hh as number);
      t.beginPath(); t.moveTo(0, H); for (let x = 0; x <= tileW; x += 5) t.lineTo(x, yAt(x, h, ph as number)); t.lineTo(tileW, H); t.closePath();
      t.fillStyle = col as string; t.fill();
      // sylwetki na grzbietach
      const kelpForest = era === 'kenozoik' && !coast;
      for (let x = r() * 30; x < tileW; x += (kelpForest ? 34 + r() * 60 : 18 + r() * 40) * k) {
        const y = yAt(x, h, ph as number) + 2, s = (0.7 + r() * 0.5) * k * (row ? 1 : 0.7);
        t.strokeStyle = col as string; t.fillStyle = col as string; t.lineCap = 'round';
        if (era === 'paleozoik' && !coast) {
          const hh2 = (30 + r() * 26) * s;
          t.beginPath(); t.moveTo(x, y); t.quadraticCurveTo(x + 3 * s, y - hh2 * 0.5, x + (r() - 0.5) * 8 * s, y - hh2); t.lineWidth = 1.6 * s; t.stroke();
          t.beginPath(); t.ellipse(x, y - hh2, 7 * s, 5 * s, 0, 0, TAU); t.fill();
        } else if (kelpForest) {
          const top = lay.surfaceY + 20 + r() * 40, sway = r() * 6;
          t.beginPath(); t.moveTo(x, y);
          for (let q = 1; q <= 10; q++) t.lineTo(x + Math.sin(q * 0.7 + sway) * 5 * s, y - (y - top) * q / 10);
          t.lineWidth = 2.2 * s; t.stroke();
        } else {
          const w = (10 + r() * 14) * s, hh2 = (8 + r() * 14) * s;
          t.beginPath(); t.ellipse(x, y, w, hh2, 0, Math.PI, 0); t.fill();
        }
      }
    });
  });
  return c;
}

/** Dno w perspektywie: piasek ze zmarszczkami, plamy osadu, fauna i flora ery z jasnym wierzchem i cieniem pod spodem. */
function paintSeabed(a: PaintArgs, l: Look, coast: boolean): HTMLCanvasElement {
  const { lay, tileW, theme, era } = a;
  const H = lay.H, top = lay.floorY, k = H / 300;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0x3d);
  const b: Brush = { th: theme, alpha: 1, line: 1 };
  const yAt = (x: number) => top + 1.5 * Math.sin((x / tileW) * TAU * 6) + 1.2 * Math.sin((x / tileW) * TAU * 2);
  const ground = () => { ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= tileW; x += 5) ctx.lineTo(x, yAt(x)); ctx.lineTo(tileW, H); ctx.closePath(); };
  ground();
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, mix(l.sand, l.waterHaze, coast ? 0.45 : 0.6)); g.addColorStop(1, mix(l.sand, l.lit, coast ? 0.15 : 0.05));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ground(); ctx.clip();
  // plamy osadu i światła
  for (let q = 0; q < tileW / 16; q++) {
    const t = r(), x = r() * tileW, y = top + 3 + t * (H - top);
    const rx = (10 + r() * 40) * (0.35 + t), ry = rx * (0.12 + 0.08 * t);
    const col = r() < 0.5 ? l.lit : mix(l.shade, l.sand, 0.4), al = 0.08 + r() * 0.12;
    wrapped(tileW, x, rx, (xx) => { ctx.beginPath(); ctx.ellipse(xx, y, rx, ry, 0, 0, TAU); ctx.fillStyle = hexA(col, al); ctx.fill(); });
  }
  // zmarszczki piasku: jasny grzbiet, cień pod nim; rzadsze bliżej widza
  for (let y = top + 6; y < H; y += 5 + ((y - top) / (H - top)) * 9) {
    const t = (y - top) / (H - top), amp = 1 + t * 2.2, per = 18 + t * 30;
    const ph = r() * TAU;
    ctx.beginPath(); for (let x = 0; x <= tileW; x += 6) { const yy = y + Math.sin((x / tileW) * TAU * Math.round(tileW / per) + ph) * amp; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.strokeStyle = hexA(l.lit, 0.18 + 0.2 * t); ctx.lineWidth = 0.8 + t; ctx.stroke();
    ctx.beginPath(); for (let x = 0; x <= tileW; x += 6) { const yy = y + 1.5 + t + Math.sin((x / tileW) * TAU * Math.round(tileW / per) + ph) * amp; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.strokeStyle = hexA(l.shade, 0.08 + 0.1 * t); ctx.lineWidth = 0.8; ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath(); for (let x = 0; x <= tileW; x += 5) (x ? ctx.lineTo(x, yAt(x)) : ctx.moveTo(x, yAt(x))); ink(ctx, b, 0.9, 0.4);

  const fauna = seabedFauna(era, coast);
  type Item = { x: number; y: number; s: number; kind: Kind; seed: number; haze: number };
  const items: Item[] = [];
  for (let q = 0; q < tileW / 46; q++) {
    const x = (q + r() * 0.8) * 46;
    items.push({ x, y: yAt(x) + 1 + r() * 8 * k, s: (0.8 + r() * 0.5) * k, kind: fauna.back(r()), seed: a.seed * 31 + q, haze: 0.28 });
  }
  for (let q = 0; q < tileW / 70; q++) {
    const t = 0.15 + r() * 0.85, x = r() * tileW;
    items.push({ x, y: top + 10 + t * (H - top - 14), s: (0.6 + 0.8 * t) * k, kind: fauna.scatter(r()), seed: a.seed * 57 + q, haze: 0.22 * (1 - t) });
  }
  items.sort((p, q) => p.y - q.y);
  const kelpTop = lay.surfaceY + 24;
  for (const it of items) {
    const d = drawKind(it.kind, b, 0, 0, it.s, it.seed, 0); // tylko rozmiar ramki
    wrapped(tileW, it.x, d.halfW + 8, (xx) => {
      const dk = drawKind(it.kind, b, xx, it.y, it.s, it.seed, kelpTop + (it.seed % 40));
      // cień pod spodem (światło z góry, lekko od słońca)
      ctx.beginPath(); ctx.ellipse(xx - litSide(l) * 2, it.y + 1, dk.halfW * 0.7, Math.max(1.5, 2.6 * it.s), 0, 0, TAU);
      ctx.fillStyle = hexA(l.shade, 0.22); ctx.fill();
      litObject(ctx, l, a.res, xx, it.y, dk.halfW, dk.h, 'top', it.haze, l.waterHaze, dk.draw);
    });
  }
  return c;
}

/** Kaustyki: sieć jasnych refleksów na dnie (kafel dryfujący; tylko na wysokiej jakości). */
function paintCaustics(a: PaintArgs, l: Look, coast: boolean): HTMLCanvasElement {
  const { lay, tileW } = a;
  const H = lay.H, top = lay.floorY;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0x6c);
  const col = mix(l.lit, '#ffffff', 0.4), strength = coast ? 0.45 : 0.32;
  blurred(ctx, tileW, H, a.res, 0.7, (t) => {
    for (let q = 0; q < tileW / 9; q++) {
      const d = r(), x = r() * tileW, y = top + 4 + d * (H - top - 4);
      const rx = (6 + r() * 12) * (0.4 + d), ry = rx * (0.22 + 0.12 * d);
      wrapped(tileW, x, rx + 2, (xx) => {
        t.beginPath();
        for (let i = 0; i <= 7; i++) {
          const ang = (i / 7) * TAU, wob = 0.75 + 0.5 * Math.abs(Math.sin(ang * 2 + q));
          const px = xx + Math.cos(ang) * rx * wob, py = y + Math.sin(ang) * ry * wob;
          i ? t.lineTo(px, py) : t.moveTo(px, py);
        }
        t.strokeStyle = hexA(col, strength * (0.35 + 0.65 * d)); t.lineWidth = 0.7 + 1.1 * d; t.stroke();
      });
    }
  });
  return c;
}

/** Pierwszy plan pod wodą: ciemne wstążki wodorostów pod światło, rozmyte (w kenozoiku łodygi kelpu do powierzchni). */
function paintSeaNear(a: PaintArgs, l: Look, coast: boolean): HTMLCanvasElement {
  const { lay, tileW, era } = a;
  const H = lay.H, k = H / 300;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0x77);
  const dark = hexA(mix(l.frame, l.waterDeep, 0.3), 0.9), rim = hexA(mix(l.lit, l.waterTop, 0.4), 0.55);
  const tall = era === 'kenozoik' && !coast;
  blurred(ctx, tileW, H, a.res, 2.2, (t) => {
    const n = Math.max(3, Math.round(tileW / 320));
    for (let q = 0; q < n; q++) {
      const x = (q + r() * 0.6) * (tileW / n), seed = a.seed * 7 + q;
      wrapped(tileW, x, 50 * k, (xx) => {
        const rr = rng(seed);
        for (let i = 0; i < (tall ? 1 : 5); i++) {
          const h = tall ? H - lay.surfaceY - 10 - rr() * 30 : (36 + rr() * 50) * k;
          weed(t, xx + (rr() - 0.5) * 30 * k, H + 6, h, rr() * 3, (tall ? 5 : 3.5) * k, dark, i % 2 ? rim : null);
        }
      });
    }
  });
  return c;
}

/** Rama kadru pod wodą: wodorosty w dolnych rogach i ciemniejsza głębia u dołu (nieruchoma). */
function paintSeaFrame(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay } = a;
  const W = lay.W, H = lay.H, k = H / 300;
  const { c, ctx } = canvasOf(W, H, a.res);
  const r = rng(a.seed ^ 0x51);
  const g = ctx.createLinearGradient(0, H - 40 * k, 0, H);
  g.addColorStop(0, hexA(l.waterDeep, 0)); g.addColorStop(1, hexA(l.waterDeep, 0.35));
  ctx.fillStyle = g; ctx.fillRect(0, H - 40 * k, W, 40 * k);
  const dark = mix(l.frame, l.waterDeep, 0.2), rim = hexA(mix(l.lit, l.waterTop, 0.4), 0.5);
  blurred(ctx, W, H, a.res, 2.4, (t) => {
    const clump = (cx: number, toward: number, n: number, tall: number) => {
      for (let i = 0; i < n; i++) weed(t, cx + (r() - 0.5) * 34 * k, H + 6, (tall * 0.5 + r() * tall) * k, toward * (0.5 + r()), (4 + r() * 2) * k, hexA(i % 3 ? dark : mix(dark, l.leafShade, 0.3), 0.94), i % 2 ? null : rim);
    };
    clump(-4 * k, 1, 5, 70);
    clump(W + 2 * k, -1, 6, 84);
  });
  return c;
}

// ------------------------------------------------------------------ brzeg (przybrzeże)

/**
 * Brzeg nad powierzchnią: zamglone góry w głębi, pagórki i płaskie plaże z jasnym
 * pasem piasku przy wodzie, kępy roślinności ery (śnieg przy zimnie); pod
 * powierzchnią daleka rafa.
 */
function paintCoastShore(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, tileW, theme, era } = a;
  const H = lay.H, k = H / 300, sy = lay.surfaceY;
  const r = rng(a.seed ^ 0x9b), rw = rng(a.seed ^ 0x9c);
  const reef = paintReefFar(a, l, true);
  const { c, ctx } = canvasOf(tileW, H, a.res);
  ctx.drawImage(reef, 0, 0, tileW, H);
  const u = (x: number) => (x / tileW) * TAU;
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  // wysokość lądu: pagórki na przemian z płaskimi plażami
  const shoreH = (x: number) => Math.max(0.12, 0.35 + 0.4 * Math.sin(u(x) * 2 + ph[0]) + 0.25 * Math.sin(u(x) * 3 + ph[1]) + 0.12 * Math.sin(u(x) * 9 + ph[2]));
  const shore = (x: number) => sy - 3 * k - 24 * k * shoreH(x);
  const mtn = (x: number) => sy - 12 * k - H * 0.1 * (0.6 * (1 - Math.abs(Math.sin(u(x) * 1.5 + ph[1]))) + 0.4 * (1 - Math.abs(Math.sin(u(x) * 3.5 + ph[2]))));
  const land = mix(l.hill, l.haze, 0.25), side = litSide(l);
  blurred(ctx, tileW, H, a.res, 0.6, (t) => {
    // góry w głębi
    t.beginPath(); t.moveTo(0, sy); for (let x = 0; x <= tileW; x += 4) t.lineTo(x, mtn(x)); t.lineTo(tileW, sy); t.closePath();
    t.fillStyle = mix(l.mountain, l.haze, 0.55); t.fill();
    if (l.snowCaps) { t.save(); t.clip(); t.fillStyle = hexA('#f8fafb', 0.8); t.fillRect(0, sy - 12 * k - H * 0.1, tileW, H * 0.045); t.restore(); }
  });
  blurred(ctx, tileW, H, a.res, 0.4, (t) => {
    // ląd
    t.beginPath(); t.moveTo(0, sy + 1); for (let x = 0; x <= tileW; x += 3) t.lineTo(x, shore(x)); t.lineTo(tileW, sy + 1); t.closePath();
    const g = t.createLinearGradient(0, sy - 28 * k, 0, sy);
    g.addColorStop(0, mix(land, l.sun.color, 0.18)); g.addColorStop(1, mix(land, l.haze, 0.25));
    t.fillStyle = g; t.fill();
    // jasny pas plaży przy wodzie
    t.beginPath(); t.moveTo(0, sy + 1); for (let x = 0; x <= tileW; x += 3) t.lineTo(x, Math.max(shore(x), sy - 3.5 * k)); t.lineTo(tileW, sy + 1); t.closePath();
    t.fillStyle = mix(l.sand, l.lit, 0.3); t.fill();
    if (l.snow > 0) {
      t.save(); t.beginPath(); t.moveTo(0, sy); for (let x = 0; x <= tileW; x += 3) t.lineTo(x, shore(x)); t.lineTo(tileW, sy); t.closePath(); t.clip();
      for (let x = 0; x < tileW; x += 8 + rw() * 24) { t.beginPath(); t.ellipse(x, shore(x) + 2 * k, (8 + rw() * 16) * k, 2.4 * k, 0, 0, TAU); t.fillStyle = hexA('#f6f8f9', 0.85); t.fill(); }
      t.restore();
    }
    // kępy roślinności na pagórkach (gaje z przerwami), jaśniejsze od słońca
    const tree = mix(l.treeFar, l.haze, 0.2), treeLit = mix(tree, l.sun.color, 0.4), dark = mix(tree, l.leafShade, 0.3);
    for (let gx = r() * 40; gx < tileW; gx += (34 + r() * 70) * k) {
      const n = 3 + Math.floor(r() * 6);
      for (let i = 0; i < n; i++) {
        const x = gx + (i - n / 2) * (6 + r() * 6) * k, y = shore(x) + 1.5 * k;
        if (y > sy - 4 * k) continue; // nie na plaży
        const h = (10 + r() * 12) * k;
        if (era === 'paleozoik') {
          if (r() < 0.72) {
            // niskie kobierce pierwszych roślin lądowych
            const w = (5 + r() * 6) * k;
            t.beginPath(); t.ellipse(x, y, w, w * 0.45, 0, Math.PI, 0); t.fillStyle = tree; t.fill();
            t.beginPath(); t.ellipse(x + side * w * 0.3, y - w * 0.2, w * 0.5, w * 0.18, 0, Math.PI, 0); t.fillStyle = treeLit; t.fill();
          } else {
            // smukły widłak z kępką na szczycie
            t.beginPath(); t.moveTo(x, y); t.lineTo(x + (r() - 0.5) * 2, y - h); t.strokeStyle = dark; t.lineWidth = 1.5 * k; t.lineCap = 'round'; t.stroke();
            t.beginPath(); t.ellipse(x, y - h, 3.2 * k, 2.2 * k, 0, 0, TAU); t.fillStyle = tree; t.fill();
            t.beginPath(); t.ellipse(x + side * 1.2 * k, y - h - 0.8 * k, 1.8 * k, 1 * k, 0, 0, TAU); t.fillStyle = treeLit; t.fill();
          }
        } else if (era === 'mezozoik') {
          // sagowce i araukarie
          if (r() < 0.5) {
            t.beginPath(); t.moveTo(x, y); t.lineTo(x, y - h * 1.4); t.strokeStyle = dark; t.lineWidth = 1.3 * k; t.stroke();
            for (let q = 0; q < 3; q++) { t.beginPath(); t.ellipse(x, y - h * 1.4 + q * 2.4 * k, (3 + q * 2) * k, 1.4 * k, 0, 0, TAU); t.fillStyle = q ? tree : treeLit; t.fill(); }
          } else {
            for (let q = 0; q < 6; q++) { const ang = Math.PI + (q / 5) * Math.PI; t.beginPath(); t.moveTo(x, y - h * 0.4); t.quadraticCurveTo(x + Math.cos(ang) * 5 * k, y - h * 0.4 - 5 * k, x + Math.cos(ang) * 8 * k, y - h * 0.4 + Math.abs(Math.sin(ang)) * 1.5 * k); t.strokeStyle = Math.cos(ang) * side > 0 ? treeLit : tree; t.lineWidth = 1.8 * k; t.stroke(); }
          }
        } else {
          const rr = (4 + r() * 4) * k;
          t.beginPath(); t.arc(x, y - rr, rr, 0, TAU); t.fillStyle = tree; t.fill();
          t.beginPath(); t.arc(x + side * rr * 0.35, y - rr * 1.25, rr * 0.55, 0, TAU); t.fillStyle = hexA(treeLit, 0.7); t.fill();
        }
      }
    }
  });
  ctx.beginPath(); for (let x = 0; x <= tileW; x += 3) (x ? ctx.lineTo(x, shore(x)) : ctx.moveTo(x, shore(x)));
  ink(ctx, { th: theme, alpha: 0.35, line: 0.8 }, 1);
  return c;
}

// ------------------------------------------------------------------ przepisy scen

/** Otwarte morze. */
export function seaRecipe(a: PaintArgs, l: Look, env: LitEnv): LitRecipe {
  const { lay } = a, k = env.H / 300, H = env.H;
  const kelp = a.era === 'kenozoik';
  const back = [
    still(env, [paintWaterBg(a, l, false)], 0, H, 0, a.seed),
    tile(a, env, paintReefFar(a, l, false), kelp ? lay.surfaceY : lay.floorY - H * 0.36, lay.floorY + 8, 0.25),
    tile(a, env, paintSurface(a, l, false), 0, lay.surfaceY + 16, 0.6),
    tile(a, env, paintSeabed(a, l, false), kelp ? lay.surfaceY + 16 : lay.floorY - 92 * k, H, 0.6)
  ];
  if (env.effects) back.push(tile(a, env, paintCaustics(a, l, false), lay.floorY, H, 0, 7));
  const front = [
    tile(a, env, paintSeaNear(a, l, false), kelp ? lay.surfaceY : H - 100 * k, H, 1.3),
    still(env, [paintSeaFrame(a, l)], H - 96 * k, H)
  ];
  return { back, raysAfter: 1, rays: waterRays(l, env, lay.surfaceY, lay.floorY + 10, rng(a.seed ^ 0x5a)), front };
}

/** Przybrzeże: niebo i brzeg nad powierzchnią, płytka, jasna woda pod nią. */
export function coastRecipe(a: PaintArgs, l: Look, env: LitEnv): LitRecipe {
  const { lay } = a, k = env.H / 300, H = env.H, sy = lay.surfaceY;
  const back = [
    still(env, [paintWaterBg(a, l, true)], 0, H, 0, a.seed),
    tile(a, env, paintCloudsLit(a, l, { top: 0, bottom: sy * 0.62, size: 0.55, n: 1.2, streaks: false }), 0, sy - 8 * k, 0, 3),
    tile(a, env, paintCoastShore(a, l), sy - 12 * k - env.H * 0.11, lay.floorY + 8, 0.25),
    tile(a, env, paintSurface(a, l, true), sy - 12, sy + 16, 0.6),
    tile(a, env, paintSeabed(a, l, true), lay.floorY - 60 * k, H, 0.6)
  ];
  if (env.effects) back.push(tile(a, env, paintCaustics(a, l, true), lay.floorY, H, 0, 7));
  const front = [
    tile(a, env, paintSeaNear(a, l, true), H - 100 * k, H, 1.3),
    still(env, [paintSeaFrame(a, l)], H - 96 * k, H)
  ];
  return { back, raysAfter: 3, rays: waterRays(l, env, sy + 2, lay.floorY + 10, rng(a.seed ^ 0x5a)), front };
}
