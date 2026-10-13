'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { fixture, hook, cli } = require('./helpers');
const { saveVersion, readData } = require('../src/storage');

const mock = `
typeset -g MOCK_CURRENT=v22.14.0
typeset -ga MOCK_CALLS=()
nvm() {
  case "$1" in
    current) print -r -- "$MOCK_CURRENT" ;;
    use)
      MOCK_CALLS+=("$*")
      [[ "$2" == --silent ]] && shift
      [[ "$2" == fail || "$2" == v99.0.0 ]] && return 7
      MOCK_CURRENT="$2"
      [[ "$2" == system ]] || export MOCK_CHANGED=yes
      print -r -- "using $2"
      ;;
    install) nvm use v20.13.1 ;;
    *) print -r -- "forwarded:$*"; return 3 ;;
  esac
}
`;
function run(f, script, cwd = f.directory) {
  return spawnSync('zsh', ['-f', '-c', script], {
    cwd, env: { ...f.env, HOOK: hook, CLI: cli, NODE_BIN: process.execPath }, encoding: 'utf8'
  });
}
function okay(result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

test('successful manual use records full version; failed and unrelated commands do not', (t) => {
  const f = fixture(t);
  const project = f.project('a');
  const result = run(f, `${mock}
source "$HOOK"
nvm use v18.14.0
nvm use fail
print -- "failure:$?"
nvm ls 'argument with spaces'
print -- "forward:$?"
nvm install
print -- "current:$MOCK_CURRENT"
`, project);
  okay(result);
  assert.match(result.stdout, /failure:7/);
  assert.match(result.stdout, /forwarded:ls argument with spaces/);
  assert.match(result.stdout, /forward:3/);
  assert.equal(readData(f.file).projects[project].nodeVersion, 'v18.14.0');
});

test('startup restores, duplicate sources and child cd do not repeat, leaving preserves version', (t) => {
  const f = fixture(t);
  const a = f.project('project a');
  const b = f.project('project b');
  const sub = path.join(a, 'src');
  fs.mkdirSync(sub);
  saveVersion(a, 'v18.14.0', f.file);
  saveVersion(b, 'v20.13.1', f.file);
  const before = fs.readFileSync(f.file, 'utf8');
  const actual = spawnSync('zsh', ['-f', '-c', `${mock}
source "$HOOK"; source "$HOOK"
print -- "startup:$MOCK_CURRENT"
cd src
print -- "calls:\${#MOCK_CALLS}"
cd "$B"
print -- "b:$MOCK_CURRENT"
cd "$OUTSIDE"
print -- "outside:$MOCK_CURRENT"
print -- "hooks:\${#chpwd_functions}"
`], { cwd: a, env: { ...f.env, HOOK: hook, B: b, OUTSIDE: f.directory }, encoding: 'utf8' });
  okay(actual);
  assert.match(actual.stdout, /startup:v18.14.0/);
  assert.match(actual.stdout, /calls:1/);
  assert.match(actual.stdout, /b:v20.13.1/);
  assert.match(actual.stdout, /outside:v20.13.1/);
  assert.match(actual.stdout, /hooks:1/);
  assert.equal(fs.readFileSync(f.file, 'utf8'), before);
});

test('missing versions give install guidance and preserve the record', (t) => {
  const f = fixture(t);
  const project = f.project('a');
  saveVersion(project, 'v99.0.0', f.file);
  const result = run(f, `${mock}\nsource "$HOOK"\nprint -- "$MOCK_CURRENT"`, project);
  okay(result);
  assert.equal(result.stdout.trim(), 'v22.14.0');
  assert.match(result.stderr, /nvm install v99.0.0/);
  assert.equal(readData(f.file).projects[project].nodeVersion, 'v99.0.0');
});

test('no record, same version, and no project cause no switch or diagnostic', (t) => {
  const f = fixture(t);
  const project = f.project('a');
  for (const remembered of [false, true]) {
    if (remembered) saveVersion(project, 'v22.14.0', f.file);
    const result = run(f, `${mock}\nsource "$HOOK"\nprint -- "calls:\${#MOCK_CALLS}"`, project);
    okay(result);
    assert.equal(result.stdout.trim(), 'calls:0');
    assert.equal(result.stderr, '');
  }
  const result = run(f, `${mock}\nsource "$HOOK"\nnvm use v18.14.0`);
  okay(result);
  assert.equal(result.stderr, '');
});

test('nvm and Node absence degrade safely and allow retry after loading nvm', (t) => {
  const f = fixture(t);
  const result = run(f, `source "$HOOK"\nprint alive\n${mock}\nsource "$HOOK"\nprint -- "loaded:$_NODE_MEMORY_LOADED"`);
  okay(result);
  assert.match(result.stderr, /nvm is unavailable/);
  assert.match(result.stdout, /alive\nloaded:1/);
  const absent = run(f, `${mock}\nPATH=/nonexistent\nsource "$HOOK"\nprint alive`);
  okay(absent);
  assert.match(absent.stderr, /Node.js is unavailable/);
});

test('save errors do not change nvm success status, even with errexit enabled', (t) => {
  const f = fixture(t);
  const project = f.project('a');
  fs.mkdirSync(f.config);
  fs.writeFileSync(f.file, '{');
  const result = run(f, `${mock}\nset -e\nsource "$HOOK"\nnvm use v18.14.0\nprint survived`, project);
  okay(result);
  assert.match(result.stdout, /survived/);
  assert.match(result.stderr, /Original file preserved/);
});

test('system use does not overwrite a remembered complete Node version', (t) => {
  const f = fixture(t);
  const project = f.project('a');
  saveVersion(project, 'v22.14.0', f.file);
  okay(run(f, `${mock}\nsource "$HOOK"\nnvm use system`, project));
  assert.equal(readData(f.file).projects[project].nodeVersion, 'v22.14.0');
});

test('CLI removal does not prevent shell startup or cd', (t) => {
  const f = fixture(t);
  const result = run(f, `${mock}\nsource "$HOOK"\n_NODE_MEMORY_CLI=/nonexistent\ncd /\nprint alive`);
  okay(result);
  assert.match(result.stdout, /alive/);
  assert.match(result.stderr, /CLI\/runtime is unavailable/);
});

test('shell-init output can be sourced by zsh', (t) => {
  const f = fixture(t);
  const result = run(f, `${mock}\neval "$("$NODE_BIN" "$CLI" shell-init zsh)"\nprint -- "loaded:$_NODE_MEMORY_LOADED"`);
  okay(result);
  assert.equal(result.stdout.trim(), 'loaded:1');
});

test('CLI stays callable without node in PATH and save records the active shell version', (t) => {
  const f = fixture(t);
  const project = f.project('a');
  const result = run(f, `${mock}
source "$HOOK"
MOCK_CURRENT=v18.14.0
PATH=/nonexistent
node-memory save
node-memory get
`, project);
  okay(result);
  assert.equal(result.stdout.trim(), 'v18.14.0');
  assert.equal(readData(f.file).projects[project].nodeVersion, 'v18.14.0');
  assert.equal(result.stderr, '');
});
