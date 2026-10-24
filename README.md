# TIBER-Fantasy

**Independent football research, supported by models and open-source tools.**

TIBER is a football research project led by Joe with AI collaborators. We study
NFL players, team environments and fantasy decisions, preserve our questions and
evidence, and revisit our conclusions as the season develops.

This repository contains the application and integration work that helps connect
those investigations with fantasy-league context.

> **[TIBER Now — dated project status and work in progress](docs/TIBER_NOW.md)**

## Explore TIBER

### Research

[TIBER Research](https://github.com/Prometheus-Frameworks/TIBER-Research/issues)
is our working research notebook: player investigations, matchup studies,
experiments and follow-ups. Reports record what we think, what supports it, and
what could change our view. Each investigation has its own evidence and review
status.

### Models

- [Role & Opportunity](https://github.com/Prometheus-Frameworks/Role-and-opportunity-model) — interpreting player usage, deployment and opportunity.
- [Teamstate](https://github.com/Prometheus-Frameworks/TIBER-Teamstate) — interpreting the team environment around a player.
- [Rookies](https://github.com/Prometheus-Frameworks/TIBER-Rookies) — rookie evidence and evaluation.
- [Forecast](https://github.com/Prometheus-Frameworks/TIBER-Forecast) — forecasting research and scoring utilities.

Each repository documents its own coverage, limitations and development status.

### Tools & workflows

TIBER-Fantasy contains application and integration work.
[TIBER Ops](https://github.com/Prometheus-Frameworks/TIBER-Ops) records
cross-project coordination and workflow development.

The TIBER MCP connector is currently private. Research and model integrations are
being developed incrementally; a repository link does not imply a publicly
available connector or a live model integration.

## How we work

We distinguish reported evidence, model interpretation and open questions, keep
sources and coverage visible, and revisit conclusions as new evidence arrives.

TIBER prepares the decision. The human manager makes the final roster, trade,
waiver, draft or lineup choice.

## Contributing

Questions, sources, corrections and contributions from people and agent-assisted
researchers are welcome. Make the evidence and uncertainty clear, and explain how
your contribution advances the question.

For code or documentation changes:

1. Read [`AGENTS.md`](AGENTS.md).
2. Identify the repository that owns the truth or behavior being changed.
3. Preserve explicit loading, error, unavailable, confidence, and provenance
   states.
4. List the validation commands and outcomes in the pull request.

## Application and developer reference

<details>
<summary>Application surfaces, repository architecture and local setup</summary>

The reference below describes application code and development setup. Hosted
availability and evidence coverage are separate questions; consult the dated
[TIBER Now](docs/TIBER_NOW.md) notes and the linked capability documentation.

## Current product surfaces

This route inventory is a code reference, not a verification of a live deployment.

| Surface | Route | Purpose |
| --- | --- | --- |
| **Observatory** | `/` or `/observatory` | Inspect system state, research notes, uncertainty, and known capability gaps. |
| **Management** | `/management` | Sync and inspect a Sleeper dynasty team, future-pick context, Team Direction, model signals, and missing evidence. |
| **TIBER Team** | `/team` (also `/draft-review`) | Load a public Sleeper league, draft or roster; select and refresh the current roster, inspect lineup/reserve context, compare players and copy a roster link or agent snapshot. Selecting a roster does not authenticate ownership; preferences and hypotheses belong in the agent conversation. |
| **Rankings** | `/tiers` | Inspect weekly rankings with explicit source, freshness, expected-points, range, confidence, and fallback metadata. |
| **Rookies** | `/rookies` | Read promoted TIBER-Rookies evidence through an artifact boundary. |
| **Data Lab** | `/tiber-data-lab` | Enter promoted research lanes and inspect their readiness and provenance. |
| **Command Center** | `/tiber-data-lab/command-center` | Triage promoted research modules and continue into deeper player or team inspection. |
| **Player Research** | `/tiber-data-lab/player-research` | Assemble available read-only evidence for one player without creating a hidden unified score. |
| **Team Research** | `/tiber-data-lab/team-research` | Inspect team-level context and available player evidence. |
| **Schedule / SoS** | `/schedule` | Inspect schedule and matchup context. |

QB, RB, WR, and TE are the primary governed ranking scope. IDP remains
available as a separate transitional lab rather than a claim of full
repository-wide parity.

Management v0 supports a continuous read-only workflow against a real Sleeper
dynasty league:

```text
league sync
→ active team context
→ roster and available pick context
→ coverage-gated Team Direction
→ research surfaces
→ human decision
```

Team Direction returns `contender`, `rebuild`, `retool`, or `uncertain` with an
explicit confidence level. Incomplete FORGE coverage, unmatched players, and
missing valuation layers reduce confidence instead of being silently smoothed
over. Promoted Rookie Alpha evidence can add context for rookie assets, but it
is not blended into FORGE scoring or roster strength.

See
[`docs/product/MANAGEMENT_DASHBOARD_V0.md`](docs/product/MANAGEMENT_DASHBOARD_V0.md)
for the current Management capability boundary.

## How TIBER fits together

TIBER is a multi-repository system. Each repository should own a bounded job and
communicate through explicit contracts or promoted artifacts.

| Repository | System role |
| --- | --- |
| [`TIBER-Research`](https://github.com/Prometheus-Frameworks/TIBER-Research) | Football investigations, research records, and supporting research protocols. |
| [`Role-and-opportunity-model`](https://github.com/Prometheus-Frameworks/Role-and-opportunity-model) | Player-level interpretation of usage, deployment, and opportunity. |
| [`TIBER-Data`](https://github.com/Prometheus-Frameworks/TIBER-Data) | Governed source data, canonical identity, provenance, and promoted handoff artifacts. |
| [`TIBER-Teamstate`](https://github.com/Prometheus-Frameworks/TIBER-Teamstate) | Team-environment interpretation and governed historical reports. |
| [`TIBER-Rookies`](https://github.com/Prometheus-Frameworks/TIBER-Rookies) | Rookie evidence, models, boards, and promoted rookie artifacts. |
| [`TIBER-Strategy`](https://github.com/Prometheus-Frameworks/TIBER-Strategy) | Deterministic fantasy-strategy vocabulary and read-only diagnostic contracts. |
| [`TIBER-FORGE`](https://github.com/Prometheus-Frameworks/TIBER-FORGE) | Archived standalone grading and ranking code. |
| [`TIBER-Forecast`](https://github.com/Prometheus-Frameworks/TIBER-Forecast) | Forecasting and scoring utilities whose outputs remain model inference rather than observed truth. |
| **TIBER-Fantasy** | Downstream orchestration, APIs, and user-facing inspection surfaces. |
| [`TIBER-Ops`](https://github.com/Prometheus-Frameworks/TIBER-Ops) | Cross-repository coordination, operating state, and operator governance. |

TIBER-Fantasy consumes upstream work through adapters and artifact boundaries
under `server/modules/externalModels/`. It should not repair upstream data
problems with frontend assumptions or reimplement producer logic locally.

The weekly rankings contract currently prefers the configured
TIBER-Forecast scoring service when its inputs are sufficient and preserves a
legacy in-repo FORGE fallback. The response identifies which path produced the
result. The fallback is a compatibility boundary, not a claim that
TIBER-Fantasy permanently owns FORGE.

## Evidence and agency contract

The application is designed around five operating rules:

1. **Observed and inferred are different.** Source-backed facts, derived
   metrics, model inference, and user judgment should remain distinguishable.
2. **Coverage is part of the result.** Missing evidence is visible product
   output, not an inconvenience to conceal.
3. **Provenance travels with the signal.** Consumers should be able to identify
   where an artifact or model output came from.
4. **Integrations fail closed.** Missing, disabled, malformed, or stale
   upstream outputs produce explicit unavailable states.
5. **The user retains agency.** TIBER may explain and compare; it does not
   silently execute fantasy decisions.

The human-decision boundary is documented in
[`docs/product/HUMAN_IN_THE_LOOP_DECISION_DOCTRINE.md`](docs/product/HUMAN_IN_THE_LOOP_DECISION_DOCTRINE.md).

## Repository architecture

TIBER-Fantasy is a TypeScript application with:

- a React 18 + Vite frontend in `client/`;
- an Express API and orchestration layer in `server/`;
- shared contracts and database types in `shared/`;
- PostgreSQL + Drizzle for application state;
- upstream adapters and artifact consumers in
  `server/modules/externalModels/`.

The repository still contains legacy and transitional model-like modules.
Current architecture direction keeps interfaces, orchestration, validation,
identity, and product presentation in TIBER-Fantasy while moving standalone
model ownership toward bounded producer repositories.

The in-repo FORGE implementation is therefore a transitional compatibility
layer. Historical standalone grading code is preserved in the archived
`TIBER-FORGE` repository. External comparison and parity paths in TIBER-Fantasy
are migration tools; their presence does not establish a live standalone service
or prove that every application surface has cut over.

See:

- [`ARCHITECTURE.md`](ARCHITECTURE.md) for agent and codebase navigation;
- [`CURRENT_PHASE.md`](CURRENT_PHASE.md) for the historical phase snapshot and current-direction pointers;
- [`AGENTS.md`](AGENTS.md) for repository operating instructions;
- [`docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md`](docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md)
  for the current core/legacy/extract classification.

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL

### Local setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

The development server uses port `5000` by default.

Configuration is integration-dependent. Start with
[`.env.example`](.env.example) and add only the variables required by the
surface you are running. Optional promoted-model integrations should render an
explicit disabled or unavailable state when they are not configured.

### Verified commands

```bash
npm run dev          # Express + Vite development server
npm run build        # Bundle the server entry point
sh build.sh           # Full SPA + API deployment-equivalent build
npm run start        # Run the built production entry point
npm run test         # Jest test suite
npm run typecheck    # TypeScript checking
npm run db:push      # Apply the current Drizzle schema
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply generated migrations
npm run db:studio    # Open Drizzle Studio
npm run test:forge   # Targeted legacy in-repo FORGE test
```

Additional operator, parity, and QA commands are defined in `package.json`.

</details>

## License

MIT
