// Initial consensus data seeding for tier management
import { db } from "../db";
import { consensusBoard, consensusMeta } from "@shared/schema";
import { sql } from "drizzle-orm";

// Sample players with initial rankings for testing tier system
const SAMPLE_CONSENSUS_DATA = [
  // QBs
  { playerId: "josh-allen", position: "QB", rank: 1, tier: 1, score: 95.0 },
  { playerId: "lamar-jackson", position: "QB", rank: 2, tier: 1, score: 93.5 },
  { playerId: "josh-jacobs", position: "QB", rank: 3, tier: 1, score: 91.2 },
  { playerId: "patrick-mahomes", position: "QB", rank: 4, tier: 2, score: 89.8 },
  { playerId: "joe-burrow", position: "QB", rank: 5, tier: 2, score: 88.5 },
  
  // RBs
  { playerId: "christian-mccaffrey", position: "RB", rank: 1, tier: 1, score: 94.2 },
  { playerId: "austin-ekeler", position: "RB", rank: 2, tier: 1, score: 92.8 },
  { playerId: "derrick-henry", position: "RB", rank: 3, tier: 1, score: 91.5 },
  { playerId: "dalvin-cook", position: "RB", rank: 4, tier: 2, score: 89.3 },
  { playerId: "alvin-kamara", position: "RB", rank: 5, tier: 2, score: 88.1 },
  
  // WRs
  { playerId: "cooper-kupp", position: "WR", rank: 1, tier: 1, score: 96.5 },
  { playerId: "stefon-diggs", position: "WR", rank: 2, tier: 1, score: 94.8 },
  { playerId: "tyreek-hill", position: "WR", rank: 3, tier: 1, score: 93.2 },
  { playerId: "davante-adams", position: "WR", rank: 4, tier: 1, score: 92.1 },
  { playerId: "justin-jefferson", position: "WR", rank: 5, tier: 1, score: 91.8 },
  { playerId: "jamarr-chase", position: "WR", rank: 6, tier: 2, score: 90.5 },
  
  // TEs
  { playerId: "travis-kelce", position: "TE", rank: 1, tier: 1, score: 93.8 },
  { playerId: "mark-andrews", position: "TE", rank: 2, tier: 1, score: 90.2 },
  { playerId: "george-kittle", position: "TE", rank: 3, tier: 2, score: 88.7 },
  { playerId: "tj-hockenson", position: "TE", rank: 4, tier: 2, score: 85.4 },
];

export async function seedInitialConsensusData() {
  try {
    console.log("🌱 Seeding initial consensus data...");
    
    // Initialize meta table
    await db.insert(consensusMeta).values({}).onConflictDoNothing();
    
    // Clear existing dynasty consensus data
    await db.delete(consensusBoard).where(sql`format = 'dynasty' AND season IS NULL`);
    
    // Insert sample dynasty data
    const dynastyRows = SAMPLE_CONSENSUS_DATA.map(player => ({
      playerId: player.playerId,
      format: "dynasty" as const,
      season: null,
      rank: player.rank,
      tier: player.tier.toString(),
      score: player.score,
      source: "system",
    }));
    
    await db.insert(consensusBoard).values(dynastyRows);
    
    console.log(`✅ Seeded ${dynastyRows.length} dynasty consensus entries`);
    
    // Also create 2025 redraft data
    const redraftRows = SAMPLE_CONSENSUS_DATA.map(player => ({
      playerId: player.playerId,
      format: "redraft" as const,
      season: 2025,
      rank: player.rank,
      tier: player.tier.toString(),
      score: player.score * 0.9, // Slightly lower scores for redraft
      source: "system",
    }));
    
    await db.insert(consensusBoard).values(redraftRows);
    
    console.log(`✅ Seeded ${redraftRows.length} redraft consensus entries`);
    
    return { dynastyCount: dynastyRows.length, redraftCount: redraftRows.length };
    
  } catch (error) {
    console.error("❌ Error seeding consensus data:", error);
    throw error;
  }
}

// Export for manual execution
if (import.meta.url === `file://${process.argv[1]}`) {
  seedInitialConsensusData()
    .then(result => {
      console.log("🎯 Consensus seeding complete:", result);
      process.exit(0);
    })
    .catch(error => {
      console.error("💥 Consensus seeding failed:", error);
      process.exit(1);
    });
}