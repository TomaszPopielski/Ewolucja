/*
 * register.ts — udostępnia warstwę graficzną modułom js/ (UI w ES5).
 *
 * Musi być zaimportowany w main.ts PRZED js/ui.js, bo UI przy starcie
 * sięga po self.GameArt. Gdy go brak, UI pokazuje zapasowe znaki.
 */
import { icon, hasIcon, iconKeys } from './icons.ts';
import { Portrait, readTheme, type PortraitUpdate } from '../creature/portrait.ts';
import type { Diorama, DioramaData } from '../diorama/diorama.ts';
import type { TurnPlay } from '../diorama/turnplay.ts';
import { getSettings, setSettings, onSettingsChange, applyPalette, qualityParams, type GraphicsSettings } from './settings.ts';
import type { LineageLike } from '../creature/spec.ts';
import { creatureThumb } from '../creature/thumb.ts';

export interface GameArtApi {
  icon: (key: string, extraClass?: string) => string;
  hasIcon: (key: string) => boolean;
  iconKeys: () => string[];
  /** Żywy portret zwierzęcia w podanym kontenerze. */
  portrait: {
    update: (host: HTMLElement, lineage: LineageLike, opts?: PortraitUpdate) => void;
    preview: (host: HTMLElement, traitId: string | null) => void;
  };
  /** Miniatura zwierzęcia (data URL PNG) — drzewo życia, ekrany startowy i końcowy. */
  creature: {
    thumb: (lineage: LineageLike, width: number, height: number) => string;
  };
  /** Ustawienia grafiki (jakość, animacja tury) — zapisywane lokalnie. */
  settings: {
    get: () => GraphicsSettings;
    set: (patch: Partial<GraphicsSettings>) => GraphicsSettings;
    /** Faktyczny renderer dioramy (webgl/canvas) albo null. */
    renderer: () => string | null;
  };
  /** Żywa diorama środowiska; gdy nie da się jej narysować, kontener dostaje klasę .diorama-off. */
  diorama: {
    update: (host: HTMLElement, data: DioramaData) => void;
    /** Czy diorama w ogóle animuje (jakość, ograniczenie ruchu). */
    canAnimate: (host: HTMLElement) => boolean;
    /** Czy diorama może teraz odegrać animację tury. */
    canPlay: (host: HTMLElement) => boolean;
    /** Animacja przebiegu tury; obietnica spełnia się po końcu lub pominięciu. */
    playTurn: (host: HTMLElement, play: TurnPlay) => Promise<void>;
  };
}

declare global {
  interface Window { GameArt?: GameArtApi }
}

const portraits = new WeakMap<HTMLElement, Portrait>();
function portraitFor(host: HTMLElement): Portrait | null {
  let p = portraits.get(host);
  if (!p) {
    try { p = new Portrait(host); } catch (e) { return null; }
    portraits.set(host, p);
  }
  return p;
}

// Diorama ładuje się leniwie (PixiJS inicjuje się asynchronicznie);
// do czasu gotowości pamiętamy tylko najnowsze dane.
interface DioramaSlot { d: Diorama | null; pending: DioramaData | null; last: DioramaData | null; failed: boolean; loading: boolean }
const dioramas = new Map<HTMLElement, DioramaSlot>();

function createDiorama(host: HTMLElement, slot: DioramaSlot) {
  slot.loading = true;
  import('../diorama/diorama.ts').then(async ({ Diorama }) => {
    const d = await Diorama.create(host, readTheme(), host.clientHeight || 220, qualityParams());
    slot.loading = false;
    if (!d) { slot.failed = true; host.classList.add('diorama-off'); return; }
    host.classList.remove('diorama-off');
    slot.d = d;
    const data = slot.pending || slot.last;
    if (data) { d.update(data); slot.last = data; slot.pending = null; }
  }).catch(() => { slot.loading = false; slot.failed = true; host.classList.add('diorama-off'); });
}

function dioramaUpdate(host: HTMLElement, data: DioramaData) {
  let slot = dioramas.get(host);
  if (!slot) {
    slot = { d: null, pending: null, last: null, failed: false, loading: false };
    dioramas.set(host, slot);
    slot.pending = data;
    createDiorama(host, slot);
    return;
  }
  if (slot.d) { slot.d.update(data); slot.last = data; } else slot.pending = data;
}

// Zmiana motywu lub jakości → dioramy odtwarzane z ostatnimi danymi.
function rebuildDioramas() {
  dioramas.forEach((slot, host) => {
    if (slot.loading) return;
    if (slot.d) { slot.d.destroy(); slot.d = null; }
    slot.failed = false;
    createDiorama(host, slot);
  });
}
applyPalette();
onSettingsChange(rebuildDioramas);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', rebuildDioramas);

const api: GameArtApi = {
  icon, hasIcon, iconKeys,
  portrait: {
    update: (host, lineage, opts) => { portraitFor(host)?.update(lineage, opts); },
    preview: (host, traitId) => { portraitFor(host)?.preview(traitId); }
  },
  settings: {
    get: getSettings,
    set: setSettings,
    renderer: () => { for (const slot of dioramas.values()) if (slot.d) return slot.d.rendererName(); return null; }
  },
  creature: {
    thumb: (lineage, width, height) => { try { return creatureThumb(lineage, { width, height }); } catch (e) { return ''; } }
  },
  diorama: {
    update: dioramaUpdate,
    canAnimate: (host) => { const d = dioramas.get(host)?.d; return !!d && d.canAnimate(); },
    canPlay: (host) => { const d = dioramas.get(host)?.d; return !!d && d.canPlay(); },
    playTurn: (host, play) => { const d = dioramas.get(host)?.d; return d ? d.playTurn(play) : Promise.resolve(); }
  }
};
self.GameArt = api;
