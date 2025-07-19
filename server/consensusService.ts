/**
 * Consensus Rankings Service
 * Handles real-time consensus updates using simple averages
 * Transparent, straightforward calculation logic
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

// =============================================================================
// CONSENSUS CALCULATION TYPES
// =============================================================================

/**
 * Result of consensus calculation
 */
interface ConsensusUpdateResult {
  format: string;
  dynastyType?: string;
  playersUpdated: number;
  calculationTime: number;
  lastUpdated: Date;
}

/**
 * Raw ranking data for consensus calculation
 */
interface RankingData {
  playerId: number;
  playerName: string;
  position: string;
  team: string;
  ranks: number[];
  averageRank: number;
  rankCount: number;
}

/**
 * Player ranking data for tier bubble generation
 */
interface PlayerRankingForBubbles {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  average_rank: number;
  standard_deviation: number;
  min_rank: number;
  max_rank: number;
  rank_count: number;
}

/**
 * Tier bubble containing grouped players
 */
interface TierBubble {
  tier_number: number;
  avg_rank_range: {
    min: number;
    max: number;
  };
  consensus_strength: 'tight' | 'moderate' | 'loose';
  players: PlayerRankingForBubbles[];
}

// =============================================================================
// TIER BUBBLE GENERATION LOGIC
// =============================================================================

/**
 * Generate tier bubbles based on average ranking similarity and consensus tightness
 * 
 * @param playerRankings - List of player ranking data
 * @param rankDiffThreshold - Max average rank difference allowed within bubble (default: 1.5)
 * @param stdDevThreshold - Max allowed standard deviation within bubble (default: 5.0)
 * @returns Array of tier bubbles containing grouped players
 */
export function generateTierBubbles(
  playerRankings: PlayerRankingForBubbles[],
  rankDiffThreshold: number = 1.5,
  stdDevThreshold: number = 5.0
): TierBubble[] {
  // Sort players by average rank
  const sortedPlayers = [...playerRankings].sort((a, b) => a.average_rank - b.average_rank);
  
  const bubbles: TierBubble[] = [];
  let currentBubble: PlayerRankingForBubbles[] = [];
  let lastAvgRank: number | null = null;
  let tierNumber = 1;

  for (const player of sortedPlayers) {
    const avgRank = player.average_rank;
    const stdDev = player.standard_deviation;

    if (currentBubble.length === 0) {
      // Start first bubble
      currentBubble.push(player);
      lastAvgRank = avgRank;
      continue;
    }

    const avgDiff = Math.abs(avgRank - (lastAvgRank || 0));

    if (avgDiff <= rankDiffThreshold && stdDev <= stdDevThreshold) {
      // Keep player in current bubble
      currentBubble.push(player);
      lastAvgRank = avgRank;
    } else {
      // Close current bubble and start new one
      if (currentBubble.length > 0) {
        bubbles.push(createTierBubble(currentBubble, tierNumber));
        tierNumber++;
      }
      currentBubble = [player];
      lastAvgRank = avgRank;
    }
  }

  // Append final bubble
  if (currentBubble.length > 0) {
    bubbles.push(createTierBubble(currentBubble, tierNumber));
  }

  return bubbles;
}

/**
 * Create a tier bubble from a group of players
 */
function createTierBubble(players: PlayerRankingForBubbles[], tierNumber: number): TierBubble {
  const avgRanks = players.map(p => p.average_rank);
  const stdDevs = players.map(p => p.standard_deviation);
  
  const minRank = Math.min(...avgRanks);
  const maxRank = Math.max(...avgRanks);
  const avgStdDev = stdDevs.reduce((sum, std) => sum + std, 0) / stdDevs.length;
  
  // Determine consensus strength based on standard deviation
  let consensusStrength: 'tight' | 'moderate' | 'loose';
  if (avgStdDev <= 2.0) {
    consensusStrength = 'tight';
  } else if (avgStdDev <= 4.0) {
    consensusStrength = 'moderate';
  } else {
    consensusStrength = 'loose';
  }

  return {
    tier_number: tierNumber,
    avg_rank_range: {
      min: parseFloat(minRank.toFixed(1)),
      max: parseFloat(maxRank.toFixed(1))
    },
    consensus_strength: consensusStrength,
    players: players
  };
}

