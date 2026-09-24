/*
 * art.js — warstwa graficzna (czyste funkcje zwracające SVG jako tekst).
 *
 * Własny, spójny zestaw ikon (zamiast emoji, które wyglądają różnie w różnych
 * systemach), portret gatunku składany z cech, scena ekosystemu z niszami,
 * wykresy (populacja, radar statystyk), drzewo życia i mapa zależności cech.
 * Moduł nie dotyka DOM — UI wstawia wynik do strony.
 */
(function (root, factory) {
  var art = factory();
  if (typeof module === 'object' && module.exports) module.exports = art;
  else root.Art = art;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function r1(v) { return Math.round(v * 10) / 10; }

  // ====================== Ikony (24×24, obrys w currentColor) ======================
  var ICONS = {
    // cechy
    filter_feeding: '<path d="M12 3c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10z"/><path d="M9.5 14h5M10.5 17h3"/>',
    jaws: '<path d="M3 9c3-4 15-4 18 0l-3 1.2-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2z"/><path d="M4 15c3 4 13 4 16 0l-3-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2z"/>',
    omnivory: '<path d="M4 20c0-8 5-13 12-13 0 7-5 12-12 13z"/><path d="M4 20l7-7"/><circle cx="18" cy="17" r="2.5"/>',
    fins: '<path d="M3 12c3-5 9-6 13-2 1 1 1 3 0 4-4 4-10 3-13-2z"/><path d="M16 12l5-4v8z"/><circle cx="7" cy="11" r="1"/>',
    fast_muscle: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
    limbs: '<path d="M12 21v-7M12 14l-5-5M12 14l5-5M12 14V6M7 9l-2.5-1M17 9l2.5-1M12 6V3"/>',
    flight: '<path d="M2 14c5-1 9-5 11-10 1 4 4 7 9 8-5 2-9 3-12 7-2-3-5-4-8-5z"/>',
    grasping_hand: '<path d="M7 12V5.5a1.5 1.5 0 0 1 3 0V11M10 10.5V4a1.5 1.5 0 0 1 3 0v6.5M13 10.5V5a1.5 1.5 0 0 1 3 0v6.5M16 11.5a1.5 1.5 0 0 1 3 0V14c0 4-3 7-7 7-3 0-5-1.5-6.5-4.5L4 13a1.5 1.5 0 0 1 2.6-1.4L7 12.5"/>',
    scales: '<path d="M3 9a3 3 0 0 1 6 0 3 3 0 0 1 6 0 3 3 0 0 1 6 0M6 14a3 3 0 0 1 6 0 3 3 0 0 1 6 0M3 19a3 3 0 0 1 6 0 3 3 0 0 1 6 0 3 3 0 0 1 6 0"/>',
    shell: '<path d="M3 17c0-6 4-10 9-10s9 4 9 10z"/><path d="M8 17l1-5h6l1 5M9 12l3-3 3 3"/>',
    camouflage: '<path d="M4 20c0-9 6-15 16-16 0 10-6 16-16 16z"/><circle cx="13" cy="11" r="2"/>',
    eyes: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lateral_line: '<path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
    many_eggs: '<circle cx="7" cy="15" r="3.5"/><circle cx="16.5" cy="15" r="3.5"/><circle cx="11.8" cy="7.5" r="3.5"/>',
    amniotic_egg: '<path d="M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z"/><circle cx="12" cy="14" r="3"/>',
    parental_care: '<circle cx="8" cy="6" r="2.5"/><path d="M4 21v-6a4 4 0 0 1 8 0v6"/><circle cx="17" cy="12" r="2"/><path d="M14 21v-3a3 3 0 0 1 6 0v3"/>',
    endothermy: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-7 1 2 2 3 3 3 0-3-1-5 0-7z"/>',
    insulation: '<path d="M20 4C10 4 5 10 5 20M5 19c6 0 12-4 15-15M9 15h5M11 11h5"/>',
    ganglia: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><path d="M8 6.2l8 .6M7 8l4 7M17 9l-4 6"/>',
    brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1V5a2 2 0 0 1 3-1z"/>',
    pack_hunting: '<circle cx="12" cy="15.5" r="3.5"/><circle cx="5.5" cy="10" r="1.8"/><circle cx="9.5" cy="5.5" r="1.8"/><circle cx="14.5" cy="5.5" r="1.8"/><circle cx="18.5" cy="10" r="1.8"/>',
    big_brain: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c1 1 1 2 1 3.5h6c0-1.5 0-2.5 1-3.5A6 6 0 0 0 12 3z"/>',
    social: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-4 3-6 6-6s6 2 6 6M14 20c0-3 1.5-5 3-5s4 2 4 5"/>',
    tool_use: '<path d="M13 3l7 7-4 3-6-6z"/><path d="M10.5 8.5L3 20l1 1 11.5-7.5"/>',
    // kategorie
    cat_pokarm: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10"/>',
    cat_lokomocja: '<path d="M12 21v-7M12 14l-5-5M12 14l5-5M12 14V6M12 6V3"/>',
    cat_obrona: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    cat_zmysly: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    cat_rozrod: '<path d="M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z"/>',
    cat_termoregulacja: '<path d="M14 14V5a2 2 0 0 0-4 0v9a4 4 0 1 0 4 0z"/><path d="M12 10v6"/>',
    cat_uklad_nerwowy: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1V5a2 2 0 0 1 3-1z"/>',
    // nisze
    woda: '<path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
    przybrzeze: '<path d="M2 17c3-2 5-2 8 0s5 2 8 0 3-1 4-1"/><path d="M7 14V7M7 9l-2-2M7 11l2-2M16 14V5M16 8l-2-2M16 10l2-2"/>',
    lad: '<path d="M2 20l6-10 4 6 3-4 7 8z"/><circle cx="17" cy="6" r="2"/>',
    powietrze: '<path d="M6 16a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1A4 4 0 0 1 18 16z"/><path d="M8 20l2-2 2 2 2-2 2 2"/>',
    // różne
    ep: '<path d="M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12s10 3 10 6M8 7h8M8 17h8"/>',
    pop: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 20c0-3 1-5 3-5s3 2 3 5"/>',
    era: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
    goal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    comet: '<circle cx="16" cy="8" r="4"/><path d="M13 11L3 21M12.5 8.5L5 14M15.5 11.5L10 19"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z"/>',
    hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
    tree: '<path d="M12 21V9M12 13l-5-4M12 11l5-4M7 9V5M17 7V4"/>',
    split: '<path d="M6 3v6c0 4 6 5 6 9v3M18 3v6c0 4-6 5-6 9"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4z"/><path d="M12 5v15"/>',
    trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0zM8 5H4a4 4 0 0 0 4 5M16 5h4a4 4 0 0 1-4 5M12 13v4M8 21h8M9 17h6"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    skull: '<path d="M12 3a8 8 0 0 0-8 8c0 3 2 5 3 6v3h10v-3c1-1 3-3 3-6a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10 20v-2M14 20v-2"/>',
    dna: '<path d="M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12s10 3 10 6M8 7h8M8 17h8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    cloud: '<path d="M6 18a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1A4 4 0 0 1 18 18z"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-6 14-14 14z"/><path d="M5 19l8-8"/>',
    fang: '<path d="M4 5h16l-3 5-2-3-2 8-2-8-2 3z"/>',
    oxygen: '<circle cx="9" cy="12" r="5"/><circle cx="17" cy="9" r="2.5"/><circle cx="18" cy="16" r="1.8"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/>',
    present: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
    restart: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/>',
    bone: '<path d="M7 7a2 2 0 1 0-2 2l10 10a2 2 0 1 0 2-2 2 2 0 1 0-2-2L9 9a2 2 0 1 0-2-2z"/>'
  };
  function icon(name, cls) {
    var body = ICONS[name];
    if (!body) return '';
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  // ====================== Kolory ======================
  var LINEAGE_COLORS = ['#3f8f6b', '#c7743a', '#5a6fc4', '#b0487a', '#8c7a28', '#2a8a9c', '#7b56b8', '#a0522d'];
  function lineageColor(lineage) {
    var n = parseInt(String(lineage.id).replace(/\D/g, ''), 10) || 0;
    return LINEAGE_COLORS[n % LINEAGE_COLORS.length];
  }
  function shade(hex, amt) {
    var c = hex.replace('#', ''); var num = parseInt(c, 16);
    var r = clamp((num >> 16) + amt, 0, 255), g = clamp(((num >> 8) & 255) + amt, 0, 255), b = clamp((num & 255) + amt, 0, 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // ====================== Portret gatunku ======================
  /*
   * Stworzenie składane z części zależnych od cech: płetwy → kończyny, łuski,
   * pancerz, oczy, pióra/futro, skrzydła, a głowa rośnie z mózgiem.
   * opts: { size, color, silhouette, idSuffix, facing }
   */
  var portraitSeq = 0;
  function creature(lineage, opts) {
    opts = opts || {};
    var t = {}; (lineage.traits || []).forEach(function (id) { t[id] = true; });
    var color = opts.color || lineageColor(lineage);
    var dark = shade(color, -45), light = shade(color, 45);
    var sil = !!opts.silhouette;
    var body = sil ? 'currentColor' : color, stroke = sil ? 'none' : dark;
    var uid = 'p' + (++portraitSeq) + (opts.idSuffix || '');
    var hasLimbs = t.limbs, land = hasLimbs;
    var headR = 9 + (t.ganglia ? 1 : 0) + (t.brain ? 2 : 0) + (t.big_brain ? 3 : 0);
    var bodyRx = land ? 30 : 32, bodyRy = land ? 13 : 14;
    var cx = 56, cy = land ? 46 : 50;
    var headX = cx + bodyRx - 4, headY = cy - (land ? 6 : 2) - (t.big_brain ? 3 : 0);
    var s = '';

    if (!sil) {
      s += '<defs><clipPath id="' + uid + 'c"><ellipse cx="' + cx + '" cy="' + cy + '" rx="' + bodyRx + '" ry="' + bodyRy + '"/></clipPath>' +
        '<linearGradient id="' + uid + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + light + '"/><stop offset="1" stop-color="' + color + '"/></linearGradient></defs>';
    }
    var fillBody = sil ? body : 'url(#' + uid + 'g)';

    // Ruch (szybkie mięśnie) — kreski za ciałem.
    if (t.fast_muscle && !sil) s += '<path d="M8 40h10M4 48h12M8 56h10" stroke="' + dark + '" stroke-width="2" stroke-linecap="round" opacity=".45"/>';

    // Ogon: płetwa ogonowa (woda) albo zwężający się ogon (ląd).
    if (!land) s += '<path d="M' + (cx - bodyRx + 4) + ' ' + cy + ' L' + (cx - bodyRx - 16) + ' ' + (cy - 14) + ' L' + (cx - bodyRx - 12) + ' ' + cy + ' L' + (cx - bodyRx - 16) + ' ' + (cy + 14) + ' Z" fill="' + body + '" stroke="' + stroke + '" stroke-width="1.5" stroke-linejoin="round"/>';
    else s += '<path d="M' + (cx - bodyRx + 6) + ' ' + (cy - 4) + ' Q' + (cx - bodyRx - 14) + ' ' + (cy + 2) + ' ' + (cx - bodyRx - 24) + ' ' + (cy + 14) + ' Q' + (cx - bodyRx - 8) + ' ' + (cy + 8) + ' ' + (cx - bodyRx + 6) + ' ' + (cy + 6) + 'Z" fill="' + body + '" stroke="' + stroke + '" stroke-width="1.5"/>';

    // Skrzydło (tylne, pod ciałem).
    if (t.flight) {
      s += '<path d="M' + (cx - 6) + ' ' + (cy - 8) + ' Q' + (cx - 30) + ' ' + (cy - 44) + ' ' + (cx + 4) + ' ' + (cy - 46) +
        ' Q' + (cx + 2) + ' ' + (cy - 30) + ' ' + (cx + 14) + ' ' + (cy - 10) + 'Z" fill="' + (sil ? body : light) + '" stroke="' + stroke + '" stroke-width="1.5" stroke-linejoin="round"/>';
      if (!sil) s += '<path d="M' + (cx - 2) + ' ' + (cy - 12) + ' L' + (cx - 14) + ' ' + (cy - 36) + ' M' + (cx + 4) + ' ' + (cy - 12) + ' L' + (cx - 2) + ' ' + (cy - 40) + '" stroke="' + dark + '" stroke-width="1" opacity=".5"/>';
    }

    // Kończyny (tylne pary za ciałem).
    function leg(x, back) {
      var y0 = cy + bodyRy - 4, y1 = cy + bodyRy + 18;
      return '<path d="M' + x + ' ' + y0 + ' L' + (x + (back ? -4 : 4)) + ' ' + (y0 + 10) + ' L' + (x + (back ? -2 : 6)) + ' ' + y1 +
        '" fill="none" stroke="' + (sil ? body : (back ? dark : color)) + '" stroke-width="' + (back ? 5 : 6) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    if (land) s += leg(cx - 16, true) + leg(cx + 14, true);

    // Ciało.
    s += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + bodyRx + '" ry="' + bodyRy + '" fill="' + fillBody + '" stroke="' + stroke + '" stroke-width="1.8"/>';

    if (!sil) {
      // Kamuflaż — plamy; łuski — wzór łusek (przycięte do ciała).
      var pat = '';
      if (t.camouflage) pat += [[-14, -4, 6], [2, 4, 5], [14, -6, 4], [-2, -8, 3], [-20, 6, 3]].map(function (p) {
        return '<ellipse cx="' + (cx + p[0]) + '" cy="' + (cy + p[1]) + '" rx="' + p[2] + '" ry="' + (p[2] * 0.7) + '" fill="' + dark + '" opacity=".35"/>';
      }).join('');
      if (t.scales) { for (var sx = cx - bodyRx; sx < cx + bodyRx; sx += 7) for (var sy = cy - bodyRy; sy < cy + bodyRy; sy += 6) {
        var off = ((sy - cy) / 6) % 2 ? 3.5 : 0;
        pat += '<path d="M' + (sx + off) + ' ' + sy + ' a3.5 3.5 0 0 0 7 0" fill="none" stroke="' + dark + '" stroke-width=".8" opacity=".45"/>';
      } }
      if (t.lateral_line) pat += '<path d="M' + (cx - bodyRx + 6) + ' ' + (cy + 1) + ' H' + (cx + bodyRx - 8) + '" stroke="' + dark + '" stroke-width="1.4" stroke-dasharray="2 3" opacity=".7"/>';
      if (pat) s += '<g clip-path="url(#' + uid + 'c)">' + pat + '</g>';
      // Brzuch — jaśniejszy.
      s += '<path d="M' + (cx - bodyRx + 8) + ' ' + (cy + 6) + ' Q' + cx + ' ' + (cy + bodyRy + 4) + ' ' + (cx + bodyRx - 8) + ' ' + (cy + 6) + '" fill="none" stroke="' + light + '" stroke-width="3" opacity=".6" stroke-linecap="round"/>';
    }

    // Izolacja — futro/pióra: kępki na grzbiecie.
    if (t.insulation) {
      var tufts = '';
      for (var i = -3; i <= 3; i++) {
        var tx = cx + i * 8, ty = cy - bodyRy + 2 + Math.abs(i) * 0.9;
        tufts += '<path d="M' + (tx - 3) + ' ' + ty + ' q3 -8 6 0" fill="' + (sil ? body : light) + '" stroke="' + stroke + '" stroke-width="1.2"/>';
      }
      s += tufts;
    }

    // Pancerz.
    if (t.shell) {
      s += '<path d="M' + (cx - bodyRx + 6) + ' ' + (cy - 2) + ' Q' + cx + ' ' + (cy - bodyRy - 22) + ' ' + (cx + bodyRx - 8) + ' ' + (cy - 2) + 'Z" fill="' + (sil ? body : shade(color, -25)) + '" stroke="' + stroke + '" stroke-width="1.8"/>';
      if (!sil) s += '<path d="M' + (cx - 14) + ' ' + (cy - 4) + ' l6 -10 h14 l6 10 M' + (cx - 8) + ' ' + (cy - 14) + ' l2 -6 h10 l2 6" fill="none" stroke="' + dark + '" stroke-width="1.2" opacity=".7"/>';
    }

    // Płetwy (grzbietowa i piersiowa).
    if (t.fins && !land) {
      s += '<path d="M' + (cx - 8) + ' ' + (cy - bodyRy + 2) + ' Q' + (cx - 2) + ' ' + (cy - bodyRy - 16) + ' ' + (cx + 10) + ' ' + (cy - bodyRy + 1) + 'Z" fill="' + (sil ? body : light) + '" stroke="' + stroke + '" stroke-width="1.5"/>';
      s += '<path d="M' + (cx + 6) + ' ' + (cy + 4) + ' Q' + (cx - 2) + ' ' + (cy + 20) + ' ' + (cx - 10) + ' ' + (cy + 16) + 'Z" fill="' + (sil ? body : light) + '" stroke="' + stroke + '" stroke-width="1.3"/>';
    }

    // Kończyny przednie.
    if (land) {
      s += leg(cx - 18, false);
      var fx = cx + 12, fy0 = cy + bodyRy - 4, fy1 = cy + bodyRy + 18;
      s += '<path d="M' + fx + ' ' + fy0 + ' L' + (fx + 4) + ' ' + (fy0 + 10) + ' L' + (fx + 6) + ' ' + fy1 + '" fill="none" stroke="' + body + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>';
      if (t.grasping_hand && !sil) s += '<path d="M' + (fx + 6) + ' ' + fy1 + ' l4 -4 M' + (fx + 6) + ' ' + fy1 + ' l5 0 M' + (fx + 6) + ' ' + fy1 + ' l4 3" stroke="' + dark + '" stroke-width="2" stroke-linecap="round"/>';
      if (t.tool_use && !sil) s += '<path d="M' + (fx + 12) + ' ' + (fy1 - 18) + ' L' + (fx + 8) + ' ' + (fy1 + 2) + '" stroke="#7a5a32" stroke-width="3" stroke-linecap="round"/><path d="M' + (fx + 9) + ' ' + (fy1 - 20) + ' l7 -2 l1 6 l-6 1z" fill="#8d8d8d" stroke="#555" stroke-width="1"/>';
    }

    // Głowa.
    s += '<circle cx="' + headX + '" cy="' + headY + '" r="' + headR + '" fill="' + (sil ? body : color) + '" stroke="' + stroke + '" stroke-width="1.8"/>';
    if (t.brain && !sil) s += '<path d="M' + (headX - headR * 0.6) + ' ' + (headY - headR * 0.35) + ' q' + (headR * 0.6) + ' ' + (-headR * 0.8) + ' ' + (headR * 1.2) + ' 0" fill="none" stroke="' + light + '" stroke-width="1.5" opacity=".8"/>';
    if (t.endothermy && !sil) s += '<circle cx="' + (headX + headR * 0.25) + '" cy="' + (headY + headR * 0.45) + '" r="' + (headR * 0.28) + '" fill="#e8766b" opacity=".45"/>';

    if (!sil) {
      // Pysk: szczęki z zębami / fredzle filtratora / prosty otwór.
      var mx = headX + headR * 0.75, my = headY + headR * 0.3;
      if (t.jaws) s += '<path d="M' + (mx - 7) + ' ' + my + ' L' + (mx + 5) + ' ' + (my - 2) + ' L' + (mx + 3) + ' ' + (my + 5) + 'Z" fill="#fff" stroke="' + dark + '" stroke-width="1.2"/><path d="M' + (mx - 4) + ' ' + (my - 1) + ' l1 2 1 -2 1 2 1 -2" fill="none" stroke="' + dark + '" stroke-width=".8"/>';
      else s += '<path d="M' + (mx - 5) + ' ' + my + ' q3 2 6 0" fill="none" stroke="' + dark + '" stroke-width="1.4" stroke-linecap="round"/>';
      if (t.filter_feeding) s += '<path d="M' + (mx + 1) + ' ' + (my + 2) + ' l2 6 M' + (mx - 2) + ' ' + (my + 2) + ' l1 6 M' + (mx + 4) + ' ' + (my + 1) + ' l3 5" stroke="' + dark + '" stroke-width="1" stroke-linecap="round"/>';
      // Oko.
      var ex = headX + headR * 0.2, ey = headY - headR * 0.2;
      if (t.eyes) s += '<circle cx="' + ex + '" cy="' + ey + '" r="' + (headR * 0.36) + '" fill="#fff" stroke="' + dark + '" stroke-width="1"/><circle cx="' + (ex + headR * 0.1) + '" cy="' + ey + '" r="' + (headR * 0.18) + '" fill="#1d1d1d"/><circle cx="' + (ex + headR * 0.16) + '" cy="' + (ey - headR * 0.08) + '" r="' + (headR * 0.06) + '" fill="#fff"/>';
      else s += '<circle cx="' + ex + '" cy="' + ey + '" r="1.8" fill="#1d1d1d"/>';
    }

    // Towarzysze: młode (opieka), stado (społeczne / łowy grupowe), jaja.
    var extra = '';
    if (!sil) {
      if (t.parental_care) extra += '<g transform="translate(78 62) scale(.32)" opacity=".95">' + miniBlob(color, dark) + '</g>';
      if (t.social || t.pack_hunting) extra += '<g transform="translate(-4 16) scale(.42)" opacity=".45">' + miniBlob(color, dark) + '</g>';
      if (t.amniotic_egg) extra += '<ellipse cx="18" cy="80" rx="4" ry="5" fill="#f3ead2" stroke="#b8a77a" stroke-width="1"/>';
      else if (t.many_eggs) extra += '<g fill="#dfe9c8" stroke="#9fb07a" stroke-width=".8"><circle cx="12" cy="82" r="2.4"/><circle cx="17" cy="83" r="2.4"/><circle cx="14.5" cy="78.5" r="2.4"/></g>';
    }

    var size = opts.size || 120;
    var title = opts.title ? '<title>' + esc(opts.title) + '</title>' : '';
    var flip = opts.facing === 'left' ? ' transform="translate(120 0) scale(-1 1)"' : '';
    return '<svg class="creature" viewBox="0 0 120 90" width="' + size + '" height="' + Math.round(size * 0.75) + '" role="img" aria-label="' +
      esc(opts.label || ('Portret: ' + (lineage.name || ''))) + '">' + title + '<g' + flip + '>' + extra + s + '</g></svg>';
  }
  function miniBlob(color, dark) {
    return '<ellipse cx="50" cy="50" rx="30" ry="14" fill="' + color + '" stroke="' + dark + '" stroke-width="3"/><circle cx="80" cy="44" r="11" fill="' + color + '" stroke="' + dark + '" stroke-width="3"/><circle cx="83" cy="41" r="2.5" fill="#1d1d1d"/>';
  }

  // ====================== Sylwetki rywali ======================
  var RIVAL_SHAPES = {
    woda: 'M4 12c4-6 12-7 18-2l6-5v14l-6-5c-6 5-14 4-18-2z',
    przybrzeze: 'M6 14c0-4 4-7 9-7s9 3 9 7-4 5-9 5-9-1-9-5zM6 12l-4-4M6 16l-4 3M24 12l4-4M24 16l4 3',
    lad: 'M3 18c2-6 8-9 15-8l4-5 5 2-3 4c2 2 2 5 0 7M8 18v5M20 18v5',
    powietrze: 'M2 14c6-1 9-6 13-10 4 4 7 9 13 10-6 1-9 2-13 6-4-4-7-5-13-6z'
  };

  // ====================== Scena ekosystemu ======================
  /*
   * opts: { data, engine, state, activeId, env, nextCatastrophe, omen, forecastNiches }
   * Strefy nisz: powietrze (niebo), woda (morze), przybrzeże (płycizna), ląd.
   */
  var ZONES = {
    powietrze: { x: 0, y: 0, w: 1000, h: 118, lx: 16, ly: 22 },
    woda: { x: 0, y: 118, w: 420, h: 182, lx: 16, ly: 150 },
    przybrzeze: { x: 420, y: 118, w: 190, h: 182, lx: 432, ly: 150 },
    lad: { x: 610, y: 118, w: 390, h: 182, lx: 622, ly: 150 }
  };
  var ERA_LAND = { paleozoik: '#6e8f4f', mezozoik: '#7f9444', kenozoik: '#b89e4e' };

  function scene(o) {
    var data = o.data, E = o.engine, state = o.state, env = o.env;
    var era = E.currentEra(data, state);
    var cold = env && env.climate === 'zimno', warm = env && env.climate === 'cieplo';
    var oxy = env ? env.oxygen : 10;
    var skyTop = cold ? '#c9d9e6' : (oxy >= 13 ? '#9fd3e8' : '#b7dcea');
    var skyBot = cold ? '#e8eff4' : (warm ? '#f4ecd0' : '#e3f0f2');
    var landCol = cold ? '#cfd9d6' : (ERA_LAND[era.id] || '#6e8f4f');
    var s = '<svg class="scene-svg" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ekosystem: ' + esc(env ? env.title : era.name) + '">';
    s += '<defs>' +
      '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + skyTop + '"/><stop offset="1" stop-color="' + skyBot + '"/></linearGradient>' +
      '<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (cold ? '#5f8fae' : '#3a86b4') + '"/><stop offset="1" stop-color="' + (cold ? '#23445e' : '#15466e') + '"/></linearGradient>' +
      '<linearGradient id="shallow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + (cold ? '#6f9cb4' : '#4aa2b8') + '"/><stop offset="1" stop-color="' + (cold ? '#b9ccd3' : '#8fcdc4') + '"/></linearGradient>' +
      '<pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="rgba(160,20,20,.18)"/><line x1="0" y1="0" x2="0" y2="10" stroke="rgba(200,30,30,.55)" stroke-width="4"/></pattern>' +
      '</defs>';
    // Niebo, słońce/chmury.
    s += '<rect x="0" y="0" width="1000" height="300" fill="url(#sky)"/>';
    if (!cold) s += '<circle cx="900" cy="44" r="' + (warm ? 26 : 20) + '" fill="#ffd978" opacity="' + (warm ? 0.95 : 0.7) + '"/>';
    s += '<g fill="#fff" opacity="' + (cold ? 0.9 : 0.7) + '"><ellipse cx="220" cy="46" rx="46" ry="12"/><ellipse cx="250" cy="38" rx="30" ry="12"/><ellipse cx="610" cy="60" rx="40" ry="10"/><ellipse cx="640" cy="54" rx="24" ry="9"/></g>';
    // Tło: wulkan w mezozoiku, góry w innych erach.
    if (era.id === 'mezozoik') s += '<path d="M700 130 L780 58 L800 62 L880 130Z" fill="#8a7466" opacity=".55"/><path d="M780 58 q10 -20 0 -34 q14 10 20 38" fill="#bbb" opacity=".45"/>';
    else s += '<path d="M600 130 L680 70 L740 118 L800 60 L900 130Z" fill="' + (cold ? '#e6edf2' : '#8aa39a') + '" opacity=".5"/>';
    // Ląd.
    s += '<path d="M580 300 L580 138 Q620 124 680 130 Q760 120 820 128 Q900 118 1000 126 L1000 300Z" fill="' + landCol + '"/>';
    s += '<path d="M580 300 L580 170 Q640 160 720 168 Q820 158 1000 166 L1000 300Z" fill="' + shade(landCol, -18) + '" opacity=".55"/>';
    // Przybrzeże (płycizna + plaża).
    s += '<path d="M420 132 L600 132 L600 300 L420 300Z" fill="url(#shallow)"/>';
    s += '<path d="M540 300 Q560 200 610 136 L640 140 Q610 220 620 300Z" fill="' + (cold ? '#e3e6e3' : '#e6d49c') + '"/>';
    // Morze.
    s += '<rect x="0" y="130" width="440" height="170" fill="url(#sea)"/>';
    s += '<path d="M0 130 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="#dff3ff" stroke-width="2" opacity=".7"/>';
    if (cold) s += '<rect x="0" y="126" width="600" height="8" fill="#eef6fb" opacity=".85"/>';
    // Dno morskie.
    s += '<path d="M0 300 L0 282 Q80 272 160 284 Q260 276 440 286 L440 300Z" fill="#2b3b36" opacity=".5"/>';
    s += decorations(era.id, state.turn, cold);

    // Strefy nisz: informacje, rywale, drapieżniki, pokarm, linie gracza.
    var active = E.getActiveLineage(state);
    Object.keys(ZONES).forEach(function (k) {
      var z = ZONES[k], cfg = data.NICHES[k];
      var unlocked = !cfg.requires || (active && active.traits.indexOf(cfg.requires) !== -1);
      var hits = env && E.catastropheHits(env.catastrophe, k);
      var ne = env ? E.envForNiche(data, env, k) : { food: 0, predators: 0 };
      var rival = state.rivals && state.rivals[k];
      var pl = (state.predatorLevels && state.predatorLevels[k]) || 0;
      var here = state.lineages.filter(function (l) { return l.alive && l.niche === k; });
      var cls = 'zone' + (active && active.niche === k ? ' zone-current' : '') + (unlocked ? '' : ' zone-locked');
      s += '<g class="' + cls + '" data-niche="' + k + '">';
      if (hits) s += '<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" fill="url(#hatch)" class="zone-danger"/>';
      if (!unlocked) s += '<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" fill="rgba(20,25,30,.14)"/>';
      // Obszar kliknięcia (migracja).
      s += '<rect class="zone-hit" x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" fill="transparent"><title>' +
        esc(cfg.label + (unlocked ? (active && active.niche === k ? ' — aktualna nisza' : ' — kliknij, by migrować aktywną linię') : ' — wymaga cechy: ' + reqName(data, cfg.requires))) + '</title></rect>';
      // Etykieta strefy.
      var label = cfg.label + (unlocked ? '' : ' — wymaga: ' + reqName(data, cfg.requires));
      var lw = Math.max(110, label.length * 7.4 + 34);
      s += '<g class="zone-label" transform="translate(' + z.lx + ' ' + (z.ly - 16) + ')">' +
        '<rect width="' + lw + '" height="24" rx="12" fill="rgba(255,255,255,.88)"/>' +
        '<g transform="translate(6 3) scale(.75)" class="zone-ico" stroke="#24372f" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (unlocked ? ICONS[k] : ICONS.lock) + '</g>' +
        '<text x="30" y="16.5" font-size="13" font-weight="700" fill="#1f2a24">' + esc(label) + '</text></g>';
      // Pokarm (listki) i drapieżnicy (kły).
      var foodN = clamp(Math.round(ne.food / 2), 0, 8), predN = clamp(Math.round((ne.predators + pl) / 2.5), 0, 7);
      var ry = z.ly + 14;
      var row = '<g transform="translate(' + z.lx + ' ' + ry + ')"><rect x="-4" y="-3" width="' + (Math.max(foodN, predN) * 13 + 70) + '" height="36" rx="8" fill="rgba(255,255,255,.62)"/>';
      row += '<text x="0" y="11" font-size="10" fill="#24372f">pokarm</text>';
      for (var i = 0; i < foodN; i++) row += '<g transform="translate(' + (48 + i * 13) + ' 1) scale(.5)" stroke="#2f7d3b" fill="#9fd08a" stroke-width="2">' + ICONS.leaf + '</g>';
      row += '<text x="0" y="27" font-size="10" fill="#24372f">drapieżcy</text>';
      for (var j = 0; j < predN; j++) row += '<g transform="translate(' + (48 + j * 13) + ' 17) scale(.5)" stroke="#9b2c2c" fill="#e79a9a" stroke-width="2">' + ICONS.fang + '</g>';
      row += '<title>Pokarm: ' + Math.round(ne.food) + ' · Drapieżniki: ' + r1(ne.predators) + (pl > 0.2 ? ' (+' + r1(pl) + ' koewolucja)' : '') + '</title></g>';
      s += row;
      // Rywal.
      if (rival) {
        var rs = clamp(0.8 + rival.strength * 0.25, 0.8, 2);
        var rx = z.x + z.w - 60 * rs - 10, ryy = z.y + (k === 'powietrze' ? 30 : 120);
        s += '<g class="rival" transform="translate(' + rx + ' ' + ryy + ') scale(' + rs + ')"><path d="' + RIVAL_SHAPES[k] + '" fill="rgba(25,30,35,.55)" stroke="rgba(25,30,35,.7)" stroke-width="1.2"/>' +
          '<title>Rywal: ' + esc(rival.name) + ' (siła ' + r1(rival.strength) + ') — konkuruje o pokarm</title></g>';
        s += '<text x="' + (z.x + z.w - 12) + '" y="' + (ryy + 30 * rs + 12) + '" text-anchor="end" font-size="10.5" font-style="italic" fill="' + (k === 'woda' ? '#e6f2fb' : '#1f2a24') + '" opacity=".85">' + esc(rival.name) + '</text>';
      }
      // Linie gracza.
      here.forEach(function (l, idx) {
        var sc = clamp(0.38 + Math.sqrt(l.population) / 42, 0.42, 1.05);
        var w = 120 * sc, h = 90 * sc;
        var px = z.x + 24 + idx * (w * 0.9) + (k === 'powietrze' ? 250 : 0), py = z.y + z.h - h - 22;
        if (k === 'powietrze') py = 16 + idx * 8;
        var isAct = active && l.id === active.id;
        s += '<g class="zone-lineage' + (isAct ? ' is-active' : '') + '" data-lineage="' + l.id + '" transform="translate(' + r1(px) + ' ' + r1(py) + ')">' +
          (isAct ? '<ellipse cx="' + (w / 2) + '" cy="' + (h - 2) + '" rx="' + (w * 0.45) + '" ry="5" fill="rgba(255,215,90,.55)"/>' : '') +
          '<g transform="scale(' + r1(sc) + ')">' + creatureInner(l) + '</g>' +
          '<g transform="translate(' + (w / 2) + ' ' + (h + 2) + ')"><rect x="-' + (l.name.length * 3.4 + 22) + '" y="-2" width="' + (l.name.length * 6.8 + 44) + '" height="16" rx="8" fill="' + (isAct ? '#1f2a24' : 'rgba(255,255,255,.85)') + '"/>' +
          '<text text-anchor="middle" y="10" font-size="10.5" font-weight="700" fill="' + (isAct ? '#fff' : '#1f2a24') + '">' + esc(l.name) + ' · ' + l.population + '</text></g>' +
          '<title>' + esc(l.name) + ' — populacja ' + l.population + (isAct ? ' (aktywna)' : ' — kliknij, by wybrać') + '</title></g>';
      });
      if (hits) s += '<g transform="translate(' + (z.x + z.w / 2 - 70) + ' ' + (z.y + z.h / 2 - 10) + ')" class="zone-cat"><rect width="140" height="24" rx="12" fill="#8f1d1d"/>' +
        '<g transform="translate(6 3) scale(.75)" stroke="#fff" fill="none" stroke-width="2">' + ICONS.comet + '</g><text x="30" y="16" font-size="11.5" font-weight="700" fill="#fff">nadchodzi katastrofa</text></g>';
      s += '</g>';
    });
    if (cold) s += snowflakes();
    if (o.omen) s += '<rect x="0" y="0" width="1000" height="300" fill="rgba(60,20,40,.12)" class="omen-veil"/>';
    return s + '</svg>';
  }
  function creatureInner(l) {
    // Wnętrze portretu bez zewnętrznego <svg> — do osadzenia w scenie.
    var svg = creature(l, { size: 120, idSuffix: 's' });
    return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  }
  function reqName(data, id) { var t = data.TRAITS.filter(function (x) { return x.id === id; })[0]; return t ? t.name : id; }
  function decorations(eraId, turn, cold) {
    var s = '';
    // Organizmy denne / rafa.
    s += '<g stroke="#e8c4a6" stroke-width="2" fill="none" opacity=".6">';
    [60, 120, 300, 470, 520].forEach(function (x, i) {
      s += '<path d="M' + x + ' 290 q' + (i % 2 ? 6 : -6) + ' -16 0 -30"/><circle cx="' + x + '" cy="258" r="4" fill="#e8c4a6"/>';
    });
    s += '</g>';
    // Roślinność lądowa zależna od ery (w paleozoiku ląd zielenieje dopiero od syluru).
    var plants = '';
    if (eraId === 'paleozoik') {
      if (turn >= 3) [650, 720, 860, 940].forEach(function (x, i) {
        var h = turn >= 6 ? 70 + i * 6 : 26;
        plants += '<path d="M' + x + ' 150 v-' + h + '" stroke="#4a5d2e" stroke-width="' + (turn >= 6 ? 6 : 3) + '"/>' +
          '<path d="M' + x + ' ' + (150 - h) + ' q-18 6 -24 22 M' + x + ' ' + (150 - h) + ' q18 6 24 22 M' + x + ' ' + (160 - h) + ' q-14 10 -18 26 M' + x + ' ' + (160 - h) + ' q14 10 18 26" stroke="#3f6b2a" stroke-width="3" fill="none"/>';
      });
    } else if (eraId === 'mezozoik') {
      [660, 760, 930].forEach(function (x) {
        plants += '<path d="M' + x + ' 150 v-46" stroke="#6b5230" stroke-width="5"/><path d="M' + x + ' 104 q-26 -2 -34 14 M' + x + ' 104 q26 -2 34 14 M' + x + ' 104 q-14 -16 -30 -14 M' + x + ' 104 q14 -16 30 -14" stroke="#3f6b2a" stroke-width="4" fill="none"/>';
      });
    } else {
      [690, 900].forEach(function (x) {
        plants += '<path d="M' + x + ' 150 v-40" stroke="#6b5230" stroke-width="5"/><ellipse cx="' + x + '" cy="106" rx="42" ry="10" fill="' + (cold ? '#e9eff3' : '#5d7a33') + '"/>';
      });
      plants += '<path d="M620 150 l4 -10 l4 10 l4 -12 l4 12 l4 -9 l4 9 M960 148 l4 -10 l4 10 l4 -12 l4 12" stroke="' + (cold ? '#c9d3cf' : '#8a8a3a') + '" stroke-width="2" fill="none"/>';
    }
    return s + '<g>' + plants + '</g>';
  }
  function snowflakes() {
    var s = '<g fill="#fff" opacity=".85" class="snow">';
    for (var i = 0; i < 40; i++) s += '<circle cx="' + ((i * 97) % 1000) + '" cy="' + ((i * 53) % 290) + '" r="' + (1.2 + (i % 3) * 0.7) + '"/>';
    return s + '</g>';
  }

  // ====================== Wykres populacji ======================
  /*
   * Wszystkie linie na wspólnej osi czasu gry; pasy er, znaczniki katastrof,
   * prognoza aktywnej linii linią przerywaną.
   */
  function popChart(o) {
    var data = o.data, E = o.engine, state = o.state;
    var W = o.width || 300, H = o.height || 130, pl = 34, pr = 8, pt = 10, pb = 20;
    var startG = E.globalTurn(data, state.startEra || 0, 0), endG = E.totalTurns(data);
    var nowG = E.globalTurn(data, Math.min(state.eraIndex, data.ERAS.length), state.eraIndex >= data.ERAS.length ? 0 : state.turn);
    var series = state.lineages.map(function (l) {
      var b = E.globalTurn(data, l.bornEra, l.bornTurn);
      return { l: l, pts: l.popHistory.map(function (v, i) { return [b + i, v]; }) };
    });
    var maxV = 50;
    series.forEach(function (sr) { sr.pts.forEach(function (p) { if (p[1] > maxV) maxV = p[1]; }); });
    if (o.forecast && o.forecast.projectedPop > maxV) maxV = o.forecast.projectedPop;
    maxV = Math.ceil(maxV / 50) * 50;
    var x = function (g) { return pl + (g - startG) / Math.max(1, endG - startG) * (W - pl - pr); };
    var y = function (v) { return pt + (1 - v / maxV) * (H - pt - pb); };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Wykres populacji wszystkich linii">';
    // Pasy er.
    var acc = 0;
    data.ERAS.forEach(function (era, i) {
      var a = acc, b = acc + era.turns.length; acc = b;
      if (b <= startG) return;
      var xa = x(Math.max(a, startG)), xb = x(b);
      s += '<rect x="' + xa + '" y="' + pt + '" width="' + (xb - xa) + '" height="' + (H - pt - pb) + '" class="era-band era-band-' + i + '"/>';
      s += '<text x="' + (xa + 3) + '" y="' + (H - 6) + '" class="chart-label">' + esc(era.name) + '</text>';
      // Katastrofy (historyczne) w tej erze.
      era.turns.forEach(function (t, ti) {
        var w = state.world && state.world[i] && state.world[i][ti];
        var cat = w ? w.catastrophe : t.catastrophe;
        if (!cat || (cat.minor && a + ti > nowG)) return;
        var cx = x(a + ti + 1);
        s += '<line x1="' + cx + '" y1="' + pt + '" x2="' + cx + '" y2="' + (H - pb) + '" class="cat-line"><title>' + esc(cat.name) + '</title></line>';
      });
    });
    // Siatka Y.
    [0, 0.5, 1].forEach(function (f) {
      var v = Math.round(maxV * f);
      s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid"/>' +
        '<text x="' + (pl - 4) + '" y="' + (y(v) + 3) + '" text-anchor="end" class="chart-label">' + v + '</text>';
    });
    // Serie.
    series.forEach(function (sr) {
      if (!sr.pts.length) return;
      var col = lineageColor(sr.l), isAct = sr.l.id === state.activeLineageId;
      var d = sr.pts.map(function (p, i) { return (i ? 'L' : 'M') + r1(x(p[0])) + ' ' + r1(y(p[1])); }).join(' ');
      s += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (isAct ? 2.6 : 1.6) + '" stroke-linejoin="round" opacity="' + (sr.l.alive ? 1 : 0.5) + '"' + (sr.l.alive ? '' : ' stroke-dasharray="3 2"') + '/>';
      var last = sr.pts[sr.pts.length - 1];
      if (sr.l.alive) s += '<circle cx="' + r1(x(last[0])) + '" cy="' + r1(y(last[1])) + '" r="' + (isAct ? 3.2 : 2.4) + '" fill="' + col + '"/>';
      else s += '<text x="' + r1(x(last[0])) + '" y="' + r1(y(last[1]) - 3) + '" font-size="10" text-anchor="middle" fill="' + col + '">†</text>';
      if (isAct && o.forecast && sr.l.alive) {
        s += '<path d="M' + r1(x(last[0])) + ' ' + r1(y(last[1])) + ' L' + r1(x(last[0] + 1)) + ' ' + r1(y(o.forecast.projectedPop)) + '" stroke="' + col + '" stroke-width="2" stroke-dasharray="4 3" fill="none"/>' +
          '<circle cx="' + r1(x(last[0] + 1)) + '" cy="' + r1(y(o.forecast.projectedPop)) + '" r="3" fill="none" stroke="' + col + '" stroke-width="1.5"><title>Prognoza: ' + o.forecast.projectedPop + '</title></circle>';
      }
    });
    s += '<line x1="' + x(nowG) + '" x2="' + x(nowG) + '" y1="' + pt + '" y2="' + (H - pb) + '" class="now-line"/>';
    return s + '</svg>';
  }

  // ====================== Radar statystyk ======================
  var RADAR_KEYS = [
    { key: 'feeding', label: 'Odżyw.' }, { key: 'defense', label: 'Obrona' }, { key: 'reproduction', label: 'Rozród' },
    { key: 'mobility', label: 'Mobil.' }, { key: 'metabolism', label: 'Metab.' }, { key: 'intelligence', label: 'Intel.' }
  ];
  function radar(stats, preview, opts) {
    opts = opts || {};
    var W = 220, H = 190, cx = W / 2, cy = 96, R = 66;
    var max = opts.max || 12;
    [stats, preview].forEach(function (st) { if (st) RADAR_KEYS.forEach(function (k) { if ((st[k.key] || 0) > max) max = st[k.key]; }); });
    function pt(i, v) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / RADAR_KEYS.length, rr = R * clamp(v, 0, max) / max;
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    }
    var s = '<svg class="radar" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Statystyki aktywnej linii">';
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      s += '<polygon class="radar-ring" points="' + RADAR_KEYS.map(function (k, i) { return pt(i, max * f).map(r1).join(','); }).join(' ') + '"/>';
    });
    RADAR_KEYS.forEach(function (k, i) {
      var e = pt(i, max), l = pt(i, max * 1.2);
      s += '<line class="radar-axis" x1="' + cx + '" y1="' + cy + '" x2="' + r1(e[0]) + '" y2="' + r1(e[1]) + '"/>';
      var v = stats[k.key] || 0, pv = preview ? (preview[k.key] || 0) : v, dv = pv - v;
      s += '<text class="radar-label' + (k.key === 'metabolism' ? ' is-cost' : '') + '" x="' + r1(l[0]) + '" y="' + r1(l[1] + 3) + '" text-anchor="middle">' + k.label + ' ' + v +
        (dv ? '<tspan class="' + ((dv > 0) !== (k.key === 'metabolism') ? 'up' : 'down') + '">' + (dv > 0 ? ' +' : ' ') + dv + '</tspan>' : '') + '</text>';
    });
    if (preview) s += '<polygon class="radar-preview" points="' + RADAR_KEYS.map(function (k, i) { return pt(i, preview[k.key] || 0).map(r1).join(','); }).join(' ') + '"/>';
    s += '<polygon class="radar-shape" points="' + RADAR_KEYS.map(function (k, i) { return pt(i, stats[k.key] || 0).map(r1).join(','); }).join(' ') + '"/>';
    RADAR_KEYS.forEach(function (k, i) { var p = pt(i, stats[k.key] || 0); s += '<circle class="radar-dot' + (k.key === 'metabolism' ? ' is-cost' : '') + '" cx="' + r1(p[0]) + '" cy="' + r1(p[1]) + '" r="2.6"/>'; });
    return s + '</svg>';
  }

  // ====================== Drzewo życia (diagram wrzecionowy) ======================
  function lifeTree(o) {
    var data = o.data, E = o.engine, state = o.state;
    var lineages = state.lineages, rowH = 70, top = 34, left = 16, right = 190, innerW = 640;
    var startG = E.globalTurn(data, state.startEra || 0, 0), maxT = E.totalTurns(data);
    var nowT = E.globalTurn(data, Math.min(state.eraIndex, data.ERAS.length), state.eraIndex >= data.ERAS.length ? 0 : state.turn);
    var rows = {}, order = [], childrenOf = {};
    lineages.forEach(function (l) { var p = l.parentId || '__root'; (childrenOf[p] = childrenOf[p] || []).push(l); });
    function dfs(l) { rows[l.id] = order.length; order.push(l); (childrenOf[l.id] || []).forEach(dfs); }
    (childrenOf.__root || []).forEach(dfs);
    var H = top + order.length * rowH + 24, W = left + innerW + right;
    var x = function (t) { return left + (t - startG) / Math.max(1, maxT - startG) * innerW; };
    var yOf = function (id) { return top + rows[id] * rowH + rowH / 2; };
    var maxPop = 50; lineages.forEach(function (l) { if (l.peakPopulation > maxPop) maxPop = l.peakPopulation; });
    var s = '<svg class="life-tree" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Drzewo życia — diagram wrzecionowy">';
    var acc = 0;
    data.ERAS.forEach(function (era, i) {
      var a = acc, b = acc + era.turns.length; acc = b;
      if (b <= startG) return;
      var xa = x(Math.max(a, startG)), xb = x(b);
      s += '<rect x="' + xa + '" y="' + (top - 22) + '" width="' + (xb - xa) + '" height="' + (H - top + 10) + '" class="era-band era-band-' + i + '"/>' +
        '<text x="' + (xa + 6) + '" y="' + (top - 8) + '" class="tree-era">' + esc(era.name) + ' <tspan class="tree-dates">' + esc(era.dates) + '</tspan></text>';
    });
    order.forEach(function (l) {
      var y = yOf(l.id), b = E.globalTurn(data, l.bornEra, l.bornTurn), col = lineageColor(l);
      var isAct = l.id === state.activeLineageId;
      if (l.parentId && rows[l.parentId] != null) {
        s += '<path d="M' + r1(x(b)) + ' ' + yOf(l.parentId) + ' C' + r1(x(b) + 14) + ' ' + yOf(l.parentId) + ' ' + r1(x(b) - 4) + ' ' + y + ' ' + r1(x(b) + 10) + ' ' + y + '" fill="none" stroke="' + col + '" stroke-width="2" opacity=".6"/>';
      }
      // Wrzeciono: grubość = populacja w czasie.
      var up = [], dn = [];
      l.popHistory.forEach(function (v, i) {
        var hh = 3 + (v / maxPop) * (rowH * 0.36);
        up.push(r1(x(b + i)) + ',' + r1(y - hh)); dn.unshift(r1(x(b + i)) + ',' + r1(y + hh));
      });
      if (up.length === 1) { var px = x(b); up.push(r1(px + 6) + ',' + (y - 3)); dn.unshift(r1(px + 6) + ',' + (y + 3)); }
      s += '<polygon points="' + up.concat(dn).join(' ') + '" fill="' + col + '" opacity="' + (l.alive ? 0.78 : 0.35) + '" stroke="' + (isAct ? '#d8a31e' : shade(col, -40)) + '" stroke-width="' + (isAct ? 2.5 : 1) + '"/>';
      var endT = l.alive ? nowT : (l.extinctGlobalTurn != null ? l.extinctGlobalTurn : b + l.popHistory.length - 1);
      var ex = Math.max(x(endT), x(b) + 8);
      s += '<g data-lineage="' + l.id + '" class="tree-node' + (l.alive ? ' alive' : '') + '" transform="translate(' + r1(ex + 4) + ' ' + (y - 24) + ')">' +
        (l.alive ? '<g>' + creature(l, { size: 64, idSuffix: 't' }).replace(/^<svg[^>]*>/, '<svg viewBox="0 0 120 90" width="64" height="48">') + '</g>'
          : '<text x="6" y="32" font-size="22" fill="' + col + '">†</text>') +
        '<text x="' + (l.alive ? 68 : 26) + '" y="22" class="tree-name' + (isAct ? ' is-active' : '') + '">' + esc(l.name) + '</text>' +
        '<text x="' + (l.alive ? 68 : 26) + '" y="37" class="tree-sub">' + (l.alive ? esc(data.NICHES[l.niche].label) + ' · ' + l.population : 'wymarła') + '</text>' +
        '<title>' + esc(l.name) + (l.alive ? ' — kliknij, by uczynić aktywną' : ' — linia wymarła') + '</title></g>';
    });
    return s + '</svg>';
  }

  // ====================== Mapa zależności cech ======================
  function traitMap(o) {
    var data = o.data, statusOf = o.statusOf;
    var byId = {}; data.TRAITS.forEach(function (t) { byId[t.id] = t; });
    var depth = {};
    function d(id) {
      if (depth[id] != null) return depth[id];
      var t = byId[id]; depth[id] = t.requires.length ? 1 + Math.max.apply(null, t.requires.map(d)) : 0;
      return depth[id];
    }
    data.TRAITS.forEach(function (t) { d(t.id); });
    var cols = {}; var catOrder = Object.keys(data.CATEGORIES);
    data.TRAITS.slice().sort(function (a, b) { return catOrder.indexOf(a.category) - catOrder.indexOf(b.category); })
      .forEach(function (t) { (cols[depth[t.id]] = cols[depth[t.id]] || []).push(t); });
    var colW = 190, rowH = 44, nodeW = 164, nodeH = 34, pad = 14;
    var maxRows = 0; Object.keys(cols).forEach(function (k) { maxRows = Math.max(maxRows, cols[k].length); });
    var W = pad * 2 + Object.keys(cols).length * colW, H = pad * 2 + maxRows * rowH;
    var pos = {};
    Object.keys(cols).forEach(function (c) { cols[c].forEach(function (t, i) { pos[t.id] = { x: pad + c * colW, y: pad + i * rowH }; }); });
    var s = '<svg class="trait-map" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" role="img" aria-label="Mapa zależności cech">';
    data.TRAITS.forEach(function (t) {
      t.requires.forEach(function (r) {
        var a = pos[r], b = pos[t.id];
        var x1 = a.x + nodeW, y1 = a.y + nodeH / 2, x2 = b.x, y2 = b.y + nodeH / 2;
        var st = statusOf(t);
        s += '<path class="map-edge' + (st === 'owned' || statusOf(byId[r]) === 'owned' ? ' lit' : '') + '" d="M' + x1 + ' ' + y1 + ' C' + (x1 + 16) + ' ' + y1 + ' ' + (x2 - 16) + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"/>';
      });
    });
    data.TRAITS.forEach(function (t) {
      var p = pos[t.id], st = statusOf(t);
      s += '<g class="map-node st-' + st + (t.path === 'intelligence' ? ' path-intel' : '') + '" data-trait="' + t.id + '" transform="translate(' + p.x + ' ' + p.y + ')">' +
        '<rect width="' + nodeW + '" height="' + nodeH + '" rx="9"/>' +
        '<g transform="translate(7 7) scale(.83)" class="map-ico">' + (ICONS[t.id] || '') + '</g>' +
        '<text x="32" y="15" class="map-name">' + esc(t.name.length > 20 ? t.name.slice(0, 19) + '…' : t.name) + '</text>' +
        '<text x="32" y="28" class="map-sub">' + (st === 'owned' ? '✓ posiadana' : st === 'era_locked' ? 'od ery: ' + esc(data.ERAS[t.minEra].name) : t.cost + ' EP') + '</text>' +
        '<title>' + esc(t.name + ' — ' + t.desc) + '</title></g>';
    });
    return s + '</svg>';
  }

  // ====================== Ilustracje wydarzeń ======================
  function catastropheArt(name) {
    var kind = /asteroid|K–Pg/i.test(name) ? 'asteroid' : /zlodow|lodow/i.test(name) ? 'ice' : /wulkan|permsk/i.test(name) ? 'volcano' : 'storm';
    var s = '<svg class="cat-art" viewBox="0 0 400 120" width="100%" aria-hidden="true">';
    s += '<rect width="400" height="120" fill="' + (kind === 'ice' ? '#bcd3e3' : '#2a1414') + '"/>';
    if (kind === 'asteroid') s += '<circle cx="300" cy="30" r="14" fill="#ffb347"/><path d="M290 38 L150 110 M296 42 L190 112 M284 34 L120 100" stroke="#ff7a3d" stroke-width="5" opacity=".7"/><path d="M0 110 Q200 70 400 110 V120 H0Z" fill="#5b2d1d"/>';
    else if (kind === 'volcano') s += '<path d="M120 120 L200 40 L230 44 L310 120Z" fill="#4a3530"/><path d="M200 40 q-20 -30 10 -40 q30 10 20 44" fill="#f06a2c" opacity=".85"/><circle cx="170" cy="22" r="10" fill="#555" opacity=".6"/><circle cx="250" cy="14" r="14" fill="#555" opacity=".5"/>';
    else if (kind === 'ice') s += '<path d="M0 90 L60 60 L120 88 L200 50 L280 86 L340 58 L400 80 V120 H0Z" fill="#f4f8fb"/>' + snowflakes().replace('class="snow"', '');
    else s += '<path d="M0 60 q50 -30 100 0 t100 0 t100 0 t100 0 V120 H0Z" fill="#355a3d" opacity=".8"/><circle cx="80" cy="30" r="20" fill="#6f6f6f" opacity=".5"/>';
    return s + '</svg>';
  }

  return {
    ICONS: ICONS, icon: icon, lineageColor: lineageColor, creature: creature, scene: scene,
    popChart: popChart, radar: radar, lifeTree: lifeTree, traitMap: traitMap, catastropheArt: catastropheArt,
    ZONES: ZONES
  };
});
