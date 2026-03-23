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
