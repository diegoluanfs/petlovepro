'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'web/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function currentRoute(hash) {
  const found = app.match(/const route=\(\)=>\{[^\r\n]*?\};/);
  assert.ok(found, 'Nao localizou a funcao route() no frontend canonico');
  return vm.runInNewContext(`${found[0]} route()`, {location: {hash}}, {timeout: 1000});
}

for (const [hash, expected] of [
  ['','/'],
  ['#/','/'],
  ['#/minha-conta','/minha-conta'],
  ['#/entrar','/entrar'],
  ['#/criar-conta','/criar-conta'],
  ['#/recuperar-senha','/recuperar-senha'],
  ['#/livros','/livros'],
  ['#/colecoes','/colecoes'],
  ['#/minha-conta?aba=compras','/minha-conta'],
]) {
  test(`hash routing: ${hash || '(vazio)'} -> ${expected}`, () => {
    assert.equal(currentRoute(hash), expected);
  });
}

test('O link Minha conta aponta para a rota esperada pelo renderizador', () => {
  assert.match(html, /href=["']#\/minha-conta["']/);
  assert.match(app, /path\s*===\s*['"]\/minha-conta['"]\)account\(\)/);
});

test('A entrada por email continua disponivel no renderizador', () => {
  assert.match(app, /\[\s*['"]\/entrar['"]/);
  assert.match(app, /authForm\(path\.slice\(1\)\)/);
});
