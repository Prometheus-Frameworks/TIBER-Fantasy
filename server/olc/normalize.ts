// Note: using console for logging to avoid circular dependency

export interface NormalizedMetrics {
  pff_pb_z: number;
  espn_pbwr_z: number;
  espn_rbwr_z: number;
  pressure_rate_z: number;
  adjusted_sack_rate_z: number;
  ybc_per_rush_z: number;
  rolling_weights: number[];
}

export interface LeagueStats {
  pff_pb: { mean: number; std: number };
  espn_pbwr: { mean: number; std: number };
  espn_rbwr: { mean: number; std: number };
  pressure_rate: { mean: number; std: number };
  adjusted_sack_rate: { mean: number; std: number };
  ybc_per_rush: { mean: number; std: number };
}

export class OlNormalizer {
  private static instance: OlNormalizer;
  private leagueStatsCache = new Map<string, LeagueStats>();
  private rollingWeights = new Map<number, number[]>();

  static getInstance(): OlNormalizer {
    if (!OlNormalizer.instance) {
      OlNormalizer.instance = new OlNormalizer();
    }
    return OlNormalizer.instance;
  }

  constructor() {
    this.initializeRollingWeights();
  }

  private initializeRollingWeights(): void {
    // Generate rolling weights for last-4 weeks emphasis
    for (let week = 1; week <= 18; week++) {
      const weights: number[] = [];
      const lookback = Math.min(4, week);
      
      // Linear decay: most recent = 1.0, oldest = 0.4
      for (let i = 0; i < lookback; i++) {
        const weight = 1.0 - (i * 0.15); // 1.0, 0.85, 0.70, 0.55
        weights.unshift(weight);
      }
      
      // Normalize weights to sum to 1
      const sum = weights.reduce((a, b) => a + b, 0);
      const normalizedWeights = weights.map(w => w / sum);
      
      this.rollingWeights.set(week, normalizedWeights);
    }
    
    console.debug('[OLC] Rolling weights initialized', { 
      sampleWeek4: this.rollingWeights.get(4),
      sampleWeek10: this.rollingWeights.get(10)
    });
  }

  async getLeagueStats(season: number, week: number): Promise<LeagueStats> {
    const cacheKey = `${season}-${week}`;
    
    if (this.leagueStatsCache.has(cacheKey)) {
      return this.leagueStatsCache.get(cacheKey)!;
    }

    console.info('[OLC] Computing league stats for normalization', { season, week });

    // In production, this would query actual league data
    // For now, use realistic NFL offensive line stats
    const leagueStats: LeagueStats = {
      pff_pb: { mean: 68.5, std: 8.2 },
      espn_pbwr: { mean: 0.625, std: 0.085 },
      espn_rbwr: { mean: 0.685, std: 0.075 },
      pressure_rate: { mean: 0.235, std: 0.045 }, // Lower is better
      adjusted_sack_rate: { mean: 0.065, std: 0.025 }, // Lower is better
      ybc_per_rush: { mean: 2.35, std: 0.35 },
    };

    this.leagueStatsCache.set(cacheKey, leagueStats);
    console.debug('[OLC] League stats cached', { season, week, stats: leagueStats });

    return leagueStats;
  }

  async normalizeMetrics(
    teamId: string,
    season: number,
    week: number,
    rawMetrics: {
      pff_pb: number;
      espn_pbwr: number;
      espn_rbwr: number;
      pressure_rate: number;
      adjusted_sack_rate: number;
      ybc_per_rush: number;
    }
  ): Promise<NormalizedMetrics> {
    const leagueStats = await this.getLeagueStats(season, week);
    const weights = this.rollingWeights.get(week) || [1.0];

    console.debug('[OLC] Normalizing metrics', { teamId, season, week, rawMetrics });

    // Z-score normalization with direction correction
    const normalized: NormalizedMetrics = {
      pff_pb_z: this.zscore(rawMetrics.pff_pb, leagueStats.pff_pb.mean, leagueStats.pff_pb.std),
      espn_pbwr_z: this.zscore(rawMetrics.espn_pbwr, leagueStats.espn_pbwr.mean, leagueStats.espn_pbwr.std),
      espn_rbwr_z: this.zscore(rawMetrics.espn_rbwr, leagueStats.espn_rbwr.mean, leagueStats.espn_rbwr.std),
      
      // Flip signs for "lower is better" metrics
      pressure_rate_z: -this.zscore(rawMetrics.pressure_rate, leagueStats.pressure_rate.mean, leagueStats.pressure_rate.std),
      adjusted_sack_rate_z: -this.zscore(rawMetrics.adjusted_sack_rate, leagueStats.adjusted_sack_rate.mean, leagueStats.adjusted_sack_rate.std),
      
      ybc_per_rush_z: this.zscore(rawMetrics.ybc_per_rush, leagueStats.ybc_per_rush.mean, leagueStats.ybc_per_rush.std),
      rolling_weights: weights,
    };

    console.debug('[OLC] Metrics normalized', { teamId, season, week, normalized });

    return normalized;
  }

  private zscore(value: number, mean: number, std: number): number {
    if (std === 0) return 0;
    return (value - mean) / std;
  }

  // Calculate rolling weighted average for a metric across last N weeks
  calculateRollingAverage(values: number[], week: number): number {
    const weights = this.rollingWeights.get(week) || [1.0];
    const recentValues = values.slice(-weights.length);
    
    if (recentValues.length === 0) return 0;
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < recentValues.length; i++) {
      const weight = weights[i] || 0;
      weightedSum += recentValues[i] * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  clearCache(): void {
    this.leagueStatsCache.clear();
    console.info('[OLC] Normalization cache cleared');
  }
}