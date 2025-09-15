import { Router } from 'express';
const r = Router();

// Always return valid shapes; empty is fine, crash is not.
r.get('/usage-leaders', async (_req, res) => {
  return res.json({ players: [] as Array<{player_id:string; full_name:string; target_pct:number; snap_pct:number}> });
});

r.get('/rookies', async (_req, res) => {
  return res.json([
    // Example shape:
    // { full:'Marvin Harrison Jr', team:'ARI', ppr:0, targets:0, rec:0, college:'Ohio State', depth_chart:'WR2' }
  ]);
});

r.get('/redraft/rankings', async (_req, res) => {
  return res.json({ rankings: [] as Array<{player_id:string; full_name:string; team:string; rank:number}> });
});

r.get('/dynasty/value', async (_req, res) => {
  return res.json({ values: [] as Array<{player_id:string; full_name:string; team:string; value:number; tier?:string}> });
});

r.get('/analytics/vorp', async (req, res) => {
  const { season='2025', pos='WR' } = req.query as any;
  return res.json({
    season, pos,
    rows: [] as Array<{player_id:string; full_name:string; team:string; age:number; tier:string; adp?:number; vorp:number}>
  });
});

r.get('/player-pool', async (_req, res) => {
  return res.json([] as Array<{player_id:string; first_name:string; last_name:string; full_name:string; team:string}>);
});

export default r;