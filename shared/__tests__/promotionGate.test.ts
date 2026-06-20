import {
  evaluatePromotionGate,
  type PromotionGateInput,
} from '@shared/promotionGate';

/** A fully-satisfying input; individual tests override one dimension at a time. */
function promotableInput(overrides: Partial<PromotionGateInput> = {}): PromotionGateInput {
  return {
    governanceStatus: 'governed',
    governanceSource: 'explicit_marker',
    contractMatch: true,
    contractExpected: 'team_environment_movement_v1',
    contractObserved: 'team_environment_movement_v1',
    freshnessStatus: 'fresh',
    freshnessScope: 'dataset',
    freshnessAgeDays: 3,
    freshnessTimestamp: '2026-06-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('evaluatePromotionGate', () => {
  it('promotes only when governed (explicit marker) + contract match + fresh dataset freshness', () => {
    const result = evaluatePromotionGate(promotableInput());
    expect(result.promotable).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.details).toEqual(expect.arrayContaining([
      'Promotable: yes.',
      'Promotion gate satisfied: source is eligible for Level 2 supporting context.',
    ]));
  });

  it('treats a /promoted/ path hint alone as insufficient', () => {
    // Path hint, no explicit governed marker (status inferred unknown).
    const result = evaluatePromotionGate(promotableInput({ governanceStatus: 'unknown', governanceSource: 'path_hint' }));
    expect(result.promotable).toBe(false);
    expect(result.blockers).toContain('governance_path_hint_only');
  });

  it('rejects a governed path hint without an explicit marker', () => {
    const result = evaluatePromotionGate(promotableInput({ governanceStatus: 'governed', governanceSource: 'path_hint' }));
    expect(result.promotable).toBe(false);
    expect(result.blockers).toContain('governance_path_hint_only');
  });

  it('rejects fixture / ungoverned / unknown governance', () => {
    expect(evaluatePromotionGate(promotableInput({ governanceStatus: 'fixture', governanceSource: 'explicit_marker' })).blockers)
      .toContain('governance_not_governed');
    expect(evaluatePromotionGate(promotableInput({ governanceStatus: 'ungoverned', governanceSource: 'explicit_marker' })).blockers)
      .toContain('governance_not_governed');
    // Unknown with no marker at all → marker missing.
    expect(evaluatePromotionGate(promotableInput({ governanceStatus: 'unknown', governanceSource: 'missing' })).blockers)
      .toContain('governance_marker_missing');
    expect(evaluatePromotionGate(promotableInput({ governanceStatus: 'fixture', governanceSource: 'explicit_marker' })).promotable).toBe(false);
  });

  it('rejects a missing contract literal', () => {
    const result = evaluatePromotionGate(promotableInput({ contractMatch: false, contractObserved: null }));
    expect(result.promotable).toBe(false);
    expect(result.blockers).toContain('contract_literal_missing');
  });

  it('rejects a contract mismatch', () => {
    const result = evaluatePromotionGate(promotableInput({
      contractMatch: false,
      contractExpected: 'point_scenario_lab_v1',
      contractObserved: 'point_scenario_lab_v0',
    }));
    expect(result.promotable).toBe(false);
    expect(result.blockers).toContain('contract_mismatch');
  });

  it('rejects row-level-only freshness', () => {
    const result = evaluatePromotionGate(promotableInput({ freshnessStatus: 'fresh', freshnessScope: 'row_level' }));
    expect(result.promotable).toBe(false);
    expect(result.blockers).toContain('dataset_freshness_scope_not_dataset');
  });

  it('rejects missing / stale / unknown freshness', () => {
    expect(evaluatePromotionGate(promotableInput({ freshnessStatus: 'unknown', freshnessScope: 'none' })).blockers)
      .toContain('dataset_freshness_missing');
    expect(evaluatePromotionGate(promotableInput({ freshnessStatus: 'stale', freshnessScope: 'dataset' })).blockers)
      .toContain('dataset_freshness_not_fresh');
    expect(evaluatePromotionGate(promotableInput({ freshnessStatus: 'warning', freshnessScope: 'dataset' })).blockers)
      .toContain('dataset_freshness_not_fresh');
    expect(evaluatePromotionGate(promotableInput({ freshnessStatus: 'unknown', freshnessScope: 'dataset' })).blockers)
      .toContain('dataset_freshness_not_fresh');
    expect(evaluatePromotionGate(promotableInput({ freshnessStatus: 'unknown', freshnessScope: 'none' })).promotable).toBe(false);
  });

  it('accumulates all blockers explicitly and deterministically', () => {
    const result = evaluatePromotionGate({
      governanceStatus: 'unknown',
      governanceSource: 'missing',
      contractMatch: false,
      contractObserved: null,
      freshnessStatus: 'unknown',
      freshnessScope: 'none',
    });
    expect(result.promotable).toBe(false);
    // Deterministic order: governance, contract, freshness.
    expect(result.blockers).toEqual([
      'governance_marker_missing',
      'contract_literal_missing',
      'dataset_freshness_missing',
    ]);
    // Same input yields the same result.
    const again = evaluatePromotionGate({
      governanceStatus: 'unknown',
      governanceSource: 'missing',
      contractMatch: false,
      contractObserved: null,
      freshnessStatus: 'unknown',
      freshnessScope: 'none',
    });
    expect(again.blockers).toEqual(result.blockers);
  });

  it('surfaces normalized UI-ready detail strings', () => {
    const result = evaluatePromotionGate(promotableInput({ governanceStatus: 'governed', governanceSource: 'path_hint' }));
    expect(result.details).toEqual(expect.arrayContaining([
      'Promotable: no.',
      'Governance: governed (source: path_hint).',
      'Level 2 deferred: promotion gate not satisfied (shown as read-only diagnostic only).',
    ]));
    expect(result.details.some((line) => line.startsWith('Blockers: governance_path_hint_only'))).toBe(true);
  });
});
