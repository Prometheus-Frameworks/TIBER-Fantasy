/**
 * Sleeper Identity Sync Service
 * 
 * Syncs Sleeper player IDs to the player_identity_map table
 * using tiered matching with confidence scoring
 */

import { db } from '../db';
import { playerIdentityMap } from '@shared/schema';
import { eq, or, and, ilike, sql } from 'drizzle-orm';
import { sleeperSyncService, type SleeperPlayer } from './sleeperSyncService';
import { playerIdentityService } from './PlayerIdentityService';

interface MatchResult {
  sleeperId: string;
  sleeperName: string;
  canonicalId: string;
  identityName: string;
  matchMethod: 'exact_name_pos_team' | 'exact_name_pos' | 'fuzzy_name_pos' | 'manual_review';
  confidence: number;
  position: string;
  team?: string;
}

interface SyncReport {
  totalSleeperPlayers: number;
  highConfidenceMatches: number;
  mediumConfidenceMatches: number;
  lowConfidenceMatches: number;
  unmatchedPlayers: number;
  alreadyMapped: number;
  newlyMapped: number;
  matchDetails: MatchResult[];
  unmatchedDetails: Array<{
    sleeperId: string;
    name: string;
    position: string;
    team: string;
  }>;
}

export class SleeperIdentitySync {
  private static instance: SleeperIdentitySync;

  public static getInstance(): SleeperIdentitySync {
    if (!SleeperIdentitySync.instance) {
      SleeperIdentitySync.instance = new SleeperIdentitySync();
    }
    return SleeperIdentitySync.instance;
  }

  /**
   * Normalize name for matching
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' '); // Normalize spaces
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate fuzzy match confidence
   */
  private fuzzyMatchConfidence(name1: string, name2: string): number {
    const normalized1 = this.normalizeName(name1);
    const normalized2 = this.normalizeName(name2);
    
    if (normalized1 === normalized2) return 1.0;
    
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const similarity = 1 - (distance / maxLength);
    
    return Math.max(0, similarity);
  }

  /**
   * Normalize position for matching
   */
  private normalizePosition(position: string): string {
    const pos = position?.toUpperCase() || '';
    
    // Handle multi-position formats
    if (pos.includes('RB')) return 'RB';
    if (pos.includes('WR')) return 'WR';
    if (pos.includes('TE')) return 'TE';
    if (pos.includes('QB')) return 'QB';
    
    return pos;
  }

  /**
   * Normalize team abbreviation
   */
  private normalizeTeam(team: string | null): string | null {
    if (!team) return null;
    const normalized = team.toUpperCase();
    
    // Team abbreviation mappings
    const teamMappings: Record<string, string> = {
      'LA': 'LAR',  // Rams
      'JAC': 'JAX', // Jaguars
      'WSH': 'WAS', // Commanders
    };
    
    return teamMappings[normalized] || normalized;
  }

  /**
   * Find matching identity player for a Sleeper player
   */
  private async findMatch(sleeperPlayer: SleeperPlayer): Promise<MatchResult | null> {
    const sleeperPos = this.normalizePosition(sleeperPlayer.position);
    const sleeperTeam = this.normalizeTeam(sleeperPlayer.team);
    const sleeperName = this.normalizeName(sleeperPlayer.full_name);

    // Get all identity players for matching
    const identityPlayers = await db
      .select()
      .from(playerIdentityMap)
      .where(
        or(
          ilike(playerIdentityMap.fullName, `%${sleeperPlayer.last_name}%`),
          ilike(playerIdentityMap.fullName, sleeperPlayer.full_name)
        )
      );

    if (identityPlayers.length === 0) return null;

    let bestMatch: MatchResult | null = null;
    let bestConfidence = 0;

    for (const identityPlayer of identityPlayers) {
      const identityPos = this.normalizePosition(identityPlayer.position || '');
      const identityTeam = this.normalizeTeam(identityPlayer.nflTeam);
      const identityName = this.normalizeName(identityPlayer.fullName);

      // Skip if positions don't match
      if (identityPos !== sleeperPos) continue;

      // Tier 1: Exact name + position + team match (0.98 confidence)
      if (identityName === sleeperName && identityTeam === sleeperTeam) {
        return {
          sleeperId: sleeperPlayer.player_id,
          sleeperName: sleeperPlayer.full_name,
          canonicalId: identityPlayer.canonicalId,
          identityName: identityPlayer.fullName,
          matchMethod: 'exact_name_pos_team',
          confidence: 0.98,
          position: sleeperPos,
          team: sleeperTeam || undefined
        };
      }

      // Tier 2: Exact name + position match (0.90 confidence)
      if (identityName === sleeperName) {
        if (bestConfidence < 0.90) {
          bestMatch = {
            sleeperId: sleeperPlayer.player_id,
            sleeperName: sleeperPlayer.full_name,
            canonicalId: identityPlayer.canonicalId,
            identityName: identityPlayer.fullName,
            matchMethod: 'exact_name_pos',
            confidence: 0.90,
            position: sleeperPos,
            team: sleeperTeam || undefined
          };
          bestConfidence = 0.90;
        }
      }

      // Tier 3: Fuzzy name match (0.70-0.85 confidence)
      const nameSimilarity = this.fuzzyMatchConfidence(sleeperPlayer.full_name, identityPlayer.fullName);
      if (nameSimilarity >= 0.85 && nameSimilarity > bestConfidence) {
        const fuzzyConfidence = Math.min(0.85, nameSimilarity);
        bestMatch = {
          sleeperId: sleeperPlayer.player_id,
          sleeperName: sleeperPlayer.full_name,
          canonicalId: identityPlayer.canonicalId,
          identityName: identityPlayer.fullName,
          matchMethod: 'fuzzy_name_pos',
          confidence: fuzzyConfidence,
          position: sleeperPos,
          team: sleeperTeam || undefined
        };
        bestConfidence = fuzzyConfidence;
      }
    }

    return bestMatch;
  }

