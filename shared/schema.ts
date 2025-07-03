import { pgTable, text, serial, integer, real, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
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
  consistency: real("consistency"), // Performance consistency rating
  matchupRating: real("matchup_rating"), // Upcoming matchup rating
  trend: text("trend"), // "up", "down", "stable"
  ownership: integer("ownership"), // Fantasy ownership %
  targetShare: real("target_share"), // WR/TE target share
  redZoneTargets: integer("red_zone_targets"), // Red zone targets
  carries: integer("carries"), // RB carries
  snapCount: integer("snap_count"), // Offensive snap count
  externalId: text("external_id"), // SportsDataIO player ID
});

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

// Types
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type PositionAnalysis = typeof positionAnalysis.$inferSelect;
export type WeeklyPerformance = typeof weeklyPerformance.$inferSelect;
export type MatchupAnalysis = typeof matchupAnalysis.$inferSelect;
export type LineupOptimization = typeof lineupOptimization.$inferSelect;
export type TradeAnalysis = typeof tradeAnalysis.$inferSelect;
export type WaiverRecommendations = typeof waiverRecommendations.$inferSelect;
export type InjuryTracker = typeof injuryTracker.$inferSelect;

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

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  teamPlayers: many(teamPlayers),
  positionAnalyses: many(positionAnalysis),
  weeklyPerformances: many(weeklyPerformance),
}));

export const playersRelations = relations(players, ({ many }) => ({
  teamPlayers: many(teamPlayers),
}));

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
