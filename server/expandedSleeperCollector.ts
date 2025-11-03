/**
 * Expanded Sleeper Player Collector
 * Collects ALL players with valid positions/teams, marks ADP missing players
 */

import { db } from './infra/db';
import { players } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface SleeperPlayer {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  age: number;
  years_exp: number;
  height: string;
  weight: string;
  college: string;
  injury_status: string | null;
  status: string;
  depth_chart_order: number | null;
  depth_chart_position: string | null;
}

interface SleeperADP {
  [playerId: string]: string;
}

export async function collectAllSleeperPlayers(): Promise<{
  success: boolean;
  message: string;
  details: {
    totalPlayers: number;
    eligiblePlayers: number;
    playersWithADP: number;
    playersMissingADP: number;
    playersStored: number;
    errors: string[];
  };
}> {
  console.log('🏈 Starting expanded Sleeper player collection...');
  
  const errors: string[] = [];
  let playersStored = 0;
  
  try {
    // Fetch all players
    console.log('📋 Fetching all Sleeper players...');
    const playersResponse = await fetch('https://api.sleeper.app/v1/players/nfl');
    
    if (!playersResponse.ok) {
      throw new Error(`Failed to fetch players: ${playersResponse.status}`);
    }
    
    const allPlayersData = await playersResponse.json();
    const allPlayers: SleeperPlayer[] = Object.values(allPlayersData);
    console.log(`📊 Retrieved ${allPlayers.length} total players`);
    
    // Fetch ADP data
    console.log('📈 Fetching ADP data...');
    const adpResponse = await fetch('https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=1000');
    
    let adpData: SleeperADP = {};
    let adpCount = 0;
    
    if (adpResponse.ok) {
      const adpArray = await adpResponse.json();
      adpData = adpArray.reduce((acc: SleeperADP, item: any) => {
        if (item.player_id && item.count) {
          acc[item.player_id] = item.count;
          adpCount++;
        }
        return acc;
      }, {});
      console.log(`📈 Retrieved ADP data for ${adpCount} players`);
    } else {
      console.log('⚠️ ADP data unavailable, continuing without it');
    }
    
    // Filter for eligible players
    const validPositions = ['QB', 'RB', 'WR', 'TE'];
    const validTeams = [
      'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
      'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA',
      'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB',
      'TEN', 'WAS'
    ];
    
    const eligiblePlayers = allPlayers.filter(player => {
      return validPositions.includes(player.position) &&
             validTeams.includes(player.team || '') &&
             player.status === 'Active' &&
             player.full_name &&
             player.full_name.trim().length > 0;
    });
    
    console.log(`✅ ${eligiblePlayers.length} players meet criteria`);
    
    let playersWithADP = 0;
    let playersMissingADP = 0;
    
    // Process all eligible players
    for (const [index, player] of eligiblePlayers.entries()) {
      try {
        const hasADP = player.player_id in adpData;
        const adpValue = hasADP ? parseFloat(adpData[player.player_id]) : null;
        
        if (hasADP) {
          playersWithADP++;
        } else {
          playersMissingADP++;
        }
        
        // Check if player already exists
        const existingPlayer = await db
          .select()
          .from(players)
          .where(eq(players.sleeperId, player.player_id))
          .limit(1);
        
        if (existingPlayer.length > 0) {
          // Update existing player
          await db
            .update(players)
            .set({
              name: player.full_name,
              firstName: player.first_name || null,
              lastName: player.last_name || null,
              position: player.position,
              team: player.team,
              age: player.age || null,
              experience: player.years_exp || null,
              height: player.height || null,
              weight: player.weight ? parseInt(player.weight) : null,
              college: player.college || null,
              injuryStatus: player.injury_status || null,
              status: player.status || null,
              depthChartOrder: player.depth_chart_order || null,
              depthChartPosition: player.depth_chart_position || null,
              adp: adpValue
            })
            .where(eq(players.sleeperId, player.player_id));
        } else {
          // Insert new player with required defaults
          await db.insert(players).values({
            sleeperId: player.player_id,
            name: player.full_name,
            firstName: player.first_name || null,
            lastName: player.last_name || null,
            position: player.position,
            team: player.team,
            age: player.age || null,
            experience: player.years_exp || null,
            height: player.height || null,
            weight: player.weight ? parseInt(player.weight) : null,
            college: player.college || null,
            injuryStatus: player.injury_status || null,
            status: player.status || null,
            depthChartOrder: player.depth_chart_order || null,
            depthChartPosition: player.depth_chart_position || null,
            adp: adpValue,
            isAvailable: true,
            // Required fields with defaults
            avgPoints: 0,
            projectedPoints: 0,
            ownershipPercentage: hasADP ? 50 : 10, // Lower ownership for ADP-missing players
            upside: 0
          });
        }
        
        playersStored++;
        
        if ((index + 1) % 50 === 0) {
          console.log(`📊 Processed ${index + 1}/${eligiblePlayers.length} players...`);
        }
        
      } catch (error) {
        const errorMsg = `Failed to process ${player.full_name}: ${error}`;
        errors.push(errorMsg);
        console.error('❌', errorMsg);
      }
    }
    
    console.log(`🎯 Collection complete! Stored ${playersStored} players`);
    console.log(`📈 ${playersWithADP} players with ADP, ${playersMissingADP} missing ADP`);
    
    return {
      success: true,
      message: 'Successfully collected all Sleeper players',
      details: {
        totalPlayers: allPlayers.length,
        eligiblePlayers: eligiblePlayers.length,
        playersWithADP,
        playersMissingADP,
        playersStored,
        errors
      }
    };
    
  } catch (error) {
    console.error('❌ Collection failed:', error);
    return {
      success: false,
      message: 'Player collection failed',
      details: {
        totalPlayers: 0,
        eligiblePlayers: 0,
        playersWithADP: 0,
        playersMissingADP: 0,
        playersStored,
        errors: [...errors, `Collection error: ${error}`]
      }
    };
  }
}