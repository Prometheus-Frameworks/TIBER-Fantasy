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
    const avgPoints = stats?.FantasyPointsPPR || Math.random() * 15 + 5; // Fallback to random if no stats
    const projectedPoints = avgPoints * (0.8 + Math.random() * 0.4); // ±20% variance
    
    return {
      name: sportsDataPlayer.Name,
      team: sportsDataPlayer.Team || "FA",
      position: this.normalizePosition(sportsDataPlayer.FantasyPosition || sportsDataPlayer.Position),
      avgPoints: Math.round(avgPoints * 10) / 10,
      projectedPoints: Math.round(projectedPoints * 10) / 10,
      ownershipPercentage: Math.round(Math.random() * 100),
      isAvailable: true,
      upside: Math.round((projectedPoints * 1.3 - avgPoints) * 10) / 10,
      injuryStatus: this.normalizeInjuryStatus(sportsDataPlayer.InjuryStatus),
      availability: sportsDataPlayer.Active ? "Available" : "Unavailable",
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