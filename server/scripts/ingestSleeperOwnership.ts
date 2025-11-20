/**
 * Sleeper Ownership Ingest Script
 * Fetches platform-wide ownership percentages from Sleeper Research API
 * and stores them in the sleeper_ownership table
 */

import { db } from '../infra/db';
import { sleeperOwnership } from '@shared/schema';
import { sleeperAPI } from '../sleeperAPI';
import { sql } from 'drizzle-orm';

interface OwnershipIngestOptions {
  season: number;
  week?: number;
  seasonType?: 'regular' | 'post' | 'pre' | 'off';
}

/**
 * Ingest ownership data from Sleeper Research API
 */
export async function ingestSleeperOwnership(options: OwnershipIngestOptions) {
  const { season, week, seasonType = 'regular' } = options;
  
  console.log(`\n🔍 [Ownership Ingest] Starting for ${season} ${seasonType}${week ? ` Week ${week}` : ' (season-level)'}...`);
  
  try {
    // Fetch ownership data from Sleeper
    const ownershipData = await sleeperAPI.getOwnershipData(season, seasonType, week);
    
    if (!ownershipData || Object.keys(ownershipData).length === 0) {
      console.log('⚠️  [Ownership Ingest] No ownership data returned from Sleeper');
      return { success: false, playerCount: 0 };
    }

    const playerIds = Object.keys(ownershipData);
    console.log(`📊 [Ownership Ingest] Processing ${playerIds.length} players...`);

    let insertCount = 0;
    let updateCount = 0;
    let errorCount = 0;

    // Process ownership data in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
      const batch = playerIds.slice(i, i + BATCH_SIZE);
      
      for (const playerId of batch) {
        const playerOwnership = ownershipData[playerId];
        
        try {
          // CRITICAL: roster_percent is already 0-100 from sleeperAPI (fixed field name bug)
          // Round to 1 decimal place for storage
          const ownershipPercentage = playerOwnership.roster_percent 
            ? Math.round(playerOwnership.roster_percent * 10) / 10
            : 0;

          // Upsert ownership data
          await db
            .insert(sleeperOwnership)
            .values({
              playerId,
              season,
              week: week || null,
              ownershipPercentage,
              rosterCount: null, // Sleeper API doesn't provide actual roster counts, only percentages
              totalLeagues: null, // Sleeper doesn't provide this directly
            })
            .onConflictDoUpdate({
              target: [
                sleeperOwnership.playerId,
                sleeperOwnership.season,
                sleeperOwnership.week
              ],
              set: {
                ownershipPercentage,
                rosterCount: null, // Keep null - we only have percentages
                lastUpdated: sql`NOW()`,
              },
            });

          if (ownershipPercentage > 0) {
            insertCount++;
          } else {
            updateCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ [Ownership Ingest] Error processing player ${playerId}:`, error);
        }
      }

      // Progress update
      if ((i + BATCH_SIZE) % 500 === 0) {
        console.log(`  ✅ Processed ${Math.min(i + BATCH_SIZE, playerIds.length)}/${playerIds.length} players...`);
      }
    }

    console.log(`\n✅ [Ownership Ingest] Complete!`);
    console.log(`   📝 Inserted/Updated: ${insertCount + updateCount} players`);
    console.log(`   ✅ With ownership > 0%: ${insertCount} players`);
    console.log(`   ⚠️  Errors: ${errorCount}`);

    return {
      success: true,
      playerCount: insertCount + updateCount,
      insertCount,
      updateCount,
      errorCount,
    };
  } catch (error) {
    console.error('❌ [Ownership Ingest] Fatal error:', error);
    return {
      success: false,
      playerCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run ownership ingest for current week
 */
async function main() {
  const currentYear = new Date().getFullYear();
  const currentWeek = 12; // TODO: Auto-detect current NFL week
  
  console.log('🚀 Sleeper Ownership Ingest Script');
  console.log('===================================\n');

  // Ingest current week data
  const result = await ingestSleeperOwnership({
    season: currentYear,
    week: currentWeek,
    seasonType: 'regular',
  });

  if (result.success) {
    console.log('\n✅ Ownership data successfully ingested');
    process.exit(0);
  } else {
    console.error('\n❌ Ownership ingest failed');
    process.exit(1);
  }
}

// Run script
main();
