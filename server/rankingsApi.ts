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
 * Consensus ranking result
 * Calculated using simple averages of individual rankings
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
// CONSENSUS CALCULATION LOGIC
// =============================================================================

/**
 * Recalculate consensus rankings for a specific format/dynasty type
 * Uses simple averages of all individual rankings
 */
async function updateConsensusRankings(format: string, dynastyType?: string): Promise<number> {
  try {
    // First, delete existing consensus for this format/dynasty type
    await db.execute(sql`
      DELETE FROM consensus_rankings 
      WHERE format = ${format} 
      AND (dynasty_type = ${dynastyType || null} OR (dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
    `);
    
    // Calculate new consensus using simple averages
    const result = await db.execute(sql`
      INSERT INTO consensus_rankings (player_id, format, dynasty_type, average_rank, rank_count, consensus_rank)
      SELECT 
        ir.player_id,
        ir.format,
        ir.dynasty_type,
        AVG(ir.rank_position) as average_rank,
        COUNT(ir.rank_position) as rank_count,
        ROW_NUMBER() OVER (ORDER BY AVG(ir.rank_position)) as consensus_rank
      FROM individual_rankings ir
      WHERE ir.format = ${format}
      AND (ir.dynasty_type = ${dynastyType || null} OR (ir.dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
      GROUP BY ir.player_id, ir.format, ir.dynasty_type
    `);
    
    return result.rowCount || 0;
  } catch (error) {
    console.error('Error updating consensus rankings:', error);
    throw error;
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * POST /api/rankings/submit
 * Submit personal rankings for a user
 * 
 * Body:
 * {
 *   "userId": 123,
 *   "format": "redraft" | "dynasty",
 *   "dynastyType": "rebuilder" | "contender" (only for dynasty),
 *   "rankings": [
 *     {
 *       "playerId": 456,
 *       "rankPosition": 1,
 *       "notes": "Top QB this season"
 *     }
 *   ]
 * }
 */
export async function submitRankings(req: Request, res: Response) {
  try {
    const submissionData = req.body as RankingSubmission;
    
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
    
    // Update consensus rankings after successful submission
    const consensusUpdated = await updateConsensusRankings(submissionData.format, submissionData.dynastyType);
    
    res.json({
      success: true,
      message: 'Rankings submitted successfully',
      data: {
        rankingsSubmitted: submissionData.rankings.length,
        consensusUpdated: consensusUpdated
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
    
    // Fetch consensus rankings with player details
    const rankings = await db.execute(sql`
      SELECT 
        cr.player_id,
        p.name as player_name,
        p.position,
        p.team,
        cr.average_rank,
        cr.rank_count,
        cr.consensus_rank,
        cr.format,
        cr.dynasty_type,
        cr.last_updated
      FROM consensus_rankings cr
      JOIN players p ON cr.player_id = p.id
      WHERE cr.format = ${format}
      AND (cr.dynasty_type = ${dynastyType || null} OR (cr.dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
      ORDER BY cr.consensus_rank
      LIMIT ${parseInt(limit as string)}
      OFFSET ${parseInt(offset as string)}
    `);
    
    const consensusRankings: ConsensusRanking[] = rankings.rows.map((row: any) => ({
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
    
    res.json({
      success: true,
      data: {
        rankings: consensusRankings,
        meta: {
          format: format,
          dynastyType: dynastyType,
          totalResults: consensusRankings.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
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
      FROM consensus_rankings
      WHERE format = ${format}
      AND (dynasty_type = ${dynastyType || null} OR (dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
    `);
    
    // Get last update time
    const lastUpdate = await db.execute(sql`
      SELECT MAX(last_updated) as last_updated
      FROM consensus_rankings
      WHERE format = ${format}
      AND (dynasty_type = ${dynastyType || null} OR (dynasty_type IS NULL AND ${dynastyType || null} IS NULL))
    `);
    
    res.json({
      success: true,
      data: {
        totalUsers: userCount.rows[0]?.total_users || 0,
        totalPlayers: playerCount.rows[0]?.total_players || 0,
        lastUpdated: lastUpdate.rows[0]?.last_updated || null,
        format: format,
        dynastyType: dynastyType
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
  // Submit personal rankings
  app.post('/api/rankings/submit', submitRankings);
  
  // Get consensus rankings
  app.get('/api/rankings/consensus', getConsensusRankings);
  
  // Get individual user rankings
  app.get('/api/rankings/individual/:userId', getIndividualRankings);
  
  // Get ranking statistics
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