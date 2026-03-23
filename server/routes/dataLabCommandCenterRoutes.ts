import { Router } from 'express';
import { z } from 'zod';
import { DataLabCommandCenterService, dataLabCommandCenterService } from '../modules/externalModels/dataLabCommandCenter/service';

const commandCenterQuerySchema = z.object({
  season: z.coerce.number().int().min(2000).max(2100).optional(),
});

export function createDataLabCommandCenterRouter(service: DataLabCommandCenterService = dataLabCommandCenterService) {
  const router = Router();

  router.get('/command-center', async (req, res) => {
    const parsed = commandCenterQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`).join('; '),
      });
    }

    try {
      const data = await service.getCommandCenter({ season: parsed.data.season });
      return res.json({
        success: true,
        data,
        meta: {
          module: 'data-lab-command-center',
          adapter: 'data-lab-command-center-orchestrator',
          readOnly: true,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[DataLabCommandCenterRoutes] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected Data Lab Command Center error.',
      });
    }
  });

  return router;
}

export const dataLabCommandCenterRouter = createDataLabCommandCenterRouter();
