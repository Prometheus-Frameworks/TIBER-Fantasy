import { pgTable, text, serial, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
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

// Types
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type PositionAnalysis = typeof positionAnalysis.$inferSelect;
export type WeeklyPerformance = typeof weeklyPerformance.$inferSelect;

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertTeamPlayer = z.infer<typeof insertTeamPlayerSchema>;
export type InsertPositionAnalysis = z.infer<typeof insertPositionAnalysisSchema>;
export type InsertWeeklyPerformance = z.infer<typeof insertWeeklyPerformanceSchema>;

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
