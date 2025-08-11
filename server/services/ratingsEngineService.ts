/**
 * Ratings Engine v1 Service
 * Centralized player rating and ranking system
 */

import fs from 'fs/promises';
import path from 'path';

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
   * Generate sample ratings for development
   */
  async generateSampleRatings(): Promise<void> {
    console.log('🎯 Generating sample player ratings...');
    
    const config = await this.readFile<RatingsEngineConfig>(this.CONFIG_FILE) || this.DEFAULT_CONFIG;
    
    const sampleRatings: PlayerRating[] = [
      // Elite QBs
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
      rating.overall_rating = this.calculateOverallRating(rating.components, config);
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
      'josh_allen': 28,
      'lamar_jackson': 27,
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