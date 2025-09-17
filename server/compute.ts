import { z } from 'zod';
import { eq, and, sql, gte } from 'drizzle-orm';
import { db } from './db';
import { playerWeekFacts, buysSells, players, verdictEnum, formatEnum, pprEnum, type InsertBuysSells } from '@shared/schema';

// Config: Weights/thresholds (changelog: v1.1: No changes)
const SCORE_CONFIG = {
  gapWeight: 0.55,  // Early: 0.40
  signalWeight: 0.30,
  momentumWeight: 0.20,
  riskWeight: 0.35,
  riskBlend: { injury: 0.50, committee: 0.30, coach: 0.20 },
  confWeights: { vs: 0.40, trend: 0.25, freshness: 0.20, agreement: 0.15 },
  confCaps: { injury: 0.45, committee: 0.55 },
  verdictThresholds: { 
    buyHard: 1.25, 
    buy: 0.60, 
    watchBuy: 0.25, 
    holdLow: -0.25, 
    watchSell: -0.60, 
    sell: -1.25 
  },
  momentumSlope: -0.05,
  byeDegrade: 0.15,  // Redraft only
  earlyWeeks: 2,
  signalNorms: {
    usage: { snap: 0.12, routes: 0.10, targets: 0.10, rz: 0.08 },
    efficiency: { epa: 0.08, yprrYac: 0.07, mtf: 0.05 },
    environment: { pace: 0.07, ol: 0.06, sos: 0.07 },
    market: { adpEcr: 0.08, rosteredStart: 0.07 },
  },
};

// Inputs schema
const InputsSchema = z.object({
  gapZ: z.number(),
  signal: z.number(),
  momentum: z.number(),
  risk: z.number().min(0).max(1),
  format: z.enum(['redraft', 'dynasty']).default('redraft'),
  ppr: z.enum(['ppr', 'half', 'standard']).default('half'),
  week: z.number().min(1).max(18),
});

// Clamp utility function
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Normalize percentile (0..100 to -1..1)
function normPercentile(p: number): number {
  return clamp((p / 100) * 2 - 1, -1, 1);
}

// Verdict Score (VS) calculation
export function verdictScore(inputs: z.infer<typeof InputsSchema>): number {
  const { gapZ, signal, momentum, risk, format, ppr, week } = InputsSchema.parse(inputs);
  
  // Adjust gap weight for early weeks
  let adjGapWeight = SCORE_CONFIG.gapWeight;
  if (week <= SCORE_CONFIG.earlyWeeks) {
    adjGapWeight = 0.40;
  }

  // Format/PPR adjustments (e.g., PPR boosts signal)
  let adjSignal = signal;
  if (ppr === 'ppr') adjSignal *= 1.1;
  if (ppr === 'half') adjSignal *= 1.05;

  return adjGapWeight * gapZ + 
         SCORE_CONFIG.signalWeight * adjSignal + 
         SCORE_CONFIG.momentumWeight * momentum - 
         SCORE_CONFIG.riskWeight * risk;
}

// Convert verdict score to verdict label
export function toVerdict(vs: number): 'BUY_HARD' | 'BUY' | 'WATCH_BUY' | 'HOLD' | 'WATCH_SELL' | 'SELL' | 'SELL_HARD' {
  const t = SCORE_CONFIG.verdictThresholds;
  if (vs >= t.buyHard) return 'BUY_HARD';
  if (vs >= t.buy) return 'BUY';
  if (vs >= t.watchBuy) return 'WATCH_BUY';
  if (vs > t.holdLow) return 'HOLD';
  if (vs > t.watchSell) return 'WATCH_SELL';
  if (vs > t.sell) return 'SELL';
  return 'SELL_HARD';
}

// Calculate confidence score
export function calculateConfidence(
  vs: number, 
  trendStability: number, 
  dataFreshness: number, 
  sourceAgreement: number
): number {
  const absVsScaled = clamp(Math.abs(vs) / 2, 0, 1);
  return clamp(
    SCORE_CONFIG.confWeights.vs * absVsScaled +
    SCORE_CONFIG.confWeights.trend * trendStability +
    SCORE_CONFIG.confWeights.freshness * dataFreshness +
    SCORE_CONFIG.confWeights.agreement * sourceAgreement,
    0,
    1
  );
}

