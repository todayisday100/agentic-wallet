<div align="center">

<img src="assets/banner.png" alt="Enclave" width="100%" />

# Enclave

**On-chain spend control and trust layer for autonomous AI agents**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-green.svg)]()
[![CI](https://github.com/adrydevel/enclave/actions/workflows/ci.yml/badge.svg)](https://github.com/adrydevel/enclave/actions)
[![x402](https://img.shields.io/badge/protocol-x402-00ffa3.svg)]()

[Overview](#overview) · [Quick Start](#quick-start) · [CLI Reference](#cli-reference) · [Roadmap](#roadmap)

---

### `CA: 8HxYvteUAEuxBCxAaWJZiDAXYebo1h8QzNi3tSbNpump`

</div>

---

## Overview

Enclave is a spend control layer for autonomous AI agents. As AI systems gain access to real capital — paying APIs, spinning up infra, settling onchain — there's no native mechanism to enforce budgets, detect drift, or halt runaway spend.

Enclave solves that. Every agent gets a hard budget cap, a behavioral trust score (KYA — Know Your Agent), and real-time monitoring. Violations trigger automatic pauses, alerts, or full treasury freezes.

Built on the [x402 payment protocol](https://x402.org) — the emerging HTTP-native standard for agent-to-agent payments.

> Currently in simulation mode. Real onchain deployment coming Q3 2026.

---

## Features

| | Feature | Description |
|---|---|---|
| ◆ | **Budget caps** | Hard per-agent limits with configurable alert thresholds |
| ◆ | **KYA scoring** | Behavioral trust score — detects drift before it becomes a problem |
| ◆ | **x402 signing** | Native request signing over the x402 HTTP payment layer |
| ◆ | **Live CLI** | Interactive `enc>` prompt — pause, topup, freeze, inspect in real time |
| ◆ | **Anomaly engine** | Budget breach, KYA floor violation, and treasury-wide freeze events |
| ◆ | **Policy engine** | Per-agent tx limits, global thresholds, min trust scores |

---

## Quick Start

```bash
git clone https://github.com/adrydevel/enclave.git
cd enclave
npm install
npm start
```

No config required — all values have sensible defaults. Add a `.env` to override.

---

## CLI Reference

```
enc> status                  Treasury overview + active agents
enc> agents                  All agents with spend and KYA
enc> agent <id>              Agent detail + recent transactions
enc> txlog [id]              Last 20 transactions
enc> pause <id>              Pause agent spending
enc> resume <id>             Resume paused agent
enc> topup <id> <usd>        Add budget to agent
enc> limit <id> <usd>        Set max single tx for agent
enc> freeze                  Halt ALL agent spending
enc> unfreeze                Resume all agents
enc> withdraw <usd>          Withdraw from treasury
enc> set threshold <pct>     Low-budget alert threshold
enc> set kya-min <n>         Minimum KYA trust score
enc> help                    Command reference
enc> exit                    Shutdown
```

---

## Configuration

Set via `.env` or environment variables. All optional.

| Variable | Default | Description |
|---|---|---|
| `ENC_AGENT_ID` | `enc-primary-001` | Identity of this instance |
| `ENC_NETWORK` | `testnet` | Target network |
| `ENC_TOTAL_BUDGET` | `10000` | Total treasury budget (USD) |
| `ENC_ALERT_THRESHOLD` | `0.2` | Budget fraction to trigger alert |
| `ENC_KYA_MIN_SCORE` | `0.6` | Minimum acceptable trust score |
| `ENC_MAX_SINGLE_TX` | `500` | Max per-transaction spend (USD) |
| `ENC_TICK_INTERVAL_MS` | `2000` | Simulation tick interval (ms) |

---

## How It Works

```
Agent Registry → Budget Allocation → x402 Request Signing
       ↓                                      ↓
  KYA Scorer ←── Behavior Monitor ←── Transaction Log
       ↓
  Anomaly Engine → Alert / Pause / Freeze
```

1. Agents register with an initial budget and policy set
2. Every transaction is signed, logged, and scored
3. KYA score updates continuously based on spend patterns
4. Violations trigger automated responses — no human in the loop required

---

## Roadmap

- [x] Core budget engine
- [x] KYA behavioral scoring
- [x] x402 request signing
- [x] Interactive CLI
- [x] Real-time anomaly detection
- [ ] TEE key storage (Q2 2026)
- [ ] Multi-sig approval flows (Q2 2026)
- [ ] Session keys with TTL (Q3 2026)
- [ ] Onchain deployment (Q3 2026)
- [ ] Insurance payout module (Q4 2026)

---

## License

MIT © 2026 Enclave
