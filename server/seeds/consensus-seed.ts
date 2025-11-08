import { db } from "../infra/db";
import { consensusBoard, consensusMeta } from "@shared/schema";
import { playerPoolService } from "../playerPool";

export async function seedConsensusBoards() {
  try {
    console.log("🌱 Seeding consensus boards...");
    
    // Initialize meta if doesn't exist
    await db.insert(consensusMeta).values({}).onConflictDoNothing();
    
    // Get players from player pool
    const players = playerPoolService.getAllPlayers();
    console.log(`📊 Found ${players.length} players for consensus seeding`);
    
    // Dynasty seed - all players, no season
    const dynastyRows = players
      .filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.pos))
      .slice(0, 200) // Top 200 for dynasty
      .map((player, index) => ({
        playerId: player.id,
        format: 'dynasty' as const,
        season: null,
        rank: index + 1,
        tier: getTierFromRank(index + 1),
        score: calculateDynastyScore(player, index),
        source: 'system' as const,
      }));
    
    // Redraft 2025 seed - focus on 2025 projections
    const redraftRows = players
      .filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.pos))
      .slice(0, 150) // Top 150 for redraft
      .map((player, index) => ({
        playerId: player.id,
        format: 'redraft' as const,
        season: 2025,
        rank: index + 1,
        tier: getTierFromRank(index + 1),
        score: calculateRedraftScore(player, index),
        source: 'system' as const,
      }));
    
    // Insert dynasty consensus
    if (dynastyRows.length > 0) {
      await db.insert(consensusBoard).values(dynastyRows).onConflictDoNothing();
      console.log(`✅ Seeded ${dynastyRows.length} dynasty consensus rows`);
    }
    
    // Insert redraft consensus
    if (redraftRows.length > 0) {
      await db.insert(consensusBoard).values(redraftRows).onConflictDoNothing();
      console.log(`✅ Seeded ${redraftRows.length} redraft 2025 consensus rows`);
    }
    
    console.log("🌱 Consensus boards seeded successfully");
    
  } catch (error) {
    console.error("❌ Error seeding consensus boards:", error);
    throw error;
  }
}

function getTierFromRank(rank: number): string {
  if (rank <= 12) return 'S';
  if (rank <= 24) return 'A';
  if (rank <= 48) return 'B';
  if (rank <= 96) return 'C';
  return 'D';
}

function calculateDynastyScore(player: any, rank: number): number {
  // Base score from 100 down to 10 based on rank
  let score = Math.max(100 - (rank * 0.4), 10);
  
  // Age adjustment for dynasty (younger = better)
  if (player.age) {
    if (player.age <= 23) score += 5;
    else if (player.age <= 25) score += 2;
    else if (player.age >= 29) score -= 3;
    else if (player.age >= 31) score -= 8;
  }
  
  // Position scarcity adjustment
  if (player.pos === 'RB' && player.age && player.age >= 27) score -= 5;
  if (player.pos === 'TE' && rank <= 12) score += 3;
  
  return Math.round(score * 10) / 10; // Round to 1 decimal
}

function calculateRedraftScore(player: any, rank: number): number {
  // Base score from 100 down to 10 based on rank
  let score = Math.max(100 - (rank * 0.5), 10);
  
  // Redraft focuses more on immediate production
  if (player.projectedPoints) {
    score += (player.projectedPoints / 20); // Boost for high projections
  }
  
  // Health is critical for redraft
  if (player.injuryStatus && player.injuryStatus !== 'Healthy') {
    score -= 8;
  }
  
  return Math.round(score * 10) / 10; // Round to 1 decimal
}