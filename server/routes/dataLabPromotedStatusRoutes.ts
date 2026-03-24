import { Router } from 'express';
import { z } from 'zod';
import { PromotedModelStatusService, promotedModelStatusService } from '../modules/externalModels/promotedModelStatusService';

const statusQuerySchema = z.object({
  season: z.coerce.number().int().min(2000).max(2100).optional(),
});

export function createDataLabPromotedStatusRouter(service: PromotedModelStatusService = promotedModelStatusService) {
  const router = Router();

  router.get('/promoted-status', async (req, res) => {
    const parsed = statusQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`).join('; '),
      });
    }

    try {
      const data = await service.getStatusReport({ season: parsed.data.season });
      return res.json({
        success: true,
        data,
        meta: {
          module: 'data-lab-promoted-status',
          adapter: 'promoted-model-status-orchestrator',
          readOnly: true,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[DataLabPromotedStatusRoutes] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected promoted status error.',
      });
    }
  });

  return router;
}

export const dataLabPromotedStatusRouter = createDataLabPromotedStatusRouter();
