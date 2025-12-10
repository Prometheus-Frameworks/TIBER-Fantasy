# TRACKSTAR Audit & Deprecation Plan

**Date:** November 30, 2025  
**Status:** AUDIT COMPLETE  
**Purpose:** Map all TRACKSTAR references and plan migration to internal FORGE SoS/Context module

---

## Executive Summary

TRACKSTAR (Offensive Architecture Scoring & Insight System) was originally conceived as an external API integration for team offensive environment data. The codebase now contains a mix of:
- **LEGACY_UNUSED**: Dead code, placeholders, and unused integrations
- **INTEGRATION_STUB**: Wired up but using baseline/fallback data (no real external API)
- **ACTIVE_DEPENDENCY**: Actually used in ranking pipelines via internal services

**Key Finding:** No external TRACKSTAR API is being called. All TRACKSTAR endpoints serve internally-generated baseline data. This makes migration to FORGE SoS/Context straightforward.

---

## Classification Summary

| Classification | Count | Action |
|---------------|-------|--------|
| LEGACY_UNUSED | 8 | Direct deletion |
| INTEGRATION_STUB | 12 | Convert to FORGE naming |
| ACTIVE_DEPENDENCY | 6 | Migrate to internal FORGE module |

---

## Detailed Audit

### LEGACY_UNUSED (Safe to Delete)

| File | Description | Notes |
|------|-------------|-------|
| `public/oasis.html` | Static HTML placeholder page | No references, unused |
| `server/oasisRServerClient.ts` | R server integration for nflfastR | Never called, spawns R processes that don't exist |
| `otc-power/src/data/sources/oasis.ts` | TIBER Power module TRACKSTAR fetcher | Uses fetch to non-existent `/api/oasis/` endpoints internally |
| `otc-power/src/data/loaders.ts` | References TRACKSTAR loader | Part of TIBER Power (unused module) |
| `otc-power/src/data/unifiedLoader.ts` | TRACKSTAR unified loader | Part of TIBER Power (unused module) |
| `otc-power/src/data/featureRegistry.ts` | TRACKSTAR feature registry entry | Part of TIBER Power (unused module) |
| `config/ovr.v1.json` | OVR config mentions TRACKSTAR | Comment only, safe to clean |
| `AUDIT.md`, `CHANGELOG.md`, `ENDPOINT_STATUS_REPORT.md` | Documentation references | Update to reflect FORGE replacement |

### INTEGRATION_STUB (Convert to FORGE naming)

| File | Description | Classification |
|------|-------------|----------------|
| `server/routes.ts` (lines 3055-3200) | `/api/oasis/*` endpoints | STUB: Serves baseline data, no external API |
| `server/services/oasisEnvironmentService.ts` | Team environment service | STUB: Calls internal `/api/oasis/environment` which returns baseline |
| `server/oasisContextualTeamMapping.ts` | Team context mapping for player evaluation | STUB: Framework only, uses placeholder tags |
| `src/data/providers/oasis.ts` | Matchup data provider | STUB: Falls back to neutral values on error |
| `src/data/normalizers/matchup.ts` | Matchup normalizer with TRACKSTAR fields | STUB: Uses `oasisMatchupScore` field name |
| `src/data/interfaces.ts` | `OasisMatchup` interface | STUB: Type definition only |
| `client/src/lib/apiClient.ts` | `oasisTeams()`, `oasisTeam()` methods | STUB: Client-side API helpers |
| `client/src/config/nav.ts` | Navigation entry for `/oasis` | STUB: Links to non-existent page |
| `client/src/components/HealthWidget.tsx` | Health check includes `oasis` | STUB: Part of health response |
| `client/src/components/ForgeTransparencyPanel.tsx` | Mentions "TRACKSTAR team environment" | STUB: UI text description |
| `server/analyticsInventory.ts` | Source type includes 'TRACKSTAR-API' | STUB: Enum value |
| `shared/startSit.ts` | TRACKSTAR type references | STUB: Type definitions |

### ACTIVE_DEPENDENCY (Migrate to FORGE)

| File | Description | Current Usage | Migration Path |
|------|-------------|---------------|----------------|
| `server/services/playerCompassService.ts` | Player Compass calculations | Uses `oasisEnvironmentService.getTeamEnvironment()` for EAST scores | Replace with `forgeEnvironmentService` |
| `server/modules/sos/oasisSosService.ts` | SOS projections using TRACKSTAR | Uses `oasisEnvironmentService` for defensive projections | Replace with FORGE SoS module |
| `server/modules/forge/context/contextFetcher.ts` | FORGE context fetching | Imports `OasisEnvironmentService` for team env | Replace with internal FORGE env |
| `server/modules/startSit/dataAssembler.ts` | Start/Sit data assembly | Uses `oasisMatchupScore` field | Rename to `forgeMatchupScore` |
| `server/modules/startSit/startSitAgent.ts` | Start/Sit AI agent | References `oasisScore`, `oasisMatchupScore` | Rename fields |
| `src/routes/startSitLiveRoutes.ts`, `startSitQuickRoutes.ts` | Start/Sit route handlers | Uses `oasis.__source`, `oasis.__mock` provenance | Update provenance naming |