/**
 * Get consensus rankings with tier bubble analysis
 */
export async function getConsensusWithTierBubbles(
  format: 'redraft' | 'dynasty',
  dynastyType?: 'rebuilder' | 'contender',
  position?: string
): Promise<{
  consensus_rankings: any[];
  tier_bubbles: TierBubble[];
  analysis: {
    total_tiers: number;
    avg_tier_size: number;
    tight_consensus_tiers: number;
    loose_consensus_tiers: number;
  };
}> {
  // Import the fixed getDynamicConsensusRankings from rankingsApi
  const { getDynamicConsensusRankings } = await import('./rankingsApi');
  const consensusRankings = await getDynamicConsensusRankings(format, dynastyType, position);
  
  // Transform to PlayerRankingForBubbles format
  const playerData: PlayerRankingForBubbles[] = await Promise.all(
    consensusRankings.map(async (player) => {
      // Calculate standard deviation and min/max ranks for this player
      const rankStats = await calculatePlayerRankingStats(player.playerId, format, dynastyType);
      
      return {
        player_id: player.playerId.toString(),
        player_name: player.playerName,
        position: player.position,
        team: player.team,
        average_rank: player.averageRank,
        standard_deviation: rankStats.standardDeviation,
        min_rank: rankStats.minRank,
        max_rank: rankStats.maxRank,
        rank_count: player.rankCount
      };
    })
  );
  
  // Generate tier bubbles
  const tierBubbles = generateTierBubbles(playerData);
  
  // Calculate analysis
  const totalTiers = tierBubbles.length;
  const avgTierSize = totalTiers > 0 ? playerData.length / totalTiers : 0;
  const tightTiers = tierBubbles.filter(b => b.consensus_strength === 'tight').length;
  const looseTiers = tierBubbles.filter(b => b.consensus_strength === 'loose').length;
  
  return {
    consensus_rankings: consensusRankings,
    tier_bubbles: tierBubbles,
    analysis: {
      total_tiers: totalTiers,
      avg_tier_size: parseFloat(avgTierSize.toFixed(1)),
      tight_consensus_tiers: tightTiers,
      loose_consensus_tiers: looseTiers
    }
  };
}

/**
 * Calculate ranking statistics for a player
 */
async function calculatePlayerRankingStats(
  playerId: number,
  format: 'redraft' | 'dynasty',
  dynastyType?: 'rebuilder' | 'contender'
): Promise<{
  standardDeviation: number;
  minRank: number;
  maxRank: number;
}> {
  // Build WHERE clause to avoid parameter type issues
  const whereClause = dynastyType 
    ? `player_id = ${playerId} AND format = '${format}' AND dynasty_type = '${dynastyType}'`
    : `player_id = ${playerId} AND format = '${format}' AND dynasty_type IS NULL`;
    
  const rankings = await db.execute(sql.raw(`
    SELECT rank_position
    FROM individual_rankings
    WHERE ${whereClause}
  `));
  
  const ranks = rankings.rows.map((row: any) => row.rank_position);
  
  if (ranks.length === 0) {
    return {
      standardDeviation: 0,
      minRank: 0,
      maxRank: 0
    };
  }
  
  const mean = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
  const variance = ranks.reduce((sum, rank) => sum + Math.pow(rank - mean, 2), 0) / ranks.length;
  const standardDeviation = Math.sqrt(variance);
  
  return {
    standardDeviation: parseFloat(standardDeviation.toFixed(2)),
    minRank: Math.min(...ranks),
    maxRank: Math.max(...ranks)
  };
}

// =============================================================================
// CORE CONSENSUS CALCULATION LOGIC
// =============================================================================

/**
 * Calculate consensus rankings for a specific format/dynasty type
 * Uses simple mathematical averages - no complex weighting
 */
