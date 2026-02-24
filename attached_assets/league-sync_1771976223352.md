# /tiber:league-sync

Connect and sync a Sleeper fantasy league to personalize all TIBER analysis.

## Usage
```
/tiber:league-sync <sleeper_league_id> [--roster <owner_name>]
```

## What This Does

1. Validate the Sleeper league ID via `GET /api/sleeper/validate/:league_id`
2. Fetch league settings (scoring format, roster size, team count)
3. Display all rosters with owner names and W-L records
4. Sync the selected roster: current players, recent trades, waiver pickups
5. Store league context for personalized recommendations going forward

## After Sync

Once a league is synced, all other TIBER commands become roster-aware:
- `/tiber:player-eval` will note if the player is on your roster or a rival's
- `/tiber:start-sit` can rank your actual roster options
- `/tiber:buy-sell` will prioritize targets that fill your roster gaps
- Trade evaluations will factor in your team composition

## Sleeper API Details

- Public endpoints (no auth): league info, rosters, matchups, transactions
- Player metadata: name, position, team, age, status
- League ID is the numeric string from the Sleeper app URL

## Data Stored

- League settings (PPR/half/standard, roster slots, playoff weeks)
- Your roster with player IDs mapped to GSIS identity
- Recent transaction history (trades, waivers, drops)
- All embedded as vectors for semantic search in Tiber Chat

## Limitations

- Currently Sleeper only (ESPN, Yahoo adapters in backlog)
- Sync is point-in-time; re-run to update after trades/waivers
- Keeper/taxi squad data supported but may need manual verification
