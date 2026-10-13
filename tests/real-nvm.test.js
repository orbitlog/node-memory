'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { fixture, cli, hook } = require('./helpers');
const { readData } = require('../src/storage');

test('real zsh + nvm: manual choices, cd restoration, fresh terminals, and terminal isolation', {
  skip: process.env.NODE_MEMORY_REAL_NVM !== '1', timeout: 60000
}, (t) => {
  const f = fixture(t);
  const nvmDirectory = process.env.NVM_DIR || path.join(os.homedir(), '.nvm');
  const nvmScript = process.env.NODE_MEMORY_NVM_SH || path.join(nvmDirectory, 'nvm.sh');
  assert.ok(fs.existsSync(nvmScript), `nvm.sh not found: ${nvmScript}`);
  const installed = fs.readdirSync(path.join(path.dirname(nvmScript), 'versions/node'))
    .filter((version) => /^v\d+\.\d+\.\d+$/.test(version))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const first = process.env.NODE_MEMORY_TEST_VERSION_A || installed.find((v) => v.startsWith('v18.')) || installed[0];
  const second = process.env.NODE_MEMORY_TEST_VERSION_B || installed[installed.length - 1];
  assert.ok(first && second && first !== second, 'Install two distinct Node versions first; this test never downloads Node.');
  const a = f.project('project a');
  const b = f.project('project b');
  fs.mkdirSync(path.join(a, 'src'));
  const env = { ...f.env, HOOK: hook, CLI: cli, NVM_SCRIPT: nvmScript,
    NVM_DIR: path.dirname(nvmScript), A: a, B: b, OUTSIDE: f.directory,
    VERSION_A: first, VERSION_B: second, NODE_BIN: process.execPath };
  function shell(script, cwd = f.directory) {
    const result = spawnSync('zsh', ['-f', '-c', script], { cwd, env, encoding: 'utf8', timeout: 45000 });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return result;
  }
  const result = shell(`
source "$NVM_SCRIPT" --no-use
nvm use --silent "$VERSION_B" || exit 10
source "$HOOK"
source "$HOOK"
cd "$A"
nvm use --silent "$VERSION_A" || exit 11
print -- "chosen-a:$(node -v)"
cd "$B"
nvm use --silent "$VERSION_B" || exit 12
print -- "chosen-b:$(node -v)"
cd "$A/src"
print -- "restored-a:$(node -v)"
cd "$B"
print -- "restored-b:$(node -v)"
nvm use --silent v999.0.0 >/dev/null 2>&1
print -- "failed:$?"
print -- "after-failure:$(node -v)"
cd "$OUTSIDE"
print -- "outside:$(node -v)"
cd "$A"
print -- "reenter:$(node -v)"
print -- "hooks:\${#chpwd_functions}"
`);
  for (const label of ['chosen-a', 'restored-a', 'reenter']) assert.ok(result.stdout.includes(`${label}:${first}`), result.stdout);
  for (const label of ['chosen-b', 'restored-b', 'after-failure', 'outside']) assert.ok(result.stdout.includes(`${label}:${second}`), result.stdout);
  assert.match(result.stdout, /failed:[1-9]/);
  assert.match(result.stdout, /hooks:1/);
  assert.equal(readData(f.file).projects[a].nodeVersion, first);
  assert.equal(readData(f.file).projects[b].nodeVersion, second);

  const fresh = shell(`
source "$NVM_SCRIPT" --no-use
nvm use --silent "$VERSION_B" || exit 20
source "$HOOK"
print -- "startup:$(node -v)"
`, a);
  assert.ok(fresh.stdout.includes(`startup:${first}`), fresh.stdout);

  const isolation = shell(`
source "$NVM_SCRIPT" --no-use
nvm use --silent "$VERSION_B" || exit 30
source "$HOOK"
(cd "$A"; zsh -f -c 'source "$NVM_SCRIPT" --no-use; source "$HOOK"; print -- "child:$(node -v)"')
print -- "parent:$(node -v)"
`, b);
  assert.ok(isolation.stdout.includes(`child:${first}`), isolation.stdout);
  assert.ok(isolation.stdout.includes(`parent:${second}`), isolation.stdout);
});
