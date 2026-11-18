'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { covers } = require('../scripts/check-public.cjs');
const { stageCloudflare } = require('../scripts/stage-cloudflare.cjs');
// Small valid 16x16 WebP generated for tests, never used in production.
const fixture = Buffer.from('UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoQABAAAUAmJaACdLoAA5gA/vHcj/1Bn/kGf+QZ+ql5GQ25gAA=', 'base64');
function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'petlovepro-ci-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'public');
  fs.cpSync(path.join(__dirname, '../public'), source, { recursive: true });
  for (const rel of covers) {
    const file = path.join(source, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, fixture);
  }
  return { root, source };
}
test('Cloudflare staging includes only approved public files and deployment metadata', t => {
  const { root, source } = setup(t);
  for (const name of ['functions', 'private', 'coleções']) fs.mkdirSync(path.join(root, name));
  fs.writeFileSync(path.join(root, 'private', 'ebook.pdf'), '%PDF-1.7');
  const target = stageCloudflare(source, root);
  assert.deepEqual(fs.readdirSync(target), ['public']);
  const output = path.join(target, 'public');
  assert.equal(fs.readdirSync(path.join(output, 'assets/covers')).length, 73);
  assert.match(fs.readFileSync(path.join(output, '_headers'), 'utf8'), /X-Content-Type-Options: nosniff/);
  assert.match(fs.readFileSync(path.join(output, '404.html'), 'utf8'), /Página não encontrada/);
  assert(!fs.existsSync(path.join(output, 'private')));
  assert(!fs.existsSync(path.join(source, '_headers')));
});
test('Cloudflare staging fails closed when a promotional cover is absent', t => {
  const { root, source } = setup(t);
  fs.rmSync(path.join(source, 'assets/covers/book-001.webp'));
  assert.throws(() => stageCloudflare(source, root), /Capa ausente/);
});
test('Cloudflare staging rejects an unexpected private EPUB or PDF', t => {
  const { root, source } = setup(t);
  fs.writeFileSync(path.join(source, 'ebook.epub'), 'private');
  fs.writeFileSync(path.join(source, 'ebook.pdf'), '%PDF-1.7');
  assert.throws(() => stageCloudflare(source, root), /ebook\.epub/);
});
