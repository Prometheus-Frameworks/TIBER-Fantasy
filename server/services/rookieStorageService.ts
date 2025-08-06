/**
 * Rookie Storage Service
 * Position-based rookie data storage and retrieval system
 * Integrates with compass evaluation and dynasty tier systems
 */

import fs from 'fs';
import path from 'path';

interface RookiePlayer {
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  bye_week?: number;
  adp?: number;
  projected_points?: number;
  // Position-specific stats
  rush_yds?: number;
  rec_yds?: number;
  rec?: number;
  rush_td?: number;
  rec_td?: number;
  rush?: number;
  // College integration fields
  college?: string;
  draft_round?: number;
  draft_pick?: number;
  draft_capital_tier?: 'Elite' | 'High' | 'Mid' | 'Late' | 'UDFA';
}

interface RookieStorage {
  QB: RookiePlayer[];
  RB: RookiePlayer[];
  WR: RookiePlayer[];
  TE: RookiePlayer[];
}

class RookieStorageService {
  private rookieStorage: RookieStorage = {
    QB: [],
    RB: [],
    WR: [],
    TE: []
  };

  private rookieDataPath = path.join(process.cwd(), 'rookies.json');
  private isInitialized = false;

  /**
   * Initialize rookie storage from existing rookie data
   */
  public initializeRookieStorage(): void {
    if (this.isInitialized) return;

    try {
      console.log('🔄 Initializing position-based rookie storage...');
      
      // Load existing rookie data
      const rookieData = this.loadRookieData();
      
      // Clear existing storage
      this.rookieStorage = { QB: [], RB: [], WR: [], TE: [] };
      
      // Organize by position
      for (const player of rookieData) {
        const position = player.position as keyof RookieStorage;
        if (position && this.rookieStorage[position]) {
          this.rookieStorage[position].push(player);
        } else {
          console.warn(`⚠️ Unknown position for rookie: ${player.name} (${player.position})`);
        }
      }

      this.isInitialized = true;
      this.logStorageSummary();
      
    } catch (error) {
      console.error('❌ Failed to initialize rookie storage:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Load rookie data from JSON file
   */
  private loadRookieData(): RookiePlayer[] {
    try {
      if (!fs.existsSync(this.rookieDataPath)) {
        console.warn('⚠️ Rookie data file not found, returning empty array');
        return [];
      }
      
      const data = fs.readFileSync(this.rookieDataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Error loading rookie data:', error);
      return [];
    }
  }

  /**
   * Get rookies by position
   */
  public getRookiesByPosition(position: 'QB' | 'RB' | 'WR' | 'TE'): RookiePlayer[] {
    if (!this.isInitialized) {
      this.initializeRookieStorage();
    }
    
    return this.rookieStorage[position] || [];
  }

  /**
   * Get all rookies across all positions
   */
  public getAllRookies(): RookiePlayer[] {
    if (!this.isInitialized) {
      this.initializeRookieStorage();
    }
    
    return [
      ...this.rookieStorage.QB,
      ...this.rookieStorage.RB,
      ...this.rookieStorage.WR,
      ...this.rookieStorage.TE
    ];
  }

  /**
   * Add rookie to storage (with position validation)
   */
  public addRookie(player: RookiePlayer): boolean {
    if (!this.isInitialized) {
      this.initializeRookieStorage();
    }

    const position = player.position;
    if (!this.rookieStorage[position]) {
      console.error(`❌ Invalid position: ${position}`);
      return false;
    }

    // Check for duplicates
    const existing = this.rookieStorage[position].find(p => p.name === player.name);
    if (existing) {
      console.warn(`⚠️ Rookie already exists: ${player.name} (${position})`);
      return false;
    }

    this.rookieStorage[position].push(player);
    console.log(`✅ Added rookie: ${player.name} (${position})`);
    return true;
  }

  /**
   * Get rookies with draft capital context
   */
  public getRookiesWithDraftCapital(position?: 'QB' | 'RB' | 'WR' | 'TE'): RookiePlayer[] {
    let rookies = position ? this.getRookiesByPosition(position) : this.getAllRookies();
    
    return rookies.map(rookie => ({
      ...rookie,
      draft_capital_tier: this.calculateDraftCapitalTier(rookie.adp)
    }));
  }

  /**
   * Calculate draft capital tier based on ADP
   */
  private calculateDraftCapitalTier(adp?: number): 'Elite' | 'High' | 'Mid' | 'Late' | 'UDFA' {
    if (!adp) return 'UDFA';
    
    if (adp <= 12) return 'Elite';      // Round 1
    if (adp <= 36) return 'High';       // Round 2-3
    if (adp <= 84) return 'Mid';        // Round 4-7
    if (adp <= 156) return 'Late';      // Round 8-13
    return 'UDFA';                      // Undrafted
  }

  /**
   * Get storage statistics
   */
  public getStorageStats(): { position: string; count: number; avgADP?: number }[] {
    if (!this.isInitialized) {
      this.initializeRookieStorage();
    }

    return (['QB', 'RB', 'WR', 'TE'] as const).map(position => {
      const rookies = this.rookieStorage[position];
      const validADPs = rookies.filter(r => r.adp).map(r => r.adp!);
      const avgADP = validADPs.length > 0 
        ? validADPs.reduce((sum, adp) => sum + adp, 0) / validADPs.length 
        : undefined;

      return {
        position,
        count: rookies.length,
        avgADP: avgADP ? Math.round(avgADP * 10) / 10 : undefined
      };
    });
  }

  /**
   * Log storage summary
   */
  private logStorageSummary(): void {
    const stats = this.getStorageStats();
    console.log('📊 Rookie Storage Summary:');
    stats.forEach(stat => {
      const adpInfo = stat.avgADP ? ` (Avg ADP: ${stat.avgADP})` : '';
      console.log(`  ${stat.position}: ${stat.count} players${adpInfo}`);
    });
  }

  /**
   * Get top rookies by position (sorted by ADP)
   */
  public getTopRookiesByPosition(position: 'QB' | 'RB' | 'WR' | 'TE', limit: number = 10): RookiePlayer[] {
    const rookies = this.getRookiesByPosition(position);
    
    return rookies
      .filter(r => r.adp) // Only rookies with ADP
      .sort((a, b) => (a.adp || 999) - (b.adp || 999)) // Sort by ADP (lower = better)
      .slice(0, limit);
  }

  /**
   * Integration with compass system - prepare rookie data for compass evaluation
   */
  public prepareRookieForCompass(rookie: RookiePlayer): any {
    return {
      player_name: rookie.name,
      name: rookie.name,
      position: rookie.position,
      team: rookie.team,
      age: 22, // Default rookie age
      experience: 1, // Rookie year
      draft_capital: this.calculateDraftCapitalTier(rookie.adp),
      projected_points: rookie.projected_points || 0,
      adp: rookie.adp,
      // Position-specific stats
      rush_attempts: rookie.rush || 0,
      receiving_targets: rookie.rec || 0,
      rush_yards: rookie.rush_yds || 0,
      receiving_yards: rookie.rec_yds || 0,
      rush_tds: rookie.rush_td || 0,
      receiving_tds: rookie.rec_td || 0
    };
  }
}

// Export singleton instance
export const rookieStorageService = new RookieStorageService();
export { RookiePlayer, RookieStorage };