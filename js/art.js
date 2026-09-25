/*
 * art.js — proceduralna grafika gry (SVG, bez zależności i bez plików graficznych).
 *
 * Dwie główne funkcje:
 *  - creature(lineage, opts)  — sylwetka organizmu składana z jego cech
 *    (płetwy, kończyny, pancerz, oczy, szczęki, skrzydła, mózg…). Gracz widzi,
 *    jak jego linia dosłownie zmienia się po każdej kupionej adaptacji.
 *  - scene(input)             — ilustracja ekosystemu następnej tury: niebo wg
 *    klimatu, woda, przybrzeże, ląd z roślinnością ery, plankton (pokarm),
 *    pęcherzyki (tlen), drapieżniki, katastrofy i populacje wszystkich linii.
 *
 * Moduł nie zna silnika — dostaje gotowe dane od ui.js. Losowość jest
 * deterministyczna (ziarno), więc obraz nie „skacze” przy ponownym renderze.
 */
(function (root, factory) {
  var art = factory();
  if (typeof module === 'object' && module.exports) module.exports = art;
  else root.GameArt = art;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Barwy linii rozwojowych — czytelne na jasnym i ciemnym tle.
  var PALETTE = ['#3f9d7b', '#d4873a', '#6c7ed8', '#c95a7f', '#8c9b35', '#3a9fbd', '#a0724a', '#8d63c9'];

  var W = 800, H = 240, SEA = 112;

  // ===================== Narzędzia =====================
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var f = function (c) { return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); };
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function colorFor(index) { return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]; }

  // ===================== Organizm =====================
  /*
   * Rysuje organizm zwrócony w prawo, wyśrodkowany w (0,0); długość ~90 j.
   * opts: { color, portrait (dodatki: potomstwo, jaja), plain (bez animacji) }
   */
  function creature(lin, opts) {
    opts = opts || {};
    var t = (lin && lin.traits) || [];
    var has = function (id) { return t.indexOf(id) !== -1; };
    var c = opts.color || PALETTE[0];
    var dk = shade(c, -0.45), lt = shade(c, 0.45), mid = shade(c, -0.15);
    var land = has('limbs');
    var headR = has('big_brain') ? 13.5 : (has('brain') ? 11.5 : 10);
    var hx = 22, hy = land ? -4 : -1;
    var anim = !opts.plain;
    var s = '';

    // Aura ciepła (stałocieplność).
    if (has('endothermy')) s += '<ellipse cx="2" cy="0" rx="40" ry="22" fill="#ffb347" opacity=".16"/>';

    // Tylne skrzydło.
    if (has('flight')) {
      s += '<path' + (anim ? ' class="art-flap"' : '') + ' d="M-6,-8 Q-8,-44 14,-50 Q8,-26 10,-8 Z" fill="' + mid +
        '" stroke="' + dk + '" stroke-width="1.5" stroke-linejoin="round"/>';
    }

    // Ogon: lądowy, rybi lub wić.
    if (land) {
      s += '<path d="M-20,-6 Q-40,-4 -50,8 Q-38,6 -20,6 Z" fill="' + c + '" stroke="' + dk + '" stroke-width="1.5" stroke-linejoin="round"/>';
    } else if (has('fins')) {
      s += '<path' + (anim ? ' class="art-tail"' : '') + ' d="M-22,0 L-42,-14 Q-36,0 -42,14 Z" fill="' + c +
        '" stroke="' + dk + '" stroke-width="1.5" stroke-linejoin="round"/>';
    } else {
      s += '<path' + (anim ? ' class="art-tail"' : '') + ' d="M-25,0 q-6,-7 -12,0 t-12,0 t-10,0" fill="none" stroke="' + dk +
        '" stroke-width="2.2" stroke-linecap="round"/>';
    }

    // Dalsze kończyny (za tułowiem).
    if (land) {
      s += leg(-12, dk, 0.8) + leg(12, dk, 0.8);
    }

    // Tułów + brzuch.
    var ry = land ? 11 : 12;
    s += '<ellipse cx="0" cy="0" rx="26" ry="' + ry + '" fill="' + c + '" stroke="' + dk + '" stroke-width="1.8"/>';
    s += '<ellipse cx="2" cy="' + (ry * 0.45) + '" rx="18" ry="' + (ry * 0.42) + '" fill="' + lt + '" opacity=".75"/>';

    // Łuski.
    if (has('scales')) {
      for (var sx = -16; sx <= 12; sx += 7) {
        s += '<path d="M' + sx + ',-5 q3.5,3.5 7,0" fill="none" stroke="' + dk + '" stroke-width="1" opacity=".55"/>';
        s += '<path d="M' + (sx + 3.5) + ',1 q3.5,3.5 7,0" fill="none" stroke="' + dk + '" stroke-width="1" opacity=".45"/>';
      }
    }
    // Kamuflaż — plamy.
    if (has('camouflage')) {
      [[-14, -4, 4, 2.6], [-4, -6, 3.4, 2.2], [6, -3, 4.2, 2.4], [-9, 3, 3, 2], [13, -7, 2.6, 1.8]].forEach(function (p) {
        s += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="' + p[2] + '" ry="' + p[3] + '" fill="' + dk + '" opacity=".38"/>';
      });
    }
    // Linia boczna.
    if (has('lateral_line')) {
      s += '<path d="M-20,-1 Q0,2 18,-1" fill="none" stroke="' + lt + '" stroke-width="1.4" stroke-dasharray="2 2.5"/>';
    }
    // Izolacja — puszysty obrys.
    if (has('insulation')) {
      s += '<ellipse cx="0" cy="0" rx="27.5" ry="' + (ry + 1.5) + '" fill="none" stroke="' + lt +
        '" stroke-width="3.5" stroke-dasharray="1.2 2.4" stroke-linecap="round"/>';
    }
    // Pancerz.
    if (has('shell')) {
      s += '<path d="M-21,-5 Q-17,-27 2,-27 Q19,-25 21,-5 Z" fill="#b98b52" stroke="#6f4f2a" stroke-width="1.8" stroke-linejoin="round"/>' +
        '<path d="M-10,-7 L-7,-23 M2,-7 L2,-26 M13,-7 L11,-22 M-18,-12 Q2,-16 20,-12" fill="none" stroke="#6f4f2a" stroke-width="1.2" opacity=".8"/>';
    }
    // Płetwa grzbietowa (tylko wodne).
    if (has('fins') && !land && !has('shell')) {
      s += '<path d="M-9,-11 Q-2,-28 9,-11 Z" fill="' + mid + '" stroke="' + dk + '" stroke-width="1.5" stroke-linejoin="round"/>';
      s += '<path d="M-2,9 Q4,20 10,10 Z" fill="' + mid + '" stroke="' + dk + '" stroke-width="1.2" stroke-linejoin="round"/>';
    }

    // Bliższe kończyny (przed tułowiem); przednia z dłonią chwytną.
    if (land) {
      s += leg(-17, dk, 1) + (has('grasping_hand') ? arm(dk, c, has('tool_use')) : leg(8, dk, 1));
    }

    // Głowa.
    s += '<circle cx="' + hx + '" cy="' + hy + '" r="' + headR + '" fill="' + c + '" stroke="' + dk + '" stroke-width="1.8"/>';
    // Mózg — świecący zarys.
    if (has('brain')) {
      var br = headR * (has('big_brain') ? 0.55 : 0.42);
      s += '<circle' + (anim ? ' class="art-glow"' : '') + ' cx="' + (hx - 2) + '" cy="' + r1(hy - headR * 0.35) + '" r="' + r1(br) +
        '" fill="#b89cff" opacity=".6"/>';
      if (has('big_brain')) {
        s += '<path d="M' + (hx - 6) + ',' + r1(hy - headR * 0.35) + ' q2,-3 4,0 t4,0" fill="none" stroke="#6a4fc0" stroke-width="1" opacity=".8"/>';
      }
    }
    // Zwoje nerwowe — kropki wzdłuż grzbietu.
    if (has('ganglia') && !has('brain')) {
      s += '<circle cx="-6" cy="-6" r="1.6" fill="#b89cff"/><circle cx="4" cy="-7" r="1.6" fill="#b89cff"/><circle cx="14" cy="-6" r="1.6" fill="#b89cff"/>';
    }

    // Oko / plamka oczna.
    var ex = hx + headR * 0.35, ey = hy - headR * 0.25;
    if (has('eyes')) {
      s += '<circle cx="' + r1(ex) + '" cy="' + r1(ey) + '" r="3.8" fill="#fff" stroke="' + dk + '" stroke-width="1.1"/>' +
        '<circle cx="' + r1(ex + 1) + '" cy="' + r1(ey + 0.3) + '" r="2" fill="#1a1a1a"/>' +
        '<circle cx="' + r1(ex + 1.6) + '" cy="' + r1(ey - 0.6) + '" r=".7" fill="#fff"/>';
    } else {
      s += '<circle cx="' + r1(ex) + '" cy="' + r1(ey) + '" r="1.7" fill="' + dk + '"/>';
    }

    // Pysk: szczęki, filtrowanie lub prosty otwór.
    var mx = hx + headR - 1, my = hy + headR * 0.35;
    if (has('jaws')) {
      s += '<path d="M' + r1(mx - 7) + ',' + r1(my) + ' L' + r1(mx + 3) + ',' + r1(my - 4) + ' L' + r1(mx + 3) + ',' + r1(my + 4) + ' Z" fill="#5a1f22"/>' +
        '<path d="M' + r1(mx - 3) + ',' + r1(my - 1.8) + ' l1.2,2 l1.2,-2.4 M' + r1(mx - 3) + ',' + r1(my + 1.8) + ' l1.2,-2 l1.2,2.4" fill="none" stroke="#fff" stroke-width=".9"/>';
    } else if (has('filter_feeding')) {
      s += '<path d="M' + r1(mx) + ',' + r1(my) + ' q6,2 7,8 M' + r1(mx) + ',' + r1(my) + ' q7,-1 10,4 M' + r1(mx) + ',' + r1(my) +
        ' q4,4 3,10" fill="none" stroke="' + dk + '" stroke-width="1.2" stroke-linecap="round"/>';
    } else {
      s += '<path d="M' + r1(mx - 4) + ',' + r1(my) + ' q3,1.5 5,-0.5" fill="none" stroke="' + dk + '" stroke-width="1.3" stroke-linecap="round"/>';
    }

    // Przednie skrzydło.
    if (has('flight')) {
      s += '<path' + (anim ? ' class="art-flap art-flap-front"' : '') + ' d="M0,-6 Q6,-40 32,-44 Q20,-22 16,-4 Z" fill="' + lt +
        '" stroke="' + dk + '" stroke-width="1.5" stroke-linejoin="round"/>';
    }
    // Szybkie mięśnie — smugi ruchu.
    if (has('fast_muscle')) {
      s += '<path d="M-50,-8 h-12 M-54,0 h-16 M-50,8 h-12" stroke="' + dk + '" stroke-width="1.5" stroke-linecap="round" opacity=".45"/>';
    }

    // Dodatki portretu: jaja, potomstwo, grupa.
    if (opts.portrait) {
      if (has('many_eggs') || has('amniotic_egg')) {
        var egg = has('amniotic_egg') ? '#f1e6cf' : shade(c, 0.6);
        var ew = has('amniotic_egg') ? 4.5 : 3;
        s += '<g transform="translate(-44,26)">' +
          '<ellipse cx="0" cy="0" rx="' + ew + '" ry="' + (ew * 1.25) + '" fill="' + egg + '" stroke="' + dk + '" stroke-width=".8"/>' +
          '<ellipse cx="' + (ew * 2.1) + '" cy="1" rx="' + ew + '" ry="' + (ew * 1.25) + '" fill="' + egg + '" stroke="' + dk + '" stroke-width=".8"/>' +
          (has('many_eggs') ? '<ellipse cx="' + (ew * 1.05) + '" cy="' + (-ew * 1.6) + '" rx="' + ew + '" ry="' + (ew * 1.25) + '" fill="' + egg + '" stroke="' + dk + '" stroke-width=".8"/>' : '') +
          '</g>';
      }
      if (has('parental_care')) {
        var baby = { traits: t.filter(function (x) { return x !== 'parental_care' && x !== 'many_eggs' && x !== 'amniotic_egg' && x !== 'tool_use'; }) };
        s += '<g transform="translate(-58,' + (land ? 12 : 16) + ') scale(.38)">' + creature(baby, { color: c, plain: true }) + '</g>';
      }
      if (has('social')) {
        s = '<g transform="translate(-30,-14) scale(.6)" opacity=".45">' + creature({ traits: t }, { color: c, plain: true }) + '</g>' + s;
      }
    }
    return s;
  }
  function leg(x, dk, op) {
    return '<path d="M' + x + ',4 L' + (x - 2) + ',22 L' + (x + 4) + ',22" fill="none" stroke="' + dk +
      '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="' + op + '"/>';
  }
  function arm(dk, c, tool) {
    var s = '<path d="M10,4 L20,12 L28,6" fill="none" stroke="' + dk + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M28,6 l4,-3 M28,6 l5,0 M28,6 l3,3" stroke="' + dk + '" stroke-width="1.6" stroke-linecap="round"/>';
    if (tool) {
      s = '<path d="M30,14 L36,-16" stroke="#7b5a35" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M32,-18 L41,-14 L38,-8 L31,-11 Z" fill="#9aa0a6" stroke="#5d6166" stroke-width="1"/>' + s;
    }
    return s;
  }

  /* Samodzielny portret linii (np. panel gatunku, ekran końcowy, raport). */
  function portrait(lin, opts) {
    opts = opts || {};
    var c = opts.color || PALETTE[0];
    var id = 'p' + (hash((lin && lin.name) || '') % 100000) + '_' + (opts.key || 0);
    var niche = (lin && lin.niche) || 'woda';
    var bg = NICHE_BG[niche] || NICHE_BG.woda;
    var extinct = lin && lin.alive === false;
    var s = '<svg viewBox="-80 -60 160 110" width="100%" height="100%" role="img" aria-label="' +
      esc(opts.label || 'Wygląd linii') + '" class="portrait-svg' + (extinct ? ' is-extinct' : '') + '">' +
      '<defs><radialGradient id="' + id + '" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="' + bg[0] +
      '"/><stop offset="1" stop-color="' + bg[1] + '"/></radialGradient></defs>' +
      '<rect x="-80" y="-60" width="160" height="110" fill="url(#' + id + ')"/>';
    if (niche === 'lad') s += '<path d="M-80,30 Q-30,20 10,28 T80,24 L80,50 L-80,50 Z" fill="' + bg[2] + '"/>';
    else if (niche === 'przybrzeze') s += '<path d="M-80,38 Q-40,30 0,36 T80,32 L80,50 L-80,50 Z" fill="' + bg[2] + '"/>' +
      '<path d="M-64,38 q-3,-14 2,-24 M-58,38 q4,-10 0,-18 M60,34 q-4,-12 2,-20" stroke="#4f8f5a" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    else if (niche === 'powietrze') s += '<ellipse cx="-44" cy="30" rx="30" ry="8" fill="#fff" opacity=".7"/><ellipse cx="46" cy="-40" rx="22" ry="6" fill="#fff" opacity=".6"/>';
    else s += '<g opacity=".5"><circle cx="-60" cy="10" r="2" fill="#fff"/><circle cx="-54" cy="-2" r="1.4" fill="#fff"/><circle cx="58" cy="-20" r="1.8" fill="#fff"/></g>';
    s += '<g class="portrait-creature" transform="translate(4,' + (niche === 'lad' ? 6 : -2) + ')">' +
      '<g class="' + (extinct ? '' : (niche === 'lad' ? 'art-walk' : niche === 'powietrze' ? 'art-fly' : 'art-swim')) + '">' +
      creature(lin, { color: extinct ? '#9a9a92' : c, portrait: true, plain: !!opts.plain || extinct }) + '</g></g>';
    if (extinct) s += '<text x="0" y="44" text-anchor="middle" font-size="12" fill="#555">† wymarła</text>';
    return s + '</svg>';
  }
  var NICHE_BG = {
    woda:       ['#8fd3e0', '#2f7fa3', '#1f5f7d'],
    przybrzeze: ['#bfe8e2', '#5fb2b5', '#e3cf9a'],
    lad:        ['#e9f3dc', '#a9d0e3', '#8fb86a'],
    powietrze:  ['#e2f1fb', '#8cc3e6', '#ffffff']
  };

  /* Mała sylwetka do drzewa życia i list (bez tła). */
  function glyph(lin, opts) {
    opts = opts || {};
    return creature(lin, { color: opts.color, plain: true });
  }

  // ===================== Scena ekosystemu =====================
  var ERA_LOOK = {
    paleozoik: { water: ['#58c1be', '#1d6c7a', '#0f4452'], land: ['#a9a26a', '#7d7a4a'], sand: '#d9c48f', hills: '#b7c49b' },
    mezozoik:  { water: ['#5fb7cf', '#236b8c', '#133f58'], land: ['#9fb35c', '#6d8a3c'], sand: '#e0c98f', hills: '#a9c283' },
    kenozoik:  { water: ['#6aaedb', '#2a5f97', '#16375e'], land: ['#a7c160', '#6f9a3e'], sand: '#e4d3a0', hills: '#b6cf8e' }
  };
  var SKY = {
    cieplo:       ['#8fd0ee', '#fbe3b4'],
    umiarkowanie: ['#9cc6e4', '#e5eff3'],
    zimno:        ['#aebdd0', '#eef2f7']
  };

  // Obszary nisz: [x0, x1, y0, y1].
  var ZONES = {
    woda:       [40, 300, 150, 212],
    przybrzeze: [345, 468, 138, 196],
    lad:        [590, 770, 98, 102],
    powietrze:  [120, 720, 30, 78]
  };

  /*
   * input: { prefix, era, env: {oxygen, food, predators, climate, land:{food,predators}, catastrophe},
   *          groups: [{ lineage, color, active }], seed, predatorLevel }
   */
  function scene(input) {
    var p = input.prefix || 's';
    var env = input.env || { oxygen: 10, food: 10, predators: 5, climate: 'cieplo', land: { food: 6, predators: 2 } };
    var look = ERA_LOOK[input.era] || ERA_LOOK.paleozoik;
    var sky = SKY[env.climate] || SKY.umiarkowanie;
    var cold = env.climate === 'zimno';
    var cat = env.catastrophe;
    var rand = rng(input.seed || 1);
    var landFood = (env.land && env.land.food) || 0;
    var landPred = (env.land && env.land.predators) || 0;
    var s = '';

    s += '<defs>' +
      '<linearGradient id="' + p + 'sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (cat ? '#6e3b3b' : sky[0]) +
        '"/><stop offset="1" stop-color="' + (cat ? '#f0a066' : sky[1]) + '"/></linearGradient>' +
      '<linearGradient id="' + p + 'water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + look.water[0] +
        '"/><stop offset=".55" stop-color="' + look.water[1] + '"/><stop offset="1" stop-color="' + look.water[2] + '"/></linearGradient>' +
      '<linearGradient id="' + p + 'land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + look.land[0] +
        '"/><stop offset="1" stop-color="' + look.land[1] + '"/></linearGradient>' +
      '<radialGradient id="' + p + 'sun"><stop offset="0" stop-color="#fff7d6"/><stop offset=".45" stop-color="' +
        (cold ? '#f4f1e4' : '#ffd66b') + '"/><stop offset="1" stop-color="' + (cold ? '#f4f1e4' : '#ffd66b') + '" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + p + 'ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="' + p + 'vig" cx="50%" cy="45%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient>' +
      '</defs>';

    // Niebo i słońce.
    s += '<rect width="' + W + '" height="' + SEA + '" fill="url(#' + p + 'sky)"/>';
    s += '<circle cx="' + (cat ? 690 : 110) + '" cy="34" r="' + (cold ? 30 : 40) + '" fill="url(#' + p + 'sun)"' + (cat ? ' opacity=".6"' : '') + '/>';

    // Chmury.
    var clouds = cold ? 4 : (env.climate === 'umiarkowanie' ? 3 : 1);
    for (var ci = 0; ci < clouds; ci++) {
      var cx = 180 + rand() * 520, cy = 18 + rand() * 38, cs = 0.7 + rand() * 0.7;
      s += '<g class="art-cloud" style="animation-delay:-' + r1(rand() * 40) + 's"><g transform="translate(' + r1(cx) + ',' + r1(cy) + ') scale(' + r1(cs) + ')" fill="' +
        (cat ? '#5a4040' : '#fff') + '" opacity="' + (cat ? '.75' : '.85') + '">' +
        '<ellipse cx="0" cy="0" rx="26" ry="9"/><ellipse cx="-12" cy="-5" rx="12" ry="9"/><ellipse cx="9" cy="-7" rx="14" ry="11"/></g></g>';
    }

    // Katastrofa: meteor, wulkany lub lód.
    if (cat) {
      if (/K.?Pg|asteroid|kred/i.test(cat.name)) {
        s += '<g class="art-meteor"><path d="M470,-10 L585,62" stroke="#ffcf7a" stroke-width="6" stroke-linecap="round" opacity=".55"/>' +
          '<path d="M500,8 L585,62" stroke="#fff3c4" stroke-width="3" stroke-linecap="round"/>' +
          '<circle cx="588" cy="64" r="7" fill="#ffe8a8"/><circle cx="588" cy="64" r="16" fill="#ff9d4d" opacity=".35"/></g>';
      } else if (/perm|wulk/i.test(cat.name)) {
        s += '<path d="M640,112 L668,62 L684,62 L712,112 Z" fill="#4b3a36"/><path d="M668,62 L676,72 L684,62 Z" fill="#ff7a3c"/>' +
          '<g class="art-smoke" fill="#3d3434" opacity=".55"><circle cx="676" cy="48" r="12"/><circle cx="664" cy="30" r="16"/><circle cx="690" cy="14" r="20"/></g>';
      }
      s += '<rect width="' + W + '" height="' + H + '" fill="#b3261e" opacity=".08"/>';
    }

    // Wzgórza w tle (ląd).
    s += '<path d="M430,' + SEA + ' Q520,70 610,92 T800,78 L800,' + SEA + ' Z" fill="' + (cold ? '#dfe7ee' : look.hills) + '" opacity=".75"/>';

    // Woda.
    s += '<rect x="0" y="' + SEA + '" width="' + W + '" height="' + (H - SEA) + '" fill="url(#' + p + 'water)"/>';
    // Promienie światła.
    for (var ri = 0; ri < 4; ri++) {
      var rx = 30 + ri * 110 + rand() * 30;
      s += '<path d="M' + r1(rx) + ',' + SEA + ' l30,0 l-' + r1(10 + rand() * 20) + ',' + (H - SEA) + ' l-40,0 Z" fill="url(#' + p + 'ray)"/>';
    }
    // Fale na powierzchni (animowane).
    var wave = '';
    for (var wx = -60; wx <= W + 60; wx += 30) wave += ' q7.5,-4 15,0 t15,0';
    s += '<g class="art-waves"><path d="M-60,' + SEA + wave + ' L' + (W + 60) + ',' + (SEA + 5) + ' L-60,' + (SEA + 5) + ' Z" fill="' + look.water[0] + '" opacity=".9"/>' +
      '<path d="M-60,' + (SEA + 1) + wave + '" fill="none" stroke="#fff" stroke-width="1.2" opacity=".55"/></g>';

    // Dno morskie.
    s += '<path d="M0,' + H + ' L0,224 Q80,216 170,226 T340,214 Q400,206 440,216 L460,' + H + ' Z" fill="' + look.sand + '" opacity=".9"/>';

    // Przybrzeże: rafa i wodorosty (gęstość ~ pokarm).
    var kelp = clamp(Math.round((env.food || 8) / 2), 2, 8);
    for (var ki = 0; ki < kelp; ki++) {
      var kx = 330 + rand() * 140, kh = 30 + rand() * 50, kb = 206 + rand() * 12;
      s += '<path class="art-sway" style="animation-delay:-' + r1(rand() * 4) + 's" d="M' + r1(kx) + ',' + r1(kb) + ' q' + r1(-8 + rand() * 6) + ',' + r1(-kh / 2) +
        ' ' + r1(rand() * 6 - 3) + ',' + r1(-kh) + '" fill="none" stroke="' + (input.era === 'paleozoik' ? '#6f9d4a' : '#4f8f5a') +
        '" stroke-width="3" stroke-linecap="round" opacity=".85"/>';
    }
    for (var co = 0; co < 4; co++) {
      var ccx = 350 + co * 32 + rand() * 12, ccy = 214 + rand() * 6;
      var coral = ['#e98b7c', '#f2b36b', '#c77dbd', '#e8d56b'][co % 4];
      if (input.era === 'paleozoik') {
        // Liliowce — typowe dla paleozoiku.
        s += '<path d="M' + r1(ccx) + ',' + r1(ccy) + ' l0,-22" stroke="' + coral + '" stroke-width="2"/>' +
          '<path d="M' + r1(ccx) + ',' + r1(ccy - 22) + ' q-8,-6 -6,-14 M' + r1(ccx) + ',' + r1(ccy - 22) + ' q0,-8 0,-14 M' + r1(ccx) + ',' + r1(ccy - 22) +
          ' q8,-6 6,-14" stroke="' + coral + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
      } else {
        s += '<path d="M' + r1(ccx) + ',' + r1(ccy) + ' l0,-10 l-6,-8 M' + r1(ccx) + ',' + r1(ccy - 10) + ' l6,-10 M' + r1(ccx) + ',' + r1(ccy - 4) +
          ' l7,-5" stroke="' + coral + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
      }
    }

    // Plankton (pokarm w wodzie).
    var plank = clamp(Math.round(env.food || 8) * 2, 6, 34);
    s += '<g class="art-drift" fill="#e9fbe4" opacity=".75">';
    for (var pi = 0; pi < plank; pi++) {
      s += '<circle cx="' + r1(rand() * 460) + '" cy="' + r1(SEA + 10 + rand() * (H - SEA - 30)) + '" r="' + r1(0.8 + rand() * 1.4) + '"/>';
    }
    s += '</g>';

    // Pęcherzyki tlenu.
    var bub = clamp(Math.round((env.oxygen || 10) / 1.5), 3, 12);
    for (var bi = 0; bi < bub; bi++) {
      s += '<circle class="art-bubble" style="animation-delay:-' + r1(rand() * 6) + 's;animation-duration:' + r1(4 + rand() * 4) + 's" cx="' +
        r1(20 + rand() * 420) + '" cy="' + r1(200 + rand() * 20) + '" r="' + r1(1.5 + rand() * 2) + '" fill="none" stroke="#fff" stroke-width="1" opacity=".7"/>';
    }

    // Drapieżniki wodne.
    var wPred = clamp(Math.round(((env.predators || 0) + (input.predatorLevel || 0)) / 3.5), 0, 4);
    for (var wp = 0; wp < wPred; wp++) {
      var pxw = 40 + rand() * 260, pyw = 160 + rand() * 50, psw = 0.8 + rand() * 0.5, fl = rand() < 0.5 ? -1 : 1;
      s += '<g transform="translate(' + r1(pxw) + ',' + r1(pyw) + ') scale(' + r1(fl * psw) + ',' + r1(psw) + ')"><g class="art-prowl" style="animation-delay:-' +
        r1(rand() * 10) + 's">' + (input.era === 'paleozoik' ? PRED.anomalo : PRED.shark) + '</g></g>';
    }

    // Ląd.
    s += '<path d="M430,' + H + ' C465,200 492,132 540,118 S640,106 700,112 S780,106 800,110 L800,' + H + ' Z" fill="url(#' + p + 'land)"/>';
    s += '<path d="M430,' + H + ' C465,200 492,132 540,118 S640,106 700,112 S780,106 800,110" fill="none" stroke="' + shade(look.land[1], -0.25) + '" stroke-width="1.5" opacity=".6"/>';
    if (cold) {
      s += '<path d="M528,121 Q540,117 560,115 S640,106 700,112 S780,106 800,110 L800,118 Q740,114 700,120 Q640,114 560,122 Z" fill="#fff" opacity=".9"/>';
      // Kry lodowe.
      s += '<path d="M60,' + (SEA + 2) + ' l36,0 l-6,6 l-26,0 Z M210,' + (SEA + 2) + ' l24,0 l-4,5 l-18,0 Z" fill="#f4f8fb" opacity=".9"/>';
    }

    // Roślinność lądowa zależna od ery i pokarmu na lądzie.
    var plants = clamp(Math.round(landFood / 1.4), 1, 12);
    var slots = [];
    for (var pl = 0; pl < plants; pl++) slots.push(560 + (pl + rand() * 0.8) * (230 / plants));
    slots.forEach(function (x, i) {
      var y = groundY(x) + 2;
      s += plant(input.era, landFood, x, y, rand, cold, i);
    });

    // Drapieżniki lądowe.
    var lPred = clamp(Math.round(landPred / 4), 0, 3);
    for (var lp = 0; lp < lPred; lp++) {
      var lx = 600 + rand() * 170, lf = rand() < 0.5 ? -1 : 1;
      var body = input.era === 'mezozoik' ? PRED.theropod : (input.era === 'kenozoik' ? PRED.cat : PRED.scorpion);
      var lsc = input.era === 'mezozoik' ? 1 : 0.8;
      s += '<g transform="translate(' + r1(lx) + ',' + r1(groundY(lx) + 1) + ') scale(' + r1(lf * lsc) + ',' + lsc + ')" opacity=".78">' + body + '</g>';
    }

    // Populacje linii gracza.
    (input.groups || []).forEach(function (g, gi) {
      var lin = g.lineage;
      if (!lin || !lin.alive) return;
      var z = ZONES[lin.niche] || ZONES.woda;
      var n = clamp(Math.ceil((lin.population || 0) / 45), 1, 7);
      var gr = rng(hash(lin.id || lin.name) + gi);
      var sc = g.active ? 0.44 : 0.38;
      var cls = lin.niche === 'lad' ? 'art-walk' : (lin.niche === 'powietrze' ? 'art-fly' : 'art-swim');
      for (var k = 0; k < n; k++) {
        var x = z[0] + ((k + 0.2 + gr() * 0.6) / n) * (z[1] - z[0]);
        var y = lin.niche === 'lad' ? groundY(x) - 11 : z[2] + gr() * (z[3] - z[2]);
        var flip = gr() < 0.35 ? -1 : 1;
        var k1 = sc * (0.85 + gr() * 0.3);
        s += '<g transform="translate(' + r1(x) + ',' + r1(y) + ') scale(' + r1(flip * k1 * 100) / 100 + ',' + r1(k1 * 100) / 100 + ')">' +
          '<g class="' + cls + '" style="animation-delay:-' + r1(gr() * 3) + 's">' +
          creature(lin, { color: g.color }) + '</g></g>';
        if (g.active && k === 0) {
          s += '<path class="art-marker" d="M' + r1(x - 5) + ',' + r1(y - 30) + ' l5,7 l5,-7 Z" fill="#fff" stroke="#222" stroke-width="1"/>';
        }
      }
    });

    // Śnieg.
    if (cold) {
      s += '<g fill="#fff" opacity=".85">';
      for (var sn = 0; sn < 26; sn++) {
        s += '<circle class="art-snow" style="animation-delay:-' + r1(rand() * 8) + 's;animation-duration:' + r1(6 + rand() * 5) + 's" cx="' +
          r1(rand() * W) + '" cy="' + r1(-10 + rand() * 20) + '" r="' + r1(0.8 + rand() * 1.4) + '"/>';
      }
      s += '</g>';
    }

    s += '<rect width="' + W + '" height="' + H + '" fill="url(#' + p + 'vig)" pointer-events="none"/>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + s + '</svg>';
  }

  // Wysokość gruntu lądu (przybliżenie krzywej z rysunku).
  function groundY(x) {
    if (x < 540) return 118 + (540 - x) * 0.9;
    return 113 + Math.sin((x - 540) / 38) * 3;
  }

  function plant(era, food, x, y, rand, cold, i) {
    var X = r1(x), Y = r1(y), h, s = '';
    var green = cold ? '#6f8f6a' : '#4f8a3c', dark = cold ? '#4c6650' : '#2f5f2a';
    if (era === 'paleozoik') {
      if (food < 8) {
        // Mchy i pierwsze drobne rośliny.
        return '<ellipse cx="' + X + '" cy="' + Y + '" rx="' + r1(5 + rand() * 4) + '" ry="3" fill="' + green + '"/>' +
          '<path d="M' + X + ',' + Y + ' l0,-7" stroke="' + dark + '" stroke-width="1.4"/>';
      }
      if (food >= 13 && i % 2 === 0) {
        // Lepidodendron — drzewiaste widłaki karbonu.
        h = 46 + rand() * 20;
        return '<path d="M' + X + ',' + Y + ' l0,-' + r1(h) + '" stroke="#6d5a3a" stroke-width="4"/>' +
          '<path d="M' + X + ',' + r1(y - h) + ' q-12,-4 -16,6 M' + X + ',' + r1(y - h) + ' q12,-4 16,6 M' + X + ',' + r1(y - h) + ' q-4,-10 0,-14" stroke="' +
          dark + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
      }
      // Paprocie / skrzypy.
      h = 16 + rand() * 18;
      s = '<path d="M' + X + ',' + Y + ' l0,-' + r1(h) + '" stroke="' + dark + '" stroke-width="2"/>';
      for (var f = 4; f < h; f += 5) {
        s += '<path d="M' + X + ',' + r1(y - f) + ' l-6,-4 M' + X + ',' + r1(y - f) + ' l6,-4" stroke="' + green + '" stroke-width="1.6" stroke-linecap="round"/>';
      }
      return s;
    }
    if (era === 'mezozoik') {
      if (i % 3 === 1) {
        // Iglaste.
        h = 34 + rand() * 20;
        return '<path d="M' + X + ',' + Y + ' l0,-8" stroke="#6d5a3a" stroke-width="3"/>' +
          '<path d="M' + r1(x - 11) + ',' + r1(y - 8) + ' L' + X + ',' + r1(y - h) + ' L' + r1(x + 11) + ',' + r1(y - 8) + ' Z" fill="' + dark + '"/>' +
          (cold ? '<path d="M' + r1(x - 5) + ',' + r1(y - h + 12) + ' L' + X + ',' + r1(y - h) + ' L' + r1(x + 5) + ',' + r1(y - h + 12) + ' Z" fill="#fff"/>' : '');
      }
      // Sagowce.
      h = 12 + rand() * 12;
      s = '<path d="M' + X + ',' + Y + ' l0,-' + r1(h) + '" stroke="#7a6440" stroke-width="4"/>';
      [-1, 1].forEach(function (d) {
        s += '<path d="M' + X + ',' + r1(y - h) + ' q' + (d * 10) + ',-10 ' + (d * 18) + ',-2 M' + X + ',' + r1(y - h) + ' q' + (d * 6) + ',-14 ' + (d * 10) +
          ',-14" stroke="' + green + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
      });
      if (food >= 13) s += '<circle cx="' + r1(x + 4) + '" cy="' + r1(y - h - 4) + '" r="2.4" fill="#f2c14e"/>';
      return s;
    }
    // Kenozoik: drzewa liściaste i trawy.
    if (i % 3 === 0) {
      h = 30 + rand() * 16;
      return '<path d="M' + X + ',' + Y + ' l0,-' + r1(h) + '" stroke="#6d5a3a" stroke-width="3.5"/>' +
        '<circle cx="' + X + '" cy="' + r1(y - h) + '" r="' + r1(12 + rand() * 5) + '" fill="' + green + '"/>' +
        '<circle cx="' + r1(x - 8) + '" cy="' + r1(y - h + 6) + '" r="8" fill="' + dark + '" opacity=".6"/>' +
        (cold ? '<ellipse cx="' + X + '" cy="' + r1(y - h - 8) + '" rx="9" ry="4" fill="#fff"/>' : '');
    }
    return '<path d="M' + r1(x - 5) + ',' + Y + ' q2,-10 0,-14 M' + X + ',' + Y + ' q1,-12 3,-17 M' + r1(x + 5) + ',' + Y + ' q-1,-9 3,-12" stroke="' +
      (cold ? '#9aa98a' : '#8fae4a') + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
  }

  // Sylwetki drapieżników (współrzędne lokalne, przód w prawo).
  var PRED = {
    shark: '<path d="M-34,0 Q-10,-14 22,-4 Q34,0 22,5 Q-6,12 -34,0 Z M-30,0 L-46,-12 L-40,0 L-46,10 Z M-4,-9 L2,-22 L8,-8 Z" fill="#1b2e3a" opacity=".55"/>',
    anomalo: '<path d="M-30,0 Q-6,-12 20,-4 Q28,0 20,4 Q-6,12 -30,0 Z" fill="#3a2230" opacity=".5"/>' +
      '<path d="M-22,-6 l0,-6 M-12,-8 l0,-7 M-2,-9 l0,-7 M8,-7 l0,-6 M-22,6 l0,6 M-12,8 l0,7 M-2,9 l0,7 M8,7 l0,6 M22,0 q10,4 8,12 M22,0 q12,-2 12,-10" stroke="#3a2230" stroke-width="2" opacity=".5" fill="none" stroke-linecap="round"/>',
    theropod: '<path d="M-30,-18 Q-10,-30 8,-26 L22,-34 Q34,-34 34,-26 L24,-22 Q14,-18 10,-12 L6,0 L2,0 L0,-8 L-8,-8 L-10,0 L-14,0 L-14,-12 Q-26,-12 -44,-16 Z" fill="#2c2a24"/>',
    cat: '<path d="M-24,-14 Q0,-20 18,-14 L24,-20 L28,-12 Q30,-6 22,-6 L18,-2 L18,0 L14,0 L12,-6 L-12,-6 L-14,0 L-18,0 L-18,-8 Q-28,-10 -36,-20 Q-28,-14 -24,-14 Z" fill="#3a3024"/>',
    scorpion: '<path d="M-14,-4 Q0,-10 14,-4 Q0,2 -14,-4 Z M-14,-4 Q-24,-12 -20,-22 Q-14,-26 -12,-20 M14,-4 l8,-4 M14,-4 l8,2" stroke="#3a2a22" stroke-width="2" fill="#3a2a22" opacity=".7"/>'
  };

  return {
    PALETTE: PALETTE, colorFor: colorFor,
    creature: creature, portrait: portrait, glyph: glyph, scene: scene,
    _hash: hash, _shade: shade
  };
});
