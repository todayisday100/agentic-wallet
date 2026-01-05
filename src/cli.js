'use strict';

const chalk   = require('chalk');
const Table   = require('cli-table3');
const state   = require('./state');
const wallet  = require('./wallet');
const display = require('./display');
const config  = require('./config');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Prompt for y/N confirmation — routes through the main readline 'line' handler
function confirm(question) {
  return new Promise((resolve) => {
    process.stdout.write('\n' + question + chalk.gray(' [y/N] '));
    state.pendingConfirm = { resolve };
  });
}

// Fake broadcast animation — suppresses tick logs while running
async function broadcast(label, ms) {
  state.animating = true;
  const frames = ['   ', '.  ', '.. ', '...'];
  const step   = 120;
  const n      = Math.floor(ms / step);
  process.stdout.write('  ' + label);
  for (let i = 0; i < n; i++) {
    process.stdout.write('\r  ' + label + ' ' + chalk.gray(frames[i % 4]));
    await sleep(step);
  }
  process.stdout.write('\r  ' + label + ' ' + chalk.cyan('[DONE]') + '\n');
  state.animating = false;
}

// ─── Command handlers ─────────────────────────────────────────────────────────

function cmdHelp() {
  console.log(`
${chalk.cyan('Commands')}

  ${chalk.cyan('status')}                  Treasury overview
  ${chalk.cyan('agents')}                  All agents table
  ${chalk.cyan('agent')} ${chalk.gray('<id>')}             Agent detail + recent txs
  ${chalk.cyan('txlog')} ${chalk.gray('[id]')}             Last 20 transactions
  ${chalk.cyan('pause')} ${chalk.gray('<id>')}             Pause agent spending
  ${chalk.cyan('resume')} ${chalk.gray('<id>')}            Resume paused agent
  ${chalk.cyan('topup')} ${chalk.gray('<id> <usd>')}       Add budget to agent
  ${chalk.cyan('limit')} ${chalk.gray('<id> <usd>')}       Set max single tx for agent
  ${chalk.cyan('freeze')}                  Pause ALL agents
  ${chalk.cyan('unfreeze')}               Resume ALL agents
  ${chalk.cyan('withdraw')} ${chalk.gray('<usd>')}         Withdraw USD from treasury
  ${chalk.cyan('set threshold')} ${chalk.gray('<pct>')}    Alert threshold (e.g. 15)
  ${chalk.cyan('set kya-min')} ${chalk.gray('<n>')}        Minimum KYA score
  ${chalk.cyan('help')}                    Show this list
  ${chalk.cyan('exit')}                    Shutdown agent
`);
}

function cmdStatus(agents) {
  const total    = agents.reduce((s, a) => s + a.budgetAllocated, 0);
  const spent    = agents.reduce((s, a) => s + a.budgetSpent, 0);
  const avgKya   = (agents.reduce((s, a) => s + a.kyaScore, 0) / agents.length).toFixed(2);
  const paused   = state.pausedAgents.size;
  const contract = state.treasury.contractAddress || chalk.gray('not deployed');
  const address  = state.wallet.address || chalk.gray('not set');
  const network  = state.wallet.networkName || config.network;

  console.log(`
${chalk.cyan('Treasury Status')}
${'─'.repeat(48)}
  Wallet:          ${chalk.white(address)}
  Network:         ${network}
  Contract:        ${chalk.white(contract)}
  Total budget:    ${total.toLocaleString()} USD
  Spent:           ${display.fmt(spent)} USD  ${chalk.gray('(' + ((spent / total) * 100).toFixed(1) + '%)')}
  Remaining:       ${display.fmt(total - spent)} USD
  Avg KYA score:   ${avgKya}
  Agents:          ${agents.length} registered${paused > 0 ? chalk.yellow(', ' + paused + ' paused') : ''}
  Tx processed:    ${state.txHistory.length}
`);
}

function cmdAgents(agents) {
  const table = new Table({
    head: [chalk.cyan('Agent'), chalk.cyan('Role'), chalk.cyan('KYA'), chalk.cyan('Budget'), chalk.cyan('Spent'), chalk.cyan('Status')],
    style: { head: [], border: [] },
    colWidths: [14, 20, 7, 16, 9, 16],
  });

  for (const a of agents) {
    const pct    = ((a.budgetSpent / a.budgetAllocated) * 100).toFixed(1);
    const remPct = (a.budgetAllocated - a.budgetSpent) / a.budgetAllocated;
    const paused = state.pausedAgents.has(a.id);

    let status = 'OK';
    if (paused)             status = chalk.gray('PAUSED');
    else if (remPct <= 0.1) status = chalk.red('CRITICAL');
    else if (remPct <= 0.2) status = chalk.yellow('LOW');

    table.push([a.id, a.role, a.kyaScore.toFixed(2), `${a.budgetAllocated.toLocaleString()} USD`, `${pct}%`, status]);
  }

  console.log('\n' + table.toString() + '\n');
}

