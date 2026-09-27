/*
 * thumb.ts — miniatury zwierząt (obrazki PNG) do drzewa życia, ekranów
 * startowego i końcowego. Ten sam rysunek co rycina, w nieruchomej pozie.
 * Wyniki są zapamiętywane — ta sama linia z tymi samymi cechami rysuje się raz.
 */
import { buildSpec, type LineageLike } from './spec.ts';
import { drawCreature, emptyPresence, planFor, type Theme } from './draw.ts';
import { readTheme } from './portrait.ts';

const cache = new Map<string, string>();

export interface ThumbOptions {
  /** Szerokość i wysokość obrazka w pikselach CSS. */
  width: number; height: number;
}

export function creatureThumb(lineage: LineageLike, opts: ThumbOptions): string {
  const theme: Theme = readTheme();
  const key = [lineage.id, lineage.name, lineage.traits.join(','), lineage.niche, opts.width, opts.height, theme.dark].join('|');
  const hit = cache.get(key);
  if (hit) return hit;

  const spec = buildSpec(lineage);
  const pres = emptyPresence();
  spec.owned.forEach((f) => { pres[f] = 1; });
  const plan = planFor(spec, pres);
  const L = 200 * spec.proportions.length;
  const left = L / 2 + 40, right = L / 2 + 16;
  const top = 50 + 70 * plan.air + 16 * pres.flight + 80 * plan.raise;
  const bottom = 40 + 30 * pres.limbs + 30 * plan.air;
  const s = Math.min(opts.width / (left + right), opts.height / (top + bottom));
  const res = Math.min(2, window.devicePixelRatio || 1) * 1.5;
  const c = document.createElement('canvas');
  c.width = Math.round(opts.width * res); c.height = Math.round(opts.height * res);
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  // wyśrodkowanie rysunku w ramce
  const ox = (opts.width - (left + right) * s) / 2 + left * s;
  const oy = (opts.height - (top + bottom) * s) / 2 + top * s;
  ctx.setTransform(s * res, 0, 0, s * res, ox * res, oy * res);
  drawCreature(ctx, spec, { ...theme, washAlpha: Math.min(0.9, theme.washAlpha + 0.2) }, {
    time: 0, still: true, pres, ghost: emptyPresence(), bare: true,
    lineWeight: Math.max(1, Math.min(2.2, 0.7 / s))
  });
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
