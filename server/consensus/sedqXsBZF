import { computeDynastyMultiplierV2 } from "./injuryProfiles";
import { adjustRankWithMultiplier } from "./curves";

type Pos = "QB"|"RB"|"WR"|"TE";

export function applyDynastyInjuryV2(params: {
  rank: number;
  injuryType: string;
  pos: Pos;
  age: number;
  phase: "year_of_injury" | "year_after_return";
  weeksRecovered?: number;
}) {
  const k = computeDynastyMultiplierV2(params);
  return adjustRankWithMultiplier(params.rank, k);
}

/**
 * Automatically determine injury phase based on injury status and timeline
 * Uses Grok's data integration logic with Claude Lamar's collaboration
 */
export function determineInjuryPhase(injuryData: {
  status: "ACTIVE" | "OUT" | "IR" | "PUP" | "QUESTIONABLE" | "DOUBTFUL";
  datePlaced?: string;
  estReturnWeeks?: number;
  currentWeek?: number;
  seasonWeek?: number;
}): "year_of_injury" | "year_after_return" | null {
  const { status, datePlaced, estReturnWeeks, currentWeek, seasonWeek } = injuryData;
  
  // Active players - no adjustment needed
  if (status === "ACTIVE") return null;
  
  // If no timeline data, assume current injury year
  if (!datePlaced || !currentWeek) return "year_of_injury";
  
  // Calculate weeks since injury
  const injuryDate = new Date(datePlaced);
  const now = new Date();
  const weeksSinceInjury = Math.floor((now.getTime() - injuryDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  
  // If injury happened in previous season and player returned, use year_after_return
  if (weeksSinceInjury > 20 && status === "ACTIVE") {
    return "year_after_return";
  }
  
  // For current season injuries or recent returns
  return "year_of_injury";
}

/**
 * Calculate weeks recovered for partial season interpolation
 * Grok integration point for precise timeline tracking
 */
export function calculateWeeksRecovered(injuryData: {
  datePlaced?: string;
  estReturnWeeks?: number;
  status: string;
}): number | undefined {
  if (!injuryData.datePlaced || !injuryData.estReturnWeeks) return undefined;
  
  const injuryDate = new Date(injuryData.datePlaced);
  const now = new Date();
  const weeksSinceInjury = Math.floor((now.getTime() - injuryDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  
  // If player is back or nearly back, return weeks recovered
  if (injuryData.status === "QUESTIONABLE") {
    return Math.max(0, weeksSinceInjury);
  }
  
  return 0; // Still injured, no recovery yet
}