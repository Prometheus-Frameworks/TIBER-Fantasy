import { storage, type IStorage } from '../storage';
import { sleeperClient, type SleeperPlayer, type SleeperRoster } from '../integrations/sleeperClient';
import { db } from '../infra/db';
import { forgePlayerState, playerIdentityMap } from '@shared/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { forgeService } from '../modules/forge/forgeService';
import type { ForgeScore } from '../modules/forge/types';
import { createPlaybookForgeLogger, type PlaybookForgeLogger } from '../utils/playbookForgeLogger';
import {
  findRookieAsset,
  rookieArtifactService,
  type RookieAssetContext,
} from '../modules/externalModels/rookies/rookieArtifactService';

const BENCH_WEIGHT = 0.15;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MISSING_RATE_BYPASS_THRESHOLD = Number(process.env.PLAYBOOK_FORGE_BYPASS_THRESHOLD ?? 0.1);
const UPSERT_CACHE_DEFAULT = process.env.PLAYBOOK_FORGE_UPSERT_CACHE !== '0';

type RosterVisibilityState = 'forge_scored' | 'rookie_alpha_fallback' | 'known_unscored' | 'unresolved';

type RosterCoverageCounts = {
  total: number;
  forgeScored: number;
  rookieAlphaFallback: number;
  knownUnscored: number;
  unresolved: number;
  evidenceCovered: number;
};

type LeagueDashboardPlayer = {
  rosterKey: string;
  canonicalId: string | null;
  sleeperId?: string | null;
  name: string;
  pos: string;
  nflTeam?: string | null;
  alpha: number | null;
  tier?: number | null;
  missingReason?: string | null;
  visibilityState?: RosterVisibilityState;
  unavailableReason?: string | null;
  rookieAsset?: RookieAssetContext | null;
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
    rookieAlphaMatchedCount: number;
    forgeScoredCount: number;
    rookieAlphaFallbackCount: number;
    knownUnscoredCount: number;
    unresolvedCount: number;
    evidenceCoveredCount: number;
    rosterVisibility: RosterCoverageCounts;
  };
  unresolvedPlayers: Array<{ sleeperId: string; reason: string }>;
  teams: LeagueDashboardTeam[];
  leagueSettings?: unknown;
  settings?: unknown;
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
  rookieArtifactService?: Pick<typeof rookieArtifactService, 'getRookieAssetLookup'>;
};

const defaultDeps: LeagueDashboardDeps = {
  storage,
  sleeperClient,
  db,
  forgeService,
  rookieArtifactService,
};

function normalizeExternalId(value?: string | null) {
  if (!value) return null;
  return String(value);
}


function normalizeSleeperPosition(position?: string | null): string | null {
  const normalized = position?.trim().toUpperCase();
  if (!normalized) return null;
  const positionMap: Record<string, string> = {
    QUARTERBACK: 'QB',
    'RUNNING BACK': 'RB',
    RUNNINGBACK: 'RB',
    'WIDE RECEIVER': 'WR',
    WIDERECEIVER: 'WR',
    'TIGHT END': 'TE',
    TIGHTEND: 'TE',
    DEFENSE: 'DEF',
    DEFENCE: 'DEF',
    DST: 'DEF',
    'D/ST': 'DEF',
  };
  return positionMap[normalized] ?? normalized;
}

function normalizeSleeperTeam(team?: string | null): string | null {
  const normalized = team?.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'JAX') return 'JAC';
  return normalized;
}

function buildSleeperFullName(player: SleeperPlayer): string | null {
  const fullName = player.full_name?.trim();
  if (fullName) return fullName;
  const firstName = player.first_name?.trim() ?? '';
  const lastName = player.last_name?.trim() ?? '';
  const joined = `${firstName} ${lastName}`.trim();
  return joined || null;
}

function parseSleeperBirthDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseSleeperWeight(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSleeperPlayerActive(player: SleeperPlayer): boolean {
  if (player.active === true) return true;
  if (player.status?.toLowerCase() === 'active') return true;
  if (player.status?.toLowerCase() === 'inactive') return false;
  return Boolean(player.team?.trim());
}

function confidenceForSleeperIdentity(player: SleeperPlayer): number {
  let confidence = 0.5;
  if (player.full_name?.trim()) confidence += 0.2;
  if (player.first_name?.trim() && player.last_name?.trim()) confidence += 0.1;
  if (player.team?.trim()) confidence += 0.1;
  if (player.active === true || player.status?.toLowerCase() === 'active') confidence += 0.1;
  if (['QB', 'RB', 'WR', 'TE'].includes(normalizeSleeperPosition(player.position) ?? '')) confidence += 0.1;
  return Math.min(confidence, 1);
}

function normalizeNameFingerprint(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function buildIdentityRowFromSleeperPlayer(sleeperId: string, player: SleeperPlayer) {
  const fullName = buildSleeperFullName(player);
  const position = normalizeSleeperPosition(player.position);
  if (!fullName || !position) return null;

  const fantasyDataId = player.fantasy_data_id === null || player.fantasy_data_id === undefined
    ? null
    : String(player.fantasy_data_id);

  return {
    canonicalId: `sleeper:${sleeperId}`,
    fullName,
    firstName: player.first_name?.trim() || null,
    lastName: player.last_name?.trim() || null,
    position,
    nflTeam: normalizeSleeperTeam(player.team),
    sleeperId,
    fantasyDataId,
    gsisId: player.gsis_id?.trim() || null,
    birthDate: parseSleeperBirthDate(player.birth_date),
    college: player.college?.trim() || null,
    height: player.height?.trim() || null,
    weight: parseSleeperWeight(player.weight),
    nameFingerprint: normalizeNameFingerprint(fullName),
    teamHistory: normalizeSleeperTeam(player.team) ? [normalizeSleeperTeam(player.team)!] : [],
    dataCompleteness: [sleeperId, fantasyDataId, player.gsis_id, player.birth_date, player.college, player.height, player.weight]
      .filter((value) => value !== null && value !== undefined && value !== '').length,
    isActive: isSleeperPlayerActive(player),
    confidence: confidenceForSleeperIdentity(player),
    lastVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function hydrateMissingSleeperIdentities(
  sleeperIds: string[],
  deps: LeagueDashboardDeps,
  logger: PlaybookForgeLogger,
): Promise<typeof playerIdentityMap.$inferSelect[]> {
  const uniqueMissingIds = Array.from(new Set(sleeperIds.filter(Boolean)));
  const getNflPlayers = deps.sleeperClient.getNflPlayers;
  if (uniqueMissingIds.length === 0 || typeof getNflPlayers !== 'function') return [];

  try {
    const sleeperPlayers = await getNflPlayers.call(deps.sleeperClient);
    const rows = uniqueMissingIds
      .map((sleeperId) => {
        const player = sleeperPlayers[sleeperId];
        return player ? buildIdentityRowFromSleeperPlayer(sleeperId, { ...player, player_id: player.player_id ?? sleeperId }) : null;
      })
      .filter((row): row is NonNullable<ReturnType<typeof buildIdentityRowFromSleeperPlayer>> => row !== null);

    if (rows.length === 0) {
      logger.log('identity-hydration-empty', {
        requestId: logger.requestId,
        requested: uniqueMissingIds.length,
      });
      return [];
    }

    await deps.db
      .insert(playerIdentityMap)
      .values(rows as any)
      .onConflictDoNothing();

    logger.log('identity-hydration-complete', {
      requestId: logger.requestId,
      requested: uniqueMissingIds.length,
      hydrated: rows.length,
      sample: rows.slice(0, 5).map((row) => ({ sleeperId: row.sleeperId, canonicalId: row.canonicalId, fullName: row.fullName })),
    });

    return rows as any;
  } catch (error) {
    logger.log('identity-hydration-failed', {
      requestId: logger.requestId,
      requested: uniqueMissingIds.length,
      error: (error as Error).message,
    });
    return [];
  }
}

function resolveRosterPositions(settings: any, fallback: string[] = []) {
  if (!settings) return fallback;
  if (Array.isArray((settings as any).roster_positions)) return (settings as any).roster_positions as string[];
  return fallback;
}

function classifyRosterVisibility(player: Pick<LeagueDashboardPlayer, 'alpha' | 'missingReason' | 'rookieAsset'>): RosterVisibilityState {
  if (typeof player.alpha === 'number') return 'forge_scored';
  if (player.rookieAsset) return 'rookie_alpha_fallback';
  if (player.missingReason === 'unmapped_sleeper_id') return 'unresolved';
  return 'known_unscored';
}

function unavailableReasonForPlayer(player: Pick<LeagueDashboardPlayer, 'alpha' | 'missingReason' | 'rookieAsset'>): string | null {
  if (typeof player.alpha === 'number') return null;
  if (player.missingReason === 'unmapped_sleeper_id') return 'identity_unresolved';
  if (player.missingReason === 'alpha_null') return 'alpha_null';
  if (player.missingReason === 'missing_forge_row' && !player.rookieAsset) return 'rookie_alpha_fallback_unavailable';
  return player.missingReason ?? 'rookie_alpha_fallback_unavailable';
}

function buildRosterCoverageCounts(players: Array<Pick<LeagueDashboardPlayer, 'alpha' | 'missingReason' | 'rookieAsset'>>): RosterCoverageCounts {
  const counts: RosterCoverageCounts = {
    total: players.length,
    forgeScored: 0,
    rookieAlphaFallback: 0,
    knownUnscored: 0,
    unresolved: 0,
    evidenceCovered: 0,
  };

  for (const player of players) {
    const state = classifyRosterVisibility(player);
    if (state === 'forge_scored') counts.forgeScored += 1;
    if (state === 'rookie_alpha_fallback') counts.rookieAlphaFallback += 1;
    if (state === 'known_unscored') counts.knownUnscored += 1;
    if (state === 'unresolved') counts.unresolved += 1;
  }

  counts.evidenceCovered = counts.forgeScored + counts.rookieAlphaFallback;
  return counts;
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

  let identities = rosterPlayerIds.length
    ? await deps.db
        .select()
        .from(playerIdentityMap)
        .where(inArray(playerIdentityMap.sleeperId, rosterPlayerIds))
    : [];

  const initiallyResolvedSleeperIds = new Set(identities.map((id) => String(id.sleeperId)));
  const missingSleeperIds = rosterPlayerIds.filter((id) => !initiallyResolvedSleeperIds.has(id));
  const hydratedIdentities = await hydrateMissingSleeperIdentities(missingSleeperIds, deps, logger);
  if (hydratedIdentities.length > 0) {
    const seenSleeperIds = new Set(identities.map((id) => String(id.sleeperId)));
    identities = [
      ...identities,
      ...hydratedIdentities.filter((id) => id.sleeperId && !seenSleeperIds.has(String(id.sleeperId))),
    ];
  }

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
      const tierFinal = alphaEntry?.row?.tierFinal ?? null;
      return {
        rosterKey,
        canonicalId,
        sleeperId,
        name: identity?.fullName ?? sleeperId,
        pos,
        nflTeam: identity?.nflTeam ?? null,
        alpha,
        tier: typeof tierFinal === 'number' ? tierFinal : null,
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
  const hasPlayersMissingForge = Array.from(teamPlayersMap.values()).some((players) =>
    players.some((player) => player.alpha === null)
  );
  let rookieAssetLookup = new Map<string, RookieAssetContext>();
  if (hasPlayersMissingForge && effectiveSeason !== null) {
    try {
      rookieAssetLookup = await (deps.rookieArtifactService ?? rookieArtifactService).getRookieAssetLookup(Number(effectiveSeason));
    } catch (error) {
      logger.log('rookie-alpha-unavailable', {
        requestId: logger.requestId,
        season: effectiveSeason,
        error: (error as Error).message,
      });
    }
  }

  for (const team of league.teams) {
    const players = teamPlayersMap.get(team.id) ?? [];

    const updatedPlayers = players.map((player) => {
      const updatedAlpha = player.canonicalId ? alphaByPlayer.get(player.canonicalId)?.alpha ?? null : null;
      const missingReason = updatedAlpha === null ? player.missingReason ?? 'missing_forge_row' : null;
      if (updatedAlpha !== null && player.alpha === null) {
        newlyMatchedFromCompute += 1;
      }
      const rookieAsset = updatedAlpha === null ? findRookieAsset(rookieAssetLookup, player) : null;
      const visibilityState = classifyRosterVisibility({ ...player, alpha: updatedAlpha, missingReason, rookieAsset });
      return {
        ...player,
        alpha: updatedAlpha,
        missingReason,
        rookieAsset,
        visibilityState,
        unavailableReason: unavailableReasonForPlayer({ ...player, alpha: updatedAlpha, missingReason, rookieAsset }),
      };
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

  const rosterVisibility = buildRosterCoverageCounts(teams.flatMap((team) => team.roster));

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
      rookieAlphaMatchedCount: rosterVisibility.rookieAlphaFallback,
      forgeScoredCount: rosterVisibility.forgeScored,
      rookieAlphaFallbackCount: rosterVisibility.rookieAlphaFallback,
      knownUnscoredCount: rosterVisibility.knownUnscored,
      unresolvedCount: rosterVisibility.unresolved,
      evidenceCoveredCount: rosterVisibility.evidenceCovered,
      rosterVisibility,
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
    snapshotTrigger: 'weekly_rollover',
    payload,
  });

  return payload;
}