// Apply guardrails (confidence caps + forbid BUY_HARD; bye degrade on VS for redraft)
export function applyGuardrails(
  vs: number, 
  injuryScore: number, 
  committeeIndex: number, 
  byeUpcoming: boolean, 
  format: string, 
  conf: number
): { adjVs: number, adjConf: number, adjVerdict: 'BUY_HARD' | 'BUY' | 'WATCH_BUY' | 'HOLD' | 'WATCH_SELL' | 'SELL' | 'SELL_HARD' } {
  let adjVs = vs;
  
  // Apply bye week penalty for redraft
  if (byeUpcoming && format === 'redraft') {
    adjVs -= SCORE_CONFIG.byeDegrade;
  }

  // Check for confidence caps
  const injuryCap = injuryScore >= 0.5;
  const committeeCap = committeeIndex >= 0.6;

  let adjConf = conf;
  if (committeeCap) adjConf = Math.min(adjConf, SCORE_CONFIG.confCaps.committee);
  if (injuryCap) adjConf = Math.min(adjConf, SCORE_CONFIG.confCaps.injury);

  let adjVerdict = toVerdict(adjVs);
  
  // Forbid BUY_HARD for injured players
  if (injuryCap && adjVerdict === 'BUY_HARD') {
    adjVerdict = 'BUY';
  }

  return { adjVs, adjConf, adjVerdict };
}

