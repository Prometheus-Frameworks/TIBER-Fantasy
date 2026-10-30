import { z } from 'zod';

export const ROLE_TOOL = 'tiber_get_rop_role_history' as const;
export const roleHistoryInput = z.object({
  subject: z.object({ namespace: z.literal('nflverse:gsis'), id: z.string().regex(/^00-\d{7}$/) }).strict(),
  season: z.number().int().min(1900).max(2100),
  seasonType: z.enum(['REG', 'PRE', 'POST']),
  weeks: z.array(z.number().int().min(1).max(22)).min(1).max(5)
    .refine(weeks => new Set(weeks).size === weeks.length, 'Distinct weeks required'),
}).strict();

const object = z.record(z.unknown());
const rowSchema = object.and(z.object({
  player_id: z.string().regex(/^00-\d{7}$/), namespace: z.literal('nflverse:gsis'),
  season: z.literal(2026), season_type: z.literal('REG'), week: z.number().int().min(1).max(5),
  coverage_status: z.enum(['observed', 'missing_source_evidence']),
  fields: object, observed_zero_fields: z.array(z.string()), segments: z.array(object),
  state_path: z.string().nullable(), finality: z.literal('unknown'), correction: z.literal('open'),
  evidence_cutoff: z.null(),
}));
const preparedSchema = z.object({
  schemaVersion: z.literal('tiber_private_rop_input_v1'),
  release: object.and(z.object({
    id: z.literal('TIBER-ROP-2026-W01-W05-Private-Release'), version: z.literal(2),
    archiveSha256: z.literal('d2bb08b185c7ec73d80480ccc7cbc234ce02d89ac6d57308f6bcfa34ff69af13'),
    outputSha256: z.literal('7cdfdb96fa5bbb1f6703698b83fe0f142c7498f74043be7bad72d6f5f3e91c49'),
  })),
  metadata: object,
  catalogue: z.array(object.and(z.object({ player_id: z.string().regex(/^00-\d{7}$/), namespace: z.literal('nflverse:gsis') }))).min(1).max(209),
  rows: z.array(rowSchema).min(1).max(1045),
  states: z.record(z.object({ reference: object, retained: object })),
}).strict();

export type RoleCall = ReturnType<typeof createRoleTools>;
/** Build-bound private input: release fixed by the validating build; full artifact parsed only on first enabled use. */
export type RoleSource = { release: Record<string, unknown>; load: () => unknown };
type Artifact = z.infer<typeof preparedSchema>;
type Reader = { artifact: Artifact; byId: Map<string, Artifact['catalogue'][number]>; rows: Map<string, z.infer<typeof rowSchema>> };
const unavailable = (reason: string) => ({ status: 'unavailable', reason });
const isSource = (value: unknown): value is RoleSource => typeof (value as RoleSource | null)?.load === 'function';

function index(value: unknown, release: unknown): Reader {
  // Validate only; retain the original JSON values (including all unknown upstream fields).
  preparedSchema.parse(value);
  const artifact = value as Artifact;
  if (release !== undefined && JSON.stringify(artifact.release) !== JSON.stringify(release)) throw Error('release binding mismatch');
  const byId: Reader['byId'] = new Map(), rows: Reader['rows'] = new Map();
  for (const player of artifact.catalogue) {
    if (byId.has(player.player_id)) throw Error('duplicate identity');
    byId.set(player.player_id, player);
  }
  for (const row of artifact.rows) {
    const key = `${row.player_id}:${row.week}`;
    if (!byId.has(row.player_id) || rows.has(key)) throw Error('invalid coverage');
    if (row.coverage_status === 'observed') {
      const retained = row.state_path && artifact.states[row.state_path];
      if (!retained) throw Error('missing state binding');
    } else if (row.state_path !== null) throw Error('unexpected state');
    rows.set(key, row);
  }
  for (const id of Array.from(byId.keys())) for (const week of [1, 2, 3, 4, 5]) {
    if (!rows.has(`${id}:${week}`)) throw Error('incomplete coverage');
  }
  return { artifact, byId, rows };
}

/**
 * Trusted build input only; no source fetch, joins or derivations. Construction does no artifact work:
 * disabled, missing or never-called readers never parse, copy or validate. The first valid enabled call
 * copies, validates and indexes once; a failure stays closed for the life of the reader.
 */
export function createRoleTools(input: unknown = null, enabled = false, now = () => new Date().toISOString()) {
  const reason = !enabled ? 'source_disabled' : input === null ? 'artifact_missing' : null;
  let reader: Reader | null | undefined;
  const initialize = () => {
    if (reason) return null;
    if (reader === undefined) {
      try {
        // A source yields a fresh parse; a plain object is copied so callers cannot reach retained values.
        reader = isSource(input) ? index(input.load(), input.release) : index(JSON.parse(JSON.stringify(input)), undefined);
      } catch { reader = null; }
    }
    return reader;
  };
  const release = () => reader ? reader.artifact.release : isSource(input) ? input.release : (input as { release?: unknown } | null)?.release;
  return {
    /** Fresh object per read. Before first use, build binding is reported and runtime validation is deferred. */
    get capability() {
      const state = reason ?? (reader === null ? 'artifact_invalid' : null);
      return { status: state ? 'unavailable' : 'available', reason: state,
        validation: reason ? 'not_applicable' : reader === undefined ? 'deferred' : reader ? 'passed' : 'failed',
        sourceMode: 'private_frozen_release', schemaVersion: 'tiber_rop_role_history_v1',
        scope: { season: 2026, seasonType: 'REG', weeks: [1, 2, 3, 4, 5] },
        identity: 'nflverse:gsis_only', consumerUse: 'owner_private_descriptive_only',
        tool: ROLE_TOOL, ...(!state && release() ? { release: JSON.parse(JSON.stringify(release())) } : {}) };
    },
    /** Explicit owner-build/check validation; serving never needs it. */
    initialize: () => initialize() !== null,
    call(name: string, raw: unknown): Record<string, unknown> {
      if (name !== ROLE_TOOL) return unavailable('unknown_tool');
      try {
        if (new TextEncoder().encode(JSON.stringify(raw)).byteLength > 2048) return unavailable('invalid_input');
        const parsed = roleHistoryInput.safeParse(raw);
        if (!parsed.success) return unavailable('invalid_input');
        if (reason) return unavailable(reason);
        const ready = initialize();
        if (!ready) return unavailable('artifact_invalid');
        const { artifact, byId, rows } = ready;
        const request = parsed.data;
        const subject = byId.get(request.subject.id);
        const inScope = request.season === 2026 && request.seasonType === 'REG';
        const result = { status: 'available', schemaVersion: 'tiber_rop_role_history_v1',
          retrievedAt: now(), request, release: artifact.release, metadata: artifact.metadata,
          subject: subject ?? request.subject, consumerUse: 'owner_private_descriptive_only',
          promotion: 'none',
          weeks: request.weeks.map(week => {
            if (!inScope || week > 5) return { week, status: 'outside_release_scope', record: null, state: null };
            if (!subject) return { week, status: 'outside_catalogue', record: null, state: null };
            const row = rows.get(`${request.subject.id}:${week}`)!;
            return { week, status: row.coverage_status, record: row,
              // Observed zero is an upstream field state, not a mutually exclusive player-week status.
              observedZeroFields: row.observed_zero_fields,
              state: row.state_path ? artifact!.states[row.state_path] : null };
          }) };
        // Never let a caller mutate the retained artifact through a returned reference.
        return JSON.parse(JSON.stringify(result));
      } catch { return unavailable('artifact_invalid'); }
    },
  };
}
