import { Request, Response } from 'express';
import { computeWeeklySOS, computeROSSOS } from './sos.service';
import { Position } from './sos.types';

export const getWeekly = (req: Request, res: Response) => {
  const position = (req.query.position as Position) || 'RB';
  const week = parseInt((req.query.week as string) || '1', 10);
  const data = computeWeeklySOS(position, week);
  res.json({ position, week, items: data });
};

export const getROS = (req: Request, res: Response) => {
  const position = (req.query.position as Position) || 'RB';
  const startWeek = parseInt((req.query.startWeek as string) || '1', 10);
  const window = parseInt((req.query.window as string) || '5', 10);
  const data = computeROSSOS(position, startWeek, window);
  res.json({ position, startWeek, window, items: data.sort((a,b)=>b.avg_score-a.avg_score) });
};