import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoreResearchQuickLinks } from '@/components/data-lab/CoreResearchQuickLinks';
import { buildDataLabCommandCenterHref } from '@/lib/dataLabCommandCenter';
import { buildPlayerResearchHref } from '@/lib/playerResearch';
import { buildTeamResearchHref } from '@/lib/teamResearch';

describe('CoreResearchQuickLinks', () => {
  it('renders player research links with stable query-param carry-through', () => {
    const html = renderToStaticMarkup(
      React.createElement(CoreResearchQuickLinks, {
        season: '2025',
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        team: 'MIN',
        showCommandCenter: true,
      }),
    );

    expect(buildPlayerResearchHref({ season: '2025', playerId: '00-0036322', playerName: 'Justin Jefferson' })).toBe(
      '/tiber-data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin+Jefferson',
    );
    expect(html).toContain('/tiber-data-lab/player-research?season=2025&amp;playerId=00-0036322&amp;playerName=Justin+Jefferson');
    expect(html).toContain('Player Research');
    expect(html).toContain('Command Center');
    expect(html).toContain('Promoted Data Lab outputs only');
  });

  it('renders team research links for team-facing cards without dropping the team code', () => {
    const html = renderToStaticMarkup(
      React.createElement(CoreResearchQuickLinks, {
        season: '2025',
        team: 'DET',
        compact: true,
      }),
    );

    expect(buildTeamResearchHref({ season: '2025', team: 'DET' })).toBe('/tiber-data-lab/team-research?season=2025&team=DET');
    expect(html).toContain('/tiber-data-lab/team-research?season=2025&amp;team=DET');
    expect(html).not.toContain('Player Research');
  });

  it('keeps command-center linking stable as a lightweight discovery hook', () => {
    expect(buildDataLabCommandCenterHref({ season: '2025' })).toBe('/tiber-data-lab/command-center?season=2025');
  });
});

describe('a season is navigation state only when it is a real season', () => {
  // Reproduces the reported defect: display copy reaching the href builder.
  // An unresolved season renders as an em dash, and the previous truthy check
  // serialised it — `?season=%E2%80%94`, which the command-center API's
  // numeric season validator answers with a 400.
  test('the em dash the UI renders for an unresolved season is never a query value', () => {
    const href = buildDataLabCommandCenterHref({ season: '—' });
    expect(href).toBe('/tiber-data-lab/command-center');
    expect(href).not.toContain('%E2%80%94');
    expect(href).not.toContain('season=');
  });

  test.each(['', ' ', 'unknown', 'null', 'undefined', 'TBD', '20', '20255'])(
    'the non-season %p is dropped rather than serialised',
    (season) => {
      expect(buildDataLabCommandCenterHref({ season })).toBe('/tiber-data-lab/command-center');
    },
  );

  test('a real season is still carried, and whitespace-trimmed', () => {
    expect(buildDataLabCommandCenterHref({ season: '2025' })).toBe('/tiber-data-lab/command-center?season=2025');
    expect(buildDataLabCommandCenterHref({ season: ' 2026 ' })).toBe('/tiber-data-lab/command-center?season=2026');
  });
});
