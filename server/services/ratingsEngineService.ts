/**
 * Ratings Engine v1 Service
 * Centralized player rating and ranking system
 */

import fs from 'fs/promises';
import path from 'path';
import { applyOTCBias } from '../ratings/score';

export interface PlayerRating {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  overall_rating: number; // 0-100 scale
  positional_rank: number;
  tier: string; // S, A, B, C, D
  components: {
    talent: number; // 0-100
    opportunity: number; // 0-100
    consistency: number; // 0-100
    upside: number; // 0-100
    floor: number; // 0-100
  };
  fpgMetrics: {
    fpg: number; // Current season fantasy points per game
    xFpg: number; // Expected FPG based on advanced metrics
    projFpg: number; // Projected FPG for rest of season
    upsideIndex: number; // 0-100 upside potential
    upsideBoost: number; // Calculated boost from upside factors
    fpgTrend: string; // "rising", "declining", "stable"
    explosivePlays: number; // 20+ yard plays this season
  };
  format_ratings: {
    redraft: number;
    dynasty: number;
    half_ppr: number;
    full_ppr: number;
    superflex: number;
  };
  age_adjusted_value: number;
  breakout_probability?: number; // For rookies/young players
  decline_risk?: number; // For aging players
  last_updated: string;
}

export interface PositionRankings {
  position: string;
  format: string;
  rankings: PlayerRating[];
  last_updated: string;
  total_players: number;
}

export interface RatingsEngineConfig {
  weights: {
    talent: number;
    opportunity: number;
    consistency: number;
    upside: number;
    floor: number;
  };
  fpgWeights: {
    qb: { fpgBase: number; xFpg: number; projFpg: number; upsideIndex: number; };
    rb: { fpgBase: number; xFpg: number; projFpg: number; upsideIndex: number; };
    wr: { fpgBase: number; xFpg: number; projFpg: number; upsideIndex: number; };
    te: { fpgBase: number; xFpg: number; projFpg: number; upsideIndex: number; };
  };
  age_penalty: {
    qb_peak: number;
    rb_peak: number;
    wr_peak: number;
    te_peak: number;
  };
  tier_thresholds: {
    s_tier: number;
    a_tier: number;
    b_tier: number;
    c_tier: number;
  };
}

class RatingsEngineService {
  private readonly DATA_DIR = path.join(process.cwd(), 'server', 'data');
  private readonly RATINGS_FILE = path.join(this.DATA_DIR, 'player_ratings_v1.json');
  private readonly CONFIG_FILE = path.join(this.DATA_DIR, 'ratings_engine_config.json');

  private readonly DEFAULT_CONFIG: RatingsEngineConfig = {
    weights: {
      talent: 0.35,      // Raw ability and skill
      opportunity: 0.25,  // Team situation and target share
      consistency: 0.20,  // Game-to-game reliability
      upside: 0.15,      // Ceiling potential
      floor: 0.05        // Safety/injury risk
    },
    // FPG-CENTRIC WEIGHTS FOR POSITION-SPECIFIC SCORING
    fpgWeights: {
      qb: { fpgBase: 0.45, xFpg: 0.30, projFpg: 0.15, upsideIndex: 0.10 },
      rb: { fpgBase: 0.50, xFpg: 0.25, projFpg: 0.15, upsideIndex: 0.10 },
      wr: { fpgBase: 0.40, xFpg: 0.35, projFpg: 0.15, upsideIndex: 0.10 },
      te: { fpgBase: 0.45, xFpg: 0.30, projFpg: 0.15, upsideIndex: 0.10 }
    },
    age_penalty: {
      qb_peak: 32,
      rb_peak: 27,
      wr_peak: 29,
      te_peak: 30
    },
    tier_thresholds: {
      s_tier: 90,
      a_tier: 80,
      b_tier: 70,
      c_tier: 60
    }
  };

