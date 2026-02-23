import { db } from '../../../infra/db';
import { sql } from 'drizzle-orm';
import type { DefensivePosition } from '@shared/idpSchema';

export type TeamDefenseScheme = {
  team: string;
  season: number;
  base_defense: '4-3' | '3-4' | 'hybrid';
  nickel_rate: number;
  dime_rate: number;
  avg_dl_count: number;
  avg_lb_count: number;
  avg_db_count: number;
};

export function parseDefensePersonnel(personnel: string): { dl: number; lb: number; db: number } {
  let dl = 0;
  let lb = 0;
  let db = 0;
  const regex = /(\d+)\s+(DE|DT|NT|ILB|MLB|OLB|LB|CB|FS|SS|S|DB|NB)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(personnel)) !== null) {
    const n = Number(m[1]);
    const p = m[2];
    if (['DE', 'DT', 'NT'].includes(p)) dl += n;
    else if (['ILB', 'MLB', 'OLB', 'LB'].includes(p)) lb += n;
    else db += n;
  }
  return { dl, lb, db };
}

export async function deriveTeamDefenseScheme(team: string, season: number): Promise<TeamDefenseScheme | null> {
  const result = await db.execute(sql`
    SELECT defense_personnel
    FROM bronze_nflfastr_plays
    WHERE season = ${season} AND defteam = ${team} AND defense_personnel IS NOT NULL
  `);
  if (!result.rows.length) return null;

  let total = 0;
  let dl = 0;
  let lb = 0;
  let dbCount = 0;
  let nickel = 0;
  let dime = 0;
  for (const row of result.rows as Array<Record<string, any>>) {
    const parsed = parseDefensePersonnel(String(row.defense_personnel || ''));
    if (parsed.dl + parsed.lb + parsed.db === 0) continue;
    total += 1;
    dl += parsed.dl;
    lb += parsed.lb;
    dbCount += parsed.db;
    if (parsed.db >= 5) nickel += 1;
    if (parsed.db >= 6) dime += 1;
  }
  if (!total) return null;
  const avgDl = dl / total;
  return {
    team,
    season,
    base_defense: avgDl >= 3.8 ? '4-3' : avgDl <= 3.2 ? '3-4' : 'hybrid',
    nickel_rate: nickel / total,
    dime_rate: dime / total,
    avg_dl_count: avgDl,
    avg_lb_count: lb / total,
    avg_db_count: dbCount / total,
  };
}

export function computeSchemeFitScore(position: DefensivePosition, scheme: TeamDefenseScheme | null, opponentQualityScore: number): number {
  let score = 50;
  if (!scheme) return score;
  if (position === 'EDGE' && scheme.base_defense === '3-4') score += 5;
  if (position === 'LB' && scheme.nickel_rate > 0.6) score += 3;
  if ((position === 'CB' || position === 'S') && opponentQualityScore >= 60) score += 3;
  return Math.max(0, Math.min(100, score));
}
