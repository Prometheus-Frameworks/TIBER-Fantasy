import { db } from './db';
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
  contextOverrideTag?: 'LeadBack';
  displayTag: string;
}

export interface RBDraftCapitalInput {
  playerId: string;
  playerName: string;
  draftRound: number;
  currentStartingRole: boolean;
  twoTop24Seasons: boolean;
  noTop3RBThreat: boolean;
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
   * Step 2: Context Override Trigger - Check if RB qualifies for context override
   */
  private checkContextOverride(
    currentStartingRole: boolean,
    twoTop24Seasons: boolean,
    noTop3RBThreat: boolean
  ): boolean {
    return currentStartingRole && twoTop24Seasons && noTop3RBThreat;
  }

  /**
   * Step 3: Generate display tag for player profiles
   */
  private generateDisplayTag(
    draftTier: string,
    draftRound: number,
    contextOverride: boolean
  ): string {
    const originTag = draftRound <= 3 
      ? `${draftTier} (Round ${draftRound} Origin)`
      : `${draftTier} (Day 3 Origin)`;
    
    if (contextOverride) {
      return `${originTag} + Context Override: LeadBack`;
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
      noTop3RBThreat
    } = input;

    // Step 1: Baseline Tagging
    const draftTier = this.getDraftTier(draftRound);

    // Step 2: Context Override Trigger
    const contextOverride = this.checkContextOverride(
      currentStartingRole,
      twoTop24Seasons,
      noTop3RBThreat
    );

    // Step 3: Generate display tag
    const displayTag = this.generateDisplayTag(draftTier, draftRound, contextOverride);

    const result: RBDraftCapitalContext = {
      playerId,
      playerName,
      draftRound,
      draftTier,
      currentStartingRole,
      twoTop24Seasons,
      noTop3RBThreat,
      contextOverride,
      contextOverrideTag: contextOverride ? 'LeadBack' : undefined,
      displayTag
    };

    console.log(`[RB Draft Capital Context] ${playerName}: ${displayTag}`);
    
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
      contextOverrideReason: 'LeadBack status earned through performance'
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