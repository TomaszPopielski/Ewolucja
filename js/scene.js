/*
 * scene.js — proceduralne, ilustracyjne tło środowiska tury.
 *
 * Zamiast pustego pola tekstowego, panel „Środowisko następnej tury" dostaje
 * proste SVG tło zależne od niszy aktywnej linii, klimatu i ewentualnej
 * katastrofy — czysta funkcja danych tury (bez DOM), w duchu „naukowo-
 * ilustracyjnego" stylu z ZALOZENIA.md §7.
 */
(function (root, factory) {
  var scene = factory();
  if (typeof module === 'object' && module.exports) module.exports = scene;
  else root.Scene = scene;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function skyColors(climate) {
    if (climate === 'zimno') return ['var(--scene-sky-cold-1)', 'var(--scene-sky-cold-2)'];
    if (climate === 'cieplo') return ['var(--scene-sky-warm-1)', 'var(--scene-sky-warm-2)'];
    return ['var(--scene-sky-mild-1)', 'var(--scene-sky-mild-2)'];
  }

  function sun(climate) {
    if (climate === 'zimno') return '<circle cx="168" cy="20" r="10" fill="var(--scene-sun)" opacity="0.55"/>';
    return '<circle cx="168" cy="18" r="13" fill="var(--scene-sun)"/>' +
      '<g stroke="var(--scene-sun)" stroke-width="2" opacity="0.6">' +
      '<line x1="168" y1="0" x2="168" y2="-4"/><line x1="150" y1="18" x2="146" y2="18"/></g>';
  }

  function waterLayer(oxygen) {
    var bubbles = Math.max(2, Math.min(9, Math.round((oxygen || 10) / 2)));
    var svg = '<path d="M0 58 C20 50 40 66 60 58 C80 50 100 66 120 58 C140 50 160 66 180 58 C190 55 196 56 200 58 V90 H0 Z" fill="var(--scene-water)"/>' +
      '<path d="M0 68 C25 62 45 74 70 68 C95 62 120 74 145 68 C165 63 185 70 200 68 V90 H0 Z" fill="var(--scene-water-deep)"/>';
    var bx = 20;
    for (var i = 0; i < bubbles; i++) { svg += '<circle cx="' + (bx) + '" cy="' + (80 - (i % 3) * 8) + '" r="1.6" fill="var(--scene-bubble)" opacity="0.6"/>'; bx += 18; }
    return svg;
  }

  function coastLayer() {
    return '<path d="M0 66 C30 58 60 70 90 64 C120 58 150 68 200 62 V90 H0 Z" fill="var(--scene-sand)"/>' + waterLayerNarrow();
  }
  function waterLayerNarrow() {
    return '<path d="M0 74 C30 68 60 78 90 72 C120 66 150 76 200 70 V90 H0 Z" fill="var(--scene-water)" opacity="0.85"/>';
  }

  function landLayer() {
    return '<path d="M0 62 C30 50 60 66 100 56 C140 46 170 62 200 54 V90 H0 Z" fill="var(--scene-ground)"/>' +
      tree(28, 54) + tree(70, 60) + tree(150, 52) + tree(184, 58);
  }
  function tree(x, y) {
    return '<g><line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y + 14) + '" stroke="var(--scene-trunk)" stroke-width="2.5"/>' +
      '<circle cx="' + x + '" cy="' + (y - 4) + '" r="7" fill="var(--scene-foliage)"/></g>';
  }

  function skyLayer() {
    return cloud(40, 20) + cloud(100, 14) + cloud(150, 30);
  }
  function cloud(x, y) {
    return '<g fill="var(--scene-cloud)" opacity="0.85"><ellipse cx="' + x + '" cy="' + y + '" rx="16" ry="8"/>' +
      '<ellipse cx="' + (x + 12) + '" cy="' + (y - 3) + '" rx="11" ry="7"/>' +
      '<ellipse cx="' + (x - 12) + '" cy="' + (y + 2) + '" rx="10" ry="6"/></g>';
  }

  function iceOverlay() {
    return '<path d="M0 0 H200 V16 C170 24 130 8 100 18 C70 26 30 6 0 16 Z" fill="var(--scene-ice)" opacity="0.65"/>';
  }

  function catastropheOverlay(cat) {
    if (!cat) return '';
    if (/asteroid|kredowe|K–Pg/i.test(cat.name)) {
      return '<line x1="196" y1="2" x2="120" y2="40" stroke="var(--scene-meteor)" stroke-width="4" stroke-linecap="round"/>' +
        '<circle cx="118" cy="42" r="6" fill="var(--scene-meteor)"/>' +
        '<rect x="0" y="0" width="200" height="90" fill="var(--scene-danger-tint)" opacity="0.18"/>';
    }
    return '<rect x="0" y="0" width="200" height="90" fill="var(--scene-danger-tint)" opacity="0.16"/>';
  }

  function svg(env, niche) {
    if (!env) return '';
    var sky = skyColors(env.climate);
    var body;
    if (niche === 'lad') body = landLayer();
    else if (niche === 'powietrze') body = skyLayer();
    else if (niche === 'przybrzeze') body = coastLayer();
    else body = waterLayer(env.oxygen);

    var svgStr = '<svg class="env-scene-svg" viewBox="0 0 200 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect x="0" y="0" width="200" height="90" fill="' + sky[0] + '"/>' +
      '<rect x="0" y="40" width="200" height="50" fill="' + sky[1] + '" opacity="0.5"/>' +
      sun(env.climate) + body +
      (env.climate === 'zimno' ? iceOverlay() : '') +
      catastropheOverlay(env.catastrophe) +
      '</svg>';
    return svgStr;
  }

  return { svg: svg };
});
