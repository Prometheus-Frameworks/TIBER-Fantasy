import { buildHistoricalCatalog } from '../modules/draftReview/historicalCatalog';
import { buildWaiverCandidates } from '../modules/draftReview/waiverCandidates';
import { weeklyEvidenceFor } from '../modules/externalModels/weeklyBoxscore/weeklyBoxscore';
import { exposureInput } from '@shared/teamExposure';
import { buildExposure } from '../modules/draftReview/teamExposure';
import { managerResultInput } from '@shared/teamManager';
import { buildManagerResult } from '../modules/draftReview/teamManager';
import { buildWrReplacement } from '../modules/draftReview/wrReplacement';
import { buildWeeklyMatchup } from '../modules/draftReview/weeklyMatchup';
import { historicalEvidenceFor } from '../modules/draftReview/historicalEvidence';
import { buildUnrosteredTes } from '../modules/draftReview/unrosteredTes';
import { discoverTeamLeagues, findTeamLeagueRosters } from '../modules/draftReview/teamLeagues';
import { publicLeaguesInput, publicLeagueRosterInput } from '@shared/teamLeagues';
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

  router.get('/api/draft-review/data', (_req, res, next) => {
    res.set('Cache-Control', 'no-store'); next();
  }, rateLimiters.publicDraftReview, async (_req, res) => {
    try { return res.json(await buildHistoricalCatalog()); }
    catch { return res.status(502).json({ error: 'Historical catalog could not be loaded.' }); }
  });

  router.get('/api/draft-review/weekly', (_req, res, next) => {
    res.set('Cache-Control', 'no-store'); next();
  }, rateLimiters.publicDraftReview, (req, res) => {
    const { season, week } = req.query;
    if (typeof season !== 'string' || !/^(19|20|21|22)\d{2}$/.test(season)
        || Number(season) > 2200 || typeof week !== 'string' || !/^(?:[1-9]|1[0-8])$/.test(week)) {
      return res.status(400).json({ status: 'invalid_input', error: 'Explicit REG season and week 1–18 required.' });
    }
    return res.json(weeklyEvidenceFor(Number(season), Number(week)));
  });

  router.get('/api/draft-review/waiver-candidates', (_req, res, next) => {
    res.set('Cache-Control', 'no-store'); next();
  }, rateLimiters.publicDraftReview, async (req, res) => {
    const input = req.query.sleeper_url;
    if (typeof input !== 'string' || !input.trim() || input.length > 256) return res.status(400).json({ status: 'invalid_input', error: 'A bounded sleeper_url is required.' });
    try { return res.json(await buildWaiverCandidates(input)); }
    catch (error) {
      if (error instanceof DraftReviewInputError) return sendSanitizedError(res, error);
      return res.status(502).json({ status: 'source_unavailable', error: 'Candidate membership could not be established from complete league and player data.' });
    }
  });

  router.get('/api/draft-review/manager-players', (_req, res, next) => {
    res.set('Cache-Control', 'no-store'); next();
  }, rateLimiters.publicDraftReview, async (req, res) => {
    if (!exposureInput.safeParse(req.query).success) return res.status(400).json({ status: 'invalid_input', error: 'Choose a valid account, league and season.' });
    try { return res.json(await buildExposure(req.query)); }
    catch { return res.status(502).json({ status: 'source_unavailable', error: 'Player exposure could not be refreshed from Sleeper.' }); }
  });

  router.get('/api/draft-review/manager-week', (_req, res, next) => {
    res.set('Cache-Control', 'no-store'); next();
  }, rateLimiters.publicDraftReview, async (req, res) => {
    if (!managerResultInput.safeParse(req.query).success) {
      return res.status(400).json({ status: 'invalid_input', error: 'Choose a valid account, league, season and week.' });
    }
    try { return res.json(await buildManagerResult(req.query)); }
    catch { return res.status(502).json({ status: 'source_unavailable', error: 'Weekly results could not be refreshed from Sleeper.' }); }
  });

  router.get(['/api/draft-review/leagues', '/api/draft-review/league-rosters'], (_req, res, next) => {
    res.set('Cache-Control', 'no-store'); next();
  }, rateLimiters.publicDraftReview, async (req, res) => {
    const listing = req.path === '/api/draft-review/leagues';
    const input = (listing ? publicLeaguesInput : publicLeagueRosterInput).safeParse(req.query);
    if (!input.success) return res.status(400).json({ status: 'invalid_input', error: 'Enter a valid Sleeper account and season, or league selection.' });
    try {
      const value = listing
        ? await discoverTeamLeagues((input.data as { account: string }).account, input.data.season)
        : await findTeamLeagueRosters((input.data as { userId: string }).userId, (input.data as { leagueId: string }).leagueId, input.data.season);
      return res.json(value);
    } catch {
      return res.status(502).json({ status: 'source_unavailable', error: 'Sleeper league information is unavailable. Try again shortly.' });
    }
  });

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
