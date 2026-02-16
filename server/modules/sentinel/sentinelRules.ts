import { getPositionForgeWeights, POSITION_TIER_THRESHOLDS, ViewMode } from '../forge/forgeGrading';
import { SentinelRule } from './sentinelTypes';

const VALID_PERSONNEL_CLASSIFICATIONS = new Set([
  'FULL_TIME',
  '11_ONLY',
  'HEAVY_ONLY',
  'ROTATIONAL',
  'LOW_SAMPLE',
]);

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return Number.NaN;
}

function getForgeTierFromAlpha(alpha: number, position: keyof typeof POSITION_TIER_THRESHOLDS): string {
  const [t1, t2, t3, t4] = POSITION_TIER_THRESHOLDS[position];
  if (alpha >= t1) return 'T1';
  if (alpha >= t2) return 'T2';
  if (alpha >= t3) return 'T3';
  if (alpha >= t4) return 'T4';
  return 'T5';
}

export const sentinelRules: SentinelRule[] = [
  {
    id: 'forge.alpha_bounds',
    module: 'forge',
    name: 'FORGE alpha bounds',
    description: 'Alpha score must be between 0 and 100.',
    severity: 'block',
    check: (data) => {
      const alpha = toNumber(data?.alpha);
      const passed = Number.isFinite(alpha) && alpha >= 0 && alpha <= 100;
      return {
        passed,
        confidence: 1.0,
        message: passed ? 'Alpha is within bounds.' : `Alpha score ${String(data?.alpha)} is outside 0-100 range.`,
        details: { alpha },
      };
    },
  },
  {
    id: 'forge.alpha_nan',
    module: 'forge',
    name: 'FORGE alpha not NaN/null',
    description: 'Alpha score must be a valid number and not null.',
    severity: 'block',
    check: (data) => {
      const alpha = data?.alpha;
      const parsed = toNumber(alpha);
      const passed = alpha !== null && alpha !== undefined && !Number.isNaN(parsed) && Number.isFinite(parsed);
      return {
        passed,
        confidence: 1.0,
        message: passed ? 'Alpha is a valid number.' : 'Alpha score is null/undefined/NaN.',
        details: { alpha },
      };
    },
  },
  {
    id: 'forge.pillar_bounds',
    module: 'forge',
    name: 'FORGE pillar bounds',
    description: 'All pillar scores must be between 0 and 100.',
    severity: 'warn',
    check: (data) => {
      const subScores = data?.subScores ?? {};
      const fields = ['volume', 'efficiency', 'contextFit', 'stability'] as const;
      const invalid = fields
        .map((field) => ({ field, value: toNumber(subScores[field]) }))
        .filter((entry) => !Number.isFinite(entry.value) || entry.value < 0 || entry.value > 100);
      return {
        passed: invalid.length === 0,
        confidence: 0.9,
        message: invalid.length === 0 ? 'All pillars are in range.' : 'One or more pillar scores are out of 0-100 range.',
        details: { invalid },
      };
    },
  },
  {
    id: 'forge.pillar_nan',
    module: 'forge',
    name: 'FORGE pillar NaN/null guard',
    description: 'All pillar scores must be non-null finite numbers.',
    severity: 'block',
    check: (data) => {
      const subScores = data?.subScores ?? {};
      const fields = ['volume', 'efficiency', 'contextFit', 'stability'] as const;
      const invalid = fields.filter((field) => {
        const value = subScores[field];
        const parsed = toNumber(value);
        return value === null || value === undefined || Number.isNaN(parsed) || !Number.isFinite(parsed);
      });

      return {
        passed: invalid.length === 0,
        confidence: 1.0,
        message: invalid.length === 0 ? 'All pillars are finite.' : `Invalid pillar values: ${invalid.join(', ')}.`,
        details: { invalid },
      };
    },
  },
  {
    id: 'forge.tier_consistency',
    module: 'forge',
    name: 'FORGE tier consistency',
    description: 'Tier should align with alpha threshold for position.',
    severity: 'warn',
    check: (data) => {
      const alpha = toNumber(data?.alpha);
      const position = (data?.position ?? '').toUpperCase();
      const tier = String(data?.tier ?? '').toUpperCase();

      if (!['QB', 'RB', 'WR', 'TE'].includes(position)) {
        return {
          passed: false,
          confidence: 0.85,
          message: `Unsupported position for tier check: ${position || 'unknown'}.`,
          details: { position, tier, alpha },
        };
      }

      const expectedTier = getForgeTierFromAlpha(alpha, position as keyof typeof POSITION_TIER_THRESHOLDS);
      const passed = expectedTier === tier;
      return {
        passed,
        confidence: 0.85,
        message: passed
          ? 'Tier matches alpha threshold.'
          : `Tier mismatch: expected ${expectedTier} from alpha ${alpha}, received ${tier || 'missing'}.`,
        details: { position, alpha, tier, expectedTier },
      };
    },
  },
  {
    id: 'forge.weight_sum',
    module: 'forge',
    name: 'FORGE weight normalization',
    description: 'Pillar weights must sum to 1.0 ± 0.01.',
    severity: 'block',
    check: (data) => {
      const position = (data?.position ?? '').toUpperCase() as 'QB' | 'RB' | 'WR' | 'TE';
      const mode = (data?.mode ?? 'redraft') as ViewMode;
      const weights = data?.weights ?? (['QB', 'RB', 'WR', 'TE'].includes(position) ? getPositionForgeWeights(position, mode) : null);
      if (!weights) {
        return {
          passed: false,
          confidence: 1.0,
          message: 'Missing weights and/or position to validate weight sum.',
          details: { position, mode },
        };
      }

      const total = Number(weights.volume ?? 0) + Number(weights.efficiency ?? 0) + Number(weights.teamContext ?? 0) + Number(weights.stability ?? 0);
      const passed = Math.abs(total - 1) <= 0.01;

      return {
        passed,
        confidence: 1.0,
        message: passed ? 'Weight sum is normalized.' : `Weight sum ${total.toFixed(4)} is outside [0.99, 1.01].`,
        details: { total, weights },
      };
    },
  },
  {
    id: 'forge.batch_empty',
    module: 'forge',
    name: 'FORGE batch empty response',
    description: 'Batch responses should contain at least one player.',
    severity: 'info',
    check: (data) => {
      const hasBatchContext = Array.isArray(data?.scores) || data?.count !== undefined;
      if (!hasBatchContext) {
        return {
          passed: true,
          confidence: 0.7,
          message: 'Batch empty check skipped for non-batch payload.',
        };
      }

      const count = Array.isArray(data?.scores) ? data.scores.length : Number(data?.count ?? 0);
      return {
        passed: count >= 1,
        confidence: 0.7,
        message: count >= 1 ? 'Batch contains at least one player.' : 'Batch response is empty for requested position.',
        details: { count, position: data?.position ?? null },
      };
    },
  },
  {
    id: 'forge.player_count',
    module: 'forge',
    name: 'FORGE player count sanity',
    description: 'Batch responses should usually include more than 10 players.',
    severity: 'warn',
    check: (data) => {
      const hasBatchContext = Array.isArray(data?.scores) || data?.count !== undefined;
      if (!hasBatchContext) {
        return {
          passed: true,
          confidence: 0.8,
          message: 'Player count check skipped for non-batch payload.',
        };
      }

      const count = Array.isArray(data?.scores) ? data.scores.length : Number(data?.count ?? 0);
      return {
        passed: count > 10,
        confidence: 0.8,
        message: count > 10 ? 'Player count looks reasonable.' : `Low player count (${count}).`,
        details: { count, position: data?.position ?? null },
      };
    },
  },
  {
    id: 'personnel.snap_positive',
    module: 'personnel',
    name: 'Personnel snaps positive',
    description: 'Total snaps/plays must be > 0.',
    severity: 'block',
    check: (data) => {
      const total = toNumber(data?.totalPlaysCounted);
      return {
        passed: Number.isFinite(total) && total > 0,
        confidence: 1.0,
        message: total > 0 ? 'Total plays are positive.' : `Total plays must be > 0 (received ${String(data?.totalPlaysCounted)}).`,
        details: { totalPlaysCounted: total },
      };
    },
  },
  {
    id: 'personnel.pct_sum',
    module: 'personnel',
    name: 'Personnel bucket percentage sum',
    description: 'Bucket percentages should sum to 95-105%.',
    severity: 'warn',
    check: (data) => {
      const breakdown = data?.breakdown ?? {};
      const keys = ['10', '11', '12', '13', '21', '22', 'other'];
      const pctSum = keys.reduce((sum, key) => sum + (toNumber(breakdown?.[key]?.pct) || 0), 0) * 100;
      const passed = pctSum >= 95 && pctSum <= 105;
      return {
        passed,
        confidence: 0.85,
        message: passed ? 'Bucket percentage sum is in tolerance.' : `Bucket percentage sum ${pctSum.toFixed(2)}% is outside 95-105%.`,
        details: { pctSum },
      };
    },
  },
  {
    id: 'personnel.snap_reasonable',
    module: 'personnel',
    name: 'Personnel top player sample size',
    description: 'Top player sample should typically exceed 200 snaps/plays for season scope.',
    severity: 'info',
    check: (data) => {
      const total = toNumber(data?.totalPlaysCounted);
      return {
        passed: total > 200,
        confidence: 0.7,
        message: total > 200 ? 'Sample size is strong.' : `Sample size is low (${total}).`,
        details: { totalPlaysCounted: total },
      };
    },
  },
  {
    id: 'personnel.classification_valid',
    module: 'personnel',
    name: 'Personnel classification valid',
    description: 'Classification must be one of the known enum values.',
    severity: 'block',
    check: (data) => {
      const classification = data?.everyDownGrade;
      const passed = typeof classification === 'string' && VALID_PERSONNEL_CLASSIFICATIONS.has(classification);
      return {
        passed,
        confidence: 1.0,
        message: passed ? 'Classification is valid.' : `Invalid classification: ${String(classification)}.`,
        details: { classification },
      };
    },
  },
  {
    id: 'datalab.snapshot_exists',
    module: 'datalab',
    name: 'Data Lab snapshot existence',
    description: 'At least one snapshot should exist for requested season.',
    severity: 'warn',
    check: (data) => {
      const count = Number(data?.snapshotCount ?? 0);
      return {
        passed: count > 0,
        confidence: 0.9,
        message: count > 0 ? 'Snapshots exist.' : 'No snapshots found for season.',
        details: { snapshotCount: count, season: data?.season ?? null },
      };
    },
  },
  {
    id: 'datalab.snapshot_recency',
    module: 'datalab',
    name: 'Data Lab snapshot recency',
    description: 'Most recent snapshot should be within 14 days.',
    severity: 'info',
    check: (data) => {
      const latest = data?.latestSnapshotAt ? new Date(data.latestSnapshotAt) : null;
      const ageDays = latest ? (Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24) : Number.POSITIVE_INFINITY;
      const passed = Number.isFinite(ageDays) && ageDays <= 14;
      return {
        passed,
        confidence: 0.6,
        message: passed ? 'Snapshot recency is acceptable.' : `Latest snapshot is stale (${ageDays.toFixed(1)} days old).`,
        details: { latestSnapshotAt: latest?.toISOString() ?? null, ageDays },
      };
    },
  },
  {
    id: 'system.response_shape',
    module: 'system',
    name: 'System response shape',
    description: 'Response contains expected top-level keys.',
    severity: 'block',
    check: (data) => {
      const expectedKeys: string[] = Array.isArray(data?.expectedKeys) ? data.expectedKeys : [];
      const payload = data?.payload ?? data;
      const missingKeys = expectedKeys.filter((key) => !(key in (payload || {})));
      return {
        passed: missingKeys.length === 0,
        confidence: 1.0,
        message: missingKeys.length === 0 ? 'Response shape is valid.' : `Missing top-level keys: ${missingKeys.join(', ')}.`,
        details: { expectedKeys, missingKeys },
      };
    },
  },
];

export const rulesByModule = sentinelRules.reduce<Record<string, SentinelRule[]>>((acc, rule) => {
  if (!acc[rule.module]) acc[rule.module] = [];
  acc[rule.module].push(rule);
  return acc;
}, {});

export const rulesById = new Map(sentinelRules.map((rule) => [rule.id, rule]));
