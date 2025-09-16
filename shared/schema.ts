import { pgTable, text, serial, integer, real, boolean, timestamp, varchar, jsonb, unique, pgEnum, uniqueIndex, index, smallint, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ========================================
// ENUMS FOR BUYS/SELLS TRADE ADVICE MODEL
// ========================================

// Verdict enum for buy/sell recommendations
export const verdictEnum = pgEnum("verdict", [
  "BUY_HARD",
  "BUY", 
  "WATCH_BUY",
  "HOLD",
  "WATCH_SELL", 
  "SELL",
  "SELL_HARD"
]);

// Format enum for league types
export const formatEnum = pgEnum("format", [
  "redraft",
  "dynasty"
]);

// PPR scoring enum
export const pprEnum = pgEnum("ppr", [
  "ppr",
  "half", 
  "standard"
]);

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  leagueName: text("league_name").notNull(),
  record: text("record").notNull(), // e.g., "6-2"
  leagueRank: integer("league_rank").notNull(),
  totalPoints: real("total_points").notNull(),
  healthScore: integer("health_score").notNull(), // 0-100
  // Sync metadata
  syncPlatform: text("sync_platform"), // "espn", "yahoo", "sleeper", "manual"
  syncLeagueId: text("sync_league_id"), // External league ID
  syncTeamId: text("sync_team_id"), // External team ID
  lastSyncDate: timestamp("last_sync_date"),
  syncEnabled: boolean("sync_enabled").default(false),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  team: text("team").notNull(), // NFL team abbreviation
  position: text("position").notNull(), // QB, RB, WR, TE, etc.
  avgPoints: real("avg_points").notNull(),
  projectedPoints: real("projected_points").notNull(),
  ownershipPercentage: integer("ownership_percentage").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  upside: real("upside").notNull(),
  injuryStatus: text("injury_status").default("Healthy"),
  availability: text("availability").default("Available"),
  imageUrl: text("image_url"), // Player headshot/photo URL
  consistency: real("consistency"), // Performance consistency rating
  matchupRating: real("matchup_rating"), // Upcoming matchup rating
  trend: text("trend"), // "up", "down", "stable"
  ownership: integer("ownership"), // Fantasy ownership %
  targetShare: real("target_share"), // WR/TE target share
  redZoneTargets: integer("red_zone_targets"), // Red zone targets
  carries: integer("carries"), // RB carries
  snapCount: integer("snap_count"), // Offensive snap count
  externalId: text("external_id"), // SportsDataIO player ID
  
  // Sleeper API integration fields
  sleeperId: text("sleeper_id").unique(), // Sleeper player ID
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name"),
  jerseyNumber: integer("jersey_number"),
  age: integer("age"),
  yearsExp: integer("years_exp"),
  height: text("height"), // e.g., "6'4""
  weight: integer("weight"), // in pounds
  college: text("college"),
  birthCountry: text("birth_country"),
  status: text("status"), // "Active", "Inactive", etc.
  depthChartPosition: text("depth_chart_position"),
  depthChartOrder: integer("depth_chart_order"),
  
  // External IDs for cross-platform matching
  espnId: text("espn_id"),
  yahooId: text("yahoo_id"),
  rotowireId: text("rotowire_id"),
  fantasyDataId: text("fantasy_data_id"),
  
  // Market data - ENHANCED WITH DUAL ADP FIELDS
  adp: real("adp"), // Overall ADP (e.g., 4)
  positionalADP: text("positional_adp"), // Position rank (e.g., "WR1", "RB6")
  adpMissing: boolean("adp_missing").default(false), // True if ADP data unavailable
  adpLastUpdated: timestamp("adp_last_updated"), // When ADP was last synced
  adpSource: text("adp_source"), // 'sleeper', 'espn', 'fantasypros'
  dynastyValue: integer("dynasty_value"), // Dynasty value score 0-100
  
  // FPG-CENTRIC SCORING SYSTEM
  fpg: real("fpg"), // Current season fantasy points per game
  xFpg: real("x_fpg"), // Expected FPG based on advanced metrics
  projFpg: real("proj_fpg"), // Projected FPG for rest of season
  upsideIndex: real("upside_index"), // 0-100 upside potential (rushing QBs, explosive profiles)
  upsideBoost: real("upside_boost"), // Calculated boost from upside factors
  fpgTrend: text("fpg_trend"), // "rising", "declining", "stable"
  fpgVariance: real("fpg_variance"), // Week-to-week FPG variance for floor/ceiling
  explosivePlays: integer("explosive_plays"), // 20+ yard plays this season
  redZoneOpportunity: real("red_zone_opportunity"), // RZ touches/targets per game
  
  // RAG SCORING SYSTEM - Production weekly analysis
  expectedPoints: real("expected_points"), // Weekly expected points (mu)
  floorPoints: real("floor_points"), // Weekly floor (mu - sigma)
  ceilingPoints: real("ceiling_points"), // Weekly ceiling (mu + sigma) 
  ragScore: real("rag_score"), // 0-100 RAG score with upside bias
  ragColor: text("rag_color"), // "GREEN", "AMBER", "RED"
  
  // Advanced weekly analytics from earlier phases
  beatProj: real("beat_proj"), // Beat projection rate 0-100
  features: jsonb("features"), // Advanced feature calculations
  
  // ROOKIE RISERS SYSTEM - Draft data for rookie identification
  draftYear: integer("draft_year"), // Draft year to identify rookies
  draftRound: integer("draft_round"), // Draft round (1-7, or NULL for UDFA)
  draftPick: integer("draft_pick"), // Overall draft pick
});

// Articles table for content management
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  content: text("content").notNull(), // Full article content in markdown
  excerpt: text("excerpt"), // Short excerpt for previews
  category: text("category").notNull(),
  tags: text("tags").array().notNull().default([]), // Array of tags
  readTime: text("read_time").notNull(), // e.g., "8 min"
  publishDate: timestamp("publish_date").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  featured: boolean("featured").default(false),
  published: boolean("published").default(true),
  author: text("author").notNull(),
  authorBio: text("author_bio"), // Optional author description
  metaKeywords: text("meta_keywords").array().default([]), // SEO keywords
  viewCount: integer("view_count").default(0),
});

