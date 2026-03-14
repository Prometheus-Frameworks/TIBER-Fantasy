# Tiber Matrix Module

## Purpose
Defines the canonical offensive deployment role ontology for QB/RB/WR/TE and deterministic assignment utilities.

## Core Files
- `roleOntology.ts` — Static v1 role dictionary (canonical role IDs only).
- `assignRoleFromUsage.ts` — Rules-based role assignment with explainable reasoning.
- `teamRoleMapBuilder.ts` — Team+season grouping utility for assignment outputs.

## Inputs
- `NormalizedUsageInput` from `shared/types/roleOntology.ts`.

## Outputs
- `PlayerRoleAssignment` and `TeamSeasonRoleMap` from `shared/types/playerRoleAssignment.ts`.

## Notes
- No LLM dependency.
- Missing usage data falls back to position-level default roles with low confidence/volatile stability.
- Threshold values are centralized and exported as `TIBER_MATRIX_ROLE_THRESHOLDS` for versioned tuning.
