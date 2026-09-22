# Team historical Data workspace v0

Implemented on `codex/team-data-suite-v0`, based on main `71ca2a09482ed29c3ae878a050fc6f030d1bbd6c`.

## Scope and behavior

The Team Data section opens a historical workspace without fetching until opened. It searches the admitted 2025 cohort by directory name or Sleeper ID, filters by historical position, selects displayed raw metrics, and sorts by recorded total or mean. Missing values remain last in either direction; shares have no total sort. A selection can hold four players across filter changes, with explicit remove controls. Closing the workspace or changing the roster scope discards its state. No user-specific targets or preference are embedded in product code.

The existing integrity-pinned adapter supplies all 94 admitted historical profiles through a separate bounded catalog route. The prior 32-ID historical selection limit and three-ID evidence route are unchanged. No artifact, source, identity mapping, fantasy scoring or forecast was added. Names use the existing cached Sleeper directory; directory failure leaves ID labels and intact historical evidence. Historical positions and teams remain source context, separate from name-directory acquisition and roster generation clocks.

The copy action includes the base Team roster context and a selected-only data-study attachment with complete historical provenance/receipts, displayed metrics, directory clock, unavailable forecasts and blank manager judgment. Display strings remain untrusted data. Selection is exploration, not a ranking, proof of ownership, valuation or transaction permission. The existing roster packet can contain broader roster history; only the added `data_study` evidence is selection-scoped.

## Validation

- 137 tests passed across 15 focused Team/history/shared contract/routes/client and public-profile suites.
- `sh build.sh` passed; existing bundle-size warning remains.
- Baseline-relative TypeScript check: no new diagnostic lines. The repository-wide baseline still contains pre-existing errors; this is not a clean global typecheck.
- Local HTTP smoke check of the new route with a controlled unavailable directory returned HTTP 200, 94 admitted profiles, null directory clock and ID-label fallback. This check made no successful provider acquisition.
- Tests cover four-player selection, filter persistence, selected handoff/provenance, malformed response rejection, late response invalidation after closing, retry presentation, immutable evidence, missing-value sorting and no-store route behavior.
- Browser visual check attempted but blocked by missing Playwright Chromium executable. Automated DOM checks do not establish portrait-phone acceptance.

## Release boundaries and follow-up

No merge, deployment, trade, claim or external manager message. Independent review and actual phone acceptance remain pending. Remote publication is not performed because current automatic preview/deployment suppression was not verified. The implementation is available as a local reviewable branch.

The explorer covers the admitted cohort only, not the entire NFL pool. Players outside that cohort cannot acquire history through this view. 2026 Weekly Pulse and observed charts remain separate work; current-season forecasts and regression probabilities remain unavailable. It does not establish that any target improves on the incumbent or justify a first-round-pick premium.
