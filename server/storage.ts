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

    // Create sample players
    const samplePlayers: Player[] = [
      // Starting lineup
      { id: 1, name: "Josh Allen", team: "BUF", position: "QB", avgPoints: 23.4, projectedPoints: 23.4, ownershipPercentage: 95, isAvailable: false, upside: 89 },
      { id: 2, name: "Ezekiel Elliott", team: "NE", position: "RB", avgPoints: 8.2, projectedPoints: 8.2, ownershipPercentage: 45, isAvailable: false, upside: 34 },
      { id: 3, name: "Dameon Pierce", team: "HOU", position: "RB", avgPoints: 11.8, projectedPoints: 11.8, ownershipPercentage: 67, isAvailable: false, upside: 42 },
      { id: 4, name: "Tyreek Hill", team: "MIA", position: "WR", avgPoints: 18.7, projectedPoints: 18.7, ownershipPercentage: 98, isAvailable: false, upside: 95 },
      { id: 5, name: "Mike Evans", team: "TB", position: "WR", avgPoints: 16.3, projectedPoints: 16.3, ownershipPercentage: 89, isAvailable: false, upside: 87 },
      { id: 6, name: "Cole Kmet", team: "CHI", position: "TE", avgPoints: 9.4, projectedPoints: 9.4, ownershipPercentage: 34, isAvailable: false, upside: 62 },
      
      // Available players
      { id: 7, name: "Gus Edwards", team: "BAL", position: "RB", avgPoints: 12.4, projectedPoints: 12.4, ownershipPercentage: 47, isAvailable: true, upside: 78 },
      { id: 8, name: "Logan Thomas", team: "WAS", position: "TE", avgPoints: 8.9, projectedPoints: 8.9, ownershipPercentage: 23, isAvailable: true, upside: 65 },
      { id: 9, name: "Roschon Johnson", team: "CHI", position: "RB", avgPoints: 9.8, projectedPoints: 9.8, ownershipPercentage: 15, isAvailable: true, upside: 72 },
      { id: 10, name: "Tyler Higbee", team: "LAR", position: "TE", avgPoints: 7.2, projectedPoints: 7.2, ownershipPercentage: 12, isAvailable: true, upside: 58 },
      { id: 11, name: "Jerome Ford", team: "CLE", position: "RB", avgPoints: 10.5, projectedPoints: 10.5, ownershipPercentage: 35, isAvailable: true, upside: 69 },
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
