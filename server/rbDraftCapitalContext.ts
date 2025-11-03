import { db } from './infra/db';
import { players } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface RBDraftCapitalContext {
  playerId: string;
  playerName: string;
  draftRound: number;
  draftTier: 'PremiumBack' | 'StrongBack' | 'RiskBack' | 'FragileBack';
  currentStartingRole: boolean;
  twoTop24Seasons: boolean;
  noTop3RBThreat: boolean;
  contextOverride: boolean;
  contextOverrideTag?: 'LeadBack' | 'ProvenAsset';
  displayTag: string;
  // New production threshold results
  productionThresholds?: ProductionThresholds;
  draftCapitalPenaltySupressed?: boolean;
}

export interface RBDraftCapitalInput {
  playerId: string;
  playerName: string;
  draftRound: number;
  currentStartingRole: boolean;
  twoTop24Seasons: boolean;
  noTop3RBThreat: boolean;
  // New production threshold data
  seasons?: Array<{
    year: number;
    positionalRank: number;
    rushingYards: number;
    receivingYards: number;
    totalTouches: number;
    gamesPlayed: number;
  }>;
}

export interface ProductionThresholds {
  hasTopTierSeason: boolean;     // 1x Top-12 positional finish
  hasMultipleRB2Seasons: boolean; // 2x Top-24 positional finishes
  has1000YardSeason: boolean;    // 1,000+ yards from scrimmage
  hasWorkloadIncrease: boolean;  // Year-over-year workload increase
}

export class RBDraftCapitalService {
  
  /**
   * Step 1: Baseline Tagging - Assign draft tier based on draft round
   */
  private getDraftTier(draftRound: number): 'PremiumBack' | 'StrongBack' | 'RiskBack' | 'FragileBack' {
    if (draftRound === 1) return 'PremiumBack';
    if (draftRound === 2) return 'StrongBack';
    if (draftRound === 3) return 'RiskBack';
    return 'FragileBack'; // Day 3 (rounds 4-7)
  }

  /**
   * Step 2: Production Threshold Check - Evaluate production thresholds
   */
  private evaluateProductionThresholds(seasons?: Array<{
    year: number;
    positionalRank: number;
    rushingYards: number;
    receivingYards: number;
    totalTouches: number;
    gamesPlayed: number;
  }>): ProductionThresholds {
    if (!seasons || seasons.length === 0) {
      return {
        hasTopTierSeason: false,
        hasMultipleRB2Seasons: false,
        has1000YardSeason: false,
        hasWorkloadIncrease: false
      };
    }

    // Check for Top-12 positional finish (RB1)
    const hasTopTierSeason = seasons.some(season => season.positionalRank <= 12);
    
    // Check for 2x Top-24 positional finishes (RB2)
    const rb2Seasons = seasons.filter(season => season.positionalRank <= 24);
    const hasMultipleRB2Seasons = rb2Seasons.length >= 2;
    
    // Check for 1,000+ yards from scrimmage in any season
    const has1000YardSeason = seasons.some(season => 
      (season.rushingYards + season.receivingYards) >= 1000
    );
    
    // Check for year-over-year workload increase
    let hasWorkloadIncrease = false;
    if (seasons.length >= 2) {
      const sortedSeasons = [...seasons].sort((a, b) => a.year - b.year);
      for (let i = 1; i < sortedSeasons.length; i++) {
        const currentYear = sortedSeasons[i];
        const previousYear = sortedSeasons[i - 1];
        if (currentYear.totalTouches > previousYear.totalTouches) {
          hasWorkloadIncrease = true;
          break;
        }
      }
    }

    return {
      hasTopTierSeason,
      hasMultipleRB2Seasons,
      has1000YardSeason,
      hasWorkloadIncrease
    };
  }

  /**
   * Step 2 Updated: Context Override Trigger - Check for proven asset status
   */
  private checkContextOverride(
    currentStartingRole: boolean,
    twoTop24Seasons: boolean,
    noTop3RBThreat: boolean,
    productionThresholds?: ProductionThresholds
  ): { override: boolean; tag: 'LeadBack' | 'ProvenAsset' | undefined } {
    // Original LeadBack override logic
    const originalOverride = currentStartingRole && twoTop24Seasons && noTop3RBThreat;
    
    // New ProvenAsset override logic
    const provenAssetOverride = productionThresholds && (
      productionThresholds.hasTopTierSeason ||
      productionThresholds.hasMultipleRB2Seasons ||
      productionThresholds.has1000YardSeason ||
      productionThresholds.hasWorkloadIncrease
    );

    if (originalOverride) {
      return { override: true, tag: 'LeadBack' };
    }
    
    if (provenAssetOverride) {
      return { override: true, tag: 'ProvenAsset' };
    }

    return { override: false, tag: undefined };
  }

