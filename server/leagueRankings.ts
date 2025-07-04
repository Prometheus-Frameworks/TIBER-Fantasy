import { db } from "./db";
import { teams, teamPlayers, players as playersTable, draftPicks } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { rankingComparisonService } from "./rankingComparison";

// Dynasty Draft Pick Values - 2025 Consensus (FantasyPros July 2025)
export const DRAFT_PICK_VALUES = {
  // 2025 Rookie Draft Picks - 1QB Format
  2025: {
    '1.01': 72, '1.02': 61, '1.03': 57, '1.04': 54, '1.05': 53, '1.06': 52,
    '1.07': 51, '1.08': 50, '1.09': 47, '1.10': 45, '1.11': 43, '1.12': 42,
    'early-2nd': 37, 'mid-2nd': 31, 'late-2nd': 25,
    'early-3rd': 21, 'mid-3rd': 17, 'late-3rd': 15,
    'early-4th': 11, 'late-4th': 8, '5th+': 3
  },
  // 2026 Draft Picks
  2026: {
    'early-1st': 49, 'mid-1st': 42, 'late-1st': 35,
    'early-2nd': 25, 'late-2nd': 18,
    'early-3rd': 10, 'late-3rd': 6, 'others': 1
  },
  // 2027+ Draft Picks
  2027: {
    'early-1st': 53, 'mid-1st': 45, 'late-1st': 35,
    'early-2nd': 24, 'late-2nd': 17,
    'early-3rd': 8, 'late-3rd': 4, 'others': 1
  }
};

// Superflex format multipliers (roughly 1.15x for QB-heavy picks)
export const SUPERFLEX_MULTIPLIERS = {
  '1.01': 1.0, '1.02': 1.02, '1.03': 1.04, '1.04': 1.06, '1.05': 1.06,
  '1.06': 1.06, '1.07': 1.06, '1.08': 1.04, '1.09': 1.06, '1.10': 1.09,
  '1.11': 1.09, '1.12': 1.10, 'early-2nd': 1.16, 'mid-2nd': 1.10, 'late-2nd': 1.12
};

export interface TeamRosterValue {
  teamId: number;
  teamName: string;
  ownerName: string;
  playerValue: number;
  draftPickValue: number;
  totalValue: number;
  leagueRank: number;
  totalTeams: number;
  topPlayers: { name: string; position: string; value: number }[];
  valuablePicksOwned: string[];
  strengthAreas: string[];
  valueDistribution: {
    elite: number;    // Players 70+ value
    starter: number;  // Players 30-69 value
    depth: number;    // Players 15-29 value
    bench: number;    // Players <15 value
  };
}

export interface LeagueRankings {
  rankings: TeamRosterValue[];
  leagueAnalysis: {
    averageTeamValue: number;
    valueSpread: number;
    topTeamAdvantage: number;
    competitiveBalance: 'High' | 'Medium' | 'Low';
    totalLeagueValue: number;
  };
}

export class LeagueRankingService {
  
  async calculateLeagueRankings(leagueId?: number): Promise<LeagueRankings> {
    // Get all teams in the league
    const allTeams = await db.select().from(teams);
    
    const teamValues: TeamRosterValue[] = [];
    
    for (const team of allTeams) {
      const teamValue = await this.calculateTeamValue(team.id);
      teamValues.push(teamValue);
    }
    
    // Sort by total value (highest first)
    teamValues.sort((a, b) => b.totalValue - a.totalValue);
    
    // Assign league rankings
    teamValues.forEach((team, index) => {
      team.leagueRank = index + 1;
      team.totalTeams = teamValues.length;
    });
    
    const leagueAnalysis = this.calculateLeagueAnalysis(teamValues);
    
    return {
      rankings: teamValues,
      leagueAnalysis
    };
  }
  
