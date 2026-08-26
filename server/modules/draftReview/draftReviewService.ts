import {
  deriveSleeperScoringFormat,
  sleeperClient,
  type SleeperDraftPick,
  type SleeperPlayer,
} from '../../integrations/sleeperClient';

const ALLOWED_SLEEPER_HOSTS = new Set(['sleeper.com', 'www.sleeper.com', 'sleeper.app', 'www.sleeper.app']);
const PLAYER_CACHE_MS = 6 * 60 * 60 * 1000;

let playerCache: { fetchedAt: number; players: Record<string, SleeperPlayer> } | null = null;

export type DraftReviewInput = {
  leagueId: string;
  rosterId: number;
  canonicalUrl: string;
};

export function parseSleeperRosterUrl(rawInput: string): DraftReviewInput {
  const input = rawInput.trim();
  if (!input) throw new Error('A Sleeper roster URL is required.');

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Enter the complete Sleeper roster URL.');
  }

  if (!ALLOWED_SLEEPER_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Only public Sleeper roster URLs are supported in this pilot.');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const rosterIndex = parts.indexOf('roster');
  const leagueId = rosterIndex >= 0 ? parts[rosterIndex + 1] : null;
  const rosterIdRaw = rosterIndex >= 0 ? parts[rosterIndex + 2] : null;

  if (!leagueId || !/^\d+$/.test(leagueId) || !rosterIdRaw || !/^\d+$/.test(rosterIdRaw)) {
    throw new Error('Use a Sleeper roster link ending in /roster/{league_id}/{roster_id}.');
  }

  const rosterId = Number(rosterIdRaw);
  return {
    leagueId,
    rosterId,
    canonicalUrl: `https://sleeper.com/roster/${leagueId}/${rosterId}`,
  };
}

async function getPlayers() {
  if (playerCache && Date.now() - playerCache.fetchedAt < PLAYER_CACHE_MS) return playerCache.players;
  const players = await sleeperClient.getNflPlayers();
  playerCache = { fetchedAt: Date.now(), players };
  return players;
}

function countSlots(slots: string[] = []) {
  return slots.reduce<Record<string, number>>((counts, slot) => {
    counts[slot] = (counts[slot] ?? 0) + 1;
    return counts;
  }, {});
}

function deriveLeagueMode(type: unknown) {
  if (type === null || type === undefined || type === '') return { code: null, mode: 'unknown' as const };
  const code = Number(type);
  if (code === 0) return { code, mode: 'redraft' as const };
  if (code === 1) return { code, mode: 'keeper' as const };
  if (code === 2) return { code, mode: 'dynasty' as const };
  return { code: Number.isFinite(code) ? code : null, mode: 'unknown' as const };
}

function displayName(playerId: string, player?: SleeperPlayer) {
  return player?.full_name?.trim()
    || [player?.first_name, player?.last_name].filter(Boolean).join(' ').trim()
    || `Sleeper player ${playerId}`;
}

function mapPick(pick: SleeperDraftPick, players: Record<string, SleeperPlayer>) {
  const player = players[pick.player_id];
  return {
    player_id: pick.player_id,
    name: displayName(pick.player_id, player),
    position: player?.position ?? pick.metadata?.position ?? null,
    team: player?.team ?? pick.metadata?.team ?? null,
    round: pick.round,
    pick_no: pick.pick_no,
  };
}

