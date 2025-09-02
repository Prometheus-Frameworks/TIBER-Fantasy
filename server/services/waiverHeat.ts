/**
 * Waiver Heat Calculation Service
 * Implements Grok's formula with guardrails and Tiber's truth-first approach
 */

// ========================================
// CORE WAIVER HEAT CALCULATION (Grok's Formula)
// ========================================

export interface WaiverHeatInputs {
  usageGrowth: number;      // 0-1 normalized
  opportunityDelta: number; // 0-1 normalized  
  marketLag: number;        // 0-1 normalized
  newsWeight: number;       // 0-1 normalized
}

/**
 * Calculate Waiver Heat Index using Grok's weighted formula
 * Formula: 40% Usage + 30% Opportunity + 20% Market + 10% News
 */
export function calculateWaiverHeat(inputs: WaiverHeatInputs): number {
  const { usageGrowth, opportunityDelta, marketLag, newsWeight } = inputs;
  
  // Grok's exact weighting formula
  const score = (
    0.40 * usageGrowth +      // Usage Growth (0-40 points)
    0.30 * opportunityDelta + // Opportunity Delta (0-30 points)  
    0.20 * marketLag +        // Market Lag (0-20 points)
    0.10 * newsWeight         // News Weight (0-10 points)
  );
  
  // Return as 0-100 integer
  return Math.round(Math.max(1, Math.min(100, score * 100)));
}

// ========================================
// USAGE GROWTH CALCULATION
// ========================================

export interface WeeklyUsageStats {
  snapPct: number;
  routes: number;
  targets: number;
  carries: number;
  touches: number;
}

/**
 * Calculate usage growth with Grok's normalization approach
 * Addresses Grok's concern about arbitrary divisors by making them data-driven
 */
export function calculateUsageGrowth(
  current: WeeklyUsageStats, 
  previous: WeeklyUsageStats,
  position: 'QB' | 'RB' | 'WR' | 'TE'
): number {
  if (!previous) return 0; // No baseline data
  
  // Grok's fix: Handle NaN values 
  const safeNum = (val: number) => isNaN(val) || !isFinite(val) ? 0 : val;
  
  // Position-specific growth calculations
  switch (position) {
    case 'WR':
    case 'TE':
      return calculateReceivingGrowth(current, previous);
    case 'RB':
      return calculateRushingGrowth(current, previous);
    case 'QB':
      return calculateQBGrowth(current, previous);
    default:
      return 0;
  }
}

function calculateReceivingGrowth(current: WeeklyUsageStats, previous: WeeklyUsageStats): number {
  const snapGrowth = Math.max(0, current.snapPct - previous.snapPct) / 100;
  const routeGrowth = Math.max(0, current.routes - previous.routes) / Math.max(15, previous.routes || 15);
  const targetGrowth = Math.max(0, current.targets - previous.targets) / Math.max(8, previous.targets || 8);
  
  // Weighted combination for receivers (snaps most important)
  const rawGrowth = (snapGrowth * 0.5) + (routeGrowth * 0.3) + (targetGrowth * 0.2);
  return clamp(rawGrowth * 2); // Scale to 0-1 range
}

function calculateRushingGrowth(current: WeeklyUsageStats, previous: WeeklyUsageStats): number {
  const snapGrowth = Math.max(0, current.snapPct - previous.snapPct) / 100;
  const carryGrowth = Math.max(0, current.carries - previous.carries) / Math.max(12, previous.carries || 12);
  const touchGrowth = Math.max(0, current.touches - previous.touches) / Math.max(15, previous.touches || 15);
  
  // Weighted combination for RBs (touches most important)
  const rawGrowth = (snapGrowth * 0.3) + (carryGrowth * 0.4) + (touchGrowth * 0.3);
  return clamp(rawGrowth * 2.5); // Scale to 0-1 range
}

function calculateQBGrowth(current: WeeklyUsageStats, previous: WeeklyUsageStats): number {
  // QBs have different usage patterns - focus on snap percentage
  const snapGrowth = Math.max(0, current.snapPct - previous.snapPct) / 100;
  return clamp(snapGrowth * 3); // QBs need significant snap % changes
}

// ========================================
// OPPORTUNITY DELTA CALCULATION  
// ========================================

export interface OpportunityContext {
  injuryOpening: boolean;
  depthChartMovement: number; // +/- positions moved (e.g., -1 = moved up one spot)
  teamTargetShare: number;    // Team's total target/carry opportunity
  seasonContext: 'early' | 'mid' | 'late'; // Different opportunity values by season
}

