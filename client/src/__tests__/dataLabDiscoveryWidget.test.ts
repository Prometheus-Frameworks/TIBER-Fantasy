import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataLabDiscoveryWidget } from '@/components/data-lab/DataLabDiscoveryWidget';

const commandCenterData = {
  season: 2025,
  availableSeasons: [2025],
  state: 'partial' as const,
  framing: {
    title: 'Data Lab Command Center',
    description: 'Fixture command-center copy.',
    posture: 'Read-only orchestration.',
  },
  moduleStatuses: [],
  priorities: [
    {
      id: 'priority-1',
      title: 'Top breakout candidates this season',
      reason: 'Two promoted breakout profiles stand out as fast follow-up research targets.',
      moduleTitle: 'WR Breakout Lab',
      moduleHref: '/tiber-data-lab/breakout-signals?season=2025',
      primaryAction: {
        label: 'Open Player Research',
        href: '/tiber-data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin+Jefferson',
      },
      secondaryAction: {
        label: 'Open module',
        href: '/tiber-data-lab/breakout-signals?season=2025',
      },
    },
  ],
  warnings: ['Age Curve / ARC unavailable for one section.'],
  sections: {
    breakoutCandidates: {
      state: 'ready' as const,
      title: 'Breakout candidates',
      description: 'Fixture breakout candidates.',
      moduleTitle: 'WR Breakout Lab',
      linkHref: '/tiber-data-lab/breakout-signals?season=2025',
      message: 'Breakout items available.',
      items: [
        {
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
          team: 'MIN',
          candidateRank: 1,
          finalSignalScore: 91.4,
          breakoutLabel: 'Priority breakout',
          breakoutContext: 'Fixture context.',
          links: {
            moduleHref: '/tiber-data-lab/breakout-signals?season=2025',
            playerResearchHref: '/tiber-data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin+Jefferson',
          },
        },
      ],
    },
    roleOpportunity: {
      state: 'empty' as const,
      title: 'Role & Opportunity',
      description: 'Fixture role section.',
      moduleTitle: 'Role & Opportunity Lab',
      linkHref: '/tiber-data-lab/role-opportunity?season=2025',
      message: 'No item.',
      items: [],
    },
    ageCurves: {
      state: 'empty' as const,
      title: 'Age Curves',
      description: 'Fixture age section.',
      moduleTitle: 'Age Curve / ARC Lab',
      linkHref: '/tiber-data-lab/age-curves?season=2025',
      message: 'No item.',
      items: [],
    },
    pointScenarios: {
      state: 'empty' as const,
      title: 'Point Scenarios',
      description: 'Fixture scenario section.',
      moduleTitle: 'Point Scenario Lab',
      linkHref: '/tiber-data-lab/point-scenarios?season=2025',
      message: 'No item.',
      items: [],
    },
    teamEnvironments: {
      state: 'ready' as const,
      title: 'Team environments',
      description: 'Fixture team section.',
      moduleTitle: 'Team Research Workspace',
      linkHref: '/tiber-data-lab/team-research?season=2025',
      message: 'Team items available.',
      items: [
        {
          team: 'MIN',
          teamName: 'Minnesota Vikings',
          breakoutCandidateCount: 2,
          rolePlayerCount: 3,
          ageSignalCount: 1,
          scenarioPlayerCount: 2,
          avgTargetShare: 0.23,
          avgRouteParticipation: 0.78,
          maxScenarioDelta: 2.8,
          topPlayers: ['Justin Jefferson', 'Jordan Addison'],
          links: {
            moduleHref: '/tiber-data-lab/team-research?season=2025&team=MIN',
            teamResearchHref: '/tiber-data-lab/team-research?season=2025&team=MIN',
          },
        },
      ],
    },
  },
};

