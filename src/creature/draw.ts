/*
 * draw.ts — rysowanie zwierzęcia i tła w stylu „ilustracja naukowa”.
 *
 * Canvas 2D, bez zależności. Ciało to kręgosłup (seria punktów) z profilem
 * szerokości; plan budowy (robak → ryba → czworonóg → ptak/ssak) jest płynną
 * mieszanką profili zależną od obecności cech (0…1). Dzięki temu nowa cecha
 * „wyrasta” zamiast pojawiać się skokiem. Rysunek: kontur tuszem + ton
 * laweryjny + kreskowanie cienia, jak na tablicach przyrodniczych.
 *
 * Wszystkie funkcje są czyste względem stanu gry: dostają opis (spec),
 * obecności cech i czas; ten sam kod posłuży dioramie i miniaturom.
 */
import { drawArthropod, arthroFootDrop, arthroShape, arthroExtents } from './arthropod.ts';
import { drawCephalopod, cephFootDrop, cephShape, cephExtents } from './cephalopod.ts';
import { type CreatureSpec, type Feature, type Niche, FEATURES, rng, mixHex, scaleLabel } from './spec.ts';

export interface Theme {
  ink: string;
  inkSoft: string;
  paper: string;
  line: string;
  ep: string;
  accent: string;
  danger: string;
  niche: Record<Niche, string>;
  horn: string;
  washAlpha: number;
  dark: boolean;
}

/** Obecność cech: 0 = brak, 1 = w pełni widoczna (animowana przy zakupie). */
export type Presence = Record<Feature, number>;

export function emptyPresence(): Presence {
  const p = {} as Presence;
  FEATURES.forEach((f) => { p[f] = 0; });
  return p;
}

export interface SceneOptions {
  time: number;
  /** Obecność cech posiadanych. */
  pres: Presence;
  /** Obecność cech w podglądzie „co-jeśli” (rysowane jako szkic). */
  ghost: Presence;
  /** Klimat tury — wpływa np. na oddech stałocieplnych na mrozie. */
  climate?: string;
  /** Bez animacji (ograniczenie ruchu): stała poza. */
  still?: boolean;
  /** Okres pętli animacji [s] przy wypiekaniu klatek — wyłącza zdarzenia niecykliczne. */
  cycle?: number;
  /** Mnożnik grubości konturu (domyślnie 1). */
  lineWeight?: number;
}

// ------------------------------------------------------------------ geometria

export interface V { x: number; y: number }
export const v = (x: number, y: number): V => ({ x, y });
export const add = (a: V, b: V): V => v(a.x + b.x, a.y + b.y);
export const sub = (a: V, b: V): V => v(a.x - b.x, a.y - b.y);
export const mul = (a: V, k: number): V => v(a.x * k, a.y * k);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const polar = (ang: number, len: number): V => v(Math.cos(ang) * len, Math.sin(ang) * len);

/** Punkty kontrolne profilu (pół-szerokości) w t = 0 (pysk) … 1 (koniec ogona). */
const KNOTS = [0, 0.05, 0.12, 0.25, 0.45, 0.65, 0.85, 1];
const PROFILE = {
  worm: [0, 6.5, 7.5, 8, 8, 7.5, 5.5, 1.2],
  fish: [0, 12, 17, 22, 21, 14, 5.5, 3],
  tetra: [0, 10, 10.5, 7, 17, 15, 5.5, 1.2],
  mammal: [0, 11, 12, 8, 19, 17, 5, 1.2],
  /** Ptak i pterozaur: mała głowa, cienka szyja, głęboka pierś, krótki ogon. */
  bird: [0, 6.5, 6.5, 4.6, 15.5, 13, 4.5, 2.2],
  /** Gad: cienka szyja, ciężki tułów i gruby ogon. */
  saur: [0, 6.5, 6, 5, 17, 16, 10, 2.8],
  /** Postawa wyprostowana: okrągła głowa, wyraźna szyja, smuklejszy tułów, biodra. */
  erect: [0, 10, 10.5, 4.8, 13, 11.5, 4.5, 1.2]
};

function profileAt(p: number[], t: number): number {
  for (let i = 0; i < KNOTS.length - 1; i++) {
    if (t <= KNOTS[i + 1]) {
      const u = (t - KNOTS[i]) / (KNOTS[i + 1] - KNOTS[i]);
      const s = u * u * (3 - 2 * u);
      return lerp(p[i], p[i + 1], s);
    }
  }
  return p[p.length - 1];
}

interface Plan {
  f: number; l: number; fl: number; en: number; br: number; bb: number;
  land: number; air: number; water: number;
  /** Uniesienie przodu ciała (ręka chwytna na lądzie) — przednia kończyna staje się ręką. */
  raise: number;
  /** Ptak (lot z piórami), pterozaur (lot na błonie), ssak (futro i stałocieplność na kończynach): 0…1. */
  bird: number; ptero: number; mam: number;
  /**
   * Podstawowa częstość ruchu [rad/s]. Wszystkie ruchy cykliczne (falowanie,
   * chód, skrzydła) są jej całkowitymi wielokrotnościami, więc animacja
   * zamyka się w pętli o okresie 2π/omega — można ją „wypiec” do klatek.
   */
  omega: number;
}

interface Body {
  n: number;
  ts: number[];
  P: V[]; T: V[]; N: V[]; W: number[];
  upper: V[]; lower: V[];
  length: number;
}

const N_SEG = 34;

function buildBody(spec: CreatureSpec, plan: Plan, time: number, still: boolean): Body {
  const { f, l, fl, en, br, bb, bird, ptero } = plan;
  const avian = Math.max(bird, ptero);
  // ptak i pterozaur mają krótki, zwarty tułów
  const L = 200 * spec.proportions.length * (1 - 0.26 * bird - 0.2 * ptero);
  const girth = spec.proportions.girth;
  const headK = spec.proportions.head * (1 + 0.22 * br + 0.35 * bb);
  const saur = spec.form === 'saur' ? l * (1 - fl) : 0;
  // ogon: krótszy u stałocieplnych i lotnych; u wyprostowanej formy rozumnej prawie znika
  // (gadzia sylwetka zachowuje go jako przeciwwagę)
  const tailCompress = (1 - 0.45 * en * l) * (1 + 0.32 * saur) * (1 - 0.3 * bird - 0.25 * ptero)
    * (1 - plan.raise * (spec.form === 'saur' ? 0.25 : 0.78));

  // Falowanie: robak całym ciałem, ryba ogonem, na lądzie ledwie ogon.
  const wormA = (t: number) => 9 * Math.pow(t, 1.2);
  const fishA = (t: number) => 1.5 + 11 * t * t;
  const tetraA = (t: number) => 1 + 6 * t * t;
  const landA = (t: number) => 1.2 * t * t;
  const speed = plan.omega;
  const k = lerp(1.25, 0.85, f);

  const ts: number[] = [], P: V[] = [], W: number[] = [];
  for (let i = 0; i <= N_SEG; i++) {
    const t = i / N_SEG;
    ts.push(t);
    let w = lerp(profileAt(PROFILE.worm, t), profileAt(PROFILE.fish, t), f);
    w = lerp(w, profileAt(PROFILE.tetra, t), l);
    w = lerp(w, profileAt(PROFILE.mammal, t), en * l);
    w = lerp(w, profileAt(PROFILE.bird, t), avian);
    w = lerp(w, profileAt(PROFILE.saur, t), saur * (1 - 0.4 * en));
    w = lerp(w, profileAt(PROFILE.erect, t), plan.raise * (spec.form === 'saur' ? 0.5 : 1));
    if (t <= 0.14) w *= lerp(1, headK, clamp01(1 - (t - 0.1) / 0.04));
    w *= girth * Math.sqrt(Math.min(1, t / 0.055));
    W.push(w);

    let x = t <= 0.7 ? L * (0.5 - t) : L * (0.5 - 0.7) - (t - 0.7) * L * tailCompress;
    // postawa wyprostowana: krótszy tułów (głowa i tułów mniej więcej tak długie jak nogi)
    if (t < 0.64) x = L * (0.5 - 0.64) + (0.64 - t) * L * (1 - 0.3 * plan.raise);
    // pterozaur: wydłużona głowa z długim dziobem
    if (t < 0.1) x += ptero * 16 * Math.pow(1 - t / 0.1, 1.2);
    let A = lerp(lerp(wormA(t), fishA(t), f), tetraA(t), l);
    A = lerp(A, landA(t), plan.land);
    A = lerp(A, 0.4 * t, plan.air);
    const y = still ? 0 : A * Math.sin(k * t * Math.PI * 2 - time * speed);
    // długa szyja gada unosi głowę ponad grzbiet (łagodny łuk)
    const neck = saur > 0 && t < 0.3 ? saur * 24 * Math.pow(1 - t / 0.3, 2) : 0;
    // ptak i pterozaur trzymają głowę wysoko na szyi (w locie wyciągniętej do przodu)
    const avNeck = avian > 0 && t < 0.3 ? avian * (1 - 0.6 * plan.air) * 16 * Math.pow(1 - t / 0.3, 1.6) : 0;
    P.push(v(x, y - neck - avNeck));
  }
  // Postawa wyprostowana: przód ciała obraca się wokół bioder (t ≈ 0,64) — przy
  // rozbudowanym mózgu prawie do pionu — a głowa wokół szyi z powrotem do przodu,
  // żeby zwierzę patrzyło przed siebie, a nie w niebo. Łagodnie, bez załamań.
  if (plan.raise > 0.01) {
    const rot = (pivotT: number, spread: number, ang: number) => {
      const pivotI = Math.round(pivotT * N_SEG), pivot = P[pivotI];
      for (let i = 0; i < pivotI; i++) {
        const u = clamp01((pivotT - ts[i]) / spread);
        const a = ang * u * u * (3 - 2 * u);
        const d = sub(P[i], pivot);
        P[i] = add(pivot, v(d.x * Math.cos(a) - d.y * Math.sin(a), d.x * Math.sin(a) + d.y * Math.cos(a)));
      }
    };
    rot(0.64, 0.2, -1.05 * plan.raise);
    rot(0.17, 0.07, 0.75 * plan.raise);
  }
  // ptak stojący na ziemi unosi pierś i głowę (tułów pochylony ok. 20°)
  const perch = plan.bird * plan.land;
  if (perch > 0.01) {
    const pivotI = Math.round(0.6 * N_SEG), pivot = P[pivotI];
    for (let i = 0; i < pivotI; i++) {
      const u = clamp01((0.6 - ts[i]) / 0.3), a = -0.36 * perch * u * u * (3 - 2 * u);
      const d = sub(P[i], pivot);
      P[i] = add(pivot, v(d.x * Math.cos(a) - d.y * Math.sin(a), d.x * Math.sin(a) + d.y * Math.cos(a)));
    }
  }
  const T: V[] = [], Nn: V[] = [], upper: V[] = [], lower: V[] = [];
  for (let i = 0; i <= N_SEG; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(N_SEG, i + 1)];
    const d = sub(b, a); const len = Math.hypot(d.x, d.y) || 1;
    const tan = mul(d, 1 / len);
    const nUp = v(-tan.y, tan.x);
    // Tangent wskazuje w stronę ogona (−x), więc nUp = (0, −1) = „w górę”.
    T.push(tan); Nn.push(nUp);
    upper.push(add(P[i], mul(nUp, W[i])));
    lower.push(sub(P[i], mul(nUp, W[i])));
  }
  return { n: N_SEG + 1, ts, P, T, N: Nn, W, upper, lower, length: L };
}

