// Tiber Comparative Analysis Engine - Head-to-head player decision making
import { resolvePlayerId, fetchPlayerWeekBundle } from './dataAdapter.js';
import { fetchGameOdds } from '../data/sources/vegas.js';
import { fetchGameWeather } from '../data/sources/weather.js';
import { fetchDefenseSplits } from '../data/sources/defenseSplits.js';
import { fetchRouteAlign } from '../data/sources/alignments.js';

type Verdict = 'Start A'|'Start B'|'Start A (thin)'|'Start B (thin)'|'Coin flip';

export async function tiberCompare(players: string[], season: number, week: number, scoring = 'PPR') {
  const [aName, bName] = players;
  const [aId, bId] = await Promise.all([resolvePlayerId(aName), resolvePlayerId(bName)]);
  
  if (!aId || !bId) {
    return { 
      verdict: 'Unknown Player', 
      reasons: [`Could not resolve ${!aId ? aName : bName}`], 
      tone: 'tiber' 
    };
  }

  const [A, B] = await Promise.all([
    fetchPlayerWeekBundle(aId.player_id, season, week),
    fetchPlayerWeekBundle(bId.player_id, season, week)
  ]);
  
  if (!A || !B) {
    return { 
      verdict: 'No Data', 
      reasons: ['Missing week facts'], 
      tone: 'tiber' 
    };
  }

  // Fetch contextual data: odds, weather, defense splits
  const [odds, weather, def] = await Promise.all([
    fetchGameOdds(season, week), 
    fetchGameWeather(season, week), 
    fetchDefenseSplits(season, week)
  ]);

  // Enrich both players with contextual adjustments
  const aAdj = await enrich(A, odds, weather, def, season);
  const bAdj = await enrich(B, odds, weather, def, season);

  // Calculate adjusted expected points with matchup/script/weather factors
  const aMu = (A.expected_points ?? 0) + adjustedMu(aAdj);
  const bMu = (B.expected_points ?? 0) + adjustedMu(bAdj);

  // Derive floor/ceiling from each player's variance with matchup adjustments
  const aFloor = (A.floor_points ?? aMu - 2) + aAdj.deltaFloor;
  const aCeil = (A.ceiling_points ?? aMu + 2) + aAdj.deltaCeil;
  const bFloor = (B.floor_points ?? bMu - 2) + bAdj.deltaFloor;
  const bCeil = (B.ceiling_points ?? bMu + 2) + bAdj.deltaCeil;

  // Multi-dimensional advantage score: expected diff + risk + upside preference
  const diff = aMu - bMu;
  const riskBias = -0.2 * ((aCeil - aFloor) - (bCeil - bFloor)); // prefer narrower range slightly
  const upsideBias = 0.15 * ((A.upside_index ?? 0) - (B.upside_index ?? 0)); // Joe likes upside
  const score = diff + riskBias + upsideBias;

  // Generate nuanced verdict based on advantage magnitude
  const verdict: Verdict =
    Math.abs(score) < 0.7 ? 'Coin flip' :
    score > 0 ? (Math.abs(score) < 1.5 ? 'Start A (thin)' : 'Start A') :
                (Math.abs(score) < 1.5 ? 'Start B (thin)' : 'Start B');

  const conf = confidenceFromRanges(aFloor, aCeil, bFloor, bCeil);
  const reasons = buildReasons(A, B, aAdj, bAdj, aMu, bMu);
  const headToHead = {
    A: view(A, aMu, aFloor, aCeil),
    B: view(B, bMu, bFloor, bCeil),
    delta_mu: Number((aMu - bMu).toFixed(1))
  };

  return { verdict, confidence: conf, reasons, headToHead, tone: 'tiber' };
}

// Enrich player data with contextual adjustments
async function enrich(p: any, odds: any[], weather: any[], def: any[], season: number) {
  const team = p.team;
  const o = odds.find(x => x.team === team);
  const w = weather.find(x => x.team === team);
  const d = def.find(x => x.team === p.opp || x.team === oppOf(team, odds)) || {};
  const align = await fetchRouteAlign(p.player_id, season);

  // Game script adjusts pass/run expectation based on spread and total
  const scriptBoost = o ? scriptAdj(o.spread, o.total, p.position) : 0;
  
  // Coverage adjustment for WR/TE by alignment vs defense splits
  const coverAdj = coverAdjustment(p.position, align, d);
  
  // Weather penalty mainly for passing games (wind impact)
  const weatherAdj = w ? weatherAdjustment(w.wind_mph, p.position) : 0;

  return {
    scriptBoost, 
    coverAdj, 
    weatherAdj,
    deltaFloor: Math.min(1.5, coverAdj * 0.2 - Math.max(0, weatherAdj) * 0.1),
    deltaCeil: Math.max(-1.0, coverAdj * 0.4 - Math.max(0, weatherAdj) * 0.1)
  };
}

