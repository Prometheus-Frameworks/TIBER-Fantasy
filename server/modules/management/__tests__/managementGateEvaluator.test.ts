import {
  FORGE_PLAYER_STATIC_SOURCE_ID,
  FORGE_PLAYER_SPECIFIC_TEAM_DIRECTION_USE,
  FORGE_GENERATED_BASELINE_VISIBILITY_USE,
  evaluateForgePlayerSpecificTeamDirection,
  evaluateForgeGeneratedBaselineVisibility,
  evaluateStrategyContextReadiness,
  evaluateTeamstateMovementSupportingContext,
  type ForgeStaticGateInput,
} from '../managementGateEvaluator';

const VALID_PLAYER_SPECIFIC: ForgeStaticGateInput = {
  artifactState: 'available',
  contractMatch: true,
  scoreSource: 'player_specific',
  governance: 'governed',
  coverage: { covered: 24, total: 30, minimumRate: 0.5 },
  fresh: true,
  consumerFailClosed: true,
  uiLabeled: true,
};

describe('FORGE player-specific evidence (Team Direction classification)', () => {
  it('resolves to the requested allowed level when ready with valid player-specific evidence', () => {
    const { resolved } = evaluateForgePlayerSpecificTeamDirection(VALID_PLAYER_SPECIFIC, 3);
    expect(resolved.effectiveLevel).toBe(3);
    expect(resolved.capped).toBe(false);
    expect(resolved.failedGates).toEqual([]);
  });

  it('caps generated baselines below Level 3 (visibility only)', () => {
    const { resolved } = evaluateForgePlayerSpecificTeamDirection(
      { ...VALID_PLAYER_SPECIFIC, scoreSource: 'generated_baseline' },
      3,
    );
    expect(resolved.effectiveLevel).toBe(1);
    expect(resolved.effectiveLevel).toBeLessThan(3);
    expect(resolved.failedGates).toContain('G3');
  });

  it('fails closed to Level 0 when the artifact is missing', () => {
    const { resolved } = evaluateForgePlayerSpecificTeamDirection(
      { ...VALID_PLAYER_SPECIFIC, artifactState: 'missing' },
      3,
    );
    expect(resolved.effectiveLevel).toBe(0);
    expect(resolved.failedGates).toContain('G1');
  });

  it('fails closed to Level 0 when required gate data is absent', () => {
    // No score source provided at all — required G3 has no input.
    const { scoreSource, ...withoutProvenance } = VALID_PLAYER_SPECIFIC;
    void scoreSource;
    const { resolved } = evaluateForgePlayerSpecificTeamDirection(withoutProvenance, 3);
    expect(resolved.effectiveLevel).toBe(0);
    expect(resolved.failedGates).toContain('G3');
  });

  it('fails closed on unknown provenance (non-evidence)', () => {
    const unknown = evaluateForgePlayerSpecificTeamDirection({ ...VALID_PLAYER_SPECIFIC, scoreSource: 'unknown' }, 3);
    expect(unknown.resolved.effectiveLevel).toBe(0);
    const fallback = evaluateForgePlayerSpecificTeamDirection({ ...VALID_PLAYER_SPECIFIC, scoreSource: 'fallback_default' }, 3);
    expect(fallback.resolved.effectiveLevel).toBe(0);
  });

  it('caps below evidence when coverage is under the documented rate', () => {
    const { resolved } = evaluateForgePlayerSpecificTeamDirection(
      { ...VALID_PLAYER_SPECIFIC, coverage: { covered: 5, total: 30, minimumRate: 0.5 } },
      3,
    );
    expect(resolved.effectiveLevel).toBe(2);
    expect(resolved.failedGates).toContain('G5');
  });

  it('preserves an out-of-scope Level 4 request as auditable but caps to max activatable', () => {
    const { resolved } = evaluateForgePlayerSpecificTeamDirection(VALID_PLAYER_SPECIFIC, 4);
    expect(resolved.requestedLevel).toBe(4);
    expect(resolved.effectiveLevel).toBe(3);
    expect(resolved.capped).toBe(true);
  });
});

describe('FORGE generated baseline visibility (independent use of same source)', () => {
  it('resolves generated baselines to visibility only', () => {
    const { resolved } = evaluateForgeGeneratedBaselineVisibility({
      artifactState: 'available',
      scoreSource: 'generated_baseline',
      uiLabeled: true,
    });
    expect(resolved.effectiveLevel).toBe(1);
  });

  it('keeps multiple uses of one source independent', () => {
    const classification = evaluateForgePlayerSpecificTeamDirection(VALID_PLAYER_SPECIFIC, 3);
    const baseline = evaluateForgeGeneratedBaselineVisibility({
      artifactState: 'available',
      scoreSource: 'generated_baseline',
      uiLabeled: true,
    });

    expect(classification.use.sourceId).toBe(FORGE_PLAYER_STATIC_SOURCE_ID);
    expect(baseline.use.sourceId).toBe(FORGE_PLAYER_STATIC_SOURCE_ID);
    expect(classification.use.useId).toBe(FORGE_PLAYER_SPECIFIC_TEAM_DIRECTION_USE);
    expect(baseline.use.useId).toBe(FORGE_GENERATED_BASELINE_VISIBILITY_USE);
    expect(classification.resolved.effectiveLevel).toBe(3);
    expect(baseline.resolved.effectiveLevel).toBe(1);
    expect(classification.resolved.effectiveLevel).not.toBe(baseline.resolved.effectiveLevel);
  });
});