// Game logs table for storing weekly performance data
export const gameLogs = pgTable("game_logs", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  sleeperId: text("sleeper_id").notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  seasonType: text("season_type").notNull(), // "regular", "post", "pre"
  opponent: text("opponent"),
  gameDate: timestamp("game_date"),
  
  // Fantasy stats
  fantasyPoints: real("fantasy_points"),
  fantasyPointsPpr: real("fantasy_points_ppr"),
  fantasyPointsHalfPpr: real("fantasy_points_half_ppr"),
  
  // Passing stats
  passAttempts: integer("pass_attempts"),
  passCompletions: integer("pass_completions"),
  passYards: integer("pass_yards"),
  passTd: integer("pass_td"),
  passInt: integer("pass_int"),
  pass2pt: integer("pass_2pt"),
  
  // Rushing stats
  rushAttempts: integer("rush_attempts"),
  rushYards: integer("rush_yards"),
  rushTd: integer("rush_td"),
  rush2pt: integer("rush_2pt"),
  
  // Receiving stats
  receptions: integer("receptions"),
  targets: integer("targets"),
  recYards: integer("rec_yards"),
  recTd: integer("rec_td"),
  rec2pt: integer("rec_2pt"),
  
  // Other stats
  fumbles: integer("fumbles"),
  fumblesLost: integer("fumbles_lost"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  // Unique constraint to prevent duplicate game logs
  uniqueGameLog: unique().on(table.sleeperId, table.season, table.week, table.seasonType)
}));

export const teamPlayers = pgTable("team_players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  playerId: integer("player_id").notNull(),
  isStarter: boolean("is_starter").notNull().default(false),
});

export const positionAnalysis = pgTable("position_analysis", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  position: text("position").notNull(),
  strengthScore: integer("strength_score").notNull(), // 0-100
  status: text("status").notNull(), // "critical", "warning", "good"
  weeklyAverage: real("weekly_average").notNull(),
  leagueAverage: real("league_average").notNull(),
});

export const weeklyPerformance = pgTable("weekly_performance", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  week: integer("week").notNull(),
  points: real("points").notNull(),
  projectedPoints: real("projected_points").notNull(),
});

// Advanced Analytics Tables
export const matchupAnalysis = pgTable("matchup_analysis", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  week: integer("week").notNull(),
  opponent: text("opponent").notNull(),
  difficulty: text("difficulty").notNull(), // "easy", "medium", "hard"
  defenseRank: integer("defense_rank"), // opponent defense ranking vs position
  projectedPoints: real("projected_points"),
  weatherImpact: text("weather_impact"),
  isHome: boolean("is_home").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lineupOptimization = pgTable("lineup_optimization", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  week: integer("week").notNull(),
  optimizedLineup: text("optimized_lineup").notNull(), // JSON string of player IDs by position
  projectedPoints: real("projected_points").notNull(),
  confidence: real("confidence"), // 0-1 confidence score
  factors: text("factors"), // JSON string with optimization factors
  createdAt: timestamp("created_at").defaultNow(),
});

export const tradeAnalysis = pgTable("trade_analysis", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  playersGiven: text("players_given").notNull(), // JSON array of player IDs
  playersReceived: text("players_received").notNull(), // JSON array of player IDs
  tradeValue: real("trade_value"), // Overall trade value score
  recommendation: text("recommendation"), // "accept", "decline", "counter"
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dynastyTradeHistory = pgTable("dynasty_trade_history", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  tradePartnerTeamId: integer("trade_partner_team_id"), // Other team in trade
  playersGiven: text("players_given").notNull(), // JSON array of {playerId, playerName, position, age}
  playersReceived: text("players_received").notNull(), // JSON array of {playerId, playerName, position, age}
  draftPicksGiven: text("draft_picks_given"), // JSON array of {year, round, pick}
  draftPicksReceived: text("draft_picks_received"), // JSON array of {year, round, pick}
  tradeDate: timestamp("trade_date").defaultNow(),
  tradeValue: real("trade_value"), // Value assessment at time of trade
  currentValue: real("current_value"), // Current retrospective value
  tradeGrade: text("trade_grade"), // "A+", "A", "B+", "B", "C+", "C", "D+", "D", "F"
  notes: text("notes"), // User notes about the trade
  leagueId: text("league_id"), // External league ID for sync
  externalTradeId: text("external_trade_id"), // Platform-specific trade ID
  season: integer("season").notNull().default(2024),
  week: integer("week"), // Week the trade was made
});



export const waiverRecommendations = pgTable("waiver_recommendations", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  playerId: integer("player_id").notNull().references(() => players.id),
  priority: integer("priority").notNull(), // 1 = highest priority
  reasoning: text("reasoning").notNull(),
  projectedImpact: real("projected_impact"), // Expected fantasy points gain
  usageTrend: text("usage_trend"), // "rising", "stable", "declining"
  createdAt: timestamp("created_at").defaultNow(),
});

export const injuryTracker = pgTable("injury_tracker", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  injuryType: text("injury_type"),
  severity: text("severity"), // "minor", "moderate", "major"
  expectedReturn: timestamp("expected_return"),
  impactDescription: text("impact_description"),
  replacementSuggestions: text("replacement_suggestions"), // JSON array of suggested replacement player IDs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
});

export const insertTeamPlayerSchema = createInsertSchema(teamPlayers).omit({
  id: true,
});

export const insertPositionAnalysisSchema = createInsertSchema(positionAnalysis).omit({
  id: true,
});

export const insertWeeklyPerformanceSchema = createInsertSchema(weeklyPerformance).omit({
  id: true,
});

