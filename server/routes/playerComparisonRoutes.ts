/**
 * Player Comparison API Routes
 */

import { Router } from 'express';
import { comparePlayers } from '../services/playerComparisonService';
import { db } from '../infra/db';
import { playerIdentityMap } from '../../shared/schema';
import { sql, or, ilike } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/player-comparison/compare
 * Compare two players for a specific week
 * 
 * Body: {
 *   player1: string (player ID or name),
 *   player2: string (player ID or name),
 *   week: number,
 *   season?: number
 * }
 */
router.post('/compare', async (req, res) => {
  try {
    const { player1, player2, week, season = 2025 } = req.body;
    
    if (!player1 || !player2 || !week) {
      return res.status(400).json({ 
        error: 'player1, player2, and week are required' 
      });
    }
    
    // Resolve player names to IDs if needed
    const player1Id = await resolvePlayerToId(player1);
    const player2Id = await resolvePlayerToId(player2);
    
    if (!player1Id || !player2Id) {
      return res.status(404).json({ 
        error: 'Could not find one or both players' 
      });
    }
    
    const comparison = await comparePlayers(player1Id, player2Id, week, season);
    
    if (!comparison) {
      return res.status(404).json({ 
        error: 'No comparison data available for these players' 
      });
    }
    
    res.json(comparison);
  } catch (error) {
    console.error('Error in player comparison:', error);
    res.status(500).json({ 
      error: 'Failed to compare players' 
    });
  }
});

/**
 * GET /api/player-comparison/search?q=player name
 * Search for players by name
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }
    
    const players = await db
      .select({
        id: playerIdentityMap.canonicalId,
        name: playerIdentityMap.fullName,
        team: playerIdentityMap.nflTeam,
        position: playerIdentityMap.position,
      })
      .from(playerIdentityMap)
      .where(
        or(
          ilike(playerIdentityMap.fullName, `%${query}%`),
          ilike(playerIdentityMap.lastName, `%${query}%`)
        )
      )
      .limit(10);
    
    res.json(players);
  } catch (error) {
    console.error('Error searching players:', error);
    res.status(500).json({ 
      error: 'Failed to search players' 
    });
  }
});

/**
 * Helper: Resolve player name or ID to canonical ID
 */
async function resolvePlayerToId(playerInput: string): Promise<string | null> {
  // If it looks like an ID, return it
  if (playerInput.length > 15 || playerInput.includes('-')) {
    return playerInput;
  }
  
  // Otherwise search by name
  const players = await db
    .select({ id: playerIdentityMap.canonicalId })
    .from(playerIdentityMap)
    .where(ilike(playerIdentityMap.fullName, `%${playerInput}%`))
    .limit(1);
  
  return players.length > 0 ? players[0].id : null;
}

export default router;
