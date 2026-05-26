import { buildDynastyRosterTeamEnvironmentSummary } from '../dynastyRosterTeamEnvironmentSummaryHelper';

const smokeBase: any = { generatedAt: 'x', artifactPath: 'x', artifactAvailable: true, totalTested: 0, totalMatched: 0, totalUnmatched: 0, totalAmbiguous: 0, totalUnavailable: 0, byConfidence: {}, players: [] };
const profile = { contractVersion: 'team_environment_profile_v0', teamId: 'nfl-buf', teamAbbr: 'BUF', season: 2026, generatedAt: 'x', sourceSnapshotAt: null, marketTier: 'strong', offenseTier: 'elite', passEnvironmentTier: 'pass_heavy', paceTier: 'fast', volatilityTier: 'stable', signals: [], warnings: ['small sample'] } as const;

describe('buildDynastyRosterTeamEnvironmentSummary', () => {
  it('happy path joins by teamAbbr, counts lanes, preserves warnings', () => {
    const smoke = { ...smokeBase, totalTested: 1, totalMatched: 1, players: [{ inputName: 'A', matched: true, canonicalName: 'A', position: 'WR', currentTeam: 'BUF', confidence: 'provisional' }] };
    const out = buildDynastyRosterTeamEnvironmentSummary(smoke, { profiles: [profile as any] });
    expect(out.players[0].joinStatus).toBe('attached');
    expect(out.players[0].teamstateWarnings).toEqual(['small sample']);
    expect(out.offenseTierExposure.elite).toBe(1);
  });

  it('missing artifact marks matched rows unavailable and counts unknown exposure', () => {
    const smoke = { ...smokeBase, totalTested: 2, totalMatched: 2, players: [{ inputName: 'A', matched: true, currentTeam: 'BUF' }, { inputName: 'B', matched: true, currentTeam: 'PHI' }] };
    const out = buildDynastyRosterTeamEnvironmentSummary(smoke as any, null);
    expect(out.offenseTierExposure.unknown).toBe(2);
    expect(out.passEnvironmentExposure.unknown).toBe(2);
    expect(out.paceExposure.unknown).toBe(2);
    expect(out.volatilityExposure.unknown).toBe(2);
    expect(out.players.every((p) => p.joinStatus === 'team_environment_unavailable')).toBe(true);
  });

  it('missing team profile increments unknown by 1 with team_environment_missing', () => {
    const smoke = { ...smokeBase, totalTested: 1, totalMatched: 1, players: [{ inputName: 'A', matched: true, currentTeam: 'DAL' }] };
    const out = buildDynastyRosterTeamEnvironmentSummary(smoke as any, { profiles: [profile as any] });
    expect(out.players[0].joinStatus).toBe('team_environment_missing');
    expect(out.offenseTierExposure.unknown).toBe(1);
  });

  it('attached profile with one unknown lane counts only that lane as unknown', () => {
    const smoke = { ...smokeBase, totalTested: 1, totalMatched: 1, players: [{ inputName: 'A', matched: true, currentTeam: 'BUF' }] };
    const out = buildDynastyRosterTeamEnvironmentSummary(smoke as any, { profiles: [{ ...profile, paceTier: 'unknown' } as any] });
    expect(out.offenseTierExposure.elite).toBe(1);
    expect(out.passEnvironmentExposure.pass_heavy).toBe(1);
    expect(out.paceExposure.unknown).toBe(1);
    expect(out.volatilityExposure.stable).toBe(1);
  });

  it('unmatched ownership row does not increment environment exposure and marks ownership_unmatched', () => {
    const smoke = { ...smokeBase, totalTested: 1, totalMatched: 0, players: [{ inputName: 'A', matched: false, currentTeam: 'BUF' }] };
    const out = buildDynastyRosterTeamEnvironmentSummary(smoke as any, { profiles: [profile as any] });
    expect(out.players[0].joinStatus).toBe('ownership_unmatched');
    expect(Object.keys(out.offenseTierExposure)).toHaveLength(0);
  });
});
