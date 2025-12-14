import { storage, type IStorage } from '../storage';
import { sleeperClient, type SleeperRoster } from '../integrations/sleeperClient';
import { db } from '../infra/db';
import { forgePlayerState, playerIdentityMap } from '@shared/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

const BENCH_WEIGHT = 0.15;
const CACHE_TTL_MS = 30 * 60 * 1000;

export type LeagueDashboardTeam = {
  team_id: string;
  display_name: string;
  totals: { QB: number; RB: number; WR: number; TE: number };
  overall_total: number;
  starters_used: Array<{ canonicalId: string; name: string; pos: string; alpha: number }>;
  roster: Array<{ canonicalId: string; name: string; pos: string; alpha: number; usedAsStarter: boolean }>;
};

export type LeagueDashboardPayload = {
  success: true;
  meta: { league_id: string; week: number | null; season: number | null; computed_at: string; cached: boolean };
  teams: LeagueDashboardTeam[];
};

type LeagueDashboardParams = {
  userId: string;
  leagueId: string;
  week?: number | null;
  season?: number | null;
  refresh?: boolean;
};

type LeagueDashboardDeps = {
  storage: IStorage;
  sleeperClient: typeof sleeperClient;
  db: typeof db;
};

const defaultDeps: LeagueDashboardDeps = {
  storage,
  sleeperClient,
  db,
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

function buildLineup(players: Array<{ canonicalId: string; name: string; pos: string; alpha: number }>, rosterPositions: string[]) {
  const counts = countPositions(rosterPositions);
  const totals = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const startersUsed: Array<{ canonicalId: string; name: string; pos: string; alpha: number }> = [];
  const used = new Set<string>();

  const sorted = [...players].sort((a, b) => (b.alpha ?? 0) - (a.alpha ?? 0));

  function takePlayers(pos: string, count: number) {
    for (const player of sorted) {
      if (count <= 0) break;
      if (used.has(player.canonicalId)) continue;
      if (player.pos !== pos) continue;
      used.add(player.canonicalId);
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
      if (used.has(player.canonicalId)) continue;
      if (!predicate(player)) continue;
      used.add(player.canonicalId);
      startersUsed.push(player);
      totals[player.pos as keyof typeof totals] += player.alpha ?? 0;
      count -= 1;
    }
  }

  takeFlex(counts.FLEX, flexEligible);
  takeFlex(counts.SUPER_FLEX, superFlexEligible);

  const roster = sorted.map((player) => ({
    ...player,
    usedAsStarter: used.has(player.canonicalId),
  }));

  const benchSum = roster
    .filter((p) => !p.usedAsStarter)
    .reduce((sum, p) => sum + (p.alpha ?? 0), 0);

  const overall = Object.values(totals).reduce((sum, val) => sum + val, 0) + BENCH_WEIGHT * benchSum;

  return { totals, startersUsed, roster, overallTotal: overall };
}

export async function computeLeagueDashboard(
  params: LeagueDashboardParams,
  deps: LeagueDashboardDeps = defaultDeps
): Promise<LeagueDashboardPayload> {
  const { userId, leagueId } = params;
  const targetWeek = params.week ?? null;
  const targetSeason = params.season ?? null;
  const refresh = Boolean(params.refresh);

  const league = await deps.storage.getLeagueWithTeams(leagueId);
  if (!league || (league as any).userId !== userId && (league as any).user_id !== userId) {
    throw new Error('League not found');
  }

  const snapshot = refresh
    ? null
    : await deps.storage.getLeagueDashboardSnapshot(leagueId, targetSeason ?? league.season ?? null, targetWeek);

  if (snapshot && snapshot.computedAt) {
    const computedAtMs = new Date(snapshot.computedAt).getTime();
    if (Date.now() - computedAtMs < CACHE_TTL_MS) {
      const payload = snapshot.payload as LeagueDashboardPayload;
      return {
        ...payload,
        meta: {
          ...(payload.meta ?? {}),
          computed_at: snapshot.computedAt instanceof Date ? snapshot.computedAt.toISOString() : new Date(snapshot.computedAt).toISOString(),
          cached: true,
        },
      };
    }
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

  const positionsRaw = rosterPositions.length > 0 ? rosterPositions : resolveRosterPositions(latestLeague, []);
  const positions = positionsRaw.length > 0
    ? positionsRaw
    : ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX'];

  const rosterByOwner = new Map<string, SleeperRoster>();
  rosters.forEach((roster) => {
    rosterByOwner.set(String(roster.owner_id), roster);
  });

  const allSleeperPlayerIds = Array.from(
    new Set(
      rosters.flatMap((r) => (r.players ?? []).map((pid) => String(pid)))
    )
  );

  const identities = allSleeperPlayerIds.length
    ? await deps.db
        .select()
        .from(playerIdentityMap)
        .where(inArray(playerIdentityMap.sleeperId, allSleeperPlayerIds))
    : [];

  const identityBySleeperId = new Map(identities.map((id) => [String(id.sleeperId), id]));
  const canonicalIds = identities.map((id) => id.canonicalId);

  const conditions = [inArray(forgePlayerState.playerId, canonicalIds) as any];
  const targetSeasonFilter = targetSeason ?? (league as any).season ?? null;
  if (targetSeasonFilter !== null) {
    conditions.push(eq(forgePlayerState.season, Number(targetSeasonFilter)) as any);
  }

  const alphaRows = canonicalIds.length
    ? await deps.db
        .select()
        .from(forgePlayerState)
        .where((conditions.length > 1 ? and(...conditions.filter(Boolean)) : conditions[0]) as any)
        .orderBy(desc(forgePlayerState.season), desc(forgePlayerState.week), desc(forgePlayerState.computedAt))
    : [];

  const alphaByPlayer = new Map<string, { alpha: number }>();
  for (const row of alphaRows) {
    if (alphaByPlayer.has(row.playerId)) continue;
    alphaByPlayer.set(row.playerId, { alpha: Number(row.alphaFinal ?? row.alphaRaw ?? 0) });
  }

  const teams: LeagueDashboardTeam[] = [];

  for (const team of league.teams) {
    const externalUserId = normalizeExternalId((team as any).externalUserId ?? (team as any).external_user_id);
    const roster = externalUserId ? rosterByOwner.get(externalUserId) : undefined;
    const sleeperPlayers = roster?.players ?? [];

    const players = sleeperPlayers.map((pid) => {
      const identity = identityBySleeperId.get(String(pid));
      const canonicalId = identity?.canonicalId ?? `sleeper:${pid}`;
      const pos = identity?.position ?? 'FLEX';
      const alpha = alphaByPlayer.get(canonicalId)?.alpha ?? 0;
      return {
        canonicalId,
        name: identity?.fullName ?? String(pid),
        pos,
        alpha,
      };
    });

    const { totals, startersUsed, roster: rosterRows, overallTotal } = buildLineup(players, positions);

    teams.push({
      team_id: team.id,
      display_name: (team as any).displayName ?? (team as any).display_name ?? 'Team',
      totals,
      overall_total: overallTotal,
      starters_used: startersUsed,
      roster: rosterRows,
    });
  }

  const payload: LeagueDashboardPayload = {
    success: true,
    meta: {
      league_id: leagueId,
      week: targetWeek,
      season: targetSeason ?? league.season ?? null,
      computed_at: new Date().toISOString(),
      cached: false,
    },
    teams,
  };

  await deps.storage.saveLeagueDashboardSnapshot({
    leagueId,
    season: payload.meta.season,
    week: payload.meta.week,
    payload,
  });

  return payload;
}
