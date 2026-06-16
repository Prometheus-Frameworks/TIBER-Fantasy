import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MANAGEMENT_ACTIVATION_LEVELS,
  MANAGEMENT_ACTIVATION_LEVEL_META,
  MANAGEMENT_MAX_ACTIVATABLE_LEVEL,
  MANAGEMENT_OUT_OF_SCOPE_LEVEL,
  READINESS_GATE_IDS,
  READINESS_GATE_META,
  compareActivationLevels,
  isActivatableLevel,
  isOutOfScopeLevel,
  resolveManagementUseActivation,
  type ManagementActivationLevel,
  type ManagementSourceUse,
  type ReadinessGateResult,
} from '../managementActivation';

function gate(
  partial: Partial<ReadinessGateResult> & Pick<ReadinessGateResult, 'gate' | 'passed'>,
): ReadinessGateResult {
  return {
    use: 'test_use',
    effectiveCap: null,
    reason: partial.reason ?? 'test',
    ...partial,
  };
}

describe('management activation levels', () => {
  it('declares levels 0–4 in ascending order', () => {
    expect(MANAGEMENT_ACTIVATION_LEVELS).toEqual([0, 1, 2, 3, 4]);
    // Level metadata is index-aligned with the level value.
    MANAGEMENT_ACTIVATION_LEVEL_META.forEach((meta, index) => {
      expect(meta.level).toBe(index);
    });
  });

  it('orders levels by numeric value via compareActivationLevels', () => {
    expect(compareActivationLevels(0, 1)).toBeLessThan(0);
    expect(compareActivationLevels(3, 2)).toBeGreaterThan(0);
    expect(compareActivationLevels(2, 2)).toBe(0);

    const shuffled: ManagementActivationLevel[] = [3, 0, 4, 1, 2];
    expect([...shuffled].sort(compareActivationLevels)).toEqual([0, 1, 2, 3, 4]);
  });

  it('treats Level 4 only as a declared out-of-scope value, never an enabled state', () => {
    const level4 = MANAGEMENT_ACTIVATION_LEVEL_META.find((meta) => meta.level === 4);
    expect(level4?.outOfScope).toBe(true);
    expect(MANAGEMENT_OUT_OF_SCOPE_LEVEL).toBe(4);

    // Levels 0–3 are real, resolvable states; Level 4 is not.
    expect(isActivatableLevel(MANAGEMENT_MAX_ACTIVATABLE_LEVEL)).toBe(true);
    expect(isActivatableLevel(4)).toBe(false);
    expect(isOutOfScopeLevel(4)).toBe(true);
    [0, 1, 2, 3].forEach((level) => {
      expect(isActivatableLevel(level as ManagementActivationLevel)).toBe(true);
      expect(isOutOfScopeLevel(level as ManagementActivationLevel)).toBe(false);
    });

    // Only one out-of-scope level exists.
    expect(MANAGEMENT_ACTIVATION_LEVEL_META.filter((meta) => meta.outOfScope)).toHaveLength(1);
  });

  it('declares readiness gates G1–G8', () => {
    expect(READINESS_GATE_IDS).toEqual(['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']);
    expect(READINESS_GATE_META.map((meta) => meta.id)).toEqual(READINESS_GATE_IDS);
  });
});

