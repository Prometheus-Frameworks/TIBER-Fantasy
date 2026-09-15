# Team Manager weekly results v0

## Authority and branch dependency
Joe approved the proposed smallest useful slice in this conversation: selected leagues, weekly matchup results, a combined head-to-head record, and links into Team. This implements that scoped request under the Team direction in #371. It does not activate the broader manager-profile roadmap.

Base: PR #375 at `1597b2d00ef93408eb7f65208092ae2886cd5ea5` (`codex/374-auth-v0-foundation`). This draft is stacked on that branch to reuse its public league-discovery service. #375 itself and #377 are unchanged. Main was observed at `30a70a3b` during checkout; this change is not a reconciliation of those branches and must not merge into main before the dependency is reconciled and reviewed.

## User experience
- Manager is a new view beside Team, available before loading an individual roster. Team remains mounted when switching views so existing page-local work survives; opening a roster uses its existing discard confirmation and fresh loader.
- Explicit public Sleeper username/user-ID lookup plus season; discover up to the existing 128-league bound. No automatic tracking: choose leagues with checkboxes, optionally filtering names/formats.
- Week selector starts at Week 1, offers 1–18, and requires explicit Refresh results. At most two league requests are in flight in the client. Selection/account/season/week changes clear prior results and invalidate delayed requests. One failed league does not erase another's result. No polling or scheduler.
- One roster per selected league contributes to the combined count. Multiple reported owner/co-owner memberships require an explicit roster choice; no automatic duplicate counting. Current membership selects a roster, not proof that this manager controlled it in a past week.
- Cards show source roster numbers, opponent, actual score or missing state, commissioner-override disclosure, provisional W/L/T or pending/unavailable, receive time, and Open Team. Human-friendly team/opponent names, exact standings, saved selection, full-season totals and historical snapshots are later slices.
- Public account input is independent of private auth/link state. Nothing is persisted, authenticated, attached to existing agent packets or written to Sleeper. The screen explicitly discloses page-memory-only selection.

## Result policy and source limitations
`GET /api/draft-review/manager-week?userId=…&leagueId=…&season=…&week=…` is strict, bounded, rate-limited, no-store and additive. It uses the existing ten-second Sleeper transport. No new env variables, providers, dependencies, DB, background jobs or source artifacts.

Validate exact league/season, complete unique roster list, owner/co-owner membership and complete unique weekly matchup roster coverage. Require an ordinary two-roster pairing and known regular-season/non-best-ball settings. Byes, unknown formats and playoffs remain explicitly unsupported. Scores must be finite numbers; missing values are not zero. `custom_points`, including zero, supersedes reported points when provided. Negative points remain valid.

Only a strictly later Sleeper regular-season leg **in the same season** admits a provisional score-derived W/L/T. A current/future leg, missing state, different season or non-regular state remains pending. This intentionally conservative first slice does not settle the current week just because Monday's game ended and does not backfill prior seasons. Sleeper's documented matchup response has no finality flag: every result has `finality: not_verified`. Stat corrections and commissioner changes may change results on refresh. A later leg is not claimed to prove finality or an atomic league snapshot.

The aggregate is head-to-head only. League-median games are excluded. Missing, unsupported, unselected-multiple-membership and failed results do not become losses. No points are summed across scoring formats. Standings/tiebreaker rules are not approximated.

Sources inspected: https://docs.sleeper.com/#getting-matchups-in-a-league and https://docs.sleeper.com/#get-nfl-state . New raw methods return unknown to the validated manager compiler. Existing public roster/evidence/TE/league and private-auth responses remain unchanged.

## Validation
- 69 tests pass across six suites: manager compiler/HTTP (24), manager UI (6), existing Team, league switcher, Draft Review routes and public-profile containment. Tests use synthetic identities only.
- Cases include late week/account responses, failed refresh clearing old wins, partial league failure, explicit multiple-membership selection, scope mismatch, incomplete/duplicate IDs, null scores, zero commissioner override, negative scores, corrected W/L/T, unsupported pairing/settings and state failures.
- Full `sh build.sh` passes. Baseline and candidate each have 506 TypeScript diagnostics with identical per-file/error-code counts; no added/touched-file errors. Repository-wide typecheck is not clean.
- Built public runtime HTTP checks: `/team` and `/draft-review` 200; invalid manager week 400; auth and legacy APIs 404. Live read-only discovery returned 24 leagues. One selected live league returned 200/no-store and actual scores with pending result because Sleeper still reported regular-season leg 1. No personal source fixtures are committed.
- `git diff --check` passes. No independent review or rendered portrait-phone acceptance is claimed.
- Read-only Railway project UI inspection shows **Enable PR Environments**, establishing automatic PR environments are currently disabled. No Railway settings were changed and no preview/redeploy is requested.

## Next review and acceptance
Review this additive diff against the exact #375 dependency. Then use a separately authorized isolated public preview, verify the deployed head, and have Joe check at 390/430px: discover/select leagues, Week 1 results and missing states, change week/refresh without stale results, explicit multiple-roster choice where applicable, and Open Team/back without losing selections. Reconcile dependency/main before a later merge decision. Private authentication, persisted profile, standings, season totals, native app, transactions and production release remain outside this slice.