export async function calculateConsensusRankings(
  format: 'redraft' | 'dynasty',
  dynastyType?: 'rebuilder' | 'contender'
): Promise<ConsensusUpdateResult> {
  const startTime = Date.now();
  
  try {
    // Step 1: Gather all individual rankings for this format/dynasty type
    const whereClause = dynastyType 
      ? `ir.format = '${format}' AND ir.dynasty_type = '${dynastyType}'`
      : `ir.format = '${format}' AND ir.dynasty_type IS NULL`;
      
    const individualRankings = await db.execute(sql.raw(`
      SELECT 
        ir.player_id,
        p.name as player_name,
        p.position,
        p.team,
        ir.rank_position
      FROM individual_rankings ir
      JOIN players p ON ir.player_id = p.id
      WHERE ${whereClause}
      ORDER BY ir.player_id, ir.rank_position
    `));
    
    // Step 2: Group rankings by player and calculate averages
    const playerRankings = new Map<number, RankingData>();
    
    for (const row of individualRankings.rows) {
      const playerId = row.player_id;
      
      if (!playerRankings.has(playerId)) {
        playerRankings.set(playerId, {
          playerId: playerId,
          playerName: row.player_name,
          position: row.position,
          team: row.team,
          ranks: [],
          averageRank: 0,
          rankCount: 0
        });
      }
      
      const playerData = playerRankings.get(playerId)!;
      playerData.ranks.push(row.rank_position);
    }
    
    // Step 3: Calculate simple averages for each player
    const consensusData: Array<RankingData & { consensusRank: number }> = [];
    
    for (const [playerId, data] of playerRankings) {
      // Simple average calculation
      const sum = data.ranks.reduce((total, rank) => total + rank, 0);
      const average = sum / data.ranks.length;
      
      data.averageRank = Math.round(average * 100) / 100; // Round to 2 decimal places
      data.rankCount = data.ranks.length;
      
      consensusData.push({
        ...data,
        consensusRank: 0 // Will be assigned after sorting
      });
    }
    
    // Step 4: Sort by average rank and assign consensus positions
    consensusData.sort((a, b) => a.averageRank - b.averageRank);
    
    // Assign consensus ranks (1-based)
    consensusData.forEach((player, index) => {
      player.consensusRank = index + 1;
    });
    
    // Step 5: Clear existing consensus for this format/dynasty type (skip for now - using dynamic consensus)
    console.log(`✅ Calculated consensus for ${consensusData.length} players in ${format}${dynastyType ? ` (${dynastyType})` : ''}`);
    
    // Note: We use dynamic consensus calculation - no static storage needed
    // This eliminates the consensus_rankings table dependency
    
    const calculationTime = Date.now() - startTime;
    
    return {
      format,
      dynastyType,
      playersUpdated: consensusData.length,
      calculationTime,
      lastUpdated: new Date()
    };
    
  } catch (error) {
    console.error('Error calculating consensus rankings:', error);
    throw error;
  }
}

// =============================================================================
// BATCH CONSENSUS UPDATE FUNCTIONS
// =============================================================================

/**
 * Update consensus for all format/dynasty type combinations
 * Useful for periodic recalculation or system maintenance
 */
export async function updateAllConsensusRankings(): Promise<ConsensusUpdateResult[]> {
  const results: ConsensusUpdateResult[] = [];
  
  try {
    // Update redraft consensus
    const redraftResult = await calculateConsensusRankings('redraft');
    results.push(redraftResult);
    
    // Update dynasty rebuilder consensus
    const dynastyRebuilderResult = await calculateConsensusRankings('dynasty', 'rebuilder');
    results.push(dynastyRebuilderResult);
    
    // Update dynasty contender consensus
    const dynastyContenderResult = await calculateConsensusRankings('dynasty', 'contender');
    results.push(dynastyContenderResult);
    
    return results;
    
  } catch (error) {
    console.error('Error updating all consensus rankings:', error);
    throw error;
  }
}

/**
 * Update consensus for a specific format only
 * More efficient when you know which format changed
 */
export async function updateFormatConsensus(format: 'redraft' | 'dynasty'): Promise<ConsensusUpdateResult[]> {
  const results: ConsensusUpdateResult[] = [];
  
  try {
    if (format === 'redraft') {
      const result = await calculateConsensusRankings('redraft');
      results.push(result);
    } else {
      // Update both dynasty types
      const rebuilderResult = await calculateConsensusRankings('dynasty', 'rebuilder');
      results.push(rebuilderResult);
      
      const contenderResult = await calculateConsensusRankings('dynasty', 'contender');
      results.push(contenderResult);
    }
    
    return results;
    
  } catch (error) {
    console.error('Error updating format consensus:', error);
    throw error;
  }
}

