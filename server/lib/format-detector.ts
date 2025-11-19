/**
 * TIBER FORMAT BRAIN - Redraft vs Dynasty Detection
 * 
 * Detects whether user query is focused on:
 * - Redraft: Weekly matchups, rest-of-season, start/sit, waivers
 * - Dynasty: Long-term value, age curves, picks, windows, insulation
 * - Neutral: General player evaluation, greetings, ambiguous queries
 * 
 * Composable with existing 3-layer system (tactical/teaching/river)
 */

export type Format = 'redraft' | 'dynasty' | 'neutral';

export interface FormatDetectionResult {
  format: Format;
  confidence: number;
  reasons: string[];
}

/**
 * Redraft signals: Weekly focus, matchups, immediate decisions
 */
const REDRAFT_SIGNALS = [
  // Explicit redraft mentions
  { pattern: /\bredraft\b/i, weight: 2.0, reason: 'Explicit "redraft" mention' },
  { pattern: /\bhalf ppr\b|\bfull ppr\b|\bstandard\b/i, weight: 1.0, reason: 'Scoring format (redraft context)' },
  
  // Weekly/temporal focus
  { pattern: /\b(this|next|last) week\b/i, weight: 1.5, reason: 'Weekly time reference' },
  { pattern: /\bweek \d+\b/i, weight: 1.3, reason: 'Specific week number' },
  { pattern: /\btonight\b|\bsunday\b|\bthursday\b|\bmonday\b/i, weight: 1.2, reason: 'Game day reference' },
  { pattern: /\bmatchup\b/i, weight: 1.0, reason: 'Matchup focus' },
  
  // Start/sit decisions
  { pattern: /\bstart .+ or .+\b/i, weight: 1.5, reason: 'Start/sit decision' },
  { pattern: /\b(should i|do i) (start|sit|play|bench)\b/i, weight: 1.5, reason: 'Start/sit question' },
  
  // Waiver wire
  { pattern: /\bwaiver\b/i, weight: 1.3, reason: 'Waiver wire mention' },
  { pattern: /\bpick up\b|\bdrop\b/i, weight: 0.9, reason: 'Add/drop decision' },
  
  // ROS / Playoff focus
  { pattern: /\brest of season\b|\bROS\b/i, weight: 1.0, reason: 'Rest of season focus' },
  { pattern: /\bplayoff(s)? (schedule|run)\b/i, weight: 1.0, reason: 'Playoff schedule' },
  { pattern: /\bweeks? \d+-\d+\b/i, weight: 0.8, reason: 'Week range (ROS context)' },
];

/**
 * Dynasty signals: Long-term value, picks, windows, age
 */
const DYNASTY_SIGNALS = [
  // Explicit dynasty mentions
  { pattern: /\bdynasty\b/i, weight: 2.5, reason: 'Explicit "dynasty" mention' },
  { pattern: /\bkeeper\b/i, weight: 1.5, reason: 'Keeper league mention' },
  
  // Draft picks
  { pattern: /\b20\d{2} (1st|2nd|3rd|first|second|third|pick)\b/i, weight: 2.0, reason: 'Future draft pick' },
  { pattern: /\b(1st|2nd|3rd|first|second|third)( round)? pick\b/i, weight: 1.5, reason: 'Draft pick discussion' },
  { pattern: /\b(trade|get|give|for|plus|\+).*?(a|the) (1st|2nd|3rd)\b/i, weight: 1.3, reason: 'Draft pick in trade context' },
  { pattern: /\bpick(s)?\b.*\btrade\b|\btrade\b.*\bpick(s)?\b/i, weight: 1.2, reason: 'Trade involving picks' },
  
  // Windows and timeline
  { pattern: /\b(contend|contending|rebuild|rebuilding|window)\b/i, weight: 1.5, reason: 'Window/rebuild language' },
  { pattern: /\blong[- ]term\b/i, weight: 1.2, reason: 'Long-term focus' },
  { pattern: /\b(next|20\d{2}) (year|season)\b|\bfor 20\d{2}\b/i, weight: 1.0, reason: 'Future season focus' },
  
  // Age and career arc
  { pattern: /\bage curve\b/i, weight: 1.8, reason: 'Age curve mention' },
  { pattern: /\byoung (asset|player|talent|rb|wr|qb|te)\b/i, weight: 1.0, reason: 'Young asset focus' },
  { pattern: /\b(breakout|sophomore|rookie) (season|potential|candidate)\b/i, weight: 0.7, reason: 'Development arc' },
  
  // Insulation and value
  { pattern: /\binsulation\b/i, weight: 1.5, reason: 'Insulation (dynasty concept)' },
  { pattern: /\basset value\b/i, weight: 1.2, reason: 'Asset value focus' },
  { pattern: /\b(sell high|buy low)\b/i, weight: 1.0, reason: 'Asset trading strategy' },
];

