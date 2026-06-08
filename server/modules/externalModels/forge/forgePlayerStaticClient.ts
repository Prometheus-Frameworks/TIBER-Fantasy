import { promises as fs } from 'fs';
import path from 'path';
import { ForgePlayerStaticIntegrationError } from './forgePlayerStaticTypes';

const DEFAULT_PROMOTED_ARTIFACT_PATH = path.join(
  process.cwd(),
  '..',
  'TIBER-FORGE',
  'exports',
  'promoted',
  'forge_player_static',
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
      DEFAULT_PROMOTED_ARTIFACT_PATH;
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

  async loadPromotedArtifact(): Promise<{ payload: unknown; sourcePath: string }> {
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
      return { payload: JSON.parse(raw) as unknown, sourcePath };
    } catch (error) {
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
