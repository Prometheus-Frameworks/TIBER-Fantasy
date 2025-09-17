/**
 * Teams Dimension Processor
 * 
 * Handles normalization of NFL team data into the canonical teams dimension table.
 * Manages team metadata, divisions, conferences, and cross-platform team ID mapping.
 */

import { db } from '../db';
import { 
  nflTeamsDim,
  type IngestPayload,
  type NflTeamsDim
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export interface TeamNormalizationResult {
  success: number;
  errors: number;
  skipped: number;
  teamsCreated: number;
  teamsUpdated: number;
  errorDetails: Array<{
    payloadId: number;
    error: string;
    teamData?: any;
  }>;
}

export interface NormalizedTeamData {
  teamCode: string;
  teamName: string;
  teamCity: string;
  teamNickname: string;
  conference: string;
  division: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  stadiumName?: string;
  stadiumCity?: string;
  timezone?: string;
  externalIds: {
    sleeper?: string;
    espn?: string;
    yahoo?: string;
  };
  metadata: {
    source: string;
    lastUpdated: Date;
    isActive: boolean;
  };
}

// Static NFL team reference data
const NFL_TEAMS_REFERENCE = {
  'ARI': { city: 'Arizona', nickname: 'Cardinals', conference: 'NFC', division: 'West' },
  'ATL': { city: 'Atlanta', nickname: 'Falcons', conference: 'NFC', division: 'South' },
  'BAL': { city: 'Baltimore', nickname: 'Ravens', conference: 'AFC', division: 'North' },
  'BUF': { city: 'Buffalo', nickname: 'Bills', conference: 'AFC', division: 'East' },
  'CAR': { city: 'Carolina', nickname: 'Panthers', conference: 'NFC', division: 'South' },
  'CHI': { city: 'Chicago', nickname: 'Bears', conference: 'NFC', division: 'North' },
  'CIN': { city: 'Cincinnati', nickname: 'Bengals', conference: 'AFC', division: 'North' },
  'CLE': { city: 'Cleveland', nickname: 'Browns', conference: 'AFC', division: 'North' },
  'DAL': { city: 'Dallas', nickname: 'Cowboys', conference: 'NFC', division: 'East' },
  'DEN': { city: 'Denver', nickname: 'Broncos', conference: 'AFC', division: 'West' },
  'DET': { city: 'Detroit', nickname: 'Lions', conference: 'NFC', division: 'North' },
  'GB': { city: 'Green Bay', nickname: 'Packers', conference: 'NFC', division: 'North' },
  'HOU': { city: 'Houston', nickname: 'Texans', conference: 'AFC', division: 'South' },
  'IND': { city: 'Indianapolis', nickname: 'Colts', conference: 'AFC', division: 'South' },
  'JAX': { city: 'Jacksonville', nickname: 'Jaguars', conference: 'AFC', division: 'South' },
  'KC': { city: 'Kansas City', nickname: 'Chiefs', conference: 'AFC', division: 'West' },
  'LV': { city: 'Las Vegas', nickname: 'Raiders', conference: 'AFC', division: 'West' },
  'LAC': { city: 'Los Angeles', nickname: 'Chargers', conference: 'AFC', division: 'West' },
  'LAR': { city: 'Los Angeles', nickname: 'Rams', conference: 'NFC', division: 'West' },
  'MIA': { city: 'Miami', nickname: 'Dolphins', conference: 'AFC', division: 'East' },
  'MIN': { city: 'Minnesota', nickname: 'Vikings', conference: 'NFC', division: 'North' },
  'NE': { city: 'New England', nickname: 'Patriots', conference: 'AFC', division: 'East' },
  'NO': { city: 'New Orleans', nickname: 'Saints', conference: 'NFC', division: 'South' },
  'NYG': { city: 'New York', nickname: 'Giants', conference: 'NFC', division: 'East' },
  'NYJ': { city: 'New York', nickname: 'Jets', conference: 'AFC', division: 'East' },
  'PHI': { city: 'Philadelphia', nickname: 'Eagles', conference: 'NFC', division: 'East' },
  'PIT': { city: 'Pittsburgh', nickname: 'Steelers', conference: 'AFC', division: 'North' },
  'SF': { city: 'San Francisco', nickname: '49ers', conference: 'NFC', division: 'West' },
  'SEA': { city: 'Seattle', nickname: 'Seahawks', conference: 'NFC', division: 'West' },
  'TB': { city: 'Tampa Bay', nickname: 'Buccaneers', conference: 'NFC', division: 'South' },
  'TEN': { city: 'Tennessee', nickname: 'Titans', conference: 'AFC', division: 'South' },
  'WAS': { city: 'Washington', nickname: 'Commanders', conference: 'NFC', division: 'East' },
};

export class TeamsDimProcessor {
  
  /**
   * Process Bronze payloads containing team data
   */
  async process(
    payloads: IngestPayload[], 
    options: { force?: boolean; validateOnly?: boolean } = {}
  ): Promise<any> {
    const startTime = Date.now();
    
    const result: TeamNormalizationResult = {
      success: 0,
      errors: 0,
      skipped: 0,
      teamsCreated: 0,
      teamsUpdated: 0,
      errorDetails: []
    };

    try {
      console.log(`🔄 [TeamsDimProcessor] Processing ${payloads.length} team data payloads`);

      for (const payload of payloads) {
        try {
          const normalizedTeams = await this.normalizePayloadData(payload);
          
          if (options.validateOnly) {
            result.success++;
            continue;
          }

          for (const teamData of normalizedTeams) {
            try {
              const teamResult = await this.upsertTeam(teamData, options.force);
              
              if (teamResult.created) {
                result.teamsCreated++;
              } else if (teamResult.updated) {
                result.teamsUpdated++;
              } else {
                result.skipped++;
              }
              
              result.success++;
              
            } catch (error) {
              result.errors++;
              result.errorDetails.push({
                payloadId: payload.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                teamData
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
      
      console.log(`✅ [TeamsDimProcessor] Completed in ${duration}ms`);
      console.log(`   📊 Created: ${result.teamsCreated} | Updated: ${result.teamsUpdated} | Errors: ${result.errors}`);

      return {
        success: result.success,
        errors: result.errors,
        skipped: result.skipped,
        tableResults: {
          playersCreated: 0,
          playersUpdated: 0,
          teamsCreated: result.teamsCreated,
          teamsUpdated: result.teamsUpdated,
          marketSignalsCreated: 0,
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
      console.error(`❌ [TeamsDimProcessor] Critical error:`, error);
      throw new Error(`Team processing failed: ${errorMessage}`);
    }
  }

  /**
   * Normalize raw payload data into standardized team format
   */
  private async normalizePayloadData(payload: IngestPayload): Promise<NormalizedTeamData[]> {
    const source = payload.source;
    const rawData = payload.payload;

    switch (source) {
      case 'sleeper':
        return this.normalizeSleeperData(rawData, payload);
      case 'espn':
        return this.normalizeEspnData(rawData, payload);
      case 'yahoo':
        return this.normalizeYahooData(rawData, payload);
      case 'nfl_data_py':
        return this.normalizeNFLDataPyData(rawData, payload);
      default:
        console.warn(`[TeamsDimProcessor] Unknown source: ${source}`);
        return [];
    }
  }

  /**
   * Normalize Sleeper API team data
   */
  private normalizeSleeperData(rawData: any, payload: IngestPayload): NormalizedTeamData[] {
    const teams: NormalizedTeamData[] = [];

    try {
      const teamData = Object.values(rawData) as any[];

      for (const team of teamData) {
        if (!team || typeof team !== 'object') continue;

        const teamCode = team.team_id?.toUpperCase();
        if (!teamCode || !NFL_TEAMS_REFERENCE[teamCode as keyof typeof NFL_TEAMS_REFERENCE]) continue;

        const reference = NFL_TEAMS_REFERENCE[teamCode as keyof typeof NFL_TEAMS_REFERENCE];

        const normalized: NormalizedTeamData = {
          teamCode,
          teamName: `${reference.city} ${reference.nickname}`,
          teamCity: reference.city,
          teamNickname: reference.nickname,
          conference: reference.conference,
          division: reference.division,
          primaryColor: team.primary_color,
          secondaryColor: team.secondary_color,
          logoUrl: team.logo_url,
          externalIds: {
            sleeper: teamCode
          },
          metadata: {
            source: 'sleeper',
            lastUpdated: new Date(),
            isActive: true
          }
        };

        teams.push(normalized);
      }

      console.log(`📊 [TeamsDimProcessor] Normalized ${teams.length} Sleeper teams`);
      return teams;

    } catch (error) {
      console.error(`❌ [TeamsDimProcessor] Error normalizing Sleeper data:`, error);
      return [];
    }
  }

  /**
   * Normalize ESPN API team data
   */
  private normalizeEspnData(rawData: any, payload: IngestPayload): NormalizedTeamData[] {
    const teams: NormalizedTeamData[] = [];

    try {
      const teamData = rawData.teams || rawData.sports?.[0]?.leagues?.[0]?.teams || [];

      for (const teamWrapper of teamData) {
        const team = teamWrapper.team || teamWrapper;
        if (!team) continue;

        const teamCode = team.abbreviation?.toUpperCase();
        if (!teamCode || !NFL_TEAMS_REFERENCE[teamCode as keyof typeof NFL_TEAMS_REFERENCE]) continue;

        const reference = NFL_TEAMS_REFERENCE[teamCode as keyof typeof NFL_TEAMS_REFERENCE];

        const normalized: NormalizedTeamData = {
          teamCode,
          teamName: team.displayName || `${reference.city} ${reference.nickname}`,
          teamCity: team.location || reference.city,
          teamNickname: team.name || reference.nickname,
          conference: reference.conference,
          division: reference.division,
          primaryColor: team.color,
          logoUrl: team.logos?.[0]?.href,
          externalIds: {
            espn: team.id?.toString()
          },
          metadata: {
            source: 'espn',
            lastUpdated: new Date(),
            isActive: team.isActive !== false
          }
        };

        teams.push(normalized);
      }

      console.log(`📊 [TeamsDimProcessor] Normalized ${teams.length} ESPN teams`);
      return teams;

    } catch (error) {
      console.error(`❌ [TeamsDimProcessor] Error normalizing ESPN data:`, error);
      return [];
    }
  }

  /**
   * Normalize Yahoo API team data
   */
  private normalizeYahooData(rawData: any, payload: IngestPayload): NormalizedTeamData[] {
    const teams: NormalizedTeamData[] = [];

    try {
      const teamData = rawData.fantasy_content?.league?.teams?.team || [];

      for (const teamWrapper of teamData) {
        const team = teamWrapper.team || teamWrapper;
        if (!team) continue;

        // Yahoo uses different team identification, may need mapping
        const teamCode = team.team_key?.split('.')?.[2]?.toUpperCase();
        if (!teamCode || !NFL_TEAMS_REFERENCE[teamCode as keyof typeof NFL_TEAMS_REFERENCE]) continue;

        const reference = NFL_TEAMS_REFERENCE[teamCode as keyof typeof NFL_TEAMS_REFERENCE];

        const normalized: NormalizedTeamData = {
          teamCode,
          teamName: team.name || `${reference.city} ${reference.nickname}`,
          teamCity: reference.city,
          teamNickname: reference.nickname,
          conference: reference.conference,
          division: reference.division,
          logoUrl: team.team_logos?.team_logo?.url,
          externalIds: {
            yahoo: team.team_id?.toString()
          },
          metadata: {
            source: 'yahoo',
            lastUpdated: new Date(),
            isActive: true
          }
        };

        teams.push(normalized);
      }

      console.log(`📊 [TeamsDimProcessor] Normalized ${teams.length} Yahoo teams`);
      return teams;

    } catch (error) {
      console.error(`❌ [TeamsDimProcessor] Error normalizing Yahoo data:`, error);
      return [];
    }
  }

  /**
   * Normalize NFL Data Py team data
   */
  private normalizeNFLDataPyData(rawData: any, payload: IngestPayload): NormalizedTeamData[] {
    const teams: NormalizedTeamData[] = [];

    try {
      const teamData = Array.isArray(rawData) ? rawData : [rawData];

      for (const team of teamData) {
        if (!team) continue;

        const teamCode = team.team_abbr?.toUpperCase() || team.abbr?.toUpperCase();
        if (!teamCode || !NFL_TEAMS_REFERENCE[teamCode as keyof typeof NFL_TEAMS_REFERENCE]) continue;

        const reference = NFL_TEAMS_REFERENCE[teamCode as keyof typeof NFL_TEAMS_REFERENCE];

        const normalized: NormalizedTeamData = {
          teamCode,
          teamName: team.team_name || `${reference.city} ${reference.nickname}`,
          teamCity: team.team_city || reference.city,
          teamNickname: team.team_nick || reference.nickname,
          conference: team.team_conf || reference.conference,
          division: team.team_division || reference.division,
          primaryColor: team.team_color,
          secondaryColor: team.team_color2,
          logoUrl: team.team_logo_espn,
          externalIds: {
            nfl_data_py: teamCode
          },
          metadata: {
            source: 'nfl_data_py',
            lastUpdated: new Date(),
            isActive: true
          }
        };

        teams.push(normalized);
      }

      console.log(`📊 [TeamsDimProcessor] Normalized ${teams.length} NFL Data Py teams`);
      return teams;

    } catch (error) {
      console.error(`❌ [TeamsDimProcessor] Error normalizing NFL Data Py data:`, error);
      return [];
    }
  }

  /**
   * Upsert normalized team data into the teams dimension table
   */
  private async upsertTeam(
    teamData: NormalizedTeamData, 
    force: boolean = false
  ): Promise<{ created: boolean; updated: boolean; teamCode: string }> {
    try {
      // Check if team already exists
      const existingTeam = await db
        .select()
        .from(nflTeamsDim)
        .where(eq(nflTeamsDim.teamCode, teamData.teamCode))
        .limit(1);

      if (!existingTeam.length) {
        // Create new team
        await db.insert(nflTeamsDim).values({
          teamCode: teamData.teamCode,
          teamName: teamData.teamName,
          teamCity: teamData.teamCity,
          teamNickname: teamData.teamNickname,
          conference: teamData.conference,
          division: teamData.division,
          primaryColor: teamData.primaryColor,
          secondaryColor: teamData.secondaryColor,
          logoUrl: teamData.logoUrl,
          stadiumName: teamData.stadiumName,
          stadiumCity: teamData.stadiumCity,
          timezone: teamData.timezone,
          sleeperId: teamData.externalIds.sleeper,
          espnId: teamData.externalIds.espn,
          yahooId: teamData.externalIds.yahoo,
          isActive: teamData.metadata.isActive,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        return { created: true, updated: false, teamCode: teamData.teamCode };
      } else {
        // Update existing team if forced or if we have new external IDs
        const team = existingTeam[0];
        const shouldUpdate = force || 
          (teamData.externalIds.sleeper && !team.sleeperId) ||
          (teamData.externalIds.espn && !team.espnId) ||
          (teamData.externalIds.yahoo && !team.yahooId) ||
          (teamData.logoUrl && !team.logoUrl);

        if (shouldUpdate) {
          await db.update(nflTeamsDim)
            .set({
              teamName: teamData.teamName || team.teamName,
              teamCity: teamData.teamCity || team.teamCity,
              teamNickname: teamData.teamNickname || team.teamNickname,
              conference: teamData.conference || team.conference,
              division: teamData.division || team.division,
              primaryColor: teamData.primaryColor || team.primaryColor,
              secondaryColor: teamData.secondaryColor || team.secondaryColor,
              logoUrl: teamData.logoUrl || team.logoUrl,
              stadiumName: teamData.stadiumName || team.stadiumName,
              stadiumCity: teamData.stadiumCity || team.stadiumCity,
              timezone: teamData.timezone || team.timezone,
              sleeperId: teamData.externalIds.sleeper || team.sleeperId,
              espnId: teamData.externalIds.espn || team.espnId,
              yahooId: teamData.externalIds.yahoo || team.yahooId,
              isActive: teamData.metadata.isActive ?? team.isActive,
              updatedAt: new Date()
            })
            .where(eq(nflTeamsDim.teamCode, teamData.teamCode));

          return { created: false, updated: true, teamCode: teamData.teamCode };
        }

        return { created: false, updated: false, teamCode: teamData.teamCode };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [TeamsDimProcessor] Error upserting team:`, error);
      throw new Error(`Team upsert failed: ${errorMessage}`);
    }
  }
}