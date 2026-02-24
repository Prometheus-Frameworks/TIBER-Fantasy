# /tiber:player-eval

Evaluate a player using TIBER's FORGE engine and available data.

## Usage
```
/tiber:player-eval <player_name> [--mode redraft|dynasty|bestball]
```

## What This Does

1. Resolve the player's identity (handle nicknames like "CMC" → Christian McCaffrey)
2. Pull their current FORGE Alpha score and tier
3. Break down the four pillar scores (Volume, Efficiency, Team Context, Stability)
4. Check for Football Lens flags (TD spikes, efficiency mirages)
5. If QB, include FIRE xFP delta
6. Show trajectory (trending up/down/stable)
7. Include SoS outlook for upcoming weeks

## Output Format

Provide a concise evaluation that includes:
- **Alpha score and tier** (e.g., "Alpha 78 — T2 Strong")
- **Pillar breakdown** — which pillars are driving the score and which are dragging
- **Flags** — any Football Lens warnings
- **Context** — team situation, role security, upcoming matchups
- **Recommendation** — buy/hold/sell with reasoning

Default mode is redraft unless the user specifies otherwise.

## Example

```
/tiber:player-eval Ja'Marr Chase --mode dynasty

Alpha 91 — T1 Elite (Dynasty)
Volume: 94 | Efficiency: 88 | Team Context: 87 | Stability: 92
No Football Lens flags.
Trajectory: Stable T1 over last 6 weeks.
Dynasty outlook: Locked-in WR1 with elite route-running efficiency and 
target share. Stability pillar reflects consistent week-over-week production.
Hold — no reason to move unless the return is extraordinary.
```
