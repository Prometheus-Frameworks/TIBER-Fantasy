import { promises as fs } from 'fs';
import path from 'path';
import {
  assessForgePlayerStaticContentDigest,
  type ForgePlayerStaticIntegrity,
} from './forgePlayerStaticArtifactContract';
import { ForgePlayerStaticIntegrationError } from './forgePlayerStaticTypes';

export { computeForgePlayerStaticRowsDigest } from './forgePlayerStaticArtifactContract';
export type { ForgePlayerStaticIntegrity } from './forgePlayerStaticArtifactContract';

function verifyContentDigest(payload: unknown, sourcePath: string): ForgePlayerStaticIntegrity {
  const assessment = assessForgePlayerStaticContentDigest(payload);
  if (assessment.accepted) {
    if (assessment.integrity === 'digest_missing' && assessment.warnMissingDigest) {
      console.warn(
        `[ForgePlayerStaticV1] artifact at ${sourcePath} carries no content_digest; ` +
          'substitution cannot be detected. Rebuild the promoted export with a current TIBER-FORGE builder.',
      );
    }
    return assessment.integrity;
  }
  if (assessment.reason === 'unsupported_declaration') {
    throw new ForgePlayerStaticIntegrationError(
      'invalid_payload',
      'FORGE_PLAYER_STATIC_V1 content_digest declaration is malformed or uses an unsupported algorithm/scope/canonicalization.',
      502,
      'malformed',
    );
  }
  throw new ForgePlayerStaticIntegrationError(
    'invalid_payload',
    'FORGE_PLAYER_STATIC_V1 content_digest does not match the recomputed digest of rows: the artifact was altered or substituted and is treated as unavailable FORGE evidence.',
    502,
    'malformed',
  );
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
