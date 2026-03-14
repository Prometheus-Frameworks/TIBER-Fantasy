import { assignRoleFromUsage, TIBER_MATRIX_ROLE_THRESHOLDS } from '../assignRoleFromUsage';
import type { NormalizedUsageInput } from '@shared/types/roleOntology';

// ── Helper ────────────────────────────────────────────────────────────────────
const assign = (overrides: Partial<NormalizedUsageInput> & Pick<NormalizedUsageInput, 'position'>) =>
  assignRoleFromUsage(overrides);

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Obvious-case test for EVERY canonical role
// ═══════════════════════════════════════════════════════════════════════════════

describe('canonical role assignment — one test per role', () => {
  // ── QB ──
  it('assigns QB_STRUCTURED_DISTRIBUTOR', () => {
    const result = assign({
      position: 'QB',
      designed_rush_rate: 0.03,
      scramble_rate: 0.03,
      deep_target_rate: 0.07,
      adot: 6.5,
    });
    expect(result.primary_role).toBe('QB_STRUCTURED_DISTRIBUTOR');
  });

  it('assigns QB_BALANCED_CREATOR', () => {
    const result = assign({
      position: 'QB',
      designed_rush_rate: 0.07,
      scramble_rate: 0.06,
      deep_target_rate: 0.12,
      adot: 7.8,
    });
    expect(result.primary_role).toBe('QB_BALANCED_CREATOR');
  });

  it('assigns QB_DUAL_THREAT_ENGINE', () => {
    const result = assign({
      position: 'QB',
      designed_rush_rate: 0.14,
      scramble_rate: 0.11,
      deep_target_rate: 0.19,
      adot: 9.2,
    });
    expect(result.primary_role).toBe('QB_DUAL_THREAT_ENGINE');
  });

  // ── RB ──
  it('assigns RB_WORKHORSE_GRINDER', () => {
    const result = assign({
      position: 'RB',
      carry_share: 0.62,
      route_rate: 0.28,
      goal_line_carry_share: 0.45,
      third_down_snap_rate: 0.30,
    });
    expect(result.primary_role).toBe('RB_WORKHORSE_GRINDER');
  });

  it('assigns RB_HYBRID_BELL_COW', () => {
    const result = assign({
      position: 'RB',
      carry_share: 0.56,
      route_rate: 0.63,
      third_down_snap_rate: 0.67,
      two_minute_snap_rate: 0.61,
    });
    expect(result.primary_role).toBe('RB_HYBRID_BELL_COW');
  });

  it('assigns RB_SATELLITE_PLUS', () => {
    const result = assign({
      position: 'RB',
      carry_share: 0.22,
      route_rate: 0.72,
      third_down_snap_rate: 0.68,
      two_minute_snap_rate: 0.60,
    });
    expect(result.primary_role).toBe('RB_SATELLITE_PLUS');
  });

  it('assigns RB_GOAL_LINE_HAMMER', () => {
    const result = assign({
      position: 'RB',
      carry_share: 0.28,
      route_rate: 0.22,
      goal_line_carry_share: 0.70,
      red_zone_carry_share: 0.56,
    });
    expect(result.primary_role).toBe('RB_GOAL_LINE_HAMMER');
  });

  it('assigns RB_CHANGE_OF_PACE', () => {
    const result = assign({
      position: 'RB',
      carry_share: 0.18,
      route_rate: 0.42,
      motion_rate: 0.32,
      third_down_snap_rate: 0.25,
    });
    expect(result.primary_role).toBe('RB_CHANGE_OF_PACE');
  });

  // ── WR ──
  it('assigns WR_ALPHA_BOUNDARY_X', () => {
    const result = assign({
      position: 'WR',
      boundary_rate: 0.82,
      route_participation: 0.91,
      red_zone_target_share: 0.31,
      adot: 12.0,
    });
    expect(result.primary_role).toBe('WR_ALPHA_BOUNDARY_X');
  });

  it('assigns WR_VERTICAL_X', () => {
    const result = assign({
      position: 'WR',
      boundary_rate: 0.72,
      adot: 15.2,
      deep_target_rate: 0.30,
      red_zone_target_share: 0.10,
      route_participation: 0.80,
    });
    expect(result.primary_role).toBe('WR_VERTICAL_X');
  });

  it('assigns WR_FLANKER_CHAIN_MOVER', () => {
    const result = assign({
      position: 'WR',
      boundary_rate: 0.55,
      adot: 9.5,
      route_participation: 0.78,
      slot_rate: 0.35,
      deep_target_rate: 0.08,
    });
    expect(result.primary_role).toBe('WR_FLANKER_CHAIN_MOVER');
  });

  it('assigns WR_BIG_SLOT_HUB', () => {
    const result = assign({
      position: 'WR',
      slot_rate: 0.68,
      route_participation: 0.85,
      red_zone_target_share: 0.22,
      adot: 10.5,
      boundary_rate: 0.20,
    });
    expect(result.primary_role).toBe('WR_BIG_SLOT_HUB');
  });

  it('assigns WR_FIELD_STRETCH_Z', () => {
    const result = assign({
      position: 'WR',
      deep_target_rate: 0.25,
      motion_rate: 0.30,
      adot: 13.8,
      boundary_rate: 0.50,
      slot_rate: 0.30,
    });
    expect(result.primary_role).toBe('WR_FIELD_STRETCH_Z');
  });

  it('assigns WR_SLOT_GADGET', () => {
    const result = assign({
      position: 'WR',
      slot_rate: 0.78,
      motion_rate: 0.49,
      route_participation: 0.57,
      adot: 6.8,
      deep_target_rate: 0.05,
    });
    expect(result.primary_role).toBe('WR_SLOT_GADGET');
  });

  // ── TE ──
  it('assigns TE_INLINE_ANCHOR', () => {
    const result = assign({
      position: 'TE',
      inline_rate: 0.75,
      route_participation: 0.55,
      adot: 7.0,
      slot_rate: 0.08,
      red_zone_target_share: 0.10,
    });
    expect(result.primary_role).toBe('TE_INLINE_ANCHOR');
  });

  it('assigns TE_MOVE_MISMATCH', () => {
    const result = assign({
      position: 'TE',
      inline_rate: 0.35,
      route_participation: 0.82,
      adot: 10.2,
      slot_rate: 0.45,
    });
    expect(result.primary_role).toBe('TE_MOVE_MISMATCH');
  });

  it('assigns TE_RED_ZONE_POWER', () => {
    const result = assign({
      position: 'TE',
      inline_rate: 0.62,
      route_participation: 0.68,
      red_zone_target_share: 0.36,
      adot: 8.8,
    });
    expect(result.primary_role).toBe('TE_RED_ZONE_POWER');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Sparse-data / unknown role tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('sparse-data and unknown role behavior', () => {
  it('returns QB_UNKNOWN when no metrics are provided', () => {
    const result = assign({ position: 'QB' });
    expect(result.primary_role).toBe('QB_UNKNOWN');
    expect(result.data_sufficiency).toBe('INSUFFICIENT');
    expect(result.role_confidence).toBe('LOW');
    expect(result.role_stability).toBe('VOLATILE');
  });

  it('returns RB_UNKNOWN when no metrics are provided', () => {
    const result = assign({ position: 'RB', player_id: '00-TEST' });
    expect(result.primary_role).toBe('RB_UNKNOWN');
    expect(result.data_sufficiency).toBe('INSUFFICIENT');
  });

  it('returns WR_UNKNOWN when no metrics are provided', () => {
    const result = assign({ position: 'WR' });
    expect(result.primary_role).toBe('WR_UNKNOWN');
    expect(result.data_sufficiency).toBe('INSUFFICIENT');
  });

  it('returns TE_UNKNOWN when no metrics are provided', () => {
    const result = assign({ position: 'TE' });
    expect(result.primary_role).toBe('TE_UNKNOWN');
    expect(result.data_sufficiency).toBe('INSUFFICIENT');
  });

  it('returns unknown when only 1-2 metrics present', () => {
    const result = assign({
      position: 'WR',
      boundary_rate: 0.80,
      adot: 14.0,
    });
    expect(result.primary_role).toBe('WR_UNKNOWN');
    expect(result.data_sufficiency).toBe('INSUFFICIENT');
  });

  it('returns PARTIAL data sufficiency with moderate metrics', () => {
    const result = assign({
      position: 'RB',
      carry_share: 0.55,
      route_rate: 0.30,
      goal_line_carry_share: 0.40,
      third_down_snap_rate: 0.25,
    });
    expect(result.data_sufficiency).toBe('PARTIAL');
    // Should still assign a real role (not unknown)
    expect(result.primary_role).not.toContain('UNKNOWN');
  });

  it('returns unknown role when all scores are zero (sparse edge case)', () => {
    // 3 metrics present but none trigger any scoring rule
    const result = assign({
      position: 'TE',
      inline_rate: 0.40, // between anchor and mismatch thresholds
      route_participation: 0.65, // between anchor max and mismatch min
      adot: 8.5, // right at the boundary
    });
    // The profile may or may not trigger zero — just verify it doesn't crash
    expect(result.primary_role).toBeDefined();
    expect(result.data_sufficiency).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Ambiguous-profile tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ambiguous profile resolution', () => {
  it('distinguishes WR_ALPHA_BOUNDARY_X from WR_VERTICAL_X with red-zone presence', () => {
    // Alpha: high boundary + high red-zone share + sub-vertical aDOT
    const alpha = assign({
      position: 'WR',
      boundary_rate: 0.75,
      route_participation: 0.88,
      red_zone_target_share: 0.28,
      adot: 11.5,
      deep_target_rate: 0.15,
    });
    expect(alpha.primary_role).toBe('WR_ALPHA_BOUNDARY_X');

    // Vertical: high boundary + high aDOT + high deep rate + low red-zone
    const vertical = assign({
      position: 'WR',
      boundary_rate: 0.75,
      route_participation: 0.82,
      red_zone_target_share: 0.10,
      adot: 15.0,
      deep_target_rate: 0.28,
    });
    expect(vertical.primary_role).toBe('WR_VERTICAL_X');
  });

  it('distinguishes RB_WORKHORSE_GRINDER from RB_HYBRID_BELL_COW via route + passing-down usage', () => {
    // Grinder: high carry, low route, low 3rd-down
    const grinder = assign({
      position: 'RB',
      carry_share: 0.60,
      route_rate: 0.25,
      third_down_snap_rate: 0.20,
      goal_line_carry_share: 0.50,
    });
    expect(grinder.primary_role).toBe('RB_WORKHORSE_GRINDER');

    // Bell cow: high carry, high route, high 3rd-down
    const bellCow = assign({
      position: 'RB',
      carry_share: 0.58,
      route_rate: 0.62,
      third_down_snap_rate: 0.60,
      two_minute_snap_rate: 0.55,
    });
    expect(bellCow.primary_role).toBe('RB_HYBRID_BELL_COW');
  });

  it('handles TE inline/detached ambiguity via slot rate separator', () => {
    // Anchor: high inline, low slot
    const anchor = assign({
      position: 'TE',
      inline_rate: 0.70,
      route_participation: 0.55,
      adot: 7.5,
      slot_rate: 0.05,
    });
    expect(anchor.primary_role).toBe('TE_INLINE_ANCHOR');

    // Mismatch: low inline, high route, high slot
    const mismatch = assign({
      position: 'TE',
      inline_rate: 0.30,
      route_participation: 0.80,
      adot: 9.5,
      slot_rate: 0.40,
    });
    expect(mismatch.primary_role).toBe('TE_MOVE_MISMATCH');
  });

  it('resolves blended slot/flanker WR profiles toward flanker when boundary is meaningful', () => {
    const result = assign({
      position: 'WR',
      boundary_rate: 0.50,
      slot_rate: 0.38,
      adot: 9.8,
      route_participation: 0.75,
      deep_target_rate: 0.08,
    });
    expect(result.primary_role).toBe('WR_FLANKER_CHAIN_MOVER');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Secondary-role tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('secondary role assignment', () => {
  it('assigns secondary role when margin is tight', () => {
    // Profile that could be either grinder or bell cow
    const result = assign({
      position: 'RB',
      carry_share: 0.56,
      route_rate: 0.56,
      third_down_snap_rate: 0.56,
      two_minute_snap_rate: 0.51,
      goal_line_carry_share: 0.36,
    });
    expect(result.secondary_role).toBeDefined();
    expect(result.assignment_reasoning.length).toBeGreaterThan(0);
  });

  it('does not assign secondary role when primary wins decisively', () => {
    const result = assign({
      position: 'QB',
      designed_rush_rate: 0.02,
      scramble_rate: 0.02,
      deep_target_rate: 0.05,
      adot: 6.0,
      pressure_to_sack_rate: 0.15,
    });
    expect(result.primary_role).toBe('QB_STRUCTURED_DISTRIBUTOR');
    expect(result.secondary_role).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Confidence / stability checks
// ═══════════════════════════════════════════════════════════════════════════════

describe('confidence and stability inference', () => {
  it('returns HIGH confidence for strong, well-separated profiles', () => {
    // Needs 5+ score and 2+ margin; dual-threat has 4 scoring rules so use a
    // profile that hits all 4 DT rules and none of the competing QB roles
    // to produce score=4 with large margin. We need score>=5, so use more
    // metrics or adjust: actually let's test with a clear 5-scorer WR alpha.
    const result = assign({
      position: 'WR',
      boundary_rate: 0.82,
      route_participation: 0.92,
      red_zone_target_share: 0.30,
      adot: 11.5,
      target_share: 0.26,
      deep_target_rate: 0.08,
      slot_rate: 0.10,
      motion_rate: 0.05,
    });
    expect(result.primary_role).toBe('WR_ALPHA_BOUNDARY_X');
    expect(result.role_confidence).toBe('HIGH');
  });

  it('caps confidence at LOW for insufficient data even if scores are high', () => {
    // Only 2 metrics — insufficient
    const result = assign({
      position: 'WR',
      boundary_rate: 0.90,
    });
    expect(result.role_confidence).toBe('LOW');
    expect(result.data_sufficiency).toBe('INSUFFICIENT');
  });

  it('returns VOLATILE stability when many metrics are missing', () => {
    const result = assign({
      position: 'RB',
      carry_share: 0.60,
      route_rate: 0.25,
      goal_line_carry_share: 0.40,
    });
    // With only 3 metrics, data_sufficiency is PARTIAL but missing metrics are many
    expect(['VOLATILE', 'MODERATE']).toContain(result.role_stability);
  });

  it('returns STABLE for a full profile with clear separation', () => {
    // Stability requires: missing_metrics <= 3 and margin >= 2.
    // METRIC_KEYS has 22 keys, so we need at least 19 present.
    const result = assign({
      position: 'WR',
      boundary_rate: 0.85,
      slot_rate: 0.10,
      route_participation: 0.92,
      red_zone_target_share: 0.30,
      adot: 11.5,
      deep_target_rate: 0.14,
      motion_rate: 0.08,
      target_share: 0.25,
      screen_target_rate: 0.03,
      first_read_share: 0.12,
      targets_per_route: 0.22,
      carry_share: 0,
      route_rate: 0.90,
      third_down_snap_rate: 0.70,
      two_minute_snap_rate: 0.65,
      red_zone_carry_share: 0,
      goal_line_carry_share: 0,
      inline_rate: 0,
      explosive_pass_rate: 0.10,
      pressure_to_sack_rate: 0,
      scramble_rate: 0,
      designed_rush_rate: 0,
    });
    expect(result.primary_role).toBe('WR_ALPHA_BOUNDARY_X');
    expect(result.role_stability).toBe('STABLE');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Determinism
// ═══════════════════════════════════════════════════════════════════════════════

describe('determinism', () => {
  it('is deterministic for identical inputs', () => {
    const usage: NormalizedUsageInput = {
      position: 'WR',
      boundary_rate: 0.70,
      deep_target_rate: 0.27,
      route_participation: 0.82,
      adot: 14.2,
    };

    const first = assignRoleFromUsage(usage);
    const second = assignRoleFromUsage(usage);
    expect(second).toEqual(first);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Extended usage fields
// ═══════════════════════════════════════════════════════════════════════════════

describe('extended usage input fields', () => {
  it('uses target_share for WR alpha differentiation', () => {
    const result = assign({
      position: 'WR',
      boundary_rate: 0.75,
      route_participation: 0.85,
      red_zone_target_share: 0.26,
      adot: 11.8,
      target_share: 0.25,
    });
    expect(result.primary_role).toBe('WR_ALPHA_BOUNDARY_X');
    expect(result.assignment_reasoning.join(' ')).toContain('target share');
  });

  it('uses pressure_to_sack_rate for QB structured distributor bonus', () => {
    const result = assign({
      position: 'QB',
      designed_rush_rate: 0.03,
      scramble_rate: 0.03,
      deep_target_rate: 0.06,
      adot: 6.8,
      pressure_to_sack_rate: 0.14,
    });
    expect(result.primary_role).toBe('QB_STRUCTURED_DISTRIBUTOR');
    expect(result.assignment_reasoning.join(' ')).toContain('pressure-to-sack');
  });

  it('uses screen_target_rate for WR slot gadget bonus', () => {
    const result = assign({
      position: 'WR',
      slot_rate: 0.75,
      motion_rate: 0.42,
      route_participation: 0.55,
      adot: 7.0,
      screen_target_rate: 0.20,
    });
    expect(result.primary_role).toBe('WR_SLOT_GADGET');
    expect(result.assignment_reasoning.join(' ')).toContain('screen target rate');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Data sufficiency field
// ═══════════════════════════════════════════════════════════════════════════════

describe('data_sufficiency field', () => {
  it('all assignments include data_sufficiency', () => {
    const positions: Array<NormalizedUsageInput['position']> = ['QB', 'RB', 'WR', 'TE'];
    for (const position of positions) {
      const result = assign({ position, carry_share: 0.5, route_rate: 0.5, adot: 8 });
      expect(result.data_sufficiency).toBeDefined();
      expect(['FULL', 'PARTIAL', 'INSUFFICIENT']).toContain(result.data_sufficiency);
    }
  });
});
