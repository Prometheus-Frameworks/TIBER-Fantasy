import { readFileSync } from 'node:fs';
import { decodeHistoricalBundle, historicalEvidenceFor } from '../historicalEvidence';

describe('admitted historical evidence', () => {
  test('promotion preserves historical source records and the separate preparation receipt', () => {
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
  test('exact promotion serves nineteen identities and preserves all 75 prior profiles across cached selections', () => {
    const bytes = readFileSync('server/modules/draftReview/artifacts/historical2025.json');
    const prepared = JSON.parse(bytes.toString('utf8')) as ReturnType<typeof decodeHistoricalBundle>;
    const ids = prepared.provenance!.team_roster_identity_admission!.player_ids;
    const decoded = decodeHistoricalBundle(bytes);
    expect(ids).toHaveLength(19);
    expect(decoded.players).toEqual(prepared.players);
    expect(decoded.players.filter(p => !ids.includes(p.player_id))).toHaveLength(75);
    for (const packet of [historicalEvidenceFor(ids), historicalEvidenceFor(ids)]) {
      expect(packet.players).toEqual(ids.map(id => prepared.players.find(p => p.player_id === id)));
      expect(packet.players.every(p => p.status === 'available')).toBe(true);
      expect(packet.provenance).toEqual(prepared.provenance);
      expect(packet.forecast.status).toBe('unavailable');
      expect(packet.provenance?.team_roster_identity_promotion?.receipt).toMatchObject({
        player_ids: ids, excluded_player_ids: ['13301'], historical_consumer_use_authorized: true,
        merge_authorized: false, deployment_authorized: false, production_release_authorized: false,
      });
    }
    const changed = historicalEvidenceFor(['5892']);
    changed.players[0].status = 'unavailable';
    changed.provenance!.team_roster_identity_promotion!.receipt.player_ids.length = 0;
    expect(historicalEvidenceFor(['5892', '8188', '13301']).players.map(p => p.status))
      .toEqual(['available', 'available', 'unavailable']);
    expect(historicalEvidenceFor(['5892']).provenance!.team_roster_identity_promotion!.receipt.player_ids).toHaveLength(19);
  });
  test('absent, altered, or wider promotion receipts cannot activate evidence', () => {
    const raw = readFileSync('server/modules/draftReview/artifacts/historical2025.json', 'utf8');
    for (const change of ['absent', 'cohort', 'scope', 'permission', 'confidence']) {
      const candidate = JSON.parse(raw);
      const receipt = candidate.provenance.team_roster_identity_promotion.receipt;
      if (change === 'absent') delete candidate.provenance.team_roster_identity_promotion;
      if (change === 'cohort') receipt.player_ids.push('13301');
      if (change === 'scope') receipt.consumer_scope.forecast_allowed = true;
      if (change === 'permission') receipt.historical_consumer_use_authorized = false;
      if (change === 'confidence') receipt.identity_records[0].confidence = 'high';
      expect(() => decodeHistoricalBundle(Buffer.from(JSON.stringify(candidate)))).toThrow('integrity');
    }
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
    expect(packet.provenance?.producer_commit).toBe('f12234d909adc82e79ca463e76b994c8dd24bdb9');
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
