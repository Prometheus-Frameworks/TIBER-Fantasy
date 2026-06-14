import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildManagementModelSignals,
  buildManagementIdentitySeedReport,
  buildRosterVisibilitySummary,
  buildActiveTeamMatchingSummary,
  buildManagementSnapshotExport,
  type ModelSignalCard,
} from '@/pages/TiberManagementDashboard';
import type { TeamEnvironmentMovementResponse } from '@/lib/teamEnvironmentMovement';

function signal(cards: ModelSignalCard[], title: string): ModelSignalCard {
  const found = cards.find((card) => card.title === title);
  if (!found) throw new Error(`Missing signal card: ${title}`);
  return found;
}


function managementFixtureRoster() {
  const playerSpecificMappedPlayers = [
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
    crosswalkStatus: 'matched' as const,
    alpha: 70,
    forgeScoreSource: 'player_specific' as const,
    visibilityState: 'forge_scored' as const,
    forgeScoreProvenance: {
      source: 'player_specific' as const,
      matchType: 'identity_crosswalk' as const,
      identityCrosswalkArtifactId: 'TIBER_IDENTITY_CROSSWALK_V1' as const,
      forgePlayerId: tiberId,
    },
  }));

  const expandedCrosswalkOnlyPlayers = [
    ['Frank Gore Jr.', 'RB', 'BUF', '11573', 'tiber-data-player-2025-frank-gore-jr'],
    ['Xavier Worthy', 'WR', 'KC', '11624', 'tiber-data-player-2025-xavier-worthy'],
    ['Ladd McConkey', 'WR', 'LAC', '11635', 'tiber-data-player-2025-ladd-mcconkey'],
    ['Ryan Flournoy', 'WR', 'DAL', '11783', 'tiber-data-player-2025-ryan-flournoy'],
    ['Terrance Ferguson', 'TE', 'LAR', '12487', 'tiber-data-player-2025-terrance-ferguson'],
    ['Harold Fannin Jr.', 'TE', 'CLE', '12506', 'tiber-data-player-2025-harold-fannin-jr'],
    ['Luther Burden III', 'WR', 'CHI', '12519', 'tiber-data-player-2025-luther-burden-iii'],
    ['Travis Hunter', 'WR', 'JAX', '12530', 'tiber-data-player-2025-travis-hunter'],
    ['Jameis Winston', 'QB', 'NYG', '2306', 'tiber-data-player-2025-jameis-winston'],
    ['Derrick Henry', 'RB', 'BAL', '3198', 'tiber-data-player-2025-derrick-henry'],
    ['Christian McCaffrey', 'RB', 'SF', '4034', 'tiber-data-player-2025-christian-mccaffrey'],
    ['Kendrick Bourne', 'WR', 'NE', '4454', 'tiber-data-player-2025-kendrick-bourne'],
    ['T.J. Hockenson', 'TE', 'MIN', '5844', 'tiber-data-player-2025-t-j-hockenson'],
    ['Deebo Samuel Sr.', 'WR', 'WAS', '5872', 'tiber-data-player-2025-deebo-samuel-sr'],
    ['Gardner Minshew', 'QB', 'KC', '6011', 'tiber-data-player-2025-gardner-minshew'],
    ['Rico Dowdle', 'RB', 'CAR', '7021', 'tiber-data-player-2025-rico-dowdle'],
    ['Mac Jones', 'QB', 'SF', '7527', 'tiber-data-player-2025-mac-jones'],
    ['Jalen Tolbert', 'WR', 'DAL', '8117', 'tiber-data-player-2025-jalen-tolbert'],
    ['Calvin Austin III', 'WR', 'PIT', '8125', 'tiber-data-player-2025-calvin-austin-iii'],
    ['Tyquan Thornton', 'WR', 'KC', '8188', 'tiber-data-player-2025-tyquan-thornton'],
    ['Malik Davis', 'RB', 'DAL', '8800', 'tiber-data-player-2025-malik-davis'],
    ['Marvin Mims Jr.', 'WR', 'DEN', '9494', 'tiber-data-player-2025-marvin-mims-jr'],
  ].map(([name, pos, team, sleeperId, tiberId]) => {
    const hasExpandedForgeEvidence = name !== 'Frank Gore Jr.';

    return {
      name,
      pos,
      nflTeam: team,
      sleeperId,
      provider: 'sleeper',
      providerPlayerId: sleeperId,
      providerCanonicalId: `sleeper:${sleeperId}`,
      currentTiberPlayerId: tiberId,
      crosswalkStatus: 'matched' as const,
      alpha: hasExpandedForgeEvidence ? 42 : null,
      forgeScoreSource: hasExpandedForgeEvidence ? ('player_specific' as const) : undefined,
      missingReason: hasExpandedForgeEvidence ? undefined : ('missing_forge_row' as const),
      visibilityState: hasExpandedForgeEvidence ? ('forge_scored' as const) : ('known_unscored' as const),
      forgeScoreProvenance: hasExpandedForgeEvidence ? {
        source: 'player_specific' as const,
        matchType: 'identity_crosswalk' as const,
        identityCrosswalkArtifactId: 'TIBER_IDENTITY_CROSSWALK_V1' as const,
        forgePlayerId: tiberId,
      } : undefined,
    };
  });

  const omittedPlayerSeeds = [
    ['Nate Boerkircher', 'TE', '13299'],
    ['Sam Roush', 'TE', '13322'],
    ['Tanner Koziol', 'TE', '13408'],
    ['Cyrus Allen', 'WR', '13413'],
    ['Kaelon Black', 'RB', '13414'],
  ];

  const omittedPlayers = omittedPlayerSeeds.map(([name, pos, sleeperId]) => ({
    name,
    pos,
    nflTeam: 'FA',
    sleeperId,
    provider: 'sleeper',
    providerPlayerId: sleeperId,
    providerCanonicalId: `sleeper:${sleeperId}`,
    currentTiberPlayerId: null,
    crosswalkStatus: 'missing' as const,
    alpha: null,
    missingReason: 'missing_forge_row' as const,
    visibilityState: 'known_unscored' as const,
  }));

  return [...playerSpecificMappedPlayers, ...expandedCrosswalkOnlyPlayers, ...omittedPlayers];
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

  it('surfaces read-only Strategy Template Diagnostics without rendering template text or slots', () => {
    const cards = buildManagementModelSignals({
      hasActiveTeam: true,
      hasRosterData: true,
      hasDashboardTotals: true,
      rosterVisibility: {
        total: 30,
        identityCovered: 30,
        baselineVisible: 0,
        forgeScored: 24,
        forgeBaseline: 0,
        rookieAlphaFallback: 0,
        knownUnscored: 6,
        unresolved: 0,
        evidenceCovered: 24,
      },
      teamstateQueryState: 'success',
      teamstateResponse: teamStateResponse(),
      teamstateDetails: ['Provenance status: governed_promoted.'],
      strategyTemplateDiagnostics: {
        available: true,
        artifact_type: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
        contract_version: 'dynasty_strategy_ontology_v1',
        model_version: 'dynasty-strategy-ontology-v1.0.0',
        generated_at: '2026-06-10T00:00:00.000Z',
        template_selection_enabled: false,
        selected_template_id: null,
        current_team_direction: 'Rebuild',
        current_confidence: 'High',
        evaluated_template_count: 7,
        classification_compatible_template_ids: [
          'rebuild_low_alpha_concentration',
          'rebuild_premium_assets_timeline_mismatch',
        ],
        blocked_reasons: ['template_selection_disabled', 'missing_future_contract_inputs'],
        missing_future_contract_inputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
        templates: [
          {
            template_id: 'rebuild_low_alpha_concentration',
            classification_compatible: true,
            eligibility_state: 'blocked',
            blocked_reasons: ['template_selection_disabled', 'missing_future_contract_inputs'],
            missing_inputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
          },
        ],
        unavailable_reason: null,
      },
      managementStrategyContext: {
        available: true,
        status: 'blocked',
        team_direction: 'rebuild',
        team_direction_confidence: 'high',
        evidence_coverage: { matched: 24, total: 30, rate: 0.8, rookieAlphaMatched: 0 },
        identity_coverage: { matched: 30, total: 30, rate: 1 },
        forge_coverage: { matched: 24, total: 30, rate: 0.8 },
        strategy_ontology_available: true,
        strategy_template_selection_enabled: false,
        selected_template_id: null,
        blocked_reasons: ['strategy_template_activation_deferred'],
        missing_inputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
        roster_timeline_signals: null,
        asset_archetype_signals: null,
        management_tensions: [],
        source_summary: {
          roster_count: 30,
          resolved_identity_rows_scanned: 352,
          strategy_ontology_contract_version: 'dynasty_strategy_ontology_v1',
          strategy_ontology_model_version: 'dynasty-strategy-ontology-v1.0.0',
          strategy_ontology_generated_at: '2026-06-10T00:00:00.000Z',
        },
        notes: [
          'Read-only Management Strategy Context for future Strategy ontology activation.',
          'Strategy template selection remains disabled; no template rendering, interpolation, or recommendations are performed.',
        ],
      },
    });

    const card = signal(cards, 'Strategy Templates');
    expect(card).toMatchObject({
      status: 'inspection only',
      statusLabel: 'Inspection only',
    });
    expect(card.details).toEqual(expect.arrayContaining([
      'Strategy ontology availability: yes.',
      'Template selection: Disabled.',
      'Selected template: None.',
      'Current direction: Rebuild.',
      'Current confidence: High.',
      'Evaluated templates: 7.',
      'Compatible templates: 2 (rebuild_low_alpha_concentration, rebuild_premium_assets_timeline_mismatch).',
      'Blocked by: template_selection_disabled, missing_future_contract_inputs.',
      'Missing inputs: 4 (age_band, experience_band, role_security_signal, market_liquidity_signal).',
    ]));
    const serializedCard = JSON.stringify(card);
    expect(serializedCard).not.toContain('template_text');
    expect(serializedCard).not.toContain('{{');
    expect(serializedCard).not.toContain('}}');

    const contextCard = signal(cards, 'Strategy Context');
    expect(contextCard).toMatchObject({
      status: 'inspection only',
      statusLabel: 'Inspection only',
    });
    expect(contextCard.explanation).toContain('blocked/deferred visibility only');
    expect(contextCard.details).toEqual(expect.arrayContaining([
      'Status: blocked.',
      'Team Direction: rebuild.',
      'Team Direction confidence: high.',
      'Identity coverage: 30/30 (100%).',
      'FORGE/evidence coverage: 24/30 (80%).',
      'Strategy ontology availability: yes.',
      'Template selection: Disabled.',
      'Selected template: None.',
      'Blocked by: strategy_template_activation_deferred.',
      'Missing inputs: age_band, experience_band, role_security_signal, market_liquidity_signal.',
      'Source summary: roster 30; identity rows 352; ontology dynasty_strategy_ontology_v1 / dynasty-strategy-ontology-v1.0.0.',
    ]));
    const serializedContextCard = JSON.stringify(contextCard);
    expect(serializedContextCard).not.toContain('template_text');
    expect(serializedContextCard).not.toContain('{{');
    expect(serializedContextCard).not.toContain('}}');
    expect(serializedContextCard).not.toContain('recommendation');
  });

  it('fails Strategy Template Diagnostics closed when diagnostics are missing', () => {
    const cards = buildManagementModelSignals({
      hasActiveTeam: true,
      hasRosterData: true,
      hasDashboardTotals: false,
      rosterVisibility: {
        total: 2,
        identityCovered: 2,
        baselineVisible: 0,
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

    expect(signal(cards, 'Strategy Templates')).toMatchObject({
      status: 'unavailable',
      statusLabel: 'Unavailable',
      details: expect.arrayContaining([
        'Strategy ontology availability: no.',
        'Template selection: Disabled.',
        'Selected template: None.',
        'Compatible templates: 0.',
        'Missing inputs: not inspected.',
      ]),
    });
    expect(signal(cards, 'Strategy Context')).toMatchObject({
      status: 'unavailable',
      statusLabel: 'Unavailable',
      details: expect.arrayContaining([
        'Status: unavailable.',
        'Team Direction: Unknown.',
        'Team Direction confidence: Unknown.',
        'Strategy ontology availability: no.',
        'Template selection: Disabled.',
        'Selected template: None.',
        'Blocked by: management_strategy_context missing or malformed.',
      ]),
    });
  });

  it('fails the Strategy Context card closed without crashing on a malformed context payload', () => {
    const cards = buildManagementModelSignals({
      hasActiveTeam: true,
      hasRosterData: true,
      hasDashboardTotals: true,
      rosterVisibility: {
        total: 30,
        identityCovered: 30,
        baselineVisible: 0,
        forgeScored: 24,
        forgeBaseline: 0,
        rookieAlphaFallback: 0,
        knownUnscored: 6,
        unresolved: 0,
        evidenceCovered: 24,
      },
      teamstateQueryState: 'success',
      teamstateResponse: teamStateResponse(),
      teamstateDetails: ['Provenance status: governed_promoted.'],
      // Intentionally malformed: missing source_summary, notes is not an array,
      // an injected template body, and an attempt to enable activation.
      managementStrategyContext: {
        available: true,
        status: 'definitely_active',
        team_direction: 'rebuild',
        strategy_ontology_available: true,
        strategy_template_selection_enabled: true,
        selected_template_id: 'rebuild_premium_assets_timeline_mismatch',
        blocked_reasons: ['bogus_reason'],
        template_text: 'Roster has premium names but {{anchor_count}} anchors.',
        notes: 'not-an-array',
      } as unknown as Parameters<typeof buildManagementModelSignals>[0]['managementStrategyContext'],
    });

    const contextCard = signal(cards, 'Strategy Context');
    expect(contextCard).toMatchObject({
      status: 'unavailable',
      statusLabel: 'Unavailable',
    });
    expect(contextCard.details).toEqual(expect.arrayContaining([
      'Status: unavailable.',
      'Template selection: Disabled.',
      'Selected template: None.',
    ]));
    const serializedContextCard = JSON.stringify(contextCard);
    expect(serializedContextCard).not.toContain('template_text');
    expect(serializedContextCard).not.toContain('{{');
    expect(serializedContextCard).not.toContain('rebuild_premium_assets_timeline_mismatch');
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



  it('keeps the client snapshot export wired to the shared strategy diagnostics helper', () => {
    const source = readFileSync(resolve(process.cwd(), 'client/src/pages/TiberManagementDashboard.tsx'), 'utf8');

    expect(source).toContain('@shared/strategyTemplateDiagnostics');
    expect(source).not.toContain('server/modules/externalModels/strategyOntology/strategyTemplateDiagnostics');
  });

  it('builds active-team matching and snapshot export without using league-wide counts as roster coverage', () => {
    const roster = managementFixtureRoster();
    const matching = buildActiveTeamMatchingSummary(roster);

    expect(buildRosterVisibilitySummary(roster)).toMatchObject({
      total: 30,
      identityCovered: 30,
      forgeScored: 24,
      generatedBaselineVisibility: 0,
      evidenceCovered: 24,
      unresolved: 0,
    });
    expect(matching).toMatchObject({
      tiberCrosswalkMapped: 25,
      forgeRowMatched: 24,
      directCanonicalMatches: 0,
      playerSpecificEvidenceMatched: 24,
      generatedBaselineVisibilityMatched: 0,
      nonEvidenceRosterMatches: 0,
      sampleMatchedRosterCanonicalIds: ['sleeper:6797', 'sleeper:9493', 'sleeper:9509', 'sleeper:11624', 'sleeper:11635', 'sleeper:11783', 'sleeper:12487', 'sleeper:12506', 'sleeper:12519', 'sleeper:12530'],
    });

    const snapshot = buildManagementSnapshotExport({
      generatedAt: '2026-06-09T00:00:00.000Z',
      league: { id: 'league-db-id', leagueIdExternal: 'sleeper-league-id', leagueName: 'Morts FF Dynasty', scoringFormat: 'ppr', season: 2026 },
      team: { id: 'team-1', displayName: 'Garbage Time' },
      dashboardTeam: { team_id: 'team-1', display_name: 'Garbage Time', roster },
      teamDirection: {
        success: true,
        available: true,
        direction: 'rebuild',
        confidence: 'high',
        blockers: [],
      },
      diagnostics: {
        rosterCount: 352,
        resolvedCanonicalCount: 352,
        forgeArtifact: { available: true, sourcePath: 'server/artifacts/external/forge/forge_player_static_v1.json', rowCount: 59, playerSpecificCount: 45, generatedBaselineCount: 14, contractVersion: 'forge_player_static_v1', generatedAt: '2026-01-08T00:00:00.000Z' },
        identityCrosswalkArtifact: { available: true, sourcePath: 'server/artifacts/external/identity/tiber_identity_crosswalk_v1.json', rowCount: 25, providerMappingCount: 25, providerCount: 1, contractVersion: 'v1' },
        strategyOntologyArtifact: {
          available: true,
          state: 'available',
          sourcePath: 'server/artifacts/external/strategy/dynasty_strategy_ontology_v1.json',
          artifactType: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
          contractVersion: 'dynasty_strategy_ontology_v1',
          modelVersion: 'dynasty-strategy-ontology-v1.0.0',
          generatedAt: '2026-06-10T00:00:00.000Z',
          rowCount: 0,
          concepts: 11,
          playerAssetArchetypes: 10,
          rosterStateDefinitions: 8,
          timelineRules: 9,
          explanationTemplates: 7,
          futureContractInputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
          safetyRules: [
            'cannot_override_identity',
            'cannot_override_team_assignment',
            'cannot_override_forge_evidence',
            'cannot_count_generated_baselines_as_evidence',
            'cannot_create_projections',
            'cannot_assign_player_labels_itself',
            'cannot_consume_operator_notes_as_evidence',
            'cannot_replace_human_decision',
          ],
          archetypeAssignmentEnabled: false,
          templateSelectionEnabled: false,
        },
        strategyOntologyTemplates: [
          { template_id: 'rebuild_low_alpha_concentration', applies_to: ['rebuild'] },
          { template_id: 'rebuild_premium_assets_timeline_mismatch', applies_to: ['rebuild', 'timeline_mismatch'] },
          { template_id: 'contender_with_future_pick_drag', applies_to: ['contender'] },
        ],
      },
    });

    expect(snapshot).toMatchObject({
      artifact_type: 'TIBER_MANAGEMENT_SNAPSHOT_EXPORT',
      generated_at: '2026-06-09T00:00:00.000Z',
      active_roster_summary: {
        roster_count: 30,
        identity_coverage: { matched: 30, total: 30 },
        baseline_visibility: { matched: 0, total: 30 },
        player_specific_forge_evidence: { matched: 24, total: 30 },
        rookie_alpha_fallback: { matched: 0, total: 30 },
        evidence_coverage: { matched: 24, total: 30 },
        unresolved: { matched: 0, total: 30 },
      },
      active_team_matching: {
        tiber_crosswalk_mapped: 25,
        forge_row_matched: 24,
        direct_canonical_matches: 0,
        player_specific_evidence_matched: 24,
        generated_baseline_visibility_matched: 0,
        non_evidence_roster_matches: 0,
      },
      strategy_template_diagnostics: {
        available: true,
        artifact_type: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
        contract_version: 'dynasty_strategy_ontology_v1',
        model_version: 'dynasty-strategy-ontology-v1.0.0',
        generated_at: '2026-06-10T00:00:00.000Z',
        template_selection_enabled: false,
        selected_template_id: null,
        current_team_direction: 'Rebuild',
        current_confidence: 'High',
        evaluated_template_count: 3,
        classification_compatible_template_ids: [
          'rebuild_low_alpha_concentration',
          'rebuild_premium_assets_timeline_mismatch',
        ],
        blocked_reasons: ['template_selection_disabled', 'missing_future_contract_inputs'],
        missing_future_contract_inputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
        unavailable_reason: null,
      },
      management_strategy_context: {
        available: true,
        status: 'blocked',
        team_direction: 'rebuild',
        team_direction_confidence: 'high',
        strategy_ontology_available: true,
        strategy_template_selection_enabled: false,
        selected_template_id: null,
        blocked_reasons: ['strategy_template_activation_deferred'],
        missing_inputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
      },
      artifact_diagnostics: {
        dynasty_strategy_ontology_v1: {
          available: true,
          source_path: 'server/artifacts/external/strategy/dynasty_strategy_ontology_v1.json',
          contract_version: 'dynasty_strategy_ontology_v1',
          artifact_type: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
          model_version: 'dynasty-strategy-ontology-v1.0.0',
          generated_at: '2026-06-10T00:00:00.000Z',
          concepts: 11,
          player_asset_archetypes: 10,
          roster_state_definitions: 8,
          timeline_rules: 9,
          explanation_templates: 7,
          future_contract_inputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
          archetype_assignment_enabled: false,
          template_selection_enabled: false,
        },
        league_wide_diagnostics: {
          resolved_identity_rows_scanned: 352,
          roster_identity_rows_scanned: 352,
          helper_text: 'League-wide diagnostic count; not active-team roster coverage.',
        },
      },
    });
    expect(snapshot.strategy_template_diagnostics.templates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        template_id: 'rebuild_low_alpha_concentration',
        classification_compatible: true,
        eligibility_state: 'blocked',
        blocked_reasons: ['template_selection_disabled', 'missing_future_contract_inputs'],
        missing_inputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
      }),
    ]));
    const exportedJson = JSON.stringify(snapshot);
    expect(exportedJson).not.toContain('template_text');
    expect(JSON.stringify(snapshot.strategy_template_diagnostics)).not.toContain('template_text');
    expect(exportedJson).not.toContain('{{');
    expect(snapshot.identity_seed_report.players).toHaveLength(30);
    expect(snapshot.identity_seed_report.summary).toMatchObject({ roster_count: 30, crosswalk_matched: 25, forge_player_specific_matched: 24, generated_baseline_matched: 0 });
    expect(snapshot.identity_seed_report.players.find((player) => player.display_name === 'Frank Gore Jr.')).toMatchObject({
      crosswalk_status: 'matched',
      forge_status: 'missing_forge_row',
    });
    expect(snapshot.identity_seed_report.players.filter((player) => player.crosswalk_status === 'missing').map((player) => player.display_name)).toEqual([
      'Nate Boerkircher',
      'Sam Roush',
      'Tanner Koziol',
      'Cyrus Allen',
      'Kaelon Black',
    ]);
  });

  it('fails closed with unavailable strategy template diagnostics when the ontology artifact is malformed', () => {
    const snapshot = buildManagementSnapshotExport({
      generatedAt: '2026-06-09T00:00:00.000Z',
      league: { id: 'league-db-id', leagueIdExternal: 'sleeper-league-id', leagueName: 'Morts FF Dynasty', scoringFormat: 'ppr', season: 2026 },
      team: { id: 'team-1', displayName: 'Garbage Time' },
      dashboardTeam: { team_id: 'team-1', display_name: 'Garbage Time', roster: [] },
      teamDirection: {
        success: true,
        available: true,
        direction: 'rebuild',
        confidence: 'high',
        blockers: [],
      },
      diagnostics: {
        strategyOntologyArtifact: {
          available: false,
          state: 'malformed',
          reason: 'malformed artifact',
          artifactType: null,
          contractVersion: null,
          modelVersion: null,
          generatedAt: null,
          futureContractInputs: [],
          archetypeAssignmentEnabled: false,
          templateSelectionEnabled: false,
        },
        strategyOntologyTemplates: [
          { template_id: 'rebuild_low_alpha_concentration', applies_to: ['rebuild'] },
        ],
      },
    });

    expect(snapshot.strategy_template_diagnostics).toMatchObject({
      available: false,
      template_selection_enabled: false,
      selected_template_id: null,
      current_team_direction: 'Rebuild',
      current_confidence: 'High',
      evaluated_template_count: 0,
      classification_compatible_template_ids: [],
      blocked_reasons: [],
      missing_future_contract_inputs: [],
      templates: [],
      unavailable_reason: 'malformed artifact',
    });
    expect(snapshot.management_strategy_context).toMatchObject({
      available: false,
      status: 'unavailable',
      strategy_ontology_available: false,
      strategy_template_selection_enabled: false,
      selected_template_id: null,
      blocked_reasons: ['strategy_ontology_unavailable'],
    });
  });
});

