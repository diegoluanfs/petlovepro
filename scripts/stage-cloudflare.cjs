'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { inspect } = require('./check-public.cjs');

const headers = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`;
const notFound = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Página não encontrada | PetLovePro</title><link rel="stylesheet" href="/styles.css"></head><body><main style="max-width:640px;margin:12vh auto;padding:24px"><p>PetLovePro</p><h1>Página não encontrada</h1><p>O endereço informado não está disponível.</p><a class="button primary" href="/">Voltar para a biblioteca</a></main></body></html>`;
function assertPublic(directory) {
  const errors = inspect(directory, { requireCovers: true });
  if (errors.length) throw new Error(errors.join('\n'));
}
function stageCloudflare(source, parent) {
  assertPublic(source);
  const target = fs.mkdtempSync(path.join(path.resolve(parent), 'petlovepro-pages-'));
  try {
    const output = path.join(target, 'public');
    fs.cpSync(source, output, { recursive: true, force: false, errorOnExist: true });
    assertPublic(output);
    require('./seo-pages.cjs').generateSeo(output);
    require('./blog-pages.cjs').generateBlog(output);
    fs.writeFileSync(path.join(output, '_headers'), headers, { flag: 'wx' });
    fs.writeFileSync(path.join(output, '404.html'), notFound, { flag: 'wx' });
    return target;
  } catch (error) {
    fs.rmSync(target, { recursive: true, force: true });
    throw error;
  }
}
module.exports = { stageCloudflare };
if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error('Informe o diretório temporário de destino.');
    const source = path.resolve(__dirname, '../public');
    const parent = path.resolve(process.argv[2]);
    if (parent === source || parent.startsWith(source + path.sep)) throw new Error('Não use public/ como destino.');
    console.log(stageCloudflare(source, parent));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