function at(body: Body, t: number): { p: V; tan: V; n: V; w: number } {
  const x = clamp01(t) * (body.n - 1);
  const i = Math.min(body.n - 2, Math.floor(x));
  const u = x - i;
  return {
    p: v(lerp(body.P[i].x, body.P[i + 1].x, u), lerp(body.P[i].y, body.P[i + 1].y, u)),
    tan: body.T[i], n: body.N[i],
    w: lerp(body.W[i], body.W[i + 1], u)
  };
}

// ------------------------------------------------------------------ pędzle

export interface Style {
  stroke: string;
  soft: string;
  fill: (c: string, alpha?: number) => string;
  ghost: boolean;
}

export function hexA(hex: string, a: number): string {
  if (hex.startsWith('rgb')) return hex;
  const p = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((p >> 16) & 255) + ',' + ((p >> 8) & 255) + ',' + (p & 255) + ',' + a.toFixed(3) + ')';
}

export function styles(theme: Theme): { normal: Style; ghost: Style } {
  return {
    normal: {
      stroke: theme.ink, soft: theme.inkSoft, ghost: false,
      fill: (c, a) => hexA(c, a == null ? theme.washAlpha : a)
    },
    ghost: {
      stroke: theme.ep, soft: theme.ep, ghost: true,
      fill: (_c, a) => hexA(theme.ep, (a == null ? theme.washAlpha : a) * 0.45)
    }
  };
}

export type Ctx = CanvasRenderingContext2D;

/** Gładka ścieżka przez punkty (krzywe przez środki odcinków). */
export function smoothPath(ctx: Ctx, pts: V[], closed: boolean) {
  const n = pts.length;
  if (n < 2) return;
  if (closed) {
    const m0 = mul(add(pts[n - 1], pts[0]), 0.5);
    ctx.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const m = mul(add(p, q), 0.5);
      ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n - 1; i++) {
      const m = mul(add(pts[i], pts[i + 1]), 0.5);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
  }
}

function bodyOutline(body: Body): V[] {
  const pts: V[] = [];
  for (let i = 0; i < body.n; i++) pts.push(body.upper[i]);
  for (let i = body.n - 1; i >= 1; i--) pts.push(body.lower[i]);
  return pts;
}

/**
 * Mnożnik grubości konturu na czas jednego rysunku. Małe osobniki w dioramie
 * potrzebują proporcjonalnie grubszej kreski, żeby tusz nie znikał.
 */
let lineK = 1;

export function inkLine(ctx: Ctx, s: Style, width: number) {
  ctx.strokeStyle = s.stroke;
  ctx.lineWidth = width * lineK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(s.ghost ? [3, 2.5] : []);
}

/**
 * Rysuje cechę z uwzględnieniem obecności (p) i podglądu (g): posiadana
 * część — tuszem, podglądana — fioletowym szkicem przerywaną linią.
 */
export function feature(ctx: Ctx, key: Feature, o: SceneOptions, st: { normal: Style; ghost: Style },
  fn: (s: Style, amount: number) => void) {
  const p = o.pres[key], g = o.ghost[key];
  if (p > 0.01) {
    ctx.save(); ctx.globalAlpha *= clamp01(p); fn(st.normal, p); ctx.restore();
  }
  if (g > 0.01 && p < 0.99) {
    ctx.save();
    const pulse = o.still ? 1 : 0.65 + 0.35 * Math.sin(o.time * 4);
    ctx.globalAlpha *= g * (1 - p) * pulse;
    fn(st.ghost, 1); ctx.restore();
  }
}

// ------------------------------------------------------------------ części ciała

function drawCaudalFin(ctx: Ctx, body: Body, s: Style, k: number, color: string) {
  const i = body.n - 1;
  const p = body.P[i], t = body.T[i], n = body.N[i];
  const sz = 1.25 * k;
  const up = add(add(p, mul(t, 18 * sz)), mul(n, 15 * sz));
  const dn = add(add(p, mul(t, 16 * sz)), mul(n, -12 * sz));
  const notch = add(p, mul(t, 8 * sz));
  const base1 = add(p, mul(n, 3.5)), base2 = add(p, mul(n, -3.5));
  ctx.beginPath();
  ctx.moveTo(base1.x, base1.y);
  const c1 = add(add(base1, mul(t, 10 * sz)), mul(n, 3 * sz));
  const c2 = add(add(base2, mul(t, 9 * sz)), mul(n, -2 * sz));
  ctx.quadraticCurveTo(c1.x, c1.y, up.x, up.y);
  ctx.lineTo(notch.x, notch.y);
  ctx.lineTo(dn.x, dn.y);
  ctx.quadraticCurveTo(c2.x, c2.y, base2.x, base2.y);
  ctx.closePath();
  ctx.fillStyle = s.fill(color, 0.35); ctx.fill();
  inkLine(ctx, s, 1.2); ctx.stroke();
  // promienie płetwy
  ctx.beginPath();
  for (let r = 0; r <= 6; r++) {
    const tip = r <= 3 ? lerpV(up, notch, r / 3) : lerpV(notch, dn, (r - 3) / 3);
    ctx.moveTo(p.x, p.y); ctx.lineTo(lerpV(p, tip, 0.92).x, lerpV(p, tip, 0.92).y);
  }
  inkLine(ctx, s, 0.5); ctx.strokeStyle = s.soft; ctx.stroke();
}
export const lerpV = (a: V, b: V, t: number): V => v(lerp(a.x, b.x, t), lerp(a.y, b.y, t));

function drawDorsalFin(ctx: Ctx, body: Body, s: Style, k: number, color: string) {
  const a = at(body, 0.34), b = at(body, 0.58), apex = at(body, 0.43);
  const pa = add(a.p, mul(a.n, a.w * 0.9)), pb = add(b.p, mul(b.n, b.w * 0.9));
  const top = add(add(apex.p, mul(apex.n, apex.w + 13 * k)), mul(apex.tan, 4 * k));
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.quadraticCurveTo(lerpV(pa, top, 0.6).x + a.n.x * 4, lerpV(pa, top, 0.6).y + a.n.y * 4, top.x, top.y);
  ctx.quadraticCurveTo(lerpV(top, pb, 0.5).x, lerpV(top, pb, 0.5).y, pb.x, pb.y);
  ctx.closePath();
  ctx.fillStyle = s.fill(color, 0.3); ctx.fill();
  inkLine(ctx, s, 1.1); ctx.stroke();
  ctx.beginPath();
  for (let r = 1; r < 6; r++) {
    const base = lerpV(pa, pb, r / 6);
    const tip = lerpV(top, pb, Math.max(0, (r - 2) / 4));
    ctx.moveTo(base.x, base.y); ctx.lineTo(lerpV(base, r < 3 ? lerpV(pa, top, 0.5 + r * 0.2) : tip, 0.9).x,
      lerpV(base, r < 3 ? lerpV(pa, top, 0.5 + r * 0.2) : tip, 0.9).y);
  }
  inkLine(ctx, s, 0.5); ctx.strokeStyle = s.soft; ctx.stroke();
}

function drawPectoralFin(ctx: Ctx, body: Body, s: Style, k: number, phase: number, color: string, tAt = 0.22, len = 17) {
  const a = at(body, tAt);
  const base = sub(a.p, mul(a.n, a.w * 0.35));
  const ang = Math.atan2(a.tan.y, a.tan.x) + 0.55 + 0.25 * Math.sin(phase);
  const tip = add(base, polar(ang, len * k));
  const side = add(base, polar(ang + 0.55, len * 0.62 * k));
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.quadraticCurveTo(lerpV(base, tip, 0.5).x - 2, lerpV(base, tip, 0.5).y - 3, tip.x, tip.y);
  ctx.quadraticCurveTo(lerpV(tip, side, 0.5).x + 3, lerpV(tip, side, 0.5).y + 3, side.x, side.y);
  ctx.closePath();
  ctx.fillStyle = s.fill(color, 0.3); ctx.fill();
  inkLine(ctx, s, 1); ctx.stroke();
  ctx.beginPath();
  for (let r = 1; r <= 3; r++) { const e = lerpV(tip, side, r / 4); ctx.moveTo(base.x, base.y); ctx.lineTo(e.x, e.y); }
  inkLine(ctx, s, 0.45); ctx.strokeStyle = s.soft; ctx.stroke();
}

