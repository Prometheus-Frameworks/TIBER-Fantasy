import { storage, type IStorage } from '../storage';
import { sleeperClient, type SleeperRoster } from '../integrations/sleeperClient';
import { db } from '../infra/db';
import { forgePlayerState, playerIdentityMap } from '@shared/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { forgeService, type ForgeScore } from '../modules/forge/forgeService';
import { createPlaybookForgeLogger, type PlaybookForgeLogger } from '../utils/playbookForgeLogger';

const BENCH_WEIGHT = 0.15;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MISSING_RATE_BYPASS_THRESHOLD = Number(process.env.PLAYBOOK_FORGE_BYPASS_THRESHOLD ?? 0.1);
const UPSERT_CACHE_DEFAULT = process.env.PLAYBOOK_FORGE_UPSERT_CACHE !== '0';

type LeagueDashboardPlayer = {
  rosterKey: string;
  canonicalId: string | null;
  sleeperId?: string | null;
  name: string;
  pos: string;
  alpha: number | null;
  missingReason?: string | null;
};

export type LeagueDashboardTeam = {
  team_id: string;
  display_name: string;
  totals: { QB: number; RB: number; WR: number; TE: number };
  bench_contribution: number;
  overall_total: number;
  starters_used: Array<LeagueDashboardPlayer>;
  roster: Array<LeagueDashboardPlayer & { usedAsStarter: boolean }>;
};

export type LeagueDashboardPayload = {
  success: true;
  meta: { league_id: string; week: number | null; season: number | null; computed_at: string; cached: boolean };
  diagnostics?: {
    rosterCount: number;
    resolvedCanonicalCount: number;
    unresolvedSleeperCount: number;
    cachedForgeRowCount: number;
    computedForgeCount: number;
    stillMissingCount: number;
  };
  unresolvedPlayers: Array<{ sleeperId: string; reason: string }>;
  teams: LeagueDashboardTeam[];
};

type LeagueDashboardParams = {
  userId: string;
  leagueId: string;
  week?: number | null;
  season?: number | null;
  refresh?: boolean;
  upsertCache?: boolean;
};

type DebugOptions = {
  logger?: PlaybookForgeLogger;
  enabled?: boolean;
  requestId?: string;
};

type LeagueDashboardDeps = {
  storage: IStorage;
  sleeperClient: typeof sleeperClient;
  db: typeof db;
  forgeService: typeof forgeService;
};

const defaultDeps: LeagueDashboardDeps = {
  storage,
  sleeperClient,
  db,
  forgeService,
};

function normalizeExternalId(value?: string | null) {
  if (!value) return null;
  return String(value);
}

function resolveRosterPositions(settings: any, fallback: string[] = []) {
  if (!settings) return fallback;
  if (Array.isArray((settings as any).roster_positions)) return (settings as any).roster_positions as string[];
  return fallback;
}

function computeSnapshotMissingRates(payload: any) {
  if (!payload || !payload.teams) return { missingRate: 0, unresolvedRate: 0 };

  let totalPlayers = 0;
  let missingAlpha = 0;
  for (const team of payload.teams as any[]) {
    const roster = Array.isArray(team?.roster) ? team.roster : [];
    totalPlayers += roster.length;
    missingAlpha += roster.filter((r: any) => r.alpha === null || r.alpha === undefined).length;
  }

  const unresolvedPlayers = Array.isArray(payload.unresolvedPlayers) ? payload.unresolvedPlayers.length : 0;
  const missingRate = totalPlayers === 0 ? 0 : missingAlpha / totalPlayers;
  const unresolvedRate = totalPlayers === 0 ? 0 : unresolvedPlayers / totalPlayers;
  return { missingRate, unresolvedRate };
}

function countPositions(rosterPositions: string[]) {
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, SUPER_FLEX: 0 };
  for (const slot of rosterPositions) {
    const slotUpper = slot.toUpperCase();
    if (slotUpper === 'QB' || slotUpper === 'RB' || slotUpper === 'WR' || slotUpper === 'TE') {
      counts[slotUpper as keyof typeof counts] += 1;
    } else if (slotUpper.includes('SUPER_FLEX') || slotUpper === 'Q/W/R/T') {
      counts.SUPER_FLEX += 1;
    } else if (slotUpper === 'FLEX' || slotUpper === 'W/R/T' || slotUpper === 'WR/RB/TE') {
      counts.FLEX += 1;
    }
  }
  return counts;
}

