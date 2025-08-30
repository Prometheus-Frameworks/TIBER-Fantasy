# Player Compass Methodology - Comprehensive System Documentation

## 🎯 Overview
The **Player Compass System** is a dynamic, context-aware player evaluation framework that replaces rigid rankings with flexible, scenario-based guidance. Built around a **4-directional compass model** with equal 25% weighting, it provides multidimensional player analysis for dynasty and redraft fantasy football decision-making.

## 🧭 Core Philosophy
> **"Context-aware player guidance instead of rigid rankings"**

The Player Compass prioritizes:
- **Scenario flexibility** - Players evaluated across multiple team contexts
- **Dynasty focus** - Age curves and long-term value assessment  
- **Position-specific logic** - Tailored evaluation criteria per position
- **Market efficiency** - Value identification vs ADP/market perception

---

## 🔢 Mathematical Framework

### **4-Directional Equal Weighting System**
```typescript
const finalScore = (north * 0.25) + (east * 0.25) + (south * 0.25) + (west * 0.25);
const cappedScore = Math.min(10.0, Math.max(1.0, finalScore)); // 1-10 scale
```

### **Compass Directions Defined**
- **🧭 NORTH (Volume/Talent)**: Raw usage, skill metrics, opportunity share
- **🧭 EAST (Environment/Scheme)**: Team context, offensive system, role security  
- **🧭 SOUTH (Risk/Durability)**: Age curves, injury history, positional decline
- **🧭 WEST (Value/Market)**: Dynasty value, market efficiency, contract status

---

## 🏈 Position-Specific Implementations

## Wide Receiver (WR) Compass

### **NORTH Score - Volume/Talent (25%)**
```typescript
function calculateWRNorthScore(anchorScore: number): number {
  const baseScore = 5.0;
  const normalizedAnchor = anchorScore || 5.0;
  
  // Convert anchor score to compass scale (1-10)
  const volumeScore = Math.max(1.0, Math.min(10.0, normalizedAnchor));
  return volumeScore;
}
```

### **EAST Score - Environment/Scheme (25%)**
```typescript
function calculateWREastScore(contextTags: any[]): number {
  const baseScore = 5.0;
  let environmentBonus = 0;
  
  contextTags.forEach(tag => {
    const tagLower = String(tag).toLowerCase();
    
    // Positive environment indicators
    if (tagLower.includes('target_hog') || tagLower.includes('alpha')) {
      environmentBonus += 1.0;
    }
    if (tagLower.includes('red_zone') || tagLower.includes('touchdown')) {
      environmentBonus += 0.5;
    }
    if (tagLower.includes('deep') || tagLower.includes('big_play')) {
      environmentBonus += 0.5;
    }
    
    // Negative environment indicators  
    if (tagLower.includes('crowded') || tagLower.includes('committee')) {
      environmentBonus -= 1.0;
    }
  });
  
  const environmentScore = baseScore + Math.max(-3.0, Math.min(3.0, environmentBonus));
  return Math.max(1.0, Math.min(10.0, environmentScore));
}
```

### **SOUTH Score - Risk/Durability (25%)**
```typescript
function calculateWRSouthScore(rebuilderScore: number, contenderScore: number, age: number): number {
  const baseScore = 5.0;
  
  // Age factor for WRs (peak around 24-28)
  let ageScore = 0;
  if (age <= 24) ageScore = 3.5;      // Young, room to grow
  else if (age <= 28) ageScore = 4.0; // Peak years
  else if (age <= 31) ageScore = 2.5; // Declining
  else ageScore = 1.5;                // High risk
  
  // Rebuilder vs Contender context
  const contextScore = (rebuilderScore + contenderScore) / 2 || 3.0;
  
  const riskScore = baseScore + 
    (ageScore * 0.6) + 
    (contextScore * 0.4) - 3.0; // Adjust baseline
  
  return Math.max(1.0, Math.min(10.0, riskScore));
}
```

