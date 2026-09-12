import { z } from 'zod';
import { pgTable, uuid, text, integer, timestamp, jsonb, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Deliberately separate from shared/schema.ts and the legacy Drizzle input.
// A future auth-only migration must name only these four tables.
export const tiberUsers = pgTable('tiber_users', {
  id: uuid('id').primaryKey(),
  issuer: text('issuer').notNull(),
  subject: text('subject').notNull(),
  status: text('status').notNull().default('active'),
  sessionVersion: integer('session_version').notNull().default(0),
  sleeperLinkVersion: integer('sleeper_link_version').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }).notNull(),
}, table => ({
  identity: uniqueIndex('tiber_users_identity').on(table.issuer, table.subject),
  statusCheck: check('tiber_users_status_check', sql`${table.status} in ('active', 'disabled')`),
  versions: check('tiber_users_versions_check', sql`${table.sessionVersion} >= 0 and ${table.sleeperLinkVersion} >= 0`),
}));

export const tiberAuthSessions = pgTable('tiber_auth_sessions', {
  sid: text('sid').primaryKey(),
  sess: jsonb('sess').notNull(),
  expire: timestamp('expire', { precision: 6 }).notNull(),
}, table => ({ expiry: index('tiber_auth_sessions_expiry').on(table.expire) }));

export const tiberAuthChallenges = pgTable('tiber_auth_challenges', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),
  bindingHash: text('binding_hash').notNull(),
  userId: uuid('user_id').references(() => tiberUsers.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
}, table => ({
  expiry: index('tiber_auth_challenges_expiry').on(table.expiresAt),
  binding: index('tiber_auth_challenges_binding').on(table.bindingHash),
  kindCheck: check('tiber_auth_challenges_kind_check', sql`${table.kind} in ('google_login', 'sleeper_link')`),
  ownerCheck: check('tiber_auth_challenges_owner_check', sql`(${table.kind} = 'google_login' and ${table.userId} is null) or (${table.kind} = 'sleeper_link' and ${table.userId} is not null)`),
}));

export const tiberSleeperLinks = pgTable('tiber_sleeper_links', {
  userId: uuid('user_id').primaryKey().references(() => tiberUsers.id, { onDelete: 'cascade' }),
  sleeperUserId: text('sleeper_user_id').notNull(),
  username: text('username'),
  displayName: text('display_name'),
  sourceUrl: text('source_url').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  linkedAt: timestamp('linked_at', { withTimezone: true }).notNull(),
  linkMethod: text('link_method').notNull().default('operator_assertion'),
}, table => ({ method: check('tiber_sleeper_links_method', sql`${table.linkMethod} = 'operator_assertion'`) }));

export const challengeIdSchema = z.string().uuid();
export const linkVersionSchema = z.number().int().min(0).max(2_147_483_646);
export const googleLoginSchema = z.object({
  challengeId: challengeIdSchema,
  credential: z.string().min(1).max(12_000),
}).strict();
export const sleeperResolveSchema = z.object({ usernameOrUserId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }).strict();
export const sleeperConfirmSchema = z.object({
  challengeId: challengeIdSchema, expectedLinkVersion: linkVersionSchema, confirm: z.literal(true),
}).strict();
export const sleeperUnlinkSchema = z.object({ expectedLinkVersion: linkVersionSchema }).strict();
export const emptyAuthBodySchema = z.object({}).strict();

export interface AuthPrincipal {
  userId: string;
  sessionVersion: number;
  authenticatedAt: number;
  lastSeenAt: number;
}
export interface SleeperLinkObservation {
  sleeperUserId: string;
  username: string | null;
  displayName: string | null;
  sourceUrl: string;
  receivedAt: string;
}
export interface SleeperLink extends SleeperLinkObservation {
  linkedAt: string;
  linkMethod: 'operator_assertion';
}
export interface AuthUser {
  id: string;
  status: 'active' | 'disabled';
  sessionVersion: number;
  sleeperLinkVersion: number;
}
export const AUTH_POLICY = Object.freeze({
  challengeMs: 5 * 60_000,
  idleMs: 24 * 60 * 60_000,
  absoluteMs: 7 * 24 * 60 * 60_000,
  clockSkewMs: 30_000,
  sourceTimeoutMs: 10_000,
});

export class TeamAuthError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
  }
}
