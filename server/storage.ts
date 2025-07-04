import { 
  teams, 
  players, 
  teamPlayers, 
  positionAnalysis, 
  weeklyPerformance,
  matchupAnalysis,
  lineupOptimization,
  tradeAnalysis,
  waiverRecommendations,
  injuryTracker,
  type Team, 
  type Player, 
  type TeamPlayer, 
  type PositionAnalysis, 
  type WeeklyPerformance,
  type MatchupAnalysis,
  type LineupOptimization,
  type TradeAnalysis,
  type WaiverRecommendations,
  type InjuryTracker,
  type InsertTeam, 
  type InsertPlayer, 
  type InsertTeamPlayer, 
  type InsertPositionAnalysis, 
  type InsertWeeklyPerformance,
  type InsertMatchupAnalysis,
  type InsertLineupOptimization,
  type InsertTradeAnalysis,
  type InsertWaiverRecommendations,
  type InsertInjuryTracker
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { sportsDataAPI } from "./sportsdata";

export interface IStorage {
  // Team operations
  getTeam(id: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(teamId: number, updates: Partial<InsertTeam>): Promise<void>;
  updateTeamSync(teamId: number, syncData: {
    syncPlatform?: string | null;
    syncLeagueId?: string | null;
    syncTeamId?: string | null;
    lastSyncDate?: Date | null;
    syncEnabled?: boolean | null;
  }): Promise<void>;
  
  // Player operations
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayerByExternalId(externalId: string): Promise<Player | undefined>;
  getAllPlayers(): Promise<Player[]>;
  getAvailablePlayers(position?: string): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  
  // Team-Player relationships
  getTeamPlayers(teamId: number): Promise<(Player & { isStarter: boolean })[]>;
  addPlayerToTeam(teamPlayer: InsertTeamPlayer): Promise<TeamPlayer>;
  
  // Position analysis
  getPositionAnalysis(teamId: number): Promise<PositionAnalysis[]>;
  createPositionAnalysis(analysis: InsertPositionAnalysis): Promise<PositionAnalysis>;
  
  // Performance tracking
  getWeeklyPerformance(teamId: number): Promise<WeeklyPerformance[]>;
  createWeeklyPerformance(performance: InsertWeeklyPerformance): Promise<WeeklyPerformance>;
  
  // Recommendations
  getPlayerRecommendations(teamId: number, position?: string): Promise<Player[]>;
  
  // Advanced Analytics
  createMatchupAnalysis(analysis: InsertMatchupAnalysis): Promise<MatchupAnalysis>;
  getMatchupAnalysis(playerId: number, week: number): Promise<MatchupAnalysis | undefined>;
  
  createLineupOptimization(optimization: InsertLineupOptimization): Promise<LineupOptimization>;
  getLineupOptimization(teamId: number, week: number): Promise<LineupOptimization | undefined>;
  
  createTradeAnalysis(analysis: InsertTradeAnalysis): Promise<TradeAnalysis>;
  getTradeAnalysis(teamId: number): Promise<TradeAnalysis[]>;
  
  createWaiverRecommendations(recommendation: InsertWaiverRecommendations): Promise<WaiverRecommendations>;
  getWaiverRecommendations(teamId: number): Promise<WaiverRecommendations[]>;
  
  createInjuryTracker(injury: InsertInjuryTracker): Promise<InjuryTracker>;
  getInjuryTracker(playerId: number): Promise<InjuryTracker | undefined>;
  updateInjuryTracker(playerId: number, updates: Partial<InsertInjuryTracker>): Promise<void>;
  
  // Premium Analytics
  updatePlayerPremiumAnalytics(playerId: number, premiumData: any): Promise<void>;
}

export class MemStorage implements IStorage {
  private teams: Map<number, Team> = new Map();
  private players: Map<number, Player> = new Map();
  private teamPlayers: Map<number, TeamPlayer> = new Map();
  private positionAnalyses: Map<number, PositionAnalysis> = new Map();
  private weeklyPerformances: Map<number, WeeklyPerformance> = new Map();
  
  private currentTeamId = 1;
  private currentPlayerId = 1;
  private currentTeamPlayerId = 1;
  private currentPositionAnalysisId = 1;
  private currentWeeklyPerformanceId = 1;

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Create sample team
    const team: Team = {
      id: 1,
      name: "Lightning Bolts",
      ownerId: "user1",
      leagueName: "Championship Division",
      record: "6-2",
      leagueRank: 3,
      totalPoints: 1247,
      healthScore: 78
    };
    this.teams.set(1, team);
    this.currentTeamId = 2;

    // Create comprehensive NFL player database
    const samplePlayers: Player[] = [
      // Elite QBs
      { id: 1, name: "Josh Allen", team: "BUF", position: "QB", avgPoints: 23.4, projectedPoints: 24.1, ownershipPercentage: 98, isAvailable: false, upside: 89, targetShare: null, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 87, adp: 2.3, dynastyValue: 95, efficiency: 8.2, sustainability: 92, marketValue: 94, confidence: 95, age: 28, experience: 7, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 2, name: "Lamar Jackson", team: "BAL", position: "QB", avgPoints: 22.8, projectedPoints: 23.2, ownershipPercentage: 97, isAvailable: false, upside: 92, targetShare: null, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 84, adp: 3.1, dynastyValue: 89, efficiency: 7.9, sustainability: 88, marketValue: 90, confidence: 93, age: 27, experience: 7, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 3, name: "Jalen Hurts", team: "PHI", position: "QB", avgPoints: 21.9, projectedPoints: 22.6, ownershipPercentage: 96, isAvailable: false, upside: 88, targetShare: null, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 81, adp: 4.2, dynastyValue: 86, efficiency: 7.6, sustainability: 85, marketValue: 87, confidence: 91, age: 25, experience: 4, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 4, name: "Dak Prescott", team: "DAL", position: "QB", avgPoints: 20.3, projectedPoints: 20.8, ownershipPercentage: 89, isAvailable: false, upside: 79, targetShare: null, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 78, adp: 8.7, dynastyValue: 72, efficiency: 7.1, sustainability: 76, marketValue: 74, confidence: 82, age: 31, experience: 9, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 5, name: "Caleb Williams", team: "CHI", position: "QB", avgPoints: 18.4, projectedPoints: 21.2, ownershipPercentage: 85, isAvailable: false, upside: 94, targetShare: null, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 72, adp: 6.8, dynastyValue: 91, efficiency: 6.8, sustainability: 89, marketValue: 88, confidence: 78, age: 22, experience: 1, lastUpdated: new Date(), premiumDataUpdated: null },

      // Elite RBs
      { id: 50, name: "Christian McCaffrey", team: "SF", position: "RB", avgPoints: 19.8, projectedPoints: 18.9, ownershipPercentage: 99, isAvailable: false, upside: 87, targetShare: 12.5, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 91, adp: 1.2, dynastyValue: 84, efficiency: 8.9, sustainability: 79, marketValue: 86, confidence: 94, age: 28, experience: 7, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 51, name: "Saquon Barkley", team: "PHI", position: "RB", avgPoints: 18.2, projectedPoints: 17.8, ownershipPercentage: 98, isAvailable: false, upside: 89, targetShare: 8.7, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 86, adp: 2.8, dynastyValue: 82, efficiency: 8.6, sustainability: 81, marketValue: 84, confidence: 92, age: 27, experience: 6, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 52, name: "Bijan Robinson", team: "ATL", position: "RB", avgPoints: 16.4, projectedPoints: 18.2, ownershipPercentage: 95, isAvailable: false, upside: 92, targetShare: 9.1, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 83, adp: 4.6, dynastyValue: 94, efficiency: 8.1, sustainability: 91, marketValue: 89, confidence: 87, age: 22, experience: 2, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 53, name: "Jahmyr Gibbs", team: "DET", position: "RB", avgPoints: 15.9, projectedPoints: 17.3, ownershipPercentage: 92, isAvailable: false, upside: 88, targetShare: 11.2, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 79, adp: 5.8, dynastyValue: 91, efficiency: 8.4, sustainability: 86, marketValue: 85, confidence: 84, age: 22, experience: 2, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 54, name: "Chuba Hubbard", team: "CAR", position: "RB", avgPoints: 14.2, projectedPoints: 15.8, ownershipPercentage: 78, isAvailable: true, upside: 84, targetShare: 7.3, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 76, adp: 45.2, dynastyValue: 73, efficiency: 7.6, sustainability: 78, marketValue: 69, confidence: 81, age: 25, experience: 4, lastUpdated: new Date(), premiumDataUpdated: null },

      // Elite WRs  
      { id: 100, name: "CeeDee Lamb", team: "DAL", position: "WR", avgPoints: 19.4, projectedPoints: 19.8, ownershipPercentage: 99, isAvailable: false, upside: 94, targetShare: 29.1, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 89, adp: 3.4, dynastyValue: 96, efficiency: 8.7, sustainability: 93, marketValue: 95, confidence: 96, age: 25, experience: 5, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 101, name: "Tyreek Hill", team: "MIA", position: "WR", avgPoints: 18.7, projectedPoints: 18.2, ownershipPercentage: 98, isAvailable: false, upside: 91, targetShare: 27.8, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 87, adp: 4.1, dynastyValue: 88, efficiency: 8.9, sustainability: 84, marketValue: 89, confidence: 94, age: 30, experience: 8, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 102, name: "Ja'Marr Chase", team: "CIN", position: "WR", avgPoints: 18.1, projectedPoints: 19.1, ownershipPercentage: 97, isAvailable: false, upside: 96, targetShare: 26.4, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 91, adp: 5.2, dynastyValue: 98, efficiency: 8.8, sustainability: 95, marketValue: 96, confidence: 95, age: 24, experience: 4, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 103, name: "Puka Nacua", team: "LAR", position: "WR", avgPoints: 15.3, projectedPoints: 17.8, ownershipPercentage: 89, isAvailable: false, upside: 93, targetShare: 24.7, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 82, adp: 12.4, dynastyValue: 91, efficiency: 8.2, sustainability: 87, marketValue: 88, confidence: 86, age: 23, experience: 2, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 104, name: "Darnell Mooney", team: "ATL", position: "WR", avgPoints: 12.8, projectedPoints: 13.9, ownershipPercentage: 67, isAvailable: true, upside: 79, targetShare: 18.3, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 74, adp: 78.6, dynastyValue: 68, efficiency: 7.1, sustainability: 72, marketValue: 65, confidence: 77, age: 27, experience: 5, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 105, name: "Rome Odunze", team: "CHI", position: "WR", avgPoints: 9.7, projectedPoints: 14.2, ownershipPercentage: 72, isAvailable: true, upside: 88, targetShare: 16.8, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 68, adp: 67.3, dynastyValue: 83, efficiency: 6.9, sustainability: 81, marketValue: 76, confidence: 74, age: 22, experience: 1, lastUpdated: new Date(), premiumDataUpdated: null },

      // Elite TEs
      { id: 150, name: "Travis Kelce", team: "KC", position: "TE", avgPoints: 14.8, projectedPoints: 14.2, ownershipPercentage: 96, isAvailable: false, upside: 83, targetShare: 22.1, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 88, adp: 15.7, dynastyValue: 76, efficiency: 8.3, sustainability: 71, marketValue: 78, confidence: 91, age: 35, experience: 12, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 151, name: "Sam LaPorta", team: "DET", position: "TE", avgPoints: 13.6, projectedPoints: 14.8, ownershipPercentage: 89, isAvailable: false, upside: 87, targetShare: 19.4, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 84, adp: 28.3, dynastyValue: 92, efficiency: 7.9, sustainability: 88, marketValue: 86, confidence: 88, age: 23, experience: 2, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 152, name: "Brock Bowers", team: "LV", position: "TE", avgPoints: 12.4, projectedPoints: 15.2, ownershipPercentage: 85, isAvailable: false, upside: 91, targetShare: 21.7, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 81, adp: 32.6, dynastyValue: 95, efficiency: 7.6, sustainability: 90, marketValue: 89, confidence: 84, age: 22, experience: 1, lastUpdated: new Date(), premiumDataUpdated: null },

      // Rising/Trending Players
      { id: 200, name: "Ladd McConkey", team: "LAC", position: "WR", avgPoints: 11.2, projectedPoints: 13.8, ownershipPercentage: 68, isAvailable: true, upside: 86, targetShare: 17.9, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 76, adp: 89.4, dynastyValue: 78, efficiency: 7.4, sustainability: 82, marketValue: 74, confidence: 79, age: 23, experience: 1, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 201, name: "Brian Thomas Jr.", team: "JAX", position: "WR", avgPoints: 10.8, projectedPoints: 14.1, ownershipPercentage: 71, isAvailable: true, upside: 89, targetShare: 19.2, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 73, adp: 82.7, dynastyValue: 84, efficiency: 7.2, sustainability: 85, marketValue: 78, confidence: 76, age: 22, experience: 1, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 202, name: "Jayden Reed", team: "GB", position: "WR", avgPoints: 12.6, projectedPoints: 14.3, ownershipPercentage: 78, isAvailable: true, upside: 84, targetShare: 18.6, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 79, adp: 76.2, dynastyValue: 81, efficiency: 7.8, sustainability: 83, marketValue: 77, confidence: 82, age: 24, experience: 2, lastUpdated: new Date(), premiumDataUpdated: null },

      // Available/Bench Players  
      { id: 300, name: "Tyler Allgeier", team: "ATL", position: "RB", avgPoints: 9.4, projectedPoints: 10.8, ownershipPercentage: 52, isAvailable: true, upside: 71, targetShare: 4.2, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 68, adp: 156.8, dynastyValue: 58, efficiency: 6.8, sustainability: 64, marketValue: 54, confidence: 72, age: 24, experience: 3, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 301, name: "Gus Edwards", team: "LAC", position: "RB", avgPoints: 8.7, projectedPoints: 9.2, ownershipPercentage: 47, isAvailable: true, upside: 68, targetShare: 3.1, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 71, adp: 187.4, dynastyValue: 52, efficiency: 6.4, sustainability: 59, marketValue: 48, confidence: 69, age: 29, experience: 6, lastUpdated: new Date(), premiumDataUpdated: null },
      { id: 302, name: "Cole Kmet", team: "CHI", position: "TE", avgPoints: 9.4, projectedPoints: 10.1, ownershipPercentage: 34, isAvailable: true, upside: 72, targetShare: 14.8, injuryStatus: null, availability: "Active", imageUrl: null, consistency: 67, adp: 142.3, dynastyValue: 61, efficiency: 6.9, sustainability: 66, marketValue: 58, confidence: 71, age: 25, experience: 4, lastUpdated: new Date(), premiumDataUpdated: null },
    ];

    samplePlayers.forEach(player => {
      this.players.set(player.id, player);
    });
    this.currentPlayerId = 12;

    // Add players to team
    const teamPlayerRelations: TeamPlayer[] = [
      { id: 1, teamId: 1, playerId: 1, isStarter: true }, // Josh Allen
      { id: 2, teamId: 1, playerId: 2, isStarter: true }, // Ezekiel Elliott
      { id: 3, teamId: 1, playerId: 3, isStarter: true }, // Dameon Pierce
      { id: 4, teamId: 1, playerId: 4, isStarter: true }, // Tyreek Hill
      { id: 5, teamId: 1, playerId: 5, isStarter: true }, // Mike Evans
      { id: 6, teamId: 1, playerId: 6, isStarter: true }, // Cole Kmet
    ];

    teamPlayerRelations.forEach(rel => {
      this.teamPlayers.set(rel.id, rel);
    });
    this.currentTeamPlayerId = 7;

    // Position analysis
    const analyses: PositionAnalysis[] = [
      { id: 1, teamId: 1, position: "QB", strengthScore: 89, status: "good", weeklyAverage: 23.4, leagueAverage: 19.2 },
      { id: 2, teamId: 1, position: "RB", strengthScore: 34, status: "critical", weeklyAverage: 10.0, leagueAverage: 14.5 },
      { id: 3, teamId: 1, position: "WR", strengthScore: 85, status: "good", weeklyAverage: 17.5, leagueAverage: 15.8 },
      { id: 4, teamId: 1, position: "TE", strengthScore: 62, status: "warning", weeklyAverage: 9.4, leagueAverage: 10.2 },
    ];

    analyses.forEach(analysis => {
      this.positionAnalyses.set(analysis.id, analysis);
    });
    this.currentPositionAnalysisId = 5;

    // Weekly performance
    const performances: WeeklyPerformance[] = [
      { id: 1, teamId: 1, week: 1, points: 156.8, projectedPoints: 148.3 },
      { id: 2, teamId: 1, week: 2, points: 201.3, projectedPoints: 155.7 },
      { id: 3, teamId: 1, week: 3, points: 134.2, projectedPoints: 149.1 },
      { id: 4, teamId: 1, week: 4, points: 178.5, projectedPoints: 152.4 },
      { id: 5, teamId: 1, week: 5, points: 98.7, projectedPoints: 147.8 },
      { id: 6, teamId: 1, week: 6, points: 165.4, projectedPoints: 151.2 },
      { id: 7, teamId: 1, week: 7, points: 172.9, projectedPoints: 153.6 },
      { id: 8, teamId: 1, week: 8, points: 159.1, projectedPoints: 150.9 },
    ];

    performances.forEach(perf => {
      this.weeklyPerformances.set(perf.id, perf);
    });
    this.currentWeeklyPerformanceId = 9;
  }

  async getTeam(id: number): Promise<Team | undefined> {
    return this.teams.get(id);
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const id = this.currentTeamId++;
    const newTeam: Team = { ...team, id };
    this.teams.set(id, newTeam);
    return newTeam;
  }

  async updateTeam(teamId: number, updates: Partial<InsertTeam>): Promise<void> {
    const team = this.teams.get(teamId);
    if (team) {
      Object.assign(team, updates);
      this.teams.set(teamId, team);
    }
  }

  async updateTeamSync(teamId: number, syncData: {
    syncPlatform?: string | null;
    syncLeagueId?: string | null;
    syncTeamId?: string | null;
    lastSyncDate?: Date | null;
    syncEnabled?: boolean | null;
  }): Promise<void> {
    const team = this.teams.get(teamId);
    if (team) {
      Object.assign(team, syncData);
      this.teams.set(teamId, team);
    }
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getAvailablePlayers(position?: string): Promise<Player[]> {
    return Array.from(this.players.values())
      .filter(player => player.isAvailable && (!position || player.position === position));
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const id = this.currentPlayerId++;
    const newPlayer: Player = { 
      ...player, 
      id,
      isAvailable: player.isAvailable ?? true 
    };
    this.players.set(id, newPlayer);
    return newPlayer;
  }

  async getTeamPlayers(teamId: number): Promise<(Player & { isStarter: boolean })[]> {
    const teamPlayerIds = Array.from(this.teamPlayers.values())
      .filter(tp => tp.teamId === teamId);
    
    return teamPlayerIds
      .map(tp => {
        const player = this.players.get(tp.playerId);
        if (player) {
          return { ...player, isStarter: tp.isStarter };
        }
        return null;
      })
      .filter((player): player is (Player & { isStarter: boolean }) => player !== null);
  }

  async addPlayerToTeam(teamPlayer: InsertTeamPlayer): Promise<TeamPlayer> {
    const id = this.currentTeamPlayerId++;
    const newTeamPlayer: TeamPlayer = { 
      ...teamPlayer, 
      id,
      isStarter: teamPlayer.isStarter ?? false 
    };
    this.teamPlayers.set(id, newTeamPlayer);
    return newTeamPlayer;
  }

  async getPositionAnalysis(teamId: number): Promise<PositionAnalysis[]> {
    return Array.from(this.positionAnalyses.values())
      .filter(analysis => analysis.teamId === teamId);
  }

  async createPositionAnalysis(analysis: InsertPositionAnalysis): Promise<PositionAnalysis> {
    const id = this.currentPositionAnalysisId++;
    const newAnalysis: PositionAnalysis = { ...analysis, id };
    this.positionAnalyses.set(id, newAnalysis);
    return newAnalysis;
  }

  async getWeeklyPerformance(teamId: number): Promise<WeeklyPerformance[]> {
    return Array.from(this.weeklyPerformances.values())
      .filter(perf => perf.teamId === teamId)
      .sort((a, b) => a.week - b.week);
  }

  async createWeeklyPerformance(performance: InsertWeeklyPerformance): Promise<WeeklyPerformance> {
    const id = this.currentWeeklyPerformanceId++;
    const newPerformance: WeeklyPerformance = { ...performance, id };
    this.weeklyPerformances.set(id, newPerformance);
    return newPerformance;
  }

  async getPlayerRecommendations(teamId: number, position?: string): Promise<Player[]> {
    const availablePlayers = await this.getAvailablePlayers(position);
    
    // Sort by upside potential and average points
    return availablePlayers
      .sort((a, b) => (b.upside + b.avgPoints) - (a.upside + a.avgPoints))
      .slice(0, 10); // Return top 10 recommendations
  }
}

export class DatabaseStorage implements IStorage {
  private async seedData() {
    // Check if data already exists
    const existingTeams = await db.select().from(teams);
    if (existingTeams.length > 0) return;

    console.log("Seeding database with real NFL data from SportsDataIO...");

    try {
      // Fetch real player data from SportsDataIO
      console.log("Fetching active players from SportsDataIO...");
      const sportsDataPlayers = await sportsDataAPI.getActivePlayers();
      console.log(`Fetched ${sportsDataPlayers.length} players from SportsDataIO`);

      // Filter to fantasy-relevant players and limit for free tier
      const fantasyPlayers = sportsDataPlayers
        .filter(p => p.FantasyPosition && ["QB", "RB", "WR", "TE", "K", "DST"].includes(p.FantasyPosition))
        .filter(p => p.Team && p.Active) // Only active players with teams
        .slice(0, 150); // Limit for free tier API calls

      console.log(`Filtered to ${fantasyPlayers.length} fantasy-relevant players`);

      // Convert to our schema format
      const playerData = fantasyPlayers.map(player => sportsDataAPI.convertToPlayer(player));
      
      // Insert players into database
      const insertedPlayers = await db.insert(players).values(playerData).returning();
      console.log(`Inserted ${insertedPlayers.length} players into database`);

    } catch (error) {
      console.error("Failed to fetch SportsDataIO data, using fallback:", error);
      // Fall back to minimal sample data if API fails
      const fallbackData = [
        { 
          name: "Josh Allen", team: "BUF", position: "QB", avgPoints: 23.4, projectedPoints: 23.4, 
          ownershipPercentage: 95, isAvailable: false, upside: 8.9, injuryStatus: "Healthy",
          availability: "Available", consistency: 85.0, matchupRating: 8.5, trend: "up", 
          ownership: 95, targetShare: null, redZoneTargets: null, carries: null, snapCount: null, externalId: "1001"
        },
        { 
          name: "Derrick Henry", team: "BAL", position: "RB", avgPoints: 18.2, projectedPoints: 18.2, 
          ownershipPercentage: 87, isAvailable: true, upside: 9.5, injuryStatus: "Healthy",
          availability: "Available", consistency: 82.0, matchupRating: 7.8, trend: "up", 
          ownership: 87, targetShare: null, redZoneTargets: null, carries: 285, snapCount: 892, externalId: "1002"
        },
        { 
          name: "Tyreek Hill", team: "MIA", position: "WR", avgPoints: 18.7, projectedPoints: 18.7, 
          ownershipPercentage: 98, isAvailable: true, upside: 8.5, injuryStatus: "Healthy",
          availability: "Available", consistency: 78.0, matchupRating: 9.2, trend: "up", 
          ownership: 98, targetShare: 25.5, redZoneTargets: 12, carries: null, snapCount: 1024, externalId: "1003"
        },
        { 
          name: "Travis Kelce", team: "KC", position: "TE", avgPoints: 14.4, projectedPoints: 14.4, 
          ownershipPercentage: 92, isAvailable: true, upside: 7.8, injuryStatus: "Healthy",
          availability: "Available", consistency: 88.0, matchupRating: 8.1, trend: "up", 
          ownership: 92, targetShare: 18.5, redZoneTargets: 8, carries: null, snapCount: 856, externalId: "1004"
        },
      ];
      await db.insert(players).values(fallbackData);
    }

    // Create sample team
    const [team] = await db.insert(teams).values({
      name: "Lightning Bolts",
      ownerId: "user1", 
      leagueName: "Championship Division",
      record: "6-2",
      leagueRank: 3,
      totalPoints: 1247,
      healthScore: 78
    }).returning();

    // Get some players to assign to the team
    const availablePlayers = await db.select().from(players).limit(6);

    if (availablePlayers.length > 0) {
      // Add players to team (starters only)
      const teamPlayerData = availablePlayers.slice(0, 6).map((player, index) => ({
        teamId: team.id,
        playerId: player.id,
        isStarter: true
      }));

      await db.insert(teamPlayers).values(teamPlayerData);
    }

    // Position analysis
    const analysisData = [
      { teamId: team.id, position: "QB", strengthScore: 89, status: "good", weeklyAverage: 23.4, leagueAverage: 19.2 },
      { teamId: team.id, position: "RB", strengthScore: 34, status: "critical", weeklyAverage: 10.0, leagueAverage: 14.5 },
      { teamId: team.id, position: "WR", strengthScore: 85, status: "good", weeklyAverage: 17.5, leagueAverage: 15.8 },
      { teamId: team.id, position: "TE", strengthScore: 62, status: "warning", weeklyAverage: 9.4, leagueAverage: 10.2 },
    ];

    await db.insert(positionAnalysis).values(analysisData);

    // Weekly performance
    const performanceData = [
      { teamId: team.id, week: 1, points: 156.8, projectedPoints: 148.3 },
      { teamId: team.id, week: 2, points: 201.3, projectedPoints: 155.7 },
      { teamId: team.id, week: 3, points: 134.2, projectedPoints: 149.1 },
      { teamId: team.id, week: 4, points: 178.5, projectedPoints: 152.4 },
      { teamId: team.id, week: 5, points: 98.7, projectedPoints: 147.8 },
      { teamId: team.id, week: 6, points: 165.4, projectedPoints: 151.2 },
      { teamId: team.id, week: 7, points: 172.9, projectedPoints: 153.6 },
      { teamId: team.id, week: 8, points: 159.1, projectedPoints: 150.9 },
    ];

    await db.insert(weeklyPerformance).values(performanceData);
  }

  constructor() {
    this.seedData().catch(console.error);
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team || undefined;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db
      .insert(teams)
      .values(team)
      .returning();
    return newTeam;
  }

  async updateTeam(teamId: number, updates: Partial<InsertTeam>): Promise<void> {
    await db
      .update(teams)
      .set(updates)
      .where(eq(teams.id, teamId));
  }

  async updateTeamSync(teamId: number, syncData: {
    syncPlatform?: string | null;
    syncLeagueId?: string | null;
    syncTeamId?: string | null;
    lastSyncDate?: Date | null;
    syncEnabled?: boolean | null;
  }): Promise<void> {
    await db
      .update(teams)
      .set(syncData)
      .where(eq(teams.id, teamId));
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player || undefined;
  }

  async getAllPlayers(): Promise<Player[]> {
    return await db.select().from(players);
  }

  async getAvailablePlayers(position?: string): Promise<Player[]> {
    if (position) {
      return await db
        .select()
        .from(players)
        .where(and(eq(players.isAvailable, true), eq(players.position, position)));
    }
    
    return await db
      .select()
      .from(players)
      .where(eq(players.isAvailable, true));
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [newPlayer] = await db
      .insert(players)
      .values(player)
      .returning();
    return newPlayer;
  }

  async getTeamPlayers(teamId: number): Promise<(Player & { isStarter: boolean })[]> {
    const result = await db
      .select({
        id: players.id,
        name: players.name,
        team: players.team,
        position: players.position,
        avgPoints: players.avgPoints,
        projectedPoints: players.projectedPoints,
        ownershipPercentage: players.ownershipPercentage,
        isAvailable: players.isAvailable,
        upside: players.upside,
        isStarter: teamPlayers.isStarter,
      })
      .from(teamPlayers)
      .innerJoin(players, eq(teamPlayers.playerId, players.id))
      .where(eq(teamPlayers.teamId, teamId));

    return result;
  }

  async addPlayerToTeam(teamPlayer: InsertTeamPlayer): Promise<TeamPlayer> {
    const [newTeamPlayer] = await db
      .insert(teamPlayers)
      .values(teamPlayer)
      .returning();
    return newTeamPlayer;
  }

  async getPositionAnalysis(teamId: number): Promise<PositionAnalysis[]> {
    return await db
      .select()
      .from(positionAnalysis)
      .where(eq(positionAnalysis.teamId, teamId));
  }

  async createPositionAnalysis(analysis: InsertPositionAnalysis): Promise<PositionAnalysis> {
    const [newAnalysis] = await db
      .insert(positionAnalysis)
      .values(analysis)
      .returning();
    return newAnalysis;
  }

  async getWeeklyPerformance(teamId: number): Promise<WeeklyPerformance[]> {
    return await db
      .select()
      .from(weeklyPerformance)
      .where(eq(weeklyPerformance.teamId, teamId))
      .orderBy(weeklyPerformance.week);
  }

  async createWeeklyPerformance(performance: InsertWeeklyPerformance): Promise<WeeklyPerformance> {
    const [newPerformance] = await db
      .insert(weeklyPerformance)
      .values(performance)
      .returning();
    return newPerformance;
  }

  async getPlayerRecommendations(teamId: number, position?: string): Promise<Player[]> {
    let result: Player[];
    
    if (position) {
      result = await db
        .select()
        .from(players)
        .where(and(eq(players.isAvailable, true), eq(players.position, position)));
    } else {
      result = await db
        .select()
        .from(players)
        .where(eq(players.isAvailable, true));
    }
    
    return result
      .sort((a: Player, b: Player) => (b.upside + b.avgPoints) - (a.upside + a.avgPoints))
      .slice(0, 10);
  }

  async updatePlayerPremiumAnalytics(playerId: number, premiumData: any): Promise<void> {
    await db
      .update(players)
      .set(premiumData)
      .where(eq(players.id, playerId));
  }
}

export const storage = new DatabaseStorage();