// Advanced Analytics Insert Schemas
export const insertMatchupAnalysisSchema = createInsertSchema(matchupAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertLineupOptimizationSchema = createInsertSchema(lineupOptimization).omit({
  id: true,
  createdAt: true,
});

export const insertTradeAnalysisSchema = createInsertSchema(tradeAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertWaiverRecommendationsSchema = createInsertSchema(waiverRecommendations).omit({
  id: true,
  createdAt: true,
});

export const insertInjuryTrackerSchema = createInsertSchema(injuryTracker).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Fantasy Moves Tracking Tables
export const fantasyMoves = pgTable("fantasy_moves", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  moveType: text("move_type").notNull(), // "trade", "draft", "waiver", "free_agent"
  moveDate: timestamp("move_date").notNull(),
  description: text("description").notNull(), // "Traded for Josh Allen", "Drafted Brian Thomas Jr."
  
  // Value tracking
  valueGained: integer("value_gained").notNull(), // Dynasty points gained
  valueLost: integer("value_lost").notNull(), // Dynasty points lost  
  netValue: integer("net_value").notNull(), // Net gain/loss
  
  // Move details
  playersAcquired: jsonb("players_acquired"), // [{id, name, position, valueAtTime}]
  playersLost: jsonb("players_lost"), // [{id, name, position, valueAtTime}]
  picksAcquired: jsonb("picks_acquired"), // [{round, pick, year, valueAtTime}]
  picksLost: jsonb("picks_lost"), // [{round, pick, year, valueAtTime}]
  
  // Current evaluation
  currentValueGained: integer("current_value_gained"), // Current dynasty value of acquired assets
  currentValueLost: integer("current_value_lost"), // Current dynasty value of lost assets  
  currentNetValue: integer("current_net_value"), // Current net value
  
  // Metadata
  tradePartner: text("trade_partner"), // For trades
  waiverPriority: integer("waiver_priority"), // For waivers
  season: integer("season").notNull(),
  week: integer("week"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const draftPicks = pgTable("draft_picks", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  round: integer("round").notNull(),
  pick: integer("pick").notNull(), // Overall pick number
  originalPick: text("original_pick").notNull(), // "1.12", "2.03", etc.
  year: integer("year").notNull(),
  playerId: integer("player_id").references(() => players.id), // If picked
  playerName: text("player_name"), // Player selected
  position: text("position"), // Position of player selected
  
  // Valuation at time of pick
  pickValue: integer("pick_value").notNull(), // Dynasty value of pick slot
  playerCurrentValue: integer("player_current_value"), // Current dynasty value of player
  
  // Trade context if applicable
  acquiredVia: text("acquired_via"), // "original", "trade", "compensatory"
  tradeContext: text("trade_context"), // Description of how pick was acquired
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerValueHistory = pgTable("player_value_history", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  date: timestamp("date").notNull(),
  dynastyValue: integer("dynasty_value").notNull(),
  source: text("source").notNull(), // "DynastyDataLab", "estimated"
  adp: real("adp"), // Average draft position
  ownership: real("ownership"), // Ownership percentage
  
  // Context
  season: integer("season").notNull(),
  week: integer("week"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Value Arbitrage Tables
export const marketData = pgTable("market_data", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  source: varchar("source", { length: 50 }).notNull(), // 'fantasypros', 'dynastydatalab', 'sportsdata'
  adp: real("adp"),
  adpRank: integer("adp_rank"),
  ownershipPercent: real("ownership_percent"),
  tradeValue: real("trade_value"),
  consensusRank: integer("consensus_rank"),
  week: integer("week"),
  season: integer("season").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const valueArbitrage = pgTable("value_arbitrage", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  adpValue: real("adp_value"), // Current ADP ranking
  metricsScore: real("metrics_score"), // Calculated score from advanced metrics
  valueGap: real("value_gap"), // Difference between metrics and ADP
  recommendation: varchar("recommendation", { length: 20 }).notNull(), // 'undervalued', 'overvalued', 'fair'
  confidence: real("confidence"), // 0-100 confidence score
  reasonCode: varchar("reason_code", { length: 100 }), // Primary metric driving recommendation
  weeklyChange: real("weekly_change"), // Change in value gap from previous week
  targetShare: real("target_share"),
  yardsPerRouteRun: real("yards_per_route_run"),
  airYards: real("air_yards"),
  redZoneTargets: integer("red_zone_targets"),
  snapCountPercent: real("snap_count_percent"),
  week: integer("week").notNull(),
  season: integer("season").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Add unique constraint for player per week/season
  playerWeekSeasonUnique: unique().on(table.playerId, table.week, table.season),
}));

export const metricCorrelations = pgTable("metric_correlations", {
  id: serial("id").primaryKey(),
  position: varchar("position", { length: 10 }).notNull(),
  metricName: varchar("metric_name", { length: 100 }).notNull(),
  correlationToFantasy: real("correlation_to_fantasy"), // -1 to 1 correlation with fantasy points
  correlationToAdp: real("correlation_to_adp"), // -1 to 1 correlation with ADP
  sampleSize: integer("sample_size"),
  season: integer("season").notNull(),
  lastCalculated: timestamp("last_calculated").defaultNow(),
});

export const insertMarketDataSchema = createInsertSchema(marketData).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertValueArbitrageSchema = createInsertSchema(valueArbitrage).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertMetricCorrelationsSchema = createInsertSchema(metricCorrelations).omit({
  id: true,
  lastCalculated: true,
});

export const insertFantasyMovesSchema = createInsertSchema(fantasyMoves).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDraftPicksSchema = createInsertSchema(draftPicks).omit({
  id: true,
  createdAt: true,
});

export const insertPlayerValueHistorySchema = createInsertSchema(playerValueHistory).omit({
  id: true,
  createdAt: true,
});

// Types
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type PositionAnalysis = typeof positionAnalysis.$inferSelect;
export type WeeklyPerformance = typeof weeklyPerformance.$inferSelect;
export type MatchupAnalysis = typeof matchupAnalysis.$inferSelect;
export type LineupOptimization = typeof lineupOptimization.$inferSelect;
export type TradeAnalysis = typeof tradeAnalysis.$inferSelect;
export type DynastyTradeHistory = typeof dynastyTradeHistory.$inferSelect;
export type WaiverRecommendations = typeof waiverRecommendations.$inferSelect;
export type InjuryTracker = typeof injuryTracker.$inferSelect;
export type MarketData = typeof marketData.$inferSelect;
export type ValueArbitrage = typeof valueArbitrage.$inferSelect;
export type MetricCorrelations = typeof metricCorrelations.$inferSelect;
export type FantasyMove = typeof fantasyMoves.$inferSelect;
export type DraftPick = typeof draftPicks.$inferSelect;
export type PlayerValueHistory = typeof playerValueHistory.$inferSelect;

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertTeamPlayer = z.infer<typeof insertTeamPlayerSchema>;
export type InsertPositionAnalysis = z.infer<typeof insertPositionAnalysisSchema>;
export type InsertWeeklyPerformance = z.infer<typeof insertWeeklyPerformanceSchema>;
export type InsertMatchupAnalysis = z.infer<typeof insertMatchupAnalysisSchema>;
export type InsertLineupOptimization = z.infer<typeof insertLineupOptimizationSchema>;
export type InsertTradeAnalysis = z.infer<typeof insertTradeAnalysisSchema>;
export type InsertWaiverRecommendations = z.infer<typeof insertWaiverRecommendationsSchema>;
export type InsertInjuryTracker = z.infer<typeof insertInjuryTrackerSchema>;
export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;
export type InsertValueArbitrage = z.infer<typeof insertValueArbitrageSchema>;
export type InsertMetricCorrelations = z.infer<typeof insertMetricCorrelationsSchema>;

// Game Logs types
export type GameLog = typeof gameLogs.$inferSelect;
export type InsertGameLog = typeof gameLogs.$inferInsert;

export const insertGameLogSchema = createInsertSchema(gameLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGameLogType = z.infer<typeof insertGameLogSchema>;

// Article schema and types
export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  publishDate: true,
  lastUpdated: true,
  viewCount: true,
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type InsertFantasyMove = z.infer<typeof insertFantasyMovesSchema>;
export type InsertDraftPick = z.infer<typeof insertDraftPicksSchema>;
export type InsertPlayerValueHistory = z.infer<typeof insertPlayerValueHistorySchema>;

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  teamPlayers: many(teamPlayers),
  positionAnalyses: many(positionAnalysis),
  weeklyPerformances: many(weeklyPerformance),
}));

export const playersRelations = relations(players, ({ many }) => ({
  teamPlayers: many(teamPlayers),
  gameLogs: many(gameLogs),
}));

export const gameLogsRelations = relations(gameLogs, ({ one }) => ({
  player: one(players, {
    fields: [gameLogs.playerId],
    references: [players.id],
  }),
}));

// OTC Consensus Engine v1.1 Tables
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").notNull().unique(),
  consentConsensus: boolean("consent_consensus").default(false),
  fireScore: integer("fire_score").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userRanks = pgTable("user_ranks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => userProfiles.id),
  format: varchar("format", { enum: ["dynasty", "redraft"] }).notNull(),
  season: integer("season"), // required for redraft, null for dynasty
  pos: varchar("pos", { enum: ["QB", "RB", "WR", "TE", "ALL"] }).notNull(),
  playerId: varchar("player_id").notNull(),
  rank: integer("rank").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fireEvents = pgTable("fire_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").notNull().references(() => userProfiles.id),
  toUserId: varchar("to_user_id").notNull().references(() => userProfiles.id),
  targetType: varchar("target_type", { enum: ["rankingSet", "profile"] }).notNull(),
  targetId: varchar("target_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for consensus engine
export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  userRanks: many(userRanks),
  fireEventsGiven: many(fireEvents, { relationName: "fireEventsGiven" }),
  fireEventsReceived: many(fireEvents, { relationName: "fireEventsReceived" }),
}));

export const userRanksRelations = relations(userRanks, ({ one }) => ({
  user: one(userProfiles, {
    fields: [userRanks.userId],
    references: [userProfiles.id],
  }),
}));

export const fireEventsRelations = relations(fireEvents, ({ one }) => ({
  fromUser: one(userProfiles, {
    fields: [fireEvents.fromUserId],
    references: [userProfiles.id],
    relationName: "fireEventsGiven",
  }),
  toUser: one(userProfiles, {
    fields: [fireEvents.toUserId],
    references: [userProfiles.id],
    relationName: "fireEventsReceived",
  }),
}));

// Insert schemas for consensus engine
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertUserRankSchema = createInsertSchema(userRanks).omit({
  id: true,
  updatedAt: true,
});

export const insertFireEventSchema = createInsertSchema(fireEvents).omit({
  id: true,
  createdAt: true,
});

// Types for consensus engine
export type UserProfile = typeof userProfiles.$inferSelect;
export type UpsertUserProfile = typeof userProfiles.$inferInsert;
export type UserRank = typeof userRanks.$inferSelect;
export type UpsertUserRank = typeof userRanks.$inferInsert;
export type FireEvent = typeof fireEvents.$inferSelect;
export type UpsertFireEvent = typeof fireEvents.$inferInsert;

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type InsertUserRank = z.infer<typeof insertUserRankSchema>;
export type InsertFireEvent = z.infer<typeof insertFireEventSchema>;

// OTC Consensus Command Router v1 types
export type ConsensusRank = typeof consensusRanks.$inferSelect;
export type InsertConsensusRank = typeof consensusRanks.$inferInsert;
export type ConsensusAudit = typeof consensusAudit.$inferSelect;
export type InsertConsensusAudit = typeof consensusAudit.$inferInsert;

// OTC Consensus Command Router v1 - dedicated consensus ranking system
export const consensusRanks = pgTable("consensus_ranks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  season: integer("season").notNull().default(2025),
  mode: varchar("mode", { enum: ["redraft", "dynasty"] }).notNull(),
  position: varchar("position", { enum: ["QB", "RB", "WR", "TE", "ALL"] }).notNull(),
  rank: integer("rank").notNull(),
  playerId: varchar("player_id").notNull(),
  sourceUser: varchar("source_user").notNull().default("architect-j"),
  sourceWeight: real("source_weight").notNull().default(1.0),
  note: varchar("note"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueRanking: uniqueIndex("unique_consensus_rank").on(table.season, table.mode, table.position, table.rank),
}));

export const consensusAudit = pgTable("consensus_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  season: integer("season").notNull(),
  mode: varchar("mode").notNull(),
  position: varchar("position").notNull(),
  rank: integer("rank").notNull(),
  playerId: varchar("player_id").notNull(),
  previousPlayerId: varchar("previous_player_id"),
  sourceUser: varchar("source_user").notNull(),
  action: varchar("action", { enum: ["insert", "update", "swap", "shift"] }).notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Note: Consensus board tables defined below with proper enums

export const teamPlayersRelations = relations(teamPlayers, ({ one }) => ({
  team: one(teams, {
    fields: [teamPlayers.teamId],
    references: [teams.id],
  }),
  player: one(players, {
    fields: [teamPlayers.playerId],
    references: [players.id],
  }),
}));

export const positionAnalysisRelations = relations(positionAnalysis, ({ one }) => ({
  team: one(teams, {
    fields: [positionAnalysis.teamId],
    references: [teams.id],
  }),
}));

export const weeklyPerformanceRelations = relations(weeklyPerformance, ({ one }) => ({
  team: one(teams, {
    fields: [weeklyPerformance.teamId],
    references: [teams.id],
  }),
}));

export const fantasyMovesRelations = relations(fantasyMoves, ({ one }) => ({
  team: one(teams, {
    fields: [fantasyMoves.teamId],
    references: [teams.id],
  }),
}));

export const draftPicksRelations = relations(draftPicks, ({ one }) => ({
  team: one(teams, {
    fields: [draftPicks.teamId],
    references: [teams.id],
  }),
  player: one(players, {
    fields: [draftPicks.playerId],
    references: [players.id],
  }),
}));

export const playerValueHistoryRelations = relations(playerValueHistory, ({ one }) => ({
  player: one(players, {
    fields: [playerValueHistory.playerId],
    references: [players.id],
  }),
}));

// Consensus system tables
export const consensusFormatEnum = pgEnum("consensus_format", ["redraft", "dynasty"]);
export const consensusSourceEnum = pgEnum("consensus_source", ["system", "editor", "community"]);

export const consensusBoard = pgTable("consensus_board", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  format: consensusFormatEnum("format").notNull(),
  season: integer("season"), // required for redraft, null for dynasty
  rank: integer("rank").notNull(),
  tier: varchar("tier").notNull(),
  score: real("score").notNull(),
  source: consensusSourceEnum("source").notNull().default("system"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("consensus_unique_player_format_season").on(table.format, table.season, table.playerId),
  index("consensus_format_season_rank_idx").on(table.format, table.season, table.rank),
  index("consensus_format_season_updated_idx").on(table.format, table.season, table.updatedAt),
]);

export const consensusMeta = pgTable("consensus_meta", {
  id: varchar("id").primaryKey().default("singleton"),
  defaultFormat: consensusFormatEnum("default_format").notNull().default("dynasty"),
  boardVersion: integer("board_version").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const consensusChangelog = pgTable("consensus_changelog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id"),
  format: consensusFormatEnum("format").notNull(),
  season: integer("season"),
  playerId: varchar("player_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
}, (table) => [
  index("consensus_changelog_timestamp_idx").on(table.timestamp),
  index("consensus_changelog_player_idx").on(table.playerId),
]);

// Consensus Engine Types
export type ConsensusBoard = typeof consensusBoard.$inferSelect;
export type InsertConsensusBoard = typeof consensusBoard.$inferInsert;
export type ConsensusMeta = typeof consensusMeta.$inferSelect;
export type InsertConsensusMeta = typeof consensusMeta.$inferInsert;
export type ConsensusChangelog = typeof consensusChangelog.$inferSelect;
export type InsertConsensusChangelog = typeof consensusChangelog.$inferInsert;

// Adaptive Consensus Engine Tables
export const playerInjuries = pgTable("player_injuries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  status: varchar("status", { 
    enum: ["ACTIVE", "OUT", "IR", "PUP", "QUESTIONABLE", "DOUBTFUL"] 
  }).notNull(),
  injuryType: varchar("injury_type", {
    enum: ["ACL", "Achilles", "Hamstring", "Concussion", "Ankle", "Knee", "Shoulder", "Back", "Other"]
  }),
  datePlaced: timestamp("date_placed"),
  estReturnWeeks: integer("est_return_weeks"),
  outForSeason: boolean("out_for_season").default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerBios = pgTable("player_bios", {
  playerId: varchar("player_id").primaryKey(),
  pos: varchar("pos", { enum: ["QB", "RB", "WR", "TE"] }).notNull(),
  age: integer("age").notNull(),
  team: varchar("team"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const playerUsageWeekly = pgTable("player_usage_weekly", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  week: integer("week").notNull(),
  season: integer("season").notNull(),
  snapShare: real("snap_share"),
  routesRun: integer("routes_run"),
  touches: integer("touches"),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  uniqueIndex("usage_player_week_season").on(table.playerId, table.week, table.season),
]);

export const consensusExplanations = pgTable("consensus_explanations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  format: varchar("format", { enum: ["dynasty", "redraft"] }).notNull(),
  season: integer("season"),
  decayDays: integer("decay_days").notNull(),
  surgeActive: boolean("surge_active").default(false),
  baseRank: real("base_rank").notNull(),
  adjustedRank: real("adjusted_rank").notNull(),
  explanation: jsonb("explanation").notNull(), // Full explanation object
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  uniqueIndex("explanation_player_format_season").on(table.playerId, table.format, table.season),
]);

export type PlayerInjury = typeof playerInjuries.$inferSelect;
export type InsertPlayerInjury = typeof playerInjuries.$inferInsert;
export type PlayerBio = typeof playerBios.$inferSelect;
export type InsertPlayerBio = typeof playerBios.$inferInsert;
export type PlayerUsageWeekly = typeof playerUsageWeekly.$inferSelect;
export type InsertPlayerUsageWeekly = typeof playerUsageWeekly.$inferInsert;
export type ConsensusExplanationRow = typeof consensusExplanations.$inferSelect;
export type InsertConsensusExplanation = typeof consensusExplanations.$inferInsert;

// Strength of Schedule (SOS) Tables
export const defenseVP = pgTable("defense_dvp", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  defTeam: text("def_team").notNull(),
  position: text("position").notNull(), // 'RB','WR','QB','TE'
  fpAllowed: real("fp_allowed").notNull(), // fantasy points allowed per game
  ydsPerAtt: real("yds_per_att"), // optional for v2
  rzTdRate: real("rz_td_rate"), // optional for v2
  injAdj: real("inj_adj").default(0), // optional
  last4Avg: real("last4_avg"), // Grok's trailing 4-week average
}, (table) => ({
  uniqueDefenseWeek: unique().on(table.season, table.week, table.defTeam, table.position),
}));

export const schedule = pgTable("schedule", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  home: text("home").notNull(),
  away: text("away").notNull(),
}, (table) => ({
  uniqueGame: unique().on(table.season, table.week, table.home, table.away),
}));

export const sosScores = pgTable("sos_scores", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  team: text("team").notNull(), // offense team
  opponent: text("opponent").notNull(), // defense team
  position: text("position").notNull(),
  sosScore: real("sos_score").notNull(), // 0-100 (higher = easier)
  tier: text("tier").notNull(), // 'green','yellow','red'
}, (table) => ({
  uniqueSOS: unique().on(table.season, table.week, table.team, table.position),
}));

// SOSv2 Contextual Defense Data Table
export const defenseContext = pgTable("defense_context", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  defTeam: text("def_team").notNull(),
  epaPerPlayAllowed: real("epa_per_play_allowed"),
  playsAllowedPerGame: real("plays_allowed_per_game"),
  rzTdRateAllowed: real("rz_td_rate_allowed"),
  homeDefAdj: real("home_def_adj"),
  awayDefAdj: real("away_def_adj"),
}, (table) => ({
  uniqueDefenseContext: unique().on(table.season, table.week, table.defTeam),
}));

