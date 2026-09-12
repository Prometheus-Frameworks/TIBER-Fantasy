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

describe('bounded historical comparison route', () => {
  test('serves admitted data without Sleeper or private state and preserves public headers', async () => {
    const fetchMock = jest.fn(); global.fetch = fetchMock as typeof fetch;
    const app = express(); app.use(createDraftReviewRouter());
    const result = await request(app).get('/api/draft-review/evidence').query({ player_ids: '7526,9997' });
    expect(result.status).toBe(200);
    expect(result.body.players.map((p: { player_id: string }) => p.player_id)).toEqual(['7526', '9997']);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.headers['x-frame-options']).toBe('DENY');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test.each(['', '1,2,3,4', '../7526', 'name_exact', '1,,2', '1,2,', '1,2, 3', '1,2,abc'])('rejects invalid selection %s', async (player_ids) => {
    const app = express(); app.use(createDraftReviewRouter());
    const result = await request(app).get('/api/draft-review/evidence').query({ player_ids });
    expect(result.status).toBe(400);
  });
});

 test.each(['7526', '7526,9997,999999999999', '7526,9997,GB'])('supports bounded one-to-three IDs without source calls: %s', async (player_ids) => {
   const fetchMock = jest.fn(); global.fetch = fetchMock as typeof fetch;
   const app = express(); app.use(createDraftReviewRouter());
   const result = await request(app).get('/api/draft-review/evidence').query({ player_ids });
   expect(result.status).toBe(200);
   expect(result.headers['cache-control']).toBe('no-store');
   expect(result.body.players.map((p: { player_id: string }) => p.player_id)).toEqual(player_ids.split(','));
   if (player_ids.endsWith('999999999999')) expect(result.body.players[2].status).toBe('unavailable');
   expect(fetchMock).not.toHaveBeenCalled();
 });

describe('unrostered TE route', () => {
  test('validates input and rejects duplicate query parameters without a source read', async () => {
    const mock = jest.fn(); global.fetch = mock as typeof fetch;
    const app = express(); app.use(createDraftReviewRouter());
    for (const suffix of ['', '?sleeper_url=123', '?sleeper_url=x&sleeper_url=y']) {
      const result = await request(app).get(`/api/draft-review/unrostered-tes${suffix}`);
      expect(result.status).toBe(400);
      expect(result.headers['cache-control']).toBe('no-store');
    }
    expect(mock).not.toHaveBeenCalled();
  });
  test('returns minimal candidate observation or sanitized incomplete-source error', async () => {
    let complete = true;
    global.fetch = jest.fn(async input => {
      const url = String(input);
      return { ok: true, json: async () => url.endsWith('/players/nfl') ? { '55': { position: 'TE' } }
        : url.endsWith('/rosters') ? [{ roster_id: 1, owner_id: 'not-exported', players: [] }]
        : { league_id: '123', season: '2026', total_rosters: complete ? 1 : 2 } } as Response;
    }) as typeof fetch;
    const app = express(); app.use(createDraftReviewRouter());
    const get = () => request(app).get('/api/draft-review/unrostered-tes').query({ sleeper_url: 'https://sleeper.com/roster/123/1' });
    const result = await get();
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.headers['x-frame-options']).toBe('DENY');
    expect(result.body.candidates[0].player_id).toBe('55');
    expect(JSON.stringify(result.body)).not.toContain('not-exported');
    complete = false;
    const unavailable = await get();
    expect(unavailable.status).toBe(502);
    expect(unavailable.body.status).toBe('source_unavailable');
    expect(unavailable.body).not.toHaveProperty('candidates');
  });
  test('rate-limit responses are no-store and do not fetch sources', async () => {
    const mock = jest.fn(); global.fetch = mock as typeof fetch;
    const app = express(); app.use(createDraftReviewRouter());
    let result;
    for (let i = 0; i < 31; i++) result = await request(app).get('/api/draft-review/unrostered-tes');
    expect(result!.status).toBe(429);
    expect(result!.headers['cache-control']).toBe('no-store');
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('Weekly matchup route', () => {
  test('rejects invalid weeks before fetch and sanitizes source failures with no-store', async () => {
    const fetchMock = jest.fn(async () => { throw new Error('private source detail'); });
    global.fetch = fetchMock as typeof fetch;
    const app = express(); app.use(createDraftReviewRouter());
    const query = { sleeper_url: 'https://sleeper.com/roster/123/1', season: '2026', week: '19' };
    const invalid = await request(app).get('/api/draft-review/matchup').query(query);
    expect(invalid.status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
    const failed = await request(app).get('/api/draft-review/matchup').query({ ...query, week: '1' });
    expect(failed.status).toBe(502); expect(failed.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(failed.body)).not.toContain('private source detail');
  });
});
