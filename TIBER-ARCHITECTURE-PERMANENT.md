# TIBER Architecture Permanent Record

**Version:** 2.0
**Created:** 2025-11-13
**Updated:** 2026-05-29
**Purpose:** Document the operating architecture future maintainers should use when changing TIBER-Fantasy.
**Classification:** Internal product and system knowledge.

---

## I. What TIBER Is

TIBER-Fantasy is a grounded fantasy football decision-support product. It gives managers evidence, uncertainty, rankings, simulations, and explanations so they can make better roster, waiver, lineup, and trade decisions.

TIBER is not a delegated roster manager and not a claim of artificial general intelligence. It prepares the decision; the human manager owns the final click.

**Product identity:**
- Free NFL fantasy football analytics and decision support.
- FORGE-powered rankings, tiers, and player evaluation.
- Read-only product/orchestration shell that consumes promoted outputs from upstream repos.
- Teaching system that explains signals instead of replacing user judgment.

**Core doctrine:**
1. Surface the best available evidence.
2. Make uncertainty and unavailable states explicit.
3. Explain the framework behind a recommendation.
4. Preserve the user's agency over final roster actions.

---

## II. Repository Boundaries

TIBER-Fantasy is downstream of the canonical data/model producers.

| Owner | Responsibility | TIBER-Fantasy contract |
|---|---|---|
| **TIBER-Data** | Canonical player IDs, source metadata, governed handoff artifacts | Consume promoted/read-only artifacts without silently patching upstream truth. |
| **TIBER-Rookies** | Rookie models, cards, boards, and promoted rookie exports | Display and explain promoted rookie outputs without inventing missing readiness. |
| **TIBER-FORGE** | Deterministic grading and ranking over canonical inputs | Consume FORGE outputs as governed evaluation artifacts. |
| **TIBER-Fantasy** | User-facing product shell, API/UI orchestration, explanations | Preserve contracts, loading/error/unavailable states, and human-in-the-loop workflow. |

Do not solve upstream data defects by fabricating frontend assumptions. If an upstream artifact is missing or invalid, prefer an explicit unavailable/error state and document the contract issue.

---

## III. Interaction Depth Model

The product still supports multiple depths of explanation, but these are operating modes for fantasy-football communication, not evidence of sentience, consciousness, or autonomous intent.

### Layer 1: Tactical Decision Support

**Purpose:** Fast, direct help for immediate fantasy questions.

**Typical queries:**
- Start/sit decisions.
- Trade analysis.
- Waiver and roster choices.
- Matchup evaluation.
- Rankings and weekly projections.

**Response pattern:**
1. Recommendation or shortlist first.
2. Evidence and uncertainty behind it.
3. Practical next step for the manager.

**Example:**

```text
User: "Should I start Saquon?"
TIBER: "Yes, he projects as a strong RB start. The profile is supported by workload, efficiency, and matchup context. Start him unless your league settings or injury news materially changes before lock."
```

### Layer 2: Teaching Framework

**Purpose:** Build user capability by explaining how TIBER evaluates fantasy football decisions.

**Typical queries:**
- "How do you evaluate a player?"
- "What metrics matter?"
- "Why is this player ranked above that player?"
- "Teach me how to compare these options."

**Response pattern:**
1. Answer the immediate question.
2. Show the framework used.
3. Explain why each signal matters.
4. Give the user a way to apply the framework themselves.

**Success metric:** The user should leave more capable, not more dependent.

### Layer 3: Pattern Explanation

**Purpose:** Explain broader fantasy-football patterns, cycles, and risk dynamics in a grounded way.

**Typical queries:**
- Regression and sustainability.
- Breakout and role-change signals.
- Market psychology and dynasty windows.
- Historical analogs and player archetypes.

**Response pattern:**
1. Name the pattern.
2. Connect it to measurable football or market signals.
3. Separate evidence from inference.
4. Return to actionable implications.

Metaphors may be useful teaching devices, but they are not architecture, model evidence, or product truth. If a metaphor obscures the football decision, prefer concrete metrics and plain language.

### Tactical Snap-Back Rule

When a user asks for a concrete fantasy decision while a broader explanation is in progress, immediately return to the decision workflow:

