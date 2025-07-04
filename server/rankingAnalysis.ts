/**
 * Reverse Engineer Jake Maraia's Dynasty Rankings
 * 
 * Analyze what metrics and weightings Jake uses by comparing his expert rankings
 * against our available analytics (PPG, age, team context, efficiency metrics)
 */

import { storage } from './storage';

interface JakeMaraiaRanking {
  rank: number;
  name: string;
  team: string;
  position: string;
}

interface PlayerAnalytics {
  name: string;
  rank: number;
  avgPoints: number;
  age: number;
  team: string;
  consistency?: number;
  targetShare?: number;
  redZoneShare?: number;
  yardsPerTarget?: number;
  catchRate?: number;
  upside?: number;
}

interface RankingFactorAnalysis {
  factor: string;
  correlation: number;
  topPlayersAverage: number;
  bottomPlayersAverage: number;
  insights: string[];
}

export class RankingAnalysisEngine {
  
  // Jake Maraia's Top 25 WR Rankings (from FantasyPros)
  private jakeMaraiaWRRankings: JakeMaraiaRanking[] = [
    { rank: 1, name: "Ja'Marr Chase", team: "CIN", position: "WR" },
    { rank: 2, name: "CeeDee Lamb", team: "DAL", position: "WR" },
    { rank: 3, name: "Puka Nacua", team: "LAR", position: "WR" },
    { rank: 4, name: "Justin Jefferson", team: "MIN", position: "WR" },
    { rank: 5, name: "Brian Thomas Jr.", team: "JAC", position: "WR" },
    { rank: 6, name: "Amon-Ra St. Brown", team: "DET", position: "WR" },
    { rank: 7, name: "Nico Collins", team: "HOU", position: "WR" },
    { rank: 8, name: "Malik Nabers", team: "NYG", position: "WR" },
    { rank: 9, name: "Drake London", team: "ATL", position: "WR" },
    { rank: 10, name: "Ladd McConkey", team: "LAC", position: "WR" },
    { rank: 11, name: "Rashee Rice", team: "KC", position: "WR" },
    { rank: 12, name: "A.J. Brown", team: "PHI", position: "WR" },
    { rank: 13, name: "Tee Higgins", team: "CIN", position: "WR" },
    { rank: 14, name: "Tyreek Hill", team: "MIA", position: "WR" },
    { rank: 15, name: "Mike Evans", team: "TB", position: "WR" },
    { rank: 16, name: "Davante Adams", team: "LAR", position: "WR" },
    { rank: 17, name: "Garrett Wilson", team: "NYJ", position: "WR" },
    { rank: 18, name: "Tetairoa McMillan", team: "CAR", position: "WR" },
    { rank: 19, name: "Jaxon Smith-Njigba", team: "SEA", position: "WR" },
    { rank: 20, name: "Marvin Harrison Jr.", team: "ARI", position: "WR" },
    { rank: 21, name: "Terry McLaurin", team: "WAS", position: "WR" },
    { rank: 22, name: "George Pickens", team: "DAL", position: "WR" },
    { rank: 23, name: "DeVonta Smith", team: "PHI", position: "WR" },
    { rank: 24, name: "Jaylen Waddle", team: "MIA", position: "WR" },
    { rank: 25, name: "Zay Flowers", team: "BAL", position: "WR" }
  ];

  /**
   * Analyze correlation between Jake's rankings and various player metrics
   */
  async analyzeRankingFactors(): Promise<RankingFactorAnalysis[]> {
    console.log("🔬 Analyzing Jake Maraia's ranking methodology...");
    
    // Get our player data for comparison
    const allPlayers = await storage.getAllPlayers();
    const ourPlayers = allPlayers.filter(p => p.position === 'WR');
    
    // Match Jake's rankings with our player data
    const matchedPlayers: PlayerAnalytics[] = [];
    
    for (const jakePlayer of this.jakeMaraiaWRRankings) {
      const ourPlayer = ourPlayers.find(p => 
        p.name.toLowerCase().includes(jakePlayer.name.toLowerCase()) ||
        jakePlayer.name.toLowerCase().includes(p.name.toLowerCase())
      );
      
      if (ourPlayer) {
        matchedPlayers.push({
          name: jakePlayer.name,
          rank: jakePlayer.rank,
          avgPoints: ourPlayer.avgPoints || 0,
          age: ourPlayer.age || 25,
          team: ourPlayer.team,
          consistency: ourPlayer.consistency || 50,
          targetShare: ourPlayer.targetShare || 15,
          redZoneShare: ourPlayer.redZoneShare || 10,
          yardsPerTarget: ourPlayer.yardsPerTarget || 8,
          catchRate: ourPlayer.catchRate || 65,
          upside: ourPlayer.upside || 0
        });
      }
    }

    console.log(`📊 Matched ${matchedPlayers.length} players for analysis`);

    // Analyze various factors
    const analyses: RankingFactorAnalysis[] = [];

    // 1. Fantasy Points Per Game Analysis
    analyses.push(await this.analyzeFantasyPoints(matchedPlayers));
    
    // 2. Age Analysis
    analyses.push(await this.analyzeAge(matchedPlayers));
    
    // 3. Team Context Analysis
    analyses.push(await this.analyzeTeamContext(matchedPlayers));
    
    // 4. Target Share Analysis
    analyses.push(await this.analyzeTargetShare(matchedPlayers));
    
    // 5. Consistency Analysis
    analyses.push(await this.analyzeConsistency(matchedPlayers));
    
    // 6. Upside/Ceiling Analysis
    analyses.push(await this.analyzeUpside(matchedPlayers));

    return analyses;
  }

