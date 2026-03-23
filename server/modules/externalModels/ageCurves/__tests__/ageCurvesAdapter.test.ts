import { adaptAgeCurveLab, parseCanonicalAgeCurveLabResponse } from '../ageCurvesAdapter';
import { AgeCurveIntegrationError } from '../types';

const payload = {
  season: 2025,
  availableSeasons: [2025, 2024],
  source: {
    provider: 'arc-model',
    location: '/exports/age_curve_lab.json',
    mode: 'artifact',
  },
  rows: [
    {
      player_id: '00-0036322',
      player_name: 'Justin Jefferson',
      team: 'MIN',
      position: 'WR',
      season: 2025,
      age: 26.4,
      career_year: 6,
      peer_bucket: 'WR-year6-age26',
      expected_ppg: 17.8,
      actual_ppg: 19.6,
      trajectory_label: 'ahead_of_curve',
      age_curve_score: 91.2,
      provenance: {
        provider: 'arc-model',
        source_name: 'arc-export',
        source_type: 'artifact',
        model_version: 'arc-v1',
        generated_at: '2026-03-23T00:00:00.000Z',
        notes: ['promoted export'],
      },
    },
    {
      playerName: 'Rome Odunze',
      team_abbr: 'CHI',
      pos: 'WR',
      season: '2025',
      age: '23.1',
      careerYear: 2,
      cohort_key: 'WR-year2-age23',
      expectedPpg: 12.1,
      actualPpg: 11.2,
      delta: -0.9,
      trajectory: 'on_curve',
      summary_score: 78.4,
      modelVersion: 'arc-v1',
      generatedAt: '2026-03-23T00:00:00.000Z',
    },
  ],
};

describe('ageCurvesAdapter', () => {
  it('normalizes promoted age-curve rows into the stable TIBER contract', () => {
    const result = adaptAgeCurveLab(payload, { includeRawCanonical: true });

    expect(result.season).toBe(2025);
    expect(result.availableSeasons).toEqual([2025, 2024]);
    expect(result.rows[0]).toMatchObject({
      playerName: 'Justin Jefferson',
      age: 26.4,
      careerYear: 6,
      expectedPpg: 17.8,
      actualPpg: 19.6,
      ppgDelta: 1.8,
      trajectoryLabel: 'ahead_of_curve',
      ageCurveScore: 91.2,
    });
    expect(result.rows[1]).toMatchObject({
      playerName: 'Rome Odunze',
      team: 'CHI',
      position: 'WR',
      peerBucket: 'WR-year2-age23',
      ppgDelta: -0.9,
      trajectoryLabel: 'on_curve',
    });
    expect(result.rows[0].rawCanonical?.player_name).toBe('Justin Jefferson');
  });

  it('derives delta when the upstream payload omits it explicitly', () => {
    const canonical = parseCanonicalAgeCurveLabResponse({
      source: { provider: 'arc-model', mode: 'artifact' },
      rows: [
        {
          player_name: 'Brock Bowers',
          season: 2025,
          expected_ppg: 13.4,
          actual_ppg: 15.0,
        },
      ],
    });

    const result = adaptAgeCurveLab(canonical);
    expect(result.rows[0].ppgDelta).toBeCloseTo(1.6, 5);
  });

  it('fails closed when required player identity is missing', () => {
    expect(() =>
      adaptAgeCurveLab({
        source: { provider: 'arc-model', mode: 'artifact' },
        rows: [{ season: 2025, expected_ppg: 10.2 }],
      }),
    ).toThrow(AgeCurveIntegrationError);
  });
});
