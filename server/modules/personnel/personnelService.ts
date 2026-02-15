import { and, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '../../infra/db';
import { bronzeNflfastrPlays, playerIdentityMap } from '@shared/schema';
import {
  classifyPersonnelDependency,
  type PersonnelEveryDownGrade,
} from './personnelClassifier';

export type PersonnelBucketCode = '10' | '11' | '12' | '13' | '21' | '22' | 'other';

interface BucketSummary {
  count: number;
  pct: number;
}

export interface PlayerPersonnelProfile {
  playerId: string;
  playerName: string | null;
  position: string | null;
  team: string | null;
  season: number;
  weekStart: number | null;
  weekEnd: number | null;
  totalPlaysCounted: number;
  breakdown: Record<PersonnelBucketCode, BucketSummary>;
  everyDownGrade: PersonnelEveryDownGrade;
  notes: string[];
}

export interface PersonnelProfileQuery {
  season: number;
  weekStart?: number;
  weekEnd?: number;
  team?: string;
  playerIds?: string[];
  position?: 'WR' | 'RB' | 'TE' | 'QB';
  limit?: number;
}

interface UsageAccumulator {
  total: number;
  buckets: Record<PersonnelBucketCode, number>;
  team: string | null;
}

interface BronzeUsagePlayRow {
  offensePersonnel: string;
  posteam: string | null;
  passerPlayerId: string | null;
  rusherPlayerId: string | null;
  receiverPlayerId: string | null;
}

const DEFAULT_LIMIT = 200;
const OFFENSIVE_PLAY_TYPES = ['pass', 'run'] as const;

export function parsePersonnelCode(personnel: string | null): PersonnelBucketCode {
  if (!personnel) return 'other';

  const rbMatch = personnel.match(/(\d+)\s*RB/i);
  const teMatch = personnel.match(/(\d+)\s*TE/i);

  if (!rbMatch || !teMatch) {
    return 'other';
  }

  const rbCount = Number.parseInt(rbMatch[1], 10);
  const teCount = Number.parseInt(teMatch[1], 10);

  if (Number.isNaN(rbCount) || Number.isNaN(teCount)) {
    return 'other';
  }

  const code = `${rbCount}${teCount}` as PersonnelBucketCode;
  const valid: PersonnelBucketCode[] = ['10', '11', '12', '13', '21', '22'];
  return valid.includes(code) ? code : 'other';
}

function createEmptyBuckets(): Record<PersonnelBucketCode, number> {
  return {
    '10': 0,
    '11': 0,
    '12': 0,
    '13': 0,
    '21': 0,
    '22': 0,
    other: 0,
  };
}

function withPct(count: number, total: number): BucketSummary {
  return {
    count,
    pct: total > 0 ? Number((count / total).toFixed(4)) : 0,
  };
}

export async function getPersonnelProfiles(query: PersonnelProfileQuery): Promise<PlayerPersonnelProfile[]> {
  const filters = [
    eq(bronzeNflfastrPlays.season, query.season),
    inArray(bronzeNflfastrPlays.playType, [...OFFENSIVE_PLAY_TYPES]),
    sql`${bronzeNflfastrPlays.offensePersonnel} IS NOT NULL`,
  ];

  if (query.weekStart !== undefined) {
    filters.push(gte(bronzeNflfastrPlays.week, query.weekStart));
  }
  if (query.weekEnd !== undefined) {
    filters.push(lte(bronzeNflfastrPlays.week, query.weekEnd));
  }
  if (query.team) {
    filters.push(eq(bronzeNflfastrPlays.posteam, query.team));
  }
  if (query.playerIds?.length) {
    filters.push(
      or(
        inArray(bronzeNflfastrPlays.receiverPlayerId, query.playerIds),
        inArray(bronzeNflfastrPlays.rusherPlayerId, query.playerIds),
        inArray(bronzeNflfastrPlays.passerPlayerId, query.playerIds),
      )!,
    );
  }

  const plays = await db
    .select({
      offensePersonnel: bronzeNflfastrPlays.offensePersonnel,
      posteam: bronzeNflfastrPlays.posteam,
      passerPlayerId: bronzeNflfastrPlays.passerPlayerId,
      rusherPlayerId: bronzeNflfastrPlays.rusherPlayerId,
      receiverPlayerId: bronzeNflfastrPlays.receiverPlayerId,
    })
    .from(bronzeNflfastrPlays)
    .where(and(...filters)) as BronzeUsagePlayRow[];

  const usageByPlayer = new Map<string, UsageAccumulator>();

  for (const play of plays) {
    const bucket = parsePersonnelCode(play.offensePersonnel);
    const playerIds = new Set([play.passerPlayerId, play.rusherPlayerId, play.receiverPlayerId].filter(Boolean) as string[]);

    for (const playerId of playerIds) {
      const current = usageByPlayer.get(playerId) ?? {
        total: 0,
        buckets: createEmptyBuckets(),
        team: play.posteam,
      };

      current.total += 1;
      current.buckets[bucket] += 1;
      if (!current.team && play.posteam) {
        current.team = play.posteam;
      }

      usageByPlayer.set(playerId, current);
    }
  }

  const playerIds = [...usageByPlayer.keys()];
  if (!playerIds.length) {
    return [];
  }

  const identityWhere = [inArray(playerIdentityMap.gsisId, playerIds)];
  if (query.position) {
    identityWhere.push(eq(playerIdentityMap.position, query.position));
  }

  const identityRows = await db
    .select({
      gsisId: playerIdentityMap.gsisId,
      fullName: playerIdentityMap.fullName,
      position: playerIdentityMap.position,
      nflTeam: playerIdentityMap.nflTeam,
    })
    .from(playerIdentityMap)
    .where(and(...identityWhere));

  const identityByGsis = new Map(identityRows.filter(r => r.gsisId).map(r => [r.gsisId as string, r]));

  const profiles: PlayerPersonnelProfile[] = [];
  for (const [playerId, usage] of usageByPlayer.entries()) {
    const identity = identityByGsis.get(playerId);

    if (query.position && !identity) {
      continue;
    }

    const breakdown: PlayerPersonnelProfile['breakdown'] = {
      '10': withPct(usage.buckets['10'], usage.total),
      '11': withPct(usage.buckets['11'], usage.total),
      '12': withPct(usage.buckets['12'], usage.total),
      '13': withPct(usage.buckets['13'], usage.total),
      '21': withPct(usage.buckets['21'], usage.total),
      '22': withPct(usage.buckets['22'], usage.total),
      other: withPct(usage.buckets.other, usage.total),
    };

    profiles.push({
      playerId,
      playerName: identity?.fullName ?? null,
      position: identity?.position ?? null,
      team: identity?.nflTeam ?? usage.team,
      season: query.season,
      weekStart: query.weekStart ?? null,
      weekEnd: query.weekEnd ?? null,
      totalPlaysCounted: usage.total,
      breakdown,
      everyDownGrade: classifyPersonnelDependency({
        totalPlaysCounted: usage.total,
        elevenPct: breakdown['11'].pct,
        twelvePct: breakdown['12'].pct,
        thirteenPct: breakdown['13'].pct,
      }),
      notes: ['usage-based v1; not snap participation'],
    });
  }

  const limit = query.limit ?? DEFAULT_LIMIT;
  return profiles
    .sort((a, b) => b.totalPlaysCounted - a.totalPlaysCounted)
    .slice(0, limit);
}

export async function getPersonnelProfile(query: PersonnelProfileQuery & { playerIds: string[] }): Promise<PlayerPersonnelProfile | null> {
  const profiles = await getPersonnelProfiles({ ...query, limit: 1 });
  return profiles[0] ?? null;
}
