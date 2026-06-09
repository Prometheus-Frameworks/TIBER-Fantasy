import {
  buildManagementModelSignals,
  buildManagementIdentitySeedReport,
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

describe('Management identity seed report', () => {
  it('exports full active roster seed data with 3 mapped and 27 missing crosswalk rows', () => {
    const mappedPlayers = [
      ['Justin Herbert', 'QB', 'LAC', '6797', 'tiber-data-player-2025-justin-herbert'],
      ['Puka Nacua', 'WR', 'LAR', '9493', 'tiber-data-player-2025-puka-nacua'],
      ['Bijan Robinson', 'RB', 'ATL', '9509', 'tiber-data-player-2025-bijan-robinson'],
    ].map(([name, pos, team, sleeperId, tiberId]) => ({
      name,
      pos,
      nflTeam: team,
      sleeperId,
      provider: 'sleeper',
      providerPlayerId: sleeperId,
      providerCanonicalId: `sleeper:${sleeperId}`,
      currentTiberPlayerId: tiberId,
      crosswalkStatus: 'matched',
      alpha: 70,
      forgeScoreSource: 'player_specific',
      visibilityState: 'forge_scored',
    }));
    const missingPlayers = Array.from({ length: 27 }, (_, index) => ({
      name: index === 0 ? 'Ladd McConkey' : `Known Player ${index + 1}`,
      pos: index % 2 === 0 ? 'WR' : 'RB',
      nflTeam: index === 0 ? 'LAC' : 'FA',
      sleeperId: String(10000 + index),
      provider: 'sleeper',
      providerPlayerId: String(10000 + index),
      providerCanonicalId: `sleeper:${10000 + index}`,
      currentTiberPlayerId: null,
      crosswalkStatus: 'missing',
      alpha: null,
      missingReason: 'missing_forge_row',
      visibilityState: 'known_unscored',
    }));

    const report = buildManagementIdentitySeedReport({
      generatedAt: '2026-06-09T00:00:00.000Z',
      league: {
        id: 'league-db-id',
        leagueIdExternal: 'sleeper-league-id',
        leagueName: 'Morts FF Dynasty',
        scoringFormat: 'ppr',
        season: 2026,
      },
      team: { id: 'team-1', displayName: 'Garbage Time' },
      dashboardTeam: {
        team_id: 'team-1',
        display_name: 'Garbage Time',
        roster: [...mappedPlayers, ...missingPlayers],
      },
    });

    expect(report).toMatchObject({
      artifact_type: 'TIBER_MANAGEMENT_IDENTITY_SEED_REPORT',
      generated_at: '2026-06-09T00:00:00.000Z',
      league: {
        league_id: 'sleeper-league-id',
        league_name: 'Morts FF Dynasty',
        team_name: 'Garbage Time',
        season: 2026,
        format: 'ppr',
      },
      source: {
        producer: 'TIBER-Fantasy Management',
        purpose: 'operator_seed_for_tiber_data_identity_crosswalk_expansion',
      },
      summary: {
        roster_count: 30,
        identity_covered: 30,
        crosswalk_matched: 3,
        forge_player_specific_matched: 3,
        generated_baseline_matched: 0,
        known_unscored: 27,
        unresolved: 0,
      },
    });
    expect(report.players).toHaveLength(30);
    expect(report.players[0]).toMatchObject({
      display_name: 'Justin Herbert',
      position: 'QB',
      team: 'LAC',
      sleeper_id: '6797',
      provider: 'sleeper',
      provider_player_id: '6797',
      provider_canonical_id: 'sleeper:6797',
      current_tiber_player_id: 'tiber-data-player-2025-justin-herbert',
      crosswalk_status: 'matched',
      forge_status: 'player_specific',
      recommended_action: 'already_mapped',
    });
    expect(report.players[3]).toMatchObject({
      display_name: 'Ladd McConkey',
      sleeper_id: '10000',
      provider_canonical_id: 'sleeper:10000',
      current_tiber_player_id: null,
      crosswalk_status: 'missing',
      forge_status: 'missing_forge_row',
      visibility_state: 'known_unscored',
      recommended_action: 'candidate_for_tiber_data_crosswalk_review',
    });
  });
});
