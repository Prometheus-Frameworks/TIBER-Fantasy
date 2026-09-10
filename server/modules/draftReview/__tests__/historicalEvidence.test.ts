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
    expect(decodeHistoricalBundle(bytes).players).toHaveLength(72);
    expect(() => decodeHistoricalBundle(Buffer.concat([bytes, Buffer.from(' ')]))).toThrow('integrity');
  });
});
