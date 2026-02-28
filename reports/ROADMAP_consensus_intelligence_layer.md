# ROADMAP ITEM — Real-Time Consensus Intelligence Layer

**Flagged by:** Max (OpenClaw agent)  
**Date:** 2026-02-28  
**Session:** Live connector test / Jets team context discussion  
**Priority:** Strategic — core to agent-first vision

---

## The Gap

TIBER's data pipeline is frozen in time. It knows what happened on the field in 2025. It does not know:

- What happened in the 2026 offseason (trades, signings, releases, coaching hires)
- What the analyst community thinks about a player or team right now
- How the market is pricing a player in ADP or trade value
- What narratives are driving consensus up or down

When asked "how up to date is TIBER on the Jets as of February 28, 2026?" — the honest answer is: TIBER knows the 2025 on-field data but is blind to everything since the season ended.

For an agent to give truly grounded, current analysis, it needs to know both what TIBER has derived *and* what the world currently believes.

---

## The Vision (Joe's framing)

> "TIBER needs to see what the community consensus is across the domain. Needs it as a baseline and to have an understanding of the world it exists in. And then agents and humans can reason off what Tiber has derived from consensus."

This is a two-layer intelligence model:

```
Layer 1: TIBER-derived truth
  → What the on-field data actually says
  → FORGE Alpha scores, efficiency metrics, volume signals
  → Ground truth — objective, not narrative-driven

Layer 2: Consensus reality
  → What the community believes right now
  → Analyst takes, X/Twitter discourse, ADP movement, trade value shifts
  → Narrative-driven — often wrong, always relevant

Agent reasoning = Layer 1 vs Layer 2 delta
  → Where TIBER diverges from consensus = the edge
  → Where consensus is right and TIBER is stale = the correction
```

---

## Why X (Twitter) Specifically

X is where the fantasy football analyst community lives in real time:
- Breaking news (injuries, signings, cuts, trades, depth chart changes)
- Analyst takes and reactions — Matthew Berry, Scott Fish, Establish the Run, etc.
- Community ADP shifts and trade value moves
- Coaching hires, scheme changes, training camp reports
- The discourse that drives market pricing

It's messy and noisy, but it's the fastest signal in the domain. The key is not to trust it blindly — it's to ingest it, identify consensus, and let TIBER's data validate or contradict it.

---

## What This Enables

**Example conversation (current state):**
> Joe: "What does TIBER know about the Jets heading into 2026?"  
> Max: "TIBER has 2025 on-field data. Garrett Wilson played 7 games. Beyond that, blind."

**Example conversation (with consensus layer):**
> Joe: "What does TIBER know about the Jets heading into 2026?"  
> Max: "TIBER's 2025 data shows Wilson was efficient in 7 games before injury. Consensus on X this week: Jets signed [QB], Wilson is being drafted as WR18 in early mocks, analysts are bullish. TIBER efficiency metrics support the optimism — his per-route numbers when healthy were strong. The market may still be underpricing him given injury recency bias."

That's a real answer.

---

## Proposed Architecture

### Phase 1: X Integration (News + Consensus Ingestion)
- Monitor key fantasy football accounts and hashtags
- Ingest breaking news (roster moves, injuries, depth chart changes)
- Tag content by player, team, position
- Extract sentiment and consensus signals
- Store in a `consensus_signals` table with timestamp, source, confidence

### Phase 2: ADP / Trade Value Sync
- Pull ADP from Sleeper (already integrated) on a rolling basis
- Track week-over-week ADP movement as a market signal
- Flag sharp moves (>5 spots in 48h) as high-priority signals

### Phase 3: Consensus vs TIBER Delta Engine
- For each player, compute: TIBER Alpha vs market consensus
- Surface "disagreement scores" — where TIBER and the market diverge most
- These are the edges: buy when TIBER is bullish and market is cold, sell when TIBER is bearish and market is hot

### Phase 4: Agent-Queryable Consensus API
- `GET /api/consensus/player/:id` — current consensus summary, recent takes, ADP trend
- `GET /api/consensus/team/:team` — latest team context (roster moves, scheme, QB situation)
- `GET /api/consensus/delta` — biggest TIBER vs consensus divergences right now

---

## What Agents Do With This

When a human asks about a player, the agent:

1. Pulls TIBER FORGE data (objective truth)
2. Pulls consensus snapshot (what the world thinks)
3. Computes the delta
4. Presents: "TIBER says X. The market believes Y. Here's why they differ and which side I trust."

The agent becomes a **translator between data and narrative** — which is exactly what a good fantasy analyst does.

---

## Notes for Replit Agent

- TIBER already has an X/social integration stub (`/api/consensus` routes exist per API_MAP.md)
- Sleeper ADP sync already exists — extend it for trend tracking
- The `rag_news.db` SQLite file in the repo suggests a RAG news pipeline was started — worth reviewing what's already there
- X API access (Basic tier) gives 10k tweets/month read — enough for targeted account monitoring
- Priority accounts to monitor: beat reporters per team, top fantasy analysts, official team accounts

---

## The Long Game

This is how TIBER becomes genuinely adaptive — not just a stat archive, but a living intelligence layer that knows what happened on the field AND what the world currently believes about it.

The edge in fantasy football has always been finding where the data and the narrative diverge. TIBER + consensus = the machine that finds that edge systematically.
