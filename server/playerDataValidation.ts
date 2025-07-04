import type { Player } from "@shared/schema";

/**
 * Player Data Validation Service
 * Filters out inactive, suspended, or unrealistic player data
 */
export class PlayerDataValidationService {
  
  // Players who are inactive, suspended, or have unrealistic data
  private readonly EXCLUDED_PLAYERS = new Set([
    'Deshaun Watson',     // Suspended/not playing 2024
    'Calvin Ridley',      // Was suspended, may have outdated data
    'Josh Gordon',        // Suspended repeatedly
    'Alvin Kamara',       // Check if data is current
    'Leonard Fournette',  // Free agent/inactive
    'Kareem Hunt',        // Check current team status
  ]);

  // Minimum realistic thresholds for 2024 season
  private readonly MIN_THRESHOLDS = {
    QB: { minPoints: 8, maxOwnership: 90 },   // Even backup QBs should score 8+ in starts
    RB: { minPoints: 3, maxOwnership: 85 },   // Handcuffs can be lower
    WR: { minPoints: 3, maxOwnership: 80 },   // Deep sleepers can be lower  
    TE: { minPoints: 2, maxOwnership: 75 },   // Streaming TEs can be very low
  };

  // Maximum realistic thresholds (catch obvious fake data)
  private readonly MAX_THRESHOLDS = {
    QB: { maxPoints: 30, minOwnership: 5 },   // Even Josh Allen doesn't exceed 30 PPG
    RB: { maxPoints: 25, minOwnership: 3 },   // CMC ceiling around 23-24 PPG
    WR: { maxPoints: 22, minOwnership: 3 },   // Elite WR1 ceiling
    TE: { maxPoints: 18, minOwnership: 2 },   // Kelce ceiling
  };

  /**
   * Filter players for rankings to exclude problematic data
   */
  filterValidPlayers(players: Player[]): Player[] {
    const validPlayers = [];
    const filteredPlayers = [];

    for (const player of players) {
      if (this.isValidPlayer(player)) {
        validPlayers.push(player);
      } else {
        const reason = this.getFilterReason(player);
        filteredPlayers.push({ name: player.name, position: player.position, reason });
      }
    }

    // Log detailed filtering results
    console.log(`\n=== PLAYER FILTERING RESULTS ===`);
    console.log(`Total players analyzed: ${players.length}`);
    console.log(`Valid players: ${validPlayers.length}`);
    console.log(`Filtered players: ${filteredPlayers.length}\n`);

    if (filteredPlayers.length > 0) {
      console.log(`FILTERED PLAYERS:`);
      filteredPlayers.forEach(({ name, position, reason }) => {
        console.log(`❌ ${name} (${position}): ${reason}`);
      });
      console.log(`\n=== END FILTERING RESULTS ===\n`);
    }

    return validPlayers;
  }

  /**
   * Get specific reason why a player was filtered
   */
  getFilterReason(player: Player): string {
    // Check explicit exclusions first
    if (this.EXCLUDED_PLAYERS.has(player.name)) {
      return "Explicitly excluded (suspended/inactive)";
    }

    // Check realistic stats
    if (!this.hasRealisticStats(player)) {
      const avgPoints = player.avgPoints || 0;
      const ownership = player.ownershipPercentage || 0;
      return `Unrealistic stats (${avgPoints.toFixed(1)} PPG, ${ownership.toFixed(1)}% owned)`;
    }

    // Check activity
    if (!this.appearsActive(player)) {
      if (player.injuryStatus === 'Suspended' || player.injuryStatus === 'Retired') {
        return `Injury status: ${player.injuryStatus}`;
      }
      
      const avgPoints = player.avgPoints || 0;
      const ownership = player.ownershipPercentage || 0;
      
      if (avgPoints === 0 && ownership < 5) {
        return "Inactive (0 points, low ownership)";
      }
      
      if (avgPoints > 15 && ownership < 10 && player.position !== 'QB') {
        return "Data anomaly (high points, low ownership)";
      }
    }

    return "Unknown validation failure";
  }

  /**
   * Validate individual player data
   */
  isValidPlayer(player: Player): boolean {
    // Exclude known problematic players
    if (this.EXCLUDED_PLAYERS.has(player.name)) {
      return false;
    }

    // Check for realistic data ranges
    if (!this.hasRealisticStats(player)) {
      return false;
    }

    // Check for active player indicators
    if (!this.appearsActive(player)) {
      return false;
    }

    return true;
  }

  /**
   * Check if player stats are within realistic ranges
   */
  private hasRealisticStats(player: Player): boolean {
    const position = player.position as keyof typeof this.MIN_THRESHOLDS;
    const minThreshold = this.MIN_THRESHOLDS[position];
    const maxThreshold = this.MAX_THRESHOLDS[position];

    if (!minThreshold || !maxThreshold) return false;

    const avgPoints = player.avgPoints || 0;
    const ownership = player.ownershipPercentage || 0;

    // Check minimum thresholds
    if (avgPoints < minThreshold.minPoints && ownership > minThreshold.maxOwnership) {
      return false; // High ownership but terrible production = bad data
    }

    // Check maximum thresholds  
    if (avgPoints > maxThreshold.maxPoints) {
      return false; // Impossibly high production
    }

    // Check ownership vs production correlation
    if (avgPoints < 1 && ownership > 50) {
      return false; // No production but high ownership = bad data
    }

    return true;
  }

