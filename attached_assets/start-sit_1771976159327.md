# /tiber:start-sit

Get start/sit recommendations for a specific week, optionally personalized to a user's roster.

## Usage
```
/tiber:start-sit [--week <number>] [--position <pos>] [--roster <player1, player2, ...>]
```

## What This Does

1. Pull FORGE scores for the relevant players
2. Layer in SoS matchup grades for the target week
3. Apply the Start/Sit engine logic (`server/modules/startSit/`)
4. Factor in DvP (Defense vs Position) matchup data
5. If roster is provided, rank those specific players against each other

## Without Roster (General)

Returns the best and worst starts at a position for the week based on FORGE + matchup convergence.

## With Roster (Personalized)

Ranks the user's actual players and recommends the optimal lineup:

```
/tiber:start-sit --week 14 --roster "Josh Allen, Lamar Jackson"

WEEK 14 QB START/SIT

START: Josh Allen (α85, T1)
  - Matchup: vs NYJ (29th vs QB, SoS 1.08)
  - FIRE delta: +3.2 (outproducing opportunity)
  - Confidence: HIGH

SIT: Lamar Jackson (α79, T2)
  - Matchup: vs PIT (4th vs QB, SoS 0.91)
  - FIRE delta: +1.1 (still positive but tough spot)
  - Confidence: MEDIUM

Reasoning: Both are elite QBs but the matchup gap is significant this week.
Allen's pass-funnel matchup against NYJ's weak secondary gives him a higher 
ceiling, while Pittsburgh's defense compresses Lamar's rushing upside.
```

## Key Principles

- Always explain the reasoning, not just the recommendation
- Matchup context should supplement FORGE scores, not override them
- Flag uncertainty: "This is close — either could hit" is valid
- If data is missing for a player, say so rather than guessing
