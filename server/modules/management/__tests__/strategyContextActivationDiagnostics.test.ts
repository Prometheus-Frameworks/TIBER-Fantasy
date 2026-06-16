import { buildStrategyContextActivationDiagnostics } from '../strategyContextActivationDiagnostics';
import {
  buildManagementStrategyContext,
  type ManagementStrategyContext,
} from '@shared/managementStrategyContext';

// A representative inspectable (blocked) context: ontology available, direction
// and confidence present, template selection deferred.
const blockedContext: ManagementStrategyContext = buildManagementStrategyContext({
  teamDirection: { direction: 'rebuild', confidence: 'high' },
  diagnostics: {
    rosterCount: 30,
    strategyOntologyArtifact: {
      available: true,
      artifactType: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
      contractVersion: 'dynasty_strategy_ontology_v1',
      modelVersion: 'dynasty-strategy-ontology-v1.0.0',
      generatedAt: '2026-06-10T00:00:00.000Z',
      futureContractInputs: ['age_band', 'experience_band'],
    },
  },
});

// An unavailable context: ontology missing → fails closed.
const unavailableContext: ManagementStrategyContext = buildManagementStrategyContext({
  teamDirection: { direction: null, confidence: null },
  diagnostics: { rosterCount: 30, strategyOntologyArtifact: null },
});

describe('buildStrategyContextActivationDiagnostics', () => {
  it('is explicitly diagnostic/read-only and never activates templates', () => {
    const diag = buildStrategyContextActivationDiagnostics(blockedContext);
    expect(diag.diagnostic).toBe(true);
    expect(diag.readOnly).toBe(true);
    expect(diag.templateSelectionEnabled).toBe(false);
    expect(diag.selectedTemplateId).toBeNull();
  });

  it('surfaces a blocked context as visibility-only (Level 1) without activating templates', () => {
    const diag = buildStrategyContextActivationDiagnostics(blockedContext);
    expect(diag.status).toBe('blocked');
    expect(diag.inspectable).toBe(true);
    // Requested the Level 2 ceiling, but capped down to diagnostic visibility.
    expect(diag.requestedLevel).toBe(2);
    expect(diag.effectiveLevel).toBe(1);
    expect(diag.capped).toBe(true);
    expect(diag.explanation).toMatch(/read-only diagnostic visibility/i);
    expect(diag.templateSelectionEnabled).toBe(false);
    expect(diag.selectedTemplateId).toBeNull();
  });

  it('surfaces an unavailable context as a diagnostic failure at Level 0 with a reason', () => {
    const diag = buildStrategyContextActivationDiagnostics(unavailableContext);
    expect(diag.status).toBe('unavailable');
    expect(diag.effectiveLevel).toBe(0);
    expect(diag.failedGates).toContain('G1');
    expect(diag.explanation).toMatch(/unavailable/i);
    expect(diag.blockedReasons.length).toBeGreaterThan(0);
  });

  it('caps an inspectable/available status at diagnostic visibility in this slice', () => {
    // 'available' is never emitted by the builder while deferred, but the
    // normalizer/evaluator must still cap it to visibility if it ever appears.
    const diag = buildStrategyContextActivationDiagnostics({ status: 'available', available: true }, 3);
    expect(diag.status).toBe('available');
    expect(diag.effectiveLevel).toBe(1);
    expect(diag.requestedLevel).toBe(3);
    expect(diag.capped).toBe(true);
  });

  it('fails closed to Level 0 when the context is missing/null', () => {
    const diag = buildStrategyContextActivationDiagnostics(null);
    expect(diag.status).toBeNull();
    expect(diag.effectiveLevel).toBe(0);
    expect(diag.failedGates).toContain('G1');
    expect(diag.explanation).toMatch(/missing/i);
  });

  it('fails closed through the existing normalizer on unsafe/malformed input', () => {
    // A hostile payload that tries to force template activation and inject a body.
    const diag = buildStrategyContextActivationDiagnostics({
      status: 'available',
      strategy_template_selection_enabled: true,
      selected_template_id: 'evil-template',
      notes: ['You should trade away your RB1 immediately {{interp}}'],
    });
    // Invariants hold regardless of input.
    expect(diag.templateSelectionEnabled).toBe(false);
    expect(diag.selectedTemplateId).toBeNull();
    // Status normalizes; 'available' with available flag survives but caps to visibility.
    expect(diag.effectiveLevel).toBeLessThanOrEqual(1);
  });

  it('does not expose any rendered template body/content', () => {
    const diag = buildStrategyContextActivationDiagnostics(blockedContext);
    const serialized = JSON.stringify(diag);
    expect(serialized).not.toMatch(/\{\{|\}\}/); // no interpolation markers
    expect(diag).not.toHaveProperty('templateBody');
    expect(diag).not.toHaveProperty('renderedTemplate');
    expect(diag).not.toHaveProperty('template');
  });

  it('keeps gate metadata scoped to the strategy context readiness use', () => {
    const diag = buildStrategyContextActivationDiagnostics(blockedContext);
    expect(diag.useId).toBe('strategy_context.readiness');
    diag.gateResults.forEach((gate) => expect(gate.use).toBe(diag.useId));
  });
});
