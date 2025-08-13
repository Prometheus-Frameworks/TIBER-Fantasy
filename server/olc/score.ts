import { INJURY_MULTIPLIERS, type OlDepthChart } from './schema';
import type { OlInjuryData } from './sources';
import type { CohesionResult } from './cohesion';

export interface OlcScoreResult {
  olc_100: number;
  olc_raw: number;
  scale_k: number;
  sigma: number;
  injury_penalty: number;
  shuffle_penalty: number;
  green_penalty: number;
  total_penalty: number;
  penalty_breakdown: Array<{
    position: string;
    penalty: number;
    reason: string;
  }>;
}

export class OlcScorer {
  private static instance: OlcScorer;
  private sigmaCacheMap = new Map<string, number>();

  static getInstance(): OlcScorer {
    if (!OlcScorer.instance) {
      OlcScorer.instance = new OlcScorer();
    }
    return OlcScorer.instance;
  }

  async calculateOlcScore(
    teamId: string,
    season: number,
    week: number,
    normalizedMetrics: {
      pff_pb_z: number;
      espn_pbwr_z: number;
      espn_rbwr_z: number;
      pressure_rate_z: number;
      adjusted_sack_rate_z: number;
      ybc_per_rush_z: number;
    },
    cohesionResult: CohesionResult,
    injuries: OlInjuryData[],
    depthChart: OlDepthChart,
    previousDepthChart?: OlDepthChart
  ): Promise<OlcScoreResult> {
    console.debug('[OLC] Calculating OLC score', { teamId, season, week });

    // Calculate base OLC raw score from normalized metrics
    const olcRaw = this.calculateRawScore(normalizedMetrics, cohesionResult);

    // Calculate penalties
    const injuryPenalty = this.calculateInjuryPenalty(injuries);
    const shufflePenalty = this.calculateShufflePenalty(depthChart, previousDepthChart);
    const greenPenalty = this.calculateGreenPenalty(depthChart);

    const totalPenalty = Math.max(injuryPenalty + shufflePenalty + greenPenalty, -12);
    
    const penaltyBreakdown = [
      ...this.getPenaltyBreakdown(injuries, depthChart, previousDepthChart),
    ];

    // Get scaling parameters
    const scaleK = week >= 8 ? 15 : 12;
    const sigma = await this.getSigma(season, week);

    // Calculate final OLC_100 score
    const adjustedRaw = olcRaw + (totalPenalty / 10); // Scale penalty to raw score impact
    const olc100 = Math.max(0, Math.min(100, 50 + scaleK * (adjustedRaw / sigma)));

    const result: OlcScoreResult = {
      olc_100: olc100,
      olc_raw: olcRaw,
      scale_k: scaleK,
      sigma,
      injury_penalty: injuryPenalty,
      shuffle_penalty: shufflePenalty,
      green_penalty: greenPenalty,
      total_penalty: totalPenalty,
      penalty_breakdown: penaltyBreakdown,
    };

    console.debug('[OLC] OLC score calculated', { teamId, season, week, result });

    return result;
  }

  private calculateRawScore(
    metrics: {
      pff_pb_z: number;
      espn_pbwr_z: number;
      espn_rbwr_z: number;
      pressure_rate_z: number;
      adjusted_sack_rate_z: number;
      ybc_per_rush_z: number;
    },
    cohesion: CohesionResult
  ): number {
    // Weighted combination of normalized metrics
    const metricWeights = {
      pff_pb_z: 0.25,
      espn_pbwr_z: 0.20,
      espn_rbwr_z: 0.20,
      pressure_rate_z: 0.15,
      adjusted_sack_rate_z: 0.10,
      ybc_per_rush_z: 0.10,
    };

    let weightedSum = 0;
    for (const [metric, weight] of Object.entries(metricWeights)) {
      weightedSum += metrics[metric as keyof typeof metrics] * weight;
    }

    // Add cohesion component (10% weight)
    const olcRaw = weightedSum * 0.9 + cohesion.cohesion_z * 0.1;

    return olcRaw;
  }

