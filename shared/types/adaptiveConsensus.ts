export interface PlayerInjury {
  playerId: string;
  status: "ACTIVE" | "OUT" | "IR" | "PUP" | "QUESTIONABLE" | "DOUBTFUL";
  injuryType?: "ACL" | "Achilles" | "Hamstring" | "Concussion" | "Ankle" | "Knee" | "Shoulder" | "Back" | "Other";
  datePlaced?: string; // ISO date
  estReturnWeeks?: number | null;
  outForSeason?: boolean;
  lastUpdated: string; // ISO date
}

export interface PlayerBio {
  playerId: string;
  pos: "QB" | "RB" | "WR" | "TE";
  age: number;
  team?: string;
}

export interface PlayerUsageWeekly {
  playerId: string;
  week: number;
  season: number;
  snapShare?: number;
  routesRun?: number;
  touches?: number;
  lastUpdated: string;
}

export interface ConsensusContext {
  playerId: string;
  injury: PlayerInjury | null;
  bio: PlayerBio;
  recentGames: number;
  snapShare: number;
  hasCommunity: boolean;
  submissionHistory: Array<{
    date: string;
    rank: number;
    userId: string;
  }>;
}

export interface SurgeDetection {
  playerId: string;
  isSurging: boolean;
  rankChangePct: number;
  recentSubmitPct: number;
  lastCalculated: string;
}

export interface ConsensusExplanation {
  playerId: string;
  format: "dynasty" | "redraft";
  season?: number;
  decayDays: number;
  surgeActive: boolean;
  injury: PlayerInjury | null;
  gates: {
    recoveryGamesMet: boolean;
    snapShareMet: boolean;
  };
  notes: string[];
  baseRank: number;
  adjustedRank: number;
  adjustmentFactors: {
    surge?: number;
    injuryPenalty?: number;
    ageRisk?: number;
    injuryTypeRisk?: number;
  };
}

export const CONSENSUS_CFG = {
  // Surge detection
  SURGE_WINDOW_DAYS: 7,
  SURGE_PCT_THRESHOLD: 25,     // rank improves >25% in 7d
  SURGE_MIN_SUBMIT_PCT: 20,    // last 7d submissions >= 20% of lifetime submits
  SURGE_DECAY_DAYS: 21,        // when surging, shorten decay window

  BASE_DECAY_DAYS: 90,         // normal smoothing horizon

  // Redraft injury penalties
  RD_UNRANK_IF_OFS: true,
  RD_DROP_6PLUS_WEEKS: 45,     // push down ~45 ranks for 6-8 wk absence
  RD_DROP_SHORT_2TO5: 15,      // smaller penalty for short absences
  RD_RECOVERY_GAMES_MIN: 2,    // require 1–2 games before full velocity
  RD_RECOVERY_SNAP_THRESH: 0.70, // snap share to remove penalty

  // Dynasty injury multipliers (soften except age/position risk)
  DY_BASE_PENALTY: 0.90,       // 10% softening by default
  DY_RISK: {
    ACL: 0.92,
    Achilles: 0.70,
    Hamstring: 0.96,
    Concussion: 0.94,
    Ankle: 0.95,
    Knee: 0.93,
    Shoulder: 0.96,
    Back: 0.94,
    Other: 0.95,
    DEFAULT: 0.95
  } as const,
  
  DY_AGE_FACTOR: (age: number, pos: string): number => {
    if (pos === "RB" && age >= 27) return 0.85;
    if (pos === "WR" && age >= 29) return 0.90;
    if (pos === "TE" && age >= 30) return 0.92;
    if (pos === "QB" && age >= 35) return 0.95;
    return 1.0;
  }
};