function buildLineup(players: LeagueDashboardPlayer[], rosterPositions: string[]) {
  const counts = countPositions(rosterPositions);
  const totals = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const startersUsed: LeagueDashboardPlayer[] = [];
  const used = new Set<string>();

  const sorted = [...players].sort((a, b) => (b.alpha ?? 0) - (a.alpha ?? 0));

  function takePlayers(pos: string, count: number) {
    for (const player of sorted) {
      if (count <= 0) break;
      if (used.has(player.rosterKey)) continue;
      if (player.pos !== pos) continue;
      used.add(player.rosterKey);
      startersUsed.push(player);
      totals[pos as keyof typeof totals] += player.alpha ?? 0;
      count -= 1;
    }
  }

  takePlayers('QB', counts.QB);
  takePlayers('RB', counts.RB);
  takePlayers('WR', counts.WR);
  takePlayers('TE', counts.TE);

  function flexEligible(p: { pos: string }) {
    return p.pos === 'RB' || p.pos === 'WR' || p.pos === 'TE';
  }

  function superFlexEligible(p: { pos: string }) {
    return p.pos === 'QB' || flexEligible(p);
  }

  function takeFlex(count: number, predicate: (p: { pos: string }) => boolean) {
    for (const player of sorted) {
      if (count <= 0) break;
      if (used.has(player.rosterKey)) continue;
      if (!predicate(player)) continue;
      used.add(player.rosterKey);
      startersUsed.push(player);
      totals[player.pos as keyof typeof totals] += player.alpha ?? 0;
      count -= 1;
    }
  }

  takeFlex(counts.FLEX, flexEligible);
  takeFlex(counts.SUPER_FLEX, superFlexEligible);

  const roster = sorted.map((player) => ({
    ...player,
    usedAsStarter: used.has(player.rosterKey),
  }));

  const benchSum = roster
    .filter((p) => !p.usedAsStarter)
    .reduce((sum, p) => sum + (p.alpha ?? 0), 0);

  const benchContribution = BENCH_WEIGHT * benchSum;
  const overall = Object.values(totals).reduce((sum, val) => sum + val, 0) + benchContribution;

  return { totals, startersUsed, roster, overallTotal: overall, benchContribution };
}

