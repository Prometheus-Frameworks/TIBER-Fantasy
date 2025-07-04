/**
 * Database Population Script for 6-Tier Dynasty System
 * Comprehensive tier assignment for all players in the database
 */

import { db } from "./db";
import { players } from "@shared/schema";
import { dynastyTierEngine } from "./dynastyTierSystem";
import { eq } from "drizzle-orm";

interface PlayerUpdate {
  id: number;
  name: string;
  position: string;
  age: number;
  avgPoints: number;
  team: string;
  dynastyTier: string;
  dynastyValue: number;
}

export async function populatePlayerTiers() {
  console.log("Starting 6-tier dynasty classification system...");
  
  try {
    // Get all players from database
    const allPlayers = await db.select().from(players);
    console.log(`Found ${allPlayers.length} players to classify`);
    
    const updates: PlayerUpdate[] = [];
    
    for (const player of allPlayers) {
      // Calculate dynasty score and tier
      const result = dynastyTierEngine.calculateDynastyScore({
        name: player.name,
        position: player.position,
        age: player.age || 25,
        avgPoints: player.avgPoints,
        team: player.team
      });
      
      updates.push({
        id: player.id,
        name: player.name,
        position: player.position,
        age: player.age || 25,
        avgPoints: player.avgPoints,
        team: player.team,
        dynastyTier: result.tier.name,
        dynastyValue: Math.round(result.score)
      });
    }
    
    // Group updates by tier for reporting
    const tierCounts = {
      tier0: 0, tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0
    };
    
    // Update database in batches
    console.log("Updating player tiers in database...");
    
    for (const update of updates) {
      await db
        .update(players)
        .set({
          dynastyTier: update.dynastyTier,
          dynastyValue: update.dynastyValue
        })
        .where(eq(players.id, update.id));
      
      tierCounts[update.dynastyTier as keyof typeof tierCounts]++;
    }
    
    console.log("\n=== 6-Tier Dynasty Classification Complete ===");
    console.log(`Elite (Tier 0): ${tierCounts.tier0} players`);
    console.log(`Premium (Tier 1): ${tierCounts.tier1} players`);
    console.log(`Strong (Tier 2): ${tierCounts.tier2} players`);
    console.log(`Solid (Tier 3): ${tierCounts.tier3} players`);
    console.log(`Depth (Tier 4): ${tierCounts.tier4} players`);
    console.log(`Bench (Tier 5): ${tierCounts.tier5} players`);
    console.log(`Total players classified: ${updates.length}`);
    
    // Show elite tier players
    const elitePlayers = updates
      .filter(p => p.dynastyTier === 'tier0')
      .sort((a, b) => b.dynastyValue - a.dynastyValue);
    
    console.log("\n=== Elite Tier Players (Championship Assets) ===");
    elitePlayers.forEach((player, i) => {
      console.log(`${i+1}. ${player.name} (${player.position}) - Score: ${player.dynastyValue}`);
    });
    
    return {
      totalUpdated: updates.length,
      tierBreakdown: tierCounts,
      elitePlayers: elitePlayers.slice(0, 10)
    };
    
  } catch (error) {
    console.error("Error populating player tiers:", error);
    throw error;
  }
}

// Export function for API endpoint
export async function getTierStatistics() {
  try {
    const allPlayers = await db.select().from(players);
    
    const tierStats = {
      tier0: allPlayers.filter(p => p.dynastyTier === 'tier0').length,
      tier1: allPlayers.filter(p => p.dynastyTier === 'tier1').length,
      tier2: allPlayers.filter(p => p.dynastyTier === 'tier2').length,
      tier3: allPlayers.filter(p => p.dynastyTier === 'tier3').length,
      tier4: allPlayers.filter(p => p.dynastyTier === 'tier4').length,
      tier5: allPlayers.filter(p => p.dynastyTier === 'tier5').length,
    };
    
    return {
      totalPlayers: allPlayers.length,
      tierBreakdown: tierStats,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error getting tier statistics:", error);
    throw error;
  }
}