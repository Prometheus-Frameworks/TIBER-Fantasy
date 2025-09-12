// src/data/interfaces.ts
import { Position, PlayerInput } from "../../server/modules/startSitEngine";

export type NFLTeam =
  | "ARI" | "ATL" | "BAL" | "BUF" | "CAR" | "CHI" | "CIN" | "CLE" | "DAL" | "DEN"
  | "DET" | "GB" | "HOU" | "IND" | "JAX" | "KC"  | "LV"  | "LAC" | "LAR" | "MIA"
  | "MIN" | "NE"  | "NO"  | "NYG" | "NYJ" | "PHI" | "PIT" | "SEA" | "SF"  | "TB"
  | "TEN" | "WAS";

export interface SleeperUsage {
  snapPct?: number;
  routeParticipation?: number;
  targetShare?: number;
  carries?: number;
  targets?: number;
  rzTouches?: number;        // last 3 games rolling
  insideTenTouches?: number; // last 3 games rolling
}

export interface OasisMatchup {
  defRankVsPos?: number;     // 1..32 (1 hardest)
  oasisMatchupScore?: number; // 0..100 (your R/OASIS output)
  olHealthIndex?: number;    // 0..100
}

export interface VegasTeamLine {
  team: NFLTeam;
  opponent: NFLTeam;
  impliedTeamTotal?: number; // 10..40
  weatherImpact?: number;    // -1..+1
}

export interface VolatilityMeta {
  stdevLast5?: number; // FP stdev
  injuryTag?: "OUT" | "D" | "Q" | "P" | null;
  committeeRisk?: number;     // 0..100
  depthChartThreats?: number; // 0..100
}

export interface NewsSignal {
  newsHeat?: number; // 0..100
  ecrDelta?: number; // -15..+15
}

export interface LivePlayerContext {
  id: string;
  name: string;
  position: Position;
  team?: NFLTeam;
  projPoints?: number;
  projFloor?: number | null;
  projCeiling?: number | null;

  usage: SleeperUsage;
  matchup: OasisMatchup & Partial<VegasTeamLine>;
  volatility: VolatilityMeta;
  news: NewsSignal;
}

export type PlayerInputLike = PlayerInput;

export interface StartSitLiveQuery {
  playerA: { id: string; position: Position; team?: NFLTeam; name?: string };
  playerB: { id: string; position: Position; team?: NFLTeam; name?: string };
  week?: number; // default: current
}