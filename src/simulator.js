'use strict';

const config  = require('./config');
const display = require('./display');
const state   = require('./state');
const wallet  = require('./wallet');

// Per-agent behavior profiles
const PROFILES = {
  'arx-7':       { endpoints: ['/v1/data-fetch', '/v1/verify'],               costRange: [8,   45],  latRange: [30,  120], weight: 3 },
  'mnemosyne':   { endpoints: ['/v1/inference',  '/v1/compute'],               costRange: [40,  180], latRange: [200, 600], weight: 4 },
  'chiron-v2':   { endpoints: ['/v1/verify',     '/v1/consensus', '/v1/compute'], costRange: [15, 90],  latRange: [80,  250], weight: 2 },
  'polis-agent': { endpoints: ['/v1/consensus',  '/v1/verify'],                costRange: [5,   30],  latRange: [100, 300], weight: 2 },
  'daedalus':    { endpoints: ['/v1/compute',    '/v1/inference'],             costRange: [60,  200], latRange: [150, 480], weight: 5 },
  'echo-3':      { endpoints: ['/v1/data-fetch', '/v1/consensus'],             costRange: [5,   25],  latRange: [30,  120], weight: 2 },
};

const METHODS = {
  '/v1/data-fetch': 'GET',
  '/v1/verify':     'POST',
  '/v1/compute':    'POST',
  '/v1/inference':  'POST',
  '/v1/consensus':  'POST',
};

function rand(min, max)  { return Math.random() * (max - min) + min; }
function randInt(a, b)   { return Math.floor(rand(a, b + 1)); }
function pick(arr)       { return arr[Math.floor(Math.random() * arr.length)]; }

// Pick active (non-paused) agent, weighted by activity level
function pickAgent(agents) {
  const active = agents.filter(a => !state.pausedAgents.has(a.id));
  if (active.length === 0) return null;
  const total = active.reduce((s, a) => s + (PROFILES[a.id]?.weight || 1), 0);
  let r = rand(0, total);
  for (const a of active) {
    r -= (PROFILES[a.id]?.weight || 1);
    if (r <= 0) return a;
  }
  return active[0];
}

// ─── x402 request + budget deduction (one linked event) ──────────────────────

function genRequest(agents) {
  const agent = pickAgent(agents);
  if (!agent) return;

  const profile  = PROFILES[agent.id] || { endpoints: ['/v1/compute'], costRange: [10, 100], latRange: [100, 400] };
  const endpoint = pick(profile.endpoints);
  const method   = METHODS[endpoint] || 'POST';
  const latency  = randInt(profile.latRange[0], profile.latRange[1]);
  const maxCost  = agent.maxSingleTx || config.maxSingleTx;
  const cost     = parseFloat(rand(profile.costRange[0], Math.min(profile.costRange[1], maxCost)).toFixed(2));
  const txId     = wallet.generateShortTx();

  // Budget check
  const remaining = agent.budgetAllocated - agent.budgetSpent;
  if (remaining <= 0) {
    display.logAlert(`Agent ${agent.id} budget exhausted — request blocked`, true);
    return;
  }

  const actual = parseFloat(Math.min(cost, remaining).toFixed(2));
  agent.budgetSpent += actual;

  // Log x402 request
  display.logX402(agent, method, endpoint, actual, 200, latency, txId);

  // Store in tx history
  state.pushTx({ ts: Date.now(), agentId: agent.id, txId, method, endpoint, cost: actual, latency });

  // KYA drops slightly when budget is nearly exhausted
  const remPct = (agent.budgetAllocated - agent.budgetSpent) / agent.budgetAllocated;
  if (remPct < 0.15 && Math.random() < 0.35) {
    const drop     = parseFloat(rand(0.01, 0.03).toFixed(2));
    const oldScore = agent.kyaScore;
    agent.kyaScore = parseFloat(Math.max(0, agent.kyaScore - drop).toFixed(2));
    if (agent.kyaScore !== oldScore) display.logKya(agent, oldScore, agent.kyaScore);
  }

  // Budget alerts
  if (remPct <= 0.1)                  display.logAlert(`Budget critically low for ${agent.id} (${(remPct * 100).toFixed(1)}% remaining)`, true);
  else if (remPct <= config.alertThreshold) display.logAlert(`Budget low for ${agent.id} (${(remPct * 100).toFixed(1)}% remaining)`, false);

  // KYA alert
  if (agent.kyaScore < config.kyaMinScore)
    display.logAlert(`KYA score below threshold for ${agent.id} (${agent.kyaScore.toFixed(2)} < ${config.kyaMinScore.toFixed(2)})`, false);
}

// ─── Standalone KYA drift (good behaviour over time) ─────────────────────────

function genKyaDrift(agents) {
  const active = agents.filter(a => a.budgetSpent > 0 && !state.pausedAgents.has(a.id));
  if (active.length === 0) return;

  const agent    = pick(active);
  const oldScore = agent.kyaScore;
  const up       = Math.random() > 0.25; // mostly positive drift
  const delta    = parseFloat(rand(0.01, 0.04).toFixed(2)) * (up ? 1 : -1);
  agent.kyaScore = parseFloat(Math.min(1, Math.max(0, agent.kyaScore + delta)).toFixed(2));

  if (agent.kyaScore !== oldScore) display.logKya(agent, oldScore, agent.kyaScore);

  if (agent.kyaScore < config.kyaMinScore && oldScore >= config.kyaMinScore)
    display.logAlert(`KYA score below threshold for ${agent.id} (${agent.kyaScore.toFixed(2)} < ${config.kyaMinScore.toFixed(2)})`, false);
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

function genHeartbeat(agents) {
  const total = agents.reduce((s, a) => s + a.budgetAllocated, 0);
  const spent = agents.reduce((s, a) => s + a.budgetSpent, 0);
  display.logSystem(`Treasury heartbeat — ${agents.length} agents active │ ${display.fmt(total - spent)} USD remaining of ${display.fmtInt(total)} USD`);
}

// ─── Main tick ────────────────────────────────────────────────────────────────

let ticksSinceHeartbeat = 0;

function tick(agents) {
  if (state.animating) return; // user is running a command animation — skip

  ticksSinceHeartbeat++;
  if (ticksSinceHeartbeat >= 15) {
    genHeartbeat(agents);
    ticksSinceHeartbeat = 0;
    return;
  }

  if (Math.random() < 0.78) genRequest(agents);
  else                       genKyaDrift(agents);
}

module.exports = { tick };
