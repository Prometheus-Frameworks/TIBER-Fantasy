import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface SnapData {
  player_name: string;
  snap_percentages: {
    [key: string]: number; // week_1: 85, week_2: 92, etc.
  };
}

interface SportsDataPlayer {
  PlayerID: number;
  Name: string;
  Team: string;
  Position: string;
  SnapCount?: number;
  SnapCountPercent?: number;
}

interface MSFPlayerSnaps {
  player: {
    displayName: string;
    position: string;
    currentTeam?: {
      abbreviation: string;
    };
  };
  stats: {
    offense?: {
      snapsPlayed?: string;
      snapsPossible?: string;
      snapsPlayedPct?: string;
    };
  };
}

export class SnapPercentageService {
  private msfUsername: string;
  private msfPassword: string;
  private cache: Map<string, SnapData[]> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.msfUsername = process.env.MSF_USERNAME || '';
    this.msfPassword = process.env.MSF_PASSWORD || '';
  }

  /**
   * Get top 50 WR snap percentages for weeks 1-17
   */
  async getTop50WRSnapPercentages(): Promise<SnapData[]> {
    try {
      console.log('🏈 Loading generated snap percentages for top 50 WRs...');
      
      // Try to load the generated snap percentage data first
      try {
        const snapDataPath = path.join(process.cwd(), 'server/data/wr_snap_percentages_2024.json');
        const snapData = JSON.parse(fs.readFileSync(snapDataPath, 'utf8'));
        
        console.log(`✅ Loaded snap data for ${snapData.length} WRs from generated dataset`);
        return snapData;
        
      } catch (fileError) {
        console.log('⚠️ Generated snap data not found, trying external APIs...');
        
        // Try SportsData API as fallback
        const sportsDataResult = await this.fetchFromSportsDataAPI();
        if (sportsDataResult.length > 0) {
          console.log(`✅ SportsData API returned ${sportsDataResult.length} WRs`);
          return sportsDataResult;
        }

        // Fallback to MySportsFeeds
        const msfResult = await this.fetchFromMySportsFeeds();
        if (msfResult.length > 0) {
          console.log(`✅ MySportsFeeds returned ${msfResult.length} WRs`);
          return msfResult;
        }

        throw new Error('No snap percentage data available from any source');
      }

    } catch (error) {
      console.error('❌ Error fetching snap percentages:', error);
      throw error;
    }
  }

  /**
   * Fetch from SportsData.io API
   */
  private async fetchFromSportsDataAPI(): Promise<SnapData[]> {
    try {
      console.log('📊 Attempting SportsData API...');
      
      const snapData: SnapData[] = [];
      const topWRs = await this.getTopWRList();

      // Fetch weekly snap counts for weeks 1-17
      for (let week = 1; week <= 17; week++) {
        try {
          const response = await axios.get(
            `https://api.sportsdata.io/v3/nfl/stats/json/PlayerGameStats/2024/${week}`,
            {
              headers: {
                'Ocp-Apim-Subscription-Key': this.sportsDataApiKey
              },
              timeout: 10000
            }
          );

          if (response.data && Array.isArray(response.data)) {
            this.processSportsDataWeek(response.data, week, snapData, topWRs);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (weekError) {
          console.warn(`⚠️ Week ${week} SportsData failed:`, weekError);
        }
      }

      return this.formatSnapData(snapData);

    } catch (error) {
      console.error('❌ SportsData API failed:', error);
      return [];
    }
  }

  /**
   * Fetch from MySportsFeeds API
   */
  private async fetchFromMySportsFeeds(): Promise<SnapData[]> {
    try {
      console.log('📊 Attempting MySportsFeeds API...');
      
      const snapData: SnapData[] = [];
      const auth = Buffer.from(`${this.msfUsername}:${this.msfPassword}`).toString('base64');

      // Fetch weekly snap data for weeks 1-17
      for (let week = 1; week <= 17; week++) {
        try {
          // Format week as 2-digit string
          const weekStr = week.toString().padStart(2, '0');
          
          const response = await axios.get(
            `https://api.mysportsfeeds.com/v2.1/pull/nfl/2024-regular/week-${weekStr}/player_gamelogs.json`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
              },
              params: {
                position: 'WR',
                limit: 100
              },
              timeout: 15000
            }
          );

          if (response.data && response.data.gamelogs) {
            this.processMSFWeek(response.data.gamelogs, week, snapData);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (weekError) {
          console.warn(`⚠️ Week ${week} MSF failed:`, weekError);
        }
      }

      return this.formatSnapData(snapData);

    } catch (error) {
      console.error('❌ MySportsFeeds API failed:', error);
      return [];
    }
  }

  /**
   * Process SportsData weekly response
   */
  private processSportsDataWeek(
    weekData: any[], 
    week: number, 
    snapData: SnapData[], 
    topWRs: string[]
  ): void {
    const wrPlayers = weekData.filter(player => 
      player.Position === 'WR' && 
      player.SnapCount !== null && 
      player.SnapCount !== undefined &&
      topWRs.includes(player.Name)
    );

    wrPlayers.forEach(player => {
      if (player.SnapCountPercent !== null && player.SnapCountPercent !== undefined) {
        let existingPlayer = snapData.find(p => p.player_name === player.Name);
        
        if (!existingPlayer) {
          existingPlayer = {
            player_name: player.Name,
            snap_percentages: {}
          };
          snapData.push(existingPlayer);
        }

        existingPlayer.snap_percentages[`week_${week}`] = Math.round(player.SnapCountPercent);
      }
    });
  }

  /**
   * Process MySportsFeeds weekly response
   */
  private processMSFWeek(gamelogs: MSFPlayerSnaps[], week: number, snapData: SnapData[]): void {
    gamelogs.forEach(gamelog => {
      if (gamelog.player.position === 'WR' && 
          gamelog.stats.offense?.snapsPlayedPct) {
        
        const snapPct = parseFloat(gamelog.stats.offense.snapsPlayedPct);
        if (!isNaN(snapPct)) {
          let existingPlayer = snapData.find(p => p.player_name === gamelog.player.displayName);
          
          if (!existingPlayer) {
            existingPlayer = {
              player_name: gamelog.player.displayName,
              snap_percentages: {}
            };
            snapData.push(existingPlayer);
          }

          existingPlayer.snap_percentages[`week_${week}`] = Math.round(snapPct);
        }
      }
    });
  }

  /**
   * Get list of top 50 fantasy WRs
   */
  private async getTopWRList(): Promise<string[]> {
    // Based on the existing WR dataset
    return [
      "Ja'Marr Chase", "Amon-Ra St. Brown", "Justin Jefferson", "CeeDee Lamb", 
      "Puka Nacua", "A.J. Brown", "Tyreek Hill", "Davante Adams", "Nico Collins", 
      "Chris Olave", "DK Metcalf", "Garrett Wilson", "DeVonta Smith", "Mike Evans", 
      "Cooper Kupp", "Tee Higgins", "DJ Moore", "Amari Cooper", "Calvin Ridley", 
      "Terry McLaurin", "George Pickens", "Zay Flowers", "Courtland Sutton", 
      "Keenan Allen", "Tank Dell", "Ladd McConkey", "Brian Thomas Jr.", 
      "Marvin Harrison Jr.", "Rome Odunze", "Malik Nabers", "Jayden Reed", 
      "Jordan Addison", "Darnell Mooney", "Jauan Jennings", "Xavier Worthy", 
      "Rashee Rice", "Cedric Tillman", "Jaxon Smith-Njigba", "Diontae Johnson", 
      "Jerry Jeudy", "DeAndre Hopkins", "Tyler Lockett", "Khalil Shakir", 
      "Jameson Williams", "Josh Downs", "Adam Thielen", "Quentin Johnston", 
      "Jaylen Waddle", "Hollywood Brown", "Wan'Dale Robinson"
    ];
  }

  /**
   * Format snap data and ensure top 50 WRs
   */
  private formatSnapData(snapData: SnapData[]): SnapData[] {
    // Fill missing weeks with 0 for inactive/injured weeks
    snapData.forEach(player => {
      for (let week = 1; week <= 17; week++) {
        const weekKey = `week_${week}`;
        if (!(weekKey in player.snap_percentages)) {
          player.snap_percentages[weekKey] = 0;
        }
      }
    });

    // Sort by total snaps and return top 50
    return snapData
      .sort((a, b) => {
        const totalA = Object.values(a.snap_percentages).reduce((sum, val) => sum + val, 0);
        const totalB = Object.values(b.snap_percentages).reduce((sum, val) => sum + val, 0);
        return totalB - totalA;
      })
      .slice(0, 50);
  }
}

export const snapPercentageService = new SnapPercentageService();