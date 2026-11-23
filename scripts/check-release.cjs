'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'petlovepro-release-')
);

const destination = path.join(temporaryRoot, 'public');

try {
  console.log('Validando arquivos públicos da PetLovePro...');

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'stage-cloudflare.cjs'), destination],
    {
      cwd: root,
      stdio: 'inherit'
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    console.error('Validação de release reprovada.');
  } else {
    console.log('Validação de release aprovada.');
  }
} finally {
  fs.rmSync(temporaryRoot, {
    recursive: true,
    force: true
  });
}
