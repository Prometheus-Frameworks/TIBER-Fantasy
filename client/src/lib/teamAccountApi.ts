import { z } from 'zod';

export class TeamAccountRequestError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

export async function teamAccountRequest(path: string, options: { body?: unknown; method?: string; csrf?: string; signal?: AbortSignal } = {}) {
  const response = await fetch(path, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    credentials: 'same-origin', cache: 'no-store', signal: options.signal,
    headers: { Accept: 'application/json', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.csrf ? { 'X-CSRF-Token': options.csrf } : {}) },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new TeamAccountRequestError(response.status, typeof body?.error === 'string' ? body.error : 'AUTH_UNAVAILABLE');
  return body;
}

export const signedInSchema = z.object({ status: z.literal('authenticated'), user: z.object({ id: z.string().uuid() }) });
export const csrfSchema = z.object({ status: z.literal('authenticated'), csrfToken: z.string().regex(/^[a-f0-9]{64}$/) });
export const signInChallengeSchema = z.object({
  status: z.literal('signed_out'), csrfToken: z.string().regex(/^[a-f0-9]{64}$/),
  googleClientId: z.string().regex(/^[\w-]+\.apps\.googleusercontent\.com$/),
  challengeId: z.string().uuid(), nonce: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.string().datetime(),
});
const observationSchema = z.object({
  sleeperUserId: z.string().regex(/^\d{1,32}$/), username: z.string().nullable(), displayName: z.string().nullable(),
  sourceUrl: z.string(), receivedAt: z.string().datetime(),
});
export const accountSchema = signedInSchema.extend({
  sleeperLink: observationSchema.extend({ linkedAt: z.string().datetime(), linkMethod: z.literal('operator_assertion') }).nullable(),
  linkVersion: z.number().int().nonnegative(), sleeperAccountControlVerified: z.literal(false),
});
export const linkPreviewSchema = z.object({
  challengeId: z.string().uuid(), expectedLinkVersion: z.number().int().nonnegative(), expiresAt: z.string().datetime(),
  observation: observationSchema, accountControlVerified: z.literal(false), linkMethod: z.literal('operator_assertion'),
});
export type TeamAccountState = z.infer<typeof accountSchema> & { csrfToken: string; revision: number };
export type SignInChallenge = z.infer<typeof signInChallengeSchema>;

export interface GoogleButtonApi {
  initialize(options: { client_id: string; nonce: string; callback: (response: { credential: string }) => void;
    auto_select: false; ux_mode: 'popup' }): void;
  renderButton(parent: HTMLElement, options: { type: 'standard'; theme: 'outline'; size: 'large'; width: number }): void;
  cancel(): void;
  disableAutoSelect(): void;
}
declare global { interface Window { google?: { accounts: { id: GoogleButtonApi } } } }
let googleScript: Promise<GoogleButtonApi> | undefined;
export function loadGoogleButton(): Promise<GoogleButtonApi> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (googleScript) return googleScript;
  googleScript = new Promise<GoogleButtonApi>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { clearTimeout(timer); script.remove(); googleScript = undefined; reject(new Error('Google sign-in could not load.')); };
    const timer = setTimeout(fail, 10_000);
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => { clearTimeout(timer); if (window.google?.accounts.id) resolve(window.google.accounts.id); else fail(); };
    script.onerror = fail; document.head.appendChild(script);
  });
  return googleScript;
}
