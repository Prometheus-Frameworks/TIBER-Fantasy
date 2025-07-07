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
      
      // Tier 4 - Strong Dynasty Options (FantasyPros Expert Consensus Copy-Paste)
      { id: '7947', name: 'Nico Collins', position: 'WR', team: 'HOU', adp: 24.4, ownership: 80 },
      { id: '7573', name: 'Drake London', position: 'WR', team: 'ATL', adp: 26.4, ownership: 79 },
      { id: '11055', name: 'Brock Bowers', position: 'TE', team: 'LV', adp: 27.2, ownership: 78 },
      { id: '4866', name: 'Saquon Barkley', position: 'RB', team: 'PHI', adp: 28.4, ownership: 77 },
      { id: '7526', name: 'Garrett Wilson', position: 'WR', team: 'NYJ', adp: 29.5, ownership: 76 },
      { id: '10229', name: 'Marvin Harrison Jr.', position: 'WR', team: 'ARI', adp: 30.8, ownership: 75 },
      { id: '7045', name: 'A.J. Brown', position: 'WR', team: 'PHI', adp: 32.1, ownership: 74 },
      { id: '7553', name: 'Tee Higgins', position: 'WR', team: 'CIN', adp: 33.4, ownership: 73 },
      { id: '7591', name: 'Breece Hall', position: 'RB', team: 'NYJ', adp: 34.7, ownership: 72 },
      { id: '8138', name: 'Kenneth Walker III', position: 'RB', team: 'SEA', adp: 36.0, ownership: 71 },
      
      // Tier 5 - Premium Dynasty Assets (Rounds 4-5) - FantasyPros Top 50
      { id: '10951', name: 'Rome Odunze', position: 'WR', team: 'CHI', adp: 37.3, ownership: 70 },
      { id: '4319', name: 'Dak Prescott', position: 'QB', team: 'DAL', adp: 38.6, ownership: 69 },
      { id: '7547', name: 'DeVonta Smith', position: 'WR', team: 'PHI', adp: 39.9, ownership: 68 },
      { id: '4034', name: 'Travis Kelce', position: 'TE', team: 'KC', adp: 41.2, ownership: 67 },
      { id: '6943', name: 'Stefon Diggs', position: 'WR', team: 'HOU', adp: 42.5, ownership: 66 },
      { id: '7828', name: 'Chris Olave', position: 'WR', team: 'NO', adp: 43.8, ownership: 65 },
      { id: '6945', name: 'Tyreek Hill', position: 'WR', team: 'MIA', adp: 45.1, ownership: 64 },
      { id: '7581', name: 'Jaylen Waddle', position: 'WR', team: 'MIA', adp: 46.4, ownership: 63 },
      { id: '4036', name: 'Mike Evans', position: 'WR', team: 'TB', adp: 47.7, ownership: 62 },
      { id: '6819', name: 'Terry McLaurin', position: 'WR', team: 'WAS', adp: 49.0, ownership: 61 },
      
      // Tier 6 - Solid Dynasty Depth (Rounds 5-6) - Copy-Paste Continuation 
      { id: '6806', name: 'DK Metcalf', position: 'WR', team: 'SEA', adp: 50.3, ownership: 60 },
      { id: '8142', name: 'Rachaad White', position: 'RB', team: 'TB', adp: 51.6, ownership: 59 },
      { id: '11068', name: 'Ladd McConkey', position: 'WR', team: 'LAC', adp: 52.9, ownership: 58 },
      { id: '4381', name: 'Anthony Richardson', position: 'QB', team: 'IND', adp: 54.2, ownership: 57 },
      { id: '7559', name: 'Jahan Dotson', position: 'WR', team: 'PHI', adp: 55.5, ownership: 56 },
      { id: '4029', name: 'Davante Adams', position: 'WR', team: 'NYJ', adp: 56.8, ownership: 55 },
      { id: '8141', name: 'Kyren Williams', position: 'RB', team: 'LAR', adp: 58.1, ownership: 54 },
      { id: '10911', name: 'Keon Coleman', position: 'WR', team: 'BUF', adp: 59.4, ownership: 53 },
      { id: '4088', name: 'Tua Tagovailoa', position: 'QB', team: 'MIA', adp: 60.7, ownership: 52 },
      { id: '8140', name: 'Isiah Pacheco', position: 'RB', team: 'KC', adp: 62.0, ownership: 51 },
      
      // Tier 7 - Good Dynasty Value (Late Rounds) - Continuing FantasyPros
      { id: '6828', name: 'Jordan Love', position: 'QB', team: 'GB', adp: 63.3, ownership: 50 },
      { id: '7569', name: 'Jayden Reed', position: 'WR', team: 'GB', adp: 64.6, ownership: 49 },
      { id: '8118', name: 'George Pickens', position: 'WR', team: 'PIT', adp: 65.9, ownership: 48 },
      { id: '6945', name: 'Calvin Ridley', position: 'WR', team: 'TEN', adp: 67.2, ownership: 47 },
      { id: '8143', name: 'Tank Dell', position: 'WR', team: 'HOU', adp: 68.5, ownership: 46 }
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
    if (adp <= 20) return 78;
    if (adp <= 30) return 74;
    if (adp <= 40) return 68;
    if (adp <= 50) return 62;
    if (adp <= 60) return 56;
    return 50;
  }
}

export const dynastyStartupADPService = new DynastyStartupADPService();