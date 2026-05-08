import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StressLab from '@/pages/StressLab';
import { buildMockOperatorSignalNoteArtifact } from '@/lib/stressLab';

describe('Stress Lab v0 mock artifact builder', () => {
  it('builds deterministic operator_signal_note_v0 artifacts with conservative heuristics and guardrails', () => {
    const note = 'NFC North WR note: EPA/Play is improving, Catchable Target quality is up, Red Zone route usage and target share need verification.';
    const first = buildMockOperatorSignalNoteArtifact(note);
    const second = buildMockOperatorSignalNoteArtifact(note);

    expect(first).toEqual(second);
    expect(first.source_type).toBe('operator_entered_note');
    expect(first.raw_note).toBe(note);
    expect(first.reasoning_status).toBe('requires_followup');
    expect(first.detected_metrics.map((metric) => metric.metric_id)).toEqual([
      'epa_per_play',
      'catchable_target_rate',
      'route_participation',
      'target_share',
    ]);
    expect(first.signal_tags).toEqual([
      'epa_context_signal',
      'target_quality_signal',
      'route_role_signal',
      'usage_signal',
      'red_zone_context',
      'division_strength_context',
      'operator_hypothesis',
    ]);
    expect(first.entities).toEqual([
      {
        label: 'NFC North',
        entity_type: 'division',
        extraction_confidence: 'heuristic',
      },
    ]);
    expect(first.do_not_apply).toContain('Do not mutate rankings from this note alone.');
    expect(first.do_not_apply).toContain('Do not treat operator notes as verified source truth.');
    expect(first.do_not_apply).toContain('Do not fabricate missing context.');
    expect(first.uncertainty).toContain('Automated parsing is not implemented in v0.');
    expect(first.uncertainty).toContain('Source verification is required before downstream application.');
  });

  it('renders the read-only reasoning sandbox stance', () => {
    const html = renderToStaticMarkup(React.createElement(StressLab));

    expect(html).toContain('TIBER Stress Lab');
    expect(html).toContain('operator_signal_note_v0');
    expect(html).toContain('Operator notes generate hypotheses, not truth.');
    expect(html).toContain('Stress Lab is for testing reasoning integrity, not changing rankings.');
    expect(html).toContain('No mutation path');
    expect(html).toContain('Inspect note');
  });
});
