# Stress Lab Capability Matrix

Stress Lab is a read-only operator inspection surface for deterministic football reasoning governance. It is heuristic-driven, routing-aware, artifact-aware, and designed to preserve uncertainty while operator notes are reviewed over time.

Stress Lab is not a live reasoning engine, not a source-of-truth system, and not a ranking mutation system. It should not call backend model services, mutate projections, rewrite rankings, or fabricate missing source truth. Its current job is to preserve the original note, identify conservative signal cues, route follow-up ownership, classify claim shape, and keep uncertainty visible until the proper owner repo/domain can verify the underlying artifact or source contract.

| Capability | Current Status | Owner Repo/Domain | Verified? | Known Failure Modes | Future Artifact Targets |
|---|---|---|---|---|---|
| Player entity detection | heuristic_v0 | TIBER-Data identity contracts; TIBER-Fantasy inspection surface | Partial — detects likely player labels, but does not resolve canonical IDs | False positives from names that overlap common words; missing nicknames/aliases; no `gsis_id`/canonical identity lookup; no disambiguation across same-name players | `canonical_player_identity_v0`, `roster_snapshot_v0`, `stress_lab_review_export_v0` |
| Team entity detection | heuristic_v0 | TIBER-Data team identity contracts; TIBER-Teamstate interpretation | Partial — detects common team/team-abbreviation cues | Ambiguous abbreviations; franchise naming drift; no season-specific team identity validation; no division/conference grounding | `canonical_team_identity_v0`, `team_environment_snapshot_v0`, `stress_lab_review_export_v0` |
| Rookie/prospect note routing | routing_only | TIBER-Rookies | Partial — routes rookie/prospect/draft capital/production profile/landing spot cues | Can over-route generic rookie mentions; no actual rookie model inference; no promoted rookie artifact lookup; cannot validate class year, draft capital, or production profile | `rookie_alpha_snapshot_v0`, `rookie_prospect_profile_v0`, `rookie_draft_capital_context_v0`, `rookie_production_profile_v0`, `rookie_landing_spot_context_v0` |
| Transaction detection | heuristic_v0 | TIBER-Data source metadata and roster/transaction contracts | Partial — detects transaction-like language as source-truth follow-up | Rumor language may look like a transaction; no source verification; no effective-date or roster-lock validation; cannot distinguish report, speculation, and official move | `transaction_source_ref_v0`, `roster_snapshot_v0`, `canonical_player_identity_v0` |
| Teamstate environment routing | routing_only | TIBER-Teamstate | Partial — routes team/environment/regime/QB transition cues | Does not ingest Teamstate artifacts; can miss subtle scheme/regime changes; cannot resolve whether signal is already represented in a current team environment artifact | `team_environment_snapshot_v0`, `roster_continuity_signal_v0`, `qb_transition_context_v0`, `regime_volatility_context_v0` |
| FORGE fantasy implication routing | routing_only | TIBER-FORGE | Partial — routes fantasy implication/environment/insulation cues for review | Does not execute FORGE; cannot decide whether a signal should change Alpha/scoring; risk of duplicate interpretation if downstream FORGE already accounts for the context | `player_fantasy_signal_snapshot_v0`, `insulation_adjustment_signal_v0`, `offensive_environment_adjustment_v0` |
| Role & Opportunity routing | routing_only | Role & Opportunity domain/model | Partial — routes usage, route, target quality, red-zone, and opportunity cues | No live role/opportunity artifact lookup; no route participation validation; ambiguous role language can overlap with projection or teamstate interpretation | `role_opportunity_snapshot_v0`, `route_participation_signal_v0`, `target_quality_context_v0`, `red_zone_usage_context_v0` |
| Artifact classification | heuristic_v0 | TIBER-Fantasy / Stress Lab, with owner repo handoff | Partial — suggests required artifact families per routed domain | Suggested artifact names are not proof that artifacts exist; no compatibility validation; no schema/version negotiation; future names may move upstream | `stress_lab_review_export_v0`, `operator_signal_note_v0` |
| Claim classification | heuristic_v0 | TIBER-Fantasy / Stress Lab | Partial — classifies claims into truth, team interpretation, fantasy implication, usage/role signal, rookie model implication, or operator hypothesis | Single note can contain multiple claim types; current classification is routing support, not adjudication; cannot verify whether a claim is true | `operator_signal_note_v0`, `stress_lab_review_export_v0` |
| Temporal grounding awareness | partial | TIBER-Data contracts; downstream owner domains | No — currently preserves timestamps but does not resolve temporal conflicts | Relative dates, stale notes, conflicting reports, and season-window mismatches are not resolved; no event timeline or source freshness model | `transaction_source_ref_v0`, `roster_snapshot_v0`, `team_environment_snapshot_v0` |
| Uncertainty preservation | heuristic_v0 | TIBER-Fantasy / Stress Lab | Yes for v0 guardrails — uncertainty strings and do-not-apply notes are preserved | Uncertainty may be generic; does not quantify confidence beyond conservative heuristic labels; no upstream confidence merge | `operator_signal_note_v0`, `stress_lab_review_export_v0` |
| Hypothesis preservation | heuristic_v0 | TIBER-Fantasy / Stress Lab | Yes for v0 export/review shape | Preserved hypotheses may be mistaken for verified findings if copied out of context; no review-state workflow yet | `operator_signal_note_v0`, `stress_lab_review_export_v0` |
| Dynasty ranking guardrails | docs_only | TIBER-FORGE / ranking systems; TIBER-Fantasy operator surface | Partial — guardrails state not to mutate rankings from notes alone | Text-only guardrails do not enforce downstream behavior; operator may still manually over-apply unverified claims; no automated policy gate | `player_fantasy_signal_snapshot_v0`, `rookie_alpha_snapshot_v0`, `stress_lab_review_export_v0` |
| Canonical identity resolution awareness | planned | TIBER-Data | No — awareness only, no resolver in Stress Lab | Entity labels are not canonical IDs; aliases, misspellings, duplicate names, team changes, and prospect/player transitions remain unresolved | `canonical_player_identity_v0`, `canonical_team_identity_v0`, `roster_snapshot_v0` |
| Source verification awareness | planned | TIBER-Data source metadata; owner domain artifacts | No — Stress Lab flags need for verification but does not verify | Operator notes may cite no source; source trust, timestamp, report status, and contradiction handling are not implemented | `transaction_source_ref_v0`, `source_metadata_ref_v0`, `stress_lab_review_export_v0` |