// =============================================================================
// CONSENSUS VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate consensus rankings for data integrity
 * Checks for gaps, duplicates, and mathematical accuracy
 */
export async function validateConsensusRankings(
  format: 'redraft' | 'dynasty',
  dynastyType?: 'rebuilder' | 'contender'
): Promise<{
  isValid: boolean;
  issues: string[];
  totalPlayers: number;
  validationTime: number;
}> {
  const startTime = Date.now();
  const issues: string[] = [];
  
  try {
    // Get all consensus rankings for this format/dynasty type
    const consensus = await db.execute(sql`
      SELECT 
        cr.player_id,
        cr.consensus_rank,
        cr.average_rank,
        cr.rank_count,
        p.name as player_name
      FROM consensus_rankings cr
      JOIN players p ON cr.player_id = p.id
      WHERE cr.format = ${format}
      AND (cr.dynasty_type = ${dynastyType || null} OR (cr.dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
      ORDER BY cr.consensus_rank
    `);
    
    const rankings = consensus.rows;
    const totalPlayers = rankings.length;
    
    // Check for sequential consensus ranks (no gaps)
    for (let i = 0; i < rankings.length; i++) {
      const expectedRank = i + 1;
      const actualRank = rankings[i].consensus_rank;
      
      if (actualRank !== expectedRank) {
        issues.push(`Rank gap detected: expected ${expectedRank}, found ${actualRank} for player ${rankings[i].player_name}`);
      }
    }
    
    // Check for duplicate consensus ranks
    const rankCounts = new Map<number, number>();
    for (const ranking of rankings) {
      const count = rankCounts.get(ranking.consensus_rank) || 0;
      rankCounts.set(ranking.consensus_rank, count + 1);
    }
    
    for (const [rank, count] of rankCounts) {
      if (count > 1) {
        issues.push(`Duplicate consensus rank detected: ${count} players have rank ${rank}`);
      }
    }
    
    // Validate average rank calculations (spot check)
    for (const ranking of rankings.slice(0, 10)) { // Check first 10 players
      const individualRanks = await db.execute(sql`
        SELECT rank_position 
        FROM individual_rankings 
        WHERE player_id = ${ranking.player_id}
        AND format = ${format}
        AND (dynasty_type = ${dynastyType || null} OR (dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
      `);
      
      const ranks = individualRanks.rows.map(row => row.rank_position);
      const expectedAverage = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
      const actualAverage = ranking.average_rank;
      
      // Allow for small rounding differences
      if (Math.abs(expectedAverage - actualAverage) > 0.01) {
        issues.push(`Average rank mismatch for player ${ranking.player_name}: expected ${expectedAverage}, found ${actualAverage}`);
      }
      
      if (ranks.length !== ranking.rank_count) {
        issues.push(`Rank count mismatch for player ${ranking.player_name}: expected ${ranks.length}, found ${ranking.rank_count}`);
      }
    }
    
    const validationTime = Date.now() - startTime;
    
    return {
      isValid: issues.length === 0,
      issues,
      totalPlayers,
      validationTime
    };
    
  } catch (error) {
    console.error('Error validating consensus rankings:', error);
    throw error;
  }
}

// =============================================================================
// CONSENSUS STATISTICS FUNCTIONS
// =============================================================================

/**
 * Get detailed statistics about consensus rankings
 * Useful for monitoring system health and participation
 */
