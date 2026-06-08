import { adaptTiberIdentityCrosswalkArtifact } from './tiberIdentityCrosswalkAdapter';
import { TiberIdentityCrosswalkClient } from './tiberIdentityCrosswalkClient';
import {
  TiberIdentityCrosswalkIntegrationError,
  TiberIdentityCrosswalkLookup,
} from './tiberIdentityCrosswalkTypes';

function unavailableLookup(error: TiberIdentityCrosswalkIntegrationError, sourcePath: string): TiberIdentityCrosswalkLookup {
  return {
    artifact: {
      state: error.state,
      available: false,
      reason: error.message,
      code: error.code,
      sourcePath,
      artifactId: 'TIBER_IDENTITY_CROSSWALK_V1',
      contractVersion: null,
      generatedAt: null,
      rowCount: 0,
      providerMappingCount: 0,
      providerCount: 0,
    },
    rows: [],
    tiberPlayerIdsByProviderKey: new Map(),
  };
}

export class TiberIdentityCrosswalkService {
  constructor(private readonly client: Pick<TiberIdentityCrosswalkClient, 'loadPromotedArtifact' | 'getConfig'> = new TiberIdentityCrosswalkClient()) {
    const config = this.client.getConfig();
    console.info(
      `[TiberIdentityCrosswalkV1] ${config.enabled && config.configured ? 'enabled' : 'disabled'} ` +
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

  async getLookup(): Promise<TiberIdentityCrosswalkLookup> {
    const config = this.client.getConfig();
    try {
      const { payload, sourcePath } = await this.client.loadPromotedArtifact();
      return adaptTiberIdentityCrosswalkArtifact(payload, sourcePath);
    } catch (error) {
      if (error instanceof TiberIdentityCrosswalkIntegrationError) {
        return unavailableLookup(error, config.sourcePath ?? config.artifactPath);
      }
      return unavailableLookup(
        new TiberIdentityCrosswalkIntegrationError(
          'invalid_payload',
          'TIBER_IDENTITY_CROSSWALK_V1 artifact could not be adapted for Management.',
          502,
          'malformed',
          error,
        ),
        config.sourcePath ?? config.artifactPath,
      );
    }
  }
}

export const tiberIdentityCrosswalkService = new TiberIdentityCrosswalkService();
