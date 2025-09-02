/**
 * ADP Client - Addressing Grok's FantasyPros API gap
 * Uses alternative sources and scraping approaches
 */

import axios from 'axios';

export interface ADPData {
  playerId: string;
  playerName: string;
  position: string;
  adp: number;
  adpChange: number; // Week-to-week change
  source: string;
  lastUpdated: Date;
}

export interface MarketSentiment {
  rostership: number;
  startPct: number;
  adpDelta: number;
  trendDirection: 'rising' | 'falling' | 'stable';
}

// ========================================
// ALTERNATIVE ADP SOURCES (Grok's Recommendations)
// ========================================

/**
 * Fantasy Football Calculator API Client
 * Grok's recommendation: "Free REST API for ADP data, with historical pulls by date range"
 */
export class FantasyCalculatorClient {
  private readonly API_BASE = 'https://fantasyfootballcalculator.com/api';
  
  async getADP(playerId: string, format: 'standard' | 'ppr' = 'ppr'): Promise<ADPData | null> {
    try {
      // Fantasy Calculator's ADP endpoint structure
      const response = await axios.get(`${this.API_BASE}/v1/adp/${format}`, {
        timeout: 5000
      });
      
      const playerData = response.data.players?.find((p: any) => 
        p.player_id === playerId || p.name.toLowerCase().includes(playerId.toLowerCase())
      );
      
      if (!playerData) return null;
      
      return {
        playerId: playerData.player_id || playerId,
        playerName: playerData.name,
        position: playerData.position,
        adp: playerData.adp,
        adpChange: playerData.adp_change || 0,
        source: 'FantasyCalculator',
        lastUpdated: new Date()
      };
      
    } catch (error) {
      console.error('Fantasy Calculator ADP fetch failed:', error);
      return null;
    }
  }
  
  async getADPTrend(playerId: string, days: number = 7): Promise<number[]> {
    try {
      // Historical ADP endpoint
      const response = await axios.get(`${this.API_BASE}/v1/adp/history`, {
        params: {
          player_id: playerId,
          days: days
        },
        timeout: 5000
      });
      
      return response.data.history?.map((h: any) => h.adp) || [];
      
    } catch (error) {
      console.error('ADP trend fetch failed:', error);
      return [];
    }
  }
}

/**
 * Underdog ADP Client  
 * Grok's recommendation: "Underdog has better real-time ADP feeds if you're okay with best-ball focus"
 */
export class UnderdogADPClient {
  private readonly API_BASE = 'https://api.underdogfantasy.com';
  
  async getADP(playerId: string): Promise<ADPData | null> {
    try {
      // Underdog's player ADP endpoint
      const response = await axios.get(`${this.API_BASE}/beta/v3/over_under_lines`, {
        timeout: 5000
      });
      
      const playerData = response.data.over_under_lines?.find((line: any) => 
        line.appearance?.player?.id === playerId
      );
      
      if (!playerData) return null;
      
      return {
        playerId: playerData.appearance.player.id,
        playerName: playerData.appearance.player.first_name + ' ' + playerData.appearance.player.last_name,
        position: playerData.appearance.player.position,
        adp: playerData.over_under?.under_odds || 0,
        adpChange: 0, // Underdog doesn't provide historical
        source: 'Underdog',
        lastUpdated: new Date()
      };
      
    } catch (error) {
      console.error('Underdog ADP fetch failed:', error);
      return null;
    }
  }
}

/**
 * Sleeper ADP Client (Enhanced)
 * Grok: "Sleeper API might have rostership if we dig"
 */
export class SleeperADPClient {
  private readonly API_BASE = 'https://api.sleeper.app/v1';
  
  async getADP(playerId: string): Promise<ADPData | null> {
    try {
      // Use existing Sleeper player data
      const response = await axios.get(`${this.API_BASE}/players/nfl`, {
        timeout: 5000
      });
      
      const playerData = response.data[playerId];
      if (!playerData) return null;
      
      return {
        playerId,
        playerName: playerData.full_name || `${playerData.first_name} ${playerData.last_name}`,
        position: playerData.position,
        adp: playerData.adp || 999, // Sleeper doesn't always have ADP
        adpChange: 0,
        source: 'Sleeper',
        lastUpdated: new Date()
      };
      
    } catch (error) {
      console.error('Sleeper ADP fetch failed:', error);
      return null;
    }
  }
  
  async getRostership(playerId: string): Promise<number> {
    try {
      // Aggregate rostership from multiple leagues (requires league access)
      // This is a simplified version - real implementation would need league IDs
      return 0.5; // Placeholder - would need league-specific implementation
      
    } catch (error) {
      console.error('Sleeper rostership fetch failed:', error);
      return 0;
    }
  }
}

// ========================================
// MARKET SENTIMENT AGGREGATOR
// ========================================

/**
 * Market Sentiment Service - Aggregates ADP from multiple sources
 */
export class MarketSentimentService {
  private fantasyCalc = new FantasyCalculatorClient();
  private underdog = new UnderdogADPClient();
  private sleeper = new SleeperADPClient();
  
  async getMarketSentiment(playerId: string, playerName: string): Promise<MarketSentiment> {
    try {
      // Get ADP from multiple sources
      const [fcADP, underdogADP, sleeperADP] = await Promise.all([
        this.fantasyCalc.getADP(playerId),
        this.underdog.getADP(playerId),
        this.sleeper.getADP(playerId)
      ]);
      
      // Calculate consensus ADP
      const validADPs = [fcADP, underdogADP, sleeperADP].filter(Boolean);
      const consensusADP = validADPs.length > 0 
        ? validADPs.reduce((sum, adp) => sum + adp!.adp, 0) / validADPs.length
        : 999;
      
      // Get ADP trend from Fantasy Calculator
      const adpTrend = await this.fantasyCalc.getADPTrend(playerId);
      const adpDelta = adpTrend.length >= 2 
        ? adpTrend[adpTrend.length - 1] - adpTrend[0]
        : 0;
      
      // Calculate trend direction
      const trendDirection = adpDelta > 5 ? 'falling' : // ADP increasing = falling rank
                            adpDelta < -5 ? 'rising' : 'stable';
      
      return {
        rostership: await this.estimateRostership(consensusADP),
        startPct: await this.estimateStartPct(consensusADP),
        adpDelta,
        trendDirection
      };
      
    } catch (error) {
      console.error('Market sentiment calculation failed:', error);
      return {
        rostership: 0.5,
        startPct: 0.3,
        adpDelta: 0,
        trendDirection: 'stable'
      };
    }
  }
  
  private async estimateRostership(adp: number): Promise<number> {
    // Estimate rostership based on ADP (rough approximation)
    if (adp <= 50) return 0.9;
    if (adp <= 100) return 0.7;
    if (adp <= 150) return 0.5;
    if (adp <= 200) return 0.3;
    return 0.1;
  }
  
  private async estimateStartPct(adp: number): Promise<number> {
    // Estimate start percentage based on ADP
    if (adp <= 30) return 0.8;
    if (adp <= 60) return 0.6;
    if (adp <= 100) return 0.4;
    if (adp <= 150) return 0.2;
    return 0.05;
  }
}

// ========================================
// EXPORT MAIN ADP CLIENT
// ========================================

export const adpClient = {
  fantasyCalculator: new FantasyCalculatorClient(),
  underdog: new UnderdogADPClient(), 
  sleeper: new SleeperADPClient(),
  marketSentiment: new MarketSentimentService()
};

export default adpClient;