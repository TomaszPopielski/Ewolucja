/*
 * bake.ts — „wypiekanie” animacji zwierzęcia do klatek (tekstur Pixi).
 *
 * Ten sam rysunek co rycina w panelu (creature/draw.ts), narysowany kilkanaście
 * razy w jednym cyklu ruchu. W dioramie każdy osobnik tylko przełącza klatki,
 * więc nawet liczne stado kosztuje tyle co kilka obrazków.
 */
import { Texture, CanvasSource } from 'pixi.js';
import { type CreatureSpec } from '../creature/spec.ts';
import { drawCreature, emptyPresence, cycleSeconds, footDrop, planFor, planExtents, type Presence, type Theme } from '../creature/draw.ts';

export interface Baked {
  frames: Texture[];
  /** Punkt zaczepienia (środek ciała) jako ułamek rozmiaru klatki. */
  anchorX: number; anchorY: number;
  /** Okres cyklu ruchu [s]. */
  cycle: number;
  /** Ile pikseli klatki przypada na jednostkę rysunku (przy skali 1 sprite'a). */
  unitPx: number;
  /** Odległość środka ciała od stóp [jednostki rysunku] — do stawiania na gruncie. */
  foot: number;
  /** Długość ciała [jednostki rysunku]. */
  length: number;
}

export function presenceOf(spec: CreatureSpec): Presence {
  const p = emptyPresence();
  spec.owned.forEach((f) => { p[f] = 1; });
  return p;
}

/**
 * @param unitPx  rozmiar jednostki rysunku w pikselach (np. 0,32 → ciało ≈ 64 px)
 * @param res     gęstość pikseli (devicePixelRatio)
 */
export function bakeCreature(spec: CreatureSpec, theme: Theme, unitPx: number, res: number, nFrames = 12): Baked {
  const pres = presenceOf(spec);
  const plan = planFor(spec, pres);
  const ext = planExtents(spec, pres);
  const L = ext ? ext.L : 200 * spec.proportions.length;
  const left = ext ? ext.left : L / 2 + 58, right = ext ? ext.right : L / 2 + 22;
  const top = ext ? ext.top : 62 + 105 * plan.air + 20 * pres.flight + 85 * plan.raise + 6 * pres.shell + (spec.form === 'saur' ? 26 * pres.limbs : 0);
  const bottom = ext ? ext.bottom : 48 + 32 * pres.limbs + 70 * plan.air;
  const W = (left + right) * unitPx, H = (top + bottom) * unitPx;
  const cycle = cycleSeconds(spec, pres);
  // Na małych osobnikach tusz musi być grubszy, a ton pełniejszy (na kolorowym tle).
  const th: Theme = { ...theme, washAlpha: Math.min(0.92, theme.washAlpha + 0.28) };
  const lineWeight = Math.max(1, Math.min(2.4, 0.75 / unitPx));
  const frames: Texture[] = [];
  for (let i = 0; i < nFrames; i++) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(W * res); c.height = Math.ceil(H * res);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(unitPx * res, 0, 0, unitPx * res, left * unitPx * res, top * unitPx * res);
    drawCreature(ctx, spec, th, {
      time: (i / nFrames) * cycle, cycle, pres, ghost: emptyPresence(), bare: true, lineWeight
    });
    frames.push(new Texture({ source: new CanvasSource({ resource: c, resolution: res }) }));
  }
  return {
    frames, anchorX: left / (left + right), anchorY: top / (top + bottom), cycle, unitPx,
    foot: footDrop(spec, pres), length: L
  };
}

export function destroyBaked(b: Baked) {
  b.frames.forEach((t) => t.destroy(true));
}
