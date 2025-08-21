import { Request, Response } from 'express';
import { computeWeeklySOS, computeROSSOS } from './sos.service';
import type { Position } from './sos.service';

export const getWeekly = async (req: Request, res: Response) => {
  try {
    const position = (req.query.position as Position) || 'RB';
    const week = parseInt((req.query.week as string) || '1', 10);
    const season = parseInt((req.query.season as string) || '2024', 10);
    const data = await computeWeeklySOS(position, week, season);
    res.json({ position, week, season, items: data });
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
    const data = await computeROSSOS(position, startWeek, window, season);
    res.json({ position, startWeek, window, season, items: data });
  } catch (error) {
    console.error('❌ SOS ROS error:', error);
    res.status(500).json({ error: 'Failed to compute ROS SOS' });
  }
};