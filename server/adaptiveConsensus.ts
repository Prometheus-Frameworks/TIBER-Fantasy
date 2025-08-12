import { Request, Response } from "express";
import { db } from "./db";
import { 
  playerInjuries, playerBios, playerUsageWeekly, consensusExplanations,
  userRanks, consensusBoard, userProfiles 
} from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { 
  rankToScore as curvesRankToScore, 
  scoreToRank as curvesScoreToRank, 
  adjustRankWithMultiplier 
} from './consensus/curves';

// Configuration constants
const ADAPTIVE_CFG = {
  SURGE_WINDOW_DAYS: 7,
  SURGE_PCT_THRESHOLD: 25,
  SURGE_MIN_SUBMIT_PCT: 20,
  SURGE_DECAY_DAYS: 21,
  BASE_DECAY_DAYS: 90,
  
  RD_UNRANK_IF_OFS: true,
  RD_DROP_6PLUS_WEEKS: 45,
  RD_DROP_SHORT_2TO5: 15,
  RD_RECOVERY_GAMES_MIN: 2,
  RD_RECOVERY_SNAP_THRESH: 0.70,
  
  DY_BASE_PENALTY: 0.90,
  DY_RISK: {
    ACL: 0.92,
    Achilles: 0.70,
    Hamstring: 0.96,
    Concussion: 0.94,
    Ankle: 0.95,
    Knee: 0.93,
    Shoulder: 0.96,
    Back: 0.94,
    Other: 0.95,
    DEFAULT: 0.95
  },
  
  DY_AGE_FACTOR: (age: number, pos: string): number => {
    if (pos === "RB" && age >= 27) return 0.85;
    if (pos === "WR" && age >= 29) return 0.90;
    if (pos === "TE" && age >= 30) return 0.92;
    if (pos === "QB" && age >= 35) return 0.95;
    return 1.0;
  }
};

// Types
interface AdaptivePlayerInjury {
  playerId: string;
  status: "ACTIVE" | "OUT" | "IR" | "PUP" | "QUESTIONABLE" | "DOUBTFUL";
  injuryType?: string;
  datePlaced?: string;
  estReturnWeeks?: number;
  outForSeason?: boolean;
  lastUpdated: string;
}

interface AdaptivePlayerBio {
  playerId: string;
  pos: "QB" | "RB" | "WR" | "TE";
  age: number;
  team?: string;
}

interface AdaptiveConsensusContext {
  playerId: string;
  injury: AdaptivePlayerInjury | null;
  bio: AdaptivePlayerBio;
  recentGames: number;
  snapShare: number;
  hasCommunity: boolean;
  submissionHistory: Array<{
    date: string;
    rank: number;
    userId: string;
  }>;
}

interface AdaptiveSurgeDetection {
  playerId: string;
  isSurging: boolean;
  rankChangePct: number;
  recentSubmitPct: number;
  lastCalculated: string;
}

interface AdaptiveConsensusExplanation {
  playerId: string;
  format: "dynasty" | "redraft";
  season?: number;
  decayDays: number;
  surgeActive: boolean;
  injury: AdaptivePlayerInjury | null;
  gates: {
    recoveryGamesMet: boolean;
    snapShareMet: boolean;
  };
  notes: string[];
  baseRank: number;
  adjustedRank: number;
  adjustmentFactors: {
    surge?: number;
    injuryPenalty?: number;
    ageRisk?: number;
    injuryTypeRisk?: number;
  };
}

// Helper functions - using curves.ts for smooth transformations

