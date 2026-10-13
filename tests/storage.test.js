'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { spawn } = require('child_process');
const { readData, getVersion, saveVersion, forgetProject } = require('../src/storage');
const { fixture, cli } = require('./helpers');

test('missing storage is an empty read; writes persist and forget works', (t) => {
  const f = fixture(t);
  const project = f.project('a');
  assert.deepEqual(readData(f.file), { schemaVersion: 1, projects: {} });
  assert.equal(fs.existsSync(f.file), false);
  saveVersion(project, 'v18.14.0', f.file);
  assert.equal(getVersion(project, f.file), 'v18.14.0');
  assert.equal(f.run(['get'], project).stdout, 'v18.14.0\n');
  assert.equal(fs.statSync(f.file).mode & 0o777, 0o600);
  assert.equal(forgetProject(project, f.file), true);
  assert.equal(forgetProject(project, f.file), false);
  assert.equal(getVersion(project, f.file), null);
});

for (const contents of ['{broken', '{"schemaVersion":2,"projects":{}}', '{"schemaVersion":1,"projects":{"/a":{"nodeVersion":"$(bad)"}}}']) {
  test(`corrupt/unsupported configuration is preserved: ${contents}`, (t) => {
    const f = fixture(t);
    fs.mkdirSync(f.config);
    fs.writeFileSync(f.file, contents);
    assert.throws(() => saveVersion('/project', 'v22.14.0', f.file), /Original file preserved/);
    assert.equal(fs.readFileSync(f.file, 'utf8'), contents);
    assert.equal(fs.existsSync(`${f.file}.lock`), false);
  });
}

test('only complete versions and absolute project paths can be saved', (t) => {
  const f = fixture(t);
  for (const version of ['18', 'system', 'v18.1', 'v22.0.0;echo bad', null]) {
    assert.throws(() => saveVersion('/a', version, f.file), /complete Node.js version/);
  }
  assert.throws(() => saveVersion('relative', 'v22.14.0', f.file), /absolute/);
});

test('parallel writers preserve every project', async (t) => {
  const f = fixture(t);
  const projects = Array.from({ length: 12 }, (_, i) => f.project(`p-${i}`));
  await Promise.all(projects.map((cwd) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'save'], { cwd, env: f.env });
    let diagnostic = '';
    child.stderr.on('data', (chunk) => { diagnostic += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(diagnostic)));
  })));
  assert.equal(Object.keys(readData(f.file).projects).length, projects.length);
  assert.equal(fs.readdirSync(f.config).length, 1);
});

test('existing lock times out without overwriting storage or deleting another writer lock', (t) => {
  const f = fixture(t);
  fs.mkdirSync(`${f.file}.lock`, { recursive: true });
  assert.throws(() => saveVersion('/a', 'v22.14.0', f.file), /Configuration is locked/);
  assert.equal(fs.existsSync(f.file), false);
  assert.equal(fs.existsSync(`${f.file}.lock`), true);
});
