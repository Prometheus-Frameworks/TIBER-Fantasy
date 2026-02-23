import { db } from '../../../infra/db';
import { sql } from 'drizzle-orm';

export interface ResolvedPlayerId {
  canonicalId: string;
  statsId: string;
  playerName: string;
  nflTeam?: string;
}

export async function resolvePlayerId(canonicalId: string): Promise<ResolvedPlayerId> {
  const result = await db.execute(sql`
    SELECT nfl_data_py_id, gsis_id, full_name, nfl_team
    FROM player_identity_map
    WHERE canonical_id = ${canonicalId}
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return {
      canonicalId,
      statsId: canonicalId,
      playerName: 'Unknown',
    };
  }

  const row = result.rows[0] as Record<string, any>;
  return {
    canonicalId,
    statsId: row.nfl_data_py_id || row.gsis_id || canonicalId,
    playerName: row.full_name || 'Unknown',
    nflTeam: row.nfl_team || undefined,
  };
}
