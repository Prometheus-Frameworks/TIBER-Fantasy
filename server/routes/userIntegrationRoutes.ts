import express from 'express';
import { sleeperClient } from '../integrations/sleeperClient';
import { storage, type IStorage } from '../storage';

interface IntegrationDeps {
  storage: IStorage;
  sleeperClient: typeof sleeperClient;
}

const defaultDeps: IntegrationDeps = {
  storage,
  sleeperClient,
};

function looksLikeSleeperUserId(value: string) {
  return /^\d+$/.test(value);
}

export function createUserIntegrationRouter(deps: IntegrationDeps = defaultDeps) {
  const router = express.Router();

  router.get('/api/user-integrations/sleeper', async (req, res) => {
    try {
      const { user_id = 'default_user' } = req.query;
      const profile = await deps.storage.getUserPlatformProfile(user_id as string, 'sleeper');
      res.json({ success: true, profile });
    } catch (error) {
      console.error('[UserIntegration] failed to fetch profile', error);
      res.status(500).json({ success: false, error: (error as Error).message || 'Failed to load integration' });
    }
  });

  router.post('/api/user-integrations/sleeper', async (req, res) => {
    try {
      const { user_id = 'default_user', usernameOrUserId } = req.body;
      if (!usernameOrUserId) {
        return res.status(400).json({ success: false, error: 'usernameOrUserId is required' });
      }

      let externalUserId = String(usernameOrUserId);
      let username: string | null = null;

      if (!looksLikeSleeperUserId(externalUserId)) {
        const user = await deps.sleeperClient.getUser(usernameOrUserId);
        externalUserId = user.user_id;
        username = user.username ?? user.display_name ?? usernameOrUserId;
      }

      const profile = await deps.storage.upsertUserPlatformProfile({
        userId: user_id,
        platform: 'sleeper',
        externalUserId,
        username: username ?? String(usernameOrUserId),
      });

      res.json({ success: true, profile });
    } catch (error) {
      console.error('[UserIntegration] failed to link profile', error);
      res.status(500).json({ success: false, error: (error as Error).message || 'Failed to link integration' });
    }
  });

  return router;
}

export const userIntegrationRouter = createUserIntegrationRouter();
