import {
  buildManagementModelSignals,
  buildRosterVisibilitySummary,
  type ModelSignalCard,
} from '@/pages/TiberManagementDashboard';
import type { TeamEnvironmentMovementResponse } from '@/lib/teamEnvironmentMovement';

function signal(cards: ModelSignalCard[], title: string): ModelSignalCard {
  const found = cards.find((card) => card.title === title);
  if (!found) throw new Error(`Missing signal card: ${title}`);
  return found;
}

function teamStateResponse(overrides: Partial<TeamEnvironmentMovementResponse> = {}): TeamEnvironmentMovementResponse {
  return {
    ok: true,
    artifact: 'team_environment_movement_v0',
    artifactAvailable: true,
    provenanceStatus: 'governed_promoted',
    inputSources: [],
    coverage: { teams: ['MIN'], seasons: [2025], weeks: [17], latestWeek: 17, isFullLeague: false },
    teams: [{
      team: 'Minnesota Vikings',
      teamId: null,
      teamAbbr: 'MIN',
      season: 2025,
      weeksCovered: [17],
      earlyWindow: {},
      lateWindow: {},
      deltas: {},
      offenseDirection: 'improving',
      pressureDirection: null,
      passEnvironmentDirection: 'stable',
      paceDirection: null,
      volatilityDirection: null,
      verdict: null,
      warnings: [],
      raw: {},
    }],
    selectedTeam: null,
    warnings: [],
    errors: [],
    ...overrides,
  };
}

describe('Management model signal cards', () => {

  it('keeps generated baseline visibility separate from player-specific FORGE evidence', () => {
    const visibility = buildRosterVisibilitySummary([
      { name: 'Justin Herbert', pos: 'QB', alpha: 61.4, forgeScoreSource: 'player_specific' },
      { name: 'Puka Nacua', pos: 'WR', alpha: 67.2, forgeScoreSource: 'player_specific' },
      { name: 'Bijan Robinson', pos: 'RB', alpha: 64.8, forgeScoreSource: 'player_specific' },
      ...Array.from({ length: 27 }, (_, index) => ({
        name: `Known Player ${index + 1}`,
        pos: index % 2 === 0 ? 'WR' : 'RB',
        alpha: null,
        missingReason: 'missing_forge_row' as const,
      })),
    ]);

    expect(visibility).toMatchObject({
      total: 30,
      identityCovered: 30,
      baselineVisible: 0,
      forgeScored: 3,
      forgeBaseline: 0,
      generatedBaselineVisibility: 0,
      evidenceCovered: 3,
    });
  });

  it('uses roster visibility diagnostics for FORGE and Rookie Alpha readiness without changing semantics', () => {
    const cards = buildManagementModelSignals({
      hasActiveTeam: true,
      hasRosterData: true,
      hasDashboardTotals: true,
      rosterVisibility: {
        total: 4,
        forgeScored: 2,
        forgeBaseline: 0,
        rookieAlphaFallback: 1,
        knownUnscored: 1,
        unresolved: 0,
        evidenceCovered: 3,
      },
      teamstateQueryState: 'success',
      teamstateResponse: teamStateResponse(),
      teamstateDetails: ['Provenance status: governed_promoted.'],
    });

    expect(signal(cards, 'FORGE')).toMatchObject({
      status: 'partial',
      statusLabel: 'Partial',
    });
    expect(signal(cards, 'FORGE').details).toEqual(expect.arrayContaining([
      'Player-specific FORGE coverage: 2/4.',
      'Generated/default FORGE baselines excluded from coverage: 0/4.',
      'FORGE alpha totals: available.',
      'Team Direction confidence still uses FORGE scoring coverage, not fallback visibility.',
    ]));
    expect(signal(cards, 'Rookie Alpha')).toMatchObject({
      status: 'inspection only',
      statusLabel: 'Inspection only',
    });
    expect(signal(cards, 'Rookie Alpha').details).toEqual(expect.arrayContaining([
      'Fallback count: 1/4.',
      'Evidence-covered roster rows: 3/4.',
    ]));
  });

  it('does not claim active Management integration for ROP or point prediction', () => {
    const cards = buildManagementModelSignals({
      hasActiveTeam: true,
      hasRosterData: true,
      hasDashboardTotals: false,
      rosterVisibility: {
        total: 2,
        forgeScored: 0,
        forgeBaseline: 0,
        rookieAlphaFallback: 0,
        knownUnscored: 2,
        unresolved: 0,
        evidenceCovered: 0,
      },
      teamstateQueryState: 'success',
      teamstateResponse: teamStateResponse({ artifactAvailable: false, teams: [] }),
      teamstateDetails: [],
    });

    expect(signal(cards, 'ROP / Opportunity')).toMatchObject({
      status: 'not wired',
      statusLabel: 'Not wired',
    });
    expect(signal(cards, 'Point Prediction')).toMatchObject({
      status: 'not wired',
      statusLabel: 'Pending ingestion',
    });
    expect(signal(cards, 'TeamState')).toMatchObject({
      status: 'unavailable',
      statusLabel: 'Unavailable',
    });
  });
});
