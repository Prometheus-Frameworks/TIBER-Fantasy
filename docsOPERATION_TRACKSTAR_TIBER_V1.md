# OPERATION TRACKSTAR – TIBER v1

This file is the source of truth for structural cleanup and stabilization tasks for TIBER-Fantasy.

**Audience:** Codex + future devs  
**Goal:** Make TIBER stable, organized, and ready for real users without changing core behavior.

---

## How Codex should use this file

For each task below:

1. Work on **one task at a time**.
2. Create or update files as needed.
3. Run the relevant tests (e.g. `npm test`, `npm run test:forge`, or whatever is configured).
4. Open a pull request targeting `main` with a clear title:

   - `[Codex] Operation TRACKSTAR – Task X: <short description>`

5. Do **not** change business logic unless the task explicitly asks for it.  
   If a behavior change is unavoidable, call it out clearly in the PR description.

---

## ✅ Phase 0 – FORGE Documentation & Mapping

These are the docs describing how FORGE works internally.

- [x] **Task 0.1 – FORGE System Map**
  - File: `docs/FORGE_SYSTEM_MAP.md`
  - Status: **DONE** (already generated and merged)
  - Description: High-level architecture of FORGE, E→F→O→R→G pipeline, key modules and data flow.

- [ ] **Task 0.2 – FORGE Dependency Map**
  - Goal: Describe how all FORGE-related modules depend on each other.
  - Output file: `docs/FORGE_DEPENDENCY_MAP.md`
  - Requirements:
    - Use `docs/FORGE_SYSTEM_MAP.md` and the actual code to:
      - List each FORGE module and its direct dependencies.
      - Highlight **core nodes** (modules many others depend on).
      - Highlight **unused or suspiciously isolated** modules.
      - Highlight any **circular dependencies**.
    - Include at least one Markdown diagram/tree showing module relationships.

---

## 🧭 Phase 1 – API Routes & Structure

Clean up and standardize the API surface for TIBER.

- [ ] **Task 1.1 – API Inventory & Grouping Proposal**
  - Goal: Document all existing API routes and propose a clean grouping.
  - Output file: `docs/API_ROUTE_MAP.md`
  - Requirements:
    - List every route, its HTTP method, and purpose.
    - Group routes by concern (examples, adjust to actual code):
      - `/api/forge`
      - `/api/datalab`
      - `/api/draftroom`
      - `/api/sync` (Sleeper, etc.)
      - `/api/admin`
      - `/api/utils`
    - For each route:
      - Note the current file path.
      - Suggest the ideal file path under a clean, organized structure.

- [ ] **Task 1.2 – API Refactor to Proposed Structure**
  - Goal: Implement the new routing structure without changing behavior.
  - Requirements:
    - Create new route/controller files as proposed in `API_ROUTE_MAP.md`.
    - Move logic into those files and update imports.
    - Preserve current behavior and responses.
    - Mark legacy/old routes as deprecated or delete them **only if clearly unused**.
    - Update any central router/index to use the new structure.
    - Run tests after refactor.

---

## 🗺️ Phase 2 – Database Interaction Map

Understand and document how TIBER talks to Postgres.

- [ ] **Task 2.1 – DB Table Usage Map**
  - Output file: `docs/DB_TABLE_USAGE.md`
  - Requirements:
    - List every table that appears in queries, migrations, or models.
    - For each table:
      - Short purpose description.
      - Files that **read** from it.
      - Files that **write** to it.
      - Any tests touching it.
    - Explicitly call out “core” tables (enriched weekly snapshots, context tables, etc.).
    - Flag tables that appear:
      - unused,
      - overlapping/duplicate in purpose,
      - legacy (e.g. raw stats replaced by enriched).

---

## 🧼 Phase 3 – Data Source Cleanup (Legacy vs Enriched)

Make sure FORGE, Draft Room, and Data Lab all pull from the **correct** data sources.

- [ ] **Task 3.1 – Legacy Data Source Audit**
  - Output file: `docs/DATA_SOURCE_AUDIT.md`
  - Requirements:
    - Scan for any code that:
      - reads from raw/legacy stats tables,
      - reads from old snapshot tables,
      - uses temporary JSON fixtures/mock data.
    - For each occurrence:
      - File + function name.
      - Current data source.
      - Recommended enriched/official source to use instead.
    - Split results into two sections:
      - **“Safe to refactor now”**
      - **“Probably legacy / needs manual review”**

- [ ] **Task 3.2 – Refactor to Enriched Data Sources**
  - Goal: Update key code paths to use enriched data only, where safe.
  - Requirements:
    - For items marked “Safe to refactor now” in `DATA_SOURCE_AUDIT.md`:
      - Update functions to use the enriched / canonical tables.
      - Keep old code in comments where useful.
      - Do not change external API shape (same inputs/outputs).
    - Prioritize:
      - FORGE pipeline
      - Draft Room / value board
      - Data Lab views
    - Run tests after each refactor.

---

## 🧪 Phase 4 – Testing & Safety Nets

Make FORGE and TIBER less fragile.

- [ ] **Task 4.1 – Expand FORGE Test Coverage**
  - Goal: Add automated tests for critical FORGE flows.
  - Requirements:
    - Add tests for:
      - Single-player scoring (happy path).
      - Handling missing/partial data (fallbacks).
      - Recursion staying within allowed modifier bounds.
      - SoS enrichment not pushing scores out of safe ranges.
    - Use the existing `test:forge` setup and extend where appropriate.
    - Tests should be **fast** and not require full DB fixtures if possible.

- [ ] **Task 4.2 – Basic Input Validation & Error Handling**
  - Goal: Prevent bad inputs and hide ugly crashes from end users.
  - Requirements:
    - Add centralized error handling for API routes (if not present).
    - Add basic validation on endpoints (week, format, position, etc.).
    - When validation fails:
      - Return a clear error response (e.g., 400 with a helpful JSON message).
    - Log errors in a consistent place for later inspection.

---

## 📊 Phase 5 – Documentation for Future Work

Make it easy for future you (and future contributors) to understand TIBER.

- [ ] **Task 5.1 – “How to Extend FORGE” Guide**
  - Output file: `docs/FORGE_EXTENSIBILITY_GUIDE.md`
  - Requirements:
    - Explain in plain language:
      - How to add a new feature/metric.
      - How to plug a new metric into the scoring.
      - How to add a new modifier.
    - Reference `FORGE_SYSTEM_MAP.md` and `FORGE_DEPENDENCY_MAP.md`.
    - Include at least one end-to-end example:
      - e.g., adding a new WR metric and seeing it affect scores.

- [ ] **Task 5.2 – “TIBER v1 Surface” Overview**
  - Output file: `docs/TIBER_V1_SURFACE.md`
  - Requirements:
    - Describe the v1 product surface:
      - Tiber Tiers (redraft/dynasty, formats).
      - Data Lab.
      - Draft Room / Playbook basics.
      - Sleeper sync.
    - For each surface:
      - Which endpoints it depends on.
      - Which tables it reads from.
      - What parts are considered v1-critical.

---