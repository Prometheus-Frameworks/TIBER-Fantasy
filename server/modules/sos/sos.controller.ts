import { Request, Response } from 'express';
import { computeWeeklySOS, computeROSSOS, computeWeeklySOSv2, computeWeeklySOSv3, parseWeights, normalizeWeights } from './sos.service';
import { rankDefenses, rankOffenses, generateWeek5SOS } from './teamRankings.service';
import type { Position, Mode, Weights } from './sos.service';

export const getWeekly = async (req: Request, res: Response) => {
  try {
    const position = (req.query.position as Position) || 'RB';
    const week = parseInt((req.query.week as string) || '1', 10);
    const season = parseInt((req.query.season as string) || '2024', 10);
    
    // Validate week boundaries by season (allow 2025 projections)
    const maxWeek = season === 2024 ? 17 : 18;
    if (season !== 2025 && week > maxWeek) {
      return res.status(400).json({ error: `Invalid week for season ${season}. Week must be <= ${maxWeek}` });
    }
    
    const rawMode = req.query.mode as string;
    const mode = (rawMode === 'fpa' || rawMode === 'ctx') ? rawMode as Mode : 'fpa';
    const weights = normalizeWeights(parseWeights(req.query.weights as string | undefined));
    const debug = req.query.debug === '1';
    
    // Parse and clamp samples parameter (0-5)
    const samplesRaw = parseInt((req.query.samples as string) ?? '0', 10);
    const samples = Number.isFinite(samplesRaw) ? Math.max(0, Math.min(samplesRaw, 5)) : 0;
    
    const data = await computeWeeklySOSv2(position, week, season, mode, weights, debug, samples);
    res.json({ position, week, season, mode, weights, debug, samples, items: data });
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
    
    // Validate week boundaries by season (allow 2025 projections)
    const maxWeek = season === 2024 ? 17 : 18;
    if (season !== 2025 && (startWeek > maxWeek || (startWeek + window - 1) > maxWeek)) {
      return res.status(400).json({ error: `Invalid week range for season ${season}. Weeks must be <= ${maxWeek}` });
    }
    
    const rawMode = req.query.mode as string;
    const mode = (rawMode === 'fpa' || rawMode === 'ctx') ? rawMode as Mode : 'fpa';
    const weights = normalizeWeights(parseWeights(req.query.weights as string | undefined));
    const debug = req.query.debug === '1';
    
    // Compute ROS by averaging v2 weekly scores under same mode/weights
    const weeks = Array.from({length: window}, (_,i)=> startWeek + i);
    const all:any[] = [];
    for (const w of weeks) {
      const wk = await computeWeeklySOSv2(position, w, season, mode, weights, debug, 0);
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

export const getWeeklyV3 = async (req: Request, res: Response) => {
  try {
    const position = (req.query.position as Position) || 'RB';
    const week = parseInt((req.query.week as string) || '1', 10);
    const season = parseInt((req.query.season as string) || '2024', 10);
    
    // Validate week boundaries by season
    const maxWeek = season === 2024 ? 17 : 18;
    if (season !== 2025 && week > maxWeek) {
      return res.status(400).json({ error: `Invalid week for season ${season}. Week must be <= ${maxWeek}` });
    }
    
    const rawMode = req.query.mode as string;
    const mode = (rawMode === 'fpa' || rawMode === 'ctx') ? rawMode as Mode : 'fpa';
    const weights = normalizeWeights(parseWeights(req.query.weights as string | undefined));
    
    // includeAnalytics defaults to true, can be disabled with ?analytics=false
    const includeAnalytics = req.query.analytics !== 'false';
    
    const data = await computeWeeklySOSv3(position, week, season, mode, weights, includeAnalytics);
    res.json({ position, week, season, mode, weights, includeAnalytics, items: data });
  } catch (error) {
    console.error('❌ SOS Weekly v3 error:', error);
    res.status(500).json({ error: 'Failed to compute weekly SOS v3' });
  }
};

export const getDefenseRankings = async (req: Request, res: Response) => {
  try {
    const season = parseInt((req.query.season as string) || '2024', 10);
    const week = parseInt((req.query.week as string) || '4', 10);
    
    const rankings = await rankDefenses(season, week);
    res.json({ season, week, rankings });
  } catch (error) {
    console.error('❌ Defense Rankings error:', error);
    res.status(500).json({ error: 'Failed to rank defenses' });
  }
};

export const getOffenseRankings = async (req: Request, res: Response) => {
  try {
    const season = parseInt((req.query.season as string) || '2024', 10);
    const week = parseInt((req.query.week as string) || '4', 10);
    
    const rankings = await rankOffenses(season, week);
    res.json({ season, week, rankings });
  } catch (error) {
    console.error('❌ Offense Rankings error:', error);
    res.status(500).json({ error: 'Failed to rank offenses' });
  }
};

export const getWeek5SOS = async (req: Request, res: Response) => {
  try {
    const position = (req.query.position as Position) || 'RB';
    const season = parseInt((req.query.season as string) || '2024', 10);
    
    const items = await generateWeek5SOS(position, season);
    res.json({ position, week: 5, season, items });
  } catch (error) {
    console.error('❌ Week 5 SOS error:', error);
    res.status(500).json({ error: 'Failed to generate Week 5 SOS' });
  }
};