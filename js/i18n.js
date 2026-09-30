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
      'start.eduNote': 'Gra edukacyjna. Model jest świadomie uproszczony — służy zrozumieniu mechanizmów, nie odwzorowaniu konkretnych gatunków.',

      'status.ep': 'Punkty ewolucji do wydania',
      'status.population': 'Populacja',
      'status.intelligence': 'Inteligencja (cel)',
      'status.era': 'Era',

      'lineage.speciate': 'Specjacja',
      'lineage.tree': 'Drzewo życia',
      'lineage.migrateToLand': 'Migruj na ląd',
      'lineage.migrateToWater': 'Wróć do wody',

      'species.title': 'Aktywna linia',
      'tactics.title': 'Decyzje linii',
      'tactics.strategy': 'Strategia rozrodu',
      'tactics.behavior': 'Zachowanie w tej turze',
      'tactics.selection': 'Ukierunkowany dobór',
      'tactics.diet': 'Dieta',
      'species.popOverTime': 'Populacja w czasie',
      'species.forecast': 'Prognoza następnej tury',
      'species.envTitle': 'Środowisko następnej tury',
      'species.simulate': 'Przeżyj turę →',
      'species.undo': '↶ Cofnij (tryb nauczyciela)',

      'traits.title': 'Adaptacje — wydaj punkty ewolucji',
      'traits.hint': 'Cechy dotyczą aktywnej linii. Każda ma koszt i kompromis; cechy zależne odblokowują się po zdobyciu wymaganych. Gwiazdka oznacza drogę do inteligencji.',

      'turn.feed': 'Żerowanie',
      'turn.feedSub': 'bilans energii {energy}',
      'turn.predation': 'Drapieżniki atakują',
      'turn.starvation': 'Głód',
      'turn.births': 'Narodziny',
      'turn.mutationGood': 'Korzystna mutacja',
      'turn.mutationBad': 'Szkodliwa mutacja',
      'turn.skip': 'Pomiń ▸',

      'report.title': 'Wynik tury',
      'report.next': 'Dalej',
      'report.summary': 'Zobacz podsumowanie',

      'codex.title': 'Kodeks wiedzy',
      'codex.hint': 'Zbiór odblokowanych pojęć. Odkrywasz je, grając.',
      'codex.fossil': 'Zapis kopalny: ',

      'tree.title': 'Drzewo życia',
      'tree.hint': 'Historia Twoich linii rozwojowych. Rozgałęzienia to specjacje; wygaszone gałęzie to linie, które wymarły. Kliknij żywą gałąź, aby uczynić ją aktywną.',

      'speciate.title': 'Specjacja',
      'speciate.label': 'Nazwa nowej gałęzi:',
      'speciate.confirm': 'Rozdziel gatunek',
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

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Ikony z warstwy graficznej (self.GameArt) dla elementów z data-icon.
  // Bez niej elementy pokazują sam tekst — ikony są ozdobą.
  function artIcon(n) {
    var art = (typeof self !== 'undefined') ? self.GameArt : null;
    var key = n.getAttribute('data-icon');
    return (art && key && art.hasIcon(key)) ? art.icon(key) : '';
  }

  function applyStatic(rootEl) {
    var nodes = (rootEl || document).querySelectorAll('[data-i18n]');
    Array.prototype.forEach.call(nodes, function (n) {
      var key = n.getAttribute('data-i18n');
      var svg = artIcon(n);
      if (svg) n.innerHTML = svg + ' ' + escapeHtml(t(key));
      else n.textContent = t(key);
    });
    // data-icon bez data-i18n: ikona zastępuje znak zapasowy (data-icon-only)
    // albo jest dopisywana przed treścią.
    var decor = (rootEl || document).querySelectorAll('[data-icon]:not([data-i18n])');
    Array.prototype.forEach.call(decor, function (n) {
      var svg = artIcon(n);
      if (!svg || n.getAttribute('data-icon-done')) return;
      n.setAttribute('data-icon-done', '1');
      if (n.hasAttribute('data-icon-only')) n.innerHTML = svg;
      else n.insertAdjacentHTML('afterbegin', svg + ' ');
    });
    var ph = (rootEl || document).querySelectorAll('[data-i18n-ph]');
    Array.prototype.forEach.call(ph, function (n) {
      n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph')));
    });
  }

  return { t: t, applyStatic: applyStatic, setLang: function (l) { lang = l; }, getLang: function () { return lang; } };
});
