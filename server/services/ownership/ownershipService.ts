import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';
import { LRUCache } from 'lru-cache';

export interface OwnershipResult {
  status: 'owned_by_me' | 'owned_by_other' | 'free_agent' | 'disabled' | 'fallback' | 'unknown_unmapped';
  teamId?: string;
  teamName?: string;
  leagueId?: string;
  hint?: string;
  source: 'db' | 'sleeper_api' | 'disabled';
}

export interface LeagueRosterMap {
  leagueId: string;
  teams: Map<string, { teamId: string; teamName: string; canonicalPlayerIds: Set<string> }>;
  mappingCoveragePct: number;
  totalSleeperIds: number;
  mappedCount: number;
  computedAt: Date;
}

const rosterMapCache = new LRUCache<string, LeagueRosterMap>({
  max: 100,
  ttl: 15 * 60 * 1000, // 15 minutes
});

async function fetchSleeperToCanonicalMap(sleeperIds: string[]): Promise<Map<string, string>> {
  if (sleeperIds.length === 0) return new Map();
  
  const result = await db.execute(sql`
    SELECT sleeper_id, canonical_id 
    FROM player_identity_map 
    WHERE sleeper_id = ANY(ARRAY[${sql.join(sleeperIds.map(id => sql`${id}`), sql`, `)}]::text[])
  `);
  
  const map = new Map<string, string>();
  for (const row of result.rows as { sleeper_id: string; canonical_id: string }[]) {
    if (row.sleeper_id && row.canonical_id) {
      map.set(row.sleeper_id, row.canonical_id);
    }
  }
  return map;
}

function normalizePlayersArray(players: unknown): string[] {
  if (!players) return [];
  if (Array.isArray(players)) {
    return players.map(p => String(p)).filter(p => p && p !== 'null');
  }
  if (typeof players === 'string') {
    try {
      const parsed = JSON.parse(players);
      if (Array.isArray(parsed)) {
        return parsed.map(p => String(p)).filter(p => p && p !== 'null');
      }
    } catch {
      return [];
    }
  }
  return [];
}

async function buildLeagueRosterMap(leagueId: string): Promise<LeagueRosterMap | null> {
  const cached = rosterMapCache.get(leagueId);
  if (cached) return cached;

  const teamsResult = await db.execute(sql`
    SELECT id, display_name, players, external_user_id 
    FROM league_teams 
    WHERE league_id = ${leagueId}
  `);
  
  const teams = teamsResult.rows as { id: string; display_name: string; players: unknown; external_user_id: string }[];
  
  if (teams.length === 0) {
    return null;
  }

  const allSleeperIds: string[] = [];
  const teamPlayerLists: Map<string, string[]> = new Map();
  
  for (const team of teams) {
    const playerIds = normalizePlayersArray(team.players);
    teamPlayerLists.set(team.id, playerIds);
    allSleeperIds.push(...playerIds);
  }

  const uniqueSleeperIds = Array.from(new Set(allSleeperIds));
  const sleeperToCanonical = await fetchSleeperToCanonicalMap(uniqueSleeperIds);
  
  const mappedCount = sleeperToCanonical.size;
  const totalSleeperIds = uniqueSleeperIds.length;
  const mappingCoveragePct = totalSleeperIds > 0 ? (mappedCount / totalSleeperIds) * 100 : 0;

  const rosterMap: LeagueRosterMap = {
    leagueId,
    teams: new Map(),
    mappingCoveragePct,
    totalSleeperIds,
    mappedCount,
    computedAt: new Date(),
  };

  for (const team of teams) {
    const sleeperIds = teamPlayerLists.get(team.id) || [];
    const canonicalIds = new Set<string>();
    
    sleeperIds.forEach(sleeperId => {
      const canonicalId = sleeperToCanonical.get(sleeperId);
      if (canonicalId) {
        canonicalIds.add(canonicalId);
      }
    });
    
    rosterMap.teams.set(team.id, {
      teamId: team.id,
      teamName: team.display_name,
      canonicalPlayerIds: canonicalIds,
    });
  }

  rosterMapCache.set(leagueId, rosterMap);
  return rosterMap;
}

