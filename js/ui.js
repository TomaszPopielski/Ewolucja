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
  var Advisor = window.Advisor; // szacunek szansy na rozum (js/advisor.js)
  var SAVE_KEY = 'ewolucja.save.v4';
  var TUTORIAL_KEY = 'ewolucja.tutorialDone';
  // Dane trwałe między partiami (tylko w tej przeglądarce, bez kont i serwera).
  var ACH_KEY = 'ewolucja.achievements', BEST_KEY = 'ewolucja.best', CODEX_KEY = 'ewolucja.codex',
    MUSEUM_KEY = 'ewolucja.museum', DAILY_KEY = 'ewolucja.daily', UNLOCK_KEY = 'ewolucja.unlockAll', PREF_KEY = 'ewolucja.ui';
  var MUSEUM_MAX = 60;

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
    statusOutlook: $('status-outlook'), worldSeed: $('world-seed'), eraInfo: $('era-info'), envThreat: $('env-threat'), envRivals: $('env-rivals'), endEpilogue: $('end-epilogue'),
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
    strategyButtons: $('strategy-buttons'), dietButtons: $('diet-buttons'), behaviorButtons: $('behavior-buttons'),
    selectionSelect: $('selection-select'), selectionText: $('selection-text'),
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
    screenPrologue: $('screen-prologue'), prologueToggle: $('prologue-toggle'), prologueStep: $('prologue-step'),
    prologueWhen: $('prologue-when'), prologueDesc: $('prologue-desc'), prologueTitle: $('prologue-title'),
    prologueOptions: $('prologue-options'), prologuePath: $('prologue-path'), btnPrologueSkip: $('btn-prologue-skip'),
    screenAnthro: $('screen-anthropocene'), anthroStep: $('anthro-step'), anthroTitle: $('anthro-title'), anthroMeters: $('anthro-meters'),
    anthroDesc: $('anthro-desc'), anthroOptions: $('anthro-options'), endAnthro: $('end-anthro'),
    endEmblem: $('end-emblem'), endTitle: $('end-title'), endSummary: $('end-summary'),
    endStats: $('end-stats'), btnPlayAgain: $('btn-play-again'), btnOpenCodexEnd: $('btn-open-codex-end'),
    btnSummary: $('btn-summary'),
    modalSummary: $('modal-summary'), summaryText: $('summary-text'), btnSummaryClose: $('btn-summary-close'),
    btnSummaryCopy: $('btn-summary-copy'), btnSummaryDownload: $('btn-summary-download'),
    btnCodex: $('btn-codex'), btnRestart: $('btn-restart'),
    tutorial: $('tutorial'), tutorialProgress: $('tutorial-progress'),
    tutorialTitle: $('tutorial-title'), tutorialText: $('tutorial-text'),
    btnTutorialSkip: $('btn-tutorial-skip'), btnTutorialNext: $('btn-tutorial-next'),
    startHub: $('start-hub'), introGoalBox: $('intro-goal-box'), planOptions: $('plan-options'), modsOptions: $('mods-options'),
    btnUnlockAll: $('btn-unlock-all'), btnMuseum: $('btn-museum'), modalMuseum: $('modal-museum'), museumBody: $('museum-body'),
    btnMuseumClose: $('btn-museum-close'), chanceValue: $('chance-value'), chanceSub: $('chance-sub'), statusChance: $('status-chance'),
    contractOffer: $('contract-offer'), legacyPanel: $('legacy-panel'), variantCard: $('variant-card'), traitsToolbar: $('traits-toolbar'),
    actionInfo: $('action-info'), reportHeadline: $('report-headline'), codexProgress: $('codex-progress'), toasts: $('toasts'),
    endLatin: $('end-latin'), endTrial: $('end-trial'), endChronicle: $('end-chronicle'), endAchNext: $('end-ach-next'),
    endAchAll: $('end-ach-all'), endAchAllTitle: $('end-ach-all-title'), btnDownloadPlate: $('btn-download-plate'),
    btnOpenMuseumEnd: $('btn-open-museum-end'), outlookTitle: $('outlook-title'), outlookLead: $('outlook-lead'),
    outlookTail: $('outlook-tail'), outlookLegacy: $('outlook-legacy')
  };

  var STAT_META = [
    { key: 'feeding', label: 'Odżywianie' }, { key: 'defense', label: 'Obrona' },
    { key: 'reproduction', label: 'Rozród' }, { key: 'mobility', label: 'Mobilność' },
    { key: 'metabolism', label: 'Metabolizm' }, { key: 'intelligence', label: 'Inteligencja' }
  ];

  // ===================== Zapis / wczytanie =====================
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
    if (state && !isSandbox()) mergeCodex(state.unlockedKnowledge);
  }
  function readJson(key, def) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; } }
  function writeJson(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function isSandbox() { return !!(state && state.rules && state.rules.sandbox); }
  // Kodeks trwały: suma pojęć odkrytych we wszystkich partiach.
  function knownCodex() { return readJson(CODEX_KEY, []); }
  function mergeCodex(keys) {
    var have = knownCodex(), add = (keys || []).filter(function (k) { return have.indexOf(k) === -1; });
    if (add.length) writeJson(CODEX_KEY, have.concat(add));
  }
  function ownedAchievements() { return readJson(ACH_KEY, []); }
  function prefs() { return readJson(PREF_KEY, {}); }
  function setPref(k, v) { var p = prefs(); p[k] = v; writeJson(PREF_KEY, p); }
  // Odblokowania: `unlock` — liczba odznak albo { ach: [dowolna z odznak] } / { count: n }.
  function isUnlocked(unlock) {
    if (!unlock || readJson(UNLOCK_KEY, false)) return true;
    var owned = ownedAchievements();
    if (typeof unlock === 'number') return owned.length >= unlock;
    if (unlock.ach) return unlock.ach.some(function (a) { return owned.indexOf(a) !== -1; });
    if (unlock.count) return owned.length >= unlock.count;
    return true;
  }
  function unlockText(unlock) {
    if (typeof unlock === 'number') return 'zdobądź ' + unlock + ' ' + plural(unlock, 'odznakę', 'odznaki', 'odznak');
    if (unlock && unlock.count) return 'zdobądź ' + unlock.count + ' ' + plural(unlock.count, 'odznakę', 'odznaki', 'odznak');
    if (unlock && unlock.ach) return 'odznaka: ' + unlock.ach.map(function (id) { var a = achDef(id); return a ? '„' + a.label + '”' : id; }).join(' lub ');
    return '';
  }
  function achDef(id) { return DATA.ACHIEVEMENTS.filter(function (a) { return a.id === id; })[0]; }
  function loadSaved() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY));
      return (s && s.version === 8 && s.status === 'playing') ? s : null;
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
    if (el.screenPrologue) el.screenPrologue.hidden = name !== 'prologue';
    if (el.screenAnthro) el.screenAnthro.hidden = name !== 'anthropocene';
  }

  function newGame(speciesName, opts) {
    opts = Object.assign({}, opts || {});
    // Kod świata: podany przez gracza albo nowy, losowy.
    if (!opts.seed) opts.seed = Engine.normalizeSeed(el.worldSeed && el.worldSeed.value) || Engine.randomSeed();
    if (!opts.bodyPlan) opts.bodyPlan = chosenPlan();
    if (!opts.mods) opts.mods = chosenMods();
    opts.codexKnown = knownCodex();
    state = Engine.createInitialState(DATA, speciesName, opts);
    undoStack = []; chance = null; prevProgress = null;
    save();
    showScreen('game');
    renderAll();
    window.scrollTo(0, 0);
    maybeStartTutorial();
    startChance();
  }

  // ===================== Epilog grywalny: Antropocen =====================
  function verdictOf(a) { return a && a.verdict ? DATA.ANTHROPOCENE.verdicts.filter(function (v) { return v.id === a.verdict; })[0] : null; }
  function anthroMeters(a) {
    return meter('energy', '🌍 Biosfera', 'Kondycja biosfery', a.bio, 100, 'Im wyższa, tym zdrowsze ekosystemy. Zaczyna się od wartości zależnej od przebiegu Twojej gry.') +
      meter('gene', '⚙️ Rozwój', 'Rozwój cywilizacji', a.tech, 17, 'Technika, energia i wiedza rozumnego gatunku.');
  }
  function renderEndAnthro() {
    if (!el.endAnthro) return;
    var a = state.anthropocene;
    if (state.status !== 'won') { el.endAnthro.hidden = true; el.endAnthro.innerHTML = ''; return; }
    el.endAnthro.hidden = false;
    if (!a || !a.done) {
      el.endAnthro.innerHTML = '<h2>Epilog do rozegrania: Antropocen</h2>' +
        '<p>Twój gatunek jest rozumny. Cztery decyzje — energia, żywność, miasta i ochrona przyrody — zdecydują, czy jego rozwój zniszczy biosferę. ' +
        'Twoja gra już ją ukształtowała: startuje z wartością ' + (a ? a.startBio : Engine.startAnthropocene(DATA, state).state.anthropocene.bio) + ' / 100.</p>' +
        '<button id="btn-anthro-play" class="btn btn-primary" type="button">' + (a ? 'Wróć do epilogu' : 'Zagraj epilog') + '</button>';
      var pb = el.endAnthro.querySelector('#btn-anthro-play');
      pb.addEventListener('click', playAnthropocene);
      return;
    }
    var v = verdictOf(a), picks = a.picks.map(function (id, i) {
      var o = DATA.ANTHROPOCENE.stages[i].options.filter(function (x) { return x.id === id; })[0];
      return o ? o.label : id;
    });
    el.endAnthro.innerHTML = '<h2>' + escapeHtml(v.icon) + ' ' + escapeHtml(v.title) + '</h2><p>' + escapeHtml(v.text) + '</p>' +
      '<p class="anthro-picks">Wybory: ' + escapeHtml(picks.join(' → ')) + '</p>' +
      '<div class="resource-meters">' + anthroMeters(a) + '</div>' +
      '<p class="anthro-note">' + escapeHtml(DATA.ANTHROPOCENE.outro) + '</p>';
  }
  function playAnthropocene() {
    if (!state.anthropocene) { var r = Engine.startAnthropocene(DATA, state); if (!r.ok) { flash(r.error); return; } state = r.state; }
    showScreen('anthropocene'); renderAnthropocene(); window.scrollTo(0, 0);
  }
  function renderAnthropocene() {
    var a = state.anthropocene, stages = DATA.ANTHROPOCENE.stages, st = stages[a.round];
    el.anthroStep.textContent = 'Epilog · Antropocen · decyzja ' + (a.round + 1) + ' z ' + stages.length;
    el.anthroTitle.innerHTML = escapeHtml(st.icon) + ' ' + escapeHtml(st.title);
    el.anthroMeters.innerHTML = anthroMeters(a);
    el.anthroDesc.textContent = st.desc;
    el.anthroOptions.innerHTML = '';
    st.options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'choice-option prologue-option';
      b.innerHTML = '<strong><span aria-hidden="true">' + o.icon + '</span> ' + escapeHtml(o.label) + '</strong><span>' + escapeHtml(o.desc) + '</span>' +
        '<span class="prologue-trade">' + escapeHtml(o.tradeoff) + '</span>';
      b.addEventListener('click', function () { chooseAnthropocene(o.id); });
      el.anthroOptions.appendChild(b);
    });
  }
  function chooseAnthropocene(id) {
    var r = Engine.chooseAnthropocene(DATA, state, id);
    if (!r.ok) { flash(r.error); return; }
    state = r.state;
    if (state.anthropocene.done) showEnd(); else renderAnthropocene();
  }

  // ===================== Prolog (prekambr) =====================
  var prologueRun = null;
  function beginPrologue(name, opts) {
    prologueRun = { name: name, opts: opts, step: 0, picks: [] };
    showScreen('prologue');
    renderPrologue();
    if (el.prologueTitle) el.prologueTitle.focus && el.prologueTitle.setAttribute('tabindex', '-1');
    window.scrollTo(0, 0);
  }
  function renderPrologue() {
    var run = prologueRun, stages = DATA.PROLOGUE, st = stages[run.step];
    el.prologueStep.textContent = 'Prolog · prekambr · krok ' + (run.step + 1) + ' z ' + stages.length;
    el.prologueTitle.innerHTML = escapeHtml(st.title);
    el.prologueWhen.innerHTML = ico('ui:hourglass', st.icon) + ' ' + escapeHtml(st.when);
    el.prologueDesc.textContent = st.desc;
    el.prologueOptions.innerHTML = '';
    st.options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'choice-option prologue-option';
      b.innerHTML = '<strong><span aria-hidden="true">' + o.icon + '</span> ' + escapeHtml(o.label) + '</strong><span>' + escapeHtml(o.desc) + '</span>' +
        '<span class="prologue-trade">' + escapeHtml(o.tradeoff) + '</span>';
      b.addEventListener('click', function () { pickPrologue(o.id); });
      el.prologueOptions.appendChild(b);
    });
    var picked = run.picks.map(function (id) {
      var lab = ''; stages.forEach(function (s) { s.options.forEach(function (x) { if (x.id === id) lab = x.label; }); });
      return lab;
    });
    el.prologuePath.textContent = picked.length ? 'Dotąd: ' + picked.join(' → ') : '';
  }
  function pickPrologue(id) {
    var run = prologueRun; if (!run) return;
    run.picks.push(id); run.step += 1;
    if (run.step >= DATA.PROLOGUE.length) finishPrologue(); else renderPrologue();
  }
  function finishPrologue() {
    var run = prologueRun; prologueRun = null;
    newGame(run.name, Object.assign({}, run.opts, { prologue: run.picks }));
  }
  function skipPrologue() {
    var run = prologueRun; prologueRun = null;
    if (run) newGame(run.name, run.opts);
  }

  function scenarioOpts(sc) {
    return { difficulty: sc.difficulty, startEra: sc.startEra, startEp: sc.startEp,
      goal: sc.goal, startTraits: sc.startTraits, startNiche: sc.startNiche, scenarioId: sc.id,
      winPaths: sc.winPaths, capMult: sc.capMult, forcedGoals: sc.forcedGoals, rareTraits: sc.rareTraits, sandbox: sc.sandbox };
  }
  function scenarioById(id) { return DATA.SCENARIOS.filter(function (x) { return x.id === id; })[0]; }
  // Start scenariusza (z prologiem dla scenariuszy od paleozoiku, o ile gracz go nie wyłączył).
  function startScenario(sc, extra) {
    var name = (el.speciesInput.value || '').trim() || 'Prazwierzę', opts = Object.assign(scenarioOpts(sc), extra || {});
    if (el.prologueToggle && el.prologueToggle.checked && !sc.startEra && DATA.PROLOGUE && DATA.PROLOGUE.length) beginPrologue(name, opts);
    else newGame(name, opts);
  }
  function renderScenarios() {
    el.scenarioCards.innerHTML = '';
    DATA.SCENARIOS.forEach(function (sc) {
      var diff = DATA.DIFFICULTIES[sc.difficulty], open = isUnlocked(sc.unlock);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'scenario-card' + (open ? '' : ' locked');
      card.dataset.scenario = sc.id;
      card.disabled = !open;
      var thumb = (ART && ART.creature) ? ART.creature.thumb({ id: 'sc-' + sc.id, name: sc.name, traits: sc.startTraits || [], niche: sc.startNiche || 'woda' }, 96, 52) : '';
      card.innerHTML = '<span class="scenario-icon">' + ico('scenario:' + sc.id, sc.icon) + '</span>' +
        (thumb ? '<img class="scenario-thumb" alt="" src="' + thumb + '">' : '') +
        '<span class="scenario-name">' + sc.name + '</span>' +
        '<span class="scenario-diff">' + diff.label + (sc.sandbox ? ' · bez celu' : ' · cel: int. ' + (sc.goal != null ? sc.goal : diff.goal) + ' + kultura') + '</span>' +
        '<span class="scenario-intro">' + sc.intro + '</span>' +
        (sc.rules ? '<span class="scenario-rules">' + escapeHtml(sc.rules) + '</span>' : '') +
        (open ? '' : '<span class="scenario-lock">' + ico('ui:lock', '🔒') + ' Do odblokowania: ' + escapeHtml(unlockText(sc.unlock)) + '</span>');
      if (open) card.addEventListener('click', function () { startScenario(sc); });
      el.scenarioCards.appendChild(card);
    });
  }
  // ===================== Start: plan budowy, modyfikatory, centrum gracza =====================
  function chosenPlan() {
    var p = prefs().plan, def = DATA.BODY_PLANS && DATA.BODY_PLANS[p];
    return def && isUnlocked(def.unlock) ? p : 'kregowiec';
  }
  function chosenMods() {
    return (prefs().mods || []).filter(function (id) { var m = DATA.WORLD_MODS[id]; return m && isUnlocked(m.unlock); });
  }
  function renderPlanPicker() {
    if (!el.planOptions || !DATA.BODY_PLANS) return;
    var cur = chosenPlan();
    el.planOptions.innerHTML = '';
    Object.keys(DATA.BODY_PLANS).forEach(function (id) {
      var p = DATA.BODY_PLANS[id], open = isUnlocked(p.unlock);
      var thumb = (ART && ART.creature) ? ART.creature.thumb({ id: 'plan-' + id, name: p.label, traits: ['eyes'], niche: 'woda', bodyPlan: id }, 84, 46) : '';
      var lab = document.createElement('label');
      lab.className = 'pick-opt' + (open ? '' : ' locked') + (cur === id ? ' current' : '');
      lab.innerHTML = '<input type="radio" name="plan" value="' + id + '"' + (cur === id ? ' checked' : '') + (open ? '' : ' disabled') + '>' +
        (thumb ? '<img alt="" src="' + thumb + '">' : '<span aria-hidden="true">' + p.icon + '</span>') +
        '<span class="pick-text"><strong>' + escapeHtml(p.label) + '</strong><small>' + escapeHtml(p.desc) + '</small>' +
        (open ? '' : '<small class="pick-lock">' + ico('ui:lock', '🔒') + ' ' + escapeHtml(unlockText(p.unlock)) + '</small>') + '</span>';
      if (open) lab.querySelector('input').addEventListener('change', function () { setPref('plan', id); renderPlanPicker(); });
      el.planOptions.appendChild(lab);
    });
  }
  function renderModsPicker() {
    if (!el.modsOptions || !DATA.WORLD_MODS) return;
    var cur = chosenMods();
    el.modsOptions.innerHTML = '';
    Object.keys(DATA.WORLD_MODS).forEach(function (id) {
      var m = DATA.WORLD_MODS[id], open = isUnlocked(m.unlock), on = cur.indexOf(id) !== -1;
      var lab = document.createElement('label');
      lab.className = 'pick-opt pick-mod' + (open ? '' : ' locked') + (on ? ' current' : '');
      lab.innerHTML = '<input type="checkbox" value="' + id + '"' + (on ? ' checked' : '') + (open ? '' : ' disabled') + '>' +
        '<span aria-hidden="true" class="pick-ico">' + m.icon + '</span><span class="pick-text"><strong>' + escapeHtml(m.label) +
        ' <em>×' + num(m.scoreMult) + ' pkt</em></strong><small>' + escapeHtml(m.desc) + '</small>' +
        (open ? '' : '<small class="pick-lock">' + ico('ui:lock', '🔒') + ' ' + escapeHtml(unlockText(m.unlock)) + '</small>') + '</span>';
      if (open) lab.querySelector('input').addEventListener('change', function (e) {
        var ms = chosenMods().filter(function (x) { return x !== id; });
        if (e.target.checked) ms.push(id);
        setPref('mods', ms); renderModsPicker();
      });
      el.modsOptions.appendChild(lab);
    });
  }
  // Świat dnia i wyzwanie tygodnia: kod z daty (ten sam dla wszystkich, działa offline).
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateCode(d) { return String(d.getFullYear()).slice(2) + pad2(d.getMonth() + 1) + pad2(d.getDate()); }
  function dailySeed() { return 'D' + dateCode(new Date()); }
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
  }
  function weekly() {
    var w = isoWeek(new Date()), keys = Object.keys(DATA.WORLD_MODS);
    return { seed: 'W' + String(w.year).slice(2) + pad2(w.week), mod: keys[w.week % keys.length] };
  }
  function dailyInfo() { return readJson(DAILY_KEY, { best: {}, streak: 0, last: null }); }
  function recordDaily(score) {
    var d = dailyInfo(), today = dateCode(new Date()), yest = new Date(); yest.setDate(yest.getDate() - 1);
    if (d.last !== today) d.streak = d.last === dateCode(yest) ? (d.streak || 0) + 1 : 1;
    d.last = today; d.best = d.best || {}; d.best[today] = Math.max(d.best[today] || 0, score);
    writeJson(DAILY_KEY, d);
    return d;
  }
  function museum() { return readJson(MUSEUM_KEY, []); }
  function renderStartHub() {
    if (!el.startHub) return;
    var mus = museum(), owned = ownedAchievements(), known = knownCodex(), total = Object.keys(DATA.KNOWLEDGE).length;
    var best = readJson(BEST_KEY, {}), top = 0; Object.keys(best).forEach(function (k) { top = Math.max(top, best[k]); });
    var d = dailyInfo(), today = dateCode(new Date()), wk = weekly(), wm = DATA.WORLD_MODS[wk.mod];
    var returning = mus.length > 0 || owned.length > 0;
    if (el.introGoalBox) el.introGoalBox.open = !returning;
    var html = '';
    if (mus.length) {
      var last = mus[0];
      var th = (ART && ART.creature) ? ART.creature.thumb(museumLineage(last), 120, 66) : '';
      html += '<div class="hub-last">' + (th ? '<img alt="" src="' + th + '">' : '') + '<div><span class="hub-kicker">Ostatni gatunek</span>' +
        '<strong>' + escapeHtml(last.name) + '</strong> <em>' + escapeHtml(last.latin || '') + '</em><span class="hub-sub">' + escapeHtml(last.ending) +
        ' · ' + last.score + ' pkt</span></div></div>';
    }
    html += '<div class="hub-chips">' +
      '<button type="button" class="hub-chip" data-hub="museum">' + ico('ui:fossil', '🦴') + ' Muzeum: <strong>' + mus.length + '</strong></button>' +
      '<span class="hub-chip">' + ico('ui:star', '⭐') + ' Odznaki: <strong>' + owned.length + ' / ' + DATA.ACHIEVEMENTS.length + '</strong></span>' +
      '<button type="button" class="hub-chip" data-hub="codex">' + ico('ui:book', '📚') + ' Kodeks: <strong>' + Math.min(known.length, total) + ' / ' + total + '</strong></button>' +
      (top ? '<span class="hub-chip">' + ico('ui:target', '🎯') + ' Rekord: <strong>' + top + '</strong></span>' : '') + '</div>';
    html += '<div class="hub-challenges">' +
      '<button type="button" class="btn btn-primary hub-daily" data-hub="daily">' + ico('ui:sun', '☀️') + ' Świat dnia <code>' + dailySeed() + '</code></button>' +
      '<span class="hub-note">' + (d.best && d.best[today] ? 'dzisiejszy rekord: ' + d.best[today] + ' pkt · ' : '') +
      (d.streak ? 'passa: ' + d.streak + ' ' + plural(d.streak, 'dzień', 'dni', 'dni') : 'ten sam świat dla wszystkich — do jutra') + '</span>' +
      '<button type="button" class="btn btn-ghost hub-weekly" data-hub="weekly">' + escapeHtml(wm.icon) + ' Wyzwanie tygodnia: ' + escapeHtml(wm.label) + ' <code>' + wk.seed + '</code></button>' +
      '</div>';
    el.startHub.innerHTML = html;
    el.startHub.hidden = false;
    Array.prototype.forEach.call(el.startHub.querySelectorAll('[data-hub]'), function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-hub');
        if (k === 'museum') showMuseum();
        else if (k === 'codex') showCodex();
        else if (k === 'daily') startScenario(DATA.SCENARIOS[0], { seed: dailySeed(), daily: true, mods: [] });
        else if (k === 'weekly') startScenario(DATA.SCENARIOS[0], { seed: wk.seed, mods: [wk.mod] });
      });
    });
  }
  function renderStart() { renderStartHub(); renderPlanPicker(); renderModsPicker(); renderScenarios(); }

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
    var afford = DATA.TRAITS.filter(function (t) { return Engine.traitStatus(state, t, DATA) === 'available'; }).length;
    el.epAfford.textContent = state.status !== 'playing' ? '' :
      (afford ? 'stać Cię na ' + afford + ' ' + plural(afford, 'cechę', 'cechy', 'cech') : 'na razie nic do kupienia');
    var pend = pendingDecision();
    el.statusChoice.hidden = !pend;
    if (pend) { el.statusChoice.textContent = pend.label; el.statusChoice.classList.toggle('status-alert-trial', pend.kind === 'trial'); }
    el.statusOutlook.hidden = !(state.status === 'playing' && !isSandbox() && !Engine.victoryOutlook(DATA, state).possible);
    renderChance();
    renderActionBar();
  }
  // Co czeka na decyzję gracza przed turą (do paska stanu i paska akcji).
  function pendingDecision() {
    if (!state || state.status !== 'playing') return null;
    if (state.pendingChoice) {
      var ev = Engine.choiceEvent(DATA, state.pendingChoice.eventId);
      return ev && ev.trial ? { kind: 'trial', label: 'Próba rozumu czeka!', target: el.choiceCard } : { kind: 'card', label: 'Karta decyzji czeka', target: el.choiceCard };
    }
    if (Engine.contractPending(DATA, state)) return { kind: 'contract', label: 'Wybierz kontrakt ery', target: el.contractOffer };
    if (state.pendingVariants && !state.pendingVariants.chosen) return { kind: 'variant', label: 'Warianty w puli genów', target: el.variantCard };
    return null;
  }
  // Pasek akcji (przyklejony do dołu): EP, co czeka, przycisk tury i skrót klawiszowy.
  function renderActionBar() {
    if (!el.actionInfo || !state) return;
    var pend = pendingDecision(), afford = DATA.TRAITS.filter(function (t) { return Engine.traitStatus(state, t, DATA) === 'available'; }).length;
    var html = '<span class="ai-ep"><strong>' + state.ep + '</strong> EP' + (state.status === 'playing' ? (afford ? ' · stać Cię na ' + afford + ' ' + plural(afford, 'cechę', 'cechy', 'cech') : ' · nic do kupienia') : '') + '</span>';
    if (pend) html += '<button type="button" class="ai-pending ai-' + pend.kind + '">' + escapeHtml(pend.label) + ' ↑</button>';
    html += '<span class="ai-keys" aria-hidden="true"><kbd>Spacja</kbd> tura' + (pend && (pend.kind === 'card' || pend.kind === 'trial' || pend.kind === 'variant') ? ' · <kbd>1</kbd>–<kbd>3</kbd> wybór' : '') + '</span>';
    el.actionInfo.innerHTML = html;
    var b = el.actionInfo.querySelector('.ai-pending');
    if (b && pend) b.addEventListener('click', function () { focusDecision(pend); });
  }
  function focusDecision(pend) {
    if (!pend || !pend.target) return;
    pend.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var first = pend.target.querySelector('button:not(:disabled)'); if (first) first.focus({ preventScroll: true });
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
    el.statusChoice.addEventListener('click', function () { focusDecision(pendingDecision()); });
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
      html += '<span class="era-info-label">' + ico('ui:target', '🎯') + ' Kontrakt ery:</span>' + goals.map(function (g) {
        var d = Engine.goalDef(DATA, g.id); if (!d) return '';
        var mark = g.status === 'done' ? ico('ui:check', '✓') : (g.status === 'failed' ? ico('ui:close', '✗') : '○');
        var perk = d.perk && DATA.PERKS[d.perk];
        return '<span class="era-goal ' + g.status + '" title="' + escapeHtml(d.desc + (perk ? ' Przywilej: ' + perk.label + ' — ' + perk.desc : '')) + '">' + mark + ' ' + escapeHtml(d.label) +
          ' <em>+' + Engine.goalReward(DATA, g, d) + ' EP' + (perk && g.contract ? ' · ' + escapeHtml(perk.label) : '') + '</em></span>';
      }).join('');
    }
    var perks = Engine.perkList(DATA, state);
    if (perks.length) html += '<span class="era-info-label">' + ico('ui:star', '⭐') + ' Przywileje:</span>' + perks.map(function (p) {
      return '<span class="era-perk" title="' + escapeHtml(p.desc) + '">' + escapeHtml(p.label) + '</span>';
    }).join('');
    var mods = Engine.worldMods(DATA, state);
    if (mods.length) html += '<span class="era-info-label">Świat:</span>' + mods.map(function (m) {
      return '<span class="era-perk era-mod" title="' + escapeHtml(m.desc) + '">' + escapeHtml(m.icon + ' ' + m.label) + '</span>';
    }).join('');
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

  // Oferta kontraktów ery: trzy cele do wyboru (nagroda EP i przywilej na resztę gry).
  function renderContract() {
    if (!el.contractOffer) return;
    var p = state.status === 'playing' ? Engine.contractPending(DATA, state) : null;
    el.contractOffer.hidden = !p;
    if (!p) { el.contractOffer.innerHTML = ''; return; }
    var era = DATA.ERAS[p.era];
    el.contractOffer.innerHTML = '<h3 id="contract-title">' + ico('ui:target', '🎯') + ' Kontrakt ery: ' + escapeHtml(era.name) +
      ' <small>wybierz jeden cel — bez wyboru przed turą weźmiesz pierwszy</small></h3><div class="contract-options"></div>';
    var box = el.contractOffer.querySelector('.contract-options');
    p.options.forEach(function (id, i) {
      var d = Engine.goalDef(DATA, id), perk = d.perk && DATA.PERKS[d.perk], owned = perk && (state.perks || []).indexOf(d.perk) !== -1;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'contract-option';
      b.innerHTML = '<span class="contract-key" aria-hidden="true">' + (i + 1) + '</span><strong>' + escapeHtml(d.label) + '</strong>' +
        '<span>' + escapeHtml(d.desc) + '</span><span class="contract-reward">+' + Engine.goalReward(DATA, { contract: true }, d) + ' EP' +
        (perk ? ' · przywilej: <b>' + escapeHtml(perk.label) + '</b>' + (owned ? ' (już masz)' : '') + ' — ' + escapeHtml(perk.desc) : '') + '</span>';
      b.disabled = turnBusy;
      b.addEventListener('click', function () { onChooseContract(id); });
      box.appendChild(b);
    });
  }
  function onChooseContract(id) {
    if (turnBusy) return;
    if (applyAction(Engine.chooseContract(DATA, state, id))) { sound('card'); renderEraInfo(); renderContract(); renderStatus(); updateUndoButton(); }
  }
  // Tytuły przetrwania (inne drogi do sukcesu): widoczne od mezozoiku albo gdy szanse na rozum maleją.
  function renderLegacy() {
    if (!el.legacyPanel) return;
    var show = state.status === 'playing' && (state.eraIndex >= 1 || (chance && chance.raw < 0.15) || isSandbox());
    el.legacyPanel.hidden = !show;
    if (!show) return;
    el.legacyPanel.innerHTML = '<span class="era-info-label">' + ico('ui:paw', '🏅') + ' Inne drogi do sukcesu:</span>' + legacyChips();
  }
  function legacyChips() {
    return Engine.legacyProgress(DATA, state).map(function (x) {
      var pct = x.type === 'phoenix' ? (x.met ? 100 : 0) : Math.round(100 * Math.min(1, x.cur / x.max));
      var val = x.type === 'phoenix' ? (x.met ? 'spełniony' : 'min. ' + x.cur) : (x.type === 'niche' ? (x.met ? 'tak' : 'nie') : x.cur + ' / ' + x.max);
      return '<span class="legacy-chip' + (x.met ? ' met' : '') + '" title="' + escapeHtml(x.desc + ' Na koniec partii bez rozumu: +' + x.points + ' pkt i tytuł.') + '">' +
        '<strong>' + escapeHtml(x.title) + '</strong> <span class="legacy-bar"><span style="width:' + pct + '%"></span></span> <em>' + escapeHtml(val) + '</em></span>';
    }).join('');
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
    el.portraitCaption.innerHTML = 'Ryc. ' + (state.lineages.indexOf(l) + 1) + '. ' + escapeHtml(l.name) + ' <em class="latin">(' + escapeHtml(Engine.latinName(DATA, l, state)) + ')</em>' +
      ' — ' + (l.traits.length ? 'cech: ' + l.traits.length : 'prosty organizm') + ', nisza: ' + escapeHtml(nicheLabel(l.niche).toLowerCase());
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
  function arrow(d) { return d > 0 ? '↑' : (d < 0 ? '↓' : '→'); }
  function renderForecast(previewTrait, previewTactics, previewVariant) {
    var l = Engine.getActiveLineage(state);
    if (ART && ART.portrait && el.portrait) ART.portrait.preview(el.portrait, previewTrait ? previewTrait.id : null);
    var base = Engine.forecast(DATA, state, l);
    if (!base) { el.forecastBody.innerHTML = '<span class="forecast-none">Era dobiega końca.</span>'; return; }
    // Modyfikator „Bez prognozy”: tylko kierunek zmian.
    if ((state.rules && state.rules.mods || []).indexOf('blind') !== -1) {
      var bh = '<div class="forecast-row"><span>Populacja</span><span class="fc ' + (base.delta >= 0 ? 'pos' : 'neg') + '">' + arrow(base.delta) + '</span></div>' +
        '<div class="forecast-row"><span>Bilans energii</span><span class="fc ' + (base.energy >= 0 ? 'pos' : 'neg') + '">' + arrow(base.energy) + '</span></div>';
      var alt = previewTrait ? Engine.forecastWithTrait(DATA, state, l, previewTrait) : (previewTactics ? Engine.forecastWithTactics(DATA, state, l, previewTactics)
        : (previewVariant ? Engine.forecastWithVariant(DATA, state, l, previewVariant) : null));
      if (alt) bh += '<div class="forecast-preview"><strong>Po zmianie:</strong> populacja ' + arrow(alt.delta - base.delta) + ' względem obecnej prognozy</div>';
      if (base.catastrophe) bh += '<div class="forecast-warn">' + ico('ui:meteor', '☄️') + ' Nadchodzi katastrofa (' + escapeHtml(base.catastrophe.name) + ').</div>';
      bh += '<div class="forecast-note">Modyfikator „Bez prognozy”: widać tylko kierunek zmian.</div>';
      el.forecastBody.innerHTML = bh; return;
    }

    var deltaClass = base.delta >= 0 ? 'pos' : 'neg';
    var range = base.projectedLow !== base.projectedHigh ? ' <span class="fc-range" title="Warunki tury mogą się jeszcze nieco odchylić">(' +
      base.projectedLow + '–' + base.projectedHigh + ')</span>' : '';
    var html = '<div class="forecast-row"><span>Populacja</span><span class="fc ' + deltaClass + '">' +
      (base.delta >= 0 ? '+' : '') + base.delta + ' → ' + base.projectedPop + range + '</span></div>';
    html += '<div class="forecast-row"><span>Bilans energii</span><span class="fc ' +
      (base.energy >= 0 ? 'pos' : 'neg') + '">' + num(base.energy) + '</span></div>';
    html += '<div class="forecast-row"><span>' + ENERGY + ' Rezerwy</span><span class="fc ' +
      (base.reservesAfter >= base.reserves ? 'pos' : 'neg') + '">' + num(base.reserves) + ' → ' + num(base.reservesAfter) + '</span></div>';
    var capWarn = base.nicheLoad >= base.capacity * DATA.CAPACITY.warnAt;
    html += '<div class="forecast-row"><span>' + (base.diet === 'miesozerca' ? 'Zdobycz (drapieżniki / pojemność)' : 'Pojemność niszy') +
      '</span><span class="fc' + (capWarn ? ' neg' : '') + '">' + base.nicheLoad + ' / ' + base.capacity + '</span></div>';
    if (base.diet === 'miesozerca') html += '<div class="forecast-row"><span>Biomasa roślinożerców w niszy</span><span class="fc">' + base.preyBiomass + '</span></div>';
    if (base.webPressure >= 0.1) html += '<div class="forecast-row"><span>Presja Twojej mięsożernej linii</span><span class="fc neg">+' + num(base.webPressure) + '</span></div>';
    if (base.rivalLoad) html += '<div class="forecast-row"><span>w tym konkurenci</span><span class="fc">' + base.rivalLoad + '</span></div>';
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
    if (previewVariant) {
      var vd = Engine.variantDef(DATA, previewVariant), withV = Engine.forecastWithVariant(DATA, state, l, previewVariant);
      var dv = withV.delta - base.delta;
      html += '<div class="forecast-preview"><strong>Z wariantem „' + escapeHtml(vd.label) + '”:</strong> populacja ' + (withV.delta >= 0 ? '+' : '') + withV.delta +
        ' <span class="fc ' + (dv >= 0 ? 'pos' : 'neg') + '">(' + (dv >= 0 ? '+' : '') + dv + ')</span>, bilans energii ' + num(withV.energy) + ' (zmiana trwała)</div>';
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
    if (base.strategyBlocked) {
      html += '<div class="forecast-warn">Za mało rezerw na strategię r (1 ' + ENERGY + ' na turę) — linia rozmnaża się zwyczajnie.</div>';
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
        DATA.WIN_LINE_MIN + ' osobników w linii rozumnej i ' + DATA.WIN_MIN_POP + ' w całym gatunku — odbuduj populację.</div>';
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
    var cap = Engine.reservesCap(DATA, l, state.perks), vcap = DATA.VARIATION.cap;
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

    el.dietButtons.innerHTML = '';
    Object.keys(DATA.DIETS).forEach(function (key) {
      var dt = DATA.DIETS[key], can = Engine.canSetDiet(DATA, l, key), cur = key === Engine.dietOf(l);
      var b = tacticButton(dt, cur, cur ? '' : DATA.TROPHIC.switchCost + ' ' + ENERGY, playing && can.ok);
      b.title = dt.desc + (can.ok ? '' : ' — ' + can.error);
      if (playing && can.ok && !cur) {
        b.addEventListener('click', function () { onSetDiet(key); });
        previewOn(b, { diet: key, label: dt.label });
      }
      el.dietButtons.appendChild(b);
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

    var S = DATA.SELECTION, keys = ['feeding', 'defense', 'reproduction', 'mobility', 'metabolism', 'intelligence'];
    el.selectionSelect.innerHTML = '<option value="">— wyłączony —</option>' + keys.map(function (k) {
      var ok = Engine.selectionAllowed(l, k);
      return '<option value="' + k + '"' + (ok ? '' : ' disabled') + (l.selection === k ? ' selected' : '') + '>' +
        (k === 'metabolism' ? 'niższy metabolizm' : Engine.statLabel(k)) + (ok ? '' : ' (wymaga mózgu)') + '</option>';
    }).join('');
    el.selectionSelect.disabled = !playing || (!l.selection && l.variation < S.cost);
    el.selectionText.innerHTML = S.cost + ' ' + GENE + ' na turę; co turę szansa ' + Math.round(S.chance * 100) + '% (inteligencja ' +
      Math.round(S.intelChance * 100) + '%) na +1 do wybranej cechy. Koszt doboru: rozród ×' + num(S.birthMult) +
      ' — odsiane osobniki nie zostawiają potomstwa.';

    renderChoiceCard();
    renderVariantCard();
  }
  // Warianty w puli genów (tury bez karty): gracz wskazuje, który utrwali dobór (koszt 🧬).
  function renderVariantCard() {
    if (!el.variantCard) return;
    var pv = state.pendingVariants;
    if (!pv || state.status !== 'playing') { el.variantCard.hidden = true; el.variantCard.innerHTML = ''; return; }
    var l = Engine.getLineage(state, pv.lineageId);
    if (!l || !l.alive) { el.variantCard.hidden = true; return; }
    el.variantCard.hidden = false;
    var chosen = pv.chosen && Engine.variantDef(DATA, pv.chosen);
    el.variantCard.innerHTML = '<div class="choice-head"><span class="choice-icon" aria-hidden="true">' + ico('know:variation', '🧬') + '</span>' +
      '<div><strong>Warianty w puli genów</strong><div class="choice-target">Linia: ' + escapeHtml(l.name) + ' · ' + GENE + ' ' + l.variation + '</div></div></div>' +
      (chosen ? '<p class="choice-desc">Dobór utrwala: <strong>' + escapeHtml(chosen.label) + '</strong>. Pozostałe warianty przepadną w dryfie.</p>'
        : '<p class="choice-desc">Mutacje powstały losowo — nie Ty je tworzysz. Wskaż, który wariant ma się rozprzestrzenić (dobór zużywa zmienność), albo zostaw to dryfowi.</p>' +
          '<div class="choice-options"></div><p class="choice-default">Bez wyboru: dryf — nic się nie zmienia.</p>');
    if (chosen) return;
    var box = el.variantCard.querySelector('.choice-options');
    pv.options.forEach(function (id, i) {
      var v = Engine.variantDef(DATA, id), can = Engine.canPromoteVariant(DATA, state, id);
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'choice-option variant-option';
      b.disabled = !can.ok || turnBusy;
      b.innerHTML = '<strong><span class="contract-key" aria-hidden="true">' + (i + 1) + '</span> ' + escapeHtml(v.label) +
        ' <span class="tactic-cost">' + Engine.variantCost(DATA, v) + ' ' + GENE + '</span></strong>' +
        '<span class="variant-fx">' + renderEffects(v.effects) + '</span>' +
        '<span>' + escapeHtml(v.desc) + '</span><span class="variant-favors">Premiuje: ' + escapeHtml(v.favors) + '</span>' +
        (can.ok ? '' : '<span class="choice-block">' + escapeHtml(can.error) + '</span>');
      if (can.ok) {
        b.addEventListener('click', function () { onPromoteVariant(id); });
        b.addEventListener('mouseenter', function () { renderForecast(null, null, id); });
        b.addEventListener('mouseleave', function () { renderForecast(); });
        b.addEventListener('focus', function () { renderForecast(null, null, id); });
        b.addEventListener('blur', function () { renderForecast(); });
      }
      box.appendChild(b);
    });
  }
  function onPromoteVariant(id) {
    if (turnBusy) return;
    if (applyAction(Engine.promoteVariant(DATA, state, id))) {
      sound('variant');
      renderStatus(); renderActiveLineage(); renderTactics(); renderForecast(); renderTraits(); updateUndoButton();
    }
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
    el.choiceCard.classList.toggle('trial-card', !!ev.trial);
    el.choiceCard.innerHTML = (ev.trial ? '<p class="trial-kicker">Kulminacja — narodziny rozumu</p>' : '') +
      '<div class="choice-head"><span class="choice-icon" aria-hidden="true">' + ico(ev.art, ev.icon) + '</span>' +
      '<div><strong>' + escapeHtml(ev.name) + '</strong><div class="choice-target">Linia: ' + escapeHtml(l.name) +
      (pc.rivalName ? ' · Konkurent: ' + escapeHtml(pc.rivalName) : '') + '</div></div></div>' +
      (pc.echoOf && pc.echoOf.name ? '<p class="choice-echo">' + ico('ui:hourglass', '🔔') + ' Skutek Twojej wcześniejszej decyzji: „' +
        escapeHtml(pc.echoOf.option) + '” (' + escapeHtml(pc.echoOf.name) + ').</p>' : '') +
      '<p class="choice-desc">' + escapeHtml(ev.desc) + '</p><div class="choice-options"></div>' +
      '<p class="choice-default">Bez wyboru: „' + escapeHtml(def.label) + '”.</p>';
    var box = el.choiceCard.querySelector('.choice-options');
    ev.options.forEach(function (o, i) {
      var can = Engine.canChoose(DATA, state, o.id);
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'choice-option';
      b.disabled = !can.ok || turnBusy;
      var risk = o.gamble ? '<em class="choice-risk">' + ico('ui:target', '🎲') + ' Ryzyko — szansa powodzenia ' +
        Math.round(Engine.gambleChance(DATA, l, o.gamble, state) * 100) + '%</em>' : '';
      b.innerHTML = '<strong><span class="contract-key" aria-hidden="true">' + (i + 1) + '</span> ' + escapeHtml(o.label) + '</strong>' + risk + '<span>' + escapeHtml(o.desc) + '</span>' +
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
  function onSetDiet(key) {
    if (turnBusy) return;
    if (applyAction(Engine.setDiet(DATA, state, state.activeLineageId, key))) { renderTactics(); renderForecast(); updateUndoButton(); }
  }
  function onSetBehavior(key) {
    if (turnBusy) return;
    if (applyAction(Engine.setBehavior(DATA, state, state.activeLineageId, key))) { renderTactics(); renderForecast(); updateUndoButton(); }
  }
  function onToggleSelection() {
    if (turnBusy || !applyAction(Engine.setSelection(DATA, state, state.activeLineageId, el.selectionSelect.value || false))) { renderTactics(); return; }
    renderTactics(); renderForecast(); updateUndoButton();
  }
  function onChoose(optionId) {
    if (turnBusy) return;
    if (applyAction(Engine.resolveChoice(DATA, state, optionId))) { sound('card'); renderAll(); }
  }
  function sound(name) { if (ART && ART.sound) ART.sound.play(name); }

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
    renderRivals();
  }
  // Konkurenci: inne gatunki tej ery w niszach gracza (rola drapieżnika podnosi presję w niszy).
  function renderRivals() {
    if (!el.envRivals) return;
    var rs = (state.rivals || []).filter(function (r) { return r.alive; });
    el.envRivals.hidden = !rs.length;
    el.envRivals.innerHTML = !rs.length ? '' : '<strong>Konkurenci</strong>' + rs.map(function (r) {
      var k = DATA.RIVALS.filter(function (x) { return x.id === r.kind; })[0] || {};
      return '<div class="rival-row" title="' + escapeHtml(k.desc || '') + '">' + escapeHtml(r.icon) + ' ' + escapeHtml(r.name) +
        ' — ' + escapeHtml(nicheLabel(r.niche).toLowerCase()) + ', ok. ' + r.pop + ' os.' +
        (k.role === 'predator' ? ' <span class="rival-tag">drapieżnik</span>' : ' <span class="rival-tag">konkurent o pokarm</span>') + '</div>';
    }).join('');
  }
  // Zapowiedź katastrofy w następnej turze — czas, by przenieść linię lub odłożyć zapasy.
  function threatHtml(th) {
    var when = th.turnsAhead === 1 ? 'na następną turę' : 'za ' + th.turnsAhead + ' tury';
    var sev = th.severity ? Object.keys(th.severity).filter(function (k) { return th.severity[k][1] > 0; }).map(function (k) {
      var r = th.severity[k];
      return escapeHtml(nicheLabel(k)) + ' ' + (r[0] === r[1] ? r[0] : r[0] + '–' + r[1]) + '%';
    }).join(', ') : '';
    return ico('ui:hourglass', '⏳') + ' <strong>Zapowiedź ' + when + (th.newEra ? ' (' + escapeHtml(th.newEra) + ')' : '') + ':</strong> ' +
      (th.regional ? 'katastrofa regionalna — ' : '') + escapeHtml(th.name) + ', uderzy ' +
      (th.niche === 'all' ? 'we wszystkie nisze' : 'w niszę „' + escapeHtml(nicheLabel(th.niche)) + '”') + '.' +
      (sev ? ' Przewidywane straty bez ochrony: ' + sev + ' (cechy, zmienność i zasięg w kilku niszach je zmniejszają).' : '') +
      (th.note ? ' ' + escapeHtml(th.note) : '');
  }
  // Zwięzła zapowiedź do raportu (pełna — w panelu środowiska).
  function threatShort(th) {
    var a = Engine.getActiveLineage(state), r = th.severity && th.severity[a.niche];
    return ico('ui:hourglass', '⏳') + ' <strong>' + (th.turnsAhead === 1 ? 'W następnej turze' : 'Za ' + th.turnsAhead + ' tury') + ':</strong> ' + escapeHtml(th.name) +
      (r && r[1] > 0 ? ' — w Twojej niszy do ' + r[1] + '% strat' : (th.niche === 'all' ? '' : ' (nisza: ' + escapeHtml(nicheLabel(th.niche).toLowerCase()) + ')')) + '.';
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
      food: ne.food, predators: ne.predators, catastrophe: !!cat, aftermath: aftermathFor(a.niche),
      lineages: state.lineages.filter(function (l) { return l.alive && l.niche === a.niche; }).map(function (l) {
        return { id: l.id, name: l.name, traits: l.traits, niche: l.niche, population: l.population, active: l.id === a.id, parentId: l.parentId, bodyPlan: l.bodyPlan };
      })
    });
    var others = state.lineages.filter(function (l) { return l.alive && l.niche === a.niche && l.id !== a.id; }).length;
    el.dioramaCaption.innerHTML = nicheIcon(a.niche) + ' <strong>' + escapeHtml(nicheLabel(a.niche)) + '</strong> · ' +
      escapeHtml(env ? env.title : era.name) + (env ? ' · ' + climateLabel(env.climate) : '') +
      (others ? ' · ' + ico('ui:branch', '') + ' +' + others + (others === 1 ? ' linia' : ' linie') : '') +
      (cat ? ' · <span class="diorama-warn">' + ico('ui:meteor', '☄️', 'ico-danger') + ' ' + escapeHtml(env.catastrophe.name) + '</span>' : '');
  }
  // Ślad po katastrofie: przez trzy tury po uderzeniu w niszę linii krajobraz jest szary i stopniowo się odradza.
  function aftermathFor(niche) {
    var h = state.history || [], fade = [0.9, 0.6, 0.3];
    for (var i = 0; i < 3 && i < h.length; i++) {
      var c = h[h.length - 1 - i].catastrophe;
      if (c && (c.niche === 'all' || c.niche === niche)) return fade[i];
    }
    return 0;
  }
  // Zmiana ery jako scena: podpis „Koniec ery / Nowa era” wpływa na dioramę i znika.
  var pendingEraReport = null;
  function showEraInterlude(report) {
    if (!el.diorama || el.diorama.hidden || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var old = el.diorama.querySelector('.era-interlude'); if (old) old.remove();
    var div = document.createElement('div');
    div.className = 'era-interlude'; div.setAttribute('aria-hidden', 'true');
    div.innerHTML = '<span class="era-interlude-end">Koniec ery: ' + escapeHtml(report.eraName) + '</span>' +
      '<strong>' + escapeHtml(report.newEraName) + '</strong>' +
      '<span class="era-interlude-sub">' + escapeHtml(eraMilestone(report.newEraName)) + '</span>';
    el.diorama.appendChild(div);
    setTimeout(function () { if (div.parentNode) div.remove(); }, 4200);
  }
  function chip(t) { return '<li>' + t + '</li>'; }
  function climateLabel(c) {
    return c === 'zimno' ? ico('ui:snow', '❄️', 'ico-cold') + ' zimno'
      : (c === 'cieplo' ? ico('ui:sun', '☀️', 'ico-warm') + ' ciepło' : ico('ui:mild', '⛅') + ' umiarkowanie');
  }

  // ===================== Render — drzewo cech =====================
  // Widok panelu cech: „Teraz” (tylko to, co da się kupić teraz lub wkrótce) albo „Wszystkie”.
  function traitsView() { return prefs().traitsView === 'all' ? 'all' : 'now'; }
  function traitById(id) { return DATA.TRAITS.filter(function (t) { return t.id === id; })[0]; }
  /* Następny krok drogi do celu gry (⭐): pierwsza nieposiadana cecha ścieżki, a jeśli jej
     wymagania są niespełnione — pierwsze brakujące wymaganie. */
  function nextStep(l) {
    var ids = Engine.winPaths(DATA, state).map(function (p) { return p.id; });
    var sea = ids.indexOf('sound') !== -1 && (ids.indexOf('tools') === -1 || (l.traits.indexOf('limbs') === -1 && (l.niche === 'woda' || l.traits.indexOf('echolocation') !== -1)));
    var order = ['ganglia', 'brain', 'big_brain', 'social', 'parental_care'].concat(sea ? ['echolocation', 'vocal_culture'] : ['grasping_hand', 'tool_use']);
    function first(id, depth) {
      var t = traitById(id); if (!t || depth > 5) return null;
      for (var i = 0; i < t.requires.length; i++) if (l.traits.indexOf(t.requires[i]) === -1) return first(t.requires[i], depth + 1);
      return t;
    }
    for (var i = 0; i < order.length; i++) {
      var goal = traitById(order[i]);
      if (!goal || l.traits.indexOf(goal.id) !== -1 || Engine.excludedBy(l, goal, DATA)) continue;
      var step = first(goal.id, 0);
      if (step) return { trait: step, goal: goal, status: Engine.traitStatus(state, step, DATA) };
    }
    return null;
  }
  function renderTraitsToolbar(l) {
    if (!el.traitsToolbar) return;
    var view = traitsView(), ns = state.status === 'playing' && !isSandbox() ? nextStep(l) : null;
    var html = '<div class="view-toggle" role="group" aria-label="Widok cech">' +
      '<button type="button" data-view="now" aria-pressed="' + (view === 'now') + '">Dostępne teraz</button>' +
      '<button type="button" data-view="all" aria-pressed="' + (view === 'all') + '">Wszystkie cechy</button></div>';
    if (ns) {
      var cost = Engine.traitCost(DATA, state, ns.trait, l), st = ns.status;
      var when = st === 'available' ? cost + ' EP — stać Cię' : (st === 'too_expensive' ? cost + ' EP — brakuje ' + (cost - state.ep) : (st === 'era_locked' ? 'od ery: ' + DATA.ERAS[ns.trait.minEra].name : ''));
      html += '<div class="next-step">' + ico('ui:star', '⭐', 'ico-star') + ' Następny krok Twojej drogi do celu gry: ' +
        '<button type="button" class="btn-link" data-goto="' + ns.trait.id + '">' + escapeHtml(ns.trait.name) + '</button>' +
        (when ? ' <span class="next-step-when">(' + escapeHtml(when) + ')</span>' : '') +
        (ns.goal.id !== ns.trait.id ? ' <span class="next-step-why">— wymaga jej „' + escapeHtml(ns.goal.name) + '”</span>' : '') + '</div>';
    }
    el.traitsToolbar.innerHTML = html;
    Array.prototype.forEach.call(el.traitsToolbar.querySelectorAll('[data-view]'), function (b) {
      b.addEventListener('click', function () { setPref('traitsView', b.getAttribute('data-view')); renderTraits(); });
    });
    var g = el.traitsToolbar.querySelector('[data-goto]');
    if (g) g.addEventListener('click', function () {
      var id = g.getAttribute('data-goto'), card = el.traits.querySelector('[data-trait-id="' + id + '"]');
      if (!card && traitsView() === 'now') { setPref('traitsView', 'all'); renderTraits(); card = el.traits.querySelector('[data-trait-id="' + id + '"]'); }
      if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.add('pulse'); setTimeout(function () { card.classList.remove('pulse'); }, 1600); if (!card.disabled) card.focus({ preventScroll: true }); }
    });
  }
  function renderTraits() {
    el.traits.innerHTML = '';
    var lineage = Engine.getActiveLineage(state);
    renderTraitsToolbar(lineage);
    if (traitsView() === 'now') { renderTraitsNow(lineage, nextStep(lineage)); return; }
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
  /* Widok „Teraz”: jedna zwarta siatka — najpierw następny krok, potem to, na co stać,
     potem (zwinięte) to, na co brakuje EP; na dole zdobyte i „później”. */
  function renderTraitsNow(lineage, ns) {
    var owned = [], later = [], now = [], pricey = [];
    var order = ['uklad_nerwowy'].concat(Object.keys(DATA.CATEGORIES).filter(function (c) { return c !== 'uklad_nerwowy'; }));
    DATA.TRAITS.slice().sort(function (a, b) { return order.indexOf(a.category) - order.indexOf(b.category); }).forEach(function (t) {
      var st = Engine.traitStatus(state, t, DATA);
      if (st === 'owned') owned.push(t);
      else if (st === 'available') now.push(t);
      else if (st === 'too_expensive') pricey.push(t);
      else if (st !== 'rare_locked') later.push({ t: t, st: st });
    });
    var first = function (list) { if (!ns) return list; var i = list.indexOf(ns.trait); if (i > 0) { list.splice(i, 1); list.unshift(ns.trait); } return list; };
    var grid = document.createElement('div'); grid.className = 'trait-grid trait-grid-now';
    first(now).concat(first(pricey)).forEach(function (trait) {
      var isNext = ns && ns.trait.id === trait.id;
      var c = renderTraitCard(trait, lineage, !isNext);
      if (isNext) c.classList.add('next-step-card');
      var tag = document.createElement('span'); tag.className = 'trait-cat-tag';
      tag.innerHTML = ico('cat:' + trait.category, DATA.CATEGORY_ICONS[trait.category] || '') + ' ' + escapeHtml(DATA.CATEGORIES[trait.category]);
      c.insertBefore(tag, c.firstChild);
      grid.appendChild(c);
    });
    if (grid.children.length) el.traits.appendChild(grid);
    if (!el.traits.children.length) {
      var none = document.createElement('p'); none.className = 'traits-empty';
      none.textContent = 'Teraz nie ma cech w zasięgu — zbieraj punkty ewolucji albo przejdź do widoku „Wszystkie cechy”.';
      el.traits.appendChild(none);
    }
    var foot = document.createElement('div'); foot.className = 'traits-foot';
    if (owned.length) foot.innerHTML += '<p class="traits-owned"><strong>' + ico('ui:check', '✓') + ' Zdobyte (' + owned.length + '):</strong> ' +
      owned.map(function (t) { return '<span class="owned-chip">' + ico('trait:' + t.id, t.icon) + ' ' + escapeHtml(t.name) + '</span>'; }).join('') + '</p>';
    if (later.length) foot.innerHTML += '<details class="traits-later"><summary>Później (' + later.length + '): zablokowane, z innych er lub wykluczone</summary><ul>' +
      later.map(function (x) {
        var why = x.st === 'era_locked' ? 'od ery: ' + DATA.ERAS[x.t.minEra].name : (x.st === 'excluded' ? 'wykluczona przez sposób życia linii'
          : 'wymaga: ' + reqNames(x.t.requires.filter(function (id) { return lineage.traits.indexOf(id) === -1; })));
        return '<li>' + ico('trait:' + x.t.id, x.t.icon) + ' <strong>' + escapeHtml(x.t.name) + '</strong> — ' + escapeHtml(why) + ' (' + x.t.cost + ' EP)</li>';
      }).join('') + '</ul></details>';
    if (foot.innerHTML) el.traits.appendChild(foot);
  }
  // Cecha kupiona przed chwilą dostaje animację „pieczątki” (raz).
  var lastBoughtId = null;
  // `compactPricey` — w widoku „Teraz” cechy, na które brakuje EP, są zwinięte (pełny opis w podpowiedzi).
  function renderTraitCard(trait, lineage, compactPricey) {
    var status = Engine.traitStatus(state, trait, DATA);
    var btn = document.createElement('button');
    btn.type = 'button';
    var compact = status === 'locked' || status === 'era_locked' || status === 'rare_locked' || (compactPricey && status === 'too_expensive');
    btn.className = 'trait ' + status + (compact ? ' compact' : '') + (trait.path === 'intelligence' ? ' path-intel' : '') +
      (trait.id === lastBoughtId ? ' just-bought' : '');
    if (compact) btn.title = trait.name + ' — ' + trait.desc;
    btn.dataset.traitId = trait.id;
    btn.disabled = (status !== 'available') || state.status !== 'playing';

    var cost = Engine.traitCost(DATA, state, trait, lineage), par = cost < trait.cost ? Engine.parallelSource(state, lineage, trait) : null;
    var costLabel;
    if (status === 'owned') costLabel = ico('ui:check', '✓') + ' zdobyta';
    else if (status === 'excluded') costLabel = ico('ui:close', '✗') + ' wykluczona';
    else if (status === 'locked') costLabel = ico('ui:lock', '🔒') + ' zablokowana';
    else if (status === 'era_locked') costLabel = ico('ui:hourglass', '⏳') + ' ' + DATA.ERAS[trait.minEra].name;
    else if (status === 'rare_locked') costLabel = '✨ rzadka';
    else costLabel = (par ? '<s>' + trait.cost + '</s> ' : '') + cost + ' EP';

    var extra = '';
    if (status === 'excluded') {
      var exId = Engine.excludedBy(lineage, trait, DATA), exT = DATA.TRAITS.filter(function (x) { return x.id === exId; })[0];
      extra = '<div class="trait-req">' + ico('ui:close', '✗') + '<span>Wyklucza się z cechą „<strong>' + escapeHtml(exT ? exT.name : exId) +
        '</strong>” — ta linia wybrała inny sposób życia.</span></div>';
    } else if (status === 'locked') {
      var missing = trait.requires.filter(function (id) { return lineage.traits.indexOf(id) === -1; });
      extra = '<div class="trait-req">' + ico('ui:lock', '🔒') + '<span>Najpierw zdobądź: <strong>' + reqNames(missing) +
        '</strong> (koszt: ' + trait.cost + ' EP)</span></div>';
    } else if (status === 'era_locked') {
      extra = '<div class="trait-req">' + ico('ui:hourglass', '⏳') + '<span>Dostępna od ery: <strong>' + DATA.ERAS[trait.minEra].name +
        '</strong> (koszt: ' + trait.cost + ' EP)</span></div>';
    } else if (status === 'rare_locked') {
      extra = '<div class="trait-req">✨<span>Rzadki wariant — pojawia się w puli genów losowo (jeden na erę).</span></div>';
    } else if (status === 'too_expensive') {
      extra = '<div class="trait-req warn">Brakuje ' + (cost - state.ep) + ' EP</div>';
    }
    if (par && status !== 'owned') {
      extra += '<div class="trait-parallel">' + ico('ui:branch', '🔁') + '<span>Ewolucja równoległa: linia „' + escapeHtml(par.name) +
        '” ma już tę cechę — taniej o ' + Math.round(DATA.PARALLEL_DISCOUNT * 100) + '%.</span></div>';
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
    lastBoughtId = traitId;
    sound('stamp');
    renderStatus(); renderActiveLineage(); renderTraits(); lastBoughtId = null; renderLineageBar(); renderTactics(); renderForecast(); renderDiorama(); updateUndoButton();
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
    if (turnBusy || !state || state.status !== 'playing') return;
    var before = state, progBefore = Engine.achievementProgress(DATA, state);
    var res = Engine.simulateTurn(DATA, state);
    if (!res.report) return;
    var play = buildTurnPlay(res.report, state);
    function applyTurn() {
      setTurnBusy(false);
      pushUndo(); state = res.state; save(); renderAll(); showReport(res.report);
      afterTurn(before, res.report, progBefore);
    }
    var mode = ART && ART.settings ? ART.settings.get().turnAnimation : 'show';
    var skipAnim = mode === 'skip';
    // Tryb „ważne tury”: pełna animacja tylko przy katastrofie, mutacji, dużej zmianie, karcie z ryzykiem lub nowej erze.
    if (play && mode === 'important' && !turnImportant(res.report, play)) play.speed = 0.25;
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
  // Pełna animacja: wielkie wymieranie, nowa era, próba rozumu, koniec gry albo zapaść populacji (−40%).
  function turnImportant(report, play) {
    if (play.extinction || report.eraChanged || report.trialStarted || report.status !== 'playing') return true;
    var b = play.popBefore || 1;
    return (play.popBefore - play.popAfter) / b >= 0.4;
  }
  // Dane animacji tury dla aktywnej linii (liczby z raportu silnika).
  function buildTurnPlay(report, before) {
    var a = Engine.getActiveLineage(before);
    var lr = report.lineReports.filter(function (x) { return x.lineageId === a.id; })[0];
    if (!lr) return null;
    var mut = lr.mutation ? { beneficial: lr.mutation.beneficial, text: Engine.statLabel(lr.mutation.key) + ' ' + (lr.mutation.delta > 0 ? '+1' : '−1') } : null;
    var cat = null;
    if (report.catastrophe && (report.catastrophe.niche === 'all' || report.catastrophe.niche === a.niche)) {
      var nm = report.catastrophe.name;
      cat = { name: nm, kind: /lodow|ordowick/i.test(nm) ? 'ice' : (/permsk/i.test(nm) ? 'volcano' : 'meteor') };
    }
    var ext = null;
    if (cat && lr.popBefore > 0 && lr.catDeaths / lr.popBefore >= 0.35) {
      var pct = Math.round(100 * lr.catDeaths / lr.popBefore);
      ext = {
        kicker: 'Wielkie wymieranie', title: cat.name,
        sub: lr.popAfter <= 0 ? 'Linia nie przetrwała.' : 'Zginęło ' + pct + '% populacji. Przetrwało ' + lr.popAfter + ' osobników — świat będzie się odradzał.'
      };
    }
    return {
      extinction: ext,
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
    renderStatus(); renderTimeline(); renderEraInfo(); renderContract(); renderLegacy(); renderLineageBar();
    renderActiveLineage(); renderTactics(); renderForecast(); renderEnv(); renderDiorama(); renderTraits(); updateUndoButton();
    el.btnSimulate.disabled = (state.status !== 'playing');
    el.btnSimulate.textContent = isSandbox() ? 'Przeżyj turę (tryb otwarty) →' : T('species.simulate');
  }
  // Po turze: dźwięk, komunikaty o postępie odznak, kontraktach i rzadkich wariantach, nowy szacunek szans.
  var prevProgress = null;
  function afterTurn(before, report, progBefore) {
    if (report.status === 'won') sound('win');
    else if (report.status === 'lost') sound('lose');
    else if (report.eraChanged) sound('era');
    else if (report.threat && !(before.history.length && before.history[before.history.length - 1].threat)) sound('warn');
    if (isSandbox()) return;
    var owned = ownedAchievements(), now = Engine.achievementProgress(DATA, state);
    now.forEach(function (p) {
      var b = progBefore.filter(function (x) { return x.id === p.id; })[0];
      if (!b || p.cur <= b.cur || owned.indexOf(p.id) !== -1) return;
      if (p.cur >= p.max) toast(escapeHtml(p.icon) + ' Odznaka w zasięgu: <strong>' + escapeHtml(p.label) + '</strong> — zostanie zapisana na koniec partii.', 'good');
      else if (p.max <= 10) toast(escapeHtml(p.icon) + ' ' + escapeHtml(p.label) + ': ' + p.cur + ' / ' + p.max, 'info');
    });
    (report.goals || []).forEach(function (g) {
      if (g.status === 'done') toast(ico('ui:check', '✓') + ' Kontrakt wypełniony: <strong>' + escapeHtml(g.label) + '</strong> (+' + g.reward + ' EP' +
        (g.perk ? ', przywilej: ' + escapeHtml(DATA.PERKS[g.perk].label) : '') + ')', 'good');
    });
    if (report.rareTrait) { var rt = traitById(report.rareTrait); if (rt) toast('✨ W puli genów pojawił się rzadki wariant: <strong>' + escapeHtml(rt.name) + '</strong> (panel cech, kategoria „Rzadkie warianty”).', 'info'); }
    if (state.status === 'playing') startChance();
  }
  // Komunikaty (tosty) — nie przerywają gry; czytnik ekranu ogłasza je przez aria-live.
  function toast(html, kind) {
    if (!el.toasts) return;
    var t = document.createElement('div');
    t.className = 'toast toast-' + (kind || 'info'); t.innerHTML = html;
    el.toasts.appendChild(t);
    sound('toast');
    setTimeout(function () { t.classList.add('toast-out'); }, 5200);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 5800);
    while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
  }

  // ===================== Raport tury =====================
  function renderRivalReport(report, host) {
    var rows = [];
    (report.rivalReports || []).forEach(function (r) {
      rows.push(escapeHtml(r.icon) + ' ' + escapeHtml(r.name) + ': ' + r.popBefore + ' → ' + r.popAfter + (r.note ? ' — ' + escapeHtml(r.note) : ''));
    });
    if (report.rivalSpawn) rows.push(escapeHtml(report.rivalSpawn.icon) + ' ' + escapeHtml(report.rivalSpawn.text));
    if (!rows.length) return;
    var box = document.createElement('div'); box.className = 'report-rivals';
    box.innerHTML = '<strong>Konkurenci</strong>' + rows.map(function (t) { return '<div class="report-event">' + t + '</div>'; }).join('');
    (host || el.reportBody).appendChild(box);
  }
  // Najważniejsze pojęcia mają pierwszeństwo w raporcie (reszta czeka w Kodeksie).
  var KNOW_PRIORITY = ['extinction', 'starvation', 'predation', 'capacity', 'variants', 'no_goal', 'fire', 'language', 'range',
    'speciation', 'radiation', 'competition', 'coevolution', 'reserves', 'mutation_good', 'mutation_bad', 'cold', 'land', 'niche'];
  function rankKnowledge(keys) {
    return keys.slice().sort(function (a, b) {
      var ia = KNOW_PRIORITY.indexOf(a), ib = KNOW_PRIORITY.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }
  // Jedno zdanie o turze: największe składniki zmiany populacji gatunku.
  function turnStory(report) {
    var t = { births: 0, pred: 0, starve: 0, dis: 0, crowd: 0, cat: 0 }, before = 0, dead = [];
    report.lineReports.forEach(function (lr) {
      before += lr.popBefore; t.births += lr.births; t.pred += lr.predationDeaths; t.starve += lr.starvationDeaths;
      t.dis += lr.diseaseDeaths; t.crowd += lr.crowdDeaths; t.cat += lr.catDeaths;
      if (!lr.alive && lr.popBefore > 0) dead.push(lr.name);
    });
    var parts = [];
    if (t.cat) parts.push(escapeHtml(report.catastrophe.name) + ': zginęło <strong>' + t.cat + '</strong> ' + plural(t.cat, 'osobnika', 'osobniki', 'osobników'));
    var losses = [['drapieżniki zabiły', t.pred], ['głód zabrał', t.starve], ['choroba zabiła', t.dis], ['przegęszczenie zabrało', t.crowd]]
      .filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 2);
    if (t.births) parts.push('urodziło się <strong>' + t.births + '</strong> ' + plural(t.births, 'młode', 'młode', 'młodych'));
    losses.forEach(function (x) { parts.push(x[0] + ' <strong>' + x[1] + '</strong>'); });
    var txt = parts.length ? parts.join(', ') : 'spokojna tura bez większych zmian';
    txt = (t.cat ? txt : txt.charAt(0).toUpperCase() + txt.slice(1)) + '. Gatunek liczy teraz <strong>' + report.totalPopulation + '</strong> ' +
      plural(report.totalPopulation, 'osobnika', 'osobniki', 'osobników') + '.';
    if (dead.length) txt += ' Wymarła linia: ' + dead.map(escapeHtml).join(', ') + '.';
    return { text: txt, before: before };
  }
  // Co było decyzją gracza, a co losem — osobno.
  function turnCauses(report) {
    var mine = [], luck = [];
    (report.actions || []).forEach(function (a) {
      if (a.type === 'trait') { var t = traitById(a.id); if (t) mine.push('cecha „' + escapeHtml(t.name) + '”'); }
      else if (a.type === 'migrate') mine.push('migracja: ' + escapeHtml(nicheLabel(a.niche).toLowerCase()));
      else if (a.type === 'speciate') mine.push('nowa gałąź „' + escapeHtml(a.name) + '”');
      else if (a.type === 'contract') { var g = Engine.goalDef(DATA, a.id); if (g) mine.push('kontrakt „' + escapeHtml(g.label) + '”'); }
      else if (a.type === 'strategy') mine.push(escapeHtml(DATA.STRATEGIES[a.id].label.split(' — ')[0]).replace(/^S/, 's'));
      else if (a.type === 'behavior') mine.push(escapeHtml(DATA.BEHAVIORS[a.id].label.toLowerCase()));
      else if (a.type === 'diet') mine.push('dieta: ' + escapeHtml(DATA.DIETS[a.id].label.toLowerCase()));
    });
    if (report.variant) mine.push('utrwalony wariant „' + escapeHtml(report.variant.label) + '”');
    if (report.choice) mine.push(escapeHtml(report.choice.name) + ': „' + escapeHtml(report.choice.option) + '”');
    if (report.contractAuto) { var ga = Engine.goalDef(DATA, report.contractAuto); if (ga) luck.push('kontrakt przydzielony bez wyboru: „' + escapeHtml(ga.label) + '”'); }
    report.lineReports.forEach(function (lr) {
      if (lr.mutation) luck.push((lr.mutation.beneficial ? 'korzystna' : 'szkodliwa') + ' mutacja: ' + Engine.statLabel(lr.mutation.key) + ' ' + (lr.mutation.delta > 0 ? '+1' : '−1') +
        (report.lineReports.length > 1 ? ' (' + escapeHtml(lr.name) + ')' : ''));
    });
    if (report.choice && report.choice.outcome) luck.push((report.choice.outcome.win ? 'ryzyko się udało' : 'ryzyko się nie udało') + ' (szansa ' + report.choice.outcome.chance + '%)');
    if (report.envShown && report.envReal) {
      var df = Math.round(report.envReal.food - report.envShown.food), dp = Math.round(report.envReal.predators - report.envShown.predators);
      var bits = [];
      if (df) bits.push('pokarm ' + (df > 0 ? '+' : '−') + Math.abs(df));
      if (dp) bits.push('drapieżniki ' + (dp > 0 ? '+' : '−') + Math.abs(dp));
      if (bits.length) luck.push('warunki ' + ((df >= 0 && dp <= 0) ? 'lepsze' : ((df <= 0 && dp >= 0) ? 'gorsze' : 'inne')) + ' niż w prognozie: ' + bits.join(', '));
    }
    if (report.catastrophe && report.catastrophe.sevMult) {
      var m = report.catastrophe.sevMult;
      if (m >= 1.08) luck.push('katastrofa silniejsza niż przeciętnie'); else if (m <= 0.92) luck.push('katastrofa słabsza niż przeciętnie');
    }
    return { mine: mine, luck: luck };
  }
  function showReport(report) {
    // Baner zmiany ery.
    if (report.eraChanged) {
      pendingEraReport = report;
      el.reportEra.hidden = false;
      el.reportEra.innerHTML = ico('ui:ammonite', '🏛️') + ' Nowa era: <strong>' + report.newEraName + '</strong><br>' +
        '<span class="report-era-milestone">' + eraMilestone(report.newEraName) + '</span>';
    } else el.reportEra.hidden = true;

    // Nagłówek: duże liczby, zdanie o turze, decyzje kontra los, zapowiedź.
    var story = turnStory(report), dPop = report.totalPopulation - story.before, causes = turnCauses(report);
    var hl = '<div class="rh-main"><div class="rh-num"><span>Populacja</span><strong>' + story.before + ' → ' + report.totalPopulation + '</strong>' +
      '<em class="' + (dPop >= 0 ? 'pos' : 'neg') + '">' + (dPop >= 0 ? '+' : '−') + Math.abs(dPop) + '</em></div>' +
      '<div class="rh-num"><span>Punkty ewolucji</span><strong>+' + report.epGain + '</strong><em>razem ' + state.ep + '</em></div>' +
      (report.intelligenceGoal ? '<div class="rh-num"><span>Inteligencja</span><strong>' + report.maxIntelligence + ' / ' + report.intelligenceGoal + '</strong></div>' : '') +
      '</div><p class="rh-story">' + story.text + '</p>';
    if (report.trialStarted) hl += '<p class="rh-trial">' + ico('trait:tool_use', '🔥') + ' <strong>Twoja linia stoi u progu rozumu!</strong> W następnej turze czeka ją próba — ostatni krok do zwycięstwa.</p>';
    if (causes.mine.length || causes.luck.length) {
      hl += '<div class="rh-causes">' +
        (causes.mine.length ? '<p><span class="rh-tag rh-you">Twoje decyzje</span> ' + causes.mine.slice(0, 5).join(' · ') + '</p>' : '') +
        (causes.luck.length ? '<p><span class="rh-tag rh-luck">Los</span> ' + causes.luck.slice(0, 4).join(' · ') + '</p>' : '') + '</div>';
    }
    (report.goals || []).forEach(function (g) {
      hl += '<p class="rh-goal ' + g.status + '">' + (g.status === 'done' ? ico('ui:check', '✓') + ' Kontrakt wypełniony: ' : ico('ui:close', '✗') + ' Kontrakt przepadł: ') +
        escapeHtml(g.label) + (g.status === 'done' ? ' — +' + g.reward + ' EP' + (g.perk ? ', przywilej „' + escapeHtml(DATA.PERKS[g.perk].label) + '”' : '') : '') + '</p>';
    });
    if (report.threat && state.status === 'playing') hl += '<p class="report-threat-short">' + threatShort(report.threat) + '</p>';
    el.reportHeadline.innerHTML = hl;

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

    // Pełny rachunek tury — zwinięty (szczegóły na żądanie).
    el.reportBody.innerHTML = '';
    var det = document.createElement('details'); det.className = 'report-details';
    if (prefs().reportOpen) det.open = true;
    det.innerHTML = '<summary>Pełny rachunek tury</summary>';
    det.addEventListener('toggle', function () { setPref('reportOpen', det.open); });
    el.reportBody.appendChild(det);
    var body = det;
    renderRivalReport(report, body);
    var multi = report.lineReports.length > 1;
    report.lineReports.forEach(function (lr) {
      var block = document.createElement('div'); block.className = 'report-lineage';
      if (multi) {
        var head = document.createElement('div'); head.className = 'report-lineage-head';
        head.innerHTML = (lr.alive ? nicheIcon(lr.niche) + ' ' : ico('ui:bone', '🦴') + ' ') + escapeHtml(lr.name) +
          (lr.diet ? ' <span class="rival-tag">' + escapeHtml(DATA.DIETS[lr.diet].label.toLowerCase()) + '</span>' : '');
        block.appendChild(head);
      }
      lr.events.forEach(function (txt) {
        var d = document.createElement('div'); d.className = 'report-event';
        if (lr.catHit && /^Katastrofa/.test(txt)) d.className += ' danger';
        d.textContent = txt; block.appendChild(d);
      });
      // Kolejność jak w animacji tury: drapieżniki → głód → narodziny → katastrofa.
      block.appendChild(line('Populacja', lr.popBefore + ' → ' + lr.popAfter, lr.popAfter >= lr.popBefore ? 'pos' : 'neg', 'ui:paw'));
      if (lr.predationDeaths > 0) block.appendChild(line('Straty od drapieżników', '-' + lr.predationDeaths, 'neg', 'know:predation'));
      if (lr.starvationDeaths > 0) block.appendChild(line('Straty z głodu', '-' + lr.starvationDeaths, 'neg', 'know:starvation'));
      if (lr.births > 0) block.appendChild(line('Narodziny', '+' + lr.births, 'pos', 'ui:sprout'));
      if (lr.diseaseDeaths > 0) block.appendChild(line('Straty z choroby', '-' + lr.diseaseDeaths, 'neg'));
      if (lr.crowdDeaths > 0) block.appendChild(line('Straty z przegęszczenia', '-' + lr.crowdDeaths, 'neg'));
      if (lr.capacity) block.appendChild(line(lr.diet === 'miesozerca' ? 'Zdobycz (drapieżniki / pojemność)' : 'Pojemność niszy (zajęta / całkowita)', lr.nicheLoad + ' / ' + lr.capacity,
        lr.nicheLoad >= lr.capacity * DATA.CAPACITY.warnAt ? 'neg' : 'plain'));
      if (lr.rivalLoad) block.appendChild(line('w tym konkurenci', lr.rivalLoad, 'plain'));
      if (lr.diet === 'miesozerca') block.appendChild(line('Biomasa roślinożerców (zdobycz)', lr.preyBiomass, 'plain'));
      if (lr.catDeaths > 0) block.appendChild(line('Straty w katastrofie', '-' + lr.catDeaths, 'neg', 'ui:meteor'));
      if (lr.reservesBefore != null) {
        block.appendChild(line(ENERGY + ' Rezerwy energii', num(lr.reservesBefore) + ' → ' + num(lr.reservesAfter),
          lr.reservesAfter >= lr.reservesBefore ? 'pos' : 'neg'));
        block.appendChild(line(GENE + ' Zmienność genetyczna', String(lr.variationAfter), 'plain'));
      }
      block.appendChild(line('Inteligencja', lr.intelligence + ' / ' + report.intelligenceGoal, 'plain', 'trait:brain'));
      if (lr.epGain > 0) {
        var ep = document.createElement('div'); ep.className = 'report-epbreak';
        ep.innerHTML = '<span>Premia za niszę: <strong>+' + lr.epBreakdown.niche + ' EP</strong></span>';
        block.appendChild(ep);
      }
      body.appendChild(block);
    });
    var sum = document.createElement('div'); sum.className = 'report-summary';
    sum.appendChild(line('Łączna populacja', report.totalPopulation, 'plain'));
    if (report.epPopulation) sum.appendChild(line('EP za liczebność (wszystkie linie)', '+' + report.epPopulation, 'pos'));
    if (report.epGrowth) sum.appendChild(line('EP za wzrost populacji', '+' + report.epGrowth, 'pos'));
    if (report.epBase) sum.appendChild(line('Premia bazowa za przetrwanie', '+' + report.epBase, 'pos'));
    if (report.epIntel) sum.appendChild(line('Premia za inteligencję (najlepsza linia)', '+' + report.epIntel, 'pos'));
    if (report.epRadiation) sum.appendChild(line('Premia za różnorodność nisz (radiacja)', '+' + report.epRadiation, 'pos'));
    if (report.epPerk) sum.appendChild(line('Przywilej „Stały dopływ”', '+' + report.epPerk, 'pos'));
    (report.goals || []).forEach(function (g) {
      sum.appendChild(line((g.status === 'done' ? ico('ui:check', '✓') + ' Kontrakt: ' : ico('ui:close', '✗') + ' Kontrakt nieosiągnięty: ') + escapeHtml(g.label),
        g.status === 'done' ? '+' + g.reward : '—', g.status === 'done' ? 'pos' : 'neg'));
    });
    sum.appendChild(line('Zdobyte punkty ewolucji (razem)', '+' + report.epGain, 'pos'));
    var pd = report.predatorDelta || 0;
    if (report.predatorLevel > 2 && Math.abs(pd) >= 0.3) {
      sum.appendChild(line('Presja drapieżników (koewolucja)', (pd > 0 ? '↑ ' : '↓ ') + num(report.predatorLevel) +
        ' (' + (pd > 0 ? '+' : '') + num(pd) + ')', pd > 0 ? 'neg' : 'pos'));
    }
    body.appendChild(sum);

    // Wiedza: najwyżej jedna nowa karta w raporcie, reszta czeka w Kodeksie (plakietka „nowe”).
    el.reportKnowledge.innerHTML = '';
    var fresh = rankKnowledge((report.newKnowledge || report.knowledge).filter(function (k) { return DATA.KNOWLEDGE[k]; }));
    // Kolejka: pojęcia odkryte naraz pokazujemy po jednym w kolejnych raportach.
    var queue = (state.codexQueue || []).filter(function (k) { return fresh.indexOf(k) === -1; });
    var showKey = fresh.length ? fresh[0] : (queue.length ? queue.shift() : null);
    state.codexQueue = queue.concat(fresh.slice(1));
    state.codexNew = (state.codexNew || []).concat(fresh.slice(1)).filter(function (k, i, a) { return k !== showKey && a.indexOf(k) === i; });
    if (showKey) {
      var card = knowledgeCard(showKey, DATA.KNOWLEDGE[showKey]); card.classList.add('is-new');
      el.reportKnowledge.appendChild(card);
    }
    if ((state.codexNew || []).length) {
      var more = document.createElement('p'); more.className = 'knowledge-more';
      more.innerHTML = ico('ui:book', '📚') + ' W Kodeksie czeka ' + state.codexNew.length + ' ' + plural(state.codexNew.length, 'nowe pojęcie', 'nowe pojęcia', 'nowych pojęć') + '.';
      el.reportKnowledge.appendChild(more);
    }
    save(); updateCodexBadge();

    el.btnReportClose.textContent = (state.status === 'playing') ? T('report.next') : T('report.summary');
    openModal(el.modalReport);
    el.btnReportClose.focus();
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
    var eraRep = pendingEraReport; pendingEraReport = null;
    if (state.status !== 'playing') { showEnd(); return; }
    if (eraRep) showEraInterlude(eraRep);
    maybeShowOutlook();
    if (state.lowChancePending) maybeLowChance();
  }
  // Uczciwy sygnał: gdy zwycięstwo jest już niemożliwe, gra mówi to od razu (raz na partię).
  function maybeShowOutlook() {
    if (state.outlookSeen || isSandbox()) return;
    var o = Engine.victoryOutlook(DATA, state);
    if (o.possible) return;
    el.outlookTitle.textContent = 'Tej partii nie da się już wygrać';
    el.outlookLead.textContent = 'Nawet przy najlepszym możliwym przebiegu do końca gry:';
    el.outlookReasons.innerHTML = o.reasons.map(function (r) { return '<li>' + escapeHtml(r) + '</li>'; }).join('');
    el.outlookLegacy.innerHTML = '<p><strong>Inne drogi do sukcesu</strong> — tytuł przetrwania na koniec partii daje punkty:</p><div class="legacy-panel">' + legacyChips() + '</div>';
    el.outlookTail.textContent = 'Możesz grać dalej o przetrwanie gatunku i tytuł, cofnąć ostatnią turę albo zakończyć partię teraz.';
    el.btnOutlookContinue.textContent = 'Graj dalej o przetrwanie';
    el.btnOutlookUndo.hidden = !undoStack.length;
    openModal(el.modalOutlook);
  }
  // ===================== Szansa na rozum (szacunek z symulacji) =====================
  var chance = null, chanceKey = null, CHANCE_RUNS = 12;
  // Szacunek liczony raz na turę (na jej początku); zakupy w trakcie tury go nie zmieniają.
  function chanceStateKey() { return state ? (state.seed || '') + ':' + state.history.length + ':' + state.status : ''; }
  /* Wartość pokazywana: surowy odsetek wygranych symulacji, na początku gry ściągnięty ku
     średniej (wczesne symulacje są mniej pewne — tak wyszło w kalibracji na botach). */
  function calibrate(raw) {
    var left = Engine.totalTurns(DATA) - Engine.elapsedTurns(DATA, state);
    var k = 0.4 * Math.max(0, Math.min(1, (left - 8) / 10));
    return raw * (1 - k) + 0.6 * k;
  }
  function startChance() {
    if (!Advisor || !state || state.status !== 'playing' || isSandbox()) { chance = null; renderChance(); return; }
    var key = chanceStateKey();
    if (chanceKey === key) return;
    chanceKey = key;
    var job = Advisor.job(DATA, Engine, state, CHANCE_RUNS);
    function tick() {
      if (chanceKey !== key || !state) return;
      var t0 = Date.now();
      while (Date.now() - t0 < 10) { if (job.step()) break; }
      var r = job.result();
      if (!r.done) { setTimeout(tick, 30); return; }
      var possible = Engine.victoryOutlook(DATA, state).possible;
      chance = { key: key, raw: possible ? r.chance : 0, value: possible ? calibrate(r.chance) : 0 };
      var t = Engine.elapsedTurns(DATA, state);
      state.chanceHist = (state.chanceHist || []).filter(function (h) { return h.t < t; }).concat([{ t: t, raw: chance.raw, v: chance.value }]).slice(-8);
      save(); renderChance(); renderLegacy(); maybeLowChance();
    }
    renderChance();
    setTimeout(tick, 80);
  }
  function renderChance() {
    if (!el.statusChance) return;
    var on = !!(Advisor && state && state.status === 'playing' && !isSandbox());
    el.statusChance.hidden = !on;
    if (!on) return;
    if (!chance || chance.key !== chanceStateKey()) { el.chanceValue.textContent = '…'; el.chanceSub.textContent = 'liczę…'; return; }
    var v = Math.round(chance.value * 20) * 5, h = state.chanceHist || [], prev = h.length > 1 ? h[h.length - 2].v : null;
    var tr = prev == null ? '' : (chance.value - prev > 0.04 ? ' ↑' : (prev - chance.value > 0.04 ? ' ↓' : ''));
    el.chanceValue.textContent = '≈' + v + '%' + tr;
    el.chanceSub.textContent = v < 10 ? 'bardzo mała' : (v < 30 ? 'mała' : (v < 55 ? 'średnia' : (v < 80 ? 'duża' : 'bardzo duża')));
    el.statusChance.dataset.level = v < 10 ? 'low' : (v < 55 ? 'mid' : 'high');
  }
  // Uczciwy sygnał wcześniej: dwa szacunki z rzędu poniżej ok. 9% (od 6. tury) — gra mówi to wprost (raz na partię).
  function maybeLowChance() {
    if (!state || state.lowChanceSeen || state.outlookSeen || state.status !== 'playing' || isSandbox()) return;
    var h = state.chanceHist || [];
    if (h.length < 2 || Engine.elapsedTurns(DATA, state) < 6) return;
    if (!(h[h.length - 1].raw < 0.09 && h[h.length - 2].raw < 0.09)) return;
    if (!el.modalReport.hidden || !el.modalOutlook.hidden) { state.lowChancePending = true; return; }
    state.lowChanceSeen = true; state.lowChancePending = false; save();
    el.outlookTitle.textContent = 'Szanse na rozum są bardzo małe';
    el.outlookLead.textContent = 'Symulacje reszty partii (' + CHANCE_RUNS + ' przebiegów w różnych wariantach przyszłego świata) tylko wyjątkowo kończą się narodzinami rozumu: ≈' +
      Math.round(chance.value * 20) * 5 + '%. To szacunek, nie wyrok.';
    el.outlookReasons.innerHTML = '';
    el.outlookLegacy.innerHTML = '<p><strong>Inne drogi do sukcesu</strong> — tytuł przetrwania na koniec partii daje punkty:</p><div class="legacy-panel">' + legacyChips() + '</div>';
    el.outlookTail.textContent = 'Możesz walczyć dalej o rozum albo o tytuł przetrwania, cofnąć ostatnią turę albo zakończyć partię teraz.';
    el.btnOutlookContinue.textContent = 'Graj dalej';
    el.btnOutlookUndo.hidden = !undoStack.length;
    openModal(el.modalOutlook);
  }
  function onOutlookContinue() {
    if (!Engine.victoryOutlook(DATA, state).possible) state.outlookSeen = true;
    save(); closeModal(el.modalOutlook); renderStatus(); renderLegacy();
  }
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
    chanceKey = null;
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
        ? 'Twoja linia osiągnęła próg inteligencji i ma kulturę, ale gatunek jest zbyt nieliczny (potrzeba ' + DATA.WIN_LINE_MIN + ' osobników w linii rozumnej i ' + DATA.WIN_MIN_POP + ' w całym gatunku), by dać początek kulturze. Rozum to za mało — potrzebny jest też żywotny gatunek.'
        : s === 'survived'
        ? 'Twoje linie przetrwały ' + eraList(Engine.playedEras(DATA, state)) + ', ale żadna nie rozwinęła dostatecznie mózgu. Dobre przetrwanie to nie to samo co droga do rozumności — spróbuj skupić się na ścieżce oznaczonej gwiazdką.'
        : state.endReason === 'nonviable'
        ? 'Na koniec gry żadna linia nie liczyła choćby ' + DATA.MIN_VIABLE_POP + ' osobników. Tak mała populacja jest skazana na wymarcie (słaby rozród, chów wsobny) — dbaj o bilans energii i liczebność, nie tylko o cechy.'
        : 'Wszystkie linie rozwojowe wymarły. W ewolucji większość linii wymiera — dywersyfikuj (specjacja, różne nisze) i lepiej dostosuj adaptacje do nadchodzących katastrof.';
    var hero = featuredLineage(s);
    el.endLatin.innerHTML = hero ? '<em>' + escapeHtml(Engine.latinName(DATA, hero, state)) + '</em>' : '';
    if (state.trial && state.trial.option) {
      el.endTrial.hidden = false;
      el.endTrial.innerHTML = ico(state.trial.path === 'sound' ? 'trait:vocal_culture' : 'trait:tool_use', '🔥') + ' Próba rozumu: „' + escapeHtml(state.trial.option) + '”' +
        (state.trial.won ? ' — udana!' : '');
    } else el.endTrial.hidden = true;
    if (isSandbox()) {
      el.endTitle.textContent = 'Koniec eksperymentu';
      el.endSummary.textContent = 'Tryb otwarty: bez celu i bez zapisu wyniku. Zobacz, dokąd zaprowadziły Twoje wybory — i spróbuj innych.';
    }
    renderEndAnthro();
    var ep = Engine.epilogue(DATA, state);
    if (el.endEpilogue) {
      el.endEpilogue.hidden = !ep;
      el.endEpilogue.innerHTML = ep ? '<h2>' + escapeHtml(ep.title) + '</h2>' +
        ep.paragraphs.map(function (t) { return '<p>' + escapeHtml(t) + '</p>'; }).join('') : '';
    }
    el.endStats.innerHTML = '';
    if ((state.prologue || []).length) endStat('Prolog (prekambr)', escapeHtml(Engine.prologueLabels(DATA, state).join(' → ')));
    endStat('Status', s === 'won' ? 'Zwycięstwo' : (s === 'survived' ? 'Przetrwanie' : 'Wymarcie'));
    endStat('Liczba linii rozwojowych', state.lineages.length);
    if (state.rivalsDisplaced) endStat('Wyparci konkurenci', state.rivalsDisplaced);
    endStat('Szczytowa łączna populacja', state.lineages.reduce(function (a, l) { return a + l.peakPopulation; }, 0));
    endStat('Najwyższa inteligencja', Engine.maxIntelligence(state) + ' / ' + state.intelligenceGoal);
    endStat('Odkryte pojęcia w Kodeksie', state.unlockedKnowledge.length);
    var goalsAll = state.eraGoals || [];
    if (goalsAll.length) endStat('Kontrakty er', goalsAll.filter(function (g) { return g.status === 'done'; }).length + ' / ' + goalsAll.length);
    if (state.seed) endStat('Kod świata', escapeHtml(state.seed));
    renderEndScore();
    renderChronicle();
    showScreen('end');
    renderEndStory(s);
    saveToMuseum();
    window.scrollTo(0, 0);
  }
  function renderChronicle() {
    if (!el.endChronicle) return;
    el.endChronicle.innerHTML = Engine.chronicle(DATA, state).map(function (c) {
      return '<li><span class="chr-turn">' + (c.turn ? 'Tura ' + c.turn + ' · ' : '') + escapeHtml(c.title) + '</span> ' + escapeHtml(c.text) + '</li>';
    }).join('');
  }
  // ===================== Muzeum gatunków =====================
  function endingLabel(st) {
    if (st.status === 'won') return 'Narodziny rozumu' + (st.anthropocene && st.anthropocene.verdict ? ' · ' + verdictOf(st.anthropocene).title : '');
    if (st.status === 'survived') { var lg = Engine.legacyTitle(DATA, st); return lg ? 'Przetrwanie: ' + lg.title : 'Przetrwanie'; }
    return 'Wymarcie';
  }
  function museumLineage(e) { return { id: 'M' + e.id, name: e.name, traits: e.traits || [], niche: e.niche || 'woda', bodyPlan: e.bodyPlan }; }
  // Wpis do Muzeum (raz na partię; tryb otwarty też — to pamiątka, choć bez wyniku). Aktualizuje się po epilogu.
  function saveToMuseum() {
    var hero = featuredLineage(state.status); if (!hero) return;
    var sc = scenarioById(state.scenario), score = isSandbox() ? 0 : Engine.scoreGame(DATA, state).total;
    var entry = {
      id: state.museumId || Date.now(), date: new Date().toISOString().slice(0, 10), name: hero.name,
      latin: Engine.latinName(DATA, hero, state), scenario: state.scenario, scenarioName: sc ? sc.name : state.scenario,
      difficulty: state.difficulty, seed: state.seed, status: state.status, ending: endingLabel(state), score: score,
      bodyPlan: hero.bodyPlan, traits: hero.traits.slice(), niche: hero.niche, intelligence: hero.stats.intelligence,
      lineages: state.lineages.length, mods: (state.rules && state.rules.mods) || [], daily: !!state.daily, sandbox: isSandbox()
    };
    var list = museum().filter(function (x) { return x.id !== entry.id; });
    list.unshift(entry);
    // Limit: najstarsze nieulubione wypadają.
    while (list.length > MUSEUM_MAX) {
      var idx = -1; for (var i = list.length - 1; i >= 0; i--) if (!list[i].fav) { idx = i; break; }
      if (idx < 0) break; list.splice(idx, 1);
    }
    writeJson(MUSEUM_KEY, list);
    state.museumId = entry.id;
  }
  function showMuseum(detailId) {
    var list = museum();
    el.museumBody.innerHTML = '';
    if (!list.length) { el.museumBody.innerHTML = '<p class="codex-empty">Muzeum jest puste — każda ukończona partia zostawi tu rycinę gatunku.</p>'; openModal(el.modalMuseum); return; }
    var e = detailId != null ? list.filter(function (x) { return x.id === detailId; })[0] : null;
    if (e) { renderMuseumDetail(e); if (el.modalMuseum.hidden) openModal(el.modalMuseum); return; }
    var grid = document.createElement('div'); grid.className = 'museum-grid';
    list.forEach(function (x) {
      var th = (ART && ART.creature) ? ART.creature.thumb(museumLineage(x), 180, 100) : '';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'museum-card status-' + x.status + (x.fav ? ' fav' : '');
      b.innerHTML = (th ? '<img alt="" src="' + th + '">' : '') + '<strong>' + escapeHtml(x.name) + (x.fav ? ' ★' : '') + '</strong>' +
        '<em>' + escapeHtml(x.latin || '') + '</em><span>' + escapeHtml(x.ending) + '</span><small>' + (x.sandbox ? 'tryb otwarty' : x.score + ' pkt') +
        ' · ' + escapeHtml(x.date) + (x.daily ? ' · świat dnia' : '') + '</small>';
      b.addEventListener('click', function () { showMuseum(x.id); });
      grid.appendChild(b);
    });
    el.museumBody.appendChild(grid);
    if (el.modalMuseum.hidden) openModal(el.modalMuseum);
  }
  function renderMuseumDetail(e) {
    var th = (ART && ART.creature) ? ART.creature.thumb(museumLineage(e), 420, 230) : '';
    var plan = DATA.BODY_PLANS[e.bodyPlan] || DATA.BODY_PLANS.kregowiec;
    var mods = (e.mods || []).map(function (m) { return DATA.WORLD_MODS[m] ? DATA.WORLD_MODS[m].label : m; });
    el.museumBody.innerHTML = '<button type="button" class="btn btn-ghost museum-back">← Wszystkie gatunki</button>' +
      '<div class="museum-detail">' + (th ? '<img alt="Rycina gatunku ' + escapeHtml(e.name) + '" src="' + th + '">' : '') +
      '<div><h3>' + escapeHtml(e.name) + '</h3><p class="end-latin"><em>' + escapeHtml(e.latin || '') + '</em></p>' +
      '<p><strong>' + escapeHtml(e.ending) + '</strong>' + (e.sandbox ? '' : ' · ' + e.score + ' pkt') + '</p>' +
      '<ul class="museum-facts"><li>Scenariusz: ' + escapeHtml(e.scenarioName || e.scenario) + ' (' + escapeHtml((DATA.DIFFICULTIES[e.difficulty] || {}).label || e.difficulty) + ')</li>' +
      '<li>Plan budowy: ' + escapeHtml(plan.label) + '</li><li>Nisza: ' + escapeHtml(nicheLabel(e.niche)) + ' · inteligencja ' + e.intelligence + ' · linii: ' + e.lineages + '</li>' +
      '<li>Kod świata: <code>' + escapeHtml(e.seed || '—') + '</code>' + (mods.length ? ' · ' + escapeHtml(mods.join(', ')) : '') + '</li>' +
      '<li>Data: ' + escapeHtml(e.date) + '</li><li>Cechy: ' + escapeHtml(e.traits.map(traitName).join(', ') || 'brak') + '</li></ul>' +
      '<div class="modal-actions"><button type="button" class="btn btn-primary" data-act="replay">Zagraj ten świat jeszcze raz</button>' +
      '<button type="button" class="btn btn-ghost" data-act="png">Pobierz tablicę (PNG)</button>' +
      '<button type="button" class="btn btn-ghost" data-act="fav">' + (e.fav ? '☆ Usuń z ulubionych' : '★ Ulubiony') + '</button>' +
      '<button type="button" class="btn btn-ghost" data-act="del">Usuń</button></div></div></div>';
    el.museumBody.querySelector('.museum-back').addEventListener('click', function () { showMuseum(); });
    Array.prototype.forEach.call(el.museumBody.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-act'), list = museum();
        if (act === 'replay') {
          closeModal(el.modalMuseum);
          if (state && state.status === 'playing') { openConfirm('Rozpocząć nową grę w tym świecie? Bieżący postęp zostanie utracony.', function () { replayMuseum(e); }); return; }
          replayMuseum(e);
        } else if (act === 'png') downloadPlate(museumLineage(e), { name: e.name, latin: e.latin, ending: e.ending, score: e.sandbox ? null : e.score, seed: e.seed, date: e.date, scenario: e.scenarioName });
        else if (act === 'fav') { list.forEach(function (x) { if (x.id === e.id) x.fav = !x.fav; }); writeJson(MUSEUM_KEY, list); showMuseum(e.id); }
        else if (act === 'del') {
          openConfirm('Usunąć „' + e.name + '” z Muzeum?', function () { writeJson(MUSEUM_KEY, museum().filter(function (x) { return x.id !== e.id; })); showMuseum(); if (!el.screenStart.hidden) renderStartHub(); });
        }
      });
    });
  }
  function replayMuseum(e) {
    var sc = scenarioById(e.scenario) || DATA.SCENARIOS[0];
    el.speciesInput.value = e.name;
    showScreen('start');
    startScenario(sc, { seed: e.seed, bodyPlan: e.bodyPlan, mods: e.mods || [] });
  }
  // ===================== Tablica do pobrania (PNG) =====================
  function cssVar(name, def) { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || def; }
  function downloadPlate(lin, info) {
    if (!ART || !ART.creature) { flash('Rysunek niedostępny.'); return; }
    var W = 1200, H = 860, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); if (!g) return;
    var paper = cssVar('--bg-panel', '#fbf8f0'), ink = cssVar('--ink', '#2c261e'), soft = cssVar('--ink-soft', '#6b6155'), line = cssVar('--line-strong', '#b9a98a');
    var serif = '"Source Serif 4 Variable", Georgia, serif';
    g.fillStyle = paper; g.fillRect(0, 0, W, H);
    g.strokeStyle = line; g.lineWidth = 3; g.strokeRect(24, 24, W - 48, H - 48); g.lineWidth = 1; g.strokeRect(36, 36, W - 72, H - 72);
    g.fillStyle = soft; g.textAlign = 'center'; g.font = '600 20px ' + serif; g.fillText('E W O L U C J A   ·   T A B L I C A', W / 2, 92);
    g.fillStyle = ink; g.font = '700 54px ' + serif; g.fillText(info.name, W / 2, 160);
    g.font = 'italic 32px ' + serif; g.fillStyle = soft; g.fillText(info.latin || '', W / 2, 204);
    var img = new Image();
    img.onload = function () {
      g.drawImage(img, (W - 900) / 2, 230, 900, 480);
      g.fillStyle = ink; g.font = '600 28px ' + serif; g.fillText(info.ending + (info.score != null ? '  ·  ' + info.score + ' pkt' : ''), W / 2, 760);
      g.fillStyle = soft; g.font = '20px ' + serif;
      g.fillText([info.scenario, info.seed ? 'kod świata ' + info.seed : '', info.date].filter(Boolean).join('  ·  '), W / 2, 800);
      try {
        c.toBlob(function (blob) {
          if (!blob) { flash('Nie udało się zapisać obrazka.'); return; }
          var url = URL.createObjectURL(blob), a = document.createElement('a');
          a.href = url; a.download = 'ewolucja-' + (info.name || 'gatunek').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-') + '.png';
          document.body.appendChild(a); a.click();
          setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
        }, 'image/png');
      } catch (err) { flash('Pobieranie zablokowane przez przeglądarkę.'); }
    };
    img.src = ART.creature.thumb(lin, 900, 480);
  }
  // Wynik punktowy, rekord scenariusza i osiągnięcia (zapisywane między partiami).
  // Co odblokowują odznaki (scenariusze, plany budowy, modyfikatory) — do porównania przed/po partii.
  function unlockedSet() {
    var out = [];
    DATA.SCENARIOS.forEach(function (x) { if (x.unlock && isUnlocked(x.unlock)) out.push('scenariusz „' + x.name + '”'); });
    Object.keys(DATA.BODY_PLANS).forEach(function (k) { var p = DATA.BODY_PLANS[k]; if (p.unlock && isUnlocked(p.unlock)) out.push('plan budowy „' + p.label + '”'); });
    Object.keys(DATA.WORLD_MODS).forEach(function (k) { var m = DATA.WORLD_MODS[k]; if (m.unlock && isUnlocked(m.unlock)) out.push('modyfikator „' + m.label + '”'); });
    return out;
  }
  var NEXT_ACH = ['first_win', 'sound_win', 'tools_win', 'early_win', 'trial', 'perm', 'breeder', 'oddity', 'legacy', 'sky', 'daily',
    'gause', 'echo', 'radiation', 'web', 'gambler', 'goals', 'abundance', 'codex', 'phoenix', 'hard_win', 'steward'];
  function achItem(a, got, ever, isNew, prog, next) {
    return '<li class="ach ' + (got ? 'got' : (ever ? 'ever' : (next ? 'next' : 'locked'))) + '" title="' + escapeHtml(a.desc) + '">' +
      '<span class="ach-icon" aria-hidden="true">' + a.icon + '</span><span class="ach-text"><strong>' + escapeHtml(a.label) + '</strong>' +
      '<small>' + escapeHtml(a.desc) + (prog ? ' (w tej partii: ' + prog.cur + ' / ' + prog.max + ')' : '') + '</small></span>' +
      (isNew ? '<em class="ach-new">nowe!</em>' : (got ? '<em class="ach-got">w tej partii</em>' : '')) + '</li>';
  }
  function renderEndScore() {
    var sb = isSandbox();
    var sc = Engine.scoreGame(DATA, state), bestKey = state.scenario + '/' + state.difficulty;
    var best = readJson(BEST_KEY, {}), prevBest = best[bestKey] || 0, record = !sb && sc.total > prevBest;
    var unlockBefore = unlockedSet();
    // Zapis idempotentny: po epilogu (ponowne wyświetlenie) dopisuje tylko to, co nowe.
    if (record) { best[bestKey] = sc.total; writeJson(BEST_KEY, best); }
    var daily = (state.daily && !sb) ? recordDaily(sc.total) : null;
    el.endScoreTotal.innerHTML = sb ? '<span class="end-score-best">Tryb otwarty — wynik nie jest liczony ani zapisywany.</span>' :
      '<strong>' + sc.total + '</strong> pkt' +
      (sc.mult !== 1 ? ' <span class="end-score-mult">(' + sc.subtotal + ' × ' + num(sc.mult) + ' za poziom i świat)</span>' : '') +
      (record && prevBest > 0 ? ' <span class="end-score-record">Nowy rekord!</span>'
        : (prevBest > 0 ? ' <span class="end-score-best">Rekord: ' + prevBest + '</span>'
          : ' <span class="end-score-best">Pierwszy wynik w tym scenariuszu</span>')) +
      (daily ? ' <span class="end-score-best">Świat dnia: passa ' + daily.streak + ' ' + plural(daily.streak, 'dzień', 'dni', 'dni') + '</span>' : '');
    el.endScoreParts.innerHTML = sb ? '' : sc.parts.map(function (p) {
      return '<li><span>' + escapeHtml(p.label) + '</span><strong>+' + p.points + '</strong></li>';
    }).join('');
    var earned = sb ? [] : Engine.earnedAchievements(DATA, state), owned = ownedAchievements();
    var fresh = earned.filter(function (id) { return owned.indexOf(id) === -1; });
    if (!sb && fresh.length) writeJson(ACH_KEY, owned.concat(fresh));
    state.scoreSaved = true;
    var all = ownedAchievements(), prog = Engine.achievementProgress(DATA, state);
    var progOf = function (id) { return prog.filter(function (x) { return x.id === id; })[0]; };
    // Zdobyte w tej partii (najpierw nowe).
    var mine = DATA.ACHIEVEMENTS.filter(function (a) { return earned.indexOf(a.id) !== -1; })
      .sort(function (a, b) { return (fresh.indexOf(b.id) !== -1) - (fresh.indexOf(a.id) !== -1); });
    el.endAch.innerHTML = mine.length ? mine.map(function (a) { return achItem(a, true, true, fresh.indexOf(a.id) !== -1, null); }).join('')
      : '<li class="ach-none">W tej partii bez nowych odznak' + (sb ? ' (tryb otwarty)' : '') + '.</li>';
    // Propozycje na następną partię: odznaki, których jeszcze nie masz.
    var next = NEXT_ACH.map(achDef).filter(function (a) { return a && all.indexOf(a.id) === -1; }).slice(0, 3);
    var unlockAfter = unlockedSet().filter(function (x) { return unlockBefore.indexOf(x) === -1; });
    el.endAchNext.innerHTML = (unlockAfter.length ? '<p class="ach-unlocked">' + ico('ui:check', '✓') + ' <strong>Odblokowano:</strong> ' + escapeHtml(unlockAfter.join(', ')) + '</p>' : '') +
      (next.length ? '<h3>Spróbuj następnym razem</h3><ul class="ach-list ach-next-list">' + next.map(function (a) { return achItem(a, false, false, false, progOf(a.id), true); }).join('') + '</ul>' : '');
    el.endAchAllTitle.textContent = 'Wszystkie osiągnięcia (' + all.length + ' / ' + DATA.ACHIEVEMENTS.length + ')';
    el.endAchAll.innerHTML = DATA.ACHIEVEMENTS.map(function (a) {
      return achItem(a, earned.indexOf(a.id) !== -1, all.indexOf(a.id) !== -1, false, null);
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
      'Epilog Antropocen: ' + (state.anthropocene && state.anthropocene.done ? verdictOf(state.anthropocene).title + ' (rozwój ' + state.anthropocene.tech + ', biosfera ' + state.anthropocene.bio + ')' : 'nierozegrany'),
      'Prolog (prekambr): ' + ((state.prologue || []).length ? Engine.prologueLabels(DATA, state).join(' → ') : 'pominięty'),
      'Punkty: ' + Engine.scoreGame(DATA, state).total,
      'Cele er: ' + (state.eraGoals || []).map(function (g) { var d = Engine.goalDef(DATA, g.id); return (d ? d.label : g.id) + ' (' + (g.status === 'done' ? 'spełniony' : g.status === 'failed' ? 'nie' : 'otwarty') + ')'; }).join('; '),
      'Osiągnięcia: ' + (Engine.earnedAchievements(DATA, state).map(function (id) { var a = DATA.ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0]; return a ? a.label : id; }).join(', ') || 'brak'),
      'Najwyższa inteligencja: ' + Engine.maxIntelligence(state) + ' / ' + state.intelligenceGoal,
      'Liczba linii rozwojowych: ' + state.lineages.length,
      'Szczytowa łączna populacja: ' + state.lineages.reduce(function (a, l) { return a + l.peakPopulation; }, 0),
      'Odkryte pojęcia w Kodeksie: ' + state.unlockedKnowledge.length,
      'Plan budowy: ' + ((DATA.BODY_PLANS[state.lineages[0].bodyPlan] || {}).label || '—'),
      'Modyfikatory świata: ' + (((state.rules && state.rules.mods) || []).map(function (m) { return DATA.WORLD_MODS[m] ? DATA.WORLD_MODS[m].label : m; }).join(', ') || 'brak'),
      'Przywileje z kontraktów: ' + (Engine.perkList(DATA, state).map(function (p) { return p.label; }).join(', ') || 'brak'),
      'Próba rozumu: ' + (state.trial && state.trial.option ? state.trial.option + (state.trial.won ? ' (udana)' : '') : '—'),
      '', 'Linie rozwojowe:'];
    state.lineages.forEach(function (l) {
      L.push('  • ' + l.name + ' (' + Engine.latinName(DATA, l, state) + ') — ' + (l.alive ? 'żywa' : 'wymarła') +
        ', nisza: ' + DATA.NICHES[l.niche].label + ', dieta: ' + DATA.DIETS[Engine.dietOf(l)].label.toLowerCase() +
        ', inteligencja: ' + l.stats.intelligence +
        ', strategia: ' + (DATA.STRATEGIES[l.strategy] || DATA.STRATEGIES.zrownowazona).label +
        ', rezerwy: ' + num(l.reserves || 0) + ' ⚡, zmienność: ' + (l.variation || 0) + ' 🧬' +
        ', cechy: ' + (l.traits.length ? l.traits.map(traitName).join(', ') : 'brak') +
        ((l.variantsTaken || []).length ? ', warianty: ' + l.variantsTaken.map(function (v) { var d = Engine.variantDef(DATA, v); return d ? d.label : v; }).join(', ') : ''));
    });
    L.push('', 'Kronika gatunku:');
    Engine.chronicle(DATA, state).forEach(function (c) { L.push('  ' + (c.turn ? 'Tura ' + c.turn + ' (' + c.title + '): ' : '') + c.text); });
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
  // Kodeks trwały: wszystkie pojęcia odkryte w dowolnej partii; nieodkryte jako zarysy z podpowiedzią.
  function showCodex() {
    el.codexBody.innerHTML = '';
    var game = state ? state.unlockedKnowledge : [], known = knownCodex().concat(game), keys = Object.keys(DATA.KNOWLEDGE);
    var isNew = (state && state.codexNew) || [], got = keys.filter(function (k) { return known.indexOf(k) !== -1; });
    el.codexProgress.innerHTML = '<strong>Odkryto ' + got.length + ' / ' + keys.length + '</strong> pojęć' +
      (state ? ' · w tej partii: ' + game.length : '') +
      '<span class="codex-bar"><span style="width:' + Math.round(100 * got.length / keys.length) + '%"></span></span>';
    // Najpierw nowe, potem odkryte, na końcu zarysy nieodkrytych.
    var order = got.filter(function (k) { return isNew.indexOf(k) !== -1; }).concat(got.filter(function (k) { return isNew.indexOf(k) === -1; }));
    order.forEach(function (key) {
      var c = knowledgeCard(key, DATA.KNOWLEDGE[key]);
      if (isNew.indexOf(key) !== -1) c.classList.add('is-new');
      if (state && game.indexOf(key) !== -1) c.classList.add('in-game');
      el.codexBody.appendChild(c);
    });
    keys.filter(function (k) { return known.indexOf(k) === -1; }).forEach(function (key) {
      var d = document.createElement('div'); d.className = 'knowledge-card locked';
      d.innerHTML = '<span class="ico" aria-hidden="true">?</span><h4>Nieodkryte pojęcie</h4><p>' + escapeHtml((DATA.CODEX_HINTS || {})[key] || 'Graj dalej, by je odkryć.') + '</p>';
      el.codexBody.appendChild(d);
    });
    if (state) { state.codexNew = []; save(); }
    updateCodexBadge();
    openModal(el.modalCodex);
  }
  function updateCodexBadge() {
    var n = state && state.codexNew ? state.codexNew.length : 0;
    el.btnCodex.classList.toggle('has-new', n > 0);
    var lab = el.btnCodex.querySelector('.codex-new');
    if (!lab) { lab = document.createElement('span'); lab.className = 'codex-new'; el.btnCodex.appendChild(lab); }
    lab.textContent = n ? n + ' nowe' : '';
    lab.hidden = !n;
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
    { title: 'Witaj w Ewolucji!', text: 'Prowadzisz nie pojedyncze zwierzę, lecz całą populację. Twój cel: doprowadzić którąkolwiek linię do inteligencji ' + state.intelligenceGoal + ' i kultury (narzędzia na lądzie albo kultura akustyczna w wodzie) ' + span + ', utrzymując żywotny gatunek (co najmniej ' + DATA.WIN_MIN_POP + ' osobników we wszystkich liniach, w tym ' + DATA.WIN_LINE_MIN + ' w linii rozumnej).' },
    { title: 'Punkty ewolucji (EP)', text: 'Za przetrwanie i rozwój zdobywasz EP (u góry po lewej). Wydajesz je na trwałe cechy w panelu „Adaptacje” po prawej. Każda cecha ma koszt i kompromis.' },
    { title: 'Prognoza i kompromisy', text: 'Panel „Prognoza następnej tury” pokazuje, jak zmieni się populacja. Najedź na cechę, aby zobaczyć jej wpływ przed zakupem (co-jeśli).' },
    { title: 'Droga do celu', text: 'Cechy oznaczone {star} prowadzą do inteligencji: Zwoje → Mózg → Rozbudowany mózg → życie społeczne → kultura. Są dwie drogi: narzędzia (ręka chwytna; tylko na lądzie) albo kultura akustyczna (echolokacja; tylko w otwartej wodzie). Przybrzeże to etap przejściowy. Wygrywasz, gdy linia osiągnie próg inteligencji i kulturę (kenozoik), a gatunek jest żywotny. Uważaj: duży mózg zużywa dużo energii — kupiony za wcześnie może zagłodzić populację. Filtrowanie i szczęki wykluczają się: wybierasz sposób życia.' },
    { title: 'Rezerwy i zmienność', text: 'Każda linia ma dwie własne waluty. ⚡ Rezerwy energii to odłożone nadwyżki pokarmu — ratują przed głodem, płacisz nimi za migrację i zachowania w turze. 🧬 Zmienność genetyczna rośnie z liczebnością i znika w wąskim gardle — płacisz nią za specjację i ukierunkowany dobór (który kosztuje też część potomstwa), a wysoka łagodzi katastrofy.' },
    { title: 'Decyzje linii', text: 'W panelu „Decyzje linii” wybierasz strategię rozrodu (r — dużo potomstwa, K — mało, ale dobrze chronionego) i zachowanie w najbliższej turze. Najedź na przycisk, by zobaczyć skutek w prognozie. Czasem pojawi się karta decyzji — zdarzenie, na które odpowiadasz przed turą.' },
    { title: 'Każda tura to wybór', text: 'W turach bez karty w puli genów krążą losowe warianty — wskaż, który ma utrwalić dobór (kosztuje 🧬), albo zostaw to dryfowi. Na początku każdej ery wybierasz kontrakt: cel z nagrodą i przywilejem na resztę gry. U góry „Szansa na rozum” pokazuje szacunek z symulacji reszty partii. Skróty: Spacja — tura, 1–3 — wybór opcji, K — Kodeks, D — drzewo życia.' },
    { title: 'Specjacja i nisze', text: 'Możesz rozdzielić linię (Specjacja, płatna zmiennością 🧬) i wysłać gałąź do innej niszy: {woda} woda, {przybrzeze} przybrzeże, {lad} ląd (wymaga kończyn), {powietrze} powietrze (wymaga lotu). Każda nisza wyżywi ograniczoną liczbę osobników (pojemność) — gdy jest pełna, nowa gałąź w wolnej niszy daje nowe zasoby, a linie w jednej niszy konkurują. Wymierania {meteor} uderzają w nisze różnie, a gatunek obecny w kilku niszach traci w każdej katastrofie mniej (szeroki zasięg). Do zwycięstwa liczy się cały gatunek, a gałąź zdobywa cechy linii pokrewnej taniej (ewolucja równoległa). Migracja kosztuje rezerwy ⚡ i turę aklimatyzacji.' }
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
  // Komunikat o błędzie akcji: osobny komunikat (czytnik ekranu go ogłosi), przycisk tury bez zmian.
  function flash(msg) { toast(ico('ui:close', '✗') + ' ' + escapeHtml(msg), 'warn'); }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var confirmCallback = null;
  function openConfirm(msg, cb) { el.confirmMessage.textContent = msg; confirmCallback = cb; openModal(el.modalConfirm); }
  function resolveConfirm(yes) { closeModal(el.modalConfirm); var cb = confirmCallback; confirmCallback = null; if (yes && cb) cb(); }

  // ===================== Inicjalizacja =====================
  function init() {
    window.GameI18n.applyStatic(document);
    initStickyStatus();
    el.introGoal.innerHTML = ico('ui:target', '🎯') + ' <strong>Cel:</strong> doprowadź którąkolwiek linię do progu inteligencji i kultury — narzędzi na lądzie albo kultury akustycznej w wodzie — ' +
      'utrzymując żywotny gatunek (co najmniej ' + DATA.WIN_MIN_POP + ' osobników), przez ery (' + DATA.ERAS.map(function (e) { return e.name; }).join(', ') + '). ' +
      'Rozwijaj układ nerwowy (' + ico('ui:star', '⭐', 'ico-star') + '), rozkładaj ryzyko przez specjację i nisze, przetrwaj wymierania masowe. ' +
      'Wybierz scenariusz poniżej — różnią się trudnością i punktem startu.';

    renderStart();
    if (ART && ART.diorama && el.startDiorama) {
      ART.diorama.update(el.startDiorama, {
        era: 'paleozoik', niche: 'woda', climate: 'cieplo', food: 12, predators: 6,
        lineages: [{ id: 'start', name: 'Prazwierzę', traits: [], niche: 'woda', population: 160, active: true }]
      });
    } else if (el.startDiorama) el.startDiorama.hidden = true;
    // Enter w polu nazwy startuje domyślny scenariusz (pełna ewolucja).
    el.formStart.addEventListener('submit', function (e) {
      e.preventDefault();
      startScenario(DATA.SCENARIOS[0]);
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
      o.bodyPlan = state.lineages[0].bodyPlan; o.mods = (state.rules && state.rules.mods) || []; o.daily = !!state.daily;
      if ((state.prologue || []).length) o.prologue = state.prologue.slice();   // ten sam prolog — porównujesz tylko strategię
      newGame(Engine.getLineage(state, 'L0').name, o);
    });
    el.btnMuseum.addEventListener('click', function () { showMuseum(); });
    el.btnMuseumClose.addEventListener('click', function () { closeModal(el.modalMuseum); });
    el.btnOpenMuseumEnd.addEventListener('click', function () { showMuseum(state && state.museumId); });
    el.btnDownloadPlate.addEventListener('click', function () {
      if (!state) return;
      var h = featuredLineage(state.status); if (!h) return;
      downloadPlate(h, { name: h.name, latin: Engine.latinName(DATA, h, state), ending: endingLabel(state), score: isSandbox() ? null : Engine.scoreGame(DATA, state).total,
        seed: state.seed, date: new Date().toISOString().slice(0, 10), scenario: (scenarioById(state.scenario) || {}).name });
    });
    el.btnUnlockAll.addEventListener('click', function () {
      if (readJson(UNLOCK_KEY, false)) { writeJson(UNLOCK_KEY, false); renderStart(); el.btnUnlockAll.textContent = 'Odblokuj wszystko (np. dla nauczyciela)'; return; }
      openConfirm('Odblokować wszystkie scenariusze, plany budowy i modyfikatory bez zdobywania odznak? (np. na lekcję). Możesz to cofnąć.', function () {
        writeJson(UNLOCK_KEY, true); renderStart(); el.btnUnlockAll.textContent = 'Przywróć odblokowywanie odznakami';
      });
    });
    if (readJson(UNLOCK_KEY, false)) el.btnUnlockAll.textContent = 'Przywróć odblokowywanie odznakami';
    el.btnUndo.addEventListener('click', onUndo);
    el.btnSpeciate.addEventListener('click', onSpeciate);
    el.selectionSelect.addEventListener('change', onToggleSelection);
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
    if (el.btnPrologueSkip) el.btnPrologueSkip.addEventListener('click', skipPrologue);

    function doRestart() { prologueRun = null; clearSave(); state = null; undoStack = []; el.speciesInput.value = ''; showScreen('start'); }
    el.btnRestart.addEventListener('click', function () {
      if (state && state.status === 'playing') openConfirm('Rozpocząć nową grę? Bieżący postęp zostanie utracony.', doRestart);
      else doRestart();
    });
    el.btnPlayAgain.addEventListener('click', function () { state = null; undoStack = []; el.speciesInput.value = ''; el.worldSeed.value = ''; renderStart(); showScreen('start'); window.scrollTo(0, 0); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!el.modalConfirm.hidden) resolveConfirm(false);
        else if (!el.modalCodex.hidden) closeModal(el.modalCodex);
        else if (!el.modalMuseum.hidden) closeModal(el.modalMuseum);
        else if (!el.modalTree.hidden) closeModal(el.modalTree);
        else if (!el.modalSummary.hidden) closeModal(el.modalSummary);
        else if (!el.modalSpeciate.hidden) closeModal(el.modalSpeciate);
        else if (!el.modalSettings.hidden) closeModal(el.modalSettings);
        else if (!el.modalReport.hidden) onReportClose();
        return;
      }
      onGameKey(e);
    });
    [el.modalCodex, el.modalTree, el.modalSpeciate, el.modalSummary, el.modalSettings, el.modalMuseum].forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) closeModal(m); });
    });

    var saved = loadSaved();
    if (saved) { state = saved; showScreen('game'); renderAll(); startChance(); }
    else showScreen('start');
    updateCodexBadge();
  }
  /* Skróty klawiszowe na ekranie gry (tylko gdy nic nie jest otwarte i nie piszesz w polu):
     Spacja/Enter — tura, 1–4 — opcja karty / kontraktu / wariantu, K — Kodeks, D — drzewo życia. */
  function anyModalOpen() {
    return Array.prototype.some.call(document.querySelectorAll('.modal, .tutorial'), function (m) { return !m.hidden; });
  }
  function onGameKey(e) {
    if (el.screenGame.hidden || !state || turnBusy || anyModalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    var onControl = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || (t && t.getAttribute && t.getAttribute('role') === 'button');
    if ((e.key === ' ' || e.key === 'Enter') && !onControl) { e.preventDefault(); onSimulate(); return; }
    if (/^[1-4]$/.test(e.key)) {
      var box = !el.choiceCard.hidden ? el.choiceCard : (!el.contractOffer.hidden ? el.contractOffer : (!el.variantCard.hidden ? el.variantCard : null));
      if (!box) return;
      var opts = box.querySelectorAll('.choice-option, .contract-option'), b = opts[+e.key - 1];
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
      return;
    }
    if (e.key === 'k' || e.key === 'K') { e.preventDefault(); showCodex(); }
    else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); showTree(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
