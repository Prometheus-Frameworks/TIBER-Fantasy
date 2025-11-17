import { WeeklyRow, Scoring } from '../../shared/types/fantasy';

export function calcFantasy(row: WeeklyRow, scoring: Scoring): number {
  const pass = (row.pass_yd ?? 0) / 25 + (row.pass_td ?? 0) * 4 - (row.int ?? 0);
  const rush = (row.rush_yd ?? 0) / 10 + (row.rush_td ?? 0) * 6;
  const recv = (row.rec_yd ?? 0) / 10 + (row.rec_td ?? 0) * 6;
  const base = pass + rush + recv + (row.two_pt ?? 0) * 2 - (row.fumbles ?? 0) * 2;
  const pprBonus = (row.rec ?? 0) * (scoring === 'ppr' ? 1 : scoring === 'half' ? 0.5 : 0);
  return +(base + pprBonus).toFixed(2);
}

export function hydrateFantasyVariants(row: WeeklyRow): WeeklyRow {
  return {
    ...row,
    fantasy_points_std: calcFantasy(row, 'std'),
    fantasy_points_half: calcFantasy(row, 'half'),
    fantasy_points_ppr: calcFantasy(row, 'ppr'),
  };
}
