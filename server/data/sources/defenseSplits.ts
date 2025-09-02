// Defense splits data source - points allowed by position/alignment
export async function fetchDefenseSplits(season: number, week: number): Promise<Array<{
  team: string,
  vs_wr_slot_ppg: number,
  vs_wr_outside_ppg: number,
  vs_te_ppg: number,
  vs_rb_recv_ppg: number
}>> {
  // TODO: Wire to real defensive stats API later
  // For now, return league averages with some variance
  return [
    { team: 'CIN', vs_wr_slot_ppg: 11.8, vs_wr_outside_ppg: 13.2, vs_te_ppg: 9.1, vs_rb_recv_ppg: 7.3 },
    { team: 'DAL', vs_wr_slot_ppg: 15.2, vs_wr_outside_ppg: 12.8, vs_te_ppg: 8.9, vs_rb_recv_ppg: 6.8 },
    { team: 'CLE', vs_wr_slot_ppg: 12.1, vs_wr_outside_ppg: 11.9, vs_te_ppg: 9.5, vs_rb_recv_ppg: 7.1 },
    { team: 'PHI', vs_wr_slot_ppg: 13.8, vs_wr_outside_ppg: 12.5, vs_te_ppg: 8.7, vs_rb_recv_ppg: 7.0 },
    // Add more defensive units as needed
  ];
}