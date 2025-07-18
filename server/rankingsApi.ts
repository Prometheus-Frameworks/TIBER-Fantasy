/**
 * Rankings API Backend
 * Simple, transparent API endpoints for fantasy football rankings system
 * Used by "On The Clock" website
 */

import { Request, Response } from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Individual ranking submission from a user
 * Contains player rankings for a specific format (redraft/dynasty)
 */
interface RankingSubmission {
  userId: number;
  format: 'redraft' | 'dynasty';
  dynastyType?: 'rebuilder' | 'contender'; // Only for dynasty format
  rankings: {
    playerId: number;
    rankPosition: number;
    notes?: string;
  }[];
}

/**
 * Dynamic consensus ranking result
 * Calculated in real-time from individual rankings
 */
interface ConsensusRanking {
  playerId: number;
  playerName: string;
  position: string;
  team: string;
  averageRank: number;
  rankCount: number;
  consensusRank: number;
  format: string;
  dynastyType?: string;
}

/**
 * Individual user ranking result
 * Personal rankings submitted by a specific user
 */
interface IndividualRanking {
  playerId: number;
  playerName: string;
  position: string;
  team: string;
  rankPosition: number;
  notes?: string;
  format: string;
  dynastyType?: string;
  submittedAt: Date;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate ranking submission data
 * Ensures all required fields are present and valid
 */
function validateRankingSubmission(data: any): string | null {
  if (!data.userId || typeof data.userId !== 'number') {
    return 'userId is required and must be a number';
  }
  
  if (!data.format || !['redraft', 'dynasty'].includes(data.format)) {
    return 'format must be either "redraft" or "dynasty"';
  }
  
  // Dynasty format requires dynastyType
  if (data.format === 'dynasty') {
    if (!data.dynastyType || !['rebuilder', 'contender'].includes(data.dynastyType)) {
      return 'dynastyType must be either "rebuilder" or "contender" for dynasty format';
    }
  }
  
  // Redraft format should not have dynastyType
  if (data.format === 'redraft' && data.dynastyType) {
    return 'dynastyType should not be provided for redraft format';
  }
  
  if (!Array.isArray(data.rankings) || data.rankings.length === 0) {
    return 'rankings must be a non-empty array';
  }
  
  // Validate each ranking entry
  for (const ranking of data.rankings) {
    if (!ranking.playerId || typeof ranking.playerId !== 'number') {
      return 'Each ranking must have a valid playerId';
    }
    
    if (!ranking.rankPosition || typeof ranking.rankPosition !== 'number' || ranking.rankPosition < 1) {
      return 'Each ranking must have a valid rankPosition (positive number)';
    }
  }
  
  return null; // Valid
}

// =============================================================================
// RANKINGS BUILDER API SUPPORT LAYER
// =============================================================================

/**
 * Get all available players for rankings construction
 * Returns complete player list for Rankings Builder interface
 */
async function getAllPlayersForRankings(): Promise<any[]> {
  try {
    const players = await db.execute(sql`
      SELECT 
        id as player_id,
        name,
        position,
        team
      FROM players
      WHERE position IN ('QB', 'RB', 'WR', 'TE')
      ORDER BY position, name
    `);
    
    return players.rows.map((row: any) => ({
      player_id: row.player_id,
      name: row.name,
      position: row.position,
      team: row.team
    }));
  } catch (error) {
    console.error('Error getting player list:', error);
    throw error;
  }
}

// =============================================================================
// DYNAMIC CONSENSUS CALCULATION LOGIC
// =============================================================================

/**
 * Get dynamic consensus rankings calculated in real-time
 * Uses simple averages of all individual rankings without storing static data
 */
async function getDynamicConsensusRankings(format: string, dynastyType?: string): Promise<ConsensusRanking[]> {
  try {
    // Use the dynamic consensus view to calculate rankings in real-time
    const rankings = await db.execute(sql`
      SELECT 
        player_id,
        player_name,
        position,
        team,
        average_rank,
        rank_count,
        consensus_rank,
        format,
        dynasty_type
      FROM dynamic_consensus_rankings
      WHERE format = ${format}
      AND (dynasty_type = ${dynastyType || null} OR (dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
      ORDER BY consensus_rank ASC
    `);
    
    return rankings.rows.map((row: any) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      position: row.position,
      team: row.team,
      averageRank: parseFloat(row.average_rank),
      rankCount: row.rank_count,
      consensusRank: row.consensus_rank,
      format: row.format,
      dynastyType: row.dynasty_type
    }));
  } catch (error) {
    console.error('Error getting dynamic consensus rankings:', error);
    throw error;
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * GET /api/players/list
 * Get all available players for rankings construction
 * Returns complete player list for Rankings Builder interface
 */
export async function getPlayersList(req: Request, res: Response) {
  try {
    const players = await getAllPlayersForRankings();
    
    res.json({
      success: true,
      data: {
        players: players,
        totalPlayers: players.length
      }
    });
  } catch (error) {
    console.error('Error fetching players list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch players list'
    });
  }
}

