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
   * Clean and normalize player names with comprehensive mapping
   */
  private cleanPlayerName(name: string): string {
    // Comprehensive name mapping from NFL abbreviated format to full names
    const nameMap: Record<string, string> = {
      // Top QBs
      'J.Allen': 'Josh Allen', 'L.Jackson': 'Lamar Jackson', 'P.Mahomes II': 'Patrick Mahomes II',
      'J.Burrow': 'Joe Burrow', 'J.Hurts': 'Jalen Hurts', 'T.Tagovailoa': 'Tua Tagovailoa',
      'J.Herbert': 'Justin Herbert', 'D.Prescott': 'Dak Prescott', 'B.Purdy': 'Brock Purdy',
      'J.Daniels': 'Jayden Daniels', 'C.Williams': 'Caleb Williams', 'D.Maye': 'Drake Maye',
      
      // Top RBs  
      'C.McCaffrey': 'Christian McCaffrey', 'J.Jacobs': 'Josh Jacobs', 'S.Barkley': 'Saquon Barkley',
      'D.Henry': 'Derrick Henry', 'A.Kamara': 'Alvin Kamara', 'N.Chubb': 'Nick Chubb',
      'J.Mixon': 'Joe Mixon', 'A.Jones': 'Aaron Jones', 'B.Robinson': 'Bijan Robinson',
      'J.Gibbs': 'Jahmyr Gibbs', 'B.Hall': 'Breece Hall', 'K.Walker III': 'Kenneth Walker III',
      
      // Top WRs
      'J.Jefferson': 'Justin Jefferson', 'J.Chase': 'Ja\'Marr Chase', 'C.Lamb': 'CeeDee Lamb',
      'T.Hill': 'Tyreek Hill', 'D.Adams': 'Davante Adams', 'S.Diggs': 'Stefon Diggs',
      'D.Hopkins': 'DeAndre Hopkins', 'M.Evans': 'Mike Evans', 'A.St. Brown': 'Amon-Ra St. Brown',
      'C.Olave': 'Chris Olave', 'G.Wilson': 'Garrett Wilson', 'D.London': 'Drake London',
      'M.Nabers': 'Malik Nabers', 'B.Thomas': 'Brian Thomas Jr.', 'M.Harrison': 'Marvin Harrison Jr.',
      
      // Top TEs
      'T.Kelce': 'Travis Kelce', 'M.Andrews': 'Mark Andrews', 'S.LaPorta': 'Sam LaPorta',
      'T.McBride': 'Trey McBride', 'G.Kittle': 'George Kittle', 'K.Pitts': 'Kyle Pitts',
      
      // Common name variations
      'D.Samuel': 'Deebo Samuel', 'D.Johnson': 'Diontae Johnson', 'A.Cooper': 'Amari Cooper'
    };

    if (nameMap[name]) {
      return nameMap[name];
    }

    // Advanced name expansion for abbreviated formats
    const parts = name.split(/[\s\.]+/).filter(Boolean);
    if (parts.length >= 2) {
      const firstPart = parts[0];
      const lastName = parts[parts.length - 1];
      
      // Common first name expansions
      const firstNameMap: Record<string, string> = {
        'J': 'Josh|Justin|Jalen|Joe|Jayden|Ja\'Marr|James|Jonathan|Jordan',
        'C': 'Christian|Chris|Caleb|CeeDee|Cooper|Calvin',
        'D': 'Dak|Drake|Davante|DeAndre|Derrick|Diontae|Deebo',
        'T': 'Travis|Tyreek|Tua|Trey|Tank|Tyler',
        'A': 'Alvin|Aaron|Amon-Ra|Amari|Austin|Antonio',
        'B': 'Brock|Bijan|Breece|Brian|Brandon',
        'M': 'Mark|Malik|Marvin|Mike|Michael',
        'S': 'Saquon|Sam|Stefon|Sterling',
        'K': 'Kenneth|Kyle|Kyren',
        'G': 'George|Garrett',
        'L': 'Lamar|Ladd'
      };
      
      if (firstPart.length === 1 && firstNameMap[firstPart]) {
        return `${firstPart}.${lastName}`; // Keep abbreviated for matching
      }
    }

    // Basic cleanup for unrecognized names
    return name
      .replace(/\./g, '') // Remove periods
      .split(' ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Find matching Sleeper player with enhanced fuzzy matching
   */
  private findSleeperMatch(name: string, team: string, position: string): string | null {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const [sleeperId, sleeperPlayer] of Array.from(this.sleeperPlayers.entries())) {
      if (!sleeperPlayer.full_name) continue;

      let score = 0;
      const cleanName = name.toLowerCase().replace(/[^\w\s]/g, '');
      const sleeperName = sleeperPlayer.full_name.toLowerCase().replace(/[^\w\s]/g, '');

      // Exact name match (highest score)
      if (sleeperName === cleanName) {
        score += 100;
      }
      
      // Last name + first initial match
      const nameParts = cleanName.split(' ');
      const sleeperParts = sleeperName.split(' ');
      
      if (nameParts.length >= 2 && sleeperParts.length >= 2) {
        const lastName = nameParts[nameParts.length - 1];
        const sleeperLastName = sleeperParts[sleeperParts.length - 1];
        
        // Last name exact match
        if (lastName === sleeperLastName) {
          score += 50;
          
          // First initial match
          if (nameParts[0][0] === sleeperParts[0][0]) {
            score += 30;
          }
          
          // Handle abbreviated formats like "J.Allen" -> "Josh Allen"
          if (nameParts[0].length === 1 || nameParts[0].includes('.')) {
            const firstLetter = nameParts[0][0];
            if (sleeperParts[0][0] === firstLetter) {
              score += 40; // Bonus for abbreviated name match
            }
          }
        }
      }

      // Team match bonus
      if (sleeperPlayer.team === team) {
        score += 20;
      }

      // Position match bonus  
      if (sleeperPlayer.position === position) {
        score += 15;
      }

      // Fuzzy string similarity for partial matches
      const similarity = this.calculateStringSimilarity(cleanName, sleeperName);
      if (similarity > 0.7) {
        score += Math.floor(similarity * 30);
      }

      // Update best match if this score is higher
      if (score > bestScore && score >= 40) { // Lowered confidence threshold for better matching
        bestScore = score;
        bestMatch = sleeperId;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate string similarity using Jaro-Winkler-like algorithm
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    const matchDistance = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
    const str1Matches = new Array(str1.length).fill(false);
    const str2Matches = new Array(str2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < str1.length; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, str2.length);

      for (let j = start; j < end; j++) {
        if (str2Matches[j] || str1[i] !== str2[j]) continue;
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    // Find transpositions
    let k = 0;
    for (let i = 0; i < str1.length; i++) {
      if (!str1Matches[i]) continue;
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }

    const jaro = (matches / str1.length + matches / str2.length + 
                 (matches - transpositions / 2) / matches) / 3;

    return jaro;
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