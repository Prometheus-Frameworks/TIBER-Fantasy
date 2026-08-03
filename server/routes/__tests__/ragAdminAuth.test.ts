import express from 'express';
import request from 'supertest';

const mockParseUrl = jest.fn();
jest.mock('rss-parser', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    parseURL: mockParseUrl,
  })),
}));

jest.mock('../rag_lexicon_enricher_team.js', () => ({
  loadLexicon: jest.fn(() => true),
  loadSynonyms: jest.fn(() => true),
  loadTeamSynonyms: jest.fn(() => true),
  enrichText: jest.fn((text: string) => ({ text, delta: 0 })),
}));

let createRagRouter: typeof import('../ragRoutes').createRagRouter;

const originalAdminApiKey = process.env.ADMIN_API_KEY;
const originalRagDb = process.env.RAG_DB;

describe('RAG admin route authentication', () => {
  beforeAll(async () => {
    process.env.RAG_DB = ':memory:';
    jest.resetModules();
    ({ createRagRouter } = await import('../ragRoutes'));
  });

  afterAll(() => {
    if (originalAdminApiKey === undefined) {
      delete process.env.ADMIN_API_KEY;
    } else {
      process.env.ADMIN_API_KEY = originalAdminApiKey;
    }

    if (originalRagDb === undefined) {
      delete process.env.RAG_DB;
    } else {
      process.env.RAG_DB = originalRagDb;
    }
  });

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/rag', createRagRouter());
    return app;
  }

  it('keeps the RAG health route public', async () => {
    delete process.env.ADMIN_API_KEY;

    const response = await request(buildApp()).get('/rag/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'healthy',
      articles: 0,
      players: 0,
    });
  });

  it('fails closed with 503 when admin authentication is not configured', async () => {
    delete process.env.ADMIN_API_KEY;

    const response = await request(buildApp()).get('/rag/admin/rag/status');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Admin functionality is not configured',
    });
  });

  it('returns 401 when the admin key is missing', async () => {
    process.env.ADMIN_API_KEY = 'rag-admin-secret';

    const response = await request(buildApp()).get('/rag/admin/rag/status');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Authentication required',
    });
  });

  it('returns 403 when the admin key is invalid', async () => {
    process.env.ADMIN_API_KEY = 'rag-admin-secret';

    const response = await request(buildApp())
      .get('/rag/admin/rag/status')
      .set('x-admin-api-key', 'wrong-secret');

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Invalid API key',
    });
  });

  it('allows a valid key to reach the protected status handler', async () => {
    process.env.ADMIN_API_KEY = 'rag-admin-secret';
    const app = buildApp();

    const statusResponse = await request(app)
      .get('/rag/admin/rag/status')
      .set('x-admin-api-key', 'rag-admin-secret');

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body).toEqual({ articles: 0, indexed: 0 });
  });

  it.each([
    ['missing', undefined, 401],
    ['invalid', 'wrong-secret', 403],
  ])(
    'blocks %s-key ingest before network, database, or reindex side effects',
    async (_label, providedKey, expectedStatus) => {
      process.env.ADMIN_API_KEY = 'rag-admin-secret';
      const app = buildApp();
      const before = await request(app)
        .get('/rag/admin/rag/status')
        .set('x-admin-api-key', 'rag-admin-secret');
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockRejectedValue(new Error('network access must remain unreachable'));
      mockParseUrl.mockRejectedValue(new Error('RSS access must remain unreachable'));

      try {
        const ingestRequest = request(app).post('/rag/admin/ingest');
        if (providedKey) {
          ingestRequest.set('x-admin-api-key', providedKey);
        }
        const ingestResponse = await ingestRequest;
        const after = await request(app)
          .get('/rag/admin/rag/status')
          .set('x-admin-api-key', 'rag-admin-secret');

        expect(ingestResponse.status).toBe(expectedStatus);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(mockParseUrl).not.toHaveBeenCalled();
        expect(after.body).toEqual(before.body);
      } finally {
        fetchSpy.mockRestore();
        mockParseUrl.mockReset();
      }
    },
  );
});
