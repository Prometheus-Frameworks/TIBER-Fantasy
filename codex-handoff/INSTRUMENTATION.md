# INSTRUMENTATION — Timing, Logging, and Metrics

## 1. Computation Timing

### Per-Player Timing
In `forgeGradeCache.ts`, wrap each player's computation:

```typescript
const playerStart = Date.now();
// ... runForgeEngine + lens + grading ...
const playerMs = Date.now() - playerStart;
console.log(`[ForgeGradeCache] ${playerName} (${position}): ${alpha.toFixed(1)} alpha in ${playerMs}ms`);
```

### Per-Position Batch Timing
```typescript
const posStart = Date.now();
// ... loop all players for position ...
const posMs = Date.now() - posStart;
console.log(`[ForgeGradeCache] ${position} batch: ${count} players in ${posMs}ms (avg ${(posMs/count).toFixed(0)}ms/player)`);
```

### Total Job Timing
```typescript
const jobStart = Date.now();
// ... all positions ...
const totalMs = Date.now() - jobStart;
console.log(`[ForgeGradeCache] Full computation: ${totalPlayers} players in ${totalMs}ms`);
```

### Expected Benchmarks
| Phase | Expected | Alert If |
|-------|----------|----------|
| Per-player engine | 200-500ms | > 1000ms |
| WR batch (65 players) | 15-30s | > 60s |
| RB batch (50 players) | 10-25s | > 50s |
| QB batch (32 players) | 7-15s | > 30s |
| TE batch (30 players) | 6-15s | > 30s |
| Full job (all positions) | 40-90s | > 180s |
| Cache read (GET /tiers) | < 10ms | > 100ms |

## 2. Phase-Level Breakdown

For debugging slow computations, log sub-phases within each player:

```typescript
// Inside the per-player loop
const t0 = Date.now();
const engineOutput = await runForgeEngine(playerId, position, season, 'season');
const t1 = Date.now();

const lensResult = applyFootballLens(engineOutput);
const t2 = Date.now();

const gradingResult = applyGrading(lensResult, position);
const t3 = Date.now();

const fantasyStats = await fetchFantasyStats(playerId, season);
const t4 = Date.now();

await upsertGrade(gradeData);
const t5 = Date.now();

if ((t5 - t0) > 1000) {
  console.warn(`[ForgeGradeCache] SLOW player ${playerName}: engine=${t1-t0}ms lens=${t2-t1}ms grading=${t3-t2}ms stats=${t4-t3}ms write=${t5-t4}ms total=${t5-t0}ms`);
}
```

## 3. Cache Read Logging

For the GET endpoint:

```typescript
const readStart = Date.now();
const results = await getGradesFromCache(season, asOfWeek, position);
const readMs = Date.now() - readStart;
console.log(`[ForgeGradeCache] Read ${results.length} grades for ${position} in ${readMs}ms`);
```

## 4. Error Logging

```typescript
// Computation errors (non-fatal, skip player)
console.error(`[ForgeGradeCache] ERROR computing ${playerName} (${playerId}):`, error.message);
errors.push({ playerId, playerName, error: error.message });

// DB errors (potentially fatal)
console.error(`[ForgeGradeCache] DB ERROR upserting grade:`, error);
```

## 5. Cache Freshness Check

The GET endpoint should log cache age:

```typescript
if (results.length > 0) {
  const newestComputed = new Date(results[0].computedAt);
  const ageMinutes = (Date.now() - newestComputed.getTime()) / 60000;
  if (ageMinutes > 1440) { // older than 24 hours
    console.warn(`[ForgeGradeCache] Cache is ${ageMinutes.toFixed(0)} minutes old for ${position} week ${asOfWeek}`);
  }
}
```

## 6. Sanity Warnings

After computing grades, check for obvious issues:

```typescript
// WTF detection
const t1Players = results.filter(p => p.tierNumeric === 1);
if (t1Players.length === 0) {
  console.warn(`[ForgeGradeCache] WTF: No T1 players for ${position}!`);
}
if (t1Players.length > 10) {
  console.warn(`[ForgeGradeCache] WTF: ${t1Players.length} T1 players for ${position} — threshold may be too loose`);
}

const maxAlpha = Math.max(...results.map(r => r.alpha));
const minAlpha = Math.min(...results.map(r => r.alpha));
if (maxAlpha - minAlpha < 20) {
  console.warn(`[ForgeGradeCache] WTF: Alpha spread only ${(maxAlpha - minAlpha).toFixed(1)} — possible compression`);
}
```
