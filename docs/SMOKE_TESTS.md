# Smoke-Test Checklist – Sleeper League Sync v1

Use this lightweight checklist to verify Sleeper league sync, active league context, and Playbook wiring after deployments.

## API smoke tests
- [ ] `POST /api/league-sync/sleeper` with a real `sleeper_league_id` returns `success: true`, the created league row, and a `teams` array with roster + owner labels.
- [ ] `GET /api/league-sync/leagues?user_id=default_user` returns the synced leagues and each league has a non-null `teams` array.
- [ ] `POST /api/league-context` with `{ user_id, league_id, team_id }` persists without error and echoes the preference.
- [ ] `GET /api/league-context?user_id=default_user` resolves the active league/team and includes embedded teams on the active league.

## UI smoke tests (Admin / Command Hub)
- [ ] League selector in the header shows the active league from `/api/league-context` on initial load (no flashback to an older selection).
- [ ] League Context panel lists synced leagues and teams; changing the league updates the team dropdown without needing a refresh.
- [ ] Saving a new active league/team triggers a refreshed context and updates the Playbook pills (league, team, season, scoring).
- [ ] Creating a Playbook entry from this page includes `league_id`, `team_id`, `season`, and `scoring_format` tied to the active selection.
- [ ] Linking a Sleeper username shows `Linked: <username>` and subsequent league selections auto-suggest the matching team.
- [ ] Pasting a Sleeper League ID into "Sync" creates the league, refreshes the dropdowns, and pre-selects the detected team when possible.
- [ ] League Overview stacked bar chart renders with QB/RB/WR/TE colors and shows totals per team.
- [ ] Clicking a bar updates the roster drilldown table and highlights starters.

## Error handling
- [ ] Missing `sleeper_league_id` on the sync POST returns HTTP 400 with a clear message.
- [ ] Invalid league/team IDs on `POST /api/league-context` return HTTP 400 with a helpful error.
