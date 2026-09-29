/*
 * settings.ts — ustawienia grafiki (zapisywane lokalnie w przeglądarce).
 *
 * Jakość: automatyczna (wysoka z samoczynnym obniżaniem przy spadku płynności),
 * niska (diorama nieruchoma, bez animacji tury), średnia (animacja bez filtrów,
 * mniej cząstek), wysoka (pełna gęstość pikseli i efekty).
 * Animacja tury: pokazuj / pomijaj.
 * Parametr adresu ?renderer=webgl|canvas wymusza renderer (do testów).
 */
export type QualityLevel = 'auto' | 'low' | 'medium' | 'high';

export interface GraphicsSettings {
  quality: QualityLevel;
  turnAnimation: 'show' | 'skip';
  /** Paleta znaczeniowa: standardowa albo bezpieczna dla osób z zaburzeniami widzenia barw. */
  palette: 'standard' | 'cb';
}

/** Parametry dioramy wynikające z poziomu jakości. */
export interface QualityParams {
  level: Exclude<QualityLevel, 'auto'>;
  auto: boolean;
  /** Maks. gęstość pikseli (poniżej 1 = scena renderowana mniejsza i skalowana). */
  maxRes: number;
  /** Filtry WebGL (falowanie wody) i mieszanie addytywne. */
  effects: boolean;
  /** Mnożnik liczby cząstek (pokarm, śnieg, pył). */
  particles: number;
  maxAgents: number;
  /** false = scena nieruchoma (jedna klatka na zmianę stanu). */
  animate: boolean;
  /** Limit klatek na sekundę (0 = bez limitu) — oszczędza procesor. */
  maxFps: number;
  renderer: 'webgl' | 'canvas' | null;
}

const KEY = 'ewolucja.graphics';
const DEFAULTS: GraphicsSettings = { quality: 'auto', turnAnimation: 'show', palette: 'standard' };
type Listener = (s: GraphicsSettings) => void;
const listeners: Listener[] = [];

export function getSettings(): GraphicsSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') return { ...DEFAULTS, ...raw };
  } catch (e) { /* brak dostępu do localStorage */ }
  return { ...DEFAULTS };
}

/** Ustawia paletę na <html> (zmienne CSS w css/styles.css reagują na data-palette). */
export function applyPalette(s: GraphicsSettings = getSettings()) {
  document.documentElement.dataset.palette = s.palette === 'cb' ? 'cb' : 'standard';
}

export function setSettings(patch: Partial<GraphicsSettings>): GraphicsSettings {
  const next = { ...getSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* zapis niedostępny */ }
  applyPalette(next);
  listeners.forEach((fn) => fn(next));
  return next;
}

export function onSettingsChange(fn: Listener) { listeners.push(fn); }

export function qualityParams(s: GraphicsSettings = getSettings()): QualityParams {
  const forced = new URLSearchParams(location.search).get('renderer');
  const renderer = forced === 'webgl' || forced === 'canvas' ? forced : null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  switch (s.quality) {
    case 'low': return { level: 'low', auto: false, maxRes: 1, effects: false, particles: 0.4, maxAgents: 16, animate: false, maxFps: 0, renderer };
    case 'medium': return { level: 'medium', auto: false, maxRes: 0.75, effects: false, particles: 0.6, maxAgents: 22, animate: true, maxFps: 30, renderer };
    case 'high': return { level: 'high', auto: false, maxRes: dpr, effects: true, particles: 1, maxAgents: 34, animate: true, maxFps: 0, renderer };
    default: return { level: 'high', auto: true, maxRes: dpr, effects: true, particles: 1, maxAgents: 34, animate: true, maxFps: 0, renderer };
  }
}
