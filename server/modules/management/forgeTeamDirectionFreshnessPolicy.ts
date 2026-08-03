import type { ForgePlayerStaticLookup } from '../externalModels/forge/forgePlayerStaticTypes';

export const TEAM_DIRECTION_FORGE_FRESHNESS_POLICY_ID =
  'team_direction_forge_player_static_freshness_v1' as const;
export const TEAM_DIRECTION_FORGE_FRESHNESS_RECEIPT_VERSION =
  'team_direction_forge_player_static_freshness_receipt_v1' as const;
export const TEAM_DIRECTION_FORGE_FRESHNESS_MAX_AGE_DAYS = 45;
export const TEAM_DIRECTION_FORGE_USE_ID =
  'forge_player_specific.team_direction_classification' as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_AGE_MS = TEAM_DIRECTION_FORGE_FRESHNESS_MAX_AGE_DAYS * MS_PER_DAY;

export type TeamDirectionForgeFreshnessStatus =
  | 'fresh'
  | 'warning'
  | 'stale'
  | 'unknown'
  | 'missing'
  | 'malformed'
  | 'future';

export type TeamDirectionForgeFreshnessReasonCode =
  | 'accepted_fresh'
  | 'artifact_unavailable'
  | 'root_generated_at_missing'
  | 'root_generated_at_source_unknown'
  | 'root_generated_at_malformed'
  | 'root_generated_at_future'
  | 'root_generated_at_warning'
  | 'root_generated_at_stale';

export interface TeamDirectionForgeRosterEvidenceInput {
  rosterKey?: string | null;
  canonicalId?: string | null;
  name?: string | null;
  pos?: string | null;
  position?: string | null;
  alpha?: number | null;
  forgeScoreSource?: string | null;
  forgeScoreProvenance?: unknown;
}

export interface TeamDirectionForgeRawEvidenceRow {
  rosterIndex: number;
  rosterKey: string | null;
  canonicalId: string | null;
  playerName: string | null;
  position: string | null;
  alpha: number;
  scoreSource: string | null;
  provenance: unknown;
}

export interface TeamDirectionForgeFreshnessReceiptV1 {
  receiptVersion: typeof TEAM_DIRECTION_FORGE_FRESHNESS_RECEIPT_VERSION;
  policyId: typeof TEAM_DIRECTION_FORGE_FRESHNESS_POLICY_ID;
  useId: typeof TEAM_DIRECTION_FORGE_USE_ID;
  decision: 'accepted' | 'rejected';
  status: TeamDirectionForgeFreshnessStatus;
  reasonCode: TeamDirectionForgeFreshnessReasonCode;
  clocks: {
    clockSource: 'root.generated_at';
    generatedAtSource: 'root_generated_at' | null;
    evaluatedAt: string;
    generatedAt: string | null;
    promotedAt: string | null;
    promotedAtCanRefreshClock: false;
    acceptedThrough: string | null;
    ageSeconds: number | null;
    ageDays: number | null;
    maximumAgeDays: typeof TEAM_DIRECTION_FORGE_FRESHNESS_MAX_AGE_DAYS;
    boundary: 'elapsed_utc_time';
  };
  artifact: {
    state: string | null;
    available: boolean;
    code: string | null;
    sourcePath: string | null;
    contractVersion: string | null;
    warnOnlyFreshnessStatus: string | null;
  };
  provenance: {
    requiredScoreSource: 'player_specific';
    explicitPlayerSpecificRequired: true;
  };
  evidence: {
    rosterTotal: number;
    observedForgeRows: number;
    observedPlayerSpecificRows: number;
    eligiblePlayerSpecificRows: number;
    rejectedPlayerSpecificRows: number;
    rows: TeamDirectionForgeRawEvidenceRow[];
  };
  gaps: string[];
  conflicts: string[];
}

type ForgeArtifactInput = Partial<ForgePlayerStaticLookup['artifact']> & {
  promotedAt?: string | null;
};

export interface BuildTeamDirectionForgeFreshnessReceiptInput {
  artifact?: ForgeArtifactInput | null;
  rosterPlayers?: readonly TeamDirectionForgeRosterEvidenceInput[];
  now?: Date;
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  // Parse the approved ISO shape ourselves. Date.parse normalizes impossible
  // calendar values (for example April 31 or hour 24), which would make a
  // freshness boundary fail open.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/i.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number((match[7] ?? '').padEnd(3, '0'));
  const offsetHour = match[8].toUpperCase() === 'Z' ? 0 : Number(match[10]);
  const offsetMinute = match[8].toUpperCase() === 'Z' ? 0 : Number(match[11]);

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 || month > 12
    || day < 1 || day > daysInMonth[month - 1]
    || hour > 23 || minute > 59 || second > 59
    || offsetHour > 14 || offsetMinute > 59
    || (offsetHour === 14 && offsetMinute !== 0)
  ) return null;

  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, millisecond);
  const offsetSign = match[9] === '-' ? -1 : 1;
  const offsetMs = match[8].toUpperCase() === 'Z'
    ? 0
    : offsetSign * (offsetHour * 60 + offsetMinute) * 60 * 1000;
  const parsed = local.getTime() - offsetMs;
  return Number.isFinite(parsed) ? parsed : null;
}

