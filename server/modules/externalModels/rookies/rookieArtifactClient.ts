import { promises as fs } from 'fs';
import path from 'path';
import { RookieIntegrationError } from './types';

const DEFAULT_PROMOTED_ARTIFACT_PATH = path.join(process.cwd(), 'data', 'rookies', '2026_rookie_grades_v2.json');

export class RookieArtifactClient {
  private readonly artifactPath: string;
  private readonly enabled: boolean;

  constructor(config: { artifactPath?: string; enabled?: boolean } = {}) {
    this.artifactPath = config.artifactPath ?? process.env.ROOKIE_PROMOTED_ARTIFACT_PATH ?? DEFAULT_PROMOTED_ARTIFACT_PATH;
    this.enabled = config.enabled ?? process.env.ROOKIE_PROMOTED_MODEL_ENABLED !== '0';
  }

  getConfig() {
    return {
      enabled: this.enabled,
      artifactPath: this.artifactPath,
      configured: Boolean(this.artifactPath),
    };
  }

  async loadPromotedRookieArtifact(): Promise<{ payload: unknown; sourcePath: string }> {
    if (!this.enabled) {
      throw new RookieIntegrationError('config_error', 'Rookie promoted model integration is disabled by configuration.', 503);
    }

    try {
      const raw = await fs.readFile(this.artifactPath, 'utf8');
      return {
        payload: JSON.parse(raw) as unknown,
        sourcePath: this.artifactPath,
      };
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === 'ENOENT') {
        throw new RookieIntegrationError(
          'not_found',
          'Promoted rookie artifact is missing. Copy the validated TIBER-Rookies export to the configured artifact path.',
          404,
          error,
        );
      }
      if (error instanceof SyntaxError) {
        throw new RookieIntegrationError('invalid_payload', 'Promoted rookie artifact is not valid JSON.', 502, error);
      }
      throw new RookieIntegrationError('upstream_unavailable', 'Unable to read the promoted rookie artifact.', 503, error);
    }
  }
}
