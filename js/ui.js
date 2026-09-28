/*
 * ui.js — kontroler interfejsu.
 * Spina dane (GameData), silnik (Engine) i i18n (GameI18n) z DOM.
 * Logika gry jest w silniku; tutaj render, zdarzenia, zapis lokalny,
 * cofanie (tryb nauczyciela), samouczek i prognoza „co-jeśli”.
 */
(function () {
  'use strict';

  var DATA = window.GameData;
  var Engine = window.Engine;
  var T = window.GameI18n.t;
  var ART = window.GameArt; // warstwa graficzna (src/art); bez niej — zapasowe emoji
  var SAVE_KEY = 'ewolucja.save.v4';
  var TUTORIAL_KEY = 'ewolucja.tutorialDone';

  var state = null;
  var undoStack = [];
  // Trwa animacja tury — akcje zmieniające stan są wstrzymane, by nie zgubić zmian.
  var turnBusy = false;
  var UNDO_LIMIT = 50;

  var $ = function (id) { return document.getElementById(id); };
  // Ikona SVG z warstwy graficznej albo zapasowy znak, gdy jej brak.
  function ico(key, fallback, cls) { return (ART && ART.icon(key, cls)) || (fallback || ''); }
  var el = {
    screenStart: $('screen-start'), screenGame: $('screen-game'), screenEnd: $('screen-end'),
    formStart: $('form-start'), speciesInput: $('species-name'), introGoal: $('intro-goal'),
    scenarioCards: $('scenario-cards'),
    ep: $('ep-value'), pop: $('pop-value'), era: $('era-value'), intel: $('intel-value'),
    epAfford: $('ep-afford'), statusBar: $('status-bar'), statusSentinel: $('status-sentinel'), statusChoice: $('status-choice'),
    statusOutlook: $('status-outlook'), worldSeed: $('world-seed'), eraInfo: $('era-info'), envThreat: $('env-threat'),
    endScoreTotal: $('end-score-total'), endScoreParts: $('end-score-parts'), endAch: $('end-ach'), btnPlaySame: $('btn-play-same'),
    modalOutlook: $('modal-outlook'), outlookReasons: $('outlook-reasons'), btnOutlookContinue: $('btn-outlook-continue'),
    btnOutlookUndo: $('btn-outlook-undo'), btnOutlookEnd: $('btn-outlook-end'),
    timeline: $('era-timeline'),
    lineageChips: $('lineage-chips'), nicheButtons: $('niche-buttons'),
    btnSpeciate: $('btn-speciate'), btnTree: $('btn-tree'),
    speciesName: $('species-name-display'), speciesNiche: $('species-niche'),
    portrait: $('creature-portrait'), portraitCaption: $('creature-caption'),
    diorama: $('diorama'), dioramaCaption: $('diorama-caption'), startDiorama: $('start-diorama'),
    endFigure: $('end-figure'), endPortrait: $('end-portrait'), endCaption: $('end-caption'),
    endPath: $('end-path'), endPathBox: $('end-path-box'), endChart: $('end-chart'),
    btnTreeZoomIn: $('btn-tree-zoom-in'), btnTreeZoomOut: $('btn-tree-zoom-out'),
    btnSettings: $('btn-settings'), modalSettings: $('modal-settings'), settingsNote: $('settings-note'),
    btnSettingsClose: $('btn-settings-close'), btnSettingsX: $('btn-settings-x'),
    sparkline: $('sparkline'), forecastBody: $('forecast-body'),
    choiceCard: $('choice-card'), resourceMeters: $('resource-meters'),
    strategyButtons: $('strategy-buttons'), behaviorButtons: $('behavior-buttons'),
    selectionToggle: $('selection-toggle'), selectionText: $('selection-text'),
    statsList: $('stats-list'),
    envName: $('env-name'), envNote: $('env-note'), envCatastrophe: $('env-catastrophe'), envStats: $('env-stats'),
    traits: $('traits-container'),
    btnSimulate: $('btn-simulate'), btnUndo: $('btn-undo'),
    modalReport: $('modal-report'), reportEra: $('report-era'), reportEvent: $('report-event'), reportBody: $('report-body'),
    reportKnowledge: $('report-knowledge'), btnReportClose: $('btn-report-close'),
    modalCodex: $('modal-codex'), codexBody: $('codex-body'), btnCodexClose: $('btn-codex-close'),
    modalTree: $('modal-tree'), treeContainer: $('tree-container'), btnTreeClose: $('btn-tree-close'),
    modalSpeciate: $('modal-speciate'), formSpeciate: $('form-speciate'),
    speciateName: $('speciate-name'), speciateHint: $('speciate-hint'), btnSpeciateCancel: $('btn-speciate-cancel'),
    modalConfirm: $('modal-confirm'), confirmMessage: $('confirm-message'),
    btnConfirmYes: $('btn-confirm-yes'), btnConfirmNo: $('btn-confirm-no'),
    endEmblem: $('end-emblem'), endTitle: $('end-title'), endSummary: $('end-summary'),
    endStats: $('end-stats'), btnPlayAgain: $('btn-play-again'), btnOpenCodexEnd: $('btn-open-codex-end'),
    btnSummary: $('btn-summary'),
    modalSummary: $('modal-summary'), summaryText: $('summary-text'), btnSummaryClose: $('btn-summary-close'),
    btnSummaryCopy: $('btn-summary-copy'), btnSummaryDownload: $('btn-summary-download'),
    btnCodex: $('btn-codex'), btnRestart: $('btn-restart'),
    tutorial: $('tutorial'), tutorialProgress: $('tutorial-progress'),
    tutorialTitle: $('tutorial-title'), tutorialText: $('tutorial-text'),
    btnTutorialSkip: $('btn-tutorial-skip'), btnTutorialNext: $('btn-tutorial-next')
  };

  var STAT_META = [
    { key: 'feeding', label: 'Odżywianie' }, { key: 'defense', label: 'Obrona' },
    { key: 'reproduction', label: 'Rozród' }, { key: 'mobility', label: 'Mobilność' },
    { key: 'metabolism', label: 'Metabolizm' }, { key: 'intelligence', label: 'Inteligencja' }
  ];

  // ===================== Zapis / wczytanie =====================
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
  function loadSaved() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY));
      return (s && s.version === 6 && s.status === 'playing') ? s : null;
    } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

  // ===================== Cofanie =====================
  function pushUndo() { undoStack.push(JSON.stringify(state)); if (undoStack.length > UNDO_LIMIT) undoStack.shift(); }
  function onUndo() { if (turnBusy || !undoStack.length) return; state = JSON.parse(undoStack.pop()); save(); renderAll(); }
  function updateUndoButton() {
    el.btnUndo.disabled = (undoStack.length === 0);
    el.btnUndo.textContent = '↶ Cofnij' + (undoStack.length ? ' (' + undoStack.length + ')' : '') + ' — tryb nauczyciela';
  }

  function showScreen(name) {
    el.screenStart.hidden = name !== 'start';
    el.screenGame.hidden = name !== 'game';
    el.screenEnd.hidden = name !== 'end';
  }

  function newGame(speciesName, opts) {
    opts = Object.assign({}, opts || {});
    // Kod świata: podany przez gracza albo nowy, losowy.
    if (!opts.seed) opts.seed = Engine.normalizeSeed(el.worldSeed && el.worldSeed.value) || Engine.randomSeed();
    state = Engine.createInitialState(DATA, speciesName, opts);
    undoStack = [];
    save();
    showScreen('game');
    renderAll();
    maybeStartTutorial();
  }

  function scenarioOpts(sc) {
    return { difficulty: sc.difficulty, startEra: sc.startEra, startEp: sc.startEp,
      goal: sc.goal, startTraits: sc.startTraits, startNiche: sc.startNiche, scenarioId: sc.id };
  }
  function renderScenarios() {
    el.scenarioCards.innerHTML = '';
    DATA.SCENARIOS.forEach(function (sc) {
      var diff = DATA.DIFFICULTIES[sc.difficulty];
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'scenario-card';
      card.dataset.scenario = sc.id;
      var thumb = (ART && ART.creature) ? ART.creature.thumb({ id: 'sc-' + sc.id, name: sc.name, traits: sc.startTraits || [], niche: 'woda' }, 96, 52) : '';
      card.innerHTML = '<span class="scenario-icon">' + ico('scenario:' + sc.id, sc.icon) + '</span>' +
        (thumb ? '<img class="scenario-thumb" alt="" src="' + thumb + '">' : '') +
        '<span class="scenario-name">' + sc.name + '</span>' +
        '<span class="scenario-diff">' + diff.label + ' · cel: int. ' + (sc.goal != null ? sc.goal : diff.goal) + ' + kultura</span>' +
        '<span class="scenario-intro">' + sc.intro + '</span>';
      card.addEventListener('click', function () {
        newGame((el.speciesInput.value || '').trim() || 'Prazwierzę', scenarioOpts(sc));
      });
      el.scenarioCards.appendChild(card);
    });
  }

  // ===================== Render — pasek stanu =====================
  function renderStatus() {
    setAnimated(el.ep, state.ep);
    setAnimated(el.pop, Engine.totalPopulation(state));
    var era = Engine.currentEra(DATA, state);
    var tno = Math.min(state.turn + 1, era.turns.length);
    el.era.textContent = era.name + ' ' + tno + '/' + era.turns.length;
    el.era.title = era.dates || '';
    el.intel.textContent = Engine.maxIntelligence(state) + ' / ' + state.intelligenceGoal;
    // Ile cech aktywnej linii można kupić teraz — widać to bez przewijania do kart.
    var afford = DATA.TRAITS.filter(function (t) { return Engine.traitStatus(state, t) === 'available'; }).length;
    el.epAfford.textContent = state.status !== 'playing' ? '' :
      (afford ? 'stać Cię na ' + afford + ' ' + plural(afford, 'cechę', 'cechy', 'cech') : 'na razie nic do kupienia');
    el.statusChoice.hidden = !(state.pendingChoice && state.status === 'playing');
    el.statusOutlook.hidden = !(state.status === 'playing' && !Engine.victoryOutlook(DATA, state).possible);
  }
  function plural(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, h = n % 100;
    return (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? few : many;
  }
  /* Pasek stanu przykleja się pod nagłówkiem. Gdy jest „przyklejony”, robi się
     zwarty; jego wysokość trafia do CSS, by panel linii przyklejał się niżej. */
  function initStickyStatus() {
    var root = document.documentElement, topbar = document.querySelector('.topbar');
    function measure() {
      if (topbar) root.style.setProperty('--topbar-h', topbar.offsetHeight + 'px');
      if (el.statusBar && el.statusBar.offsetHeight) root.style.setProperty('--statusbar-h', el.statusBar.offsetHeight + 'px');
    }
    measure();
    window.addEventListener('resize', measure);
    if (window.ResizeObserver) new ResizeObserver(measure).observe(el.statusBar);
    if (window.IntersectionObserver && el.statusSentinel) {
      var io = new IntersectionObserver(function (entries) {
        el.statusBar.classList.toggle('is-stuck', !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0 + (topbar ? topbar.offsetHeight : 0));
      }, { rootMargin: '-' + ((topbar && topbar.offsetHeight) || 60) + 'px 0px 0px 0px' });
      io.observe(el.statusSentinel);
    }
    el.statusChoice.addEventListener('click', function () {
      el.choiceCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var first = el.choiceCard.querySelector('.choice-option:not(:disabled)'); if (first) first.focus({ preventScroll: true });
    });
  }
  function setAnimated(node, value) {
    if (node.textContent !== String(value)) {
      node.textContent = value;
      node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash');
    }
  }

  // ===================== Render — oś czasu =====================
  function renderTimeline() {
    // Oś czasu pokazuje tylko to, co gracz może wiedzieć: minione i zapowiedziane
    // katastrofy, stałe wymierania historyczne i „?” w oknie przesuwanego wymierania.
    el.timeline.innerHTML = '';
    Engine.eraTimeline(DATA, state).forEach(function (t, i) {
      var step = document.createElement('div');
      step.className = 'era-step';
      if (i < state.turn) step.classList.add('done');
      if (i === state.turn) step.classList.add('current');
      if (t.catastrophe) step.classList.add('catastrophe');
      if (t.maybe) step.classList.add('maybe');
      step.title = t.title + (t.catastrophe ? ' — ' + t.catastrophe.name : '') +
        (t.maybe ? ' — możliwe: ' + t.maybe + ' (jedna z zaznaczonych tur)' : '');
      step.innerHTML = '<span class="era-step-num">' + (i + 1) + (t.catastrophe ? ico('ui:meteor', '☄️') : '') +
        (t.maybe ? '<span class="era-maybe" aria-hidden="true">?</span>' : '') + '</span>' + t.title.split(' — ')[0];
      el.timeline.appendChild(step);
    });
  }
  // Cele bieżącej ery i kod świata.
  function renderEraInfo() {
    if (!el.eraInfo) return;
    var goals = (state.eraGoals || []).filter(function (g) { return g.era === Math.min(state.eraIndex, DATA.ERAS.length - 1); });
    var html = '';
    if (goals.length) {
      html += '<span class="era-info-label">' + ico('ui:target', '🎯') + ' Cele ery:</span>' + goals.map(function (g) {
        var d = Engine.goalDef(DATA, g.id); if (!d) return '';
        var mark = g.status === 'done' ? ico('ui:check', '✓') : (g.status === 'failed' ? ico('ui:close', '✗') : '○');
        return '<span class="era-goal ' + g.status + '" title="' + escapeHtml(d.desc) + '">' + mark + ' ' + escapeHtml(d.label) +
          ' <em>+' + d.reward + ' EP</em></span>';
      }).join('');
    }
    if (state.seed) {
      html += '<span class="world-code">Kod świata: <strong>' + escapeHtml(state.seed) + '</strong>' +
        ' <button type="button" class="btn-link" id="btn-copy-seed">kopiuj</button></span>';
    }
    el.eraInfo.innerHTML = html;
    el.eraInfo.hidden = !html;
    var cp = document.getElementById('btn-copy-seed');
    if (cp) cp.addEventListener('click', function () {
      try { navigator.clipboard.writeText(state.seed).then(function () { cp.textContent = 'skopiowano ✓'; }); } catch (e) { cp.textContent = state.seed; }
    });
  }

  // ===================== Render — linie / nisze =====================
  function nicheIcon(n) {
    var fb = (DATA.NICHES[n] && DATA.NICHES[n].icon) || '🌊';
    return ART ? '<span class="niche-ico" data-niche="' + n + '">' + ico('niche:' + n, fb) + '</span>' : fb;
  }
  function nicheLabel(n) { return (DATA.NICHES[n] && DATA.NICHES[n].label) || n; }
  function renderLineageBar() {
    el.lineageChips.innerHTML = '';
    state.lineages.forEach(function (l) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'lineage-chip';
      if (!l.alive) chip.classList.add('extinct');
      if (l.id === state.activeLineageId) chip.classList.add('active');
      chip.disabled = !l.alive;
      chip.innerHTML = (l.alive ? nicheIcon(l.niche) + ' ' : ico('ui:bone', '🦴') + ' ') + escapeHtml(l.name) +
        '<span class="lineage-chip-pop">' + (l.alive ? l.population : 'wymarła') + '</span>';
      if (l.alive) chip.addEventListener('click', function () { onSelectLineage(l.id); });
      el.lineageChips.appendChild(chip);
    });

    var can = Engine.canSpeciate(DATA, state);
    el.btnSpeciate.disabled = !can.ok || state.status !== 'playing';
    el.btnSpeciate.title = can.ok ? 'Rozdziel aktywną linię (koszt ' + Engine.speciationCost(DATA, state) + ' 🧬 zmienności)' : can.error;

    renderNicheButtons();
  }
  // Przyciski nisz — pokazują wszystkie nisze; aktywna wyróżniona, dostępne klikalne.
  function renderNicheButtons() {
    var a = Engine.getActiveLineage(state);
    el.nicheButtons.innerHTML = '';
    Object.keys(DATA.NICHES).forEach(function (key) {
      var cfg = DATA.NICHES[key];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'niche-btn' + (a.niche === key ? ' current' : '');
      btn.dataset.niche = key;
      btn.innerHTML = ico('niche:' + key, cfg.icon) + ' ' + cfg.label;
      if (a.niche === key) {
        btn.disabled = true; btn.title = 'Aktualna nisza';
      } else {
        var can = Engine.canMigrate(DATA, state, a, key);
        btn.disabled = !can.ok || state.status !== 'playing';
        btn.title = can.ok ? 'Migruj do niszy: ' + cfg.label + ' (koszt ' + can.cost + ' ⚡ rezerw, tura aklimatyzacji)' : can.error;
        if (can.ok) btn.addEventListener('click', function () { onMigrateTo(key); });
      }
      el.nicheButtons.appendChild(btn);
    });
  }
  function onSelectLineage(id) {
    if (turnBusy) return;
    state = Engine.setActiveLineage(state, id); save();
    renderActiveLineage(); renderLineageBar(); renderTraits(); renderTactics(); renderForecast(); renderEnv(); renderDiorama();
  }
  function onMigrateTo(niche) {
    if (turnBusy) return;
    var a = Engine.getActiveLineage(state);
    var res = Engine.migrateLineage(DATA, state, a.id, niche);
    if (!res.ok) { flash(res.error); return; }
    pushUndo(); state = res.state; save();
    renderStatus(); renderActiveLineage(); renderLineageBar(); renderTraits(); renderTactics(); renderForecast(); renderEnv(); renderDiorama(); updateUndoButton();
  }

  // ===================== Render — aktywna linia =====================
  function renderActiveLineage() {
    var l = Engine.getActiveLineage(state);
    el.speciesName.textContent = l.name;
    el.speciesNiche.innerHTML = 'Nisza: <strong>' + nicheIcon(l.niche) + ' ' + nicheLabel(l.niche) + '</strong>';
    renderStats(l);
    renderSparkline(l);
    renderPortrait(l);
  }
  // Żywy portret (warstwa graficzna). Bez niej rycina jest ukryta.
  var TRAIT_NAMES = {};
  DATA.TRAITS.forEach(function (t) { TRAIT_NAMES[t.id] = t.name; });
  function renderPortrait(l) {
    var fig = el.portrait && el.portrait.parentNode;
    if (!ART || !ART.portrait || !fig) { if (fig) fig.hidden = true; return; }
    var env = Engine.currentTurnEnv(DATA, state);
    ART.portrait.update(el.portrait, l, { climate: env ? env.climate : undefined, traitNames: TRAIT_NAMES });
    el.portraitCaption.textContent = 'Ryc. ' + (state.lineages.indexOf(l) + 1) + '. ' + l.name +
      ' — ' + (l.traits.length ? 'cech: ' + l.traits.length : 'prosty organizm') + ', nisza: ' + nicheLabel(l.niche).toLowerCase();
  }
  function renderStats(lineage) {
    el.statsList.innerHTML = '';
    STAT_META.forEach(function (m) {
      var val = lineage.stats[m.key];
      var pct = Math.max(0, Math.min(100, (val / 20) * 100));
      var li = document.createElement('li');
      li.className = 'stat-row';
      li.innerHTML = '<span class="stat-name">' + m.label + '</span>' +
        '<span class="stat-bar"><span class="stat-fill ' + m.key + '" style="width:' + pct + '%"></span></span>' +
        '<span class="stat-num">' + val + '</span>';
      el.statsList.appendChild(li);
    });
  }

  // ===================== Render — wykres populacji =====================
  // Oś całej gry (wszystkie ery), pasma er, znaczniki katastrof, podpowiedź
  // po najechaniu. Jedna seria (linia) — bez legendy; tytuł nazywa serię.
  var TOTAL_T = Engine.totalTurns(DATA);
  // Początek osi = początek ery, w której zaczęła się gra (scenariusz może startować później).
  function gameStartT() {
    var root = state && state.lineages[0];
    return root ? Engine.globalTurn(DATA, root.bornEra, 0) : 0;
  }
  function eraBounds() {
    var acc = 0, t0 = gameStartT();
    return DATA.ERAS.map(function (e) { var b = { name: e.name, id: e.id, start: acc, end: acc + e.turns.length }; acc += e.turns.length; return b; })
      .filter(function (b) { return b.end > t0; });
  }
  // Katastrofy, które już się wydarzyły (kalendarz świata jest losowy — przyszłych nie zdradzamy).
  function catastropheTurns() {
    var t0 = gameStartT(), out = [];
    (state.history || []).forEach(function (r, i) { if (r.catastrophe) out.push({ x: t0 + i + 1, name: r.catastrophe.name }); });
    return out;
  }
  // Etykieta punktu osi: x = liczba przeżytych tur od początku gry.
  function turnLabel(x) {
    if (x <= 0) return 'Start';
    var acc = 0, label = 'Tura ' + x;
    DATA.ERAS.forEach(function (e) {
      if (x - 1 >= acc && x - 1 < acc + e.turns.length) {
        var tb = Engine.turnBase(DATA, state, DATA.ERAS.indexOf(e), x - 1 - acc);
        label += ' · ' + (tb ? tb.title : e.turns[x - 1 - acc].title).split(' — ')[0];
      }
      acc += e.turns.length;
    });
    return label;
  }
  function niceCeil(v) {
    var p = Math.pow(10, Math.floor(Math.log(Math.max(1, v)) / Math.LN10));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= v) return steps[i] * p;
    return 10 * p;
  }
  function renderPopChart(box, lineage, height) {
    var W = Math.max(220, box.clientWidth - 8 || 280), H = height || 92;
    var padL = 6, padR = 34, padT = 16, padB = 14;
    var born = Engine.globalTurn(DATA, lineage.bornEra, lineage.bornTurn);
    var d = lineage.popHistory || [];
    var maxV = niceCeil(Math.max(10, Math.max.apply(null, d.length ? d : [0])));
    var T0 = gameStartT(), span = Math.max(1, TOTAL_T - T0);
    var xOf = function (t) { return padL + ((t - T0) / span) * (W - padL - padR); };
    var yOf = function (v) { return H - padB - (v / maxV) * (H - padT - padB); };
    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">';
    // pasma er (naprzemienne tło) z nazwą ery
    eraBounds().forEach(function (b, i) {
      var x0 = xOf(b.start), x1 = xOf(b.end);
      if (i % 2 === 1) svg += '<rect x="' + x0 + '" y="' + padT + '" width="' + (x1 - x0) + '" height="' + (H - padT - padB) + '" fill="var(--line)" opacity="0.35"/>';
      svg += '<text x="' + (x0 + 3) + '" y="' + (padT - 5) + '" class="pc-era">' + escapeHtml(b.name) + '</text>';
    });
    // siatka: linia bazowa i górna wartość skali
    svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yOf(0) + '" y2="' + yOf(0) + '" class="pc-axis"/>';
    svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yOf(maxV) + '" y2="' + yOf(maxV) + '" class="pc-grid"/>';
    svg += '<text x="' + (W - padR + 4) + '" y="' + (yOf(maxV) + 3) + '" class="pc-tick">' + maxV + '</text>';
    // katastrofy — znacznik na górnej krawędzi (ikona + opis w tytule)
    catastropheTurns().forEach(function (c) {
      var x = xOf(c.x);
      svg += '<g class="pc-cat"><title>' + escapeHtml(c.name) + '</title><line x1="' + x + '" x2="' + x + '" y1="' + padT + '" y2="' + (H - padB) + '"/>' +
        '<path d="M' + (x - 3.5) + ' ' + (padT - 1) + 'l3.5 5 3.5-5z"/></g>';
    });
    if (d.length >= 1) {
      var pts = d.map(function (v, i) { return [xOf(born + i), yOf(v)]; });
      var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      if (pts.length > 1) {
        svg += '<path d="' + line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + yOf(0) + ' L' + pts[0][0].toFixed(1) + ' ' + yOf(0) + ' Z" class="pc-area"/>';
        svg += '<path d="' + line + '" class="pc-line"/>';
      }
      var last = pts[pts.length - 1];
      svg += '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" class="pc-dot"/>';
      svg += '<text x="' + (last[0] + 7) + '" y="' + (last[1] + 4) + '" class="pc-value">' + d[d.length - 1] + '</text>';
    }
    svg += '<g class="pc-hover" visibility="hidden"><line class="pc-cross" y1="' + padT + '" y2="' + (H - padB) + '"/><circle r="4" class="pc-dot"/></g>';
    svg += '</svg><div class="pc-tip" hidden></div>';
    box.innerHTML = svg;
    box.setAttribute('aria-label', 'Populacja linii ' + lineage.name + ': ' +
      (d.length ? 'od ' + d[0] + ' do ' + d[d.length - 1] + ' (maks. ' + Math.max.apply(null, d) + ')' : 'brak danych') + '.');
    // podpowiedź: celownik na najbliższej turze
    var svgEl = box.querySelector('svg'), hov = box.querySelector('.pc-hover'), tip = box.querySelector('.pc-tip');
    if (!d.length) return;
    svgEl.addEventListener('mousemove', function (e) {
      var r = svgEl.getBoundingClientRect();
      var t = T0 + Math.round(((e.clientX - r.left - padL) / (W - padL - padR)) * span);
      var i = Math.max(0, Math.min(d.length - 1, t - born));
      var x = xOf(born + i), y = yOf(d[i]);
      hov.setAttribute('visibility', 'visible');
      hov.querySelector('line').setAttribute('x1', x); hov.querySelector('line').setAttribute('x2', x);
      hov.querySelector('circle').setAttribute('cx', x); hov.querySelector('circle').setAttribute('cy', y);
      tip.hidden = false;
      tip.innerHTML = '<span>' + escapeHtml(turnLabel(born + i)) + '</span><strong>' + d[i] + '</strong>';
      tip.style.left = Math.min(W - 120, Math.max(0, x - 50)) + 'px';
    });
    svgEl.addEventListener('mouseleave', function () { hov.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  }
  function renderSparkline(lineage) { renderPopChart(el.sparkline, lineage, 92); }

  // ===================== Render — prognoza (co-jeśli) =====================
  function renderForecast(previewTrait, previewTactics) {
    var l = Engine.getActiveLineage(state);
    if (ART && ART.portrait && el.portrait) ART.portrait.preview(el.portrait, previewTrait ? previewTrait.id : null);
    var base = Engine.forecast(DATA, state, l);
    if (!base) { el.forecastBody.innerHTML = '<span class="forecast-none">Era dobiega końca.</span>'; return; }

    var deltaClass = base.delta >= 0 ? 'pos' : 'neg';
    var html = '<div class="forecast-row"><span>Populacja</span><span class="fc ' + deltaClass + '">' +
      (base.delta >= 0 ? '+' : '') + base.delta + ' → ' + base.projectedPop + '</span></div>';
    html += '<div class="forecast-row"><span>Bilans energii</span><span class="fc ' +
      (base.energy >= 0 ? 'pos' : 'neg') + '">' + num(base.energy) + '</span></div>';
    html += '<div class="forecast-row"><span>' + ENERGY + ' Rezerwy</span><span class="fc ' +
      (base.reservesAfter >= base.reserves ? 'pos' : 'neg') + '">' + num(base.reserves) + ' → ' + num(base.reservesAfter) + '</span></div>';
    var capWarn = base.nicheLoad >= base.capacity * DATA.CAPACITY.warnAt;
    html += '<div class="forecast-row"><span>Pojemność niszy</span><span class="fc' + (capWarn ? ' neg' : '') + '">' +
      base.nicheLoad + ' / ' + base.capacity + '</span></div>';
    if (base.crowdDeaths) {
      html += '<div class="forecast-row"><span>Straty z przegęszczenia</span><span class="fc neg">−' + base.crowdDeaths + '</span></div>';
    }
    if (base.diseaseDeaths) {
      html += '<div class="forecast-row"><span>Straty z choroby</span><span class="fc neg">−' + base.diseaseDeaths + '</span></div>';
    }

    if (previewTrait) {
      var withT = Engine.forecastWithTrait(DATA, state, l, previewTrait);
      var diff = withT.delta - base.delta;
      html += '<div class="forecast-preview"><strong>Z cechą „' + escapeHtml(previewTrait.name) + '”:</strong> ' +
        'populacja ' + (withT.delta >= 0 ? '+' : '') + withT.delta +
        ' <span class="fc ' + (diff >= 0 ? 'pos' : 'neg') + '">(' + (diff >= 0 ? '+' : '') + diff + ')</span></div>';
    }
    if (previewTactics) {
      var withTac = Engine.forecastWithTactics(DATA, state, l, previewTactics);
      var dt = withTac.delta - base.delta;
      html += '<div class="forecast-preview"><strong>' + escapeHtml(previewTactics.label) + ':</strong> ' +
        'populacja ' + (withTac.delta >= 0 ? '+' : '') + withTac.delta +
        ' <span class="fc ' + (dt >= 0 ? 'pos' : 'neg') + '">(' + (dt >= 0 ? '+' : '') + dt + ')</span>' +
        ', rezerwy → ' + num(withTac.reservesAfter) + '</div>';
    }
    if (capWarn) {
      html += '<div class="forecast-note">Nisza jest prawie pełna — rozród słabnie. Nowa gałąź w wolnej niszy (specjacja + migracja) ma własną pojemność.</div>';
    }
    if (base.enemyRelease) {
      html += '<div class="forecast-note">Nowy gatunek: miejscowe drapieżniki jeszcze na niego nie polują (presja ×' +
        num(DATA.NEW_LINEAGE.predMult) + ').</div>';
    }
    if (base.behaviorBlocked) {
      html += '<div class="forecast-warn">Za mało rezerw na wybrane zachowanie — linia będzie żyła zwyczajnie.</div>';
    }

    if (base.acclimatizing) {
      html += '<div class="forecast-note">Aklimatyzacja w nowej niszy — w tej turze mniej pokarmu.</div>';
    }
    if (base.notes && base.notes.length) {
      html += '<div class="forecast-note">' + ico('ui:balance', '⚖') + ' Kompromisy teraz: ' + base.notes.map(function (n) {
        return escapeHtml(n.trait) + ' — ' + escapeHtml(n.note) + ' (' + effectsText(n.effects) + ')';
      }).join('; ') + '.</div>';
    }
    if (base.catastrophe) {
      html += '<div class="forecast-warn">' + ico('ui:meteor', '☄️') + ' Uwaga: nadchodzi katastrofa (' +
        escapeHtml(base.catastrophe.name) + ') — uderzy w niszę ' +
        (base.catastrophe.niche === 'all' ? 'wszystkich' : nicheLabel(base.catastrophe.niche)) +
        '. Przewidywane straty: ok. ' + base.catastropheLoss + '% populacji' +
        (base.survivalReasons.length ? ' (pomaga: ' + escapeHtml(base.survivalReasons.join('; ')) + ')' : '') + '.</div>';
    }
    Engine.cultureNicheBlocked(state, DATA).forEach(function (b) {
      html += '<div class="forecast-warn">' + ico('ui:target', '🎯') + ' ' + escapeHtml(b.name) + ': ' + escapeHtml(b.path.label) +
        ' nie działa w niszy „' + escapeHtml(nicheLabel(Engine.getLineage(state, b.lineageId).niche)) + '” — przenieś linię: ' +
        b.path.niches.map(nicheLabel).join(' lub ') + '.</div>';
    });
    if (Engine.goalBlockedByPopulation(state, DATA)) {
      html += '<div class="forecast-warn">' + ico('ui:target', '🎯') + ' Inteligencja i kultura są, ale do zwycięstwa potrzeba co najmniej ' +
        DATA.WIN_MIN_POP + ' osobników w tej linii — odbuduj populację.</div>';
    }
    if (base.critical) {
      html += '<div class="forecast-warn">' + ico('ui:paw', '🐾') + ' Populacja krytycznie mała (poniżej ' +
        DATA.MIN_VIABLE_POP + ' osobników): rozród słabnie, a każda strata może zakończyć linię.</div>';
    }
    el.forecastBody.innerHTML = html;
  }

  // Symbole walut linii (ikona SVG albo zapasowy znak).
  var ENERGY = ico('ui:energy', '⚡', 'ico-energy'), GENE = ico('ui:gene', '🧬', 'ico-gene');
  function num(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }

  // ===================== Render — decyzje linii (⚡ rezerwy, 🧬 zmienność) =====================
  function renderTactics() {
    var l = Engine.getActiveLineage(state), playing = state.status === 'playing';
    var cap = Engine.reservesCap(DATA, l), vcap = DATA.VARIATION.cap;
    el.resourceMeters.innerHTML =
      meter('energy', ENERGY + ' Rezerwy', 'Rezerwy energii', l.reserves, cap,
        'Nadwyżki energii odkładane na chude tury. Pokrywają deficyt (do ' + num(DATA.RESERVES.drawMax) +
        ' na turę); płacisz nimi za migrację i zachowania.') +
      meter('gene', GENE + ' Zmienność', 'Zmienność genetyczna', l.variation, vcap,
        'Rośnie z czasem i liczebnością, znika w wąskim gardle. Płacisz nią za specjację i ukierunkowany dobór; ' +
        'od ' + DATA.VARIATION.shieldMin + ' w górę łagodzi katastrofy.');

    el.strategyButtons.innerHTML = '';
    Object.keys(DATA.STRATEGIES).forEach(function (key) {
      var st = DATA.STRATEGIES[key];
      var b = tacticButton(st, key === l.strategy, '', playing);
      b.title = st.desc;
      if (playing) {
        b.addEventListener('click', function () { onSetStrategy(key); });
        previewOn(b, { strategy: key, label: st.label });
      }
      el.strategyButtons.appendChild(b);
    });

    el.behaviorButtons.innerHTML = '';
    Object.keys(DATA.BEHAVIORS).forEach(function (key) {
      var bh = DATA.BEHAVIORS[key], can = Engine.canSetBehavior(DATA, l, key);
      var b = tacticButton(bh, key === (l.behavior || 'brak'), bh.cost ? bh.cost + ' ' + ENERGY : '', playing && can.ok);
      b.title = bh.desc + (can.ok ? '' : ' — ' + can.error);
      if (playing && can.ok) {
        b.addEventListener('click', function () { onSetBehavior(key); });
        previewOn(b, { behavior: key, label: bh.label });
      }
      el.behaviorButtons.appendChild(b);
    });

    var V = DATA.VARIATION;
    el.selectionToggle.checked = !!l.selection;
    el.selectionToggle.disabled = !playing || (!l.selection && l.variation < V.selectionCost);
    el.selectionText.innerHTML = '<strong>Ukierunkowany dobór</strong> (' + V.selectionCost + ' ' + GENE + ' na turę): ' +
      'częstsze i częściej korzystne mutacje — silny dobór zużywa zmienność.';

    renderChoiceCard();
  }
  function meter(kind, label, fullLabel, value, max, hint) {
    var pct = Math.max(0, Math.min(100, (value / max) * 100));
    return '<div class="res-meter res-' + kind + '" title="' + escapeHtml(fullLabel + ': ' + hint) + '">' +
      '<span class="res-name">' + label + '</span>' +
      '<span class="res-bar" role="meter" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + value + '" aria-label="' + escapeHtml(fullLabel) + '">' +
      '<span class="res-fill" style="width:' + pct + '%"></span></span>' +
      '<span class="res-num">' + num(value) + ' / ' + max + '</span></div>';
  }
  function tacticButton(item, active, cost, enabled) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tactic-btn' + (active ? ' current' : '');
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
    b.disabled = !enabled;
    b.innerHTML = ico(item.art, '<span aria-hidden="true">' + item.icon + '</span>') + ' ' + escapeHtml(item.label) +
      (cost ? ' <span class="tactic-cost">' + cost + '</span>' : '');
    return b;
  }
  function previewOn(b, tactics) {
    b.addEventListener('mouseenter', function () { renderForecast(null, tactics); });
    b.addEventListener('mouseleave', function () { renderForecast(); });
    b.addEventListener('focus', function () { renderForecast(null, tactics); });
    b.addEventListener('blur', function () { renderForecast(); });
  }
  // Karta decyzji — dotyczy konkretnej linii (niekoniecznie aktywnej).
  function renderChoiceCard() {
    var pc = state.pendingChoice;
    if (!pc || state.status !== 'playing') { el.choiceCard.hidden = true; el.choiceCard.innerHTML = ''; return; }
    var ev = Engine.choiceEvent(DATA, pc.eventId), l = Engine.getLineage(state, pc.lineageId);
    if (!ev || !l) { el.choiceCard.hidden = true; return; }
    var def = Engine.defaultOption(ev);
    el.choiceCard.hidden = false;
    el.choiceCard.innerHTML = '<div class="choice-head"><span class="choice-icon" aria-hidden="true">' + ico(ev.art, ev.icon) + '</span>' +
      '<div><strong>' + escapeHtml(ev.name) + '</strong><div class="choice-target">Linia: ' + escapeHtml(l.name) + '</div></div></div>' +
      '<p class="choice-desc">' + escapeHtml(ev.desc) + '</p><div class="choice-options"></div>' +
      '<p class="choice-default">Bez wyboru: „' + escapeHtml(def.label) + '”.</p>';
    var box = el.choiceCard.querySelector('.choice-options');
    ev.options.forEach(function (o) {
      var can = Engine.canChoose(DATA, state, o.id);
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'choice-option';
      b.disabled = !can.ok || turnBusy;
      var risk = o.gamble ? '<em class="choice-risk">' + ico('ui:target', '🎲') + ' Ryzyko — szansa powodzenia ' +
        Math.round(Engine.gambleChance(DATA, l, o.gamble) * 100) + '%</em>' : '';
      b.innerHTML = '<strong>' + escapeHtml(o.label) + '</strong>' + risk + '<span>' + escapeHtml(o.desc) + '</span>' +
        (can.ok ? '' : '<span class="choice-block">' + escapeHtml(can.error) + '</span>');
      if (can.ok) b.addEventListener('click', function () { onChoose(o.id); });
      box.appendChild(b);
    });
  }
  function applyAction(res) {
    if (!res.ok) { flash(res.error); return false; }
    pushUndo(); state = res.state; save();
    return true;
  }
  function onSetStrategy(key) {
    if (turnBusy) return;
    if (applyAction(Engine.setStrategy(DATA, state, state.activeLineageId, key))) { renderTactics(); renderForecast(); updateUndoButton(); }
  }
  function onSetBehavior(key) {
    if (turnBusy) return;
    if (applyAction(Engine.setBehavior(DATA, state, state.activeLineageId, key))) { renderTactics(); renderForecast(); updateUndoButton(); }
  }
  function onToggleSelection() {
    if (turnBusy || !applyAction(Engine.setSelection(DATA, state, state.activeLineageId, el.selectionToggle.checked))) { renderTactics(); return; }
    renderTactics(); renderForecast(); updateUndoButton();
  }
  function onChoose(optionId) {
    if (turnBusy) return;
    if (applyAction(Engine.resolveChoice(DATA, state, optionId))) renderAll();
  }

  function effectsText(effects) {
    return Object.keys(effects).map(function (k) {
      return Engine.statLabel(k) + ' ' + (effects[k] > 0 ? '+' : '') + effects[k];
    }).join(', ');
  }

  // ===================== Render — środowisko =====================
  function renderEnv() {
    var env = Engine.currentTurnEnv(DATA, state);
    if (!env) {
      el.envName.textContent = 'Era dobiega końca';
      el.envNote.textContent = ''; el.envStats.innerHTML = ''; el.envCatastrophe.hidden = true;
      return;
    }
    el.envName.textContent = env.title;
    el.envNote.textContent = env.note;
    var a = Engine.getActiveLineage(state);
    var cfg = DATA.NICHES[a.niche];
    // Warunki tej tury (wylosowane) i typowe dla epoki — różnica pokazuje zmienność środowiska.
    var typical = Engine.turnBase(DATA, state, state.eraIndex, state.turn);
    var nicheEnv = nicheEnvFor(env, a.niche), typEnv = nicheEnvFor(typical, a.niche);
    function dev(v, t) {
      var d = Math.round(v) - Math.round(t);
      return d === 0 ? '' : ' <span class="env-dev">(' + (d > 0 ? '↑' : '↓') + ' typowo ' + Math.round(t) + ')</span>';
    }
    el.envStats.innerHTML = chip('Klimat: ' + climateLabel(env.climate) +
        (env.climateShifted ? ' <span class="env-dev">(typowo ' + climateLabel(typical.climate) + ')</span>' : '')) +
      chip('Tlen: ' + env.oxygen + dev(env.oxygen, typical.oxygen)) +
      chip('Pokarm (' + cfg.label.toLowerCase() + '): ' + Math.round(nicheEnv.food) + dev(nicheEnv.food, typEnv.food)) +
      chip('Drapieżniki: ' + Math.round(nicheEnv.predators) + dev(nicheEnv.predators, typEnv.predators)) +
      chip('Pojemność: ' + (Engine.forecast(DATA, state, a) || {}).capacity);
    if (env.catastrophe) {
      el.envCatastrophe.hidden = false;
      var cn = env.catastrophe.niche === 'all' ? 'wszystkich' : DATA.NICHES[env.catastrophe.niche].label;
      el.envCatastrophe.innerHTML = ico('ui:meteor', '☄️') + ' ' + (env.catastrophe.regional ? 'Katastrofa regionalna: ' : '') +
        escapeHtml(env.catastrophe.name) + ' — niszczy niszę ' + cn + '!' +
        (env.catastrophe.note ? ' <span class="env-cat-note">' + escapeHtml(env.catastrophe.note) + '</span>' : '');
    } else el.envCatastrophe.hidden = true;
    renderThreat(el.envThreat, Engine.upcomingThreat(DATA, state));
  }
  // Zapowiedź katastrofy w następnej turze — czas, by przenieść linię lub odłożyć zapasy.
  function threatHtml(th) {
    return ico('ui:hourglass', '⏳') + ' <strong>Zapowiedź na następną turę' + (th.newEra ? ' (' + escapeHtml(th.newEra) + ')' : '') + ':</strong> ' +
      (th.regional ? 'katastrofa regionalna — ' : '') + escapeHtml(th.name) + ', uderzy ' +
      (th.niche === 'all' ? 'we wszystkie nisze' : 'w niszę „' + escapeHtml(nicheLabel(th.niche)) + '”') + '.' +
      (th.note ? ' ' + escapeHtml(th.note) : '');
  }
  function renderThreat(node, th) {
    if (!node) return;
    node.hidden = !th;
    node.innerHTML = th ? threatHtml(th) : '';
  }
  function nicheEnvFor(env, niche) {
    var cfg = DATA.NICHES[niche];
    return cfg.land ? env.land
      : { food: env.food * (cfg.foodMult || 1), predators: env.predators * (cfg.predMult || 1) };
  }

  // ===================== Render — diorama środowiska =====================
  function renderDiorama() {
    if (!el.diorama) return;
    if (!ART || !ART.diorama) { el.diorama.hidden = true; return; }
    var a = Engine.getActiveLineage(state);
    var era = Engine.currentEra(DATA, state);
    var env = Engine.currentTurnEnv(DATA, state);
    var ne = env ? nicheEnvFor(env, a.niche) : { food: 6, predators: 3 };
    var cat = env && env.catastrophe && (env.catastrophe.niche === 'all' || env.catastrophe.niche === a.niche);
    ART.diorama.update(el.diorama, {
      era: era.id, niche: a.niche, climate: env ? env.climate : undefined,
      food: ne.food, predators: ne.predators, catastrophe: !!cat,
      lineages: state.lineages.filter(function (l) { return l.alive && l.niche === a.niche; }).map(function (l) {
        return { id: l.id, name: l.name, traits: l.traits, niche: l.niche, population: l.population, active: l.id === a.id, parentId: l.parentId };
      })
    });
    var others = state.lineages.filter(function (l) { return l.alive && l.niche === a.niche && l.id !== a.id; }).length;
    el.dioramaCaption.innerHTML = nicheIcon(a.niche) + ' <strong>' + escapeHtml(nicheLabel(a.niche)) + '</strong> · ' +
      escapeHtml(env ? env.title : era.name) + (env ? ' · ' + climateLabel(env.climate) : '') +
      (others ? ' · ' + ico('ui:branch', '') + ' +' + others + (others === 1 ? ' linia' : ' linie') : '') +
      (cat ? ' · <span class="diorama-warn">' + ico('ui:meteor', '☄️', 'ico-danger') + ' ' + escapeHtml(env.catastrophe.name) + '</span>' : '');
  }
  function chip(t) { return '<li>' + t + '</li>'; }
  function climateLabel(c) {
    return c === 'zimno' ? ico('ui:snow', '❄️', 'ico-cold') + ' zimno'
      : (c === 'cieplo' ? ico('ui:sun', '☀️', 'ico-warm') + ' ciepło' : ico('ui:mild', '⛅') + ' umiarkowanie');
  }

  // ===================== Render — drzewo cech =====================
  function renderTraits() {
    el.traits.innerHTML = '';
    var lineage = Engine.getActiveLineage(state);
    Object.keys(DATA.CATEGORIES).forEach(function (catKey) {
      var inCat = DATA.TRAITS.filter(function (t) { return t.category === catKey; });
      if (!inCat.length) return;
      var section = document.createElement('div');
      section.className = 'trait-category';
      section.dataset.cat = catKey;
      var h3 = document.createElement('h3');
      h3.innerHTML = ico('cat:' + catKey, DATA.CATEGORY_ICONS[catKey] || '') + ' ' + escapeHtml(DATA.CATEGORIES[catKey]);
      section.appendChild(h3);
      var grid = document.createElement('div'); grid.className = 'trait-grid';
      inCat.forEach(function (trait) { grid.appendChild(renderTraitCard(trait, lineage)); });
      section.appendChild(grid);
      el.traits.appendChild(section);
    });
  }
  function renderTraitCard(trait, lineage) {
    var status = Engine.traitStatus(state, trait);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trait ' + status + (trait.path === 'intelligence' ? ' path-intel' : '');
    btn.dataset.traitId = trait.id;
    btn.disabled = (status !== 'available') || state.status !== 'playing';

    var costLabel;
    if (status === 'owned') costLabel = ico('ui:check', '✓') + ' zdobyta';
    else if (status === 'locked') costLabel = ico('ui:lock', '🔒') + ' zablokowana';
    else if (status === 'era_locked') costLabel = ico('ui:hourglass', '⏳') + ' ' + DATA.ERAS[trait.minEra].name;
    else costLabel = trait.cost + ' EP';

    var extra = '';
    if (status === 'locked') {
      var missing = trait.requires.filter(function (id) { return lineage.traits.indexOf(id) === -1; });
      extra = '<div class="trait-req">' + ico('ui:lock', '🔒') + '<span>Najpierw zdobądź: <strong>' + reqNames(missing) +
        '</strong> (koszt: ' + trait.cost + ' EP)</span></div>';
    } else if (status === 'era_locked') {
      extra = '<div class="trait-req">' + ico('ui:hourglass', '⏳') + '<span>Dostępna od ery: <strong>' + DATA.ERAS[trait.minEra].name +
        '</strong> (koszt: ' + trait.cost + ' EP)</span></div>';
    } else if (status === 'too_expensive') {
      extra = '<div class="trait-req warn">Brakuje ' + (trait.cost - state.ep) + ' EP</div>';
    }

    btn.dataset.cat = trait.category;
    var star = trait.path === 'intelligence' ? '<span class="trait-star" title="Droga do inteligencji">' + ico('ui:star', '⭐', 'ico-star') + '</span> ' : '';
    var badge = ART ? '<span class="trait-badge">' + ico('trait:' + trait.id, trait.icon) + '</span>' : '';
    var nameIco = ART ? '' : (trait.icon ? trait.icon + ' ' : '');
    btn.innerHTML = '<div class="trait-head">' + badge + '<span class="trait-name">' + star + nameIco + trait.name + '</span>' +
      '<span class="trait-cost">' + costLabel + '</span></div>' +
      '<div class="trait-desc">' + trait.desc + '</div>' +
      '<div class="trait-effects">' + renderEffects(trait.effects) + '</div>' +
      '<div class="trait-tradeoff">' + ico('ui:balance', '⚖') + '<span>' + trait.tradeoff + '</span></div>' +
      (trait.conditions || []).map(function (c) {
        return '<div class="trait-condition">' + c.note + ': ' + effectsText(c.effects) + '</div>';
      }).join('') + extra;

    if (status === 'available' && state.status === 'playing') {
      btn.addEventListener('click', function () { onBuyTrait(trait.id); });
      btn.addEventListener('mouseenter', function () { renderForecast(trait); });
      btn.addEventListener('mouseleave', function () { renderForecast(); });
      btn.addEventListener('focus', function () { renderForecast(trait); });
      btn.addEventListener('blur', function () { renderForecast(); });
    }
    return btn;
  }
  function renderEffects(effects) {
    var html = '';
    for (var k in effects) if (Object.prototype.hasOwnProperty.call(effects, k)) {
      var v = effects[k];
      html += '<span class="effect-chip ' + (v > 0 ? 'up' : 'down') + '">' + Engine.statLabel(k) + ' ' + (v > 0 ? '+' : '') + v + '</span>';
    }
    return html;
  }
  function reqNames(ids) {
    return ids.map(function (id) { var t = DATA.TRAITS.filter(function (x) { return x.id === id; })[0]; return t ? t.name : id; }).join(', ');
  }

  // ===================== Akcje =====================
  function onBuyTrait(traitId) {
    if (turnBusy) return;
    var res = Engine.buyTrait(DATA, state, traitId);
    if (!res.ok) { flash(res.error); return; }
    pushUndo(); state = res.state; save();
    renderStatus(); renderActiveLineage(); renderTraits(); renderLineageBar(); renderTactics(); renderForecast(); renderDiorama(); updateUndoButton();
  }
  function onSpeciate() {
    if (turnBusy) return;
    var can = Engine.canSpeciate(DATA, state);
    if (!can.ok) { flash(can.error); return; }
    var base = Engine.getActiveLineage(state).name;
    el.speciateHint.textContent = 'Rozdzielasz „' + base + '” na dwie gałęzie (koszt ' + Engine.speciationCost(DATA, state) +
      ' 🧬 zmienności). ' + Math.round(DATA.SPECIATION_SHARE * 100) + '% populacji założy nową gałąź, która będzie ewoluować niezależnie. ' +
      'Wyślij ją do wolnej niszy — tam ma własną pojemność i przez ' + DATA.NEW_LINEAGE.turns + ' tury mniej drapieżników. W tej samej niszy obie linie będą ze sobą konkurować.';
    el.speciateName.value = base + ' II';
    openModal(el.modalSpeciate); el.speciateName.focus(); el.speciateName.select();
  }
  function confirmSpeciate() {
    var base = Engine.getActiveLineage(state).name;
    var name = (el.speciateName.value || '').trim() || (base + ' II');
    var res = Engine.speciate(DATA, state, name);
    closeModal(el.modalSpeciate);
    if (!res.ok) { flash(res.error); return; }
    pushUndo(); state = res.state; save(); renderAll();
  }
  function onSimulate() {
    if (turnBusy) return;
    var res = Engine.simulateTurn(DATA, state);
    if (!res.report) return;
    var play = buildTurnPlay(res.report, state);
    function applyTurn() {
      setTurnBusy(false);
      pushUndo(); state = res.state; save(); renderAll(); showReport(res.report);
    }
    var skipAnim = ART && ART.settings && ART.settings.get().turnAnimation === 'skip';
    if (!play || skipAnim || !ART || !ART.diorama || !el.diorama || el.diorama.hidden || !ART.diorama.canAnimate(el.diorama)) { applyTurn(); return; }
    setTurnBusy(true);
    // Diorama poza ekranem → przewiń do niej, by gracz zobaczył przebieg tury.
    var rect = el.diorama.getBoundingClientRect();
    var offscreen = rect.bottom < 60 || rect.top > window.innerHeight - 60;
    if (offscreen) el.diorama.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () {
      if (!ART.diorama.canPlay(el.diorama)) { applyTurn(); return; }
      ART.diorama.playTurn(el.diorama, play).then(applyTurn, applyTurn);
    }, offscreen ? 500 : 0);
  }
  function setTurnBusy(on) {
    turnBusy = on;
    document.body.classList.toggle('turn-busy', on);
    el.btnSimulate.disabled = on || (state && state.status !== 'playing');
  }
  // Dane animacji tury dla aktywnej linii (liczby z raportu silnika).
  function buildTurnPlay(report, before) {
    var a = Engine.getActiveLineage(before);
    var lr = report.lineReports.filter(function (x) { return x.lineageId === a.id; })[0];
    if (!lr) return null;
    var mut = null;
    lr.events.forEach(function (t) {
      var m = /^(Korzystna|Szkodliwa) mutacja: (.+?)\.?$/.exec(t);
      if (m) mut = { beneficial: m[1] === 'Korzystna', text: m[2] };
    });
    var cat = null;
    if (report.catastrophe && (report.catastrophe.niche === 'all' || report.catastrophe.niche === a.niche)) {
      var nm = report.catastrophe.name;
      cat = { name: nm, kind: /lodow|ordowick/i.test(nm) ? 'ice' : (/permsk/i.test(nm) ? 'volcano' : 'meteor') };
    }
    return {
      lineageId: a.id, popBefore: lr.popBefore, popAfter: lr.popAfter,
      births: lr.births, predationDeaths: lr.predationDeaths, starvationDeaths: lr.starvationDeaths, catDeaths: lr.catDeaths,
      mutation: mut, catastrophe: cat,
      labels: {
        feed: T('turn.feed'), feedSub: T('turn.feedSub', { energy: (lr.energy >= 0 ? '+' : '') + lr.energy }),
        predation: T('turn.predation'), starvation: T('turn.starvation'), births: T('turn.births'),
        mutationGood: T('turn.mutationGood'), mutationBad: T('turn.mutationBad'), skip: T('turn.skip')
      }
    };
  }
  function renderAll() {
    renderStatus(); renderTimeline(); renderEraInfo(); renderLineageBar();
    renderActiveLineage(); renderTactics(); renderForecast(); renderEnv(); renderDiorama(); renderTraits(); updateUndoButton();
    el.btnSimulate.disabled = (state.status !== 'playing');
  }

  // ===================== Raport tury =====================
  function showReport(report) {
    // Baner zmiany ery.
    if (report.eraChanged) {
      el.reportEra.hidden = false;
      el.reportEra.innerHTML = ico('ui:ammonite', '🏛️') + ' Nowa era: <strong>' + report.newEraName + '</strong><br>' +
        '<span class="report-era-milestone">' + eraMilestone(report.newEraName) + '</span>';
    } else el.reportEra.hidden = true;

    el.reportEvent.hidden = true;
    if (report.choice) {
      var ch = report.choice, cev = Engine.choiceEvent(DATA, ch.eventId);
      var chHtml = (cev ? ico(cev.art, cev.icon) : '') + ' ' + escapeHtml(ch.name) + ' (' + escapeHtml(ch.lineageName) +
        '): wybrano „' + escapeHtml(ch.option) + '”' + (ch.colonyName ? ' — powstała linia „' + escapeHtml(ch.colonyName) + '”' : '') + '.';
      if (ch.outcome) {
        chHtml += '<div class="choice-outcome ' + (ch.outcome.win ? 'win' : 'lose') + '">' +
          (ch.outcome.win ? ico('ui:check', '✓') + ' Udało się' : ico('ui:close', '✗') + ' Nie udało się') +
          ' <span class="choice-outcome-chance">(szansa ' + ch.outcome.chance + '%)</span>: ' + escapeHtml(ch.outcome.text) + '</div>';
      }
      el.reportEvent.hidden = false;
      el.reportEvent.innerHTML = chHtml;
    }

    el.reportBody.innerHTML = '';
    var multi = report.lineReports.length > 1;
    report.lineReports.forEach(function (lr) {
      var block = document.createElement('div'); block.className = 'report-lineage';
      if (multi) {
        var head = document.createElement('div'); head.className = 'report-lineage-head';
        head.innerHTML = (lr.alive ? nicheIcon(lr.niche) + ' ' : ico('ui:bone', '🦴') + ' ') + escapeHtml(lr.name);
        block.appendChild(head);
      }
      lr.events.forEach(function (txt) {
        var d = document.createElement('div'); d.className = 'report-event';
        if (/Katastrofa/.test(txt)) d.className += ' danger';
        d.textContent = txt; block.appendChild(d);
      });
      // Kolejność jak w animacji tury: drapieżniki → głód → narodziny → katastrofa.
      block.appendChild(line('Populacja', lr.popBefore + ' → ' + lr.popAfter, lr.popAfter >= lr.popBefore ? 'pos' : 'neg', 'ui:paw'));
      if (lr.predationDeaths > 0) block.appendChild(line('Straty od drapieżników', '-' + lr.predationDeaths, 'neg', 'know:predation'));
      if (lr.starvationDeaths > 0) block.appendChild(line('Straty z głodu', '-' + lr.starvationDeaths, 'neg', 'know:starvation'));
      if (lr.births > 0) block.appendChild(line('Narodziny', '+' + lr.births, 'pos', 'ui:sprout'));
      if (lr.diseaseDeaths > 0) block.appendChild(line('Straty z choroby', '-' + lr.diseaseDeaths, 'neg'));
      if (lr.crowdDeaths > 0) block.appendChild(line('Straty z przegęszczenia', '-' + lr.crowdDeaths, 'neg'));
      if (lr.capacity) block.appendChild(line('Pojemność niszy (zajęta / całkowita)', lr.nicheLoad + ' / ' + lr.capacity,
        lr.nicheLoad >= lr.capacity * DATA.CAPACITY.warnAt ? 'neg' : 'plain'));
      if (lr.catDeaths > 0) block.appendChild(line('Straty w katastrofie', '-' + lr.catDeaths, 'neg', 'ui:meteor'));
      if (lr.reservesBefore != null) {
        block.appendChild(line(ENERGY + ' Rezerwy energii', num(lr.reservesBefore) + ' → ' + num(lr.reservesAfter),
          lr.reservesAfter >= lr.reservesBefore ? 'pos' : 'neg'));
        block.appendChild(line(GENE + ' Zmienność genetyczna', String(lr.variationAfter), 'plain'));
      }
      block.appendChild(line('Inteligencja', lr.intelligence + ' / ' + report.intelligenceGoal, 'plain', 'trait:brain'));
      // Rozbicie EP tej linii (skąd punkty).
      if (lr.epGain > 0) {
        var ep = document.createElement('div'); ep.className = 'report-epbreak';
        ep.innerHTML = '<span>Premia za niszę: <strong>+' + lr.epBreakdown.niche + ' EP</strong></span>';
        block.appendChild(ep);
      }
      el.reportBody.appendChild(block);
    });
    var sum = document.createElement('div'); sum.className = 'report-summary';
    sum.appendChild(line('Łączna populacja', report.totalPopulation, 'plain'));
    if (report.epPopulation) sum.appendChild(line('EP za liczebność (wszystkie linie)', '+' + report.epPopulation, 'pos'));
    if (report.epGrowth) sum.appendChild(line('EP za wzrost populacji', '+' + report.epGrowth, 'pos'));
    if (report.epBase) sum.appendChild(line('Premia bazowa za przetrwanie', '+' + report.epBase, 'pos'));
    if (report.epIntel) sum.appendChild(line('Premia za inteligencję (najlepsza linia)', '+' + report.epIntel, 'pos'));
    if (report.epRadiation) sum.appendChild(line('Premia za różnorodność nisz (radiacja)', '+' + report.epRadiation, 'pos'));
    (report.goals || []).forEach(function (g) {
      sum.appendChild(line((g.status === 'done' ? ico('ui:check', '✓') + ' Cel ery: ' : ico('ui:close', '✗') + ' Cel ery nieosiągnięty: ') + escapeHtml(g.label),
        g.status === 'done' ? '+' + g.reward : '—', g.status === 'done' ? 'pos' : 'neg'));
    });
    sum.appendChild(line('Zdobyte punkty ewolucji (razem)', '+' + report.epGain, 'pos'));
    // Koewolucja — tylko gdy presja drapieżników wyraźnie się zmieniła (bez powtarzania co turę).
    var pd = report.predatorDelta || 0;
    if (report.predatorLevel > 2 && Math.abs(pd) >= 0.3) {
      sum.appendChild(line('Presja drapieżników (koewolucja)', (pd > 0 ? '↑ ' : '↓ ') + num(report.predatorLevel) +
        ' (' + (pd > 0 ? '+' : '') + num(pd) + ')', pd > 0 ? 'neg' : 'pos'));
    }
    el.reportBody.appendChild(sum);
    if (report.threat && state.status === 'playing') {
      var th = document.createElement('div'); th.className = 'report-threat'; th.innerHTML = threatHtml(report.threat);
      el.reportBody.appendChild(th);
    }

    // Nowe pojęcia — pełne karty; znane — tylko zwinięte przypomnienie.
    el.reportKnowledge.innerHTML = '';
    var fresh = report.newKnowledge || report.knowledge;
    fresh.forEach(function (key) {
      var k = DATA.KNOWLEDGE[key]; if (!k) return;
      var card = knowledgeCard(key, k); card.classList.add('is-new');
      el.reportKnowledge.appendChild(card);
    });
    var known = report.knowledge.filter(function (key) { return fresh.indexOf(key) === -1 && DATA.KNOWLEDGE[key]; });
    if (known.length) {
      var det = document.createElement('details'); det.className = 'knowledge-recall';
      det.innerHTML = '<summary>Przypomnij pojęcia z tej tury: ' + known.map(function (key) { return escapeHtml(DATA.KNOWLEDGE[key].title); }).join(', ') + '</summary>';
      known.forEach(function (key) { det.appendChild(knowledgeCard(key, DATA.KNOWLEDGE[key])); });
      el.reportKnowledge.appendChild(det);
    }

    el.btnReportClose.textContent = (state.status === 'playing') ? T('report.next') : T('report.summary');
    openModal(el.modalReport);
  }
  function knowledgeCard(key, k) {
    var card = document.createElement('div'); card.className = 'knowledge-card';
    card.innerHTML = (ART ? (ico('know:' + key, '') || '<span class="ico" aria-hidden="true">' + (k.icon || '💡') + '</span>') : '') +
      '<h4>' + (ART ? '' : (k.icon || '💡') + ' ') + k.title + '</h4><p>' + k.body + '</p>' +
      (k.fossil ? '<p class="knowledge-fossil">' + ico('ui:fossil', '🦴') + ' ' + T('codex.fossil') + k.fossil + '</p>' : '');
    return card;
  }
  function eraMilestone(name) {
    var e = DATA.ERAS.filter(function (x) { return x.name === name; })[0];
    return e ? e.milestone : '';
  }
  function line(label, value, tone, icon) {
    var d = document.createElement('div'); d.className = 'report-line';
    var cls = tone === 'pos' ? 'num pos' : (tone === 'neg' ? 'num neg' : 'num');
    d.innerHTML = '<span class="report-label">' + (icon ? ico(icon, '') + ' ' : '') + label + '</span><span class="' + cls + '">' + value + '</span>';
    return d;
  }
  function onReportClose() {
    closeModal(el.modalReport);
    if (state.status !== 'playing') { showEnd(); return; }
    maybeShowOutlook();
  }
  // Uczciwy sygnał: gdy zwycięstwo jest już niemożliwe, gra mówi to od razu (raz na partię).
  function maybeShowOutlook() {
    if (state.outlookSeen) return;
    var o = Engine.victoryOutlook(DATA, state);
    if (o.possible) return;
    el.outlookReasons.innerHTML = o.reasons.map(function (r) { return '<li>' + escapeHtml(r) + '</li>'; }).join('');
    el.btnOutlookUndo.hidden = !undoStack.length;
    openModal(el.modalOutlook);
  }
  function onOutlookContinue() { state.outlookSeen = true; save(); closeModal(el.modalOutlook); renderStatus(); }
  function onOutlookUndo() { closeModal(el.modalOutlook); onUndo(); }
  function onOutlookEnd() {
    closeModal(el.modalOutlook);
    state = Engine.concede(DATA, state); renderAll(); showEnd();
  }

  // ===================== Drzewo życia =====================
  function showTree() {
    el.treeContainer.innerHTML = buildTreeSvg();
    Array.prototype.forEach.call(el.treeContainer.querySelectorAll('[data-lineage]'), function (n) {
      var id = n.getAttribute('data-lineage'); var lin = Engine.getLineage(state, id);
      if (lin && lin.alive) {
        n.style.cursor = 'pointer';
        n.addEventListener('click', function () { onSelectLineage(id); closeModal(el.modalTree); });
        n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectLineage(id); closeModal(el.modalTree); } });
      }
    });
    openModal(el.modalTree);
  }
  var treeZoom = 1;
  var TREE_ZOOMS = [0.75, 1, 1.5, 2];
  function setTreeZoom(dir) {
    var i = TREE_ZOOMS.indexOf(treeZoom);
    treeZoom = TREE_ZOOMS[Math.max(0, Math.min(TREE_ZOOMS.length - 1, i + dir))];
    var svg = el.treeContainer.querySelector('svg');
    if (svg) svg.style.width = (treeZoom * 100) + '%';
  }
  // Drzewo filogenetyczne: gałęzie (grubość ∝ szczytowej populacji) rysują się
  // po otwarciu; na końcu każdej gałęzi miniatura zwierzęcia w obecnej postaci.
  function buildTreeSvg() {
    var lineages = state.lineages, rowH = 70, topPad = 40, leftPad = 18, rightPad = 230, innerW = 620;
    var maxT = TOTAL_T;
    var nowT = Math.min(maxT, Engine.elapsedTurns(DATA, state));
    var rows = {}, order = [], childrenOf = {}, depthOf = {};
    lineages.forEach(function (l) { var p = l.parentId || '__root'; (childrenOf[p] = childrenOf[p] || []).push(l); });
    function bornGT(l) { return Engine.globalTurn(DATA, l.bornEra, l.bornTurn); }
    function dfs(l, depth) { rows[l.id] = order.length; depthOf[l.id] = depth; order.push(l); (childrenOf[l.id] || []).forEach(function (c) { dfs(c, depth + 1); }); }
    (childrenOf['__root'] || []).forEach(function (l) { dfs(l, 0); });

    var height = topPad + order.length * rowH + 16;
    var W = leftPad + innerW + rightPad;
    var T0 = gameStartT();
    var xOf = function (t) { return leftPad + ((t - T0) / Math.max(1, maxT - T0)) * innerW; };
    var yOf = function (id) { return topPad + rows[id] * rowH + rowH / 2; };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + height + '" style="width:' + (treeZoom * 100) + '%" role="img" aria-label="Drzewo życia: ' +
      order.length + ' linii rozwojowych">';
    // pasma er
    eraBounds().forEach(function (b, i) {
      var x0 = xOf(b.start), x1 = xOf(b.end);
      svg += '<rect x="' + x0 + '" y="' + (topPad - 16) + '" width="' + (x1 - x0) + '" height="' + (height - topPad + 6) + '" class="tree-era tree-era-' + i + '"/>';
      svg += '<text x="' + (x0 + 6) + '" y="' + (topPad - 22) + '" class="tree-era-name">' + escapeHtml(b.name) + '</text>';
    });
    catastropheTurns().forEach(function (c) {
      var x = xOf(c.x);
      svg += '<g class="tree-cat"><title>' + escapeHtml(c.name) + '</title><line x1="' + x + '" x2="' + x + '" y1="' + (topPad - 16) + '" y2="' + (height - 10) + '"/>' +
        '<path d="M' + (x - 4) + ' ' + (topPad - 16) + 'l4 6 4-6z"/></g>';
    });
    // „teraz”
    svg += '<line x1="' + xOf(nowT) + '" x2="' + xOf(nowT) + '" y1="' + (topPad - 16) + '" y2="' + (height - 10) + '" class="tree-now"/>';

    var defs = '<defs>';
    order.forEach(function (l) {
      var y = yOf(l.id), xStart = xOf(bornGT(l));
      var endGT = (l.extinctGlobalTurn != null) ? l.extinctGlobalTurn : nowT;
      var xEnd = Math.max(xOf(endGT), xStart + 30);
      var isActive = (l.id === state.activeLineageId);
      var w = (2 + 3.2 * Math.log(1 + (l.peakPopulation || l.population)) / Math.LN10 / 2.5).toFixed(1);
      var delay = (depthOf[l.id] * 0.35).toFixed(2) + 's';
      var cls = 'tree-branch' + (l.alive ? '' : ' extinct') + (isActive ? ' active' : '');
      var dPath = l.parentId
        ? 'M' + xStart + ' ' + yOf(l.parentId) + ' C' + (xStart + 14) + ' ' + yOf(l.parentId) + ' ' + (xStart + 4) + ' ' + y + ' ' + (xStart + 26) + ' ' + y + ' L' + (xEnd - 24) + ' ' + y
        : 'M' + xStart + ' ' + y + ' L' + (xEnd - 24) + ' ' + y;
      // Żywe gałęzie „rosną” (pathLength=1 + animacja kreski); wymarłe są przerywane, bez animacji.
      svg += '<path d="' + dPath + '"' + (l.alive ? ' pathLength="1"' : '') + ' class="' + cls + '" stroke-width="' + w + '" style="animation-delay:' + delay + '"/>';
      // węzeł: miniatura w okrągłej ramce
      var thumb = (ART && ART.creature) ? ART.creature.thumb(l, 64, 44) : '';
      defs += '<clipPath id="tclip-' + l.id + '"><circle cx="' + xEnd + '" cy="' + y + '" r="22"/></clipPath>';
      svg += '<g data-lineage="' + l.id + '" class="tree-node' + (l.alive ? '' : ' extinct') + (isActive ? ' active' : '') + '" style="animation-delay:' + delay + '" tabindex="' + (l.alive ? '0' : '-1') + '">' +
        (isActive ? '<circle cx="' + xEnd + '" cy="' + y + '" r="27" class="tree-ring"/>' : '') +
        '<circle cx="' + xEnd + '" cy="' + y + '" r="23" class="tree-frame"/>' +
        (thumb ? '<image href="' + thumb + '" x="' + (xEnd - 32) + '" y="' + (y - 22) + '" width="64" height="44" clip-path="url(#tclip-' + l.id + ')" class="tree-thumb"/>' : '') +
        '<text x="' + (xEnd + 32) + '" y="' + (y - 3) + '" class="tree-name">' + escapeHtml(l.name) + (l.alive ? '' : ' †') + '</text>' +
        '<text x="' + (xEnd + 32) + '" y="' + (y + 13) + '" class="tree-sub">' +
        (l.alive ? escapeHtml(nicheLabel(l.niche)) + ' · ' + l.population + ' osobn. · cech: ' + l.traits.length
          : 'wymarła (tura ' + l.extinctGlobalTurn + ')') + '</text></g>';
    });
    defs += '</defs>';
    return svg.replace('>', '>' + defs) + '</svg>';
  }

  // ===================== Ekran końcowy =====================
  function showEnd() {
    clearSave();
    var s = state.status;
    el.endEmblem.dataset.status = s;
    el.endEmblem.innerHTML = s === 'won' ? ico('ui:bulb', '🧠') : (s === 'survived' ? ico('ui:paw', '🐾') : ico('ui:bone', '🦴'));
    el.endTitle.textContent = s === 'won' ? 'Narodziny inteligencji!' :
      (s === 'survived' ? (Engine.playedEras(DATA, state).length > 1 ? 'Gatunek przetrwał wszystkie ery' : 'Gatunek przetrwał erę')
        : (state.endReason === 'nonviable' ? 'Populacja nie przetrwała' : 'Wszystkie linie wygasły'));
    el.endSummary.textContent =
      s === 'won'
        ? (state.winPath === 'sound'
          ? 'Jedna z Twoich linii osiągnęła próg inteligencji i stworzyła kulturę akustyczną — jak delfiny i walenie: imiona, pieśni i tradycje przekazywane przez naukę. Rozum nie potrzebuje rąk.'
          : 'Jedna z Twoich linii osiągnęła próg inteligencji i zaczęła używać narzędzi — na horyzoncie kultura i technologia. Efekt konsekwentnego rozwoju układu nerwowego mimo katastrof i presji środowiska.')
        : s === 'survived' && Engine.goalBlockedByPopulation(state, DATA)
        ? 'Twoja linia osiągnęła próg inteligencji i ma kulturę, ale jest zbyt nieliczna (poniżej ' + DATA.WIN_MIN_POP + ' osobników), by dać początek kulturze. Rozum to za mało — potrzebny jest też żywotny gatunek.'
        : s === 'survived'
        ? 'Twoje linie przetrwały ' + eraList(Engine.playedEras(DATA, state)) + ', ale żadna nie rozwinęła dostatecznie mózgu. Dobre przetrwanie to nie to samo co droga do rozumności — spróbuj skupić się na ścieżce oznaczonej gwiazdką.'
        : state.endReason === 'nonviable'
        ? 'Na koniec gry żadna linia nie liczyła choćby ' + DATA.MIN_VIABLE_POP + ' osobników. Tak mała populacja jest skazana na wymarcie (słaby rozród, chów wsobny) — dbaj o bilans energii i liczebność, nie tylko o cechy.'
        : 'Wszystkie linie rozwojowe wymarły. W ewolucji większość linii wymiera — dywersyfikuj (specjacja, różne nisze) i lepiej dostosuj adaptacje do nadchodzących katastrof.';
    el.endStats.innerHTML = '';
    endStat('Status', s === 'won' ? 'Zwycięstwo' : (s === 'survived' ? 'Przetrwanie' : 'Wymarcie'));
    endStat('Liczba linii rozwojowych', state.lineages.length);
    endStat('Szczytowa łączna populacja', state.lineages.reduce(function (a, l) { return a + l.peakPopulation; }, 0));
    endStat('Najwyższa inteligencja', Engine.maxIntelligence(state) + ' / ' + state.intelligenceGoal);
    endStat('Odkryte pojęcia w Kodeksie', state.unlockedKnowledge.length);
    var goalsAll = state.eraGoals || [];
    if (goalsAll.length) endStat('Cele er', goalsAll.filter(function (g) { return g.status === 'done'; }).length + ' / ' + goalsAll.length);
    if (state.seed) endStat('Kod świata', escapeHtml(state.seed));
    renderEndScore();
    showScreen('end');
    renderEndStory(s);
  }
  // Wynik punktowy, rekord scenariusza i osiągnięcia (zapisywane między partiami).
  var ACH_KEY = 'ewolucja.achievements', BEST_KEY = 'ewolucja.best';
  function readJson(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch (e) { return def; } }
  function writeJson(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function renderEndScore() {
    var sc = Engine.scoreGame(DATA, state), bestKey = state.scenario + '/' + state.difficulty;
    var best = readJson(BEST_KEY, {}), prevBest = best[bestKey] || 0, record = sc.total > prevBest;
    if (record && !state.scoreSaved) { best[bestKey] = sc.total; writeJson(BEST_KEY, best); }
    el.endScoreTotal.innerHTML = '<strong>' + sc.total + '</strong> pkt' +
      (sc.mult !== 1 ? ' <span class="end-score-mult">(' + sc.subtotal + ' × ' + num(sc.mult) + ' za poziom)</span>' : '') +
      (record && prevBest > 0 ? ' <span class="end-score-record">Nowy rekord!</span>'
        : (prevBest > 0 ? ' <span class="end-score-best">Rekord: ' + prevBest + '</span>'
          : ' <span class="end-score-best">Pierwszy wynik w tym scenariuszu</span>'));
    el.endScoreParts.innerHTML = sc.parts.map(function (p) {
      return '<li><span>' + escapeHtml(p.label) + '</span><strong>+' + p.points + '</strong></li>';
    }).join('');
    var earned = Engine.earnedAchievements(DATA, state), owned = readJson(ACH_KEY, []);
    var fresh = earned.filter(function (id) { return owned.indexOf(id) === -1; });
    if (!state.scoreSaved) { writeJson(ACH_KEY, owned.concat(fresh)); state.scoreSaved = true; }
    var all = readJson(ACH_KEY, []);
    el.endAch.innerHTML = DATA.ACHIEVEMENTS.map(function (a) {
      var got = earned.indexOf(a.id) !== -1, ever = all.indexOf(a.id) !== -1;
      return '<li class="ach ' + (got ? 'got' : (ever ? 'ever' : 'locked')) + '" title="' + escapeHtml(a.desc) + '">' +
        '<span class="ach-icon" aria-hidden="true">' + a.icon + '</span><span class="ach-text"><strong>' + escapeHtml(a.label) + '</strong>' +
        '<small>' + escapeHtml(a.desc) + '</small></span>' +
        (got && fresh.indexOf(a.id) !== -1 ? '<em class="ach-new">nowe!</em>' : (got ? '<em class="ach-got">w tej partii</em>' : '')) + '</li>';
    }).join('');
  }
  // Bohater podsumowania: linia, która doszła najdalej (inteligencja, potem liczebność).
  function featuredLineage(s) {
    var ls = state.lineages.slice();
    if (s === 'won') ls.sort(function (a, b) { return b.stats.intelligence - a.stats.intelligence; });
    else ls.sort(function (a, b) { return (b.alive - a.alive) || (b.peakPopulation - a.peakPopulation); });
    return ls[0];
  }
  function renderEndStory(s) {
    var l = featuredLineage(s);
    if (!l) return;
    if (ART && ART.portrait) {
      el.endFigure.hidden = false;
      ART.portrait.update(el.endPortrait, l, { traitNames: TRAIT_NAMES });
      el.endCaption.textContent = 'Ryc. ' + l.name + (l.alive ? '' : ' †') + ' — nisza: ' + nicheLabel(l.niche).toLowerCase() +
        ', cech: ' + l.traits.length + ', inteligencja ' + l.stats.intelligence;
    } else el.endFigure.hidden = true;
    // Droga ewolucji: kolejne stadia wg kolejności zdobywania cech.
    el.endPath.innerHTML = '';
    // Punkt wyjścia: cechy startowe scenariusza (dostane „na start”, nie wyewoluowane w grze).
    var sc = DATA.SCENARIOS.filter(function (x) { return x.id === state.scenario; })[0];
    var k0 = Math.min(l.traits.length, (sc && sc.startTraits) ? sc.startTraits.length : 0);
    var n = l.traits.length, marks = [];
    for (var j = 0; j <= 5; j++) { var k = k0 + Math.round(j * (n - k0) / 5); if (marks.indexOf(k) === -1) marks.push(k); }
    if (!ART || !ART.creature || n - k0 === 0) { el.endPathBox.hidden = true; }
    else {
      el.endPathBox.hidden = false;
      marks.forEach(function (k, i) {
        var prev = i ? marks[i - 1] : 0;
        var added = l.traits.slice(prev, k).map(traitName);
        var label = i === 0 ? (k0 ? 'Na starcie' : 'Początek') : added.slice(0, 2).join(', ') + (added.length > 2 ? ' +' + (added.length - 2) : '');
        var src = ART.creature.thumb({ id: l.id, name: l.name, traits: l.traits.slice(0, k), niche: i === marks.length - 1 ? l.niche : 'woda' }, 110, 70);
        var li = document.createElement('li');
        li.innerHTML = '<img alt="" src="' + src + '"><span>' + escapeHtml(label) + '</span>';
        el.endPath.appendChild(li);
      });
    }
    renderPopChart(el.endChart, l, 120);
  }
  // „paleozoik, mezozoik i kenozoik” — nazwy er małą literą, jak w zdaniu.
  function eraList(eras) {
    var names = eras.map(function (e) { return e.name.toLowerCase(); });
    if (names.length <= 1) return names.join('');
    return names.slice(0, -1).join(', ') + ' i ' + names[names.length - 1];
  }
  function endStat(label, value) {
    var li = document.createElement('li'); li.innerHTML = '<span>' + label + '</span><strong>' + value + '</strong>';
    el.endStats.appendChild(li);
  }

  // ===================== Eksport podsumowania =====================
  function buildSummaryText() {
    if (!state) return '';
    var statusPl = state.status === 'won' ? 'Zwycięstwo (osiągnięto inteligencję)' :
      (state.status === 'survived' ? 'Przetrwanie (bez rozumności)' : 'Wymarcie');
    var sc = DATA.SCENARIOS.filter(function (x) { return x.id === state.scenario; })[0];
    var diff = DATA.DIFFICULTIES[state.difficulty];
    var L = ['EWOLUCJA — podsumowanie gry', '============================',
      'Scenariusz: ' + (sc ? sc.name : state.scenario) + ' (trudność: ' + (diff ? diff.label : state.difficulty) + ')',
      'Wynik: ' + statusPl,
      'Kod świata: ' + (state.seed || '—'),
      'Punkty: ' + Engine.scoreGame(DATA, state).total,
      'Cele er: ' + (state.eraGoals || []).map(function (g) { var d = Engine.goalDef(DATA, g.id); return (d ? d.label : g.id) + ' (' + (g.status === 'done' ? 'spełniony' : g.status === 'failed' ? 'nie' : 'otwarty') + ')'; }).join('; '),
      'Osiągnięcia: ' + (Engine.earnedAchievements(DATA, state).map(function (id) { var a = DATA.ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0]; return a ? a.label : id; }).join(', ') || 'brak'),
      'Najwyższa inteligencja: ' + Engine.maxIntelligence(state) + ' / ' + state.intelligenceGoal,
      'Liczba linii rozwojowych: ' + state.lineages.length,
      'Szczytowa łączna populacja: ' + state.lineages.reduce(function (a, l) { return a + l.peakPopulation; }, 0),
      'Odkryte pojęcia w Kodeksie: ' + state.unlockedKnowledge.length, '', 'Linie rozwojowe:'];
    state.lineages.forEach(function (l) {
      L.push('  • ' + l.name + ' — ' + (l.alive ? 'żywa' : 'wymarła') +
        ', nisza: ' + DATA.NICHES[l.niche].label +
        ', inteligencja: ' + l.stats.intelligence +
        ', strategia: ' + (DATA.STRATEGIES[l.strategy] || DATA.STRATEGIES.zrownowazona).label +
        ', rezerwy: ' + num(l.reserves || 0) + ' ⚡, zmienność: ' + (l.variation || 0) + ' 🧬' +
        ', cechy: ' + (l.traits.length ? l.traits.map(traitName).join(', ') : 'brak'));
    });
    L.push('', 'Odkryte pojęcia: ' + state.unlockedKnowledge.map(function (k) {
      return DATA.KNOWLEDGE[k] ? DATA.KNOWLEDGE[k].title : k;
    }).join('; '));
    return L.join('\n');
  }
  function traitName(id) { var t = DATA.TRAITS.filter(function (x) { return x.id === id; })[0]; return t ? t.name : id; }

  function showSummary() {
    el.summaryText.value = buildSummaryText();
    openModal(el.modalSummary);
  }
  function copySummary() {
    el.summaryText.select();
    var okMsg = 'Skopiowano ✓';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(el.summaryText.value).then(function () { flashBtn(el.btnSummaryCopy, okMsg); },
          function () { legacyCopy(); });
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
    var unlocked = (state ? state.unlockedKnowledge : ['intro']), any = false;
    Object.keys(DATA.KNOWLEDGE).forEach(function (key) {
      if (unlocked.indexOf(key) === -1) return; any = true;
      var k = DATA.KNOWLEDGE[key];
      el.codexBody.appendChild(knowledgeCard(key, k));
    });
    if (!any) el.codexBody.innerHTML = '<p class="codex-empty">Kodeks jest jeszcze pusty — graj, aby odkrywać pojęcia.</p>';
    openModal(el.modalCodex);
  }

  // ===================== Ustawienia grafiki =====================
  function showSettings() {
    var s = ART.settings.get();
    Array.prototype.forEach.call(el.modalSettings.querySelectorAll('input[type=radio]'), function (inp) {
      inp.checked = (s[inp.name] === inp.value);
    });
    updateSettingsNote();
    openModal(el.modalSettings);
    var sel = el.modalSettings.querySelector('input:checked'); if (sel) sel.focus();
  }
  function updateSettingsNote() {
    var r = ART.settings.renderer();
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.settingsNote.textContent =
      (r ? 'Diorama rysowana przez: ' + (r === 'webgl' ? 'WebGL (karta graficzna)' : 'Canvas (procesor)') + '. ' : 'Diorama jest wyłączona albo niedostępna. ') +
      (reduced ? 'System ma włączone „ograniczanie ruchu” — animacje są zatrzymane niezależnie od tych ustawień.' : '');
  }
  function onSettingChange(e) {
    var patch = {}; patch[e.target.name] = e.target.value;
    ART.settings.set(patch);
    setTimeout(updateSettingsNote, 600);
  }

  // ===================== Samouczek =====================
  // Kroki budowane dla bieżącej gry — cel i liczba er zależą od scenariusza i trudności.
  function buildTutorialSteps() {
    var eras = Engine.playedEras(DATA, state);
    var span = eras.length === 1 ? 'w erze ' + eras[0].name.toLowerCase().replace(/k$/, 'ku')
      : 'w ciągu ' + (eras.length === 2 ? 'dwóch' : 'trzech') + ' er (' + eraList(eras) + ')';
    return [
    { title: 'Witaj w Ewolucji!', text: 'Prowadzisz nie pojedyncze zwierzę, lecz całą populację. Twój cel: doprowadzić którąkolwiek linię do inteligencji ' + state.intelligenceGoal + ' i kultury (narzędzia na lądzie albo kultura akustyczna w wodzie) ' + span + ', utrzymując żywotną populację (co najmniej ' + DATA.WIN_MIN_POP + ' osobników).' },
    { title: 'Punkty ewolucji (EP)', text: 'Za przetrwanie i rozwój zdobywasz EP (u góry po lewej). Wydajesz je na trwałe cechy w panelu „Adaptacje” po prawej. Każda cecha ma koszt i kompromis.' },
    { title: 'Prognoza i kompromisy', text: 'Panel „Prognoza następnej tury” pokazuje, jak zmieni się populacja. Najedź na cechę, aby zobaczyć jej wpływ przed zakupem (co-jeśli).' },
    { title: 'Droga do celu', text: 'Cechy oznaczone {star} prowadzą do inteligencji: Zwoje → Mózg → Rozbudowany mózg → życie społeczne → kultura. Są dwie drogi: narzędzia (ręka chwytna; ląd lub brzeg) albo kultura akustyczna (echolokacja; woda lub brzeg). Wygrywasz, gdy linia osiągnie próg inteligencji i kulturę (kenozoik), licząc co najmniej ' + DATA.WIN_MIN_POP + ' osobników. Uważaj: duży mózg zużywa dużo energii — kupiony za wcześnie może zagłodzić populację.' },
    { title: 'Rezerwy i zmienność', text: 'Każda linia ma dwie własne waluty. ⚡ Rezerwy energii to odłożone nadwyżki pokarmu — ratują przed głodem, płacisz nimi za migrację i zachowania w turze. 🧬 Zmienność genetyczna rośnie z liczebnością i znika w wąskim gardle — płacisz nią za specjację i ukierunkowany dobór, a wysoka łagodzi katastrofy.' },
    { title: 'Decyzje linii', text: 'W panelu „Decyzje linii” wybierasz strategię rozrodu (r — dużo potomstwa, K — mało, ale dobrze chronionego) i zachowanie w najbliższej turze. Najedź na przycisk, by zobaczyć skutek w prognozie. Czasem pojawi się karta decyzji — zdarzenie, na które odpowiadasz przed turą.' },
    { title: 'Specjacja i nisze', text: 'Możesz rozdzielić linię (Specjacja, płatna zmiennością 🧬) i wysłać gałąź do innej niszy: {woda} woda, {przybrzeze} przybrzeże, {lad} ląd (wymaga kończyn), {powietrze} powietrze (wymaga lotu). Każda nisza wyżywi ograniczoną liczbę osobników (pojemność) — gdy jest pełna, nowa gałąź w wolnej niszy daje nowe zasoby, a linie w jednej niszy konkurują. Wymierania {meteor} uderzają w nisze różnie, więc linie w kilku niszach rozkładają ryzyko. Migracja kosztuje rezerwy ⚡ i turę aklimatyzacji.' }
    ];
  }
  var tutorialSteps = [];
  var tutorialIdx = 0;
  function maybeStartTutorial() {
    var done; try { done = localStorage.getItem(TUTORIAL_KEY); } catch (e) { done = null; }
    if (done) return;
    tutorialSteps = buildTutorialSteps(); tutorialIdx = 0; showTutorialStep(); el.tutorial.hidden = false;
  }
  function showTutorialStep() {
    var s = tutorialSteps[tutorialIdx];
    el.tutorialTitle.textContent = s.title;
    el.tutorialText.innerHTML = tutorialTokens(escapeHtml(s.text));
    el.tutorialProgress.textContent = (tutorialIdx + 1) + ' / ' + tutorialSteps.length;
    el.btnTutorialNext.textContent = (tutorialIdx === tutorialSteps.length - 1) ? T('tutorial.done') : T('tutorial.next');
  }
  // Żetony {star}, {meteor}, {woda}… w tekstach samouczka → ikony (albo emoji).
  function tutorialTokens(html) {
    var map = { star: ico('ui:star', '⭐', 'ico-star'), meteor: ico('ui:meteor', '☄️', 'ico-danger') };
    Object.keys(DATA.NICHES).forEach(function (n) { map[n] = nicheIcon(n); });
    return html.replace(/\{(\w+)\}/g, function (m, k) { return map[k] || m; });
  }
  function tutorialNext() {
    if (tutorialIdx < tutorialSteps.length - 1) { tutorialIdx++; showTutorialStep(); }
    else endTutorial();
  }
  function endTutorial() {
    el.tutorial.hidden = true;
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {}
  }

  // ===================== Modale =====================
  var lastFocused = null;
  function openModal(m) { lastFocused = document.activeElement; m.hidden = false; var f = m.querySelector('button, input'); if (f) f.focus(); }
  function closeModal(m) { m.hidden = true; if (lastFocused && lastFocused.focus) lastFocused.focus(); }
  function flash(msg) { var p = el.btnSimulate.textContent; el.btnSimulate.textContent = msg; setTimeout(function () { el.btnSimulate.textContent = p; }, 1500); }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var confirmCallback = null;
  function openConfirm(msg, cb) { el.confirmMessage.textContent = msg; confirmCallback = cb; openModal(el.modalConfirm); }
  function resolveConfirm(yes) { closeModal(el.modalConfirm); var cb = confirmCallback; confirmCallback = null; if (yes && cb) cb(); }

  // ===================== Inicjalizacja =====================
  function init() {
    window.GameI18n.applyStatic(document);
    initStickyStatus();
    el.introGoal.innerHTML = ico('ui:target', '🎯') + ' <strong>Cel:</strong> doprowadź którąkolwiek linię do progu inteligencji i kultury — narzędzi na lądzie albo kultury akustycznej w wodzie — ' +
      'utrzymując co najmniej ' + DATA.WIN_MIN_POP + ' osobników, przez ery (' + DATA.ERAS.map(function (e) { return e.name; }).join(', ') + '). ' +
      'Rozwijaj układ nerwowy (' + ico('ui:star', '⭐', 'ico-star') + '), rozkładaj ryzyko przez specjację i nisze, przetrwaj wymierania masowe. ' +
      'Wybierz scenariusz poniżej — różnią się trudnością i punktem startu.';

    renderScenarios();
    if (ART && ART.diorama && el.startDiorama) {
      ART.diorama.update(el.startDiorama, {
        era: 'paleozoik', niche: 'woda', climate: 'cieplo', food: 12, predators: 6,
        lineages: [{ id: 'start', name: 'Prazwierzę', traits: [], niche: 'woda', population: 160, active: true }]
      });
    } else if (el.startDiorama) el.startDiorama.hidden = true;
    // Enter w polu nazwy startuje domyślny scenariusz (pełna ewolucja).
    el.formStart.addEventListener('submit', function (e) {
      e.preventDefault();
      newGame((el.speciesInput.value || '').trim() || 'Prazwierzę', scenarioOpts(DATA.SCENARIOS[0]));
    });
    el.btnSimulate.addEventListener('click', onSimulate);
    el.btnOutlookContinue.addEventListener('click', onOutlookContinue);
    el.btnOutlookUndo.addEventListener('click', onOutlookUndo);
    el.btnOutlookEnd.addEventListener('click', onOutlookEnd);
    // Ten sam świat (kod, scenariusz, trudność) od nowa — np. by sprawdzić inną strategię.
    el.btnPlaySame.addEventListener('click', function () {
      if (!state) return;
      var sc = DATA.SCENARIOS.filter(function (x) { return x.id === state.scenario; })[0] || DATA.SCENARIOS[0];
      var o = scenarioOpts(sc); o.seed = state.seed; o.difficulty = state.difficulty;
      newGame(Engine.getLineage(state, 'L0').name, o);
    });
    el.btnUndo.addEventListener('click', onUndo);
    el.btnSpeciate.addEventListener('click', onSpeciate);
    el.selectionToggle.addEventListener('change', onToggleSelection);
    el.btnTree.addEventListener('click', showTree);
    el.btnReportClose.addEventListener('click', onReportClose);
    el.btnCodex.addEventListener('click', showCodex);
    el.btnCodexClose.addEventListener('click', function () { closeModal(el.modalCodex); });
    el.btnTreeClose.addEventListener('click', function () { closeModal(el.modalTree); });
    el.btnTreeZoomIn.addEventListener('click', function () { setTreeZoom(1); });
    if (ART && ART.settings) {
      el.btnSettings.addEventListener('click', showSettings);
      el.btnSettingsClose.addEventListener('click', function () { closeModal(el.modalSettings); });
      el.btnSettingsX.addEventListener('click', function () { closeModal(el.modalSettings); });
      el.modalSettings.addEventListener('change', onSettingChange);
    } else el.btnSettings.hidden = true;
    el.btnTreeZoomOut.addEventListener('click', function () { setTreeZoom(-1); });
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

    function doRestart() { clearSave(); state = null; undoStack = []; el.speciesInput.value = ''; showScreen('start'); }
    el.btnRestart.addEventListener('click', function () {
      if (state && state.status === 'playing') openConfirm('Rozpocząć nową grę? Bieżący postęp zostanie utracony.', doRestart);
      else doRestart();
    });
    el.btnPlayAgain.addEventListener('click', function () { state = null; undoStack = []; el.speciesInput.value = ''; el.worldSeed.value = ''; showScreen('start'); });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!el.modalCodex.hidden) closeModal(el.modalCodex);
      else if (!el.modalTree.hidden) closeModal(el.modalTree);
      else if (!el.modalSummary.hidden) closeModal(el.modalSummary);
      else if (!el.modalSpeciate.hidden) closeModal(el.modalSpeciate);
      else if (!el.modalConfirm.hidden) resolveConfirm(false);
      else if (!el.modalSettings.hidden) closeModal(el.modalSettings);
    });
    [el.modalCodex, el.modalTree, el.modalSpeciate, el.modalSummary, el.modalSettings].forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) closeModal(m); });
    });

    var saved = loadSaved();
    if (saved) { state = saved; showScreen('game'); renderAll(); }
    else showScreen('start');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
