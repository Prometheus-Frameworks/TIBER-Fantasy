/**
 * Weekly Statline RAG v1 - Helper Functions
 * 
 * Detects weekly stat queries, fetches player weekly data,
 * and formats as [DATA: WEEKLY_STATLINE] chunks for RAG.
 */

import { CURRENT_NFL_SEASON, getCurrentNFLWeek } from '../../shared/config/seasons';

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface WeeklyQuery {
  isWeeklyQuery: boolean;
  week?: number;
  relativeWeek?: 'last' | 'this';
  playerName?: string;
}

export interface WeeklyStatsResult {
  season: number;
  week: number;
  playerId: string;
  playerName: string;
  team: string;
  pos: string;
  scoring: {
    std: number;
    half: number;
    ppr: number;
  };
  line: {
    carries?: number;
    rushYds?: number;
    rushTD?: number;
    targets?: number;
    receptions?: number;
    recYds?: number;
    recTD?: number;
    passTD?: number;
    passYds?: number;
    int?: number;
  };
  usage: {
    snaps?: number;
    routes?: number;
  };
}

// ========================================
// HELPER 1: DETECT WEEKLY QUERY
// ========================================

const WEEK_REGEX = /\b(week|wk|w)\s*(\d{1,2})\b/i;
const REL_WEEK_REGEX = /\b(last|this)\s+week\b/i;
const VERB_REGEX = /\b(what|how|did|do|does|put\s+up|statline|stat\s+line|line|game\s*log|performance|score|finish)\b/i;

/**
 * Detects if user message is asking about weekly stats
 * 
 * @example
 * detectWeeklyQuery("What did Ja'Marr Chase do Week 11?")
 * // => { isWeeklyQuery: true, week: 11, playerName: "Ja'Marr Chase" }
 * 
 * detectWeeklyQuery("what did jaylen warren do week 11?")
 * // => { isWeeklyQuery: true, week: 11, playerName: "jaylen warren" }
 */
