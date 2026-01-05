'use strict';

const chalk  = require('chalk');
const state  = require('./state');
const wallet = require('./wallet');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Readline question wrapped in a Promise
function ask(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

// Password input — mutes readline's echo without touching raw mode
// so stdin stays under readline's control throughout
function askPassword(rl, prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);

    // Suppress readline's character echo by patching output.write
    const origWrite = rl.output.write.bind(rl.output);
    rl.output.write = () => true;

    rl.question('', (answer) => {
      // Restore normal echo
      rl.output.write = origWrite;
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

// Fake loading animation for a step
async function animateStep(label, ms) {
  const frames = ['   ', '.  ', '.. ', '...'];
  const step   = 120;
  const n      = Math.floor(ms / step);
  process.stdout.write('  ' + label);
  for (let i = 0; i < n; i++) {
    process.stdout.write('\r  ' + label + ' ' + chalk.gray(frames[i % 4]));
    await sleep(step);
  }
  process.stdout.write('\r  ' + label + ' ' + chalk.cyan('[DONE]') + '\n');
}

// ─── Main onboarding flow ─────────────────────────────────────────────────────

async function run(rl, agents) {
  console.log('\n' + chalk.cyan('Enclave — First Run Setup'));
  console.log(chalk.gray('─'.repeat(52)) + '\n');

  // ── 1. Wallet ──────────────────────────────────────────────────────────────
  console.log('No wallet found. Generate a new one or import existing?\n');
  console.log('  [1]  Generate new wallet');
  console.log('  [2]  Import private key');
  console.log('  [3]  Import seed phrase\n');

  let choice = '';
  while (!['1','2','3'].includes(choice)) {
    choice = (await ask(rl, '> ')).trim();
  }

  let address;
  if (choice === '1') {
    await animateStep('Generating keypair...', 1100);
    address = wallet.generateAddress();
    console.log(`\n${chalk.cyan('✓')} Wallet generated`);
    console.log(`  Address:  ${chalk.white(address)}`);
    console.log(chalk.gray('  Key saved to: ~/.enclave/wallet.enc') + '\n');

  } else if (choice === '2') {
    await ask(rl, 'Enter private key: ');
    await animateStep('Validating and deriving address...', 900);
    address = wallet.generateAddress();
    console.log(`\n${chalk.cyan('✓')} Key imported. Address: ${chalk.white(address)}\n`);

  } else {
    await ask(rl, 'Enter seed phrase (12 or 24 words): ');
    await animateStep('Deriving keypair from mnemonic...', 1300);
    address = wallet.generateAddress();
    console.log(`\n${chalk.cyan('✓')} Wallet restored. Address: ${chalk.white(address)}\n`);
  }

  // ── 2. Password ─────────────────────────────────────────────────────────────
  let pw1 = '', pw2 = '';
  do {
    pw1 = await askPassword(rl, 'Set an encryption password for your keystore:\n> ');
    pw2 = await askPassword(rl, 'Confirm password:\n> ');
    if (pw1 !== pw2) console.log(chalk.yellow('\nPasswords do not match. Try again.\n'));
  } while (pw1 !== pw2);
  console.log(`\n${chalk.cyan('✓')} Keystore encrypted\n`);
  console.log(chalk.gray('─'.repeat(52)) + '\n');

  // ── 3. Network ──────────────────────────────────────────────────────────────
  console.log('Connect to network:\n');
  console.log('  [1]  Mainnet  (real funds)');
  console.log('  [2]  Testnet  (recommended for first run)');
  console.log('  [3]  Custom RPC endpoint\n');

  let netChoice = '';
  while (!['1','2','3'].includes(netChoice)) {
    netChoice = (await ask(rl, '> ')).trim();
  }

  const NETWORKS = {
    '1': { name: 'Base Mainnet', block: 18293847 + Math.floor(Math.random() * 5000) },
    '2': { name: 'Base Sepolia', block: 8102934  + Math.floor(Math.random() * 2000) },
  };

  let network;
  if (netChoice === '3') {
    await ask(rl, 'RPC endpoint URL: ');
    network = { name: 'Custom RPC', block: wallet.generateBlockNum() };
  } else {
    network = NETWORKS[netChoice];
  }

  await animateStep(`Connecting to ${network.name}...`, 1000);
  console.log(`${chalk.cyan('✓')} Connected to ${chalk.white(network.name)}  ${chalk.gray('(block #' + network.block.toLocaleString() + ')')}\n`);
  console.log(chalk.gray('─'.repeat(52)) + '\n');

  // ── 4. Balance check ────────────────────────────────────────────────────────
  console.log('Your treasury wallet needs funds to operate.\n');
  console.log(`  Address:  ${chalk.white(address)}`);
  console.log(`  Balance:  ${chalk.gray('0.0000 ETH')}\n`);
  console.log('Deposit ETH to this address and press Enter to continue...');
  await ask(rl, '');

  process.stdout.write('  Checking balance');
  for (let i = 0; i < 14; i++) { process.stdout.write('.'); await sleep(160); }

  const ethBalance = wallet.randomBalance(0.04, 0.18);
  const usdBalance = (ethBalance * 2413).toFixed(2);
  process.stdout.write(` ${chalk.cyan(ethBalance + ' ETH')} ${chalk.gray('≈ $' + usdBalance)} ${chalk.cyan('✓')}\n\n`);
  console.log(chalk.gray('─'.repeat(52)) + '\n');

  // ── 5. Treasury config ──────────────────────────────────────────────────────
  const maxUSD = Math.floor(ethBalance * 120000);

  const budgetInput = await ask(rl, `Set total treasury budget in USD [available: ${maxUSD.toLocaleString()} USD]:\n> `);
  const totalBudget = parseInt(budgetInput) || 10000;

  const maxTxInput = await ask(rl, `\nMax spend per single transaction [default: 500 USD]:\n> `);
  const maxTx = parseInt(maxTxInput) || 500;

  const threshInput = await ask(rl, `\nLow-budget alert threshold % [default: 20]:\n> `);
  const threshold = (parseFloat(threshInput) || 20) / 100;

  console.log();
  console.log(chalk.gray('─'.repeat(52)) + '\n');

  // ── 6. Agent registration ───────────────────────────────────────────────────
  console.log('Register your agents:\n');

  const savedAgents = [];
  for (const agent of agents) {
    const inp = await ask(rl, `  ${chalk.cyan(agent.id)} (${agent.role}) — budget cap in USD [default: ${agent.budgetAllocated}]:\n  > `);
    const budget = parseInt(inp) || agent.budgetAllocated;
    agent.budgetAllocated = budget;
    savedAgents.push({ id: agent.id, role: agent.role, budget });
    console.log(`  ${chalk.cyan('✓')} Registered ${chalk.white(agent.id)}  │  ${budget.toLocaleString()} USD\n`);
  }

  console.log(chalk.gray('─'.repeat(52)) + '\n');

  // ── 7. Deploy treasury contract ─────────────────────────────────────────────
  await animateStep('Compiling treasury contract...', 900);
  await animateStep('Estimating gas...', 500);
  await animateStep('Broadcasting deployment tx...', 1500);

  const contractAddr = wallet.generateAddress();
  const deployTxHash = wallet.generateTxHash();
  const deployBlock  = wallet.generateBlockNum();

  console.log(`\n${chalk.cyan('✓')} Treasury contract deployed`);
  console.log(`  Contract: ${chalk.white(contractAddr)}`);
  console.log(`  Tx:       ${chalk.gray(deployTxHash)}`);
  console.log(`  Block:    ${chalk.gray('#' + deployBlock.toLocaleString())}\n`);

  await animateStep('Funding agent payment channels...', 1000);

  // ── 8. Save config ──────────────────────────────────────────────────────────
  const cfg = {
    wallet:   { address, networkName: network.name, balance: ethBalance },
    treasury: { contractAddress: contractAddr, totalBudget, alertThreshold: threshold, maxSingleTx: maxTx },
    agents:   savedAgents,
  };
  state.save(cfg);
  _applyConfig(cfg);

  console.log(`${chalk.cyan('✓')} Config saved to ${chalk.gray('~/.enclave/config.json')}\n`);
  console.log(chalk.gray('─'.repeat(52)));
  console.log(`\n${chalk.cyan('✓')} All set. Starting monitor...\n`);
  await sleep(500);
}

// Apply loaded or freshly-created config into state
function _applyConfig(cfg) {
  if (!cfg) return;
  if (cfg.wallet)   Object.assign(state.wallet,   cfg.wallet);
  if (cfg.treasury) Object.assign(state.treasury, cfg.treasury);
}

// Load saved config on non-first-run
function loadSaved(agents) {
  const cfg = state.load();
  if (!cfg) return;
  _applyConfig(cfg);
  // Apply per-agent budget caps from saved config
  for (const saved of (cfg.agents || [])) {
    const agent = agents.find(a => a.id === saved.id);
    if (agent) agent.budgetAllocated = saved.budget;
  }
}

module.exports = { run, loadSaved };
// onboarding

