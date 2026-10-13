'use strict';

function isNodeVersion(version) {
  return typeof version === 'string' && /^v\d+\.\d+\.\d+$/.test(version);
}

function validateVersion(version) {
  if (!isNodeVersion(version)) {
    throw new Error(`Expected a complete Node.js version (for example v22.14.0), received ${JSON.stringify(version)}.`);
  }
  return version;
}

module.exports = { isNodeVersion, validateVersion };
