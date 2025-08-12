import { Router } from "express";
import { db } from "./db";
import { consensusBoard, consensusMeta, consensusChangelog } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { ConsensusFormat, ConsensusResponse, ConsensusPatchRequest } from "@shared/types/consensus";

const router = Router();

// Helper to validate format/season combo
function validateFormatSeason(format: ConsensusFormat, season?: number): { valid: boolean; error?: string } {
  if (format === 'redraft' && !season) {
    return { valid: false, error: 'season required for redraft' };
  }
  if (format === 'dynasty' && season) {
    return { valid: false, error: 'dynasty must not include season' };
  }
  return { valid: true };
}

// GET /api/consensus - fetch consensus board
router.get("/", async (req, res) => {
  try {
    const { format, season } = req.query;
    
    // Get meta first
    let meta = await db.select().from(consensusMeta).where(eq(consensusMeta.id, "singleton")).limit(1);
    if (meta.length === 0) {
      // Initialize meta if doesn't exist
      await db.insert(consensusMeta).values({});
      meta = await db.select().from(consensusMeta).where(eq(consensusMeta.id, "singleton")).limit(1);
    }
    
    const consensusMt = meta[0];
    
    // Use default format if not specified
    const queryFormat = (format as ConsensusFormat) || consensusMt.defaultFormat;
    const querySeason = season ? parseInt(season as string) : undefined;
    
    // Validate format/season combo
    const validation = validateFormatSeason(queryFormat, querySeason);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Build query conditions
    const conditions = [eq(consensusBoard.format, queryFormat)];
    if (queryFormat === 'redraft' && querySeason) {
      conditions.push(eq(consensusBoard.season, querySeason));
    } else if (queryFormat === 'dynasty') {
      conditions.push(sql`${consensusBoard.season} IS NULL`);
    }
    
    // Fetch rows
    const rows = await db
      .select()
      .from(consensusBoard)
      .where(and(...conditions))
      .orderBy(consensusBoard.rank);
    
    const response: ConsensusResponse = {
      meta: {
        defaultFormat: consensusMt.defaultFormat,
        boardVersion: consensusMt.boardVersion,
      },
      rows: rows.map(row => ({
        id: row.id,
        playerId: row.playerId,
        format: row.format,
        season: row.season || undefined,
        rank: row.rank,
        tier: row.tier,
        score: row.score,
        source: row.source,
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
    
    res.json(response);
  } catch (error) {
    console.error("Error fetching consensus:", error);
    res.status(500).json({ error: "Failed to fetch consensus data" });
  }
});

// PATCH /api/consensus - update consensus rows
router.patch("/", async (req, res) => {
  try {
    const { format, season, updates }: ConsensusPatchRequest = req.body;
    
    // Validate format/season combo
    const validation = validateFormatSeason(format, season);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // TODO: Add role-based authorization check
    // if (!req.user || !['founder', 'editor'].includes(req.user.role)) {
    //   return res.status(403).json({ error: 'Insufficient permissions' });
    // }
    
    // Process updates in transaction
    await db.transaction(async (tx) => {
      for (const update of updates) {
        // Get current row for changelog
        const conditions = [
          eq(consensusBoard.format, format),
          eq(consensusBoard.playerId, update.playerId)
        ];
        
        if (format === 'redraft' && season) {
          conditions.push(eq(consensusBoard.season, season));
        } else if (format === 'dynasty') {
          conditions.push(sql`${consensusBoard.season} IS NULL`);
        }
        
        const [existing] = await tx
          .select()
          .from(consensusBoard)
          .where(and(...conditions))
          .limit(1);
        
        if (!existing) continue; // Skip if player not found
        
        // Prepare update data
        const updateData: any = { updatedAt: new Date() };
        if (update.rank !== undefined) updateData.rank = update.rank;
        if (update.tier !== undefined) updateData.tier = update.tier;
        if (update.score !== undefined) updateData.score = update.score;
        
        // Update row
        await tx
          .update(consensusBoard)
          .set(updateData)
          .where(and(...conditions));
        
        // Log change
        await tx.insert(consensusChangelog).values({
          userId: undefined, // TODO: get from req.user
          format,
          season: format === 'dynasty' ? null : season,
          playerId: update.playerId,
          before: {
            rank: existing.rank,
            tier: existing.tier,
            score: existing.score,
          },
          after: {
            rank: update.rank ?? existing.rank,
            tier: update.tier ?? existing.tier,
            score: update.score ?? existing.score,
          },
        });
      }
      
      // Bump board version
      await tx
        .update(consensusMeta)
        .set({ 
          boardVersion: sql`${consensusMeta.boardVersion} + 1`,
          updatedAt: new Date()
        })
        .where(eq(consensusMeta.id, "singleton"));
    });
    
    // Get new board version
    const [meta] = await db
      .select()
      .from(consensusMeta)
      .where(eq(consensusMeta.id, "singleton"))
      .limit(1);
    
    res.json({ 
      ok: true, 
      boardVersion: meta.boardVersion 
    });
    
  } catch (error) {
    console.error("Error updating consensus:", error);
    res.status(500).json({ error: "Failed to update consensus data" });
  }
});

// GET /api/consensus/meta - fetch metadata
router.get("/meta", async (req, res) => {
  try {
    let meta = await db.select().from(consensusMeta).where(eq(consensusMeta.id, "singleton")).limit(1);
    if (meta.length === 0) {
      // Initialize meta if doesn't exist
      await db.insert(consensusMeta).values({});
      meta = await db.select().from(consensusMeta).where(eq(consensusMeta.id, "singleton")).limit(1);
    }
    
    res.json({
      defaultFormat: meta[0].defaultFormat,
      boardVersion: meta[0].boardVersion,
    });
  } catch (error) {
    console.error("Error fetching consensus meta:", error);
    res.status(500).json({ error: "Failed to fetch consensus metadata" });
  }
});

export default router;