// User Customizable SOS Dashboard Tables
export const sosDashboards = pgTable("sos_dashboards", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Session-based or auth user ID
  name: text("name").notNull(), // "My RB Dashboard", "Week 1 Analysis"
  isDefault: boolean("is_default").default(false),
  config: jsonb("config").notNull(), // Dashboard configuration JSON
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueUserDashboard: unique().on(table.userId, table.name),
}));

export const sosWidgets = pgTable("sos_widgets", {
  id: serial("id").primaryKey(),
  dashboardId: integer("dashboard_id").references(() => sosDashboards.id, { onDelete: 'cascade' }),
  widgetType: text("widget_type").notNull(), // 'weekly', 'ros', 'chart', 'filter'
  position: jsonb("position").notNull(), // {x, y, w, h} for grid layout
  config: jsonb("config").notNull(), // Widget-specific configuration
  isVisible: boolean("is_visible").default(true),
});

export const sosUserPreferences = pgTable("sos_user_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  defaultPositions: jsonb("default_positions").default(['RB', 'WR']), // Array of preferred positions
  defaultWeekRange: jsonb("default_week_range").default({start: 1, end: 5}), // Week range for ROS
  favoriteTeams: jsonb("favorite_teams").default([]), // Array of team abbreviations
  tierThresholds: jsonb("tier_thresholds").default({green: 67, yellow: 33}), // Custom tier boundaries
  viewPreferences: jsonb("view_preferences").default({showCharts: true, showTable: true}),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SOS Type Exports
export type DefenseVP = typeof defenseVP.$inferSelect;
export type InsertDefenseVP = typeof defenseVP.$inferInsert;
export type Schedule = typeof schedule.$inferSelect;
export type InsertSchedule = typeof schedule.$inferInsert;
export type SOSScore = typeof sosScores.$inferSelect;
export type InsertSOSScore = typeof sosScores.$inferInsert;

// 2024 Player Season Stats - Complete season data for leaderboards
export const playerSeason2024 = pgTable("player_season_2024", {
  id: serial("id").primaryKey(),
  playerId: text("player_id"),
  playerName: text("player_name").notNull(),
  position: text("position").notNull(),
  team: text("team"),
  games: integer("games"),
  
  // Receiving stats
  targets: integer("targets"),
  receptions: integer("receptions"), 
  recYards: integer("rec_yards"),
  recTds: integer("rec_tds"),
  routes: integer("routes"),
  yprr: real("yprr"), // Yards per route run
  adot: real("adot"), // Average depth of target
  racr: real("racr"), // Receiver air conversion ratio
  targetShare: real("target_share"),
  wopr: real("wopr"), // Weighted opportunity rating
  
  // Rushing stats
  rushAtt: integer("rush_att"),
  rushYards: integer("rush_yards"),
  rushTds: integer("rush_tds"),
  rushYpc: real("rush_ypc"), // Yards per carry
  rushYacPerAtt: real("rush_yac_per_att"),
  rushMtf: integer("rush_mtf"), // Missed tackles forced
  rushExpl10p: real("rush_expl_10p"), // Explosive run rate (10+ yards)
  
  // QB passing stats
  cmp: integer("cmp"), // Completions
  att: integer("att"), // Attempts
  cmpPct: real("cmp_pct"), // Completion percentage
  passYards: integer("pass_yards"),
  passTds: integer("pass_tds"),
  int: integer("int"), // Interceptions
  ypa: real("ypa"), // Yards per attempt
  aypa: real("aypa"), // Air yards per attempt
  epaPerPlay: real("epa_per_play"), // Expected points added per play
  
  // QB rushing stats
  qbRushYards: integer("qb_rush_yards"),
  qbRushTds: integer("qb_rush_tds"),
  
  // Fantasy points
  fpts: real("fpts"), // Standard fantasy points
  fptsPpr: real("fpts_ppr"), // PPR fantasy points
  
  // Total TDs (for RB)
  tdTotal: integer("td_total"),
  
  // Metadata
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  positionIdx: index("player_season_2024_position_idx").on(table.position),
  teamIdx: index("player_season_2024_team_idx").on(table.team),
  uniquePlayer: unique("player_season_2024_unique").on(table.playerName, table.position, table.team),
}));

