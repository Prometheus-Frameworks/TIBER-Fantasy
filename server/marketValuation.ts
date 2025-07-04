/**
 * Market Valuation System
 * Integrates KTC and FantasyCalc APIs for authentic dynasty values
 */

interface FantasyCalcPlayer {
  player: {
    name: string;
    position: string;
    team: string;
    age: number;
  };
  value: number;
  overallRank: number;
  positionRank: number;
  trend30Day: number;
}

interface MarketValue {
  playerName: string;
  fantasyCalcValue: number;
  fantasyCalcRank: number;
  ktcValue?: number;
  compositeValue: number;
  marketTier: string;
  confidence: 'high' | 'medium' | 'low';
}

export class MarketValuationService {
  private readonly FANTASY_CALC_API = 'https://api.fantasycalc.com/values/current';
  private marketCache = new Map<string, MarketValue>();
  private lastUpdate = 0;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  /**
   * Get dynasty values from FantasyCalc API
   */
  async getFantasyCalcValues(): Promise<FantasyCalcPlayer[]> {
    try {
      const params = new URLSearchParams({
        isDynasty: 'true',
        numQbs: '1',
        numTeams: '12',
        ppr: '1'
      });

      const response = await fetch(`${this.FANTASY_CALC_API}?${params}`);
      if (!response.ok) {
        throw new Error(`FantasyCalc API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch FantasyCalc values:', error);
      return [];
    }
  }

  /**
   * Get market dynasty value for a player
   */
  async getMarketValue(playerName: string): Promise<MarketValue | null> {
    // Check cache first
    if (this.marketCache.has(playerName) && Date.now() - this.lastUpdate < this.CACHE_DURATION) {
      return this.marketCache.get(playerName) || null;
    }

    // Refresh cache if needed
    if (Date.now() - this.lastUpdate > this.CACHE_DURATION) {
      await this.refreshMarketData();
    }

    return this.marketCache.get(playerName) || null;
  }

  /**
   * Refresh market data from APIs
   */
  private async refreshMarketData(): Promise<void> {
    try {
      console.log('🔄 Refreshing market data from FantasyCalc...');
      
      const fantasyCalcData = await this.getFantasyCalcValues();
      
      this.marketCache.clear();
      
      for (const player of fantasyCalcData) {
        const marketValue: MarketValue = {
          playerName: player.player.name,
          fantasyCalcValue: player.value,
          fantasyCalcRank: player.overallRank,
          compositeValue: player.value, // Use FantasyCalc as primary
          marketTier: this.getMarketTier(player.value),
          confidence: 'high'
        };
        
        // Normalize player name for lookup
        const normalizedName = this.normalizePlayerName(player.player.name);
        this.marketCache.set(normalizedName, marketValue);
      }
      
      this.lastUpdate = Date.now();
      console.log(`✅ Updated market data for ${this.marketCache.size} players`);
      
    } catch (error) {
      console.error('❌ Failed to refresh market data:', error);
    }
  }

  /**
   * Get market tier based on value
   */
  private getMarketTier(value: number): string {
    if (value >= 8000) return 'Elite';
    if (value >= 6000) return 'Premium';
    if (value >= 4000) return 'Strong';
    if (value >= 2000) return 'Solid';
    if (value >= 1000) return 'Depth';
    return 'Bench';
  }

  /**
   * Normalize player name for consistent lookups
   */
  private normalizePlayerName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s(ii|jr|sr|iii|iv)\.?$/, '') // Remove suffixes
      .replace(/[^\w\s]/g, '') // Remove special characters
      .trim();
  }

  /**
   * Convert FantasyCalc value to dynasty score (0-100)
   */
  convertToLegacyScore(fantasyCalcValue: number): number {
    // FantasyCalc values typically range from 0-12000+
    // Convert to 0-100 scale for compatibility
    if (fantasyCalcValue >= 8000) return 95 + (fantasyCalcValue - 8000) / 1000; // Elite: 95-100
    if (fantasyCalcValue >= 6000) return 85 + (fantasyCalcValue - 6000) / 200;  // Premium: 85-94
    if (fantasyCalcValue >= 4000) return 75 + (fantasyCalcValue - 4000) / 200;  // Strong: 75-84
    if (fantasyCalcValue >= 2000) return 65 + (fantasyCalcValue - 2000) / 200;  // Solid: 65-74
    if (fantasyCalcValue >= 1000) return 50 + (fantasyCalcValue - 1000) / 66.7; // Depth: 50-64
    
    return Math.max(10, fantasyCalcValue / 20); // Bench: 10-49
  }

  /**
   * Get all cached market values
   */
  getAllMarketValues(): Map<string, MarketValue> {
    return new Map(this.marketCache);
  }

  /**
   * Initialize market data on service start
   */
  async initialize(): Promise<void> {
    await this.refreshMarketData();
  }
}

export const marketValuationService = new MarketValuationService();