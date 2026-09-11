import { readFileSync } from 'node:fs';
import { decodeHistoricalBundle, historicalEvidenceFor } from '../historicalEvidence';

describe('admitted historical evidence', () => {
  test('retains accepted identity confidence and historical context for all five study cases', () => {
    const packet = historicalEvidenceFor(['9997', '7526', '12512', '12481', '7594']);
    expect(packet.status).toBe('available');
    expect(packet.players.map(p => p.observed?.weeks.length)).toEqual([17, 16, 14, 8, 15]);
    expect(packet.players[1].observed?.historical_teams).toEqual(['MIA']);
    for (const player of packet.players.slice(1)) expect(player.identity).toMatchObject({ confidence: 'medium', match_method: 'name_exact' });
    expect(packet.provenance).toMatchObject({ source_acquired_at: null, source_updated_at: null, original_release_hash: null, package_version: null });
    expect(packet.unavailable_metrics).toMatchObject({ air_yards: null, fantasy_points: null, regression_probability: null });
    expect(packet.forecast).toEqual({ status: 'unavailable', fabricated_values: false });
    expect(packet.provenance?.attribution.license_url).toBe('https://creativecommons.org/licenses/by/4.0/');
  });
  test('three additional identities retain historical denominators and separate authority', () => {
    const packet = historicalEvidenceFor(['9487', '8112', '10219']);
    expect(packet.players.map(p => p.observed?.weeks.length)).toEqual([16, 12, 12]);
    expect(packet.players[0].observed?.weeks).not.toContain(19);
    expect(packet.players[2].observed?.historical_teams).toEqual(['WAS']);
    for (const player of packet.players) {
      expect(player.status).toBe('available');
      expect(player.identity).toMatchObject({ confidence: 'medium', match_method: 'name_exact' });
      expect(player.derived.targets.recorded_weeks).toBe(player.observed?.weeks.length);
    }
    expect(packet.provenance?.producer_commit).toBe('488220fa05c834aad3a4e2bea839a1843131053a');
    expect(packet.provenance?.operator_acceptance).toContain('5574349251');
    expect(packet.provenance?.team_identity_admission).toMatchObject({
      player_ids: ['9487', '8112', '10219'], receipt_stage: 'accepted_for_branch_preparation',
      operator_acceptance: 'https://github.com/Prometheus-Frameworks/TIBER-Data/pull/268#issuecomment-5627117154',
      consumer_authorization: 'https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/372#issuecomment-5627769635',
    });
    expect(historicalEvidenceFor(['8167', '11581', '6806', '7567']).players.every(p => p.status === 'unavailable')).toBe(true);
  });
  test('unmapped identities fail explicitly and public responses cannot contaminate another request', () => {
    const first = historicalEvidenceFor(['7526']);
    first.players[0].observed!.historical_teams.push('FAKE');
    first.provenance!.attribution.name = 'FAKE';
    const next = historicalEvidenceFor(['7526', '999999999']);
    expect(JSON.stringify(next)).not.toContain('FAKE');
    expect(next.players[1]).toMatchObject({ status: 'unavailable', identity: null, observed: null, derived: {} });
    expect(historicalEvidenceFor(Array(33).fill('7526')).status).toBe('unavailable');
    expect(historicalEvidenceFor(['../../secret']).status).toBe('unavailable');
  });
  test('missing, malformed or modified source bytes cannot pass the content pin', () => {
    expect(() => decodeHistoricalBundle(Buffer.from('{}'))).toThrow('integrity');
    const bytes = readFileSync('server/modules/draftReview/artifacts/historical2025.json');
    expect(decodeHistoricalBundle(bytes).players).toHaveLength(75);
    expect(() => decodeHistoricalBundle(Buffer.concat([bytes, Buffer.from(' ')]))).toThrow('integrity');
  });
});