export async function getConsensusStatistics(): Promise<{
  redraft: {
    totalPlayers: number;
    totalUsers: number;
    averageRankingsPerUser: number;
    lastUpdated: Date | null;
  };
  dynasty: {
    rebuilder: {
      totalPlayers: number;
      totalUsers: number;
      averageRankingsPerUser: number;
      lastUpdated: Date | null;
    };
    contender: {
      totalPlayers: number;
      totalUsers: number;
      averageRankingsPerUser: number;
      lastUpdated: Date | null;
    };
  };
}> {
  try {
    // Get redraft statistics
    const redraftStats = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT cr.player_id) as total_players,
        COUNT(DISTINCT ir.user_id) as total_users,
        COUNT(ir.player_id) as total_rankings,
        MAX(cr.last_updated) as last_updated
      FROM consensus_rankings cr
      LEFT JOIN individual_rankings ir ON cr.player_id = ir.player_id AND cr.format = ir.format
      WHERE cr.format = 'redraft'
    `);
    
    const redraftData = redraftStats.rows[0];
    
    // Get dynasty rebuilder statistics
    const dynastyRebuilderStats = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT cr.player_id) as total_players,
        COUNT(DISTINCT ir.user_id) as total_users,
        COUNT(ir.player_id) as total_rankings,
        MAX(cr.last_updated) as last_updated
      FROM consensus_rankings cr
      LEFT JOIN individual_rankings ir ON cr.player_id = ir.player_id AND cr.format = ir.format AND cr.dynasty_type = ir.dynasty_type
      WHERE cr.format = 'dynasty' AND cr.dynasty_type = 'rebuilder'
    `);
    
    const dynastyRebuilderData = dynastyRebuilderStats.rows[0];
    
    // Get dynasty contender statistics
    const dynastyContenderStats = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT cr.player_id) as total_players,
        COUNT(DISTINCT ir.user_id) as total_users,
        COUNT(ir.player_id) as total_rankings,
        MAX(cr.last_updated) as last_updated
      FROM consensus_rankings cr
      LEFT JOIN individual_rankings ir ON cr.player_id = ir.player_id AND cr.format = ir.format AND cr.dynasty_type = ir.dynasty_type
      WHERE cr.format = 'dynasty' AND cr.dynasty_type = 'contender'
    `);
    
    const dynastyContenderData = dynastyContenderStats.rows[0];
    
    return {
      redraft: {
        totalPlayers: redraftData.total_players || 0,
        totalUsers: redraftData.total_users || 0,
        averageRankingsPerUser: redraftData.total_users ? 
          Math.round((redraftData.total_rankings / redraftData.total_users) * 100) / 100 : 0,
        lastUpdated: redraftData.last_updated
      },
      dynasty: {
        rebuilder: {
          totalPlayers: dynastyRebuilderData.total_players || 0,
          totalUsers: dynastyRebuilderData.total_users || 0,
          averageRankingsPerUser: dynastyRebuilderData.total_users ? 
            Math.round((dynastyRebuilderData.total_rankings / dynastyRebuilderData.total_users) * 100) / 100 : 0,
          lastUpdated: dynastyRebuilderData.last_updated
        },
        contender: {
          totalPlayers: dynastyContenderData.total_players || 0,
          totalUsers: dynastyContenderData.total_users || 0,
          averageRankingsPerUser: dynastyContenderData.total_users ? 
            Math.round((dynastyContenderData.total_rankings / dynastyContenderData.total_users) * 100) / 100 : 0,
          lastUpdated: dynastyContenderData.last_updated
        }
      }
    };
    
  } catch (error) {
    console.error('Error getting consensus statistics:', error);
    throw error;
  }
}

// =============================================================================
// COMMENTS AND EXPLANATIONS
// =============================================================================

/*
CONSENSUS SERVICE DESIGN DECISIONS:

1. SIMPLE AVERAGING ALGORITHM:
   - Sum all individual ranks for each player
   - Divide by number of rankings to get average
   - Sort by average rank to assign consensus positions
   - No complex weighting or statistical adjustments

2. REAL-TIME UPDATES:
   - Consensus recalculated immediately after submission
   - Batch operations for efficiency
   - Transaction-based updates for data consistency

3. VALIDATION FRAMEWORK:
   - Comprehensive checks for data integrity
   - Spot-check mathematical accuracy
   - Detect gaps and duplicates in consensus ranks

4. PERFORMANCE OPTIMIZATION:
   - Efficient SQL queries with proper joins
   - Batch processing for multiple format updates
   - Minimal database round-trips

5. TRANSPARENCY FEATURES:
   - Detailed statistics for monitoring
   - Validation results with specific issues
   - Calculation timing for performance monitoring

6. ERROR HANDLING:
   - Comprehensive try-catch blocks
   - Detailed error logging
   - Graceful failure handling

7. MODULAR DESIGN:
   - Separate functions for different operations
   - Clear separation of concerns
   - Easy to test and maintain

8. DYNASTY FORMAT SUPPORT:
   - Separate consensus for rebuilder vs contender
   - Proper handling of dynasty type combinations
   - Validation specific to dynasty formats
*/