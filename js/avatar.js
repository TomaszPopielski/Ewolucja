/*
 * avatar.js — proceduralny SVG awatar gatunku.
 *
 * Buduje wizualną sylwetkę linii rozwojowej z jej cech (lineage.traits) i
 * niszy (lineage.niche) — czysta funkcja stanu, bez zależności od DOM.
 * Cel: gracz *widzi*, jak zmienia się jego gatunek, zamiast czytać listę nazw
 * cech (ZALOZENIA.md §7 — „obserwuj → decyduj → adaptuj").
 *
 * Warstwy budowane w kolejności: tułów → kończyny/płetwy/skrzydła → tekstury
 * (łuski/futro/kamuflaż/pancerz) → głowa i mózg → detale (zęby, dłoń, jaja,
 * towarzysz społeczny). Kolor tułowia zależy od niszy (CSS var), nie od cech,
 * by sylwetka czytelnie pokazywała środowisko życia.
 */
(function (root, factory) {
  var avatar = factory();
  if (typeof module === 'object' && module.exports) module.exports = avatar;
  else root.Avatar = avatar;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function has(lineage, id) { return lineage.traits.indexOf(id) !== -1; }

  function nicheFill(niche) {
    return ({ woda: 'var(--creature-woda)', przybrzeze: 'var(--creature-przybrzeze)',
      lad: 'var(--creature-lad)', powietrze: 'var(--creature-powietrze)' })[niche] || 'var(--creature-woda)';
  }

  function bodyPath(lineage) {
    // Kształt tułowia lekko zależny od niszy: smuklejszy w wodzie/powietrzu, krępy na lądzie.
    if (lineage.niche === 'lad') return 'M18 44 C18 30 34 20 52 20 C70 20 82 30 84 44 C86 55 72 62 52 62 C32 62 16 56 18 44 Z';
    if (lineage.niche === 'powietrze') return 'M14 40 C16 26 32 18 52 18 C74 18 88 28 88 40 C88 50 72 56 52 56 C30 56 12 52 14 40 Z';
    return 'M12 40 C12 24 30 16 52 16 C76 16 92 26 92 40 C92 54 74 62 52 62 C28 62 10 54 12 40 Z';
  }

  function appendages(lineage) {
    var svg = '';
    if (lineage.niche === 'powietrze' && has(lineage, 'flight')) {
      svg += '<path d="M20 34 C4 26 -2 40 6 50 C16 46 22 40 28 36 Z" fill="var(--creature-shade)"/>' +
        '<path d="M84 34 C100 26 106 40 98 50 C88 46 82 40 76 36 Z" fill="var(--creature-shade)"/>';
    } else if (lineage.niche === 'lad' && has(lineage, 'limbs')) {
      svg += '<path d="M30 58 C29 64 27 68 24 70" stroke="var(--creature-shade)" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M74 58 C75 64 77 68 80 70" stroke="var(--creature-shade)" stroke-width="5" fill="none" stroke-linecap="round"/>';
      if (has(lineage, 'grasping_hand')) {
        svg += '<circle cx="23" cy="71" r="3.4" fill="var(--creature-shade)"/><circle cx="81" cy="71" r="3.4" fill="var(--creature-shade)"/>';
        if (has(lineage, 'tool_use')) svg += '<line x1="81" y1="71" x2="92" y2="60" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>';
      }
    } else {
      svg += '<path d="M14 42 C4 38 0 46 4 54 C10 52 16 48 20 44 Z" fill="var(--creature-shade)"/>' +
        '<path d="M92 42 C102 38 106 46 102 54 C96 52 90 48 86 44 Z" fill="var(--creature-shade)"/>';
    }
    // Ogon — zawsze obecny, subtelny ślad wodnego pochodzenia.
    svg += '<path d="M92 38 C100 34 104 40 100 46 C97 43 94 40 90 40 Z" fill="var(--creature-shade)" opacity="0.85"/>';
    return svg;
  }

  function textures(lineage) {
    var svg = '';
    if (has(lineage, 'scales')) {
      svg += '<g stroke="var(--creature-line)" stroke-width="1.1" fill="none" opacity="0.55">' +
        '<path d="M30 30 a5 5 0 0 1 10 0"/><path d="M44 28 a5 5 0 0 1 10 0"/><path d="M58 30 a5 5 0 0 1 10 0"/>' +
        '<path d="M36 40 a5 5 0 0 1 10 0"/><path d="M50 40 a5 5 0 0 1 10 0"/><path d="M64 40 a5 5 0 0 1 10 0"/></g>';
    }
    if (has(lineage, 'insulation')) {
      svg += '<g fill="var(--creature-shade)" opacity="0.5">' +
        '<circle cx="34" cy="26" r="3.4"/><circle cx="46" cy="22" r="3.4"/><circle cx="58" cy="22" r="3.4"/><circle cx="70" cy="26" r="3.4"/></g>';
    }
    if (has(lineage, 'camouflage')) {
      svg += '<g fill="var(--creature-line)" opacity="0.4">' +
        '<circle cx="38" cy="34" r="3"/><circle cx="60" cy="46" r="2.6"/><circle cx="70" cy="30" r="2.2"/><circle cx="48" cy="50" r="2.4"/></g>';
    }
    if (has(lineage, 'shell')) {
      svg += '<path d="M22 40 C22 22 82 22 82 40 C82 48 72 52 52 52 C32 52 22 48 22 40 Z" fill="none" stroke="var(--creature-shade)" stroke-width="3"/>' +
        '<path d="M52 24 L52 50 M36 27 L40 49 M68 27 L64 49" stroke="var(--creature-shade)" stroke-width="1.4" opacity="0.7"/>';
    }
    return svg;
  }

  function head(lineage) {
    var svg = '';
    var brainTier = has(lineage, 'big_brain') ? 3 : has(lineage, 'brain') ? 2 : has(lineage, 'ganglia') ? 1 : 0;
    var headR = 9 + brainTier * 2.6;
    var hx = 78, hy = 30 - brainTier;
    if (brainTier > 0) {
      svg += '<circle cx="' + hx + '" cy="' + hy + '" r="' + headR + '" fill="var(--creature-shade)" opacity="0.9"/>';
      if (brainTier >= 2) svg += '<path d="M' + (hx - headR * 0.5) + ' ' + hy + ' Q ' + hx + ' ' + (hy - headR * 0.6) + ' ' + (hx + headR * 0.5) + ' ' + hy +
        '" stroke="var(--creature-woda)" stroke-width="1.3" fill="none" opacity="0.6"/>';
    }
    // Oczy — bardziej wyraziste, gdy jest cecha "Oczy".
    var eyeR = has(lineage, 'eyes') ? 3.4 : 1.8;
    svg += '<circle cx="' + (hx + 3) + '" cy="' + (hy - 2) + '" r="' + eyeR + '" fill="#fff" stroke="var(--creature-line)" stroke-width="1"/>' +
      '<circle cx="' + (hx + 4) + '" cy="' + (hy - 2) + '" r="' + (eyeR * 0.45) + '" fill="var(--ink)"/>';
    if (has(lineage, 'jaws') || has(lineage, 'omnivory')) {
      svg += '<path d="M' + (hx - 4) + ' ' + (hy + 6) + ' L' + (hx - 1) + ' ' + (hy + 9) + ' L' + (hx + 2) + ' ' + (hy + 6) +
        ' L' + (hx + 5) + ' ' + (hy + 9) + ' L' + (hx + 8) + ' ' + (hy + 6) + '" stroke="var(--creature-line)" stroke-width="1.3" fill="none"/>';
    }
    return svg;
  }

  function companion(lineage) {
    if (!has(lineage, 'social') && !has(lineage, 'pack_hunting')) return '';
    return '<g transform="translate(-16,14) scale(0.42)" opacity="0.75">' + bodyGroup(lineage, true) + '</g>';
  }

  function bodyGroup(lineage, mini) {
    var fill = nicheFill(lineage.niche);
    var svg = '<path d="' + bodyPath(lineage) + '" fill="' + fill + '" stroke="var(--creature-line)" stroke-width="2"/>';
    if (!mini) svg += appendages(lineage) + textures(lineage);
    svg += head(lineage);
    return svg;
  }

  function reproBadge(lineage) {
    if (has(lineage, 'parental_care')) return '<g transform="translate(4,66)"><ellipse cx="6" cy="0" rx="5" ry="6.5" fill="var(--creature-shade)"/><ellipse cx="14" cy="2" rx="4" ry="5.5" fill="var(--creature-shade)" opacity="0.8"/></g>';
    if (has(lineage, 'amniotic_egg')) return '<ellipse cx="10" cy="68" rx="6" ry="8" fill="var(--creature-shade)"/>';
    if (has(lineage, 'many_eggs')) return '<g fill="var(--creature-shade)"><ellipse cx="6" cy="68" rx="4" ry="5.5"/><ellipse cx="15" cy="70" rx="4" ry="5.5"/><ellipse cx="10" cy="63" rx="4" ry="5.5"/></g>';
    return '';
  }

  /* Zwraca znacznik <svg> gotowy do wstawienia w DOM. opts: { size, mini } */
  function svg(lineage, opts) {
    opts = opts || {};
    var size = opts.size || 96;
    if (!lineage.alive) {
      return '<svg class="avatar-svg avatar-extinct" viewBox="0 0 108 78" width="' + size + '" height="' + (size * 78 / 108) +
        '" aria-hidden="true"><path d="' + bodyPath(lineage) + '" fill="var(--ink-soft)" opacity="0.35" stroke="var(--ink-soft)" stroke-width="2"/>' +
        '<line x1="30" y1="24" x2="74" y2="56" stroke="var(--ink-soft)" stroke-width="3"/>' +
        '<line x1="74" y1="24" x2="30" y2="56" stroke="var(--ink-soft)" stroke-width="3"/></svg>';
    }
    var inner = bodyGroup(lineage) + companion(lineage) + (opts.mini ? '' : reproBadge(lineage));
    return '<svg class="avatar-svg" viewBox="0 0 108 78" width="' + size + '" height="' + (size * 78 / 108) +
      '" role="img" aria-label="Sylwetka gatunku"><g>' + inner + '</g></svg>';
  }

  return { svg: svg };
});
