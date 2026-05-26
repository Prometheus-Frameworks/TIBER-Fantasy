import {
  SmokeTestReport,
  SmokeTestPlayerResult,
} from '../playerOwnership/dynastyRosterSmokeHelper';
import { TeamEnvironmentProfileV0 } from './teamEnvironmentProfilesClient';

export type TeamEnvironmentJoinStatus =
  | 'attached'
  | 'team_environment_unavailable'
  | 'team_environment_missing'
  | 'no_team_on_ownership'
  | 'ownership_unmatched';

type ExposureKey = TeamEnvironmentProfileV0['offenseTier'] | TeamEnvironmentProfileV0['passEnvironmentTier'] | TeamEnvironmentProfileV0['paceTier'] | TeamEnvironmentProfileV0['volatilityTier'];

export interface PlayerTeamEnvironmentRow {
  inputName: string;
  canonicalPlayerName: string | null;
  position: string | null;
  team: string | null;
  ownershipConfidence: string | null;
  offenseTier: string | null;
  passEnvironmentTier: string | null;
  paceTier: string | null;
  volatilityTier: string | null;
  teamstateWarnings: string[];
  joinStatus: TeamEnvironmentJoinStatus;
}

export interface DynastyRosterTeamEnvironmentSummary {
  generatedAt: string;
  rosterPlayersTested: number;
  playersWithOwnershipMatch: number;
  playersWithTeamEnvironmentProfile: number;
  playersMissingTeamEnvironmentProfile: number;
  offenseTierExposure: Record<string, number>;
  passEnvironmentExposure: Record<string, number>;
  paceExposure: Record<string, number>;
  volatilityExposure: Record<string, number>;
  players: PlayerTeamEnvironmentRow[];
}

function inc(bucket: Record<string, number>, key: ExposureKey | 'unknown') { bucket[key] = (bucket[key] ?? 0) + 1; }

export function buildDynastyRosterTeamEnvironmentSummary(
  smoke: SmokeTestReport,
  profilesArtifact: { profiles: TeamEnvironmentProfileV0[] } | null,
): DynastyRosterTeamEnvironmentSummary {
  const profileByAbbr = new Map((profilesArtifact?.profiles ?? []).map((p) => [p.teamAbbr.toUpperCase(), p]));
  const offenseTierExposure: Record<string, number> = {};
  const passEnvironmentExposure: Record<string, number> = {};
  const paceExposure: Record<string, number> = {};
  const volatilityExposure: Record<string, number> = {};

  let attached = 0;
  let missing = 0;

  const players = smoke.players.map((p: SmokeTestPlayerResult): PlayerTeamEnvironmentRow => {
    if (!p.matched) {
      return { inputName: p.inputName, canonicalPlayerName: p.canonicalName, position: p.position, team: p.currentTeam, ownershipConfidence: p.confidence, offenseTier: null, passEnvironmentTier: null, paceTier: null, volatilityTier: null, teamstateWarnings: [], joinStatus: 'ownership_unmatched' };
    }

    if (!p.currentTeam) {
      missing += 1;
      inc(offenseTierExposure, 'unknown'); inc(passEnvironmentExposure, 'unknown'); inc(paceExposure, 'unknown'); inc(volatilityExposure, 'unknown');
      return { inputName: p.inputName, canonicalPlayerName: p.canonicalName, position: p.position, team: null, ownershipConfidence: p.confidence, offenseTier: 'unknown', passEnvironmentTier: 'unknown', paceTier: 'unknown', volatilityTier: 'unknown', teamstateWarnings: [], joinStatus: 'no_team_on_ownership' };
    }

    if (!profilesArtifact) {
      missing += 1;
      inc(offenseTierExposure, 'unknown'); inc(passEnvironmentExposure, 'unknown'); inc(paceExposure, 'unknown'); inc(volatilityExposure, 'unknown');
      return { inputName: p.inputName, canonicalPlayerName: p.canonicalName, position: p.position, team: p.currentTeam, ownershipConfidence: p.confidence, offenseTier: 'unknown', passEnvironmentTier: 'unknown', paceTier: 'unknown', volatilityTier: 'unknown', teamstateWarnings: [], joinStatus: 'team_environment_unavailable' };
    }

    const profile = profileByAbbr.get(p.currentTeam.toUpperCase());
    if (!profile) {
      missing += 1;
      inc(offenseTierExposure, 'unknown'); inc(passEnvironmentExposure, 'unknown'); inc(paceExposure, 'unknown'); inc(volatilityExposure, 'unknown');
      return { inputName: p.inputName, canonicalPlayerName: p.canonicalName, position: p.position, team: p.currentTeam, ownershipConfidence: p.confidence, offenseTier: 'unknown', passEnvironmentTier: 'unknown', paceTier: 'unknown', volatilityTier: 'unknown', teamstateWarnings: [], joinStatus: 'team_environment_missing' };
    }

    attached += 1;
    inc(offenseTierExposure, profile.offenseTier); inc(passEnvironmentExposure, profile.passEnvironmentTier); inc(paceExposure, profile.paceTier); inc(volatilityExposure, profile.volatilityTier);
    return { inputName: p.inputName, canonicalPlayerName: p.canonicalName, position: p.position, team: p.currentTeam, ownershipConfidence: p.confidence, offenseTier: profile.offenseTier, passEnvironmentTier: profile.passEnvironmentTier, paceTier: profile.paceTier, volatilityTier: profile.volatilityTier, teamstateWarnings: [...profile.warnings], joinStatus: 'attached' };
  });

  return {
    generatedAt: new Date().toISOString(),
    rosterPlayersTested: smoke.totalTested,
    playersWithOwnershipMatch: smoke.totalMatched,
    playersWithTeamEnvironmentProfile: attached,
    playersMissingTeamEnvironmentProfile: missing,
    offenseTierExposure,
    passEnvironmentExposure,
    paceExposure,
    volatilityExposure,
    players,
  };
}
