export type Scoring = 'std' | 'half' | 'ppr';

export interface WeeklyRow {
  season: number;
  week: number;
  gsis_id?: string;
  player_id: string;
  player_name: string;
  team: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  snaps?: number;
  routes?: number;
  targets?: number;
  rush_att?: number;
  rec?: number;
  rec_yd?: number;
  rec_td?: number;
  rush_yd?: number;
  rush_td?: number;
  pass_yd?: number;
  pass_td?: number;
  int?: number;
  fumbles?: number;
  two_pt?: number;
  fantasy_points_std?: number;
  fantasy_points_half?: number;
  fantasy_points_ppr?: number;
}
