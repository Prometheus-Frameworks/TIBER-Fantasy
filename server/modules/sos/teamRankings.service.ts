import { db } from '../../db';
import { teamDefensiveContext, teamOffensiveContext, teamCoverageMatchups, teamReceiverAlignmentMatchups, schedule } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface DefenseRanking {
  team: string;
  rank: number;
  score: number; // 0-100, lower = better defense
  passDefScore: number;
  rushDefScore: number;
  pressureScore: number;
}

export interface OffenseRanking {
  team: string;
  rank: number;
  score: number; // 0-100, higher = better offense
  passOffScore: number;
  rushOffScore: number;
}

export interface Week5SOS {
  team: string;
  opponent: string;
  sos_score: number; // 0-100, higher = easier matchup
  tier: 'green' | 'yellow' | 'red';
  defensiveRank: number;
  offensiveRank: number;
}

/**
 * Rank all defenses using Week 4 data from screenshots
 * Lower score = better defense (harder matchup for offense)
 */
export async function rankDefenses(season: number, week: number): Promise<DefenseRanking[]> {
  // Get defensive context data
  const defData = await db
    .select()
    .from(teamDefensiveContext)
    .where(and(
      eq(teamDefensiveContext.season, season),
      eq(teamDefensiveContext.week, week)
    ));

  if (!defData.length) return [];

  // Extract defensive metrics
  const teams = defData.map(d => ({
    team: d.team,
    passEpaAllowed: d.passEpaAllowed ?? 0,
    rushEpaAllowed: d.rushEpaAllowed ?? 0,
    pressureRate: d.pressureRateGenerated ?? 0,
  }));

  // Rank each metric (lower EPA allowed = better defense)
  const passRanks = rankMetric(teams.map(t => t.passEpaAllowed), true); // true = lower is better
  const rushRanks = rankMetric(teams.map(t => t.rushEpaAllowed), true);
  const pressureRanks = rankMetric(teams.map(t => t.pressureRate), false); // higher pressure = better

  // Combine scores with weights
  const rankings = teams.map((t, i) => ({
    team: t.team,
    passDefScore: passRanks[i],
    rushDefScore: rushRanks[i],
    pressureScore: pressureRanks[i],
    score: passRanks[i] * 0.5 + rushRanks[i] * 0.3 + pressureRanks[i] * 0.2
  }));

  // Sort by score (lower = better defense)
  rankings.sort((a, b) => a.score - b.score);

  // Assign ranks
  return rankings.map((r, i) => ({
    ...r,
    rank: i + 1
  }));
}

/**
 * Rank all offenses using Week 4 data
 * Higher score = better offense (generates more points)
 */
export async function rankOffenses(season: number, week: number): Promise<OffenseRanking[]> {
  const offData = await db
    .select()
    .from(teamOffensiveContext)
    .where(and(
      eq(teamOffensiveContext.season, season),
      eq(teamOffensiveContext.week, week)
    ));

  if (!offData.length) return [];

  const teams = offData.map(d => ({
    team: d.team,
    passEpa: d.passEpa ?? 0,
    rushEpa: d.rushEpa ?? 0,
  }));

  // Rank metrics (higher EPA = better offense)
  const passRanks = rankMetric(teams.map(t => t.passEpa), false); // false = higher is better
  const rushRanks = rankMetric(teams.map(t => t.rushEpa), false);

  // Combine scores
  const rankings = teams.map((t, i) => ({
    team: t.team,
    passOffScore: passRanks[i],
    rushOffScore: rushRanks[i],
    score: passRanks[i] * 0.6 + rushRanks[i] * 0.4 // Pass-heavier weighting
  }));

  // Sort by score (higher = better offense)
  rankings.sort((a, b) => b.score - a.score);

  return rankings.map((r, i) => ({
    ...r,
    rank: i + 1
  }));
}

/**
 * Generate Week 5 SOS using Week 4 rankings
 */
export async function generateWeek5SOS(position: string, season: number): Promise<Week5SOS[]> {
  // Get Week 4 rankings
  const defRankings = await rankDefenses(season, 4);
  const offRankings = await rankOffenses(season, 4);

  // Get Week 5 schedule
  const week5Games = await db
    .select()
    .from(schedule)
    .where(and(
      eq(schedule.season, season),
      eq(schedule.week, 5)
    ));

  if (!week5Games.length || !defRankings.length) return [];

  // Create lookup maps
  const defMap = new Map(defRankings.map(d => [d.team, d]));
  const offMap = new Map(offRankings.map(o => [o.team, o]));

  const results: Week5SOS[] = [];

  // For each game, calculate SOS for both teams
  for (const game of week5Games) {
    // Home team's matchup (playing away defense)
    const awayDef = defMap.get(game.away);
    if (awayDef) {
      // Invert defense score: low defense score = hard matchup, so invert to make high score = easy matchup
      const sosScore = 100 - awayDef.score;
      results.push({
        team: game.home,
        opponent: game.away,
        sos_score: Math.round(sosScore),
        tier: getTier(sosScore),
        defensiveRank: awayDef.rank,
        offensiveRank: offMap.get(game.home)?.rank ?? 0
      });
    }

    // Away team's matchup (playing home defense)
    const homeDef = defMap.get(game.home);
    if (homeDef) {
      const sosScore = 100 - homeDef.score;
      results.push({
        team: game.away,
        opponent: game.home,
        sos_score: Math.round(sosScore),
        tier: getTier(sosScore),
        defensiveRank: homeDef.rank,
        offensiveRank: offMap.get(game.away)?.rank ?? 0
      });
    }
  }

  return results.sort((a, b) => b.sos_score - a.sos_score);
}

/** Helper: Rank a metric array and return percentile scores (0-100) */
function rankMetric(values: number[], lowerIsBetter: boolean): number[] {
  const indexed = values.map((v, i) => ({ value: v, index: i }));
  indexed.sort((a, b) => lowerIsBetter ? a.value - b.value : b.value - a.value);
  
  const scores = new Array(values.length);
  indexed.forEach((item, rank) => {
    if (lowerIsBetter) {
      // For defense: 0 = best (allows fewest), 100 = worst (allows most)
      scores[item.index] = (rank / (values.length - 1)) * 100;
    } else {
      // For offense: 100 = best (generates most), 0 = worst (generates least)
      scores[item.index] = 100 - (rank / (values.length - 1)) * 100;
    }
  });
  
  return scores;
}

function getTier(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 67) return 'green';
  if (score >= 33) return 'yellow';
  return 'red';
}
