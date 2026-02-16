import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
  insertSentinelEventSchema,
  insertSentinelMuteSchema,
  sentinelEvents,
  sentinelMutes,
} from '@shared/schema';
import { db } from '../../infra/db';
import { rulesById, rulesByModule } from './sentinelRules';
import {
  SentinelCheckResult,
  SentinelEvent,
  SentinelIssue,
  SentinelModule,
  SentinelReport,
  SentinelSeverity,
} from './sentinelTypes';

function makeFingerprint(ruleId: string, module: SentinelModule, details?: Record<string, any>): string {
  const key = String(
    details?.playerId ??
      details?.player_id ??
      details?.fingerprintKey ??
      details?.position ??
      details?.team ??
      'global'
  );

  const seed = `${ruleId}|${module}|${key}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `s_${Math.abs(hash).toString(16)}_${Buffer.from(seed).toString('base64').slice(0, 16)}`;
}

export function evaluate(module: SentinelModule, data: any): SentinelReport {
  const rules = rulesByModule[module] ?? [];
  const timestamp = new Date();
  const events: SentinelEvent[] = [];
  let passed = 0;
  let warnings = 0;
  let blocks = 0;

  for (const rule of rules) {
    const result = rule.check(data);
    if (result.passed) {
      passed += 1;
      continue;
    }

    if (rule.severity === 'warn') warnings += 1;
    if (rule.severity === 'block') blocks += 1;

    events.push({
      ruleId: rule.id,
      module,
      severity: rule.severity,
      passed: false,
      confidence: result.confidence,
      message: result.message,
      details: result.details,
      fingerprint: makeFingerprint(rule.id, module, {
        ...(result.details ?? {}),
        playerId: data?.playerId ?? data?.player_id,
      }),
      endpoint: data?._endpoint,
      timestamp,
    });
  }

  return {
    module,
    timestamp,
    totalChecks: rules.length,
    passed,
    warnings,
    blocks,
    events,
  };
}

export function evaluateRule(ruleId: string, data: any): SentinelCheckResult {
  const rule = rulesById.get(ruleId);
  if (!rule) {
    return {
      passed: false,
      confidence: 1,
      message: `Unknown sentinel rule: ${ruleId}`,
      details: { ruleId },
    };
  }

  return rule.check(data);
}

export async function recordEvents(events: SentinelEvent[]): Promise<void> {
  if (!events.length) return;

  const rows = events.map((event) =>
    insertSentinelEventSchema.parse({
      ruleId: event.ruleId,
      module: event.module,
      severity: event.severity,
      passed: event.passed,
      confidence: event.confidence,
      message: event.message,
      details: event.details,
      fingerprint: event.fingerprint,
      endpoint: event.endpoint,
    })
  );

  await db.insert(sentinelEvents).values(rows);
}

function deriveStatus(lastSeen: Date, isMuted: boolean): SentinelIssue['status'] {
  if (isMuted) return 'muted';
  const cutoffMs = 24 * 60 * 60 * 1000;
  if (Date.now() - lastSeen.getTime() > cutoffMs) return 'resolved';
  return 'open';
}

export async function muteIssue(fingerprint: string, reason?: string): Promise<void> {
  const row = insertSentinelMuteSchema.parse({ fingerprint, reason });
  await db
    .insert(sentinelMutes)
    .values(row)
    .onConflictDoUpdate({
      target: sentinelMutes.fingerprint,
      set: {
        reason: row.reason,
      },
    });
}

export async function getIssues(filters?: {
  module?: SentinelModule;
  severity?: SentinelSeverity;
  status?: 'open' | 'resolved' | 'muted';
  limit?: number;
}): Promise<SentinelIssue[]> {
  const limit = filters?.limit ?? 50;

  const conditions = [eq(sentinelEvents.passed, false)];
  if (filters?.module) conditions.push(eq(sentinelEvents.module, filters.module));
  if (filters?.severity) conditions.push(eq(sentinelEvents.severity, filters.severity));

  const rows = await db
    .select({
      fingerprint: sentinelEvents.fingerprint,
      ruleId: sql<string>`min(${sentinelEvents.ruleId})`,
      module: sql<string>`min(${sentinelEvents.module})`,
      severity: sql<string>`min(${sentinelEvents.severity})`,
      firstSeen: sql<Date>`min(${sentinelEvents.createdAt})`,
      lastSeen: sql<Date>`max(${sentinelEvents.createdAt})`,
      occurrenceCount: sql<number>`count(*)`,
      lastMessage: sql<string>`(array_agg(${sentinelEvents.message} ORDER BY ${sentinelEvents.createdAt} DESC))[1]`,
      mutedAt: sentinelMutes.mutedAt,
    })
    .from(sentinelEvents)
    .leftJoin(sentinelMutes, eq(sentinelEvents.fingerprint, sentinelMutes.fingerprint))
    .where(and(...conditions))
    .groupBy(sentinelEvents.fingerprint, sentinelMutes.mutedAt)
    .orderBy(desc(sql`max(${sentinelEvents.createdAt})`))
    .limit(limit * 3);

  const hydrated = rows.map((row) => {
    const issue: SentinelIssue = {
      fingerprint: row.fingerprint,
      ruleId: row.ruleId,
      module: row.module as SentinelModule,
      severity: row.severity as SentinelSeverity,
      lastMessage: row.lastMessage,
      firstSeen: new Date(row.firstSeen),
      lastSeen: new Date(row.lastSeen),
      occurrenceCount: Number(row.occurrenceCount),
      status: deriveStatus(new Date(row.lastSeen), !!row.mutedAt),
    };
    return issue;
  });

  const requestedStatus = filters?.status;
  return hydrated
    .filter((issue) => {
      if (requestedStatus) return issue.status === requestedStatus;
      return issue.status !== 'muted';
    })
    .slice(0, limit);
}

export async function getEventFeed(filters?: {
  module?: SentinelModule;
  severity?: SentinelSeverity;
  limit?: number;
  offset?: number;
}) {
  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;

  const whereClauses = [];
  if (filters?.module) whereClauses.push(eq(sentinelEvents.module, filters.module));
  if (filters?.severity) whereClauses.push(eq(sentinelEvents.severity, filters.severity));

  const where = whereClauses.length ? and(...whereClauses) : undefined;

  const events = await db
    .select()
    .from(sentinelEvents)
    .where(where)
    .orderBy(desc(sentinelEvents.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sentinelEvents)
    .where(where);

  return {
    events,
    total: Number(countRow?.count ?? 0),
    limit,
    offset,
  };
}

export async function getHealthSummary() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      module: sentinelEvents.module,
      totalChecks: sql<number>`count(*)`,
      passed: sql<number>`sum(case when ${sentinelEvents.passed} = true then 1 else 0 end)`,
      warnings: sql<number>`sum(case when ${sentinelEvents.passed} = false and ${sentinelEvents.severity} = 'warn' then 1 else 0 end)`,
      blocks: sql<number>`sum(case when ${sentinelEvents.passed} = false and ${sentinelEvents.severity} = 'block' then 1 else 0 end)`,
      lastCheckAt: sql<Date>`max(${sentinelEvents.createdAt})`,
    })
    .from(sentinelEvents)
    .where(gte(sentinelEvents.createdAt, since))
    .groupBy(sentinelEvents.module);

  const modules: Record<string, any> = {};
  let overallTotal = 0;
  let overallPassed = 0;
  let latest: Date | null = null;

  for (const row of rows) {
    const totalChecks = Number(row.totalChecks ?? 0);
    const passed = Number(row.passed ?? 0);
    const warnings = Number(row.warnings ?? 0);
    const blocks = Number(row.blocks ?? 0);
    const passRate = totalChecks > 0 ? passed / totalChecks : 1;

    modules[row.module] = { totalChecks, passed, warnings, blocks, passRate };
    overallTotal += totalChecks;
    overallPassed += passed;

    if (row.lastCheckAt) {
      const candidate = new Date(row.lastCheckAt);
      if (!latest || candidate > latest) latest = candidate;
    }
  }

  return {
    modules,
    overall: {
      totalChecks: overallTotal,
      passed: overallPassed,
      passRate: overallTotal > 0 ? overallPassed / overallTotal : 1,
    },
    lastCheckAt: latest?.toISOString() ?? null,
  };
}
