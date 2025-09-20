// Note: using console for logging
import type { OlcScoreResult } from './score';
import { oasisEnvironmentService } from '../services/oasisEnvironmentService';

export interface PositionAdjusters {
  qb_env: number;        // ±4% base, ±6% cap
  rb_runways: number;    // ±8% cap
  wrte_timing: number;   // ±4% cap
  oasis_team_mult: number; // OASIS team offense multiplier 0.90-1.10
}

export interface AdjusterInputs {
  olc_100: number;
  proe_z: number;        // Pressure Over Expected Z-score
  qbP2S_z: number;       // QB Pressure to Sack Z-score
  rbwr_z: number;        // Run Block Win Rate Z-score
  ybc_z: number;         // Yards Before Contact Z-score
  pff_pb_z: number;      // PFF Pass Block Z-score
}

export class OlcAdjusterCalculator {
  private static instance: OlcAdjusterCalculator;

  static getInstance(): OlcAdjusterCalculator {
    if (!OlcAdjusterCalculator.instance) {
      OlcAdjusterCalculator.instance = new OlcAdjusterCalculator();
    }
    return OlcAdjusterCalculator.instance;
  }

  async calculatePositionAdjusters(
    teamId: string,
    season: number,
    week: number,
    inputs: AdjusterInputs
  ): Promise<PositionAdjusters> {
    console.debug('[OLC] Calculating position adjusters', { teamId, season, week, inputs });

    const qbEnv = this.calculateQbEnvironment(inputs);
    const rbRunways = this.calculateRbRunways(inputs);
    const wrteTimining = this.calculateWrTeTiming(inputs);
    const oasisTeamMult = await this.calculateOasisTeamMultiplier(teamId);

    const adjusters: PositionAdjusters = {
      qb_env: qbEnv,
      rb_runways: rbRunways,
      wrte_timing: wrteTimining,
      oasis_team_mult: oasisTeamMult,
    };

    console.debug('[OLC] Position adjusters calculated', { teamId, season, week, adjusters });

    return adjusters;
  }

  private calculateQbEnvironment(inputs: AdjusterInputs): number {
    // QB_env: scale OLC_100 → ±4%, +0.5*(−proe_z/10) + 0.5*(−qbP2S_z/10), cap ±6%
    
    // Base adjustment from OLC_100 (±4% range)
    const olcComponent = ((inputs.olc_100 - 50) / 50) * 0.04; // 0-100 -> -1 to +1 -> ±4%
    
    // Pressure components (negative Z-scores are better)
    const proeComponent = 0.5 * (-inputs.proe_z / 10);
    const qbP2SComponent = 0.5 * (-inputs.qbP2S_z / 10);
    
    const totalAdjustment = olcComponent + proeComponent + qbP2SComponent;
    
    // Cap at ±6%
    return Math.max(-0.06, Math.min(0.06, totalAdjustment));
  }

  private calculateRbRunways(inputs: AdjusterInputs): number {
    // RB_runways: 0.6RBWR_z→±6% + 0.4YBC_z→±4%, cap ±8%
    
    const rbwrComponent = 0.6 * (inputs.rbwr_z / 2) * 0.06; // Z-score to ±6% range
    const ybcComponent = 0.4 * (inputs.ybc_z / 2) * 0.04;   // Z-score to ±4% range
    
    const totalAdjustment = rbwrComponent + ybcComponent;
    
    // Cap at ±8%
    return Math.max(-0.08, Math.min(0.08, totalAdjustment));
  }

  private calculateWrTeTiming(inputs: AdjusterInputs): number {
    // WRTE_timing: 0.7OLC_100→±3% + 0.3PFF_PB_z→±2%, cap ±4%
    
    const olcComponent = 0.7 * ((inputs.olc_100 - 50) / 50) * 0.03; // OLC_100 to ±3% range
    const pffComponent = 0.3 * (inputs.pff_pb_z / 2) * 0.02;        // Z-score to ±2% range
    
    const totalAdjustment = olcComponent + pffComponent;
    
    // Cap at ±4%
    return Math.max(-0.04, Math.min(0.04, totalAdjustment));
  }

  // Apply adjusters to a baseline value
  applyAdjusters(
    baseline: number,
    adjusters: PositionAdjusters,
    position: 'QB' | 'RB' | 'WR' | 'TE'
  ): number {
    let adjuster = 0;

    switch (position) {
      case 'QB':
        adjuster = adjusters.qb_env;
        break;
      case 'RB':
        adjuster = adjusters.rb_runways;
        break;
      case 'WR':
      case 'TE':
        adjuster = adjusters.wrte_timing;
        break;
    }

    const adjustedValue = baseline * (1 + adjuster);
    
    console.debug('[OLC] Adjuster applied', { 
      position, 
      baseline, 
      adjuster: adjuster * 100, // Convert to percentage for logging
      adjustedValue 
    });

    return adjustedValue;
  }

