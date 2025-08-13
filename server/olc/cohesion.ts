import { POSITION_WEIGHTS, type OlDepthChart } from './schema';

export interface CohesionResult {
  cohesion_raw: number;
  cohesion_z: number;
  position_continuity: number;
  pair_continuity: number;
  snap_sync: number;
  meta: {
    position_scores: Record<string, number>;
    pair_scores: Record<string, number>;
    shared_snaps: number;
    league_max_snaps: number;
  };
}

export class OlCohesionCalculator {
  private static instance: OlCohesionCalculator;
  private leagueCohesionStats = new Map<string, { mean: number; std: number }>();

  static getInstance(): OlCohesionCalculator {
    if (!OlCohesionCalculator.instance) {
      OlCohesionCalculator.instance = new OlCohesionCalculator();
    }
    return OlCohesionCalculator.instance;
  }

  async calculateCohesion(
    teamId: string,
    season: number,
    week: number,
    depthChart: OlDepthChart,
    previousWeeks: OlDepthChart[]
  ): Promise<CohesionResult> {
    console.debug('[OLC] Calculating OL cohesion', { teamId, season, week });

    const positionContinuity = this.calculatePositionContinuity(depthChart, previousWeeks);
    const pairContinuity = this.calculatePairContinuity(depthChart, previousWeeks);
    const snapSync = this.calculateSnapSync(depthChart);

    // Weighted cohesion formula from spec
    const cohesionRaw = 
      0.6 * positionContinuity.average +
      0.25 * pairContinuity.average +
      0.15 * snapSync.score;

    const cohesionZ = await this.normalizeCohesion(cohesionRaw, season, week);

    const result: CohesionResult = {
      cohesion_raw: cohesionRaw,
      cohesion_z: cohesionZ,
      position_continuity: positionContinuity.average,
      pair_continuity: pairContinuity.average,
      snap_sync: snapSync.score,
      meta: {
        position_scores: positionContinuity.scores,
        pair_scores: pairContinuity.scores,
        shared_snaps: snapSync.shared_snaps,
        league_max_snaps: snapSync.league_max,
      },
    };

    console.debug('[OLC] Cohesion calculated', { teamId, season, week, result });

    return result;
  }

  private calculatePositionContinuity(
    current: OlDepthChart,
    previousWeeks: OlDepthChart[]
  ): { average: number; scores: Record<string, number> } {
    const positions = Object.keys(POSITION_WEIGHTS);
    const scores: Record<string, number> = {};
    
    for (const pos of positions) {
      const currentStarter = current[pos as keyof OlDepthChart]?.find((p: any) => p.is_starter);
      if (!currentStarter) {
        scores[pos] = 0;
        continue;
      }

      // Count consecutive weeks this player has started at this position
      let continuityWeeks = 1; // Current week
      
      for (let i = previousWeeks.length - 1; i >= 0; i--) {
        const prevWeek = previousWeeks[i];
        const prevStarter = prevWeek[pos as keyof OlDepthChart]?.find((p: any) => p.is_starter);
        
        if (prevStarter?.player_id === currentStarter.player_id) {
          continuityWeeks++;
        } else {
          break;
        }
      }

      // Score: weeks of continuity / max possible weeks, capped at 1.0
      const maxWeeks = Math.min(previousWeeks.length + 1, 8); // Cap at 8 weeks
      scores[pos] = Math.min(continuityWeeks / maxWeeks, 1.0);
    }

    // Weight by position importance
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const [pos, score] of Object.entries(scores)) {
      const weight = POSITION_WEIGHTS[pos as keyof typeof POSITION_WEIGHTS] || 0;
      weightedSum += score * weight;
      totalWeight += weight;
    }

    const average = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return { average, scores };
  }

  private calculatePairContinuity(
    current: OlDepthChart,
    previousWeeks: OlDepthChart[]
  ): { average: number; scores: Record<string, number> } {
    const pairs = [
      { name: 'LT-LG', positions: ['LT', 'LG'] },
      { name: 'LG-C', positions: ['LG', 'C'] },
      { name: 'C-RG', positions: ['C', 'RG'] },
      { name: 'RG-RT', positions: ['RG', 'RT'] },
    ];

    const scores: Record<string, number> = {};

    for (const pair of pairs) {
      const [pos1, pos2] = pair.positions;
      const currentStarter1 = current[pos1 as keyof OlDepthChart]?.find((p: any) => p.is_starter);
      const currentStarter2 = current[pos2 as keyof OlDepthChart]?.find((p: any) => p.is_starter);

      if (!currentStarter1 || !currentStarter2) {
        scores[pair.name] = 0;
        continue;
      }

      // Count consecutive weeks this pair has played together
      let pairWeeks = 1; // Current week

      for (let i = previousWeeks.length - 1; i >= 0; i--) {
        const prevWeek = previousWeeks[i];
        const prevStarter1 = prevWeek[pos1 as keyof OlDepthChart]?.find((p: any) => p.is_starter);
        const prevStarter2 = prevWeek[pos2 as keyof OlDepthChart]?.find((p: any) => p.is_starter);

        if (
          prevStarter1?.player_id === currentStarter1.player_id &&
          prevStarter2?.player_id === currentStarter2.player_id
        ) {
          pairWeeks++;
        } else {
          break;
        }
      }

      const maxWeeks = Math.min(previousWeeks.length + 1, 8);
      scores[pair.name] = Math.min(pairWeeks / maxWeeks, 1.0);
    }

    // Average all pair scores (each worth 0.25 per spec)
    const pairValues = Object.values(scores);
    const average = pairValues.length > 0 
      ? pairValues.reduce((sum, score) => sum + score, 0) / pairValues.length 
      : 0;

    return { average, scores };
  }

  private calculateSnapSync(depthChart: OlDepthChart): {
    score: number;
    shared_snaps: number;
    league_max: number;
  } {
    // Calculate minimum snaps among all starting OL players
    const starterSnaps = Object.values(depthChart)
      .map((pos: any) => pos.find((p: any) => p.is_starter)?.snaps || 0)
      .filter((snaps: number) => snaps > 0);

    if (starterSnaps.length === 0) {
      return { score: 0, shared_snaps: 0, league_max: 1200 };
    }

    const sharedSnaps = Math.min(...starterSnaps);
    const leagueMaxSnaps = 1200; // Typical max snaps in NFL season
    
    const score = Math.min(sharedSnaps / leagueMaxSnaps, 1.0);

    return {
      score,
      shared_snaps: sharedSnaps,
      league_max: leagueMaxSnaps,
    };
  }

  private async normalizeCohesion(cohesionRaw: number, season: number, week: number): Promise<number> {
    const cacheKey = `${season}-${week}`;
    
    let stats = this.leagueCohesionStats.get(cacheKey);
    if (!stats) {
      // In production, calculate from all teams' cohesion scores
      // For now, use realistic estimates
      stats = { mean: 0.65, std: 0.12 };
      this.leagueCohesionStats.set(cacheKey, stats);
      
      console.debug('[OLC] League cohesion stats cached', { season, week, stats });
    }

    const cohesionZ = stats.std > 0 ? (cohesionRaw - stats.mean) / stats.std : 0;
    
    return cohesionZ;
  }

  clearCache(): void {
    this.leagueCohesionStats.clear();
    console.info('[OLC] Cohesion cache cleared');
  }
}