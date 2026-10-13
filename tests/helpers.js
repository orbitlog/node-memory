'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'bin/node-memory.js');
const hook = path.join(root, 'shell/node-memory.zsh');
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'node-memory-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const config = path.join(directory, 'config');
  const env = { ...process.env, NODE_MEMORY_CONFIG_DIR: config };
  function project(name) {
    const location = path.join(directory, name);
    fs.mkdirSync(location, { recursive: true });
    fs.writeFileSync(path.join(location, 'package.json'), '{}');
    return fs.realpathSync(location);
  }
  function run(args, cwd = directory, extra = {}) {
    return spawnSync(process.execPath, [cli, ...args], { cwd, env: { ...env, ...extra }, encoding: 'utf8' });
  }
  return { directory, config, env, project, run, file: path.join(config, 'projects.json') };
}
module.exports = { root, cli, hook, fixture };