  /**
   * Step 3: Generate display tag for player profiles
   */
  private generateDisplayTag(
    draftTier: string,
    draftRound: number,
    contextOverride: boolean,
    contextOverrideTag?: 'LeadBack' | 'ProvenAsset'
  ): string {
    const originTag = draftRound <= 3 
      ? `${draftTier} (Round ${draftRound} Origin)`
      : `${draftTier} (Day 3 Origin)`;
    
    if (contextOverride && contextOverrideTag) {
      return `${originTag} + Context Override: ${contextOverrideTag}`;
    }
    
    return originTag;
  }

  /**
   * Main evaluation method - processes RB draft capital context
   */
  async evaluateRBDraftCapitalContext(input: RBDraftCapitalInput): Promise<RBDraftCapitalContext> {
    const {
      playerId,
      playerName,
      draftRound,
      currentStartingRole,
      twoTop24Seasons,
      noTop3RBThreat,
      seasons
    } = input;

    // Step 1: Baseline Tagging
    const draftTier = this.getDraftTier(draftRound);

    // Step 2: Production Threshold Check
    const productionThresholds = this.evaluateProductionThresholds(seasons);

    // Step 2 Updated: Context Override Trigger
    const contextOverrideResult = this.checkContextOverride(
      currentStartingRole,
      twoTop24Seasons,
      noTop3RBThreat,
      productionThresholds
    );

    // Step 3: Generate display tag
    const displayTag = this.generateDisplayTag(
      draftTier, 
      draftRound, 
      contextOverrideResult.override,
      contextOverrideResult.tag
    );

    // Step 4: Value Adjustment - Check if draft capital penalty should be suppressed
    const draftCapitalPenaltySupressed = contextOverrideResult.override;

    const result: RBDraftCapitalContext = {
      playerId,
      playerName,
      draftRound,
      draftTier,
      currentStartingRole,
      twoTop24Seasons,
      noTop3RBThreat,
      contextOverride: contextOverrideResult.override,
      contextOverrideTag: contextOverrideResult.tag,
      displayTag,
      productionThresholds,
      draftCapitalPenaltySupressed
    };

    console.log(`[RB Draft Capital Context] ${playerName}: ${displayTag}`);
    if (draftCapitalPenaltySupressed) {
      console.log(`[Draft Capital Penalty Suppressed] ${playerName}: Proven Production Threshold Met`);
    }
    
    return result;
  }

  /**
   * Apply context override to projection weighting
   */
  applyContextOverrideToProjections(
    baseProjection: any,
    contextResult: RBDraftCapitalContext
  ): any {
    if (!contextResult.contextOverride) {
      return baseProjection;
    }

    // Disable draft capital penalty for context override players
    const adjustedProjection = {
      ...baseProjection,
      draftCapitalPenalty: 0,
      workloadStability: 'stable', // Project as stable RB1/2
      contextOverrideApplied: true,
      contextOverrideReason: contextResult.contextOverrideTag === 'ProvenAsset' 
        ? 'Draft capital penalty suppressed: Proven Production Threshold Met'
        : 'LeadBack status earned through performance'
    };

    console.log(`[Context Override Applied] ${contextResult.playerName}: Draft capital penalty disabled`);
    
    return adjustedProjection;
  }

  /**
   * Batch process multiple RBs
   */
  async batchEvaluateRBs(inputs: RBDraftCapitalInput[]): Promise<RBDraftCapitalContext[]> {
    const results: RBDraftCapitalContext[] = [];
    
    for (const input of inputs) {
      const result = await this.evaluateRBDraftCapitalContext(input);
      results.push(result);
    }

    // Log summary
    const overrideCount = results.filter(r => r.contextOverride).length;
    console.log(`[RB Draft Capital Context] Processed ${results.length} RBs, ${overrideCount} context overrides applied`);
    
    return results;
  }
}

// Export singleton instance
export const rbDraftCapitalService = new RBDraftCapitalService();