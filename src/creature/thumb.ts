/*
 * thumb.ts — miniatury zwierząt (obrazki PNG) do drzewa życia, ekranów
 * startowego i końcowego. Ten sam rysunek co rycina, w nieruchomej pozie.
 * Wyniki są zapamiętywane — ta sama linia z tymi samymi cechami rysuje się raz.
 */
import { buildSpec, isFeature, type LineageLike } from './spec.ts';
import { drawCreature, emptyPresence, planExtents, type Theme } from './draw.ts';
import { readTheme } from './portrait.ts';

const cache = new Map<string, string>();

export interface ThumbOptions {
  /** Szerokość i wysokość obrazka w pikselach CSS. */
  width: number; height: number;
  /** Cecha pokazana jako fioletowy szkic „co-jeśli” (karta cechy jak okaz w atlasie). */
  ghost?: string;
  /**
   * 'ghost' — zbliżenie na szkicowaną cechę (drobne części: szczęki, oko, skrzela), jak
   * wstawka „szczegół” na tablicy. Kadr wyznacza porównanie rysunku z cechą i bez niej.
   */
  focus?: 'ghost';
}

type Box = { left: number; right: number; top: number; bottom: number };

/**
 * Gdzie na rysunku jest szkicowana cecha (w jednostkach rysunku): rysunek próbny z cechą
 * i bez niej, różniące się piksele wyznaczają prostokąt. null — cechy nie widać.
 */
function ghostBox(draw: (ctx: CanvasRenderingContext2D, withGhost: boolean) => void, ext: Box): Box | null {
  const k = 1.4, W = Math.ceil((ext.left + ext.right) * k), H = Math.ceil((ext.top + ext.bottom) * k);
  const shot = (g: boolean) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d')!; x.setTransform(k, 0, 0, k, ext.left * k, ext.top * k); draw(x, g);
    return x.getImageData(0, 0, W, H).data;
  };
  const a = shot(true), b = shot(false);
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]) > 60) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { left: -(x0 / k - ext.left), right: x1 / k - ext.left, top: -(y0 / k - ext.top), bottom: y1 / k - ext.top };
}

export function creatureThumb(lineage: LineageLike, opts: ThumbOptions): string {
  const theme: Theme = readTheme();
  const key = [lineage.id, lineage.name, lineage.bodyPlan || '', lineage.traits.join(','), lineage.niche, opts.width, opts.height, theme.dark, theme.ep, opts.ghost || '', opts.focus || ''].join('|');
  const hit = cache.get(key);
  if (hit) return hit;

  const spec = buildSpec(lineage);
  const pres = emptyPresence();
  spec.owned.forEach((f) => { pres[f] = 1; });
  const ghost = emptyPresence();
  if (opts.ghost && isFeature(opts.ghost) && !spec.owned.has(opts.ghost)) ghost[opts.ghost] = 1;
  // ramka obejmuje też szkicowaną część (np. skrzydło, nogi)
  const both = { ...pres }; (Object.keys(ghost) as (keyof typeof ghost)[]).forEach((k) => { both[k] = Math.max(pres[k], ghost[k]); });
  let { left, right, top, bottom } = planExtents(spec, both, false);
  const th = { ...theme, washAlpha: Math.min(0.9, theme.washAlpha + 0.2) };
  const paint = (ctx: CanvasRenderingContext2D, g: boolean, lw: number) => drawCreature(ctx, spec, th, {
    time: 0, still: true, pres, ghost: g ? ghost : emptyPresence(), bare: true, lineWeight: lw
  });
  let zoomed = false;
  if (opts.focus === 'ghost' && opts.ghost) {
    const gb = ghostBox((c, g) => paint(c, g, 1.4), { left, right, top, bottom });
    if (gb) {
      // kadr: szkicowana część z zapasem (widać, gdzie leży na ciele), w proporcjach miniatury,
      // nie mniejszy niż ok. 40% szerokości całego zwierzęcia
      const full = left + right, aspect = opts.width / opts.height;
      let cx = (gb.right - gb.left) / 2, cy = (gb.bottom - gb.top) / 2;
      let w = Math.max((gb.left + gb.right) * 1.9, full / 2.5), h = Math.max((gb.top + gb.bottom) * 1.9, 24);
      if (w / h < aspect) w = h * aspect; else h = w / aspect;
      if (w < full) { left = w / 2 - cx; right = w / 2 + cx; top = h / 2 - cy; bottom = h / 2 + cy; zoomed = true; }
    }
  }
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
  // w zbliżeniu kreska może być cieńsza (inaczej rośnie razem ze skalą)
  paint(ctx, true, Math.max(zoomed ? 0.5 : 1, Math.min(2.2, 0.7 / s)));
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