  private calculateInjuryPenalty(injuries: OlInjuryData[]): number {
    let penalty = 0;

    for (const injury of injuries) {
      if (!injury.is_starter) continue;

      const multiplier = INJURY_MULTIPLIERS[injury.position as keyof typeof INJURY_MULTIPLIERS] || 1.0;
      const basePenalty = -2 * multiplier;

      penalty += basePenalty;
    }

    return penalty;
  }

  private calculateShufflePenalty(
    current: OlDepthChart,
    previous?: OlDepthChart
  ): number {
    if (!previous) return 0;

    const positions = ['LT', 'LG', 'C', 'RG', 'RT'];
    let changedPositions = 0;

    for (const pos of positions) {
      const currentStarter = current[pos as keyof OlDepthChart]?.find((p: any) => p.is_starter);
      const previousStarter = previous[pos as keyof OlDepthChart]?.find((p: any) => p.is_starter);

      if (currentStarter?.player_id !== previousStarter?.player_id) {
        changedPositions++;
      }
    }

    return changedPositions >= 2 ? -2 : 0;
  }

  private calculateGreenPenalty(depthChart: OlDepthChart): number {
    const positions = ['LT', 'LG', 'C', 'RG', 'RT'];
    let hasGreenPlayer = false;

    for (const pos of positions) {
      const starter = depthChart[pos as keyof OlDepthChart]?.find((p: any) => p.is_starter);
      if (starter && starter.snaps < 100) {
        hasGreenPlayer = true;
        break;
      }
    }

    return hasGreenPlayer ? -1.5 : 0;
  }

  private getPenaltyBreakdown(
    injuries: OlInjuryData[],
    current: OlDepthChart,
    previous?: OlDepthChart
  ): Array<{ position: string; penalty: number; reason: string }> {
    const breakdown: Array<{ position: string; penalty: number; reason: string }> = [];

    // Injury penalties
    for (const injury of injuries) {
      if (!injury.is_starter) continue;

      const multiplier = INJURY_MULTIPLIERS[injury.position as keyof typeof INJURY_MULTIPLIERS] || 1.0;
      const penalty = -2 * multiplier;

      breakdown.push({
        position: injury.position,
        penalty,
        reason: `Starter injury (${injury.status})`,
      });
    }

    // Shuffle penalty
    if (previous) {
      const positions = ['LT', 'LG', 'C', 'RG', 'RT'];
      let changedPositions = 0;

      for (const pos of positions) {
        const currentStarter = current[pos as keyof OlDepthChart]?.find((p: any) => p.is_starter);
        const previousStarter = previous[pos as keyof OlDepthChart]?.find((p: any) => p.is_starter);

        if (currentStarter?.player_id !== previousStarter?.player_id) {
          changedPositions++;
        }
      }

      if (changedPositions >= 2) {
        breakdown.push({
          position: 'OL_UNIT',
          penalty: -2,
          reason: `Line shuffle (${changedPositions} positions changed)`,
        });
      }
    }

    // Green penalty
    const positions = ['LT', 'LG', 'C', 'RG', 'RT'];
    for (const pos of positions) {
      const starter = current[pos as keyof OlDepthChart]?.find((p: any) => p.is_starter);
      if (starter && starter.snaps < 100) {
        breakdown.push({
          position: pos,
          penalty: -1.5,
          reason: `Green player (<100 career snaps)`,
        });
        break; // Only apply once per unit
      }
    }

    return breakdown;
  }

  private async getSigma(season: number, week: number): Promise<number> {
    const cacheKey = `${season}-${week}`;
    
    let sigma = this.sigmaCacheMap.get(cacheKey);
    if (sigma === undefined) {
      // In production, calculate from all teams' OLC_raw scores
      // For now, use realistic estimate with floor of 0.85
      sigma = Math.max(0.85, 1.2 + Math.random() * 0.3);
      this.sigmaCacheMap.set(cacheKey, sigma);
      
      console.debug('[OLC] Sigma cached', { season, week, sigma });
    }

    return sigma;
  }

  clearCache(): void {
    this.sigmaCacheMap.clear();
    console.info('[OLC] OLC scoring cache cleared');
  }
}