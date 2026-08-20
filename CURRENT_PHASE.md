# CURRENT_PHASE — Management Product Surface Consolidation

> [!IMPORTANT]
> **Status: historical June 2026 phase snapshot — not the current program frontier.**
>
> This file records Management Product Surface Consolidation as it stood on June 2, 2026. Preserve its milestone and fail-closed guardrails, but do not infer authority to continue Management, Team Delta, rankings, or dashboard expansion.
>
> Current product direction is recorded in [TIBER Product Boundary v1](https://github.com/Prometheus-Frameworks/TIBER-Ops/blob/main/docs/architecture/tiber-product-boundary-v1.md) and [TIBER-Ops #64](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/64): a Pulse / Shared Reality front door, clear ways to use TIBER through an operator-chosen agent, and canonical UI reserved for shared inspection/control needs. No broad Fantasy front-door implementation or route retirement is activated by that direction alone. Any current implementation task must cite a newer scoped issue or operator decision.

Phase Name: Management Product Surface Consolidation
Last Updated: June 2, 2026
Previous Phase: Feature Consolidation & Validation (documented February 21, 2026)

## Active Documentation Doctrine

Active operating docs should describe TIBER-Fantasy as a fantasy football product/orchestration shell that consumes promoted, read-only upstream outputs. Use grounded product language: evidence, explanations, uncertainty, validation, readiness, and human-in-the-loop decisions. Do not use archived philosophical framing as architecture, model evidence, or agent instructions.

## June 2026 Milestone

June 2026 marked the first phase where TIBER-Fantasy could be used continuously against real Sleeper dynasty rosters. The product crossed from infrastructure-first development into product-first usage: sync a real league, select an active team context, inspect roster and future-pick state, evaluate Team Direction, identify missing evidence, and continue into the relevant research surface.

The Management Dashboard is the first operating-system surface where TIBER's model ecosystem meets a user's actual fantasy team. It remains read-only decision support. TIBER prepares the decision; the human manager owns the final roster, trade, or waiver action.

## Management Dashboard v0

| Capability | Status | Notes |
|---|---|---|
| Real Sleeper league sync | Live | Persists saved league context, teams, roster rows, and traded-pick context where Sleeper provides it |
| Active team context | Live | Management can inspect the selected Sleeper dynasty team |
| Roster Snapshot | Live | Shows FORGE-matched rows, promoted Rookie Alpha fallback context, and explicit unmatched states |
| Draft Picks / Future Capital | Live with source limits | Shows traded-pick context from the latest sync where available; it is not a complete league-wide pick ledger |
| Team Direction | Live, read-only | Returns `contender`, `rebuild`, `retool`, or `uncertain` with `high`, `medium`, or `low` confidence |
| Model Signals and Research Surface links | Live | Exposes readiness, provenance, and deeper inspection paths without automated fantasy advice |
| Team Delta | Foundation present; next surface | Sleeper Sync v2 records append-only add, drop, and trade ownership events; a complete pick-capital-aware attribution view is not yet exposed in Management v0 |

## Model Humility Rules

Management must distinguish:

- full synced roster state;
- graded FORGE alpha only;
- unmatched players;
- rookie assets with promoted fallback evidence but incomplete downstream valuation;
- missing valuation layers.

Team Direction remains coverage-gated. Promoted Rookie Alpha matches improve evidence visibility only. They do not count as FORGE scoring coverage and are not blended into FORGE roster strength, lineup totals, scoring, or rankings.

## Rookie/Devy Bridge

The Management fallback consumes the promoted artifact boundary:

```text
TIBER-Rookies exports/promoted/rookie-alpha/
→ TIBER-Fantasy read-only rookie adapter
→ Management rookie asset fallback
```

TIBER-Fantasy must not depend on the TIBER-Rookies static card/detail runtime as a service boundary.

## Primary Objectives (do not exceed 5)

1. Keep the real-team Management workflow stable: Sleeper sync → active context → roster/picks → Team Direction → research surfaces.
2. Complete the Team Delta roster-history and transaction-attribution surface without turning attribution into advice.
3. Extend pick-capital attribution only where governed Sleeper/source data supports it; preserve unavailable states elsewhere.
4. Preserve coverage gating and explicit missing-evidence states as rookie/devy valuation layers evolve.
5. Keep downstream consumers on promoted artifact boundaries rather than depending on upstream static runtimes.

## Out of Scope (hard no)

- Changes to FORGE scoring math, weights, or Team Direction thresholds unless explicitly requested.
- Fabricated values, readiness states, player mappings, or pick ownership continuity.
- Autonomous roster, trade, waiver, or lineup execution.
- Auth/payment work as part of Management product-surface consolidation.
- Treating upstream producer runtimes as hidden service dependencies when promoted artifacts are the governed boundary.

## Definition of Done

- Management docs accurately describe shipped v0 capabilities and source limitations.
- Team Delta work answers “How has my team changed since the last time I looked?” with reviewable attribution and explicit missing evidence.
- Confidence decreases when FORGE or valuation coverage is incomplete.
- Rookie Alpha stays additive and read-only at the promoted artifact boundary.
- Human-in-the-loop framing remains explicit across Management surfaces.

## Governance Notes

TIBER-Fantasy is not the canonical authority for player IDs, upstream model logic, or promoted artifacts. TIBER-Data owns canonical contracts and IDs, TIBER-Rookies owns rookie producer/model/card/board logic and promoted rookie exports, and TIBER-FORGE owns deterministic grading/ranking over canonical inputs. Management should expose unavailable or uncertain states rather than silently repairing upstream gaps with frontend assumptions.

See `docs/product/MANAGEMENT_DASHBOARD_V0.md` and `docs/product/HUMAN_IN_THE_LOOP_DECISION_DOCTRINE.md`.
