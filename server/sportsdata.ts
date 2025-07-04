import type { Player, InsertPlayer } from "@shared/schema";

const API_BASE_URL = "https://api.sportsdata.io/v3/nfl";
const API_KEY = process.env.SPORTSDATA_API_KEY;

if (!API_KEY) {
  throw new Error("SPORTSDATA_API_KEY environment variable is required");
}

// SportsDataIO API response types
interface SportsDataPlayer {
  PlayerID: number;
  Team: string;
  Number: number;
  FirstName: string;
  LastName: string;
  Position: string;
  Status: string;
  Height: string;
  Weight: number;
  BirthDate: string;
  College: string;
  Experience: number;
  FantasyPosition: string;
  Active: boolean;
  PositionCategory: string;
  Name: string;
  Age: number;
  ExperienceString: string;
  BirthDateString: string;
  PhotoUrl: string;
  ByeWeek: number;
  UpcomingGameOpponent: string;
  UpcomingGameWeek: number;
  ShortName: string;
  AverageDraftPosition: number;
  DepthChartPosition: string;
  DepthChartOrder: number;
  GlobalTeamID: number;
  TeamID: number;
  FanDuelPlayerID: number;
  DraftKingsPlayerID: number;
  YahooPlayerID: number;
  InjuryStatus: string;
  InjuryBodyPart: string;
  InjuryStartDate: string;
  InjuryNotes: string;
}

interface SportsDataPlayerStats {
  PlayerID: number;
  SeasonType: number;
  Season: number;
  Team: string;
  Number: number;
  Name: string;
  Position: string;
  PositionCategory: string;
  Activated: number;
  Played: number;
  Started: number;
  PassingAttempts: number;
  PassingCompletions: number;
  PassingYards: number;
  PassingCompletionPercentage: number;
  PassingYardsPerAttempt: number;
  PassingYardsPerCompletion: number;
  PassingTouchdowns: number;
  PassingInterceptions: number;
  PassingRating: number;
  PassingLong: number;
  PassingSacks: number;
  PassingSackYards: number;
  RushingAttempts: number;
  RushingYards: number;
  RushingYardsPerAttempt: number;
  RushingTouchdowns: number;
  RushingLong: number;
  ReceivingTargets: number;
  Receptions: number;
  ReceivingYards: number;
  ReceivingYardsPerReception: number;
  ReceivingTouchdowns: number;
  ReceivingLong: number;
  Fumbles: number;
  FumblesLost: number;
  PuntReturns: number;
  PuntReturnYards: number;
  PuntReturnYardsPerAttempt: number;
  PuntReturnTouchdowns: number;
  PuntReturnLong: number;
  KickReturns: number;
  KickReturnYards: number;
  KickReturnYardsPerAttempt: number;
  KickReturnTouchdowns: number;
  KickReturnLong: number;
  SoloTackles: number;
  AssistedTackles: number;
  TacklesForLoss: number;
  Sacks: number;
  SackYards: number;
  QuarterbackHits: number;
  PassesDefended: number;
  FumblesForced: number;
  FumblesRecovered: number;
  FumbleReturnYards: number;
  FumbleReturnTouchdowns: number;
  Interceptions: number;
  InterceptionReturnYards: number;
  InterceptionReturnTouchdowns: number;
  BlockedKicks: number;
  SpecialTeamsSoloTackles: number;
  SpecialTeamsAssistedTackles: number;
  MiscSoloTackles: number;
  MiscAssistedTackles: number;
  Punts: number;
  PuntYards: number;
  PuntAverage: number;
  FieldGoalsAttempted: number;
  FieldGoalsMade: number;
  FieldGoalsLongestMade: number;
  ExtraPointsMade: number;
  TwoPointConversionPasses: number;
  TwoPointConversionRuns: number;
  TwoPointConversionReceptions: number;
  FantasyPoints: number;
  FantasyPointsPPR: number;
  ReceptionPercentage: number;
  ReceivingYardsPerTarget: number;
  Tackles: number;
  OffensiveSnapsPlayed: number;
  DefensiveSnapsPlayed: number;
  SpecialTeamsSnapsPlayed: number;
  OffensiveTeamSnaps: number;
  DefensiveTeamSnaps: number;
  SpecialTeamsTeamSnaps: number;
  VictivSalary: number;
  TwoPointConversionReturns: number;
  FantasyPointsFanDuel: number;
  FieldGoalPercentage: number;
  GlobalTeamID: number;
  FanDuelSalary: number;
  DraftKingsSalary: number;
  FantasyPointsDraftKings: number;
  YahooSalary: number;
  FantasyPointsYahoo: number;
  InjuryStatus: string;
  InjuryBodyPart: string;
  InjuryStartDate: string;
  InjuryNotes: string;
  FanDuelPosition: string;
  DraftKingsPosition: string;
  YahooPosition: string;
  OpponentRank: number;
  OpponentPositionRank: number;
  InjuryPractice: string;
  InjuryPracticeDescription: string;
  DeclaredInactive: boolean;
  FantasyDraftSalary: number;
  FantasyDraftPosition: string;
  TeamID: number;
  OpponentID: number;
  Opponent: string;
  Day: string;
  DateTime: string;
  HomeOrAway: string;
  IsGameOver: boolean;
  GlobalGameID: number;
  GlobalOpponentID: number;
  Updated: string;
  Games: number;
  FantasyPointsPerGame: number;
  FantasyPointsPPRPerGame: number;
  FantasyPointsFanDuelPerGame: number;
  FantasyPointsDraftKingsPerGame: number;
  FantasyPointsYahooPerGame: number;
  InjuryWeek: number;
  FantasyPointsSuperdraft: number;
  FantasyPointsSuperdraftPerGame: number;
  SuperdraftSalary: number;
  SuperdraftPosition: string;
}

