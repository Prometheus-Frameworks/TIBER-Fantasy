# /tiber:league-sync

Sync a Sleeper fantasy league to personalize all TIBER analysis.

## Usage
```
/tiber:league-sync <sleeper_league_id> [--roster <owner_name>]
```

## CRITICAL — No Fabrication Rule
**Never fabricate roster data, player IDs, or league settings.**
If the API call fails:
> "Could not sync Sleeper league {id}. Check the league ID and try again."

## How to Execute This Command

### Step 1 — Load config
Read `plugin-config.json` from the tiber-cowork-plugin folder.

### Step 2 — Validate and fetch league data
Call the Sleeper public API directly (no auth required for public leagues):
```
GET https://api.sleeper.app/v1/league/{sleeper_league_id}
GET https://api.sleeper.app/v1/league/{sleeper_league_id}/rosters
GET https://api.sleeper.app/v1/league/{sleeper_league_id}/users
```

### Step 3 — Match Sleeper players to TIBER identity

For each player_id on the target roster, resolve via TIBER:
```
GET {api_base_url}/api/v1/players/search?name={player_name}
Header: x-tiber-key: {api_key}
```

### Step 4 — Pull FORGE scores for the full roster
```
GET {api_base_url}/api/v1/forge/player/{gsis_id}?mode=dynasty
Header: x-tiber-key: {api_key}
```
Run for each skill position player on the roster (QB, RB, WR, TE).

## Output Format

```
[TIBER LEAGUE SYNC — {league_name} — {timestamp}]

League: {name} | Format: {scoring} | Teams: {count}
Your roster: {owner_name}

ROSTER OVERVIEW (FORGE Alpha — dynasty)
QB: {name} α{score} {tier}
RB: {name} α{score} {tier} | {name} α{score} {tier} | ...
WR: {name} α{score} {tier} | ...
TE: {name} α{score} {tier}

Roster Score: {average Alpha} — {tier_label} overall
Strengths: {positions with T1/T2 concentration}
Weaknesses: {positions thin or T4/T5 heavy}

Synced. Subsequent commands will reference this roster for personalized analysis.
```

## After Sync

Once synced, all commands become roster-aware in this session:
- `/tiber:player-eval` will note if the player is on your roster or a rival's
- `/tiber:start-sit` will rank your actual roster options
- `/tiber:buy-sell` will flag targets that fill your gaps

Note: Sync is session-scoped. Re-run at the start of each session to refresh.