function rawEvidenceRows(
  rosterPlayers: readonly TeamDirectionForgeRosterEvidenceInput[],
): TeamDirectionForgeRawEvidenceRow[] {
  return rosterPlayers.flatMap((player, rosterIndex) => {
    if (typeof player.alpha !== 'number' || !Number.isFinite(player.alpha)) return [];
    return [{
      rosterIndex,
      rosterKey: player.rosterKey ?? null,
      canonicalId: player.canonicalId ?? null,
      playerName: player.name ?? null,
      position: player.pos ?? player.position ?? null,
      alpha: player.alpha,
      scoreSource: player.forgeScoreSource ?? null,
      provenance: player.forgeScoreProvenance ?? null,
    }];
  });
}

function statusForUnavailableArtifact(state: string | null): TeamDirectionForgeFreshnessStatus {
  if (state === 'missing') return 'missing';
  if (state === 'malformed' || state === 'duplicate_ids' || state === 'unsupported') return 'malformed';
  return 'unknown';
}

/**
 * Evaluate the Fantasy-owned Team Direction freshness policy at request time.
 * Only the root generated_at clock may make FORGE evidence eligible. The
 * adapter's generic freshness field is preserved for diagnostics but is never
 * authoritative here, and promoted_at can never refresh the decision clock.
 */
export function buildTeamDirectionForgeFreshnessReceipt(
  input: BuildTeamDirectionForgeFreshnessReceiptInput,
): TeamDirectionForgeFreshnessReceiptV1 {
  const artifact = input.artifact ?? null;
  const rosterPlayers = input.rosterPlayers ?? [];
  const now = input.now && Number.isFinite(input.now.getTime()) ? input.now : new Date();
  const evaluatedAt = now.toISOString();
  const generatedAt = typeof artifact?.generatedAt === 'string' ? artifact.generatedAt : null;
  const promotedAt = typeof artifact?.promotedAt === 'string' ? artifact.promotedAt : null;
  const rows = rawEvidenceRows(rosterPlayers);
  const observedPlayerSpecificRows = rows.filter((row) => row.scoreSource === 'player_specific').length;

  let status: TeamDirectionForgeFreshnessStatus;
  let reasonCode: TeamDirectionForgeFreshnessReasonCode;
  let ageMs: number | null = null;
  let acceptedThrough: string | null = null;

  if (artifact?.available !== true || artifact?.state !== 'available') {
    status = statusForUnavailableArtifact(artifact?.state ?? null);
    reasonCode = 'artifact_unavailable';
  } else if (generatedAt === null || generatedAt.trim() === '') {
    status = 'missing';
    reasonCode = 'root_generated_at_missing';
  } else if (artifact?.generatedAtSource !== 'root_generated_at') {
    status = 'unknown';
    reasonCode = 'root_generated_at_source_unknown';
  } else {
    const generatedAtMs = parseTimestamp(generatedAt);
    if (generatedAtMs === null) {
      status = 'malformed';
      reasonCode = 'root_generated_at_malformed';
    } else {
      ageMs = now.getTime() - generatedAtMs;
      acceptedThrough = new Date(generatedAtMs + MAX_AGE_MS).toISOString();
      if (ageMs < 0) {
        status = 'future';
        reasonCode = 'root_generated_at_future';
      } else if (ageMs <= MAX_AGE_MS) {
        status = 'fresh';
        reasonCode = 'accepted_fresh';
      } else if (ageMs <= MAX_AGE_MS * 2) {
        status = 'warning';
        reasonCode = 'root_generated_at_warning';
      } else {
        status = 'stale';
        reasonCode = 'root_generated_at_stale';
      }
    }
  }

  const accepted = status === 'fresh';
  const missingExplicitProvenanceRows = rows.filter((row) => row.scoreSource !== 'player_specific').length;
  const gaps: string[] = [];
  if (artifact?.available !== true || artifact?.state !== 'available') gaps.push('forge_player_static_artifact_unavailable');
  if (reasonCode === 'root_generated_at_missing') gaps.push('root_generated_at_missing');
  if (reasonCode === 'root_generated_at_source_unknown') gaps.push('root_generated_at_source_unknown');
  if (missingExplicitProvenanceRows > 0) gaps.push('forge_rows_without_explicit_player_specific_provenance');

  const conflicts: string[] = [];
  const warnOnlyStatus = artifact?.freshness?.status ?? null;
  if (warnOnlyStatus === 'fresh' && !accepted) conflicts.push('warn_only_freshness_disagrees_with_named_policy');
  if (promotedAt !== null) conflicts.push('promoted_at_present_but_ineligible_to_refresh_clock');

  return {
    receiptVersion: TEAM_DIRECTION_FORGE_FRESHNESS_RECEIPT_VERSION,
    policyId: TEAM_DIRECTION_FORGE_FRESHNESS_POLICY_ID,
    useId: TEAM_DIRECTION_FORGE_USE_ID,
    decision: accepted ? 'accepted' : 'rejected',
    status,
    reasonCode,
    clocks: {
      clockSource: 'root.generated_at',
      generatedAtSource: artifact?.generatedAtSource === 'root_generated_at' ? 'root_generated_at' : null,
      evaluatedAt,
      generatedAt,
      promotedAt,
      promotedAtCanRefreshClock: false,
      acceptedThrough,
      ageSeconds: ageMs === null ? null : ageMs / 1000,
      ageDays: ageMs === null ? null : ageMs / MS_PER_DAY,
      maximumAgeDays: TEAM_DIRECTION_FORGE_FRESHNESS_MAX_AGE_DAYS,
      boundary: 'elapsed_utc_time',
    },
    artifact: {
      state: artifact?.state ?? null,
      available: artifact?.available === true,
      code: artifact?.code ?? null,
      sourcePath: artifact?.sourcePath ?? null,
      contractVersion: artifact?.contractVersion ?? null,
      warnOnlyFreshnessStatus: warnOnlyStatus,
    },
    provenance: {
      requiredScoreSource: 'player_specific',
      explicitPlayerSpecificRequired: true,
    },
    evidence: {
      rosterTotal: rosterPlayers.length,
      observedForgeRows: rows.length,
      observedPlayerSpecificRows,
      eligiblePlayerSpecificRows: accepted ? observedPlayerSpecificRows : 0,
      rejectedPlayerSpecificRows: accepted ? 0 : observedPlayerSpecificRows,
      rows,
    },
    gaps,
    conflicts,
  };
}

