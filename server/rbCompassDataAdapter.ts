/**
 * RB Compass Data Adapter
 * Transforms our existing RB game logs and projections into Player Compass format
 */

import { RBPlayerData, RBPlayerMetrics, PopulationStats } from './rbPlayerCompass';

interface RBGameLog {
  week: number;
  opponent: string | null;
  rush_attempts: number;
  rush_yards: number;
  rush_touchdowns: number;
  receptions: number;
  receiving_yards: number;
  receiving_touchdowns: number;
  fumbles_lost: number;
  fantasy_points_ppr: number;
}

interface RBPlayerRaw {
  player_name: string;
  position: string;
  team: string;
  season: number;
  game_logs: RBGameLog[];
}

interface RBProjection {
  player: string;
  team: string;
  adp: number;
  points: number;
  rush_yds: number;
  rec_yards: number;
  receptions: number;
  rush_tds: number;
  rec_tds: number;
}

/**
 * Calculate advanced metrics from game logs
 */
function calculateAdvancedMetrics(gameLogs: RBGameLog[]): RBPlayerMetrics {
  const validGames = gameLogs.filter(game => game.opponent !== null && game.rush_attempts > 0);
  
  if (validGames.length === 0) {
    return {
      rush_att: 0,
      tgt_share: 0,
      gl_carries: 0,
      yac_per_att: 0,
      breakaway_pct: 0
    };
  }

  // Total season stats
  const totalRushAttempts = validGames.reduce((sum, game) => sum + game.rush_attempts, 0);
  const totalRushYards = validGames.reduce((sum, game) => sum + game.rush_yards, 0);
  const totalReceptions = validGames.reduce((sum, game) => sum + game.receptions, 0);
  const totalRushTDs = validGames.reduce((sum, game) => sum + game.rush_touchdowns, 0);

  // Calculate breakaway runs (20+ yard carries estimated from big games)
  const breakawayGames = validGames.filter(game => 
    game.rush_yards / Math.max(game.rush_attempts, 1) > 6.0 && game.rush_attempts > 10
  ).length;
  
  const breakawayPct = breakawayGames / validGames.length;

  // Estimated target share (simplified - would need team data for accuracy)
  const avgReceptionsPerGame = totalReceptions / validGames.length;
  const estimatedTargetShare = Math.min(0.25, avgReceptionsPerGame / 8); // Rough estimation

  // Goal line carries (estimated from TD efficiency)
  const tdEfficiency = totalRushTDs / Math.max(totalRushAttempts, 1);
  const estimatedGLCarries = Math.round(totalRushTDs * 2.5); // Rough estimation

  // YAC per attempt (simplified - using total yards)
  const yacPerAtt = totalRushYards / Math.max(totalRushAttempts, 1);

  return {
    rush_att: totalRushAttempts,
    tgt_share: estimatedTargetShare,
    gl_carries: estimatedGLCarries,
    yac_per_att: yacPerAtt,
    breakaway_pct: breakawayPct
  };
}

/**
 * Get player age (placeholder - would come from player database)
 */
function getPlayerAge(playerName: string): number {
  // Placeholder ages for common players - would be replaced with real data
  const ageMap: { [key: string]: number } = {
    'Saquon Barkley': 27,
    'Christian McCaffrey': 28,
    'Derrick Henry': 30,
    'Josh Jacobs': 26,
    'Jonathan Taylor': 25,
    'Alvin Kamara': 29,
    'Nick Chubb': 28,
    'Austin Ekeler': 29,
    'Dalvin Cook': 28,
    'Aaron Jones': 29
  };
  
  return ageMap[playerName] || 26; // Default age
}

/**
 * Get team offensive line rank (placeholder - would come from analytics)
 */
function getOLineRank(team: string): number {
  const olRankings: { [key: string]: number } = {
    'PHI': 3, 'SF': 8, 'DAL': 12, 'BAL': 5, 'DET': 7,
    'GB': 15, 'BUF': 18, 'IND': 22, 'NO': 25, 'MIA': 28
  };
  
  return olRankings[team] || 16; // Default middle rank
}

/**
 * Get offensive coordinator run rate (placeholder)
 */
function getOCRunRate(team: string): number {
  const runRates: { [key: string]: number } = {
    'PHI': 0.52, 'SF': 0.48, 'BAL': 0.55, 'DET': 0.45,
    'GB': 0.42, 'BUF': 0.38, 'DAL': 0.47, 'IND': 0.44
  };
  
  return runRates[team] || 0.44; // Default run rate
}

/**
 * Transform raw RB data into Player Compass format
 */
export function transformRBToCompassData(
  playerRaw: RBPlayerRaw,
  projections: RBProjection[],
  populationStats: PopulationStats
): RBPlayerData {
  const projection = projections.find(p => 
    p.player.toLowerCase().includes(playerRaw.player_name.toLowerCase().split(' ')[1]) ||
    playerRaw.player_name.toLowerCase().includes(p.player.toLowerCase())
  );

  const playerMetrics = calculateAdvancedMetrics(playerRaw.game_logs);
  const age = getPlayerAge(playerRaw.player_name);
  
  // Calculate fumble rate from game logs
  const totalFumbles = playerRaw.game_logs.reduce((sum, game) => sum + game.fumbles_lost, 0);
  const totalTouches = playerRaw.game_logs.reduce((sum, game) => 
    sum + game.rush_attempts + game.receptions, 0
  );
  const fumRate = totalTouches > 0 ? totalFumbles / totalTouches : 0;

  // Games missed estimation (simplified)
  const totalWeeks = 18;
  const gamesPlayed = playerRaw.game_logs.filter(game => 
    game.opponent !== null && (game.rush_attempts > 0 || game.receptions > 0)
  ).length;
  const gamesMissed2yr = Math.max(0, totalWeeks - gamesPlayed);

  return {
    player_name: playerRaw.player_name,
    team: playerRaw.team,
    age,
    player_metrics: playerMetrics,
    population_stats: populationStats,
    ol_rank: getOLineRank(playerRaw.team),
    oc_run_rate: getOCRunRate(playerRaw.team),
    pos_snap_pct: 0.75, // Placeholder - would come from snap count data
    neutral_script_rate: 0.65, // Placeholder - would come from game script analysis
    games_missed_2yr: gamesMissed2yr,
    fum_rate: fumRate,
    proj_rank: projection ? Math.round(projection.adp) : 50,
    adp_rank: projection ? Math.round(projection.adp) : 50,
    pos_scarcity_z: 0.0, // Placeholder
    contract_yrs: 2 // Placeholder
  };
}

/**
 * Calculate population statistics from all RB players
 */
export function calculateRBPopulationStats(allPlayers: RBPlayerRaw[]): PopulationStats {
  const allMetrics = allPlayers.map(player => calculateAdvancedMetrics(player.game_logs));
  
  const calculateStat = (metric: keyof RBPlayerMetrics) => {
    const values = allMetrics.map(m => m[metric]).filter(v => v > 0);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    
    return { mean: mean || 0, std: std || 1 };
  };

  return {
    rush_att: calculateStat('rush_att'),
    tgt_share: calculateStat('tgt_share'),
    gl_carries: calculateStat('gl_carries'),
    yac_per_att: calculateStat('yac_per_att'),
    breakaway_pct: calculateStat('breakaway_pct')
  };
}