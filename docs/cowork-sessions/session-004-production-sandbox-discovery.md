# Cowork Session 004 — Production Domain Still Blocked
**Date:** 2026-02-26  
**Participants:** BossManJ + Claude (Cowork) + TIBER plugin  
**Plugin Version:** tiber-fantasy v0.1.0  
**API Connection:** Attempted — blocked at network proxy (403 Forbidden)

---

## Setup

After Session 003 confirmed that Cowork blocks `worf.replit.dev`, the hypothesis was that a production deployment on a non-Replit domain would bypass the allowlist. Steps taken before this session:

1. TIBER deployed to Replit production → `fantasy-team-analyzer-josephmasciale1.replit.app`
2. Health endpoint confirmed live from Replit server: `{"ok": true, "db": "connected"}`
3. TIBER deployed to Railway → `tiber-fantasy-production.up.railway.app`
4. Railway deployment confirmed live: `GET /api/v1/players/search?name=waddle` returned Jaylen Waddle with full v1 metadata
5. `plugin-config.json` updated to Railway URL
6. `CLAUDE.md` updated — health check changed from `/api/v1/health` to `/health` (that route wasn't in the GitHub commit)
7. Cowork session started with: "Give me a full dynasty evaluation on Jaylen Waddle"

---

## What Happened

**CLAUDE.md bootstrapped correctly.** Claude confirmed skills loaded, config loaded, commands ready. The two-step health check (root `/health` + v1 search ping) was executed in order.

**All API calls returned 403 Forbidden.** Error: "blocked-by-allowlist." The Cowork network proxy blocks outbound HTTP to `tiber-fantasy-production.up.railway.app` — same behavior as the Replit dev domain.

**No-fabrication rule held perfectly.** Claude offered three options unprompted: (1) fix the proxy allowlist, (2) paste raw API data directly into the chat, (3) framework-only analysis with clear labeling. It did not estimate Alpha scores or pillar values.

**Claude self-diagnosed the architectural limitation accurately.** It identified the 403 as a proxy-level block, not an API or auth failure.

---

## Key Findings

1. **Cowork blocks ALL outbound HTTP, not just Replit domains.** Railway (`*.up.railway.app`), Replit production (`*.replit.app`), and Replit dev (`*.replit.dev`) are all blocked. The restriction is at the Cowork egress proxy level — domain-agnostic.

2. **The plugin architecture is sound but the transport model is wrong.** CLAUDE.md, skills, commands, config loading, health check sequencing, no-fabrication enforcement — all working exactly as designed. The only failure is the network transport assumption: that Claude can make outbound HTTP calls from inside Cowork.

3. **The correct architecture is file-based data delivery, not live API calls.** Claude can read files. The fix is a local sync CLI that pre-fetches TIBER data to JSON files in the plugin folder. Claude reads those files instead of calling the API. No outbound HTTP needed.

4. **The Railway deployment is still valuable.** It's the production API endpoint for the web app, the Tiber Sync CLI, and any external consumers (developers, agents, personal AI tools outside Cowork's sandbox).

---

## Architecture Decision: TIBER Sync CLI

The Cowork plugin needs a two-part architecture going forward:

**Part 1 — Sync script (runs locally, outside Cowork):**
```bash
npm run tiber:sync -- --players "Jaylen Waddle, Josh Allen"
```
Fetches FORGE + FIRE + CATALYST from the Railway API, writes results to `tiber-cowork-plugin/data/players.json`. User runs this before starting a Cowork session.

**Part 2 — CLAUDE.md updated to read from file first:**
Instead of calling the API directly, Claude checks `data/players.json` for pre-fetched data. If a player is cached, it reads from file. If not, it tells the user to run the sync script for that player.

This pattern also enables offline sessions once data is synced, and lets users pre-load a full roster before a trade deadline session.

---

## Resolution

Session 004 closed as a network architecture finding, not a plugin failure. Next session will test with the TIBER Sync CLI architecture. The no-fabrication rule continues to be the most important safety mechanism in the system — it failed loudly and correctly when the API was unreachable.

**Immediate next steps:**
1. Build `tiber:sync` script — fetches player data from Railway API, writes to plugin folder
2. Update `CLAUDE.md` to read from `data/players.json` as primary data source
3. Update `CLAUDE.md` health check to confirm file freshness, not just network ping
4. Session 005: test with pre-synced Jaylen Waddle data