/**
 * POST /api/rankings/submit
 * Submit personal rankings for a user
 * 
 * Body (FastAPI pattern):
 * {
 *   "user_id": 123,
 *   "mode": "redraft" | "dynasty",
 *   "dynasty_mode": "rebuilder" | "contender" (only for dynasty),
 *   "rankings": [
 *     {
 *       "player_id": 456,
 *       "rank": 1,
 *       "notes": "Top QB this season"
 *     }
 *   ]
 * }
 */
export async function submitRankings(req: Request, res: Response) {
  try {
    const requestData = req.body;
    
    // Convert FastAPI pattern to internal format
    const submissionData: RankingSubmission = {
      userId: requestData.user_id || requestData.userId,
      format: requestData.mode || requestData.format,
      dynastyType: requestData.dynasty_mode || requestData.dynastyType,
      rankings: requestData.rankings?.map((r: any) => ({
        playerId: r.player_id || r.playerId,
        rankPosition: r.rank || r.rankPosition,
        notes: r.notes
      })) || []
    };
    
    // Validate input data
    const validationError = validateRankingSubmission(submissionData);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }
    
    // Begin transaction to ensure data consistency
    await db.transaction(async (tx) => {
      // Delete existing rankings for this user/format/dynasty type
      await tx.execute(sql`
        DELETE FROM individual_rankings 
        WHERE user_id = ${submissionData.userId} 
        AND format = ${submissionData.format}
        AND (dynasty_type = ${submissionData.dynastyType || null} OR (dynasty_type IS NULL AND ${submissionData.dynastyType || null} IS NULL))
      `);
      
      // Insert new rankings
      for (const ranking of submissionData.rankings) {
        await tx.execute(sql`
          INSERT INTO individual_rankings (user_id, player_id, format, dynasty_type, rank_position, notes)
          VALUES (
            ${submissionData.userId},
            ${ranking.playerId},
            ${submissionData.format},
            ${submissionData.dynastyType || null},
            ${ranking.rankPosition},
            ${ranking.notes || null}
          )
        `);
      }
      
      // Log the submission
      await tx.execute(sql`
        INSERT INTO ranking_submissions (user_id, format, dynasty_type, submission_type, players_affected)
        VALUES (
          ${submissionData.userId},
          ${submissionData.format},
          ${submissionData.dynastyType || null},
          'full_ranking',
          ${submissionData.rankings.length}
        )
      `);
    });
    
    res.json({
      success: true,
      message: 'Rankings submitted successfully',
      data: {
        rankingsSubmitted: submissionData.rankings.length,
        message: 'Consensus will be calculated dynamically on next query'
      }
    });
    
  } catch (error) {
    console.error('Error submitting rankings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * GET /api/rankings/consensus
 * Retrieve consensus rankings for a format
 * 
 * Query parameters:
 * - format: "redraft" | "dynasty" (required)
 * - dynastyType: "rebuilder" | "contender" (required for dynasty format)
 * - limit: number (optional, default 200)
 * - offset: number (optional, default 0)
 */
export async function getConsensusRankings(req: Request, res: Response) {
  try {
    const { format, dynastyType, limit = '200', offset = '0' } = req.query;
    
    // Validate required parameters
    if (!format || !['redraft', 'dynasty'].includes(format as string)) {
      return res.status(400).json({
        success: false,
        error: 'format parameter is required and must be either "redraft" or "dynasty"'
      });
    }
    
    // Dynasty format requires dynastyType
    if (format === 'dynasty' && (!dynastyType || !['rebuilder', 'contender'].includes(dynastyType as string))) {
      return res.status(400).json({
        success: false,
        error: 'dynastyType parameter is required for dynasty format and must be either "rebuilder" or "contender"'
      });
    }
    
    // Get dynamic consensus rankings in real-time
    const consensusRankings = await getDynamicConsensusRankings(format as string, dynastyType as string);
    
    // Apply pagination
    const startIndex = parseInt(offset as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedRankings = consensusRankings.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        rankings: paginatedRankings,
        meta: {
          format: format,
          dynastyType: dynastyType,
          totalResults: consensusRankings.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          calculatedAt: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching consensus rankings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * GET /api/rankings/personal
 * Get personal rankings for the current user - Rankings Builder support
 * 
 * Query parameters:
 * - user_id: User ID (required)
 * - mode: "redraft" | "dynasty" (required)
 * - dynasty_mode: "rebuilder" | "contender" (required for dynasty format)
 */
export async function getPersonalRankings(req: Request, res: Response) {
  try {
    const { user_id, mode, dynasty_mode } = req.query;
    
    // Validate required parameters
    if (!user_id || isNaN(parseInt(user_id as string))) {
      return res.status(400).json({
        success: false,
        error: 'user_id parameter is required and must be a number'
      });
    }
    
    if (!mode || !['redraft', 'dynasty'].includes(mode as string)) {
      return res.status(400).json({
        success: false,
        error: 'mode parameter is required and must be either "redraft" or "dynasty"'
      });
    }
    
    // Dynasty format requires dynasty_mode
    if (mode === 'dynasty' && (!dynasty_mode || !['rebuilder', 'contender'].includes(dynasty_mode as string))) {
      return res.status(400).json({
        success: false,
        error: 'dynasty_mode parameter is required for dynasty format and must be either "rebuilder" or "contender"'
      });
    }
    
    // Fetch personal rankings with player details
    const rankings = await db.execute(sql`
      SELECT 
        ir.player_id,
        p.name as player_name,
        p.position,
        p.team,
        ir.rank_position as rank,
        ir.notes,
        ir.submitted_at
      FROM individual_rankings ir
      JOIN players p ON ir.player_id = p.id
      WHERE ir.user_id = ${parseInt(user_id as string)}
      AND ir.format = ${mode}
      AND (ir.dynasty_type = ${dynasty_mode || null} OR (ir.dynasty_type IS NULL AND ${dynasty_mode || null} IS NULL))
      ORDER BY ir.rank_position
    `);
    
    const personalRankings = rankings.rows.map((row: any) => ({
      player_id: row.player_id,
      name: row.player_name,
      position: row.position,
      team: row.team,
      rank: row.rank,
      notes: row.notes
    }));
    
    res.json({
      success: true,
      data: {
        rankings: personalRankings,
        meta: {
          user_id: parseInt(user_id as string),
          mode: mode,
          dynasty_mode: dynasty_mode,
          totalResults: personalRankings.length,
          lastUpdated: rankings.rows[0]?.submitted_at || null
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching personal rankings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch personal rankings'
    });
  }
}

/**
 * GET /api/rankings/individual/:userId
 * Retrieve individual rankings for a specific user
 * 
 * Query parameters:
 * - format: "redraft" | "dynasty" (required)
 * - dynastyType: "rebuilder" | "contender" (required for dynasty format)
 */
export async function getIndividualRankings(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { format, dynastyType } = req.query;
    
    // Validate required parameters
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({
        success: false,
        error: 'userId parameter is required and must be a number'
      });
    }
    
    if (!format || !['redraft', 'dynasty'].includes(format as string)) {
      return res.status(400).json({
        success: false,
        error: 'format parameter is required and must be either "redraft" or "dynasty"'
      });
    }
    
    // Dynasty format requires dynastyType
    if (format === 'dynasty' && (!dynastyType || !['rebuilder', 'contender'].includes(dynastyType as string))) {
      return res.status(400).json({
        success: false,
        error: 'dynastyType parameter is required for dynasty format and must be either "rebuilder" or "contender"'
      });
    }
    
    // Fetch individual rankings with player details
    const rankings = await db.execute(sql`
      SELECT 
        ir.player_id,
        p.name as player_name,
        p.position,
        p.team,
        ir.rank_position,
        ir.notes,
        ir.format,
        ir.dynasty_type,
        ir.submitted_at
      FROM individual_rankings ir
      JOIN players p ON ir.player_id = p.id
      WHERE ir.user_id = ${parseInt(userId)}
      AND ir.format = ${format}
      AND (ir.dynasty_type = ${dynastyType || null} OR (ir.dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
      ORDER BY ir.rank_position
    `);
    
    const individualRankings: IndividualRanking[] = rankings.rows.map((row: any) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      position: row.position,
      team: row.team,
      rankPosition: row.rank_position,
      notes: row.notes,
      format: row.format,
      dynastyType: row.dynasty_type,
      submittedAt: row.submitted_at
    }));
    
    res.json({
      success: true,
      data: {
        rankings: individualRankings,
        meta: {
          userId: parseInt(userId),
          format: format,
          dynastyType: dynastyType,
          totalResults: individualRankings.length
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching individual rankings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * GET /api/rankings/stats
 * Get ranking statistics and metadata
 * 
 * Query parameters:
 * - format: "redraft" | "dynasty" (required)
 * - dynastyType: "rebuilder" | "contender" (required for dynasty format)
 */
export async function getRankingStats(req: Request, res: Response) {
  try {
    const { format, dynastyType } = req.query;
    
    // Validate required parameters
    if (!format || !['redraft', 'dynasty'].includes(format as string)) {
      return res.status(400).json({
        success: false,
        error: 'format parameter is required and must be either "redraft" or "dynasty"'
      });
    }
    
    // Dynasty format requires dynastyType
    if (format === 'dynasty' && (!dynastyType || !['rebuilder', 'contender'].includes(dynastyType as string))) {
      return res.status(400).json({
        success: false,
        error: 'dynastyType parameter is required for dynasty format and must be either "rebuilder" or "contender"'
      });
    }
    
    // Get total number of users who have submitted rankings
    const userCount = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id) as total_users
      FROM individual_rankings
      WHERE format = ${format}
      AND (dynasty_type = ${dynastyType || null} OR (dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
    `);
    
    // Get total number of players ranked
    const playerCount = await db.execute(sql`
      SELECT COUNT(DISTINCT player_id) as total_players
      FROM individual_rankings
      WHERE format = ${format}
      AND (dynasty_type = ${dynastyType || null} OR (dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
    `);
    
    // Get last submission time
    const lastSubmission = await db.execute(sql`
      SELECT MAX(submitted_at) as last_submission
      FROM ranking_submissions
      WHERE format = ${format}
      AND (dynasty_type = ${dynastyType || null} OR (dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
    `);
    
    res.json({
      success: true,
      data: {
        totalUsers: userCount.rows[0]?.total_users || 0,
        totalPlayers: playerCount.rows[0]?.total_players || 0,
        lastSubmission: lastSubmission.rows[0]?.last_submission || null,
        format: format,
        dynastyType: dynastyType,
        consensusCalculation: 'real-time'
      }
    });
    
  } catch (error) {
    console.error('Error fetching ranking stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register all ranking API routes
 * Call this function to add routes to your Express app
 */
export function registerRankingRoutes(app: any) {
  // Rankings Builder API Support Layer
  app.get('/api/players/list', getPlayersList);
  app.get('/api/rankings/personal', getPersonalRankings);
  
  // Core Rankings API
  app.post('/api/rankings/submit', submitRankings);
  app.get('/api/rankings/consensus', getConsensusRankings);
  app.get('/api/rankings/individual/:userId', getIndividualRankings);
  app.get('/api/rankings/stats', getRankingStats);
}

// =============================================================================
// COMMENTS AND EXPLANATIONS
// =============================================================================

/*
API DESIGN DECISIONS EXPLAINED:

1. SIMPLE REST ENDPOINTS:
   - Clear, intuitive URL structure
   - Standard HTTP methods (GET, POST)
   - Consistent response format with success/error flags

2. TRANSPARENT CONSENSUS CALCULATION:
   - Simple averages using AVG() SQL function
   - No complex weighting or algorithms
   - Rankings recalculated immediately after submissions

3. VALIDATION STRATEGY:
   - Input validation for all endpoints
   - Clear error messages for invalid requests
   - Transaction-based operations for data consistency

4. DYNASTY FORMAT HANDLING:
   - Optional dynastyType parameter for dynasty format
   - Validation ensures proper format/dynastyType combinations
   - Separate consensus calculated for rebuilder vs contender

5. PERFORMANCE CONSIDERATIONS:
   - Limit/offset pagination for large result sets
   - Efficient SQL queries with proper joins
   - Batch operations using transactions

6. ERROR HANDLING:
   - Comprehensive try-catch blocks
   - Detailed error logging for debugging
   - User-friendly error messages

7. TRANSPARENCY FEATURES:
   - Statistics endpoint shows participation data
   - Audit trail via ranking_submissions table
   - Simple averaging algorithm clearly documented

8. EXTENSIBILITY:
   - TypeScript interfaces for type safety
   - Modular function structure
   - Easy to add new endpoints or features
*/