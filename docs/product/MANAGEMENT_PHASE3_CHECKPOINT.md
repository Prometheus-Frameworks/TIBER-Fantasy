# Management Post-Phase-3 Checkpoint — June 2026

> **This is a checkpoint before Phase 4 activation, not a feature expansion.**
>
> It documents and re-verifies where the Management surface landed after
> PRs #200 and #219–#222, against the expanded TIBER-FORGE evidence base, so
> that Phase 4 (controlled Strategy activation) starts from a known-safe base.
> No scoring formulas, FORGE artifact rows, Team Direction logic, or strategy
> ontology semantics are changed by this checkpoint. Strategy template selection
> stays disabled.

Tracks issue #223 → "PR 3 — TIBER-Fantasy: Management post-Phase-3 checkpoint smoke".

## Scope of this checkpoint

- Confirm the expanded `FORGE_PLAYER_STATIC_V1` artifact state consumed by Fantasy.
- Confirm active-team Management coverage expectations.
- Confirm Strategy Context stays read-only and fail-closed.
- Record whether Team Direction now classifies on the expanded evidence base.

This checkpoint is verified by the already-green narrow suites:

```bash
npm run test -- \
  client/src/__tests__/managementModelSignals.test.ts \
  server/modules/externalModels/forge/__tests__/forgePlayerStaticAdapter.test.ts \
  server/services/__tests__/leagueDashboardService.test.ts
# Test Suites: 3 passed, 3 total
# Tests:       32 passed, 32 total
```

## 1. Expanded FORGE artifact state (consumed by Fantasy)

Source: `server/artifacts/external/forge/forge_player_static_v1.json` (pinned promoted
TIBER-FORGE snapshot; not Fantasy-owned scoring logic).

| Field | Value |
| --- | --- |
| `artifact_type` | `FORGE_PLAYER_STATIC_V1` |
| `schema_version` | `forge_player_static_v1` |
| `model_version` | `forge-player-static-v1.0.0` |
| `generated_at` | `2026-01-08T00:00:00.000Z` |
| `row_count` | **59** |
| `player_specific` rows | **45** |
| `generated_baseline` rows | **14** |
| Bundled SHA-256 | `cc2254a8d712976184ce370ecc2f932831d65925773b9e5dde924948d9b5cf14` |

**Evidence semantics (unchanged):** only rows with
`row.provenance.score_source === "player_specific"` are FORGE evidence. The 14
`generated_baseline` rows remain **visibility-only / non-evidence** — they do not
count toward Team Direction confidence, FORGE scoring coverage, roster strength,
alpha totals, or player-specific evidence coverage. `fallback_default`, unknown
score sources, missing/unsupported/malformed artifacts, and duplicate canonical
IDs all fail closed.

## 2. Active-team Management coverage expectations

Measured against the active-team fixture roster used by the Management snapshot
helpers (`buildRosterVisibilitySummary`, `buildActiveTeamMatchingSummary`,
`buildManagementSnapshotExport`, `buildManagementIdentitySeedReport`).

| Coverage signal | Value |
| --- | --- |
| `roster_count` | 30 |
| `identity_coverage` | 30/30 |
| `crosswalk_mapped` | 25/30 |
| `forge_row_matched` | 24/30 |
| `player_specific_forge_evidence` | 24/30 |
| `generated_baseline_visibility` | 0/30 |
| `known_unscored` | 6/30 |
| `unresolved` | 0/30 |

Notes:

- `crosswalk_mapped` (25) is intentionally higher than `forge_row_matched` (24):
  one roster row (Frank Gore Jr.) resolves through `TIBER_IDENTITY_CROSSWALK_V1`
  but has no FORGE row, so it is `crosswalk: matched` / `forge: missing_forge_row`
  and stays in `known_unscored`, not in evidence.
- `generated_baseline_visibility` is `0/30`: no active roster row is matched only
  by a generated-baseline FORGE row, so none can inflate evidence.
