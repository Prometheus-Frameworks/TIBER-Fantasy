import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { AgeCurveClient } from '../ageCurvesClient';

const sampleArtifact = {
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
      expected_ppg: 18.2,
      actual_ppg: 20.1,
      ppg_delta: 1.9,
      trajectory_label: 'outperforming',
      age_curve_score: 91.2,
    },
  ],
  source: { provider: 'arc-model', mode: 'artifact' },
};

describe('AgeCurveClient promoted artifact discovery', () => {
  it('reads the canonical promoted ARC handoff artifact path when configured', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'arc-handoff-'));
    const handoffPath = path.join(tempDir, 'arc_promoted_handoff.json');

    try {
      await writeFile(handoffPath, JSON.stringify(sampleArtifact), 'utf8');

      const client = new AgeCurveClient({ enabled: true, exportsPath: handoffPath });
      const payload = await client.fetchAgeCurveLab({ season: 2025 });

      expect(payload).toEqual(expect.objectContaining({ season: 2025 }));
      expect((payload as any).rows).toHaveLength(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('falls back to legacy age_curve_lab.json when promoted handoff file is not present', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'arc-legacy-'));
    const missingHandoffPath = path.join(tempDir, 'arc_promoted_handoff.json');
    const legacyPath = path.join(tempDir, 'age_curve_lab.json');
    const previousLegacyPath = process.env.AGE_CURVE_EXPORTS_PATH;

    try {
      await writeFile(legacyPath, JSON.stringify(sampleArtifact), 'utf8');
      process.env.AGE_CURVE_EXPORTS_PATH = legacyPath;

      const client = new AgeCurveClient({ enabled: true, exportsPath: missingHandoffPath });
      const payload = await client.fetchAgeCurveLab({ season: 2025 });

      expect(payload).toEqual(expect.objectContaining({ season: 2025 }));
      expect((payload as any).rows).toHaveLength(1);

    } finally {
      if (previousLegacyPath == null) {
        delete process.env.AGE_CURVE_EXPORTS_PATH;
      } else {
        process.env.AGE_CURVE_EXPORTS_PATH = previousLegacyPath;
      }
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
