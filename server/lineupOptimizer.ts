import { sportsDataAPI } from "./sportsdata";
import { storage } from "./storage";
import type { Player, InsertLineupOptimization, InsertMatchupAnalysis } from "@shared/schema";

interface OptimizedLineup {
  qb: Player;
  rb1: Player;
  rb2: Player;
  wr1: Player;
  wr2: Player;
  te: Player;
  flex: Player;
  def: Player;
  k: Player;
  bench: Player[];
}

interface MatchupDifficulty {
  opponent: string;
  difficulty: "easy" | "medium" | "hard";
  defenseRank: number;
  projectedPoints: number;
  weatherImpact?: string;
}

export class LineupOptimizerService {
  // NFL team defense rankings vs each position (1 = hardest, 32 = easiest)
  private defenseRankings = {
    QB: { "BUF": 1, "DAL": 2, "SF": 3, "PIT": 4, "MIA": 5, "BAL": 6, "DEN": 7, "GB": 8, "PHI": 9, "NYJ": 10 },
    RB: { "SF": 1, "BUF": 2, "BAL": 3, "DAL": 4, "PIT": 5, "PHI": 6, "MIA": 7, "CLE": 8, "DEN": 9, "LV": 10 },
    WR: { "SF": 1, "BUF": 2, "NYJ": 3, "DAL": 4, "CLE": 5, "PIT": 6, "MIA": 7, "DEN": 8, "BAL": 9, "NE": 10 },
    TE: { "SF": 1, "PIT": 2, "BUF": 3, "NYJ": 4, "MIA": 5, "DAL": 6, "BAL": 7, "CLE": 8, "DEN": 9, "PHI": 10 }
  };

  async optimizeLineup(teamId: number, week: number): Promise<OptimizedLineup> {
    const teamPlayers = await storage.getTeamPlayers(teamId);
    const players = teamPlayers.map(tp => tp);

    // Generate matchup analysis for all players
    const matchupPromises = players.map(player => this.analyzeMatchup(player, week));
    const matchups = await Promise.all(matchupPromises);

    // Create matchup lookup
    const matchupMap = new Map();
    matchups.forEach((matchup, index) => {
      if (matchup) {
        matchupMap.set(players[index].id, matchup);
      }
    });

    // Optimize lineup based on projections and matchups
    const optimized = this.calculateOptimalLineup(players, matchupMap);
    
    // Store optimization results
    await this.saveOptimization(teamId, week, optimized, matchupMap);

    return optimized;
  }

  private async analyzeMatchup(player: Player, week: number): Promise<MatchupDifficulty | null> {
    try {
      // Get opponent for this week (simplified - would need schedule API)
      const opponent = this.getOpponentForWeek(player.team, week);
      if (!opponent) return null;

      const position = player.position as keyof typeof this.defenseRankings;
      const defenseRank = this.defenseRankings[position]?.[opponent] || 16;
      
      // Calculate difficulty based on defense rank
      let difficulty: "easy" | "medium" | "hard";
      if (defenseRank <= 10) difficulty = "hard";
      else if (defenseRank <= 20) difficulty = "medium";
      else difficulty = "easy";

      // Adjust projected points based on matchup
      let projectedPoints = player.avgPoints;
      if (difficulty === "easy") projectedPoints *= 1.15;
      else if (difficulty === "hard") projectedPoints *= 0.85;

      // Weather impact (simplified)
      const weatherImpact = this.getWeatherImpact(opponent, week);

      const matchupAnalysis: InsertMatchupAnalysis = {
        playerId: player.id,
        week,
        opponent,
        difficulty,
        defenseRank,
        projectedPoints,
        weatherImpact,
        isHome: Math.random() > 0.5, // Simplified - would need schedule data
      };

      // Store matchup analysis
      await storage.createMatchupAnalysis(matchupAnalysis);

      return {
        opponent,
        difficulty,
        defenseRank,
        projectedPoints,
        weatherImpact
      };
    } catch (error) {
      console.error(`Error analyzing matchup for player ${player.id}:`, error);
      return null;
    }
  }

