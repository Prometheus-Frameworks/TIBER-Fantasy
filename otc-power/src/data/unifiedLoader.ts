/**
 * Unified Data Loader
 * 
 * Phase B/C: Orchestrates all data sources and applies advanced analytics
 * Pulls from Sleeper, nflfastR, DeepSeek, OASIS, and FantasyPros to create comprehensive player facts
 */

import { formFPG, expectedFPG, beatProjection, qbUpsideIndex, rbUpsideIndex, wrUpsideIndex, teUpsideIndex, LEAGUE_RANGES } from './features';
import { scaleLeagueWeek, confidenceGating, ewma01 } from './math';
import { computeRAG, generateRAGReasons } from '../core/rag';
import { getAllPositionStats } from '../core/positionStats';

// Data source imports
import { fetchWeekPoints, fetchHistoricalFPG } from './sources/sleeper';
import { fetchXFP, fetchUsageScores, fetchTalentScores } from './sources/deepseek';
import { fetchQbRunTraits, fetchRbUsageTraits, fetchWrTargetTraits, fetchTeUsageTraits } from './sources/nflfastR';
import { fetchTeamEnvIndex, fetchTeamPace, fetchTeamPROE } from './sources/oasis';
import { fetchFPProjections, fetchECR, calculateMarketAnchor } from './sources/fantasypros';

export interface PlayerFactsUpdate {
  player_id: string;
  position: 'QB' | 'RB' | 'WR' | 'TE'; // Player position
  fpg: number;               // Raw fantasy points per game
  xfpg: number;              // Expected FPG from DeepSeek
  proj_fpg: number;          // External consensus projections
  beat_proj: number;         // 0-100: How much player beats projections
  upside_index: number;      // 0-100: Position-specific upside potential
  features: Record<string, any>; // Raw features for audit trail
  
  // RAG SCORING FIELDS
  expected_points: number;   // Weekly expected points (mu)
  floor_points: number;      // Weekly floor (mu - sigma)
  ceiling_points: number;    // Weekly ceiling (mu + sigma)
  rag_score: number;         // 0-100 RAG score with upside bias
  rag_color: 'GREEN' | 'AMBER' | 'RED'; // Color coding
  rag_reasons: string[];     // Reasoning array for UI
}

/**
 * Main unified loader function - orchestrates all data sources
 * @param season NFL season
 * @param week NFL week
 * @param positions Array of positions to process
 * @returns Array of player facts updates
 */
