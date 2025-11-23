# TIBER v1.5 Algorithm Documentation

## Overview
TIBER (Tactical Index for Breakout Efficiency and Regression) is a fantasy football player rating system designed to identify breakout candidates, stable performers, and regression risks.

**Current Implementation:** WR/TE only
**In Development:** QB and RB algorithms

---

## TIBER v1.5 Formula for WR/TE

### Component Weights
```
First Down Score: 35%  (Most predictive - 0.750 correlation with future FPG)
EPA Score:        25%  (Reduced from v1.0)
Usage Score:      25%  (Snap % and trend)
TD Score:         10%  (Regression indicator)
Team Score:        5%  (Offensive context)
Total:           100%
```

### Tier Classification
- **Breakout** (80-100): Elite performers, high confidence
- **Stable** (50-79): Average to above-average performers
- **Regression** (0-49): Below average, high risk

---

## Component Breakdown

### 1. First Down Score (35 points max)

**Metric:** First Downs per Route Run (1D/RR)

**Why It Matters:** 
- Strongest correlation with future fantasy points (0.750)
- Indicates QB trust and chain-moving ability
- Separates volume catchers from high-quality targets

**Position-Specific Calculation:**
- **WR/TE:** `First Downs / (Targets × Route Multiplier)`
  - WR Route Multiplier: 3.5 (run routes ~78% of pass plays)
  - TE Route Multiplier: 2.8 (run routes ~70% of pass plays)
- **RB:** `First Downs / Total Touches` (not yet implemented)

**Scoring Scale:**
| 1D/RR Rate | Points | Category |
|------------|--------|----------|
| ≥17%       | 35     | Elite chain-mover |
| 15%        | 32     | Very good |
| 12%        | 25     | Above average |
| 10%        | 21     | Average |
| 8%         | 14     | Below average |
| <6%        | 7      | Poor (TD-dependent) |

**Examples:**
- Puka Nacua (2023): ~17% 1D/RR - Elite
- Average WR: ~10-12% 1D/RR
- TD-dependent WR: <8% 1D/RR (unsustainable)

---

### 2. EPA Score (25 points max)

**Metric:** EPA (Expected Points Added) per Play

**Why It Matters:**
- Measures efficiency and impact on offense
- Accounts for situation (down, distance, field position)
- More stable than raw yardage

**Scoring Scale:**
| EPA/Play | Points | Category |
|----------|--------|----------|
| ≥0.30    | 25     | Elite |
| 0.20     | 21     | Very good |
| 0.15     | 16     | Average |
| 0.10     | 13     | Below average |
| 0.05     | 9      | Poor |
| 0.00     | 6      | Bad |
| <0.00    | 3      | Terrible (negative EPA) |

**League Context:**
- Elite WR: 0.30+ EPA/play
- League Average: ~0.15 EPA/play
- Below Replacement: <0.05 EPA/play

---

### 3. Usage Score (25 points max)

**Metrics:** 
- Snap Percentage (primary)
- Snap Trend (modifier)

**Why It Matters:**
- Opportunity is king in fantasy
- Rising snap % = increasing role
- Falling snap % = warning sign

**Base Scoring (Snap %):**
| Snap % | Base Points |
|--------|-------------|
| ≥80%   | 22.5 |
| 70-79% | 20.0 |
| 60-69% | 17.5 |
| 50-59% | 15.0 |
| 40-49% | 10.0 |
| <40%   | 5.0  |

**Trend Modifier:**
- **Rising** (>15% increase recent 2 weeks vs earlier): ×1.1 multiplier
- **Stable** (within ±15%): No modifier
- **Falling** (<15% decrease): ×0.9 multiplier

**Snap % Calculation:**
```
Effective Snap % = (Player's Plays / Team's Offensive Plays) × 100
```

---

### 4. TD Score (10 points max)

**Metric:** TD Rate (TDs per 100 plays)

**Why It Matters:**
- TDs regress to position averages
- Unsustainably high TD rates indicate future decline
- Low TD rates with good usage = positive regression candidate

**Scoring (Regression Analysis):**
| TD Rate vs Avg | Points | Analysis |
|----------------|--------|----------|
| >150% of avg (>15%) | 2 | Unsustainable, high regression risk |
| 120-150% (12-15%) | 6 | Slightly high |
| 80-120% (8-12%) | 10 | Sustainable range |
| <80% (<8%) | 7 | Below average, room for growth |

**Position Averages:**
- WR: ~10-12% TD rate
- RB: ~8-10% TD rate
- TE: ~8-10% TD rate

---

### 5. Team Score (5 points max)

**Metric:** Team Offensive EPA Rank (1-32)

**Why It Matters:**
- Better offenses = more opportunities
- High-powered offenses sustain multiple fantasy options
- Bad offenses cap player upside

**Scoring:**
| Team Rank | Points | Category |
|-----------|--------|----------|
| Top 10    | 5      | Elite offense |
| 11-20     | 3.5    | Average |
| 21-32     | 2      | Bad offense |

**Team EPA Calculation:**
```sql
AVG(epa) per play for team through current week
Rank all 32 teams by average EPA
```

