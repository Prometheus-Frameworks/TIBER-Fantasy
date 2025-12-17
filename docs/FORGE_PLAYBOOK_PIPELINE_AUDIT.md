# FORGE ↔ My Playbook Pipeline Audit

## End-to-end chain
- **League sync inputs**: `/api/league-sync/sleeper` (alias `/api/league-sync/sync`) accepts `league_id_external`/`sleeper_league_id` and `user_id`. Sleeper league + rosters + users are fetched via `sleeperClient` and stored through `upsertLeagueWithTeams` (`leagues`, `league_teams` tables) alongside derived scoring + season metadata. Suggested team context is derived from `user_platform_profiles` when available.
- **Context retrieval**: `/api/league-context` reads `user_league_preferences` to return the active league/team and re-suggests the team based on `user_platform_profiles` + `league_teams` mappings.
- **Dashboard / Playbook surface**: `/api/league-dashboard` powers the My Playbook roster + FORGE scoring display. Requests take `league_id`, optional `week`/`season`, and a `refresh` flag.
- **Computation service**: `computeLeagueDashboard` (`server/services/leagueDashboardService.ts`) loads Sleeper rosters, resolves roster positions, maps Sleeper player IDs via `player_identity_map`, and pulls FORGE alpha from `forge_player_state`. A cached snapshot lives in `league_dashboard_snapshots` (30m TTL) unless `refresh` bypasses it.

## Data joins and identifiers
- **League → teams**: `league_id_external` (stringified Sleeper league ID) joins to Sleeper rosters/users. Team rows keep `external_user_id` and `external_roster_id` for roster matching.
- **Rosters → identities**: Sleeper roster `player_id` strings are matched against `player_identity_map.sleeper_id`. Missing rows fall back to a synthetic `canonicalId` of `sleeper:<id>` with position defaulted to `FLEX`.
- **Identities → FORGE**: Resolved `canonicalId` values are queried in `forge_player_state` (filtered by `season` when provided/available). Latest rows are taken by `season`, `week`, and `computed_at` ordering; alpha is `alpha_final` or `alpha_raw`.
- **Results → UI**: Each rostered player is returned with `alpha` (FORGE score) or `null` when missing. Lineup totals use `alpha ?? 0`, so missing scores surface as zeros in the Playbook view.

## Default and fallback behaviors that yield 0 scores
- **Unmapped Sleeper IDs**: No `player_identity_map` row → `canonicalId` becomes `sleeper:<id>` and `alpha` is `null`.
- **Season/week filters**: When a `season` is supplied (or inferred from the league), FORGE rows outside that season are ignored; absent rows give `alpha = null`. Week is only filtered when explicitly provided.
- **Null alpha values**: Rows with no `alpha_final`/`alpha_raw` propagate as `null`.
- **Roster positions**: Missing roster settings fall back to `['QB','RB','RB','WR','WR','TE','FLEX']` which does not change scoring, but the lineup builder counts `alpha ?? 0`, so any missing alpha still registers as zero in totals.
- **Caching**: A cached `league_dashboard_snapshots` payload may retain prior zero/`null` alpha values until refreshed or the TTL expires.

## Endpoints feeding My Playbook
- **League sync & context**: `/api/league-sync/sleeper`, `/api/league-sync/leagues`, `/api/league-context` manage league/team selection for Playbook.
- **FORGE-backed roster view**: `/api/league-dashboard` (primary UI data) and `/api/league-dashboard/forge-sanity` (diagnostic-only) expose the merged roster + FORGE scores.

## Diagnostics and visibility
- **Correlation IDs**: `DEBUG_PLAYBOOK_FORGE=1` enables per-request `requestId` creation + logging in league sync and dashboard routes/services. The ID is echoed in response headers (`x-playbook-request-id`) and bodies for sync/sanity endpoints.
- **Step logging**: When debug is on, logs emit roster counts + sample player IDs, identity join counts, FORGE row counts, merge/fallback totals, and categorized missing-score reasons (`unmapped_sleeper_id`, `missing_forge_row`, `alpha_null`).
- **Sanity endpoint**: `/api/league-dashboard/forge-sanity` (debug-only) returns counts and a 10-player sample of `roster_player_id` vs. `forge_player_id`, including match flags and reasons for missing scores. Use to quickly spot ID mismatches or absent FORGE rows.
