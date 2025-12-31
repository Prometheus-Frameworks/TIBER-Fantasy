import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ownershipService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOwnershipForPlayer', () => {
    it('should return disabled status when no player ID provided', async () => {
      const { getOwnershipForPlayer } = await import('../ownershipService');
      
      const result = await getOwnershipForPlayer({
        userId: 'test_user',
        canonicalPlayerId: '',
      });
      
      expect(result.status).toBe('disabled');
      expect(result.hint).toBe('No player ID provided');
      expect(result.source).toBe('disabled');
    });

    it('should return disabled status when no league context exists', async () => {
      const { getOwnershipForPlayer } = await import('../ownershipService');
      
      const result = await getOwnershipForPlayer({
        userId: 'nonexistent_user_12345',
        canonicalPlayerId: 'jamarr-chase',
      });
      
      expect(result.status).toBe('disabled');
      expect(result.hint).toBe('Connect a Sleeper league to see ownership');
      expect(result.source).toBe('disabled');
    });

    it('should return a valid ownership result for existing league context', async () => {
      const { getOwnershipForPlayer } = await import('../ownershipService');
      
      const result = await getOwnershipForPlayer({
        userId: 'default_user',
        canonicalPlayerId: 'jamarr-chase',
      });
      
      expect(result.source).toBe('db');
      expect(['owned_by_me', 'owned_by_other', 'free_agent']).toContain(result.status);
      
      if (result.status === 'owned_by_other') {
        expect(result.teamName).toBeDefined();
        expect(result.teamId).toBeDefined();
      }
    });

    it('should never throw - always returns a safe object', async () => {
      const { getOwnershipForPlayer } = await import('../ownershipService');
      
      const scenarios = [
        { userId: '', canonicalPlayerId: 'test' },
        { userId: 'test', canonicalPlayerId: '' },
        { userId: 'nonexistent', canonicalPlayerId: 'nonexistent' },
        { userId: 'default_user', canonicalPlayerId: 'definitely-not-a-real-player-id-12345' },
      ];
      
      for (const params of scenarios) {
        const result = await getOwnershipForPlayer(params);
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('source');
        expect(['owned_by_me', 'owned_by_other', 'free_agent', 'disabled', 'fallback']).toContain(result.status);
        expect(['db', 'sleeper_api', 'disabled']).toContain(result.source);
      }
    });
  });

  describe('getLeagueOwnershipDebug', () => {
    it('should return debug info for a valid league', async () => {
      const { getLeagueOwnershipDebug } = await import('../ownershipService');
      
      const result = await getLeagueOwnershipDebug('a15b00f5-7475-4922-8ba0-762e163fbe20');
      
      expect(result.leagueId).toBe('a15b00f5-7475-4922-8ba0-762e163fbe20');
      expect(Array.isArray(result.teams)).toBe(true);
      expect(typeof result.mappingCoveragePct).toBe('number');
      expect(typeof result.totalSleeperIds).toBe('number');
      expect(typeof result.mappedCount).toBe('number');
      expect(['db', 'sleeper_api']).toContain(result.sourceCandidate);
      expect(Array.isArray(result.notes)).toBe(true);
    });

    it('should return empty teams for nonexistent league', async () => {
      const { getLeagueOwnershipDebug } = await import('../ownershipService');
      
      const result = await getLeagueOwnershipDebug('nonexistent-league-id');
      
      expect(result.teams).toEqual([]);
      expect(result.mappingCoveragePct).toBe(0);
      expect(result.notes).toContain('No teams found for this league');
    });
  });

  describe('clearOwnershipCache', () => {
    it('should clear cache without throwing', async () => {
      const { clearOwnershipCache } = await import('../ownershipService');
      
      expect(() => clearOwnershipCache()).not.toThrow();
      expect(() => clearOwnershipCache('some-league-id')).not.toThrow();
    });
  });
});