export function isAcceptedTeamDirectionForgeFreshnessReceipt(
  receipt: unknown,
): receipt is TeamDirectionForgeFreshnessReceiptV1 & {
  decision: 'accepted';
  status: 'fresh';
} {
  if (!isSupportedTeamDirectionForgeFreshnessReceipt(receipt)) return false;
  if (
    receipt.decision !== 'accepted'
    || receipt.status !== 'fresh'
    || receipt.reasonCode !== 'accepted_fresh'
    || receipt.artifact.available !== true
    || receipt.artifact.state !== 'available'
    || receipt.clocks.generatedAtSource !== 'root_generated_at'
    || receipt.clocks.maximumAgeDays !== TEAM_DIRECTION_FORGE_FRESHNESS_MAX_AGE_DAYS
    || receipt.clocks.boundary !== 'elapsed_utc_time'
    || receipt.provenance.explicitPlayerSpecificRequired !== true
  ) return false;

  const generatedAtMs = parseTimestamp(receipt.clocks.generatedAt);
  const evaluatedAtMs = parseTimestamp(receipt.clocks.evaluatedAt);
  if (generatedAtMs === null || evaluatedAtMs === null) return false;
  const ageMs = evaluatedAtMs - generatedAtMs;
  if (ageMs < 0 || ageMs > MAX_AGE_MS) return false;

  return receipt.clocks.acceptedThrough === new Date(generatedAtMs + MAX_AGE_MS).toISOString()
    && receipt.clocks.ageSeconds === ageMs / 1000
    && receipt.clocks.ageDays === ageMs / MS_PER_DAY
    && receipt.evidence.eligiblePlayerSpecificRows === receipt.evidence.observedPlayerSpecificRows
    && receipt.evidence.rejectedPlayerSpecificRows === 0;
}

export function isSupportedTeamDirectionForgeFreshnessReceipt(
  receipt: unknown,
): receipt is TeamDirectionForgeFreshnessReceiptV1 {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;
  const candidate = receipt as Partial<TeamDirectionForgeFreshnessReceiptV1>;
  return candidate.receiptVersion === TEAM_DIRECTION_FORGE_FRESHNESS_RECEIPT_VERSION
    && candidate.policyId === TEAM_DIRECTION_FORGE_FRESHNESS_POLICY_ID
    && candidate.useId === TEAM_DIRECTION_FORGE_USE_ID
    && (candidate.decision === 'accepted' || candidate.decision === 'rejected')
    && typeof candidate.status === 'string'
    && typeof candidate.reasonCode === 'string'
    && candidate.artifact !== null
    && typeof candidate.artifact === 'object'
    && candidate.clocks !== null
    && typeof candidate.clocks === 'object'
    && candidate.clocks.clockSource === 'root.generated_at'
    && candidate.clocks.promotedAtCanRefreshClock === false
    && candidate.provenance !== null
    && typeof candidate.provenance === 'object'
    && candidate.provenance.requiredScoreSource === 'player_specific'
    && candidate.evidence !== null
    && typeof candidate.evidence === 'object'
    && Array.isArray(candidate.evidence.rows)
    && Array.isArray(candidate.gaps)
    && Array.isArray(candidate.conflicts);
}
