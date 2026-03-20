import { buildRoleOpportunityInsightStatus } from '../playerDetailEnrichment';
import { RoleOpportunityService } from '../roleOpportunityService';
import { RoleOpportunityIntegrationError } from '../types';

const validPayload = {
  player_id: '00-0036322',
  season: 2025,
  week: 17,
  position: 'WR',
  team: 'MIN',
  primary_role: 'alpha_x',
  role_tags: ['boundary', 'downfield'],
  opportunity_tier: 'featured',
  confidence_score: 0.91,
  metrics: {
    snap_share: 93,
    route_share: 96,
    target_share: 31,
    usage_rate: 28,
    weighted_opportunity_index: 0.88,
  },
  insights: ['High route participation', 'Target leader'],
  model_version: 'role-opportunity-v1',
  generated_at: '2026-03-20T00:00:00.000Z',
};

describe('buildRoleOpportunityInsightStatus', () => {
  it('maps upstream success into a stable player-detail insight envelope', async () => {
    const service = new RoleOpportunityService({
      getConfig: () => ({
        enabled: true,
        configured: true,
        baseUrl: 'https://role-model.example.com',
        endpointPath: '/api/role-opportunity',
        timeoutMs: 5000,
      }),
      fetchRoleOpportunity: jest.fn().mockResolvedValue(validPayload),
    } as any);

    const result = await buildRoleOpportunityInsightStatus(
      { playerId: '00-0036322', season: 2025, week: 17 },
      service,
    );

    expect(result).toMatchObject({
      available: true,
      data: {
        playerId: '00-0036322',
        season: 2025,
        week: 17,
        primaryRole: 'alpha_x',
        roleTags: ['boundary', 'downfield'],
        usage: {
          snapShare: 0.93,
          routeShare: 0.96,
          targetShare: 0.31,
          usageRate: 0.28,
        },
        opportunity: {
          tier: 'featured',
          weightedOpportunityIndex: 0.88,
          insights: ['High route participation', 'Target leader'],
        },
        source: {
          provider: 'role-and-opportunity-model',
          modelVersion: 'role-opportunity-v1',
          generatedAt: '2026-03-20T00:00:00.000Z',
        },
      },
    });
    expect(result.fetchedAt).toEqual(expect.any(String));
  });

  it('contains upstream timeout failures without throwing top-level route errors', async () => {
    const service = new RoleOpportunityService({
      getConfig: () => ({ enabled: true, configured: true, endpointPath: '/api/role-opportunity', timeoutMs: 25 }),
      fetchRoleOpportunity: jest.fn().mockRejectedValue(
        new RoleOpportunityIntegrationError('upstream_timeout', 'timed out', 504),
      ),
    } as any);

    const result = await buildRoleOpportunityInsightStatus(
      { playerId: '00-0036322', season: 2025, week: 17 },
      service,
    );

    expect(result).toEqual({
      available: false,
      fetchedAt: expect.any(String),
      error: {
        category: 'upstream_timeout',
        message: 'timed out',
      },
    });
  });


  it('contains upstream unavailable failures without breaking the player detail payload', async () => {
    const service = new RoleOpportunityService({
      getConfig: () => ({ enabled: true, configured: true, endpointPath: '/api/role-opportunity', timeoutMs: 5000 }),
      fetchRoleOpportunity: jest.fn().mockRejectedValue(
        new RoleOpportunityIntegrationError('upstream_unavailable', 'service unavailable', 503),
      ),
    } as any);

    const result = await buildRoleOpportunityInsightStatus(
      { playerId: '00-0036322', season: 2025, week: 17 },
      service,
    );

    expect(result).toEqual({
      available: false,
      fetchedAt: expect.any(String),
      error: {
        category: 'upstream_unavailable',
        message: 'service unavailable',
      },
    });
  });

  it('returns a stable unavailable state when no upstream role-opportunity record exists', async () => {
    const service = new RoleOpportunityService({
      getConfig: () => ({ enabled: true, configured: true, endpointPath: '/api/role-opportunity', timeoutMs: 5000 }),
      fetchRoleOpportunity: jest.fn().mockRejectedValue(
        new RoleOpportunityIntegrationError('not_found', 'no role insight found', 404),
      ),
    } as any);

    const result = await buildRoleOpportunityInsightStatus(
      { playerId: '00-0036322', season: 2025, week: 17 },
      service,
    );

    expect(result).toEqual({
      available: false,
      fetchedAt: expect.any(String),
      error: {
        category: 'not_found',
        message: 'no role insight found',
      },
    });
  });

  it('returns a stable unavailable state when the integration is disabled by config', async () => {
    const service = new RoleOpportunityService({
      getConfig: () => ({ enabled: false, configured: false, endpointPath: '/api/role-opportunity', timeoutMs: 5000 }),
      fetchRoleOpportunity: jest.fn().mockRejectedValue(
        new RoleOpportunityIntegrationError('config_error', 'integration disabled', 503),
      ),
    } as any);

    const result = await buildRoleOpportunityInsightStatus(
      { playerId: '00-0036322', season: 2025, week: 17 },
      service,
    );

    expect(result).toEqual({
      available: false,
      fetchedAt: expect.any(String),
      error: {
        category: 'config_error',
        message: 'integration disabled',
      },
    });
  });

  it('contains malformed upstream payloads as insight errors instead of bubbling failures', async () => {
    const service = new RoleOpportunityService({
      getConfig: () => ({ enabled: true, configured: true, endpointPath: '/api/role-opportunity', timeoutMs: 5000 }),
      fetchRoleOpportunity: jest.fn().mockResolvedValue({
        ...validPayload,
        confidence_score: 2,
      }),
    } as any);

    const result = await buildRoleOpportunityInsightStatus(
      { playerId: '00-0036322', season: 2025, week: 17 },
      service,
    );

    expect(result.available).toBe(false);
    expect(result.error).toMatchObject({
      category: 'invalid_payload',
    });
    expect(result.error?.message).toMatch(/canonical contract/i);
  });
});
