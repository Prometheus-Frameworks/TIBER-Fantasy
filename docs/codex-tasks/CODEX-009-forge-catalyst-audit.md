# CODEX-009: FORGE ↔ CATALYST dependency audit

## Scope
- `server/modules/forge/forgeEngine.ts`

## Findings

1. **Where `catalyst_alpha` enters FORGE**
   - FORGE fetches `catalyst_alpha` via `fetchCatalystAlpha(playerId, season)` from `catalyst_scores`, using latest row by week (`ORDER BY week DESC LIMIT 1`).
   - The fetched value is blended directly into the **efficiency pillar** in `runForgeEngine`.

2. **Optional vs required**
   - The dependency is **optional** at runtime.
   - Blending only occurs when `catalystAlpha != null`; otherwise FORGE uses `baseEfficiency` unchanged.

3. **Behavior when CATALYST data is absent**
   - Missing rows return `null` and bypass blending.
   - Query failures are swallowed in `fetchCatalystAlpha` (`catch` returns `null`), also bypassing blending.
   - Net effect: FORGE runs in a **fail-open** mode with no CATALYST influence.

## Risk note
- Dependency is **active, not dead**: CATALYST currently affects offensive FORGE efficiency whenever a value exists.
- Impact magnitude is bounded by `CATALYST_WEIGHT = 0.125` (12.5% of the efficiency pillar blend).
- No weight changes were made in this task.
