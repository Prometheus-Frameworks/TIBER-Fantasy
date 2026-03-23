import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeamResearchEntryCard } from '@/components/data-lab/TeamResearchEntryCard';
import { TeamResearchInlineLink } from '@/components/data-lab/TeamResearchInlineLink';

describe('TeamResearchEntryCard', () => {
  it('renders a minimal CTA when no team is selected on the surface yet', () => {
    const html = renderToStaticMarkup(
      React.createElement(TeamResearchEntryCard, {
        season: '2025',
      }),
    );

    expect(html).toContain('Inline team research is available here');
    expect(html).toContain('Select a team above to surface a compact promoted summary here');
    expect(html).toContain('/tiber-data-lab/team-research?season=2025');
    expect(html).toContain('Open Team Research');
  });

  it('keeps the CTA targeted when a team code is provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(TeamResearchEntryCard, {
        season: '2025',
        team: 'MIN',
      }),
    );

    expect(html).toContain('Open the fuller Team Research Workspace for MIN');
    expect(html).toContain('/tiber-data-lab/team-research?season=2025&amp;team=MIN');
    expect(html).toContain('Open MIN Team Research');
  });
});

describe('TeamResearchInlineLink', () => {
  it('builds a stable team-scoped Team Research link for team rows', () => {
    const html = renderToStaticMarkup(
      React.createElement(TeamResearchInlineLink, {
        season: '2025',
        team: 'DET',
        compact: true,
      }),
    );

    expect(html).toContain('/tiber-data-lab/team-research?season=2025&amp;team=DET');
    expect(html).toContain('Research');
  });
});
