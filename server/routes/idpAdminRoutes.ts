import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../middleware/adminAuth';
import { ingestIdpWeeklyStats } from '../modules/forge/idp/idpIngestion';
import { computeIdpBaselines } from '../modules/forge/idp/idpBaselines';
import { db } from '../infra/db';
import { sql } from 'drizzle-orm';

const router = Router();
router.use(requireAdminAuth);

router.post('/ingest', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season || req.body?.season || 2024);
    const result = await ingestIdpWeeklyStats([season]);
    res.json({ success: true, season, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'IDP_INGEST_FAILED' });
  }
});

router.post('/baselines', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season || req.body?.season || 2024);
    const upserts = await computeIdpBaselines(season);
    res.json({ success: true, season, upserts });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'IDP_BASELINES_FAILED' });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const season = Number(req.query.season || 2024);
    const weekly = await db.execute(sql`SELECT position_group, COUNT(*)::int as count FROM idp_player_week WHERE season = ${season} GROUP BY position_group ORDER BY position_group`);
    const seasonRows = await db.execute(sql`SELECT COUNT(*)::int as count FROM idp_player_season WHERE season = ${season}`);
    const baselines = await db.execute(sql`SELECT COUNT(*)::int as count FROM idp_position_baselines WHERE season = ${season}`);
    res.json({
      success: true,
      season,
      weeklyByGroup: weekly.rows,
      seasonCount: Number((seasonRows.rows[0] as any)?.count || 0),
      baselineCount: Number((baselines.rows[0] as any)?.count || 0),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'IDP_STATUS_FAILED' });
  }
});

export default router;