// Main compute function for a specific week/position
export async function computeBuysSellsForWeek(
  week: number, 
  position: string, 
  format: 'redraft' | 'dynasty' = 'redraft', 
  ppr: 'ppr' | 'half' | 'standard' = 'half', 
  season: number = 2025
) {
  console.log(`Computing buys/sells for Week ${week}, ${position}, ${format}, ${ppr}`);
  
  // Fetch players for this week/position - only process active, high-quality players
  const playersQuery = await db
    .select({
      // Player week facts
      playerId: playerWeekFacts.playerId,
      season: playerWeekFacts.season,
      week: playerWeekFacts.week,
      position: playerWeekFacts.position,
      usageNow: playerWeekFacts.usageNow,
      talent: playerWeekFacts.talent,
      environment: playerWeekFacts.environment,
      availability: playerWeekFacts.availability,
      marketAnchor: playerWeekFacts.marketAnchor,
      powerScore: playerWeekFacts.powerScore,
      confidence: playerWeekFacts.confidence,
      flags: playerWeekFacts.flags,
      adpRank: playerWeekFacts.adpRank,
      snapShare: playerWeekFacts.snapShare,
      routesPerGame: playerWeekFacts.routesPerGame,
      targetsPerGame: playerWeekFacts.targetsPerGame,
      rzTouches: playerWeekFacts.rzTouches,
      epaPerPlay: playerWeekFacts.epaPerPlay,
      yprr: playerWeekFacts.yprr,
      yacPerAtt: playerWeekFacts.yacPerAtt,
      mtfPerTouch: playerWeekFacts.mtfPerTouch,
      teamProe: playerWeekFacts.teamProe,
      paceRankPercentile: playerWeekFacts.paceRankPercentile,
      olTier: playerWeekFacts.olTier,
      sosNext2: playerWeekFacts.sosNext2,
      injuryPracticeScore: playerWeekFacts.injuryPracticeScore,
      committeeIndex: playerWeekFacts.committeeIndex,
      coachVolatility: playerWeekFacts.coachVolatility,
      ecr7dDelta: playerWeekFacts.ecr7dDelta,
      byeWeek: playerWeekFacts.byeWeek,
      rostered7dDelta: playerWeekFacts.rostered7dDelta,
      started7dDelta: playerWeekFacts.started7dDelta,
      tiberRank: playerWeekFacts.tiberRank,
      ecrRank: playerWeekFacts.ecrRank,
      // Player metadata for quality filtering
      playerActive: players.active,
      playerRosteredPct: players.rosteredPct,
      playerTeam: players.team,
      playerName: players.name
    })
    .from(playerWeekFacts)
    .innerJoin(players, eq(playerWeekFacts.playerId, players.sleeperId))
    .where(
      and(
        eq(playerWeekFacts.season, season),
        eq(playerWeekFacts.week, week),
        eq(playerWeekFacts.position, position),
        // Quality gates: only active players with adequate roster percentages
        eq(players.active, true),
        gte(players.rosteredPct, 50),
        sql`${players.team} IS NOT NULL AND ${players.team} != 'Unknown'`
      )
    );

  if (!playersQuery.length) {
    console.log(`No data found for Week ${week}, ${position}`);
    return;
  }

  console.log(`Found ${playersQuery.length} players for computation (after quality filtering)`);

  // Compute positional z-scores for gap analysis using power scores
  const powerScores = playersQuery
    .filter(p => p.powerScore !== null)
    .map(p => p.powerScore!);
  
  if (powerScores.length === 0) {
    console.log('No power score data found');
    return;
  }

  const meanPower = powerScores.reduce((a, b) => a + b, 0) / powerScores.length;
  const variance = powerScores.map(s => (s - meanPower) ** 2).reduce((a, b) => a + b, 0) / powerScores.length;
  const stdPower = Math.sqrt(variance) || 1; // Prevent division by zero

  console.log(`Power score stats: mean=${meanPower.toFixed(2)}, std=${stdPower.toFixed(2)}`);

  // Process each player with additional quality checks
  const results: InsertBuysSells[] = [];
  let qualityFiltered = 0;
  
  for (const p of playersQuery) {
    if (p.powerScore === null) {
      continue; // Skip players without power score data
    }

    // Additional quality gates within processing loop
    if (p.playerRosteredPct !== null && p.playerRosteredPct < 50) {
      qualityFiltered++;
      continue; // Skip players with low roster percentage
    }

    if (p.snapShare !== null && p.snapShare < 0.3 && p.position !== 'QB') {
      qualityFiltered++;
      continue; // Skip players with very low snap share (except QBs)
    }

    if (p.playerTeam === 'Unknown' || p.playerTeam === null) {
      qualityFiltered++;
      continue; // Skip players with unknown teams
    }

    // Calculate power score z-score (higher power score = better, so positive z is good)
    const gapZ = (p.powerScore - meanPower) / stdPower;

    // Calculate signal components (normalized to -1..1)
    const norms = SCORE_CONFIG.signalNorms;
    
    // Usage signals
    const snapShareNorm = p.snapShare ? normPercentile(p.snapShare * 100) : 0;
    const routesNorm = p.routesPerGame ? Math.min(p.routesPerGame / 15, 1) * 2 - 1 : 0;
    const targetsNorm = p.targetsPerGame ? Math.min(p.targetsPerGame / 7, 1) * 2 - 1 : 0;
    const rzNorm = p.rzTouches ? Math.min(p.rzTouches / 5, 1) * 2 - 1 : 0;
    
    const usage = norms.usage.snap * snapShareNorm + 
                  norms.usage.routes * routesNorm + 
                  norms.usage.targets * targetsNorm + 
                  norms.usage.rz * rzNorm;

    // Efficiency signals
    const epaNorm = (p.epaPerPlay || 0) * 10; // Scale EPA
    const yprrYacNorm = (p.yprr || p.yacPerAtt || 0);
    const mtfNorm = (p.mtfPerTouch || 0) * 4;
    
    const efficiency = norms.efficiency.epa * clamp(epaNorm, -1, 1) + 
                      norms.efficiency.yprrYac * clamp(yprrYacNorm, -1, 1) + 
                      norms.efficiency.mtf * clamp(mtfNorm, -1, 1);

    // Environment signals
    const paceNorm = p.paceRankPercentile ? normPercentile(p.paceRankPercentile) : 0;
    const olNorm = p.olTier ? (5 - p.olTier) / 4 : 0; // Higher tier = lower number, so invert
    const sosNorm = clamp(p.sosNext2 || 0, -1, 1);
    
    const environment = norms.environment.pace * paceNorm + 
                       norms.environment.ol * olNorm + 
                       norms.environment.sos * sosNorm;

    // Market signals (using market anchor and power score since ecrRank not available)
    const marketAnchorNorm = (p.marketAnchor || 0) / 100; // Normalize market anchor
    const rosteredStartNorm = ((p.rostered7dDelta || 0) + (p.started7dDelta || 0)) / 2;
    
    const market = norms.market.adpEcr * clamp(marketAnchorNorm, -1, 1) + 
                   norms.market.rosteredStart * clamp(rosteredStartNorm, -1, 1);

    // Total signal
    const signal = clamp(usage + efficiency + environment + market, -1, 1);

    // Calculate momentum (use power score change or default to 0)
    const momentum = clamp(SCORE_CONFIG.momentumSlope * (p.ecr7dDelta || 0), -1, 1);

    // Calculate risk
    const risk = clamp(
      SCORE_CONFIG.riskBlend.injury * (p.injuryPracticeScore || 0) +
      SCORE_CONFIG.riskBlend.committee * (p.committeeIndex || 0) +
      SCORE_CONFIG.riskBlend.coach * (p.coachVolatility || 0),
      0,
      1
    );

    // Calculate verdict score
    const vs = verdictScore({ gapZ, signal, momentum, risk, format, ppr, week });

    // Calculate confidence (using reasonable defaults for missing data)
    const confRaw = calculateConfidence(vs, 0.8, 0.9, 0.8);

    // Apply guardrails
    const { adjVs, adjConf, adjVerdict } = applyGuardrails(
      vs, 
      p.injuryPracticeScore || 0, 
      p.committeeIndex || 0, 
      p.byeWeek || false, 
      format, 
      confRaw
    );

    // Build proof object with the metrics that influenced the decision
    const proof = {
      gapZ: Number(gapZ.toFixed(3)),
      signal: Number(signal.toFixed(3)),
      momentum: Number(momentum.toFixed(3)),
      risk: Number(risk.toFixed(3)),
      usage: Number(usage.toFixed(3)),
      efficiency: Number(efficiency.toFixed(3)),
      environment: Number(environment.toFixed(3)),
      market: Number(market.toFixed(3)),
      snapShare: p.snapShare,
      routesPerGame: p.routesPerGame,
      targetsPerGame: p.targetsPerGame,
      rzTouches: p.rzTouches,
      epaPerPlay: p.epaPerPlay,
      ecr7dDelta: p.ecr7dDelta,
      injuryPracticeScore: p.injuryPracticeScore,
      committeeIndex: p.committeeIndex,
      coachVolatility: p.coachVolatility,
      tiberRank: p.tiberRank,
      ecrRank: p.ecrRank,
    };

    // Generate explanation
    const explanation = generateExplanation(adjVerdict, gapZ, signal, momentum, risk, proof);

    // Quality gate: Only include recommendations with confidence >= 0.3
    if (adjConf >= 0.3) {
      results.push({
        playerId: p.playerId,
        season,
        week,
        position,
        verdict: adjVerdict,
        verdictScore: Number(adjVs.toFixed(3)),
        confidence: Number(adjConf.toFixed(3)),
        gapZ: Number(gapZ.toFixed(3)),
        signal: Number(signal.toFixed(3)),
        marketMomentum: Number(momentum.toFixed(3)),
        riskPenalty: Number(risk.toFixed(3)),
        format,
        ppr,
        proof,
        explanation,
      });
    } else {
      qualityFiltered++;
      console.log(`   ⚠️ Filtered out ${p.playerName || p.playerId} due to low confidence: ${adjConf.toFixed(3)}`);
    }
  }

  // Log quality filtering results
  console.log(`   📊 Quality filtering summary: ${qualityFiltered} players filtered out, ${results.length} high-quality recommendations remaining`);

  // Batch insert/upsert results
  if (results.length > 0) {
    await db
      .insert(buysSells)
      .values(results)
      .onConflictDoUpdate({
        target: [buysSells.playerId, buysSells.season, buysSells.week, buysSells.format, buysSells.ppr],
        set: {
          verdict: sql`excluded.verdict`,
          verdictScore: sql`excluded.verdict_score`,
          confidence: sql`excluded.confidence`,
          gapZ: sql`excluded.gap_z`,
          signal: sql`excluded.signal`,
          marketMomentum: sql`excluded.market_momentum`,
          riskPenalty: sql`excluded.risk_penalty`,
          proof: sql`excluded.proof`,
          explanation: sql`excluded.explanation`,
          createdAt: sql`excluded.created_at`,
        }
      });

    console.log(`Inserted/updated ${results.length} buys/sells records`);
  }

  // Backtest: Update hit rates for prior week
  await updateHitRates(week - 1, position, format, ppr, season);

  return results;
}

