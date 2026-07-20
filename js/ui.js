/*
 * ui.js — kontroler interfejsu.
 *
 * Spina dane (GameData) i silnik (Engine) z DOM. Cała logika gry jest w
 * silniku; tutaj tylko renderowanie, obsługa zdarzeń i zapis lokalny.
 */
(function () {
  'use strict';

  var DATA = window.GameData;
  var Engine = window.Engine;
  var SAVE_KEY = 'ewolucja.save.v1';

  var state = null; // bieżący stan gry

  // --- Skróty do elementów DOM ---
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    screenStart: $('screen-start'),
    screenGame: $('screen-game'),
    screenEnd: $('screen-end'),
    formStart: $('form-start'),
    speciesInput: $('species-name'),
    introGoal: $('intro-goal'),
    ep: $('ep-value'),
    pop: $('pop-value'),
    turn: $('turn-value'),
    intel: $('intel-value'),
    timeline: $('era-timeline'),
    speciesName: $('species-name-display'),
    statsList: $('stats-list'),
    envName: $('env-name'),
    envNote: $('env-note'),
    envStats: $('env-stats'),
    traits: $('traits-container'),
    btnSimulate: $('btn-simulate'),
    btnCodex: $('btn-codex'),
    btnRestart: $('btn-restart'),
    modalReport: $('modal-report'),
    reportBody: $('report-body'),
    reportKnowledge: $('report-knowledge'),
    btnReportClose: $('btn-report-close'),
    modalCodex: $('modal-codex'),
    codexBody: $('codex-body'),
    btnCodexClose: $('btn-codex-close'),
    endEmblem: $('end-emblem'),
    endTitle: $('end-title'),
    endSummary: $('end-summary'),
    endStats: $('end-stats'),
    btnPlayAgain: $('btn-play-again'),
    btnOpenCodexEnd: $('btn-open-codex-end')
  };

  var STAT_META = [
    { key: 'feeding', label: 'Odżywianie' },
    { key: 'defense', label: 'Obrona' },
    { key: 'reproduction', label: 'Rozród' },
    { key: 'mobility', label: 'Mobilność' },
    { key: 'metabolism', label: 'Metabolizm' },
    { key: 'intelligence', label: 'Inteligencja' }
  ];

  // ===================== Zapis / wczytanie =====================
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
    catch (e) { /* localStorage może być niedostępny — gra działa dalej bez zapisu */ }
  }
  function loadSaved() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s && s.version === 1 && s.status === 'playing') return s;
      return null;
    } catch (e) { return null; }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  // ===================== Nawigacja ekranów =====================
  function showScreen(name) {
    el.screenStart.hidden = name !== 'start';
    el.screenGame.hidden = name !== 'game';
    el.screenEnd.hidden = name !== 'end';
  }

  // ===================== Start gry =====================
  function newGame(speciesName) {
    state = Engine.createInitialState(DATA, speciesName);
    save();
    showScreen('game');
    renderAll();
  }

  // ===================== Render — pasek stanu =====================
  function renderStatus() {
    el.ep.textContent = state.ep;
    el.pop.textContent = state.species.population;
    el.turn.textContent = state.turn + ' / ' + state.maxTurns;
    el.intel.textContent = state.species.stats.intelligence + ' / ' + state.intelligenceGoal;
    el.speciesName.textContent = state.species.name;
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
      step.innerHTML = '<span class="era-step-num">' + (i + 1) + '</span>' + shortTitle(t.title);
      el.timeline.appendChild(step);
    });
  }
  function shortTitle(title) { return title.split(' — ')[0]; }

  // ===================== Render — statystyki gatunku =====================
  function renderStats() {
    el.statsList.innerHTML = '';
    var maxScale = 20;
    STAT_META.forEach(function (m) {
      var val = state.species.stats[m.key];
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

  // ===================== Render — środowisko następnej tury =====================
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
      chip('Klimat: ' + climateLabel(env.climate)) +
      chip('Tlen: ' + env.oxygen) +
      chip('Pokarm: ' + env.food) +
      chip('Drapieżniki: ' + env.predators) +
      (env.land ? chip('🏝️ ląd dostępny') : '');
  }
  function chip(text) { return '<li>' + text + '</li>'; }
  function climateLabel(c) {
    return c === 'zimno' ? '❄️ zimno' : (c === 'cieplo' ? '☀️ ciepło' : '⛅ umiarkowanie');
  }

  // ===================== Render — drzewo cech =====================
  function renderTraits() {
    el.traits.innerHTML = '';
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
      traitsInCat.forEach(function (trait) {
        grid.appendChild(renderTraitCard(trait));
      });
      section.appendChild(grid);
      el.traits.appendChild(section);
    });
  }

  function renderTraitCard(trait) {
    var status = Engine.traitStatus(state, trait);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trait ' + status;
    btn.disabled = (status !== 'available');

    var costLabel = status === 'owned' ? '✓ zdobyta' : (trait.cost + ' EP');
    var effects = renderEffects(trait.effects);
    var reqHtml = '';
    if (status === 'locked') {
      reqHtml = '<div class="trait-req">Wymaga: ' + reqNames(trait.requires) + '</div>';
    }

    btn.innerHTML =
      '<div class="trait-head"><span class="trait-name">' + trait.name + '</span>' +
      '<span class="trait-cost">' + costLabel + '</span></div>' +
      '<div class="trait-desc">' + trait.desc + '</div>' +
      '<div class="trait-effects">' + effects + '</div>' +
      '<div class="trait-tradeoff">⚖ ' + trait.tradeoff + '</div>' +
      reqHtml;

    if (status === 'available') {
      btn.addEventListener('click', function () { onBuyTrait(trait.id); });
    }
    return btn;
  }

  function renderEffects(effects) {
    var html = '';
    for (var key in effects) {
      if (!Object.prototype.hasOwnProperty.call(effects, key)) continue;
      var v = effects[key];
      var cls = v > 0 ? 'up' : 'down';
      var sign = v > 0 ? '+' : '';
      html += '<span class="effect-chip ' + cls + '">' + Engine.statLabel(key) + ' ' + sign + v + '</span>';
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
    if (!res.ok) { flashSimulate(res.error); return; }
    state = res.state;
    save();
    renderStatus();
    renderStats();
    renderTraits();
  }

  function onSimulate() {
    var res = Engine.simulateTurn(DATA, state);
    if (!res.report) return;
    state = res.state;
    save();
    renderAll();
    showReport(res.report);
  }

  function renderAll() {
    renderStatus();
    renderTimeline();
    renderStats();
    renderEnv();
    renderTraits();
    el.btnSimulate.disabled = (state.status !== 'playing');
  }

  // ===================== Modal: raport tury =====================
  function showReport(report) {
    el.reportBody.innerHTML = '';

    // Wydarzenia (mutacje, drapieżnictwo, głód)
    report.events.forEach(function (ev) {
      var d = document.createElement('div');
      d.className = 'report-event';
      d.textContent = ev.text;
      el.reportBody.appendChild(d);
    });

    // Bilans liczbowy
    addReportLine('Populacja na początku', report.popBefore, 'plain');
    addReportLine('Narodziny', '+' + report.births, report.births > 0 ? 'pos' : 'plain');
    if (report.predationDeaths > 0) addReportLine('Straty od drapieżników', '-' + report.predationDeaths, 'neg');
    if (report.starvationDeaths > 0) addReportLine('Straty z głodu', '-' + report.starvationDeaths, 'neg');
    addReportLine('Populacja na końcu', report.popAfter, report.popAfter >= report.popBefore ? 'pos' : 'neg');
    addReportLine('Bilans energetyczny', report.energy, report.energy >= 0 ? 'pos' : 'neg');
    addReportLine('Zdobyte punkty ewolucji', '+' + report.epGain, 'pos');
    addReportLine('Inteligencja', report.intelligence + ' / ' + report.intelligenceGoal, 'plain');

    // Karty wiedzy
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

  function addReportLine(label, value, tone) {
    var d = document.createElement('div');
    d.className = 'report-line';
    var cls = tone === 'pos' ? 'num pos' : (tone === 'neg' ? 'num neg' : 'num');
    d.innerHTML = '<span>' + label + '</span><span class="' + cls + '">' + value + '</span>';
    el.reportBody.appendChild(d);
  }

  function onReportClose() {
    closeModal(el.modalReport);
    if (state.status !== 'playing') showEnd();
  }

  // ===================== Ekran końcowy =====================
  function showEnd() {
    clearSave(); // zakończona gra — nie wznawiamy jej
    var s = state.status;
    var emblem = s === 'won' ? '🧠' : (s === 'survived' ? '🐾' : '🦴');
    var title = s === 'won' ? 'Narodziny inteligencji!' :
                (s === 'survived' ? 'Gatunek przetrwał erę' : 'Linia wygasła');
    var summary =
      s === 'won'
        ? 'Twoja linia rozwojowa osiągnęła próg inteligencji — na horyzoncie kultura i technologia. ' +
          'To efekt konsekwentnych inwestycji w układ nerwowy mimo presji środowiska.'
        : s === 'survived'
        ? 'Gatunek przetrwał cały paleozoik, ale nie rozwinął dostatecznie mózgu, by osiągnąć ' +
          'inteligencję. Dobre przetrwanie to nie to samo co droga do rozumności — spróbuj mocniej ' +
          'zainwestować w układ nerwowy.'
        : 'Populacja spadła do zera. Środowisko okazało się zbyt wymagające dla przyjętych adaptacji. ' +
          'W ewolucji większość linii wymiera — spróbuj innej strategii.';

    el.endEmblem.textContent = emblem;
    el.endTitle.textContent = title;
    el.endSummary.textContent = summary;

    el.endStats.innerHTML = '';
    endStat('Status', s === 'won' ? 'Zwycięstwo' : (s === 'survived' ? 'Przetrwanie' : 'Wymarcie'));
    endStat('Szczytowa populacja', state.species.peakPopulation);
    endStat('Końcowa inteligencja', state.species.stats.intelligence + ' / ' + state.intelligenceGoal);
    endStat('Zdobyte cechy', state.traits.length);
    endStat('Odkryte pojęcia w Kodeksie', state.unlockedKnowledge.length);

    showScreen('end');
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
    if (!any) {
      el.codexBody.innerHTML = '<p class="codex-empty">Kodeks jest jeszcze pusty — graj, aby odkrywać pojęcia.</p>';
    }
    openModal(el.modalCodex);
  }

  // ===================== Modale — pomocnicze =====================
  var lastFocused = null;
  function openModal(m) {
    lastFocused = document.activeElement;
    m.hidden = false;
    var focusable = m.querySelector('button, input');
    if (focusable) focusable.focus();
  }
  function closeModal(m) {
    m.hidden = true;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function flashSimulate(msg) {
    // Lekki komunikat błędu — tymczasowo w tytule przycisku.
    var prev = el.btnSimulate.textContent;
    el.btnSimulate.textContent = msg;
    setTimeout(function () { el.btnSimulate.textContent = prev; }, 1400);
  }

  // ===================== Inicjalizacja =====================
  function init() {
    el.introGoal.innerHTML =
      '🎯 <strong>Cel:</strong> doprowadź gatunek do inteligencji <strong>' +
      DATA.INTELLIGENCE_GOAL + '</strong> w ciągu <strong>' + DATA.ERA.turns.length +
      '</strong> tur ery „' + DATA.ERA.name + '”. Uwaga: sama liczna populacja nie wystarczy — ' +
      'trzeba świadomie rozwijać układ nerwowy.';

    el.formStart.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = el.speciesInput.value.trim() || 'Prazwierzę';
      newGame(name);
    });

    el.btnSimulate.addEventListener('click', onSimulate);
    el.btnReportClose.addEventListener('click', onReportClose);
    el.btnCodex.addEventListener('click', showCodex);
    el.btnCodexClose.addEventListener('click', function () { closeModal(el.modalCodex); });
    el.btnOpenCodexEnd.addEventListener('click', showCodex);
    el.btnRestart.addEventListener('click', function () {
      if (state && state.status === 'playing') {
        if (!confirm('Rozpocząć nową grę? Bieżący postęp zostanie utracony.')) return;
      }
      clearSave();
      state = null;
      el.speciesInput.value = '';
      showScreen('start');
    });
    el.btnPlayAgain.addEventListener('click', function () {
      state = null;
      el.speciesInput.value = '';
      showScreen('start');
    });

    // Zamykanie modali klawiszem Escape i kliknięciem w tło.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!el.modalCodex.hidden) closeModal(el.modalCodex);
      }
    });
    [el.modalReport, el.modalCodex].forEach(function (m) {
      m.addEventListener('click', function (e) {
        // klik w tło modalu zamyka tylko Kodeks (raport wymaga świadomego "Dalej")
        if (e.target === m && m === el.modalCodex) closeModal(m);
      });
    });

    // Wznów zapisaną grę, jeśli istnieje.
    var saved = loadSaved();
    if (saved) {
      state = saved;
      showScreen('game');
      renderAll();
    } else {
      showScreen('start');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
