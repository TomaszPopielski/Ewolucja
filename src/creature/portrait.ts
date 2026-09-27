/*
 * portrait.ts — żywy portret aktywnej linii w panelu gry.
 *
 * Łączy opis zwierzęcia (spec.ts) z rysowaniem (draw.ts): animuje ruch,
 * płynnie „wyrasta” nowo kupione cechy, pokazuje szkic cechy przy podglądzie
 * „co-jeśli”. Szanuje prefers-reduced-motion (wtedy stały rysunek) i nie
 * zużywa procesora, gdy portret jest niewidoczny.
 */
import { buildSpec, isFeature, FEATURES, type CreatureSpec, type LineageLike, type Feature } from './spec.ts';
import { drawPortrait, emptyPresence, type Presence, type Theme } from './draw.ts';

export interface PortraitUpdate {
  climate?: string;
  /** Nazwy cech (do opisu dla czytników ekranu). */
  traitNames?: Record<string, string>;
}

const HEIGHT = 156;
const GROW_SECONDS = 0.8;

function cssVar(style: CSSStyleDeclaration, name: string, fallback: string): string {
  const val = style.getPropertyValue(name).trim();
  return val || fallback;
}

export function readTheme(): Theme {
  const st = getComputedStyle(document.documentElement);
  const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    ink: cssVar(st, '--ink', '#2c261e'),
    inkSoft: cssVar(st, '--ink-soft', '#6b6155'),
    paper: cssVar(st, '--bg-panel', '#fbf8f0'),
    line: cssVar(st, '--line', '#d6c9b1'),
    ep: cssVar(st, '--ep', '#6a4c93'),
    accent: cssVar(st, '--accent', '#a86a22'),
    danger: cssVar(st, '--danger', '#a13a28'),
    horn: cssVar(st, '--wash-obrona', '#a8834f'),
    niche: {
      woda: cssVar(st, '--niche-woda', '#3d7c98'),
      przybrzeze: cssVar(st, '--niche-przybrzeze', '#3f9585'),
      lad: cssVar(st, '--niche-lad', '#7a8c45'),
      powietrze: cssVar(st, '--niche-powietrze', '#7b9fc2')
    },
    washAlpha: dark ? 0.6 : 0.55,
    dark
  };
}

export class Portrait {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private spec: CreatureSpec | null = null;
  private lineageId: string | null = null;
  private pres: Presence = emptyPresence();
  private target: Presence = emptyPresence();
  private ghost: Presence = emptyPresence();
  private ghostTarget: Presence = emptyPresence();
  private climate: string | undefined;
  private theme: Theme;
  private visible = true;
  private raf = 0;
  private last = 0;
  private time = 0;
  private reduced: boolean;
  private width = 280;

  constructor(private host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'creature-canvas';
    this.canvas.setAttribute('role', 'img');
    host.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D niedostępny');
    this.ctx = ctx;
    this.theme = readTheme();
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = mqMotion.matches;
    mqMotion.addEventListener?.('change', (e) => { this.reduced = e.matches; this.kick(); });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      this.theme = readTheme(); this.kick();
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => this.resize()).observe(host);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        this.visible = entries.some((e) => e.isIntersecting);
        this.kick();
      }).observe(host);
    }
    document.addEventListener('visibilitychange', () => this.kick());
    this.resize();
  }

  /** Nowy stan linii. Zmiana linii = od razu; nowa cecha tej samej linii = płynnie. */
  update(lineage: LineageLike, opts: PortraitUpdate = {}) {
    const sameLineage = lineage.id === this.lineageId;
    this.spec = buildSpec(lineage);
    this.lineageId = lineage.id;
    this.climate = opts.climate;
    FEATURES.forEach((f) => { this.target[f] = this.spec!.owned.has(f) ? 1 : 0; });
    if (!sameLineage || this.reduced) FEATURES.forEach((f) => { this.pres[f] = this.target[f]; });
    this.describe(lineage, opts.traitNames);
    this.kick();
  }

  /** Podgląd cechy przed zakupem (null = bez podglądu). */
  preview(traitId: string | null) {
    FEATURES.forEach((f) => { this.ghostTarget[f] = 0; });
    if (traitId && isFeature(traitId)) this.ghostTarget[traitId] = 1;
    if (this.reduced) FEATURES.forEach((f) => { this.ghost[f] = this.ghostTarget[f]; });
    this.kick();
  }

  private describe(lineage: LineageLike, names?: Record<string, string>) {
    const owned = lineage.traits.filter((t) => isFeature(t)).map((t) => (names && names[t]) || t);
    this.canvas.setAttribute('aria-label', 'Rycina: ' + lineage.name +
      (owned.length ? '. Widoczne cechy: ' + owned.join(', ') + '.' : '. Prosty organizm bez wykształconych cech.'));
  }

  private resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(160, this.host.clientWidth || 280);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(HEIGHT * dpr);
    this.canvas.style.width = '100%';
    this.canvas.style.height = HEIGHT + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  /** Uruchamia pętlę, gdy jest co animować; w przeciwnym razie rysuje raz. */
  private kick() {
    if (this.raf) return;
    if (this.reduced || !this.visible || document.hidden) { this.draw(); return; }
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private frame(now: number) {
    this.raf = 0;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    const step = dt / GROW_SECONDS;
    const approach = (cur: Presence, tgt: Presence) => {
      FEATURES.forEach((f: Feature) => {
        const d = tgt[f] - cur[f];
        cur[f] = Math.abs(d) <= step ? tgt[f] : cur[f] + Math.sign(d) * step;
      });
    };
    approach(this.pres, this.target);
    approach(this.ghost, this.ghostTarget);
    this.draw();
    if (this.visible && !document.hidden && !this.reduced) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private draw() {
    if (!this.spec) return;
    drawPortrait(this.ctx, {
      layout: { width: this.width, height: HEIGHT },
      spec: this.spec,
      theme: this.theme,
      o: { time: this.time, pres: this.pres, ghost: this.ghost, climate: this.climate, still: this.reduced }
    });
  }
}
