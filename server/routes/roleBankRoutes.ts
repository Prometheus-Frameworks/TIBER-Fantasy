// server/routes/roleBankRoutes.ts
import type { Express, Request, Response } from 'express';
import { storage } from '../storage';
import { db } from '../infra/db';
import { playerIdentityMap, wrRoleBank, rbRoleBank, teRoleBank } from '@shared/schema';
import { eq, and, gte, inArray, desc as descOrder, asc as ascOrder, sql } from 'drizzle-orm';

// ========== TYPES ==========

type Position = 'WR' | 'RB' | 'TE';

// Unified response shape for all positions
interface RoleBankListItem {
  playerId: string;
  canonicalId: string | null;
  sleeperId: string | null;
  playerName: string | null;
  team: string | null;
  position: string;
  
  roleScore: number;
  roleTier: string;
  
  gamesPlayed: number;
  
  // Volume metrics (position-specific, null if N/A)
  targetsPerGame: number | null;
  carriesPerGame: number | null;
  opportunitiesPerGame: number | null;
  
  targetShareAvg: number | null;
  routesPerGame: number | null;
  
  pprPerTarget: number | null;
  pprPerOpportunity: number | null;
  
  // Sub-scores
  volumeScore: number;
  consistencyScore: number;
  highValueUsageScore: number;
  momentumScore: number;
  
  // Flags (position-specific, null if N/A)
  flags: {
    cardioWr: boolean | null;
    pureRusher: boolean | null;
    passingDownBack: boolean | null;
    breakoutWatch: boolean | null;
    redZoneWeapon: boolean | null;
    cardioTE: boolean | null;
  };
}

interface RoleBankDetailResponse extends RoleBankListItem {
  // Additional detail fields
  targetStdDev: number | null;
  fantasyStdDev: number | null;
  oppStdDev: number | null;
  
  redZoneTargetsPerGame: number | null;
  redZoneTouchesPerGame: number | null;
  
  slotRouteShareEst: number | null;
  outsideRouteShareEst: number | null;
  routeShareEst: number | null;
  
  meta: {
    computedAt: string | null;
    version: string;
  };
}

// ========== HELPERS ==========

function normalizePosition(pos: string): Position | null {
  const upper = pos.toUpperCase();
  if (upper === 'WR' || upper === 'RB' || upper === 'TE') {
    return upper as Position;
  }
  return null;
}

function parseQueryArray(param: string | string[] | undefined): string[] | null {
  if (!param) return null;
  if (Array.isArray(param)) return param;
  return param.split(',').map(s => s.trim()).filter(Boolean);
}

// Transform raw DB row + identity to unified list item
function transformToListItem(roleRow: any, position: Position, identityRow: any | null): RoleBankListItem {
  const playerName = identityRow?.fullName || null;
  const team = roleRow.team || identityRow?.team || null;
  
  return {
    playerId: roleRow.playerId,
    canonicalId: identityRow?.canonicalId || null,
    sleeperId: identityRow?.sleeperId || null,
    playerName,
    team,
    position,
    
    roleScore: roleRow.roleScore || 0,
    roleTier: roleRow.roleTier || 'UNKNOWN',
    
    gamesPlayed: roleRow.gamesPlayed || 0,
    
    targetsPerGame: roleRow.targetsPerGame ?? null,
    carriesPerGame: roleRow.carriesPerGame ?? null,
    opportunitiesPerGame: roleRow.opportunitiesPerGame ?? null,
    
    targetShareAvg: roleRow.targetShareAvg ?? null,
    routesPerGame: roleRow.routesPerGame ?? null,
    
    pprPerTarget: roleRow.pprPerTarget ?? null,
    pprPerOpportunity: roleRow.pprPerOpportunity ?? null,
    
    volumeScore: roleRow.volumeScore || 0,
    consistencyScore: roleRow.consistencyScore || 0,
    highValueUsageScore: roleRow.highValueUsageScore || 0,
    momentumScore: roleRow.momentumScore || 0,
    
    flags: {
      cardioWr: roleRow.cardioWrFlag ?? null,
      pureRusher: roleRow.pureRusherFlag ?? null,
      passingDownBack: roleRow.passingDownBackFlag ?? null,
      breakoutWatch: roleRow.breakoutWatchFlag ?? null,
      redZoneWeapon: roleRow.redZoneWeaponFlag ?? null,
      cardioTE: roleRow.cardioTEFlag ?? null,
    }
  };
}

