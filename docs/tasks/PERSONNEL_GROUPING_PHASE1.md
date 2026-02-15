# CODEX TASK — Personnel Grouping Intelligence (Phase 1 + Phase 2 backend MVP)

## Goal
Add NFL personnel grouping visibility to Tiber by ingesting nflfastR personnel fields into bronze and building a backend aggregation service that produces per-player personnel usage profiles (v1: usage-based, not true snap share).

We need to answer: "What % of a player's *usage* occurs in 11 vs 12 vs 13 personnel?" and classify role dependency (FULL-TIME / 11-ONLY / HEAVY-ONLY / ROTATIONAL).

## Non-goals (important)
- Do NOT claim "snap share" unless we have a participation dataset. For v1, label everything as "plays" or "usage plays".
- Do NOT refactor unrelated ETL/Forge systems.
- Do NOT break existing ingestion/backfill jobs.
- Do NOT write raw SQL migration files. Schema changes go through Drizzle ORM only.

## Read first
- `server/modules/forge/MODULE.md`
- `server/etl/MODULE.md`
- `ARCHITECTURE.md` (for project-wide orientation)

## Current state
- Bronze table: `bronze_nflfastr_plays` contains pbp plays + raw_data JSON (~200 fields), but personnel fields were not captured in our ingestion.
- Ingestion file: `server/ingest/nflfastr.ts`
- Weekly pipeline: `server/etl/CoreWeekIngest.ts`
- Schema: `shared/schema.ts` (bronze plays definition, search for `bronzeNflfastrPlays`)
- Player identity: `player_identity_map` table maps GSIS IDs to canonical player info (display name, position, team)

## Deliverables

### D1 — Bronze schema + ingestion
1. Add the following columns to `bronzeNflfastrPlays` in `shared/schema.ts`:
   - `offense_personnel` (text, nullable)
   - `defense_personnel` (text, nullable)
   - `offense_formation` (text, nullable)
