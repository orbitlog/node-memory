'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { fixture } = require('./helpers');
const { updateZshrc, integrationBlock } = require('../src/init');

test('CLI save/get/list/forget work from project subdirectories', (t) => {
  const f = fixture(t);
  const project = f.project('a');
  const sub = path.join(project, 'src');
  fs.mkdirSync(sub);
  assert.equal(f.run(['get'], sub).stdout, '');
  assert.equal(f.run(['save'], sub).status, 0);
  assert.equal(f.run(['get'], project).stdout, `${process.version}\n`);
  assert.deepEqual(JSON.parse(f.run(['list', '--json']).stdout), { [project]: { nodeVersion: process.version } });
  assert.equal(f.run(['list']).stdout, `${process.version}\t${project}\n`);
  assert.equal(f.run(['forget'], sub).status, 0);
  assert.equal(f.run(['get'], sub).stdout, '');
});

test('CLI validates arguments and separates diagnostics from machine output', (t) => {
  const f = fixture(t);
  assert.equal(f.run(['get']).status, 0);
  assert.equal(f.run(['get']).stdout, '');
  for (const args of [['unknown'], ['get', 'extra'], ['save'], ['shell-init', 'bash'], ['save', '--node-version', '18']]) {
    const result = f.run(args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /node-memory:/);
  }
  assert.match(f.run(['--help']).stdout, /shell-init zsh/);
  assert.equal(f.run(['--version']).stdout, '0.1.0\n');
  assert.equal(f.run(['save', '--node-version', 'v22.14.0', '--if-project']).status, 0);
});

test('corrupted configuration is an error with no stdout and no overwrite', (t) => {
  const f = fixture(t);
  const project = f.project('a');
  fs.mkdirSync(f.config);
  fs.writeFileSync(f.file, '{');
  const result = f.run(['get'], project);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /preserved/);
  assert.equal(fs.readFileSync(f.file, 'utf8'), '{');
});

test('init without a TTY prints setup instructions and does not edit .zshrc', (t) => {
  const f = fixture(t);
  const result = f.run(['init'], f.directory, { ZDOTDIR: f.directory });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No files changed/);
  assert.equal(fs.existsSync(path.join(f.directory, '.zshrc')), false);
});

test('confirmed init preserves existing config, backs it up, and is idempotent', (t) => {
  const f = fixture(t);
  const file = path.join(f.directory, '.zshrc');
  const original = '# user config\nexport EXAMPLE=ok\n';
  fs.writeFileSync(file, original, { mode: 0o640 });
  const result = f.run(['init', '--yes'], f.directory, { ZDOTDIR: f.directory });
  assert.equal(result.status, 0);
  const content = fs.readFileSync(file, 'utf8');
  assert.equal(content, original + integrationBlock());
  const backup = fs.readdirSync(f.directory).find((name) => name.includes('backup'));
  assert.equal(fs.readFileSync(path.join(f.directory, backup), 'utf8'), original);
  assert.equal(fs.statSync(file).mode & 0o777, 0o640);
  updateZshrc(file);
  assert.equal(fs.readFileSync(file, 'utf8'), content);
});

test('init safely follows symlinked .zshrc and refuses malformed managed blocks', (t) => {
  const f = fixture(t);
  const target = path.join(f.directory, 'dotfile');
  const link = path.join(f.directory, '.zshrc');
  fs.writeFileSync(target, '# dotfile\n');
  fs.symlinkSync(target, link);
  updateZshrc(link);
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  assert.match(fs.readFileSync(target, 'utf8'), /node-memory/);
  fs.writeFileSync(target, '# >>> node-memory >>>\n');
  assert.throws(() => updateZshrc(link), /Malformed/);
  assert.equal(fs.readFileSync(target, 'utf8'), '# >>> node-memory >>>\n');
});
