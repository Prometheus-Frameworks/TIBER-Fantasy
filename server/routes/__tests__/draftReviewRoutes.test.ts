import { afterEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { __resetDraftReviewCacheForTests } from '../../modules/draftReview/draftReviewService';
import { createDraftReviewRouter } from '../draftReviewRoutes';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  __resetDraftReviewCacheForTests();
});

describe('Draft Review public route', () => {
  test('returns no-store and does not expose upstream error detail', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('private upstream diagnostic');
    }) as typeof fetch;
    const app = express();
    app.use(createDraftReviewRouter());

    const result = await request(app)
      .get('/api/draft-review')
      .query({ sleeper_url: 'https://sleeper.com/roster/123/7' });

    expect(result.status).toBe(502);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toEqual({
      status: 'source_unavailable',
      error: 'Sleeper is temporarily unavailable. Try again shortly.',
    });
    expect(JSON.stringify(result.body)).not.toContain('private upstream diagnostic');
  });
});
