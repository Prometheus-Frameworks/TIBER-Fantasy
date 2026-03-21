import express from 'express';
import { z } from 'zod';
import { ForgeCompareService, forgeCompareService } from '../modules/externalModels/forge/forgeCompareService';
import { ForgeService, forgeService } from '../modules/externalModels/forge/forgeService';
import { ForgeParityReportService, forgeParityReportService } from '../modules/externalModels/forge/forgeParityReportService';
import { forgeComparisonRequestSchema } from '../modules/externalModels/forge/types';

const requestSchema = forgeComparisonRequestSchema.extend({
  includeRawCanonical: z.boolean().optional().default(false),
});

export function createForgeIntegrationRouter(
  compareService: Pick<ForgeCompareService, 'compare'> = forgeCompareService,
  service: Pick<ForgeService, 'getStatus'> = forgeService,
  parityReportService: Pick<ForgeParityReportService, 'generateReport'> = forgeParityReportService,
) {
  const router = express.Router();

  router.get('/api/integrations/forge/health', (_req, res) => {
    const status = service.getStatus();
    res.status(status.readiness === 'ready' ? 200 : 503).json({
      success: status.readiness === 'ready',
      integration: 'forge',
      migrationMode: 'dual_run_compare_only',
      ...status,
    });
  });


  router.get('/api/integrations/forge/parity-report', async (_req, res) => {
    try {
      const report = await parityReportService.generateReport();

      return res.json({
        success: true,
        data: report,
        meta: {
          integration: 'forge',
          adapter: 'external-model-adapter-v1',
          mode: 'migration_parity_report',
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[ForgeIntegrationRoutes] Unexpected parity report error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unexpected FORGE parity report failure.',
      });
    }
  });

  router.post('/api/integrations/forge/compare', async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid FORGE comparison request.',
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await compareService.compare(parsed.data);

      return res.json({
        success: true,
        data: result,
        meta: {
          integration: 'forge',
          adapter: 'external-model-adapter-v1',
          mode: 'dual_run_compare',
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[ForgeIntegrationRoutes] Unexpected compare error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unexpected FORGE comparison failure.',
      });
    }
  });

  return router;
}

export const forgeIntegrationRouter = createForgeIntegrationRouter();