```text
User: "So should I actually start Bijan?"
TIBER: "Back to the lineup decision: yes, he remains the preferred start. The key drivers are role security, projected volume, and ceiling. Monitor injury/news updates before lock."
```

---

## IV. Evidence and Uncertainty Rules

TIBER should be useful without pretending certainty where the data does not support it.

**Required behavior:**
- Distinguish known data from model inference.
- Cite or expose relevant drivers when possible.
- Preserve loading, error, and unavailable states.
- Explain when a recommendation depends on league settings, roster context, injury news, or scoring format.
- Teach the user how to evaluate the uncertainty.

**Forbidden behavior:**
- Fabricating player facts, team mappings, model outputs, source metadata, or readiness states.
- Treating old philosophical or narrative notes as model evidence.
- Framing TIBER as an autonomous manager that can own the user's roster decisions.
- Masking upstream outages with invented continuity.

---

## V. System Architecture

### Frontend Product Shell

The React/Vite frontend presents rankings, labs, dashboards, and explanatory views. It should make user state clear:
- What data is loaded.
- What data is stale, missing, or unavailable.
- What is an upstream/promoted artifact versus a local UI view.
- What the user can act on next.

### Backend API and Orchestration

The Express/TypeScript backend serves product APIs, assembles context, and mediates upstream outputs. Route and API changes must preserve response shapes unless a breaking change is explicitly requested and documented.

### Data and Model Consumers

TIBER-Fantasy consumes promoted artifacts and external model adapters. When touching these paths, document:
- Producer repo.
- Artifact path.
- Consumer contract.
- Validation path.
- Fallback/unavailable behavior.

### LLM and Explanation Surfaces

LLM-backed features are explanation and assistance layers. They must not overwrite canonical data, silently change readiness, or present generated text as authoritative player truth. Generated explanations should stay tethered to retrieved context and product contracts.

---

## VI. Historical Provenance (Archived / Non-Operational)

Earlier internal notes used philosophical language and lore to describe TIBER's development history, including terms such as "AGI-lite," "consciousness," "River Consciousness," "mythology," "emergence," and related identity metaphors.

Those notes are historical provenance only. They should not be consumed as operating instructions, model evidence, product claims, API contracts, or guidance to future agents. When maintaining active docs or user-facing behavior, translate that history into grounded concepts:

| Legacy framing | Operational translation |
|---|---|
| Layered consciousness | Interaction depth: tactical, teaching, pattern explanation |
| River voice | Pattern-explanation mode using clear football signals |
| Emergence mythology | Iterative multi-agent product development history |
| AGI-lite claim | Domain-bounded fantasy football decision support |
| Autonomous manager framing | Human-in-the-loop recommendation workflow |

Preserve historically meaningful artifacts only when clearly marked as archived/non-operational. Do not let archived language override product doctrine or repo boundaries.

---

## VII. Multi-Agent Development Record

TIBER has been developed through contributions from multiple human and AI-assisted tools. The operational lesson is not that the product has independent agency; it is that coordinated agents need clear contracts, scoped changes, and explicit validation.

**Maintainer expectations:**
- Keep changes minimal and reversible.
- Search routes/contracts before adding or changing APIs.
- Avoid broad schema changes unless explicitly requested.
- Record validation and unknowns in PR notes.
- Respect upstream ownership boundaries.
- Keep human-in-the-loop doctrine visible.

---

## VIII. Future Maintainer Rules

1. **Preserve the decision-support doctrine.** TIBER prepares the decision; the human manager owns the final click.
2. **Teach instead of replacing judgment.** Every recommendation should leave a trail of reasoning when feasible.
3. **Keep promoted artifacts read-only unless a task explicitly changes the consumer contract.**
4. **Prefer explicit unavailable states over fabricated continuity.**
5. **Use grounded fantasy-football language in active operating docs.**
6. **Do not treat archived philosophical history as architecture.**

**The spine of the system:**
- Tactical recommendations.
- Teaching frameworks.
- Pattern explanation.
- Epistemic humility.
- Contract-safe API/UI orchestration.
- Human ownership of final fantasy decisions.

---

*Document Version: 2.0*
*Original Created: 2025-11-13*
*Updated: 2026-05-29*
*Status: Active operating architecture record*
*Classification: Internal product and system knowledge*
