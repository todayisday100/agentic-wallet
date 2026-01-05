'use strict';

const figlet  = require('figlet');
const chalk   = require('chalk');
const config  = require('./config');
const display = require('./display');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Animate a "loading dots" effect for a given duration
async function animateStep(label, ms) {
  const dots = ['   ', '.  ', '.. ', '...'];
  const interval = 120;
  const steps = Math.floor(ms / interval);

  process.stdout.write(`  ${label.padEnd(48)} `);

  for (let i = 0; i < steps; i++) {
    process.stdout.write('\r' + `  ${label.padEnd(48)} ` + chalk.gray(dots[i % dots.length]));
    await sleep(interval);
  }

  process.stdout.write('\r' + `  ${label.padEnd(48)} ` + chalk.cyan('[DONE]') + '\n');
}

async function boot(agents) {
  // ASCII banner
  const banner = figlet.textSync('Enclave', { font: 'Standard' });
  console.log(chalk.cyan(banner));
  console.log();

  // Boot steps
  await animateStep('Initializing agent runtime...', 800);
  await animateStep('Loading treasury config...', 600);
  await animateStep('Connecting to x402 endpoint (testnet)...', 1200);
  await animateStep(`Syncing agent registry (${agents.length} agents found)...`, 700);
  await animateStep('Running KYA pre-check...', 900);
  await animateStep('Starting budget monitor...', 500);

  console.log();

  // Online box
  display.printOnlineBox(config, agents.length);

  console.log();
}

module.exports = { boot };
// boot

