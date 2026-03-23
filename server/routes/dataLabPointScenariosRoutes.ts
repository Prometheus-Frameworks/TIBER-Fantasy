import express from 'express';
import { z } from 'zod';
import { PointScenariosService, pointScenariosService } from '../modules/externalModels/pointScenarios/pointScenariosService';
import { PointScenarioIntegrationError } from '../modules/externalModels/pointScenarios/types';

const querySchema = z.object({
  season: z.coerce.number().int().min(2000).max(2100).optional(),
  includeRawCanonical: z.union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')]).optional(),
});

export function createDataLabPointScenariosRouter(service: PointScenariosService = pointScenariosService) {
  const router = express.Router();

  router.get('/point-scenarios', async (req, res) => {
    try {
      const parsed = querySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'season must be a valid season when provided.',
          details: parsed.error.flatten(),
        });
      }

      const data = await service.getPointScenarioLab(
        { season: parsed.data.season },
        { includeRawCanonical: parsed.data.includeRawCanonical === '1' || parsed.data.includeRawCanonical === 'true' },
      );

      return res.json({
        success: true,
        data: {
          ...data,
          state: data.rows.length === 0 ? 'empty' : 'ready',
        },
        meta: {
          module: 'point-scenario-lab',
          adapter: 'external-model-adapter-v1',
          readOnly: true,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof PointScenarioIntegrationError) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
          code: error.code,
        });
      }

      console.error('[DataLabPointScenariosRoutes] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unexpected Point Scenario Lab failure.',
      });
    }
  });

  return router;
}

export const dataLabPointScenariosRouter = createDataLabPointScenariosRouter();
