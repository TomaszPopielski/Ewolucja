/*
 * cephalopod.ts — plan budowy „głowonóg” (łodzikowiec → kałamarnica → ośmiornica).
 *
 * Płaszcz z lejkiem, głowa z okiem i ramiona z przyssawkami. Cechy gry mają
 * tu własne odpowiedniki: płetwy to płetwy płaszcza, kończyny to ramiona
 * opuszczone na dno (pełzanie), lot to szybowanie z rozłożonymi płetwami,
 * pancerz to zwinięta muszla (jak u łodzika), szczęki to dziób i macki łowne,
 * a ręka chwytna to wprawne ramię, które potrafi unieść narzędzie.
 * Ruch jest cykliczny (pulsowanie płaszcza, fale ramion), więc da się go „wypiec”.
 */
import { type CreatureSpec, rng, mixHex } from './spec.ts';
import {
  type Theme, type SceneOptions, type Presence, type Ctx, type V, type Style,
  feature, styles, inkLine, hexA, smoothPath, v, add, mul, lerp, polar, lerpV
} from './draw.ts';
import { drawEcho, drawVocal, drawStone, drawBrain, drawPattern } from './extras.ts';

export interface CephShape {
  L: number; g: number;
  /** Środek głowy (x) i jej promień. */
  xJ: number; rh: number;
  armLen: number; omega: number;
}

export function cephShape(spec: CreatureSpec, pres: Presence, limbs = pres.limbs): CephShape {
  const L = 180 * spec.proportions.length;
  const g = spec.proportions.girth;
  const rh = 13.5 * g * (1 + 0.1 * (spec.proportions.head - 1) + 0.12 * pres.brain + 0.1 * pres.big_brain);
  return { L, g, xJ: 0.06 * L, rh, armLen: L * 0.4 * lerp(1, 0.8, limbs), omega: lerp(3.4, 2.8, limbs) };
}

const KN: [number, number][] = [[0, 0], [0.15, 8], [0.35, 17], [0.6, 20], [0.85, 17.5], [1, 13.5]];
function mantleH(u: number): number {
  for (let i = 0; i < KN.length - 1; i++) {
    if (u <= KN[i + 1][0]) {
      const f = (u - KN[i][0]) / (KN[i + 1][0] - KN[i][0]);
      return lerp(KN[i][1], KN[i + 1][1], f * f * (3 - 2 * f));
    }
  }
  return KN[KN.length - 1][1];
}

interface Arm { pts: V[]; wid: number }

/** Ramiona (i ewentualnie macki łowne) jako łamane; ten sam kod liczy stopy do stawiania na gruncie. */
function armsFor(spec: CreatureSpec, pres: Presence, time: number, still: boolean, limbs: number, tentacles: boolean): Arm[] {
  const sh = cephShape(spec, pres, limbs);
  const out: Arm[] = [];
  const glide = pres.flight;
  const N = 14;
  const N_ARMS = 8;
  const build = (phi: number, len: number, wid: number, idx: number, tent: boolean) => {
    let ang0 = phi * 0.55;
    ang0 = lerp(ang0, 0.95 + phi * 0.45 + (idx % 2 ? 0.12 : -0.08), limbs * (tent ? 0.4 : 1));
    ang0 = lerp(ang0, phi * 0.12, glide);
    // ramię chwytne: uniesione i zakrzywione
    const grip = !tent && idx === 2 && pres.grasping_hand > 0.5;
    if (grip) ang0 = lerp(ang0, -0.75, 0.9);
    const base = v(sh.xJ + Math.cos(phi) * sh.rh * 0.9, Math.sin(phi) * sh.rh * 0.9);
    const pts: V[] = [base];
    let p = base;
    for (let i = 1; i <= N; i++) {
      const u = i / N;
      const wave = still ? 0.25 * Math.sin(u * 3.2 + idx) : Math.sin(time * sh.omega - u * 3.4 + idx * 0.8);
      let h = ang0 + 0.5 * wave * u * (tent ? 0.6 : 1) * (1 - 0.6 * limbs);
      h += -0.85 * limbs * u * u * (tent ? 0 : 1);          // pazur podwija się ku przodowi
      if (grip) h += 1.5 * u * u;                          // końcówka zwija się do góry i do środka
      p = add(p, polar(h, len / N));
      pts.push(p);
    }
    out.push({ pts, wid });
  };
  for (let i = 0; i < N_ARMS; i++) {
    const phi = lerp(-1.05, 1.05, i / (N_ARMS - 1));
    const len = sh.armLen * (i === 3 || i === 4 ? 1.05 : 0.9 + 0.1 * Math.sin(i * 2.1));
    build(phi, len, 3.6 * sh.g, i, false);
  }
  if (tentacles) { build(-0.22, sh.armLen * 1.45, 1.8 * sh.g, 20, true); build(0.22, sh.armLen * 1.4, 1.8 * sh.g, 21, true); }
  return out;
}

