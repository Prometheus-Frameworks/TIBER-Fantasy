# /tiber:start-sit

Get start/sit recommendations using live FORGE scores and SoS matchup data.

## Usage
```
/tiber:start-sit [--week <number>] [--position QB|RB|WR|TE] [--roster "player1, player2, ..."]
```

## CRITICAL — No Fabrication Rule
**Never fabricate matchup grades or Alpha scores.**
If data is missing for a player:
> "[Player] not found in live TIBER data. Cannot make a data-backed recommendation."

## How to Execute This Command

### Step 1 — Load config
Read `plugin-config.json` from the tiber-cowork-plugin folder.

### Step 2 — Resolve each player on the roster
For each player in `--roster`, call:
```
GET {api_base_url}/api/v1/players/search?name={player_name}
Header: x-tiber-key: {api_key}
```

### Step 3 — Pull FORGE + FIRE data for each player
```
GET {api_base_url}/api/v1/forge/player/{gsis_id}
GET {api_base_url}/api/v1/fire/player/{gsis_id}
Header: x-tiber-key: {api_key}
```

### Step 4 — Rank and recommend

Rank players using:
1. FORGE Alpha (primary signal)
2. FIRE delta (opportunity vs actuals gap)
3. SoS / matchup context if available in the response

## Output Format

```
[LIVE TIBER START/SIT — Week {week} — {timestamp}]

START: {name} (α{score}, {tier})
  FIRE Delta: {delta}
  Matchup: {opponent} — {matchup context if available}
  Reasoning: [tied to actual scores from API]

SIT: {name} (α{score}, {tier})
  FIRE Delta: {delta}
  Matchup: {opponent}
  Reasoning: [tied to actual scores]

[If the call is close, say so. "This is nearly a coin flip — here's why..."]
```

## Without --roster

Return the best and worst starts for the specified position based on live FORGE batch data. Pull batch, sort by Alpha, show top 5 starts and bottom 3 fades with actual scores.
