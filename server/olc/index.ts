// Note: using console for logging to avoid circular dependency
import { OlSourceAdapter } from './sources';
import { OlNormalizer } from './normalize';
import { OlCohesionCalculator } from './cohesion';
import { OlcScorer } from './score';
import { OlcAdjusterCalculator } from './adjusters';
import { OpponentContextCalculator } from './opponent';
import type { OlcTeamWeek } from './schema';

export interface BuildOlcOptions {
  includeAdjusters?: boolean;
  includeOpponentContext?: boolean;
  opponentId?: string;
  forceRefresh?: boolean;
}

class OlcBuilder {
  private static instance: OlcBuilder;
  private cache = new Map<string, OlcTeamWeek>();
  private cacheTTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
  private cacheTimestamps = new Map<string, number>();

  // Module instances
  private sourceAdapter = OlSourceAdapter.getInstance();
  private normalizer = OlNormalizer.getInstance();
  private cohesionCalculator = OlCohesionCalculator.getInstance();
  private scorer = OlcScorer.getInstance();
  private adjusterCalculator = OlcAdjusterCalculator.getInstance();
  private opponentCalculator = OpponentContextCalculator.getInstance();

  static getInstance(): OlcBuilder {
    if (!OlcBuilder.instance) {
      OlcBuilder.instance = new OlcBuilder();
    }
    return OlcBuilder.instance;
  }

