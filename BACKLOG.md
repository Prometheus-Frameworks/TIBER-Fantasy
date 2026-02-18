# BACKLOG (PARKING LOT)

Rule: If it is not in CURRENT_PHASE, it goes here.

## Phase 2 — Expansion Candidates
- IDP Lab (Havoc Index + Defensive DNA)
  - Why: Extends analytics to defensive players for IDP league managers
  - Requires: New data pipeline for defensive play-by-play, new schema tables, new frontend module
  - Risks: Significant scope increase; defensive data sources less standardized than offensive
- Offensive DNA (OC coaching shift + EPA/play projection layer)
  - Why: Captures coaching scheme changes and their impact on player usage/efficiency
  - Requires: Historical coaching data, scheme classification system, EPA projection model
  - Risks: Coaching data is sparse and subjective; projection models need validation
- World Model (Player trait vectors, embeddings-like representations)
  - Why: Enables similarity-based player comparisons and archetype clustering
  - Requires: pgvector extension (already installed), embedding generation pipeline, trait taxonomy
  - Risks: Trait definitions are subjective; embedding quality depends on input feature selection
- Rookie Scanner (2026 rookie data ingestion)
  - Why: Dynasty leagues need rookie evaluation before NFL draft
  - Requires: College stats pipeline, combine data ingestion, draft capital mapping
  - Risks: College-to-NFL translation is unreliable; data availability varies by source

## Phase 3 — Automation / Community
- X notification workflow (draft-only; no auto-post)
- Email draft workflow (draft-only; no auto-send)
- Contribution guidelines + issue templates + release cadence
