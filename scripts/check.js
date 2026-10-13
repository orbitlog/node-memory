'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
for (const directory of ['bin', 'src', 'scripts', 'tests']) {
  for (const file of fs.readdirSync(path.join(root, directory))) {
    if (!file.endsWith('.js')) continue;
    const result = spawnSync(process.execPath, ['--check', path.join(root, directory, file)], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(1);
  }
}
const result = spawnSync('zsh', ['-n', path.join(root, 'shell/node-memory.zsh')], { stdio: 'inherit' });
if (result.error) {
  console.error('zsh is required for shell syntax checks.');
  process.exit(1);
}
process.exitCode = result.status;
