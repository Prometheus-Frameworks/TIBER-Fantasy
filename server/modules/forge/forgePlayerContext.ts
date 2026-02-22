/**
 * FORGE Player Context v1.1
 * 
 * Provides unified player identity + current team + advanced stats.
 * Joins:
 * - player_identity_map (identity)
 * - forge_player_current_team (roster-driven team + last_seen_week)
 * - wr_advanced_stats_2025 / rb_advanced_stats_2025 (advanced stats)
 */

import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';

export interface ForgePlayerContext {
  meta: { 
    playerId: string; 
    season: number;
  };
  identity: {
    displayName: string;
    position: string;
    sleeperId: string | null;
    nflfastrGsisId: string | null;
  };
  team: {
    currentTeam: string | null;
    lastSeenWeek: number | null;
  };
  usage: Record<string, any>;
  efficiency: Record<string, any>;
  finishing: Record<string, any>;
  metaStats: {
    gamesPlayed: number;
    lastUpdated: string;
  };
}

export interface PlayerSearchResult {
  playerId: string;
  displayName: string;
  position: string;
  currentTeam: string | null;
}

/**
 * Get complete FORGE player context including identity, team, advanced stats, and fantasy summary
 */
export async function getForgePlayerContext(
  playerId: string,
  season: number = 2025
): Promise<ForgePlayerContext | null> {
  try {
    const identityResult = await db.execute(sql`
      SELECT 
        im.canonical_id,
        im.full_name,
        im.position,
        im.sleeper_id,
        im.nflfastr_gsis_id,
        im.nfl_team,
        ct.current_team,
        ct.nflfastr_gsis_id as ct_gsis_id,
        ct.last_seen_week
      FROM player_identity_map im
      LEFT JOIN forge_player_current_team ct ON ct.player_id = im.canonical_id
      WHERE im.canonical_id = ${playerId}
      LIMIT 1
    `);

    if (!identityResult.rows.length) {
      return null;
    }

    const identity = identityResult.rows[0] as any;
    const position = identity.position;
    const currentTeam = identity.current_team || identity.nfl_team;
    const lastSeenWeek = identity.last_seen_week ? Number(identity.last_seen_week) : null;

    let usage: Record<string, any> = {};
    let efficiency: Record<string, any> = {};
    let finishing: Record<string, any> = {};
    let gamesPlayed = 0;

    if (position === 'WR' && season === 2025) {
      const wrResult = await db.execute(sql`
        SELECT 
          games_played,
          targets,
          receptions,
          rec_yards,
          first_downs,
          tds,
          air_yards,
          yac,
          target_share,
          air_yards_share,
          yards_per_target,
          fd_per_target,
          catch_rate,
          yac_per_rec,
          epa_per_target,
          success_rate,
          yprr_est,
          fd_rr_est
        FROM wr_advanced_stats_2025
        WHERE canonical_id = ${playerId}
        LIMIT 1
      `);

      if (wrResult.rows.length) {
        const wr = wrResult.rows[0] as any;
        gamesPlayed = Number(wr.games_played) || 0;

        usage = {
          targets: Number(wr.targets) || 0,
          receptions: Number(wr.receptions) || 0,
          airYards: Number(wr.air_yards) || 0,
          targetShare: Number(wr.target_share) || 0,
          airYardsShare: Number(wr.air_yards_share) || 0,
        };

        efficiency = {
          yprrEst: Number(wr.yprr_est) || 0,
          epaPerTarget: Number(wr.epa_per_target) || 0,
          successRate: Number(wr.success_rate) || 0,
          fdPerTarget: Number(wr.fd_per_target) || 0,
          catchRate: Number(wr.catch_rate) || 0,
          yacPerRec: Number(wr.yac_per_rec) || 0,
          yardsPerTarget: Number(wr.yards_per_target) || 0,
        };

        finishing = {
          tds: Number(wr.tds) || 0,
          firstDowns: Number(wr.first_downs) || 0,
          recYards: Number(wr.rec_yards) || 0,
          yac: Number(wr.yac) || 0,
        };
      }
    } else if (position === 'RB' && season === 2025) {
      const rbResult = await db.execute(sql`
        SELECT 
          games_played,
          carries,
          targets,
          receptions,
          carry_share,
          target_share,
          carries_per_game,
          targets_per_game,
          rush_yards,
          yards_per_carry,
          explosive_rush_rate,
          rush_success_rate,
          rush_epa_per_att,
          rush_fd_rate,
          rec_yards,
          yards_per_target,
          catch_rate,
          yac_per_rec,
          rec_epa_per_target,
          total_tds,
          rush_tds,
          rec_tds,
          goal_line_carries,
          redzone_carries,
          redzone_targets,
          total_yards,
          total_opportunities
        FROM rb_advanced_stats_2025
        WHERE canonical_id = ${playerId}
        LIMIT 1
      `);

      if (rbResult.rows.length) {
        const rb = rbResult.rows[0] as any;
        gamesPlayed = Number(rb.games_played) || 0;

        usage = {
          carries: Number(rb.carries) || 0,
          targets: Number(rb.targets) || 0,
          receptions: Number(rb.receptions) || 0,
          carryShare: Number(rb.carry_share) || 0,
          targetShare: Number(rb.target_share) || 0,
          carriesPerGame: Number(rb.carries_per_game) || 0,
          targetsPerGame: Number(rb.targets_per_game) || 0,
        };

        efficiency = {
          yardsPerCarry: Number(rb.yards_per_carry) || 0,
          explosiveRushRate: Number(rb.explosive_rush_rate) || 0,
          rushSuccessRate: Number(rb.rush_success_rate) || 0,
          rushEpaPerAtt: Number(rb.rush_epa_per_att) || 0,
          rushFdRate: Number(rb.rush_fd_rate) || 0,
          yardsPerTarget: Number(rb.yards_per_target) || 0,
          catchRate: Number(rb.catch_rate) || 0,
          yacPerRec: Number(rb.yac_per_rec) || 0,
        };

        finishing = {
          totalTds: Number(rb.total_tds) || 0,
          rushTds: Number(rb.rush_tds) || 0,
          recTds: Number(rb.rec_tds) || 0,
          rushYards: Number(rb.rush_yards) || 0,
          recYards: Number(rb.rec_yards) || 0,
          totalYards: Number(rb.total_yards) || 0,
          goalLineCarries: Number(rb.goal_line_carries) || 0,
          redzoneCarries: Number(rb.redzone_carries) || 0,
        };
      }
    } else if (position === 'QB') {
      const qbResult = await db.execute(sql`
        SELECT 
          games_played,
          attempts,
          completions,
          completion_pct,
          pass_yards,
          pass_tds,
          ints,
          yards_per_attempt,
          air_yards,
          air_yards_per_attempt,
          epa_per_attempt,
          success_rate,
          rush_attempts,
          rush_yards,
          rush_tds,
          yards_per_carry,
          rush_epa_per_att
        FROM forge_player_advanced_qb
        WHERE player_id = ${playerId} AND season = ${season}
        LIMIT 1
      `);

      if (qbResult.rows.length) {
        const qb = qbResult.rows[0] as any;
        gamesPlayed = Number(qb.games_played) || 0;

        usage = {
          attempts: Number(qb.attempts) || 0,
          completions: Number(qb.completions) || 0,
          rushAttempts: Number(qb.rush_attempts) || 0,
          airYards: Number(qb.air_yards) || 0,
        };

        efficiency = {
          completionPct: Number(qb.completion_pct) || 0,
          yardsPerAttempt: Number(qb.yards_per_attempt) || 0,
          airYardsPerAttempt: Number(qb.air_yards_per_attempt) || 0,
          epaPerAttempt: Number(qb.epa_per_attempt) || 0,
          successRate: Number(qb.success_rate) || 0,
          yardsPerCarry: Number(qb.yards_per_carry) || 0,
          rushEpaPerAtt: Number(qb.rush_epa_per_att) || 0,
        };

        finishing = {
          passYards: Number(qb.pass_yards) || 0,
          passTds: Number(qb.pass_tds) || 0,
          ints: Number(qb.ints) || 0,
          rushYards: Number(qb.rush_yards) || 0,
          rushTds: Number(qb.rush_tds) || 0,
        };
      }
    } else if (position === 'TE') {
      const teResult = await db.execute(sql`
        SELECT 
          games_played,
          targets,
          receptions,
          rec_yards,
          first_downs,
          tds,
          air_yards,
          yac,
          target_share,
          air_yards_share,
          yards_per_target,
          yards_per_reception,
          fd_per_target,
          catch_rate,
          yac_per_rec,
          epa_per_target,
          success_rate
        FROM forge_player_advanced_te
        WHERE player_id = ${playerId} AND season = ${season}
        LIMIT 1
      `);

      if (teResult.rows.length) {
        const te = teResult.rows[0] as any;
        gamesPlayed = Number(te.games_played) || 0;

        usage = {
          targets: Number(te.targets) || 0,
          receptions: Number(te.receptions) || 0,
          airYards: Number(te.air_yards) || 0,
          targetShare: Number(te.target_share) || 0,
          airYardsShare: Number(te.air_yards_share) || 0,
        };

        efficiency = {
          epaPerTarget: Number(te.epa_per_target) || 0,
          successRate: Number(te.success_rate) || 0,
          fdPerTarget: Number(te.fd_per_target) || 0,
          catchRate: Number(te.catch_rate) || 0,
          yacPerRec: Number(te.yac_per_rec) || 0,
          yardsPerTarget: Number(te.yards_per_target) || 0,
          yardsPerReception: Number(te.yards_per_reception) || 0,
        };

        finishing = {
          tds: Number(te.tds) || 0,
          firstDowns: Number(te.first_downs) || 0,
          recYards: Number(te.rec_yards) || 0,
          yac: Number(te.yac) || 0,
        };
      }
    }

    return {
      meta: {
        playerId,
        season,
      },
      identity: {
        displayName: identity.full_name,
        position: identity.position,
        sleeperId: identity.sleeper_id || null,
        nflfastrGsisId: identity.nflfastr_gsis_id || identity.ct_gsis_id || null,
      },
      team: {
        currentTeam,
        lastSeenWeek,
      },
      usage,
      efficiency,
      finishing,
      metaStats: {
        gamesPlayed,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[ForgePlayerContext] Error fetching player context:', error);
    return null;
  }
}

/**
 * Search players by name with optional position filter
 * Returns identity + current team from roster
 */
export async function searchForgePlayersSimple(
  query: string,
  limit: number = 20
): Promise<PlayerSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const searchPattern = `%${query.toLowerCase().trim()}%`;

    const result = await db.execute(sql`
      SELECT 
        im.canonical_id,
        im.full_name,
        im.position,
        COALESCE(ct.current_team, im.nfl_team) AS current_team
      FROM player_identity_map im
      LEFT JOIN forge_player_current_team ct ON ct.player_id = im.canonical_id
      WHERE (
        LOWER(im.full_name) LIKE ${searchPattern}
        OR LOWER(im.canonical_id) LIKE ${searchPattern}
      )
      AND im.position IN ('QB', 'RB', 'WR', 'TE')
      ORDER BY 
        CASE WHEN LOWER(im.full_name) = ${query.toLowerCase().trim()} THEN 0 ELSE 1 END,
        im.full_name
      LIMIT ${limit}
    `);

    return (result.rows as any[]).map(row => ({
      playerId: row.canonical_id,
      displayName: row.full_name,
      position: row.position,
      currentTeam: row.current_team || null,
    }));
  } catch (error) {
    console.error('[ForgePlayerContext] Search error:', error);
    return [];
  }
}
