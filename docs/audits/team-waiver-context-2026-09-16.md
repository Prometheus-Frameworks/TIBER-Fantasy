# Team waiver context — 2026-09-16

Authority: Joe requested the smallest useful first improvement to the agent handoff: waiver settings, budget/priority, and a timestamped candidate shortlist. Scoped #371 follow-up; base `5ad78c4e89f3ce4bfcbcc4af5912b8aca1063644`. No merge, production release or fantasy transaction authority.

## Behavior

- Roster response adds `waiver_context`: raw numeric source settings, interpreted system and explicitly calculated remaining FAAB; unknown values preserved.
- Optional read-only candidate check excludes all complete league membership groups; filters cached directory to active recognized-team QB/RB/WR/TE. Unknown eligibility stays unknown.
- Manager selects at most five candidates. Main agent copy/comparison includes only selected rows and observation clocks, never the entire directory. Without a matching check it explicitly reports unavailable.
- Refresh/navigation invalidates selections and pending requests. API is no-store and rate-limited within public runtime containment. Existing TE and historical paths preserved.
- No private pending claims, claim-result tracking, forecast or weekly source activation, auth, DB or new provider/configuration.

## Validation

- 118 tests pass across 11 focused suites: roster/service/routes, membership completeness, public containment, Team/comparison/TE/waiver UI, shared packet exports and settings derivation.
- Tests cover FAAB/rolling/reverse/unknown codes; zero, missing, signed, malformed and inconsistent budgets; all membership groups; identity/scope conflicts; selection cap/search; main-copy selection and refresh clearing; unmounted responses; GET validation and write rejection.
- `sh build.sh`: passes (existing large-chunk advisory).
- Typecheck: 507 existing diagnostics on exact unchanged base and branch, identical per-file/error-code counts; no new diagnostics. Repository-wide typecheck is not clean.
- Built public server started successfully. Live curl returned sanitized 502 when Node's existing Sleeper fetch timed out; direct service confirmed AbortError. Python could retrieve the public sources; replay through the same adapter succeeded with 638 unrostered directory candidates and correctly derived FAAB settings. No live roster payloads committed; this replay does not certify deployed network behavior.
- `git diff --check`: clean.

## Acceptance still required

Independent review and portrait-phone acceptance remain outstanding. On the preview: verify FAAB and rolling leagues, search/select candidates, copy and inspect the packet, refresh and confirm shortlist clears, and confirm unavailable-state behavior. No deployment performed in this task.
