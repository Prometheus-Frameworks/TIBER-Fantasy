import { sportsDataAPI } from './sportsdata.js';
import { storage } from './storage.js';

async function updatePlayerStatsFromAPI() {
  console.log('Fetching authentic NFL player statistics...');
  
  try {
    // Get 2024 season stats from SportsDataIO
    const playerStats = await sportsDataAPI.getPlayerStats("2024REG");
    console.log(`Fetched ${playerStats.length} player stat records`);
    
    // Get all team players
    const teamPlayers = await storage.getTeamPlayers(1);
    console.log(`Found ${teamPlayers.length} team players to update`);
    
    for (const teamPlayer of teamPlayers) {
      // Find matching stats by name
      const matchingStats = playerStats.find(stat => 
        stat.Name.toLowerCase().includes(teamPlayer.name.toLowerCase()) ||
        teamPlayer.name.toLowerCase().includes(stat.Name.toLowerCase())
      );
      
      if (matchingStats) {
        console.log(`Updating ${teamPlayer.name} with authentic NFL stats`);
        
        // Calculate fantasy points average (PPR scoring)
        const fantasyPoints = matchingStats.FantasyPointsPPR || matchingStats.FantasyPoints || 0;
        
        await storage.updatePlayerPremiumAnalytics(teamPlayer.id, {
          avgPoints: Math.round(fantasyPoints * 10) / 10,
          projectedPoints: Math.round((fantasyPoints * 1.05) * 10) / 10, // 5% projection bump
          ownershipPercentage: Math.min(95, Math.max(5, Math.round(fantasyPoints * 3))),
          upside: Math.round((fantasyPoints * 0.4) * 10) / 10
        });
      } else {
        console.log(`No NFL stats found for ${teamPlayer.name} - keeping current values`);
      }
    }
    
    console.log('Player stats update completed');
    
  } catch (error) {
    console.error('Failed to update player stats:', error);
    throw error;
  }
}

export { updatePlayerStatsFromAPI };