### **WEST Score - Market Value (25%)**
```typescript
function calculateWRWestScore(rawData: any): number {
  const baseScore = 5.0;
  
  const adp = rawData.adp || 100;
  const projectedValue = rawData.projected_value || 50;
  const dynastyValue = rawData.dynasty_value || 50;
  
  // Value calculation with dynasty weighting
  const valueScore = (projectedValue + dynastyValue) / 2 > adp ? 
    Math.min(4.0, ((projectedValue + dynastyValue) / 2 - adp) / 15) : 
    Math.max(-2.0, ((projectedValue + dynastyValue) / 2 - adp) / 25);
  
  const marketScore = baseScore + valueScore;
  return Math.max(1.0, Math.min(10.0, marketScore));
}
```

---

## Running Back (RB) Compass

### **Enhanced Mathematical Foundation**
The RB Compass uses **z-score normalization** against population statistics for more precise evaluation.

### **NORTH Score - Volume/Talent (25%)**
```typescript
function calculateRBNorthScore(playerMetrics: PlayerMetrics, populationStats: PopulationStats): number {
  const metrics = ['rush_att', 'tgt_share', 'gl_carries', 'yac_per_att', 'breakaway_pct'];
  const zScores: number[] = [];
  
  for (const metric of metrics) {
    if (metric in playerMetrics && metric in populationStats) {
      const mean = populationStats[metric].mean;
      const std = populationStats[metric].std;
      const val = playerMetrics[metric];
      const z = std > 0 ? (val - mean) / std : 0;
      zScores.push(z);
    }
  }
  
  const averageZ = zScores.reduce((sum, z) => sum + z, 0) / zScores.length;
  
  // Normal CDF approximation
  const volumeScore = 0.5 * (1 + erf(averageZ / Math.sqrt(2)));
  return 10 * volumeScore;
}
```

### **EAST Score - Environment/Scheme (25%)**
```typescript
function calculateRBEastScore(
  olRank: number, 
  ocRunRate: number, 
  posSnapPct: number, 
  neutralScriptRate: number
): number {
  const baseScore = 5.0;
  
  // O-Line rank (lower is better, normalize to 1-32)
  const olScore = olRank ? (33 - Math.max(1, Math.min(32, olRank))) / 32 * 4 : 2.0;
  
  // Run rate advantage
  const runRateScore = Math.max(0, (ocRunRate - 0.45) * 10); // Above 45% is good
  
  // Snap percentage
  const snapScore = posSnapPct ? posSnapPct * 4 : 2.0;
  
  // Neutral script (game flow)
  const scriptScore = neutralScriptRate ? neutralScriptRate * 4 : 2.0;
  
  const environmentScore = baseScore + 
    (olScore * 0.3) + 
    (runRateScore * 0.3) + 
    (snapScore * 0.2) + 
    (scriptScore * 0.2) - 2.0; // Adjust baseline
  
  return Math.max(1.0, Math.min(10.0, environmentScore));
}
```

### **SOUTH Score - Risk/Durability (25%)**
```typescript
function calculateRBSouthScore(age: number, gamesMissed2yr: number, fumRate: number): number {
  // Enhanced age penalty system for RB position cliff
  let agePen = 0.0;
  if (age <= 24) agePen = 0.0;      // Prime window
  else if (age <= 26) agePen = 0.05; // Slight concern
  else if (age === 27) agePen = 0.15; // Moderate risk
  else if (age === 28) agePen = 0.25; // High risk
  else if (age === 29) agePen = 0.35; // Cliff territory
  else agePen = 0.5;                 // Avoid territory
  
  const injPen = gamesMissed2yr * 0.02;
  const fumPen = fumRate * 5.0;
  const riskPenalty = agePen + injPen + fumPen;
  const longevity = Math.max(0.0, 1.0 - riskPenalty);
  
  return 10 * longevity;
}
```

