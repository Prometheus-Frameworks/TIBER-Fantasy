// Structured logging for OLC module with detailed intermediate tracking

export interface OlcLogContext {
  teamId?: string;
  season?: number;
  week?: number;
  component?: string;
  operation?: string;
}

export interface OlcLogData {
  [key: string]: any;
}

class OlcLogger {
  private static instance: OlcLogger;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private logBuffer: Array<{ timestamp: Date; level: string; message: string; context?: OlcLogContext; data?: OlcLogData }> = [];
  private maxBufferSize = 1000;

  static getInstance(): OlcLogger {
    if (!OlcLogger.instance) {
      OlcLogger.instance = new OlcLogger();
    }
    return OlcLogger.instance;
  }

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }

  debug(message: string, context?: OlcLogContext, data?: OlcLogData): void {
    this.log('debug', message, context, data);
  }

  info(message: string, context?: OlcLogContext, data?: OlcLogData): void {
    this.log('info', message, context, data);
  }

  warn(message: string, context?: OlcLogContext, data?: OlcLogData): void {
    this.log('warn', message, context, data);
  }

  error(message: string, context?: OlcLogContext, data?: OlcLogData): void {
    this.log('error', message, context, data);
  }

  private log(level: string, message: string, context?: OlcLogContext, data?: OlcLogData): void {
    const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentPriority = levelPriority[this.logLevel];
    const messagePriority = levelPriority[level as keyof typeof levelPriority];

    if (messagePriority < currentPriority) {
      return;
    }

    const logEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      data,
    };

    // Add to buffer
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Format for console output
    const contextStr = context ? ` [${Object.entries(context).map(([k, v]) => `${k}=${v}`).join(', ')}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    const fullMessage = `[OLC:${level.toUpperCase()}] ${message}${contextStr}${dataStr}`;

    // Output to console
    switch (level) {
      case 'debug':
        console.debug(fullMessage);
        break;
      case 'info':
        console.info(fullMessage);
        break;
      case 'warn':
        console.warn(fullMessage);
        break;
      case 'error':
        console.error(fullMessage);
        break;
    }
  }

  // Log specific OLC calculation stages
  logCalculationStart(teamId: string, season: number, week: number): void {
    this.info('OLC calculation started', { teamId, season, week, operation: 'calculate' });
  }

  logCalculationEnd(teamId: string, season: number, week: number, olcScore: number, duration: number): void {
    this.info('OLC calculation completed', 
      { teamId, season, week, operation: 'calculate' },
      { olc_score: olcScore, duration_ms: duration }
    );
  }

  logIntermediateResults(
    teamId: string,
    season: number,
    week: number,
    stage: string,
    results: Record<string, any>
  ): void {
    this.debug(`Intermediate results: ${stage}`, 
      { teamId, season, week, component: stage },
      results
    );
  }

  logCacheOperation(operation: 'hit' | 'miss' | 'set', key: string, size?: number): void {
    this.debug(`Cache ${operation}`, 
      { operation: 'cache' },
      { key, cache_size: size }
    );
  }

  logScalingParameters(season: number, week: number, scaleK: number, sigma: number): void {
    this.debug('Scaling parameters applied',
      { season, week, component: 'scaling' },
      { scale_k: scaleK, sigma }
    );
  }

  logPenaltyApplication(
    teamId: string,
    penalties: Array<{ type: string; value: number; reason: string }>
  ): void {
    this.debug('Penalties applied',
      { teamId, component: 'penalties' },
      { penalties }
    );
  }

  logAdjusterCalculation(
    teamId: string,
    position: string,
    adjuster: number,
    baseline: number,
    adjusted: number
  ): void {
    this.debug('Position adjuster applied',
      { teamId, component: 'adjusters' },
      { position, adjuster_pct: adjuster * 100, baseline, adjusted }
    );
  }

  logOpponentContext(
    teamId: string,
    opponentId: string,
    passContext: number,
    runContext: number
  ): void {
    this.debug('Opponent context calculated',
      { teamId, component: 'opponent' },
      { opponent_id: opponentId, pass_context_pct: passContext * 100, run_context_pct: runContext * 100 }
    );
  }

  // Get recent logs for debugging
  getRecentLogs(count = 50): typeof this.logBuffer {
    return this.logBuffer.slice(-count);
  }

  // Get logs for specific team/week
  getLogsForContext(context: Partial<OlcLogContext>, count = 100): typeof this.logBuffer {
    return this.logBuffer
      .filter(entry => {
        if (!entry.context) return false;
        return Object.entries(context).every(([key, value]) => 
          entry.context![key as keyof OlcLogContext] === value
        );
      })
      .slice(-count);
  }

  // Clear log buffer
  clearLogs(): void {
    this.logBuffer = [];
    this.info('Log buffer cleared');
  }

  // Export logs for analysis
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }
}

// Export singleton instance
export const logger = OlcLogger.getInstance();