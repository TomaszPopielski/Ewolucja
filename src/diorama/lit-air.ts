/*
 * lit-air.ts — scena powietrzna ze światłem: niebo z poświatą słońca, krajobraz
 * ery daleko w dole (zamglony, z lasami, rzeką i górami), duże oświetlone
 * chmury, wśród których latają zwierzęta, i rozmyte obłoki pierwszego planu.
 * Kamera płynie, więc warstwy są zapętlonymi kaflami z różną paralaksą.
 */
import { rng } from '../creature/spec.ts';
import { canvasOf, hexA, mix, type PaintArgs } from './scenery.ts';
import { litSide, type Look } from './looks.ts';
import {
  TAU, blurred, still, tile, paintSkyLit, paintCloudsLit, cloudLit, sunRays,
  type LitEnv, type LitRecipe
} from './light.ts';

/**
 * Krajobraz widziany z wysoka: góry na horyzoncie, równina z jaśniejszymi łąkami
 * i lasami ze skupisk drobnych koron, rzeka zwężająca się ku horyzontowi, małe
 * chmury z cieniami na ziemi; całość tym bledsza, im dalej.
 */
function paintAirLand(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, tileW, era } = a;
  const H = lay.H, k = H / 300, hz = lay.floorY - H * 0.05;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0xa1), rw = rng(a.seed ^ 0xa2);
  const side = litSide(l);
  const dist = (y: number) => Math.max(0, Math.min(1, (y - hz) / (H - hz))); // 0 = horyzont, 1 = dolna krawędź
  const haze = (col: string, d: number) => mix(col, l.haze, 0.6 * (1 - d) + 0.04);
  const f = [3 + Math.floor(r() * 2), 8 + Math.floor(r() * 3)], p = [r() * TAU, r() * TAU];
  const peakY = (x: number) => {
    const u = (x / tileW) * TAU;
    return hz - H * 0.1 * (0.6 * (1 - Math.abs(Math.sin(u * f[0] / 2 + p[0]))) + 0.4 * (1 - Math.abs(Math.sin(u * f[1] / 2 + p[1]))));
  };
  blurred(ctx, tileW, H, a.res, 0.8, (t) => {
    // góry na horyzoncie, ściany od słońca jaśniejsze, śnieżne czapy przy zimnie
    t.beginPath(); t.moveTo(0, hz + 2); for (let x = 0; x <= tileW; x += 3) t.lineTo(x, peakY(x)); t.lineTo(tileW, hz + 2); t.closePath();
    t.fillStyle = mix(l.mountain, l.haze, 0.45); t.fill();
    t.save(); t.clip();
    if (l.snowCaps) { t.fillStyle = hexA('#f8fafb', 0.8); t.fillRect(0, hz - H * 0.1, tileW, H * 0.045); }
    for (let x = 0; x < tileW; x += 3) if ((peakY(x + 2) - peakY(x - 2)) * side > 0) { t.fillStyle = hexA(l.sun.color, 0.22); t.fillRect(x, peakY(x), 3.2, hz - peakY(x)); }
    t.restore();
    // równina: od mglistej przy horyzoncie do wyraźniejszej u dołu
    const g = t.createLinearGradient(0, hz, 0, H);
    g.addColorStop(0, haze(l.hill, 0)); g.addColorStop(1, haze(mix(l.groundFar, l.groundNear, 0.55), 1));
    t.fillStyle = g; t.fillRect(0, hz, tileW, H - hz);
    // łąki i jaśniejsze polany (spłaszczone perspektywą)
    for (let q = 0; q < tileW / 40; q++) {
      const y = hz + 2 + Math.pow(r(), 0.8) * (H - hz), d = dist(y), x = r() * tileW, rx = (12 + r() * 40) * (0.3 + d) * k;
      for (const xx of [x, x - tileW, x + tileW]) if (xx > -rx && xx < tileW + rx) { t.beginPath(); t.ellipse(xx, y, rx, rx * (0.08 + 0.1 * d), 0, 0, TAU); t.fillStyle = hexA(haze(l.lit, d), 0.35); t.fill(); }
    }
    // rzeka: meander, szersza bliżej widza, jasna od nieba
    const riverY = (x: number) => hz + (H - hz) * (0.42 + 0.3 * Math.sin((x / tileW) * TAU * 2 + p[0]) + 0.08 * Math.sin((x / tileW) * TAU * 5 + p[1]));
    const water = mix(l.waterTop, l.skyHorizon, 0.45);
    for (let x = 0; x <= tileW; x += 2) {
      const y = riverY(x), d = dist(y), w = (0.6 + 3.4 * d) * k;
      t.fillStyle = hexA(haze(mix(l.shade, l.groundNear, 0.5), d), 0.6); t.fillRect(x, y - w / 2 - 0.8 * k, 2.6, w + 1.6 * k); // brzegi
      t.fillStyle = hexA(haze(water, d), 0.95); t.fillRect(x, y - w / 2, 2.6, w);
    }
    // lasy: skupiska drobnych koron, jaśniejszych od słońca; drzewa ery przy horyzoncie zlewają się w pas
    const crown = mix(l.treeFar, l.leafShade, era === 'kenozoik' ? 0.25 : 0.4);
    for (let q = 0; q < tileW / 42; q++) {
      const cy = hz + 3 + Math.pow(r(), 0.9) * (H - hz - 3), d = dist(cy), cx = r() * tileW;
      const rx = (16 + r() * 50) * (0.3 + d) * k, ry = rx * (0.12 + 0.12 * d), n = Math.round(10 + 30 * (0.3 + d));
      const col = haze(crown, d), lit = mix(col, l.sun.color, 0.35);
      for (let i = 0; i < n; i++) {
        const ang = r() * TAU, rr = Math.sqrt(r());
        const x = cx + Math.cos(ang) * rx * rr, y = cy + Math.sin(ang) * ry * rr, cr = (0.9 + r() * 1.3) * (0.4 + d) * k;
        for (const xx of [x, x - tileW, x + tileW]) if (xx > -4 && xx < tileW + 4) {
          t.beginPath(); t.arc(xx, y, cr, 0, TAU); t.fillStyle = col; t.fill();
          t.beginPath(); t.arc(xx + side * cr * 0.35, y - cr * 0.35, cr * 0.5, 0, TAU); t.fillStyle = hexA(lit, 0.6); t.fill();
        }
      }
    }
    // płaty śniegu (zimno)
    for (let q = 0; q < (tileW / 26) * l.snow; q++) {
      const y = hz + 2 + rw() * (H - hz), d = dist(y), x = rw() * tileW, rx = (10 + rw() * 30) * (0.3 + d) * k;
      t.beginPath(); t.ellipse(x, y, rx, rx * (0.08 + 0.1 * d), 0, 0, TAU); t.fillStyle = hexA('#f6f8f9', 0.75); t.fill();
    }
    // małe chmurki poniżej lotu, rzucające cienie na ląd
    for (let q = 0; q < tileW / 300; q++) {
      const x = r() * tileW, y = hz + 8 * k + r() * (H - hz) * 0.5, s = (0.32 + r() * 0.22) * k;
      t.beginPath(); t.ellipse(x - side * 10 * k, y + 10 * k, 40 * s, 6 * s, 0, 0, TAU); t.fillStyle = hexA(l.shade, 0.16); t.fill();
      cloudLit(t, l, x, y, s, rng(a.seed * 3 + q));
    }
  });
  // mgiełka nad horyzontem
  const mist = ctx.createLinearGradient(0, hz - H * 0.06, 0, hz + H * 0.06);
  mist.addColorStop(0, hexA(l.haze, 0)); mist.addColorStop(0.55, hexA(l.haze, 0.65)); mist.addColorStop(1, hexA(l.haze, 0));
  ctx.fillStyle = mist; ctx.fillRect(0, hz - H * 0.06, tileW, H * 0.12);
  return c;
}

