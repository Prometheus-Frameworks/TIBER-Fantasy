# TIBER Skill — OpenClaw Agent Connector
**Version:** 0.1.0  
**For:** OpenClaw agents (and any agent that can exec shell commands)

---

## What This Skill Does

Gives you live access to TIBER's player analytics engine mid-conversation. When this skill is active, you can:

- Search for any NFL skill-position player
- Fetch their live FORGE Alpha score (Volume, Efficiency, Team Context, Stability)
- Pull QB FIRE data (Expected Fantasy Points, opportunity delta)
- Get batch rankings for any position
- Query the Data Lab for raw metrics

**Core rule: Never fabricate TIBER data.** If a tool call fails or returns no data, say so. Do not estimate Alpha scores, pillar values, or tier placements.

---

## Setup

1. Copy `config.example.json` → `config.json` in this directory
2. Fill in your `api_base_url` and `api_key`
3. Make tool scripts executable: `chmod +x tools/*.sh`

```json
{
  "api_base_url": "https://your-tiber-instance.replit.dev",
  "api_key": "tiber_sk_...",
  "default_mode": "dynasty",
  "default_season": 2025
}
```

---

## Available Tools

### 1. Search Player
Find a player's GSIS ID (required for other tools).

```bash
./tools/search-player.sh "Ja'Marr Chase"
```

Returns: `gsis_id`, `full_name`, `position`, `nfl_team`

---

### 2. FORGE Player Score
Full FORGE breakdown for a single player.

```bash
./tools/forge-player.sh <gsis_id> [mode: redraft|dynasty|bestball]
```

Returns: `alpha`, `tier`, `pillar scores` (Volume/Efficiency/TeamContext/Stability), `football_lens_flags`, `sos_multiplier`, `trajectory`

**Always search first to get the GSIS ID, then call forge-player.**

---

### 3. FORGE Batch Rankings
Ranked list for a full position group.

```bash
./tools/forge-batch.sh <position: QB|RB|WR|TE> [mode] [limit]
```

Returns: Ranked players with Alpha scores and tiers.

---

### 4. FIRE Player Data (QBs)
QB FIRE — Expected Fantasy Points model.

```bash
./tools/fire-player.sh <gsis_id>
```

Returns: `xfp`, `actual_fpts`, `fire_delta`, `opportunity_role`, `signal`

---

### 5. Data Lab Metrics
Raw analytics metrics (117 fields per player).

```bash
./tools/data-lab.sh <position> [week] [season]
```

Returns: Full Data Lab aggregation — snap share, target share, EPA, YPRR, TPRR, route metrics, etc.

---

## How to Use This Skill

### Typical flow for a player evaluation:

```
1. search-player.sh "<name>"          → get gsis_id
2. forge-player.sh <gsis_id> [mode]   → get FORGE breakdown
3. (if QB) fire-player.sh <gsis_id>   → get FIRE data
4. Reason over the returned data      → give grounded answer
```

### Output format when presenting FORGE data:

```
[LIVE TIBER — {timestamp}]
{Name} — Alpha {alpha} | {tier_label} | {mode} mode

Pillars:
  Volume:       {score}
  Efficiency:   {score}
  Team Context: {score}
  Stability:    {score}

SoS Multiplier: {sos_multiplier}
Flags: {football_lens_flags or "None"}

Analysis: [grounded in actual returned scores — explain what's driving the alpha,
           which pillars stand out, what it means for the user's context]
```

---

## Tier Reference

| Tier | Label    | Alpha Range |
|------|----------|-------------|
| T1   | Elite    | 85–100      |
| T2   | Strong   | 70–84       |
| T3   | Startable| 55–69       |
| T4   | Fringe   | 40–54       |
| T5   | Bust     | 0–39        |

---

## Pillar Weights by Position (Redraft)

| Position | Volume | Efficiency | Team Context | Stability |
|----------|--------|------------|--------------|-----------|
| RB       | 0.62   | 0.22       | 0.10         | 0.06      |
| WR       | 0.48   | 0.15       | 0.15         | 0.22      |
| TE       | 0.62   | 0.18       | 0.10         | 0.10      |
| QB       | 0.28   | 0.32       | 0.28         | 0.12      |

Key insight: Volume dominates for RB/TE. Stability matters more for WR than intuition suggests. QB is the only position where efficiency outweighs volume.

---

## Data Sources Behind TIBER

- **NFLfastR** — play-by-play, snap counts (primary)
- **NFL-Data-Py** — weekly stats, depth charts
- **Sleeper API** — projections, ADP
- **MySportsFeeds** — injuries

---

## Fail States

| Situation | What to Say |
|-----------|-------------|
| API unreachable | "TIBER API is currently unavailable. I can discuss methodology but can't pull live scores." |
| Player not found | "No TIBER record found for [name]. Try a different spelling or check if they're a skill position player (QB/RB/WR/TE)." |
| Empty data returned | "TIBER returned no data for this player/week. The data may not be ingested yet for this period." |
| Auth error | "API key error — check config.json has a valid tiber_sk_ key." |

Never fill in missing data with estimates.
