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
   * Check if player is currently active in NFL
   */
  static isActivePlayer(player: Player): boolean {
    const currentYear = new Date().getFullYear();
    return (
      player.team &&
      player.team !== 'FA' && 
      player.status !== 'Retired' &&
      (!player.lastSeason || player.lastSeason >= currentYear - 2)
    );
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
   * Filter and sort dynasty player pool
   */
  static getDynastyRankedPlayers(allPlayers: Player[], limit: number = 151): Player[] {
    // Step 1: Filter to dynasty-eligible players
    const dynastyPool = allPlayers.filter(player => this.isValidDynastyPlayer(player));

    // Step 2: Sort by dynasty value metrics
    const sortedDynastyPool = dynastyPool
      .filter(p => p.adjustedDynastyValue || p.dynastyGrade || p.marketValue)
      .sort((a, b) => {
        // Primary sort by adjustedDynastyValue, fallback to other metrics
        const aVal = a.adjustedDynastyValue || a.pdva || a.marketValue || 0;
        const bVal = b.adjustedDynastyValue || b.pdva || b.marketValue || 0;
        return bVal - aVal; // Descending order (higher value = better rank)
      });

    // Step 3: Assign dynasty ranks and return top players
    const topPlayers = sortedDynastyPool.slice(0, limit).map((player, index) => ({
      ...player,
      rank: index + 1,
      dynastyRank: index + 1 // Explicit dynasty rank field
    }));

    return topPlayers;
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