  private async analyzeFantasyPoints(players: PlayerAnalytics[]): Promise<RankingFactorAnalysis> {
    const correlation = this.calculateSpearmanCorrelation(
      players.map(p => p.rank),
      players.map(p => -p.avgPoints) // Negative because lower rank = better
    );

    const top10Avg = players.slice(0, 10).reduce((sum, p) => sum + p.avgPoints, 0) / 10;
    const bottom10Avg = players.slice(-10).reduce((sum, p) => sum + p.avgPoints, 0) / 10;

    const insights = [
      `Top 10 average: ${top10Avg.toFixed(1)} PPG`,
      `Bottom 10 average: ${bottom10Avg.toFixed(1)} PPG`,
      `Difference: ${(top10Avg - bottom10Avg).toFixed(1)} PPG`,
      correlation > 0.6 ? "Strong factor in rankings" : 
      correlation > 0.3 ? "Moderate factor in rankings" : "Weak factor in rankings"
    ];

    return {
      factor: "Fantasy Points Per Game",
      correlation,
      topPlayersAverage: top10Avg,
      bottomPlayersAverage: bottom10Avg,
      insights
    };
  }

  private async analyzeAge(players: PlayerAnalytics[]): Promise<RankingFactorAnalysis> {
    const correlation = this.calculateSpearmanCorrelation(
      players.map(p => p.rank),
      players.map(p => p.age) // Positive correlation means older players ranked lower
    );

    const top10Avg = players.slice(0, 10).reduce((sum, p) => sum + p.age, 0) / 10;
    const bottom10Avg = players.slice(-10).reduce((sum, p) => sum + p.age, 0) / 10;

    const insights = [
      `Top 10 average age: ${top10Avg.toFixed(1)} years`,
      `Bottom 10 average age: ${bottom10Avg.toFixed(1)} years`,
      `Age preference: ${top10Avg < bottom10Avg ? 'Younger players favored' : 'Age less important'}`,
      correlation > 0.3 ? "Age is significant factor" : "Age less important than production"
    ];

    return {
      factor: "Player Age",
      correlation,
      topPlayersAverage: top10Avg,
      bottomPlayersAverage: bottom10Avg,
      insights
    };
  }

  private async analyzeTeamContext(players: PlayerAnalytics[]): Promise<RankingFactorAnalysis> {
    // Analyze elite offense teams
    const eliteOffenses = ['KC', 'BUF', 'DAL', 'MIA', 'CIN', 'DET', 'PHI'];
    
    const top10EliteTeams = players.slice(0, 10).filter(p => 
      eliteOffenses.includes(p.team)
    ).length;
    
    const bottom10EliteTeams = players.slice(-10).filter(p => 
      eliteOffenses.includes(p.team)
    ).length;

    const insights = [
      `Top 10 from elite offenses: ${top10EliteTeams}/10`,
      `Bottom 10 from elite offenses: ${bottom10EliteTeams}/10`,
      `Elite offense representation: ${((top10EliteTeams / 10) * 100).toFixed(0)}% vs ${((bottom10EliteTeams / 10) * 100).toFixed(0)}%`,
      top10EliteTeams > bottom10EliteTeams ? "Elite offenses favored" : "Team context less important"
    ];

    return {
      factor: "Team Offensive Context",
      correlation: (top10EliteTeams - bottom10EliteTeams) / 10, // Simple correlation proxy
      topPlayersAverage: top10EliteTeams,
      bottomPlayersAverage: bottom10EliteTeams,
      insights
    };
  }

  private async analyzeTargetShare(players: PlayerAnalytics[]): Promise<RankingFactorAnalysis> {
    const correlation = this.calculateSpearmanCorrelation(
      players.map(p => p.rank),
      players.map(p => -(p.targetShare || 15)) // Negative because lower rank = better
    );

    const top10Avg = players.slice(0, 10).reduce((sum, p) => sum + (p.targetShare || 15), 0) / 10;
    const bottom10Avg = players.slice(-10).reduce((sum, p) => sum + (p.targetShare || 15), 0) / 10;

    const insights = [
      `Top 10 avg target share: ${top10Avg.toFixed(1)}%`,
      `Bottom 10 avg target share: ${bottom10Avg.toFixed(1)}%`,
      `Volume importance: ${top10Avg > bottom10Avg ? 'High target share valued' : 'Efficiency over volume'}`,
      correlation > 0.4 ? "Target share crucial" : "Target share secondary factor"
    ];

    return {
      factor: "Target Share",
      correlation,
      topPlayersAverage: top10Avg,
      bottomPlayersAverage: bottom10Avg,
      insights
    };
  }

