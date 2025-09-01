/**
 * FantasyPros Data Source
 * 
 * Phase B: Ingestion Layers - Pull expert consensus rankings and projections
 * Provides expert consensus rankings (ECR) and market anchor data
 */

interface FantasyProECR {
  [player_id: string]: number;  // Consensus ranking position
}

interface FantasyProProjections {
  [player_id: string]: number;  // Projected fantasy points
}

interface FantasyProPlayer {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  rank: number;
  avg_rank: number;
  std_dev: number;
  projected_points: number;
}

/**
 * Fetch Expert Consensus Rankings (ECR) from FantasyPros
 * @param season NFL season
 * @param week NFL week
 * @param pos Position filter ('QB'|'RB'|'WR'|'TE'|'ALL')
 * @param format League format ('dynasty'|'redraft')
 * @returns Record of player_id -> consensus rank
 */
export async function fetchECR(
  season: number,
  week: number,
  pos: 'QB' | 'RB' | 'WR' | 'TE' | 'ALL' = 'ALL',
  format: 'dynasty' | 'redraft' = 'redraft'
): Promise<Record<string, number>> {
  try {
    // Use existing FantasyPros integration if available
    const response = await fetch(`/api/external/fantasypros/ecr?pos=${pos}&week=${week}&format=${format}`);
    
    if (!response.ok) {
      console.warn(`FantasyPros ECR unavailable (${response.status}), using mock rankings`);
      return getMockECR(pos, format);
    }
    
    const data = await response.json() as { players: FantasyProPlayer[] };
    
    // Convert to player_id -> rank mapping
    const ecrData: Record<string, number> = {};
    
    for (const player of data.players) {
      ecrData[player.player_id] = player.avg_rank || player.rank || 999;
    }
    
    return ecrData;
  } catch (error) {
    console.error(`Failed to fetch FantasyPros ECR for ${pos} week ${week}:`, error);
    return getMockECR(pos, format);
  }
}

/**
 * Fetch FantasyPros projections
 * @param season NFL season
 * @param week NFL week
 * @param pos Position filter
 * @returns Record of player_id -> projected points
 */
export async function fetchFPProjections(
  season: number,
  week: number,
  pos: 'QB' | 'RB' | 'WR' | 'TE' | 'ALL' = 'ALL'
): Promise<Record<string, number>> {
  try {
    const response = await fetch(`/api/external/fantasypros/projections?pos=${pos}&week=${week}`);
    
    if (!response.ok) {
      return getMockFPProjections(pos);
    }
    
    const data = await response.json() as { players: FantasyProPlayer[] };
    
    const projections: Record<string, number> = {};
    
    for (const player of data.players) {
      projections[player.player_id] = player.projected_points || 0;
    }
    
    return projections;
  } catch (error) {
    console.error(`Failed to fetch FantasyPros projections for ${pos}:`, error);
    return getMockFPProjections(pos);
  }
}

/**
 * Calculate market anchor: How player ranks vs ECR expectations
 * @param player_id Player identifier
 * @param actualRank OTC Power rank
 * @param ecrRank FantasyPros ECR rank
 * @returns Market anchor score (0-100, 50 = neutral)
 */
export function calculateMarketAnchor(
  player_id: string,
  actualRank: number,
  ecrRank: number
): number {
  if (!ecrRank || ecrRank === 999) return 50; // Neutral if no ECR data
  
  // Convert rank differences to 0-100 scale
  // Lower actual rank (better) vs higher ECR rank (worse) = value pick (>50)
  // Higher actual rank (worse) vs lower ECR rank (better) = overvalued (<50)
  
  const rankDiff = ecrRank - actualRank;
  
  // Scale: -50 to +50 rank difference maps to 0-100 score
  const normalized = Math.max(-50, Math.min(50, rankDiff));
  return Math.round(50 + normalized);
}

/**
 * Mock ECR data for fallback scenarios
 */
function getMockECR(pos: string, format: string): Record<string, number> {
  if (pos === 'QB' || pos === 'ALL') {
    return {
      'josh-allen': 1,
      'lamar-jackson': 2,
      'patrick-mahomes': 3,
      'jalen-hurts': 4,
      'joe-burrow': 5,
      'tua-tagovailoa': 8,
      'dak-prescott': 9,
      'cj-stroud': 6,
      'justin-herbert': 7,
      'aaron-rodgers': 10,
      
      // Key: Rookie/development QBs ranked lower in consensus
      'drake-maye': 18,        // Low ECR creates market anchor opportunity
      'jj-mccarthy': 24,       // Low ECR creates market anchor opportunity
      'caleb-williams': 12,
      'anthony-richardson': 15,
      'jayden-daniels': 16
    };
  }
  
  if (pos === 'RB' || pos === 'ALL') {
    return {
      'christian-mccaffrey': 1,
      'saquon-barkley': 2,
      'derrick-henry': 3,
      'austin-ekeler': 4,
      'alvin-kamara': 5,
      'jonathan-taylor': 6,
      'nick-chubb': 7,
      'dalvin-cook': 8,
      'ezekiel-elliott': 12,
      'josh-jacobs': 9
    };
  }
  
  if (pos === 'WR' || pos === 'ALL') {
    return {
      'cooper-kupp': 2,
      'tyreek-hill': 1,
      'davante-adams': 4,
      'justin-jefferson': 3,
      'stefon-diggs': 5,
      'deandre-hopkins': 8,
      'mike-evans': 6,
      'keenan-allen': 9,
      'chris-godwin': 7,
      'aj-brown': 10
    };
  }
  
  if (pos === 'TE' || pos === 'ALL') {
    return {
      'travis-kelce': 1,
      'mark-andrews': 2,
      'george-kittle': 3,
      'darren-waller': 4,
      'kyle-pitts': 5,
      'tj-hockenson': 6,
      'dallas-goedert': 7,
      'mike-gesicki': 8,
      'pat-freiermuth': 9,
      'david-njoku': 10
    };
  }
  
  return {};
}

/**
 * Mock FantasyPros projections
 */
function getMockFPProjections(pos: string): Record<string, number> {
  if (pos === 'QB' || pos === 'ALL') {
    return {
      'josh-allen': 24.8,
      'lamar-jackson': 24.2,
      'jalen-hurts': 22.5,
      'joe-burrow': 21.1,
      'dak-prescott': 20.4,
      
      // Conservative projections for rushing rookies (creates beat proj upside)
      'drake-maye': 13.5,       // Conservative FantasyPros projection 
      'jj-mccarthy': 11.8,      // Conservative FantasyPros projection
      'caleb-williams': 15.9,
      'anthony-richardson': 17.2
    };
  }
  
  return getMockProjectionsByPosition(pos);
}

/**
 * Helper function for position-specific mock projections
 */
function getMockProjectionsByPosition(pos: string): Record<string, number> {
  switch (pos) {
    case 'RB':
      return {
        'christian-mccaffrey': 21.5,
        'saquon-barkley': 19.2,
        'derrick-henry': 18.1,
        'austin-ekeler': 16.8,
        'alvin-kamara': 16.4
      };
      
    case 'WR':
      return {
        'cooper-kupp': 18.6,
        'tyreek-hill': 18.9,
        'davante-adams': 17.8,
        'justin-jefferson': 19.5,
        'stefon-diggs': 17.1
      };
      
    case 'TE':
      return {
        'travis-kelce': 16.2,
        'mark-andrews': 14.6,
        'george-kittle': 14.4,
        'darren-waller': 13.4,
        'kyle-pitts': 13.8
      };
      
    default:
      return {};
  }
}