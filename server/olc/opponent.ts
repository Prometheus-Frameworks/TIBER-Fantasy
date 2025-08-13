// Note: using console for logging

export interface OpponentContext {
  pass_context_w: number;  // Weekly pass context adjustment ±6%
  run_context_w: number;   // Weekly run context adjustment ±6%
  def_pass_rush_strength: number;
  def_run_stuff_rate: number;
  meta: {
    opponent_team: string;
    defensive_rankings: {
      pass_rush_rank: number;
      run_defense_rank: number;
    };
  };
}

export interface DefensiveMetrics {
  pass_rush_strength: number;  // Composite pass rush metric
  run_stuff_rate: number;      // % of runs stuffed at/behind LOS
  team_id: string;
}

export class OpponentContextCalculator {
  private static instance: OpponentContextCalculator;
  private defensiveStatsCache = new Map<string, DefensiveMetrics>();
  private leagueDefensiveStats = new Map<string, { mean: number; std: number }>();

  static getInstance(): OpponentContextCalculator {
    if (!OpponentContextCalculator.instance) {
      OpponentContextCalculator.instance = new OpponentContextCalculator();
    }
    return OpponentContextCalculator.instance;
  }

  async calculateOpponentContext(
    teamId: string,
    opponentId: string,
    season: number,
    week: number,
    teamOlcScore: number,
    teamRbwr: number
  ): Promise<OpponentContext> {
    console.debug('[OLC] Calculating opponent context', { teamId, opponentId, season, week });

    const opponentDefense = await this.getOpponentDefensiveMetrics(opponentId, season, week);
    const leagueStats = await this.getLeagueDefensiveStats(season, week);

    // Normalize opponent defensive metrics
    const passRushZ = this.zscore(
      opponentDefense.pass_rush_strength,
      leagueStats.pass_rush.mean,
      leagueStats.pass_rush.std
    );

    const runStuffZ = this.zscore(
      opponentDefense.run_stuff_rate,
      leagueStats.run_stuff.mean,
      leagueStats.run_stuff.std
    );

    // Calculate weekly context adjustments
    const passContextW = this.calculatePassContext(teamOlcScore, passRushZ);
    const runContextW = this.calculateRunContext(teamRbwr, runStuffZ);

    const context: OpponentContext = {
      pass_context_w: passContextW,
      run_context_w: runContextW,
      def_pass_rush_strength: opponentDefense.pass_rush_strength,
      def_run_stuff_rate: opponentDefense.run_stuff_rate,
      meta: {
        opponent_team: opponentId,
        defensive_rankings: await this.getDefensiveRankings(opponentId, season, week),
      },
    };

    console.debug('[OLC] Opponent context calculated', { teamId, opponentId, season, week, context });

    return context;
  }

  private calculatePassContext(teamOlcScore: number, opponentPassRushZ: number): number {
    // Pass_Context_w = OLC_T − z(Def_PassRushStrength_D), → ±6%
    
    // Convert OLC_100 to z-score equivalent (assume league average = 65, std = 10)
    const teamOlcZ = (teamOlcScore - 65) / 10;
    
    // Team strength minus opponent strength
    const contextRaw = teamOlcZ - opponentPassRushZ;
    
    // Scale to ±6% range (assuming ±2 z-score range)
    const contextAdjustment = (contextRaw / 2) * 0.06;
    
    // Cap at ±6%
    return Math.max(-0.06, Math.min(0.06, contextAdjustment));
  }

  private calculateRunContext(teamRbwr: number, opponentRunStuffZ: number): number {
    // Run_Context_w = RBWR_T − z(Def_RunStuffRate_D), → ±6%
    
    // Convert team RBWR to z-score (assume league average = 0.68, std = 0.075)
    const teamRbwrZ = (teamRbwr - 0.68) / 0.075;
    
    // Team strength minus opponent strength (negative because higher stuff rate is worse for offense)
    const contextRaw = teamRbwrZ - opponentRunStuffZ;
    
    // Scale to ±6% range
    const contextAdjustment = (contextRaw / 2) * 0.06;
    
    // Cap at ±6%
    return Math.max(-0.06, Math.min(0.06, contextAdjustment));
  }

  private async getOpponentDefensiveMetrics(
    opponentId: string,
    season: number,
    week: number
  ): Promise<DefensiveMetrics> {
    const cacheKey = `${opponentId}-${season}-${week}`;
    
    if (this.defensiveStatsCache.has(cacheKey)) {
      return this.defensiveStatsCache.get(cacheKey)!;
    }

    // In production, fetch from defensive stats API
    // For now, generate realistic defensive metrics
    const metrics: DefensiveMetrics = {
      team_id: opponentId,
      pass_rush_strength: this.generateRealisticDefensiveMetric('pass_rush'),
      run_stuff_rate: this.generateRealisticDefensiveMetric('run_stuff'),
    };

    this.defensiveStatsCache.set(cacheKey, metrics);
    console.debug('[OLC] Opponent defensive metrics cached', { opponentId, season, week, metrics });

    return metrics;
  }

  private generateRealisticDefensiveMetric(type: 'pass_rush' | 'run_stuff'): number {
    switch (type) {
      case 'pass_rush':
        // Composite pass rush metric (higher = better defense)
        return 45 + Math.random() * 40; // Range: 45-85
      case 'run_stuff':
        // Run stuff rate (higher = better defense)
        return 0.15 + Math.random() * 0.15; // Range: 15-30%
      default:
        return 0;
    }
  }

  private async getLeagueDefensiveStats(
    season: number,
    week: number
  ): Promise<{ pass_rush: { mean: number; std: number }; run_stuff: { mean: number; std: number } }> {
    const cacheKey = `league-${season}-${week}`;
    
    let stats = this.leagueDefensiveStats.get(cacheKey);
    if (!stats) {
      // In production, calculate from all teams
      const leagueStats = {
        pass_rush: { mean: 62.5, std: 8.5 },
        run_stuff: { mean: 0.225, std: 0.035 },
      };
      
      this.leagueDefensiveStats.set(cacheKey, leagueStats);
      console.debug('[OLC] League defensive stats cached', { season, week, leagueStats });
      
      return leagueStats;
    }

    return stats as any;
  }

  private async getDefensiveRankings(
    opponentId: string,
    season: number,
    week: number
  ): Promise<{ pass_rush_rank: number; run_defense_rank: number }> {
    // In production, calculate actual rankings
    return {
      pass_rush_rank: Math.floor(Math.random() * 32) + 1,
      run_defense_rank: Math.floor(Math.random() * 32) + 1,
    };
  }

  private zscore(value: number, mean: number, std: number): number {
    if (std === 0) return 0;
    return (value - mean) / std;
  }

  // Apply opponent context to a baseline projection
  applyOpponentContext(
    baseline: number,
    context: OpponentContext,
    category: 'pass' | 'run'
  ): number {
    const adjustment = category === 'pass' ? context.pass_context_w : context.run_context_w;
    const adjusted = baseline * (1 + adjustment);
    
    console.debug('[OLC] Opponent context applied', { 
      category, 
      baseline, 
      adjustment: adjustment * 100, 
      adjusted 
    });

    return adjusted;
  }

  clearCache(): void {
    this.defensiveStatsCache.clear();
    this.leagueDefensiveStats.clear();
    console.info('[OLC] Opponent context cache cleared');
  }
}