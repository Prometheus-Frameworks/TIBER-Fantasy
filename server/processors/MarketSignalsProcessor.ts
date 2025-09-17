/**
 * Market Signals Processor
 * 
 * Handles normalization of market data (ADP, ECR rankings, ownership, etc.) into the
 * canonical market signals table with proper player identity resolution.
 */

import { db } from '../db';
import { 
  marketSignals,
  type IngestPayload,
  dataQualityEnum
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { PlayerIdentityService } from '../services/PlayerIdentityService';

export interface MarketSignalNormalizationResult {
  success: number;
  errors: number;
  skipped: number;
  marketSignalsCreated: number;
  errorDetails: Array<{
    payloadId: number;
    error: string;
    signalData?: any;
  }>;
}

export interface NormalizedMarketSignal {
  canonicalPlayerId?: string;
  signalType: string;
  overallRank?: number;
  positionalRank?: number;
  value?: number;
  season: number;
  week?: number;
  leagueFormat?: string;
  scoringFormat?: string;
  sampleSize?: number;
  confidence: number;
  dataQuality: typeof dataQualityEnum.enumValues[number];
  playerIdentifiers: {
    name?: string;
    position?: string;
    team?: string;
    externalId?: string;
    platform?: string;
  };
  metadata: {
    source: string;
    extractedAt: Date;
    validFrom: Date;
    validTo?: Date;
  };
}

export class MarketSignalsProcessor {
  private identityService: PlayerIdentityService;

  constructor(identityService: PlayerIdentityService) {
    this.identityService = identityService;
  }

  /**
   * Process Bronze payloads containing market signal data
   */
  async process(
    payloads: IngestPayload[], 
    options: { force?: boolean; validateOnly?: boolean } = {}
  ): Promise<any> {
    const startTime = Date.now();
    
    const result: MarketSignalNormalizationResult = {
      success: 0,
      errors: 0,
      skipped: 0,
      marketSignalsCreated: 0,
      errorDetails: []
    };

    try {
      console.log(`🔄 [MarketSignalsProcessor] Processing ${payloads.length} market signal payloads`);

      for (const payload of payloads) {
        try {
          const normalizedSignals = await this.normalizePayloadData(payload);
          
          if (options.validateOnly) {
            result.success++;
            continue;
          }

          for (const signalData of normalizedSignals) {
            try {
              // Resolve player identity
              const canonicalId = await this.resolvePlayerIdentity(signalData);
              
              if (!canonicalId) {
                console.warn(`⚠️ [MarketSignalsProcessor] Could not resolve player identity for signal:`, 
                  signalData.playerIdentifiers);
                result.skipped++;
                continue;
              }

              signalData.canonicalPlayerId = canonicalId;

              const signalResult = await this.upsertMarketSignal(signalData, options.force);
              
              if (signalResult.created) {
                result.marketSignalsCreated++;
              }
              
              result.success++;
              
            } catch (error) {
              result.errors++;
              result.errorDetails.push({
                payloadId: payload.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                signalData
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
      
      console.log(`✅ [MarketSignalsProcessor] Completed in ${duration}ms`);
      console.log(`   📊 Created: ${result.marketSignalsCreated} | Errors: ${result.errors} | Skipped: ${result.skipped}`);

      return {
        success: result.success,
        errors: result.errors,
        skipped: result.skipped,
        tableResults: {
          playersCreated: 0,
          playersUpdated: 0,
          teamsCreated: 0,
          teamsUpdated: 0,
          marketSignalsCreated: result.marketSignalsCreated,
          injuriesCreated: 0,
          depthChartsCreated: 0
        },
        errorDetails: result.errorDetails.map(e => ({
          payloadId: e.payloadId,
          error: e.error
        }))
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [MarketSignalsProcessor] Critical error:`, error);
      throw new Error(`Market signals processing failed: ${errorMessage}`);
    }
  }

  /**
   * Normalize raw payload data into standardized market signal format
   */
  private async normalizePayloadData(payload: IngestPayload): Promise<NormalizedMarketSignal[]> {
    const source = payload.source;
    const endpoint = payload.endpoint;
    const rawData = payload.payload;

    // Determine signal type from endpoint
    const signalType = this.determineSignalType(endpoint);

    switch (source) {
      case 'sleeper':
        return this.normalizeSleeperData(rawData, payload, signalType);
      case 'fantasypros':
        return this.normalizeFantasyProsData(rawData, payload, signalType);
      case 'espn':
        return this.normalizeEspnData(rawData, payload, signalType);
      case 'yahoo':
        return this.normalizeYahooData(rawData, payload, signalType);
      default:
        console.warn(`[MarketSignalsProcessor] Unknown source: ${source}`);
        return [];
    }
  }

  /**
   * Normalize Sleeper ADP data
   */
  private normalizeSleeperData(
    rawData: any, 
    payload: IngestPayload, 
    signalType: string
  ): NormalizedMarketSignal[] {
    const signals: NormalizedMarketSignal[] = [];

    try {
      const playerData = Array.isArray(rawData) ? rawData : Object.values(rawData);

      for (const player of playerData) {
        if (!player || typeof player !== 'object') continue;

        const signal: NormalizedMarketSignal = {
          signalType,
          overallRank: player.adp_overall,
          positionalRank: player.adp_position,
          value: player.adp || player.average_draft_position,
          season: payload.season,
          week: payload.week,
          leagueFormat: this.extractLeagueFormat(payload.endpoint),
          scoringFormat: this.extractScoringFormat(payload.endpoint),
          sampleSize: player.sample_size,
          confidence: 0.8,
          dataQuality: this.assessDataQuality(player, ['adp']),
          playerIdentifiers: {
            name: `${player.first_name || ''} ${player.last_name || ''}`.trim(),
            position: player.position,
            team: player.team,
            externalId: player.player_id,
            platform: 'sleeper'
          },
          metadata: {
            source: 'sleeper',
            extractedAt: new Date(),
            validFrom: new Date(),
            validTo: payload.week ? this.getWeekEndDate(payload.season, payload.week) : undefined
          }
        };

        signals.push(signal);
      }

      console.log(`📊 [MarketSignalsProcessor] Normalized ${signals.length} Sleeper ${signalType} signals`);
      return signals;

    } catch (error) {
      console.error(`❌ [MarketSignalsProcessor] Error normalizing Sleeper data:`, error);
      return [];
    }
  }

  /**
   * Normalize FantasyPros ECR data
   */
  private normalizeFantasyProsData(
    rawData: any, 
    payload: IngestPayload, 
    signalType: string
  ): NormalizedMarketSignal[] {
    const signals: NormalizedMarketSignal[] = [];

    try {
      const playerData = rawData.players || rawData.data || [];

      for (const player of playerData) {
        if (!player || typeof player !== 'object') continue;

        const signal: NormalizedMarketSignal = {
          signalType,
          overallRank: player.rank_ecr || player.overall_rank,
          positionalRank: player.pos_rank || player.position_rank,
          value: player.rank_ecr || player.consensus_rank,
          season: payload.season,
          week: payload.week,
          leagueFormat: this.extractLeagueFormat(payload.endpoint),
          scoringFormat: this.extractScoringFormat(payload.endpoint),
          sampleSize: player.number_of_experts,
          confidence: 0.9, // High confidence for FantasyPros consensus
          dataQuality: this.assessDataQuality(player, ['rank_ecr', 'pos_rank']),
          playerIdentifiers: {
            name: player.player_name || player.name,
            position: player.pos || player.position,
            team: player.team,
            externalId: player.player_id,
            platform: 'fantasypros'
          },
          metadata: {
            source: 'fantasypros',
            extractedAt: new Date(),
            validFrom: new Date(),
            validTo: payload.week ? this.getWeekEndDate(payload.season, payload.week) : undefined
          }
        };

        signals.push(signal);
      }

      console.log(`📊 [MarketSignalsProcessor] Normalized ${signals.length} FantasyPros ${signalType} signals`);
      return signals;

    } catch (error) {
      console.error(`❌ [MarketSignalsProcessor] Error normalizing FantasyPros data:`, error);
      return [];
    }
  }

  /**
   * Normalize ESPN data
   */
  private normalizeEspnData(
    rawData: any, 
    payload: IngestPayload, 
    signalType: string
  ): NormalizedMarketSignal[] {
    const signals: NormalizedMarketSignal[] = [];

    try {
      const playerData = rawData.players || rawData.athletes || [];

      for (const player of playerData) {
        if (!player || typeof player !== 'object') continue;

        const signal: NormalizedMarketSignal = {
          signalType,
          overallRank: player.draftRank || player.overallRank,
          positionalRank: player.positionRank,
          value: player.averageDraftPosition || player.ownership,
          season: payload.season,
          week: payload.week,
          leagueFormat: this.extractLeagueFormat(payload.endpoint),
          scoringFormat: this.extractScoringFormat(payload.endpoint),
          confidence: 0.75,
          dataQuality: this.assessDataQuality(player, ['draftRank', 'positionRank']),
          playerIdentifiers: {
            name: player.fullName || player.name,
            position: player.defaultPosition,
            team: player.proTeam,
            externalId: player.id?.toString(),
            platform: 'espn'
          },
          metadata: {
            source: 'espn',
            extractedAt: new Date(),
            validFrom: new Date(),
            validTo: payload.week ? this.getWeekEndDate(payload.season, payload.week) : undefined
          }
        };

        signals.push(signal);
      }

      console.log(`📊 [MarketSignalsProcessor] Normalized ${signals.length} ESPN ${signalType} signals`);
      return signals;

    } catch (error) {
      console.error(`❌ [MarketSignalsProcessor] Error normalizing ESPN data:`, error);
      return [];
    }
  }

  /**
   * Normalize Yahoo data
   */
  private normalizeYahooData(
    rawData: any, 
    payload: IngestPayload, 
    signalType: string
  ): NormalizedMarketSignal[] {
    const signals: NormalizedMarketSignal[] = [];

    try {
      const playerData = rawData.fantasy_content?.players?.player || [];

      for (const playerWrapper of playerData) {
        const player = playerWrapper.player || playerWrapper;
        if (!player) continue;

        const signal: NormalizedMarketSignal = {
          signalType,
          overallRank: player.draft_analysis?.average_pick,
          value: player.draft_analysis?.average_pick || player.percent_owned,
          season: payload.season,
          week: payload.week,
          leagueFormat: this.extractLeagueFormat(payload.endpoint),
          scoringFormat: this.extractScoringFormat(payload.endpoint),
          confidence: 0.7,
          dataQuality: this.assessDataQuality(player, ['draft_analysis']),
          playerIdentifiers: {
            name: player.name?.full,
            position: player.position_type,
            team: player.editorial_team_abbr,
            externalId: player.player_id?.toString(),
            platform: 'yahoo'
          },
          metadata: {
            source: 'yahoo',
            extractedAt: new Date(),
            validFrom: new Date(),
            validTo: payload.week ? this.getWeekEndDate(payload.season, payload.week) : undefined
          }
        };

        signals.push(signal);
      }

      console.log(`📊 [MarketSignalsProcessor] Normalized ${signals.length} Yahoo ${signalType} signals`);
      return signals;

    } catch (error) {
      console.error(`❌ [MarketSignalsProcessor] Error normalizing Yahoo data:`, error);
      return [];
    }
  }

  /**
   * Resolve player identity from identifiers
   */
  private async resolvePlayerIdentity(signal: NormalizedMarketSignal): Promise<string | null> {
    try {
      // Try external ID first
      if (signal.playerIdentifiers.externalId && signal.playerIdentifiers.platform) {
        const canonicalId = await this.identityService.getCanonicalId(
          signal.playerIdentifiers.externalId,
          signal.playerIdentifiers.platform as any
        );
        if (canonicalId) return canonicalId;
      }

      // Try name search with position filter
      if (signal.playerIdentifiers.name && signal.playerIdentifiers.position) {
        const nameResults = await this.identityService.searchByName(
          signal.playerIdentifiers.name,
          signal.playerIdentifiers.position
        );
        
        if (nameResults.length > 0 && nameResults[0].confidence > 0.8) {
          return nameResults[0].canonicalId;
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ [MarketSignalsProcessor] Error resolving player identity:`, error);
      return null;
    }
  }

  /**
   * Upsert market signal data
   */
  private async upsertMarketSignal(
    signalData: NormalizedMarketSignal,
    force: boolean = false
  ): Promise<{ created: boolean }> {
    try {
      if (!signalData.canonicalPlayerId) {
        throw new Error('No canonical player ID resolved');
      }

      // Check for existing signal to avoid duplicates
      const existingSignal = await db
        .select()
        .from(marketSignals)
        .where(
          and(
            eq(marketSignals.canonicalPlayerId, signalData.canonicalPlayerId),
            eq(marketSignals.source, signalData.metadata.source as any),
            eq(marketSignals.signalType, signalData.signalType),
            eq(marketSignals.season, signalData.season),
            signalData.week ? eq(marketSignals.week, signalData.week) : sql`${marketSignals.week} IS NULL`,
            signalData.leagueFormat ? eq(marketSignals.leagueFormat, signalData.leagueFormat) : sql`${marketSignals.leagueFormat} IS NULL`,
            signalData.scoringFormat ? eq(marketSignals.scoringFormat, signalData.scoringFormat) : sql`${marketSignals.scoringFormat} IS NULL`
          )
        )
        .limit(1);

      if (existingSignal.length > 0 && !force) {
        return { created: false };
      }

      // Insert new signal
      await db.insert(marketSignals).values({
        canonicalPlayerId: signalData.canonicalPlayerId,
        source: signalData.metadata.source as any,
        signalType: signalData.signalType,
        overallRank: signalData.overallRank,
        positionalRank: signalData.positionalRank,
        value: signalData.value,
        season: signalData.season,
        week: signalData.week,
        leagueFormat: signalData.leagueFormat,
        scoringFormat: signalData.scoringFormat,
        sampleSize: signalData.sampleSize,
        confidence: signalData.confidence,
        dataQuality: signalData.dataQuality,
        extractedAt: signalData.metadata.extractedAt,
        validFrom: signalData.metadata.validFrom,
        validTo: signalData.metadata.validTo,
        createdAt: new Date()
      });

      return { created: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [MarketSignalsProcessor] Error upserting market signal:`, error);
      throw new Error(`Market signal upsert failed: ${errorMessage}`);
    }
  }

  /**
   * Helper methods
   */
  private determineSignalType(endpoint: string): string {
    if (endpoint.includes('adp')) return 'adp';
    if (endpoint.includes('ecr') || endpoint.includes('rankings')) return 'ecr';
    if (endpoint.includes('ownership')) return 'ownership';
    if (endpoint.includes('start')) return 'start_pct';
    return 'unknown';
  }

  private extractLeagueFormat(endpoint: string): string | undefined {
    if (endpoint.includes('dynasty')) return 'dynasty';
    if (endpoint.includes('redraft')) return 'redraft';
    if (endpoint.includes('bestball')) return 'bestball';
    return undefined;
  }

  private extractScoringFormat(endpoint: string): string | undefined {
    if (endpoint.includes('ppr')) return 'ppr';
    if (endpoint.includes('half')) return 'half';
    if (endpoint.includes('standard')) return 'standard';
    return undefined;
  }

  private assessDataQuality(
    data: any, 
    requiredFields: string[]
  ): typeof dataQualityEnum.enumValues[number] {
    const presentFields = requiredFields.filter(field => 
      data[field] !== undefined && data[field] !== null
    );

    const completeness = presentFields.length / requiredFields.length;

    if (completeness >= 0.9) return 'HIGH';
    if (completeness >= 0.7) return 'MEDIUM';
    if (completeness >= 0.4) return 'LOW';
    return 'MISSING';
  }

  private getWeekEndDate(season: number, week: number): Date {
    // NFL season typically starts first week of September
    const seasonStart = new Date(season, 8, 1); // September 1st
    const weekStart = new Date(seasonStart.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    return new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}