  private async calculateTeamValue(teamId: number): Promise<TeamRosterValue> {
    // Get team info
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    
    // Get all players on roster
    const teamPlayerData = await db.select({
      playerId: teamPlayers.playerId,
      isStarter: teamPlayers.isStarter,
      playerName: playersTable.name,
      position: playersTable.position,
      avgPoints: playersTable.avgPoints
    })
    .from(teamPlayers)
    .innerJoin(playersTable, eq(teamPlayers.playerId, playersTable.id))
    .where(eq(teamPlayers.teamId, teamId));
    
    // Get team's draft picks
    const teamDraftPicks = await this.getTeamDraftPicks(teamId);
    
    // Calculate player values using our ranking system
    let totalPlayerValue = 0;
    const topPlayers: { name: string; position: string; value: number }[] = [];
    const valueDistribution = { elite: 0, starter: 0, depth: 0, bench: 0 };
    
    for (const player of teamPlayerData) {
      const playerObj = {
        id: player.playerId,
        name: player.playerName,
        position: player.position,
        avgPoints: player.avgPoints,
        // Add required fields with reasonable defaults
        team: 'N/A',
        projectedPoints: player.avgPoints || 0,
        ownershipPercentage: 50,
        isAvailable: false,
        upside: 0,
        injuryStatus: null,
        targetShare: 0,
        snapShare: 0,
        carries: 0,
        receptions: 0,
        redZoneTargets: 0,
        adp: 150,
        consistency: 0.5,
        marketValue: 50,
        trend: 'stable' as const,
        notes: '',
        lastUpdated: new Date(),
        weeklyProjections: null,
        injuryHistory: null,
        advancedMetrics: null,
        marketDataSources: null,
        premiumData: null,
        premiumDataUpdated: null
      };
      
      // Get dynasty value for this player using our advanced analytics
      const dynastyValue = await this.getDynastyValue(playerObj);
      totalPlayerValue += dynastyValue;
      
      if (dynastyValue >= 70) valueDistribution.elite += dynastyValue;
      else if (dynastyValue >= 30) valueDistribution.starter += dynastyValue;
      else if (dynastyValue >= 15) valueDistribution.depth += dynastyValue;
      else valueDistribution.bench += dynastyValue;
      
      // Track top players
      topPlayers.push({
        name: player.playerName,
        position: player.position,
        value: dynastyValue
      });
    }
    
    // Sort and keep top 5 players
    topPlayers.sort((a, b) => b.value - a.value);
    const top5Players = topPlayers.slice(0, 5);
    
    // Calculate draft pick value
    const draftPickValue = this.calculateDraftPickValue(teamDraftPicks);
    const valuablePicksOwned = teamDraftPicks
      .filter(pick => this.getPickValue(pick) >= 25)
      .map(pick => `${pick.year} ${pick.round}.${pick.pick}`);
    
    // Determine strength areas
    const strengthAreas = this.identifyStrengthAreas(valueDistribution, top5Players);
    
    return {
      teamId: team.id,
      teamName: team.name,
      ownerName: team.ownerId, // Could be enhanced with actual owner names
      playerValue: Math.round(totalPlayerValue),
      draftPickValue: Math.round(draftPickValue),
      totalValue: Math.round(totalPlayerValue + draftPickValue),
      leagueRank: 0, // Will be set after sorting
      totalTeams: 0, // Will be set after counting
      topPlayers: top5Players,
      valuablePicksOwned,
      strengthAreas,
      valueDistribution: {
        elite: Math.round(valueDistribution.elite),
        starter: Math.round(valueDistribution.starter),
        depth: Math.round(valueDistribution.depth),
        bench: Math.round(valueDistribution.bench)
      }
    };
  }
  
  private async getDynastyValue(player: any): Promise<number> {
    try {
      const ranking = await rankingComparisonService.generateRankings([player]);
      if (ranking.length > 0) {
        // Convert analytics score to dynasty trade value equivalent
        return Math.round(ranking[0].analyticsScore * 0.8); // Scale to match trade value charts
      }
    } catch (error) {
      console.error(`Error calculating dynasty value for ${player.name}:`, error);
    }
    
    // Fallback based on average points and position
    return this.estimateDynastyValue(player);
  }
  
  private estimateDynastyValue(player: any): number {
    const avgPoints = player.avgPoints || 0;
    const position = player.position;
    
    // Position-based baseline values
    const baselines = {
      QB: { elite: 20, good: 15, average: 10 },
      RB: { elite: 25, good: 18, average: 12 },
      WR: { elite: 22, good: 16, average: 11 },
      TE: { elite: 15, good: 12, average: 8 }
    };
    
    const baseline = baselines[position as keyof typeof baselines] || baselines.WR;
    
    if (avgPoints >= baseline.elite) return 65;
    if (avgPoints >= baseline.good) return 45;
    if (avgPoints >= baseline.average) return 25;
    return 10;
  }
  
  private async getTeamDraftPicks(teamId: number): Promise<any[]> {
    // For now, simulate some draft picks - this would come from actual draft pick data
    // In a real implementation, you'd have a draftPicks table
    const currentYear = new Date().getFullYear();
    
    return [
      { year: currentYear + 1, round: 1, pick: 6, originalOwner: teamId },
      { year: currentYear + 1, round: 2, pick: 6, originalOwner: teamId },
      { year: currentYear + 2, round: 1, pick: 8, originalOwner: teamId },
    ];
  }
  
  private calculateDraftPickValue(draftPicks: any[]): number {
    return draftPicks.reduce((total, pick) => {
      return total + this.getPickValue(pick);
    }, 0);
  }
  