export async function getOwnershipForPlayer(params: {
  userId: string;
  canonicalPlayerId: string;
}): Promise<OwnershipResult> {
  const { userId, canonicalPlayerId } = params;
  
  if (!canonicalPlayerId) {
    return {
      status: 'disabled',
      hint: 'No player ID provided',
      source: 'disabled',
    };
  }

  try {
    const prefResult = await db.execute(sql`
      SELECT active_league_id, active_team_id 
      FROM user_league_preferences 
      WHERE user_id = ${userId} 
      LIMIT 1
    `);
    
    const preference = prefResult.rows[0] as { active_league_id: string | null; active_team_id: string | null } | undefined;
    
    if (!preference?.active_league_id) {
      return {
        status: 'disabled',
        hint: 'Connect a Sleeper league to see ownership',
        source: 'disabled',
      };
    }
    
    const leagueId = preference.active_league_id;
    const myTeamId = preference.active_team_id;

    const rosterMap = await buildLeagueRosterMap(leagueId);
    
    if (!rosterMap) {
      return {
        status: 'disabled',
        leagueId,
        hint: 'No teams found in league. Try syncing your league.',
        source: 'disabled',
      };
    }

    if (rosterMap.mappingCoveragePct < 70) {
      console.log(`[Ownership] Low mapping coverage: ${rosterMap.mappingCoveragePct.toFixed(1)}% for league ${leagueId}`);
    }

    const teamEntries = Array.from(rosterMap.teams.entries());
    for (let i = 0; i < teamEntries.length; i++) {
      const [teamId, teamData] = teamEntries[i];
      if (teamData.canonicalPlayerIds.has(canonicalPlayerId)) {
        if (teamId === myTeamId) {
          return {
            status: 'owned_by_me',
            teamId,
            teamName: teamData.teamName,
            leagueId,
            source: 'db',
          };
        } else {
          return {
            status: 'owned_by_other',
            teamId,
            teamName: teamData.teamName,
            leagueId,
            source: 'db',
          };
        }
      }
    }

    // Player not found in any team's mapped rosters - check if this is a raw Sleeper ID
    // that exists in rosters but is unmapped (only relevant when caller passes Sleeper ID directly)
    if (canonicalPlayerId.match(/^\d{3,7}$/)) {
      // Looks like a raw Sleeper ID - check unmapped_sleeper_players table
      const unmappedCheck = await db.execute(sql`
        SELECT full_name FROM unmapped_sleeper_players WHERE sleeper_id = ${canonicalPlayerId} LIMIT 1
      `);
      
      if ((unmappedCheck.rows as any[]).length > 0) {
        return {
          status: 'unknown_unmapped',
          leagueId,
          hint: `Player "${(unmappedCheck.rows[0] as any).full_name || canonicalPlayerId}" is in rosters but not mapped to canonical data. Run identity enrichment.`,
          source: 'db',
        };
      }
    }
    
    return {
      status: 'free_agent',
      leagueId,
      source: 'db',
    };

  } catch (error: any) {
    console.error('[Ownership] Error:', error);
    return {
      status: 'fallback',
      hint: 'Unable to check ownership. Try again later.',
      source: 'disabled',
    };
  }
}

export async function getLeagueOwnershipDebug(leagueId: string): Promise<{
  leagueId: string;
  teams: { teamId: string; teamName: string; rosterCountSleeper: number; mappedCountCanonical: number }[];
  mappingCoveragePct: number;
  totalSleeperIds: number;
  mappedCount: number;
  sourceCandidate: 'db' | 'sleeper_api';
  notes: string[];
}> {
  const notes: string[] = [];
  
  const teamsResult = await db.execute(sql`
    SELECT id, display_name, players, external_user_id 
    FROM league_teams 
    WHERE league_id = ${leagueId}
  `);
  
  const teams = teamsResult.rows as { id: string; display_name: string; players: unknown; external_user_id: string }[];
  
  if (teams.length === 0) {
    notes.push('No teams found for this league');
    return {
      leagueId,
      teams: [],
      mappingCoveragePct: 0,
      totalSleeperIds: 0,
      mappedCount: 0,
      sourceCandidate: 'sleeper_api',
      notes,
    };
  }

  const allSleeperIds: string[] = [];
  const teamStats: { teamId: string; teamName: string; sleeperIds: string[] }[] = [];
  
  for (const team of teams) {
    const playerIds = normalizePlayersArray(team.players);
    teamStats.push({ teamId: team.id, teamName: team.display_name, sleeperIds: playerIds });
    allSleeperIds.push(...playerIds);
  }

  const uniqueSleeperIds = Array.from(new Set(allSleeperIds));
  const sleeperToCanonical = await fetchSleeperToCanonicalMap(uniqueSleeperIds);
  
  const mappedCount = sleeperToCanonical.size;
  const totalSleeperIds = uniqueSleeperIds.length;
  const mappingCoveragePct = totalSleeperIds > 0 ? (mappedCount / totalSleeperIds) * 100 : 0;

  const teamResults = teamStats.map(t => {
    const mappedForTeam = t.sleeperIds.filter(sid => sleeperToCanonical.has(sid)).length;
    return {
      teamId: t.teamId,
      teamName: t.teamName,
      rosterCountSleeper: t.sleeperIds.length,
      mappedCountCanonical: mappedForTeam,
    };
  });

  if (mappingCoveragePct < 70) {
    notes.push(`Low mapping coverage (${mappingCoveragePct.toFixed(1)}%). Would fallback to Sleeper API if implemented.`);
  } else {
    notes.push(`Good mapping coverage (${mappingCoveragePct.toFixed(1)}%). Using DB.`);
  }

  notes.push(`Total unique players across all rosters: ${totalSleeperIds}`);
  notes.push(`Players with canonical ID mapping: ${mappedCount}`);

  return {
    leagueId,
    teams: teamResults,
    mappingCoveragePct,
    totalSleeperIds,
    mappedCount,
    sourceCandidate: mappingCoveragePct >= 70 ? 'db' : 'sleeper_api',
    notes,
  };
}

export function clearOwnershipCache(leagueId?: string): void {
  if (leagueId) {
    rosterMapCache.delete(leagueId);
  } else {
    rosterMapCache.clear();
  }
}
