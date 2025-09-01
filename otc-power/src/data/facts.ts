import { PlayerFacts } from '../core/types.js';
import { db } from '../infra/db.js';

export async function upsertFacts(f: PlayerFacts) {
  await db.query(
    `insert into player_week_facts
     (player_id, season, week, usage_now, talent, environment, availability, market_anchor,
      power_score, confidence, flags, last_update)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     on conflict (player_id, season, week)
     do update set usage_now=$4, talent=$5, environment=$6, availability=$7, market_anchor=$8,
       power_score=$9, confidence=$10, flags=$11, last_update=now()`,
    [f.player_id, f.season, f.week, f.usage_now, f.talent, f.environment, f.availability, f.market_anchor,
     f.power_score, f.confidence, f.flags]
  );
}

export async function getPlayerFacts(player_id: string, season: number, week?: number) {
  const whereClause = week ? 'and week = $3' : '';
  const params = week ? [player_id, season, week] : [player_id, season];
  
  const result = await db.query(
    `select * from player_week_facts 
     where player_id = $1 and season = $2 ${whereClause}
     order by week desc`,
    params
  );
  
  return result.rows;
}

export async function getLastWeekScore(player_id: string, season: number, week: number): Promise<number | undefined> {
  const result = await db.query(
    `select power_score from player_week_facts 
     where player_id = $1 and season = $2 and week = $3`,
    [player_id, season, week - 1]
  );
  
  return result.rows[0]?.power_score;
}