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
  var SAVE_KEY = 'ewolucja.save.v4';
  var TUTORIAL_KEY = 'ewolucja.tutorialDone';

  var state = null;
  var undoStack = [];
  var UNDO_LIMIT = 50;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    screenStart: $('screen-start'), screenGame: $('screen-game'), screenEnd: $('screen-end'),
    formStart: $('form-start'), speciesInput: $('species-name'), introGoal: $('intro-goal'),
    scenarioCards: $('scenario-cards'),
    ep: $('ep-value'), pop: $('pop-value'), era: $('era-value'), intel: $('intel-value'),
    timeline: $('era-timeline'),
    lineageChips: $('lineage-chips'), nicheButtons: $('niche-buttons'),
    btnSpeciate: $('btn-speciate'), btnTree: $('btn-tree'),
    speciesName: $('species-name-display'), speciesNiche: $('species-niche'),
    sparkline: $('sparkline'), forecastBody: $('forecast-body'),
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
      return (s && s.version === 4 && s.status === 'playing') ? s : null;
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
  }

  function newGame(speciesName, opts) {
    state = Engine.createInitialState(DATA, speciesName, opts || {});
    undoStack = [];
    save();
    showScreen('game');
    renderAll();
    maybeStartTutorial();
  }

  function scenarioOpts(sc) {
    return { difficulty: sc.difficulty, startEra: sc.startEra, startEp: sc.startEp,
      goal: sc.goal, startTraits: sc.startTraits, scenarioId: sc.id };
  }
  function renderScenarios() {
    el.scenarioCards.innerHTML = '';
    DATA.SCENARIOS.forEach(function (sc) {
      var diff = DATA.DIFFICULTIES[sc.difficulty];
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'scenario-card';
      card.innerHTML = '<span class="scenario-icon">' + sc.icon + '</span>' +
        '<span class="scenario-name">' + sc.name + '</span>' +
        '<span class="scenario-diff">' + diff.label + ' · cel int. ' + (sc.goal != null ? sc.goal : diff.goal) + '</span>' +
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
  }
  function setAnimated(node, value) {
    if (node.textContent !== String(value)) {
      node.textContent = value;
      node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash');
    }
  }

  // ===================== Render — oś czasu =====================
  function renderTimeline() {
    var era = Engine.currentEra(DATA, state);
    el.timeline.innerHTML = '';
    era.turns.forEach(function (t, i) {
      var step = document.createElement('div');
      step.className = 'era-step';
      if (i < state.turn) step.classList.add('done');
      if (i === state.turn) step.classList.add('current');
      if (t.catastrophe) step.classList.add('catastrophe');
      step.title = t.title + (t.catastrophe ? ' — ' + t.catastrophe.name : '');
      step.innerHTML = '<span class="era-step-num">' + (i + 1) + (t.catastrophe ? '☄️' : '') + '</span>' +
        t.title.split(' — ')[0];
      el.timeline.appendChild(step);
    });
  }

  // ===================== Render — linie / nisze =====================
  function nicheIcon(n) { return (DATA.NICHES[n] && DATA.NICHES[n].icon) || '🌊'; }
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
      chip.innerHTML = (l.alive ? nicheIcon(l.niche) + ' ' : '🦴 ') + escapeHtml(l.name) +
        '<span class="lineage-chip-pop">' + (l.alive ? l.population : 'wymarła') + '</span>';
      if (l.alive) chip.addEventListener('click', function () { onSelectLineage(l.id); });
      el.lineageChips.appendChild(chip);
    });

    var can = Engine.canSpeciate(DATA, state);
    el.btnSpeciate.disabled = !can.ok || state.status !== 'playing';
    el.btnSpeciate.title = can.ok ? 'Rozdziel aktywną linię (koszt ' + DATA.SPECIATION_COST + ' EP)' : can.error;

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
      btn.innerHTML = cfg.icon + ' ' + cfg.label;
      if (a.niche === key) {
        btn.disabled = true; btn.title = 'Aktualna nisza';
      } else {
        var can = Engine.canMigrate(DATA, state, a, key);
        btn.disabled = !can.ok || state.status !== 'playing';
        btn.title = can.ok ? 'Migruj do niszy: ' + cfg.label : can.error;
        if (can.ok) btn.addEventListener('click', function () { onMigrateTo(key); });
      }
      el.nicheButtons.appendChild(btn);
    });
  }
  function onSelectLineage(id) {
    state = Engine.setActiveLineage(state, id); save();
    renderActiveLineage(); renderLineageBar(); renderTraits(); renderForecast(); renderEnv();
  }
  function onMigrateTo(niche) {
    var a = Engine.getActiveLineage(state);
    var res = Engine.migrateLineage(DATA, state, a.id, niche);
    if (!res.ok) { flash(res.error); return; }
    pushUndo(); state = res.state; save();
    renderActiveLineage(); renderLineageBar(); renderForecast(); renderEnv(); updateUndoButton();
  }

  // ===================== Render — aktywna linia =====================
  function renderActiveLineage() {
    var l = Engine.getActiveLineage(state);
    el.speciesName.textContent = l.name;
    el.speciesNiche.innerHTML = 'Nisza: <strong>' + nicheIcon(l.niche) + ' ' + nicheLabel(l.niche) + '</strong>';
    renderStats(l);
    renderSparkline(l);
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
  function renderSparkline(lineage) {
    var d = lineage.popHistory, w = 260, h = 46, pad = 4;
    if (!d || d.length < 2) {
      el.sparkline.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h +
        '"><line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) + '" y2="' + (h - pad) +
        '" stroke="var(--line)"/></svg>';
      return;
    }
    var max = Math.max.apply(null, d), min = Math.min.apply(null, d), range = Math.max(1, max - min);
    var stepX = (w - 2 * pad) / (d.length - 1);
    var pts = d.map(function (v, i) {
      return Math.round(pad + i * stepX) + ',' + Math.round((h - pad) - ((v - min) / range) * (h - 2 * pad));
    });
    var last = pts[pts.length - 1].split(',');
    var area = 'M' + pad + ',' + (h - pad) + ' L' + pts.join(' L') + ' L' + (w - pad) + ',' + (h - pad) + ' Z';
    el.sparkline.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none">' +
      '<path d="' + area + '" fill="var(--brand)" opacity="0.12"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" fill="var(--brand)"/></svg>';
  }

  // ===================== Render — prognoza (co-jeśli) =====================
  function renderForecast(previewTrait) {
    var l = Engine.getActiveLineage(state);
    var base = Engine.forecast(DATA, state, l);
    if (!base) { el.forecastBody.innerHTML = '<span class="forecast-none">Era dobiega końca.</span>'; return; }

    var deltaClass = base.delta >= 0 ? 'pos' : 'neg';
    var html = '<div class="forecast-row"><span>Populacja</span><span class="fc ' + deltaClass + '">' +
      (base.delta >= 0 ? '+' : '') + base.delta + ' → ' + base.projectedPop + '</span></div>';
    html += '<div class="forecast-row"><span>Bilans energii</span><span class="fc ' +
      (base.energy >= 0 ? 'pos' : 'neg') + '">' + base.energy + '</span></div>';

    if (previewTrait) {
      var clonel = JSON.parse(JSON.stringify(l));
      for (var k in previewTrait.effects) clonel.stats[k] = (clonel.stats[k] || 0) + previewTrait.effects[k];
      var withT = Engine.forecast(DATA, state, clonel);
      var diff = withT.delta - base.delta;
      html += '<div class="forecast-preview"><strong>Z cechą „' + escapeHtml(previewTrait.name) + '”:</strong> ' +
        'populacja ' + (withT.delta >= 0 ? '+' : '') + withT.delta +
        ' <span class="fc ' + (diff >= 0 ? 'pos' : 'neg') + '">(' + (diff >= 0 ? '+' : '') + diff + ')</span></div>';
    }

    if (base.catastrophe) {
      html += '<div class="forecast-warn">☄️ Uwaga: nadchodzi katastrofa (' +
        escapeHtml(base.catastrophe.name) + ') — uderzy w niszę ' +
        (base.catastrophe.niche === 'all' ? 'wszystkich' : nicheLabel(base.catastrophe.niche)) + '.</div>';
    }
    el.forecastBody.innerHTML = html;
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
    var nicheEnv = cfg.land ? env.land
      : { food: env.food * (cfg.foodMult || 1), predators: env.predators * (cfg.predMult || 1) };
    el.envStats.innerHTML = chip('Klimat: ' + climateLabel(env.climate)) + chip('Tlen: ' + env.oxygen) +
      chip('Pokarm (' + cfg.label.toLowerCase() + '): ' + Math.round(nicheEnv.food)) +
      chip('Drapieżniki: ' + Math.round(nicheEnv.predators));
    if (env.catastrophe) {
      el.envCatastrophe.hidden = false;
      var cn = env.catastrophe.niche === 'all' ? 'wszystkich' : DATA.NICHES[env.catastrophe.niche].label;
      el.envCatastrophe.textContent = '☄️ ' + env.catastrophe.name + ' — niszczy niszę ' + cn + '!';
    } else el.envCatastrophe.hidden = true;
  }
  function chip(t) { return '<li>' + t + '</li>'; }
  function climateLabel(c) { return c === 'zimno' ? '❄️ zimno' : (c === 'cieplo' ? '☀️ ciepło' : '⛅ umiarkowanie'); }

  // ===================== Render — drzewo cech =====================
  function renderTraits() {
    el.traits.innerHTML = '';
    var lineage = Engine.getActiveLineage(state);
    Object.keys(DATA.CATEGORIES).forEach(function (catKey) {
      var inCat = DATA.TRAITS.filter(function (t) { return t.category === catKey; });
      if (!inCat.length) return;
      var section = document.createElement('div');
      section.className = 'trait-category';
      var h3 = document.createElement('h3');
      h3.textContent = (DATA.CATEGORY_ICONS[catKey] ? DATA.CATEGORY_ICONS[catKey] + ' ' : '') + DATA.CATEGORIES[catKey];
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
    if (status === 'owned') costLabel = '✓ zdobyta';
    else if (status === 'locked') costLabel = '🔒 zablokowana';
    else if (status === 'era_locked') costLabel = '⏳ ' + DATA.ERAS[trait.minEra].name;
    else costLabel = trait.cost + ' EP';

    var extra = '';
    if (status === 'locked') {
      var missing = trait.requires.filter(function (id) { return lineage.traits.indexOf(id) === -1; });
      extra = '<div class="trait-req">🔒 Najpierw zdobądź: <strong>' + reqNames(missing) +
        '</strong> (koszt: ' + trait.cost + ' EP)</div>';
    } else if (status === 'era_locked') {
      extra = '<div class="trait-req">⏳ Dostępna od ery: <strong>' + DATA.ERAS[trait.minEra].name +
        '</strong> (koszt: ' + trait.cost + ' EP)</div>';
    } else if (status === 'too_expensive') {
      extra = '<div class="trait-req warn">Brakuje ' + (trait.cost - state.ep) + ' EP</div>';
    }

    var star = trait.path === 'intelligence' ? '<span class="trait-star" title="Droga do inteligencji">⭐</span> ' : '';
    var ico = trait.icon ? trait.icon + ' ' : '';
    btn.innerHTML = '<div class="trait-head"><span class="trait-name">' + star + ico + trait.name + '</span>' +
      '<span class="trait-cost">' + costLabel + '</span></div>' +
      '<div class="trait-desc">' + trait.desc + '</div>' +
      '<div class="trait-effects">' + renderEffects(trait.effects) + '</div>' +
      '<div class="trait-tradeoff">⚖ ' + trait.tradeoff + '</div>' + extra;

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
    var res = Engine.buyTrait(DATA, state, traitId);
    if (!res.ok) { flash(res.error); return; }
    pushUndo(); state = res.state; save();
    renderStatus(); renderActiveLineage(); renderTraits(); renderLineageBar(); renderForecast(); updateUndoButton();
  }
  function onSpeciate() {
    var can = Engine.canSpeciate(DATA, state);
    if (!can.ok) { flash(can.error); return; }
    var base = Engine.getActiveLineage(state).name;
    el.speciateHint.textContent = 'Rozdzielasz „' + base + '” na dwie gałęzie (koszt ' + DATA.SPECIATION_COST +
      ' EP). Populacja podzieli się na pół, a nowa gałąź będzie ewoluować niezależnie — możesz wysłać ją w inną niszę.';
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
    var res = Engine.simulateTurn(DATA, state);
    if (!res.report) return;
    pushUndo(); state = res.state; save(); renderAll(); showReport(res.report);
  }
  function renderAll() {
    renderStatus(); renderTimeline(); renderLineageBar();
    renderActiveLineage(); renderForecast(); renderEnv(); renderTraits(); updateUndoButton();
    el.btnSimulate.disabled = (state.status !== 'playing');
  }

  // ===================== Raport tury =====================
  function showReport(report) {
    // Baner zmiany ery.
    if (report.eraChanged) {
      el.reportEra.hidden = false;
      el.reportEra.innerHTML = '🏛️ Nowa era: <strong>' + report.newEraName + '</strong><br>' +
        '<span class="report-era-milestone">' + eraMilestone(report.newEraName) + '</span>';
    } else el.reportEra.hidden = true;

    // Baner pozytywnego zdarzenia.
    if (report.event) {
      el.reportEvent.hidden = false;
      el.reportEvent.textContent = '🍀 ' + report.event.name + ' — ' + report.event.desc;
    } else el.reportEvent.hidden = true;

    el.reportBody.innerHTML = '';
    var multi = report.lineReports.length > 1;
    report.lineReports.forEach(function (lr) {
      var block = document.createElement('div'); block.className = 'report-lineage';
      if (multi) {
        var head = document.createElement('div'); head.className = 'report-lineage-head';
        head.textContent = (lr.alive ? nicheIcon(lr.niche) + ' ' : '🦴 ') + lr.name;
        block.appendChild(head);
      }
      lr.events.forEach(function (txt) {
        var d = document.createElement('div'); d.className = 'report-event';
        if (/Katastrofa/.test(txt)) d.className += ' danger';
        d.textContent = txt; block.appendChild(d);
      });
      block.appendChild(line('Populacja', lr.popBefore + ' → ' + lr.popAfter, lr.popAfter >= lr.popBefore ? 'pos' : 'neg'));
      if (lr.births > 0) block.appendChild(line('Narodziny', '+' + lr.births, 'pos'));
      if (lr.predationDeaths > 0) block.appendChild(line('Straty od drapieżników', '-' + lr.predationDeaths, 'neg'));
      if (lr.starvationDeaths > 0) block.appendChild(line('Straty z głodu', '-' + lr.starvationDeaths, 'neg'));
      if (lr.catDeaths > 0) block.appendChild(line('Straty w katastrofie', '-' + lr.catDeaths, 'neg'));
      block.appendChild(line('Inteligencja', lr.intelligence + ' / ' + report.intelligenceGoal, 'plain'));
      // Rozbicie EP tej linii (skąd punkty).
      if (lr.epGain > 0) {
        var b = lr.epBreakdown;
        var parts = [];
        if (b.growth) parts.push('wzrost +' + b.growth);
        if (b.population) parts.push('populacja +' + b.population);
        if (b.intelligence) parts.push('inteligencja +' + b.intelligence);
        if (b.niche) parts.push('nisza +' + b.niche);
        var ep = document.createElement('div'); ep.className = 'report-epbreak';
        ep.innerHTML = '<span>EP z tej linii: <strong>+' + lr.epGain + '</strong></span>' +
          (parts.length ? '<span class="report-epparts">(' + parts.join(', ') + ')</span>' : '');
        block.appendChild(ep);
      }
      el.reportBody.appendChild(block);
    });
    var sum = document.createElement('div'); sum.className = 'report-summary';
    sum.appendChild(line('Łączna populacja', report.totalPopulation, 'plain'));
    if (report.epBase) sum.appendChild(line('Premia bazowa za przetrwanie', '+' + report.epBase, 'pos'));
    sum.appendChild(line('Zdobyte punkty ewolucji (razem)', '+' + report.epGain, 'pos'));
    if (report.predatorLevel > 2) {
      sum.appendChild(line('Presja drapieżników (koewolucja)', '↑ ' + report.predatorLevel, 'neg'));
    }
    el.reportBody.appendChild(sum);

    el.reportKnowledge.innerHTML = '';
    report.knowledge.forEach(function (key) {
      var k = DATA.KNOWLEDGE[key]; if (!k) return;
      var card = document.createElement('div'); card.className = 'knowledge-card';
      card.innerHTML = '<h4>💡 ' + k.title + '</h4><p>' + k.body + '</p>' +
        (k.fossil ? '<p class="knowledge-fossil">' + T('codex.fossil') + k.fossil + '</p>' : '');
      el.reportKnowledge.appendChild(card);
    });

    el.btnReportClose.textContent = (state.status === 'playing') ? T('report.next') : T('report.summary');
    openModal(el.modalReport);
  }
  function eraMilestone(name) {
    var e = DATA.ERAS.filter(function (x) { return x.name === name; })[0];
    return e ? e.milestone : '';
  }
  function line(label, value, tone) {
    var d = document.createElement('div'); d.className = 'report-line';
    var cls = tone === 'pos' ? 'num pos' : (tone === 'neg' ? 'num neg' : 'num');
    d.innerHTML = '<span>' + label + '</span><span class="' + cls + '">' + value + '</span>';
    return d;
  }
  function onReportClose() { closeModal(el.modalReport); if (state.status !== 'playing') showEnd(); }

  // ===================== Drzewo życia =====================
  function showTree() {
    el.treeContainer.innerHTML = buildTreeSvg();
    Array.prototype.forEach.call(el.treeContainer.querySelectorAll('[data-lineage]'), function (n) {
      var id = n.getAttribute('data-lineage'); var lin = Engine.getLineage(state, id);
      if (lin && lin.alive) {
        n.style.cursor = 'pointer';
        n.addEventListener('click', function () { onSelectLineage(id); closeModal(el.modalTree); });
      }
    });
    openModal(el.modalTree);
  }
  function buildTreeSvg() {
    var lineages = state.lineages, rowH = 46, topPad = 24, leftPad = 90, rightPad = 140, innerW = 620;
    var maxT = Engine.totalTurns(DATA);
    var nowT = Engine.globalTurn(DATA, state.eraIndex >= DATA.ERAS.length ? DATA.ERAS.length - 0 : state.eraIndex, state.turn);
    var rows = {}, order = [], childrenOf = {};
    lineages.forEach(function (l) { var p = l.parentId || '__root'; (childrenOf[p] = childrenOf[p] || []).push(l); });
    function bornGT(l) { return Engine.globalTurn(DATA, l.bornEra, l.bornTurn); }
    function dfs(l) { rows[l.id] = order.length; order.push(l); (childrenOf[l.id] || []).forEach(dfs); }
    (childrenOf['__root'] || []).forEach(dfs);

    var height = topPad * 2 + order.length * rowH;
    var xOf = function (t) { return leftPad + (t / Math.max(1, maxT)) * innerW; };
    var yOf = function (id) { return topPad + rows[id] * rowH + rowH / 2; };
    var svg = '<svg viewBox="0 0 ' + (leftPad + innerW + rightPad) + ' ' + height + '" width="100%" role="img" aria-label="Drzewo życia">';

    // znaczniki er na osi
    var acc = 0;
    DATA.ERAS.forEach(function (era) {
      var x = xOf(acc);
      svg += '<line x1="' + x + '" y1="' + (topPad - 8) + '" x2="' + x + '" y2="' + (height - topPad + 8) + '" stroke="var(--line)"/>';
      svg += '<text x="' + (x + 4) + '" y="' + (topPad - 12) + '" font-size="11" fill="var(--ink-soft)">' + era.name + '</text>';
      acc += era.turns.length;
    });

    order.forEach(function (l) {
      var y = yOf(l.id), xStart = xOf(bornGT(l));
      var endGT = (l.extinctGlobalTurn != null) ? l.extinctGlobalTurn : nowT;
      var xEnd = xOf(endGT); if (xEnd - xStart < 10) xEnd = xStart + 10;
      var color = l.alive ? 'var(--brand)' : 'var(--ink-soft)';
      var isActive = (l.id === state.activeLineageId);
      if (l.parentId) {
        svg += '<line x1="' + xStart + '" y1="' + yOf(l.parentId) + '" x2="' + xStart + '" y2="' + y + '" stroke="var(--line)" stroke-width="2"/>';
      }
      svg += '<line x1="' + xStart + '" y1="' + y + '" x2="' + xEnd + '" y2="' + y + '" stroke="' + color +
        '" stroke-width="' + (isActive ? 4 : 2.5) + '" ' + (l.alive ? '' : 'stroke-dasharray="4 3" ') + 'stroke-linecap="round"/>';
      svg += '<g data-lineage="' + l.id + '"><circle cx="' + xEnd + '" cy="' + y + '" r="' + (isActive ? 6 : 4.5) + '" fill="' + color +
        '"' + (isActive ? ' stroke="var(--accent)" stroke-width="2"' : '') + '/>' +
        '<text x="' + (xEnd + 10) + '" y="' + (y + 4) + '" font-size="12" fill="var(--ink)" ' + (isActive ? 'font-weight="700"' : '') + '>' +
        escapeHtml(l.name) + (l.alive ? ' ' + nicheIcon(l.niche) + ' (' + l.population + ')' : ' †') + '</text></g>';
    });
    return svg + '</svg>';
  }

  // ===================== Ekran końcowy =====================
  function showEnd() {
    clearSave();
    var s = state.status;
    el.endEmblem.textContent = s === 'won' ? '🧠' : (s === 'survived' ? '🐾' : '🦴');
    el.endTitle.textContent = s === 'won' ? 'Narodziny inteligencji!' :
      (s === 'survived' ? 'Gatunek przetrwał wszystkie ery' : 'Wszystkie linie wygasły');
    el.endSummary.textContent =
      s === 'won'
        ? 'Jedna z Twoich linii osiągnęła próg inteligencji — na horyzoncie kultura i technologia. Efekt konsekwentnego rozwoju układu nerwowego mimo katastrof i presji środowiska.'
        : s === 'survived'
        ? 'Twoje linie przetrwały paleozoik, mezozoik i kenozoik, ale żadna nie rozwinęła dostatecznie mózgu. Dobre przetrwanie to nie to samo co droga do rozumności — spróbuj skupić się na ścieżce ⭐.'
        : 'Wszystkie linie rozwojowe wymarły. W ewolucji większość linii wymiera — dywersyfikuj (specjacja, różne nisze) i lepiej dostosuj adaptacje do nadchodzących katastrof.';
    el.endStats.innerHTML = '';
    endStat('Status', s === 'won' ? 'Zwycięstwo' : (s === 'survived' ? 'Przetrwanie' : 'Wymarcie'));
    endStat('Liczba linii rozwojowych', state.lineages.length);
    endStat('Szczytowa łączna populacja', state.lineages.reduce(function (a, l) { return a + l.peakPopulation; }, 0));
    endStat('Najwyższa inteligencja', Engine.maxIntelligence(state) + ' / ' + state.intelligenceGoal);
    endStat('Odkryte pojęcia w Kodeksie', state.unlockedKnowledge.length);
    showScreen('end');
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
      'Najwyższa inteligencja: ' + Engine.maxIntelligence(state) + ' / ' + state.intelligenceGoal,
      'Liczba linii rozwojowych: ' + state.lineages.length,
      'Szczytowa łączna populacja: ' + state.lineages.reduce(function (a, l) { return a + l.peakPopulation; }, 0),
      'Odkryte pojęcia w Kodeksie: ' + state.unlockedKnowledge.length, '', 'Linie rozwojowe:'];
    state.lineages.forEach(function (l) {
      L.push('  • ' + l.name + ' — ' + (l.alive ? 'żywa' : 'wymarła') +
        ', nisza: ' + DATA.NICHES[l.niche].label +
        ', inteligencja: ' + l.stats.intelligence +
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
      var card = document.createElement('div'); card.className = 'knowledge-card';
      card.innerHTML = '<h4>💡 ' + k.title + '</h4><p>' + k.body + '</p>' +
        (k.fossil ? '<p class="knowledge-fossil">' + T('codex.fossil') + k.fossil + '</p>' : '');
      el.codexBody.appendChild(card);
    });
    if (!any) el.codexBody.innerHTML = '<p class="codex-empty">Kodeks jest jeszcze pusty — graj, aby odkrywać pojęcia.</p>';
    openModal(el.modalCodex);
  }

  // ===================== Samouczek =====================
  var tutorialSteps = [
    { title: 'Witaj w Ewolucji!', text: 'Prowadzisz nie pojedyncze zwierzę, lecz całą populację. Twój cel: doprowadzić którąkolwiek linię do inteligencji ' + DATA.INTELLIGENCE_GOAL + ' w ciągu trzech er.' },
    { title: 'Punkty ewolucji (EP)', text: 'Za przetrwanie i rozwój zdobywasz EP (u góry po lewej). Wydajesz je na cechy w panelu „Adaptacje” po prawej. Każda cecha ma koszt i kompromis.' },
    { title: 'Prognoza i kompromisy', text: 'Panel „Prognoza następnej tury” pokazuje, jak zmieni się populacja. Najedź na cechę, aby zobaczyć jej wpływ przed zakupem (co-jeśli).' },
    { title: 'Droga do celu ⭐', text: 'Cechy oznaczone ⭐ prowadzą do inteligencji: Zwoje → Mózg → Rozbudowany mózg → życie społeczne → narzędzia. Sama liczna populacja nie wystarczy!' },
    { title: 'Specjacja i nisze', text: 'Możesz rozdzielić linię (Specjacja) i wysłać gałąź do innej niszy: 🌊 woda, 🪸 przybrzeże, 🏝️ ląd (wymaga kończyn), 🕊️ powietrze (wymaga lotu). Każda ma inny pokarm i zagrożenia — dywersyfikacja pomaga przetrwać wymierania masowe ☄️.' }
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
    el.introGoal.innerHTML = '🎯 <strong>Cel:</strong> doprowadź którąkolwiek linię do progu inteligencji ' +
      'przez ery (' + DATA.ERAS.map(function (e) { return e.name; }).join(', ') + '). ' +
      'Rozwijaj układ nerwowy (⭐), rozkładaj ryzyko przez specjację i nisze, przetrwaj wymierania masowe. ' +
      'Wybierz scenariusz poniżej — różnią się trudnością i punktem startu.';

    renderScenarios();
    // Enter w polu nazwy startuje domyślny scenariusz (pełna ewolucja).
    el.formStart.addEventListener('submit', function (e) {
      e.preventDefault();
      newGame((el.speciesInput.value || '').trim() || 'Prazwierzę', scenarioOpts(DATA.SCENARIOS[0]));
    });
    el.btnSimulate.addEventListener('click', onSimulate);
    el.btnUndo.addEventListener('click', onUndo);
    el.btnSpeciate.addEventListener('click', onSpeciate);
    el.btnTree.addEventListener('click', showTree);
    el.btnReportClose.addEventListener('click', onReportClose);
    el.btnCodex.addEventListener('click', showCodex);
    el.btnCodexClose.addEventListener('click', function () { closeModal(el.modalCodex); });
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

    function doRestart() { clearSave(); state = null; undoStack = []; el.speciesInput.value = ''; showScreen('start'); }
    el.btnRestart.addEventListener('click', function () {
      if (state && state.status === 'playing') openConfirm('Rozpocząć nową grę? Bieżący postęp zostanie utracony.', doRestart);
      else doRestart();
    });
    el.btnPlayAgain.addEventListener('click', function () { state = null; undoStack = []; el.speciesInput.value = ''; showScreen('start'); });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!el.modalCodex.hidden) closeModal(el.modalCodex);
      else if (!el.modalTree.hidden) closeModal(el.modalTree);
      else if (!el.modalSummary.hidden) closeModal(el.modalSummary);
      else if (!el.modalSpeciate.hidden) closeModal(el.modalSpeciate);
      else if (!el.modalConfirm.hidden) resolveConfirm(false);
    });
    [el.modalCodex, el.modalTree, el.modalSpeciate, el.modalSummary].forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) closeModal(m); });
    });

    var saved = loadSaved();
    if (saved) { state = saved; showScreen('game'); renderAll(); }
    else showScreen('start');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
