import { Request, Response } from "express";
import { db } from "./infra/db";
import { userProfiles, userRanks, fireEvents, consensusBoard, consensusMeta } from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import type { Format, Position, ConsensusMetadata, CompareRanking } from "@shared/types/consensus";

// Profile management endpoints
export async function getProfile(req: Request, res: Response) {
  try {
    const { username } = req.params;
    const decodedUsername = decodeURIComponent(username);
    
    // Try to find by username (case insensitive) or by id
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(
        username.toLowerCase() === "architect-j" 
          ? eq(userProfiles.id, "architect-j")
          : eq(userProfiles.username, decodedUsername)
      );

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Return public-safe subset
    res.json({
      username: profile.username,
      consentConsensus: profile.consentConsensus,
      fireScore: profile.fireScore,
      createdAt: profile.createdAt
    });
  } catch (error) {
    console.error("getProfile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const { username } = req.params;
    const { consentConsensus } = req.body;
    
    // TODO: Add authentication check here
    // For now, allowing updates for demonstration
    
    const [updated] = await db
      .update(userProfiles)
      .set({ consentConsensus })
      .where(eq(userProfiles.username, username))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({
      username: updated.username,
      consentConsensus: updated.consentConsensus,
      fireScore: updated.fireScore
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

// Fire badge endpoints  
export async function giveFire(req: Request, res: Response) {
  try {
    const { toUserId, targetType, targetId } = req.body;
    const fromUserId = "architect-j"; // TODO: Get from auth session
    
    // TODO: Add rate limiting per day
    
    // Insert fire event
    await db.insert(fireEvents).values({
      fromUserId,
      toUserId,
      targetType,
      targetId
    });

    // Increment fire score
    await db
      .update(userProfiles)
      .set({ 
        fireScore: sql`${userProfiles.fireScore} + 1`
      })
      .where(eq(userProfiles.id, toUserId));

    res.json({ success: true, message: "Fire given successfully" });
  } catch (error) {
    console.error("giveFire error:", error);
    res.status(500).json({ error: "Failed to give fire" });
  }
}

export async function getFireLeaderboard(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    const leaderboard = await db
      .select({
        username: userProfiles.username,
        fireScore: userProfiles.fireScore
      })
      .from(userProfiles)
      .where(sql`${userProfiles.fireScore} > 0`)
      .orderBy(desc(userProfiles.fireScore))
      .limit(limit);

    res.json(leaderboard);
  } catch (error) {
    console.error("getFireLeaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch fire leaderboard" });
  }
}

// Consensus calculation and rebuild
export async function rebuildConsensus(req: Request, res: Response) {
  try {
    const { format, season } = req.body as { format: Format, season?: number };
    
    console.log(`🔄 Rebuilding consensus for ${format}${season ? ` season ${season}` : ''}`);
    
    // Get all consenting users
    const consentingUsers = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.consentConsensus, true));

    if (consentingUsers.length === 0) {
      return res.status(400).json({ error: "No consenting users found" });
    }

    const userIds = consentingUsers.map(u => u.id);
    
    // Get all unique players with ranks from consenting users
    const userRankings = await db
      .select()
      .from(userRanks)
      .where(and(
        sql`${userRanks.userId} = ANY(${userIds})`,
        eq(userRanks.format, format),
        season ? eq(userRanks.season, season) : sql`${userRanks.season} IS NULL`
      ));

    // Group by player and calculate consensus ranks
    const playerRanks = new Map<string, number[]>();
    const playerPositions = new Map<string, Position>();
    
    for (const ranking of userRankings) {
      if (!playerRanks.has(ranking.playerId)) {
        playerRanks.set(ranking.playerId, []);
        playerPositions.set(ranking.playerId, ranking.pos);
      }
      playerRanks.get(ranking.playerId)!.push(ranking.rank);
    }

    // Calculate consensus ranks (equal weight average)
    const consensusRows = [];
    for (const [playerId, ranks] of playerRanks.entries()) {
      const averageRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
      const consensusRank = Math.round(averageRank);
      const pos = playerPositions.get(playerId)!;
      
      consensusRows.push({
        playerId,
        format,
        season: season || null,
        pos,
        rank: consensusRank,
        source: "community" as const,
        updatedAt: new Date()
      });
    }

    // Clear existing consensus for this format/season  
    await db
      .delete(consensusBoard)
      .where(and(
        eq(consensusBoard.format, format),
        season ? eq(consensusBoard.season, season) : sql`${consensusBoard.season} IS NULL`
      ));

    // Insert new consensus
    if (consensusRows.length > 0) {
      await db.insert(consensusBoard).values(consensusRows);
    }

    // Update metadata
    await db
      .update(consensusMeta)
      .set({
        boardVersion: sql`${consensusMeta.boardVersion} + 1`,
        updatedAt: new Date()
      })
      .where(eq(consensusMeta.id, "singleton"));

    console.log(`✅ Consensus rebuilt: ${consensusRows.length} players, ${userIds.length} contributors`);
    
    res.json({
      success: true,
      playersProcessed: consensusRows.length,
      contributors: userIds.length,
      source: "community"
    });
  } catch (error) {
    console.error("rebuildConsensus error:", error);
    res.status(500).json({ error: "Failed to rebuild consensus" });
  }
}

// Consensus metadata endpoint
export async function getConsensusMetadata(req: Request, res: Response) {
  try {
    const { format, season } = req.query as { format: Format, season?: string };
    
    // Get consenting contributors count
    const contributorsCount = await db
      .select({ count: sql<number>`count(DISTINCT ${userRanks.userId})` })
      .from(userRanks)
      .innerJoin(userProfiles, eq(userRanks.userId, userProfiles.id))
      .where(and(
        eq(userProfiles.consentConsensus, true),
        eq(userRanks.format, format),
        season ? eq(userRanks.season, parseInt(season)) : sql`${userRanks.season} IS NULL`
      ));

    // Get last updated timestamp
    const [metadata] = await db
      .select()
      .from(consensusMeta)
      .where(eq(consensusMeta.id, "singleton"));

    const result: ConsensusMetadata = {
      contributors: contributorsCount[0]?.count || 0,
      lastUpdatedISO: metadata?.updatedAt?.toISOString() || new Date().toISOString(),
      equalWeight: true,
      format,
      season: season ? parseInt(season) : undefined
    };

    res.json(result);
  } catch (error) {
    console.error("getConsensusMetadata error:", error);
    res.status(500).json({ error: "Failed to fetch consensus metadata" });
  }
}

// Compare rankings endpoint
export async function compareRankings(req: Request, res: Response) {
  try {
    const { username } = req.params;
    const { format, pos = "ALL" } = req.query as { format: Format, pos?: Position };
    
    // Get user profile
    const [userProfile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.username, username));

    if (!userProfile) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user rankings
    const userRankings = await db
      .select()
      .from(userRanks)
      .where(and(
        eq(userRanks.userId, userProfile.id),
        eq(userRanks.format, format),
        pos !== "ALL" ? eq(userRanks.pos, pos) : sql`1=1`
      ))
      .orderBy(asc(userRanks.rank));

    // Get consensus rankings
    const consensusRankings = await db
      .select()
      .from(consensusBoard)
      .where(and(
        eq(consensusBoard.format, format),
        pos !== "ALL" ? eq(consensusBoard.pos, pos) : sql`1=1`
      ))
      .orderBy(asc(consensusBoard.rank));

    // Build comparison data
    const comparisons: CompareRanking[] = [];
    const allPlayerIds = new Set([
      ...userRankings.map(r => r.playerId),
      ...consensusRankings.map(r => r.playerId)
    ]);

    for (const playerId of allPlayerIds) {
      const userRank = userRankings.find(r => r.playerId === playerId);
      const consensusRank = consensusRankings.find(r => r.playerId === playerId);
      
      const comparison: CompareRanking = {
        playerId,
        playerName: playerId, // TODO: Resolve player names from player pool
        yourRank: userRank?.rank,
        consensusRank: consensusRank?.rank,
        delta: consensusRank?.rank && userRank?.rank 
          ? consensusRank.rank - userRank.rank 
          : undefined
      };
      
      comparisons.push(comparison);
    }

    // Sort by consensus rank, then user rank
    comparisons.sort((a, b) => {
      if (a.consensusRank && b.consensusRank) return a.consensusRank - b.consensusRank;
      if (a.consensusRank) return -1;
      if (b.consensusRank) return 1;
      if (a.yourRank && b.yourRank) return a.yourRank - b.yourRank;
      return 0;
    });

    res.json(comparisons);
  } catch (error) {
    console.error("compareRankings error:", error);
    res.status(500).json({ error: "Failed to compare rankings" });
  }
}