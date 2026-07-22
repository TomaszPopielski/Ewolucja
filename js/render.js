/*
 * render.js — warstwa wizualizacji świata i populacji.
 *
 * Czysty moduł rysujący (bez logiki gry): bierze stan z silnika i zamienia go
 * na obraz — proceduralny awatar stworzenia (SVG składany z cech) oraz scenę
 * ekosystemu na Canvas 2D (biom niszy, atmosfera środowiska, rój populacji,
 * animacja wyniku tury). Zgodnie z ZALOZENIA.md §7 („mapa/ekosystem epoki”,
 * styl naukowo-ilustracyjny) i §9 (oddzielenie od logiki, lekkość, dostępność).
 *
 * Styl: płaskie wypełnienia + ciemny kontur („plansza edukacyjna”).
 * Dostępność: animacje respektują prefers-reduced-motion; scena ma tekstową
 * alternatywę budowaną w ui.js.
 */
(function (root, factory) {
  var render = factory();
  if (typeof module === 'object' && module.exports) module.exports = render;
  else root.Render = render;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var OUTLINE = '#33302b';

  // Palety biomów per nisza (tło sceny + ton stworzenia dobrany na kontrast).
  var BIOMES = {
    woda:       { sky: ['#bfe3f2', '#6fb4d6'], deep: '#2f6f92', floor: '#255b78', body: '#e0894a', flora: '#3f9e86' },
    przybrzeze: { sky: ['#cdeaf0', '#7fc6c0'], deep: '#3f8f88', floor: '#c9a36b', body: '#d95d5d', flora: '#57a86a' },
    lad:        { sky: ['#cfe8f5', '#a9d3ec'], deep: '#7fae55', floor: '#6a4a2c', body: '#8a5a34', flora: '#5f9a3a' },
    powietrze:  { sky: ['#d8ecf8', '#9fc4e0'], deep: '#bcd8ea', floor: '#8fae7a', body: '#54606c', flora: '#6f9a5a' }
  };
  function biome(niche) { return BIOMES[niche] || BIOMES.woda; }

  // ---------- pomocnicze ----------
  function has(traits, id) { return traits && traits.indexOf(id) !== -1; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // Parsuje kolor hex (#rrggbb) LUB rgb(r,g,b) — dzięki temu mix() można łączyć
  // łańcuchowo (np. klimat, a potem tryb ciemny) bez psucia wartości.
  function parseColor(c) {
    if (c.charAt(0) === '#') {
      var h = c.slice(1);
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    }
    var m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) { var p = m[1].split(','); return { r: +p[0], g: +p[1], b: +p[2] }; }
    return { r: 0, g: 0, b: 0 };
  }
  function mix(c1, c2, t) {
    var a = parseColor(c1), b = parseColor(c2);
    return 'rgb(' + Math.round(lerp(a.r, b.r, t)) + ',' + Math.round(lerp(a.g, b.g, t)) + ',' + Math.round(lerp(a.b, b.b, t)) + ')';
  }
  function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }
  function isDark() {
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
    catch (e) { return false; }
  }

  /* =======================================================================
   *  AWATAR STWORZENIA — SVG składany z posiadanych cech (kierunek B).
   *  Zwraca string SVG. Głowa po lewej, ogon/płetwy po prawej.
   * ===================================================================== */
  function creatureSvg(lineage, opts) {
    opts = opts || {};
    var traits = (lineage && lineage.traits) || [];
    var b = biome(lineage && lineage.niche);
    var body = has(traits, 'endothermy') ? mix(b.body, '#e8944a', 0.35) : b.body;
    var belly = mix(body, '#ffffff', 0.35);
    var sw = 3; // grubość konturu
    var P = []; // części w kolejności rysowania (od tyłu)

    // Skrzydła (lot) — za ciałem
    if (has(traits, 'flight')) {
      P.push('<path d="M64 56 Q40 20 20 34 Q40 44 58 60 Z" fill="' + mix(body, '#ffffff', 0.25) + '" stroke="' + OUTLINE + '" stroke-width="' + sw + '" stroke-linejoin="round"/>');
      P.push('<path d="M70 56 Q94 20 114 34 Q94 44 76 60 Z" fill="' + mix(body, '#ffffff', 0.25) + '" stroke="' + OUTLINE + '" stroke-width="' + sw + '" stroke-linejoin="round"/>');
    }
    // Ogon / płetwa (płetwy) — po prawej
    if (has(traits, 'fins')) {
      P.push('<path d="M86 64 L112 48 Q106 64 112 80 Z" fill="' + body + '" stroke="' + OUTLINE + '" stroke-width="' + sw + '" stroke-linejoin="round"/>');
      // płetwa grzbietowa
      P.push('<path d="M58 46 L70 26 L80 46 Z" fill="' + body + '" stroke="' + OUTLINE + '" stroke-width="' + sw + '" stroke-linejoin="round"/>');
    } else {
      // prosty ogon, gdy brak płetw
      P.push('<path d="M86 64 L106 56 L106 72 Z" fill="' + body + '" stroke="' + OUTLINE + '" stroke-width="' + sw + '" stroke-linejoin="round"/>');
    }
    // Kończyny (limbs) — nogi pod ciałem
    if (has(traits, 'limbs')) {
      ['54', '70', '84'].forEach(function (x) {
        P.push('<path d="M' + x + ' 78 L' + x + ' 92 M' + x + ' 92 L' + (parseInt(x, 10) + 6) + ' 92" fill="none" stroke="' + OUTLINE + '" stroke-width="4" stroke-linecap="round"/>');
      });
    }
    // Izolacja (pióra/futro) — kolce wokół konturu ciała
    if (has(traits, 'insulation')) {
      var fuzz = '';
      for (var a = 0; a < 360; a += 30) {
        var rad = a * Math.PI / 180;
        var cx = 66 + Math.cos(rad) * 30, cy = 64 + Math.sin(rad) * 21;
        var ox = 66 + Math.cos(rad) * 37, oy = 64 + Math.sin(rad) * 27;
        fuzz += '<line x1="' + cx.toFixed(1) + '" y1="' + cy.toFixed(1) + '" x2="' + ox.toFixed(1) + '" y2="' + oy.toFixed(1) + '" stroke="' + mix(body, OUTLINE, 0.3) + '" stroke-width="3" stroke-linecap="round"/>';
      }
      P.push(fuzz);
    }
    // Ciało
    P.push('<ellipse cx="66" cy="64" rx="30" ry="21" fill="' + body + '" stroke="' + OUTLINE + '" stroke-width="' + sw + '"/>');
    P.push('<path d="M42 70 Q66 88 90 70 Q66 80 42 70 Z" fill="' + belly + '" opacity="0.85"/>');
    // Łuski (scales) — łuseczki na ciele
    if (has(traits, 'scales')) {
      var sc = '';
      [[58, 58], [70, 58], [82, 60], [64, 66], [76, 66]].forEach(function (p) {
        sc += '<path d="M' + p[0] + ' ' + p[1] + ' q4 5 8 0" fill="none" stroke="' + mix(body, OUTLINE, 0.35) + '" stroke-width="1.6"/>';
      });
      P.push(sc);
    }
    // Pancerz (shell) — kopuła na grzbiecie
    if (has(traits, 'shell')) {
      P.push('<path d="M44 62 A24 22 0 0 1 90 62 Z" fill="' + mix(body, OUTLINE, 0.25) + '" stroke="' + OUTLINE + '" stroke-width="' + sw + '"/>');
      P.push('<path d="M58 50 A16 14 0 0 1 82 52" fill="none" stroke="' + mix(body, '#ffffff', 0.3) + '" stroke-width="2"/>');
    }
    // Głowa — powiększa się z mózgiem
    var headR = 14;
    if (has(traits, 'big_brain')) headR = 21;
    else if (has(traits, 'brain')) headR = 18;
    else if (has(traits, 'ganglia')) headR = 15;
    P.push('<circle cx="40" cy="' + (64 - (headR - 14) * 0.6).toFixed(1) + '" r="' + headR + '" fill="' + body + '" stroke="' + OUTLINE + '" stroke-width="' + sw + '"/>');
    var headY = 64 - (headR - 14) * 0.6;
    // Kopuła czaszki (brain/big_brain) — zaznaczenie mózgoczaszki
    if (has(traits, 'brain') || has(traits, 'big_brain')) {
      P.push('<path d="M' + (40 - headR) + ' ' + (headY - 2) + ' A' + headR + ' ' + headR + ' 0 0 1 ' + (40 + headR * 0.4) + ' ' + (headY - headR + 2) + '" fill="' + mix(body, '#ffffff', 0.25) + '" opacity="0.6"/>');
    }
    // Szczęki (jaws) — pysk z zębami z przodu (lewa strona)
    if (has(traits, 'jaws')) {
      P.push('<path d="M' + (40 - headR) + ' ' + (headY + 2) + ' q-10 3 -12 8 q8 -1 13 -3 Z" fill="' + mix(body, OUTLINE, 0.2) + '" stroke="' + OUTLINE + '" stroke-width="2" stroke-linejoin="round"/>');
      P.push('<path d="M' + (40 - headR - 8) + ' ' + (headY + 8) + ' l3 4 l3 -4" fill="#ffffff" stroke="' + OUTLINE + '" stroke-width="1"/>');
    }
    // Oko (eyes)
    if (has(traits, 'eyes')) {
      P.push('<circle cx="' + (40 - headR * 0.35) + '" cy="' + (headY - 3) + '" r="4.5" fill="#fff" stroke="' + OUTLINE + '" stroke-width="1.5"/>');
      P.push('<circle cx="' + (40 - headR * 0.35 - 1) + '" cy="' + (headY - 3) + '" r="2" fill="' + OUTLINE + '"/>');
    } else {
      // zaczątek oka bez cechy „oczy”
      P.push('<circle cx="' + (40 - headR * 0.35) + '" cy="' + (headY - 3) + '" r="2" fill="' + OUTLINE + '" opacity="0.5"/>');
    }
    // Ręka chwytna (grasping_hand)
    if (has(traits, 'grasping_hand')) {
      P.push('<path d="M50 82 q4 8 10 8 m0 0 l-2 -4 m2 4 l0 -5 m0 5 l3 -4" fill="none" stroke="' + OUTLINE + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>');
    }

    var size = opts.size || 132;
    var label = (lineage && lineage.name) ? (' — ' + lineage.name) : '';
    return '<svg viewBox="0 0 132 108" width="' + size + '" height="' + Math.round(size * 108 / 132) +
      '" role="img" aria-label="Sylwetka gatunku' + label + '">' + P.join('') + '</svg>';
  }

  /* =======================================================================
   *  SCENA EKOSYSTEMU — Canvas 2D (kierunki A, C, D).
   * ===================================================================== */
  function createScene(canvas) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var world = { niche: 'woda', traits: [], population: 0, climate: 'umiarkowanie', oxygen: 10, food: 8, predators: 3 };
    var agents = [];      // rój populacji
    var flora = [];       // tło: plankton/rośliny
    var predators = [];   // sylwetki drapieżników
    var raf = null, running = false;
    var anim = null;      // aktywna animacja tury
    var reduced = prefersReducedMotion();
    var t0 = 0;

    function targetAgents(pop) { return clamp(Math.round(pop / 6), pop > 0 ? 1 : 0, 80); }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildBackdrop();
      draw(0);
    }

    function rnd(seed) { // deterministyczny szum dla rozkładu tła
      var x = Math.sin(seed * 999.13) * 43758.5453; return x - Math.floor(x);
    }
    function buildBackdrop() {
      var b = biome(world.niche);
      var floorY = world.niche === 'powietrze' ? H * 0.86 : H * 0.78;
      // flora / pokarm — gęstość zależna od food
      var nFlora = clamp(Math.round(world.food * 1.6), 4, 46);
      flora = [];
      for (var i = 0; i < nFlora; i++) {
        flora.push({
          x: rnd(i + 1) * W,
          y: (world.niche === 'lad' || world.niche === 'powietrze') ? floorY - rnd(i + 7) * 6 : H * (0.25 + rnd(i + 3) * 0.6),
          s: 3 + rnd(i + 5) * 5, ph: rnd(i + 9) * 6.28
        });
      }
      // drapieżniki — sylwetki w tle
      var nPred = clamp(Math.round(world.predators * 0.6), 0, 9);
      predators = [];
      for (var j = 0; j < nPred; j++) {
        predators.push({ x: rnd(j + 21) * W, y: H * (0.2 + rnd(j + 23) * 0.5), dir: rnd(j + 25) > 0.5 ? 1 : -1, sp: 6 + rnd(j + 27) * 8, ph: rnd(j + 29) * 6.28 });
      }
      reconcile(false);
    }

    function reconcile(animate) {
      var target = targetAgents(world.population);
      var floorY = world.niche === 'powietrze' ? H * 0.86 : H * 0.78;
      // dodaj
      while (agents.length < target) {
        agents.push({
          x: 0.15 * W + Math.random() * 0.7 * W,
          y: (world.niche === 'lad') ? floorY - 4 - Math.random() * 18 : H * (0.2 + Math.random() * 0.6),
          ph: Math.random() * 6.28, vx: (Math.random() - 0.5) * 0.3,
          alpha: animate ? 0 : 1, state: 'alive'
        });
      }
      // usuń nadmiar
      if (agents.length > target) {
        if (animate) { for (var k = target; k < agents.length; k++) agents[k].state = 'dying'; }
        else agents.length = target;
      }
    }

    function setWorld(w) {
      var nicheChanged = w.niche !== world.niche;
      world = w;
      if (anim) return; // w trakcie animacji tury — sync po jej zakończeniu
      if (nicheChanged) buildBackdrop();
      else reconcile(false);
      draw(performance.now());
      ensureLoop();
    }

    // Animacja wyniku tury: od popBefore do popAfter, z narodzinami/śmiercią i katastrofą.
    function playTurn(w, lineReport, catastrophe, onDone) {
      world = w;
      buildBackdrop();
      if (reduced) { reconcile(false); draw(performance.now()); if (onDone) onDone(); return; }
      // ustaw bazę na popBefore
      var startTarget = targetAgents(lineReport.popBefore);
      var floorY = world.niche === 'powietrze' ? H * 0.86 : H * 0.78;
      agents = [];
      for (var i = 0; i < startTarget; i++) {
        agents.push({ x: 0.15 * W + Math.random() * 0.7 * W, y: H * (0.2 + Math.random() * 0.6), ph: Math.random() * 6.28, vx: (Math.random() - 0.5) * 0.3, alpha: 1, state: 'alive' });
      }
      anim = {
        start: performance.now(), dur: 1700,
        births: lineReport.births || 0,
        deaths: (lineReport.predationDeaths || 0) + (lineReport.starvationDeaths || 0),
        catDeaths: lineReport.catDeaths || 0,
        catastrophe: catastrophe || null,
        floats: [], onDone: onDone, spawned: false, killed: false, catShown: false
      };
      // etykiety pływające
      if (anim.births) anim.floats.push({ txt: '+' + anim.births, col: '#2f7d5b', at: 0.12 });
      if (anim.deaths) anim.floats.push({ txt: '−' + anim.deaths, col: '#b23b3b', at: 0.4 });
      if (anim.catDeaths) anim.floats.push({ txt: '−' + anim.catDeaths + ' ☄', col: '#b23b3b', at: 0.66 });
      running = true; ensureLoop();
    }

    function stepAnim(now) {
      var p = clamp((now - anim.start) / anim.dur, 0, 1);
      var floorY = world.niche === 'powietrze' ? H * 0.86 : H * 0.78;
      // narodziny — pojawiają się nowe agentki
      if (!anim.spawned && p > 0.12) {
        anim.spawned = true;
        var nb = clamp(Math.round(anim.births / 6), 0, 40);
        for (var i = 0; i < nb; i++) agents.push({ x: 0.15 * W + Math.random() * 0.7 * W, y: H * (0.2 + Math.random() * 0.6), ph: Math.random() * 6.28, vx: (Math.random() - 0.5) * 0.3, alpha: 0, state: 'born' });
      }
      // śmierć — część znika
      if (!anim.killed && p > 0.4) {
        anim.killed = true;
        var nd = clamp(Math.round(anim.deaths / 6), 0, agents.length);
        for (var j = 0; j < nd; j++) { var idx = Math.floor(Math.random() * agents.length); if (agents[idx]) agents[idx].state = 'dying'; }
      }
      // katastrofa — błysk + masowa śmierć
      if (!anim.catShown && anim.catDeaths && p > 0.62) {
        anim.catShown = true;
        var nc = clamp(Math.round(anim.catDeaths / 6), 0, agents.length);
        for (var m = 0; m < nc; m++) { var ix = Math.floor(Math.random() * agents.length); if (agents[ix]) agents[ix].state = 'dying'; }
      }
      // aktualizacja alpha agentów
      for (var a = agents.length - 1; a >= 0; a--) {
        var g = agents[a];
        if (g.state === 'born') { g.alpha = Math.min(1, g.alpha + 0.06); if (g.alpha >= 1) g.state = 'alive'; }
        else if (g.state === 'dying') { g.alpha -= 0.05; if (g.alpha <= 0) agents.splice(a, 1); }
      }
      if (p >= 1) {
        var done = anim.onDone; anim = null;
        reconcile(false); // dociągnij do docelowej liczebności bieżącego świata
        if (done) done();
      }
    }

    function ensureLoop() {
      if (running || anim || !reduced) {
        if (!raf) { t0 = performance.now(); loop(t0); }
      }
    }
    function loop(now) {
      raf = null;
      draw(now);
      if (anim) { stepAnim(now); raf = requestAnimationFrame(loop); return; }
      if (!reduced && document.visibilityState !== 'hidden' && isVisible()) { raf = requestAnimationFrame(loop); }
      else running = false;
    }
    function isVisible() {
      var r = canvas.getBoundingClientRect();
      return r.bottom > 0 && r.top < (window.innerHeight || 800) && r.width > 0;
    }

    // ---------- rysowanie ----------
    function draw(now) {
      if (!W || !H) return;
      var b = biome(world.niche);
      var dark = isDark();
      var floorY = world.niche === 'powietrze' ? H * 0.86 : H * 0.78;

      // niebo/toń — gradient + modyfikacja klimatem/tlenem
      var g = ctx.createLinearGradient(0, 0, 0, H);
      var top = b.sky[0], bot = world.niche === 'lad' || world.niche === 'powietrze' ? b.sky[1] : b.deep;
      if (world.climate === 'zimno') { top = mix(top, '#9fc7e8', 0.4); bot = mix(bot, '#5f86a8', 0.4); }
      else if (world.climate === 'cieplo') { top = mix(top, '#ffe6b0', 0.25); }
      if (dark) { top = mix(top, '#0e1417', 0.45); bot = mix(bot, '#0e1417', 0.5); }
      g.addColorStop(0, top); g.addColorStop(1, bot);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // mgła niskiego tlenu
      if (world.oxygen < 9) {
        ctx.fillStyle = 'rgba(180,180,170,' + clamp((9 - world.oxygen) * 0.05, 0, 0.28) + ')';
        ctx.fillRect(0, 0, W, H);
      }

      var t = now / 1000;

      // słońce / lód w rogu wg klimatu
      if (world.niche === 'lad' || world.niche === 'powietrze') {
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(W - 42, 40, 18, 0, 6.29);
        ctx.fillStyle = world.climate === 'zimno' ? '#cfe4f2' : '#ffd873'; ctx.fill();
        ctx.globalAlpha = 1;
      }

      // dno / grunt
      ctx.fillStyle = dark ? mix(b.floor, '#0e1417', 0.4) : b.floor;
      ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(W, floorY); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

      // flora / pokarm
      ctx.strokeStyle = dark ? mix(b.flora, '#0e1417', 0.3) : b.flora;
      ctx.fillStyle = ctx.strokeStyle;
      flora.forEach(function (f) {
        var sway = reduced ? 0 : Math.sin(t + f.ph) * 3;
        if (world.niche === 'lad' || world.niche === 'powietrze') {
          // kępki trawy
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(f.x, floorY); ctx.quadraticCurveTo(f.x + sway, floorY - f.s * 2, f.x + sway * 1.5, floorY - f.s * 2.6);
          ctx.moveTo(f.x, floorY); ctx.quadraticCurveTo(f.x - 3 + sway, floorY - f.s, f.x - 4 + sway, floorY - f.s * 1.6);
          ctx.stroke();
        } else {
          // plankton / glony
          ctx.globalAlpha = 0.55;
          ctx.beginPath(); ctx.arc(f.x + sway, f.y, f.s * 0.5, 0, 6.29); ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      // drapieżniki w tle (sylwetki)
      predators.forEach(function (p) {
        var px = reduced ? p.x : (p.x + Math.sin(t * 0.3 + p.ph) * 40 * p.dir + W) % W;
        ctx.save();
        ctx.globalAlpha = dark ? 0.5 : 0.32;
        ctx.fillStyle = '#20303a';
        drawFish(px, p.y, 22, p.dir);
        ctx.restore();
      });

      // rój populacji (kierunek C)
      var bcol = has(world.traits, 'endothermy') ? mix(b.body, '#e8944a', 0.35) : b.body;
      agents.forEach(function (a) {
        var bob = reduced ? 0 : Math.sin(t * 1.6 + a.ph) * 3;
        var wob = reduced ? 0 : Math.cos(t * 0.8 + a.ph) * 6;
        ctx.globalAlpha = clamp(a.alpha, 0, 1);
        drawCreature(a.x + wob, a.y + bob, bcol, world.traits, a.state === 'born');
        ctx.globalAlpha = 1;
      });

      // katastrofa — błysk
      if (anim && anim.catastrophe) {
        var pp = clamp((now - anim.start) / anim.dur, 0, 1);
        if (pp > 0.6 && pp < 0.86) {
          ctx.fillStyle = 'rgba(178,59,59,' + (0.5 * (1 - Math.abs(pp - 0.73) / 0.13)) + ')';
          ctx.fillRect(0, 0, W, H);
        }
      }

      // etykiety pływające (+narodziny / −straty)
      if (anim) {
        var ap = clamp((now - anim.start) / anim.dur, 0, 1);
        ctx.textAlign = 'center';
        ctx.font = '700 20px -apple-system, Segoe UI, Roboto, sans-serif';
        anim.floats.forEach(function (fl) {
          if (ap < fl.at || ap > fl.at + 0.4) return;
          var k = (ap - fl.at) / 0.4;
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = fl.col;
          ctx.fillText(fl.txt, W / 2, H * 0.42 - k * 26);
          ctx.globalAlpha = 1;
        });
        ctx.textAlign = 'start';
      }
    }

    function drawCreature(x, y, color, traits, born) {
      var s = 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.lineWidth = 1.4; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round';
      // skrzydła
      if (has(traits, 'flight')) {
        ctx.fillStyle = mix(color, '#ffffff', 0.25);
        ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(-9, -8, -13, -3); ctx.quadraticCurveTo(-7, 0, 0, 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(9, -8, 13, -3); ctx.quadraticCurveTo(7, 0, 0, 2); ctx.fill(); ctx.stroke();
      }
      // ogon
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(13, -4); ctx.lineTo(13, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      // ciało
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0, 0, 6.29); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
      // pancerz
      if (has(traits, 'shell')) {
        ctx.beginPath(); ctx.arc(0, 0, 6, Math.PI, 0); ctx.fillStyle = mix(color, OUTLINE, 0.3); ctx.fill(); ctx.stroke();
      }
      // głowa + oko
      var hr = has(traits, 'big_brain') ? 5.5 : (has(traits, 'brain') ? 4.6 : 3.8);
      ctx.beginPath(); ctx.arc(-8, -0.5, hr, 0, 6.29); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
      if (has(traits, 'eyes')) { ctx.beginPath(); ctx.arc(-9.5, -1.5, 1.3, 0, 6.29); ctx.fillStyle = '#fff'; ctx.fill(); ctx.beginPath(); ctx.arc(-9.8, -1.5, 0.6, 0, 6.29); ctx.fillStyle = OUTLINE; ctx.fill(); }
      // nogi
      if (has(traits, 'limbs')) {
        ctx.beginPath(); ctx.moveTo(-3, 4); ctx.lineTo(-3, 8); ctx.moveTo(3, 4); ctx.lineTo(3, 8); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.4; ctx.stroke();
      }
      if (born) { ctx.strokeStyle = 'rgba(47,125,91,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.29); ctx.stroke(); }
      ctx.restore();
    }
    function drawFish(x, y, size, dir) {
      ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, size * 0.5, size * 0.28, 0, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.moveTo(size * 0.45, 0); ctx.lineTo(size * 0.7, -size * 0.22); ctx.lineTo(size * 0.7, size * 0.22); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -size * 0.14); ctx.lineTo(size * 0.1, -size * 0.4); ctx.lineTo(size * 0.2, -size * 0.14); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // reaguj na zmianę preferencji ruchu
    try {
      var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      var onMq = function () { reduced = mq.matches; if (!reduced) ensureLoop(); };
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    } catch (e) {}

    document.addEventListener('visibilitychange', function () { if (document.visibilityState !== 'hidden') ensureLoop(); });

    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(canvas); }
    else window.addEventListener('resize', resize);

    resize();

    return {
      setWorld: setWorld,
      playTurn: playTurn,
      resize: resize,
      isReduced: function () { return reduced; },
      destroy: function () {
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      }
    };
  }

  return { creatureSvg: creatureSvg, createScene: createScene, BIOMES: BIOMES, biome: biome };
});
