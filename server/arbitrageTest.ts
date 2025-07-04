import { db } from "./db";
import { players } from "@shared/schema";
import type { Player } from "@shared/schema";
import { valueArbitrageService } from "./valueArbitrage";

// Quick test of arbitrage functionality with top players
export async function testArbitrageSystem() {
  try {
    // Get top 10 players by average points for quick test
    const topPlayers = await db.select().from(players)
      .orderBy(players.avgPoints)
      .limit(10);
    
    console.log(`Testing arbitrage with ${topPlayers.length} top players...`);
    
    const opportunities = [];
    
    for (const player of topPlayers) {
      const analysis = await valueArbitrageService.analyzePlayer(player.id);
      if (analysis) {
        opportunities.push(analysis);
        console.log(`${player.name}: ${analysis.recommendation} (${analysis.confidence}% confidence, ${analysis.valueGap} gap)`);
      }
    }
    
    return opportunities.slice(0, 5); // Return top 5 for quick response
  } catch (error) {
    console.error('Arbitrage test error:', error);
    return [];
  }
}