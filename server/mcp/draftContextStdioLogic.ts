import type { TrailingProductionArtifact } from './draftContextTrailingVor';

export const TRAILING_PRODUCTION_SOURCE_REFERENCE = {
  repository: 'Prometheus-Frameworks/TIBER-Data',
  commit_sha: 'cc2b7842b99e1184c04a605a1860c5ab25267ae8',
  path: 'exports/promoted/nfl/player_season_coverage_v0.json',
  blob_sha: 'f7b2918b978d842cd8753a7f3dedd3836934859b',
  artifact_id: 'player_season_coverage_v0',
  source_status: 'promoted_governed_artifact',
} as const;

export function isExpectedTrailingProductionArtifact(value: unknown): value is TrailingProductionArtifact {
  if (!value || typeof value !== 'object') return false;

  const artifact = value as Partial<TrailingProductionArtifact>;
  const source = artifact.source;
  return (
    artifact.schema_version === 'draft_trailing_production_v0' &&
    artifact.authority === 'promoted_governed_historical_evidence' &&
    artifact.season === 2025 &&
    artifact.scoring === 'ppr' &&
    source?.repository === TRAILING_PRODUCTION_SOURCE_REFERENCE.repository &&
    source.commit_sha === TRAILING_PRODUCTION_SOURCE_REFERENCE.commit_sha &&
    source.path === TRAILING_PRODUCTION_SOURCE_REFERENCE.path &&
    source.blob_sha === TRAILING_PRODUCTION_SOURCE_REFERENCE.blob_sha &&
    source.artifact_id === TRAILING_PRODUCTION_SOURCE_REFERENCE.artifact_id &&
    source.source_status === TRAILING_PRODUCTION_SOURCE_REFERENCE.source_status &&
    Array.isArray(artifact.players) &&
    artifact.player_count === artifact.players.length
  );
}

export function selectAdpCandidates<T extends { name: string }>(
  allPlayers: T[],
  candidateNames: string[] | undefined,
  limit: number,
) {
  const wanted = candidateNames?.map((name) => ({ raw: name, normalized: name.trim().toLowerCase() }));
  const allMatches = allPlayers.filter(
    (player) => !wanted || wanted.some(({ normalized }) => normalized === player.name.toLowerCase()),
  );
  const matched = new Set(allMatches.map((player) => player.name.toLowerCase()));
  const unmatchedCandidates = wanted?.filter(({ normalized }) => !matched.has(normalized)).map(({ raw }) => raw) ?? [];

  return {
    players: allMatches.slice(0, limit),
    unmatchedCandidates,
  };
}

type InsufficientPopulationCalculation = {
  status: 'insufficient_population';
  position: string;
  requested_replacement_rank: number;
  eligible_player_count: number;
};

export function unavailableInsufficientPopulation(calculation: InsufficientPopulationCalculation) {
  return {
    ...calculation,
    status: 'unavailable_insufficient_population' as const,
  };
}
