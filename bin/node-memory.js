#!/usr/bin/env node
'use strict';

require('../src/cli').main().catch((error) => {
  console.error(`node-memory: ${error.message}`);
  process.exitCode = 1;
});
