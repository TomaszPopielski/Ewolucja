/*
 * arthropod.ts — plan budowy „stawonóg” (trylobit → skorupiak → owad).
 *
 * Ciało jest złożone z segmentów pod pancerzem; cechy gry mają tu inne
 * odpowiedniki niż u kręgowca: płetwy to odnóża pływne, kończyny to długie
 * odnóża kroczne, lot to owadzie skrzydła, ręka chwytna to szczypce, a układ
 * nerwowy to brzuszny łańcuch zwojów (jak u prawdziwych stawonogów).
 * Ruch jest cykliczny (całkowite wielokrotności omega), więc da się go „wypiec”.
 */
import { type CreatureSpec, rng, mixHex } from './spec.ts';
import {
  type Theme, type SceneOptions, type Presence, type Ctx, type V,
  feature, styles, inkLine, hexA, smoothPath, v, add, sub, mul, lerp, polar, lerpV
} from './draw.ts';
import { drawEcho, drawVocal, drawStone, drawBrain, drawPattern } from './extras.ts';

export interface ArthroShape { L: number; k: number; ventral: number; ground: number; omega: number }

/** Wymiary i rytm zwierzęcia; `limbs` pozwala policzyć też wariant „co-jeśli”. */
export function arthroShape(spec: CreatureSpec, pres: Presence, limbs = pres.limbs): ArthroShape {
  const L = 170 * spec.proportions.length;
  const k = (spec.proportions.girth * (1 + 0.12 * pres.shell)) ;
  const ventral = 0.42 * 20 * k;
  return { L, k, ventral, ground: ventral + lerp(10, 26, limbs), omega: lerp(3, 2.6, limbs) };
}

const KN: [number, number][] = [
  [0, 0], [0.04, 9], [0.12, 12.5], [0.2, 12], [0.3, 17], [0.5, 19.5], [0.7, 16], [0.86, 9], [1, 2.5]
];
function halfH(t: number): number {
  for (let i = 0; i < KN.length - 1; i++) {
    if (t <= KN[i + 1][0]) {
      const u = (t - KN[i][0]) / (KN[i + 1][0] - KN[i][0]);
      return lerp(KN[i][1], KN[i + 1][1], u * u * (3 - 2 * u));
    }
  }
  return KN[KN.length - 1][1];
}

