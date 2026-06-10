import { promises as fs } from 'fs';
import path from 'path';
import { StrategyOntologyIntegrationError } from './types';

const DEFAULT_BUNDLED_ARTIFACT_PATH = path.join(
  process.cwd(),
  'server',
  'artifacts',
  'external',
  'strategy',
  'dynasty_strategy_ontology_v1.json',
);

export class StrategyOntologyClient {
  private readonly artifactPath: string;
  private readonly enabled: boolean;

  constructor(config: { artifactPath?: string; enabled?: boolean } = {}) {
    this.artifactPath =
      config.artifactPath ??
      process.env.TIBER_STRATEGY_ONTOLOGY_V1_ARTIFACT_PATH ??
      DEFAULT_BUNDLED_ARTIFACT_PATH;
    this.enabled = config.enabled ?? process.env.TIBER_STRATEGY_ONTOLOGY_V1_ENABLED !== '0';
  }

  private resolveSourcePath() {
    return path.extname(this.artifactPath).toLowerCase() === '.json'
      ? this.artifactPath
      : path.join(this.artifactPath, 'dynasty_strategy_ontology_v1.json');
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
      throw new StrategyOntologyIntegrationError(
        'config_error',
        'DYNASTY_STRATEGY_ONTOLOGY_V1 integration is disabled by configuration.',
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
        throw new StrategyOntologyIntegrationError(
          'not_found',
          'DYNASTY_STRATEGY_ONTOLOGY_V1 artifact is missing. Copy the validated TIBER-Strategy promoted export to the configured artifact path.',
          404,
          'missing',
          error,
        );
      }
      if (error instanceof SyntaxError) {
        throw new StrategyOntologyIntegrationError(
          'invalid_payload',
          'DYNASTY_STRATEGY_ONTOLOGY_V1 artifact is not valid JSON.',
          502,
          'malformed',
          error,
        );
      }
      throw new StrategyOntologyIntegrationError(
        'upstream_unavailable',
        'Unable to read the DYNASTY_STRATEGY_ONTOLOGY_V1 artifact.',
        503,
        'malformed',
        error,
      );
    }
  }
}