/**
 * Calculate opportunity delta from injuries and depth chart changes
 */
export function calculateOpportunityDelta(context: OpportunityContext): number {
  let score = 0;
  
  // Injury opening boost
  if (context.injuryOpening) {
    score += 0.6; // Major opportunity from injury
  }
  
  // Depth chart movement
  const depthBoost = Math.max(0, -context.depthChartMovement) * 0.2; // Moving up depth chart
  score += Math.min(0.4, depthBoost); // Cap depth chart boost
  
  // Season context modifier
  const seasonMultiplier = context.seasonContext === 'early' ? 1.2 : 
                          context.seasonContext === 'late' ? 0.8 : 1.0;
  
  return clamp(score * seasonMultiplier);
}

// ========================================
// MARKET LAG CALCULATION
// ========================================

export interface MarketContext {
  rostership: number;    // 0-1 current rostership %
  startPct: number;     // 0-1 current start %  
  adpDelta: number;     // Recent ADP movement (negative = falling)
  usageTrend: number;   // Recent usage trend (0-1)
}

/**
 * Calculate market lag - when usage outpaces market recognition
 */
export function calculateMarketLag(context: MarketContext): number {
  // Market inefficiency when usage is high but rostership/starts are low
  const rostershipGap = Math.max(0, context.usageTrend - context.rostership);
  const startGap = Math.max(0, context.usageTrend - context.startPct);
  
  // ADP lag (falling ADP despite rising usage)
  const adpLag = context.adpDelta < 0 && context.usageTrend > 0.3 ? 0.3 : 0;
  
  const totalLag = (rostershipGap * 0.4) + (startGap * 0.4) + (adpLag * 0.2);
  return clamp(totalLag);
}

// ========================================
// NEWS WEIGHT CALCULATION
// ========================================

export interface NewsContext {
  coachQuotes: number;      // Number of positive coach mentions
  beatReports: number;      // Number of beat reporter mentions  
  roleClarity: number;      // 0-1 how clear the role expansion is
  corroborationGames: number; // Games of usage supporting the narrative
}

/**
 * Calculate news weight with Grok's corroboration requirement
 * Caps at 0.5 unless corroborated by actual usage
 */
export function calculateNewsWeight(context: NewsContext): number {
  let baseWeight = 0;
  
  // Coach quotes are most valuable
  baseWeight += Math.min(0.4, context.coachQuotes * 0.15);
  
  // Beat reports add credibility  
  baseWeight += Math.min(0.3, context.beatReports * 0.1);
  
  // Role clarity multiplier
  baseWeight *= Math.max(0.3, context.roleClarity);
  
  // Grok's guardrail: Cap at 0.5 unless corroborated by 2+ games of usage
  if (context.corroborationGames < 2) {
    baseWeight = Math.min(0.5, baseWeight);
  }
  
  return clamp(baseWeight);
}

// ========================================
// UTILITIES AND GUARDRAILS
// ========================================

/**
 * Clamp value to 0-1 range with NaN protection (Grok's fix)
 */
export function clamp(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Identify if player is a rookie based on draft year
 * Handles UDFAs per Grok's edge case concern
 */
export function isRookie(draftYear: number | null, season: number): boolean {
  if (!draftYear) return false; // Handle UDFAs - need manual flagging
  return draftYear === season;
}

/**
 * Weekly snapshot calculation for Hybrid Model backbone
 */
export function calculateWeeklySnapshot(
  playerId: number,
  season: number, 
  week: number,
  usageData: WeeklyUsageStats[],
  contextData: OpportunityContext,
  marketData: MarketContext,
  newsData: NewsContext,
  position: 'QB' | 'RB' | 'WR' | 'TE'
) {
  // Get current and previous week usage
  const current = usageData[usageData.length - 1];
  const previous = usageData[usageData.length - 2];
  
  // Calculate all four components
  const usageGrowth = calculateUsageGrowth(current, previous, position);
  const opportunityDelta = calculateOpportunityDelta(contextData);
  const marketLag = calculateMarketLag(marketData);
  const newsWeight = calculateNewsWeight(newsData);
  
  // Calculate final Waiver Heat using Grok's formula
  const waiverHeat = calculateWaiverHeat({
    usageGrowth,
    opportunityDelta,
    marketLag,
    newsWeight
  });
  
  return {
    playerId,
    season,
    week,
    usageGrowth,
    opportunityDelta,
    marketLag,
    newsWeight,
    waiverHeat
  };
}