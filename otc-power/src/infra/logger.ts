// /src/infra/logger.ts
type Lvl = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Lvl, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const CURRENT = (process.env.LOG_LEVEL as Lvl) || 'info';

function log(lvl: Lvl, msg: string, meta?: Record<string, any>) {
  if (LEVEL_ORDER[lvl] < LEVEL_ORDER[CURRENT]) return;
  const line = {
    t: new Date().toISOString(),
    lvl,
    msg,
    ...meta,
  };
  // eslint-disable-next-line no-console
  console[lvl === 'error' ? 'error' : lvl === 'warn' ? 'warn' : 'log'](JSON.stringify(line));
}

export const logger = {
  debug: (m: string, meta?: any) => log('debug', m, meta),
  info:  (m: string, meta?: any) => log('info', m, meta),
  warn:  (m: string, meta?: any) => log('warn', m, meta),
  error: (m: string, meta?: any) => log('error', m, meta),
};