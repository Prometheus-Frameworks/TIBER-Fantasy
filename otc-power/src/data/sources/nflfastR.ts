/**
 * nflfastR Data Source
 * 
 * Phase B: Ingestion Layers - Pull advanced NFL analytics
 * Fetches rushing metrics, target data, and situational usage
 */

interface QBRunTraits {
  player_id: string;
  designedRunRate: number;    // % of dropbacks that are designed runs
  scrambleYdsG: number;       // Scramble yards per game
  rzRushShare: number;        // Red zone rushing share
  explosiveRate?: number;     // 20+ yard play rate
}

interface RBUsageTraits {
  player_id: string;
  inside10Share: number;      // % of team inside-10 opportunities
  snapShare: number;          // % of offensive snaps
  targetShare: number;        // % of team targets
  goalLineCarries: number;    // Goal line carry count
}

interface WRTargetTraits {
  player_id: string;
  targetsPerRoute: number;    // Targets per route run
  airYardsShare: number;      // % of team air yards
  slotRate: number;           // % of snaps in slot
  redZoneTargets: number;     // Red zone target count
}

interface TEUsageTraits {
  player_id: string;
  routeParticipation: number; // % of dropbacks running routes
  blockingRate: number;       // % of snaps blocking
  redZoneTargets: number;     // Red zone target count
  snapShare: number;          // % of offensive snaps
}

/**
 * Fetch QB rushing traits from nflfastR play-by-play data
 * @param season NFL season
 * @param week NFL week (or range for season-long analysis)
 * @returns Array of QB rushing metrics
 */
export async function fetchQbRunTraits(season: number, week: number): Promise<QBRunTraits[]> {
  try {
    // Use existing NFL data service or build nflfastR integration
    const response = await fetch(`/api/nfl/qb-rushing?season=${season}&week=${week}`);
    
    if (!response.ok) {
      // Fallback to mock data based on known rushing QBs
      return getMockQBRushingTraits();
    }
    
    const data = await response.json() as QBRunTraits[];
    return data;
  } catch (error) {
    console.error(`Failed to fetch QB run traits for week ${week}:`, error);
    return getMockQBRushingTraits();
  }
}

/**
 * Fetch RB usage traits from nflfastR
 * @param season NFL season  
 * @param week NFL week
 * @returns Array of RB usage metrics
 */
export async function fetchRbUsageTraits(season: number, week: number): Promise<RBUsageTraits[]> {
  try {
    const response = await fetch(`/api/nfl/rb-usage?season=${season}&week=${week}`);
    
    if (!response.ok) {
      return getMockRBUsageTraits();
    }
    
    const data = await response.json() as RBUsageTraits[];
    return data;
  } catch (error) {
    console.error(`Failed to fetch RB usage traits for week ${week}:`, error);
    return getMockRBUsageTraits();
  }
}

/**
 * Fetch WR target traits from nflfastR
 * @param season NFL season
 * @param week NFL week
 * @returns Array of WR targeting metrics
 */
export async function fetchWrTargetTraits(season: number, week: number): Promise<WRTargetTraits[]> {
  try {
    const response = await fetch(`/api/nfl/wr-targets?season=${season}&week=${week}`);
    
    if (!response.ok) {
      return getMockWRTargetTraits();
    }
    
    const data = await response.json() as WRTargetTraits[];
    return data;
  } catch (error) {
    console.error(`Failed to fetch WR target traits for week ${week}:`, error);
    return getMockWRTargetTraits();
  }
}

/**
 * Fetch TE usage traits from nflfastR
 * @param season NFL season
 * @param week NFL week
 * @returns Array of TE usage metrics
 */
export async function fetchTeUsageTraits(season: number, week: number): Promise<TEUsageTraits[]> {
  try {
    const response = await fetch(`/api/nfl/te-usage?season=${season}&week=${week}`);
    
    if (!response.ok) {
      return getMockTEUsageTraits();
    }
    
    const data = await response.json() as TEUsageTraits[];
    return data;
  } catch (error) {
    console.error(`Failed to fetch TE usage traits for week ${week}:`, error);
    return getMockTEUsageTraits();
  }
}

/**
 * Mock data for QB rushing traits (fallback during development)
 * Based on known rushing QBs and their typical metrics
 */
