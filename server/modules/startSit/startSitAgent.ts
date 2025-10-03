// server/modules/startSit/startSitAgent.ts
// Agent 1 bridge implementation - connects data assembler to API routes

import { buildStartSitPlayerProfile } from "./dataAssembler";
import { scorePlayer, startSit, defaultConfig } from "../startSitEngine";
import type { StartSitAgent1 } from "../../routes/startSitRoutes";
import type { 
  StartSitPlayerProfile, 
  StartSitVerdict,
  StartSitFactorBreakdown,
  StartSitFactor
} from "../../../shared/startSit";

/**
 * Transform Agent 1's data assembler output to Agent 2's type system
 */
function transformToStartSitProfile(
  assemblerOutput: Awaited<ReturnType<typeof buildStartSitPlayerProfile>>
): StartSitPlayerProfile | null {
  if (!assemblerOutput) return null;

  const { playerInput, dataAvailability } = assemblerOutput;
  
  // Run scoring engine
  const scoreResult = scorePlayer(playerInput, defaultConfig);
  
  // Build factor breakdown from scoring engine results
  const factors: StartSitFactor[] = [];
  
  // Usage factor
  if (scoreResult.usage > 0) {
    factors.push({
      key: "usage",
      label: "Usage & Opportunity",
      weight: 0.25,
      score: scoreResult.usage,
      impact: scoreResult.usage >= 65 ? "boost" : scoreResult.usage >= 45 ? "neutral" : "downgrade",
      evidence: {
        targetShare: playerInput.targetShare ?? null,
        snapPct: playerInput.snapPct ?? null,
      },
      note: `Target share: ${playerInput.targetShare?.toFixed(1)}%`,
    });
  }
  
  // Matchup factor
  if (scoreResult.matchup > 0) {
    factors.push({
      key: "sos",
      label: "Matchup Quality",
      weight: 0.25,
      score: scoreResult.matchup,
      impact: scoreResult.matchup >= 65 ? "boost" : scoreResult.matchup >= 45 ? "neutral" : "downgrade",
      evidence: {
        defenseRank: playerInput.defRankVsPos ?? null,
        oasisScore: playerInput.oasisMatchupScore ?? null,
      },
      note: `SOS score: ${playerInput.oasisMatchupScore || 'N/A'}`,
    });
  }
  
  // Injury/Volatility factor
  if (scoreResult.volatility < 100) {
    factors.push({
      key: "injury",
      label: "Health & Volatility",
      weight: 0.10,
      score: scoreResult.volatility,
      impact: scoreResult.volatility >= 80 ? "neutral" : scoreResult.volatility >= 50 ? "downgrade" : "downgrade",
      evidence: {
        injuryStatus: playerInput.injuryTag || "Healthy",
      },
      note: playerInput.injuryTag ? `Status: ${playerInput.injuryTag}` : "Healthy",
    });
  }
  
  const factorBreakdown: StartSitFactorBreakdown = {
    totalScore: scoreResult.total,
    normalizedScore: Math.round(scoreResult.total),
    factors,
    topSignals: factors
      .filter(f => f.impact === "boost")
      .map(f => f.label),
    riskFlags: factors
      .filter(f => f.impact === "downgrade")
      .map(f => f.label),
  };
  
  return {
    playerId: assemblerOutput.playerId,
    name: assemblerOutput.playerName,
    position: assemblerOutput.position as any,
    team: assemblerOutput.team,
    opponent: assemblerOutput.opponent || "",
    week: assemblerOutput.week,
    season: assemblerOutput.season,
    
    efficiency: {
      epaPerPlay: playerInput.projPoints ? playerInput.projPoints / 15 : undefined, // Rough EPA estimate
      yprr: undefined,
    },
    
    context: {
      oasis: playerInput.oasisMatchupScore,
      sos: playerInput.defRankVsPos,
      injuryStatus: playerInput.injuryTag === "OUT" ? "Out" : 
                    playerInput.injuryTag === "Q" ? "Questionable" :
                    playerInput.injuryTag === "D" ? "Doubtful" : "Healthy",
    },
    
    factorBreakdown,
    
    projection: {
      floor: playerInput.projFloor || undefined,
      median: playerInput.projPoints,
      ceiling: playerInput.projCeiling || undefined,
    },
    
    notes: [
      ...factors.map(f => f.note).filter(Boolean) as string[],
    ],
  };
}

/**
 * Transform scoring result to verdict
 */