interface LegPose { hip: V; knee: V; foot: V; toeDir: number }

function legPose(body: Body, plan: Plan, tAt: number, front: boolean, phase: number, time: number, still: boolean): LegPose {
  const a = at(body, tAt);
  const hip = sub(a.p, mul(a.n, a.w * 0.45));
  // ssak: dłuższe nogi pod ciałem; forma wyprostowana: długie nogi, na których stoi
  const k = (1 + 0.35 * plan.en + 0.3 * plan.mam + 0.4 * plan.raise) * (1 - 0.35 * plan.air) * (1 - 0.2 * plan.bird);
  const l1 = 16 * k, l2 = 15 * k;
  const walk = still ? 0 : time * plan.omega * (1 + plan.land);
  const ph = walk + phase;
  const swing = (0.42 * plan.land + 0.35 * plan.water) * Math.sin(ph);
  const lift = still ? 0 : Math.max(0, Math.cos(ph)) * 0.5 * plan.land;
  const trail = 0.9 * plan.water + 1.2 * plan.air;
  const en = plan.en;
  // Kąty: 0 = w stronę głowy, π/2 = w dół, > π/2 = w stronę ogona.
  // Zimnokrwiste (rozkrok): łokieć w tył, kolano w przód, mocno zgięte;
  // stałocieplne: kończyny prosto pod ciałem.
  let th1: number, th2: number;
  if (front) {
    th1 = Math.PI / 2 + lerp(0.6, 0.15, en) - swing + trail;
    th2 = Math.PI / 2 - lerp(0.55, 0.12, en) - lift + trail * 0.7;
  } else {
    th1 = Math.PI / 2 - lerp(0.6, 0.25, en) - swing + trail;
    th2 = Math.PI / 2 + lerp(0.6, 0.4, en) + lift + trail * 0.7;
  }
  // Postawa wyprostowana: tylna noga prawie prosta, stopa pod biodrem; nogi lekko
  // rozstawione (dalsza w przód, bliższa w tył), żeby było widać obie także w stałej pozie.
  if (!front && plan.raise > 0.01) {
    const stance = 0.16 * Math.cos(phase);
    th1 = lerp(th1, Math.PI / 2 - 0.1 - swing * 0.5 - stance, plan.raise);
    th2 = lerp(th2, Math.PI / 2 + 0.08 + lift * 0.3 - stance * 0.5, plan.raise);
  }
  // Ręka (postawa wyprostowana): ramię zwisa, przedramię wysunięte do przodu.
  if (front && plan.raise > 0.01) {
    const armSwing = still ? 0 : 0.12 * Math.sin(time * plan.omega);
    th1 = lerp(th1, Math.PI / 2 + 0.25 + armSwing, plan.raise);
    th2 = lerp(th2, 0.35 + armSwing, plan.raise);
  }
  const knee = add(hip, polar(th1, l1));
  const foot = add(knee, polar(th2, l2 * (front ? 0.95 : 1)));
  return { hip, knee, foot, toeDir: front && plan.raise > 0.5 ? th2 : -0.1 + trail * 0.9 };
}

/** Gdzie wyrastają tylne nogi: u ptaka pod środkiem ciężkości, u pozostałych przy biodrach. */
function rearAtFor(plan: Plan): number { return 0.64 - 0.14 * plan.bird - 0.04 * plan.ptero; }

