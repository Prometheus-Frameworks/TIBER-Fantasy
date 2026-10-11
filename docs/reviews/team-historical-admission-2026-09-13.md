# Team historical admission — prepared changes, 2026-09-13

Nineteen reviewed players had source-backed 2025 records but no admitted Team
identity. This pair of changes adds those exact identities upstream and includes
their retrospective profiles in the downstream Team bundle.

## Prepared commits and files

Data branch `codex/team-historical-admission-19`, based on main `e65791d`:
local preparation commit `790c04f910d27a5029a3dbe55d7f44fb8f193d1b`, published as
`5c683e26a843b98358292f0d34a97a98762a96f0` in [Data draft PR #271](https://github.com/Prometheus-Frameworks/TIBER-Data/pull/271).
Both commits have tree `e8a0e22fe54fefe4f31b34551b65afd34207e9d2`.
Ten files cover the new admission receipt/materializer/tests, additive crosswalk,
legacy overwrite guard, identity docs and paired mechanical audit.

Fantasy branch `codex/team-historical-admission-19`, based on main `a6840e50`:
matching pinned builder, regenerated bundle/runtime hash, additive provenance
type, focused tests and handoff documentation. Auth #375 and Team preview #377
are untouched. This branch can be reviewed independently of those changes.

## Result and boundaries

- Data identity coverage and Team profile count: 75 → 94; all old rows/profiles unchanged.
- Exactly 14 medium name_exact, 3 high gsis_direct and 2 high espn_bridge additions.
- 248 recorded observations in each lane; 94 absent calendar slots remain unknown;
  nine post-window observations per lane are excluded.
- Historical team attribution preserved, including Montgomery DET and Pittman IND.
- Antonio Williams remains outside the 2025 cohort. No rookie history is invented.
- Source hashes, nflverse attribution/CC BY 4.0, dated terms limits and null acquisition
  clocks remain visible. No current forecasts, regression estimates or league points.
- Conversation acceptance is recorded without inventing a GitHub operator comment.
  The prior independent source-proposal review does not certify this implementation.

The artifact is 134266 bytes, below the unchanged 250000-byte runtime cap.
SHA-256: `24015b41becb5bcbb87bea7e4c5d8443c3e1254a4ceea9c624a023263b021ea1`.

## Validation

- Data: 94 tests across new/prior admission and proposal suites plus V2 schema.
- Fantasy: 15 Python tests, repeated under python -O; deterministic offline replay.
- Exact comparison preserves all 75 old profiles and previous admission provenance.
- 60 Jest tests across seven relevant history/service/routes/UI/shared/containment suites.
- Full deployment build passed. Built public-profile /evidence HTTP smoke verified
  the new source pin, nineteen-edge provenance, DET/IND attribution and Antonio's
  unavailable state. No live football provider read was needed for that smoke.
- Typecheck: 506 existing diagnostics, identical file/error-code counts to unchanged
  main under the same dependencies; no added or touched-file diagnostics.
- After the publication pin changed: deterministic replay, all 15 Python tests in
  normal and optimized modes, and all five runtime history tests passed again.
  Exact comparison confirmed the producer commit is the only changed bundle field.

## Publication and next decision

Automatic approval review initially rejected publication of the Data identity/audit
payload. The operator subsequently explicitly authorized publishing both prepared
branches and opening draft PRs. A newly authorized Git push then failed because
the workspace lacked write credentials. Publication uses the authenticated GitHub
connection, preserving the exact Data file tree but assigning new commit metadata.
The Fantasy source pin, bundle hash and corresponding assertions were updated to
the published Data commit; all 94 profile objects and other bundle fields remain
identical to the prepared version. Data PR #271 is draft and unmerged; the matching
Fantasy draft PR is the remaining publication step. Independent implementation
review and separate operator merge/deployment decisions remain outstanding.


## 2026-09-13 — Accepted P2: preparation is not runtime admission

Operator accepted discussion_r3999768958 and authorized the bounded repair and
next review. The integrity-checked decoder now withholds all nineteen identities
from the preparation-only receipt in every runtime profile, including preview.
It returns unavailable with an explicit promotion/admission reason and null
identity/observations plus empty derived metrics. The runtime caches only this
filtered evidence; direct decoding and cached selections cannot expose the
prepared profiles as available. All 75 prior profile objects and attribution
remain unchanged. The 94-record offline bundle and its source/hash pins remain
unchanged and inspectable for review. Its availability fields describe prepared
source records, not permission to serve the new cohort.

No runtime switch, receipt-stage string or PR merge activates these profiles. A
later separately authorized change must pin accepted promotion evidence and
review the consumer admission policy. This repair does not invent that receipt
or grant promotion. Data #271's accompanying repair changes only its inventory
and handoff, so the existing immutable source pin remains valid.

Regression coverage checks all nineteen withheld identities, exact preservation
of the prior 75, decoder and cache behavior, response mutation isolation, and a
mixed public HTTP comparison. Fresh independent review remains pending; merge
and promotion/release decisions remain separate. This section supersedes the
earlier preparation-stage runtime availability and pending-publication wording.

P2 repair validation: all 62 tests in seven focused suites and the full build passed.
