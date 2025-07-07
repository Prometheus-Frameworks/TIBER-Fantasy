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
    // January 2025 Dynasty Startup ADP - Established NFL Players Only
    const dynastyStartupPlayers = [
      // Elite Dynasty Assets (Rounds 1-2)
      { id: '6794', name: 'Justin Jefferson', position: 'WR', team: 'MIN', adp: 1.1, ownership: 99 },
      { id: '6813', name: 'CeeDee Lamb', position: 'WR', team: 'DAL', adp: 1.4, ownership: 99 },
      { id: '7564', name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN', adp: 1.8, ownership: 98 },
      { id: '4984', name: 'Josh Allen', position: 'QB', team: 'BUF', adp: 2.3, ownership: 98 },
      { id: '8110', name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET', adp: 2.7, ownership: 97 },
      { id: '4881', name: 'Lamar Jackson', position: 'QB', team: 'BAL', adp: 3.2, ownership: 97 },
      { id: '9226', name: 'Puka Nacua', position: 'WR', team: 'LAR', adp: 3.6, ownership: 96 },
      { id: '9509', name: 'Caleb Williams', position: 'QB', team: 'CHI', adp: 4.1, ownership: 96 },
      { id: '7526', name: 'Garrett Wilson', position: 'WR', team: 'NYJ', adp: 4.5, ownership: 95 },
      { id: '10859', name: 'Jayden Daniels', position: 'QB', team: 'WAS', adp: 4.9, ownership: 95 },
      
      // Premium Dynasty Assets (Rounds 3-4)
      { id: '6806', name: 'DK Metcalf', position: 'WR', team: 'SEA', adp: 5.4, ownership: 94 },
      { id: '6945', name: 'Tyreek Hill', position: 'WR', team: 'MIA', adp: 5.8, ownership: 94 },
      { id: '8135', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET', adp: 6.3, ownership: 88 },
      { id: '8137', name: 'Bijan Robinson', position: 'RB', team: 'ATL', adp: 6.7, ownership: 88 },
      { id: '7591', name: 'Breece Hall', position: 'RB', team: 'NYJ', adp: 7.2, ownership: 87 },
      { id: '10229', name: 'Marvin Harrison Jr.', position: 'WR', team: 'ARI', adp: 7.6, ownership: 87 },
      { id: '11068', name: 'Brian Thomas Jr.', position: 'WR', team: 'JAX', adp: 8.1, ownership: 86 },
      { id: '10914', name: 'Malik Nabers', position: 'WR', team: 'NYG', adp: 8.5, ownership: 86 },
      { id: '5870', name: 'C.J. Stroud', position: 'QB', team: 'HOU', adp: 8.9, ownership: 85 },
      { id: '7045', name: 'A.J. Brown', position: 'WR', team: 'PHI', adp: 9.4, ownership: 85 },
      
      // Strong Dynasty Assets (Rounds 5-6)
      { id: '6943', name: 'Stefon Diggs', position: 'WR', team: 'HOU', adp: 9.8, ownership: 84 },
      { id: '4046', name: 'Patrick Mahomes', position: 'QB', team: 'KC', adp: 10.3, ownership: 84 },
      { id: '7547', name: 'DeVonta Smith', position: 'WR', team: 'PHI', adp: 10.7, ownership: 83 },
      { id: '7553', name: 'Tee Higgins', position: 'WR', team: 'CIN', adp: 11.2, ownership: 83 },
      { id: '8138', name: 'Kenneth Walker III', position: 'RB', team: 'SEA', adp: 11.6, ownership: 82 },
      { id: '4217', name: 'Drake Maye', position: 'QB', team: 'NE', adp: 12.1, ownership: 82 },
      { id: '4034', name: 'Travis Kelce', position: 'TE', team: 'KC', adp: 12.5, ownership: 81 },
      { id: '4036', name: 'Mike Evans', position: 'WR', team: 'TB', adp: 13.0, ownership: 81 },
      { id: '6819', name: 'Terry McLaurin', position: 'WR', team: 'WAS', adp: 13.4, ownership: 80 },
      { id: '7828', name: 'Chris Olave', position: 'WR', team: 'NO', adp: 13.9, ownership: 80 }
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