  /**
   * Run the sync process
   */
  async syncSleeperIdentities(dryRun: boolean = false, minConfidence: number = 0.90): Promise<SyncReport> {
    console.log(`🔄 [SleeperIdentitySync] Starting sync (dryRun: ${dryRun}, minConfidence: ${minConfidence})`);

    // Get all Sleeper players
    const sleeperPlayers = await sleeperSyncService.getPlayers();
    console.log(`📊 [SleeperIdentitySync] Loaded ${sleeperPlayers.length} Sleeper players`);

    // Filter to skill positions only
    const skillPlayers = sleeperPlayers.filter((p: SleeperPlayer) => 
      ['QB', 'RB', 'WR', 'TE'].includes(this.normalizePosition(p.position))
    );
    console.log(`🎯 [SleeperIdentitySync] ${skillPlayers.length} skill position players (QB/RB/WR/TE)`);

    // Check which players already have Sleeper IDs
    const alreadyMapped = await db
      .select()
      .from(playerIdentityMap)
      .where(sql`${playerIdentityMap.sleeperId} IS NOT NULL`);
    
    const alreadyMappedSet = new Set(alreadyMapped.map(p => p.sleeperId));
    console.log(`✅ [SleeperIdentitySync] ${alreadyMappedSet.size} players already have Sleeper IDs`);

    // Filter out already mapped players
    const unmappedPlayers = skillPlayers.filter((p: SleeperPlayer) => !alreadyMappedSet.has(p.player_id));
    console.log(`🔍 [SleeperIdentitySync] ${unmappedPlayers.length} unmapped players to process`);

    const matches: MatchResult[] = [];
    const unmatched: Array<{ sleeperId: string; name: string; position: string; team: string }> = [];
    let newlyMapped = 0;

    // Process each unmapped player
    for (const sleeperPlayer of unmappedPlayers) {
      const match = await this.findMatch(sleeperPlayer);

      if (match && match.confidence >= minConfidence) {
        matches.push(match);

        // Update identity map if not dry run
        if (!dryRun) {
          const updated = await playerIdentityService.addIdentityMapping({
            canonicalId: match.canonicalId,
            externalId: match.sleeperId,
            platform: 'sleeper',
            confidence: match.confidence,
            overwrite: false
          });

          if (updated) {
            newlyMapped++;
            console.log(`✓ Mapped ${match.sleeperName} → ${match.identityName} (${match.confidence.toFixed(2)})`);
          }
        }
      } else if (match && match.confidence < minConfidence) {
        // Low confidence - add to manual review queue
        matches.push({ ...match, matchMethod: 'manual_review' });
      } else {
        unmatched.push({
          sleeperId: sleeperPlayer.player_id,
          name: sleeperPlayer.full_name,
          position: this.normalizePosition(sleeperPlayer.position),
          team: sleeperPlayer.team || 'FA'
        });
      }
    }

    // Generate report
    const report: SyncReport = {
      totalSleeperPlayers: skillPlayers.length,
      highConfidenceMatches: matches.filter(m => m.confidence >= 0.90).length,
      mediumConfidenceMatches: matches.filter(m => m.confidence >= 0.70 && m.confidence < 0.90).length,
      lowConfidenceMatches: matches.filter(m => m.confidence < 0.70).length,
      unmatchedPlayers: unmatched.length,
      alreadyMapped: alreadyMappedSet.size,
      newlyMapped: newlyMapped,
      matchDetails: matches,
      unmatchedDetails: unmatched
    };

    console.log(`\n📋 [SleeperIdentitySync] Sync Report:`);
    console.log(`   Total Sleeper Players: ${report.totalSleeperPlayers}`);
    console.log(`   Already Mapped: ${report.alreadyMapped}`);
    console.log(`   High Confidence Matches (≥0.90): ${report.highConfidenceMatches}`);
    console.log(`   Medium Confidence Matches (0.70-0.90): ${report.mediumConfidenceMatches}`);
    console.log(`   Low Confidence Matches (<0.70): ${report.lowConfidenceMatches}`);
    console.log(`   Unmatched: ${report.unmatchedPlayers}`);
    console.log(`   Newly Mapped: ${report.newlyMapped}\n`);

    return report;
  }

  /**
   * Get detailed match report for review
   */
  async getMatchReport(minConfidence: number = 0.90): Promise<SyncReport> {
    return this.syncSleeperIdentities(true, minConfidence);
  }
}

export const sleeperIdentitySync = SleeperIdentitySync.getInstance();
