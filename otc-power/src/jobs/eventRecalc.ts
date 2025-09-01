import { db } from '../infra/db.js';
import { cache } from '../infra/cache.js';
import { logger } from '../infra/logger.js';
import { nextUnprocessedEvent, markProcessed } from '../core/events.js';
import { computePowerScore } from '../core/scoring.js';
import { loadUsageBundle, loadTalent, loadEnvironment, loadAvailability, loadMarketAnchor } from '../data/loaders.js';
import { upsertFacts } from '../data/facts.js';
import { PlayerFacts, Pos } from '../core/types.js';

const CURRENT_SEASON = 2025;
const CURRENT_WEEK = 1; // TODO: Calculate from current date

async function processEvents() {
  logger.info('Processing events queue');
  
  let processedCount = 0;
  let event;
  
  while ((event = await nextUnprocessedEvent())) {
    try {
      await processEvent(event);
      await markProcessed(event.id);
      processedCount++;
      
      logger.info('Event processed', { 
        event_id: event.id, 
        event_type: event.event_type, 
        scope: event.scope 
      });
      
    } catch (err) {
      logger.error('Event processing failed', { 
        event_id: event.id, 
        event_type: event.event_type, 
        error: err 
      });
      
      // Mark as processed to avoid infinite retry (could implement retry logic here)
      await markProcessed(event.id);
    }
  }
  
  if (processedCount > 0) {
    logger.info(`Processed ${processedCount} events`);
    
    // Refresh rankings if any events were processed
    await refreshRankings();
    
    // Bust relevant caches
    await cache.del('power:*');
  }
}

async function processEvent(event: any) {
  const { event_type, scope } = event;
  
  // Determine affected players
  let affectedPlayers: string[] = [];
  
  if (scope.player_id) {
    affectedPlayers = [scope.player_id];
  } else if (scope.team) {
    // Team-wide event (e.g., QB change affects all WRs/TEs)
    const teamPlayersResult = await db.query(
      `select player_id from players where team = $1`,
      [scope.team]
    );
    affectedPlayers = teamPlayersResult.rows.map(r => r.player_id);
  }
  
  // Recompute affected players with event bypass flags
  for (const player_id of affectedPlayers) {
    await recomputePlayerWithBypass(player_id, event_type);
  }
}

async function recomputePlayerWithBypass(player_id: string, event_type: string) {
  try {
    // Get player info
    const playerResult = await db.query(
      `select name, team, position from players where player_id = $1`,
      [player_id]
    );
    
    if (playerResult.rows.length === 0) {
      logger.warn('Player not found for recompute', { player_id });
      return;
    }
    
    const player = playerResult.rows[0];
    
    // Load fresh component scores
    const [usage_now, talent, environment, availability, market_anchor] = await Promise.all([
      loadUsageBundle(player_id, CURRENT_SEASON, CURRENT_WEEK),
      loadTalent(player_id),
      loadEnvironment(player.team),
      loadAvailability(player_id),
      loadMarketAnchor(player_id)
    ]);
    
    // Build facts with bypass flag
    const facts: PlayerFacts = {
      player_id,
      season: CURRENT_SEASON,
      week: CURRENT_WEEK,
      position: player.position as Pos,
      usage_now,
      talent,
      environment,
      availability,
      market_anchor,
      flags: [`${event_type}_CHANGE`], // This will bypass smoothing
      confidence: 0.75
    };
    
    // Compute power score (no smoothing due to bypass flag)
    facts.power_score = computePowerScore(facts);
    
    // Store updated facts
    await upsertFacts(facts);
    
  } catch (err) {
    logger.error('Failed to recompute player', { player_id, event_type, error: err });
  }
}

async function refreshRankings() {
  logger.info('Refreshing rankings after events');
  
  const rankingTypes = ['OVERALL', 'QB', 'RB', 'WR', 'TE'];
  
  for (const rankingType of rankingTypes) {
    // Clear existing rankings for current week
    await db.query(
      `delete from power_ranks 
       where season = $1 and week = $2 and ranking_type = $3`,
      [CURRENT_SEASON, CURRENT_WEEK, rankingType]
    );
    
    // Rebuild rankings from current facts
    const positionFilter = rankingType === 'OVERALL' ? '' : `and p.position = '${rankingType}'`;
    
    const rankedPlayers = await db.query(`
      select p.player_id, pwf.power_score
      from players p
      join player_week_facts pwf on pwf.player_id = p.player_id
      where pwf.season = $1 and pwf.week = $2 ${positionFilter}
        and p.team is not null and p.team != 'FA'
      order by pwf.power_score desc
    `, [CURRENT_SEASON, CURRENT_WEEK]);
    
    // Insert refreshed rankings
    for (let i = 0; i < rankedPlayers.rows.length; i++) {
      const player = rankedPlayers.rows[i];
      const rank = i + 1;
      
      await db.query(`
        insert into power_ranks (season, week, ranking_type, rank, player_id, power_score, delta_w)
        values ($1, $2, $3, $4, $5, $6, 0)
      `, [CURRENT_SEASON, CURRENT_WEEK, rankingType, rank, player.player_id, player.power_score]);
    }
  }
}

// Event loop - polls every 60 seconds
async function startEventLoop() {
  logger.info('Starting event processing loop');
  
  setInterval(async () => {
    try {
      await processEvents();
    } catch (err) {
      logger.error('Event loop iteration failed', { error: err });
    }
  }, 60_000); // 60 seconds
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startEventLoop();
}

export { processEvents, startEventLoop };