/**
 * OASIS Environment Service
 * Centralized team environment data management with caching and normalization
 * Provides normalized team environment metrics for Player Compass and Rankings Fusion
 * 
 * TODO: Replace OASIS with internal FORGE SoS module
 * See: docs/oasis_audit.md for migration plan
 * Target: Migrate to forgeEnvironmentService using forge_team_env_context table
 */

interface OasisRawData {
  team: string;
  environment_score: number;
  pace: number;
  proe: number;
  ol_grade: number;
  qb_stability: number;
  red_zone_efficiency: number;
  scoring_environment: number;
}

export interface TeamEnvironment {
  team: string;
  environment_score: number;
  pace: number;
  proe: number;
  ol_grade: number;
  qb_stability: number;
  red_zone_efficiency: number;
  scoring_environment: number;
  lastUpdated: Date;
  
  // Normalized percentiles (0-100)
  environment_score_pct: number;
  pace_pct: number;
  proe_pct: number;
  ol_grade_pct: number;
  qb_stability_pct: number;
  red_zone_efficiency_pct: number;
  scoring_environment_pct: number;
  
  // Z-scores for statistical adjustments
  environment_score_z: number;
  pace_z: number;
  proe_z: number;
  ol_grade_z: number;
  qb_stability_z: number;
  red_zone_efficiency_z: number;
  scoring_environment_z: number;
}

interface LeagueStats {
  environment_score: { mean: number; std: number; };
  pace: { mean: number; std: number; };
  proe: { mean: number; std: number; };
  ol_grade: { mean: number; std: number; };
  qb_stability: { mean: number; std: number; };
  red_zone_efficiency: { mean: number; std: number; };
  scoring_environment: { mean: number; std: number; };
}

export class OasisEnvironmentService {
  private cache = new Map<string, TeamEnvironment>();
  private leagueStats: LeagueStats | null = null;
  private lastRefresh: Date | null = null;
  private readonly TTL_MS = 15 * 60 * 1000; // 15 minutes
  private refreshInProgress = false;

  constructor() {
    // Start hourly refresh cron
    this.startCronRefresh();
  }

  /**
   * Get team environment data with SWR (stale-while-revalidate) caching
   */
  async getTeamEnvironment(team: string): Promise<TeamEnvironment | null> {
    const cached = this.cache.get(team.toUpperCase());
    
    // Return fresh data if available
    if (cached && this.isFresh(cached.lastUpdated)) {
      return cached;
    }
    
    // Serve stale data while revalidating in background
    if (cached && !this.refreshInProgress) {
      this.revalidateInBackground();
      return this.adjustForStaleness(cached);
    }
    
    // If no cache, force refresh
    if (!cached) {
      await this.refreshData();
      return this.cache.get(team.toUpperCase()) || null;
    }
    
    return this.adjustForStaleness(cached);
  }

  /**
   * Get all team environments
   */
  async getAllTeamEnvironments(): Promise<TeamEnvironment[]> {
    // Ensure we have data
    if (this.cache.size === 0 || this.isStale()) {
      await this.refreshData();
    }
    
    return Array.from(this.cache.values());
  }

  /**
   * Get league-wide statistics for normalization
   */
  async getLeagueStats(): Promise<LeagueStats | null> {
    if (!this.leagueStats || this.isStale()) {
      await this.refreshData();
    }
    return this.leagueStats;
  }

  /**
   * Manual refresh (admin endpoint)
   */
  async forceRefresh(): Promise<void> {
    await this.refreshData();
  }

