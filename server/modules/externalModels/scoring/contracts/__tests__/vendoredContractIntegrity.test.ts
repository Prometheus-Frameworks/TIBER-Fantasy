/**
 * FFI-3: the vendored fantasy_forecast.weekly_player v1 artifacts are only
 * trustworthy at their exact bytes. This suite recomputes every digest against
 * the vendored manifest and pins the manifest's own digest via
 * VENDOR_PROVENANCE.json, so a silent local edit — or an incomplete
 * re-vendor — fails deterministically.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CONTRACT_DIR = path.join(__dirname, '..', 'fantasyForecastWeeklyPlayerV1');

const sha256 = (relativePath: string): string =>
  createHash('sha256').update(readFileSync(path.join(CONTRACT_DIR, relativePath))).digest('hex');

const provenance = JSON.parse(readFileSync(path.join(CONTRACT_DIR, 'VENDOR_PROVENANCE.json'), 'utf8')) as {
  contract_version: string;
  source_commit: string;
  manifest_sha256: string;
  vendored_validator_path: string;
  vendored_validator_sha256: string;
};

const manifest = JSON.parse(readFileSync(path.join(CONTRACT_DIR, 'manifest.v1.json'), 'utf8')) as {
  contract_version: string;
  schemas: Array<{ path: string; sha256: string }>;
  fixtures: Array<{ fixture_id: string; path: string; expected_outcome: string; sha256: string }>;
  exchange_rule: { rule_id: string };
};

describe('vendored fantasy_forecast.weekly_player v1 contract integrity', () => {
  it('pins the manifest bytes to the provenance digest', () => {
    expect(sha256('manifest.v1.json')).toBe(provenance.manifest_sha256);
    expect(manifest.contract_version).toBe(provenance.contract_version);
    expect(provenance.source_commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('matches every vendored schema and fixture to its manifest digest', () => {
    for (const entry of [...manifest.schemas, ...manifest.fixtures]) {
      expect(sha256(entry.path)).toBe(entry.sha256);
    }
  });

  it('pins the vendored validator bytes — validation semantics cannot drift silently', () => {
    // The runtime validator is a verbatim commit-pinned copy; it is not listed
    // in the Forecast-generated manifest, so it is pinned here via the
    // provenance record instead. An accidental edit or a partial re-vendor
    // from a different Forecast revision fails this check.
    expect(provenance.vendored_validator_path).toBe('validateJsonSchemaSubset.vendored.ts');
    expect(sha256(provenance.vendored_validator_path)).toBe(provenance.vendored_validator_sha256);
  });

  it('carries the seven golden fixture classes and the exchange rule', () => {
    expect(manifest.fixtures.map((fixture) => fixture.fixture_id)).toEqual([
      'valid_weekly_player_request',
      'invalid_missing_required_league_context',
      'invalid_null_or_unsupported_player_identity',
      'valid_weekly_player_card_response',
      'weekly_player_card_unavailable_or_stale_state',
      'invalid_malformed_weekly_player_card_response',
      'semantic_regression_weekly_must_not_be_ros',
    ]);
    expect(manifest.exchange_rule.rule_id).toBe('fantasy_forecast.weekly_player_exchange');
  });
});
