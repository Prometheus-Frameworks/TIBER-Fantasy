/**
 * QB Context v1 Populator
 * 
 * Computes and populates qb_context_2025 table with QB scores for each team.
 * Uses qb_role_bank + weekly_stats to determine primary QBs and calculate:
 * - qbSkillScore: QB's FORGE alpha
 * - qbStabilityScore: Games started continuity
 * - qbDurabilityScore: Inverse of missed games
 * - qbRedraftScore: Skill + current offensive metrics
 * - qbDynastyScore: Blended long-term value with age curve
 */

import { db } from '../../infra/db';
import { sql } from "drizzle-orm";
import { qbContext2025 } from '../../../shared/schema';

// QB age curve for dynasty scoring
function getAgeCurveFactor(age: number | null): number {
  if (!age) return 50;
  
  // Peak dynasty value: 24-29
  if (age >= 24 && age <= 29) return 100;
  // Still valuable: 30-32
  if (age >= 30 && age <= 32) return 85;
  // Declining: 33-35
  if (age >= 33 && age <= 35) return 65;
  // End of career: 36+
  if (age >= 36) return 40;
  // Young and developing: 22-23
  if (age >= 22 && age <= 23) return 90;
  // Very young: <22
  return 80;
}

interface QBData {
  playerId: string;
  playerName: string;
  team: string;
  season: number;
  gamesPlayed: number;
  alphaContextScore: number;
  volumeScore: number;
  efficiencyScore: number;
  epaPerPlay: number | null;
  cpoe: number | null;
}

interface QBHistoryData {
  season: number;
  gamesPlayed: number;
  alphaContextScore: number;
}

/**
 * Populate qb_context_2025 table for all teams
 */
export async function populateQbContext2025(season: number = 2025): Promise<{
  success: boolean;
  teamsProcessed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let teamsProcessed = 0;
  
  try {
    console.log(`[QBContext] Starting population for season ${season}`);
    
    // Step 1: Get all teams with their QBs from current season
    const teamsResult = await db.execute(sql`
      SELECT DISTINCT team FROM weekly_stats 
      WHERE season = ${season} AND position = 'QB' AND team IS NOT NULL
    `);
    
    const teams = teamsResult.rows.map((r: any) => r.team as string);
    console.log(`[QBContext] Found ${teams.length} teams to process`);
    
    // Clear existing data for this season
    await db.execute(sql`DELETE FROM qb_context_2025 WHERE season = ${season}`);
    
    for (const team of teams) {
      try {
        // Get all QBs for this team this season
        const qbsResult = await db.execute(sql`
          SELECT 
            q.player_id,
            q.games_played,
            q.alpha_context_score,
            q.volume_score,
            q.efficiency_score,
            q.epa_per_play,
            q.cpoe,
            cp.full_name as player_name
          FROM qb_role_bank q
          JOIN (
            SELECT DISTINCT player_id 
            FROM weekly_stats 
            WHERE team = ${team} AND season = ${season} AND position = 'QB'
          ) ws ON q.player_id = ws.player_id
          LEFT JOIN canonical_players cp ON q.player_id = cp.id
          WHERE q.season = ${season}
          ORDER BY q.games_played DESC
        `);
        
        if (qbsResult.rows.length === 0) {
          console.log(`[QBContext] No QB data for ${team}, skipping`);
          continue;
        }
        
        // Primary QB = most games played
        const primaryQb = qbsResult.rows[0] as any;
        const qbId = primaryQb.player_id;
        const qbName = primaryQb.player_name || `QB-${qbId}`;
        const gamesCurrentSeason = parseInt(primaryQb.games_played) || 0;
        const alphaScore = parseFloat(primaryQb.alpha_context_score) || 50;
        const epaPerPlay = parseFloat(primaryQb.epa_per_play) || null;
        const cpoe = parseFloat(primaryQb.cpoe) || null;
        
        // Get historical games for stability/durability
        const historyResult = await db.execute(sql`
          SELECT season, games_played, alpha_context_score
          FROM qb_role_bank
          WHERE player_id = ${qbId} AND season >= ${season - 3}
          ORDER BY season DESC
        `);
        
        const history: QBHistoryData[] = historyResult.rows.map((r: any) => ({
          season: r.season,
          gamesPlayed: parseInt(r.games_played) || 0,
          alphaContextScore: parseFloat(r.alpha_context_score) || 50,
        }));
        
        // Calculate games started over last 2-3 seasons
        const gamesStartedRecent = history.reduce((sum, h) => sum + h.gamesPlayed, 0);
        
        // Calculate QB scores
        const scores = calculateQbScores({
          qbId,
          gamesCurrentSeason,
          gamesStartedRecent,
          alphaScore,
          history,
          epaPerPlay,
          cpoe,
        });
        
        // Get QB age (placeholder - would need birth date data)
        const qbAge = await estimateQbAge(qbId);
        
        // Get team pass EPA from team_offensive_context
        const teamPassEpa = await getTeamPassEpa(team, season);
        
        // Insert into qb_context_2025
        await db.insert(qbContext2025).values({
          qbId,
          qbName,
          teamId: team,
          season,
          depthChartRank: 1,
          isPrimaryQb: true,
          qbSkillScore: scores.skillScore,
          qbRedraftScore: scores.redraftScore,
          qbDynastyScore: scores.dynastyScore,
          qbStabilityScore: scores.stabilityScore,
          qbDurabilityScore: scores.durabilityScore,
          qbAge,
          gamesStartedRecent,
          gamesStartedCurrentSeason: gamesCurrentSeason,
          epaPerPlay,
          cpoe,
          teamPassEpa,
          isActive: true,
        }).onConflictDoUpdate({
          target: [qbContext2025.qbId, qbContext2025.teamId, qbContext2025.season],
          set: {
            qbSkillScore: scores.skillScore,
            qbRedraftScore: scores.redraftScore,
            qbDynastyScore: scores.dynastyScore,
            qbStabilityScore: scores.stabilityScore,
            qbDurabilityScore: scores.durabilityScore,
            qbAge,
            gamesStartedRecent,
            gamesStartedCurrentSeason: gamesCurrentSeason,
            epaPerPlay,
            cpoe,
            teamPassEpa,
            updatedAt: sql`NOW()`,
          }
        });
        
        console.log(`[QBContext] ${team}: ${qbName} → skill=${scores.skillScore.toFixed(1)}, redraft=${scores.redraftScore.toFixed(1)}, dynasty=${scores.dynastyScore.toFixed(1)}`);
        teamsProcessed++;
        
      } catch (teamError: any) {
        errors.push(`${team}: ${teamError.message}`);
        console.error(`[QBContext] Error processing ${team}:`, teamError.message);
      }
    }
    
    console.log(`[QBContext] Complete. Processed ${teamsProcessed}/${teams.length} teams`);
    
    return { success: true, teamsProcessed, errors };
    
  } catch (error: any) {
    console.error('[QBContext] Population failed:', error);
    return { success: false, teamsProcessed, errors: [error.message] };
  }
}

