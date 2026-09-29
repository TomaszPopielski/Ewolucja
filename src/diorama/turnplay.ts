/*
 * turnplay.ts — „tura jako wydarzenie”: reżyser krótkiej animacji w dioramie.
 *
 * Przed raportem gracz widzi przyczyny i skutki tury: żerowanie, ataki
 * drapieżników, głód, narodziny, mutację i ewentualną katastrofę (uderzenie
 * meteorytu, zlodowacenie, wulkanizm). Liczba ofiar i młodych na scenie jest
 * proporcjonalna do liczb z silnika. Całość trwa ok. 4–7 s i można ją pominąć
 * (przycisk, Esc, Enter, spacja).
 */
import { Text } from 'pixi.js';
import type { Agent, StageAccess } from './diorama.ts';

export type CatastropheKind = 'meteor' | 'ice' | 'volcano';

export interface TurnPlay {
  lineageId: string;
  popBefore: number; popAfter: number;
  births: number; predationDeaths: number; starvationDeaths: number; catDeaths: number;
  mutation?: { beneficial: boolean; text: string } | null;
  catastrophe?: { name: string; kind: CatastropheKind } | null;
  /** Wielkie wymieranie: plansza po uderzeniu katastrofy (teksty z UI). */
  extinction?: { kicker: string; title: string; sub: string } | null;
  /** Napisy (i18n po stronie UI). */
  labels: {
    feed: string; feedSub: string;
    predation: string; starvation: string; births: string;
    mutationGood: string; mutationBad: string;
    skip: string;
  };
}

type Tone = 'neutral' | 'good' | 'bad' | 'ep';

interface Phase {
  title: string; sub: string; tone: Tone; dur: number;
  start: () => void;
  update: (u: number, dt: number) => void;
}

interface Ring { x: number; y: number; r0: number; r1: number; t: number; dur: number; color: number; width: number; follow?: Agent }
interface Floater { t: Text; life: number }

const COLORS = { good: 0x3d6b4e, bad: 0xa13a28, ep: 0x6a4c93, ink: 0x2c261e, starve: 0x7a7266, white: 0xffffff };

export class TurnDirector {
  private phases: Phase[] = [];
  private i = -1;
  private t = 0;
  private done = false;
  private rings: Ring[] = [];
  private floaters: Floater[] = [];
  private flash = 0;
  private shake = 0;
  private haze = { color: 0x000000, a: 0, target: 0 };
  private frost = 0;
  private glow = 0;
  private meteor: { x0: number; y0: number; x1: number; y1: number; u: number } | null = null;
  private tempPreds: Agent[] = [];
  private banner: HTMLElement;
  private card: HTMLElement | null = null;
  private skipBtn: HTMLButtonElement;
  private onKey: (e: KeyboardEvent) => void;
  private remaining: Agent[];