## Current Architectural Boundaries

- **TIBER-Data** owns truth, canonical contracts, IDs, source metadata, governed source references, roster snapshots, and transaction source references.
- **TIBER-Teamstate** owns team interpretation, including team environment, continuity, quarterback transition, regime volatility, and other team-context artifacts.
- **TIBER-Rookies** owns rookie/prospect evaluation, rookie model outputs, draft-capital context, production-profile context, landing-spot interpretation, and promoted rookie exports.
- **TIBER-FORGE** owns deterministic fantasy signal/scoring interpretation and any scoring/ranking implications over canonical inputs.
- **Role & Opportunity** owns usage, deployment, route participation, target quality, red-zone opportunity, and role/opportunity signal interpretation.
- **TIBER-Fantasy** owns operator-facing synthesis, inspection, review/export ergonomics, and read-only downstream presentation. It should not silently patch upstream truth or mutate ranking/projection systems from Stress Lab notes.

## Current Known Gaps

- Canonical ID resolution is not implemented in Stress Lab.
- No live artifact lookup is performed.
- No source verification engine is implemented.
- No temporal conflict resolution exists for stale notes, relative dates, conflicting reports, or season-window mismatches.
- No cross-artifact reasoning exists across TIBER-Data, Teamstate, Rookies, FORGE, and Role & Opportunity artifacts.
- No automated downstream scoring or ranking mutation is allowed or implemented.
- No actual rookie model inference execution is performed.
- No Teamstate artifact ingestion is implemented yet.
- No FORGE execution or scoring comparison is performed from Stress Lab.
- No role/opportunity model execution is performed from Stress Lab.
- No review-state workflow exists beyond preserving note/export context and follow-up requirements.

## Design Philosophy

- Preserve uncertainty instead of smoothing it away.
- Preserve timestamps and note provenance so stale or conflicting context stays inspectable.
- Preserve repo/domain boundaries; Stress Lab routes and classifies, but owner systems verify and interpret within their domain.
- Route before reasoning: detect the likely owner/domain before making any downstream judgment.
- Inspect before automate: make capability coverage, gaps, and failure modes visible before wiring autonomous model behavior.
- Do not fabricate source truth, canonical identity, readiness states, model outputs, player facts, or ranking implications.
- Downstream systems own interpretation within their domain, and TIBER-Fantasy should remain an operator-facing synthesis/inspection layer rather than a hidden source-of-truth patch layer.
