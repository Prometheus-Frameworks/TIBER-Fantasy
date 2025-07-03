import { db } from "./db";
import { players, marketData, valueArbitrage, metricCorrelations } from "@shared/schema";
import type { InsertMarketData, InsertValueArbitrage, Player, ValueArbitrage as ValueArbitrageType } from "@shared/schema";
import { eq, and, desc, gt, lt } from "drizzle-orm";

export interface ArbitrageOpportunity {
  player: Player;
  recommendation: 'undervalued' | 'overvalued' | 'fair';
  confidence: number;
  valueGap: number;
  reasonCode: string;
  metrics: {
    yardsPerRouteRun?: number;
    targetShare?: number;
    redZoneTargets?: number;
    snapCountPercent?: number;
  };
  market: {
    adp: number;
    ownershipPercent: number;
  };
}

export class ValueArbitrageService {
  
  // Calculate metrics-based score for a player
  private calculateMetricsScore(player: Player, position: string): number {
    let score = 0;
    let factors = 0;

    // Base scoring on position-specific metrics
    if (position === 'WR' || position === 'TE') {
      // YPRR is crucial for receivers
      if (player.yardsPerRouteRun && player.yardsPerRouteRun > 0) {
        if (player.yardsPerRouteRun > 2.0) score += 25; // Elite YPRR
        else if (player.yardsPerRouteRun > 1.5) score += 15; // Good YPRR
        else if (player.yardsPerRouteRun > 1.0) score += 5; // Average YPRR
        factors++;
      }

      // Target share
      if (player.targetShare && player.targetShare > 0) {
        if (player.targetShare > 25) score += 20; // High target share
        else if (player.targetShare > 20) score += 15; // Good target share  
        else if (player.targetShare > 15) score += 10; // Decent target share
        factors++;
      }

      // Red zone targets
      if (player.redZoneTargets && player.redZoneTargets > 0) {
        if (player.redZoneTargets > 8) score += 15; // High RZ usage
        else if (player.redZoneTargets > 5) score += 10; // Good RZ usage
        else if (player.redZoneTargets > 2) score += 5; // Some RZ usage
        factors++;
      }
    }

    if (position === 'RB') {
      // Snap count percentage is crucial for RBs
      if (player.snapCount && player.snapCount > 0) {
        const snapPercent = (player.snapCount / 70) * 100; // Assume ~70 snaps per game
        if (snapPercent > 70) score += 25; // Workhorse back
        else if (snapPercent > 50) score += 15; // Good usage
        else if (snapPercent > 30) score += 5; // Limited role
        factors++;
      }

      // Carries and targets combined
      const totalTouches = (player.carries || 0) + (player.targetShare || 0);
      if (totalTouches > 20) score += 20; // High touch count
      else if (totalTouches > 15) score += 15; // Good touches
      else if (totalTouches > 10) score += 10; // Decent touches
      factors++;
    }

    // Injury status penalty
    if (player.injuryStatus && player.injuryStatus !== 'Healthy') {
      score -= 10; // Penalty for injury concerns
    }

    // Average the score if we have factors
    return factors > 0 ? score / factors : 0;
  }

  // Analyze a single player for value arbitrage
  async analyzePlayer(playerId: number, week: number = 18, season: number = 2025): Promise<ArbitrageOpportunity | null> {
    // Get player data
    const [player] = await db.select().from(players).where(eq(players.id, playerId));
    if (!player) return null;

    // Get latest market data (using external ID as proxy for ADP ranking for now)
    const marketAdp = parseInt(player.externalId || '999') % 300 || 999;
    const ownershipPercent = player.ownershipPercentage || 0;

    // Calculate metrics score
    const metricsScore = this.calculateMetricsScore(player, player.position);
    
    // Convert ADP to score (lower ADP = higher score)
    const adpScore = marketAdp > 0 ? Math.max(0, 100 - (marketAdp / 3)) : 0;
    
    // Calculate value gap (positive = undervalued, negative = overvalued)
    const valueGap = metricsScore - adpScore;
    
    // Determine recommendation
    let recommendation: 'undervalued' | 'overvalued' | 'fair' = 'fair';
    let confidence = 0;
    let reasonCode = 'metrics_balanced';

    if (Math.abs(valueGap) > 15) {
      confidence = Math.min(95, Math.abs(valueGap) * 2);
      
      if (valueGap > 15) {
        recommendation = 'undervalued';
        // Determine primary reason
        if (player.yardsPerRouteRun && player.yardsPerRouteRun > 2.0) {
          reasonCode = 'elite_yprr_low_adp';
        } else if (player.targetShare && player.targetShare > 25) {
          reasonCode = 'high_target_share_available';
        } else if (player.redZoneTargets && player.redZoneTargets > 8) {
          reasonCode = 'red_zone_upside_undervalued';
        } else {
          reasonCode = 'strong_metrics_low_price';
        }
      } else {
        recommendation = 'overvalued';
        reasonCode = 'poor_metrics_high_adp';
      }
    } else if (Math.abs(valueGap) > 8) {
      confidence = Math.abs(valueGap) * 3;
      recommendation = valueGap > 0 ? 'undervalued' : 'overvalued';
      reasonCode = valueGap > 0 ? 'slight_undervalue' : 'slight_overvalue';
    }

    return {
      player,
      recommendation,
      confidence,
      valueGap,
      reasonCode,
      metrics: {
        yardsPerRouteRun: player.yardsPerRouteRun ?? undefined,
        targetShare: player.targetShare ?? undefined,
        redZoneTargets: player.redZoneTargets ?? undefined,
        snapCountPercent: player.snapCount ? (player.snapCount / 70) * 100 : undefined,
      },
      market: {
        adp: marketAdp,
        ownershipPercent,
      }
    };
  }

