# Tiber Voice

Data-driven fantasy football guidance system. Parses user intent from natural language, fetches relevant data, and generates structured verdicts (start/sit, trade, waiver) backed by TIBER Power and RAG scores.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Core types: `TiberIntent`, `TiberAsk`, `TiberAnswer`, `PlayerWeekFacts`, `DecisionResult` |
| `intentParser.ts` | Parses user text into structured `TiberAsk` (identifies intent, players, context) |
| `dataAdapter.ts` | Fetches player data from TIBER systems to build `PlayerWeekFacts` for each player |
| `answer.ts` | Generates final `TiberAnswer` from decision results and player data |
| `compare.ts` | Player comparison logic for head-to-head evaluations |
| `reasons.ts` | Builds factual reasoning bullets from metrics and deltas |
| `deciders.ts` | Decision framework entry point, routes to specific deciders |
| `deciders/startSit.ts` | Start/sit verdict logic using power scores, matchup, availability |
| `deciders/trade.ts` | Trade evaluation using value gaps, trends, dynasty context |
| `deciders/waiver.ts` | Waiver claim priority using VORP, usage trends, availability |

## Intent Flow

```
User message
    ↓
intentParser.ts  →  TiberAsk { intent, players[], week, leagueType, scoring }
    ↓
dataAdapter.ts   →  PlayerWeekFacts[] (power scores, RAG, matchup data)
    ↓
deciders.ts      →  routes to startSit / trade / waiver decider
    ↓
reasons.ts       →  builds evidence bullets
    ↓
answer.ts        →  TiberAnswer { verdict, confidence, reasons, metrics, contingencies }
```

## Intents

| Intent | Description | Decider |
|--------|-------------|---------|
| `START_SIT` | Should I start or sit this player? | `deciders/startSit.ts` |
| `TRADE` | Should I trade for/away this player? | `deciders/trade.ts` |
| `WAIVER` | Should I claim this player off waivers? | `deciders/waiver.ts` |
| `RANKING_EXPLAIN` | Why is this player ranked here? | Handled in `answer.ts` |
| `PLAYER_OUTLOOK` | General player outlook | Handled in `answer.ts` |

## Deciders

Each decider receives `PlayerWeekFacts[]` and returns a `DecisionResult` with:
- `verdict`: e.g., "Start", "Bench", "Lean Trade For", "Claim: High"
- `conf`: confidence 0–100

Deciders use thresholds on power_score, rag_score, availability, opp_multiplier, and delta_vs_ecr to determine verdicts.

## Key Types

```typescript
interface TiberAnswer {
  verdict: string;       // "Start", "Bench", etc.
  confidence: number;    // 0-100
  reasons: string[];     // factual bullets
  metrics: Record<string, any>;
  contingencies?: string[];  // "If Player X OUT → flip"
  tone: 'tiber';
}
```
