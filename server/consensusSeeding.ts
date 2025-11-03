import { Router } from "express";
import { db } from "./infra/db";
import { consensusBoard, consensusMeta } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { parseConsensusCommand, type ConsensusCommand, type ConsensusCommandResult } from "@shared/types/consensusSeeding";
import { playerPoolService } from "./playerPool";

const router = Router();

// POST /api/consensus/seed - Handle shorthand consensus commands
router.post("/seed", async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Command string required"
      });
    }
    
    console.log(`🌱 Processing consensus command: "${command}"`);
    
    // Parse shorthand command with enhanced error handling
    const { command: parsed, error } = parseConsensusCommand(command);
    if (error) {
      return res.status(400).json(error);
    }
    
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: "❌ Error: Failed to parse command",
        errorType: "INVALID_FORMAT"
      });
    }
    
    // Execute the consensus update
    const result = await executeConsensusCommand(parsed);
    
    // Log the command execution with enhanced format
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const logEntry = `[${timestamp}] Architect J → Moved ${parsed.playerName} to ${parsed.position}${parsed.rank} (${parsed.format === 'dynasty' ? 'Dynasty' : 'Redraft'} Consensus)`;
    console.log(`📝 ${logEntry}`);
    
    res.json({
      ...result,
      logEntry,
      command: parsed
    });
    
  } catch (error) {
    console.error("❌ Consensus seeding error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process consensus command"
    });
  }
});

// GET /api/consensus/seed/logs - Get seeding command history
router.get("/seed/logs", async (req, res) => {
  try {
    // For now, return a simple structure - could be enhanced with actual log table
    res.json({
      logs: [
        {
          timestamp: new Date().toISOString(),
          message: "Consensus seeding system initialized",
          user: "system"
        }
      ]
    });
  } catch (error) {
    console.error("❌ Error fetching seed logs:", error);
    res.status(500).json({ error: "Failed to fetch seed logs" });
  }
});

async function executeConsensusCommand(command: ConsensusCommand): Promise<ConsensusCommandResult> {
  try {
    const { position, rank, playerName, format = "dynasty" } = command;
    
    // Find player in player pool
    const player = playerPoolService.findPlayerByName(playerName);
    if (!player) {
      return {
        success: false,
        message: `❌ Error: Player '${playerName}' not found in database. Check spelling or add player first.`,
        errorType: "PLAYER_NOT_FOUND"
      };
    }
    
    console.log(`✅ Found player: ${player.name} (${player.id})`);
    
    // Check format/season validation
    const season = format === "redraft" ? 2025 : null;
    
    // Execute in transaction to handle rank shifting
    const result = await db.transaction(async (tx) => {
      // Check if target rank is already occupied
      const conditions = [
        eq(consensusBoard.format, format),
        eq(consensusBoard.rank, rank)
      ];
      
      if (format === "redraft") {
        conditions.push(eq(consensusBoard.season, 2025));
      } else {
        conditions.push(sql`${consensusBoard.season} IS NULL`);
      }
      
      const [existingAtRank] = await tx
        .select()
        .from(consensusBoard)
        .where(and(...conditions))
        .limit(1);
      
      let shifts: Array<{ playerName: string; fromRank: number; toRank: number; }> = [];
      let previousPlayer: { name: string; rank: number; } | undefined;
      
      if (existingAtRank) {
        // Need to shift existing player and all below down by 1
        console.log(`🔄 Rank ${rank} occupied, shifting players down...`);
        
        // Get all players at or above this rank to shift them down
        const playersToShift = await tx
          .select()
          .from(consensusBoard)
          .where(and(
            eq(consensusBoard.format, format),
            format === "redraft" ? eq(consensusBoard.season, 2025) : sql`${consensusBoard.season} IS NULL`,
            gte(consensusBoard.rank, rank)
          ))
          .orderBy(consensusBoard.rank);
        
        // Shift each player down by 1
        for (const playerToShift of playersToShift) {
          const newRank = playerToShift.rank + 1;
          await tx
            .update(consensusBoard)
            .set({ rank: newRank, updatedAt: new Date() })
            .where(eq(consensusBoard.id, playerToShift.id));
          
          shifts.push({
            playerName: `Player ${playerToShift.playerId}`, // TODO: resolve player names
            fromRank: playerToShift.rank,
            toRank: newRank
          });
        }
        
        previousPlayer = {
          name: `Player ${existingAtRank.playerId}`,
          rank: existingAtRank.rank
        };
      }
      
      // Remove any existing entry for this player in this format
      const existingPlayerConditions = [
        eq(consensusBoard.format, format),
        eq(consensusBoard.playerId, player.id)
      ];
      
      if (format === "redraft") {
        existingPlayerConditions.push(eq(consensusBoard.season, 2025));
      } else {
        existingPlayerConditions.push(sql`${consensusBoard.season} IS NULL`);
      }
      
      await tx
        .delete(consensusBoard)
        .where(and(...existingPlayerConditions));
      
      // Insert new ranking
      await tx.insert(consensusBoard).values({
        playerId: player.id,
        format,
        season,
        rank,
        tier: getTierFromRank(rank),
        score: calculateScoreFromRank(rank, format),
        source: "editor",
      });
      
      // Bump board version
      await tx
        .update(consensusMeta)
        .set({ 
          boardVersion: sql`${consensusMeta.boardVersion} + 1`,
          updatedAt: new Date()
        })
        .where(eq(consensusMeta.id, "singleton"));
      
      // Generate success message based on whether rank was occupied
      let successMessage: string;
      const formatDisplay = format === 'dynasty' ? 'Dynasty' : 'Redraft';
      
      if (existingAtRank) {
        const shiftedPlayerName = previousPlayer?.name || 'existing player';
        successMessage = `✅ Success: Moved ${player.name} to ${position}${rank}. Shifted ${shiftedPlayerName} down 1 slot in ${formatDisplay} Consensus.`;
      } else {
        successMessage = `✅ Success: Added ${player.name} to ${position}${rank} in ${formatDisplay} Consensus.`;
      }
      
      return {
        success: true,
        message: successMessage,
        previousPlayer,
        shifts,
        format
      };
    });
    
    return result;
    
  } catch (error) {
    console.error("executeConsensusCommand error:", error);
    return {
      success: false,
      message: `❌ Error: Database operation failed. ${error instanceof Error ? error.message : 'Unknown error'}`,
      errorType: "DATABASE_ERROR"
    };
  }
}

function getTierFromRank(rank: number): string {
  if (rank <= 12) return 'S';
  if (rank <= 24) return 'A';
  if (rank <= 48) return 'B';
  if (rank <= 96) return 'C';
  return 'D';
}

function calculateScoreFromRank(rank: number, format: string): number {
  // Inverse scoring: rank 1 = ~95-100, rank 50 = ~50-60
  const baseScore = Math.max(100 - (rank * 0.8), 10);
  
  // Slight format adjustment
  if (format === "redraft") {
    return Math.round((baseScore + 2) * 10) / 10;
  }
  
  return Math.round(baseScore * 10) / 10;
}

export default router;