export interface ScoringProfile {
  format: 'ppr' | 'half_ppr' | 'standard' | 'custom';
  rec_multiplier: number;
  te_premium: number;
  bonus_rec_te: number;
  bonus_rec_wr: number;
  bonus_rec_rb: number;
  pass_td_pts: number;
  rush_td_pts: number;
  rec_td_pts: number;
  dynasty_relevant: boolean;
  raw: Record<string, any>;
}

export function normalizeScoringSettings(raw?: Record<string, any>): ScoringProfile {
  const s = raw ?? {};

  const rec = Number(s.rec ?? s.rec_per_rx ?? 0);
  const bonus_rec_te = Number(s.bonus_rec_te ?? s.te_bonus ?? 0);
  const bonus_rec_wr = Number(s.bonus_rec_wr ?? 0);
  const bonus_rec_rb = Number(s.bonus_rec_rb ?? 0);
  const pass_td = Number(s.pass_td ?? 4);
  const rush_td = Number(s.rush_td ?? 6);
  const rec_td = Number(s.rec_td ?? 6);

  let format: ScoringProfile['format'];
  if (rec >= 1 && bonus_rec_te === 0 && bonus_rec_wr === 0 && bonus_rec_rb === 0) {
    format = 'ppr';
  } else if (rec >= 0.5 && rec < 1 && bonus_rec_te === 0) {
    format = 'half_ppr';
  } else if (rec === 0 && bonus_rec_te === 0) {
    format = 'standard';
  } else {
    format = 'custom';
  }

  const dynasty_relevant =
    bonus_rec_te > 0 ||
    bonus_rec_wr > 0 ||
    bonus_rec_rb > 0 ||
    pass_td !== 4 ||
    format !== 'standard';

  return {
    format,
    rec_multiplier: rec,
    te_premium: bonus_rec_te,
    bonus_rec_te,
    bonus_rec_wr,
    bonus_rec_rb,
    pass_td_pts: pass_td,
    rush_td_pts: rush_td,
    rec_td_pts: rec_td,
    dynasty_relevant,
    raw: s,
  };
}
