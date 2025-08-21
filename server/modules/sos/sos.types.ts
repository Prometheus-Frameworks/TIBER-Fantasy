export type Position = 'RB'|'WR'|'QB'|'TE';

export interface DVPRow {
  season: number;
  week: number;
  def_team: string;
  position: Position;
  fp_allowed: number;
}

export interface ScheduleRow {
  season: number;
  week: number;
  home: string;
  away: string;
}

export interface WeeklySOS {
  team: string;
  position: Position;
  week: number;
  opponent: string;
  sos_score: number; // 0-100 higher = easier
  tier: 'green'|'yellow'|'red';
}

export interface ROSItem {
  team: string;
  position: Position;
  weeks: number[];
  avg_score: number;
  tier: 'green'|'yellow'|'red';
}