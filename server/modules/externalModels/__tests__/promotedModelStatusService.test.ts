import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { PromotedModelStatusService } from '../promotedModelStatusService';
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
