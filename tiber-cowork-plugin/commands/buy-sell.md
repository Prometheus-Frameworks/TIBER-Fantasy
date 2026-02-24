# /tiber:buy-sell

Surface buy-low and sell-high candidates based on FORGE trajectory, FIRE delta, and market inefficiency signals.

## Usage
```
/tiber:buy-sell [--position <pos>] [--mode redraft|dynasty] [--limit <number>]
```

## What This Does

1. Query the nightly buy/sell update data (`nightlyBuysSellsUpdate.ts`)
2. Cross-reference with FORGE trajectory trends
3. Layer in Football Lens flags (sell signal amplifier)
4. For dynasty mode, factor in age curves and draft capital
5. Return ranked buy and sell candidates with reasoning

## Output Format

```
/tiber:buy-sell --position WR --mode dynasty --limit 5

📈 BUY LOW
1. Drake London (α74, T2) — Alpha up +7 over 3 weeks, market still pricing 
   him as fringe WR2. Volume pillar surging after scheme change. Age 23.
   
2. Quentin Johnston (α61, T3) — FPOE turning positive last 4 weeks. 
   Market still anchored to rookie year disappointment. Dynasty discount.

📉 SELL HIGH  
1. Tank Dell (α69, T3) — TD-spike flag active (41% of FP from TDs). 
   Volume pillar declining as target share compresses. Market values 
   him as WR2 based on points, but FORGE sees T3 sustainability.

2. Rashod Bateman (α58, T3) — Alpha peaked 3 weeks ago, now declining.
   Efficiency pillar carried by small-sample deep shots. Regression likely.
```

## Dynasty vs Redraft

- **Redraft buy/sell**: Focused on remaining-season value. Schedule, injury timelines, role changes.
- **Dynasty buy/sell**: Focused on multi-year value. Age, draft capital, situation trajectory, contract.

## Principles

- Buy/sell signals are starting points for research, not trade orders
- Always show which FORGE pillars and signals are driving the recommendation
- Acknowledge when the market might be right and TIBER might be early
