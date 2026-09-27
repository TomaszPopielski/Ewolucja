/*
 * icons.ts — zestaw ikon w stylu ilustracji naukowej.
 *
 * Każda ikona to rysunek na siatce 24×24: kontur piórkiem (currentColor)
 * i opcjonalny „laweryjny” ton. Konwencja klas wewnątrz rysunku:
 *   .w — plama tonu (kolor z --wash, półprzezroczysta), jak akwarela pod rysunkiem,
 *   .f — pełne wypełnienie tuszem (źrenice, kropki, drobne detale),
 *   .t — cienka kreska (kreskowanie, drugorzędne linie).
 * Wygląd klas definiuje css/styles.css (sekcja „Ikony”). Ikony są ozdobą:
 * zawsze aria-hidden, a znaczenie niesie tekst obok.
 */

// Wspólne rysunki używane pod kilkoma kluczami.
const HELIX =
  '<path class="w" d="M7 3c0 5 10 5 10 9s-10 4-10 9h10c0-5-10-5-10-9s10-4 10-9z" stroke="none"/>' +
  '<path d="M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>' +
  '<path class="t" d="M8.5 6h7M10 9.5h4M10 14.5h4M8.5 18h7"/>';

const BRAIN =
  '<path class="w" d="M12 5.2C11 3.8 8.6 3.6 7.3 5 5.2 5 4.1 7 4.6 8.7 3 9.8 3 12.4 4.5 13.5c-.6 2 .9 3.9 2.9 3.8 1 1.5 3.4 1.6 4.6.2 1.2 1.4 3.6 1.3 4.6-.2 2 .1 3.5-1.8 2.9-3.8 1.5-1.1 1.5-3.7-.1-4.8.5-1.7-.6-3.7-2.7-3.7-1.3-1.4-3.7-1.2-4.7.2z"/>' +
  '<path d="M12 5.2v12.1"/>' +
  '<path class="t" d="M8.6 7.4c1 .3 1.6 1.2 1.4 2.3M6.6 11.2c1.2-.4 2.6.2 3 1.4M8.8 15.3c.2-1 1.1-1.7 2.1-1.6M15.4 7.4c-1 .3-1.6 1.2-1.4 2.3M17.4 11.2c-1.2-.4-2.6.2-3 1.4M15.2 15.3c-.2-1-1.1-1.7-2.1-1.6"/>' +
  '<path d="M12 17.5v3"/>';

const NEURON =
  '<circle class="w" cx="12" cy="11" r="3.2"/><circle class="f" cx="12" cy="11" r="1"/>' +
  '<path d="M9.4 9.1 6 5.5M6 5.5 3.5 5.8M6 5.5 5.8 3M14.6 9.1 18 5.5M18 5.5l2.5.3M18 5.5l.2-2.5M12 14.2V21M12 21l-2.5-1.5M12 21l2.5-1.5M9 12.3l-4.5 2.2"/>';

const EGG =
  '<path class="w" d="M12 3c3.9 0 7 5.6 7 10.5A7 7 0 0 1 5 13.5C5 8.6 8.1 3 12 3z"/>' +
  '<path class="t" d="M8.2 9.5c.6-1.6 1.6-3 2.7-3.7"/>';

const THERMO =
  '<path class="w" d="M10 4.2a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0z"/>' +
  '<circle class="f" cx="12" cy="16.8" r="1.7"/><path d="M12 15V8"/>' +
  '<path class="t" d="M15.5 6.5h1.5M15.5 9h1.5M15.5 11.5h1.5"/>';

const FOOTPRINT =
  '<path class="w" d="M9.5 21c-2.6 0-4.1-2-3.6-4.6.4-2.3 2.2-3.9 4-3.9s3 1.6 2.7 3.9c-.3 2.6-1 4.6-3.1 4.6z"/>' +
  '<ellipse class="f" cx="5.5" cy="10.8" rx="1.2" ry="1.7" transform="rotate(-20 5.5 10.8)"/>' +
  '<ellipse class="f" cx="8.6" cy="8.4" rx="1.2" ry="1.8"/>' +
  '<ellipse class="f" cx="12" cy="8.6" rx="1.2" ry="1.8" transform="rotate(12 12 8.6)"/>' +
  '<ellipse class="f" cx="14.4" cy="11.2" rx="1.1" ry="1.6" transform="rotate(35 14.4 11.2)"/>' +
  '<path class="t" d="M17 5.5c1 .2 2.2.9 2.8 2M16.5 3c1.8.4 3.5 1.6 4.4 3.3"/>';

