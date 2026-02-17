# FORGE End-to-End Integration Tests — Codex Task Spec

**Created:** 2026-02-17
**Status:** Open — depends on data-quality-guardrails being deployed first (but can be built in parallel)
**Priority:** P1 — Prevents silent regressions in player rankings
**Assignee:** Codex

---

## Problem

FORGE bugs like "Josh Allen missing from top QBs" and "Baker Mayfield stability = 0" were only discovered via manual API checks. There are no automated tests that verify real players rank correctly. The existing test file (`server/modules/forge/__tests__/recursiveAlphaEngine.test.ts`) only tests the recursion math with mock data.

We need integration tests that hit the actual database and verify that specific well-known players produce sensible scores.

## Solution: `forgeIntegration.test.ts`

Create `server/modules/forge/__tests__/forgeIntegration.test.ts` with tests that:
1. Call the actual FORGE engine functions (not mocked)
2. Query the real database (these are read-only tests)
3. Assert on known players with predictable rankings
4. Run fast enough to include in CI (~30s total)

### Test Categories

#### 1. Sanity Checks (per position)

For each position (QB, RB, WR, TE), verify:
- Batch returns ≥ 10 players
- All alpha scores are in [0, 100]
- All pillar scores are in [0, 100]
- No pillar score is exactly 0.0 for any player with ≥ 10 games
- Tier assignments are valid strings (T1-T5)
- Results are sorted by alpha descending

```typescript
describe('FORGE Batch Sanity', () => {
  for (const position of ['QB', 'RB', 'WR', 'TE'] as const) {
    it(`${position} batch returns valid results`, async () => {
      const results = await runForgeEngineBatch(position, 2025, 'season', 20);
      expect(results.length).toBeGreaterThanOrEqual(10);
      for (const r of results) {
        const graded = gradeForgeWithMeta(r, { mode: 'redraft' });
        expect(graded.alpha).toBeGreaterThanOrEqual(0);
        expect(graded.alpha).toBeLessThanOrEqual(100);
        // No zero pillars for full-season starters
        if (r.gamesPlayed >= 10) {
          expect(r.pillars.stability).toBeGreaterThan(0);
        }
      }
    });
  }
});
```

#### 2. Pinned Player Assertions

These are the "Josh Allen is top-5 QB" style tests. They verify specific players rank where they should based on their 2025 season performance. These tests should be seasonal — they'll need updating each year, but they catch regressions within a season.

**QB Assertions (2025 season):**
- Josh Allen (`josh-allen`) appears in QB results and has alpha ≥ 60
- Josh Allen is in T1 or T2
- Dak Prescott (`dak-prescott`) has alpha ≥ 65
- No QB with ≥ 14 games has stability < 15

**RB Assertions (2025 season):**
- Saquon Barkley or Derrick Henry (elite bellcows) are in T1
- CMC has alpha ≥ 60
- Top RB alpha ≥ 80

**WR Assertions (2025 season):**
- Ja'Marr Chase or Amon-Ra St. Brown are in T1
- Top WR alpha ≥ 80

**TE Assertions (2025 season):**
- Travis Kelce or George Kittle appear in top 5
- Top TE alpha ≥ 75

```typescript
describe('FORGE Pinned Player Rankings', () => {
  it('Josh Allen is a top-tier QB', async () => {
    const results = await runForgeEngineBatch('QB', 2025, 'season', 40);
    const graded = results.map(r => gradeForgeWithMeta(r, { mode: 'redraft' }));
    const allen = graded.find(g => g.playerId === 'josh-allen');
    expect(allen).toBeDefined();
    expect(allen!.alpha).toBeGreaterThanOrEqual(60);
    expect(['T1', 'T2']).toContain(allen!.tier);
  });
});
```

#### 3. Cross-Position Consistency

- Top QB alpha should be within 20 points of top RB alpha (positions shouldn't have wildly different scales)
- No position should have 0 T1 players
- Each position should have at least 2 T1 players and at least 3 T5 players

#### 4. Mode Consistency

- Dynasty mode should rank the same players (±5 positions) — modes shift weights, not populations
- Bestball mode should produce valid results for all positions

#### 5. Stability Pillar Regression Guards

These specifically prevent the bugs we've already fixed:
- No player with ≥ 14 games should have stability = 0.0
- QB stability scores should have mean > 25 and max > 50 across all QBs
- RB stability scores should have mean > 20

### Test Infrastructure

**Database connection:** Import `db` from `../../infra/db` — the test should use the real database connection.

**Test runner:** Use the project's existing test runner (check `package.json` for `vitest` or `jest`). If none exists, use `vitest` and add to `package.json`.

**Timeout:** Set test timeout to 60s since batch computation involves many DB queries.

**Season constant:** Define `const TEST_SEASON = 2025;` at the top so it's easy to update yearly.

### Files to Create

| File | Action |
|------|--------|
| `server/modules/forge/__tests__/forgeIntegration.test.ts` | **CREATE** — All integration tests |

### How to Find Player IDs

Player IDs use the `canonical_id` format from `player_identity_map`:
```sql
SELECT canonical_id, full_name, position 
FROM player_identity_map 
WHERE full_name ILIKE '%Allen%' AND position = 'QB';
-- Result: josh-allen
```

Common format: `first-last` lowercase with hyphens. Examples:
- `josh-allen`, `dak-prescott`, `baker-mayfield`, `patrick-mahomes`
- `saquon-barkley`, `derrick-henry`, `bijan-robinson`
- `jamarr-chase`, `amon-ra-st-brown`, `ceedee-lamb`
- `travis-kelce`, `george-kittle`, `mark-andrews`

Verify actual IDs in the database before hardcoding — some names have non-obvious slugs.

### Validation Criteria

1. All tests pass against the current 2025 database
2. Tests complete in < 60 seconds total
3. Tests can be run with `npx vitest run server/modules/forge/__tests__/forgeIntegration.test.ts`
4. No tests require network access (database only)
5. Tests are clearly commented explaining WHY each assertion exists

---

## Post-Task Checklist

1. [ ] Integration test file created with all 5 test categories
2. [ ] All tests pass against current database
3. [ ] Josh Allen pinned test specifically passes
4. [ ] No-zero-stability regression test passes
5. [ ] Append to `.claude/context-log.md`
6. [ ] Update `.claude/agents/codex.md`
