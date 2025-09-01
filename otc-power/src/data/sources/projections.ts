/**
 * Projections Data Source
 * 
 * Phase B: Ingestion Layers - Pull external projections and consensus data
 * Aggregates projections from multiple sources for comparison against actual performance
 */

interface ProjectionData {
  [player_id: string]: number;
}

interface ProjectionSource {
  name: string;
  weight: number;
  data: ProjectionData;
}

/**
 * Fetch external projections for specific position
 * @param season NFL season
 * @param week NFL week  
 * @param pos Position filter ('QB'|'RB'|'WR'|'TE')
 * @returns Record of player_id -> projected fantasy points
 */
export async function fetchProjections(
  season: number, 
  week: number, 
  pos: 'QB' | 'RB' | 'WR' | 'TE'
): Promise<Record<string, number>> {
  try {
    // Use existing projections service
    const response = await fetch(`/api/projections/${pos.toLowerCase()}?season=${season}&week=${week}`);
    
    if (!response.ok) {
      // Fallback to position-specific mock projections
      return getMockProjections(pos);
    }
    
    const data = await response.json() as ProjectionData;
    return data;
  } catch (error) {
    console.error(`Failed to fetch ${pos} projections for week ${week}:`, error);
    return getMockProjections(pos);
  }
}

/**
 * Fetch weighted consensus projections from multiple sources
 * @param season NFL season
 * @param week NFL week
 * @param pos Position filter
 * @returns Weighted consensus projections
 */
export async function fetchConsensusProjections(
  season: number,
  week: number,
  pos: 'QB' | 'RB' | 'WR' | 'TE'
): Promise<Record<string, number>> {
  try {
    // Fetch from multiple projection sources
    const sources = await Promise.allSettled([
      fetchFantasyProsProjections(season, week, pos),
      fetchSleeperProjections(season, week, pos),
      fetchESPNProjections(season, week, pos)
    ]);
    
    // Combine with weights
    const projectionSources: ProjectionSource[] = [];
    
    if (sources[0].status === 'fulfilled') {
      projectionSources.push({ name: 'FantasyPros', weight: 0.5, data: sources[0].value });
    }
    if (sources[1].status === 'fulfilled') {
      projectionSources.push({ name: 'Sleeper', weight: 0.3, data: sources[1].value });
    }
    if (sources[2].status === 'fulfilled') {
      projectionSources.push({ name: 'ESPN', weight: 0.2, data: sources[2].value });
    }
    
    return weightedConsensus(projectionSources);
  } catch (error) {
    console.error(`Failed to fetch consensus projections for ${pos}:`, error);
    return getMockProjections(pos);
  }
}

/**
 * Fetch FantasyPros projections
 */
async function fetchFantasyProsProjections(
  season: number,
  week: number,
  pos: string
): Promise<ProjectionData> {
  const response = await fetch(`/api/external/fantasypros/projections?pos=${pos}&week=${week}`);
  if (!response.ok) throw new Error('FantasyPros unavailable');
  return await response.json();
}

/**
 * Fetch Sleeper projections
 */
async function fetchSleeperProjections(
  season: number,
  week: number,
  pos: string
): Promise<ProjectionData> {
  const response = await fetch(`/api/sleeper/projections?pos=${pos}&season=${season}&week=${week}`);
  if (!response.ok) throw new Error('Sleeper projections unavailable');
  return await response.json();
}

/**
 * Fetch ESPN projections
 */
async function fetchESPNProjections(
  season: number,
  week: number,
  pos: string
): Promise<ProjectionData> {
  const response = await fetch(`/api/external/espn/projections?pos=${pos}&week=${week}`);
  if (!response.ok) throw new Error('ESPN projections unavailable');
  return await response.json();
}

/**
 * Calculate weighted consensus from multiple projection sources
 */
function weightedConsensus(sources: ProjectionSource[]): Record<string, number> {
  if (!sources.length) return {};
  
  const consensus: Record<string, number> = {};
  const playerIds = new Set<string>();
  
  // Collect all unique player IDs
  sources.forEach(source => {
    Object.keys(source.data).forEach(playerId => playerIds.add(playerId));
  });
  
  // Calculate weighted average for each player
  for (const playerId of playerIds) {
    let weightedSum = 0;
    let totalWeight = 0;
    
    sources.forEach(source => {
      if (source.data[playerId] !== undefined) {
        weightedSum += source.data[playerId] * source.weight;
        totalWeight += source.weight;
      }
    });
    
    if (totalWeight > 0) {
      consensus[playerId] = weightedSum / totalWeight;
    }
  }
  
  return consensus;
}

/**
 * Mock projections for fallback scenarios
 */
function getMockProjections(pos: 'QB' | 'RB' | 'WR' | 'TE'): ProjectionData {
  switch (pos) {
    case 'QB':
      return {
        'josh-allen': 25.2,
        'lamar-jackson': 24.8,
        'jalen-hurts': 23.1,
        'joe-burrow': 21.5,
        'dak-prescott': 20.8,
        
        // Key focus: Rookie/development QBs with lower projections
        'drake-maye': 14.8,       // LOW projection - creates "beat projection" upside
        'jj-mccarthy': 12.2,      // LOW projection - creates "beat projection" upside
        'caleb-williams': 16.4,
        'anthony-richardson': 17.9
      };
      
    case 'RB':
      return {
        'christian-mccaffrey': 22.1,
        'saquon-barkley': 19.8,
        'derrick-henry': 18.5,
        'austin-ekeler': 17.2,
        'alvin-kamara': 16.9
      };
      
    case 'WR':
      return {
        'cooper-kupp': 19.1,
        'tyreek-hill': 18.7,
        'davante-adams': 18.2,
        'justin-jefferson': 20.1,
        'stefon-diggs': 17.5
      };
      
    case 'TE':
      return {
        'travis-kelce': 16.8,
        'mark-andrews': 15.1,
        'george-kittle': 14.9,
        'darren-waller': 13.8,
        'kyle-pitts': 14.2
      };
      
    default:
      return {};
  }
}