export function detectWeeklyQuery(message: string): WeeklyQuery {
  const lower = message.toLowerCase();

  // Extract week number (explicit: "week 11", "wk 11", "w11")
  const weekMatch = message.match(WEEK_REGEX);
  
  // Extract relative week ("last week", "this week")
  const relMatch = lower.match(REL_WEEK_REGEX);
  
  // Check for stat-query verbs
  const hasVerb = VERB_REGEX.test(lower);

  // Case-insensitive player name detection
  // Matches 2+ consecutive words (handles both "Ja'Marr Chase" and "jaylen warren")
  // Excludes common question words, verbs, and analysis terms
  const excludeWords = /^(what|how|did|do|does|week|wk|last|this|his|the|in|put|up|score|finish|game|log|stat|statline|line|performance|break|down|breakdown|analyze|using|framework|against|commandments?|play|played|fantasy|points?|yards?|targets?|catches?|receptions?|touchdowns?|tds?|and|or|with|for|from|about|was|were|had|have|my|your|his|her|their)$/i;
  
  const words = message.match(/\b[a-z]+(?:['\-][a-z]+)?\b/gi) || [];
  const candidateWords = words.filter(w => !excludeWords.test(w));
  
  // Look for 2-3 consecutive candidate words (first/last name or first/middle/last)
  let playerName: string | undefined;
  for (let i = 0; i < candidateWords.length - 1; i++) {
    const twoWords = `${candidateWords[i]} ${candidateWords[i + 1]}`;
    // Prefer longer match if available
    if (i < candidateWords.length - 2) {
      const threeWords = `${candidateWords[i]} ${candidateWords[i + 1]} ${candidateWords[i + 2]}`;
      if (threeWords.length >= 6) {
        playerName = threeWords;
        break;
      }
    }
    if (twoWords.length >= 4) {
      playerName = twoWords;
      break;
    }
  }

  const hasWeek = !!weekMatch || !!relMatch;

  // Weekly query = player name + week indicator + stat verb
  if (playerName && hasWeek && hasVerb) {
    return {
      isWeeklyQuery: true,
      week: weekMatch ? parseInt(weekMatch[2]) : undefined,
      relativeWeek: relMatch ? (relMatch[1] as 'last' | 'this') : undefined,
      playerName,
    };
  }

  return { isWeeklyQuery: false };
}

// ========================================
// HELPER 2: FETCH WEEKLY STATS FROM API
// ========================================

/**
 * Fetches weekly stats for a player from /api/weekly/player endpoint
 * 
 * @param query - Parsed weekly query
 * @param season - NFL season (default: CURRENT_NFL_SEASON)
 * @returns WeeklyStatsResult or null if not found
 */
export async function fetchWeeklyStatsForPlayer(
  query: WeeklyQuery,
  season: number = CURRENT_NFL_SEASON
): Promise<WeeklyStatsResult | null> {
  if (!query.isWeeklyQuery || !query.playerName) {
    return null;
  }

  let week = query.week;
  
  // Resolve relative week references
  if (query.relativeWeek && !week) {
    const currentWeek = getCurrentNFLWeek(season);
    if (!currentWeek) {
      console.warn(`[Weekly Stats] Cannot resolve "${query.relativeWeek} week" - season ${season} not started or no current week available`);
      return null;
    }
    
    if (query.relativeWeek === 'last') {
      week = Math.max(1, currentWeek - 1); // Clamp to Week 1 minimum
    } else if (query.relativeWeek === 'this') {
      week = currentWeek;
    }
    
    console.log(`[Weekly Stats] Resolved "${query.relativeWeek} week" to Week ${week} (current: ${currentWeek})`);
  }

  if (!week || week < 1 || week > 18) {
    console.warn(`[Weekly Stats] Invalid week number: ${week}`);
    return null;
  }

  try {
    // Call our internal API endpoint
    const url = `http://localhost:5000/api/weekly/player?season=${season}&week=${week}&player=${encodeURIComponent(query.playerName)}&scoring=half`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[Weekly Stats] API returned ${response.status} for ${query.playerName} Week ${week}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.success) {
      console.warn(`[Weekly Stats] API returned success:false for ${query.playerName} Week ${week}`);
      return null;
    }

    // Normalize API response to WeeklyStatsResult
    return {
      season: data.season,
      week: data.week,
      playerId: data.playerId,
      playerName: data.playerName,
      team: data.team,
      pos: data.pos,
      scoring: data.fantasyPoints,
      line: data.line,
      usage: data.usage,
    };
  } catch (error) {
    console.error(`[Weekly Stats] Error fetching stats for ${query.playerName}:`, error);
    return null;
  }
}

// ========================================
// HELPER 3: FORMAT AS [DATA] CHUNK
// ========================================

/**
 * Formats weekly stats as a [DATA: WEEKLY_STATLINE] block for RAG context
 * 
 * @param ws - Weekly stats result
 * @returns Formatted text block with ground truth data
 */
export function formatWeeklyStatlineDataChunk(ws: WeeklyStatsResult): string {
  // Build stat line text dynamically based on position
  let statLine = '';
  
  // Receiving stats (WR, TE, RB)
  if (ws.line.receptions !== undefined || ws.line.targets !== undefined) {
    statLine += `${ws.line.receptions ?? 0} receptions on ${ws.line.targets ?? 0} targets for ${ws.line.recYds ?? 0} yards`;
    if (ws.line.recTD && ws.line.recTD > 0) {
      statLine += ` and ${ws.line.recTD} receiving TD${ws.line.recTD > 1 ? 's' : ''}`;
    }
  }
  
  // Rushing stats (RB, QB)
  if (ws.line.carries !== undefined && ws.line.carries > 0) {
    if (statLine) statLine += ', plus ';
    statLine += `${ws.line.carries} carries for ${ws.line.rushYds ?? 0} rushing yards`;
    if (ws.line.rushTD && ws.line.rushTD > 0) {
      statLine += ` and ${ws.line.rushTD} rushing TD${ws.line.rushTD > 1 ? 's' : ''}`;
    }
  }
  
  // Passing stats (QB)
  if (ws.line.passYds !== undefined && ws.line.passYds > 0) {
    if (statLine) statLine += ', plus ';
    statLine += `${ws.line.passYds} passing yards`;
    if (ws.line.passTD && ws.line.passTD > 0) {
      statLine += ` and ${ws.line.passTD} passing TD${ws.line.passTD > 1 ? 's' : ''}`;
    }
    if (ws.line.int && ws.line.int > 0) {
      statLine += `, ${ws.line.int} INT${ws.line.int > 1 ? 's' : ''}`;
    }
  }
  
  // If no stats at all (decoy game, injury, etc.)
  if (!statLine) {
    statLine = 'No recorded stats (DNP or decoy role)';
  }

  return `[DATA: WEEKLY_STATLINE]
Player: ${ws.playerName} (${ws.team}, ${ws.pos})
Week: ${ws.week}, Season: ${ws.season}
Scoring (half-PPR): ${ws.scoring.half.toFixed(1)} fantasy points
Stat line: ${statLine}.
${ws.usage.snaps ? `Usage: ${ws.usage.snaps} snaps` : ''}${ws.usage.routes ? `, ${ws.usage.routes} routes` : ''}
[/DATA]`.trim();
}

/**
 * Generates metadata object for weekly statline chunk
 */
export function weeklyStatlineMetadata(ws: WeeklyStatsResult) {
  return {
    type: 'weekly_statline',
    season: ws.season,
    week: ws.week,
    player: ws.playerName,
    epistemic_status: 'DATA',
    format_hint: 'redraft',
  };
}