/** Pierwszy plan: wielkie, rozmyte obłoki przy dolnej krawędzi (lot przez chmury). */
function paintAirNear(a: PaintArgs, l: Look): HTMLCanvasElement {
  const { lay, tileW } = a;
  const H = lay.H, k = H / 300;
  const { c, ctx } = canvasOf(tileW, H, a.res);
  const r = rng(a.seed ^ 0x77);
  blurred(ctx, tileW, H, a.res, 3, (t) => {
    const n = Math.max(2, Math.round(tileW / 520));
    for (let q = 0; q < n; q++) {
      const x = (q + r() * 0.6) * (tileW / n), s = (2.2 + r() * 0.8) * k;
      for (const xx of [x, x - tileW, x + tileW]) if (xx > -200 * s && xx < tileW + 200 * s) cloudLit(t, l, xx, H + 14 * k, s, rng(a.seed * 9 + q));
    }
  });
  return c;
}

/** Powietrze: niebo, krajobraz w dole, snopy od słońca, duże chmury, obłoki pierwszego planu. */
export function airRecipe(a: PaintArgs, l: Look, env: LitEnv): LitRecipe {
  const { lay } = a, k = env.H / 300, H = env.H;
  const back = [
    still(env, [paintSkyLit(a, l, lay.floorY - H * 0.05)], 0, H, 0, a.seed),
    tile(a, env, paintAirLand(a, l), lay.floorY - H * 0.17, H, 0.25),
    tile(a, env, paintCloudsLit(a, l, { top: H * 0.04, bottom: H * 0.78, n: 1.5, size: 1.5, streaks: true, seed: 7 }), 0, H * 0.84, 0.6)
  ];
  const front = [tile(a, env, paintAirNear(a, l), H - 75 * k, H, 1.3)];
  return { back, raysAfter: 1, rays: sunRays(l, env, lay.floorY, rng(a.seed ^ 0x5a)), front };
}
