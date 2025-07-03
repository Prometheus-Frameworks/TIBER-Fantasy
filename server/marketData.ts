import { Player } from "@shared/schema";

interface MarketValue {
  source: string;
  value: number;
  rank: number;
  lastUpdated: Date;
}

interface AggregatedMarketData {
  playerId: number;
  playerName: string;
  position: string;
  consensusValue: number;
  consensusRank: number;
  valueRange: { min: number; max: number };
  sources: MarketValue[];
  confidence: number; // 0-100, based on source agreement
  lastUpdated: Date;
}

export class MarketDataService {
  private cache = new Map<string, AggregatedMarketData>();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  async getMarketData(player: Player): Promise<AggregatedMarketData> {
    const cacheKey = `${player.id}-${player.name}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.lastUpdated)) {
      return cached;
    }

    const marketData = await this.aggregateMarketData(player);
    this.cache.set(cacheKey, marketData);
    return marketData;
  }

  private async aggregateMarketData(player: Player): Promise<AggregatedMarketData> {
    const sources: MarketValue[] = [];
    
    // Sleeper ADP (from their API)
    try {
      const sleeperData = await this.getSleeperADP(player);
      if (sleeperData) sources.push(sleeperData);
    } catch (error) {
      console.warn(`Failed to fetch Sleeper ADP for ${player.name}:`, error);
    }

    // FantasyPros consensus rankings (they have an API)
    try {
      const fpData = await this.getFantasyProsRanking(player);
      if (fpData) sources.push(fpData);
    } catch (error) {
      console.warn(`Failed to fetch FantasyPros data for ${player.name}:`, error);
    }

    // ESPN consensus rankings (public API)
    try {
      const espnData = await this.getESPNRanking(player);
      if (espnData) sources.push(espnData);
    } catch (error) {
      console.warn(`Failed to fetch ESPN data for ${player.name}:`, error);
    }

    // Calculate consensus
    const consensusValue = this.calculateConsensusValue(sources);
    const consensusRank = this.calculateConsensusRank(sources);
    const confidence = this.calculateConfidence(sources);

    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      consensusValue,
      consensusRank,
      valueRange: {
        min: Math.min(...sources.map(s => s.value)),
        max: Math.max(...sources.map(s => s.value))
      },
      sources,
      confidence,
      lastUpdated: new Date()
    };
  }

  private async getSleeperADP(player: Player): Promise<MarketValue | null> {
    // Sleeper has public ADP data
    const response = await fetch(`https://api.sleeper.app/v1/players/nfl`);
    if (!response.ok) return null;
    
    const players = await response.json();
    const sleeperPlayer = Object.values(players).find((p: any) => 
      p.full_name?.toLowerCase() === player.name.toLowerCase()
    ) as any;
    
    if (!sleeperPlayer?.fantasy_positions?.includes(player.position)) {
      return null;
    }

    // Get ADP data from drafts
    const adpResponse = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/2024`);
    if (!adpResponse.ok) return null;
    
    // This is a simplified version - Sleeper's ADP is more complex
    return {
      source: "Sleeper",
      value: sleeperPlayer.adp || 999,
      rank: sleeperPlayer.adp || 999,
      lastUpdated: new Date()
    };
  }

  private async getFantasyProsRanking(player: Player): Promise<MarketValue | null> {
    // FantasyPros has public APIs for rankings
    // This would require their API key for detailed data
    return null; // Placeholder for now
  }

  private async getESPNRanking(player: Player): Promise<MarketValue | null> {
    // ESPN has public consensus rankings
    // This would parse their public ranking pages
    return null; // Placeholder for now
  }

  private calculateConsensusValue(sources: MarketValue[]): number {
    if (sources.length === 0) return 0;
    
    // Weight recent sources more heavily
    const weights = sources.map(s => {
      const hoursOld = (Date.now() - s.lastUpdated.getTime()) / (1000 * 60 * 60);
      return Math.max(0.1, 1 - (hoursOld / 24)); // Decay over 24 hours
    });
    
    const weightedSum = sources.reduce((sum, source, i) => 
      sum + (source.value * weights[i]), 0
    );
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    return Math.round(weightedSum / totalWeight);
  }

  private calculateConsensusRank(sources: MarketValue[]): number {
    if (sources.length === 0) return 999;
    return Math.round(sources.reduce((sum, s) => sum + s.rank, 0) / sources.length);
  }

  private calculateConfidence(sources: MarketValue[]): number {
    if (sources.length === 0) return 0;
    if (sources.length === 1) return 50;
    
    const values = sources.map(s => s.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher confidence
    // Scale to 0-100 range
    const coefficient = stdDev / mean;
    return Math.max(0, Math.min(100, 100 - (coefficient * 100)));
  }

  private isCacheValid(lastUpdated: Date): boolean {
    return Date.now() - lastUpdated.getTime() < this.CACHE_DURATION;
  }

  // Get market inefficiency opportunities
  async findValueArbitrageOpportunities(players: Player[]): Promise<any[]> {
    const opportunities = [];
    
    for (const player of players) {
      const marketData = await this.getMarketData(player);
      
      // Compare market consensus vs our analytics
      const analyticsScore = this.calculateAnalyticsScore(player);
      const marketValue = marketData.consensusValue;
      
      // Look for large discrepancies
      const discrepancy = analyticsScore - marketValue;
      const confidence = marketData.confidence;
      
      if (Math.abs(discrepancy) > 20 && confidence > 60) {
        opportunities.push({
          player,
          marketData,
          analyticsScore,
          discrepancy,
          recommendation: discrepancy > 0 ? 'BUY' : 'SELL',
          confidence,
          reason: this.getArbitrageReason(discrepancy, player)
        });
      }
    }
    
    return opportunities.sort((a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy));
  }

  private calculateAnalyticsScore(player: Player): number {
    // This would use our NFL-Data-Py analytics
    // For now, use basic fantasy points as proxy
    return player.avgPoints * 10; // Scale to match market values
  }

  private getArbitrageReason(discrepancy: number, player: Player): string {
    if (discrepancy > 0) {
      return `Analytics suggest ${player.name} is undervalued by ${Math.abs(discrepancy)} points based on advanced metrics`;
    } else {
      return `Analytics suggest ${player.name} is overvalued by ${Math.abs(discrepancy)} points based on market pricing`;
    }
  }
}

export const marketDataService = new MarketDataService();