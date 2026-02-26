# /tiber:buy-sell

Surface buy-low and sell-high candidates using live FORGE trajectory and FIRE delta data.

## Usage
```
/tiber:buy-sell [--position QB|RB|WR|TE] [--mode redraft|dynasty] [--limit <number>]
```

## CRITICAL — No Fabrication Rule
**Never estimate Alpha scores or assign tiers without live API data.**
If the API fails:
> "Buy/sell analysis requires live FORGE data. API connection unavailable."

## How to Execute This Command

### Step 1 — Load config
Read `plugin-config.json` from the tiber-cowork-plugin folder.

### Step 2 — Fetch batch data for the position
```
POST {api_base_url}/api/v1/forge/batch
Header: x-tiber-key: {api_key}
Body: { "position": "{position}", "mode": "{mode}" }
```

If no position specified, run for all four (QB, RB, WR, TE) sequentially.

### Step 3 — Identify candidates from the response

**Buy-Low signals** (look for players where these conditions are present in the data):
- Alpha is T2 or higher but has been declining recently (trajectory: falling)
- Significant FIRE delta gap (FORGE sees more opportunity than market)
- No Football Lens flags that explain the decline
- Dynasty mode: age under 27 with stable or rising efficiency

**Sell-High signals**:
- Alpha is inflated by recent TD spike (Football Lens flag present)
- Volume pillar declining while Efficiency pillar is carrying the score
- Trajectory has peaked and is now falling
- Dynasty mode: age 30+ with declining Stability pillar

## Output Format

```
[LIVE TIBER BUY/SELL — {position} {mode} — {timestamp}]

📈 BUY LOW
1. {name} (α{score}, {tier}) — {1-2 sentences explaining which pillars and signals drive the buy]
2. {name} ...

📉 SELL HIGH
1. {name} (α{score}, {tier}) — {1-2 sentences explaining which pillars and signals drive the sell}
2. {name} ...

Analysis grounded in live Alpha scores only. Limit: {limit} per side (default 3).
```

## Principles

- Tie every recommendation to a specific pillar score or flag from the API
- Buy/sell signals are research starting points, not trade orders
- Acknowledge when the data is mixed — "this is a hold, not a clear buy"
