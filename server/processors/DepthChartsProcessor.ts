/**
 * Depth Charts Processor
 * 
 * Handles normalization of team depth chart data into the canonical depth charts table
 * with proper player identity resolution and positional hierarchy tracking.
 */

import { db } from '../db';
import { 
  depthCharts,
  type IngestPayload,
  dataQualityEnum
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { PlayerIdentityService } from '../services/PlayerIdentityService';

export interface DepthChartNormalizationResult {
  success: number;
  errors: number;
  skipped: number;
  depthChartsCreated: number;
  errorDetails: Array<{
    payloadId: number;
    error: string;
    depthData?: any;
  }>;
}

export interface NormalizedDepthChartEntry {
  canonicalPlayerId?: string;
  nflTeam: string;
  position: string;
  positionGroup: string;
  depthOrder: number;
  roleType: string;
  snapPercentage?: number;
  isStarter: boolean;
  season: number;
  week?: number;
  lastUpdated: Date;
  playerIdentifiers: {
    name?: string;
    position?: string;
    team?: string;
    externalId?: string;
    platform?: string;
  };
  metadata: {
    source: string;
    dataQuality: typeof dataQualityEnum.enumValues[number];
    confidence: number;
    extractedAt: Date;
  };
}

// Position group mappings
const POSITION_GROUPS = {
  'QB': 'QB',
  'RB': 'RB',
  'FB': 'RB',
  'WR': 'WR',
  'TE': 'TE',
  'LT': 'OL',
  'LG': 'OL',
  'C': 'OL',
  'RG': 'OL',
  'RT': 'OL',
  'DE': 'DL',
  'DT': 'DL',
  'NT': 'DL',
  'OLB': 'LB',
  'MLB': 'LB',
  'ILB': 'LB',
  'CB': 'DB',
  'FS': 'DB',
  'SS': 'DB',
  'S': 'DB',
  'K': 'ST',
  'P': 'ST',
  'LS': 'ST'
};

// Role type mappings
const ROLE_TYPES = {
  starter: 'starter',
  backup: 'backup',
  third_string: 'third_string',
  special_teams: 'special_teams',
  practice_squad: 'practice_squad',
  injured_reserve: 'injured_reserve'
};

export class DepthChartsProcessor {
  private identityService: PlayerIdentityService;

  constructor(identityService: PlayerIdentityService) {
    this.identityService = identityService;
  }

  /**
   * Process Bronze payloads containing depth chart data
   */
  async process(
    payloads: IngestPayload[], 
    options: { force?: boolean; validateOnly?: boolean } = {}
  ): Promise<any> {
    const startTime = Date.now();
    
    const result: DepthChartNormalizationResult = {
      success: 0,
      errors: 0,
      skipped: 0,
      depthChartsCreated: 0,
      errorDetails: []
    };

    try {
      console.log(`🔄 [DepthChartsProcessor] Processing ${payloads.length} depth chart payloads`);

      for (const payload of payloads) {
        try {
          const normalizedEntries = await this.normalizePayloadData(payload);
          
          if (options.validateOnly) {
            result.success++;
            continue;
          }

          for (const entryData of normalizedEntries) {
            try {
              // Resolve player identity
              const canonicalId = await this.resolvePlayerIdentity(entryData);
              
              if (!canonicalId) {
                console.warn(`⚠️ [DepthChartsProcessor] Could not resolve player identity for depth chart:`, 
                  entryData.playerIdentifiers);
                result.skipped++;
                continue;
              }

              entryData.canonicalPlayerId = canonicalId;

              const entryResult = await this.upsertDepthChartEntry(entryData, options.force);
              
              if (entryResult.created) {
                result.depthChartsCreated++;
              }
              
              result.success++;
              
            } catch (error) {
              result.errors++;
              result.errorDetails.push({
                payloadId: payload.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                depthData: entryData
              });
            }
          }
          
        } catch (error) {
          result.errors++;
          result.errorDetails.push({
            payloadId: payload.id,
            error: error instanceof Error ? error.message : 'Failed to normalize payload',
          });
        }
      }

      const duration = Date.now() - startTime;
      
      console.log(`✅ [DepthChartsProcessor] Completed in ${duration}ms`);
      console.log(`   📊 Created: ${result.depthChartsCreated} | Errors: ${result.errors} | Skipped: ${result.skipped}`);

      return {
        success: result.success,
        errors: result.errors,
        skipped: result.skipped,
        tableResults: {
          playersCreated: 0,
          playersUpdated: 0,
          teamsCreated: 0,
          teamsUpdated: 0,
          marketSignalsCreated: 0,
          injuriesCreated: 0,
          depthChartsCreated: result.depthChartsCreated
        },
        errorDetails: result.errorDetails.map(e => ({
          payloadId: e.payloadId,
          error: e.error
        }))
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [DepthChartsProcessor] Critical error:`, error);
      throw new Error(`Depth chart processing failed: ${errorMessage}`);
    }
  }

  /**
   * Normalize raw payload data into standardized depth chart format
   */
  private async normalizePayloadData(payload: IngestPayload): Promise<NormalizedDepthChartEntry[]> {
    const source = payload.source;
    const rawData = payload.payload;

    switch (source) {
      case 'sleeper':
        return this.normalizeSleeperData(rawData, payload);
      case 'espn':
        return this.normalizeEspnData(rawData, payload);
      case 'nfl_data_py':
        return this.normalizeNFLDataPyData(rawData, payload);
      default:
        console.warn(`[DepthChartsProcessor] Unknown source: ${source}`);
        return [];
    }
  }

  /**
   * Normalize Sleeper depth chart data
   */
  private normalizeSleeperData(rawData: any, payload: IngestPayload): NormalizedDepthChartEntry[] {
    const entries: NormalizedDepthChartEntry[] = [];

    try {
      // Sleeper depth chart format varies, handle different structures
      const depthData = rawData.depth_charts || rawData.players || rawData;

      for (const team in depthData) {
        const teamData = depthData[team];
        if (!teamData || typeof teamData !== 'object') continue;

        for (const position in teamData) {
          const positionData = teamData[position];
          if (!Array.isArray(positionData)) continue;

          positionData.forEach((player, index) => {
            if (!player || typeof player !== 'object') return;

            const entry: NormalizedDepthChartEntry = {
              nflTeam: team.toUpperCase(),
              position: position.toUpperCase(),
              positionGroup: this.getPositionGroup(position.toUpperCase()),
              depthOrder: index + 1,
              roleType: this.determineRoleType(index, position),
              isStarter: index === 0,
              season: payload.season,
              week: payload.week,
              lastUpdated: new Date(),
              playerIdentifiers: {
                name: `${player.first_name || ''} ${player.last_name || ''}`.trim(),
                position: player.position,
                team: team.toUpperCase(),
                externalId: player.player_id,
                platform: 'sleeper'
              },
              metadata: {
                source: 'sleeper',
                dataQuality: this.assessDataQuality(player, ['player_id', 'first_name', 'last_name']),
                confidence: 0.8,
                extractedAt: new Date()
              }
            };

            entries.push(entry);
          });
        }
      }

      console.log(`📊 [DepthChartsProcessor] Normalized ${entries.length} Sleeper depth chart entries`);
      return entries;

    } catch (error) {
      console.error(`❌ [DepthChartsProcessor] Error normalizing Sleeper data:`, error);
      return [];
    }
  }

  /**
   * Normalize ESPN depth chart data
   */
  private normalizeEspnData(rawData: any, payload: IngestPayload): NormalizedDepthChartEntry[] {
    const entries: NormalizedDepthChartEntry[] = [];

    try {
      const teams = rawData.teams || [];

      for (const team of teams) {
        if (!team.roster) continue;

        const teamAbbr = team.team?.abbreviation?.toUpperCase();
        if (!teamAbbr) continue;

        team.roster.forEach((player: any, index: number) => {
          if (!player.athlete) return;

          const position = player.position?.abbreviation?.toUpperCase();
          if (!position) return;

          const entry: NormalizedDepthChartEntry = {
            nflTeam: teamAbbr,
            position: position,
            positionGroup: this.getPositionGroup(position),
            depthOrder: player.depthOrder || index + 1,
            roleType: this.determineRoleType(player.depthOrder || index, position),
            snapPercentage: player.snapPercentage,
            isStarter: (player.depthOrder || index + 1) === 1,
            season: payload.season,
            week: payload.week,
            lastUpdated: new Date(),
            playerIdentifiers: {
              name: player.athlete.fullName || player.athlete.displayName,
              position: position,
              team: teamAbbr,
              externalId: player.athlete.id?.toString(),
              platform: 'espn'
            },
            metadata: {
              source: 'espn',
              dataQuality: this.assessDataQuality(player, ['athlete', 'position']),
              confidence: 0.85,
              extractedAt: new Date()
            }
          };

          entries.push(entry);
        });
      }

      console.log(`📊 [DepthChartsProcessor] Normalized ${entries.length} ESPN depth chart entries`);
      return entries;

    } catch (error) {
      console.error(`❌ [DepthChartsProcessor] Error normalizing ESPN data:`, error);
      return [];
    }
  }

  /**
   * Normalize NFL Data Py depth chart data
   */
  private normalizeNFLDataPyData(rawData: any, payload: IngestPayload): NormalizedDepthChartEntry[] {
    const entries: NormalizedDepthChartEntry[] = [];

    try {
      const depthData = Array.isArray(rawData) ? rawData : [rawData];

      for (const entry of depthData) {
        if (!entry || typeof entry !== 'object') continue;

        const normalizedEntry: NormalizedDepthChartEntry = {
          nflTeam: entry.team?.toUpperCase() || entry.club?.toUpperCase(),
          position: entry.position?.toUpperCase(),
          positionGroup: this.getPositionGroup(entry.position?.toUpperCase()),
          depthOrder: entry.depth_team || entry.depth_chart_order || 1,
          roleType: this.determineRoleType(entry.depth_team || entry.depth_chart_order || 1, entry.position),
          snapPercentage: entry.snap_percentage,
          isStarter: (entry.depth_team || entry.depth_chart_order || 1) === 1,
          season: payload.season,
          week: payload.week,
          lastUpdated: new Date(),
          playerIdentifiers: {
            name: entry.player_name || entry.display_name,
            position: entry.position?.toUpperCase(),
            team: entry.team?.toUpperCase() || entry.club?.toUpperCase(),
            externalId: entry.player_id || entry.gsis_id,
            platform: 'nfl_data_py'
          },
          metadata: {
            source: 'nfl_data_py',
            dataQuality: this.assessDataQuality(entry, ['player_id', 'position', 'team']),
            confidence: 0.95, // High confidence for official NFL data
            extractedAt: new Date()
          }
        };

        entries.push(normalizedEntry);
      }

      console.log(`📊 [DepthChartsProcessor] Normalized ${entries.length} NFL Data Py depth chart entries`);
      return entries;

    } catch (error) {
      console.error(`❌ [DepthChartsProcessor] Error normalizing NFL Data Py data:`, error);
      return [];
    }
  }

  /**
   * Resolve player identity from identifiers
   */
  private async resolvePlayerIdentity(entry: NormalizedDepthChartEntry): Promise<string | null> {
    try {
      // Try external ID first
      if (entry.playerIdentifiers.externalId && entry.playerIdentifiers.platform) {
        const canonicalId = await this.identityService.getCanonicalId(
          entry.playerIdentifiers.externalId,
          entry.playerIdentifiers.platform as any
        );
        if (canonicalId) return canonicalId;
      }

      // Try name search with position filter
      if (entry.playerIdentifiers.name && entry.playerIdentifiers.position) {
        const nameResults = await this.identityService.searchByName(
          entry.playerIdentifiers.name,
          entry.playerIdentifiers.position
        );
        
        if (nameResults.length > 0 && nameResults[0].confidence > 0.8) {
          return nameResults[0].canonicalId;
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ [DepthChartsProcessor] Error resolving player identity:`, error);
      return null;
    }
  }

  /**
   * Upsert depth chart entry
   */
  private async upsertDepthChartEntry(
    entryData: NormalizedDepthChartEntry,
    force: boolean = false
  ): Promise<{ created: boolean }> {
    try {
      if (!entryData.canonicalPlayerId) {
        throw new Error('No canonical player ID resolved');
      }

      // Check for existing depth chart entry
      const existingEntry = await db
        .select()
        .from(depthCharts)
        .where(
          and(
            eq(depthCharts.canonicalPlayerId, entryData.canonicalPlayerId),
            eq(depthCharts.nflTeam, entryData.nflTeam),
            eq(depthCharts.position, entryData.position),
            eq(depthCharts.season, entryData.season),
            entryData.week ? eq(depthCharts.week, entryData.week) : sql`${depthCharts.week} IS NULL`
          )
        )
        .limit(1);

      if (existingEntry.length > 0 && !force) {
        return { created: false };
      }

      // Insert new depth chart entry
      await db.insert(depthCharts).values({
        canonicalPlayerId: entryData.canonicalPlayerId,
        nflTeam: entryData.nflTeam,
        position: entryData.position,
        positionGroup: entryData.positionGroup,
        depthOrder: entryData.depthOrder,
        roleType: entryData.roleType,
        snapPercentage: entryData.snapPercentage,
        isStarter: entryData.isStarter,
        season: entryData.season,
        week: entryData.week,
        lastUpdated: entryData.lastUpdated,
        source: entryData.metadata.source as any,
        dataQuality: entryData.metadata.dataQuality,
        confidence: entryData.metadata.confidence,
        createdAt: new Date()
      });

      return { created: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [DepthChartsProcessor] Error upserting depth chart entry:`, error);
      throw new Error(`Depth chart upsert failed: ${errorMessage}`);
    }
  }

  /**
   * Helper methods
   */
  private getPositionGroup(position: string): string {
    return POSITION_GROUPS[position as keyof typeof POSITION_GROUPS] || 'UNKNOWN';
  }

  private determineRoleType(depthOrder: number, position: string): string {
    if (depthOrder === 1) return 'starter';
    if (depthOrder === 2) return 'backup';
    if (depthOrder >= 3) return 'third_string';
    return 'backup';
  }

  private assessDataQuality(
    data: any, 
    requiredFields: string[]
  ): typeof dataQualityEnum.enumValues[number] {
    const presentFields = requiredFields.filter(field => {
      const value = field.includes('.') 
        ? field.split('.').reduce((obj, key) => obj?.[key], data)
        : data[field];
      return value !== undefined && value !== null && value !== '';
    });

    const completeness = presentFields.length / requiredFields.length;

    if (completeness >= 0.9) return 'HIGH';
    if (completeness >= 0.7) return 'MEDIUM';
    if (completeness >= 0.4) return 'LOW';
    return 'MISSING';
  }
}