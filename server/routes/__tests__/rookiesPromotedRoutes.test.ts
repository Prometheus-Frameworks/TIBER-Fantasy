import express from 'express';
import { AddressInfo } from 'net';
import { createRookiesPromotedRouter } from '../rookiesPromotedRoutes';
import { RookieIntegrationError } from '../../modules/externalModels/rookies/types';

async function call(app: express.Express, path: string) {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    server.close();
  }
}

describe('promoted rookies routes', () => {
  it('returns promoted rookie rows for the requested season', async () => {
    const service = {
      getRookieBoard: jest.fn().mockResolvedValue({
        season: 2026,
        count: 1,
        model: { name: 'Rookie Alpha', version: 'v2', promotedAt: null, generatedAt: null, sourcePath: '/tmp/mock.json' },
        players: [
          {
            rank: 1,
            player_id: null,
            player_name: 'Test Rookie',
            position: 'WR',
            school: 'State U',
            proj_round: 1,
            rookie_rank: 1,
            rookie_alpha: 85,
            rookie_tier: 'T1',
            tiber_ras_v1: 8.8,
            tiber_ras_v2: 9.2,
            production_score: 74,
            dominator_rating: 34,
            college_target_share: 31,
            college_ypc: null,
            draft_capital_score: 100,
            athleticism_score: 92,
            height_inches: 73,
            weight_lbs: 203,
            forty_yard_dash: 4.42,
            ten_yard_split: 1.51,
            vertical_jump: 38,
            broad_jump: 126,
            three_cone: 6.8,
            short_shuttle: 4.1,
            profile_summary: 'Vertical WR',
            identity_note: null,
            board_summary: null,
          },
        ],
      }),
    };

    const app = express();
    app.use('/api/rookies', createRookiesPromotedRouter(service as any));

    const res = await call(app, '/api/rookies/2026?position=WR&sort_by=rookie_alpha');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.model.name).toBe('Rookie Alpha');
    expect(service.getRookieBoard).toHaveBeenCalledWith({ season: 2026, sortBy: 'rookie_alpha', position: 'WR' });
  });

  it('surfaces missing-artifact failures with stable error code', async () => {
    const service = {
      getRookieBoard: jest
        .fn()
        .mockRejectedValue(new RookieIntegrationError('not_found', 'missing artifact', 404)),
    };

    const app = express();
    app.use('/api/rookies', createRookiesPromotedRouter(service as any));

    const res = await call(app, '/api/rookies/2026');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
    expect(res.body.guidance).toContain('ROOKIE_PROMOTED_ARTIFACT_PATH');
  });
});
