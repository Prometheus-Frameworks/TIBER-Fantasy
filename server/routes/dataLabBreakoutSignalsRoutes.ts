import express from 'express';
import { z } from 'zod';
import {
  SignalValidationService,
  signalValidationService,
} from '../modules/externalModels/signalValidation/signalValidationService';
import { buildPromotedModuleOperatorDetails } from '../modules/externalModels/promotedModuleOperator';
import { SignalValidationIntegrationError } from '../modules/externalModels/signalValidation/types';

const querySchema = z.object({
  season: z.coerce.number().int().min(2000).max(2100).optional(),
  includeRawCanonical: z.union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')]).optional(),
});

export function createDataLabBreakoutSignalsRouter(service: SignalValidationService = signalValidationService) {
  const router = express.Router();

  router.get('/breakout-signals', async (req, res) => {
    try {
      const parsed = querySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'season must be a valid season when provided.',
          details: parsed.error.flatten(),
        });
      }

      const data = await service.getWrBreakoutLab(parsed.data.season, {
        includeRawCanonical: parsed.data.includeRawCanonical === '1' || parsed.data.includeRawCanonical === 'true',
      });

      return res.json({
        success: true,
        data: {
          ...data,
          state: data.rows.length === 0 ? 'empty' : 'ready',
        },
        meta: {
          module: 'wr-breakout-lab',
          adapter: 'external-model-adapter-v1',
          readOnly: true,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof SignalValidationIntegrationError) {
        const status = service.getStatus();
        return res.status(error.status).json({
          success: false,
          error: error.message,
          code: error.code,
          operator: buildPromotedModuleOperatorDetails({
            moduleLabel: 'WR Breakout Lab',
            dependencySummary: 'Depends on promoted Signal-Validation-Model WR exports being readable from the configured export directory.',
            errorCode: error.code,
            status,
          }),
        });
      }

      console.error('[DataLabBreakoutSignalsRoutes] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unexpected WR breakout lab failure.',
      });
    }
  });

  return router;
}

export const dataLabBreakoutSignalsRouter = createDataLabBreakoutSignalsRouter();
