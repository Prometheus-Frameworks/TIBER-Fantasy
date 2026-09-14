# Weekly box-score consumer preparation v0

Producer: TIBER-Data, `weekly_boxscore_publication_candidate_v0` from candidate revisions under `exports/candidates/weekly_boxscore/revisions`.

Status: local preparation only. Joe authorized this next slice on 2026-09-14. No runtime evidence is admitted. No environment flag can activate it.

`weeklyEvidenceFor(season, week)` always returns unavailable. The additive read-only endpoint `/api/draft-review/weekly?season=2026&week=1` requires explicit REG scope, applies existing public rate limiting and no-store headers, and uses no DB/network/artifact read. Existing Team/history responses are unchanged. No UI is enabled.

`inspectWeeklyCandidate` is an offline review adapter, not runtime admission. It checks an operator-supplied integrity hash, bounded bytes/rows, version/scope, duplicate player game keys, numeric constraints, opportunity sums and share ratios. It returns `preview_not_admitted`; hash agreement does not authorize source use. It preserves game-team/position from weekly source observations, separate schedule provenance, source clocks, source/build hashes and limitations. Raw display strings remain untrusted data. No name join, current-team rewrite or Sleeper identity expansion occurs.

Only QB/RB/WR/TE source observations are displayed. Missing source players cannot be manufactured as zero rows. Missing required scoring inputs yield unknown points. Air yards are excluded; route participation, snap share, first reads, inside-five work, injury/game-script context and QB rushing splits remain unavailable.

## Exploratory downstream policy

`target_involvement_full_ppr_v0` uses WR target share >=20% for strong, <15% for low; TE >=15%/<10%; RB carries+targets >=15/<=8. WR/TE axis means target involvement, not full-time role. Carries and targets remain separate in observations; target shares carry numerator and credited-team-target denominator. All-team carry share is not RB-only backfield share.

Generic full PPR is 1/reception + 0.1/rushing or receiving yard + 6/rushing or receiving TD - 2/lost fumble. No bonuses, TE premium or two-point conversions. High scoring >=15 RB/WR, >=12 TE; low <8 RB/WR, <6 TE. Middle/unknown cases retain their holding category. QBs receive a separate view with four-point passing TDs, .04/passing yard and -2/interception; receiver bucket thresholds never apply. TD points are shown separately. These are descriptions, not validated predictive rules or rebound probabilities.

## Local review

`node --import tsx scripts/inspectWeeklyBoxscoreCandidate.ts INPUT SHA256 SEASON WEEK OUTPUT`

This writes an exclusive local preview file, not a tracked runtime bundle. Real-source integration and historical replay are recorded in `docs/audits/weekly-consumer-preparation-2026-09-14.md`. Synthetic tests exercise exact thresholds, zero/null differences, fumbles/TDs, provenance, tampering, mixed categories and QB separation. Public-route/profile tests check scope, no-store and inactive behavior.

Activation still requires separate reviewed source admission and exact artifact pins in code; never accept arbitrary request/env hashes as authority. Scheduling, leaders UI, roster matching and deployment are outside this slice. No routes are proxied to legacy ETL, estimated-route paths or mock fallbacks.
