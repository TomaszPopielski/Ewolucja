// scripts/boty-balans.js — tabela zwycięstw botów na aktualnym silniku.
// Używa botów z test/bots.js (te same, które pilnują balansu w testach): potrafią
// korzystać z prognozy, kart decyzji, strategii rozrodu i specjacji. Dawna, prostsza
// wersja tego skryptu nie obsługiwała kart decyzji i zaniżała wyniki do 0%.
// Użycie: node scripts/boty-balans.js [liczba_gier]
const N = +process.argv[2] || 100;
const Bots = require('../test/bots.js');
const kinds = ['plan', 'star', 'adaptive', 'tactics1', 'tactics'];
const opis = { plan: 'stały plan „kup wszystko”', star: 'stały plan ⭐', adaptive: 'prognoza',
  tactics1: 'prognoza + taktyka', tactics: 'taktyka + specjacja' };
const rows = [['bot', 'łatwy', 'normalny', 'trudny']];
for (const k of kinds) rows.push([opis[k], ...['latwy', 'normalny', 'trudny'].map(d => Bots.winRate(k, { difficulty: d }, N) + '%')]);
console.log(`Odsetek zwycięstw, ${N} gier na komórkę (ziarna 1..${N})`);
for (const r of rows) console.log(r[0].padEnd(28) + r.slice(1).map(x => x.padStart(10)).join(''));
