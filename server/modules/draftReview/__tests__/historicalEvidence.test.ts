import { readFileSync } from 'node:fs';
import { decodeHistoricalBundle, historicalEvidenceFor } from '../historicalEvidence';

describe('admitted historical evidence', () => {
  test('offline preparation retains historical source records without granting runtime availability', () => {
    const prepared = JSON.parse(readFileSync('server/modules/draftReview/artifacts/historical2025.json', 'utf8')) as ReturnType<typeof decodeHistoricalBundle>;
    const packet = { ...prepared, players: ['10444', '10218', '8188', '8127', '11571', '11575', '5892', '6819'].map(id => prepared.players.find(p => p.player_id === id)!) };
    expect(packet.players.map(p => p.observed?.weeks.length)).toEqual([12, 16, 12, 13, 16, 17, 17, 17]);
    for (const player of packet.players.slice(0, 6)) {
      expect(player.identity).toMatchObject({ match_method: 'name_exact', confidence: 'medium' });
      expect(player.derived.targets.recorded_weeks).toBe(player.observed?.weeks.length);
      expect(player.derived.target_share.total).toBeNull();
    }
    expect(packet.players[6].observed?.historical_teams).toEqual(['DET']);
    expect(packet.players[6].identity).toMatchObject({ match_method: 'gsis_direct', confidence: 'high' });
    expect(packet.players[7].observed?.historical_teams).toEqual(['IND']);
    expect(packet.players[7].identity).toMatchObject({ match_method: 'espn_bridge', confidence: 'high' });
    expect(prepared.players.some(p => p.player_id === '13301')).toBe(false);
    expect(packet.provenance?.team_roster_identity_admission?.player_ids).toHaveLength(19);
    expect(packet.provenance?.team_roster_identity_admission?.operator_acceptance).toMatchObject({
      source: 'operator_conversation', public_receipt_url: null,
    });
    expect(packet.provenance?.team_roster_identity_admission?.proposal_review.implementation_review).toBe('pending_separate_review');
    expect(packet.forecast).toEqual({ status: 'unavailable', fabricated_values: false });
  });
  test('decoder and cached public selections withhold every preparation-only identity and preserve all 75 prior profiles', () => {
    const bytes = readFileSync('server/modules/draftReview/artifacts/historical2025.json');
    const prepared = JSON.parse(bytes.toString('utf8')) as ReturnType<typeof decodeHistoricalBundle>;
    const pendingIds = prepared.provenance!.team_roster_identity_admission!.player_ids;
    expect(pendingIds).toHaveLength(19);
    const decoded = decodeHistoricalBundle(bytes);
    const oldProfiles = prepared.players.filter(p => !pendingIds.includes(p.player_id));
    expect(oldProfiles).toHaveLength(75);
    expect(decoded.players.filter(p => p.status === 'available')).toEqual(oldProfiles);
    for (const packet of [decoded, historicalEvidenceFor(pendingIds), historicalEvidenceFor(pendingIds)]) {
      for (const id of pendingIds) {
        expect(packet.players.find(p => p.player_id === id)).toEqual({
          player_id: id, status: 'unavailable',
          reason: 'Historical records are prepared but upstream promotion and consumer admission are not yet recorded.',
          identity: null, observed: null, derived: {},
        });
      }
      expect(packet.provenance).toEqual(prepared.provenance);
      expect(packet.forecast.status).toBe('unavailable');
    }
    const changed = historicalEvidenceFor(['5892']);
    changed.players[0].status = 'available';
    changed.provenance!.team_roster_identity_admission!.player_ids.length = 0;
    expect(historicalEvidenceFor(['5892', '8188', '13301']).players.map(p => p.status))
      .toEqual(['unavailable', 'available', 'unavailable']);
  });
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
    expect(packet.provenance?.producer_commit).toBe('5c683e26a843b98358292f0d34a97a98762a96f0');
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
    expect(decodeHistoricalBundle(bytes).players).toHaveLength(94);
    expect(() => decodeHistoricalBundle(Buffer.concat([bytes, Buffer.from(' ')]))).toThrow('integrity');
  });
});
