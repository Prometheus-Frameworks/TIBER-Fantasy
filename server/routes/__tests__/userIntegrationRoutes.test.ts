jest.mock('../../storage', () => ({ storage: {} }));
jest.mock('../../integrations/sleeperClient', () => ({ sleeperClient: {} }));

import express from 'express';
import { AddressInfo } from 'net';
import { createUserIntegrationRouter } from '../userIntegrationRoutes';

describe('user integration routes', () => {
  const mockStorage = {
    getUserPlatformProfile: jest.fn(),
    upsertUserPlatformProfile: jest.fn(),
  } as any;

  const mockSleeperClient = {
    getUser: jest.fn(),
  } as any;

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(createUserIntegrationRouter({ storage: mockStorage, sleeperClient: mockSleeperClient } as any));
    return app;
  }

  async function call(app: express.Express, method: string, path: string, body?: any) {
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json();
    server.close();
    return { status: response.status, body: json };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getUserPlatformProfile.mockResolvedValue(null);
    mockStorage.upsertUserPlatformProfile.mockResolvedValue({ id: 'p1', external_user_id: '123', username: 'demo' });
    mockSleeperClient.getUser.mockResolvedValue({ user_id: '123', username: 'demo', display_name: 'DemoUser' });
  });

  it('links a sleeper user by username lookup', async () => {
    const app = buildApp();
    const res = await call(app, 'POST', '/api/user-integrations/sleeper', { user_id: 'default_user', usernameOrUserId: 'demo' });

    expect(res.status).toBe(200);
    expect(mockSleeperClient.getUser).toHaveBeenCalledWith('demo');
    expect(mockStorage.upsertUserPlatformProfile).toHaveBeenCalledWith(
      expect.objectContaining({ externalUserId: '123', username: 'demo' })
    );
    expect(res.body.profile.external_user_id || res.body.profile.externalUserId).toBe('123');
  });

  it('returns existing profile on GET', async () => {
    mockStorage.getUserPlatformProfile.mockResolvedValue({ external_user_id: '777', username: 'linked' });
    const app = buildApp();
    const res = await call(app, 'GET', '/api/user-integrations/sleeper?user_id=default_user');

    expect(res.status).toBe(200);
    expect(res.body.profile.username).toBe('linked');
  });
});
