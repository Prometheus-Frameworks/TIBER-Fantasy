import {
  buildTeamstateMovementActivationDiagnostics,
  type TeamstateMovementActivationInput,
} from '../teamstateMovementActivationDiagnostics';

const NOW = Date.parse('2026-06-17T00:00:00.000Z');

// ready + governed + fresh + labeled.
const READY_GOVERNED: TeamstateMovementActivationInput = {
  state: 'ready',
  generatedAt: '2026-06-15T00:00:00.000Z',
  provenanceStatus: 'governed',
  artifactPath: '../TIBER-Teamstate/exports/promoted/team_environment_movement/team_environment_movement_v1.json',
  uiLabeled: true,
};

function build(input: TeamstateMovementActivationInput) {
  return buildTeamstateMovementActivationDiagnostics(input, { now: NOW });
}

describe('buildTeamstateMovementActivationDiagnostics', () => {
  it('is explicitly diagnostic/read-only supporting context', () => {
    const diag = build(READY_GOVERNED);
    expect(diag.diagnostic).toBe(true);
    expect(diag.readOnly).toBe(true);
    expect(diag.supportingContext).toBe(true);
    expect(diag.useId).toBe('teamstate_movement_v1.supporting_context');
    expect(diag.sourceId).toBe('teamstate_movement_v1');
  });

  it('resolves ready/governed/fresh/labeled to Level 2', () => {
    const diag = build(READY_GOVERNED);
    expect(diag.promotedStatus).toBe('ready');
    expect(diag.governance).toBe('governed');
    expect(diag.fresh).toBe(true);
    expect(diag.effectiveLevel).toBe(2);
    expect(diag.capped).toBe(false);
    expect(diag.failedGates).toEqual([]);
    expect(diag.explanation).toMatch(/supporting context/i);
  });

  it('treats a promoted artifact path as governed even without a governed provenance token', () => {
    const diag = build({ ...READY_GOVERNED, provenanceStatus: null });
    expect(diag.governance).toBe('governed');
    expect(diag.effectiveLevel).toBe(2);
  });

  it('caps fixture-backed movement at Level 1', () => {
    const diag = build({
      ...READY_GOVERNED,
      provenanceStatus: 'fixture_scaffold',
      artifactPath: 'server/artifacts/fixtures/team_environment_movement_v1.json',
    });
    expect(diag.governance).toBe('fixture');
    expect(diag.effectiveLevel).toBe(1);
    expect(diag.failedGates).toContain('G4');
  });

  it('fails closed when the promoted status is not ready', () => {
    const unavailable = build({ ...READY_GOVERNED, state: 'unavailable' });
    expect(unavailable.promotedStatus).toBe('missing_export_artifact');
    expect(unavailable.effectiveLevel).toBe(0);
    expect(unavailable.failedGates).toContain('G1');

    const error = build({ ...READY_GOVERNED, state: 'error' });
    expect(error.promotedStatus).toBe('upstream_unavailable');
    expect(error.effectiveLevel).toBe(0);
    expect(error.failedGates).toContain('G1');
  });

  it('fails closed when governance is unknown/missing (never inferred)', () => {
    const diag = build({
      ...READY_GOVERNED,
      provenanceStatus: 'something_unrecognized',
      artifactPath: 'server/artifacts/external/teamstate/team_environment_movement_v1.json',
    });
    expect(diag.governance).toBe('unknown');
    expect(diag.effectiveLevel).toBe(0);
    expect(diag.failedGates).toContain('G4');
  });

  it('caps to Level 1 when UI labeling is explicitly absent', () => {
    const diag = build({ ...READY_GOVERNED, uiLabeled: false });
    expect(diag.effectiveLevel).toBe(1);
    expect(diag.failedGates).toContain('G8');
  });

  it('fails closed when UI labeling data is missing entirely', () => {
    const { uiLabeled, ...withoutLabeling } = READY_GOVERNED;
    void uiLabeled;
    const diag = build(withoutLabeling);
    expect(diag.effectiveLevel).toBe(0);
    expect(diag.failedGates).toContain('G8');
  });

  it('treats stale data as not current certainty (caps below Level 2)', () => {
    const diag = build({ ...READY_GOVERNED, generatedAt: '2026-01-01T00:00:00.000Z' });
    expect(diag.fresh).toBe(false);
    expect(diag.effectiveLevel).toBeLessThan(2);
    expect(diag.failedGates).toContain('G6');
  });

  it('fails closed when freshness data is missing', () => {
    const diag = build({ ...READY_GOVERNED, generatedAt: null });
    expect(diag.fresh).toBeNull();
    expect(diag.effectiveLevel).toBe(0);
    expect(diag.failedGates).toContain('G6');
  });

  it('emits no recommendation/advice language', () => {
    const serialized = JSON.stringify(build(READY_GOVERNED)).toLowerCase();
    expect(serialized).not.toMatch(/\brecommend|\badvis|you should|trade away|\bwaiver|start\/sit/);
  });

  it('keeps gate metadata scoped to the movement supporting-context use', () => {
    const diag = build(READY_GOVERNED);
    diag.gateResults.forEach((gate) => expect(gate.use).toBe(diag.useId));
  });
});