describe('Management identity seed report', () => {
  it('exports full active roster seed data with expanded mapped rows and omitted players still missing', () => {
    const roster = managementFixtureRoster();

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
        roster,
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
        crosswalk_matched: 25,
        forge_player_specific_matched: 24,
        generated_baseline_matched: 0,
        known_unscored: 6,
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
    expect(report.players[2]).toMatchObject({
      display_name: 'Bijan Robinson',
      team: 'ATL',
      current_tiber_player_id: 'tiber-data-player-2025-bijan-robinson',
      forge_status: 'player_specific',
    });
    expect(report.players[5]).toMatchObject({
      display_name: 'Ladd McConkey',
      sleeper_id: '11635',
      provider_canonical_id: 'sleeper:11635',
      current_tiber_player_id: 'tiber-data-player-2025-ladd-mcconkey',
      crosswalk_status: 'matched',
      forge_status: 'player_specific',
      visibility_state: 'forge_scored',
      recommended_action: 'already_mapped',
    });
    expect(report.players[25]).toMatchObject({
      display_name: 'Nate Boerkircher',
      sleeper_id: '13299',
      provider_canonical_id: 'sleeper:13299',
      current_tiber_player_id: null,
      crosswalk_status: 'missing',
      forge_status: 'missing_forge_row',
      visibility_state: 'known_unscored',
      recommended_action: 'candidate_for_tiber_data_crosswalk_review',
    });
  });
});