// Core adaptive consensus logic
export async function gatherContext(playerId: string): Promise<AdaptiveConsensusContext> {
  const [injury] = await db
    .select()
    .from(playerInjuries)
    .where(eq(playerInjuries.playerId, playerId))
    .orderBy(desc(playerInjuries.lastUpdated))
    .limit(1);

  const [bio] = await db
    .select()
    .from(playerBios)
    .where(eq(playerBios.playerId, playerId));

  const recentUsage = await db
    .select()
    .from(playerUsageWeekly)
    .where(eq(playerUsageWeekly.playerId, playerId))
    .orderBy(desc(playerUsageWeekly.week))
    .limit(4);

  const submissionHistory = await db
    .select({
      date: userRanks.updatedAt,
      rank: userRanks.rank,
      userId: userRanks.userId
    })
    .from(userRanks)
    .where(eq(userRanks.playerId, playerId))
    .orderBy(desc(userRanks.updatedAt));

  const recentGames = recentUsage.filter(u => u.snapShare && u.snapShare > 0).length;
  const avgSnapShare = recentUsage.length > 0 
    ? recentUsage.reduce((sum, u) => sum + (u.snapShare || 0), 0) / recentUsage.length 
    : 0;

  const hasCommunity = submissionHistory.length > 1;

  // Convert database types to our interface types
  const adaptiveInjury: AdaptivePlayerInjury | null = injury ? {
    playerId: injury.playerId,
    status: injury.status as any,
    injuryType: injury.injuryType || undefined,
    datePlaced: injury.datePlaced?.toISOString(),
    estReturnWeeks: injury.estReturnWeeks || undefined,
    outForSeason: injury.outForSeason || false,
    lastUpdated: injury.lastUpdated?.toISOString() || new Date().toISOString()
  } : null;

  const adaptiveBio: AdaptivePlayerBio = bio ? {
    playerId: bio.playerId,
    pos: bio.pos as any,
    age: bio.age,
    team: bio.team || undefined
  } : { playerId, pos: "WR", age: 25 };

  return {
    playerId,
    injury: adaptiveInjury,
    bio: adaptiveBio,
    recentGames,
    snapShare: avgSnapShare,
    hasCommunity,
    submissionHistory: submissionHistory.map(s => ({
      date: s.date?.toISOString() || "",
      rank: s.rank,
      userId: s.userId
    }))
  };
}

export function isSurging(playerId: string, submissionHistory: any[]): AdaptiveSurgeDetection {
  if (submissionHistory.length < 2) {
    return {
      playerId,
      isSurging: false,
      rankChangePct: 0,
      recentSubmitPct: 0,
      lastCalculated: new Date().toISOString()
    };
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - (ADAPTIVE_CFG.SURGE_WINDOW_DAYS * 24 * 60 * 60 * 1000));
  
  const recentSubmissions = submissionHistory.filter(s => 
    new Date(s.date) >= sevenDaysAgo
  );
  
  const recentSubmitPct = (recentSubmissions.length / submissionHistory.length) * 100;
  
  const oldestRank = submissionHistory[submissionHistory.length - 1]?.rank || 100;
  const newestRank = submissionHistory[0]?.rank || 100;
  const rankChangePct = ((oldestRank - newestRank) / oldestRank) * 100;
  
  const isSurging = rankChangePct >= ADAPTIVE_CFG.SURGE_PCT_THRESHOLD && 
                   recentSubmitPct >= ADAPTIVE_CFG.SURGE_MIN_SUBMIT_PCT;

  return {
    playerId,
    isSurging,
    rankChangePct,
    recentSubmitPct,
    lastCalculated: now.toISOString()
  };
}

export function applyRedraftInjuryPenalty(rank: number, ctx: AdaptiveConsensusContext): number {
  const injury = ctx.injury;
  if (!injury || injury.status === "ACTIVE") return rank;

  if (injury.outForSeason && ADAPTIVE_CFG.RD_UNRANK_IF_OFS) {
    return 9999;
  }

  const weeks = injury.estReturnWeeks || 0;
  if (weeks >= 6) return rank + ADAPTIVE_CFG.RD_DROP_6PLUS_WEEKS;
  if (weeks >= 2) return rank + ADAPTIVE_CFG.RD_DROP_SHORT_2TO5;

  if (ctx.recentGames < ADAPTIVE_CFG.RD_RECOVERY_GAMES_MIN || 
      ctx.snapShare < ADAPTIVE_CFG.RD_RECOVERY_SNAP_THRESH) {
    return rank + Math.floor(ADAPTIVE_CFG.RD_DROP_SHORT_2TO5 / 2);
  }

  return rank;
}

