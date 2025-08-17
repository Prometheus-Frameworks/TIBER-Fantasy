/**
 * Data Capture Service for Persistent Static Resources
 * 
 * Captures and saves essential NFL data that remains valuable even when API trials expire.
 * Focus on reference data, player mappings, team info, and structural data.
 */

import fs from 'fs';
import path from 'path';

interface StaticDataCapture {
  timestamp: string;
  source: string;
  type: 'player_mappings' | 'team_info' | 'position_mappings' | 'injury_history' | 'roster_structure';
  data: any;
  expirationSafe: boolean;
}

export class DataCaptureService {
  private captureDir = path.join(process.cwd(), 'static_captures');

  constructor() {
    if (!fs.existsSync(this.captureDir)) {
      fs.mkdirSync(this.captureDir, { recursive: true });
    }
  }

  /**
   * Capture MySportsFeeds reference data that doesn't change frequently
   */
  async captureMSFStaticData(): Promise<boolean> {
    if (!process.env.MSF_USERNAME || !process.env.MSF_PASSWORD) {
      console.log('⚠️ MSF credentials not available for capture');
      return false;
    }

    const auth = Buffer.from(`${process.env.MSF_USERNAME}:${process.env.MSF_PASSWORD}`).toString('base64');
    const headers = { 'Authorization': `Basic ${auth}` };

    try {
      console.log('📡 Capturing MySportsFeeds static reference data...');

      // 1. Player mappings - Critical for ID resolution
      const playersResponse = await fetch('https://api.mysportsfeeds.com/v2.1/pull/nfl/players.json', { headers });
      if (playersResponse.ok) {
        const playersData = await playersResponse.json();
        await this.saveCapture({
          timestamp: new Date().toISOString(),
          source: 'MySportsFeeds',
          type: 'player_mappings',
          data: {
            players: playersData.players?.map((p: any) => ({
              id: p.player.id,
              firstName: p.player.firstName,
              lastName: p.player.lastName,
              position: p.player.primaryPosition,
              currentTeam: p.player.currentTeam?.abbreviation,
              jerseyNumber: p.player.jerseyNumber,
              height: p.player.height,
              weight: p.player.weight,
              birthDate: p.player.birthDate,
              rookieYear: p.player.rookieYear,
              socialMediaAccounts: p.player.socialMediaAccounts
            })) || [],
            totalPlayers: playersData.players?.length || 0
          },
          expirationSafe: true
        }, 'msf_player_mappings.json');
        console.log('✅ Player mappings captured');
      }

      // 2. Team structure - Reference data
      const teamsResponse = await fetch('https://api.mysportsfeeds.com/v2.1/pull/nfl/teams.json', { headers });
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        await this.saveCapture({
          timestamp: new Date().toISOString(),
          source: 'MySportsFeeds',
          type: 'team_info',
          data: {
            teams: teamsData.teams?.map((t: any) => ({
              id: t.team.id,
              abbreviation: t.team.abbreviation,
              name: t.team.name,
              city: t.team.city,
              conference: t.team.conferenceAbbrev,
              division: t.team.divisionAbbrev
            })) || []
          },
          expirationSafe: true
        }, 'msf_team_mappings.json');
        console.log('✅ Team mappings captured');
      }

      // 3. Current injury snapshot for reference patterns
      const injuryResponse = await fetch('https://api.mysportsfeeds.com/v2.1/pull/nfl/current/player_injuries.json', { headers });
      if (injuryResponse.ok) {
        const injuryData = await injuryResponse.json();
        await this.saveCapture({
          timestamp: new Date().toISOString(),
          source: 'MySportsFeeds',
          type: 'injury_history',
          data: {
            snapshot_date: new Date().toISOString().split('T')[0],
            injuries: injuryData.playerInjuries?.map((inj: any) => ({
              playerId: inj.player?.id,
              playerName: `${inj.player?.firstName} ${inj.player?.lastName}`,
              team: inj.player?.currentTeam?.abbreviation,
              position: inj.player?.primaryPosition,
              injuryStatus: inj.injuryStatus,
              injuryDescription: inj.description,
              injuryDate: inj.injuryDate
            })) || []
          },
          expirationSafe: true
        }, 'msf_injury_snapshot.json');
        console.log('✅ Injury snapshot captured');
      }

      return true;
    } catch (error) {
      console.error('❌ MSF capture failed:', error);
      return false;
    }
  }

  /**
   * Capture SportsDataIO reference data
   */
  async captureSportsDataStaticData(): Promise<boolean> {
    if (!process.env.SPORTSDATA_API_KEY) {
      console.log('⚠️ SportsDataIO credentials not available for capture');
      return false;
    }

    try {
      console.log('📡 Capturing SportsDataIO static reference data...');

      // 1. Team details and colors
      const teamsResponse = await fetch(`https://api.sportsdata.io/v3/nfl/scores/json/AllTeams?key=${process.env.SPORTSDATA_API_KEY}`);
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        await this.saveCapture({
          timestamp: new Date().toISOString(),
          source: 'SportsDataIO',
          type: 'team_info',
          data: {
            teams: teamsData.map((team: any) => ({
              teamId: team.TeamID,
              key: team.Key,
              name: team.Name,
              city: team.City,
              conference: team.Conference,
              division: team.Division,
              primaryColor: team.PrimaryColor,
              secondaryColor: team.SecondaryColor,
              tertiaryColor: team.TertiaryColor,
              wikipediaLogoUrl: team.WikipediaLogoUrl,
              wikipediaWordMarkUrl: team.WikipediaWordMarkUrl
            }))
          },
          expirationSafe: true
        }, 'sportsdata_teams.json');
        console.log('✅ Team details captured');
      }

      // 2. Player details for current season
      const playersResponse = await fetch(`https://api.sportsdata.io/v3/nfl/scores/json/Players?key=${process.env.SPORTSDATA_API_KEY}`);
      if (playersResponse.ok) {
        const playersData = await playersResponse.json();
        await this.saveCapture({
          timestamp: new Date().toISOString(),
          source: 'SportsDataIO',
          type: 'player_mappings',
          data: {
            players: playersData.map((player: any) => ({
              playerId: player.PlayerID,
              firstName: player.FirstName,
              lastName: player.LastName,
              position: player.Position,
              team: player.Team,
              jerseyNumber: player.Number,
              height: player.Height,
              weight: player.Weight,
              birthDate: player.BirthDate,
              college: player.College,
              experience: player.Experience,
              fantasyPosition: player.FantasyPosition,
              active: player.Active
            }))
          },
          expirationSafe: true
        }, 'sportsdata_players.json');
        console.log('✅ Player details captured');
      }

      return true;
    } catch (error) {
      console.error('❌ SportsDataIO capture failed:', error);
      return false;
    }
  }

  /**
   * Capture Sleeper reference data (free, no expiration risk)
   */
  async captureSleeperStaticData(): Promise<boolean> {
    try {
      console.log('📡 Capturing Sleeper static reference data...');

      // Player mappings from Sleeper (free API)
      const playersResponse = await fetch('https://api.sleeper.app/v1/players/nfl');
      if (playersResponse.ok) {
        const playersData = await playersResponse.json();
        await this.saveCapture({
          timestamp: new Date().toISOString(),
          source: 'Sleeper',
          type: 'player_mappings',
          data: {
            players: Object.entries(playersData).map(([id, player]: [string, any]) => ({
              sleeperId: id,
              firstName: player.first_name,
              lastName: player.last_name,
              position: player.position,
              team: player.team,
              number: player.number,
              height: player.height,
              weight: player.weight,
              age: player.age,
              college: player.college,
              yearsExp: player.years_exp,
              fantasyPositions: player.fantasy_positions,
              active: player.active,
              injuryStatus: player.injury_status
            })),
            totalPlayers: Object.keys(playersData).length
          },
          expirationSafe: true
        }, 'sleeper_players.json');
        console.log('✅ Sleeper player mappings captured');
      }

      return true;
    } catch (error) {
      console.error('❌ Sleeper capture failed:', error);
      return false;
    }
  }

  /**
   * Save captured data to file system
   */
  private async saveCapture(capture: StaticDataCapture, filename: string): Promise<void> {
    const filepath = path.join(this.captureDir, filename);
    const content = {
      metadata: {
        captureTime: capture.timestamp,
        source: capture.source,
        type: capture.type,
        expirationSafe: capture.expirationSafe,
        dataSize: JSON.stringify(capture.data).length
      },
      data: capture.data
    };

    fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
    console.log(`💾 Saved ${filename} (${Math.round(content.metadata.dataSize / 1024)}KB)`);
  }

  /**
   * Execute full static data capture across all sources
   */
  async executeFullCapture(): Promise<{ success: boolean; sources: string[]; files: string[] }> {
    console.log('🚀 Starting comprehensive static data capture...');
    
    const results = {
      success: false,
      sources: [] as string[],
      files: [] as string[]
    };

    // Always capture Sleeper (free)
    if (await this.captureSleeperStaticData()) {
      results.sources.push('Sleeper');
      results.files.push('sleeper_players.json');
    }

    // Capture MySportsFeeds if available
    if (await this.captureMSFStaticData()) {
      results.sources.push('MySportsFeeds');
      results.files.push('msf_player_mappings.json', 'msf_team_mappings.json', 'msf_injury_snapshot.json');
    }

    // Capture SportsDataIO if available
    if (await this.captureSportsDataStaticData()) {
      results.sources.push('SportsDataIO');
      results.files.push('sportsdata_teams.json', 'sportsdata_players.json');
    }

    results.success = results.sources.length > 0;
    
    // Create capture manifest
    const manifest = {
      captureDate: new Date().toISOString(),
      sources: results.sources,
      files: results.files,
      description: 'Static NFL reference data for OTC platform',
      expirationRisk: 'Low - Contains structural data that changes infrequently'
    };

    fs.writeFileSync(
      path.join(this.captureDir, 'capture_manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log(`✅ Capture complete: ${results.sources.length} sources, ${results.files.length} files`);
    return results;
  }

  /**
   * Get list of available static captures
   */
  getAvailableCaptures(): string[] {
    if (!fs.existsSync(this.captureDir)) return [];
    return fs.readdirSync(this.captureDir).filter(f => f.endsWith('.json'));
  }
}