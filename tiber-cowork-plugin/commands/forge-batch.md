# /tiber:forge-batch

Run FORGE scoring across a position group and return tiered rankings from live data.

## Usage
```
/tiber:forge-batch <position> [--mode redraft|dynasty|bestball] [--top <number>]
```

## CRITICAL — No Fabrication Rule
**Never estimate Alpha scores or tier placements without a live API response.**
If the API call fails, say:
> "Could not retrieve live FORGE data. Batch rankings require an active API connection."

## How to Execute This Command

### Step 1 — Load config
Read `plugin-config.json` from the tiber-cowork-plugin folder.

### Step 2 — Call the batch endpoint
```
POST {api_base_url}/api/v1/forge/batch
Header: x-tiber-key: {api_key}
Header: Content-Type: application/json
Body: { "position": "{position}", "mode": "{mode}" }
```

Valid positions: QB, RB, WR, TE  
Valid modes: redraft, dynasty, bestball (default: redraft)

### Step 3 — Format results

Group players by tier. Show top N (default 30, use --top to override).

## Output Format

```
[LIVE TIBER BATCH — {position} {mode} — {timestamp}]

T1 ELITE (Alpha 85+)
  1. {name}    α{score}  Vol:{v} Eff:{e} Ctx:{c} Stb:{s}  {trend}
  2. {name}    α{score}  ...

T2 STRONG (Alpha 70–84)
  ...

T3 SOLID (Alpha 55–69)
  ...

MOVERS: {players with significant week-over-week Alpha change}
FLAGS: {any Football Lens warnings present in the data}
```

## Notes

- Tier thresholds are position-specific (from forge-engine skill)
- Show trajectory arrows: ↑ rising, ↓ falling, ↔ stable
- Only show tiers that have players in them
- If a player has a Football Lens flag in the API response, mark them with ⚠