  private calculateOptimalLineup(players: Player[], matchupMap: Map<number, MatchupDifficulty>): OptimizedLineup {
    // Sort players by position and adjusted projected points
    const getAdjustedPoints = (player: Player) => {
      const matchup = matchupMap.get(player.id);
      return matchup?.projectedPoints || player.avgPoints;
    };

    const qbs = players.filter(p => p.position === "QB").sort((a, b) => getAdjustedPoints(b) - getAdjustedPoints(a));
    const rbs = players.filter(p => p.position === "RB").sort((a, b) => getAdjustedPoints(b) - getAdjustedPoints(a));
    const wrs = players.filter(p => p.position === "WR").sort((a, b) => getAdjustedPoints(b) - getAdjustedPoints(a));
    const tes = players.filter(p => p.position === "TE").sort((a, b) => getAdjustedPoints(b) - getAdjustedPoints(a));
    const defs = players.filter(p => p.position === "DEF").sort((a, b) => getAdjustedPoints(b) - getAdjustedPoints(a));
    const ks = players.filter(p => p.position === "K").sort((a, b) => getAdjustedPoints(b) - getAdjustedPoints(a));

    // Get flex candidates (RB/WR/TE not in starting lineup)
    const flexCandidates = [
      ...rbs.slice(2),
      ...wrs.slice(2),
      ...tes.slice(1)
    ].sort((a, b) => getAdjustedPoints(b) - getAdjustedPoints(a));

    // Remaining players for bench
    const startingIds = new Set([
      qbs[0]?.id,
      rbs[0]?.id,
      rbs[1]?.id,
      wrs[0]?.id,
      wrs[1]?.id,
      tes[0]?.id,
      flexCandidates[0]?.id,
      defs[0]?.id,
      ks[0]?.id
    ].filter(Boolean));

    const bench = players.filter(p => !startingIds.has(p.id));

    return {
      qb: qbs[0],
      rb1: rbs[0],
      rb2: rbs[1],
      wr1: wrs[0],
      wr2: wrs[1],
      te: tes[0],
      flex: flexCandidates[0],
      def: defs[0],
      k: ks[0],
      bench
    };
  }

  private async saveOptimization(teamId: number, week: number, lineup: OptimizedLineup, matchupMap: Map<number, MatchupDifficulty>) {
    const optimizedLineupData = {
      qb: lineup.qb?.id,
      rb1: lineup.rb1?.id,
      rb2: lineup.rb2?.id,
      wr1: lineup.wr1?.id,
      wr2: lineup.wr2?.id,
      te: lineup.te?.id,
      flex: lineup.flex?.id,
      def: lineup.def?.id,
      k: lineup.k?.id,
      bench: lineup.bench.map(p => p.id)
    };

    // Calculate total projected points
    const projectedPoints = [
      lineup.qb, lineup.rb1, lineup.rb2, lineup.wr1, lineup.wr2,
      lineup.te, lineup.flex, lineup.def, lineup.k
    ].reduce((total, player) => {
      if (!player) return total;
      const matchup = matchupMap.get(player.id);
      return total + (matchup?.projectedPoints || player.avgPoints);
    }, 0);

    // Calculate confidence score based on matchup difficulties
    const startingPlayers = [lineup.qb, lineup.rb1, lineup.rb2, lineup.wr1, lineup.wr2, lineup.te, lineup.flex].filter(Boolean);
    const easyMatchups = startingPlayers.filter(p => matchupMap.get(p.id)?.difficulty === "easy").length;
    const confidence = Math.min(0.95, 0.6 + (easyMatchups / startingPlayers.length) * 0.35);

    const optimization: InsertLineupOptimization = {
      teamId,
      week,
      optimizedLineup: JSON.stringify(optimizedLineupData),
      projectedPoints,
      confidence,
      factors: JSON.stringify({
        matchupsAnalyzed: matchupMap.size,
        easyMatchups,
        averageDefenseRank: Array.from(matchupMap.values()).reduce((sum, m) => sum + m.defenseRank, 0) / matchupMap.size
      })
    };

    await storage.createLineupOptimization(optimization);
  }

  private getOpponentForWeek(team: string, week: number): string | null {
    // Simplified opponent mapping - in production, use NFL schedule API
    const scheduleMap: { [key: string]: string[] } = {
      "LAR": ["ARI", "SF", "SEA", "ARI", "SF", "SEA", "GB", "NE", "NO", "MIA", "BUF", "PHI", "SF", "NYJ", "ARI", "SEA", "SF"],
      "DET": ["GB", "CHI", "MIN", "GB", "CHI", "MIN", "TB", "LV", "LAC", "HOU", "JAX", "IND", "CHI", "SF", "MIN", "DAL", "GB"],
      // Add more teams as needed
    };

    return scheduleMap[team]?.[week - 1] || "OPP";
  }

  private getWeatherImpact(opponent: string, week: number): string | null {
    // Simplified weather impact - in production, use weather API
    const coldWeatherTeams = ["BUF", "GB", "CHI", "DET", "CLE", "PIT", "NE"];
    const domeTeams = ["NO", "ATL", "LV", "LAC", "DET", "IND", "MIN"];

    if (week >= 12 && coldWeatherTeams.includes(opponent)) {
      return "Cold weather may impact passing game";
    }
    
    if (domeTeams.includes(opponent)) {
      return "Indoor stadium - no weather impact";
    }

    return null;
  }

  async getLineupRecommendations(teamId: number, week: number = 18) {
    try {
      const optimization = await storage.getLineupOptimization(teamId, week);
      if (optimization) {
        return {
          optimization,
          isFromCache: true
        };
      }

      // Generate new optimization
      const optimized = await this.optimizeLineup(teamId, week);
      return {
        optimization: optimized,
        isFromCache: false
      };
    } catch (error) {
      console.error("Error getting lineup recommendations:", error);
      throw error;
    }
  }
}

export const lineupOptimizerService = new LineupOptimizerService();