export async function computeLeagueDashboard(
  params: LeagueDashboardParams,
  deps: LeagueDashboardDeps = defaultDeps,
  debug?: DebugOptions
): Promise<LeagueDashboardPayload> {
  const { userId, leagueId } = params;
  const refresh = Boolean(params.refresh);
  const upsertCache = params.upsertCache ?? UPSERT_CACHE_DEFAULT;

  const logger = debug?.logger || createPlaybookForgeLogger({
    requestId: debug?.requestId,
    enabled: debug?.enabled,
    scope: 'LeagueDashboard',
  });

  const league = await deps.storage.getLeagueWithTeams(leagueId);
  if (!league || (league as any).userId !== userId && (league as any).user_id !== userId) {
    throw new Error('League not found');
  }

  const externalLeagueId = (league as any).leagueIdExternal ?? (league as any).league_id_external;
  if (!externalLeagueId) {
    throw new Error('League is missing external identifier');
  }

  const rosterPositions = resolveRosterPositions(
    typeof (league as any).settings === 'string' ? JSON.parse((league as any).settings) : (league as any).settings,
    []
  );

  const [rosters, latestLeague] = await Promise.all([
    deps.sleeperClient.getLeagueRosters(String(externalLeagueId)),
    deps.sleeperClient.getLeague(String(externalLeagueId)),
  ]);

  const explicitSeason = params.season ?? null;
  const explicitWeek = params.week ?? null;
  const effectiveSeason = explicitSeason ?? (league as any).season ?? (latestLeague as any)?.season ?? null;
  const effectiveWeek = explicitWeek ?? (latestLeague as any)?.week ?? null;

  const snapshot = refresh
    ? null
    : await deps.storage.getLeagueDashboardSnapshot(leagueId, effectiveSeason, effectiveWeek);

  if (snapshot && snapshot.computedAt) {
    const computedAtMs = new Date(snapshot.computedAt).getTime();
    const withinTtl = Date.now() - computedAtMs < CACHE_TTL_MS;
    const { missingRate, unresolvedRate } = computeSnapshotMissingRates(snapshot.payload);
    const bypass = missingRate > MISSING_RATE_BYPASS_THRESHOLD || unresolvedRate > MISSING_RATE_BYPASS_THRESHOLD;

    logger.log('snapshot-check', {
      requestId: logger.requestId,
      withinTtl,
      missingRate,
      unresolvedRate,
      bypass,
      threshold: MISSING_RATE_BYPASS_THRESHOLD,
      effectiveWeek,
    });

    if (withinTtl && !bypass) {
      const payload = snapshot.payload as LeagueDashboardPayload;
      return {
        ...payload,
        meta: {
          ...(payload.meta ?? {}),
          week: effectiveWeek,
          season: effectiveSeason,
          computed_at:
            snapshot.computedAt instanceof Date
              ? snapshot.computedAt.toISOString()
              : new Date(snapshot.computedAt).toISOString(),
          cached: true,
        },
      };
    }
  }

  const rosterPlayerIds = Array.from(
    new Set(
      rosters.flatMap((r) => (r.players ?? []).map((pid) => String(pid)))
    )
  );

  logger.log('rosters-loaded', {
    requestId: logger.requestId,
    roster_count: rosters.length,
    unique_player_ids: rosterPlayerIds.length,
    sample_player_ids: rosterPlayerIds.slice(0, 10),
  });

  const positionsRaw = rosterPositions.length > 0 ? rosterPositions : resolveRosterPositions(latestLeague, []);
  const positions = positionsRaw.length > 0
    ? positionsRaw
    : ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX'];

  const rosterByOwner = new Map<string, SleeperRoster>();
  rosters.forEach((roster) => {
    rosterByOwner.set(String(roster.owner_id), roster);
  });

  const identities = rosterPlayerIds.length
    ? await deps.db
        .select()
        .from(playerIdentityMap)
        .where(inArray(playerIdentityMap.sleeperId, rosterPlayerIds))
    : [];

  const identityBySleeperId = new Map(identities.map((id) => [String(id.sleeperId), id]));
  const canonicalIds = identities.map((id) => id.canonicalId);

  logger.log('identity-join', {
    requestId: logger.requestId,
    identity_rows: identities.length,
    missing_identity_count: rosterPlayerIds.length - identities.length,
    sample_identity: identities.slice(0, 5).map((id) => ({ sleeperId: id.sleeperId, canonicalId: id.canonicalId })),
  });

  const conditions = [inArray(forgePlayerState.playerId, canonicalIds) as any];
  const targetSeasonFilter = effectiveSeason;
  if (targetSeasonFilter !== null) {
    conditions.push(eq(forgePlayerState.season, Number(targetSeasonFilter)) as any);
  }
  const targetWeekFilter = effectiveWeek;
  if (targetWeekFilter !== null) {
    conditions.push(eq(forgePlayerState.week, Number(targetWeekFilter)) as any);
  }

  const alphaRows = canonicalIds.length
    ? await deps.db
        .select()
        .from(forgePlayerState)
        .where((conditions.length > 1 ? and(...conditions.filter(Boolean)) : conditions[0]) as any)
        .orderBy(desc(forgePlayerState.season), desc(forgePlayerState.week), desc(forgePlayerState.computedAt))
    : [];

  const alphaByPlayer = new Map<string, { alpha: number | null; row: any }>();
  for (const row of alphaRows) {
    if (alphaByPlayer.has(row.playerId)) continue;
    const alphaValue = row.alphaFinal ?? row.alphaRaw;
    alphaByPlayer.set(row.playerId, {
      alpha: alphaValue === null || alphaValue === undefined ? null : Number(alphaValue),
      row,
    });
  }

  logger.log('forge-rows', {
    requestId: logger.requestId,
    forge_rows: alphaRows.length,
    canonical_with_alpha: alphaByPlayer.size,
    sample_forge_player_ids: Array.from(alphaByPlayer.keys()).slice(0, 5),
    target_season: targetSeasonFilter,
    target_week: effectiveWeek,
  });

  const teams: LeagueDashboardTeam[] = [];

  const missingAlphaReasons: Record<string, number> = {};
  let matchedAlphaCount = 0;
  let fallbackCount = 0;
  const unresolvedPlayers: Array<{ sleeperId: string; reason: string }> = [];
  const missingCanonicalIds = new Set<string>();
  let resolvedCanonicalCount = 0;

  const teamPlayersMap = new Map<string, LeagueDashboardPlayer[]>();

  for (const team of league.teams) {
    const externalUserId = normalizeExternalId((team as any).externalUserId ?? (team as any).external_user_id);
    const roster = externalUserId ? rosterByOwner.get(externalUserId) : undefined;
    const sleeperPlayers = roster?.players ?? [];

    const players = sleeperPlayers.map((pid) => {
      const sleeperId = String(pid);
      const identity = identityBySleeperId.get(sleeperId);
      const canonicalId = identity?.canonicalId ?? null;
      const pos = identity?.position ?? 'FLEX';
      const rosterKey = canonicalId ?? `sleeper:${sleeperId}`;
      const alphaEntry = canonicalId ? alphaByPlayer.get(canonicalId) : undefined;
      const alpha = alphaEntry ? alphaEntry.alpha : null;

      if (canonicalId) {
        resolvedCanonicalCount += 1;
      }

      if (alphaEntry && alphaEntry.alpha !== null && alphaEntry.alpha !== undefined) {
        matchedAlphaCount += 1;
      } else {
        fallbackCount += 1;
        const reason = !identity
          ? 'unmapped_sleeper_id'
          : !alphaEntry
            ? 'missing_forge_row'
            : 'alpha_null';
        if (reason === 'unmapped_sleeper_id') {
          unresolvedPlayers.push({ sleeperId, reason });
        }
        if (canonicalId && (reason === 'missing_forge_row' || reason === 'alpha_null')) {
          missingCanonicalIds.add(canonicalId);
        }
        missingAlphaReasons[reason] = (missingAlphaReasons[reason] ?? 0) + 1;
        logger.log('missing-forge-score', {
          requestId: logger.requestId,
          sleeper_id: sleeperId,
          canonical_id: canonicalId,
          position: pos,
          reason,
          season: targetSeasonFilter,
          week: effectiveWeek,
        });
      }
      return {
        rosterKey,
        canonicalId,
        sleeperId,
        name: identity?.fullName ?? sleeperId,
        pos,
        alpha,
        missingReason: alpha === null ? (!canonicalId ? 'unmapped_sleeper_id' : !alphaEntry ? 'missing_forge_row' : 'alpha_null') : null,
      };
    });

    teamPlayersMap.set(team.id, players);
  }

  let computedForgeCount = 0;
  if (missingCanonicalIds.size > 0) {
    const computeWeek = targetWeekFilter ?? 1;
    const scores = await deps.forgeService.getForgeScoresForPlayers(Array.from(missingCanonicalIds), Number(targetSeasonFilter ?? (league as any).season ?? 2025), computeWeek) as ForgeScore[];
    computedForgeCount = scores.length;

    scores.forEach((score) => {
      alphaByPlayer.set(score.playerId, { alpha: score.alpha, row: null });
    });

    if (upsertCache && scores.length > 0) {
      const rows = scores.map((score) => ({
        playerId: score.playerId,
        playerName: score.playerName,
        position: score.position,
        season: Number(targetSeasonFilter ?? score.season),
        week: Number(targetWeekFilter ?? score.asOfWeek ?? computeWeek),
        alphaRaw: score.rawAlpha ?? score.alpha,
        alphaFinal: score.alpha,
      }));
      await deps.db
        .insert(forgePlayerState)
        .values(rows as any)
        .onConflictDoUpdate({
          target: [forgePlayerState.playerId, forgePlayerState.season, forgePlayerState.week],
          set: {
            alphaRaw: sql`excluded.alpha_raw`,
            alphaFinal: sql`excluded.alpha_final`,
            computedAt: new Date(),
            position: sql`excluded.position`,
          },
        });
    }
  }

  let newlyMatchedFromCompute = 0;

  for (const team of league.teams) {
    const players = teamPlayersMap.get(team.id) ?? [];

    const updatedPlayers = players.map((player) => {
      if (!player.canonicalId) return player;
      const updatedAlpha = alphaByPlayer.get(player.canonicalId)?.alpha ?? null;
      const missingReason = updatedAlpha === null ? player.missingReason ?? 'missing_forge_row' : null;
      if (updatedAlpha !== null && player.alpha === null) {
        newlyMatchedFromCompute += 1;
      }
      return { ...player, alpha: updatedAlpha, missingReason };
    });

    const { totals, startersUsed, roster: rosterRows, overallTotal, benchContribution } = buildLineup(updatedPlayers, positions);

    teams.push({
      team_id: team.id,
      display_name: (team as any).displayName ?? (team as any).display_name ?? 'Team',
      totals,
      bench_contribution: benchContribution,
      overall_total: overallTotal,
      starters_used: startersUsed,
      roster: rosterRows,
    });
  }
  matchedAlphaCount += newlyMatchedFromCompute;

  const payload: LeagueDashboardPayload = {
    success: true,
    meta: {
      league_id: leagueId,
      week: effectiveWeek,
      season: effectiveSeason,
      computed_at: new Date().toISOString(),
      cached: false,
    },
    diagnostics: {
      rosterCount: rosterPlayerIds.length,
      resolvedCanonicalCount,
      unresolvedSleeperCount: unresolvedPlayers.length,
      cachedForgeRowCount: alphaByPlayer.size,
      computedForgeCount,
      stillMissingCount: teams.reduce((sum, t) => sum + t.roster.filter((p) => p.alpha === null).length, 0),
    },
    unresolvedPlayers,
    teams,
  };

  logger.log('merge-complete', {
    requestId: logger.requestId,
    teams: teams.length,
    matched_alpha_count: matchedAlphaCount,
    fallback_count: fallbackCount,
    missing_reasons: missingAlphaReasons,
    diagnostics: payload.diagnostics,
  });

  await deps.storage.saveLeagueDashboardSnapshot({
    leagueId,
    season: payload.meta.season,
    week: payload.meta.week,
    payload,
  });

  return payload;
}
