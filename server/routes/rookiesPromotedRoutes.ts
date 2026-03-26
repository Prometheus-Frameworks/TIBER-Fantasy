import { Router, type Request, type Response } from 'express';
import { RookieIntegrationError, RookieSortField } from '../modules/externalModels/rookies/types';
import { RookieArtifactService, rookieArtifactService } from '../modules/externalModels/rookies/rookieArtifactService';

function parseSeason(value: string): number | null {
  const season = Number(value);
  if (!Number.isInteger(season) || season < 2000 || season > 2100) {
    return null;
  }
  return season;
}

export function createRookiesPromotedRouter(service: RookieArtifactService = rookieArtifactService) {
  const router = Router();

  router.get('/:season', async (req: Request, res: Response) => {
    const season = parseSeason(req.params.season);
    if (season == null) {
      return res.status(400).json({ error: 'Invalid season. Expected a year between 2000 and 2100.' });
    }

    const sortBy = (req.query.sort_by as RookieSortField | undefined) ?? 'rookie_alpha';
    const position = (req.query.position as string | undefined) ?? undefined;

    try {
      const board = await service.getRookieBoard({ season, sortBy, position });
      const { sourcePath: _sp, ...modelForClient } = board.model;
      return res.json({
        season: board.season,
        sort_by: sortBy,
        position: position?.toUpperCase() ?? 'ALL',
        count: board.count,
        model: modelForClient,
        players: board.players,
      });
    } catch (error) {
      if (error instanceof RookieIntegrationError) {
        return res.status(error.status).json({
          error: error.message,
          code: error.code,
          season,
          guidance:
            error.code === 'not_found'
              ? 'Set ROOKIE_PROMOTED_ARTIFACT_PATH to the validated promoted TIBER-Rookies export before deploying.'
              : undefined,
        });
      }

      return res.status(500).json({ error: 'Failed to load promoted rookie board.' });
    }
  });

  return router;
}

export const rookiesPromotedRouter = createRookiesPromotedRouter();