interface QbScoreInput {
  qbId: string;
  gamesCurrentSeason: number;
  gamesStartedRecent: number;
  alphaScore: number;
  history: QBHistoryData[];
  epaPerPlay: number | null;
  cpoe: number | null;
}

interface QbScores {
  skillScore: number;
  stabilityScore: number;
  durabilityScore: number;
  redraftScore: number;
  dynastyScore: number;
}

function calculateQbScores(input: QbScoreInput): QbScores {
  const { gamesCurrentSeason, gamesStartedRecent, alphaScore, history, epaPerPlay, cpoe } = input;
  
  // 1. Skill Score: QB's FORGE alpha normalized to 0-100
  const skillScore = Math.min(100, Math.max(0, alphaScore));
  
  // 2. Stability Score: Based on games started continuity
  // Max stability = 40+ games over 2-3 seasons (full starter)
  // Also consider if they've been the consistent starter
  const maxGamesExpected = 17 * 2.5; // ~42 games over 2.5 seasons
  const gamesRatio = Math.min(1, gamesStartedRecent / maxGamesExpected);
  
  // Check for QB carousel (multiple QBs sharing time)
  const recentSeasonGames = history.length > 0 ? history[0].gamesPlayed : 0;
  const carouselPenalty = recentSeasonGames < 10 ? 10 : 0; // Penalty if not clear starter
  
  const stabilityScore = Math.min(100, Math.max(0, (gamesRatio * 100) - carouselPenalty));
  
  // 3. Durability Score: Inverse of missed games
  // Expected 17 games/season × 2.5 = 42.5 games
  const gamesExpected = 17 * Math.max(1, history.length);
  const gamesMissed = gamesExpected - gamesStartedRecent;
  const missedRate = gamesMissed / gamesExpected;
  
  // 0% missed = 100, 50% missed = 50, 100% missed = 0
  const durabilityScore = Math.min(100, Math.max(0, (1 - missedRate) * 100));
  
  // 4. Redraft Score: Skill + current offensive metrics
  let redraftScore = skillScore;
  
  // EPA adjustment (+/- 10 points)
  if (epaPerPlay !== null) {
    // EPA typically ranges from -0.2 (bad) to +0.3 (elite)
    const epaAdjust = Math.min(10, Math.max(-10, epaPerPlay * 30));
    redraftScore += epaAdjust;
  }
  
  // CPOE adjustment (+/- 5 points)
  if (cpoe !== null) {
    // CPOE typically ranges from -5% to +5%
    const cpoeAdjust = Math.min(5, Math.max(-5, cpoe));
    redraftScore += cpoeAdjust;
  }
  
  // Current season games penalty (injury or benching)
  if (gamesCurrentSeason < 10) {
    const injuryPenalty = (10 - gamesCurrentSeason) * 2; // -2 per missed game
    redraftScore -= injuryPenalty;
  }
  
  redraftScore = Math.min(100, Math.max(0, redraftScore));
  
  // 5. Dynasty Score: Long-term value with age curve
  // Formula: 0.5 * skill + 0.2 * stability + 0.2 * durability + 0.1 * age_curve
  
  // Use career average alpha for dynasty instead of just current
  const careerAlphas = history.map(h => h.alphaContextScore);
  const careerAvgAlpha = careerAlphas.length > 0 
    ? careerAlphas.reduce((a, b) => a + b, 0) / careerAlphas.length 
    : skillScore;
  
  // Blend current skill with career average for dynasty
  const dynastySkill = (skillScore * 0.6) + (careerAvgAlpha * 0.4);
  
  // Age curve (placeholder - would use actual age)
  const ageCurveFactor = 85; // Default to prime-ish age
  
  const dynastyScore = Math.min(100, Math.max(0,
    (0.5 * dynastySkill) +
    (0.2 * stabilityScore) +
    (0.2 * durabilityScore) +
    (0.1 * ageCurveFactor)
  ));
  
  return {
    skillScore,
    stabilityScore,
    durabilityScore,
    redraftScore,
    dynastyScore,
  };
}

