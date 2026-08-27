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
    expect(result.headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none';");
    expect(result.headers['x-frame-options']).toBe('DENY');
    expect(result.body).toEqual({
      status: 'source_unavailable',
      error: 'Sleeper is temporarily unavailable. Try again shortly.',
    });
    expect(JSON.stringify(result.body)).not.toContain('private upstream diagnostic');
  });

  test('rejects malicious resolver inputs before making an upstream request', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const app = express();
    app.use(createDraftReviewRouter());

    const result = await request(app)
      .get('/api/draft-review/resolve')
      .query({ sleeper_input: 'https://sleeper.com.evil.test/leagues/123' });

    expect(result.status).toBe(400);
    expect(result.body.status).toBe('invalid_input');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('resolves a numeric league ID to a minimal public team selector', async () => {
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      const body = url.endsWith('/league/123')
        ? { league_id: '123', name: 'League', season: '2026', total_rosters: 1 }
        : url.endsWith('/league/123/users')
          ? [{ user_id: 'private-owner', display_name: 'Manager' }]
          : url.endsWith('/league/123/rosters')
            ? [{ roster_id: 1, owner_id: 'private-owner' }]
            : null;
      if (body === null) throw new Error(`Unexpected URL: ${url}`);
      return {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as Response;
    }) as typeof fetch;
    const app = express();
    app.use(createDraftReviewRouter());

    const result = await request(app)
      .get('/api/draft-review/resolve')
      .query({ sleeper_input: '123' });

    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toMatchObject({
      status: 'team_selection_required',
      teams: [{ roster_id: 1, display_name: 'Manager', canonicalUrl: 'https://sleeper.com/roster/123/1' }],
    });
    expect(JSON.stringify(result.body)).not.toContain('private-owner');
  });
});
