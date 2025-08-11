export type PlayerLite = { id:string; name:string; team:string; pos:"QB"|"RB"|"WR"|"TE" };
const title = (s='') => s.replace(/\b\w/g,c=>c.toUpperCase());

export const mapPlayerLite = (r:any): PlayerLite => ({
  id: r.id ?? r.player_id ?? r.slug ?? "",
  name: title(r.name ?? r.full_name ?? "Unknown Player"),
  team: String(r.team ?? r.nfl_team ?? "").toUpperCase(),
  pos: String(r.pos ?? r.position ?? "WR").toUpperCase() as PlayerLite["pos"],
});