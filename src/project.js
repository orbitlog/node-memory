'use strict';

const fs = require('fs');
const path = require('path');

function findProject(start = process.cwd()) {
  let directory = fs.realpathSync(start);
  if (!fs.statSync(directory).isDirectory()) throw new Error('Project lookup requires a directory.');
  while (true) {
    try {
      if (fs.statSync(path.join(directory, 'package.json')).isFile()) return directory;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

module.exports = { findProject };
