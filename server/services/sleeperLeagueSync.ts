/**
 * Sleeper League Sync Service
 * Syncs Sleeper league data (rosters, trades, waivers) into league_context for RAG
 */

import { db } from '../infra/db';
import { leagueContext, leagues } from '@shared/schema';
import { SleeperSyncAdapter } from '../platformSync/adapters/sleeperAdapter';
import type { PlatformCredentials, RosterData, TransactionData, PlayerSlot } from '../platformSync';
import { generateEmbedding } from './geminiEmbeddings';
import { eq } from 'drizzle-orm';

interface SleeperSyncResult {
  success: boolean;
  contextsCreated: number;
  errors: string[];
  league?: {
    name: string;
    season: number;
    teams: number;
    scoring: string;
  };
}

/**
 * Sync Sleeper league data and create league_context entries
 */
export async function syncSleeperLeague(
  leagueId: string,
  sleeperLeagueId: string,
  userId: string = 'default_user'
): Promise<SleeperSyncResult> {
  const adapter = new SleeperSyncAdapter();
  const errors: string[] = [];
  let contextsCreated = 0;

  try {
    console.log(`🔄 [Sleeper Sync] Starting sync for league ${leagueId} (Sleeper ID: ${sleeperLeagueId})`);

    // 1) Verify Sleeper league exists and fetch data
    const credentials: PlatformCredentials = { 
      platform: 'sleeper',
      leagueId: sleeperLeagueId, 
      teamId: userId 
    };
    
    const isValid = await adapter.authenticate(credentials);
    if (!isValid) {
      throw new Error(`Sleeper league ${sleeperLeagueId} not found or inaccessible`);
    }

    // 2) Fetch league data
    const [leagueData, rosters, transactions] = await Promise.all([
      adapter.fetchLeagues(credentials),
      adapter.fetchRosters(credentials),
      adapter.fetchTransactions(credentials)
    ]);

    if (!leagueData || leagueData.length === 0) {
      throw new Error('Failed to fetch Sleeper league data');
    }

    const league = leagueData[0];
    console.log(`✅ [Sleeper Sync] Fetched league: ${league.name} (${league.season})`);

    // 3) Update our league with Sleeper settings
    const rosterSpots: Record<string, number> = {};
    league.rosterPositions.forEach((pos, index) => {
      rosterSpots[pos] = (rosterSpots[pos] || 0) + 1;
    });

    await db.update(leagues)
      .set({
        leagueIdExternal: sleeperLeagueId,
        leagueName: league.name,
        settings: {
          scoring: league.scoringType,
          teams: league.size,
          rosterSpots,
        },
        updatedAt: new Date()
      })
      .where(eq(leagues.id, leagueId));

    console.log(`✅ [Sleeper Sync] Updated league settings`);

    // 4) Find user's roster (try to match by teamId)
    const userRoster = rosters.length > 0 ? rosters[0] : null; // Default to first roster
    
    if (userRoster) {
      // Create context entries for each player on roster
      const rosterPlayers: PlayerSlot[] = [...userRoster.starters, ...userRoster.bench];
      
      for (const player of rosterPlayers) {
        try {
          const contextText = `User has ${player.playerName} (${player.position}, ${player.team}) on their roster`;
          const embedding = await generateEmbedding(contextText);

          await db.insert(leagueContext).values({
            leagueId,
            content: contextText,
            embedding: JSON.stringify(embedding) as any,
            metadata: {
              type: 'roster',
              players: [player.playerId],
              tags: [player.position, player.team],
              synced_at: new Date().toISOString()
            }
          });

          contextsCreated++;
        } catch (err) {
          errors.push(`Failed to create context for player ${player.playerName}: ${err}`);
        }
      }

      console.log(`✅ [Sleeper Sync] Created ${contextsCreated} roster contexts`);
    } else {
      console.warn(`⚠️  [Sleeper Sync] Could not find user's roster in league`);
    }

    // 5) Create context entries for recent transactions
    const recentTransactions = transactions
      .filter(t => t.involvedTeams?.includes(userId))
      .slice(0, 20); // Limit to 20 most recent

    for (const transaction of recentTransactions) {
      try {
        let contextText = '';
        const transactionType = transaction.type;
        const timestamp = new Date(transaction.timestamp);
        const timeStr = timestamp.toLocaleDateString();

        if (transactionType === 'trade') {
          const added = transaction.players.added.map(p => p.playerName).join(', ') || 'unknown';
          const dropped = transaction.players.dropped.map(p => p.playerName).join(', ') || 'unknown';
          contextText = `User traded ${dropped} for ${added} on ${timeStr}`;
        } else if (transactionType === 'waiver') {
          const added = transaction.players.added[0]?.playerName || 'unknown';
          contextText = `User added ${added} from waivers on ${timeStr}`;
        } else if (transactionType === 'free-agent') {
          const added = transaction.players.added[0]?.playerName || 'unknown';
          contextText = `User added ${added} as a free agent on ${timeStr}`;
        } else if (transactionType === 'drop') {
          const dropped = transaction.players.dropped[0]?.playerName || 'unknown';
          contextText = `User dropped ${dropped} on ${timeStr}`;
        }

        if (contextText) {
          const embedding = await generateEmbedding(contextText);

          await db.insert(leagueContext).values({
            leagueId,
            content: contextText,
            embedding: JSON.stringify(embedding) as any,
            metadata: {
              type: transactionType,
              players: [
                ...transaction.players.added.map(p => p.playerId),
                ...transaction.players.dropped.map(p => p.playerId)
              ],
              tags: [transactionType],
              synced_at: new Date().toISOString()
            }
          });

          contextsCreated++;
        }
      } catch (err) {
        errors.push(`Failed to create context for transaction ${transaction.transactionId}: ${err}`);
      }
    }

    console.log(`✅ [Sleeper Sync] Created ${recentTransactions.length} transaction contexts`);

    return {
      success: true,
      contextsCreated,
      errors,
      league: {
        name: league.name,
        season: league.season,
        teams: league.size,
        scoring: league.scoringType
      }
    };
  } catch (error) {
    console.error(`❌ [Sleeper Sync] Sync failed:`, error);
    return {
      success: false,
      contextsCreated,
      errors: [`Sync failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Validate Sleeper league ID exists
 */
export async function validateSleeperLeagueId(sleeperLeagueId: string): Promise<{
  valid: boolean;
  league?: {
    name: string;
    season: number;
    teams: number;
    scoring: string;
  };
  error?: string;
}> {
  try {
    const adapter = new SleeperSyncAdapter();
    const credentials: PlatformCredentials = { 
      platform: 'sleeper',
      leagueId: sleeperLeagueId 
    };

    const isValid = await adapter.authenticate(credentials);
    if (!isValid) {
      return { valid: false, error: 'League not found' };
    }

    const leagueData = await adapter.fetchLeagues(credentials);
    if (!leagueData || leagueData.length === 0) {
      return { valid: false, error: 'Failed to fetch league data' };
    }

    const league = leagueData[0];
    return {
      valid: true,
      league: {
        name: league.name,
        season: league.season,
        teams: league.size,
        scoring: league.scoringType
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
