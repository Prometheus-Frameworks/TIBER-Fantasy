import { Router } from 'express';
import { z } from 'zod';
import { PlayerOwnershipService, playerOwnershipService } from '../modules/externalModels/playerOwnership/playerOwnershipService';

const booleanQuerySchema = z
  .enum(['0', '1', 'true', 'false'])
  .optional()
  .transform((value) => (value == null ? undefined : value === '1' || value === 'true'));

const playerOwnershipQuerySchema = z
  .object({
    playerId: z.string().trim().min(1).optional(),
    query: z.string().trim().min(1).optional(),
    includeEvents: booleanQuerySchema,
    eventLimit: z.coerce.number().int().min(0).max(50).optional(),
  })
  .refine((value) => value.playerId || value.query, {
    message: 'Provide either playerId or query.',
    path: ['query'],
  });

export function createDataLabPlayerOwnershipRouter(service: PlayerOwnershipService = playerOwnershipService) {
  const router = Router();

  router.get('/player-ownership', async (req, res) => {
    const parsed = playerOwnershipQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`).join('; '),
      });
    }

    try {
      const data = await service.getPlayerOwnershipInsight({
        playerId: parsed.data.playerId,
        query: parsed.data.query,
        includeEvents: parsed.data.includeEvents,
        eventLimit: parsed.data.eventLimit,
      });

      return res.json({
        success: true,
        data,
        meta: {
          module: 'player-ownership',
          adapter: 'player-ownership-artifact-v0',
          readOnly: true,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[DataLabPlayerOwnershipRoutes] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected player ownership lookup error.',
      });
    }
  });

  return router;
}

export const dataLabPlayerOwnershipRouter = createDataLabPlayerOwnershipRouter();
