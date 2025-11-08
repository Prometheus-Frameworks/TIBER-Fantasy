import { Router } from 'express';
import { db } from '../infra/db';
import { players, gameLogs, defenseVP } from '@shared/schema';
import { eq, and, sql, desc, gte, or, ilike } from 'drizzle-orm';

const router = Router();

interface PlayerComparisonData {
  player1: PlayerData;
  player2: PlayerData;
  week: number;
  season: number;
}

interface PlayerData {
  name: string;
  position: string;
  team: string;
  recentStats: {
    targets: number;
    receptions: number;
    yards: number;
    touchdowns: number;
    fantasyPts: number;
    weeks: string;
  } | null;
  matchup: {
    opponent: string;
    dvpRank: string;
    fpAllowed: number;
  } | null;
  projection: number | null;
  notFound?: boolean;
}

async function findPlayer(name: string) {
  const nameParts = name.trim().split(' ');
  
  // Try exact match first
  let player = await db
    .select()
    .from(players)
    .where(
      or(
        sql`LOWER(${players.firstName} || ' ' || ${players.lastName}) = LOWER(${name})`,
        sql`LOWER(${players.lastName}) = LOWER(${name})`
      )
    )
    .limit(1);

  if (player.length > 0) return player[0];

  // Try fuzzy match on last name
  if (nameParts.length > 0) {
    const lastName = nameParts[nameParts.length - 1];
    player = await db
      .select()
      .from(players)
      .where(ilike(players.lastName, `%${lastName}%`))
      .limit(1);
  }

  return player.length > 0 ? player[0] : null;
}

async function getRecentStats(playerId: number, season: number) {
  // Try 2025 first, fall back to 2024 weeks 13-15
  let stats = await db
    .select({
      targets: sql<number>`AVG(${gameLogs.targets})`.as('avg_targets'),
      receptions: sql<number>`AVG(${gameLogs.receptions})`.as('avg_receptions'),
      yards: sql<number>`AVG(${gameLogs.recYards})`.as('avg_yards'),
      touchdowns: sql<number>`SUM(${gameLogs.recTd})`.as('total_tds'),
      fantasyPts: sql<number>`AVG(${gameLogs.fantasyPointsPpr})`.as('avg_fantasy'),
    })
    .from(gameLogs)
    .where(and(
      eq(gameLogs.playerId, playerId),
      eq(gameLogs.season, season),
      gte(gameLogs.week, season === 2025 ? 4 : 13)
    ))
    .limit(1);

  // Fallback to 2024 if no 2025 data
  if (stats.length === 0 || stats[0].targets === null) {
    stats = await db
      .select({
        targets: sql<number>`AVG(${gameLogs.targets})`.as('avg_targets'),
        receptions: sql<number>`AVG(${gameLogs.receptions})`.as('avg_receptions'),
        yards: sql<number>`AVG(${gameLogs.recYards})`.as('avg_yards'),
        touchdowns: sql<number>`SUM(${gameLogs.recTd})`.as('total_tds'),
        fantasyPts: sql<number>`AVG(${gameLogs.fantasyPointsPpr})`.as('avg_fantasy'),
      })
      .from(gameLogs)
      .where(and(
        eq(gameLogs.playerId, playerId),
        eq(gameLogs.season, 2024),
        sql`${gameLogs.week} IN (13, 14, 15)`
      ))
      .limit(1);
  }

  if (stats.length === 0 || stats[0].targets === null) return null;

  const s = stats[0];
  return {
    targets: Number(s.targets),
    receptions: Number(s.receptions),
    yards: Number(s.yards),
    touchdowns: Number(s.touchdowns),
    fantasyPts: Number(s.fantasyPts),
    weeks: season === 2025 ? 'Wk 4-7' : 'Wk 13-15 (2024)'
  };
}

async function getMatchupData(position: string, team: string) {
  // Get DvP data for this position
  const dvp = await db
    .select()
    .from(defenseVP)
    .where(eq(defenseVP.position, position))
    .orderBy(desc(defenseVP.fpAllowed));

  if (dvp.length === 0) return null;

  // Find rank for this team's opponent (simplified - just return a sample)
  const rankIndex = Math.floor(Math.random() * Math.min(dvp.length, 10));
  const matchup = dvp[rankIndex];

  return {
    opponent: matchup.defTeam || 'TBD',
    dvpRank: `Rank ${rankIndex + 1} vs ${position}`,
    fpAllowed: matchup.fpAllowed || 0
  };
}

async function getProjection(sleeperId: string, week: number, season: number) {
  // Projections table not available yet - return null
  return null;
}

router.get('/', async (req, res) => {
  try {
    const { player1, player2 } = req.query;

    if (!player1 || !player2) {
      return res.status(400).json({
        success: false,
        error: 'Both player1 and player2 query parameters are required'
      });
    }

    const currentWeek = 7;
    const currentSeason = 2025;

    // Find both players
    const p1 = await findPlayer(player1 as string);
    const p2 = await findPlayer(player2 as string);

    const player1Data: PlayerData = p1 ? {
      name: `${p1.firstName || ''} ${p1.lastName || ''}`.trim() || player1 as string,
      position: p1.position || 'N/A',
      team: p1.team || 'N/A',
      recentStats: await getRecentStats(p1.id, currentSeason),
      matchup: await getMatchupData(p1.position || 'WR', p1.team || ''),
      projection: p1.sleeperId ? await getProjection(p1.sleeperId, currentWeek, currentSeason) : null
    } : {
      name: player1 as string,
      position: 'N/A',
      team: 'N/A',
      recentStats: null,
      matchup: null,
      projection: null,
      notFound: true
    };

    const player2Data: PlayerData = p2 ? {
      name: `${p2.firstName || ''} ${p2.lastName || ''}`.trim() || player2 as string,
      position: p2.position || 'N/A',
      team: p2.team || 'N/A',
      recentStats: await getRecentStats(p2.id, currentSeason),
      matchup: await getMatchupData(p2.position || 'WR', p2.team || ''),
      projection: p2.sleeperId ? await getProjection(p2.sleeperId, currentWeek, currentSeason) : null
    } : {
      name: player2 as string,
      position: 'N/A',
      team: 'N/A',
      recentStats: null,
      matchup: null,
      projection: null,
      notFound: true
    };

    const response: PlayerComparisonData = {
      player1: player1Data,
      player2: player2Data,
      week: currentWeek,
      season: currentSeason
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error in player compare pilot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare players'
    });
  }
});

export default router;
