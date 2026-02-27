/**
 * Sentinel Engine Unit Tests
 *
 * Focuses on pure synchronous checks in sentinelEngine and adds smoke tests
 * for async DB-backed functions with a mocked db client.
 */

jest.mock('../../../infra/db', () => ({
  db: {
    insert: jest.fn(),
    update: jest.fn(),
    select: jest.fn(),
  },
}));

import { db } from '../../../infra/db';
import {
  evaluate,
  evaluateRule,
  recordEvents,
  muteIssue,
  getIssues,
  getHealthSummary,
} from '../sentinelEngine';
import { rulesByModule } from '../sentinelRules';

describe('evaluate', () => {
  it('returns a SentinelReport with expected top-level fields', () => {
    const report = evaluate('forge', { alpha: 50 });

    expect(report).toMatchObject({
      module: 'forge',
    });
    expect(report.timestamp).toBeInstanceOf(Date);
    expect(typeof report.totalChecks).toBe('number');
    expect(typeof report.passed).toBe('number');
    expect(typeof report.warnings).toBe('number');
    expect(typeof report.blocks).toBe('number');
    expect(Array.isArray(report.events)).toBe(true);
  });

  it('passed + failed(events) equals total rules in the module', () => {
    const report = evaluate('forge', { alpha: 50 });
    const totalRules = (rulesByModule.forge ?? []).length;

    expect(report.totalChecks).toBe(totalRules);
    expect(report.passed + report.events.length).toBe(report.totalChecks);
  });

  it('returns a valid report shape when data is an empty object', () => {
    const report = evaluate('forge', {});

    expect(report.totalChecks).toBe((rulesByModule.forge ?? []).length);
    expect(report.passed + report.events.length).toBe(report.totalChecks);
    expect(report.events.length).toBeGreaterThan(0);
  });

  it('does not throw when module has no rules', () => {
    expect(() => evaluate('rolebank', { any: 'payload' })).not.toThrow();

    const report = evaluate('rolebank', { any: 'payload' });
    expect(report.totalChecks).toBe(0);
    expect(report.passed).toBe(0);
    expect(report.warnings).toBe(0);
    expect(report.blocks).toBe(0);
    expect(report.events).toEqual([]);
  });
});

describe('evaluateRule', () => {
  it('returns { passed: true } for a valid ruleId with compliant data', () => {
    const result = evaluateRule('forge.alpha_bounds', { alpha: 75 });

    expect(result.passed).toBe(true);
  });

  it('returns { passed: false, message: string } for a valid ruleId with non-compliant data', () => {
    const result = evaluateRule('forge.alpha_bounds', { alpha: 101 });

    expect(result.passed).toBe(false);
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('returns { passed: false } for an unknown ruleId', () => {
    const result = evaluateRule('unknown.rule.id', { alpha: 50 });

    expect(result.passed).toBe(false);
    expect(result.message).toContain('Unknown sentinel rule');
  });
});

describe('async function smoke tests', () => {
  const mockedDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockedDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
      }),
    } as any);
  });

  it('recordEvents resolves without throwing when given an empty array', async () => {
    await expect(recordEvents([])).resolves.toBeUndefined();
  });

  it('muteIssue resolves without throwing', async () => {
    await expect(muteIssue('fp_test_123', 'test reason')).resolves.toBeUndefined();
  });

  it('getIssues resolves to an array', async () => {
    const issueQueryChain = {
      from: jest.fn(),
      leftJoin: jest.fn(),
      where: jest.fn(),
      groupBy: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
    } as any;

    issueQueryChain.from.mockReturnValue(issueQueryChain);
    issueQueryChain.leftJoin.mockReturnValue(issueQueryChain);
    issueQueryChain.where.mockReturnValue(issueQueryChain);
    issueQueryChain.groupBy.mockReturnValue(issueQueryChain);
    issueQueryChain.orderBy.mockReturnValue(issueQueryChain);
    issueQueryChain.limit.mockResolvedValue([]);

    mockedDb.select.mockReturnValueOnce(issueQueryChain as any);

    await expect(getIssues()).resolves.toEqual([]);
  });

  it('getHealthSummary resolves to an object with an overall key', async () => {
    const healthQueryChain = {
      from: jest.fn(),
      where: jest.fn(),
      groupBy: jest.fn(),
    } as any;

    healthQueryChain.from.mockReturnValue(healthQueryChain);
    healthQueryChain.where.mockReturnValue(healthQueryChain);
    healthQueryChain.groupBy.mockResolvedValue([]);

    mockedDb.select.mockReturnValueOnce(healthQueryChain as any);

    const summary = await getHealthSummary();
    expect(summary).toEqual(
      expect.objectContaining({
        overall: expect.any(Object),
      })
    );
  });
});
