import {
  buildForgeEvidenceActivationDiagnostics,
  type ForgeEvidenceActivationInput,
} from '../forgeEvidenceActivationDiagnostics';

// A complete, passing set of FORGE readiness inputs: available governed promoted
// artifact, fresh, with player-specific evidence covering ≥ 50% of the roster.
const READY_PLAYER_SPECIFIC: ForgeEvidenceActivationInput = {
  forgeArtifact: {
    state: 'available',
    available: true,
    sourcePath: '../TIBER-FORGE/exports/promoted/forge_player_static/forge_player_static_v1.json',
    generatedAt: '2026-06-15T00:00:00.000Z',
    freshness: { status: 'fresh' },
    contractVersion: 'forge_player_static_v1',
    playerSpecificCount: 24,
    generatedBaselineCount: 0,
  },
  rosterMatching: {
    playerSpecificRosterMatches: 24,
    generatedBaselineRosterMatches: 0,
    rosterCanonicalIdsChecked: 30,
    rosterCanonicalIdsMatched: 24,
  },
  forgeCoverage: { matched: 24, total: 30, rate: 0.8 },
};

describe('buildForgeEvidenceActivationDiagnostics', () => {
  it('is explicitly diagnostic/read-only citation metadata', () => {
    const diag = buildForgeEvidenceActivationDiagnostics(READY_PLAYER_SPECIFIC);
    expect(diag.diagnostic).toBe(true);
    expect(diag.readOnly).toBe(true);
    expect(diag.playerSpecific.useId).toBe('forge_player_specific.team_direction_classification');
    expect(diag.generatedBaseline.useId).toBe('forge_generated_baseline.visibility');
    expect(diag.playerSpecific.sourceId).toBe(diag.generatedBaseline.sourceId);
  });

  it('resolves player-specific FORGE evidence to Level 3 when readiness inputs pass', () => {
    const diag = buildForgeEvidenceActivationDiagnostics(READY_PLAYER_SPECIFIC);
    expect(diag.playerSpecific.scoreSource).toBe('player_specific');
    expect(diag.playerSpecific.effectiveLevel).toBe(3);
    expect(diag.playerSpecific.capped).toBe(false);
    expect(diag.playerSpecific.failedGates).toEqual([]);
    expect(diag.playerSpecific.explanation).toMatch(/Level 3/);
  });

  it('keeps generated baselines visibility-only and below Level 3', () => {
    const diag = buildForgeEvidenceActivationDiagnostics({
      ...READY_PLAYER_SPECIFIC,
      forgeArtifact: { ...READY_PLAYER_SPECIFIC.forgeArtifact!, generatedBaselineCount: 6 },
      rosterMatching: { playerSpecificRosterMatches: 0, generatedBaselineRosterMatches: 6, rosterCanonicalIdsChecked: 30, rosterCanonicalIdsMatched: 6 },
    });
    expect(diag.generatedBaseline.effectiveLevel).toBe(1);
    expect(diag.generatedBaseline.effectiveLevel).toBeLessThan(3);
    // The player-specific use cannot reach Level 3 when only baselines exist.
    expect(diag.playerSpecific.scoreSource).toBe('generated_baseline');
    expect(diag.playerSpecific.effectiveLevel).toBeLessThan(3);
  });

  it('fails closed when the FORGE artifact is missing', () => {
    const diag = buildForgeEvidenceActivationDiagnostics({
      forgeArtifact: { state: 'missing', available: false, sourcePath: '../TIBER-FORGE/exports/promoted/forge_player_static/forge_player_static_v1.json' },
      rosterMatching: { playerSpecificRosterMatches: 0, generatedBaselineRosterMatches: 0 },
      forgeCoverage: { matched: 0, total: 30, rate: 0 },
    });
    expect(diag.playerSpecific.effectiveLevel).toBe(0);
    expect(diag.playerSpecific.failedGates).toContain('G1');
    expect(diag.generatedBaseline.effectiveLevel).toBe(0);
  });

  it('does not treat unknown/fallback provenance as evidence', () => {
    const diag = buildForgeEvidenceActivationDiagnostics({
      ...READY_PLAYER_SPECIFIC,
      rosterMatching: { playerSpecificRosterMatches: 0, generatedBaselineRosterMatches: 0, rosterCanonicalIdsChecked: 30, rosterCanonicalIdsMatched: 0 },
    });
    // No player-specific or generated rows matched → provenance unknown → not evidence.
    expect(diag.playerSpecific.scoreSource).toBe('unknown');
    expect(diag.playerSpecific.effectiveLevel).toBeLessThan(3);
    expect(diag.playerSpecific.failedGates).toContain('G3');
  });

  it('caps a fixture-backed (non-promoted) artifact below Level 3', () => {
    const diag = buildForgeEvidenceActivationDiagnostics({
      ...READY_PLAYER_SPECIFIC,
      forgeArtifact: { ...READY_PLAYER_SPECIFIC.forgeArtifact!, sourcePath: 'server/artifacts/fixtures/forge_player_static_v1.json' },
    });
    expect(diag.playerSpecific.effectiveLevel).toBeLessThan(3);
    expect(diag.playerSpecific.failedGates).toContain('G4');
  });

  it('emits no recommendation/advice language', () => {
    const diag = buildForgeEvidenceActivationDiagnostics(READY_PLAYER_SPECIFIC);
    const serialized = JSON.stringify(diag).toLowerCase();
    expect(serialized).not.toMatch(/\brecommend|\badvis|\byou should|\btrade away|\bstart\b|\bsit\b|\bwaiver|\bdrop\b/);
  });

  it('carries provenance and coverage summaries from the existing diagnostics unchanged', () => {
    const diag = buildForgeEvidenceActivationDiagnostics(READY_PLAYER_SPECIFIC);
    expect(diag.provenanceSummary).toEqual({
      artifactState: 'available',
      playerSpecificMatches: 24,
      generatedBaselineMatches: 0,
      playerSpecificCount: 24,
      generatedBaselineCount: 0,
    });
    expect(diag.coverage).toEqual({ matched: 24, total: 30, rate: 0.8 });
  });
});
