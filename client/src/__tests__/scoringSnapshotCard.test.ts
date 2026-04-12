import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScoringSnapshotCard } from '@/components/player/ScoringSnapshotCard';

describe('ScoringSnapshotCard', () => {
  it('renders live weekly scoring details for the player page flow', () => {
    const html = renderToStaticMarkup(
      React.createElement(ScoringSnapshotCard, {
        weekly: {
          ok: true,
          data: {
            expectedPoints: 19.6,
            vorp: 3.1,
            floor: 12.2,
            median: 18.4,
            ceiling: 28.7,
            confidence: 'high',
            volatility: 'medium',
            fragility: 'low',
            weeklyOutlook: 'Strong WR1 projection in current script.',
            roleSummary: 'Featured target with red-zone leverage.',
            valueSummary: 'Clear every-week start.',
            roleNotes: ['Route share remains elite'],
          },
        },
      }),
    );

    expect(html).toContain('Live scoring snapshot');
    expect(html).toContain('Strong WR1 projection');
    expect(html).toContain('Route share remains elite');
    expect(html).toContain('19.6');
  });

  it('renders graceful unavailable state when scoring service fails', () => {
    const html = renderToStaticMarkup(
      React.createElement(ScoringSnapshotCard, {
        weekly: { ok: false, code: 'upstream_unavailable', message: 'Scoring service request failed.' },
      }),
    );

    expect(html).toContain('Scoring unavailable');
    expect(html).toContain('Scoring service request failed.');
  });
});
