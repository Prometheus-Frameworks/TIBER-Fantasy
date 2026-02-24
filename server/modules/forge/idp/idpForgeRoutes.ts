import { Router, Request, Response } from 'express';
import { db } from '../../../infra/db';
import { sql } from 'drizzle-orm';
import { runIdpForgeEngine, runIdpForgeThroughWeek } from './idpForgeEngine';
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
    const errors: string[] = [];
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
        else if (errors.length < 5) errors.push(String((r as PromiseRejectedResult).reason?.message || r.reason));
      }
    }

    results.sort((a, b) => b.alpha - a.alpha);
    const totalAttempted = rows.rows.length;

    res.json({
      season,
      position_group: posGroup,
      count: results.length,
      players: results,
      ...(errors.length > 0 && { warnings: { failed: totalAttempted - results.length, sampleErrors: errors } }),
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

router.get('/replay', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const posGroup = (req.query.position_group as string || '').toUpperCase() as DefensivePosition;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    if (!IDP_POSITIONS.includes(posGroup)) {
      return res.status(400).json({ error: `Invalid position_group. Must be one of: ${IDP_POSITIONS.join(', ')}` });
    }

    const maxWeekResult = await db.execute(sql`
      SELECT MAX(week) as max_week FROM idp_player_week WHERE season = ${season} AND position_group = ${posGroup}
    `);
    const maxWeek = Number((maxWeekResult.rows[0] as any)?.max_week) || 18;

    const playerRows = await db.execute(sql`
      SELECT gsis_id, MAX(player_name) as player_name, MAX(team) as team, SUM(havoc_events) as total_havoc
      FROM idp_player_week
      WHERE season = ${season} AND position_group = ${posGroup}
      GROUP BY gsis_id
      HAVING SUM(defense_snaps) >= 100
      ORDER BY total_havoc DESC
      LIMIT ${limit}
    `);

    const players = playerRows.rows as Array<Record<string, any>>;
    const results: any[] = [];

    const concurrency = 5;
    const queue = [...players];
    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(async (p) => {
          const weeklyAlphas: Array<{ week: number; alpha: number; tier: string; games: number }> = [];
          for (let w = 1; w <= maxWeek; w++) {
            const result = await runIdpForgeThroughWeek(p.gsis_id, posGroup, season, w);
            if (result && result.totalSnaps >= 10) {
              weeklyAlphas.push({ week: w, alpha: result.alpha, tier: result.tier, games: result.gamesPlayed });
            }
          }
          if (weeklyAlphas.length === 0) return null;
          const latest = weeklyAlphas[weeklyAlphas.length - 1];
          const prev = weeklyAlphas.length >= 2 ? weeklyAlphas[weeklyAlphas.length - 2] : null;
          const delta = prev ? Math.round((latest.alpha - prev.alpha) * 10) / 10 : 0;
          return {
            gsis_id: p.gsis_id,
            player_name: p.player_name,
            team: p.team,
            position_group: posGroup,
            current_alpha: latest.alpha,
            current_tier: latest.tier,
            week_delta: delta,
            trend: weeklyAlphas,
          };
        })
      );
      for (const r of batchResults) {
        if (r.status === 'fulfilled' && r.value) results.push(r.value);
      }
    }

    results.sort((a, b) => b.current_alpha - a.current_alpha);

    const risers = [...results].filter(p => p.week_delta > 0).sort((a, b) => b.week_delta - a.week_delta).slice(0, 10);
    const fallers = [...results].filter(p => p.week_delta < 0).sort((a, b) => a.week_delta - b.week_delta).slice(0, 10);

    res.json({
      season,
      position_group: posGroup,
      max_week: maxWeek,
      count: results.length,
      players: results,
      movers: { risers, fallers },
    });
  } catch (err: any) {
    console.error('[IDP FORGE] Replay error:', err);
    res.status(500).json({ error: 'Failed to compute IDP FORGE replay', detail: err.message });
  }
});

router.get('/weeks', async (req: Request, res: Response) => {
  try {
    const season = parseInt(req.query.season as string) || 2025;
    const result = await db.execute(sql`
      SELECT DISTINCT week FROM idp_player_week WHERE season = ${season} ORDER BY week
    `);
    const weeks = (result.rows as any[]).map(r => Number(r.week));
    res.json({ season, weeks });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch weeks', detail: err.message });
  }
});

export default router;
