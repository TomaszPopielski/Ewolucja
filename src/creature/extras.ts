/*
 * extras.ts — elementy rysunku wspólne dla planów budowy innych niż kręgowiec
 * (stawonóg, głowonóg): echolokacja, kultura akustyczna, kamienne narzędzie,
 * układ nerwowy w przekroju, wzór dziedziczny linii.
 */
import { type CreatureSpec, rng } from './spec.ts';
import {
  type Theme, type SceneOptions, type Style, type Ctx, type V,
  feature, inkLine, hexA, v, lerp
} from './draw.ts';

type Styles = { normal: Style; ghost: Style };

/** Fale dźwięku przed pyskiem (echolokacja). */
export function drawEcho(ctx: Ctx, o: SceneOptions, st: Styles, theme: Theme, tip: V, ang: number) {
  feature(ctx, 'echolocation', o, st, (s) => {
    const shift = o.still ? 0 : (o.time * 14) % 6;
    for (let q = 0; q < 3; q++) {
      const r = 7 + q * 6 + shift;
      ctx.beginPath(); ctx.arc(tip.x + 3, tip.y, r, ang - 0.55, ang + 0.55);
      ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.ep, 0.75 - q * 0.2); ctx.lineWidth = 1.1;
      ctx.setLineDash(s.ghost ? [2, 2] : []); ctx.stroke();
    }
    ctx.setLineDash([]);
  });
}

/** Nuty i fala nad głową (kultura akustyczna). */
export function drawVocal(ctx: Ctx, o: SceneOptions, st: Styles, theme: Theme, base: V) {
  feature(ctx, 'vocal_culture', o, st, (s) => {
    const bob = o.still ? 0 : Math.sin(o.time * 3) * 2;
    ctx.beginPath();
    for (let q = 0; q <= 12; q++) {
      const x = base.x - 14 + q * 2.4, y = base.y + bob + Math.sin(q * 0.9) * 2.2;
      if (q === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.ep, 0.8); ctx.lineWidth = 1; ctx.setLineDash(s.ghost ? [2, 2] : []); ctx.stroke();
    ctx.setLineDash([]);
    [[-6, -9], [5, -13]].forEach(([dx, dy]) => {
      const n = v(base.x + dx, base.y + dy + bob);
      ctx.beginPath(); ctx.ellipse(n.x, n.y, 2.4, 1.8, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = s.ghost ? s.stroke : theme.ep; ctx.fill();
      ctx.beginPath(); ctx.moveTo(n.x + 2.2, n.y); ctx.lineTo(n.x + 2.2, n.y - 8); ctx.lineTo(n.x + 5.5, n.y - 6.5);
      ctx.strokeStyle = s.ghost ? s.stroke : theme.ep; ctx.lineWidth = 1; ctx.stroke();
    });
  });
}

/** Kamienne narzędzie (pięściak) trzymane w chwytaku. */
export function drawStone(ctx: Ctx, s: Style, at: V, tilt = -0.5) {
  ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.quadraticCurveTo(5, -2, 3.5, 5); ctx.quadraticCurveTo(0, 8, -3.5, 5);
  ctx.quadraticCurveTo(-5, -2, 0, -8); ctx.closePath();
  ctx.fillStyle = s.fill('#8d8578', 0.8); ctx.fill(); inkLine(ctx, s, 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-1, -2); ctx.lineTo(1, 2); ctx.lineTo(0, 7);
  ctx.moveTo(-3, -1); ctx.lineTo(-1, -2); ctx.moveTo(3, 0); ctx.lineTo(1, 2);
  inkLine(ctx, s, 0.5); ctx.stroke();
  ctx.restore();
}

/** Mózg jako fioletowa elipsa w głowie, z bruzdami przy rozbudowanym mózgu. */
export function drawBrain(ctx: Ctx, o: SceneOptions, st: Styles, theme: Theme, c: V, rx: number) {
  const brainAmt = Math.max(o.pres.brain, o.ghost.brain * (1 - o.pres.brain));
  if (brainAmt <= 0.01) return;
  feature(ctx, 'brain', o, st, (s) => {
    const big = o.pres.big_brain + o.ghost.big_brain * (1 - o.pres.big_brain);
    const r = rx * (0.85 + 0.35 * big), ry = r * 0.68;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, r, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = s.ghost ? s.fill('#000', 0.9) : hexA(theme.ep, 0.28); ctx.fill();
    ctx.strokeStyle = s.ghost ? s.stroke : theme.ep; ctx.lineWidth = 1;
    ctx.setLineDash(s.ghost ? [2, 2] : [2.5, 1.5]); ctx.stroke(); ctx.setLineDash([]);
    const sulci = 2 + Math.round(3 * o.pres.big_brain);
    ctx.beginPath();
    for (let q = 0; q < sulci; q++) {
      const x0 = c.x - r * 0.6 + (q / Math.max(1, sulci - 1)) * r * 1.2;
      ctx.moveTo(x0, c.y - ry * 0.55); ctx.quadraticCurveTo(x0 + 3, c.y, x0 - 1, c.y + ry * 0.5);
    }
    ctx.lineWidth = 0.6; ctx.stroke();
  });
}

/** Dziedziczny wzór linii (pasy/plamy/siodło) na prostokątnej „mapie” ciała — rysowany w obrysie. */
export function drawPattern(ctx: Ctx, spec: CreatureSpec, theme: Theme,
  at: (t: number, k: number) => V, tRange: [number, number]) {
  if (spec.pattern === 'none') return;
  const r = rng(spec.seed ^ 0x9a);
  const pc = hexA(spec.accentColor, Math.min(0.85, theme.washAlpha + 0.3));
  ctx.fillStyle = pc; ctx.strokeStyle = pc; ctx.setLineDash([]);
  const [t0, t1] = tRange;
  if (spec.pattern === 'stripes') {
    ctx.lineWidth = 2.4; ctx.beginPath();
    for (let t = t0; t < t1; t += 0.075) {
      const a = at(t, 1.1), b = at(t - 0.02, -0.6);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  } else if (spec.pattern === 'spots') {
    for (let q = 0; q < 16; q++) {
      const c = at(lerp(t0, t1, r()), r() * 1.1 - 0.15);
      ctx.beginPath(); ctx.arc(c.x, c.y, 1.4 + r() * 2.2, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.beginPath();
    for (let t = t0; t <= t1; t += 0.03) { const p = at(t, 1.1); if (t === t0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    for (let t = t1; t >= t0; t -= 0.03) { const p = at(t, 0.3 + 0.25 * Math.sin(t * 24)); ctx.lineTo(p.x, p.y); }
    ctx.closePath(); ctx.fill();
  }
}
