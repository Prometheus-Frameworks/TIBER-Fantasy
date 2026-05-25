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
  it('joins by team and preserves unknown tiers', () => {
    const result = buildDynastyRosterTeamEnvironmentSummary(ownershipBase, {
      artifact: 'team_environment_profiles_v0',
      profiles: [
        { teamAbbr: 'BUF', offenseTier: 'elite', passEnvironmentTier: 'pass_heavy', paceTier: null, volatilityTier: 'stable', sourceSnapshotAt: null, warnings: ['pace unknown'] },
      ],
    });
    expect(result.playersWithTeamEnvironmentProfile).toBe(1);
    expect(result.playersMissingTeamEnvironmentProfile).toBe(1);
    expect(result.offenseTierExposure.elite).toBe(1);
    expect(result.paceExposure.unknown).toBe(1);
    expect(result.players[0].teamstateWarnings).toContain('pace unknown');
    expect(result.players[1].joinStatus).toBe('team_environment_missing');
  });

  it('handles missing artifact without fabrication', () => {
    const result = buildDynastyRosterTeamEnvironmentSummary(ownershipBase, null);
    expect(result.playersWithTeamEnvironmentProfile).toBe(0);
    expect(result.playersMissingTeamEnvironmentProfile).toBe(2);
    expect(result.players.every((p) => p.joinStatus === 'team_environment_unavailable')).toBe(true);
    expect(result.players.every((p) => p.offenseTier === 'unknown')).toBe(true);
  });
});
