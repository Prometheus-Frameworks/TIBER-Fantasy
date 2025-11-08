/**
 * OVR (Overall Rating) API Routes - Madden-style 1-99 Player Ratings
 * FIXED: Now uses curated players table instead of all 11k+ Sleeper players
 * 
 * Provides unified player ratings that aggregate all ranking inputs:
 * - GET /api/ovr - Get OVR ratings (fantasy-relevant players only)
 * - GET /api/ovr/:playerId - Get single player OVR rating
 * - GET /api/ovr/health - Health check with player stats
 */

import { Router } from 'express';
import { db } from '../infra/db';
import { players } from '../../shared/schema';
import { eq, and, desc, sql, isNotNull } from 'drizzle-orm';

const router = Router();

interface PlayerWithOVR {
  id: number;
  name: string;
  position: string;
  team: string;
  sleeperId: string | null;
  age: number | null;
  ovr: number;
  avgPoints: number;
}

/**
 * GET /api/ovr
 * Returns top 150 fantasy-relevant players with OVR ratings
 * 
 * Filtering criteria:
 * - Active players only
 * - Skill positions (QB, RB, WR, TE)
 * - Must have an NFL team assignment
 * - Sorted by powerScore (existing rating)
 */
router.get('/', async (req, res) => {
  try {
    console.log('📊 Fetching fantasy-relevant player rankings...');

    // Query fantasy-relevant players from OUR database
    const fantasyPlayers = await db
      .select({
        id: players.id,
        name: players.name,
        position: players.position,
        team: players.team,
        sleeperId: players.sleeperId,
        age: players.age,
        active: players.active,
        avgPoints: players.avgPoints,
      })
      .from(players)
      .where(
        and(
          eq(players.active, true),                    // Active players only
          sql`${players.position} IN ('QB', 'RB', 'WR', 'TE')`, // Skill positions
          isNotNull(players.team),                     // Must have NFL team
          sql`${players.team} != ''`                   // Team not empty string
        )
      )
      .orderBy(desc(players.avgPoints))               // Sort by avg points
      .limit(150);                                     // Top 150 only

    console.log(`✅ Found ${fantasyPlayers.length} fantasy-relevant players`);

    // Calculate OVR for each player and format response
    const playersWithOVR = fantasyPlayers.map((player) => {
      // Use existing avgPoints as base, or calculate simple OVR
      const ovr = player.avgPoints || calculateSimpleOVR(player);
      const ovrRounded = Math.round(ovr);
      
      // Calculate tier based on OVR
      let tier = 'C';
      if (ovrRounded >= 90) tier = 'Elite';
      else if (ovrRounded >= 80) tier = 'Great';
      else if (ovrRounded >= 70) tier = 'Good';
      else if (ovrRounded >= 60) tier = 'B';
      
      // Calculate confidence (higher for players with more data)
      const confidence = player.avgPoints ? 0.85 : 0.65;
      
      return {
        player_id: String(player.id),
        name: player.name,
        position: player.position,
        team: player.team,
        ovr: ovrRounded,
        tier,
        confidence
      };
    });

    // Log sample for verification
    if (playersWithOVR.length > 0) {
      console.log('📋 Sample players:');
      playersWithOVR.slice(0, 5).forEach((p, idx) => {
        console.log(`  ${idx + 1}. ${p.name} (${p.position}, ${p.team}) - OVR: ${p.ovr}`);
      });
    }

    // Return in expected format
    res.json({
      success: true,
      data: {
        format: 'redraft',
        position: 'ALL',
        total_players: playersWithOVR.length,
        showing: playersWithOVR.length,
        offset: 0,
        limit: 150,
        players: playersWithOVR
      },
      meta: {
        source: 'database',
        cached: false
      },
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching rankings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch player rankings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ovr/:playerId
 * Get OVR rating for a specific player
 */
router.get('/:playerId', async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId);

    const player = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (player.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const playerData = player[0];
    const ovr = playerData.avgPoints || calculateSimpleOVR(playerData);

    res.json({
      ...playerData,
      ovr: Math.round(ovr),
    });

  } catch (error) {
    console.error('❌ Error fetching player OVR:', error);
    res.status(500).json({ error: 'Failed to fetch player OVR' });
  }
});

/**
 * Simple OVR calculation fallback
 * Used when powerScore is not available
 */
function calculateSimpleOVR(player: any): number {
  // Position-based baseline ratings
  const positionBaseline: Record<string, number> = {
    QB: 75,
    RB: 72,
    WR: 70,
    TE: 68,
  };

  const baseline = positionBaseline[player.position] || 65;

  // Age adjustment (-2 per year over 30, +2 per year under 25)
  let ageModifier = 0;
  if (player.age) {
    if (player.age > 30) {
      ageModifier = -(player.age - 30) * 2;
    } else if (player.age < 25) {
      ageModifier = (25 - player.age) * 2;
    }
  }

  // Calculate final OVR (capped 40-99)
  const ovr = baseline + ageModifier;
  return Math.max(40, Math.min(99, ovr));
}

/**
 * GET /api/ovr/health
 * Health check endpoint for rankings system
 */
router.get('/health', async (req, res) => {
  try {
    const stats = await db
      .select({
        total: sql<number>`COUNT(*)`,
        active: sql<number>`SUM(CASE WHEN ${players.active} = true THEN 1 ELSE 0 END)`,
        qb: sql<number>`SUM(CASE WHEN ${players.position} = 'QB' AND ${players.active} = true THEN 1 ELSE 0 END)`,
        rb: sql<number>`SUM(CASE WHEN ${players.position} = 'RB' AND ${players.active} = true THEN 1 ELSE 0 END)`,
        wr: sql<number>`SUM(CASE WHEN ${players.position} = 'WR' AND ${players.active} = true THEN 1 ELSE 0 END)`,
        te: sql<number>`SUM(CASE WHEN ${players.position} = 'TE' AND ${players.active} = true THEN 1 ELSE 0 END)`,
      })
      .from(players);

    res.json({
      status: 'healthy',
      database: 'connected',
      players: stats[0],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
