import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DataLabHub from '@/pages/DataLabHub';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({
    data: {
      status: 'healthy',
      latestSnapshot: null,
      tableCounts: {
        snapshotMeta: 4,
        snapshotPlayerWeek: 12345,
        snapshotPlayerSeason: 0,
        weekStaging: 0,
        seasonStaging: 0,
      },
    },
  })),
}));

describe('DataLabHub', () => {
  it('renders promoted module system framing with stable read-only guidance', () => {
    const html = renderToStaticMarkup(React.createElement(DataLabHub));

    expect(html).toContain('Promoted module system');
    expect(html).toContain('Breakout, role, developmental, and scenario context in one lane');
    expect(html).toContain('WR Breakout Lab');
    expect(html).toContain('Role &amp; Opportunity Lab');
    expect(html).toContain('Age Curve / ARC Lab');
    expect(html).toContain('Point Scenario Lab');
    expect(html).toContain('What this module is for');
    expect(html).toContain('When to use this');
    expect(html).toContain('Promoted');
    expect(html).toContain('Read only');
    expect(html).toContain('12,345');
  });
});