// Generate human-readable explanation
function generateExplanation(
  verdict: 'BUY_HARD' | 'BUY' | 'WATCH_BUY' | 'HOLD' | 'WATCH_SELL' | 'SELL' | 'SELL_HARD', 
  gapZ: number, 
  signal: number, 
  momentum: number, 
  risk: number,
  proof: any
): string {
  const parts = [];
  
  // Main verdict reasoning
  if (verdict.includes('BUY')) {
    parts.push(`${verdict.replace('_', ' ')} recommendation`);
    if (gapZ > 0.5) parts.push('strong rank advantage over consensus');
    if (signal > 0.3) parts.push('positive usage/efficiency signals');
  } else if (verdict.includes('SELL')) {
    parts.push(`${verdict.replace('_', ' ')} recommendation`);
    if (gapZ < -0.5) parts.push('consensus ranks higher than our model');
    if (signal < -0.3) parts.push('concerning usage/efficiency trends');
  } else {
    parts.push('HOLD - mixed signals');
  }

  // Add key factors
  if (momentum > 0.2) parts.push('positive momentum');
  if (momentum < -0.2) parts.push('negative momentum');
  if (risk > 0.6) parts.push('elevated injury/committee risk');
  if (proof.snapShare && proof.snapShare > 0.8) parts.push('high snap share');
  if (proof.routesPerGame && proof.routesPerGame > 12) parts.push('strong route volume');

  return parts.join(', ') + '.';
}