// Transform to detail response with extra fields
function transformToDetail(roleRow: any, position: Position, identityRow: any | null): RoleBankDetailResponse {
  const baseItem = transformToListItem(roleRow, position, identityRow);
  
  return {
    ...baseItem,
    
    targetStdDev: roleRow.targetStdDev ?? null,
    fantasyStdDev: roleRow.fantasyStdDev ?? null,
    oppStdDev: roleRow.oppStdDev ?? null,
    
    redZoneTargetsPerGame: roleRow.redZoneTargetsPerGame ?? null,
    redZoneTouchesPerGame: roleRow.redZoneTouchesPerGame ?? null,
    
    slotRouteShareEst: roleRow.slotRouteShareEst ?? null,
    outsideRouteShareEst: roleRow.outsideRouteShareEst ?? null,
    routeShareEst: roleRow.routeShareEst ?? null,
    
    meta: {
      computedAt: roleRow.computedAt || roleRow.updated_at || null,
      version: 'role_bank_v1.0'
    }
  };
}

// ========== ENDPOINT 1: LIST ==========

async function handleListRoleBank(req: Request, res: Response) {
  try {
    const { position: posParam, season: seasonParam } = req.params;
    
    // Validate position
    const position = normalizePosition(posParam);
    if (!position) {
      return res.status(400).json({
        error: `Invalid position. Must be one of: WR, RB, TE`
      });
    }
    
    // Validate season
    const season = parseInt(seasonParam, 10);
    if (isNaN(season) || season < 2020 || season > 2030) {
      return res.status(400).json({
        error: `Invalid season. Must be a number between 2020-2030`
      });
    }
    
    // Query params
    const tierFilter = parseQueryArray(req.query.tier as string);
    const minRoleScore = req.query.minRoleScore ? parseFloat(req.query.minRoleScore as string) : null;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sortBy as string) || 'roleScore';
    const order = (req.query.order as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    
    // Determine which table to query
    let roleTable: any;
    let storageMethod: (filters: any) => Promise<any[]>;
    
    if (position === 'WR') {
      roleTable = wrRoleBank;
      storageMethod = storage.getWRRoleBank.bind(storage);
    } else if (position === 'RB') {
      roleTable = rbRoleBank;
      storageMethod = storage.getRBRoleBank.bind(storage);
    } else {
      roleTable = teRoleBank;
      storageMethod = storage.getTERoleBank.bind(storage);
    }
    
    // Build Drizzle query with joins for better performance
    // CRITICAL: Use player_positions view to enforce position filtering
    const playerPositionsView = sql`(SELECT player_id, position FROM player_positions)`;
    
    // Apply filters
    const conditions: any[] = [
      eq(roleTable.season, season),
      // Enforce position filter via player_positions view
      sql`${roleTable.playerId} IN (SELECT player_id FROM player_positions WHERE position = ${position})`
    ];
    
    if (tierFilter && tierFilter.length > 0) {
      conditions.push(inArray(roleTable.roleTier, tierFilter));
    }
    
    if (minRoleScore !== null && !isNaN(minRoleScore)) {
      conditions.push(gte(roleTable.roleScore, minRoleScore));
    }
    
    // Build query with position enforcement
    const query = db
      .select({
        roleRow: roleTable,
        identity: {
          canonicalId: playerIdentityMap.canonicalId,
          sleeperId: playerIdentityMap.sleeperId,
          fullName: playerIdentityMap.fullName,
          team: playerIdentityMap.nflTeam,
        }
      })
      .from(roleTable)
      .leftJoin(
        playerIdentityMap,
        eq(roleTable.playerId, playerIdentityMap.nflDataPyId)
      )
      .where(and(...conditions))
      .$dynamic();
    
    // Apply sorting
    const sortOrder = order === 'asc' ? ascOrder : descOrder;
    
    // Map sortBy to actual column
    let sortColumn: any = roleTable.roleScore; // default
    if (sortBy === 'targetsPerGame' && roleTable.targetsPerGame) {
      sortColumn = roleTable.targetsPerGame;
    } else if (sortBy === 'opportunitiesPerGame' && roleTable.opportunitiesPerGame) {
      sortColumn = roleTable.opportunitiesPerGame;
    } else if (sortBy === 'pprPerGame') {
      // Not a direct column, fallback to roleScore
      sortColumn = roleTable.roleScore;
    } else if (sortBy === 'roleScore') {
      sortColumn = roleTable.roleScore;
    }
    
    // Execute with sorting, limit, offset
    const results = await query
      .orderBy(sortOrder(sortColumn))
      .limit(limit)
      .offset(offset);
    
    // Transform results
    const items = results.map((row: any) => 
      transformToListItem(row.roleRow, position, row.identity)
    );
    
    return res.json({
      season,
      position,
      count: items.length,
      filters: {
        tier: tierFilter,
        minRoleScore,
        limit,
        offset,
        sortBy,
        order
      },
      results: items
    });
    
  } catch (error: any) {
    console.error('[Role Bank List Error]', error);
    return res.status(500).json({
      error: 'Failed to fetch role bank data',
      message: error.message
    });
  }
}