  /**
   * Check if player appears to be active based on data patterns
   */
  private appearsActive(player: Player): boolean {
    const avgPoints = player.avgPoints || 0;
    const ownership = player.ownershipPercentage || 0;

    // Players with 0 points and very low ownership are likely inactive
    if (avgPoints === 0 && ownership < 5) {
      return false;
    }

    // Check injury status
    if (player.injuryStatus === 'Suspended' || player.injuryStatus === 'Retired') {
      return false;
    }

    // Players with very high points but very low ownership might be bad data
    if (avgPoints > 15 && ownership < 10 && player.position !== 'QB') {
      return false; // Likely data error
    }

    return true;
  }

  /**
   * Normalize player data to fix obvious errors
   */
  normalizePlayerData(player: Player): Player {
    const normalized = { ...player };

    // Fix decimal precision issues
    if (normalized.avgPoints) {
      normalized.avgPoints = Math.round(normalized.avgPoints * 10) / 10;
    }
    if (normalized.projectedPoints) {
      normalized.projectedPoints = Math.round(normalized.projectedPoints * 10) / 10;
    }

    // Normalize ownership percentage
    if (normalized.ownershipPercentage) {
      normalized.ownershipPercentage = Math.round(normalized.ownershipPercentage);
    }

    return normalized;
  }

  /**
   * Get realistic ADP estimate based on position and production
   */
  getRealisticADP(player: Player): number {
    const avgPoints = player.avgPoints || 0;
    const ownership = player.ownershipPercentage || 0;
    
    // Position-based ADP calculation using 2024 realistic ranges
    if (player.position === 'QB') {
      if (avgPoints >= 23) return 15 + Math.random() * 15;   // Josh Allen tier: picks 15-30
      if (avgPoints >= 20) return 30 + Math.random() * 20;   // Lamar/Hurts: picks 30-50
      if (avgPoints >= 18) return 50 + Math.random() * 30;   // Burrow/Mahomes: picks 50-80
      if (avgPoints >= 15) return 80 + Math.random() * 40;   // QB1 range: picks 80-120
      if (avgPoints >= 12) return 120 + Math.random() * 60;  // QB2 range: picks 120-180
      return 180 + Math.random() * 120;                      // Backup QBs: picks 180-300
    }

    if (player.position === 'RB') {
      if (avgPoints >= 18) return 3 + Math.random() * 7;     // CMC tier: picks 3-10
      if (avgPoints >= 15) return 8 + Math.random() * 12;    // Henry/Gibbs: picks 8-20
      if (avgPoints >= 13) return 15 + Math.random() * 15;   // High RB1: picks 15-30
      if (avgPoints >= 11) return 25 + Math.random() * 20;   // Mid RB1: picks 25-45
      if (avgPoints >= 9) return 40 + Math.random() * 30;    // Low RB1: picks 40-70
      if (avgPoints >= 7) return 60 + Math.random() * 40;    // RB2 range: picks 60-100
      if (avgPoints >= 5) return 90 + Math.random() * 60;    // Flex/handcuff: picks 90-150
      return 150 + Math.random() * 150;                      // Deep sleepers: picks 150-300
    }

    if (player.position === 'WR') {
      if (avgPoints >= 17) return 5 + Math.random() * 10;    // CeeDee/Tyreek: picks 5-15
      if (avgPoints >= 15) return 10 + Math.random() * 15;   // Jefferson/Chase: picks 10-25
      if (avgPoints >= 13) return 20 + Math.random() * 20;   // WR1 tier: picks 20-40
      if (avgPoints >= 11) return 35 + Math.random() * 25;   // Mid WR1: picks 35-60
      if (avgPoints >= 9) return 50 + Math.random() * 30;    // Low WR1: picks 50-80
      if (avgPoints >= 7) return 70 + Math.random() * 40;    // WR2 range: picks 70-110
      if (avgPoints >= 5) return 100 + Math.random() * 50;   // WR3 range: picks 100-150
      return 140 + Math.random() * 160;                      // Deep sleepers: picks 140-300
    }

    if (player.position === 'TE') {
      if (avgPoints >= 12) return 25 + Math.random() * 15;   // Kelce tier: picks 25-40
      if (avgPoints >= 10) return 40 + Math.random() * 20;   // Andrews/Kittle: picks 40-60
      if (avgPoints >= 8) return 60 + Math.random() * 30;    // TE1 range: picks 60-90
      if (avgPoints >= 6) return 90 + Math.random() * 50;    // Streaming tier: picks 90-140
      if (avgPoints >= 4) return 140 + Math.random() * 80;   // Deep league: picks 140-220
      return 220 + Math.random() * 80;                       // Waiver wire: picks 220-300
    }

    return 250; // Default for unknown positions
  }
}

export const playerDataValidationService = new PlayerDataValidationService();