/**
 * Dynasty Startup ADP Service
 * Returns only established NFL players for dynasty startup drafts
 * Separates from rookie drafts (college players)
 */

export class DynastyStartupADPService {
  
  /**
   * Get dynasty startup ADP - established NFL players only
   * No college rookies (Jeanty, Hampton, Hunter, etc.)
   */
  getDynastyStartupADP() {
    // January 2025 Dynasty Startup ADP - Based on FantasyPros Expert Consensus (Superflex)
    const dynastyStartupPlayers = [
      // Tier 1 - Elite Dynasty QBs (Superflex Premium)
      { id: '4984', name: 'Josh Allen', position: 'QB', team: 'BUF', adp: 1.0, ownership: 99 },
      { id: '4881', name: 'Lamar Jackson', position: 'QB', team: 'BAL', adp: 2.0, ownership: 98 },
      { id: '10859', name: 'Jayden Daniels', position: 'QB', team: 'WAS', adp: 3.0, ownership: 97 },
      { id: '6151', name: 'Joe Burrow', position: 'QB', team: 'CIN', adp: 4.0, ownership: 96 },
      { id: '6797', name: 'Jalen Hurts', position: 'QB', team: 'PHI', adp: 5.0, ownership: 95 },
      
      // Tier 2 - Elite Dynasty WRs + Top QB
      { id: '7564', name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN', adp: 6.0, ownership: 94 },
      { id: '6794', name: 'Justin Jefferson', position: 'WR', team: 'MIN', adp: 7.0, ownership: 93 },
      { id: '4046', name: 'Patrick Mahomes', position: 'QB', team: 'KC', adp: 8.0, ownership: 92 },
      { id: '6813', name: 'CeeDee Lamb', position: 'WR', team: 'DAL', adp: 9.0, ownership: 91 },
      { id: '8137', name: 'Bijan Robinson', position: 'RB', team: 'ATL', adp: 10.0, ownership: 90 },
      
      // Tier 3 - Premium Dynasty Assets
      { id: '10914', name: 'Malik Nabers', position: 'WR', team: 'NYG', adp: 11.0, ownership: 89 },
      { id: '4319', name: 'Justin Herbert', position: 'QB', team: 'LAC', adp: 12.0, ownership: 88 },
      { id: '8135', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET', adp: 13.0, ownership: 87 },
      { id: '9226', name: 'Puka Nacua', position: 'WR', team: 'LAR', adp: 14.0, ownership: 86 },
      { id: '8110', name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET', adp: 15.0, ownership: 85 },
      { id: '4217', name: 'Drake Maye', position: 'QB', team: 'NE', adp: 16.0, ownership: 84 },
      { id: '11068', name: 'Brian Thomas Jr.', position: 'WR', team: 'JAX', adp: 17.0, ownership: 83 },
      { id: '9509', name: 'Caleb Williams', position: 'QB', team: 'CHI', adp: 18.0, ownership: 82 },
      { id: '5870', name: 'C.J. Stroud', position: 'QB', team: 'HOU', adp: 19.0, ownership: 81 },
      
      // Tier 4 - Strong Dynasty Options
      { id: '7947', name: 'Nico Collins', position: 'WR', team: 'HOU', adp: 20.0, ownership: 80 },
      { id: '7573', name: 'Drake London', position: 'WR', team: 'ATL', adp: 21.0, ownership: 79 },
      { id: '11055', name: 'Brock Bowers', position: 'TE', team: 'LV', adp: 22.0, ownership: 78 },
      { id: '4866', name: 'Saquon Barkley', position: 'RB', team: 'PHI', adp: 23.0, ownership: 77 },
      { id: '7526', name: 'Garrett Wilson', position: 'WR', team: 'NYJ', adp: 24.0, ownership: 76 },
      { id: '8138', name: 'Kenneth Walker III', position: 'RB', team: 'SEA', adp: 25.0, ownership: 75 }
    ];
    
    return dynastyStartupPlayers.map(player => ({
      id: player.id,
      sleeperId: player.id,
      name: player.name,
      position: player.position,
      team: player.team,
      adp: player.adp,
      adpTrend: 0,
      ownership: player.ownership,
      ownershipTrend: 0,
      draftCount: 100, // Established players
      rankChange: 0,
      isRising: false,
      isFalling: false
    }));
  }
  
  /**
   * Calculate ownership based on ADP position
   */
  calculateOwnership(adp: number): number {
    if (adp <= 2) return 99;
    if (adp <= 4) return 97;
    if (adp <= 6) return 94;
    if (adp <= 8) return 88;
    if (adp <= 10) return 85;
    if (adp <= 12) return 82;
    return 80;
  }
}

export const dynastyStartupADPService = new DynastyStartupADPService();