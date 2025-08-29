# DeepSeek v3.1 Comprehensive System Bundle

## 🎯 Overview
This bundle contains all mathematical formulas, scoring algorithms, and data pipelines for the **DeepSeek v3.1 Rankings System** with Enhanced xFP (Expected Fantasy Points) anchoring and FPTS-based WR rankings.

---

## 📊 Core Mathematical Framework

### **1. Expected Fantasy Points (xFP) Calculation**
- **Engine**: OLS (Ordinary Least Squares) Regression
- **Purpose**: Anchor all rankings with objective statistical foundation
- **Input Variables**: 
  - `routeRate` - Route participation percentage
  - `tgtShare` - Target share percentage  
  - `rzTgtShare` - Red zone target share
  - `rushShare` - Rush attempt share (for RBs)
  - `glRushShare` - Goal line rush share
  - `talentScore` - Composite talent evaluation
  - `last6wPerf` - Recent 6-week performance

### **2. Position-Specific xFP Coefficients**
```javascript
// Loaded from xfpRepository for each position
coeffs = {
  WR: { /* position-specific regression coefficients */ },
  RB: { /* position-specific regression coefficients */ },
  TE: { /* position-specific regression coefficients */ },
  QB: { /* position-specific regression coefficients */ }
}
```

### **3. Core Scoring Formula (v3.1)**
```javascript
// Multi-component weighted scoring system
const baseScore = 
  (xfpScore * modeWeights.xfp) +           // xFP component (primary anchor)
  (talentScore * modeWeights.talent) +      // Talent evaluation
  (last6wPerf * modeWeights.recency) +      // Recent performance
  (contextScore * modeWeights.context) -    // Situational context
  (riskScore * modeWeights.risk);           // Risk assessment

// Dynasty-specific age adjustments
const finalScore = baseScore + dynastyAgePenalty;
```

### **4. Dynasty Age Penalty System**
```javascript
// Position-specific age curves with target ages
const dynastyAgeTargets = {
  QB: 27,  // QBs peak later, age slower
  RB: 24,  // RBs decline fastest
  WR: 25,  // WRs peak in mid-20s  
  TE: 26   // TEs peak slightly later
};

// Penalty/bonus calculation
const ageDeviation = age - targetAge;
if (ageDeviation <= -2) return +8;   // Very young: bonus
if (ageDeviation <= -1) return +4;   // Young: small bonus
if (ageDeviation <= 1) return 0;     // Prime: neutral
if (ageDeviation <= 3) return -4;    // Aging: small penalty
if (ageDeviation <= 5) return -8;    // Old: moderate penalty
return -12; // Very old: large penalty
```

---

## 🏈 WR-Specific FPTS Ranking System

### **WR Position Override Logic**
For WR rankings, the system implements **FPTS-based sorting** to ensure elite performers rank appropriately:

```javascript
// Load 2024 season FPTS data from CSV
const fptsMap = new Map<string, number>();
// CSV contains: Ja'Marr Chase (377.4), Justin Jefferson (309.1), etc.

// Override ranking by actual fantasy performance
data.forEach(player => {
  const fpts = fptsMap.get(player.name.toLowerCase()) || 0;
  player.season_fpts = fpts;
});

// Sort by FPTS descending (highest fantasy producers first)
data.sort((a, b) => (b.season_fpts || 0) - (a.season_fpts || 0));
```

### **Elite WR Data Source**
- **File**: `WR_2024_Ratings_With_Tags.csv`
- **Top Performers**: Ja'Marr Chase (377.4 FPTS), Justin Jefferson (309.1 FPTS)
- **Metrics**: Total FPTS, Targets, Receptions, Receiving Yards, YPT, YPC

---

## 🔄 Data Pipeline Architecture

### **1. Live Sleeper API Integration**
```javascript
// Multi-week data collection for season totals
for (let week = 1; week <= 17; week++) {
  const response = await axios.get(
    `https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`
  );
  // Process weekly stats, aggregate to season totals
}
```

### **2. WR Game Logs Processing**
- **Source**: Sleeper API weekly stats (Weeks 1-17)
- **Metrics Captured**: 
  - Fantasy Points (PPR scoring)
  - Snap Percentage  
  - Targets, Receptions, Receiving Yards
  - Yards per Target (YPT), Yards per Catch (YPC)
  - Rushing stats for comprehensive view
  - Weekly rankings

### **3. Data Normalization Service**
```javascript
// sleeperDataNormalizationService transforms raw API data into
// standardized format for xFP calculation
const normalizedPlayers = await sleeperDataNormalizationService.getNormalizedPlayers();
```

---

## ⚙️ Configuration System

