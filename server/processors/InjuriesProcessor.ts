/**
 * Injuries Processor
 * 
 * Handles normalization of injury reports and practice status data into the
 * canonical injuries table with proper player identity resolution.
 */

import { db } from '../infra/db';
import { 
  injuries,
  type IngestPayload,
  dataQualityEnum
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { PlayerIdentityService } from '../services/PlayerIdentityService';

export interface InjuryNormalizationResult {
  success: number;
  errors: number;
  skipped: number;
  injuriesCreated: number;
  errorDetails: Array<{
    payloadId: number;
    error: string;
    injuryData?: any;
  }>;
}

export interface NormalizedInjuryData {
  canonicalPlayerId?: string;
  injuryType?: string;
  bodyPart?: string;
  severity?: string;
  status: string;
  practiceStatus?: string;
  injuryDate?: Date;
  expectedReturn?: Date;
  actualReturn?: Date;
  season: number;
  week?: number;
  gameDate?: Date;
  reportedBy?: string;
  description?: string;
  playerIdentifiers: {
    name?: string;
    position?: string;
    team?: string;
    externalId?: string;
    platform?: string;
  };
  metadata: {
    source: string;
    reportDate: Date;
    dataQuality: typeof dataQualityEnum.enumValues[number];
    confidence: number;
  };
}

// Status mapping for different sources
const STATUS_MAPPING = {
  sleeper: {
    'Healthy': 'healthy',
    'Questionable': 'questionable', 
    'Doubtful': 'doubtful',
    'Out': 'out',
    'IR': 'ir',
    'PUP': 'pup',
    'Suspended': 'suspended'
  },
  nfl: {
    'Full Practice': 'healthy',
    'Limited Practice': 'questionable',
    'Did Not Practice': 'doubtful',
    'Out': 'out',
    'Injured Reserve': 'ir'
  },
  fantasypros: {
    'Active': 'healthy',
    'Q': 'questionable',
    'D': 'doubtful', 
    'O': 'out',
    'IR': 'ir'
  }
};

const PRACTICE_STATUS_MAPPING = {
  'Full': 'full',
  'Limited': 'limited',
  'DNP': 'did_not_participate',
  'Did Not Practice': 'did_not_participate'
};

export class InjuriesProcessor {
  private identityService: PlayerIdentityService;

  constructor(identityService: PlayerIdentityService) {
    this.identityService = identityService;
  }

  /**
   * Process Bronze payloads containing injury data
   */
  async process(
    payloads: IngestPayload[], 
    options: { force?: boolean; validateOnly?: boolean } = {}
  ): Promise<any> {
    const startTime = Date.now();
    
    const result: InjuryNormalizationResult = {
      success: 0,
      errors: 0,
      skipped: 0,
      injuriesCreated: 0,
      errorDetails: []
    };

    try {
      console.log(`🔄 [InjuriesProcessor] Processing ${payloads.length} injury data payloads`);

      for (const payload of payloads) {
        try {
          const normalizedInjuries = await this.normalizePayloadData(payload);
          
          if (options.validateOnly) {
            result.success++;
            continue;
          }

          for (const injuryData of normalizedInjuries) {
            try {
              // Resolve player identity
              const canonicalId = await this.resolvePlayerIdentity(injuryData);
              
              if (!canonicalId) {
                console.warn(`⚠️ [InjuriesProcessor] Could not resolve player identity for injury:`, 
                  injuryData.playerIdentifiers);
                result.skipped++;
                continue;
              }

              injuryData.canonicalPlayerId = canonicalId;

              const injuryResult = await this.upsertInjury(injuryData, options.force);
              
              if (injuryResult.created) {
                result.injuriesCreated++;
              }
              
              result.success++;
              
            } catch (error) {
              result.errors++;
              result.errorDetails.push({
                payloadId: payload.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                injuryData
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
      
      console.log(`✅ [InjuriesProcessor] Completed in ${duration}ms`);
      console.log(`   📊 Created: ${result.injuriesCreated} | Errors: ${result.errors} | Skipped: ${result.skipped}`);

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
          injuriesCreated: result.injuriesCreated,
          depthChartsCreated: 0
        },
        errorDetails: result.errorDetails.map(e => ({
          payloadId: e.payloadId,
          error: e.error
        }))
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [InjuriesProcessor] Critical error:`, error);
      throw new Error(`Injury processing failed: ${errorMessage}`);
    }
  }

  /**
   * Normalize raw payload data into standardized injury format
   */
  private async normalizePayloadData(payload: IngestPayload): Promise<NormalizedInjuryData[]> {
    const source = payload.source;
    const rawData = payload.payload;

    switch (source) {
      case 'sleeper':
        return this.normalizeSleeperData(rawData, payload);
      case 'nfl_data_py':
        return this.normalizeNFLDataPyData(rawData, payload);
      case 'fantasypros':
        return this.normalizeFantasyProsData(rawData, payload);
      case 'espn':
        return this.normalizeEspnData(rawData, payload);
      default:
        console.warn(`[InjuriesProcessor] Unknown source: ${source}`);
        return [];
    }
  }

  /**
   * Normalize Sleeper injury data
   */
  private normalizeSleeperData(rawData: any, payload: IngestPayload): NormalizedInjuryData[] {
    const injuries: NormalizedInjuryData[] = [];

    try {
      const playerData = Array.isArray(rawData) ? rawData : Object.values(rawData);

      for (const player of playerData) {
        if (!player || typeof player !== 'object' || !player.injury_status) continue;

        const injury: NormalizedInjuryData = {
          injuryType: this.normalizeInjuryType(player.injury_body_part),
          bodyPart: this.normalizeBodyPart(player.injury_body_part),
          severity: this.normalizeSeverity(player.injury_status),
          status: this.normalizeStatus(player.injury_status, 'sleeper'),
          practiceStatus: this.normalizePracticeStatus(player.practice_participation),
          season: payload.season,
          week: payload.week,
          reportedBy: 'Sleeper',
          description: player.injury_notes,
          playerIdentifiers: {
            name: `${player.first_name || ''} ${player.last_name || ''}`.trim(),
            position: player.position,
            team: player.team,
            externalId: player.player_id,
            platform: 'sleeper'
          },
          metadata: {
            source: 'sleeper',
            reportDate: new Date(),
            dataQuality: this.assessDataQuality(player, ['injury_status', 'injury_body_part']),
            confidence: 0.85
          }
        };

        injuries.push(injury);
      }

      console.log(`📊 [InjuriesProcessor] Normalized ${injuries.length} Sleeper injuries`);
      return injuries;

    } catch (error) {
      console.error(`❌ [InjuriesProcessor] Error normalizing Sleeper data:`, error);
      return [];
    }
  }

  /**
   * Normalize NFL Data Py injury data
   */
  private normalizeNFLDataPyData(rawData: any, payload: IngestPayload): NormalizedInjuryData[] {
    const injuries: NormalizedInjuryData[] = [];

    try {
      const injuryData = Array.isArray(rawData) ? rawData : [rawData];

      for (const injury of injuryData) {
        if (!injury || typeof injury !== 'object') continue;

        const normalized: NormalizedInjuryData = {
          injuryType: this.normalizeInjuryType(injury.injury_type),
          bodyPart: this.normalizeBodyPart(injury.body_part),
          severity: this.normalizeSeverity(injury.severity),
          status: this.normalizeStatus(injury.status, 'nfl'),
          practiceStatus: this.normalizePracticeStatus(injury.practice_status),
          injuryDate: injury.injury_date ? new Date(injury.injury_date) : undefined,
          expectedReturn: injury.expected_return ? new Date(injury.expected_return) : undefined,
          season: payload.season,
          week: payload.week,
          gameDate: injury.game_date ? new Date(injury.game_date) : undefined,
          reportedBy: injury.reported_by || 'NFL',
          description: injury.description,
          playerIdentifiers: {
            name: injury.player_name || injury.display_name,
            position: injury.position,
            team: injury.team,
            externalId: injury.player_id || injury.gsis_id,
            platform: 'nfl_data_py'
          },
          metadata: {
            source: 'nfl_data_py',
            reportDate: new Date(),
            dataQuality: this.assessDataQuality(injury, ['status', 'injury_type']),
            confidence: 0.95 // High confidence for official NFL data
          }
        };

        injuries.push(normalized);
      }

      console.log(`📊 [InjuriesProcessor] Normalized ${injuries.length} NFL Data Py injuries`);
      return injuries;

    } catch (error) {
      console.error(`❌ [InjuriesProcessor] Error normalizing NFL Data Py data:`, error);
      return [];
    }
  }

  /**
   * Normalize FantasyPros injury data
   */
  private normalizeFantasyProsData(rawData: any, payload: IngestPayload): NormalizedInjuryData[] {
    const injuries: NormalizedInjuryData[] = [];

    try {
      const playerData = rawData.players || rawData.data || [];

      for (const player of playerData) {
        if (!player || typeof player !== 'object' || !player.injury_status) continue;

        const injury: NormalizedInjuryData = {
          injuryType: this.normalizeInjuryType(player.injury),
          bodyPart: this.normalizeBodyPart(player.injury),
          status: this.normalizeStatus(player.injury_status, 'fantasypros'),
          season: payload.season,
          week: payload.week,
          reportedBy: 'FantasyPros',
          description: player.injury_notes,
          playerIdentifiers: {
            name: player.player_name || player.name,
            position: player.pos || player.position,
            team: player.team,
            externalId: player.player_id,
            platform: 'fantasypros'
          },
          metadata: {
            source: 'fantasypros',
            reportDate: new Date(),
            dataQuality: this.assessDataQuality(player, ['injury_status']),
            confidence: 0.8
          }
        };

        injuries.push(injury);
      }

      console.log(`📊 [InjuriesProcessor] Normalized ${injuries.length} FantasyPros injuries`);
      return injuries;

    } catch (error) {
      console.error(`❌ [InjuriesProcessor] Error normalizing FantasyPros data:`, error);
      return [];
    }
  }

  /**
   * Normalize ESPN injury data
   */
  private normalizeEspnData(rawData: any, payload: IngestPayload): NormalizedInjuryData[] {
    const injuries: NormalizedInjuryData[] = [];

    try {
      const playerData = rawData.athletes || rawData.players || [];

      for (const player of playerData) {
        if (!player || typeof player !== 'object' || !player.injuryStatus) continue;

        const injury: NormalizedInjuryData = {
          injuryType: this.normalizeInjuryType(player.injury?.type),
          bodyPart: this.normalizeBodyPart(player.injury?.type),
          status: this.normalizeStatus(player.injuryStatus, 'espn'),
          season: payload.season,
          week: payload.week,
          reportedBy: 'ESPN',
          description: player.injury?.description,
          playerIdentifiers: {
            name: player.fullName || player.name,
            position: player.defaultPosition || player.position,
            team: player.proTeam,
            externalId: player.id?.toString(),
            platform: 'espn'
          },
          metadata: {
            source: 'espn',
            reportDate: new Date(),
            dataQuality: this.assessDataQuality(player, ['injuryStatus']),
            confidence: 0.75
          }
        };

        injuries.push(injury);
      }

      console.log(`📊 [InjuriesProcessor] Normalized ${injuries.length} ESPN injuries`);
      return injuries;

    } catch (error) {
      console.error(`❌ [InjuriesProcessor] Error normalizing ESPN data:`, error);
      return [];
    }
  }

  /**
   * Resolve player identity from identifiers
   */
  private async resolvePlayerIdentity(injury: NormalizedInjuryData): Promise<string | null> {
    try {
      // Try external ID first
      if (injury.playerIdentifiers.externalId && injury.playerIdentifiers.platform) {
        const canonicalId = await this.identityService.getCanonicalId(
          injury.playerIdentifiers.externalId,
          injury.playerIdentifiers.platform as any
        );
        if (canonicalId) return canonicalId;
      }

      // Try name search with position filter
      if (injury.playerIdentifiers.name && injury.playerIdentifiers.position) {
        const nameResults = await this.identityService.searchByName(
          injury.playerIdentifiers.name,
          injury.playerIdentifiers.position
        );
        
        if (nameResults.length > 0 && nameResults[0].confidence > 0.8) {
          return nameResults[0].canonicalId;
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ [InjuriesProcessor] Error resolving player identity:`, error);
      return null;
    }
  }

  /**
   * Upsert injury data
   */
  private async upsertInjury(
    injuryData: NormalizedInjuryData,
    force: boolean = false
  ): Promise<{ created: boolean }> {
    try {
      if (!injuryData.canonicalPlayerId) {
        throw new Error('No canonical player ID resolved');
      }

      // Check for existing injury report for the same player/week/season
      const existingInjury = await db
        .select()
        .from(injuries)
        .where(
          and(
            eq(injuries.canonicalPlayerId, injuryData.canonicalPlayerId),
            eq(injuries.source, injuryData.metadata.source as any),
            eq(injuries.season, injuryData.season),
            injuryData.week ? eq(injuries.week, injuryData.week) : sql`${injuries.week} IS NULL`
          )
        )
        .limit(1);

      if (existingInjury.length > 0 && !force) {
        return { created: false };
      }

      // Insert new injury record
      await db.insert(injuries).values({
        canonicalPlayerId: injuryData.canonicalPlayerId,
        injuryType: injuryData.injuryType,
        bodyPart: injuryData.bodyPart,
        severity: injuryData.severity,
        status: injuryData.status,
        practiceStatus: injuryData.practiceStatus,
        injuryDate: injuryData.injuryDate,
        expectedReturn: injuryData.expectedReturn,
        actualReturn: injuryData.actualReturn,
        season: injuryData.season,
        week: injuryData.week,
        gameDate: injuryData.gameDate,
        source: injuryData.metadata.source as any,
        reportedBy: injuryData.reportedBy,
        description: injuryData.description,
        reportDate: injuryData.metadata.reportDate,
        dataQuality: injuryData.metadata.dataQuality,
        confidence: injuryData.metadata.confidence,
        createdAt: new Date()
      });

      return { created: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [InjuriesProcessor] Error upserting injury:`, error);
      throw new Error(`Injury upsert failed: ${errorMessage}`);
    }
  }

  /**
   * Helper methods for data normalization
   */
  private normalizeInjuryType(input?: string): string | undefined {
    if (!input) return undefined;
    
    const normalized = input.toLowerCase();
    if (normalized.includes('knee')) return 'knee';
    if (normalized.includes('ankle')) return 'ankle';
    if (normalized.includes('shoulder')) return 'shoulder';
    if (normalized.includes('hamstring')) return 'hamstring';
    if (normalized.includes('concussion')) return 'concussion';
    if (normalized.includes('back')) return 'back';
    if (normalized.includes('hip')) return 'hip';
    if (normalized.includes('groin')) return 'groin';
    if (normalized.includes('quad')) return 'quadriceps';
    if (normalized.includes('calf')) return 'calf';
    
    return input;
  }

  private normalizeBodyPart(input?: string): string | undefined {
    if (!input) return undefined;
    
    const normalized = input.toLowerCase();
    if (normalized.includes('knee')) return 'knee';
    if (normalized.includes('ankle')) return 'ankle';
    if (normalized.includes('shoulder')) return 'shoulder';
    if (normalized.includes('head') || normalized.includes('concussion')) return 'head';
    if (normalized.includes('back')) return 'back';
    if (normalized.includes('hip')) return 'hip';
    if (normalized.includes('groin')) return 'groin';
    if (normalized.includes('leg') || normalized.includes('quad') || normalized.includes('hamstring')) return 'leg';
    if (normalized.includes('arm') || normalized.includes('elbow') || normalized.includes('wrist')) return 'arm';
    
    return input;
  }

  private normalizeSeverity(input?: string): string | undefined {
    if (!input) return undefined;
    
    const normalized = input.toLowerCase();
    if (normalized.includes('season') || normalized.includes('ir')) return 'season_ending';
    if (normalized.includes('major') || normalized.includes('out')) return 'major';
    if (normalized.includes('moderate') || normalized.includes('doubtful')) return 'moderate';
    if (normalized.includes('minor') || normalized.includes('questionable')) return 'minor';
    
    return undefined;
  }

  private normalizeStatus(input: string, source: string): string {
    const mapping = STATUS_MAPPING[source as keyof typeof STATUS_MAPPING] || {};
    return mapping[input as keyof typeof mapping] || input.toLowerCase();
  }

  private normalizePracticeStatus(input?: string): string | undefined {
    if (!input) return undefined;
    
    const mapping = PRACTICE_STATUS_MAPPING[input as keyof typeof PRACTICE_STATUS_MAPPING];
    return mapping || input.toLowerCase();
  }

  private assessDataQuality(
    data: any, 
    requiredFields: string[]
  ): typeof dataQualityEnum.enumValues[number] {
    const presentFields = requiredFields.filter(field => 
      data[field] !== undefined && data[field] !== null && data[field] !== ''
    );

    const completeness = presentFields.length / requiredFields.length;

    if (completeness >= 0.9) return 'HIGH';
    if (completeness >= 0.7) return 'MEDIUM';
    if (completeness >= 0.4) return 'LOW';
    return 'MISSING';
  }
}