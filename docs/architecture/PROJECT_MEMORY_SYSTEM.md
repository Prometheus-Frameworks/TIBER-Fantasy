# Project Memory System

**Status:** Seed file
**Purpose:** Preserve durable project intent, reduce context loss, and give future contributors (including future-us) a stable summary of what TIBER is trying to become.

---

## Why this file exists

TIBER was built in an early frontier-AI style: fast iteration, heavy prompting, cross-repo experimentation, and a lot of work done before stable norms for agent-assisted software development fully existed.

That was useful early, but it created a carrying cost:
- intent often lives in chat instead of the repo,
- important decisions can be scattered across PRs and threads,
- the project can outgrow the builder's internal map,
- and progress can feel diffuse even when real structure is forming.

This file exists to fight that problem directly.

The goal is simple: **TIBER needs a project-memory system, not just a codebase.**

---

## Current high-level understanding

TIBER is no longer just a fantasy football app experiment.
It is becoming an **open football intelligence ecosystem** with:
- a visible product shell,
- stable contracts,
- external model boundaries,
- promoted read-only labs,
- and canonical decision surfaces for humans and agents.

`TIBER-Fantasy` should serve as the **product shell and orchestration core**.
When practical, standalone model brains should live outside this repo and connect through stable adapters, promoted artifacts, or explicit service contracts.

This shift matters because the project is maturing from:
- vibe-coded exploratory building,
- toward structured architecture,
- and eventually toward a legitimate ecosystem.

---

## What this conversation clarified

### 1) TIBER has been doing harder work than it looks like from the outside
A lot of comparable public projects are narrow, legible, and easy to demo.
TIBER has spent much of its time on harder substrate work:
- repo boundaries,
- contract thinking,
- identity and data plumbing,
- external model handoffs,
- product-shell cleanup,
- and canonical route definition.

That means slower visible payoff, but not fake progress.

### 2) The missing piece is one undeniable public artifact
The system has gained structure, but it still needs a **single canonical, visible, clearly working proof point**.

The current strongest candidate is:
- **rebuilding FORGE** and
- **displaying a unified rankings surface through TIBER**.

This should become the first artifact that makes the broader system feel real.

### 3) The builder's strength is AI coordination, not low-level code fluency
A key insight from this conversation:
- strong at prompting,
- strong at carrying intent across models,
- strong at keeping multiple AIs aligned over time,
- weaker at deep code reading,
- weaker at preserving internal context once the project sprawls.

That is not a failure state. It means TIBER needs better externalized memory and a better map of itself.

### 4) TIBER needs doctrine and memory, not just more code
The next maturity layer is not just additional features.
It is codifying:
- what TIBER is,
- what belongs in this repo,
- what belongs upstream,
- what makes a module legitimate,
- and how future contributors can understand the system quickly.

---

## Immediate strategic direction

### Primary focus
Build one canonical, visible artifact that proves the system works.

Current target:
- **FORGE rebuild + unified rankings surface**

Success criteria for that artifact:
1. one canonical rankings route exists,
2. it clearly reflects rebuilt FORGE logic,
3. a user can understand why a player is where he is,
4. the surface feels stable enough to show without embarrassment.

### Secondary focus
Preserve project context in-repo so future work is not forced to reconstruct intent from memory or scattered chat threads.

This file is the start of that effort.

---

## Ecosystem direction to revisit later

TIBER should continue moving toward a formal ecosystem with:
- a documented doctrine,
- promoted-module standards,
- build-on-TIBER surfaces,
- contribution lanes,
- and clear canonical vs legacy vs experimental labeling.

Candidate future docs:
- `docs/architecture/TIBER_ECOSYSTEM_DOCTRINE_V0_1.md`
- `docs/architecture/PROMOTED_MODULE_STANDARD.md`
- `docs/architecture/BUILD_ON_TIBER.md`

These are not the highest-priority build right now, but they are legitimate next-layer structure once the unified FORGE/rankings artifact is real.

---

## Working rule for future updates to this file

When meaningful project understanding changes, update this file with:
1. what changed,
2. why it matters,
3. what remains unresolved,
4. and what future-us should not forget.

This file is not meant to be exhaustive repo documentation.
It is meant to preserve **orientation**.

---

## Bottom line

TIBER began in a frontier, beta-user phase of AI-assisted building.
That phase was messy but historically meaningful and practically necessary.

Now the project is entering a more legitimate structural phase.
The path forward is:
- narrow the public proof point,
- preserve intent in the repo,
- and keep turning instinct into repeatable architecture.

That is the job.