describe('DataLabDiscoveryWidget', () => {
  it('renders a concise read-only command-center discovery card', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataLabDiscoveryWidget, {
        season: '2025',
        data: commandCenterData,
        fallbackSummaryState: 'available',
        fallbackSummary: {
          playersTracked: 24,
          avgPpg: 15.2,
          t1Count: 4,
          topScorerName: 'Justin Jefferson',
          topScorerPpg: 21.4,
        },
      }),
    );

    expect(html).toContain('Research worth opening from the normal flow');
    expect(html).toContain('Top breakout candidates this season');
    expect(html).toContain('Minnesota Vikings');
    expect(html).toContain('Open Command Center');
    expect(html).toContain('/tiber-data-lab/command-center?season=2025');
  });

  it('falls back to compact command-center CTA copy without breaking the widget shell', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataLabDiscoveryWidget, {
        season: '2025',
        data: null,
        isLoading: false,
        fallbackSummaryState: 'available',
        fallbackSummary: {
          playersTracked: 18,
          avgPpg: 14.1,
          t1Count: 3,
          topScorerName: 'Amon-Ra St. Brown',
          topScorerPpg: 19.8,
        },
      }),
    );

    expect(html).toContain('Amon-Ra St. Brown');
    expect(html).toContain('Open the Command Center');
    expect(html).toContain('Players');
  });

  // Fantasy #307 correction round 5: the widget's Players/Avg PPG/Elite
  // metrics must reflect the snapshot aggregate's own lifecycle, not just
  // whatever numbers the caller happened to pass — a caller with a pending
  // or failed aggregate still has to pass SOME `fallbackSummary` object, and
  // rendering its (typically zeroed) numbers unconditionally would read as
  // measured data the widget never actually had.
  describe('fallbackSummaryState gates the Players/Avg PPG/Elite metrics', () => {
    const ZERO_SUMMARY = { playersTracked: 0, avgPpg: 0, t1Count: 0, topScorerName: null, topScorerPpg: null };
    const POPULATED_SUMMARY = { playersTracked: 24, avgPpg: 15.2, t1Count: 4, topScorerName: 'Justin Jefferson', topScorerPpg: 21.4 };

    function renderWidget(fallbackSummaryState: 'loading' | 'available' | 'unavailable', fallbackSummary: typeof ZERO_SUMMARY) {
      return renderToStaticMarkup(
        React.createElement(DataLabDiscoveryWidget, {
          season: '2025',
          data: null,
          fallbackSummaryState,
          fallbackSummary,
        }),
      );
    }

    it('unavailable: renders em dashes, not the caller\'s (typically zeroed) numbers', () => {
      const html = renderWidget('unavailable', ZERO_SUMMARY);
      expect(html).toContain('data-summary-state="unavailable"');
      expect(html).toMatch(/data-testid="widget-metric-players"[^>]*>—</);
      expect(html).toMatch(/data-testid="widget-metric-avg-ppg"[^>]*>—</);
      expect(html).toMatch(/data-testid="widget-metric-elite"[^>]*>—</);
      expect(html).not.toContain('>0<');
    });

    it('unavailable: does not narrate a populated but inadmissible cached top scorer', () => {
      const html = renderWidget('unavailable', POPULATED_SUMMARY);

      expect(html).not.toContain('Justin Jefferson currently leads');
      expect(html).not.toContain('21.4 PPG');
      expect(html).toContain('Open the Command Center to find promoted read-only player and team research starting points.');
    });

    it('loading: also renders em dashes, distinctly pending rather than resolved-empty', () => {
      const html = renderWidget('loading', ZERO_SUMMARY);
      expect(html).toContain('data-summary-state="loading"');
      expect(html).toMatch(/data-testid="widget-metric-players"[^>]*>—</);
    });

    it('available with a genuinely empty aggregate: renders REAL 0 / 0 / 0, not em dashes', () => {
      // The one case that must NOT be swept into the em-dash treatment: a
      // successfully resolved aggregate that is legitimately empty.
      const html = renderWidget('available', ZERO_SUMMARY);
      expect(html).toContain('data-summary-state="available"');
      expect(html).toMatch(/data-testid="widget-metric-players"[^>]*>0</);
      expect(html).toMatch(/data-testid="widget-metric-avg-ppg"[^>]*>0</);
      expect(html).toMatch(/data-testid="widget-metric-elite"[^>]*>0</);
      expect(html).not.toContain('data-testid="widget-metric-players">—<');
    });

    it('available with a populated aggregate: renders the real measured numbers', () => {
      const html = renderWidget('available', POPULATED_SUMMARY);
      expect(html).toMatch(/data-testid="widget-metric-players"[^>]*>24</);
      expect(html).toMatch(/data-testid="widget-metric-avg-ppg"[^>]*>15\.2</);
      expect(html).toMatch(/data-testid="widget-metric-elite"[^>]*>4</);
    });
  });
});
