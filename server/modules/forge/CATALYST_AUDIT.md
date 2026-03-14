# FORGE ↔ CATALYST Dependency Audit

## Where `catalyst_alpha` enters FORGE

`forgeEngine.ts` fetches CATALYST data in `fetchCatalystAlpha(playerId, season)` and reads the latest `catalyst_alpha` from `catalyst_scores` for the player/season. That value is then blended into the player efficiency model inside `computeEpaContextSignals(...)`.

## Optional vs required

The dependency is **optional**. If no CATALYST row is found (or lookup fails), `fetchCatalystAlpha` returns `null` and FORGE falls back to base efficiency signals.

## Behavior when CATALYST is absent

When absent, `blendedEfficiency` remains equal to `baseEfficiency`; the CATALYST weight is only applied when a non-null `catalyst_alpha` is available.

## Risk note

This is an active dependency (not dead code): CATALYST can materially alter efficiency inputs whenever data is present.
