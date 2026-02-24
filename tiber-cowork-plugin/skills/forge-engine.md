# FORGE Engine — Football-Oriented Recursive Grading Engine

## What FORGE Is

FORGE is TIBER's core player evaluation system. It produces Alpha scores (0–100) for NFL skill positions (QB, RB, WR, TE) by computing four pillar scores, applying position-specific weights, and running a recursive pass to smooth volatility.

FORGE does NOT evaluate kickers, defense/special teams, or IDP positions (IDP uses a separate module).

## The FORGE Acronym (E+G Architecture)

- **F** — Football Lens (`forgeFootballLens.ts`): Detects football-sense issues before scoring. Flags TD spikes, volume/efficiency mismatches, and suspicious patterns. Severity levels: info, warn, block.
- **O** — Orientation: ViewMode support for redraft, dynasty, bestball. Each mode applies different pillar weight profiles.
- **R** — Recursion (`recursiveAlphaEngine.ts`): Two-pass scoring blends current Alpha with prior history (80% current / 20% prior) plus ±3 momentum adjustment. Smooths outlier weeks.
- **G** — Grading (`forgeGrading.ts`): Position-specific pillar weights produce baseAlpha → recursionBias → tier assignment (T1–T5).
- **E** — Engine (`forgeEngine.ts`): The data layer. Fetches context from DB (snapshots, role banks, team context, SoS), builds metric lookups, computes the four pillar scores.

## The Four Pillars

| Pillar | What It Measures | Key Metrics |
|--------|-----------------|-------------|
| Volume | Opportunity share | Target/carry rates, snap counts, xFP (expected fantasy points) |
| Efficiency | Production quality | FPOE (Fantasy Points Over Expectation), yards-per-route-run, EPA |
| Team Context | Situation fit | Scheme fit, depth chart stability, OL quality, QB context |
| Stability | Reliability | Week-to-week consistency, injury history, role security |

Weights vary by position and view mode. QB in dynasty weights stability higher; WR in bestball weights volume higher.

## Scoring Flow

```
Raw Data (Bronze) → Normalized Stats (Silver) → Gold Metrics
    ↓
contextFetcher.ts — pulls snapshots, role banks, team context, SoS from DB
    ↓
forgeEngine.ts (E) — computes 4 pillar scores per player
    ↓
forgeFootballLens.ts (F) — flags issues, attaches warnings
    ↓
forgeGrading.ts (G) — applies weights by position/mode → baseAlpha
    ↓
recursiveAlphaEngine.ts (R) — blends with prior alpha (80/20) ± momentum
    ↓
sosService.ts — SoS multiplier (0.90–1.10 adjustment)
    ↓
Final Alpha (0–100) + Tier (T1–T5)
```

## Tier Mapping

- **T1 (Elite)**: Alpha 85–100
- **T2 (Strong)**: Alpha 70–84
- **T3 (Startable)**: Alpha 55–69
- **T4 (Fringe)**: Alpha 40–54
- **T5 (Bust)**: Alpha 0–39

## QB Context Blending

QBs get special treatment. Their Alpha blends individual metrics with team context:
- Redraft mode: 60% individual / 40% context
- Dynasty mode: 40% individual / 60% context

Context includes skill player quality, OL grade, scheme, and durability history.

## Key API Endpoints

- `GET /api/forge/player/:id` — Single player FORGE score
- `GET /api/forge/batch` — Batch scoring (position, week, mode)
- `GET /api/forge/tiers` — Tiered rankings by position
- `GET /api/forge/simulation` — What-if scenario modeling
- `GET /api/forge/trajectory/:id` — Player trend over time

## When Helping Users

- Always ground evaluations in FORGE data when available, not vibes
- Explain which pillars are driving a score (e.g., "high volume but poor efficiency")
- Flag Football Lens issues when relevant (e.g., "TD-dependent — 40% of points from touchdowns")
- Distinguish between view modes when the user's league type matters
- Use tier language (T1/Elite, T2/Strong) rather than just raw numbers
