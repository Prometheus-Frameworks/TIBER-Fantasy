import { DVPRow, ScheduleRow, WeeklySOS, ROSItem, Position } from './sos.types';
import seed from './sos.seed.json';

type Seed = {
  season: number;
  position: Position;
  defense_dvp: {week:number;def_team:string;fp_allowed:number}[];
  schedule: {week:number;home:string;away:string}[];
};

const SEASON = (seed as Seed).season;

// --- helpers
function percentileScale(values: number[], v: number): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a,b)=>a-b);
  const idx = sorted.findIndex(x => x >= v);
  const rank = idx === -1 ? sorted.length : idx + 1;
  return Math.round((rank / sorted.length) * 100);
}

function tier(score: number): 'green'|'yellow'|'red' {
  if (score >= 67) return 'green';
  if (score >= 33) return 'yellow';
  return 'red';
}

export function computeWeeklySOS(position: Position, week: number): WeeklySOS[] {
  // Build DVP map by defense
  const dvp = (seed as Seed).defense_dvp
    .map(r => ({season: SEASON, week: r.week, def_team: r.def_team, position, fp_allowed: r.fp_allowed})) as DVPRow[];

  // For v1 seed, just use current week fp_allowed as fpa_recent; later we'll roll last 4/season blend
  const fpList = dvp.map(d => d.fp_allowed);

  const games = (seed as Seed).schedule.filter(g => g.week === week);
  const out: WeeklySOS[] = [];

  for (const g of games) {
    const defForHomeRB = dvp.find(d => d.def_team === g.away); // home RB faces away defense
    const defForAwayRB = dvp.find(d => d.def_team === g.home); // away RB faces home defense

    if (defForHomeRB) {
      const s = percentileScale(fpList, defForHomeRB.fp_allowed);
      out.push({team: g.home, position, week, opponent: g.away, sos_score: s, tier: tier(s)});
    }
    if (defForAwayRB) {
      const s = percentileScale(fpList, defForAwayRB.fp_allowed);
      out.push({team: g.away, position, week, opponent: g.home, sos_score: s, tier: tier(s)});
    }
  }
  return out;
}

export function computeROSSOS(position: Position, startWeek = 1, window = 5): ROSItem[] {
  // naive: compute each week first, then average upcoming N
  const weeks = Array.from({length: window}, (_,i) => startWeek + i);
  const byWeek = weeks.map(w => computeWeeklySOS(position, w)).flat();

  const byTeam = new Map<string, WeeklySOS[]>();
  for (const row of byWeek) {
    const key = `${row.team}:${position}`;
    if (!byTeam.has(key)) byTeam.set(key, []);
    byTeam.get(key)!.push(row);
  }

  const out: ROSItem[] = [];
  for (const [key, rows] of Array.from(byTeam.entries())) {
    const [team] = key.split(':');
    const scores = rows.map((r: WeeklySOS) => r.sos_score);
    if (scores.length === 0) continue;
    const avg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
    out.push({ team, position, weeks, avg_score: avg, tier: tier(avg) });
  }
  return out;
}