export function applyDynastyInjurySoftener(rank: number, ctx: AdaptiveConsensusContext): number {
  const injury = ctx.injury;
  if (!injury || injury.status === "ACTIVE") return rank;

  const bio = ctx.bio;
  const baseK = ADAPTIVE_CFG.DY_BASE_PENALTY;
  const riskK = ADAPTIVE_CFG.DY_RISK[injury.injuryType as keyof typeof ADAPTIVE_CFG.DY_RISK] || 
               ADAPTIVE_CFG.DY_RISK.DEFAULT;
  const ageK = ADAPTIVE_CFG.DY_AGE_FACTOR(bio.age, bio.pos);

  // Smooth rank adjustment using curves - ready for Grok's data integration
  // When Grok provides JSON, Tiber maps year1_prod_delta/age_penalty_per_year_over → k
  // and calls adjustRankWithMultiplier(rank, k) for precise adjustments
  const k = baseK * riskK * ageK; // Combined multiplier: k < 1.0 pushes rank down
  return adjustRankWithMultiplier(rank, k);
}

// Main rebuild function
export async function rebuildAdaptiveConsensus(format: "dynasty" | "redraft", season?: number) {
  try {
    console.log(`🔄 Rebuilding adaptive consensus: ${format}${season ? ` (${season})` : ""}`);
    
    const baseConsensus = await db
      .select()
      .from(consensusBoard)
      .where(
        and(
          eq(consensusBoard.format, format),
          season ? eq(consensusBoard.season, season) : sql`season IS NULL`
        )
      )
      .orderBy(asc(consensusBoard.rank));

    let adjustedCount = 0;
    
    for (const player of baseConsensus) {
      const ctx = await gatherContext(player.playerId);
      const surge = isSurging(player.playerId, ctx.submissionHistory);
      
      const decayDays = surge.isSurging ? ADAPTIVE_CFG.SURGE_DECAY_DAYS : ADAPTIVE_CFG.BASE_DECAY_DAYS;
      let smoothedRank = player.rank;
      
      const adjustedRank = format === "redraft"
        ? applyRedraftInjuryPenalty(smoothedRank, ctx)
        : applyDynastyInjurySoftener(smoothedRank, ctx);
      
      if (Math.abs(adjustedRank - player.rank) > 0.5) {
        await db
          .update(consensusBoard)
          .set({ 
            rank: Math.round(adjustedRank),
            updatedAt: new Date()
          })
          .where(eq(consensusBoard.id, player.id));
        
        adjustedCount++;
      }

      const explanation: AdaptiveConsensusExplanation = {
        playerId: player.playerId,
        format,
        season,
        decayDays,
        surgeActive: surge.isSurging,
        injury: ctx.injury,
        gates: {
          recoveryGamesMet: ctx.recentGames >= ADAPTIVE_CFG.RD_RECOVERY_GAMES_MIN,
          snapShareMet: ctx.snapShare >= ADAPTIVE_CFG.RD_RECOVERY_SNAP_THRESH
        },
        notes: generateExplanationNotes(ctx, surge, smoothedRank, adjustedRank, format),
        baseRank: smoothedRank,
        adjustedRank,
        adjustmentFactors: calculateAdjustmentFactors(ctx, format)
      };

      await db
        .insert(consensusExplanations)
        .values({
          playerId: player.playerId,
          format,
          season,
          decayDays,
          surgeActive: surge.isSurging,
          baseRank: smoothedRank,
          adjustedRank,
          explanation: explanation as any
        })
        .onConflictDoUpdate({
          target: [consensusExplanations.playerId, consensusExplanations.format, consensusExplanations.season],
          set: {
            decayDays,
            surgeActive: surge.isSurging,
            baseRank: smoothedRank,
            adjustedRank,
            explanation: explanation as any,
            lastUpdated: new Date()
          }
        });
    }

    console.log(`✅ Adaptive consensus rebuilt: ${adjustedCount} adjustments made`);
    return { success: true, adjustments: adjustedCount };
    
  } catch (error) {
    console.error("Adaptive consensus rebuild error:", error);
    throw error;
  }
}

