import { Router } from 'express';
import { z } from 'zod';
import {
  evaluate,
  evaluateRule,
  getEventFeed,
  getHealthSummary,
  getIssues,
  muteIssue,
  recordEvents,
} from '../modules/sentinel/sentinelEngine';
import { SentinelModule } from '../modules/sentinel/sentinelTypes';

const router = Router();

const issuesQuerySchema = z.object({
  module: z.enum(['forge', 'personnel', 'datalab', 'rolebank', 'system']).optional(),
  severity: z.enum(['info', 'warn', 'block']).optional(),
  status: z.enum(['open', 'resolved', 'muted']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const eventsQuerySchema = z.object({
  module: z.enum(['forge', 'personnel', 'datalab', 'rolebank', 'system']).optional(),
  severity: z.enum(['info', 'warn', 'block']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

router.get('/issues', async (req, res) => {
  try {
    const query = issuesQuerySchema.parse(req.query);
    const issues = await getIssues(query);
    return res.json({ issues, total: issues.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    console.error('[SentinelRoutes] /issues failed:', error);
    return res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const query = eventsQuerySchema.parse(req.query);
    const feed = await getEventFeed(query);
    return res.json(feed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    console.error('[SentinelRoutes] /events failed:', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.get('/health', async (_req, res) => {
  try {
    const summary = await getHealthSummary();
    return res.json(summary);
  } catch (error) {
    console.error('[SentinelRoutes] /health failed:', error);
    return res.status(500).json({ error: 'Failed to fetch health summary' });
  }
});

router.post('/mute/:fingerprint', async (req, res) => {
  const bodySchema = z.object({ reason: z.string().max(500).optional() });
  try {
    const { fingerprint } = req.params;
    const body = bodySchema.parse(req.body ?? {});
    await muteIssue(fingerprint, body.reason);
    return res.json({ success: true, fingerprint, muted: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid body', details: error.errors });
    }
    console.error('[SentinelRoutes] /mute failed:', error);
    return res.status(500).json({ error: 'Failed to mute issue' });
  }
});

router.post('/run/:module', async (req, res) => {
  try {
    const module = z.enum(['forge', 'personnel', 'datalab', 'rolebank', 'system']).parse(req.params.module) as SentinelModule;
    const payload = req.body?.data ?? req.body ?? {};

    const report = evaluate(module, {
      ...payload,
      _endpoint: `/api/sentinel/run/${module}`,
    });

    if (report.events.length > 0) {
      recordEvents(report.events).catch((err) => {
        console.error('[SentinelRoutes] Failed to record /run events:', err);
      });
    }

    return res.json({ report });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid module', details: error.errors });
    }
    console.error('[SentinelRoutes] /run failed:', error);
    return res.status(500).json({ error: 'Failed to run sentinel checks' });
  }
});

router.post('/run/rule/:ruleId', (req, res) => {
  const result = evaluateRule(req.params.ruleId, req.body?.data ?? req.body ?? {});
  return res.json({ result });
});

export default router;
