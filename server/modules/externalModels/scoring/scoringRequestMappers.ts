import { ScoringLeagueContextInput, ScoringPlayerInput } from './types';

interface TiberPlayerLike {
  canonicalId: string;
  fullName: string;
  position: string;
  nflTeam: string | null;
}

export function toScoringPlayerInput(player: TiberPlayerLike): ScoringPlayerInput {
  return {
    playerId: player.canonicalId,
    playerName: player.fullName,
    team: player.nflTeam,
    position: player.position,
  };
}

export function toLeagueContextInput(input: {
  season?: number;
  week?: number;
  scoringFormat?: string;
  teams?: number;
}): ScoringLeagueContextInput {
  return {
    season: Number.isInteger(input.season) ? input.season : undefined,
    week: Number.isInteger(input.week) ? input.week : undefined,
    scoringFormat: input.scoringFormat ?? 'ppr',
    teams: Number.isInteger(input.teams) ? input.teams : 12,
  };
}
