# Management Dashboard v0 — June 2026 Milestone

## Milestone

June 2026 marked the first phase where TIBER-Fantasy could be used continuously against real Sleeper dynasty rosters. The product crossed from infrastructure-first development into product-first usage: sync a real league, select an active team context, inspect roster and future-pick state, evaluate Team Direction, review missing evidence, and move into the appropriate research surface.

The Management Dashboard is the first operating-system surface where TIBER's model ecosystem meets a user's actual fantasy team. It remains a read-only decision cockpit: TIBER prepares the decision, and the human manager owns the final roster, trade, or waiver action.

## What Management Dashboard v0 exposes

The `/management` route (also available as `/team-management`) organizes the current product surface around:

- **Active Context** — saved Sleeper league and selected team context.
- **Team Direction** — a read-only roster classifier grounded in available FORGE alpha and pick context.
- **Roster Snapshot** — synced roster rows with explicit valuation coverage states.
- **Draft Picks / Future Capital** — traded-pick context from the latest league sync where Sleeper provides it.
- **Model Signals** — readiness and provenance for available research lanes.
- **Research Surfaces** — links into deeper inspection tools rather than automated roster actions.

## Real Sleeper team sync

TIBER-Fantasy can sync a real Sleeper league and persist:

- saved league context;
- active team context;
- roster rows;
- future-pick context where Sleeper provides traded-pick data.

Unavailable context stays visible as unavailable. Management should not fabricate a complete roster valuation, pick ledger, or healthy model state when an upstream source or valuation layer is missing.

## Team Direction

Team Direction is a read-only roster classifier. Its stable result vocabulary is:

```ts
direction: "contender" | "rebuild" | "retool" | "uncertain"
confidence: "high" | "medium" | "low"
```

The classifier uses eligible FORGE alpha and pick context. It is coverage-gated: incomplete FORGE scoring coverage keeps the result `uncertain` with low confidence rather than overstating roster strength. Promoted Rookie Alpha matches improve evidence visibility but do not count as FORGE scoring coverage and are not blended into FORGE roster strength, lineup totals, scoring, or rankings.

W6 adds the Fantasy-owned `team_direction_forge_player_static_freshness_v1` gate. Every Team Direction request evaluates the artifact root `generated_at` against an inclusive limit of 45 elapsed UTC days. `promoted_at` is diagnostic only and cannot refresh that clock. Warning, stale, unknown, missing, malformed, and future clocks reject the player-specific FORGE input. Rejection returns `classificationAvailable: false`, `direction: "uncertain"`, low confidence, and zero eligible FORGE coverage without hiding the observed rows.

The request emits one `team_direction_forge_player_static_freshness_receipt_v1` receipt for the classifier, backend diagnostics, Management UI, and Management snapshot export. The receipt keeps clocks, decision reason, gaps/conflicts, and raw observed evidence separate from eligible evidence. This gate does not change FORGE artifact bytes, scoring thresholds, direction thresholds, G4 governance work, or the separate FC1 freshness/source repair.

## Team Delta / transaction attribution

The operating question emerging from this milestone is:

> How has my team changed since the last time I looked?

Team Delta is the roster-history and transaction-attribution lane for answering that question. The current repository has the foundation for this lane: Sleeper Sync v2 records append-only roster ownership events for adds, drops, and trades, and existing Sleeper sync logic can inspect transaction history.

A complete pick-capital-aware Team Delta view is still a next product surface, not a finished Management Dashboard v0 claim. As that surface is completed, it should review:

- trades and waiver/free-agent moves;
- players added or lost;
- pick capital gained or lost when source data is available;
- FORGE-only transaction deltas where coverage is sufficient.

Team Delta is review and attribution, not advice. It should explain what changed and which evidence is missing without presenting an autonomous roster decision.

## Model humility and coverage states

Management must keep these concepts distinct:

- **Full roster** — the user's synced roster state.
- **Graded FORGE alpha only** — the subset with a FORGE scoring row.
- **Unmatched player** — a row that cannot currently be valued through FORGE or promoted Rookie Alpha evidence.
- **Rookie asset pending** — a rookie/devy asset that still lacks a complete downstream valuation layer.
- **Missing valuation layer** — a visible gap that should reduce confidence rather than be smoothed over.

Coverage is part of the product output. Confidence should decrease when the evidence is incomplete.

## Rookie/devy bridge

The rookie bridge is an artifact boundary:

```text
TIBER-Rookies promoted Rookie Alpha artifacts
→ TIBER-Fantasy Management rookie asset fallback
```

TIBER-Fantasy consumes promoted Rookie Alpha artifacts from `exports/promoted/rookie-alpha/` through its read-only external-model adapter. It must not depend on the TIBER-Rookies static card/detail runtime as a service boundary.

The fallback is intentionally additive: it can expose promoted rookie context when FORGE remains unavailable, but it does not turn Rookie Alpha into FORGE scoring or silently fill missing valuation layers.

## Human-in-the-loop rule

Management is an inspection and decision-support surface. It may surface evidence, uncertainty, provenance, and research paths. It must not silently execute or imply automatic roster, trade, or waiver decisions.

See `docs/product/HUMAN_IN_THE_LOOP_DECISION_DOCTRINE.md` for the product-wide rule.

## Post-Phase-3 readiness checkpoint

See `docs/product/MANAGEMENT_PHASE3_CHECKPOINT.md` for the June 2026 checkpoint
recording where Management landed after PRs #200 and #219–#222 against the
expanded 59-row FORGE evidence base, including active-team coverage counts,
Strategy Context fail-closed invariants, and Team Direction classification
readiness ahead of Phase 4.