describe('Strategy Context readiness (diagnostic only, no template activation)', () => {
  it('keeps a blocked context at read-only diagnostic visibility without activating templates', () => {
    const { resolved } = evaluateStrategyContextReadiness({ status: 'blocked', uiLabeled: true }, 1);
    // Visibility only: never reaches eligible-supporting (2), evidence (3), or advice (4).
    expect(resolved.effectiveLevel).toBe(1);
    expect(resolved.effectiveLevel).toBeLessThan(2);
    expect(resolved.capped).toBe(false);
  });

  it('hard-caps blocked status at Level 1 even when Level 2 is requested', () => {
    const blocked = evaluateStrategyContextReadiness({ status: 'blocked', uiLabeled: true }, 2);
    expect(blocked.resolved.requestedLevel).toBe(2);
    expect(blocked.resolved.effectiveLevel).toBe(1);
    expect(blocked.resolved.capped).toBe(true);
  });

  it('hard-caps available status at Level 1 when Level 2 or 3 is requested', () => {
    const atTwo = evaluateStrategyContextReadiness({ status: 'available', uiLabeled: true }, 2);
    expect(atTwo.resolved.effectiveLevel).toBe(1);
    const atThree = evaluateStrategyContextReadiness({ status: 'available', uiLabeled: true }, 3);
    expect(atThree.resolved.effectiveLevel).toBe(1);
  });

  it('fails closed to Level 0 when the context is unavailable', () => {
    const { resolved } = evaluateStrategyContextReadiness({ status: 'unavailable', uiLabeled: true }, 1);
    expect(resolved.effectiveLevel).toBe(0);
    expect(resolved.failedGates).toContain('G1');
  });

  it('fails closed to Level 0 when status data is missing', () => {
    const { resolved } = evaluateStrategyContextReadiness({ uiLabeled: true }, 1);
    expect(resolved.effectiveLevel).toBe(0);
    expect(resolved.failedGates).toContain('G1');
  });
});

describe('Teamstate movement v1 (read-only supporting context)', () => {
  it('caps fixture-backed context at Level 1', () => {
    const { resolved } = evaluateTeamstateMovementSupportingContext(
      { promotedStatus: 'ready', governance: 'fixture', fresh: true, uiLabeled: true },
      2,
    );
    expect(resolved.effectiveLevel).toBe(1);
    expect(resolved.failedGates).toContain('G4');
  });

  it('allows governed, fresh, ready, labeled context up to the supporting-context level', () => {
    const { resolved } = evaluateTeamstateMovementSupportingContext(
      { promotedStatus: 'ready', governance: 'governed', fresh: true, uiLabeled: true },
      2,
    );
    expect(resolved.effectiveLevel).toBe(2);
    expect(resolved.capped).toBe(false);
  });

  it('caps unlabeled governed context below Level 2 (Level 1)', () => {
    const { resolved } = evaluateTeamstateMovementSupportingContext(
      { promotedStatus: 'ready', governance: 'governed', fresh: true, uiLabeled: false },
      2,
    );
    expect(resolved.effectiveLevel).toBe(1);
    expect(resolved.failedGates).toContain('G8');
  });

  it('fails closed to Level 0 when required UI labeling data is missing', () => {
    const { resolved } = evaluateTeamstateMovementSupportingContext(
      { promotedStatus: 'ready', governance: 'governed', fresh: true },
      2,
    );
    expect(resolved.effectiveLevel).toBe(0);
    expect(resolved.failedGates).toContain('G8');
  });

  it('fails closed to Level 0 when the promoted status is not ready', () => {
    const { resolved } = evaluateTeamstateMovementSupportingContext(
      { promotedStatus: 'missing_export_artifact', governance: 'governed', fresh: true, uiLabeled: true },
      2,
    );
    expect(resolved.effectiveLevel).toBe(0);
    expect(resolved.failedGates).toContain('G1');
  });

  it('fails closed to Level 0 when governance is unknown (never inferred)', () => {
    const { resolved } = evaluateTeamstateMovementSupportingContext(
      { promotedStatus: 'ready', governance: 'unknown', fresh: true, uiLabeled: true },
      2,
    );
    expect(resolved.effectiveLevel).toBe(0);
    expect(resolved.failedGates).toContain('G4');
  });
});
