import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';
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

const DEFAULT_LIMIT = 200;

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

function withPct(count: number, total: number): BucketSummary {
  return {
    count,
    pct: total > 0 ? Number((count / total).toFixed(4)) : 0,
  };
}

interface AggRow {
  player_id: string;
  team: string | null;
  total_plays: string;
  p10: string;
  p11: string;
  p12: string;
  p13: string;
  p21: string;
  p22: string;
  p_other: string;
}

export async function getPersonnelProfiles(query: PersonnelProfileQuery): Promise<PlayerPersonnelProfile[]> {
  const limit = query.limit ?? DEFAULT_LIMIT;

  const conditions: string[] = [
    `p.season = ${Number(query.season)}`,
    `p.play_type IN ('pass', 'run')`,
    `p.offense_personnel IS NOT NULL`,
  ];

  if (query.weekStart !== undefined) {
    conditions.push(`p.week >= ${Number(query.weekStart)}`);
  }
  if (query.weekEnd !== undefined) {
    conditions.push(`p.week <= ${Number(query.weekEnd)}`);
  }
  if (query.team) {
    conditions.push(`p.posteam = '${query.team.replace(/'/g, "''")}'`);
  }

  const whereClause = conditions.join(' AND ');

  const personnelBucketCase = `
    CASE
      WHEN offense_personnel ~ '(^|, )1 RB' AND offense_personnel ~ '(^|, )0 TE' THEN '10'
      WHEN offense_personnel ~ '(^|, )1 RB' AND offense_personnel ~ '(^|, )1 TE' THEN '11'
      WHEN offense_personnel ~ '(^|, )1 RB' AND offense_personnel ~ '(^|, )2 TE' THEN '12'
      WHEN offense_personnel ~ '(^|, )1 RB' AND offense_personnel ~ '(^|, )3 TE' THEN '13'
      WHEN offense_personnel ~ '(^|, )2 RB' AND offense_personnel ~ '(^|, )1 TE' THEN '21'
      WHEN offense_personnel ~ '(^|, )2 RB' AND offense_personnel ~ '(^|, )2 TE' THEN '22'
      WHEN offense_personnel ~ '(^|, )1 RB' AND offense_personnel NOT LIKE '%TE%' THEN '10'
      ELSE 'other'
    END
  `;

  const positionFilter = query.position
    ? `AND pim.position = '${query.position.replace(/'/g, "''")}'`
    : '';

  const playerIdFilter = query.playerIds?.length
    ? `AND bp.gsis_id IN (${query.playerIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',')})`
    : '';

  const aggQuery = `
    WITH play_buckets AS (
      SELECT
        bp.gsis_id AS player_id,
        p.posteam,
        ${personnelBucketCase} AS bucket
      FROM bronze_pbp_participation bp
      JOIN bronze_nflfastr_plays p
        ON p.game_id = bp.game_id AND p.play_id = bp.play_id
      WHERE bp.season = ${Number(query.season)}
        AND ${whereClause}
        ${playerIdFilter}
    ),
    agg AS (
      SELECT
        pb.player_id,
        MAX(pb.posteam) AS team,
        COUNT(*) AS total_plays,
        COUNT(*) FILTER (WHERE pb.bucket = '10') AS p10,
        COUNT(*) FILTER (WHERE pb.bucket = '11') AS p11,
        COUNT(*) FILTER (WHERE pb.bucket = '12') AS p12,
        COUNT(*) FILTER (WHERE pb.bucket = '13') AS p13,
        COUNT(*) FILTER (WHERE pb.bucket = '21') AS p21,
        COUNT(*) FILTER (WHERE pb.bucket = '22') AS p22,
        COUNT(*) FILTER (WHERE pb.bucket = 'other') AS p_other
      FROM play_buckets pb
      GROUP BY pb.player_id
    )
    SELECT
      a.player_id,
      a.team,
      a.total_plays,
      a.p10, a.p11, a.p12, a.p13, a.p21, a.p22, a.p_other,
      pim.full_name,
      pim.position,
      pim.nfl_team
    FROM agg a
    JOIN player_identity_map pim ON pim.gsis_id = a.player_id
    WHERE 1=1 ${positionFilter}
    ORDER BY a.total_plays DESC
    LIMIT ${limit}
  `;

  const result = await db.execute(sql.raw(aggQuery));
  const rows = result.rows as any[];

  return rows.map((row) => {
    const total = Number(row.total_plays);
    const buckets = {
      '10': Number(row.p10),
      '11': Number(row.p11),
      '12': Number(row.p12),
      '13': Number(row.p13),
      '21': Number(row.p21),
      '22': Number(row.p22),
      'other': Number(row.p_other),
    };

    const breakdown: PlayerPersonnelProfile['breakdown'] = {
      '10': withPct(buckets['10'], total),
      '11': withPct(buckets['11'], total),
      '12': withPct(buckets['12'], total),
      '13': withPct(buckets['13'], total),
      '21': withPct(buckets['21'], total),
      '22': withPct(buckets['22'], total),
      other: withPct(buckets['other'], total),
    };

    return {
      playerId: row.player_id,
      playerName: row.full_name ?? null,
      position: row.position ?? null,
      team: row.nfl_team ?? row.team ?? null,
      season: query.season,
      weekStart: query.weekStart ?? null,
      weekEnd: query.weekEnd ?? null,
      totalPlaysCounted: total,
      breakdown,
      everyDownGrade: classifyPersonnelDependency({
        totalPlaysCounted: total,
        elevenPct: breakdown['11'].pct,
        twelvePct: breakdown['12'].pct,
        thirteenPct: breakdown['13'].pct,
      }),
      notes: ['v2: participation-based via nflverse pbp_participation'],
    };
  });
}

export async function getPersonnelProfile(query: PersonnelProfileQuery & { playerIds: string[] }): Promise<PlayerPersonnelProfile | null> {
  const profiles = await getPersonnelProfiles({ ...query, limit: 1 });
  return profiles[0] ?? null;
}
