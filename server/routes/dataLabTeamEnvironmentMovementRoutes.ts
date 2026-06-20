import express from 'express';
import { z } from 'zod';
import {
  TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME,
} from '../modules/externalModels/teamState/teamEnvironmentMovementClient';
import {
  TeamEnvironmentMovementService,
  teamEnvironmentMovementService,
} from '../modules/externalModels/teamState/teamEnvironmentMovementService';

const teamParamSchema = z.object({
  teamAbbr: z.string().trim().min(2).max(4).regex(/^[A-Za-z]+$/),
});

function statusForState(state: string) {
  if (state === 'ready') return 200;
  if (state === 'unavailable') return 200;
  return 502;
}

function buildPayload(result: Awaited<ReturnType<TeamEnvironmentMovementService['getMovement']>>) {
  return {
    ok: result.state === 'ready',
    artifact: result.artifact,
    artifactAvailable: result.artifactAvailable,
    generatedAt: result.generatedAt,
    governance: result.governance,
    provenanceStatus: result.provenanceStatus,
    inputSources: result.inputSources,
    coverage: result.coverage,
    teams: result.teams,
    selectedTeam: result.selectedTeam,
    warnings: result.warnings,
    errors: result.errors,
    source: result.source,
    meta: {
      module: 'team-environment-movement-lab',
      adapter: 'tiber-teamstate-artifact',
      readOnly: true,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export function createDataLabTeamEnvironmentMovementRouter(
  service: TeamEnvironmentMovementService = teamEnvironmentMovementService,
) {
  const router = express.Router();

  router.get('/team-environment-movement', async (_req, res) => {
    const result = await service.getMovement();
    return res.status(statusForState(result.state)).json(buildPayload(result));
  });

  router.get('/team-environment-movement/:teamAbbr', async (req, res) => {
    const parsed = teamParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        artifact: TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME,
        artifactAvailable: false,
        generatedAt: null,
        provenanceStatus: null,
        coverage: null,
        teams: [],
        selectedTeam: null,
        warnings: [],
        errors: [{ code: 'TEAM_ENVIRONMENT_MOVEMENT_INVALID_REQUEST', message: 'teamAbbr must be a 2-4 letter team abbreviation.' }],
      });
    }

    const result = await service.getMovement(parsed.data.teamAbbr);
    return res.status(statusForState(result.state)).json(buildPayload(result));
  });

  return router;
}

export const dataLabTeamEnvironmentMovementRouter = createDataLabTeamEnvironmentMovementRouter();
