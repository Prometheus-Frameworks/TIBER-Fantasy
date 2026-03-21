# Start/Sit Engine

> [!WARNING]
> **Classification:** `EXTRACT`.
> **Work status:** Do not add net-new recommendation logic or broaden this engine's scope inside core.
> **Allowed changes:** Bug fixes, compatibility work, contract hardening, and migration support only.
> **Long-term destination:** Freeze outputs, then move the recommendation engine behind an external service boundary consumed through core adapters.
> **Dependency caveat:** This module still assembles live TIBER inputs and may remain operational until an external replacement is ready.
> **Repo-wide doctrine:** See `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` and `docs/architecture/LEGACY_MODULE_WORK_RULES.md`.

Assembles player data from multiple TIBER systems and produces start/sit verdicts with factor breakdowns, projections, and confidence levels.

## Files

| File | Purpose |
|------|---------|
| `dataAssembler.ts` | `buildStartSitPlayerProfile()` — gathers player data from weekly stats, FORGE, SoS, injury reports, and projections into a unified input |
| `startSitAgent.ts` | `StartSitAgent` class — bridges data assembler to API routes. Handles single analysis and multi-player comparison |
| `testDataAssembler.ts` | Mock data generators for development/testing |

## How It Works

### Single Player Analysis
```
1. dataAssembler.ts  → Fetch player stats, FORGE data, SoS, injury status, projections
                        Output: { playerInput, dataAvailability }
2. startSitEngine    → Score player across factors (usage, matchup, volatility)
                        Output: { total, usage, matchup, volatility }
3. startSitAgent.ts  → Transform to StartSitPlayerProfile with factor breakdown
                        Generate verdict (START/SIT/FLEX/BENCH) with tier and confidence
```

### Multi-Player Comparison
```
1. Build profiles for all players in parallel
2. Sort by normalized score (highest first)
3. Generate verdicts with ranking context ("Ranks 1 of 3")
```

### Verdict Tiers

| Score | Verdict | Tier | Confidence |
|-------|---------|------|------------|
| ≥80 | START | SMASH | HIGH |
| ≥65 | START | STARTABLE | MEDIUM |
| ≥50 | FLEX | MATCHUP_DEPENDENT | MEDIUM |
| ≥35 | SIT | DESPERATION | LOW |
| <35 | BENCH | AVOID | LOW |

### Factor Breakdown

Each verdict includes scored factors:
- **Usage & Opportunity** (weight: 0.25) — target share, snap %
- **Matchup Quality** (weight: 0.25) — defense rank vs position, OASIS score
- **Health & Volatility** (weight: 0.10) — injury status

Factors are tagged as `boost`, `neutral`, or `downgrade` based on score thresholds (≥65/≥45).

## Dependencies

- `server/modules/startSitEngine.ts` — scoring engine with `scorePlayer()` and `startSit()`
- `shared/startSit.ts` — shared types (`StartSitPlayerProfile`, `StartSitVerdict`, etc.)
- `server/routes/startSitRoutes.ts` — API route definitions
