/**
 * Compass Calculation Functions
 * Implements the 4-directional compass scoring system for different positions
 * Following Flask backend methodology with TypeScript implementation
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Types for compass data structures
interface RBCompassData {
  player_metrics: any;
  population_stats: any;
  ol_rank: number;
  oc_run_rate: number;
  pos_snap_pct: number;
  neutral_script_rate: number;
  age: number;
  games_missed_2yr: number;
  fum_rate: number;
}

interface WRCompassData {
  anchor_score: number;
  context_tags: any[];
  rebuilder_score: number;
  contender_score: number;
  age: number;
}

interface CompassComponents {
  score: number;
  north: number;
  east: number;
  south: number;
  west: number;
}

// RB Compass Calculations
export function calculateRBNorthScore(playerMetrics: any, populationStats: any): number {
  // Volume/Talent calculation for RBs
  try {
    const carries = playerMetrics.carries_per_game || 0;
    const targets = playerMetrics.targets_per_game || 0;
    const rushing_yards = playerMetrics.rushing_yards_per_game || 0;
    
    // Normalize against population
    const carriesZ = populationStats.carries_per_game ? 
      (carries - populationStats.carries_per_game.mean) / populationStats.carries_per_game.std : 0;
    const targetsZ = populationStats.targets_per_game ?
      (targets - populationStats.targets_per_game.mean) / populationStats.targets_per_game.std : 0;
    
    // Weighted combination with 5.0 baseline
    const baseScore = 5.0;
    const volumeScore = baseScore + (carriesZ * 0.6) + (targetsZ * 0.4);
    
    return Math.max(1.0, Math.min(10.0, volumeScore));
  } catch (error) {
    console.warn('RB North calculation error:', error);
    return 5.0;
  }
}

export function calculateRBEastScore(
  olRank: number, 
  ocRunRate: number, 
  posSnapPct: number, 
  neutralScriptRate: number
): number {
  // Environment calculation for RBs
  try {
    const baseScore = 5.0;
    
    // O-Line rank (lower is better, normalize to 1-32)
    const olScore = olRank ? (33 - Math.max(1, Math.min(32, olRank))) / 32 * 4 : 2.0;
    
    // Run rate advantage
    const runRateScore = Math.max(0, (ocRunRate - 0.45) * 10); // Above 45% is good
    
    // Snap percentage
    const snapScore = posSnapPct ? posSnapPct * 4 : 2.0;
    
    // Neutral script (game flow)
    const scriptScore = neutralScriptRate ? neutralScriptRate * 4 : 2.0;
    
    const environmentScore = baseScore + 
      (olScore * 0.3) + 
      (runRateScore * 0.3) + 
      (snapScore * 0.2) + 
      (scriptScore * 0.2) - 2.0; // Adjust baseline
    
    return Math.max(1.0, Math.min(10.0, environmentScore));
  } catch (error) {
    console.warn('RB East calculation error:', error);
    return 5.0;
  }
}

export function calculateRBSouthScore(age: number, gamesMissed2yr: number, fumRate: number): number {
  // Risk calculation for RBs
  try {
    const baseScore = 5.0;
    
    // Age penalty (peak around 23-26)
    let ageScore = 0;
    if (age <= 23) ageScore = 3.0; // Young but unproven
    else if (age <= 26) ageScore = 4.0; // Peak years
    else if (age <= 29) ageScore = 2.0; // Declining
    else ageScore = 1.0; // High risk
    
    // Games missed penalty
    const healthScore = Math.max(0, 4.0 - (gamesMissed2yr * 0.5));
    
    // Fumble rate penalty
    const fumbleScore = fumRate ? Math.max(0, 4.0 - (fumRate * 100)) : 3.0;
    
    const riskScore = baseScore + 
      (ageScore * 0.4) + 
      (healthScore * 0.4) + 
      (fumbleScore * 0.2) - 3.0; // Adjust baseline
    
    return Math.max(1.0, Math.min(10.0, riskScore));
  } catch (error) {
    console.warn('RB South calculation error:', error);
    return 5.0;
  }
}

export function calculateRBWestScore(rawData: any): number {
  // Market Value calculation for RBs
  try {
    const baseScore = 5.0;
    
    // ADP vs projected value
    const adp = rawData.adp || 100;
    const projectedValue = rawData.projected_value || 50;
    
    // Value calculation (lower ADP with higher projection is better)
    const valueScore = projectedValue > adp ? 
      Math.min(4.0, (projectedValue - adp) / 10) : 
      Math.max(-2.0, (projectedValue - adp) / 20);
    
    const marketScore = baseScore + valueScore;
    
    return Math.max(1.0, Math.min(10.0, marketScore));
  } catch (error) {
    console.warn('RB West calculation error:', error);
    return 5.0;
  }
}

// WR Compass Calculations
export function calculateWRNorthScore(anchorScore: number): number {
  // Volume/Talent calculation for WRs
  try {
    // Anchor score already represents talent/volume composite
    const baseScore = 5.0;
    const normalizedAnchor = anchorScore || 5.0;
    
    // Convert anchor score to compass scale
    const volumeScore = Math.max(1.0, Math.min(10.0, normalizedAnchor));
    
    return volumeScore;
  } catch (error) {
    console.warn('WR North calculation error:', error);
    return 5.0;
  }
}

export function calculateWREastScore(contextTags: any[]): number {
  // Environment calculation for WRs
  try {
    const baseScore = 5.0;
    
    if (!contextTags || !Array.isArray(contextTags)) {
      return baseScore;
    }
    
    // Analyze context tags for environment factors
    let environmentBonus = 0;
    
    contextTags.forEach(tag => {
      const tagLower = String(tag).toLowerCase();
      
      // Positive environment indicators
      if (tagLower.includes('target_hog') || tagLower.includes('alpha')) {
        environmentBonus += 1.0;
      }
      if (tagLower.includes('red_zone') || tagLower.includes('touchdown')) {
        environmentBonus += 0.5;
      }
      if (tagLower.includes('deep') || tagLower.includes('big_play')) {
        environmentBonus += 0.5;
      }
      
      // Negative environment indicators
      if (tagLower.includes('crowded') || tagLower.includes('committee')) {
        environmentBonus -= 1.0;
      }
      if (tagLower.includes('inconsistent') || tagLower.includes('volatile')) {
        environmentBonus -= 0.5;
      }
    });
    
    const environmentScore = baseScore + Math.max(-3.0, Math.min(3.0, environmentBonus));
    
    return Math.max(1.0, Math.min(10.0, environmentScore));
  } catch (error) {
    console.warn('WR East calculation error:', error);
    return 5.0;
  }
}

export function calculateWRSouthScore(rebuilderScore: number, contenderScore: number, age: number): number {
  // Risk calculation for WRs
  try {
    const baseScore = 5.0;
    
    // Age factor for WRs (peak around 24-28)
    let ageScore = 0;
    if (age <= 24) ageScore = 3.5; // Young, room to grow
    else if (age <= 28) ageScore = 4.0; // Peak years
    else if (age <= 31) ageScore = 2.5; // Declining
    else ageScore = 1.5; // High risk
    
    // Rebuilder vs Contender context
    const contextScore = (rebuilderScore + contenderScore) / 2 || 3.0;
    
    const riskScore = baseScore + 
      (ageScore * 0.6) + 
      (contextScore * 0.4) - 3.0; // Adjust baseline
    
    return Math.max(1.0, Math.min(10.0, riskScore));
  } catch (error) {
    console.warn('WR South calculation error:', error);
    return 5.0;
  }
}

export function calculateWRWestScore(rawData: any): number {
  // Market Value calculation for WRs
  try {
    const baseScore = 5.0;
    
    // Similar to RB but WR-specific factors
    const adp = rawData.adp || 100;
    const projectedValue = rawData.projected_value || 50;
    const dynastyValue = rawData.dynasty_value || 50;
    
    // Value calculation with dynasty weighting
    const valueScore = (projectedValue + dynastyValue) / 2 > adp ? 
      Math.min(4.0, ((projectedValue + dynastyValue) / 2 - adp) / 15) : 
      Math.max(-2.0, ((projectedValue + dynastyValue) / 2 - adp) / 25);
    
    const marketScore = baseScore + valueScore;
    
    return Math.max(1.0, Math.min(10.0, marketScore));
  } catch (error) {
    console.warn('WR West calculation error:', error);
    return 5.0;
  }
}

// Main computation function following Flask pattern
export function computeComponents(rawData: any, position: string): CompassComponents {
  let north: number, east: number, south: number, west: number;
  
  try {
    if (position === 'rb') {
      north = calculateRBNorthScore(rawData.player_metrics, rawData.population_stats);
      east = calculateRBEastScore(rawData.ol_rank, rawData.oc_run_rate, rawData.pos_snap_pct, rawData.neutral_script_rate);
      south = calculateRBSouthScore(rawData.age, rawData.games_missed_2yr, rawData.fum_rate);
      west = calculateRBWestScore(rawData);
    } else if (position === 'wr') {
      north = calculateWRNorthScore(rawData.anchor_score);
      east = calculateWREastScore(rawData.context_tags);
      south = calculateWRSouthScore(rawData.rebuilder_score, rawData.contender_score, rawData.age);
      west = calculateWRWestScore(rawData);
    } else {
      throw new Error(`Invalid position: ${position}`);
    }
    
    // Calculate final score with equal 25% weighting
    const score = (north * 0.25) + (east * 0.25) + (south * 0.25) + (west * 0.25);
    const clampedScore = Math.max(1.0, Math.min(10.0, score));
    
    return {
      score: clampedScore,
      north,
      east,
      south,
      west
    };
    
  } catch (error) {
    console.error(`Compass calculation error for ${position}:`, error);
    
    // Return neutral scores on error
    return {
      score: 5.0,
      north: 5.0,
      east: 5.0,
      south: 5.0,
      west: 5.0
    };
  }
}

// Enhanced WR calculation with team context and draft capital
export function calculateEnhancedWRCompass(player: any, teamContext?: any, draftCapital?: any): CompassComponents {
  try {
    // Enhanced North score (Volume/Talent) with draft capital
    let north = calculateWRNorthScore(player.anchor_score || 70);
    if (draftCapital && draftCapital.round <= 2) {
      north += 1.0; // Boost for high draft capital
    }
    
    // Enhanced East score (Environment) with team context
    let east = calculateWREastScore(player.context_tags);
    if (teamContext) {
      const passVolumeBonus = (teamContext.passAttempts - 500) / 100; // Scale pass volume
      east += Math.max(-1.0, Math.min(2.0, passVolumeBonus));
    }
    
    // Standard South/West calculations
    const south = calculateWRSouthScore(player.rebuilder_score, player.contender_score, player.age);
    const west = calculateWRWestScore(player);
    
    // Calculate final score with equal weighting
    const score = (north * 0.25) + (east * 0.25) + (south * 0.25) + (west * 0.25);
    
    return {
      score: Math.max(1.0, Math.min(10.0, score)),
      north: Math.max(1.0, Math.min(10.0, north)),
      east: Math.max(1.0, Math.min(10.0, east)),
      south,
      west
    };
  } catch (error) {
    console.warn('Enhanced WR compass calculation error:', error);
    return computeComponents(player, 'wr');
  }
}

// Helper function to get compass data via Python backend
export async function getCompassDataFromPython(playerName: string, position: string): Promise<any> {
  try {
    let pythonScript: string;
    
    if (position === 'rb') {
      pythonScript = `
import sys
sys.path.append('.')
from tiber_core_logic import tiber
import json

try:
    data = tiber.get_rb_compass_data("${playerName}")
    print(json.dumps(data))
except Exception as e:
    print(json.dumps({"error": str(e)}))
      `;
    } else if (position === 'wr') {
      pythonScript = `
import sys
sys.path.append('.')
from tiber_core_logic import tiber
import json

try:
    data = tiber.get_wr_compass_data("${playerName}")
    print(json.dumps(data))
except Exception as e:
    print(json.dumps({"error": str(e)}))
      `;
    } else {
      throw new Error(`Position ${position} not supported`);
    }
    
    const { stdout } = await execAsync(`python -c "${pythonScript}"`);
    return JSON.parse(stdout.trim());
    
  } catch (error) {
    console.warn(`Failed to get Python compass data for ${playerName}:`, error);
    throw error;
  }
}