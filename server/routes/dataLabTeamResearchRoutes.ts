import { Router } from 'express';
import { z } from 'zod';
import { TeamResearchService, teamResearchService } from '../modules/externalModels/teamResearch/teamResearchService';

const teamResearchQuerySchema = z.object({
  season: z.coerce.number().int().min(2000).max(2100).optional(),
  team: z.string().trim().min(1).optional(),
});

export function createDataLabTeamResearchRouter(service: TeamResearchService = teamResearchService) {
  const router = Router();

  router.get('/team-research', async (req, res) => {
    const parsed = teamResearchQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`).join('; '),
      });
    }

    try {
      const data = await service.getTeamResearchWorkspace({
        season: parsed.data.season,
        team: parsed.data.team,
      });

      return res.json({
        success: true,
        data,
        meta: {
          module: 'team-research-workspace',
          adapter: 'team-research-orchestrator',
          readOnly: true,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[DataLabTeamResearchRoutes] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected Team Research workspace error.',
      });
    }
  });

  return router;
}

export const dataLabTeamResearchRouter = createDataLabTeamResearchRouter();
