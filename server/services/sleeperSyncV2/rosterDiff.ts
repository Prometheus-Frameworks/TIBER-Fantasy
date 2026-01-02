/**
 * Pure Deterministic Roster Diff Engine
 * Computes roster changes between two states (prev -> next)
 * 
 * Rules:
 * - Move A -> B in same run => ONE TRADE event (not add+drop spam)
 * - Leave roster => DROP
 * - New to roster => ADD
 * - Deterministic order (sorted before emit)
 */

export type EventType = 'ADD' | 'DROP' | 'TRADE';

export interface RosterEvent {
  playerKey: string;
  fromTeamId: string | null;
  toTeamId: string | null;
  eventType: EventType;
}

/**
 * Compute deterministic roster diff between previous and next state
 * 
 * @param prev - Previous roster state: Map<teamId, Set<playerKey>>
 * @param next - Next roster state: Map<teamId, Set<playerKey>>
 * @returns Sorted array of roster events
 */
export function computeRosterDiff(
  prev: Map<string, Set<string>>,
  next: Map<string, Set<string>>
): RosterEvent[] {
  const events: RosterEvent[] = [];
  
  // Build player -> team maps for O(1) lookup
  const prevPlayerToTeam = new Map<string, string>();
  const nextPlayerToTeam = new Map<string, string>();
  
  Array.from(prev.entries()).forEach(([teamId, players]) => {
    Array.from(players).forEach((playerKey) => {
      prevPlayerToTeam.set(playerKey, teamId);
    });
  });
  
  Array.from(next.entries()).forEach(([teamId, players]) => {
    Array.from(players).forEach((playerKey) => {
      nextPlayerToTeam.set(playerKey, teamId);
    });
  });
  
  // Collect all unique players across both states
  const allPlayers = new Set<string>([
    ...Array.from(prevPlayerToTeam.keys()),
    ...Array.from(nextPlayerToTeam.keys())
  ]);
  
  // Detect events for each player
  for (const playerKey of Array.from(allPlayers)) {
    const prevTeam = prevPlayerToTeam.get(playerKey) ?? null;
    const nextTeam = nextPlayerToTeam.get(playerKey) ?? null;
    
    if (prevTeam === nextTeam) {
      // No change
      continue;
    }
    
    if (prevTeam === null && nextTeam !== null) {
      // New to league -> ADD
      events.push({
        playerKey,
        fromTeamId: null,
        toTeamId: nextTeam,
        eventType: 'ADD'
      });
    } else if (prevTeam !== null && nextTeam === null) {
      // Left league -> DROP
      events.push({
        playerKey,
        fromTeamId: prevTeam,
        toTeamId: null,
        eventType: 'DROP'
      });
    } else {
      // Team changed -> TRADE
      events.push({
        playerKey,
        fromTeamId: prevTeam,
        toTeamId: nextTeam,
        eventType: 'TRADE'
      });
    }
  }
  
  // Sort deterministically by (eventType, playerKey, fromTeamId, toTeamId)
  events.sort((a, b) => {
    const typeOrder = { 'TRADE': 0, 'ADD': 1, 'DROP': 2 };
    const typeCompare = typeOrder[a.eventType] - typeOrder[b.eventType];
    if (typeCompare !== 0) return typeCompare;
    
    const playerCompare = a.playerKey.localeCompare(b.playerKey);
    if (playerCompare !== 0) return playerCompare;
    
    const fromCompare = (a.fromTeamId ?? '').localeCompare(b.fromTeamId ?? '');
    if (fromCompare !== 0) return fromCompare;
    
    return (a.toTeamId ?? '').localeCompare(b.toTeamId ?? '');
  });
  
  return events;
}

/**
 * Convert roster state to canonical sorted string for hashing
 */
export function canonicalRosterString(state: Map<string, Set<string>>): string {
  const entries: string[] = [];
  
  // Sort teams first
  const sortedTeams = Array.from(state.keys()).sort();
  
  for (const teamId of sortedTeams) {
    const players = state.get(teamId)!;
    const sortedPlayers = Array.from(players).sort();
    for (const playerKey of sortedPlayers) {
      entries.push(`${teamId}:${playerKey}`);
    }
  }
  
  return entries.join('|');
}