export type SOSDashboard = typeof sosDashboards.$inferSelect;
export type InsertSOSDashboard = typeof sosDashboards.$inferInsert;
export type SOSWidget = typeof sosWidgets.$inferSelect;
export type InsertSOSWidget = typeof sosWidgets.$inferInsert;
export type SOSUserPreferences = typeof sosUserPreferences.$inferSelect;
export type InsertSOSUserPreferences = typeof sosUserPreferences.$inferInsert;

export const playerAdvanced2024 = pgTable("player_advanced_2024", {
  id: serial("id").primaryKey(),
  playerId: text("player_id"),
  playerName: text("player_name"),
  team: text("team"),
  position: text("position"),
  games: smallint("games"),
  
  // WR/TE advanced metrics
  adot: real("adot"), // Average depth of target
  yprr: real("yprr"), // Yards per route run (null in v1.5)
  racr: real("racr"), // Receiver air conversion ratio
  targetShare: real("target_share"), // Target share
  wopr: real("wopr"), // Weighted opportunity rating
  
  // RB advanced metrics
  rushExpl10p: real("rush_expl_10p"), // Explosive rush percentage (10+ yards)
  
  // QB advanced metrics  
  aypa: real("aypa"), // Adjusted yards per attempt
  epaPerPlay: real("epa_per_play") // EPA per play
}, (table) => ({
  playerIdIdx: index("player_advanced_2024_player_id_idx").on(table.playerId),
  positionIdx: index("player_advanced_2024_position_idx").on(table.position),
}));

