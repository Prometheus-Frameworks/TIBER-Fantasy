/**
 * Waiver Candidates Builder
 * Calculates interest scores, tiers, and archetypes for waiver wire recommendations
 * 
 * Algorithm:
 * - Interest Score (0-100) = weighted combination:
 *   - Recent production (35%): Last 1-3 weeks fantasy points
 *   - Opportunity delta (30%): Change in targets/carries/WOPR
 *   - Efficiency (15%): EPA vs position baseline
 *   - Ecosystem (10%): Team scoring rank, pace
 *   - Archetype bonus (10%): Handcuff, injury fill, etc.
 */

import { db } from '../infra/db';
import { waiverCandidates, sleeperOwnership, weeklyStats } from '@shared/schema';
import { sql, and, eq, gte, lte, desc, isNotNull } from 'drizzle-orm';

interface WaiverBuilderOptions {
  season: number;
  week: number;
  ownershipThreshold?: number; // Default: 50%
  minPoints?: number; // Minimum fantasy points to consider (default: 8 half-PPR)
}

interface PlayerStats {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  ownershipPercentage: number;
  
  // Recent production (last 3 weeks)
  recentPpg: number;
  weeksPpg: number[];
  
  // Usage metrics
  recentTargets: number;
  recentCarries: number;
  recentRoutes: number;
  recentSnaps: number;
  
  // Advanced metrics (if available)
  wopr: number | null;
  targetShare: number | null;
  rushShare: number | null;
  epaPerPlay: number | null;
}

/**
 * Calculate interest score for a player using weighted formula:
 * 35% usage + 30% trending + 15% efficiency + 10% ecosystem + 10% archetype
 */