const SNOWFLAKE =
  '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>' +
  '<path class="t" d="M10 4.5 12 6l2-1.5M10 19.5l2-1.5 2 1.5M4.5 10.2l2.3-.6-.4-2.4M19.5 13.8l-2.3.6.4 2.4M6.4 16.8l.4-2.4-2.3-.6M17.6 7.2l-.4 2.4 2.3.6"/>' +
  '<circle class="w" cx="12" cy="12" r="2"/>';

const METEOR =
  '<circle class="w" cx="15.5" cy="15.5" r="4.5"/>' +
  '<circle class="t" cx="14" cy="14.5" r="1"/><circle class="t" cx="17" cy="16.8" r=".7"/>' +
  '<path d="M12.3 12.3 4 4M11.2 15.7 5.5 10M15.7 11.2 10 5.5"/>' +
  '<path class="t" d="M9 17.5 6.5 15M17.5 9 15 6.5"/>';

const BONE =
  '<path class="w" d="M7.5 5.5a2.2 2.2 0 1 0-3 3 2.2 2.2 0 1 0 3 3l5-5a2.2 2.2 0 1 0 3-3 2.2 2.2 0 1 0-3-3z" transform="translate(2.5 6.5)"/>';

const AMMONITE =
  '<circle class="w" cx="12" cy="12" r="8.5"/>' +
  '<path d="M12 12.5c.8 0 1.2-.8.9-1.4-.5-1-2-1-2.7-.1-1 1.2-.4 3.1 1 3.6 2 .8 4.2-.6 4.5-2.7.4-2.6-1.8-4.9-4.4-5-3.2-.1-5.8 2.6-5.6 5.8.2 3.8 3.6 6.5 7.3 6 4.2-.6 7-4.7 6.3-8.8"/>' +
  '<path class="t" d="M12 3.5v2M16.9 5.1l-1.2 1.6M19.9 9l-1.9.6M4.6 8l1.8.8M4.1 13.5l2-.3M6.6 18.7l1.4-1.4M11.4 20.5l.1-2"/>';

const SPROUT =
  '<path d="M12 21v-9"/>' +
  '<path class="w" d="M12 13C12 8.5 8.5 6 4.5 6.5 4.3 10.7 7.3 13.3 12 13z"/>' +
  '<path class="w" d="M12 11c0-4 3-6.5 7.5-6.5 0 4.2-3 6.8-7.5 6.5z"/>' +
  '<path class="t" d="M12 13 7.5 9M12 11l4-3.5"/><path d="M8 21h8"/>';

const BRANCH =
  '<path d="M12 21v-7M12 14 6.5 8M12 14l5.5-6M6.5 8V4M17.5 8V4M6.5 8 3.5 6"/>' +
  '<circle class="w" cx="6.5" cy="4" r="1.8"/><circle class="w" cx="17.5" cy="4" r="1.8"/>' +
  '<circle class="f" cx="12" cy="14" r="1.2"/>';

const LEAF_MIDRIB =
  '<path class="w" d="M4 20C4 11.5 9.5 5 19.5 4 19.3 13 13.5 19.5 4 20z"/>' +
  '<path d="M4 20 15.5 8.5"/><path class="t" d="M8 16l.2-3.5M8 16h3.4M11 13l.2-3.2M11 13h3.2"/>';

const WAVES =
  '<path class="w" d="M2 10.5c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-1.2V21H2z" stroke="none"/>' +
  '<path d="M2 10.5c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-1.2"/>' +
  '<path class="t" d="M2 14.5c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-1.2M2 18.5c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-1.2"/>';