- League-wide diagnostic counts (e.g. 352 resolved identity rows scanned) are
  reported separately and are **not** used as active-team roster coverage.

## 3. Strategy Context — read-only and fail-closed (confirmed)

Phase 3C safety invariants for `buildManagementStrategyContext` /
`normalizeManagementStrategyContext` (`shared/managementStrategyContext.ts`)
remain intact:

- Template selection **disabled** (`strategy_template_selection_enabled === false`,
  hard invariant — never trusted from an incoming payload).
- `selected_template_id` **remains `null`** in every path.
- **No template rendering** and **no interpolation**: serialized cards never
  contain `template_text` or `{{` / `}}` markers.
- **No recommendations**: advice/activation language in notes is stripped; only
  the known read-only builder notes survive.
- **Unsafe notes are stripped**: interpolation markers and advice phrasing are
  dropped via `sanitizeStrategyContextNote`.
- **Malformed contexts do not crash the UI**: a malformed/forged payload
  (status `definitely_active`, injected `template_text`, attempted activation,
  recommendation notes) fails closed to `status: unavailable`, selection disabled,
  selected template `None`, notes `none`.

An inspectable ontology reports `status: blocked` (visible but gated); a
missing/unavailable ontology fails closed to `status: unavailable`. The
`status: "available"` state is never emitted while template selection is
deferred.

## 4. Team Direction classification on the expanded evidence base

**Does Team Direction now classify? Yes — the coverage gate is cleared.**

`classifyTeamDirection` (`server/services/teamDirectionClassifier.ts`) is
coverage-gated on **player-specific FORGE scoring coverage** only:

- `COVERAGE_THRESHOLD = 0.5` — below 50% FORGE scoring coverage the classifier
  fails closed to `direction: uncertain`, `confidence: low`.
- Active-team FORGE scoring coverage is now **24/30 = 80%**, which is **≥ 50%**.
  The expanded evidence base therefore lifts Management past the gate: Team
  Direction emits a concrete `direction` instead of fail-closed `uncertain`.

Confidence behavior at this coverage level:

- Base confidence is `high` when FORGE coverage `rate ≥ 0.80` **and**
  `matched ≥ 10`. At 24/30 (rate `0.80`, matched `24`) both hold, so `high` is
  reachable.
- It is reduced to `medium` if a scored core position (QB/RB/WR) has zero
  player-specific scored players, and to `low` if two or more core positions are
  unscored. Generated baselines and Rookie Alpha fallback never raise confidence.

What is **not** fixed by this checkpoint: the concrete direction value
(`contender` / `rebuild` / `retool`) is a function of the live roster's
player-specific FORGE alpha distribution (avg alpha, QB/WR/TE alphas, future-pick
count) computed at request time. It is not pinned in any artifact, so it is not
asserted here as a constant.

**Remaining blockers (Phase-4 scope only, not Team Direction):** a guaranteed
`high`-confidence read still wants the 6/30 `known_unscored` rows covered, and the
Strategy template inputs (`age_band`, `experience_band`, `role_security_signal`,
`market_liquidity_signal`) remain absent — these gate Strategy template activation
(Phase 4), not Team Direction classification.

## 5. Readiness summary

| Area | State |
| --- | --- |
| FORGE artifact consumption (59 / 45 / 14) | ✅ confirmed |
| Active-team coverage counts | ✅ confirmed |
| Generated baselines stay non-evidence | ✅ confirmed |
| Strategy Context read-only / fail-closed | ✅ confirmed |
| Team Direction classifies (≥50% gate cleared at 80%) | ✅ confirmed |
| Strategy template activation | ⏸️ deferred to Phase 4 (intentionally disabled) |

Per the issue #223 Phase 4 guardrail, this checkpoint proves the Phase 3 safety
invariants still hold against the expanded evidence base. Phase 4 activation work
should begin only after this checkpoint and the FORGE season-unpin (TIBER-FORGE
PR #44) land.
