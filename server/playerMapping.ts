/**
 * Player Mapping System
 * Links our NFL database with fantasy platform player IDs (Sleeper, ESPN)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { sleeperAPI } from './sleeperAPI';

interface NFLPlayer {
  player_id: string;      // Our NFL ID format: "00-0034857"
  player_name: string;    // Our format: "J.Allen"
  recent_team: string;    // Our format: "BUF"
  position?: string;      // Derived from data structure
}

interface SleeperPlayer {
  player_id: string;      // Sleeper format: "4046"
  full_name: string;      // Sleeper format: "Josh Allen"
  first_name: string;
  last_name: string;
  position: string;
  team: string;
}

interface PlayerMapping {
  nfl_id: string;
  sleeper_id: string | null;
  espn_id: string | null;
  name: string;
  team: string;
  position: string;
  confidence: number; // 0-100 mapping confidence
}

export class PlayerMappingService {
  private mappings: Map<string, PlayerMapping> = new Map();
  private nflData: Record<string, NFLPlayer[]> = {};
  private sleeperPlayers: Map<string, SleeperPlayer> = new Map();

  constructor() {
    this.loadNFLData();
  }

  /**
   * Load our NFL database
   */
  private loadNFLData() {
    try {
      const dataPath = path.join(__dirname, 'nfl_data_2024.json');
      const rawData = fs.readFileSync(dataPath, 'utf8');
      this.nflData = JSON.parse(rawData);
      console.log('✅ Loaded NFL database for player mapping');
    } catch (error) {
      console.error('❌ Failed to load NFL data for mapping:', error);
    }
  }

  /**
   * Generate comprehensive player mappings
   */
  async generateMappings(): Promise<PlayerMapping[]> {
    console.log('🔄 Generating player mappings between NFL database and fantasy platforms...');
    
    // Get Sleeper player data
    await this.loadSleeperPlayers();
    
    const mappings: PlayerMapping[] = [];
    
    // Process each position
    for (const [position, players] of Object.entries(this.nflData)) {
      for (const nflPlayer of players) {
        const mapping = await this.createMapping(nflPlayer, position);
        if (mapping) {
          mappings.push(mapping);
          this.mappings.set(nflPlayer.player_id, mapping);
        }
      }
    }

    // Save mappings to file
    this.saveMappings(mappings);
    
    console.log(`✅ Generated ${mappings.length} player mappings`);
    return mappings;
  }

  /**
   * Load Sleeper player database
   */
  private async loadSleeperPlayers() {
    try {
      this.sleeperPlayers = await sleeperAPI.getAllPlayers();
      console.log(`✅ Loaded ${this.sleeperPlayers.size} Sleeper players`);
    } catch (error) {
      console.error('❌ Failed to load Sleeper players:', error);
    }
  }

  /**
   * Create mapping for individual player
   */
  private async createMapping(nflPlayer: NFLPlayer, position: string): Promise<PlayerMapping | null> {
    const cleanName = this.cleanPlayerName(nflPlayer.player_name);
    const sleeperId = this.findSleeperMatch(cleanName, nflPlayer.recent_team, position);
    
    const mapping: PlayerMapping = {
      nfl_id: nflPlayer.player_id,
      sleeper_id: sleeperId,
      espn_id: null, // TODO: Add ESPN mapping
      name: cleanName,
      team: nflPlayer.recent_team,
      position: position,
      confidence: sleeperId ? 85 : 0
    };

    return mapping;
  }

  /**
   * Clean and normalize player names
   */
  private cleanPlayerName(name: string): string {
    // Convert "J.Allen" to "Josh Allen" format
    const nameMap: Record<string, string> = {
      'J.Allen': 'Josh Allen',
      'L.Jackson': 'Lamar Jackson',
      'J.Gibbs': 'Jahmyr Gibbs',
      'A.St. Brown': 'Amon-Ra St. Brown',
      'T.Kelce': 'Travis Kelce',
      'P.Mahomes': 'Patrick Mahomes',
      'C.McCaffrey': 'Christian McCaffrey',
      'J.Jefferson': 'Justin Jefferson',
      'T.Hill': 'Tyreek Hill',
      'D.Adams': 'Davante Adams'
    };

    if (nameMap[name]) {
      return nameMap[name];
    }

    // Basic cleanup for other names
    return name
      .replace(/\./g, '') // Remove periods
      .split(' ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Find matching Sleeper player
   */
  private findSleeperMatch(name: string, team: string, position: string): string | null {
    for (const [sleeperId, sleeperPlayer] of Array.from(this.sleeperPlayers.entries())) {
      if (!sleeperPlayer.full_name) continue;

      // Exact name match
      if (sleeperPlayer.full_name.toLowerCase() === name.toLowerCase()) {
        // Verify team and position if available
        if (sleeperPlayer.team === team || sleeperPlayer.position === position) {
          return sleeperId;
        }
      }

      // Partial name matching for common abbreviations
      const nameParts = name.toLowerCase().split(' ');
      const sleeperParts = sleeperPlayer.full_name.toLowerCase().split(' ');
      
      if (nameParts.length >= 2 && sleeperParts.length >= 2) {
        const lastNameMatch = nameParts[nameParts.length - 1] === sleeperParts[sleeperParts.length - 1];
        const firstInitialMatch = nameParts[0][0] === sleeperParts[0][0];
        
        if (lastNameMatch && firstInitialMatch && sleeperPlayer.team === team) {
          return sleeperId;
        }
      }
    }

    return null;
  }

  /**
   * Save mappings to file
   */
  private saveMappings(mappings: PlayerMapping[]) {
    try {
      const mappingPath = path.join(__dirname, 'player_mappings.json');
      fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2));
      console.log(`✅ Saved player mappings to ${mappingPath}`);
    } catch (error) {
      console.error('❌ Failed to save mappings:', error);
    }
  }

  /**
   * Get Sleeper ID for NFL player
   */
  getSleeperIdByNFL(nflId: string): string | null {
    const mapping = this.mappings.get(nflId);
    return mapping?.sleeper_id || null;
  }

  /**
   * Get NFL ID for Sleeper player
   */
  getNFLIdBySleeper(sleeperId: string): string | null {
    const mappingValues = Array.from(this.mappings.values());
    for (const mapping of mappingValues) {
      if (mapping.sleeper_id === sleeperId) {
        return mapping.nfl_id;
      }
    }
    return null;
  }

  /**
   * Get mapping statistics
   */
  getMappingStats(): { total: number; mapped: number; confidence: number } {
    const total = this.mappings.size;
    const mappingValues = Array.from(this.mappings.values());
    const mapped = mappingValues.filter(m => m.sleeper_id).length;
    const avgConfidence = mappingValues.reduce((sum, m) => sum + m.confidence, 0) / total;

    return { total, mapped, confidence: Math.round(avgConfidence) };
  }
}

export const playerMapping = new PlayerMappingService();