  constructor() {
    this.ensureDataDirectory();
    this.initializeConfig();
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.DATA_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  private async initializeConfig(): Promise<void> {
    try {
      await fs.access(this.CONFIG_FILE);
    } catch {
      await this.writeFile(this.CONFIG_FILE, this.DEFAULT_CONFIG);
    }
  }

  private async readFile<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async writeFile<T>(filePath: string, data: T): Promise<void> {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Failed to write file ${filePath}:`, error);
    }
  }

  /**
   * Calculate overall rating from components
   */
  private calculateOverallRating(components: PlayerRating['components'], config: RatingsEngineConfig): number {
    const { weights } = config;
    
    return Math.round(
      components.talent * weights.talent +
      components.opportunity * weights.opportunity +
      components.consistency * weights.consistency +
      components.upside * weights.upside +
      components.floor * weights.floor
    );
  }

  /**
   * Calculate FPG-centric rating using position-specific weights
   */
  private calculateFPGRating(fpgMetrics: PlayerRating['fpgMetrics'], position: string, config: RatingsEngineConfig): number {
    const posKey = position.toLowerCase() as keyof typeof config.fpgWeights;
    const weights = config.fpgWeights[posKey];
    
    if (!weights) {
      // Fallback to base FPG if position weights not found
      return Math.round(fpgMetrics.fpg * 4); // Scale FPG to 0-100 range
    }
    
    // Normalize FPG values to 0-100 scale for calculation
    const normalizedFpg = Math.min(100, (fpgMetrics.fpg / 30) * 100); // Assume max FPG ~30
    const normalizedXFpg = Math.min(100, (fpgMetrics.xFpg / 30) * 100);
    const normalizedProjFpg = Math.min(100, (fpgMetrics.projFpg / 30) * 100);
    
    const fpgScore = (
      normalizedFpg * weights.fpgBase +
      normalizedXFpg * weights.xFpg +
      normalizedProjFpg * weights.projFpg +
      fpgMetrics.upsideIndex * weights.upsideIndex
    );
    
    // Apply upside boost
    const finalScore = fpgScore + fpgMetrics.upsideBoost;
    
    return Math.round(Math.min(100, Math.max(0, finalScore)));
  }

  /**
   * Determine tier based on overall rating
   */
  private calculateTier(rating: number, config: RatingsEngineConfig): string {
    const { tier_thresholds } = config;
    
    if (rating >= tier_thresholds.s_tier) return 'S';
    if (rating >= tier_thresholds.a_tier) return 'A';
    if (rating >= tier_thresholds.b_tier) return 'B';
    if (rating >= tier_thresholds.c_tier) return 'C';
    return 'D';
  }

  /**
   * Apply age adjustment to rating
   */
  private applyAgeAdjustment(rating: number, age: number, position: string, config: RatingsEngineConfig): number {
    const peakAge = config.age_penalty[`${position.toLowerCase()}_peak` as keyof typeof config.age_penalty];
    
    if (age <= peakAge) {
      // Young player bonus (small)
      const bonus = age < (peakAge - 2) ? 2 : 0;
      return Math.min(100, rating + bonus);
    } else {
      // Age penalty for older players
      const yearsOverPeak = age - peakAge;
      const penalty = position === 'RB' ? yearsOverPeak * 3 : yearsOverPeak * 2;
      return Math.max(0, rating - penalty);
    }
  }

  /**
   * Calculate Upside Index with special boost for rushing QBs
   */
  private calculateUpsideIndex(player: any, position: string): number {
    let baseUpside = 50; // Start at neutral

    if (position === 'QB') {
      // RUSHING QB UPSIDE BOOST SYSTEM
      const rushYards = player.rush_yards || 0;
      const rushAttempts = player.rush_attempts || 0;
      const rushTD = player.rush_td || 0;
      
      // Upside boost for rushing production
      if (rushYards > 500) baseUpside += 25; // Elite rushers like Lamar, Josh Allen
      else if (rushYards > 300) baseUpside += 15; // Good rushers like Drake Maye
      else if (rushYards > 150) baseUpside += 8; // Decent rushers
      
      // Additional boost for rushing TDs
      if (rushTD >= 5) baseUpside += 10;
      else if (rushTD >= 3) baseUpside += 5;
      
      // Mobility/scrambling potential for young QBs
      const age = player.age || 25;
      if (age <= 25 && rushAttempts > 40) baseUpside += 12; // Young mobile QBs
      
    } else if (position === 'WR' || position === 'TE') {
      // Explosive play upside
      const explosivePlays = player.explosive_plays || 0;
      const ypr = player.yards_per_reception || 0;
      
      if (explosivePlays >= 8) baseUpside += 20; // Deep threat capability
      else if (explosivePlays >= 5) baseUpside += 12;
      
      if (ypr >= 15) baseUpside += 10; // Big play ability
      
    } else if (position === 'RB') {
      // TD upside and breakaway ability
      const rushTD = player.rush_td || 0;
      const recTD = player.rec_td || 0;
      const breakaways = player.explosive_plays || 0;
      
      if ((rushTD + recTD) >= 10) baseUpside += 15; // Goal line back
      if (breakaways >= 6) baseUpside += 12; // Breakaway speed
    }

    return Math.min(100, Math.max(0, baseUpside));
  }

  /**
   * Calculate expected FPG based on advanced metrics
   */
  private calculateXFpg(player: any, position: string): number {
    const baseFpg = player.fpg || player.avg_points || 0;
    
    // Regression toward mean based on sample size and variance
    const gamesPlayed = player.games_played || 16;
    const variance = player.fpg_variance || 0;
    
    let xFpg = baseFpg;
    
    // Adjust for small sample sizes
    if (gamesPlayed < 8) {
      xFpg *= 0.85; // Regress down for small samples
    }
    
    // Adjust for high variance (inconsistent production)
    if (variance > 6) {
      xFpg *= 0.92; // Slight regression for inconsistent players
    }
    
    return Math.round(xFpg * 100) / 100;
  }

  /**
   * Calculate upside boost with caps and position-specific logic
   */
  private calculateUpsideBoost(upsideIndex: number, position: string, age: number): number {
    let boost = upsideIndex * 0.1; // Base conversion
    
    // Position-specific caps and multipliers
    if (position === 'QB') {
      // Higher upside potential for QBs
      boost *= 1.2;
      if (age <= 25) boost *= 1.15; // Young QB multiplier
    } else if (position === 'RB') {
      // RBs have lower upside due to positional constraints
      boost *= 0.8;
      if (age >= 28) boost *= 0.7; // Age penalty for RBs
    }
    
    // Apply caps: Max 8 point boost, min 0
    return Math.min(8, Math.max(0, boost));
  }

  /**
   * Generate sample ratings for development
   */
  async generateSampleRatings(): Promise<void> {
    console.log('🎯 Generating sample player ratings...');
    
    const config = await this.readFile<RatingsEngineConfig>(this.CONFIG_FILE) || this.DEFAULT_CONFIG;
    
    const sampleRatings: PlayerRating[] = [
      // TIER 1 - ELITE QBs (S TIER)
      {
        player_id: 'josh_allen',
        player_name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        overall_rating: 0,
        positional_rank: 1,
        tier: '',
        components: {
          talent: 96,
          opportunity: 95,
          consistency: 85,
          upside: 98,
          floor: 88
        },
        fpgMetrics: {
          fpg: 24.8, // Elite rushing QB FPG
          xFpg: 24.2, // Expected FPG slightly lower
          projFpg: 25.1, // Strong projection
          upsideIndex: 85, // High due to rushing ability
          upsideBoost: 6.2, // Significant boost from mobility
          fpgTrend: "stable",
          explosivePlays: 12 // Including rushing TDs/big plays
        },
        format_ratings: {
          redraft: 94,
          dynasty: 96,
          half_ppr: 94,
          full_ppr: 94,
          superflex: 98
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'lamar_jackson',
        player_name: 'Lamar Jackson',
        position: 'QB',
        team: 'BAL',
        overall_rating: 0,
        positional_rank: 2,
        tier: '',
        components: {
          talent: 94,
          opportunity: 92,
          consistency: 82,
          upside: 96,
          floor: 85
        },
        fpgMetrics: {
          fpg: 26.1, // Historically elite rushing QB FPG
          xFpg: 25.8, // Expected high due to rushing floor
          projFpg: 26.4, // Strong rushing projection
          upsideIndex: 92, // Maximum rushing QB upside
          upsideBoost: 7.8, // Highest boost from rushing ability
          fpgTrend: "stable",
          explosivePlays: 15 // High explosive rushing + passing plays
        },
        format_ratings: {
          redraft: 92,
          dynasty: 94,
          half_ppr: 92,
          full_ppr: 92,
          superflex: 96
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'patrick_mahomes',
        player_name: 'Patrick Mahomes',
        position: 'QB',
        team: 'KC',
        overall_rating: 0,
        positional_rank: 3,
        tier: '',
        components: {
          talent: 95,
          opportunity: 94,
          consistency: 88,
          upside: 94,
          floor: 90
        },
        fpgMetrics: {
          fpg: 23.4, // Elite pocket passer FPG
          xFpg: 23.8, // Strong expected due to system
          projFpg: 24.1, // High projection from consistency
          upsideIndex: 72, // Lower rushing upside but ceiling potential
          upsideBoost: 4.8, // Moderate boost from arm talent
          fpgTrend: "stable",
          explosivePlays: 8 // Fewer than rushing QBs but high-quality
        },
        format_ratings: {
          redraft: 91,
          dynasty: 95,
          half_ppr: 91,
          full_ppr: 91,
          superflex: 95
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'jayden_daniels',
        player_name: 'Jayden Daniels',
        position: 'QB',
        team: 'WAS',
        overall_rating: 0,
        positional_rank: 4,
        tier: '',
        components: {
          talent: 90,
          opportunity: 88,
          consistency: 75,
          upside: 95,
          floor: 80
        },
        fpgMetrics: {
          fpg: 21.7, // Strong rookie rushing QB FPG
          xFpg: 20.9, // Expected slightly lower (rookie adjustment)
          projFpg: 22.8, // High projection due to rushing floor
          upsideIndex: 88, // Very high due to age + rushing ability
          upsideBoost: 7.2, // Strong boost from young mobile profile
          fpgTrend: "rising",
          explosivePlays: 11 // Good explosive play ability
        },
        format_ratings: {
          redraft: 88,
          dynasty: 92,
          half_ppr: 88,
          full_ppr: 88,
          superflex: 92
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      
      // YOUNG RUSHING QBs - HIGH UPSIDE EXAMPLES
      {
        player_id: 'drake_maye',
        player_name: 'Drake Maye',
        position: 'QB',
        team: 'NE',
        overall_rating: 0,
        positional_rank: 8,
        tier: '',
        components: {
          talent: 85,
          opportunity: 75,
          consistency: 65,
          upside: 92,
          floor: 70
        },
        fpgMetrics: {
          fpg: 18.4, // Developing rushing QB FPG
          xFpg: 19.8, // Higher expected due to rushing upside
          projFpg: 21.2, // Strong upside projection
          upsideIndex: 89, // Very high upside due to age + athleticism
          upsideBoost: 7.5, // Strong boost from young rushing profile
          fpgTrend: "rising",
          explosivePlays: 9 // Good rushing + arm talent combo
        },
        format_ratings: {
          redraft: 72,
          dynasty: 85,
          half_ppr: 72,
          full_ppr: 72,
          superflex: 76
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'jj_mccarthy',
        player_name: 'J.J. McCarthy',
        position: 'QB',
        team: 'MIN',
        overall_rating: 0,
        positional_rank: 12,
        tier: '',
        components: {
          talent: 78,
          opportunity: 70,
          consistency: 60,
          upside: 90,
          floor: 65
        },
        fpgMetrics: {
          fpg: 16.2, // Limited NFL sample but strong rushing floor
          xFpg: 18.5, // Higher expected from rushing ability
          projFpg: 20.1, // Strong upside projection
          upsideIndex: 86, // Very high upside due to young mobile profile
          upsideBoost: 7.8, // High boost from rushing QB profile
          fpgTrend: "rising",
          explosivePlays: 7 // Good athletic upside
        },
        format_ratings: {
          redraft: 65,
          dynasty: 82,
          half_ppr: 65,
          full_ppr: 65,
          superflex: 68
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },

      // TIER 2 - HIGH-END QB1s (A TIER)
      {
        player_id: 'jalen_hurts',
        player_name: 'Jalen Hurts',
        position: 'QB',
        team: 'PHI',
        overall_rating: 0,
        positional_rank: 5,
        tier: '',
        components: {
          talent: 85,
          opportunity: 90,
          consistency: 80,
          upside: 88,
          floor: 82
        },
        fpgMetrics: {
          fpg: 20.8, // Good rushing QB FPG
          xFpg: 20.2, // Expected solid due to rushing floor
          projFpg: 21.5, // Strong projection with rushing upside
          upsideIndex: 83, // High upside from rushing ability
          upsideBoost: 6.8, // Good boost from rushing profile
          fpgTrend: "stable",
          explosivePlays: 10 // Good rushing + passing explosiveness
        },
        format_ratings: {
          redraft: 85,
          dynasty: 87,
          half_ppr: 85,
          full_ppr: 85,
          superflex: 89
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'joe_burrow',
        player_name: 'Joe Burrow',
        position: 'QB',
        team: 'CIN',
        overall_rating: 0,
        positional_rank: 6,
        tier: '',
        components: {
          talent: 88,
          opportunity: 85,
          consistency: 85,
          upside: 90,
          floor: 85
        },
        format_ratings: {
          redraft: 84,
          dynasty: 88,
          half_ppr: 84,
          full_ppr: 84,
          superflex: 88
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'anthony_richardson',
        player_name: 'Anthony Richardson',
        position: 'QB',
        team: 'IND',
        overall_rating: 0,
        positional_rank: 7,
        tier: '',
        components: {
          talent: 82,
          opportunity: 85,
          consistency: 70,
          upside: 92,
          floor: 75
        },
        format_ratings: {
          redraft: 82,
          dynasty: 86,
          half_ppr: 82,
          full_ppr: 82,
          superflex: 86
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'cj_stroud',
        player_name: 'C.J. Stroud',
        position: 'QB',
        team: 'HOU',
        overall_rating: 0,
        positional_rank: 8,
        tier: '',
        components: {
          talent: 85,
          opportunity: 82,
          consistency: 82,
          upside: 88,
          floor: 80
        },
        format_ratings: {
          redraft: 81,
          dynasty: 85,
          half_ppr: 81,
          full_ppr: 81,
          superflex: 85
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },

      // TIER 3 - SOLID QB1s (B TIER)
      {
        player_id: 'dak_prescott',
        player_name: 'Dak Prescott',
        position: 'QB',
        team: 'DAL',
        overall_rating: 0,
        positional_rank: 9,
        tier: '',
        components: {
          talent: 78,
          opportunity: 85,
          consistency: 85,
          upside: 80,
          floor: 82
        },
        format_ratings: {
          redraft: 78,
          dynasty: 75,
          half_ppr: 78,
          full_ppr: 78,
          superflex: 82
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'tua_tagovailoa',
        player_name: 'Tua Tagovailoa',
        position: 'QB',
        team: 'MIA',
        overall_rating: 0,
        positional_rank: 10,
        tier: '',
        components: {
          talent: 80,
          opportunity: 82,
          consistency: 75,
          upside: 85,
          floor: 70
        },
        format_ratings: {
          redraft: 77,
          dynasty: 76,
          half_ppr: 77,
          full_ppr: 77,
          superflex: 81
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'jordan_love',
        player_name: 'Jordan Love',
        position: 'QB',
        team: 'GB',
        overall_rating: 0,
        positional_rank: 11,
        tier: '',
        components: {
          talent: 78,
          opportunity: 88,
          consistency: 78,
          upside: 85,
          floor: 75
        },
        format_ratings: {
          redraft: 76,
          dynasty: 78,
          half_ppr: 76,
          full_ppr: 76,
          superflex: 80
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'brock_purdy',
        player_name: 'Brock Purdy',
        position: 'QB',
        team: 'SF',
        overall_rating: 0,
        positional_rank: 12,
        tier: '',
        components: {
          talent: 75,
          opportunity: 85,
          consistency: 85,
          upside: 78,
          floor: 80
        },
        format_ratings: {
          redraft: 75,
          dynasty: 74,
          half_ppr: 75,
          full_ppr: 75,
          superflex: 79
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },

      // TIER 4 - QB2/STREAMING (C TIER)
      {
        player_id: 'kyler_murray',
        player_name: 'Kyler Murray',
        position: 'QB',
        team: 'ARI',
        overall_rating: 0,
        positional_rank: 13,
        tier: '',
        components: {
          talent: 75,
          opportunity: 78,
          consistency: 70,
          upside: 82,
          floor: 68
        },
        format_ratings: {
          redraft: 68,
          dynasty: 70,
          half_ppr: 68,
          full_ppr: 68,
          superflex: 72
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'caleb_williams',
        player_name: 'Caleb Williams',
        position: 'QB',
        team: 'CHI',
        overall_rating: 0,
        positional_rank: 14,
        tier: '',
        components: {
          talent: 78,
          opportunity: 75,
          consistency: 65,
          upside: 85,
          floor: 65
        },
        format_ratings: {
          redraft: 67,
          dynasty: 75,
          half_ppr: 67,
          full_ppr: 67,
          superflex: 71
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'drake_maye',
        player_name: 'Drake Maye',
        position: 'QB',
        team: 'NE',
        overall_rating: 0,
        positional_rank: 15,
        tier: '',
        components: {
          talent: 75,
          opportunity: 72,
          consistency: 60,
          upside: 82,
          floor: 60
        },
        format_ratings: {
          redraft: 66,
          dynasty: 72,
          half_ppr: 66,
          full_ppr: 66,
          superflex: 70
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'bo_nix',
        player_name: 'Bo Nix',
        position: 'QB',
        team: 'DEN',
        overall_rating: 0,
        positional_rank: 16,
        tier: '',
        components: {
          talent: 70,
          opportunity: 75,
          consistency: 68,
          upside: 75,
          floor: 65
        },
        format_ratings: {
          redraft: 65,
          dynasty: 68,
          half_ppr: 65,
          full_ppr: 65,
          superflex: 69
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      // Elite WRs
      {
        player_id: 'jamarr_chase',
        player_name: "Ja'Marr Chase",
        position: 'WR',
        team: 'CIN',
        overall_rating: 0,
        positional_rank: 1,
        tier: '',
        components: {
          talent: 97,
          opportunity: 90,
          consistency: 88,
          upside: 95,
          floor: 85
        },
        format_ratings: {
          redraft: 95,
          dynasty: 98,
          half_ppr: 94,
          full_ppr: 95,
          superflex: 95
        },
        age_adjusted_value: 0,
        breakout_probability: 15,
        last_updated: new Date().toISOString()
      },
      {
        player_id: 'ceedee_lamb',
        player_name: 'CeeDee Lamb',
        position: 'WR',
        team: 'DAL',
        overall_rating: 0,
        positional_rank: 2,
        tier: '',
        components: {
          talent: 94,
          opportunity: 93,
          consistency: 90,
          upside: 92,
          floor: 88
        },
        format_ratings: {
          redraft: 93,
          dynasty: 95,
          half_ppr: 92,
          full_ppr: 93,
          superflex: 93
        },
        age_adjusted_value: 0,
        last_updated: new Date().toISOString()
      },
      // Elite RBs
      {
        player_id: 'christian_mccaffrey',
        player_name: 'Christian McCaffrey',
        position: 'RB',
        team: 'SF',
        overall_rating: 0,
        positional_rank: 1,
        tier: '',
        components: {
          talent: 96,
          opportunity: 95,
          consistency: 92,
          upside: 90,
          floor: 88
        },
        format_ratings: {
          redraft: 96,
          dynasty: 88,
          half_ppr: 95,
          full_ppr: 96,
          superflex: 96
        },
        age_adjusted_value: 0,
        decline_risk: 25,
        last_updated: new Date().toISOString()
      }
    ];

    // Calculate derived values for each rating
    for (const rating of sampleRatings) {
      // Calculate base overall rating
      const baseRating = this.calculateOverallRating(rating.components, config);
      
      // Apply OTC signature bias fingerprint
      rating.overall_rating = applyOTCBias(baseRating);
      
      rating.tier = this.calculateTier(rating.overall_rating, config);
      rating.age_adjusted_value = this.applyAgeAdjustment(
        rating.overall_rating, 
        this.getPlayerAge(rating.player_id), 
        rating.position, 
        config
      );
    }

    await this.writeFile(this.RATINGS_FILE, sampleRatings);
    console.log(`✅ Generated ${sampleRatings.length} sample ratings`);
  }

  /**
   * Get player age (mock data for now)
   */
  private getPlayerAge(playerId: string): number {
    const ages: Record<string, number> = {
      // TIER 1 QBs
      'josh_allen': 28,
      'lamar_jackson': 27,
      'patrick_mahomes': 29,
      'jayden_daniels': 23,
      // TIER 2 QBs  
      'jalen_hurts': 25,
      'joe_burrow': 27,
      'anthony_richardson': 22,
      'cj_stroud': 22,
      // TIER 3 QBs
      'dak_prescott': 31,
      'tua_tagovailoa': 26,
      'jordan_love': 25,
      'brock_purdy': 24,
      // TIER 4 QBs
      'kyler_murray': 27,
      'caleb_williams': 22,
      'drake_maye': 22,
      'bo_nix': 24,
      // Other positions
      'jamarr_chase': 24,
      'ceedee_lamb': 25,
      'christian_mccaffrey': 28
    };
    return ages[playerId] || 26;
  }

  /**
   * Get all ratings
   */
  async getAllRatings(): Promise<PlayerRating[]> {
    const ratings = await this.readFile<PlayerRating[]>(this.RATINGS_FILE);
    return ratings || [];
  }

  /**
   * Get ratings by position
   */
  async getPositionRankings(position: string, format: string = 'dynasty'): Promise<PositionRankings> {
    const allRatings = await this.getAllRatings();
    const positionRatings = allRatings
      .filter(rating => rating.position === position.toUpperCase())
      .sort((a, b) => {
        const aRating = a.format_ratings[format as keyof typeof a.format_ratings];
        const bRating = b.format_ratings[format as keyof typeof b.format_ratings];
        return bRating - aRating;
      })
      .map((rating, index) => ({
        ...rating,
        positional_rank: index + 1
      }));

    return {
      position: position.toUpperCase(),
      format,
      rankings: positionRatings,
      last_updated: new Date().toISOString(),
      total_players: positionRatings.length
    };
  }

  /**
   * Get player rating by ID
   */
  async getPlayerRating(playerId: string): Promise<PlayerRating | null> {
    const allRatings = await this.getAllRatings();
    return allRatings.find(rating => rating.player_id === playerId) || null;
  }

  /**
   * Get top players across all positions
   */
  async getTopPlayers(limit: number = 100, format: string = 'dynasty'): Promise<PlayerRating[]> {
    const allRatings = await this.getAllRatings();
    
    return allRatings
      .sort((a, b) => {
        const aRating = a.format_ratings[format as keyof typeof a.format_ratings];
        const bRating = b.format_ratings[format as keyof typeof b.format_ratings];
        return bRating - aRating;
      })
      .slice(0, limit);
  }

  /**
   * Get ratings summary for health check
   */
  async getRatingsSummary(): Promise<{
    total_players: number;
    by_position: Record<string, number>;
    by_tier: Record<string, number>;
    last_updated: string;
  }> {
    const allRatings = await this.getAllRatings();
    
    const byPosition: Record<string, number> = {};
    const byTier: Record<string, number> = {};
    
    for (const rating of allRatings) {
      byPosition[rating.position] = (byPosition[rating.position] || 0) + 1;
      byTier[rating.tier] = (byTier[rating.tier] || 0) + 1;
    }

    return {
      total_players: allRatings.length,
      by_position: byPosition,
      by_tier: byTier,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Update engine configuration
   */
  async updateConfig(newConfig: Partial<RatingsEngineConfig>): Promise<void> {
    const currentConfig = await this.readFile<RatingsEngineConfig>(this.CONFIG_FILE) || this.DEFAULT_CONFIG;
    const updatedConfig = { ...currentConfig, ...newConfig };
    await this.writeFile(this.CONFIG_FILE, updatedConfig);
  }

  /**
   * Recalculate all ratings with new config
   */
  async recalculateRatings(): Promise<void> {
    console.log('🔄 Recalculating all player ratings...');
    
    const config = await this.readFile<RatingsEngineConfig>(this.CONFIG_FILE) || this.DEFAULT_CONFIG;
    const allRatings = await this.getAllRatings();
    
    for (const rating of allRatings) {
      rating.overall_rating = this.calculateOverallRating(rating.components, config);
      rating.tier = this.calculateTier(rating.overall_rating, config);
      rating.age_adjusted_value = this.applyAgeAdjustment(
        rating.overall_rating,
        this.getPlayerAge(rating.player_id),
        rating.position,
        config
      );
      rating.last_updated = new Date().toISOString();
    }
    
    await this.writeFile(this.RATINGS_FILE, allRatings);
    console.log('✅ All ratings recalculated');
  }
}

export const ratingsEngineService = new RatingsEngineService();