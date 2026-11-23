#!/usr/bin/env node
'use strict';
/**
 * Restore only the three private catalog build inputs from GitHub Actions Secrets.
 * Designed for GitHub Actions; never logs secret values or writes into site-dist/.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const definitions = [
  ['PLP_RELEASE_POLICY_B64', 'data/release-policy.json', 'json'],
  ['PLP_KIWIFY_PRODUCTS_B64', 'data/kiwify-products-verified.tsv', 'tsv'],
  ['PLP_KIWIFY_OFFERS_B64', 'data/kiwify-offers-verified.private.json', 'json']
];
const decoded = [];
for (const [name, rel, kind] of definitions) {
  const input = (process.env[name] || '').trim();
  if (!input || !/^[A-Za-z0-9+/]+={0,2}$/.test(input) || input.length % 4 !== 0) {
    console.error(`[CI] ${name}: segredo ausente ou base64 invalido.`);
    process.exit(1);
  }
  const raw = Buffer.from(input, 'base64');
  if (!raw.length || raw.toString('base64') !== input || raw.length > 48 * 1024) {
    console.error(`[CI] ${name}: tamanho ou codificacao invalidos.`);
    process.exit(1);
  }
  try {
    if (kind === 'json') {
      const data = JSON.parse(raw.toString('utf8'));
      if (rel.endsWith('release-policy.json') &&
        (!Array.isArray(data.releaseOnly) || data.releaseOnly.length !== 60 ||
        Object.keys(data.productCheckoutUrls || {}).length !== 60 ||
        Object.keys(data.productOfferIds || {}).length !== 60)) throw new Error('politica incompleta');
      if (rel.endsWith('kiwify-offers-verified.private.json') &&
        (!Array.isArray(data.products) || data.products.length !== 60)) throw new Error('snapshot incompleto');
    } else if (kind === 'tsv') {
      const rows = raw.toString('utf8').trim().split(/\r?\n/);
      if (rows.length !== 60 || !rows.every(row => row.split('|').length === 3)) throw new Error('TSV incompleto');
    }
  } catch {
    console.error(`[CI] ${name}: estrutura invalida.`);
    process.exit(1);
  }
  decoded.push({name, rel, raw});
}
for (const {name, rel, raw} of decoded) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), {recursive: true});
  if (fs.existsSync(full)) {
    console.error(`[CI] ${rel}: ja existe; recusando sobrescrever arquivo versionado.`);
    process.exit(1);
  }
  fs.writeFileSync(full, raw, {flag: 'wx', mode: 0o600});
  console.log(`[CI] ${rel}: restaurado de ${name}; conteudo oculto.`);
}
console.log('[CI] Insumos comerciais disponiveis. Build e auditorias permanecem obrigatorios.');
