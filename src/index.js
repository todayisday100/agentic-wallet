'use strict';

const readline   = require('readline');
const agents     = require('./agents');
const boot       = require('./boot');
const onboarding = require('./onboarding');
const loop       = require('./loop');
const cli        = require('./cli');
const state      = require('./state');

async function main() {
  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    terminal: true,
  });

  state.rl = rl;

  if (state.isFirstRun()) {
    await onboarding.run(rl, agents);
  } else {
    onboarding.loadSaved(agents);
  }

  await boot.boot(agents);

  loop.start(agents);
  cli.start(agents);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