function drawLeg(ctx: Ctx, pose: LegPose, s: Style, color: string, thick: number, far: boolean, hand: boolean, avian = false) {
  const { hip, knee, foot } = pose;
  ctx.save();
  if (far) ctx.globalAlpha *= 0.55;
  const fillC = s.ghost ? s.fill('#000', 0.5) : mixHex(color, far ? '#3a3a3a' : '#ffffff', far ? 0.15 : 0.3);
  // segmenty zwężające się ku dołowi: tusz pod spodem, ton na wierzchu
  const seg = (a: V, b: V, w: number) => {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    inkLine(ctx, s, w + 2.4); ctx.stroke();
  };
  const segFill = (a: V, b: V, w: number) => {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = fillC; ctx.lineWidth = w; ctx.setLineDash([]); ctx.stroke();
  };
  seg(hip, knee, thick * 1.6); seg(knee, foot, thick * 0.85);
  segFill(hip, knee, thick * 1.6); segFill(knee, foot, thick * 0.85);
  // mięsień uda (zaokrąglenie przy biodrze) i podeszwa — łagodzą „patyczkowaty” wygląd
  const thigh = lerpV(hip, knee, 0.3);
  ctx.beginPath(); ctx.arc(thigh.x, thigh.y, thick * 1.0, 0, Math.PI * 2);
  ctx.fillStyle = fillC; ctx.fill();
  ctx.beginPath(); ctx.ellipse(foot.x + 1.5, foot.y + 0.8, thick * 0.9, thick * 0.5, pose.toeDir, 0, Math.PI * 2);
  ctx.fillStyle = fillC; ctx.fill();
  // staw
  ctx.beginPath(); ctx.arc(knee.x, knee.y, thick * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = fillC; ctx.fill();
  // palce / dłoń
  ctx.beginPath();
  if (hand) {
    for (let d = 0; d < 4; d++) {
      const ang = pose.toeDir - 0.35 + d * 0.22;
      const mid = add(foot, polar(ang, 3.5));
      const tip = add(mid, polar(ang + 1.3, 2.6));
      ctx.moveTo(foot.x, foot.y); ctx.lineTo(mid.x, mid.y); ctx.lineTo(tip.x, tip.y);
    }
    const th = add(foot, polar(pose.toeDir - 1.4, 3.8));
    ctx.moveTo(foot.x, foot.y); ctx.lineTo(th.x, th.y);
  } else if (avian) {
    // ptasia stopa: trzy palce do przodu, jeden (paluch) do tyłu
    for (let d = 0; d < 3; d++) {
      const tip = add(foot, polar(pose.toeDir - 0.25 + d * 0.28, 5.2));
      ctx.moveTo(foot.x, foot.y); ctx.lineTo(tip.x, tip.y);
    }
    const back = add(foot, polar(pose.toeDir + Math.PI - 0.25, 3.4));
    ctx.moveTo(foot.x, foot.y); ctx.lineTo(back.x, back.y);
  } else {
    for (let d = 0; d < 4; d++) {
      const tip = add(foot, polar(pose.toeDir - 0.3 + d * 0.3, 4.2));
      ctx.moveTo(foot.x, foot.y); ctx.lineTo(tip.x, tip.y);
    }
  }
  inkLine(ctx, s, 1.2); ctx.stroke();
  ctx.restore();
}

function drawWing(ctx: Ctx, body: Body, plan: Plan, s: Style, color: string, time: number, still: boolean,
  feathered: boolean, far: boolean, claw: boolean, attach: V | null = null) {
  const a = at(body, 0.3);
  const shoulder = add(a.p, mul(a.n, a.w * 0.35));
  const flying = plan.air;
  const beat = still ? 0.1 : Math.sin(time * plan.omega * 2);
  // Rzut skrzydła w widoku z boku: rozpiętość skraca się z kątem uniesienia.
  const beta = lerp(0.35, 0.3 + 0.95 * beat, flying);
  const span = lerp(30, 110, flying);
  const chord = lerp(38, 44, flying);
  const sweep = lerp(10, 30, flying);
  const lift = Math.sin(beta) * span;
  const off = far ? v(4, -3) : v(0, 0);
  const P = (u: number, w: number) => add(add(shoulder, off), v(-w * chord - u * sweep, -lift * u));
  const lead = [P(0, 0), P(0.45, -0.05), P(1, 0.1)];
  const trail = feathered
    ? [P(1, 0.35), P(0.85, 0.7), P(0.65, 0.95), P(0.45, 1.05), P(0.2, 1), P(0, 0.75)]
    : [P(0.9, 0.35), P(0.7, 0.55), P(0.5, 0.62), P(0.32, 0.7), P(0.15, 0.78), P(0, 0.85)];
  // pterozaur: błona lotna sięga od palca skrzydłowego aż do tylnej nogi
  if (!feathered && attach) {
    const a = add(attach, off);
    trail.splice(4, 2, lerpV(P(0.15, 0.85), a, 0.45), a);
  }
  ctx.save();
  if (far) ctx.globalAlpha *= 0.5;
  ctx.beginPath();
  ctx.moveTo(lead[0].x, lead[0].y);
  ctx.quadraticCurveTo(lead[1].x, lead[1].y, lead[2].x, lead[2].y);
  if (feathered) {
    trail.forEach((p, i) => {
      const prev = i === 0 ? lead[2] : trail[i - 1];
      const m = lerpV(prev, p, 0.5);
      ctx.quadraticCurveTo(m.x + 2, m.y + 2, p.x, p.y);
    });
  } else {
    // błona z wcięciami między palcami (jak u pterozaura)
    trail.forEach((p, i) => {
      const prev = i === 0 ? lead[2] : trail[i - 1];
      const m = lerpV(prev, p, 0.5);
      ctx.quadraticCurveTo(m.x - 1.5 * Math.sign(lift || 1), m.y - 3, p.x, p.y);
    });
  }
  ctx.closePath();
  ctx.fillStyle = s.fill(color, far ? 0.3 : 0.42); ctx.fill();
  inkLine(ctx, s, 1.2); ctx.stroke();
  ctx.beginPath();
  if (feathered) {
    for (let r = 0; r < 7; r++) {
      const base = P(0.15 + r * 0.13, 0.18);
      const tip = P(0.12 + r * 0.14, r < 3 ? 1.0 : 0.85 - (r - 3) * 0.14);
      ctx.moveTo(base.x, base.y); ctx.lineTo(tip.x, tip.y);
    }
  } else {
    const wrist = P(0.45, -0.02);
    ctx.moveTo(shoulder.x + off.x, shoulder.y + off.y); ctx.lineTo(wrist.x, wrist.y); ctx.lineTo(P(1, 0.1).x, P(1, 0.1).y);
    ctx.moveTo(wrist.x, wrist.y); ctx.lineTo(P(0.6, 0.55).x, P(0.6, 0.55).y);
  }
  inkLine(ctx, s, 0.55); ctx.strokeStyle = s.soft; ctx.stroke();
  if (claw && !far) {
    const w = P(0.45, -0.05);
    ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.quadraticCurveTo(w.x + 4, w.y - 2, w.x + 3, w.y + 2);
    ctx.moveTo(w.x, w.y); ctx.quadraticCurveTo(w.x + 3.5, w.y + 1, w.x + 1.5, w.y + 3.5);
    inkLine(ctx, s, 1); ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ zwierzę

export interface CreatureDrawOptions extends SceneOptions {
  /** Pominąć „scenkę” (jaja, młode, towarzysze) — np. dla towarzyszy. */
  bare?: boolean;
}

/** Jak nisko sięgają stopy względem środka ciała (stała poza) — stawia zwierzę na gruncie. */
export function footDrop(spec: CreatureSpec, pres: Presence): number {
  if (spec.bodyPlan === 'stawonog') return arthroFootDrop(spec, pres);
  if (spec.bodyPlan === 'glowonog') return cephFootDrop(spec, pres);
  const plan = planFor(spec, pres);
  const body = buildBody(spec, plan, 0, true);
  const rear = legPose(body, plan, rearAtFor(plan), false, 0, 0, true);
  const front = legPose(body, plan, 0.3, true, 0, 0, true);
  const lowestBody = Math.max(...body.lower.map((p) => p.y));
  const feet = plan.raise > 0.5 ? rear.foot.y : Math.max(rear.foot.y, front.foot.y);
  return lerp(lowestBody, Math.max(lowestBody, feet + 1.5), pres.limbs);
}

/** Okres pętli ruchu zwierzęcia [s] (patrz Plan.omega). */
export function cycleSeconds(spec: CreatureSpec, pres: Presence): number {
  if (spec.bodyPlan === 'stawonog') return (Math.PI * 2) / arthroShape(spec, pres).omega;
  if (spec.bodyPlan === 'glowonog') return (Math.PI * 2) / cephShape(spec, pres).omega;
  return (Math.PI * 2) / planFor(spec, pres).omega;
}

export function planFor(spec: CreatureSpec, pres: Presence): Plan {
  const onLand = spec.niche === 'lad' ? 1 : 0;
  const inAir = spec.niche === 'powietrze' ? pres.flight : 0;
  return {
    f: pres.fins, l: pres.limbs, fl: pres.flight, en: pres.endothermy,
    br: pres.brain, bb: pres.big_brain,
    land: onLand * pres.limbs, air: inAir,
    water: (1 - onLand) * (1 - inAir),
    omega: lerp(lerp(3 + 1.8 * pres.fast_muscle, 2.75, onLand * pres.limbs), 3.25, inAir),
    raise: pres.grasping_hand * pres.limbs * onLand * (1 - pres.flight) * (0.55 + 0.45 * pres.big_brain),
    bird: pres.flight * pres.insulation,
    ptero: pres.flight * (1 - pres.insulation),
    mam: pres.endothermy * pres.insulation * pres.limbs * (1 - pres.flight)
  };
}

export function drawCreature(ctx: Ctx, spec: CreatureSpec, theme: Theme, o: CreatureDrawOptions) {
  const prevK = lineK;
  lineK = o.lineWeight || 1;
  try { drawCreatureInner(ctx, spec, theme, o); } finally { lineK = prevK; }
}

/**
 * Wymiary rysunku (od środka ciała): left — za ogonem, right — przed pyskiem,
 * top — nad grzbietem, bottom — pod stopami. Kręgowiec liczony z geometrii
 * w stałej pozie, z zapasem na ruch (krok, uderzenie skrzydeł) i dodatki
 * (płetwy, dziób, nuty, fale dźwięku).
 */
export function planExtents(spec: CreatureSpec, pres: Presence, motion = true): { L: number; left: number; right: number; top: number; bottom: number } {
  if (spec.bodyPlan === 'stawonog') return arthroExtents(spec, pres);
  if (spec.bodyPlan === 'glowonog') return cephExtents(spec, pres);
  const plan = planFor(spec, pres);
  const body = buildBody(spec, plan, 0, true);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const put = (p: V, m: number) => { x0 = Math.min(x0, p.x - m); x1 = Math.max(x1, p.x + m); y0 = Math.min(y0, p.y - m); y1 = Math.max(y1, p.y + m); };
  body.upper.forEach((p) => put(p, 4)); body.lower.forEach((p) => put(p, 4));
  // falowanie ciała w ruchu (robak, ryba)
  const wave = motion ? 12 * (1 - plan.land) * (1 - plan.air) : 0;
  y0 -= wave; y1 += wave;
  // ogon: płetwa albo pióra
  const tail = body.P[body.n - 1];
  put(add(tail, v(-26, 0)), 18 * (pres.fins + pres.insulation * pres.flight > 0.01 ? 1 : 0.4));
  // pysk: dziób, echolokacja; nad głową: grzebień, ucho, nuty
  put(add(body.P[0], v(12 + 22 * plan.ptero + 22 * pres.echolocation, 0)), 10);
  const head = body.P[Math.round(0.1 * N_SEG)];
  put(add(head, v(0, -14 - 26 * pres.vocal_culture - 10 * plan.ptero)), 6);
  // płetwa grzbietowa
  if (pres.fins > 0.01) put(add(at(body, 0.43).p, v(0, -at(body, 0.43).w - 16)), 4);
  // nogi z zapasem na krok
  if (pres.limbs > 0.01) {
    [legPose(body, plan, 0.3, true, 0, 0, true), legPose(body, plan, rearAtFor(plan), false, 0, 0, true)].forEach((lp) => {
      put(lp.knee, 8); put(lp.foot, 10);
    });
    if (pres.tool_use > 0.01) put(add(legPose(body, plan, 0.3, true, 0, 0, true).foot, v(6, -6)), 12);
  }
  // skrzydło: w ruchu cały cykl uderzeń (w locie mocno w górę i w dół), nieruchome — stała poza
  if (pres.flight > 0.01) {
    const sh = at(body, 0.3).p;
    put(add(sh, v(-30, -(motion ? lerp(26, 108, plan.air) : lerp(14, 48, plan.air)))), 10);
    if (motion) put(add(sh, v(-30, lerp(0, 70, plan.air))), 10);
  }
  return { L: body.length, left: -x0, right: x1, top: -y0, bottom: y1 };
}

function drawCreatureInner(ctx: Ctx, spec: CreatureSpec, theme: Theme, o: CreatureDrawOptions) {
  if (spec.bodyPlan === 'stawonog') { drawArthropod(ctx, spec, theme, o); return; }
  if (spec.bodyPlan === 'glowonog') { drawCephalopod(ctx, spec, theme, o); return; }
  const pres = o.pres;
  const plan = planFor(spec, pres);
  const time = o.time;
  const body = buildBody(spec, plan, time, !!o.still);
  const st = styles(theme);
  const color = spec.bodyColor;
  const outline = bodyOutline(body);
  const hasLegs = pres.limbs + o.ghost.limbs > 0.01;

  // --- 1. strona dalsza: kończyny i skrzydło za ciałem
  const legThick = 4.2 * (1 + 0.25 * plan.en) * spec.proportions.girth * (1 - 0.45 * plan.bird);
  const frontAt = 0.3, rearAt = rearAtFor(plan);
  const avianFeet = plan.bird > 0.5;
  const farRear = legPose(body, plan, rearAt, false, 0, time, !!o.still);
  const nearRear = legPose(body, plan, rearAt, false, Math.PI, time, !!o.still);
  if (hasLegs) {
    feature(ctx, 'limbs', o, st, (s) => {
      if (pres.flight < 0.5) drawLeg(ctx, legPose(body, plan, frontAt, true, Math.PI, time, !!o.still), s, color, legThick, true, false);
      drawLeg(ctx, farRear, s, color, legThick * 1.1, true, false, avianFeet);
    });
  }
  feature(ctx, 'flight', o, st, (s) =>
    drawWing(ctx, body, plan, s, spec.accentColor, time, !!o.still, pres.insulation > 0.5, true, false, pres.limbs > 0.5 ? farRear.knee : null));

  // --- 2. płetwy za ciałem; u stałocieplnych i lotnych nie zostaje po nich ślad na ogonie
  const finK = (1 - 0.85 * pres.limbs) * (1 - pres.flight);
  const finRest = 0.35 * (1 - Math.max(pres.endothermy, pres.flight));
  feature(ctx, 'fins', o, st, (s, amt) => {
    if (finK > 0.05) {
      drawCaudalFin(ctx, body, s, amt * finK, color);
      drawDorsalFin(ctx, body, s, amt * finK, color);
    } else if (finRest > 0.02) drawCaudalFin(ctx, body, s, finRest * amt, color);
  });

  // --- 3. futro/pióra jako strzępki wzdłuż grzbietu
  feature(ctx, 'insulation', o, st, (s) => {
    const r = rng(spec.seed ^ 0x51);
    ctx.beginPath();
    for (let t = 0.06; t < 0.92; t += 0.018) {
      const a = at(body, t);
      const base = add(a.p, mul(a.n, a.w * 0.92));
      const len = 2.2 + r() * 1.8;
      const dir = add(mul(a.n, 0.55), mul(a.tan, 1));
      const tip = add(base, mul(dir, len));
      ctx.moveTo(base.x, base.y); ctx.lineTo(tip.x, tip.y);
      if (t > 0.3 && t < 0.7 && r() > 0.5) {
        const lb = sub(a.p, mul(a.n, a.w * 0.9));
        const lt = add(lb, mul(add(mul(a.n, -1), mul(a.tan, 0.9)), len * 0.8));
        ctx.moveTo(lb.x, lb.y); ctx.lineTo(lt.x, lt.y);
      }
    }
    inkLine(ctx, s, 0.8); ctx.strokeStyle = s.soft; ctx.stroke();
    // ogon z piór u latających
    if (pres.flight > 0.5) {
      const i = body.n - 1, p = body.P[i], t = body.T[i], n = body.N[i];
      for (let q = -2; q <= 2; q++) {
        const tip = add(add(p, mul(t, 22)), mul(n, q * 4.5));
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(lerpV(p, tip, 0.5).x, lerpV(p, tip, 0.5).y + q, tip.x, tip.y);
        inkLine(ctx, s, 3.2); ctx.stroke();
        ctx.strokeStyle = s.fill(color, 0.9); ctx.lineWidth = 1.6; ctx.setLineDash([]); ctx.stroke();
      }
    }
  });

  // --- 4. ciało: wypełnienie, wzory (w obrysie), kontur
  ctx.save();
  ctx.beginPath(); smoothPath(ctx, outline, true);
  const minY = Math.min(...outline.map((p) => p.y)), maxY = Math.max(...outline.map((p) => p.y));
  const grad = ctx.createLinearGradient(0, minY, 0, maxY);
  // przeciwcieniowanie: ciemny grzbiet, jasny brzuch — jak u większości ryb i ssaków
  grad.addColorStop(0, hexA(mixHex(color, '#2c261e', 0.34), Math.min(1, theme.washAlpha + 0.28)));
  grad.addColorStop(0.5, hexA(color, theme.washAlpha + 0.1));
  grad.addColorStop(1, hexA(mixHex(color, '#fbf8f0', 0.55), theme.washAlpha));
  ctx.fillStyle = grad; ctx.fill();
  ctx.clip();

  // kreskowanie cienia na brzuchu
  ctx.beginPath();
  for (let i = 3; i < body.n - 2; i++) {
    const p = body.P[i], n = body.N[i], w = body.W[i];
    const a1 = sub(p, mul(n, w * 0.35)), a2 = sub(p, mul(n, w * 1.05));
    ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x - 3, a2.y);
  }
  ctx.strokeStyle = hexA(theme.ink, 0.22); ctx.lineWidth = 0.6; ctx.setLineDash([]); ctx.stroke();

  // wzór dziedziczny linii (pasy, plamy, siodło) w barwie dodatkowej
  if (spec.pattern !== 'none' && !st.normal.ghost) {
    const pr = rng(spec.seed ^ 0x9a);
    const pc = hexA(spec.accentColor, Math.min(0.85, theme.washAlpha + 0.3));
    ctx.fillStyle = pc; ctx.strokeStyle = pc; ctx.setLineDash([]);
    if (spec.pattern === 'stripes') {
      ctx.lineWidth = 2.2; ctx.beginPath();
      for (let t = 0.14; t < 0.88; t += 0.07) {
        const a = at(body, t);
        const up = add(a.p, mul(a.n, a.w * 1.1)), dn = sub(a.p, mul(a.n, a.w * 0.2));
        ctx.moveTo(up.x, up.y); ctx.lineTo(dn.x - 2, dn.y);
      }
      ctx.stroke();
    } else if (spec.pattern === 'spots') {
      for (let b = 0; b < 16; b++) {
        const a = at(body, 0.12 + pr() * 0.76);
        const c = add(a.p, mul(a.n, (pr() * 0.9 - 0.1) * a.w));
        ctx.beginPath(); ctx.arc(c.x, c.y, 1.4 + pr() * 2.2, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const pts: V[] = [];
      for (let t = 0.14; t <= 0.8; t += 0.03) { const a = at(body, t); pts.push(add(a.p, mul(a.n, a.w * 1.05))); }
      for (let t = 0.8; t >= 0.14; t -= 0.03) { const a = at(body, t); pts.push(add(a.p, mul(a.n, a.w * (0.3 + 0.25 * Math.sin(t * 24))))); }
      ctx.beginPath(); smoothPath(ctx, pts, true); ctx.fill();
    }
  }

  feature(ctx, 'camouflage', o, st, (s) => {
    const r = rng(spec.seed ^ 0xca);
    for (let b = 0; b < 11; b++) {
      const a = at(body, 0.08 + r() * 0.82);
      const c = add(a.p, mul(a.n, (r() - 0.35) * a.w * 1.4));
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 3 + r() * 6, 2 + r() * 3.5, r() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = s.ghost ? s.fill('#000', 0.6) : hexA(mixHex(color, theme.ink, 0.55), 0.38);
      ctx.fill();
    }
  });
  feature(ctx, 'scales', o, st, (s) => {
    ctx.beginPath();
    for (let i = 3; i < body.n - 2; i += 1) {
      const p = body.P[i], n = body.N[i], tan = body.T[i], w = body.W[i];
      const ang = Math.atan2(tan.y, tan.x);
      for (let j = -3; j <= 3; j++) {
        const off = (j + (i % 2 ? 0.5 : 0)) * (w / 3.4);
        if (Math.abs(off) > w * 0.95) continue;
        const c = add(p, mul(n, off));
        ctx.moveTo(c.x + Math.cos(ang + Math.PI / 2) * 2.6, c.y + Math.sin(ang + Math.PI / 2) * 2.6);
        ctx.arc(c.x, c.y, 2.6, ang + Math.PI / 2, ang - Math.PI / 2, true);
      }
    }
    ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.ink, 0.32); ctx.lineWidth = 0.6;
    ctx.setLineDash(s.ghost ? [2, 2] : []); ctx.stroke();
  });
  feature(ctx, 'fast_muscle', o, st, (s) => {
    ctx.beginPath();
    for (let t = 0.16; t < 0.86; t += 0.045) {
      const a = at(body, t);
      const up = add(a.p, mul(a.n, a.w * 0.85)), dn = sub(a.p, mul(a.n, a.w * 0.85));
      const apex = sub(a.p, mul(a.tan, 5));
      ctx.moveTo(up.x, up.y); ctx.lineTo(apex.x, apex.y); ctx.lineTo(dn.x, dn.y);
    }
    ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.danger, 0.35); ctx.lineWidth = 0.8;
    ctx.setLineDash(s.ghost ? [2, 2] : []); ctx.stroke();
  });
  feature(ctx, 'lateral_line', o, st, (s) => {
    ctx.fillStyle = s.ghost ? s.stroke : theme.ink;
    for (let t = 0.12; t < 0.88; t += 0.028) {
      const a = at(body, t); const c = add(a.p, mul(a.n, a.w * 0.08));
      ctx.beginPath(); ctx.arc(c.x, c.y, 0.95, 0, Math.PI * 2); ctx.fill();
    }
  });
  // układ nerwowy „w przekroju”: rdzeń ze zwojami, mózg w głowie
  feature(ctx, 'ganglia', o, st, (s) => {
    const pts: V[] = [];
    for (let t = 0.08; t <= 0.86; t += 0.02) { const a = at(body, t); pts.push(add(a.p, mul(a.n, a.w * 0.5))); }
    ctx.beginPath(); smoothPath(ctx, pts, false);
    ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.ep, 0.85); ctx.lineWidth = 1.1;
    ctx.setLineDash([2.5, 2]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = s.ghost ? s.stroke : theme.ep;
    [0.22, 0.36, 0.5, 0.64, 0.78].forEach((t) => {
      const a = at(body, t); const c = add(a.p, mul(a.n, a.w * 0.5));
      ctx.beginPath(); ctx.arc(c.x, c.y, 1.7, 0, Math.PI * 2); ctx.fill();
    });
  });
  const brainAmt = Math.max(pres.brain, o.ghost.brain * (1 - pres.brain));
  if (brainAmt > 0.01) {
    feature(ctx, 'brain', o, st, (s) => {
      const a = at(body, 0.075);
      const c = add(a.p, mul(a.n, a.w * 0.2));
      const rx = a.w * (0.55 + 0.25 * pres.big_brain + 0.25 * (o.ghost.big_brain * (1 - pres.big_brain)));
      const ry = rx * 0.68;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = s.ghost ? s.fill('#000', 0.9) : hexA(theme.ep, 0.28); ctx.fill();
      ctx.strokeStyle = s.ghost ? s.stroke : theme.ep; ctx.lineWidth = 1;
      ctx.setLineDash(s.ghost ? [2, 2] : [2.5, 1.5]); ctx.stroke(); ctx.setLineDash([]);
      // bruzdy kory (wyraźniejsze przy rozbudowanym mózgu)
      const sulci = 2 + Math.round(3 * pres.big_brain);
      ctx.beginPath();
      for (let q = 0; q < sulci; q++) {
        const x0 = c.x - rx * 0.6 + (q / Math.max(1, sulci - 1)) * rx * 1.2;
        ctx.moveTo(x0, c.y - ry * 0.55); ctx.quadraticCurveTo(x0 + 3, c.y, x0 - 1, c.y + ry * 0.5);
      }
      ctx.lineWidth = 0.6; ctx.stroke();
    });
  }
  // światło nieba na grzbiecie: jasna kreska tuż pod górnym konturem odcina ciemny
  // grzbiet od tła (z góry, więc zgadza się też z odbitym w poziomie rysunkiem)
  ctx.save(); ctx.translate(0, 2.6 * lineK);
  ctx.beginPath(); smoothPath(ctx, outline, true);
  ctx.strokeStyle = hexA(mixHex(color, '#fff8e6', 0.75), 0.5); ctx.lineWidth = 1.8 * lineK; ctx.setLineDash([]); ctx.stroke();
  ctx.restore();
  ctx.restore();

  // kontur ciała
  ctx.beginPath(); smoothPath(ctx, outline, true);
  inkLine(ctx, st.normal, 1.5); ctx.stroke();

  // --- 5. pancerz: płytki grzbietowe (i tarcza głowowa u „ryb”)
  feature(ctx, 'shell', o, st, (s) => {
    const outer: V[] = [], inner: V[] = [];
    for (let t = 0.16; t <= 0.7; t += 0.02) {
      const a = at(body, t);
      const bump = Math.sin(Math.PI * (t - 0.16) / 0.54);
      inner.push(add(a.p, mul(a.n, a.w * 0.55)));
      outer.push(add(a.p, mul(a.n, a.w + 2 + 5 * bump)));
    }
    ctx.beginPath(); smoothPath(ctx, outer.concat(inner.slice().reverse()), true);
    ctx.fillStyle = s.fill(theme.horn, 0.6); ctx.fill();
    inkLine(ctx, s, 1.2); ctx.stroke();
    ctx.beginPath();
    for (let q = 1; q < 8; q++) {
      const idx = Math.round((q / 8) * (outer.length - 1));
      ctx.moveTo(inner[idx].x, inner[idx].y); ctx.lineTo(outer[idx].x, outer[idx].y);
    }
    inkLine(ctx, s, 0.8); ctx.stroke();
    if (pres.limbs < 0.5) {
      const hs: V[] = [];
      for (let t = 0.02; t <= 0.18; t += 0.02) { const a = at(body, t); hs.push(add(a.p, mul(a.n, a.w + 1.5))); }
      for (let t = 0.18; t >= 0.02; t -= 0.02) { const a = at(body, t); hs.push(add(a.p, mul(a.n, a.w * 0.15))); }
      ctx.beginPath(); smoothPath(ctx, hs, true);
      ctx.fillStyle = s.fill(theme.horn, 0.45); ctx.fill(); inkLine(ctx, s, 1); ctx.stroke();
    }
  });

  // --- 6. głowa: oko, pysk (dziób, grzebień, ucho), skrzela
  drawHead(ctx, body, spec, theme, o, st, plan);

  // echolokacja: wypukłe czoło („melon”) i fale dźwięku przed pyskiem
  feature(ctx, 'echolocation', o, st, (s) => {
    const h = at(body, 0.07);
    const c = add(h.p, mul(h.n, h.w * 0.62));
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, h.w * 0.5, h.w * 0.32, Math.atan2(h.tan.y, h.tan.x), 0, Math.PI * 2);
    ctx.fillStyle = s.fill(color, 0.55); ctx.fill(); inkLine(ctx, s, 0.9); ctx.stroke();
    const a = at(body, 0), fwd = mul(a.tan, -1), ang = Math.atan2(fwd.y, fwd.x);
    const tip = add(a.p, mul(fwd, 3));
    const shift = o.still ? 0 : (time * 14) % 6;
    for (let q = 0; q < 3; q++) {
      const r = 7 + q * 6 + shift;
      ctx.beginPath(); ctx.arc(tip.x, tip.y, r, ang - 0.55, ang + 0.55);
      ctx.strokeStyle = s.ghost ? s.stroke : hexA(theme.ep, 0.75 - q * 0.2); ctx.lineWidth = 1.1;
      ctx.setLineDash(s.ghost ? [2, 2] : []); ctx.stroke();
    }
    ctx.setLineDash([]);
  });
  // kultura akustyczna: nuty i fala nad głową — dźwięki przekazywane przez naukę
  feature(ctx, 'vocal_culture', o, st, (s) => {
    const h = at(body, 0.12);
    const base = add(h.p, mul(h.n, h.w + 12));
    const bob = o.still ? 0 : Math.sin(time * 3) * 2;
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

  // --- 7. strona bliższa: płetwa piersiowa, nogi, skrzydło, narzędzie
  feature(ctx, 'fins', o, st, (s, amt) => {
    if (finK > 0.05) {
      const ph = o.still ? 0 : time * plan.omega;
      drawPectoralFin(ctx, body, s, amt * finK, ph, color);
      drawPectoralFin(ctx, body, s, amt * finK * 0.6, ph + 2, color, 0.6, 12);
    }
  });
  if (hasLegs) {
    feature(ctx, 'limbs', o, st, (s) => {
      const hand = pres.grasping_hand > 0.5 && pres.flight < 0.5;
      if (pres.flight < 0.5) drawLeg(ctx, legPose(body, plan, frontAt, true, 0, time, !!o.still), s, color, legThick, false, hand);
      drawLeg(ctx, nearRear, s, color, legThick * 1.1, false, false, avianFeet);
    });
  }
  feature(ctx, 'grasping_hand', o, st, (s) => {
    if (pres.flight > 0.5 || pres.limbs < 0.5) return;
    // podkreślenie dłoni: przeciwstawny kciuk
    const pose = legPose(body, plan, frontAt, true, 0, time, !!o.still);
    ctx.beginPath(); ctx.arc(pose.foot.x, pose.foot.y, 3.2, 0, Math.PI * 2);
    inkLine(ctx, s, 1); ctx.stroke();
  });
  feature(ctx, 'tool_use', o, st, (s) => {
    if (pres.limbs < 0.5 || pres.flight > 0.5) return;
    const pose = legPose(body, plan, frontAt, true, 0, time, !!o.still);
    const c = add(pose.foot, v(5, -3));
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.quadraticCurveTo(5, -2, 3.5, 5); ctx.quadraticCurveTo(0, 8, -3.5, 5);
    ctx.quadraticCurveTo(-5, -2, 0, -8); ctx.closePath();
    ctx.fillStyle = s.fill('#8d8578', 0.8); ctx.fill(); inkLine(ctx, s, 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-1, -2); ctx.lineTo(1, 2); ctx.lineTo(0, 7);
    ctx.moveTo(-3, -1); ctx.lineTo(-1, -2); ctx.moveTo(3, 0); ctx.lineTo(1, 2);
    inkLine(ctx, s, 0.5); ctx.stroke();
    ctx.restore();
  });
  feature(ctx, 'flight', o, st, (s) =>
    drawWing(ctx, body, plan, s, spec.accentColor, time, !!o.still, pres.insulation > 0.5, false, pres.grasping_hand > 0.5,
      pres.limbs > 0.5 ? nearRear.knee : null));
}

function drawHead(ctx: Ctx, body: Body, spec: CreatureSpec, theme: Theme, o: SceneOptions, st: { normal: Style; ghost: Style }, plan: Plan) {
  const time = o.time;
  const pres = o.pres;
  const head = at(body, 0.05);
  const snout = body.P[0];
  const fwd = mul(head.tan, -1); // kierunek pyska

  // ucho ssaka (futro + stałocieplność na lądzie): zaokrąglony trójkąt za okiem
  if (plan.mam > 0.5) {
    const e = at(body, 0.1);
    const b1 = add(e.p, add(mul(e.n, e.w * 0.85), mul(e.tan, -2))), b2 = add(e.p, add(mul(e.n, e.w * 0.8), mul(e.tan, 5)));
    const apex = add(e.p, add(mul(e.n, e.w + 10), mul(e.tan, 4)));
    ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.quadraticCurveTo(lerpV(b1, apex, 0.5).x + fwd.x * 2, lerpV(b1, apex, 0.5).y, apex.x, apex.y);
    ctx.quadraticCurveTo(lerpV(apex, b2, 0.5).x, lerpV(apex, b2, 0.5).y, b2.x, b2.y); ctx.closePath();
    ctx.fillStyle = hexA(mixHex(spec.bodyColor, '#2c261e', 0.2), Math.min(1, theme.washAlpha + 0.25)); ctx.fill();
    inkLine(ctx, st.normal, 1); ctx.stroke();
    const ic = lerpV(lerpV(b1, b2, 0.5), apex, 0.45);
    ctx.beginPath(); ctx.ellipse(ic.x, ic.y, 1.4, 2.6, Math.atan2(e.n.y, e.n.x) + Math.PI / 2, 0, Math.PI * 2);
    ctx.fillStyle = hexA('#d9a08a', 0.7); ctx.fill();
  }
  // grzebień pterozaura: płat skóry za głową, w barwie dodatkowej
  if (plan.ptero > 0.5) {
    const e = at(body, 0.07);
    const base1 = add(e.p, mul(e.n, e.w * 0.7)), base2 = add(at(body, 0.13).p, mul(e.n, e.w * 0.6));
    const apex = add(add(e.p, mul(e.n, e.w + 13)), mul(e.tan, 15));
    ctx.beginPath(); ctx.moveTo(base1.x, base1.y); ctx.quadraticCurveTo(lerpV(base1, apex, 0.5).x, lerpV(base1, apex, 0.5).y - 3, apex.x, apex.y);
    ctx.lineTo(base2.x, base2.y); ctx.closePath();
    ctx.fillStyle = hexA(spec.accentColor, Math.min(1, theme.washAlpha + 0.2)); ctx.fill();
    inkLine(ctx, st.normal, 1); ctx.stroke();
  }

  // pysk; szczęki otwierają się co kilka sekund („kłapnięcie”)
  const mouthEnd = add(at(body, 0.075).p, mul(head.n, -head.w * 0.25));
  const tip = add(snout, mul(head.n, -head.w * 0.1));
  const jaws = pres.jaws;
  const cyc = (time % 3.6) / 3.6;
  const open = (o.still || o.cycle) ? 0.12 * jaws : jaws * (cyc > 0.82 ? Math.sin((cyc - 0.82) / 0.18 * Math.PI) * 0.35 : 0.04);
  if (open > 0.02) {
    const d = sub(tip, mouthEnd); const ang = Math.atan2(d.y, d.x);
    const low = add(mouthEnd, polar(ang + open, Math.hypot(d.x, d.y)));
    ctx.beginPath(); ctx.moveTo(mouthEnd.x, mouthEnd.y); ctx.lineTo(tip.x, tip.y); ctx.lineTo(low.x, low.y); ctx.closePath();
    ctx.fillStyle = hexA(theme.ink, 0.75); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(mouthEnd.x, mouthEnd.y); ctx.quadraticCurveTo(lerpV(mouthEnd, tip, 0.5).x, lerpV(mouthEnd, tip, 0.5).y + 1, tip.x, tip.y);
  inkLine(ctx, st.normal, 1.1); ctx.stroke();

  feature(ctx, 'jaws', o, st, (s) => {
    if (plan.bird > 0.5) return; // u ptaka szczęki to dziób (niżej)
    ctx.beginPath();
    const teeth = 5;
    for (let q = 0; q < teeth; q++) {
      const a = lerpV(tip, mouthEnd, 0.12 + q / teeth * 0.8);
      const flat = pres.omnivory > 0.5 && q >= 3;
      if (flat) { ctx.rect(a.x - 1.2, a.y, 2.4, 1.6); }
      else { ctx.moveTo(a.x - 1.3, a.y); ctx.lineTo(a.x, a.y + 2.6); ctx.lineTo(a.x + 1.3, a.y); }
    }
    ctx.fillStyle = s.ghost ? s.stroke : theme.paper; ctx.fill();
    inkLine(ctx, s, 0.6); ctx.stroke();
  });

  feature(ctx, 'filter_feeding', o, st, (s) => {
    // szczeliny skrzelowe
    ctx.beginPath();
    for (let q = 0; q < 5; q++) {
      const a = at(body, 0.1 + q * 0.018);
      const c = add(a.p, mul(a.n, -a.w * 0.05));
      ctx.moveTo(c.x + 1, c.y - a.w * 0.35); ctx.quadraticCurveTo(c.x - 1.5, c.y, c.x + 1, c.y + a.w * 0.35);
    }
    inkLine(ctx, s, 0.8); ctx.stroke();
    // cząstki planktonu płynące do pyska
    if (!o.still) {
      const r = rng(spec.seed ^ 0xf1);
      ctx.fillStyle = s.ghost ? s.stroke : hexA(theme.ink, 0.55);
      for (let q = 0; q < 7; q++) {
        const ph = (time * (o.cycle ? 1 / o.cycle : 0.35) + r()) % 1;
        const start = add(tip, v(22 + r() * 18, (r() - 0.5) * 22));
        const p = lerpV(start, tip, ph);
        ctx.beginPath(); ctx.arc(p.x, p.y, 0.9 + r() * 0.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  });

  // dziób: ptak — krótki, zakrzywiony (drapieżny przy szczękach); pterozaur — długi i spiczasty
  const avian = Math.max(plan.bird, plan.ptero);
  if (avian > 0.5) {
    const len = plan.ptero > 0.5 ? 20 + head.w : 9 + head.w * 0.7;
    const up = add(snout, mul(head.n, head.w * 0.32)), dn = add(snout, mul(head.n, -head.w * 0.3));
    const tipB = add(add(snout, mul(fwd, len)), mul(head.n, plan.ptero > 0.5 ? 0 : -2));
    const hook = add(tipB, add(mul(head.n, -3), mul(fwd, -2.5)));
    ctx.beginPath(); ctx.moveTo(up.x, up.y);
    ctx.quadraticCurveTo(lerpV(up, tipB, 0.55).x + head.n.x * 2, lerpV(up, tipB, 0.55).y + head.n.y * 2, tipB.x, tipB.y);
    if (plan.bird > 0.5 && pres.jaws > 0.5) ctx.lineTo(hook.x, hook.y);
    ctx.quadraticCurveTo(lerpV(tipB, dn, 0.5).x, lerpV(tipB, dn, 0.5).y, dn.x, dn.y); ctx.closePath();
    ctx.fillStyle = hexA(mixHex(theme.horn, '#e0b45a', 0.45), Math.min(1, theme.washAlpha + 0.3)); ctx.fill();
    inkLine(ctx, st.normal, 1.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(snout.x, snout.y); ctx.lineTo(lerpV(snout, tipB, 0.85).x, lerpV(snout, tipB, 0.85).y);
    inkLine(ctx, st.normal, 0.7); ctx.stroke();
  }

  // oko: plamka światłoczuła albo prawdziwe oko z mruganiem
  const eyeC = add(at(body, 0.048).p, mul(head.n, head.w * 0.32));
  const eyes = pres.eyes;
  const ghostEye = o.ghost.eyes * (1 - eyes);
  ctx.beginPath(); ctx.arc(eyeC.x, eyeC.y, 1.3, 0, Math.PI * 2); ctx.fillStyle = theme.ink; ctx.fill();
  if (eyes > 0.01 || ghostEye > 0.01) {
    feature(ctx, 'eyes', o, st, (s, amt) => {
      const r = (2.4 + 1.2 * pres.brain) * Math.max(0.3, amt) * spec.proportions.head;
      const blink = (o.still || o.cycle) ? 0 : ((time % 4.7) < 0.14 ? 1 : 0);
      ctx.save(); ctx.translate(eyeC.x, eyeC.y); ctx.scale(1, blink ? 0.15 : 1);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = s.ghost ? s.fill('#000', 1) : theme.paper; ctx.fill();
      inkLine(ctx, s, 0.9); ctx.stroke();
      if (!s.ghost) {
        ctx.beginPath(); ctx.arc(0.3, 0, r * 0.62, 0, Math.PI * 2); ctx.fillStyle = hexA('#c49a2f', 0.85); ctx.fill();
        ctx.beginPath(); ctx.arc(0.5, 0, r * 0.34, 0, Math.PI * 2); ctx.fillStyle = theme.ink; ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.3, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      }
      ctx.restore();
    });
  }

  // oddech stałocieplnych na mrozie
  if (pres.endothermy > 0.5 && o.climate === 'zimno' && !o.still && !o.cycle) {
    const cyc2 = (time % 2.4) / 2.4;
    if (cyc2 < 0.6) {
      const k = cyc2 / 0.6;
      const c = add(tip, v(6 + k * 14, -2 - k * 4));
      ctx.beginPath(); ctx.arc(c.x, c.y, 2 + k * 5, 0, Math.PI * 2);
      ctx.fillStyle = hexA(theme.paper, 0.5 * (1 - k)); ctx.fill();
      ctx.strokeStyle = hexA(theme.inkSoft, 0.4 * (1 - k)); ctx.lineWidth = 0.6; ctx.setLineDash([]); ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------ scena portretu

export interface SceneLayout { width: number; height: number }

/** Tło niszy: szkic środowiska w tych samych barwach (subtelny). */
function drawBackdrop(ctx: Ctx, spec: CreatureSpec, theme: Theme, lay: SceneLayout, time: number, still: boolean): number {
  const { width: w, height: h } = lay;
  const c = theme.niche[spec.niche];
  const r = rng(spec.seed ^ 0xb9);
  ctx.save();
  inkLine(ctx, { stroke: theme.inkSoft, soft: theme.inkSoft, ghost: false, fill: () => '' }, 0.8);
  let ground = h - 16;
  if (spec.niche === 'woda' || spec.niche === 'przybrzeze') {
    const surf = spec.niche === 'przybrzeze' ? h * 0.22 : 12;
    const g = ctx.createLinearGradient(0, surf, 0, h);
    g.addColorStop(0, hexA(c, theme.dark ? 0.16 : 0.12)); g.addColorStop(1, hexA(c, theme.dark ? 0.3 : 0.24));
    ctx.fillStyle = g; ctx.fillRect(0, surf, w, h - surf);
    // linia powierzchni (fala)
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const y = surf + Math.sin(x * 0.06 + (still ? 0 : time * 1.3)) * 1.6;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = hexA(c, 0.9); ctx.stroke();
    // dno
    ground = spec.niche === 'przybrzeze' ? h - 14 : h - 10;
    ctx.beginPath(); ctx.moveTo(0, ground + 3);
    for (let x = 0; x <= w; x += 12) ctx.lineTo(x, ground + Math.sin(x * 0.08) * 2 + (spec.niche === 'przybrzeze' ? -x * 0.04 : 0));
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = hexA(theme.horn, 0.25); ctx.fill(); ctx.strokeStyle = hexA(theme.inkSoft, 0.7); ctx.stroke();
    // kamyki i wodorosty
    for (let q = 0; q < 6; q++) {
      const x = r() * w; ctx.beginPath(); ctx.ellipse(x, ground + 3 + r() * 3, 2 + r() * 2.5, 1.3 + r(), 0, 0, Math.PI * 2);
      ctx.fillStyle = hexA(theme.inkSoft, 0.25); ctx.fill();
    }
    for (let q = 0; q < 2; q++) {
      const x = w * (q === 0 ? 0.08 : 0.9) + r() * 10;
      ctx.beginPath(); ctx.moveTo(x, ground + 2);
      for (let s = 1; s <= 6; s++) ctx.lineTo(x + Math.sin(s * 0.9 + (still ? 0 : time * 1.1) + q) * 3, ground + 2 - s * 6);
      ctx.strokeStyle = hexA(theme.niche.lad, 0.8); ctx.lineWidth = 1.2; ctx.stroke();
    }
    // pęcherzyki
    if (!still) {
      for (let q = 0; q < 4; q++) {
        const ph = (time * 0.12 + q * 0.27 + r()) % 1;
        const x = w * (0.15 + 0.7 * r()) + Math.sin(time * 2 + q) * 2;
        const y = lerp(ground - 4, surf + 4, ph);
        ctx.beginPath(); ctx.arc(x, y, 1.2 + q * 0.3, 0, Math.PI * 2);
        ctx.strokeStyle = hexA(c, 0.8); ctx.lineWidth = 0.7; ctx.stroke();
      }
    }
  } else if (spec.niche === 'lad') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hexA(theme.niche.powietrze, 0.08)); g.addColorStop(1, hexA(c, 0.12));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ground = h - 18;
    ctx.beginPath(); ctx.moveTo(0, ground);
    for (let x = 0; x <= w; x += 10) ctx.lineTo(x, ground + Math.sin(x * 0.05) * 1.5);
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = hexA(c, 0.28); ctx.fill(); ctx.strokeStyle = hexA(theme.inkSoft, 0.8); ctx.stroke();
    // kępki roślin (paprotniki)
    for (let q = 0; q < 5; q++) {
      const x = r() * w, hh = 6 + r() * 8;
      ctx.beginPath();
      for (let s = -2; s <= 2; s++) { ctx.moveTo(x, ground + 1); ctx.quadraticCurveTo(x + s * 2, ground - hh * 0.6, x + s * 3.5, ground - hh + Math.abs(s) * 2); }
      ctx.strokeStyle = hexA(theme.niche.lad, 0.9); ctx.lineWidth = 0.9; ctx.stroke();
    }
    // odległe wzgórza
    ctx.beginPath(); ctx.moveTo(0, ground - 14);
    ctx.quadraticCurveTo(w * 0.25, ground - 34, w * 0.5, ground - 16); ctx.quadraticCurveTo(w * 0.75, ground - 28, w, ground - 12);
    ctx.strokeStyle = hexA(theme.inkSoft, 0.35); ctx.lineWidth = 0.8; ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hexA(c, 0.22)); g.addColorStop(1, hexA(c, 0.05));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ground = h + 40;
    for (let q = 0; q < 3; q++) {
      const cx = ((q * 0.37 + r() * 0.2 + (still ? 0 : time * 0.01 * (q + 1))) % 1.2) * w - 20, cy = 16 + q * 24 + r() * 8;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, Math.PI * 0.9, Math.PI * 1.9); ctx.arc(cx + 10, cy - 3, 9, Math.PI, Math.PI * 2);
      ctx.arc(cx + 21, cy, 6, Math.PI * 1.1, Math.PI * 2.1); ctx.closePath();
      ctx.fillStyle = hexA(theme.paper, 0.5); ctx.fill(); ctx.strokeStyle = hexA(theme.inkSoft, 0.4); ctx.lineWidth = 0.7; ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, h - 8); ctx.quadraticCurveTo(w * 0.3, h - 20, w * 0.6, h - 9); ctx.quadraticCurveTo(w * 0.8, h - 15, w, h - 6);
    ctx.strokeStyle = hexA(theme.inkSoft, 0.35); ctx.stroke();
  }
  ctx.restore();
  return ground;
}

function drawEggs(ctx: Ctx, spec: CreatureSpec, theme: Theme, o: SceneOptions, st: { normal: Style; ghost: Style }, x: number, ground: number) {
  const r = rng(spec.seed ^ 0xe6);
  feature(ctx, 'many_eggs', o, st, (s) => {
    for (let q = 0; q < 8; q++) {
      const ex = x + (r() - 0.5) * 22, ey = ground - 3 - r() * 9;
      ctx.beginPath(); ctx.arc(ex, ey, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = s.fill(theme.niche.przybrzeze, 0.35); ctx.fill(); inkLine(ctx, s, 0.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex + 0.6, ey + 0.4, 0.9, 0, Math.PI * 2); ctx.fillStyle = s.ghost ? s.stroke : theme.ink; ctx.fill();
    }
  });
  feature(ctx, 'amniotic_egg', o, st, (s) => {
    [0, 1].forEach((q) => {
      const ex = x + 26 + q * 11, ey = ground - 6.5 + q;
      ctx.beginPath(); ctx.ellipse(ex, ey, 4.6, 6.2, q ? 0.3 : -0.2, 0, Math.PI * 2);
      ctx.fillStyle = s.ghost ? s.fill('#000', 0.6) : theme.paper; ctx.fill(); inkLine(ctx, s, 1); ctx.stroke();
      if (!s.ghost) {
        ctx.fillStyle = hexA(theme.inkSoft, 0.6);
        for (let d = 0; d < 5; d++) { ctx.beginPath(); ctx.arc(ex + (r() - 0.5) * 5, ey + (r() - 0.5) * 7, 0.55, 0, Math.PI * 2); ctx.fill(); }
      }
    });
  });
}

export interface PortraitScene { layout: SceneLayout; spec: CreatureSpec; theme: Theme; o: SceneOptions }

/** Cała scena portretu: tło niszy, towarzysze, jaja, młode, zwierzę, podziałka. */
export function drawPortrait(ctx: Ctx, sc: PortraitScene) {
  const { layout, spec, theme, o } = sc;
  const { width: w, height: h } = layout;
  const st = styles(theme);
  ctx.clearRect(0, 0, w, h);
  const ground = drawBackdrop(ctx, spec, theme, layout, o.time, !!o.still);

  const pres = o.pres;
  const L = 200 * spec.proportions.length;
  const ext = planExtents(spec, pres);
  const extentX = ext.left + ext.right;
  const extentY = (ext.top + ext.bottom) * 0.75;
  const standing = spec.niche === 'lad' && pres.limbs > 0.5;
  const fd = standing ? footDrop(spec, pres) : 0;
  // wysokie sylwetki (postawa wyprostowana, ptak) muszą się zmieścić od gruntu do górnej krawędzi
  const fitH = standing ? (ground - 6) / (ext.top + fd) : (h * 0.94) / (ext.top + ext.bottom);
  const s = Math.min((w * 0.74) / extentX, (h * 0.78) / extentY, fitH);
  const cx = w * 0.53;
  let cy: number;
  const bob = o.still ? 0 : Math.sin(o.time * 1.6) * 1.5;
  if (standing) {
    cy = ground - fd * s;
  } else if (spec.niche === 'powietrze' && pres.flight > 0.5) {
    cy = h * 0.6 + (o.still ? 0 : Math.sin(o.time * 6.5) * 2.5);
  } else {
    cy = Math.min(h * 0.5, ground - 26 * s) + bob;
  }

  // towarzysze (stado/grupa społeczna) — w tle, przygaszeni
  const mates = Math.round(2 * Math.max(pres.pack_hunting, pres.social) + (pres.social > 0.5 ? 1 : 0));
  const ghostMates = Math.max(o.ghost.pack_hunting, o.ghost.social) * (1 - Math.max(pres.pack_hunting, pres.social));
  const mateCount = Math.max(mates, ghostMates > 0.01 ? 2 : 0);
  for (let m = 0; m < mateCount; m++) {
    const isGhost = m >= mates;
    ctx.save();
    ctx.globalAlpha *= isGhost ? 0.35 * ghostMates : 0.3;
    const ms = s * 0.58;
    const onGround = spec.niche === 'lad' && pres.limbs > 0.5;
    // na lądzie towarzysze stoją na gruncie (dalej = wyżej), w wodzie płyną wyżej
    const my = onGround ? ground - 6 - [4, 2, 9][m] - footDrop(spec, pres) * ms : cy - [16, 16, 30][m] * s;
    ctx.translate(w * [0.16, 0.86, 0.36][m], my);
    ctx.scale(ms, ms);
    drawCreature(ctx, spec, theme, { ...o, time: o.time + 0.9 * (m + 1), ghost: emptyPresence(), bare: true });
    ctx.restore();
  }

  // jaja na dnie/gruncie, za ogonem
  const eggGround = Math.min(ground, h - 8);
  drawEggs(ctx, spec, theme, o, st, w * 0.09, eggGround);

  // młode (opieka nad potomstwem) — płynie/idzie za rodzicem
  feature(ctx, 'parental_care', o, st, (sty) => {
    ctx.save();
    const js = s * 0.42;
    const jy = spec.niche === 'lad' && pres.limbs > 0.5 ? ground - footDrop(spec, pres) * js : cy + 22 * s;
    ctx.translate(w * 0.27, jy);
    ctx.scale(js, js);
    if (sty.ghost) {
      ctx.beginPath(); ctx.ellipse(0, 0, 60, 16, 0, 0, Math.PI * 2);
      ctx.strokeStyle = sty.stroke; ctx.setLineDash([6, 5]); ctx.lineWidth = 3; ctx.stroke();
    } else {
      drawCreature(ctx, spec, theme, { ...o, time: o.time + 0.35, ghost: emptyPresence(), bare: true });
    }
    ctx.restore();
  });

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  drawCreature(ctx, spec, theme, o);
  ctx.restore();

  drawScaleBar(ctx, spec, theme, layout, s * L);
}

/** Podziałka w rogu — jak na tablicach („1 cm”); długość wg rozmiaru ciała. */
function drawScaleBar(ctx: Ctx, spec: CreatureSpec, theme: Theme, lay: SceneLayout, bodyPx: number) {
  const nice = [1, 2, 5, 10, 20, 50, 100, 200];
  const unit = nice.filter((n) => n <= spec.sizeCm * 0.4).pop() || 1;
  const px = bodyPx * (unit / spec.sizeCm);
  const x1 = lay.width - 10, x0 = x1 - px, y = lay.height - 7;
  ctx.save();
  ctx.fillStyle = theme.paper;
  ctx.globalAlpha = 0.8; ctx.fillRect(x0 - 3, y - 12, px + 6, 16); ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.ink; ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x0, y - 3); ctx.lineTo(x0, y); ctx.lineTo(x1, y); ctx.lineTo(x1, y - 3);
  ctx.moveTo((x0 + x1) / 2, y); ctx.lineTo((x0 + x1) / 2, y - 2); ctx.stroke();
  ctx.fillStyle = theme.ink;
  ctx.font = 'italic 10px "Source Serif 4 Variable", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(scaleLabel(unit), (x0 + x1) / 2, y - 4.5);
  ctx.restore();
}