function generateExplanationNotes(
  ctx: AdaptiveConsensusContext, 
  surge: AdaptiveSurgeDetection, 
  baseRank: number, 
  adjustedRank: number,
  format: string
): string[] {
  const notes: string[] = [];

  if (surge.isSurging) {
    notes.push(`Surge mode: ${ADAPTIVE_CFG.SURGE_DECAY_DAYS}-day decay due to +${surge.rankChangePct.toFixed(1)}% rank improvement & ${surge.recentSubmitPct.toFixed(1)}% recent submissions`);
  }

  if (ctx.injury && ctx.injury.status !== "ACTIVE") {
    if (format === "redraft") {
      if (ctx.injury.outForSeason) {
        notes.push("Redraft: Unranked due to season-ending injury");
      } else if (ctx.injury.estReturnWeeks && ctx.injury.estReturnWeeks >= 6) {
        notes.push(`Redraft injury penalty: +${ADAPTIVE_CFG.RD_DROP_6PLUS_WEEKS} for ${ctx.injury.estReturnWeeks}-week absence`);
      } else if (ctx.injury.estReturnWeeks && ctx.injury.estReturnWeeks >= 2) {
        notes.push(`Redraft injury penalty: +${ADAPTIVE_CFG.RD_DROP_SHORT_2TO5} for ${ctx.injury.estReturnWeeks}-week absence`);
      }
    } else {
      notes.push(`Dynasty injury softening applied: ${ctx.injury.injuryType || "injury"} for ${ctx.bio.age}yo ${ctx.bio.pos}`);
    }
  }

  if (Math.abs(adjustedRank - baseRank) > 0.5) {
    notes.push(`Rank adjusted from ${baseRank.toFixed(1)} to ${adjustedRank.toFixed(1)}`);
  }

  return notes;
}

function calculateAdjustmentFactors(ctx: AdaptiveConsensusContext, format: string) {
  const factors: any = {};

  if (ctx.injury && ctx.injury.status !== "ACTIVE") {
    if (format === "dynasty") {
      factors.injuryTypeRisk = ADAPTIVE_CFG.DY_RISK[ctx.injury.injuryType as keyof typeof ADAPTIVE_CFG.DY_RISK] || ADAPTIVE_CFG.DY_RISK.DEFAULT;
      factors.ageRisk = ADAPTIVE_CFG.DY_AGE_FACTOR(ctx.bio.age, ctx.bio.pos);
    } else {
      if (ctx.injury.estReturnWeeks && ctx.injury.estReturnWeeks >= 6) {
        factors.injuryPenalty = ADAPTIVE_CFG.RD_DROP_6PLUS_WEEKS;
      } else if (ctx.injury.estReturnWeeks && ctx.injury.estReturnWeeks >= 2) {
        factors.injuryPenalty = ADAPTIVE_CFG.RD_DROP_SHORT_2TO5;
      }
    }
  }

  return factors;
}

// API endpoints
export async function getConsensusWhy(req: Request, res: Response) {
  try {
    const { playerId } = req.query;
    const format = (req.query.format as "dynasty" | "redraft") || "dynasty";
    const season = req.query.season ? parseInt(req.query.season as string) : undefined;

    if (!playerId) {
      return res.status(400).json({ error: "playerId required" });
    }

    const [explanation] = await db
      .select()
      .from(consensusExplanations)
      .where(
        and(
          eq(consensusExplanations.playerId, playerId as string),
          eq(consensusExplanations.format, format),
          season ? eq(consensusExplanations.season, season) : sql`season IS NULL`
        )
      );

    if (!explanation) {
      return res.status(404).json({ error: "Explanation not found" });
    }

    res.json(explanation.explanation);
  } catch (error) {
    console.error("getConsensusWhy error:", error);
    res.status(500).json({ error: "Failed to get explanation" });
  }
}

export async function rebuildConsensusEndpoint(req: Request, res: Response) {
  try {
    const { format, season } = req.body;
    
    if (!format || !["dynasty", "redraft"].includes(format)) {
      return res.status(400).json({ error: "Valid format required (dynasty/redraft)" });
    }

    const result = await rebuildAdaptiveConsensus(format, season);
    res.json(result);
  } catch (error) {
    console.error("rebuildConsensusEndpoint error:", error);
    res.status(500).json({ error: "Failed to rebuild consensus" });
  }
}