export async function loadUnifiedPlayerFacts(
  season: number,
  week: number,
  positions: string[] = ['QB', 'RB', 'WR', 'TE']
): Promise<PlayerFactsUpdate[]> {
  console.log(`🔄 Starting unified data load for ${season} Week ${week}...`);
  
  const playerFacts: PlayerFactsUpdate[] = [];
  
  try {
    // Phase 1: Fetch all raw data sources in parallel
    console.log('📥 Fetching raw data from all sources...');
    
    const [
      weeklyFPG,
      xfpData,
      usageScores,
      talentScores,
      qbRunTraits,
      rbUsageTraits,
      wrTargetTraits,
      teUsageTraits,
      teamEnvironment,
      teamPace,
      teamPROE,
      consensusProjections
    ] = await Promise.all([
      fetchWeekPoints(season, week),
      fetchXFP(season, week),
      fetchUsageScores(season, week),
      fetchTalentScores(season, week),
      fetchQbRunTraits(season, week),
      fetchRbUsageTraits(season, week),
      fetchWrTargetTraits(season, week),
      fetchTeUsageTraits(season, week),
      fetchTeamEnvIndex(season, week),
      fetchTeamPace(season, week),
      fetchTeamPROE(season, week),
      fetchAllPositionProjections(season, week)
    ]);
    
    console.log(`✅ Raw data fetched successfully`);
    
    // Phase 2: Process each position separately
    for (const pos of positions) {
      const positionFacts = await processPositionFacts(
        pos as 'QB' | 'RB' | 'WR' | 'TE',
        season,
        week,
        {
          weeklyFPG,
          xfpData,
          usageScores,
          talentScores,
          qbRunTraits,
          rbUsageTraits,
          wrTargetTraits,
          teUsageTraits,
          teamEnvironment,
          teamPace,
          teamPROE,
          consensusProjections: consensusProjections[pos] || {}
        }
      );
      
      playerFacts.push(...positionFacts);
    }
    
    console.log(`✅ Processed ${playerFacts.length} player facts updates`);
    
    // Phase 3: Apply RAG scoring after all feature building
    console.log('🎯 Computing RAG scores with position-relative calibration...');
    
    // Calculate position statistics for league-relative scoring
    const positionStats = await getAllPositionStats(season, week, playerFacts);
    
    // Apply RAG computation to each player
    const ragEnhancedFacts = playerFacts.map(facts => {
      const posStats = positionStats[facts.position] || positionStats['QB']; // Fallback
      
      // Get volatility factors (from features or defaults)
      const roleVolatility = facts.features.role_volatility || 0.3;
      const teamVolatility = facts.features.team_volatility || 0.2;
      const injuryRisk = facts.features.injury_risk || 0.1;
      const qbStabilityPenalty = facts.features.qb_stability_penalty || 0.0;
      
      // Get matchup and availability factors (using fallbacks for now)
      const oppMultiplier = 1.0; // TODO: Wire up SOS hook
      const availability = 0.95;  // TODO: Wire up practice trend
      
      const ragResult = computeRAG({
        pos: facts.position,
        xfpg_pts: facts.xfpg,
        proj_pts: facts.proj_fpg,
        form_pts: facts.fpg,
        oppMultiplier,
        availability,
        roleVolatility,
        teamVolatility,
        injuryRisk,
        qbStabilityPenalty,
        upsideIndex: facts.upside_index,
        beatProj0_100: facts.beat_proj,
        posMedianPts: posStats.median,
        posStdPts: posStats.std,
        posP40: posStats.p40
      });
      
      const ragReasons = generateRAGReasons({
        pos: facts.position,
        xfpg_pts: facts.xfpg,
        proj_pts: facts.proj_fpg,
        form_pts: facts.fpg,
        oppMultiplier,
        availability,
        roleVolatility,
        teamVolatility,
        injuryRisk,
        qbStabilityPenalty,
        upsideIndex: facts.upside_index,
        beatProj0_100: facts.beat_proj,
        posMedianPts: posStats.median,
        posStdPts: posStats.std,
        posP40: posStats.p40
      }, ragResult);
      
      return {
        ...facts,
        expected_points: ragResult.mu,
        floor_points: ragResult.floor,
        ceiling_points: ragResult.ceiling,
        rag_score: ragResult.score,
        rag_color: ragResult.color,
        rag_reasons: ragReasons
      };
    });
    
    console.log(`✅ Applied RAG scoring to ${ragEnhancedFacts.length} players`);
    return ragEnhancedFacts;
    
  } catch (error) {
    console.error('❌ Unified loader failed:', error);
    throw error;
  }
}

/**
 * Process facts for a specific position
 */
async function processPositionFacts(
  position: 'QB' | 'RB' | 'WR' | 'TE',
  season: number,
  week: number,
  data: {
    weeklyFPG: Record<string, number>;
    xfpData: Record<string, number>;
    usageScores: Record<string, number>;
    talentScores: Record<string, number>;
    qbRunTraits: any[];
    rbUsageTraits: any[];
    wrTargetTraits: any[];
    teUsageTraits: any[];
    teamEnvironment: Record<string, number>;
    teamPace: Record<string, number>;
    teamPROE: Record<string, number>;
    consensusProjections: Record<string, number>;
  }
): Promise<PlayerFactsUpdate[]> {
  
  const positionFacts: PlayerFactsUpdate[] = [];
  
  // Get all players for this position from current week data
  const playerIds = new Set([
    ...Object.keys(data.weeklyFPG),
    ...Object.keys(data.xfpData),
    ...Object.keys(data.consensusProjections)
  ]);
  
  for (const playerId of playerIds) {
    try {
      // Get historical FPG for EWMA smoothing
      const historicalFPG = await fetchHistoricalFPG(playerId, season, week, 3);
      
      // Apply EWMA smoothing to FPG
      const smoothedFPG = historicalFPG.length > 0 
        ? formFPG(historicalFPG, 0.5)
        : data.weeklyFPG[playerId] || 0;
      
      // Get xFPG from DeepSeek
      const xfpg = data.xfpData[playerId] || 0;
      
      // Get consensus projections
      const projFPG = data.consensusProjections[playerId] || 0;
      
      // Calculate beat projection score
      const beatProj = beatProjection(smoothedFPG, projFPG);
      
      // Calculate position-specific upside index
      const upsideIndex = await calculateUpsideIndex(
        position,
        playerId,
        data
      );
      
      // Build features object for audit trail
      const features = {
        raw_fpg: data.weeklyFPG[playerId] || 0,
        historical_fpg: historicalFPG,
        smoothed_fpg: smoothedFPG,
        usage_score: data.usageScores[playerId] || 0,
        talent_score: data.talentScores[playerId] || 0,
        position,
        week,
        season,
        confidence: confidenceGating(0.9, false, historicalFPG.length)
      };
      
      // Add position-specific features
      if (position === 'QB' && data.qbRunTraits) {
        const qbData = data.qbRunTraits.find(q => q.player_id === playerId);
        if (qbData) {
          (features as any).qb_metrics = qbData;
        }
      }
      
      const playerUpdate: PlayerFactsUpdate = {
        player_id: playerId,
        position: position,
        fpg: smoothedFPG,
        xfpg: xfpg,
        proj_fpg: projFPG,
        beat_proj: beatProj,
        upside_index: upsideIndex,
        features: features,
        // RAG fields - initialized with defaults, will be computed later
        expected_points: 0,
        floor_points: 0,
        ceiling_points: 0,
        rag_score: 50,
        rag_color: 'AMBER',
        rag_reasons: []
      };
      
      positionFacts.push(playerUpdate);
      
    } catch (error) {
      console.error(`❌ Failed to process ${playerId} (${position}):`, error);
      // Continue processing other players
    }
  }
  
  console.log(`✅ Processed ${positionFacts.length} ${position} players`);
  return positionFacts;
}