function transformToVerdict(
  profile: StartSitPlayerProfile,
  compareContext?: { totalPlayers: number; rank: number }
): StartSitVerdict {
  const score = profile.factorBreakdown.normalizedScore;
  
  // Determine verdict and tier based on score
  let verdict: StartSitVerdict["verdict"];
  let tier: StartSitVerdict["tier"];
  let confidence: StartSitVerdict["confidence"];
  
  if (score >= 80) {
    verdict = "START";
    tier = "SMASH";
    confidence = "HIGH";
  } else if (score >= 65) {
    verdict = "START";
    tier = "STARTABLE";
    confidence = "MEDIUM";
  } else if (score >= 50) {
    verdict = "FLEX";
    tier = "MATCHUP_DEPENDENT";
    confidence = "MEDIUM";
  } else if (score >= 35) {
    verdict = "SIT";
    tier = "DESPERATION";
    confidence = "LOW";
  } else {
    verdict = "BENCH";
    tier = "AVOID";
    confidence = "LOW";
  }
  
  // Build rationale
  const rationale: string[] = [];
  
  if (tier === "SMASH") {
    rationale.push(`Elite play with ${score}/100 score - clear start`);
  } else if (tier === "STARTABLE") {
    rationale.push(`Solid option with ${score}/100 score`);
  } else if (tier === "MATCHUP_DEPENDENT") {
    rationale.push(`Matchup-dependent flex play (${score}/100)`);
  } else {
    rationale.push(`Poor outlook with ${score}/100 score`);
  }
  
  // Add top signals
  if (profile.factorBreakdown.topSignals?.length) {
    rationale.push(`Strengths: ${profile.factorBreakdown.topSignals.join(", ")}`);
  }
  
  // Add context
  if (compareContext) {
    rationale.push(`Ranks ${compareContext.rank} of ${compareContext.totalPlayers} in comparison`);
  }
  
  const cautions: string[] = [];
  if (profile.factorBreakdown.riskFlags?.length) {
    cautions.push(...profile.factorBreakdown.riskFlags.map(f => `${f} concern`));
  }
  
  return {
    playerId: profile.playerId,
    week: profile.week,
    verdict,
    tier,
    confidence,
    rationale,
    cautions: cautions.length > 0 ? cautions : undefined,
    expectedRange: profile.projection?.floor && profile.projection?.median && profile.projection?.ceiling 
      ? { floor: profile.projection.floor, median: profile.projection.median, ceiling: profile.projection.ceiling }
      : undefined,
    factorSummary: {
      boost: profile.factorBreakdown.topSignals || [],
      downgrade: profile.factorBreakdown.riskFlags || [],
    },
  };
}

/**
 * Main Agent 1 implementation
 */
export class StartSitAgent implements StartSitAgent1 {
  async analyze(input: Parameters<StartSitAgent1["analyze"]>[0]) {
    if (input.kind === "single") {
      const { playerId, week, season = 2024 } = input;
      
      // Use opponent from schedule lookup or default
      const opponent = "TBD"; // TODO: Schedule lookup
      
      const assemblerResult = await buildStartSitPlayerProfile(
        playerId,
        week,
        opponent,
        season
      );
      
      if (!assemblerResult) {
        throw new Error(`Player not found: ${playerId}`);
      }
      
      const profile = transformToStartSitProfile(assemblerResult);
      if (!profile) {
        throw new Error(`Failed to build profile for: ${playerId}`);
      }
      
      const verdict = transformToVerdict(profile);
      
      return { kind: "single" as const, profile, verdict };
    }
    
    // Cohort analysis - return empty for now (future implementation)
    return { kind: "cohort" as const, verdicts: [] };
  }
  
  async compare(input: { playerIds: string[]; week: number; season?: number }) {
    const { playerIds, week, season = 2024 } = input;
    
    const profiles: StartSitPlayerProfile[] = [];
    
    // Build all profiles, preserving original input IDs
    const playerIdMap = new Map<string, string>(); // nfl-id -> original-input-id
    
    for (const playerId of playerIds) {
      const opponent = "TBD"; // TODO: Schedule lookup
      console.log(`[StartSitAgent] Building profile for: ${playerId}`);
      const assemblerResult = await buildStartSitPlayerProfile(playerId, week, opponent, season);
      
      if (assemblerResult) {
        console.log(`[StartSitAgent] Profile built successfully for: ${assemblerResult.playerName}`);
        const profile = transformToStartSitProfile(assemblerResult);
        console.log(`[StartSitAgent] Transform result:`, profile ? 'SUCCESS' : 'NULL', profile ? `score=${profile.factorBreakdown.normalizedScore}` : '');
        if (profile) {
          // Map nfl-data-py ID back to original input ID
          playerIdMap.set(profile.playerId, playerId);
          profiles.push(profile);
          console.log(`[StartSitAgent] Added to profiles array. Total: ${profiles.length}`);
        } else {
          console.warn(`[StartSitAgent] Failed to transform profile for: ${playerId}`);
        }
      } else {
        console.warn(`[StartSitAgent] No assembler result for: ${playerId}`);
      }
    }
    
    console.log(`[StartSitAgent] Built ${profiles.length} profiles total`);
    
    // Sort by score
    profiles.sort((a, b) => b.factorBreakdown.normalizedScore - a.factorBreakdown.normalizedScore);
    
    // Transform to verdicts with ranking context
    const verdicts = profiles.map((profile, idx) => {
      console.log(`[StartSitAgent] Transforming verdict for ${profile.name} (score: ${profile.factorBreakdown.normalizedScore})`);
      const verdict = transformToVerdict(profile, { 
        totalPlayers: profiles.length, 
        rank: idx + 1 
      });
      
      // Restore original input ID for API response mapping
      const originalId = playerIdMap.get(profile.playerId);
      if (originalId) {
        verdict.playerId = originalId;
      }
      
      return verdict;
    });
    
    console.log(`[StartSitAgent] Returning ${verdicts.length} verdicts`);
    return verdicts;
  }
}

export const startSitAgent = new StartSitAgent();
