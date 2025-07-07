/**
 * Basic Sleeper Data Collector
 * Simplified version that only uses existing database fields
 */

import { db } from './db';
import { players } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface SleeperPlayerBasic {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  team: string | null;
  position: string;
  jersey_number: number | null;
  height: string | null;
  weight: number | null;
  age: number | null;
  years_exp: number | null;
  college: string | null;
  status: string;
  adp?: number;
}

export class SleeperBasicCollector {
  private readonly SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
  private readonly VALID_POSITIONS = ['QB', 'RB', 'WR', 'TE'];

  async collectAndStoreBasicData(): Promise<{
    playersProcessed: number;
    playersStored: number;
    errors: string[];
  }> {
    console.log('🏈 Starting basic Sleeper data collection...');
    
    const errors: string[] = [];
    let playersProcessed = 0;
    let playersStored = 0;

    try {
      // 1. Fetch all players
      const response = await fetch(`${this.SLEEPER_BASE_URL}/players/nfl`);
      if (!response.ok) {
        throw new Error(`Failed to fetch players: ${response.status}`);
      }
      const allPlayers = await response.json();
      console.log(`📋 Retrieved ${Object.keys(allPlayers).length} total players`);

      // 2. Get ADP data  
      const adpData = await this.fetchADPData();
      console.log(`📈 Retrieved ADP data for ${Object.keys(adpData).length} players`);

      // 3. Filter eligible players
      const eligible = this.filterEligiblePlayers(allPlayers, adpData);
      console.log(`✅ ${eligible.length} players meet criteria`);

      // 4. Store players (simplified data only)
      for (const player of eligible) {
        try {
          await this.storeBasicPlayer(player);
          playersStored++;
          playersProcessed++;
          
          if (playersProcessed % 10 === 0) {
            console.log(`📊 Processed ${playersProcessed}/${eligible.length} players...`);
          }
        } catch (error) {
          const errorMsg = `Failed to store ${player.full_name}: ${error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      console.log(`🎯 Collection complete! Stored ${playersStored} players`);
      
      return { playersProcessed, playersStored, errors };

    } catch (error) {
      const errorMsg = `Critical error: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
      throw error;
    }
  }

  private async fetchADPData(): Promise<Record<string, number>> {
    try {
      const response = await fetch(`${this.SLEEPER_BASE_URL}/players/nfl/trending/add?lookback_hours=24&limit=1000`);
      if (!response.ok) return {};
      
      const trendingData = await response.json();
      const adpMap: Record<string, number> = {};
      
      trendingData.forEach((player: any, index: number) => {
        if (player.player_id) {
          adpMap[player.player_id] = index + 1;
        }
      });
      
      return adpMap;
    } catch (error) {
      console.warn(`Could not fetch ADP data: ${error}`);
      return {};
    }
  }

  private filterEligiblePlayers(
    allPlayers: Record<string, any>, 
    adpData: Record<string, number>
  ): SleeperPlayerBasic[] {
    const eligible: SleeperPlayerBasic[] = [];

    for (const [playerId, player] of Object.entries(allPlayers)) {
      const hasValidTeam = player.team && player.team !== null && player.team.length > 0;
      const hasValidPosition = this.VALID_POSITIONS.includes(player.position);
      const isNotRetired = player.status !== 'Retired' && player.status !== 'Inactive';
      const hasADP = adpData[playerId] !== undefined;

      if (hasValidTeam && hasValidPosition && isNotRetired && hasADP) {
        eligible.push({
          player_id: playerId,
          first_name: player.first_name,
          last_name: player.last_name,
          full_name: player.full_name,
          team: player.team,
          position: player.position,
          jersey_number: player.jersey_number,
          height: player.height,
          weight: player.weight,
          age: player.age,
          years_exp: player.years_exp,
          college: player.college,
          status: player.status,
          adp: adpData[playerId]
        });
      }
    }

    return eligible;
  }

  private async storeBasicPlayer(sleeperPlayer: SleeperPlayerBasic): Promise<void> {
    // Check if player exists
    const existingPlayer = await db
      .select()
      .from(players)
      .where(eq(players.sleeperId, sleeperPlayer.player_id))
      .limit(1);

    // Only use fields that definitely exist in database
    const basicPlayerData = {
      name: sleeperPlayer.full_name || `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`.trim(),
      team: sleeperPlayer.team!,
      position: sleeperPlayer.position,
      avgPoints: 0,
      projectedPoints: 0,
      ownershipPercentage: 50,
      isAvailable: true,
      upside: 0,
      
      // Basic Sleeper fields (using database column names)
      sleeperId: sleeperPlayer.player_id,
      firstName: sleeperPlayer.first_name,
      lastName: sleeperPlayer.last_name,
      fullName: sleeperPlayer.full_name,
      height: sleeperPlayer.height,
      weight: sleeperPlayer.weight,
      college: sleeperPlayer.college,
      status: sleeperPlayer.status,
      adp: sleeperPlayer.adp,
    };

    if (existingPlayer.length > 0) {
      // Update existing
      await db
        .update(players)
        .set(basicPlayerData)
        .where(eq(players.sleeperId, sleeperPlayer.player_id));
        
      console.log(`📝 Updated: ${basicPlayerData.name} (${basicPlayerData.position} - ${basicPlayerData.team})`);
    } else {
      // Insert new
      await db.insert(players).values(basicPlayerData);
      console.log(`✨ Added: ${basicPlayerData.name} (${basicPlayerData.position} - ${basicPlayerData.team})`);
    }
  }
}

export const sleeperBasicCollector = new SleeperBasicCollector();