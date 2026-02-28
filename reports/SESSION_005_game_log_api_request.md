# SESSION 005 — Feature Request: Per-Player Weekly Game Log API Endpoint

**Requested by:** Max (OpenClaw agent)  
**Date:** 2026-02-28  
**Priority:** High — blocks agent-driven game log analysis  
**Context:** Live connector test with Joe, Zay Flowers buy/sell analysis

---

## The Wall We Hit

During a live buy/sell session using the OpenClaw agent connector, Joe asked for a week-by-week game log breakdown for Zay Flowers (GSIS: `00-0039064`) — specifically which weeks he spiked and whether TIBER has any boom/spike predictors.

Here's what happened:

### Endpoints tried and results:

| Endpoint | Result |
|----------|--------|
| `GET /api/logs/player/00-0039064?season=2025` | `{ ok: true, data: [], count: 0 }` — empty |
| `GET /api/logs/player/zay-flowers?season=2025` | Same — empty |
| `GET /api/data-lab/lab-agg?position=WR&weekStart=3&weekEnd=3&season=2025` | Returns **full season totals** regardless of week filter — aggregation ignores the week range |
| `GET /api/data-lab/player/00-0039064?season=2025` | 404 Not Found |
| `GET /api/data-lab/weekly?playerId=00-0039064&season=2025` | 404 Not Found |
| `GET /api/forge/transparency/zay-flowers` | Returns `weeklyAlpha: null` |
| `GET /api/v1/forge/player/:id` | Season-level only, no weekly breakdown |

### What we confirmed:
- Weekly snapshot data **exists** in the DB — `availableWeeks: [1..18]` confirmed via `/api/data-lab/meta/current`
- `datadive_snapshot_player_week` table has per-week rows
- The `lab-agg` endpoint is aggregating across all available weeks and **ignoring** the `weekStart`/`weekEnd` filter when applied to a single player lookup
- No public-facing endpoint exposes individual week rows for a specific player

---

## Feature Request: `/api/data-lab/player/:playerId/weekly`

### What's needed

A new endpoint that returns per-week game log rows for a single player, pulling from `datadive_snapshot_player_week`.

### Suggested endpoint

```
GET /api/data-lab/player/:playerId/weekly?season=2025
```

### Suggested response shape

```json
{
  "playerId": "00-0039064",
  "playerName": "Zay Flowers",
  "position": "WR",
  "season": 2025,
  "weeks": [
    {
      "week": 1,
      "targets": 8,
      "receptions": 6,
      "recYards": 94,
      "recTds": 1,
      "routes": 35,
      "snapShare": 0.82,
      "targetShare": 0.28,
      "epaPerTarget": 0.41,
      "yprr": 2.1,
      "adot": 9.2,
      "fptsPpr": 21.4,
      "fptsHalf": 17.4,
      "fptsStd": 13.4,
      "rzTargets": 1,
      "rzTds": 1,
      "twoMinuteTargets": 2,
      "thirdDownTargets": 3
    }
    // ... weeks 2-18
  ]
}
```

### Why this matters for agents

With week-by-week data an agent can:
- Identify which specific weeks a player spiked and correlate to opponent, game script, or usage patterns
- Calculate boom rate (e.g. weeks ≥ 20 PPR pts) vs bust rate (< 8 pts)
- Spot usage trends — is target share growing or shrinking late season?
- Identify the momentum score driver (Zay's momentum score of 35 — we couldn't tell *why* without week-level data)
- Build spike predictors: correlate high-EPA weeks to aDOT, snap share, opponent, or game script

Right now TIBER's FORGE momentum score hints at a trend but can't explain it. Game logs would let the agent surface the actual story.

---

## Secondary Request: Fix `lab-agg` Week Filter

The `weekStart`/`weekEnd` params on `/api/data-lab/lab-agg` appear to not filter correctly — returning season totals regardless. If this was intentional (aggregate only), the weekly endpoint above is the fix. If it was meant to support week slicing, worth a look at the query logic in `dataLabRoutes.ts`.

---

## How the Connector Will Use This

Once live, the tool call will look like:

```bash
./tools/player-gamelogs.sh 00-0039064 2025
```

And an agent conversation goes:

> "Zay spiked in weeks 3, 9, and 14 — all against zone-heavy defenses with Baltimore trailing in the 2nd half. His target share jumped above 35% in those games. That's the boom trigger: pass-heavy game script + zone coverage."

That's the level of insight TIBER should be able to deliver. This endpoint is what gets us there.

---

## Files to Reference

- `server/routes/dataLabRoutes.ts` — add new route here
- `shared/schema.ts` — `datadive_snapshot_player_week` table (source data)
- `tiber-cowork-plugin/openclaw/tools/` — new `player-gamelogs.sh` tool to be added once endpoint exists
