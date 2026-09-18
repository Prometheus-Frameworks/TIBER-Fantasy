# TIBER Now — Project Status

**Last repository check: September 18, 2026 (UTC).**  
**Scope:** public upstream source and GitHub work records. Deployment, live accounts and current data freshness were not tested in this check.

TIBER builds open football research and decision-support tools: data contracts, interpretable models, and ways for people and their agents to inspect the evidence. This page is the shared starting point across the repositories.

## Start here

- **Explore the product or run it yourself:** [TIBER-Fantasy setup and surfaces](../README.md). Team is the public Sleeper roster/comparison and agent-handoff entry point.
- **Build with football data:** [TIBER-Data contracts and artifact index](https://github.com/Prometheus-Frameworks/TIBER-Data#readme). Verify the exact artifact, supported season/week and provenance before consuming it.
- **Try a model or research tool:** use the repository map below. “Packaged for testing” means committed code and documented local entry points, not a certified deployment or validated predictive advantage.
- **Understand project direction:** [TIBER Product Boundary v1](https://github.com/Prometheus-Frameworks/TIBER-Ops/blob/main/docs/architecture/tiber-product-boundary-v1.md) and [operating map](https://github.com/Prometheus-Frameworks/TIBER-Ops/blob/main/docs/operating-map.md).

TIBER prepares the decision; the human manager makes it. Observed football data, model inference, research proposals and agent reasoning should remain distinguishable.

## What the status labels mean

| Label | Meaning |
| --- | --- |
| Available to use | An identified source, document or artifact can be used within its stated scope and prerequisites. It does not imply a hosted service was checked. |
| Packaged for testing | Committed implementation and documented local entry points exist; validation, coverage and runtime limits still apply. |
| In progress | A concrete implementation or review candidate exists, but the stated delivery milestone is unfinished. |
| Conceptual / proposed | A design or requested direction exists; it is not a shipped capability. |
| Blocked / parked | A prerequisite or separate decision is needed before that use can proceed. |

“Design complete,” “code merged,” “tested package,” and “live feature” are separate milestones. A closed issue or enthusiastic comment does not establish all four.

## Current work and next checkpoints

All records below were checked on **September 18, 2026**. These are workstreams to understand, not new implementation authority or promised delivery dates.

| Workstream | Current status | Evidence and next checkpoint |
| --- | --- | --- |
| Weekly box-score producer and Team adapter | **Code merged; runtime blocked** | [Data PR #273](https://github.com/Prometheus-Frameworks/TIBER-Data/pull/273) and [Fantasy PR #386](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/386) merged September 16. Offline preparation exists; the weekly endpoint deliberately remains unavailable. Separate source admission and consumer activation are still needed. |
| Team waiver context | **In progress — draft PR** | [Fantasy PR #396](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/396) is open, draft and unmerged. It adds league waiver settings and selected candidates to agent context. Current review and phone acceptance must be resolved before a release claim. |
| 2026 in-season Forecast | **Conceptual / proposed program; live delivery unverified** | [Forecast #187](https://github.com/Prometheus-Frameworks/TIBER-Forecast/issues/187) defines the Year 1 baseline and gated feature path. Historical backtest availability does not establish a live 2026 producer. Verify exact input, evaluation and consumer receipts for each implementation milestone. |
| Weekly Pulse | **Conceptual / proposed** | [Fantasy #381](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/381): a post-slate observation shortlist. Next checkpoint is source readiness and a bounded selection policy. |
| Team Charts | **Conceptual / proposed** | [Fantasy #399](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/399): single-week scatter plots with presets and supported custom axes. Current-week source admission remains a prerequisite to populated charts. |
| Team iOS | **Conceptual / proposed readiness track** | [Fantasy #400](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/400): choose a release baseline and resolve account/device/distribution gates. No TestFlight or App Store availability is certified here. |

### Recent verified change

On **September 16, 2026**, the paired weekly producer and consumer preparation PRs merged. This is an implementation milestone, not current-week data activation. See the two PRs above for their validation receipts and scope.

## Repository map

Each entry links to its checked upstream README and local usage instructions. Repository descriptions were checked on **September 18, 2026**; their commands and applications were not rerun during this documentation check.

| Repository | Status / usable scope | What to expect |
| --- | --- | --- |
| [TIBER-Fantasy](https://github.com/Prometheus-Frameworks/TIBER-Fantasy#readme) | Available to use — source/setup | Web UI/API, public Sleeper Team context, player comparison and agent handoff. Data and deployment prerequisites apply; hosted availability was not tested. |
| [TIBER-Data](https://github.com/Prometheus-Frameworks/TIBER-Data#readme) | Available to use — contracts/tools | Canonical contracts, identity and artifact documentation. Check each artifact’s provenance and coverage; a promoted directory alone proves neither. |
| [TIBER-Rookies](https://github.com/Prometheus-Frameworks/TIBER-Rookies#readme) | Packaged for testing | Rookie Alpha producer, export validation and standalone static lab. Downstream handoff remains explicit; experimental ML is separate. |
| [TIBER-Forecast](https://github.com/Prometheus-Frameworks/TIBER-Forecast#readme) | Packaged for testing | Scoring kernel and historical seasonal backtest. The 2026 in-season program is separate; this snapshot does not certify a live forecast. |
| [TIBER-FORGE](https://github.com/Prometheus-Frameworks/TIBER-FORGE#readme) | Packaged for testing | Deterministic grading and artifact inspection. Early, constrained; no live ingestion or production-complete claim. |
| [Role-and-opportunity-model](https://github.com/Prometheus-Frameworks/Role-and-opportunity-model#readme) | Packaged for testing | WR/TE role API and canonical role-opportunity envelope. Output depends on supplied governed inputs; proxies remain labeled. |
| [TIBER-Teamstate](https://github.com/Prometheus-Frameworks/TIBER-Teamstate#readme) | Packaged for testing | Team-environment pipeline and downstream snapshot contracts. Seed/sample artifacts do not establish current-week coverage. |
| [Age-curve-intelligence-model](https://github.com/Prometheus-Frameworks/Age-curve-intelligence-model#readme) | Packaged for testing | Age Context v1 upload/run/results app and exports. Context only; modifiers are provisional, not standalone valuations. |
| [ARC](https://github.com/Prometheus-Frameworks/ARC#readme) | Packaged for testing | Historical cohort and baseline CLI with validated handoff format. Requires historical input; research scope. |
| [Signal-Validation-Model](https://github.com/Prometheus-Frameworks/Signal-Validation-Model#readme) | Packaged for testing | Historical WR ingestion, labels, comparisons and case studies. No production forecasting or predictive-power claim. |
| [TIBER-Strategy](https://github.com/Prometheus-Frameworks/TIBER-Strategy#readme) | Available to use — vocabulary artifact | Versioned dynasty ontology. Fantasy consumption is read-only diagnostics; player classification/advice remain inactive. |
| [TIBER-Research](https://github.com/Prometheus-Frameworks/TIBER-Research#readme) | Packaged for testing | Offline custody validators and Research Gateway intake/read scaffold. Agent-entry is draft; validation does not activate research or promote findings. |
| [TIBER-Harness](https://github.com/Prometheus-Frameworks/TIBER-Harness#readme) | Packaged for testing | Offline MockProvider evaluation and opt-in local Ollama path. No production integration or real artifact promotion. |
| [TIBER-Ops](https://github.com/Prometheus-Frameworks/TIBER-Ops#readme) | Available to use — documentation | Operating map, architecture direction, lane coordination and review runbooks. Documentation does not activate parked work. |

## Joining in

People and agent-assisted contributors are welcome. Start with the relevant repository’s README and operating instructions, then open a focused issue explaining what you want to build, what evidence it needs, and whether the work is a proposal, local experiment, fork implementation or upstream PR.

Link the exact code/artifact and validation results when reporting progress. A working fork can be useful without being an official upstream capability. Fork reports and issue comments do not establish upstream acceptance, release readiness or maintainer authorization.

For a small contribution, documentation corrections, reproducible bug reports and clearly scoped PRs are good entry points. For larger integrations, discuss the contract and owner first. Preserve missing-data states and leave final fantasy decisions with the user.

## Keeping this page current

The intended cadence is a daily evidence check, with updates submitted through review. This initial snapshot does not claim that an unattended publishing system is installed.

1. Check upstream default branches, relevant PR states and maintainer decisions. Distinguish issue-body plans from later implementation and acceptance evidence.
2. Update only supported claims. Link each changed milestone to its source; record exact validation scope and deployment evidence separately.
3. Refresh a row’s verification date only after checking it. If a source is inaccessible, retain its prior date and mark verification unavailable. A new date must never imply new progress.
4. Record “checked; no material change” when that is the result. Keep a short recent-changes section; Git history preserves older snapshots.
5. Keep this single canonical page in Fantasy. Other README files link here instead of maintaining competing status copies.

This is a navigation and status summary. Domain contracts stay with their owning repositories, and operational decisions remain with the maintainer.
