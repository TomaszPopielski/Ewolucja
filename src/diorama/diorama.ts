/*
 * diorama.ts — żywa scena środowiska nad panelami gry (PixiJS).
 *
 * Pokazuje świat aktywnej linii: niszę i erę (warstwy z efektem głębi),
 * populację jako ławicę/stado (liczebność ∝ populacji), pokarm (∝ zasobom
 * tury), drapieżniki (∝ presji) i klimat tury (śnieg, ciepłe światło).
 * Zmiana linii, niszy lub tury = płynne przejście sceny.
 *
 * Diorama tylko CZYTA dane gry; nigdy ich nie zmienia. Bez WebGL działa
 * renderer Canvas (bez filtrów), a gdy i on zawiedzie — gra działa bez dioramy.
 */
import 'pixi.js/filters'; // system filtrów (falowanie wody) — bez pełnego pakietu rozszerzeń
import { Application, Container, Sprite, Texture, CanvasSource, Graphics, DisplacementFilter } from 'pixi.js';
import { buildSpec, rng, hashString, type CreatureSpec } from '../creature/spec.ts';
import type { Theme } from '../creature/draw.ts';
import { bakeCreature, destroyBaked, type Baked } from './bake.ts';
import type { QualityParams } from '../art/settings.ts';
import {
  sceneLayout, paintBackground, paintFar, paintMid, paintNear, paintDot, paintBubble, paintSnow, paintRay, paintVignette, paintNoise,
  type Era, type NicheKey, type SceneLayout, type PaintArgs
} from './scenery.ts';

export interface DioramaLineage {
  id: string; name: string; traits: string[]; niche: string; population: number; active: boolean;
  /** Linia macierzysta — przy specjacji część stada rodzica „przechodzi” do nowej gałęzi. */
  parentId?: string | null;
  /** Plan budowy do rysunku (kregowiec | stawonog | glowonog). */
  bodyPlan?: string;
}

export interface DioramaData {
  era: Era;
  niche: NicheKey;
  climate?: string;
  /** Zasoby pokarmu w niszy (skala jak w silniku, ok. 0–15). */
  food: number;
  /** Presja drapieżników w niszy (ok. 0–15). */
  predators: number;
  /** Katastrofa zapowiedziana na tę turę i czy dotyczy tej niszy. */
  catastrophe?: boolean;
  /** Ślad po niedawnej katastrofie w tej niszy: 1 = świeży (szary, wyjałowiony krajobraz), 0 = odrodzony. */
  aftermath?: number;
  /** Żywe linie w tej niszy (aktywna oznaczona). */
  lineages: DioramaLineage[];
}

const FADE = 0.8;

/**
 * Czy WebGL działa programowo (bez karty graficznej)? Wtedy renderer Canvas
 * jest wyraźnie płynniejszy — wybieramy go od razu (bez filtrów).
 */
function softwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch (e) { return true; }
}

/**
 * Zapętlona warstwa krajobrazu: dwa zwykłe obrazki kafla ustawione obok siebie
 * i przesuwane na zmianę. Tańsze niż TilingSprite (zwłaszcza w rendererze
 * Canvas, który dla kafli tworzy wzorzec co klatkę).
 */
class Strip extends Container {
  private a: Sprite; private b: Sprite; private tileW: number;
  constructor(texture: Texture, tileW: number) {
    super();
    this.tileW = tileW;
    this.a = new Sprite(texture); this.b = new Sprite(texture);
    this.addChild(this.a, this.b);
    this.scroll(0);
  }
  /** Przesunięcie w pikselach (dowolnie duże — zawija się do szerokości kafla). */
  scroll(x: number) {
    const off = ((x % this.tileW) + this.tileW) % this.tileW;
    this.a.x = -off; this.b.x = this.tileW - off;
  }
}

function tex(canvas: HTMLCanvasElement, res: number): Texture {
  return new Texture({ source: new CanvasSource({ resource: canvas, resolution: res }) });
}

interface SceneSet {
  key: string;
  back: Container; near: Container;
  tiles: { t: Strip; k: number }[];
  rays: Sprite[];
  textures: Texture[];
  alpha: number; target: number;
}

/** Los osobnika w trakcie tury (animacja przyczyny straty). */
export type DoomKind = 'caught' | 'starve' | 'freeze' | 'ash' | 'impact';

export interface Agent {
  sprite: Sprite;
  baked: Baked;
  lineageId: string;
  predator: boolean;
  x: number; y: number; vx: number; vy: number;
  tx: number; ty: number; retarget: number;
  depth: number; scale: number; facing: number;
  phase: number; speed: number;
  alpha: number; leaving: boolean;
  dash: number; dashCool: number;
  /** 0…1 — nowo narodzony osobnik rośnie do pełnego rozmiaru. */
  grow: number;
  /** Strata w trakcie tury: rodzaj i czas trwania animacji. */
  doom: { kind: DoomKind; t: number } | null;
  /** Reżyser tury prowadzi osobnika (bez błądzenia). */
  directed: boolean;
  /** Tymczasowy drapieżnik sprowadzony na potrzeby animacji tury. */
  temp: boolean;
}

