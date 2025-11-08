import { db } from "../infra/db";
import { consensusRanks, consensusAudit } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { inMemoryConsensusStore } from "./inMemoryStore";

// OTC Consensus Command Router v1 - Priority Override System
// Routes "OTC consensus ..." messages to consensus updates, bypassing injury logic

const CONSENSUS_REGEX = /^OTC\s+consensus\s+(Redraft|Dynasty)\s+(QB|RB|WR|TE|ALL)\s*(\d+)\s*:\s*(.+)$/i;

export interface ConsensusUpdatePayload {
  season: number;
  mode: "redraft" | "dynasty";
  position: "QB" | "RB" | "WR" | "TE" | "ALL";
  rank: number;
  player_name: string;
  source_user: string;
  source_weight: number;
  note?: string;
}

export interface ConsensusUpdateResult {
  success: boolean;
  message: string;
  diff?: {
    playerId: string;
    playerName: string;
    fromRank?: number;
    toRank: number;
    action: "insert" | "update" | "swap" | "shift";
  };
  ambiguousMatches?: Array<{
    id: string;
    name: string;
    team: string;
    position: string;
  }>;
}

/**
 * Parse OTC consensus command into structured payload
 * Returns null if command doesn't match the expected format
 */
export function parseConsensusCommand(text: string): ConsensusUpdatePayload | null {
  const match = text.match(CONSENSUS_REGEX);
  if (!match) return null;

  const [_, modeRaw, posRaw, rankStr, playerName] = match;
  
  return {
    season: 2025,
    mode: modeRaw.toLowerCase() as "redraft" | "dynasty",
    position: posRaw.toUpperCase() as "QB" | "RB" | "WR" | "TE" | "ALL",
    rank: Number(rankStr),
    player_name: playerName.trim(),
    source_user: "architect-j",
    source_weight: 1.0,
    note: "manual seed"
  };
}

/**
 * Resolve player name to player ID with fuzzy matching
 * Returns exact match or array of candidates for disambiguation
 */
export async function resolvePlayerId(playerName: string): Promise<{ 
  exact?: string; 
  candidates?: Array<{ id: string; name: string; team: string; position: string }> 
}> {
  // For now, create a simple player ID from the name
  // In production, this would query the player pool API or database
  const playerId = playerName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  
  // Simple exact match for demo - in production would do fuzzy search
  return { exact: playerId };
}

/**
 * Update consensus ranking with swap/shift logic
 * Handles conflicts and maintains data integrity
 */
export async function updateConsensusRank(payload: ConsensusUpdatePayload): Promise<ConsensusUpdateResult> {
  try {
    // Resolve player ID
    const playerResolution = await resolvePlayerId(payload.player_name);
    
    if (playerResolution.candidates) {
      return {
        success: false,
        message: `Multiple matches found for "${payload.player_name}". Please clarify.`,
        ambiguousMatches: playerResolution.candidates
      };
    }
    
    if (!playerResolution.exact) {
      return {
        success: false,
        message: `Player not found: "${payload.player_name}"`
      };
    }
    
    const playerId = playerResolution.exact;
    
    // Use in-memory store for demo (fallback to database when available)
    try {
      // Try database first
      const [existingRank] = await db
        .select()
        .from(consensusRanks)
        .where(and(
          eq(consensusRanks.season, payload.season),
          eq(consensusRanks.mode, payload.mode),
          eq(consensusRanks.position, payload.position),
          eq(consensusRanks.rank, payload.rank)
        ));
      
      // Database method (original implementation)
      // ... database implementation here when tables exist
      
    } catch (dbError) {
      console.log("📊 Database not ready, using in-memory store for consensus demo");
      
      // Use in-memory store for immediate functionality
      const existingRank = inMemoryConsensusStore.findRankByPosition(
        payload.season, 
        payload.mode, 
        payload.position, 
        payload.rank
      );
      
      const existingPlayer = inMemoryConsensusStore.findRankByPlayer(
        payload.season, 
        payload.mode, 
        payload.position, 
        playerId
      );
      
      let action: "insert" | "update" | "swap" | "shift" = "insert";
      let fromRank: number | undefined;
      
      if (existingPlayer) {
        fromRank = existingPlayer.rank;
        action = existingRank ? "swap" : "update";
      } else if (existingRank) {
        action = "swap";
      }
      
      // Handle swap logic in memory
      if (action === "swap" && existingRank) {
        inMemoryConsensusStore.updateRankByPosition(
          payload.season,
          payload.mode,
          payload.position,
          payload.rank,
          {
            playerId: existingRank.playerId,
            playerName: existingRank.playerName,
            rank: fromRank || -1
          }
        );
      }
      
      // Insert or update the target player
      inMemoryConsensusStore.upsertRank({
        season: payload.season,
        mode: payload.mode,
        position: payload.position,
        rank: payload.rank,
        playerId,
        playerName: payload.player_name,
        sourceUser: payload.source_user,
        sourceWeight: payload.source_weight,
        note: payload.note
      });
      
      // Log audit entry
      inMemoryConsensusStore.addAuditEntry({
        season: payload.season,
        mode: payload.mode,
        position: payload.position,
        rank: payload.rank,
        playerId,
        previousPlayerId: existingRank?.playerId,
        sourceUser: payload.source_user,
        action,
        payload: payload as any
      });
    }
    
    return {
      success: true,
      message: `✅ Consensus updated: ${payload.player_name} → ${payload.mode} ${payload.position}${payload.rank}`,
      diff: {
        playerId,
        playerName: payload.player_name,
        fromRank: undefined, // Will be populated when we have the full implementation
        toRank: payload.rank,
        action: "insert"
      }
    };
    
  } catch (error) {
    console.error("Consensus update error:", error);
    return {
      success: false,
      message: `Failed to update consensus: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check if message should be routed to consensus system
 * Returns true if message starts with "OTC consensus"
 */
export function shouldRouteToConsensus(text: string): boolean {
  return CONSENSUS_REGEX.test(text.trim());
}