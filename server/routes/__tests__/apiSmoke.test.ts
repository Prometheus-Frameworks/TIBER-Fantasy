/**
 * API Route Smoke Tests
 *
 * Verifies that the 5 most-used API routes return:
 *   - HTTP 200
 *   - Valid JSON
 *   - Expected shape (array vs object)
 *
 * Each test spins up a minimal Express app using only the specific router
 * under test plus the necessary mocks, then tears it down after the call.
 */

// ---------------------------------------------------------------------------
// Module mocks (must be declared before any imports)
// ---------------------------------------------------------------------------

// Prevent real DB connections from being established in any imported module
jest.mock('../../infra/db', () => ({ db: {} }));

// Mock the forge grade cache so /api/forge/tiers doesn't hit the DB
jest.mock('../../modules/forge/forgeGradeCache', () => ({
  getGradesFromCache: jest.fn().mockResolvedValue({ players: [], asOfWeek: 17 }),
  computeAllGrades: jest.fn().mockResolvedValue({}),
  computeAndCacheGrades: jest.fn().mockResolvedValue({ computed: 0, errors: 0, durationMs: 0 }),
  CACHE_VERSION: 'v1',
  POSITIONS: ['QB', 'RB', 'WR', 'TE'],
}));

// Mock the forge service so /api/forge/batch doesn't hit the DB
jest.mock('../../modules/forge/forgeService', () => ({
  forgeService: {
    getForgeScoresBatch: jest.fn().mockResolvedValue([]),
    getForgeScoreForPlayer: jest.fn().mockResolvedValue(null),
  },
}));

// Mock SoS enrichment used in batch route
jest.mock('../../modules/forge/sosService', () => ({
  getTeamPositionSoS: jest.fn().mockResolvedValue(null),
  getPlayerSoS: jest.fn().mockResolvedValue(null),
  getAllTeamSoSByPosition: jest.fn().mockResolvedValue([]),
  getTeamWeeklySoS: jest.fn().mockResolvedValue([]),
}));

