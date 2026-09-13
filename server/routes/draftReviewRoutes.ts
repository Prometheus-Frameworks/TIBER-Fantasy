import { buildWrReplacement } from '../modules/draftReview/wrReplacement';
import { buildWeeklyMatchup } from '../modules/draftReview/weeklyMatchup';
import { historicalEvidenceFor } from '../modules/draftReview/historicalEvidence';
import { buildUnrosteredTes } from '../modules/draftReview/unrosteredTes';
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

  router.get('/api/draft-review/wr-replacement', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, rateLimiters.publicDraftReview, async (req, res) => {
    const { sleeper_url, target_player_id } = req.query;
    if (typeof sleeper_url !== 'string' || !sleeper_url.trim() || sleeper_url.length > 256 || typeof target_player_id !== 'string' || !/^\d{1,24}$/.test(target_player_id)) return res.status(400).json({ status: 'invalid_input', error: 'A bounded roster URL and exact target player ID are required.' });
    try { return res.json(await buildWrReplacement(sleeper_url, target_player_id)); }
    catch (error) {
      if (error instanceof DraftReviewInputError) return sendSanitizedError(res, error);
      return res.status(502).json({ status: 'source_unavailable', error: 'A complete WR replacement pool could not be established. Refresh your roster and retry.' });
    }
  });

  router.get('/api/draft-review/matchup', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, rateLimiters.publicDraftReview, async (req, res) => {
    const { sleeper_url, season, week } = req.query;
    if (typeof sleeper_url !== 'string' || sleeper_url.length > 256 || typeof season !== 'string' || !/^\d{4}$/.test(season) || typeof week !== 'string' || !/^(?:[1-9]|1[0-8])$/.test(week)) return res.status(400).json({ status: 'invalid_input', error: 'A roster URL, season and week from 1 to 18 are required.' });
    try { return res.json(await buildWeeklyMatchup(sleeper_url, season, Number(week))); }
    catch (error) {
      if (error instanceof DraftReviewInputError) return sendSanitizedError(res, error);
      return res.status(502).json({ status: 'source_unavailable', error: 'A complete head-to-head matchup could not be established. Try another week or refresh shortly.' });
    }
  });

  router.get('/api/draft-review/unrostered-tes', (_req, res, next) => {
    res.set('Cache-Control', 'no-store'); next();
  }, rateLimiters.publicDraftReview, async (req, res) => {
    const input = req.query.sleeper_url;
    if (typeof input !== 'string' || !input.trim() || input.length > 256) {
      return res.status(400).json({ status: 'invalid_input', error: 'A bounded sleeper_url is required.' });
    }
    try {
      return res.json(await buildUnrosteredTes(input));
    } catch (error) {
      if (error instanceof DraftReviewInputError) return sendSanitizedError(res, error);
      return res.status(502).json({ status: 'source_unavailable', error: 'TE availability could not be established from complete league and player data. Try again shortly.' });
    }
  });

  router.get('/api/draft-review/evidence', rateLimiters.publicDraftReview, (req, res) => {
    res.set('Cache-Control', 'no-store');
    const input = req.query.player_ids;
    if (typeof input !== 'string' || !/^(?:\d{1,24}|[A-Z]{2,3})(?:,(?:\d{1,24}|[A-Z]{2,3})){0,2}$/.test(input)) {
      return res.status(400).json({ status: 'invalid_input', error: 'player_ids must contain one to three exact Sleeper player IDs.' });
    }
    return res.json(historicalEvidenceFor(input.split(',')));
  });

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
