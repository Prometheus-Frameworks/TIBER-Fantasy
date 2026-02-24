# Dynasty Evaluation & Trade Intelligence

## TIBER's Approach to Dynasty

TIBER evaluates dynasty value through the intersection of FORGE scores, FIRE opportunity analysis, and contextual signals like age, draft capital, and team situation. The goal is to identify where the market is wrong — not to parrot consensus rankings.

## Key Signals for Dynasty

### FORGE Alpha by Mode
- Dynasty mode weights **Stability** and **Team Context** higher than redraft
- A player with a high dynasty Alpha but lower redraft Alpha = strong long-term hold
- A player with high redraft Alpha but lower dynasty Alpha = potential sell-high

### FIRE Delta (QB)
- Positive delta + young age = dynasty cornerstone
- Negative delta + aging = sell window closing
- Positive delta + bad team context = buy low (situation may improve)

### Trajectory Analysis
- `GET /api/forge/trajectory/:id` shows Alpha trend over multiple weeks
- Rising trajectory + low ownership = acquisition target
- Declining trajectory + high trade value = sell candidate

## Buy/Sell Logic

The `redraftBuySell.ts` plugin and `nightlyBuysSellsUpdate.ts` ETL job produce buy/sell signals:

**Buy signals:**
- FORGE Alpha trending up over 3+ weeks
- FIRE delta positive but market value hasn't caught up
- Football Lens clean (no TD-spike or volume/efficiency flags)
- Upcoming schedule favorable (SoS multiplier > 1.0)

**Sell signals:**
- FORGE Alpha declining or flat despite high market value
- FIRE delta negative (producing below opportunity level)
- Football Lens warnings active (TD-dependent, efficiency mirage)
- Schedule toughening (SoS multiplier < 1.0)

## Rookie Evaluation

The `rookieRisers.ts` plugin tracks rookie emergence:
- Draft capital context (`rbDraftCapitalContext.ts`)
- Snap count trajectory (are they earning playing time?)
- Efficiency vs volume ramp (are they producing when given chances?)
- Team context (clear path to targets/carries?)

## Trade Framework

When helping users evaluate dynasty trades:

1. **Pull FORGE scores** for both sides in dynasty mode
2. **Check FIRE delta** for QBs involved
3. **Compare trajectories** — is one side trending up while the other trends down?
4. **Factor age** — standard dynasty age curves apply
5. **Check Football Lens** — are any players flagged for unsustainable production?
6. **Consider team context** — coaching changes, draft capital incoming, QB situations
7. **SoS outlook** — near-term schedule strength for contenders

## When Helping Users

- Never just say "Player A > Player B" — explain which pillars and signals drive the evaluation
- Dynasty advice should always consider the user's team context (contending vs rebuilding)
- If Sleeper league is synced, reference their actual roster when making trade recommendations
- Be epistemically honest: "FORGE data suggests X, but here's what could change that..."
- Teach pattern recognition, don't create dependency
