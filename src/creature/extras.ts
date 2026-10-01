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

/** Punkt na ciele zwierzęcia: t = 0 (głowa) … 1 (ogon), m = 1 (grzbiet) … −1 (brzuch). */
export type BodyAt = (t: number, m: number) => V;

function unit(a: V, b: V): V {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  return v(dx / l, dy / l);
}

/**
 * Rzadkie warianty (jad, bioluminescencja, elektrorecepcja, kolce, gigantyzm, karłowatość,
 * sen zimowy) — wspólne dla wszystkich planów budowy; każdy plan podaje własne `at`.
 */
export function drawRare(ctx: Ctx, o: SceneOptions, st: Styles, theme: Theme, spec: CreatureSpec, at: BodyAt, mouth: V) {
  // Kolce wzdłuż grzbietu.
  feature(ctx, 'spines', o, st, (s) => {
    for (let t = 0.18; t <= 0.8; t += 0.05) {
      const b = at(t, 1), dir = unit(at(t, 0.55), b), back = unit(b, at(t + 0.03, 1));
      const tip = v(b.x + dir.x * 9 + back.x * 3, b.y + dir.y * 9 + back.y * 3);
      const b1 = at(t - 0.018, 0.97), b2 = at(t + 0.018, 0.97);
      ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(tip.x, tip.y); ctx.lineTo(b2.x, b2.y); ctx.closePath();
      ctx.fillStyle = s.fill(theme.horn, 0.75); ctx.fill(); inkLine(ctx, s, 0.8); ctx.stroke();
    }
  });
  // Jad: kieł przy pysku i kropla.
  feature(ctx, 'venom', o, st, (s) => {
    const f = v(mouth.x - 2, mouth.y + 1);
    ctx.beginPath(); ctx.moveTo(f.x - 2.2, f.y); ctx.quadraticCurveTo(f.x - 1, f.y + 5, f.x + 0.6, f.y + 7); ctx.lineTo(f.x + 2, f.y);
    ctx.closePath(); ctx.fillStyle = s.ghost ? s.fill('#000', 0.6) : '#f3eee0'; ctx.fill(); inkLine(ctx, s, 0.8); ctx.stroke();
    const drop = o.still ? 0 : (o.time * 0.8) % 1, dy = 10 + drop * 6;
    ctx.beginPath(); ctx.moveTo(f.x + 0.6, f.y + dy - 3);
    ctx.quadraticCurveTo(f.x + 3, f.y + dy + 1.5, f.x + 0.6, f.y + dy + 2.4); ctx.quadraticCurveTo(f.x - 1.8, f.y + dy + 1.5, f.x + 0.6, f.y + dy - 3);
    ctx.fillStyle = s.ghost ? s.stroke : hexA('#6f9a2a', 0.9); ctx.fill();
  });
  // Bioluminescencja: świecące punkty wzdłuż brzucha.
  feature(ctx, 'bioluminescence', o, st, (s) => {
    const flick = o.still ? 1 : 0.75 + 0.25 * Math.sin(o.time * 3);
    for (let t = 0.15; t <= 0.86; t += 0.07) {
      const c = at(t, -0.55);
      if (!s.ghost) {
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 6);
        g.addColorStop(0, hexA('#7ff0dc', 0.75 * flick)); g.addColorStop(1, hexA('#7ff0dc', 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(c.x, c.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = s.ghost ? s.stroke : '#2f9e8e'; ctx.fill();
    }
  });
  // Elektrorecepcja: pory na głowie i linie pola przed pyskiem.
  feature(ctx, 'electroreception', o, st, (s) => {
    ctx.fillStyle = s.ghost ? s.stroke : theme.ink;
    for (let i = 0; i < 8; i++) {
      const c = at(0.03 + (i % 4) * 0.022, -0.1 + Math.floor(i / 4) * 0.45);
      ctx.beginPath(); ctx.arc(c.x, c.y, 0.8, 0, Math.PI * 2); ctx.fill();
    }
    const pulse = o.still ? 0 : (o.time * 2) % 1;
    for (let q = 0; q < 2; q++) {
      ctx.beginPath(); ctx.ellipse(mouth.x + 9, mouth.y, 5 + q * 5 + pulse * 2, 9 + q * 6 + pulse * 2, 0, -1.3, 1.3);
      ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.ep, 0.6 - q * 0.2); ctx.lineWidth = 0.9; ctx.setLineDash([2, 2]); ctx.stroke();
    }
    ctx.setLineDash([]);
  });
  // Sen zimowy: warstwa tłuszczu pod brzuchem i „Zz”.
  feature(ctx, 'hibernation', o, st, (s) => {
    const pts: V[] = [];
    for (let t = 0.22; t <= 0.76; t += 0.03) pts.push(at(t, -0.95));
    for (let t = 0.76; t >= 0.22; t -= 0.03) pts.push(at(t, -0.62));
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.fillStyle = s.ghost ? s.fill('#000', 0.4) : hexA('#f1e2b8', 0.6); ctx.fill();
    const h = at(0.08, 1.4), bob = o.still ? 0 : Math.sin(o.time * 1.5) * 1.5;
    ctx.font = 'italic 600 9px Georgia, serif'; ctx.fillStyle = s.ghost ? s.stroke : hexA(theme.inkSoft, 0.9);
    ctx.fillText('z', h.x + 4, h.y - 6 + bob); ctx.font = 'italic 600 12px Georgia, serif'; ctx.fillText('Z', h.x + 10, h.y - 13 + bob);
  });
  // Gigantyzm: fałdy grubej skóry i znaczniki „rośnie”; karłowatość — znaczniki „maleje”.
  feature(ctx, 'gigantism', o, st, (s) => {
    ctx.beginPath();
    for (let t = 0.28; t <= 0.7; t += 0.08) {
      const a = at(t, 0.55), b = at(t + 0.012, -0.35), c = at(t - 0.02, 0.1);
      ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
    }
    ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.ink, 0.35); ctx.lineWidth = 0.9; ctx.setLineDash(s.ghost ? [2, 2] : []); ctx.stroke();
    sizeTicks(ctx, s, at, 1);
  });
  feature(ctx, 'dwarfism', o, st, (s) => { sizeTicks(ctx, s, at, -1); });
  void spec;
}

/** Strzałki przy końcach ciała: na zewnątrz (gigantyzm) albo do środka (karłowatość). */
function sizeTicks(ctx: Ctx, s: Style, at: BodyAt, dir: number) {
  const head = at(0, 0), tail = at(1, 0), axis = unit(tail, head);
  [[head, 1], [tail, -1]].forEach(([p0, sgn]) => {
    const p = p0 as V, k = (sgn as number) * dir;
    const a = v(p.x + axis.x * (sgn as number) * 8, p.y + axis.y * (sgn as number) * 8 - 14);
    const b = v(a.x + axis.x * k * 8, a.y + axis.y * k * 8);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    const nx = -axis.y, ny = axis.x;
    ctx.moveTo(b.x - axis.x * k * 3 + nx * 2.5, b.y - axis.y * k * 3 + ny * 2.5); ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x - axis.x * k * 3 - nx * 2.5, b.y - axis.y * k * 3 - ny * 2.5);
    inkLine(ctx, s, 0.9); ctx.stroke();
  });
}