---

## Available Data Sources for QB/RB Algorithms

### NFLfastR Play-by-Play Data
**Location:** `bronze_nflfastr_plays` table

**Available QB Metrics:**
```sql
-- Passing Efficiency
passer_player_id
complete_pass (boolean)
incomplete_pass (boolean)
interception (boolean)
touchdown (boolean)
pass_length
air_yards
yards_after_catch
epa (Expected Points Added)
wpa (Win Probability Added)
cpoe (Completion Percentage Over Expected)
qb_epa
yards_gained
first_down_pass

-- Pressure & Context
qb_hit (boolean)
sack (boolean)
shotgun (boolean)
no_huddle (boolean)
down (1st, 2nd, 3rd, 4th)
ydstogo (yards to go)
yardline_100 (field position)
score_differential

-- Game Situation
game_half
qtr
game_seconds_remaining
wp (win probability)
```

**Available RB Metrics:**
```sql
-- Rushing Production
rusher_player_id
rush_attempt (boolean)
rushing_yards
touchdown
first_down_rush
epa
success (boolean - gains expected yards)
yards_gained

-- Receiving (Passing Downs)
receiver_player_id
targets (when RB is receiver)
complete_pass
receiving_yards
receiving_touchdown
first_down_pass
yards_after_catch

-- Situation
down
ydstogo
defenders_in_the_box
run_gap (left, middle, right)
run_location
score_differential
```

### Player Identity Map
**Location:** `player_identity_map` table

```sql
-- Player Info
full_name
position
nfl_team
sleeper_id
nfl_data_py_id
espn_id
yahoo_id

-- Use for joining data across sources
```

### Team Context Data
**Derived from NFLfastR:**

```sql
-- Team Offensive EPA (already calculated in TIBER)
SELECT 
  posteam as team,
  AVG(epa) as avg_epa,
  COUNT(*) as total_plays
FROM bronze_nflfastr_plays
WHERE play_type IN ('pass', 'run')
GROUP BY posteam
ORDER BY avg_epa DESC
```

---

## Proposed QB TIBER Algorithm

### Suggested Weight Distribution
```
Adjusted EPA Score:    35%  (Similar to 1D/RR for WR - captures efficiency)
Completion % O/E:      25%  (QB accuracy vs expected)
Usage/Attempts:        20%  (Pass attempts per game)
Turnover Score:        15%  (INT rate, fumbles - regression indicator)
Team/Weapons Score:     5%  (Supporting cast quality)
```

### Key QB Metrics to Calculate

#### 1. Adjusted EPA (35%)
**Formula:**
```
QB EPA per dropback - adjusting for:
- Defense faced (opponent EPA allowed)
- Pressure rate (QB hit + sack %)
- YAC stripped out (receiver contributions)
```

**Why:** Isolates QB performance from supporting cast

#### 2. CPOE - Completion % Over Expected (25%)
**Available in NFLfastR:** `cpoe` column

**Why:** 
- Measures accuracy vs difficulty of throws
- Positive CPOE = better than expected
- More stable than raw completion %

**Scoring Example:**
| CPOE | Points | Category |
|------|--------|----------|
| +5%  | 25     | Elite accuracy |
| +2%  | 20     | Very good |
| 0%   | 16     | Average |
| -2%  | 12     | Below average |
| -5%  | 6      | Poor |

#### 3. Usage Score (20%)
**Metric:** Pass attempts per game

**Why:** Volume = opportunity in fantasy

**Calculation:**
```sql
AVG(pass_attempts) per game through current week
```

#### 4. Turnover Score (15%)
**Metrics:**
- Interception rate (INT per attempt)
- Fumbles lost

**Why:** High turnover rates regress, limit upside

**Scoring:** Inverse - penalize high turnover QBs

#### 5. Team/Weapons Score (5%)
- Offensive line quality (sack rate allowed)
- Receiver quality (separation metrics)
- Play-calling aggressiveness

---

## Proposed RB TIBER Algorithm

### Suggested Weight Distribution
```
First Down Rate:       30%  (1D per touch - similar to WR)
EPA Efficiency:        25%  (Rushing + Receiving EPA)
Usage Score:           30%  (Snap %, touch share, goal line work)
TD Regression:         10%  (Same as WR/TE)
Team Context:           5%  (Same as WR/TE)
```

### Key RB Metrics to Calculate

#### 1. First Down Rate (30%)
**Formula:**
```
First Downs / Total Touches
Where Touches = Rush Attempts + Targets
```

**Why:** Chain-moving = sustained drives = more opportunities

**Available Data:**
```sql
-- Rushing First Downs
first_down_rush (boolean)

-- Receiving First Downs
first_down_pass (boolean when RB is receiver)

-- Total Touches
COUNT(rush_attempt) + COUNT(targets when receiver_id = RB)
```

#### 2. EPA Efficiency (25%)
**Formula:**
```
(Rushing EPA + Receiving EPA) / Total Touches
```

**Why:** Captures efficiency across all touches

#### 3. Usage Score (30%)
**Three Components:**

