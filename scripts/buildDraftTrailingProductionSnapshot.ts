import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { TRAILING_PRODUCTION_CACHE_PATH, type DraftPosition, type TrailingProductionArtifact } from '../server/mcp/draftContextTrailingVor';
import { TRAILING_PRODUCTION_SOURCE_REFERENCE } from '../server/mcp/draftContextStdioLogic';

const SOURCE = {
  repository: TRAILING_PRODUCTION_SOURCE_REFERENCE.repository,
  commit_sha: TRAILING_PRODUCTION_SOURCE_REFERENCE.commit_sha,
  path: TRAILING_PRODUCTION_SOURCE_REFERENCE.path,
  blob_sha: TRAILING_PRODUCTION_SOURCE_REFERENCE.blob_sha,
} as const;

const SOURCE_URL = `https://raw.githubusercontent.com/${SOURCE.repository}/${SOURCE.commit_sha}/${SOURCE.path}`;
const POSITIONS = new Set<DraftPosition>(['QB', 'RB', 'WR', 'TE']);

type SourceRecord = {
  player_id?: unknown;
  player_name?: unknown;
  position?: unknown;
  primary_team?: unknown;
  season?: unknown;
  season_type?: unknown;
  games_played?: unknown;
  production_summary?: {
    season_ppr?: unknown;
    season_ppg?: unknown;
  } | null;
};

type SourceArtifact = {
  artifact_id?: unknown;
  status?: unknown;
  promotion_review?: unknown;
  promoted_at?: unknown;
  counts?: { by_season?: Record<string, unknown> };
  records?: SourceRecord[];
};

function gitBlobSha(bytes: Uint8Array): string {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

function requireNumber(value: unknown, field: string, player: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field} for ${player}`);
  }
  return value;
}

async function main(): Promise<void> {
  console.error(`[draft-trailing-production] fetching pinned promoted source ${SOURCE.repository}@${SOURCE.commit_sha}`);
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'TIBER-Fantasy-draft-context-pilot' },
  });
  if (!response.ok) {
    throw new Error(`Source fetch failed: HTTP ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const observedBlobSha = gitBlobSha(bytes);
  if (observedBlobSha !== SOURCE.blob_sha) {
    throw new Error(`Pinned source blob mismatch: expected ${SOURCE.blob_sha}, got ${observedBlobSha}`);
  }

  const source = JSON.parse(Buffer.from(bytes).toString('utf8')) as SourceArtifact;
  if (
    source.artifact_id !== TRAILING_PRODUCTION_SOURCE_REFERENCE.artifact_id ||
    source.status !== TRAILING_PRODUCTION_SOURCE_REFERENCE.source_status
  ) {
    throw new Error(`Unexpected source authority: artifact_id=${String(source.artifact_id)} status=${String(source.status)}`);
  }
  if (!Array.isArray(source.records)) {
    throw new Error('Promoted source has no records array');
  }

  const rows = source.records
    .filter(
      (record) =>
        record.season === 2025 &&
        record.season_type === 'REG' &&
        typeof record.position === 'string' &&
        POSITIONS.has(record.position as DraftPosition),
    )
    .map((record) => {
      const playerName = typeof record.player_name === 'string' ? record.player_name : '<unknown>';
      if (typeof record.player_id !== 'string' || typeof record.player_name !== 'string' || typeof record.position !== 'string') {
        throw new Error(`Invalid identity fields for ${playerName}`);
      }
      return {
        player_id: record.player_id,
        player_name: record.player_name,
        position: record.position as DraftPosition,
        primary_team: typeof record.primary_team === 'string' ? record.primary_team : null,
        games_played: requireNumber(record.games_played, 'games_played', playerName),
        season_ppr: requireNumber(record.production_summary?.season_ppr, 'production_summary.season_ppr', playerName),
        season_ppg: requireNumber(record.production_summary?.season_ppg, 'production_summary.season_ppg', playerName),
      };
    })
    .sort((a, b) => a.player_id.localeCompare(b.player_id));

  const declared2025Count = source.counts?.by_season?.['2025'];
  if (typeof declared2025Count === 'number' && rows.length !== declared2025Count) {
    throw new Error(`2025 row-count mismatch: declared ${declared2025Count}, extracted ${rows.length}`);
  }
  if (rows.length < 100) {
    throw new Error(`Refusing suspiciously small 2025 population: ${rows.length}`);
  }

  const artifact: TrailingProductionArtifact = {
    schema_version: 'draft_trailing_production_v0',
    authority: 'promoted_governed_historical_evidence',
    season: 2025,
    scoring: 'ppr',
    source: {
      ...SOURCE,
      artifact_id: TRAILING_PRODUCTION_SOURCE_REFERENCE.artifact_id,
      source_status: TRAILING_PRODUCTION_SOURCE_REFERENCE.source_status,
      promotion_review: typeof source.promotion_review === 'string' ? source.promotion_review : null,
      promoted_at: typeof source.promoted_at === 'string' ? source.promoted_at : null,
    },
    player_count: rows.length,
    players: rows,
  };

  const outputPath = resolve(process.cwd(), TRAILING_PRODUCTION_CACHE_PATH);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.error(`[draft-trailing-production] wrote ${rows.length} 2025 REG players to ${TRAILING_PRODUCTION_CACHE_PATH}`);
  console.error(`[draft-trailing-production] verified source blob ${observedBlobSha}`);
}

main().catch((error) => {
  console.error('[draft-trailing-production] failed:', error);
  process.exit(1);
});
