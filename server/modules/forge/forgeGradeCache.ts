import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../infra/db';
import { datadiveSnapshotPlayerWeek, forgeGradeCache } from '@shared/schema';
import { runForgeEngine, assertValidPosition } from './forgeEngine';
import { gradeForge } from './forgeGrading';
import type { Position } from './forgeEngine';

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE'];
const CACHE_VERSION = 'v1';

type ComputeOptions = {
  limit?: number;
  version?: string;
};

type PositionComputeResult = {
  computed: number;
  errors: number;
  durationMs: number;
};

type FantasyStats = {
  ppgPpr: number | null;
  seasonFptsPpr: number | null;
  targets: number | null;
  touches: number | null;
};

export async function computeAndCacheGrades(
  position: Position,
  season: number,
  asOfWeek: number,
  options: ComputeOptions = {}
): Promise<PositionComputeResult> {
  assertValidPosition(position);
  const version = options.version ?? CACHE_VERSION;
  const limit = options.limit ?? 200;
  const posStart = Date.now();
  const tableName = `${position.toLowerCase()}_role_bank`;

  const playerRows = await db.execute(sql`
    SELECT DISTINCT rb.player_id
    FROM ${sql.identifier(tableName)} rb
    INNER JOIN (
      SELECT DISTINCT player_id 
      FROM datadive_snapshot_player_week 
      WHERE season = ${season} AND position = ${position}
    ) dd ON rb.player_id = dd.player_id
    WHERE rb.season = ${season}
      AND rb.player_id IS NOT NULL
    ORDER BY rb.player_id
    LIMIT ${limit}
  `);

  let computed = 0;
  let errors = 0;

  for (const row of playerRows.rows) {
    const playerId = String((row as any).player_id || '').trim();
    if (!playerId) continue;

    const playerStart = Date.now();

    try {
      const t0 = Date.now();
      const engineOutput = await runForgeEngine(playerId, position, season, 'season');
      const t1 = Date.now();

      const gradingResult = gradeForge(engineOutput, { mode: 'redraft' });
      const gradingNoLens = gradeForge(engineOutput, { mode: 'redraft', skipFootballLens: true });
      const t2 = Date.now();

      const stats = await fetchFantasyStats(playerId, season);
      const t3 = Date.now();

      const trajectory = deriveTrajectory(engineOutput.alphaMomentum);
      const confidence = deriveConfidence(engineOutput.gamesPlayed, gradingResult.issues?.length ?? 0);
      const issueCodes = (gradingResult.issues ?? []).map((issue) => issue.code);
      const lensAdjustment = round1((gradingResult.debug?.baseAlpha ?? gradingResult.alpha) - (gradingNoLens.debug?.baseAlpha ?? gradingNoLens.alpha));

      await db
        .insert(forgeGradeCache)
        .values({
          playerId: engineOutput.playerId,
          playerName: engineOutput.playerName,
          position,
          nflTeam: engineOutput.nflTeam,
          season,
          asOfWeek,
          alpha: gradingResult.alpha,
          rawAlpha: gradingResult.debug?.rawAlpha ?? gradingResult.debug?.baseAlpha,
          volumeScore: gradingResult.pillars.volume,
          efficiencyScore: gradingResult.pillars.efficiency,
          teamContextScore: gradingResult.pillars.teamContext,
          stabilityScore: gradingResult.pillars.stability,
          dynastyContext: gradingResult.pillars.dynastyContext,
          tier: gradingResult.tier,
          tierNumeric: gradingResult.tierPosition,
          footballLensIssues: issueCodes,
          lensAdjustment,
          confidence,
          trajectory,
          gamesPlayed: engineOutput.gamesPlayed,
          ppgPpr: stats.ppgPpr,
          seasonFptsPpr: stats.seasonFptsPpr,
          targets: stats.targets,
          touches: stats.touches,
          computedAt: new Date(),
          version,
        })
        .onConflictDoUpdate({
          target: [forgeGradeCache.playerId, forgeGradeCache.season, forgeGradeCache.asOfWeek, forgeGradeCache.version],
          set: {
            playerName: engineOutput.playerName,
            position,
            nflTeam: engineOutput.nflTeam,
            alpha: gradingResult.alpha,
            rawAlpha: gradingResult.debug?.rawAlpha ?? gradingResult.debug?.baseAlpha,
            volumeScore: gradingResult.pillars.volume,
            efficiencyScore: gradingResult.pillars.efficiency,
            teamContextScore: gradingResult.pillars.teamContext,
            stabilityScore: gradingResult.pillars.stability,
            dynastyContext: gradingResult.pillars.dynastyContext,
            tier: gradingResult.tier,
            tierNumeric: gradingResult.tierPosition,
            footballLensIssues: issueCodes,
            lensAdjustment,
            confidence,
            trajectory,
            gamesPlayed: engineOutput.gamesPlayed,
            ppgPpr: stats.ppgPpr,
            seasonFptsPpr: stats.seasonFptsPpr,
            targets: stats.targets,
            touches: stats.touches,
            computedAt: new Date(),
          },
        });
      const t4 = Date.now();

      computed += 1;
      const playerMs = Date.now() - playerStart;
      console.log(`[ForgeGradeCache] ${engineOutput.playerName} (${position}): ${gradingResult.alpha.toFixed(1)} alpha in ${playerMs}ms`);

      if (playerMs > 1000) {
        console.warn(`[ForgeGradeCache] SLOW player ${engineOutput.playerName}: engine=${t1 - t0}ms grading=${t2 - t1}ms stats=${t3 - t2}ms write=${t4 - t3}ms total=${playerMs}ms`);
      }
    } catch (error) {
      errors += 1;
      console.error(`[ForgeGradeCache] ERROR computing ${playerId} (${position}):`, error instanceof Error ? error.message : error);
    }
  }

  const durationMs = Date.now() - posStart;
  const avg = computed > 0 ? Math.round(durationMs / computed) : 0;
  console.log(`[ForgeGradeCache] ${position} batch: ${computed} players in ${durationMs}ms (avg ${avg}ms/player)`);

  await logSanityWarnings(position, season, asOfWeek, version);

  return { computed, errors, durationMs };
}

