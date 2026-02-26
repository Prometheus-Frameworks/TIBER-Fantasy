# /tiber:player-eval

Evaluate a player using live TIBER FORGE, FIRE, and CATALYST data.

## Usage
```
/tiber:player-eval <player_name> [--mode redraft|dynasty|bestball]
```

## CRITICAL — No Fabrication Rule
**Never estimate or guess Alpha scores, pillar values, or tier placements.**
If the API call fails or returns no data, say exactly:
> "No live TIBER data available for [player]. I can discuss the framework but cannot provide Alpha scores without a live API response."

## How to Execute This Command

### Step 1 — Load config
Read `plugin-config.json` from the tiber-cowork-plugin folder. Extract:
- `api_base_url` — the TIBER API base URL
- `api_key` — your personal TIBER key

### Step 2 — Resolve player identity
```
GET {api_base_url}/api/v1/players/search?name={player_name}
Header: x-tiber-key: {api_key}
```
Use the top result's `gsis_id`. If no match, tell the user and stop.

### Step 3 — Pull FORGE data
```
GET {api_base_url}/api/v1/forge/player/{gsis_id}?mode={mode}&position={position}
Header: x-tiber-key: {api_key}
```

### Step 4 — Pull FIRE data
```
GET {api_base_url}/api/v1/fire/player/{gsis_id}
Header: x-tiber-key: {api_key}
```

### Step 5 — Pull CATALYST data
```
GET {api_base_url}/api/v1/catalyst/player/{gsis_id}
Header: x-tiber-key: {api_key}
```

## Output Format

Use only data returned from the API. Do not fill in missing values with estimates.

```
[LIVE TIBER DATA — {timestamp}]
Alpha {alpha} — {tier_label} ({mode})

Pillar Breakdown
  Volume:       {volume_score}
  Efficiency:   {efficiency_score}
  Team Context: {team_context_score}
  Stability:    {stability_score}

FIRE Delta: {fire_delta} ({fire_signal})
CATALYST Alpha: {catalyst_alpha}

Flags: {football_lens_flags or "None active"}
Trajectory: {trend direction}

Analysis:
[Written evaluation grounded only in the actual scores returned.
Explain what each score means for this player specifically.
Flag any notably high or low pillar and why it matters for the ask.]

Recommendation: [Buy / Hold / Sell] — [reasoning tied to actual scores]
```

## Interpretation Guide

Use TIBER Tiers and pillar weights from the forge-engine skill as context for written analysis. Numbers come from the API — interpretation comes from domain knowledge. Default mode is `redraft` unless specified.
