'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { isNodeVersion, validateVersion } = require('./version');

function configFile() {
  const base = process.env.NODE_MEMORY_CONFIG_DIR ||
    path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'node-memory');
  return path.resolve(base, 'projects.json');
}

function emptyData() {
  return { schemaVersion: 1, projects: {} };
}

function readData(file = configFile()) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return emptyData();
    throw error;
  }
  try {
    const data = JSON.parse(content);
    if (!data || data.schemaVersion !== 1 || !data.projects ||
        typeof data.projects !== 'object' || Array.isArray(data.projects)) throw new Error('unsupported schema');
    for (const [project, entry] of Object.entries(data.projects)) {
      if (!path.isAbsolute(project) || !entry || !isNodeVersion(entry.nodeVersion)) throw new Error('invalid project entry');
    }
    return data;
  } catch (error) {
    throw new Error(`Invalid configuration at ${file} (${error.message}). Original file preserved; repair it or move it aside before retrying.`);
  }
}

function mutateData(file, mutate) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const lock = `${file}.lock`;
  const deadline = Date.now() + 3000;
  while (true) {
    try {
      fs.mkdirSync(lock, { mode: 0o700 });
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) {
        throw new Error(`Configuration is locked: ${lock}. Retry later; if a writer crashed, remove this lock directory only after all node-memory processes have stopped.`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  let temporary;
  try {
    const data = readData(file);
    const result = mutate(data);
    temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    const descriptor = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(data, null, 2)}\n`);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporary, file);
    return result;
  } finally {
    if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.rmdirSync(lock);
  }
}

function getVersion(project, file = configFile()) {
  const entry = readData(file).projects[project];
  return entry ? entry.nodeVersion : null;
}

function saveVersion(project, version, file = configFile()) {
  validateVersion(version);
  if (!path.isAbsolute(project)) throw new Error('Project path must be absolute.');
  return mutateData(file, (data) => {
    data.projects[project] = { nodeVersion: version };
  });
}

function forgetProject(project, file = configFile()) {
  return mutateData(file, (data) => {
    const existed = Object.prototype.hasOwnProperty.call(data.projects, project);
    delete data.projects[project];
    return existed;
  });
}

module.exports = { configFile, readData, getVersion, saveVersion, forgetProject };