export function cephFootDrop(spec: CreatureSpec, pres: Presence): number {
  const sh = cephShape(spec, pres);
  const arms = armsFor(spec, pres, 0, true, pres.limbs, false);
  const tip = Math.max(...arms.map((a) => a.pts[a.pts.length - 1].y));
  const mantle = mantleH(0.6) * sh.g;
  return lerp(mantle, Math.max(mantle, tip + 1.5), pres.limbs);
}

export function cephExtents(spec: CreatureSpec, pres: Presence) {
  const sh = cephShape(spec, pres);
  return {
    L: sh.L, left: sh.L / 2 + 26, right: sh.xJ + sh.rh + sh.armLen * 1.5 + 14,
    top: 34 + 24 * sh.g + 60 * pres.flight + 30 * pres.grasping_hand, bottom: 34 + 24 * sh.g + 40 * pres.limbs
  };
}

export function drawCephalopod(ctx: Ctx, spec: CreatureSpec, theme: Theme, o: SceneOptions) {
  const pres = o.pres, time = o.time, still = !!o.still;
  const sh = cephShape(spec, pres);
  const st = styles(theme);
  const color = spec.bodyColor;
  const { L, g, xJ, rh, omega } = sh;
  const pulse = still ? 0 : Math.sin(time * omega) * 0.07;
  // Punkt na płaszczu: t = 0 (przy głowie) … 1 (koniec), m = 1 (grzbiet) … −1 (brzuch).
  const at = (t: number, m: number): V => {
    const u = 1 - t;
    return v(lerp(xJ, -L / 2, t), -mantleH(u) * g * (1 + pulse) * m);
  };
  const headC = v(xJ, 0);
  const fill = (c: string, a?: number) => hexA(c, a == null ? theme.washAlpha : a);

  const armPath = (a: Arm) => {
    const left: V[] = [], right: V[] = [];
    a.pts.forEach((p, i) => {
      const q = a.pts[Math.min(a.pts.length - 1, i + 1)], r0 = a.pts[Math.max(0, i - 1)];
      const dx = q.x - r0.x, dy = q.y - r0.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, w = lerp(a.wid, 0.5, i / (a.pts.length - 1));
      left.push(v(p.x + nx * w, p.y + ny * w)); right.push(v(p.x - nx * w, p.y - ny * w));
    });
    return { left, right };
  };
  const drawArm = (a: Arm, s: Style, far: boolean, tent: boolean) => {
    const { left, right } = armPath(a);
    ctx.save();
    if (far) ctx.globalAlpha *= 0.55;
    ctx.beginPath(); ctx.moveTo(left[0].x, left[0].y);
    left.forEach((p) => ctx.lineTo(p.x, p.y));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fillStyle = s.ghost ? s.fill('#000', 0.35) : fill(mixHex(color, '#fbf8f0', far ? 0.05 : 0.18), Math.min(0.95, theme.washAlpha + 0.2));
    ctx.fill(); inkLine(ctx, s, 1.1); ctx.stroke();
    if (!s.ghost) {
      // przyssawki po spodniej stronie
      ctx.fillStyle = hexA(theme.paper, 0.75);
      for (let i = 2; i < a.pts.length - 1; i += 2) {
        const p = tent && i < a.pts.length - 4 ? null : lerpV(a.pts[i], right[i], 0.45);
        if (p) { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.6, 1.2 - i * 0.05), 0, Math.PI * 2); ctx.fill(); }
      }
      if (tent) {
        const c = a.pts[a.pts.length - 1];
        ctx.beginPath(); ctx.ellipse(c.x, c.y, 5, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = fill(spec.accentColor, 0.55); ctx.fill(); inkLine(ctx, s, 0.9); ctx.stroke();
      }
    }
    ctx.restore();
  };
  const armSet = (s: Style, limbs: number, far: boolean, tent: boolean) => {
    const arms = armsFor(spec, pres, time, still, limbs, tent);
    arms.forEach((a, i) => {
      if (tent) { if (i >= 8) drawArm(a, s, false, true); return; }
      if (i < 8 && (i % 2 === 0) === far) drawArm(a, s, far, false);
    });
  };

  // ---------- 1. dalsze ramiona
  armSet(st.normal, pres.limbs, true, false);
  feature(ctx, 'limbs', o, st, (s) => { if (s.ghost) armSet(s, 1, true, false); });

  // ---------- płetwy płaszcza (lub skrzydła szybowania)
  feature(ctx, 'fins', o, st, (s, amt) => {
    const flap = still ? 0.2 : Math.sin(time * omega * 2);
    [1, -1].forEach((side) => {
      const b0 = at(0.5, side * 0.95), b1 = at(0.92, side * 0.5);
      const spread = (14 + 8 * amt) * (1 + 0.35 * flap * 0.5);
      const tip = v(lerp(b0.x, b1.x, 0.6) - 4, b0.y - side * spread * (side > 0 ? 1 : 0.7));
      ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.quadraticCurveTo(tip.x + 6, tip.y, tip.x - 4, tip.y + side * 2);
      ctx.quadraticCurveTo(b1.x, b1.y - side * 4, b1.x, b1.y); ctx.closePath();
      ctx.fillStyle = s.fill(spec.accentColor, side > 0 ? 0.45 : 0.3); ctx.fill(); inkLine(ctx, s, 1); ctx.stroke();
    });
  });
  feature(ctx, 'flight', o, st, (s) => {
    // szybowanie: szerokie „skrzydła” z płetw płaszcza
    const beat = still ? 0.3 : Math.sin(time * omega * 2);
    const b = at(0.25, 0.95);
    const th = 0.5 + 0.55 * (0.5 + 0.5 * beat);
    const tip = add(b, polar(Math.PI + th, 70));
    const n = polar(Math.PI + th - Math.PI / 2, 14);
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(lerpV(b, tip, 0.5).x + n.x, lerpV(b, tip, 0.5).y + n.y, tip.x, tip.y);
    ctx.quadraticCurveTo(lerpV(b, tip, 0.5).x - n.x * 0.4, lerpV(b, tip, 0.5).y - n.y * 0.4, b.x, b.y);
    ctx.closePath(); ctx.fillStyle = s.fill(spec.accentColor, 0.35); ctx.fill(); inkLine(ctx, s, 1); ctx.stroke();
    ctx.beginPath();
    for (let q = 0; q < 4; q++) { const e = add(lerpV(b, tip, 0.9 - q * 0.08), mul(n, 0.5 - q * 0.2)); ctx.moveTo(b.x, b.y); ctx.lineTo(e.x, e.y); }
    inkLine(ctx, s, 0.5); ctx.strokeStyle = s.soft; ctx.stroke();
  });

  // ---------- 2. płaszcz + głowa (jeden kontur)
  const outline: V[] = [];
  for (let i = 0; i <= 30; i++) outline.push(at(1 - i / 30, 1));         // grzbiet: koniec → głowa
  for (let a = -Math.PI / 2 + 0.25; a <= Math.PI / 2 - 0.25; a += 0.28) outline.push(add(headC, polar(a, rh)));
  for (let i = 0; i <= 30; i++) outline.push(at(i / 30, -1));            // brzuch: głowa → koniec
  const ys = outline.map((p) => p.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  ctx.save();
  ctx.beginPath(); smoothPath(ctx, outline, true);
  const grad = ctx.createLinearGradient(0, minY, 0, maxY);
  grad.addColorStop(0, hexA(mixHex(color, '#2c261e', 0.25), Math.min(1, theme.washAlpha + 0.25)));
  grad.addColorStop(0.55, hexA(color, theme.washAlpha + 0.1));
  grad.addColorStop(1, hexA(mixHex(color, '#fbf8f0', 0.45), theme.washAlpha));
  ctx.fillStyle = grad; ctx.fill();
  ctx.clip();

  drawPattern(ctx, spec, theme, (t, m) => at(0.1 + t * 0.9, m * 0.95), [0.1, 0.9]);
  // granica płaszcza i głowy
  ctx.beginPath(); { const a = at(0.03, 1.05), b = at(0.03, -1.05); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x - 5, 0, b.x, b.y); }
  ctx.strokeStyle = hexA(theme.ink, 0.35); ctx.lineWidth = 0.9; ctx.setLineDash([]); ctx.stroke();

  feature(ctx, 'camouflage', o, st, (s) => {
    const r = rng(spec.seed ^ 0xca);
    for (let b = 0; b < 12; b++) {
      const c = at(0.1 + r() * 0.85, (r() - 0.5) * 1.6);
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 3 + r() * 5, 2 + r() * 3, r() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = s.ghost ? s.fill('#000', 0.6) : hexA(mixHex(color, theme.ink, 0.55), 0.38); ctx.fill();
    }
  });
  feature(ctx, 'scales', o, st, (s) => {
    // brodawki i chromatofory: gęsty deseń małych pierścieni
    ctx.beginPath();
    for (let t = 0.1; t < 0.95; t += 0.05) for (let m = -0.75; m <= 0.8; m += 0.5) {
      const c = at(t, m + (Math.round(t * 20) % 2 ? 0.25 : 0));
      ctx.moveTo(c.x + 1.8, c.y); ctx.arc(c.x, c.y, 1.8, 0, Math.PI * 2);
    }
    ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.ink, 0.32); ctx.lineWidth = 0.6; ctx.setLineDash(s.ghost ? [2, 2] : []); ctx.stroke();
  });
  feature(ctx, 'fast_muscle', o, st, (s) => {
    ctx.beginPath();
    for (let t = 0.15; t < 0.9; t += 0.06) {
      const a = at(t, 0.85), b = at(t + 0.035, 0), c = at(t, -0.85);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
    }
    ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.danger, 0.35); ctx.lineWidth = 0.8; ctx.setLineDash(s.ghost ? [2, 2] : []); ctx.stroke();
  });
  feature(ctx, 'lateral_line', o, st, (s) => {
    ctx.fillStyle = s.ghost ? s.stroke : theme.ink;
    for (let t = 0.1; t < 0.92; t += 0.03) { const c = at(t, 0.3); ctx.beginPath(); ctx.arc(c.x, c.y, 0.95, 0, Math.PI * 2); ctx.fill(); }
  });
  feature(ctx, 'endothermy', o, st, (s) => {
    const c = at(0.35, 0);
    const gr = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 26 * g);
    gr.addColorStop(0, s.ghost ? s.fill('#000', 0.5) : hexA(theme.danger, 0.28)); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(c.x - 34, c.y - 34, 68, 68);
  });
  feature(ctx, 'ganglia', o, st, (s) => {
    ctx.beginPath(); ctx.moveTo(headC.x, headC.y);
    for (let t = 0.05; t <= 0.7; t += 0.05) { const p = at(t, 0.05); ctx.lineTo(p.x, p.y); }
    ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.ep, 0.85); ctx.lineWidth = 1.1; ctx.setLineDash([2.5, 2]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = s.ghost ? s.stroke : theme.ep;
    [0.15, 0.3, 0.45, 0.6].forEach((t) => { const c = at(t, 0.05); ctx.beginPath(); ctx.arc(c.x, c.y, 1.7, 0, Math.PI * 2); ctx.fill(); });
  });
  drawBrain(ctx, o, st, theme, add(headC, v(-2, -1)), rh * 0.55);
  ctx.restore();
  ctx.beginPath(); smoothPath(ctx, outline, true);
  inkLine(ctx, st.normal, 1.5); ctx.stroke();

  // lejek (syfon) pod głową
  {
    const f0 = add(headC, v(-3, rh * 0.85));
    ctx.beginPath(); ctx.moveTo(f0.x + 5, f0.y - 1); ctx.lineTo(f0.x - 9, f0.y + 5); ctx.lineTo(f0.x - 5, f0.y + 8); ctx.lineTo(f0.x + 6, f0.y + 3); ctx.closePath();
    ctx.fillStyle = fill(mixHex(color, '#2c261e', 0.2), Math.min(1, theme.washAlpha + 0.2)); ctx.fill(); inkLine(ctx, st.normal, 1); ctx.stroke();
    if (!still && Math.sin(time * omega) > 0.7) {
      ctx.beginPath(); ctx.arc(f0.x - 13, f0.y + 8, 1.6, 0, Math.PI * 2); ctx.arc(f0.x - 19, f0.y + 10, 1.1, 0, Math.PI * 2);
      ctx.strokeStyle = hexA(theme.inkSoft, 0.5); ctx.lineWidth = 0.7; ctx.setLineDash([]); ctx.stroke();
    }
  }

  // ---------- 3. muszla (łodzik): zwinięta spirala na płaszczu
  feature(ctx, 'shell', o, st, (s) => {
    const c = at(0.55, 0.35), R = 27 * g;
    ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
    ctx.fillStyle = s.fill(theme.horn, 0.6); ctx.fill(); inkLine(ctx, s, 1.3); ctx.stroke();
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.15) {
      const r = R * (0.08 + 0.92 * a / (Math.PI * 5)), p = v(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
      if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    inkLine(ctx, s, 0.9); ctx.stroke();
    ctx.beginPath();
    for (let q = 0; q < 12; q++) { const a = q * 0.52 + 0.3; ctx.moveTo(c.x + Math.cos(a) * R * 0.45, c.y + Math.sin(a) * R * 0.45); ctx.lineTo(c.x + Math.cos(a) * R * 0.98, c.y + Math.sin(a) * R * 0.98); }
    inkLine(ctx, s, 0.5); ctx.strokeStyle = s.soft; ctx.stroke();
  });
  feature(ctx, 'insulation', o, st, (s) => {
    const r = rng(spec.seed ^ 0x51);
    ctx.beginPath();
    for (let t = 0.1; t < 0.95; t += 0.025) { const b = at(t, 1.02); const len = 2.2 + r() * 2; ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - len * 0.8, b.y - len); }
    inkLine(ctx, s, 0.8); ctx.strokeStyle = s.soft; ctx.stroke();
  });

  // ---------- 4. bliższe ramiona, macki łowne, dziób, oko
  armSet(st.normal, pres.limbs, false, false);
  feature(ctx, 'limbs', o, st, (s) => { if (s.ghost) armSet(s, 1, false, false); });
  const beak = add(headC, v(rh * 0.92, rh * 0.15));
  feature(ctx, 'jaws', o, st, (s) => {
    if (!s.ghost) armSet(s, pres.limbs, false, true);
    const open = still ? 0.15 : 0.12 + 0.1 * Math.sin(time * omega * 2);
    ctx.beginPath(); ctx.moveTo(beak.x - 1, beak.y - 4); ctx.quadraticCurveTo(beak.x + 7, beak.y - 4 - open * 8, beak.x + 6, beak.y + 1);
    ctx.quadraticCurveTo(beak.x + 2, beak.y - 1, beak.x - 1, beak.y); ctx.closePath();
    ctx.fillStyle = s.ghost ? s.fill('#000', 0.8) : hexA(mixHex(color, '#2c261e', 0.65), 0.95); ctx.fill(); inkLine(ctx, s, 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(beak.x - 1, beak.y + 3); ctx.quadraticCurveTo(beak.x + 5, beak.y + 4 + open * 8, beak.x + 4, beak.y - 1); ctx.lineTo(beak.x - 1, beak.y);
    ctx.fillStyle = s.ghost ? s.fill('#000', 0.6) : hexA(mixHex(color, '#2c261e', 0.5), 0.9); ctx.fill(); inkLine(ctx, s, 0.8); ctx.stroke();
  });
  feature(ctx, 'grasping_hand', o, st, (s) => {
    if (!s.ghost) return;
    const a = armsFor(spec, pres, time, still, pres.limbs, false)[2];
    const tip = a.pts[a.pts.length - 1];
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2); inkLine(ctx, s, 1); ctx.stroke();
  });
  feature(ctx, 'tool_use', o, st, (s) => {
    const a = armsFor(spec, pres, time, still, pres.limbs, false)[2];
    const tip = a.pts[a.pts.length - 1];
    drawStone(ctx, s, add(tip, v(4, -5)));
  });
  feature(ctx, 'filter_feeding', o, st, (s) => {
    ctx.beginPath();
    for (let q = 0; q < 6; q++) {
      const w = still ? 0 : Math.sin(time * omega * 2 + q) * 1.5;
      const b = add(headC, v(rh * 0.9, -6 + q * 2.4));
      ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + 9, b.y + w, b.x + 14 + q, b.y + 2 + q * 0.8 + w);
    }
    inkLine(ctx, s, 0.6); ctx.stroke();
    if (!still) {
      const r = rng(spec.seed ^ 0xf1);
      ctx.fillStyle = s.ghost ? s.stroke : hexA(theme.ink, 0.55);
      for (let q = 0; q < 7; q++) {
        const ph = (time * (o.cycle ? 1 / o.cycle : 0.35) + r()) % 1;
        const start = add(beak, v(sh.armLen * 0.7 + r() * 18, (r() - 0.5) * 30));
        const p = lerpV(start, beak, ph);
        ctx.beginPath(); ctx.arc(p.x, p.y, 0.9 + r() * 0.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
  // oko: plamka albo kamerowe oko z poziomą źrenicą
  const eyeC = add(headC, v(rh * 0.1, -rh * 0.28));
  ctx.beginPath(); ctx.arc(eyeC.x, eyeC.y, 1.3, 0, Math.PI * 2); ctx.fillStyle = theme.ink; ctx.fill();
  feature(ctx, 'eyes', o, st, (s, amt) => {
    const r = (6 + 1.5 * pres.brain) * Math.max(0.3, amt);
    ctx.beginPath(); ctx.arc(eyeC.x, eyeC.y, r, 0, Math.PI * 2);
    ctx.fillStyle = s.ghost ? s.fill('#000', 1) : theme.paper; ctx.fill(); inkLine(ctx, s, 1); ctx.stroke();
    if (!s.ghost) {
      ctx.beginPath(); ctx.arc(eyeC.x, eyeC.y, r * 0.72, 0, Math.PI * 2); ctx.fillStyle = hexA('#c49a2f', 0.9); ctx.fill();
      ctx.beginPath(); ctx.ellipse(eyeC.x, eyeC.y, r * 0.55, r * 0.17, 0, 0, Math.PI * 2); ctx.fillStyle = theme.ink; ctx.fill();
      ctx.beginPath(); ctx.arc(eyeC.x - r * 0.3, eyeC.y - r * 0.35, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    }
  });

  // ---------- 5. dźwięk
  drawEcho(ctx, o, st, theme, add(headC, v(rh, -2)), 0);
  drawVocal(ctx, o, st, theme, add(headC, v(0, -rh - 14)));
}
