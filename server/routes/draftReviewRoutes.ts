import express from 'express';
import { rateLimiters } from '../middleware/rateLimit';
import { securityHeaders } from '../middleware/security';
import {
  buildDraftReview,
  DraftReviewInputError,
  resolveDraftReviewInput,
} from '../modules/draftReview/draftReviewService';

function sendSanitizedError(res: express.Response, error: unknown) {
  const isInputError = error instanceof DraftReviewInputError;
  return res.status(isInputError ? 400 : 502).json({
    status: isInputError ? 'invalid_input' : 'source_unavailable',
    error: isInputError
      ? error.message
      : 'Sleeper is temporarily unavailable. Try again shortly.',
  });
}

export function createDraftReviewRouter() {
  const router = express.Router();
  router.use('/api/draft-review', securityHeaders());

  router.get('/api/draft-review/resolve', rateLimiters.publicDraftReview, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const sleeperInput = typeof req.query.sleeper_input === 'string' ? req.query.sleeper_input : '';
    if (!sleeperInput.trim()) {
      return res.status(400).json({
        status: 'invalid_input',
        error: 'sleeper_input is required.',
      });
    }

    try {
      return res.json(await resolveDraftReviewInput(sleeperInput));
    } catch (error) {
      return sendSanitizedError(res, error);
    }
  });

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
      return sendSanitizedError(res, error);
    }
  });

  return router;
}

export const draftReviewRouter = createDraftReviewRouter();
