import { promises as fs } from 'fs';
import path from 'path';
import { TiberIdentityCrosswalkIntegrationError } from './tiberIdentityCrosswalkTypes';

const BUNDLED_ARTIFACT_FILENAME = 'tiber_identity_crosswalk_v2.json';

const DEFAULT_BUNDLED_ARTIFACT_PATH = path.join(
  process.cwd(),
  'server',
  'artifacts',
  'external',
  'identity',
  BUNDLED_ARTIFACT_FILENAME,
);

export class TiberIdentityCrosswalkClient {
  private readonly artifactPath: string;
  private readonly enabled: boolean;

  constructor(config: { artifactPath?: string; enabled?: boolean } = {}) {
    this.artifactPath =
      config.artifactPath ??
      process.env.TIBER_IDENTITY_CROSSWALK_V1_ARTIFACT_PATH ??
      process.env.TIBER_IDENTITY_CROSSWALK_PROMOTED_PATH ??
      DEFAULT_BUNDLED_ARTIFACT_PATH;
    this.enabled = config.enabled ?? process.env.TIBER_IDENTITY_CROSSWALK_V1_ENABLED !== '0';
  }

  private resolveSourcePath() {
    return path.extname(this.artifactPath).toLowerCase() === '.json'
      ? this.artifactPath
      : path.join(this.artifactPath, BUNDLED_ARTIFACT_FILENAME);
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
      throw new TiberIdentityCrosswalkIntegrationError(
        'config_error',
        'TIBER_IDENTITY_CROSSWALK_V1 integration is disabled by configuration.',
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
        throw new TiberIdentityCrosswalkIntegrationError(
          'not_found',
          'TIBER_IDENTITY_CROSSWALK_V1 artifact is missing. Copy the validated TIBER-Data promoted export to the configured artifact path.',
          404,
          'missing',
          error,
        );
      }
      if (error instanceof SyntaxError) {
        throw new TiberIdentityCrosswalkIntegrationError(
          'invalid_payload',
          'TIBER_IDENTITY_CROSSWALK_V1 artifact is not valid JSON.',
          502,
          'malformed',
          error,
        );
      }
      throw new TiberIdentityCrosswalkIntegrationError(
        'upstream_unavailable',
        'Unable to read the TIBER_IDENTITY_CROSSWALK_V1 artifact.',
        503,
        'malformed',
        error,
      );
    }
  }
}
