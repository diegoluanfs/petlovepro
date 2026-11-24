#!/usr/bin/env node
'use strict';
// Repara exclusivamente o parser de hash-routing no frontend canonico.
// Nunca modifica public/app.js, credenciais, catalogo ou permissoes.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const appFile = path.resolve(process.cwd(), 'web', 'app.js');
const before = String.raw`const route=()=>{const raw=(location.hash||'#/').replace(/^#\/?/,'').split('?')[0];return raw||'/';};`;
const after = String.raw`const route=()=>{const raw=(location.hash||'#/').replace(/^#\/?/,'').split('?')[0];return '/'+raw.replace(/^\/+/, '');};`;
const args = process.argv.slice(2);

function fail(message) {
  console.error('[PetLovePro account-route] ' + message);
  process.exitCode = 1;
}

if (args.some(arg => arg !== '--apply')) {
  fail('Argumento desconhecido. Use sem argumentos para diagnosticar ou --apply para corrigir.');
} else if (!fs.existsSync(appFile) || !fs.statSync(appFile).isFile()) {
  fail('web/app.js ausente. Execute a partir da raiz do projeto PetLovePro.');
} else {
  const content = fs.readFileSync(appFile, 'utf8');
  if (content.includes(after)) {
    console.log('[PetLovePro account-route] Roteamento ja corrigido; nenhuma alteracao feita.');
  } else {
    const matches = content.split(before).length - 1;
    if (matches !== 1) {
      fail('O parser de rotas nao corresponde a versao auditada. Nenhuma alteracao feita. Envie a funcao route() atual para analise.');
    } else if (!args.includes('--apply')) {
      console.log('[PetLovePro account-route] Defeito confirmado: #/minha-conta perde a barra inicial.');
      console.log('[PetLovePro account-route] Execute node scripts/fix-account-route.cjs --apply para reparar.');
    } else {
      const backup = path.join(os.tmpdir(), `petlovepro-web-app-before-account-route-${Date.now()}-${process.pid}.bak`);
      fs.copyFileSync(appFile, backup);
      const updated = content.replace(before, after);
      if (updated === content) {
        fail('Nao foi possivel aplicar a correcao; origem preservada.');
      } else {
        fs.writeFileSync(appFile, updated, 'utf8');
        if (fs.readFileSync(appFile, 'utf8') !== updated) {
          fs.copyFileSync(backup, appFile);
          fail('Falha de integridade; web/app.js restaurado do backup.');
        } else {
          console.log('[PetLovePro account-route] Corrigido somente web/app.js.');
          console.log('[PetLovePro account-route] Backup temporario: ' + backup);
          console.log('[PetLovePro account-route] Execute os testes, build e check:release antes de publicar.');
        }
      }
    }
  }
}