// 2024 Player Season Types
export type PlayerSeason2024 = typeof playerSeason2024.$inferSelect;
export type InsertPlayerSeason2024 = typeof playerSeason2024.$inferInsert;
export type PlayerAdvanced2024 = typeof playerAdvanced2024.$inferSelect;
export type InsertPlayerAdvanced2024 = typeof playerAdvanced2024.$inferInsert;

// Tiber Memory System - Knowledge base for storing learned insights
export const tiberMemory = pgTable("tiber_memory", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // e.g., "draft_analysis", "player_eval", "market_trends"
  title: text("title").notNull(),
  content: text("content").notNull(), // Main knowledge content
  insights: jsonb("insights").default('[]'), // Key insights as JSON array
  tags: text("tags").array().default([]), // Searchable tags
  source: text("source"), // Where this knowledge came from
  confidence: real("confidence").default(0.8), // How confident Tiber is in this knowledge
  lastAccessed: timestamp("last_accessed"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertTiberMemorySchema = createInsertSchema(tiberMemory).omit({ id: true, createdAt: true, updatedAt: true });
export type TiberMemory = typeof tiberMemory.$inferSelect;
export type InsertTiberMemory = z.infer<typeof insertTiberMemorySchema>;

// ========================================
// ROOKIE RISERS SYSTEM TABLES
// ========================================

// Rookie Weekly Usage Table - Raw usage signals for waiver heat calculation
export const rookieWeeklyUsage = pgTable("rookie_weekly_usage", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  snapPct: real("snap_pct"), // Offensive snap percentage
  routes: integer("routes"), // Routes run (WR/TE)
  targets: integer("targets"), // Targets (WR/TE)
  carries: integer("carries"), // Carries (RB)
  touches: integer("touches"), // Total touches (carries + targets)
  rzTargets: integer("rz_targets"), // Red zone targets
  rzCarries: integer("rz_carries"), // Red zone carries
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Grok's performance indices
  seasonWeekIdx: index("rookie_usage_season_week_idx").on(table.season, table.week),
  playerSeasonIdx: index("rookie_usage_player_season_idx").on(table.playerId, table.season),
  uniquePlayerWeek: unique("rookie_usage_unique").on(table.playerId, table.season, table.week),
}));