// Update hit rates for backtesting
async function updateHitRates(
  week: number, 
  position: string, 
  format: 'redraft' | 'dynasty', 
  ppr: 'ppr' | 'half' | 'standard', 
  season: number
) {
  if (week < 1) return; // No prior week to backtest

  try {
    // Get prior week recommendations
    const priorRecs = await db
      .select()
      .from(buysSells)
      .where(
        and(
          eq(buysSells.season, season),
          eq(buysSells.week, week),
          eq(buysSells.position, position),
          eq(buysSells.format, format),
          eq(buysSells.ppr, ppr)
        )
      );

    // Get prior week facts (where the recommendation was made)
    const priorFacts = await db
      .select()
      .from(playerWeekFacts)
      .where(
        and(
          eq(playerWeekFacts.season, season),
          eq(playerWeekFacts.week, week),
          eq(playerWeekFacts.position, position)
        )
      );

    // Get current week facts to see if rankings moved toward our predictions
    const currentFacts = await db
      .select()
      .from(playerWeekFacts)
      .where(
        and(
          eq(playerWeekFacts.season, season),
          eq(playerWeekFacts.week, week + 1),
          eq(playerWeekFacts.position, position)
        )
      );

    const priorFactsMap = new Map(priorFacts.map(f => [f.playerId, f]));
    const currentFactsMap = new Map(currentFacts.map(f => [f.playerId, f]));

    // Calculate hit rates based on actual ECR movement
    for (const rec of priorRecs) {
      const priorFact = priorFactsMap.get(rec.playerId);
      const currentFact = currentFactsMap.get(rec.playerId);
      
      if (!priorFact || !currentFact || 
          !priorFact.ecrRank || !currentFact.ecrRank) {
        continue; // Skip if missing ranking data
      }

      // Calculate ECR movement (negative = moved up in rankings, positive = moved down)
      const ecrDelta = currentFact.ecrRank - priorFact.ecrRank;
      
      // Determine if our prediction was correct based on ECR movement
      let hit = 0.5; // Default neutral for HOLD
      
      if (rec.verdict.includes('BUY')) {
        // For BUY recommendations: success if ECR rank decreased (player moved up)
        hit = ecrDelta < 0 ? 1 : 0;
      } else if (rec.verdict.includes('SELL')) {
        // For SELL recommendations: success if ECR rank increased (player moved down)
        hit = ecrDelta > 0 ? 1 : 0;
      }
      // HOLD stays at 0.5 (neutral)

      // Update hit rate
      await db
        .update(buysSells)
        .set({ hitRate: hit })
        .where(
          and(
            eq(buysSells.playerId, rec.playerId),
            eq(buysSells.season, rec.season),
            eq(buysSells.week, rec.week),
            eq(buysSells.format, rec.format),
            eq(buysSells.ppr, rec.ppr)
          )
        );
    }

    console.log(`Updated hit rates for ${priorRecs.length} prior week recommendations`);
  } catch (error) {
    console.error('Error updating hit rates:', error);
  }
}

// Batch compute for all positions and formats
export async function computeBuysSellsForAllPositions(
  week: number, 
  season: number = 2025
) {
  const positions = ['QB', 'RB', 'WR', 'TE'];
  const formats: ('redraft' | 'dynasty')[] = ['redraft', 'dynasty'];
  const pprSettings: ('ppr' | 'half' | 'standard')[] = ['ppr', 'half', 'standard'];

  console.log(`Starting batch computation for Week ${week}, Season ${season}`);

  for (const position of positions) {
    for (const format of formats) {
      for (const ppr of pprSettings) {
        try {
          await computeBuysSellsForWeek(week, position, format, ppr, season);
        } catch (error) {
          console.error(`Error computing ${position} ${format} ${ppr}:`, error);
        }
      }
    }
  }

  console.log(`Completed batch computation for Week ${week}`);
}

// Export for use in nightly recalc or API routes
export { InputsSchema, SCORE_CONFIG };