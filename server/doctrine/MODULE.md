# Doctrine Evaluation Modules Notice

> [!WARNING]
> **Classification:** `EXTRACT`.
> **Work status:** Do not add net-new doctrine reasoning modules or expand these files into a larger in-repo intelligence stack.
> **Allowed changes:** Bug fixes, compatibility fixes, contract hardening, and extraction planning only.
> **Long-term destination:** Move doctrine reasoning behind an external service boundary and consume it from TIBER-Fantasy as a client, not as a permanent resident in core.
> **Dependency caveat:** These modules still consume live FORGE/FIRE-style signals and may power active evaluation flows, so contract stability matters during transition.
> **Repo-wide doctrine:** See `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` and `docs/architecture/LEGACY_MODULE_WORK_RULES.md`.

## Scope

This directory contains higher-order reasoning modules such as:

- `asset_insulation_model.ts`
- `league_market_model.ts`

## Operational rule

Use this area for transition support only until the doctrine layer lives outside the monorepo.