// Game script adjustment based on spread and total
function scriptAdj(spread: number, total: number, pos: 'QB'|'RB'|'WR'|'TE') {
  // Big underdog → pass bump; big favorite → RB bump
  const underdog = spread > 3 ? 1 : spread < -3 ? -1 : 0;
  
  if (pos === 'QB' || pos === 'WR' || pos === 'TE') {
    return underdog * 0.6; // ~+0.6 pts if decent dog
  }
  if (pos === 'RB') {
    return (underdog === -1 ? 0.5 : -0.2); // favorites feed RBs
  }
  return 0;
}

// Coverage adjustment based on player alignment vs defensive weakness
function coverAdjustment(pos: string, a: {slot_pct: number, outside_pct: number, inline_pct: number}, d: any) {
  if (pos === 'WR') {
    const slot = (d.vs_wr_slot_ppg ?? 12) - 12;     // relative to league avg ~12
    const outside = (d.vs_wr_outside_ppg ?? 12) - 12;
    return slot * a.slot_pct + outside * a.outside_pct; // points differential
  }
  if (pos === 'TE') return (d.vs_te_ppg ?? 9) - 9;
  if (pos === 'RB') return (d.vs_rb_recv_ppg ?? 7) - 7; // pass-game RBs
  return 0;
}

// Weather adjustment for wind impact on passing games
function weatherAdjustment(wind: number, pos: string) {
  if (wind == null) return 0;
  if (wind >= 20 && (pos === 'QB' || pos === 'WR' || pos === 'TE')) return -1.5;
  if (wind >= 15 && (pos === 'QB' || pos === 'WR' || pos === 'TE')) return -0.8;
  return 0;
}

// Sum all contextual adjustments
function adjustedMu(adj: any) { 
  return adj.scriptBoost + adj.coverAdj + adj.weatherAdj; 
}

// Calculate confidence from outcome variance
function confidenceFromRanges(aF: number, aC: number, bF: number, bC: number) {
  const spread = ((aC - aF) + (bC - bF)) / 2;
  return Math.max(40, Math.min(90, 85 - spread * 3));
}

// Format player view with adjusted stats
function view(p: any, mu: number, floor: number, ceil: number) {
  return {
    player_id: p.player_id, 
    name: p.name, 
    team: p.team, 
    pos: p.position,
    power: p.power_score, 
    rag: p.rag_color, 
    rag_score: p.rag_score,
    expected_points: Number(mu.toFixed(1)),
    floor_points: Number(floor.toFixed(1)),
    ceiling_points: Number(ceil.toFixed(1)),
    delta_vs_ecr: p.delta_vs_ecr, 
    upside_index: p.upside_index
  };
}

// Build detailed reasoning bullets
function buildReasons(A: any, B: any, aAdj: any, bAdj: any, aMu: number, bMu: number) {
  const R: string[] = [];
  
  // Show matchup/script/weather for both
  const who = (aMu > bMu) ? `${A.name} over ${B.name}` : `${B.name} over ${A.name}`;
  const edge = Math.abs(aMu - bMu).toFixed(1);
  R.push(`Edge: ${who} by ${edge} expected points (after script/coverage/weather).`);
  
  if (Math.abs(aAdj.coverAdj) > 0.3 || Math.abs(bAdj.coverAdj) > 0.3) {
    R.push(`${A.name}: coverage adj ${aAdj.coverAdj.toFixed(1)} | ${B.name}: ${bAdj.coverAdj.toFixed(1)}`);
  }
  
  if (Math.abs(aAdj.scriptBoost) > 0 || Math.abs(bAdj.scriptBoost) > 0) {
    R.push(`Script: A ${fmt(aAdj.scriptBoost)}, B ${fmt(bAdj.scriptBoost)}`);
  }
  
  if (Math.abs(aAdj.weatherAdj) > 0 || Math.abs(bAdj.weatherAdj) > 0) {
    R.push(`Weather: A ${fmt(aAdj.weatherAdj)}, B ${fmt(bAdj.weatherAdj)}`);
  }
  
  if ((A.delta_vs_ecr ?? 0) >= 10 || (B.delta_vs_ecr ?? 0) >= 10) {
    R.push(`Market delta: A ${A.delta_vs_ecr ?? 0}, B ${B.delta_vs_ecr ?? 0} (we're earlier = edge).`);
  }
  
  return R.slice(0, 4);
}

// Format adjustment values
function fmt(x: number) { 
  return (x >= 0 ? '+' : '') + x.toFixed(1) + ' pts'; 
}

// Find opponent team from odds data
function oppOf(team: string, odds: any[]) { 
  const row = odds.find(x => x.team === team); 
  return row?.opp; 
}