/**
 * FPG-Centric Scoring Engine
 * 
 * Phase D: Advanced Scoring Algorithms
 * Replaces hardcoded upside values with real rushing metrics and mathematical rigor
 */

import { loadUnifiedPlayerFacts, PlayerFactsUpdate } from './unifiedLoader';
import { compositeScore, confidenceGating } from './math';

export interface PowerScore {
  player_id: string;
  position: string;
  overall_score: number;      // 0-100 composite score
  components: {
    usage: number;            // 40% weight
    talent: number;           // 25% weight
    environment: number;      // 20% weight
    availability: number;     // 13% weight (adjusted for RBs)
    market_anchor: number;    // 5% weight
  };
  fpg_metrics: {
    current_fpg: number;
    expected_fpg: number;
    projected_fpg: number;
    beat_projection: number;
    upside_index: number;
  };
  rag_metrics: {
    expected_points: number;  // Weekly expected points (mu)
    floor_points: number;     // Weekly floor (mu - sigma)
    ceiling_points: number;   // Weekly ceiling (mu + sigma)
    rag_score: number;        // 0-100 RAG score with upside bias
    rag_color: 'GREEN' | 'AMBER' | 'RED'; // Color coding
    reasons: string[];        // Reasoning array for UI
  };
  confidence: number;         // 0-1 confidence in the score
  badges: string[];           // UI badges for key insights
}

/**
 * Calculate comprehensive power scores for all players
 * @param season NFL season
 * @param week NFL week
 * @param positions Positions to score
 * @returns Array of power scores
 */
export async function calculatePowerScores(
  season: number,
  week: number,
  positions: string[] = ['QB', 'RB', 'WR', 'TE']
): Promise<PowerScore[]> {
  
  console.log(`🎯 Starting FPG-centric scoring for ${season} Week ${week}...`);
  
  try {
    // Phase 1: Load unified player facts
    const playerFacts = await loadUnifiedPlayerFacts(season, week, positions);
    
    console.log(`📊 Processing ${playerFacts.length} player facts into power scores...`);
    
    // Phase 2: Calculate position-specific league ranges for normalization
    const leagueRanges = calculateLeagueRanges(playerFacts);
    
    // Phase 3: Generate power scores for each player
    const powerScores: PowerScore[] = [];
    
    for (const facts of playerFacts) {
      const score = await calculateIndividualPowerScore(facts, leagueRanges);
      powerScores.push(score);
    }
    
    // Phase 4: Apply league-wide ranking and confidence adjustments
    const finalScores = applyLeagueAdjustments(powerScores);
    
    console.log(`✅ Generated ${finalScores.length} power scores`);
    
    return finalScores;
    
  } catch (error) {
    console.error('❌ Power scoring engine failed:', error);
    throw error;
  }
}

/**
 * Calculate individual player power score
 */
async function calculateIndividualPowerScore(
  facts: PlayerFactsUpdate,
  leagueRanges: any
): Promise<PowerScore> {
  
  // Get position-specific weights
  const weights = getPositionWeights(facts.features.position);
  
  // Extract component scores from features
  const components = {
    usage: facts.features.usage_score || 0,
    talent: facts.features.talent_score || 0,
    environment: facts.features.environment_score || 50,  // Default neutral
    availability: facts.features.availability_score || 85, // Default healthy
    market_anchor: facts.features.market_anchor || 50     // Default neutral
  };
  
  // Calculate weighted composite score
  const overallScore = compositeScore(components, weights);
  
  // Apply confidence gating
  const confidence = confidenceGating(
    0.9, 
    facts.features.is_rookie || false,
    facts.features.games_played || 3
  );
  
  // Generate UI badges based on key metrics
  const badges = generateBadges(facts, components);
  
  return {
    player_id: facts.player_id,
    position: facts.position,
    overall_score: Math.round(overallScore),
    components,
    fpg_metrics: {
      current_fpg: facts.fpg,
      expected_fpg: facts.xfpg,
      projected_fpg: facts.proj_fpg,
      beat_projection: facts.beat_proj,
      upside_index: facts.upside_index
    },
    rag_metrics: {
      expected_points: facts.expected_points,
      floor_points: facts.floor_points,
      ceiling_points: facts.ceiling_points,
      rag_score: facts.rag_score,
      rag_color: facts.rag_color,
      reasons: facts.rag_reasons
    },
    confidence,
    badges
  };
}

/**
 * Get position-specific component weights
 */
function getPositionWeights(position: string): Record<string, number> {
  switch (position) {
    case 'QB':
      return {
        usage: 0.40,       // QB usage = attempts, designed runs, RZ opportunities
        talent: 0.25,      // Arm talent, accuracy, mobility
        environment: 0.30, // OL, pace, weapons (boosted for QBs)
        availability: 0.08, // QBs usually healthy 
        market_anchor: 0.05
      };
      
    case 'RB':
      return {
        usage: 0.40,       // Snap share, inside-10 share, target share
        talent: 0.25,      // YAC, speed, receiving ability
        environment: 0.20, // OL, game script, team pace
        availability: 0.13, // Injury-prone position (boosted)
        market_anchor: 0.05
      };
      
    case 'WR':
      return {
        usage: 0.40,       // Target share, air yards share, route participation
        talent: 0.25,      // Route running, hands, speed
        environment: 0.20, // QB play, scheme, pace
        availability: 0.10, // Generally healthy position
        market_anchor: 0.05
      };
      
    case 'TE':
      return {
        usage: 0.40,       // Route participation, target share
        talent: 0.25,      // Receiving ability, blocking
        environment: 0.20, // QB play, scheme usage
        availability: 0.10, // Generally healthy
        market_anchor: 0.05
      };
      
    default:
      return {
        usage: 0.40,
        talent: 0.25,
        environment: 0.20,
        availability: 0.10,
        market_anchor: 0.05
      };
  }
}

