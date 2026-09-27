import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/*
 * Moduły gry w js/ mają opakowanie UMD: w Node eksportują przez module.exports
 * (testy), w przeglądarce rejestrują się w `self` (GameData, Engine, GameI18n).
 * Bundler widząc `module.exports` potraktowałby je jak CommonJS i nic nie
 * trafiłoby do `self`. Wyłączamy więc gałąź Node w locie — pliki źródłowe
 * zostają bez zmian i nadal działają w testach.
 */
function legacyGlobals(): Plugin {
  const NODE_BRANCH = "typeof module === 'object' && module.exports";
  return {
    name: 'ewolucja-legacy-globals',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]js[\\/][^\\/]+\.js$/.test(id) || !code.includes(NODE_BRANCH)) return null;
      return { code: code.replace(NODE_BRANCH, 'false'), map: null };
    }
  };
}

/*
 * PixiJS w wersji „odchudzonej”: diorama używa tylko rendererów WebGL i Canvas
 * i nie potrzebuje rozszerzeń przeglądarkowych (dostępność, zdarzenia, DOM).
 * Te moduły są ładowane dynamicznie, ale przy budowie do jednego pliku i tak
 * trafiłyby do paczki — podmieniamy je na puste zaślepki (~90 KB mniej).
 * Diorama rejestruje potrzebny system filtrów sama (import 'pixi.js/filters')
 * i tworzy aplikację z opcją skipExtensionImports.
 */
function pixiSlim(): Plugin {
  const STUBS: [RegExp, string][] = [
    [/pixi\.js[\\/]lib[\\/]rendering[\\/]renderers[\\/]gpu[\\/]WebGPURenderer\.mjs$/,
      'export class WebGPURenderer { constructor() { throw new Error("WebGPU wyłączony w tej grze"); } }'],
    [/pixi\.js[\\/]lib[\\/]environment-browser[\\/]browserAll\.mjs$/, 'export {};']
  ];
  return {
    name: 'ewolucja-pixi-slim',
    enforce: 'pre',
    load(id) {
      for (const [re, code] of STUBS) if (re.test(id)) return code;
      return null;
    }
  };
}

// Budowanie do JEDNEGO pliku dist/index.html (JS i CSS wklejone inline),
// żeby gra dalej otwierała się dwuklikiem, offline, bez serwera.
export default defineConfig({
  base: './',
  plugins: [legacyGlobals(), pixiSlim(), viteSingleFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019'
  }
});
