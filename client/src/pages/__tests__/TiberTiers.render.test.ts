/**
 * Renders the actual `/tiers` presentational component (TiberTiersView — the exact JSX
 * TiberTiers delegates to; see TiberTiers.tsx) via `react-dom/server`'s
 * `renderToStaticMarkup`. This needs no jsdom, no @testing-library, and no new
 * dependencies — react-dom is already a project dependency, and static-markup rendering
 * runs entirely in Node (no `document`/`window` required), matching this repo's existing
 * `testEnvironment: 'node'` Jest config. A previous review correctly noted that
 * mapper-only tests do not prove the page's actual rendered output; this file renders the
 * production component tree directly, unlike tiberTiersV2Mapper.test.ts's pure-function
 * coverage.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TiberTiersView, TiberTiersViewProps, TiersApiResponse } from '../TiberTiers';
import { RankingsV2Item, validateRankingsV2WeeklyResponse } from '../tiberTiersV2Mapper';

function makeItem(overrides: Partial<RankingsV2Item> = {}): RankingsV2Item {
  return {
    rank: 1,
    playerId: '00-1',
    playerName: 'Justin Jefferson',
    position: 'WR',
    team: 'MIN',
    tier: 'T1',
    score: 20.1,
    value: 3.4,
    explanation: { placementSummary: 'Strong WR1 outlook.', pillarNotes: [] },
    trust: { confidence: null, sampleNote: null, stabilityNote: null },
    uiMeta: { subscores: {}, confidence: null, gamesPlayed: null, trajectory: null, footballLensIssues: null, lensAdjustment: null },
    ...overrides,
  } as RankingsV2Item;
}

function baseProps(overrides: Partial<TiberTiersViewProps> = {}): TiberTiersViewProps {
  return {
    season: 2025,
    asOfWeek: 5,
    position: 'WR',
    onPositionChange: () => {},
    sortDirection: 'desc',
    onToggleSortDirection: () => {},
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    onRefetch: () => {},
    ...overrides,
  };
}

function render(props: TiberTiersViewProps): string {
  return renderToStaticMarkup(React.createElement(TiberTiersView, props));
}

describe('TiberTiersView rendered output', () => {
  it('renders neutral loading copy and suppresses the player-count/source metadata line', () => {
    const html = render(baseProps({ isLoading: true }));

    expect(html).toContain('Loading rankings...');
    expect(html).not.toContain('Loading FORGE tiers');
    expect(html).not.toMatch(/\d+ players/);
    expect(html).not.toContain('Source:');
    expect(html).not.toContain('Unable to load rankings');
  });

  it('renders a generic, user-safe error state and suppresses metadata — not the genuinely-empty message', () => {
    const html = render(baseProps({ isError: true }));

    expect(html).toContain('Unable to load rankings');
    expect(html).toContain('This is an error, not an empty result');
    expect(html).not.toContain('No players match this filter yet.');
    expect(html).not.toMatch(/\d+ players/);
    expect(html).not.toContain('Source:');
    // The error panel must never echo a raw backend/exception message.
    expect(html).not.toContain('Failed to fetch weekly rankings');
  });

  it('renders the uncomputed-cache state without any operator/admin mutation instruction', () => {
    const data: TiersApiResponse = {
      asOf: '2026-04-12T00:00:00.000Z',
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: 'FORGE grades for this filter have not been computed yet. Please check back shortly.', stabilityNote: 'forge_cache_empty_uncomputed' },
      items: [],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('Rankings are not available yet');
    expect(html).not.toContain('POST /api/forge/compute-grades');
    expect(html).not.toContain('compute-grades');
    expect(html).not.toMatch(/\d+ players/);
    expect(html).not.toContain('Source:');
  });

  it('renders the genuine-empty state distinctly, with metadata visible', () => {
    const data: TiersApiResponse = {
      asOf: '2026-04-12T00:00:00.000Z',
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('No players match this filter yet.');
    expect(html).toContain('0 players');
    expect(html).toContain('Source:');
  });

  it('labels Expected/VORP and a Forecast headline when the scoring service produced the rows', () => {
    const data: TiersApiResponse = {
      asOf: '2026-04-12T00:00:00.000Z',
      sourceStack: [{ layer: 'promoted_artifact' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('Weekly Forecast Rankings');
    expect(html).toContain('Expected');
    expect(html).toContain('VORP');
    expect(html).toContain('Justin Jefferson');
    expect(html).toContain('20.1');
    expect(html).not.toContain('FORGE Alpha');
  });

  it('labels FORGE Alpha/Raw Alpha and a FORGE headline when the cache fallback produced the rows', () => {
    const data: TiersApiResponse = {
      asOf: '2026-04-12T00:00:00.000Z',
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('Canonical FORGE Alpha ranks');
    expect(html).toContain('FORGE Alpha');
    expect(html).toContain('Raw Alpha');
    expect(html).not.toContain('>Expected<');
    expect(html).not.toContain('>VORP<');
  });

  it('proves malformed 2xx JSON is rejected before it can render as a genuine empty result', () => {
    // This is the client-boundary half of the "malformed vs. genuine empty" requirement:
    // the validator (wired into TiberTiers' queryFn) must throw for these shapes so React
    // Query lands in the error state rendered by the case above, rather than in the
    // genuine-empty case exercised two tests up.
    expect(() => validateRankingsV2WeeklyResponse({})).toThrow();
    expect(() => validateRankingsV2WeeklyResponse(null)).toThrow();
    expect(() => validateRankingsV2WeeklyResponse({ items: null, sourceStack: [], asOf: '2026-04-12T00:00:00.000Z' })).toThrow();
    expect(() => validateRankingsV2WeeklyResponse({ items: [], sourceStack: null, asOf: '2026-04-12T00:00:00.000Z' })).toThrow();
    expect(() => validateRankingsV2WeeklyResponse({ items: [], sourceStack: [], asOf: 'not-a-date' })).toThrow();
    // An explicit, well-formed empty array is the only genuine empty result.
    expect(() => validateRankingsV2WeeklyResponse({ items: [], sourceStack: [], asOf: '2026-04-12T00:00:00.000Z' })).not.toThrow();
  });
});
