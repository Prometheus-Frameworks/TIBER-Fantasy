# Manager player exposure v0

Joe authorized implementation and an isolated preview in the Manager conversation after observing his Week 1 record. This separate branch stacks on PR #387 at `354cfe2b7264ff49167daa3cd50229aba1e273d7`; it does not change that reviewed branch or resolve #375's main dependency. No merge or production release is authorized.

## User experience
Manager has Results and Players views sharing explicit account/season and league selection. Players are read only on Refresh players, independently of selected matchup week. Sort by league count; search name/source ID/position/NFL team; expand to inspect league format, current starter/bench/reserve/taxi placement and Open Team. No selection or record is saved beyond this page. The existing Team open/discard path and retained Manager state are reused.

Percent = distinct loaded selected leagues containing a player / loaded selected leagues. A valid empty roster contributes to the denominator. Missing/invalid roster contents, no current membership, failed reads and unchosen multiple memberships are excluded and disclosed. Current ownership/co-ownership is a public source observation, not authentication or historical control. Changing selection/account/season remounts and aborts the exposure request batch; refresh clears old results. No hidden polling. Two concurrent requests with the existing abortable 30-start/61-second budget helper on a separate route budget, including bounded 429 handling.

## Sources and limits
Additive strict/no-store/rate-limited GET `/api/draft-review/manager-players?userId=…&leagueId=…&season=…`. Validates exact NFL league/season, complete unique roster membership coverage and bounded source IDs. Selected roster membership unions players/reserve/taxi with distinct IDs; starter slots ignore source empty marker 0. Malformed contents stay unavailable. Unknown starter membership gives unknown lineup placement. All source roster entities are retained; no ranking or canonical identity promotion is performed.

Source names, position, NFL team and injury_status are optional read-only Sleeper directory observations. Missing or mismatched directory IDs retain source-ID exposure without fabricated metadata. A shared in-memory five-minute single-flight directory cache avoids one full download per league; expired reads never silently fall back to old data after failure. Directory failures do not erase valid roster membership. Roster and directory receive clocks are distinct; source update time is unavailable. No designation reported is not a health clearance, a diagnosis, a game-event claim, an injury alert delivery system, or an inference about start/sit. Refresh within five minutes can reuse that transparently dated directory snapshot. Across a paced batch, latest available metadata is selected per player.

No new dependency, DB, auth, provider secret, promoted artifact, transaction, background job or saved profile. Existing public runtime source-ID and dark Team UI conventions apply, not legacy DB-identity/light-shell conventions.

## Phone corrections from operator feedback
The week select explicitly specifies dark colors including WebKit text fill, fixing white-on-white native controls. Unrequested weekly results are labelled not loaded, separately from source-backed pending.

## Validation and acceptance
42 tests in five exposure/compiler/UI/Manager/routes/public-containment suites pass. Coverage includes partial denominator, empty rosters, multiple membership selection, source mismatch, reserve/taxi union, malformed contents, directory failure/cache expiry, stale-response cancellation and Open Team link. Full build passes. See PR for typecheck/live smoke receipts.

Preview acceptance: choose at least two leagues; Players → Refresh players; search a heavily owned player; expand and check league format and lineup placement; Open Team/back retains results; compare Results/Players without cross-contamination; change account/selection without stale rows; verify native select contrast on portrait phone. No operator phone acceptance or independent clean review is claimed yet.

Validation receipt: typecheck retains exactly 506 baseline diagnostics by file/code, with no added diagnostics. Built public HTTP smoke: /team 200, exposure for one live selected league 200/no-store with 16 roster entities and a dated directory observation, private auth 404. No personal source fixtures committed.