// Rookie Context Signals Table - Market and situational context
export const rookieContextSignals = pgTable("rookie_context_signals", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  injuryOpening: boolean("injury_opening").default(false), // Team injury opens opportunity
  depthChartRank: integer("depth_chart_rank"), // Position on depth chart (1=starter)
  newsWeight: real("news_weight"), // 0-1 coach quotes/beat reports strength
  marketRostership: real("market_rostership"), // 0-1 rostership percentage
  marketStartPct: real("market_start_pct"), // 0-1 start percentage  
  adpDelta: real("adp_delta"), // ADP movement (negative = market lag)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  seasonWeekIdx: index("context_season_week_idx").on(table.season, table.week),
  playerSeasonIdx: index("context_player_season_idx").on(table.playerId, table.season),
  uniquePlayerWeek: unique("context_unique").on(table.playerId, table.season, table.week),
}));

// Rookie Risers Snapshots - Weekly official Waiver Heat records (Hybrid Model backbone)
export const rookieRiserSnapshots = pgTable("rookie_riser_snapshots", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  usageGrowth: real("usage_growth"), // 0-1 normalized usage growth score
  opportunityDelta: real("opportunity_delta"), // 0-1 opportunity from injuries/depth
  marketLag: real("market_lag"), // 0-1 market inefficiency score
  newsWeight: real("news_weight"), // 0-1 beat reports/coach quotes
  waiverHeat: integer("waiver_heat"), // 0-100 final Waiver Heat Index
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Grok's recommended indices for performance
  createdAtIdx: index("snapshots_created_at_idx").on(table.createdAt),
  seasonWeekIdx: index("snapshots_season_week_idx").on(table.season, table.week),
  heatIdx: index("snapshots_heat_idx").on(table.waiverHeat),
  uniquePlayerWeek: unique("snapshots_unique").on(table.playerId, table.season, table.week),
}));

// Rookie Risers Types
export type RookieWeeklyUsage = typeof rookieWeeklyUsage.$inferSelect;
export type InsertRookieWeeklyUsage = typeof rookieWeeklyUsage.$inferInsert;
export type RookieContextSignals = typeof rookieContextSignals.$inferSelect;
export type InsertRookieContextSignals = typeof rookieContextSignals.$inferInsert;
export type RookieRiserSnapshots = typeof rookieRiserSnapshots.$inferSelect;
export type InsertRookieRiserSnapshots = typeof rookieRiserSnapshots.$inferInsert;

// Rookie Risers Insert Schemas
export const insertRookieWeeklyUsageSchema = createInsertSchema(rookieWeeklyUsage).omit({ id: true, createdAt: true });
export const insertRookieContextSignalsSchema = createInsertSchema(rookieContextSignals).omit({ id: true, createdAt: true });
export const insertRookieRiserSnapshotsSchema = createInsertSchema(rookieRiserSnapshots).omit({ id: true, createdAt: true });

// ========================================
// ADVANCED SIGNALS TABLE (GROK'S ENHANCEMENT)
// ========================================

// Advanced Signals table - Captures derived metrics like efficiency, trends for better signal detection
// Enables multi-faceted reasoning for rankings, like chaining efficiency to projected TDs
export const advancedSignals = pgTable("advanced_signals", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(), // FK to players.id (using text to match existing pattern)
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  
  // Efficiency metrics (Grok's recommendations)
  ypc: real("ypc"), // Yards per carry
  snapShare: real("snap_share"), // Float 0-1 (percentage of team snaps)
  epaRush: real("epa_rush"), // Expected points added per rush
  brokenTackles: integer("broken_tackles"), // Broken tackles count
  redzoneTouches: integer("redzone_touches"), // Red zone touches
  
  // Trend analysis (3-week rolling context)
  trendMultiplier: real("trend_multiplier"), // Weighted 3-week avg performance (e.g., 1.2 = 20% above baseline)
  rollingAvg3wk: jsonb("rolling_avg_3wk"), // JSONB for flexible rolling averages (yards, TDs, etc.)
  opponentAdjustedScore: real("opponent_adjusted_score"), // Matchup-adjusted performance factoring run defense
  
  // Advanced metrics for WR/TE/QB
  targetShare: real("target_share"), // WR/TE target share within team
  airyards: real("air_yards"), // Average depth of target (aDOT)
  separationScore: real("separation_score"), // Receiver separation (if available from NextGen)
  pressureRate: real("pressure_rate"), // QB pressure faced percentage
  
  // Market/Usage context
  usageSpike: boolean("usage_spike").default(false), // Weekly usage anomaly flag
  injuryOpportunity: boolean("injury_opportunity").default(false), // Benefiting from teammate injury
  
  // Metadata
  dataSource: text("data_source").default('computed'), // 'nfl-data-py', 'sleeper', 'computed', 'nextgen'
  confidence: real("confidence").default(0.8), // Data quality confidence 0-1
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  // Composite unique constraint to prevent duplicates
  unique: unique("advanced_signals_unique").on(table.playerId, table.season, table.week),
  // Indexes for efficient queries (Grok's performance optimization)
  playerSeasonIdx: index("advanced_signals_player_season_idx").on(table.playerId, table.season),
  weekIdx: index("advanced_signals_week_idx").on(table.week),
  trendIdx: index("advanced_signals_trend_idx").on(table.trendMultiplier),
}));

