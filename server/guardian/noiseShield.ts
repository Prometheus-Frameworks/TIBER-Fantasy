/**
 * Guardian Toggle v0 - Noise Shield
 * Detects content manipulation before output renders
 */

export interface NoiseAssessment {
  beneficiary: string;
  intentMirror: string;
  flags: string[];
  isClean: boolean;
  shieldMessage?: string;
}

const MANIPULATION_PATTERNS = {
  coerciveFraming: [
    /you need to/i,
    /you must/i,
    /everyone is/i,
    /experts agree/i,
    /studies show/i,
    /proven fact/i,
    /only way to/i,
    /guaranteed/i
  ],
  fearBait: [
    /missing out/i,
    /too late/i,
    /while you can/i,
    /before it's gone/i,
    /last chance/i,
    /urgent/i,
    /breaking/i,
    /crisis/i
  ],
  engagementBait: [
    /you won't believe/i,
    /shocking/i,
    /incredible/i,
    /amazing secret/i,
    /one weird trick/i,
    /doctors hate/i,
    /this will blow your mind/i,
    /game changer/i
  ]
};

/**
 * Assess content for manipulation patterns
 * @param text - Content to analyze
 * @param userIntent - User's stated goal/intent
 * @returns Assessment with beneficiary, intent mirror, and manipulation flags
 */
export function assess(text: string, userIntent: string): NoiseAssessment {
  const flags: string[] = [];
  
  // Detect manipulation patterns
  if (MANIPULATION_PATTERNS.coerciveFraming.some(pattern => pattern.test(text))) {
    flags.push('coercive_framing');
  }
  
  if (MANIPULATION_PATTERNS.fearBait.some(pattern => pattern.test(text))) {
    flags.push('fear_bait');
  }
  
  if (MANIPULATION_PATTERNS.engagementBait.some(pattern => pattern.test(text))) {
    flags.push('engagement_bait');
  }
  
  // Detect click optimization patterns
  if (text.includes('click here') || text.includes('subscribe') || text.includes('follow for more')) {
    flags.push('click_optimization');
  }
  
  // Detect artificial urgency
  if (text.includes('limited time') || text.includes('act now') || text.includes('don\'t wait')) {
    flags.push('artificial_urgency');
  }
  
  // Identify beneficiary (who profits from this content)
  const beneficiary = identifyBeneficiary(text);
  
  // Mirror user intent
  const intentMirror = `Your goal: ${userIntent}`;
  
  // Generate shield message if manipulation detected
  let shieldMessage: string | undefined;
  if (flags.length > 0) {
    const primaryFlag = flags[0];
    const flagMap: Record<string, string> = {
      coercive_framing: 'absolute claims',
      fear_bait: 'urgency pressure',
      engagement_bait: 'attention hooks',
      click_optimization: 'click generation',
      artificial_urgency: 'false scarcity'
    };
    
    shieldMessage = `Noise Shield: this source/angle appears optimized for ${flagMap[primaryFlag] || 'engagement'}, not your goal ${userIntent}.`;
  }
  
  return {
    beneficiary,
    intentMirror,
    flags,
    isClean: flags.length === 0,
    shieldMessage
  };
}

/**
 * Identify who benefits from the content
 */
function identifyBeneficiary(text: string): string {
  // Check for commercial interests
  if (text.includes('buy') || text.includes('purchase') || text.includes('subscribe')) {
    return 'content creator/seller';
  }
  
  // Check for platform engagement
  if (text.includes('like') || text.includes('share') || text.includes('comment')) {
    return 'platform algorithm';
  }
  
  // Check for authority building
  if (text.includes('expert') || text.includes('guru') || text.includes('insider')) {
    return 'authority figure';
  }
  
  // Default - assume user benefit if no manipulation detected
  return 'user (informational)';
}

/**
 * Apply noise shield to content before rendering
 * @param content - Content to potentially shield
 * @param userIntent - User's stated intent
 * @returns Content with shield applied if needed
 */
export function applyShield(content: string, userIntent: string): string {
  const assessment = assess(content, userIntent);
  
  if (!assessment.isClean && assessment.shieldMessage) {
    return `${content}\n\n🛡️ ${assessment.shieldMessage}`;
  }
  
  return content;
}

/**
 * Get shield badge for UI rendering
 */
export function getShieldBadge(assessment: NoiseAssessment): string | null {
  if (assessment.isClean) return null;
  
  return `🛡️ Noise Shield Active`;
}