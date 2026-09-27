/*
 * register.ts — udostępnia warstwę graficzną modułom js/ (UI w ES5).
 *
 * Musi być zaimportowany w main.ts PRZED js/ui.js, bo UI przy starcie
 * sięga po self.GameArt. Gdy go brak, UI pokazuje zapasowe znaki.
 */
import { icon, hasIcon, iconKeys } from './icons.ts';
import { Portrait, type PortraitUpdate } from '../creature/portrait.ts';
import type { LineageLike } from '../creature/spec.ts';

export interface GameArtApi {
  icon: (key: string, extraClass?: string) => string;
  hasIcon: (key: string) => boolean;
  iconKeys: () => string[];
  /** Żywy portret zwierzęcia w podanym kontenerze. */
  portrait: {
    update: (host: HTMLElement, lineage: LineageLike, opts?: PortraitUpdate) => void;
    preview: (host: HTMLElement, traitId: string | null) => void;
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

const api: GameArtApi = {
  icon, hasIcon, iconKeys,
  portrait: {
    update: (host, lineage, opts) => { portraitFor(host)?.update(lineage, opts); },
    preview: (host, traitId) => { portraitFor(host)?.preview(traitId); }
  }
};
self.GameArt = api;