### **WEST Score - Market Efficiency (25%)**
```typescript
function calculateRBWestScore(derivedData: any): number {
  const projRank = derivedData.proj_rank;
  const adpRank = derivedData.adp_rank;
  const efficiency = 1 - Math.abs(projRank - adpRank) / 36.0;
  
  const posScarcityZ = derivedData.pos_scarcity_z;
  const scarcityNorm = 0.5 * (1 + erf(posScarcityZ / Math.sqrt(2))); // Normal CDF
  
  const contractYrs = derivedData.contract_yrs;
  const contractNorm = Math.min(1.0, contractYrs / 3.0);
  
  const ratio = (efficiency + scarcityNorm + contractNorm) / 3.0;
  return 10 * ratio;
}
```

---

## Tight End (TE) Compass

### **NORTH Score - Volume/Talent (25%)**
```typescript
function calculateTENorthScore(player: TEPlayerData): number {
  const targetsPerGame = player.targets / player.games_played;
  const yardsPerGame = player.receiving_yards / player.games_played;
  const redZoneTargetsPerGame = player.red_zone_targets / player.games_played;
  const catchRate = player.receptions / player.targets;
  
  // Volume score (0-10 scale)
  let volumeScore = 0;
  volumeScore += Math.min(4, targetsPerGame / 2.5); // ~10+ targets/game = max
  volumeScore += Math.min(3, yardsPerGame / 25);     // ~75+ yards/game = max
  volumeScore += Math.min(2, redZoneTargetsPerGame * 4); // High RZ usage premium
  volumeScore += Math.min(1, catchRate * 2 - 1);     // 75%+ catch rate = max
  
  // PFF receiving grade adjustment
  const pffAdjustment = (player.pff_receiving_grade - 60) / 40;
  volumeScore *= (1 + Math.max(0, Math.min(0.5, pffAdjustment))); // Up to 50% boost
  
  return Math.max(0, Math.min(10, volumeScore));
}
```

### **TE Position-Specific Features**
- **Red Zone Premium**: Higher weighting for red zone targets due to TE touchdown dependency
- **Blocking Integration**: PFF pass blocking grades factor into scheme fit
- **Longevity Advantage**: TEs age better than RBs/WRs, reflected in age curves

---

## 🎯 Context Tags & Scenario System

### **Dynamic Context Tags**
```typescript
type CompassTag = 
  | 'Win-Now' | 'Dynasty-Build' | 'Boom-Bust' | 'Floor-Play'
  | 'Injury-Risk' | 'Age-Concern' | 'Breakout-Candidate'
  | 'Usage-Secure' | 'Target-Competition' | 'Environment-Dependent'
  | 'Volume-Dependent' | 'Efficiency-Play' | 'Touchdown-Regression'
  | 'Rushing-Upside' | 'Pass-Catching' | 'Deep-Threat'
  | 'Slot-Role' | 'Alpha-Potential' | 'Scheme-Fit';
```

### **Age-Based Tag Assignment**
```typescript
// Age-based tags
if (playerData.age <= 25) tags.push('Dynasty-Build');
if (playerData.age >= 29) tags.push('Age-Concern');
if (playerData.age >= 27 && playerData.age <= 30) tags.push('Win-Now');
```

### **Scenario Scoring Framework**
```typescript
interface CompassScenarios {
  contendingTeam: number;    // 0-10 scale
  rebuildingTeam: number;    // 0-10 scale  
  redraftAppeal: number;     // 0-10 scale
  dynastyCeiling: number;    // 0-10 scale
  injuryReplacement: number; // 0-10 scale
  playoffReliability: number; // 0-10 scale
}
```

---

## 🎲 Age Curve Methodology

