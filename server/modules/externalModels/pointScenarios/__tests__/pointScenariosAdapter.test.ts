import { adaptPointScenarioLab, parseCanonicalPointScenarioLabResponse } from '../pointScenariosAdapter';
import { PointScenarioIntegrationError } from '../types';

const payload = {
  season: 2025,
  availableSeasons: [2025, 2024],
  source: {
    provider: 'point-prediction-model',
    location: '/exports/point_scenario_lab.json',
    mode: 'artifact',
  },
  rows: [
    {
      scenario_id: 'injury-bump',
      scenario_name: 'Target spike if WR2 sits',
      player_id: '00-0036322',
      player_name: 'Justin Jefferson',
      team: 'MIN',
      position: 'WR',
      season: 2025,
      week: 17,
      baseline_projection: 18.4,
      adjusted_projection: 21.1,
      confidence_band: 'mid',
      confidence_label: 'actionable',
      scenario_type: 'usage_shock',
      event_type: 'injury',
      explanation: 'Target share climbs if the secondary perimeter role vacates.',
      notes: ['Promoted export'],
      provenance: {
        provider: 'point-prediction-model',
        source_name: 'scenario-export',
        source_type: 'artifact',
        model_version: 'ppm-v1',
        generated_at: '2026-03-23T00:00:00.000Z',
        source_metadata: { run_id: 'run-17' },
      },
    },
    {
      id: 'weather-downside',
      scenarioName: 'Weather downside in heavy wind',
      playerId: '00-0037834',
      playerName: 'Brock Bowers',
      team_abbr: 'LV',
      pos: 'TE',
      season: '2025',
      baselineProjection: '14.8',
      adjustedProjection: '11.9',
      projectionDelta: '-2.9',
      confidence: 'fragile',
      scenarioType: 'environmental',
      eventType: 'weather',
      notes_text: 'Lower aDOT path and pass volume likely compresses.',
      sourceMetadata: { venue: 'outdoor' },
      modelVersion: 'ppm-v1',
      generatedAt: '2026-03-23T00:00:00.000Z',
    },
  ],
};

describe('pointScenariosAdapter', () => {
  it('normalizes promoted point-scenario rows into the stable TIBER contract', () => {
    const result = adaptPointScenarioLab(payload, { includeRawCanonical: true });

    expect(result.season).toBe(2025);
    expect(result.availableSeasons).toEqual([2025, 2024]);
    expect(result.rows[0]).toMatchObject({
      scenarioName: 'Target spike if WR2 sits',
      playerName: 'Justin Jefferson',
      baselineProjection: 18.4,
      adjustedProjection: 21.1,
      delta: 2.7,
      scenarioType: 'usage_shock',
      eventType: 'injury',
      explanation: 'Target share climbs if the secondary perimeter role vacates.',
    });
    expect(result.rows[1]).toMatchObject({
      playerName: 'Brock Bowers',
      team: 'LV',
      position: 'TE',
      delta: -2.9,
      eventType: 'weather',
      scenarioType: 'environmental',
    });
    expect(result.rows[0].rawCanonical?.scenario_name).toBe('Target spike if WR2 sits');
    expect(result.rows[0].provenance.sourceMetadata).toEqual({ run_id: 'run-17' });
  });

  it('derives delta when the upstream payload omits it explicitly', () => {
    const canonical = parseCanonicalPointScenarioLabResponse({
      source: { provider: 'point-prediction-model', mode: 'artifact' },
      rows: [
        {
          scenario_name: 'Neutral baseline',
          player_name: 'Bijan Robinson',
          baseline_projection: 17.2,
          adjusted_projection: 18.6,
        },
      ],
    });

    const result = adaptPointScenarioLab(canonical);
    expect(result.rows[0].delta).toBeCloseTo(1.4, 5);
  });

  it('fails closed when required scenario identity is missing', () => {
    expect(() =>
      adaptPointScenarioLab({
        source: { provider: 'point-prediction-model', mode: 'artifact' },
        rows: [{ player_name: 'Bijan Robinson', adjusted_projection: 18.6 }],
      }),
    ).toThrow(PointScenarioIntegrationError);
  });
});
