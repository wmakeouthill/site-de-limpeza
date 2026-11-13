// Monta o protótipo: fonte/p1..p7.html -> falcao-limpeza.html (corpo do artifact) e index.html (página completa).
// Uso: node prototipo/build.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const D = __dirname;
const corpo = [1, 2, 3, 4, 5, 6, 7].map(n => fs.readFileSync(path.join(D, 'fonte', `p${n}.html`), 'utf8')).join('');

// Falha cedo se o último <script> (o app) tiver erro de sintaxe.
const scripts = [...corpo.matchAll(/<script>([\s\S]*?)<\/script>/g)];
new vm.Script(scripts[scripts.length - 1][1]);

const PREFIX = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>';
fs.writeFileSync(path.join(D, 'falcao-limpeza.html'), corpo);
fs.writeFileSync(path.join(D, 'index.html'), PREFIX + corpo);
fs.writeFileSync(path.join(D, 'claro.html'), PREFIX.replace('<html lang="pt-BR">', '<html lang="pt-BR" data-theme="light">') + corpo);
console.log(`ok: ${corpo.length} caracteres`);
