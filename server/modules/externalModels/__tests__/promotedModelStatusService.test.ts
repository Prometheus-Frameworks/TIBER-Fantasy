import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { PromotedModelStatusService } from '../promotedModelStatusService';
import { AgeCurveClient } from '../ageCurves/ageCurvesClient';
import { AgeCurvesService } from '../ageCurves/ageCurvesService';
import { RoleOpportunityClient } from '../roleOpportunity/roleOpportunityClient';
import { RoleOpportunityService } from '../roleOpportunity/roleOpportunityService';
import { SignalValidationClient } from '../signalValidation/signalValidationClient';
import { SignalValidationService } from '../signalValidation/signalValidationService';

function buildAuxiliaryDeps() {
  const readyRolePayload = {
    season: 2025,
    availableSeasons: [2025],
    rows: [{ playerId: '00-0036322' }],
  };

  return {
    roleOpportunity: {
      getStatus: jest.fn().mockReturnValue({ enabled: true, baseUrl: 'http://role.example', exportsPath: '/tmp/role.json' }),
      getRoleOpportunityLab: jest.fn().mockResolvedValue(readyRolePayload),
    },
    ageCurves: {
      getStatus: jest.fn().mockReturnValue({ enabled: true, baseUrl: 'http://age.example', exportsPath: '/tmp/age.json' }),
      getAgeCurveLab: jest.fn().mockResolvedValue(readyRolePayload),
    },
    pointScenarios: {
      getStatus: jest.fn().mockReturnValue({ enabled: true, baseUrl: 'http://point.example', exportsPath: '/tmp/point.json' }),
      getPointScenarioLab: jest.fn().mockResolvedValue(readyRolePayload),
    },
    commandCenter: {
      getCommandCenter: jest.fn().mockResolvedValue({ state: 'ready' }),
    },
  };
}

describe('PromotedModelStatusService breakout artifact readiness', () => {
  it('marks WR Breakout Lab ready when promoted exports exist for the requested season', async () => {
    const exportsDir = await mkdtemp(path.join(os.tmpdir(), 'sv-ready-'));

    try {
      await writeFile(
        path.join(exportsDir, 'wr_player_signal_cards_2025.csv'),
        'candidate_rank,final_signal_score,player_name,season\n1,92.4,Malik Nabers,2025\n',
        'utf8',
      );
      await writeFile(
        path.join(exportsDir, 'wr_best_recipe_summary.json'),
        JSON.stringify({ best_recipe_name: 'Second-Year Surge', season: 2025, validation_score: 0.78 }),
        'utf8',
      );

      const signalValidation = new SignalValidationService(new SignalValidationClient({ exportsDir, enabled: true }));
      const service = new PromotedModelStatusService({
        signalValidation,
        ...buildAuxiliaryDeps(),
      });

      const report = await service.getStatusReport({ season: 2025 });
      const breakout = report.statuses.find((status) => status.moduleId === 'breakout-signals');

      expect(breakout?.status).toBe('ready');
      expect(breakout?.detail).toContain('loaded with 1 rows');
    } finally {
      await rm(exportsDir, { recursive: true, force: true });
    }
  });

  it('keeps WR Breakout Lab in missing_export_artifact when required exports are absent', async () => {
    const exportsDir = await mkdtemp(path.join(os.tmpdir(), 'sv-missing-'));

    try {
      const signalValidation = new SignalValidationService(new SignalValidationClient({ exportsDir, enabled: true }));
      const service = new PromotedModelStatusService({
        signalValidation,
        ...buildAuxiliaryDeps(),
      });

      const report = await service.getStatusReport({ season: 2025 });
      const breakout = report.statuses.find((status) => status.moduleId === 'breakout-signals');

      expect(breakout?.status).toBe('missing_export_artifact');
      expect(breakout?.detail).toContain('No Signal Validation WR player signal card exports were found.');
    } finally {
      await rm(exportsDir, { recursive: true, force: true });
    }
  });

  it('distinguishes healthy other-season availability from true unavailable/missing states', async () => {
    const exportsDir = await mkdtemp(path.join(os.tmpdir(), 'sv-other-season-'));

    try {
      await writeFile(
        path.join(exportsDir, 'wr_player_signal_cards_2024.csv'),
        'candidate_rank,final_signal_score,player_name,season\n1,92.4,Malik Nabers,2024\n',
        'utf8',
      );
      await writeFile(
        path.join(exportsDir, 'wr_best_recipe_summary.json'),
        JSON.stringify({ best_recipe_name: 'Second-Year Surge', season: 2024, validation_score: 0.78 }),
        'utf8',
      );

      const signalValidation = new SignalValidationService(new SignalValidationClient({ exportsDir, enabled: true }));
      const service = new PromotedModelStatusService({
        signalValidation,
        ...buildAuxiliaryDeps(),
        roleOpportunity: {
          getStatus: jest.fn().mockReturnValue({ enabled: true, baseUrl: 'http://role.example', exportsPath: '/tmp/role.json' }),
          getRoleOpportunityLab: jest.fn().mockResolvedValue({ season: 2025, availableSeasons: [2025], rows: [] }),
        },
      });

      const report = await service.getStatusReport({ season: 2024 });
      const breakout = report.statuses.find((status) => status.moduleId === 'breakout-signals');
      const role = report.statuses.find((status) => status.moduleId === 'role-opportunity');

      expect(breakout?.status).toBe('ready');
      expect(role?.status).toBe('available_other_seasons');
      expect(role?.detail).toContain('healthy rows exist for 2025');
      expect(role?.availableSeasons).toEqual([2025]);
    } finally {
      await rm(exportsDir, { recursive: true, force: true });
    }
  });
});

