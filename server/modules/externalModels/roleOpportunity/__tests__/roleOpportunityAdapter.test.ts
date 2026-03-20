import { adaptRoleOpportunityInsight } from '../roleOpportunityAdapter';
import { RoleOpportunityClient } from '../roleOpportunityClient';
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

describe('roleOpportunityAdapter', () => {
  it('maps a valid canonical payload into a stable internal TIBER insight', () => {
    const insight = adaptRoleOpportunityInsight(validPayload, { includeRawCanonical: true });

    expect(insight).toEqual(
      expect.objectContaining({
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
        confidence: 0.91,
      }),
    );

    expect(insight.rawCanonical).toEqual(validPayload);
  });

  it('rejects malformed upstream payloads at the adapter boundary', () => {
    expect(() =>
      adaptRoleOpportunityInsight({
        ...validPayload,
        confidence_score: 2,
      }),
    ).toThrow(RoleOpportunityIntegrationError);

    expect(() =>
      adaptRoleOpportunityInsight({
        ...validPayload,
        confidence_score: 2,
      }),
    ).toThrow(/canonical contract/i);
  });
});

describe('RoleOpportunityService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('maps upstream timeout failures to a stable internal error', async () => {
    global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('timed out'), { name: 'AbortError' })) as any;

    const service = new RoleOpportunityService(
      new RoleOpportunityClient({
        baseUrl: 'https://role-model.example.com',
        timeoutMs: 25,
      }),
    );

    await expect(
      service.getRoleOpportunityInsight({ playerId: '00-0036322', season: 2025, week: 17 }),
    ).rejects.toMatchObject({
      code: 'upstream_timeout',
      status: 504,
    });
  });

  it('maps upstream 404 responses to a stable not_found error', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'missing' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as any;

    const service = new RoleOpportunityService(
      new RoleOpportunityClient({
        baseUrl: 'https://role-model.example.com',
      }),
    );

    await expect(
      service.getRoleOpportunityInsight({ playerId: '00-0036322', season: 2025, week: 17 }),
    ).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
    });
  });
});