### **Mode-Specific Weights (Dynasty vs Redraft)**
```json
{
  "modes": {
    "dynasty": {
      "xfp": 0.60,      // 60% weight on xFP anchor (heavily statistical)
      "talent": 0.15,   // 15% weight on talent evaluation
      "recency": 0.10,  // 10% weight on recent performance
      "context": 0.10,  // 10% weight on situational context
      "risk": 0.05      // 5% weight on risk factors
    },
    "redraft": {
      "xfp": 0.70,      // 70% weight on xFP (immediate production focus)
      "talent": 0.10,   // 10% weight on talent (less future concern)
      "recency": 0.12,  // 12% weight on recent performance
      "context": 0.06,  // 6% weight on context
      "risk": 0.02      // 2% weight on risk (minimal for single season)
    }
  }
}
```

### **Tier System**
```json
{
  "tiers": {
    "cutoffs": [90, 80, 70, 60, 50] // Elite, High-End, Solid, Flex, Deep
  }
}
```

---

## 🚀 API Endpoints

### **Primary Rankings Endpoint**
```
GET /api/rankings/deepseek/v3.1
Query Parameters:
- mode: "dynasty" | "redraft" 
- position: "QB" | "RB" | "WR" | "TE" | "ALL"
- debug: "1" (optional, shows component breakdown)
```

### **WR Game Logs Endpoint** 
```
GET /api/wr-game-logs/combined
Returns: Elite WR data + additional player season totals
```

---

## 📈 Scoring Component Breakdown

### **xFP Score Normalization**
```javascript
// Convert raw xFP to 0-100 scale within position
const xfpValues = playersForPos.map(p => p.xfp);
const min = Math.min(...xfpValues);
const max = Math.max(...xfpValues);

const xfpScore = Math.max(0, Math.min(100, 
  ((player.xfp - min) / (max - min)) * 100
));
```

### **Risk Score Calculation**
```javascript
// Age-based risk assessment by position
const ageRiskThresholds = {
  RB: 28,  // RBs age quickly
  WR: 30,  // WRs age moderately  
  TE: 31,  // TEs age slower
  QB: 33   // QBs age slowest
};

let riskScore = 15; // Base risk
if (age > threshold) {
  riskScore += (age - threshold) * 5; // +5 risk per year over threshold
}
```

---

## 📁 Key System Files

### **Core Service Files**
- `server/services/deepseekV3.1Service.ts` - Main ranking engine
- `server/services/xfpTrainer.ts` - OLS regression trainer  
- `server/services/xfpRepository.ts` - Coefficient management
- `server/services/wrGameLogsService.ts` - WR data processing
- `server/routes/rankingsV3.ts` - API endpoints

### **Configuration Files**
- `config/deepseek.v3.1.json` - Weights, thresholds, tier cutoffs
- `config/xfp.coeffs.seed.json` - xFP regression coefficients (if exists)

### **Data Files**
- `server/data/WR_2024_Ratings_With_Tags.csv` - Elite WR season stats
- `server/data/wr_2024_additional_game_logs.json` - Extended WR data

---

## 🔍 Quality Control & Debugging

### **Sanity Check Flags**
The system includes automated quality control:
- `unknown_player_elite_score` - Unknown players with unrealistic high scores
- `age_bonus_overwhelming` - Age bonus overwhelming talent differences  
- `low_talent_high_score` - Low talent but high final scores
- `xfp_potentially_inflated` - xFP scores that may be inflated

### **Debug Mode**
When `debug=1` is enabled, the API returns complete component breakdowns:
```json
{
  "debug": {
    "xfp": 85.5,
    "talent": 90.0, 
    "recency": 75.0,
    "components": {
      "xfp_weighted": 34.2,
      "talent_weighted": 22.5
    },
    "final_score": 87.3,
    "sanity_flags": []
  }
}
```

---

## 🎯 Key Innovations

1. **xFP Anchoring**: Objective statistical foundation prevents subjective bias
2. **Position-Specific Logic**: Tailored calculations for QB/RB/WR/TE differences
3. **Dynasty Age Curves**: Sophisticated age penalty system by position
4. **FPTS Override for WRs**: Elite performers ranked by actual fantasy production
5. **Live Season Totals**: Ready for weekly updates when new season starts
6. **Comprehensive Metrics**: Full receiving stats display (FPTS, TAR, REC, YD, YPT, YPC, TD)

---

## 📊 Current WR Rankings (FPTS-Based)

Top 5 WRs by 2024 Season FPTS:
1. **Ja'Marr Chase**: 377.4 FPTS (161 TAR, 117 REC, 1612 YD)
2. **Justin Jefferson**: 309.1 FPTS (145 TAR, 100 REC, 1479 YD)  
3. **Amon-Ra St. Brown**: 302.5 FPTS (134 TAR, 109 REC, 1186 YD)
4. **Brian Thomas**: 266.7 FPTS (122 TAR, 80 REC, 1179 YD)
5. **CeeDee Lamb**: 263.4 FPTS (152 TAR, 101 REC, 1194 YD)

---

*This system provides a robust, mathematically-grounded approach to fantasy football rankings with position-specific optimizations and comprehensive data integration.*