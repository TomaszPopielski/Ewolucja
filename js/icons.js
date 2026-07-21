/*
 * icons.js — spójny zestaw ikon liniowych SVG (zamiast emoji).
 *
 * Emoji renderują się różnie zależnie od systemu/przeglądarki, co jest
 * problematyczne na tablicy multimedialnej (ZALOZENIA.md §7 — czytelność).
 * Ten moduł dostarcza jeden, spójny styl ikon (linie, currentColor), łatwo
 * kolorowany przez CSS i niezależny od czcionek systemowych.
 *
 * Format definicji: tablica „kształtów" renderowanych do prostych elementów SVG
 * we wspólnym viewBox 0 0 24 24. Klucze kształtu:
 *   p  — <path d="...">              (obrys, stroke)
 *   pf — <path d="..." fill>          (wypełniony kształt, bez obrysu)
 *   c  — [cx, cy, r]                  (okrąg, obrys)
 *   cf — [cx, cy, r]                  (okrąg wypełniony)
 *   e  — [cx, cy, rx, ry]             (elipsa, obrys)
 *   l  — [x1, y1, x2, y2]             (linia)
 *   rect — [x, y, w, h, rx]           (prostokąt, obrys)
 */
(function (root, factory) {
  var icons = factory();
  if (typeof module === 'object' && module.exports) module.exports = icons;
  else root.Icons = icons;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFS = {
    dot: [{ cf: [12, 12, 3] }],

    // --- Kategorie cech ---
    fork: [{ l: [8, 3, 8, 10] }, { l: [12, 3, 12, 10] }, { l: [16, 3, 16, 10] },
      { p: 'M8 10 Q8 13 12 13 Q16 13 16 10' }, { l: [12, 13, 12, 21] }],
    footprint: [{ e: [12, 15, 4, 5] }, { cf: [8, 9, 1.1] }, { cf: [11, 6.5, 1.2] }, { cf: [14.5, 6.5, 1.2] }, { cf: [17.5, 9, 1.1] }],
    shield: [{ p: 'M12 3 L19 6 V11 C19 16 16 20 12 21 C8 20 5 16 5 11 V6 Z' }],
    eye: [{ p: 'M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z' }, { cf: [12, 12, 2.3] }],
    egg: [{ e: [12, 13, 5, 7] }],
    thermometer: [{ rect: [10, 3, 4, 12, 2] }, { c: [12, 18, 4] }, { l: [12, 8, 12, 16] }],
    brain: [{ p: 'M8 4 C5 4 3 6.3 3 9 C3 10 3.3 10.8 3.9 11.4 C3.1 12.1 3 13.5 3.9 14.6 C3.4 16.1 4.4 17.9 6.8 18.4 C7.8 20 9.8 21 12 20.2 C14.2 21 16.2 20 17.2 18.4 C19.6 17.9 20.6 16.1 20.1 14.6 C21 13.5 20.9 12.1 20.1 11.4 C20.7 10.8 21 10 21 9 C21 6.3 19 4 16 4 C15 3 13 3 12 4 C11 3 9 3 8 4 Z' },
      { l: [12, 4, 12, 20] }, { p: 'M8 8 Q10.5 10 8.3 13.2' }, { p: 'M16 8 Q13.5 10 15.7 13.2' }],

    // --- Nisze ---
    wave: [{ p: 'M2 9.5 C5 6.5 7 6.5 10 9.5 C13 12.5 15 12.5 18 9.5 C19 8.5 20 8 22 8.5' },
      { p: 'M2 15.5 C5 12.5 7 12.5 10 15.5 C13 18.5 15 18.5 18 15.5 C19 14.5 20 14 22 14.5' }],
    shell: [{ p: 'M12 3 C6.5 3 3 9 3 14 L21 14 C21 9 17.5 3 12 3 Z' },
      { l: [12, 14, 12, 4] }, { l: [8, 14, 9, 6] }, { l: [16, 14, 15, 6] }],
    mountain: [{ p: 'M2 19 L9 7 L13 13 L16 9 L22 19 Z' }],
    cloud: [{ p: 'M6.5 16 a4 4 0 0 1 -0.4 -8 a5 5 0 0 1 9.7 -1.6 A4.4 4.4 0 0 1 18.5 16 Z' }],

    // --- Cechy (24) ---
    droplet: [{ p: 'M12 3 C12 3 5.3 11.2 5.3 15.6 a6.7 6.7 0 0 0 13.4 0 C18.7 11.2 12 3 12 3 Z' }],
    teeth: [{ p: 'M3 8.5 L7 13.5 L11 8.5 L15 13.5 L19 8.5 L21 10.5' }],
    omni: [{ c: [8.5, 12, 4.2] }, { c: [15.5, 12, 4.2] }, { l: [12.3, 8.6, 12.3, 15.4] }],
    fin: [{ p: 'M4 16 C7.5 4.5 16 4.5 20 10.5 C14 12.5 8 16.5 4 16 Z' }],
    bolt: [{ pf: 'M13 2 L5 14 H11 L9 22 L19 9 H13 Z' }],
    leg: [{ p: 'M9.5 3 V12 C9.5 15 6.5 15 6.5 18.5' }, { l: [6.5, 18.5, 12, 18.5] }, { l: [9.5, 12, 13, 12] }],
    wing: [{ p: 'M2 14.5 C7 6.5 13 5.5 22 9 C16 9.3 12.5 12 9.7 17 C9 13.3 6 12 2 14.5 Z' }],
    hand: [{ p: 'M8 13 V6.3 a1.4 1.4 0 0 1 2.8 0 V11' }, { p: 'M10.8 6 a1.4 1.4 0 0 1 2.8 0 V11' },
      { p: 'M13.6 6.7 a1.4 1.4 0 0 1 2.8 0 V11.5' }, { p: 'M16.4 8.7 a1.2 1.2 0 0 1 2.4 0 V13.5' },
      { p: 'M18.8 10.5 C19.4 15.5 16.5 20 12.3 20.5 C8.5 21 6 18 6 14.5 V12' }],
    scales: [{ p: 'M3.5 8 a4.2 4.2 0 0 1 8.4 0' }, { p: 'M12.1 8 a4.2 4.2 0 0 1 8.4 0' },
      { p: 'M3.5 14.5 a4.2 4.2 0 0 1 8.4 0' }, { p: 'M12.1 14.5 a4.2 4.2 0 0 1 8.4 0' }],
    dome: [{ p: 'M3 16.5 C3 8.5 8.5 4 12 4 C15.5 4 21 8.5 21 16.5 Z' }, { l: [3, 16.5, 21, 16.5] }],
    mask: [{ p: 'M3 10 C3 6 8 4 12 4 C16 4 21 6 21 10 C21 15 17 19.5 12 19.5 C7 19.5 3 15 3 10 Z' },
      { cf: [9, 10, 1.2] }, { cf: [15, 10, 1.2] }],
    zigzagLine: [{ p: 'M2 12 C5 6.5 8.5 6.5 11.5 12 C14.5 17.5 18 17.5 22 12' }, { cf: [7, 8.8, 1] }, { cf: [17, 15.2, 1] }],
    eggs3: [{ e: [7.5, 15, 3, 4] }, { e: [16.5, 15, 3, 4] }, { e: [12, 8.5, 3, 4] }],
    eggRing: [{ e: [12, 13, 5, 7] }, { p: 'M6.3 9.5 a7 9 0 0 1 11.4 0' }],
    nest: [{ p: 'M3 15 C3 12 6 10 12 10 C18 10 21 12 21 15 C21 17.5 17 19 12 19 C7 19 3 17.5 3 15 Z' },
      { e: [9.5, 14.5, 1.8, 2.4] }, { e: [14.5, 14.5, 1.8, 2.4] }],
    flame: [{ p: 'M12 2 C9 6 6 9.3 6 13.3 a6 6 0 0 0 12 0 C18 9.3 15 6 12 2 Z' },
      { p: 'M12 10.5 C10.6 12.4 10 14 10 15.4 a2 2 0 0 0 4 0 C14 14 13.4 12.4 12 10.5 Z' }],
    feather: [{ p: 'M12 2 C12 8 9 9 8 14 C7 18 9 21 12 22 C12 16 15 15 16 11 C17 7 14 4 12 2 Z' }, { l: [12, 3, 12, 21] }],
    ganglia: [{ c: [6, 7, 1.5] }, { c: [18, 7, 1.5] }, { c: [6, 17, 1.5] }, { c: [18, 17, 1.5] }, { c: [12, 12, 2.1] },
      { l: [12, 12, 6.6, 7.8] }, { l: [12, 12, 17.4, 7.8] }, { l: [12, 12, 6.6, 16.2] }, { l: [12, 12, 17.4, 16.2] }],
    wolves: [{ p: 'M4 16.5 L7.5 8 L11 16.5 Z' }, { p: 'M13 16.5 L16.5 8 L20 16.5 Z' }],
    brainPlus: [{ p: 'M8 4 C5 4 3 6.3 3 9 C3 10 3.3 10.8 3.9 11.4 C3.1 12.1 3 13.5 3.9 14.6 C3.4 16.1 4.4 17.9 6.8 18.4 C7.8 20 9.8 21 12 20.2 C14.2 21 16.2 20 17.2 18.4 C19.6 17.9 20.6 16.1 20.1 14.6 C21 13.5 20.9 12.1 20.1 11.4 C20.7 10.8 21 10 21 9 C21 6.3 19 4 16 4 C15 3 13 3 12 4 C11 3 9 3 8 4 Z' },
      { l: [12, 4, 12, 20] }, { l: [20, 2, 20, 6] }, { l: [18, 4, 22, 4] }],
    people: [{ c: [7.5, 8, 2.6] }, { p: 'M3 20 C3 15.5 12 15.5 12 20' }, { c: [16.5, 8, 2.6] }, { p: 'M12 20 C12 15.5 21 15.5 21 20' }],
    axe: [{ l: [6, 21, 14.5, 12.5] }, { p: 'M13.5 6 C16.5 3.7 20.3 4.7 21.3 7.7 C19 9.8 15.7 10.8 12.7 11.8 C11.7 9.5 11.7 7.5 13.5 6 Z' }],

    // --- Status / UI ---
    lock: [{ p: 'M7 11 V8 a5 5 0 0 1 10 0 V11' }, { rect: [5, 11, 14, 10, 2] }],
    hourglass: [{ l: [6, 3, 18, 3] }, { l: [6, 21, 18, 21] },
      { p: 'M6 3 C6 9 12 10 12 12 C12 14 6 15 6 21' }, { p: 'M18 3 C18 9 12 10 12 12 C12 14 18 15 18 21' }],
    check: [{ p: 'M4 13 L10 19 L20 6' }],
    star: [{ p: 'M12 2 L14.7 8.6 L22 9.3 L16.5 14 L18.2 21 L12 17.3 L5.8 21 L7.5 14 L2 9.3 L9.3 8.6 Z' }],
    warning: [{ p: 'M12 3 L22 20 H2 Z' }, { l: [12, 9, 12, 14.5] }, { cf: [12, 17, 0.9] }],
    meteor: [{ pf: 'M14 2 L4 14 H10 L8 22 L20 9 H13 Z' }, { cf: [4, 4, 0.9] }, { cf: [7, 7, 0.6] }],
    clover: [{ c: [9, 9, 3.1] }, { c: [15, 9, 3.1] }, { c: [12, 15, 3.1] }, { l: [12, 15, 12, 21] }],
    trophy: [{ p: 'M7 4 H17 V8.5 C17 12.5 15 14 12 14 C9 14 7 12.5 7 8.5 Z' },
      { p: 'M7 5 C4 5 4 9 7 9.3' }, { p: 'M17 5 C20 5 20 9 17 9.3' },
      { rect: [11, 14, 2, 3, 0] }, { rect: [8, 18, 8, 2, 1] }],
    bone: [{ rect: [5, 11, 14, 2.2, 1] }, { c: [5, 12, 2.1] }, { c: [19, 12, 2.1] }],
    paw: [{ c: [12, 15.5, 3.2] }, { cf: [6.8, 9.5, 1.5] }, { cf: [10.6, 6.8, 1.6] }, { cf: [15, 6.8, 1.6] }, { cf: [18.4, 9.5, 1.5] }],
    compass: [{ c: [12, 12, 9] }, { pf: 'M16 8 L12.8 12.8 L8 16 L11.2 11.2 Z' }, { cf: [12, 12, 1] }],
    tree: [{ c: [12, 8, 6] }, { rect: [11, 14, 2, 7, 0] }],
    book: [{ rect: [4, 4, 16, 16, 2] }, { l: [12, 4, 12, 20] }, { l: [7, 8, 10, 8] }, { l: [14, 8, 17, 8] }, { l: [7, 12, 10, 12] }, { l: [14, 12, 17, 12] }],
    download: [{ l: [12, 3, 12, 14.5] }, { p: 'M7 10 L12 15 L17 10' }, { l: [5, 20, 19, 20] }],
    copy: [{ rect: [8, 8, 12, 12, 2] }, { rect: [4, 4, 12, 12, 2] }],
    undo: [{ p: 'M4 12 H16 a5 5 0 1 1 -5 5' }, { p: 'M9 7 L4 12 L9 17' }],
    close: [{ l: [6, 6, 18, 18] }, { l: [18, 6, 6, 18] }],
    dna: [{ p: 'M7 3 C7 8 17 8 17 13 C17 18 7 18 7 21' }, { l: [7.6, 6.3, 16.4, 6.3] }, { l: [7.3, 12, 16.7, 12] }, { l: [7.6, 17.7, 16.4, 17.7] }],
    speciesTag: [{ c: [12, 9, 4.5] }, { p: 'M4.5 21 C4.5 15.5 19.5 15.5 19.5 21' }],

    sun: [{ c: [12, 12, 4.2] }, { l: [12, 2, 12, 5] }, { l: [12, 19, 12, 22] }, { l: [2, 12, 5, 12] }, { l: [19, 12, 22, 12] },
      { l: [4.9, 4.9, 6.9, 6.9] }, { l: [17.1, 17.1, 19.1, 19.1] }, { l: [4.9, 19.1, 6.9, 17.1] }, { l: [17.1, 6.9, 19.1, 4.9] }],
    snow: [{ l: [12, 3, 12, 21] }, { l: [4.3, 7, 19.7, 17] }, { l: [19.7, 7, 4.3, 17] }],
    balance: [{ l: [12, 3, 12, 20] }, { l: [5, 7, 19, 7] }, { p: 'M5 7 L3 12.3 a3.1 3.1 0 0 0 6.2 0 Z' },
      { p: 'M19 7 L17 12.3 a3.1 3.1 0 0 0 6.2 0 Z' }, { l: [8, 20, 16, 20] }],
    landmark: [{ p: 'M4 10 L12 4 L20 10 Z' }, { rect: [5, 10, 2, 9, 0] }, { rect: [11, 10, 2, 9, 0] }, { rect: [17, 10, 2, 9, 0] }, { l: [3, 20.5, 21, 20.5] }],
    bulb: [{ c: [12, 10, 6] }, { l: [9.5, 18, 14.5, 18] }, { l: [10, 21, 14, 21] }, { l: [12, 4, 12, 2] }],
    branch: [{ l: [12, 21, 12, 11] }, { p: 'M12 11 C12 7 8.5 7 6.5 3.5' }, { p: 'M12 11 C12 7 15.5 7 17.5 3.5' }],
    predator: [{ p: 'M6 3 L9 10.5 L3 10.5 Z' }, { p: 'M18 3 L21 10.5 L15 10.5 Z' }, { c: [12, 15, 4.5] }, { cf: [12, 15, 1.1] }]
  };

  var CATEGORY_ICON = {
    pokarm: 'fork', lokomocja: 'footprint', obrona: 'shield', zmysly: 'eye',
    rozrod: 'egg', termoregulacja: 'thermometer', uklad_nerwowy: 'brain'
  };
  var NICHE_ICON = { woda: 'wave', przybrzeze: 'shell', lad: 'mountain', powietrze: 'cloud' };
  var TRAIT_ICON = {
    filter_feeding: 'droplet', jaws: 'teeth', omnivory: 'omni',
    fins: 'fin', fast_muscle: 'bolt', limbs: 'leg', flight: 'wing', grasping_hand: 'hand',
    scales: 'scales', shell: 'dome', camouflage: 'mask',
    eyes: 'eye', lateral_line: 'zigzagLine',
    many_eggs: 'eggs3', amniotic_egg: 'eggRing', parental_care: 'nest',
    endothermy: 'flame', insulation: 'feather',
    ganglia: 'ganglia', brain: 'brain', pack_hunting: 'wolves', big_brain: 'brainPlus',
    social: 'people', tool_use: 'axe'
  };

  function shapeMarkup(s) {
    if (s.c) return '<circle cx="' + s.c[0] + '" cy="' + s.c[1] + '" r="' + s.c[2] + '"/>';
    if (s.cf) return '<circle cx="' + s.cf[0] + '" cy="' + s.cf[1] + '" r="' + s.cf[2] + '" fill="currentColor" stroke="none"/>';
    if (s.e) return '<ellipse cx="' + s.e[0] + '" cy="' + s.e[1] + '" rx="' + s.e[2] + '" ry="' + s.e[3] + '"/>';
    if (s.l) return '<line x1="' + s.l[0] + '" y1="' + s.l[1] + '" x2="' + s.l[2] + '" y2="' + s.l[3] + '"/>';
    if (s.rect) return '<rect x="' + s.rect[0] + '" y="' + s.rect[1] + '" width="' + s.rect[2] + '" height="' + s.rect[3] + '" rx="' + (s.rect[4] || 0) + '"/>';
    if (s.pf) return '<path d="' + s.pf + '" fill="currentColor" stroke="none"/>';
    if (s.p) return '<path d="' + s.p + '"/>';
    return '';
  }

  function svg(name, opts) {
    opts = opts || {};
    var size = opts.size || 18;
    var def = DEFS[name] || DEFS.dot;
    var body = def.map(shapeMarkup).join('');
    return '<svg class="icon-svg" viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body + '</svg>';
  }

  function span(name, opts) {
    opts = opts || {};
    var cls = 'icon' + (opts.cls ? ' ' + opts.cls : '');
    return '<span class="' + cls + '">' + svg(name, opts) + '</span>';
  }

  function forCategory(key) { return CATEGORY_ICON[key] || 'dot'; }
  function forNiche(key) { return NICHE_ICON[key] || 'wave'; }
  function forTrait(id) { return TRAIT_ICON[id] || 'dot'; }

  return {
    svg: svg, span: span,
    forCategory: forCategory, forNiche: forNiche, forTrait: forTrait,
    categorySpan: function (key, opts) { return span(forCategory(key), opts); },
    nicheSpan: function (key, opts) { return span(forNiche(key), opts); },
    traitSpan: function (id, opts) { return span(forTrait(id), opts); }
  };
});
