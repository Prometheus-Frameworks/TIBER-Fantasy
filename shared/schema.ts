import { pgTable, text, serial, integer, real, boolean, timestamp, varchar, jsonb, unique, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
