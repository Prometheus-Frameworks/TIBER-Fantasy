import express from 'express';
import { z } from 'zod';
import { buildPromotedModuleOperatorDetails } from '../modules/externalModels/promotedModuleOperator';
import { RoleOpportunityService, roleOpportunityService } from '../modules/externalModels/roleOpportunity/roleOpportunityService';
import { RoleOpportunityIntegrationError } from '../modules/externalModels/roleOpportunity/types';

const querySchema = z.object({
  season: z.coerce.number().int().min(2000).max(2100).optional(),
  week: z.coerce.number().int().min(1).max(25).optional(),
  includeRawCanonical: z.union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')]).optional(),
});

export function createDataLabRoleOpportunityRouter(service: RoleOpportunityService = roleOpportunityService) {
  const router = express.Router();

  router.get('/role-opportunity', async (req, res) => {
    try {
      const parsed = querySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'season and week must be valid numbers when provided.',
          details: parsed.error.flatten(),
        });
      }

      const data = await service.getRoleOpportunityLab(
        {
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
          ...data,
          state: data.rows.length === 0 ? 'empty' : 'ready',
        },
        meta: {
          module: 'role-opportunity-lab',
          adapter: 'external-model-adapter-v1',
          readOnly: true,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof RoleOpportunityIntegrationError) {
        const status = service.getStatus();
        return res.status(error.status).json({
          success: false,
          error: error.message,
          code: error.code,
          operator: buildPromotedModuleOperatorDetails({
            moduleLabel: 'Role & Opportunity Lab',
            dependencySummary: 'Depends on either the Role-and-opportunity-model compatibility API or a promoted exported artifact path.',
            errorCode: error.code,
            status,
          }),
        });
      }

      console.error('[DataLabRoleOpportunityRoutes] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unexpected Role Opportunity Lab failure.',
      });
    }
  });

  return router;
}

export const dataLabRoleOpportunityRouter = createDataLabRoleOpportunityRouter();