export const advancedSignalsRelations = relations(advancedSignals, ({ one }) => ({
  player: one(players, {
    fields: [advancedSignals.playerId],
    references: [players.id]
  })
}));

// Advanced Signals Types
export type AdvancedSignals = typeof advancedSignals.$inferSelect;
export type InsertAdvancedSignals = typeof advancedSignals.$inferInsert;
export const insertAdvancedSignalsSchema = createInsertSchema(advancedSignals).omit({ id: true, lastUpdated: true });

// ========================================
// BUYS/SELLS TRADE ADVICE MODEL TABLES
// ========================================

// Player Week Facts - Weekly player statistics and advanced metrics for trade advice calculations
export const playerWeekFacts = pgTable("player_week_facts", {
  playerId: text("player_id").notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  position: text("position").notNull(),
  
  // Core power ranking columns that exist in the database
  usageNow: real("usage_now").notNull().default(0),
  talent: real("talent").notNull().default(0),
  environment: real("environment").notNull().default(0),
  availability: real("availability").notNull().default(0),
  marketAnchor: real("market_anchor").notNull().default(0),
  powerScore: real("power_score").notNull().default(0),
  confidence: real("confidence").notNull().default(0.5),
  flags: text("flags").array().notNull().default([]),
  lastUpdate: timestamp("last_update").notNull().defaultNow(),
  
  // Core ranking stats (TODO: Add these columns to database if needed)
  // tiberRank: integer("tiber_rank"),
  // ecrRank: integer("ecr_rank"),
  
  // New columns for trade advice model
  adpRank: integer("adp_rank"),
  snapShare: real("snap_share"),
  routesPerGame: real("routes_per_game"),
  targetsPerGame: real("targets_per_game"),
  rzTouches: real("rz_touches"),
  epaPerPlay: real("epa_per_play"),
  yprr: real("yprr"),
  yacPerAtt: real("yac_per_att"),
  mtfPerTouch: real("mtf_per_touch"),
  teamProe: real("team_proe"),
  paceRankPercentile: real("pace_rank_percentile"), // 0..100
  olTier: integer("ol_tier"),
  sosNext2: real("sos_next2"),
  injuryPracticeScore: real("injury_practice_score"), // 0..1
  committeeIndex: real("committee_index"), // 0..1
  coachVolatility: real("coach_volatility"), // 0..1
  ecr7dDelta: integer("ecr_7d_delta"),
  byeWeek: boolean("bye_week").default(false), // For redraft downgrade
  rostered7dDelta: real("rostered_7d_delta").default(0), // % change
  started7dDelta: real("started_7d_delta").default(0), // % change
}, (table) => ({
  // Primary key constraint using composite key
  primaryKey: primaryKey({ columns: [table.playerId, table.season, table.week] }),
  // Indexes for performance
  seasonWeekPosIdx: index("pwf_season_week_pos_idx").on(table.season, table.week, table.position),
  playerSeasonIdx: index("pwf_player_season_idx").on(table.playerId, table.season),
}));

// Buys/Sells Trade Advice - Weekly trade recommendations with supporting data
export const buysSells = pgTable("buys_sells", {
  playerId: text("player_id").notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  position: text("position").notNull(),
  verdict: verdictEnum("verdict").notNull(), // BUY_HARD | BUY | WATCH_BUY | HOLD | WATCH_SELL | SELL | SELL_HARD
  verdictScore: real("verdict_score").notNull(),
  confidence: real("confidence").notNull(), // 0..1
  gapZ: real("gap_z").notNull(),
  signal: real("signal").notNull(),
  marketMomentum: real("market_momentum").notNull(),
  riskPenalty: real("risk_penalty").notNull(),
  format: formatEnum("format").notNull(), // redraft | dynasty
  ppr: pprEnum("ppr").notNull(), // ppr | half | standard
  proof: jsonb("proof").notNull(), // Metrics cited
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  hitRate: real("hit_rate"), // Backtest metric
}, (table) => ({
  // Primary key constraint
  primaryKey: primaryKey({ columns: [table.playerId, table.season, table.week, table.format, table.ppr] }),
  // Index for filtering
  weekFiltersIdx: index("bs_week_filters_idx").on(table.season, table.week, table.position, table.format, table.ppr),
}));

// Player Week Facts Relations
export const playerWeekFactsRelations = relations(playerWeekFacts, ({ one }) => ({
  player: one(players, {
    fields: [playerWeekFacts.playerId],
    references: [players.sleeperId]
  })
}));

// Buys/Sells Relations
export const buysSellsRelations = relations(buysSells, ({ one }) => ({
  player: one(players, {
    fields: [buysSells.playerId],
    references: [players.sleeperId]
  })
}));

// Insert Schemas
export const insertPlayerWeekFactsSchema = createInsertSchema(playerWeekFacts).omit({
  lastUpdate: true,
});

export const insertBuysSellsSchema = createInsertSchema(buysSells).omit({
  createdAt: true,
});

// Types
export type PlayerWeekFacts = typeof playerWeekFacts.$inferSelect;
export type InsertPlayerWeekFacts = z.infer<typeof insertPlayerWeekFactsSchema>;
export type BuysSells = typeof buysSells.$inferSelect;
export type InsertBuysSells = z.infer<typeof insertBuysSellsSchema>;
