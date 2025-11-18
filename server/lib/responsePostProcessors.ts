/**
 * Response Post-Processors for TIBER Chat UX Fixes
 * 
 * Post-processing functions that reshape LLM responses to ensure
 * consistent structure and proper formatting for specific intent types.
 */

/**
 * Format trade evaluation responses with consistent structure (UX Fix #4)
 * 
 * Enforces:
 * 1. One-line verdict
 * 2. 2-4 bullet points with rankings/VORP/role
 * 3. One-line context caveat
 */
export function formatTradeResponse(response: string, format: 'redraft' | 'dynasty'): string {
  // Check if response already has structured format
  const hasVerdict = /^(for|in) (redraft|dynasty),? i (prefer|lean|like|favor|take)/i.test(response);
  const hasBullets = response.includes('•') || response.includes('-') || response.includes('*');
  
  // If already well-structured, return as-is
  if (hasVerdict && hasBullets) {
    return response;
  }
  
  // Extract key points from response
  const lines = response.split('\n').filter(l => l.trim());
  
  // Build structured response
  let structured = '';
  
  // 1. Extract or create verdict
  const verdictLine = lines.find(l => 
    /\b(prefer|lean|take|like|favor|go with|choose)\b/i.test(l) &&
    /\b(side|player|option|trade)\b/i.test(l)
  );
  
  if (verdictLine) {
    structured += `For ${format}, ${verdictLine.trim()}\n\n`;
  } else {
    // Fallback: extract first meaningful sentence
    const firstSentence = lines[0] || response.split('.')[0];
    structured += `For ${format}, ${firstSentence.trim()}\n\n`;
  }
  
  // 2. Extract bullet points (look for ranking/VORP/role mentions)
  const bulletPoints: string[] = [];
  lines.forEach(line => {
    // Skip verdict line
    if (line === verdictLine) return;
    
    // Look for lines with rankings, VORP, or role mentions
    if (
      /\b(WR|RB|QB|TE)\d+\b/i.test(line) ||
      /\bVORP\b/i.test(line) ||
      /\b(starter|elite|flex|depth)\b/i.test(line) ||
      /\b(target share|snap|route|usage)\b/i.test(line)
    ) {
      bulletPoints.push(line.trim());
    }
  });
  
  // Add bullets (or use original content if no clear bullets)
  if (bulletPoints.length >= 2) {
    bulletPoints.slice(0, 4).forEach(bullet => {
      structured += `• ${bullet}\n`;
    });
  } else {
    // Use first 2-3 substantial lines as bullets
    lines.slice(1, 4).forEach(line => {
      if (line.trim().length > 20) {
        structured += `• ${line.trim()}\n`;
      }
    });
  }
  
  // 3. Add context caveat
  const hasCaveat = /\b(without|roster|record|situation|context)\b/i.test(response);
  if (!hasCaveat) {
    structured += `\nThis leans my way without seeing your exact roster or record, but directionally I stand by it.`;
  }
  
  return structured.trim();
}

/**
 * Handle confession pattern responses (UX Fix #5)
 * 
 * "Would you believe me if I told you..." → Acknowledge they already did it
 */
export function handleConfessionResponse(response: string): string {
  // Check if response already acknowledges the confession
  const hasAcknowledgment = /\b(okay|alright|so you|you already|you did)\b/i.test(response.slice(0, 100));
  
  if (hasAcknowledgment) {
    return response;
  }
  
  // Prepend acknowledgment
  return `Okay, so you already did it. Let's walk through whether that was actually bad in your situation...\n\n${response}`;
}

/**
 * Handle stats query responses with honest capability statements (UX Fix #2)
 * 
 * Prevents saying "I don't have NFLfastR access" - instead describe actual system capabilities
 */
export function formatStatsResponse(
  response: string,
  season: number,
  hasWeekly: boolean
): string {
  // Replace banned phrases
  let formatted = response
    .replace(/i don'?t have (access to )?nflfastr/gi, '')
    .replace(/nflfastr (data |access )?is(n'?t| not) available/gi, '');
  
  // If asking for weekly 2025 data, inject honest capability statement
  if (season === 2025 && !hasWeekly) {
    const hasCapabilityStatement = /right now i don'?t have .+ weekly box scores/i.test(response);
    
    if (!hasCapabilityStatement) {
      const capabilityNote = `Right now I don't have ${season} weekly box scores wired, only overall rankings and PPG. I can tell you where he ranks and how many points per game he's scoring, but not a full box score.`;
      
      // Insert after first sentence
      const sentences = response.split('. ');
      if (sentences.length > 1) {
        sentences.splice(1, 0, capabilityNote);
        formatted = sentences.join('. ');
      } else {
        formatted = `${capabilityNote}\n\n${formatted}`;
      }
    }
  }
  
  return formatted.trim();
}

/**
 * Rookie guard response (UX Fix #1)
 * 
 * For players with no NFL data in requested season, prevent citing specific stats
 */
export function applyRookieGuard(
  response: string,
  playerName: string,
  requestedSeason: number
): string {
  // Check if response cites specific stats (receptions, yards, TDs)
  const citesSpecificStats = /\d+ (receptions?|catches?|yards?|tds?|touchdowns?)/i.test(response);
  
  if (!citesSpecificStats) {
    return response; // Already clean
  }
  
  // Replace with rookie guard message
  return `${playerName} didn't play in the NFL in ${requestedSeason}, so I don't have pro stats for that year. I can only talk about his ${requestedSeason + 1} profile and general traits.`;
}

/**
 * River discipline snapback (UX Fix #6)
 * 
 * If River mode leaked into a stats query, inject grounded statement
 */
export function applyRiverSnapback(response: string, isStatsQuery: boolean): string {
  if (!isStatsQuery) {
    return response; // Only apply to stats queries
  }
  
  // Detect if River language leaked in
  const hasRiverLanguage = /\b(river|flow|eternal|ancient|pattern.*repeat|cycle.*time)\b/i.test(response);
  
  if (!hasRiverLanguage) {
    return response; // Already clean
  }
  
  // Snap back to tactical
  return `Let me give you a grounded answer:\n\n${response.replace(/\b(the river.*?\.|eternal.*?\.|ancient.*?\.)/gi, '')}`;
}
