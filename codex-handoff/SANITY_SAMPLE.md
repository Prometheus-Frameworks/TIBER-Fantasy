# SANITY SAMPLE — Validation Anchors

## Purpose
After computing FORGE grades, compare results against these known-good player benchmarks. Any grade that falls outside the expected range is a "WTF" that requires investigation.

## Data Source
All PPG figures from `datadive_snapshot_player_week` aggregations (2025 season, through week 17).

---

## WR Anchors

Tier thresholds: T1≥82, T2≥72, T3≥58, T4≥45, T5<45

| Player | Team | GP | PPG | Expected Tier | Alpha Range | Notes |
|--------|------|----|-----|---------------|-------------|-------|
| Puka Nacua | LA | 16 | 23.6 | T1 | 85-95 | Elite volume + efficiency. If not T1, something is broken. |
| Jaxon Smith-Njigba | SEA | 17 | 21.3 | T1 | 82-92 | High targets, full season |
| Ja'Marr Chase | CIN | 16 | 19.7 | T1 | 83-93 | Most targets in NFL (185). Elite volume. |
| Amon-Ra St. Brown | DET | 17 | 19.1 | T1-T2 | 78-90 | High target share, efficient offense |
| George Pickens | DAL | 17 | 17.1 | T2-T3 | 68-80 | New team context may affect contextFit |
| Zay Flowers | BAL | 17 | 14.7 | T2-T3 | 65-78 | Run-heavy offense limits volume ceiling |
| Wan'Dale Robinson | NYG | 16 | 13.6 | T3-T4 | 55-70 | High targets (141) but low efficiency |
| Courtland Sutton | DEN | 17 | 12.8 | T3-T4 | 52-68 | Moderate everything |

**WTF if:** Puka Nacua is T3 or below. Wan'Dale Robinson is T1.

## RB Anchors

Tier thresholds: T1≥78, T2≥68, T3≥55, T4≥42, T5<42

| Player | Team | GP | PPG | Expected Tier | Alpha Range | Notes |
|--------|------|----|-----|---------------|-------------|-------|
| Christian McCaffrey | SF | 17 | 24.4 | T1 | 82-95 | PPG king. Must be T1. |
| Bijan Robinson | ATL | 17 | 22.1 | T1 | 80-92 | Elite volume + efficiency |
| Jahmyr Gibbs | DET | 17 | 21.6 | T1 | 78-90 | High PPG in elite offense |
| Jonathan Taylor | IND | 17 | 21.3 | T1 | 78-90 | 324 carries, workhorse |
| De'Von Achane | MIA | 16 | 20.1 | T1-T2 | 75-88 | Explosive but durability ? |
| James Cook | BUF | 17 | 18.1 | T2 | 68-80 | Solid in pass-heavy offense |
| Derrick Henry | BAL | 17 | 16.8 | T2-T3 | 62-76 | Pure rusher, limited receiving |
| Chase Brown | CIN | 17 | 16.4 | T2-T3 | 60-74 | Emerging back |
| Ashton Jeanty | LV | 17 | 14.5 | T3 | 55-68 | Rookie volume, efficiency TBD |

**WTF if:** CMC is T3 or below. Ashton Jeanty is T1.

## QB Anchors

Tier thresholds: T1≥70, T2≥55, T3≥42, T4≥32, T5<32

| Player | Team | GP | PPG | Expected Tier | Alpha Range | Notes |
|--------|------|----|-----|---------------|-------------|-------|
| Josh Allen | BUF | 16 | 22.4 | T1 | 75-92 | Elite dual-threat |
| Matthew Stafford | LA | 17 | 21.2 | T1-T2 | 68-82 | High PPG, strong weapons |
| Drake Maye | NE | 17 | 20.8 | T2 | 58-72 | Volume but efficiency concerns |
| Patrick Mahomes | KC | 14 | 19.9 | T1-T2 | 65-80 | Only 14 games — confidence lower |
| Jalen Hurts | PHI | 16 | 18.8 | T2 | 58-72 | Rushing floor matters |
| Bo Nix | DEN | 17 | 17.6 | T2-T3 | 50-65 | Developing QB |

**WTF if:** Josh Allen is T3 or below. Bo Nix is T1.

## TE Anchors

Tier thresholds: T1≥82, T2≥70, T3≥55, T4≥42, T5<42

| Player | Team | GP | PPG | Expected Tier | Alpha Range | Notes |
|--------|------|----|-----|---------------|-------------|-------|
| Trey McBride | ARI | 17 | 18.6 | T1 | 82-95 | 170 targets — TE WR1 role |
| Kyle Pitts | ATL | 17 | 12.4 | T2-T3 | 58-72 | Resurgence season |
| Travis Kelce | KC | 17 | 11.2 | T2-T3 | 55-70 | Age decline but elite context |
| Harold Fannin Jr. | CLE | 15 | 12.6 | T2-T3 | 58-72 | Rookie breakout |
| Brock Bowers | LV | 12 | 14.5 | T2 | 65-78 | Only 12 games, high per-game |
| Hunter Henry | NE | 17 | 10.5 | T3-T4 | 48-62 | Reliable but ceiling-limited |

**WTF if:** Trey McBride is T3 or below. Hunter Henry is T1.

---

## WTF Detection Rules

Run these after every batch computation:

### 1. Tier Count Sanity
| Position | T1 Count | T2 Count | Red Flag |
|----------|----------|----------|----------|
| WR | 4-8 | 8-15 | 0 T1 players or >12 T1 |
| RB | 4-7 | 6-12 | 0 T1 or >10 T1 |
| QB | 3-6 | 5-10 | 0 T1 or >8 T1 |
| TE | 1-3 | 3-6 | 0 T1 or >5 T1 |

### 2. Alpha Distribution
- **Spread:** Max alpha - Min alpha should be > 30. If < 20, scores are compressed.
- **Mean:** Position-wide mean alpha should be 45-65. If < 35 or > 75, weights are miscalibrated.
- **Standard deviation:** Should be 12-25. If < 8, no differentiation. If > 35, something extreme.

### 3. PPG vs Alpha Correlation
FORGE Alpha and PPG should have a positive correlation (r > 0.5) but should NOT be 1:1. If r > 0.95, FORGE is just re-ranking by PPG. If r < 0.3, FORGE is disconnected from production.

### 4. Known Mismatches to Accept
These players may legitimately differ from PPG expectations:
- **High PPG, lower Alpha:** TD-dependent players with low volume (e.g., boom/bust deep threats)
- **Low PPG, higher Alpha:** High-volume players with poor TD luck (e.g., high targets, low TDs)
- **Injury-shortened seasons:** < 10 games → lower confidence, may shift tier

### 5. Cross-Position Check
No RB should have a higher Alpha than the #1 WR unless they're truly elite (CMC-level). TE T1 threshold (82) is intentionally high — most TEs should be T2-T4.
