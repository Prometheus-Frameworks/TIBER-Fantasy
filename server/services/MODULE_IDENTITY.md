# Player Identity System

Unified player resolution across fantasy platforms (Sleeper, ESPN, Yahoo, RotoWire, FantasyPros, MySportsFeeds, NFL-Data-Py). Canonical ID system with GSIS as primary NFL identifier. Used by nearly every module for cross-platform player matching.

## Files

| File | Purpose |
|------|---------|
| `server/services/PlayerIdentityService.ts` | Core singleton service. `getCanonicalId()`, `getByAnyId()`, `searchByName()` (fuzzy matching with confidence scoring), `addIdentityMapping()`, `createPlayerIdentity()`, `bulkImportPlayers()`, `getSystemStats()` |
| `server/services/PlayerIdentityMigration.ts` | Migration and enrichment of identity records from external sources |
| `server/services/identity/` | Additional identity sub-services |
| `server/routes/playerIdentityRoutes.ts` | API routes for identity lookup and management |

## ID System

```
canonical_id (primary key, e.g. "jamarr-chase")
    ├── gsis_id       (NFL identifier, format "00-XXXXXXX")
    ├── sleeper_id    (Sleeper platform)
    ├── espn_id       (ESPN platform)
    ├── yahoo_id      (Yahoo platform)
    ├── rotowire_id   (RotoWire)
    ├── fantasypros_id (FantasyPros)
    ├── mysportsfeeds_id (MySportsFeeds)
    └── nfl_data_py_id (nfl_data_py / nflfastR)
```

Resolution order: canonical_id → try each platform column until match found.

## DB Table

**`player_identity_map`** — Central identity table.

| Column | Description |
|--------|-------------|
| `canonical_id` | Primary key, human-readable slug |
| `gsis_id` | NFL Game Statistics & Information System ID |
| `full_name` | Display name |
| `first_name`, `last_name` | Name parts for fuzzy search |
| `position` | NFL position (QB, RB, WR, TE) |
| `nfl_team` | Current team abbreviation |
| `is_active` | Active roster status |
| `merged_into` | Points to canonical_id if this record was merged |
| `confidence` | Identity match confidence (0-1) |
| `last_verified` | Last verification timestamp |
| Platform ID columns | `sleeper_id`, `espn_id`, `yahoo_id`, etc. |

## Key Functions

- `getCanonicalId(externalId, platform)` — Resolve any platform ID to canonical
- `getByAnyId(id)` — Try all columns to find a player
- `searchByName(name, position?)` — Fuzzy search with confidence scoring
- `bulkImportPlayers(players[])` — Batch import from external source

## Used By

| Consumer | Usage |
|----------|-------|
| FORGE | Player context resolution, canonical ID lookups |
| DataDive | Maps weekly stats to canonical names/positions |
| OVR | Sleeper ID resolution for game log fetching |
| Prediction Engine | Player matching for ECR comparison |
| RAG Chat | Player name resolution in queries |
| Sleeper Sync | Platform ID mapping during roster sync |