  /**
   * Calculate OASIS team offense multiplier for ROS projections
   * Formula: clamp(0.95 + 0.10*(scoring_env_pct−50)/50 + 0.05*(pace_pct−50)/50 + 0.05*(rz_eff_pct−50)/50, 0.90, 1.10)
   */
  private async calculateOasisTeamMultiplier(teamId: string): Promise<number> {
    try {
      const teamEnv = await oasisEnvironmentService.getTeamEnvironment(teamId);
      if (!teamEnv) {
        console.debug(`[OLC] No OASIS data for team ${teamId}, using default multiplier 1.0`);
        return 1.0; // Default multiplier
      }

      // Calculate components based on percentiles
      const scoringEnvComponent = 0.10 * (teamEnv.scoring_environment_pct - 50) / 50;
      const paceComponent = 0.05 * (teamEnv.pace_pct - 50) / 50;
      const redZoneComponent = 0.05 * (teamEnv.red_zone_efficiency_pct - 50) / 50;

      // Base multiplier + components
      const teamOffMult = 0.95 + scoringEnvComponent + paceComponent + redZoneComponent;

      // Clamp between 0.90 and 1.10
      const clampedMult = Math.max(0.90, Math.min(1.10, teamOffMult));

      console.debug(`[OLC] OASIS team multiplier for ${teamId}:`, {
        scoring_env_pct: teamEnv.scoring_environment_pct,
        pace_pct: teamEnv.pace_pct,
        red_zone_pct: teamEnv.red_zone_efficiency_pct,
        components: { scoringEnvComponent, paceComponent, redZoneComponent },
        final_multiplier: clampedMult
      });

      return clampedMult;
    } catch (error) {
      console.error(`[OLC] Error calculating OASIS multiplier for ${teamId}:`, error);
      return 1.0; // Fallback to default
    }
  }

  // Apply adjusters to a baseline value (includes OASIS team multiplier)
  applyAdjustersWithOasis(
    baseline: number,
    adjusters: PositionAdjusters,
    position: 'QB' | 'RB' | 'WR' | 'TE'
  ): number {
    let positionAdjuster = 0;

    switch (position) {
      case 'QB':
        positionAdjuster = adjusters.qb_env;
        break;
      case 'RB':
        positionAdjuster = adjusters.rb_runways;
        break;
      case 'WR':
      case 'TE':
        positionAdjuster = adjusters.wrte_timing;
        break;
    }

    // Apply position adjuster first, then OASIS team multiplier
    const positionAdjustedValue = baseline * (1 + positionAdjuster);
    const finalValue = positionAdjustedValue * adjusters.oasis_team_mult;
    
    console.debug('[OLC] Adjuster with OASIS applied', { 
      position, 
      baseline, 
      position_adjuster: positionAdjuster * 100,
      oasis_multiplier: adjusters.oasis_team_mult,
      final_value: finalValue
    });

    return finalValue;
  }

  // Apply adjusters to a baseline value (legacy method)
  applyAdjusters(
    baseline: number,
    adjusters: PositionAdjusters,
    position: 'QB' | 'RB' | 'WR' | 'TE'
  ): number {
    let adjuster = 0;

    switch (position) {
      case 'QB':
        adjuster = adjusters.qb_env;
        break;
      case 'RB':
        adjuster = adjusters.rb_runways;
        break;
      case 'WR':
      case 'TE':
        adjuster = adjusters.wrte_timing;
        break;
    }

    const adjustedValue = baseline * (1 + adjuster);
    
    console.debug('[OLC] Adjuster applied', { 
      position, 
      baseline, 
      adjuster: adjuster * 100, // Convert to percentage for logging
      adjustedValue 
    });

    return adjustedValue;
  }

  // Get adjuster explanation for UI
  getAdjusterExplanation(adjusters: PositionAdjusters): Record<string, string> {
    const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
    const formatMultiplier = (value: number) => `${(value * 100).toFixed(1)}%`;

    return {
      qb_env: `QB Environment: ${formatPercent(adjusters.qb_env)} (pass protection quality)`,
      rb_runways: `RB Runways: ${formatPercent(adjusters.rb_runways)} (run blocking effectiveness)`,
      wrte_timing: `WR/TE Timing: ${formatPercent(adjusters.wrte_timing)} (route timing/protection)`,
      oasis_team_mult: `OASIS Team Multiplier: ${formatMultiplier(adjusters.oasis_team_mult)} (team offensive environment)`,
    };
  }
}