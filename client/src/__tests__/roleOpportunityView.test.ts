import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleOpportunityView } from '@/components/data-lab/RoleOpportunityView';
import {
  DEFAULT_ROLE_OPPORTUNITY_SORT,
  ROLE_OPPORTUNITY_COLUMNS,
  buildRoleOpportunityDetailSections,
  filterRoleOpportunityRows,
  formatConfidence,
  formatPercent,
  getRoleOpportunityLabErrorMessage,
  getRoleOpportunityStateHints,
  sortRoleOpportunityRows,
} from '@/lib/roleOpportunity';

const rows = [
  {
    playerId: '00-0036322',
    playerName: 'Justin Jefferson',
    team: 'MIN',
    position: 'WR',
    season: 2025,
    week: 17,
    seasonScopeMarker: null,
    primaryRole: 'alpha_x',
    roleTags: ['boundary', 'downfield'],
    usage: {
      routeParticipation: 0.96,
      targetShare: 0.31,
      airYardShare: 0.42,
      snapShare: 0.93,
      usageRate: 0.28,
    },
    confidence: {
      score: 0.91,
      tier: 'featured',
    },
    source: {
      sourceName: 'tiber-data',
      sourceType: 'compatibility-view',
      modelVersion: 'role-opportunity-v1',
      generatedAt: '2026-03-23T00:00:00.000Z',
    },
    insights: ['High route participation'],
    rawFields: {
      player_name: 'Justin Jefferson',
      primary_role: 'alpha_x',
      route_participation: 96,
      target_share: 31,
    },
  },
  {
    playerId: '00-0037834',
    playerName: 'Brock Bowers',
    team: 'LV',
    position: 'TE',
    season: 2025,
    week: 17,
    seasonScopeMarker: null,
    primaryRole: 'move_te',
    roleTags: ['slot', 'chain mover'],
    usage: {
      routeParticipation: 0.83,
      targetShare: 0.25,
      airYardShare: 0.22,
      snapShare: 0.82,
      usageRate: 0.24,
    },
    confidence: {
      score: 0.88,
      tier: 'strong',
    },
    source: {
      sourceName: 'tiber-data',
      sourceType: 'compatibility-view',
      modelVersion: 'role-opportunity-v1',
      generatedAt: '2026-03-23T00:00:00.000Z',
    },
    insights: ['Featured matchup creator'],
    rawFields: {
      player_name: 'Brock Bowers',
      primary_role: 'move_te',
      route_participation: 83,
      target_share: 25,
    },
  },
  {
    playerId: '00-0039939',
    playerName: 'Kyren Williams',
    team: 'LAR',
    position: 'RB',
    season: 2025,
    week: null,
    seasonScopeMarker: 'season',
    primaryRole: 'workhorse_back',
    roleTags: ['early down', 'two-minute'],
    usage: {
      routeParticipation: 0.57,
      targetShare: 0.13,
      airYardShare: 0.04,
      snapShare: 0.79,
      usageRate: 0.34,
    },
    confidence: {
      score: 0.77,
      tier: 'stable',
    },
    source: {
      sourceName: 'tiber-data',
      sourceType: 'artifact',
      modelVersion: 'role-opportunity-v1',
      generatedAt: '2026-03-23T00:00:00.000Z',
    },
    insights: ['High-value touch concentration'],
    rawFields: {
      player_name: 'Kyren Williams',
      primary_role: 'workhorse_back',
      route_participation: 57,
      target_share: 13,
    },
  },
];