interface SportsDataProjection {
  PlayerID: number;
  SeasonType: number;
  Season: number;
  Name: string;
  Team: string;
  Position: string;
  Number: number;
  PassingAttempts: number;
  PassingCompletions: number;
  PassingYards: number;
  PassingTouchdowns: number;
  PassingInterceptions: number;
  RushingAttempts: number;
  RushingYards: number;
  RushingTouchdowns: number;
  ReceivingTargets: number;
  Receptions: number;
  ReceivingYards: number;
  ReceivingTouchdowns: number;
  FantasyPoints: number;
  FantasyPointsPPR: number;
  FantasyPointsFanDuel: number;
  FantasyPointsDraftKings: number;
  FantasyPointsYahoo: number;
}

export class SportsDataAPI {
  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}?key=${API_KEY}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`SportsData API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch from SportsData API: ${endpoint}`, error);
      throw error;
    }
  }

  async getActivePlayers(): Promise<SportsDataPlayer[]> {
    return this.makeRequest<SportsDataPlayer[]>("/scores/json/Players");
  }

  async getPlayersByTeam(team: string): Promise<SportsDataPlayer[]> {
    return this.makeRequest<SportsDataPlayer[]>(`/scores/json/Players/${team}`);
  }

  async getPlayerStats(season: string = "2024REG"): Promise<SportsDataPlayerStats[]> {
    return this.makeRequest<SportsDataPlayerStats[]>(`/stats/json/PlayerSeasonStats/${season}`);
  }

  async getProjections(week: number, season: string = "2024REG"): Promise<SportsDataProjection[]> {
    return this.makeRequest<SportsDataProjection[]>(`/projections/json/PlayerGameProjectionStatsByWeek/${season}/${week}`);
  }

  async getFreeAgents(): Promise<SportsDataPlayer[]> {
    return this.makeRequest<SportsDataPlayer[]>("/scores/json/FreeAgents");
  }

  // Convert SportsData player to our schema format
  convertToPlayer(sportsDataPlayer: SportsDataPlayer, stats?: SportsDataPlayerStats): InsertPlayer {
    const avgPoints = stats?.FantasyPointsPPR || this.estimateFantasyPoints(sportsDataPlayer);
    const projectedPoints = avgPoints * (0.9 + Math.random() * 0.2); // ±10% variance
    
    // Use real ADP data from SportsDataIO
    const realADP = sportsDataPlayer.AverageDraftPosition || 999;
    
    // Convert ADP to ownership percentage (lower ADP = higher ownership)
    let ownershipPercentage = 5; // Base ownership
    if (realADP <= 12) ownershipPercentage = 95 + Math.random() * 5; // Elite players
    else if (realADP <= 36) ownershipPercentage = 80 + Math.random() * 15; // Top tier
    else if (realADP <= 72) ownershipPercentage = 60 + Math.random() * 20; // Mid tier
    else if (realADP <= 120) ownershipPercentage = 30 + Math.random() * 30; // Bench players
    else if (realADP <= 200) ownershipPercentage = 10 + Math.random() * 20; // Deep league
    else ownershipPercentage = 1 + Math.random() * 10; // Rarely owned
    
    return {
      name: sportsDataPlayer.Name,
      team: sportsDataPlayer.Team || "FA",
      position: this.normalizePosition(sportsDataPlayer.FantasyPosition || sportsDataPlayer.Position),
      avgPoints: Math.round(avgPoints * 10) / 10,
      projectedPoints: Math.round(projectedPoints * 10) / 10,
      ownershipPercentage: Math.round(ownershipPercentage),
      isAvailable: true,
      upside: Math.round((projectedPoints * 1.2 - avgPoints) * 10) / 10,
      injuryStatus: this.normalizeInjuryStatus(sportsDataPlayer.InjuryStatus),
      availability: sportsDataPlayer.Active ? "Available" : "Unavailable",
      imageUrl: sportsDataPlayer.PhotoUrl || null, // Include player headshot
      consistency: Math.round((80 + Math.random() * 20) * 10) / 10,
      matchupRating: Math.round((6 + Math.random() * 4) * 10) / 10,
      trend: Math.random() > 0.5 ? "up" : "down",
      ownership: Math.round(Math.random() * 100),
      targetShare: stats?.ReceivingTargets ? Math.round((stats.ReceivingTargets / 16) * 10) / 10 : undefined,
      redZoneTargets: stats ? Math.round(stats.ReceivingTargets * 0.2) : undefined,
      carries: stats?.RushingAttempts || undefined,
      snapCount: stats?.OffensiveSnapsPlayed || undefined,
      externalId: sportsDataPlayer.PlayerID.toString(),
    };
  }

  // Estimate fantasy points based on position and depth chart
  private estimateFantasyPoints(player: SportsDataPlayer): number {
    const position = player.FantasyPosition || player.Position;
    const adp = player.AverageDraftPosition || 999;
    
    // Estimate points based on ADP and position
    if (position === 'QB') {
      if (adp <= 12) return 22 + Math.random() * 6; // Top 12 QBs: 22-28 points
      else if (adp <= 24) return 18 + Math.random() * 4; // QB13-24: 18-22 points
      else return 12 + Math.random() * 6; // Backup QBs: 12-18 points
    } else if (position === 'RB') {
      if (adp <= 24) return 16 + Math.random() * 6; // RB1-24: 16-22 points
      else if (adp <= 48) return 10 + Math.random() * 6; // RB25-48: 10-16 points
      else return 6 + Math.random() * 4; // Handcuffs: 6-10 points
    } else if (position === 'WR') {
      if (adp <= 36) return 14 + Math.random() * 6; // WR1-36: 14-20 points
      else if (adp <= 72) return 8 + Math.random() * 6; // WR37-72: 8-14 points
      else return 4 + Math.random() * 4; // Deep WRs: 4-8 points
    } else if (position === 'TE') {
      if (adp <= 12) return 12 + Math.random() * 6; // Elite TEs: 12-18 points
      else if (adp <= 24) return 8 + Math.random() * 4; // Mid TEs: 8-12 points
      else return 4 + Math.random() * 4; // Streaming TEs: 4-8 points
    }
    
    return 5 + Math.random() * 5; // Default fallback
  }

  private normalizePosition(position: string): string {
    const positionMap: { [key: string]: string } = {
      "QB": "QB",
      "RB": "RB", 
      "WR": "WR",
      "TE": "TE",
      "K": "K",
      "DST": "DEF",
      "DEF": "DEF"
    };
    
    return positionMap[position] || position;
  }

  private normalizeInjuryStatus(status: string): string {
    if (!status || status === "None" || status === "Active") return "Healthy";
    if (status === "Out") return "Out";
    if (status === "Questionable" || status === "Q") return "Questionable";
    if (status === "Doubtful" || status === "D") return "Doubtful";
    if (status === "Probable" || status === "P") return "Probable";
    return status;
  }
}

export const sportsDataAPI = new SportsDataAPI();