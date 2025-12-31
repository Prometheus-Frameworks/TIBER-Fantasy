# League Ownership Feature - Database & Implementation Notes

**Last Updated:** 2024-12-31

## Overview

The League Ownership feature allows users to see roster ownership status (on my roster, owned by other, free agent) when viewing player pages. This requires connecting a Sleeper league and syncing roster data.

## Current Database Tables

### Core League Tables

#### `leagues`
Primary table for user-created league contexts.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary key |
| user_id | text | Owner user ID |
| league_name | text | Display name |
| platform | text | 'sleeper', 'espn', 'yahoo', 'manual' (default: sleeper) |
| league_id_external | text | External platform league ID (for API sync) |
| settings | jsonb | League settings (roster spots, scoring, etc.) |
| season | integer | NFL season year |
| scoring_format | text | Scoring format |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update |

#### `league_teams`
Teams/rosters within a league.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary key |
| league_id | varchar | FK to leagues.id (cascade delete) |
| external_user_id | text | Sleeper user ID for this roster |
| external_roster_id | text | Sleeper roster ID |
| display_name | text | Team display name |
| is_commissioner | boolean | Is league commissioner |
| avatar | text | Avatar URL |
| **players** | **jsonb** | **Array of player IDs on this roster** |
| **starters** | **jsonb** | **Array of starter player IDs** |
| wins/losses/ties | integer | Record |
| roster_settings | jsonb | Roster slot config |
| roster_metadata | jsonb | Additional roster info |
| last_synced_at | timestamp | Last sync time |

#### `user_league_preferences`
Tracks which league/team is currently active for a user.

| Column | Type | Description |
|--------|------|-------------|
| user_id | text | Primary key |
| active_league_id | varchar | FK to leagues.id (set null on delete) |
| active_team_id | varchar | FK to league_teams.id (set null on delete) |
| updated_at | timestamp | Last update |

#### `user_platform_profiles`
Links users to their platform accounts (Sleeper, ESPN, etc.)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | text | Internal user ID |
| platform | text | 'sleeper', 'espn', etc. |
| external_user_id | text | Platform-specific user ID |
| username | text | Platform username |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update |

### Ownership Data Tables

#### `sleeper_ownership`
Platform-wide ownership percentages (not user-specific).

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| player_id | text | Player identifier |
| season | integer | NFL season |
| week | integer | NFL week (nullable for season-long) |
| ownership_percentage | real | 0-100 percentage |
| roster_count | integer | Number of rosters with player |
| total_leagues | integer | Total leagues sampled |
| last_updated | timestamp | Last sync time |

#### `league_context`
Vector-searchable league-specific information (trades, roster moves, notes).

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| league_id | varchar | FK to leagues.id |
| content | text | Searchable text content |
| embedding | vector | Vector embedding for RAG |
| metadata | jsonb | Structured data (type, playerName, tags, etc.) |
| created_at | timestamp | Creation time |

**Metadata types:** `trade`, `roster_move`, `waiver`, `note`, `roster`

## Current Implementation Status

### What Exists
1. **Schema tables** are defined in `shared/schema.ts`
2. **Basic routes** exist for:
   - `/api/league/ownership` - Check player ownership status
   - Sleeper sync routes at `/api/sleeper/*`

### What's Missing for Full Functionality
1. **Roster sync** - Need to populate `league_teams.players` from Sleeper API
2. **Player ID mapping** - Match Sleeper player IDs to our canonical IDs
3. **Cache strategy** - Currently using 15-min TTL for ownership lookups

## Implementation Approach

### Option A: Database-Cached Rosters (Preferred for Performance)
1. Sync rosters on league connection
2. Store player arrays in `league_teams.players`
3. Background refresh every 15-30 minutes
4. Lookup is a simple DB query

### Option B: Real-Time Sleeper API (Current Fallback)
1. Call Sleeper API on each ownership check
2. 15-minute cache TTL per player/league
3. Higher latency, but always fresh

### Recommended Flow
```
1. User connects Sleeper league → Create `leagues` + `league_teams` rows
2. Sync rosters → Populate `league_teams.players` with Sleeper IDs
3. Map IDs → Cross-reference with `player_identity_map.sleeper_id`
4. On ownership check:
   a. Get active league from `user_league_preferences`
   b. Get all teams from `league_teams` for that league
   c. Search `players` arrays for the canonical player ID
   d. Return status: on_my_roster | owned_by_other | free_agent
```

## API Contract

### GET /api/league/ownership

**Query Params:**
- `playerId` (required): Canonical player ID
- `user_id` (optional): User ID (defaults to 'default_user')

**Response when disabled:**
```json
{
  "success": true,
  "enabled": false,
  "reason": "No active league selected. Connect a Sleeper league to see ownership."
}
```

**Response when enabled:**
```json
{
  "success": true,
  "enabled": true,
  "data": {
    "playerId": "jamarr-chase",
    "status": "on_my_roster" | "owned_by_other" | "free_agent",
    "ownerTeamName": "Team Name" // only if owned_by_other
  }
}
```

## Storage Interface Methods

From `server/storage.ts`:

```typescript
getUserLeagueContext(userId: string): Promise<{
  activeLeague: League | null;
  activeTeam: LeagueTeam | null;
  allLeagues: League[];
} | null>

getUserPlatformProfile(userId: string, platform: string): Promise<UserPlatformProfile | null>
```

## Related Files

- `shared/schema.ts` - Table definitions
- `server/routes.ts` - API endpoints (lines ~3025-3070)
- `server/modules/metricMatrix/leagueOwnershipService.ts` - Ownership logic
- `server/storage.ts` - Database interface
- `client/src/pages/PlayerPage.tsx` - UI consumption

## Notes

- The `league_teams.players` column stores Sleeper player IDs (not canonical IDs)
- Need to join with `player_identity_map` to resolve canonical IDs
- Consider adding `canonical_player_ids` computed column for faster lookups
- UI shows "Connect a league for ownership" hint when no league is connected