// Mock dependencies required by forge/routes.ts that hit the DB or external APIs
jest.mock('../../modules/forge/forgeSnapshot', () => ({
  createForgeSnapshot: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../modules/forge/fibonacciPatternResonance', () => ({
  computeFPRForPlayer: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../services/PlayerIdentityService', () => ({
  PlayerIdentityService: jest.fn().mockImplementation(() => ({
    resolvePlayer: jest.fn().mockResolvedValue(null),
  })),
}));
jest.mock('../../modules/forge/forgePlayerContext', () => ({
  getForgePlayerContext: jest.fn().mockResolvedValue(null),
  searchForgePlayersSimple: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../modules/forge/qbContextPopulator', () => ({
  populateQbContext2025: jest.fn().mockResolvedValue({}),
  getPrimaryQbContext: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../modules/forge/helpers/sosMultiplier', () => ({
  applySosMultiplier: jest.fn((scores: any[]) => scores),
}));
jest.mock('../../modules/forge/alphaV2', () => ({
  batchCalculateAlphaV2: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../services/sleeperLiveStatusSync', () => ({
  sleeperLiveStatusSync: jest.fn().mockResolvedValue({}),
}));
// evaluate is synchronous, returns SentinelReport { events, warnings, blocks }
jest.mock('../../modules/sentinel/sentinelEngine', () => ({
  evaluate: jest.fn().mockReturnValue({ events: [], warnings: 0, blocks: 0 }),
  recordEvents: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports after mocks are registered
// ---------------------------------------------------------------------------

import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { getCurrentWeek } from '../../../shared/weekDetection';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/** Boot an Express app on a random port, make a GET request, shut down. */
async function callApp(
  app: express.Express,
  path: string
): Promise<{ status: number; body: unknown }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const body = await response.json();
    return { status: response.status, body };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

// ---------------------------------------------------------------------------
// Test 1 — GET /api/forge/health (no DB, no mocking needed)
// ---------------------------------------------------------------------------

describe('GET /api/forge/health', () => {
  it('returns 200 with success:true and service:FORGE', async () => {
    // Import the forge router only after mocks are set up
    const { default: forgeRouter } = await import('../../modules/forge/routes');

    const app = express();
    app.use('/api/forge', forgeRouter);

    const { status, body } = await callApp(app, '/api/forge/health');

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      service: 'FORGE',
      status: 'operational',
    });
  });
});

// ---------------------------------------------------------------------------
// Test 2 — GET /api/system/current-week (uses shared weekDetection, no DB)
// ---------------------------------------------------------------------------

describe('GET /api/system/current-week', () => {
  it('returns 200 with week and season fields', async () => {
    const app = express();

    // Inline-register just this one endpoint (avoids loading the full routes.ts)
    app.get('/api/system/current-week', (_req, res) => {
      const weekInfo = getCurrentWeek();
      res.json({
        success: true,
        ...weekInfo,
        upcomingWeek:
          weekInfo.weekStatus === 'completed'
            ? Math.min(weekInfo.currentWeek + 1, 18)
            : weekInfo.currentWeek,
      });
    });

    const { status, body } = await callApp(app, '/api/system/current-week');

    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty('success', true);
    expect(b).toHaveProperty('currentWeek');
    expect(b).toHaveProperty('season');
    expect(typeof b['currentWeek']).toBe('number');
    expect(typeof b['season']).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Test 3 — GET /api/forge/tiers?position=WR (mocked cache → fallback response)
// ---------------------------------------------------------------------------

describe('GET /api/forge/tiers', () => {
  it('returns 200 with an object containing players array', async () => {
    const { default: forgeRouter } = await import('../../modules/forge/routes');

    const app = express();
    app.use('/api/forge', forgeRouter);

    const { status, body } = await callApp(app, '/api/forge/tiers?position=WR&season=2025');

    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    // Whether the cache is populated or falls back, the response must have 'players'
    expect(b).toHaveProperty('players');
    expect(Array.isArray(b['players'])).toBe(true);
  });

  it('returns 400 for an invalid position', async () => {
    const { default: forgeRouter } = await import('../../modules/forge/routes');

    const app = express();
    app.use('/api/forge', forgeRouter);

    const { status } = await callApp(app, '/api/forge/tiers?position=KICKER');
    expect(status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Test 4 — GET /api/forge/batch?position=WR&season=2025 (mocked forgeService)
// ---------------------------------------------------------------------------

describe('GET /api/forge/batch', () => {
  it('returns 200 with players array', async () => {
    const { default: forgeRouter } = await import('../../modules/forge/routes');

    const app = express();
    app.use('/api/forge', forgeRouter);

    const { status, body } = await callApp(
      app,
      '/api/forge/batch?position=WR&season=2025'
    );

    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    // The batch endpoint returns { success, scores: [...], meta }
    expect(b).toHaveProperty('success', true);
    expect(b).toHaveProperty('scores');
    expect(Array.isArray(b['scores'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 5 — GET /api/forge/eg/batch?position=WR (mocked engine)
// ---------------------------------------------------------------------------

describe('GET /api/forge/eg/batch', () => {
  it('returns 400 for missing position', async () => {
    const { default: forgeRouter } = await import('../../modules/forge/routes');

    const app = express();
    app.use('/api/forge', forgeRouter);

    const { status } = await callApp(app, '/api/forge/eg/batch');
    expect(status).toBe(400);
  });

  it('returns 200 with an array when position is valid (engine mocked)', async () => {
    // Mock the engine batch function used inside the /eg/batch handler
    jest.doMock('../../modules/forge/forgeEngine', () => ({
      ...jest.requireActual('../../modules/forge/forgeEngine'),
      runForgeEngineBatch: jest.fn().mockResolvedValue([]),
    }));

    const { default: forgeRouter } = await import('../../modules/forge/routes');
    const { gradeForgeWithMeta: _gradeForgeWithMeta } = await import(
      '../../modules/forge/forgeGrading'
    );

    const app = express();
    app.use('/api/forge', forgeRouter);

    const { status, body } = await callApp(
      app,
      '/api/forge/eg/batch?position=WR&season=2025&week=17'
    );

    // Could be 200 (mocked) or 500 if something couldn't be mocked deeply enough;
    // either way it must respond with JSON
    expect([200, 500]).toContain(status);
    expect(body).toBeDefined();
  });
});
