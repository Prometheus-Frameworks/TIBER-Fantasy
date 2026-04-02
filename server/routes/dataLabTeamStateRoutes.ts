import express from 'express';
import { z } from 'zod';
import { TeamStateService, teamStateService } from '../modules/externalModels/teamState/teamStateService';
import { TEAM_STATE_ARTIFACT_NAME, TeamStateIntegrationError } from '../modules/externalModels/teamState/types';

const querySchema = z.object({
  season: z.coerce.number().int().min(2000).max(2100),
  throughWeek: z.coerce.number().int().min(1).max(25).optional(),
});

function toStableError(code: TeamStateIntegrationError['code'] | 'invalid_request') {
  switch (code) {
    case 'not_found':
      return 'TEAM_STATE_NOT_FOUND';
    case 'invalid_payload':
      return 'TEAM_STATE_INVALID_PAYLOAD';
    case 'config_error':
      return 'TEAM_STATE_CONFIG_ERROR';
    case 'upstream_unavailable':
      return 'TEAM_STATE_UNAVAILABLE';
    default:
      return 'TEAM_STATE_INVALID_REQUEST';
  }
}

export function createDataLabTeamStateRouter(service: TeamStateService = teamStateService) {
  const router = express.Router();

  router.get('/team-state', async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        artifact: TEAM_STATE_ARTIFACT_NAME,
        error: {
          code: toStableError('invalid_request'),
          message: 'season is required and must be a valid year. throughWeek must be a positive integer when provided.',
        },
      });
    }

    try {
      const result = await service.getTeamState(parsed.data.season, parsed.data.throughWeek);
      return res.json({
        ok: true,
        artifact: TEAM_STATE_ARTIFACT_NAME,
        season: result.season,
        throughWeek: result.throughWeek,
        source: 'tiber-data',
        data: result.data,
      });
    } catch (error) {
      if (error instanceof TeamStateIntegrationError) {
        return res.status(error.status).json({
          ok: false,
          artifact: TEAM_STATE_ARTIFACT_NAME,
          season: parsed.data.season,
          throughWeek: parsed.data.throughWeek ?? null,
          error: {
            code: toStableError(error.code),
            message: error.message,
          },
        });
      }

      return res.status(500).json({
        ok: false,
        artifact: TEAM_STATE_ARTIFACT_NAME,
        season: parsed.data.season,
        throughWeek: parsed.data.throughWeek ?? null,
        error: {
          code: 'TEAM_STATE_UNAVAILABLE',
          message: 'Unexpected Team State consumer failure.',
        },
      });
    }
  });

  return router;
}

export const dataLabTeamStateRouter = createDataLabTeamStateRouter();