const ICONS: Record<string, string> = {
  // ---------- Cechy ----------
  'trait:filter_feeding':
    '<path class="w" d="M4 10h16l-1.6 6.5A3 3 0 0 1 15.5 19h-7a3 3 0 0 1-2.9-2.5z"/>' +
    '<path class="t" d="M8 10v8.6M10.7 10v9M13.3 10v9M16 10v8.6"/>' +
    '<circle class="f" cx="7" cy="5.5" r=".9"/><circle class="f" cx="11.5" cy="3.8" r=".9"/>' +
    '<circle class="f" cx="16.5" cy="6" r=".9"/><circle class="f" cx="13.5" cy="7.5" r=".6"/><circle class="f" cx="9" cy="7.8" r=".6"/>',
  'trait:jaws':
    '<path class="w" d="M3 11.5C5.5 5.5 14 4 21 8l-3.5 3.5z"/>' +
    '<path class="w" d="M4 14c3 5 10.5 5.8 14.5 1.5L17 14z"/>' +
    '<path d="M3 11.5C5.5 5.5 14 4 21 8l-3.5 3.5H3zM4 14h13l1.5 1.5C14.5 19.8 7 19 4 14z"/>' +
    '<path class="t" d="M6.5 11.5 7.3 13l.8-1.5.8 1.5.8-1.5.8 1.5.8-1.5.8 1.5.8-1.5M7.5 14l.8-1.4.8 1.4.8-1.4.8 1.4.8-1.4.8 1.4"/>' +
    '<circle class="f" cx="14.5" cy="8.3" r=".9"/>',
  'trait:omnivory':
    '<path class="w" d="M3 20.5C3 13 7.2 7.5 13 7c.4 7-4 12.6-10 13.5z"/>' +
    '<path d="M3 20.5 9.5 12"/><path class="t" d="M5.8 17 6 14.2M5.8 17h2.8"/>' +
    '<path class="w" d="M12.5 16.5c2-2.4 5.2-2.4 7.5 0-2.3 2.4-5.5 2.4-7.5 0z"/>' +
    '<path d="M12.5 16.5 10.3 15v3z"/><circle class="f" cx="17.8" cy="16.2" r=".6"/>' +
    '<circle class="w" cx="17.5" cy="6" r="2"/><circle class="w" cx="20" cy="9" r="1.6"/><path class="t" d="M17.5 4V2.6"/>',
  'trait:fins':
    '<path class="w" d="M5 19C6.5 11 12 5.5 20.5 4.5c-1 6-3.2 11.2-7 14.5z"/>' +
    '<path class="t" d="M5 19 11 7.2M5 19 15.6 5.1M5 19 19.3 8.6M5 19 17.3 13.5M5 19l9.3-1.5"/>' +
    '<path d="M3.5 20.5 5 19"/>',
  'trait:fast_muscle':
    '<path class="w" d="M5 12c3.5-5.2 11.5-5.2 15 0-3.5 5.2-11.5 5.2-15 0z"/>' +
    '<path class="t" d="M8.5 9.2v5.6M11 8.2v7.6M13.5 8.2v7.6M16.2 9.1v5.8"/>' +
    '<path d="M20 12h2.5M2.5 12H5M1.5 8.5h3M1.5 15.5h3"/>',
  'trait:limbs':
    '<path class="w" d="M2.8 4.6a1.8 1.8 0 0 1 2.8-2.1l5.6 6.4a1.8 1.8 0 0 1-2.8 2.3z"/>' +
    '<path d="M9.5 10.3l3.1 6.1M11.4 9.4l3.4 6"/>' +
    '<circle class="w" cx="13.9" cy="16.9" r="1.7"/>' +
    '<path d="M12.7 18.3 10.9 22M13.9 18.6v3.8M15 18.4l1.9 3.3M15.5 17.3l3.4 1.8M12.3 17l-3 .9"/>',
  'trait:flight':
    '<path class="w" d="M3 16C6.5 8.5 13.5 5 21 4.8c-.6 2.4-2.2 4.4-4.6 5.6 1.2.1 2.2.4 3 1-1.6 1.8-3.8 2.8-6.2 2.9.8.5 1.4 1 1.8 1.7C10.7 17.3 6.6 17.4 3 16z"/>' +
    '<path class="t" d="M6.5 14.2c3-.8 6-2.6 8.8-5.2M9.5 15.2c2-.4 4.4-1.3 6.3-2.6M5 11.3c2.6-2 5.6-3.7 9-4.8"/>',
  'trait:grasping_hand':
    '<path class="w" d="M8 21v-5.2L4.8 12.5a1.6 1.6 0 0 1 2.3-2.2L9 12.2V5.2a1.5 1.5 0 0 1 3 0V11V4.3a1.5 1.5 0 0 1 3 0V11V5.8a1.5 1.5 0 0 1 3 0V15c0 3.3-2.3 6-5.5 6z"/>' +
    '<path class="t" d="M12 11v1.5M15 11v1.5M9 12.2V14"/>',
  'trait:scales':
    '<rect class="w" x="3" y="4" width="18" height="16" rx="3"/>' +
    '<path d="M3 8.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>' +
    '<path d="M6 12.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0M3 12.5a3 3 0 0 0 3 0M18 12.5a3 3 0 0 0 3 0"/>' +
    '<path d="M3 16.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  'trait:shell':
    '<ellipse class="w" cx="12" cy="12" rx="7.5" ry="8.5"/>' +
    '<path d="M12 8.3 14.8 10v3.6L12 15.3l-2.8-1.7V10z"/>' +
    '<path class="t" d="M12 8.3V3.5M14.8 10l4-2.2M14.8 13.6l4 2.4M12 15.3v5.2M9.2 13.6l-4 2.4M9.2 10l-4-2.2"/>' +
    '<path class="t" d="M5.8 6.5c-1.2-.8-2-.7-2.5.3M18.2 6.5c1.2-.8 2-.7 2.5.3"/>',
  'trait:camouflage':
    '<path class="w" stroke-dasharray="2.4 1.6" d="M12 4c4 3 5.5 7.8 4.5 12-.7 2.9-2.5 4.7-4.5 5.2-2-.5-3.8-2.3-4.5-5.2C6.5 11.8 8 7 12 4z"/>' +
    '<path class="t" d="M12 5.5v15M12 9.5l2.6-1.6M12 12.5l3.3-1.8M12 15.5l3-1.4M12 9.5 9.4 7.9M12 12.5l-3.3-1.8M12 15.5l-3-1.4"/>' +
    '<path d="M11.3 4.3 9 1.8M12.7 4.3 15 1.8M7.8 9.5 4.5 8M7.4 13.5l-3.4 1M16.2 9.5l3.3-1.5M16.6 13.5l3.4 1"/>',
  'trait:eyes':
    '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/>' +
    '<circle class="w" cx="12" cy="12" r="3.6"/><circle class="f" cx="12" cy="12" r="1.5"/>' +
    '<circle cx="13.3" cy="10.7" r=".4" fill="var(--bg-panel, #fff)" stroke="none"/>',
  'trait:lateral_line':
    '<path class="w" d="M3 12c3-4.6 10.5-5.6 15-2l3-2v8l-3-2c-4.5 3.6-12 2.6-15-2z"/>' +
    '<circle class="f" cx="5.6" cy="10.8" r=".8"/>' +
    '<path class="t" stroke-dasharray=".1 2.2" stroke-width="1.6" d="M7.5 12.3h10"/>' +
    '<path class="t" d="M19.5 6.5c.8 1 .8 2 0 3M19.5 14.5c.8 1 .8 2 0 3"/>',
  'trait:many_eggs':
    '<circle class="w" cx="7" cy="8" r="2.6"/><circle class="w" cx="12.5" cy="6.5" r="2.6"/><circle class="w" cx="17.5" cy="9" r="2.6"/>' +
    '<circle class="w" cx="9" cy="13.5" r="2.6"/><circle class="w" cx="14.8" cy="14.2" r="2.6"/><circle class="w" cx="11.5" cy="19" r="2.6"/>' +
    '<circle class="f" cx="7" cy="8" r=".8"/><circle class="f" cx="12.5" cy="6.5" r=".8"/><circle class="f" cx="17.5" cy="9" r=".8"/>' +
    '<circle class="f" cx="9" cy="13.5" r=".8"/><circle class="f" cx="14.8" cy="14.2" r=".8"/><circle class="f" cx="11.5" cy="19" r=".8"/>',
  'trait:amniotic_egg':
    '<path class="w" d="M12 2.8c3.9 0 7 5.6 7 10.5a7 7 0 0 1-14 0c0-4.9 3.1-10.5 7-10.5z"/>' +
    '<path class="t" d="M12 5c2.8 0 5 4.5 5 8.3a5 5 0 0 1-10 0C7 9.5 9.2 5 12 5z"/>' +
    '<path d="M10.3 14.5a2.3 2.3 0 1 1 2.8 2.2c-1.5.3-2.8-.6-2.8-2.2z"/><circle class="f" cx="13" cy="13.6" r=".5"/>' +
    '<circle class="w" cx="14.5" cy="10" r="1.4"/>',
  'trait:parental_care':
    '<path d="M3.5 12.5C5.5 6 16 4.5 20.5 11"/>' +
    '<path class="w" d="M3 15.5h18c-1.4 3.6-4.8 5-9 5s-7.6-1.4-9-5z"/>' +
    '<path class="t" d="M5 17.5l2.5-1M9 19l3-2.5M13.5 19.5l3-2.8M17.5 18l1.8-1.5"/>' +
    '<ellipse class="w" cx="9.8" cy="13.4" rx="1.7" ry="2.1"/><ellipse class="w" cx="14.2" cy="13.4" rx="1.7" ry="2.1"/>' +
    '<circle class="f" cx="17.8" cy="8.1" r=".7"/>',
  'trait:endothermy':
    THERMO + '<path class="t" d="M19 14c.8-.9.8-1.9 0-2.8s-.8-1.9 0-2.8M5 14c.8-.9.8-1.9 0-2.8s-.8-1.9 0-2.8"/>',
  'trait:insulation':
    '<path class="w" d="M19.5 3C12 3 6.5 8.5 6.5 16c6 0 13-5.5 13-13z"/>' +
    '<path d="M19.5 3 6.5 16 4 21"/>' +
    '<path class="t" d="M16.5 6.2 13 5.2M14.5 8.3l-4-1M12.3 10.5l-4-.7M16.6 6.3l1.4 3.4M14.4 8.5l1.7 3.7M12.3 10.7l1.5 3.5M10 13l-3.2-.3"/>',
  'trait:ganglia':
    '<circle class="w" cx="6" cy="7" r="2.2"/><circle class="w" cx="17.5" cy="6" r="2.2"/><circle class="w" cx="12" cy="17" r="2.6"/>' +
    '<circle class="f" cx="6" cy="7" r=".7"/><circle class="f" cx="17.5" cy="6" r=".7"/><circle class="f" cx="12" cy="17" r=".8"/>' +
    '<path d="M8.1 7.6c2.5.6 5 .2 7.3-1M7.1 8.9l3.6 5.9M16.6 8l-3.3 6.7"/>' +
    '<path class="t" d="M3.8 6.2 2.5 5M5.5 4.9 5 3M19.5 5l1.8-1.2M19 8l1.7 1.4M10 19l-2 2M14 19l2 2"/>',
  'trait:brain': BRAIN,
  'trait:pack_hunting':
    '<circle class="w" cx="12" cy="12" r="2.6"/><circle class="f" cx="12" cy="12" r=".9"/>' +
    '<path d="M3.5 4.5 8 9M8 9H5M8 9V6M20.5 4.5 16 9M16 9h3M16 9V6M12 21.5V16M12 16l-2.2 2.2M12 16l2.2 2.2"/>',
  'trait:big_brain':
    BRAIN + '<path class="t" d="M4.5 2.5l1.3 1.4M19.5 2.5l-1.3 1.4M12 .8v1.4M1.2 8h1.5M21.3 8h1.5"/>',
  'trait:social':
    '<circle class="w" cx="7" cy="8" r="2.5"/><circle class="w" cx="17" cy="8" r="2.5"/><circle class="w" cx="12" cy="10" r="2.8"/>' +
    '<path d="M2.5 19c0-3.2 2-5.5 4.5-5.5 1.1 0 2 .3 2.8 1M21.5 19c0-3.2-2-5.5-4.5-5.5-1.1 0-2 .3-2.8 1M6.5 21c0-3.8 2.4-6.5 5.5-6.5s5.5 2.7 5.5 6.5"/>',
  'trait:tool_use':
    '<path class="w" d="M12 2.5c3.8 3.8 6 8.8 5.2 13.6-.7 4.4-9.7 4.4-10.4 0C6 11.3 8.2 6.3 12 2.5z"/>' +
    '<path class="t" d="M12 2.5 11 8l1.5 4-1 4.5M9.2 6.5 11 8M14.6 6 11 8M8.2 11.5l4.3.5M15.8 11l-3.3 1M7.3 15.5l4.2 1M16.4 15.2l-4.9 1.3"/>',

  // ---------- Kategorie cech ----------
  'cat:pokarm': LEAF_MIDRIB,
  'cat:lokomocja': FOOTPRINT,
  'cat:obrona':
    '<path class="w" d="M12 2.8 19.5 5.5v6c0 4.6-3.2 8.3-7.5 9.7-4.3-1.4-7.5-5.1-7.5-9.7v-6z"/>' +
    '<path class="t" d="M12 2.8v18.4M4.5 11.5h15"/>',
  'cat:zmysly':
    '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/>' +
    '<circle class="w" cx="12" cy="12" r="3.6"/><circle class="f" cx="12" cy="12" r="1.5"/>',
  'cat:rozrod': EGG,
  'cat:termoregulacja': THERMO,
  'cat:uklad_nerwowy': NEURON,

  // ---------- Nisze ----------
  'niche:woda': WAVES,
  'niche:przybrzeze':
    '<path class="w" d="M2 18.5c3-1.8 6.5-2.6 10-2.6s7 .8 10 2.6V21H2z"/>' +
    '<path d="M2 18.5c3-1.8 6.5-2.6 10-2.6s7 .8 10 2.6"/>' +
    '<path d="M8 16.2V10M8 13 5.5 10.5V8M8 11.5l2.5-2.5V6.5M5.5 8 4.5 6.5M5.5 8l1-1.8M10.5 6.5l-1-1.7M10.5 6.5l1.2-1.4"/>' +
    '<path class="t" d="M14 10c1.5-1.2 3-1.2 4.5 0s3 1.2 4 .4M14 7c1.5-1.2 3-1.2 4.5 0s3 1.2 4 .4"/>',
  'niche:lad':
    '<path class="w" d="M2 19.5 8 11l3.5 4.5L15 11l7 8.5z"/>' +
    '<path d="M2 19.5 8 11l3.5 4.5L15 11l7 8.5z"/>' +
    '<path class="t" d="M8 11l-1 3M15 11l1.4 3.5M13 14l-1 2"/>' +
    '<circle class="w" cx="18.5" cy="5" r="2.2"/><path class="t" d="M18.5 1.5v.8M22 5h-.8M15 5h.8"/>',
  'niche:powietrze':
    '<path class="w" d="M6.5 19a3.5 3.5 0 0 1-.5-7 5 5 0 0 1 9.6-1.3A4 4 0 1 1 17 19z"/>' +
    '<path d="M6.5 19a3.5 3.5 0 0 1-.5-7 5 5 0 0 1 9.6-1.3A4 4 0 1 1 17 19z"/>' +
    '<path d="M3 6c1.2-1.2 2.4-1.2 3.3.2C7.2 4.8 8.4 4.8 9.6 6M13.5 4c.9-.8 1.8-.8 2.4.2.6-1 1.5-1 2.4-.2"/>',

  // ---------- Scenariusze ----------
  'scenario:full': HELIX,
  'scenario:land': FOOTPRINT,
  'scenario:ice': SNOWFLAKE,

  // ---------- Karty wiedzy ----------
  'know:intro': HELIX,
  'know:mutation_good':
    '<path class="w" d="M9.5 3h5v5.5l5 9.5A2 2 0 0 1 17.7 21H6.3a2 2 0 0 1-1.8-3l5-9.5z" stroke="none"/>' +
    '<path d="M9 3h6M9.5 3v5.5l-5 9.5A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-3l-5-9.5V3"/>' +
    '<path class="t" d="M7 15c1.5-1.2 3-1.2 5 0s3.5 1.2 5 0"/>' +
    '<circle class="f" cx="10.5" cy="17.5" r=".8"/><circle class="f" cx="13.5" cy="12" r=".6"/>',
  'know:mutation_bad':
    '<path class="w" d="M12 3.5 21.5 20h-19z"/><path d="M12 3.5 21.5 20h-19z"/>' +
    '<path d="M12 9.5v5"/><circle class="f" cx="12" cy="17.2" r="1"/>',
  'know:predation':
    '<path class="w" d="M5 16C7.5 11 9.5 6 14 3c-.5 4.5.5 9 3.5 13z"/>' +
    '<path d="M5 16C7.5 11 9.5 6 14 3c-.5 4.5.5 9 3.5 13"/>' +
    '<path d="M2 16c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-1.2"/>' +
    '<path class="t" d="M2 20c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-1.2"/>',
  'know:coevolution':
    '<path d="M4.5 10A8 8 0 0 1 18 6.2M19.5 14A8 8 0 0 1 6 17.8"/>' +
    '<path d="M18 2.5v3.7h-3.7M6 21.5v-3.7h3.7"/>' +
    '<circle class="w" cx="12" cy="12" r="2.5"/>',
  'know:starvation':
    '<path class="w" d="M5 19c0-7.5 4.5-13 13-14.5.3 8.5-4.8 14-13 14.5z"/>' +
    '<path d="M5 19 13.5 9.5"/>' +
    '<path class="t" d="M8.5 15.5l-.5-3M8.5 15.5l3.2.3M11 12.5l-.3-2.5M11 12.5h2.8"/>' +
    '<path class="t" stroke-dasharray="1.5 2" d="M16 13.5c1.2 1.5 1.6 3.5 1 6"/>',
  'know:cold': SNOWFLAKE,
  'know:land': FOOTPRINT,
  'know:niche':
    '<path class="w" d="M3 6.5 8.5 4.5l7 2.5L21 5v12.5L15.5 19.5l-7-2.5L3 19z"/>' +
    '<path d="M3 6.5 8.5 4.5l7 2.5L21 5v12.5L15.5 19.5l-7-2.5L3 19zM8.5 4.5V17M15.5 7v12.5"/>' +
    '<circle class="f" cx="12" cy="11" r="1.1"/><path class="t" stroke-dasharray="1 1.5" d="M5 15c2-1 4-3 7-4 2.5-.8 4.5 0 7-1.5"/>',
  'know:events': SPROUT,
  'know:intelligence': BRAIN,
  'know:speciation': BRANCH,
  'know:extinction': METEOR,
  'know:milestone': AMMONITE,

  // ---------- Elementy interfejsu ----------
  'ui:brand': HELIX,
  'ui:meteor': METEOR,
  'ui:bone': BONE,
  'ui:ammonite': AMMONITE,
  'ui:sprout': SPROUT,
  'ui:branch': BRANCH,
  'ui:tree':
    '<path d="M12 21v-9M12 15l-4-3M12 13.5l4.5-3.5"/>' +
    '<path class="w" d="M12 2.5c3 0 5 2 5 4 2 .5 3 2 3 3.8 0 2.3-2 4-4.5 4h-7C6 14.3 4 12.6 4 10.3 4 8.5 5 7 7 6.5c0-2 2-4 5-4z"/>' +
    '<path d="M8.5 21h7"/>',
  'ui:lock':
    '<rect class="w" x="5" y="10.5" width="14" height="10" rx="2"/>' +
    '<path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle class="f" cx="12" cy="15" r="1.3"/><path d="M12 15.5v2.2"/>',
  'ui:hourglass':
    '<path d="M6 3h12M6 21h12"/>' +
    '<path class="w" d="M7.5 3.5h9c0 4-4.5 6-4.5 8.5S16.5 16.5 16.5 20.5h-9c0-4 4.5-6 4.5-8.5S7.5 7.5 7.5 3.5z"/>' +
    '<path class="f" d="M9.5 20.2c.5-1.8 1.5-2.7 2.5-3.2 1 .5 2 1.4 2.5 3.2z"/>',
  'ui:check':
    '<circle class="w" cx="12" cy="12" r="9"/><path d="M7.5 12.5l3 3 6-6.5"/>',
  'ui:star':
    '<path class="w" d="M12 2.8l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.6l-5.6 3.2 1.3-6.2L3 9.3l6.3-.7z"/>',
  'ui:balance':
    '<path d="M12 3.5v17M7 20.5h10M4.5 7h15M12 3.5l-7.5 3.5M12 3.5 19.5 7"/>' +
    '<path class="w" d="M2 13.5 4.5 7 7 13.5a2.5 2.5 0 0 1-5 0zM17 13.5 19.5 7l2.5 6.5a2.5 2.5 0 0 1-5 0z"/>',
  'ui:sun':
    '<circle class="w" cx="12" cy="12" r="4.2"/>' +
    '<path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  'ui:snow': SNOWFLAKE,
  'ui:mild':
    '<circle class="w" cx="9" cy="9" r="3.5"/><path class="t" d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1 1M13.6 4.4l-1 1"/>' +
    '<path class="w" d="M8.5 20a3.2 3.2 0 0 1-.4-6.4 4.5 4.5 0 0 1 8.6-1.1A3.8 3.8 0 1 1 17.5 20z"/>' +
    '<path d="M8.5 20a3.2 3.2 0 0 1-.4-6.4 4.5 4.5 0 0 1 8.6-1.1A3.8 3.8 0 1 1 17.5 20z"/>',
  'ui:target':
    '<circle class="w" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle class="f" cx="12" cy="12" r="2"/>',
  'ui:book':
    '<path class="w" d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/>' +
    '<path d="M12 6.5V20"/><path class="t" d="M6 8.5c1.5-.1 2.8.1 4 .6M6 11.5c1.5-.1 2.8.1 4 .6M14 9.1c1.2-.5 2.5-.7 4-.6M14 12.1c1.2-.5 2.5-.7 4-.6"/>',
  'ui:bulb':
    '<path class="w" d="M9 17.5v-1.8c-2-1.2-3.5-3.3-3.5-5.9a6.5 6.5 0 0 1 13 0c0 2.6-1.5 4.7-3.5 5.9v1.8z"/>' +
    '<path d="M9.5 20.5h5M10.5 17.5l-.5-5 2 1.5 2-1.5-.5 5"/>',
  'ui:paw':
    '<path class="w" d="M12 12.5c2.8 0 5.5 3 5.5 5.5 0 1.8-1.5 2.5-3 2.5-1 0-1.6-.5-2.5-.5s-1.5.5-2.5.5c-1.5 0-3-.7-3-2.5 0-2.5 2.7-5.5 5.5-5.5z"/>' +
    '<ellipse class="w" cx="5" cy="11" rx="1.8" ry="2.3"/><ellipse class="w" cx="9" cy="6.5" rx="1.8" ry="2.4"/>' +
    '<ellipse class="w" cx="15" cy="6.5" rx="1.8" ry="2.4"/><ellipse class="w" cx="19" cy="11" rx="1.8" ry="2.3"/>',
  'ui:document':
    '<path class="w" d="M6 2.5h8.5L19 7v14.5H6z"/><path d="M14.5 2.5V7H19"/>' +
    '<path class="t" d="M9 11h7M9 14h7M9 17h4.5"/>',
  'ui:close': '<path d="M6 6l12 12M18 6 6 18"/>',
  'ui:fossil': AMMONITE
};

export type IconKey = keyof typeof ICONS;

/** Czy istnieje ikona pod danym kluczem. */
export function hasIcon(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICONS, key);
}

/** Wszystkie klucze — do katalogu ikon i testów wizualnych. */
export function iconKeys(): string[] {
  return Object.keys(ICONS);
}

/**
 * Zwraca znacznik <svg> ikony albo pusty napis, gdy klucza nie ma
 * (wtedy wywołujący może pokazać zapasowy znak).
 */
export function icon(key: string, extraClass?: string): string {
  const body = ICONS[key];
  if (!body) return '';
  const cls = 'ico' + (extraClass ? ' ' + extraClass : '');
  return (
    '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ' +
    'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    body +
    '</svg>'
  );
}