/**
 * Generate UI badges based on key metrics
 */
function generateBadges(facts: PlayerFactsUpdate, components: any): string[] {
  const badges: string[] = [];
  
  // Alpha Usage badge (high usage score)
  if (components.usage >= 80) {
    badges.push('Alpha Usage');
  }
  
  // Beat Projection badge (significantly outperforming projections)
  if (facts.beat_proj >= 75) {
    badges.push('Beats Projections');
  }
  
  // Upside Potential badge (high upside index)
  if (facts.upside_index >= 75) {
    badges.push('High Upside');
  }
  
  // QB Rushing badges
  if (facts.features.position === 'QB' && facts.features.qb_metrics) {
    const qbMetrics = facts.features.qb_metrics;
    
    // Rushing Floor badge (designed runs)
    if (qbMetrics.designedRunRate >= 0.12) {
      badges.push('Rushing Floor');
    }
    
    // Scrambling badge (scramble yards)
    if (qbMetrics.scrambleYdsG >= 20) {
      badges.push('Mobile QB');
    }
    
    // Goal Line Vulture badge (red zone rushing)
    if (qbMetrics.rzRushShare >= 0.20) {
      badges.push('RZ Rusher');
    }
  }
  
  // Environment badges
  if (components.environment >= 85) {
    badges.push('Elite Context');
  } else if (components.environment <= 65) {
    badges.push('Context Risk');
  }
  
  // Market badges
  if (components.market_anchor >= 70) {
    badges.push('Market Value');
  } else if (components.market_anchor <= 30) {
    badges.push('Market Risk');
  }
  
  // Talent badges
  if (components.talent >= 90) {
    badges.push('Elite Talent');
  }
  
  return badges;
}

/**
 * Calculate league-wide ranges for score normalization
 */
function calculateLeagueRanges(playerFacts: PlayerFactsUpdate[]): any {
  const ranges: any = {};
  
  // Group by position
  const byPosition = playerFacts.reduce((acc, facts) => {
    const pos = facts.features.position;
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(facts);
    return acc;
  }, {} as Record<string, PlayerFactsUpdate[]>);
  
  // Calculate ranges for each position
  for (const [position, facts] of Object.entries(byPosition)) {
    ranges[position] = {
      fpg: [
        Math.min(...facts.map(f => f.fpg)),
        Math.max(...facts.map(f => f.fpg))
      ],
      xfpg: [
        Math.min(...facts.map(f => f.xfpg)),
        Math.max(...facts.map(f => f.xfpg))
      ],
      beat_proj: [
        Math.min(...facts.map(f => f.beat_proj)),
        Math.max(...facts.map(f => f.beat_proj))
      ],
      upside_index: [
        Math.min(...facts.map(f => f.upside_index)),
        Math.max(...facts.map(f => f.upside_index))
      ]
    };
  }
  
  return ranges;
}

/**
 * Apply league-wide adjustments and final confidence gating
 */
function applyLeagueAdjustments(powerScores: PowerScore[]): PowerScore[] {
  // Sort by overall score for ranking context
  const sorted = [...powerScores].sort((a, b) => b.overall_score - a.overall_score);
  
  // Apply position-specific adjustments
  return sorted.map((score, index) => {
    // Add ranking context to confidence
    const rankingTier = index < 12 ? 'elite' : index < 24 ? 'solid' : 'depth';
    
    // Boost confidence for consistent top performers
    let adjustedConfidence = score.confidence;
    if (rankingTier === 'elite' && score.fpg_metrics.current_fpg > 18) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence * 1.1);
    }
    
    return {
      ...score,
      confidence: adjustedConfidence
    };
  });
}

/**
 * Get position-specific display metrics for UI
 */
export function getDisplayMetrics(score: PowerScore): {
  primary: string;
  secondary: string;
  context: string;
} {
  const pos = score.position;
  const fpg = score.fpg_metrics;
  
  if (pos === 'QB') {
    return {
      primary: `${fpg.current_fpg.toFixed(1)} FPG`,
      secondary: `${score.fpg_metrics.upside_index}% Rushing Upside`,
      context: `Beats Proj: ${fpg.beat_projection.toFixed(0)}%`
    };
  }
  
  if (pos === 'RB') {
    return {
      primary: `${fpg.current_fpg.toFixed(1)} FPG`,
      secondary: `${score.components.usage}% Usage`,
      context: `Environment: ${score.components.environment}`
    };
  }
  
  if (pos === 'WR') {
    return {
      primary: `${fpg.current_fpg.toFixed(1)} FPG`,
      secondary: `${score.components.talent}% Talent`,
      context: `Target Rate: ${score.components.usage}%`
    };
  }
  
  if (pos === 'TE') {
    return {
      primary: `${fpg.current_fpg.toFixed(1)} FPG`,
      secondary: `${score.fpg_metrics.upside_index}% Route Upside`,
      context: `Usage: ${score.components.usage}%`
    };
  }
  
  return {
    primary: `${fpg.current_fpg.toFixed(1)} FPG`,
    secondary: `${score.overall_score}/100`,
    context: `Confidence: ${Math.round(score.confidence * 100)}%`
  };
}