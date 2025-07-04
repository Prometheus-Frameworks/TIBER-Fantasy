/**
 * Multi-Platform Fantasy Sports Data Synchronization System
 * Supports ESPN, Yahoo, NFL.com, Sleeper, and other major platforms
 */

import { ESPNSyncAdapter } from './adapters/espnAdapter';
import { YahooSyncAdapter } from './adapters/yahooAdapter';
import { SleeperSyncAdapter } from './adapters/sleeperAdapter';
import { NFLSyncAdapter } from './adapters/nflAdapter';
import { storage } from '../storage';

export interface PlatformCredentials {
  platform: 'espn' | 'yahoo' | 'nfl' | 'sleeper';
  accessToken?: string;
  refreshToken?: string;
  leagueId: string;
  teamId?: string;
  swid?: string; // ESPN specific
  espnS2?: string; // ESPN specific
  consumerKey?: string; // Yahoo specific
  consumerSecret?: string; // Yahoo specific
}

export interface SyncData {
  userProfile: UserProfile;
  leagues: LeagueData[];
  teams: TeamData[];
  rosters: RosterData[];
  transactions: TransactionData[];
  scores: ScoreData[];
  settings: PlatformSettings;
  lastSyncTimestamp: Date;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  memberSince?: Date;
  totalLeagues: number;
  favoriteTeam?: string;
}

export interface LeagueData {
  leagueId: string;
  name: string;
  season: number;
  size: number;
  scoringType: 'standard' | 'ppr' | 'half-ppr' | 'superflex';
  rosterPositions: string[];
  tradeDeadline?: Date;
  playoffStart?: Date;
  isActive: boolean;
  draftStatus: 'pre-draft' | 'drafting' | 'post-draft';
  settings: LeagueSettings;
}

export interface LeagueSettings {
  scoringSettings: Record<string, number>;
  rosterSettings: {
    starters: Record<string, number>;
    bench: number;
    ir: number;
    taxi?: number;
  };
  waiverSettings: {
    type: 'rolling' | 'faab' | 'reverse-standings';
    budget?: number;
    clearTime: string;
  };
  tradeSettings: {
    deadline: Date;
    reviewPeriod: number;
    vetoPeriod: number;
  };
}

export interface TeamData {
  teamId: string;
  leagueId: string;
  ownerId: string;
  teamName: string;
  logoUrl?: string;
  record: {
    wins: number;
    losses: number;
    ties: number;
  };
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
  playoffSeed?: number;
  draftPosition: number;
}

export interface RosterData {
  teamId: string;
  leagueId: string;
  starters: PlayerSlot[];
  bench: PlayerSlot[];
  ir: PlayerSlot[];
  taxi?: PlayerSlot[];
  lastUpdated: Date;
}

export interface PlayerSlot {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  slotPosition: string;
  isLocked: boolean;
  projectedPoints?: number;
  actualPoints?: number;
}

export interface TransactionData {
  transactionId: string;
  leagueId: string;
  type: 'trade' | 'waiver' | 'free-agent' | 'drop';
  status: 'pending' | 'executed' | 'vetoed' | 'failed';
  timestamp: Date;
  involvedTeams: string[];
  players: {
    added: PlayerSlot[];
    dropped: PlayerSlot[];
  };
  faabBid?: number;
  waiverPriority?: number;
}

export interface ScoreData {
  teamId: string;
  leagueId: string;
  week: number;
  season: number;
  totalPoints: number;
  projectedPoints: number;
  playerScores: {
    playerId: string;
    points: number;
    projected: number;
    started: boolean;
  }[];
  matchupOpponent?: string;
  result?: 'win' | 'loss' | 'tie';
}

export interface PlatformSettings {
  notifications: {
    trades: boolean;
    waivers: boolean;
    scores: boolean;
    news: boolean;
  };
  privacy: {
    shareRoster: boolean;
    shareRecord: boolean;
    allowMessages: boolean;
  };
  preferences: {
    timezone: string;
    language: string;
    theme: 'light' | 'dark';
  };
}

export class PlatformSyncManager {
  private adapters: Map<string, any> = new Map();

  constructor() {
    this.adapters.set('espn', new ESPNSyncAdapter());
    this.adapters.set('yahoo', new YahooSyncAdapter());
    this.adapters.set('sleeper', new SleeperSyncAdapter());
    this.adapters.set('nfl', new NFLSyncAdapter());
  }

