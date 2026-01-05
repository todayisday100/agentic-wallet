'use strict';

const chalk    = require('chalk');
const boxen    = require('boxen');
const Table    = require('cli-table3');
const readline = require('readline');
const config   = require('./config');
const state    = require('./state');

const blue = chalk.hex('#5B8FFF');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(num) {
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(num) {
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function timestamp() {
  const d  = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return chalk.gray(`[${hh}:${mm}:${ss}]`);
}

// Prompt-aware log: clears the current input line, prints, restores prompt + any partial input
function _log(msg) {
  const rl = state.rl;
  if (rl && process.stdout.isTTY) {
    const partial = rl.line || ''; // what the user has typed so far
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(msg + '\n');
    rl.prompt(true);
    if (partial) process.stdout.write(partial);
  } else {
    console.log(msg);
  }
}

// ─── Boot (no prompt active yet — use console.log directly) ──────────────────

function printBanner(text) { console.log(blue(text)); }

function printOnlineBox(cfg, agentCount) {
  const lines = [
    blue('Enclave Online'),
    '',
    `  Agent ID:  ${cfg.agentId}`,
    `  Network:   ${state.wallet.networkName || cfg.network}`,
    `  Contract:  ${state.treasury.contractAddress ? state.treasury.contractAddress.slice(0,18)+'...' : chalk.gray('not deployed')}`,
    `  Budget:    ${fmtInt(state.treasury.totalBudget || cfg.totalBudget)} USD`,
    `  Agents:    ${agentCount} registered`,
    `  Status:    ${blue('MONITORING')}`,
  ].join('\n');

  console.log(boxen(lines, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: 'single',
    borderColor: '#5B8FFF',
  }));
}

// ─── Event log lines (prompt-aware) ──────────────────────────────────────────

function logX402(agent, method, path, cost, status, latency, txid) {
  const txStr  = txid ? chalk.gray(txid) + '  ' : '';
  const costStr = `${fmt(cost)} USD`;
  const latStr  = chalk.gray(`${latency}ms`);
  _log(`${timestamp()} ${blue('x402')} ${blue('◆')} ${txStr}${agent.id} → ${method} ${path}  │ ${costStr} │ 200 OK │ ${latStr}`);
}

function logKya(agent, oldScore, newScore) {
  const delta = (newScore - oldScore).toFixed(2);
  const sign  = delta >= 0 ? '+' : '';
  const arrow = newScore >= oldScore ? blue('▲') : chalk.gray('▼');
  _log(`${timestamp()} ${blue('kya')}  ${arrow} ${agent.id} score updated: ${oldScore.toFixed(2)} → ${newScore.toFixed(2)} ${chalk.gray(`(${sign}${delta})`)}`);
}

function logAlert(msg, critical) {
  const color = critical ? chalk.red : chalk.yellow;
  _log(`${timestamp()} ${color('⚠ ALERT')} │ ${color(msg)}`);
}

function logSystem(msg) {
  _log(`${timestamp()} ${chalk.gray('sys')}   ${chalk.gray('·')} ${chalk.gray(msg)}`);
}

// ─── Dashboard table ──────────────────────────────────────────────────────────

function printDashboard(agents) {
  const table = new Table({
    head: [blue('Agent'), blue('Role'), blue('KYA Score'), blue('Budget'), blue('Used'), blue('Status')],
    style: { head: [], border: [] },
    colWidths: [15, 20, 11, 16, 9, 24],
  });

  let totalAllocated = 0, totalSpent = 0, totalKya = 0, alertCount = 0;

  for (const a of agents) {
    const remaining = a.budgetAllocated - a.budgetSpent;
    const pct       = (a.budgetSpent / a.budgetAllocated) * 100;
    const remPct    = remaining / a.budgetAllocated;
    const paused    = state.pausedAgents.has(a.id);

    let status = 'OK';
    if (paused)             { status = chalk.gray('PAUSED'); }
    else if (remPct <= 0.1) { status = chalk.red('⚠ BUDGET CRITICAL'); alertCount++; }
    else if (remPct <= config.alertThreshold) { status = chalk.yellow('⚠ BUDGET LOW'); alertCount++; }
    if (!paused && a.kyaScore < config.kyaMinScore) { status = chalk.yellow('⚠ KYA LOW'); alertCount++; }

    totalAllocated += a.budgetAllocated;
    totalSpent     += a.budgetSpent;
    totalKya       += a.kyaScore;

    table.push([a.id, a.role, a.kyaScore.toFixed(2), `${fmtInt(a.budgetAllocated)} USD`, `${pct.toFixed(1)}%`, status]);
  }

  const avgKya   = (totalKya / agents.length).toFixed(2);
  const totalPct = ((totalSpent / totalAllocated) * 100).toFixed(1);
  table.push([blue('TOTAL'), '', `avg: ${avgKya}`, `${fmtInt(totalAllocated)} USD`, `${totalPct}%`, `${alertCount} alert${alertCount !== 1 ? 's' : ''}`]);

  const header = '\n' + blue('─'.repeat(54)) + ' Enclave Dashboard ' + blue('─'.repeat(10));
  _log(header + '\n' + table.toString());
}

module.exports = { fmt, fmtInt, printBanner, printOnlineBox, logX402, logKya, logAlert, logSystem, printDashboard };
// display





