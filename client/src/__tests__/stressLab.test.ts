import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StressLab from '@/pages/StressLab';
import { buildMockOperatorSignalNoteArtifact } from '@/lib/stressLab';

describe('Stress Lab v0 mock artifact builder', () => {
  it('builds deterministic operator_signal_note_v0 artifacts with contract-aligned metrics and guardrails', () => {
    const note = '2026 NFC North WR note: EPA/Play is improving, Catchable Target quality is up, Red Zone route usage and target share need verification.';
    const first = buildMockOperatorSignalNoteArtifact(note);
    const second = buildMockOperatorSignalNoteArtifact(note);

    expect(first).toEqual(second);
    expect(first.source_type).toBe('operator_entered_note');
    expect(first.raw_note).toBe(note);
    expect(first.reasoning_status).toBe('requires_followup');
    expect(first.detected_metrics).toEqual([
      expect.objectContaining({
        metric: 'epa_per_play',
        value: null,
        unit: null,
        confidence: 'heuristic',
        sample_filter: 'operator_note_keyword_match',
      }),
      expect.objectContaining({
        metric: 'catchable_target_rate',
        value: null,
        unit: null,
        confidence: 'heuristic',
        sample_filter: 'operator_note_keyword_match',
      }),
      expect.objectContaining({
        metric: 'route_participation',
        value: null,
        unit: null,
        confidence: 'heuristic',
        sample_filter: 'operator_note_keyword_match',
      }),
      expect.objectContaining({
        metric: 'target_share',
        value: null,
        unit: null,
        confidence: 'heuristic',
        sample_filter: 'operator_note_keyword_match',
      }),
    ]);
    expect(first.detected_metrics[0]).toHaveProperty('context', expect.stringContaining('Matched cue: EPA/Play.'));
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
      },
      {
        label: '2026',
        entity_type: 'season',
      },
    ]);
    expect(first.do_not_apply).toContain('Do not mutate rankings from this note alone.');
    expect(first.do_not_apply).toContain('Do not treat operator notes as verified source truth.');
    expect(first.do_not_apply).toContain('Do not fabricate missing context.');
    expect(first.uncertainty).toContain('Automated parsing is not implemented in v0.');
    expect(first.uncertainty).toContain('Source verification is required before downstream application.');
  });

  it('does not emit non-contract entity types for unresolved context', () => {
    const artifact = buildMockOperatorSignalNoteArtifact('Division strength matters here, but the note does not name a specific division.');

    expect(artifact.entities).toEqual([]);
    expect(artifact.uncertainty).toContain('Division context was mentioned, but no contract-supported division entity was resolved by v0 heuristics.');
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
