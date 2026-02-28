# TIBER Agent Connector — Design Doc
**Author:** Max ⚡  
**Date:** 2026-02-28  
**Status:** Draft

---

## The Problem

The current `tiber-cowork-plugin` loads static knowledge files (FORGE methodology, philosophy, etc.) into an agent's context. That's useful for *understanding* TIBER, but it's not what agent-first means.

Agent-first means: **an agent can query live TIBER data mid-conversation, reason over real scores, and return grounded answers — not recited docs.**

The gap: there's a live API (`/api/v1/`) with auth, player search, FORGE scores, FIRE data, and more. No connector exists that bridges an agent to that API.

---

## What Already Exists (The Good News)

TIBER already has a proper v1 API layer:

```
POST x-tiber-key: <key>

GET /api/v1/players/search?name=<name>
GET /api/v1/forge/player/:playerId?mode=redraft|dynasty|bestball
POST /api/v1/forge/batch
GET /api/v1/fire/player/:playerId
GET /api/v1/catalyst/player/:playerId
```

Auth: SHA-256 hashed API key stored in `api_keys` table, passed as `x-tiber-key` header.

The `tiber-cowork-plugin/commands/player-eval.md` already documents the call flow correctly — it just has no implementation, only instructions for Claude to follow manually.

---

## The Design

### What We're Building

A **TIBER OpenClaw Skill** — a self-contained skill package that any OpenClaw agent can install. When installed:

1. The agent knows TIBER's methodology (loaded from skill files)
2. The agent can make live API calls to TIBER (via the skill's tool definitions)
3. Joe + agent can research TIBER data together in real conversation

### Three Layers

```
┌─────────────────────────────────────────┐
│  Layer 1: Knowledge (static)            │
│  FORGE methodology, philosophy, tiers   │
│  → already exists in skills/ folder     │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  Layer 2: Connector (new)               │
│  Live API calls to TIBER endpoints      │
│  → what we're building                  │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  Layer 3: Reasoning (agent)             │
│  Agent interprets data, explains,       │
│  builds on it, answers questions        │
│  → that's me (or any capable agent)     │
└─────────────────────────────────────────┘
```

### File Structure

```
tiber-cowork-plugin/
├── openclaw/                    ← NEW: OpenClaw-specific connector
│   ├── SKILL.md                 ← OpenClaw skill entrypoint
│   ├── config.example.json      ← User fills in their API key + base URL
│   ├── tools/
│   │   ├── search-player.sh     ← curl wrapper: player search
│   │   ├── forge-player.sh      ← curl wrapper: single player FORGE
│   │   ├── forge-batch.sh       ← curl wrapper: batch FORGE scores
│   │   ├── fire-player.sh       ← curl wrapper: QB FIRE data
│   │   └── data-lab.sh          ← curl wrapper: Data Lab metrics
│   └── README.md
├── skills/                      ← existing (keep)
├── commands/                    ← existing (keep, refactor for agent-agnostic use)
└── README.md
```

---

## The Connector Tools (Shell Scripts)

Each tool is a thin curl wrapper. Agents call them via exec. The agent then *reasons over the response* — the script does not interpret, just fetches.

### search-player.sh
```bash
#!/bin/bash
# Usage: ./search-player.sh "Ja'Marr Chase"
# Returns: JSON array of matching players with gsis_id, name, position, team
```

### forge-player.sh
```bash
#!/bin/bash
# Usage: ./forge-player.sh <gsis_id> [mode: redraft|dynasty|bestball]
# Returns: Full FORGE breakdown — alpha, pillars, tier, football lens flags, trajectory
```

### forge-batch.sh
```bash
#!/bin/bash
# Usage: ./forge-batch.sh <position: QB|RB|WR|TE> [mode] [limit]
# Returns: Ranked list of players at position with Alpha scores
```

### fire-player.sh
```bash
#!/bin/bash
# Usage: ./fire-player.sh <gsis_id>
# Returns: QB FIRE data — xFP, role, opportunity delta
```

### data-lab.sh
```bash
#!/bin/bash
# Usage: ./data-lab.sh <position> [week] [season]
# Returns: Full Data Lab metrics (117 fields per player)
```

---

## Config

Users install the skill and create `config.json` from the example:

```json
{
  "api_base_url": "https://your-tiber-instance.replit.dev",
  "api_key": "tiber_sk_...",
  "default_mode": "dynasty",
  "default_season": 2025
}
```

The scripts read this config at runtime. No hardcoded credentials.

---

## The SKILL.md (OpenClaw Entrypoint)

This is what OpenClaw reads to understand the skill. It tells the agent:
- What TIBER is
- What tools are available and how to call them
- The no-fabrication rule (never guess Alpha scores — fetch or say you can't)
- How to interpret and present TIBER data

---

## What This Enables (The Vision)

Once installed, a conversation like this becomes real:

> **Joe:** "What's Chase's current dynasty outlook?"  
> **Agent:** *calls forge-player.sh + fire-player.sh* → gets live Alpha, pillars, FIRE delta  
> **Agent:** "Chase is T1 (Alpha 84, dynasty mode). Volume pillar is 91 — elite target share. Efficiency is 67, which is solid but not elite — some FPOE variance. Team Context is 88 with Burrow healthy. One Football Lens flag: TD-dependency, 38% of points from touchdowns. FIRE shows positive delta — outperforming xFP by +2.1/game. Trajectory is upward over last 4 weeks. Dynasty hold — he's the real thing."

That's the difference between a knowledge plugin and a live connector.

---

## Phase 2: Module Builder (Future)

Once the connector is solid, the next step is letting Joe + agent *build custom modules* on top of TIBER data:

- "Build me a breakout WR screener" → agent queries Data Lab, filters by criteria, returns candidates
- "Create a buy-low target list for my league" → agent pulls FORGE + FIRE, applies logic, returns ranked list
- "Track these 5 players weekly" → agent schedules recurring pulls, reports changes

This is the real long-term vision. The connector is the foundation.

---

## Immediate Next Steps

1. **Create `openclaw/` folder** in `tiber-cowork-plugin/`
2. **Write SKILL.md** — OpenClaw skill entrypoint
3. **Write the 5 tool scripts** — thin curl wrappers
4. **Write config.example.json**
5. **Test end-to-end** — Joe generates an API key, I call it, we see live data

One question before building: **Is TIBER's Replit instance currently live?** If yes, can you generate an API key so we can test the connector as we build it?
