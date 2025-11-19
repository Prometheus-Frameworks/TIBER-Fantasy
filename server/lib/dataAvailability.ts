/**
 * Data Availability Contract
 * 
 * Centralizes what data TIBER has access to by season/week to prevent hallucination
 * and provide honest capability statements.
 */

export interface SeasonCapabilities {
  hasWeekly: boolean;      // Full weekly box scores available
  hasSeasonLevel: boolean; // Rankings + PPG available
}

/**
 * Returns what data is available for a given season
 */
export function getDataAvailability(season: number): SeasonCapabilities {
  return {
    hasWeekly: season <= 2025,     // Full weekly box scores via weekly_stats (2025 Week 11+ ingested)
    hasSeasonLevel: season <= 2025, // Rankings + PPG from Sleeper
  };
}

/**
 * Check if a player has NFL data for a specific season
 * Used to prevent citing 2024 stats for rookies who didn't play
 */
export function hasNFLDataForSeason(
  playerName: string,
  season: number,
  nflDebutYear?: number
): boolean {
  // If we have debut year metadata, use it
  if (nflDebutYear !== undefined) {
    return season >= nflDebutYear;
  }
  
  // Otherwise, assume we can't verify (caller should check RAG context)
  return false;
}

/**
 * Generate honest capability statement for weekly data requests
 */
export function getWeeklyDataCapabilityMessage(season: number): string {
  const capabilities = getDataAvailability(season);
  
  if (capabilities.hasWeekly) {
    return `I have weekly box scores for ${season} via the weekly_stats system.`;
  }
  
  if (capabilities.hasSeasonLevel) {
    return `Right now I don't have ${season} weekly box scores wired, only overall rankings and PPG. I can tell you where he ranks and how many points per game he's scoring, but not a full box score.`;
  }
  
  return `I don't have ${season} data available yet.`;
}

/**
 * Rookie guard template for players without prior NFL data
 */
export function getRookieGuardMessage(playerName: string, requestedSeason: number): string {
  return `${playerName} didn't play in the NFL in ${requestedSeason}, so I don't have pro stats for that year. I can only talk about his ${requestedSeason + 1} profile and general traits.`;
}

/**
 * Check if RAG context explicitly contains college data tag
 */
export function hasCollegeDataTag(ragContext: string): boolean {
  return ragContext.includes('COLLEGE_DATA') || ragContext.includes('[COLLEGE]');
}

/**
 * Detect if query is asking for weekly box score
 */
export function isWeeklyBoxScoreRequest(query: string): boolean {
  const weeklyPatterns = [
    /what did .+ do (?:in )?week \d+/i,
    /week \d+ (?:stats|statline|box score)/i,
    /how many .+ (?:in )?week \d+/i,
    /(?:yards|tds|touchdowns|receptions|catches) (?:in )?week \d+/i,
  ];
  
  return weeklyPatterns.some(pattern => pattern.test(query));
}

/**
 * Extract season from query if explicitly mentioned
 */
export function extractSeasonFromQuery(query: string): number | null {
  // Match 4-digit years (2020-2029)
  const yearMatch = query.match(/\b(202[0-9])\b/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10);
  }
  
  // Match "last year", "this year", etc.
  const currentYear = new Date().getFullYear();
  if (query.toLowerCase().includes('last year') || query.toLowerCase().includes('last season')) {
    return currentYear - 1;
  }
  if (query.toLowerCase().includes('this year') || query.toLowerCase().includes('this season')) {
    return currentYear;
  }
  
  return null;
}