async function estimateQbAge(qbId: string): Promise<number | null> {
  // Try to get age from canonical_players if available
  try {
    const result = await db.execute(sql`
      SELECT years_exp FROM canonical_players WHERE id = ${qbId}
    `);
    
    if (result.rows.length > 0) {
      const yearsExp = parseInt((result.rows[0] as any).years_exp) || 0;
      // Rough age estimate: entered league at 22 + years_exp
      return 22 + yearsExp;
    }
  } catch (e) {
    // Ignore errors, return null
  }
  
  return null;
}

async function getTeamPassEpa(team: string, season: number): Promise<number | null> {
  try {
    const result = await db.execute(sql`
      SELECT pass_epa FROM team_offensive_context 
      WHERE team = ${team} AND season = ${season}
    `);
    
    if (result.rows.length > 0) {
      return parseFloat((result.rows[0] as any).pass_epa) || null;
    }
  } catch (e) {
    // Ignore errors
  }
  
  return null;
}

/**
 * Get primary QB context for a team
 */
export async function getPrimaryQbContext(teamId: string, season: number = 2025): Promise<{
  qbId: string;
  qbName: string;
  qbRedraftScore: number;
  qbDynastyScore: number;
  qbSkillScore: number;
  qbStabilityScore: number;
  qbDurabilityScore: number;
} | null> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM qb_context_2025
      WHERE team_id = ${teamId} AND season = ${season} AND is_primary_qb = true
      LIMIT 1
    `);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0] as any;
    return {
      qbId: row.qb_id,
      qbName: row.qb_name,
      qbRedraftScore: parseFloat(row.qb_redraft_score) || 50,
      qbDynastyScore: parseFloat(row.qb_dynasty_score) || 50,
      qbSkillScore: parseFloat(row.qb_skill_score) || 50,
      qbStabilityScore: parseFloat(row.qb_stability_score) || 50,
      qbDurabilityScore: parseFloat(row.qb_durability_score) || 50,
    };
  } catch (error) {
    console.error(`[QBContext] Error getting QB context for ${teamId}:`, error);
    return null;
  }
}
