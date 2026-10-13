'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const START = '# >>> node-memory >>>';
const END = '# <<< node-memory <<<';
const hookPath = path.resolve(__dirname, '../shell/node-memory.zsh');

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function integrationBlock() {
  return `${START}\n# Load after nvm. An absolute path survives nvm version changes.\nif [ -r ${shellQuote(hookPath)} ]; then\n  source ${shellQuote(hookPath)}\nfi\n${END}\n`;
}

function updateZshrc(file) {
  let content = '';
  let mode = 0o600;
  let target = file;
  if (fs.existsSync(file)) {
    target = fs.realpathSync(file);
    content = fs.readFileSync(target, 'utf8');
    mode = fs.statSync(target).mode & 0o777;
  }
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  let updated;
  if (start !== -1 || end !== -1) {
    if (start === -1 || end < start || content.indexOf(START, start + START.length) !== -1 ||
        content.indexOf(END, end + END.length) !== -1) {
      throw new Error(`Malformed node-memory block in ${file}; original file preserved.`);
    }
    const after = end + END.length + (content[end + END.length] === '\n' ? 1 : 0);
    updated = content.slice(0, start) + integrationBlock() + content.slice(after);
  } else {
    updated = content + (content && !content.endsWith('\n') ? '\n' : '') + integrationBlock();
  }
  if (updated === content) return null;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const backup = content ? `${target}.node-memory-backup-${Date.now()}` : null;
  if (backup) fs.writeFileSync(backup, content, { flag: 'wx', mode });
  const temporary = `${target}.node-memory-${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, updated, { flag: 'wx', mode });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return backup;
}

async function init(yes = false) {
  const file = path.join(process.env.ZDOTDIR || os.homedir(), '.zshrc');
  const nvmPath = path.join(process.env.NVM_DIR || path.join(os.homedir(), '.nvm'), 'nvm.sh');
  if (process.env.SHELL && !process.env.SHELL.endsWith('/zsh')) {
    console.error('node-memory: Only zsh is supported. Load this integration from zsh.');
  }
  if (!fs.existsSync(nvmPath)) {
    console.error('node-memory: nvm.sh was not found in NVM_DIR or ~/.nvm. Install/load nvm before loading the integration.');
  }
  console.log(`Add the following AFTER your nvm initialization in ${file}:\n\n${integrationBlock()}`);
  if (!yes) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.log('No files changed. Run node-memory init --yes to add it, or copy the block manually.');
      return;
    }
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => prompt.question(`Update ${file}? [y/N] `, resolve));
    prompt.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log('No files changed.');
      return;
    }
  }
  const backup = updateZshrc(file);
  console.log(`Shell integration configured in ${file}.${backup ? ` Backup: ${backup}` : ''}\nOpen a new zsh terminal to activate it.`);
}

module.exports = { init, updateZshrc, integrationBlock, shellQuote, hookPath };