describe('PromotedModelStatusService role-opportunity + ARC artifact readiness', () => {
  it('marks Role & Opportunity and ARC ready when promoted artifacts are present on disk', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'promoted-ready-'));

    try {
      const rolePath = path.join(tempDir, 'role_opportunity_lab.json');
      const arcPath = path.join(tempDir, 'arc_promoted_handoff.json');

      await writeFile(
        rolePath,
        JSON.stringify({
          season: 2025,
          week: 4,
          available_seasons: [2025],
          rows: [
            {
              player_id: '00-0036322',
              player_name: 'Justin Jefferson',
              team: 'MIN',
              position: 'WR',
              season: 2025,
              week: 4,
              primary_role: 'alpha_receiver',
              role_tags: ['alpha'],
              route_participation: 91,
              target_share: 30,
              air_yard_share: 32,
              confidence_score: 0.93,
              confidence_tier: 'high',
              source_name: 'role-and-opportunity-model',
              source_type: 'artifact',
              model_version: 'v1',
              generated_at: '2026-03-24T00:00:00.000Z',
              insights: ['Strong role security.'],
            },
          ],
          source: { provider: 'role-and-opportunity-model', mode: 'artifact' },
        }),
        'utf8',
      );

      await writeFile(
        arcPath,
        JSON.stringify({
          season: 2025,
          available_seasons: [2025],
          rows: [
            {
              player_id: '00-0036322',
              player_name: 'Justin Jefferson',
              team: 'MIN',
              position: 'WR',
              season: 2025,
              age: 26,
              career_year: 6,
              expected_ppg: 18,
              actual_ppg: 20,
              ppg_delta: 2,
              trajectory_label: 'outperforming',
              age_curve_score: 91,
            },
          ],
          source: { provider: 'arc-model', mode: 'artifact' },
        }),
        'utf8',
      );

      const roleOpportunity = new RoleOpportunityService(new RoleOpportunityClient({ exportsPath: rolePath, enabled: true }));
      const ageCurves = new AgeCurvesService(new AgeCurveClient({ exportsPath: arcPath, enabled: true }));

      const service = new PromotedModelStatusService({
        signalValidation: {
          getStatus: jest.fn().mockReturnValue({ enabled: true, exportsDir: '/tmp/sv' }),
          getWrBreakoutLab: jest.fn().mockResolvedValue({ season: 2025, availableSeasons: [2025], rows: [{ playerId: '00-0036322' }] }),
        },
        roleOpportunity,
        ageCurves,
        pointScenarios: {
          getStatus: jest.fn().mockReturnValue({ enabled: true, baseUrl: 'http://point.example', exportsPath: '/tmp/point.json' }),
          getPointScenarioLab: jest.fn().mockResolvedValue({ season: 2025, availableSeasons: [2025], rows: [{ playerId: '00-0036322' }] }),
        },
        commandCenter: {
          getCommandCenter: jest.fn().mockResolvedValue({ state: 'ready' }),
        },
      });

      const report = await service.getStatusReport({ season: 2025 });
      const role = report.statuses.find((status) => status.moduleId === 'role-opportunity');
      const arc = report.statuses.find((status) => status.moduleId === 'age-curves');

      expect(role?.status).toBe('ready');
      expect(arc?.status).toBe('ready');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
