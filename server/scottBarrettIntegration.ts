/**
 * Scott Barrett Analytics Integration into Live Rankings
 * Integrates YPRR, TPRR, Actual Opportunity, and Bell Cow Index into dynasty scoring
 */

import { scottBarrettAnalytics } from './scottBarrettMetrics';
import { getAllDynastyPlayers } from './expandedDynastyDatabase';

interface BarrettEnhancedPlayer {
  id: number;
  name: string;
  position: string;
  team: string;
  age: number;
  avgPoints: number;
  dynastyValue: number;
  dynastyTier: string;
  barrettScore?: number;
  barrettTier?: string;
  actualOpportunity?: number;
  yardsPerRouteRun?: number;
  targetsPerRouteRun?: number;
  bellCowIndex?: number;
  barrettStrengths?: string[];
  barrettConcerns?: string[];
}

export class ScottBarrettRankingIntegration {
  
  /**
   * Enhance all dynasty players with Scott Barrett analytics
   */
  enhanceAllPlayers(): BarrettEnhancedPlayer[] {
    const allPlayers = getAllDynastyPlayers();
    
    return allPlayers.map(player => {
      try {
        const barrettEval = scottBarrettAnalytics.analyzePlayer(player);
        
        return {
          ...player,
          barrettScore: barrettEval.dynastyScore,
          barrettTier: barrettEval.tier,
          actualOpportunity: barrettEval.metrics.actualOpportunity,
          yardsPerRouteRun: barrettEval.metrics.yardsPerRouteRun,
          targetsPerRouteRun: barrettEval.metrics.targetsPerRouteRun,
          bellCowIndex: barrettEval.metrics.bellCowIndex,
          barrettStrengths: barrettEval.strengths,
          barrettConcerns: barrettEval.concerns
        };
      } catch (error) {
        console.warn(`Barrett analysis failed for ${player.name}:`, error);
        return player;
      }
    });
  }
  
  /**
   * Generate hybrid dynasty score combining our algorithm + Barrett methodology
   */
  calculateHybridDynastyScore(player: any): number {
    try {
      const barrettEval = scottBarrettAnalytics.analyzePlayer(player);
      const currentScore = player.dynastyValue || 0;
      
      // Weight: 60% current algorithm + 40% Barrett methodology
      const hybridScore = (currentScore * 0.6) + (barrettEval.dynastyScore * 0.4);
      
      return Math.round(hybridScore);
    } catch (error) {
      console.warn(`Hybrid scoring failed for ${player.name}:`, error);
      return player.dynastyValue || 0;
    }
  }
  
  /**
   * Get players with Barrett analytics for specific position
   */
  getBarrettRankingsByPosition(position: string): BarrettEnhancedPlayer[] {
    const enhancedPlayers = this.enhanceAllPlayers();
    
    return enhancedPlayers
      .filter(p => p.position === position.toUpperCase())
      .sort((a, b) => {
        // Primary sort: Barrett score (if available)
        const aScore = a.barrettScore || a.dynastyValue;
        const bScore = b.barrettScore || b.dynastyValue;
        return bScore - aScore;
      });
  }
  
  /**
   * Get complete Barrett-enhanced rankings across all positions
   */
  getBarrettEnhancedRankings(options: {
    limit?: number;
    format?: 'superflex' | '1qb';
    position?: string;
  } = {}): BarrettEnhancedPlayer[] {
    const { limit = 50, format = 'superflex', position } = options;
    
    let players = this.enhanceAllPlayers();
    
    // Apply format adjustments (QB premium/penalty)
    players = players.map(player => {
      if (player.position === 'QB') {
        if (format === 'superflex') {
          // QB premium in superflex
          player.dynastyValue = Math.min(100, player.dynastyValue + 15);
          if (player.barrettScore) {
            player.barrettScore = Math.min(100, player.barrettScore + 15);
          }
        } else {
          // QB penalty in 1QB
          player.dynastyValue = Math.max(0, player.dynastyValue - 25);
          if (player.barrettScore) {
            player.barrettScore = Math.max(0, player.barrettScore - 25);
          }
        }
      }
      return player;
    });
    
    // Filter by position if specified
    if (position) {
      players = players.filter(p => p.position === position.toUpperCase());
    }
    
    // Sort by hybrid score (Barrett + current algorithm)
    players.sort((a, b) => {
      const aScore = this.calculateHybridDynastyScore(a);
      const bScore = this.calculateHybridDynastyScore(b);
      return bScore - aScore;
    });
    
    return players.slice(0, limit);
  }
  
