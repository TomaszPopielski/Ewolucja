/*
 * ui.js — kontroler interfejsu.
 * Spina dane (GameData), silnik (Engine), grafikę (Art) i i18n (GameI18n) z DOM.
 * Logika gry jest w silniku, rysowanie SVG w art.js; tutaj render, zdarzenia,
 * zapis lokalny, cofanie (tryb nauczyciela), samouczek, kolejka okien po turze
 * (raport → quiz → nowa era → mutacje), tryb dla daltonistów i tryb tablicy.
 */
(function () {
  'use strict';

  var DATA = window.GameData;
  var Engine = window.Engine;
  var Art = window.Art;
  var T = window.GameI18n.t;
  var SAVE_KEY = 'ewolucja.save.v5';
  var TUTORIAL_KEY = 'ewolucja.tutorialDone.v5';
  var PREFS_KEY = 'ewolucja.prefs';

  var state = null;
  var undoStack = [];
  var UNDO_LIMIT = 50;
  var prefs = { cb: false, present: false, onlyAvailable: false, tab: 'all' };
  var lastReport = null;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    screenStart: $('screen-start'), screenGame: $('screen-game'), screenEnd: $('screen-end'),
    formStart: $('form-start'), speciesInput: $('species-name'), seedInput: $('seed-input'), introGoal: $('intro-goal'),
    introHero: $('intro-hero'), scenarioCards: $('scenario-cards'), brandMark: $('brand-mark'),
    ep: $('ep-value'), pop: $('pop-value'), era: $('era-value'), eraDates: $('era-dates'),
    intel: $('intel-value'), goalSub: $('goal-sub'), hudEp: $('hud-ep'), hudPop: $('hud-pop'),
    timeline: $('timeline'), scene: $('scene'),
    lineageChips: $('lineage-chips'), nicheButtons: $('niche-buttons'),
    btnSpeciate: $('btn-speciate'), btnTree: $('btn-tree'), btnMap: $('btn-map'),
    portrait: $('portrait'), speciesName: $('species-name-display'), speciesNiche: $('species-niche'),
    sparkline: $('sparkline'), forecastBody: $('forecast-body'), radar: $('radar'),
    tradeoffNotes: $('tradeoff-notes'), statsList: $('stats-list'),
    envName: $('env-name'), envNote: $('env-note'), envCatastrophe: $('env-catastrophe'), envStats: $('env-stats'), envOmen: $('env-omen'),
    traits: $('traits-container'), traitTabs: $('trait-tabs'), filterAvailable: $('filter-available'),
    btnSimulate: $('btn-simulate'), btnSimulateMobile: $('btn-simulate-mobile'), btnUndo: $('btn-undo'),
    mobileEp: $('mobile-ep'), mobilePop: $('mobile-pop'),
    modalReport: $('modal-report'), reportBox: $('report-box'), reportHero: $('report-hero'), reportTitle: $('report-title'),
    reportEvent: $('report-event'), reportBody: $('report-body'), reportAch: $('report-ach'),
    reportKnowledge: $('report-knowledge'), btnReportClose: $('btn-report-close'),
    eraPlate: $('era-plate'), eraPlateArt: $('era-plate-art'), eraPlateTitle: $('era-plate-title'), eraPlateDates: $('era-plate-dates'),
    eraPlateIntro: $('era-plate-intro'), eraPlateMilestone: $('era-plate-milestone'), btnEraPlate: $('btn-era-plate'),
    modalMutation: $('modal-mutation'), mutationHint: $('mutation-hint'), mutationOptions: $('mutation-options'), btnMutationReject: $('btn-mutation-reject'),
    modalQuiz: $('modal-quiz'), quizTitle: $('quiz-title'), quizHint: $('quiz-hint'), quizBody: $('quiz-body'), btnQuizDone: $('btn-quiz-done'),
    modalCodex: $('modal-codex'), codexBody: $('codex-body'), btnCodexClose: $('btn-codex-close'),
    modalAch: $('modal-ach'), achBody: $('ach-body'), btnAchClose: $('btn-ach-close'), btnAchievements: $('btn-achievements'),
    modalTree: $('modal-tree'), treeContainer: $('tree-container'), btnTreeClose: $('btn-tree-close'),
    modalMap: $('modal-map'), mapContainer: $('map-container'), btnMapClose: $('btn-map-close'),
    modalSpeciate: $('modal-speciate'), formSpeciate: $('form-speciate'),
    speciateName: $('speciate-name'), speciateHint: $('speciate-hint'), btnSpeciateCancel: $('btn-speciate-cancel'),
    modalConfirm: $('modal-confirm'), confirmMessage: $('confirm-message'),
    btnConfirmYes: $('btn-confirm-yes'), btnConfirmNo: $('btn-confirm-no'),
    endEmblem: $('end-emblem'), endTitle: $('end-title'), endSummary: $('end-summary'), endScore: $('end-score'),
    endChart: $('end-chart'), endAch: $('end-ach'), endStats: $('end-stats'),
    btnPlayAgain: $('btn-play-again'), btnOpenCodexEnd: $('btn-open-codex-end'), btnEndTree: $('btn-end-tree'),
    btnSummary: $('btn-summary'),
    modalSummary: $('modal-summary'), summaryText: $('summary-text'), btnSummaryClose: $('btn-summary-close'),
    btnSummaryCopy: $('btn-summary-copy'), btnSummaryDownload: $('btn-summary-download'),
    btnCodex: $('btn-codex'), btnRestart: $('btn-restart'), btnCb: $('btn-cb'), btnPresent: $('btn-present'),
    tutorial: $('tutorial'), tutorialProgress: $('tutorial-progress'),
    tutorialTitle: $('tutorial-title'), tutorialText: $('tutorial-text'),
    btnTutorialSkip: $('btn-tutorial-skip'), btnTutorialNext: $('btn-tutorial-next'),
    toasts: $('toasts')
  };

  var STAT_META = [
    { key: 'feeding', label: 'Odżywianie' }, { key: 'defense', label: 'Obrona' },
    { key: 'reproduction', label: 'Rozród' }, { key: 'mobility', label: 'Mobilność' },
    { key: 'metabolism', label: 'Metabolizm' }, { key: 'intelligence', label: 'Inteligencja' }
  ];
  var CLIMATE = { zimno: 'zimno', cieplo: 'ciepło', umiarkowanie: 'umiarkowanie' };
  var CLIMATE_ICON = { zimno: 'snow', cieplo: 'sun', umiarkowanie: 'cloud' };

  // ===================== Narzędzia =====================
  function icon(name, cls) { return Art.icon(name, cls); }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fillIcons(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-icon]'), function (n) {
      if (!n.firstChild) n.innerHTML = icon(n.getAttribute('data-icon'));
    });
  }
  function traitById(id) { return DATA.TRAITS.filter(function (x) { return x.id === id; })[0]; }
  function traitName(id) { var t = traitById(id); return t ? t.name : id; }
  function nicheLabel(n) { return (DATA.NICHES[n] && DATA.NICHES[n].label) || n; }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  // ===================== Preferencje (daltonizm, tablica) =====================
  function loadPrefs() { try { var p = JSON.parse(localStorage.getItem(PREFS_KEY)); if (p) for (var k in p) prefs[k] = p[k]; } catch (e) {} }
  function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {} }
  function applyPrefs() {
    document.body.classList.toggle('cb', !!prefs.cb);
    document.body.classList.toggle('present', !!prefs.present);
    el.btnCb.setAttribute('aria-pressed', String(!!prefs.cb));
    el.btnPresent.setAttribute('aria-pressed', String(!!prefs.present));
    el.filterAvailable.checked = !!prefs.onlyAvailable;
  }

  // ===================== Zapis / wczytanie =====================
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
  function loadSaved() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY));
      return (s && s.version === 5 && s.status === 'playing') ? s : null;
    } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

  // ===================== Cofanie =====================
  function pushUndo() { undoStack.push(JSON.stringify(state)); if (undoStack.length > UNDO_LIMIT) undoStack.shift(); }
  function onUndo() { if (!undoStack.length) return; state = JSON.parse(undoStack.pop()); save(); renderAll(); }
  function updateUndoButton() {
    el.btnUndo.disabled = (undoStack.length === 0);
    el.btnUndo.textContent = '↶ Cofnij' + (undoStack.length ? ' (' + undoStack.length + ')' : '') + ' — tryb nauczyciela';
  }

  function showScreen(name) {
    el.screenStart.hidden = name !== 'start';
    el.screenGame.hidden = name !== 'game';
    el.screenEnd.hidden = name !== 'end';
    document.body.classList.toggle('in-game', name === 'game');
    window.scrollTo(0, 0);
  }

  function newGame(speciesName, opts) {
    state = Engine.createInitialState(DATA, speciesName, opts || {});
    undoStack = [];
    save();
    showScreen('game');
    renderAll();
    maybeStartTutorial();
  }

  // ===================== Ekran startowy =====================
  var SCENARIO_ICONS = { full: 'dna', land: 'lad', ice: 'snow' };
  function scenarioOpts(sc) {
    var seed = parseInt(el.seedInput.value, 10);
    return { difficulty: sc.difficulty, startEra: sc.startEra, startEp: sc.startEp,
      goal: sc.goal, startTraits: sc.startTraits, scenarioId: sc.id, seed: isNaN(seed) ? undefined : seed };
  }
  function renderScenarios() {
    el.scenarioCards.innerHTML = '';
    DATA.SCENARIOS.forEach(function (sc) {
      var diff = DATA.DIFFICULTIES[sc.difficulty];
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'scenario-card diff-' + sc.difficulty;
      card.innerHTML = '<span class="scenario-icon">' + icon(SCENARIO_ICONS[sc.id] || 'dna') + '</span>' +
        '<span class="scenario-name">' + sc.name + '</span>' +
        '<span class="scenario-diff">' + diff.label + ' · cel: inteligencja ' + (sc.goal != null ? sc.goal : diff.goal) + ' + narzędzia</span>' +
        '<span class="scenario-intro">' + sc.intro + '</span>';
      card.addEventListener('click', function () {
        newGame((el.speciesInput.value || '').trim() || 'Prazwierzę', scenarioOpts(sc));
      });
      el.scenarioCards.appendChild(card);
    });
  }
  function renderHero() {
    var demo = { id: 'L0', name: 'Prazwierzę', traits: ['fins', 'eyes', 'scales'] };
    var demo2 = { id: 'L2', name: 'Kuzyn', traits: ['fins', 'limbs', 'eyes', 'ganglia', 'brain'] };
    el.introHero.innerHTML = '<div class="hero-sea">' + Art.creature(demo, { size: 150, label: 'Przykładowe stworzenie' }) +
      '<span class="hero-arrow">→</span>' + Art.creature(demo2, { size: 150, label: 'Stworzenie po ewolucji' }) + '</div>';
  }

  // ===================== Render — HUD =====================
  function renderHud(prev) {
    setAnimated(el.ep, state.ep);
    var pop = Engine.totalPopulation(state);
    setAnimated(el.pop, pop);
    if (prev) pulse(el.hudPop, pop >= prev.pop ? 'pulse-up' : 'pulse-down');
    var era = Engine.currentEra(DATA, state);
    var len = era.turns.length;
    var tno = Math.min(state.turn + 1, len);
    el.era.textContent = era.name + ' · tura ' + tno + '/' + len;
    el.eraDates.textContent = era.dates || '';
    var g = Engine.goalProgress(DATA, state);
    el.intel.textContent = g.intelligence + ' / ' + g.goal;
    el.goalSub.innerHTML = (g.hasWinTrait ? icon('check', 'ok') : icon('lock')) + ' używanie narzędzi';
    el.mobileEp.textContent = state.ep; el.mobilePop.textContent = pop;
  }
  function setAnimated(node, value) {
    if (node.textContent !== String(value)) {
      node.textContent = value;
      node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash');
    }
  }
  function pulse(node, cls) { node.classList.remove('pulse-up', 'pulse-down'); void node.offsetWidth; node.classList.add(cls); }

  // ===================== Render — oś czasu gry =====================
  function renderTimeline() {
    var html = '';
    var curG = Engine.globalTurn(DATA, Math.min(state.eraIndex, DATA.ERAS.length), state.eraIndex >= DATA.ERAS.length ? 0 : state.turn);
    var startG = Engine.globalTurn(DATA, state.startEra || 0, 0);
    var acc = 0;
    DATA.ERAS.forEach(function (era, ei) {
      html += '<div class="tl-era tl-era-' + ei + (acc + era.turns.length <= startG ? ' skipped' : '') + '" style="flex:' + era.turns.length + ' 1 0">' +
        '<div class="tl-era-name">' + era.name + '<span class="tl-dates">' + era.dates + '</span></div><div class="tl-cells">';
      era.turns.forEach(function (t, ti) {
        var g = acc + ti, env = Engine.turnEnv(DATA, state, ei, ti);
        var cat = env && env.catastrophe;
        var showCat = cat && (!cat.minor || g === curG);
        var cls = 'tl-cell' + (g < curG ? ' done' : '') + (g === curG ? ' current' : '') + (showCat ? ' cat' : '') + (g < startG ? ' skipped' : '');
        var title = (ti + 1) + '. ' + t.title + (showCat ? ' — ' + cat.name : '');
        html += '<div class="' + cls + '" title="' + escapeHtml(title) + '">' + (showCat ? icon('comet') : '') + '</div>';
      });
      html += '</div></div>';
      acc += era.turns.length;
    });
    el.timeline.innerHTML = html;
  }

  // ===================== Render — scena i środowisko =====================
  function renderScene() {
    var env = Engine.currentTurnEnv(DATA, state);
    el.scene.innerHTML = Art.scene({ data: DATA, engine: Engine, state: state, env: env, omen: !!Engine.upcomingOmen(DATA, state) });
  }
  function onSceneClick(e) {
    if (!state || state.status !== 'playing') return;
    var t = e.target;
    var lin = t.closest ? t.closest('[data-lineage]') : null;
    if (lin) { onSelectLineage(lin.getAttribute('data-lineage')); return; }
    var zone = t.closest ? t.closest('.zone') : null;
    if (!zone) return;
    var niche = zone.getAttribute('data-niche');
    var a = Engine.getActiveLineage(state);
    if (a.niche === niche) return;
    var can = Engine.canMigrate(DATA, state, a, niche);
    if (!can.ok) { toast(can.error, 'warn'); return; }
    onMigrateTo(niche);
  }
  function renderEnv() {
    var env = Engine.currentTurnEnv(DATA, state);
    if (!env) {
      el.envName.textContent = 'Era dobiega końca';
      el.envNote.textContent = ''; el.envStats.innerHTML = ''; el.envCatastrophe.hidden = true; el.envOmen.hidden = true;
      return;
    }
    el.envName.textContent = env.title;
    el.envNote.textContent = env.note;
    var a = Engine.getActiveLineage(state);
    var ne = Engine.envForNiche(DATA, env, a.niche);
    var ctx = Engine.contextFor(DATA, state, a);
    el.envStats.innerHTML =
      chip(icon(CLIMATE_ICON[env.climate] || 'cloud') + ' ' + CLIMATE[env.climate], 'Klimat') +
      chip(icon('oxygen') + ' tlen ' + env.oxygen, 'Tlen: wyższy obniża koszt metabolizmu') +
      chip(icon('leaf') + ' pokarm ' + Math.round(ne.food) + (ctx.rivalStrength ? ' <small>(−' + (Math.round(ctx.rivalStrength * 5) / 10) + ' rywal)</small>' : ''), 'Pokarm w niszy aktywnej linii') +
      chip(icon('fang') + ' drapieżcy ' + Math.round(ne.predators + (ctx.predatorLevel || 0)), 'Presja drapieżników w niszy (z koewolucją)');
    if (env.catastrophe) {
      el.envCatastrophe.hidden = false;
      el.envCatastrophe.innerHTML = icon('comet') + ' <strong>' + escapeHtml(env.catastrophe.name) + '</strong> — uderzy w: ' +
        env.catastrophe.niches.map(nicheLabel).join(', ') + '. Rozważ migrację lub specjację!';
    } else el.envCatastrophe.hidden = true;
    var omen = Engine.upcomingOmen(DATA, state);
    el.envOmen.hidden = !omen;
    if (omen) el.envOmen.innerHTML = icon('eye') + ' <strong>Zwiastun:</strong> ' + escapeHtml(omen);
  }
  function chip(html, title) { return '<span class="env-chip" title="' + escapeHtml(title || '') + '">' + html + '</span>'; }

  // ===================== Render — linie / nisze =====================
  function renderLineageBar() {
    el.lineageChips.innerHTML = '';
    state.lineages.forEach(function (l) {
      var chipEl = document.createElement('button');
      chipEl.type = 'button';
      chipEl.className = 'lineage-chip';
      if (!l.alive) chipEl.classList.add('extinct');
      if (l.id === state.activeLineageId) chipEl.classList.add('active');
      chipEl.disabled = !l.alive;
      chipEl.style.setProperty('--lc', Art.lineageColor(l));
      chipEl.innerHTML = '<span class="chip-dot"></span>' + (l.alive ? icon(l.niche) : icon('skull')) + ' ' + escapeHtml(l.name) +
        '<span class="lineage-chip-pop">' + (l.alive ? l.population : 'wymarła') + '</span>';
      if (l.alive) chipEl.addEventListener('click', function () { onSelectLineage(l.id); });
      el.lineageChips.appendChild(chipEl);
    });

    var can = Engine.canSpeciate(DATA, state);
    el.btnSpeciate.disabled = !can.ok || state.status !== 'playing';
    el.btnSpeciate.title = can.ok ? 'Rozdziel aktywną linię (koszt ' + can.cost + ' EP)' : can.error;
    renderNicheButtons();
  }
  function renderNicheButtons() {
    var a = Engine.getActiveLineage(state);
    el.nicheButtons.innerHTML = '';
    Object.keys(DATA.NICHES).forEach(function (key) {
      var cfg = DATA.NICHES[key];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'niche-btn' + (a.niche === key ? ' current' : '');
      if (a.niche === key) {
        btn.disabled = true; btn.title = 'Aktualna nisza';
        btn.innerHTML = icon(key) + ' ' + cfg.label;
      } else {
        var can = Engine.canMigrate(DATA, state, a, key);
        btn.disabled = !can.ok || state.status !== 'playing';
        btn.title = can.ok ? 'Migruj do niszy: ' + cfg.label : can.error;
        btn.innerHTML = (can.ok ? icon(key) : icon('lock')) + ' ' + cfg.label +
          (can.ok ? '' : '<span class="niche-req">wymaga: ' + escapeHtml(traitName(cfg.requires)) + '</span>');
        if (can.ok) btn.addEventListener('click', function () { onMigrateTo(key); });
      }
      el.nicheButtons.appendChild(btn);
    });
  }
  function onSelectLineage(id) {
    state = Engine.setActiveLineage(state, id); save();
    renderAll();
  }
  function onMigrateTo(niche) {
    var a = Engine.getActiveLineage(state);
    var res = Engine.migrateLineage(DATA, state, a.id, niche);
    if (!res.ok) { toast(res.error, 'warn'); return; }
    pushUndo(); state = res.state; save();
    renderAll();
    toast(a.name + ' migruje do niszy: ' + nicheLabel(niche), 'info');
  }

  // ===================== Render — aktywna linia =====================
  function renderActiveLineage(previewTrait) {
    var l = Engine.getActiveLineage(state);
    el.portrait.innerHTML = Art.creature(previewTrait ? withTrait(l, previewTrait) : l, { size: 132 });
    el.speciesName.textContent = l.name;
    el.speciesName.style.color = Art.lineageColor(l);
    el.speciesNiche.innerHTML = icon(l.niche) + ' ' + nicheLabel(l.niche) + ' · ' + l.traits.length + ' cech';
    renderRadar(previewTrait);
    renderStatsList(l);
    renderChart();
  }
  function withTrait(l, trait) {
    var c = JSON.parse(JSON.stringify(l));
    if (c.traits.indexOf(trait.id) === -1) {
      c.traits.push(trait.id);
      for (var k in trait.effects) c.stats[k] = (c.stats[k] || 0) + trait.effects[k];
    }
    return c;
  }
  function renderRadar(previewTrait) {
    var l = Engine.getActiveLineage(state), env = Engine.currentTurnEnv(DATA, state);
    var eff = Engine.effectiveStats(DATA, l, env);
    var prev = previewTrait ? Engine.effectiveStats(DATA, withTrait(l, previewTrait), env).stats : null;
    el.radar.innerHTML = Art.radar(eff.stats, prev);
    el.tradeoffNotes.innerHTML = eff.notes.map(function (n) {
      return '<li>' + icon(n.traitId) + ' <strong>' + escapeHtml(n.traitName) + ':</strong> ' + escapeHtml(n.note) + ' <span class="fx">(' + effectsText(n.effects) + ')</span></li>';
    }).join('');
  }
  function renderStatsList(l) {
    el.statsList.innerHTML = STAT_META.map(function (m) { return '<li>' + m.label + ': ' + l.stats[m.key] + '</li>'; }).join('');
  }
  function renderChart() {
    var l = Engine.getActiveLineage(state);
    el.sparkline.innerHTML = Art.popChart({ data: DATA, engine: Engine, state: state, forecast: Engine.forecast(DATA, state, l) });
  }
  function effectsText(effects) {
    var parts = [];
    for (var k in effects) parts.push(Engine.statLabel(k) + ' ' + (effects[k] > 0 ? '+' : '') + effects[k]);
    return parts.join(', ');
  }

  // ===================== Render — prognoza (co-jeśli) =====================
  function renderForecast(previewTrait) {
    var l = Engine.getActiveLineage(state);
    var base = Engine.forecast(DATA, state, l);
    if (!base) { el.forecastBody.innerHTML = '<span class="forecast-none">Era dobiega końca.</span>'; return; }
    var html = '<div class="forecast-big ' + (base.delta >= 0 ? 'pos' : 'neg') + '"><span class="fc-num">' + (base.delta >= 0 ? '+' : '') + base.delta + '</span>' +
      '<span class="fc-to">→ ' + base.projectedPop + ' osobników</span></div>';
    html += '<div class="forecast-row"><span>Bilans energii</span><span class="fc ' + (base.energy >= 0 ? 'pos' : 'neg') + '">' + base.energy + '</span></div>';
    html += '<div class="forecast-row"><span>Pojemność niszy</span><span class="fc">' + base.capacity + '</span></div>';
    if (previewTrait) {
      var withT = Engine.forecast(DATA, state, withTrait(l, previewTrait));
      var diff = withT.delta - base.delta;
      html += '<div class="forecast-preview">' + icon(previewTrait.id) + ' <strong>Z cechą „' + escapeHtml(previewTrait.name) + '”:</strong> ' +
        (withT.delta >= 0 ? '+' : '') + withT.delta + ' <span class="fc ' + (diff >= 0 ? 'pos' : 'neg') + '">(' + (diff >= 0 ? '+' : '') + diff + ')</span></div>';
    }
    if (base.catastrophe) {
      html += '<div class="forecast-warn">' + icon('comet') + ' Katastrofa (' + escapeHtml(base.catastrophe.name) + ') uderzy w tę niszę — prognoza jej nie uwzględnia!</div>';
    }
    if (base.bottleneckRisk) html += '<div class="forecast-warn">' + icon('hourglass') + ' Ryzyko wąskiego gardła: poniżej ' + DATA.MIN_VIABLE_POP + ' osobników linia wymiera.</div>';
    el.forecastBody.innerHTML = html;
  }

  // ===================== Render — cechy =====================
  function renderTabs() {
    var tabs = [{ key: 'all', label: 'Wszystkie', ico: 'dna' }].concat(Object.keys(DATA.CATEGORIES).map(function (k) {
      return { key: k, label: DATA.CATEGORIES[k], ico: 'cat_' + k };
    }));
    el.traitTabs.innerHTML = '';
    tabs.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab');
      b.className = 'trait-tab' + (prefs.tab === t.key ? ' active' : '');
      b.setAttribute('aria-selected', String(prefs.tab === t.key));
      var avail = DATA.TRAITS.filter(function (tr) { return (t.key === 'all' || tr.category === t.key) && Engine.traitStatus(state, tr) === 'available'; }).length;
      b.innerHTML = icon(t.ico) + '<span class="tab-label">' + t.label + '</span>' + (avail ? '<span class="tab-badge">' + avail + '</span>' : '');
      b.title = t.label;
      b.addEventListener('click', function () { prefs.tab = t.key; savePrefs(); renderTabs(); renderTraits(); });
      el.traitTabs.appendChild(b);
    });
  }
  function renderTraits() {
    el.traits.innerHTML = '';
    var lineage = Engine.getActiveLineage(state);
    var env = Engine.currentTurnEnv(DATA, state);
    var cats = prefs.tab === 'all' ? Object.keys(DATA.CATEGORIES) : [prefs.tab];
    var shown = 0;
    cats.forEach(function (catKey) {
      var inCat = DATA.TRAITS.filter(function (t) { return t.category === catKey; });
      if (prefs.onlyAvailable) inCat = inCat.filter(function (t) { var st = Engine.traitStatus(state, t); return st === 'available' || st === 'too_expensive'; });
      if (!inCat.length) return;
      var section = document.createElement('div');
      section.className = 'trait-category cat-' + catKey;
      var h3 = document.createElement('h3');
      h3.innerHTML = icon('cat_' + catKey) + ' ' + DATA.CATEGORIES[catKey];
      section.appendChild(h3);
      var grid = document.createElement('div'); grid.className = 'trait-grid';
      var compact = document.createElement('div'); compact.className = 'trait-compact-list';
      inCat.forEach(function (trait) {
        var st = Engine.traitStatus(state, trait);
        if (st === 'locked' || st === 'era_locked') compact.appendChild(renderCompact(trait, st, lineage));
        else grid.appendChild(renderTraitCard(trait, st, lineage, env));
        shown++;
      });
      if (grid.children.length) section.appendChild(grid);
      if (compact.children.length) section.appendChild(compact);
      el.traits.appendChild(section);
    });
    if (!shown) el.traits.innerHTML = '<p class="traits-empty">Brak cech do pokazania. ' + (prefs.onlyAvailable ? 'Wyłącz filtr „tylko dostępne teraz” albo zbierz więcej EP.' : '') + '</p>';
  }
  function condLabel(c) {
    var parts = [];
    if (c.niche) parts.push(c.niche.map(function (n) { return nicheLabel(n).toLowerCase(); }).join('/'));
    if (c.climate) parts.push(c.climate.map(function (k) { return k === 'zimno' ? 'w zimnie' : k === 'cieplo' ? 'w cieple' : 'klimat umiark.'; }).join('/'));
    if (c.foodBelow != null) parts.push('przy niedoborze pokarmu');
    if (c.unlessTrait) parts.push('bez cechy ' + traitName(c.unlessTrait));
    return parts.join(', ');
  }
  function renderConditions(trait, lineage, env) {
    if (!trait.conditions) return '';
    var activeNotes = Engine.effectiveStats(DATA, withTrait(lineage, trait), env).notes
      .filter(function (n) { return n.traitId === trait.id; }).map(function (n) { return n.note; });
    return '<ul class="trait-conds">' + trait.conditions.map(function (c) {
      var on = activeNotes.indexOf(c.note) !== -1;
      var good = Object.keys(c.effects).every(function (k) { return (c.effects[k] > 0) !== (k === 'metabolism'); });
      return '<li class="' + (on ? 'on ' : '') + (good ? 'good' : 'bad') + '" title="' + escapeHtml(c.note) + '">' +
        '<span class="cond-where">' + escapeHtml(condLabel(c)) + ':</span> ' + effectsText(c.effects) + (on ? ' <em>(teraz)</em>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function renderCompact(trait, status, lineage) {
    var d = document.createElement('div');
    d.className = 'trait-compact ' + status + (trait.path === 'intelligence' ? ' path-intel' : '');
    var why = status === 'era_locked' ? 'od ery: ' + DATA.ERAS[trait.minEra].name
      : 'wymaga: ' + trait.requires.filter(function (id) { return lineage.traits.indexOf(id) === -1; }).map(traitName).join(', ');
    d.innerHTML = '<span class="tc-ico">' + icon(status === 'era_locked' ? 'hourglass' : 'lock') + '</span>' +
      '<span class="tc-name">' + (trait.path === 'intelligence' ? icon('star', 'star') : '') + trait.name + '</span>' +
      '<span class="tc-why">' + escapeHtml(why) + '</span><span class="tc-cost">' + trait.cost + ' EP</span>';
    d.title = trait.desc + ' — ' + trait.tradeoff;
    return d;
  }
  function renderTraitCard(trait, status, lineage, env) {
    var owned = status === 'owned';
    var card = document.createElement(owned ? 'div' : 'button');
    if (!owned) card.type = 'button';
    card.className = 'trait ' + status + ' cat-' + trait.category + (trait.path === 'intelligence' ? ' path-intel' : '');
    card.dataset.traitId = trait.id;
    if (!owned) card.disabled = (status !== 'available') || state.status !== 'playing';

    var costLabel = owned ? icon('check') + ' posiadana' : trait.cost + ' EP';
    var extra = '';
    if (status === 'too_expensive') extra = '<div class="trait-req warn">Brakuje ' + (trait.cost - state.ep) + ' EP</div>';

    var star = trait.path === 'intelligence' ? '<span class="trait-star" title="Droga do inteligencji">' + icon('star') + '</span>' : '';
    card.innerHTML = '<div class="trait-head"><span class="trait-badge">' + icon(trait.id) + '</span><span class="trait-name">' + trait.name + star + '</span>' +
      '<span class="trait-cost">' + costLabel + '</span></div>' +
      '<div class="trait-desc">' + trait.desc + '</div>' +
      '<div class="trait-effects">' + renderEffects(trait.effects) + '</div>' +
      renderConditions(trait, lineage, env) +
      '<div class="trait-tradeoff">' + trait.tradeoff + '</div>' + extra;

    if (owned && state.status === 'playing') {
      var can = Engine.canDropTrait(DATA, state, trait.id);
      var drop = document.createElement('button');
      drop.type = 'button'; drop.className = 'btn btn-ghost btn-xs trait-drop';
      drop.textContent = 'Odrzuć (' + DATA.DROP_TRAIT_COST + ' EP)';
      drop.disabled = !can.ok;
      drop.title = can.ok ? 'Cecha zaniknie (narząd szczątkowy) — cofnij jej efekty i koszty' : can.error;
      drop.addEventListener('click', function () { onDropTrait(trait); });
      card.appendChild(drop);
    }
    if (status === 'available' && state.status === 'playing') {
      card.addEventListener('click', function () { onBuyTrait(trait.id); });
      card.addEventListener('mouseenter', function () { preview(trait); });
      card.addEventListener('mouseleave', function () { preview(null); });
      card.addEventListener('focus', function () { preview(trait); });
      card.addEventListener('blur', function () { preview(null); });
    }
    return card;
  }
  function preview(trait) { renderForecast(trait); renderRadar(trait); el.portrait.innerHTML = Art.creature(trait ? withTrait(Engine.getActiveLineage(state), trait) : Engine.getActiveLineage(state), { size: 132 }); }
  function renderEffects(effects) {
    var html = '';
    for (var k in effects) if (Object.prototype.hasOwnProperty.call(effects, k)) {
      var v = effects[k];
      var good = (v > 0) !== (k === 'metabolism');
      html += '<span class="effect-chip ' + (good ? 'up' : 'down') + '">' + Engine.statLabel(k) + ' ' + (v > 0 ? '+' : '') + v + '</span>';
    }
    return html;
  }

  // ===================== Akcje =====================
  function onBuyTrait(traitId) {
    var res = Engine.buyTrait(DATA, state, traitId);
    if (!res.ok) { toast(res.error, 'warn'); return; }
    pushUndo(); state = res.state; save();
    renderAll();
    var c = el.traits.querySelector('[data-trait-id="' + traitId + '"]');
    if (c) { c.classList.add('just-bought'); }
    el.portrait.classList.remove('evolve'); void el.portrait.offsetWidth; el.portrait.classList.add('evolve');
  }
  function onDropTrait(trait) {
    openConfirm('Odrzucić cechę „' + trait.name + '”? Jej efekty zanikną (koszt ' + DATA.DROP_TRAIT_COST + ' EP). Tak powstają narządy szczątkowe.', function () {
      var res = Engine.dropTrait(DATA, state, trait.id);
      if (!res.ok) { toast(res.error, 'warn'); return; }
      pushUndo(); state = res.state; save(); renderAll();
      (res.newAchievements || []).forEach(achievementToast);
    });
  }
  function onSpeciate() {
    var can = Engine.canSpeciate(DATA, state);
    if (!can.ok) { toast(can.error, 'warn'); return; }
    var base = Engine.getActiveLineage(state).name;
    el.speciateHint.textContent = 'Rozdzielasz „' + base + '” na dwie gałęzie (koszt ' + can.cost + ' EP — każda kolejna żywa linia podnosi koszt). ' +
      'Populacja podzieli się na pół, a nowa gałąź będzie ewoluować niezależnie — wyślij ją w inną niszę, by nie konkurowały o ten sam pokarm.';
    el.speciateName.value = base + ' II';
    openModal(el.modalSpeciate); el.speciateName.focus(); el.speciateName.select();
  }
  function confirmSpeciate() {
    var base = Engine.getActiveLineage(state).name;
    var name = (el.speciateName.value || '').trim() || (base + ' II');
    var res = Engine.speciate(DATA, state, name);
    closeModal(el.modalSpeciate);
    if (!res.ok) { toast(res.error, 'warn'); return; }
    pushUndo(); state = res.state; save(); renderAll();
  }
  function onSimulate() {
    if (!state || state.status !== 'playing') return;
    var prev = { pop: Engine.totalPopulation(state), ep: state.ep };
    var res = Engine.simulateTurn(DATA, state);
    if (!res.report) return;
    pushUndo(); state = res.state; save(); renderAll(prev);
    lastReport = res.report;
    showReport(res.report);
  }
  function renderAll(prev) {
    document.body.setAttribute('data-era', Engine.currentEra(DATA, state).id);
    renderHud(prev); renderTimeline(); renderScene(); renderEnv(); renderLineageBar();
    renderActiveLineage(); renderForecast(); renderTabs(); renderTraits(); updateUndoButton();
    var playing = state.status === 'playing';
    el.btnSimulate.disabled = !playing; el.btnSimulateMobile.disabled = !playing;
  }

  // ===================== Raport tury =====================
  var LOSS_KINDS = [
    { key: 'predationDeaths', label: 'drapieżnictwo', cls: 'seg-pred' },
    { key: 'starvationDeaths', label: 'głód', cls: 'seg-starv' },
    { key: 'capacityDeaths', label: 'przeludnienie', cls: 'seg-cap' },
    { key: 'catDeaths', label: 'katastrofa', cls: 'seg-cat' },
    { key: 'bottleneckDeaths', label: 'wąskie gardło', cls: 'seg-bottle' }
  ];
  function showReport(report) {
    var anyCatHit = report.lineReports.some(function (lr) { return lr.catDeaths > 0; });
    el.reportBox.classList.toggle('is-catastrophe', anyCatHit);
    el.reportHero.innerHTML = anyCatHit ? Art.catastropheArt(report.catastrophe.name) +
      '<div class="report-hero-title">' + icon('comet') + ' ' + escapeHtml(report.catastrophe.name) + '</div>' : '';
    el.reportTitle.textContent = report.eraName + ' · ' + report.envTitle;
    if (anyCatHit && !reducedMotion()) { el.reportBox.classList.remove('shake'); void el.reportBox.offsetWidth; el.reportBox.classList.add('shake'); }

    if (report.event) {
      el.reportEvent.hidden = false;
      el.reportEvent.innerHTML = icon('leaf') + ' <strong>' + escapeHtml(report.event.name) + '</strong> — ' + escapeHtml(report.event.desc);
    } else el.reportEvent.hidden = true;

    el.reportBody.innerHTML = '';
    report.lineReports.forEach(function (lr) {
      var lin = Engine.getLineage(state, lr.lineageId) || { id: lr.lineageId, traits: [], name: lr.name };
      var block = document.createElement('div'); block.className = 'report-lineage' + (lr.alive ? '' : ' dead');
      var losses = LOSS_KINDS.reduce(function (s, k) { return s + (lr[k.key] || 0); }, 0);
      var scale = Math.max(1, lr.births, losses);
      var bar = '<div class="flow"><div class="flow-loss">' + LOSS_KINDS.map(function (k) {
        var v = lr[k.key] || 0; return v ? '<span class="seg ' + k.cls + '" style="width:' + (v / scale * 100) + '%" title="' + k.label + ': −' + v + '"></span>' : '';
      }).join('') + '</div><div class="flow-mid"></div><div class="flow-gain">' +
        (lr.births ? '<span class="seg seg-birth" style="width:' + (lr.births / scale * 100) + '%" title="narodziny: +' + lr.births + '"></span>' : '') + '</div></div>';
      var legend = '<div class="flow-legend">' + (lr.births ? '<span class="lg seg-birth pos">narodziny +' + lr.births + '</span>' : '') +
        LOSS_KINDS.map(function (k) { var v = lr[k.key] || 0; return v ? '<span class="lg ' + k.cls + ' neg">' + k.label + ' −' + v + '</span>' : ''; }).join('') + '</div>';
      var bd = lr.epBreakdown, parts = [];
      if (bd.growth) parts.push('wzrost +' + bd.growth);
      if (bd.population) parts.push('populacja +' + bd.population);
      if (bd.niche) parts.push('nisza +' + bd.niche);
      if (bd.catastrophe) parts.push('przetrwanie katastrofy +' + bd.catastrophe);
      block.innerHTML = '<div class="rl-head"><span class="rl-portrait">' + (lr.alive ? Art.creature(lin, { size: 64 }) : icon('skull')) + '</span>' +
        '<div class="rl-title"><strong style="color:' + Art.lineageColor(lin) + '">' + escapeHtml(lr.name) + '</strong><span>' + icon(lr.niche) + ' ' + nicheLabel(lr.niche) + '</span></div>' +
        '<div class="rl-pop ' + (lr.popAfter >= lr.popBefore ? 'pos' : 'neg') + '"><span class="count" data-from="' + lr.popBefore + '" data-to="' + lr.popAfter + '">' + lr.popAfter + '</span><small>z ' + lr.popBefore + '</small></div></div>' +
        bar + legend +
        (lr.events.length ? '<ul class="rl-events">' + lr.events.map(function (t) { return '<li' + (/Katastrofa|wymarła|Wąskie/.test(t) ? ' class="danger"' : '') + '>' + escapeHtml(t) + '</li>'; }).join('') + '</ul>' : '') +
        (lr.tradeoffs && lr.tradeoffs.length ? '<ul class="rl-tradeoffs">' + lr.tradeoffs.map(function (n) { return '<li>' + icon(n.traitId) + ' ' + escapeHtml(n.traitName) + ': ' + escapeHtml(n.note) + '</li>'; }).join('') + '</ul>' : '') +
        (lr.epGain ? '<div class="rl-ep">EP z tej linii: <strong>+' + lr.epGain + '</strong> <span>(' + parts.join(', ') + ')</span></div>' : '');
      el.reportBody.appendChild(block);
    });
    var g = report.globalEp || {};
    var sum = document.createElement('div'); sum.className = 'report-summary';
    sum.innerHTML = '<div class="ep-total">' + icon('ep') + ' <span class="count" data-from="0" data-to="' + report.epGain + '">+' + report.epGain + '</span> EP</div>' +
      '<div class="ep-parts">' + [g.base ? 'przetrwanie +' + g.base : '', g.intelligence ? 'inteligencja +' + g.intelligence : '',
        g.colonize ? 'kolonizacja nowej niszy +' + g.colonize : ''].filter(Boolean).map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>' +
      '<div class="report-meta"><span>' + icon('pop') + ' łącznie ' + report.totalPopulation + '</span><span>' + icon('goal') + ' inteligencja ' + report.maxIntelligence + '/' + report.intelligenceGoal + '</span>' +
      (report.predatorLevel > 2 ? '<span class="neg">' + icon('fang') + ' koewolucja drapieżników ↑' + report.predatorLevel + '</span>' : '') + '</div>';
    el.reportBody.appendChild(sum);

    el.reportAch.innerHTML = (report.newAchievements || []).map(achBadge).join('');

    el.reportKnowledge.innerHTML = '';
    report.knowledge.forEach(function (key, i) {
      var k = DATA.KNOWLEDGE[key]; if (!k) return;
      var card = document.createElement('div'); card.className = 'knowledge-card flip-in'; card.style.animationDelay = (i * 90) + 'ms';
      card.innerHTML = '<h4>' + icon('book') + ' ' + k.title + '</h4><p>' + k.body + '</p>' +
        (k.fossil ? '<p class="knowledge-fossil">' + icon('bone') + ' ' + k.fossil + '</p>' : '');
      el.reportKnowledge.appendChild(card);
    });

    el.btnReportClose.textContent = nextStepLabel();
    openModal(el.modalReport);
    animateCounts(el.reportBody);
  }
  function nextStepLabel() {
    if (state.pendingQuiz) return 'Dalej: quiz po erze';
    if (lastReport && lastReport.eraChanged) return 'Dalej: nowa era';
    if (state.mutationOffer) return 'Dalej: nowe mutacje';
    return state.status === 'playing' ? T('report.next') : T('report.summary');
  }
  function animateCounts(root) {
    if (reducedMotion()) return;
    Array.prototype.forEach.call(root.querySelectorAll('.count'), function (n) {
      var from = +n.getAttribute('data-from'), to = +n.getAttribute('data-to'), plus = n.textContent.charAt(0) === '+';
      var t0 = null, dur = 700;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur), v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
        n.textContent = (plus ? '+' : '') + v;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  function onReportClose() {
    closeModal(el.modalReport);
    if (lastReport && lastReport.epGain) epFly(lastReport.epGain);
    continueFlow();
  }
  /* Kolejka po turze: quiz → plansza nowej ery → oferta mutacji → (koniec gry). */
  function continueFlow() {
    if (state.pendingQuiz) { showQuiz(); return; }
    if (lastReport && lastReport.eraChanged) { var r = lastReport; lastReport = Object.assign({}, r, { eraChanged: false }); showEraPlate(r.newEraIndex); return; }
    if (state.status !== 'playing') { showEnd(); return; }
    if (state.mutationOffer) { showMutation(); return; }
  }
  function epFly(n) {
    var f = document.createElement('div'); f.className = 'ep-fly'; f.textContent = '+' + n + ' EP';
    var r = el.hudEp.getBoundingClientRect();
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + window.scrollY + r.height) + 'px';
    document.body.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1300);
    pulse(el.hudEp, 'pulse-up');
  }

  // ===================== Plansza nowej ery =====================
  function showEraPlate(eraIndex) {
    var era = DATA.ERAS[eraIndex];
    document.body.setAttribute('data-era', era.id);
    el.eraPlateArt.innerHTML = Art.scene({ data: DATA, engine: Engine, state: state, env: Engine.turnEnv(DATA, state, eraIndex, 0) })
      .replace('xMidYMid slice', 'xMidYMid meet');
    el.eraPlateTitle.textContent = era.name;
    el.eraPlateDates.textContent = era.dates;
    el.eraPlateIntro.textContent = era.intro;
    el.eraPlateMilestone.textContent = era.milestone;
    el.eraPlate.hidden = false; el.btnEraPlate.focus();
  }
  function closeEraPlate() { el.eraPlate.hidden = true; continueFlow(); }

  // ===================== Oferta mutacji =====================
  var MUT_DESC = {
    good: 'Drobna, czysta poprawa.', catch: 'Duży zysk, ale coś za coś.',
    risky: 'Sprytniejsze osobniki, lecz mózg zużywa więcej energii.', neutral: 'Niczego nie zmienia — większość mutacji jest neutralna.'
  };
  function showMutation() {
    var offer = state.mutationOffer; if (!offer) return;
    var l = Engine.getLineage(state, offer.lineageId);
    el.mutationHint.innerHTML = 'W populacji linii <strong>' + escapeHtml(l.name) + '</strong> pojawiły się losowe mutacje. Mutacje są przypadkowe — ' +
      'ale to <em>dobór</em> decyduje, które się utrwalą. Wybierz jedną albo odrzuć wszystkie.';
    el.mutationOptions.innerHTML = '';
    offer.options.forEach(function (o, i) {
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'mutation-card kind-' + o.kind;
      var fx = Object.keys(o.effects).length ? renderEffects(o.effects) : '<span class="effect-chip">brak zmian</span>';
      b.innerHTML = '<span class="mut-kind">' + icon('dna') + ' ' + o.label + '</span><span class="mut-fx">' + fx + '</span><span class="mut-desc">' + MUT_DESC[o.kind] + '</span>';
      b.addEventListener('click', function () {
        var res = Engine.chooseMutation(DATA, state, i);
        if (!res.ok) return;
        pushUndo(); state = res.state; save(); closeModal(el.modalMutation); renderAll();
        toast('Mutacja utrwalona: ' + (Object.keys(o.effects).length ? effectsText(o.effects) : 'neutralna'), 'good');
      });
      el.mutationOptions.appendChild(b);
    });
    openModal(el.modalMutation);
  }
  function rejectMutation() {
    var res = Engine.rejectMutation(DATA, state);
    if (res.ok) { state = res.state; save(); }
    closeModal(el.modalMutation); renderAll();
  }

  // ===================== Quiz =====================
  function showQuiz() {
    var pq = state.pendingQuiz; if (!pq) return;
    var era = DATA.ERAS.filter(function (e) { return e.id === pq.eraId; })[0];
    var qs = DATA.QUIZZES[pq.eraId];
    el.quizTitle.innerHTML = icon('quiz') + ' Quiz: ' + (era ? era.name : pq.eraId);
    el.quizHint.textContent = state.status === 'playing'
      ? 'Każda poprawna odpowiedź to +' + DATA.QUIZ_EP + ' EP. Wiedza też jest przystosowaniem!'
      : 'Ostatni quiz — poprawne odpowiedzi podnoszą wynik końcowy.';
    renderQuizBody();
    openModal(el.modalQuiz);
  }
  function renderQuizBody() {
    var pq = state.pendingQuiz, qs = DATA.QUIZZES[pq.eraId];
    el.quizBody.innerHTML = '';
    qs.forEach(function (q, qi) {
      var ans = pq.answers[qi];
      var box = document.createElement('div'); box.className = 'quiz-q';
      box.innerHTML = '<p class="quiz-question">' + (qi + 1) + '. ' + escapeHtml(q.q) + '</p>';
      var opts = document.createElement('div'); opts.className = 'quiz-opts';
      q.options.forEach(function (o, oi) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-ghost quiz-opt';
        b.textContent = o;
        if (ans != null) {
          b.disabled = true;
          if (oi === q.answer) b.classList.add('correct');
          else if (oi === ans) b.classList.add('wrong');
        } else b.addEventListener('click', function () {
          var res = Engine.answerQuiz(DATA, state, qi, oi);
          if (!res.ok) return;
          state = res.state; save(); renderQuizBody(); renderHud();
        });
        opts.appendChild(b);
      });
      box.appendChild(opts);
      if (ans != null) box.innerHTML += '<p class="quiz-explain ' + (ans === q.answer ? 'pos' : 'neg') + '">' + (ans === q.answer ? 'Dobrze! ' : 'Nie tym razem. ') + escapeHtml(q.explain) + '</p>';
      el.quizBody.appendChild(box);
    });
    var done = qs.every(function (q, i) { return pq.answers[i] != null; });
    el.btnQuizDone.disabled = !done;
  }
  function finishQuiz() {
    var res = Engine.finishQuiz(DATA, state);
    if (!res.ok) return;
    state = res.state; save(); closeModal(el.modalQuiz);
    toast('Quiz: ' + res.correct + '/' + res.total + ' poprawnych', res.correct === res.total ? 'good' : 'info');
    (res.newAchievements || []).forEach(achievementToast);
    renderAll(); continueFlow();
  }

  // ===================== Osiągnięcia =====================
  function achById(id) { return DATA.ACHIEVEMENTS.filter(function (a) { return a.id === id; })[0]; }
  function achBadge(id) {
    var a = achById(id); if (!a) return '';
    return '<div class="ach-badge got">' + icon('trophy') + '<div><strong>' + escapeHtml(a.name) + '</strong><span>' + escapeHtml(a.desc) + '</span></div></div>';
  }
  function achievementToast(id) { var a = achById(id); if (a) toast('Osiągnięcie: ' + a.name, 'ach'); }
  function showAchievements() {
    var got = state ? state.achievements || [] : [];
    el.achBody.innerHTML = DATA.ACHIEVEMENTS.map(function (a) {
      var has = got.indexOf(a.id) !== -1;
      return '<div class="ach-badge' + (has ? ' got' : '') + '">' + icon(has ? 'trophy' : 'lock') + '<div><strong>' + escapeHtml(a.name) + '</strong><span>' + escapeHtml(a.desc) + '</span></div></div>';
    }).join('');
    openModal(el.modalAch);
  }

  // ===================== Drzewo życia / mapa cech =====================
  function showTree() {
    el.treeContainer.innerHTML = Art.lifeTree({ data: DATA, engine: Engine, state: state });
    Array.prototype.forEach.call(el.treeContainer.querySelectorAll('.tree-node.alive'), function (n) {
      n.style.cursor = 'pointer';
      n.addEventListener('click', function () {
        if (state.status !== 'playing') return;
        onSelectLineage(n.getAttribute('data-lineage')); closeModal(el.modalTree);
      });
    });
    openModal(el.modalTree);
  }
  function showMap() {
    el.mapContainer.innerHTML = Art.traitMap({ data: DATA, statusOf: function (t) { return Engine.traitStatus(state, t); } });
    Array.prototype.forEach.call(el.mapContainer.querySelectorAll('.map-node.st-available'), function (n) {
      n.style.cursor = 'pointer';
      n.addEventListener('click', function () { onBuyTrait(n.getAttribute('data-trait')); showMap(); });
    });
    if (el.modalMap.hidden) openModal(el.modalMap);
  }

  // ===================== Ekran końcowy =====================
  function showEnd() {
    clearSave();
    var s = state.status;
    var best = null;
    state.lineages.forEach(function (l) { if (!best || l.stats.intelligence > best.stats.intelligence || (l.alive && !best.alive)) best = l; });
    el.endEmblem.innerHTML = s === 'lost' ? '<span class="end-skull">' + icon('skull') + '</span>' : Art.creature(best, { size: 190 });
    el.endTitle.textContent = s === 'won' ? 'Narodziny inteligencji!' :
      (s === 'survived' ? 'Gatunek przetrwał wszystkie ery' : 'Wszystkie linie wygasły');
    el.endSummary.textContent =
      s === 'won'
        ? 'Jedna z Twoich linii przekroczyła próg inteligencji i zaczęła używać narzędzi — na horyzoncie kultura i technologia. To efekt konsekwentnych decyzji mimo katastrof, rywali i presji środowiska.'
        : s === 'survived'
        ? 'Twoje linie przetrwały wszystkie ery, ale żadna nie połączyła dużego mózgu z używaniem narzędzi. Przetrwanie to też sukces — w naturze większość gatunków nigdy nie „dąży” do rozumu.'
        : 'Wszystkie linie rozwojowe wymarły. W historii życia ponad 99% gatunków wymarło — dywersyfikuj (specjacja, różne nisze), dbaj o bilans energii i unikaj wąskich gardeł.';
    var sc = Engine.computeScore(DATA, state);
    el.endScore.innerHTML = '<div class="score-total"><span class="score-label">Wynik</span><span class="count" data-from="0" data-to="' + sc.total + '">' + sc.total + '</span></div>' +
      '<ul class="score-parts">' + sc.parts.map(function (p) { return '<li><span>' + escapeHtml(p.label) + '</span><strong>+' + p.points + '</strong></li>'; }).join('') + '</ul>';
    el.endChart.innerHTML = Art.popChart({ data: DATA, engine: Engine, state: state, width: 520, height: 160 });
    el.endAch.innerHTML = (state.achievements || []).length ? '<h3>Osiągnięcia</h3><div class="ach-grid">' + state.achievements.map(achBadge).join('') + '</div>' : '';
    el.endStats.innerHTML = '';
    endStat('Scenariusz / ziarno świata', scenarioName() + ' / ' + state.seed);
    endStat('Liczba linii rozwojowych', state.lineages.length);
    endStat('Szczytowa łączna populacja', state.lineages.reduce(function (a, l) { return a + l.peakPopulation; }, 0));
    endStat('Najwyższa inteligencja', Engine.maxIntelligence(state) + ' / ' + state.intelligenceGoal);
    endStat('Odkryte pojęcia w Kodeksie', state.unlockedKnowledge.length);
    showScreen('end');
    animateCounts(el.endScore);
  }
  function scenarioName() { var sc = DATA.SCENARIOS.filter(function (x) { return x.id === state.scenario; })[0]; return sc ? sc.name : state.scenario; }
  function endStat(label, value) {
    var li = document.createElement('li'); li.innerHTML = '<span>' + label + '</span><strong>' + value + '</strong>';
    el.endStats.appendChild(li);
  }

  // ===================== Eksport podsumowania =====================
  function buildSummaryText() {
    if (!state) return '';
    var statusPl = state.status === 'won' ? 'Zwycięstwo (inteligencja + narzędzia)' :
      (state.status === 'survived' ? 'Przetrwanie (bez rozumności)' : state.status === 'lost' ? 'Wymarcie' : 'Gra w toku');
    var diff = DATA.DIFFICULTIES[state.difficulty];
    var sc = Engine.computeScore(DATA, state);
    var L = ['EWOLUCJA — podsumowanie gry', '============================',
      'Scenariusz: ' + scenarioName() + ' (trudność: ' + (diff ? diff.label : state.difficulty) + ')',
      'Ziarno świata: ' + state.seed + ' (wpisz je na starcie, by zagrać w ten sam świat)',
      'Wynik: ' + statusPl, 'Punkty: ' + sc.total,
      'Najwyższa inteligencja: ' + Engine.maxIntelligence(state) + ' / ' + state.intelligenceGoal,
      'Liczba linii rozwojowych: ' + state.lineages.length,
      'Zajęte nisze: ' + (state.visitedNiches || []).map(nicheLabel).join(', '),
      'Przetrwane uderzenia katastrof: ' + (state.catastrophesSurvived || 0),
      'Szczytowa łączna populacja: ' + state.lineages.reduce(function (a, l) { return a + l.peakPopulation; }, 0),
      'Odkryte pojęcia w Kodeksie: ' + state.unlockedKnowledge.length,
      'Osiągnięcia: ' + ((state.achievements || []).map(function (id) { var a = achById(id); return a ? a.name : id; }).join(', ') || 'brak'),
      'Quizy: ' + (Object.keys(state.quizzes || {}).map(function (k) { return k + ' ' + state.quizzes[k].correct + '/' + state.quizzes[k].total; }).join(', ') || 'brak'),
      '', 'Linie rozwojowe:'];
    state.lineages.forEach(function (l) {
      L.push('  • ' + l.name + ' — ' + (l.alive ? 'żywa' : 'wymarła') +
        ', nisza: ' + nicheLabel(l.niche) + ', inteligencja: ' + l.stats.intelligence +
        ', cechy: ' + (l.traits.length ? l.traits.map(traitName).join(', ') : 'brak'));
    });
    L.push('', 'Odkryte pojęcia: ' + state.unlockedKnowledge.map(function (k) {
      return DATA.KNOWLEDGE[k] ? DATA.KNOWLEDGE[k].title : k;
    }).join('; '));
    return L.join('\n');
  }
  function showSummary() { el.summaryText.value = buildSummaryText(); openModal(el.modalSummary); }
  function copySummary() {
    el.summaryText.select();
    var okMsg = 'Skopiowano ✓';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(el.summaryText.value).then(function () { flashBtn(el.btnSummaryCopy, okMsg); }, function () { legacyCopy(); });
      } else legacyCopy();
    } catch (e) { legacyCopy(); }
    function legacyCopy() { try { document.execCommand('copy'); flashBtn(el.btnSummaryCopy, okMsg); } catch (e) {} }
  }
  function downloadSummary() {
    try {
      var blob = new Blob([buildSummaryText()], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'ewolucja-podsumowanie.txt';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    } catch (e) { flashBtn(el.btnSummaryDownload, 'Pobieranie zablokowane — skopiuj tekst'); }
  }
  function flashBtn(btn, msg) { var p = btn.textContent; btn.textContent = msg; setTimeout(function () { btn.textContent = p; }, 1400); }

  // ===================== Kodeks =====================
  function showCodex() {
    el.codexBody.innerHTML = '';
    var unlocked = (state ? state.unlockedKnowledge : ['intro']);
    var total = Object.keys(DATA.KNOWLEDGE).length;
    Object.keys(DATA.KNOWLEDGE).forEach(function (key) {
      var k = DATA.KNOWLEDGE[key], has = unlocked.indexOf(key) !== -1;
      var card = document.createElement('div'); card.className = 'knowledge-card' + (has ? '' : ' locked');
      card.innerHTML = has ? '<h4>' + icon('book') + ' ' + k.title + '</h4><p>' + k.body + '</p>' +
        (k.fossil ? '<p class="knowledge-fossil">' + icon('bone') + ' ' + k.fossil + '</p>' : '')
        : '<h4>' + icon('lock') + ' ???</h4><p>Karta jeszcze nieodkryta — graj dalej.</p>';
      el.codexBody.appendChild(card);
    });
    el.codexBody.insertAdjacentHTML('afterbegin', '<p class="codex-count">Odkryto ' + unlocked.length + ' z ' + total + ' kart.</p>');
    openModal(el.modalCodex);
  }

  // ===================== Toasty =====================
  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'toast toast-' + (kind || 'info');
    t.innerHTML = (kind === 'ach' ? icon('trophy') : kind === 'warn' ? icon('lock') : icon('dna')) + '<span>' + escapeHtml(msg) + '</span>';
    el.toasts.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, kind === 'ach' ? 3200 : 2200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, kind === 'ach' ? 3700 : 2700);
  }

  // ===================== Samouczek =====================
  var tutorialSteps = [
    { title: 'Witaj w Ewolucji!', text: 'Prowadzisz nie pojedyncze zwierzę, lecz całą populację. Cel: doprowadzić którąkolwiek linię do progu inteligencji i używania narzędzi — to możliwe dopiero w kenozoiku.' },
    { title: 'Ekosystem', text: 'U góry widzisz świat: niebo, morze, przybrzeże i ląd. Liście to pokarm, kły to drapieżcy, ciemne sylwetki to rywale, którzy zjadają Twój pokarm. Kliknij strefę, by przenieść tam aktywną linię.' },
    { title: 'Punkty ewolucji (EP)', text: 'Za przetrwanie, wzrost, kolonizację nowych nisz i przetrwanie katastrof zdobywasz EP. Wydajesz je na cechy w panelu „Adaptacje”. Najedź na cechę, by zobaczyć jej wpływ (prognoza, radar i portret).' },
    { title: 'Kompromisy zależą od miejsca', text: 'Płetwy pomagają w wodzie, a na lądzie przeszkadzają; futro ratuje w zimnie, a w upale szkodzi. Warunkowe efekty cech są wypisane na kartach — „(teraz)” oznacza, że działają w obecnej sytuacji.' },
    { title: 'Uważaj na wąskie gardło', text: 'Każda nisza wyżywi ograniczoną liczbę osobników, a linia poniżej ' + DATA.MIN_VIABLE_POP + ' osobników wymiera. Mózg jest kosztowny — bez dobrego odżywiania głoduje cała populacja.' },
    { title: 'Mutacje, quizy, katastrofy', text: 'Czasem populacja zaoferuje Ci mutacje do wyboru. Po każdej erze czeka quiz (bonus EP). Zwiastuny zapowiadają katastrofy — dywersyfikuj linie (Specjacja) w różnych niszach!' }
  ];
  var tutorialIdx = 0;
  function maybeStartTutorial() {
    var done; try { done = localStorage.getItem(TUTORIAL_KEY); } catch (e) { done = null; }
    if (done) return;
    tutorialIdx = 0; showTutorialStep(); el.tutorial.hidden = false;
  }
  function showTutorialStep() {
    var s = tutorialSteps[tutorialIdx];
    el.tutorialTitle.textContent = s.title;
    el.tutorialText.textContent = s.text;
    el.tutorialProgress.textContent = (tutorialIdx + 1) + ' / ' + tutorialSteps.length;
    el.btnTutorialNext.textContent = (tutorialIdx === tutorialSteps.length - 1) ? T('tutorial.done') : T('tutorial.next');
  }
  function tutorialNext() { if (tutorialIdx < tutorialSteps.length - 1) { tutorialIdx++; showTutorialStep(); } else endTutorial(); }
  function endTutorial() { el.tutorial.hidden = true; try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {} }

  // ===================== Modale =====================
  var focusStack = [];
  function openModal(m) {
    focusStack.push(document.activeElement); m.hidden = false;
    var f = m.querySelector('button:not([disabled]), input');
    if (f) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }
    var box = m.querySelector('.modal-box'); if (box) box.scrollTop = 0;
  }
  function closeModal(m) { m.hidden = true; var last = focusStack.pop(); if (last && last.focus && document.body.contains(last)) last.focus(); }

  var confirmCallback = null;
  function openConfirm(msg, cb) { el.confirmMessage.textContent = msg; confirmCallback = cb; openModal(el.modalConfirm); }
  function resolveConfirm(yes) { closeModal(el.modalConfirm); var cb = confirmCallback; confirmCallback = null; if (yes && cb) cb(); }

  // ===================== Inicjalizacja =====================
  function init() {
    window.GameI18n.applyStatic(document);
    loadPrefs(); applyPrefs();
    fillIcons(document);
    el.brandMark.innerHTML = icon('dna');
    el.introGoal.innerHTML = icon('goal') + ' <strong>Cel:</strong> doprowadź którąkolwiek linię do progu inteligencji <em>i</em> używania narzędzi ' +
      'przez ery (' + DATA.ERAS.map(function (e) { return e.name; }).join(', ') + '). Dbaj o bilans energii, rozkładaj ryzyko przez specjację i nisze, ' +
      'czytaj zwiastuny katastrof. Każda gra to inny, losowy świat.';
    renderScenarios(); renderHero();

    el.formStart.addEventListener('submit', function (e) {
      e.preventDefault();
      newGame((el.speciesInput.value || '').trim() || 'Prazwierzę', scenarioOpts(DATA.SCENARIOS[0]));
    });
    el.btnSimulate.addEventListener('click', onSimulate);
    el.btnSimulateMobile.addEventListener('click', onSimulate);
    el.btnUndo.addEventListener('click', onUndo);
    el.btnSpeciate.addEventListener('click', onSpeciate);
    el.btnTree.addEventListener('click', showTree);
    el.btnEndTree.addEventListener('click', showTree);
    el.btnMap.addEventListener('click', showMap);
    el.btnMapClose.addEventListener('click', function () { closeModal(el.modalMap); });
    el.scene.addEventListener('click', onSceneClick);
    el.btnReportClose.addEventListener('click', onReportClose);
    el.btnEraPlate.addEventListener('click', closeEraPlate);
    el.btnMutationReject.addEventListener('click', rejectMutation);
    el.btnQuizDone.addEventListener('click', finishQuiz);
    el.btnCodex.addEventListener('click', showCodex);
    el.btnCodexClose.addEventListener('click', function () { closeModal(el.modalCodex); });
    el.btnAchievements.addEventListener('click', showAchievements);
    el.btnAchClose.addEventListener('click', function () { closeModal(el.modalAch); });
    el.btnTreeClose.addEventListener('click', function () { closeModal(el.modalTree); });
    el.btnOpenCodexEnd.addEventListener('click', showCodex);
    el.btnSummary.addEventListener('click', showSummary);
    el.btnSummaryClose.addEventListener('click', function () { closeModal(el.modalSummary); });
    el.btnSummaryCopy.addEventListener('click', copySummary);
    el.btnSummaryDownload.addEventListener('click', downloadSummary);
    el.formSpeciate.addEventListener('submit', function (e) { e.preventDefault(); confirmSpeciate(); });
    el.btnSpeciateCancel.addEventListener('click', function () { closeModal(el.modalSpeciate); });
    el.btnConfirmYes.addEventListener('click', function () { resolveConfirm(true); });
    el.btnConfirmNo.addEventListener('click', function () { resolveConfirm(false); });
    el.btnTutorialNext.addEventListener('click', tutorialNext);
    el.btnTutorialSkip.addEventListener('click', endTutorial);
    el.filterAvailable.addEventListener('change', function () { prefs.onlyAvailable = el.filterAvailable.checked; savePrefs(); if (state) renderTraits(); });
    el.btnCb.addEventListener('click', function () { prefs.cb = !prefs.cb; savePrefs(); applyPrefs(); });
    el.btnPresent.addEventListener('click', function () { prefs.present = !prefs.present; savePrefs(); applyPrefs(); });

    function doRestart() { clearSave(); state = null; undoStack = []; el.speciesInput.value = ''; document.body.setAttribute('data-era', 'paleozoik'); showScreen('start'); }
    el.btnRestart.addEventListener('click', function () {
      if (state && state.status === 'playing') openConfirm('Rozpocząć nową grę? Bieżący postęp zostanie utracony.', doRestart);
      else doRestart();
    });
    el.btnPlayAgain.addEventListener('click', doRestart);

    // Modale zamykane Escape / kliknięciem w tło (poza tymi, które prowadzą przebieg tury).
    var closable = [el.modalCodex, el.modalTree, el.modalSummary, el.modalSpeciate, el.modalAch, el.modalMap];
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!el.modalConfirm.hidden) { resolveConfirm(false); return; }
      for (var i = 0; i < closable.length; i++) if (!closable[i].hidden) { closeModal(closable[i]); return; }
    });
    closable.forEach(function (m) { m.addEventListener('click', function (e) { if (e.target === m) closeModal(m); }); });

    var saved = loadSaved();
    if (saved) { state = saved; showScreen('game'); renderAll(); if (state.pendingQuiz) showQuiz(); else if (state.mutationOffer) showMutation(); }
    else showScreen('start');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
