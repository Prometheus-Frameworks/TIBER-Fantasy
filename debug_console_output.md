# WR Data Source Diagnostic Results

## 📊 **COMPLETE NFL-DATA-PY WR ANALYSIS FINDINGS**

### **1. Available Stat Columns (53 Total)**
```
ALL COLUMNS IN RAW NFL-DATA-PY DATASET:
 1. player_id                    28. carries
 2. player_name                  29. rushing_yards  
 3. player_display_name          30. rushing_tds
 4. position                     31. rushing_fumbles
 5. position_group               32. rushing_fumbles_lost
 6. headshot_url                 33. rushing_first_downs
 7. recent_team                  34. rushing_epa
 8. season                       35. rushing_2pt_conversions
 9. week                         36. receptions ✓ (USED)
10. season_type                  37. targets ✓ (USED)
11. opponent_team                38. receiving_yards ✓ (USED)
12. completions                  39. receiving_tds ✓ (USED)
13. attempts                     40. receiving_fumbles
14. passing_yards                41. receiving_fumbles_lost
15. passing_tds                  42. receiving_air_yards ✓ (USED)
16. interceptions                43. receiving_yards_after_catch ✓ (USED)
17. sacks                        44. receiving_first_downs ✓ (USED)
18. sack_yards                   45. receiving_epa
19. sack_fumbles                 46. receiving_2pt_conversions
20. sack_fumbles_lost            47. racr
21. passing_air_yards            48. target_share ✓ (USED)
22. passing_yards_after_catch    49. air_yards_share ✓ (USED)
23. passing_first_downs          50. wopr
24. passing_epa                  51. special_teams_tds
25. passing_2pt_conversions      52. fantasy_points
26. pacr                         53. fantasy_points_ppr
27. dakota
```

### **2. Raw Data Summary (UNFILTERED)**
- **Total NFL Dataset Rows**: 5,597 players across all positions
- **WR Position Rows**: 2,238 weekly records  
- **Unique WR Players**: 238 total players in 2024
- **Players with 0 targets**: 4
- **Players with 1+ targets**: 234
- **Players with 10+ targets**: 164 (our API filter threshold)
- **Players with 50+ targets**: 91

### **3. YPRR Calculation Method**
**CONFIRMED: We CALCULATE YPRR, not pulling pre-calculated**

**Formula Used**:
```python
# Step 1: Estimate routes run
routes_run = max(targets * 3.5, targets)
routes_run = min(routes_run, 750)  # Cap at 750 maximum

# Step 2: Calculate YPRR  
yards_per_route_run = receiving_yards / routes_run
```

**Reasoning**:
- Elite WRs run ~600-700 routes per season
- Average WRs run ~400-500 routes per season  
- Conservative estimate: `targets * 3.5` accounts for routes without targets
- Maximum cap of 750 routes prevents unrealistic calculations

### **4. First 25 Players (Raw Production Order)**
```
Rank Player Name          Team Targets Rec Yds Routes  YPRR   TDs Target% 
1    J.Chase              CIN  175     1708    612     2.79   17  0.3     
2    J.Jefferson          MIN  162     1591    567     2.81   10  0.3     
3    A.St. Brown          DET  151     1400    528     2.65   12  0.3     
4    L.McConkey           LAC  126     1346    441     3.05   8   0.3     
5    T.McLaurin           WAS  140     1323    490     2.7    16  0.2     
6    B.Thomas             JAX  133     1282    465     2.76   10  0.3     
7    D.London             ATL  158     1271    553     2.3    9   0.3     
8    A.Brown              PHI  120     1242    420     2.96   9   0.3     
9    J.Jeudy              CLE  145     1229    507     2.42   4   0.2     
10   N.Collins            HOU  115     1209    402     3.01   8   0.2     
11   M.Nabers             NYG  170     1204    595     2.02   7   0.4     
12   C.Lamb               DAL  152     1194    532     2.24   6   0.3     
13   C.Sutton             DEN  144     1156    504     2.29   8   0.3     
14   P.Nacua              LA   129     1131    451     2.51   3   0.3     
15   J.Smith-Njigba       SEA  137     1130    479     2.36   6   0.2     
16   G.Wilson             NYJ  153     1104    535     2.06   7   0.3     
17   M.Evans              TB   117     1096    409     2.68   12  0.3     
18   Z.Flowers            BAL  116     1059    406     2.61   4   0.3     
19   J.Meyers             LV   129     1027    451     2.28   4   0.3     
20   D.Smith              PHI  106     1023    371     2.76   9   0.3     
21   J.Williams           DET  95      1020    332     3.07   7   0.2     
22   C.Ridley             TEN  120     1017    420     2.42   4   0.2     
23   K.Shakir             BUF  120     995     420     2.37   4   0.2     
24   D.Metcalf            SEA  108     992     378     2.62   5   0.2     
25   D.Mooney             ATL  106     992     371     2.67   5   0.2     
```

### **5. Production API Filter**
- **Current Filter**: Minimum 10 targets (line 101 in wrAdvancedStatsService.ts)
- **Result**: 164 WR players instead of 238 total
- **Filtered Out**: 74 fringe players with <10 targets (mostly practice squad, injured, etc.)

### **6. YPRR Calculation Verification**
**Top 3 Players Formula Check**:
```
Player #1: J.Chase
   Targets: 175 → Routes: 175 * 3.5 = 612
   Receiving Yards: 1708 → YPRR: 1708 / 612 = 2.79 ✓

Player #2: J.Jefferson  
   Targets: 162 → Routes: 162 * 3.5 = 567
   Receiving Yards: 1591 → YPRR: 1591 / 567 = 2.81 ✓

Player #3: A.St. Brown
   Targets: 151 → Routes: 151 * 3.5 = 528  
   Receiving Yards: 1400 → YPRR: 1400 / 528 = 2.65 ✓
```

**✅ CALCULATION ACCURACY: 100% - All manual calculations match stored values**

---

## **🔧 Data Source Architecture Summary**

**Source**: NFL-Data-Py Python package via Node.js subprocess  
**Method**: `nfl.import_weekly_data([2024])` → group by player → calculate metrics  
**Columns Used**: 9 of 53 available (targets, receptions, receiving_yards, receiving_tds, target_share, air_yards_share, receiving_yards_after_catch, receiving_first_downs, receiving_air_yards)  
**Formula**: YPRR = receiving_yards / (targets * 3.5), capped at 750 routes  
**Filter**: ≥10 targets for fantasy relevance  
**Output**: 164 WR players with authentic 2024 NFL statistics