export async function buildDraftReview(rawInput: string) {
  const input = parseSleeperRosterUrl(rawInput);
  const [league, users, rosters, players] = await Promise.all([
    sleeperClient.getLeague(input.leagueId),
    sleeperClient.getLeagueUsers(input.leagueId),
    sleeperClient.getLeagueRosters(input.leagueId),
    getPlayers(),
  ]);

  const roster = rosters.find((candidate) => Number(candidate.roster_id) === input.rosterId);
  if (!roster) throw new Error(`Roster ${input.rosterId} was not found in this Sleeper league.`);

  const owner = users.find((candidate) => String(candidate.user_id) === String(roster.owner_id));
  const starterIds = new Set((roster.starters ?? []).filter((id) => id && id !== '0'));
  const reserveIds = new Set(roster.reserve ?? []);
  const taxiIds = new Set(roster.taxi ?? []);
  const rosterPlayerIds = roster.players ?? [];

  const rosterPlayers = rosterPlayerIds.map((playerId) => {
    const player = players[playerId];
    return {
      player_id: playerId,
      name: displayName(playerId, player),
      position: player?.position ?? null,
      team: player?.team ?? null,
      status: player?.status ?? null,
      active: player?.active ?? null,
      roster_state: starterIds.has(playerId)
        ? 'starter'
        : reserveIds.has(playerId)
          ? 'reserve'
          : taxiIds.has(playerId)
            ? 'taxi'
            : 'bench',
    };
  });

  const positionCounts = rosterPlayers.reduce<Record<string, number>>((counts, player) => {
    const position = player.position ?? 'UNKNOWN';
    counts[position] = (counts[position] ?? 0) + 1;
    return counts;
  }, {});

  let draftPicks: ReturnType<typeof mapPick>[] = [];
  let draftStatus: 'available' | 'unavailable' = 'unavailable';
  if (league.draft_id) {
    try {
      const picks = await sleeperClient.getDraftPicks(league.draft_id);
      draftPicks = picks
        .filter((pick) => Number(pick.roster_id) === input.rosterId)
        .sort((a, b) => a.pick_no - b.pick_no)
        .map((pick) => mapPick(pick, players));
      draftStatus = draftPicks.length > 0 ? 'available' : 'unavailable';
    } catch {
      draftStatus = 'unavailable';
    }
  }

  const lineupSlots = countSlots(league.roster_positions ?? []);
  const scoringFormat = deriveSleeperScoringFormat(league.scoring_settings);
  const leagueMode = deriveLeagueMode(league.settings?.type);

  return {
    schema_version: 'tiber_draft_review_v0',
    generated_at: new Date().toISOString(),
    status: 'available',
    input,
    observed: {
      league: {
        league_id: league.league_id,
        name: league.name,
        season: league.season,
        status: league.status ?? null,
        total_rosters: league.total_rosters ?? rosters.length,
        league_mode: leagueMode.mode,
        league_type_code: leagueMode.code,
        scoring_format: scoringFormat,
        scoring_settings: league.scoring_settings ?? {},
        roster_positions: league.roster_positions ?? [],
        lineup_slots: lineupSlots,
      },
      team: {
        roster_id: roster.roster_id,
        owner_id: roster.owner_id,
        display_name: owner?.metadata?.team_name || owner?.team_name || owner?.display_name || `Roster ${roster.roster_id}`,
        manager_name: owner?.display_name ?? null,
      },
      current_roster: rosterPlayers,
      draft: {
        status: draftStatus,
        draft_id: league.draft_id ?? null,
        picks: draftPicks,
      },
    },
    derived: {
      roster_count: rosterPlayers.length,
      starter_count: rosterPlayers.filter((player) => player.roster_state === 'starter').length,
      bench_count: rosterPlayers.filter((player) => player.roster_state === 'bench').length,
      reserve_count: rosterPlayers.filter((player) => player.roster_state === 'reserve').length,
      position_counts: positionCounts,
      roster_flags: [
        ...(lineupSlots.QB === 1 && (positionCounts.QB ?? 0) > 1
          ? [`${positionCounts.QB} quarterbacks rostered for 1 weekly QB slot.`]
          : []),
        ...(lineupSlots.TE === 1 && (positionCounts.TE ?? 0) > 1
          ? [`${positionCounts.TE} tight ends rostered for 1 weekly TE slot.`]
          : []),
      ],
      decision_context: {
        league_mode: leagueMode.mode,
        scoring_format: scoringFormat,
        lineup_slots: lineupSlots,
        evaluation_horizons: ['next_3_weeks', 'next_6_weeks', 'rest_of_season'],
      },
    },
    forecast: {
      status: 'unavailable',
      reason: 'No current governed TIBER-Forecast redraft projection artifact is connected to this public pilot.',
      requested_horizons: ['next_3_weeks', 'next_6_weeks', 'rest_of_season'],
      fabricated_values: false,
    },
    provenance: {
      authority: 'public_sleeper_observation_and_deterministic_tiber_derivation',
      source_urls: [
        `https://api.sleeper.app/v1/league/${input.leagueId}`,
        `https://api.sleeper.app/v1/league/${input.leagueId}/users`,
        `https://api.sleeper.app/v1/league/${input.leagueId}/rosters`,
        'https://api.sleeper.app/v1/players/nfl',
      ],
      disclosures: [
        'Roster membership and league settings are current public Sleeper observations at request time.',
        'Position counts and roster flags are deterministic derivations, not player evaluations.',
        'This pilot does not use FFC ADP, create projections, grade the draft, or recommend transactions.',
      ],
    },
  };
}
