'use strict';

const { findProject } = require('./project');
const storage = require('./storage');
const { validateVersion } = require('./version');
const { init, shellQuote, hookPath } = require('./init');
const { version } = require('../package.json');

const HELP = `Node Memory ${version} — remember each project's Node.js version (zsh + nvm)

Usage: node-memory <command>

  init [--yes]                  Configure zsh, asking before editing .zshrc
  save [--node-version vX.Y.Z]   Save the current project's version
  get                           Print only the remembered version, or nothing
  list [--json]                 List remembered projects
  forget                        Forget the current project
  shell-init zsh                Print the shell integration source command
  --help                        Show this help
  --version                     Show the tool version

The shell hook records successful manual nvm use calls and restores on cd/startup.
Config: ~/.config/node-memory/projects.json (or XDG_CONFIG_HOME / NODE_MEMORY_CONFIG_DIR)
`;

async function main(args = process.argv.slice(2)) {
  const [command = '--help', ...options] = args;
  if (command === '--help' || command === '-h') {
    if (options.length) throw new Error('Unexpected arguments.');
    process.stdout.write(HELP);
    return;
  }
  if (command === '--version' || command === '-v') {
    if (options.length) throw new Error('Unexpected arguments.');
    console.log(version);
    return;
  }
  if (command === 'init') {
    if (options.length && !(options.length === 1 && options[0] === '--yes')) throw new Error('Usage: node-memory init [--yes]');
    return init(options[0] === '--yes');
  }
  if (command === 'shell-init') {
    if (options.length !== 1 || options[0] !== 'zsh') throw new Error('Usage: node-memory shell-init zsh (only zsh is supported)');
    console.log(`if [ -r ${shellQuote(hookPath)} ]; then source ${shellQuote(hookPath)}; fi`);
    return;
  }
  if (command === 'list') {
    if (options.length && !(options.length === 1 && options[0] === '--json')) throw new Error('Usage: node-memory list [--json]');
    const projects = storage.readData().projects;
    if (options[0] === '--json') console.log(JSON.stringify(projects, null, 2));
    else for (const project of Object.keys(projects).sort()) console.log(`${projects[project].nodeVersion}\t${project}`);
    return;
  }
  if (!['save', 'get', 'forget'].includes(command)) throw new Error(`Unknown command: ${command}. Run node-memory --help.`);
  let nodeVersion = process.version;
  const ifProject = command === 'save' && options[2] === '--if-project';
  if (command === 'save' && (options.length === 2 || (options.length === 3 && ifProject)) && options[0] === '--node-version') nodeVersion = validateVersion(options[1]);
  else if (options.length) throw new Error(`Unexpected arguments for ${command}. Run node-memory --help.`);
  const project = findProject();
  if (!project) {
    if (command === 'get' || ifProject) return;
    throw new Error('No project found: expected a package.json in this directory or a parent directory.');
  }
  if (command === 'get') {
    const remembered = storage.getVersion(project);
    if (remembered) console.log(remembered);
  } else if (command === 'save') {
    storage.saveVersion(project, nodeVersion);
  } else {
    storage.forgetProject(project);
  }
}

module.exports = { main };
