import express from 'express';
import { z } from 'zod';
import { buildPromotedModuleOperatorDetails } from '../modules/externalModels/promotedModuleOperator';
import { AgeCurvesService, ageCurvesService } from '../modules/externalModels/ageCurves/ageCurvesService';
import { AgeCurveIntegrationError } from '../modules/externalModels/ageCurves/types';

const querySchema = z.object({
  season: z.coerce.number().int().min(2000).max(2100).optional(),
  includeRawCanonical: z.union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')]).optional(),
});

export function createDataLabAgeCurvesRouter(service: AgeCurvesService = ageCurvesService) {
  const router = express.Router();

  router.get('/age-curves', async (req, res) => {
    try {
      const parsed = querySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'season must be a valid season when provided.',
          details: parsed.error.flatten(),
        });
      }

      const data = await service.getAgeCurveLab(
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
          module: 'age-curve-lab',
          adapter: 'external-model-adapter-v1',
          readOnly: true,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof AgeCurveIntegrationError) {
        const status = service.getStatus();
        return res.status(error.status).json({
          success: false,
          error: error.message,
          code: error.code,
          operator: buildPromotedModuleOperatorDetails({
            moduleLabel: 'Age Curve / ARC Lab',
            dependencySummary: 'Depends on either ARC compatibility payloads or a promoted age-curve artifact path.',
            errorCode: error.code,
            status,
          }),
        });
      }

      console.error('[DataLabAgeCurvesRoutes] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unexpected Age Curve Lab failure.',
      });
    }
  });

  return router;
}

export const dataLabAgeCurvesRouter = createDataLabAgeCurvesRouter();
