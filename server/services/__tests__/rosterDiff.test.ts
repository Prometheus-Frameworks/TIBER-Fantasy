/**
 * Unit tests for Pure Deterministic Roster Diff Engine
 */

import { computeRosterDiff, canonicalRosterString, RosterEvent } from './rosterDiff';

describe('computeRosterDiff', () => {
  it('returns 0 events when no changes', () => {
    const prev = new Map([
      ['team1', new Set(['player-a', 'player-b'])],
      ['team2', new Set(['player-c'])]
    ]);
    const next = new Map([
      ['team1', new Set(['player-a', 'player-b'])],
      ['team2', new Set(['player-c'])]
    ]);
    
    const events = computeRosterDiff(prev, next);
    expect(events).toHaveLength(0);
  });
  
  it('detects ADD when player joins roster', () => {
    const prev = new Map([
      ['team1', new Set(['player-a'])]
    ]);
    const next = new Map([
      ['team1', new Set(['player-a', 'player-b'])]
    ]);
    
    const events = computeRosterDiff(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      playerKey: 'player-b',
      fromTeamId: null,
      toTeamId: 'team1',
      eventType: 'ADD'
    });
  });
  
  it('detects DROP when player leaves roster', () => {
    const prev = new Map([
      ['team1', new Set(['player-a', 'player-b'])]
    ]);
    const next = new Map([
      ['team1', new Set(['player-a'])]
    ]);
    
    const events = computeRosterDiff(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      playerKey: 'player-b',
      fromTeamId: 'team1',
      toTeamId: null,
      eventType: 'DROP'
    });
  });
  
  it('detects TRADE when player moves between teams (single event)', () => {
    const prev = new Map([
      ['team1', new Set(['player-a', 'player-b'])],
      ['team2', new Set(['player-c'])]
    ]);
    const next = new Map([
      ['team1', new Set(['player-a'])],
      ['team2', new Set(['player-c', 'player-b'])]
    ]);
    
    const events = computeRosterDiff(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      playerKey: 'player-b',
      fromTeamId: 'team1',
      toTeamId: 'team2',
      eventType: 'TRADE'
    });
  });
  
  it('produces deterministic output regardless of insertion order', () => {
    // First order
    const prev1 = new Map([
      ['team1', new Set(['player-a', 'player-b'])],
      ['team2', new Set(['player-c'])]
    ]);
    const next1 = new Map([
      ['team1', new Set(['player-a'])],
      ['team2', new Set(['player-b', 'player-c', 'player-d'])]
    ]);
    
    // Different construction order (same logical state)
    const prev2 = new Map([
      ['team2', new Set(['player-c'])],
      ['team1', new Set(['player-b', 'player-a'])]
    ]);
    const next2 = new Map([
      ['team2', new Set(['player-d', 'player-c', 'player-b'])],
      ['team1', new Set(['player-a'])]
    ]);
    
    const events1 = computeRosterDiff(prev1, next1);
    const events2 = computeRosterDiff(prev2, next2);
    
    expect(JSON.stringify(events1)).toBe(JSON.stringify(events2));
    expect(events1).toHaveLength(2); // 1 TRADE (player-b), 1 ADD (player-d)
  });
  
  it('handles empty rosters correctly', () => {
    const prev = new Map<string, Set<string>>();
    const next = new Map([
      ['team1', new Set(['player-a'])]
    ]);
    
    const events = computeRosterDiff(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('ADD');
  });
  
  it('handles complete roster wipe correctly', () => {
    const prev = new Map([
      ['team1', new Set(['player-a', 'player-b'])]
    ]);
    const next = new Map<string, Set<string>>();
    
    const events = computeRosterDiff(prev, next);
    expect(events).toHaveLength(2);
    expect(events.every(e => e.eventType === 'DROP')).toBe(true);
  });
});

describe('canonicalRosterString', () => {
  it('produces same string regardless of insertion order', () => {
    const state1 = new Map([
      ['team1', new Set(['player-b', 'player-a'])],
      ['team2', new Set(['player-c'])]
    ]);
    const state2 = new Map([
      ['team2', new Set(['player-c'])],
      ['team1', new Set(['player-a', 'player-b'])]
    ]);
    
    expect(canonicalRosterString(state1)).toBe(canonicalRosterString(state2));
  });
  
  it('produces predictable format', () => {
    const state = new Map([
      ['team1', new Set(['player-a', 'player-b'])]
    ]);
    
    expect(canonicalRosterString(state)).toBe('team1:player-a|team1:player-b');
  });
});
