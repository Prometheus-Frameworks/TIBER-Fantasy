# Nineteen-player historical consumer activation


## 2026-09-13 — Separate nineteen-player historical promotion

The current operator grant approves the nineteen-player historical promotion receipt and matching consumer activation implementation, tests, paired PRs and independent review. It explicitly withholds merge and any deployment. Data PR #272 publishes `team_roster_identity_promotion_v1.json` at producer commit `f12234d909adc82e79ca463e76b994c8dd24bdb9`, receipt SHA-256 `215d2b47edb204a138d30725b4e2e3974993f105271667d665c651b825408c85`.

The consumer now validates and embeds that separate receipt, with no edits to the earlier preparation receipts. Its exact whole-bundle pin admits the nineteen historical profiles; runtime flags, stage strings, current roster notes, missing flags or PR merges cannot grant admission. Missing or modified artifact bytes fail closed. All 94 profile objects—including the original 75—and original source limitations, attribution, unknown clocks, historical teams, confidence and unavailable forecasts remain identical. Antonio Williams / 13301 remains unavailable. Historical figures are descriptive 2025 observations, never current-season projections or regression predictions.

The prepared code changes runtime policy only in this proposed revision. Current production still withholds the nineteen until a separately authorized release. This section supersedes the previous unconditional preparation-only gate for the proposed revision; it does not retroactively expand earlier authorizations. No new source acquisition, terms assessment, lineup or ownership inference, transaction, merge or deployment occurred.

Validation: 17 Python tests pass normally and under `-O`; 63 tests pass across seven Jest suites; full build passes. Typecheck retains exactly the baseline 506 diagnostics with no added per-file/error-code counts. Deterministic replay and full equality of all 94 prior historical profile objects are verified. Independent review is recorded separately.

Publication boundary: Fantasy draft PRs previously triggered automatic Railway previews. The consumer PR must not be opened until deployment suppression is verified or the operator separately authorizes that infrastructure change. Draft status alone is insufficient. Do not merge or deploy these activation changes.
