'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { fixture, root } = require('./helpers');

test('shell initialization handles spaces, apostrophes, and shell metacharacters in installation paths', (t) => {
  const f = fixture(t);
  const installation = path.join(f.directory, "package space ' $(echo unexpected)");
  fs.mkdirSync(installation);
  for (const directory of ['src', 'bin', 'shell']) fs.cpSync(path.join(root, directory), path.join(installation, directory), { recursive: true });
  fs.copyFileSync(path.join(root, 'package.json'), path.join(installation, 'package.json'));
  const script = `
nvm() { [[ "$1" == current ]] && print v22.14.0; return 0; }
eval "$("$NODE_BIN" "$INSTALLED_CLI" shell-init zsh)"
node-memory --version
`;
  const result = spawnSync('zsh', ['-f', '-c', script], {
    cwd: f.directory, env: { ...f.env, NODE_BIN: process.execPath, INSTALLED_CLI: path.join(installation, 'bin/node-memory.js') }, encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '0.1.0');
  assert.equal(result.stderr, '');
});
