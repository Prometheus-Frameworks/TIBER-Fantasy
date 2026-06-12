import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildManagementStrategyContext } from '../managementStrategyContext';

const representativeDiagnostics = {
  rosterCount: 30,
  resolvedCanonicalCount: 352,
  strategyOntologyArtifact: {
    available: true,
    artifactType: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
    contractVersion: 'dynasty_strategy_ontology_v1',
    modelVersion: 'dynasty-strategy-ontology-v1.0.0',
    generatedAt: '2026-06-10T00:00:00.000Z',
    futureContractInputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
  },
};

const representativeTeamDirection = {
  direction: 'rebuild',
  confidence: 'high',
  evidenceCoverage: { matched: 24, total: 30, rate: 0.8, rookieAlphaMatched: 0 },
  forgeCoverage: { matched: 24, total: 30, rate: 0.8 },
  coverage: { matched: 30, total: 30, rate: 1 },
};

describe('buildManagementStrategyContext', () => {
  it('builds a read-only strategy context from representative Management diagnostics', () => {
    const context = buildManagementStrategyContext({
      teamDirection: representativeTeamDirection,
      diagnostics: representativeDiagnostics,
      rosterVisibility: { total: 30, identityCovered: 30, forgeScored: 24, rookieAlphaFallback: 0, evidenceCovered: 24, unresolved: 0 },
      strategyTemplateDiagnostics: {
        available: true,
        template_selection_enabled: false,
        selected_template_id: null,
        missing_future_contract_inputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
        unavailable_reason: null,
      },
      rosterTimelineSignals: { roster_age_band: 'mixed' },
      assetArchetypeSignals: { premium_asset_density: 'low' },
      managementTensions: ['premium_asset_timeline_mismatch'],
    });

    expect(context).toMatchObject({
      available: true,
      status: 'blocked',
      team_direction: 'rebuild',
      team_direction_confidence: 'high',
      evidence_coverage: { matched: 24, total: 30, rate: 0.8, rookieAlphaMatched: 0 },
      identity_coverage: { matched: 30, total: 30, rate: 1 },
      forge_coverage: { matched: 24, total: 30, rate: 0.8 },
      strategy_ontology_available: true,
      strategy_template_selection_enabled: false,
      selected_template_id: null,
      blocked_reasons: ['strategy_template_activation_deferred'],
      missing_inputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
      roster_timeline_signals: { roster_age_band: 'mixed' },
      asset_archetype_signals: { premium_asset_density: 'low' },
      management_tensions: ['premium_asset_timeline_mismatch'],
      source_summary: {
        roster_count: 30,
        resolved_identity_rows_scanned: 352,
        strategy_ontology_contract_version: 'dynasty_strategy_ontology_v1',
        strategy_ontology_model_version: 'dynasty-strategy-ontology-v1.0.0',
        strategy_ontology_generated_at: '2026-06-10T00:00:00.000Z',
      },
    });
  });

  it('preserves Team Direction and confidence without recalculating them', () => {
    const context = buildManagementStrategyContext({
      teamDirection: { ...representativeTeamDirection, direction: 'uncertain', confidence: 'low' },
      diagnostics: representativeDiagnostics,
    });

    expect(context.team_direction).toBe('uncertain');
    expect(context.team_direction_confidence).toBe('low');
  });

  it('keeps Strategy Template activation disabled and unselected', () => {
    const context = buildManagementStrategyContext({
      teamDirection: representativeTeamDirection,
      diagnostics: representativeDiagnostics,
    });

    expect(context.strategy_template_selection_enabled).toBe(false);
    expect(context.selected_template_id).toBeNull();
    expect(context.status).toBe('blocked');
  });

  it('fails closed when ontology diagnostics are missing', () => {
    const context = buildManagementStrategyContext({
      teamDirection: representativeTeamDirection,
      diagnostics: null,
    });

    expect(context).toMatchObject({
      available: false,
      status: 'unavailable',
      strategy_ontology_available: false,
      strategy_template_selection_enabled: false,
      selected_template_id: null,
      blocked_reasons: ['strategy_ontology_diagnostics_missing'],
    });
  });

  it('fails closed when Team Direction is missing', () => {
    const context = buildManagementStrategyContext({
      diagnostics: representativeDiagnostics,
    });

    expect(context.available).toBe(false);
    expect(context.status).toBe('blocked');
    expect(context.blocked_reasons).toEqual(['team_direction_missing', 'team_direction_confidence_missing']);
    expect(context.selected_template_id).toBeNull();
  });

  it('does not expose template text or interpolation content', () => {
    const context = buildManagementStrategyContext({
      teamDirection: representativeTeamDirection,
      diagnostics: representativeDiagnostics,
      assetArchetypeSignals: { archetype_id: 'premium_asset' },
    });

    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain('template_text');
    expect(serialized).not.toContain('body');
    expect(serialized).not.toContain('{{');
  });

  it('does not import from server in shared/client-safe code', () => {
    const source = readFileSync(resolve(process.cwd(), 'shared/managementStrategyContext.ts'), 'utf8');

    expect(source).not.toContain("from '../server");
    expect(source).not.toContain("from './server");
    expect(source).not.toContain("from 'server/");
    expect(source).not.toContain('fs');
    expect(source).not.toContain('process.env');
  });
});