  async buildOlcForWeek(
    teamId: string,
    season: number,
    week: number,
    options: BuildOlcOptions = {}
  ): Promise<OlcTeamWeek> {
    const startTime = Date.now();
    console.info(`[OLC] Starting calculation for ${teamId} ${season} Week ${week}`);

    try {
      // Check cache first
      const cacheKey = `${teamId}-${season}-${week}`;
      if (!options.forceRefresh && this.isCacheValid(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        console.debug(`[OLC] Cache hit for ${teamId} ${season} Week ${week}`);
        return cached;
      }

      // Step 1: Fetch source data
      console.debug(`[OLC] Fetching source data for ${teamId}`);
      const sourceData = await this.sourceAdapter.fetchTeamData(teamId, season, week);
      console.debug(`[OLC] Sources: PFF PB=${sourceData.pff_pb}, PBWR=${sourceData.espn_pbwr}, Injuries=${sourceData.injuries.length}`);

      // Step 2: Normalize metrics
      console.debug(`[OLC] Normalizing metrics for ${teamId}`);
      const normalizedMetrics = await this.normalizer.normalizeMetrics(teamId, season, week, {
        pff_pb: sourceData.pff_pb,
        espn_pbwr: sourceData.espn_pbwr,
        espn_rbwr: sourceData.espn_rbwr,
        pressure_rate: sourceData.pressure_rate,
        adjusted_sack_rate: sourceData.adjusted_sack_rate,
        ybc_per_rush: sourceData.ybc_per_rush,
      });
      console.debug(`[OLC] Normalized: PFF PB Z=${normalizedMetrics.pff_pb_z.toFixed(2)}, PBWR Z=${normalizedMetrics.espn_pbwr_z.toFixed(2)}`);

      // Step 3: Calculate cohesion
      console.debug(`[OLC] Calculating cohesion for ${teamId}`);
      const previousDepthCharts = await this.getPreviousDepthCharts(teamId, season, week);
      const cohesionResult = await this.cohesionCalculator.calculateCohesion(
        teamId,
        season,
        week,
        sourceData.depth_chart,
        previousDepthCharts
      );
      console.debug(`[OLC] Cohesion: raw=${cohesionResult.cohesion_raw.toFixed(2)}, Z=${cohesionResult.cohesion_z.toFixed(2)}`);

      // Step 4: Calculate OLC score
      console.debug(`[OLC] Calculating OLC score for ${teamId}`);
      const previousDepthChart = previousDepthCharts[previousDepthCharts.length - 1];
      const scoreResult = await this.scorer.calculateOlcScore(
        teamId,
        season,
        week,
        normalizedMetrics,
        cohesionResult,
        sourceData.injuries,
        sourceData.depth_chart,
        previousDepthChart
      );
      console.debug(`[OLC] Score: OLC_100=${scoreResult.olc_100.toFixed(1)}, raw=${scoreResult.olc_raw.toFixed(2)}, penalty=${scoreResult.total_penalty}`);
      console.debug(`[OLC] Scaling: k=${scoreResult.scale_k}, sigma=${scoreResult.sigma.toFixed(2)}`);
      
      if (scoreResult.penalty_breakdown.length > 0) {
        console.debug(`[OLC] Penalties applied: ${scoreResult.penalty_breakdown.length} items`);
      }

      // Step 5: Calculate position adjusters (if requested)
      let adjusters = { qb_env: 0, rb_runways: 0, wrte_timing: 0 };
      if (options.includeAdjusters) {
        console.debug(`[OLC] Calculating adjusters for ${teamId}`);
        adjusters = this.adjusterCalculator.calculatePositionAdjusters(teamId, season, week, {
          olc_100: scoreResult.olc_100,
          proe_z: normalizedMetrics.pressure_rate_z, // Using pressure_rate_z as proxy for PROE
          qbP2S_z: normalizedMetrics.adjusted_sack_rate_z, // Using ASR as proxy for QB P2S
          rbwr_z: normalizedMetrics.espn_rbwr_z,
          ybc_z: normalizedMetrics.ybc_per_rush_z,
          pff_pb_z: normalizedMetrics.pff_pb_z,
        });
        console.debug(`[OLC] Adjusters: QB=${(adjusters.qb_env*100).toFixed(1)}%, RB=${(adjusters.rb_runways*100).toFixed(1)}%, WR/TE=${(adjusters.wrte_timing*100).toFixed(1)}%`);
      }

      // Step 6: Calculate opponent context (if requested)
      let opponentContext = {
        pass_context_w: 0,
        run_context_w: 0,
        def_pass_rush_strength: 0,
        def_run_stuff_rate: 0,
      };
      if (options.includeOpponentContext && options.opponentId) {
        console.debug(`[OLC] Calculating opponent context for ${teamId} vs ${options.opponentId}`);
        const context = await this.opponentCalculator.calculateOpponentContext(
          teamId,
          options.opponentId,
          season,
          week,
          scoreResult.olc_100,
          sourceData.espn_rbwr
        );
        opponentContext = {
          pass_context_w: context.pass_context_w,
          run_context_w: context.run_context_w,
          def_pass_rush_strength: context.def_pass_rush_strength,
          def_run_stuff_rate: context.def_run_stuff_rate,
        };
        console.debug(`[OLC] Opponent context: Pass=${(context.pass_context_w*100).toFixed(1)}%, Run=${(context.run_context_w*100).toFixed(1)}%`);
      }

      // Step 7: Build final result
      const result: OlcTeamWeek = {
        teamId,
        season,
        week,
        olc_100: scoreResult.olc_100,
        olc_raw: scoreResult.olc_raw,
        cohesion_score: cohesionResult.cohesion_raw,
        cohesion_z: cohesionResult.cohesion_z,
        injury_penalty: scoreResult.injury_penalty,
        shuffle_penalty: scoreResult.shuffle_penalty,
        green_penalty: scoreResult.green_penalty,
        total_penalty: scoreResult.total_penalty,
        scale_k: scoreResult.scale_k,
        sigma: scoreResult.sigma,
        components: {
          pff_pb: sourceData.pff_pb,
          espn_pbwr: sourceData.espn_pbwr,
          espn_rbwr: sourceData.espn_rbwr,
          pressure_rate: sourceData.pressure_rate,
          adjusted_sack_rate: sourceData.adjusted_sack_rate,
          ybc_per_rush: sourceData.ybc_per_rush,
        },
        adjusters,
        opponent_context: opponentContext,
        meta: {
          pos_continuity: cohesionResult.position_continuity,
          pair_continuity: cohesionResult.pair_continuity,
          snap_sync: cohesionResult.snap_sync,
          injury_penalty_breakdown: scoreResult.penalty_breakdown,
        },
      };

      // Cache the result
      this.cache.set(cacheKey, result);
      this.cacheTimestamps.set(cacheKey, Date.now());
      console.debug(`[OLC] Cached result for ${cacheKey}, cache size: ${this.cache.size}`);

      const duration = Date.now() - startTime;
      console.info(`[OLC] Calculation completed for ${teamId} ${season} Week ${week}: OLC_100=${result.olc_100.toFixed(1)} (${duration}ms)`);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[OLC] Calculation failed for ${teamId} ${season} Week ${week}: ${error instanceof Error ? error.message : String(error)} (${duration}ms)`);
      throw error;
    }
  }

  private isCacheValid(cacheKey: string): boolean {
    if (!this.cache.has(cacheKey) || !this.cacheTimestamps.has(cacheKey)) {
      return false;
    }

    const timestamp = this.cacheTimestamps.get(cacheKey)!;
    const isValid = Date.now() - timestamp < this.cacheTTL;
    
    if (!isValid) {
      this.cache.delete(cacheKey);
      this.cacheTimestamps.delete(cacheKey);
      console.debug(`[OLC] Cache miss for ${cacheKey}`);
    }

    return isValid;
  }

  private async getPreviousDepthCharts(teamId: string, season: number, week: number) {
    // In production, fetch actual previous depth charts
    // For now, return empty array
    return [];
  }

  // Batch processing for multiple teams/weeks
  async buildOlcBatch(
    requests: Array<{ teamId: string; season: number; week: number; options?: BuildOlcOptions }>
  ): Promise<OlcTeamWeek[]> {
    console.info(`[OLC] Starting batch calculation for ${requests.length} requests`);

    const results = await Promise.allSettled(
      requests.map(req => this.buildOlcForWeek(req.teamId, req.season, req.week, req.options))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;

    console.info(`[OLC] Batch calculation completed: ${successful}/${requests.length} successful, ${failed} failed`);

    return results
      .filter((r): r is PromiseFulfilledResult<OlcTeamWeek> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
    console.info('[OLC] Cache cleared');
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: Record<string, any> }> {
    try {
      // Test a quick calculation with stub data
      const testResult = await this.buildOlcForWeek('TEST', 2025, 1, { forceRefresh: true });
      
      return {
        status: 'healthy',
        details: {
          cache_size: this.cache.size,
          test_olc_score: testResult.olc_100,
          modules_loaded: true,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error),
          cache_size: this.cache.size,
        },
      };
    }
  }
}

// Export main function
export async function buildOlcForWeek(
  teamId: string,
  season: number,
  week: number,
  options: BuildOlcOptions = {}
): Promise<OlcTeamWeek> {
  const builder = OlcBuilder.getInstance();
  return builder.buildOlcForWeek(teamId, season, week, options);
}

// Export builder for advanced usage  
export { OlcBuilder };
export * from './schema';
export * from './adjusters';
export * from './opponent';