// ========== ENDPOINT 2: DETAIL ==========

async function handleDetailRoleBank(req: Request, res: Response) {
  try {
    const { position: posParam, playerId, season: seasonParam } = req.params;
    
    // Validate position
    const position = normalizePosition(posParam);
    if (!position) {
      return res.status(400).json({
        error: `Invalid position. Must be one of: WR, RB, TE`
      });
    }
    
    // Validate season
    const season = parseInt(seasonParam, 10);
    if (isNaN(season)) {
      return res.status(400).json({
        error: `Invalid season. Must be a number`
      });
    }
    
    if (!playerId) {
      return res.status(400).json({
        error: `playerId is required`
      });
    }
    
    // Fetch role bank row
    let roleRow: any = null;
    
    if (position === 'WR') {
      roleRow = await storage.getWRRoleBankByPlayer(playerId, season);
    } else if (position === 'RB') {
      roleRow = await storage.getRBRoleBankByPlayer(playerId, season);
    } else {
      roleRow = await storage.getTERoleBankByPlayer(playerId, season);
    }
    
    if (!roleRow) {
      return res.status(404).json({
        error: `No ${position} Role Bank data found for player ${playerId} in season ${season}`
      });
    }
    
    // Fetch player identity
    const identityRow = await db
      .select()
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.nflDataPyId, playerId))
      .limit(1);
    
    const identity = identityRow.length > 0 ? identityRow[0] : null;
    
    // Transform to detail response
    const detail = transformToDetail(roleRow, position, identity);
    
    return res.json(detail);
    
  } catch (error: any) {
    console.error('[Role Bank Detail Error]', error);
    return res.status(500).json({
      error: 'Failed to fetch player role bank data',
      message: error.message
    });
  }
}

// ========== ENDPOINT 3: WEEKLY USAGE (OPTIONAL) ==========

async function handleWeeklyUsage(req: Request, res: Response) {
  try {
    const { position: posParam, playerId, season: seasonParam } = req.params;
    
    // Validate position
    const position = normalizePosition(posParam);
    if (!position) {
      return res.status(400).json({
        error: `Invalid position. Must be one of: WR, RB, TE`
      });
    }
    
    // Validate season
    const season = parseInt(seasonParam, 10);
    if (isNaN(season)) {
      return res.status(400).json({
        error: `Invalid season. Must be a number`
      });
    }
    
    if (!playerId) {
      return res.status(400).json({
        error: `playerId is required`
      });
    }
    
    // Fetch player identity for name/team
    const identityRow = await db
      .select()
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.nflDataPyId, playerId))
      .limit(1);
    
    const identity = identityRow.length > 0 ? identityRow[0] : null;
    
    // Fetch weekly usage
    let weeklyRows: any[] = [];
    
    if (position === 'WR') {
      weeklyRows = await storage.getWeeklyUsageForRoleBank(playerId, season);
    } else if (position === 'RB') {
      weeklyRows = await storage.getWeeklyUsageForRBRoleBank(playerId, season);
    } else {
      weeklyRows = await storage.getWeeklyUsageForTERoleBank(playerId, season);
    }
    
    // Transform to simplified week-by-week series
    const weeks = weeklyRows.map(row => ({
      week: row.week,
      targets: row.targets ?? 0,
      carries: row.carries ?? 0,
      opportunities: (row.carries ?? 0) + (row.targets ?? 0),
      fantasyPointsPpr: row.fantasyPointsPpr ?? 0,
      targetSharePct: row.targetSharePct ?? null,
      routes: row.routes ?? null,
    }));
    
    return res.json({
      playerId,
      playerName: identity?.fullName || null,
      position,
      team: identity?.nflTeam || null,
      season,
      weeks
    });
    
  } catch (error: any) {
    console.error('[Weekly Usage Error]', error);
    return res.status(500).json({
      error: 'Failed to fetch weekly usage data',
      message: error.message
    });
  }
}

// ========== REGISTRATION ==========

export function registerRoleBankRoutes(app: Express) {
  // List endpoint
  app.get('/api/role-bank/:position/:season', handleListRoleBank);
  
  // Detail endpoint
  app.get('/api/role-bank/:position/:playerId/:season', handleDetailRoleBank);
  
  // Weekly usage endpoint (optional)
  app.get('/api/role-bank/:position/:playerId/:season/weekly-usage', handleWeeklyUsage);
  
  console.log('✓ Role Bank routes registered');
}