a) **Snap % (40% of usage)**
- Same as WR/TE calculation
- Higher snap % = more involved

b) **Touch Share (40% of usage)**
```sql
Player's Touches / Team's Total RB Touches
```

c) **Goal Line Work (20% of usage)**
```sql
Rush attempts inside 5-yard line / Team's rushes inside 5
```

**Why Goal Line Matters:**
- TD opportunities are concentrated near goal line
- Goal line backs have higher scoring floors
- Predictive of future TD rates

#### 4. TD Regression (10%)
Same as WR/TE - penalize unsustainable TD rates

#### 5. Team Context (5%)
Same as WR/TE - offensive EPA rank

---

## Additional Metrics Available

### Success Rate
```sql
-- From NFLfastR
success (boolean)
-- True if play gains:
-- 1st down: 40% of yards to go
-- 2nd down: 60% of yards to go  
-- 3rd/4th down: 100% of yards to go
```

### Situational Splits
```sql
-- By Down
WHERE down = 1  -- Early down work
WHERE down >= 3 -- Passing down usage (RB receiving)

-- By Score
WHERE score_differential > 7  -- Trailing (pass-heavy)
WHERE score_differential < -7 -- Winning (run-heavy)

-- By Formation
WHERE shotgun = true  -- Spread formations
WHERE no_huddle = true -- Up-tempo offense
```

### Strength of Schedule
```sql
-- Calculate opponent defensive EPA allowed
-- Match upcoming opponents to defensive rankings
-- Project favorable/unfavorable schedules
```

---

## Implementation Notes

### For QB Algorithm:
1. **Start with EPA-based approach** - data is clean and available
2. **Add CPOE for accuracy** - already calculated in NFLfastR
3. **Include pressure adjustments** - qb_hit and sack flags
4. **Consider WPA** for clutch factor (optional)

### For RB Algorithm:
1. **First Downs per Touch** - clean metric, similar to WR
2. **Combine rushing + receiving EPA** - modern RBs catch passes
3. **Goal line tracking** - critical for TD prediction
4. **Snap % trends** - identify role expansion/contraction

### Data Quality Checks
```sql
-- Ensure minimum sample size
-- QBs: 50+ dropbacks
-- RBs: 25+ touches
-- Filter backup players
```

### Position-Specific Thresholds
- QBs need higher minimums (starters only)
- RBs include committee backs (lower minimums)
- Adjust weights based on backtest correlation

---

## Next Steps for Algorithm Development

1. **Query play-by-play data** for QB/RB samples
2. **Calculate proposed metrics** for top 20 players
3. **Backtest correlation** with actual fantasy points
4. **Adjust weights** based on predictive power
5. **Set tier thresholds** based on distribution
6. **Implement in `tiberService.ts`**

---

## References

- **Data Source:** NFLfastR (https://github.com/nflverse/nflfastR)
- **EPA Methodology:** NFLfastR adjusted EPA metrics
- **1D/RR Research:** Ryan Heath (The 33rd Team)
- **Database:** `bronze_nflfastr_plays` table in PostgreSQL

---

## Sample SQL Queries

### QB Sample Query
```sql
SELECT 
  passer_player_id,
  COUNT(*) as dropbacks,
  AVG(CASE WHEN complete_pass THEN 1 ELSE 0 END) as completion_pct,
  AVG(cpoe) as avg_cpoe,
  AVG(epa) as avg_epa,
  SUM(CASE WHEN touchdown THEN 1 ELSE 0 END) as passing_tds,
  SUM(CASE WHEN interception THEN 1 ELSE 0 END) as interceptions,
  SUM(CASE WHEN qb_hit OR sack THEN 1 ELSE 0 END) as pressures
FROM bronze_nflfastr_plays
WHERE 
  season = 2025 
  AND week <= 8
  AND pass_attempt = true
  AND passer_player_id IS NOT NULL
GROUP BY passer_player_id
HAVING COUNT(*) >= 50
ORDER BY avg_epa DESC
LIMIT 20;
```

### RB Sample Query
```sql
SELECT 
  COALESCE(rusher_player_id, receiver_player_id) as player_id,
  COUNT(*) as total_touches,
  SUM(CASE WHEN first_down_rush OR first_down_pass THEN 1 ELSE 0 END) as first_downs,
  AVG(epa) as avg_epa,
  SUM(CASE WHEN touchdown THEN 1 ELSE 0 END) as touchdowns,
  SUM(CASE WHEN yardline_100 <= 5 AND rush_attempt THEN 1 ELSE 0 END) as goal_line_rushes
FROM bronze_nflfastr_plays
WHERE 
  season = 2025 
  AND week <= 8
  AND (
    (rush_attempt = true AND rusher_player_id IS NOT NULL)
    OR 
    (pass_attempt = true AND receiver_player_id IN (SELECT player_id WHERE position = 'RB'))
  )
GROUP BY player_id
HAVING COUNT(*) >= 25
ORDER BY avg_epa DESC
LIMIT 30;
```

---

**Last Updated:** October 24, 2025
**Version:** 1.5 (WR/TE live, QB/RB in development)
