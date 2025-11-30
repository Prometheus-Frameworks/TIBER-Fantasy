/**
 * API Registry - Forge/Tiber Endpoint Documentation
 * 
 * Central registry for developer/admin documentation of key API endpoints.
 * Used by the Admin API Lexicon page for endpoint discovery and testing.
 */

export type HttpMethod = 'GET' | 'POST';

export interface ApiEndpointDescriptor {
  key: string;
  method: HttpMethod;
  path: string;
  description: string;
  tags: string[];
  sampleParams?: {
    path?: Record<string, string>;
    query?: Record<string, string | number | boolean>;
    body?: any;
  };
  importantFields?: string[];
}

export const API_REGISTRY: ApiEndpointDescriptor[] = [
  // === FORGE Core Endpoints ===
  {
    key: 'forge_preview',
    method: 'GET',
    path: '/api/forge/preview',
    description: 'Preview FORGE alpha scores for players by position. Returns calibrated alpha (25-90 scale), trajectory, and confidence. Primary endpoint for ranking previews.',
    tags: ['forge', 'rankings', 'alpha', 'core'],
    sampleParams: {
      query: { position: 'WR', season: 2025, limit: 20 }
    },
    importantFields: ['alpha', 'rawAlpha', 'trajectory', 'confidence', 'position', 'playerId']
  },
  {
    key: 'forge_score_player',
    method: 'GET',
    path: '/api/forge/score/:playerId',
    description: 'Get FORGE alpha score for a specific player by canonical ID. Returns full scoring breakdown with all sub-components.',
    tags: ['forge', 'player', 'alpha', 'core'],
    sampleParams: {
      path: { playerId: 'george-pickens' },
      query: { season: 2025 }
    },
    importantFields: ['alpha', 'rawAlpha', 'confidence', 'trajectory', 'subScores']
  },
  {
    key: 'forge_batch',
    method: 'GET',
    path: '/api/forge/batch',
    description: 'Batch scoring endpoint for multiple players. Supports position filtering and limit. Returns sorted by alpha descending.',
    tags: ['forge', 'rankings', 'batch', 'core'],
    sampleParams: {
      query: { position: 'WR', limit: 100, season: 2025 }
    },
    importantFields: ['alpha', 'playerId', 'position', 'meta.count']
  },
  {
    key: 'forge_health',
    method: 'GET',
    path: '/api/forge/health',
    description: 'FORGE service health check. Returns operational status and version.',
    tags: ['forge', 'health', 'system'],
    sampleParams: {},
    importantFields: ['status', 'version', 'service']
  },

  // === FORGE Player Context ===
  {
    key: 'forge_player_context',
    method: 'GET',
    path: '/api/forge/player-context/:playerId',
    description: 'Get comprehensive player context including identity, stats, game logs, FORGE alpha, and environment/matchup modifiers. Key endpoint for player profile pages.',
    tags: ['forge', 'player', 'context', 'profile'],
    sampleParams: {
      path: { playerId: 'george-pickens' },
      query: { season: 2025 }
    },
    importantFields: ['identity', 'forgeAlpha', 'envScore100', 'matchupScore100', 'opponent', 'weeklyStats', 'seasonStats']
  },
  {
    key: 'forge_search_players',
    method: 'GET',
    path: '/api/forge/search-players',
    description: 'Simple player search by name or ID. Returns matched players with basic identity info for autocomplete/search UIs.',
    tags: ['forge', 'search', 'player', 'utility'],
    sampleParams: {
      query: { q: 'pickens', limit: 10 }
    },
    importantFields: ['results', 'playerId', 'fullName', 'position', 'team']
  },

  // === FORGE Environment Endpoints ===
  {
    key: 'forge_env',
    method: 'GET',
    path: '/api/forge/env',
    description: 'Get team offensive environment score. Returns env_score_100 (0-100, 50=neutral) for a specific team. Higher = better offensive environment.',
    tags: ['forge', 'environment', 'team', 'context'],
    sampleParams: {
      query: { team: 'LA', season: 2025 }
    },
    importantFields: ['team', 'env_score_100', 'env_multiplier', 'components']
  },
  {
    key: 'forge_env_all',
    method: 'GET',
    path: '/api/forge/env/all',
    description: 'Get all team environment scores for a season. Returns array of 32 teams with their offensive environment ratings.',
    tags: ['forge', 'environment', 'team', 'rankings'],
    sampleParams: {
      query: { season: 2025 }
    },
    importantFields: ['teams', 'env_score_100', 'rank']
  },
  {
    key: 'forge_env_debug',
    method: 'GET',
    path: '/api/forge/env-debug',
    description: 'Debug endpoint showing environment score calculation details. Includes raw components and normalization steps.',
    tags: ['forge', 'environment', 'debug', 'admin'],
    sampleParams: {
      query: { team: 'KC', season: 2025 }
    },
    importantFields: ['team', 'env_score_100', 'rawComponents', 'normalization']
  },
  {
    key: 'forge_env_season',
    method: 'GET',
    path: '/api/forge/env-season',
    description: 'Get season-level environment data with week-by-week breakdown. Shows how team environment evolved throughout the season.',
    tags: ['forge', 'environment', 'season', 'trend'],
    sampleParams: {
      query: { season: 2025 }
    },
    importantFields: ['teams', 'weeklyData', 'seasonAvg']
  },

  // === FORGE Matchup Endpoints ===
  {
    key: 'forge_matchup',
    method: 'GET',
    path: '/api/forge/matchup',
    description: 'Get position-specific matchup score against opponent defense. Returns matchup_score_100 (0-100, 50=neutral). Higher = softer matchup.',
    tags: ['forge', 'matchup', 'defense', 'context'],
    sampleParams: {
      query: { team: 'ARI', opponent: 'TEN', position: 'TE', season: 2025 }
    },
    importantFields: ['team', 'opponent', 'position', 'matchup_score_100', 'matchup_multiplier']
  },
  {
    key: 'forge_matchup_defense',
    method: 'GET',
    path: '/api/forge/matchup/defense',
    description: 'Get defensive strength by position for a specific team. Shows how tough a defense is against each position.',
    tags: ['forge', 'matchup', 'defense', 'rankings'],
    sampleParams: {
      query: { team: 'NYJ', season: 2025 }
    },
    importantFields: ['team', 'positionScores', 'overallRank']
  },
  {
    key: 'forge_matchup_debug',
    method: 'GET',
    path: '/api/forge/matchup-debug',
    description: 'Debug endpoint showing matchup score calculation details. Includes DvP components and normalization.',
    tags: ['forge', 'matchup', 'debug', 'admin'],
    sampleParams: {
      query: { position: 'WR', season: 2025 }
    },
    importantFields: ['matchups', 'rawDvP', 'normalization']
  },
  {
    key: 'forge_matchups_all',
    method: 'GET',
    path: '/api/forge/matchups',
    description: 'Get all position-specific matchup scores for the current week. Returns 32 teams with opponent matchup ratings by position.',
    tags: ['forge', 'matchup', 'weekly', 'rankings'],
    sampleParams: {
      query: { season: 2025, week: 12, position: 'WR' }
    },
    importantFields: ['matchups', 'position', 'matchup_score_100', 'opponent']
  },

  // === FORGE Analysis Endpoints ===
  {
    key: 'forge_fpr',
    method: 'GET',
    path: '/api/forge/fpr/:playerId',
    description: 'Fibonacci Pattern Resonance analysis for a player. Analyzes week-over-week usage patterns to detect growth, decay, or stability.',
    tags: ['forge', 'analysis', 'pattern', 'trend'],
    sampleParams: {
      path: { playerId: 'jaxon-smith-njigba' },
      query: { season: 2025 }
    },
    importantFields: ['fpr', 'inputData', 'trend', 'resonanceScore']
  },
  {
    key: 'forge_debug_distribution',
    method: 'GET',
    path: '/api/forge/debug/distribution',
    description: 'Get rawAlpha distribution stats for calibration. Returns p10/p90 values needed to tune ALPHA_CALIBRATION config.',
    tags: ['forge', 'debug', 'calibration', 'admin'],
    sampleParams: {
      query: { position: 'WR', season: 2025 }
    },
    importantFields: ['distribution', 'p10', 'p90', 'calibrationSuggestion']
  },

  // === Admin Sandbox Endpoints ===
  {
    key: 'admin_wr_sandbox',
    method: 'GET',
    path: '/api/admin/wr-rankings-sandbox',
    description: 'WR Rankings Algorithm Test Sandbox. Returns full WR dataset with all metrics for formula testing. Includes EnvScore + MatchupScore modifiers.',
    tags: ['admin', 'sandbox', 'wr', 'rankings'],
    sampleParams: {
      query: { season: 2025 }
    },
    importantFields: ['alphaScore', 'forge_alpha_base', 'forge_env_score_100', 'forge_matchup_score_100', 'forge_opponent', 'customAlphaScore']
  },
  {
    key: 'admin_rb_sandbox',
    method: 'GET',
    path: '/api/admin/rb-rankings-sandbox',
    description: 'RB Rankings Algorithm Test Sandbox. Returns full RB dataset with rushing and receiving metrics for formula testing.',
    tags: ['admin', 'sandbox', 'rb', 'rankings'],
    sampleParams: {
      query: { season: 2025 }
    },
    importantFields: ['alphaScore', 'forge_alpha_base', 'forge_env_score_100', 'forge_matchup_score_100', 'totalCarries', 'totalRushingYards']
  },
  {
    key: 'admin_te_sandbox',
    method: 'GET',
    path: '/api/admin/te-rankings-sandbox',
    description: 'TE Rankings Algorithm Test Sandbox. Returns full TE dataset with receiving, alignment, and blocking metrics. Includes EnvScore + MatchupScore.',
    tags: ['admin', 'sandbox', 'te', 'rankings'],
    sampleParams: {
      query: { season: 2025 }
    },
    importantFields: ['alphaScore', 'forge_alpha_base', 'forge_env_score_100', 'forge_matchup_score_100', 'forge_opponent', 'archetype', 'tdRoleScore']
  },
  {
    key: 'admin_qb_sandbox',
    method: 'GET',
    path: '/api/admin/qb-rankings-sandbox',
    description: 'QB Rankings Algorithm Test Sandbox. Returns full QB dataset with passing, rushing, and efficiency metrics. Includes EnvScore (no matchup yet).',
    tags: ['admin', 'sandbox', 'qb', 'rankings'],
    sampleParams: {
      query: { season: 2025 }
    },
    importantFields: ['alphaScore', 'forge_alpha_base', 'forge_env_score_100', 'archetype', 'volumeIndex', 'efficiencyIndex']
  },

  // === Public Rankings Endpoints ===
  {
    key: 'rankings_wr',
    method: 'GET',
    path: '/api/rankings/wr',
    description: 'Public WR rankings endpoint. Returns player rankings with FORGE alpha, sandbox alpha, and delta. Used by /rankings/wr page.',
    tags: ['rankings', 'wr', 'public'],
    sampleParams: {
      query: { season: 2025 }
    },
    importantFields: ['rankings', 'forgeAlpha', 'sandboxAlpha', 'delta']
  },

  // === DvP Endpoints ===
  {
    key: 'dvp_rankings',
    method: 'GET',
    path: '/api/dvp/rankings',
    description: 'Defense vs Position rankings. Shows how each defense performs against fantasy positions based on NFLfastR data.',
    tags: ['dvp', 'defense', 'rankings', 'matchup'],
    sampleParams: {
      query: { position: 'WR', season: 2025 }
    },
    importantFields: ['rankings', 'team', 'fpAllowed', 'rank']
  },
  {
    key: 'dvp_team',
    method: 'GET',
    path: '/api/dvp/team/:teamCode',
    description: 'DvP data for a specific team. Shows fantasy points allowed against each position.',
    tags: ['dvp', 'defense', 'team'],
    sampleParams: {
      path: { teamCode: 'KC' },
      query: { season: 2025 }
    },
    importantFields: ['team', 'positionData', 'overallRank']
  },

  // === Schedule & SOS Endpoints ===
  {
    key: 'forge_sos_team_position',
    method: 'GET',
    path: '/api/forge/sos/team-position',
    description: 'Get Strength of Schedule for a team + position combo. Returns RoS, Next 3 weeks, and playoff SoS (0-100 scale, higher = easier). Uses internal FORGE matchup data.',
    tags: ['forge', 'sos', 'schedule', 'team'],
    sampleParams: {
      query: { season: 2025, team: 'DAL', position: 'WR' }
    },
    importantFields: ['meta.team', 'meta.position', 'meta.dataThroughWeek', 'sos.ros', 'sos.next3', 'sos.playoffs']
  },
  {
    key: 'forge_sos_player',
    method: 'GET',
    path: '/api/forge/sos/player/:playerId',
    description: 'Get Strength of Schedule for a player. Resolves player to team + position, then returns SoS data. Scale 0-100 (higher = easier).',
    tags: ['forge', 'sos', 'player', 'schedule'],
    sampleParams: {
      path: { playerId: 'george-pickens' },
      query: { season: 2025 }
    },
    importantFields: ['meta.playerId', 'meta.displayName', 'meta.team', 'sos.ros', 'sos.next3', 'sos.playoffs']
  },
  {
    key: 'forge_sos_rankings',
    method: 'GET',
    path: '/api/forge/sos/rankings',
    description: 'Get SoS rankings for all teams by position. Returns teams sorted by easiest remaining schedule first. Useful for trade/waiver decisions.',
    tags: ['forge', 'sos', 'rankings', 'schedule'],
    sampleParams: {
      query: { season: 2025, position: 'WR' }
    },
    importantFields: ['meta.teamsCount', 'rankings', 'rank', 'sos.ros', 'sos.next3']
  },
  {
    key: 'schedule_week',
    method: 'GET',
    path: '/api/schedule/:season/:week',
    description: 'Get NFL schedule for a specific week. Returns matchups with home/away teams and scores (if game completed).',
    tags: ['schedule', 'matchup', 'nfl'],
    sampleParams: {
      path: { season: '2025', week: '12' }
    },
    importantFields: ['games', 'home', 'away', 'homeScore', 'awayScore']
  },
  {
    key: 'schedule_sync',
    method: 'POST',
    path: '/api/schedule/sync',
    description: 'Trigger manual schedule sync from NFLverse. Updates schedule table with latest game data.',
    tags: ['schedule', 'sync', 'admin'],
    sampleParams: {
      body: { season: 2025 }
    },
    importantFields: ['success', 'gamesUpdated']
  },

  // === TIBER Endpoints ===
  {
    key: 'tiber_player',
    method: 'GET',
    path: '/api/tiber/:playerId',
    description: 'Get TIBER score for a player. Tactical Index for Breakout Efficiency and Regression analysis.',
    tags: ['tiber', 'player', 'analysis'],
    sampleParams: {
      path: { playerId: 'ceedee-lamb' },
      query: { season: 2025 }
    },
    importantFields: ['tiberScore', 'breakoutProbability', 'regressionRisk', 'trend']
  },

  // === Strategy Endpoints ===
  {
    key: 'strategy_start_sit',
    method: 'GET',
    path: '/api/strategy/start-sit',
    description: 'Get start/sit recommendations for the current week. Combines FORGE alpha, matchup, and trend data.',
    tags: ['strategy', 'start-sit', 'weekly'],
    sampleParams: {
      query: { position: 'WR', week: 12, season: 2025 }
    },
    importantFields: ['starts', 'sits', 'borderline', 'confidence']
  },

  // === Waiver Wire Endpoints ===
  {
    key: 'waivers_top',
    method: 'GET',
    path: '/api/waivers/top',
    description: 'Get top waiver wire targets. Uses ownership %, recent usage, and TIBER signals to identify pickups.',
    tags: ['waivers', 'strategy', 'weekly'],
    sampleParams: {
      query: { position: 'WR', limit: 10 }
    },
    importantFields: ['targets', 'ownership', 'interestScore', 'archetype']
  },
];

export function getEndpointByKey(key: string): ApiEndpointDescriptor | undefined {
  return API_REGISTRY.find(e => e.key === key);
}

export function getEndpointsByTag(tag: string): ApiEndpointDescriptor[] {
  return API_REGISTRY.filter(e => e.tags.includes(tag));
}

export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  API_REGISTRY.forEach(e => e.tags.forEach(t => tagSet.add(t)));
  return Array.from(tagSet).sort();
}
