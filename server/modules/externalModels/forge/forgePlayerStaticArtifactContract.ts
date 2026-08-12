import crypto from 'crypto';

/**
 * Pure admission rules shared by the promoted-artifact runtime and offline
 * audits. Keeping these checks free of logging and transport errors lets an
 * audit fail closed without reimplementing (and eventually drifting from)
 * the runtime consumer's accepted artifact envelope.
 */

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getPathValue(record: Record<string, unknown>, key: string): unknown {
  if (!key.includes('.')) return record[key];
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, record);
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = getPathValue(record, key);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  throw new Error(`Cannot canonicalize non-JSON value of type ${typeof value} for FORGE_PLAYER_STATIC_V1 digest.`);
}

export function computeForgePlayerStaticRowsDigest(rows: unknown[]): string {
  return crypto.createHash('sha256').update(canonicalJson(rows), 'utf8').digest('hex');
}

export type ForgePlayerStaticIntegrity = 'digest_verified' | 'digest_missing';

export type ForgePlayerStaticDigestAssessment =
  | {
      accepted: true;
      integrity: ForgePlayerStaticIntegrity;
      /** Preserve the client's existing warning only for object envelopes. */
      warnMissingDigest: boolean;
    }
  | {
      accepted: false;
      reason: 'unsupported_declaration' | 'missing_rows' | 'digest_mismatch' | 'canonicalization_error';
    };

/**
 * Match the client integrity gate exactly. A missing declaration is legacy
 * compatible. Once `content_digest` is present, however, it binds only the
 * root `rows` array; adapter aliases cannot satisfy or bypass that binding.
 */
export function assessForgePlayerStaticContentDigest(payload: unknown): ForgePlayerStaticDigestAssessment {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    // Shape problems are the adapter's concern; integrity is simply absent.
    return { accepted: true, integrity: 'digest_missing', warnMissingDigest: false };
  }

  const artifact = payload as Record<string, unknown>;
  const digest = artifact.content_digest as Record<string, unknown> | undefined;
  if (digest === undefined) {
    return { accepted: true, integrity: 'digest_missing', warnMissingDigest: true };
  }

  const supportedDeclaration =
    typeof digest === 'object' &&
    digest !== null &&
    digest.algorithm === 'sha256' &&
    digest.scope === 'rows' &&
    digest.canonicalization === 'json_sorted_keys_no_whitespace_v1' &&
    typeof digest.value === 'string' &&
    /^[0-9a-f]{64}$/.test(digest.value);
  if (!supportedDeclaration) {
    return { accepted: false, reason: 'unsupported_declaration' };
  }

  if (!Array.isArray(artifact.rows)) {
    return { accepted: false, reason: 'missing_rows' };
  }

  try {
    return computeForgePlayerStaticRowsDigest(artifact.rows) === digest.value
      ? { accepted: true, integrity: 'digest_verified', warnMissingDigest: false }
      : { accepted: false, reason: 'digest_mismatch' };
  } catch {
    return { accepted: false, reason: 'canonicalization_error' };
  }
}

export type ForgePlayerStaticDeclarationAssessment =
  | {
      accepted: true;
      record: Record<string, unknown>;
      declaredId: string | null;
      declaredVersion: string | null;
    }
  | {
      accepted: false;
      reason: 'invalid_object' | 'unsupported_id' | 'unsupported_version';
      declaredId: string | null;
      declaredVersion: string | null;
    };

/**
 * Match the adapter's declared artifact ID/version admission gate.
 *
 * The nullish metadata chains, shallow merge order, alias order, and broad v1
 * spellings are intentionally preserved. They are existing runtime contract,
 * not new normalization performed by the audit.
 */
export function assessForgePlayerStaticDeclaration(payload: unknown): ForgePlayerStaticDeclarationAssessment {
  const record = toRecord(payload);
  if (Object.keys(record).length === 0) {
    return {
      accepted: false,
      reason: 'invalid_object',
      declaredId: null,
      declaredVersion: null,
    };
  }

  const meta = toRecord(record.meta ?? record.metadata ?? record.manifest);
  const manifest = toRecord(
    record.consumer_manifest ?? record.downstream_consumer_manifest ?? record.manifest,
  );
  const merged = { ...record, ...meta, ...manifest };
  const declaredId = pickString(merged, [
    'artifact_type',
    'artifactType',
    'artifact_id',
    'artifactId',
    'artifact_name',
    'artifactName',
    'name',
    'id',
    'contract',
    'contract_id',
    'contractId',
  ]);
  const declaredVersion = pickString(merged, [
    'version',
    'contract_version',
    'contractVersion',
    'schema_version',
    'schemaVersion',
  ]);
  const normalizedDeclaredId = declaredId?.toUpperCase();

  if (
    normalizedDeclaredId &&
    normalizedDeclaredId !== 'FORGE_PLAYER_STATIC_V1' &&
    normalizedDeclaredId !== 'FORGE_PLAYER_STATIC' &&
    !normalizedDeclaredId.includes('FORGE_PLAYER_STATIC_V1')
  ) {
    return {
      accepted: false,
      reason: 'unsupported_id',
      declaredId,
      declaredVersion,
    };
  }

  if (
    declaredVersion &&
    !declaredVersion.toLowerCase().includes('v1') &&
    !declaredVersion.startsWith('1')
  ) {
    return {
      accepted: false,
      reason: 'unsupported_version',
      declaredId,
      declaredVersion,
    };
  }

  return { accepted: true, record, declaredId, declaredVersion };
}
