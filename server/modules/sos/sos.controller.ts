import { Request, Response } from 'express';
import { computeWeeklySOS, computeROSSOS, computeWeeklySOSv2, parseWeights, normalizeWeights } from './sos.service';
import type { Position, Mode, Weights } from './sos.service';

export const getWeekly = async (req: Request, res: Response) => {
  try {
    const position = (req.query.position as Position) || 'RB';
    const week = parseInt((req.query.week as string) || '1', 10);
    const season = parseInt((req.query.season as string) || '2024', 10);
    const mode = ((req.query.mode as string) || 'fpa') as Mode;
    const weights = normalizeWeights(parseWeights(req.query.weights as string | undefined));
    const debug = req.query.debug === '1';
    
    const data = await computeWeeklySOSv2(position, week, season, mode, weights, debug);
    res.json({ position, week, season, mode, weights, debug, items: data });
  } catch (error) {
    console.error('❌ SOS Weekly error:', error);
    res.status(500).json({ error: 'Failed to compute weekly SOS' });
  }
};

export const getROS = async (req: Request, res: Response) => {
  try {
    const position = (req.query.position as Position) || 'RB';
    const startWeek = parseInt((req.query.startWeek as string) || '1', 10);
    const window = parseInt((req.query.window as string) || '5', 10);
    const season = parseInt((req.query.season as string) || '2024', 10);
    const mode = ((req.query.mode as string) || 'fpa') as Mode;
    const weights = normalizeWeights(parseWeights(req.query.weights as string | undefined));
    const debug = req.query.debug === '1';
    
    // Compute ROS by averaging v2 weekly scores under same mode/weights
    const weeks = Array.from({length: window}, (_,i)=> startWeek + i);
    const all:any[] = [];
    for (const w of weeks) {
      const wk = await computeWeeklySOSv2(position, w, season, mode, weights, debug);
      all.push(...wk);
    }
    const byTeam = new Map<string, any[]>();
    all.forEach(r => {
      const k = `${r.team}:${position}`;
      if (!byTeam.has(k)) byTeam.set(k, []);
      byTeam.get(k)!.push(r);
    });
    const items = Array.from(byTeam.entries()).map(([k, arr])=>{
      const [team] = k.split(':');
      const avg = Math.round(arr.reduce((a,b)=>a+b.sos_score, 0) / arr.length);
      const tier = avg>=67?'green': avg>=33?'yellow':'red';
      return { team, position, weeks, avg_score: avg, tier };
    }).sort((a,b)=>b.avg_score - a.avg_score);
    
    res.json({ position, startWeek, window, season, mode, weights, debug, items });
  } catch (error) {
    console.error('❌ SOS ROS error:', error);
    res.status(500).json({ error: 'Failed to compute ROS SOS' });
  }
};