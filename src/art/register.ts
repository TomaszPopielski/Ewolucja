/*
 * register.ts — udostępnia warstwę graficzną modułom js/ (UI w ES5).
 *
 * Musi być zaimportowany w main.ts PRZED js/ui.js, bo UI przy starcie
 * sięga po self.GameArt. Gdy go brak, UI pokazuje zapasowe znaki.
 */
import { icon, hasIcon, iconKeys } from './icons';

export interface GameArtApi {
  icon: (key: string, extraClass?: string) => string;
  hasIcon: (key: string) => boolean;
  iconKeys: () => string[];
}

declare global {
  interface Window { GameArt?: GameArtApi }
}

const api: GameArtApi = { icon, hasIcon, iconKeys };
self.GameArt = api;