/** Dostęp reżysera tury (turnplay.ts) do sceny. */
export interface StageAccess {
  W: number; H: number; lay: SceneLayout; niche: NicheKey; theme: Theme;
  agents: Agent[];
  fx: Graphics; overlay: Graphics; texts: Container; stage: Container;
  host: HTMLElement;
  rand: () => number;
  setFeeding(on: boolean): void;
  spawnNewborn(lineageId: string, x: number, y: number): Agent | null;
  spawnTempPredator(): Agent | null;
  addWeather(kind: 'snow' | 'ash', n: number): void;
}

interface Particle { s: Sprite; x: number; y: number; vx: number; vy: number; life: number; kind: 'food' | 'bubble' | 'snow' | 'dust' | 'ash'; temp?: boolean }

export class Diorama {
  private app!: Application;
  private host: HTMLElement;
  private theme: Theme;
  private res: number;
  private W = 800;
  private H: number;
  private filtersOk = false;
  private reduced: boolean;

  private sceneRoot = new Container();
  private foodLayer = new Container();
  private lifeLayer = new Container();
  private fxLayer = new Container();
  private nearRoot = new Container();
  private tint = new Graphics();
  private fxG = new Graphics();
  private overlay = new Graphics();
  private texts = new Container();
  private feeding = false;
  private director: { update(dt: number): void; finish(): void } | null = null;
  private vignette: Sprite | null = null;
  private dispSprite: Sprite | null = null;
  private dispFilter: DisplacementFilter | null = null;

  private scenes: SceneSet[] = [];
  private lay!: SceneLayout;
  private data: DioramaData | null = null;
  private bakedByKey = new Map<string, Baked>();
  private agents: Agent[] = [];
  private particles: Particle[] = [];
  private dotTex!: Texture; private bubbleTex!: Texture; private snowTex!: Texture; private rayTex!: Texture;
  private camX = 0;
  private time = 0;
  private visible = true;
  private r = rng(12345);
  /** Pomiar płynności do automatycznego obniżenia jakości. */
  private perf = { frames: 0, time: 0, degraded: 0 };

  private q: QualityParams;
  private destroyed = false;
  private observers: { disconnect(): void }[] = [];