  constructor(private st: StageAccess, private play: TurnPlay, private onDone: () => void) {
    // Paleta bezpieczna dla daltonistów: niebieski = zysk, cynober = strata.
    const cb = document.documentElement.dataset.palette === 'cb';
    COLORS.good = cb ? 0x0072b2 : 0x3d6b4e; COLORS.bad = cb ? 0xd55e00 : 0xa13a28;
    this.remaining = this.mine();
    this.buildPhases();
    this.banner = document.createElement('div');
    this.banner.className = 'turn-banner';
    this.banner.setAttribute('role', 'status');
    this.banner.setAttribute('aria-live', 'polite');
    this.skipBtn = document.createElement('button');
    this.skipBtn.type = 'button';
    this.skipBtn.className = 'btn btn-ghost turn-skip';
    this.skipBtn.textContent = play.labels.skip;
    this.skipBtn.addEventListener('click', () => this.finish());
    st.host.append(this.banner, this.skipBtn);
    st.host.classList.add('turn-playing');
    this.onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.finish(); } };
    document.addEventListener('keydown', this.onKey);
    this.skipBtn.focus({ preventScroll: true });
    this.next();
  }

  // ------------------------------------------------------------------ fazy

  /** Żywe osobniki aktywnej linii (bez już skazanych). */
  private mine(): Agent[] {
    return this.st.agents.filter((a) => a.lineageId === this.play.lineageId && !a.predator && !a.doom && !a.leaving);
  }

  /** Ilu osobników na scenie odpowiada stracie `deaths` z populacji. */
  private share(deaths: number): number {
    if (deaths <= 0 || this.play.popBefore <= 0) return 0;
    const shown = Math.max(1, this.mine().length + this.newborns);
    const k = Math.round(shown * deaths / this.play.popBefore);
    return Math.max(1, Math.min(k, this.remaining.length));
  }
  private newborns = 0;

  private takeVictims(n: number): Agent[] {
    const out: Agent[] = [];
    for (let q = 0; q < n && this.remaining.length; q++) {
      const idx = Math.floor(this.st.rand() * this.remaining.length);
      out.push(this.remaining.splice(idx, 1)[0]);
    }
    return out;
  }

  private buildPhases() {
    const p = this.play, L = p.labels;
    const allDie = p.popAfter <= 0;

    this.phases.push({
      title: L.feed, sub: L.feedSub, tone: 'neutral', dur: 1.4,
      start: () => this.st.setFeeding(true),
      update: (u) => {
        if (Math.floor(u * 14) !== Math.floor((u - 0.02) * 14)) {
          const a = this.pick(); if (a) this.ring(a.x, a.y, 3, 12, 0.5, COLORS.good, 1.2);
        }
      }
    });

    if (p.predationDeaths > 0) {
      let victims: Agent[] = [], hunters: Agent[] = [], caught = 0;
      this.phases.push({
        title: L.predation, sub: '−' + p.predationDeaths, tone: 'bad', dur: 2,
        start: () => {
          this.st.setFeeding(false);
          victims = this.takeVictims(this.share(p.predationDeaths));
          hunters = this.st.agents.filter((a) => a.predator && !a.leaving);
          if (!hunters.length) { const t = this.st.spawnTempPredator(); if (t) { hunters = [t]; this.tempPreds.push(t); } }
          hunters.forEach((h) => { h.directed = true; });
        },
        update: (u) => {
          victims.forEach((v, i) => {
            if (v.doom) return;
            const h = hunters[i % Math.max(1, hunters.length)];
            if (h) { h.tx = v.x; h.ty = v.y; h.dash = 0.4; h.dashCool = 5; }
            const near = h ? Math.hypot(h.x - v.x, h.y - v.y) < 18 : true;
            if (near || u > 0.55 + 0.35 * (i / Math.max(1, victims.length))) {
              v.doom = { kind: 'caught', t: 0 };
              this.ring(v.x, v.y, 4, 22, 0.6, COLORS.bad, 2);
              if (caught++ === 0) this.float('−' + p.predationDeaths, v.x, v.y - 18, COLORS.bad);
            }
          });
          if (u > 0.98) hunters.forEach((h) => { h.directed = false; });
        }
      });
    }

    if (p.starvationDeaths > 0) {
      let victims: Agent[] = [];
      this.phases.push({
        title: L.starvation, sub: '−' + p.starvationDeaths, tone: 'bad', dur: 1.5,
        start: () => { this.st.setFeeding(false); victims = this.takeVictims(this.share(p.starvationDeaths)); },
        update: (u) => {
          victims.forEach((v, i) => {
            if (!v.doom && u > (i / Math.max(1, victims.length)) * 0.45) {
              v.doom = { kind: 'starve', t: 0 };
              if (i === 0) this.float('−' + p.starvationDeaths, v.x, v.y - 18, COLORS.starve);
            }
          });
        }
      });
    }

    if (p.births > 0 && !allDie) {
      let parents: Agent[] = [], k = 0, made = 0;
      this.phases.push({
        title: L.births, sub: '+' + p.births, tone: 'good', dur: 1.5,
        start: () => {
          this.st.setFeeding(false);
          parents = this.remaining.slice();
          const shown = Math.max(1, this.mine().length);
          k = Math.max(1, Math.min(8, Math.round(shown * p.births / Math.max(1, p.popBefore))));
        },
        update: (u) => {
          while (made < k && u > (made / k) * 0.6 && parents.length) {
            const par = parents[Math.floor(this.st.rand() * parents.length)];
            const a = this.st.spawnNewborn(p.lineageId, par.x + (this.st.rand() - 0.5) * 22, par.y + (this.st.rand() - 0.5) * 10);
            if (a) { this.remaining.push(a); this.newborns++; this.ring(a.x, a.y, 2, 16, 0.7, COLORS.good, 1.6); }
            if (made === 0) this.float('+' + p.births, par.x, par.y - 20, COLORS.good);
            made++;
          }
        }
      });
    }

    if (p.mutation) {
      const m = p.mutation;
      let who: Agent | null = null;
      this.phases.push({
        title: m.beneficial ? L.mutationGood : L.mutationBad, sub: m.text, tone: m.beneficial ? 'ep' : 'bad', dur: 1.6,
        start: () => {
          who = this.pick();
          if (who) {
            this.rings.push({ x: who.x, y: who.y, r0: 16, r1: 16, t: 0, dur: 1.6, color: m.beneficial ? COLORS.ep : COLORS.bad, width: 2.5, follow: who });
            this.float(m.text, who.x, who.y - 26, m.beneficial ? COLORS.ep : COLORS.bad, 13);
          }
        },
        update: (u) => { if (who && Math.floor(u * 6) !== Math.floor((u - 0.03) * 6)) this.ring(who.x, who.y, 6, 26, 0.6, m.beneficial ? COLORS.ep : COLORS.bad, 1.4); }
      });
    }

    if (p.catastrophe) {
      const c = p.catastrophe;
      let victims: Agent[] = [];
      const kind = c.kind;
      this.phases.push({
        title: c.name, sub: p.catDeaths > 0 ? '−' + p.catDeaths : '', tone: 'bad', dur: 3.3,
        start: () => {
          this.st.setFeeding(false);
          const n = allDie ? this.remaining.length : this.share(p.catDeaths);
          victims = this.takeVictims(n);
          if (kind === 'meteor') {
            const lay = this.st.lay;
            const x1 = this.st.W * (0.3 + this.st.rand() * 0.3);
            const y1 = lay.surfaceY > 0 ? lay.surfaceY : lay.floorY - 6;
            this.meteor = { x0: this.st.W + 40, y0: -40, x1, y1, u: 0 };
            this.haze.color = 0x5a4632;
          } else if (kind === 'ice') {
            this.haze.color = 0xcfe3f5; this.haze.target = 0.38; this.st.addWeather('snow', 110);
          } else {
            this.haze.color = 0x7a3a22; this.haze.target = 0.34; this.st.addWeather('ash', 90);
          }
        },
        update: (u, dt) => {
          if (kind === 'meteor' && this.meteor) {
            this.meteor.u = Math.min(1, u / 0.28);
            if (u >= 0.28 && this.flash === 0 && this.haze.target === 0) {
              this.flash = 1; this.shake = 1; this.haze.target = 0.42;
              const m = this.meteor;
              this.ring(m.x1, m.y1, 5, this.st.W * 0.9, 1.4, COLORS.white, 5);
              this.ring(m.x1, m.y1, 5, this.st.W * 0.6, 1.1, 0xf0c070, 3);
              victims.forEach((v) => {
                const dx = v.x - m.x1, dy = v.y - m.y1, d = Math.max(20, Math.hypot(dx, dy));
                v.doom = { kind: 'impact', t: -Math.min(0.5, d / 900) };
                v.vx = (dx / d) * 160; v.vy = (dy / d) * 80;
              });
              if (p.catDeaths > 0) this.float('−' + p.catDeaths, m.x1, m.y1 - 30, COLORS.bad, 20);
            }
          } else {
            if (kind === 'ice') this.frost = Math.min(1, u * 2);
            else this.glow = 0.5 + 0.5 * Math.sin(u * 20);
            victims.forEach((v, i) => {
              if (!v.doom && u > 0.2 + (i / Math.max(1, victims.length)) * 0.5) {
                v.doom = { kind: kind === 'ice' ? 'freeze' : 'ash', t: 0 };
                if (i === 0 && p.catDeaths > 0) this.float('−' + p.catDeaths, v.x, v.y - 20, COLORS.bad, 20);
              }
            });
          }
          void dt;
        }
      });
    }

    if (p.catastrophe && p.extinction) {
      const ex = p.extinction;
      // Cisza po katastrofie: scena szarzeje, a na środku pojawia się plansza z bilansem.
      this.phases.push({
        title: '', sub: '', tone: 'bad', dur: 3,
        start: () => {
          this.st.setFeeding(false);
          this.haze.color = 0x2a2622; this.haze.target = 0.58; this.frost = 0; this.glow = 0;
          const c = document.createElement('div');
          c.className = 'extinction-card'; c.setAttribute('role', 'status');
          const k = document.createElement('span'); k.className = 'extinction-kicker'; k.textContent = ex.kicker;
          const t = document.createElement('strong'); t.textContent = ex.title;
          const sb = document.createElement('span'); sb.className = 'extinction-sub'; sb.textContent = ex.sub;
          c.append(k, t, sb);
          this.st.host.append(c); this.card = c;
        },
        update: () => {}
      });
    }

    this.phases.push({ title: '', sub: '', tone: 'neutral', dur: 0.5, start: () => this.st.setFeeding(false), update: () => {} });
  }

  private pick(): Agent | null {
    const pool = this.remaining.filter((a) => !a.doom);
    return pool.length ? pool[Math.floor(this.st.rand() * pool.length)] : null;
  }

  // ------------------------------------------------------------------ pętla

  private next() {
    this.i++;
    this.t = 0;
    const ph = this.phases[this.i];
    if (!ph) { this.finish(); return; }
    const real = this.phases.length - 1; // bez fazy końcowej
    if (ph.title) {
      this.banner.className = 'turn-banner tone-' + ph.tone;
      this.banner.innerHTML = '<span class="turn-banner-step">' + (this.i + 1) + '/' + real + '</span>' +
        '<strong></strong>' + (ph.sub ? '<span class="turn-banner-sub"></span>' : '');
      (this.banner.querySelector('strong') as HTMLElement).textContent = ph.title;
      const sub = this.banner.querySelector('.turn-banner-sub'); if (sub) sub.textContent = ph.sub;
    } else this.banner.classList.add('turn-banner-out');
    ph.start();
  }

  update(dt: number) {
    if (this.done) return;
    const ph = this.phases[this.i];
    this.t += dt;
    ph.update(Math.min(1, this.t / ph.dur), dt);
    this.stepEffects(dt);
    if (this.t >= ph.dur) this.next();
  }

  private ring(x: number, y: number, r0: number, r1: number, dur: number, color: number, width: number) {
    this.rings.push({ x, y, r0, r1, t: 0, dur, color, width });
  }

  private float(text: string, x: number, y: number, color: number, size = 18) {
    const t = new Text({
      text,
      style: {
        fontFamily: '"Source Serif 4 Variable", Georgia, serif', fontSize: size, fontWeight: '700', fill: color,
        stroke: { color: this.st.theme.dark ? 0x161a17 : 0xfbf8f0, width: 4 }
      }
    });
    t.anchor.set(0.5);
    t.x = Math.max(30, Math.min(this.st.W - 30, x)); t.y = Math.max(16, y);
    this.st.texts.addChild(t);
    this.floaters.push({ t, life: 0 });
  }

  private stepEffects(dt: number) {
    const fx = this.st.fx, ov = this.st.overlay, W = this.st.W, H = this.st.H;
    fx.clear(); ov.clear();
    // pierścienie (żerowanie, schwytanie, narodziny, mutacja, fala uderzeniowa)
    this.rings = this.rings.filter((r) => {
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      if (r.follow) { r.x = r.follow.x; r.y = r.follow.y; }
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 2)) + (r.follow ? 3 * Math.sin(r.t * 8) : 0);
      fx.circle(r.x, r.y, rad).stroke({ width: r.width, color: r.color, alpha: r.follow ? 0.85 : 1 - k });
      return k < 1;
    });
    // nakładki: mgła/popiół/pył, błysk, szron, łuna
    this.haze.a += (this.haze.target - this.haze.a) * Math.min(1, dt * 1.5);
    if (this.haze.a > 0.01) ov.rect(0, 0, W, H).fill({ color: this.haze.color, alpha: this.haze.a });
    if (this.glow > 0) ov.rect(0, H * 0.55, W, H * 0.45).fill({ color: 0xe0602a, alpha: 0.12 * this.glow });
    if (this.frost > 0) {
      for (let q = 0; q < 6; q++) {
        const w = (6 - q) * 5 * this.frost;
        const a = 0.12 * this.frost;
        ov.rect(0, 0, W, w).fill({ color: 0xffffff, alpha: a });
        ov.rect(0, H - w, W, w).fill({ color: 0xffffff, alpha: a });
        ov.rect(0, 0, w, H).fill({ color: 0xffffff, alpha: a });
        ov.rect(W - w, 0, w, H).fill({ color: 0xffffff, alpha: a });
      }
    }
    if (this.meteor && this.meteor.u < 1) {
      const m = this.meteor, u = m.u;
      const x = m.x0 + (m.x1 - m.x0) * u, y = m.y0 + (m.y1 - m.y0) * u;
      for (let q = 0; q < 10; q++) {
        const b = Math.max(0, u - q * 0.025);
        const bx = m.x0 + (m.x1 - m.x0) * b, by = m.y0 + (m.y1 - m.y0) * b;
        ov.moveTo(x, y).lineTo(bx, by).stroke({ width: 8 - q * 0.6, color: q < 3 ? 0xfff0c0 : 0xe08040, alpha: 0.6 - q * 0.05 });
      }
      ov.circle(x, y, 6).fill({ color: 0xfff6d8 });
    }
    if (this.flash > 0) { ov.rect(0, 0, W, H).fill({ color: 0xffffff, alpha: this.flash * 0.85 }); this.flash = Math.max(0, this.flash - dt * 1.6); }
    if (this.shake > 0) {
      this.st.stage.position.set((this.st.rand() - 0.5) * 12 * this.shake, (this.st.rand() - 0.5) * 8 * this.shake);
      this.shake = Math.max(0, this.shake - dt * 1.4);
    } else this.st.stage.position.set(0, 0);
    // liczby unoszące się nad sceną
    this.floaters = this.floaters.filter((f) => {
      f.life += dt;
      f.t.y -= 16 * dt;
      f.t.alpha = f.life < 1 ? 1 : Math.max(0, 1 - (f.life - 1) / 0.7);
      if (f.life > 1.7) { f.t.destroy(); return false; }
      return true;
    });
  }

  /** Koniec albo pominięcie: scena od razu w stanie końcowym tury. */
  finish() {
    if (this.done) return;
    this.done = true;
    // dokończ los wszystkich wybranych ofiar i wzrost młodych
    this.phases.length = 0;
    this.st.agents.forEach((a) => {
      if (a.doom) { a.alpha = 0; a.leaving = true; }
      a.grow = 1; a.directed = false;
    });
    this.tempPreds.forEach((a) => { a.leaving = true; });
    this.st.setFeeding(false);
    this.st.fx.clear(); this.st.overlay.clear();
    this.st.stage.position.set(0, 0);
    this.floaters.forEach((f) => f.t.destroy()); this.floaters = [];
    document.removeEventListener('keydown', this.onKey);
    this.banner.remove(); this.skipBtn.remove();
    if (this.card) { this.card.remove(); this.card = null; }
    this.st.host.classList.remove('turn-playing');
    this.onDone();
  }
}