function cmdAgent(agents, id) {
  const a = agents.find(x => x.id === id);
  if (!a) { console.log(chalk.yellow(`\n  Unknown agent: "${id}"\n`)); return; }

  const remaining = a.budgetAllocated - a.budgetSpent;
  const pct       = ((a.budgetSpent / a.budgetAllocated) * 100).toFixed(1);
  const paused    = state.pausedAgents.has(a.id);

  console.log(`
${chalk.cyan(a.id)}  ${chalk.gray('—')}  ${a.role}
${'─'.repeat(48)}
  KYA Score:   ${a.kyaScore.toFixed(2)}
  Budget:      ${a.budgetAllocated.toLocaleString()} USD allocated
  Spent:       ${display.fmt(a.budgetSpent)} USD  ${chalk.gray('(' + pct + '%)')}
  Remaining:   ${display.fmt(remaining)} USD
  Status:      ${paused ? chalk.gray('PAUSED') : chalk.cyan('ACTIVE')}`);

  const txs = state.txHistory.filter(t => t.agentId === a.id).slice(-5).reverse();
  if (txs.length > 0) {
    console.log('\n  Recent transactions:');
    for (const tx of txs) {
      const d = new Date(tx.ts);
      const t = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      console.log(`    ${chalk.gray(t)}  ${chalk.gray(tx.txId)}  ${tx.method} ${tx.endpoint}  ${display.fmt(tx.cost).padStart(10)} USD  ${chalk.gray(tx.latency + 'ms')}`);
    }
  }
  console.log();
}

function cmdTxlog(agents, id) {
  let txs = [...state.txHistory];
  if (id) {
    if (!agents.find(a => a.id === id)) {
      console.log(chalk.yellow(`\n  Unknown agent: "${id}"\n`)); return;
    }
    txs = txs.filter(t => t.agentId === id);
  }
  txs = txs.slice(-20).reverse();

  if (txs.length === 0) {
    console.log(chalk.gray('\n  No transactions yet.\n')); return;
  }

  console.log(`\n  ${chalk.cyan('Transaction Log')}${id ? chalk.gray('  — ' + id) : ''}\n`);
  for (const tx of txs) {
    const d = new Date(tx.ts);
    const t = `[${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}]`;
    console.log(
      `  ${chalk.gray(t)}  ${chalk.gray(tx.txId)}  ${tx.agentId.padEnd(12)}` +
      `  ${tx.method} ${tx.endpoint.padEnd(18)}` +
      `  ${display.fmt(tx.cost).padStart(10)} USD  ${chalk.gray(tx.latency + 'ms')}`
    );
  }
  console.log();
}

function cmdPause(agents, id) {
  if (!id) { console.log(chalk.yellow('\n  Usage: pause <agent-id>\n')); return; }
  const a = agents.find(x => x.id === id);
  if (!a) { console.log(chalk.yellow(`\n  Unknown agent: "${id}"\n`)); return; }
  if (state.pausedAgents.has(id)) {
    console.log(chalk.gray(`\n  ${id} is already paused\n`)); return;
  }
  state.pausedAgents.add(id);
  console.log(`\n${chalk.cyan('✓')} Agent ${chalk.white(id)} paused — no further requests will be signed\n`);
}

function cmdResume(agents, id) {
  if (!id) { console.log(chalk.yellow('\n  Usage: resume <agent-id>\n')); return; }
  const a = agents.find(x => x.id === id);
  if (!a) { console.log(chalk.yellow(`\n  Unknown agent: "${id}"\n`)); return; }
  state.pausedAgents.delete(id);
  console.log(`\n${chalk.cyan('✓')} Agent ${chalk.white(id)} resumed\n`);
}

async function cmdTopup(agents, id, amount) {
  if (!id || !amount) { console.log(chalk.yellow('\n  Usage: topup <id> <usd>\n')); return; }
  const a = agents.find(x => x.id === id);
  if (!a) { console.log(chalk.yellow(`\n  Unknown agent: "${id}"\n`)); return; }
  const usd = parseInt(amount);
  if (!usd || usd <= 0) { console.log(chalk.yellow('\n  Invalid amount\n')); return; }

  const yes = await confirm(`Add ${usd.toLocaleString()} USD to ${id}'s budget?`);
  if (!yes) { console.log(chalk.gray('  Cancelled\n')); return; }

  await broadcast('Broadcasting topup transaction...', 900);
  const prev = a.budgetAllocated;
  a.budgetAllocated += usd;
  const txHash = wallet.generateTxHash();
  console.log(`${chalk.cyan('✓')} Budget updated  ${chalk.gray(wallet.shorten(txHash))}`);
  console.log(`  ${id}: ${prev.toLocaleString()} USD → ${a.budgetAllocated.toLocaleString()} USD\n`);
}

