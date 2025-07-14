import playerMappings from '../../data/player_mappings.json';

export interface PlayerProjection {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  projectedYards: number;
  projectedTDs: number;
  receptions?: number;
  source: string;
}

/**
 * Parse raw data string into array of objects
 * Supports both JSON and CSV formats
 */
function parseData(data: string): any[] {
  if (!data || typeof data !== 'string') {
    throw new Error('Invalid data: must be a non-empty string');
  }

  try {
    // Try JSON first
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error('JSON data must be an array');
  } catch (jsonError) {
    try {
      // Fallback to CSV parsing
      const lines = data.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV must have at least header and one data row');
      }
      
      const headers = lines[0].split(',').map(h => h.trim());
      if (headers.length === 0) {
        throw new Error('CSV headers cannot be empty');
      }

      return lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim());
        if (values.length !== headers.length) {
          console.warn(`Row ${index + 2}: Column count mismatch (${values.length} vs ${headers.length})`);
        }
        
        const row: { [key: string]: string } = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      });
    } catch (csvError) {
      throw new Error(`Failed to parse data as JSON or CSV. JSON Error: ${jsonError}. CSV Error: ${csvError}`);
    }
  }
}

/**
 * Core ingestion function - accepts raw data and source parameter
 * Maps player names to IDs and outputs standardized PlayerProjection arrays
 */
export function ingestProjections(data: string, source: string): PlayerProjection[] {
  if (!source || typeof source !== 'string') {
    throw new Error('Source parameter is required and must be a string');
  }

  try {
    const parsedRows = parseData(data);
    
    const projections = parsedRows.map((item, index) => {
      // Validate required fields
      if (!item.playerName) {
        throw new Error(`Row ${index + 1}: playerName is required`);
      }
      
      const name = item.playerName.trim();
      const playerId = (playerMappings as Record<string, string>)[name] || 'UNKNOWN';
      
      // Log unknown players for mapping updates
      if (playerId === 'UNKNOWN') {
        console.warn(`Unknown player mapping: "${name}" - consider adding to player_mappings.json`);
      }

      return {
        playerId,
        playerName: name,
        position: item.position || '',
        team: item.team || '',
        projectedYards: parseFloat(item.projectedYards) || 0,
        projectedTDs: parseFloat(item.projectedTDs) || 0,
        receptions: item.receptions ? parseFloat(item.receptions) : undefined,
        source: source.toLowerCase()
      };
    });

    console.log(`✅ Successfully ingested ${projections.length} projections from ${source}`);
    return projections;
    
  } catch (error) {
    console.error(`❌ Error ingesting projections from ${source}:`, error);
    throw error;
  }
}

// Wrapper functions
export const ingestOasis = (data: string): PlayerProjection[] => {
  return ingestProjections(data, 'oasis');
};

export const ingestFantasyPros = (data: string): PlayerProjection[] => {
  return ingestProjections(data, 'fantasyPros');
};

// Test data for validation
export const testData = {
  oasisJSON: '[{"playerName": "Patrick Mahomes", "position": "QB", "team": "KC", "projectedYards": 4600, "projectedTDs": 36}, {"playerName": "Josh Allen", "position": "QB", "team": "BUF", "projectedYards": 4400, "projectedTDs": 35, "receptions": 0}]',
  
  fantasyProsCSV: `playerName,position,team,projectedYards,projectedTDs,receptions
Patrick Mahomes,QB,KC,4500,35,0
Ja'Marr Chase,WR,CIN,1200,8,85
Saquon Barkley,RB,PHI,1400,12,45
Travis Kelce,TE,KC,900,8,75`,

  oasisCSV: `playerName,position,team,projectedYards,projectedTDs
Justin Jefferson,WR,MIN,1350,9
CeeDee Lamb,WR,DAL,1300,8
Christian McCaffrey,RB,SF,1500,14`,

  fantasyProsJSON: '[{"playerName": "Lamar Jackson", "position": "QB", "team": "BAL", "projectedYards": 3800, "projectedTDs": 28}, {"playerName": "Tyreek Hill", "position": "WR", "team": "MIA", "projectedYards": 1250, "projectedTDs": 7, "receptions": 95}]'
};

// Testing function (for development use)
export function runTests(): void {
  console.log('\n🧪 Testing Projections Ingestion System...\n');
  
  try {
    console.log('Testing OASIS JSON:');
    console.log(ingestOasis(testData.oasisJSON));
    
    console.log('\nTesting FantasyPros CSV:');
    console.log(ingestFantasyPros(testData.fantasyProsCSV));
    
    console.log('\nTesting OASIS CSV:');
    console.log(ingestOasis(testData.oasisCSV));
    
    console.log('\nTesting FantasyPros JSON:');
    console.log(ingestFantasyPros(testData.fantasyProsJSON));
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}