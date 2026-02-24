# /tiber:forge-batch

Run FORGE scoring across a position group and return tiered rankings.

## Usage
```
/tiber:forge-batch <position> [--mode redraft|dynasty|bestball] [--week <number>] [--top <number>]
```

## What This Does

1. Query the FORGE batch endpoint for the specified position
2. Return players sorted by Alpha score, grouped by tier
3. Highlight movers (significant week-over-week Alpha changes)
4. Flag any Football Lens issues across the group

## Parameters

- `position`: QB, RB, WR, or TE (required)
- `--mode`: Scoring mode (default: redraft)
- `--week`: Specific week to score (default: latest available)
- `--top`: Number of players to show (default: 30)

## Output Format

Group results by tier with the most relevant context:

```
/tiber:forge-batch WR --mode dynasty --top 15

T1 ELITE (Alpha 85+)
  1. Ja'Marr Chase    α91  Vol:94 Eff:88 Ctx:87 Stb:92  ↔ stable
  2. CeeDee Lamb      α88  Vol:90 Eff:85 Ctx:86 Stb:89  ↑ +3 from last week

T2 STRONG (Alpha 70-84)
  3. Amon-Ra St. Brown α82  Vol:86 Eff:79 Ctx:81 Stb:80  ↔ stable
  ...

MOVERS: Drake London ↑+7 (volume surge), Chris Olave ↓-5 (QB situation)
FLAGS: Player X — TD-spike warning (38% of FP from TDs)
```
