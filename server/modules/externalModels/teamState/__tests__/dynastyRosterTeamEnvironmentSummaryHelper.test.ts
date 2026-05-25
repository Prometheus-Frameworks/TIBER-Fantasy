import { buildDynastyRosterTeamEnvironmentSummary } from '../dynastyRosterTeamEnvironmentSummaryHelper';
import type { SmokeTestReport } from '../../playerOwnership/dynastyRosterSmokeHelper';

const ownershipBase: SmokeTestReport = {
  generatedAt: '2026-05-25T00:00:00.000Z', artifactPath: 'x', artifactAvailable: true,
  totalTested: 2, totalMatched: 2, totalUnmatched: 0, totalAmbiguous: 0, totalUnavailable: 0, byConfidence: {},
  players: [
    { inputName: 'A', available: true, matched: true, ambiguous: false, playerId: '1', canonicalName: 'A', position: 'WR', footballLevel: 'NFL', currentTeam: 'BUF', ownershipStatus: 'active_roster', confidence: 'provisional', sourceSummary: null, lastVerifiedAt: null, warnings: [], aliasApplied: false, aliasCanonicalName: null },
    { inputName: 'B', available: true, matched: true, ambiguous: false, playerId: '2', canonicalName: 'B', position: 'RB', footballLevel: 'NFL', currentTeam: 'NE', ownershipStatus: 'active_roster', confidence: 'source_verified', sourceSummary: null, lastVerifiedAt: null, warnings: [], aliasApplied: false, aliasCanonicalName: null },
  ],
};

describe('buildDynastyRosterTeamEnvironmentSummary', () => {
  it('joins by teamAbbr and preserves unknown tiers from attached profiles', () => {
    const result = buildDynastyRosterTeamEnvironmentSummary(ownershipBase, {
      artifact: 'team_environment_profiles_v0',
      profiles: [
        {
          teamId: 'nfl-buf',
          teamAbbr: 'BUF',
          season: 2026,
          generatedAt: '2026-05-25T00:00:00.000Z',
          sourceSnapshotAt: '2026-05-25T00:00:00.000Z',
          marketTier: null,
          offenseTier: 'elite',
          passEnvironmentTier: 'pass_heavy',
          paceTier: null,
          volatilityTier: 'stable',
          signals: {},
          warnings: ['pace unknown'],
        },
      ],
    });
    expect(result.playersWithTeamEnvironmentProfile).toBe(1);
    expect(result.playersMissingTeamEnvironmentProfile).toBe(1);
    expect(result.offenseTierExposure.elite).toBe(1);
    expect(result.offenseTierExposure.unknown).toBe(1);
    expect(result.paceExposure.unknown).toBe(2);
    expect(result.players[0].teamstateWarnings).toContain('pace unknown');
    expect(result.players[1].joinStatus).toBe('team_environment_missing');
  });

  it('counts missing artifact rows as unknown exposure without fabrication', () => {
    const result = buildDynastyRosterTeamEnvironmentSummary(ownershipBase, null);
    expect(result.playersWithTeamEnvironmentProfile).toBe(0);
    expect(result.playersMissingTeamEnvironmentProfile).toBe(2);
    expect(result.players.every((p) => p.joinStatus === 'team_environment_unavailable')).toBe(true);
    expect(result.offenseTierExposure.unknown).toBe(2);
    expect(result.passEnvironmentExposure.unknown).toBe(2);
    expect(result.paceExposure.unknown).toBe(2);
    expect(result.volatilityExposure.unknown).toBe(2);
  });
});
