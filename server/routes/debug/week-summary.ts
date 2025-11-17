import { Router, Request, Response } from 'express';
import { pool } from '../../infra/db';

const router = Router();

const SCORING_COLUMN_MAP: Record<string, string> = {
  std: 'fantasy_points_std',
  half: 'fantasy_points_half',
  ppr: 'fantasy_points_ppr',
};

router.get('/week-summary', async (req: Request, res: Response) => {
  try {
    const seasonRaw = req.query.season as string;
    const weekRaw = req.query.week as string;
    const posRaw = req.query.pos as string;
    const scoringRaw = (req.query.scoring as string) || 'half';

    const season = parseInt(seasonRaw, 10);
    const week = parseInt(weekRaw, 10);
    const pos = posRaw?.toUpperCase();
    const scoring = scoringRaw.toLowerCase();

    if (!season || !week || !pos) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query params: season, week, pos',
      });
    }

    if (week < 1 || week > 18) {
      return res.status(400).json({
        success: false,
        error: 'Week must be between 1 and 18',
      });
    }

    if (!['QB', 'RB', 'WR', 'TE'].includes(pos)) {
      return res.status(400).json({
        success: false,
        error: 'pos must be one of QB, RB, WR, TE',
      });
    }

    const scoringColumn = SCORING_COLUMN_MAP[scoring];
    if (!scoringColumn) {
      return res.status(400).json({
        success: false,
        error: 'scoring must be one of std, half, ppr',
      });
    }

    const query = `
      SELECT *
      FROM weekly_stats
      WHERE season = $1
        AND week = $2
        AND position = $3
        AND ${scoringColumn} IS NOT NULL
        AND ${scoringColumn} > 0
      ORDER BY ${scoringColumn} DESC
      LIMIT 20
    `;

    const { rows } = await pool.query(query, [season, week, pos]);

    const data = rows.map((row: any) => {
      const playerId = row.player_id ?? null;
      const playerName = row.player_name ?? null;
      const team = row.team ?? null;
      const position = row.position ?? pos;

      const rushYds = row.rush_yd ?? 0;
      const recYds = row.rec_yd ?? 0;
      const passYds = row.pass_yd ?? 0;

      const rushTds = row.rush_td ?? 0;
      const recTds = row.rec_td ?? 0;
      const passTds = row.pass_td ?? 0;

      const totalTds = (rushTds || 0) + (recTds || 0) + (passTds || 0);

      return {
        season: row.season,
        week: row.week,
        position,
        playerId,
        playerName,
        team,
        fantasyPoints: {
          std: row.fantasy_points_std ?? null,
          half: row.fantasy_points_half ?? null,
          ppr: row.fantasy_points_ppr ?? null,
          used: row[scoringColumn],
        },
        stats: {
          passYds,
          rushYds,
          recYds,
          passTds,
          rushTds,
          recTds,
          totalTds,
        },
        raw: row,
      };
    });

    return res.json({
      success: true,
      season,
      week,
      pos,
      scoring,
      count: data.length,
      data,
    });
  } catch (err: any) {
    console.error('[week-summary] error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error in week-summary endpoint',
    });
  }
});

export default router;
