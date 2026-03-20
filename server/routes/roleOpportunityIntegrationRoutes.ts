import express from 'express';
import { z } from 'zod';
import { RoleOpportunityService, roleOpportunityService } from '../modules/externalModels/roleOpportunity/roleOpportunityService';
import { RoleOpportunityIntegrationError } from '../modules/externalModels/roleOpportunity/types';

const querySchema = z.object({
  season: z.coerce.number().int().min(2000).max(2100),
  week: z.coerce.number().int().min(1).max(25),
  includeRawCanonical: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
    .optional(),
});

export function createRoleOpportunityIntegrationRouter(
  service: RoleOpportunityService = roleOpportunityService,
) {
  const router = express.Router();

  router.get('/api/integrations/role-opportunity/health', (_req, res) => {
    const status = service.getStatus();
    res.status(status.readiness === 'ready' ? 200 : 503).json({
      success: status.readiness === 'ready',
      integration: 'role-opportunity',
      ...status,
    });
  });

  router.get('/api/integrations/role-opportunity/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      const parsed = querySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'season and week are required query parameters.',
          details: parsed.error.flatten(),
        });
      }

      const insight = await service.getRoleOpportunityInsight(
        {
          playerId,
          season: parsed.data.season,
          week: parsed.data.week,
        },
        {
          includeRawCanonical: parsed.data.includeRawCanonical === '1' || parsed.data.includeRawCanonical === 'true',
        },
      );

      return res.json({
        success: true,
        data: {
          playerId,
          season: parsed.data.season,
          week: parsed.data.week,
          insight,
        },
        meta: {
          integration: 'role-opportunity',
          adapter: 'external-model-adapter-v1',
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof RoleOpportunityIntegrationError) {
        return res.status(error.status).json({
          success: false,
          error: error.message,
          code: error.code,
        });
      }

      console.error('[RoleOpportunityIntegrationRoutes] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unexpected role opportunity integration failure.',
      });
    }
  });

  return router;
}

export const roleOpportunityIntegrationRouter = createRoleOpportunityIntegrationRouter();
