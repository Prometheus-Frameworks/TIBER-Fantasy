import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { ForgePlayerStaticIntegrationError } from './forgePlayerStaticTypes';

/**
 * Mirrors TIBER-FORGE's content_digest canonicalization
 * (json_sorted_keys_no_whitespace_v1): recursive sorted-key, no-whitespace
 * JSON over the artifact's rows array, hashed with sha256. The producer
 * stamps the digest at build time; this consumer recomputes it and fails
 * closed on mismatch instead of trusting descriptive provenance
 * (TIBER-FORGE#45 Finding 2).
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  throw new Error(`Cannot canonicalize non-JSON value of type ${typeof value} for FORGE_PLAYER_STATIC_V1 digest.`);
}

export function computeForgePlayerStaticRowsDigest(rows: unknown[]): string {
  return crypto.createHash('sha256').update(canonicalJson(rows), 'utf8').digest('hex');
}

export type ForgePlayerStaticIntegrity = 'digest_verified' | 'digest_missing';

function verifyContentDigest(payload: unknown, sourcePath: string): ForgePlayerStaticIntegrity {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    // Shape problems are the adapter's concern; integrity is simply absent.
    return 'digest_missing';
  }
  const artifact = payload as Record<string, unknown>;
  const digest = artifact.content_digest as Record<string, unknown> | undefined;
  if (digest === undefined) {
    console.warn(
      `[ForgePlayerStaticV1] artifact at ${sourcePath} carries no content_digest; ` +
        'substitution cannot be detected. Rebuild the promoted export with a current TIBER-FORGE builder.',
    );
    return 'digest_missing';
  }
  const supportedDeclaration =
    typeof digest === 'object' &&
    digest !== null &&
    digest.algorithm === 'sha256' &&
    digest.scope === 'rows' &&
    digest.canonicalization === 'json_sorted_keys_no_whitespace_v1' &&
    typeof digest.value === 'string' &&
    /^[0-9a-f]{64}$/.test(digest.value);
  if (!supportedDeclaration) {
    throw new ForgePlayerStaticIntegrationError(
      'invalid_payload',
      'FORGE_PLAYER_STATIC_V1 content_digest declaration is malformed or uses an unsupported algorithm/scope/canonicalization.',
      502,
      'malformed',
    );
  }
  if (!Array.isArray(artifact.rows) || computeForgePlayerStaticRowsDigest(artifact.rows) !== digest.value) {
    throw new ForgePlayerStaticIntegrationError(
      'invalid_payload',
      'FORGE_PLAYER_STATIC_V1 content_digest does not match the recomputed digest of rows: the artifact was altered or substituted and is treated as unavailable FORGE evidence.',
      502,
      'malformed',
    );
  }
  return 'digest_verified';
}

const DEFAULT_BUNDLED_ARTIFACT_PATH = path.join(
  process.cwd(),
  'server',
  'artifacts',
  'external',
  'forge',
  'forge_player_static_v1.json',
);

export class ForgePlayerStaticClient {
  private readonly artifactPath: string;
  private readonly enabled: boolean;

  constructor(config: { artifactPath?: string; enabled?: boolean } = {}) {
    this.artifactPath =
      config.artifactPath ??
      process.env.FORGE_PLAYER_STATIC_V1_ARTIFACT_PATH ??
      process.env.FORGE_PLAYER_STATIC_PROMOTED_PATH ??
      DEFAULT_BUNDLED_ARTIFACT_PATH;
    this.enabled = config.enabled ?? process.env.FORGE_PLAYER_STATIC_V1_ENABLED !== '0';
  }

  private resolveSourcePath() {
    return path.extname(this.artifactPath).toLowerCase() === '.json'
      ? this.artifactPath
      : path.join(this.artifactPath, 'forge_player_static_v1.json');
  }

  getConfig() {
    return {
      enabled: this.enabled,
      artifactPath: this.artifactPath,
      sourcePath: this.resolveSourcePath(),
      configured: Boolean(this.artifactPath),
    };
  }

  async loadPromotedArtifact(): Promise<{
    payload: unknown;
    sourcePath: string;
    integrity: ForgePlayerStaticIntegrity;
  }> {
    if (!this.enabled) {
      throw new ForgePlayerStaticIntegrationError(
        'config_error',
        'FORGE_PLAYER_STATIC_V1 integration is disabled by configuration.',
        503,
        'disabled',
      );
    }

    const sourcePath = this.resolveSourcePath();

    try {
      const raw = await fs.readFile(sourcePath, 'utf8');
      const payload = JSON.parse(raw) as unknown;
      const integrity = verifyContentDigest(payload, sourcePath);
      return { payload, sourcePath, integrity };
    } catch (error) {
      if (error instanceof ForgePlayerStaticIntegrationError) {
        throw error;
      }
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === 'ENOENT') {
        throw new ForgePlayerStaticIntegrationError(
          'not_found',
          'FORGE_PLAYER_STATIC_V1 artifact is missing. Copy the validated TIBER-FORGE promoted export to the configured artifact path.',
          404,
          'missing',
          error,
        );
      }
      if (error instanceof SyntaxError) {
        throw new ForgePlayerStaticIntegrationError(
          'invalid_payload',
          'FORGE_PLAYER_STATIC_V1 artifact is not valid JSON.',
          502,
          'malformed',
          error,
        );
      }
      throw new ForgePlayerStaticIntegrationError(
        'upstream_unavailable',
        'Unable to read the FORGE_PLAYER_STATIC_V1 artifact.',
        503,
        'malformed',
        error,
      );
    }
  }
}
