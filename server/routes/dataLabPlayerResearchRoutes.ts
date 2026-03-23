import express from 'express';
import { z } from 'zod';
import { PlayerResearchService, playerResearchService } from '../modules/externalModels/playerResearch/playerResearchService';

const querySchema = z.object({
  season: z.coerce.number().int().min(2000).max(2100).optional(),
  playerId: z.string().trim().min(1).optional(),
  playerName: z.string().trim().min(1).optional(),
});

export function createDataLabPlayerResearchRouter(service: PlayerResearchService = playerResearchService) {
  const router = express.Router();

  router.get('/player-research', async (req, res) => {
    const parsed = querySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'season, playerId, and playerName must be valid values when provided.',
        details: parsed.error.flatten(),
      });
    }

    try {
      const data = await service.getPlayerResearchWorkspace({
        season: parsed.data.season,
        playerId: parsed.data.playerId,
        playerName: parsed.data.playerName,
      });

      return res.json({
        success: true,
        data,
        meta: {
          module: 'player-research-workspace',
          adapter: 'external-model-orchestrator-v1',
          readOnly: true,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[DataLabPlayerResearchRoutes] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unexpected Player Research Workspace failure.',
      });
    }
  });

  return router;
}

export const dataLabPlayerResearchRouter = createDataLabPlayerResearchRouter();