function calculateInterestScore(player: PlayerStats, archetype: 'breakout' | 'handcuff' | 'injury_replacement' | 'role_shift' | 'trap'): number {
  let score = 0;
  
  // 1. Usage Score (35% weight, 0-35 points)
  // Measures total opportunity (targets + carries)
  const totalOpportunity = player.recentTargets + player.recentCarries;
  const usageScore = Math.min(35, (totalOpportunity / 20) * 35);
  score += usageScore;
  
  // 2. Trending Score (30% weight, 0-30 points)
  // Measures week-over-week growth across all recent weeks
  const weeksPpg = player.weeksPpg;
  let trendingScore = 15; // Neutral default
  
  if (weeksPpg.length >= 2) {
    // Calculate week-over-week changes
    const weekChanges: number[] = [];
    for (let i = 1; i < weeksPpg.length; i++) {
      const prev = weeksPpg[i - 1];
      const curr = weeksPpg[i];
      if (prev > 0) {
        weekChanges.push((curr - prev) / prev); // % change
      }
    }
    
    // Average the week-over-week changes to get trend momentum
    if (weekChanges.length > 0) {
      const avgChange = weekChanges.reduce((sum, c) => sum + c, 0) / weekChanges.length;
      
      // Map average change to 0-30 points (proportional scaling)
      // +50% avg growth = 30 points (strong uptrend)
      // 0% avg growth = 15 points (flat)
      // -50% avg decline = 0 points (strong downtrend)
      trendingScore = 15 + (avgChange / 0.5) * 15;
      trendingScore = Math.min(30, Math.max(0, trendingScore));
    }
  }
  
  score += trendingScore;
  
  // 3. Efficiency Score (15% weight, 0-15 points)
  // EPA per play measures offensive efficiency
  if (player.epaPerPlay !== null) {
    // EPA > 0.1 = elite, EPA > 0 = above avg, EPA < 0 = below avg
    if (player.epaPerPlay > 0.1) score += 15;
    else if (player.epaPerPlay > 0) score += 10;
    else score += 5;
  } else {
    score += 10; // Neutral if no EPA data
  }
  
  // 4. Ecosystem Score (10% weight, 0-10 points)
  // Good offense provides higher fantasy ceiling
  // TODO: Integrate team offensive EPA rankings when available
  // For now: High-volume passing offenses get bonus
  const ecosystemScore = player.recentRoutes > 20 ? 10 : 5;
  score += ecosystemScore;
  
  // 5. Archetype Bonus (10% weight, 0-10 points)
  // Directly tied to classified archetype
  const archetypeWeights: Record<string, number> = {
    breakout: 10,           // Full points - high upside
    injury_replacement: 8,  // Strong short-term value
    role_shift: 7,          // Emerging opportunity
    trap: 3,               // Low trust - TD-dependent
    handcuff: 2,           // Minimal current value
  };
  score += archetypeWeights[archetype] || 5;
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Determine tier based on interest score
 */
function calculateTier(interestScore: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (interestScore >= 85) return 'S';
  if (interestScore >= 70) return 'A';
  if (interestScore >= 55) return 'B';
  if (interestScore >= 40) return 'C';
  return 'D';
}

/**
 * Classify player archetype
 */
function classifyArchetype(player: PlayerStats): 'breakout' | 'handcuff' | 'injury_replacement' | 'role_shift' | 'trap' {
  // Simple heuristic-based classification (can be enhanced)
  
  // Trap detection: Low usage despite points (TD-dependent)
  if (player.recentPpg > 12 && (player.recentTargets + player.recentCarries) < 8) {
    return 'trap';
  }
  
  // Breakout detection: High usage + decent efficiency
  if ((player.recentTargets + player.recentCarries) >= 12 && player.recentPpg > 10) {
    return 'breakout';
  }
  
  // Handcuff detection: Low current usage (<5 touches/game)
  if ((player.recentTargets + player.recentCarries) < 5 && player.ownershipPercentage < 10) {
    return 'handcuff';
  }
  
  // Role shift: Moderate usage with upward trend
  if (player.weeksPpg.length >= 2 && player.weeksPpg[player.weeksPpg.length - 1] > player.weeksPpg[0] * 1.5) {
    return 'role_shift';
  }
  
  // Default: Injury replacement or generic add
  return 'injury_replacement';
}

/**
 * Generate FAAB range based on tier
 */
function calculateFaabRange(tier: string): { min: number; max: number } {
  switch (tier) {
    case 'S': return { min: 25, max: 50 };
    case 'A': return { min: 15, max: 30 };
    case 'B': return { min: 5, max: 15 };
    case 'C': return { min: 1, max: 10 };
    case 'D': return { min: 0, max: 0 };
    default: return { min: 0, max: 0 };
  }
}

/**
 * Calculate recent trend
 */
function calculateTrend(weeksPpg: number[]): 'rising' | 'stable' | 'declining' {
  if (weeksPpg.length < 2) return 'stable';
  
  const recent = weeksPpg[weeksPpg.length - 1];
  const previous = weeksPpg[0];
  
  if (recent > previous * 1.25) return 'rising';
  if (recent < previous * 0.75) return 'declining';
  return 'stable';
}

/**
 * Map archetype to human-readable label for display
 */
function getArchetypeLabel(archetype: 'breakout' | 'handcuff' | 'injury_replacement' | 'role_shift' | 'trap'): string {
  const labels: Record<string, string> = {
    breakout: 'Breakout Candidate',
    handcuff: 'Handcuff',
    injury_replacement: 'Injury Replacement',
    role_shift: 'Streaming Option',
    trap: 'Bench Stash',
  };
  return labels[archetype] || 'Bench Stash';
}

/**
 * Generate human-readable summary
 */
function generateSummary(player: PlayerStats, tier: string, archetype: string): string {
  const archetypeMap: Record<string, string> = {
    breakout: `${player.playerName} is showing a clear role expansion with ${player.recentTargets + player.recentCarries} touches/targets per game recently. Usage and production both trending up.`,
    handcuff: `Pure handcuff stash behind the starter. Low current role, but elite offense means instant RB2/WR3 value if injury occurs.`,
    injury_replacement: `Direct replacement filling in for injured starter. Solid short-term value while starter is out.`,
    role_shift: `${player.playerName} seeing a shift in role/usage. New opportunity opening up in the offense.`,
    trap: `One-week spike with low underlying usage. TD-dependent production without stable target/touch floor.`,
  };
  
  return archetypeMap[archetype] || `${player.playerName} available on waivers at ${player.ownershipPercentage}% rostered.`;
}

/**
 * Build waiver candidates for a given week
 */
export async function buildWaiverCandidates(options: WaiverBuilderOptions) {
  const {
    season,
    week,
    ownershipThreshold = 50,
    minPoints = 8,
  } = options;
  
  console.log(`\n📊 [Waiver Builder] Building candidates for ${season} Week ${week}...`);
  console.log(`   🎯 Ownership threshold: <${ownershipThreshold}%`);
  console.log(`   ⚡ Minimum points filter: ${minPoints} half-PPR\n`);
  
  try {
    // Get recent weeks for trend analysis
    const recentWeeks = [week - 2, week - 1, week].filter(w => w > 0);
    
    console.log(`   📈 Analyzing weeks: ${recentWeeks.join(', ')}`);
    
    // Fetch weekly stats for recent weeks
    const recentStats = await db
      .select()
      .from(weeklyStats)
      .where(
        and(
          eq(weeklyStats.season, season),
          sql`${weeklyStats.week} IN (${sql.join(recentWeeks.map(w => sql`${w}`), sql`, `)})`,
          isNotNull(weeklyStats.fantasyPointsHalf)
        )
      )
      .orderBy(weeklyStats.playerId, weeklyStats.week);
    
    console.log(`   ✅ Fetched ${recentStats.length} stat records`);
    
    // Fetch ownership data for the most recent week available in this season
    // Note: Ownership represents "current status" not "specific week", so we use latest available
    const ownershipData = await db
      .select()
      .from(sleeperOwnership)
      .where(eq(sleeperOwnership.season, season))
      .orderBy(desc(sleeperOwnership.week));
    
    console.log(`   ✅ Fetched ${ownershipData.length} ownership records`);
    
    // CRITICAL: Validate ownership data quality for fail-closed behavior
    const validOwnershipCount = ownershipData.filter(row => (row.ownershipPercentage || 0) > 0).length;
    const ownershipDataQuality = ownershipData.length > 0 
      ? (validOwnershipCount / ownershipData.length) * 100 
      : 0;
    
    console.log(`   📊 Ownership data quality: ${validOwnershipCount}/${ownershipData.length} players have >0% ownership (${ownershipDataQuality.toFixed(1)}%)`);
    
    // FAIL CLOSED: If ownership data is all zeros (bad ingestion), abort
    if (ownershipData.length > 0 && validOwnershipCount === 0) {
      throw new Error(
        `❌ FAIL CLOSED: All ${ownershipData.length} ownership records have 0% ownership. ` +
        `This indicates ownership ingestion failed. ` +
        `Run ingestSleeperOwnership.ts for ${season} Week ${week} first.`
      );
    }
    
    // Build ownership map (only include players with valid ownership data)
    const ownershipMap = new Map<string, number>();
    for (const row of ownershipData) {
      const ownership = row.ownershipPercentage || 0;
      // Only include players with real ownership data (> 0%)
      if (ownership > 0) {
        ownershipMap.set(row.playerId, ownership);
      }
    }
    
    // Group stats by player
    const playerStatsMap = new Map<string, any[]>();
    for (const stat of recentStats) {
      if (!playerStatsMap.has(stat.playerId)) {
        playerStatsMap.set(stat.playerId, []);
      }
      playerStatsMap.get(stat.playerId)!.push(stat);
    }
    
    // Calculate candidates
    const candidates: any[] = [];
    
    // Convert Map to array for iteration (fixes TS downlevelIteration error)
    for (const [playerId, stats] of Array.from(playerStatsMap.entries())) {
      const ownership = ownershipMap.get(playerId);
      
      // CRITICAL: Skip players without valid ownership data (fail closed)
      // If ownership is undefined, the player wasn't in the ownership map (0% or no data)
      if (ownership === undefined) {
        continue; // Skip - no valid ownership data
      }
      
      // Filter: 0 < ownership < threshold (strict bounds)
      // Rejects: ownership = 0 (no data) AND ownership >= 50 (too highly rostered)
      if (ownership === 0 || ownership >= ownershipThreshold) {
        continue;
      }
      
      // Get most recent stat
      const latestStat = stats[stats.length - 1];
      
      // Filter: position must be skill position
      if (!['QB', 'RB', 'WR', 'TE'].includes(latestStat.position || '')) continue;
      
      // Calculate recent PPG (with explicit types)
      const weeksPpg = stats.map((s: any) => s.fantasyPointsHalf || 0);
      const recentPpg = weeksPpg.reduce((sum: number, ppg: number) => sum + ppg, 0) / weeksPpg.length;
      
      // Filter: minimum points threshold
      if (recentPpg < minPoints) continue;
      
      // Build player stats object
      const playerData: PlayerStats = {
        playerId,
        playerName: latestStat.playerName,
        position: latestStat.position || 'UNKNOWN',
        team: latestStat.team,
        ownershipPercentage: ownership,
        recentPpg,
        weeksPpg,
        recentTargets: stats.reduce((sum: number, s: any) => sum + (s.targets || 0), 0) / stats.length,
        recentCarries: stats.reduce((sum: number, s: any) => sum + (s.rushAtt || 0), 0) / stats.length,
        recentRoutes: stats.reduce((sum: number, s: any) => sum + (s.routes || 0), 0) / stats.length,
        recentSnaps: stats.reduce((sum: number, s: any) => sum + (s.snaps || 0), 0) / stats.length,
        wopr: latestStat.wopr || null,
        targetShare: latestStat.targetShare || null,
        rushShare: null, // Not in weekly_stats yet
        epaPerPlay: latestStat.epaPerPlay || null,
      };
      
      // Calculate archetype first (needed for interest score)
      const archetype = classifyArchetype(playerData);
      
      // Calculate interest score using archetype
      const interestScore = calculateInterestScore(playerData, archetype);
      const tier = calculateTier(interestScore);
      const faab = calculateFaabRange(tier);
      const trend = calculateTrend(weeksPpg);
      const summary = generateSummary(playerData, tier, archetype);
      
      candidates.push({
        season,
        week,
        playerId,
        playerName: playerData.playerName,
        position: playerData.position,
        team: playerData.team,
        ownershipPercentage: ownership,
        interestScore,
        waiverTier: tier,
        archetype, // Raw enum value (breakout, handcuff, etc.)
        summary,
        faabMin: faab.min,
        faabMax: faab.max,
        recentPpg,
        recentTrend: trend,
      });
    }
    
    console.log(`\n   📋 Generated ${candidates.length} waiver candidates`);
    
    // Clear existing candidates for this week
    await db
      .delete(waiverCandidates)
      .where(
        and(
          eq(waiverCandidates.season, season),
          eq(waiverCandidates.week, week)
        )
      );
    
    // Insert new candidates
    if (candidates.length > 0) {
      await db.insert(waiverCandidates).values(candidates);
      console.log(`   ✅ Inserted ${candidates.length} candidates into database`);
    }
    
    // Show tier distribution
    const tierCounts = candidates.reduce((acc, c) => {
      acc[c.waiverTier] = (acc[c.waiverTier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`\n   📊 Tier Distribution:`);
    for (const tier of ['S', 'A', 'B', 'C', 'D']) {
      if (tierCounts[tier]) {
        console.log(`      ${tier}-Tier: ${tierCounts[tier]} players`);
      }
    }
    
    return {
      success: true,
      candidatesGenerated: candidates.length,
      tierCounts,
    };
  } catch (error) {
    console.error('❌ [Waiver Builder] Fatal error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run waiver builder for current week
 */
async function main() {
  const currentYear = 2025;
  const currentWeek = 11; // Most recent COMPLETED week (Week 12 hasn't happened yet)
  
  console.log('🚀 Waiver Candidates Builder');
  console.log('============================\n');
  
  const result = await buildWaiverCandidates({
    season: currentYear,
    week: currentWeek,
    ownershipThreshold: 50,
    minPoints: 8,
  });
  
  if (result.success) {
    console.log('\n✅ Waiver candidates built successfully');
    process.exit(0);
  } else {
    console.error('\n❌ Waiver builder failed');
    process.exit(1);
  }
}

// Run script
main();
