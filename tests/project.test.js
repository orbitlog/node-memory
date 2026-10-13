'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { findProject } = require('../src/project');
const { fixture } = require('./helpers');

test('nearest package.json wins, including nested workspace packages', (t) => {
  const f = fixture(t);
  const parent = f.project('project with spaces');
  const sub = path.join(parent, 'src/components');
  fs.mkdirSync(sub, { recursive: true });
  assert.equal(findProject(sub), parent);
  const nested = f.project('project with spaces/packages/child');
  assert.equal(findProject(nested), nested);
});

test('symlink paths resolve to the same canonical project', (t) => {
  const f = fixture(t);
  const project = f.project('actual');
  const link = path.join(f.directory, 'linked');
  fs.symlinkSync(project, link);
  assert.equal(findProject(link), project);
});

test('no package.json returns null; a directory named package.json is ignored', (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.directory, 'package.json'));
  assert.equal(findProject(f.directory), null);
});

test('invalid lookup paths report an error', (t) => {
  const f = fixture(t);
  assert.throws(() => findProject(path.join(f.directory, 'missing')), /ENOENT/);
});
