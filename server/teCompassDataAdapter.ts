/**
 * TE Compass Data Adapter
 * Transforms stored TE JSON files into compass calculation format
 */

import fs from 'fs';
import path from 'path';
import { TEPlayerData } from './teCompassCalculations';

export class TECompassDataAdapter {
  private teDataPath = path.join(process.cwd(), 'data', 'players', 'TE');

  /**
   * Load all TE players from stored JSON files
   */
  async getAllTEPlayers(): Promise<TEPlayerData[]> {
    try {
      if (!fs.existsSync(this.teDataPath)) {
        console.log('📂 TE data directory not found, creating...');
        fs.mkdirSync(this.teDataPath, { recursive: true });
        return [];
      }

      const teFiles = fs.readdirSync(this.teDataPath)
        .filter(file => file.endsWith('.json'));

      if (teFiles.length === 0) {
        console.log('📊 No TE data files found');
        return [];
      }

      const tePlayers: TEPlayerData[] = [];
      
      for (const file of teFiles) {
        const filePath = path.join(this.teDataPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const playerData = JSON.parse(fileContent);
        
        // Validate required fields
        if (this.isValidTEData(playerData)) {
          tePlayers.push(playerData);
        } else {
          console.warn(`⚠️ Invalid TE data in ${file}, skipping`);
        }
      }

      console.log(`🏈 Loaded ${tePlayers.length} TE players for compass analysis`);
      return tePlayers.sort((a, b) => b.receiving_yards - a.receiving_yards); // Sort by receiving yards desc

    } catch (error) {
      console.error('Error loading TE data:', error);
      return [];
    }
  }

  /**
   * Get specific TE player by name
   */
  async getTEPlayer(name: string): Promise<TEPlayerData | null> {
    try {
      const fileName = this.nameToFileName(name);
      const filePath = path.join(this.teDataPath, fileName);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const playerData = JSON.parse(fileContent);
      
      return this.isValidTEData(playerData) ? playerData : null;
    } catch (error) {
      console.error(`Error loading TE player ${name}:`, error);
      return null;
    }
  }

  /**
   * Get top TEs by receiving yards
   */
  async getTopTEs(limit: number = 12): Promise<TEPlayerData[]> {
    const allTEs = await this.getAllTEPlayers();
    return allTEs.slice(0, limit);
  }

  /**
   * Get TEs by team
   */
  async getTEsByTeam(team: string): Promise<TEPlayerData[]> {
    const allTEs = await this.getAllTEPlayers();
    return allTEs.filter(te => te.team.toLowerCase() === team.toLowerCase());
  }

  /**
   * Get rookie TEs
   */
  async getRookieTEs(): Promise<TEPlayerData[]> {
    const allTEs = await this.getAllTEPlayers();
    return allTEs.filter(te => te.rookie_status === 'Rookie');
  }

  /**
   * Validate TE data structure
   */
  private isValidTEData(data: any): data is TEPlayerData {
    const requiredFields = [
      'name', 'team', 'position', 'age', 'rookie_status', 
      'games_played', 'targets', 'receptions', 'receiving_yards',
      'receiving_touchdowns', 'yards_per_reception', 'yards_after_catch',
      'red_zone_targets', 'pff_receiving_grade', 'pff_pass_blocking_grade', 'notes'
    ];

    return requiredFields.every(field => {
      if (!(field in data)) {
        console.warn(`Missing required field: ${field}`);
        return false;
      }
      return true;
    }) && data.position === 'TE';
  }

  /**
   * Convert player name to filename format
   */
  private nameToFileName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, '_') // Replace spaces with underscores
      + '.json';
  }

  /**
   * Get summary statistics for all TEs
   */
  async getTESummaryStats(): Promise<{
    totalPlayers: number;
    averageAge: number;
    rookieCount: number;
    totalTargets: number;
    averageYards: number;
    topProducer: string;
  }> {
    const allTEs = await this.getAllTEPlayers();
    
    if (allTEs.length === 0) {
      return {
        totalPlayers: 0,
        averageAge: 0,
        rookieCount: 0,
        totalTargets: 0,
        averageYards: 0,
        topProducer: 'N/A'
      };
    }

    const totalTargets = allTEs.reduce((sum, te) => sum + te.targets, 0);
    const totalYards = allTEs.reduce((sum, te) => sum + te.receiving_yards, 0);
    const totalAge = allTEs.reduce((sum, te) => sum + te.age, 0);
    const rookieCount = allTEs.filter(te => te.rookie_status === 'Rookie').length;
    const topProducer = allTEs[0]; // Already sorted by yards

    return {
      totalPlayers: allTEs.length,
      averageAge: Math.round((totalAge / allTEs.length) * 10) / 10,
      rookieCount,
      totalTargets,
      averageYards: Math.round((totalYards / allTEs.length) * 10) / 10,
      topProducer: `${topProducer.name} (${topProducer.receiving_yards} yards)`
    };
  }
}

export const teCompassDataAdapter = new TECompassDataAdapter();