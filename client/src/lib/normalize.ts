export type PlayerLite = { id: string; name: string; team?: string };

export function normRedraft(input:any): PlayerLite[] {
  const list = Array.isArray(input?.rankings) ? input.rankings : input;
  return (list ?? [])
    .map((r:any) => ({
      id: r.player_id ?? r.id ?? '',
      name: r.full_name ?? r.name ?? '',
      team: r.team,
    }))
    .filter((x: PlayerLite) => x.id && x.name);
}

export function normDynasty(input:any): PlayerLite[] {
  const list = Array.isArray(input?.values) ? input.values : input;
  return (list ?? [])
    .map((r:any) => ({
      id: r.player_id ?? r.id ?? '',
      name: r.full_name ?? r.name ?? '',
      team: r.team,
    }))
    .filter((x: PlayerLite) => x.id && x.name);
}

export function normUsageLeaders(input:any) {
  const list = Array.isArray(input?.players) ? input.players : (Array.isArray(input) ? input : []);
  return list
    .map((p:any) => ({
      id: p.player_id ?? '',
      name: p.full_name ?? '',
      targetPct: Number(p.target_pct ?? 0),
      snapPct: Number(p.snap_pct ?? 0),
    }))
    .filter((x: any) => x.id && x.name);
}