  private async analyzeConsistency(players: PlayerAnalytics[]): Promise<RankingFactorAnalysis> {
    const correlation = this.calculateSpearmanCorrelation(
      players.map(p => p.rank),
      players.map(p => -(p.consistency || 50)) // Negative because lower rank = better
    );

    const top10Avg = players.slice(0, 10).reduce((sum, p) => sum + (p.consistency || 50), 0) / 10;
    const bottom10Avg = players.slice(-10).reduce((sum, p) => sum + (p.consistency || 50), 0) / 10;

    const insights = [
      `Top 10 consistency: ${top10Avg.toFixed(1)}`,
      `Bottom 10 consistency: ${bottom10Avg.toFixed(1)}`,
      `Reliability factor: ${top10Avg > bottom10Avg ? 'Values consistency' : 'Boom/bust acceptable'}`,
      correlation > 0.3 ? "Consistency important" : "Ceiling over floor"
    ];

    return {
      factor: "Week-to-Week Consistency",
      correlation,
      topPlayersAverage: top10Avg,
      bottomPlayersAverage: bottom10Avg,
      insights
    };
  }

  private async analyzeUpside(players: PlayerAnalytics[]): Promise<RankingFactorAnalysis> {
    const correlation = this.calculateSpearmanCorrelation(
      players.map(p => p.rank),
      players.map(p => -(p.upside || 0)) // Negative because lower rank = better
    );

    const top10Avg = players.slice(0, 10).reduce((sum, p) => sum + (p.upside || 0), 0) / 10;
    const bottom10Avg = players.slice(-10).reduce((sum, p) => sum + (p.upside || 0), 0) / 10;

    const insights = [
      `Top 10 upside: ${top10Avg.toFixed(1)}`,
      `Bottom 10 upside: ${bottom10Avg.toFixed(1)}`,
      `Ceiling emphasis: ${top10Avg > bottom10Avg ? 'High ceiling valued' : 'Floor over ceiling'}`,
      correlation > 0.3 ? "Upside crucial for rankings" : "Current production over potential"
    ];

    return {
      factor: "Upside/Ceiling Potential",
      correlation,
      topPlayersAverage: top10Avg,
      bottomPlayersAverage: bottom10Avg,
      insights
    };
  }

  /**
   * Calculate Spearman rank correlation coefficient
   */
  private calculateSpearmanCorrelation(rank1: number[], rank2: number[]): number {
    if (rank1.length !== rank2.length) return 0;
    
    const n = rank1.length;
    let sumD2 = 0;
    
    for (let i = 0; i < n; i++) {
      const d = rank1[i] - rank2[i];
      sumD2 += d * d;
    }
    
    return 1 - (6 * sumD2) / (n * (n * n - 1));
  }

  /**
   * Generate comprehensive analysis report
   */
  async generateAnalysisReport(): Promise<string> {
    const analyses = await this.analyzeRankingFactors();
    
    let report = "# Jake Maraia Dynasty WR Ranking Analysis\n\n";
    report += "## Methodology Reverse Engineering\n\n";
    
    // Sort by correlation strength
    const sortedAnalyses = analyses.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    
    report += "### Factor Importance (by correlation strength):\n\n";
    for (const analysis of sortedAnalyses) {
      report += `**${analysis.factor}** (r = ${analysis.correlation.toFixed(3)})\n`;
      for (const insight of analysis.insights) {
        report += `- ${insight}\n`;
      }
      report += "\n";
    }
    
    // Key insights
    report += "## Key Insights into Jake's Valuation:\n\n";
    
    const topFactor = sortedAnalyses[0];
    report += `1. **Primary Factor**: ${topFactor.factor} shows strongest correlation (${topFactor.correlation.toFixed(3)})\n`;
    
    const ageAnalysis = analyses.find(a => a.factor === "Player Age");
    if (ageAnalysis && Math.abs(ageAnalysis.correlation) > 0.3) {
      report += `2. **Age Premium**: Youth is valued - top 10 average ${ageAnalysis.topPlayersAverage.toFixed(1)} years vs bottom 10 ${ageAnalysis.bottomPlayersAverage.toFixed(1)} years\n`;
    }
    
    const pointsAnalysis = analyses.find(a => a.factor === "Fantasy Points Per Game");
    if (pointsAnalysis) {
      report += `3. **Production Baseline**: Top performers average ${pointsAnalysis.topPlayersAverage.toFixed(1)} PPG\n`;
    }
    
    return report;
  }
}

export const rankingAnalysis = new RankingAnalysisEngine();