function cmdLimit(agents, id, amount) {
  if (!id || !amount) { console.log(chalk.yellow('\n  Usage: limit <id> <usd>\n')); return; }
  const a = agents.find(x => x.id === id);
  if (!a) { console.log(chalk.yellow(`\n  Unknown agent: "${id}"\n`)); return; }
  const usd = parseInt(amount);
  if (!usd || usd <= 0) { console.log(chalk.yellow('\n  Invalid amount\n')); return; }
  // Store limit per-agent (we attach it dynamically)
  a.maxSingleTx = usd;
  console.log(`\n${chalk.cyan('✓')} Max single tx for ${chalk.white(id)} set to ${usd.toLocaleString()} USD\n`);
}

async function cmdFreeze(agents) {
  const yes = await confirm('This will halt ALL agent spending immediately. Proceed?');
  if (!yes) { console.log(chalk.gray('  Cancelled\n')); return; }
  for (const a of agents) state.pausedAgents.add(a.id);
  console.log(chalk.red('\n⚠ All agents frozen — treasury locked\n'));
}

function cmdUnfreeze(agents) {
  state.pausedAgents.clear();
  console.log(`\n${chalk.cyan('✓')} All agents resumed\n`);
}

async function cmdWithdraw(agents, amount) {
  if (!amount) { console.log(chalk.yellow('\n  Usage: withdraw <usd>\n')); return; }
  const usd = parseInt(amount);
  if (!usd || usd <= 0) { console.log(chalk.yellow('\n  Invalid amount\n')); return; }

  const total     = agents.reduce((s, a) => s + a.budgetAllocated, 0);
  const spent     = agents.reduce((s, a) => s + a.budgetSpent, 0);
  const available = total - spent;
  if (usd > available) {
    console.log(chalk.yellow(`\n  Insufficient funds. Available: ${display.fmt(available)} USD\n`));
    return;
  }

  const yes = await confirm(`Withdraw ${vxd.toLocaleString()} USD to ${wallet.shorten(state.wallet.address || '0x000')}?`);
  if (!yes) { console.log(chalk.gray('  Cancelled\n')); return; }

  await broadcast('Broadcasting withdrawal transaction...', 1100);
  const txHash = wallet.generateTxHash();
  console.log(`${chalk.cyan('✓')} Withdrawal initiated`);
  console.log(`  Amount: ${vxd.toLocaleString()} USD`);
  console.log(`  Tx:     ${chalk.gray(wallet.shorten(txHash))}\n`);
}

function cmdSet(key, value) {
  if (key === 'threshold') {
    const pct = parseFloat(value);
    if (isNaN(pct)) { console.log(chalk.yellow('\n  Usage: set threshold <number>\n')); return; }
    config.alertThreshold = pct / 100;
    console.log(`\n${chalk.cyan('✓')} Alert threshold set to ${pct}%\n`);
  } else if (key === 'kya-min') {
    const n = parseFloat(value);
    if (isNaN(n)) { console.log(chalk.yellow('\n  Usage: set kya-min <number>\n')); return; }
    config.kyaMinScore = n;
    console.log(`\n${chalk.cyan('✓')} KYA minimum set to ${n}\n`);
  } else {
    console.log(chalk.yellow(`\n  Unknown setting: "${key}". Try: threshold, kya-min\n`));
  }
}

// ─── Start the interactive CLI ────────────────────────────────────────────────

function start(agents) {
  const rl = state.rl;
  if (!rl) return;

  rl.setPrompt(chalk.cyan('aw') + '> ');
  rl.prompt();

  rl.on('line', async (line) => {
    // Route to pending confirmation if one is waiting
    if (state.pendingConfirm) {
      const { resolve } = state.pendingConfirm;
      state.pendingConfirm = null;
      resolve(line.trim().toLowerCase() === 'y');
      // prompt() will be called by the command after resolve
      return;
    }

    const parts = line.trim().split(/\s+/);
    const cmd   = (parts[0] || '').toLowerCase();

    if (!cmd) { rl.prompt(); return; }

    switch (cmd) {
      case 'help':     cmdHelp(); break;
      case 'status':   cmdStatus(agents); break;
      case 'agents':   cmdAgents(agents); break;
      case 'agent':    cmdAgent(agents, parts[1]); break;
      case 'txlog':    cmdTxlog(agents, parts[1]); break;
      case 'pause':    cmdPause(agents, parts[1]); break;
      case 'resume':   cmdResume(agents, parts[1]); break;
      case 'topup':    await cmdTopup(agents, parts[1], parts[2]); break;
      case 'limit':    cmdLimit(agents, parts[1], parts[2]); break;
      case 'freeze':   await cmdFreeze(agents); break;
      case 'unfreeze': cmdUnfreeze(agents); break;
      case 'withdraw': await cmdWithdraw(agents, parts[1]); break;
      case 'set':      cmdSet(parts[1], parts[2]); break;
      case 'exit':
      case 'quit':
        console.log('\nEnclave shutting down... Goodbye.');
        process.exit(0);
        break;
      default:
        console.log(chalk.gray(`\n  Unknown command: "${cmd}". Type 'help' for list.\n`));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nEnclave shutting down... Goodbye.');
    process.exit(0);
  });
}

module.exports = { start };
// cli v1





