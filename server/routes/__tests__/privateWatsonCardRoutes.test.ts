import express from 'express';
import request from 'supertest';
import { createDraftReviewRouter } from '../draftReviewRoutes';

const app = express().use(createDraftReviewRouter());
const previous = process.env.ADMIN_API_KEY;
afterEach(() => { if (previous === undefined) delete process.env.ADMIN_API_KEY; else process.env.ADMIN_API_KEY = previous; });

test('private card fails closed without configured key, without header and with wrong key', async () => {
  delete process.env.ADMIN_API_KEY;
  const unavailable = await request(app).get('/api/draft-review/private-watson-card');
  expect(unavailable.status).toBe(503);
  expect(unavailable.headers['cache-control']).toContain('no-store');
  expect(unavailable.text).not.toContain('Christian Watson');
  process.env.ADMIN_API_KEY = 'synthetic-operator-key';
  const missing = await request(app).get('/api/draft-review/private-watson-card');
  expect(missing.status).toBe(401);
  expect(missing.text).not.toContain('Christian Watson');
  const invalid = await request(app).get('/api/draft-review/private-watson-card').set('x-admin-api-key', 'invalid');
  expect(invalid.status).toBe(403);
  expect(invalid.text).not.toContain('Christian Watson');
  const queryKey = await request(app).get('/api/draft-review/private-watson-card?key=synthetic-operator-key');
  expect(queryKey.status).toBe(401);
});

test('only exact header-authenticated private endpoint returns source-native model, never roster ID', async () => {
  process.env.ADMIN_API_KEY = 'synthetic-operator-key';
  const result = await request(app).get('/api/draft-review/private-watson-card').set('x-admin-api-key', 'synthetic-operator-key');
  expect(result.status).toBe(200);
  expect(result.headers['cache-control']).toContain('no-store');
  expect(result.body).toMatchObject({ status: 'private_preview', sourceNativePlayerId: '00-0038124', model: { identity: { sleeperPlayerId: null, sleeperJoinStatus: 'unresolved' } } });
  const wrongRoute = await request(app).get('/api/draft-review/player-state-card/00-0038124');
  expect(wrongRoute.status).toBe(404);
  const publicWeekly = await request(app).get('/api/draft-review/weekly?season=2026&week=2');
  expect(publicWeekly.status).toBe(200);
  expect(publicWeekly.body.status).toBe('unavailable');
  expect(JSON.stringify(publicWeekly.body)).not.toContain('Christian Watson');
});
