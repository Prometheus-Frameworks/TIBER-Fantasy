import express from 'express';
import { rateLimiters } from '../middleware/rateLimit';
import { buildDraftReview } from '../modules/draftReview/draftReviewService';

export function createDraftReviewRouter() {
  const router = express.Router();

  router.get('/api/draft-review', rateLimiters.publicDraftReview, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const sleeperUrl = typeof req.query.sleeper_url === 'string' ? req.query.sleeper_url : '';
    if (!sleeperUrl.trim()) {
      return res.status(400).json({
        status: 'invalid_input',
        error: 'sleeper_url is required.',
      });
    }

    try {
      return res.json(await buildDraftReview(sleeperUrl));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Draft Review could not read this roster.';
      const isInputError = /required|complete|only public|ending in|positive integer|not found/i.test(message);
      return res.status(isInputError ? 400 : 502).json({
        status: isInputError ? 'invalid_input' : 'source_unavailable',
        error: isInputError ? message : 'Sleeper is temporarily unavailable. Try again shortly.',
      });
    }
  });

  return router;
}

export const draftReviewRouter = createDraftReviewRouter();
