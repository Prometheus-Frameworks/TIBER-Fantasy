# DB SPEC — forge_grade_cache

## Table Definition (Drizzle ORM)

Add to `shared/schema.ts`:

```typescript
export const forgeGradeCache = pgTable("forge_grade_cache", {
  id: serial("id").primaryKey(),
  
  // Player identity
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  position: text("position").notNull(),
  nflTeam: text("nfl_team"),
  
  // Scope
  season: integer("season").notNull(),
  asOfWeek: integer("as_of_week").notNull(),
  
  // FORGE Alpha scores
  alpha: real("alpha").notNull(),
  rawAlpha: real("raw_alpha"),
  volumeScore: real("volume_score"),
  efficiencyScore: real("efficiency_score"),
  teamContextScore: real("team_context_score"),
  stabilityScore: real("stability_score"),
  dynastyContext: real("dynasty_context"),
  
  // Tier (mapped from ForgeGradeResult: result.tier → tier, result.tierPosition → tierNumeric)
  tier: text("tier").notNull(),           // 'T1' | 'T2' | 'T3' | 'T4' | 'T5'
  tierNumeric: integer("tier_numeric").notNull(), // 1-5 (from gradeForge().tierPosition)
  
  // Football Lens
  footballLensIssues: text("football_lens_issues").array(),
  lensAdjustment: real("lens_adjustment").default(0),
  
  // Metadata
  confidence: real("confidence"),
  trajectory: text("trajectory"),
  gamesPlayed: integer("games_played"),
  
  // Fantasy stats for display
  ppgPpr: real("ppg_ppr"),
  seasonFptsPpr: real("season_fpts_ppr"),
  targets: integer("targets"),
  touches: integer("touches"),
  
  // Cache management
  computedAt: timestamp("computed_at").defaultNow(),
  version: text("version").default("v1"),
}, (table) => ({
  uniqueGrade: unique("forge_grade_cache_unique").on(
    table.playerId, table.season, table.asOfWeek, table.version
  ),
  positionQuery: index("forge_grade_cache_pos_idx").on(
    table.season, table.asOfWeek, table.position
  ),
  playerIdx: index("forge_grade_cache_player_idx").on(table.playerId),
  alphaSort: index("forge_grade_cache_alpha_idx").on(
    table.season, table.asOfWeek, table.position, table.alpha
  ),
}));

export type ForgeGradeCache = typeof forgeGradeCache.$inferSelect;
export type InsertForgeGradeCache = typeof forgeGradeCache.$inferInsert;
```

## Primary Query (Tiers Page)

```sql
SELECT *
FROM forge_grade_cache
WHERE season = $1
  AND as_of_week = $2
  AND position = $3
  AND version = 'v1'
ORDER BY alpha DESC
LIMIT $4;
```

Expected: < 10ms with index. Returns pre-sorted rows.

For "ALL" positions:

```sql
SELECT *
FROM forge_grade_cache
WHERE season = $1
  AND as_of_week = $2
  AND version = 'v1'
ORDER BY position, alpha DESC
LIMIT $4;
```

## Upsert Query (Cache Write)

```sql
INSERT INTO forge_grade_cache (
  player_id, player_name, position, nfl_team,
  season, as_of_week,
  alpha, raw_alpha, volume_score, efficiency_score,
  team_context_score, stability_score, dynasty_context,
  tier, tier_numeric,
  football_lens_issues, lens_adjustment,
  confidence, trajectory, games_played,
  ppg_ppr, season_fpts_ppr, targets, touches,
  computed_at, version
) VALUES (...)
ON CONFLICT (player_id, season, as_of_week, version)
DO UPDATE SET
  alpha = EXCLUDED.alpha,
  raw_alpha = EXCLUDED.raw_alpha,
  /* ... all columns ... */
  computed_at = NOW();
```

## Existing Tables Referenced

These tables are READ-ONLY inputs to the FORGE engine:

| Table | Used For |
|-------|----------|
| `wr_role_bank` | WR role metrics, volume/efficiency scores |
| `rb_role_bank` | RB role metrics |
| `te_role_bank` | TE role metrics |
| `qb_role_bank` | QB role metrics, also used for dynasty QB context |
| `team_offensive_context` | Team EPA, CPOE, run success rate |
| `sos_scores` | Strength of schedule by team/position |
| `player_identity_map` | Canonical ID ↔ GSIS/sleeper ID resolution |
| `weekly_stats` | Games played, team, player name |
| `forge_player_state` | Recursion state (prior alpha, momentum, volatility) |
| `datadive_snapshot_player_week` | Raw weekly stats for fantasy stat enrichment |
| `datadive_snapshot_meta` | Snapshot metadata (season/week/official flag) |

## Migration Command

After adding the schema to `shared/schema.ts`:

```bash
npm run db:push
```

If data-loss warning appears (it shouldn't for a new table):
```bash
npm run db:push --force
```
