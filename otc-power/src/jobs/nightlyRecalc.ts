import { db } from '../infra/db.js';
import { cache } from '../infra/cache.js';
import { logger } from '../infra/logger.js';
import { computePowerScore } from '../core/scoring.js';
import { clampDelta } from '../core/smoothing.js';
import { loadUsageBundle, loadTalent, loadEnvironment, loadAvailability, loadMarketAnchor } from '../data/loaders.js';
import { upsertFacts, getLastWeekScore } from '../data/facts.js';
import { PlayerFacts, Pos } from '../core/types.js';

const CURRENT_SEASON = 2025;
const CURRENT_WEEK = 1; // TODO: Calculate from current date

async function recalculateAllPlayers() {
  logger.info('Starting nightly recalculation', { season: CURRENT_SEASON, week: CURRENT_WEEK });
  
  try {
    // Get all active players
    const playersResult = await db.query(
      `select player_id, name, team, position from players 
       where team is not null and team != 'FA'`
    );
    
    const players = playersResult.rows;
    logger.info(`Processing ${players.length} active players`);
    
    for (const player of players) {
      await processPlayer(player);
    }
    
    // Materialize rankings for all position types
    await materializeRankings();
    
    // Bust all power ranking caches
    await cache.del('power:*');
    
    logger.info('Nightly recalculation completed successfully');
    
  } catch (err) {
    logger.error('Nightly recalculation failed', { error: err });
    throw err;
  }
}

async function processPlayer(player: { player_id: string; name: string; team: string; position: string }) {
  try {
    // Load all component scores (0-100)
    const [usage_now, talent, environment, availability, market_anchor] = await Promise.all([
      loadUsageBundle(player.player_id, CURRENT_SEASON, CURRENT_WEEK),
      loadTalent(player.player_id),
      loadEnvironment(player.team),
      loadAvailability(player.player_id),
      loadMarketAnchor(player.player_id)
    ]);
    
    // Get last week's power score for smoothing
    const lastWeekScore = await getLastWeekScore(player.player_id, CURRENT_SEASON, CURRENT_WEEK);
    
    // Build player facts
    const facts: PlayerFacts = {
      player_id: player.player_id,
      season: CURRENT_SEASON,
      week: CURRENT_WEEK,
      position: player.position as Pos,
      usage_now,
      talent,
      environment,
      availability,
      market_anchor,
      flags: [],
      confidence: 0.75 // TODO: Calculate based on data quality
    };
    
    // Compute raw power score
    const rawScore = computePowerScore(facts);
    
    // Apply smoothing (unless flagged for bypass)
    const smoothedScore = clampDelta(lastWeekScore, rawScore, facts.flags);
    facts.power_score = smoothedScore;
    
    // Store facts
    await upsertFacts(facts);
    
  } catch (err) {
    logger.error('Failed to process player', { player_id: player.player_id, error: err });
  }
}

async function materializeRankings() {
  const rankingTypes = ['OVERALL', 'QB', 'RB', 'WR', 'TE'];
  
  for (const rankingType of rankingTypes) {
    await materializeRankingType(rankingType);
  }
}

async function materializeRankingType(rankingType: string) {
  logger.info(`Materializing ${rankingType} rankings`);
  
  // Clear existing rankings for this week
  await db.query(
    `delete from power_ranks 
     where season = $1 and week = $2 and ranking_type = $3`,
    [CURRENT_SEASON, CURRENT_WEEK, rankingType]
  );
  
  // Build position filter
  const positionFilter = rankingType === 'OVERALL' ? '' : `and p.position = '${rankingType}'`;
  
  // Get ranked players
  const rankedPlayers = await db.query(`
    select p.player_id, p.name, p.team, p.position, pwf.power_score,
           coalesce(prev_rank.rank, 999) as prev_rank
    from players p
    join player_week_facts pwf on pwf.player_id = p.player_id
    left join power_ranks prev_rank on prev_rank.player_id = p.player_id 
      and prev_rank.season = $1 and prev_rank.week = $2 and prev_rank.ranking_type = $3
    where pwf.season = $1 and pwf.week = $4 ${positionFilter}
      and p.team is not null and p.team != 'FA'
    order by pwf.power_score desc
  `, [CURRENT_SEASON, CURRENT_WEEK - 1, rankingType, CURRENT_WEEK]);
  
  // Insert new rankings
  for (let i = 0; i < rankedPlayers.rows.length; i++) {
    const player = rankedPlayers.rows[i];
    const currentRank = i + 1;
    const prevRank = player.prev_rank === 999 ? currentRank : player.prev_rank;
    const deltaW = prevRank - currentRank; // Positive = moved up
    
    await db.query(`
      insert into power_ranks (season, week, ranking_type, rank, player_id, power_score, delta_w)
      values ($1, $2, $3, $4, $5, $6, $7)
    `, [CURRENT_SEASON, CURRENT_WEEK, rankingType, currentRank, player.player_id, player.power_score, deltaW]);
  }
  
  logger.info(`Materialized ${rankedPlayers.rows.length} ${rankingType} rankings`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  recalculateAllPlayers()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Nightly recalc failed', { error: err });
      process.exit(1);
    });
}

export { recalculateAllPlayers };