### **Position-Specific Age Windows**
```typescript
// RB Age Curves (Aggressive Decline)
if (age <= 24) { primeWindow = 'Entering'; yearsRemaining = 4; }
else if (age <= 27) { primeWindow = 'Prime'; yearsRemaining = 2; }
else if (age <= 29) { primeWindow = 'Peak'; yearsRemaining = 1; }
else { primeWindow = 'Declining'; yearsRemaining = 0; }

// WR Age Curves (Moderate Decline)  
if (age <= 25) { primeWindow = 'Entering'; yearsRemaining = 5; }
else if (age <= 29) { primeWindow = 'Prime'; yearsRemaining = 3; }
else if (age <= 32) { primeWindow = 'Peak'; yearsRemaining = 1; }
else { primeWindow = 'Declining'; yearsRemaining = 0; }

// QB Age Curves (Extended Prime)
if (age <= 26) { primeWindow = 'Entering'; yearsRemaining = 8; }
else if (age <= 32) { primeWindow = 'Prime'; yearsRemaining = 5; }
else if (age <= 36) { primeWindow = 'Peak'; yearsRemaining = 2; }
else { primeWindow = 'Veteran'; yearsRemaining = 1; }

// TE Age Curves (TE Advantage)
if (age <= 26) { primeWindow = 'Entering'; yearsRemaining = 6; }
else if (age <= 30) { primeWindow = 'Prime'; yearsRemaining = 4; }
else if (age <= 33) { primeWindow = 'Peak'; yearsRemaining = 2; }
else { primeWindow = 'Declining'; yearsRemaining = 0; }
```

---

## 🏆 Tier Classification System

### **Dynasty Tier Mapping**
```typescript
function calculateTier(prometheusScore: number): CompassTier {
  if (prometheusScore >= 90) return 'Elite';      // Top 5-10 players
  if (prometheusScore >= 80) return 'High-End';   // Top 15-20 players  
  if (prometheusScore >= 70) return 'Solid';      // Reliable starters
  if (prometheusScore >= 60) return 'Upside';     // Breakout candidates
  return 'Deep';                                  // Dart throws/bench
}
```

### **Enhanced TE Tier System**
```typescript
// TE-specific tiers (more granular due to position scarcity)
if (score >= 8.5) tier = 'Elite';        // Kelce/Andrews tier
else if (score >= 7.5) tier = 'Excellent'; // Clear TE1s
else if (score >= 6.5) tier = 'Solid';     // Reliable weekly starts
else if (score >= 5.5) tier = 'Decent';    // Spot starts/bye fills
else if (score >= 4.5) tier = 'Concerning'; // Avoid unless desperate
else tier = 'Avoid';                       // Roster cloggers
```

---

## 🔌 Integration Patterns

### **Prometheus Score Integration**
```typescript
// Use existing Prometheus score if available
const prometheusScore = playerData.prometheusScore || this.estimatePrometheusScore(playerData);

// Fallback estimation for missing scores
private estimatePrometheusScore(playerData: any): number {
  const baseScore = (playerData.fpg || 0) * 4; // Rough conversion
  return Math.min(100, Math.max(0, baseScore));
}
```

### **Team Context Integration**
```typescript
// Enhanced East score with team context
if (teamContext) {
  const passVolumeBonus = (teamContext.passAttempts - 500) / 100;
  east += Math.max(-1.0, Math.min(2.0, passVolumeBonus));
}
```

### **Draft Capital Weighting**
```typescript
// Enhanced North score with draft capital
if (draftCapital && draftCapital.round <= 2) {
  north += 1.0; // Boost for high draft capital
}
```

---

## 📊 API Implementation

### **Core Compass Endpoints**
```typescript
// Position-specific compass endpoints
GET /api/compass/WR?format=dynasty&page=1&pageSize=50&team=BUF&search=jefferson
GET /api/compass/RB?format=dynasty&page=1&pageSize=50  
GET /api/compass/TE?format=dynasty&page=1&pageSize=50
GET /api/compass/QB?format=dynasty&page=1&pageSize=50

// Compass calculation breakdown (debug)
GET /api/compass/calculate/:playerId?debug=1
```

