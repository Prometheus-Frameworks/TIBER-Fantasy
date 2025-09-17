/**
 * Players Dimension Processor
 * 
 * Handles normalization of player data from all external sources into the canonical
 * Player Identity Map. Manages cross-platform identity resolution and data merging.
 */

import { db } from '../db';
import { 
  playerIdentityMap,
  type IngestPayload,
  type PlayerIdentityMap
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { PlayerIdentityService } from '../services/PlayerIdentityService';

export interface PlayerNormalizationResult {
  success: number;
  errors: number;
  skipped: number;
  playersCreated: number;
  playersUpdated: number;
  errorDetails: Array<{
    playloadId: number;
    error: string;
    playerData?: any;
  }>;
}

export interface NormalizedPlayerData {
  canonicalId?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  position: string;
  nflTeam?: string;
  jerseyNumber?: number;
  birthDate?: Date;
  college?: string;
  height?: string;
  weight?: number;
  externalIds: {
    sleeper?: string;
    espn?: string;
    yahoo?: string;
    rotowire?: string;
    fantasypros?: string;
    mysportsfeeds?: string;
    nfl_data_py?: string;
  };
  confidence: number;
  metadata: {
    source: string;
    lastUpdated: Date;
    isActive?: boolean;
  };
}

export class PlayersDimProcessor {
  private identityService: PlayerIdentityService;

  constructor(identityService: PlayerIdentityService) {
    this.identityService = identityService;
  }

  /**
   * Process Bronze payloads containing player data
   */
  async process(
    payloads: IngestPayload[], 
    options: { force?: boolean; validateOnly?: boolean } = {}
  ): Promise<any> {
    const startTime = Date.now();
    
    const result: PlayerNormalizationResult = {
      success: 0,
      errors: 0,
      skipped: 0,
      playersCreated: 0,
      playersUpdated: 0,
      errorDetails: []
    };

    try {
      console.log(`🔄 [PlayersDimProcessor] Processing ${payloads.length} player data payloads`);

      for (const payload of payloads) {
        try {
          const normalizedPlayers = await this.normalizePayloadData(payload);
          
          if (options.validateOnly) {
            result.success++;
            continue;
          }

          for (const playerData of normalizedPlayers) {
            try {
              const playerResult = await this.upsertPlayer(playerData, options.force);
              
              if (playerResult.created) {
                result.playersCreated++;
              } else if (playerResult.updated) {
                result.playersUpdated++;
              } else {
                result.skipped++;
              }
              
              result.success++;
              
            } catch (error) {
              result.errors++;
              result.errorDetails.push({
                playloadId: payload.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                playerData
              });
            }
          }
          
        } catch (error) {
          result.errors++;
          result.errorDetails.push({
            playloadId: payload.id,
            error: error instanceof Error ? error.message : 'Failed to normalize payload',
          });
        }
      }

      const duration = Date.now() - startTime;
      
      console.log(`✅ [PlayersDimProcessor] Completed in ${duration}ms`);
      console.log(`   📊 Created: ${result.playersCreated} | Updated: ${result.playersUpdated} | Errors: ${result.errors}`);

      return {
        success: result.success,
        errors: result.errors,
        skipped: result.skipped,
        tableResults: {
          playersCreated: result.playersCreated,
          playersUpdated: result.playersUpdated,
          teamsCreated: 0,
          teamsUpdated: 0,
          marketSignalsCreated: 0,
          injuriesCreated: 0,
          depthChartsCreated: 0
        },
        errorDetails: result.errorDetails.map(e => ({
          payloadId: e.playloadId,
          error: e.error
        }))
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [PlayersDimProcessor] Critical error:`, error);
      throw new Error(`Player processing failed: ${errorMessage}`);
    }
  }

  /**
   * Normalize raw payload data into standardized player format
   */
  private async normalizePayloadData(payload: IngestPayload): Promise<NormalizedPlayerData[]> {
    const source = payload.source;
    const rawData = payload.payload;

    switch (source) {
      case 'sleeper':
        return this.normalizeSleeperData(rawData, payload);
      case 'espn':
        return this.normalizeEspnData(rawData, payload);
      case 'yahoo':
        return this.normalizeYahooData(rawData, payload);
      case 'fantasypros':
        return this.normalizeFantasyProsData(rawData, payload);
      case 'mysportsfeeds':
        return this.normalizeMSFData(rawData, payload);
      case 'nfl_data_py':
        return this.normalizeNFLDataPyData(rawData, payload);
      default:
        console.warn(`[PlayersDimProcessor] Unknown source: ${source}`);
        return [];
    }
  }

  /**
   * Normalize Sleeper API player data
   */
  private normalizeSleeperData(rawData: any, payload: IngestPayload): NormalizedPlayerData[] {
    const players: NormalizedPlayerData[] = [];

    try {
      // Sleeper returns either array of players or object with player IDs as keys
      const playerData = Array.isArray(rawData) ? rawData : Object.values(rawData);

      for (const player of playerData) {
        if (!player || typeof player !== 'object') continue;

        const normalized: NormalizedPlayerData = {
          fullName: this.constructFullName(player.first_name, player.last_name),
          firstName: player.first_name?.trim(),
          lastName: player.last_name?.trim(),
          position: player.position?.toUpperCase() || 'UNKNOWN',
          nflTeam: player.team?.toUpperCase(),
          jerseyNumber: player.number,
          birthDate: player.birth_date ? new Date(player.birth_date) : undefined,
          college: player.college,
          height: player.height,
          weight: player.weight,
          externalIds: {
            sleeper: player.player_id
          },
          confidence: 0.9, // High confidence for Sleeper data
          metadata: {
            source: 'sleeper',
            lastUpdated: new Date(),
            isActive: player.active === true
          }
        };

        players.push(normalized);
      }

      console.log(`📊 [PlayersDimProcessor] Normalized ${players.length} Sleeper players`);
      return players;

    } catch (error) {
      console.error(`❌ [PlayersDimProcessor] Error normalizing Sleeper data:`, error);
      return [];
    }
  }

  /**
   * Normalize ESPN API player data
   */
  private normalizeEspnData(rawData: any, payload: IngestPayload): NormalizedPlayerData[] {
    const players: NormalizedPlayerData[] = [];

    try {
      const playerData = rawData.athletes || rawData.players || [];

      for (const player of playerData) {
        if (!player) continue;

        const normalized: NormalizedPlayerData = {
          fullName: player.fullName || this.constructFullName(player.firstName, player.lastName),
          firstName: player.firstName?.trim(),
          lastName: player.lastName?.trim(),
          position: player.position?.abbreviation?.toUpperCase() || 'UNKNOWN',
          nflTeam: player.team?.abbreviation?.toUpperCase(),
          jerseyNumber: player.jersey,
          birthDate: player.birthDate ? new Date(player.birthDate) : undefined,
          college: player.college?.name,
          height: player.height,
          weight: player.weight,
          externalIds: {
            espn: player.id?.toString()
          },
          confidence: 0.85, // Good confidence for ESPN data
          metadata: {
            source: 'espn',
            lastUpdated: new Date(),
            isActive: player.active !== false
          }
        };

        players.push(normalized);
      }

      console.log(`📊 [PlayersDimProcessor] Normalized ${players.length} ESPN players`);
      return players;

    } catch (error) {
      console.error(`❌ [PlayersDimProcessor] Error normalizing ESPN data:`, error);
      return [];
    }
  }

  /**
   * Normalize Yahoo API player data
   */
  private normalizeYahooData(rawData: any, payload: IngestPayload): NormalizedPlayerData[] {
    const players: NormalizedPlayerData[] = [];

    try {
      const playerData = rawData.fantasy_content?.players?.player || [];

      for (const playerWrapper of playerData) {
        const player = playerWrapper.player || playerWrapper;
        if (!player) continue;

        const normalized: NormalizedPlayerData = {
          fullName: player.name?.full || this.constructFullName(player.name?.first, player.name?.last),
          firstName: player.name?.first?.trim(),
          lastName: player.name?.last?.trim(),
          position: player.position_type?.toUpperCase() || 'UNKNOWN',
          nflTeam: player.editorial_team_abbr?.toUpperCase(),
          jerseyNumber: player.uniform_number,
          externalIds: {
            yahoo: player.player_id?.toString()
          },
          confidence: 0.8, // Moderate confidence for Yahoo data
          metadata: {
            source: 'yahoo',
            lastUpdated: new Date(),
            isActive: true
          }
        };

        players.push(normalized);
      }

      console.log(`📊 [PlayersDimProcessor] Normalized ${players.length} Yahoo players`);
      return players;

    } catch (error) {
      console.error(`❌ [PlayersDimProcessor] Error normalizing Yahoo data:`, error);
      return [];
    }
  }

  /**
   * Normalize FantasyPros data
   */
  private normalizeFantasyProsData(rawData: any, payload: IngestPayload): NormalizedPlayerData[] {
    const players: NormalizedPlayerData[] = [];

    try {
      const playerData = rawData.players || rawData.data || [];

      for (const player of playerData) {
        if (!player) continue;

        const normalized: NormalizedPlayerData = {
          fullName: player.player_name || this.constructFullName(player.first_name, player.last_name),
          firstName: player.first_name?.trim(),
          lastName: player.last_name?.trim(),
          position: player.pos?.toUpperCase() || player.position?.toUpperCase() || 'UNKNOWN',
          nflTeam: player.team?.toUpperCase(),
          externalIds: {
            fantasypros: player.player_id?.toString() || player.id?.toString()
          },
          confidence: 0.75, // Moderate confidence for FantasyPros data
          metadata: {
            source: 'fantasypros',
            lastUpdated: new Date(),
            isActive: true
          }
        };

        players.push(normalized);
      }

      console.log(`📊 [PlayersDimProcessor] Normalized ${players.length} FantasyPros players`);
      return players;

    } catch (error) {
      console.error(`❌ [PlayersDimProcessor] Error normalizing FantasyPros data:`, error);
      return [];
    }
  }

  /**
   * Normalize MySportsFeeds data
   */
  private normalizeMSFData(rawData: any, payload: IngestPayload): NormalizedPlayerData[] {
    const players: NormalizedPlayerData[] = [];

    try {
      const playerData = rawData.players || [];

      for (const playerWrapper of playerData) {
        const player = playerWrapper.player || playerWrapper;
        if (!player) continue;

        const normalized: NormalizedPlayerData = {
          fullName: `${player.firstName} ${player.lastName}`.trim(),
          firstName: player.firstName?.trim(),
          lastName: player.lastName?.trim(),
          position: player.primaryPosition?.toUpperCase() || 'UNKNOWN',
          nflTeam: player.currentTeam?.abbreviation?.toUpperCase(),
          jerseyNumber: player.jerseyNumber,
          birthDate: player.birthDate ? new Date(player.birthDate) : undefined,
          height: player.height,
          weight: player.weight,
          externalIds: {
            mysportsfeeds: player.id?.toString()
          },
          confidence: 0.8, // Good confidence for MSF data
          metadata: {
            source: 'mysportsfeeds',
            lastUpdated: new Date(),
            isActive: player.isActive !== false
          }
        };

        players.push(normalized);
      }

      console.log(`📊 [PlayersDimProcessor] Normalized ${players.length} MySportsFeeds players`);
      return players;

    } catch (error) {
      console.error(`❌ [PlayersDimProcessor] Error normalizing MySportsFeeds data:`, error);
      return [];
    }
  }

  /**
   * Normalize NFL Data Py data
   */
  private normalizeNFLDataPyData(rawData: any, payload: IngestPayload): NormalizedPlayerData[] {
    const players: NormalizedPlayerData[] = [];

    try {
      const playerData = Array.isArray(rawData) ? rawData : [rawData];

      for (const player of playerData) {
        if (!player) continue;

        const normalized: NormalizedPlayerData = {
          fullName: player.display_name || this.constructFullName(player.first_name, player.last_name),
          firstName: player.first_name?.trim(),
          lastName: player.last_name?.trim(),
          position: player.position?.toUpperCase() || 'UNKNOWN',
          nflTeam: player.recent_team?.toUpperCase() || player.team?.toUpperCase(),
          jerseyNumber: player.jersey_number,
          birthDate: player.birth_date ? new Date(player.birth_date) : undefined,
          college: player.college,
          height: player.height,
          weight: player.weight,
          externalIds: {
            nfl_data_py: player.player_id || player.gsis_id
          },
          confidence: 0.95, // Very high confidence for official NFL data
          metadata: {
            source: 'nfl_data_py',
            lastUpdated: new Date(),
            isActive: player.status === 'ACT'
          }
        };

        players.push(normalized);
      }

      console.log(`📊 [PlayersDimProcessor] Normalized ${players.length} NFL Data Py players`);
      return players;

    } catch (error) {
      console.error(`❌ [PlayersDimProcessor] Error normalizing NFL Data Py data:`, error);
      return [];
    }
  }

  /**
   * Upsert normalized player data into the identity map
   */
  private async upsertPlayer(
    playerData: NormalizedPlayerData, 
    force: boolean = false
  ): Promise<{ created: boolean; updated: boolean; canonicalId: string }> {
    try {
      // Try to find existing player by external IDs
      let existingPlayer: PlayerIdentityMap | null = null;
      let canonicalId = playerData.canonicalId;

      // Check each external ID to find existing player
      for (const [platform, externalId] of Object.entries(playerData.externalIds)) {
        if (externalId) {
          canonicalId = await this.identityService.getCanonicalId(
            externalId, 
            platform as any
          );
          if (canonicalId) {
            existingPlayer = await this.identityService.getByCanonicalId(canonicalId);
            break;
          }
        }
      }

      if (!existingPlayer) {
        // Create new player
        canonicalId = canonicalId || this.generateCanonicalId(playerData);
        
        await db.insert(playerIdentityMap).values({
          canonicalId,
          fullName: playerData.fullName,
          firstName: playerData.firstName,
          lastName: playerData.lastName,
          position: playerData.position,
          nflTeam: playerData.nflTeam,
          jerseyNumber: playerData.jerseyNumber,
          birthDate: playerData.birthDate,
          college: playerData.college,
          height: playerData.height,
          weight: playerData.weight,
          sleeperId: playerData.externalIds.sleeper,
          espnId: playerData.externalIds.espn,
          yahooId: playerData.externalIds.yahoo,
          rotowireId: playerData.externalIds.rotowire,
          fantasyprosId: playerData.externalIds.fantasypros,
          mysportsfeedsId: playerData.externalIds.mysportsfeeds,
          nflDataPyId: playerData.externalIds.nfl_data_py,
          confidence: playerData.confidence,
          isActive: playerData.metadata.isActive,
          lastVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        return { created: true, updated: false, canonicalId };
      } else {
        // Update existing player if we have newer or higher confidence data
        const shouldUpdate = force || 
          playerData.confidence > (existingPlayer.confidence || 0) ||
          !existingPlayer.lastVerified ||
          (Date.now() - existingPlayer.lastVerified.getTime()) > (24 * 60 * 60 * 1000); // 24 hours

        if (shouldUpdate) {
          await db.update(playerIdentityMap)
            .set({
              fullName: playerData.fullName || existingPlayer.fullName,
              firstName: playerData.firstName || existingPlayer.firstName,
              lastName: playerData.lastName || existingPlayer.lastName,
              position: playerData.position || existingPlayer.position,
              nflTeam: playerData.nflTeam || existingPlayer.nflTeam,
              jerseyNumber: playerData.jerseyNumber || existingPlayer.jerseyNumber,
              birthDate: playerData.birthDate || existingPlayer.birthDate,
              college: playerData.college || existingPlayer.college,
              height: playerData.height || existingPlayer.height,
              weight: playerData.weight || existingPlayer.weight,
              sleeperId: playerData.externalIds.sleeper || existingPlayer.sleeperId,
              espnId: playerData.externalIds.espn || existingPlayer.espnId,
              yahooId: playerData.externalIds.yahoo || existingPlayer.yahooId,
              rotowireId: playerData.externalIds.rotowire || existingPlayer.rotowireId,
              fantasyprosId: playerData.externalIds.fantasypros || existingPlayer.fantasyprosId,
              mysportsfeedsId: playerData.externalIds.mysportsfeeds || existingPlayer.mysportsfeedsId,
              nflDataPyId: playerData.externalIds.nfl_data_py || existingPlayer.nflDataPyId,
              confidence: Math.max(playerData.confidence, existingPlayer.confidence || 0),
              isActive: playerData.metadata.isActive ?? existingPlayer.isActive,
              lastVerified: new Date(),
              updatedAt: new Date()
            })
            .where(eq(playerIdentityMap.canonicalId, canonicalId!));

          return { created: false, updated: true, canonicalId: canonicalId! };
        }

        return { created: false, updated: false, canonicalId: canonicalId! };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [PlayersDimProcessor] Error upserting player:`, error);
      throw new Error(`Player upsert failed: ${errorMessage}`);
    }
  }

  /**
   * Helper methods
   */
  private constructFullName(firstName?: string, lastName?: string): string {
    const first = firstName?.trim() || '';
    const last = lastName?.trim() || '';
    return `${first} ${last}`.trim() || 'Unknown Player';
  }

  private generateCanonicalId(playerData: NormalizedPlayerData): string {
    // Generate a canonical ID based on normalized name and position
    const normalizedName = playerData.fullName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
    
    const position = playerData.position.toLowerCase();
    const timestamp = Date.now().toString(36);
    
    return `${normalizedName}_${position}_${timestamp}`;
  }
}