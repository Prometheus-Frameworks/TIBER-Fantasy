/**
 * Player Filtering System
 * Implements active player validation and dynasty eligibility checks
 */

interface Player {
  name: string;
  position: string;
  team: string;
  age?: number;
  adjustedDynastyValue?: number;
  dynastyGrade?: string;
  marketValue?: number;
  pdva?: number;
  status?: string;
  lastSeason?: number;
  rookie?: boolean;
  draftYear?: number;
  drafted?: boolean;
}

export class PlayerFilteringService {
  /**
   * Check if player is currently active and dynasty-relevant in NFL
   */
  static isActivePlayer(player: Player): boolean {
    const currentYear = new Date().getFullYear();
    
    // Exclude officially retired or unsigned players
    if (!player.team || player.team === 'FA' || player.status === 'Retired') {
      return false;
    }
    
    // Exclude players with zero games since 2022 (unless 2024 rookies)
    const hasRecentActivity = player.lastSeason >= 2022 || 
                              (player.rookie === true && player.draftYear >= 2024);
    if (!hasRecentActivity) {
      return false;
    }
    
    // Exclude old veterans with no dynasty relevance (35+ backup only)
    if (player.age && player.age >= 35) {
      // Only keep 35+ players if they have elite production or are starters
      const hasEliteProduction = player.adjustedDynastyValue && player.adjustedDynastyValue >= 60;
      if (!hasEliteProduction) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if player is valid for dynasty leagues
   * Includes active players + 2025 rookie class
   */
  static isValidDynastyPlayer(player: Player): boolean {
    return (
      this.isActivePlayer(player) || 
      (player.rookie === true && player.draftYear === 2025 && player.drafted)
    );
  }

  /**
   * Filter and sort dynasty player pool with startup draft relevance
   */
  static getDynastyRankedPlayers(allPlayers: Player[], limit: number = 151): Player[] {
    // Step 1: Filter to dynasty-eligible players who could reasonably be drafted
    const dynastyPool = allPlayers.filter(player => {
      // Must pass basic eligibility
      if (!this.isValidDynastyPlayer(player)) return false;
      
      // Must have meaningful dynasty value for startup consideration
      const dynastyValue = player.adjustedDynastyValue || player.dynastyGrade || player.marketValue || 0;
      if (dynastyValue < 20) return false; // Below this threshold = not startup draftable
      
      return true;
    });

    // Step 2: Enhanced sorting with startup draft relevance
    const sortedDynastyPool = dynastyPool.sort((a, b) => {
      // Weight recent performance (2022-2024) highest
      const aRecentValue = this.calculateRecentPerformanceWeight(a);
      const bRecentValue = this.calculateRecentPerformanceWeight(b);
      
      // Primary sort: Recent performance + dynasty value composite
      const aComposite = (aRecentValue * 0.6) + ((a.adjustedDynastyValue || 0) * 0.4);
      const bComposite = (bRecentValue * 0.6) + ((b.adjustedDynastyValue || 0) * 0.4);
      
      if (Math.abs(aComposite - bComposite) > 5) {
        return bComposite - aComposite;
      }
      
      // Tie-breaker: Age and position longevity (younger = better for dynasty)
      const aAgeFactor = this.calculateAgeFactor(a);
      const bAgeFactor = this.calculateAgeFactor(b);
      
      return bAgeFactor - aAgeFactor;
    });

    // Step 3: Assign dynasty ranks for startup draft
    const topPlayers = sortedDynastyPool.slice(0, limit).map((player, index) => ({
      ...player,
      rank: index + 1,
      dynastyRank: index + 1,
      startupDraftable: true
    }));

    return topPlayers;
  }

  /**
   * Calculate recent performance weight (2022-2024 seasons)
   */
  private static calculateRecentPerformanceWeight(player: Player): number {
    const baseValue = player.adjustedDynastyValue || 0;
    
    // Boost for proven recent producers
    if (player.lastSeason >= 2023 && baseValue >= 70) {
      return baseValue * 1.2; // 20% boost for recent elite production
    }
    
    // Moderate boost for solid recent performance
    if (player.lastSeason >= 2022 && baseValue >= 50) {
      return baseValue * 1.1; // 10% boost for consistent production
    }
    
    // Penalty for players without recent activity
    if (player.lastSeason < 2022) {
      return baseValue * 0.7; // 30% penalty for stale performance
    }
    
    return baseValue;
  }

  /**
   * Calculate age factor for dynasty relevance
   */
  private static calculateAgeFactor(player: Player): number {
    if (!player.age) return 50; // Neutral if age unknown
    
    // Position-specific age curves
    const positionPeaks = {
      'QB': { peak: 28, decline: 35 },
      'RB': { peak: 24, decline: 30 },
      'WR': { peak: 26, decline: 32 },
      'TE': { peak: 27, decline: 33 }
    };
    
    const curve = positionPeaks[player.position as keyof typeof positionPeaks] || 
                  { peak: 26, decline: 32 };
    
    if (player.age <= curve.peak) {
      // Pre-peak: Higher value for younger players
      return 100 - (curve.peak - player.age) * 2;
    } else if (player.age <= curve.decline) {
      // Peak to decline: Gradual reduction
      return 90 - (player.age - curve.peak) * 8;
    } else {
      // Post-decline: Significant penalty
      return Math.max(10, 50 - (player.age - curve.decline) * 10);
    }
  }

  /**
   * Apply additional filters for specific queries
   */
  static applyAdditionalFilters(players: Player[], filters: {
    position?: string;
    minAge?: number;
    maxAge?: number;
    minDynastyValue?: number;
    team?: string;
  }): Player[] {
    return players.filter(player => {
      if (filters.position && player.position !== filters.position) {
        return false;
      }
      
      if (filters.minAge && player.age && player.age < filters.minAge) {
        return false;
      }
      
      if (filters.maxAge && player.age && player.age > filters.maxAge) {
        return false;
      }
      
      if (filters.minDynastyValue && player.adjustedDynastyValue && player.adjustedDynastyValue < filters.minDynastyValue) {
        return false;
      }
      
      if (filters.team && player.team !== filters.team) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Get player eligibility summary
   */
  static getEligibilitySummary(allPlayers: Player[]): {
    totalPlayers: number;
    activeNFL: number;
    eligibleRookies: number;
    dynastyEligible: number;
    retiredInactive: number;
  } {
    const totalPlayers = allPlayers.length;
    const activeNFL = allPlayers.filter(p => this.isActivePlayer(p)).length;
    const eligibleRookies = allPlayers.filter(p => 
      p.rookie === true && p.draftYear === 2025 && p.drafted
    ).length;
    const dynastyEligible = allPlayers.filter(p => this.isValidDynastyPlayer(p)).length;
    const retiredInactive = totalPlayers - dynastyEligible;

    return {
      totalPlayers,
      activeNFL,
      eligibleRookies,
      dynastyEligible,
      retiredInactive
    };
  }
}

export const playerFiltering = new PlayerFilteringService();