  /**
   * Refresh OASIS data from the API
   */
  private async refreshData(): Promise<void> {
    if (this.refreshInProgress) return;
    
    this.refreshInProgress = true;
    try {
      console.log('🔄 [OasisEnvironment] Refreshing team environment data...');
      
      // Fetch current season/week data from OASIS API using production-ready config
      const { internalFetch } = await import('../utils/apiConfig');
      
      const data = await internalFetch('/api/oasis/environment?season=2025&week=2', {
        timeout: 12000,  // 12 second timeout for OASIS environment data
        retries: 2       // Retry for environment data calls
      });
      const teams: OasisRawData[] = data.teams;
      
      // Calculate league statistics
      this.leagueStats = this.calculateLeagueStats(teams);
      
      // Normalize and cache team data
      const normalizedTeams = teams.map(team => this.normalizeTeam(team, this.leagueStats!));
      
      // Update cache
      this.cache.clear();
      normalizedTeams.forEach(team => {
        this.cache.set(team.team, team);
      });
      
      this.lastRefresh = new Date();
      console.log(`✅ [OasisEnvironment] Refreshed ${normalizedTeams.length} teams`);
      
    } catch (error) {
      console.error('❌ [OasisEnvironment] Refresh failed:', error);
      // Keep existing cache on error
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Calculate league-wide statistics for normalization
   */
  private calculateLeagueStats(teams: OasisRawData[]): LeagueStats {
    const metrics = ['environment_score', 'pace', 'proe', 'ol_grade', 'qb_stability', 'red_zone_efficiency', 'scoring_environment'] as const;
    const stats: any = {};
    
    for (const metric of metrics) {
      const values = teams.map(t => t[metric]).filter(v => v != null);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      
      stats[metric] = { mean, std };
    }
    
    return stats as LeagueStats;
  }

  /**
   * Normalize team data with percentiles and z-scores
   */
  private normalizeTeam(team: OasisRawData, leagueStats: LeagueStats): TeamEnvironment {
    // Calculate percentiles (simplified using z-score to percentile approximation)
    const toPercentile = (value: number, mean: number, std: number): number => {
      const z = (value - mean) / (std || 1);
      // Approximate z-score to percentile (using normal distribution)
      const percentile = 50 + 35 * Math.tanh(z / 2);
      return Math.max(0, Math.min(100, Math.round(percentile)));
    };

    // Calculate z-scores
    const toZScore = (value: number, mean: number, std: number): number => {
      return (value - mean) / (std || 1);
    };

    return {
      team: team.team,
      environment_score: team.environment_score,
      pace: team.pace,
      proe: team.proe,
      ol_grade: team.ol_grade,
      qb_stability: team.qb_stability,
      red_zone_efficiency: team.red_zone_efficiency,
      scoring_environment: team.scoring_environment,
      lastUpdated: new Date(),
      
      // Percentiles
      environment_score_pct: toPercentile(team.environment_score, leagueStats.environment_score.mean, leagueStats.environment_score.std),
      pace_pct: toPercentile(team.pace, leagueStats.pace.mean, leagueStats.pace.std),
      proe_pct: toPercentile(team.proe, leagueStats.proe.mean, leagueStats.proe.std),
      ol_grade_pct: toPercentile(team.ol_grade, leagueStats.ol_grade.mean, leagueStats.ol_grade.std),
      qb_stability_pct: toPercentile(team.qb_stability, leagueStats.qb_stability.mean, leagueStats.qb_stability.std),
      red_zone_efficiency_pct: toPercentile(team.red_zone_efficiency, leagueStats.red_zone_efficiency.mean, leagueStats.red_zone_efficiency.std),
      scoring_environment_pct: toPercentile(team.scoring_environment, leagueStats.scoring_environment.mean, leagueStats.scoring_environment.std),
      
      // Z-scores
      environment_score_z: toZScore(team.environment_score, leagueStats.environment_score.mean, leagueStats.environment_score.std),
      pace_z: toZScore(team.pace, leagueStats.pace.mean, leagueStats.pace.std),
      proe_z: toZScore(team.proe, leagueStats.proe.mean, leagueStats.proe.std),
      ol_grade_z: toZScore(team.ol_grade, leagueStats.ol_grade.mean, leagueStats.ol_grade.std),
      qb_stability_z: toZScore(team.qb_stability, leagueStats.qb_stability.mean, leagueStats.qb_stability.std),
      red_zone_efficiency_z: toZScore(team.red_zone_efficiency, leagueStats.red_zone_efficiency.mean, leagueStats.red_zone_efficiency.std),
      scoring_environment_z: toZScore(team.scoring_environment, leagueStats.scoring_environment.mean, leagueStats.scoring_environment.std),
    };
  }

  /**
   * Adjust stale data by shrinking toward league mean
   */
  private adjustForStaleness(team: TeamEnvironment): TeamEnvironment {
    const staleness = this.getStaleness(team.lastUpdated);
    if (staleness < 0.2) return team; // Fresh enough
    
    // Shrink percentiles toward 50 (league mean) by 20%
    const shrinkFactor = 0.2;
    const shrinkPercentile = (pct: number) => pct + (50 - pct) * shrinkFactor;
    
    return {
      ...team,
      environment_score_pct: shrinkPercentile(team.environment_score_pct),
      pace_pct: shrinkPercentile(team.pace_pct),
      proe_pct: shrinkPercentile(team.proe_pct),
      ol_grade_pct: shrinkPercentile(team.ol_grade_pct),
      qb_stability_pct: shrinkPercentile(team.qb_stability_pct),
      red_zone_efficiency_pct: shrinkPercentile(team.red_zone_efficiency_pct),
      scoring_environment_pct: shrinkPercentile(team.scoring_environment_pct),
    };
  }

  /**
   * Background revalidation
   */
  private async revalidateInBackground(): Promise<void> {
    setTimeout(() => this.refreshData(), 100);
  }

  /**
   * Start hourly cron refresh
   */
  private startCronRefresh(): void {
    setInterval(() => {
      console.log('⏰ [OasisEnvironment] Hourly refresh triggered');
      this.refreshData();
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Check if data is fresh (within TTL)
   */
  private isFresh(lastUpdated: Date): boolean {
    return Date.now() - lastUpdated.getTime() < this.TTL_MS;
  }

  /**
   * Check if cache is stale
   */
  private isStale(): boolean {
    return !this.lastRefresh || Date.now() - this.lastRefresh.getTime() > this.TTL_MS;
  }

  /**
   * Get staleness factor (0 = fresh, 1 = very stale)
   */
  private getStaleness(lastUpdated: Date): number {
    const age = Date.now() - lastUpdated.getTime();
    return Math.min(1, age / (24 * 60 * 60 * 1000)); // 1.0 after 24 hours
  }
}

// Singleton instance
export const oasisEnvironmentService = new OasisEnvironmentService();