/**
 * Main format detection with confidence scoring
 */
export function detectFormat(message: string): FormatDetectionResult {
  let redraftScore = 0;
  let dynastyScore = 0;
  const redraftReasons: string[] = [];
  const dynastyReasons: string[] = [];
  
  // Score redraft signals
  for (const signal of REDRAFT_SIGNALS) {
    if (signal.pattern.test(message)) {
      redraftScore += signal.weight;
      redraftReasons.push(signal.reason);
    }
  }
  
  // Score dynasty signals
  for (const signal of DYNASTY_SIGNALS) {
    if (signal.pattern.test(message)) {
      dynastyScore += signal.weight;
      dynastyReasons.push(signal.reason);
    }
  }
  
  // Determine format and confidence
  const totalScore = redraftScore + dynastyScore;
  
  // If no strong signals, default to neutral (avoid dynasty/redraft assumptions on greetings)
  if (totalScore < 0.3) {
    return {
      format: 'neutral',
      confidence: 0.5,
      reasons: ['No strong format signals - neutral mode (general player evaluation)'],
    };
  }
  
  // Calculate confidence based on score separation
  const format: Format = dynastyScore > redraftScore ? 'dynasty' : 'redraft';
  const winningScore = Math.max(redraftScore, dynastyScore);
  const losingScore = Math.min(redraftScore, dynastyScore);
  
  // Confidence = how much the winning format dominates
  // Explicit keywords (dynasty, redraft, 2026 1st) should give high confidence
  const hasExplicitKeyword = format === 'dynasty'
    ? /\bdynasty\b|\b20\d{2} (1st|2nd|3rd)/i.test(message)
    : /\bredraft\b/i.test(message);
  
  let confidence: number;
  
  if (hasExplicitKeyword) {
    // Explicit keyword = high confidence (0.85-0.95)
    confidence = 0.85 + Math.min(0.1, winningScore * 0.05);
  } else if (losingScore === 0) {
    // No competing signals = strong confidence
    confidence = 0.75 + Math.min(0.2, winningScore * 0.05);
  } else {
    // Calculate based on score ratio
    const scoreRatio = winningScore / losingScore;
    
    if (scoreRatio >= 3.0) {
      confidence = 0.8 + Math.min(0.15, scoreRatio / 20);
    } else if (scoreRatio >= 2.0) {
      confidence = 0.65 + (scoreRatio - 2.0) * 0.15;
    } else {
      confidence = 0.5 + scoreRatio * 0.075;
    }
  }
  
  // Cap confidence at 0.95 (never 100% certain)
  confidence = Math.min(0.95, confidence);
  
  // Return only the winning format's reasons for clearer logging
  const winningReasons = format === 'dynasty' ? dynastyReasons : redraftReasons;
  
  return {
    format,
    confidence,
    reasons: winningReasons,
  };
}

/**
 * Simple format detection without detailed reasoning (for performance)
 */
export function detectFormatSimple(message: string): Format {
  return detectFormat(message).format;
}

/**
 * Helper to log format detection results
 */
export function logFormatDetection(message: string, result: FormatDetectionResult): void {
  console.log(
    `[FORMAT-DETECTION] ${result.format.toUpperCase()} (${(result.confidence * 100).toFixed(0)}%)`,
    result.reasons.length > 0 ? `Reasons: ${result.reasons.join('; ')}` : ''
  );
}
