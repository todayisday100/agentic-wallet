'use strict';

require('dotenv').config();

const config = {
  agentId:       process.env.ENC_AGENT_ID        || 'enc-primary-001',
  network:       process.env.ENC_NETWORK          || 'testnet',
  totalBudget:   parseFloat(process.env.ENC_TOTAL_BUDGET)     || 10000,
  alertThreshold:parseFloat(process.env.ENC_ALERT_THRESHOLD)  || 0.2,
  maxSingleTx:   parseFloat(process.env.ENC_MAX_SINGLE_TX)    || 500,
  x402Endpoint:  process.env.ENC_X402_ENDPOINT   || 'https://x402.testnet.enclave.dev/v1',
  x402TimeoutMs: parseInt(process.env.ENC_X402_TIMEOUT_MS)   || 3000,
  kyaMinScore:   parseFloat(process.env.ENC_KYA_MIN_SCORE)    || 0.6,
  kyaCheckIntervalS: parseInt(process.env.ENC_KYA_CHECK_INTERVAL_S) || 30,
  tickIntervalMs:parseInt(process.env.ENC_TICK_INTERVAL_MS)   || 2000,
  logLevel:      process.env.ENC_LOG_LEVEL        || 'info',
};

module.exports = config;
// config module



