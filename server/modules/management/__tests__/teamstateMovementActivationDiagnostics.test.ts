import {
  buildTeamstateMovementActivationDiagnostics,
  type TeamstateMovementActivationInput,
} from '../teamstateMovementActivationDiagnostics';

const NOW = Date.parse('2026-06-17T00:00:00.000Z');

// ready + v1 contract + governed + fresh + labeled.
const READY_GOVERNED: TeamstateMovementActivationInput = {
  state: 'ready',
  artifact: 'team_environment_movement_v1',
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

  it('resolves ready/v1-contract/governed/fresh/labeled to Level 2', () => {
    const diag = build(READY_GOVERNED);
    expect(diag.promotedStatus).toBe('ready');
    expect(diag.contractMatch).toBe(true);
    expect(diag.governance).toBe('governed');
    expect(diag.fresh).toBe(true);
    expect(diag.effectiveLevel).toBe(2);
    expect(diag.capped).toBe(false);
    expect(diag.failedGates).toEqual([]);
    expect(diag.explanation).toMatch(/supporting context/i);
  });

  it('fails closed on the legacy v0 artifact literal (G2 contract gate)', () => {
    const v0 = build({ ...READY_GOVERNED, artifact: 'team_environment_movement_v0' });
    expect(v0.contractMatch).toBe(false);
    expect(v0.effectiveLevel).toBe(0);
    expect(v0.failedGates).toContain('G2');
  });

  it('fails closed when the artifact literal is missing', () => {
    const { artifact, ...withoutArtifact } = READY_GOVERNED;
    void artifact;
    const diag = build(withoutArtifact);
    expect(diag.contractMatch).toBeNull();
    expect(diag.effectiveLevel).toBe(0);
    expect(diag.failedGates).toContain('G2');
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

  describe('governance is never derived from unverified provenance tokens', () => {
    // A non-promoted path: governance can only come from a provenance token here.
    const NON_PROMOTED_PATH = 'server/artifacts/external/teamstate/team_environment_movement_v1.json';

    it('keeps fixture_scaffold as fixture (caps at Level 1)', () => {
      const diag = build({ ...READY_GOVERNED, provenanceStatus: 'fixture_scaffold', artifactPath: NON_PROMOTED_PATH });
      expect(diag.governance).toBe('fixture');
      expect(diag.effectiveLevel).toBe(1);
    });

    it('does not accept a bare "governed" provenance token (fails closed as unknown)', () => {
      const diag = build({ ...READY_GOVERNED, provenanceStatus: 'governed', artifactPath: NON_PROMOTED_PATH });
      expect(diag.governance).toBe('unknown');
      expect(diag.effectiveLevel).toBe(0);
      expect(diag.failedGates).toContain('G4');
    });

    it.each(['promoted', 'production', 'production_promoted', 'governed_promoted'])(
      'does not accept "%s" as governed without a promoted path boundary',
      (token) => {
        const diag = build({ ...READY_GOVERNED, provenanceStatus: token, artifactPath: NON_PROMOTED_PATH });
        expect(diag.governance).toBe('unknown');
        expect(diag.effectiveLevel).toBe(0);
        expect(diag.failedGates).toContain('G4');
      },
    );

    it('fails closed when provenance is missing and there is no promoted boundary', () => {
      const diag = build({ ...READY_GOVERNED, provenanceStatus: null, artifactPath: NON_PROMOTED_PATH });
      expect(diag.governance).toBe('unknown');
      expect(diag.effectiveLevel).toBe(0);
    });

    it('reaches Level 2 only via the promoted-path boundary with full readiness', () => {
      // Even an unverified governed-like token is ignored; the promoted path drives governance.
      const diag = build({ ...READY_GOVERNED, provenanceStatus: 'governed_promoted' });
      expect(diag.governance).toBe('governed');
      expect(diag.promotedStatus).toBe('ready');
      expect(diag.contractMatch).toBe(true);
      expect(diag.fresh).toBe(true);
      expect(diag.effectiveLevel).toBe(2);
    });
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
