/*
 * ui.js — kontroler interfejsu.
 * Spina dane (GameData), silnik (Engine) i i18n (GameI18n) z DOM.
 * Logika gry jest w silniku; tutaj render, zdarzenia, zapis lokalny,
 * cofanie (tryb nauczyciela), samouczek, quiz i prognoza „co-jeśli”.
 */
(function () {
  'use strict';

  var DATA = window.GameData;
  var Engine = window.Engine;
  var T = window.GameI18n.t;
  var SAVE_KEY = 'ewolucja.save.v5';
  var TUTORIAL_KEY = 'ewolucja.tutorial2Done';
  var BEST_KEY = 'ewolucja.best';

  var state = null;
  var undoStack = [];
  var UNDO_LIMIT = 50;
  var pendingEnd = false;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    screenStart: $('screen-start'), screenGame: $('screen-game'), screenEnd: $('screen-end'),
    formStart: $('form-start'), speciesInput: $('species-name'), seedInput: $('seed-code'), btnDaily: $('btn-daily'),
    introGoal: $('intro-goal'), scenarioCards: $('scenario-cards'),
    zg: $('zg-value'), pop: $('pop-value'), era: $('era-value'), intel: $('intel-value'), intelFill: $('intel-fill'),
    score: $('score-value'),
    timeline: $('era-timeline'), lineageChips: $('lineage-chips'), nicheMap: $('niche-map'),
    btnSpeciate: $('btn-speciate'), btnTree: $('btn-tree'),
    speciesName: $('species-name-display'), speciesNiche: $('species-niche'),
    sparkline: $('sparkline'), forecastBody: $('forecast-body'), statsList: $('stats-list'),
    envName: $('env-name'), envNote: $('env-note'), envEvent: $('env-event'), envCatastrophe: $('env-catastrophe'),
    envStats: $('env-stats'), envNext: $('env-next'), objectives: $('objectives-list'),
    draft: $('draft-cards'), btnReroll: $('btn-reroll'), genes: $('gene-list'), traits: $('traits-container'),
    btnSimulate: $('btn-simulate'), btnUndo: $('btn-undo'),
    modalReport: $('modal-report'), reportEra: $('report-era'), reportEvent: $('report-event'),
    reportObjectives: $('report-objectives'), reportBody: $('report-body'),
    reportKnowledge: $('report-knowledge'), btnReportClose: $('btn-report-close'),
    modalCodex: $('modal-codex'), codexBody: $('codex-body'), btnCodexClose: $('btn-codex-close'),
    modalTree: $('modal-tree'), treeContainer: $('tree-container'), btnTreeClose: $('btn-tree-close'),
    modalSpeciate: $('modal-speciate'), formSpeciate: $('form-speciate'), speciateNiches: $('speciate-niches'),
    speciateName: $('speciate-name'), speciateHint: $('speciate-hint'), btnSpeciateCancel: $('btn-speciate-cancel'),
    modalQuiz: $('modal-quiz'), quizQuestion: $('quiz-question'), quizOptions: $('quiz-options'),
    quizFeedback: $('quiz-feedback'), btnQuizNext: $('btn-quiz-next'),
    modalConfirm: $('modal-confirm'), confirmMessage: $('confirm-message'),
    btnConfirmYes: $('btn-confirm-yes'), btnConfirmNo: $('btn-confirm-no'),
    endEmblem: $('end-emblem'), endTitle: $('end-title'), endSummary: $('end-summary'), endScore: $('end-score'),
    endStats: $('end-stats'), endSeed: $('end-seed'),
    btnPlayAgain: $('btn-play-again'), btnOpenCodexEnd: $('btn-open-codex-end'), btnSummary: $('btn-summary'),
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
  var TRAITS_BY_ID = {}; DATA.TRAITS.forEach(function (t) { TRAITS_BY_ID[t.id] = t; });

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
  function commit(newState) { pushUndo(); state = newState; save(); renderAll(); }

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
    var code = (el.seedInput.value || '').trim();
    return { difficulty: sc.difficulty, startEra: sc.startEra, startZg: sc.startZg,
      goal: sc.goal, startTraits: sc.startTraits, startNiche: sc.startNiche, scenarioId: sc.id,
      seed: code ? Engine.seedFromCode(code) : Engine.randomSeed() };
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
        '<span class="scenario-diff">' + diff.label + ' · cel int. ' + (sc.goal != null ? sc.goal : diff.goal) +
        ' · wynik ×' + String(diff.scoreMult).replace('.', ',') + '</span>' +
        '<span class="scenario-intro">' + sc.intro + '</span>' + bestBadge(sc.id);
      card.addEventListener('click', function () {
        newGame((el.speciesInput.value || '').trim() || 'Prazwierzę', scenarioOpts(sc));
      });
      el.scenarioCards.appendChild(card);
    });
  }
  function readBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch (e) { return {}; } }
  function bestBadge(id) {
    var b = readBest()[id];
    return b ? '<span class="scenario-best">🏅 Rekord: ' + b + '</span>' : '';
  }
  function storeBest(id, score) {
    var b = readBest();
    if (!b[id] || score > b[id]) { b[id] = score; try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (e) {} return true; }
    return false;
  }

  // ===================== Render — pasek stanu =====================
  function renderStatus() {
    setAnimated(el.zg, state.zg);
    setAnimated(el.pop, Engine.totalPopulation(state));
    var era = Engine.currentEra(DATA, state);
    var tno = Math.min(state.turn + 1, era.turns.length);
    el.era.textContent = era.name + ' ' + tno + '/' + era.turns.length;
    el.era.title = era.dates || '';
    var intel = Engine.maxIntelligence(DATA, state);
    el.intel.textContent = fmt(intel) + ' / ' + state.intelligenceGoal;
    el.intelFill.style.width = Math.min(100, intel / state.intelligenceGoal * 100) + '%';
    setAnimated(el.score, Engine.computeScore(DATA, state).total);
  }
  function setAnimated(node, value) {
    if (node.textContent !== String(value)) {
      node.textContent = value;
      node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash');
    }
  }
  function fmt(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
  function pct(f) { return Math.round(f * 100) + '%'; }

  // ===================== Render — oś czasu =====================
  function renderTimeline() {
    var era = Engine.currentEra(DATA, state);
    var eraIdx = Math.min(state.eraIndex, DATA.ERAS.length - 1);
    el.timeline.innerHTML = '';
    era.turns.forEach(function (t, i) {
      var env = state.envs[Engine.globalTurn(DATA, eraIdx, i)];
      var step = document.createElement('div');
      step.className = 'era-step';
      if (i < state.turn) step.classList.add('done');
      if (i === state.turn) step.classList.add('current');
      if (t.catastrophe) step.classList.add('catastrophe');
      // Zdarzenia znamy tylko na 2 tury naprzód (zapowiedź).
      var ev = (i >= state.turn && i <= state.turn + 1) ? Engine.eventDef(DATA, env) : null;
      step.title = t.title + (t.catastrophe ? ' — ' + t.catastrophe.name : '') + (ev ? ' — ' + ev.name : '');
      step.innerHTML = '<span class="era-step-num">' + (i + 1) + (t.catastrophe ? '☄️' : '') + (ev ? ev.icon : '') + '</span>' +
        t.title.split(' — ')[0];
      el.timeline.appendChild(step);
    });
  }

  // ===================== Render — linie =====================
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
      var pending = l.alive && l.picksUsed === 0 && l.draft.length ? '<span class="lineage-chip-dot" title="Czeka na wybór mutacji">●</span>' : '';
      chip.innerHTML = (l.alive ? nicheIcon(l.niche) + ' ' : '🦴 ') + escapeHtml(l.name) +
        '<span class="lineage-chip-pop">' + (l.alive ? l.population + ' · 🧠' + fmt(Engine.lineageIntelligence(DATA, l)) : 'wymarła') + '</span>' + pending;
      if (l.alive) chip.addEventListener('click', function () { onSelectLineage(l.id); });
      el.lineageChips.appendChild(chip);
    });
    var can = Engine.canSpeciate(DATA, state);
    el.btnSpeciate.disabled = !can.ok;
    el.btnSpeciate.title = can.ok ? 'Rozdziel aktywną linię (koszt ' + DATA.COSTS.speciate + ' ZG)' : can.error;
    el.btnSpeciate.textContent = '🌿 Specjacja (' + DATA.COSTS.speciate + ' ZG)';
  }
  function onSelectLineage(id) {
    state = Engine.setActiveLineage(state, id); save(); renderAll();
  }

  // ===================== Render — mapa nisz =====================
  function rivalLabel(v) {
    if (v < 0.5) return { t: 'brak', c: 'none' };
    if (v < 3) return { t: 'słaba', c: 'low' };
    if (v < 6) return { t: 'średnia', c: 'mid' };
    return { t: 'silna', c: 'high' };
  }
  function renderNicheMap() {
    var a = Engine.getActiveLineage(state);
    var env = Engine.currentTurnEnv(DATA, state);
    var diff = Engine.difficultyOf(DATA, state);
    el.nicheMap.innerHTML = '';
    Object.keys(DATA.NICHES).forEach(function (key) {
      var cfg = DATA.NICHES[key];
      var card = document.createElement('div');
      card.className = 'niche-card' + (a.niche === key ? ' current' : '');
      var here = Engine.aliveLineages(state).filter(function (l) { return l.niche === key; });
      var rival = rivalLabel((state.rivals[key] || 0) * diff.rivalMult);
      var ne = env ? Engine.nicheEnv(DATA, env, key) : null;
      var html = '<div class="niche-head"><span class="niche-icon">' + cfg.icon + '</span><strong>' + cfg.label + '</strong></div>';
      if (ne) {
        html += '<div class="niche-stats"><span title="Pokarm w niszy">🍽️ ' + Math.round(ne.food) + '</span>' +
          '<span title="Drapieżniki">🦈 ' + Math.round(ne.predators) + '</span>' +
          '<span class="rival ' + rival.c + '" title="Rodzimi konkurenci w tej niszy">⚔️ ' + rival.t + '</span></div>';
        if (env.catastrophe && Engine.catastropheHits(env.catastrophe, key)) html += '<div class="niche-warn">☄️ katastrofa!</div>';
      }
      html += '<div class="niche-lineages">' + (here.length ? here.map(function (l) { return escapeHtml(l.name); }).join(', ') : '<em>brak Twoich linii</em>') + '</div>';
      card.innerHTML = html;

      if (a.niche !== key && state.status === 'playing') {
        var can = Engine.canMigrate(DATA, state, a, key);
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'btn btn-ghost btn-small niche-go';
        if (can.ok || /ZG|migrowała/.test(can.error)) {
          var c = JSON.parse(JSON.stringify(a)); c.niche = key;
          var f = Engine.forecast(DATA, state, c);
          btn.innerHTML = '➜ Migruj (' + DATA.COSTS.migrate + ' ZG)' + (f ? ' <span class="fc ' + (f.delta >= 0 ? 'pos' : 'neg') + '">' +
            (f.delta >= 0 ? '+' : '') + f.delta + '</span>' : '');
          btn.title = can.ok ? 'Prognoza dla „' + a.name + '” w tej niszy: ' + (f ? f.projectedPop + ' osobników, pojemność ' + f.capacity : '') : can.error;
        } else {
          btn.textContent = '🔒 ' + can.error.replace('Wymaga cechy ', '');
          btn.title = can.error;
        }
        btn.disabled = !can.ok;
        if (can.ok) btn.addEventListener('click', function () { onMigrateTo(key); });
        card.appendChild(btn);
      } else if (a.niche === key) {
        var badge = document.createElement('div'); badge.className = 'niche-here'; badge.textContent = '📍 aktywna linia';
        card.appendChild(badge);
      }
      el.nicheMap.appendChild(card);
    });
  }
  function onMigrateTo(niche) {
    var a = Engine.getActiveLineage(state);
    var res = Engine.migrateLineage(DATA, state, a.id, niche);
    if (!res.ok) { flash(res.error); return; }
    commit(res.state);
  }

  // ===================== Render — aktywna linia =====================
  function renderActiveLineage() {
    var l = Engine.getActiveLineage(state);
    el.speciesName.textContent = l.name;
    el.speciesNiche.innerHTML = 'Nisza: <strong>' + nicheIcon(l.niche) + ' ' + nicheLabel(l.niche) + '</strong>';
    renderStats(l);
    renderSparkline(l);
  }
  function renderStats(lineage, preview) {
    var f = Engine.forecast(DATA, state, lineage);
    var stats = f ? f.stats : Engine.effectiveStats(DATA, lineage, null);
    var pst = preview ? preview.stats : null;
    el.statsList.innerHTML = '';
    STAT_META.forEach(function (m) {
      var val = stats[m.key];
      var w = Math.max(0, Math.min(100, (val / 20) * 100));
      var li = document.createElement('li');
      li.className = 'stat-row';
      var diffHtml = '';
      if (pst) {
        var d = Math.round((pst[m.key] - val) * 10) / 10;
        if (d) diffHtml = ' <span class="fc ' + ((d > 0) !== (m.key === 'metabolism') ? 'pos' : 'neg') + '">' + (d > 0 ? '+' : '') + fmt(d) + '</span>';
      }
      li.innerHTML = '<span class="stat-name">' + m.label + '</span>' +
        '<span class="stat-bar"><span class="stat-fill ' + m.key + '" style="width:' + w + '%"></span></span>' +
        '<span class="stat-num">' + fmt(val) + diffHtml + '</span>';
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
  function renderForecast(previewCard) {
    var l = Engine.getActiveLineage(state);
    var base = Engine.forecast(DATA, state, l);
    if (!base) { el.forecastBody.innerHTML = '<span class="forecast-none">Era dobiega końca.</span>'; return; }

    var row = function (label, value, cls) { return '<div class="forecast-row"><span>' + label + '</span><span class="fc ' + (cls || '') + '">' + value + '</span></div>'; };
    var html = row('Populacja', (base.delta >= 0 ? '+' : '') + base.delta + ' → ' + base.projectedPop, base.delta >= 0 ? 'pos' : 'neg');
    html += row('Bilans energii', fmt(base.energy), base.energy >= 0 ? 'pos' : 'neg');
    html += row('Pojemność niszy', base.capacity + (base.density > 0.85 ? ' ⚠️ tłok' : ''), base.density > 1 ? 'neg' : '');
    html += row('Konkurencja', '−' + Math.round((1 - base.compFactor) * 100) + '% pokarmu', base.compFactor < 0.8 ? 'neg' : '');
    if (base.predationDeaths) html += row('Straty od drapieżników', '−' + base.predationDeaths, 'neg');

    var preview = null;
    if (previewCard) {
      var ov = previewCard.kind === 'gain' ? { id: previewCard.id, f: DATA.GENETICS.newMutationFreq }
        : { id: previewCard.id, f: DATA.GENETICS.lossMutationFreq };
      preview = Engine.forecast(DATA, state, l, ov);
      var d = preview.delta - base.delta;
      html += '<div class="forecast-preview"><strong>' + (previewCard.kind === 'gain' ? 'Z mutacją' : 'Z utratą') +
        ' „' + escapeHtml(TRAITS_BY_ID[previewCard.id].name) + '”:</strong> populacja ' + (preview.delta >= 0 ? '+' : '') + preview.delta +
        ' <span class="fc ' + (d >= 0 ? 'pos' : 'neg') + '">(' + (d >= 0 ? '+' : '') + d + ')</span></div>';
    }
    if (base.catastrophe) {
      html += '<div class="forecast-warn">☄️ ' + escapeHtml(base.catastrophe.name) + ' uderzy w tę niszę: ok. −' + base.catDeaths + ' osobników.</div>';
    }
    el.forecastBody.innerHTML = html;
    renderStats(l, preview);
  }

  // ===================== Render — środowisko i zapowiedź =====================
  function renderEnv() {
    var env = Engine.currentTurnEnv(DATA, state);
    if (!env) {
      el.envName.textContent = 'Era dobiega końca';
      el.envNote.textContent = ''; el.envStats.innerHTML = ''; el.envCatastrophe.hidden = true; el.envEvent.hidden = true;
      el.envNext.innerHTML = '';
      return;
    }
    el.envName.textContent = env.title;
    el.envNote.textContent = env.note;
    var a = Engine.getActiveLineage(state);
    var ne = Engine.nicheEnv(DATA, env, a.niche);
    el.envStats.innerHTML = chip('Klimat: ' + climateLabel(ne.climate)) + chip('Tlen: ' + ne.oxygen + (ne.oxygen <= 8 ? ' 🫧' : '')) +
      chip('Pokarm: ' + Math.round(ne.food)) + chip('Drapieżniki: ' + Math.round(ne.predators + (state.predatorLevel || 0)));
    var ev = Engine.eventDef(DATA, env);
    if (ev) {
      el.envEvent.hidden = false;
      el.envEvent.className = 'env-event ' + (ev.good ? 'good' : 'bad');
      el.envEvent.textContent = ev.icon + ' ' + ev.name + (env.event.niche ? ' (' + nicheLabel(env.event.niche) + ')' : '') + ' — ' + ev.desc;
    } else el.envEvent.hidden = true;
    if (env.catastrophe) {
      el.envCatastrophe.hidden = false;
      el.envCatastrophe.textContent = '☄️ ' + env.catastrophe.name + ' (' + DATA.CATASTROPHE_KINDS[env.catastrophe.kind] + ') — uderzy w: ' + catNiches(env.catastrophe) + '!';
    } else el.envCatastrophe.hidden = true;

    var next = Engine.peekEnv(DATA, state, 1);
    if (next) {
      var nev = Engine.eventDef(DATA, next);
      var parts = ['🔭 <strong>Zapowiedź:</strong> ' + escapeHtml(next.title) + ' · ' + climateLabel(next.climate)];
      if (nev) parts.push(nev.icon + ' ' + nev.name);
      if (next.catastrophe) parts.push('<span class="fc neg">☄️ ' + escapeHtml(next.catastrophe.name) + ' → ' + catNiches(next.catastrophe) +
        '</span> — przygotuj odporność (' + DATA.CATASTROPHE_KINDS[next.catastrophe.kind] + ')');
      el.envNext.innerHTML = parts.join(' · ');
    } else el.envNext.innerHTML = '🔭 To ostatnia tura gry.';
  }
  function catNiches(cat) { return cat.niches === 'all' ? 'wszystkie nisze' : cat.niches.map(nicheLabel).join(', '); }
  function chip(t) { return '<li>' + t + '</li>'; }
  function climateLabel(c) { return c === 'zimno' ? '❄️ zimno' : (c === 'cieplo' ? '☀️ ciepło' : '⛅ umiarkowanie'); }

  // ===================== Render — cele ery =====================
  function renderObjectives() {
    var list = Engine.eraObjectives(DATA, Math.min(state.eraIndex, DATA.ERAS.length - 1));
    el.objectives.innerHTML = '';
    if (!list.length) { el.objectives.innerHTML = '<li class="obj-none">Brak celów w tej erze.</li>'; return; }
    list.forEach(function (o) {
      var done = state.objectivesDone.indexOf(o.id) !== -1;
      var li = document.createElement('li');
      li.className = 'obj' + (done ? ' done' : '');
      li.innerHTML = '<span>' + (done ? '✅ ' : '◻️ ') + o.text + '</span><span class="obj-reward">+' + o.reward + ' ZG</span>';
      el.objectives.appendChild(li);
    });
  }

  // ===================== Render — draft mutacji =====================
  function effectChips(effects, cls) {
    var html = '';
    for (var k in effects) if (Object.prototype.hasOwnProperty.call(effects, k)) {
      var v = effects[k];
      var good = (v > 0) !== (k === 'metabolism');
      html += '<span class="effect-chip ' + (good ? 'up' : 'down') + (cls ? ' ' + cls : '') + '">' + Engine.statLabel(k) + ' ' + (v > 0 ? '+' : '') + v + '</span>';
    }
    return html;
  }
  function traitDetails(t) {
    var html = '<div class="trait-effects">' + effectChips(t.effects) + '</div>';
    if (t.cond) {
      var parts = [];
      for (var c in t.cond) parts.push('<span class="cond-label">' + (DATA.CONDITIONS[c] || c) + ':</span> ' + effectChips(t.cond[c], 'small'));
      html += '<div class="trait-cond">' + parts.join('<br>') + '</div>';
    }
    if (t.coldShield) html += '<div class="trait-cond"><span class="cond-label">❄️ znosi karę za chłód</span></div>';
    if (t.resist) {
      var rs = [];
      for (var k in t.resist) rs.push((t.resist[k] > 0 ? '🛡️ ' : '⚠️ ') + DATA.CATASTROPHE_KINDS[k] + ' ' + (t.resist[k] > 0 ? '+' : '') + Math.round(t.resist[k] * 100) + '%');
      html += '<div class="trait-resist">' + rs.join(' · ') + '</div>';
    }
    return html;
  }
  function selectionBadge(s) {
    if (s > 0.08) return '<span class="sel up" title="Współczynnik doboru s = ' + s + '">↑ dobór sprzyja</span>';
    if (s < -0.08) return '<span class="sel down" title="Współczynnik doboru s = ' + s + '">↓ dobór eliminuje</span>';
    return '<span class="sel flat" title="Współczynnik doboru s = ' + s + '">≈ neutralna (dryf)</span>';
  }
  function renderDraft() {
    var l = Engine.getActiveLineage(state);
    el.draft.innerHTML = '';
    var playing = state.status === 'playing';
    el.btnReroll.textContent = '🔄 Losuj ponownie (' + DATA.COSTS.reroll + ' ZG)';
    el.btnReroll.disabled = !playing || state.zg < DATA.COSTS.reroll;
    if (!l.draft.length) {
      el.draft.innerHTML = '<p class="draft-empty">' + (l.picksUsed ? '✔ Mutacje wybrane. Przeżyj turę, by zobaczyć, co zrobi z nimi dobór naturalny.'
        : 'Brak nowych mutacji dla tej linii.') + '</p>';
      return;
    }
    var cost = Engine.pickCost(DATA, l);
    l.draft.forEach(function (card, idx) {
      var t = TRAITS_BY_ID[card.id];
      var s = Engine.predictSelection(DATA, state, l, card.id);
      if (card.kind === 'loss') s = -s;
      var div = document.createElement('div');
      div.className = 'draft-card ' + card.kind + (t.path === 'intelligence' ? ' path-intel' : '');
      div.innerHTML =
        '<div class="draft-kind">' + (card.kind === 'gain' ? '🧪 Nowa mutacja' : '✂️ Utrata cechy') + '</div>' +
        '<div class="trait-head"><span class="trait-name">' + (t.path === 'intelligence' ? '⭐ ' : '') + t.icon + ' ' + t.name + '</span>' + selectionBadge(s) + '</div>' +
        '<div class="trait-desc">' + (card.kind === 'gain' ? t.desc : 'Mutacja wyłączająca cechę „' + t.name + '”, która obecnie bardziej szkodzi, niż pomaga. Częstość spadnie do ' + pct(DATA.GENETICS.lossMutationFreq) + '.') + '</div>' +
        (card.kind === 'gain' ? traitDetails(t) + '<div class="trait-tradeoff">⚖ ' + t.tradeoff + '</div>' : '');
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn ' + (cost === 0 ? 'btn-primary' : 'btn-ghost') + ' btn-small draft-pick';
      btn.textContent = cost === 0 ? 'Wybierz (za darmo)' : 'Wybierz też tę (' + cost + ' ZG)';
      btn.disabled = !playing || state.zg < cost;
      btn.addEventListener('click', function () { onPick(idx); });
      div.appendChild(btn);
      div.addEventListener('mouseenter', function () { renderForecast(card); });
      div.addEventListener('mouseleave', function () { renderForecast(); });
      btn.addEventListener('focus', function () { renderForecast(card); });
      btn.addEventListener('blur', function () { renderForecast(); });
      el.draft.appendChild(div);
    });
  }
  function onPick(idx) {
    var l = Engine.getActiveLineage(state);
    var res = Engine.pickMutation(DATA, state, l.id, idx);
    if (!res.ok) { flash(res.error); return; }
    commit(res.state);
  }
  function onReroll() {
    var res = Engine.rerollDraft(DATA, state, state.activeLineageId);
    if (!res.ok) { flash(res.error); return; }
    commit(res.state);
  }

  // ===================== Render — pula genowa =====================
  function renderGenes() {
    var l = Engine.getActiveLineage(state);
    el.genes.innerHTML = '';
    if (!l.genes.length) {
      el.genes.innerHTML = '<li class="gene-empty">Populacja nie ma jeszcze żadnych nowych cech — wybierz mutację powyżej.</li>';
      return;
    }
    var genes = l.genes.slice().sort(function (a, b) { return a.f - b.f; });
    genes.forEach(function (g) {
      var t = TRAITS_BY_ID[g.id];
      var s = Engine.predictSelection(DATA, state, l, g.id);
      var fixed = g.f >= 1;
      var li = document.createElement('li');
      li.className = 'gene' + (fixed ? ' fixed' : '') + (t.path === 'intelligence' ? ' path-intel' : '');
      li.title = t.desc + ' — ' + t.tradeoff;
      var arrow = fixed ? (s < -0.08 ? '<span class="sel down" title="Cecha utrwalona, ale obecnie szkodzi — może pojawić się mutacja jej utraty">⚠ obciążenie</span>' : '<span class="sel fixed">✓ utrwalona</span>')
        : selectionBadge(s);
      li.innerHTML = '<span class="gene-name">' + (t.path === 'intelligence' ? '⭐ ' : '') + t.icon + ' ' + t.name + '</span>' +
        '<span class="gene-bar"><span class="gene-fill ' + (s > 0.08 ? 'up' : (s < -0.08 ? 'down' : '')) + '" style="width:' + Math.round(g.f * 100) + '%"></span>' +
        '<span class="gene-mark" style="left:' + Math.round(DATA.GENETICS.establishedAt * 100) + '%"></span></span>' +
        '<span class="gene-pct">' + pct(g.f) + '</span>' + arrow;
      el.genes.appendChild(li);
    });
  }

  // ===================== Render — katalog cech =====================
  var STATUS_LABEL = {
    fixed: '✓ utrwalona', present: 'w populacji', possible: '🎲 może się pojawić',
    locked: '🔒 zablokowana', era_locked: '⏳ późniejsza era', excluded: '⛔ wyklucza się'
  };
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
    var status = Engine.traitStatus(DATA, state, lineage, trait);
    var div = document.createElement('div');
    div.className = 'trait ' + status + (trait.path === 'intelligence' ? ' path-intel' : '');
    var label = STATUS_LABEL[status];
    if (status === 'present') label = pct(Engine.geneFreq(lineage, trait.id)) + ' populacji';
    var extra = '';
    if (status === 'locked') {
      var missing = trait.requires.filter(function (id) { return !Engine.isEstablished(DATA, lineage, id); });
      extra = '<div class="trait-req">🔒 Wymaga (≥50%): <strong>' + missing.map(function (id) { return TRAITS_BY_ID[id].name; }).join(', ') + '</strong></div>';
    } else if (status === 'era_locked') {
      extra = '<div class="trait-req">⏳ Może się pojawić od ery: <strong>' + DATA.ERAS[trait.minEra].name + '</strong></div>';
    } else if (status === 'excluded') {
      extra = '<div class="trait-req">⛔ Wyklucza się z: <strong>' + trait.excludes.map(function (id) { return TRAITS_BY_ID[id].name; }).join(', ') + '</strong></div>';
    }
    div.innerHTML = '<div class="trait-head"><span class="trait-name">' + (trait.path === 'intelligence' ? '⭐ ' : '') + trait.icon + ' ' + trait.name + '</span>' +
      '<span class="trait-cost">' + label + '</span></div>' +
      '<div class="trait-desc">' + trait.desc + '</div>' + traitDetails(trait) +
      '<div class="trait-tradeoff">⚖ ' + trait.tradeoff + '</div>' + extra;
    return div;
  }

  // ===================== Akcje =====================
  function onSpeciate() {
    var can = Engine.canSpeciate(DATA, state);
    if (!can.ok) { flash(can.error); return; }
    var a = Engine.getActiveLineage(state);
    el.speciateHint.textContent = 'Część populacji „' + a.name + '” (połowa) zakłada nową gałąź za ' + DATA.COSTS.speciate +
      ' ZG. Obie linie będą ewoluować niezależnie. Osiedlenie gałęzi w innej niszy rozkłada ryzyko i unika konkurencji między Twoimi liniami.';
    el.speciateName.value = a.name + ' ' + roman(state.nextLineageNum + 1);
    el.speciateNiches.innerHTML = '';
    var firstFree = null;
    Engine.availableNiches(DATA, a).forEach(function (k) {
      var taken = Engine.aliveLineages(state).some(function (l) { return l.niche === k; });
      if (!taken && !firstFree) firstFree = k;
    });
    Engine.availableNiches(DATA, a).forEach(function (k) {
      var id = 'sp-niche-' + k;
      var lab = document.createElement('label'); lab.className = 'speciate-niche'; lab.htmlFor = id;
      lab.innerHTML = '<input type="radio" name="sp-niche" id="' + id + '" value="' + k + '"' + (k === (firstFree || a.niche) ? ' checked' : '') + '> ' +
        nicheIcon(k) + ' ' + nicheLabel(k) + (k === a.niche ? ' <small>(ta sama nisza — konkurencja)</small>' : '');
      el.speciateNiches.appendChild(lab);
    });
    openModal(el.modalSpeciate); el.speciateName.focus(); el.speciateName.select();
  }
  function roman(n) { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n); }
  function confirmSpeciate() {
    var base = Engine.getActiveLineage(state).name;
    var name = (el.speciateName.value || '').trim() || (base + ' II');
    var checked = el.speciateNiches.querySelector('input:checked');
    var res = Engine.speciate(DATA, state, name, checked ? checked.value : undefined);
    closeModal(el.modalSpeciate);
    if (!res.ok) { flash(res.error); return; }
    commit(res.state);
  }
  function onSimulate() {
    var waiting = Engine.aliveLineages(state).filter(function (l) { return l.picksUsed === 0 && l.draft.length; });
    if (waiting.length) {
      openConfirm('Linie bez wybranej mutacji: ' + waiting.map(function (l) { return l.name; }).join(', ') +
        '. Wybór za darmo przepadnie. Kontynuować?', doSimulate);
    } else doSimulate();
  }
  function doSimulate() {
    var res = Engine.simulateTurn(DATA, state);
    if (!res.report) return;
    pushUndo(); state = res.state; save(); renderAll(); showReport(res.report);
  }
  function renderAll() {
    renderStatus(); renderTimeline(); renderLineageBar(); renderNicheMap();
    renderActiveLineage(); renderForecast(); renderEnv(); renderObjectives();
    renderDraft(); renderGenes(); renderTraits(); updateUndoButton();
    el.btnSimulate.disabled = (state.status !== 'playing');
  }

  // ===================== Raport tury =====================
  function showReport(report) {
    if (report.eraChanged) {
      el.reportEra.hidden = false;
      el.reportEra.innerHTML = '🏛️ Nowa era: <strong>' + report.newEraName + '</strong><br>' +
        '<span class="report-era-milestone">' + eraMilestone(report.newEraName) + '</span>';
    } else el.reportEra.hidden = true;

    if (report.event) {
      el.reportEvent.hidden = false;
      el.reportEvent.className = 'report-event-banner ' + (report.event.good ? 'good' : 'bad');
      el.reportEvent.textContent = report.event.icon + ' ' + report.event.name + ' — ' + report.event.desc;
    } else el.reportEvent.hidden = true;

    if (report.objectivesDone.length) {
      el.reportObjectives.hidden = false;
      el.reportObjectives.innerHTML = report.objectivesDone.map(function (o) { return '🎯 Cel osiągnięty: <strong>' + o.text + '</strong> (+' + o.reward + ' ZG)'; }).join('<br>');
    } else el.reportObjectives.hidden = true;

    el.reportBody.innerHTML = '';
    report.lineReports.forEach(function (lr) {
      var block = document.createElement('div'); block.className = 'report-lineage';
      var head = document.createElement('div'); head.className = 'report-lineage-head';
      head.textContent = (lr.alive ? nicheIcon(lr.niche) + ' ' : '🦴 ') + lr.name;
      block.appendChild(head);
      lr.events.forEach(function (txt) {
        var d = document.createElement('div'); d.className = 'report-event';
        if (/Katastrofa|wymarła|minimalnej/.test(txt)) d.className += ' danger';
        d.textContent = txt; block.appendChild(d);
      });
      block.appendChild(line('Populacja', lr.popBefore + ' → ' + lr.popAfter, lr.popAfter >= lr.popBefore ? 'pos' : 'neg'));
      var losses = [];
      if (lr.births > 0) losses.push('<span class="fc pos">+' + lr.births + ' narodziny</span>');
      if (lr.predationDeaths > 0) losses.push('−' + lr.predationDeaths + ' drapieżniki');
      if (lr.starvationDeaths > 0) losses.push('−' + lr.starvationDeaths + ' głód');
      if (lr.crowdDeaths > 0) losses.push('−' + lr.crowdDeaths + ' tłok');
      if (lr.diseaseDeaths > 0) losses.push('−' + lr.diseaseDeaths + ' choroba');
      if (lr.catDeaths > 0) losses.push('−' + lr.catDeaths + ' katastrofa');
      if (losses.length) { var ls = document.createElement('div'); ls.className = 'report-parts'; ls.innerHTML = losses.join(' · '); block.appendChild(ls); }

      if (lr.geneChanges.length) {
        var gc = document.createElement('div'); gc.className = 'report-genes';
        gc.innerHTML = '<div class="report-genes-title">Dobór naturalny w akcji:</div>' + lr.geneChanges.map(function (c) {
          var t = TRAITS_BY_ID[c.id];
          var cls = c.to > c.from ? 'pos' : (c.to < c.from ? 'neg' : '');
          var why = c.fixed ? ' ✓ utrwalona' : (c.lost ? ' ✗ zanikła' : '');
          var driftNote = Math.abs(c.drift) >= 0.03 && Math.abs(c.drift) > Math.abs(c.to - c.from - c.drift) ? ' <small title="Zmiana głównie przypadkowa">🎲 dryf</small>' : '';
          return '<div class="gene-change"><span>' + t.icon + ' ' + t.name + '</span><span class="fc ' + cls + '">' + pct(c.from) + ' → ' + pct(c.to) + why + '</span>' + driftNote + '</div>';
        }).join('');
        block.appendChild(gc);
      }
      block.appendChild(line('Inteligencja', fmt(lr.intelligence) + ' / ' + report.intelligenceGoal, 'plain'));
      el.reportBody.appendChild(block);
    });

    var sum = document.createElement('div'); sum.className = 'report-summary';
    sum.appendChild(line('Łączna populacja', report.totalPopulation, 'plain'));
    var b = report.zgBreakdown, zparts = [];
    if (b.base) zparts.push('przetrwanie +' + b.base);
    if (b.population) zparts.push('liczebność +' + b.population);
    if (b.niches) zparts.push('nisze +' + b.niches);
    if (b.objectives) zparts.push('cele +' + b.objectives);
    sum.appendChild(line('Zmienność genetyczna', '+' + report.zgGain + ' ZG', 'pos'));
    if (zparts.length) { var zp = document.createElement('div'); zp.className = 'report-parts'; zp.textContent = '(' + zparts.join(', ') + ')'; sum.appendChild(zp); }
    if (report.predatorLevel > 2) sum.appendChild(line('Koewolucja drapieżników', '↑ ' + fmt(report.predatorLevel), 'neg'));
    if (report.radiation.length) {
      var rad = document.createElement('div'); rad.className = 'report-event good';
      rad.textContent = '🌈 Katastrofa przetrzebiła konkurentów w niszach: ' + report.radiation.map(nicheLabel).join(', ') + '. Ocalali mają teraz szansę na radiację adaptacyjną!';
      sum.appendChild(rad);
    }
    el.reportBody.appendChild(sum);

    el.reportKnowledge.innerHTML = '';
    report.knowledge.forEach(function (key) {
      var k = DATA.KNOWLEDGE[key]; if (!k) return;
      var card = document.createElement('div'); card.className = 'knowledge-card';
      card.innerHTML = '<h4>' + (k.icon || '💡') + ' ' + k.title + '</h4><p>' + k.body + '</p>' +
        (k.fossil ? '<p class="knowledge-fossil">' + T('codex.fossil') + k.fossil + '</p>' : '');
      el.reportKnowledge.appendChild(card);
    });

    el.btnReportClose.textContent = (state.status === 'playing' || state.quizPending) ? T('report.next') : T('report.summary');
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
  function onReportClose() {
    closeModal(el.modalReport);
    if (state.quizPending) showQuiz();
    else if (state.status !== 'playing') showEnd();
  }

  // ===================== Quiz =====================
  function showQuiz() {
    var q = DATA.QUIZZES[state.quizPending];
    if (!q) { state.quizPending = null; return; }
    el.quizQuestion.textContent = q.q;
    el.quizOptions.innerHTML = '';
    el.quizFeedback.hidden = true; el.btnQuizNext.hidden = true;
    q.options.forEach(function (opt, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-ghost quiz-option'; b.textContent = opt;
      b.addEventListener('click', function () { onQuizAnswer(i); });
      el.quizOptions.appendChild(b);
    });
    openModal(el.modalQuiz);
  }
  function onQuizAnswer(i) {
    var qid = state.quizPending, q = DATA.QUIZZES[qid];
    var res = Engine.answerQuiz(DATA, state, i);
    if (!res.ok) return;
    state = res.state; save();
    Array.prototype.forEach.call(el.quizOptions.children, function (b, j) {
      b.disabled = true;
      if (j === q.correct) b.classList.add('correct');
      else if (j === i) b.classList.add('wrong');
    });
    el.quizFeedback.hidden = false;
    el.quizFeedback.className = 'quiz-feedback ' + (res.correct ? 'good' : 'bad');
    el.quizFeedback.innerHTML = (res.correct ? '✅ Dobrze! +' + res.reward + ' ZG. ' : '❌ Nie tym razem. ') + res.explain;
    el.btnQuizNext.hidden = false; el.btnQuizNext.focus();
    renderAll();
  }
  function onQuizNext() {
    closeModal(el.modalQuiz);
    if (state.status !== 'playing') showEnd();
  }

  // ===================== Drzewo życia =====================
  function showTree() {
    el.treeContainer.innerHTML = buildTreeSvg();
    Array.prototype.forEach.call(el.treeContainer.querySelectorAll('[data-lineage]'), function (n) {
      var id = n.getAttribute('data-lineage'); var lin = Engine.getLineage(state, id);
      if (lin && lin.alive) {
        n.style.cursor = 'pointer';
        n.addEventListener('click', function () { closeModal(el.modalTree); onSelectLineage(id); });
      }
    });
    openModal(el.modalTree);
  }
  function buildTreeSvg() {
    var lineages = state.lineages, rowH = 46, topPad = 24, leftPad = 90, rightPad = 170, innerW = 600;
    var maxT = Engine.totalTurns(DATA);
    var nowT = state.eraIndex >= DATA.ERAS.length ? maxT : Engine.globalTurn(DATA, state.eraIndex, state.turn);
    var rows = {}, order = [], childrenOf = {};
    lineages.forEach(function (l) { var p = l.parentId || '__root'; (childrenOf[p] = childrenOf[p] || []).push(l); });
    function bornGT(l) { return Engine.globalTurn(DATA, l.bornEra, l.bornTurn); }
    function dfs(l) { rows[l.id] = order.length; order.push(l); (childrenOf[l.id] || []).forEach(dfs); }
    (childrenOf['__root'] || []).forEach(dfs);

    var height = topPad * 2 + order.length * rowH;
    var xOf = function (t) { return leftPad + (t / Math.max(1, maxT)) * innerW; };
    var yOf = function (id) { return topPad + rows[id] * rowH + rowH / 2; };
    var svg = '<svg viewBox="0 0 ' + (leftPad + innerW + rightPad) + ' ' + height + '" width="100%" role="img" aria-label="Drzewo życia">';
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
      if (l.parentId) svg += '<line x1="' + xStart + '" y1="' + yOf(l.parentId) + '" x2="' + xStart + '" y2="' + y + '" stroke="var(--line)" stroke-width="2"/>';
      svg += '<line x1="' + xStart + '" y1="' + y + '" x2="' + xEnd + '" y2="' + y + '" stroke="' + color +
        '" stroke-width="' + (isActive ? 4 : 2.5) + '" ' + (l.alive ? '' : 'stroke-dasharray="4 3" ') + 'stroke-linecap="round"/>';
      svg += '<g data-lineage="' + l.id + '"><circle cx="' + xEnd + '" cy="' + y + '" r="' + (isActive ? 6 : 4.5) + '" fill="' + color +
        '"' + (isActive ? ' stroke="var(--accent)" stroke-width="2"' : '') + '/>' +
        '<text x="' + (xEnd + 10) + '" y="' + (y + 4) + '" font-size="12" fill="var(--ink)" ' + (isActive ? 'font-weight="700"' : '') + '>' +
        escapeHtml(l.name) + (l.alive ? ' ' + nicheIcon(l.niche) + ' (' + l.population + ', 🧠' + fmt(Engine.lineageIntelligence(DATA, l)) + ')' : ' †') + '</text></g>';
    });
    return svg + '</svg>';
  }

  // ===================== Ekran końcowy =====================
  function showEnd() {
    clearSave();
    var s = state.status;
    var score = Engine.computeScore(DATA, state);
    var record = storeBest(state.scenario, score.total);
    el.endEmblem.textContent = s === 'won' ? '🧠' : (s === 'survived' ? '🐾' : '🦴');
    el.endTitle.textContent = s === 'won' ? 'Narodziny inteligencji!' :
      (s === 'survived' ? 'Gatunek przetrwał wszystkie ery' : 'Wszystkie linie wygasły');
    el.endSummary.textContent =
      s === 'won'
        ? 'Jedna z Twoich linii przekroczyła próg inteligencji. Duży mózg utrwalił się, bo w Twoich niszach jego przewagi przeważyły nad ogromnym kosztem energetycznym.'
        : s === 'survived'
        ? 'Twoje linie przetrwały wszystkie ery, ale żadna nie osiągnęła progu rozumności. Dobór utrwala to, co opłaca się TERAZ — aby mózg się rozprzestrzenił, potrzebuje obfitego pokarmu, stałocieplności i wymagającego środowiska.'
        : 'Wszystkie linie rozwojowe wymarły. W historii Ziemi wymarło ponad 99% gatunków. Rozkładaj ryzyko (specjacja, różne nisze) i przygotuj odporność przed zapowiedzianymi katastrofami.';
    el.endScore.innerHTML = '<div class="end-score-total">' + score.total + '<small> pkt</small></div>' +
      (record ? '<div class="end-record">🏅 Nowy rekord scenariusza!</div>' : '') +
      '<div class="end-score-parts">' + scoreParts(score).map(function (p) { return '<span>' + p + '</span>'; }).join('') + '</div>';
    el.endStats.innerHTML = '';
    endStat('Liczba linii rozwojowych', state.lineages.length);
    endStat('Szczytowa łączna populacja', state.peakTotalPop);
    endStat('Najwyższa inteligencja', fmt(Engine.maxIntelligence(DATA, state)) + ' / ' + state.intelligenceGoal);
    endStat('Zajęte nisze', state.nichesEver.map(nicheIcon).join(' '));
    endStat('Odkryte pojęcia w Kodeksie', state.unlockedKnowledge.length);
    el.endSeed.innerHTML = 'Kod świata: <strong>' + state.seed + '</strong> — podaj go innym, by zagrali w tym samym świecie.';
    showScreen('end');
  }
  function scoreParts(score) {
    var p = score.parts, L = [];
    var names = { turns: 'przetrwane tury', population: 'szczyt populacji', niches: 'nisze', lineages: 'żywe linie',
      intelligence: 'inteligencja', objectives: 'cele ery', quiz: 'quiz', victory: 'zwycięstwo' };
    for (var k in p) if (p[k]) L.push(names[k] + ' +' + p[k]);
    if (score.mult !== 1) L.push('× ' + String(score.mult).replace('.', ',') + ' (trudność)');
    return L;
  }
  function endStat(label, value) {
    var li = document.createElement('li'); li.innerHTML = '<span>' + label + '</span><strong>' + value + '</strong>';
    el.endStats.appendChild(li);
  }

  // ===================== Eksport podsumowania =====================
  function buildSummaryText() {
    if (!state) return '';
    var statusPl = state.status === 'won' ? 'Zwycięstwo (osiągnięto inteligencję)' :
      (state.status === 'survived' ? 'Przetrwanie (bez rozumności)' : (state.status === 'lost' ? 'Wymarcie' : 'Gra w toku'));
    var sc = DATA.SCENARIOS.filter(function (x) { return x.id === state.scenario; })[0];
    var diff = DATA.DIFFICULTIES[state.difficulty];
    var score = Engine.computeScore(DATA, state);
    var L = ['EWOLUCJA — podsumowanie gry', '============================',
      'Scenariusz: ' + (sc ? sc.name : state.scenario) + ' (trudność: ' + (diff ? diff.label : state.difficulty) + ')',
      'Kod świata: ' + state.seed,
      'Wynik: ' + statusPl, 'Punkty: ' + score.total + ' (' + scoreParts(score).join(', ') + ')',
      'Najwyższa inteligencja: ' + fmt(Engine.maxIntelligence(DATA, state)) + ' / ' + state.intelligenceGoal,
      'Liczba linii rozwojowych: ' + state.lineages.length,
      'Szczytowa łączna populacja: ' + state.peakTotalPop,
      'Cele ery: ' + state.objectivesDone.length + ', poprawne odpowiedzi w quizie: ' +
        Object.keys(state.quizResults).filter(function (k) { return state.quizResults[k]; }).length,
      'Odkryte pojęcia w Kodeksie: ' + state.unlockedKnowledge.length, '', 'Linie rozwojowe:'];
    state.lineages.forEach(function (l) {
      L.push('  • ' + l.name + ' — ' + (l.alive ? 'żywa' : 'wymarła') +
        ', nisza: ' + nicheLabel(l.niche) + ', inteligencja: ' + fmt(Engine.lineageIntelligence(DATA, l)) +
        ', cechy: ' + (l.genes.length ? l.genes.map(function (g) { return TRAITS_BY_ID[g.id].name + ' ' + pct(g.f); }).join(', ') : 'brak'));
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
    var unlocked = (state ? state.unlockedKnowledge : ['intro', 'no_goal']), any = false;
    Object.keys(DATA.KNOWLEDGE).forEach(function (key) {
      if (unlocked.indexOf(key) === -1) return; any = true;
      var k = DATA.KNOWLEDGE[key];
      var card = document.createElement('div'); card.className = 'knowledge-card';
      card.innerHTML = '<h4>' + (k.icon || '💡') + ' ' + k.title + '</h4><p>' + k.body + '</p>' +
        (k.fossil ? '<p class="knowledge-fossil">' + T('codex.fossil') + k.fossil + '</p>' : '');
      el.codexBody.appendChild(card);
    });
    var total = Object.keys(DATA.KNOWLEDGE).length;
    var prog = document.createElement('p'); prog.className = 'panel-hint';
    prog.textContent = 'Odkryto ' + unlocked.length + ' z ' + total + ' pojęć.';
    el.codexBody.insertBefore(prog, el.codexBody.firstChild);
    if (!any) el.codexBody.innerHTML = '<p class="codex-empty">Kodeks jest jeszcze pusty — graj, aby odkrywać pojęcia.</p>';
    openModal(el.modalCodex);
  }

  // ===================== Samouczek =====================
  var tutorialSteps = [
    { title: 'Witaj w Ewolucji!', text: 'Prowadzisz nie pojedyncze zwierzę, lecz całą populację. Cel: doprowadzić którąkolwiek linię do progu inteligencji — ale nie da się jej „kupić”. Trzeba stworzyć warunki, w których dobór naturalny ją utrwali.' },
    { title: '🎲 Mutacje', text: 'Co turę w populacji pojawiają się 3 losowe mutacje. Wskaż jedną (za darmo) — trafi do ok. 30% osobników. Kolejne w tej samej turze i ponowne losowanie kosztują 🧬 Zmienność (ZG).' },
    { title: '📈 Dobór decyduje', text: 'W „Puli genowej” widać częstość każdej cechy. Jeśli cecha pomaga przeżyć w obecnej niszy i klimacie, rośnie (↑) aż do utrwalenia; jeśli szkodzi — zanika (↓). Najedź na mutację, by zobaczyć prognozę.' },
    { title: '🗺️ Nisze i konkurencja', text: 'Cztery nisze mają inny pokarm, drapieżniki i konkurentów. Migracja zmienia warunki, a więc i kierunek doboru — płetwy pomagają w wodzie, kończyny na płyciznach i lądzie. Ląd otwiera się, gdy kończyny ma choć 25% populacji.' },
    { title: '🔭 Zapowiedź i katastrofy', text: 'Widzisz warunki następnej tury i zapowiedź kolejnej. Katastrofy mają rodzaj (zimno, beztlenowość, impakt) — cechy odporne warto rozprzestrzenić zawczasu. Specjacja do innej niszy rozkłada ryzyko.' },
    { title: '⭐ Droga do rozumu', text: 'Zwoje → Mózg → Rozbudowany mózg (wymaga stałocieplności) → życie społeczne, komunikacja, narzędzia. Mózg jest drogi energetycznie: rozprzestrzeni się tylko przy dobrym odżywianiu. Każdy świat jest inny — powodzenia!' }
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
  function openModal(m) {
    lastFocused = document.activeElement; m.hidden = false;
    var f = m.querySelector('button:not([hidden]), input'); if (f) f.focus({ preventScroll: true });
    var box = m.querySelector('.modal-box'); if (box) box.scrollTop = 0;
  }
  function closeModal(m) { m.hidden = true; if (lastFocused && lastFocused.focus && document.body.contains(lastFocused)) lastFocused.focus(); }
  var flashTimer = null;
  function flash(msg) {
    var b = el.btnSimulate;
    if (!b.dataset.label) b.dataset.label = b.textContent;
    b.textContent = msg; b.classList.add('flash-msg');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { b.textContent = b.dataset.label; b.classList.remove('flash-msg'); delete b.dataset.label; }, 1800);
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var confirmCallback = null;
  function openConfirm(msg, cb) { el.confirmMessage.textContent = msg; confirmCallback = cb; openModal(el.modalConfirm); }
  function resolveConfirm(yes) { closeModal(el.modalConfirm); var cb = confirmCallback; confirmCallback = null; if (yes && cb) cb(); }

  // ===================== Inicjalizacja =====================
  function init() {
    window.GameI18n.applyStatic(document);
    el.introGoal.innerHTML = '🎯 <strong>Cel:</strong> doprowadź którąkolwiek linię do progu inteligencji ' +
      'przez ery (' + DATA.ERAS.map(function (e) { return e.name; }).join(', ') + '). ' +
      'Wybieraj mutacje, migruj między niszami i rozgałęziaj linie — ale pamiętaj: o tym, co się utrwali, decyduje dobór naturalny. ' +
      'Za każdą grę dostajesz wynik punktowy.';

    renderScenarios();
    el.formStart.addEventListener('submit', function (e) {
      e.preventDefault();
      newGame((el.speciesInput.value || '').trim() || 'Prazwierzę', scenarioOpts(DATA.SCENARIOS[0]));
    });
    el.btnDaily.addEventListener('click', function () { el.seedInput.value = String(Engine.dailySeed()); el.seedInput.focus(); });
    el.btnSimulate.addEventListener('click', onSimulate);
    el.btnUndo.addEventListener('click', onUndo);
    el.btnReroll.addEventListener('click', onReroll);
    el.btnSpeciate.addEventListener('click', onSpeciate);
    el.btnTree.addEventListener('click', showTree);
    el.btnReportClose.addEventListener('click', onReportClose);
    el.btnQuizNext.addEventListener('click', onQuizNext);
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

    function toStart() { state = null; undoStack = []; el.speciesInput.value = ''; renderScenarios(); showScreen('start'); }
    el.btnRestart.addEventListener('click', function () {
      if (state && state.status === 'playing') openConfirm('Rozpocząć nową grę? Bieżący postęp zostanie utracony.', function () { clearSave(); toStart(); });
      else { clearSave(); toStart(); }
    });
    el.btnPlayAgain.addEventListener('click', toStart);

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
    if (saved) {
      state = saved; showScreen('game'); renderAll();
      if (state.quizPending) showQuiz();
    } else showScreen('start');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