describe('resolveManagementUseActivation', () => {
  it('keeps the requested level when every gate passes without a cap', () => {
    const use: ManagementSourceUse = {
      sourceId: 'forge_player_static_v1',
      useId: 'team_direction_classification',
      requestedLevel: 3,
      gateResults: READINESS_GATE_IDS.map((id) => gate({ gate: id, passed: true })),
    };

    const resolved = resolveManagementUseActivation(use);
    expect(resolved.effectiveLevel).toBe(3);
    expect(resolved.capped).toBe(false);
    expect(resolved.failedGates).toEqual([]);
  });

  it('caps/demotes the effective level when a gate fails', () => {
    const use: ManagementSourceUse = {
      sourceId: 'forge_player_static_v1',
      useId: 'team_direction_classification',
      requestedLevel: 3,
      gateResults: [
        gate({ gate: 'G1', passed: true }),
        // G3 non-evidence provenance caps at visibility (Level 2), never Level 3.
        gate({ gate: 'G3', passed: false, effectiveCap: 2, reason: 'generated_baseline is visibility only' }),
      ],
    };

    const resolved = resolveManagementUseActivation(use);
    expect(resolved.effectiveLevel).toBe(2);
    expect(resolved.capped).toBe(true);
    expect(resolved.failedGates).toContain('G3');
  });

  it('takes the minimum cap across multiple constraining gates (conjunctive gates)', () => {
    const use: ManagementSourceUse = {
      sourceId: 'forge_player_static_v1',
      useId: 'team_direction_classification',
      requestedLevel: 3,
      gateResults: [
        gate({ gate: 'G3', passed: false, effectiveCap: 2, reason: 'provenance caps at visibility' }),
        // A passing coverage gate may still cap confidence.
        gate({ gate: 'G5', passed: true, effectiveCap: 1, reason: 'coverage below threshold' }),
      ],
    };

    const resolved = resolveManagementUseActivation(use);
    expect(resolved.effectiveLevel).toBe(1);
    expect(resolved.capped).toBe(true);
  });

  it('fails closed to Level 0 when a failing gate gives no cap', () => {
    const use: ManagementSourceUse = {
      sourceId: 'teamstate_movement_v1',
      useId: 'supporting_context',
      requestedLevel: 2,
      gateResults: [gate({ gate: 'G1', passed: false, effectiveCap: null, reason: 'missing_export_artifact' })],
    };

    const resolved = resolveManagementUseActivation(use);
    expect(resolved.effectiveLevel).toBe(0);
    expect(resolved.failedGates).toEqual(['G1']);
  });

  it('lets multiple uses of one source resolve to different activation levels', () => {
    const sourceId = 'forge_player_static_v1';
    const classification = resolveManagementUseActivation({
      sourceId,
      useId: 'team_direction_classification',
      requestedLevel: 3,
      gateResults: [gate({ gate: 'G3', passed: true })],
    });
    const coverage = resolveManagementUseActivation({
      sourceId,
      useId: 'coverage_accounting',
      requestedLevel: 2,
      gateResults: [gate({ gate: 'G3', passed: true })],
    });

    expect(classification.sourceId).toBe(coverage.sourceId);
    expect(classification.effectiveLevel).toBe(3);
    expect(coverage.effectiveLevel).toBe(2);
    expect(classification.effectiveLevel).not.toBe(coverage.effectiveLevel);
  });

  it('cannot promote a source when required gate data is missing', () => {
    const use: ManagementSourceUse = {
      sourceId: 'point_scenarios',
      useId: 'supporting_context',
      requestedLevel: 2,
      // No gate results at all — absence must never be read as evidence.
      gateResults: [],
    };

    const resolved = resolveManagementUseActivation(use, { requiredGates: ['G1', 'G5', 'G6'] });
    expect(resolved.effectiveLevel).toBe(0);
    expect(resolved.failedGates).toEqual(expect.arrayContaining(['G1', 'G5', 'G6']));
    expect(resolved.capped).toBe(true);
  });

  it('never resolves to the out-of-scope Level 4, even if requested', () => {
    const resolved = resolveManagementUseActivation({
      sourceId: 'any',
      useId: 'any',
      requestedLevel: MANAGEMENT_OUT_OF_SCOPE_LEVEL,
      gateResults: READINESS_GATE_IDS.map((id) => gate({ gate: id, passed: true })),
    });
    expect(resolved.effectiveLevel).toBe(MANAGEMENT_MAX_ACTIVATABLE_LEVEL);
    expect(isActivatableLevel(resolved.effectiveLevel)).toBe(true);
  });
});

describe('docs reference', () => {
  it('points back to the Phase 4 activation plan', () => {
    const source = readFileSync(resolve(process.cwd(), 'shared/managementActivation.ts'), 'utf8');
    expect(source).toContain('docs/product/MANAGEMENT_PHASE4_ACTIVATION_PLAN.md');
  });
});
