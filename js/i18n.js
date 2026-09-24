/*
 * i18n.js — warstwa internacjonalizacji interfejsu.
 *
 * Stringi CHROME interfejsu trzymamy tu, pod kluczami. Treść merytoryczna gry
 * (cechy, ery, karty wiedzy) jest w data.js — to ona jest jednostką tłumaczenia
 * treści. Aby dodać język: dopisz zestaw stringów obok `pl` i ustaw `lang`.
 *
 * Elementy statyczne HTML z atrybutem data-i18n="klucz" są wypełniane przez
 * applyStatic(); dynamiczne teksty pobiera się przez t('klucz', params).
 */
(function (root, factory) {
  var i18n = factory();
  if (typeof module === 'object' && module.exports) module.exports = i18n;
  else root.GameI18n = i18n;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STRINGS = {
    pl: {
      'brand.name': 'Ewolucja',
      'nav.codex': 'Kodeks wiedzy',
      'nav.newgame': 'Nowa gra',

      'start.title': 'Ewolucja',
      'start.nameLabel': 'Nazwij swój gatunek:',
      'start.namePlaceholder': 'np. Prazwierz morski',
      'start.button': 'Rozpocznij ewolucję',
      'start.seedLabel': 'Kod świata (opcjonalnie):',
      'start.seedPlaceholder': 'np. KLASA7B lub 1234',
      'start.daily': '📅 Wyzwanie dnia',
      'start.seedHint': 'Ten sam kod = ten sam świat (klimat, zdarzenia, katastrofy). Cała klasa może zagrać na jednym kodzie i porównać wyniki. Puste pole = losowy świat.',
      'start.eduNote': 'Gra edukacyjna. Model jest świadomie uproszczony — służy zrozumieniu mechanizmów (zmienność → dziedziczenie → dobór), nie odwzorowaniu konkretnych gatunków.',

      'status.zg': '🧬 Zmienność',
      'status.population': 'Populacja',
      'status.intelligence': 'Inteligencja (cel)',
      'status.era': 'Era',
      'status.score': 'Wynik',

      'lineage.speciate': '🌿 Specjacja',
      'lineage.tree': '🌳 Drzewo życia',

      'species.title': 'Aktywna linia',
      'species.popOverTime': 'Populacja w czasie',
      'species.forecast': 'Prognoza następnej tury',
      'species.envTitle': 'Środowisko następnej tury',
      'species.objectives': '🎯 Cele ery',
      'species.simulate': 'Przeżyj turę →',
      'species.undo': '↶ Cofnij (tryb nauczyciela)',

      'draft.title': '🎲 Mutacje w populacji',
      'draft.hint': 'W populacji pojawiły się losowe mutacje. Wskaż jedną (pierwsza w turze za darmo) — trafi do ~30% osobników. Strzałka pokazuje, czy w nadchodzących warunkach dobór będzie jej sprzyjał.',
      'genes.title': '🧬 Pula genowa linii',
      'genes.hint': 'Częstość każdej cechy w populacji. Rośnie, gdy cecha pomaga przeżyć w obecnej niszy i klimacie, maleje, gdy szkodzi. Od 95% cecha jest utrwalona, poniżej 5% zanika.',

      'traits.title': '📖 Katalog cech — co może się pojawić',
      'traits.hint': 'Wszystkie cechy gry. Nowa cecha może pojawić się jako mutacja dopiero, gdy cechy wymagane mają częstość ≥ 50%. ⭐ — droga do inteligencji.',

      'report.title': 'Wynik tury',
      'report.next': 'Dalej',
      'report.summary': 'Zobacz podsumowanie',

      'codex.title': 'Kodeks wiedzy',
      'codex.hint': 'Zbiór odblokowanych pojęć. Odkrywasz je, grając.',
      'codex.fossil': '🦴 Zapis kopalny: ',

      'tree.title': '🌳 Drzewo życia',
      'tree.hint': 'Historia Twoich linii rozwojowych. Rozgałęzienia to specjacje; wygaszone gałęzie to linie, które wymarły. Kliknij żywą gałąź, aby uczynić ją aktywną.',

      'speciate.title': '🌿 Specjacja',
      'speciate.label': 'Nazwa nowej gałęzi:',
      'speciate.nicheLabel': 'Gdzie osiedlić nową gałąź?',
      'speciate.confirm': 'Rozdziel gatunek',
      'quiz.title': '🎓 Pytanie ery',
      'quiz.hint': 'Poprawna odpowiedź daje premię zmienności genetycznej i punkty do wyniku.',
      'common.cancel': 'Anuluj',
      'common.yes': 'Tak',
      'confirm.title': 'Potwierdź',

      'end.playAgain': 'Zagraj ponownie',
      'end.seeCodex': 'Zobacz Kodeks',

      'tutorial.skip': 'Pomiń samouczek',
      'tutorial.next': 'Dalej',
      'tutorial.done': 'Zaczynajmy!'
    }
  };

  var lang = 'pl';

  function t(key, params) {
    var s = (STRINGS[lang] && STRINGS[lang][key]) || key;
    if (params) for (var p in params) s = s.replace(new RegExp('\\{' + p + '\\}', 'g'), params[p]);
    return s;
  }

  function applyStatic(rootEl) {
    var nodes = (rootEl || document).querySelectorAll('[data-i18n]');
    Array.prototype.forEach.call(nodes, function (n) {
      var key = n.getAttribute('data-i18n');
      n.textContent = t(key);
    });
    var ph = (rootEl || document).querySelectorAll('[data-i18n-ph]');
    Array.prototype.forEach.call(ph, function (n) {
      n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph')));
    });
  }

  return { t: t, applyStatic: applyStatic, setLang: function (l) { lang = l; }, getLang: function () { return lang; } };
});