### **Response Structure**
```typescript
interface CompassResponse {
  playerId: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  tier: 'Elite' | 'High-End' | 'Solid' | 'Upside' | 'Deep';
  
  // 4-directional scores
  north: number;      // Volume/Talent (0-10)
  east: number;       // Environment/Scheme (0-10)  
  south: number;      // Risk/Durability (0-10)
  west: number;       // Value/Market (0-10)
  score: number;      // Final compass score (0-10)
  
  // Context and scenarios
  contextTags: CompassTag[];
  scenarios: CompassScenarios;
  ageContext: AgeContext;
  keyInsights: string[];
  riskFactors: string[];
  
  timestamp: Date;
}
```

---

## 🎯 Practical Usage Examples

### **Dynasty Trade Analysis**
```typescript
// Use compass scores to evaluate trade fairness
const player1Compass = generateCompassProfile(player1Data);
const player2Compass = generateCompassProfile(player2Data);

// Compare dynasty scenarios
const dynastyGap = player1Compass.scenarios.dynastyCeiling - player2Compass.scenarios.dynastyCeiling;
const ageGap = player2Compass.ageContext.yearsRemaining - player1Compass.ageContext.yearsRemaining;
```

### **Breakout Candidate Identification**  
```typescript
// Find players with upside tags and favorable contexts
const breakoutCandidates = profiles.filter(profile => 
  profile.contextTags.includes('Breakout-Candidate') &&
  profile.scenarios.dynastyCeiling > 7.0 &&
  profile.ageContext.primeWindow === 'Entering'
);
```

### **Age-Based Portfolio Management**
```typescript
// Identify aging assets for selling window
const sellCandidates = profiles.filter(profile =>
  profile.ageContext.primeWindow === 'Peak' &&
  profile.contextTags.includes('Age-Concern') &&
  profile.scenarios.contendingTeam > 7.0 // Still valuable to contenders
);
```

---

## 🔬 Advanced Features

### **Population Z-Score Normalization (RB)**
```typescript
// Statistical normalization against positional population
const averageZ = zScores.reduce((sum, z) => sum + z, 0) / zScores.length;
const volumeScore = 0.5 * (1 + erf(averageZ / Math.sqrt(2))); // Normal CDF
```

### **Context Tag Modifiers**
```typescript
const contextTagModifiers: Record<string, number> = {
  'usage_security': 0.6,
  'target_competition': 0.15,  
  'role_clarity': 0.2,
  'breakout_candidate': 0.15,
  'scheme_fit': 0.1,
  'elite': 0.3,
  'injury_prone': -0.2
};
```

### **Risk Assessment Framework**
```typescript
// Multi-factor risk evaluation
const riskFactors = [];
if (playerData.injuryHistory?.length > 0) risks.push('Injury history concerns');
if (playerData.age >= 29 && playerData.position === 'RB') risks.push('Age cliff risk');
if (playerData.contractStatus === 'Expiring') risks.push('Contract uncertainty');
if (playerData.targetCompetition === 'High') risks.push('High target competition');
```

---

## 🎓 Implementation Philosophy

### **Design Principles**
1. **Context Over Rankings**: Flexible evaluation vs rigid numerical lists
2. **Equal Weighting**: No single metric dominates evaluation  
3. **Position Specificity**: Tailored logic recognizes positional differences
4. **Age Awareness**: Dynasty focus with realistic career arcs
5. **Market Efficiency**: Value identification vs consensus perception

### **Key Advantages**
- **Scenario Flexibility**: One player evaluated across multiple contexts
- **Age Integration**: Built-in dynasty aging curves and windows
- **Risk Quantification**: Multi-dimensional risk assessment
- **Market Analysis**: Efficiency gaps vs ADP/consensus
- **Tag-Based Discovery**: Context-aware player discovery and filtering

### **Integration Points**
- **Prometheus Compatibility**: Leverages existing scoring when available
- **Team Context**: OASIS R server integration ready
- **Draft Capital**: Historical draft position weighting
- **Injury Data**: MySportsFeeds integration for risk assessment
- **ADP Integration**: Sleeper API for market efficiency calculations

The Player Compass represents a **paradigm shift from static rankings to dynamic, context-aware player evaluation**, providing the flexibility needed for sophisticated dynasty league management and decision-making.