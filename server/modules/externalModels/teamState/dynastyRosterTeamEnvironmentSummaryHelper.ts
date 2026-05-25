import type { SmokeTestReport } from '../playerOwnership/dynastyRosterSmokeHelper';
import type { TeamEnvironmentProfilesArtifact } from './teamEnvironmentProfilesClient';

type JoinStatus = 'attached' | 'team_environment_missing' | 'team_environment_unavailable' | 'no_team_on_ownership';

export interface PlayerTeamEnvironmentAttachment {
  inputName: string;
  canonicalPlayerName: string | null;
  position: string | null;
  team: string | null;
  ownershipConfidence: string | null;
  offenseTier: string;
  passEnvironmentTier: string;
  paceTier: string;
  volatilityTier: string;
  teamstateWarnings: string[];
  joinStatus: JoinStatus;
}

export interface DynastyRosterTeamEnvironmentSummary {
  rosterPlayersTested: number;
  playersWithOwnershipMatch: number;
  playersWithTeamEnvironmentProfile: number;
  playersMissingTeamEnvironmentProfile: number;
  offenseTierExposure: Record<string, number>;
  passEnvironmentExposure: Record<string, number>;
  paceExposure: Record<string, number>;
  volatilityExposure: Record<string, number>;
  players: PlayerTeamEnvironmentAttachment[];
}

const OFFENSE_LANES = ['elite', 'strong', 'average', 'weak', 'unknown'];
const PASS_LANES = ['pass_heavy', 'balanced', 'run_heavy', 'unknown'];
const PACE_LANES = ['fast', 'neutral', 'slow', 'unknown'];
const VOLATILITY_LANES = ['stable', 'volatile', 'unknown'];

function initCounts(keys: string[]) { return Object.fromEntries(keys.map((k) => [k, 0])) as Record<string, number>; }
function normalizeTier(v: string | null | undefined) { return v && v.trim() ? v : 'unknown'; }

function incrementExposure(
  offenseTierExposure: Record<string, number>,
  passEnvironmentExposure: Record<string, number>,
  paceExposure: Record<string, number>,
  volatilityExposure: Record<string, number>,
  offenseTier: string,
  passEnvironmentTier: string,
  paceTier: string,
  volatilityTier: string,
) {
  offenseTierExposure[offenseTier] = (offenseTierExposure[offenseTier] ?? 0) + 1;
  passEnvironmentExposure[passEnvironmentTier] = (passEnvironmentExposure[passEnvironmentTier] ?? 0) + 1;
  paceExposure[paceTier] = (paceExposure[paceTier] ?? 0) + 1;
  volatilityExposure[volatilityTier] = (volatilityExposure[volatilityTier] ?? 0) + 1;
}

export function buildDynastyRosterTeamEnvironmentSummary(
  ownershipReport: SmokeTestReport,
  teamEnvironmentArtifact: TeamEnvironmentProfilesArtifact | null,
): DynastyRosterTeamEnvironmentSummary {
  const profileMap = new Map((teamEnvironmentArtifact?.profiles ?? []).map((p) => [p.teamAbbr.toUpperCase(), p]));
  const offenseTierExposure = initCounts(OFFENSE_LANES);
  const passEnvironmentExposure = initCounts(PASS_LANES);
  const paceExposure = initCounts(PACE_LANES);
  const volatilityExposure = initCounts(VOLATILITY_LANES);

  let playersWithTeamEnvironmentProfile = 0;
  let playersMissingTeamEnvironmentProfile = 0;

  const players = ownershipReport.players.map((p): PlayerTeamEnvironmentAttachment => {
    const team = p.currentTeam?.toUpperCase() ?? null;

    if (!p.matched) {
      return {
        inputName: p.inputName,
        canonicalPlayerName: p.canonicalName,
        position: p.position,
        team,
        ownershipConfidence: p.confidence,
        offenseTier: 'unknown',
        passEnvironmentTier: 'unknown',
        paceTier: 'unknown',
        volatilityTier: 'unknown',
        teamstateWarnings: ['Ownership row not matched; no team environment join attempted.'],
        joinStatus: 'team_environment_missing',
      };
    }

    if (!team) {
      playersMissingTeamEnvironmentProfile += 1;
      incrementExposure(offenseTierExposure, passEnvironmentExposure, paceExposure, volatilityExposure, 'unknown', 'unknown', 'unknown', 'unknown');
      return { inputName: p.inputName, canonicalPlayerName: p.canonicalName, position: p.position, team, ownershipConfidence: p.confidence, offenseTier: 'unknown', passEnvironmentTier: 'unknown', paceTier: 'unknown', volatilityTier: 'unknown', teamstateWarnings: ['Ownership row has no current team abbreviation.'], joinStatus: 'no_team_on_ownership' };
    }

    if (!teamEnvironmentArtifact) {
      playersMissingTeamEnvironmentProfile += 1;
      incrementExposure(offenseTierExposure, passEnvironmentExposure, paceExposure, volatilityExposure, 'unknown', 'unknown', 'unknown', 'unknown');
      return { inputName: p.inputName, canonicalPlayerName: p.canonicalName, position: p.position, team, ownershipConfidence: p.confidence, offenseTier: 'unknown', passEnvironmentTier: 'unknown', paceTier: 'unknown', volatilityTier: 'unknown', teamstateWarnings: ['Teamstate environment artifact unavailable.'], joinStatus: 'team_environment_unavailable' };
    }

    const profile = profileMap.get(team);
    if (!profile) {
      playersMissingTeamEnvironmentProfile += 1;
      incrementExposure(offenseTierExposure, passEnvironmentExposure, paceExposure, volatilityExposure, 'unknown', 'unknown', 'unknown', 'unknown');
      return { inputName: p.inputName, canonicalPlayerName: p.canonicalName, position: p.position, team, ownershipConfidence: p.confidence, offenseTier: 'unknown', passEnvironmentTier: 'unknown', paceTier: 'unknown', volatilityTier: 'unknown', teamstateWarnings: ['No Teamstate environment profile for player team.'], joinStatus: 'team_environment_missing' };
    }

    const offenseTier = normalizeTier(profile.offenseTier);
    const passEnvironmentTier = normalizeTier(profile.passEnvironmentTier);
    const paceTier = normalizeTier(profile.paceTier);
    const volatilityTier = normalizeTier(profile.volatilityTier);

    playersWithTeamEnvironmentProfile += 1;
    incrementExposure(offenseTierExposure, passEnvironmentExposure, paceExposure, volatilityExposure, offenseTier, passEnvironmentTier, paceTier, volatilityTier);

    return { inputName: p.inputName, canonicalPlayerName: p.canonicalName, position: p.position, team, ownershipConfidence: p.confidence, offenseTier, passEnvironmentTier, paceTier, volatilityTier, teamstateWarnings: profile.warnings ?? [], joinStatus: 'attached' };
  });

  return {
    rosterPlayersTested: ownershipReport.totalTested,
    playersWithOwnershipMatch: ownershipReport.totalMatched,
    playersWithTeamEnvironmentProfile,
    playersMissingTeamEnvironmentProfile,
    offenseTierExposure,
    passEnvironmentExposure,
    paceExposure,
    volatilityExposure,
    players,
  };
}
