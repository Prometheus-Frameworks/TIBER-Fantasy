import express from 'express';
import { computeLeagueDashboard } from '../services/leagueDashboardService';

export function createLeagueDashboardRouter() {
  const router = express.Router();

  router.get('/api/league-dashboard', async (req, res) => {
    try {
      const { user_id = 'default_user', league_id, week, season, refresh } = req.query;
      if (!league_id) {
        return res.status(400).json({ success: false, error: 'league_id is required' });
      }

      const payload = await computeLeagueDashboard({
        userId: user_id as string,
        leagueId: league_id as string,
        week: week ? Number(week) : null,
        season: season ? Number(season) : null,
        refresh: refresh === '1' || refresh === 'true',
      });

      res.json(payload);
    } catch (error) {
      console.error('[League Dashboard] failed to compute', error);
      res.status(500).json({ success: false, error: (error as Error).message || 'Failed to load league dashboard' });
    }
  });

  return router;
}

export const leagueDashboardRouter = createLeagueDashboardRouter();
