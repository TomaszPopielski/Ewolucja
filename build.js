/*
 * build.js — buduje samowystarczalny, jednoplikowy build gry.
 *
 * Wczytuje index.html, wstawia CSS i wszystkie skrypty „w miejsce”
 * (inline), dzięki czemu wynik to JEDEN plik HTML, który można otworzyć
 * dwuklikiem — bez serwera, bez zależności, także offline.
 *
 * Użycie:  node build.js
 * Wynik:   dist/ewolucja.html
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const distDir = path.join(root, 'dist');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let html = read('index.html');

// 1) Wstaw arkusz stylów w miejsce <link rel="stylesheet" href="css/styles.css">
const css = read('css/styles.css');
html = html.replace(
  /<link rel="stylesheet" href="css\/styles\.css"\s*\/?>/,
  '<style>\n' + css + '\n</style>'
);

// 2) Wstaw skrypty w miejsce znaczników <script src="js/...">
//    Kolejność zależności zachowana: i18n -> data -> engine -> ui.
const scripts = ['js/i18n.js', 'js/data.js', 'js/engine.js', 'js/ui.js'];
scripts.forEach((src) => {
  const tag = new RegExp('<script src="' + src.replace(/[.\/]/g, '\\$&') + '"><\\/script>');
  const code = read(src);
  html = html.replace(tag, '<script>\n' + code + '\n</' + 'script>');
});

// Znacznik informujący, że to build (a nie źródło).
html = html.replace(
  '</head>',
  '  <meta name="generator" content="Ewolucja build.js — samowystarczalny plik" />\n</head>'
);

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
const out = path.join(distDir, 'ewolucja.html');
fs.writeFileSync(out, html, 'utf8');

const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log('Zbudowano: dist/ewolucja.html (' + kb + ' kB)');
