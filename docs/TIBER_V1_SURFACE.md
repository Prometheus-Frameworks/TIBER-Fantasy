# TIBER v1 – Product Surface Specification

**Audience:** Codex, future contributors, and future Joe  
**Purpose:** Define exactly what TIBER v1 must deliver to be considered a "real product."  
**Status:** Living document (update as features land)

---

## 1. Overview

TIBER v1 is a fantasy football analytics platform powered by the FORGE engine.

The goal is to deliver:
- Stable, consistent fantasy rankings
- A clean data exploration lab
- A simple draft value tool
- Reliable Sleeper roster syncing

v1 is about clarity, stability, and usefulness — not bells and whistles.

---

## 2. Core Surfaces (v1-Critical)

These are the screens/features a real user must be able to access and use without bugs or confusion.

### 2.1 — TIBER Tiers (Rankings Hub)

**Purpose:** Provide fantasy rankings powered by FORGE.

**Modes:**
- Redraft
- Dynasty
- .5 PPR
- Full PPR

**UI Requirements:**
- Position filters (QB/RB/WR/TE)
- Format toggle (dynasty/redraft)
- Scoring toggle (.5 / PPR)
- Player rows with:
  - Name
  - Team
  - Position
  - FORGE Score
  - Tiber Tier
  - Mover tag (+↑ / ↓ / —)

**Backend Dependencies:**
- `/api/forge/score` or batch scoring endpoint
- Enriched weekly data tables
- Tier mapping function

---

### 2.2 — TIBER Data Lab

**Purpose:** Provide a sortable, filterable view of all enriched metrics.

**Features (v1 must-have):**
- Table view of players with enriched stats
- Week selector (1–17 + Season view)
- Position filter
- Sort by any metric (EPA, YPRR, WOPR, etc.)

**Not required for v1:**
- Charts
- Comparisons
- Exporting
- Multi-player selection
- Visualization

**Backend Dependencies:**
- Enriched snapshot tables
- A clean `/api/datalab/players` endpoint
- Metric dictionary (field → label map)

---

### 2.3 — Dynasty Startup Draft Room (v1 Light)

**Purpose:** Provide value-based draft insights.

**v1 Features:**
- Consensus ADP imported (startup SF)
- FORGE score merge
- Value edge calculation:
  - Edge = FORGE Rank – ADP Rank
- Table with:
  - Name
  - ADP
  - TIBER tier
  - Value edge
  - Position, team

**Optional v1.5 features (not needed now):**
- Live pick tracking
- Board visualization
- Notes / color tags
- Tier buckets union

**Backend Dependencies:**
- `startup_adp_consensus` table
- Batch FORGE scoring
- `/api/draftroom/valueboard` endpoint

---

### 2.4 — Sleeper Sync Dashboard

**Purpose:** Show a user their roster through the TIBER lens.

**v1 Requirements:**
- User pastes Sleeper league ID
- Fetch roster → map to player IDs
- Display:
  - Player name
  - Team
  - Tiber Tier
  - FORGE score
  - Position

**Backend Dependencies:**
- `/api/sync/sleeper`
- FORGE batch scoring
- Player identity mapping

**Notes:**
This is one of the most "fun" features. Keep it simple, stable, and fast.

---

## 3. Non-Critical (Nice-to-Haves, Not v1 Blocks)

List of things explicitly **not required** for launch:
- TIBER Voice (v1.5 or v2)
- Detailed player write-ups
- Matchup heat maps
- Trade Evaluator (future module)
- Team pages
- TIBER chart visuals
- Playbook / journal full integration
- Profile accounts
- Notifications
- Mobile app wrappers
- Historical seasons beyond 2025

This protects v1 scope.

---

## 4. Backend Responsibilities

TIBER v1 backend must deliver:
1. Stable FORGE engine
2. Clean, enriched data source usage (no legacy tables)
3. Standardized API routes
4. Input validation (weeks, formats, scoring)
5. Error-safe responses (no crashes or undefineds)

If FORGE returns a score, it should always be:
- within known bounds
- non-NaN
- consistent week-to-week
- logged on error

---

## 5. Frontend Responsibilities

Frontend must deliver:
1. Load without errors (no 500s, no silent failures)
2. Clear and simple UI
3. Fast player search
4. Table interaction that feels smooth
5. A "fantasy sicko but human-friendly" vibe
6. Dark mode aesthetic but not overly edgy

TIBER should feel like:

> "Your smart fantasy football friend, not a corporate tool."

---

## 6. v1 Acceptance Criteria (Launch Checklist)

TIBER v1 is ready when:
- [ ] Rankings page loads with real data
- [ ] Data Lab loads enriched weekly snapshots
- [ ] Draft Room value board loads ADP + FORGE
- [ ] Sleeper sync works with real leagues
- [ ] No console errors or server exceptions
- [ ] No legacy tables in live use
- [ ] FORGE scores are stable and sane
- [ ] Error messages are clean
- [ ] A brand new user can understand the app in 60 seconds
- [ ] Codex cleanup tasks 0–3 are complete

---

## 7. Philosophy (keep it simple)

TIBER v1 exists to:
- prove the engine works
- give fantasy players something usable
- let you build fast and clean
- set a foundation for bigger ideas (voice, trade evaluator, playbook)

Nothing more.
Nothing less.
