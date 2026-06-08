import { adaptForgePlayerStaticArtifact } from './forgePlayerStaticAdapter';
import { ForgePlayerStaticClient } from './forgePlayerStaticClient';
import {
  ForgePlayerStaticIntegrationError,
  ForgePlayerStaticLookup,
} from './forgePlayerStaticTypes';

function unavailableLookup(error: ForgePlayerStaticIntegrationError, sourcePath: string): ForgePlayerStaticLookup {
  return {
    artifact: {
      state: error.state,
      available: false,
      reason: error.message,
      code: error.code,
      sourcePath,
      artifactId: 'FORGE_PLAYER_STATIC_V1',
      contractVersion: null,
      generatedAt: null,
      rowCount: 0,
      playerSpecificCount: 0,
      generatedBaselineCount: 0,
      nonEvidenceCount: 0,
    },
    rowsByPlayerId: new Map(),
  };
}

export class ForgePlayerStaticService {
  constructor(private readonly client: Pick<ForgePlayerStaticClient, 'loadPromotedArtifact' | 'getConfig'> = new ForgePlayerStaticClient()) {
    const config = this.client.getConfig();
    console.info(
      `[ForgePlayerStaticV1] ${config.enabled && config.configured ? 'enabled' : 'disabled'} ` +
        `(artifactPath=${config.artifactPath})`,
    );
  }

  getStatus() {
    const config = this.client.getConfig();
    return {
      ...config,
      readiness: config.enabled && config.configured ? 'ready' : 'not_ready',
    };
  }

  async getLookup(): Promise<ForgePlayerStaticLookup> {
    const config = this.client.getConfig();
    try {
      const { payload, sourcePath } = await this.client.loadPromotedArtifact();
      return adaptForgePlayerStaticArtifact(payload, sourcePath);
    } catch (error) {
      if (error instanceof ForgePlayerStaticIntegrationError) {
        return unavailableLookup(error, config.artifactPath);
      }
      return unavailableLookup(
        new ForgePlayerStaticIntegrationError(
          'invalid_payload',
          'FORGE_PLAYER_STATIC_V1 artifact could not be adapted for Management.',
          502,
          'malformed',
          error,
        ),
        config.artifactPath,
      );
    }
  }
}

export const forgePlayerStaticService = new ForgePlayerStaticService();
