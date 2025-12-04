#!/usr/bin/env tsx
/**
 * Master Downstream Push Orchestration
 * 
 * Pulls data from Datadive snapshot, enriches by position,
 * and pushes to external leaderboard endpoints.
 * 
 * Runs every Tuesday after NFLfastR weekly data drop.
 * 
 * Usage:
 *   tsx server/downstream/pushAllBoxes.ts
 */

import { db } from '../infra/db';
import { datadiveSnapshotMeta, datadiveSnapshotPlayerWeek } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { enrichQB } from '../enrichment/qbBox';
import { enrichWR } from '../enrichment/wrBox';
import { enrichRB } from '../enrichment/rbBox';
import { enrichIDP } from '../enrichment/idpBox';
import { enrichFantasy } from '../enrichment/fantasyBox';

const API_BASE = process.env.INTERNAL_API_URL || process.env.TIBER_API_URL || '';

interface PushResult {
  endpoint: string;
  count: number;
  success: boolean;
  error?: string;
}

/**
 * Push enriched data to external API endpoint
 */
async function pushToBox(endpoint: string, data: any[]): Promise<PushResult> {
  if (!API_BASE) {
    console.log(`[DRY RUN] Would push ${data.length} records to ${endpoint}`);
    return { endpoint, count: data.length, success: true };
  }
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Tiber-Source': 'pushAllBoxes',
      },
      body: JSON.stringify({ 
        data, 
        ingested_at: new Date().toISOString(),
        count: data.length,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return { endpoint, count: data.length, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ERROR] Failed to push to ${endpoint}: ${message}`);
    return { endpoint, count: data.length, success: false, error: message };
  }
}

/**
 * Get current snapshot player data
 */
async function getSnapshotPlayers(): Promise<any[]> {
  // Get latest official snapshot
  const snapshotResult = await db
    .select()
    .from(datadiveSnapshotMeta)
    .where(eq(datadiveSnapshotMeta.isOfficial, true))
    .orderBy(desc(datadiveSnapshotMeta.snapshotAt))
    .limit(1);
  
  if (!snapshotResult[0]) {
    throw new Error('No official snapshot found');
  }
  
  const snapshot = snapshotResult[0];
  console.log(`📊 Using snapshot: Season ${snapshot.season} Week ${snapshot.week} (${snapshot.rowCount} rows)`);
  
  // Get all player rows from this snapshot
  const players = await db
    .select()
    .from(datadiveSnapshotPlayerWeek)
    .where(
      and(
        eq(datadiveSnapshotPlayerWeek.snapshotId, snapshot.id),
        eq(datadiveSnapshotPlayerWeek.week, snapshot.week!)
      )
    );
  
  return players;
}

/**
 * Main push orchestration
 */
export async function pushAllPositionBoxes(): Promise<void> {
  console.log('\n🚀 Starting downstream push...');
  console.log(`📡 API Base: ${API_BASE || '(DRY RUN - no API configured)'}`);
  
  const startTime = Date.now();
  
  try {
    const snapshot = await getSnapshotPlayers();
    console.log(`✅ Loaded ${snapshot.length} players from snapshot`);
    
    // Filter and enrich by position
    const qb = snapshot
      .filter(p => p.position === 'QB')
      .map(enrichQB)
      .map(enrichFantasy);
    
    const wr = snapshot
      .filter(p => ['WR', 'TE'].includes(p.position as string))
      .map(enrichWR)
      .map(enrichFantasy);
    
    const rb = snapshot
      .filter(p => p.position === 'RB')
      .map(enrichRB)
      .map(enrichFantasy);
    
    const idp = snapshot
      .filter(p => ['DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S'].includes(p.position as string))
      .map(enrichIDP);
    
    // All players get fantasy enrichment
    const allPlayers = snapshot.map(enrichFantasy);
    
    console.log(`\n📦 Enriched counts:`);
    console.log(`   QB: ${qb.length}`);
    console.log(`   WR/TE: ${wr.length}`);
    console.log(`   RB: ${rb.length}`);
    console.log(`   IDP: ${idp.length}`);
    console.log(`   All: ${allPlayers.length}`);
    
    // Push to all endpoints in parallel
    const results = await Promise.all([
      pushToBox('/v1/qb-dashboard', qb),
      pushToBox('/v1/wr-leaderboard', wr),
      pushToBox('/v1/rb-leaderboard', rb),
      pushToBox('/v1/idp-rankings', idp),
      pushToBox('/v1/fantasy-projections', allPlayers),
    ]);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const successCount = results.filter(r => r.success).length;
    
    console.log(`\n✅ Push complete in ${elapsed}s`);
    console.log(`   Success: ${successCount}/${results.length} endpoints`);
    
    results.forEach(r => {
      const status = r.success ? '✓' : '✗';
      console.log(`   ${status} ${r.endpoint}: ${r.count} records${r.error ? ` (${r.error})` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Push failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  pushAllPositionBoxes()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