  /**
   * Authenticate user with their fantasy platform
   */
  async authenticateUser(credentials: PlatformCredentials): Promise<boolean> {
    const adapter = this.adapters.get(credentials.platform);
    if (!adapter) {
      throw new Error(`Platform ${credentials.platform} not supported`);
    }

    try {
      const isValid = await adapter.authenticate(credentials);
      
      if (isValid) {
        // Store encrypted credentials
        await this.storeCredentials(credentials);
        console.log(`✅ Successfully authenticated with ${credentials.platform}`);
      }
      
      return isValid;
    } catch (error) {
      console.error(`❌ Authentication failed for ${credentials.platform}:`, error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Perform full data synchronization for a user
   */
  async syncUserData(userId: string, credentials: PlatformCredentials): Promise<SyncData> {
    const adapter = this.adapters.get(credentials.platform);
    if (!adapter) {
      throw new Error(`Platform ${credentials.platform} not supported`);
    }

    try {
      console.log(`🔄 Starting full sync for user ${userId} on ${credentials.platform}...`);
      
      // Step 1: Authenticate
      await this.authenticateUser(credentials);
      
      // Step 2: Fetch all data
      const syncData: SyncData = {
        userProfile: await adapter.fetchUserProfile(credentials),
        leagues: await adapter.fetchLeagues(credentials),
        teams: await adapter.fetchTeams(credentials),
        rosters: await adapter.fetchRosters(credentials),
        transactions: await adapter.fetchTransactions(credentials),
        scores: await adapter.fetchScores(credentials),
        settings: await adapter.fetchSettings(credentials),
        lastSyncTimestamp: new Date()
      };

      // Step 3: Store in our database
      await this.storeSyncData(userId, syncData);
      
      // Step 4: Update team sync status
      await storage.updateTeamSync(parseInt(credentials.teamId || '1'), {
        syncPlatform: credentials.platform,
        syncLeagueId: credentials.leagueId,
        syncTeamId: credentials.teamId,
        lastSyncDate: new Date(),
        syncEnabled: true
      });

      console.log(`✅ Full sync completed for user ${userId}`);
      return syncData;
      
    } catch (error) {
      console.error(`❌ Sync failed for ${credentials.platform}:`, error);
      throw new Error(`Sync failed: ${error.message}`);
    }
  }

  /**
   * Perform incremental sync (only changes since last sync)
   */
  async incrementalSync(userId: string, credentials: PlatformCredentials): Promise<Partial<SyncData>> {
    const adapter = this.adapters.get(credentials.platform);
    if (!adapter) {
      throw new Error(`Platform ${credentials.platform} not supported`);
    }

    try {
      // Get last sync timestamp
      const lastSync = await this.getLastSyncTimestamp(userId, credentials.platform);
      
      if (!lastSync) {
        // No previous sync, perform full sync
        return await this.syncUserData(userId, credentials);
      }

      console.log(`🔄 Starting incremental sync for user ${userId} since ${lastSync}...`);
      
      // Fetch only changed data
      const changes = await adapter.fetchChangesSince(credentials, lastSync);
      
      if (Object.keys(changes).length === 0) {
        console.log(`✅ No changes detected for user ${userId}`);
        return {};
      }

      // Store changes
      await this.storeIncrementalChanges(userId, changes);
      
      console.log(`✅ Incremental sync completed for user ${userId}`);
      return changes;
      
    } catch (error) {
      console.error(`❌ Incremental sync failed:`, error);
      throw error;
    }
  }

  /**
   * Real-time sync using webhooks (where supported)
   */
  async setupRealTimeSync(credentials: PlatformCredentials, webhookUrl: string): Promise<void> {
    const adapter = this.adapters.get(credentials.platform);
    if (!adapter || !adapter.supportsWebhooks) {
      throw new Error(`Real-time sync not supported for ${credentials.platform}`);
    }

    try {
      await adapter.setupWebhook(credentials, webhookUrl);
      console.log(`✅ Real-time sync enabled for ${credentials.platform}`);
    } catch (error) {
      console.error(`❌ Failed to setup real-time sync:`, error);
      throw error;
    }
  }

  /**
   * Handle incoming webhook data
   */
  async handleWebhookData(platform: string, webhookData: any): Promise<void> {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`Platform ${platform} not supported`);
    }

    try {
      const processedData = await adapter.processWebhookData(webhookData);
      await this.storeWebhookChanges(processedData);
      console.log(`✅ Webhook data processed for ${platform}`);
    } catch (error) {
      console.error(`❌ Webhook processing failed:`, error);
      throw error;
    }
  }

  /**
   * Get sync status for all platforms
   */
  async getSyncStatus(userId: string): Promise<Record<string, any>> {
    const status: Record<string, any> = {};
    
    for (const [platform, adapter] of this.adapters) {
      try {
        const lastSync = await this.getLastSyncTimestamp(userId, platform);
        const credentials = await this.getStoredCredentials(userId, platform);
        
        status[platform] = {
          isConfigured: !!credentials,
          lastSync,
          isOnline: await adapter.checkConnection(credentials),
          supportsRealTime: adapter.supportsWebhooks || false,
          dataTypes: adapter.supportedDataTypes || []
        };
      } catch (error) {
        status[platform] = {
          isConfigured: false,
          error: error.message
        };
      }
    }
    
    return status;
  }

  /**
   * Force refresh all data for a platform
   */
  async forceRefresh(userId: string, platform: string): Promise<SyncData> {
    const credentials = await this.getStoredCredentials(userId, platform);
    if (!credentials) {
      throw new Error(`No credentials found for ${platform}`);
    }

    // Clear last sync timestamp to force full refresh
    await this.clearSyncTimestamp(userId, platform);
    
    return await this.syncUserData(userId, credentials);
  }

  // Private helper methods
  private async storeCredentials(credentials: PlatformCredentials): Promise<void> {
    // Store encrypted credentials in database
    // Implementation depends on your encryption setup
  }

  private async getStoredCredentials(userId: string, platform: string): Promise<PlatformCredentials | null> {
    // Retrieve and decrypt stored credentials
    // Implementation depends on your encryption setup
    return null;
  }

  private async storeSyncData(userId: string, data: SyncData): Promise<void> {
    // Store all sync data in database with proper relationships
    // Implementation depends on your database schema
  }

  private async storeIncrementalChanges(userId: string, changes: Partial<SyncData>): Promise<void> {
    // Store only changed data
    // Implementation depends on your database schema
  }

  private async storeWebhookChanges(data: any): Promise<void> {
    // Store real-time webhook changes
    // Implementation depends on your database schema
  }

  private async getLastSyncTimestamp(userId: string, platform: string): Promise<Date | null> {
    // Get last successful sync timestamp
    return null;
  }

  private async clearSyncTimestamp(userId: string, platform: string): Promise<void> {
    // Clear sync timestamp to force full refresh
  }
}

export const platformSyncManager = new PlatformSyncManager();