  private constructor(host: HTMLElement, theme: Theme, height: number, q: QualityParams) {
    this.host = host; this.theme = theme; this.H = height; this.q = q;
    this.res = Math.min(q.maxRes, window.devicePixelRatio || 1);
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Tworzy dioramę; zwraca null, gdy przeglądarka nie potrafi jej narysować. */
  static async create(host: HTMLElement, theme: Theme, height: number, q: QualityParams): Promise<Diorama | null> {
    const d = new Diorama(host, theme, height, q);
    try { await d.init(); return d; } catch (e) { console.warn('Diorama niedostępna:', e); return null; }
  }

  private async init() {
    this.W = Math.max(280, this.host.clientWidth);
    this.app = new Application();
    await this.app.init({
      width: this.W, height: this.H, backgroundAlpha: 0, antialias: false,
      resolution: this.res, autoDensity: true, preference: this.q.renderer ? [this.q.renderer] : softwareWebGL() ? ['canvas', 'webgl'] : ['webgl', 'canvas'],
      powerPreference: 'low-power',
      // bez dostępności/zdarzeń/DOM Pixi — płótno jest ozdobne (aria-hidden), klików nie obsługuje
      skipExtensionImports: true
    });
    this.filtersOk = this.q.effects && this.app.renderer.name !== 'canvas';
    const cv = this.app.canvas as HTMLCanvasElement;
    cv.className = 'diorama-canvas';
    cv.setAttribute('aria-hidden', 'true');
    this.host.prepend(cv);

    this.dotTex = tex(paintDot('#ffffff', this.res), this.res);
    this.bubbleTex = tex(paintBubble(this.theme, this.res), this.res);
    this.snowTex = tex(paintSnow(this.theme, this.res), this.res);
    this.rayTex = tex(paintRay(this.res), this.res);

    this.lifeLayer.sortableChildren = true;
    this.app.stage.addChild(this.sceneRoot, this.foodLayer, this.lifeLayer, this.fxG, this.fxLayer, this.nearRoot, this.tint, this.overlay, this.texts);
    if (this.filtersOk) {
      // falowanie obrazu pod wodą — mapa przemieszczeń z zapętlonego szumu
      const noise = tex(paintNoise(128, 7), 1);
      noise.source.style.addressMode = 'repeat';
      this.dispSprite = new Sprite(noise);
      this.dispSprite.renderable = false;
      this.dispSprite.scale.set(3);
      this.app.stage.addChild(this.dispSprite);
      this.dispFilter = new DisplacementFilter({ sprite: this.dispSprite, scale: 5 });
    }
    this.buildVignette();

    if (this.q.maxFps) this.app.ticker.maxFPS = this.q.maxFps;
    this.app.ticker.add((t) => this.tick(Math.min(0.05, t.deltaMS / 1000)));
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => this.resize()); ro.observe(this.host); this.observers.push(ro);
    }
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { this.visible = es.some((e) => e.isIntersecting); this.syncTicker(); });
      io.observe(this.host); this.observers.push(io);
    }
    document.addEventListener('visibilitychange', () => this.syncTicker());
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => { this.reduced = e.matches; this.syncTicker(); });
    this.syncTicker();
  }

  private syncTicker() {
    if (this.destroyed) return;
    const run = this.visible && !document.hidden && !this.reduced && this.q.animate;
    if (run) this.app.ticker.start(); else { this.app.ticker.stop(); this.renderStill(); }
  }

  /** Pojedyncza klatka (tryb bez animacji lub w tle). */
  private renderStill() {
    if (!this.app || !this.data) return;
    this.scenes.forEach((s) => { s.alpha = s.target; s.back.alpha = s.near.alpha = s.alpha; });
    this.scenes = this.scenes.filter((s) => { if (s.alpha <= 0) { this.disposeScene(s); return false; } return true; });
    this.agents.forEach((a) => { a.alpha = a.leaving ? 0 : 1; this.placeAgent(a); });
    this.cleanupAgents();
    this.app.render();
  }

  private buildVignette() {
    if (this.vignette) { this.vignette.destroy({ texture: true, textureSource: true }); }
    this.vignette = new Sprite(tex(paintVignette(this.W, this.H, this.theme), 1));
    this.app.stage.addChild(this.vignette);
  }

  private resize() {
    if (this.destroyed) return;
    const w = Math.max(280, this.host.clientWidth);
    if (Math.abs(w - this.W) < 24) return;
    this.W = w;
    this.app.renderer.resize(this.W, this.H);
    this.buildVignette();
    if (this.data) {
      const d = this.data; this.data = null;
      this.scenes.forEach((s) => { s.target = 0; s.alpha = 0; });
      this.update(d);
    }
  }

  // ------------------------------------------------------------------ aktualizacja danych

  update(data: DioramaData) {
    if (this.destroyed) return;
    if (this.director) this.director.finish();
    const prev = this.data;
    this.data = data;
    const sceneKey = [data.niche, data.era, this.W, this.theme.dark].join('|');
    if (!this.scenes.length || this.scenes[this.scenes.length - 1].key !== sceneKey) this.swapScene(sceneKey, data);
    this.lay = sceneLayout(data.niche, this.W, this.H);
    this.applyMood(data);
    this.syncPopulation(data, prev);
    this.syncParticles(data);
    if (!this.app.ticker.started) this.renderStill();
  }

  private swapScene(key: string, d: DioramaData) {
    const lay = sceneLayout(d.niche, this.W, this.H);
    const tileW = Math.ceil(Math.max(900, this.W * 1.6) / 10) * 10;
    const args: PaintArgs = { niche: d.niche, era: d.era, theme: this.theme, lay, tileW, seed: hashString(d.niche + d.era), res: this.res };
    const textures: Texture[] = [];
    const mk = (c: HTMLCanvasElement) => { const t = tex(c, this.res); textures.push(t); return t; };

    const back = new Container();
    const bg = new Sprite(mk(paintBackground(args)));
    bg.width = this.W; bg.height = this.H;
    back.addChild(bg);
    const far = new Strip(mk(paintFar(args)), tileW);
    back.addChild(far);
    const rays: Sprite[] = [];
    if (d.niche === 'woda' || d.niche === 'przybrzeze' || d.niche === 'lad') {
      const n = d.niche === 'lad' ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const s = new Sprite(this.rayTex);
        // Renderer Canvas (Pixi 8) źle przywraca tryb mieszania po „add” — tam zwykłe mieszanie.
        if (this.filtersOk) s.blendMode = 'add';
        s.x = (i + 0.3 + this.r() * 0.5) * (this.W / n);
        s.y = d.niche === 'przybrzeze' ? lay.surfaceY : (d.niche === 'lad' ? -20 : 0);
        s.height = (d.niche === 'lad' ? this.H * 0.9 : lay.floorY - s.y) ;
        s.width = 40 + this.r() * 50;
        s.skew.x = d.niche === 'lad' ? -0.5 : -0.25 + this.r() * 0.1;
        s.alpha = d.niche === 'lad' ? 0.18 : 0.35;
        back.addChild(s); rays.push(s);
      }
    }
    const mid = new Strip(mk(paintMid(args)), tileW);
    back.addChild(mid);
    if (this.dispFilter && (d.niche === 'woda' || d.niche === 'przybrzeze')) back.filters = [this.dispFilter];

    const near = new Container();
    const nearT = new Strip(mk(paintNear(args)), tileW);
    near.addChild(nearT);

    const set: SceneSet = {
      key, back, near, rays, textures,
      tiles: [{ t: far, k: 0.25 }, { t: mid, k: 0.6 }, { t: nearT, k: 1.3 }],
      alpha: this.scenes.length ? 0 : 1, target: 1
    };
    back.alpha = near.alpha = set.alpha;
    this.scenes.forEach((s) => { s.target = 0; });
    this.scenes.push(set);
    this.sceneRoot.addChild(back);
    this.nearRoot.addChild(near);
  }

  private disposeScene(s: SceneSet) {
    s.back.destroy({ children: true });
    s.near.destroy({ children: true });
    s.textures.forEach((t) => t.destroy(true));
  }

  /** Klimat i zapowiedź katastrofy — delikatna nakładka barwna. */
  private applyMood(d: DioramaData) {
    this.tint.clear();
    let color = 0, alpha = 0;
    if (d.catastrophe) { color = 0x7a3a2a; alpha = 0.16; }
    else if (d.aftermath && d.aftermath > 0) { color = 0x8a8072; alpha = 0.26 * Math.min(1, d.aftermath); }
    else if (d.climate === 'zimno') { color = 0x9fc0dc; alpha = 0.18; }
    else if (d.climate === 'cieplo') { color = 0xf0c070; alpha = 0.08; }
    if (alpha) this.tint.rect(0, 0, this.W, this.H).fill({ color, alpha });
  }

  // ------------------------------------------------------------------ populacja

  private bakedFor(spec: CreatureSpec, key: string, unitPx: number): Baked {
    let b = this.bakedByKey.get(key);
    if (!b) { b = bakeCreature(spec, this.theme, unitPx, this.res); this.bakedByKey.set(key, b); }
    return b;
  }

  /** Rozmiar osobnika na scenie: stała wielkość na ekranie niezależnie od planu budowy. */
  private unitPxFor(spec: CreatureSpec, predator: boolean): number {
    const niche = this.data ? this.data.niche : 'woda';
    const base = niche === 'lad' ? 74 : niche === 'powietrze' ? 64 : 60;
    const targetLen = base * (this.H < 190 ? 0.75 : 1) * (predator ? 1.5 : 1);
    return targetLen / (200 * spec.proportions.length);
  }

  private predatorSpec(d: DioramaData): CreatureSpec {
    const traits = d.niche === 'powietrze'
      ? ['fins', 'limbs', 'flight', 'jaws', 'eyes', 'endothermy', 'insulation']
      : d.niche === 'lad'
        ? (d.era === 'kenozoik' ? ['fins', 'limbs', 'jaws', 'eyes', 'endothermy', 'insulation', 'scales']
          : ['fins', 'limbs', 'jaws', 'eyes', 'scales', d.era === 'mezozoik' ? 'endothermy' : 'camouflage'])
        : ['fins', 'jaws', 'eyes', 'shell', 'fast_muscle', 'scales'];
    // W paleozoiku dno morskie rządzą głowonogi, a ląd i powietrze — wielkie stawonogi.
    const paleo = d.era === 'paleozoik';
    const drawn = paleo ? traits.filter((t) => t !== 'endothermy' && t !== 'insulation') : traits;
    const bodyPlan = paleo ? (d.niche === 'woda' || d.niche === 'przybrzeze' ? 'glowonog' : 'stawonog') : 'kregowiec';
    const spec = buildSpec({ id: 'drapieżnik-' + d.niche + d.era, name: 'drapieżnik', traits: drawn, niche: d.niche, bodyPlan });
    spec.bodyColor = '#6b4a3e';
    spec.proportions = { length: 1.05, girth: 1.12, head: 1.15 };
    return spec;
  }

  private syncPopulation(d: DioramaData, prev: DioramaData | null) {
    const nicheChanged = !prev || prev.niche !== d.niche;
    // pożądana liczba osobników każdej linii
    const want = new Map<string, { n: number; spec: CreatureSpec; key: string; predator: boolean }>();
    let total = 0;
    d.lineages.forEach((l) => {
      const spec = buildSpec(l);
      const n = Math.max(l.active ? 3 : 1, Math.min(l.active ? 22 : 9, Math.round(1.5 + Math.sqrt(Math.max(0, l.population)) / (l.active ? 2.2 : 3.2))));
      want.set(l.id, { n, spec, key: l.id + '|' + l.traits.slice().sort().join(',') + '|' + d.niche, predator: false });
      total += n;
    });
    const nPred = Math.max(0, Math.min(3, Math.round(d.predators / 5)));
    if (nPred) {
      const spec = this.predatorSpec(d);
      want.set('__pred', { n: nPred, spec, key: 'pred|' + d.niche + '|' + d.era, predator: true });
    }
    const scaleDown = total > this.q.maxAgents ? this.q.maxAgents / total : 1;

    // odejście osobników linii spoza niszy / przy zmianie niszy
    this.agents.forEach((a) => {
      const w = want.get(a.predator ? '__pred' : a.lineageId);
      if (!w || nicheChanged) a.leaving = true;
    });
    want.forEach((w, id) => {
      const n = w.predator ? w.n : Math.max(1, Math.round(w.n * scaleDown));
      const baked = this.bakedFor(w.spec, w.key, this.unitPxFor(w.spec, w.predator));
      let mine = this.agents.filter((a) => !a.leaving && (w.predator ? a.predator : a.lineageId === id));
      // Specjacja: nowa gałąź powstaje z połowy stada rodzica, które się rozchodzi.
      const lin = d.lineages.find((l) => l.id === id);
      if (!w.predator && !mine.length && lin && lin.parentId && !nicheChanged) {
        const parents = this.agents.filter((a) => !a.leaving && !a.doom && a.lineageId === lin.parentId);
        const moved = parents.slice(0, Math.floor(parents.length / 2));
        const cx = moved.reduce((s2, a) => s2 + a.x, 0) / Math.max(1, moved.length);
        moved.forEach((a) => {
          a.lineageId = id; a.baked = baked; a.sprite.anchor.set(baked.anchorX, baked.anchorY);
          a.grow = 0.55; // krótkie „pulsowanie” przy zmianie
          a.tx = cx < this.W / 2 ? this.W * (0.65 + this.r() * 0.3) : this.W * (0.05 + this.r() * 0.3);
          a.retarget = 4;
        });
        mine = moved;
      }
      // nowe cechy → podmiana klatek bez znikania osobników
      mine.forEach((a) => { if (a.baked !== baked) { a.baked = baked; a.sprite.anchor.set(baked.anchorX, baked.anchorY); } });
      for (let i = mine.length; i < n; i++) this.spawn(id, baked, w.predator, d);
      for (let i = n; i < mine.length; i++) mine[i].leaving = true;
    });
    // porządek w wypiekach nieużywanych już linii
    const used = new Set<string>(); want.forEach((w) => used.add(w.key));
    this.bakedByKey.forEach((b, k) => {
      if (!used.has(k) && !this.agents.some((a) => a.baked === b)) { destroyBaked(b); this.bakedByKey.delete(k); }
    });
  }

  private spawn(lineageId: string, baked: Baked, predator: boolean, d: DioramaData): Agent {
    const s = new Sprite(baked.frames[0]);
    s.anchor.set(baked.anchorX, baked.anchorY);
    const lay = sceneLayout(d.niche, this.W, this.H);
    const depth = this.r();
    const a: Agent = {
      sprite: s, baked, lineageId, predator,
      x: this.r() * this.W, y: lay.lifeTop + this.r() * (lay.lifeBottom - lay.lifeTop),
      vx: 0, vy: 0, tx: 0, ty: 0, retarget: 0,
      depth, scale: predator ? 1 : 0.72 + 0.28 * depth, facing: this.r() > 0.5 ? 1 : -1,
      phase: this.r(), speed: (predator ? 0.7 : 1) * (0.85 + this.r() * 0.3),
      alpha: 0, leaving: false, dash: 0, dashCool: 4 + this.r() * 6,
      grow: 1, doom: null, directed: false, temp: false
    };
    if (d.niche === 'powietrze') a.facing = 1;
    this.pickTarget(a);
    this.lifeLayer.addChild(s);
    this.agents.push(a);
    return a;
  }

  private pickTarget(a: Agent) {
    const lay = this.lay || sceneLayout('woda', this.W, this.H);
    a.tx = 30 + this.r() * (this.W - 60);
    a.ty = lay.lifeTop + this.r() * (lay.lifeBottom - lay.lifeTop);
    a.retarget = 3 + this.r() * 5;
  }

  private cleanupAgents() {
    this.agents = this.agents.filter((a) => {
      if (a.leaving && a.alpha <= 0.01) { a.sprite.destroy(); return false; }
      return true;
    });
  }

  private baseSpeed(): number {
    const n = this.data ? this.data.niche : 'woda';
    return n === 'lad' ? 16 : n === 'powietrze' ? 22 : 26;
  }

  private stepAgents(dt: number) {
    const lay = this.lay; const niche = this.data!.niche;
    const preds = this.agents.filter((a) => a.predator && !a.leaving);
    const base = this.baseSpeed();
    // środek ciężkości każdej linii (spójność ławicy/stada)
    const cent = new Map<string, { x: number; y: number; n: number }>();
    this.agents.forEach((a) => {
      if (a.predator) return;
      const c = cent.get(a.lineageId) || { x: 0, y: 0, n: 0 };
      c.x += a.x; c.y += a.y; c.n++; cent.set(a.lineageId, c);
    });

    for (const a of this.agents) {
      if (a.grow < 1) a.grow = Math.min(1, a.grow + dt / 0.9);
      if (a.doom) { this.stepDoom(a, dt); this.placeAgent(a); continue; }
      a.alpha = Math.max(0, Math.min(1, a.alpha + (a.leaving ? -dt : dt) / FADE));
      a.retarget -= dt;
      if (a.directed) a.retarget = 1;
      if (a.retarget <= 0 || Math.hypot(a.tx - a.x, a.ty - a.y) < 12) this.pickTarget(a);
      let dx = a.tx - a.x, dy = a.ty - a.y;
      let len = Math.hypot(dx, dy) || 1;
      let speed = base * a.speed;
      let fx = (dx / len) * speed, fy = (dy / len) * speed;

      if (a.predator) {
        a.dashCool -= dt;
        if (a.dash > 0) a.dash -= dt;
        if (a.dashCool <= 0 && a.dash <= 0) {
          // wypad na najbliższą ofiarę
          let best: Agent | null = null, bd = 1e9;
          for (const p of this.agents) { if (p.predator || p.leaving) continue; const dd = Math.hypot(p.x - a.x, p.y - a.y); if (dd < bd) { bd = dd; best = p; } }
          if (best) { a.tx = best.x; a.ty = best.y; a.dash = 1.4; }
          a.dashCool = 6 + this.r() * 6;
        }
        if (a.dash > 0) { speed *= 2.6; fx = (dx / len) * speed; fy = (dy / len) * speed; }
      } else {
        const c = cent.get(a.lineageId);
        if (c && c.n > 1) { fx += (c.x / c.n - a.x) * 0.08; fy += (c.y / c.n - a.y) * 0.08; }
        for (const b of this.agents) {
          if (b === a || b.predator) continue;
          const sx = a.x - b.x, sy = a.y - b.y, d2 = sx * sx + sy * sy;
          if (d2 < 26 * 26 && d2 > 0.01) { const k = (26 * 26 - d2) / (26 * 26); fx += sx * k * 1.2; fy += sy * k * 1.2; }
        }
        // ucieczka przed drapieżnikiem — dobór naturalny w akcji
        for (const p of preds) {
          const ex = a.x - p.x, ey = a.y - p.y, dd = Math.hypot(ex, ey);
          if (dd < 110) { const k = (110 - dd) / 110; fx += (ex / (dd || 1)) * base * 3.2 * k; fy += (ey / (dd || 1)) * base * 2.2 * k; }
        }
      }
      if (niche === 'powietrze') fx += base * 0.35; // lot „do przodu” (świat przesuwa się w tle)
      const k = Math.min(1, dt * (a.predator && a.dash > 0 ? 3 : 1.6));
      a.vx += (fx - a.vx) * k; a.vy += (fy - a.vy) * k;
      const vmax = speed * 1.9;
      len = Math.hypot(a.vx, a.vy);
      if (len > vmax) { a.vx *= vmax / len; a.vy *= vmax / len; }
      a.x += a.vx * dt; a.y += a.vy * dt;
      // granice
      const m = 24;
      if (a.x < -m) a.x = -m; if (a.x > this.W + m) a.x = this.W + m;
      if (a.y < lay.lifeTop) { a.y = lay.lifeTop; a.vy = Math.abs(a.vy) * 0.3; }
      if (a.y > lay.lifeBottom) { a.y = lay.lifeBottom; a.vy = -Math.abs(a.vy) * 0.3; }
      // animacja: na lądzie tempo kroków zależy od prędkości
      const moving = Math.hypot(a.vx, a.vy);
      const animK = niche === 'lad' ? Math.max(0.15, moving / base) : 0.7 + 0.5 * Math.min(1.5, moving / base);
      a.phase = (a.phase + (dt / a.baked.cycle) * animK) % 1;
      const want = Math.abs(a.vx) > 3 ? Math.sign(a.vx) : a.facing >= 0 ? 1 : -1;
      a.facing += (want - a.facing) * Math.min(1, dt * 5);
      this.placeAgent(a);
    }
    this.cleanupAgents();
  }

  /** Animacja straty: każda przyczyna wygląda inaczej (gracz widzi „dlaczego”). */
  private stepDoom(a: Agent, dt: number) {
    const d = a.doom!;
    d.t += dt;
    if (d.t < 0) return; // fala uderzeniowa jeszcze nie dotarła
    const water = this.data && (this.data.niche === 'woda' || this.data.niche === 'przybrzeze');
    let dur = 1.2;
    switch (d.kind) {
      case 'caught':
        dur = 0.7; a.sprite.tint = d.t < 0.25 ? 0xd0604a : 0x8a5a4a; a.vx *= 0.8; a.vy *= 0.8; break;
      case 'starve':
        dur = 1.6; a.sprite.tint = 0xa8a296; a.vx *= 0.9; a.vy = water ? 10 : 0; a.phase = 0; break;
      case 'freeze':
        dur = 1.8; a.sprite.tint = 0xd8ecff; a.vx = 0; a.vy = 0; break;
      case 'ash':
        dur = 1.8; a.sprite.tint = 0x9a8a78; a.vx *= 0.9; a.vy = water ? -12 : 0; break;
      case 'impact':
        dur = 1.1; a.sprite.tint = 0x6a5a4e; a.vx *= 0.94; a.vy *= 0.94; break;
    }
    a.x += a.vx * dt; a.y += a.vy * dt;
    a.alpha = Math.max(0, 1 - Math.max(0, d.t - dur * 0.35) / (dur * 0.65));
    if (d.t >= dur) { a.alpha = 0; a.leaving = true; }
  }

  private placeAgent(a: Agent) {
    const lay = this.lay; const niche = this.data ? this.data.niche : 'woda';
    const s = a.sprite;
    const frames = a.baked.frames;
    s.texture = frames[Math.floor(a.phase * frames.length) % frames.length];
    let sc = a.scale;
    const grow = a.grow < 1 ? 0.35 + 0.65 * (1 - Math.pow(1 - a.grow, 3)) : 1;
    if (niche === 'lad') {
      // głębia z pozycji na gruncie: dalej = wyżej, mniejsze, bledsze
      const dep = (a.y - lay.lifeTop) / Math.max(1, lay.lifeBottom - lay.lifeTop);
      sc = (a.predator ? 1 : 0.95) * (0.72 + 0.28 * dep) * grow;
      s.zIndex = a.y;
      s.y = a.y - a.baked.foot * a.baked.unitPx * sc;
    } else {
      s.zIndex = a.depth * 100 + (a.predator ? 50 : 0);
      s.y = a.y;
      sc *= grow;
    }
    s.x = a.x;
    const f = Math.abs(a.facing) < 0.12 ? 0.12 * Math.sign(a.facing || 1) : a.facing;
    s.scale.set(f * sc, sc);
    s.rotation = niche === 'lad' ? 0 : Math.max(-0.35, Math.min(0.35, Math.atan2(a.vy, Math.abs(a.vx) + 20) * 0.6)) * Math.sign(f);
    if (a.doom && a.doom.kind === 'ash') s.rotation = Math.min(Math.PI, a.doom.t * 3) * (niche === 'lad' ? 0.5 : 1); // „brzuchem do góry”
    if (!a.doom) s.tint = 0xffffff;
    const far = niche === 'lad' ? 0 : (1 - a.depth) * 0.25;
    s.alpha = a.alpha * (1 - far);
  }

  // ------------------------------------------------------------------ cząstki

  private syncParticles(d: DioramaData) {
    this.particles.forEach((p) => p.s.destroy());
    this.particles = [];
    const lay = sceneLayout(d.niche, this.W, this.H);
    const water = d.niche === 'woda' || d.niche === 'przybrzeze';
    const add = (kind: Particle['kind'], n: number) => {
      n = Math.round(n * this.q.particles);
      for (let i = 0; i < n; i++) {
        const s = new Sprite(kind === 'bubble' ? this.bubbleTex : kind === 'snow' ? this.snowTex : this.dotTex);
        s.anchor.set(0.5);
        const p: Particle = { s, x: this.r() * this.W, y: this.r() * this.H, vx: 0, vy: 0, life: this.r(), kind };
        if (kind === 'food') {
          s.tint = water ? 0xe8f0d0 : 0x3a3226; s.alpha = water ? 0.7 : 0.55;
          s.scale.set(water ? 0.35 + this.r() * 0.3 : 0.28);
          p.y = water ? lay.surfaceY + 10 + this.r() * (lay.floorY - lay.surfaceY - 20) : lay.lifeTop - 30 + this.r() * 40;
          p.vx = (this.r() - 0.5) * 6; p.vy = water ? 1 + this.r() * 3 : 0;
          (this.foodLayer).addChild(s);
        } else {
          if (kind === 'bubble') { s.scale.set(0.5 + this.r() * 0.6); p.vy = -(10 + this.r() * 14); p.y = lay.floorY - this.r() * 40; }
          if (kind === 'snow') { s.scale.set(0.6 + this.r() * 0.6); s.alpha = 0.95; p.vy = 12 + this.r() * 12; p.vx = -4 + this.r() * 3; }
          if (kind === 'dust') { s.tint = 0xfff0c0; if (this.filtersOk) s.blendMode = 'add'; s.scale.set(0.3 + this.r() * 0.3); s.alpha = 0.5; p.vy = -2 + this.r() * 4; p.vx = 2 + this.r() * 4; }
          this.fxLayer.addChild(s);
        }
        s.x = p.x; s.y = p.y;
        this.particles.push(p);
      }
    };
    // pokarm: plankton w wodzie, owady/pyłki na lądzie i w powietrzu (∝ zasobom tury)
    add('food', Math.max(0, Math.min(70, Math.round(d.food * (water ? 4 : 2.2)))));
    if (water) add('bubble', 7);
    if (d.climate === 'zimno') add('snow', water ? 0 : 70);
    if (d.climate === 'cieplo' && !water) add('dust', 18);
  }

  private stepParticles(dt: number) {
    const lay = this.lay;
    for (const p of this.particles) {
      p.life += dt;
      if (p.kind === 'food' && this.feeding) {
        // żerowanie: pokarm „wpada” do najbliższego osobnika
        let best: Agent | null = null, bd = 150;
        for (const a of this.agents) {
          if (a.predator || a.doom || a.leaving) continue;
          const dd = Math.hypot(a.x - p.x, a.y - p.y); if (dd < bd) { bd = dd; best = a; }
        }
        if (best) {
          const k = Math.min(1, (70 * dt) / Math.max(1, bd));
          p.x += (best.x - p.x) * k; p.y += (best.y - p.y) * k;
          if (bd < 7) { p.x = this.r() * this.W; p.y = lay.lifeTop + this.r() * (lay.lifeBottom - lay.lifeTop); }
        }
      } else if (p.kind === 'food') {
        p.x += (p.vx + Math.sin(p.life * 0.8 + p.y) * 3) * dt; p.y += (p.vy * 0.2 + Math.cos(p.life + p.x) * 2) * dt;
      } else { p.x += p.vx * dt + Math.sin(p.life * 2) * 0.2; p.y += p.vy * dt; }
      if (p.kind === 'bubble' && p.y < (lay.surfaceY > 0 ? lay.surfaceY : 0)) { p.y = lay.floorY - 4; p.x = this.r() * this.W; }
      if ((p.kind === 'snow' || p.kind === 'ash') && p.y > this.H) {
        if (p.temp) { p.s.visible = false; } else { p.y = -4; p.x = this.r() * this.W; }
      }
      if (p.x < -10) p.x += this.W + 20; if (p.x > this.W + 10) p.x -= this.W + 20;
      if (p.y < -10) p.y += this.H; if (p.y > this.H + 10) p.y -= this.H;
      p.s.x = p.x - (p.kind === 'food' ? 0 : 0); p.s.y = p.y;
    }
  }

  // ------------------------------------------------------------------ pętla

  private tick(dt: number) {
    if (!this.data) return;
    this.time += dt;
    this.watchPerformance(dt);
    const niche = this.data.niche;
    const pan = niche === 'powietrze' ? 16 : niche === 'lad' ? 0 : 4;
    this.camX += pan * dt;
    for (const s of this.scenes) {
      s.alpha += Math.sign(s.target - s.alpha) * Math.min(Math.abs(s.target - s.alpha), dt / FADE);
      s.back.alpha = s.near.alpha = s.alpha;
      for (const t of s.tiles) {
        // w dioramie lądowej płyną tylko chmury (daleki plan)
        t.t.scroll(niche === 'lad' && t.k === 0.25 ? this.time * 3 : this.camX * t.k);
      }
      s.rays.forEach((r, i) => { r.alpha = (niche === 'lad' ? 0.12 : 0.2) + 0.08 * Math.sin(this.time * 0.6 + i * 1.7); r.skew.x = (niche === 'lad' ? -0.5 : -0.2) + 0.06 * Math.sin(this.time * 0.3 + i); });
    }
    this.scenes = this.scenes.filter((s) => { if (s.target === 0 && s.alpha <= 0) { this.disposeScene(s); return false; } return true; });
    if (this.dispSprite) { this.dispSprite.x = -((this.time * 12) % 384); this.dispSprite.y = -((this.time * 6) % 384); }
    this.stepAgents(dt);
    this.stepParticles(dt);
    if (this.director) this.director.update(dt);
  }

  // ------------------------------------------------------------------ tura jako wydarzenie

  /** Czy ustawienia pozwalają na animację (jakość, ograniczenie ruchu) — bez względu na widoczność. */
  canAnimate(): boolean { return !this.destroyed && !this.reduced && this.q.animate; }

  /** Czy scena może teraz odegrać animację (widoczna, z ruchem). */
  canPlay(): boolean {
    return !!this.data && this.visible && !document.hidden && !this.reduced && this.q.animate && this.app.ticker.started;
  }

  /**
   * Odegranie przebiegu tury (turnplay.ts). Zwraca obietnicę spełnianą po
   * zakończeniu albo pominięciu; potem gra pokazuje raport i nowy stan.
   */
  async playTurn(play: import('./turnplay.ts').TurnPlay): Promise<void> {
    if (!this.canPlay()) return;
    if (this.director) this.director.finish();
    const { TurnDirector } = await import('./turnplay.ts');
    await new Promise<void>((resolve) => {
      const dir = new TurnDirector(this.access(), play, () => { this.director = null; this.feeding = false; resolve(); });
      this.director = dir;
    });
  }

  private access(): StageAccess {
    const self = this;
    return {
      get W() { return self.W; }, get H() { return self.H; }, get lay() { return self.lay; },
      get niche() { return self.data!.niche; }, get theme() { return self.theme; },
      get agents() { return self.agents; },
      fx: this.fxG, overlay: this.overlay, texts: this.texts, stage: this.app.stage, host: this.host,
      rand: this.r,
      setFeeding: (on) => { this.feeding = on; },
      spawnNewborn: (id, x, y) => {
        const parent = this.agents.find((a) => a.lineageId === id && !a.predator);
        if (!parent || !this.data) return null;
        const a = this.spawn(id, parent.baked, false, this.data);
        a.x = x; a.y = y; a.grow = 0; a.alpha = 1; a.depth = parent.depth; a.scale = parent.scale; a.facing = parent.facing;
        this.placeAgent(a);
        return a;
      },
      spawnTempPredator: () => {
        if (!this.data) return null;
        const d = this.data;
        const spec = this.predatorSpec(d);
        const baked = this.bakedFor(spec, 'pred|' + d.niche + '|' + d.era, this.unitPxFor(spec, true));
        const a = this.spawn('__pred', baked, true, d);
        a.x = this.r() > 0.5 ? -40 : this.W + 40; a.alpha = 1; a.temp = true;
        return a;
      },
      addWeather: (kind, n) => {
        for (let i = 0; i < n; i++) {
          const s = new Sprite(kind === 'snow' ? this.snowTex : this.dotTex);
          s.anchor.set(0.5);
          const p: Particle = { s, x: this.r() * this.W, y: -this.r() * this.H * 0.8, vx: -6 + this.r() * 4, vy: 30 + this.r() * 30, life: 0, kind, temp: true };
          if (kind === 'ash') { s.tint = 0x5a5048; s.scale.set(0.5 + this.r() * 0.5); s.alpha = 0.85; p.vy = 14 + this.r() * 16; }
          else s.scale.set(0.7 + this.r() * 0.6);
          this.fxLayer.addChild(s); this.particles.push(p);
        }
      }
    };
  }

  /**
   * Siatka bezpieczeństwa dla słabszych komputerów: gdy po rozgrzaniu scena
   * nie utrzymuje ~40 kl./s, najpierw wyłączamy falowanie wody, gęstość
   * pikseli i ograniczamy scenę do 30 kl./s, potem przerzedzamy cząstki.
   * Działa tylko w trybie jakości „automatyczna” (art/settings.ts).
   */
  private watchPerformance(dt: number) {
    if (!this.q.auto || this.perf.degraded >= 2) return;
    this.perf.frames++; this.perf.time += dt;
    if (this.perf.frames < 150) return;
    const fps = this.perf.frames / this.perf.time;
    this.perf.frames = 0; this.perf.time = 0;
    if (fps >= 40) { this.perf.degraded = Math.max(this.perf.degraded, 0); return; }
    this.perf.degraded++;
    if (this.perf.degraded === 1) {
      this.dispFilter = null;
      this.scenes.forEach((s) => { s.back.filters = null; });
      if (this.res > 1) { this.res = 1; this.app.renderer.resize(this.W, this.H, 1); }
      this.app.ticker.maxFPS = 30;
    } else {
      this.particles.forEach((p, i) => { if (i % 2) p.s.visible = false; });
      this.res = 0.75; this.app.renderer.resize(this.W, this.H, 0.75);
    }
    console.info('Diorama: obniżono jakość (poziom ' + this.perf.degraded + '), ' + fps.toFixed(0) + ' kl./s');
  }

  /** Rodzaj renderera (do podpisu w ustawieniach). */
  rendererName(): string { return this.app.renderer.name; }

  destroy() {
    if (this.destroyed) return;
    if (this.director) this.director.finish();
    this.destroyed = true;
    this.observers.forEach((o) => o.disconnect());
    this.bakedByKey.forEach((b) => destroyBaked(b));
    this.app.destroy(true, { children: true, texture: true });
  }
}