---

## External API Status

**CRITICAL FINDING:** No external TRACKSTAR API is being called anywhere in the codebase.

- `/api/oasis/environment` endpoint in `server/routes.ts` calls `fetchTeamEnvIndex()` from `otc-power/src/data/sources/oasis.ts`
- That function returns hardcoded `getBaselineEnvironmentScores()` when fetch fails (which it always does since there's no external server)
- Result: All TRACKSTAR data is internally-generated baseline values

---

## Deprecation Plan

### Phase 1: Delete LEGACY_UNUSED ✅ COMPLETED (November 30, 2025)

**Files Deleted:**
- `public/oasis.html` - Static HTML placeholder
- `server/oasisRServerClient.ts` - Dead R server integration
- `otc-power/` - Entire unused TIBER Power module (including `src/data/sources/oasis.ts`)

**Routes Updated:**
- `server/routes.ts` - Removed dead imports, inlined baseline data for `/api/oasis/*` endpoints
- `/api/power/fpg/*` routes now return 410 deprecation notices

**No Breaking Changes:** All TRACKSTAR endpoints still work using inline baseline data.

### Phase 2: Rename INTEGRATION_STUB → FORGE

| Old Name | New Name |
|----------|----------|
| `oasisEnvironmentService` | `forgeEnvironmentService` |
| `OasisMatchup` | `ForgeMatchup` |
| `oasisMatchupScore` | `forgeMatchupScore` |
| `oasisTeams()` | `forgeTeams()` |
| `/api/oasis/*` | `/api/forge/team-context/*` |

### Phase 3: Migrate ACTIVE_DEPENDENCY

1. **PlayerCompassService**: Replace `oasisEnvironmentService.getTeamEnvironment()` with `forgeEnvironmentService` (already exists in `server/modules/forge/environmentService.ts`)

2. **OasisSosService**: Merge functionality into `server/modules/sos/sos.service.ts` using existing FORGE env/matchup data

3. **Start/Sit modules**: Update field names and provenance tracking to use FORGE naming

4. **FORGE contextFetcher**: Already uses internal env data - just rename import

---

## Interface Requirements (What TRACKSTAR Provided)

For complete migration, FORGE SoS/Context module must provide:

### Team Environment Data
```typescript
interface ForgeTeamEnvironment {
  team: string;
  environment_score: number;     // 0-100 offensive environment
  pace: number;                  // Plays per game
  proe: number;                  // Pass rate over expected
  ol_grade: number;              // Offensive line grade
  qb_stability: number;          // QB situation stability
  red_zone_efficiency: number;   // Red zone scoring rate
  scoring_environment: number;   // Overall scoring context
}
```

### Matchup Data
```typescript
interface ForgeMatchup {
  defRankVsPos: number;          // 1-32 defensive rank vs position
  matchupScore: number;          // 0-100 matchup favorability
  olHealthIndex: number;         // O-line health/grade
}
```

**Good News:** These interfaces already exist in `forge_team_env_context` and `forge_team_matchup_context` database tables!

---

## TODO Comments to Add

After audit, add these TODO comments to key files:

```typescript
// TODO: Replace TRACKSTAR with internal FORGE SoS module
// See: docs/oasis_audit.md for migration plan
```

Files requiring TODO:
- `server/services/playerCompassService.ts`
- `server/services/oasisEnvironmentService.ts`
- `server/modules/sos/oasisSosService.ts`
- `src/data/providers/oasis.ts`

---

## Conclusion

TRACKSTAR is effectively a placeholder/stub system that:
1. Was designed for external API integration that never materialized
2. Falls back to internally-generated baseline data
3. Can be fully replaced by existing FORGE env/matchup infrastructure

The migration is low-risk because:
- No external dependencies to break
- All data is already internal
- FORGE tables (`forge_team_env_context`, `forge_team_matchup_context`) already provide the required data

**Recommended Timeline:**
- Phase 1 (Delete): Immediate
- Phase 2 (Rename): 1-2 days
- Phase 3 (Migrate): 3-5 days
- Retire TRACKSTAR naming: Complete within 1 week
