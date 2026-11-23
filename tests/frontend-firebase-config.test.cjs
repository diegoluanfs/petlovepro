'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('Public app uses the canonical frontend implementation', () => {
  const canonical = fs.readFileSync(
    path.join(root, 'web/app.js'), 'utf8'
  );

  const publicApp = fs.readFileSync(
    path.join(root, 'public/app.js'), 'utf8'
  );

  const deployedApp = fs.readFileSync(
    path.join(root, 'site-dist/app.js'), 'utf8'
  );

  assert.equal(publicApp, canonical);
  assert.equal(deployedApp, canonical);
  assert.doesNotMatch(
    deployedApp,
    /import\s*\{[^}]*firebaseConfig[^}]*\}\s*from\s*['"]\.\/firebase-config\.js['"]/
  );
});