  private getPickValue(pick: any): number {
    const { year, round, pick: pickNumber } = pick;
    const currentYear = new Date().getFullYear();
    const yearDiff = year - currentYear;
    
    // Get base value from our consensus data
    let baseValue = 0;
    
    if (yearDiff === 1) { // 2025 picks
      if (round === 1) {
        const pickKey = `1.${pickNumber.toString().padStart(2, '0')}`;
        baseValue = DRAFT_PICK_VALUES[2025][pickKey] || DRAFT_PICK_VALUES[2025]['1.12'];
      } else if (round === 2) {
        if (pickNumber <= 4) baseValue = DRAFT_PICK_VALUES[2025]['early-2nd'];
        else if (pickNumber <= 8) baseValue = DRAFT_PICK_VALUES[2025]['mid-2nd'];
        else baseValue = DRAFT_PICK_VALUES[2025]['late-2nd'];
      } else if (round === 3) {
        baseValue = pickNumber <= 6 ? DRAFT_PICK_VALUES[2025]['early-3rd'] : DRAFT_PICK_VALUES[2025]['late-3rd'];
      } else {
        baseValue = DRAFT_PICK_VALUES[2025]['5th+'];
      }
    } else if (yearDiff === 2) { // 2026 picks
      if (round === 1) {
        if (pickNumber <= 4) baseValue = DRAFT_PICK_VALUES[2026]['early-1st'];
        else if (pickNumber <= 8) baseValue = DRAFT_PICK_VALUES[2026]['mid-1st'];
        else baseValue = DRAFT_PICK_VALUES[2026]['late-1st'];
      } else if (round === 2) {
        baseValue = pickNumber <= 6 ? DRAFT_PICK_VALUES[2026]['early-2nd'] : DRAFT_PICK_VALUES[2026]['late-2nd'];
      } else {
        baseValue = DRAFT_PICK_VALUES[2026]['others'];
      }
    } else { // 2027+ picks
      if (round === 1) {
        if (pickNumber <= 4) baseValue = DRAFT_PICK_VALUES[2027]['early-1st'];
        else if (pickNumber <= 8) baseValue = DRAFT_PICK_VALUES[2027]['mid-1st'];
        else baseValue = DRAFT_PICK_VALUES[2027]['late-1st'];
      } else if (round === 2) {
        baseValue = pickNumber <= 6 ? DRAFT_PICK_VALUES[2027]['early-2nd'] : DRAFT_PICK_VALUES[2027]['late-2nd'];
      } else {
        baseValue = DRAFT_PICK_VALUES[2027]['others'];
      }
    }
    
    return baseValue;
  }
  
  private identifyStrengthAreas(valueDistribution: any, topPlayers: any[]): string[] {
    const strengths: string[] = [];
    
    if (valueDistribution.elite > 150) strengths.push('Elite Talent');
    if (valueDistribution.starter > 300) strengths.push('Strong Starters');
    if (valueDistribution.depth > 200) strengths.push('Quality Depth');
    
    // Position analysis
    const positionCounts = topPlayers.reduce((acc, player) => {
      acc[player.position] = (acc[player.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(positionCounts).forEach(([position, count]) => {
      if (count >= 2) strengths.push(`${position} Heavy`);
    });
    
    if (strengths.length === 0) strengths.push('Balanced Roster');
    
    return strengths;
  }
  
  private calculateLeagueAnalysis(teamValues: TeamRosterValue[]) {
    const totalValues = teamValues.map(t => t.totalValue);
    const averageTeamValue = totalValues.reduce((a, b) => a + b, 0) / totalValues.length;
    const maxValue = Math.max(...totalValues);
    const minValue = Math.min(...totalValues);
    const valueSpread = maxValue - minValue;
    const topTeamAdvantage = ((maxValue - averageTeamValue) / averageTeamValue) * 100;
    
    // Calculate competitive balance
    const stdDev = Math.sqrt(
      totalValues.reduce((sum, value) => sum + Math.pow(value - averageTeamValue, 2), 0) / totalValues.length
    );
    const coefficientOfVariation = stdDev / averageTeamValue;
    
    let competitiveBalance: 'High' | 'Medium' | 'Low';
    if (coefficientOfVariation < 0.15) competitiveBalance = 'High';
    else if (coefficientOfVariation < 0.25) competitiveBalance = 'Medium';
    else competitiveBalance = 'Low';
    
    return {
      averageTeamValue: Math.round(averageTeamValue),
      valueSpread: Math.round(valueSpread),
      topTeamAdvantage: Math.round(topTeamAdvantage),
      competitiveBalance,
      totalLeagueValue: Math.round(totalValues.reduce((a, b) => a + b, 0))
    };
  }
}

export const leagueRankingService = new LeagueRankingService();