function getMockQBRushingTraits(): QBRunTraits[] {
  return [
    { player_id: 'josh-allen', designedRunRate: 0.15, scrambleYdsG: 25.3, rzRushShare: 0.28, explosiveRate: 0.12 },
    { player_id: 'lamar-jackson', designedRunRate: 0.18, scrambleYdsG: 32.1, rzRushShare: 0.35, explosiveRate: 0.15 },
    { player_id: 'kyler-murray', designedRunRate: 0.12, scrambleYdsG: 28.7, rzRushShare: 0.22, explosiveRate: 0.10 },
    { player_id: 'jalen-hurts', designedRunRate: 0.14, scrambleYdsG: 22.8, rzRushShare: 0.31, explosiveRate: 0.11 },
    { player_id: 'anthony-richardson', designedRunRate: 0.16, scrambleYdsG: 31.2, rzRushShare: 0.25, explosiveRate: 0.13 },
    
    // Rookie/Development QBs with rushing upside
    { player_id: 'drake-maye', designedRunRate: 0.13, scrambleYdsG: 26.5, rzRushShare: 0.20, explosiveRate: 0.09 },
    { player_id: 'jj-mccarthy', designedRunRate: 0.11, scrambleYdsG: 24.1, rzRushShare: 0.18, explosiveRate: 0.08 },
    { player_id: 'caleb-williams', designedRunRate: 0.09, scrambleYdsG: 21.3, rzRushShare: 0.15, explosiveRate: 0.07 },
    
    // Pocket passers (low rushing metrics)
    { player_id: 'joe-burrow', designedRunRate: 0.03, scrambleYdsG: 8.2, rzRushShare: 0.05, explosiveRate: 0.02 },
    { player_id: 'dak-prescott', designedRunRate: 0.04, scrambleYdsG: 12.1, rzRushShare: 0.08, explosiveRate: 0.03 },
    { player_id: 'kirk-cousins', designedRunRate: 0.02, scrambleYdsG: 5.8, rzRushShare: 0.03, explosiveRate: 0.01 }
  ];
}

/**
 * Mock data for RB usage traits
 */
function getMockRBUsageTraits(): RBUsageTraits[] {
  return [
    { player_id: 'christian-mccaffrey', inside10Share: 0.45, snapShare: 0.85, targetShare: 0.18, goalLineCarries: 8 },
    { player_id: 'saquon-barkley', inside10Share: 0.38, snapShare: 0.72, targetShare: 0.12, goalLineCarries: 6 },
    { player_id: 'derrick-henry', inside10Share: 0.52, snapShare: 0.68, targetShare: 0.04, goalLineCarries: 12 }
  ];
}

/**
 * Mock data for WR target traits
 */
function getMockWRTargetTraits(): WRTargetTraits[] {
  return [
    { player_id: 'cooper-kupp', targetsPerRoute: 0.28, airYardsShare: 0.22, slotRate: 0.75, redZoneTargets: 15 },
    { player_id: 'tyreek-hill', targetsPerRoute: 0.25, airYardsShare: 0.35, slotRate: 0.35, redZoneTargets: 12 },
    { player_id: 'davante-adams', targetsPerRoute: 0.32, airYardsShare: 0.28, slotRate: 0.45, redZoneTargets: 18 }
  ];
}

/**
 * Mock data for TE usage traits
 */
function getMockTEUsageTraits(): TEUsageTraits[] {
  return [
    { player_id: 'travis-kelce', routeParticipation: 0.82, blockingRate: 0.15, redZoneTargets: 14, snapShare: 0.88 },
    { player_id: 'mark-andrews', routeParticipation: 0.78, blockingRate: 0.22, redZoneTargets: 12, snapShare: 0.85 },
    { player_id: 'george-kittle', routeParticipation: 0.75, blockingRate: 0.28, redZoneTargets: 10, snapShare: 0.92 }
  ];
}

/**
 * Fetch season-long stats for context
 * @param season NFL season
 * @param player_id Specific player (optional)
 * @returns Season statistics
 */
export async function fetchSeasonStats(season: number, player_id?: string): Promise<any> {
  try {
    const endpoint = player_id 
      ? `/api/sleeper/season/${season}/player/${player_id}`
      : `/api/sleeper/season/${season}/stats`;
      
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      throw new Error(`Sleeper season stats failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch Sleeper season stats:`, error);
    return {};
  }
}