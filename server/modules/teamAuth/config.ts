import { TeamAuthError } from '@shared/teamAuth';

export interface TeamAuthConfig {
  origin: string;
  googleClientId: string;
  databaseUrl: string;
  sessionSecret: string;
  databaseCa?: string;
  secure: boolean;
  cookieName: '__Host-tiber_session' | 'tiber_local_session';
}

export function readTeamAuthConfig(env: NodeJS.ProcessEnv = process.env): TeamAuthConfig {
  const unavailable = () => new TeamAuthError(503, 'AUTH_NOT_CONFIGURED');
  try {
    const origin = new URL(env.TEAM_AUTH_ORIGIN ?? '');
    const database = new URL(env.TEAM_AUTH_DATABASE_URL ?? '');
    const local = env.NODE_ENV === 'development' && origin.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(origin.hostname);
    if (origin.origin !== env.TEAM_AUTH_ORIGIN || origin.username || origin.password ||
        (!local && origin.protocol !== 'https:')) throw unavailable();
    if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname ||
        !database.username || !database.password || database.search || database.hash ||
        !/^\/[A-Za-z0-9_-]+$/.test(database.pathname)) throw unavailable();
    if (local && !['localhost', '127.0.0.1'].includes(database.hostname)) throw unavailable();
    const secret = env.TEAM_AUTH_SESSION_SECRET ?? '';
    const clientId = env.TEAM_AUTH_GOOGLE_CLIENT_ID ?? '';
    if (secret.length < 43 || secret.length > 512 || !/^[\w-]+$/.test(secret) ||
        !/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw unavailable();
    const databaseCa = env.TEAM_AUTH_DATABASE_CA;
    if (databaseCa && (databaseCa.length > 65536 || !databaseCa.includes('-----BEGIN CERTIFICATE-----'))) throw unavailable();
    return {
      origin: origin.origin, googleClientId: clientId, databaseUrl: database.href,
      sessionSecret: secret, databaseCa, secure: !local,
      cookieName: local ? 'tiber_local_session' : '__Host-tiber_session',
    };
  } catch { throw unavailable(); }
}