export async function computeAllGrades(
  season: number,
  asOfWeek: number,
  options: ComputeOptions = {}
): Promise<Record<Position, PositionComputeResult>> {
  const jobStart = Date.now();
  const results = {} as Record<Position, PositionComputeResult>;
  let totalPlayers = 0;

  for (const position of POSITIONS) {
    results[position] = await computeAndCacheGrades(position, season, asOfWeek, options);
    totalPlayers += results[position].computed;
  }

  const totalMs = Date.now() - jobStart;
  console.log(`[ForgeGradeCache] Full computation: ${totalPlayers} players in ${totalMs}ms`);
  return results;
}

export async function getGradesFromCache(
  season: number,
  asOfWeek: number | undefined,
  position: Position | 'ALL',
  limit: number,
  version: string = CACHE_VERSION
) {
  let resolvedAsOfWeek = asOfWeek ?? (await getLatestAsOfWeek(season, version));

  if (resolvedAsOfWeek) {
    const hasData = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(forgeGradeCache)
      .where(
        and(
          eq(forgeGradeCache.season, season),
          eq(forgeGradeCache.asOfWeek, resolvedAsOfWeek),
          eq(forgeGradeCache.version, version),
          ...(position !== 'ALL' ? [eq(forgeGradeCache.position, position)] : [])
        )
      );
    if (Number(hasData[0]?.cnt ?? 0) === 0) {
      const fallbackWeek = await getLatestAsOfWeek(season, version);
      if (fallbackWeek && fallbackWeek !== resolvedAsOfWeek) {
        console.log(`[ForgeGradeCache] No data for week ${resolvedAsOfWeek}, falling back to latest week ${fallbackWeek}`);
        resolvedAsOfWeek = fallbackWeek;
      }
    }
  }

  if (!resolvedAsOfWeek) {
    return {
      season,
      asOfWeek: asOfWeek ?? null,
      position,
      version,
      players: [],
      computedAt: null as Date | null,
    };
  }

  const readStart = Date.now();

  const whereClause = [
    eq(forgeGradeCache.season, season),
    eq(forgeGradeCache.asOfWeek, resolvedAsOfWeek),
    eq(forgeGradeCache.version, version),
  ];

  if (position !== 'ALL') {
    whereClause.push(eq(forgeGradeCache.position, position));
  }

  const rows = await db
    .select()
    .from(forgeGradeCache)
    .where(and(...whereClause))
    .orderBy(position === 'ALL' ? forgeGradeCache.position : desc(forgeGradeCache.alpha), desc(forgeGradeCache.alpha))
    .limit(limit);

  const readMs = Date.now() - readStart;
  console.log(`[ForgeGradeCache] Read ${rows.length} grades for ${position} in ${readMs}ms`);

  if (rows.length > 0 && rows[0].computedAt) {
    const ageMinutes = (Date.now() - rows[0].computedAt.getTime()) / 60000;
    if (ageMinutes > 1440) {
      console.warn(`[ForgeGradeCache] Cache is ${ageMinutes.toFixed(0)} minutes old for ${position} week ${resolvedAsOfWeek}`);
    }
  }

  return {
    season,
    asOfWeek: resolvedAsOfWeek,
    position,
    version,
    players: rows,
    computedAt: rows[0]?.computedAt ?? null,
  };
}

