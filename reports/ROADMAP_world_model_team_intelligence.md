# ROADMAP ITEM — TIBER World Model: Team Intelligence & Scheme Awareness

**Flagged by:** Max (OpenClaw agent)  
**Date:** 2026-02-28  
**Session:** Live connector test / Jets team context / consensus layer discussion  
**Priority:** Long-term vision — foundational to agent-first platform

---

## The Concept

Joe's framing:

> "Ideally long term, with how AI systems are accelerating, it would be cool to have TIBER see the Jets and their offseason moves and come to the realization that there's some interesting profiles that could emerge with a better O-line or new additions to the DL and secondary. If TIBER can then check the coaches, their profiles and scheme and if it's a meta tactic for the current NFL."

This is TIBER developing **situational awareness** — the ability to reason about a team not just as a collection of player stats, but as a living system with context, trajectory, and scheme identity.

---

## What This Actually Is

This is a **World Model** for the NFL.

Most fantasy tools answer: *"What did this player do?"*  
TIBER's World Model answers: *"Given everything changing around this player, what are they about to become?"*

Three layers of intelligence that compound:

```
Layer 1: Player Data (current)
  → FORGE Alpha, efficiency metrics, volume signals
  → What the player has done on the field

Layer 2: Team System (new)
  → Roster construction, O-line grade, DL/secondary additions
  → Coaching staff profile, scheme identity, scheme fit
  → How the team around the player is changing

Layer 3: Meta-Game Awareness (new)
  → Is this scheme currently winning in the NFL?
  → Is the league trending toward or away from this style of play?
  → What does history say about this coach's usage patterns?

World Model output:
  → "Given these three layers, here are the emerging profiles worth watching"
```

---

## The Jets Example

**Current TIBER view (Layer 1 only):**
- Garrett Wilson: 7 games in 2025, efficient but small sample
- O-line: negative rush EPA suggests poor blocking
- QB: whatever mess they had in 2025

**World Model view (all 3 layers):**
- Jets add [new OL pieces] → run game becomes viable → play-action opens up
- New defensive additions → Jets become more competitive → more two-score games → more passing
- New HC/OC profile → check historical usage patterns → do they feature slot WRs or boundary? Do they use their RB in the passing game?
- Meta check → is their scheme (spread, 12-personnel, RPO-heavy, etc.) currently winning in the NFL?
- Output → "Garrett Wilson in this new system, with a functional OL and a QB who can threaten vertically, is one of the most interesting WR1 candidates in the 2026 draft"

TIBER doesn't just retrieve data. It *reasons* to a conclusion the user might not have reached yet.

---

## The Coaching Profile Module

This is particularly powerful and underbuilt across all fantasy tools.

Coaches have fingerprints. They repeat patterns across stops:

- **OC tendencies:** target distribution, personnel groupings, how they use RBs as receivers, whether they have a true WR1 or distribute targets evenly, deep ball rate, red zone usage
- **HC philosophy:** run/pass balance, aggressive vs conservative, how they deploy talent vs how they draft talent
- **Scheme identity:** is it a system that makes players look good (West Coast, McVay tree) or one that demands specific archetypes?

TIBER should have a `coaching_profiles` table:

```
coach_id | name | history | scheme | target_distribution_tendency
       | rb_usage | wr1_concentration | deep_ball_rate | rz_usage_patterns
```

When a new OC is hired by the Jets, TIBER cross-references his profile and surfaces:
> "This OC historically features a slot WR heavily in 3-WR sets and uses his RB as a checkdown valve. Wilson's route tree maps well to this system. Hall's receiving usage could increase significantly."

---

## Meta-Game / League Trend Awareness

The NFL is cyclical. Schemes come in and out of fashion:
- 2018-2022: RPO and mobile QB era
- 2022-2024: 12-personnel and TE-heavy offenses rising
- 2025: push toward analytics-driven 4th down aggression

TIBER should track whether a team's incoming scheme is *currently working* in the NFL:

```
scheme_meta_scores table:
  scheme_type | current_success_rate | league_adoption_trend | pts_per_drive_avg
```

If a team hires a coordinator running a scheme that's been declining in effectiveness across the league, that context matters for player projections — regardless of the individual talent.

---

## Emerging Profiles Engine

The highest-value output of the World Model:

An automated process that runs after major offseason events (signings, trades, draft, coaching hires) and identifies **players whose context has changed enough to warrant re-evaluation**.

```
Trigger: Jets sign new LT (Day 1 of free agency)
Process:
  1. Pull Jets 2025 rush EPA (-0.11 — poor blocking)
  2. Flag: OL upgrade detected
  3. Cross-reference: which Jets RBs/QBs are most sensitive to OL quality?
  4. Pull: new OC profile → does he run outside zone (favors athletic RBs) or gap (favors power)?
  5. Meta check: is outside zone currently outperforming gap schemes?
  6. Output: "B.Hall emerging profile — OL upgrade + scheme fit = potential breakout candidate"
```

Push this to an agent-queryable endpoint:
```
GET /api/world-model/emerging-profiles?team=NYJ&season=2026
GET /api/world-model/team-context/:team
GET /api/world-model/coach/:coach_id
GET /api/world-model/scheme-meta
```

---

## Why This Matters for the Agent-First Vision

With this World Model, a conversation like this becomes real:

> **Joe:** "Tell me about the Jets heading into 2026"  
> **TIBER Agent:** "Three things worth watching. First, if the O-line additions hold, Hall's YPC should improve — TIBER's 2025 rush EPA for NYJ was negative, meaning blocking cost him yards. Second, Wilson's new OC ran a system at his last stop that featured a true WR1 at 28% target share — Wilson is that player if healthy. Third, their secondary additions make them more competitive — fewer blowouts means more balanced game scripts, which historically suppresses volume for everyone. Net: buy Wilson, be cautious on Hall until we see training camp usage, monitor game script tendencies."

That's not a human doing research. That's an AI that has built a model of the world.

---

## Build Sequence

1. **Coaching profiles database** — start with current NFL coordinators, tag scheme and historical tendencies
2. **Team context API** — `/api/world-model/team-context/:team` pulling roster construction, OL grade, scheme
3. **Offseason event listener** — trigger re-evaluation when MySportsFeeds/Sleeper surfaces roster changes
4. **Emerging profiles engine** — automated flagging of changed contexts
5. **Scheme meta scoring** — league-wide scheme effectiveness tracking
6. **Full world model synthesis** — combine all layers into a coherent team narrative

---

## The Long Game

This is where TIBER stops being a stats platform and becomes something closer to what a real front office analyst does — synthesizing data, personnel, scheme, and league trends into a forward-looking picture.

The AI acceleration Joe mentioned is the key unlock. This kind of multi-layer reasoning was expensive and slow to build manually. With agents that can query TIBER's structured data and reason over it dynamically, the World Model becomes something that evolves in real time rather than being a static report.

TIBER provides the data spine. The agent provides the synthesis. Together they reason toward conclusions neither could reach alone.

That's the vision.
