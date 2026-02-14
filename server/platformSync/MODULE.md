# Platform Sync

Multi-platform fantasy sports data synchronization. Pulls rosters, leagues, transactions, and scores from ESPN, Yahoo, NFL.com, Sleeper, and MySportsFeeds into TIBER's unified data model.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | `PlatformSyncManager` class — orchestrates auth, full sync, incremental sync, webhooks |
| `adapters/sleeperAdapter.ts` | Sleeper API integration |
| `adapters/espnAdapter.ts` | ESPN API integration (uses SWID + espn_s2 cookies) |
| `adapters/yahooAdapter.ts` | Yahoo API integration (OAuth consumer key/secret) |
| `adapters/nflAdapter.ts` | NFL.com API integration |
| `adapters/mysportsfeedsAdapter.ts` | MySportsFeeds API integration (API key auth) |

## Sync Modes

| Mode | Method | Description |
|------|--------|-------------|
| Full sync | `syncUserData()` | Fetches all data: profile, leagues, teams, rosters, transactions, scores, settings |
| Incremental | `incrementalSync()` | Only fetches changes since last sync timestamp |
| Real-time | `setupRealTimeSync()` | Webhook-based (where platform supports it) |
| Force refresh | `forceRefresh()` | Clears sync timestamp, runs full sync |

## Data Model

Each adapter normalizes platform-specific data into shared interfaces:
- `UserProfile` — user info
- `LeagueData` — league settings, scoring, roster positions
- `TeamData` — record, points, rank
- `RosterData` — starters, bench, IR, taxi
- `TransactionData` — trades, waivers, free agent pickups
- `ScoreData` — weekly team/player scores

## Adding a New Platform

1. Create `adapters/newPlatformAdapter.ts`
2. Implement the adapter interface with these methods:
   - `authenticate(credentials)` → boolean
   - `fetchUserProfile(credentials)` → UserProfile
   - `fetchLeagues(credentials)` → LeagueData[]
   - `fetchTeams(credentials)` → TeamData[]
   - `fetchRosters(credentials)` → RosterData[]
   - `fetchTransactions(credentials)` → TransactionData[]
   - `fetchScores(credentials)` → ScoreData[]
   - `fetchSettings(credentials)` → PlatformSettings
   - Optional: `fetchChangesSince(credentials, since)`, `setupWebhook()`, `processWebhookData()`
3. Add platform to `PlatformCredentials.platform` union type in `index.ts`
4. Register adapter in `PlatformSyncManager` constructor
