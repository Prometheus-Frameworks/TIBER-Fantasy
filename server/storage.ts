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
  playerIdentityMap,
  ingestPayloads,
  marketSignals,
  injuries,
  depthCharts,
  weeklyStats,
  playerUsage,
  wrRoleBank,
  rbRoleBank,
  teRoleBank,
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
import { db } from "./infra/db";
import { eq, and, desc, sql } from "drizzle-orm";
// Note: sportsDataAPI import removed - not used in current implementation

// UPH Types (inferred from new schema tables)
type PlayerIdentityMap = typeof playerIdentityMap.$inferSelect;
type IngestPayload = typeof ingestPayloads.$inferSelect;
type MarketSignal = typeof marketSignals.$inferSelect;
type Injury = typeof injuries.$inferSelect;
type DepthChart = typeof depthCharts.$inferSelect;

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
  getPlayer(id: string | number): Promise<Player | undefined>;
  getPlayerByExternalId(externalId: string): Promise<Player | undefined>;
  getPlayerBySleeperIdFromMemory(sleeperId: string): Promise<Player | undefined>;
  getAllPlayers(): Promise<Player[]>;
  getAvailablePlayers(position?: string): Promise<Player[]>;
  searchPlayers(query: string, limit?: number): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: number, updates: Partial<InsertPlayer>): Promise<Player>;
  
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
  
  // UPH - Player Identity Map operations
  getPlayerIdentityByCanonicalId(canonicalId: string): Promise<PlayerIdentityMap | undefined>;
  getPlayerIdentityBySleeperId(sleeperId: string): Promise<PlayerIdentityMap | undefined>;
  getPlayerIdentityByExternalId(platform: string, externalId: string): Promise<PlayerIdentityMap | undefined>;
  
  // UPH - Bronze Layer operations
  createIngestPayload(payload: Partial<IngestPayload>): Promise<IngestPayload>;
  getIngestPayload(id: number): Promise<IngestPayload | undefined>;
  getRawPayloads(filters?: {
    source?: string;
    status?: string;
    season?: number;
    week?: number;
    jobId?: string;
    endpoint?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<IngestPayload[]>;
  updatePayloadStatus(payloadId: number, status: string, errorMessage?: string): Promise<void>;
  updateBatchPayloadStatus(payloadIds: number[], status: string): Promise<void>;
  getDataSourceStats(source?: string): Promise<Array<{
    source: string;
    totalPayloads: number;
    successfulPayloads: number;
    failedPayloads: number;
    pendingPayloads: number;
    processingPayloads: number;
    lastIngestDate: Date | null;
    avgPayloadSize: number;
  }>>;
  purgeOldPayloads(source: string, cutoffDate: Date): Promise<{ deletedCount: number }>;
  checkPayloadDuplicate(source: string, checksum: string): Promise<IngestPayload | undefined>;
  
  // UPH - Silver Layer operations
  createMarketSignal(signal: Partial<MarketSignal>): Promise<MarketSignal>;
  getMarketSignals(canonicalPlayerId: string, signalType?: string): Promise<MarketSignal[]>;
  
  createInjury(injury: Partial<Injury>): Promise<Injury>;
  getInjuries(canonicalPlayerId: string): Promise<Injury[]>;
  
  createDepthChart(depthChart: Partial<DepthChart>): Promise<DepthChart>;
  getDepthChart(canonicalPlayerId: string): Promise<DepthChart[]>;
  
  // Weekly Stats operations
  upsertWeeklyStats(stats: any[]): Promise<{ inserted: number; updated: number }>;
  getWeeklyStats(filters: {
    season: number;
    week?: number;
    playerId?: string;
    position?: string;
  }): Promise<any[]>;
  getPlayerWeeklyStats(playerId: string, season: number): Promise<any[]>;
  getSeasonTotals(season: number, scoring?: 'std' | 'half' | 'ppr'): Promise<any[]>;
  
  // WR Role Bank operations
  upsertWRRoleBank(roleRow: any): Promise<void>;
  getWRRoleBank(filters: {
    season?: number;
    playerId?: string;
    roleTier?: string;
  }): Promise<any[]>;
  getWRRoleBankByPlayer(playerId: string, season: number): Promise<any | null>;
  getWeeklyUsageForRoleBank(playerId: string, season: number): Promise<any[]>;
  
  // RB Role Bank operations
  upsertRBRoleBank(roleRow: any): Promise<void>;
  getRBRoleBank(filters: {
    season?: number;
    playerId?: string;
    roleTier?: string;
  }): Promise<any[]>;
  getRBRoleBankByPlayer(playerId: string, season: number): Promise<any | null>;
  getWeeklyUsageForRBRoleBank(playerId: string, season: number): Promise<any[]>;
  
  // TE Role Bank operations
  upsertTERoleBank(roleRow: any): Promise<void>;
  getTERoleBank(filters: {
    season?: number;
    playerId?: string;
    roleTier?: string;
  }): Promise<any[]>;
  getTERoleBankByPlayer(playerId: string, season: number): Promise<any | null>;
  getWeeklyUsageForTERoleBank(playerId: string, season: number): Promise<any[]>;
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
      healthScore: 78,
      syncPlatform: null as string | null,
      syncLeagueId: null as string | null,
      syncTeamId: null as string | null,
      lastSyncDate: null as Date | null,
      syncEnabled: null as boolean | null
    };
    this.teams.set(1, team);
    this.currentTeamId = 2;

    // Create comprehensive NFL player database (schema-compatible)
    const samplePlayers: Player[] = [
      // Elite QBs - fully schema-compatible
      { 
        id: 1, name: "Josh Allen", team: "BUF", position: "QB", avgPoints: 23.4, projectedPoints: 24.1, 
        ownershipPercentage: 98, isAvailable: false, upside: 89, injuryStatus: "Healthy", availability: "Available", 
        imageUrl: null, consistency: 87, matchupRating: null, trend: null, ownership: null, targetShare: null, 
        redZoneTargets: null, carries: null, snapCount: null, externalId: null,
        // Required schema fields
        status: "Active", fullName: "Josh Allen", firstName: "Josh", lastName: "Allen", sleeperId: "josh_allen_buf", 
        jerseyNumber: 17, age: 28, yearsExp: 7, height: "6'5\"", weight: 237, college: "Wyoming", birthCountry: "US",
        depthChartPosition: "QB", depthChartOrder: 1, espnId: null, yahooId: null, rotowireId: null, fantasyDataId: null,
        adp: 2.3, positionalADP: "QB1", adpMissing: false, adpLastUpdated: new Date(), adpSource: "sleeper", dynastyValue: 95,
        // FPG-centric scoring
        fpg: 23.4, xFpg: 24.1, projFpg: 24.0, upsideIndex: 89, upsideBoost: 5.2, fpgTrend: "stable", fpgVariance: 6.8,
        explosivePlays: 12, redZoneOpportunity: 2.1, expectedPoints: 23.4, floorPoints: 16.6, ceilingPoints: 30.2, 
        ragScore: 95, ragColor: "GREEN", beatProj: 68, features: null, draftYear: 2018, draftRound: 1, draftPick: 7, 
        rosteredPct: 98, active: true,
        // Missing required properties
        rank: 1, dynastyRank: 2, startupDraftable: true
      },
      // Simplified other players with minimal required fields
      { 
        id: 2, name: "Lamar Jackson", team: "BAL", position: "QB", avgPoints: 22.8, projectedPoints: 23.2, 
        ownershipPercentage: 97, isAvailable: false, upside: 92, injuryStatus: "Healthy", availability: "Available", 
        imageUrl: null, consistency: 84, matchupRating: null, trend: null, ownership: null, targetShare: null, 
        redZoneTargets: null, carries: null, snapCount: null, externalId: null,
        status: "Active", fullName: "Lamar Jackson", firstName: "Lamar", lastName: "Jackson", sleeperId: "lamar_jackson", 
        jerseyNumber: 8, age: 27, yearsExp: 7, height: "6'2\"", weight: 212, college: "Louisville", birthCountry: "US",
        depthChartPosition: "QB", depthChartOrder: 1, espnId: null, yahooId: null, rotowireId: null, fantasyDataId: null,
        adp: 3.1, positionalADP: "QB2", adpMissing: false, adpLastUpdated: new Date(), adpSource: "sleeper", dynastyValue: 89,
        fpg: 22.8, xFpg: 23.2, projFpg: 23.0, upsideIndex: 92, upsideBoost: 4.8, fpgTrend: "stable", fpgVariance: 7.2,
        explosivePlays: 15, redZoneOpportunity: 1.8, expectedPoints: 22.8, floorPoints: 15.6, ceilingPoints: 30.0, 
        ragScore: 93, ragColor: "GREEN", beatProj: 65, features: null, draftYear: 2018, draftRound: 1, draftPick: 32, 
        rosteredPct: 97, active: true,
        // Missing required properties
        rank: 3, dynastyRank: 4, startupDraftable: true
      },
      // Sample minimal players for other positions
      { 
        id: 50, name: "Christian McCaffrey", team: "SF", position: "RB", avgPoints: 19.8, projectedPoints: 18.9, 
        ownershipPercentage: 99, isAvailable: false, upside: 87, injuryStatus: "Healthy", availability: "Available", 
        imageUrl: null, consistency: 91, matchupRating: null, trend: null, ownership: null, targetShare: 12.5, 
        redZoneTargets: null, carries: 285, snapCount: null, externalId: null,
        status: "Active", fullName: "Christian McCaffrey", firstName: "Christian", lastName: "McCaffrey", sleeperId: "c_mccaffrey", 
        jerseyNumber: 23, age: 28, yearsExp: 7, height: "5'11\"", weight: 205, college: "Stanford", birthCountry: "US",
        depthChartPosition: "RB", depthChartOrder: 1, espnId: null, yahooId: null, rotowireId: null, fantasyDataId: null,
        adp: 1.2, positionalADP: "RB1", adpMissing: false, adpLastUpdated: new Date(), adpSource: "sleeper", dynastyValue: 84,
        fpg: 19.8, xFpg: 18.9, projFpg: 19.5, upsideIndex: 87, upsideBoost: 3.2, fpgTrend: "stable", fpgVariance: 5.8,
        explosivePlays: 8, redZoneOpportunity: 1.5, expectedPoints: 19.8, floorPoints: 14.0, ceilingPoints: 25.6, 
        ragScore: 91, ragColor: "GREEN", beatProj: 72, features: null, draftYear: 2017, draftRound: 1, draftPick: 8, 
        rosteredPct: 99, active: true,
        // Missing required properties
        rank: 2, dynastyRank: 15, startupDraftable: true
      }
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
    const newTeam: Team = { 
      ...team, 
      id,
      syncPlatform: team.syncPlatform ?? null,
      syncLeagueId: team.syncLeagueId ?? null,
      syncTeamId: team.syncTeamId ?? null,
      lastSyncDate: team.lastSyncDate ?? null,
      syncEnabled: team.syncEnabled ?? null
    };
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

  async getPlayer(id: string | number): Promise<Player | undefined> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    return this.players.get(numericId);
  }

  async getAvailablePlayers(position?: string): Promise<Player[]> {
    // Return full Player objects that match the interface requirements
    const availablePlayers = Array.from(this.players.values())
      .filter(player => player.isAvailable && (!position || player.position === position));
    
    // Ensure all required properties are present
    return availablePlayers.map(player => ({
      ...player,
      status: player.status ?? null,
      fullName: player.fullName ?? null,
      firstName: player.firstName ?? null,
      lastName: player.lastName ?? null,
      sleeperId: player.sleeperId ?? null,
      espnId: player.espnId ?? null,
      yahooId: player.yahooId ?? null,
      rotowireId: player.rotowireId ?? null,
      fantasyDataId: player.fantasyDataId ?? null,
      rank: player.rank ?? null,
      dynastyRank: player.dynastyRank ?? null,
      startupDraftable: player.startupDraftable ?? null
    }));
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const id = this.currentPlayerId++;
    const newPlayer: Player = { 
      ...player, 
      id,
      isAvailable: player.isAvailable ?? true,
      status: player.status ?? null,
      fullName: player.fullName ?? null,
      firstName: player.firstName ?? null,
      lastName: player.lastName ?? null,
      sleeperId: player.sleeperId ?? null,
      espnId: player.espnId ?? null,
      yahooId: player.yahooId ?? null,
      rotowireId: player.rotowireId ?? null,
      fantasyDataId: player.fantasyDataId ?? null,
      rank: player.rank ?? null,
      dynastyRank: player.dynastyRank ?? null,
      startupDraftable: player.startupDraftable ?? null,
      jerseyNumber: player.jerseyNumber ?? null,
      age: player.age ?? null,
      yearsExp: player.yearsExp ?? null,
      height: player.height ?? null,
      weight: player.weight ?? null,
      college: player.college ?? null,
      birthCountry: player.birthCountry ?? null,
      injuryStatus: player.injuryStatus ?? null,
      availability: player.availability ?? null,
      depthChartPosition: player.depthChartPosition ?? null,
      depthChartOrder: player.depthChartOrder ?? null,
      imageUrl: player.imageUrl ?? null,
      consistency: player.consistency ?? null,
      matchupRating: player.matchupRating ?? null,
      trend: player.trend ?? null,
      ownership: player.ownership ?? null,
      targetShare: player.targetShare ?? null,
      redZoneTargets: player.redZoneTargets ?? null,
      carries: player.carries ?? null,
      snapCount: player.snapCount ?? null,
      externalId: player.externalId ?? null
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

  // Missing IStorage interface methods - stubbed implementations
  async getPlayerByExternalId(externalId: string): Promise<Player | undefined> {
    return Array.from(this.players.values()).find(player => player.externalId === externalId);
  }

  async getPlayerBySleeperIdFromMemory(sleeperId: string): Promise<Player | undefined> {
    return Array.from(this.players.values()).find(player => player.sleeperId === sleeperId);
  }

  async getAllPlayers(): Promise<Player[]> {
    return Array.from(this.players.values());
  }

  async searchPlayers(query: string, limit: number = 10): Promise<Player[]> {
    return Array.from(this.players.values())
      .filter(player => player.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);
  }

  async updatePlayer(id: number, updates: Partial<InsertPlayer>): Promise<Player> {
    const player = this.players.get(id);
    if (!player) throw new Error(`Player with id ${id} not found`);
    
    const updatedPlayer = { ...player, ...updates };
    this.players.set(id, updatedPlayer);
    return updatedPlayer;
  }

  // Advanced Analytics - stubbed implementations
  async createMatchupAnalysis(analysis: InsertMatchupAnalysis): Promise<MatchupAnalysis> {
    const id = Date.now(); // Simple ID generation
    const newAnalysis: MatchupAnalysis = { 
      ...analysis, 
      id, 
      createdAt: new Date(),
      projectedPoints: analysis.projectedPoints ?? null,
      defenseRank: analysis.defenseRank ?? null,
      weatherImpact: analysis.weatherImpact ?? null,
      isHome: analysis.isHome ?? null
    };
    return newAnalysis;
  }

  async getMatchupAnalysis(playerId: number, week: number): Promise<MatchupAnalysis | undefined> {
    // Stub implementation - return undefined for now
    return undefined;
  }

  async createLineupOptimization(optimization: InsertLineupOptimization): Promise<LineupOptimization> {
    const id = Date.now();
    const newOptimization: LineupOptimization = { 
      ...optimization, 
      id, 
      createdAt: new Date(),
      confidence: optimization.confidence ?? null,
      factors: optimization.factors ?? null
    };
    return newOptimization;
  }

  async getLineupOptimization(teamId: number, week: number): Promise<LineupOptimization | undefined> {
    return undefined;
  }

  async createTradeAnalysis(analysis: InsertTradeAnalysis): Promise<TradeAnalysis> {
    const id = Date.now();
    const newAnalysis: TradeAnalysis = { 
      ...analysis, 
      id, 
      createdAt: new Date(),
      tradeValue: analysis.tradeValue ?? null,
      recommendation: analysis.recommendation ?? null,
      reasoning: analysis.reasoning ?? null
    };
    return newAnalysis;
  }

  async getTradeAnalysis(teamId: number): Promise<TradeAnalysis[]> {
    return [];
  }

  async createWaiverRecommendations(recommendation: InsertWaiverRecommendations): Promise<WaiverRecommendations> {
    const id = Date.now();
    const newRecommendation: WaiverRecommendations = { 
      ...recommendation, 
      id, 
      createdAt: new Date(),
      projectedImpact: recommendation.projectedImpact ?? null,
      usageTrend: recommendation.usageTrend ?? null
    };
    return newRecommendation;
  }

  async getWaiverRecommendations(teamId: number): Promise<WaiverRecommendations[]> {
    return [];
  }

  async createInjuryTracker(injury: InsertInjuryTracker): Promise<InjuryTracker> {
    const id = Date.now();
    const newInjury: InjuryTracker = { 
      ...injury, 
      id, 
      createdAt: new Date(), 
      updatedAt: new Date(),
      injuryType: injury.injuryType ?? null,
      severity: injury.severity ?? null,
      expectedReturn: injury.expectedReturn ?? null,
      impactDescription: injury.impactDescription ?? null,
      replacementSuggestions: injury.replacementSuggestions ?? null
    };
    return newInjury;
  }

  async getInjuryTracker(playerId: number): Promise<InjuryTracker | undefined> {
    return undefined;
  }

  async updateInjuryTracker(playerId: number, updates: Partial<InsertInjuryTracker>): Promise<void> {
    // Stub implementation - no-op for now
  }

  async updatePlayerPremiumAnalytics(playerId: number, premiumData: any): Promise<void> {
    const player = this.players.get(playerId);
    if (player) {
      Object.assign(player, premiumData);
      this.players.set(playerId, player);
    }
  }

  // UPH - Player Identity Map operations (stubbed)
  async getPlayerIdentityByCanonicalId(canonicalId: string): Promise<PlayerIdentityMap | undefined> {
    return undefined;
  }

  async getPlayerIdentityBySleeperId(sleeperId: string): Promise<PlayerIdentityMap | undefined> {
    return undefined;
  }

  async getPlayerIdentityByExternalId(platform: string, externalId: string): Promise<PlayerIdentityMap | undefined> {
    return undefined;
  }

  // UPH - Bronze Layer operations (stubbed)
  async createIngestPayload(payload: Partial<IngestPayload>): Promise<IngestPayload> {
    const id = Date.now();
    const newPayload: IngestPayload = {
      id,
      source: payload.source || "manual",
      endpoint: payload.endpoint || "",
      payload: payload.payload || {},
      version: payload.version || "1.0",
      jobId: payload.jobId || "stub",
      season: payload.season || 2024,
      week: payload.week || null,
      status: payload.status || "SUCCESS",
      recordCount: payload.recordCount || null,
      errorMessage: payload.errorMessage || null,
      checksumHash: payload.checksumHash || null,
      ingestedAt: payload.ingestedAt || new Date(),
      processedAt: payload.processedAt || null
    };
    return newPayload;
  }

  async getIngestPayload(id: number): Promise<IngestPayload | undefined> {
    return undefined;
  }

  // Missing UPH Bronze Layer interface methods (stubbed)
  async getRawPayloads(filters?: {
    source?: string;
    status?: string;
    season?: number;
    week?: number;
    jobId?: string;
    endpoint?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<IngestPayload[]> {
    return [];
  }

  async updatePayloadStatus(payloadId: number, status: string, errorMessage?: string): Promise<void> {
    // Stub implementation - no-op for memory storage
  }

  async updateBatchPayloadStatus(payloadIds: number[], status: string): Promise<void> {
    // Stub implementation - no-op for memory storage
  }

  async getDataSourceStats(source?: string): Promise<Array<{
    source: string;
    totalPayloads: number;
    successfulPayloads: number;
    failedPayloads: number;
    pendingPayloads: number;
    processingPayloads: number;
    lastIngestDate: Date | null;
    avgPayloadSize: number;
  }>> {
    return [];
  }

  async purgeOldPayloads(source: string, cutoffDate: Date): Promise<{ deletedCount: number }> {
    return { deletedCount: 0 };
  }

  async checkPayloadDuplicate(source: string, checksum: string): Promise<IngestPayload | undefined> {
    return undefined;
  }

  // UPH - Silver Layer operations (stubbed)
  async createMarketSignal(signal: Partial<MarketSignal>): Promise<MarketSignal> {
    const id = Date.now();
    const newSignal: MarketSignal = {
      id,
      canonicalPlayerId: signal.canonicalPlayerId || "",
      source: signal.source || "manual",
      signalType: signal.signalType || "adp",
      overallRank: signal.overallRank || null,
      positionalRank: signal.positionalRank || null,
      value: signal.value || null,
      season: signal.season || 2024,
      week: signal.week || null,
      leagueFormat: signal.leagueFormat || null,
      scoringFormat: signal.scoringFormat || null,
      sampleSize: signal.sampleSize || null,
      confidence: signal.confidence || 0.8,
      dataQuality: signal.dataQuality || "MEDIUM",
      extractedAt: signal.extractedAt || new Date(),
      validFrom: signal.validFrom || new Date(),
      validTo: signal.validTo || null,
      createdAt: signal.createdAt || new Date()
    };
    return newSignal;
  }

  async getMarketSignals(canonicalPlayerId: string, signalType?: string): Promise<MarketSignal[]> {
    return [];
  }

  async createInjury(injury: Partial<Injury>): Promise<Injury> {
    const id = Date.now();
    const newInjury: Injury = {
      id,
      canonicalPlayerId: injury.canonicalPlayerId || "",
      injuryType: injury.injuryType || null,
      bodyPart: injury.bodyPart || null,
      severity: injury.severity || null,
      status: injury.status || "healthy",
      practiceStatus: injury.practiceStatus || null,
      injuryDate: injury.injuryDate || null,
      expectedReturn: injury.expectedReturn || null,
      actualReturn: injury.actualReturn || null,
      season: injury.season || 2024,
      week: injury.week || null,
      gameDate: injury.gameDate || null,
      source: injury.source || "manual",
      reportedBy: injury.reportedBy || null,
      confidence: injury.confidence || 0.8,
      description: injury.description || null,
      impactAssessment: injury.impactAssessment || null,
      reportedAt: injury.reportedAt || new Date(),
      isResolved: injury.isResolved || false,
      createdAt: injury.createdAt || new Date(),
      updatedAt: injury.updatedAt || new Date()
    };
    return newInjury;
  }

  async getInjuries(canonicalPlayerId: string): Promise<Injury[]> {
    return [];
  }

  async createDepthChart(depthChart: Partial<DepthChart>): Promise<DepthChart> {
    const id = Date.now();
    const newDepthChart: DepthChart = {
      id,
      canonicalPlayerId: depthChart.canonicalPlayerId || "",
      teamCode: depthChart.teamCode || "",
      position: depthChart.position || "",
      positionGroup: depthChart.positionGroup || null,
      depthOrder: depthChart.depthOrder || 1,
      season: depthChart.season || 2024,
      week: depthChart.week || null,
      role: depthChart.role || null,
      packages: depthChart.packages || [],
      source: depthChart.source || "manual",
      confidence: depthChart.confidence || 0.8,
      effectiveDate: depthChart.effectiveDate || new Date(),
      isActive: depthChart.isActive || true,
      createdAt: depthChart.createdAt || new Date(),
      updatedAt: depthChart.updatedAt || new Date()
    };
    return newDepthChart;
  }

  async getDepthChart(canonicalPlayerId: string): Promise<DepthChart[]> {
    return [];
  }
  
  async upsertWeeklyStats(stats: any[]): Promise<{ inserted: number; updated: number }> {
    return { inserted: 0, updated: 0 };
  }
  
  async getWeeklyStats(filters: {
    season: number;
    week?: number;
    playerId?: string;
    position?: string;
  }): Promise<any[]> {
    return [];
  }
  
  async getPlayerWeeklyStats(playerId: string, season: number): Promise<any[]> {
    return [];
  }
  
  async getSeasonTotals(season: number, scoring?: 'std' | 'half' | 'ppr'): Promise<any[]> {
    return [];
  }
  
  async upsertWRRoleBank(roleRow: any): Promise<void> {
    return;
  }
  
  async getWRRoleBank(filters: {
    season?: number;
    playerId?: string;
    roleTier?: string;
  }): Promise<any[]> {
    return [];
  }
  
  async getWRRoleBankByPlayer(playerId: string, season: number): Promise<any | null> {
    return null;
  }
  
  async getWeeklyUsageForRoleBank(playerId: string, season: number): Promise<any[]> {
    return [];
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
      // Note: sportsDataAPI temporarily removed - using fallback data
      const sportsDataPlayers: any[] = [];
      console.log(`Fetched ${sportsDataPlayers.length} players from SportsDataIO`);

      // Filter to fantasy-relevant players and limit for free tier
      const fantasyPlayers = sportsDataPlayers
        .filter(p => p.FantasyPosition && ["QB", "RB", "WR", "TE", "K", "DST"].includes(p.FantasyPosition))
        .filter(p => p.Team && p.Active) // Only active players with teams
        .slice(0, 150); // Limit for free tier API calls

      console.log(`Filtered to ${fantasyPlayers.length} fantasy-relevant players`);

      // Convert to our schema format
      // Note: Using fallback conversion since sportsDataAPI is removed
      const playerData: any[] = [];
      
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

  async getPlayerByExternalId(externalId: string): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.externalId, externalId));
    return player || undefined;
  }

  async getPlayerBySleeperIdFromMemory(sleeperId: string): Promise<Player | undefined> {
    // For Sleeper, the external ID is the sleeper ID
    return await this.getPlayerByExternalId(sleeperId);
  }

  async getAllPlayers(): Promise<Player[]> {
    // Select only the essential columns that exist in the current database
    return await db
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
        injuryStatus: players.injuryStatus,
        availability: players.availability,
        imageUrl: players.imageUrl,
        consistency: players.consistency,
        matchupRating: players.matchupRating,
        trend: players.trend,
        ownership: players.ownership,
        targetShare: players.targetShare,
        redZoneTargets: players.redZoneTargets,
        carries: players.carries,
        snapCount: players.snapCount,
        externalId: players.externalId
      })
      .from(players);
  }

  async getAvailablePlayers(position?: string): Promise<Player[]> {
    // Select only the essential columns that exist in the current database
    const query = db
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
        injuryStatus: players.injuryStatus,
        availability: players.availability,
        imageUrl: players.imageUrl,
        consistency: players.consistency,
        matchupRating: players.matchupRating,
        trend: players.trend,
        ownership: players.ownership,
        targetShare: players.targetShare,
        redZoneTargets: players.redZoneTargets,
        carries: players.carries,
        snapCount: players.snapCount,
        externalId: players.externalId
      })
      .from(players)
      .where(eq(players.isAvailable, true));
    
    if (position) {
      return await query.where(and(eq(players.isAvailable, true), eq(players.position, position)));
    }
    
    return await query;
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    // Only insert the essential columns that exist in the current database
    const safePlayerData = {
      name: player.name,
      team: player.team,
      position: player.position,
      avgPoints: player.avgPoints,
      projectedPoints: player.projectedPoints,
      ownershipPercentage: player.ownershipPercentage,
      isAvailable: player.isAvailable,
      upside: player.upside,
      injuryStatus: player.injuryStatus || "Healthy",
      availability: player.availability || "Available",
      imageUrl: player.imageUrl,
      consistency: player.consistency,
      matchupRating: player.matchupRating,
      trend: player.trend,
      ownership: player.ownership,
      targetShare: player.targetShare,
      redZoneTargets: player.redZoneTargets,
      carries: player.carries,
      snapCount: player.snapCount,
      externalId: player.externalId
    };
    
    const [newPlayer] = await db
      .insert(players)
      .values(safePlayerData)
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

  async searchPlayers(query: string, limit: number = 10): Promise<Player[]> {
    const result = await db
      .select()
      .from(players)
      .limit(limit);
    
    // Filter by name match (case-insensitive)
    return result
      .filter(player => 
        player.name.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => {
        // Exact matches first
        const aExact = a.name.toLowerCase() === query.toLowerCase() ? 1 : 0;
        const bExact = b.name.toLowerCase() === query.toLowerCase() ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        
        // Then by starts with
        const aStarts = a.name.toLowerCase().startsWith(query.toLowerCase()) ? 1 : 0;
        const bStarts = b.name.toLowerCase().startsWith(query.toLowerCase()) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        
        // Finally by fantasy points
        return (b.avgPoints || 0) - (a.avgPoints || 0);
      })
      .slice(0, limit);
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

  // Missing IStorage interface methods - database implementations
  async updatePlayer(id: number, updates: Partial<InsertPlayer>): Promise<Player> {
    const [updatedPlayer] = await db
      .update(players)
      .set(updates)
      .where(eq(players.id, id))
      .returning();
    return updatedPlayer;
  }

  // Advanced Analytics - database implementations
  async createMatchupAnalysis(analysis: InsertMatchupAnalysis): Promise<MatchupAnalysis> {
    const safeAnalysis = { ...analysis, createdAt: new Date() };
    const [newAnalysis] = await db
      .insert(matchupAnalysis)
      .values(safeAnalysis)
      .returning();
    return newAnalysis;
  }

  async getMatchupAnalysis(playerId: number, week: number): Promise<MatchupAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(matchupAnalysis)
      .where(and(eq(matchupAnalysis.playerId, playerId), eq(matchupAnalysis.week, week)));
    return analysis || undefined;
  }

  async createLineupOptimization(optimization: InsertLineupOptimization): Promise<LineupOptimization> {
    const safeOptimization = { ...optimization, createdAt: new Date() };
    const [newOptimization] = await db
      .insert(lineupOptimization)
      .values(safeOptimization)
      .returning();
    return newOptimization;
  }

  async getLineupOptimization(teamId: number, week: number): Promise<LineupOptimization | undefined> {
    const [optimization] = await db
      .select()
      .from(lineupOptimization)
      .where(and(eq(lineupOptimization.teamId, teamId), eq(lineupOptimization.week, week)));
    return optimization || undefined;
  }

  async createTradeAnalysis(analysis: InsertTradeAnalysis): Promise<TradeAnalysis> {
    const safeAnalysis = { ...analysis, createdAt: new Date() };
    const [newAnalysis] = await db
      .insert(tradeAnalysis)
      .values(safeAnalysis)
      .returning();
    return newAnalysis;
  }

  async getTradeAnalysis(teamId: number): Promise<TradeAnalysis[]> {
    return await db
      .select()
      .from(tradeAnalysis)
      .where(eq(tradeAnalysis.teamId, teamId));
  }

  async createWaiverRecommendations(recommendation: InsertWaiverRecommendations): Promise<WaiverRecommendations> {
    const safeRecommendation = { ...recommendation, createdAt: new Date() };
    const [newRecommendation] = await db
      .insert(waiverRecommendations)
      .values(safeRecommendation)
      .returning();
    return newRecommendation;
  }

  async getWaiverRecommendations(teamId: number): Promise<WaiverRecommendations[]> {
    return await db
      .select()
      .from(waiverRecommendations)
      .where(eq(waiverRecommendations.teamId, teamId));
  }

  async createInjuryTracker(injury: InsertInjuryTracker): Promise<InjuryTracker> {
    const safeInjury = { ...injury, createdAt: new Date(), updatedAt: new Date() };
    const [newInjury] = await db
      .insert(injuryTracker)
      .values(safeInjury)
      .returning();
    return newInjury;
  }

  async getInjuryTracker(playerId: number): Promise<InjuryTracker | undefined> {
    const [injury] = await db
      .select()
      .from(injuryTracker)
      .where(eq(injuryTracker.playerId, playerId));
    return injury || undefined;
  }

  async updateInjuryTracker(playerId: number, updates: Partial<InsertInjuryTracker>): Promise<void> {
    const safeUpdates = { ...updates, updatedAt: new Date() };
    await db
      .update(injuryTracker)
      .set(safeUpdates)
      .where(eq(injuryTracker.playerId, playerId));
  }

  // UPH - Player Identity Map operations (database implementations)
  async getPlayerIdentityByCanonicalId(canonicalId: string): Promise<PlayerIdentityMap | undefined> {
    const [identity] = await db
      .select()
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.canonicalId, canonicalId));
    return identity || undefined;
  }

  async getPlayerIdentityBySleeperId(sleeperId: string): Promise<PlayerIdentityMap | undefined> {
    const [identity] = await db
      .select()
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.sleeperId, sleeperId));
    return identity || undefined;
  }

  async getPlayerIdentityByExternalId(platform: string, externalId: string): Promise<PlayerIdentityMap | undefined> {
    // Map platform to the correct field
    const fieldMap: Record<string, any> = {
      sleeper: playerIdentityMap.sleeperId,
      espn: playerIdentityMap.espnId,
      yahoo: playerIdentityMap.yahooId,
      rotowire: playerIdentityMap.rotowireId,
      fantasy_data: playerIdentityMap.fantasyDataId,
      fantasypros: playerIdentityMap.fantasyprosId,
      mysportsfeeds: playerIdentityMap.mysportsfeedsId,
      nfl_data_py: playerIdentityMap.nflDataPyId
    };
    
    const field = fieldMap[platform];
    if (!field) return undefined;
    
    const [identity] = await db
      .select()
      .from(playerIdentityMap)
      .where(eq(field, externalId));
    return identity || undefined;
  }

  // UPH - Bronze Layer operations (database implementations)  
  async createIngestPayload(payload: Partial<IngestPayload>): Promise<IngestPayload> {
    const safePayload = {
      source: payload.source || "manual",
      endpoint: payload.endpoint || "",
      payload: payload.payload || {},
      version: payload.version || "1.0",
      jobId: payload.jobId || "stub",
      season: payload.season || 2024,
      week: payload.week || null,
      status: payload.status || "SUCCESS",
      recordCount: payload.recordCount || null,
      errorMessage: payload.errorMessage || null,
      checksumHash: payload.checksumHash || null,
      ingestedAt: payload.ingestedAt || new Date(),
      processedAt: payload.processedAt || null
    };
    
    const [newPayload] = await db
      .insert(ingestPayloads)
      .values(safePayload)
      .returning();
    return newPayload;
  }

  async getIngestPayload(id: number): Promise<IngestPayload | undefined> {
    const [payload] = await db
      .select()
      .from(ingestPayloads)
      .where(eq(ingestPayloads.id, id));
    return payload || undefined;
  }

  // Missing UPH Bronze Layer interface methods (database implementations)
  async getRawPayloads(filters?: {
    source?: string;
    status?: string;
    season?: number;
    week?: number;
    jobId?: string;
    endpoint?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<IngestPayload[]> {
    let query = db.select().from(ingestPayloads);
    
    // Apply filters if provided
    const conditions: any[] = [];
    if (filters?.source) conditions.push(eq(ingestPayloads.source, filters.source as any));
    if (filters?.status) conditions.push(eq(ingestPayloads.status, filters.status as any));
    if (filters?.season) conditions.push(eq(ingestPayloads.season, filters.season));
    if (filters?.week) conditions.push(eq(ingestPayloads.week, filters.week));
    if (filters?.jobId) conditions.push(eq(ingestPayloads.jobId, filters.jobId));
    if (filters?.endpoint) conditions.push(eq(ingestPayloads.endpoint, filters.endpoint));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    let finalQuery = query;
    if (filters?.limit) {
      finalQuery = finalQuery.limit(filters.limit);
    }
    
    if (filters?.offset) {
      finalQuery = finalQuery.offset(filters.offset);
    }
    
    return await finalQuery;
  }

  async updatePayloadStatus(payloadId: number, status: string, errorMessage?: string): Promise<void> {
    const updates: any = { status };
    if (errorMessage) updates.errorMessage = errorMessage;
    
    await db
      .update(ingestPayloads)
      .set(updates)
      .where(eq(ingestPayloads.id, payloadId));
  }

  async updateBatchPayloadStatus(payloadIds: number[], status: string): Promise<void> {
    // For batch updates, we'll update each payload individually for now
    // In a real implementation, you might use a more efficient batch update
    for (const payloadId of payloadIds) {
      await this.updatePayloadStatus(payloadId, status);
    }
  }

  async getDataSourceStats(source?: string): Promise<Array<{
    source: string;
    totalPayloads: number;
    successfulPayloads: number;
    failedPayloads: number;
    pendingPayloads: number;
    processingPayloads: number;
    lastIngestDate: Date | null;
    avgPayloadSize: number;
  }>> {
    // Basic stub implementation - in practice, you'd use SQL aggregations
    const allPayloads = await this.getRawPayloads(source ? { source } : {});
    
    if (allPayloads.length === 0) return [];
    
    const stats = {
      source: source || "all",
      totalPayloads: allPayloads.length,
      successfulPayloads: allPayloads.filter(p => p.status === "SUCCESS").length,
      failedPayloads: allPayloads.filter(p => p.status === "FAILED").length,
      pendingPayloads: allPayloads.filter(p => p.status === "PENDING").length,
      processingPayloads: allPayloads.filter(p => p.status === "PROCESSING").length,
      lastIngestDate: allPayloads.reduce((latest, p) => 
        !latest || (p.ingestedAt && p.ingestedAt > latest) ? p.ingestedAt : latest, null as Date | null),
      avgPayloadSize: allPayloads.reduce((sum, p) => sum + (p.recordCount || 0), 0) / allPayloads.length
    };
    
    return [stats];
  }

  async purgeOldPayloads(source: string, cutoffDate: Date): Promise<{ deletedCount: number }> {
    // This would delete payloads older than cutoffDate for the given source
    // For now, return 0 as stub
    return { deletedCount: 0 };
  }

  async checkPayloadDuplicate(source: string, checksum: string): Promise<IngestPayload | undefined> {
    const [payload] = await db
      .select()
      .from(ingestPayloads)
      .where(and(
        eq(ingestPayloads.source, source as any),
        eq(ingestPayloads.checksumHash, checksum)
      ));
    return payload || undefined;
  }

  // UPH - Silver Layer operations (database implementations)
  async createMarketSignal(signal: Partial<MarketSignal>): Promise<MarketSignal> {
    const safeSignal = {
      canonicalPlayerId: signal.canonicalPlayerId || "",
      source: signal.source || "manual",
      signalType: signal.signalType || "adp",
      overallRank: signal.overallRank || null,
      positionalRank: signal.positionalRank || null,
      value: signal.value || null,
      season: signal.season || 2024,
      week: signal.week || null,
      leagueFormat: signal.leagueFormat || null,
      scoringFormat: signal.scoringFormat || null,
      sampleSize: signal.sampleSize || null,
      confidence: signal.confidence || 0.8,
      dataQuality: signal.dataQuality || "MEDIUM",
      extractedAt: signal.extractedAt || new Date(),
      validFrom: signal.validFrom || new Date(),
      validTo: signal.validTo || null,
      createdAt: signal.createdAt || new Date()
    };

    const [newSignal] = await db
      .insert(marketSignals)
      .values(safeSignal)
      .returning();
    return newSignal;
  }

  async getMarketSignals(canonicalPlayerId: string, signalType?: string): Promise<MarketSignal[]> {
    if (signalType) {
      return await db
        .select()
        .from(marketSignals)
        .where(and(
          eq(marketSignals.canonicalPlayerId, canonicalPlayerId),
          eq(marketSignals.signalType, signalType as any)
        ));
    }
    
    return await db
      .select()
      .from(marketSignals)
      .where(eq(marketSignals.canonicalPlayerId, canonicalPlayerId));
  }

  async createInjury(injury: Partial<Injury>): Promise<Injury> {
    const safeInjury = {
      canonicalPlayerId: injury.canonicalPlayerId || "",
      injuryType: injury.injuryType || null,
      bodyPart: injury.bodyPart || null,
      severity: injury.severity || null,
      status: injury.status || "healthy",
      practiceStatus: injury.practiceStatus || null,
      injuryDate: injury.injuryDate || null,
      expectedReturn: injury.expectedReturn || null,
      actualReturn: injury.actualReturn || null,
      season: injury.season || 2024,
      week: injury.week || null,
      gameDate: injury.gameDate || null,
      source: injury.source || "manual",
      reportedBy: injury.reportedBy || null,
      confidence: injury.confidence || 0.8,
      description: injury.description || null,
      impactAssessment: injury.impactAssessment || null,
      reportedAt: injury.reportedAt || new Date(),
      isResolved: injury.isResolved || false,
      createdAt: injury.createdAt || new Date(),
      updatedAt: injury.updatedAt || new Date()
    };

    const [newInjury] = await db
      .insert(injuries)
      .values(safeInjury)
      .returning();
    return newInjury;
  }

  async getInjuries(canonicalPlayerId: string): Promise<Injury[]> {
    return await db
      .select()
      .from(injuries)
      .where(eq(injuries.canonicalPlayerId, canonicalPlayerId));
  }

  async createDepthChart(depthChart: Partial<DepthChart>): Promise<DepthChart> {
    const safeDepthChart = {
      canonicalPlayerId: depthChart.canonicalPlayerId || "",
      teamCode: depthChart.teamCode || "",
      position: depthChart.position || "",
      positionGroup: depthChart.positionGroup || null,
      depthOrder: depthChart.depthOrder || 1,
      season: depthChart.season || 2024,
      week: depthChart.week || null,
      role: depthChart.role || null,
      packages: depthChart.packages || [],
      source: depthChart.source || "manual",
      confidence: depthChart.confidence || 0.8,
      effectiveDate: depthChart.effectiveDate || new Date(),
      isActive: depthChart.isActive || true,
      createdAt: depthChart.createdAt || new Date(),
      updatedAt: depthChart.updatedAt || new Date()
    };

    const [newDepthChart] = await db
      .insert(depthCharts)
      .values(safeDepthChart)
      .returning();
    return newDepthChart;
  }

  async getDepthChart(canonicalPlayerId: string): Promise<DepthChart[]> {
    return await db
      .select()
      .from(depthCharts)
      .where(eq(depthCharts.canonicalPlayerId, canonicalPlayerId));
  }
  
  async upsertWeeklyStats(stats: any[]): Promise<{ inserted: number; updated: number }> {
    if (stats.length === 0) {
      return { inserted: 0, updated: 0 };
    }
    
    let inserted = 0;
    let updated = 0;
    
    for (const stat of stats) {
      const values = {
        season: stat.season,
        week: stat.week,
        playerId: stat.player_id,
        playerName: stat.player_name,
        team: stat.team,
        position: stat.position,
        snaps: stat.snaps,
        routes: stat.routes,
        targets: stat.targets,
        rushAtt: stat.rush_att,
        rec: stat.rec,
        recYd: stat.rec_yd,
        recTd: stat.rec_td,
        rushYd: stat.rush_yd,
        rushTd: stat.rush_td,
        passYd: stat.pass_yd,
        passTd: stat.pass_td,
        int: stat.int,
        fumbles: stat.fumbles,
        twoPt: stat.two_pt,
        fantasyPointsStd: stat.fantasy_points_std,
        fantasyPointsHalf: stat.fantasy_points_half,
        fantasyPointsPpr: stat.fantasy_points_ppr,
        gsisId: stat.gsis_id,
        updatedAt: new Date()
      };
      
      await db.insert(weeklyStats)
        .values(values)
        .onConflictDoUpdate({
          target: [weeklyStats.season, weeklyStats.week, weeklyStats.playerId],
          set: values
        });
      
      inserted++;
    }
    
    return { inserted, updated: 0 };
  }
  
  async getWeeklyStats(filters: {
    season: number;
    week?: number;
    playerId?: string;
    position?: string;
  }): Promise<any[]> {
    let query = db.select().from(weeklyStats);
    
    const conditions = [eq(weeklyStats.season, filters.season)];
    
    if (filters.week !== undefined) {
      conditions.push(eq(weeklyStats.week, filters.week));
    }
    
    if (filters.playerId) {
      conditions.push(eq(weeklyStats.playerId, filters.playerId));
    }
    
    if (filters.position) {
      conditions.push(eq(weeklyStats.position, filters.position));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query;
  }
  
  async getPlayerWeeklyStats(playerId: string, season: number): Promise<any[]> {
    return await db
      .select()
      .from(weeklyStats)
      .where(and(
        eq(weeklyStats.playerId, playerId),
        eq(weeklyStats.season, season)
      ));
  }
  
  async getSeasonTotals(season: number, scoring: 'std' | 'half' | 'ppr' = 'half'): Promise<any[]> {
    const scoringColumn = scoring === 'ppr' 
      ? weeklyStats.fantasyPointsPpr
      : scoring === 'std'
      ? weeklyStats.fantasyPointsStd
      : weeklyStats.fantasyPointsHalf;
    
    const results = await db
      .select()
      .from(weeklyStats)
      .where(eq(weeklyStats.season, season));
    
    const playerTotals = new Map<string, any>();
    
    for (const row of results) {
      const key = row.playerId;
      if (!playerTotals.has(key)) {
        playerTotals.set(key, {
          player_id: row.playerId,
          player_name: row.playerName,
          team: row.team,
          position: row.position,
          games: 0,
          total_fantasy_points: 0
        });
      }
      
      const player = playerTotals.get(key);
      player.games += 1;
      
      const points = scoring === 'ppr' 
        ? row.fantasyPointsPpr 
        : scoring === 'std' 
        ? row.fantasyPointsStd 
        : row.fantasyPointsHalf;
      
      player.total_fantasy_points += points || 0;
    }
    
    return Array.from(playerTotals.values())
      .sort((a, b) => b.total_fantasy_points - a.total_fantasy_points);
  }
  
  async upsertWRRoleBank(roleRow: any): Promise<void> {
    await db
      .insert(wrRoleBank)
      .values({
        playerId: roleRow.playerId,
        sleeperId: roleRow.sleeperId || null,
        season: roleRow.season,
        gamesPlayed: roleRow.gamesPlayed,
        targetsPerGame: roleRow.targetsPerGame,
        targetShareAvg: roleRow.targetShareAvg,
        routesPerGame: roleRow.routesPerGame,
        routeShareEst: roleRow.routeShareEst,
        targetStdDev: roleRow.targetStdDev,
        fantasyStdDev: roleRow.fantasyStdDev,
        pprPerTarget: roleRow.pprPerTarget,
        deepTargetsPerGame: roleRow.deepTargetsPerGame,     // v1.1
        deepTargetRate: roleRow.deepTargetRate,             // v1.1
        slotRouteShareEst: roleRow.slotRouteShareEst,
        outsideRouteShareEst: roleRow.outsideRouteShareEst,
        volumeScore: roleRow.volumeScore,
        consistencyScore: roleRow.consistencyScore,
        highValueUsageScore: roleRow.highValueUsageScore,
        momentumScore: roleRow.momentumScore,
        roleScore: roleRow.roleScore,
        roleTier: roleRow.roleTier,
        cardioWrFlag: roleRow.cardioWrFlag,
        breakoutWatchFlag: roleRow.breakoutWatchFlag,
        fakeSpikeFlag: roleRow.fakeSpikeFlag
      })
      .onConflictDoUpdate({
        target: [wrRoleBank.playerId, wrRoleBank.season],
        set: {
          gamesPlayed: roleRow.gamesPlayed,
          targetsPerGame: roleRow.targetsPerGame,
          targetShareAvg: roleRow.targetShareAvg,
          routesPerGame: roleRow.routesPerGame,
          routeShareEst: roleRow.routeShareEst,
          targetStdDev: roleRow.targetStdDev,
          fantasyStdDev: roleRow.fantasyStdDev,
          pprPerTarget: roleRow.pprPerTarget,
          deepTargetsPerGame: roleRow.deepTargetsPerGame,     // v1.1
          deepTargetRate: roleRow.deepTargetRate,             // v1.1
          slotRouteShareEst: roleRow.slotRouteShareEst,
          outsideRouteShareEst: roleRow.outsideRouteShareEst,
          volumeScore: roleRow.volumeScore,
          consistencyScore: roleRow.consistencyScore,
          highValueUsageScore: roleRow.highValueUsageScore,
          momentumScore: roleRow.momentumScore,
          roleScore: roleRow.roleScore,
          roleTier: roleRow.roleTier,
          cardioWrFlag: roleRow.cardioWrFlag,
          breakoutWatchFlag: roleRow.breakoutWatchFlag,
          fakeSpikeFlag: roleRow.fakeSpikeFlag,
          updatedAt: new Date()
        }
      });
  }
  
  async getWRRoleBank(filters: {
    season?: number;
    playerId?: string;
    roleTier?: string;
  }): Promise<any[]> {
    let query = db.select().from(wrRoleBank);
    
    const conditions = [];
    
    if (filters.season !== undefined) {
      conditions.push(eq(wrRoleBank.season, filters.season));
    }
    
    if (filters.playerId) {
      conditions.push(eq(wrRoleBank.playerId, filters.playerId));
    }
    
    if (filters.roleTier) {
      conditions.push(eq(wrRoleBank.roleTier, filters.roleTier));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(wrRoleBank.roleScore));
  }
  
  async getWRRoleBankByPlayer(playerId: string, season: number): Promise<any | null> {
    const results = await db
      .select()
      .from(wrRoleBank)
      .where(and(
        eq(wrRoleBank.playerId, playerId),
        eq(wrRoleBank.season, season)
      ))
      .limit(1);
    
    return results.length > 0 ? results[0] : null;
  }
  
  async getWeeklyUsageForRoleBank(playerId: string, season: number): Promise<any[]> {
    // First get basic weekly stats
    const results = await db
      .select({
        playerId: weeklyStats.playerId,
        season: weeklyStats.season,
        week: weeklyStats.week,
        team: weeklyStats.team,
        targets: weeklyStats.targets,
        targetSharePct: playerUsage.targetSharePct,
        routes: weeklyStats.routes,
        fantasyPointsPpr: weeklyStats.fantasyPointsPpr,
        routesSlot: playerUsage.routesSlot,
        routesOutside: playerUsage.routesOutside,
        routesInline: playerUsage.routesInline
      })
      .from(weeklyStats)
      .leftJoin(playerUsage, and(
        eq(weeklyStats.playerId, playerUsage.playerId),
        eq(weeklyStats.season, playerUsage.season),
        eq(weeklyStats.week, playerUsage.week)
      ))
      .where(and(
        eq(weeklyStats.playerId, playerId),
        eq(weeklyStats.season, season)
      ))
      .orderBy(weeklyStats.week);
    
    // Get deep target counts from play-by-play data
    const deepTargetsQuery = await db.execute(sql`
      SELECT 
        week,
        COUNT(*) FILTER (WHERE air_yards >= 20) as deep_targets_20_plus
      FROM bronze_nflfastr_plays
      WHERE receiver_player_id = ${playerId}
        AND season = ${season}
        AND play_type = 'pass'
        AND (complete_pass = true OR incomplete_pass = true)
      GROUP BY week
    `);
    
    // Map deep targets by week
    const deepTargetsByWeek = new Map<number, number>();
    for (const row of deepTargetsQuery.rows as any[]) {
      const weekNum = Number(row.week);
      const deepCount = Number(row.deep_targets_20_plus) || 0;
      deepTargetsByWeek.set(weekNum, deepCount);
    }
    
    return results.map(r => ({
      playerId: r.playerId,
      season: r.season,
      week: r.week,
      team: r.team,
      targets: r.targets,
      targetSharePct: r.targetSharePct ? r.targetSharePct / 100 : null,
      routes: r.routes,
      fantasyPointsPpr: r.fantasyPointsPpr,
      routesSlot: r.routesSlot,
      routesOutside: r.routesOutside,
      routesInline: r.routesInline,
      deepTargets20Plus: deepTargetsByWeek.has(r.week) ? deepTargetsByWeek.get(r.week)! : null
    }));
  }
  
  // ========== RB ROLE BANK OPERATIONS ==========
  
  async upsertRBRoleBank(roleRow: any): Promise<void> {
    await db
      .insert(rbRoleBank)
      .values({
        playerId: roleRow.playerId,
        sleeperId: roleRow.sleeperId || null,
        season: roleRow.season,
        gamesPlayed: roleRow.gamesPlayed,
        carriesPerGame: roleRow.carriesPerGame,
        targetsPerGame: roleRow.targetsPerGame,
        opportunitiesPerGame: roleRow.opportunitiesPerGame,
        targetShareAvg: roleRow.targetShareAvg,
        routesPerGame: roleRow.routesPerGame,
        oppStdDev: roleRow.oppStdDev,
        fantasyStdDev: roleRow.fantasyStdDev,
        pprPerOpportunity: roleRow.pprPerOpportunity,
        redZoneTouchesPerGame: roleRow.redZoneTouchesPerGame,
        volumeScore: roleRow.volumeScore,
        consistencyScore: roleRow.consistencyScore,
        highValueUsageScore: roleRow.highValueUsageScore,
        momentumScore: roleRow.momentumScore,
        roleScore: roleRow.roleScore,
        roleTier: roleRow.roleTier,
        pureRusherFlag: roleRow.pureRusherFlag,
        passingDownBackFlag: roleRow.passingDownBackFlag,
        breakoutWatchFlag: roleRow.breakoutWatchFlag
      })
      .onConflictDoUpdate({
        target: [rbRoleBank.playerId, rbRoleBank.season],
        set: {
          gamesPlayed: roleRow.gamesPlayed,
          carriesPerGame: roleRow.carriesPerGame,
          targetsPerGame: roleRow.targetsPerGame,
          opportunitiesPerGame: roleRow.opportunitiesPerGame,
          targetShareAvg: roleRow.targetShareAvg,
          routesPerGame: roleRow.routesPerGame,
          oppStdDev: roleRow.oppStdDev,
          fantasyStdDev: roleRow.fantasyStdDev,
          pprPerOpportunity: roleRow.pprPerOpportunity,
          redZoneTouchesPerGame: roleRow.redZoneTouchesPerGame,
          volumeScore: roleRow.volumeScore,
          consistencyScore: roleRow.consistencyScore,
          highValueUsageScore: roleRow.highValueUsageScore,
          momentumScore: roleRow.momentumScore,
          roleScore: roleRow.roleScore,
          roleTier: roleRow.roleTier,
          pureRusherFlag: roleRow.pureRusherFlag,
          passingDownBackFlag: roleRow.passingDownBackFlag,
          breakoutWatchFlag: roleRow.breakoutWatchFlag,
          updatedAt: new Date()
        }
      });
  }
  
  async getRBRoleBank(filters: {
    season?: number;
    playerId?: string;
    roleTier?: string;
  }): Promise<any[]> {
    let query = db.select().from(rbRoleBank);
    
    const conditions = [];
    
    if (filters.season !== undefined) {
      conditions.push(eq(rbRoleBank.season, filters.season));
    }
    
    if (filters.playerId) {
      conditions.push(eq(rbRoleBank.playerId, filters.playerId));
    }
    
    if (filters.roleTier) {
      conditions.push(eq(rbRoleBank.roleTier, filters.roleTier));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(rbRoleBank.roleScore));
  }
  
  async getRBRoleBankByPlayer(playerId: string, season: number): Promise<any | null> {
    const results = await db
      .select()
      .from(rbRoleBank)
      .where(and(
        eq(rbRoleBank.playerId, playerId),
        eq(rbRoleBank.season, season)
      ))
      .limit(1);
    
    return results.length > 0 ? results[0] : null;
  }
  
  async getWeeklyUsageForRBRoleBank(playerId: string, season: number): Promise<any[]> {
    const results = await db
      .select({
        playerId: weeklyStats.playerId,
        season: weeklyStats.season,
        week: weeklyStats.week,
        team: weeklyStats.team,
        carries: weeklyStats.rushAtt,
        targets: weeklyStats.targets,
        targetSharePct: playerUsage.targetSharePct,
        routes: weeklyStats.routes,
        fantasyPointsPpr: weeklyStats.fantasyPointsPpr,
        redZoneCarries: sql<number>`null`.as('red_zone_carries'),
        redZoneTargets: sql<number>`null`.as('red_zone_targets')
      })
      .from(weeklyStats)
      .leftJoin(playerUsage, and(
        eq(weeklyStats.playerId, playerUsage.playerId),
        eq(weeklyStats.season, playerUsage.season),
        eq(weeklyStats.week, playerUsage.week)
      ))
      .where(and(
        eq(weeklyStats.playerId, playerId),
        eq(weeklyStats.season, season)
      ))
      .orderBy(weeklyStats.week);
    
    return results.map(r => ({
      playerId: r.playerId,
      season: r.season,
      week: r.week,
      team: r.team,
      carries: r.carries ?? 0,
      targets: r.targets ?? 0,
      targetSharePct: r.targetSharePct ? r.targetSharePct / 100 : null,
      routes: r.routes ?? 0,
      fantasyPointsPpr: r.fantasyPointsPpr ?? 0,
      redZoneCarries: r.redZoneCarries ?? 0,
      redZoneTargets: r.redZoneTargets ?? 0
    }));
  }
  
  // ========== TE ROLE BANK OPERATIONS ==========
  
  async upsertTERoleBank(roleRow: any): Promise<void> {
    await db
      .insert(teRoleBank)
      .values({
        playerId: roleRow.playerId,
        sleeperId: roleRow.sleeperId || null,
        season: roleRow.season,
        gamesPlayed: roleRow.gamesPlayed,
        targetsPerGame: roleRow.targetsPerGame,
        targetShareAvg: roleRow.targetShareAvg,
        routesPerGame: roleRow.routesPerGame,
        targetStdDev: roleRow.targetStdDev,
        fantasyStdDev: roleRow.fantasyStdDev,
        pprPerTarget: roleRow.pprPerTarget,
        redZoneTargetsPerGame: roleRow.redZoneTargetsPerGame,
        volumeScore: roleRow.volumeScore,
        consistencyScore: roleRow.consistencyScore,
        highValueUsageScore: roleRow.highValueUsageScore,
        momentumScore: roleRow.momentumScore,
        roleScore: roleRow.roleScore,
        roleTier: roleRow.roleTier,
        redZoneWeaponFlag: roleRow.redZoneWeaponFlag,
        cardioTEFlag: roleRow.cardioTEFlag,
        breakoutWatchFlag: roleRow.breakoutWatchFlag
      })
      .onConflictDoUpdate({
        target: [teRoleBank.playerId, teRoleBank.season],
        set: {
          gamesPlayed: roleRow.gamesPlayed,
          targetsPerGame: roleRow.targetsPerGame,
          targetShareAvg: roleRow.targetShareAvg,
          routesPerGame: roleRow.routesPerGame,
          targetStdDev: roleRow.targetStdDev,
          fantasyStdDev: roleRow.fantasyStdDev,
          pprPerTarget: roleRow.pprPerTarget,
          redZoneTargetsPerGame: roleRow.redZoneTargetsPerGame,
          volumeScore: roleRow.volumeScore,
          consistencyScore: roleRow.consistencyScore,
          highValueUsageScore: roleRow.highValueUsageScore,
          momentumScore: roleRow.momentumScore,
          roleScore: roleRow.roleScore,
          roleTier: roleRow.roleTier,
          redZoneWeaponFlag: roleRow.redZoneWeaponFlag,
          cardioTEFlag: roleRow.cardioTEFlag,
          breakoutWatchFlag: roleRow.breakoutWatchFlag,
          updatedAt: new Date()
        }
      });
  }
  
  async getTERoleBank(filters: {
    season?: number;
    playerId?: string;
    roleTier?: string;
  }): Promise<any[]> {
    let query = db.select().from(teRoleBank);
    
    const conditions = [];
    
    if (filters.season !== undefined) {
      conditions.push(eq(teRoleBank.season, filters.season));
    }
    
    if (filters.playerId) {
      conditions.push(eq(teRoleBank.playerId, filters.playerId));
    }
    
    if (filters.roleTier) {
      conditions.push(eq(teRoleBank.roleTier, filters.roleTier));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(teRoleBank.roleScore));
  }
  
  async getTERoleBankByPlayer(playerId: string, season: number): Promise<any | null> {
    const results = await db
      .select()
      .from(teRoleBank)
      .where(and(
        eq(teRoleBank.playerId, playerId),
        eq(teRoleBank.season, season)
      ))
      .limit(1);
    
    return results.length > 0 ? results[0] : null;
  }
  
  async getWeeklyUsageForTERoleBank(playerId: string, season: number): Promise<any[]> {
    const results = await db
      .select({
        playerId: weeklyStats.playerId,
        season: weeklyStats.season,
        week: weeklyStats.week,
        team: weeklyStats.team,
        targets: weeklyStats.targets,
        targetSharePct: playerUsage.targetSharePct,
        routes: weeklyStats.routes,
        fantasyPointsPpr: weeklyStats.fantasyPointsPpr,
        redZoneTargets: sql<number>`null`.as('red_zone_targets')
      })
      .from(weeklyStats)
      .leftJoin(playerUsage, and(
        eq(weeklyStats.playerId, playerUsage.playerId),
        eq(weeklyStats.season, playerUsage.season),
        eq(weeklyStats.week, playerUsage.week)
      ))
      .where(and(
        eq(weeklyStats.playerId, playerId),
        eq(weeklyStats.season, season)
      ))
      .orderBy(weeklyStats.week);
    
    return results.map(r => ({
      playerId: r.playerId,
      season: r.season,
      week: r.week,
      team: r.team,
      targets: r.targets ?? 0,
      targetSharePct: r.targetSharePct ? r.targetSharePct / 100 : null,
      routes: r.routes ?? 0,
      fantasyPointsPpr: r.fantasyPointsPpr ?? 0,
      redZoneTargets: r.redZoneTargets ?? 0
    }));
  }
}

export const storage = new DatabaseStorage();
