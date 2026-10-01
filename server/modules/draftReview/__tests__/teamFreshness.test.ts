import express from 'express';
import request from 'supertest';
import { createDraftReviewRouter } from '../../../routes/draftReviewRoutes';
import { installPublicApiBoundary } from '../../../runtimeProfile';
import { teamFreshness } from '../teamFreshness';
import { historicalEvidenceFor } from '../historicalEvidence';
jest.mock('../historicalEvidence', () => ({ historicalEvidenceFor: jest.fn() }));

const envBefore = process.env.RAILWAY_GIT_COMMIT_SHA;
beforeEach(() => {
  delete process.env.RAILWAY_GIT_COMMIT_SHA;
  (historicalEvidenceFor as jest.Mock).mockReturnValue({ status: 'available', window: { season: 2025, week_start: 1, week_end: 18 } });
});
afterEach(() => { if (envBefore === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA; else process.env.RAILWAY_GIT_COMMIT_SHA = envBefore; });

test('separates exact platform-reported revision from unknown build/deployment/source clocks', () => {
  process.env.RAILWAY_GIT_COMMIT_SHA = 'a'.repeat(40);
  expect(teamFreshness()).toEqual({
    schema_version: 'tiber_team_freshness_v1',
    server_build: { revision: 'a'.repeat(40), revision_basis: 'railway_reported_commit', built_at: null, deployed_at: null },
    historical_evidence: { status: 'available', window: { season: 2025, week_start: 1, week_end: 18 }, source_acquired_at: null, source_updated_at: null, last_successful_refresh_at: null },
    weekly_evidence: { status: 'unavailable' },
  });
  expect(historicalEvidenceFor).toHaveBeenCalledWith([]);
});
test.each(['', 'main', 'shortsha', 'secret-with-spaces', 'a'.repeat(41)])('withholds malformed metadata %s and unavailable artifact windows', value => {
  process.env.RAILWAY_GIT_COMMIT_SHA = value;
  (historicalEvidenceFor as jest.Mock).mockReturnValue({ status: 'unavailable', window: { season: 2025, week_start: 1, week_end: 18 } });
  const result = teamFreshness();
  expect(result.server_build.revision).toBeNull();
  expect(result.historical_evidence.window).toBeNull();
  expect(JSON.stringify(result)).not.toContain('secret');
});
test('metadata is reachable in the public boundary, no-store and has no private environment fields', async () => {
  const app = express(); app.use(createDraftReviewRouter()); installPublicApiBoundary(app);
  const result = await request(app).get('/api/draft-review/freshness');
  expect(result.status).toBe(200);
  expect(result.headers['cache-control']).toBe('no-store');
  expect(Object.keys(result.body.server_build)).toEqual(['revision', 'revision_basis', 'built_at', 'deployed_at']);
  expect((await request(app).post('/api/draft-review/freshness')).status).toBe(404);
});
