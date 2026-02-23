import { Router, Request, Response } from 'express';
import { db } from '../../../infra/db';
import { sql } from 'drizzle-orm';
import { runIdpForgeEngine } from './idpForgeEngine';
import { IDP_POSITIONS, mapHavocToTier, type DefensivePosition } from '@shared/idpSchema';

const router = Router();

router.get('/batch', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2024;
    const posGroup = (req.query.position_group as string || '').toUpperCase() as DefensivePosition;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    if (!IDP_POSITIONS.includes(posGroup)) {
      return res.status(400).json({ error: `Invalid position_group. Must be one of: ${IDP_POSITIONS.join(', ')}` });
    }

    const rows = await db.execute(sql`
      SELECT gsis_id, position_group
      FROM idp_player_season
      WHERE season = ${season} AND position_group = ${posGroup} AND total_snaps >= 100
      ORDER BY havoc_index DESC NULLS LAST
      LIMIT ${limit}
    `);

    const results: any[] = [];
    const concurrency = 10;
    const queue = [...(rows.rows as any[])];

    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(async (row: any) => {
          const output = await runIdpForgeEngine(row.gsis_id, posGroup, season, 'season');
          const alpha = Number(output.rawMetrics?.calibrated_alpha ?? 0);
          const tier = mapHavocToTier(alpha);
          return {
            gsis_id: output.playerId,
            player_name: output.playerName,
            team: output.nflTeam ?? null,
            position_group: posGroup,
            alpha: Math.round(alpha * 10) / 10,
            tier,
            pillars: output.pillars,
            games_played: output.gamesPlayed,
            total_snaps: Number(output.rawMetrics?.total_snaps ?? 0),
            havoc_index: Number(output.rawMetrics?.havoc_index ?? 0),
          };
        })
      );
      for (const r of batchResults) {
        if (r.status === 'fulfilled') results.push(r.value);
      }
    }

    results.sort((a, b) => b.alpha - a.alpha);

    res.json({
      season,
      position_group: posGroup,
      count: results.length,
      players: results,
    });
  } catch (err: any) {
    console.error('[IDP FORGE] Batch error:', err);
    res.status(500).json({ error: 'Failed to compute IDP FORGE batch', detail: err.message });
  }
});

router.get('/player/:gsisId', async (req: Request, res: Response) => {
  try {
    const { gsisId } = req.params;
    const season = parseInt(req.query.season as string) || 2024;

    const seasonRow = await db.execute(sql`
      SELECT position_group FROM idp_player_season
      WHERE gsis_id = ${gsisId} AND season = ${season}
      LIMIT 1
    `);

    if (!seasonRow.rows.length) {
      return res.status(404).json({ error: 'IDP player not found for this season' });
    }

    const posGroup = (seasonRow.rows[0] as any).position_group as DefensivePosition;
    const output = await runIdpForgeEngine(gsisId, posGroup, season, 'season');
    const alpha = Number(output.rawMetrics?.calibrated_alpha ?? 0);
    const tier = mapHavocToTier(alpha);

    res.json({
      gsis_id: output.playerId,
      player_name: output.playerName,
      team: output.nflTeam ?? null,
      position_group: posGroup,
      season,
      alpha: Math.round(alpha * 10) / 10,
      tier,
      pillars: output.pillars,
      games_played: output.gamesPlayed,
      raw_metrics: {
        total_snaps: Number(output.rawMetrics?.total_snaps ?? 0),
        tackles_total: Number(output.rawMetrics?.tackles_total ?? 0),
        sacks: Number(output.rawMetrics?.sacks ?? 0),
        tackles_for_loss: Number(output.rawMetrics?.tackles_for_loss ?? 0),
        qb_hits: Number(output.rawMetrics?.qb_hits ?? 0),
        passes_defended: Number(output.rawMetrics?.passes_defended ?? 0),
        forced_fumbles: Number(output.rawMetrics?.forced_fumbles ?? 0),
        interceptions: Number(output.rawMetrics?.interceptions ?? 0),
        havoc_index: Number(output.rawMetrics?.havoc_index ?? 0),
        havoc_smoothed_rate: Number(output.rawMetrics?.havoc_smoothed_rate ?? 0),
      },
    });
  } catch (err: any) {
    console.error('[IDP FORGE] Player error:', err);
    res.status(500).json({ error: 'Failed to compute IDP FORGE player score', detail: err.message });
  }
});

export default router;
