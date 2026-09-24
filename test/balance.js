/*
 * test/balance.js — raport balansu: boty rozgrywają wiele losowych światów.
 * Uruchom: node test/balance.js [liczba_gier]
 */
'use strict';
var D = require('../js/data.js');
var Engine = require('../js/engine.js');
var bots = require('./bots.js');
var N = parseInt(process.argv[2] || '200', 10);

function run(label, style, init) {
  var res = { won: 0, survived: 0, lost: 0 }, intel = 0, score = 0, turns = 0, lin = 0;
  for (var seed = 1; seed <= N; seed++) {
    var s = bots.playGame(D, { seed: seed, style: style, init: init });
    res[s.status]++; intel += Engine.maxIntelligence(D, s); score += Engine.computeScore(D, s).total;
    turns += s.turnsSurvived; lin += s.lineages.length;
  }
  console.log(label.padEnd(28) + ' wygrane ' + (100 * res.won / N).toFixed(0).padStart(3) + '%  przetrw. ' +
    (100 * res.survived / N).toFixed(0).padStart(3) + '%  wymarcie ' + (100 * res.lost / N).toFixed(0).padStart(3) +
    '%  śr.int ' + (intel / N).toFixed(1) + '  śr.tur ' + (turns / N).toFixed(1) + '  linie ' + (lin / N).toFixed(1) + '  wynik ' + Math.round(score / N));
}
D.SCENARIOS.forEach(function (sc) {
  var init = { difficulty: sc.difficulty, startEra: sc.startEra, startZg: sc.startZg, goal: sc.goal,
    startTraits: sc.startTraits, startNiche: sc.startNiche, scenarioId: sc.id };
  run(sc.id + ' / smart', 'smart', init);
  run(sc.id + ' / greedy', 'greedy', init);
  run(sc.id + ' / random', 'random', init);
});
