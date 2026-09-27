/*
 * main.ts — punkt wejścia aplikacji (Vite).
 *
 * Istniejące moduły gry (i18n, dane, silnik, UI) ładujemy bez zmian, w tej
 * samej kolejności co dawniej tagi <script>: każdy rejestruje się w `self`
 * (GameI18n, GameData, Engine), a ui.js startuje po załadowaniu DOM.
 * Nowy kod — warstwa graficzna — powstaje obok, w TypeScripcie (src/).
 */
import './fonts.css';
import './art/register';
import '../js/i18n.js';
import '../js/data.js';
import '../js/engine.js';
import '../js/ui.js';
