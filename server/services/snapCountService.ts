/**
 * Snap Count Service
 * Fetches real snap count data from NFLfastR via nfl-data-py
 */
import { spawn } from 'child_process';
import { db } from '../db';
import { bronzeNflfastrSnapCounts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface SnapCountRecord {
  gameId: string;
  pfrGameId: string | null;
  season: number;
  gameType: string;
  week: number;
  player: string;
  pfrPlayerId: string | null;
  position: string;
  team: string;
  opponent: string;
  offenseSnaps: number;
  offensePct: number;
  defenseSnaps: number;
  defensePct: number;
  stSnaps: number;
  stPct: number;
}

export class SnapCountService {
  /**
   * Fetch snap counts from NFLfastR for specified seasons
   */
  async fetchSnapCounts(seasons: number[]): Promise<SnapCountRecord[]> {
    return new Promise((resolve, reject) => {
      console.log(`📊 Fetching snap counts from NFLfastR for seasons: ${seasons.join(', ')}`);
      
      const pythonScript = `
import nfl_data_py as nfl
import pandas as pd
import json
import sys
import warnings
warnings.filterwarnings('ignore')

try:
    # Fetch snap counts
    snap_counts = nfl.import_snap_counts(${JSON.stringify(seasons)})
    
    if snap_counts is None or snap_counts.empty:
        print(json.dumps([]))
        sys.exit(0)
    
    # Convert to records
    records = snap_counts.to_dict('records')
    
    # Clean up data types
    for record in records:
        for key, value in record.items():
            if pd.isna(value):
                record[key] = None
            elif isinstance(value, (int, float)) and pd.notna(value):
                if key.endswith('_pct'):
                    record[key] = float(value)
                elif key.endswith('_snaps'):
                    record[key] = int(value)
    
    print(json.dumps(records))
    
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

      const pythonProcess = spawn('python3', ['-c', pythonScript]);
      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('❌ Python script failed:', stderr);
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const data = JSON.parse(stdout);
          
          if (data.error) {
            reject(new Error(data.error));
            return;
          }

          const records: SnapCountRecord[] = data.map((record: any) => ({
            gameId: record.game_id,
            pfrGameId: record.pfr_game_id || null,
            season: record.season,
            gameType: record.game_type,
            week: record.week,
            player: record.player,
            pfrPlayerId: record.pfr_player_id || null,
            position: record.position,
            team: record.team,
            opponent: record.opponent,
            offenseSnaps: record.offense_snaps || 0,
            offensePct: record.offense_pct || 0,
            defenseSnaps: record.defense_snaps || 0,
            defensePct: record.defense_pct || 0,
            stSnaps: record.st_snaps || 0,
            stPct: record.st_pct || 0,
          }));

          console.log(`✅ Fetched ${records.length} snap count records`);
          resolve(records);

        } catch (error) {
          console.error('❌ Failed to parse Python output:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Import snap counts into database
   */
  async importSnapCounts(records: SnapCountRecord[]): Promise<void> {
    console.log(`📥 Importing ${records.length} snap count records...`);
    
    // Import in batches of 500 for better performance
    const BATCH_SIZE = 500;
    let imported = 0;
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      try {
        const values = batch.map(record => ({
          gameId: record.gameId,
          pfrGameId: record.pfrGameId,
          season: record.season,
          gameType: record.gameType,
          week: record.week,
          player: record.player,
          pfrPlayerId: record.pfrPlayerId,
          position: record.position,
          team: record.team,
          opponent: record.opponent,
          offenseSnaps: record.offenseSnaps,
          offensePct: record.offensePct,
          defenseSnaps: record.defenseSnaps,
          defensePct: record.defensePct,
          stSnaps: record.stSnaps,
          stPct: record.stPct,
        }));
        
        await db
          .insert(bronzeNflfastrSnapCounts)
          .values(values)
          .onConflictDoUpdate({
            target: [bronzeNflfastrSnapCounts.gameId, bronzeNflfastrSnapCounts.player],
            set: {
              offenseSnaps: values[0].offenseSnaps, // Placeholder, actual values handled by conflict
              offensePct: values[0].offensePct,
              defenseSnaps: values[0].defenseSnaps,
              defensePct: values[0].defensePct,
              stSnaps: values[0].stSnaps,
              stPct: values[0].stPct,
              importedAt: new Date(),
            },
          });
        
        imported += batch.length;
        console.log(`  Progress: ${imported}/${records.length} (${Math.round(imported/records.length*100)}%)`);
        
      } catch (error) {
        console.error(`❌ Failed to import batch ${i}-${i+batch.length}:`, error);
        // Try individual inserts for this batch as fallback
        for (const record of batch) {
          try {
            await db
              .insert(bronzeNflfastrSnapCounts)
              .values({
                gameId: record.gameId,
                pfrGameId: record.pfrGameId,
                season: record.season,
                gameType: record.gameType,
                week: record.week,
                player: record.player,
                pfrPlayerId: record.pfrPlayerId,
                position: record.position,
                team: record.team,
                opponent: record.opponent,
                offenseSnaps: record.offenseSnaps,
                offensePct: record.offensePct,
                defenseSnaps: record.defenseSnaps,
                defensePct: record.defensePct,
                stSnaps: record.stSnaps,
                stPct: record.stPct,
              })
              .onConflictDoNothing();
          } catch (e) {
            // Skip individual failures silently
          }
        }
      }
    }
    
    console.log(`✅ Import complete: ${imported} records`);
  }

  /**
   * Get snap percentage for a player in a specific week
   */
  async getPlayerSnapPct(
    playerName: string,
    week: number,
    season: number,
    position?: string
  ): Promise<number | null> {
    try {
      const conditions = [
        eq(bronzeNflfastrSnapCounts.player, playerName),
        eq(bronzeNflfastrSnapCounts.week, week),
        eq(bronzeNflfastrSnapCounts.season, season),
      ];
      
      if (position) {
        conditions.push(eq(bronzeNflfastrSnapCounts.position, position));
      }
      
      const result = await db
        .select()
        .from(bronzeNflfastrSnapCounts)
        .where(and(...conditions))
        .limit(1);
      
      if (result.length === 0) {
        return null;
      }
      
      // Return as percentage (0.85 -> 85)
      return (result[0].offensePct || 0) * 100;
      
    } catch (error) {
      console.error(`❌ Error fetching snap % for ${playerName}:`, error);
      return null;
    }
  }

  /**
   * Get average snap percentage across multiple weeks
   */
  async getPlayerAvgSnapPct(
    playerName: string,
    startWeek: number,
    endWeek: number,
    season: number,
    position?: string
  ): Promise<{ avgPct: number; trend: 'rising' | 'stable' | 'falling' }> {
    try {
      const snapData = await db
        .select()
        .from(bronzeNflfastrSnapCounts)
        .where(
          and(
            eq(bronzeNflfastrSnapCounts.player, playerName),
            eq(bronzeNflfastrSnapCounts.season, season),
            position ? eq(bronzeNflfastrSnapCounts.position, position) : undefined
          )
        )
        .orderBy(bronzeNflfastrSnapCounts.week);
      
      if (snapData.length === 0) {
        return { avgPct: 0, trend: 'stable' };
      }
      
      // Calculate average
      const totalPct = snapData.reduce((sum, snap) => sum + (snap.offensePct || 0), 0);
      const avgPct = (totalPct / snapData.length) * 100;
      
      // Determine trend (compare last 2 weeks to previous 2)
      if (snapData.length >= 4) {
        const recent = snapData.slice(-2).reduce((sum, s) => sum + (s.offensePct || 0), 0) / 2;
        const previous = snapData.slice(-4, -2).reduce((sum, s) => sum + (s.offensePct || 0), 0) / 2;
        
        if (recent > previous * 1.1) {
          return { avgPct, trend: 'rising' };
        } else if (recent < previous * 0.9) {
          return { avgPct, trend: 'falling' };
        }
      }
      
      return { avgPct, trend: 'stable' };
      
    } catch (error) {
      console.error(`❌ Error calculating avg snap % for ${playerName}:`, error);
      return { avgPct: 0, trend: 'stable' };
    }
  }
}

export const snapCountService = new SnapCountService();
