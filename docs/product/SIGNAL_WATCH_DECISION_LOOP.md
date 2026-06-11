# SIGNAL WATCH DECISION LOOP

Status: doctrine capture only. This document defines design language for a future TIBER Management posture. **No runtime implementation accompanies this note** — no controller, scheduler, database table, background worker, UI mode, or agent loop exists or is being built yet.

Origin: [Issue #215](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/215) (explored there under the working name "Flow Mode"). **Signal Watch** is the preferred product/architecture name; "flow" is avoided because it implies the system is autonomously in motion, and because no claim of subjective experience or "flow state" is being made about the system.

## Purpose

As Management grows past a static dashboard — FORGE, TeamState, ROP, Rookies, Point Prediction, and ownership artifacts coming online — TIBER needs a disciplined way to keep connecting signals over time without becoming noisy, overconfident, or agentic in the wrong places.

Signal Watch is that discipline: a bounded re-evaluation posture, not an autonomous loop.

## Core Principle

**Re-evaluation is gated on evidence deltas, not output deltas.**

Signal Watch re-reads a league / roster / management tension only when the **evidence fingerprint** changes. The system never continues because its own generated text appears more confident, and it never decides on its own that it is "still thinking."

> No new evidence means no new interpretive pass.

This makes runaway generation impossible by construction: continuation authority lives in the inputs, not in the model's assessment of its own output.

## Behavior

- **Watch**: hold one active management tension (e.g., a roster direction question) with its last-known evidence fingerprint.
- **Re-read**: when the fingerprint changes — a new artifact promoted, a freshness refresh landed, coverage moved, a contradiction flag flipped — run one new interpretive pass against the updated evidence.
- **Park or hand off**: stop cleanly when any of the following occurs:
  - confidence plateaus across successive evidence changes,
  - evidence is stale or too thin to support interpretation,
  - contradictions appear between sources,
  - a human decision boundary is reached.

Parking is a success state, not a failure: it means the system has extracted what the current evidence supports and is telling the user so.

## Evidence Fingerprint (future-facing design language)

The fingerprint is the compact summary of "what the loop knows" that gates re-evaluation. It is **not a live runtime contract** — nothing computes it today. When implemented, it may include:

- promoted artifact `generatedAt` values
- promoted model status values (`ready`, `missing_export_artifact`, `upstream_unavailable`, …)
- identity and evidence coverage rates
- ConfidenceScorer composites for relevant sources
- TeamDirection blockers / contradiction flags
- the current active management tension

The exact composition is an implementation decision deferred to a future spec.

## How This Differs from Agent Task Loops

- **Codex-style loop**: terminates on task completion. The system runs until the job is done.
- **Signal Watch**: terminates on evidence exhaustion, confidence plateau, contradiction, or human handoff. The objective is not "finish the task" — it is coherent decision movement while signal quality improves, and a clean stop when it doesn't.

Signal Watch is closer to a watch/fixed-point posture than to agent task execution.

## Non-Goals

- No autonomous trade bot.
- No open-ended agent loop.
- No polling/generation loop — passes are triggered by evidence deltas, never by timers or restlessness.
- No self-reaffirming confidence loop — the system may not treat its own conclusions as evidence.
- No bypassing human approval for roster, trade, or waiver decisions.
- No product claim that the system has subjective "flow" or any inner experience.

## Relationship to Existing Doctrine

Signal Watch operates entirely within the [Human in the Loop Decision Doctrine](./HUMAN_IN_THE_LOOP_DECISION_DOCTRINE.md): it lives on the Observe → Interpret → Recommend rungs of the decision ladder, and every hand-off lands on "**Human decides.**" It changes *when* TIBER re-interprets evidence, never *who* owns the decision.

## Parked: Future Unpark Trigger

Implementation work stays deferred until Management has enough upstream readiness to justify it. A reasonable trigger to revisit: `promotedModelStatusService` reports `ready` for at least 3 of the relevant current-season upstream modules (e.g., Strategy, Rookies, ROP, Point Scenarios).

Until then, this note is the deliverable: the concept, the evidence-delta principle, and the non-goals are pinned so the idea cannot drift into an agent loop by accident.
