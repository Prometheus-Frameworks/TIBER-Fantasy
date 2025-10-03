// shared/startSit.ts
// Core types + React Query hook signatures for Start/Sit.
// Zero implementation here on purpose — Agent 3 can point these at your HTTP client.

import type {
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";

/** Standardized position union */
export type Position = "QB" | "RB" | "WR" | "TE" | "DST" | "K";

/** Per-factor scoring atom used in the breakdown */
export interface StartSitFactor {
  /** Stable key for logic/rules (e.g., 'usage', 'sos', 'injury') */
  key:
    | "usage"
    | "role"
    | "sos"
    | "injury"
    | "vegas"
    | "weather"
    | "oline"
    | "coverage"
    | "gameScript"
    | "trend"
    | "redZone"
    | (string & {}); // allow future custom keys
  /** Human label for UI */
  label: string;
  /** Weight (0–1) contribution before normalization */
  weight: number;
  /** Raw factor score on a common scale (e.g., -100..100) */
  score: number;
  /** Directional impact after weighting */
  impact: "boost" | "downgrade" | "neutral";
  /** Evidence payload for proof table in UI */
  evidence?: Record<string, string | number | boolean | null>;
  /** One-liner explanation for tooltips */
  note?: string;
}

/** Aggregated factor layer */
export interface StartSitFactorBreakdown {
  /** Weighted sum of factor scores (pre-normalization) */
  totalScore: number;
  /** 0–100 normalized score pushed to UI */
  normalizedScore: number;
  /** Individual factors with weights/scores/evidence */
  factors: StartSitFactor[];
  /** Top positive signals to surface as badges */
  topSignals?: string[];
  /** Risk flags to surface (injury, weather, role volatility, etc.) */
  riskFlags?: string[];
}

/** Player profile used by Start/Sit engine + UI */
export interface StartSitPlayerProfile {
  playerId: string;            // slug/id used across OTC
  name: string;
  position: Position;
  team: string;
  opponent: string;            // e.g., "DEN"
  week: number;
  season: number;
  kickoff?: string;            // ISO datetime
  home?: boolean;

  vegas?: {
    spread?: number;           // negative = favored
    total?: number;            // game total
    impliedPoints?: number;    // team implied total
    oppImpliedPoints?: number; // opponent implied
  };

  usage?: {
    snapPct?: number;          // 0–100
    routePct?: number;         // WR/TE/RB
    targetShare?: number;      // 0–1
    carryShare?: number;       // RB
    redZoneTouches?: number;
    goalLineCarries?: number;
    twoMinuteSnapPct?: number;
  };

  efficiency?: {
    yprr?: number;             // WR/TE
    epaPerPlay?: number;
    successRate?: number;      // 0–1
    cpoe?: number;             // QB
    yardsAfterContact?: number;// RB
    explosiveRate?: number;    // plays > X yards
  };

  context?: {
    oasis?: number;            // your environment/context score
    olPassBlock?: number;      // line quality proxy
    olRunBlock?: number;
    sos?: number;              // positional SOS (lower = tougher or vice versa, your convention)
    coverage?: "man" | "zone" | null;
    pace?: number;             // seconds/play or plays/game — your convention
    weather?: { tempC?: number; windKph?: number; precipProb?: number };
    injuryStatus?: "Healthy" | "Questionable" | "Doubtful" | "Out";
  };

  /** Factor math and receipts */
  factorBreakdown: StartSitFactorBreakdown;

  /** Points projection envelope for UI */
  projection?: { floor?: number; median?: number; ceiling?: number };

  /** Last N weekly finishes (PPR rank or points) for sparkline */
  recentFinishes?: number[];

  /** Extra breadcrumbs for UI copy */
  notes?: string[];
}

/** Final recommendation blob */
export interface StartSitVerdict {
  playerId: string;
  week: number;

  /** High-level call the user actually cares about */
  verdict: "START" | "FLEX" | "STREAM" | "SIT" | "BENCH";

  /** Optional tiering to juice UX */
  tier?: "SMASH" | "STARTABLE" | "MATCHUP_DEPENDENT" | "DESPERATION" | "AVOID";

  /** Confidence lane */
  confidence: "HIGH" | "MEDIUM" | "LOW";

  /** Bulletproofing: why we made the call */
  rationale: string[];

  /** Landmines to consider */
  cautions?: string[];

  /** Expected range for points (used in compare UI) */
  expectedRange?: { floor: number; median: number; ceiling: number };

  /** Summarized factor outcomes for quick badges */
  factorSummary?: { boost: string[]; downgrade: string[] };

  /** Optional: alternatives we'd consider */
  altOptions?: Array<{ playerId: string; name: string; reason: string }>;
}

/* =========================
   Query Params / Endpoints
   ========================= */

export interface StartSitQueryParams {
  week: number;
  season?: number;
  leagueId?: string;
  positions?: Position[];
  teamId?: string; // for roster-centric pulls
}

export interface StartSitCompareParams {
  playerIds: string[];
  week: number;
  season?: number;
}

/** Keep endpoints centralized so Agent 3 can swap paths easily */
export const START_SIT_ENDPOINTS = {
  profile: (playerId: string, week: number, season?: number) =>
    `/api/start-sit/profile?playerId=${encodeURIComponent(playerId)}&week=${week}${
      season ? `&season=${season}` : ""
    }`,
  verdicts: (p: StartSitQueryParams) => {
    const q = new URLSearchParams();
    q.set("week", String(p.week));
    if (p.season) q.set("season", String(p.season));
    if (p.leagueId) q.set("leagueId", p.leagueId);
    if (p.teamId) q.set("teamId", p.teamId);
    if (p.positions?.length) q.set("positions", p.positions.join(","));
    return `/api/start-sit/verdicts?${q.toString()}`;
  },
  compare: (p: StartSitCompareParams) => {
    const q = new URLSearchParams();
    q.set("week", String(p.week));
    if (p.season) q.set("season", String(p.season));
    q.set("playerIds", p.playerIds.join(","));
    return `/api/start-sit/compare?${q.toString()}`;
  },
} as const;

/* =========================
   React Query Hook Signatures
   (type-only; implement elsewhere)
   ========================= */

/** Error type alias to keep it flexible (AxiosError, zod issues, etc.) */
export type StartSitQueryError = unknown;

/** Fetch a single player's Start/Sit profile (rich data + factors) */
export declare function useStartSitProfile(
  playerId: string,
  week: number,
  options?: UseQueryOptions<StartSitPlayerProfile, StartSitQueryError>
): UseQueryResult<StartSitPlayerProfile, StartSitQueryError>;

/** Fetch Start/Sit verdicts for a set of filters (league/positions/team) */
export declare function useStartSitVerdicts(
  params: StartSitQueryParams,
  options?: UseQueryOptions<StartSitVerdict[], StartSitQueryError>
): UseQueryResult<StartSitVerdict[], StartSitQueryError>;

/** Compare multiple players head-to-head for the same week */
export declare function useStartSitCompare(
  params: StartSitCompareParams,
  options?: UseQueryOptions<StartSitVerdict[], StartSitQueryError>
): UseQueryResult<StartSitVerdict[], StartSitQueryError>;