export function drawArthropod(ctx: Ctx, spec: CreatureSpec, theme: Theme, o: SceneOptions) {
  const pres = o.pres, time = o.time, still = !!o.still;
  const sh = arthroShape(spec, pres);
  const st = styles(theme);
  const color = spec.bodyColor;
  const { L, k, omega } = sh;
  const wob = (t: number) => (still ? 0 : Math.sin(time * omega + t * 4) * 1.4 * t);
  /** Punkt na ciele: t = 0 (głowa) … 1 (odwłok), m = 1 (grzbiet) … −0,42 (brzuch). */
  const at = (t: number, m: number): V =>
    v(L * (0.5 - t), -2.5 * Math.sin(Math.PI * t) + wob(t) - halfH(t) * k * m);
  const head = at(0, 0);

  // ---------- kończyny (odnóża kroczne): zawsze, dłuższe z cechą „Kończyny”
  const NLEG = 5;
  const legSet = (s: typeof st.normal, limbs: number, far: boolean) => {
    const shp = arthroShape(spec, pres, limbs);
    const thick = lerp(1.7, 3.1, limbs) * spec.proportions.girth;
    ctx.save();
    if (far) ctx.globalAlpha *= 0.5;
    for (let j = 0; j < NLEG; j++) {
      const f = 1 - (2 * j) / (NLEG - 1);
      const hip = at(0.3 + j * 0.11, -0.3);
      const ph = still ? 0 : time * omega + j * 1.1 + (far ? Math.PI : 0);
      const w = lerp(0.4, 1, limbs);
      const sw = Math.sin(ph) * 6 * w, lift = Math.max(0, Math.cos(ph)) * 5 * w;
      const arm = j === 0 && !far && pres.grasping_hand > 0.5 && limbs > 0.5 && pres.flight < 0.5;
      // kolano wysoko i na zewnątrz (jak u pająka), stopa daleko od biodra
      let knee = v(hip.x + f * 15 * w + sw * 0.4, hip.y - lerp(4, 17, limbs));
      let foot = v(hip.x + f * 27 * w + sw, shp.ground - lift);
      if (arm) {
        // chwytny przedni odnóż: uniesiony, ze szczypcami
        const b = still ? 0 : Math.sin(time * omega) * 2;
        knee = v(hip.x + 13, hip.y - 5);
        foot = v(knee.x + 12, knee.y - 9 + b);
      }
      const seg = (a: V, b2: V, wd: number, fillC: string) => {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y);
        if (fillC) { ctx.strokeStyle = fillC; ctx.lineWidth = wd; ctx.setLineDash([]); } else inkLine(ctx, s, wd + 2.2);
        ctx.stroke();
      };
      const fillC = s.ghost ? s.fill('#000', 0.5) : mixHex(color, far ? '#3a3a3a' : '#ffffff', far ? 0.15 : 0.3);
      seg(hip, knee, thick * 1.1, ''); seg(knee, foot, thick * 0.8, '');
      seg(hip, knee, thick * 1.1, fillC); seg(knee, foot, thick * 0.8, fillC);
      ctx.beginPath(); ctx.arc(knee.x, knee.y, thick * 0.6, 0, Math.PI * 2); ctx.fillStyle = fillC; ctx.fill();
      // pazurek albo szczypce
      ctx.beginPath();
      if (arm) {
        ctx.moveTo(foot.x, foot.y); ctx.quadraticCurveTo(foot.x + 6, foot.y - 5, foot.x + 8, foot.y - 1);
        ctx.moveTo(foot.x, foot.y); ctx.quadraticCurveTo(foot.x + 5, foot.y + 2, foot.x + 7, foot.y + 5);
      } else {
        ctx.moveTo(foot.x - 2, foot.y); ctx.lineTo(foot.x + 1.5, foot.y + 1.6); ctx.lineTo(foot.x + 3.5, foot.y - 0.4);
      }
      inkLine(ctx, s, 1); ctx.stroke();
      if (arm && pres.tool_use > 0.5) drawStone(ctx, s, add(foot, v(6, -4)));
    }
    ctx.restore();
  };

  // ---------- skrzydło owadzie (dwa, tuż nad tułowiem)
  const wing = (s: typeof st.normal, far: boolean) => {
    const base = at(far ? 0.4 : 0.34, 0.95);
    const beat = still ? 0.2 : Math.sin(time * omega * 2);
    const th = 0.28 + 0.5 * (0.5 + 0.5 * beat) + (far ? 0.12 : 0);
    const len = 78, wd = 15;
    const tip = add(base, polar(Math.PI + th, len));
    const n = polar(Math.PI + th - Math.PI / 2, wd);
    ctx.save();
    if (far) ctx.globalAlpha *= 0.55;
    ctx.beginPath(); ctx.moveTo(base.x, base.y);
    ctx.quadraticCurveTo(lerpV(base, tip, 0.5).x + n.x, lerpV(base, tip, 0.5).y + n.y, tip.x, tip.y);
    ctx.quadraticCurveTo(lerpV(base, tip, 0.55).x - n.x * 0.5, lerpV(base, tip, 0.55).y - n.y * 0.5, base.x, base.y);
    ctx.closePath();
    ctx.fillStyle = s.fill(spec.accentColor, far ? 0.22 : 0.32); ctx.fill();
    inkLine(ctx, s, 1); ctx.stroke();
    ctx.beginPath();
    for (let q = 0; q < 4; q++) {
      const e = add(lerpV(base, tip, 0.9 - q * 0.05), mul(n, 0.55 - q * 0.22));
      ctx.moveTo(base.x, base.y); ctx.lineTo(e.x, e.y);
    }
    inkLine(ctx, s, 0.5); ctx.strokeStyle = s.soft; ctx.stroke();
    ctx.restore();
  };

  // ---------- czułki
  const antennae = (far: boolean) => {
    const s = st.normal;
    const b = at(0.05, 0.95);
    const len = 32 + 24 * Math.max(pres.lateral_line, 0.0) + 8 * pres.eyes;
    ctx.save();
    if (far) ctx.globalAlpha *= 0.5;
    ctx.beginPath();
    for (let q = 0; q <= 12; q++) {
      const u = q / 12;
      const w = still ? 0 : Math.sin(time * omega + u * 4 + (far ? 1.3 : 0)) * 4 * u;
      const p = v(b.x + u * len * 0.95 + (far ? 2 : 0), b.y - u * len * 0.5 + w + Math.sin(u * 2.2) * 4);
      if (q === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    inkLine(ctx, s, 0.9); ctx.stroke();
    ctx.restore();
  };

  // ---------- 1. strona dalsza
  legSet(st.normal, pres.limbs, true);
  if (pres.flight > 0.01) feature(ctx, 'flight', o, st, (s) => wing(s, true));
  antennae(true);
  feature(ctx, 'limbs', o, st, (s) => { if (s.ghost) legSet(s, 1, true); });

  // ---------- 2. ciało
  const outline: V[] = [];
  for (let i = 0; i <= 40; i++) outline.push(at(i / 40, 1));
  for (let i = 40; i >= 1; i--) outline.push(at(i / 40, -0.42));
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

  drawPattern(ctx, spec, theme, at, [0.22, 0.88]);

  // bruzdy między segmentami
  ctx.beginPath();
  [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].forEach((t) => {
    const a = at(t, 1.05), b = at(t, -0.5), c = at(t + 0.03, 0.3);
    ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
  });
  ctx.strokeStyle = hexA(theme.ink, 0.42); ctx.lineWidth = 0.9; ctx.setLineDash([]); ctx.stroke();

  feature(ctx, 'camouflage', o, st, (s) => {
    const r = rng(spec.seed ^ 0xca);
    for (let b = 0; b < 11; b++) {
      const c = at(0.1 + r() * 0.8, r() * 0.9 - 0.1);
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 3 + r() * 5, 2 + r() * 3, r() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = s.ghost ? s.fill('#000', 0.6) : hexA(mixHex(color, theme.ink, 0.55), 0.38); ctx.fill();
    }
  });
  feature(ctx, 'scales', o, st, (s) => {
    ctx.beginPath();
    for (let t = 0.22; t < 0.9; t += 0.045) {
      for (let m = 0.15; m < 1; m += 0.4) {
        const c = at(t, m);
        ctx.moveTo(c.x + 2.4, c.y); ctx.arc(c.x, c.y, 2.4, 0, Math.PI, true);
      }
    }
    ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.ink, 0.32); ctx.lineWidth = 0.6;
    ctx.setLineDash(s.ghost ? [2, 2] : []); ctx.stroke();
  });
  feature(ctx, 'fast_muscle', o, st, (s) => {
    ctx.beginPath();
    for (let t = 0.5; t < 0.9; t += 0.045) {
      const a = at(t, 0.8), b = at(t + 0.03, 0.2), c = at(t, -0.3);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
    }
    ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.danger, 0.35); ctx.lineWidth = 0.8;
    ctx.setLineDash(s.ghost ? [2, 2] : []); ctx.stroke();
  });
  feature(ctx, 'lateral_line', o, st, (s) => {
    ctx.fillStyle = s.ghost ? s.stroke : theme.ink;
    for (let t = 0.1; t < 0.9; t += 0.03) { const c = at(t, 0.55); ctx.beginPath(); ctx.arc(c.x, c.y, 0.9, 0, Math.PI * 2); ctx.fill(); }
  });
  // ciepło mięśni lotnych i „ogrzewanie” tułowia
  feature(ctx, 'endothermy', o, st, (s) => {
    const c = at(0.4, 0.3);
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 24 * k);
    g.addColorStop(0, s.ghost ? s.fill('#000', 0.5) : hexA(theme.danger, 0.3)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(c.x - 30, c.y - 30, 60, 60);
  });
  // brzuszny łańcuch nerwowy: rdzeń ze zwojami i zwój mózgowy w głowie
  feature(ctx, 'ganglia', o, st, (s) => {
    ctx.beginPath();
    for (let t = 0.08; t <= 0.88; t += 0.02) { const p = at(t, -0.1); if (t === 0.08) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.ep, 0.85); ctx.lineWidth = 1.1; ctx.setLineDash([2.5, 2]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = s.ghost ? s.stroke : theme.ep;
    [0.24, 0.34, 0.44, 0.54, 0.64, 0.74].forEach((t) => { const c = at(t, -0.1); ctx.beginPath(); ctx.arc(c.x, c.y, 1.7, 0, Math.PI * 2); ctx.fill(); });
  });
  drawBrain(ctx, o, st, theme, at(0.09, 0.35), 5.5 * spec.proportions.head);
  ctx.restore();
  ctx.beginPath(); smoothPath(ctx, outline, true);
  inkLine(ctx, st.normal, 1.5); ctx.stroke();

  // telson (kolec odwłoka)
  const tl = at(1, 0.2);
  ctx.beginPath(); ctx.moveTo(tl.x + 1, tl.y - 3); ctx.lineTo(tl.x - 14, tl.y + 1); ctx.lineTo(tl.x + 1, tl.y + 3.5); ctx.closePath();
  ctx.fillStyle = hexA(mixHex(color, '#2c261e', 0.3), Math.min(1, theme.washAlpha + 0.25)); ctx.fill();
  inkLine(ctx, st.normal, 1.1); ctx.stroke();

  // ---------- 3. płetwy: odnóża pływne pod odwłokiem
  feature(ctx, 'fins', o, st, (s, amt) => {
    for (let j = 0; j < 4; j++) {
      const b = at(0.62 + j * 0.07, -0.4);
      const sw = still ? 0.3 : Math.sin(time * omega * 2 - j * 0.9) * 0.5;
      const e = add(b, polar(Math.PI / 2 + 0.25 + sw, 13 * amt));
      ctx.beginPath(); ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(b.x - 4, lerp(b.y, e.y, 0.5), e.x, e.y);
      ctx.quadraticCurveTo(e.x + 5, lerp(b.y, e.y, 0.6), b.x + 1.5, b.y);
      ctx.fillStyle = s.fill(spec.accentColor, 0.4); ctx.fill(); inkLine(ctx, s, 0.9); ctx.stroke();
    }
  });

  // ---------- 4. pancerz (karapaks nad tułowiem) i włoski
  feature(ctx, 'shell', o, st, (s) => {
    const outer: V[] = [], inner: V[] = [];
    for (let t = 0.18; t <= 0.76; t += 0.02) {
      const bump = Math.sin(Math.PI * (t - 0.18) / 0.58);
      inner.push(at(t, 0.5));
      outer.push(at(t, 1.02 + 0.08 + 0.2 * bump));
    }
    ctx.beginPath(); smoothPath(ctx, outer.concat(inner.slice().reverse()), true);
    ctx.fillStyle = s.fill(theme.horn, 0.6); ctx.fill(); inkLine(ctx, s, 1.2); ctx.stroke();
    ctx.beginPath();
    for (let q = 1; q < 8; q++) {
      const idx = Math.round((q / 8) * (outer.length - 1));
      ctx.moveTo(inner[idx].x, inner[idx].y); ctx.lineTo(outer[idx].x, outer[idx].y);
    }
    inkLine(ctx, s, 0.8); ctx.stroke();
  });
  feature(ctx, 'insulation', o, st, (s) => {
    const r = rng(spec.seed ^ 0x51);
    ctx.beginPath();
    for (let t = 0.08; t < 0.94; t += 0.02) {
      const b = at(t, 1.02 + (pres.shell > 0.5 && t > 0.18 && t < 0.76 ? 0.2 : 0));
      const len = 2.4 + r() * 2.2;
      ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - len * 0.9, b.y - len);
    }
    inkLine(ctx, s, 0.8); ctx.strokeStyle = s.soft; ctx.stroke();
  });

  // ---------- 5. głowa: aparat gębowy, oko, czułki
  {
    const m = at(0.005, -0.15);
    const sj = lerp(3, 7, pres.jaws);
    const open = still ? 0.15 : 0.12 + 0.1 * Math.sin(time * omega * 2);
    const horn = (dir: number) => {
      const c = add(m, polar(dir * (0.6 + open), sj));
      const e = add(m, polar(dir * (-0.2 - open * 0.5), sj * 1.35));
      ctx.moveTo(m.x, m.y); ctx.quadraticCurveTo(c.x, c.y, e.x, e.y);
    };
    ctx.beginPath(); horn(-1); horn(1);
    inkLine(ctx, st.normal, pres.jaws > 0.5 ? 2.2 : 1.1); ctx.stroke();
    feature(ctx, 'jaws', o, st, (s) => {
      ctx.beginPath(); horn(-1); horn(1);
      ctx.strokeStyle = s.ghost ? s.stroke : hexA(mixHex(color, '#2c261e', 0.6), 0.95); ctx.lineWidth = 3.2 * (s.ghost ? 1 : 0.7);
      ctx.setLineDash(s.ghost ? [3, 2.5] : []); ctx.stroke();
    });
    feature(ctx, 'filter_feeding', o, st, (s) => {
      ctx.beginPath();
      for (let q = 0; q < 6; q++) {
        const w = still ? 0 : Math.sin(time * omega * 2 + q) * 1.5;
        const b = add(m, v(1, 1 + q * 0.9));
        ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + 8, b.y + 3 + w, b.x + 12 + q, b.y + 1 + q * 1.2 + w);
      }
      inkLine(ctx, s, 0.7); ctx.stroke();
      if (!still) {
        const r = rng(spec.seed ^ 0xf1);
        ctx.fillStyle = s.ghost ? s.stroke : hexA(theme.ink, 0.55);
        for (let q = 0; q < 7; q++) {
          const ph = (time * (o.cycle ? 1 / o.cycle : 0.35) + r()) % 1;
          const start = add(m, v(22 + r() * 18, (r() - 0.5) * 22));
          const p = lerpV(start, m, ph);
          ctx.beginPath(); ctx.arc(p.x, p.y, 0.9 + r() * 0.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    });
    // oko: plamka światłoczuła albo oko złożone z fasetek
    const eyeC = at(0.07, 0.5);
    ctx.beginPath(); ctx.arc(eyeC.x, eyeC.y, 1.3, 0, Math.PI * 2); ctx.fillStyle = theme.ink; ctx.fill();
    feature(ctx, 'eyes', o, st, (s, amt) => {
      const r = (3.6 + 1.2 * pres.brain) * Math.max(0.3, amt) * spec.proportions.head;
      ctx.beginPath(); ctx.arc(eyeC.x, eyeC.y, r, 0, Math.PI * 2);
      ctx.fillStyle = s.ghost ? s.fill('#000', 1) : hexA(mixHex('#c49a2f', '#2c261e', 0.45), 0.95); ctx.fill();
      inkLine(ctx, s, 0.9); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.arc(eyeC.x, eyeC.y, r, 0, Math.PI * 2); ctx.clip();
      ctx.beginPath();
      for (let q = -2; q <= 2; q++) {
        ctx.moveTo(eyeC.x + q * r * 0.45, eyeC.y - r); ctx.lineTo(eyeC.x + q * r * 0.45 + r * 0.3, eyeC.y + r);
        ctx.moveTo(eyeC.x - r, eyeC.y + q * r * 0.45); ctx.lineTo(eyeC.x + r, eyeC.y + q * r * 0.45 + r * 0.2);
      }
      ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.paper, 0.4); ctx.lineWidth = 0.5; ctx.stroke();
      ctx.restore();
      if (!s.ghost) { ctx.beginPath(); ctx.arc(eyeC.x - r * 0.3, eyeC.y - r * 0.35, r * 0.2, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); }
    });
  }
  antennae(false);

  // ---------- 6. strona bliższa
  legSet(st.normal, pres.limbs, false);
  feature(ctx, 'limbs', o, st, (s) => { if (s.ghost) legSet(s, 1, false); });
  if (pres.flight > 0.01 || o.ghost.flight > 0.01) feature(ctx, 'flight', o, st, (s) => wing(s, false));
  feature(ctx, 'grasping_hand', o, st, (s) => {
    if (!s.ghost) return;
    const f = at(0.3, -0.3);
    ctx.beginPath(); ctx.arc(f.x + 25, f.y - 14, 5, 0, Math.PI * 2); inkLine(ctx, s, 1); ctx.stroke();
  });

  // ---------- 7. dźwięk
  drawEcho(ctx, o, st, theme, sub(head, v(0, 2)), 0);
  drawVocal(ctx, o, st, theme, add(at(0.1, 1), v(0, -22)));
}

/** Jak nisko sięgają odnóża względem środka ciała. */
export function arthroFootDrop(spec: CreatureSpec, pres: Presence): number {
  const sh = arthroShape(spec, pres);
  return lerp(sh.ventral, sh.ground + 1.5, pres.limbs);
}

export function arthroExtents(spec: CreatureSpec, pres: Presence) {
  const sh = arthroShape(spec, pres);
  return { L: sh.L, left: sh.L / 2 + 22, right: sh.L / 2 + 66, top: 46 + 20 * sh.k + 72 * pres.flight, bottom: sh.ground + 12 };
}