2. Run `npm run db:push` to apply the schema change. If there is a data-loss warning, use `npm run db:push --force`. Do NOT write raw SQL migration files.
3. Update `server/ingest/nflfastr.ts` so these fields are pulled from the nflfastR parquet source and written into bronze for new ingests.
   - **Important**: Before building the backfill, verify that the parquet source we download actually contains `offense_personnel`. If it does not, check the nflverse pbp parquet documentation (https://github.com/nflverse/nflverse-data/releases) for the correct source file that includes personnel data.
4. Create a backfill script at `server/scripts/backfillPersonnel.ts` for season=2024 (and optionally 2023 if the data source supports it) that re-ingests and populates these new fields for existing rows.
   - Include a usage comment block at the top of the script explaining how to run it.

### D2 — Personnel aggregation service (backend)
Create `server/modules/personnel/` with:

**`personnelService.ts`**:
- Input: season, optional weekStart/weekEnd range, optional team, optional playerId(s)
- Output: per-player summary (see Output Shape below)
- Personnel string parsing rules:
  - nflfastR format is typically `"1 RB, 1 TE, 3 WR"` but ordering varies (could be `"1 RB, 3 WR, 1 TE"`)
  - Extract ONLY the RB and TE counts from the string. Ignore OL, DL, and other position counts.
  - Map to two-digit personnel code: first digit = RB count, second digit = TE count (e.g., 1 RB + 1 TE = "11", 1 RB + 2 TE = "12", 2 RB + 1 TE = "21")
  - If parsing fails or string is null, classify as "other"
- **Play filtering**: Skip plays where `offense_personnel` is null OR where `play_type` is not a standard offensive play (include only `pass` and `run` play types). Exclude penalties, timeouts, special teams, kickoffs, punts.

**`personnelClassifier.ts`** — Role classification helper:
- FULL-TIME: meaningful usage (>=10%) in both 11 and 12 (and/or 13) personnel
- 11-ONLY: >=80% in 11 and <10% in 12+13 combined
- HEAVY-ONLY: >=50% in 12+13 combined and <30% in 11
- ROTATIONAL: everything else
- LOW-SAMPLE: total plays counted < min_total_plays threshold

Tunable constants (export so they can be adjusted later):
- `MIN_TOTAL_PLAYS = 50` (below this -> classify "LOW_SAMPLE")
- `MEANINGFUL_BUCKET_PCT = 0.10`
- `ELEVEN_ONLY_THRESHOLD = 0.80`
- `HEAVY_THRESHOLD = 0.50`

**`MODULE.md`**: Create a brief module manifest following the pattern in other MODULE.md files (see `server/modules/forge/MODULE.md` for format).

### D3 — API route
Add endpoint in a new route file `server/routes/personnelRoutes.ts`, mounted in `server/routes.ts`:

**GET `/api/personnel/profile`**

Query params:
- `season` (required, integer)
- `weekStart` (optional, integer)
- `weekEnd` (optional, integer)
- `playerId` (optional) — accepts GSIS player ID format (`00-XXXXXXX`) as used in `bronze_nflfastr_plays`. Cross-reference with `player_identity_map` to resolve display name and position for the response.
- `team` (optional, team abbreviation like "CIN")
- `position` (optional, filter by position: WR, RB, TE, QB)

Response:
- If `playerId` provided: single profile object
- Else: array of profiles (cap to top N by total_plays_counted, default 200) with optional filters applied

### D4 — Tests / sanity checks
Create a test script at `server/scripts/testPersonnelAggregation.ts`:
- Run aggregation for CIN, season 2024, full season
- Print top 10 players by total_plays_counted with their 11/12/13 split
- Verify Ja'Marr Chase appears with majority 11 personnel usage (expected: primarily 11 personnel as a 3-WR set player)
- Verify the service handles null personnel values without crashing
- Verify plays with non-offensive play_type are excluded

## Definition of "player usage" in v1
A "usage play" is a play where the player appears as:
- `receiver_player_id` OR `rusher_player_id` OR `passer_player_id`

This is NOT true on-field participation (snap data). Name all fields and documentation accordingly — use "plays" or "usage plays", never "snaps".

## Output shape (example)
```json
{
  "playerId": "00-0031234",
  "playerName": "Ja'Marr Chase",
  "position": "WR",
  "team": "CIN",
  "season": 2024,
  "weekStart": 1,
  "weekEnd": 18,
  "totalPlaysCounted": 420,
  "breakdown": {
    "11": { "count": 340, "pct": 0.81 },
    "12": { "count": 60, "pct": 0.14 },
    "10": { "count": 20, "pct": 0.05 },
    "13": { "count": 0, "pct": 0.0 },
    "21": { "count": 0, "pct": 0.0 },
    "22": { "count": 0, "pct": 0.0 },
    "other": { "count": 0, "pct": 0.0 }
  },
  "everyDownGrade": "FULL-TIME",
  "notes": ["usage-based v1; not snap participation"]
}
```

## Implementation guidance
- Schema changes: Add to `shared/schema.ts`, run `npm run db:push`. Use `--force` if data-loss warning.
- Routes: Create modular route file in `server/routes/`, mount in `server/routes.ts`.
- New modules: Create under `server/modules/[name]/` with a `MODULE.md`.
- Follow existing patterns — check neighboring files before writing new code.

## Done criteria
- `bronzeNflfastrPlays` schema includes the 3 new columns and `npm run db:push` applied cleanly.
- 2024 bronze rows have `offense_personnel` populated (spot-check: `SELECT offense_personnel, COUNT(*) FROM bronze_nflfastr_plays WHERE season=2024 AND offense_personnel IS NOT NULL GROUP BY offense_personnel ORDER BY count DESC LIMIT 10`).
- `GET /api/personnel/profile?season=2024&team=CIN` returns valid profiles with breakdown data.
- API handles null personnel gracefully and does not mislabel usage as snaps.
- Service is modular under `server/modules/personnel/` with a MODULE.md and is ready for FORGE consumption later.
- No existing ingestion, ETL, or FORGE functionality is broken.
