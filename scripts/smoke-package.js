'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'node-memory-package-'));
const metadata = require('../package.json');
const cache = path.join(temporary, 'cache');

function npm(args) {
  return execFileSync('npm', [...args, '--cache', cache], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

try {
  const packed = JSON.parse(npm(['pack', '--json', '--pack-destination', temporary]))[0];
  const allowed = /^(bin\/|src\/|shell\/|package\.json$|README(?:\.zh-CN)?\.md$|LICENSE$|CHANGELOG\.md$)/;
  assert(packed.files.every((file) => allowed.test(file.path)), 'Unexpected file in npm package');
  const prefix = path.join(temporary, 'installed');
  npm(['install', '--global', '--prefix', prefix, path.join(temporary, packed.filename), '--offline', '--ignore-scripts', '--no-audit', '--no-fund']);
  const installed = path.join(prefix, 'bin/node-memory');
  const project = path.join(temporary, 'project with spaces');
  const config = path.join(temporary, 'config');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), '{}');
  const env = { ...process.env, NODE_MEMORY_CONFIG_DIR: config, ZDOTDIR: temporary };
  function cli(args) {
    return execFileSync(installed, args, { cwd: project, env, encoding: 'utf8' });
  }
  assert.strictEqual(cli(['--version']).trim(), metadata.version);
  cli(['save']);
  assert.strictEqual(cli(['get']).trim(), process.version);
  assert(JSON.parse(cli(['list', '--json']))[fs.realpathSync(project)]);
  cli(['forget']);
  assert.strictEqual(cli(['get']), '');
  assert(cli(['init']).includes('No files changed'));
  assert(!fs.existsSync(path.join(temporary, '.zshrc')));
  const script = `
nvm() { [[ "$1" == current ]] && print v22.14.0; return 0; }
eval "$("$INSTALLED_CLI" shell-init zsh)"
node-memory --version
`;
  const shell = execFileSync('zsh', ['-f', '-c', script], {
    cwd: project, env: { ...env, INSTALLED_CLI: installed }, encoding: 'utf8'
  });
  assert.strictEqual(shell.trim(), metadata.version);
  const linkedPrefix = path.join(temporary, 'linked');
  execFileSync('npm', ['link', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', cache], {
    cwd: root, env: { ...process.env, npm_config_prefix: linkedPrefix }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
  assert.strictEqual(execFileSync(path.join(linkedPrefix, 'bin/node-memory'), ['--version'], { encoding: 'utf8' }).trim(), metadata.version);
  console.log(`Package smoke test passed: ${metadata.name}@${metadata.version}, ${packed.entryCount} files; global install, npm link, CLI and zsh initialization.`);
} catch (error) {
  console.error(error.stderr ? String(error.stderr) : error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