describe('RoleOpportunityView', () => {
  it('renders fixture-backed rows with promoted read-only framing', () => {
    const html = renderToStaticMarkup(
      React.createElement(RoleOpportunityView, {
        season: '2025',
        availableSeasons: [2025, 2024],
        rows,
        isLoading: false,
        error: null,
        sourceProvider: 'tiber-data',
        sourceMode: 'artifact',
        scopeLabel: 'Week 17',
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('Role &amp; Opportunity Lab');
    expect(html).toContain('Justin Jefferson');
    expect(html).toContain('Brock Bowers');
    expect(html).toContain('Read only');
    expect(html).toContain('Deployment and usage context');
    expect(html).toContain('Showing');
  });

  it('keeps the table column contract and value formatters stable', () => {
    expect(ROLE_OPPORTUNITY_COLUMNS.map((column) => column.label)).toEqual([
      'Player',
      'Team',
      'Pos',
      'Primary Role',
      'Route %',
      'Target %',
      'Air %',
      'Snap %',
      'Confidence',
    ]);
    expect(formatPercent(0.31)).toBe('31%');
    expect(formatConfidence(0.91, 'featured')).toBe('91% · featured');
  });

  it('supports search/filter behavior and stable sorting', () => {
    expect(filterRoleOpportunityRows(rows, { searchQuery: 'bowers' }).map((row) => row.playerName)).toEqual(['Brock Bowers']);
    expect(filterRoleOpportunityRows(rows, { team: 'MIN', position: 'WR' }).map((row) => row.playerName)).toEqual(['Justin Jefferson']);

    expect(sortRoleOpportunityRows(rows, DEFAULT_ROLE_OPPORTUNITY_SORT).map((row) => row.playerName)).toEqual([
      'Justin Jefferson',
      'Brock Bowers',
      'Kyren Williams',
    ]);

    expect(sortRoleOpportunityRows(rows, { key: 'playerName', direction: 'asc' }).map((row) => row.playerName)).toEqual([
      'Brock Bowers',
      'Justin Jefferson',
      'Kyren Williams',
    ]);
  });

  it('renders the expandable detail drawer content from promoted fields', () => {
    const html = renderToStaticMarkup(
      React.createElement(RoleOpportunityView, {
        season: '2025',
        availableSeasons: [2025],
        rows,
        isLoading: false,
        error: null,
        sourceProvider: 'tiber-data',
        sourceMode: 'artifact',
        scopeLabel: 'Week 17',
        defaultExpandedPlayerId: '00-0036322',
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('Identity &amp; role');
    expect(html).toContain('Usage &amp; opportunity');
    expect(html).toContain('Full promoted payload');
    expect(html).toContain('Role &amp; Opportunity Lab');

    const sections = buildRoleOpportunityDetailSections(rows[0]);
    expect(sections.map((section) => section.title)).toEqual([
      'Identity & role',
      'Usage & opportunity',
      'Confidence & provenance',
      'Full promoted payload',
    ]);
    expect(sections[1].fields.map((field) => field.label)).toContain('Route participation');
  });

  it('renders malformed and empty states with operator hints', () => {
    const malformedHtml = renderToStaticMarkup(
      React.createElement(RoleOpportunityView, {
        season: '2025',
        availableSeasons: [2025],
        rows: [],
        isLoading: false,
        error: {
          success: false,
          error: getRoleOpportunityLabErrorMessage({
            success: false,
            error: 'invalid',
            code: 'invalid_payload',
          }),
          code: 'invalid_payload',
        },
        sourceProvider: null,
        sourceMode: null,
        scopeLabel: 'Season scope',
        onSeasonChange: jest.fn(),
      }),
    );

    expect(malformedHtml).toContain('Role &amp; Opportunity Lab unavailable');
    expect(malformedHtml).toContain('Operator hints');
    expect(getRoleOpportunityStateHints({ success: false, error: 'missing', code: 'not_found' })[0]).toContain('TIBER-Data compatibility views');

    const emptyHtml = renderToStaticMarkup(
      React.createElement(RoleOpportunityView, {
        season: '2025',
        availableSeasons: [2025],
        rows: [],
        isLoading: false,
        error: null,
        sourceProvider: 'tiber-data',
        sourceMode: 'artifact',
        scopeLabel: 'Season scope',
        onSeasonChange: jest.fn(),
      }),
    );

    expect(emptyHtml).toContain('Role &amp; Opportunity Lab ready, but empty');
    expect(emptyHtml).toContain('valid empty result set');
  });
});
