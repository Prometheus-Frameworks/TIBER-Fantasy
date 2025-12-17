import { randomUUID } from 'crypto';

type LoggerOptions = {
  requestId?: string;
  enabled?: boolean;
  scope?: string;
};

export type PlaybookForgeLogger = {
  enabled: boolean;
  requestId: string;
  scope: string;
  log: (message: string, meta?: Record<string, any>) => void;
};

export function createPlaybookForgeLogger(options: LoggerOptions = {}): PlaybookForgeLogger {
  const enabled = options.enabled ?? process.env.DEBUG_PLAYBOOK_FORGE === '1';
  const requestId = options.requestId || randomUUID();
  const scope = options.scope ?? 'PlaybookForge';
  const prefix = `[${scope} ${requestId}]`;

  function log(message: string, meta?: Record<string, any>) {
    if (!enabled) return;
    if (meta && Object.keys(meta).length > 0) {
      console.log(`${prefix} ${message}`, meta);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  return { enabled, requestId, scope, log };
}