async function getLatestAsOfWeek(season: number, version: string): Promise<number | null> {
  const result = await db
    .select({ maxWeek: sql<number>`max(${forgeGradeCache.asOfWeek})` })
    .from(forgeGradeCache)
    .where(and(eq(forgeGradeCache.season, season), eq(forgeGradeCache.version, version)));

  return result[0]?.maxWeek ? Number(result[0].maxWeek) : null;
}

async function fetchFantasyStats(playerId: string, season: number): Promise<FantasyStats> {
  const rows = await db
    .select({
      seasonFptsPpr: sql<number>`sum(${datadiveSnapshotPlayerWeek.fptsPpr})`,
      ppgPpr: sql<number>`avg(${datadiveSnapshotPlayerWeek.fptsPpr})`,
      targets: sql<number>`sum(${datadiveSnapshotPlayerWeek.targets})`,
      touches: sql<number>`sum(coalesce(${datadiveSnapshotPlayerWeek.rushAttempts}, 0) + coalesce(${datadiveSnapshotPlayerWeek.receptions}, 0))`,
    })
    .from(datadiveSnapshotPlayerWeek)
    .where(and(eq(datadiveSnapshotPlayerWeek.playerId, playerId), eq(datadiveSnapshotPlayerWeek.season, season)));

  const agg = rows[0];
  return {
    seasonFptsPpr: agg?.seasonFptsPpr !== null ? round1(Number(agg.seasonFptsPpr)) : null,
    ppgPpr: agg?.ppgPpr !== null ? round1(Number(agg.ppgPpr)) : null,
    targets: agg?.targets !== null && agg?.targets !== undefined ? Number(agg.targets) : null,
    touches: agg?.touches !== null && agg?.touches !== undefined ? Number(agg.touches) : null,
  };
}

function deriveTrajectory(alphaMomentum?: number): 'rising' | 'flat' | 'declining' {
  if (typeof alphaMomentum !== 'number') return 'flat';
  if (alphaMomentum >= 1.5) return 'rising';
  if (alphaMomentum <= -1.5) return 'declining';
  return 'flat';
}

function deriveConfidence(gamesPlayed: number, issueCount: number): number {
  const gameScore = Math.min(100, Math.max(0, (gamesPlayed / 17) * 100));
  const issuePenalty = Math.min(20, issueCount * 5);
  return round1(Math.max(20, gameScore - issuePenalty));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

async function logSanityWarnings(position: Position, season: number, asOfWeek: number, version: string) {
  const rows = await db
    .select({ alpha: forgeGradeCache.alpha, tierNumeric: forgeGradeCache.tierNumeric })
    .from(forgeGradeCache)
    .where(
      and(
        eq(forgeGradeCache.position, position),
        eq(forgeGradeCache.season, season),
        eq(forgeGradeCache.asOfWeek, asOfWeek),
        eq(forgeGradeCache.version, version)
      )
    );

  if (rows.length === 0) return;

  const t1Players = rows.filter((row) => row.tierNumeric === 1).length;
  const alphas = rows.map((row) => Number(row.alpha));
  const maxAlpha = Math.max(...alphas);
  const minAlpha = Math.min(...alphas);

  if (t1Players === 0) {
    console.warn(`[ForgeGradeCache] WTF: No T1 players for ${position}!`);
  }

  if ((position === 'WR' && t1Players > 12) || (position === 'RB' && t1Players > 10) || (position === 'QB' && t1Players > 8) || (position === 'TE' && t1Players > 5)) {
    console.warn(`[ForgeGradeCache] WTF: ${t1Players} T1 players for ${position} — threshold may be too loose`);
  }

  if (maxAlpha - minAlpha < 20) {
    console.warn(`[ForgeGradeCache] WTF: Alpha spread only ${(maxAlpha - minAlpha).toFixed(1)} — possible compression`);
  }
}

export { CACHE_VERSION, POSITIONS };
