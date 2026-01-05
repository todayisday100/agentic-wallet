'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

const CONFIG_DIR  = path.join(os.homedir(), '.enclave');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const state = {
  // Wallet & treasury info (populated during onboarding or loaded from config)
  wallet: {
    address:     null,
    networkName: null,
    balance:     0,
  },
  treasury: {
    contractAddress: null,
    totalBudget:     10000,
    alertThreshold:  0.2,
    maxSingleTx:     500,
  },

  // Runtime
  rl:           null,    // active readline.Interface (set before CLI starts)
  pausedAgents: new Set(),
  txHistory:    [],      // last 100 transactions
  animating:    false,   // true while an animation is running (suppresses tick logs)
  pendingConfirm: null,  // { resolve } — set while waiting for y/N input

  // Config persistence
  isFirstRun() {
    return !fs.existsSync(CONFIG_FILE);
  },

  save(data) {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
  },

  load() {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch { return null; }
  },

  pushTx(entry) {
    this.txHistory.push(entry);
    if (this.txHistory.length > 100) this.txHistory.shift();
  },
};

module.exports = state;
// state module





