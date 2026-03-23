import { adaptSignalValidationExports } from './signalValidationAdapter';
import { SignalValidationClient } from './signalValidationClient';
import { SignalValidationIntegrationError, TiberWrBreakoutLab } from './types';

export class SignalValidationService {
  private readonly startupConfigLogged: boolean;

  constructor(private readonly client: SignalValidationClient = new SignalValidationClient()) {
    const config = this.client.getConfig();
    console.info(
      `[SignalValidationIntegration] ${config.enabled && config.configured ? 'enabled' : 'disabled'} ` +
        `(configured=${config.configured}, exportsDir=${config.exportsDir})`,
    );
    this.startupConfigLogged = true;
  }

  getStatus() {
    const config = this.client.getConfig();
    return {
      ...config,
      readiness: config.enabled && config.configured ? 'ready' : 'not_ready',
      startupConfigLogged: this.startupConfigLogged,
    };
  }

  async getWrBreakoutLab(
    season?: number,
    options: { includeRawCanonical?: boolean } = {},
  ): Promise<TiberWrBreakoutLab> {
    try {
      const exports = await this.client.readWrBreakoutExports(season);
      return adaptSignalValidationExports(exports, {
        includeRawCanonical: options.includeRawCanonical,
        exportDirectory: this.client.getConfig().exportsDir,
      });
    } catch (error) {
      if (error instanceof SignalValidationIntegrationError) {
        throw error;
      }

      throw new SignalValidationIntegrationError(
        'upstream_unavailable',
        'Signal Validation integration failed unexpectedly.',
        503,
        error,
      );
    }
  }
}

export const signalValidationService = new SignalValidationService();
