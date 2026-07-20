/*
 * ui.js — kontroler interfejsu.
 *
 * Spina dane (GameData) i silnik (Engine) z DOM. Cała logika gry jest w
 * silniku; tutaj tylko renderowanie, obsługa zdarzeń, zapis lokalny oraz
 * cofanie akcji (tryb nauczyciela).
 */
(function () {
  'use strict';

  var DATA = window.GameData;
  var Engine = window.Engine;
  var SAVE_KEY = 'ewolucja.save.v2';

  var state = null;       // bieżący stan gry
  var undoStack = [];     // migawki stanu do cofania (tryb nauczyciela)
  var UNDO_LIMIT = 50;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    screenStart: $('screen-start'), screenGame: $('screen-game'), screenEnd: $('screen-end'),
    formStart: $('form-start'), speciesInput: $('species-name'), introGoal: $('intro-goal'),
    ep: $('ep-value'), pop: $('pop-value'), turn: $('turn-value'), intel: $('intel-value'),
    timeline: $('era-timeline'),
    lineageChips: $('lineage-chips'), btnSpeciate: $('btn-speciate'), btnTree: $('btn-tree'),
    speciesName: $('species-name-display'), sparkline: $('sparkline'),
    statsList: $('stats-list'),
    envName: $('env-name'), envNote: $('env-note'), envStats: $('env-stats'),
    traits: $('traits-container'),
    btnSimulate: $('btn-simulate'), btnUndo: $('btn-undo'),
    modalReport: $('modal-report'), reportBody: $('report-body'),
    reportKnowledge: $('report-knowledge'), btnReportClose: $('btn-report-close'),
    modalCodex: $('modal-codex'), codexBody: $('codex-body'), btnCodexClose: $('btn-codex-close'),
    modalTree: $('modal-tree'), treeContainer: $('tree-container'), btnTreeClose: $('btn-tree-close'),
    endEmblem: $('end-emblem'), endTitle: $('end-title'), endSummary: $('end-summary'),
    endStats: $('end-stats'), btnPlayAgain: $('btn-play-again'), btnOpenCodexEnd: $('btn-open-codex-end'),
    btnCodex: $('btn-codex'), btnRestart: $('btn-restart')
  };

  var STAT_META = [
    { key: 'feeding', label: 'Odżywianie' }, { key: 'defense', label: 'Obrona' },
    { key: 'reproduction', label: 'Rozród' }, { key: 'mobility', label: 'Mobilność' },
    { key: 'metabolism', label: 'Metabolizm' }, { key: 'intelligence', label: 'Inteligencja' }
  ];

  // ===================== Zapis / wczytanie =====================
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function loadSaved() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s && s.version === 2 && s.status === 'playing') return s;
      return null;
    } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

  // ===================== Cofanie (tryb nauczyciela) =====================
  function pushUndo() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }
  function onUndo() {
    if (!undoStack.length) return;
    state = JSON.parse(undoStack.pop());
    save();
    renderAll();
  }
  function updateUndoButton() {
    el.btnUndo.disabled = (undoStack.length === 0);
    el.btnUndo.textContent = '↶ Cofnij' +
      (undoStack.length ? ' (' + undoStack.length + ')' : '') + ' — tryb nauczyciela';
  }

  // ===================== Nawigacja ekranów =====================
  function showScreen(name) {
    el.screenStart.hidden = name !== 'start';
    el.screenGame.hidden = name !== 'game';
    el.screenEnd.hidden = name !== 'end';
  }

  function newGame(speciesName) {
    state = Engine.createInitialState(DATA, speciesName);
    undoStack = [];
    save();
    showScreen('game');
    renderAll();
  }

  // ===================== Render — pasek stanu =====================
  function renderStatus() {
    el.ep.textContent = state.ep;
    el.pop.textContent = Engine.totalPopulation(state);
    el.turn.textContent = state.turn + ' / ' + state.maxTurns;
    el.intel.textContent = Engine.maxIntelligence(state) + ' / ' + state.intelligenceGoal;
  }

  // ===================== Render — oś czasu =====================
  function renderTimeline() {
    el.timeline.innerHTML = '';
    DATA.ERA.turns.forEach(function (t, i) {
      var step = document.createElement('div');
      step.className = 'era-step';
      if (i < state.turn) step.classList.add('done');
      if (i === state.turn) step.classList.add('current');
      step.title = t.title;
      step.innerHTML = '<span class="era-step-num">' + (i + 1) + '</span>' + t.title.split(' — ')[0];
      el.timeline.appendChild(step);
    });
  }

  // ===================== Render — linie rozwojowe =====================
  function renderLineageBar() {
    el.lineageChips.innerHTML = '';
    state.lineages.forEach(function (l) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'lineage-chip';
      if (!l.alive) chip.classList.add('extinct');
      if (l.id === state.activeLineageId) chip.classList.add('active');
      chip.disabled = !l.alive;
      chip.innerHTML = (l.alive ? '🐾 ' : '🦴 ') + escapeHtml(l.name) +
        '<span class="lineage-chip-pop">' + (l.alive ? l.population : 'wymarła') + '</span>';
      if (l.alive) chip.addEventListener('click', function () { onSelectLineage(l.id); });
      el.lineageChips.appendChild(chip);
    });

    // Dostępność specjacji.
    var can = Engine.canSpeciate(DATA, state);
    el.btnSpeciate.disabled = !can.ok || state.status !== 'playing';
    el.btnSpeciate.title = can.ok
      ? 'Rozdziel aktywną linię na dwie gałęzie (koszt ' + DATA.SPECIATION_COST + ' EP)'
      : can.error;
  }

  function onSelectLineage(id) {
    state = Engine.setActiveLineage(state, id);
    save();
    renderActiveLineage();
    renderLineageBar();
    renderTraits();
  }

  // ===================== Render — aktywna linia =====================
  function renderActiveLineage() {
    var l = Engine.getActiveLineage(state);
    el.speciesName.textContent = l.name;
    renderStats(l);
    renderSparkline(l);
  }

  function renderStats(lineage) {
    el.statsList.innerHTML = '';
    var maxScale = 20;
    STAT_META.forEach(function (m) {
      var val = lineage.stats[m.key];
      var pct = Math.max(0, Math.min(100, (val / maxScale) * 100));
      var li = document.createElement('li');
      li.className = 'stat-row';
      li.innerHTML =
        '<span class="stat-name">' + m.label + '</span>' +
        '<span class="stat-bar"><span class="stat-fill ' + m.key + '" style="width:' + pct + '%"></span></span>' +
        '<span class="stat-num">' + val + '</span>';
      el.statsList.appendChild(li);
    });
  }

  // ===================== Render — wykres populacji (sparkline) =====================
  function renderSparkline(lineage) {
    var data = lineage.popHistory;
    var w = 260, h = 46, pad = 4;
    if (!data || data.length < 2) {
      el.sparkline.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '">' +
        '<line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) + '" y2="' + (h - pad) +
        '" stroke="var(--line)" stroke-width="1"/></svg>';
      return;
    }
    var max = Math.max.apply(null, data);
    var min = Math.min.apply(null, data);
    var range = Math.max(1, max - min);
    var stepX = (w - 2 * pad) / (data.length - 1);
    var pts = data.map(function (v, i) {
      var x = pad + i * stepX;
      var y = (h - pad) - ((v - min) / range) * (h - 2 * pad);
      return Math.round(x) + ',' + Math.round(y);
    });
    var last = pts[pts.length - 1].split(',');
    var area = 'M' + pad + ',' + (h - pad) + ' L' + pts.join(' L') + ' L' + (w - pad) + ',' + (h - pad) + ' Z';
    el.sparkline.innerHTML =
      '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none">' +
      '<path d="' + area + '" fill="var(--brand)" opacity="0.12"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--brand)" stroke-width="2" ' +
      'stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" fill="var(--brand)"/>' +
      '</svg>';
  }

  // ===================== Render — środowisko =====================
  function renderEnv() {
    if (state.turn >= state.maxTurns) {
      el.envName.textContent = 'Era dobiega końca';
      el.envNote.textContent = 'To była ostatnia tura tej ery.';
      el.envStats.innerHTML = '';
      return;
    }
    var env = DATA.ERA.turns[state.turn];
    el.envName.textContent = env.title;
    el.envNote.textContent = env.note;
    el.envStats.innerHTML =
      chip('Klimat: ' + climateLabel(env.climate)) + chip('Tlen: ' + env.oxygen) +
      chip('Pokarm: ' + env.food) + chip('Drapieżniki: ' + env.predators) +
      (env.land ? chip('🏝️ ląd dostępny') : '');
  }
  function chip(text) { return '<li>' + text + '</li>'; }
  function climateLabel(c) {
    return c === 'zimno' ? '❄️ zimno' : (c === 'cieplo' ? '☀️ ciepło' : '⛅ umiarkowanie');
  }

  // ===================== Render — drzewo cech =====================
  function renderTraits() {
    el.traits.innerHTML = '';
    var lineage = Engine.getActiveLineage(state);
    Object.keys(DATA.CATEGORIES).forEach(function (catKey) {
      var traitsInCat = DATA.TRAITS.filter(function (t) { return t.category === catKey; });
      if (!traitsInCat.length) return;
      var section = document.createElement('div');
      section.className = 'trait-category';
      var h3 = document.createElement('h3');
      h3.textContent = DATA.CATEGORIES[catKey];
      section.appendChild(h3);
      var grid = document.createElement('div');
      grid.className = 'trait-grid';
      traitsInCat.forEach(function (trait) { grid.appendChild(renderTraitCard(trait, lineage)); });
      section.appendChild(grid);
      el.traits.appendChild(section);
    });
  }

  function renderTraitCard(trait, lineage) {
    var status = Engine.traitStatus(state, trait);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trait ' + status;
    btn.disabled = (status !== 'available') || state.status !== 'playing';
    var costLabel = status === 'owned' ? '✓ zdobyta' : (trait.cost + ' EP');
    var reqHtml = status === 'locked'
      ? '<div class="trait-req">Wymaga: ' + reqNames(trait.requires) + '</div>' : '';
    btn.innerHTML =
      '<div class="trait-head"><span class="trait-name">' + trait.name + '</span>' +
      '<span class="trait-cost">' + costLabel + '</span></div>' +
      '<div class="trait-desc">' + trait.desc + '</div>' +
      '<div class="trait-effects">' + renderEffects(trait.effects) + '</div>' +
      '<div class="trait-tradeoff">⚖ ' + trait.tradeoff + '</div>' + reqHtml;
    if (status === 'available' && state.status === 'playing') {
      btn.addEventListener('click', function () { onBuyTrait(trait.id); });
    }
    return btn;
  }

  function renderEffects(effects) {
    var html = '';
    for (var key in effects) {
      if (!Object.prototype.hasOwnProperty.call(effects, key)) continue;
      var v = effects[key];
      html += '<span class="effect-chip ' + (v > 0 ? 'up' : 'down') + '">' +
        Engine.statLabel(key) + ' ' + (v > 0 ? '+' : '') + v + '</span>';
    }
    return html;
  }
  function reqNames(reqIds) {
    return reqIds.map(function (id) {
      var t = DATA.TRAITS.filter(function (x) { return x.id === id; })[0];
      return t ? t.name : id;
    }).join(', ');
  }

  // ===================== Akcje =====================
  function onBuyTrait(traitId) {
    var res = Engine.buyTrait(DATA, state, traitId);
    if (!res.ok) { flash(res.error); return; }
    pushUndo();
    state = res.state;
    save();
    renderStatus(); renderActiveLineage(); renderTraits(); renderLineageBar(); updateUndoButton();
  }

  function onSpeciate() {
    var can = Engine.canSpeciate(DATA, state);
    if (!can.ok) { flash(can.error); return; }
    var base = Engine.getActiveLineage(state).name;
    var name = window.prompt('Nazwa nowej gałęzi (specjacja z „' + base + '”):', base + ' II');
    if (name === null) return; // anulowano
    var res = Engine.speciate(DATA, state, name.trim() || (base + ' II'));
    if (!res.ok) { flash(res.error); return; }
    pushUndo();
    state = res.state;
    save();
    renderAll();
  }

  function onSimulate() {
    var res = Engine.simulateTurn(DATA, state);
    if (!res.report) return;
    pushUndo();
    state = res.state;
    save();
    renderAll();
    showReport(res.report);
  }

  function renderAll() {
    renderStatus(); renderTimeline(); renderLineageBar();
    renderActiveLineage(); renderEnv(); renderTraits(); updateUndoButton();
    el.btnSimulate.disabled = (state.status !== 'playing');
  }

  // ===================== Modal: raport tury =====================
  function showReport(report) {
    el.reportBody.innerHTML = '';
    var multi = report.lineReports.length > 1;

    report.lineReports.forEach(function (lr) {
      var block = document.createElement('div');
      block.className = 'report-lineage';
      if (multi) {
        var head = document.createElement('div');
        head.className = 'report-lineage-head';
        head.textContent = (lr.alive ? '🐾 ' : '🦴 ') + lr.name;
        block.appendChild(head);
      }
      lr.events.forEach(function (txt) {
        var d = document.createElement('div');
        d.className = 'report-event';
        d.textContent = txt;
        block.appendChild(d);
      });
      block.appendChild(line('Populacja', lr.popBefore + ' → ' + lr.popAfter,
        lr.popAfter >= lr.popBefore ? 'pos' : 'neg'));
      if (lr.births > 0) block.appendChild(line('Narodziny', '+' + lr.births, 'pos'));
      if (lr.predationDeaths > 0) block.appendChild(line('Straty od drapieżników', '-' + lr.predationDeaths, 'neg'));
      if (lr.starvationDeaths > 0) block.appendChild(line('Straty z głodu', '-' + lr.starvationDeaths, 'neg'));
      block.appendChild(line('Bilans energetyczny', lr.energy, lr.energy >= 0 ? 'pos' : 'neg'));
      block.appendChild(line('Inteligencja', lr.intelligence + ' / ' + report.intelligenceGoal, 'plain'));
      el.reportBody.appendChild(block);
    });

    var summary = document.createElement('div');
    summary.className = 'report-summary';
    summary.appendChild(line('Łączna populacja', report.totalPopulation, 'plain'));
    summary.appendChild(line('Zdobyte punkty ewolucji', '+' + report.epGain, 'pos'));
    el.reportBody.appendChild(summary);

    el.reportKnowledge.innerHTML = '';
    report.knowledge.forEach(function (key) {
      var k = DATA.KNOWLEDGE[key];
      if (!k) return;
      var card = document.createElement('div');
      card.className = 'knowledge-card';
      card.innerHTML = '<h4>💡 ' + k.title + '</h4><p>' + k.body + '</p>';
      el.reportKnowledge.appendChild(card);
    });

    el.btnReportClose.textContent = (state.status === 'playing') ? 'Dalej' : 'Zobacz podsumowanie';
    openModal(el.modalReport);
  }

  function line(label, value, tone) {
    var d = document.createElement('div');
    d.className = 'report-line';
    var cls = tone === 'pos' ? 'num pos' : (tone === 'neg' ? 'num neg' : 'num');
    d.innerHTML = '<span>' + label + '</span><span class="' + cls + '">' + value + '</span>';
    return d;
  }

  function onReportClose() {
    closeModal(el.modalReport);
    if (state.status !== 'playing') showEnd();
  }

  // ===================== Drzewo życia (SVG) =====================
  function showTree() {
    el.treeContainer.innerHTML = buildTreeSvg();
    // klikalne żywe gałęzie
    var nodes = el.treeContainer.querySelectorAll('[data-lineage]');
    Array.prototype.forEach.call(nodes, function (n) {
      var id = n.getAttribute('data-lineage');
      var lin = Engine.getLineage(state, id);
      if (lin && lin.alive) {
        n.style.cursor = 'pointer';
        n.addEventListener('click', function () {
          onSelectLineage(id);
          closeModal(el.modalTree);
        });
      }
    });
    openModal(el.modalTree);
  }

  /* Buduje diagram filogenetyczny: każda linia to poziomy tor od swojego
     narodzenia do wymarcia/teraz; specjacje to pionowe rozgałęzienia. */
  function buildTreeSvg() {
    var lineages = state.lineages;
    var rowH = 46, topPad = 24, leftPad = 90, rightPad = 120;
    var innerW = 560;
    var maxT = state.maxTurns;
    var rows = {};
    var order = [];
    // DFS pre-order od korzeni — każdej linii jeden tor.
    var childrenOf = {};
    lineages.forEach(function (l) {
      var p = l.parentId || '__root';
      (childrenOf[p] = childrenOf[p] || []).push(l);
    });
    function dfs(l) { rows[l.id] = order.length; order.push(l); (childrenOf[l.id] || []).forEach(dfs); }
    (childrenOf['__root'] || []).forEach(dfs);

    var height = topPad * 2 + order.length * rowH;
    var xOf = function (t) { return leftPad + (t / Math.max(1, maxT)) * innerW; };
    var yOf = function (id) { return topPad + rows[id] * rowH + rowH / 2; };

    var svg = '<svg viewBox="0 0 ' + (leftPad + innerW + rightPad) + ' ' + height +
      '" width="100%" role="img" aria-label="Drzewo życia">';

    // linie pomocnicze osi czasu
    for (var t = 0; t <= maxT; t++) {
      var x = xOf(t);
      svg += '<line x1="' + x + '" y1="' + (topPad - 6) + '" x2="' + x + '" y2="' + (height - topPad + 6) +
        '" stroke="var(--line)" stroke-width="1" opacity="0.5"/>';
      svg += '<text x="' + x + '" y="' + (height - 4) + '" text-anchor="middle" font-size="10" fill="var(--ink-soft)">' + t + '</text>';
    }

    order.forEach(function (l) {
      var y = yOf(l.id);
      var xStart = xOf(l.bornTurn);
      var endTurn = (l.extinctTurn != null) ? l.extinctTurn : state.turn;
      var xEnd = xOf(endTurn);
      if (xEnd - xStart < 10) xEnd = xStart + 10; // minimalna długość toru
      var color = l.alive ? 'var(--brand)' : 'var(--ink-soft)';
      var isActive = (l.id === state.activeLineageId);

      // pionowy łącznik od rodzica
      if (l.parentId) {
        var py = yOf(l.parentId);
        svg += '<line x1="' + xStart + '" y1="' + py + '" x2="' + xStart + '" y2="' + y +
          '" stroke="var(--line)" stroke-width="2"/>';
      }
      // poziomy tor linii
      svg += '<line x1="' + xStart + '" y1="' + y + '" x2="' + xEnd + '" y2="' + y +
        '" stroke="' + color + '" stroke-width="' + (isActive ? 4 : 2.5) + '" ' +
        (l.alive ? '' : 'stroke-dasharray="4 3" ') + 'stroke-linecap="round"/>';
      // węzeł-tip (grupa klikalna)
      svg += '<g data-lineage="' + l.id + '">';
      svg += '<circle cx="' + xEnd + '" cy="' + y + '" r="' + (isActive ? 6 : 4.5) + '" fill="' + color +
        '"' + (isActive ? ' stroke="var(--accent)" stroke-width="2"' : '') + '/>';
      svg += '<text x="' + (xEnd + 10) + '" y="' + (y + 4) + '" font-size="12" fill="var(--ink)" ' +
        (isActive ? 'font-weight="700"' : '') + '>' + escapeSvg(l.name) +
        (l.alive ? ' (' + l.population + ')' : ' †') + '</text>';
      svg += '</g>';
    });

    svg += '</svg>';
    return svg;
  }

  // ===================== Ekran końcowy =====================
  function showEnd() {
    clearSave();
    var s = state.status;
    var emblem = s === 'won' ? '🧠' : (s === 'survived' ? '🐾' : '🦴');
    var title = s === 'won' ? 'Narodziny inteligencji!' :
                (s === 'survived' ? 'Gatunek przetrwał erę' : 'Wszystkie linie wygasły');
    var summary =
      s === 'won'
        ? 'Jedna z Twoich linii osiągnęła próg inteligencji — na horyzoncie kultura i technologia. ' +
          'To efekt konsekwentnych inwestycji w układ nerwowy mimo presji środowiska.'
        : s === 'survived'
        ? 'Twoje linie przetrwały cały paleozoik, ale żadna nie rozwinęła dostatecznie mózgu. ' +
          'Dobre przetrwanie to nie to samo co droga do rozumności — spróbuj mocniej zainwestować ' +
          'w układ nerwowy, a specjacją rozłóż ryzyko.'
        : 'Wszystkie linie rozwojowe wymarły. Środowisko okazało się zbyt wymagające dla przyjętych ' +
          'adaptacji. W ewolucji większość linii wymiera — spróbuj innej strategii.';

    el.endEmblem.textContent = emblem;
    el.endTitle.textContent = title;
    el.endSummary.textContent = summary;

    el.endStats.innerHTML = '';
    endStat('Status', s === 'won' ? 'Zwycięstwo' : (s === 'survived' ? 'Przetrwanie' : 'Wymarcie'));
    endStat('Liczba linii rozwojowych', state.lineages.length);
    endStat('Szczytowa łączna populacja', peakTotal());
    endStat('Najwyższa inteligencja', Engine.maxIntelligence(state) + ' / ' + state.intelligenceGoal);
    endStat('Odkryte pojęcia w Kodeksie', state.unlockedKnowledge.length);
    showScreen('end');
  }
  function peakTotal() {
    return state.lineages.reduce(function (sum, l) { return sum + l.peakPopulation; }, 0);
  }
  function endStat(label, value) {
    var li = document.createElement('li');
    li.innerHTML = '<span>' + label + '</span><strong>' + value + '</strong>';
    el.endStats.appendChild(li);
  }

  // ===================== Kodeks =====================
  function showCodex() {
    el.codexBody.innerHTML = '';
    var unlocked = (state ? state.unlockedKnowledge : ['intro']);
    var any = false;
    Object.keys(DATA.KNOWLEDGE).forEach(function (key) {
      if (unlocked.indexOf(key) === -1) return;
      any = true;
      var k = DATA.KNOWLEDGE[key];
      var card = document.createElement('div');
      card.className = 'knowledge-card';
      card.innerHTML = '<h4>💡 ' + k.title + '</h4><p>' + k.body + '</p>';
      el.codexBody.appendChild(card);
    });
    if (!any) el.codexBody.innerHTML = '<p class="codex-empty">Kodeks jest jeszcze pusty — graj, aby odkrywać pojęcia.</p>';
    openModal(el.modalCodex);
  }

  // ===================== Modale — pomocnicze =====================
  var lastFocused = null;
  function openModal(m) {
    lastFocused = document.activeElement;
    m.hidden = false;
    var f = m.querySelector('button, input');
    if (f) f.focus();
  }
  function closeModal(m) {
    m.hidden = true;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  function flash(msg) {
    var prev = el.btnSimulate.textContent;
    el.btnSimulate.textContent = msg;
    setTimeout(function () { el.btnSimulate.textContent = prev; }, 1500);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function escapeSvg(s) { return escapeHtml(s); }

  // ===================== Inicjalizacja =====================
  function init() {
    el.introGoal.innerHTML =
      '🎯 <strong>Cel:</strong> doprowadź którąkolwiek linię do inteligencji <strong>' +
      DATA.INTELLIGENCE_GOAL + '</strong> w ciągu <strong>' + DATA.ERA.turns.length +
      '</strong> tur ery „' + DATA.ERA.name + '”. Możesz prowadzić kilka linii naraz (specjacja) ' +
      'i rozkładać ryzyko — ale sama liczna populacja nie wystarczy: trzeba rozwijać układ nerwowy.';

    el.formStart.addEventListener('submit', function (e) {
      e.preventDefault();
      newGame((el.speciesInput.value || '').trim() || 'Prazwierzę');
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

    el.btnRestart.addEventListener('click', function () {
      if (state && state.status === 'playing' &&
          !confirm('Rozpocząć nową grę? Bieżący postęp zostanie utracony.')) return;
      clearSave(); state = null; undoStack = [];
      el.speciesInput.value = '';
      showScreen('start');
    });
    el.btnPlayAgain.addEventListener('click', function () {
      state = null; undoStack = []; el.speciesInput.value = '';
      showScreen('start');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!el.modalCodex.hidden) closeModal(el.modalCodex);
      else if (!el.modalTree.hidden) closeModal(el.modalTree);
    });
    [el.modalCodex, el.modalTree].forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) closeModal(m); });
    });

    var saved = loadSaved();
    if (saved) { state = saved; showScreen('game'); renderAll(); }
    else showScreen('start');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
