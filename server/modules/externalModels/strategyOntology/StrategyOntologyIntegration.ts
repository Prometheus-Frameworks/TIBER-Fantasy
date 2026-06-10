import { adaptStrategyOntologyArtifact } from './strategyOntologyAdapter';
import { StrategyOntologyClient } from './strategyOntologyClient';
import {
  StrategyOntologyIntegrationError,
  StrategyOntologyLookup,
} from './types';

function unavailableLookup(error: StrategyOntologyIntegrationError, sourcePath: string): StrategyOntologyLookup {
  return {
    artifact: {
      state: error.state,
      available: false,
      reason: error.message,
      code: error.code,
      sourcePath,
      artifactId: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
      artifactType: null,
      contractVersion: null,
      modelVersion: null,
      generatedAt: null,
      rowCount: null,
      concepts: 0,
      playerAssetArchetypes: 0,
      rosterStateDefinitions: 0,
      timelineRules: 0,
      explanationTemplates: 0,
      futureContractInputs: [],
      safetyRules: [],
      archetypeAssignmentEnabled: false,
      templateSelectionEnabled: false,
    },
    raw: null,
  };
}

export class StrategyOntologyIntegration {
  constructor(private readonly client: Pick<StrategyOntologyClient, 'loadPromotedArtifact' | 'getConfig'> = new StrategyOntologyClient()) {
    const config = this.client.getConfig();
    console.info(
      `[StrategyOntologyV1] ${config.enabled && config.configured ? 'enabled' : 'disabled'} ` +
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

  async getLookup(): Promise<StrategyOntologyLookup> {
    const config = this.client.getConfig();
    try {
      const { payload, sourcePath } = await this.client.loadPromotedArtifact();
      return adaptStrategyOntologyArtifact(payload, sourcePath);
    } catch (error) {
      if (error instanceof StrategyOntologyIntegrationError) {
        return unavailableLookup(error, config.sourcePath ?? config.artifactPath);
      }
      return unavailableLookup(
        new StrategyOntologyIntegrationError(
          'invalid_payload',
          'DYNASTY_STRATEGY_ONTOLOGY_V1 artifact could not be adapted for Management diagnostics.',
          502,
          'malformed',
          error,
        ),
        config.sourcePath ?? config.artifactPath,
      );
    }
  }
}

export const strategyOntologyIntegration = new StrategyOntologyIntegration();
