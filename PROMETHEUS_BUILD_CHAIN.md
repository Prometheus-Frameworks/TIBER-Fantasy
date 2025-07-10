# PROMETHEUS BUILD CHAIN
**The operational framework that powers the Prometheus Fantasy Platform**

## Enhanced Trade Evaluation System v2.0

### Core Architecture
- **verdictSystem.ts**: Grok-enhanced verdict engine with strength classification
- **rbValueDeRisker.ts**: Advanced RB value analysis with 10+ risk factors
- **tradeLogic.ts**: Multi-factor evaluation engine with tier-based scoring
- **API Endpoint**: `/api/trade-eval/` with comprehensive validation

### Trade Balance Index (TBI) System
```typescript
TBI = ((MaxScore - MinScore) / TotalScore) * 100
```

#### Verdict Classifications:
- **Even Trade**: TBI < 50% (balanced value exchange)
- **Slight Edge**: TBI 10-24% (minor advantage)
- **Moderate Win**: TBI 25-39% (clear winner)
- **Strong Win**: TBI 40%+ (significant advantage)

### RB Value De-Risking Framework
Advanced risk assessment using 10 evaluation metrics:

#### Primary Risk Factors:
1. **Breakaway Run Rate** (-4 max penalty)
2. **Receiving Efficiency** (-3 max penalty) 
3. **Fumble Risk** (-2 max penalty)
4. **Draft Capital** (-3 penalty for Day 3/UDFA)
5. **Durability** (-3 max penalty for injury history)

#### Advanced Risk Factors:
6. **Contract Security** (-1 penalty for no secure contract)
7. **Aging Curve** (-3 max penalty for 25+ non-elite RBs)
8. **Backfield Competition** (-2 max penalty)
9. **Scheme Fit** (-2 max penalty)
10. **ADP Inflation** (-2 max penalty)
11. **Workload Sustainability** (-2 max penalty)

### Configurable Evaluation Parameters
```typescript
interface TradeEvaluationConfig {
  evenTradeThreshold: 50,        // Fair trade threshold
  minContributionRatio: 0.1,     // 10% minimum value contribution
  verdictStrengthThresholds: {
    slightEdge: 10,              // 10% TBI for slight edge
    moderateWin: 25,             // 25% TBI for moderate win  
    strongWin: 40                // 40% TBI for strong win
  }
}
```

### API Integration
**POST /api/trade-eval**
```json
{
  "teamA": [
    {
      "id": "player_id",
      "prometheusScore": 85,
      "name": "Josh Allen",
      "position": "QB",
      "tier": "Elite",
      "isStarter": true,
      "age": 28
    }
  ],
  "teamB": [...]
}
```

**Response Format:**
```json
{
  "winner": "Team A wins",
  "confidence": 78,
  "valueDifference": 12,
  "balanceIndex": 22,
  "verdict": {
    "outcome": "Team A wins",
    "tag": "🔥 Overpay Detected",
    "strength": "Moderate Win",
    "confidenceScore": 78,
    "justificationLog": ["Trade balance index: 22%..."],
    "recommendation": "Team B is giving up more value..."
  },
  "analysis": {
    "teamA": {
      "totalValue": 142,
      "playerDetails": [...]
    },
    "teamB": {...}
  }
}
```

### Validation & Error Handling
- Complete input validation for player objects
- Prometheus score range validation (0-100)
- Position-specific analysis capability
- Comprehensive error messages with specific guidance

### Integration Safety
- Maintains backward compatibility with legacy `/api/evaluate-trade`
- Modular architecture allows independent testing
- Safe RB de-risking that preserves original values
- Enhanced logging for debugging and validation

This enhanced system provides sophisticated dynasty trade analysis while maintaining the platform's commitment to transparency and advanced analytics.