  // Find top arbitrage opportunities
  async findArbitrageOpportunities(position?: string, limit: number = 20): Promise<ArbitrageOpportunity[]> {
    // Active players filter - exclude inactive/retired players
    const inactivePlayers = [
      'Joe Flacco', 'Ryan Fitzpatrick', 'Matt Ryan', 'Ben Roethlisberger', 
      'Tom Brady', 'Philip Rivers', 'Drew Brees', 'Eli Manning', 'Case Keenum',
      'Mike White', 'Nathan Peterman', 'Josh Johnson'
    ];

    // Get available players (not on teams)
    let whereConditions = eq(players.isAvailable, true);
    
    if (position) {
      whereConditions = and(whereConditions, eq(players.position, position)) as any;
    }
    
    const allPlayers = await db.select().from(players).where(whereConditions).limit(100);
    
    // Filter out inactive players
    const availablePlayers = allPlayers.filter(player => 
      !inactivePlayers.some(inactive => 
        player.name.toLowerCase().includes(inactive.toLowerCase())
      )
    );
    
    const opportunities: ArbitrageOpportunity[] = [];
    
    for (const player of availablePlayers) {
      const opportunity = await this.analyzePlayer(player.id);
      if (opportunity && opportunity.recommendation !== 'fair' && opportunity.confidence > 50) {
        opportunities.push(opportunity);
      }
    }
    
    // Sort by confidence and value gap
    return opportunities
      .sort((a, b) => {
        // Prioritize undervalued players with high confidence
        if (a.recommendation === 'undervalued' && b.recommendation !== 'undervalued') return -1;
        if (b.recommendation === 'undervalued' && a.recommendation !== 'undervalued') return 1;
        
        // Then sort by confidence
        return b.confidence - a.confidence;
      })
      .slice(0, limit);
  }

  // Save arbitrage analysis to database
  async saveArbitrageAnalysis(opportunity: ArbitrageOpportunity, week: number = 18, season: number = 2025): Promise<void> {
    const arbitrageData: InsertValueArbitrage = {
      playerId: opportunity.player.id,
      adpValue: opportunity.market.adp,
      metricsScore: this.calculateMetricsScore(opportunity.player, opportunity.player.position),
      valueGap: opportunity.valueGap,
      recommendation: opportunity.recommendation,
      confidence: opportunity.confidence,
      reasonCode: opportunity.reasonCode,
      weeklyChange: 0, // Will be calculated when we have historical data
      targetShare: opportunity.metrics.targetShare,
      yardsPerRouteRun: opportunity.metrics.yardsPerRouteRun,
      redZoneTargets: opportunity.metrics.redZoneTargets,
      snapCountPercent: opportunity.metrics.snapCountPercent,
      week,
      season,
    };

    await db.insert(valueArbitrage).values(arbitrageData).onConflictDoUpdate({
      target: [valueArbitrage.playerId, valueArbitrage.week, valueArbitrage.season],
      set: {
        ...arbitrageData,
        lastUpdated: new Date(),
      },
    });
  }

  // Get historical arbitrage data for tracking accuracy
  async getHistoricalArbitrage(playerId: number, weeks: number = 4): Promise<ValueArbitrageType[]> {
    return await db.select()
      .from(valueArbitrage)
      .where(eq(valueArbitrage.playerId, playerId))
      .orderBy(desc(valueArbitrage.week))
      .limit(weeks);
  }

  // Calculate hit rate for arbitrage recommendations
  async calculateHitRate(weeks: number = 4): Promise<{ status: string; message: string; dataAvailable: boolean }> {
    // We need actual historical data to calculate real hit rates
    // This requires tracking recommendations over multiple weeks/seasons
    return {
      status: "insufficient_data",
      message: "Hit rate calculation requires historical tracking data from multiple NFL weeks. System is currently collecting baseline metrics.",
      dataAvailable: false
    };
  }
}

export const valueArbitrageService = new ValueArbitrageService();