export const TRAILING_PRODUCTION_CACHE_PATH = '.cache/tiber/draft/trailing_production_2025_ppr.json';

export type DraftPosition = 'QB' | 'RB' | 'WR' | 'TE';

export type TrailingProductionPlayer = {
  player_id: string;
  player_name: string;
  position: DraftPosition;
  primary_team: string | null;
  games_played: number;
  season_ppr: number;
  season_ppg: number;
};

export type TrailingProductionArtifact = {
  schema_version: 'draft_trailing_production_v0';
  authority: 'promoted_governed_historical_evidence';
  season: 2025;
  scoring: 'ppr';
  source: {
    repository: string;
    commit_sha: string;
    path: string;
    blob_sha: string;
    artifact_id: string;
    source_status: string;
    promotion_review: string | null;
    promoted_at: string | null;
  };
  player_count: number;
  players: TrailingProductionPlayer[];
};

export type ReplacementRanks = Record<DraftPosition, number>;

function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function rankPosition(players: TrailingProductionPlayer[], position: DraftPosition) {
  return players
    .filter(
      (player) =>
        player.position === position &&
        Number.isFinite(player.season_ppr) &&
        Number.isFinite(player.season_ppg) &&
        Number.isFinite(player.games_played) &&
        player.games_played > 0,
    )
    .sort((a, b) => {
      if (b.season_ppr !== a.season_ppr) return b.season_ppr - a.season_ppr;
      if (b.season_ppg !== a.season_ppg) return b.season_ppg - a.season_ppg;
      if (b.games_played !== a.games_played) return b.games_played - a.games_played;
      if (a.player_name !== b.player_name) return a.player_name.localeCompare(b.player_name);
      return a.player_id.localeCompare(b.player_id);
    });
}

export function calculateTrailingVor(
  artifact: TrailingProductionArtifact,
  replacementRanks: ReplacementRanks,
  candidateNames?: string[],
) {
  const rankedByPosition = {} as Record<DraftPosition, TrailingProductionPlayer[]>;
  const replacement = {} as Record<
    DraftPosition,
    {
      rank: number;
      player_id: string;
      player_name: string;
      primary_team: string | null;
      games_played: number;
      season_ppr: number;
      season_ppg: number;
    }
  >;

  for (const position of ['QB', 'RB', 'WR', 'TE'] as DraftPosition[]) {
    const ranked = rankPosition(artifact.players, position);
    rankedByPosition[position] = ranked;
    const rank = replacementRanks[position];
    const baseline = ranked[rank - 1];
    if (!baseline) {
      return {
        status: 'insufficient_population' as const,
        position,
        requested_replacement_rank: rank,
        eligible_player_count: ranked.length,
      };
    }
    replacement[position] = {
      rank,
      player_id: baseline.player_id,
      player_name: baseline.player_name,
      primary_team: baseline.primary_team,
      games_played: baseline.games_played,
      season_ppr: baseline.season_ppr,
      season_ppg: baseline.season_ppg,
    };
  }

  const requested = candidateNames?.map((name) => ({ raw: name, normalized: normalizeName(name) })) ?? [];
  const index = new Map<string, TrailingProductionPlayer>();
  for (const position of ['QB', 'RB', 'WR', 'TE'] as DraftPosition[]) {
    for (const player of rankedByPosition[position]) {
      const key = normalizeName(player.player_name);
      if (key && !index.has(key)) index.set(key, player);
    }
  }

  const candidateResults = requested.flatMap(({ raw, normalized }) => {
    const player = index.get(normalized);
    if (!player) return [];
    const ranked = rankedByPosition[player.position];
    const positionRank = ranked.findIndex((row) => row.player_id === player.player_id) + 1;
    const baseline = replacement[player.position];
    return [
      {
        requested_name: raw,
        player_id: player.player_id,
        player_name: player.player_name,
        position: player.position,
        primary_team_2025: player.primary_team,
        games_played_2025: player.games_played,
        season_ppr_2025: player.season_ppr,
        season_ppg_2025: player.season_ppg,
        position_rank_by_2025_season_ppr: positionRank,
        replacement_rank: baseline.rank,
        replacement_player: baseline.player_name,
        replacement_season_ppr_2025: baseline.season_ppr,
        replacement_season_ppg_2025: baseline.season_ppg,
        trailing_vor_season_ppr: round2(player.season_ppr - baseline.season_ppr),
        ppg_delta_vs_replacement_context: round2(player.season_ppg - baseline.season_ppg),
      },
    ];
  });

  const matched = new Set(candidateResults.map((row) => normalizeName(row.requested_name)));
  const unmatchedCandidates = requested.filter(({ normalized }) => !matched.has(normalized)).map(({ raw }) => raw);

  return {
    status: 'available' as const,
    replacement,
    candidates: candidateResults,
    unmatched_candidates: unmatchedCandidates,
  };
}