  /**
   * Get top Barrett analytics insights
   */
  getBarrettInsights(): {
    eliteYPRR: BarrettEnhancedPlayer[];
    eliteTPRR: BarrettEnhancedPlayer[];
    bellCowRBs: BarrettEnhancedPlayer[];
    highOpportunity: BarrettEnhancedPlayer[];
  } {
    const enhancedPlayers = this.enhanceAllPlayers();
    
    return {
      // Elite YPRR (2.00+ threshold)
      eliteYPRR: enhancedPlayers
        .filter(p => (p.yardsPerRouteRun || 0) >= 2.00)
        .sort((a, b) => (b.yardsPerRouteRun || 0) - (a.yardsPerRouteRun || 0))
        .slice(0, 10),
        
      // Elite TPRR (0.20+ threshold)  
      eliteTPRR: enhancedPlayers
        .filter(p => (p.targetsPerRouteRun || 0) >= 0.20)
        .sort((a, b) => (b.targetsPerRouteRun || 0) - (a.targetsPerRouteRun || 0))
        .slice(0, 10),
        
      // Bell Cow RBs (75+ index)
      bellCowRBs: enhancedPlayers
        .filter(p => p.position === 'RB' && (p.bellCowIndex || 0) >= 75)
        .sort((a, b) => (b.bellCowIndex || 0) - (a.bellCowIndex || 0))
        .slice(0, 10),
        
      // High Actual Opportunity (300+ for WRs, 400+ for RBs)
      highOpportunity: enhancedPlayers
        .filter(p => {
          const opportunity = p.actualOpportunity || 0;
          if (p.position === 'RB') return opportunity >= 400;
          if (p.position === 'WR' || p.position === 'TE') return opportunity >= 300;
          return opportunity >= 200;
        })
        .sort((a, b) => (b.actualOpportunity || 0) - (a.actualOpportunity || 0))
        .slice(0, 15)
    };
  }
  
  /**
   * Validate Barrett metrics against established benchmarks
   */
  validateBarrettMetrics(): {
    valid: boolean;
    metrics: {
      avgYPRR: number;
      avgTPRR: number;
      avgBellCowIndex: number;
      avgActualOpportunity: number;
    };
    insights: string[];
  } {
    const enhancedPlayers = this.enhanceAllPlayers();
    const validPlayers = enhancedPlayers.filter(p => p.barrettScore);
    
    if (validPlayers.length === 0) {
      return {
        valid: false,
        metrics: { avgYPRR: 0, avgTPRR: 0, avgBellCowIndex: 0, avgActualOpportunity: 0 },
        insights: ['No Barrett analytics available']
      };
    }
    
    const avgYPRR = validPlayers.reduce((sum, p) => sum + (p.yardsPerRouteRun || 0), 0) / validPlayers.length;
    const avgTPRR = validPlayers.reduce((sum, p) => sum + (p.targetsPerRouteRun || 0), 0) / validPlayers.length;
    const avgBellCowIndex = validPlayers.filter(p => p.position === 'RB').reduce((sum, p) => sum + (p.bellCowIndex || 0), 0) / validPlayers.filter(p => p.position === 'RB').length;
    const avgActualOpportunity = validPlayers.reduce((sum, p) => sum + (p.actualOpportunity || 0), 0) / validPlayers.length;
    
    const insights: string[] = [];
    
    // Validate against Barrett's benchmarks
    if (avgYPRR >= 1.5) insights.push(`✅ YPRR metrics validated (${avgYPRR.toFixed(2)} average)`);
    else insights.push(`⚠️ YPRR below expected range (${avgYPRR.toFixed(2)})`);
    
    if (avgTPRR >= 0.15) insights.push(`✅ TPRR metrics validated (${avgTPRR.toFixed(3)} average)`);
    else insights.push(`⚠️ TPRR below expected range (${avgTPRR.toFixed(3)})`);
    
    if (avgActualOpportunity >= 150) insights.push(`✅ Actual Opportunity metrics validated (${avgActualOpportunity.toFixed(0)} average)`);
    else insights.push(`⚠️ Actual Opportunity below expected range (${avgActualOpportunity.toFixed(0)})`);
    
    return {
      valid: insights.filter(i => i.startsWith('✅')).length >= 2,
      metrics: {
        avgYPRR: Number(avgYPRR.toFixed(2)),
        avgTPRR: Number(avgTPRR.toFixed(3)),
        avgBellCowIndex: Number(avgBellCowIndex.toFixed(1)),
        avgActualOpportunity: Number(avgActualOpportunity.toFixed(0))
      },
      insights
    };
  }
}

export const barrettRankingIntegration = new ScottBarrettRankingIntegration();