/**
 * Calculate position-specific upside index
 */
async function calculateUpsideIndex(
  position: 'QB' | 'RB' | 'WR' | 'TE',
  playerId: string,
  data: any
): Promise<number> {
  
  switch (position) {
    case 'QB': {
      const qbData = data.qbRunTraits?.find((q: any) => q.player_id === playerId);
      if (!qbData) return 50; // Neutral if no rushing data
      
      return qbUpsideIndex(qbData, LEAGUE_RANGES.QB);
    }
    
    case 'RB': {
      const rbData = data.rbUsageTraits?.find((r: any) => r.player_id === playerId);
      if (!rbData) return 50;
      
      return rbUpsideIndex(rbData, LEAGUE_RANGES.RB);
    }
    
    case 'WR': {
      const wrData = data.wrTargetTraits?.find((w: any) => w.player_id === playerId);
      if (!wrData) return 50;
      
      return wrUpsideIndex(wrData, LEAGUE_RANGES.WR);
    }
    
    case 'TE': {
      const teData = data.teUsageTraits?.find((t: any) => t.player_id === playerId);
      if (!teData) return 50;
      
      return teUpsideIndex(teData, LEAGUE_RANGES.TE);
    }
    
    default:
      return 50;
  }
}

/**
 * Fetch projections for all positions
 */
async function fetchAllPositionProjections(
  season: number,
  week: number
): Promise<Record<string, Record<string, number>>> {
  
  const [qbProj, rbProj, wrProj, teProj] = await Promise.all([
    fetchFPProjections(season, week, 'QB'),
    fetchFPProjections(season, week, 'RB'),
    fetchFPProjections(season, week, 'WR'),
    fetchFPProjections(season, week, 'TE')
  ]);
  
  return {
    'QB': qbProj,
    'RB': rbProj,
    'WR': wrProj,
    'TE': teProj
  };
}

/**
 * Update database with new player facts
 * @param playerFacts Array of player facts to update
 * @returns Success status and update count
 */
export async function updatePlayerFactsDB(playerFacts: PlayerFactsUpdate[]): Promise<{
  success: boolean;
  updated: number;
  errors: string[];
}> {
  
  const errors: string[] = [];
  let updated = 0;
  
  try {
    // Use existing database connection to update players table
    for (const facts of playerFacts) {
      try {
        const response = await fetch('/api/players/update-facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(facts)
        });
        
        if (response.ok) {
          updated++;
        } else {
          errors.push(`Failed to update ${facts.player_id}: ${response.status}`);
        }
        
      } catch (error) {
        errors.push(`Update error for ${facts.player_id}: ${error}`);
      }
    }
    
    console.log(`✅ Updated ${updated}/${playerFacts.length} player facts`);
    
    return {
      success: errors.length === 0,
      updated,
      errors
    };
    
  } catch (error) {
    console.error('❌ Database update failed:', error);
    return {
      success: false,
      updated,
      errors: [String(error)]
    };
  }
}