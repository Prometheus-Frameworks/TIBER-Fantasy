# Proprietary Metrics by Position

This document lists fantasy-relevant metrics that are NOT available in NFLfastR/nflverse and require paid subscriptions to PFF, NextGen Stats, or other proprietary sources.

## QB - Quarterback

### Available in NFLfastR
| Metric | Field | Notes |
|--------|-------|-------|
| CPOE | `cpoe` | Completion % over expected |
| EPA/play | `epa` | Expected points added |
| Sacks | `sack` | Sack count |
| QB Hits | `qb_hit` | Times hit on dropbacks |
| Air Yards | `air_yards` | Intended air yards |
| ADOT | calculated | Air yards / attempts |
| Scrambles | `qb_scramble` | Designed + broken pocket |
| Pass Location | `pass_location` | left/middle/right |
| Pass Depth | `pass_length` | short/deep |

### NOT Available (Proprietary)
| Metric | Source | Why It Matters |
|--------|--------|----------------|
| Time to Throw | NextGen Stats | Pocket presence, quick release |
| Pocket Movement | NextGen Stats | Evading pressure |
| Pressure Rate | PFF | OL quality, scheme difficulty |
| On-Target % | PFF | Accuracy beyond completion % |
| Big-Time Throws | PFF | Elite downfield accuracy |
| Turnover-Worthy Plays | PFF | Near-INTs, fumbles |
| True Completion % | PFF | Drops/throwaways excluded |
| Avg Separation at Catch | NextGen Stats | Receiver-adjusted accuracy |

---

## RB - Running Back

### Available in NFLfastR
| Metric | Field | Notes |
|--------|-------|-------|
| Rush Yards | `yards_gained` | Per carry |
| YPC | calculated | Yards per carry |
| Stuffed (TFL) | `tackled_for_loss` | Negative plays |
| First Downs | `first_down_rush` | Conversion rate |
| Red Zone Carries | `yardline_100 <= 20` | Scoring opportunities |
| EPA/rush | `epa` | Efficiency |
| YAC (receiving) | `yards_after_catch` | After the catch |
| Routes Run | estimated | From snap counts |
| Target Share | calculated | % of team targets |

### NOT Available (Proprietary)
| Metric | Source | Why It Matters |
|--------|--------|----------------|
| Yards After Contact | PFF | Power/elusiveness |
| Missed Tackles Forced | PFF | Elusiveness |
| Broken Tackles | PFF | Power running |
| Elusive Rating | PFF | Composite elusiveness |
| Run Block Win Rate | ESPN/PFF | OL-adjusted efficiency |
| Stacked Box % | NextGen Stats | Difficulty of runs |
| Expected Rush Yards | NextGen Stats | OL/box-adjusted |
| Route Running Grade | PFF | Receiving ability |

---

## WR - Wide Receiver

### Available in NFLfastR
| Metric | Field | Notes |
|--------|-------|-------|
| Targets | receiver plays | Volume |
| Receptions | `complete_pass` | Catches |
| Yards | `yards_gained` | Receiving yards |
| YAC | `yards_after_catch` | After catch yards |
| Air Yards | `air_yards` | Intended depth |
| ADOT | calculated | Air yards / targets |
| First Downs | `first_down_pass` | Conversion value |
| Target Share | calculated | % of team targets |
| TPRR | calculated | Targets per route run |
| YPRR | calculated | Yards per route run |
| EPA/target | `epa` | Efficiency |
| Catch Rate | calculated | Rec / targets |

### NOT Available (Proprietary)
| Metric | Source | Why It Matters |
|--------|--------|----------------|
| Separation | NextGen Stats | Getting open ability |
| Cushion | NextGen Stats | Press vs off coverage |
| Contested Catch Rate | PFF | 50/50 ball skills |
| Drop Rate | PFF | Reliable hands |
| True Catch Rate | PFF | Catchable ball adjusted |
| Route Running Grade | PFF | Route precision |
| Yards After Contact | PFF | After-catch elusiveness |
| Open Target Rate | NextGen Stats | Scheme vs skill |
| Expected YAC | NextGen Stats | YAC over expected |

---

## TE - Tight End

### Available in NFLfastR
| Metric | Field | Notes |
|--------|-------|-------|
| All WR metrics | same as WR | Receiving production |
| Routes Run | estimated | From snap counts (lower % than WR) |
| Inline/Slot/Wide % | `player_usage` table | Route distribution |

### NOT Available (Proprietary)
| Metric | Source | Why It Matters |
|--------|--------|----------------|
| All WR proprietary | same as WR | Same limitations |
| Run Block Grade | PFF | Dual-threat value |
| Pass Block Grade | PFF | Protection ability |
| Inline Route % | PFF | True route tree |
| Seam Route Success | PFF | TE-specific routes |

---

## Cross-Position Metrics

### Available for All Positions
- Snap counts and snap share
- Fantasy points (all formats)
- EPA (expected points added)
- Team context (pace, pass rate)

### NOT Available for Any Position
| Metric | Source | Notes |
|--------|--------|-------|
| PFF Grades (0-100) | PFF | Overall performance grades |
| NextGen Speed/Accel | NextGen Stats | Athletic metrics |
| Pre-Snap Motion Data | NextGen Stats | Scheme complexity |
| Matchup Coverage Data | PFF | Who covers whom |
| Expected Fantasy Points | Various | Proprietary models |

---

## Data Source Reference

| Source | Subscription | Best For |
|--------|--------------|----------|
| NFLfastR/nflverse | Free | Play-by-play, EPA, basic stats |
| PFF | $$ | Grades, blocking, pressure, drops |
| NextGen Stats | $$ (or NFL.com limited) | Tracking data, separation, speed |
| ESPN | Free (limited) | Some advanced metrics |
| Pro Football Reference | Free | Historical, basic advanced |

---

## Workarounds

When proprietary data isn't available, we use proxies:

| Missing Metric | Proxy Used |
|----------------|------------|
| Yards After Contact | YPC variance + stuff rate |
| Separation | ADOT + catch rate combo |
| Pressure Rate | Sack rate + hit rate |
| True Catch Rate | (Rec + Drops_proxy) / Catchable |
| Route Running | TPRR + first down rate |

*Last updated: 2026-01-05*
